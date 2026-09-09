/** Shell da Central do Cliente — header fixo + nav + views.
 *  Estrutura visual portada do Command Center (Figma), dados 100% do gestão. */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { api, setCenterKey, clearCenterKey, type CenterData, fmtDataHora } from "./api";
import { DARK, LIGHT, sans, serif } from "./theme";
import { useMobile } from "./useMobile";
import { DashboardView } from "./components/DashboardView";
import { DocumentView } from "./components/DocumentView";
import { CronogramaView } from "./components/CronogramaView";
import { AcompanhamentoView } from "./components/AcompanhamentoView";
import { AvaliacaoView } from "./components/AvaliacaoView";
import { FinanceiroView } from "./components/FinanceiroView";
import { VALIDADOR_KEY } from "./components/ChecklistObras";

export type ViewType = "dashboard" | "document" | "cronograma" | "acompanhamento" | "avaliacao" | "financeiro";

/* chave v2: a v1 auto-persistia "dark" no primeiro acesso, prendendo clientes no escuro */
const THEME_KEY = "parket-center-theme-v2";

// Cada view vive numa rota própria: /<token>, /<token>/documentos/<etapa>,
// /<token>/cronograma, /<token>/acompanhamento, /<token>/avaliacao, /<token>/financeiro.
// Documentos Fiscais (NFe) moram como seção dentro do Financeiro — sem rota própria.
const VIEW_PATH: Record<string, ViewType> = {
  documentos: "document", cronograma: "cronograma",
  acompanhamento: "acompanhamento", avaliacao: "avaliacao",
  financeiro: "financeiro",
};

export function App() {
  const params = useParams<{ token: string; "*": string }>();
  const token = params.token;
  const [seg, segEtapa] = (params["*"] || "").split("/");
  const view: ViewType = VIEW_PATH[seg] || "dashboard";
  const docEtapa = Number(segEtapa) || 2;
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => localStorage.getItem(THEME_KEY) === "dark");
  const [data, setData] = useState<CenterData | null>(null);
  const [erro, setErro] = useState("");
  const [precisaLogin, setPrecisaLogin] = useState(false);
  const mob = useMobile();

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, isDark ? "dark" : "light"); } catch {}
  }, [isDark]);

  useEffect(() => { window.scrollTo(0, 0); }, [view, docEtapa]);

  const load = () => {
    if (!token) { setErro("Link inválido."); return; }
    api.center(token)
      .then(d => { setData(d); setPrecisaLogin(false); })
      .catch((e: Error) => {
        if (e.message === "401") { clearCenterKey(token); setPrecisaLogin(true); }
        else setErro("Link inválido ou expirado.");
      });
  };
  useEffect(load, [token]);

  const c = isDark ? DARK : LIGHT;
  // Header com o fundo INVERTIDO em relação ao tema (Will 13/07): claro no dark, escuro no light.
  const hc = isDark ? LIGHT : DARK;
  const headerBg = isDark ? "#EEE9E2" : "#131313";

  const setView = (v: ViewType) => {
    const base = `/${token}`;
    navigate(v === "dashboard" ? base
      : v === "document" ? `${base}/documentos/${docEtapa}`
      : `${base}/${v}`);
  };
  const openDoc = (etapa: number) => navigate(`/${token}/documentos/${etapa}`);

  if (precisaLogin && token) {
    return <LoginView c={c} token={token} onOk={load} />;
  }

  if (erro || !data) {
    return (
      <div style={{
        background: c.bg, minHeight: "100vh", color: c.textPrimary, fontFamily: sans,
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18,
      }}>
        <div style={{ fontSize: 14, fontWeight: 300, letterSpacing: "0.38em", textTransform: "uppercase" }}>PARKET</div>
        <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: c.textTertiary }}>
          {erro || "Carregando central do cliente…"}
        </div>
      </div>
    );
  }

  const p = data.projeto;

  return (
    <div style={{
      background: c.bg, minHeight: "100vh", color: c.textPrimary, fontFamily: sans,
      ["--pkt-border" as string]: c.border1,
    } as React.CSSProperties}>
      {/* ── Fixed Header ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: mob ? 64 : 88, background: headerBg,
        borderBottom: `1px solid ${c.border1}`, display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, padding: "0 var(--pkt-pad-x)", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <span
            onClick={() => setView("dashboard")}
            title="Voltar à visão geral"
            style={{
              fontSize: mob ? 14 : 20, fontWeight: 300,
              letterSpacing: mob ? "0.24em" : "0.38em", textTransform: "uppercase",
              color: hc.textPrimary, cursor: "pointer", whiteSpace: "nowrap",
            }}>
            PARKET
          </span>
        </div>

        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div style={{
            fontFamily: serif, fontSize: mob ? 15 : 24, fontWeight: 400, color: hc.textPrimary,
            lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {p.cliente}
          </div>
          {p.numero_proposta && (
            <div style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: hc.textTertiary, marginTop: 3 }}>
              Obra #{p.numero_proposta}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
          <button
            onClick={() => setIsDark(!isDark)}
            aria-label={isDark ? "Modo Claro" : "Modo Escuro"}
            style={{
              background: "none", border: `1px solid ${hc.border2}`, color: hc.textSecondary,
              cursor: "pointer", padding: mob ? "8px 10px" : "7px 14px", display: "flex", alignItems: "center",
              gap: 7, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
            {isDark ? <Sun size={12} strokeWidth={1.5} /> : <Moon size={12} strokeWidth={1.5} />}
            {!mob && <span>{isDark ? "Modo Claro" : "Modo Escuro"}</span>}
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ paddingTop: mob ? 64 : 88 }}>
        {view === "dashboard" && (
          <DashboardView
            data={data} c={c} isDark={isDark} token={token}
            onOpenDoc={openDoc}
            onViewCronograma={() => setView("cronograma")}
            onViewAcompanhamento={() => setView("acompanhamento")}
            onViewAvaliacao={() => setView("avaliacao")}
            onViewFinanceiro={() => setView("financeiro")}
          />
        )}
        {view === "document" && (
          <DocumentView data={data} c={c} isDark={isDark} etapa={docEtapa} token={token!}
            onVoltar={() => setView("dashboard")} onOpenDoc={openDoc} />
        )}
        {view === "cronograma" && (
          <CronogramaView data={data} c={c} isDark={isDark} onVoltar={() => setView("dashboard")} />
        )}
        {view === "acompanhamento" && (
          <AcompanhamentoView data={data} c={c} isDark={isDark} token={token!} onVoltar={() => setView("dashboard")} />
        )}
        {view === "avaliacao" && (
          <AvaliacaoView data={data} c={c} isDark={isDark} token={token!} onEnviada={load} />
        )}
        {view === "financeiro" && (
          <FinanceiroView data={data} c={c} isDark={isDark} token={token!} onVoltar={() => setView("dashboard")} />
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `1px solid ${c.border1}`, padding: "24px var(--pkt-pad-x)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", fontSize: 10, color: c.textTertiary,
      }}>
        <span>Última atualização: {fmtDataHora(p.updated_at)}</span>
        <span>
          {[p.arquiteto && `Responsável: ${p.arquiteto}`, p.vendedor && `Vendedor: ${p.vendedor}`]
            .filter(Boolean).join(" · ") || "Parket · Atendimento"}
        </span>
      </footer>
    </div>
  );
}

/* ── Login do cliente — nome e sobrenome + senha única do projeto ── */
function LoginView({ c, token, onOk }: { c: typeof DARK; token: string; onOk: () => void }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const entrar = async () => {
    if (!usuario.trim() || !senha.trim() || enviando) return;
    setEnviando(true); setErro("");
    try {
      const r = await api.login(token, { usuario: usuario.trim(), senha: senha.trim() });
      setCenterKey(token, r.key);
      // Quem logou é quem valida o checklist — papel escolhido na assinatura.
      try {
        const prev = JSON.parse(localStorage.getItem(VALIDADOR_KEY) || "{}") || {};
        localStorage.setItem(VALIDADOR_KEY, JSON.stringify({ nome: usuario.trim(), papel: prev.papel || "" }));
      } catch {}
      onOk();
    } catch {
      setErro("Usuário ou senha inválidos.");
    } finally {
      setEnviando(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: "transparent",
    border: `1px solid ${c.border2}`, color: c.textPrimary, fontFamily: sans,
    fontSize: 13, padding: "12px 14px", outline: "none", letterSpacing: "0.02em",
  };
  const lbl: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
    color: c.textTertiary, marginBottom: 6,
  };

  return (
    <div style={{
      background: c.bg, minHeight: "100vh", color: c.textPrimary, fontFamily: sans,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 15, fontWeight: 300, letterSpacing: "0.38em", textTransform: "uppercase" }}>PARKET</div>
          <div style={{ fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", color: c.textTertiary, marginTop: 8 }}>
            Central do Cliente · Acesso restrito
          </div>
        </div>
        <form onSubmit={e => { e.preventDefault(); entrar(); }}
              style={{ border: `1px solid ${c.border1}`, background: c.card1, padding: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={lbl}>Nome e sobrenome</div>
            <input style={inp} value={usuario} onChange={e => setUsuario(e.target.value)}
                   placeholder="Ex.: Maria Silva" autoFocus autoComplete="username" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={lbl}>Senha</div>
            <input style={inp} type="password" value={senha} onChange={e => setSenha(e.target.value)}
                   placeholder="Senha enviada pela Parket" autoComplete="current-password" />
          </div>
          {erro && (
            <div style={{ fontSize: 11, color: "#C07A4A", marginBottom: 14, letterSpacing: "0.05em" }}>{erro}</div>
          )}
          <button type="submit" disabled={enviando || !usuario.trim() || !senha.trim()} style={{
            width: "100%", background: c.accent, color: c.bg, border: "none",
            padding: "13px 18px", fontFamily: sans, fontSize: 10, letterSpacing: "0.25em",
            textTransform: "uppercase", cursor: enviando ? "wait" : "pointer",
            opacity: enviando || !usuario.trim() || !senha.trim() ? 0.55 : 1,
          }}>
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <div style={{ textAlign: "center", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: c.textTertiary, marginTop: 20 }}>
          Suas credenciais foram enviadas pela equipe Parket
        </div>
      </div>
    </div>
  );
}
