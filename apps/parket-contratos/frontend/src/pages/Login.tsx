import { useState } from "react";
import { signIn } from "../lib/auth";
import { useTokens, fonts, ACCENT } from "../theme";

export default function Login() {
  const T = useTokens();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [hover, setHover]       = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    try { await signIn(email.trim(), password); }
    catch (e: any) { setErr(e?.message || "Falha no login"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "grid", placeItems: "center", padding: 24, fontFamily: fonts.inter }}>
      <form onSubmit={onSubmit} style={{ width: "100%", maxWidth: 380, background: T.cardBg, border: `1px solid ${T.border}`, padding: 40, backdropFilter: "blur(8px)" }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 22, letterSpacing: "0.24em", color: T.textPrimary, marginBottom: 4 }}>
          CONTRATOS
        </div>
        <div style={{ fontSize: 9, letterSpacing: "0.24em", color: T.textMuted, textTransform: "uppercase", marginBottom: 32 }}>
          gestão de assinaturas · parket
        </div>

        <label style={{ display: "block", fontSize: 9, letterSpacing: "0.20em", color: T.textSecondary, textTransform: "uppercase", marginBottom: 6 }}>Email</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" required
          style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, color: T.textPrimary, padding: "10px 14px", fontSize: 12, letterSpacing: "0.02em", outline: "none", marginBottom: 20, fontFamily: fonts.inter }}
        />

        <label style={{ display: "block", fontSize: 9, letterSpacing: "0.20em", color: T.textSecondary, textTransform: "uppercase", marginBottom: 6 }}>Senha</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" required
          style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, color: T.textPrimary, padding: "10px 14px", fontSize: 12, letterSpacing: "0.02em", outline: "none", marginBottom: 24, fontFamily: fonts.inter }}
        />

        {err && (
          <div style={{ fontSize: 10, color: ACCENT.red, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
            {err}
          </div>
        )}

        <button
          type="submit" disabled={loading}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{
            width: "100%",
            background: loading ? T.textMuted : (hover ? T.textSecondary : T.textPrimary),
            color: T.bg, border: "none", padding: 12,
            fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 500,
            cursor: loading ? "wait" : "pointer",
            transition: "background 0.2s", fontFamily: fonts.inter,
          }}
        >
          {loading ? "entrando…" : "entrar"}
        </button>
      </form>
    </div>
  );
}
