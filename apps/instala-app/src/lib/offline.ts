import { sb } from "./supabase";

export const GESTAO_API = "https://gestao.parket.works";

export type QueuedFile = {
  field: string;        // caminho no body onde entra a URL (suporta "volumes.0.foto_url")
  bucketPath: string;   // path fixo no bucket (retry sobrescreve, não duplica)
  blob: Blob;
  contentType: string;
  bucket?: string;      // default "obra-media" (check-in usa "instala-fotos")
};

export type JobKind = "api" | "sb_rpc" | "sb_insert";

export type QueuedJob = {
  client_key: string;
  kind?: JobKind;       // default "api"
  endpoint: string;     // api: "/api/instala/..." | sb_rpc: nome da function | sb_insert: nome da tabela
  body: Record<string, any>;
  files: QueuedFile[];
  label: string;
  obra_id?: string | null; // lane de ordem: envios da mesma obra saem em FIFO
  created_at: number;
  seq?: number;            // desempate quando created_at empata (ms)
  attempts?: number;
  last_error?: string | null;
  status?: "pending" | "attention";
  next_retry_at?: number;
};

const DB_NAME = "instala-offline";
const STORE = "fila";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "client_key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => db.close();
  }));
}

const listeners = new Set<() => void>();
function notify() { listeners.forEach((cb) => { try { cb(); } catch {} }); }
export function onQueueChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function queueCount(): Promise<number> {
  try { return await tx("readonly", (s) => s.count()); } catch { return 0; }
}

export async function listQueue(): Promise<QueuedJob[]> {
  try {
    const jobs: QueuedJob[] = await tx("readonly", (s) => s.getAll());
    return jobs.sort((a, b) => (a.created_at - b.created_at) || ((a.seq ?? 0) - (b.seq ?? 0)));
  } catch { return []; }
}

/** Precisa de atenção = rejeitado pelo servidor OU 10+ tentativas sem sucesso. */
export function jobNeedsAttention(job: QueuedJob): boolean {
  return job.status === "attention" || (job.attempts ?? 0) >= 10;
}

function setDeep(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = value;
}

export class ServerError extends Error {
  server = true;
  constructor(msg: string) { super(msg); }
}

/** supabase-js devolve erro de rede como message genérica — sem sinal = retry, não descarte. */
function isNetworkMsg(msg: string): boolean {
  return !navigator.onLine ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out|abort/i.test(msg || "");
}

/** Sobe os blobs (upsert no mesmo path) e envia. ServerError = rejeitado (retry não resolve sozinho). */
async function runJob(job: QueuedJob): Promise<void> {
  const body = JSON.parse(JSON.stringify(job.body));
  for (const f of job.files) {
    const bucket = f.bucket || "obra-media";
    const { error } = await sb.storage.from(bucket).upload(f.bucketPath, f.blob, {
      contentType: f.contentType || "application/octet-stream", upsert: true,
    });
    if (error) throw new Error(error.message || "Falha no upload");
    setDeep(body, f.field, sb.storage.from(bucket).getPublicUrl(f.bucketPath).data.publicUrl);
  }
  const kind: JobKind = job.kind || "api";
  if (kind === "sb_rpc") {
    const { error } = await sb.rpc(job.endpoint, body);
    if (error) {
      const msg = error.message || "Falha ao enviar";
      if (isNetworkMsg(msg)) throw new Error(msg);
      throw new ServerError(msg);
    }
    return;
  }
  if (kind === "sb_insert") {
    // Idempotente: client_id UNIQUE no banco — retry não duplica a linha
    const { error } = await sb.from(job.endpoint).upsert(
      { ...body, client_id: job.client_key },
      { onConflict: "client_id", ignoreDuplicates: true },
    );
    if (error) {
      const msg = error.message || "Falha ao enviar";
      // FK = dependência (ex: check-in) ainda não sincronizada — transitório, retry resolve
      if (isNetworkMsg(msg) || /foreign key/i.test(msg)) throw new Error(msg);
      throw new ServerError(msg);
    }
    return;
  }
  body.client_key = job.client_key;
  const r = await fetch(`${GESTAO_API}${job.endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = `Falha ao enviar (${r.status})`;
    try { const j = await r.json(); if (typeof j?.detail === "string") msg = j.detail; } catch {}
    if (r.status >= 400 && r.status < 500) throw new ServerError(msg);
    throw new Error(msg);
  }
}

let seqCounter = 0;

/**
 * Tenta enviar agora; sem sinal (ou 5xx) guarda no aparelho pra reenviar depois.
 * ServerError (validação) estoura pro caller mostrar a mensagem.
 */
export async function submitOrQueue(
  job: Omit<QueuedJob, "created_at" | "seq">,
): Promise<"sent" | "queued"> {
  const full: QueuedJob = { ...job, created_at: Date.now(), seq: ++seqCounter, attempts: 0, status: "pending" };
  try {
    await runJob(full);
    return "sent";
  } catch (e: any) {
    if (e instanceof ServerError) throw e;
    await tx("readwrite", (s) => s.put(full));
    notify();
    return "queued";
  }
}

/** Guarda direto na fila sem tentar enviar (confirmação instantânea; flush cuida do envio). */
export async function queueOnly(job: Omit<QueuedJob, "created_at" | "seq">): Promise<void> {
  const full: QueuedJob = { ...job, created_at: Date.now(), seq: ++seqCounter, attempts: 0, status: "pending" };
  await tx("readwrite", (s) => s.put(full));
  notify();
  flushQueue();
}

export async function retryJob(client_key: string): Promise<void> {
  const job: QueuedJob | undefined = await tx("readonly", (s) => s.get(client_key));
  if (!job) return;
  await tx("readwrite", (s) => s.put({ ...job, attempts: 0, status: "pending", next_retry_at: 0, last_error: null }));
  notify();
  await flushQueue(true);
}

/** Descarte MANUAL (nunca automático) — só via UI da fila, com confirmação do usuário. */
export async function discardJob(client_key: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(client_key));
  notify();
}

export function forceFlush(): Promise<void> { return flushQueue(true); }

let flushing = false;
export async function flushQueue(force = false): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const jobs = await listQueue();
    const blockedLanes = new Set<string>();
    const now = Date.now();
    for (const job of jobs) {
      const lane = job.obra_id || "_global";
      if (blockedLanes.has(lane)) continue;
      // 4xx anterior segura a lane inteira (preserva ordem por obra) até ação manual
      if (job.status === "attention" && !force) { blockedLanes.add(lane); continue; }
      if (!force && (job.next_retry_at ?? 0) > now) { blockedLanes.add(lane); continue; }
      try {
        await runJob(job);
        await tx("readwrite", (s) => s.delete(job.client_key));
        notify();
      } catch (e: any) {
        if (e instanceof ServerError) {
          // rejeitado pelo servidor: marca "precisa de atenção" — NUNCA descarta sozinho
          await tx("readwrite", (s) => s.put({
            ...job, status: "attention", last_error: e.message, attempts: (job.attempts ?? 0) + 1,
          }));
          notify();
          blockedLanes.add(lane);
        } else {
          const attempts = (job.attempts ?? 0) + 1;
          await tx("readwrite", (s) => s.put({
            ...job, attempts,
            last_error: e?.message || "Sem sinal",
            next_retry_at: Date.now() + Math.min(5_000 * 2 ** Math.min(attempts, 7), 600_000),
          }));
          notify();
          break; // sem sinal — tenta de novo no próximo online
        }
      }
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { flushQueue(); });
  setTimeout(() => { flushQueue(); }, 3000);
  setInterval(() => { queueCount().then((n) => { if (n > 0) flushQueue(); }); }, 60_000);
}
