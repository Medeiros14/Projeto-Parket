import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./lib/auth";
import { LoginPage } from "./components/LoginPage";
import { Layout } from "./components/Layout";
import { UploadPage } from "./pages/Upload";
import { NotasPage } from "./pages/Notas";
import { PendentesPage } from "./pages/Pendentes";
import { listNotas } from "./lib/api";

export default function App() {
  const { appUser, loading, error } = useAuth();
  const [pendentesCount, setPendentesCount] = useState<number>(0);

  // Contador de pendentes pra badge no sidebar. Atualiza no boot e a cada 30s.
  // Não precisa ser realtime — Ronaldo trabalha em rajadas, 30s tá bom.
  useEffect(() => {
    if (!appUser) return;
    let alive = true;
    const refresh = () => {
      listNotas({ status: "pendente" })
        .then((n) => { if (alive) setPendentesCount(n.length); })
        .catch(() => {});
    };
    refresh();
    const iv = setInterval(refresh, 30_000);
    return () => { alive = false; clearInterval(iv); };
  }, [appUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-hb-bg text-hb-text flex items-center justify-center flex-col gap-3">
        <Loader2 size={26} className="animate-spin text-hb-accent" />
        <div className="text-xs uppercase tracking-widest text-hb-textDim">Carregando</div>
      </div>
    );
  }

  if (!appUser) return <LoginPage initialError={error} />;

  return (
    <Layout appUser={appUser} pendentesCount={pendentesCount}>
      <Routes>
        <Route path="/" element={<Navigate to="/upload" replace />} />
        <Route path="/upload" element={<UploadPage appUser={appUser} />} />
        <Route path="/notas" element={<NotasPage />} />
        <Route path="/pendentes" element={<PendentesPage appUser={appUser} />} />
        <Route path="*" element={<Navigate to="/upload" replace />} />
      </Routes>
    </Layout>
  );
}
