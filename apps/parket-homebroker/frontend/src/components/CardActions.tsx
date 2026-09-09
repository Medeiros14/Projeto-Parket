/**
 * CardActions — controles inline pra mover etapa do kanban e mudar responsável.
 * Igual padrão do Space: quando SDR move pra "Vendedor", o card pula automático
 * do funil-entrada → comercial.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Check, User, Move, Trophy, X as XIcon, ThumbsUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import { api, useFetch, resolveSlug, DEPT_ENTRADA, DEPT_COMERCIAL } from "../lib/api";

type Props = {
  cardId: string;
  deptId: string;
  columnId: string | null;
  responsavel: string | null;
  onChanged?: () => void;
  compact?: boolean;
};

export function CardActions({ cardId, deptId, columnId, responsavel, onChanged, compact }: Props) {
  const cols = useFetch(() => api.columns(), []);
  const allCards = useFetch(() => api.cards(800), []);
  const [savingStage, setSavingStage] = useState(false);
  const [savingResp, setSavingResp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respOpen, setRespOpen] = useState(false);
  const [respInput, setRespInput] = useState("");

  // Etapa atual (slug canônico)
  const slugAtual = useMemo(() => resolveSlug(columnId, cols.data || []), [columnId, cols.data]);

  // Lista de etapas (agrupada por funil) — opções incluem MOVER entre funis.
  // "criacao-orcamento" fica FORA do select (Will 25/08): a coluna é oculta no
  // kanban de vendas, então mover manualmente pra lá deixava o card invisível
  // (padrão limbo). Só o fluxo Solicitar Orçamento move pra essa etapa.
  // Exceção: se o card JÁ está nela, mantemos a opção pro select exibir o valor.
  const opcoes = useMemo(() => {
    const all = cols.data || [];
    const entrada = all.filter((c) => c.dept_id === DEPT_ENTRADA);
    const comercial = all.filter((c) => c.dept_id === DEPT_COMERCIAL &&
      (c.slug !== "criacao-orcamento" || c.slug === slugAtual));
    return { entrada, comercial };
  }, [cols.data, slugAtual]);

  // Responsáveis sugeridos (distintos dos cards atuais)
  const responsaveisExistentes = useMemo(() => {
    const s = new Set<string>();
    (allCards.data || []).forEach((c) => { if (c.responsavel) s.add(c.responsavel.trim()); });
    return [...s].sort();
  }, [allCards.data]);

  const moverEtapa = async (newDeptId: string, newSlug: string) => {
    if (savingStage) return;
    setSavingStage(true); setError(null);
    try {
      // Patch: dept_id pode mudar se for transferência entrada→vendas
      const patch: any = { column_id: newSlug, updated_at: new Date().toISOString() };
      if (newDeptId !== deptId) patch.dept_id = newDeptId;
      const { error } = await supabase.from("kanban_cards").update(patch).eq("id", cardId);
      if (error) throw error;
      // Loga movimentação pro timeline (best-effort)
      try {
        await supabase.from("card_movements").insert({
          card_id: cardId, from_column: slugAtual || columnId, to_column: newSlug,
          moved_by: "homebroker", moved_at: new Date().toISOString(),
        });
      } catch {}
      // Meta CAPI: dispara LeadQualificado / Purchase quando o card entra em
      // "qualificado" (funil-entrada) ou "ganho" (funil comercial). Mesmo padrão
      // do Space (Dashboard). Rotas são idempotentes; falha não bloqueia o move.
      if (newDeptId === DEPT_ENTRADA && newSlug === "qualificado") {
        fetch("https://agente.parket.works/api/leads/qualify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: cardId }),
        }).catch(() => {});
      } else if (newDeptId === DEPT_COMERCIAL && newSlug === "ganho") {
        fetch("https://agente.parket.works/api/leads/closed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: cardId }),
        }).catch(() => {});
      }
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || "Falha ao mover");
    } finally {
      setSavingStage(false);
    }
  };

  const setResponsavel = async (nome: string) => {
    if (savingResp) return;
    const novo = nome.trim();
    if (!novo) return;
    setSavingResp(true); setError(null);
    try {
      const { error } = await supabase.from("kanban_cards").update({
        responsavel: novo, updated_at: new Date().toISOString(),
      }).eq("id", cardId);
      if (error) throw error;
      onChanged?.();
      setRespOpen(false); setRespInput("");
    } catch (e: any) {
      setError(e?.message || "Falha ao atribuir");
    } finally {
      setSavingResp(false);
    }
  };

  // Atalhos rápidos com a mesma lógica do kanban
  const quickButtons = [
    { label: "Qualificado", icon: <ThumbsUp size={10} />, slug: "qualificado", dept: DEPT_ENTRADA, color: "blue",
      disabled: slugAtual === "qualificado" },
    { label: "Ganho", icon: <Trophy size={10} />, slug: "ganho", dept: DEPT_COMERCIAL, color: "green",
      disabled: slugAtual === "ganho" },
    { label: "Perdido", icon: <XIcon size={10} />, slug: "perda", dept: DEPT_COMERCIAL, color: "red",
      disabled: slugAtual === "perda" },
  ] as const;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      {quickButtons.map((b) => {
        const colors = b.color === "green" ? "border-hb-green/40 text-hb-green hover:bg-hb-green/15"
                     : b.color === "red"   ? "border-hb-red/40 text-hb-red hover:bg-hb-red/15"
                     : "border-hb-blue/40 text-hb-blue hover:bg-hb-blue/15";
        return (
          <button key={b.slug} onClick={() => moverEtapa(b.dept, b.slug)}
            disabled={savingStage || b.disabled}
            title={b.disabled ? `Já está em ${b.label}` : `Mover pra ${b.label}`}
            className={`px-2 py-1 rounded border font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 ${colors}`}>
            {b.icon} {b.label}
          </button>
        );
      })}
      <span className="text-hb-textDim mx-0.5">·</span>
      {/* Etapa */}
      <div className="relative">
        <select
          value={`${deptId}|${slugAtual}`}
          onChange={(e) => {
            const [d, s] = e.target.value.split("|");
            if (d !== deptId || s !== slugAtual) moverEtapa(d, s);
          }}
          disabled={savingStage || cols.loading}
          className="bg-hb-bg border border-hb-border rounded pl-6 pr-6 py-1 text-xs outline-none focus:border-hb-accent appearance-none cursor-pointer">
          <optgroup label="Funil de Entrada (SDR)">
            {opcoes.entrada.map((c) => (
              <option key={c.id} value={`${DEPT_ENTRADA}|${c.slug}`}>{c.title}</option>
            ))}
          </optgroup>
          <optgroup label="Funil de Vendas (Vendedor)">
            {opcoes.comercial.map((c) => (
              <option key={c.id} value={`${DEPT_COMERCIAL}|${c.slug}`}>{c.title}</option>
            ))}
          </optgroup>
        </select>
        <Move size={9} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-hb-textDim pointer-events-none" />
        <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-hb-textDim pointer-events-none" />
        {savingStage && <Loader2 size={9} className="animate-spin absolute right-5 top-1/2 -translate-y-1/2 text-hb-accent" />}
      </div>

      {/* Responsável */}
      <div className="relative">
        <button onClick={() => setRespOpen(!respOpen)}
          className="bg-hb-bg border border-hb-border rounded pl-6 pr-6 py-1 text-xs outline-none focus:border-hb-accent flex items-center gap-1 hover:border-hb-accent">
          <User size={9} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-hb-textDim" />
          <span className="truncate max-w-[120px] text-hb-text">{responsavel || "Sem responsável"}</span>
          <ChevronDown size={9} className="text-hb-textDim" />
          {savingResp && <Loader2 size={9} className="animate-spin text-hb-accent" />}
        </button>
        {respOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-hb-panel border border-hb-border rounded shadow-xl min-w-[200px] max-h-[300px] overflow-auto">
            <div className="p-1.5 border-b border-hb-border sticky top-0 bg-hb-panel">
              <input value={respInput} onChange={(e) => setRespInput(e.target.value)}
                placeholder="Buscar ou digitar novo nome…" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && respInput.trim()) setResponsavel(respInput); }}
                className="w-full bg-hb-bg border border-hb-border rounded px-2 py-1 text-[11px] outline-none focus:border-hb-accent" />
            </div>
            {respInput.trim() && !responsaveisExistentes.some((r) => r.toLowerCase() === respInput.trim().toLowerCase()) && (
              <button onClick={() => setResponsavel(respInput)}
                className="w-full text-left text-[11px] px-3 py-1.5 hover:bg-hb-accent/15 text-hb-accent border-b border-hb-border">
                + Atribuir "<strong>{respInput.trim()}</strong>"
              </button>
            )}
            {responsaveisExistentes
              .filter((r) => !respInput || r.toLowerCase().includes(respInput.toLowerCase()))
              .map((r) => (
                <button key={r} onClick={() => setResponsavel(r)}
                  className={`w-full text-left text-[11px] px-3 py-1.5 hover:bg-hb-panelLight flex items-center justify-between ${
                    r === responsavel ? "text-hb-accent font-semibold" : "text-hb-text"
                  }`}>
                  <span className="truncate">{r}</span>
                  {r === responsavel && <Check size={10} />}
                </button>
              ))}
            {responsaveisExistentes.length === 0 && !respInput.trim() && (
              <div className="p-3 text-[10px] text-hb-textDim text-center">Digite um nome pra atribuir</div>
            )}
          </div>
        )}
      </div>

      {error && (
        <span className="text-[10px] text-hb-red">⚠ {error}</span>
      )}
    </div>
  );
}
