import { sb } from "./supabase";

export type Ficha = {
  id: string;
  categoria: string;
  material: string | null;
  titulo: string;
  conteudo: string;
  chave_match: string | null;
  corpo_md: string | null;
  consumo_cola_m2: number | null;
  video_url: string | null;
};

const DB_NAME = "instala-fichas";
const STORE = "fichas";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveCache(fichas: Ficha[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    const s = t.objectStore(STORE);
    s.clear();
    fichas.forEach((f) => s.put(f));
    t.oncomplete = () => { db.close(); resolve(); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

async function readCache(): Promise<Ficha[]> {
  const db = await openDb();
  return new Promise((resolve) => {
    const t = db.transaction(STORE, "readonly");
    const r = t.objectStore(STORE).getAll();
    r.onsuccess = () => { db.close(); resolve(r.result ?? []); };
    r.onerror = () => { db.close(); resolve([]); };
  });
}

/** Busca as fichas ativas; com sinal atualiza o cache, sem sinal serve do aparelho. */
export async function loadFichas(): Promise<Ficha[]> {
  try {
    const { data, error } = await sb.from("instala_fichas_tecnicas")
      .select("id,categoria,material,titulo,conteudo,chave_match,corpo_md,consumo_cola_m2,video_url")
      .eq("ativo", true);
    if (error) throw error;
    const fichas = (data as Ficha[]) ?? [];
    saveCache(fichas).catch(() => {});
    return fichas;
  } catch {
    try { return await readCache(); } catch { return []; }
  }
}

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

/** Todas as fichas que casam com o texto do item (sem acento/caixa; chaves separadas por |). */
export function fichasDoItem(fichas: Ficha[], texto: string): Ficha[] {
  const t = normalizar(texto);
  if (!t.trim()) return [];
  return fichas.filter((f) => {
    const chaves = (f.chave_match || f.material || f.categoria || "")
      .split(/[|,]/).map((c) => normalizar(c.trim())).filter(Boolean);
    return chaves.some((c) => t.includes(c));
  });
}
