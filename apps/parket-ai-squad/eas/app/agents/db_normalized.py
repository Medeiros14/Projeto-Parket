"""Subclasse de PostgresDb do Agno que normaliza runs[].events.

Por que: o JSONB `runs` em `eas.agent_sessions` carrega events (10MB+) que infla
storage, UI fica lenta carregando, e Agno reescreve a coluna inteira a cada
event SSE durante streaming.

Estratégia:
1. Antes de chamar super().upsert_session, STRIPA events dos RunOutput in-place
   (e captura uma cópia dict pra mirror).
2. super() persiste o session.runs SEM events → JSONB pequeno.
3. Em try/finally restaura events nos RunOutput pra Agno seguir usando in-memory.
4. Best-effort mirror dos events capturados pra eas.run_events.
   Falha do mirror NUNCA propaga — o write principal já passou.

Member_responses NÃO é strippado: Agno `team.get_messages(member_ids=...)` lê.
Apenas mirror pra side table pra UI lazy load.

Cache `_mirror_cache[run_id] -> last_event_idx` evita re-INSERT (mesmo que
ON CONFLICT proteja, queremos pular o trabalho).
"""

from __future__ import annotations

import json
import logging
from threading import Lock
from typing import Any, Dict, List, Optional, Union

from agno.db.postgres import PostgresDb
from agno.session.agent import AgentSession
from agno.session.team import TeamSession
from agno.session.workflow import WorkflowSession
from sqlalchemy import text

log = logging.getLogger(__name__)

# Cache em memória — perdido em restart, reconstruído à medida que runs upsertam
_mirror_cache_lock = Lock()
_mirror_cache: Dict[str, int] = {}      # run_id -> max event_idx já gravado
_mresp_cache: Dict[str, int] = {}       # run_id -> max member_response_idx já gravado


def _to_dict_safe(obj: Any) -> Optional[Dict[str, Any]]:
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj
    to_dict = getattr(obj, "to_dict", None)
    if callable(to_dict):
        try:
            return to_dict()
        except Exception:
            return None
    return None


class NormalizedRunsPostgresDb(PostgresDb):
    """PostgresDb que strippa runs[].events pra coluna menor + side tables.

    Compatível com tudo do Agno: leitura/escrita normais, só sobrescreve o
    upsert pra interceptar runs.
    """

    def upsert_session(
        self,
        session: Union[AgentSession, TeamSession, WorkflowSession, Any],
        deserialize: Optional[bool] = True,
    ) -> Optional[Union[Any, Dict[str, Any]]]:
        # 1. Captura events+mresps como dicts (cópia) ANTES de strippar
        captured = self._capture_runs(session)

        # 2. Strippa events in-place nos RunOutput (member_responses fica)
        stashed = self._stash_events(session)

        try:
            result = super().upsert_session(session, deserialize=deserialize)
        finally:
            # 3. Restaura events nos objetos in-memory pra Agno seguir lendo
            self._unstash_events(stashed)

        # 4. Mirror pras tabelas filhas (best-effort)
        try:
            self._mirror(captured)
        except Exception as exc:
            log.warning("mirror_runs_to_side_tables failed: %s", exc)

        return result

    # --- helpers ---

    def _capture_runs(self, session: Any) -> List[Dict[str, Any]]:
        """Lista de {session_id, run_id, events: List[dict], mresps: List[dict]}.

        Não falha se runs vier vazio ou em formato inesperado.
        """
        runs = getattr(session, "runs", None) or []
        sid = getattr(session, "session_id", None)
        out: List[Dict[str, Any]] = []
        for run in runs:
            run_id = getattr(run, "run_id", None) if not isinstance(run, dict) else run.get("run_id")
            if not run_id or not sid:
                continue

            # events
            events_raw = getattr(run, "events", None) if not isinstance(run, dict) else run.get("events")
            events_dicts: List[Dict[str, Any]] = []
            for ev in (events_raw or []):
                ev_d = _to_dict_safe(ev)
                if ev_d is not None:
                    events_dicts.append(ev_d)

            # member_responses (mirror only; NÃO strippa)
            mresps_raw = getattr(run, "member_responses", None) if not isinstance(run, dict) else run.get("member_responses")
            mresps_dicts: List[Dict[str, Any]] = []
            for mr in (mresps_raw or []):
                mr_d = _to_dict_safe(mr)
                if mr_d is not None:
                    mresps_dicts.append(mr_d)

            if events_dicts or mresps_dicts:
                out.append({
                    "session_id": sid,
                    "run_id": run_id,
                    "events": events_dicts,
                    "mresps": mresps_dicts,
                })
        return out

    def _stash_events(self, session: Any) -> List[Any]:
        """Esvazia run.events nos RunOutput; retorna lista (run, original_events).

        Só mexe em objetos com atributo `events` mutável. Dicts ficam como estão
        (super lida com .to_dict que serializa)."""
        runs = getattr(session, "runs", None) or []
        stashed: List[Any] = []
        for run in runs:
            if isinstance(run, dict):
                if "events" in run and run["events"]:
                    stashed.append(("dict", run, run["events"]))
                    run["events"] = []
                continue
            evs = getattr(run, "events", None)
            if evs:
                stashed.append(("obj", run, evs))
                try:
                    run.events = []
                except Exception:
                    pass
        return stashed

    def _unstash_events(self, stashed: List[Any]) -> None:
        for kind, run, orig in stashed:
            try:
                if kind == "dict":
                    run["events"] = orig
                else:
                    run.events = orig
            except Exception:
                pass

    def _mirror(self, captured: List[Dict[str, Any]]) -> None:
        if not captured:
            return

        # Decide quais batches realmente precisam ir (dedup via cache)
        evt_batches: List[Dict[str, Any]] = []
        mr_batches: List[Dict[str, Any]] = []
        cache_updates: Dict[str, int] = {}
        mresp_updates: Dict[str, int] = {}

        with _mirror_cache_lock:
            for entry in captured:
                rid = entry["run_id"]
                sid = entry["session_id"]
                evts = entry.get("events") or []
                mrs = entry.get("mresps") or []

                # events: só insere idx > cached
                last_e = _mirror_cache.get(rid, -1)
                for idx, ev in enumerate(evts):
                    if idx <= last_e:
                        continue
                    evt_batches.append({
                        "sid": sid,
                        "rid": rid,
                        "idx": idx,
                        "etype": ev.get("event") if isinstance(ev, dict) else None,
                        "cat": ev.get("created_at") if isinstance(ev, dict) else None,
                        "data": json.dumps(ev, default=str, ensure_ascii=False),
                    })
                if evts:
                    cache_updates[rid] = len(evts) - 1

                last_m = _mresp_cache.get(rid, -1)
                for idx, mr in enumerate(mrs):
                    if idx <= last_m:
                        continue
                    mr_batches.append({
                        "sid": sid,
                        "rid": rid,
                        "idx": idx,
                        "aid": mr.get("agent_id") if isinstance(mr, dict) else None,
                        "aname": mr.get("agent_name") if isinstance(mr, dict) else None,
                        "prid": mr.get("parent_run_id") if isinstance(mr, dict) else None,
                        "cat": mr.get("created_at") if isinstance(mr, dict) else None,
                        "data": json.dumps(mr, default=str, ensure_ascii=False),
                    })
                if mrs:
                    mresp_updates[rid] = len(mrs) - 1

        if not evt_batches and not mr_batches:
            return

        # Insert fora do lock (Postgres é o gargalo, não o lock)
        with self.Session() as sess, sess.begin():
            if evt_batches:
                sess.execute(
                    text("""
                        INSERT INTO eas.run_events
                          (session_id, run_id, event_idx, event_type, created_at, data)
                        VALUES (:sid, :rid, :idx, :etype, :cat, CAST(:data AS jsonb))
                        ON CONFLICT (run_id, event_idx) DO NOTHING
                    """),
                    evt_batches,
                )
            if mr_batches:
                sess.execute(
                    text("""
                        INSERT INTO eas.run_member_responses
                          (session_id, run_id, response_idx, agent_id, agent_name, parent_run_id, created_at, data)
                        VALUES (:sid, :rid, :idx, :aid, :aname, :prid, :cat, CAST(:data AS jsonb))
                        ON CONFLICT (run_id, response_idx) DO NOTHING
                    """),
                    mr_batches,
                )

        # Atualiza cache só depois do commit
        with _mirror_cache_lock:
            for rid, idx in cache_updates.items():
                if idx > _mirror_cache.get(rid, -1):
                    _mirror_cache[rid] = idx
            for rid, idx in mresp_updates.items():
                if idx > _mresp_cache.get(rid, -1):
                    _mresp_cache[rid] = idx
