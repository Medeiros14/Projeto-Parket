import { BPWrap, BPSectionHeader, BPBody, BPSmall, BPLabel, BPDivider } from "./BPShared";

const cadeia = [
  { etapa: "01", titulo: "SELEÇÃO NA PEDREIRA", desc: "Visita presencial às pedreiras parceiras na região de Tivoli, Itália. Seleção por lote, com controle visual de tonalidade, veios e qualidade superficial." },
  { etapa: "02", titulo: "COMPRA E CONTRATO", desc: "Emissão de contrato de fornecimento. Definição de formatos, espessuras, acabamentos e volumes por lote. Inspeção antes do fechamento do contêiner." },
  { etapa: "03", titulo: "LOGÍSTICA INTERNACIONAL", desc: "Despacho marítimo, consolidação de carga e desembaraço aduaneiro. Parceiros especializados em importação de pedras naturais." },
  { etapa: "04", titulo: "RECEBIMENTO E ESTOQUE", desc: "Conferência física do lote ao chegar. Armazenagem em galpão próprio com identificação de lote, formato e disponibilidade em sistema." },
  { etapa: "05", titulo: "VENDA E ENTREGA", desc: "Atendimento direto a arquitetos, incorporadoras e construtoras. Entrega logística para obras em São Paulo e principais capitais." },
];

const acoes = [
  { tipo: "RELACIONAMENTO COM ESPECIFICADORES", desc: "Programa estruturado de visitas a escritórios de arquitetura. Apresentação de amostras físicas, book de projetos e condições comerciais. Meta: 5 novos especificadores por mês." },
  { tipo: "PRESENÇA DIGITAL", desc: "Site institucional, Instagram e LinkedIn com conteúdo técnico sobre travertino romano. Posicionamento como referência de conhecimento no segmento." },
  { tipo: "CATÁLOGO TÉCNICO", desc: "Catálogo físico e digital com especificações técnicas, laudos de qualidade, certificações de origem e fotografia profissional de cada lote." },
  { tipo: "ATENDIMENTO CONSULTIVO", desc: "Equipe de vendas treinada para atender arquitetos com linguagem técnica e estética. Amostras disponíveis para entrega. Visita ao showroom." },
  { tipo: "PARTICIPAÇÃO EM FEIRAS", desc: "Presença nas principais feiras do setor de arquitetura e construção: FIMMA, ABCasA, CASACOR. Fortalecimento de marca junto ao público especificador." },
  { tipo: "PARCERIAS ESTRATÉGICAS", desc: "Alianças com escritórios de arquitetura de referência, construtoras e incorporadoras para projetos de longa duração e fornecimento programado." },
];

export function BPOperacionalComercial() {
  return (
    <>
      {/* Modelo de Receita */}
      <BPWrap id="bp-receita" dark>
        <BPSectionHeader number="05" title="MODELO DE RECEITA" dark subtitle="6.1 — Como a Navona gera receita" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, marginBottom: 80 }} className="max-md:grid-cols-1">
          <div>
            <BPLabel dark>FONTES DE RECEITA</BPLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { fonte: "VENDA DE LADRILHOS", detalhe: "Venda por m² de peças cortadas em formato padrão. Principal volume da operação. Margens entre 40–60% sobre o custo CIF." },
                { fonte: "VENDA DE CHAPAS INTEIRAS", detalhe: "Venda de chapas para bancadas, marcenaria e revestimentos especiais. Ticket médio mais alto. Margem bruta superior." },
                { fonte: "VENDA PARA PROJETOS", detalhe: "Contratos de fornecimento para incorporadoras com volumes pré-definidos, prazos acordados e preço fixo por metro." },
              ].map((r) => (
                <div key={r.fonte} style={{ borderBottom: "1px solid rgba(216,211,199,0.08)", padding: "24px 0" }}>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.16em", color: "#D8D3C7", marginBottom: 10 }}>{r.fonte}</p>
                  <BPSmall dark>{r.detalhe}</BPSmall>
                </div>
              ))}
            </div>
          </div>
          <div>
            <BPLabel dark>MODELO COMERCIAL</BPLabel>
            <BPBody dark>
              Venda direta ao especificador (arquiteto, incorporadora, construtora) sem intermediários desnecessários.
              A Navona não atua em varejo de grande volume. O foco é em projetos de alto padrão com relacionamento de longo prazo.
            </BPBody>
            <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {[
                { label: "PRAZO MÉDIO", valor: "30–60 dias" },
                { label: "TICKET MÉDIO", valor: "R$ 500–800/m²" },
                { label: "VOLUME MÍNIMO", valor: "50 m² por pedido" },
                { label: "ENTREGA", valor: "SP e capitais" },
              ].map((m) => (
                <div key={m.label} style={{ backgroundColor: "rgba(216,211,199,0.04)", borderTop: "1px solid rgba(216,211,199,0.08)", padding: "24px 20px" }}>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 16, color: "#D8D3C7", marginBottom: 8 }}>{m.valor}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A" }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BPWrap>

      {/* Plano Operacional */}
      <BPWrap id="bp-operacional">
        <BPSectionHeader number="06" title="PLANO OPERACIONAL" subtitle="7.1 Cadeia de suprimentos · 7.4 Sistemas e processos" />

        <BPLabel>7.1 — CADEIA DE SUPRIMENTOS</BPLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 80 }}>
          {cadeia.map((c, i) => (
            <div
              key={c.etapa}
              style={{
                display: "grid",
                gridTemplateColumns: "48px 200px 1fr",
                gap: 32,
                borderBottom: "1px solid rgba(5,5,5,0.07)",
                padding: "28px 0",
                alignItems: "flex-start",
              }}
              className="max-md:grid-cols-1"
            >
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 20, color: "rgba(5,5,5,0.1)", fontWeight: 400 }}>{c.etapa}</p>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.16em", color: "#050505", paddingTop: 4 }}>{c.titulo}</p>
              <BPSmall>{c.desc}</BPSmall>
            </div>
          ))}
        </div>

        <BPDivider />

        <BPLabel>7.4 — SISTEMAS E PROCESSOS</BPLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }} className="max-md:grid-cols-1">
          {[
            { sistema: "GESTÃO DE ESTOQUE", desc: "Sistema de ERP com controle de lotes, formatos, disponibilidade e rastreabilidade de origem. Cada lote com identificação fotográfica." },
            { sistema: "CRM COMERCIAL", desc: "Gestão de relacionamento com arquitetos e especificadores. Histórico de projetos, pedidos, amostras e acompanhamento de pipeline." },
            { sistema: "GESTÃO FINANCEIRA", desc: "Controle de contas a pagar e receber, fluxo de caixa, câmbio e projeções. Integrado ao ERP para visibilidade completa da operação." },
          ].map((s) => (
            <div key={s.sistema} style={{ borderTop: "2px solid #050505", padding: "28px 0 28px" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.14em", color: "#050505", marginBottom: 16 }}>{s.sistema}</p>
              <BPSmall>{s.desc}</BPSmall>
            </div>
          ))}
        </div>
      </BPWrap>

      {/* Plano Comercial */}
      <BPWrap id="bp-comercial" dark>
        <BPSectionHeader number="07" title="PLANO COMERCIAL E DE MARKETING" dark subtitle="8.2 Relacionamento com especificadores · 8.5 Metas do primeiro ano" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 80 }} className="max-md:grid-cols-1">
          {acoes.map((a) => (
            <div key={a.tipo} style={{ borderTop: "1px solid rgba(216,211,199,0.1)", padding: "28px 32px 28px 0" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.15em", color: "#D8D3C7", marginBottom: 14 }}>{a.tipo}</p>
              <BPSmall dark>{a.desc}</BPSmall>
            </div>
          ))}
        </div>

        <BPDivider dark />

        <BPLabel dark>8.5 — METAS COMERCIAIS DO PRIMEIRO ANO</BPLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2 }} className="max-md:grid-cols-2 max-sm:grid-cols-1">
          {[
            { meta: "30", label: "ESPECIFICADORES ATIVOS", prazo: "Ao fim do 12º mês" },
            { meta: "5", label: "INCORPORADORAS PARCEIRAS", prazo: "Ao fim do 12º mês" },
            { meta: "5.000 m²", label: "ESTOQUE PERMANENTE", prazo: "A partir do 3º mês" },
            { meta: "R$ 12,5 mi", label: "RECEITA ANO 1", prazo: "Meta de faturamento bruto" },
          ].map((m) => (
            <div key={m.label} style={{ backgroundColor: "rgba(216,211,199,0.04)", borderTop: "1px solid rgba(216,211,199,0.12)", padding: "36px 24px" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: m.meta === "A DEFINIR" ? 16 : 28, color: "#D8D3C7", marginBottom: 10, letterSpacing: "0.04em" }}>{m.meta}</p>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 8, letterSpacing: "0.16em", color: "rgba(216,211,199,0.4)", marginBottom: 8 }}>{m.label}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "#77736A" }}>{m.prazo}</p>
            </div>
          ))}
        </div>
      </BPWrap>
    </>
  );
}
