"""Gerador do PDF do CONTRATO GERAL de prestacao de servicos (F2, #1986).

Diferente do termo_pdf.py (termo por obra, layout fixo em codigo), aqui o
texto vem do catalogo versionado prestador_contratos.conteudo_md (markdown
simples: "## N. TITULO" abre clausula, "- " abre bullet, **negrito**).
O QUE o PDF monta: capa + clausulas renderizadas do markdown com os
placeholders das partes substituidos + pagina de REGISTRO DE ASSINATURA
ELETRONICA (selfie, assinatura, hash SHA-256, OTP, IP, user agent), que e
a prova do aceite nos moldes da MP 2.200-2/2001 e da Lei 14.063/2020.
"""
from __future__ import annotations
import base64
import io
import re
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable,
)

MESES_PT = [
    "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


def _b64_to_image(b64: str | None, max_w_mm: float, max_h_mm: float):
    """Aceita data URL ou b64 puro; devolve Image proporcional ou None."""
    if not b64:
        return None
    try:
        raw = b64.split(",", 1)[1] if b64.startswith("data:") else b64
        buf = io.BytesIO(base64.b64decode(raw))
        return Image(buf, width=max_w_mm * mm, height=max_h_mm * mm, kind="proportional")
    except Exception:
        return None


def _md_inline(texto: str) -> str:
    """Converte o inline do markdown pro mini-HTML do reportlab.
    So negrito (**x**) + escape de & < > (o texto e nosso, mas dados do
    prestador entram via placeholder e podem ter & etc)."""
    t = texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)


def _aplicar_placeholders(md: str, dados_prestador: dict) -> str:
    """Substitui {{PRESTADOR_*}} pelos dados preenchidos no aceite."""
    vazio = "________________________"
    return (md
            .replace("{{PRESTADOR_NOME}}", dados_prestador.get("nome") or vazio)
            .replace("{{PRESTADOR_CPF_CNPJ}}", dados_prestador.get("cnpj_cpf") or vazio)
            .replace("{{PRESTADOR_ENDERECO}}", dados_prestador.get("endereco") or vazio))


def gerar_pdf_contrato_geral(
    conteudo_md: str,
    versao: int,
    dados_prestador: dict,
    assinatura_b64: str | None,
    selfie_b64: str | None,
    trilha: dict,
) -> bytes:
    """Renderiza o contrato geral + pagina de registro eletronico.

    trilha: {aceite_id, telefone_validado, whatsapp_validado_em, selfie_hash,
             aceite_ip, aceite_user_agent, aceito_em, otp_id}
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"Contrato Geral de Prestacao de Servicos v{versao} — {dados_prestador.get('nome', '')}",
        author="PKT Serviços de Revestimentos LTDA",
    )
    dark = HexColor("#000000")
    st_h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=14, leading=17,
                           textColor=dark, spaceBefore=6, spaceAfter=8)
    st_h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11, leading=14,
                           textColor=dark, spaceBefore=10, spaceAfter=4)
    st_p = ParagraphStyle("p", fontName="Helvetica", fontSize=9.5, leading=13,
                          textColor=dark, alignment=TA_JUSTIFY, spaceAfter=3)
    st_li = ParagraphStyle("li", parent=st_p, leftIndent=10, spaceAfter=1, alignment=TA_LEFT)
    st_sig = ParagraphStyle("sig", fontName="Helvetica", fontSize=9, leading=11,
                            textColor=dark, alignment=TA_CENTER)
    st_meta = ParagraphStyle("meta", parent=st_p, fontSize=8.5, leading=11)

    story: list = []

    # ═══ CAPA ═══
    story.append(Spacer(1, 60 * mm))
    story.append(Paragraph('<font size="36"><b>PARKET</b></font>',
                           ParagraphStyle("capa", fontName="Helvetica-Bold", fontSize=36,
                                          alignment=TA_LEFT, textColor=dark)))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(f"Contrato Geral de Prestação de Serviços · versão {versao}",
                           ParagraphStyle("sub", fontName="Helvetica", fontSize=12, textColor=dark)))
    story.append(PageBreak())

    # ═══ CLAUSULAS a partir do markdown do catalogo ═══
    story.append(Paragraph("CONTRATO GERAL DE PRESTAÇÃO DE SERVIÇOS", st_h1))
    md = _aplicar_placeholders(conteudo_md or "", dados_prestador or {})
    for linha in md.split("\n"):
        raw = linha.strip()
        if not raw:
            continue
        if raw.startswith("## "):
            story.append(Paragraph(_md_inline(raw[3:]), st_h2))
        elif raw.startswith("- "):
            story.append(Paragraph("• " + _md_inline(raw[2:]), st_li))
        else:
            story.append(Paragraph(_md_inline(raw), st_p))

    # ═══ Data + assinaturas ═══
    hoje = datetime.now()
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Curitiba, {hoje.day:02d} de {MESES_PT[hoje.month]} de {hoje.year}.", st_p))
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width=90 * mm, thickness=0.6, color=black, hAlign="CENTER"))
    story.append(Paragraph("PKT SERVIÇOS DE REVESTIMENTOS LTDA", st_sig))
    story.append(Spacer(1, 22))
    ass_img = _b64_to_image(assinatura_b64, max_w_mm=70, max_h_mm=20)
    if ass_img is not None:
        ass_img.hAlign = "CENTER"
        story.append(ass_img)
    story.append(HRFlowable(width=90 * mm, thickness=0.6, color=black, hAlign="CENTER"))
    nome = dados_prestador.get("nome") or "________________________"
    story.append(Paragraph(f"PRESTADOR DE SERVIÇOS<br/><b>{nome}</b>", st_sig))

    # ═══ REGISTRO DE ASSINATURA ELETRONICA (trilha de auditoria) ═══
    story.append(PageBreak())
    story.append(Paragraph("REGISTRO DE ASSINATURA ELETRÔNICA", st_h1))
    story.append(Paragraph(
        "Aceite eletrônico realizado nos termos do art. 10, parágrafo 2º, da MP 2.200-2/2001 "
        "e da Lei 14.063/2020, com os seguintes registros de autenticidade:", st_p))
    story.append(Spacer(1, 4))

    def _fmt(v):
        return str(v) if v not in (None, "") else "-"

    linhas = [
        ("Identificador do aceite", _fmt(trilha.get("aceite_id"))),
        ("Versão dos termos", f"v{versao}"),
        ("Prestador", _fmt(dados_prestador.get("nome"))),
        ("CPF/CNPJ", _fmt(dados_prestador.get("cnpj_cpf"))),
        ("WhatsApp validado por código", _fmt(trilha.get("telefone_validado"))),
        ("Validação do WhatsApp em", _fmt(trilha.get("whatsapp_validado_em"))),
        ("Código de verificação (id)", _fmt(trilha.get("otp_id"))),
        ("Hash SHA-256 do registro facial", _fmt(trilha.get("selfie_hash"))),
        ("Endereço IP do aceite", _fmt(trilha.get("aceite_ip"))),
        ("Dispositivo (user agent)", _fmt(trilha.get("aceite_user_agent"))),
        ("Data e hora do aceite", _fmt(trilha.get("aceito_em"))),
    ]
    tbl = Table([[Paragraph(f"<b>{k}</b>", st_meta), Paragraph(_md_inline(_fmt(v)), st_meta)]
                 for k, v in linhas],
                colWidths=[55 * mm, 115 * mm], hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, dark),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, HexColor("#888888")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl)

    # Selfie do ato do aceite (validacao facial nivel A)
    if selfie_b64:
        story.append(Spacer(1, 10))
        story.append(Paragraph("Registro facial apresentado no momento do aceite:", st_p))
        img = _b64_to_image(selfie_b64, max_w_mm=90, max_h_mm=120)
        if img is not None:
            img.hAlign = "CENTER"
            story.append(img)

    doc.build(story)
    return buf.getvalue()


def gerar_pdf_anexo_obra(
    versao_contrato: int,
    contrato_aceito_em: str | None,
    dados_prestador: dict,
    cliente_obra: str | None,
    obra_endereco: str | None,
    itens_snapshot: list[dict],
    trilha: dict,
    assinatura_b64: str | None = None,
    selfie_b64: str | None = None,
) -> bytes:
    """PDF do ANEXO DE OBRA (F4, #1988): adesao de uma obra ao contrato
    geral vigente do prestador via codigo WhatsApp no botao Iniciar.

    O QUE o anexo mostra (decisao Will 01/09): identificacao da obra +
    tabela SO com itens e metragem (NUNCA valores R$, que ficam no extrato
    Pagamentos do Instala) + registro da adesao eletronica (OTP, IP, data).
    NAO e um contrato novo: e adesao a clausula DA ADESAO DE OBRAS do
    contrato geral ja aceito, entao nao tem capa nem re-assinatura de punho.

    assinatura_b64 / selfie_b64 (Will 02/09): imagens HERDADAS do aceite do
    contrato geral (prestador_contrato_aceites.assinatura_url/selfie_url),
    reproduzidas aqui como identificacao visual do aderente. A prova juridica
    do anexo continua sendo o OTP; as imagens sao a mesma firma ja registrada.

    trilha: {anexo_id, contrato_aceite_id, telefone_validado,
             whatsapp_validado_em, otp_id, aceite_ip, aceite_user_agent,
             ativado_em}
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"Anexo de Obra · Contrato Geral v{versao_contrato} · {cliente_obra or ''}",
        author="PKT Serviços de Revestimentos LTDA",
    )
    dark = HexColor("#000000")
    st_h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=14, leading=17,
                           textColor=dark, spaceBefore=6, spaceAfter=8)
    st_h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11, leading=14,
                           textColor=dark, spaceBefore=10, spaceAfter=4)
    st_p = ParagraphStyle("p", fontName="Helvetica", fontSize=9.5, leading=13,
                          textColor=dark, alignment=TA_JUSTIFY, spaceAfter=3)
    st_meta = ParagraphStyle("meta", parent=st_p, fontSize=8.5, leading=11)
    st_cell = ParagraphStyle("cell", parent=st_p, fontSize=8.5, leading=11,
                             alignment=TA_LEFT, spaceAfter=0)
    st_sig = ParagraphStyle("sig", fontName="Helvetica", fontSize=9, leading=11,
                            textColor=dark, alignment=TA_CENTER)

    def _fmt(v):
        return str(v) if v not in (None, "") else "-"

    nome = dados_prestador.get("nome") or "-"

    story: list = []
    story.append(Paragraph("ANEXO DE OBRA", st_h1))
    story.append(Paragraph(
        f"Anexo ao Contrato Geral de Prestação de Serviços · versão {versao_contrato}",
        ParagraphStyle("sub", fontName="Helvetica", fontSize=10, textColor=dark, spaceAfter=8)))
    story.append(HRFlowable(width="100%", thickness=0.8, color=black))
    story.append(Spacer(1, 6))

    # Texto de adesao: referencia a clausula do contrato geral, sem repetir clausulas
    aceito_txt = f", aceito eletronicamente em {contrato_aceito_em}" if contrato_aceito_em else ""
    story.append(Paragraph(
        f"Pelo presente anexo, o prestador <b>{_md_inline(nome)}</b> "
        f"(CPF/CNPJ {_fmt(dados_prestador.get('cnpj_cpf'))}) adere à obra abaixo identificada, "
        f"nos termos da cláusula DA ADESÃO DE OBRAS do Contrato Geral de Prestação de Serviços "
        f"versão {versao_contrato}{aceito_txt}, assumindo a execução dos serviços relacionados "
        f"neste anexo com todas as responsabilidades, garantias e condições do contrato vigente.", st_p))
    story.append(Spacer(1, 6))

    # ═══ Identificacao da obra ═══
    story.append(Paragraph("IDENTIFICAÇÃO DA OBRA", st_h2))
    id_rows = [("Cliente / obra", _fmt(cliente_obra)), ("Endereço", _fmt(obra_endereco))]
    tbl_id = Table([[Paragraph(f"<b>{k}</b>", st_meta), Paragraph(_md_inline(_fmt(v)), st_meta)]
                    for k, v in id_rows],
                   colWidths=[45 * mm, 125 * mm], hAlign="LEFT")
    tbl_id.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, dark),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, HexColor("#888888")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl_id)

    # ═══ Servicos aderidos: SO item + metragem, sem R$ ═══
    story.append(Paragraph("SERVIÇOS OBJETO DESTE ANEXO", st_h2))
    cab = [Paragraph("<b>CÓD</b>", st_cell), Paragraph("<b>AMBIENTE</b>", st_cell),
           Paragraph("<b>SERVIÇO</b>", st_cell), Paragraph("<b>QTDE</b>", st_cell)]
    linhas_itens = [cab]
    total_m2 = 0.0
    for it in itens_snapshot or []:
        qtd = it.get("quantidade")
        unid = (it.get("unidade") or "m²").strip()
        if qtd is not None and unid.lower().startswith("m"):
            total_m2 += float(qtd)
        qtd_txt = f"{qtd:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + f" {unid}" \
            if qtd is not None else "-"
        servico = it.get("produto_header") or it.get("categoria_raiz") or it.get("descritivo") or "-"
        linhas_itens.append([
            Paragraph(_md_inline(_fmt(it.get("codigo"))), st_cell),
            Paragraph(_md_inline(_fmt(it.get("ambiente"))), st_cell),
            Paragraph(_md_inline(str(servico)), st_cell),
            Paragraph(qtd_txt, st_cell),
        ])
    tbl_it = Table(linhas_itens, colWidths=[16 * mm, 42 * mm, 82 * mm, 30 * mm], hAlign="LEFT")
    tbl_it.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, dark),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, HexColor("#888888")),
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#eeeeee")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(tbl_it)
    if total_m2 > 0:
        tot_txt = f"{total_m2:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        story.append(Spacer(1, 3))
        story.append(Paragraph(f"<b>Metragem total deste anexo: {tot_txt} m²</b>", st_p))

    # ═══ Assinatura herdada do aceite do contrato geral (Will 02/09) ═══
    # Mesmo traçado registrado no aceite eletronico: identifica visualmente o
    # aderente sem exigir nova firma (a prova do anexo e o OTP da trilha).
    ass_img = _b64_to_image(assinatura_b64, max_w_mm=70, max_h_mm=20)
    if ass_img is not None:
        story.append(Spacer(1, 18))
        ass_img.hAlign = "CENTER"
        story.append(ass_img)
        story.append(HRFlowable(width=90 * mm, thickness=0.6, color=black, hAlign="CENTER"))
        story.append(Paragraph(f"PRESTADOR DE SERVIÇOS<br/><b>{_md_inline(nome)}</b>", st_sig))
        story.append(Paragraph(
            f"Assinatura herdada do aceite eletrônico do Contrato Geral v{versao_contrato}"
            + (f" ({contrato_aceito_em})" if contrato_aceito_em else ""),
            ParagraphStyle("sigmeta", parent=st_sig, fontSize=7.5, leading=9,
                           textColor=HexColor("#555555"))))
        story.append(Spacer(1, 6))

    # ═══ Registro da adesao eletronica (prova: OTP + IP + data) ═══
    story.append(Paragraph("REGISTRO DA ADESÃO ELETRÔNICA", st_h2))
    story.append(Paragraph(
        "Adesão confirmada por código de verificação enviado ao WhatsApp do prestador, "
        "nos termos do art. 10, parágrafo 2º, da MP 2.200-2/2001 e da Lei 14.063/2020:", st_p))
    story.append(Spacer(1, 4))
    linhas = [
        ("Identificador do anexo", _fmt(trilha.get("anexo_id"))),
        ("Aceite do contrato geral", _fmt(trilha.get("contrato_aceite_id"))),
        ("Versão do contrato", f"v{versao_contrato}"),
        ("Prestador", _fmt(nome)),
        ("CPF/CNPJ", _fmt(dados_prestador.get("cnpj_cpf"))),
        ("WhatsApp validado por código", _fmt(trilha.get("telefone_validado"))),
        ("Validação do WhatsApp em", _fmt(trilha.get("whatsapp_validado_em"))),
        ("Código de verificação (id)", _fmt(trilha.get("otp_id"))),
        ("Endereço IP da adesão", _fmt(trilha.get("aceite_ip"))),
        ("Dispositivo (user agent)", _fmt(trilha.get("aceite_user_agent"))),
        ("Data e hora da adesão", _fmt(trilha.get("ativado_em"))),
    ]
    tbl = Table([[Paragraph(f"<b>{k}</b>", st_meta), Paragraph(_md_inline(_fmt(v)), st_meta)]
                 for k, v in linhas],
                colWidths=[55 * mm, 115 * mm], hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, dark),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, HexColor("#888888")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl)

    # Registro facial herdado do aceite do contrato geral (Will 02/09):
    # mesma selfie validada no aceite, reproduzida como identificacao visual.
    if selfie_b64:
        img = _b64_to_image(selfie_b64, max_w_mm=70, max_h_mm=90)
        if img is not None:
            story.append(Spacer(1, 10))
            story.append(Paragraph(
                f"Registro facial do prestador, herdado do aceite eletrônico do "
                f"Contrato Geral v{versao_contrato}:", st_p))
            img.hAlign = "CENTER"
            story.append(img)

    doc.build(story)
    return buf.getvalue()
