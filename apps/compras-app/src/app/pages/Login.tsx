import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { useNavigate, useLocation } from "react-router-dom";

export default function Login() {
  const { t } = useTheme();
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const redirect = (loc.state as any)?.from || "/";

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await login(email, pass);
      nav(redirect, { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: t.bg, color: t.textPrimary, padding: 24 }}>
      <form onSubmit={onSubmit} style={{
        width: 360, padding: 32, borderRadius: 0,
        background: t.bgElevated, border: `1px solid ${t.border}`,
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 32, letterSpacing: "0.22em" }}>PARKET</div>
          <div style={{ fontSize: 10, letterSpacing: "0.4em", color: t.textMuted, marginTop: 4 }}>COMPRAS · SUPPLY CHAIN</div>
        </div>

        <label style={lblStyle(t)}>
          E-mail Parket
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoFocus style={inpStyle(t)} />
        </label>
        <label style={lblStyle(t)}>
          Senha
          <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" required style={inpStyle(t)} />
        </label>

        {err && <div style={{ color: t.danger, fontSize: 12, padding: "6px 10px", background: "rgba(248,113,113,0.08)", borderRadius: 0 }}>{err}</div>}

        <button disabled={loading} type="submit" style={{
          background: t.accent, color: t.bg, border: "none", padding: "12px 18px",
          borderRadius: 0, fontWeight: 600, cursor: "pointer", fontSize: 14, marginTop: 6,
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <div style={{ textAlign: "center", color: t.textMuted, fontSize: 11, marginTop: 4 }}>
          SSO via Parket — use sua credencial do Space.
        </div>
      </form>
    </div>
  );
}

function lblStyle(t: any): React.CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: t.textSecondary };
}
function inpStyle(t: any): React.CSSProperties {
  return {
    padding: "10px 12px", borderRadius: 0,
    background: t.inputBg, border: `1px solid ${t.border}`,
    color: t.textPrimary, fontSize: 14, outline: "none",
  };
}
