export type InstaMidia = {
  foto_id: string;
  url: string;
  tipo: "foto" | "video" | string;
  legenda: string | null;
  ambiente: string | null;
};

export type InstaPost = {
  id: string;
  projeto_id: string;
  legenda: string | null;
  created_at: string;
  publicado_por?: string;
  cliente: string;
  concluido: boolean;
  midias: InstaMidia[];
  curtidas: number;
  comentarios: number;
  curti: boolean;
  avatar_url?: string | null;
};

export type InstaPerfilResumo = {
  projeto_id: string;
  cliente: string;
  concluido: boolean;
  posts: number;
  ultimo_post: string | null;
  avatar_url: string | null;
};

export type InstaPerfilDetalhe = {
  projeto_id: string;
  cliente: string;
  concluido: boolean;
  avatar_url: string | null;
  posts: InstaPost[];
};

export type InstaComentario = {
  id: string;
  autor_tipo: "interno" | "cliente" | string;
  autor_nome: string;
  texto: string;
  created_at: string;
};

// sufixo v2 invalida sessões do esquema antigo (nome+email sem senha)
const EMAIL_KEY = "insta_user_email_v2";
const NAME_KEY = "insta_user_name_v2";

/* SSO Parket — mesma credencial do Space, via gateway api.parket.works
 * (padrão do Homebroker: ISP brasileiro tem roteamento quebrado pra IPs
 * do Supabase direto). Anon key é pública. */
const SSO_URL = "https://api.parket.works";
const SSO_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

export const viewer = {
  email: () => localStorage.getItem(EMAIL_KEY),
  nome: () => localStorage.getItem(NAME_KEY),
  entrar: async (email: string, senha: string) => {
    const r = await fetch(`${SSO_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SSO_ANON },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password: senha }),
    });
    const body = await r.json().catch(() => ({} as any));
    if (!r.ok) {
      const m = String(body?.error_description || body?.msg || "");
      throw new Error(/invalid login/i.test(m) ? "E-mail ou senha inválidos" : m || `Falha no login (HTTP ${r.status})`);
    }
    const u = body?.user || {};
    const nome = String(u.user_metadata?.full_name || u.user_metadata?.nome || u.email || email).trim();
    localStorage.setItem(NAME_KEY, nome);
    localStorage.setItem(EMAIL_KEY, String(u.email || email).trim().toLowerCase());
  },
  sair: () => {
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(NAME_KEY);
  },
};

// Header value precisa ser Latin-1: nome vai ASCII-folded (só usado
// internamente); nos comentários o nome vai no body JSON, sem restrição.
function asciiFold(s: string): string {
  return s.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const email = viewer.email();
  const nome = viewer.nome();
  if (email) h["X-User-Email"] = asciiFold(email);
  if (nome) h["X-User-Name"] = asciiFold(nome);
  return h;
}

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      if (body?.detail) msg = String(body.detail);
    } catch { /* mantém msg */ }
    const err = new Error(msg) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return r.json();
}

export const api = {
  feed: (limit = 30, offset = 0) =>
    j<InstaPost[]>(`/api/insta/feed?limit=${limit}&offset=${offset}`, { headers: authHeaders() }),
  perfis: (q?: string) =>
    j<InstaPerfilResumo[]>(`/api/insta/perfis${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  perfil: (pid: string) =>
    j<InstaPerfilDetalhe>(`/api/insta/perfil/${pid}`, { headers: authHeaders() }),
  curtir: (postId: string) =>
    j<{ ok: boolean; curtiu: boolean; curtidas: number }>(
      `/api/insta/posts/${postId}/curtir`, { method: "POST", headers: authHeaders() }),
  comentarios: (postId: string) =>
    j<InstaComentario[]>(`/api/insta/posts/${postId}/comentarios`),
  comentar: (postId: string, texto: string) =>
    j<InstaComentario>(`/api/insta/posts/${postId}/comentar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ texto, autor_nome: viewer.nome() || undefined }),
    }),

  publico: {
    perfil: (token: string) =>
      j<InstaPerfilDetalhe>(`/api/publico/insta/${encodeURIComponent(token)}`),
    curtir: (token: string, postId: string) =>
      j<{ ok: boolean; curtiu: boolean; curtidas: number }>(
        `/api/publico/insta/${encodeURIComponent(token)}/curtir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId }),
        }),
    comentarios: (token: string, postId: string) =>
      j<InstaComentario[]>(`/api/publico/insta/${encodeURIComponent(token)}/posts/${postId}/comentarios`),
    comentar: (token: string, postId: string, texto: string) =>
      j<InstaComentario>(`/api/publico/insta/${encodeURIComponent(token)}/comentar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, texto }),
      }),
  },
};

export function tempoRelativo(iso: string): string {
  const d = new Date(iso);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
