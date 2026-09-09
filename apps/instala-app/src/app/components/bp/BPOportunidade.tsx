import { BPWrap, BPSectionHeader, BPBody, BPSmall, BPLabel, BPDivider } from "./BPShared";

const promessas = [
  { n: "01", title: "ESPECIALIZAÇÃO REAL", body: "Somos a única empresa no Brasil dedicada exclusivamente ao travertino romano. Isso gera conhecimento aprofundado, curadoria superior e autoridade reconhecida pelos especificadores." },
  { n: "02", title: "ESTOQUE PERMANENTE", body: "Disponibilidade imediata de chapas e ladrilhos. Arquitetos e incorporadoras não perdem projetos por atraso de importação." },
  { n: "03", title: "FORNECIMENTO CONFIÁVEL", body: "Contratos de longo prazo com pedreiras parceiras na Itália garantem continuidade de lotes, consistência visual e segurança comercial para grandes projetos." },
  { n: "04", title: "CURADORIA NA ORIGEM", body: "Selecionamos cada lote presencialmente. Controle visual, técnico e dimensional antes do embarque. Qualidade garantida antes de chegar ao Brasil." },
];

const publico = [
  { segmento: "ARQUITETOS E DESIGNERS", descricao: "Especificadores de projetos residenciais, corporativos e hoteleiros de alto padrão. Buscam material com padrão estético consistente e fornecedor confiável.", tipo: "Primário" },
  { segmento: "INCORPORADORAS", descricao: "Empresas de incorporação de alto padrão que necessitam de volumes consistentes, prazos previsíveis e material aprovado por seus arquitetos de referência.", tipo: "Primário" },
  { segmento: "CONSTRUTORAS", descricao: "Empresas que executam projetos de alto padrão e precisam de fornecedor com estoque, documentação e logística estruturada.", tipo: "Secundário" },
  { segmento: "CLIENTE FINAL PREMIUM", descricao: "Clientes de alto poder aquisitivo que reformam ou constroem residências e buscam o travertino romano indicado pelo arquiteto.", tipo: "Secundário" },
];

export function BPOportunidade() {
  return (
    <>
      {/* Oportunidade */}
      <BPWrap id="bp-oportunidade" dark>
        <BPSectionHeader number="03" title="A OPORTUNIDADE" dark subtitle="4.1 — Análise de mercado e gap competitivo" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, marginBottom: 80 }} className="max-md:grid-cols-1">
          <div>
            <BPLabel dark>O GAP DO MERCADO</BPLabel>
            <BPBody dark>
              O mercado brasileiro de pedras naturais é fragmentado e dominado por distribuidoras generalistas.
              Há excelentes fornecedores de mármore, granito e quartzito — mas nenhum especialista
              reconhecido em travertino romano.
            </BPBody>
            <div style={{ marginTop: 28 }}>
              <BPBody dark>
                O travertino romano é especificado nos principais projetos de alto padrão do Brasil,
                mas é importado de forma inconsistente, com qualidade variável e fornecimento irregular.
                Esse é o espaço que a Navona ocupa.
              </BPBody>
            </div>
          </div>
          <div>
            <BPLabel dark>POR QUE AGORA</BPLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                "Crescimento do segmento de alto padrão no Brasil nos últimos 5 anos",
                "Aumento da especificação de travertino romano por arquitetos de referência",
                "Consolidação de novos polos imobiliários premium (São Paulo, Rio, Nordeste)",
                "Demanda reprimida por fornecedor especializado e confiável",
                "Experiência prévia e rede de relacionamentos com os principais especificadores do mercado",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                  <div style={{ width: 20, height: 1, backgroundColor: "#D8D3C7", opacity: 0.2, marginTop: 10, flexShrink: 0 }} />
                  <BPSmall dark>{item}</BPSmall>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Métricas de mercado */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }} className="max-md:grid-cols-1">
          {[
            { valor: "R$ 4,2 bi", label: "MERCADO DE PEDRAS NATURAIS — BRASIL", detalhe: "Estimativa setor premium, 2025" },
            { valor: "< 5%", label: "PARTICIPAÇÃO DO TRAVERTINO ROMANO", detalhe: "Subexplorado — oportunidade de crescimento" },
            { valor: "8–12%", label: "CRESCIMENTO DO SEGMENTO PREMIUM", detalhe: "CAGR estimado 2022–2026" },
          ].map((m) => (
            <div key={m.label} style={{ backgroundColor: "rgba(216,211,199,0.04)", borderTop: "1px solid rgba(216,211,199,0.12)", padding: "40px 32px" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 36, color: "#D8D3C7", letterSpacing: "0.04em", marginBottom: 12 }}>{m.valor}</p>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 8, letterSpacing: "0.18em", color: "rgba(216,211,199,0.45)", marginBottom: 8 }}>{m.label}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "#77736A" }}>{m.detalhe}</p>
            </div>
          ))}
        </div>
      </BPWrap>

      {/* Proposta de Valor */}
      <BPWrap id="bp-proposta">
        <BPSectionHeader number="04" title="PROPOSTA DE VALOR E POSICIONAMENTO" subtitle="5.1 Promessas centrais · 5.3 Identidade e narrativa" />

        <BPLabel>5.1 — PROMESSAS CENTRAIS DA MARCA</BPLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 80 }} className="max-md:grid-cols-1">
          {promessas.map((p) => (
            <div key={p.n} style={{ borderTop: "2px solid #050505", padding: "32px 32px 32px 0" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 22, color: "rgba(5,5,5,0.1)", marginBottom: 20 }}>{p.n}</p>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.16em", color: "#050505", marginBottom: 16 }}>{p.title}</p>
              <BPSmall>{p.body}</BPSmall>
            </div>
          ))}
        </div>

        <BPDivider />

        <BPLabel>5.3 — IDENTIDADE E NARRATIVA</BPLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, marginBottom: 64 }} className="max-md:grid-cols-1">
          <div>
            <BPBody>
              A Navona não é uma marmoraria. Não é uma distribuidora genérica.
              É uma casa de curadoria e importação especializada em travertino romano.
            </BPBody>
            <div style={{ marginTop: 28 }}>
              <BPBody>
                Sua narrativa é construída sobre o princípio da especialização: fazer uma coisa só, e fazer muito bem feita.
                Esse posicionamento é percebido não apenas no produto, mas em cada ponto de contato com o mercado.
              </BPBody>
            </div>
          </div>
          <div>
            <BPLabel>PÚBLICO-ALVO</BPLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {publico.map((p) => (
                <div key={p.segmento} style={{ borderBottom: "1px solid rgba(5,5,5,0.08)", padding: "20px 0", display: "flex", gap: 24, alignItems: "flex-start" }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.12em", color: "#77736A", minWidth: 80 }}>{p.tipo.toUpperCase()}</p>
                  <div>
                    <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.14em", color: "#050505", marginBottom: 6 }}>{p.segmento}</p>
                    <BPSmall>{p.descricao}</BPSmall>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tagline section */}
        <div style={{ backgroundColor: "#050505", padding: "64px 80px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <p style={{ fontFamily: "'Cinzel', serif", fontSize: 24, color: "#D8D3C7", letterSpacing: "0.12em" }}>
            NAVONA
          </p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#77736A", letterSpacing: "0.2em" }}>
            TRAVERTINO ROMANO, DIRETO DA ORIGEM.
          </p>
        </div>
      </BPWrap>
    </>
  );
}
