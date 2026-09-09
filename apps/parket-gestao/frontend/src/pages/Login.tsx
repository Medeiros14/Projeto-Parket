import { useState } from "react";
import { fonts, useTokens } from "../theme";
import { signIn, clearAllAndReload } from "../lib/auth";

export default function Login({ initialError }: { initialError?: string | null }) {
  const t = useTokens();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || "Falha ao entrar");
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: t.bg, border: `1px solid ${t.border1}`,
    color: t.textPrimary, padding: "11px 12px",
    fontFamily: fonts.inter, fontSize: 13, outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", marginBottom: 6,
    fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
    color: t.textTertiary, textTransform: "uppercase",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: t.bg, color: t.textPrimary, fontFamily: fonts.inter, padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 360,
        background: t.card1, border: `1px solid ${t.border1}`,
        padding: "36px 32px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{
            width: 34, height: 34, margin: "0 auto 14px",
            border: `1px solid ${t.accent}`,
            background: "rgba(150,132,115,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent}
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h10M4 18h6" />
            </svg>
          </div>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 15, letterSpacing: "0.22em" }}>PARKET</div>
          <div style={{
            fontSize: 9, letterSpacing: "0.24em", color: t.textTertiary,
            textTransform: "uppercase", marginTop: 5,
          }}>
            Gestor de Projetos · Operacional
          </div>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email</label>
            <input type="email" required autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = t.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = t.border1)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Senha</label>
            <input type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = t.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = t.border1)} />
          </div>

          {error && (
            <div style={{
              marginBottom: 14, padding: "9px 11px", fontSize: 12,
              color: "#c0605c", background: "rgba(192,96,92,0.10)",
              border: "1px solid rgba(192,96,92,0.35)",
            }}>
              <div>{error}</div>
              {/timeout|sessão|cache/i.test(error) && (
                <button type="button" onClick={clearAllAndReload} style={{
                  marginTop: 8, width: "100%", padding: "6px 0", cursor: "pointer",
                  background: "rgba(192,96,92,0.15)", border: "1px solid rgba(192,96,92,0.4)",
                  color: "#c0605c", fontFamily: fonts.inter, fontSize: 11,
                }}>
                  Limpar sessão e recarregar
                </button>
              )}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px 0", cursor: loading ? "wait" : "pointer",
            background: t.accent, border: "none", color: "#0b0b0b",
            fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em",
            textTransform: "uppercase", opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div style={{
          marginTop: 20, textAlign: "center", fontSize: 10,
          color: t.textTertiary, lineHeight: 1.8,
        }}>
          <div>Acesso restrito · credenciais Parket (Space)</div>
          <button type="button" onClick={clearAllAndReload} style={{
            background: "none", border: "none", cursor: "pointer",
            color: t.textTertiary, fontSize: 10, textDecoration: "underline", padding: 0,
          }}>
            Travou? Limpar sessão e recarregar
          </button>
        </div>
      </div>
    </div>
  );
}
