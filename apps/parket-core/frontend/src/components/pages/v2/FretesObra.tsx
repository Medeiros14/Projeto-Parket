/**
 * Fretes — task #1890
 * Lista fretes do expedicao.parket.works com seletor de obra por linha.
 * Órfãos (sem obra) vêm primeiro pra facilitar triagem dos maiores gastos.
 * Toda mudança em obra_id dispara o trigger expedicao_frete_sync_core (SQL 025)
 * que reajusta os 3 lançamentos (adiant.1/2 + saldo) no core.lancamentos —
 * painel /obras recalcula na hora.
 */
import { useEffect, useMemo, useState } from "react";
import { Truck, Search, Building2, Loader2 } from "lucide-react";
import { api, useFetch, type Obra, type ObraSugestao } from "../../../lib/api";
import { fmtBRL, obraCodigo, obraLabel } from "../../../lib/format";
import { Input } from "../../ui/Form";
import { toast } from "../../../lib/toast";

type FilterMode = "sem_obra" | "com_obra" | "todos";

export function FretesObraPage() {
  const fr = useFetch(() => api.expedicaoFretes(), []);
  const ob = useFetch(() => api.obrasCloud(), []);
  // Sugestões ranqueadas dos órfãos (SQL 026). Chamada única, ~1s: não
  // bloqueia a tela, os botões aparecem quando chegam.
  const sg = useFetch(() => api.sugestoesFretes(), []);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<FilterMode>("sem_obra");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [override, setOverride] = useState<Record<string, string | null>>({});

  const obraById = useMemo(() => {
    const m = new Map<string, Obra>();
    (ob.data || []).forEach((o) => m.set(o.id, o));
    return m;
  }, [ob.data]);

  // frete_id -> candidatos ranqueados. Vazio enquanto sg não chega.
  const sugPorFrete = useMemo(() => {
    const m = new Map<string, ObraSugestao[]>();
    (sg.data || []).forEach((s) => m.set(s.frete_id, s.candidatos || []));
    return m;
  }, [sg.data]);

  const withOverride = useMemo(() => (fr.data || []).map((f) => ({
    ...f,
    obra_id: override[f.id] !== undefined ? override[f.id] : f.obra_id,
  })), [fr.data, override]);

  const rows = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return withOverride
      .filter((f) => f.status !== "cancelado")
      .filter((f) => mode === "todos" ? true
        : mode === "sem_obra" ? !f.obra_id : !!f.obra_id)
      .filter((f) => !qLower
        || (f.cliente_nome || "").toLowerCase().includes(qLower)
        || (f.numero || "").toLowerCase().includes(qLower)
        || (f.motorista_nome || "").toLowerCase().includes(qLower))
      .sort((a, b) => Number(b.valor_total || 0) - Number(a.valor_total || 0));
  }, [withOverride, mode, q]);

  const semObra = withOverride.filter((f) => f.status !== "cancelado" && !f.obra_id).length;
  const comObra = withOverride.filter((f) => f.status !== "cancelado" && !!f.obra_id).length;

  async function vincular(freteId: string, obraId: string | null) {
    setSaving((s) => ({ ...s, [freteId]: true }));
    setOverride((o) => ({ ...o, [freteId]: obraId }));
    try {
      await api.setFreteObra(freteId, obraId);
      toast.success(obraId ? "Frete vinculado à obra" : "Vínculo removido");
    } catch (e: any) {
      setOverride((o) => { const n = { ...o }; delete n[freteId]; return n; });
      toast.error("Falha ao vincular: " + (e?.message || e));
    } finally {
      setSaving((s) => { const n = { ...s }; delete n[freteId]; return n; });
    }
  }

  if (fr.loading || ob.loading) {
    return <div className="p-8 max-w-6xl mx-auto"><Loader2 size={16} className="animate-spin text-parket-accent" /></div>;
  }
  if (fr.error) return <div className="p-8 text-xs text-red-400">Erro: {String(fr.error)}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Truck size={18} className="text-parket-accent" /> Fretes
        </h1>
        <p className="text-xs text-parket-textDim mt-1">
          Cada frete gera saída na obra vinculada. Ajuste aqui quando o cliente
          no expedicao não bate com o nome exato da obra no Core.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-parket-textDim" />
          <Input placeholder="Buscar por cliente, número ou motorista…"
            value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          <FiltroBtn active={mode === "sem_obra"} onClick={() => setMode("sem_obra")}>
            Sem obra ({semObra})
          </FiltroBtn>
          <FiltroBtn active={mode === "com_obra"} onClick={() => setMode("com_obra")}>
            Vinculados ({comObra})
          </FiltroBtn>
          <FiltroBtn active={mode === "todos"} onClick={() => setMode("todos")}>
            Todos
          </FiltroBtn>
        </div>
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhum frete nesse filtro.</div>
        ) : (
          <div className="divide-y divide-parket-border/50">
            {rows.map((f) => {
              const obra = f.obra_id ? obraById.get(f.obra_id) : null;
              const pagoLabel = [
                f.adiantamento1_pago && "Adiant. 1",
                f.adiantamento2_pago && "Adiant. 2",
                f.saldo_pago && "Saldo",
              ].filter(Boolean).join(" · ");
              return (
                <div key={f.id} className="p-4 hover:bg-parket-panelLight transition">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[240px]">
                      <div className="text-sm font-semibold truncate">
                        {f.cliente_nome || "(sem cliente)"}
                      </div>
                      <div className="text-[10px] text-parket-textDim mt-0.5 flex flex-wrap gap-x-3">
                        <span>{f.numero}</span>
                        {f.destino_cidade && <span>{f.destino_cidade}/{f.destino_estado}</span>}
                        {f.data_saida && <span>Saída {String(f.data_saida).split("-").reverse().join("/")}</span>}
                        {f.motorista_nome && <span>{f.motorista_nome}</span>}
                        {pagoLabel && <span className="text-parket-accent">Pago: {pagoLabel}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-parket-accent tabular-nums">
                        {fmtBRL(f.valor_total || 0)}
                      </div>
                    </div>
                    <div className="w-[280px]">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-parket-textDim shrink-0" />
                        <ObraSelect
                          value={f.obra_id}
                          obras={ob.data || []}
                          disabled={!!saving[f.id]}
                          onChange={(v) => vincular(f.id, v)}
                        />
                        {saving[f.id] && <Loader2 size={12} className="animate-spin text-parket-textDim shrink-0" />}
                      </div>
                      {obra && obraCodigo(obra.codigo) && (
                        <div className="text-[9px] text-parket-textDim mt-1 truncate">
                          {obraCodigo(obra.codigo)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sugestões ranqueadas (SQL 026): só pros órfãos, um clique
                      vincula. O valor da obra desempata homônimas (mesmo
                      cliente com duas propostas sairia como linha repetida). */}
                  {!f.obra_id && (sugPorFrete.get(f.id) || []).length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-parket-textDim">
                        Sugestões
                      </span>
                      {(sugPorFrete.get(f.id) || []).map((s) => (
                        <button
                          key={s.obra_id}
                          disabled={!!saving[f.id]}
                          onClick={() => vincular(f.id, s.obra_id)}
                          title={`${s.motivo} (${s.score})`}
                          className="px-2 py-1 rounded-lg text-[10px] bg-parket-panelLight border border-parket-border hover:border-parket-accent/60 hover:bg-parket-accent/10 transition disabled:opacity-50 text-left"
                        >
                          <span className="font-semibold">{s.nome}</span>
                          <span className="text-parket-textDim ml-1.5">
                            {s.motivo}
                            {Number(s.valor_venda) > 0 && ` · ${fmtBRL(s.valor_venda || 0)}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FiltroBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
        active
          ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
          : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
      }`}>{children}</button>
  );
}

/**
 * Select de obra com busca via <datalist>. Aceita digitar código, nome ou
 * "codigo · nome" — resolve no blur. Match falho restaura display do value.
 * Datalist evita menu gigante quando há 300+ obras.
 */
function ObraSelect({ value, obras, disabled, onChange }: {
  value: string | null;
  obras: Obra[];
  disabled?: boolean;
  onChange: (obraId: string | null) => void;
}) {
  const listId = useMemo(() => "obras-" + Math.random().toString(36).slice(2, 8), []);
  const label = (o: Obra) => obraLabel(o.codigo, o.nome);
  const [text, setText] = useState(() => {
    const o = obras.find((x) => x.id === value);
    return o ? label(o) : "";
  });
  useEffect(() => {
    const o = obras.find((x) => x.id === value);
    setText(o ? label(o) : "");
  }, [value, obras]);

  function tryResolve() {
    const t = text.trim();
    if (!t) { if (value) onChange(null); return; }
    const nt = t.toLowerCase();
    const byCodigo = obras.find((o) => o.codigo.toLowerCase() === nt);
    if (byCodigo) { if (byCodigo.id !== value) onChange(byCodigo.id); return; }
    const byNome = obras.find((o) => o.nome.toLowerCase() === nt);
    if (byNome) { if (byNome.id !== value) onChange(byNome.id); return; }
    const byLabel = obras.find((o) => label(o).toLowerCase() === nt);
    if (byLabel) { if (byLabel.id !== value) onChange(byLabel.id); return; }
    const o = obras.find((x) => x.id === value);
    setText(o ? label(o) : "");
  }

  return (
    <>
      <input
        list={listId}
        value={text}
        placeholder="Vincular obra…"
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={tryResolve}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="flex-1 bg-parket-panelLight border border-parket-border rounded px-2 py-1 text-[11px] outline-none focus:border-parket-accent disabled:opacity-50 min-w-0"
      />
      <datalist id={listId}>
        {obras.map((o) => (
          <option key={o.id} value={label(o)} />
        ))}
      </datalist>
    </>
  );
}
