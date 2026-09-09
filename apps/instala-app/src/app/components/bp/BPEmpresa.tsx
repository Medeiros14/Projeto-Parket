import { BPWrap, BPSectionHeader, BPBody, BPSmall, BPLabel, BPDivider } from "./BPShared";

const team = [
  {
    name: "DOUGLAS OLIVEIRA",
    role: "Sócio — Diretor Comercial e Curadoria",
    bio: "Responsável pela direção comercial e pela curadoria das pedras. Atua na seleção de materiais na origem, construção de relacionamentos com especificadores e desenvolvimento do posicionamento da marca no mercado brasileiro.",
  },
  {
    name: "LUIZ FELIPE",
    role: "Sócio — Diretor Comercial e Curadoria",
    bio: "Co-responsável pela direção comercial e curadoria dos lotes de travertino romano. Com ampla experiência no mercado premium de acabamentos, atua na identificação e seleção dos melhores materiais na origem.",
  },
  {
    name: "ANDERSON",
    role: "Sócio — Importações, Logística e Conformidade",
    bio: "Especialista em importação e logística internacional. Responsável pela estruturação dos processos de importação, gestão de contratos, desembaraço aduaneiro e conformidade regulatória junto a fornecedores europeus.",
  },
  {
    name: "ALINE",
    role: "Sócia — Importações, Logística e Conformidade",
    bio: "Co-responsável pelas operações de importação, logística internacional e conformidade regulatória. Atua na gestão de cadeias globais de suprimento e no relacionamento operacional com fornecedores italianos.",
  },
  {
    name: "PAMELA OLIVEIRA",
    role: "Sócia — Gestão Administrativa e Financeira",
    bio: "Sócia da Parket, empresa de referência no mercado de acabamentos premium. Responsável pela gestão administrativa, financeira e estratégica que sustenta o crescimento das empresas do grupo.",
  },
];

export function BPEmpresa() {
  return (
    <BPWrap id="bp-empresa" dark>
      <BPSectionHeader number="01" title="A EMPRESA" dark />

      {/* História */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, marginBottom: 80 }} className="max-md:grid-cols-1">
        <div>
          <BPLabel dark>NOSSA HISTÓRIA</BPLabel>
          <BPBody dark>
            A Navona nasceu de uma convicção simples. O mercado brasileiro possui excelentes
            fornecedores de mármore e pedras naturais, mas poucos especialistas em travertino.
          </BPBody>
          <div style={{ marginTop: 28 }}>
            <BPBody dark>
              Ao longo de décadas atuando no mercado de acabamentos de alto padrão através da
              Parket, participamos de alguns dos principais projetos residenciais, corporativos
              e hoteleiros do país. Essa trajetória nos aproximou dos arquitetos, incorporadores
              e construtoras que definem os projetos mais relevantes do Brasil.
            </BPBody>
          </div>
        </div>
        <div>
          <BPLabel dark>ORIGEM</BPLabel>
          <BPBody dark>
            Durante esse percurso, conhecemos pedreiras, fábricas e fornecedores ao redor do mundo.
            Entre todos os materiais que encontramos, o travertino romano sempre se destacou pela
            sua elegância, versatilidade e relação entre valor e resultado estético.
          </BPBody>
          <div style={{ marginTop: 28 }}>
            <BPBody dark>
              Foi dessa percepção que nasceu a Navona — uma empresa dedicada exclusivamente ao
              travertino romano, com foco em selecionar os melhores materiais na origem,
              importar diretamente e disponibilizar ao mercado brasileiro com qualidade
              consistente, estoque disponível e fornecimento confiável.
            </BPBody>
          </div>
        </div>
      </div>

      {/* Pillars */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 2,
        marginBottom: 96,
      }} className="max-md:grid-cols-1">
        {[
          { label: "MISSÃO", text: "Importar e distribuir travertino romano com qualidade consistente, disponibilidade imediata e fornecimento confiável." },
          { label: "VISÃO", text: "Ser a empresa mais respeitada e lembrada do Brasil quando o assunto for travertino romano." },
          { label: "PROPOSTA", text: "Especialização em uma única categoria. Foco total em travertino romano para projetos de alto padrão." },
        ].map((p) => (
          <div key={p.label} style={{
            backgroundColor: "rgba(216,211,199,0.04)",
            borderTop: "1px solid rgba(216,211,199,0.12)",
            padding: "36px 32px",
          }}>
            <BPLabel dark>{p.label}</BPLabel>
            <BPSmall dark>{p.text}</BPSmall>
          </div>
        ))}
      </div>

      <BPDivider dark />

      {/* Time */}
      <div style={{ marginTop: 16 }}>
        <BPLabel dark>2.5 — SOCIEDADE E TIME FUNDADOR</BPLabel>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 2,
          marginTop: 32,
        }} className="max-md:grid-cols-1">
          {team.map((member) => (
            <div
              key={member.name}
              style={{
                borderTop: "1px solid rgba(216,211,199,0.1)",
                padding: "32px 0",
                paddingRight: 40,
              }}
            >
              <p style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 11,
                letterSpacing: "0.18em",
                color: "#D8D3C7",
                marginBottom: 6,
              }}>
                {member.name}
              </p>
              <p style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 9,
                letterSpacing: "0.15em",
                color: "#77736A",
                marginBottom: 20,
              }}>
                {member.role.toUpperCase()}
              </p>
              <BPSmall dark>{member.bio}</BPSmall>
            </div>
          ))}
        </div>
      </div>
    </BPWrap>
  );
}
