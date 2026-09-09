import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Download } from "lucide-react";
import type { AppUser } from "../lib/auth";
import { listNotas, listProjetos, vincularNota, xmlUrl, pdfUrl, type ClienteGrupo, type Nota } from "../lib/api";
import { ProjetoPicker } from "../components/ProjetoPicker";

/** Fila de NFs pendentes de vínculo (status='pendente').
 *  Cada linha tem o mesmo dropdown do Upload pra fiscal resolver depois.
 *  Ao vincular, some da lista (só mostra pendentes).
 */
export function PendentesPage({ appUser }: { appUser: AppUser }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [clientes, setClientes] = useState<ClienteGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listNotas({ status: "pendente" }),
      listProjetos(),
    ]).then(([n, c]) => { setNotas(n); setClientes(c); })
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-hb-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando pendentes...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-wider text-hb-textDim">Fiscal</div>
        <h1 className="text-2xl font-display tracking-widest uppercase mt-1">Pendentes de vínculo</h1>
        <div className="text-xs text-hb-textDim mt-1">
          {notas.length === 0
            ? "Nenhuma nota pendente. Bom trabalho."
            : `${notas.length} nota${notas.length > 1 ? "s" : ""} aguardando vínculo com projeto.`}
        </div>
      </div>

      {erro && (
        <div className="mb-4 text-xs text-hb-red bg-hb-red/10 border border-hb-red/30 rounded px-3 py-2">
          {erro}
        </div>
      )}

      <div className="space-y-3">
        {notas.map((n) => (
          <PendenteRow
            key={n.ch_nfe} nota={n} clientes={clientes} ator={appUser.email}
            onVinculado={() => setNotas((prev) => prev.filter((x) => x.ch_nfe !== n.ch_nfe))}
          />
        ))}
      </div>
    </div>
  );
}

function PendenteRow({ nota, clientes, ator, onVinculado }: {
  nota: Nota;
  clientes: ClienteGrupo[];
  ator: string;
  onVinculado: () => void;
}) {
  const [projetoId, setProjetoId] = useState<string>("");
  const [vinculando, setVinculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function vincular() {
    if (!projetoId) { setErro("Escolha um projeto"); return; }
    setVinculando(true);
    setErro(null);
    try {
      await vincularNota(nota.ch_nfe, projetoId, ator);
      onVinculado();
    } catch (e: any) {
      setErro(e?.message || "Falha ao vincular");
      setVinculando(false);
    }
  }

  return (
    <div className="border border-hb-amber/30 bg-hb-amber/5 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={16} className="text-hb-amber shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">NF-e {nota.numero}/{nota.serie} · {nota.dest_nome}</div>
              <div className="text-xs text-hb-textDim">
                Valor: <span className="text-hb-text tabular">R$ {nota.valor_nf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span className="mx-2 text-hb-textMuted">·</span>
                Emitida por <span className="text-hb-text">{nota.emit_nome.substring(0, 30)}</span>
              </div>
              <div className="text-[10px] text-hb-textMuted font-mono mt-1 truncate">{nota.ch_nfe}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a href={pdfUrl(nota.ch_nfe)} target="_blank" rel="noreferrer"
                className="text-[10px] text-hb-textDim hover:text-hb-accent flex items-center gap-1 uppercase tracking-wider"
                title="Baixar DANFE (PDF)">
                <Download size={11} /> PDF
              </a>
              <a href={xmlUrl(nota.ch_nfe)} download
                className="text-[10px] text-hb-textDim hover:text-hb-text flex items-center gap-1 uppercase tracking-wider"
                title="Baixar XML">
                <Download size={11} /> XML
              </a>
            </div>
          </div>

          <div className="flex items-end gap-2 mt-2">
            <div className="flex-1 min-w-0">
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
              {vinculando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Vincular
            </button>
          </div>
          {erro && <div className="text-[10px] text-hb-red mt-1">{erro}</div>}
        </div>
      </div>
    </div>
  );
}
