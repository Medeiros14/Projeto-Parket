/**
 * Google Drive API v3 direto do navegador (modo NATIVO do painel
 * "Drive do cliente" no card do HB) — PKT-HB-DRIVE-PANEL-20260902.
 *
 * O QUE: lista, cria pasta e sobe arquivo na pasta do cliente
 * (Home Broker/<CLIENTE> no shared drive Comercial) usando o token GIS do
 * usuario logado no Google (scope drive completo, ver google-auth.ts).
 *
 * POR QUE existe alem do Apps Script (anexo-upload.ts): o Apps Script tem
 * teto de ~35MB por POST (base64 infla 33%) e arquivo de arquitetura
 * (DWG/PDF/SKP) passa facil disso. Aqui o upload e RESUMABLE direto na
 * Drive API: sem limite pratico de tamanho e com progresso real (%).
 *
 * Mesmo padrao da aba Documentos do gestao (parket-gestao Documentos.tsx),
 * sempre com supportsAllDrives (as pastas vivem em shared drive).
 */
import { getAccessToken, SCOPES } from "./google-auth";

export const MIME_FOLDER = "application/vnd.google-apps.folder";

// Formato comum de entrada do painel (nativo e fallback convergem pra ele).
export type DriveEntry = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number;          // bytes (0 pra pasta/google-doc)
  modified: string;      // ISO
  url: string;           // webViewLink (abre no Drive)
};

// Token com scope drive completo (drive.file nao enxerga a pasta do cliente,
// que foi criada pelo Apps Script/sistemas@, nao por este app).
async function token(): Promise<string> {
  return getAccessToken([SCOPES.DRIVE]);
}

/** Lista o conteudo de uma pasta (pastas primeiro, depois nome A-Z). */
export async function driveListNative(folderId: string): Promise<DriveEntry[]> {
  const t = await token();
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)",
    orderBy: "folder,name",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!resp.ok) throw new Error(`Drive list HTTP ${resp.status}`);
  const data = await resp.json();
  return (data.files || []).map((f: any): DriveEntry => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    isFolder: f.mimeType === MIME_FOLDER,
    size: Number(f.size || 0),
    modified: f.modifiedTime || "",
    url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
  }));
}

/** Cria subpasta dentro de parentId e devolve a entrada criada. */
export async function driveMkdirNative(parentId: string, name: string): Promise<DriveEntry> {
  const t = await token();
  const resp = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), mimeType: MIME_FOLDER, parents: [parentId] }),
    }
  );
  if (!resp.ok) throw new Error(`Drive mkdir HTTP ${resp.status}`);
  const f = await resp.json();
  return {
    id: f.id, name: f.name, mimeType: MIME_FOLDER, isFolder: true,
    size: 0, modified: new Date().toISOString(),
    url: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
  };
}

/**
 * Upload RESUMABLE: 1) POST cria a sessao (metadados + Location), 2) PUT do
 * arquivo inteiro via XHR (progresso por evento). E o caminho certo pra
 * arquivo grande: nao carrega base64 na memoria e o Google aceita qualquer
 * tamanho que caiba na cota do drive.
 */
export async function driveUploadNative(
  file: File,
  parentId: string,
  onProgress?: (pct: number) => void
): Promise<DriveEntry> {
  const t = await token();

  // Passo 1: abre a sessao resumable e recebe a URL de upload no Location.
  const init = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify({ name: file.name, parents: [parentId] }),
    }
  );
  if (!init.ok) throw new Error(`Drive upload init HTTP ${init.status}`);
  const sessionUrl = init.headers.get("Location");
  if (!sessionUrl) throw new Error("Drive upload: sessao sem Location");

  // Passo 2: manda o binario todo num PUT (XHR pra ter onprogress; fetch
  // ainda nao expoe progresso de upload de forma ampla).
  return new Promise<DriveEntry>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessionUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const f = JSON.parse(xhr.responseText || "{}");
          resolve({
            id: f.id, name: f.name || file.name,
            mimeType: f.mimeType || file.type || "application/octet-stream",
            isFolder: false, size: file.size, modified: new Date().toISOString(),
            url: `https://drive.google.com/file/d/${f.id}/view`,
          });
        } catch { reject(new Error("Drive upload: resposta invalida")); }
      } else reject(new Error(`Drive upload HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Drive upload: falha de rede"));
    xhr.send(file);
  });
}
