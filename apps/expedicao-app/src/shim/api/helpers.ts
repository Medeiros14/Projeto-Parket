import { supabase } from "@/lib/supabase.ts";
import { currentUserId } from "../auth-store";

export { supabase, currentUserId };

const BUCKET = "expedicao";

export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

export type Row = Record<string, unknown>;

// snake_case -> camelCase (só chaves de 1º nível; jsonb interno já é camelCase)
export function fromRow<T = Row>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "id") continue;
    if (k === "created_at") continue;
    out[snakeToCamel(k)] = v ?? undefined;
  }
  out._id = row.id;
  out._creationTime = row.created_at ? Date.parse(row.created_at as string) : Date.now();
  return out as T;
}

export function fromRows<T = Row>(rows: Row[] | null): T[] {
  return (rows ?? []).map((r) => fromRow<T>(r));
}

// camelCase -> snake_case, descarta undefined
export function toRow(args: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;
    out[camelToSnake(k)] = v;
  }
  return out;
}

export function fail(msg: string): never {
  throw new Error(msg);
}

export function check<T>(data: T, error: { message: string } | null): T {
  if (error) fail(error.message);
  return data;
}

// ---- Upload compatível com o fluxo Convex ----
// generateUploadUrl() devolve URL sentinela; o interceptor de fetch abaixo faz o
// upload real no bucket e responde {storageId} onde storageId = URL pública final.
const UPLOAD_PREFIX = "https://expedicao-upload.internal/";

export async function generateUploadUrl(): Promise<string> {
  return UPLOAD_PREFIX + crypto.randomUUID();
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

const origFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(UPLOAD_PREFIX)) return origFetch(input as RequestInfo, init);

  const id = url.slice(UPLOAD_PREFIX.length);
  const headers = new Headers(init?.headers);
  const contentType = headers.get("Content-Type") ?? "application/octet-stream";
  const ext = EXT[contentType] ?? "bin";
  const path = `uploads/${id}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, init?.body as Blob, { contentType });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return new Response(JSON.stringify({ storageId: data.publicUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as typeof window.fetch;

// storageId no shim JÁ é a URL pública
export function storageUrl(storageId: string): string {
  return storageId;
}

export interface PaginationOpts {
  numItems: number;
  cursor: string | null;
}

export interface Paginated<T> {
  page: T[];
  isDone: boolean;
  continueCursor: string | null;
}

export function paginate<T>(rows: T[], count: number | null, numItems: number): Paginated<T> {
  return { page: rows, isDone: (count ?? rows.length) <= numItems, continueCursor: null };
}

// Numeração sequencial estilo Convex (PED-0001, TRF-0001)
export async function nextNumber(table: string, column: string, prefix: string): Promise<string> {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .order("created_at", { ascending: false })
    .limit(1);
  check(data, error);
  const last = (data?.[0] as Row | undefined)?.[column] as string | undefined;
  if (!last) return `${prefix}-0001`;
  const m = last.match(/\d+$/);
  const next = m ? parseInt(m[0]) + 1 : 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}
