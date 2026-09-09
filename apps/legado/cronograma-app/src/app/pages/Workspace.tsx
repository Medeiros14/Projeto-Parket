import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { TabelaCronograma } from "../components/TabelaCronograma";
import { LogOut, Calendar, Hammer, Wrench, Sun, Moon } from "lucide-react";

type Tipo = "obras" | "marcenaria" | "reparos";

const TABS: { id: Tipo; label: string; icon: typeof Calendar; sub: string }[] = [
  { id: "obras", label: "Obras", icon: Calendar, sub: "Instalação" },
  { id: "marcenaria", label: "Marcenaria", icon: Hammer, sub: "Estrutura" },
  { id: "reparos", label: "Reparos", icon: Wrench, sub: "Atendimentos" },
];

export function Workspace() {
  const { profile, signOut } = useAuth();
  const { mode, t, toggle } = useTheme();
  const [tipo, setTipo] = useState<Tipo>("obras");

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Sans', sans-serif", transition: "background 0.2s, color 0.2s" }}>
      <header style={{
        padding: "16px 28px", borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: 3 }}>CRONOGRAMA</div>
          <div style={{ fontSize: 9, color: t.textMuted, textTransform: "uppercase", letterSpacing: 2, marginTop: 2 }}>
            Parket · Operacional
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, color: t.textMuted }}>
            {profile?.full_name || profile?.email}
          </div>
          <button onClick={toggle} title={mode === "light" ? "Tema escuro" : "Tema claro"} style={{
            background: t.bgInput, border: `1px solid ${t.borderStrong}`,
            color: t.textMuted, borderRadius: 6, padding: "6px 10px",
            display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11,
          }}>
            {mode === "light" ? <Moon size={12} /> : <Sun size={12} />}
          </button>
          <button onClick={signOut} title="Sair" style={{
            background: t.bgInput, border: `1px solid ${t.borderStrong}`,
            color: t.textMuted, borderRadius: 6, padding: "6px 10px",
            display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11,
          }}>
            <LogOut size={12} /> Sair
          </button>
        </div>
      </header>

      <nav style={{
        padding: "0 28px", borderBottom: `1px solid ${t.border}`,
        display: "flex", gap: 4,
      }}>
        {TABS.map((tab) => {
          const active = tipo === tab.id;
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setTipo(tab.id)} style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: "14px 20px", color: active ? t.accent : t.textMuted,
              borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
              marginBottom: -1, display: "flex", alignItems: "center", gap: 8,
              fontSize: 13, fontWeight: 500,
            }}>
              <Icon size={14} />
              <div style={{ textAlign: "left" }}>
                <div>{tab.label}</div>
                <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1, textTransform: "uppercase" }}>{tab.sub}</div>
              </div>
            </button>
          );
        })}
      </nav>

      <main style={{ padding: "20px 28px" }}>
        <TabelaCronograma tipo={tipo} />
      </main>
    </div>
  );
}
