"""Gerador do TERMO/CONTRATO DE PRESTAÇÃO DE SERVIÇOS (modelo Parket 07/2026).
Preenche 1. DAS PARTES + 3. REMUNERAÇÃO (sem valores, só medidas) + assinaturas +
foto do prestador no final. Layout replica o PDF de referência (commit 01b516e)."""
from __future__ import annotations
import base64
import io
from dataclasses import dataclass
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image, HRFlowable,
)


MESES_PT = [
    "", "janeiro","fevereiro","março","abril","maio","junho",
    "julho","agosto","setembro","outubro","novembro","dezembro",
]


@dataclass
class ItemContrato:
    codigo: str      # "1.1", "2.3"
    ambiente: str
    medida: str      # "19,10" ou "1 UN"
    unidade: str = "m²"


@dataclass
class SecaoContrato:
    codigo: str      # "1.0"
    titulo: str      # "PISO CARVALHO EUROPEU NATURALLE - 9CM"
    itens: list[ItemContrato]


def _fmt_data() -> str:
    hoje = datetime.now()
    return f"São Paulo, {hoje.day:02d} de {MESES_PT[hoje.month]} de {hoje.year}."


def _b64_to_image(b64: str | None, max_w_mm: float, max_h_mm: float):
    if not b64:
        return None
    try:
        # Aceita data URL ou b64 puro
        raw = b64.split(",", 1)[1] if b64.startswith("data:") else b64
        buf = io.BytesIO(base64.b64decode(raw))
        return Image(buf, width=max_w_mm * mm, height=max_h_mm * mm, kind="proportional")
    except Exception:
        return None


def gerar_pdf_termo(
    dados_prestador: dict,
    cliente_obra: str | None,
    obra_endereco: str | None,
    secoes: list[SecaoContrato],
    assinatura_b64: str | None,
    foto_b64: str | None,
) -> bytes:
    """Renderiza o termo e devolve os bytes do PDF."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
        title=f"Contrato Prestação — {dados_prestador.get('nome','')}",
        author="PKT Serviços de Revestimentos LTDA",
    )
    dark = HexColor("#000000")
    header_fill = HexColor("#111111")

    st_h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=14, leading=17,
                            textColor=dark, spaceBefore=6, spaceAfter=8)
    st_h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11, leading=14,
                            textColor=dark, spaceBefore=10, spaceAfter=4)
    st_p = ParagraphStyle("p", fontName="Helvetica", fontSize=9.5, leading=13,
                           textColor=dark, alignment=TA_JUSTIFY, spaceAfter=3)
    st_li = ParagraphStyle("li", parent=st_p, leftIndent=10, spaceAfter=1, alignment=TA_LEFT)
    st_signline = ParagraphStyle("sig", fontName="Helvetica", fontSize=9, leading=11,
                                  textColor=dark, alignment=TA_CENTER)

    story: list = []

    # ═══ CAPA ═══
    story.append(Spacer(1, 60*mm))
    story.append(Paragraph(
        '<font size="36"><b>PARKET</b></font>',
        ParagraphStyle("capa", fontName="Helvetica-Bold", fontSize=36,
                        alignment=TA_LEFT, textColor=dark),
    ))
    story.append(PageBreak())

    # ═══ 1. DAS PARTES ═══
    story.append(Paragraph("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", st_h1))
    story.append(Paragraph("1. DAS PARTES", st_h2))
    story.append(Paragraph(
        "<b>PKT SERVIÇOS DE REVESTIMENTOS LTDA</b>, pessoa jurídica de direito privado, com sede na "
        "Rua Coronel Ottoni Maciel, nº 373, Sala 53, Bairro Vila Izabel, Curitiba/PR, CEP 80320-000, "
        "inscrita no CNPJ nº 22.951.220/0001-33, doravante denominada <b>EMPRESA</b>;", st_p))
    nome = dados_prestador.get("nome") or "________________________"
    cnpj = dados_prestador.get("cnpj_cpf") or "________________________"
    endereco = dados_prestador.get("endereco") or "________________________"
    story.append(Paragraph(
        f"<b>{nome}</b>, inscrito no CNPJ/CPF nº <b>{cnpj}</b>, residente em <b>{endereco}</b>, "
        "doravante denominado <b>PRESTADOR DE SERVIÇOS</b>.", st_p))
    story.append(Paragraph(
        "As partes resolvem firmar o presente Contrato de Prestação de Serviços, "
        "que será regido pelas cláusulas abaixo.", st_p))

    # ═══ 2. OBJETO ═══
    story.append(Paragraph("2. OBJETO", st_h2))
    story.append(Paragraph(
        "O presente contrato tem como objeto a instalação de produtos comercializados pela EMPRESA, "
        "conforme especificações, valores e prazos. O PRESTADOR declara conhecer as características "
        "técnicas dos produtos e se compromete a realizar as instalações conforme as orientações da EMPRESA.",
        st_p))

    # ═══ 3. REMUNERAÇÃO — só medidas ═══
    story.append(Paragraph("3. REMUNERAÇÃO", st_h2))
    if cliente_obra:
        story.append(Paragraph(f"Obra: <b>{cliente_obra}</b>"
                                 + (f" — {obra_endereco}" if obra_endereco else ""), st_p))
    story.append(Paragraph("Segue relação de itens/ambientes contratados:", st_p))

    for sec in secoes:
        header_row = [Paragraph(
            f"<font color='white'><b>ITEM {sec.codigo} {sec.titulo}</b></font>", st_p)]
        col_data = [
            header_row,
            [Paragraph("<b>ITEM</b>", st_p),
             Paragraph("<b>AMBIENTE</b>", st_p),
             Paragraph(f"<b>{sec.itens[0].unidade if sec.itens else 'M²'}</b>", st_p)],
        ]
        for it in sec.itens:
            col_data.append([
                Paragraph(it.codigo, st_p),
                Paragraph(it.ambiente, st_p),
                Paragraph(it.medida, st_p),
            ])
        tbl = Table(col_data, colWidths=[20*mm, 115*mm, 35*mm], hAlign="LEFT")
        # 1ª linha = header preto ocupando todas as 3 colunas
        tbl.setStyle(TableStyle([
            ("SPAN", (0,0), (2,0)),
            ("BACKGROUND", (0,0), (2,0), header_fill),
            ("TEXTCOLOR", (0,0), (2,0), white),
            ("BOX", (0,0), (-1,-1), 0.5, dark),
            ("INNERGRID", (0,1), (-1,-1), 0.3, HexColor("#888888")),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ]))
        story.append(KeepTogether([tbl, Spacer(1, 6)]))

    # Regras de pagamento (sem valor total — só regras)
    story.append(Spacer(1, 4))
    story.append(Paragraph("Os pagamentos serão realizados da seguinte forma:", st_p))
    story.append(Paragraph("• Serviços concluídos até o dia 10: pagamento no dia 15 do mesmo mês.", st_li))
    story.append(Paragraph("• Serviços concluídos até o dia 25: pagamento no dia 30 do mesmo mês.", st_li))
    story.append(Paragraph(
        "As medições terão uma retenção de 25% que será paga ao final da obra com o termo de entrega "
        "assinado pelo cliente.", st_p))
    story.append(Paragraph("O pagamento será efetuado mediante:", st_p))
    for li in ("envio de medições", "registro fotográfico da obra", "aprovação da EMPRESA e do CLIENTE."):
        story.append(Paragraph(f"• {li}", st_li))
    story.append(Paragraph(
        "O PRESTADOR não poderá cobrar diretamente qualquer valor do cliente final, sendo essa "
        "responsabilidade exclusiva da EMPRESA.", st_p))

    # ═══ 4-13 ═══
    story.append(Paragraph("4. ÁREA DE ATUAÇÃO", st_h2))
    story.append(Paragraph(
        "O PRESTADOR poderá executar serviços em todo território nacional ou internacional, sem "
        "exclusividade. Qualquer alteração no projeto ou no escopo do serviço deverá ser previamente "
        "autorizada pela EMPRESA, mesmo que solicitada pelo cliente final.", st_p))

    story.append(Paragraph("5. EXECUÇÃO DOS SERVIÇOS", st_h2))
    story.append(Paragraph("O PRESTADOR deverá:", st_p))
    for li in (
        "executar os serviços conforme especificações técnicas fornecidas pela EMPRESA;",
        "utilizar ferramentas adequadas e equipamentos de segurança necessários;",
        "manter comunicação constante sobre o andamento dos serviços;",
        "informar imediatamente qualquer irregularidade que possa comprometer a qualidade da instalação.",
    ):
        story.append(Paragraph(f"• {li}", st_li))

    story.append(Paragraph("6. DAS OBRIGAÇÕES DO PRESTADOR", st_h2))
    story.append(Paragraph("São obrigações do PRESTADOR:", st_p))
    for li in (
        "manter sua empresa regularizada perante órgãos fiscais e tributários;",
        "utilizar uniformes e EPIs obrigatórios durante a execução dos serviços;",
        "preservar a imagem e reputação da EMPRESA;",
        "manter sigilo sobre informações comerciais, estratégicas e valores praticados pela EMPRESA;",
        "comunicar eventuais reclamações ou problemas identificados durante a execução das obras.",
    ):
        story.append(Paragraph(f"• {li}", st_li))

    story.append(Paragraph("7. PRAZO", st_h2))
    story.append(Paragraph(
        "O presente contrato terá vigência conforme os prazos estabelecidos pela empresa, iniciando-se "
        "na data de sua assinatura. Caso haja necessidade de prorrogação do prazo por motivos não "
        "atribuíveis à EMPRESA ou ao PRESTADOR, poderá ser firmado termo aditivo entre as partes. "
        "Situações de força maior, como:", st_p))
    for li in ("Impedimentos de acesso à obra;", "Decisões judiciais;",
                "Manifestações ou paralisações;", "Condições climáticas severas;"):
        story.append(Paragraph(f"• {li}", st_li))
    story.append(Paragraph("não gerarão penalidades para nenhuma das partes.", st_p))

    story.append(Paragraph("8. DOS PRODUTOS E PROCEDIMENTOS", st_h2))
    story.append(Paragraph("O PRESTADOR deverá seguir rigorosamente:", st_p))
    for li in ("as instruções de instalação fornecidas pela EMPRESA;",
                "os prazos estabelecidos;",
                "as orientações técnicas e de segurança."):
        story.append(Paragraph(f"• {li}", st_li))
    story.append(Paragraph(
        "Não é permitido conceder descontos, prorrogações ou alterações comerciais sem autorização "
        "da EMPRESA.", st_p))

    story.append(Paragraph("9. PENALIDADES", st_h2))
    story.append(Paragraph(
        "O descumprimento dos prazos ou das condições estabelecidas poderá resultar na retenção de "
        "até 30% do valor do serviço, a título de penalidade contratual. Caso os prejuízos superem "
        "esse valor, a EMPRESA poderá buscar ressarcimento por vias legais.", st_p))

    story.append(Paragraph("10. DA GARANTIA", st_h2))
    story.append(Paragraph(
        "O PRESTADOR concede garantia de 12 (doze) meses sobre os serviços executados, contados a "
        "partir da entrega e aprovação final da instalação.", st_p))

    story.append(Paragraph("11. RELAÇÃO", st_h2))
    story.append(Paragraph(
        "O presente contrato estabelece relação de prestação de serviços autônoma, não gerando "
        "vínculo empregatício entre as partes.", st_p))

    story.append(Paragraph("12. CESSÃO", st_h2))
    story.append(Paragraph(
        "Este contrato não poderá ser transferido ou cedido a terceiros sem autorização prévia "
        "e por escrito da outra parte.", st_p))

    story.append(Paragraph("13. ALTERAÇÕES", st_h2))
    story.append(Paragraph(
        "Qualquer alteração deste contrato somente terá validade se formalizada por aditivo "
        "contratual assinado pelas partes.", st_p))

    # ═══ 14. ASSINATURAS ═══
    story.append(Paragraph("14. ASSINATURAS", st_h2))
    story.append(Paragraph(
        "E por estarem de acordo, as partes assinam o presente contrato em duas vias de igual teor.", st_p))
    story.append(Spacer(1, 6))
    story.append(Paragraph(_fmt_data(), st_p))

    # Assinatura PKT (linha vazia)
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width=90*mm, thickness=0.6, color=black, hAlign="CENTER"))
    story.append(Paragraph("PKT SERVIÇOS DE REVESTIMENTOS LTDA", st_signline))

    # Assinatura PRESTADOR — se tem imagem, embute em cima da linha
    story.append(Spacer(1, 22))
    ass_img = _b64_to_image(assinatura_b64, max_w_mm=70, max_h_mm=20)
    if ass_img is not None:
        ass_img.hAlign = "CENTER"
        story.append(ass_img)
    story.append(HRFlowable(width=90*mm, thickness=0.6, color=black, hAlign="CENTER"))
    story.append(Paragraph(f"PRESTADOR DE SERVIÇOS<br/><b>{nome}</b>", st_signline))

    # ═══ Anexo: EPIs + Ferramentas ═══
    story.append(PageBreak())
    story.append(Paragraph("USO DE UNIFORMES E EPIs", st_h1))
    story.append(Paragraph(
        "O PRESTADOR declara estar ciente da obrigatoriedade do uso de uniforme e Equipamentos de "
        "Proteção Individual (EPIs) durante toda a execução dos serviços.", st_p))
    story.append(Paragraph("EPIs obrigatórios:", st_p))
    for epi in ("Luvas","Calçados de segurança","Protetor auditivo",
                 "Óculos de segurança","Respirador semifacial com filtro","Capacete"):
        story.append(Paragraph(f"• {epi}", st_li))

    story.append(Paragraph("FERRAMENTAS OBRIGATÓRIAS", st_h1))
    story.append(Paragraph(
        "O PRESTADOR declara possuir as seguintes ferramentas para execução dos serviços:", st_p))
    for f in ("Martelo de borracha","Nível","Formão","Serra tico-tico","Serra circular",
                "Serra de bancada","Meia esquadria","Parafusadeira","Furadeira","Compressor",
                "Pinador","Plaina","Esmerilhadeira","Martelete"):
        story.append(Paragraph(f"• {f}", st_li))

    # ═══ Anexo: Foto do prestador (registro visual) ═══
    if foto_b64:
        story.append(PageBreak())
        story.append(Paragraph("REGISTRO DO PRESTADOR", st_h1))
        story.append(Paragraph(
            f"Registro fotográfico apresentado no momento do aceite deste termo por <b>{nome}</b>.", st_p))
        story.append(Spacer(1, 8))
        img = _b64_to_image(foto_b64, max_w_mm=120, max_h_mm=160)
        if img is not None:
            img.hAlign = "CENTER"
            story.append(img)

    doc.build(story)
    return buf.getvalue()


def snapshot_para_secoes(itens_snapshot: list[dict]) -> list[SecaoContrato]:
    """Converte itens_snapshot (payload salvo em prestador_termos) para SecaoContrato agrupada por categoria_raiz."""
    grupos: dict[str, list[dict]] = {}
    for it in itens_snapshot:
        chave = str(it.get("categoria_raiz") or it.get("categoria") or "OUTROS").upper()
        grupos.setdefault(chave, []).append(it)

    secoes: list[SecaoContrato] = []
    for idx, (raiz, itens) in enumerate(grupos.items(), start=1):
        primeiro = itens[0]
        produto = primeiro.get("produto_header") or raiz
        # header: "1.0 PISO CARVALHO EUROPEU..."
        titulo = f"{produto}"
        secoes_itens = []
        for jdx, it in enumerate(itens, start=1):
            cod = it.get("codigo") or f"{idx}.{jdx}"
            ambiente = (it.get("ambiente") or "").strip() or "—"
            qtd = it.get("quantidade")
            unidade = it.get("unidade") or "m²"
            if qtd is None:
                medida = "—"
            else:
                q = float(qtd)
                medida = f"{q:.2f}".replace(".", ",").rstrip("0").rstrip(",") if q else "0"
                if not medida:
                    medida = "0"
            secoes_itens.append(ItemContrato(codigo=cod, ambiente=ambiente, medida=medida, unidade=unidade))
        secoes.append(SecaoContrato(codigo=f"{idx}.0", titulo=titulo.upper(), itens=secoes_itens))
    return secoes
