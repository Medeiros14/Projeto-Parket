/* ═══════════════════════════════════════════════════════════════
   PRESTADORES — DETALHE DA OBRA (estilo planilha)
   Layout fiel à planilha de origem:
     | DESCRIÇÃO | CONTRATO | PAGO M² | RETENÇÃO | REALIZADO | VALOR M² | VALOR TOTAL | M1 | M2 | ... |
   Linha SALDO no rodapé: total geral + soma por milestone (qtd × valor m²).
   Células editáveis inline; PAGO M² computado live (= sum milestones).
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, Plus, Building2, Trash2 } from "lucide-react";
import { supabasePublic as supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { fmtBRL } from "../../lib/format";
import { toast } from "../../lib/toast";

type Servico = {
  id: string; obra_id: string; descricao: string;
  contrato_qtd: number; pago_qtd: number; retencao_qtd: number; instalado_qtd: number;
  valor_unitario: number; unidade: string; extra_contratual: boolean; ordem: number;
};
type Pagamento = {
  id: string; servico_id: string; prestador_id: string | null; prestador_nome: string;
  periodo: string; qtd: number; valor: number; status: string;
};
type Obra = { id: string; cliente: string; localizacao: string | null; status: string; regiao: string };
type Prestador = { id: string; nome: string; categoria?: string | null };

type Milestone = { periodo: string; prestador_nome: string; key: string };

type CardPrestador = { id: string; nome: string; categoria?: string | null; telefone?: string | null };
type KanbanCardLite = { id: string; details: any };

export function PrestadoresObraPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const auth = useAuth();
  const canEdit = auth.appUser?.prestadoresPerm === "manage";
  const [obra, setObra] = useState<Obra | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [allPrestadores, setAllPrestadores] = useState<Prestador[]>([]);
  /** Cards do Kanban Operacional vinculados a essa obra — fonte de
   *  verdade dos prestadores POR SERVIÇO (pelo cronograma_pmo.itens[].prestadores_ids).
   *  Match por descrição entre serviços e itens do cronograma. */
  const [kanbanCards, setKanbanCards] = useState<KanbanCardLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (!obraId) return;
    setLoading(true);
    try {
      const [oRes, sRes, pRes, prRes, kRes] = await Promise.all([
        supabase.from("obras").select("*").eq("id", obraId).single(),
        supabase.from("prestadores_obra_servicos").select("*").eq("obra_id", obraId).order("ordem"),
        supabase.from("prestadores_pagamentos").select("*"),
        supabase.from("prestadores").select("id,nome,categoria").order("nome"),
        supabase.from("kanban_cards").select("id,details").eq("obra", obraId).in("dept_id", ["operacional", "obras"]),
      ]);
      if (oRes.error) throw oRes.error;
      if (sRes.error) throw sRes.error;
      if (pRes.error) throw pRes.error;
      if (prRes.error) throw prRes.error;
      if (kRes.error) throw kRes.error;
      setObra(oRes.data);
      setServicos(sRes.data || []);
      const ids = new Set((sRes.data || []).map((s: any) => s.id));
      setPagamentos((pRes.data || []).filter((p: any) => ids.has(p.servico_id)));
      setAllPrestadores(prRes.data || []);
      setKanbanCards((kRes.data || []) as any);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [obraId]);

  // ─── Milestones (colunas) ──────────────────────────────────
  const milestones: Milestone[] = useMemo(() => {
    const set = new Map<string, Milestone>();
    for (const p of pagamentos) {
      const key = `${p.periodo}|||${p.prestador_nome}`;
      if (!set.has(key)) set.set(key, { periodo: p.periodo, prestador_nome: p.prestador_nome, key });
    }
    return Array.from(set.values()).sort((a, b) =>
      a.periodo.localeCompare(b.periodo) || a.prestador_nome.localeCompare(b.prestador_nome)
    );
  }, [pagamentos]);

  // Pivot: pagamento por (servico_id, milestone_key)
  const grid = useMemo(() => {
    const m: Record<string, Record<string, Pagamento>> = {};
    for (const p of pagamentos) {
      const k = `${p.periodo}|||${p.prestador_nome}`;
      if (!m[p.servico_id]) m[p.servico_id] = {};
      m[p.servico_id][k] = p;
    }
    return m;
  }, [pagamentos]);

  // PAGO M² calculado (sum de milestones) por serviço
  const pagoCalculadoPorServico = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pagamentos) {
      m[p.servico_id] = (m[p.servico_id] || 0) + Number(p.qtd || 0);
    }
    return m;
  }, [pagamentos]);

  // SALDO por milestone (em VALOR R$): sum(qtd_celula × valor_unit_da_linha)
  const saldoMilestone = useMemo(() => {
    const m: Record<string, number> = {};
    const sById: Record<string, number> = {};
    for (const s of servicos) sById[s.id] = Number(s.valor_unitario || 0);
    for (const p of pagamentos) {
      const k = `${p.periodo}|||${p.prestador_nome}`;
      m[k] = (m[k] || 0) + Number(p.qtd || 0) * (sById[p.servico_id] || 0);
    }
    return m;
  }, [pagamentos, servicos]);

  // Totais gerais
  const totals = useMemo(() => {
    let contratado = 0, pagoVal = 0, retidoVal = 0;
    for (const s of servicos) {
      const ct = Number(s.contrato_qtd || 0);
      const vu = Number(s.valor_unitario || 0);
      const pago = pagoCalculadoPorServico[s.id] || 0;
      contratado += ct * vu;
      pagoVal += pago * vu;
      retidoVal += Number(s.retencao_qtd || 0) * vu;
    }
    return { contratado, pago: pagoVal, retido: retidoVal, saldo: contratado - pagoVal - retidoVal };
  }, [servicos, pagoCalculadoPorServico]);

  // ─── Prestadores do card kanban ──────────────────────────
  /** Lista de prestadores anexados ao(s) card(s) Operacional dessa obra.
   *  Vem de details.prestadores (não confundir com tabela prestadores). */
  const cardPrestadores: CardPrestador[] = useMemo(() => {
    const m = new Map<string, CardPrestador>();
    for (const c of kanbanCards) {
      const arr = (c.details?.prestadores || []) as CardPrestador[];
      for (const p of arr) if (p?.id) m.set(p.id, p);
    }
    return Array.from(m.values());
  }, [kanbanCards]);

  /** prestadores_ids POR SERVIÇO — match descricao com cronograma_pmo.itens.
   *  Retorna array de prestador objects pra cada servico. */
  const prestadoresPorServico = useMemo(() => {
    const out: Record<string, CardPrestador[]> = {};
    const presById = new Map<string, CardPrestador>();
    for (const p of cardPrestadores) presById.set(p.id, p);
    for (const s of servicos) {
      const descUp = s.descricao.toUpperCase().trim();
      const ids = new Set<string>();
      for (const c of kanbanCards) {
        const itens: any[] = c.details?.cronograma_pmo?.itens || [];
        const it = itens.find(x => String(x.servico ?? x.descricao ?? "").toUpperCase().trim() === descUp);
        if (it && Array.isArray(it.prestadores_ids)) it.prestadores_ids.forEach((id: string) => ids.add(id));
      }
      out[s.id] = Array.from(ids).map(id => presById.get(id)).filter(Boolean) as CardPrestador[];
    }
    return out;
  }, [servicos, kanbanCards, cardPrestadores]);

  /** Atualiza prestadores_ids de um serviço no(s) card(s) kanban. */
  async function setServicoPrestadores(servico: Servico, novoIds: string[]) {
    if (!canEdit) return;
    const descUp = servico.descricao.toUpperCase().trim();
    setBusy(true);
    try {
      // Garante que cada id está em details.prestadores também (caso ainda não estivesse)
      const idsArr = Array.from(new Set(novoIds));
      for (const card of kanbanCards) {
        const det = (card.details || {}) as any;
        const cardPrest = (det.prestadores || []) as CardPrestador[];
        const cardPrestIds = new Set(cardPrest.map(p => p.id));
        // Adiciona prestadores faltantes ao card (lookup em allPrestadores)
        const newCardPrest = [...cardPrest];
        for (const id of idsArr) {
          if (!cardPrestIds.has(id)) {
            const p = allPrestadores.find(x => x.id === id);
            if (p) newCardPrest.push({ id: p.id, nome: p.nome, categoria: p.categoria || "Mão de obra" });
          }
        }
        // Atualiza prestadores_ids do item no cronograma
        const crono = det.cronograma_pmo || {};
        const itens = (crono.itens || []) as any[];
        let touched = false;
        const newItens = itens.map((it: any) => {
          if (String(it.servico ?? it.descricao ?? "").toUpperCase().trim() !== descUp) return it;
          touched = true;
          return { ...it, prestadores_ids: idsArr };
        });
        if (!touched) {
          // Item não existe no cronograma — adiciona
          newItens.push({
            servico: servico.descricao,
            quantidade: Number(servico.contrato_qtd || 0),
            instalado: Number(servico.instalado_qtd || 0),
            unidade: servico.unidade || "m²",
            status: "pendente",
            pendente: Number(servico.contrato_qtd || 0),
            prestadores_ids: idsArr,
          });
        }
        await supabase.from("kanban_cards").update({
          details: { ...det, prestadores: newCardPrest, cronograma_pmo: { ...crono, itens: newItens } },
        }).eq("id", card.id);
      }
      // Reload kanbanCards pra refletir
      const { data: kData } = await supabase.from("kanban_cards")
        .select("id,details").eq("obra", servico.obra_id).in("dept_id", ["operacional", "obras"]);
      if (kData) setKanbanCards(kData as any);
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // ─── Mutações ──────────────────────────────────────────────
  /** Sincroniza serviço pro card kanban Operacional (details.cronograma_pmo.itens).
   *  Match por descrição (case-insensitive). Atualiza quantidade/instalado/unidade
   *  pra refletir nos cards de Acompanhamento de Obras. */
  async function syncToKanban(obra_id: string, descricao: string, patch: Partial<Servico>) {
    try {
      // Busca cards (operacional) que apontam pra essa obra
      const { data: cards } = await supabase
        .from("kanban_cards")
        .select("id,details")
        .eq("obra", obra_id)
        .in("dept_id", ["operacional", "obras"]);
      if (!cards || cards.length === 0) return;
      const descUp = descricao.toUpperCase().trim();
      for (const c of cards) {
        const det = (c.details ?? {}) as any;
        const crono = det.cronograma_pmo ?? {};
        const itens: any[] = Array.isArray(crono.itens) ? [...crono.itens] : [];
        let touched = false;
        const idx = itens.findIndex(it => String(it.servico ?? it.descricao ?? "").toUpperCase().trim() === descUp);
        const upd: any = {};
        if (patch.contrato_qtd !== undefined) upd.quantidade = patch.contrato_qtd;
        if (patch.instalado_qtd !== undefined) upd.instalado = patch.instalado_qtd;
        if (patch.unidade !== undefined) upd.unidade = patch.unidade;
        if (patch.descricao !== undefined) upd.servico = patch.descricao;
        if (Object.keys(upd).length === 0) return;
        if (idx >= 0) {
          itens[idx] = { ...itens[idx], ...upd };
          touched = true;
        } else if (patch.descricao !== undefined || patch.contrato_qtd !== undefined) {
          // Cria novo item no cronograma se não existe
          itens.push({
            servico: descricao,
            quantidade: patch.contrato_qtd ?? 0,
            instalado: patch.instalado_qtd ?? 0,
            unidade: patch.unidade ?? "m²",
            status: "pendente",
            pendente: patch.contrato_qtd ?? 0,
          });
          touched = true;
        }
        if (!touched) continue;
        await supabase.from("kanban_cards")
          .update({ details: { ...det, cronograma_pmo: { ...crono, itens } } })
          .eq("id", c.id);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[sync→kanban] falhou", e);
    }
  }

  async function updateServico(s: Servico, patch: Partial<Servico>) {
    if (!canEdit) return;
    setBusy(true);
    const { error } = await supabase.from("prestadores_obra_servicos").update(patch).eq("id", s.id);
    // Match no kanban PELA descricao ANTIGA (s.descricao), passando o patch
    // — se o patch tem descricao nova, sincroniza pro novo nome do servico.
    if (!error) await syncToKanban(s.obra_id, s.descricao, patch);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setServicos(prev => prev.map(x => x.id === s.id ? { ...x, ...patch } : x));
  }

  /** Renomeia uma coluna milestone (período e/ou prestador) — atualiza TODOS
   *  os pagamentos que pertencem a essa coluna.  */
  async function renameMilestone(m: Milestone, patch: { periodo?: string; prestador_nome?: string }) {
    if (!canEdit) return;
    const newPeriodo = (patch.periodo ?? m.periodo).toUpperCase().trim();
    const newPrestadorNome = (patch.prestador_nome ?? m.prestador_nome).toUpperCase().trim();
    if (newPeriodo === m.periodo && newPrestadorNome === m.prestador_nome) return;
    const prest = allPrestadores.find(p => p.nome.toUpperCase() === newPrestadorNome);
    setBusy(true);
    try {
      // Update todos os pagamentos da coluna
      const ids = pagamentos
        .filter(p => p.periodo === m.periodo && p.prestador_nome === m.prestador_nome)
        .map(p => p.id);
      if (ids.length > 0) {
        const upd: any = { periodo: newPeriodo, prestador_nome: newPrestadorNome };
        if (prest?.id) upd.prestador_id = prest.id;
        const { error } = await supabase.from("prestadores_pagamentos").update(upd).in("id", ids);
        if (error) throw error;
        setPagamentos(prev => prev.map(p =>
          ids.includes(p.id) ? { ...p, ...upd } : p
        ));
      }
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function setMilestonePagto(servico: Servico, m: Milestone, novoQtd: number) {
    if (!canEdit) return;
    const existente = grid[servico.id]?.[m.key];
    const valor = novoQtd * Number(servico.valor_unitario || 0);
    setBusy(true);
    if (existente) {
      if (novoQtd <= 0) {
        const { error } = await supabase.from("prestadores_pagamentos").delete().eq("id", existente.id);
        setBusy(false);
        if (error) { toast.error(error.message); return; }
        setPagamentos(prev => prev.filter(p => p.id !== existente.id));
      } else {
        const { error } = await supabase.from("prestadores_pagamentos").update({ qtd: novoQtd, valor }).eq("id", existente.id);
        setBusy(false);
        if (error) { toast.error(error.message); return; }
        setPagamentos(prev => prev.map(p => p.id === existente.id ? { ...p, qtd: novoQtd, valor } : p));
      }
    } else {
      if (novoQtd <= 0) { setBusy(false); return; }
      const prest = allPrestadores.find(p => p.nome.toUpperCase() === m.prestador_nome.toUpperCase());
      const { data, error } = await supabase.from("prestadores_pagamentos").insert({
        servico_id: servico.id, prestador_id: prest?.id ?? null,
        prestador_nome: m.prestador_nome, periodo: m.periodo,
        qtd: novoQtd, valor, status: "pendente",
      }).select().single();
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data) setPagamentos(prev => [...prev, data as any]);
    }
  }

  async function addServico() {
    if (!canEdit || !obraId) return;
    const desc = window.prompt("Descrição do serviço:"); if (!desc) return;
    const ordem = (servicos[servicos.length - 1]?.ordem || 0) + 1;
    const descUp = desc.toUpperCase();
    const { data, error } = await supabase.from("prestadores_obra_servicos").insert({
      obra_id: obraId, descricao: descUp, contrato_qtd: 0, valor_unitario: 0, unidade: "m²", ordem,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      setServicos(prev => [...prev, data as any]);
      // Sincroniza pro card kanban da obra
      await syncToKanban(obraId, descUp, { descricao: descUp, contrato_qtd: 0, instalado_qtd: 0, unidade: "m²" });
    }
  }

  async function delServico(s: Servico) {
    if (!canEdit) return;
    if (!confirm(`Remover serviço "${s.descricao}" e todos seus pagamentos?\n\nIsso também remove do card Operacional vinculado.`)) return;
    const { error } = await supabase.from("prestadores_obra_servicos").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    setServicos(prev => prev.filter(x => x.id !== s.id));
    setPagamentos(prev => prev.filter(p => p.servico_id !== s.id));
    // Remove do cronograma do kanban
    try {
      const { data: cards } = await supabase.from("kanban_cards")
        .select("id,details").eq("obra", s.obra_id).in("dept_id", ["operacional", "obras"]);
      const descUp = s.descricao.toUpperCase().trim();
      for (const c of (cards ?? [])) {
        const det = (c.details ?? {}) as any;
        const crono = det.cronograma_pmo ?? {};
        const itens: any[] = Array.isArray(crono.itens) ? crono.itens : [];
        const filtered = itens.filter(it => String(it.servico ?? it.descricao ?? "").toUpperCase().trim() !== descUp);
        if (filtered.length !== itens.length) {
          await supabase.from("kanban_cards")
            .update({ details: { ...det, cronograma_pmo: { ...crono, itens: filtered } } }).eq("id", c.id);
        }
      }
    } catch (e) { /* eslint-disable-next-line */ console.warn("[del→kanban]", e); }
  }

  // Calcula próximo período a partir do último milestone existente
  // "1ª JANEIRO 2026" → "2ª JANEIRO 2026"
  // "2ª JANEIRO 2026" → "1ª FEVEREIRO 2026"
  // "2ª DEZEMBRO 2026" → "1ª JANEIRO 2027"
  function calcProximoPeriodo(): string {
    const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
                   "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
    const MESES_ALT = ["MARCO","FEV","JAN","SET","OUT","NOV","DEZ"]; // pra match abreviado
    if (milestones.length === 0) {
      const now = new Date();
      return `1ª ${MESES[now.getMonth()]} ${now.getFullYear()}`;
    }
    // Pega o ÚLTIMO período (já vem ordenado)
    const last = milestones[milestones.length - 1].periodo;
    // Parse "Nª MÊS YYYY?"
    const m = last.match(/^([12345])ª\s+(\S+)(?:\s+(\d{4}))?/i);
    if (!m) return `1ª ${MESES[new Date().getMonth()]} ${new Date().getFullYear()}`;
    let quinzena = parseInt(m[1]);
    let mesNome = m[2].toUpperCase();
    let ano = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    // Normaliza nome do mês (abreviado → completo)
    let mesIdx = MESES.findIndex(x => x === mesNome);
    if (mesIdx < 0) {
      // Tenta começar com — match abreviações tipo FEV → FEVEREIRO
      mesIdx = MESES.findIndex(x => x.startsWith(mesNome.slice(0, 3)));
    }
    if (mesIdx < 0) mesIdx = new Date().getMonth();
    if (quinzena === 1) {
      quinzena = 2;
    } else {
      quinzena = 1;
      mesIdx++;
      if (mesIdx > 11) { mesIdx = 0; ano++; }
    }
    return `${quinzena}ª ${MESES[mesIdx]} ${ano}`;
  }

  // Lista única de prestadores que JÁ aparecem nesta obra (pra dropdown)
  const prestadoresNaObra = useMemo(() => {
    const set = new Set<string>();
    for (const p of pagamentos) set.add(p.prestador_nome);
    return Array.from(set).sort();
  }, [pagamentos]);

  async function addMilestoneCol(opts?: { suggestedPeriod?: string }) {
    if (!canEdit) return;
    const sugest = opts?.suggestedPeriod ?? calcProximoPeriodo();
    const periodo = window.prompt(`Período do próximo mês:`, sugest);
    if (!periodo) return;
    // Sugestão de prestador: lista dos que já estão na obra
    const sugestPrest = prestadoresNaObra.length > 0
      ? `Prestador (já na obra: ${prestadoresNaObra.join(", ")}):`
      : "Prestador:";
    const prestador = window.prompt(sugestPrest, prestadoresNaObra[0] || "");
    if (!prestador) return;
    if (servicos.length === 0) { toast.error("Adicione um serviço primeiro"); return; }
    const s = servicos[0];
    const prest = allPrestadores.find(p => p.nome.toUpperCase() === prestador.toUpperCase());
    const { data, error } = await supabase.from("prestadores_pagamentos").insert({
      servico_id: s.id, prestador_id: prest?.id ?? null,
      prestador_nome: prestador.toUpperCase(), periodo: periodo.toUpperCase(),
      qtd: 0, valor: 0, status: "pendente",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) setPagamentos(prev => [...prev, data as any]);
  }

  if (!obraId) return <div className="p-6 text-parket-textDim">Obra não especificada.</div>;
  if (loading) return <div className="p-6 flex items-center gap-2 text-parket-textDim text-[12px]"><Loader2 size={14} className="animate-spin"/> Carregando…</div>;
  if (error) return <div className="p-6 text-red-400 text-[12px]">{error}</div>;
  if (!obra) return <div className="p-6 text-parket-textDim">Obra não encontrada.</div>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <Link to="/prestadores" className="inline-flex items-center gap-1 text-[10px] text-parket-textDim hover:text-parket-accent mb-2">
            <ArrowLeft size={11} /> Todas as obras
          </Link>
          <div className="flex items-center gap-2.5 mb-1">
            <Building2 size={18} className="text-parket-accent"/>
            <h1 className="text-base font-bold">{obra.cliente}</h1>
          </div>
          <p className="text-[11px] text-parket-textDim">{obra.localizacao || "—"} · {obra.regiao} · <span className="text-parket-accent">{obraId}</span></p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={addServico} className="flex items-center gap-1 px-3 py-1.5 bg-parket-accent/15 border border-parket-accent/30 hover:bg-parket-accent/25 text-parket-accent rounded text-[11px] font-semibold">
              <Plus size={11}/> Serviço
            </button>
            <button onClick={() => addMilestoneCol()} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 text-blue-400 rounded text-[11px] font-semibold">
              <Plus size={11}/> Milestone
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Kpi label="Contratado" value={fmtBRL(totals.contratado)}/>
        <Kpi label="Pago" value={fmtBRL(totals.pago)} accent="green"/>
        <Kpi label="Retido" value={fmtBRL(totals.retido)} accent="orange"/>
        <Kpi label="Saldo" value={fmtBRL(totals.saldo)} accent="blue"/>
      </div>

      {/* Tabela tipo planilha — min-w-full pra:
          • encher a largura quando há poucos milestones (não fica encolhida)
          • estender ALÉM da viewport quando muitos milestones (main scrolla horizontal).
          O container externo segue a largura do conteúdo (min-w-fit). */}
      <div className="bg-parket-panel border border-parket-border rounded inline-block min-w-full align-top">
        <div className="px-4 py-2 border-b border-parket-border flex items-center justify-between sticky left-0">
          <h2 className="text-[12px] font-bold uppercase tracking-wider">Descrição do Serviço</h2>
          <div className="text-[10px] text-parket-textDim">{servicos.length} serviços · {milestones.length} milestones · {pagamentos.length} pagamentos {busy && <Loader2 size={10} className="inline animate-spin ml-1"/>}</div>
        </div>
        <div>
          <table className="min-w-full text-[11px] border-collapse">
            <thead className="bg-parket-panelLight border-b border-parket-border">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-parket-panelLight border-r border-parket-border z-10 min-w-[280px] text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">DESCRIÇÃO DO SERVIÇO</th>
                <Hd>CONTRATO</Hd>
                <Hd subtle title="Soma dos milestones (fórmula)">PAGO M²</Hd>
                <Hd subtle title="REALIZADO − PAGO M² (fórmula)">RETENÇÃO</Hd>
                <Hd>REALIZADO</Hd>
                {/* Separador visual */}
                <th className="w-3 bg-parket-bg/40 border-l-2 border-r-2 border-parket-border/60"></th>
                <Hd>VALOR M²</Hd>
                <Hd subtle title="VALOR M² × CONTRATO (fórmula)">VALOR TOTAL</Hd>
                {/* 2 separadores antes dos milestones */}
                <th className="w-3 bg-parket-bg/40 border-l-2 border-parket-border/60"></th>
                <th className="w-3 bg-parket-bg/40 border-r-2 border-parket-border/60"></th>
                {milestones.map(m => (
                  <th key={m.key} className="text-center px-2 py-2 border-l border-parket-border min-w-[120px]">
                    {/* Período editável (mês + quinzena) */}
                    <div className="text-[10px] font-bold text-parket-accent leading-tight mb-0.5">
                      <EditableText
                        value={m.periodo}
                        disabled={!canEdit}
                        onSave={v => renameMilestone(m, { periodo: v })}
                      />
                    </div>
                    {/* Prestador editável (select) */}
                    {canEdit ? (
                      <select
                        value={m.prestador_nome}
                        onChange={e => renameMilestone(m, { prestador_nome: e.target.value })}
                        className="w-full text-[9px] font-normal text-parket-textDim bg-transparent border border-parket-border/40 rounded px-1 py-0.5 outline-none cursor-pointer hover:bg-parket-panelLight/50"
                        title="Trocar prestador desta coluna"
                      >
                        <option value={m.prestador_nome} style={{ background: "#111" }}>{m.prestador_nome}</option>
                        {allPrestadores.filter(p => p.nome.toUpperCase() !== m.prestador_nome.toUpperCase()).map(p => (
                          <option key={p.id} value={p.nome.toUpperCase()} style={{ background: "#111" }}>
                            {p.nome}{p.categoria ? ` · ${p.categoria}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[9px] text-parket-textDim font-normal mt-0.5">{m.prestador_nome}</div>
                    )}
                  </th>
                ))}
                {/* Botão sempre presente: adiciona próximo mês */}
                {canEdit && (
                  <th className="text-center px-2 py-1 border-l-2 border-parket-accent/30 min-w-[120px] bg-parket-accent/5">
                    <button
                      onClick={() => addMilestoneCol()}
                      className="w-full h-full flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded hover:bg-parket-accent/15 text-parket-accent transition"
                      title={`Adicionar próximo mês (${calcProximoPeriodo()})`}
                    >
                      <Plus size={12}/>
                      <span className="text-[8px] font-bold uppercase tracking-wider leading-tight">Próximo mês</span>
                      <span className="text-[7px] text-parket-accent/60 leading-tight">{calcProximoPeriodo()}</span>
                    </button>
                  </th>
                )}
                {canEdit && <th className="sticky right-0 bg-parket-panelLight border-l-2 border-parket-border z-10 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {servicos.length === 0 && (
                <tr><td colSpan={milestones.length + (canEdit ? 11 : 10)} className="px-3 py-6 text-center text-parket-textDim text-[11px]">Sem serviços. Clique "+ Serviço" pra começar.</td></tr>
              )}
              {servicos.map(s => {
                const ct = Number(s.contrato_qtd || 0);
                const vu = Number(s.valor_unitario || 0);
                const pago = pagoCalculadoPorServico[s.id] || 0;
                const realizado = Number(s.instalado_qtd || 0);
                // RETENÇÃO: usa valor manual se foi setado, senão computa REALIZADO − PAGO
                const retencaoCalc = realizado - pago;
                const retencaoStored = Number(s.retencao_qtd || 0);
                // Heurística: se retencao_qtd === 0 E há diferença realizado-pago, usa fórmula
                const retencao = retencaoStored !== 0 ? retencaoStored : retencaoCalc;
                const valorTotal = ct * vu;
                return (
                  <tr key={s.id} className="border-b border-parket-border/40 hover:bg-parket-panelLight/30">
                    <td className="px-3 py-1 sticky left-0 bg-parket-panel border-r border-parket-border z-10">
                      <EditableText value={s.descricao} disabled={!canEdit}
                        onSave={v => updateServico(s, { descricao: v.toUpperCase() })} />
                    </td>
                    <td className="px-1.5 py-0.5">
                      <EditableNumber value={ct} disabled={!canEdit} onSave={v => updateServico(s, { contrato_qtd: v })} />
                    </td>
                    <td className="px-1.5 py-0.5 text-right text-green-400 font-semibold" title="Σ dos milestones (fórmula)">
                      {pago.toFixed(2)}
                    </td>
                    <td className="px-1.5 py-0.5" title="REALIZADO − PAGO M² (fórmula, editável)">
                      <EditableNumber value={retencao} disabled={!canEdit}
                        onSave={v => updateServico(s, { retencao_qtd: v })} accent="orange" />
                    </td>
                    <td className="px-1.5 py-0.5">
                      <EditableNumber value={realizado} disabled={!canEdit}
                        onSave={v => updateServico(s, { instalado_qtd: v })} />
                    </td>
                    {/* Separador */}
                    <td className="bg-parket-bg/40 border-l-2 border-r-2 border-parket-border/60"></td>
                    <td className="px-1.5 py-0.5">
                      <EditableNumber value={vu} disabled={!canEdit}
                        onSave={v => updateServico(s, { valor_unitario: v })} prefix="R$" />
                    </td>
                    <td className="px-1.5 py-0.5 text-right font-semibold text-parket-text" title="VALOR M² × CONTRATO (fórmula)">
                      {fmtBRL(valorTotal)}
                    </td>
                    {/* 2 separadores antes dos milestones */}
                    <td className="bg-parket-bg/40 border-l-2 border-parket-border/60"></td>
                    <td className="bg-parket-bg/40 border-r-2 border-parket-border/60"></td>
                    {milestones.map(m => {
                      const p = grid[s.id]?.[m.key];
                      return (
                        <td key={m.key} className="px-1 py-0.5 text-right border-l border-parket-border/40">
                          <EditableNumber
                            value={p ? Number(p.qtd || 0) : 0}
                            disabled={!canEdit}
                            onSave={v => setMilestonePagto(s, m, v)}
                            placeholder="—"
                            small
                          />
                          {p && Number(p.qtd) > 0 && (
                            <div className="text-[8px] text-parket-textDim leading-tight">{fmtBRL(Number(p.qtd) * vu)}</div>
                          )}
                        </td>
                      );
                    })}
                    {/* Coluna "Próximo mês" — vazia nas linhas dos serviços */}
                    {canEdit && <td className="bg-parket-accent/5 border-l-2 border-parket-accent/20 min-w-[120px]"></td>}
                    {canEdit && (
                      <td className="text-center sticky right-0 bg-parket-panel border-l-2 border-parket-border z-10 w-10">
                        <button onClick={() => delServico(s)} className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded p-1" title="Remover serviço">
                          <Trash2 size={11}/>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {servicos.length > 0 && (
              <tfoot className="bg-parket-panelLight/60 border-t-2 border-parket-border">
                <tr>
                  <td className="px-3 py-2 sticky left-0 bg-parket-panelLight border-r border-parket-border z-10"></td>
                  {/* CONTRATO, PAGO, RETENÇÃO, REALIZADO vazios */}
                  <td colSpan={4}></td>
                  {/* Separador */}
                  <td className="bg-parket-bg/40 border-l-2 border-r-2 border-parket-border/60"></td>
                  {/* SALDO label na coluna VALOR M² */}
                  <td className="px-2 py-2 text-right font-bold text-[10px] uppercase tracking-wider text-parket-accent">SALDO</td>
                  {/* Total contratado na coluna VALOR TOTAL */}
                  <td className="text-right px-1.5 py-2 font-bold text-blue-400 text-[12px]" title="Σ VALOR TOTAL (fórmula)">
                    {fmtBRL(totals.contratado)}
                  </td>
                  {/* 2 separadores */}
                  <td className="bg-parket-bg/40 border-l-2 border-parket-border/60"></td>
                  <td className="bg-parket-bg/40 border-r-2 border-parket-border/60"></td>
                  {milestones.map(m => (
                    <td key={m.key} className="text-right px-2 py-2 border-l border-parket-border/40 font-bold text-[10px] text-blue-400" title="Σ (qtd × valor m²) da coluna">
                      {fmtBRL(saldoMilestone[m.key] || 0)}
                    </td>
                  ))}
                  {/* Coluna "Próximo mês" — vazia no rodapé */}
                  {canEdit && <td className="bg-parket-accent/5 border-l-2 border-parket-accent/20 min-w-[120px]"></td>}
                  {canEdit && <td className="sticky right-0 bg-parket-panelLight border-l-2 border-parket-border z-10 w-10"></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[9px] text-parket-textDim">
        <span><span className="text-green-400 font-semibold">Pago m²</span> = soma das células de milestone (fórmula)</span>
        <span><span className="text-parket-text font-semibold">Valor Total</span> = Contrato × Valor m² (fórmula)</span>
        <span><span className="text-blue-400 font-semibold">SALDO milestone</span> = Σ (qtd × valor m²) por coluna</span>
        {canEdit && <span className="ml-auto text-parket-accent">✎ Click em qualquer célula pra editar</span>}
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────

function PrestadoresInline({ servico, prestadores, allPrestadores, canEdit, onChange }:
  { servico: Servico; prestadores: CardPrestador[]; allPrestadores: Prestador[]; canEdit: boolean; onChange: (ids: string[]) => void }) {
  void servico;
  const allocatedIds = new Set(prestadores.map(p => p.id));
  const available = allPrestadores.filter(p => !allocatedIds.has(p.id));
  const remove = (id: string) => onChange(prestadores.map(p => p.id).filter(x => x !== id));

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      <span className="text-[9px] text-parket-textDim font-semibold mr-0.5" title="Prestadores vinculados">👷</span>
      {prestadores.length === 0 && (
        <span className="text-[9px] text-parket-textDim/60 italic">{canEdit ? "sem prestadores" : "—"}</span>
      )}
      {prestadores.map(p => (
        <span key={p.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
          style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)" }}>
          {p.nome}
          {p.categoria && <span className="text-[8px] opacity-60 font-normal">· {p.categoria}</span>}
          {canEdit && (
            <button onClick={() => remove(p.id)} className="text-red-300 hover:text-red-100 -mr-0.5" title="Remover">×</button>
          )}
        </span>
      ))}
      {/* Dropdown nativo: o browser trata clipping, z-index, posicionamento */}
      {canEdit && available.length > 0 && (
        <select
          value=""
          onChange={e => {
            const v = e.target.value;
            if (v) onChange([...prestadores.map(p => p.id), v]);
            e.target.value = "";
          }}
          className="px-1.5 py-0.5 rounded text-[9px] font-semibold cursor-pointer outline-none"
          style={{
            background: "rgba(212,168,83,0.12)",
            color: "#D4A853",
            border: "1px solid rgba(212,168,83,0.4)",
            minWidth: 100,
          }}
        >
          <option value="" style={{ background: "#111", color: "#D4A853" }}>+ adicionar prestador</option>
          {available.map(p => (
            <option key={p.id} value={p.id} style={{ background: "#111", color: "#fff" }}>
              {p.nome}{p.categoria ? ` · ${p.categoria}` : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function Hd({ children, subtle, title }: { children: React.ReactNode; subtle?: boolean; title?: string }) {
  return (
    <th
      title={title}
      className={`text-right px-2 py-2 text-[10px] font-semibold uppercase tracking-wider ${subtle ? "text-parket-accent/70" : "text-parket-textDim"}`}
    >
      {children}
      {subtle && <span className="text-parket-accent/60 ml-0.5" title="Coluna calculada (fórmula)">ƒ</span>}
    </th>
  );
}

function EditableText({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (disabled) return <span className="text-parket-text">{value}</span>;
  if (!editing) {
    return (
      <span onClick={() => setEditing(true)} className="cursor-pointer hover:bg-parket-accent/10 rounded px-1 -mx-1 inline-block min-w-full" title="Click pra editar">
        {value || <span className="text-parket-textDim italic">vazio</span>}
      </span>
    );
  }
  return (
    <input
      autoFocus value={v} onChange={e => setV(e.target.value)}
      onBlur={() => { setEditing(false); if (v !== value) onSave(v); }}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(value); setEditing(false); } }}
      className="w-full px-1.5 py-0.5 bg-parket-panelLight border border-parket-accent/50 rounded text-[11px] text-parket-text outline-none"
    />
  );
}

function EditableNumber({ value, onSave, disabled, prefix, accent, small, placeholder }: {
  value: number; onSave: (v: number) => void; disabled?: boolean;
  prefix?: string; accent?: "orange"; small?: boolean; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value || ""));
  useEffect(() => setV(value ? String(value) : ""), [value]);
  const display = value === 0 ? (placeholder || "0") : (prefix ? `${prefix} ${value.toFixed(2)}` : value.toFixed(2));
  const colorClass = accent === "orange" ? "text-orange-400" : "text-parket-text";
  const sizeClass = small ? "text-[10px]" : "text-[11px]";
  if (disabled) return <span className={`${colorClass} ${sizeClass}`}>{display}</span>;
  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`block w-full text-right hover:bg-parket-accent/10 rounded px-1 -mx-0.5 ${colorClass} ${sizeClass} ${value === 0 ? "text-parket-textDim/40" : ""}`}
        title="Click pra editar"
      >
        {display}
      </button>
    );
  }
  return (
    <input
      type="text" autoFocus value={v} onChange={e => setV(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const n = Number(String(v).replace(",", "."));
        if (!isNaN(n) && n !== value) onSave(n);
      }}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(String(value || "")); setEditing(false); } }}
      className={`w-full px-1 py-0.5 bg-parket-panelLight border border-parket-accent/50 rounded ${sizeClass} text-parket-text outline-none text-right`}
    />
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "green" | "orange" | "blue" }) {
  const c = accent === "green" ? "text-green-400" : accent === "orange" ? "text-orange-400" : accent === "blue" ? "text-blue-400" : "text-parket-text";
  return (
    <div className="bg-parket-panel border border-parket-border rounded p-3">
      <div className="text-[9px] text-parket-textDim uppercase tracking-wider font-bold">{label}</div>
      <div className={`text-[15px] font-bold mt-1 ${c}`}>{value}</div>
    </div>
  );
}
