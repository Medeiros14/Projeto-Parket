/**
 * Upload de anexos do card (PKT-HB-DRIVE-20260902B).
 *
 * TODO documento do HB vai pro Google Drive do cliente, nunca mais pro
 * Supabase Storage (decisao Will 02/09: arquivo de arquitetura passa de
 * 150MB e o bucket nao aguenta; Drive nao tem limite pra gente).
 *
 * Sem teto de tamanho e sem conta Google do vendedor:
 *   1. pede sessao em /api/hb-drive/upload-session no gestao API,
 *      autenticando com o JWT do proprio login do HB;
 *   2. o servidor abre a sessao RESUMABLE na Drive API v3 como sistemas@
 *      (token nunca chega no navegador) e devolve so a URL da sessao,
 *      que e escopada aquele unico arquivo;
 *   3. o navegador faz PUT do arquivo direto pro Google, qualquer
 *      tamanho, com progresso via XHR.
 *
 * Upsert por nome: arquivo de mesmo nome na pasta vira atualizacao de
 * conteudo (mesmo file_id; o Drive guarda o historico de versoes).
 *
 * O Apps Script "Parket Drive Bot" continua existindo mas so o SERVIDOR
 * fala com ele (get_upload_token / ensure_hb_folder); este arquivo nao
 * chama mais o /exec nem o Supabase Storage.
 */
import { supabase } from "./supabase";

// Endpoints hb-drive do gestao API (backend/app/hb_drive.py no parket-gestao).
const HB_DRIVE_API = "https://gestao.parket.works/api/hb-drive";

export type AnexoUploadResult = {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  storage: "drive";       // destino unico agora; "supabase" so existe em dado legado
  driveFileId: string;    // id do arquivo no Drive
};

export type DriveFolderInfo = { folderId: string; folderUrl: string };

// Headers de auth: JWT da sessao do vendedor logado no HB (o backend valida
// no GoTrue antes de encostar no Drive).
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const tok = data.session?.access_token;
  if (!tok) throw new Error("Sessão expirada: faça login de novo.");
  return { Authorization: `Bearer ${tok}` };
}

// fetch no gestao API com auth + tratamento de erro padrao.
async function hbDrive(path: string, init?: RequestInit): Promise<any> {
  const headers = { ...(await authHeaders()), ...(init?.body ? { "Content-Type": "application/json" } : {}) };
  const resp = await fetch(`${HB_DRIVE_API}${path}`, { ...init, headers });
  if (!resp.ok) {
    let msg = `Drive HTTP ${resp.status}`;
    try { msg = (await resp.json()).detail || msg; } catch { /* corpo nao-JSON */ }
    throw new Error(msg);
  }
  return resp.json();
}

// ── Upload resumable em CHUNKS com retomada (arquivo de 2GB+ aguenta) ──
//
// PUT unico de arquivo gigante = rede piscar no minuto 25 perde tudo.
// Protocolo resumable do Google: manda pedacos com Content-Range; o Google
// responde 308 (continua) com header Range dizendo ate onde chegou, ou
// 200/201 com o metadata do file quando fecha o ultimo pedaco. Se der erro
// de rede, perguntamos o offset atual (PUT vazio "bytes */total") e
// retomamos DAQUELE ponto, nao do zero.
const CHUNK_BYTES = 32 * 1024 * 1024; // 32MB, multiplo de 256KB exigido pelo Google
const MAX_TENTATIVAS = 6;             // com backoff 1s..32s cobre queda de rede curta

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Extrai o proximo offset do header Range de um 308 ("bytes=0-N" => N+1).
// Header ausente = Google nao gravou nada ainda (offset 0).
function offsetDoRange(xhr: XMLHttpRequest): number {
  const m = /bytes=0-(\d+)/.exec(xhr.getResponseHeader("Range") || "");
  return m ? Number(m[1]) + 1 : 0;
}

type ChunkResp = { status: number; xhr: XMLHttpRequest };

// PUT de um pedaco (ou vazio pra consultar status) na sessao resumable.
function putChunk(
  sessionUrl: string,
  body: Blob | null,
  contentRange: string,
  onProgress?: (bytesEnviados: number) => void
): Promise<ChunkResp> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessionUrl);
    xhr.setRequestHeader("Content-Range", contentRange);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) onProgress(ev.loaded);
    };
    xhr.onload = () => resolve({ status: xhr.status, xhr });
    xhr.onerror = () => reject(new Error("Falha de rede no upload pro Drive"));
    xhr.send(body);
  });
}

// Pergunta ao Google ate onde o upload chegou (retomada apos erro).
// Devolve o offset pra continuar, ou o metadata se o arquivo ja fechou.
async function consultarOffset(
  sessionUrl: string,
  total: number
): Promise<{ offset: number; meta?: { id: string } }> {
  const r = await putChunk(sessionUrl, null, `bytes */${total}`);
  if (r.status >= 200 && r.status < 300) {
    try { return { offset: total, meta: JSON.parse(r.xhr.responseText) }; }
    catch { throw new Error("Drive: resposta invalida ao consultar upload"); }
  }
  if (r.status === 308) return { offset: offsetDoRange(r.xhr) };
  if (r.status === 404) throw new Error("Sessão de upload expirou: envie o arquivo de novo.");
  throw new Error(`Drive upload HTTP ${r.status}`);
}

// Sobe o arquivo inteiro em chunks, com progresso global e retomada.
async function putResumable(
  sessionUrl: string,
  file: File,
  onProgress?: (frac: number) => void
): Promise<{ id: string }> {
  const total = file.size;
  let offset = 0;
  let tentativas = 0;
  // Arquivo vazio: o Google ainda exige 1 PUT pra fechar (Content-Range sem bytes nao existe),
  // entao mandamos o corpo vazio com "bytes */0" que devolve o metadata direto.
  if (total === 0) {
    const r = await consultarOffset(sessionUrl, 0);
    if (r.meta) return r.meta;
    throw new Error("Drive: falha ao subir arquivo vazio");
  }
  while (offset < total) {
    const fim = Math.min(offset + CHUNK_BYTES, total);
    const base = offset; // congela pro callback de progresso deste chunk
    try {
      const r = await putChunk(
        sessionUrl,
        file.slice(base, fim),
        `bytes ${base}-${fim - 1}/${total}`,
        (enviados) => onProgress?.((base + enviados) / total)
      );
      if (r.status >= 200 && r.status < 300) {
        // Ultimo chunk aceito: resposta traz o metadata do file.
        try { return JSON.parse(r.xhr.responseText); }
        catch { throw new Error("Drive: resposta invalida no fim do upload"); }
      }
      if (r.status === 308) {
        // Chunk gravado (total ou parcial): continua de onde o Google disse.
        offset = offsetDoRange(r.xhr) || fim;
        tentativas = 0;
        continue;
      }
      if (r.status === 404) throw new Error("Sessão de upload expirou: envie o arquivo de novo.");
      // 5xx do Google = transiente, cai no catch pra retry; 4xx = erro real.
      if (r.status < 500) throw new Error(`Drive upload HTTP ${r.status}`);
      throw Object.assign(new Error(`Drive upload HTTP ${r.status}`), { transiente: true });
    } catch (err: any) {
      // Sessao expirada / 4xx: nao adianta insistir.
      if (err?.message?.includes("expirou") || (err?.message?.startsWith("Drive upload HTTP 4"))) throw err;
      tentativas += 1;
      if (tentativas >= MAX_TENTATIVAS) throw new Error(`Upload falhou apos ${MAX_TENTATIVAS} tentativas: ${err?.message || err}`);
      await sleep(1000 * 2 ** (tentativas - 1)); // 1s, 2s, 4s, 8s, 16s
      // Retoma do ponto exato em que o Google parou de receber.
      const st = await consultarOffset(sessionUrl, total);
      if (st.meta) return st.meta;
      offset = st.offset;
    }
  }
  // Loop saiu sem 200 (offset alcancou total via 308): confirma fechamento.
  const fimSt = await consultarOffset(sessionUrl, total);
  if (fimSt.meta) return fimSt.meta;
  throw new Error("Drive: upload terminou sem confirmacao do arquivo");
}

// Garante a pasta do cliente no Drive ("Home Broker/<CLIENTE>"; reusa pasta
// existente em Projetos ou desarquiva do _Arquivo se o lead voltou).
export async function ensureDriveFolder(clientName: string): Promise<DriveFolderInfo> {
  const r = await hbDrive("/ensure-folder", {
    method: "POST",
    body: JSON.stringify({ client_name: clientName }),
  });
  return { folderId: r.folder_id, folderUrl: r.folder_url };
}

// ── Painel "Drive do cliente" (mesmo shape do DriveEntry do modo nativo) ──
export type DriveScriptEntry = {
  id: string; name: string; mimeType: string; isFolder: boolean;
  size: number; modified: string; url: string;
};

// Lista pastas+arquivos de um folder_id (via gestao API, nao mais Apps Script).
export async function listDriveFolderScript(folderId: string): Promise<DriveScriptEntry[]> {
  const r = await hbDrive(`/list?folder_id=${encodeURIComponent(folderId)}`);
  return (r.files || []).map((f: any): DriveScriptEntry => ({
    id: f.id, name: f.name, mimeType: f.mime_type,
    isFolder: !!f.is_folder, size: Number(f.size || 0),
    modified: f.modified || "", url: f.url || "",
  }));
}

// Cria (ou reusa, dedup por nome) subpasta.
export async function createDriveSubfolderScript(parentId: string, name: string): Promise<DriveScriptEntry> {
  const r = await hbDrive("/folder", {
    method: "POST",
    body: JSON.stringify({ parent_id: parentId, name }),
  });
  return {
    id: r.folder_id, name: r.folder_name,
    mimeType: "application/vnd.google-apps.folder", isFolder: true,
    size: 0, modified: new Date().toISOString(), url: r.folder_url,
  };
}

// Sobe arquivo de QUALQUER tamanho pra pasta (sessao resumable via backend).
export async function uploadDriveFileScript(
  file: File,
  folderId: string,
  onProgress?: (frac: number) => void
): Promise<DriveScriptEntry> {
  const sess = await hbDrive("/upload-session", {
    method: "POST",
    body: JSON.stringify({
      folder_id: folderId,
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size: file.size,
    }),
  });
  const done = await putResumable(sess.session_url, file, onProgress);
  return {
    id: done.id, name: file.name,
    mimeType: file.type || "application/octet-stream",
    isFolder: false, size: file.size,
    modified: new Date().toISOString(),
    url: `https://drive.google.com/file/d/${done.id}/view`,
  };
}

/**
 * Upload de anexo do card: SEMPRE Drive, sem teto de tamanho. Se o card ja
 * tem pasta (opts.driveFolderId) usa ela; senao resolve via ensure-folder
 * com o nome do cliente e avisa o caller por opts.onFolder pra persistir em
 * kanban_cards.details.drive_folder_id. Erro no Drive = erro pro usuario
 * (NUNCA cai pro Supabase; bucket aposentado pra anexo de card).
 */
export async function uploadAnexo(
  file: File,
  _cardId: string,
  opts?: {
    driveFolderId?: string;
    clientName?: string;
    onFolder?: (info: DriveFolderInfo) => void;
    onProgress?: (frac: number) => void;
  }
): Promise<AnexoUploadResult> {
  let folderId = opts?.driveFolderId;
  if (!folderId && opts?.clientName?.trim()) {
    const info = await ensureDriveFolder(opts.clientName.trim());
    folderId = info.folderId;
    opts?.onFolder?.(info);
  }
  if (!folderId) {
    throw new Error("Card sem pasta no Drive e sem nome de cliente pra criar uma.");
  }
  const entry = await uploadDriveFileScript(file, folderId, opts?.onProgress);
  return {
    url: entry.url,
    name: file.name,
    size: file.size,
    mimeType: entry.mimeType,
    storage: "drive",
    driveFileId: entry.id,
  };
}
