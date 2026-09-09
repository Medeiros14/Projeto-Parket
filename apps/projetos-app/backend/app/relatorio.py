"""Relatorio de saude do setor de Projetos (BI + insights de IA).

Monta um snapshot com as metricas que importam pra gestao do time
(funil por fase, carga por projetista, atrasos reais x prazos sujos,
liberacao pra producao, cards parados, mix revestimento x marcenaria)
e, sob demanda, manda esse snapshot pro Claude gerar recomendacoes de
otimizacao que aparecem direto no painel. O resultado da IA fica em
cache (trello_projetos.relatorio_insights) pra nao pagar uma chamada
por abertura de pagina.
"""
import json
import logging
import os
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException

from .auth import require_gestora
from .db import conn

log = logging.getLogger("projetos.relatorio")
router = APIRouter()

# Agrupamento das listas do Trello em macro-etapas. Serve pra separar
# "atraso real" (fase de projeto, da nossa alcada) de "prazo sujo"
# (card ja em obra/finalizado com prazo antigo nunca limpo) e pra
# ignorar listas que sao template, nao fluxo (MODELOS, THAINARA).
FASES_IGNORADAS = {"MODELOS", "THAINARA"}
FASES_POS_PROJETO = {"PRODUÇÃO", "ENTREGA", "INSTALAÇÃO", "FINALIZADO", "REPARO"}

# Mesmo criterio das visoes do kanban (main.MARCENARIA_RAIZ): repetido
# aqui pra evitar import circular main <-> relatorio.
MARCENARIA_RAIZ = {"MARCENARIA", "PAINEL", "PORTA", "SAUNA", "ESCADA", "BRISE", "RIPADO"}


# ─── Snapshot das métricas ────────────────────────────────────────────

def _snapshot() -> dict:
    """Todas as metricas do relatorio numa passada so pelo PG local."""
    with conn() as c, c.cursor() as cur:
        # Funil: contagem, due vencido, dias parado e delegacao por fase.
        cur.execute("""
            SELECT l.nome AS fase, l.pos,
                   count(*) AS cards,
                   count(*) FILTER (WHERE c.due IS NOT NULL AND c.due < now()
                                      AND NOT c.due_complete) AS due_vencido,
                   round(avg(current_date - c.date_last_activity::date), 1) AS dias_parado_med,
                   max(current_date - c.date_last_activity::date) AS dias_parado_max,
                   count(*) FILTER (WHERE EXISTS (
                       SELECT 1 FROM trello_projetos.card_projetistas cp
                        WHERE cp.card_id = c.id)) AS com_resp
              FROM trello_projetos.cards c
              JOIN trello_projetos.listas l ON l.id = c.lista_id
             WHERE NOT c.closed
             GROUP BY l.nome, l.pos ORDER BY l.pos
        """)
        funil = [dict(r) for r in cur.fetchall()]
        for f in funil:
            f.pop("pos", None)
            f["dias_parado_med"] = float(f["dias_parado_med"] or 0)
            f["sem_resp"] = f["cards"] - f["com_resp"]

        # Carga por projetista: quantos cards, etapa interna e prazos.
        # Atraso REAL = prazo vencido em card que ainda esta em fase de
        # projeto; prazo vencido em card ja em obra e "sujo" (limpar).
        cur.execute("""
            SELECT coalesce(up.full_name, 'sem nome') AS projetista,
                   count(*) AS cards,
                   count(*) FILTER (WHERE cp.prazo IS NOT NULL AND cp.prazo < current_date
                                      AND upper(l.nome) <> ALL(%(pos)s)) AS atraso_real,
                   count(*) FILTER (WHERE cp.prazo IS NOT NULL AND cp.prazo < current_date
                                      AND upper(l.nome) = ANY(%(pos)s)) AS prazo_sujo,
                   count(*) FILTER (WHERE cp.etapa_projetista IN ('a_iniciar','em_andamento','revisao')) AS em_aberto,
                   count(*) FILTER (WHERE cp.etapa_projetista IN ('enviado','aprovado')) AS entregues
              FROM trello_projetos.card_projetistas cp
              JOIN trello_projetos.cards c ON c.id = cp.card_id AND NOT c.closed
              JOIN trello_projetos.listas l ON l.id = c.lista_id
              LEFT JOIN public.user_profiles up ON up.id = cp.projetista_id
             GROUP BY 1 ORDER BY cards DESC
        """, {"pos": list(FASES_POS_PROJETO)})
        time_stats = [dict(r) for r in cur.fetchall()]

        # Atrasos reais listados (pro alerta acionavel, com nome do card).
        cur.execute("""
            SELECT c.id AS card_id, c.nome, l.nome AS fase,
                   coalesce(up.full_name, 'sem nome') AS projetista,
                   cp.prazo::text, (current_date - cp.prazo) AS dias_atraso,
                   cp.etapa_projetista
              FROM trello_projetos.card_projetistas cp
              JOIN trello_projetos.cards c ON c.id = cp.card_id AND NOT c.closed
              JOIN trello_projetos.listas l ON l.id = c.lista_id
              LEFT JOIN public.user_profiles up ON up.id = cp.projetista_id
             WHERE cp.prazo < current_date AND upper(l.nome) <> ALL(%(pos)s)
             ORDER BY cp.prazo ASC LIMIT 20
        """, {"pos": list(FASES_POS_PROJETO)})
        atrasos_reais = [dict(r) for r in cur.fetchall()]

        # Prazos sujos: quantos ha pra limpar (nao lista um a um no topo,
        # so o total e os piores, senao o painel vira lixeira).
        cur.execute("""
            SELECT count(*) AS total
              FROM trello_projetos.card_projetistas cp
              JOIN trello_projetos.cards c ON c.id = cp.card_id AND NOT c.closed
              JOIN trello_projetos.listas l ON l.id = c.lista_id
             WHERE cp.prazo < current_date AND upper(l.nome) = ANY(%(pos)s)
        """, {"pos": list(FASES_POS_PROJETO)})
        prazos_sujos = cur.fetchone()["total"]

        # Cards mais parados em fases ativas de projeto (outliers).
        cur.execute("""
            SELECT c.id AS card_id, c.nome, l.nome AS fase,
                   (current_date - c.date_last_activity::date) AS dias_parado
              FROM trello_projetos.cards c
              JOIN trello_projetos.listas l ON l.id = c.lista_id
             WHERE NOT c.closed
               AND upper(l.nome) <> ALL(%(pos)s)
               AND upper(l.nome) <> ALL(%(ign)s)
               AND c.date_last_activity < now() - interval '30 days'
             ORDER BY c.date_last_activity ASC LIMIT 15
        """, {"pos": list(FASES_POS_PROJETO), "ign": list(FASES_IGNORADAS)})
        parados = [dict(r) for r in cur.fetchall()]

        # Grupos de produto (mesma logica do seletor de visoes do kanban)
        # + liberacao pra producao, casados por space_card_id E irmaos.
        cur.execute("""
            SELECT p.card_id::text AS sid,
                   bool_or(upper(coalesce(i.categoria,'')) = ANY(%(marc)s)) AS tem_marc,
                   count(*) FILTER (WHERE NOT ((i.meta->>'liberado_projetos')::boolean IS TRUE)) AS nao_liberados
              FROM gestao.itens i
              JOIN gestao.projetos p ON p.id = i.projeto_id
             WHERE p.card_id IS NOT NULL
             GROUP BY 1
        """, {"marc": list(MARCENARIA_RAIZ)})
        por_sid = {r["sid"]: r for r in cur.fetchall()}

        cur.execute("""
            SELECT c.id, c.nome, l.nome AS fase, c.space_card_id::text AS sid,
                   coalesce(c.space_card_ids_obra, '[]'::jsonb) AS irmaos
              FROM trello_projetos.cards c
              JOIN trello_projetos.listas l ON l.id = c.lista_id
             WHERE NOT c.closed
        """)
        cards_all = cur.fetchall()

    mix = {}          # fase -> {marcenaria, revestimento, sem_itens}
    liberacao = []    # cards com item nao liberado
    for row in cards_all:
        fase = row["fase"]
        # Junta o proprio space_card_id com os irmaos de obra: o vinculo
        # com o gestao pode estar em qualquer card da mesma obra.
        sids = [s for s in [row["sid"]] + list(row["irmaos"] or []) if s]
        tem_marc = tem_itens = False
        nao_lib = 0
        for s in sids:
            g = por_sid.get(s)
            if g:
                tem_itens = True
                tem_marc = tem_marc or g["tem_marc"]
                nao_lib += g["nao_liberados"]
        m = mix.setdefault(fase, {"marcenaria": 0, "revestimento": 0, "sem_itens": 0})
        if not tem_itens:
            m["sem_itens"] += 1
        elif tem_marc:
            m["marcenaria"] += 1
        else:
            m["revestimento"] += 1
        if nao_lib > 0 and fase.upper() not in FASES_IGNORADAS:
            liberacao.append({"card_id": row["id"], "nome": row["nome"],
                              "fase": fase, "itens_nao_liberados": nao_lib})
    liberacao.sort(key=lambda x: -x["itens_nao_liberados"])

    # KPIs de topo derivados do que ja foi computado.
    fases_uteis = [f for f in funil if f["fase"].upper() not in FASES_IGNORADAS]
    abertos = sum(f["cards"] for f in fases_uteis)
    sem_resp = sum(f["sem_resp"] for f in fases_uteis)
    due_vencido = sum(f["due_vencido"] for f in fases_uteis)
    fila_entrada = next((f["cards"] for f in funil if f["fase"].upper() == "CONTRATOS NOVOS"), 0)

    return {
        "kpis": {
            "cards_abertos": abertos,
            "sem_responsavel": sem_resp,
            "fila_entrada": fila_entrada,
            "atrasos_reais": len(atrasos_reais),
            "prazos_sujos": prazos_sujos,
            "due_vencido": due_vencido,
            "cards_liberacao_pendente": len(liberacao),
            "parados_30d": len(parados),
        },
        "funil": funil,
        "time": time_stats,
        "atrasos_reais": atrasos_reais,
        "parados": parados,
        "liberacao": liberacao[:20],
        "mix": mix,
    }


@router.get("/api/relatorio")
def relatorio(user: dict = Depends(require_gestora)):
    """Snapshot completo do BI. So gestora: o painel expoe desempenho
    individual do time, projetista nao precisa ver o dos colegas."""
    return _snapshot()


# ─── Insights da IA ───────────────────────────────────────────────────
# Mesmo padrao OAuth Claude Code do copiloto do gestao: token vem do
# ai_accounts do parket-ai-squad (refresh automatico), fallback secret.

_ANTHROPIC_OAUTH_BETAS = "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14"
_ANTHROPIC_CC_BILLING = "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"

_PROMPT_SISTEMA = """Voce e um consultor de operacoes analisando o setor de Projetos de uma empresa de pisos e marcenaria de alto padrao (Parket). O setor recebe contratos fechados, produz projeto executivo, aprova com o cliente e libera pra producao/instalacao.

Voce recebe um snapshot JSON com: kpis, funil por fase do kanban, carga por projetista, atrasos reais (fases de projeto), prazos sujos (cards ja em obra com prazo antigo nunca limpo), cards parados 30+ dias, cards com itens nao liberados pra producao e mix revestimento x marcenaria.

Gere de 3 a 6 recomendacoes ACIONAVEIS de gestao, priorizadas por impacto. Regras:
- Responda APENAS JSON valido: {"insights": [{"titulo": str, "detalhe": str, "prioridade": "alta"|"media"|"baixa"}]}
- Titulo curto e direto (max 60 chars). Detalhe de 2 a 4 frases citando os numeros do snapshot e dizendo O QUE fazer.
- Portugues do Brasil, sem emoji, sem travessao (use virgula ou dois-pontos).
- Foque no que a gestora consegue agir esta semana: delegar, limpar, destravar, cobrar."""


def _anthropic_token() -> str:
    from .claude_token import get_oauth_token
    tok = get_oauth_token() or os.environ.get("ANTHROPIC_OAUTH_TOKEN") or os.environ.get("ANTHROPIC_API_KEY")
    if not tok:
        raise HTTPException(503, "Token da IA nao configurado no servidor")
    return tok


def _ask_claude(system_prompt: str, user_prompt: str, max_tokens: int = 2048) -> str:
    """Chama a Messages API da Anthropic via httpx (sem SDK). Token OAuth
    Claude Code (sk-ant-oat...) usa Bearer + betas; API key usa x-api-key."""
    tok = _anthropic_token()
    is_oauth = tok.startswith("sk-ant-oat")
    model = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")
    headers = {"anthropic-version": "2023-06-01", "content-type": "application/json"}
    if is_oauth:
        headers["authorization"] = f"Bearer {tok}"
        headers["anthropic-beta"] = _ANTHROPIC_OAUTH_BETAS
        headers["x-app"] = "cli"
        headers["user-agent"] = "claude-cli/2.1.81 (external, cli)"
        headers["anthropic-dangerous-direct-browser-access"] = "true"
        system = [
            {"type": "text", "text": _ANTHROPIC_CC_BILLING},
            {"type": "text", "text": system_prompt},
        ]
    else:
        headers["x-api-key"] = tok
        system = system_prompt
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    try:
        with httpx.Client(timeout=90.0) as h:
            r = h.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
        if r.status_code >= 400:
            log.warning("anthropic_fail status=%s body=%s", r.status_code, r.text[:400])
            raise HTTPException(502, f"IA: HTTP {r.status_code}")
        for block in r.json().get("content", []):
            if block.get("type") == "text":
                return block.get("text") or ""
        return ""
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"falha ao chamar a IA: {e}")


def _extrair_json(texto: str) -> dict:
    """A IA pode devolver o JSON embrulhado em cerca de codigo markdown."""
    t = (texto or "").strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```\s*$", "", t)
    return json.loads(t)


@router.get("/api/relatorio/insights")
def insights(force: int = 0, user: dict = Depends(require_gestora)):
    """Insights da IA sobre o snapshot. Serve do cache (< 24h) a menos
    que force=1 (botao Atualizar analise do painel)."""
    with conn() as c, c.cursor() as cur:
        if not force:
            cur.execute("""
                SELECT gerado_em, modelo, insights
                  FROM trello_projetos.relatorio_insights
                 WHERE gerado_em > now() - interval '24 hours'
                 ORDER BY gerado_em DESC LIMIT 1
            """)
            row = cur.fetchone()
            if row:
                return {"gerado_em": row["gerado_em"].isoformat(),
                        "modelo": row["modelo"], "cache": True,
                        "insights": row["insights"]}

    snap = _snapshot()
    texto = _ask_claude(_PROMPT_SISTEMA, json.dumps(snap, ensure_ascii=False, default=str))
    try:
        lista = _extrair_json(texto).get("insights") or []
    except Exception:
        log.warning("insights_json_invalido: %s", texto[:300])
        raise HTTPException(502, "IA devolveu resposta invalida, tente de novo")

    modelo = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO trello_projetos.relatorio_insights (modelo, snapshot, insights)
            VALUES (%s, %s, %s) RETURNING gerado_em
        """, (modelo, json.dumps(snap, default=str), json.dumps(lista, ensure_ascii=False)))
        gerado_em = cur.fetchone()["gerado_em"]
    return {"gerado_em": gerado_em.isoformat(), "modelo": modelo,
            "cache": False, "insights": lista}
