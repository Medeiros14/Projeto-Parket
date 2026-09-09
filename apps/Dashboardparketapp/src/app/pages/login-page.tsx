import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const BG = "#0A0A0A";
const CARD_BG = "#111111";
const BORDER = "rgba(255,255,255,0.06)";
const ACCENT = "#D4A853";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";
const RED = "#EF4444";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError("Email ou senha incorretos. Verifique suas credenciais.");
      setLoading(false);
    } else {
      navigate(from, { replace: true });
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: BG, fontFamily: "'Inter', sans-serif" }}
    >
      {/* Background glow */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,168,83,0.06) 0%, transparent 70%)",
      }} />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.2)" }}
          >
            <span style={{ fontSize: "1.8rem", fontWeight: 800, color: ACCENT, letterSpacing: "-0.05em" }}>P</span>
          </div>
          <h1 style={{ color: "white", fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 4 }}>
            Parket Dashboard
          </h1>
          <p style={{ fontSize: "0.72rem", color: TEXT_DIM }}>
            Sistema Operacional Interno
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{ background: CARD_BG, border: `1px solid ${BORDER}`, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
        >
          <p style={{ fontSize: "0.65rem", color: TEXT_MED, fontWeight: 500, letterSpacing: "0.1em", marginBottom: 20 }}>
            ACESSE SUA CONTA
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: "0.6rem", color: TEXT_DIM, fontWeight: 500, letterSpacing: "0.08em", marginBottom: 6 }}>
                EMAIL
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@parket.com.br"
                  required
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${BORDER}`, borderRadius: 10,
                    color: "white", fontSize: "0.8rem",
                    padding: "10px 12px 10px 36px",
                    outline: "none", transition: "border-color 0.15s",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(212,168,83,0.45)")}
                  onBlur={e => (e.target.style.borderColor = BORDER)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: "0.6rem", color: TEXT_DIM, fontWeight: 500, letterSpacing: "0.08em", marginBottom: 6 }}>
                SENHA
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${BORDER}`, borderRadius: 10,
                    color: "white", fontSize: "0.8rem",
                    padding: "10px 40px 10px 36px",
                    outline: "none", transition: "border-color 0.15s",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(212,168,83,0.45)")}
                  onBlur={e => (e.target.style.borderColor = BORDER)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
              >
                <AlertCircle size={13} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: "0.65rem", color: RED, lineHeight: 1.5 }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "11px",
                background: loading ? "rgba(212,168,83,0.25)" : ACCENT,
                color: loading ? "rgba(255,255,255,0.4)" : "#0A0A0A",
                border: "none", borderRadius: 10,
                fontSize: "0.78rem", fontWeight: 700,
                letterSpacing: "0.06em",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                marginTop: 8,
              }}
            >
              {loading ? "Entrando…" : "ENTRAR"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: "0.55rem", color: TEXT_DIM, marginTop: 20 }}>
          © {new Date().getFullYear()} Parket · Acesso restrito a colaboradores
        </p>
      </div>
    </div>
  );
}
