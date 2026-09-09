import { BPWrap, BPSectionHeader, BPBody, BPSmall, BPLabel, BPDivider } from "./BPShared";

const custoProduto = [
  { item: "Custo CIF do produto (FOB + frete + seguro)", pct: "45–50%", sobre: "Preço de venda" },
  { item: "Impostos de importação (II, IPI, PIS/COFINS, ICMS)", pct: "~28–35%", sobre: "Valor aduaneiro" },
  { item: "Despesas portuárias e desembaraço", pct: "3–5%", sobre: "Valor CIF" },
  { item: "Frete interno + armazenagem", pct: "2–4%", sobre: "Preço de venda" },
  { item: "Custo total do produto posto em estoque", pct: "55–65%", sobre: "Preço de venda final" },
];

const despesas = [
  { categoria: "PESSOAL", itens: ["Equipe comercial (2 pessoas)", "Administrativo/financeiro (1 pessoa)", "Logística/estoque (1 pessoa)"] },
  { categoria: "INFRAESTRUTURA", itens: ["Galpão de armazenagem (aluguel)", "Showroom / sala comercial", "Frota de entrega"] },
  { categoria: "COMERCIAL", itens: ["Marketing digital e conteúdo", "Amostras e catálogos", "Viagens a fornecedores"] },
  { categoria: "OPERACIONAL", itens: ["ERP e sistemas", "Assessoria jurídica e contábil", "Seguros e contingências"] },
];

const projecao = [
  { periodo: "Mês 1–3", foco: "Estruturação", receita: "—", meta: "Primeiros lotes em estoque. Início de visitas comerciais." },
  { periodo: "Mês 4–6", foco: "Tração", receita: "Crescente", meta: "30+ especificadores ativos. Primeiras vendas recorrentes." },
  { periodo: "Mês 7–9", foco: "Escala", receita: "Consistente", meta: "5+ incorporadoras parceiras. Contratos de projeto." },
  { periodo: "Mês 10–12", foco: "Consolidação", receita: "Meta anual", meta: "Break-even operacional. Preparação para expansão de linha." },
];

export function BPFinanceiro() {
  return (
    <>
      {/* Estrutura Organizacional */}
      <BPWrap id="bp-org">
        <BPSectionHeader number="08" title="ESTRUTURA ORGANIZACIONAL" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80 }} className="max-md:grid-cols-1">
          <div>
            <BPLabel>FUNÇÕES E RESPONSABILIDADES</BPLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { nome: "Douglas Oliveira", area: "DIREÇÃO COMERCIAL E CURADORIA", resp: "Direção comercial e curadoria das pedras. Seleção de materiais na origem, relacionamento com especificadores e desenvolvimento de mercado." },
                { nome: "Luiz Felipe", area: "DIREÇÃO COMERCIAL E CURADORIA", resp: "Co-responsável pela direção comercial e curadoria dos lotes. Experiência no mercado premium de acabamentos e identificação de materiais na origem." },
                { nome: "Anderson", area: "IMPORTAÇÕES, LOGÍSTICA E CONFORMIDADE", resp: "Processo de importação, logística internacional, desembaraço aduaneiro e conformidade regulatória junto a fornecedores europeus." },
                { nome: "Aline", area: "IMPORTAÇÕES, LOGÍSTICA E CONFORMIDADE", resp: "Co-responsável pelas operações de importação, logística e conformidade regulatória. Gestão de cadeias globais de suprimento." },
                { nome: "Pamela Oliveira", area: "GESTÃO ADMINISTRATIVA E FINANCEIRA", resp: "Gestão financeira, administrativa e estratégica. Integração com estrutura do grupo Parket." },
              ].map((p) => (
                <div key={p.nome} style={{ borderBottom: "1px solid rgba(5,5,5,0.07)", padding: "22px 0" }}>
                  <div style={{ display: "flex", gap: 24, alignItems: "baseline", marginBottom: 10 }}>
                    <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.12em", color: "#050505" }}>{p.nome}</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.14em", color: "#77736A" }}>{p.area}</p>
                  </div>
                  <BPSmall>{p.resp}</BPSmall>
                </div>
              ))}
            </div>
          </div>
          <div>
            <BPLabel>VANTAGENS COMPETITIVAS DO TIME</BPLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[
                "Décadas de experiência no mercado premium de acabamentos via Parket",
                "Rede consolidada com arquitetos, incorporadoras e construtoras de referência",
                "Expertise em comércio exterior e cadeias globais de fornecimento",
                "Estrutura administrativa já testada e escalável via grupo Parket",
                "Relacionamento direto com fornecedores internacionais de travertino",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                  <div style={{ width: 20, height: 1, backgroundColor: "rgba(5,5,5,0.2)", marginTop: 10, flexShrink: 0 }} />
                  <BPSmall>{item}</BPSmall>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 48, padding: "32px", backgroundColor: "#050505" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.1em", color: "#D8D3C7", lineHeight: 1.6 }}>
                "A Navona nasce com a combinação certa: experiência de mercado, rede de relacionamentos e especialização internacional."
              </p>
            </div>
          </div>
        </div>
      </BPWrap>

      {/* Plano Financeiro */}
      <BPWrap id="bp-financeiro" dark>
        <BPSectionHeader number="09" title="PLANO FINANCEIRO" dark subtitle="10.1 Estrutura de custo do produto importado" />

        <BPLabel dark>10.1 — ESTRUTURA DE CUSTO DO PRODUTO IMPORTADO</BPLabel>
        <div style={{ marginBottom: 80 }}>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr", gap: 16, borderBottom: "1px solid rgba(216,211,199,0.15)", paddingBottom: 12, marginBottom: 4 }} className="max-md:hidden">
            {["COMPONENTE DE CUSTO", "PERCENTUAL", "BASE DE CÁLCULO"].map((h) => (
              <p key={h} style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.18em", color: "#77736A" }}>{h}</p>
            ))}
          </div>
          {custoProduto.map((c, i) => (
            <div
              key={c.item}
              style={{
                display: "grid",
                gridTemplateColumns: "3fr 1fr 1fr",
                gap: 16,
                borderBottom: "1px solid rgba(216,211,199,0.06)",
                padding: "20px 0",
                backgroundColor: i === custoProduto.length - 1 ? "rgba(216,211,199,0.05)" : "transparent",
              }}
              className="max-md:grid-cols-1"
            >
              <p style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                color: i === custoProduto.length - 1 ? "#D8D3C7" : "#77736A",
                fontWeight: i === custoProduto.length - 1 ? 400 : 300,
              }}>
                {c.item}
              </p>
              <p style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 13,
                color: i === custoProduto.length - 1 ? "#D8D3C7" : "rgba(216,211,199,0.6)",
                letterSpacing: "0.04em",
              }}>
                {c.pct}
              </p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "#77736A" }}>{c.sobre}</p>
            </div>
          ))}
        </div>

        <BPDivider dark />

        {/* Despesas operacionais */}
        <BPLabel dark>ESTRUTURA DE DESPESAS OPERACIONAIS</BPLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, marginBottom: 80 }} className="max-md:grid-cols-2 max-sm:grid-cols-1">
          {despesas.map((d) => (
            <div key={d.categoria} style={{ borderTop: "1px solid rgba(216,211,199,0.12)", padding: "28px 20px 28px 0" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 8, letterSpacing: "0.18em", color: "rgba(216,211,199,0.45)", marginBottom: 20 }}>{d.categoria}</p>
              {d.itens.map((item) => (
                <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ width: 3, height: 3, backgroundColor: "#77736A", borderRadius: "50%", marginTop: 6, flexShrink: 0 }} />
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#77736A", lineHeight: 1.6 }}>{item}</p>
                </div>
              ))}
            </div>
          ))}
        </div>

        <BPDivider dark />

        {/* Projeção */}
        <BPLabel dark>PROJEÇÃO OPERACIONAL — ANO 1</BPLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 80 }}>
          {projecao.map((p, i) => (
            <div
              key={p.periodo}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 120px 160px 1fr",
                gap: 32,
                borderBottom: "1px solid rgba(216,211,199,0.07)",
                padding: "24px 0",
                alignItems: "center",
              }}
              className="max-md:grid-cols-1"
            >
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.12em", color: "#D8D3C7", opacity: 0.7 }}>{p.periodo}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.18em", color: "#77736A" }}>{p.foco.toUpperCase()}</p>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.1em", color: "rgba(216,211,199,0.4)" }}>{p.receita.toUpperCase()}</p>
              <BPSmall dark>{p.meta}</BPSmall>
            </div>
          ))}
        </div>

        {/* Closing */}
        <div style={{ borderTop: "1px solid rgba(216,211,199,0.08)", paddingTop: 64, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }} className="max-md:flex-col max-md:gap-8">
          <div>
            <p style={{ fontFamily: "'Cinzel', serif", fontSize: 28, letterSpacing: "0.25em", color: "#D8D3C7", marginBottom: 8 }}>NAVONA</p>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.18em", color: "#77736A" }}>TRAVERTINO ROMANO</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: "#77736A", letterSpacing: "0.12em", lineHeight: 1.8 }}>
              PLANO DE NEGÓCIOS — 2026<br />
              DOCUMENTO CONFIDENCIAL<br />
              navona.com.br
            </p>
          </div>
        </div>
      </BPWrap>
    </>
  );
}
