import { useState, useEffect } from "react";
import { BPCover } from "./components/bp/BPCover";
import { BPEmpresa } from "./components/bp/BPEmpresa";
import { BPProduto } from "./components/bp/BPProduto";
import { BPOportunidade } from "./components/bp/BPOportunidade";
import { BPOperacionalComercial } from "./components/bp/BPOperacionalComercial";
import { BPFinanceiro } from "./components/bp/BPFinanceiro";

const navItems = [
  { id: "bp-empresa", label: "01 A Empresa" },
  { id: "bp-produto", label: "02 O Produto" },
  { id: "bp-oportunidade", label: "03 Oportunidade" },
  { id: "bp-proposta", label: "04 Proposta" },
  { id: "bp-receita", label: "05 Receita" },
  { id: "bp-operacional", label: "06 Operacional" },
  { id: "bp-comercial", label: "07 Comercial" },
  { id: "bp-org", label: "08 Organização" },
  { id: "bp-financeiro", label: "09 Financeiro" },
];

export function BusinessPlan({ onBack }: { onBack?: () => void }) {
  const [active, setActive] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80);
      for (let i = navItems.length - 1; i >= 0; i--) {
        const el = document.getElementById(navItems[i].id);
        if (el && window.scrollY >= el.offsetTop - 200) {
          setActive(navItems[i].id);
          break;
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{ backgroundColor: "#050505" }}>
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: scrolled ? "rgba(5,5,5,0.96)" : "rgba(5,5,5,0.9)",
        borderBottom: "1px solid rgba(216,211,199,0.08)",
        backdropFilter: "blur(12px)",
        transition: "background-color 0.4s ease",
      }}>
        <div style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 48px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}>
          <button
            onClick={onBack}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9,
              letterSpacing: "0.2em",
              color: "#77736A",
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color 0.2s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#D8D3C7")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#77736A")}
          >
            ← CENTRAL
          </button>
          <p style={{ fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: "0.25em", color: "#D8D3C7" }}>
            NAVONA
          </p>
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  color: active === n.id ? "#D8D3C7" : "#77736A",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 0.2s",
                }}
              >
                {n.label.split(" ")[0]}
              </button>
            ))}
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.14em", color: "#77736A", whiteSpace: "nowrap" }}>
            PLANO DE NEGÓCIOS
          </p>
        </div>
      </nav>

      <BPCover />
      <BPEmpresa />
      <BPProduto />
      <BPOportunidade />
      <BPOperacionalComercial />
      <BPFinanceiro />
    </div>
  );
}
