import { SectionHeader } from "./SectionHeader";
import travertino from "../../imports/Captura_de_Tela_2026-06-11_a_s_14.29.35.png";

const photoUrl = travertino;

export function EssenceSection() {
  return (
    <>
      {/* Essência */}
      <section
        id="essencia"
        style={{ backgroundColor: "#F3F0E8", padding: "120px 0" }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <SectionHeader number="01" title="ESSÊNCIA DA MARCA" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 80,
              alignItems: "start",
            }}
            className="max-md:grid-cols-1"
          >
            <div>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 28,
                  color: "#050505",
                  letterSpacing: "0.06em",
                  lineHeight: 1.5,
                  fontWeight: 400,
                  marginBottom: 40,
                }}
              >
                Especialização.<br />
                Origem.<br />
                Confiança.
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  color: "#77736A",
                  lineHeight: 1.9,
                  fontWeight: 300,
                  marginBottom: 40,
                }}
              >
                A Navona é uma importadora especializada em travertino romano.
                Nasce com foco claro: selecionar, importar e vender travertino romano
                em chapas e ladrilhos para projetos de alto padrão no Brasil.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Não somos uma marmoraria.",
                  "Não somos uma empresa de instalação.",
                  "Não somos uma distribuidora genérica de pedras naturais.",
                ].map((line) => (
                  <div key={line} style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{ width: 20, height: 1, backgroundColor: "rgba(5,5,5,0.2)", flexShrink: 0 }} />
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 12,
                        color: "#77736A",
                        fontStyle: "italic",
                      }}
                    >
                      {line}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <img
                src={photoUrl}
                alt="Travertino romano"
                style={{
                  width: "100%",
                  height: 440,
                  objectFit: "cover",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Posicionamento */}
      <section
        id="posicionamento"
        style={{ backgroundColor: "#050505", padding: "120px 0" }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <SectionHeader number="02" title="POSICIONAMENTO" dark />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 80,
            }}
            className="max-md:grid-cols-1"
          >
            <div>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 16,
                  color: "#D8D3C7",
                  lineHeight: 1.9,
                  fontWeight: 300,
                  opacity: 0.8,
                  marginBottom: 48,
                }}
              >
                A Navona ocupa o espaço de uma empresa especialista em travertino romano
                para arquitetura e incorporação de alto padrão.
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  color: "#77736A",
                  lineHeight: 1.9,
                  fontWeight: 300,
                }}
              >
                Seu valor não está em oferecer muitas opções.
                Está em selecionar bem uma única categoria.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {[
                { label: "PERCEPÇÃO", text: "Casa de curadoria e importação" },
                { label: "LINGUAGEM", text: "Sóbria, precisa e elegante" },
                { label: "REFERÊNCIA", text: "Marca italiana contemporânea com referência clássica romana" },
                { label: "TERRITÓRIO", text: "Arquitetura, incorporação, alto padrão" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderTop: "1px solid rgba(216,211,199,0.1)",
                    paddingTop: 24,
                    display: "flex",
                    gap: 32,
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 8,
                      letterSpacing: "0.18em",
                      color: "#77736A",
                      minWidth: 100,
                      paddingTop: 2,
                    }}
                  >
                    {item.label}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 11,
                      color: "#D8D3C7",
                      letterSpacing: "0.06em",
                      lineHeight: 1.6,
                      opacity: 0.7,
                    }}
                  >
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Missão / Visão */}
          <div
            style={{
              marginTop: 96,
              borderTop: "1px solid rgba(216,211,199,0.08)",
              paddingTop: 64,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 48,
            }}
            className="max-md:grid-cols-1"
          >
            {[
              {
                label: "MISSÃO",
                text: "Importar e distribuir travertino romano com qualidade consistente, disponibilidade imediata e fornecimento confiável.",
              },
              {
                label: "VISÃO",
                text: "Ser a empresa mais respeitada e lembrada do Brasil quando o assunto for travertino romano.",
              },
              {
                label: "VALORES",
                text: "Especialização. Foco. Eficiência. Confiança. Relações sólidas com fornecedores e clientes.",
              },
            ].map((item) => (
              <div key={item.label}>
                <p
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 9,
                    letterSpacing: "0.22em",
                    color: "#D8D3C7",
                    opacity: 0.4,
                    marginBottom: 20,
                  }}
                >
                  {item.label}
                </p>
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                    color: "#77736A",
                    lineHeight: 1.8,
                    fontWeight: 300,
                  }}
                >
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
