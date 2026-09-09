import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { sb } from "../lib/supabase";

const FONT_BODY = "'Inter', sans-serif";
const FONT_DISPLAY = "'Cinzel', serif";

function firstNameCap(nome: string) {
  const f = nome.trim().split(/\s+/)[0].toLowerCase();
  return f.charAt(0).toUpperCase() + f.slice(1);
}

export function Login({ slug }: { slug?: string }) {
  const { signIn } = useAuth();
  const { mode, T, toggle } = useTheme();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expected, setExpected] = useState<{ id: string; nome: string } | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    sb.rpc("fn_instala_prestador_slug", { p_slug: slug }).then(({ data }) => {
      if (!alive) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.id) setExpected({ id: row.id, nome: row.nome });
    });
    return () => { alive = false; };
  }, [slug]);

  async function attempt(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setErr(null);
    const { error } = await signIn(email, senha, expected ?? undefined);
    setLoading(false);
    if (error) setErr(error);
  }

  // Estilo compartilhado dos dois campos
  const inputStyle: React.CSSProperties = {
    width: "100%", height: 46, padding: "0 12px",
    fontSize: 14, background: T.inputBg, border: `1px solid ${T.border}`,
    color: T.textPrimary, outline: "none", fontFamily: FONT_BODY,
    caretColor: T.textPrimary, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 9, letterSpacing: "0.2em",
    color: T.textMuted, marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, color: T.textPrimary,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_BODY, padding: "0 24px", position: "relative",
      transition: "background .35s, color .35s",
    }}>
      <button onClick={toggle} aria-label="Alternar tema" style={{
        position: "absolute", top: 20, right: 20,
        background: T.statBg, border: `1px solid ${T.border}`,
        color: T.textSecondary, padding: 10, cursor: "pointer", borderRadius: 999,
        display: "flex", alignItems: "center",
      }}>
        {mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 34, letterSpacing: "0.18em",
          color: T.textPrimary, fontWeight: 500,
        }}>PARKET</div>
        <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginTop: 8 }}>
          INSTALADORES
        </p>
      </div>

      <div style={{
        width: "100%", maxWidth: 380,
        border: `1px solid ${T.border}`, background: T.statBg,
        padding: "36px 36px 30px",
      }}>
        {expected && (
          <p style={{
            fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: "0.08em",
            color: T.textPrimary, marginBottom: 10, textAlign: "center",
          }}>
            Olá, {firstNameCap(expected.nome)}
          </p>
        )}
        <p style={{ fontSize: 9, letterSpacing: "0.24em", color: T.textMuted, marginBottom: 22, textAlign: "center" }}>
          ENTRE COM SEU ACESSO
        </p>

        <form onSubmit={attempt}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="login-email" style={labelStyle}>E-MAIL</label>
            <input
              id="login-email" ref={emailRef} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.instalador@parket.com.br"
              autoComplete="username" inputMode="email"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="login-senha" style={labelStyle}>SENHA</label>
            <div style={{ position: "relative" }}>
              <input
                id="login-senha" type={verSenha ? "text" : "password"} value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                type="button" onClick={() => setVerSenha((v) => !v)}
                aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                style={{
                  position: "absolute", right: 0, top: 0, height: 46, width: 44,
                  background: "transparent", border: "none", color: T.textMuted,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {err && <div style={{
            fontSize: 11, color: "#ef4444", textAlign: "center",
            padding: "8px 0", marginBottom: 8,
          }}>{err}</div>}

          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", height: 46, background: T.textPrimary, color: T.bg,
              border: "none", cursor: loading ? "default" : "pointer",
              fontSize: 10, letterSpacing: "0.22em", fontWeight: 600,
              fontFamily: FONT_BODY, opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "ENTRANDO…" : "ENTRAR"}
          </button>
        </form>

        <p style={{ fontSize: 10, color: T.textMuted, textAlign: "center", lineHeight: 1.6, marginTop: 16 }}>
          Você só precisa entrar uma vez neste aparelho.
        </p>
      </div>

      <p style={{ marginTop: 22, fontSize: 10, color: T.textMuted, letterSpacing: "0.1em" }}>
        Esqueceu a senha? Fale com a Parket.
      </p>

      <button onClick={() => nav("/admin")} style={{
        marginTop: 28, background: "transparent", border: "none",
        color: T.textMuted, fontSize: 9, letterSpacing: "0.22em", fontWeight: 600,
        cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4,
        padding: 8,
      }}>
        SOU GESTOR PARKET →
      </button>
    </div>
  );
}
