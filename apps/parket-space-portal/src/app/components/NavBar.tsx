import { useState, useEffect } from "react";

const sections = [
  { id: "essencia", label: "01 Essência" },
  { id: "posicionamento", label: "02 Posicionamento" },
  { id: "logotipo", label: "03 Logotipo" },
  { id: "cores", label: "04 Cores" },
  { id: "tipografia", label: "05 Tipografia" },
  { id: "voz", label: "06 Tom de Voz" },
  { id: "frases", label: "07 Frases" },
  { id: "aplicacoes", label: "08 Aplicações" },
  { id: "fotografia", label: "09 Fotografia" },
  { id: "incorretos", label: "10 Usos Incorretos" },
  { id: "sistema", label: "11 Sistema" },
  { id: "assinaturas", label: "12 Assinaturas" },
];

export function NavBar() {
  const [active, setActive] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80);

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el && window.scrollY >= el.offsetTop - 200) {
          setActive(sections[i].id);
          break;
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: scrolled ? "rgba(5,5,5,0.96)" : "transparent",
        borderBottom: scrolled ? "1px solid rgba(216,211,199,0.12)" : "none",
        transition: "background-color 0.4s ease, border-color 0.4s ease",
        backdropFilter: scrolled ? "blur(12px)" : "none",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 48px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => document.getElementById("cover")?.scrollIntoView({ behavior: "smooth" })}
          style={{
            fontFamily: "'Cinzel', serif",
            color: "#D8D3C7",
            letterSpacing: "0.25em",
            fontSize: 13,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          NAVONA
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 10,
                letterSpacing: "0.15em",
                color: active === s.id ? "#D8D3C7" : "#77736A",
                background: "none",
                border: "none",
                cursor: "pointer",
                transition: "color 0.2s",
              }}
            >
              {s.label.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#D8D3C7" }}
        >
          <div style={{ width: 20, height: 1, backgroundColor: "currentColor", marginBottom: 5 }} />
          <div style={{ width: 20, height: 1, backgroundColor: "currentColor", marginBottom: 5 }} />
          <div style={{ width: 12, height: 1, backgroundColor: "currentColor" }} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            backgroundColor: "#050505",
            borderTop: "1px solid rgba(216,211,199,0.12)",
            padding: "24px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                letterSpacing: "0.15em",
                color: active === s.id ? "#D8D3C7" : "#77736A",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "color 0.2s",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
