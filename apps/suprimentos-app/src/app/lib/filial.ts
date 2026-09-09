/**
 * Roteamento de tabelas por filial. UM BANCO POR PESSOA.
 *
 * SP (default) -> tabelas suprimentos_* (produção São Paulo, dados históricos).
 *   Usada por: ronaldo (compra.01@parket.com.br) e todo mundo que não estiver
 *   na lista CWB abaixo.
 *
 * CWB -> tabelas suprimentos_cwb_* (banco isolado, começou vazio 27/08/2026).
 *   Usada por: edson@parket.com.br (Curitiba).
 *
 * A decisão é tomada por EMAIL — não depende de user_metadata (que pode não
 * estar hidratado no primeiro render) nem de cache in-memory (race condition
 * com onAuthStateChange). Leitura é sync do localStorage do supabase-js.
 * Pra adicionar outra filial isolada: coloque o email no map e crie as
 * tabelas <prefixo>_* no Cloud.
 */
import { sbParket } from "./supabase";

type Filial = "SP" | "CWB";

// Mesma chave configurada no createClient em supabase.ts.
const STORAGE_KEY = "suprimentos-parket-sso";

// Emails -> filial. Case-insensitive. Todo mundo fora do map cai em SP.
const EMAIL_FILIAL: Record<string, Filial> = {
  "edson@parket.com.br": "CWB",
};

function readEmailFromSession(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Estruturas possíveis do supabase-js v2 dependendo da versão:
    return (
      parsed?.user?.email ||
      parsed?.currentSession?.user?.email ||
      parsed?.session?.user?.email ||
      null
    );
  } catch {
    return null;
  }
}

function getFilialSync(): Filial {
  const email = (readEmailFromSession() || "").toLowerCase();
  return EMAIL_FILIAL[email] || "SP";
}

/** Resolve o nome real da tabela pro banco da filial ativa. */
export function tbl(name: "itens" | "funcionarios" | "movimentacoes" | "termos"): string {
  return getFilialSync() === "CWB" ? `suprimentos_cwb_${name}` : `suprimentos_${name}`;
}

/** Resolve o nome da RPC de próximo termo pra filial ativa. */
export function rpcProximoTermo(): string {
  return getFilialSync() === "CWB" ? "suprimentos_cwb_proximo_termo" : "suprimentos_proximo_termo";
}

export function getFilial(): Filial { return getFilialSync(); }

// Mantém o SDK vivo pra rotação de token; a decisão de filial é sempre sync.
sbParket.auth.onAuthStateChange(() => { /* no-op */ });
