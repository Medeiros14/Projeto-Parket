import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { ThemeMode, ThemeTokens } from "./theme";
import { signIn } from "../../../lib/auth";
import parketLogo from "../../../imports/Captura_de_Tela_2026-06-12_a_s_12.20.58.png";

const FONT_BODY = "'Inter', sans-serif";

interface ParketLoginProps {
  theme: ThemeMode;
  T: ThemeTokens;
  authError?: string | null;
}

export function ParketLogin({ theme, T, authError }: ParketLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovBtn, setHovBtn] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // onAuthStateChange do useAuth assume a partir daqui.
    } catch (e: any) {
      setError(e?.message || "Falha no login.");
      setLoading(false);
    }
  };

  const shownError = error || authError;

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: T.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT_BODY,
      transition: "background 0.35s",
      padding: "0 24px",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <img
          src={parketLogo}
          alt="Parket"
          style={{
            width: 200,
            height: "auto",
            display: "block",
            margin: "0 auto 20px",
            filter: theme === "light" ? "invert(1)" : "none",
            transition: "filter 0.35s",
          }}
        />
        <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>
          SISTEMA OPERACIONAL
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: 380,
        border: `1px solid ${T.border}`,
        backgroundColor: T.statBg,
        padding: "32px 36px 28px",
      }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.24em", color: T.textMuted, marginBottom: 28 }}>
          ACESSE SUA CONTA
        </p>

        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.18em", color: T.textSecondary, marginBottom: 8 }}>
            EMAIL
          </p>
          <input
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{
              width: "100%",
              padding: "10px 14px",
              backgroundColor: T.inputBg,
              border: `1px solid ${T.border}`,
              color: T.textPrimary,
              fontFamily: FONT_BODY,
              fontSize: 12,
              outline: "none",
              boxSizing: "border-box",
              letterSpacing: "0.02em",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = String(T.borderHover))}
            onBlur={(e) => (e.currentTarget.style.borderColor = String(T.border))}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.18em", color: T.textSecondary, marginBottom: 8 }}>
            SENHA
          </p>
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={{
                width: "100%",
                padding: "10px 40px 10px 14px",
                backgroundColor: T.inputBg,
                border: `1px solid ${T.border}`,
                color: T.textPrimary,
                fontFamily: FONT_BODY,
                fontSize: 12,
                outline: "none",
                boxSizing: "border-box",
                letterSpacing: "0.06em",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = String(T.borderHover))}
              onBlur={(e) => (e.currentTarget.style.borderColor = String(T.border))}
            />
            <button
              onClick={() => setShowPass((v) => !v)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: T.textMuted, display: "flex", padding: 2,
              }}
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {shownError && (
          <p style={{
            fontFamily: FONT_BODY, fontSize: 10, color: "#B0563C",
            letterSpacing: "0.04em", marginBottom: 16, lineHeight: 1.5,
          }}>
            {shownError}
          </p>
        )}

        {/* Button */}
        <button
          onClick={handleLogin}
          onMouseEnter={() => setHovBtn(true)}
          onMouseLeave={() => setHovBtn(false)}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: loading ? T.cardHover : hovBtn ? T.textSecondary : T.textPrimary,
            border: "none",
            cursor: loading ? "default" : "pointer",
            fontFamily: FONT_BODY,
            fontSize: 10,
            letterSpacing: "0.22em",
            color: T.bg,
            transition: "background 0.2s",
          }}
        >
          {loading ? "ENTRANDO..." : "ENTRAR"}
        </button>
      </div>

      {/* Footer */}
      <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.12em", color: T.textMuted, marginTop: 32 }}>
        © 2026 Parket · Acesso restrito a colaboradores
      </p>
    </div>
  );
}
