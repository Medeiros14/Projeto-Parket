import { Routes, Route } from "react-router-dom";
import { Loader2, Construction } from "lucide-react";
import { useAuth, type AppUser } from "./lib/auth";
import { LoginPage } from "./components/LoginPage";
import { DeptHeader } from "./components/DeptHeader";
import { DeptSidebar } from "./components/DeptSidebar";
import { DEPT_DATA } from "./lib/dept-data";
import Home from "./pages/Home";
import Comercial from "./pages/Comercial";

// ─── Placeholder de setor — header SO Parket + sidebar idêntica ───────
function Placeholder({ deptKey, appUser }: { deptKey: string; appUser: AppUser }) {
  const dept = DEPT_DATA[deptKey] || DEPT_DATA.comercial;
  return (
    <div className="h-screen flex flex-col bg-pk-bg text-pk-text overflow-hidden">
      <DeptHeader deptName={dept.fullName.toUpperCase()} breadcrumb={dept.breadcrumb} appUser={appUser} />
      <div className="flex flex-1 overflow-hidden">
        <DeptSidebar dept={dept} appUser={appUser} />
        <main className="flex-1 overflow-auto">
          <div className="border-b border-pk-border px-6 py-3">
            <h1 className="font-display text-[16px] uppercase tracking-[0.16em] font-medium leading-tight">
              {dept.name.toUpperCase()}
            </h1>
            <div className="text-[8px] uppercase tracking-[0.18em] text-pk-textDim mt-1">{dept.breadcrumb.toUpperCase()}</div>
          </div>
          <div className="flex items-center justify-center p-12 min-h-[60vh]">
            <div className="text-center max-w-md">
              <Construction size={28} className="text-pk-accent mx-auto mb-5" />
              <div className="font-display text-[14px] uppercase tracking-[0.20em] mb-2">EM CONSTRUÇÃO</div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-pk-textDim leading-relaxed">
                Reconstrução do Space no padrão Sistema Operacional Parket.
                Esta seção será migrada do space.parket.works.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pk-bg text-pk-textDim">
        <Loader2 size={20} className="animate-spin text-pk-accent" />
      </div>
    );
  }

  if (!auth.session || !auth.appUser) {
    return <LoginPage initialError={auth.error} />;
  }

  const u = auth.appUser;
  return (
    <Routes>
      {/* Home — fullpage com header próprio (NavonaDashboard style) */}
      <Route index element={<Home appUser={u} />} />

      {/* Setores — cada um fullpage com sidebar SO Parket */}
      <Route path="/comercial"    element={<Comercial appUser={u} />} />
      <Route path="/projetos"     element={<Placeholder deptKey="projetos"    appUser={u} />} />
      <Route path="/orcamento"    element={<Placeholder deptKey="orcamento"   appUser={u} />} />
      <Route path="/producao"     element={<Placeholder deptKey="producao"    appUser={u} />} />
      <Route path="/operacional"  element={<Placeholder deptKey="operacional" appUser={u} />} />
      <Route path="/marketing"    element={<Placeholder deptKey="marketing"   appUser={u} />} />
      <Route path="/rh"           element={<Placeholder deptKey="rh"          appUser={u} />} />
      <Route path="/financeiro"   element={<Placeholder deptKey="financeiro"  appUser={u} />} />
      <Route path="/atendimento"  element={<Placeholder deptKey="atendimento" appUser={u} />} />
      <Route path="/analise"      element={<Placeholder deptKey="analise"     appUser={u} />} />
      <Route path="/arquivos"     element={<Placeholder deptKey="arquivos"    appUser={u} />} />
      <Route path="/manutencao"   element={<Placeholder deptKey="manutencao"  appUser={u} />} />
      <Route path="*"             element={<Placeholder deptKey="comercial"   appUser={u} />} />
    </Routes>
  );
}
