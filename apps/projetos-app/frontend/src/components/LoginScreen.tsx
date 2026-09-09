import { useState } from "react";
import { api, HttpError, type AppUser } from "../api";

/* Tela de login do projetos.parket.works. Valida contra user_profiles
   do Space (padrão dept_permissions._senha da casa). */
export default function LoginScreen({ t, onLogin }: {
  t: any; onLogin: (u: AppUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(""); setEntrando(true);
    try {
      const { usuario } = await api.authLogin(email.trim(), senha);
      onLogin(usuario);
    } catch (e) {
      setErro(e instanceof HttpError ? e.detail : String(e));
      setEntrando(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: t.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <form onSubmit={submit} style={{
        width: 380, maxWidth: "100%",
        background: t.card1, border: `1px solid ${t.border2}`,
        padding: "32px 28px", display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.2em",
          textTransform: "uppercase", color: t.textTertiary, textAlign: "center",
        }}>
          PARKET · SETOR PROJETOS
        </div>
        <div style={{
          fontSize: 20, fontWeight: 600, color: t.textPrimary,
          textAlign: "center", marginBottom: 8, letterSpacing: "0.02em",
        }}>
          Entrar
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: t.textTertiary,
          }}>
            E-mail
          </span>
          <input autoFocus type="email" value={email}
            onChange={e => setEmail(e.target.value)} required
            style={inp(t)} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: t.textTertiary,
          }}>
            Senha
          </span>
          <input type="password" value={senha}
            onChange={e => setSenha(e.target.value)} required
            style={inp(t)} />
        </label>

        {erro && (
          <div style={{
            fontSize: 11, color: "#EF4444", padding: "8px 10px",
            background: "#EF444414", border: "1px solid #EF444444",
          }}>
            {erro}
          </div>
        )}

        <button type="submit" disabled={entrando || !email || !senha}
          style={{
            background: t.accent, color: "#fff", border: "none",
            padding: "10px 16px", fontSize: 12, fontWeight: 600,
            letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: entrando ? "wait" : "pointer",
            opacity: (entrando || !email || !senha) ? 0.6 : 1,
            marginTop: 6,
          }}>
          {entrando ? "Entrando…" : "Entrar"}
        </button>

        <div style={{
          fontSize: 10, color: t.textTertiary, textAlign: "center",
          marginTop: 8, lineHeight: 1.5,
        }}>
          Usuários gerenciados no <b>Space</b> (hub central).<br />
          Se não consegue entrar, peça pro admin liberar seu acesso ao setor Projetos.
        </div>
      </form>
    </div>
  );
}

function inp(t: any): React.CSSProperties {
  return {
    background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textPrimary,
    fontSize: 13, padding: "9px 11px", outline: "none",
  };
}
