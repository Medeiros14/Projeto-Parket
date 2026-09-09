import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Sun, Moon } from "lucide-react";

export function Login() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { mode, t, toggle } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) nav("/", { replace: true });
  }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
    else nav("/", { replace: true });
  }

  const bg = mode === "light"
    ? `radial-gradient(circle at center, ${t.bgPanel} 0%, ${t.bg} 70%)`
    : `radial-gradient(circle at center, #1a1a1a 0%, ${t.bg} 70%)`;

  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: bg, fontFamily: "'DM Sans', sans-serif", position: "relative",
    }}>
      <button onClick={toggle} title={mode === "light" ? "Tema escuro" : "Tema claro"} style={{
        position: "absolute", top: 18, right: 18,
        background: t.bgInput, border: `1px solid ${t.borderStrong}`,
        color: t.textMuted, borderRadius: 6, padding: "6px 10px",
        display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11,
      }}>
        {mode === "light" ? <Moon size={12} /> : <Sun size={12} />}
      </button>

      <form onSubmit={submit} style={{
        width: 360, padding: 32, background: t.bgPanel,
        border: `1px solid ${t.border}`, borderRadius: 12,
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: 4, color: t.text }}>CRONOGRAMA</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4, letterSpacing: 2, textTransform: "uppercase" }}>Parket · Operacional</div>
        </div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@parket.com.br" type="email" required style={inp(t)} autoFocus />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" type="password" required style={inp(t)} />
        {err && <div style={{ fontSize: 12, color: t.danger, textAlign: "center" }}>{err}</div>}
        <button type="submit" disabled={busy} style={{
          background: t.accent, color: t.accentInk, border: "none",
          padding: "12px 18px", borderRadius: 8, fontWeight: 600,
          cursor: "pointer", opacity: busy ? 0.6 : 1, fontSize: 13, letterSpacing: 1,
        }}>
          {busy ? "Entrando…" : "ENTRAR"}
        </button>
      </form>
    </div>
  );
}

const inp = (t: import("../lib/theme").Tokens): React.CSSProperties => ({
  background: t.bgInput,
  border: `1px solid ${t.borderStrong}`,
  color: t.text, padding: "12px 14px", borderRadius: 8,
  fontSize: 14, outline: "none", fontFamily: "inherit",
});
