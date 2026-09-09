"""
Parket Supabase MCP Server
===========================
Expõe TODAS as tabelas do Supabase Parket como ferramentas MCP.
URL interna: http://supabase-mcp:8001/sse

Tabelas disponíveis por setor:
  OBRAS:         obras, kanban_cards, obras_cronograma, obras_diarios, obras_equipes_campo
  COMERCIAL:     crm_funil, crm_pipeline, crm_closer_ranking, crm_agenda_showroom,
                 orcamento_propostas, orcamento_templates, marketing_campanhas, marketing_leads_canal
  PROJETOS:      projetos_aprovacoes, projetos_bom, projetos_lead_time, projetos_versoes
  COMPRAS:       compras_estoque, compras_fornecedores, compras_pos, compras_saving
  PRODUCAO:      producao_equipes, producao_nc, producao_capacidade, campo_ordens_producao
  LOGISTICA:     logistica_entregas, logistica_frota, logistica_otif
  ATENDIMENTO:   atendimento_grupos, atendimento_nps, atendimento_scripts, atendimento_tempo_resposta
  FINANCEIRO:    financeiro_dre, financeiro_fluxo_caixa, financeiro_margens, financeiro_recebiveis, financeiro_resumo
  FISCAL:        fiscal_vistorias, fiscal_relatorios, fiscal_checklist
  PMO:           pmo_m2_semanal, pmo_produtividade, pmo_ranking_equipes, pmo_retencoes
  RH:            rh_headcount, rh_vagas, rh_treinamentos, rh_contratos_vencendo
  CAMPO:         campo_checkins, campo_posts, campo_tarefas, campo_ranking
  CROSS-DEPT:    alertas, sla_rules, handoffs, handoffs_flow, dept_kpis_live,
                 kpi_snapshots, user_profiles, ai_squads, cron_job_configs
"""

import os, json
import httpx
from fastmcp import FastMCP

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_KEY"]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# All tables and their dept mapping
DEPT_TABLES = {
    "obras":        ["obras", "kanban_cards", "obras_cronograma", "obras_diarios", "obras_equipes_campo"],
    "comercial":    ["crm_funil", "crm_pipeline", "crm_conversion_monthly", "crm_closer_ranking",
                     "crm_agenda_showroom", "orcamento_propostas", "orcamento_composicao",
                     "orcamento_desvio", "orcamento_templates", "marketing_campanhas",
                     "marketing_conteudo", "marketing_leads_canal", "marketing_leads_mensal"],
    "projetos":     ["projetos_aprovacoes", "projetos_bom", "projetos_lead_time", "projetos_versoes"],
    "compras":      ["compras_estoque", "compras_fornecedores", "compras_pos", "compras_saving"],
    "producao":     ["producao_equipes", "producao_nc", "producao_capacidade", "campo_ordens_producao"],
    "logistica":    ["logistica_entregas", "logistica_frota", "logistica_otif"],
    "atendimento":  ["atendimento_grupos", "atendimento_nps", "atendimento_scripts", "atendimento_tempo_resposta"],
    "financeiro":   ["financeiro_dre", "financeiro_fluxo_caixa", "financeiro_margens",
                     "financeiro_recebiveis", "financeiro_resumo"],
    "fiscal":       ["fiscal_vistorias", "fiscal_relatorios", "fiscal_checklist"],
    "produtividade":["pmo_m2_semanal", "pmo_produtividade", "pmo_ranking_equipes", "pmo_retencoes", "kanban_cards"],
    "rh":           ["rh_headcount", "rh_vagas", "rh_treinamentos", "rh_contratos_vencendo"],
    "campo":        ["campo_checkins", "campo_posts", "campo_tarefas", "campo_ranking", "campo_notificacoes"],
}
CROSS_DEPT_TABLES = [
    "alertas", "sla_rules", "handoffs", "handoffs_flow", "dept_kpis_live",
    "kpi_snapshots", "user_profiles", "ai_squads", "cron_job_configs", "dept_activities",
]
DEPT_NAMES = {
    "obras": "Obras", "comercial": "Comercial", "projetos": "Projetos",
    "compras": "Compras", "producao": "Produção", "logistica": "Logística",
    "atendimento": "Atendimento", "financeiro": "Financeiro", "fiscal": "Fiscal",
    "produtividade": "PMO", "rh": "RH", "ti": "TI",
}

mcp = FastMCP(
    name="supabase-parket",
    instructions=(
        "Servidor MCP com acesso completo ao banco Parket via Supabase. "
        "71 tabelas cobrindo: Obras (173 projetos), Kanban (245 cards), Alertas (73), "
        "SLA Rules (43), Usuários (37), Comercial/CRM, Financeiro, Compras, Produção, "
        "Logística, Fiscal, PMO, RH, Campo Mobile e infraestrutura de IA."
    ),
)


async def _get(table: str, params: dict) -> list:
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, params=params)
        r.raise_for_status()
        return r.json()

async def _post(table: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, json=body)
        r.raise_for_status()
        rows = r.json(); return rows[0] if rows else {}

async def _patch(table: str, match: dict, fields: dict) -> bool:
    params = {k: f"eq.{v}" for k, v in match.items()}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.patch(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, params=params, json=fields)
        r.raise_for_status(); return True

async def _rpc(func: str, body: dict = {}) -> dict:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{SUPABASE_URL}/rest/v1/rpc/{func}", headers=HEADERS, json=body)
        r.raise_for_status(); return r.json()

def _fmt_card(card: dict) -> str:
    lines = [
        f"═══ {card.get('title','?')} ═══",
        f"ID: {card.get('id')} | Dept: {DEPT_NAMES.get(card.get('dept_id',''),card.get('dept_id','?'))} | Coluna: {card.get('column_id','?')}",
        f"Responsável: {card.get('responsavel','?')} | SLA: {card.get('sla','?')} [{card.get('sla_status','?')}]",
        f"Prioridade: {card.get('priority','?')} | Progresso: {card.get('progress','—')}% | Gate: {card.get('gate','—')}",
    ]
    if card.get("obra"):        lines.append(f"Obra ID: {card['obra']}")
    if card.get("subtitle"):    lines.append(f"Obs: {card['subtitle']}")
    if card.get("description"): lines.append(f"\nDescrição:\n{card['description']}")

    details = card.get("details") or {}
    if details:
        lines.append("\n── Detalhes ──")
        for k, v in details.items():
            if v: lines.append(f"  {k}: {v}")

    for g in (card.get("gates_data") or []):
        if not lines or "Gates" not in lines[-5:]:
            lines.append("\n── Gates ──")
        st = {"done":"✓","current":"▶","pending":"○","blocked":"✗"}.get(g.get("status",""),"?")
        lines.append(f"  {st} Gate {g.get('gate')} — {g.get('label','')} ({g.get('date','?')}) | {g.get('responsible','?')}")

    checklist = card.get("checklist_items") or []
    if checklist:
        done = sum(1 for c in checklist if c.get("done"))
        lines.append(f"\n── Checklist {done}/{len(checklist)} ──")
        for c in checklist:
            lines.append(f"  {'✓' if c.get('done') else '○'} {c.get('item','')}")

    fin = card.get("financeiro_data") or {}
    if fin:
        lines.append("\n── Financeiro ──")
        for k, v in fin.items():
            if v: lines.append(f"  {k}: {v}")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# FERRAMENTAS KANBAN / OBRAS
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def kanban_cards_por_dept(dept_id: str, coluna: str = "", sla_status: str = "") -> str:
    """Lista todos os cards Kanban de um departamento com detalhes completos.
    dept_id: obras | produtividade (únicos com dados no momento)
    coluna: mobilizacao | execucao | reparos | travado | ativo | pre-crono
    sla_status: ok | warning | expired"""
    params: dict = {"dept_id": f"eq.{dept_id}", "select": "*", "order": "created_at.asc"}
    if coluna:     params["column_id"]  = f"eq.{coluna}"
    if sla_status: params["sla_status"] = f"eq.{sla_status}"
    cards = await _get("kanban_cards", params)
    if not cards: return f"Nenhum card em {DEPT_NAMES.get(dept_id, dept_id)}."
    parts = [f"{DEPT_NAMES.get(dept_id, dept_id)} — {len(cards)} card(s):\n"]
    for card in cards:
        parts.append(_fmt_card(card)); parts.append("─"*50)
    return "\n".join(parts)


@mcp.tool()
async def kanban_buscar(termo: str, dept_id: str = "") -> str:
    """Busca cards Kanban por nome de projeto, obra, cliente ou responsável.
    termo: texto a buscar
    dept_id: (opcional) restringir a um departamento específico"""
    params: dict = {"select": "*"}
    if dept_id: params["dept_id"] = f"eq.{dept_id}"
    cards = await _get("kanban_cards", params)
    tl = termo.lower()
    found = [c for c in cards if
             tl in (c.get("title") or "").lower() or
             tl in (c.get("obra") or "").lower() or
             tl in (c.get("responsavel") or "").lower() or
             tl in (c.get("subtitle") or "").lower() or
             tl in (c.get("description") or "").lower() or
             tl in json.dumps(c.get("details") or {}).lower()]
    if not found: return f"Nenhum resultado para '{termo}'."
    parts = [f"{len(found)} card(s) encontrado(s) para '{termo}':\n"]
    for card in found[:10]: parts.append(_fmt_card(card)); parts.append("─"*50)
    return "\n".join(parts)


@mcp.tool()
async def kanban_card_detalhe(card_id: str) -> str:
    """Retorna detalhes completos de um card Kanban pelo ID UUID.
    Inclui gates, checklist, financeiro, RACI, handoffs e todos os campos."""
    rows = await _get("kanban_cards", {"id": f"eq.{card_id}", "select": "*", "limit": "1"})
    return _fmt_card(rows[0]) if rows else f"Card '{card_id}' não encontrado."


@mcp.tool()
async def kanban_cards_atrasados(dept_id: str = "") -> str:
    """Lista cards com SLA vencido (expired). Filtra por dept_id se informado."""
    params: dict = {"sla_status": "eq.expired", "select": "*", "order": "sla.asc"}
    if dept_id: params["dept_id"] = f"eq.{dept_id}"
    cards = await _get("kanban_cards", params)
    if not cards: return "Nenhum card atrasado."
    lines = [f"{len(cards)} card(s) atrasado(s):\n"]
    for c in cards:
        dept = DEPT_NAMES.get(c.get("dept_id",""), c.get("dept_id","?"))
        lines.append(f"• [{dept}] {c.get('title')} — {c.get('responsavel','?')} | SLA: {c.get('sla','?')} | Col: {c.get('column_id','?')}")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# OBRAS (Projetos de Instalação)
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def obras_listar(status: str = "", prioridade: str = "", regiao: str = "") -> str:
    """Lista obras/projetos de instalação. 173 obras no total.
    status: aguardando | em_andamento | concluida | travada
    prioridade: baixa | media | alta | critica
    regiao: SP, GO, etc."""
    params: dict = {"select": "id,cliente,localizacao,regiao,status,prioridade,gate,progresso,data_finalizacao,valor_num,obs", "order": "prioridade.desc,created_at.desc", "limit": "100"}
    if status:     params["status"]     = f"eq.{status}"
    if prioridade: params["prioridade"] = f"eq.{prioridade}"
    if regiao:     params["regiao"]     = f"eq.{regiao}"
    obras = await _get("obras", params)
    if not obras: return "Nenhuma obra encontrada."
    lines = [f"{len(obras)} obra(s) encontrada(s):\n"]
    for o in obras:
        lines.append(f"• {o.get('id')} | {o.get('cliente')} | {o.get('status')} | Gate {o.get('gate')} | {o.get('progresso')}% | {o.get('regiao')} | Entrega: {o.get('data_finalizacao','?')}")
        if o.get("obs"): lines.append(f"  Obs: {o['obs'][:100]}")
    return "\n".join(lines)


@mcp.tool()
async def obras_detalhe(obra_id: str) -> str:
    """Retorna todos os campos de uma obra específica pelo ID.
    Inclui equipes, fiscais, serviços e todos os metadados."""
    rows = await _get("obras", {"id": f"eq.{obra_id}", "select": "*", "limit": "1"})
    if not rows: return f"Obra '{obra_id}' não encontrada."
    o = rows[0]
    lines = [
        f"═══ OBRA: {o.get('cliente')} ({o.get('id')}) ═══",
        f"Local: {o.get('localizacao')} | Região: {o.get('regiao')}",
        f"Status: {o.get('status')} | Gate: {o.get('gate')} | Progresso: {o.get('progresso')}%",
        f"Prioridade: {o.get('prioridade')} | Entrega: {o.get('data_finalizacao')}",
        f"Valor: {o.get('valor_estimado')} ({o.get('valor_num')})",
        f"Serviços: {', '.join(o.get('servicos') or [])}",
        f"Fiscais: {', '.join(o.get('fiscais') or [])}",
    ]
    for eq in (o.get("equipes") or []):
        lines.append(f"  Equipe: {eq.get('nome')} | Tipo: {eq.get('tipo')} | Serviço: {eq.get('servico')}")
    if o.get("obs"): lines.append(f"\nObs: {o['obs']}")
    return "\n".join(lines)


@mcp.tool()
async def obras_cronograma(obra_code: str) -> str:
    """Retorna o cronograma de fases/etapas de uma obra."""
    rows = await _get("obras_cronograma", {"obra_code": f"eq.{obra_code}", "select": "*", "order": "inicio.asc"})
    if not rows: return f"Sem cronograma para '{obra_code}'."
    lines = [f"Cronograma — {obra_code}:\n"]
    for r in rows:
        status_icon = "✓" if r.get("status") == "concluido" else "▶" if r.get("status") == "em_andamento" else "○"
        lines.append(f"  {status_icon} {r.get('etapa')} | {r.get('inicio')} → {r.get('fim_previsto')} | {r.get('responsavel','?')}")
    return "\n".join(lines)


@mcp.tool()
async def obras_diarios_campo(obra_code: str) -> str:
    """Retorna os diários de campo (registros diários) de uma obra."""
    rows = await _get("obras_diarios", {"obra_code": f"eq.{obra_code}", "select": "*", "order": "data.desc", "limit": "30"})
    if not rows: return f"Sem diários para '{obra_code}'."
    lines = [f"Diários de campo — {obra_code} ({len(rows)} registros):\n"]
    for r in rows:
        lines.append(f"  {r.get('data')} | Equipe: {r.get('equipe')} | {r.get('m2','?')} m² | Preenchido: {'Sim' if r.get('preenchido') else 'Não'}")
        if r.get("obs"): lines.append(f"    Obs: {r['obs']}")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# COMERCIAL / CRM / ORÇAMENTO / MARKETING
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def comercial_pipeline() -> str:
    """Retorna funil de vendas, pipeline por estágio, ranking de closers e conversão mensal."""
    funil   = await _get("crm_funil",             {"select": "*", "order": "ordem.asc"})
    pipeline= await _get("crm_pipeline",           {"select": "*", "order": "ordem.asc"})
    ranking = await _get("crm_closer_ranking",     {"select": "*", "order": "taxa_pct.desc"})
    conv    = await _get("crm_conversion_monthly", {"select": "*", "order": "periodo.desc", "limit": "3"})
    lines = ["═══ PIPELINE COMERCIAL ═══\n"]
    lines.append("Funil:"); [lines.append(f"  {f.get('name')}: {f.get('value')} leads") for f in funil]
    lines.append("\nPipeline por Estágio:"); [lines.append(f"  {p.get('stage')}: {p.get('deals')} deals / R${p.get('value_k')}k") for p in pipeline]
    lines.append("\nRanking Closers:")
    for r in ranking:
        lines.append(f"  {r.get('nome')} ({r.get('papel')}): {r.get('fechados')}/{r.get('propostas')} fechados | R${r.get('valor_k')}k | {r.get('taxa_pct')}%")
    lines.append("\nConversão Mensal:"); [lines.append(f"  {c.get('mes')}: {c.get('taxa')}% ({c.get('leads')} leads)") for c in conv]
    return "\n".join(lines)


@mcp.tool()
async def comercial_agenda_showroom(status: str = "") -> str:
    """Retorna agenda do showroom (visitas agendadas, em andamento, concluídas).
    status: agendado | em_andamento | concluido | cancelado"""
    params: dict = {"select": "*", "order": "data.asc"}
    if status: params["status"] = f"eq.{status}"
    rows = await _get("crm_agenda_showroom", params)
    if not rows: return "Sem agendamentos."
    lines = [f"Agenda Showroom — {len(rows)} visita(s):\n"]
    for r in rows: lines.append(f"  {r.get('dia')} {r.get('hora')} | {r.get('cliente')} | Status: {r.get('status')} | Closer: {r.get('closer','?')}")
    return "\n".join(lines)


@mcp.tool()
async def orcamento_propostas(status: str = "") -> str:
    """Lista propostas de orçamento por status.
    status: em_elaboracao | enviada | aprovada | reprovada | em_revisao"""
    params: dict = {"select": "*", "order": "dias_pendente.desc"}
    if status: params["status"] = f"eq.{status}"
    rows = await _get("orcamento_propostas", params)
    if not rows: return "Nenhuma proposta encontrada."
    lines = [f"{len(rows)} proposta(s):\n"]
    for r in rows:
        lines.append(f"  {r.get('obra_id','?')} | {r.get('cliente')} | {r.get('tipo')} | R${r.get('valor','?')} | Status: {r.get('status')} | {r.get('dias_pendente','0')} dias pendente")
    return "\n".join(lines)


@mcp.tool()
async def marketing_campanhas_leads() -> str:
    """Retorna campanhas de marketing ativas, leads por canal e conteúdo programado."""
    campanhas = await _get("marketing_campanhas",   {"select": "*", "order": "leads.desc"})
    leads     = await _get("marketing_leads_canal", {"select": "*", "order": "leads.desc"})
    mensal    = await _get("marketing_leads_mensal", {"select": "*", "order": "periodo.desc", "limit": "3"})
    lines = ["═══ MARKETING ═══\n"]
    lines.append("Campanhas:"); [lines.append(f"  {c.get('nome')} [{c.get('canal')}] | {c.get('leads')} leads | CPL R${c.get('cpl','?')} | Status: {c.get('status')}") for c in campanhas]
    lines.append("\nLeads por Canal:"); [lines.append(f"  {l.get('canal')}: {l.get('leads')} leads | CPL R${l.get('cpl','?')} | Conv {l.get('conversao','?')}%") for l in leads]
    lines.append("\nLeads Mensais:"); [lines.append(f"  {m.get('mes')}: {m.get('leads')} leads") for m in mensal]
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# FINANCEIRO
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def financeiro_resumo_geral() -> str:
    """Retorna resumo financeiro consolidado: DRE, fluxo de caixa, margens e recebíveis."""
    resumo  = await _get("financeiro_resumo",     {"select": "*", "limit": "1"})
    fluxo   = await _get("financeiro_fluxo_caixa",{"select": "*", "order": "periodo_dt.desc", "limit": "6"})
    dre     = await _get("financeiro_dre",         {"select": "*", "order": "periodo_dt.desc,posicao.asc", "limit": "20"})
    lines = ["═══ FINANCEIRO RESUMO ═══\n"]
    if resumo:
        r = resumo[0]
        lines.append(f"Receita Bruta Mês: {r.get('receita_bruta_mes')}")
        lines.append(f"EBITDA Mês: {r.get('ebitda_mes')}")
        lines.append(f"Recebíveis Críticos: {r.get('recebiveis_criticos')} (R${r.get('valor_recebiveis_criticos','?')})")
        lines.append(f"Obras em Risco: {r.get('obras_em_risco')} | Obras Saudáveis: {r.get('obras_saudaveis')}")
        lines.append(f"Margem Média Real: {r.get('margem_media_real')}\n")
    lines.append("Fluxo de Caixa (6 meses):")
    for f in fluxo: lines.append(f"  {f.get('periodo')} | Entradas: {f.get('entradas')} | Saídas: {f.get('saidas')} | Saldo: {f.get('saldo')}")
    return "\n".join(lines)


@mcp.tool()
async def financeiro_margens_obras(status: str = "") -> str:
    """Retorna margens financeiras por obra (custo orçado vs realizado).
    status: em_andamento | concluida | em_risco"""
    params: dict = {"select": "*", "order": "margem_real.asc", "limit": "50"}
    if status: params["status"] = f"eq.{status}"
    rows = await _get("financeiro_margens", params)
    if not rows: return "Nenhuma margem encontrada."
    lines = [f"Margens por Obra — {len(rows)} registro(s):\n"]
    for r in rows:
        lines.append(f"  {r.get('obra_code')} | {r.get('cliente')} | Margem Orç: {r.get('margem_orc')}% | Margem Real: {r.get('margem_real')}% | Status: {r.get('status')}")
    return "\n".join(lines)


@mcp.tool()
async def financeiro_recebiveis(status: str = "") -> str:
    """Lista recebíveis e inadimplência por obra.
    status: pendente | pago | atrasado | negociando"""
    params: dict = {"select": "*", "order": "dias_atraso.desc", "limit": "50"}
    if status: params["status"] = f"eq.{status}"
    rows = await _get("financeiro_recebiveis", params)
    if not rows: return "Nenhum recebível encontrado."
    lines = [f"Recebíveis — {len(rows)} registro(s):\n"]
    for r in rows:
        atraso = f" | {r.get('dias_atraso')} dias atraso" if r.get("dias_atraso") else ""
        lines.append(f"  {r.get('obra_code')} | Parcela {r.get('parcela')}/{r.get('total_parcelas')} | R${r.get('valor_num')} | Venc: {r.get('vencimento')} | {r.get('status')}{atraso}")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# COMPRAS / ESTOQUE / FORNECEDORES
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def compras_status() -> str:
    """Retorna status de estoque, POs em aberto, fornecedores e saving mensal."""
    estoque     = await _get("compras_estoque",     {"select": "*", "order": "status.asc"})
    pos         = await _get("compras_pos",          {"select": "*", "order": "dias.desc", "limit": "20"})
    fornecedores= await _get("compras_fornecedores", {"select": "*", "order": "avaliacao.desc"})
    lines = ["═══ COMPRAS ═══\n"]
    criticos = [e for e in estoque if e.get("status") in ("critico","baixo")]
    lines.append(f"Estoque — {len(estoque)} itens | {len(criticos)} críticos/baixos:")
    for e in criticos: lines.append(f"  ⚠ {e.get('item')} | Qtd: {e.get('qtd')} / Mín: {e.get('minimo')} | {e.get('status')}")
    lines.append(f"\nPOs em Aberto — {len(pos)}:")
    for p in pos[:10]: lines.append(f"  {p.get('codigo')} | Obra: {p.get('obra_code')} | {p.get('fornecedor')} | R${p.get('valor')} | {p.get('dias')} dias | {p.get('status')}")
    lines.append(f"\nFornecedores — {len(fornecedores)}:")
    for f in fornecedores[:8]: lines.append(f"  {f.get('nome')} [{f.get('categoria')}] | Avaliação: {f.get('avaliacao')}/5 | {f.get('entregas')} entregas | {f.get('atrasos')} atrasos")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# PRODUÇÃO
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def producao_status() -> str:
    """Retorna status das equipes de produção, não-conformidades e capacidade."""
    equipes   = await _get("producao_equipes", {"select": "*", "order": "carga.desc"})
    ncs       = await _get("producao_nc",       {"select": "*", "where": "status.neq.fechado", "order": "data.desc", "limit": "20"})
    capacidade= await _get("producao_capacidade",{"select": "*", "order": "data.desc", "limit": "7"})
    ordens    = await _get("campo_ordens_producao",{"select": "*", "order": "prazo.asc", "limit": "20"})
    lines = ["═══ PRODUÇÃO ═══\n"]
    lines.append("Equipes/Bancadas:"); [lines.append(f"  {e.get('nome')} (Líder: {e.get('lider')}) | Bancada: {e.get('bancada')} | Carga: {e.get('carga')}% | {e.get('status')}") for e in equipes]
    nc_abertas = [n for n in ncs if n.get("status") != "fechado"]
    lines.append(f"\nNão-Conformidades Abertas — {len(nc_abertas)}:")
    for n in nc_abertas: lines.append(f"  {n.get('codigo')} | Obra: {n.get('obra_code')} | {n.get('descricao')} | {n.get('severidade')} | {n.get('responsavel')}")
    lines.append(f"\nOrdens de Produção — {len(ordens)}:")
    for o in ordens[:10]: lines.append(f"  {o.get('codigo')} | {o.get('obra_nome')} | {o.get('item')} | {o.get('status')} | Prazo: {o.get('prazo')}")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# LOGÍSTICA
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def logistica_status() -> str:
    """Retorna entregas em andamento, frota e OTIF mensal."""
    entregas = await _get("logistica_entregas", {"select": "*", "order": "eta.asc", "limit": "30"})
    frota    = await _get("logistica_frota",    {"select": "*"})
    otif     = await _get("logistica_otif",     {"select": "*", "order": "periodo.desc", "limit": "3"})
    lines = ["═══ LOGÍSTICA ═══\n"]
    lines.append(f"Entregas em andamento — {len(entregas)}:")
    for e in entregas: lines.append(f"  {e.get('obra_code')} | {e.get('destino')} | Motorista: {e.get('motorista')} | ETA: {e.get('eta')} | {e.get('status')} | {e.get('tipo')}")
    lines.append(f"\nFrota — {len(frota)} veículos:")
    for f in frota: lines.append(f"  {f.get('veiculo')} | {f.get('motorista')} | {f.get('status')} | {f.get('km')} km | Manutenção: {f.get('manutencao')}")
    lines.append("\nOTIF Mensal:"); [lines.append(f"  {o.get('mes')}: {o.get('otif')}%") for o in otif]
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# FISCAL / VISTORIAS
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def fiscal_agenda_vistorias(status: str = "") -> str:
    """Retorna agenda de vistorias fiscais e relatórios de inspeção.
    status: agendada | realizada | pendente | bloqueada"""
    params: dict = {"select": "*", "order": "data.asc"}
    if status: params["status"] = f"eq.{status}"
    vistorias  = await _get("fiscal_vistorias",  params)
    relatorios = await _get("fiscal_relatorios", {"select": "*", "order": "data.desc", "limit": "20"})
    lines = ["═══ FISCAL ═══\n"]
    lines.append(f"Vistorias — {len(vistorias)}:")
    for v in vistorias: lines.append(f"  {v.get('data_label')} {v.get('hora')} | Obra: {v.get('obra_code')} | Tipo: {v.get('tipo')} | {v.get('status')}")
    lines.append(f"\nRelatórios — {len(relatorios)}:")
    for r in relatorios: lines.append(f"  {r.get('obra_code')} | {r.get('tipo')} | {r.get('data')} | {r.get('itens_ok')}/{r.get('itens_total')} itens OK | {r.get('status')}")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# PMO / PRODUTIVIDADE
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def pmo_produtividade_equipes() -> str:
    """Retorna produtividade das equipes, ranking, m² semanal e retenções."""
    prod    = await _get("pmo_produtividade",     {"select": "*", "order": "data.desc", "limit": "20"})
    ranking = await _get("pmo_ranking_equipes",   {"select": "*", "order": "m2_total.desc"})
    m2      = await _get("pmo_m2_semanal",        {"select": "*", "order": "periodo.desc", "limit": "4"})
    retencoes=await _get("pmo_retencoes",         {"select": "*", "order": "vencimento.asc"})
    lines = ["═══ PMO / PRODUTIVIDADE ═══\n"]
    lines.append("Ranking de Equipes:")
    for r in ranking: lines.append(f"  {r.get('equipe')} (Líder: {r.get('lider')}) | {r.get('m2_total')} m² total | {r.get('m2_media')} m²/dia | {r.get('obras')} obras | Bônus: {r.get('bonus')}")
    lines.append("\nM² Semanal (últimas 4 semanas):")
    for m in m2: lines.append(f"  {m.get('semana')} | Piso: {m.get('piso')} m² | Forro: {m.get('forro')} m² | Deck: {m.get('deck')} m²")
    if retencoes:
        lines.append(f"\nRetenções ({len(retencoes)}):")
        for r in retencoes: lines.append(f"  Obra: {r.get('obra_code')} | R${r.get('valor')} | Venc: {r.get('vencimento')} | {r.get('status')}")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# RH
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def rh_status() -> str:
    """Retorna headcount, vagas abertas, treinamentos e contratos vencendo."""
    headcount  = await _get("rh_headcount",          {"select": "*", "order": "dept.asc"})
    vagas      = await _get("rh_vagas",              {"select": "*", "order": "urgencia.desc,dias_aberta.desc"})
    treinamentos=await _get("rh_treinamentos",       {"select": "*", "order": "vencimento.asc"})
    contratos  = await _get("rh_contratos_vencendo", {"select": "*", "order": "dias_restantes.asc"})
    lines = ["═══ RH ═══\n"]
    lines.append("Headcount:"); [lines.append(f"  {h.get('dept')}: {h.get('ativos')} ativos | {h.get('afastados')} afastados | {h.get('ferias')} férias") for h in headcount]
    lines.append(f"\nVagas Abertas — {len(vagas)}:")
    for v in vagas: lines.append(f"  {v.get('titulo')} [{v.get('dept')}] | {v.get('dias_aberta')} dias | {v.get('candidatos')} candidatos | Urgência: {v.get('urgencia')} | Etapa: {v.get('etapa')}")
    lines.append(f"\nContratos Vencendo — {len(contratos)}:")
    for c in contratos: lines.append(f"  {c.get('nome')} [{c.get('dept')}] | {c.get('cargo')} | Vence: {c.get('vencimento')} ({c.get('dias_restantes')} dias)")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# ATENDIMENTO
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def atendimento_status() -> str:
    """Retorna grupos WhatsApp de clientes, NPS, scripts e tempo de resposta."""
    grupos  = await _get("atendimento_grupos",        {"select": "*", "order": "saude.asc"})
    nps     = await _get("atendimento_nps",           {"select": "*", "order": "periodo.desc", "limit": "3"})
    tempos  = await _get("atendimento_tempo_resposta",{"select": "*", "order": "data.desc", "limit": "7"})
    lines = ["═══ ATENDIMENTO ═══\n"]
    lines.append(f"Grupos de Clientes — {len(grupos)}:")
    for g in grupos: lines.append(f"  Obra: {g.get('obra_code')} | {g.get('cliente')} | Tipo: {g.get('tipo')} | Membros: {g.get('membros')} | Saúde: {g.get('saude')}")
    lines.append("\nNPS Mensal:"); [lines.append(f"  {n.get('mes')}: {n.get('nps')}") for n in nps]
    lines.append("\nTempo de Resposta (últimos 7 dias):")
    for t in tempos: lines.append(f"  {t.get('dia')}: {t.get('tempo')} min")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════
# CROSS-DEPT: ALERTAS, SLA, HANDOFFS, KPIs
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def alertas_ativos(dept: str = "", severity: str = "") -> str:
    """Lista alertas ativos do sistema por departamento e/ou severidade.
    dept: obras | comercial | financeiro | compras | etc.
    severity: info | warning | critical"""
    params: dict = {"resolved": "eq.false", "select": "*", "order": "severity.desc,created_at.desc", "limit": "50"}
    if dept:     params["dept"]     = f"eq.{dept}"
    if severity: params["severity"] = f"eq.{severity}"
    rows = await _get("alertas", params)
    if not rows: return "Nenhum alerta ativo."
    lines = [f"{len(rows)} alerta(s) ativo(s):\n"]
    for r in rows:
        icon = "🔴" if r.get("severity") == "critical" else "🟡" if r.get("severity") == "warning" else "🔵"
        lines.append(f"{icon} [{r.get('dept','?')}] {r.get('message')} | Status: {r.get('status')} | Obra: {r.get('obra_nome','?')}")
    return "\n".join(lines)


@mcp.tool()
async def kpis_por_dept(dept_id: str = "") -> str:
    """Retorna KPIs em tempo real por departamento (ou todos).
    dept_id: obras | comercial | financeiro | etc. (vazio = todos)"""
    params: dict = {"select": "*"}
    if dept_id: params["dept_id"] = f"eq.{dept_id}"
    rows = await _get("dept_kpis_live", params)
    if not rows: return "Sem KPIs disponíveis."
    lines = ["KPIs por Departamento:\n"]
    for r in rows:
        lines.append(f"  {DEPT_NAMES.get(r.get('dept_id',''),r.get('dept_id','?'))}: "
                     f"{r.get('total_cards')} cards | {r.get('expired_cards')} atrasados | "
                     f"SLA OK: {r.get('sla_ok_pct')}% | Alta prio: {r.get('high_priority')} | "
                     f"Progresso médio: {r.get('avg_progress')}%")
    return "\n".join(lines)


@mcp.tool()
async def handoffs_pendentes(dept_to: str = "") -> str:
    """Lista handoffs pendentes entre departamentos.
    dept_to: departamento que deve receber o handoff (vazio = todos)"""
    params: dict = {"status": "eq.pending", "select": "*", "order": "created_at.asc"}
    if dept_to: params["dept_to"] = f"eq.{dept_to}"
    rows = await _get("handoffs", params)
    if not rows: return "Nenhum handoff pendente."
    lines = [f"{len(rows)} handoff(s) pendente(s):\n"]
    for r in rows:
        lines.append(f"  {r.get('dept_from')} → {r.get('dept_to')} | Obra: {r.get('obra_code','?')} | {r.get('item')} | SLA: {r.get('sla_hours')}h | {r.get('responsavel_from')} → {r.get('responsavel_to')}")
    return "\n".join(lines)


@mcp.tool()
async def campo_atividades(obra_id: str = "") -> str:
    """Retorna posts de campo (fotos/progresso), check-ins e tarefas de campo.
    obra_id: filtrar por obra específica"""
    params_posts: dict = {"select": "*", "order": "created_at.desc", "limit": "20"}
    params_checkins: dict = {"select": "*", "order": "hora_entrada.desc", "limit": "20"}
    if obra_id:
        params_posts["obra_id"]    = f"eq.{obra_id}"
        params_checkins["obra_id"] = f"eq.{obra_id}"
    posts    = await _get("campo_posts",    params_posts)
    checkins = await _get("campo_checkins", params_checkins)
    ranking  = await _get("campo_ranking",  {"select": "nome,pontos,badges", "order": "pontos.desc", "limit": "10"})
    lines = ["═══ CAMPO ═══\n"]
    lines.append(f"Posts de Campo — {len(posts)} registros:")
    for p in posts: lines.append(f"  {p.get('user_name')} | Obra: {p.get('obra_nome')} | {p.get('etapa')} | Nota: {p.get('nota_qualidade','?')} | {p.get('status')}")
    lines.append(f"\nCheck-ins — {len(checkins)}:")
    for c in checkins: lines.append(f"  {c.get('data')} | Obra: {c.get('obra_nome')} | Entrada: {c.get('hora_entrada')} | Saída: {c.get('hora_saida','?')} | GPS OK: {c.get('dentro_do_raio')}")
    lines.append("\nRanking Campo:")
    for r in ranking: lines.append(f"  {r.get('nome')}: {r.get('pontos')} pts | {', '.join(r.get('badges') or [])}")
    return "\n".join(lines)


@mcp.tool()
async def supabase_consultar_tabela(tabela: str, filtros: str = "", limite: int = 30) -> str:
    """Consulta qualquer tabela do Supabase com filtros opcionais.
    tabela: nome exato da tabela
    filtros: "coluna=valor,coluna2=valor2" (opcional)
    limite: max de registros (padrão 30)

    Tabelas disponíveis: obras, kanban_cards, alertas, sla_rules, handoffs,
    dept_kpis_live, kpi_snapshots, user_profiles, ai_squads, cron_job_configs,
    crm_funil, crm_pipeline, crm_closer_ranking, crm_agenda_showroom,
    orcamento_propostas, orcamento_templates, marketing_campanhas, marketing_leads_canal,
    projetos_aprovacoes, projetos_bom, projetos_versoes, compras_estoque, compras_pos,
    compras_fornecedores, producao_equipes, producao_nc, campo_ordens_producao,
    logistica_entregas, logistica_frota, atendimento_grupos, atendimento_scripts,
    financeiro_dre, financeiro_fluxo_caixa, financeiro_margens, financeiro_recebiveis,
    fiscal_vistorias, fiscal_relatorios, pmo_produtividade, pmo_ranking_equipes,
    rh_headcount, rh_vagas, rh_treinamentos, obras_cronograma, obras_diarios,
    campo_checkins, campo_posts, campo_tarefas, campo_ranking"""
    params: dict = {"select": "*", "limit": str(limite)}
    if filtros:
        for pair in filtros.split(","):
            if "=" in pair:
                col, val = pair.strip().split("=", 1)
                params[col.strip()] = f"eq.{val.strip()}"
    rows = await _get(tabela, params)
    if not rows: return f"Nenhum registro em '{tabela}'."
    return f"{len(rows)} registro(s) em '{tabela}':\n" + json.dumps(rows, indent=2, ensure_ascii=False, default=str)


@mcp.tool()
async def orcamento_tabela_precos(categoria: str = "", ativo: bool = True) -> str:
    """Consulta a tabela de preços de produtos para orçamento.
    categoria: piso | forro | painel | deck (vazio = todos)
    ativo: True (padrão) = apenas produtos ativos
    Retorna: espécies, dimensões, preços por m², observações."""
    params: dict = {"select": "*", "order": "categoria.asc,ordem.asc", "limit": "200"}
    if categoria: params["categoria"] = f"eq.{categoria}"
    if ativo:     params["ativo"]     = "eq.true"
    rows = await _get("orcamento_tabela_precos", params)
    if not rows: return "Nenhum produto na tabela de preços."
    lines = [f"Tabela de Preços Parket — {len(rows)} produto(s):\n"]
    current_cat = None
    for r in rows:
        cat = r.get("categoria", "?")
        if cat != current_cat:
            lines.append(f"\n=== {cat.upper()} ===")
            current_cat = cat
        especie = r.get("especie_nome") or r.get("especie_id", "")
        dim = r.get("dimensao_label", "")
        preco = r.get("preco", 0)
        obs = r.get("dimensao_obs", "")
        subtipo = r.get("subtipo", "")
        origem = r.get("origem", "")
        linha = f"  {especie}"
        if subtipo: linha += f" ({subtipo})"
        if origem:  linha += f" [{origem}]"
        if dim:     linha += f" | {dim}"
        linha += f" | R$ {preco:.2f}/m²"
        if obs:     linha += f" | {obs}"
        lines.append(linha)
    return "\n".join(lines)


@mcp.tool()
async def rpc_calcular_risk_score(obra_id: str) -> str:
    """Calcula o score de risco de uma obra usando a função do Supabase.
    obra_id: ID da obra para calcular o risco"""
    result = await _rpc("calc_obra_risk_score", {"p_obra_id": obra_id})
    return json.dumps(result, indent=2, ensure_ascii=False, default=str)


@mcp.tool()
async def kanban_criar_card(dept_id: str, coluna_id: str, titulo: str, responsavel: str,
                             sla: str, prioridade: str = "media", obra: str = "", descricao: str = "") -> str:
    """Cria novo card no Kanban. dept_id: obras | produtividade | comercial | etc."""
    body = {"dept_id": dept_id, "column_id": coluna_id, "title": titulo,
            "responsavel": responsavel, "sla": sla, "sla_status": "ok", "priority": prioridade}
    if obra:     body["obra"]        = obra
    if descricao: body["description"] = descricao
    result = await _post("kanban_cards", body)
    return f"Card criado: {result.get('title')} (ID: {result.get('id')})" if result.get("id") else "Falha ao criar card."


@mcp.tool()
async def kanban_atualizar_card(card_id: str, campos: str) -> str:
    """Atualiza campos de um card: 'coluna=valor,coluna2=valor2'.
    Campos comuns: column_id, sla, sla_status, responsavel, priority, progress"""
    fields: dict = {}
    for pair in campos.split(","):
        if "=" in pair:
            col, val = pair.strip().split("=", 1)
            col = col.strip(); val = val.strip()
            if col == "progress":
                try: val = int(val)
                except: pass
            fields[col] = val
    if not fields: return "Nenhum campo válido."
    await _patch("kanban_cards", {"id": card_id}, fields)
    return f"Card {card_id[:8]}... atualizado: {campos}"


if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount

    async def health(request: Request):
        return JSONResponse({"status": "ok", "service": "supabase-parket-mcp"})

    mcp_app = mcp.http_app(path="/sse")
    # lifespan obrigatório para o FastMCP StreamableHTTPSessionManager inicializar
    app = Starlette(
        routes=[
            Route("/health", health),
            Mount("/", app=mcp_app),
        ],
        lifespan=mcp_app.lifespan,
    )
    uvicorn.run(app, host="0.0.0.0", port=8001)
