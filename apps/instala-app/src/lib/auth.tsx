import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { sb } from "./supabase";

type Prestador = {
  id: string;
  nome: string;
  telefone: string | null;
  categoria: string | null;
  // Fiscal: enxerga toda obra pra fazer registro, nao so as atribuidas a ele.
  ve_todas_obras?: boolean;
};

type AuthCtx = {
  ready: boolean;
  prestador: Prestador | null;
  signIn: (login: string, senha: string, expected?: { id: string; nome: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  ready: false,
  prestador: null,
  signIn: async () => ({ error: "not-ready" }),
  signOut: async () => {},
});

const STORAGE_KEY = "parket-instala-prestador";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prestador, setPrestador] = useState<Prestador | null>(null);

  useEffect(() => {
    let cached: Prestador | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) cached = JSON.parse(raw) as Prestador;
    } catch {}
    if (cached) setPrestador(cached);
    setReady(true);
    // A sessao guardada no aparelho e uma foto do dia do login: quem entrou
    // antes de virar fiscal ficaria pra sempre sem `ve_todas_obras` e sem a
    // lista de Acompanhamento de Obras. Entao, a cada abertura, o perfil e
    // relido do banco. Se a leitura falhar (offline), o cache continua valendo.
    if (!cached?.id) return;
    let alive = true;
    sb.from("prestadores")
      .select("id,nome,telefone,categoria,ve_todas_obras,ativo")
      .eq("id", cached.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
        // Prestador desativado perde o acesso na proxima abertura do app.
        if (data.ativo !== true) {
          localStorage.removeItem(STORAGE_KEY);
          setPrestador(null);
          return;
        }
        const fresco: Prestador = {
          id: data.id, nome: data.nome,
          telefone: data.telefone ?? null, categoria: data.categoria ?? null,
          ve_todas_obras: data.ve_todas_obras === true,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresco));
        setPrestador(fresco);
      });
    return () => { alive = false; };
  }, []);

  // Login por e-mail e senha (gerados no gestao.parket.works/equipes). O fiscal
  // tambem entra com o login do verifica.parket.works: a funcao do banco confere
  // as duas origens. A sessao fica no localStorage, entao entra uma vez so.
  async function signIn(login: string, senha: string, expected?: { id: string; nome: string }): Promise<{ error: string | null }> {
    const email = login.trim().toLowerCase();
    if (!email || !senha) return { error: "Preencha e-mail e senha" };
    const { data, error } = await sb.rpc("fn_instala_login_senha", { p_login: email, p_senha: senha });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) return { error: "E-mail ou senha incorretos" };
    if (expected && row.id !== expected.id) {
      return { error: `Este acesso não é de ${expected.nome.split(" ")[0]}. Confira os dados ou acesse instala.parket.works.` };
    }
    const p: Prestador = {
      id: row.id, nome: row.nome,
      telefone: row.telefone ?? null, categoria: row.categoria ?? null,
      ve_todas_obras: row.ve_todas_obras === true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    setPrestador(p);
    return { error: null };
  }

  async function signOut() {
    localStorage.removeItem(STORAGE_KEY);
    setPrestador(null);
    // Volta pra "/" e faz reload — URL não pode ficar com o slug de quem saiu
    if (typeof window !== "undefined") window.location.replace("/");
  }

  return (
    <Ctx.Provider value={{ ready, prestador, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
