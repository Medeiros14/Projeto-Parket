import travertino from "../../../imports/Captura_de_Tela_2026-06-11_a_s_14.29.35.png";

const toc = [
  { n: "01", label: "A Empresa" },
  { n: "02", label: "O Produto" },
  { n: "03", label: "A Oportunidade" },
  { n: "04", label: "Proposta de Valor" },
  { n: "05", label: "Modelo de Receita" },
  { n: "06", label: "Plano Operacional" },
  { n: "07", label: "Plano Comercial" },
  { n: "08", label: "Estrutura Organizacional" },
  { n: "09", label: "Plano Financeiro" },
];

export function BPCover() {
  return (
    <>
      {/* Cover */}
      <section
        style={{
          backgroundColor: "#050505",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Travertine texture, very subtle */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${travertino})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.04,
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            maxWidth: 1100,
            margin: "0 auto",
            width: "100%",
            padding: "80px 80px 80px",
          }}
        >
          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <p style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 13,
              letterSpacing: "0.28em",
              color: "#D8D3C7",
              fontWeight: 400,
            }}>
              NAVONA
            </p>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9,
              letterSpacing: "0.15em",
              color: "#77736A",
              textAlign: "right",
            }}>
              CONFIDENCIAL<br />2026
            </p>
          </div>

          {/* Center */}
          <div>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9,
              letterSpacing: "0.25em",
              color: "#77736A",
              marginBottom: 32,
            }}>
              DOCUMENTO ESTRATÉGICO
            </p>
            <h1 style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 56,
              letterSpacing: "0.06em",
              color: "#D8D3C7",
              fontWeight: 400,
              lineHeight: 1.15,
              marginBottom: 0,
            }}>
              PLANO DE<br />NEGÓCIOS
            </h1>
            <div style={{ width: 64, height: 1, backgroundColor: "rgba(216,211,199,0.2)", margin: "40px 0" }} />
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              color: "#77736A",
              letterSpacing: "0.1em",
              fontWeight: 300,
            }}>
              Travertino Romano — Importação Direta
            </p>
          </div>

          {/* Bottom — travertino texture strip */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 48, justifyContent: "space-between" }}>
            <div>
              <img
                src={travertino}
                alt="Travertino Romano"
                style={{ width: 200, height: 80, objectFit: "cover", opacity: 0.5 }}
              />
            </div>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9,
              color: "#77736A",
              letterSpacing: "0.12em",
              textAlign: "right",
              lineHeight: 1.8,
            }}>
              navona.com.br<br />
              contato@navona.com.br
            </p>
          </div>
        </div>
      </section>

      {/* Sumário */}
      <section style={{ backgroundColor: "#D8D3C7", padding: "100px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <p style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 9,
            letterSpacing: "0.25em",
            color: "rgba(5,5,5,0.35)",
            marginBottom: 64,
          }}>
            SUMÁRIO
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {toc.map((item, i) => (
              <div
                key={item.n}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(5,5,5,0.1)",
                  padding: "24px 0",
                  gap: 24,
                }}
              >
                <div style={{ display: "flex", gap: 40, alignItems: "baseline" }}>
                  <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: "rgba(5,5,5,0.3)",
                    minWidth: 24,
                  }}>
                    {item.n}
                  </p>
                  <p style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: i === 0 ? 15 : 13,
                    letterSpacing: "0.1em",
                    color: "#050505",
                    fontWeight: 400,
                  }}>
                    {item.label.toUpperCase()}
                  </p>
                </div>
                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(5,5,5,0.12)", margin: "0 24px" }} />
                <p style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  color: "rgba(5,5,5,0.3)",
                  letterSpacing: "0.1em",
                }}>
                  {String(i + 2).padStart(2, "0")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
