import { SectionHeader } from "./SectionHeader";
import travertino from "../../imports/Captura_de_Tela_2026-06-11_a_s_14.29.35.png";

const photoUrl = travertino;
const photoUrl2 = travertino;
const photoUrl3 = travertino;

function LogoNegativeSmall() {
  return (
    <p
      style={{
        fontFamily: "'Cinzel', serif",
        fontSize: 14,
        letterSpacing: "0.28em",
        color: "#D8D3C7",
        fontWeight: 400,
      }}
    >
      NAVONA
    </p>
  );
}

function LogoPositiveSmall() {
  return (
    <p
      style={{
        fontFamily: "'Cinzel', serif",
        fontSize: 14,
        letterSpacing: "0.28em",
        color: "#050505",
        fontWeight: 400,
      }}
    >
      NAVONA
    </p>
  );
}

export function ApplicationsSection() {
  return (
    <>
      {/* Aplicações Visuais */}
      <section
        id="aplicacoes"
        style={{ backgroundColor: "#F3F0E8", padding: "120px 0" }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <SectionHeader number="08" title="APLICAÇÕES VISUAIS" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 2,
              marginBottom: 80,
            }}
            className="max-md:grid-cols-1"
          >
            {/* Business card */}
            <div>
              <div style={{ marginBottom: 20 }}>
                <p
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: "#050505",
                    opacity: 0.4,
                    marginBottom: 16,
                  }}
                >
                  CARTÃO DE VISITA
                </p>
                {/* Card front */}
                <div
                  style={{
                    backgroundColor: "#050505",
                    padding: "32px 28px",
                    marginBottom: 2,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    height: 160,
                  }}
                >
                  <LogoNegativeSmall />
                  <div>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#77736A", letterSpacing: "0.1em" }}>
                      TRAVERTINO ROMANO
                    </p>
                  </div>
                </div>
                {/* Card back */}
                <div
                  style={{
                    backgroundColor: "#D8D3C7",
                    padding: "28px",
                    height: 160,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, color: "#050505", letterSpacing: "0.1em", marginBottom: 4 }}>
                      LUIZ FELIPE
                    </p>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#77736A", letterSpacing: "0.08em" }}>
                      DIRETOR COMERCIAL
                    </p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#77736A", lineHeight: 1.8 }}>
                      contato@navona.com.br<br />
                      +55 11 0000-0000<br />
                      navona.com.br
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Catalog */}
            <div>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "#050505",
                  opacity: 0.4,
                  marginBottom: 16,
                }}
              >
                CATÁLOGO
              </p>
              <div
                style={{
                  backgroundColor: "#050505",
                  height: 322,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src={photoUrl}
                  alt="Travertino"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.25,
                  }}
                />
                <div style={{ position: "relative", zIndex: 1, padding: "28px" }}>
                  <LogoNegativeSmall />
                </div>
                <div style={{ position: "relative", zIndex: 1, padding: "28px" }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#77736A", letterSpacing: "0.15em", marginBottom: 6 }}>
                    COLEÇÃO 2026
                  </p>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 14, color: "#D8D3C7", letterSpacing: "0.1em" }}>
                    TRAVERTINO<br />ROMANO
                  </p>
                </div>
              </div>
            </div>

            {/* Sample label */}
            <div>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "#050505",
                  opacity: 0.4,
                  marginBottom: 16,
                }}
              >
                ETIQUETA DE AMOSTRA
              </p>
              <div
                style={{
                  backgroundColor: "#D8D3C7",
                  padding: "32px 28px",
                  height: 322,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <LogoPositiveSmall />
                <div>
                  <div style={{ borderTop: "1px solid rgba(5,5,5,0.12)", paddingTop: 20 }}>
                    {[
                      ["MATERIAL", "Travertino Romano"],
                      ["LOTE", "IT-2026-041"],
                      ["FORMATO", "120 × 60 cm"],
                      ["ACABAMENTO", "Honed"],
                      ["ORIGEM", "Itália"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#77736A", letterSpacing: "0.12em" }}>{k}</p>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#050505", letterSpacing: "0.05em" }}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Presentation structure */}
          <div
            style={{
              borderTop: "1px solid rgba(5,5,5,0.08)",
              paddingTop: 64,
            }}
          >
            <p
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 9,
                letterSpacing: "0.2em",
                color: "#050505",
                opacity: 0.4,
                marginBottom: 40,
              }}
            >
              APRESENTAÇÃO COMERCIAL — ESTRUTURA
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 2,
              }}
              className="max-md:grid-cols-3 max-sm:grid-cols-2"
            >
              {[
                "Capa",
                "Quem Somos",
                "Modelo de Negócio",
                "Materiais",
                "Formatos",
                "Aplicações",
                "Contato",
              ].map((slide, i) => (
                <div key={slide}>
                  <div
                    style={{
                      backgroundColor: i === 0 ? "#050505" : "#D8D3C7",
                      height: 80,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 8px",
                    }}
                  >
                    {i === 0 && (
                      <p
                        style={{
                          fontFamily: "'Cinzel', serif",
                          fontSize: 8,
                          letterSpacing: "0.2em",
                          color: "#D8D3C7",
                          fontWeight: 400,
                        }}
                      >
                        NAVONA
                      </p>
                    )}
                  </div>
                  <p
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 8,
                      color: "#77736A",
                      letterSpacing: "0.08em",
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    {slide.toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Fotografia */}
      <section
        id="fotografia"
        style={{ backgroundColor: "#050505", padding: "120px 0" }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <SectionHeader number="09" title="DIREÇÃO FOTOGRÁFICA" dark />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 2,
              marginBottom: 64,
            }}
            className="max-md:grid-cols-1"
          >
            <img
              src={photoUrl2}
              alt="Travertino — direção fotográfica"
              style={{ width: "100%", height: 480, objectFit: "cover" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <img
                src={photoUrl3}
                alt="Detalhe travertino"
                style={{ width: "100%", height: 239, objectFit: "cover", objectPosition: "top" }}
              />
              <img
                src={photoUrl}
                alt="Textura travertino"
                style={{ width: "100%", height: 239, objectFit: "cover", objectPosition: "bottom" }}
              />
            </div>
          </div>

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
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "#D8D3C7",
                  opacity: 0.5,
                  marginBottom: 28,
                }}
              >
                O QUE FOTOGRAFAR
              </p>
              {[
                "Chapas inteiras",
                "Ladrilhos empilhados",
                "Detalhe da pedra",
                "Veios e porosidade",
                "Pallets organizados",
                "Obras de referência",
                "Ambientes com travertino aplicado",
                "Pedreiras e origem",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
                  <div style={{ width: 3, height: 3, backgroundColor: "#D8D3C7", borderRadius: "50%", opacity: 0.3, flexShrink: 0 }} />
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#77736A" }}>{item}</p>
                </div>
              ))}
            </div>

            <div>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "#D8D3C7",
                  opacity: 0.5,
                  marginBottom: 28,
                }}
              >
                COMO FOTOGRAFAR
              </p>
              {[
                "Luz natural",
                "Fundos neutros",
                "Pouca interferência",
                "Enquadramento preciso",
                "Textura real do material",
                "Sem saturação excessiva",
                "Sem filtros pesados",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
                  <div style={{ width: 3, height: 3, backgroundColor: "#D8D3C7", borderRadius: "50%", opacity: 0.3, flexShrink: 0 }} />
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#77736A" }}>{item}</p>
                </div>
              ))}

              <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid rgba(216,211,199,0.1)" }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.2em", color: "#D8D3C7", opacity: 0.5, marginBottom: 28 }}>
                  EVITAR
                </p>
                {[
                  "Render artificial demais",
                  "Fotos muito brilhantes",
                  "Textura falsa de pedra",
                  "Excesso de decoração",
                  "Imagens genéricas de banco",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
                    <div style={{ width: 14, height: 1, backgroundColor: "#77736A", flexShrink: 0 }} />
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#77736A" }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
