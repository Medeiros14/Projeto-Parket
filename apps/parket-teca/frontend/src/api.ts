export type Node = {
  id: string;
  kind: string;
  title: string;
  schema?: string;
  setor: string;
  rows?: number;
  comment?: string;
};

export type Edge = { src: string; dst: string; kind: string };

export type Graph = {
  nodes: Node[];
  edges: Edge[];
  stats: { tables: number; fks: number; setores: Record<string, number> };
};

export type Hit = {
  id: string; kind: string; title: string; body: string;
  schema_name?: string; setor: string; score: number;
};

export type RowHit = {
  id: string; title: string; sub?: string | null;
  table_id: string; schema: string; table: string; kind: "row";
};

export type TableRows = {
  schema: string;
  table: string;
  pk: string;
  title_col: string | null;
  columns: string[];
  rows: Record<string, any>[];
};

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  graph:    () => j<Graph>("/api/graph"),
  node:     (id: string) => j<any>(`/api/graph/node/${encodeURIComponent(id)}`),
  search:   (q: string) => j<{ query: string; hits: Hit[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  searchRows: (q: string) => j<{ query: string; hits: RowHit[] }>(`/api/search/rows?q=${encodeURIComponent(q)}`),
  tableRows: (nodeId: string, q?: string, limit = 50) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    qs.set("limit", String(limit));
    return j<TableRows>(`/api/graph/node/${encodeURIComponent(nodeId)}/rows?${qs.toString()}`);
  },
  tableRow: (nodeId: string, pk: string) =>
    j<{ schema: string; table: string; pk: string; row: Record<string, any> }>(
      `/api/graph/node/${encodeURIComponent(nodeId)}/rows/${encodeURIComponent(pk)}`,
    ),
  chat:     (pergunta: string) => j<any>("/api/chat", {
              method: "POST", headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ pergunta }),
            }),
  notas:    () => j<any[]>("/api/notas"),
  nota:     (slug: string) => j<any>(`/api/notas/${slug}`),
  saveNota: (slug: string, data: any) => j<any>(`/api/notas/${slug}`, {
              method: "PUT", headers: {"Content-Type": "application/json"},
              body: JSON.stringify(data),
            }),
  insights: (params?: { setor?: string; severidade?: string }) => {
    const qs = new URLSearchParams();
    if (params?.setor) qs.set("setor", params.setor);
    if (params?.severidade) qs.set("severidade", params.severidade);
    const s = qs.toString();
    return j<any[]>(`/api/insights${s ? `?${s}` : ""}`);
  },
  insightsSweep:   () => j<any>("/api/insights/sweep", { method: "POST" }),
  insightsDismiss: (id: string) => j<any>(`/api/insights/${id}/dismiss`, { method: "POST" }),
  backlinks: (slug: string) => j<{ slug: string; backlinks: any[] }>(`/api/notas/${slug}/backlinks`),

  aprendizadosApps: () => j<any[]>("/api/aprendizados/apps"),
  aprendizados: (params?: { app?: string; categoria?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.app) qs.set("app", params.app);
    if (params?.categoria) qs.set("categoria", params.categoria);
    if (params?.status) qs.set("status", params.status);
    const s = qs.toString();
    return j<any[]>(`/api/aprendizados${s ? `?${s}` : ""}`);
  },
  aprendizadoCreate: (data: any) => j<any>("/api/aprendizados", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  }),
  aprendizadoUpdate: (id: string, patch: any) => j<any>(`/api/aprendizados/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
  }),
  aprendizadoDelete: (id: string) => j<any>(`/api/aprendizados/${id}`, { method: "DELETE" }),
  aprendizadoAnalysisPrompt: (id: string) => j<{ id: string; app: string; prompt: string }>(`/api/aprendizados/${id}/analysis-prompt`),

  aprendizadosHistory: (app?: string, limit = 100) => {
    const qs = new URLSearchParams();
    if (app) qs.set("app", app);
    qs.set("limit", String(limit));
    return j<any[]>(`/api/aprendizados/history?${qs.toString()}`);
  },

  clientDossier: (nome: string, limit = 8) =>
    j<{
      nome_busca: string;
      propostas: any[]; cards: any[]; colaboradores: any[];
      mensagens: any[]; notas: any[];
      counts: Record<string, number>;
    }>(`/api/client/dossier?nome=${encodeURIComponent(nome)}&limit=${limit}`),
};
