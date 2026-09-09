"""
Tracking de Propostas de Orçamento.
- Gera link público com token
- Serve página da proposta com tracking embutido
- Registra: abertura, tempo na página, saída
- Notifica grupo Orçamentos no WhatsApp
- Salva no card kanban
"""
import uuid
import time
import httpx
import structlog
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["orcamento-tracking"])

SUPABASE_URL = "https://hbxpilrxmitvzebluoom.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk0MjUyNywiZXhwIjoyMDg4NTE4NTI3fQ.fTovVTCBFcMrrhVCR6TsneALfMRLLLHZdMmSJH16L4A"

EVO_URL = "https://conect.parket.works"
EVO_INSTANCE = "Parket"
EVO_KEY = "4eab105201410d6865b86dca76ee9fa3"
GRUPO_ORCAMENTO_JID = "120363425314205066@g.us"

SB_HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}
BASE_URL = "https://proposta.parket.works"


async def sb_query(table, params):
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/{table}", params=params, headers=SB_HEADERS)
        return r.json() if r.is_success else []

async def sb_insert(table, data):
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{SUPABASE_URL}/rest/v1/{table}", json=data,
                         headers={**SB_HEADERS, "Prefer": "return=representation"})
        return r.json() if r.is_success else []

async def sb_update(table, match, data):
    async with httpx.AsyncClient(timeout=10) as c:
        await c.patch(f"{SUPABASE_URL}/rest/v1/{table}", params=match, json=data, headers={**SB_HEADERS, "Prefer": "return=minimal"})

async def notificar_grupo(text):
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            await c.post(f"{EVO_URL}/message/sendText/{EVO_INSTANCE}",
                         json={"number": GRUPO_ORCAMENTO_JID, "text": text},
                         headers={"Content-Type": "application/json", "apikey": EVO_KEY})
    except Exception as e:
        logger.error("notificar_grupo_erro", error=str(e))


# ── Helpers: parse UA, geo IP, etc. ─────────────────────────────────

def _parse_user_agent(ua: str) -> dict:
    """Parser leve. Retorna {device_type, os, browser}."""
    ua = ua or ""
    low = ua.lower()
    if "mobile" in low or "android" in low or "iphone" in low:
        device = "mobile"
    elif "tablet" in low or "ipad" in low:
        device = "tablet"
    else:
        device = "desktop"
    if "windows nt 10" in low: os_ = "Windows 10/11"
    elif "windows" in low: os_ = "Windows"
    elif "iphone" in low or ("ios" in low and "mobile" in low): os_ = "iOS"
    elif "ipad" in low: os_ = "iPadOS"
    elif "mac os" in low or "macintosh" in low: os_ = "macOS"
    elif "android" in low:
        import re as _re
        m = _re.search(r"android\s+(\d+(?:\.\d+)?)", low)
        os_ = f"Android {m.group(1)}" if m else "Android"
    elif "linux" in low: os_ = "Linux"
    else: os_ = "Desconhecido"
    if "edg/" in low: browser = "Edge"
    elif "opr/" in low or "opera" in low: browser = "Opera"
    elif "chrome/" in low and "safari" in low: browser = "Chrome"
    elif "firefox" in low: browser = "Firefox"
    elif "safari" in low: browser = "Safari"
    elif "whatsapp" in low: browser = "WhatsApp WebView"
    else: browser = "Desconhecido"
    return {"device_type": device, "os": os_, "browser": browser}


async def _geo_lookup(ip: str) -> dict:
    """Geolocalização via ipapi.co — sem chave (1k req/dia). Falha silenciosa.
    Retorna também o timezone IANA (ex: 'America/Sao_Paulo')."""
    if not ip or ip.startswith(("10.", "192.168.", "172.", "127.")) or ip in ("::1", ""):
        return {}
    try:
        async with httpx.AsyncClient(timeout=4) as c:
            r = await c.get(f"https://ipapi.co/{ip}/json/")
            if r.status_code == 200:
                d = r.json()
                return {
                    "geo_city": d.get("city") or "",
                    "geo_region": d.get("region") or "",
                    "geo_country": d.get("country_name") or "",
                    "timezone": d.get("timezone") or "",
                }
    except Exception:
        pass
    return {}


def _is_produto_categoria(cat: str) -> bool:
    """Retorna True se a categoria do item é produto (sujeita a desconto).
    Insumos, instalação, logística e mão de obra ficam de fora — alinhado
    com a lógica do simulador no dashboard (orcamento-simulador-tab)."""
    if not cat:
        return True
    import re as _re
    return not _re.search(r"INSUMOS?|INSTAL|LOG[IÍ]STICA|MAO|MÃO|TRANSPORTE", cat, _re.I)


def compute_proposta_total(itens: list, desconto_global_perc: float) -> dict:
    """Calcula o total da proposta aplicando os mesmos descontos que o
    simulador do dashboard:
      - desconto_global incide só sobre items de PRODUTO
      - cada item produto pode ter `desconto_perc` próprio (per-line)
      - insumos/instalação/logística/MO entram no total sem desconto

    Retorna dict {bruto, total_final, desconto_global_valor, desconto_item_valor}.
    """
    bruto = 0.0
    desconto_item_valor = 0.0
    produto_bruto = 0.0
    g = max(0.0, float(desconto_global_perc or 0))
    for it in itens or []:
        v = float(it.get("valor") or 0)
        bruto += v
        if not _is_produto_categoria(str(it.get("categoria") or "")):
            continue
        produto_bruto += v
        d = float(it.get("desconto_perc") or 0)
        desconto_item_valor += v * (d / 100.0)
    desconto_global_valor = produto_bruto * (g / 100.0)
    total_final = bruto - desconto_global_valor - desconto_item_valor
    return {
        "bruto": bruto,
        "produto_bruto": produto_bruto,
        "total_final": max(0.0, total_final),
        "desconto_global_valor": desconto_global_valor,
        "desconto_item_valor": desconto_item_valor,
    }


def _fmt_local_time(utc_dt, tz_iana: str) -> str:
    """Formata datetime UTC no timezone local do visitante (IANA).
    Fallback pra America/Sao_Paulo se tz não vier (ou for inválido)."""
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_iana or "America/Sao_Paulo")
    except Exception:
        try:
            from zoneinfo import ZoneInfo
            tz = ZoneInfo("America/Sao_Paulo")
        except Exception:
            return utc_dt.strftime("%d/%m %H:%M (UTC)")
    local = utc_dt.astimezone(tz)
    # Nome curto da cidade do tz pra deixar claro qual é
    label = (tz_iana or "America/Sao_Paulo").split("/")[-1].replace("_", " ")
    return f"{local.strftime('%d/%m %H:%M')} (horário {label})"


def _client_ip(request: Request) -> str:
    """IP real considerando proxies (Cloudflare/Traefik)."""
    h = request.headers
    for k in ("cf-connecting-ip", "x-real-ip", "x-forwarded-for"):
        v = h.get(k)
        if v:
            return v.split(",")[0].strip()
    return request.client.host if request.client else ""


# ── Endpoint: gerar link personalizado por destinatário ──────────────

@router.post("/orcamento/gerar-link-personalizado")
async def gerar_link_personalizado(request: Request):
    """Cria/reusa um destinatário e devolve o link com token embutido.
    Body: { simulacao_id, name, role ('cliente'|'arquiteto'|'outro'), created_by }"""
    body = await request.json()
    simulacao_id = body.get("simulacao_id")
    name = (body.get("name") or "").strip()
    role = (body.get("role") or "outro").strip().lower()
    created_by = (body.get("created_by") or "").strip()
    if not simulacao_id or not name:
        return {"error": "simulacao_id e name obrigatórios"}

    existing = await sb_query("orcamento_recipients", {
        "simulacao_id": f"eq.{simulacao_id}",
        "role": f"eq.{role}",
        "name": f"eq.{name}",
        "select": "token", "limit": "1",
    })
    if existing:
        token_dest = existing[0]["token"]
    else:
        role_short = (role or "x")[:3]
        token_dest = f"tok_{role_short}_{uuid.uuid4().hex[:8]}"
        await sb_insert("orcamento_recipients", {
            "token": token_dest,
            "simulacao_id": simulacao_id,
            "name": name,
            "role": role,
            "created_by": created_by,
        })

    # Garante orcamento_tracking pra compat
    existing_tr = await sb_query("orcamento_tracking", {
        "simulacao_id": f"eq.{simulacao_id}", "select": "token", "limit": "1",
    })
    if not existing_tr:
        sim = await sb_query("simulacao_projetos", {
            "id": f"eq.{simulacao_id}", "select": "*", "limit": "1",
        })
        if sim:
            s = sim[0]
            itens = await sb_query("simulacao_itens", {
                "simulacao_id": f"eq.{simulacao_id}", "select": "valor,categoria,desconto_perc",
            })
            total = compute_proposta_total(itens, float(s.get("desconto_perc", 0) or 0))["total_final"]
            await sb_insert("orcamento_tracking", {
                "simulacao_id": simulacao_id,
                "token": uuid.uuid4().hex[:16],
                "cliente_nome": s.get("cliente", ""),
                "obra_code": s.get("obra_code", ""),
                "vendedor": s.get("vendedor", ""),
                "valor_total": total,
            })

    link = f"{BASE_URL}/proposta/{simulacao_id}?p={token_dest}"

    role_emoji = {"cliente": "👤", "arquiteto": "🏛️"}.get(role, "📋")
    await notificar_grupo(
        f"🔗 *LINK PERSONALIZADO GERADO*\n\n"
        f"{role_emoji} *{role.title()}:* {name}\n"
        f"📋 *Simulação:* {simulacao_id[:8]}…\n\n"
        f"🌐 *Link:* {link}"
    )
    return {"link": link, "token": token_dest, "name": name, "role": role}


@router.get("/orcamento/recipients/{simulacao_id}")
async def listar_recipients(simulacao_id: str):
    rows = await sb_query("orcamento_recipients", {
        "simulacao_id": f"eq.{simulacao_id}",
        "select": "*", "order": "created_at.asc",
    })
    return {"items": rows or []}


# ── Gerar link de tracking ──
@router.post("/orcamento/gerar-link")
async def gerar_link(request: Request):
    """Gera um link público com tracking para uma proposta."""
    body = await request.json()
    simulacao_id = body.get("simulacao_id")
    cliente_nome = body.get("cliente_nome", "")
    obra_code = body.get("obra_code", "")
    vendedor = body.get("vendedor", "")
    valor_total = body.get("valor_total", 0)

    if not simulacao_id:
        return {"error": "simulacao_id obrigatório"}

    # Verifica se já existe token
    existing = await sb_query("orcamento_tracking", {"simulacao_id": f"eq.{simulacao_id}", "select": "token", "limit": "1"})
    if existing:
        token = existing[0]["token"]
    else:
        token = uuid.uuid4().hex[:16]
        await sb_insert("orcamento_tracking", {
            "simulacao_id": simulacao_id,
            "token": token,
            "cliente_nome": cliente_nome,
            "obra_code": obra_code,
            "vendedor": vendedor,
            "valor_total": valor_total,
        })

    link = f"{BASE_URL}/proposta/{token}"

    # Busca dados completos se não vieram no body
    if not cliente_nome or not valor_total:
        sim = await sb_query("simulacao_projetos", {"id": f"eq.{simulacao_id}", "select": "*", "limit": "1"})
        if sim:
            s = sim[0]
            cliente_nome = cliente_nome or s.get("cliente", "")
            obra_code = obra_code or s.get("obra_code", "")
            vendedor = vendedor or s.get("vendedor", "")
            if not valor_total:
                itens = await sb_query("simulacao_itens", {"simulacao_id": f"eq.{simulacao_id}", "select": "valor,categoria,desconto_perc"})
                valor_total = compute_proposta_total(itens, float(s.get("desconto_perc", 0) or 0))["total_final"]

    # Notifica grupo Orçamentos com o link
    def fmt(v): return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    await notificar_grupo(
        f"🔗 *LINK DE PROPOSTA GERADO*\n\n"
        f"👤 *Cliente:* {cliente_nome}\n"
        f"📋 *Código:* {obra_code}\n"
        f"💰 *Valor:* {fmt(valor_total)}\n"
        f"👔 *Vendedor:* {vendedor}\n\n"
        f"🌐 *Link:* {link}"
    )

    return {"link": link, "token": token}


# ── Página pública da proposta (com tracking) ──
@router.get("/proposta/{token}", response_class=HTMLResponse)
async def proposta_publica(token: str, request: Request):
    """Serve a página da proposta usando o template Brascomm x Parket com tracking."""
    rows = await sb_query("orcamento_tracking", {"token": f"eq.{token}", "select": "*", "limit": "1"})
    if not rows:
        return HTMLResponse("<h1>Proposta não encontrada</h1>", status_code=404)

    tracking = rows[0]
    simulacao_id = tracking["simulacao_id"]

    sim = await sb_query("simulacao_projetos", {"id": f"eq.{simulacao_id}", "select": "*", "limit": "1"})
    itens = await sb_query("simulacao_itens", {"simulacao_id": f"eq.{simulacao_id}", "select": "*", "order": "ordem"})

    proposta = sim[0] if sim else {}
    cliente = proposta.get("cliente", tracking.get("cliente_nome", "Cliente"))
    vendedor = proposta.get("vendedor", tracking.get("vendedor", ""))
    numero = proposta.get("numero", "")
    cnpj = proposta.get("cnpj_cpf", "")
    endereco = proposta.get("endereco", "")
    arquiteto = proposta.get("arquiteto", "")
    forma_pagamento = proposta.get("forma_pagamento", "A combinar")
    validade = proposta.get("validade_dias", 15)
    desconto = float(proposta.get("desconto_perc", 0) or 0)
    created_at = proposta.get("created_at", "")
    contratante = f"{cliente} | {arquiteto}" if arquiteto else cliente

    from datetime import datetime, timezone
    try:
        hoje = datetime.fromisoformat(created_at.replace("Z","+00:00")).strftime("%d de %B de %Y")
    except:
        hoje = datetime.now().strftime("%d de %B de %Y")

    def fmt(val): return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    # Agrupa itens por categoria
    grupos = {}
    for it in itens:
        cat = it.get("categoria", "Geral")
        if cat not in grupos: grupos[cat] = []
        grupos[cat].append(it)

    _calc = compute_proposta_total(itens, desconto)
    total_bruto = _calc["bruto"]
    desconto_valor = _calc["desconto_global_valor"] + _calc["desconto_item_valor"]
    total_final = _calc["total_final"]

    # Gera linhas da tabela
    items_rows = ""
    cat_index = 1
    for cat, cat_itens in grupos.items():
        cat_itens.sort(key=lambda x: x.get("ordem", 0))
        subtotal = sum(float(i.get("valor", 0)) for i in cat_itens)
        items_rows += f'<tr class="cat-row"><td class="cell-itens cat-cell">{cat_index}</td><td class="cell-desc cat-cell" style="text-align:left;padding-left:4px;">{cat}</td><td class="cell-valor cat-cell"></td></tr>'
        for idx, item in enumerate(cat_itens):
            desc = (item.get("descritivo", "")).replace("\n", "<br>")
            items_rows += f'<tr class="item-row"><td class="cell-itens item-num">{cat_index}.{idx+1}</td><td class="cell-desc item-desc" style="text-align:left;padding-left:4px;">{desc}</td><td class="cell-valor item-val">{fmt(float(item.get("valor",0)))}</td></tr>'
        items_rows += f'<tr class="sub-row"><td class="cell-itens sub-cell"></td><td class="cell-desc sub-label" style="text-align:left;padding-left:4px;">Valor parcial — {cat.lower()}</td><td class="cell-valor sub-val">{fmt(subtotal)}</td></tr>'
        cat_index += 1

    desconto_row = ""
    if desconto_valor > 0:
        # % efetiva sobre o bruto (cobre global + per-item discount)
        eff_pct = (desconto_valor / total_bruto * 100) if total_bruto > 0 else 0
        desconto_row = f'<tr><td class="resumo-label" style="text-align:center;"> </td><td class="resumo-label">&nbsp;DESCONTO CONCEDIDO ({eff_pct:.1f}%)</td><td class="resumo-val resumo-desconto">-{fmt(desconto_valor)}</td></tr>'

    # Registra abertura
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")[:200]
    agora = datetime.now(timezone.utc).isoformat()
    viz = (tracking.get("visualizacoes") or 0) + 1
    await sb_update("orcamento_tracking", {"token": f"eq.{token}"}, {"abriu": True, "abriu_em": agora, "visualizacoes": viz, "ip": ip, "user_agent": ua})

    # Notifica grupo
    await notificar_grupo(
        f"👁 *PROPOSTA ABERTA*\n\n👤 *Cliente:* {cliente}\n📋 *Proposta:* {numero}\n💰 *Valor:* {fmt(total_final)}\n👔 *Vendedor:* {vendedor}\n🔄 *Visualização:* {viz}ª vez\n⏰ *Horário:* {datetime.now(timezone.utc).strftime('%d/%m %H:%M')}"
    )
    logger.info("proposta_aberta", token=token, cliente=cliente, visualizacao=viz)

    # HTML completo — template Brascomm x Parket
    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Proposta Parket — {numero}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}html,body{{font-family:'Segoe UI',Arial,sans-serif;color:#111}}
@page{{size:A4;margin:0}}
@media print{{html,body{{background:#fff}}body{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}.pb{{page-break-before:always}}.no-break{{page-break-inside:avoid}}}}
@media screen{{html,body{{background:#e0e0e0}}}}
.page{{width:595pt;height:842pt;position:relative;overflow:hidden;background:#fff;margin:0 auto}}
@media screen{{.page{{box-shadow:0 2px 20px rgba(0,0,0,0.12);margin-top:20pt;margin-bottom:20pt}}.contrato-page{{margin-top:20pt;margin-bottom:20pt}}}}
@media screen and (max-width:700px){{.page,.contrato-page{{transform-origin:top center;transform:scale(0.48);margin-bottom:-420pt}}}}
@media screen and (min-width:701px) and (max-width:1000px){{.page,.contrato-page{{transform-origin:top center;transform:scale(0.7);margin-bottom:-250pt}}}}
.page.black{{background:#000}}
.s8dff5e0a{{color:#e9e9e9;font:34pt 'Segoe UI';text-align:left;position:absolute;overflow:hidden}}
.s231711ae{{color:#e9e9e9;font:12pt 'Segoe UI';text-align:left;position:absolute;overflow:hidden}}
.sc62221c3{{background-color:#fbfbfb;font:34pt 'Segoe UI';text-align:left;position:absolute;overflow:hidden}}
.items-table{{width:473.57pt;margin-left:56.38pt;border-collapse:collapse;font:9pt 'Segoe UI',Arial,sans-serif}}
.col-head-itens,.col-head-desc,.col-head-valor{{background:#000;color:#e9e9e9;font:bold 12pt 'Segoe UI',Arial,sans-serif;text-align:center;padding:6pt 4pt}}
.col-head-itens{{border-right:1px solid #fff}}.col-head-desc{{border-left:1px solid #fff;border-right:1px solid #fff}}.col-head-valor{{border-left:1px solid #fff}}
.cell-itens{{width:84pt}}.cell-desc{{width:303pt}}.cell-valor{{width:84pt}}
.cat-row td{{font:bold 9pt 'Segoe UI',Arial,sans-serif;border-right:2px solid #fff;border-bottom:2px solid #fff;padding:8pt 4pt;vertical-align:middle}}.cat-cell{{text-align:center}}
.item-row td{{font:9pt 'Segoe UI',Arial,sans-serif;border-right:1px solid #fff;border-bottom:1px solid #fff;padding:6pt 4pt;vertical-align:middle}}.item-num{{text-align:center}}.item-desc{{text-align:left;line-height:1.4}}.item-val{{text-align:center}}
.sub-row td{{font:bold 9pt 'Segoe UI',Arial,sans-serif;border-top:2px solid #fff;border-right:2px solid #fff;border-bottom:2px solid #fff;padding:7pt 4pt;vertical-align:middle}}.sub-label{{text-align:right!important}}.sub-val{{text-align:center}}
.items-page-header{{width:595pt;padding:0}}.items-header-id{{font:12pt 'Segoe UI',Arial,sans-serif;text-align:right;padding:6pt 25pt 2pt 0;width:100%}}.items-header-sub{{font:12pt 'Segoe UI',Arial,sans-serif;text-align:left;padding:2pt 0 4pt 56pt}}.items-page-footer{{font:20pt 'Segoe UI',Arial,sans-serif;text-align:right;padding:8pt 25pt 0 0;width:100%}}
.resumo-table{{width:473.57pt;margin-left:56.38pt;border-collapse:collapse;font:9pt 'Segoe UI',Arial,sans-serif}}.resumo-label{{font:bold 9pt 'Segoe UI',Arial,sans-serif;border-top:1px solid #fff;border-right:2px solid #fff;border-bottom:2px solid #fff;padding:7pt 4pt;text-align:left}}.resumo-val{{font:bold 9pt 'Segoe UI',Arial,sans-serif;border-top:1px solid #fff;border-bottom:2px solid #fff;padding:7pt 4pt;text-align:center}}.resumo-desconto{{color:#ff0000}}
.cond-table{{width:473.57pt;margin-left:56.38pt;border-collapse:collapse;font:9pt 'Segoe UI',Arial,sans-serif}}.cond-label{{font:bold 9pt 'Segoe UI',Arial,sans-serif;border:1px solid #fff;padding:5pt 4pt;text-align:center;vertical-align:middle;width:84pt}}.cond-val{{font:9pt 'Segoe UI',Arial,sans-serif;border-right:2px solid #fff;border-bottom:2px solid #fff;padding:5pt 4pt;text-align:left;width:305pt}}.cond-empty{{font:9pt 'Segoe UI',Arial,sans-serif;border-bottom:2px solid #fff;padding:5pt 4pt;text-align:center;width:84pt}}
.sig-line{{border-top:1px solid #000;padding-top:4pt;font:8pt Arial}}
.contrato-page{{width:595pt;min-height:842pt;margin:0 auto;background:#fff;position:relative}}
@media screen{{.contrato-page{{margin:20pt auto;box-shadow:0 0 20px rgba(0,0,0,0.08)}}}}
.contrato-header{{background:#000;color:#e9e9e9;padding:10pt 40pt;display:flex;justify-content:space-between;align-items:center}}
.contrato-titulo{{text-align:center;padding:14pt 40pt 10pt;font:bold 9pt 'Segoe UI',Arial;text-transform:uppercase;letter-spacing:1.5pt;border-bottom:1px solid #ccc}}
.contrato{{font:7.5pt 'Segoe UI',Arial,sans-serif;text-align:justify;line-height:1.65;padding:20pt 40pt 40pt 40pt;columns:2;column-gap:24pt;column-rule:1px solid #ddd}}
.contrato p{{margin-bottom:5pt;break-inside:avoid}}.clausula-title{{font-weight:bold;font-size:8pt;margin-top:12pt;margin-bottom:4pt;break-after:avoid;text-transform:uppercase;letter-spacing:0.3pt}}
</style>
</head>
<body>
<div class="page pb" style="background:#fbfbfb;"><div class="sc62221c3" style="left:59pt;top:398pt;width:271pt;height:40pt;white-space:nowrap;">PARKET</div></div>
<div class="page pb black"><div style="position:absolute;left:0;top:0;width:100%;height:100%;background:#000"></div><div class="s8dff5e0a" style="left:59pt;top:396pt;width:153pt;height:40pt;white-space:nowrap;">PARKET</div><div class="s231711ae" style="left:59pt;top:490pt;width:390pt;height:17pt;white-space:nowrap;">São Paulo, {hoje}</div><div class="s231711ae" style="left:59pt;top:519pt;width:390pt;height:17pt;white-space:nowrap;">Proposta comercial - {numero}</div><div class="s231711ae" style="left:59pt;top:547pt;width:390pt;height:17pt;white-space:nowrap;">Contratante: {contratante}</div><div class="s231711ae" style="left:59pt;top:564pt;width:390pt;height:17pt;white-space:nowrap;">{endereco}</div><div class="s231711ae" style="left:59pt;top:609pt;width:390pt;height:17pt;white-space:nowrap;">Contratado: Parket</div><div class="s231711ae" style="left:59pt;top:626pt;width:390pt;height:17pt;white-space:nowrap;">Vendedor: {vendedor}</div><div class="s231711ae" style="left:59pt;top:671pt;width:390pt;height:17pt;white-space:nowrap;">Validade da proposta: {validade} dias</div></div>
<div class="pb contrato-page" style="min-height:auto;"><div class="items-page-header no-break"><div class="items-header-id">{contratante}, ID: {numero}</div><div class="items-header-sub">Itens orçados:</div></div><table class="items-table"><thead><tr><th class="col-head-itens">ITENS</th><th class="col-head-desc">DESCRITIVO</th><th class="col-head-valor">VALOR</th></tr></thead><tbody>{items_rows}</tbody></table><div class="items-page-footer">PARKET</div></div>
<div class="pb no-break" style="width:595pt;padding-top:20pt;"><div class="items-header-id" style="font:12pt 'Segoe UI',Arial,sans-serif;text-align:right;padding:6pt 25pt 2pt 0;">{contratante}, ID: {numero}</div><div class="items-header-sub" style="font:12pt 'Segoe UI',Arial,sans-serif;padding:2pt 0 12pt 56pt;">Itens orçados:</div><table class="resumo-table"><tr><td class="resumo-label" style="border-top:2px solid #fff;width:84pt;text-align:center;"> </td><td class="resumo-label" style="border-top:2px solid #fff;width:303pt;">RESUMO TOTAL DOS PRODUTOS ORÇADOS</td><td class="resumo-val" style="border-top:2px solid #fff;width:84pt;">{fmt(total_bruto)}</td></tr>{desconto_row}<tr><td class="resumo-label" style="text-align:center;border-bottom:none;">TOTAL</td><td class="resumo-label" style="border-bottom:none;"></td><td class="resumo-val" style="border-bottom:none;">{fmt(total_final)}</td></tr><tr><td colspan="3"><div style="border-top:1px solid #000;margin:2pt 0;"></div></td></tr></table>
<table class="cond-table" style="margin-top:8pt;"><tr><td class="cond-label" rowspan="5">CONDIÇÕES</td><td class="cond-val"><b>Condições de pagamento:</b> {forma_pagamento}</td><td class="cond-empty"></td></tr><tr><td class="cond-val"><b>Garantia:</b> 10 anos</td><td class="cond-empty"></td></tr><tr><td class="cond-val"><b>Prazo de entrega:</b> De acordo com a necessidade da obra <b>***com aviso prévio de 120 dias***</b></td><td class="cond-empty"></td></tr><tr><td class="cond-val"><b>Prazo de execução:</b> 120 dias após a entrega do material</td><td class="cond-empty"></td></tr><tr><td class="cond-val"><b>Dados bancários:</b> Banco Itaú | Agencia 3720 CC 30.288-8 | PIX: pamella@parket.com.br &nbsp; Mundial Export Assess. Com. e Ext. Imp e Exp Eireli | CNPJ 29.872.616/0001-34</td><td class="cond-empty"></td></tr></table>
<div style="margin:20pt 0 0 56pt;font:12pt 'Segoe UI',Arial,sans-serif;">Para confirmar este pedido</div><div style="margin:16pt 0 0 56pt;border-top:1px solid #000;padding-top:4pt;width:315pt;font:10pt 'Segoe UI',Arial,sans-serif;">Com a assinatura deste documento, aceita as condições gerais que estão em anexo</div><div class="items-page-footer" style="margin-top:30pt;">PARKET</div></div>
<script>
var TK="{token}",API="{BASE_URL}/api/orcamento/tracking",ST=Date.now();
setInterval(function(){{var s=Math.round((Date.now()-ST)/1000);fetch(API+"/heartbeat",{{method:"POST",headers:{{"Content-Type":"application/json"}},body:JSON.stringify({{token:TK,tempo_segundos:s}})}}).catch(function(){{}});}},30000);
window.addEventListener("beforeunload",function(){{var s=Math.round((Date.now()-ST)/1000);navigator.sendBeacon(API+"/saiu",JSON.stringify({{token:TK,tempo_segundos:s}}));}});
document.addEventListener("visibilitychange",function(){{if(document.hidden){{var s=Math.round((Date.now()-ST)/1000);navigator.sendBeacon(API+"/saiu",JSON.stringify({{token:TK,tempo_segundos:s}}));}}}});
</script>
</body></html>"""

    return HTMLResponse(html)


# ── Tracking endpoints (chamados pelo JS da página) ──

@router.post("/orcamento/tracking/heartbeat")
async def tracking_heartbeat(request: Request):
    """Heartbeat a cada 30s — atualiza tempo na página."""
    body = await request.json()
    token = body.get("token")
    tempo = body.get("tempo_segundos", 0)
    if token:
        await sb_update("orcamento_tracking", {"token": f"eq.{token}"}, {"tempo_segundos": tempo})
    return {"ok": True}


@router.post("/orcamento/tracking/saiu")
async def tracking_saiu(request: Request):
    """Cliente saiu da página — registra tempo final e notifica grupo."""
    try:
        body = await request.json()
    except:
        return {"ok": True}

    token = body.get("token")
    tempo = body.get("tempo_segundos", 0)
    if not token:
        return {"ok": True}

    from datetime import datetime, timezone
    agora = datetime.now(timezone.utc).isoformat()

    # Busca dados do tracking
    rows = await sb_query("orcamento_tracking", {"token": f"eq.{token}", "select": "*", "limit": "1"})
    if not rows:
        return {"ok": True}

    tracking = rows[0]

    # Atualiza
    await sb_update("orcamento_tracking", {"token": f"eq.{token}"}, {
        "saiu_em": agora,
        "tempo_segundos": tempo,
    })

    # Formata tempo
    minutos = tempo // 60
    segundos = tempo % 60
    tempo_fmt = f"{minutos}min {segundos}s" if minutos > 0 else f"{segundos}s"

    cliente = tracking.get("cliente_nome", "Cliente")
    numero = tracking.get("obra_code", "")

    # Notifica grupo
    await notificar_grupo(
        f"📊 *PROPOSTA FECHADA*\n\n"
        f"👤 *Cliente:* {cliente}\n"
        f"📋 *Proposta:* {numero}\n"
        f"⏱ *Tempo na página:* {tempo_fmt}\n"
        f"💰 *Valor:* R$ {float(tracking.get('valor_total', 0)):,.2f}"
    )

    # Registra no card kanban (se tiver obra vinculada)
    try:
        simulacao_id = tracking.get("simulacao_id")
        if simulacao_id:
            sims = await sb_query("simulacao_projetos", {"id": f"eq.{simulacao_id}", "select": "obra_code"})
            if sims and sims[0].get("obra_code"):
                obra_code = sims[0]["obra_code"]
                cards = await sb_query("kanban_cards", {"obra": f"eq.{obra_code}", "select": "id,details", "limit": "1"})
                if cards:
                    det = cards[0].get("details") or {}
                    hist = det.get("proposta_tracking", [])
                    hist.append({
                        "data": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
                        "cliente": cliente,
                        "tempo_segundos": tempo,
                        "tempo_fmt": tempo_fmt,
                        "visualizacao": tracking.get("visualizacoes", 1),
                    })
                    if len(hist) > 50:
                        hist = hist[-50:]
                    det["proposta_tracking"] = hist
                    await sb_update("kanban_cards", {"id": f"eq.{cards[0]['id']}"}, {"details": det})
    except Exception as e:
        logger.error("tracking_card_error", error=str(e))

    logger.info("proposta_saiu", token=token, cliente=cliente, tempo=tempo_fmt)
    return {"ok": True}


# ── API para consultar tracking ──
@router.get("/orcamento/tracking/{simulacao_id}")
async def get_tracking(simulacao_id: str):
    """Retorna dados de tracking de uma proposta."""
    rows = await sb_query("orcamento_tracking", {"simulacao_id": f"eq.{simulacao_id}", "select": "*"})
    return {"tracking": rows[0] if rows else None}


@router.get("/orcamento/tracking-lista")
async def lista_tracking():
    """Lista todos os trackings ordenados por data."""
    rows = await sb_query("orcamento_tracking", {"select": "*", "order": "created_at.desc", "limit": "50"})
    return {"items": rows}


# ── Endpoints para tracking via simulacao_id (chamados pelo script injetado no nginx) ──

@router.post("/orcamento/tracking/abriu")
async def tracking_abriu_sid(request: Request):
    """Registra abertura da proposta com enriquecimento de identidade.

    Body esperado:
      simulacao_id    (obrigatório)
      recipient_token (opcional)  → ?p=tok_XXX da URL
      visitor_id      (opcional)  → uuid do localStorage do visitante
      fingerprint     (opcional)  → hash device fingerprint
    """
    body = await request.json()
    sid = body.get("simulacao_id")
    if not sid:
        return {"ok": False}

    recipient_token = (body.get("recipient_token") or "").strip()
    visitor_id = (body.get("visitor_id") or "").strip()
    fingerprint = (body.get("fingerprint") or "").strip()
    ip = _client_ip(request)
    ua = request.headers.get("user-agent") or ""

    # DEDUP: chave = sid + UA (ignora IP que pode diferir IPv4/IPv6, ignora visitor_id
    # que pode diferir entre POSTs do mesmo browser por chunks JS distintos em cache).
    # Janela de 60s — qualquer POST repetido SKIPA notif e visita extra.
    import time as _t
    if not hasattr(tracking_abriu_sid, "_dedup"):
        tracking_abriu_sid._dedup = {}
    _dd = tracking_abriu_sid._dedup
    _key = sid + "|" + ua[:100]
    _now = _t.time()
    # Limpa entradas velhas (>5min)
    for _k in list(_dd.keys()):
        if _now - _dd[_k] > 300:
            del _dd[_k]
    if _key in _dd and (_now - _dd[_key]) < 60:
        logger.info("tracking_abriu_dedup_skip", sid=sid, key=_key[:40])
        return {"ok": True, "deduped": True}
    _dd[_key] = _now

    # DEBUG: log payload pra investigar "Anônimo"
    logger.info("tracking_abriu_payload", sid=sid, body=body, referer=request.headers.get("referer", ""), ua=ua[:60])
    # Abertura interna: identifica quem está logado no Space (orcamentista
    # ou vendedor) versus cliente externo. Quando o link foi gerado pelo
    # botão "Abrir Proposta" do dashboard, o frontend embute o email do
    # usuário no payload — assim o agente diferencia "aberta pela equipe"
    # de "aberta pelo cliente" na mensagem do grupo.
    internal_user = body.get("internal_user") or {}
    internal_email = (internal_user.get("email") or "").strip()
    internal_name = (internal_user.get("nome") or internal_user.get("name") or "").strip()

    from datetime import datetime, timezone
    agora = datetime.now(timezone.utc)

    # Resolve identidade pelo token (se houver)
    recipient_name = ""
    recipient_role = ""
    if recipient_token:
        rec = await sb_query("orcamento_recipients", {
            "token": f"eq.{recipient_token}",
            "select": "name,role,simulacao_id", "limit": "1",
        })
        if rec:
            recipient_name = rec[0].get("name", "")
            recipient_role = rec[0].get("role", "")
            # Se token não bate com o sid, ainda usa mas marca anomalia (link tampered?)

    # Detecta forward: existe visita anterior nesse sid com OUTRO visitor_id que usou esse token?
    is_forward = False
    visitas_passadas = []
    if visitor_id or recipient_token:
        params = {"simulacao_id": f"eq.{sid}", "select": "*", "order": "abriu_em.asc"}
        visitas_passadas = await sb_query("orcamento_visitas", params) or []
        if recipient_token:
            # Visitas anteriores com mesmo token mas outro visitor_id = forward
            distintos = {v.get("visitor_id") for v in visitas_passadas
                          if v.get("recipient_token") == recipient_token and v.get("visitor_id")}
            if distintos and visitor_id and visitor_id not in distintos:
                is_forward = True
        elif visitor_id:
            # Sem token, qualquer visita anterior com visitor_id distinto e token original presente
            outros_com_token = [v for v in visitas_passadas
                                 if v.get("recipient_token") and v.get("visitor_id") != visitor_id]
            if outros_com_token:
                is_forward = True

    # Conta visualizações desse mesmo visitor_id
    minhas_visitas = [v for v in visitas_passadas if v.get("visitor_id") == visitor_id and visitor_id] if visitor_id else []
    viz_pessoa = len(minhas_visitas) + 1

    # Parse UA
    ua_info = _parse_user_agent(ua)
    # Geo
    geo = await _geo_lookup(ip)

    # Insere visita
    await sb_insert("orcamento_visitas", {
        "simulacao_id": sid,
        "recipient_token": recipient_token or None,
        "recipient_name": recipient_name or None,
        "recipient_role": recipient_role or None,
        "visitor_id": visitor_id or None,
        "fingerprint": fingerprint or None,
        "ip": ip,
        "user_agent": ua[:500],
        "device_type": ua_info["device_type"],
        "os": ua_info["os"],
        "browser": ua_info["browser"],
        "geo_city": geo.get("geo_city") or None,
        "geo_region": geo.get("geo_region") or None,
        "geo_country": geo.get("geo_country") or None,
        "abriu_em": agora.isoformat(),
        "ultimo_heartbeat": agora.isoformat(),
        "visualizacoes": viz_pessoa,
        "is_forward": is_forward,
    })

    # Mantém orcamento_tracking sincronizado (compat agregada)
    # SEMPRE recalcula valor_total a partir dos itens atuais — não confia
    # no que tava cacheado (pode ter sido calculado com fórmula antiga ou
    # antes de edição de itens/descontos).
    tracking_rows = await sb_query("orcamento_tracking", {
        "simulacao_id": f"eq.{sid}", "select": "*", "limit": "1",
    })
    sim_now = await sb_query("simulacao_projetos", {"id": f"eq.{sid}", "select": "*", "limit": "1"})
    valor_atual = 0.0
    cliente_atual = ""
    vendedor_atual = ""
    obra_atual = ""
    if sim_now:
        s_n = sim_now[0]
        itens_now = await sb_query("simulacao_itens", {
            "simulacao_id": f"eq.{sid}", "select": "valor,categoria,desconto_perc",
        })
        valor_atual = compute_proposta_total(itens_now, float(s_n.get("desconto_perc", 0) or 0))["total_final"]
        cliente_atual = s_n.get("cliente") or ""
        vendedor_atual = s_n.get("vendedor") or ""
        obra_atual = s_n.get("obra_code") or ""

    if tracking_rows:
        viz_total = (tracking_rows[0].get("visualizacoes") or 0) + 1
        await sb_update("orcamento_tracking", {"simulacao_id": f"eq.{sid}"},
                        {"abriu": True, "abriu_em": agora.isoformat(),
                         "visualizacoes": viz_total, "ip": ip, "user_agent": ua[:500],
                         # Atualiza pra refletir o estado atual
                         "valor_total": valor_atual,
                         "cliente_nome": cliente_atual or tracking_rows[0].get("cliente_nome", ""),
                         "vendedor": vendedor_atual or tracking_rows[0].get("vendedor", ""),
                         "obra_code": obra_atual or tracking_rows[0].get("obra_code", "")})
        tracking_data = {
            **tracking_rows[0],
            "valor_total": valor_atual,
            "cliente_nome": cliente_atual or tracking_rows[0].get("cliente_nome", ""),
            "vendedor": vendedor_atual or tracking_rows[0].get("vendedor", ""),
            "obra_code": obra_atual or tracking_rows[0].get("obra_code", ""),
        }
    else:
        # Cria tracking on-the-fly
        if sim_now:
            await sb_insert("orcamento_tracking", {
                "simulacao_id": sid, "token": uuid.uuid4().hex[:16],
                "cliente_nome": cliente_atual, "obra_code": obra_atual,
                "vendedor": vendedor_atual, "valor_total": valor_atual,
                "abriu": True, "abriu_em": agora.isoformat(), "visualizacoes": 1,
            })
            tracking_data = {
                "cliente_nome": cliente_atual, "vendedor": vendedor_atual,
                "obra_code": obra_atual, "valor_total": valor_atual,
            }
        else:
            tracking_data = {}

    # Monta a notificação enriquecida
    def fmt(v):
        try: return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        except Exception: return "R$ —"

    # Identidade
    if internal_email or internal_name:
        # Equipe Parket logada no Space — mostra quem é em vez de "anônimo".
        nome_show = internal_name or internal_email.split("@")[0]
        email_show = f" ({internal_email})" if internal_email and internal_name else ""
        identidade = f"🟢 *Equipe Parket — {nome_show}*{email_show}"
        cabecalho = "🟢 *PROPOSTA ABERTA INTERNAMENTE*"
    elif recipient_name and not is_forward:
        role_emoji = {"cliente": "👤", "arquiteto": "🏛️"}.get(recipient_role, "📋")
        identidade = f"{role_emoji} *{recipient_name}* ({recipient_role})"
        cabecalho = "👁 *PROPOSTA ABERTA*"
    elif is_forward and recipient_name:
        identidade = f"⚠️ *Visitante anônimo* (forward via link de {recipient_name})"
        cabecalho = "🔁 *PROPOSTA ABERTA POR FORWARD*"
    else:
        identidade = "👁 *Visitante anônimo*"
        cabecalho = "👁 *PROPOSTA ABERTA*"

    # Linha de visualizações
    if viz_pessoa == 1:
        viz_line = "🆕 1ª vez"
    else:
        viz_line = f"🔄 {viz_pessoa}ª visita desta pessoa"

    # Geo + device
    geo_str = ""
    if geo.get("geo_city"):
        geo_str = f"📍 {geo['geo_city']}"
        if geo.get("geo_region"):
            geo_str += f"/{geo['geo_region']}"
    dev_emoji = {"mobile": "📱", "tablet": "📱", "desktop": "💻"}.get(ua_info["device_type"], "📱")
    dev_str = f"{dev_emoji} {ua_info['device_type'].title()} · {ua_info['os']} · {ua_info['browser']}"

    msg = (
        f"{cabecalho}\n\n"
        f"{identidade}\n"
        f"📋 *Cliente:* {tracking_data.get('cliente_nome', '')}\n"
        f"💰 *Valor:* {fmt(tracking_data.get('valor_total', 0))}\n"
        f"👔 *Vendedor:* {tracking_data.get('vendedor', '')}\n\n"
        f"{viz_line}\n"
        f"{dev_str}"
    )
    if geo_str:
        msg += f"\n{geo_str}"
    msg += f"\n⏰ {_fmt_local_time(agora, geo.get('timezone', ''))}"
    await notificar_grupo(msg)

    return {"ok": True, "is_forward": is_forward, "viz_pessoa": viz_pessoa}


@router.post("/orcamento/tracking/heartbeat-sid")
async def tracking_heartbeat_sid(request: Request):
    body = await request.json()
    sid = body.get("simulacao_id")
    tempo = body.get("tempo_segundos", 0)
    visitor_id = (body.get("visitor_id") or "").strip()
    if not sid:
        return {"ok": True}
    from datetime import datetime, timezone
    agora = datetime.now(timezone.utc).isoformat()
    # Atualiza tracking agregado
    await sb_update("orcamento_tracking", {"simulacao_id": f"eq.{sid}"}, {"tempo_segundos": tempo})
    # Atualiza a visita atual desse visitante (a mais recente sem saiu_em)
    if visitor_id:
        rows = await sb_query("orcamento_visitas", {
            "simulacao_id": f"eq.{sid}", "visitor_id": f"eq.{visitor_id}",
            "saiu_em": "is.null",
            "select": "id", "order": "abriu_em.desc", "limit": "1",
        })
        if rows:
            await sb_update("orcamento_visitas", {"id": f"eq.{rows[0]['id']}"},
                            {"tempo_segundos": tempo, "ultimo_heartbeat": agora})
    return {"ok": True}


@router.post("/orcamento/tracking/saiu-sid")
async def tracking_saiu_sid(request: Request):
    try:
        body = await request.json()
    except:
        return {"ok": True}
    sid = body.get("simulacao_id")
    tempo = body.get("tempo_segundos", 0)
    visitor_id = (body.get("visitor_id") or "").strip()
    if not sid:
        return {"ok": True}

    # DEDUP por sid+UA (60s) — evita 2 notifs de PROPOSTA FECHADA
    ua = request.headers.get("user-agent") or ""
    import time as _t
    if not hasattr(tracking_saiu_sid, "_dedup"):
        tracking_saiu_sid._dedup = {}
    _dd = tracking_saiu_sid._dedup
    _key = sid + "|" + ua[:100]
    _now = _t.time()
    for _k in list(_dd.keys()):
        if _now - _dd[_k] > 300:
            del _dd[_k]
    if _key in _dd and (_now - _dd[_key]) < 60:
        logger.info("tracking_saiu_dedup_skip", sid=sid)
        return {"ok": True, "deduped": True}
    _dd[_key] = _now

    from datetime import datetime, timezone
    agora = datetime.now(timezone.utc)

    rows = await sb_query("orcamento_tracking", {"simulacao_id": f"eq.{sid}", "select": "*", "limit": "1"})
    if not rows:
        return {"ok": True}
    tracking = rows[0]

    await sb_update("orcamento_tracking", {"simulacao_id": f"eq.{sid}"},
                    {"saiu_em": agora.isoformat(), "tempo_segundos": tempo})

    # Fecha a visita atual
    visita_atual = None
    if visitor_id:
        vrows = await sb_query("orcamento_visitas", {
            "simulacao_id": f"eq.{sid}", "visitor_id": f"eq.{visitor_id}",
            "saiu_em": "is.null",
            "select": "*", "order": "abriu_em.desc", "limit": "1",
        })
        if vrows:
            visita_atual = vrows[0]
            await sb_update("orcamento_visitas", {"id": f"eq.{vrows[0]['id']}"},
                            {"saiu_em": agora.isoformat(), "tempo_segundos": tempo})

    minutos = tempo // 60
    segundos = tempo % 60
    tempo_fmt = f"{minutos}min {segundos}s" if minutos > 0 else f"{segundos}s"

    def fmt(v): return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    # Identidade na notificação
    if visita_atual and visita_atual.get("recipient_name") and not visita_atual.get("is_forward"):
        role_emoji = {"cliente": "👤", "arquiteto": "🏛️"}.get(visita_atual.get("recipient_role"), "📋")
        ident = f"{role_emoji} {visita_atual['recipient_name']} ({visita_atual.get('recipient_role','')})"
    elif visita_atual and visita_atual.get("is_forward"):
        ident = f"⚠️ Visitante anônimo (forward via {visita_atual.get('recipient_name','—')})"
    else:
        ident = "👁 Visitante anônimo"

    await notificar_grupo(
        f"📊 *PROPOSTA FECHADA*\n\n"
        f"{ident}\n"
        f"📋 *Cliente:* {tracking.get('cliente_nome', '')}\n"
        f"⏱ *Tempo na página:* {tempo_fmt}\n"
        f"💰 *Valor:* {fmt(float(tracking.get('valor_total', 0)))}"
    )

    # Registra no card
    try:
        sim = await sb_query("simulacao_projetos", {"id": f"eq.{sid}", "select": "obra_code"})
        if sim and sim[0].get("obra_code"):
            cards = await sb_query("kanban_cards", {"obra": f"eq.{sim[0]['obra_code']}", "select": "id,details", "limit": "1"})
            if cards:
                det = cards[0].get("details") or {}
                hist = det.get("proposta_tracking", [])
                hist.append({"data": agora.strftime("%Y-%m-%d %H:%M"), "cliente": tracking.get("cliente_nome", ""),
                             "tempo_segundos": tempo, "tempo_fmt": tempo_fmt, "visualizacao": tracking.get("visualizacoes", 1)})
                if len(hist) > 50: hist = hist[-50:]
                det["proposta_tracking"] = hist
                await sb_update("kanban_cards", {"id": f"eq.{cards[0]['id']}"}, {"details": det})
    except Exception as e:
        logger.error("tracking_card_error", error=str(e))

    return {"ok": True}
