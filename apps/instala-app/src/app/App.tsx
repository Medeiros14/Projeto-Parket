import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "../lib/auth";
import { ThemeProvider, useTheme } from "../lib/theme-context";
import { Login } from "../pages/Login";
import { ContratoGeral } from "../pages/ContratoGeral";
import { Hoje } from "../pages/Hoje";
import { ObraDetalhe } from "../pages/ObraDetalhe";
import { AceitarTermo } from "../pages/AceitarTermo";
import { AtivarObraGate } from "../pages/AtivarObra";
import { Admin } from "../pages/Admin";
import { AdminCentral } from "../pages/AdminCentral";
import { Agenda } from "../pages/Agenda";
import { Iniciar } from "../pages/Iniciar";
import { Equipe } from "../pages/Equipe";
import { Custos } from "../pages/Custos";
import { Ranking } from "../pages/Ranking";
import { Mais } from "../pages/Mais";
import { Ocorrencias } from "../pages/Ocorrencias";
import { Material } from "../pages/Material";
import { Pagamentos } from "../pages/Pagamentos";
import { Conferencia } from "../pages/Conferencia";
import { Pendencias } from "../pages/Pendencias";
import { Cronograma } from "../pages/Cronograma";
import "../lib/offline";

function slugify(nome: string) {
  return nome.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function Splash() {
  const { T } = useTheme();
  return (
    <div style={{
      minHeight: "100vh", background: T.bg, color: T.textMuted,
      display: "grid", placeItems: "center", fontFamily: "'Inter', sans-serif",
      fontSize: 11, letterSpacing: "0.2em",
    }}>
      CARREGANDO…
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, prestador } = useAuth();
  if (!ready) return <Splash />;
  if (!prestador) return <Login />;
  return <>{children}</>;
}

/** Gate do CONTRATO GERAL (F3, #1987): antes de liberar qualquer tela do app,
 *  consulta o gestao API se o prestador tem aceite da versao vigente dos termos.
 *  precisa_aceite=true redireciona pro wizard /contrato (primeiro login E
 *  re-aceite quando publicarem versao nova do catalogo prestador_contratos). */
const API_URL = "https://gestao.parket.works";
// cache em memoria por load da pagina: 1 consulta por sessao, some no reload
let contratoLiberado = false;

function ContratoGate({ children }: { children: React.ReactNode }) {
  const { prestador } = useAuth();
  const [estado, setEstado] = useState<"checando" | "ok" | "pendente">(contratoLiberado ? "ok" : "checando");
  useEffect(() => {
    if (!prestador || contratoLiberado) return;
    // gate vale pra TODOS, fiscais inclusos (Will 01/09: fiscais ativos pra testar o fluxo)
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/instala/contrato/vigente?prestador_id=${prestador.id}`);
        const j = await r.json();
        if (!vivo) return;
        if (j?.precisa_aceite) setEstado("pendente");
        else { contratoLiberado = true; setEstado("ok"); }
      } catch {
        // offline ou API fora: app de campo nao pode travar por causa do gate
        if (vivo) { contratoLiberado = true; setEstado("ok"); }
      }
    })();
    return () => { vivo = false; };
  }, [prestador?.id]);
  if (!prestador) return <>{children}</>;
  if (estado === "pendente") return <Navigate to="/contrato" replace />;
  if (estado === "checando") return <Splash />;
  return <>{children}</>;
}

function HomeGate() {
  const { ready, prestador } = useAuth();
  if (!ready) return <Splash />;
  if (!prestador) return <Login />;
  // Tela inicial ao logar = INICIAR OBRA
  return <Navigate to={`/${slugify(prestador.nome)}/iniciar`} replace />;
}

function SlugGate({ tab }: { tab?: "agenda" | "iniciar" | "equipe" | "custos" | "ranking" | "mais" | "ocorrencias" | "material" | "pagamentos" | "conferencia" | "pendencias" | "cronograma" }) {
  const { slug } = useParams();
  const { ready, prestador } = useAuth();
  if (!ready) return <Splash />;
  if (!prestador) return <Login slug={slug} />;
  const own = slugify(prestador.nome);
  if (slug !== own) return <Navigate to={`/${own}${tab ? "/" + tab : ""}`} replace />;
  if (tab === "agenda")  return <Agenda  slug={own} />;
  if (tab === "iniciar") return <Iniciar slug={own} />;
  if (tab === "equipe")  return <Equipe  slug={own} />;
  if (tab === "custos")  return <Custos  slug={own} />;
  if (tab === "ranking") return <Ranking slug={own} />;
  if (tab === "mais")    return <Mais slug={own} />;
  if (tab === "ocorrencias") return <Ocorrencias slug={own} />;
  if (tab === "material")    return <Material slug={own} />;
  if (tab === "pagamentos")  return <Pagamentos slug={own} />;
  if (tab === "conferencia") return <Conferencia slug={own} />;
  if (tab === "pendencias")  return <Pendencias slug={own} />;
  if (tab === "cronograma")  return <Cronograma slug={own} />;
  return <Hoje />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeGate />} />
            {/* wizard do contrato geral fica FORA do ContratoGate (senao loop de redirect) */}
            <Route path="/contrato" element={<Gate><ContratoGeral /></Gate>} />
            {/* Gate de ATIVACAO (F4): termo pendente na obra = wizard de itens +
                codigo WhatsApp antes da gestao da obra, em qualquer entrada */}
            <Route path="/obra/:cardId" element={<Gate><ContratoGate><AtivarObraGate><ObraDetalhe /></AtivarObraGate></ContratoGate></Gate>} />
            <Route path="/termo/:termoId" element={<Gate><ContratoGate><AceitarTermo /></ContratoGate></Gate>} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/central" element={<AdminCentral />} />
            <Route path="/:slug" element={<ContratoGate><SlugGate /></ContratoGate>} />
            <Route path="/:slug/agenda"  element={<ContratoGate><SlugGate tab="agenda"  /></ContratoGate>} />
            <Route path="/:slug/iniciar" element={<ContratoGate><SlugGate tab="iniciar" /></ContratoGate>} />
            <Route path="/:slug/equipe"  element={<ContratoGate><SlugGate tab="equipe"  /></ContratoGate>} />
            <Route path="/:slug/custos"  element={<ContratoGate><SlugGate tab="custos"  /></ContratoGate>} />
            <Route path="/:slug/ranking" element={<ContratoGate><SlugGate tab="ranking" /></ContratoGate>} />
            <Route path="/:slug/mais"        element={<ContratoGate><SlugGate tab="mais" /></ContratoGate>} />
            <Route path="/:slug/ocorrencias" element={<ContratoGate><SlugGate tab="ocorrencias" /></ContratoGate>} />
            <Route path="/:slug/material"    element={<ContratoGate><SlugGate tab="material" /></ContratoGate>} />
            <Route path="/:slug/pagamentos"  element={<ContratoGate><SlugGate tab="pagamentos" /></ContratoGate>} />
            <Route path="/:slug/conferencia" element={<ContratoGate><SlugGate tab="conferencia" /></ContratoGate>} />
            <Route path="/:slug/pendencias"  element={<ContratoGate><SlugGate tab="pendencias" /></ContratoGate>} />
            <Route path="/:slug/cronograma"  element={<ContratoGate><SlugGate tab="cronograma" /></ContratoGate>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
