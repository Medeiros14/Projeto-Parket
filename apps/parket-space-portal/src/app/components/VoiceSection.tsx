import { SectionHeader } from "./SectionHeader";

const phrases = [
  { label: "PRINCIPAL", text: "Travertino romano, direto da origem." },
  { label: "ALTERNATIVA", text: "Travertino romano para grandes projetos." },
  { label: "ALTERNATIVA", text: "Chapas e ladrilhos selecionados na origem." },
  { label: "ALTERNATIVA", text: "Uma empresa dedicada exclusivamente ao travertino." },
  { label: "ALTERNATIVA", text: "Menos categorias. Mais critério." },
  { label: "ALTERNATIVA", text: "Travertino romano com foco, padrão e fornecimento confiável." },
];

export function VoiceSection() {
  return (
    <>
      {/* Tom de Voz */}
      <section
        id="voz"
        style={{ backgroundColor: "#050505", padding: "120px 0" }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <SectionHeader number="06" title="TOM DE VOZ" dark />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 80,
            }}
            className="max-md:grid-cols-1"
          >
            {/* Como a Navona fala */}
            <div>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "#D8D3C7",
                  opacity: 0.5,
                  marginBottom: 40,
                }}
              >
                COMO A NAVONA FALA
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {[
                  "Selecionamos travertino romano na origem.",
                  "Importamos chapas e ladrilhos para projetos de alto padrão.",
                  "Trabalhamos com foco, estoque e fornecimento direto.",
                  "Atendemos arquitetos, incorporadores e construtoras que precisam de padrão e escala.",
                ].map((phrase) => (
                  <div key={phrase} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 3,
                        height: 3,
                        backgroundColor: "#D8D3C7",
                        borderRadius: "50%",
                        marginTop: 8,
                        flexShrink: 0,
                        opacity: 0.4,
                      }}
                    />
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 14,
                        color: "#D8D3C7",
                        lineHeight: 1.7,
                        fontWeight: 300,
                      }}
                    >
                      {phrase}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Como não fala */}
            <div>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "#D8D3C7",
                  opacity: 0.5,
                  marginBottom: 40,
                }}
              >
                COMO NÃO FALA
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  "Não usamos linguagem exagerada.",
                  "Não usamos promessa vazia.",
                  "Não falamos como marmoraria comum.",
                  "Não usamos luxo, exclusivo, eterno ou sofisticado em excesso.",
                  "Não romantizamos o produto.",
                ].map((phrase) => (
                  <div key={phrase} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 14,
                        height: 1,
                        backgroundColor: "#77736A",
                        marginTop: 9,
                        flexShrink: 0,
                      }}
                    />
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13,
                        color: "#77736A",
                        lineHeight: 1.7,
                        fontWeight: 300,
                      }}
                    >
                      {phrase}
                    </p>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 56,
                  borderTop: "1px solid rgba(216,211,199,0.1)",
                  paddingTop: 32,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 13,
                    color: "#D8D3C7",
                    letterSpacing: "0.08em",
                    lineHeight: 1.6,
                    opacity: 0.7,
                  }}
                >
                  A elegância deve estar<br />na precisão.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frases Institucionais */}
      <section
        id="frases"
        style={{ backgroundColor: "#F3F0E8", padding: "120px 0" }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <SectionHeader number="07" title="FRASES INSTITUCIONAIS" />

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {phrases.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 40,
                  borderBottom: "1px solid rgba(5,5,5,0.08)",
                  padding: "32px 0",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    color: "#77736A",
                    minWidth: 100,
                  }}
                >
                  {p.label}
                </p>
                <p
                  style={{
                    fontFamily: i === 0 ? "'Cinzel', serif" : "'Inter', sans-serif",
                    fontSize: i === 0 ? 22 : 16,
                    color: "#050505",
                    letterSpacing: i === 0 ? "0.06em" : "0.01em",
                    fontWeight: i === 0 ? 400 : 300,
                  }}
                >
                  {p.text}
                </p>
              </div>
            ))}
          </div>

          {/* Assinatura de marca em destaque */}
          <div
            style={{
              marginTop: 96,
              padding: "64px 80px",
              backgroundColor: "#050505",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <p
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 28,
                color: "#D8D3C7",
                letterSpacing: "0.3em",
              }}
            >
              NAVONA
            </p>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 10,
                color: "#77736A",
                letterSpacing: "0.2em",
              }}
            >
              TRAVERTINO ROMANO
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
