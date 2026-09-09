/**
 * DrivePanel: painel "Drive do cliente" dentro do card do HB
 * (PKT-HB-DRIVE-PANEL-20260902), espelhando a aba Documentos do gestao.
 *
 * O QUE: navega a pasta do cliente (Home Broker/<CLIENTE> no shared drive
 * Comercial), com subpastas, upload (input ou drag-and-drop) e criar pasta.
 * Sem excluir nada (regra Will: nunca delete definitivo no Drive).
 *
 * DOIS MODOS, mesmo visual, AMBOS sem teto de tamanho (PKT-HB-DRIVE-20260902B):
 *  - DEFAULT (vendedor sem conta Google): list/mkdir/upload via gestao API
 *    (/api/hb-drive, auth = JWT do login do HB). Upload e RESUMABLE: o backend
 *    abre a sessao na Drive API v3 como sistemas@ e o browser faz PUT direto
 *    pro Google com % de progresso. Resolve a dor real do comercial: arquivo
 *    de arquitetura (DWG/PDF/SKP) passa facil de 150MB.
 *  - NATIVO ("Conectar Google Drive"): GIS + Drive API v3 direto do browser,
 *    com a conta Google do proprio usuario.
 *
 * NUNCA cai no Supabase Storage: destino de documento do HB e sempre o Drive.
 */
import { useEffect, useRef, useState } from "react";
import {
  Folder, FileText, Loader2, Plus, ExternalLink, RefreshCw,
  ChevronRight, LogIn, Upload, FolderPlus, Image as ImageIcon,
} from "lucide-react";
import {
  ensureDriveFolder, listDriveFolderScript, createDriveSubfolderScript,
  uploadDriveFileScript,
} from "../../lib/anexo-upload";
import {
  driveListNative, driveMkdirNative, driveUploadNative, type DriveEntry,
} from "../../lib/google-drive";
import { getAccessToken, preloadGis, isGoogleConfigured, SCOPES } from "../../lib/google-auth";

// bytes legiveis pro rodape de cada arquivo
function fmtBytes(n: number): string {
  if (!n) return "";
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`;
}

export function DrivePanel({ clientName, driveFolderId, driveFolderUrl, onFolder }: {
  clientName: string;
  driveFolderId?: string;   // kanban_cards.details.drive_folder_id
  driveFolderUrl?: string;  // kanban_cards.details.drive_folder_url
  onFolder: (patch: { drive_folder_id: string; drive_folder_url: string }) => void;
}) {
  // Modo nativo ligado apos "Conectar Google Drive" (token GIS na sessao).
  const [googleOn, setGoogleOn] = useState(false);
  // Trilha de navegacao ALEM da raiz do cliente; vazio = raiz.
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [entries, setEntries] = useState<DriveEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [upMsg, setUpMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [criandoRaiz, setCriandoRaiz] = useState(false);
  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pasta sendo exibida: fim da trilha ou a raiz do cliente no card.
  const curId = path.length ? path[path.length - 1].id : driveFolderId;

  // Pre-carrega o script GIS pra o popup de auth abrir dentro do gesto de
  // clique (senao o navegador bloqueia).
  useEffect(() => { preloadGis(); }, []);

  // (Re)lista sempre que muda a pasta atual ou o modo.
  useEffect(() => {
    if (!curId) { setEntries(null); return; }
    let vivo = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const list = googleOn ? await driveListNative(curId) : await listDriveFolderScript(curId);
        if (vivo) setEntries(list);
      } catch (e: any) {
        if (vivo) setErr(`Falha ao listar: ${e.message}`);
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, [curId, googleOn]);

  const recarregar = async () => {
    if (!curId) return;
    setLoading(true); setErr("");
    try {
      setEntries(googleOn ? await driveListNative(curId) : await listDriveFolderScript(curId));
    } catch (e: any) { setErr(`Falha ao listar: ${e.message}`); }
    finally { setLoading(false); }
  };

  // Liga o modo nativo (scope drive completo; popup so na primeira vez).
  const conectarGoogle = async () => {
    setErr("");
    try {
      await getAccessToken([SCOPES.DRIVE]);
      setGoogleOn(true);
    } catch (e: any) { setErr(e.message); }
  };

  // Card ainda sem pasta: cria/acha via ensure_hb_folder e persiste no card.
  const criarPastaCliente = async () => {
    if (!clientName.trim()) { setErr("Card sem nome de cliente."); return; }
    setCriandoRaiz(true); setErr("");
    try {
      const info = await ensureDriveFolder(clientName.trim());
      onFolder({ drive_folder_id: info.folderId, drive_folder_url: info.folderUrl });
    } catch (e: any) { setErr(`Falha ao criar pasta: ${e.message}`); }
    finally { setCriandoRaiz(false); }
  };

  // Upload em lote na pasta atual: qualquer tamanho nos 2 modos (resumable).
  const subirArquivos = async (files: File[]) => {
    if (!curId || !files.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const prefixo = `enviando ${i + 1}/${files.length}: ${f.name}`;
        setUpMsg(prefixo);
        try {
          if (googleOn) {
            await driveUploadNative(f, curId, (pct) => setUpMsg(`${prefixo} (${pct}%)`));
          } else {
            await uploadDriveFileScript(f, curId, (frac) => setUpMsg(`${prefixo} (${Math.round(frac * 100)}%)`));
          }
        } catch (e: any) {
          setErr(`Erro no ${f.name}: ${e.message}`);
        }
      }
      await recarregar();
    } finally {
      setBusy(false); setUpMsg("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const criarSubpasta = async () => {
    const nome = novaPastaNome.trim();
    if (!curId || !nome) return;
    setBusy(true); setErr("");
    try {
      if (googleOn) await driveMkdirNative(curId, nome);
      else await createDriveSubfolderScript(curId, nome);
      setNovaPastaNome(""); setNovaPastaOpen(false);
      await recarregar();
    } catch (e: any) { setErr(`Falha ao criar subpasta: ${e.message}`); }
    finally { setBusy(false); }
  };

  // Card sem pasta ainda: so o botao de criar.
  if (!driveFolderId) {
    return (
      <div>
        {err && <div className="mb-2 text-[9px] text-hb-red">{err}</div>}
        <button
          onClick={criarPastaCliente}
          disabled={criandoRaiz}
          className="w-full text-[10px] py-1.5 rounded border border-hb-accent/40 bg-hb-accent/10 text-hb-accent hover:bg-hb-accent/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
          title="Cria (ou acha) a pasta deste cliente em Home Broker no Drive da Parket"
        >
          {criandoRaiz ? <Loader2 size={11} className="animate-spin" /> : <FolderPlus size={11} />}
          Criar pasta do cliente no Drive
        </button>
      </div>
    );
  }

  const raizUrl = driveFolderUrl || `https://drive.google.com/drive/folders/${driveFolderId}`;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        subirArquivos(Array.from(e.dataTransfer.files || []));
      }}
      className={dragOver ? "rounded outline outline-1 outline-hb-accent/60" : ""}
    >
      {/* Trilha: raiz do cliente + subpastas navegadas; clique volta. */}
      <div className="flex items-center gap-0.5 mb-2 text-[10px] text-hb-textDim flex-wrap">
        <button onClick={() => setPath([])} className="hover:text-hb-accent truncate max-w-[120px]" title={raizUrl}>
          {clientName || "Pasta do cliente"}
        </button>
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-0.5">
            <ChevronRight size={9} />
            <button onClick={() => setPath(path.slice(0, i + 1))} className="hover:text-hb-accent truncate max-w-[100px]">
              {p.name}
            </button>
          </span>
        ))}
        <span className="flex-1" />
        <button onClick={recarregar} className="p-1 rounded hover:bg-hb-panelLight" title="Recarregar">
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
        </button>
        <a href={raizUrl} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-hb-panelLight" title="Abrir no Google Drive">
          <ExternalLink size={10} />
        </a>
      </div>

      {/* Modo nativo opcional: upload com a conta Google do proprio usuario. */}
      {isGoogleConfigured() && !googleOn && (
        <button
          onClick={conectarGoogle}
          className="mb-2 w-full text-[10px] py-1.5 rounded border border-hb-border bg-hb-panelLight text-hb-text hover:bg-hb-bg flex items-center justify-center gap-1.5"
          title="Opcional: login Google da equipe pra enviar com a sua propria conta (sem ele o envio ja funciona sem limite de tamanho)"
        >
          <LogIn size={11} className="text-hb-accent" />
          Conectar Google Drive (opcional)
        </button>
      )}

      {upMsg && (
        <div className="mb-2 text-[9px] text-hb-accent bg-hb-accent/5 border border-hb-accent/20 rounded px-2 py-1 flex items-center gap-1.5">
          <Loader2 size={10} className="animate-spin" /> {upMsg}
        </div>
      )}
      {err && <div className="mb-2 text-[9px] text-hb-red whitespace-pre-wrap">{err}</div>}

      <div className="flex gap-1 mb-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex-1 text-[10px] py-1.5 rounded border border-hb-accent/40 bg-hb-accent/10 text-hb-accent hover:bg-hb-accent/20 disabled:opacity-50 flex items-center justify-center gap-1"
          title="Envia direto pro Drive, sem limite de tamanho"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
          Enviar arquivo
        </button>
        <button
          onClick={() => setNovaPastaOpen((v) => !v)}
          disabled={busy}
          className="flex-1 text-[10px] py-1.5 rounded border border-hb-border bg-hb-panelLight text-hb-text hover:bg-hb-bg flex items-center justify-center gap-1"
        >
          <Plus size={10} /> Nova pasta
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={(e) => subirArquivos(Array.from(e.target.files || []))}
          className="hidden"
        />
      </div>

      {novaPastaOpen && (
        <div className="mb-2 flex gap-1">
          <input
            value={novaPastaNome}
            onChange={(e) => setNovaPastaNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") criarSubpasta(); }}
            placeholder="Nome da pasta"
            autoFocus
            className="flex-1 bg-hb-panelLight border border-hb-border rounded px-1.5 py-1 text-[11px] text-hb-text focus:outline-none"
          />
          <button onClick={criarSubpasta} className="px-3 text-[10px] rounded bg-hb-accent text-hb-bg font-semibold hover:opacity-90">
            Criar
          </button>
        </div>
      )}

      {/* Listagem: pastas navegam, arquivos abrem no Drive. Sem excluir. */}
      {loading && !entries ? (
        <div className="text-[10px] text-hb-textDim py-3 text-center">
          <Loader2 size={12} className="animate-spin inline mr-1" /> Carregando pasta...
        </div>
      ) : !entries || entries.length === 0 ? (
        <div className="text-[10px] text-hb-textDim py-3 text-center border border-dashed border-hb-border rounded">
          Pasta vazia. Arraste arquivos aqui ou use Enviar arquivo.
        </div>
      ) : (
        <ul className="space-y-1">
          {entries.map((f) => {
            const isImg = f.mimeType.startsWith("image/");
            return (
              <li key={f.id} className="flex items-center gap-2 p-1.5 rounded border border-hb-border bg-hb-bg/30">
                <span className="text-hb-accent shrink-0">
                  {f.isFolder ? <Folder size={12} /> : isImg ? <ImageIcon size={12} /> : <FileText size={12} />}
                </span>
                {f.isFolder ? (
                  <button
                    onClick={() => setPath([...path, { id: f.id, name: f.name }])}
                    className="flex-1 min-w-0 text-left"
                    title={`Abrir pasta ${f.name}`}
                  >
                    <div className="text-[11px] text-hb-text truncate">{f.name}</div>
                    <div className="text-[9px] text-hb-textDim">pasta</div>
                  </button>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-hb-text truncate" title={f.name}>{f.name}</div>
                    <div className="text-[9px] text-hb-textDim">
                      {fmtBytes(f.size)}
                      {f.modified && ` · ${new Date(f.modified).toLocaleDateString("pt-BR")}`}
                    </div>
                  </div>
                )}
                <a href={f.url} target="_blank" rel="noreferrer"
                  className="text-[10px] text-hb-accent hover:underline flex items-center gap-1 shrink-0">
                  <ExternalLink size={10} /> Abrir
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
