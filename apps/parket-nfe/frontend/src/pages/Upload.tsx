import { useCallback, useEffect, useRef, useState } from "react";
import { Upload as UploadIcon, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { AppUser } from "../lib/auth";
import { listProjetos, uploadXMLs, vincularNota, type ClienteGrupo, type UploadResult } from "../lib/api";
import { ProjetoPicker } from "../components/ProjetoPicker";

/** Tela de upload de XMLs de NFe.
 *  Fluxo:
 *    1. Fiscal arrasta N XMLs (ou clica no botão)
 *    2. POST /api/fiscal/upload envia o lote → backend parseia, dedup por chNFe,
 *       cria fiscal.notas com status='pendente' e sugere obra por nome (fuzzy)
 *    3. UI mostra um card por XML com o dropdown de cliente/obra pré-selecionado
 *       na sugestão. Fiscal escolhe (ou mantém pendente) e clica Vincular.
 *    4. Ao vincular, PATCH /api/fiscal/notas/:ch/vincular passa a nota pra
 *       status='vinculado' e sai da fila /pendentes.
 */
export function UploadPage({ appUser }: { appUser: AppUser }) {
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [clientes, setClientes] = useState<ClienteGrupo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Carrega catálogo de projetos ao abrir a tela pra popular os dropdowns
    listProjetos().then(setClientes).catch((e) => setErro(e.message));
  }, []);

  const doUpload = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".xml"));
    if (arr.length === 0) {
      setErro("Selecione ao menos um arquivo XML");
      return;
    }
    setUploading(true);
    setErro(null);
    try {
      const res = await uploadXMLs(arr, appUser.email);
      // Novos resultados vão no topo pra fiscal ver o mais recente primeiro
      setResults((prev) => [...res, ...prev]);
    } catch (e: any) {
      setErro(e?.message || "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [appUser.email]);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-wider text-hb-textDim">Fiscal · Upload de NF-e</div>
        <h1 className="text-2xl font-display tracking-widest uppercase mt-1">Upload de Notas Fiscais</h1>
        <div className="text-xs text-hb-textDim mt-1">
          Arraste os XMLs autorizados (NFe modelo 55). Cada nota fica pendente até você vincular ao projeto.
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); doUpload(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          dragOver ? "border-hb-accent bg-hb-accent/10" : "border-hb-border bg-hb-panel/40 hover:bg-hb-panel/60"
        }`}
      >
        <input
          ref={inputRef} type="file" accept=".xml" multiple className="hidden"
          onChange={(e) => e.target.files && doUpload(e.target.files)}
        />
        <div className="w-12 h-12 rounded-lg bg-hb-accent/10 border border-hb-accent/30 flex items-center justify-center mx-auto mb-3">
          {uploading
            ? <Loader2 size={22} className="text-hb-accent animate-spin" />
            : <UploadIcon size={22} className="text-hb-accent" />}
        </div>
        <div className="text-sm font-semibold mb-1">
          {uploading ? "Enviando..." : "Arraste XMLs aqui ou clique pra selecionar"}
        </div>
        <div className="text-xs text-hb-textDim">
          Aceita múltiplos arquivos. NFe modelo 55, autorizada (cStat=100).
        </div>
      </div>

      {erro && (
        <div className="mt-4 text-xs text-hb-red bg-hb-red/10 border border-hb-red/30 rounded px-3 py-2">
          {erro}
        </div>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-hb-textDim">Notas processadas</div>
          {results.map((r, i) => (
            <NotaCard
              key={`${r.ch_nfe}-${i}`} result={r} clientes={clientes} ator={appUser.email}
              onVinculado={(idProjeto) => {
                setResults((prev) => prev.map((x, j) => j === i
                  ? { ...x, obra_projeto_id: idProjeto, status_vinculo: "vinculado" }
                  : x));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Card por nota — dados parseados + seletor de projeto + botão vincular
// ═══════════════════════════════════════════════════════════════════════

function NotaCard({ result, clientes, ator, onVinculado }: {
  result: UploadResult;
  clientes: ClienteGrupo[];
  ator: string;
  onVinculado: (idProjeto: string) => void;
}) {
  const [projetoId, setProjetoId] = useState<string>(result.sugestao_projeto?.id || result.obra_projeto_id || "");
  const [vinculando, setVinculando] = useState(false);
  const [erroVincular, setErroVincular] = useState<string | null>(null);

  // Erro no parser (cStat != 100, XML inválido etc)
  if (result.status === "erro") {
    return (
      <div className="border border-hb-red/40 bg-hb-red/5 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-hb-red shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-semibold text-hb-red">Falha ao processar XML</div>
          <div className="text-hb-textDim mt-1">{result.erro}</div>
        </div>
      </div>
    );
  }

  const isDup = result.status === "duplicado";
  const isVinculado = result.status_vinculo === "vinculado";

  async function vincular() {
    if (!projetoId) { setErroVincular("Escolha um projeto"); return; }
    setVinculando(true);
    setErroVincular(null);
    try {
      await vincularNota(result.ch_nfe, projetoId, ator);
      onVinculado(projetoId);
    } catch (e: any) {
      setErroVincular(e?.message || "Falha ao vincular");
    } finally {
      setVinculando(false);
    }
  }

  return (
    <div className={`border rounded-lg p-4 ${isVinculado ? "border-hb-green/40 bg-hb-green/5" : "border-hb-border bg-hb-panel/40"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isVinculado
              ? <CheckCircle2 size={14} className="text-hb-green" />
              : <FileText size={14} className="text-hb-accent" />}
            <div className="text-sm font-semibold truncate">
              NF-e {result.numero}/{result.serie}
              {isDup && <span className="text-[10px] ml-2 text-hb-amber uppercase tracking-wider">já cadastrada</span>}
            </div>
          </div>
          <div className="text-xs text-hb-textDim">Destinatário: <span className="text-hb-text">{result.dest_nome}</span></div>
          <div className="text-xs text-hb-textDim">Valor: <span className="text-hb-text tabular">R$ {(result.valor_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          <div className="text-[10px] text-hb-textMuted font-mono mt-1 truncate">{result.ch_nfe}</div>
        </div>
      </div>

      {/* Bloco de vínculo — some quando já está vinculado */}
      {!isVinculado && (
        <div className="mt-4 pt-4 border-t border-hb-border">
          {result.sugestao_projeto && projetoId === result.sugestao_projeto.id && (
            <div className="text-[10px] text-hb-amber bg-hb-amber/10 border border-hb-amber/20 rounded px-2 py-1 mb-2 inline-block uppercase tracking-wider">
              Sugestão automática por nome
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="text-[10px] uppercase tracking-wider text-hb-textDim block mb-1">
                Cliente · Projeto
              </label>
              <ProjetoPicker
                value={projetoId}
                onChange={setProjetoId}
                clientes={clientes}
                placeholder="Buscar cliente, endereço ou código da obra..."
              />
            </div>
            <button
              onClick={vincular} disabled={!projetoId || vinculando}
              className="text-xs px-4 py-2 bg-hb-accent/20 border border-hb-accent/40 text-hb-accent uppercase tracking-wider hover:bg-hb-accent/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
            >
              {vinculando ? <Loader2 size={12} className="animate-spin" /> : null}
              Vincular
            </button>
          </div>
          {erroVincular && (
            <div className="text-[10px] text-hb-red mt-2">{erroVincular}</div>
          )}
          <div className="text-[10px] text-hb-textMuted mt-2">
            Casos extremos sem projeto? A nota já ficou salva como <span className="text-hb-amber">pendente</span> — resolva depois em Pendentes.
          </div>
        </div>
      )}

      {isVinculado && (
        <div className="mt-3 text-xs text-hb-green">
          Vinculada ao projeto.
        </div>
      )}
    </div>
  );
}
