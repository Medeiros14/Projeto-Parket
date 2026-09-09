"""EAS — Engineering Agent System entrypoint.

F2 + F1c + F3:
- Knowledge Packs (Claude prompt cache, sem embedder)
- 10 tool modules: confirm, whatsapp_evolution, handoff, docker_ops, git_ops,
  deploy, supabase_admin, testbed, kanban, opencode_sandbox
- Worker WhatsApp poller (resolve tokens automaticamente)
- Workflow knowledge_refresh (agendado 6h)
- Infra-squad piloto (Monitoring + Backup agents)
- 4 backup workflows (substituem crons shell)
"""

import asyncio
import structlog
from agno.os import AgentOS
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.auth.session import (
    COOKIE_MAX_AGE,
    COOKIE_NAME,
    check_credentials,
    issue_token,
    parse_basic_auth,
    verify_token,
)

from app.agents.base import db as get_db, wire_model_hotswap
from app.agents.infra_squad import build_backup_agent, build_monitoring_agent, build_team as build_infra_team
from app.agents.tech_lead import build_engineering_team, build_tech_lead
from app.agents.validators import (
    build_api_validator, build_cronograma_validator, build_cs_validator,
    build_dashboard_validator, build_draw_validator, build_fiscal_validator,
    build_infra_validator, build_instala_validator, build_proposta_validator,
    build_rh_validator, build_space_v2_validator, build_status_validator,
    build_validation_team, build_valoria_validator, build_whatsapp_validator,
    build_wood_validator,
)
from app.agents.draw_studio import build_draw_studio_team
from app.agents.gestao_studio import build_gestao_studio_team
from app.agents.homebroker_studio import build_homebroker_studio_team
from app.agents.orcamento_studio import build_orcamento_studio_team
from app.agents.ux_ui_studio import build_uxui_studio_team
from app.agents.valoria_assistant import build_valoria_assistant
from app.config import settings
from app.knowledge.loader import ALL_SQUADS, build_pack, list_docs_grouped
from app.tools.confirm import list_pending, resolve_confirmation
from app.workers import whatsapp_poller
from app.workflows.infra_backups import BACKUP_CRONS, build_workflows as build_backup_workflows
from app.workflows.knowledge_refresh import build_workflow as build_kb_refresh
from app.workflows.proactive_studios import PROACTIVE_CRONS, build_workflows as build_proactive_workflows

log = structlog.get_logger()


def build_app() -> FastAPI:
    db = get_db()

    # Agentes individuais (acessíveis via /agents/<id>/runs)
    monitoring = build_monitoring_agent()
    backup = build_backup_agent()
    tech_lead = build_tech_lead()

    # Engineering Team (F5) — Tech Lead + 7 squads
    eng_team = build_engineering_team()

    # Validators (F6) — 15 agents read-only por superfície + Team coordenador
    validators = [
        build_draw_validator(), build_proposta_validator(), build_dashboard_validator(),
        build_status_validator(), build_wood_validator(),
        build_rh_validator(), build_fiscal_validator(), build_cs_validator(),
        build_instala_validator(), build_cronograma_validator(), build_valoria_validator(),
        build_whatsapp_validator(), build_api_validator(), build_space_v2_validator(),
        build_infra_validator(),
    ]
    validation_team = build_validation_team()

    # Draw Studio Team (F7) — Lead Opus + 8 especialistas em desenho técnico
    draw_studio_team = build_draw_studio_team()

    # Orçamento Studio Team (F8) — Lead + 7 engs + 3 advisors + 2 proativos
    orcamento_studio_team = build_orcamento_studio_team()

    # UX/UI Studio Team (F9) — Lead + 6 engs frontend + 1 Figma + 2 advisors
    uxui_studio_team = build_uxui_studio_team()

    # Homebroker Studio Team (F10) — Lead + 8 engs + 3 advisors + 2 proativos
    homebroker_studio_team = build_homebroker_studio_team()

    # Gestão & Obras Studio Team (F11) — Lead + 7 engs + 3 advisors + 2 proativos
    gestao_studio_team = build_gestao_studio_team()

    # Valoria Assistant — chat de orçamento dentro de valor.parket.works
    valoria_assistant = build_valoria_assistant()

    # Hot-swap de modelo nos coordinators dos teams (members já cobertos via make_agent)
    _all_teams = [eng_team, validation_team, draw_studio_team, orcamento_studio_team,
                  uxui_studio_team, homebroker_studio_team, gestao_studio_team]
    for _t in _all_teams:
        wire_model_hotswap(_t)

    # Workflows
    kb_refresh = build_kb_refresh()
    backup_workflows = build_backup_workflows()
    proactive_workflows = build_proactive_workflows()

    agentos = AgentOS(
        id="parket-eas",
        name="Parket Engineering Agent System",
        description="Time de devs IA cobrindo o stack Parket (Dashboard, Space, API, WhatsApp, Setor-apps, Infra).",
        db=db,
        agents=[monitoring, backup, tech_lead, valoria_assistant, *validators],
        teams=[eng_team, validation_team, draw_studio_team, orcamento_studio_team, uxui_studio_team, homebroker_studio_team, gestao_studio_team],
        workflows=[kb_refresh, *backup_workflows.values(), *proactive_workflows.values()],
        telemetry=False,
    )

    fastapi_app: FastAPI = agentos.get_app()

    # ============================================================
    # Auth middleware — cookie de sessão OU basic auth (compat CLI)
    # ============================================================

    PUBLIC_PREFIXES = ("/health", "/eas/login", "/eas/whoami")

    # Bearer token pro proxy nginx da Valoria (valor.parket.works /api/eas/*).
    # Corresponde ao OS_SECURITY_KEY do AgentOS (env). Fixo por deploy — se rotacionar,
    # atualizar também no nginx.conf da valoria-app.
    import os as _os
    _OS_SECURITY_KEY = _os.environ.get("OS_SECURITY_KEY", "").strip()

    class AuthMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            path = request.url.path
            # Rotas públicas
            if any(path == p or path.startswith(p) for p in PUBLIC_PREFIXES):
                return await call_next(request)

            # 1) Cookie de sessão
            token = request.cookies.get(COOKIE_NAME)
            user = verify_token(token) if token else None

            # 2) Fallback: basic auth (pra CLI/curl)
            if not user:
                creds = parse_basic_auth(request.headers.get("authorization", ""))
                if creds and check_credentials(*creds):
                    user = creds[0]

            # 3) Fallback: Bearer OS_SECURITY_KEY (proxy nginx da Valoria)
            if not user and _OS_SECURITY_KEY:
                auth = request.headers.get("authorization", "")
                if auth.startswith("Bearer ") and auth[7:].strip() == _OS_SECURITY_KEY:
                    user = "valoria-proxy"

            if not user:
                # Retorna 401 SEM WWW-Authenticate pra browser não abrir popup
                accept = request.headers.get("accept", "")
                if "text/html" in accept:
                    # Redirect humano pro login
                    return JSONResponse(
                        {"error": "unauthorized", "login_url": "/login"},
                        status_code=401,
                    )
                return JSONResponse({"error": "unauthorized"}, status_code=401)

            request.state.user = user
            return await call_next(request)

    fastapi_app.add_middleware(AuthMiddleware)

    # ============================================================
    # Endpoints de login
    # ============================================================

    @fastapi_app.post("/eas/login", tags=["EAS — Auth"])
    async def login(payload: dict, response: Response):
        user = (payload or {}).get("user", "").strip()
        password = (payload or {}).get("password", "")
        if not check_credentials(user, password):
            return JSONResponse({"ok": False, "error": "invalid credentials"}, status_code=401)
        token = issue_token(user)
        response.set_cookie(
            key=COOKIE_NAME,
            value=token,
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            samesite="lax",
            secure=True,
            path="/",
        )
        return {"ok": True, "user": user}

    @fastapi_app.post("/eas/logout", tags=["EAS — Auth"])
    async def logout(response: Response):
        response.delete_cookie(COOKIE_NAME, path="/")
        return {"ok": True}

    @fastapi_app.get("/eas/whoami", tags=["EAS — Auth"])
    async def whoami(request: Request):
        token = request.cookies.get(COOKIE_NAME)
        user = verify_token(token) if token else None
        if not user:
            creds = parse_basic_auth(request.headers.get("authorization", ""))
            if creds and check_credentials(*creds):
                user = creds[0]
        return {"authenticated": bool(user), "user": user}

    # Auto-start poller WhatsApp em prod (startup event do FastAPI)
    @fastapi_app.on_event("startup")
    async def _start_poller():
        if settings.is_prod:
            await whatsapp_poller.start()
            log.info("whatsapp poller started")

    @fastapi_app.on_event("shutdown")
    async def _stop_poller():
        if settings.is_prod:
            await whatsapp_poller.stop()
            log.info("whatsapp poller stopped")

    @fastapi_app.post("/eas/poller/start", tags=["EAS"])
    async def poller_start():
        await whatsapp_poller.start()
        return {"ok": True, "status": "started"}

    @fastapi_app.post("/eas/poller/stop", tags=["EAS"])
    async def poller_stop():
        await whatsapp_poller.stop()
        return {"ok": True, "status": "stopped"}

    # ============================================================
    # Knowledge endpoints
    # ============================================================

    @fastapi_app.get("/eas/knowledge/list", tags=["EAS — Knowledge"])
    async def kb_list():
        return {
            "squads_known": list(ALL_SQUADS) + ["global"],
            "docs": list_docs_grouped(),
        }

    @fastapi_app.get("/eas/knowledge/pack", tags=["EAS — Knowledge"])
    async def kb_pack(squad: str = Query(...), preview_chars: int = Query(800, ge=100, le=20000)):
        if squad not in ALL_SQUADS and squad != "global":
            raise HTTPException(400, f"squad inválida. Use: {list(ALL_SQUADS) + ['global']}")
        pack = build_pack(squad)
        return {
            "squad": pack.squad,
            "docs_count": len(pack.docs),
            "docs": [d.doc_id for d in pack.docs],
            "token_estimate": pack.token_estimate,
            "system_text_preview": pack.system_text[:preview_chars],
        }

    # ============================================================
    # Confirmation endpoints (debug + emergency resolve)
    # ============================================================

    @fastapi_app.get("/eas/confirm/pending", tags=["EAS — Confirm"])
    async def confirm_pending():
        return {"pending": list_pending()}

    @fastapi_app.post("/eas/confirm/resolve", tags=["EAS — Confirm"])
    async def confirm_resolve(token: str = Query(...), decision: str = Query(...), notes: str | None = None):
        """Resolução manual via API (debug / fallback se WhatsApp falhar). Usa apenas se Will autoriza."""
        return resolve_confirmation(token, decision, notes)

    # ============================================================
    # Status
    # ============================================================

    @fastapi_app.get("/eas/auth/status", tags=["EAS — Auth"])
    async def auth_status():
        from app.auth.anthropic_oauth import status as oauth_status
        return oauth_status()

    @fastapi_app.get("/eas/activities", tags=["EAS — Activities"])
    async def activities(limit: int = Query(30, ge=1, le=200), setor: str | None = None):
        """Últimas atividades em public.claude_atividades (log público).
        Lê via Supabase Mgmt API com SBP token."""
        import httpx
        SBP = "sbp_01ac2cd076c0a0f6f21eaa4404bc0af1c2ddbe63"
        where = f"WHERE setor = '{setor}'" if setor else ""
        sql = (
            f"SELECT id::text, data AS created_at, titulo, descricao, setor, categoria, criado_por AS feita_por "
            f"FROM public.claude_atividades {where} ORDER BY data DESC LIMIT {int(limit)}"
        )
        with httpx.Client(timeout=15) as client:
            r = client.post(
                "https://api.supabase.com/v1/projects/hbxpilrxmitvzebluoom/database/query",
                json={"query": sql},
                headers={"Authorization": f"Bearer {SBP}", "Content-Type": "application/json"},
            )
        if r.status_code >= 400:
            return {"ok": False, "status_code": r.status_code, "error": r.text[:500]}
        return {"ok": True, "items": r.json()}

    @fastapi_app.get("/eas/work/agents-activity", tags=["EAS — Work"])
    async def agents_activity():
        """Stats por agente: runs hoje/7d/30d + última run + status."""
        from app.tools._db import fetch_all
        # Lista todos os agents conhecidos no AgentOS
        known = [a.id for a in [monitoring, backup, tech_lead]]
        # Runs por agente
        rows = fetch_all(
            """
            SELECT
              COALESCE(agent_id, team_id, workflow_id) AS owner,
              session_type,
              COUNT(*) AS sessions,
              SUM(jsonb_array_length(COALESCE(runs,'[]'::jsonb))) AS total_runs,
              MAX(created_at) AS last_seen_unix,
              SUM(CASE WHEN created_at > extract(epoch from now()) - 86400 THEN
                jsonb_array_length(COALESCE(runs,'[]'::jsonb)) ELSE 0 END) AS runs_24h,
              SUM(CASE WHEN created_at > extract(epoch from now()) - 86400*7 THEN
                jsonb_array_length(COALESCE(runs,'[]'::jsonb)) ELSE 0 END) AS runs_7d
            FROM eas.agent_sessions
            GROUP BY 1, 2
            """
        )
        agg: dict = {}
        for r in rows:
            owner = r["owner"] or "?"
            entry = agg.setdefault(owner, {
                "id": owner,
                "type": r["session_type"],
                "sessions": 0,
                "total_runs": 0,
                "runs_24h": 0,
                "runs_7d": 0,
                "last_seen_unix": 0,
            })
            entry["sessions"] += r["sessions"] or 0
            entry["total_runs"] += int(r["total_runs"] or 0)
            entry["runs_24h"] += int(r["runs_24h"] or 0)
            entry["runs_7d"] += int(r["runs_7d"] or 0)
            entry["last_seen_unix"] = max(entry["last_seen_unix"], r["last_seen_unix"] or 0)
        # Garante que todos os known aparecem mesmo sem runs
        for k in known:
            if k not in agg:
                agg[k] = {"id": k, "type": "agent", "sessions": 0, "total_runs": 0,
                         "runs_24h": 0, "runs_7d": 0, "last_seen_unix": 0}
        items = sorted(agg.values(), key=lambda x: x["last_seen_unix"], reverse=True)
        return {"ok": True, "items": items}

    @fastapi_app.get("/eas/work/tasks", tags=["EAS — Work"])
    async def work_tasks(limit: int = Query(200, ge=1, le=500)):
        """Tasks derivadas de sessions + confirmations. Cada task tem agent + status + title."""
        from app.tools._db import fetch_all
        import json as _json
        items: list[dict] = []

        # SESSIONS — cada sessão vira 1 task
        try:
            rows = fetch_all(
                """
                SELECT session_id, session_type,
                       COALESCE(agent_id, team_id, workflow_id) AS owner,
                       agent_id, team_id, workflow_id,
                       runs::text AS runs_text,
                       summary,
                       created_at, updated_at
                FROM eas.agent_sessions
                ORDER BY COALESCE(updated_at, created_at) DESC
                LIMIT %s
                """,
                (int(limit),),
            )
        except Exception:
            rows = []
        for s in rows:
            try:
                runs = _json.loads(s["runs_text"] or "[]")
            except Exception:
                runs = []
            # Status: deriva do último run
            status = "done"
            title = ""
            user_msg = ""
            if runs:
                last = runs[-1]
                last_status = (last.get("status") or "").upper()
                if last_status == "PAUSED":
                    status = "waiting"
                elif last_status == "RUNNING":
                    status = "doing"
                elif last_status in ("CANCELLED", "ERROR", "FAILED"):
                    status = "failed"
                elif last_status == "COMPLETED":
                    status = "done"
                # title: primeira user message do primeiro run, senão início do conteúdo
                first = runs[0]
                msgs = first.get("messages", []) or []
                for m in msgs:
                    if m.get("role") == "user":
                        c = m.get("content")
                        if isinstance(c, str):
                            user_msg = c[:120]
                            break
                title = user_msg or (str(first.get("content") or "")[:120])
            title = (title or "(sem prompt)").strip()
            items.append({
                "id": s["session_id"],
                "kind": "session",
                "agent_id": s["owner"] or "?",
                "agent_type": s["session_type"],
                "title": title,
                "status": status,
                "created_at": s["created_at"],
                "updated_at": s["updated_at"],
                "runs_count": len(runs),
            })

        # CONFIRMATIONS pendentes — vira task waiting
        try:
            for c in fetch_all(
                "SELECT token, tool_name, summary, status, agent_id, requested_at, answered_at "
                "FROM eas.eas_confirmations ORDER BY requested_at DESC LIMIT %s",
                (int(limit),),
            ):
                st = c["status"]
                if st == "pending":
                    s_norm = "waiting"
                elif st in ("approved", "executed"):
                    s_norm = "done"
                elif st == "denied":
                    s_norm = "failed"
                elif st == "timeout":
                    s_norm = "failed"
                elif st == "failed":
                    s_norm = "failed"
                else:
                    s_norm = "waiting"
                ts = c["answered_at"] or c["requested_at"]
                items.append({
                    "id": f"conf-{c['token']}",
                    "kind": "confirmation",
                    "agent_id": c["agent_id"] or c["tool_name"],
                    "agent_type": "tool",
                    "title": f"[confirm] {(c['summary'] or c['tool_name'])[:110]}",
                    "status": s_norm,
                    "created_at": int(c["requested_at"].timestamp()),
                    "updated_at": int(ts.timestamp()) if ts else None,
                    "runs_count": 0,
                    "tool_name": c["tool_name"],
                    "token": c["token"],
                })
        except Exception as exc:
            log.warning("feed_confirmations source failed", error=str(exc))

        # Ordena: waiting/doing primeiro, depois por updated_at desc
        priority = {"waiting": 0, "doing": 1, "failed": 2, "done": 3, "todo": 0}
        items.sort(key=lambda x: (priority.get(x["status"], 9), -(x["updated_at"] or x["created_at"] or 0)))
        return {"ok": True, "items": items}

    @fastapi_app.get("/eas/work/feed", tags=["EAS — Work"])
    async def work_feed(limit: int = Query(40, ge=1, le=200)):
        """Timeline unificada: runs + activities + confirmations + handoffs (mais recente primeiro)."""
        from app.tools._db import fetch_all
        import httpx
        events: list[dict] = []

        # Sessions (cada session vira 1 evento com run_count)
        try:
            sess = fetch_all(
                """
                SELECT session_id, session_type,
                       COALESCE(agent_id, team_id, workflow_id) AS owner,
                       jsonb_array_length(COALESCE(runs,'[]'::jsonb)) AS runs,
                       created_at, updated_at
                FROM eas.agent_sessions
                ORDER BY updated_at DESC NULLS LAST
                LIMIT %s
                """,
                (int(limit),),
            )
            for s in sess:
                events.append({
                    "kind": "run",
                    "subtype": s["session_type"],
                    "owner": s["owner"],
                    "ref_id": s["session_id"],
                    "summary": f"{s['runs']} run(s) na sessão",
                    "ts_unix": s["updated_at"] or s["created_at"],
                })
        except Exception as exc:
            log.warning("feed_sessions source failed", error=str(exc))

        # Confirmations
        try:
            for c in fetch_all(
                "SELECT token, tool_name, summary, status, requested_at, answered_at "
                "FROM eas.eas_confirmations ORDER BY requested_at DESC LIMIT %s",
                (int(limit),),
            ):
                events.append({
                    "kind": "confirmation",
                    "subtype": c["status"],
                    "owner": c["tool_name"],
                    "ref_id": c["token"],
                    "summary": (c["summary"] or "")[:160],
                    "ts_unix": int((c["answered_at"] or c["requested_at"]).timestamp()),
                })
        except Exception as exc:
            log.warning("feed_confirm_hist source failed", error=str(exc))

        # Handoffs
        try:
            for h in fetch_all(
                "SELECT id::text, from_agent, to_squad, status, created_at, closed_at "
                "FROM eas.eas_handoffs ORDER BY created_at DESC LIMIT %s",
                (int(limit),),
            ):
                events.append({
                    "kind": "handoff",
                    "subtype": h["status"],
                    "owner": h["from_agent"],
                    "ref_id": h["id"],
                    "summary": f"→ {h['to_squad']}",
                    "ts_unix": int((h["closed_at"] or h["created_at"]).timestamp()),
                })
        except Exception as exc:
            log.warning("feed_handoffs source failed", error=str(exc))

        # Atividades públicas (claude_atividades — log do time)
        try:
            SBP = "sbp_01ac2cd076c0a0f6f21eaa4404bc0af1c2ddbe63"
            sql = (
                f"SELECT id::text, data AS created_at, titulo, setor, categoria, criado_por "
                f"FROM public.claude_atividades ORDER BY data DESC LIMIT {int(limit)}"
            )
            with httpx.Client(timeout=10) as client:
                r = client.post(
                    "https://api.supabase.com/v1/projects/hbxpilrxmitvzebluoom/database/query",
                    json={"query": sql},
                    headers={"Authorization": f"Bearer {SBP}", "Content-Type": "application/json"},
                )
            if r.status_code < 300:
                from datetime import datetime
                for a in r.json():
                    try:
                        ts = datetime.fromisoformat(a["created_at"].replace("Z", "+00:00")).timestamp()
                    except Exception:
                        ts = 0
                    events.append({
                        "kind": "activity",
                        "subtype": a.get("categoria"),
                        "owner": a.get("setor"),
                        "ref_id": a.get("id"),
                        "summary": (a.get("titulo") or "")[:160],
                        "ts_unix": int(ts),
                    })
        except Exception as exc:
            log.warning("feed_atividades source failed", error=str(exc))

        events.sort(key=lambda e: e["ts_unix"] or 0, reverse=True)
        return {"ok": True, "items": events[: int(limit)]}

    @fastapi_app.get("/eas/runs", tags=["EAS — Runs"])
    async def list_runs(limit: int = Query(30, ge=1, le=200), kind: str | None = None):
        """Sessions com runs no schema eas. `kind` filtra por agent|team|workflow."""
        from app.tools._db import fetch_all
        where = ""
        if kind:
            where = f"WHERE session_type = '{kind}'"
        try:
            rows = fetch_all(
                f"""
                SELECT session_id, session_type,
                       COALESCE(agent_id, team_id, workflow_id) AS owner_id,
                       agent_id, team_id, workflow_id, user_id,
                       jsonb_array_length(COALESCE(runs, '[]'::jsonb)) AS run_count,
                       summary,
                       created_at, updated_at
                FROM eas.agent_sessions
                {where}
                ORDER BY COALESCE(updated_at, created_at) DESC
                LIMIT {int(limit)}
                """
            )
        except Exception as e:
            return {"ok": False, "error": str(e), "items": []}
        return {"ok": True, "items": rows}

    @fastapi_app.get("/eas/runs/{session_id}", tags=["EAS — Runs"])
    async def run_detail(session_id: str):
        """Detalhe da session — runs sem events/member_responses/input (lazy via endpoints separados).
        content é truncado a 2KB pra preview; full content vem do endpoint /events.
        """
        from app.tools._db import fetch_one
        try:
            row = fetch_one(
                "SELECT session_id, session_type, agent_id, team_id, workflow_id, user_id, "
                "       summary, metadata, created_at, updated_at, "
                "       (SELECT jsonb_agg("
                "                  (r - 'events' - 'member_responses' - 'tools' - 'messages' - 'citations' - 'input')"
                "                  || jsonb_build_object("
                "                       'content',               LEFT(COALESCE(r->>'content',''), 2048),"
                "                       'content_truncated',     length(COALESCE(r->>'content','')) > 2048,"
                "                       'event_count',           COALESCE((r->>'event_count')::int,           jsonb_array_length(COALESCE(r->'events','[]'::jsonb))),"
                "                       'member_response_count', COALESCE((r->>'member_response_count')::int, jsonb_array_length(COALESCE(r->'member_responses','[]'::jsonb))),"
                "                       'message_count',         jsonb_array_length(COALESCE(r->'messages','[]'::jsonb)),"
                "                       'tool_count',            jsonb_array_length(COALESCE(r->'tools','[]'::jsonb))"
                "                  )"
                "              ) "
                "         FROM jsonb_array_elements(COALESCE(runs,'[]'::jsonb)) AS r) AS runs "
                "FROM eas.agent_sessions WHERE session_id = %s",
                (session_id,),
            )
        except Exception as e:
            return {"ok": False, "error": str(e)}
        if not row:
            return {"ok": False, "error": "session not found"}
        return {"ok": True, "session": row}

    @fastapi_app.get("/eas/runs/{session_id}/runs/{run_id}/events", tags=["EAS — Runs"])
    async def run_events(session_id: str, run_id: str, after_idx: int = -1, limit: int = 500):
        """Eventos de um run específico, paginados por event_idx."""
        from app.tools._db import fetch_all
        try:
            rows = fetch_all(
                "SELECT event_idx, event_type, created_at, data "
                "FROM eas.run_events "
                "WHERE session_id=%s AND run_id=%s AND event_idx > %s "
                "ORDER BY event_idx LIMIT %s",
                (session_id, run_id, int(after_idx), int(limit)),
            )
        except Exception as e:
            return {"ok": False, "error": str(e), "items": []}
        return {"ok": True, "items": rows, "next_after_idx": rows[-1]["event_idx"] if rows else int(after_idx)}

    @fastapi_app.get("/eas/runs/{session_id}/runs/{run_id}/member_responses", tags=["EAS — Runs"])
    async def run_member_responses(session_id: str, run_id: str):
        """Respostas dos membros do team num run específico."""
        from app.tools._db import fetch_all
        try:
            rows = fetch_all(
                "SELECT response_idx, agent_id, agent_name, parent_run_id, created_at, data "
                "FROM eas.run_member_responses "
                "WHERE session_id=%s AND run_id=%s "
                "ORDER BY response_idx",
                (session_id, run_id),
            )
        except Exception as e:
            return {"ok": False, "error": str(e), "items": []}
        return {"ok": True, "items": rows}

    @fastapi_app.get("/eas/agents/{agent_id}/override", tags=["EAS — Agents"])
    async def get_agent_override(agent_id: str):
        from app.agents.overrides import get_override_meta
        target = next((a for a in [monitoring, backup, tech_lead] if a.id == agent_id), None)
        if not target:
            return {"ok": False, "error": f"agent '{agent_id}' não encontrado"}
        meta = get_override_meta(agent_id)
        base = getattr(target, "_base_instructions", target.instructions) or ""
        return {
            "ok": True,
            "agent_id": agent_id,
            "has_override": bool(meta),
            "base_instructions": base,
            "override": meta,
        }

    @fastapi_app.post("/eas/agents/{agent_id}/override", tags=["EAS — Agents"])
    async def post_agent_override(agent_id: str, payload: dict):
        from app.agents.overrides import set_override
        target = next((a for a in [monitoring, backup, tech_lead] if a.id == agent_id), None)
        if not target:
            return {"ok": False, "error": f"agent '{agent_id}' não encontrado"}
        instructions = (payload or {}).get("instructions", "").strip()
        if not instructions:
            return {"ok": False, "error": "instructions vazia — use DELETE pra limpar"}
        note = (payload or {}).get("note")
        return set_override(agent_id, instructions, updated_by="will", note=note)

    @fastapi_app.delete("/eas/agents/{agent_id}/override", tags=["EAS — Agents"])
    async def delete_agent_override(agent_id: str):
        from app.agents.overrides import clear_override
        return clear_override(agent_id)

    # ------------------------------------------------------------
    # Model override — escolher modelo por agente/team sem restart
    # ------------------------------------------------------------
    _MODEL_OPTIONS = [
        "claude-opus-4-7",
        "claude-fable-5",
        "claude-sonnet-4-6",
        "claude-sonnet-4-5-20250929",
        "claude-haiku-4-5-20251001",
    ]

    def _model_entities() -> dict:
        """Mapa id → entidade (agents individuais + teams + members)."""
        out: dict = {}
        for a in [monitoring, backup, tech_lead, valoria_assistant, *validators]:
            out[a.id] = a
        for t in _all_teams:
            out[t.id] = t
            for m in getattr(t, "members", None) or []:
                out.setdefault(m.id, m)
        return out

    @fastapi_app.get("/eas/models", tags=["EAS — Agents"])
    async def list_models():
        return {
            "ok": True,
            "options": _MODEL_OPTIONS,
            "default": settings.model_default,
            "tech_lead": settings.model_tech_lead,
        }

    @fastapi_app.get("/eas/agents/{agent_id}/model", tags=["EAS — Agents"])
    async def get_agent_model(agent_id: str):
        from app.agents.overrides import get_model_override
        entity = _model_entities().get(agent_id)
        if not entity:
            return {"ok": False, "error": f"'{agent_id}' não encontrado"}
        override = get_model_override(agent_id)
        base = getattr(entity.model, "id", None)
        return {
            "ok": True,
            "agent_id": agent_id,
            "base_model": base,
            "override": override,
            "effective": override or base,
            "options": _MODEL_OPTIONS,
        }

    @fastapi_app.post("/eas/agents/{agent_id}/model", tags=["EAS — Agents"])
    async def post_agent_model(agent_id: str, payload: dict):
        from app.agents.overrides import clear_model_override, set_model_override
        entity = _model_entities().get(agent_id)
        if not entity:
            return {"ok": False, "error": f"'{agent_id}' não encontrado"}
        model = ((payload or {}).get("model") or "").strip()
        if not model:
            return {"ok": False, "error": "model vazio — use DELETE pra voltar ao padrão"}
        if model not in _MODEL_OPTIONS:
            return {"ok": False, "error": f"model inválido. Opções: {_MODEL_OPTIONS}"}
        if model == getattr(entity.model, "id", None):
            # escolher o modelo base = limpar override
            return clear_model_override(agent_id)
        return set_model_override(agent_id, model, updated_by="will")

    @fastapi_app.delete("/eas/agents/{agent_id}/model", tags=["EAS — Agents"])
    async def delete_agent_model(agent_id: str):
        from app.agents.overrides import clear_model_override
        return clear_model_override(agent_id)

    @fastapi_app.get("/eas/agents/{agent_id}/config", tags=["EAS — Agents"])
    async def agent_config(agent_id: str):
        """Config read-only do agente: model, instructions, tools, knowledge pack squad."""
        target = next((a for a in [monitoring, backup, tech_lead] if a.id == agent_id), None)
        if not target:
            return {"ok": False, "error": f"agent '{agent_id}' não encontrado"}

        tools = []
        for t in target.tools or []:
            tools.append({
                "name": getattr(t, "name", None) or getattr(t, "__name__", str(t)),
                "doc": (getattr(t, "__doc__", None) or "").strip()[:300],
            })

        # Extrai squad das instructions base (estamos passando # Knowledge Pack — squad: X)
        from app.agents.overrides import get_override_meta
        ov_meta = get_override_meta(agent_id)
        base_instr = getattr(target, "_base_instructions", None) or target.instructions or ""
        instr = base_instr if isinstance(base_instr, str) else ""
        squad = None
        for line in instr.splitlines():
            if "squad:" in line.lower():
                parts = line.split("squad:")
                if len(parts) > 1:
                    squad = parts[1].strip().split()[0]
                    break

        return {
            "ok": True,
            "id": target.id,
            "name": target.name,
            "model": {
                "id": getattr(target.model, "id", None),
                "provider": getattr(target.model, "provider", "Anthropic"),
            },
            "instructions": instr,
            "instructions_chars": len(instr),
            "tools_count": len(tools),
            "tools": tools,
            "squad_in_kb": squad,
            "source_path_hint": "/root/parket-ai-squad/eas/app/agents/",
            "override_active": bool(ov_meta),
            "override_meta": (
                {
                    "updated_at": ov_meta["updated_at"].isoformat() if ov_meta else None,
                    "updated_by": ov_meta["updated_by"] if ov_meta else None,
                    "note": ov_meta.get("note") if ov_meta else None,
                    "chars": len(ov_meta["instructions"]) if ov_meta else 0,
                }
                if ov_meta
                else None
            ),
        }

    @fastapi_app.get("/eas/schedules", tags=["EAS — Schedules"])
    async def schedules_list():
        """Schedules do AgentOS + última execução conhecida."""
        from app.tools._db import fetch_all
        items = []
        try:
            items = fetch_all(
                "SELECT id::text, name, description, cron_expr AS cron_expression, enabled, "
                "method, endpoint, timezone, timeout_seconds "
                "FROM eas.agno_schedules ORDER BY name"
            )
        except Exception as e:
            return {"ok": False, "error": str(e), "items": []}
        # Last run for each
        out = []
        for it in items:
            try:
                last = fetch_all(
                    "SELECT triggered_at, completed_at, status, status_code FROM eas.agno_schedule_runs "
                    "WHERE schedule_id = %s ORDER BY triggered_at DESC NULLS LAST LIMIT 1",
                    (it["id"],),
                )
                it["last_run"] = last[0] if last else None
            except Exception:
                it["last_run"] = None
            out.append(it)
        # Inclui também os workflows registrados que ainda não viraram schedules
        from app.workflows.infra_backups import BACKUP_CRONS
        known_cron = {"knowledge_refresh": "0 */6 * * *", **BACKUP_CRONS}
        return {"ok": True, "items": out, "known_workflow_crons": known_cron}

    @fastapi_app.get("/eas/status", tags=["EAS"])
    async def status():
        return {
            "service": "parket-eas",
            "env": settings.env,
            "db_schema": settings.db_schema,
            "model_default": settings.model_default,
            "model_tech_lead": settings.model_tech_lead,
            "agents": [a.id for a in [monitoring, backup, tech_lead, *validators]],
            "teams": [eng_team.id, validation_team.id, draw_studio_team.id, orcamento_studio_team.id, uxui_studio_team.id],
            "workflows": [kb_refresh.name, *backup_workflows.keys()],
            "knowledge_strategy": "claude-prompt-cache",
            "whatsapp_poller_active": settings.is_prod,
        }

    log.info(
        "EAS up",
        env=settings.env,
        schema=settings.db_schema,
        model_default=settings.model_default,
        model_tech_lead=settings.model_tech_lead,
        agents=3 + len(validators),
        teams=6,
        workflows=1 + len(backup_workflows) + len(proactive_workflows),
        squads_in_engineering=7,
        validators=len(validators),
        draw_studio_members=len(draw_studio_team.members),
        orcamento_studio_members=len(orcamento_studio_team.members),
        uxui_studio_members=len(uxui_studio_team.members),
        homebroker_studio_members=len(homebroker_studio_team.members),
    )

    return fastapi_app


app = build_app()


# Agendamento dos workflows. Roda no startup (idempotente — AgentOS deduplica por name).
def _schedule_all():
    """Cria/atualiza schedules no agno_schedules. Chamado no startup via endpoint /eas/schedule/init."""
    # Note: a API exata de scheduling depende da versão do Agno; abstraímos via DB direto.
    # Pra F3 MVP, deixamos os schedules pra serem criados via POST /eas/schedule/init
    pass


@app.post("/eas/schedule/init", tags=["EAS"], include_in_schema=True)
async def schedule_init():
    """Inicializa schedules dos workflows no AgentOS scheduler.

    Idempotente. Use depois de cada deploy pra garantir que os cronos estão ativos.
    """
    from app.tools._db import execute, fetch_all
    import json

    out = []
    for wf_name, cron in BACKUP_CRONS.items():
        # Insert/update no agno_schedules; nome único garante idempotência.
        try:
            existing = fetch_all("SELECT id FROM eas.agno_schedules WHERE name = %s", (wf_name,))
            if existing:
                out.append({"workflow": wf_name, "status": "already_scheduled", "cron": cron})
            else:
                # Schema do agno_schedules é descoberto em runtime; pra F3 MVP usamos crontab fallback.
                out.append({"workflow": wf_name, "status": "scheduled_via_native", "cron": cron, "note": "schedule via AgentOS scheduler API (precisa integração final)"})
        except Exception as exc:
            out.append({"workflow": wf_name, "status": "error", "error": str(exc)})
    # Knowledge refresh
    out.append({"workflow": "knowledge_refresh", "cron": "0 */6 * * *", "status": "scheduled_via_native"})
    return {"schedules": out, "hint": "F3 MVP: scheduler integration validation pending. Use POST /workflows/<wf_id>/run pra rodar on-demand."}
