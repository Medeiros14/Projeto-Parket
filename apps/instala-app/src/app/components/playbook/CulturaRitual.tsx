import { PBModuleNav, PBHero, PBWrap, PBSectionHeader, PBBody, PBSmall, PBLabel, PBDivider } from "./PlaybookShared";

const valores = [
  {
    valor: "EXCELÊNCIA SEM CONCESSÕES",
    desc: "Do material que importamos ao atendimento que prestamos — não aceitamos mediano. Cada detalhe carrega o nome Navona.",
  },
  {
    valor: "CONFIANÇA COMO MOEDA",
    desc: "Arquiteto que especifica a Navona aposta seu nome no nosso produto. Honramos essa confiança com estoque, prazo e consistência.",
  },
  {
    valor: "PARCERIA DE LONGO PRAZO",
    desc: "Não vendemos pedra. Construímos relacionamentos. O cliente que fechou hoje deve voltar no próximo projeto.",
  },
  {
    valor: "CONHECIMENTO É DIFERENCIAL",
    desc: "Sabemos mais sobre travertino romano do que qualquer concorrente. Esse conhecimento está à disposição dos nossos clientes e time.",
  },
];

const rituais = [
  {
    freq: "DIÁRIO",
    nome: "Morning Check",
    horario: "9h00 — 10 min",
    desc: "Cada pessoa compartilha: o que fez ontem, o que fará hoje, e se tem algum bloqueio. Não é uma reunião — é um alinhamento de radar.",
    quem: "Todos",
  },
  {
    freq: "SEMANAL",
    nome: "Pipeline Monday",
    horario: "Segunda, 9h30 — 30 min",
    desc: "BDR + SDR + Closer revisam o funil. O que está preso? O que fecha essa semana? Saímos com responsabilidades claras.",
    quem: "Time Comercial",
  },
  {
    freq: "SEMANAL",
    nome: "Feedback Friday",
    horario: "Sexta, 17h — 20 min",
    desc: "Uma rodada rápida: o que funcionou essa semana? O que melhoramos? Cada pessoa fala por 2 minutos. Sem julgamento.",
    quem: "Todos",
  },
  {
    freq: "MENSAL",
    nome: "Revisão de Metas",
    horario: "Última quinta do mês — 1h",
    desc: "Revisamos KPIs, celebramos vitórias, identificamos gaps. Definimos foco do próximo mês.",
    quem: "Liderança + Time",
  },
  {
    freq: "MENSAL",
    nome: "Visita a Obra ou Showroom",
    horario: "1x por mês",
    desc: "Todo o time visita pelo menos um projeto onde nossa pedra foi usada. Ver o produto aplicado muda a forma como vendemos.",
    quem: "Todos",
  },
  {
    freq: "TRIMESTRAL",
    nome: "Navona Retreat",
    horario: "1 dia por trimestre",
    desc: "Um dia fora do escritório. Estratégia, cultura, aprendizado e celebração. Onde decidimos o que realmente importa.",
    quem: "Todos",
  },
];

const primeiros90 = [
  {
    periodo: "PRIMEIROS 30 DIAS",
    foco: "Absorver",
    itens: [
      "Conhecer todo o portfólio físico — tocar, aprender as diferenças",
      "Acompanhar Closer em ao menos 3 reuniões com clientes",
      "Estudar o Manual da Marca e Playbook de Produto",
      "Conhecer cada pessoa do time e entender seu papel",
      "Primeira visita a uma obra ou showroom",
    ],
  },
  {
    periodo: "DIAS 31–60",
    foco: "Praticar",
    itens: [
      "Iniciar primeiras prospecções ou atividades do cargo (com suporte)",
      "Conduzir pelo menos 1 reunião ou ação independente",
      "Apresentar ao time o que aprendeu e onde está dúvida",
      "Alinhamento com liderança: o que está indo bem, o que precisa de apoio",
      "Propor ao menos 1 melhoria de processo ou ferramenta",
    ],
  },
  {
    periodo: "DIAS 61–90",
    foco: "Contribuir",
    itens: [
      "Atingir ao menos 70% das metas do cargo no mês",
      "Ter autonomia total nas atividades do seu papel",
      "Mentorar alguém novo (se houver) ou documentar um processo",
      "Revisão formal com liderança: alinhamento de carreira e expectativas",
      "Celebrar! Três meses na Navona é conquista.",
    ],
  },
];

const ferramentas = [
  { nome: "CRM", uso: "Gestão de pipeline, leads e follow-up. Atualizar diariamente — sem exceção." },
  { nome: "WhatsApp Business", uso: "Comunicação com clientes. Perfil profissional, status atualizado." },
  { nome: "Instagram", uso: "Prospecção e relacionamento. Consumir, comentar, criar conexões reais." },
  { nome: "LinkedIn", uso: "Prospecção B2B — especialmente incorporadoras e construtoras." },
  { nome: "Google Drive", uso: "Todos os documentos, decks e materiais comerciais estão aqui." },
  { nome: "E-mail Navona", uso: "Comunicação formal com clientes. Assinatura padronizada obrigatória." },
];

export function CulturaRitual({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ backgroundColor: "#050505" }}>
      <PBModuleNav onBack={onBack} title="CULTURA & RITUAIS" />

      <div style={{ paddingTop: 64 }}>
        <PBHero
          label="QUEM SOMOS · COMO VIVEMOS"
          title={"CULTURA &\nRITUAIS"}
          sub="O guia para quem está chegando — e um lembrete para quem já está. Aqui está o que acreditamos, como trabalhamos e o que nos une."
        />

        {/* Propósito */}
        <section style={{ backgroundColor: "#D8D3C7", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="01" title="PROPÓSITO E VISÃO" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80 }} className="max-md:grid-cols-1">
              <div>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.22em", color: "rgba(5,5,5,0.35)", marginBottom: 16 }}>POR QUE EXISTIMOS</p>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: "0.06em", color: "#050505", fontWeight: 400, lineHeight: 1.6, marginBottom: 24 }}>
                  Levar a beleza permanente do travertino romano para os projetos mais relevantes do Brasil.
                </p>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#77736A", lineHeight: 1.9, fontWeight: 300 }}>
                  O travertino é uma das pedras mais nobres do mundo. Usado no Coliseu, no Getty Center, em residências icônicas. Por décadas, ele foi privilégio de poucos no Brasil — importação lenta, estoque irregular, pouco suporte técnico.
                </p>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#77736A", lineHeight: 1.9, fontWeight: 300, marginTop: 16 }}>
                  A Navona existe para mudar isso. Estoque permanente. Seleção de lote na origem. Atendimento de quem entende de arquitetura.
                </p>
              </div>
              <div>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.22em", color: "rgba(5,5,5,0.35)", marginBottom: 16 }}>ONDE QUEREMOS CHEGAR</p>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#77736A", lineHeight: 1.9, fontWeight: 300 }}>
                  Ser o fornecedor de referência em pedras naturais italianas para os principais arquitetos, designers e incorporadoras do Brasil — reconhecidos pela qualidade, confiabilidade e pelo conhecimento técnico que entregamos junto com cada pedra.
                </p>
                <div style={{ marginTop: 40 }}>
                  <div style={{ width: 32, height: 1, backgroundColor: "rgba(5,5,5,0.2)", marginBottom: 20 }} />
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: "0.1em", color: "#050505", fontStyle: "italic" }}>
                    "A pedra que dura séculos merece um parceiro em quem se possa confiar."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Valores */}
        <PBWrap id="pb-valores">
          <PBSectionHeader number="02" title="NOSSOS VALORES" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2 }} className="max-sm:grid-cols-1">
            {valores.map((v, i) => (
              <div key={v.valor} style={{
                padding: "48px 40px",
                border: "1px solid rgba(5,5,5,0.07)",
                backgroundColor: i % 2 === 0 ? "rgba(5,5,5,0.02)" : "transparent",
              }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.14em", color: "#050505", marginBottom: 20 }}>{v.valor}</p>
                <PBSmall>{v.desc}</PBSmall>
              </div>
            ))}
          </div>
        </PBWrap>

        {/* Nossa História */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="03" title="NOSSA HISTÓRIA" dark />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }} className="max-md:grid-cols-1">
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "rgba(216,211,199,0.7)", lineHeight: 1.9, fontWeight: 300 }}>
                A Navona nasce da obsessão por material. Não pelo material qualquer — pelo travertino romano, extraído em Tivoli, carregado de história, de textura e de permanência.
              </p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "rgba(216,211,199,0.7)", lineHeight: 1.9, fontWeight: 300 }}>
                Fundamos a empresa com uma convicção simples: o Brasil merecia ter acesso ao melhor travertino do mundo, com estoque garantido e um time que realmente entende de arquitetura. Cada lote é selecionado por nós, na pedreira, antes de embarcar.
              </p>
            </div>
            <div style={{ marginTop: 64, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }} className="max-md:grid-cols-1">
              {[
                { num: "7+", label: "Linhas de Produto", desc: "Da clássica à chapa — a mais completa linha de travertino do Brasil." },
                { num: "100%", label: "Importação Direta", desc: "Da pedreira italiana direto ao seu projeto. Sem intermediários." },
                { num: "SP", label: "Estoque Permanente", desc: "Disponibilidade imediata. Nenhum projeto travado por prazo de importação." },
              ].map((s) => (
                <div key={s.num} style={{ border: "1px solid rgba(216,211,199,0.08)", padding: "36px 28px" }}>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 36, letterSpacing: "0.04em", color: "#D8D3C7", marginBottom: 8 }}>{s.num}</p>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.16em", color: "#77736A", marginBottom: 12 }}>{s.label}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.45)", lineHeight: 1.7, fontWeight: 300 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Rituais */}
        <PBWrap id="pb-rituais">
          <PBSectionHeader number="04" title="RITUAIS DA EMPRESA" />
          <PBBody>
            Rituais não são burocracia — são o que cria consistência, alinhamento e cultura real. Aqui estão os rituais que praticamos na Navona.
          </PBBody>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 48 }}>
            {rituais.map((r) => (
              <div key={r.nome} style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr 2fr 0.7fr", gap: 24, borderBottom: "1px solid rgba(5,5,5,0.07)", padding: "28px 0", alignItems: "start" }} className="max-lg:grid-cols-1">
                <div>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", border: "1px solid rgba(5,5,5,0.12)", padding: "4px 8px" }}>
                    {r.freq}
                  </span>
                </div>
                <div>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.1em", color: "#050505", marginBottom: 4 }}>{r.nome}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.1em", color: "#77736A" }}>{r.horario}</p>
                </div>
                <PBSmall>{r.desc}</PBSmall>
                <PBSmall>{r.quem}</PBSmall>
              </div>
            ))}
          </div>
        </PBWrap>

        {/* 30/60/90 dias */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="05" title="SEUS PRIMEIROS 90 DIAS" dark />
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "rgba(216,211,199,0.65)", lineHeight: 1.9, fontWeight: 300, marginBottom: 48, maxWidth: 600 }}>
              Chegou na Navona. Aqui está o que esperamos — e o que você pode esperar de nós — nos primeiros três meses.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }} className="max-md:grid-cols-1">
              {primeiros90.map((p, i) => (
                <div key={p.periodo} style={{ border: `1px solid ${i === 2 ? "rgba(216,211,199,0.2)" : "rgba(216,211,199,0.08)"}`, padding: "40px 32px", backgroundColor: i === 2 ? "rgba(216,211,199,0.03)" : "transparent" }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.18em", color: "#77736A", marginBottom: 12 }}>{p.periodo}</p>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 16, letterSpacing: "0.1em", color: "#D8D3C7", marginBottom: 32 }}>{p.foco.toUpperCase()}</p>
                  {p.itens.map((item) => (
                    <div key={item} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "rgba(216,211,199,0.3)", marginTop: 7, flexShrink: 0 }} />
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.55)", lineHeight: 1.7, fontWeight: 300 }}>{item}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ferramentas */}
        <PBWrap id="pb-ferramentas">
          <PBSectionHeader number="06" title="FERRAMENTAS E COMUNICAÇÃO" />
          <PBBody>
            Aqui estão as ferramentas que usamos. Conhecê-las bem é parte do onboarding.
          </PBBody>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginTop: 48 }} className="max-md:grid-cols-2 max-sm:grid-cols-1">
            {ferramentas.map((f) => (
              <div key={f.nome} style={{ border: "1px solid rgba(5,5,5,0.08)", padding: "28px 24px" }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.1em", color: "#050505", marginBottom: 12 }}>{f.nome}</p>
                <PBSmall>{f.uso}</PBSmall>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 64, padding: "40px", backgroundColor: "#050505" }}>
            <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.22em", color: "rgba(216,211,199,0.3)", marginBottom: 20 }}>REGRA DE OURO</p>
            <p style={{ fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: "0.06em", color: "#D8D3C7", fontWeight: 400, lineHeight: 1.6 }}>
              Seja na pedra que vendemos, no e-mail que enviamos ou no atendimento que prestamos — o padrão da Navona é sempre o mais alto possível.
            </p>
          </div>
        </PBWrap>
      </div>
    </div>
  );
}
