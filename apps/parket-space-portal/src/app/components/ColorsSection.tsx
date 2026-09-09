import { SectionHeader } from "./SectionHeader";

const colors = [
  {
    name: "Preto Navona",
    hex: "#050505",
    rgb: "5, 5, 5",
    usage: "Texto principal, logotipo, fundos institucionais, títulos e materiais premium.",
    bg: "#050505",
    text: "#D8D3C7",
    border: "none",
  },
  {
    name: "Bege Travertino",
    hex: "#D8D3C7",
    rgb: "216, 211, 199",
    usage: "Fundo principal, aplicação negativa do logotipo, materiais impressos e catálogos.",
    bg: "#D8D3C7",
    text: "#050505",
    border: "none",
  },
  {
    name: "Off White Mineral",
    hex: "#F3F0E8",
    rgb: "243, 240, 232",
    usage: "Áreas de respiro, páginas internas, fundos secundários e materiais editoriais.",
    bg: "#F3F0E8",
    text: "#050505",
    border: "1px solid rgba(5,5,5,0.08)",
  },
  {
    name: "Cinza Pedra",
    hex: "#77736A",
    rgb: "119, 115, 106",
    usage: "Uso secundário. Textos auxiliares, linhas, informações técnicas e divisórias.",
    bg: "#77736A",
    text: "#F3F0E8",
    border: "none",
  },
];

export function ColorsSection() {
  return (
    <section
      id="cores"
      style={{ backgroundColor: "#050505", padding: "120px 0" }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
        <SectionHeader number="04" title="CORES INSTITUCIONAIS" dark />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 2,
            marginBottom: 80,
          }}
          className="max-md:grid-cols-2 max-sm:grid-cols-1"
        >
          {colors.map((c) => (
            <div key={c.hex}>
              {/* Color swatch */}
              <div
                style={{
                  backgroundColor: c.bg,
                  height: 220,
                  border: c.border || undefined,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: "20px 24px",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: c.text,
                    opacity: 0.5,
                    marginBottom: 4,
                  }}
                >
                  {c.hex}
                </p>
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: c.text,
                    opacity: 0.35,
                  }}
                >
                  RGB {c.rgb}
                </p>
              </div>
              {/* Color info */}
              <div style={{ paddingTop: 20, paddingBottom: 32 }}>
                <p
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 10,
                    letterSpacing: "0.15em",
                    color: "#D8D3C7",
                    marginBottom: 12,
                  }}
                >
                  {c.name.toUpperCase()}
                </p>
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    color: "#77736A",
                    lineHeight: 1.7,
                  }}
                >
                  {c.usage}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Regras de uso */}
        <div
          style={{
            borderTop: "1px solid rgba(216,211,199,0.1)",
            paddingTop: 64,
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
                marginBottom: 28,
                opacity: 0.6,
              }}
            >
              COMBINAÇÕES PRINCIPAIS
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Preto sobre Bege", a: "#050505", b: "#D8D3C7" },
                { label: "Bege sobre Preto", a: "#D8D3C7", b: "#050505" },
              ].map((combo) => (
                <div
                  key={combo.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", gap: 2 }}>
                    <div style={{ width: 32, height: 32, backgroundColor: combo.a, border: "1px solid rgba(216,211,199,0.1)" }} />
                    <div style={{ width: 32, height: 32, backgroundColor: combo.b, border: "1px solid rgba(216,211,199,0.1)" }} />
                  </div>
                  <p
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 11,
                      color: "#77736A",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {combo.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 9,
                letterSpacing: "0.2em",
                color: "#D8D3C7",
                marginBottom: 28,
                opacity: 0.6,
              }}
            >
              EVITAR
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "Dourado excessivo",
                "Marrom pesado",
                "Bege amarelado",
                "Cinza frio",
                "Branco puro em excesso",
                "Cores vibrantes",
                "Texturas artificiais de mármore",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      backgroundColor: "#77736A",
                      borderRadius: "50%",
                      flexShrink: 0,
                    }}
                  />
                  <p
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 11,
                      color: "#77736A",
                    }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
