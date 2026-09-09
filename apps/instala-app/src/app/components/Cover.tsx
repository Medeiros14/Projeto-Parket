import travertino from "../../imports/Captura_de_Tela_2026-06-11_a_s_14.29.35.png";

export function Cover() {
  return (
    <section
      id="cover"
      style={{ backgroundColor: "#050505", minHeight: "100vh" }}
      className="relative flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Subtle texture overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            `url(${travertino})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-12 text-center" style={{ maxWidth: 700 }}>
        {/* Logo */}
        <div style={{ marginBottom: 64 }}>
          <p
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 64,
              letterSpacing: "0.3em",
              color: "#D8D3C7",
              fontWeight: 400,
              lineHeight: 1,
            }}
          >
            NAVONA
          </p>
        </div>

        <div
          style={{
            width: 48,
            height: 1,
            backgroundColor: "#D8D3C7",
            marginBottom: 40,
            opacity: 0.4,
          }}
        />

        <p
          style={{
            fontFamily: "'Cinzel', serif",
            color: "#D8D3C7",
            letterSpacing: "0.25em",
            opacity: 0.6,
            fontSize: 11,
            marginBottom: 8,
          }}
        >
          MANUAL DE IDENTIDADE VISUAL
        </p>

        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            color: "#77736A",
            letterSpacing: "0.15em",
            fontSize: 10,
          }}
        >
          2026
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div style={{ width: 1, height: 48, backgroundColor: "#77736A", opacity: 0.4 }} />
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            color: "#77736A",
            fontSize: 9,
            letterSpacing: "0.2em",
          }}
        >
          SCROLL
        </p>
      </div>
    </section>
  );
}
