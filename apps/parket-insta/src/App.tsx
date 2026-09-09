import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, viewer } from "./api";
import type { InstaPerfilDetalhe, InstaPerfilResumo, InstaPost } from "./api";
import { Avatar, PostCard, SeloConcluido, useTituloDocumento } from "./PostCard";
import { fonts, hd, isDark, MAXW, setDark, t } from "./theme";

function Shell({ children, semNav }: { children: React.ReactNode; semNav?: boolean }) {
  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: fonts.body }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: `0 0 ${semNav ? 24 : 76}px` }}>
        {children}
      </div>
    </div>
  );
}

function Wordmark({ size = 14 }: { size?: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: 300, letterSpacing: "0.3em",
                   textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <span style={{ color: hd.text2 }}>Insta</span>
      <span style={{ color: hd.text }}>Parket</span>
    </span>
  );
}

function ThemeToggle() {
  const [dark, setDarkState] = useState(isDark());
  const alternar = () => { setDark(!dark); setDarkState(!dark); };
  return (
    <button onClick={alternar} title={dark ? "Tema claro" : "Tema escuro"}
            aria-label={dark ? "Tema claro" : "Tema escuro"}
            style={{ background: "none", border: `1px solid ${hd.border}`, color: hd.text2,
                     width: 32, height: 32, display: "flex", alignItems: "center",
                     justifyContent: "center", cursor: "pointer", padding: 0 }}>
      {dark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

function Header({ direita }: { direita?: React.ReactNode }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: hd.bg,
                     borderBottom: `1px solid ${t.border}`,
                     display: "flex", alignItems: "center", justifyContent: "space-between",
                     padding: "16px 16px", paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
      <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "baseline" }}>
        <Wordmark />
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ThemeToggle />
        {direita}
      </div>
    </header>
  );
}

function BottomNav({ ativo }: { ativo: "feed" | "perfis" }) {
  const item = (rota: string, label: string, on: boolean, icone: React.ReactNode) => (
    <Link to={rota} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                             gap: 5, textDecoration: "none", color: on ? t.accent : t.text3,
                             padding: "11px 0 5px", fontSize: 9, fontWeight: 500,
                             letterSpacing: "0.2em", textTransform: "uppercase" }}>
      {icone}{label}
    </Link>
  );
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
                  background: t.navBg, backdropFilter: "blur(8px)",
                  borderTop: `1px solid ${t.border}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", display: "flex" }}>
        {item("/", "Feed", ativo === "feed", (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
          </svg>
        ))}
        {item("/perfis", "Perfis", ativo === "perfis", (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
        ))}
      </div>
    </nav>
  );
}

function Login({ aoEntrar }: { aoEntrar: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && senha.length > 0;

  async function entrar() {
    if (!ok || carregando) return;
    setErro("");
    setCarregando(true);
    try {
      await viewer.entrar(email, senha);
      aoEntrar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }
  const campo: React.CSSProperties = {
    width: "100%", background: "transparent", border: `1px solid ${t.border2}`,
    color: t.text, fontSize: 13, padding: "12px 14px", outline: "none",
    fontFamily: fonts.body, letterSpacing: "0.02em",
  };
  const lbl: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
    color: t.text3, marginBottom: 6,
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 24, background: t.bg, color: t.text, fontFamily: fonts.body }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: "0.32em", textTransform: "uppercase" }}>
            <span style={{ color: t.text3 }}>Insta</span><span>Parket</span>
          </div>
          <div style={{ fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase",
                        color: t.text3, marginTop: 8 }}>
            O dia a dia dos projetos Parket
          </div>
        </div>
        <div style={{ border: `1px solid ${t.border}`, background: t.card, padding: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={lbl}>Email Parket</div>
            <input style={campo} placeholder="voce@parket.com.br" value={email} type="email"
                   onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={lbl}>Senha</div>
            <input style={campo} placeholder="••••••••" value={senha} type="password"
                   onChange={(e) => setSenha(e.target.value)} autoComplete="current-password"
                   onKeyDown={(e) => e.key === "Enter" && entrar()} />
          </div>
          {erro && (
            <div style={{ color: t.danger, fontSize: 11, letterSpacing: "0.04em",
                          marginBottom: 16, lineHeight: 1.6 }}>
              {erro}
            </div>
          )}
          <button disabled={!ok || carregando}
                  onClick={entrar}
                  style={{ width: "100%", background: t.accent, color: t.bg, border: "none",
                           padding: "13px 18px", fontFamily: fonts.body, fontSize: 10,
                           letterSpacing: "0.25em", textTransform: "uppercase",
                           cursor: ok && !carregando ? "pointer" : "default",
                           opacity: ok && !carregando ? 1 : 0.55 }}>
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </div>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                      color: t.text3, textAlign: "center", marginTop: 20, lineHeight: 2 }}>
          SSO Parket · mesma credencial do Space · Clientes acessam pelo link exclusivo
        </div>
      </div>
    </div>
  );
}

function ixInterno(aoExigirLogin: () => void) {
  return {
    curtir: (id: string) => api.curtir(id),
    comentarios: (id: string) => api.comentarios(id),
    comentar: (id: string, tx: string) => api.comentar(id, tx),
    podeInteragir: !!viewer.email(),
    aoExigirLogin,
  };
}

function FeedPage() {
  useTituloDocumento("InstaParket");
  const nav = useNavigate();
  const [posts, setPosts] = useState<InstaPost[] | null>(null);
  const [erro, setErro] = useState("");
  const [fim, setFim] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const PAGE = 20;

  useEffect(() => {
    api.feed(PAGE, 0)
      .then((p) => { setPosts(p); setFim(p.length < PAGE); })
      .catch((e) => setErro(e.message));
  }, []);

  async function mais() {
    if (!posts || carregandoMais || fim) return;
    setCarregandoMais(true);
    try {
      const p = await api.feed(PAGE, posts.length);
      setPosts([...posts, ...p]);
      if (p.length < PAGE) setFim(true);
    } finally {
      setCarregandoMais(false);
    }
  }

  const ix = useMemo(() => ixInterno(() => nav("/entrar")), [nav]);

  return (
    <Shell>
      <Header direita={<UserChip />} />
      <main style={{ padding: "18px 12px 0" }}>
        {erro && <Aviso texto={erro} />}
        {posts === null && !erro && <Aviso texto="Carregando…" />}
        {posts?.length === 0 && (
          <Aviso texto="Nenhum post ainda. A curadoria publica por aqui em breve." />
        )}
        {posts?.map((p) => (
          <PostCard key={p.id} post={p} ix={ix} aoAbrirPerfil={(pid) => nav(`/perfil/${pid}`)} />
        ))}
        {posts && posts.length > 0 && !fim && (
          <button onClick={mais}
                  style={{ width: "100%", background: t.card, border: `1px solid ${t.border}`,
                           color: t.text2, fontSize: 10, letterSpacing: "0.2em",
                           textTransform: "uppercase", fontFamily: fonts.body,
                           padding: "13px 0", cursor: "pointer", marginBottom: 16 }}>
            {carregandoMais ? "Carregando…" : "Ver mais"}
          </button>
        )}
      </main>
      <BottomNav ativo="feed" />
    </Shell>
  );
}

function UserChip() {
  const nav = useNavigate();
  const nome = viewer.nome();
  if (!nome) {
    return (
      <button onClick={() => nav("/entrar")}
              style={{ background: "none", border: `1px solid ${hd.border}`, color: hd.accent,
                       fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                       fontFamily: fonts.body, padding: "7px 14px", cursor: "pointer" }}>
        Entrar
      </button>
    );
  }
  return (
    <button onClick={() => { if (confirm("Sair do InstaParket?")) { viewer.sair(); nav("/entrar"); } }}
            title={viewer.email() || ""}
            style={{ background: "none", border: `1px solid ${hd.border}`, color: hd.text2,
                     fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
                     fontFamily: fonts.body, padding: "7px 12px", cursor: "pointer",
                     maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis",
                     whiteSpace: "nowrap" }}>
      {nome.split(" ")[0]}
    </button>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div style={{ color: t.text3, fontSize: 11, letterSpacing: "0.08em", textAlign: "center",
                  padding: "56px 24px", lineHeight: 1.8 }}>
      {texto}
    </div>
  );
}

function PerfisPage() {
  useTituloDocumento("Perfis — InstaParket");
  const [perfis, setPerfis] = useState<InstaPerfilResumo[] | null>(null);
  const [q, setQ] = useState("");
  const nav = useNavigate();

  useEffect(() => { api.perfis().then(setPerfis).catch(() => setPerfis([])); }, []);

  const filtrados = useMemo(() => {
    if (!perfis) return null;
    const qq = q.trim().toLowerCase();
    return qq ? perfis.filter((p) => p.cliente.toLowerCase().includes(qq)) : perfis;
  }, [perfis, q]);

  return (
    <Shell>
      <Header direita={<UserChip />} />
      <main style={{ padding: "18px 12px 0" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar perfil…"
               style={{ width: "100%", background: "transparent", border: `1px solid ${t.border}`,
                        color: t.text, fontSize: 13, padding: "12px 14px",
                        outline: "none", fontFamily: fonts.body, marginBottom: 16 }} />
        {filtrados === null && <Aviso texto="Carregando…" />}
        {filtrados?.length === 0 && <Aviso texto="Nenhum perfil com posts ainda." />}
        {filtrados?.map((p) => (
          <div key={p.projeto_id} onClick={() => nav(`/perfil/${p.projeto_id}`)}
               style={{ display: "flex", alignItems: "center", gap: 14, background: t.card,
                        border: `1px solid ${t.border}`, padding: "14px 16px",
                        marginBottom: 10, cursor: "pointer" }}>
            <Avatar url={p.avatar_url} nome={p.cliente} size={44} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: fonts.brand, fontWeight: 500, fontSize: 17,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.cliente}
              </div>
              <div style={{ color: t.text3, fontSize: 9, letterSpacing: "0.18em",
                            textTransform: "uppercase", marginTop: 4 }}>
                {p.posts} post{p.posts !== 1 ? "s" : ""}
              </div>
            </div>
            {p.concluido && <SeloConcluido mini />}
          </div>
        ))}
      </main>
      <BottomNav ativo="perfis" />
    </Shell>
  );
}

function PerfilCabecalho({ perfil }: { perfil: InstaPerfilDetalhe }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "24px 16px 18px",
                  borderBottom: `1px solid ${t.border2}`, marginBottom: 18 }}>
      <Avatar url={perfil.avatar_url} nome={perfil.cliente} size={72} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: fonts.brand, fontWeight: 400, fontSize: 24, lineHeight: 1.15 }}>
          {perfil.cliente}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 7 }}>
          <span style={{ color: t.text3, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            {perfil.posts.length} post{perfil.posts.length !== 1 ? "s" : ""}
          </span>
          {perfil.concluido && <SeloConcluido />}
        </div>
      </div>
    </div>
  );
}

function PerfilPage() {
  const { pid } = useParams();
  const nav = useNavigate();
  const [perfil, setPerfil] = useState<InstaPerfilDetalhe | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (pid) api.perfil(pid).then(setPerfil).catch((e) => setErro(e.message));
  }, [pid]);
  useTituloDocumento(perfil ? `${perfil.cliente} — InstaParket` : "InstaParket");

  const ix = useMemo(() => ixInterno(() => nav("/entrar")), [nav]);

  return (
    <Shell>
      <Header direita={<UserChip />} />
      {erro && <Aviso texto={erro} />}
      {!perfil && !erro && <Aviso texto="Carregando…" />}
      {perfil && (
        <>
          <PerfilCabecalho perfil={perfil} />
          <main style={{ padding: "0 12px" }}>
            {perfil.posts.length === 0 && <Aviso texto="Ainda sem posts neste perfil." />}
            {perfil.posts.map((p) => (
              <PostCard key={p.id} post={{ ...p, avatar_url: perfil.avatar_url }} ix={ix} />
            ))}
          </main>
        </>
      )}
      <BottomNav ativo="perfis" />
    </Shell>
  );
}

function ClientePage() {
  const { token } = useParams();
  const [perfil, setPerfil] = useState<InstaPerfilDetalhe | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (token) api.publico.perfil(token).then(setPerfil).catch((e) => setErro(e.message));
  }, [token]);
  useTituloDocumento(perfil ? `${perfil.cliente} — InstaParket` : "InstaParket");

  const ix = useMemo(() => ({
    curtir: (id: string) => api.publico.curtir(token!, id),
    comentarios: (id: string) => api.publico.comentarios(token!, id),
    comentar: (id: string, tx: string) => api.publico.comentar(token!, id, tx),
    podeInteragir: true,
  }), [token]);

  return (
    <Shell semNav>
      <header style={{ position: "relative", textAlign: "center", background: hd.bg,
                       borderBottom: `1px solid ${t.border}`,
                       padding: "20px 16px", paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
        <Wordmark size={15} />
        <div style={{ position: "absolute", right: 14, top: 0, bottom: 0,
                      display: "flex", alignItems: "center",
                      paddingTop: "env(safe-area-inset-top)" }}>
          <ThemeToggle />
        </div>
      </header>
      {erro && <Aviso texto={erro} />}
      {!perfil && !erro && <Aviso texto="Carregando…" />}
      {perfil && (
        <>
          <PerfilCabecalho perfil={perfil} />
          <main style={{ padding: "0 12px" }}>
            {perfil.posts.length === 0 && (
              <Aviso texto="Seu perfil está pronto! As primeiras atualizações do seu projeto aparecem aqui em breve." />
            )}
            {perfil.posts.map((p) => (
              <PostCard key={p.id} post={{ ...p, avatar_url: perfil.avatar_url }} ix={ix} />
            ))}
          </main>
          <div style={{ color: t.text3, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                        textAlign: "center", padding: "16px 24px 28px" }}>
            Acompanhamento exclusivo do seu projeto · Parket
          </div>
        </>
      )}
    </Shell>
  );
}

function LoginRoute() {
  const nav = useNavigate();
  return <Login aoEntrar={() => nav("/")} />;
}

function GateInterno({ children }: { children: React.ReactNode }) {
  const [logado, setLogado] = useState(!!viewer.email());
  if (!logado) return <Login aoEntrar={() => setLogado(true)} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GateInterno><FeedPage /></GateInterno>} />
      <Route path="/entrar" element={<LoginRoute />} />
      <Route path="/perfis" element={<GateInterno><PerfisPage /></GateInterno>} />
      <Route path="/perfil/:pid" element={<GateInterno><PerfilPage /></GateInterno>} />
      <Route path="/:token" element={<ClientePage />} />
    </Routes>
  );
}
