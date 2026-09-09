"""Renderização de PDF de boleto brasileiro padrão FEBRABAN.

Não existe endpoint na Cash Management v2 que devolve o PDF; a API só
retorna linha digitável + código de barras (44 dig). Aqui geramos o HTML
que o Playwright vira PDF (mesma cadeia de pdf_render.py), com o boleto
completo: recibo do pagador + ficha bancária com código Interleaved 2 of 5.
"""
from __future__ import annotations
import datetime as _dt
import html
import os
from typing import Iterable

# --- Interleaved 2 of 5 (padrão do boleto brasileiro) --------------------
# Cada dígito tem 5 barras (3 finas + 2 grossas em posições variadas).
# Codificamos pares: 1º dígito nas barras, 2º dígito nos espaços.
# Legenda: n=narrow, w=wide.
_I25 = {
    "0": "nnwwn", "1": "wnnnw", "2": "nwnnw", "3": "wwnnn",
    "4": "nnwnw", "5": "wnwnn", "6": "nwwnn", "7": "nnnww",
    "8": "wnnwn", "9": "nwnwn",
}
_START = "nnnn"    # start pattern (bar-space-bar-space)
_STOP = "wnn"      # stop pattern


def _i25_pattern(digits: str) -> Iterable[tuple[str, int]]:
    """Retorna sequência (tipo, largura) — tipo=B(ar)/S(pace), largura=1|3."""
    if len(digits) % 2:
        digits = "0" + digits            # I2of5 precisa de nº par de dígitos
    # Start
    for i, ch in enumerate(_START):
        yield ("B" if i % 2 == 0 else "S", 1 if ch == "n" else 3)
    # Pares
    for i in range(0, len(digits), 2):
        a, b = _I25[digits[i]], _I25[digits[i + 1]]
        for j in range(5):
            yield ("B", 1 if a[j] == "n" else 3)
            yield ("S", 1 if b[j] == "n" else 3)
    # Stop
    for i, ch in enumerate(_STOP):
        yield ("B" if i % 2 == 0 else "S", 1 if ch == "n" else 3)


def barcode_i25_svg(digits: str, height_mm: float = 13, module_mm: float = 0.34) -> str:
    """Renderiza o código de barras 44 dígitos como SVG string (unidade mm).

    Padrão FEBRABAN: altura ~13mm, módulo estreito ~0.34mm (=> ~103mm total).
    """
    digits = "".join(c for c in digits if c.isdigit())
    if not digits:
        return ""
    parts = list(_i25_pattern(digits))
    total_units = sum(w for _, w in parts)
    total_mm = total_units * module_mm
    rects = []
    x = 0.0
    for tipo, w in parts:
        width = w * module_mm
        if tipo == "B":
            rects.append(
                f'<rect x="{x:.3f}" y="0" width="{width:.3f}" height="{height_mm}" fill="#000"/>'
            )
        x += width
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_mm:.3f}mm" '
        f'height="{height_mm}mm" viewBox="0 0 {total_mm:.3f} {height_mm}" '
        f'preserveAspectRatio="none" shape-rendering="crispEdges">'
        + "".join(rects) + "</svg>"
    )


# --- Formatação -----------------------------------------------------------
def _fmt_brl(v: float) -> str:
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_dt(iso: str) -> str:
    try:
        return _dt.date.fromisoformat(iso).strftime("%d/%m/%Y")
    except (TypeError, ValueError):
        return iso or ""


def _fmt_linha(linha: str) -> str:
    """Aceita 47 dígitos limpos ou já com pontos/espaços; devolve o padrão
    de banco: 5.5 5.6 5.6 1 14."""
    d = "".join(c for c in (linha or "") if c.isdigit())
    if len(d) != 47:
        return linha or ""
    return (
        f"{d[0:5]}.{d[5:10]}  {d[10:15]}.{d[15:21]}  "
        f"{d[21:26]}.{d[26:32]}  {d[32]}  {d[33:]}"
    )


def _fmt_cpf(cpf: str) -> str:
    d = "".join(c for c in (cpf or "") if c.isdigit())
    if len(d) == 11:
        return f"{d[0:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    if len(d) == 14:
        return f"{d[0:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    return cpf or ""


# --- Logos (SVG inline) ---------------------------------------------------
# Itaú: quadrado laranja institucional (#EC7000) com "itaú" em branco.
# Cor oficial + tipografia sans grifada, aproximação limpa (sem trademark).
_LOGO_ITAU = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60" '
    'width="60" height="30" preserveAspectRatio="xMidYMid meet">'
    '<rect x="0" y="0" width="120" height="60" fill="#EC7000"/>'
    '<text x="60" y="42" font-family="Helvetica, Arial, sans-serif" '
    'font-weight="900" font-size="34" fill="#fff" text-anchor="middle" '
    'letter-spacing="-1">itaú</text></svg>'
)
# Parket: wordmark serifado (Cinzel-like, com fallback pra Playfair/Georgia).
# Cor grafite institucional dos contratos Parket.
_LOGO_PARKET = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40" '
    'width="120" height="24" preserveAspectRatio="xMidYMid meet">'
    '<text x="100" y="30" '
    'font-family="\'Cinzel\', \'Playfair Display\', Georgia, serif" '
    'font-weight="600" font-size="26" fill="#1F2A2E" text-anchor="middle" '
    'letter-spacing="6">PARKET</text></svg>'
)


def render_boleto_html(dados: dict) -> str:
    """dados esperados (todos opcionais fora dos que compõem o boleto real):
    Boleto (Itaú devolve): linha_digitavel, codigo_barras (44 dig), valor,
      vencimento, nosso_numero.
    Pagador: pagador_nome, pagador_cpf, pagador_endereco.
    Beneficiário: beneficiario_nome, beneficiario_cnpj, beneficiario_endereco,
      agencia_codigo, especie.
    Contexto do contrato (enriquece o demonstrativo): proposta_numero,
      obra_ref, valor_total, entrada_pct, condicoes_pagamento.
    """
    linha = html.escape(_fmt_linha(dados.get("linha_digitavel", "")))
    valor_fmt = _fmt_brl(float(dados.get("valor", 0) or 0))
    venc_fmt = _fmt_dt(dados.get("vencimento", ""))
    emissao_fmt = _fmt_dt(dados.get("emissao", _dt.date.today().isoformat()))
    nosso_numero = html.escape(str(dados.get("nosso_numero", "")))
    agencia = html.escape(dados.get("agencia_codigo", ""))
    pagador_nome = html.escape(dados.get("pagador_nome", ""))
    pagador_cpf = html.escape(_fmt_cpf(dados.get("pagador_cpf", "")))
    pagador_end = html.escape(dados.get("pagador_endereco", ""))
    benef_nome = html.escape(dados.get("beneficiario_nome", "PARKET"))
    benef_cnpj = html.escape(_fmt_cpf(dados.get("beneficiario_cnpj", "")))
    benef_end = html.escape(dados.get("beneficiario_endereco", ""))
    especie = html.escape(dados.get("especie", "R$"))
    # Contexto do contrato pra o demonstrativo + instruções
    proposta_numero = html.escape(str(dados.get("proposta_numero", "")))
    obra_ref = html.escape(dados.get("obra_ref", ""))
    valor_total_raw = dados.get("valor_total")
    valor_total_fmt = _fmt_brl(float(valor_total_raw)) if valor_total_raw else ""
    entrada_pct = dados.get("entrada_pct")
    condicoes = html.escape(dados.get("condicoes_pagamento", ""))
    # Saldo remanescente = total - esta entrada (só faz sentido se total > entrada)
    valor_num = float(dados.get("valor", 0) or 0)
    saldo_num = float(valor_total_raw) - valor_num if valor_total_raw else 0
    saldo_fmt = _fmt_brl(saldo_num) if saldo_num > 0 else ""
    # Demonstrativo em pares (label, valor) — vira grid de 2 colunas no PDF
    # pra caber em 1 página só e ficar legível a esquerda→direita.
    demons_pares = []
    if proposta_numero:
        demons_pares.append(("Proposta nº", proposta_numero))
    if valor_total_fmt:
        demons_pares.append(("Valor total do contrato", f"R$ {valor_total_fmt}"))
    if obra_ref:
        demons_pares.append(("Obra", obra_ref))
    if entrada_pct:
        demons_pares.append(("Entrada", f"{int(entrada_pct)}% - R$ {valor_fmt}"))
    if saldo_fmt:
        demons_pares.append(("Saldo após esta entrada", f"R$ {saldo_fmt}"))
    if condicoes:
        demons_pares.append(("Condições combinadas", condicoes))

    def _grid_kv(pares):
        if not pares:
            return (
                '<div class="demo-fallback">Primeiro pagamento referente ao '
                'contrato de fornecimento de materiais e prestação de serviços '
                'firmado com a Parket.</div>'
            )
        cells = "".join(
            f'<div class="kv"><span class="lbl">{k}</span>'
            f'<span class="val">{v}</span></div>'
            for k, v in pares
        )
        return f'<div class="demo-grid">{cells}</div>'

    demons_html = _grid_kv(demons_pares)
    # Instruções: cláusulas 1.4 e 1.5 do contrato Parket
    instrucoes_html = (
        "Não receber após o vencimento sem consulta ao beneficiário.<br>"
        "Após o vencimento: juros de 1% ao mês, correção pelo IGP-M/FGV "
        "e multa moratória de 10% sobre o valor do débito, conforme cláusula "
        "1.4 do contrato de fornecimento.<br>"
        "Dúvidas: entre em contato com o setor comercial da Parket antes do vencimento."
    )

    barcode = barcode_i25_svg(dados.get("codigo_barras", ""))

    css = """
    @page { size: A4; margin: 5mm 6mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #000; margin: 0; }
    .doc { display: flex; flex-direction: column; gap: 2mm; }
    .sec { border: 1px solid #000; }
    .sec .head {
        display: flex; align-items: center; gap: 6px;
        border-bottom: 1px solid #000; padding: 1px 5px; font-weight: 700;
    }
    .sec .head .banco {
        display: flex; align-items: center;
        border-right: 2px solid #000; padding-right: 6px;
    }
    .sec .head .banco svg { display: block; }
    .brand {
        display: flex; align-items: center; gap: 8px;
        padding: 2mm 5mm 1.5mm; border-bottom: 1px solid #000;
    }
    .brand svg { display: block; }
    .brand .kv { flex: 1; font-size: 8pt; line-height: 1.25; color: #333; }
    .brand .kv strong { color: #000; font-size: 9pt; }
    .sec .head .cod { font-family: "Courier New", monospace; font-size: 11pt;
        border-right: 1px solid #000; padding: 0 6px; }
    .sec .head .linha { flex: 1; font-family: "Courier New", monospace;
        font-size: 10pt; text-align: right; letter-spacing: .3px; }
    .grid { display: grid; grid-template-columns: repeat(12, 1fr); }
    .cell { border-right: 1px solid #000; border-bottom: 1px solid #000;
        padding: 2px 5px; min-height: 28px; overflow: hidden; }
    .cell:last-child { border-right: 0; }
    .cell .lbl { font-size: 6pt; color: #000; text-transform: uppercase; letter-spacing: .3px; }
    .cell .v { font-size: 9pt; font-weight: 600; margin-top: 1px; word-break: break-word; }
    .cell.big .v { font-size: 11pt; }
    .row { border-bottom: 1px solid #000; }
    .row:last-child { border-bottom: 0; }
    .col-12 { grid-column: span 12; }
    .col-9 { grid-column: span 9; }  /* faltava: sem ela a célula Pagador da
        ficha colapsava pra 1/12 e o nome quebrava letra a letra (Will 28/08) */
    .col-8 { grid-column: span 8; }
    .col-6 { grid-column: span 6; }
    .col-4 { grid-column: span 4; }
    .col-3 { grid-column: span 3; }
    .col-2 { grid-column: span 2; }
    .col-1 { grid-column: span 1; }
    .corte { border-top: 1px dashed #000; margin: 2mm 0; text-align: right;
        font-size: 7pt; color: #333; padding-top: 0.5mm; }
    .bar { padding: 2mm 5mm 1mm; }
    .bar svg { display: block; }
    .foot-inst { padding: 2.5mm 5mm; font-size: 8pt; line-height: 1.3; }
    .foot-inst strong.title { display: block; margin-bottom: 1.5mm;
        font-size: 8.5pt; text-transform: uppercase; letter-spacing: .3px; }
    .demons { padding: 2mm 5mm; font-size: 8pt; line-height: 1.3; }
    .demons strong.title { display: block; margin-bottom: 1mm; margin-top: 1.5mm;
        font-size: 8.5pt; text-transform: uppercase; letter-spacing: .3px; }
    .demons strong.title:first-child { margin-top: 0; }
    /* Grid KV compacto para o demonstrativo — 2 colunas em vez de linhas soltas */
    .demo-grid { display: grid; grid-template-columns: 1fr 1fr;
        gap: 1mm 6mm; }
    .demo-grid .kv { display: flex; flex-direction: column; padding: 1mm 0;
        border-bottom: 1px dotted #ccc; }
    .demo-grid .kv:nth-last-child(-n+2) { border-bottom: 0; }
    .demo-grid .kv .lbl { font-size: 6.5pt; text-transform: uppercase;
        letter-spacing: .3px; color: #555; }
    .demo-grid .kv .val { font-size: 9pt; font-weight: 600; color: #000; margin-top: 0.5mm; }
    .demo-fallback { font-size: 8pt; line-height: 1.35; }
    """

    # cabeçalho comum (banco 341 = Itaú; DAC 7 = calculado depois do 341-)
    head_html = (
        f'<div class="head">'
        f'<span class="banco">{_LOGO_ITAU}</span>'
        f'<span class="cod">341-7</span>'
        f'<span class="linha">{linha}</span>'
        f'</div>'
    )
    recibo_html = f"""
    <div class="sec">
      {head_html}
      <div class="grid row">
        <div class="cell col-8"><div class="lbl">Beneficiário</div>
          <div class="v">{benef_nome}{(' - CNPJ ' + benef_cnpj) if benef_cnpj else ''}</div>
          <div class="v" style="font-weight:400;font-size:8.5pt">{benef_end}</div></div>
        <div class="cell col-2"><div class="lbl">Agência/Código</div><div class="v">{agencia}</div></div>
        <div class="cell col-2"><div class="lbl">Nosso número</div><div class="v">{nosso_numero}</div></div>
      </div>
      <div class="grid row">
        <div class="cell col-8"><div class="lbl">Pagador</div>
          <div class="v">{pagador_nome}{(' - CPF ' + pagador_cpf) if pagador_cpf else ''}</div>
          <div class="v" style="font-weight:400;font-size:8.5pt">{pagador_end}</div></div>
        <div class="cell col-2"><div class="lbl">Vencimento</div><div class="v">{venc_fmt}</div></div>
        <div class="cell col-2 big"><div class="lbl">Valor do documento</div><div class="v">R$ {valor_fmt}</div></div>
      </div>
      <div class="foot-inst">
        <strong class="title">Recibo do Pagador</strong>
        {demons_html}
        <p style="margin:1.5mm 0 0;font-size:7.5pt;line-height:1.3">
          Guarde este comprovante junto ao contrato assinado eletronicamente. Após o pagamento
          confirmado, sua obra entra na agenda de produção.
        </p>
      </div>
    </div>
    """

    ficha_html = f"""
    <div class="sec">
      {head_html}
      <div class="grid row">
        <div class="cell col-6"><div class="lbl">Local de pagamento</div>
          <div class="v">Pagável em qualquer banco até o vencimento.</div></div>
        <div class="cell col-2"><div class="lbl">Vencimento</div><div class="v">{venc_fmt}</div></div>
        <div class="cell col-4"><div class="lbl">Beneficiário</div>
          <div class="v">{benef_nome}{(' - CNPJ ' + benef_cnpj) if benef_cnpj else ''}</div></div>
      </div>
      <div class="grid row">
        <div class="cell col-2"><div class="lbl">Data documento</div><div class="v">{emissao_fmt}</div></div>
        <div class="cell col-3"><div class="lbl">Nº documento</div><div class="v">{nosso_numero}</div></div>
        <div class="cell col-1"><div class="lbl">Espécie</div><div class="v">{especie}</div></div>
        <div class="cell col-1"><div class="lbl">Aceite</div><div class="v">N</div></div>
        <div class="cell col-2"><div class="lbl">Data processamento</div><div class="v">{emissao_fmt}</div></div>
        <div class="cell col-3"><div class="lbl">Nosso número</div><div class="v">{nosso_numero}</div></div>
      </div>
      <div class="grid row">
        <div class="cell col-2"><div class="lbl">Uso do banco</div><div class="v"></div></div>
        <div class="cell col-1"><div class="lbl">Carteira</div><div class="v">109</div></div>
        <div class="cell col-1"><div class="lbl">Espécie</div><div class="v">{especie}</div></div>
        <div class="cell col-3"><div class="lbl">Quantidade</div><div class="v"></div></div>
        <div class="cell col-2"><div class="lbl">(x) Valor</div><div class="v"></div></div>
        <div class="cell col-3 big"><div class="lbl">(=) Valor documento</div><div class="v">R$ {valor_fmt}</div></div>
      </div>
      <div class="demons">
        <strong class="title">Demonstrativo</strong>
        {demons_html}
        <strong class="title">Instruções</strong>
        <div style="font-size:7.5pt;line-height:1.35">{instrucoes_html}</div>
      </div>
      <div class="grid row">
        <div class="cell col-9"><div class="lbl">Pagador</div>
          <div class="v">{pagador_nome}{(' - CPF ' + pagador_cpf) if pagador_cpf else ''}</div>
          <div class="v" style="font-weight:400;font-size:8.5pt">{pagador_end}</div></div>
        <div class="cell col-3"><div class="lbl">Autenticação mecânica</div><div class="v"></div></div>
      </div>
      <div class="bar">{barcode}</div>
    </div>
    """

    return (
        f'<!doctype html><html><head><meta charset="utf-8"><title>Boleto</title>'
        f'<style>{css}</style></head>'
        f'<body><div class="doc">{recibo_html}<div class="corte">✂ corte aqui</div>{ficha_html}</div></body></html>'
    )


# --- Beneficiário Parket (defaults do contrato ativo; overridável por env) -
# Extraído do contrato_clausulas.corpo_html (ativa=true): a razão social real
# emitente das notas é MUNDIAL EXPORT, "Parket" é a marca comercial.
def parket_beneficiario() -> dict:
    return {
        "beneficiario_nome": os.getenv(
            "PARKET_RAZAO_SOCIAL",
            "MUNDIAL EXPORT ASSESSORIA COMERCIO EXTERIOR IMPORTACAO E EXPORTACAO LTDA",
        ),
        "beneficiario_cnpj": os.getenv("PARKET_CNPJ", "29.872.616/0001-34"),
        "beneficiario_endereco": os.getenv(
            "PARKET_ENDERECO",
            "Av. Francisco Ferreira da Cruz, 6030, Galpão 93, Eucalipto, Fazenda Rio Grande/PR, CEP 83820-293",
        ),
        "agencia_codigo": os.getenv("PARKET_AGENCIA_CONTA", ""),
    }
