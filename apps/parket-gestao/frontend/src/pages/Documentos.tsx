import React, { useCallback, useEffect, useRef, useState } from "react";
import { fonts } from "../theme";
import { api, type DriveInfo, type Projeto } from "../api";
import DocsHerdados from "../components/DocsHerdados";

export function fmtBytes(n?: number | null): string {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function extIcon(nome?: string | null): string {
  const ext = (nome || "").split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "PDF";
  if (["doc", "docx"].includes(ext)) return "DOC";
  if (["xls", "xlsx", "csv"].includes(ext)) return "XLS";
  if (["ppt", "pptx"].includes(ext)) return "PPT";
  if (ext === "dwg") return "DWG";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "IMG";
  return ext.toUpperCase() || "DOC";
}

/** Extrai o ID da pasta de qualquer formato de link do Drive
 *  (…/folders/<id>, …?id=<id>, open?id=<id>). */
function driveFolderId(url: string): string | null {
  const m = url.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || url.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

// ── Google Drive conectado no painel ─────────────────────────────────
// Mesmo fluxo da Central do Cliente do Space: OAuth GIS (token client) +
// Drive API v3 direto do browser, na MESMA pasta do card do cliente
// (kanban_cards.details.drive_folder_id via GET /api/projetos/{pid}/drive).
const GOOGLE_CLIENT_ID = "768306132819-7l4enmfutc8brk12msqi0kohdf65550s.apps.googleusercontent.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

let _gTokenClient: any = null;
let _gToken: string | null = null;
let _gTokenExp = 0;

function gisTokenClient(): any {
  const g = (window as any).google;
  if (!g?.accounts?.oauth2) throw new Error("Google Identity ainda não carregou — tente de novo");
  if (!_gTokenClient) {
    _gTokenClient = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: DRIVE_SCOPE, callback: () => {},
    });
  }
  return _gTokenClient;
}

function temTokenValido(): boolean {
  return !!_gToken && Date.now() < _gTokenExp - 60_000;
}

function driveToken(prompt: "" | "none" | "consent"): Promise<string> {
  if (temTokenValido()) return Promise.resolve(_gToken!);
  return new Promise((resolve, reject) => {
    const tc = gisTokenClient();
    tc.callback = (resp: any) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      _gToken = resp.access_token;
      _gTokenExp = Date.now() + (resp.expires_in ?? 3600) * 1000;
      resolve(_gToken!);
    };
    tc.error_callback = (err: any) => {
      reject(new Error(err?.type || "popup_failed_to_open"));
    };
    tc.requestAccessToken({ prompt });
  });
}

type DriveFile = {
  id: string; name: string; mimeType: string;
  modifiedTime?: string; size?: string; webViewLink?: string;
};
const MIME_FOLDER = "application/vnd.google-apps.folder";

async function driveList(folderId: string, prompt: "" | "none" | "consent"): Promise<DriveFile[]> {
  const token = await driveToken(prompt);
  const u = new URL(`${DRIVE_API}/files`);
  u.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
  u.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,size,webViewLink)");
  u.searchParams.set("orderBy", "folder,name");
  u.searchParams.set("pageSize", "200");
  u.searchParams.set("supportsAllDrives", "true");
  u.searchParams.set("includeItemsFromAllDrives", "true");
  const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive HTTP ${r.status}`);
  return (await r.json()).files ?? [];
}

async function driveUpload(file: File, parentId: string, onProgress: (pct: number) => void): Promise<void> {
  const token = await driveToken("");
  const boundary = "pkt_" + Math.random().toString(36).slice(2);
  const buf = await file.arrayBuffer();
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: file.name, parents: [parentId] }) +
    `\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`);
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + buf.byteLength + tail.length);
  body.set(head, 0);
  body.set(new Uint8Array(buf), head.length);
  body.set(tail, head.length + buf.byteLength);
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name");
    x.setRequestHeader("Authorization", `Bearer ${token}`);
    x.setRequestHeader("Content-Type", `multipart/related; boundary=${boundary}`);
    x.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100)); };
    x.onload = () => (x.status >= 200 && x.status < 300) ? resolve() : reject(new Error(`upload HTTP ${x.status}`));
    x.onerror = () => reject(new Error("upload falhou"));
    x.send(body);
  });
}

async function driveMkdir(name: string, parentId: string): Promise<void> {
  const token = await driveToken("");
  const r = await fetch(`${DRIVE_API}/files?supportsAllDrives=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: MIME_FOLDER, parents: [parentId] }),
  });
  if (!r.ok) throw new Error(`Drive HTTP ${r.status}`);
}

async function driveDelete(id: string): Promise<void> {
  const token = await driveToken("");
  const r = await fetch(`${DRIVE_API}/files/${id}?supportsAllDrives=true`, {
    method: "DELETE", headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok && r.status !== 204) throw new Error(`Drive HTTP ${r.status}`);
}

function fmtData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const btnS = (t: any, primary = false): React.CSSProperties => ({
  fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
  padding: "5px 10px", cursor: "pointer", textDecoration: "none",
  fontFamily: fonts.inter,
  ...(primary
    ? { background: t.accent, color: t.bg, border: "none" }
    : { background: "transparent", border: `1px solid ${t.border2}`, color: t.textSecondary }),
});

/** Pasta do Google Drive do projeto conectada no painel (Will 16/07). */
function PastaDrive({ projeto, onSaved, t }: {
  projeto: Projeto; onSaved: () => void; t: any;
}) {
  const [info, setInfo] = useState<DriveInfo | null>(null);
  const [conectado, setConectado] = useState(false);
  const [precisaLogin, setPrecisaLogin] = useState(false);
  const [criando, setCriando] = useState(false);
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [linkManual, setLinkManual] = useState(false);
  const [url, setUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const upRef = useRef<HTMLInputElement>(null);

  const rootId = info?.folder_id || (info?.folder_url ? driveFolderId(info.folder_url) : null);
  const pastaAtual = path.length ? path[path.length - 1].id : rootId;
  const pastas = files.filter((f) => f.mimeType === MIME_FOLDER);
  const arquivos = files.filter((f) => f.mimeType !== MIME_FOLDER);
  const abrirUrl = path.length
    ? `https://drive.google.com/drive/folders/${pastaAtual}`
    : (info?.folder_url || (rootId ? `https://drive.google.com/drive/folders/${rootId}` : ""));

  useEffect(() => {
    setPath([]); setFiles([]); setConectado(false); setPrecisaLogin(false);
    api.projetoDrive(projeto.id).then(setInfo)
      .catch(() => setInfo({ folder_id: null, folder_url: null, fonte: null }));
  }, [projeto.id]);

  const listar = useCallback(async (prompt: "" | "none" | "consent") => {
    if (!pastaAtual) return;
    setLoading(true); setErro(null);
    try {
      const fs = await driveList(pastaAtual, prompt);
      setFiles(fs); setConectado(true); setPrecisaLogin(false);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/interaction_required|login_required|consent_required|access_denied|popup|401|403/.test(msg)) {
        setConectado(false); setPrecisaLogin(true);
      } else {
        setErro(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [pastaAtual]);

  // Popup do Google só pode abrir a partir de um clique (senão o browser
  // bloqueia). Sem token em cache, mostra o botão "Conectar" direto.
  useEffect(() => {
    if (!pastaAtual) return;
    if (temTokenValido()) listar("").catch(() => {});
    else setPrecisaLogin(true);
  }, [pastaAtual, listar]);

  const conectar = async () => {
    try { await listar(""); } catch { /* usuário fechou o popup */ }
  };

  const criarPasta = async () => {
    setCriando(true); setErro(null);
    try {
      const novo = await api.projetoDriveCriar(projeto.id, localStorage.getItem("gestao_user_email"));
      setInfo(novo); onSaved();
    } catch (e: any) {
      setErro(`Falha ao criar pasta: ${e?.message || e}`);
    } finally {
      setCriando(false);
    }
  };

  const salvarLink = async () => {
    const limpo = url.trim();
    if (!/^https:\/\/(drive|docs)\.google\.com\//.test(limpo)) {
      alert("Cole um link de pasta do Google Drive (https://drive.google.com/…)");
      return;
    }
    try {
      await api.projetoPatch(projeto.id, {
        meta: { ...(projeto.meta || {}), drive_folder_url: limpo },
      } as any);
      setInfo({ folder_id: null, folder_url: limpo, fonte: "meta" });
      setLinkManual(false); onSaved();
    } catch (e: any) {
      alert(`Falha ao salvar: ${e?.message || e}`);
    }
  };

  const subirArquivos = async (list: File[]) => {
    if (!list.length || !pastaAtual) return;
    setErro(null);
    try {
      for (const f of list) {
        setProgresso(0);
        await driveUpload(f, pastaAtual, setProgresso);
      }
      await listar("");
    } catch (err: any) {
      setErro(`Falha no upload: ${err?.message || err}`);
    } finally {
      setProgresso(null);
    }
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    subirArquivos(list);
  };

  const novaPasta = async () => {
    const nome = prompt("Nome da nova pasta:");
    if (!nome?.trim() || !pastaAtual) return;
    try { await driveMkdir(nome.trim(), pastaAtual); await listar(""); }
    catch (e: any) { setErro(`Falha ao criar pasta: ${e?.message || e}`); }
  };

  const excluir = async (f: DriveFile) => {
    if (!confirm(`Excluir "${f.name}" do Drive?`)) return;
    try { await driveDelete(f.id); await listar(""); }
    catch (e: any) { setErro(`Falha ao excluir: ${e?.message || e}`); }
  };

  const boxBody: React.CSSProperties = {
    border: `1px solid ${t.border1}`, borderTop: "none",
    padding: "12px", background: t.card1,
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 10, flexWrap: "wrap",
        padding: "8px 12px", background: t.card2, border: `1px solid ${t.border1}`,
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.22em", color: t.textPrimary, textTransform: "uppercase", fontWeight: 600 }}>
          Pasta do Drive — todos os arquivos do projeto
        </div>
        {rootId && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {conectado && (
              <>
                <button onClick={() => upRef.current?.click()} style={btnS(t, true)} disabled={progresso !== null}>
                  {progresso !== null ? `Enviando ${progresso}%` : "+ Arquivo"}
                </button>
                <button onClick={novaPasta} style={btnS(t)}>+ Pasta</button>
                <button onClick={() => listar("")} style={btnS(t)}>Atualizar</button>
              </>
            )}
            <a href={abrirUrl} target="_blank" rel="noreferrer" style={btnS(t)}>Abrir no Drive ↗</a>
          </div>
        )}
      </div>
      <input ref={upRef} type="file" multiple style={{ display: "none" }} onChange={onUpload} />

      {info === null ? (
        <div style={{ ...boxBody, fontSize: 11, color: t.textSecondary }}>Carregando…</div>
      ) : !rootId ? (
        <div style={{ ...boxBody, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: t.textSecondary, flex: 1, minWidth: 220 }}>
            Este projeto ainda não tem pasta no Drive.
          </div>
          {linkManual ? (
            <>
              <input value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/…"
                style={{
                  flex: 2, minWidth: 240, padding: "8px 10px",
                  background: t.card2, border: `1px solid ${t.border1}`,
                  color: t.textPrimary, outline: "none", fontFamily: fonts.inter, fontSize: 11,
                }} />
              <button onClick={salvarLink} style={btnS(t, true)}>Salvar</button>
              <button onClick={() => setLinkManual(false)} style={btnS(t)}>Cancelar</button>
            </>
          ) : (
            <>
              <button onClick={criarPasta} disabled={criando} style={btnS(t, true)}>
                {criando ? "criando…" : "Criar pasta no Drive"}
              </button>
              <button onClick={() => setLinkManual(true)} style={btnS(t)}>Vincular link existente</button>
            </>
          )}
        </div>
      ) : precisaLogin ? (
        <div style={{ ...boxBody, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: t.textSecondary, flex: 1, minWidth: 220 }}>
            Conecte sua conta Google (@parket.com.br) pra ver e enviar arquivos sem sair do painel.
          </div>
          <button onClick={conectar} style={btnS(t, true)}>Conectar Google Drive</button>
        </div>
      ) : (
        <div
          style={{
            ...boxBody, padding: "14px 16px 18px", position: "relative",
            outline: dragOver ? `2px dashed ${t.accent}` : "none", outlineOffset: -6,
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            subirArquivos(Array.from(e.dataTransfer.files || []));
          }}
        >
          <style>{`
            .pkt-dcard { transition: border-color .12s ease, transform .12s ease; }
            .pkt-dcard:hover { border-color: rgba(212,168,83,0.65) !important; transform: translateY(-1px); }
            .pkt-dcard .pkt-x, .pkt-frow .pkt-x { opacity: 0; transition: opacity .12s ease; }
            .pkt-dcard:hover .pkt-x, .pkt-frow:hover .pkt-x { opacity: 1; }
            .pkt-frow:hover { background: rgba(127,127,127,0.08); }
          `}</style>

          {/* breadcrumb sempre visível */}
          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 14, fontSize: 11 }}>
            {path.length === 0 ? (
              <span style={{ color: t.textPrimary, fontWeight: 600, letterSpacing: "0.06em" }}>
                {projeto.cliente || "Raiz"}
              </span>
            ) : (
              <button onClick={() => setPath([])} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: t.accent, fontSize: 11, fontFamily: fonts.inter,
              }}>
                {projeto.cliente || "Raiz"}
              </button>
            )}
            {path.map((p, i) => (
              <React.Fragment key={p.id}>
                <span style={{ color: t.textTertiary }}>›</span>
                {i < path.length - 1 ? (
                  <button onClick={() => setPath(path.slice(0, i + 1))} style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    color: t.accent, fontSize: 11, fontFamily: fonts.inter,
                  }}>
                    {p.name}
                  </button>
                ) : (
                  <span style={{ color: t.textPrimary, fontWeight: 600 }}>{p.name}</span>
                )}
              </React.Fragment>
            ))}
            {loading && <span style={{ fontSize: 9, color: t.textTertiary, marginLeft: 4 }}>atualizando…</span>}
          </div>

          {erro && (
            <div style={{ fontSize: 10, color: "#E5484D", marginBottom: 10 }}>{erro}</div>
          )}

          {loading && files.length === 0 ? (
            <div style={{ fontSize: 11, color: t.textSecondary, padding: "18px 0" }}>Carregando arquivos…</div>
          ) : files.length === 0 ? (
            <div style={{
              padding: "34px 0", textAlign: "center",
              border: `1px dashed ${t.border2}`, color: t.textSecondary, fontSize: 11,
            }}>
              Pasta vazia — arraste arquivos aqui ou use "+ Arquivo".
            </div>
          ) : (
            <>
              {pastas.length > 0 && (
                <div style={{
                  display: "grid", gap: 10, marginBottom: arquivos.length ? 20 : 0,
                  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                }}>
                  {pastas.map((f) => (
                    <div key={f.id} className="pkt-dcard"
                      onClick={() => setPath([...path, { id: f.id, name: f.name }])}
                      style={{
                        position: "relative", cursor: "pointer",
                        padding: "14px 14px 12px", background: t.card2,
                        border: `1px solid ${t.border1}`,
                      }}>
                      <svg width="34" height="27" viewBox="0 0 24 19" style={{ display: "block", marginBottom: 10 }}>
                        <path
                          d="M1 3.2C1 2.3 1.7 1.6 2.6 1.6h5.2l2.1 2.6h11.5c.9 0 1.6.7 1.6 1.6v9.8c0 .9-.7 1.6-1.6 1.6H2.6c-.9 0-1.6-.7-1.6-1.6V3.2z"
                          fill="rgba(212,168,83,0.22)" stroke="rgba(212,168,83,0.8)" strokeWidth="1.1" />
                      </svg>
                      <div title={f.name} style={{
                        fontSize: 12, color: t.textPrimary, fontWeight: 500, lineHeight: 1.35,
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                      }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 6 }}>
                        {fmtData(f.modifiedTime)}
                      </div>
                      <button className="pkt-x" title="Excluir"
                        onClick={(e) => { e.stopPropagation(); excluir(f); }}
                        style={{
                          position: "absolute", top: 6, right: 6,
                          background: "none", border: "none", cursor: "pointer",
                          color: t.textSecondary, fontSize: 13, padding: "2px 6px",
                        }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {arquivos.length > 0 && (
                <>
                  {pastas.length > 0 && (
                    <div style={{
                      fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                      color: t.textTertiary, marginBottom: 6, fontWeight: 600,
                    }}>
                      Arquivos
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {arquivos.map((f) => (
                      <div key={f.id} className="pkt-frow" style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 6px", borderBottom: `1px solid ${t.border1}`,
                      }}>
                        <span style={{
                          fontSize: 8, letterSpacing: "0.1em", fontWeight: 600,
                          padding: "3px 6px", minWidth: 34, textAlign: "center",
                          background: t.card2, color: t.textSecondary,
                          border: `1px solid ${t.border1}`, flexShrink: 0,
                        }}>
                          {extIcon(f.name)}
                        </span>
                        <button
                          onClick={() => f.webViewLink && window.open(f.webViewLink, "_blank")}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                            color: t.textPrimary, fontSize: 12, fontFamily: fonts.inter,
                            textAlign: "left", flex: 1, minWidth: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                          title={f.name}
                        >
                          {f.name}
                        </button>
                        <span style={{ fontSize: 9, color: t.textSecondary, width: 58, textAlign: "right", flexShrink: 0 }}>
                          {fmtBytes(f.size ? Number(f.size) : null)}
                        </span>
                        <span style={{ fontSize: 9, color: t.textSecondary, width: 52, textAlign: "right", flexShrink: 0 }}>
                          {fmtData(f.modifiedTime)}
                        </span>
                        <button className="pkt-x" onClick={() => excluir(f)} title="Excluir" style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: t.textSecondary, fontSize: 13, padding: "0 5px", flexShrink: 0,
                        }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentosTab({ projetoId, projeto, onReload, t }: {
  projetoId: string; projeto?: Projeto; onReload?: () => void; t: any;
}) {
  return (
    <div style={{ overflowY: "auto", padding: "20px 32px 60px" }}>
      <DocsHerdados projetoId={projetoId} t={t} />
      {projeto ? (
        <PastaDrive projeto={projeto} onSaved={() => onReload?.()} t={t} />
      ) : (
        <div style={{ fontSize: 11, color: t.textTertiary, letterSpacing: "0.12em" }}>
          Carregando projeto…
        </div>
      )}
    </div>
  );
}
