import { SectionHeader } from "./SectionHeader";

export function TypographySection() {
  return (
    <section
      id="tipografia"
      style={{ backgroundColor: "#F3F0E8", padding: "120px 0" }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
        <SectionHeader number="05" title="TIPOGRAFIA" />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 80,
            marginBottom: 100,
          }}
          className="max-md:grid-cols-1"
        >
          {/* Fonte do logotipo */}
          <div>
            <p
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 9,
                letterSpacing: "0.25em",
                color: "#050505",
                opacity: 0.4,
                marginBottom: 40,
              }}
            >
              FAMÍLIA PRIMÁRIA — LOGOTIPO E TÍTULOS
            </p>
            <p
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 52,
                color: "#050505",
                letterSpacing: "0.08em",
                fontWeight: 400,
                lineHeight: 1.1,
                marginBottom: 32,
              }}
            >
              Aa
            </p>
            <p
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 13,
                letterSpacing: "0.2em",
                color: "#050505",
                marginBottom: 12,
              }}
            >
              CINZEL
            </p>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                color: "#77736A",
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              Tipografia serifada de inspiração romana. Usada no logotipo, títulos principais e elementos de destaque institucional.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz", "0123456789"].map((row) => (
                <p
                  key={row}
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 11,
                    color: "#77736A",
                    letterSpacing: "0.08em",
                  }}
                >
                  {row}
                </p>
              ))}
            </div>
          </div>

          {/* Fonte de apoio */}
          <div>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 9,
                letterSpacing: "0.25em",
                color: "#050505",
                opacity: 0.4,
                marginBottom: 40,
              }}
            >
              FAMÍLIA SECUNDÁRIA — TEXTO INSTITUCIONAL
            </p>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 52,
                color: "#050505",
                letterSpacing: "0.02em",
                fontWeight: 300,
                lineHeight: 1.1,
                marginBottom: 32,
              }}
            >
              Aa
            </p>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                letterSpacing: "0.2em",
                color: "#050505",
                marginBottom: 12,
              }}
            >
              INTER
            </p>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                color: "#77736A",
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              Fonte sans-serif contemporânea para textos institucionais, comerciais e digitais. Limpa e de alta legibilidade.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz", "0123456789"].map((row) => (
                <p
                  key={row}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    color: "#77736A",
                    letterSpacing: "0.04em",
                  }}
                >
                  {row}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Hierarquia tipográfica */}
        <div
          style={{
            borderTop: "1px solid rgba(5,5,5,0.1)",
            paddingTop: 80,
          }}
        >
          <p
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 9,
              letterSpacing: "0.25em",
              color: "#050505",
              opacity: 0.4,
              marginBottom: 64,
            }}
          >
            06 — HIERARQUIA
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            {/* Title */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 48, borderBottom: "1px solid rgba(5,5,5,0.06)", paddingBottom: 32 }}>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  color: "#77736A",
                  minWidth: 120,
                }}
              >
                TÍTULO PRINCIPAL
              </p>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 36,
                  color: "#050505",
                  letterSpacing: "0.1em",
                  fontWeight: 400,
                }}
              >
                TRAVERTINO ROMANO
              </p>
            </div>

            {/* Subtitle */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 48, borderBottom: "1px solid rgba(5,5,5,0.06)", paddingBottom: 32 }}>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  color: "#77736A",
                  minWidth: 120,
                }}
              >
                SUBTÍTULO
              </p>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 14,
                  color: "#050505",
                  letterSpacing: "0.18em",
                  fontWeight: 400,
                }}
              >
                IMPORTAÇÃO DIRETA DE CHAPAS E LADRILHOS
              </p>
            </div>

            {/* Body */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 48, borderBottom: "1px solid rgba(5,5,5,0.06)", paddingBottom: 32 }}>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  color: "#77736A",
                  minWidth: 120,
                }}
              >
                TEXTO CORRIDO
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  color: "#050505",
                  lineHeight: 1.8,
                  maxWidth: 520,
                  fontWeight: 300,
                }}
              >
                Selecionamos travertino romano na origem. Importamos chapas e ladrilhos para projetos de alto padrão.
                Trabalhamos com foco, estoque e fornecimento direto.
              </p>
            </div>

            {/* Caption */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 48 }}>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  color: "#77736A",
                  minWidth: 120,
                }}
              >
                LEGENDA / TÉCNICO
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  color: "#77736A",
                  letterSpacing: "0.1em",
                }}
              >
                TRAVERTINO ROMANO — CHAPA — ACABAMENTO HONED — ORIGEM: ITÁLIA — 120×60 CM
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
