"""parket-gestao — PDF da Ordem de Pagamento a Terceiro (OPT).

O QUE FAZ:
  Renderiza a ordem de pagamento de um custo_lancamento em PDF A4 pra o
  financeiro anexar no processo de pagamento. Uma pagina (ou mais se a
  lista de despesas estourar): cabecalho PARKET + numero OPT, dados da
  obra, dados bancarios do terceiro, despesas agrupadas por categoria
  (glosadas riscadas com motivo), totais e trilha de aprovacao.

  Segue o padrao reportlab de termo_pdf.py (SimpleDocTemplate A4,
  Helvetica, io.BytesIO -> bytes). Nenhum calculo acontece aqui: os
  valores chegam prontos em centavos do custos.py, este modulo so formata.
"""
from __future__ import annotations
import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

# Mesmos rotulos da tela (CustosTerceiros.tsx) pra o PDF falar a lingua do app.
ROTULO_SUBCAT = {
    "combustivel_km": "Combustível por km",
    "reembolso_km": "Reembolso por km",
    "abastecimento": "Abastecimento",
    "pedagio": "Pedágio",
    "passagem": "Passagem",
    "aluguel_carro": "Aluguel de carro",
    "uber": "Uber",
    "taxi": "Táxi",
    "estacionamento": "Estacionamento",
    "hospedagem": "Hospedagem",
    "alimentacao": "Alimentação",
    "diaria_fechada": "Diária fechada",
    "nf": "Nota fiscal",
    "rpa": "RPA",
}
ROTULO_CAT = {
    "deslocamento": "Deslocamento",
    "estadia": "Estadia",
    "documentacao": "Documentação",
}


def _brl(cent) -> str:
    """Centavos int -> 'R$ 1.234,56' (formato brasileiro)."""
    v = int(cent or 0)
    inteiro, resto = divmod(abs(v), 100)
    txt = f"{inteiro:,}".replace(",", ".")
    sinal = "-" if v < 0 else ""
    return f"{sinal}R$ {txt},{resto:02d}"


def _data_br(v) -> str:
    """date/datetime/ISO-string -> dd/mm/aaaa; vazio se None."""
    if not v:
        return ""
    s = str(v)[:10]
    try:
        return datetime.strptime(s, "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return s


def gerar_op_pdf(lanc: dict, despesas: list, prestador: dict, pendencias: list) -> bytes:
    """Monta a OPT e devolve os bytes do PDF.

    lanc      = linha de _lancamento() (ja tem cliente/endereco do projeto)
    despesas  = linhas de custo_despesa do lancamento
    prestador = ficha de _prestador() (Cloud); {} se nao encontrado
    pendencias= lista de strings do detalhe (ficha incompleta etc.)
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=16*mm, bottomMargin=16*mm,
        title=f"Ordem de Pagamento {lanc.get('numero','')}",
        author="PKT Serviços de Revestimentos LTDA",
    )
    dark = HexColor("#111111")
    cinza = HexColor("#666666")
    linha_cor = HexColor("#d9d9d9")
    zebra = HexColor("#f5f5f5")

    st_marca = ParagraphStyle("marca", fontName="Helvetica-Bold", fontSize=20,
                              leading=24, textColor=dark)
    st_titulo = ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=12,
                               leading=15, textColor=dark, alignment=TA_RIGHT)
    st_h = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=10, leading=13,
                          textColor=dark, spaceBefore=8, spaceAfter=3)
    st_p = ParagraphStyle("p", fontName="Helvetica", fontSize=9, leading=12.5,
                          textColor=dark, alignment=TA_LEFT)
    st_mini = ParagraphStyle("mini", fontName="Helvetica", fontSize=7.5, leading=10,
                             textColor=cinza)
    st_cel = ParagraphStyle("cel", fontName="Helvetica", fontSize=8.5, leading=11,
                            textColor=dark)
    st_cel_dir = ParagraphStyle("celdir", parent=st_cel, alignment=TA_RIGHT)
    st_glosa = ParagraphStyle("glosa", parent=st_cel, textColor=cinza)
    st_tot = ParagraphStyle("tot", fontName="Helvetica-Bold", fontSize=10,
                            leading=13, textColor=dark, alignment=TA_RIGHT)

    story: list = []

    # ═══ Cabecalho: marca a esquerda, numero da OP a direita ═══
    numero = lanc.get("numero") or ""
    status = (lanc.get("status") or "").upper()
    cab = Table(
        [[Paragraph("PARKET", st_marca),
          Paragraph(f"ORDEM DE PAGAMENTO<br/><font size=16>{numero}</font>"
                    f"<br/><font size=8 color='#666666'>{status}</font>", st_titulo)]],
        colWidths=[90*mm, 84*mm])
    cab.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(cab)
    story.append(Spacer(1, 3*mm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=dark))

    # ═══ Obra + periodo (duas colunas de fatos) ═══
    def fato(rotulo: str, valor) -> Paragraph:
        return Paragraph(
            f"<font size=7 color='#666666'>{rotulo}</font><br/>{valor or '-'}", st_p)

    periodo = " a ".join(x for x in (_data_br(lanc.get("data_ida")),
                                     _data_br(lanc.get("data_volta"))) if x) or None
    obra = Table([
        [fato("OBRA", lanc.get("cliente")), fato("PERÍODO", periodo)],
        [fato("ENDEREÇO", lanc.get("endereco")), fato("MOTIVO", lanc.get("motivo"))],
        [fato("CENTRO DE CUSTO", lanc.get("centro_custo_nome")),
         fato("PROPOSTA", lanc.get("numero_proposta"))],
    ], colWidths=[104*mm, 70*mm])
    obra.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(Spacer(1, 2*mm))
    story.append(obra)

    # ═══ Favorecido (dados de pagamento do terceiro) ═══
    story.append(Paragraph("FAVORECIDO", st_h))
    doc_prest = (prestador.get("cnpj") or prestador.get("cpf") or "").strip() or None
    banco_bits = [x for x in (
        prestador.get("banco"),
        f"ag. {prestador['agencia']}" if prestador.get("agencia") else None,
        f"conta {prestador['conta']}" if prestador.get("conta") else None,
        prestador.get("conta_tipo"),
    ) if x]
    titular_bits = [x for x in (prestador.get("titular"),
                                prestador.get("titular_documento")) if x]
    fav = Table([
        [fato("NOME", lanc.get("prestador_nome") or prestador.get("nome")),
         fato("CPF / CNPJ", doc_prest)],
        [fato("CHAVE PIX", prestador.get("pix_chave")),
         fato("BANCO", " · ".join(banco_bits) or None)],
        [fato("TITULAR", " · ".join(titular_bits) or None),
         fato("TELEFONE", prestador.get("telefone"))],
    ], colWidths=[104*mm, 70*mm])
    fav.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(fav)

    if pendencias:
        story.append(Paragraph(
            "Pendências de cadastro: " + "; ".join(pendencias) + ".", st_mini))

    # ═══ Despesas agrupadas por categoria ═══
    story.append(Paragraph("DESPESAS", st_h))
    linhas = [[Paragraph(f"<b>{x}</b>", st_cel) for x in
               ("Data", "Item", "Descrição", "Qtd", "Unitário", "Total")]]
    estilo = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, dark),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]
    idx = 1
    for cat in ("deslocamento", "estadia", "documentacao"):
        grupo = [d for d in despesas if d.get("categoria") == cat]
        if not grupo:
            continue
        # Linha de titulo da categoria com o subtotal aprovado dela.
        sub = sum(int(d.get("valor_total_cent") or 0) for d in grupo
                  if d.get("status") != "glosado")
        linhas.append([Paragraph(f"<b>{ROTULO_CAT[cat]}</b>", st_cel), "", "", "", "",
                       Paragraph(f"<b>{_brl(sub)}</b>", st_cel_dir)])
        estilo += [("SPAN", (0, idx), (4, idx)),
                   ("BACKGROUND", (0, idx), (-1, idx), zebra),
                   ("LINEABOVE", (0, idx), (-1, idx), 0.4, linha_cor)]
        idx += 1
        for d in grupo:
            glosada = d.get("status") == "glosado"
            st_lin = st_glosa if glosada else st_cel
            st_dir = ParagraphStyle("d", parent=st_lin, alignment=TA_RIGHT)
            item = ROTULO_SUBCAT.get(d.get("subcategoria"), d.get("subcategoria") or "")
            desc = d.get("descricao") or ""
            if glosada:
                # Riscada + motivo: o favorecido ve o que foi cortado e por que.
                item = f"<strike>{item}</strike>"
                motivo = d.get("glosa_motivo") or "sem motivo registrado"
                desc = f"<strike>{desc}</strike> <font size=7>GLOSADA: {motivo}</font>" \
                       if desc else f"<font size=7>GLOSADA: {motivo}</font>"
            # numeric(12,3) chega como Decimal; "340.000" vira "340", "2.5" vira "2,5".
            qtd = d.get("quantidade")
            try:
                qtd_txt = f"{float(qtd):g}".replace(".", ",") if qtd is not None else ""
            except (TypeError, ValueError):
                qtd_txt = str(qtd or "")
            linhas.append([
                Paragraph(_data_br(d.get("data")), st_lin),
                Paragraph(item, st_lin),
                Paragraph(desc, st_lin),
                Paragraph(qtd_txt, st_dir),
                Paragraph(_brl(d.get("valor_unitario_cent")), st_dir),
                Paragraph(_brl(d.get("valor_total_cent")) if not glosada
                          else f"<strike>{_brl(d.get('valor_total_cent'))}</strike>", st_dir),
            ])
            idx += 1
    if idx == 1:
        linhas.append([Paragraph("Nenhuma despesa lançada.", st_cel), "", "", "", "", ""])
        estilo.append(("SPAN", (0, 1), (-1, 1)))
    tab = Table(linhas, colWidths=[18*mm, 34*mm, 66*mm, 12*mm, 22*mm, 22*mm],
                repeatRows=1)
    tab.setStyle(TableStyle(estilo))
    story.append(tab)
    story.append(HRFlowable(width="100%", thickness=0.4, color=linha_cor))

    # ═══ Totais ═══
    story.append(Spacer(1, 2*mm))
    tot = Table([
        ["", Paragraph("Total aprovado", st_cel_dir),
         Paragraph(_brl(lanc.get("total_aprovado_cent")), st_cel_dir)],
        ["", Paragraph("Adiantamento", st_cel_dir),
         Paragraph("- " + _brl(lanc.get("adiantamento_cent")), st_cel_dir)],
        ["", Paragraph("<b>SALDO A PAGAR</b>", st_tot),
         Paragraph(f"<b>{_brl(lanc.get('saldo_cent'))}</b>", st_tot)],
    ], colWidths=[104*mm, 40*mm, 30*mm])
    tot.setStyle(TableStyle([
        ("LINEABOVE", (1, 2), (-1, 2), 0.8, dark),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(tot)

    # ═══ Trilha: quem aprovou/pagou e quando ═══
    trilha = []
    if lanc.get("aprovado_por"):
        trilha.append(f"Aprovado por {lanc['aprovado_por']}"
                      + (f" em {_data_br(lanc.get('aprovado_em'))}" if lanc.get("aprovado_em") else ""))
    if lanc.get("pago_por"):
        trilha.append(f"Pago por {lanc['pago_por']}"
                      + (f" em {_data_br(lanc.get('pago_em'))}" if lanc.get("pago_em") else ""))
    trilha.append(f"Lançado por {lanc.get('criado_por') or '-'}")
    trilha.append("Emitido em " + datetime.now().strftime("%d/%m/%Y %H:%M"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(" · ".join(trilha), st_mini))
    story.append(Paragraph(
        "PKT Serviços de Revestimentos LTDA · CNPJ 22.951.220/0001-33", st_mini))

    doc.build(story)
    return buf.getvalue()
