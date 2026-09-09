/**
 * Aprovações v2 (task Will 12/08) — hub único de decisão financeira.
 *
 * Espelho + write-back: lê ao vivo das plataformas origem (ERP, Prestadores)
 * via crossSchemaFetch. Aprovar chama RPC do Core que faz PATCH na origem +
 * cria core.lancamentos como side-effect. Rejeitar devolve pra origem com
 * motivo. Nenhum dado duplicado. Só admin (Will/Douglas/Karla).
 */
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, ArrowDownToLine, HardHat, ShoppingCart, Loader2, ExternalLink, AlertCircle, Truck, Plane, UserCog, Receipt, Plus, MessageSquare, Calendar, Paperclip, Wallet, ChevronDown, FileText, Undo2 } from "lucide-react";
import { api, useFetch, type CustoLancResumo, type CustoDetalhe } from "../../../lib/api";
import { fmtBRL, fmtDate } from "../../../lib/format";
import { Modal } from "../../ui/Modal";
import { Field, Textarea, Button, Input, Select } from "../../ui/Form";
import { toast } from "../../../lib/toast";

type Tab = "receber" | "prestadores" | "compras" | "custos" | "fretes" | "viagens" | "rh" | "reembolsos";
// "compras-item" e "custos-despesa" só circulam no ModalRejeitar (não são tabs
// próprias — vivem dentro de Compras e de Terceiros respectivamente).
type RejeitarTipo = Tab | "compras-item" | "custos-despesa";
const TABS: { key: Tab; label: string; icon: any; origem: string }[] = [
  { key: "receber",     label: "Contas a receber", icon: ArrowDownToLine, origem: "compras.parket.works" },
  { key: "prestadores", label: "Prestadores",      icon: HardHat,         origem: "dashboard.parket.works" },
  { key: "compras",     label: "Compras",          icon: ShoppingCart,    origem: "compras.parket.works" },
  { key: "custos",      label: "Terceiros",        icon: Wallet,          origem: "gestao.parket.works/custos" },
  { key: "fretes",      label: "Fretes",           icon: Truck,           origem: "expedicao.parket.works" },
  { key: "viagens",     label: "Viagens",          icon: Plane,           origem: "core (viagens)" },
  { key: "rh",          label: "RH adiantamentos", icon: UserCog,         origem: "rh.parket.works" },
  { key: "reembolsos",  label: "Reembolsos",       icon: Receipt,         origem: "core (originado aqui)" },
];

export function AprovacoesPage() {
  const [tab, setTab] = useState<Tab>("receber");
  const [rejeitando, setRejeitando] = useState<{ tipo: RejeitarTipo; id: string; label: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<Tab, number>>({
    receber: 0, prestadores: 0, compras: 0, custos: 0, fretes: 0, viagens: 0, rh: 0, reembolsos: 0,
  });

  // Recarrega contadores por aba junto com o badge da sidebar (mesma cadência).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await api.aprovacoesPendingCounts();
        if (alive) setCounts({
          receber: r.receber, prestadores: r.prestadores, compras: r.compras,
          custos: r.custos, fretes: r.fretes, viagens: r.viagens, rh: r.rh, reembolsos: r.reembolsos,
        });
      } catch { /* ignora — contadores são enfeite */ }
    };
    load();
    const iv = setInterval(load, 60_000);
    const onReload = () => load();
    window.addEventListener("aprovacoes:reload", onReload);
    return () => { alive = false; clearInterval(iv); window.removeEventListener("aprovacoes:reload", onReload); };
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><CheckCircle2 size={18} className="text-parket-accent" /> Aprovações</h1>
        <p className="text-xs text-parket-textDim mt-1">
          Espera OK do financeiro pra virar pagamento/recebimento — vem das plataformas de origem
        </p>
      </div>

      <div className="flex gap-1 bg-parket-panel border border-parket-border rounded-lg p-1 w-fit flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          const n = counts[t.key];
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] uppercase tracking-wider font-bold transition ${
                tab === t.key ? "bg-parket-accent text-parket-bg" : "text-parket-textDim hover:text-parket-text"
              }`}>
              <Icon size={12} /> {t.label}
              {n > 0 && (
                <span className={`ml-0.5 text-[10px] font-bold tabular-nums px-1.5 py-[1px] rounded-full ${
                  tab === t.key ? "bg-parket-bg/25 text-parket-bg" : "bg-parket-accent/20 text-parket-accent"
                }`}>{n > 99 ? "99+" : n}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "receber" && <TabReceber setRejeitando={setRejeitando} processando={processando} setProcessando={setProcessando} />}
      {tab === "prestadores" && <TabPrestadores setRejeitando={setRejeitando} processando={processando} setProcessando={setProcessando} />}
      {tab === "compras" && <TabCompras setRejeitando={setRejeitando} processando={processando} setProcessando={setProcessando} />}
      {tab === "custos" && <TabCustos setRejeitando={setRejeitando} processando={processando} setProcessando={setProcessando} />}
      {tab === "fretes" && <TabFretes setRejeitando={setRejeitando} processando={processando} setProcessando={setProcessando} />}
      {tab === "viagens" && <TabViagens setRejeitando={setRejeitando} processando={processando} setProcessando={setProcessando} />}
      {tab === "rh" && <TabRh setRejeitando={setRejeitando} processando={processando} setProcessando={setProcessando} />}
      {tab === "reembolsos" && <TabReembolsos setRejeitando={setRejeitando} processando={processando} setProcessando={setProcessando} />}

      <ModalRejeitar
        open={!!rejeitando}
        onClose={() => { setRejeitando(null); setMotivo(""); }}
        item={rejeitando}
        motivo={motivo}
        setMotivo={setMotivo}
      />
    </div>
  );
}

// ─── Modal de rejeição (comum aos 3 tipos) ───────────────────────────
function ModalRejeitar({ open, onClose, item, motivo, setMotivo }:
  { open: boolean; onClose: () => void;
    item: { tipo: RejeitarTipo; id: string; label: string } | null;
    motivo: string; setMotivo: (m: string) => void }) {
  const [saving, setSaving] = useState(false);
  if (!item) return null;

  const rejeitar = async () => {
    const m = motivo.trim();
    if (m.length < 4) { toast.error("Motivo obrigatório (mín 4 chars)"); return; }
    setSaving(true);
    try {
      if (item.tipo === "receber")      await api.rejeitarContaReceber(item.id, m);
      if (item.tipo === "prestadores")  await api.rejeitarPrestadorPagamento(item.id, m);
      if (item.tipo === "compras")      await api.rejeitarPedidoCompra(item.id, m);
      if (item.tipo === "compras-item") await api.reprovarItemCompra(item.id, m);
      // Custos de Terceiros: "rejeitar" = devolver o lançamento pro secretário
      // corrigir; a glosa é por despesa (item.id aqui é o id da despesa).
      if (item.tipo === "custos")         await api.custosStatus(item.id, "devolvido", m);
      if (item.tipo === "custos-despesa") await api.custosDecisao(item.id, "glosado", m);
      if (item.tipo === "fretes")       await api.rejeitarFrete(item.id, m);
      if (item.tipo === "viagens")      await api.rejeitarViagem(item.id, m);
      if (item.tipo === "rh")           await api.rejeitarAdiantamentoRh(item.id, m);
      if (item.tipo === "reembolsos")   await api.rejeitarReembolso(item.id, m);
      toast.success("Rejeitado — devolvido pra plataforma origem com motivo");
      onClose();
      // reload da aba: recarga fica com useFetch key... simplifica dispatchando evento
      window.dispatchEvent(new Event("aprovacoes:reload"));
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Rejeitar solicitação" size="sm"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={rejeitar} loading={saving} disabled={motivo.trim().length < 4}>
          <XCircle size={12} /> Rejeitar e devolver
        </Button>
      </>}>
      <div className="space-y-3">
        <div className="bg-red-950/30 border border-red-900/50 rounded p-2.5 text-[11px] text-red-300 flex gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div>Rejeição devolve pra plataforma origem com o motivo. O solicitante vai poder ajustar e reenviar.</div>
        </div>
        <div className="text-xs bg-parket-panelLight/40 border border-parket-border rounded p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim">Solicitação</div>
          <div className="font-semibold mt-0.5">{item.label}</div>
        </div>
        <Field label="Motivo da rejeição" required
          hint="Ex.: valor divergente, fornecedor não homologado, faltou nota fiscal…">
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o motivo" />
        </Field>
      </div>
    </Modal>
  );
}

// ─── ABA 1: Contas a receber (erp.contas_receber) ────────────────────
function TabReceber({ setRejeitando, processando, setProcessando }:
  { setRejeitando: any; processando: string | null; setProcessando: (v: string | null) => void }) {
  const [reload, setReload] = useState(0);
  const cr = useFetch(() => api.contasReceberPendentes(), [reload]);
  const pa = useFetch(() => api.parceiros(), []);

  useMemo(() => {
    const on = () => setReload((x) => x + 1);
    window.addEventListener("aprovacoes:reload", on);
    return () => window.removeEventListener("aprovacoes:reload", on);
  }, []);

  const paById = new Map((pa.data || []).map((p) => [p.id, p]));
  const rows = cr.data || [];
  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);

  const aprovar = async (id: string, label: string) => {
    setProcessando(id);
    try {
      await api.aprovarContaReceber({ id });
      toast.success(`${label} aprovado — motor de RT/comissão recalculou`);
      setReload((x) => x + 1);
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally { setProcessando(null); }
  };

  return (
    <>
      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {rows.length} conta(s) aguardando · <b className="text-parket-accent">{fmtBRL(total)}</b>
        <a href="https://compras.parket.works" target="_blank" rel="noreferrer"
          className="ml-auto text-parket-accent hover:underline inline-flex items-center gap-1">
          Abrir ERP <ExternalLink size={10} />
        </a>
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {cr.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!cr.loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhuma conta a receber aguardando aprovação. ✓</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((r) => {
            const cli = r.cliente_id ? paById.get(r.cliente_id) : null;
            return (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-[10px] tabular-nums text-parket-textDim w-20">{fmtDate(r.data_vencimento)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{cli?.nome || r.descricao || r.numero}</div>
                  <div className="text-[10px] text-parket-textDim truncate">
                    {r.numero}{r.ref_tipo && ` · ${r.ref_tipo}`}
                  </div>
                </div>
                <div className="text-xs font-semibold tabular-nums">{fmtBRL(r.valor)}</div>
                <button onClick={() => aprovar(r.id, cli?.nome || r.numero)}
                  disabled={processando === r.id}
                  className="p-1.5 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400 disabled:opacity-30" title="Aprovar recebimento (cria entrada no Core + libera RT/comissão)">
                  {processando === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                </button>
                <button onClick={() => setRejeitando({ tipo: "receber", id: r.id, label: `${cli?.nome || r.numero} · ${fmtBRL(r.valor)}` })}
                  className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Rejeitar">
                  <XCircle size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

// ─── ABA 2: Prestadores (public.prestadores_pagamentos) ─────────────
function TabPrestadores({ setRejeitando, processando, setProcessando }:
  { setRejeitando: any; processando: string | null; setProcessando: (v: string | null) => void }) {
  const [reload, setReload] = useState(0);
  const pp = useFetch(() => api.prestadoresPagamentosPendentes(), [reload]);
  const os = useFetch(() => api.prestadoresObraServicos(), []);
  useMemo(() => {
    const on = () => setReload((x) => x + 1);
    window.addEventListener("aprovacoes:reload", on);
    return () => window.removeEventListener("aprovacoes:reload", on);
  }, []);

  const osById = new Map((os.data || []).map((s) => [s.id, s]));
  const rows = pp.data || [];
  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);

  const aprovar = async (id: string, label: string) => {
    setProcessando(id);
    try {
      await api.aprovarPrestadorPagamento(id);
      toast.success(`${label} pago — repasse virou saída no Core`);
      setReload((x) => x + 1);
    } catch (e: any) { toast.error(e?.message || "Erro"); } finally { setProcessando(null); }
  };

  return (
    <>
      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {rows.length} repasse(s) aguardando · <b className="text-parket-accent">{fmtBRL(total)}</b>
        <a href="https://dashboard.parket.works" target="_blank" rel="noreferrer"
          className="ml-auto text-parket-accent hover:underline inline-flex items-center gap-1">
          Abrir Dashboard <ExternalLink size={10} />
        </a>
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {pp.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!pp.loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhum repasse pendente. ✓</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((r) => {
            const serv = osById.get(r.servico_id);
            return (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-[10px] text-parket-textDim w-20 truncate">{r.periodo}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{r.prestador_nome}</div>
                  <div className="text-[10px] text-parket-textDim truncate">
                    {serv && `Obra ${serv.obra_id} · ${serv.descricao}`}
                    {r.qtd ? ` · ${r.qtd}` : ""}
                  </div>
                </div>
                <div className="text-xs font-semibold tabular-nums">{fmtBRL(r.valor)}</div>
                <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase w-20 text-center bg-amber-500/15 text-amber-300">
                  {r.status}
                </span>
                <button onClick={() => aprovar(r.id, r.prestador_nome)}
                  disabled={processando === r.id}
                  className="p-1.5 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400 disabled:opacity-30" title="Aprovar repasse (marca pago + cria saída no Core)">
                  {processando === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                </button>
                <button onClick={() => setRejeitando({ tipo: "prestadores", id: r.id, label: `${r.prestador_nome} · ${fmtBRL(r.valor)}` })}
                  className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Rejeitar">
                  <XCircle size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

// ─── ABA 4: Fretes (core.fretes_solicitacoes) ───────────────────────
function TabFretes({ setRejeitando, processando, setProcessando }:
  { setRejeitando: any; processando: string | null; setProcessando: (v: string | null) => void }) {
  const [reload, setReload] = useState(0);
  const fr = useFetch(() => api.fretesPendentes(), [reload]);
  useMemo(() => {
    const on = () => setReload((x) => x + 1);
    window.addEventListener("aprovacoes:reload", on);
    return () => window.removeEventListener("aprovacoes:reload", on);
  }, []);

  const rows = fr.data || [];
  const total = rows.reduce((s: number, r: any) => s + Number(r.valor_orcado || 0), 0);

  const aprovar = async (id: string, label: string) => {
    setProcessando(id);
    try {
      await api.aprovarFrete(id);
      toast.success(`${label} aprovado — frete virou saída no Core`);
      setReload((x) => x + 1);
    } catch (e: any) { toast.error(e?.message || "Erro"); } finally { setProcessando(null); }
  };

  return (
    <>
      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {rows.length} frete(s) aguardando · <b className="text-parket-accent">{fmtBRL(total)}</b>
        <a href="https://expedicao.parket.works" target="_blank" rel="noreferrer"
          className="ml-auto text-parket-accent hover:underline inline-flex items-center gap-1">
          Abrir Expedição <ExternalLink size={10} />
        </a>
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {fr.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!fr.loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhum frete aguardando. ✓</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((r: any) => (
            <li key={r.id} className="px-5 py-3 flex items-center gap-3">
              <div className="text-[10px] tabular-nums text-parket-textDim w-20">{r.data_necessaria ? fmtDate(r.data_necessaria) : "—"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{r.transportadora || r.solicitante}</div>
                <div className="text-[10px] text-parket-textDim truncate">
                  {r.tipo_frete}{r.origem && ` · ${r.origem} → ${r.destino}`}
                  {r.observacoes && ` · ${r.observacoes}`}
                </div>
              </div>
              <div className="text-xs font-semibold tabular-nums">{fmtBRL(r.valor_orcado || 0)}</div>
              <button onClick={() => aprovar(r.id, r.transportadora || r.solicitante)}
                disabled={processando === r.id}
                className="p-1.5 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400 disabled:opacity-30" title="Aprovar frete">
                {processando === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              </button>
              <button onClick={() => setRejeitando({ tipo: "fretes", id: r.id, label: `${r.transportadora || r.solicitante} · ${fmtBRL(r.valor_orcado || 0)}` })}
                className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Rejeitar">
                <XCircle size={12} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ─── ABA 5: Viagens (core.viagens — aprova adiantamento) ────────────
function TabViagens({ setRejeitando, processando, setProcessando }:
  { setRejeitando: any; processando: string | null; setProcessando: (v: string | null) => void }) {
  const [reload, setReload] = useState(0);
  const v = useFetch(() => api.viagensPendentes(), [reload]);
  const f = useFetch(() => api.funcionarios(), []);
  useMemo(() => {
    const on = () => setReload((x) => x + 1);
    window.addEventListener("aprovacoes:reload", on);
    return () => window.removeEventListener("aprovacoes:reload", on);
  }, []);

  const fById = new Map((f.data || []).map((x: any) => [x.id, x]));
  const rows = v.data || [];
  const total = rows.reduce((s: number, r: any) => s + Number(r.adiantamento || 0), 0);

  const aprovar = async (id: string, label: string) => {
    setProcessando(id);
    try {
      await api.aprovarViagem(id);
      toast.success(`${label} aprovada — adiantamento virou saída`);
      setReload((x) => x + 1);
    } catch (e: any) { toast.error(e?.message || "Erro"); } finally { setProcessando(null); }
  };

  return (
    <>
      <div className="text-[10px] text-parket-textDim">
        {rows.length} viagem(ns) aguardando · <b className="text-parket-accent">{fmtBRL(total)}</b> em adiantamentos
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {v.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!v.loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhuma viagem planejada. ✓</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((r: any) => {
            const func = r.funcionario_id ? fById.get(r.funcionario_id) : null;
            return (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-[10px] tabular-nums text-parket-textDim w-20">{fmtDate(r.data_ida)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{(func as any)?.nome || "?"}</div>
                  <div className="text-[10px] text-parket-textDim truncate">
                    {r.motivo}{r.destino_cidade && ` · ${r.destino_cidade}/${r.destino_uf}`}
                  </div>
                </div>
                <div className="text-xs font-semibold tabular-nums">{fmtBRL(r.adiantamento || 0)}</div>
                <button onClick={() => aprovar(r.id, `${(func as any)?.nome || "?"} → ${r.destino_cidade || ""}`)}
                  disabled={processando === r.id}
                  className="p-1.5 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400 disabled:opacity-30" title="Aprovar viagem e adiantamento">
                  {processando === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                </button>
                <button onClick={() => setRejeitando({ tipo: "viagens", id: r.id, label: `${(func as any)?.nome || "?"} · ${fmtBRL(r.adiantamento || 0)}` })}
                  className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Rejeitar">
                  <XCircle size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

// ─── ABA 6: RH adiantamentos (rh.adiantamentos) ─────────────────────
function TabRh({ setRejeitando, processando, setProcessando }:
  { setRejeitando: any; processando: string | null; setProcessando: (v: string | null) => void }) {
  const [reload, setReload] = useState(0);
  const ad = useFetch(() => api.adiantamentosRhPendentes(), [reload]);
  const ct = useFetch(() => api.rhContratos(), []);
  const co = useFetch(() => api.rhColaboradores(), []);
  useMemo(() => {
    const on = () => setReload((x) => x + 1);
    window.addEventListener("aprovacoes:reload", on);
    return () => window.removeEventListener("aprovacoes:reload", on);
  }, []);

  const ctById = new Map((ct.data || []).map((c) => [c.id, c]));
  const coById = new Map((co.data || []).map((c) => [c.id, c]));
  const rows = ad.data || [];
  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);

  const nomeColab = (contrato_id: string) => {
    const c = ctById.get(contrato_id);
    if (!c || !c.colaborador_id) return "?";
    return coById.get(c.colaborador_id)?.nome || "?";
  };

  const aprovar = async (id: string, label: string) => {
    setProcessando(id);
    try {
      await api.aprovarAdiantamentoRh(id);
      toast.success(`${label} aprovado — vira saída a pagar em 3d`);
      setReload((x) => x + 1);
    } catch (e: any) { toast.error(e?.message || "Erro"); } finally { setProcessando(null); }
  };

  return (
    <>
      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {rows.length} adiantamento(s) aguardando · <b className="text-parket-accent">{fmtBRL(total)}</b>
        <a href="https://rh.parket.works" target="_blank" rel="noreferrer"
          className="ml-auto text-parket-accent hover:underline inline-flex items-center gap-1">
          Abrir RH <ExternalLink size={10} />
        </a>
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {ad.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!ad.loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhum adiantamento pendente. ✓</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((r) => {
            const nome = nomeColab(r.contrato_id);
            return (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-[10px] tabular-nums text-parket-textDim w-20">{fmtDate(r.solicitado_em.slice(0, 10))}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{nome}</div>
                  <div className="text-[10px] text-parket-textDim truncate">{r.motivo || "sem motivo"}</div>
                </div>
                <div className="text-xs font-semibold tabular-nums">{fmtBRL(r.valor)}</div>
                <button onClick={() => aprovar(r.id, nome)}
                  disabled={processando === r.id}
                  className="p-1.5 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400 disabled:opacity-30" title="Aprovar adiantamento (cria a pagar em 3 dias)">
                  {processando === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                </button>
                <button onClick={() => setRejeitando({ tipo: "rh", id: r.id, label: `${nome} · ${fmtBRL(r.valor)}` })}
                  className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Rejeitar">
                  <XCircle size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

// ─── ABA 3: Compras (erp.pedidos_compra requer_aprovacao) ────────────
function TabCompras({ setRejeitando, processando, setProcessando }:
  { setRejeitando: any; processando: string | null; setProcessando: (v: string | null) => void }) {
  const [reload, setReload] = useState(0);
  const pc = useFetch(() => api.pedidosCompraPendentes(), [reload]);
  const fo = useFetch(() => api.erpFornecedores(), []);
  const ci = useFetch(() => api.comprasItensPendentes(), [reload]);
  useMemo(() => {
    const on = () => setReload((x) => x + 1);
    window.addEventListener("aprovacoes:reload", on);
    return () => window.removeEventListener("aprovacoes:reload", on);
  }, []);

  const foById = new Map((fo.data || []).map((f) => [f.id, f]));
  const rows = pc.data || [];
  const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);

  const aprovar = async (id: string, label: string) => {
    setProcessando(id);
    try {
      await api.aprovarPedidoCompra(id);
      toast.success(`${label} aprovado — pedido virou a pagar no Core`);
      setReload((x) => x + 1);
    } catch (e: any) { toast.error(e?.message || "Erro"); } finally { setProcessando(null); }
  };

  const aprovarItem = async (id: string, label: string, forma: string) => {
    setProcessando(id);
    try {
      const r = await api.aprovarItemCompra(id);
      const msg = forma === "faturado"
        ? `${label} aprovado — a pagar em ${r.venc || "?"} no Core`
        : `${label} aprovado — segue direto pra Rota (à vista)`;
      toast.success(msg);
      setReload((x) => x + 1);
    } catch (e: any) { toast.error(e?.message || "Erro"); } finally { setProcessando(null); }
  };

  const itensRows = ci.data || [];
  const itensTotal = itensRows.reduce((s, i) => s + Number(i.valor || 0), 0);

  return (
    <>
      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {rows.length} pedido(s) ERP + {itensRows.length} item(ns) · <b className="text-parket-accent">{fmtBRL(total + itensTotal)}</b>
        <a href="https://compras.parket.works" target="_blank" rel="noreferrer"
          className="ml-auto text-parket-accent hover:underline inline-flex items-center gap-1">
          Abrir Compras <ExternalLink size={10} />
        </a>
      </div>

      {/* SEÇÃO 1: Itens de compra AGRUPADOS por obra/cliente */}
      {(itensRows.length > 0 || ci.loading) && (() => {
        // Agrupa por (card_id) — cada card = uma solicitação de uma obra
        const grupos = new Map<string, typeof itensRows>();
        for (const it of itensRows) {
          const k = it.card_id;
          const arr = grupos.get(k) || [];
          arr.push(it);
          grupos.set(k, arr);
        }
        const gruposArr = [...grupos.entries()];
        return (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-bold">
            Itens de compra · fluxo por item ({itensRows.length} em {gruposArr.length} obra{gruposArr.length !== 1 ? "s" : ""})
          </div>
          {ci.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2 bg-parket-panel border border-parket-border rounded-xl"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
          {!ci.loading && itensRows.length === 0 && (
            <div className="p-6 text-center text-[11px] text-parket-textDim bg-parket-panel border border-parket-border rounded-xl">Nenhum item aguardando.</div>
          )}
          {gruposArr.map(([cardId, itensGrupo]) => {
            const primeiro: any = itensGrupo[0];
            const obraNome = primeiro.obra || "—";
            const solicit = primeiro.solicitante;
            const setorG = primeiro.setor;
            const totalGrupo = itensGrupo.reduce((s, i) => s + Number(i.valor || 0), 0);
            return (
              <div key={cardId} className="bg-parket-panel border-2 border-parket-accent/30 rounded-xl overflow-hidden">
                {/* Header do BLOCO — obra + solicitante + total */}
                <div className="px-5 py-3 bg-parket-accent/5 border-b border-parket-accent/30 flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-parket-accent font-bold">Obra</div>
                    <div className="text-sm font-bold text-parket-text truncate">{obraNome}</div>
                    {(solicit || setorG) && (
                      <div className="text-[10.5px] text-parket-textDim mt-0.5">
                        Solicitou: <span className="text-parket-text">{solicit || "—"}</span>{setorG ? ` · ${setorG}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[9px] uppercase tracking-wider text-parket-textDim">Total do pedido</div>
                    <div className="text-base font-bold text-parket-accent tabular-nums">{fmtBRL(totalGrupo)}</div>
                    <div className="text-[9.5px] text-parket-textDim">{itensGrupo.length} item{itensGrupo.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                {(primeiro as any).dados_pagto_obs && (
                  <div className="px-5 py-2 bg-yellow-500/10 border-b border-yellow-500/40">
                    <div className="text-[9px] uppercase tracking-wider text-yellow-500 font-bold mb-1 flex items-center gap-1"><Wallet size={10} /> Dados de pagamento (Compras)</div>
                    <div className="text-[11px] text-parket-text whitespace-pre-wrap leading-relaxed">{(primeiro as any).dados_pagto_obs}</div>
                  </div>
                )}
                {Array.isArray((primeiro as any).chat_messages) && (primeiro as any).chat_messages.length > 0 && (
                  <details className="px-5 py-2 bg-blue-500/5 border-b border-blue-500/30">
                    <summary className="text-[9px] uppercase tracking-wider text-blue-400 font-bold cursor-pointer">
                      <MessageSquare size={10} className="inline mr-1" />Comentários do Compras ({(primeiro as any).chat_messages.length})
                    </summary>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {(primeiro as any).chat_messages.slice(-6).map((m: any, i: number) => (
                        <div key={m.id || i} className="text-[10.5px] text-parket-text">
                          <span className="font-semibold text-parket-accent">{m.user || m.user_id || "—"}</span>
                          <span className="text-parket-textDim ml-2 text-[9.5px]">{m.ts ? new Date(m.ts).toLocaleString("pt-BR") : ""}</span>
                          <div className="whitespace-pre-wrap leading-relaxed">{m.msg}</div>
                        </div>
                      ))}
                      {(primeiro as any).chat_messages.length > 6 && (
                        <div className="text-[9.5px] text-parket-textDim italic">…mostrando os 6 mais recentes de {(primeiro as any).chat_messages.length}</div>
                      )}
                    </div>
                  </details>
                )}
                {/* Bloco de COTAÇÕES AGRUPADAS (fornecedor único cobre N itens) */}
                {(() => {
                  const cotacoes = new Map<string, typeof itensGrupo>();
                  const individuais: typeof itensGrupo = [];
                  for (const it of itensGrupo) {
                    const gid = (it as any).cotacao_grupo_id as string | null;
                    if (gid) {
                      const arr = cotacoes.get(gid) || [];
                      arr.push(it);
                      cotacoes.set(gid, arr);
                    } else {
                      individuais.push(it);
                    }
                  }
                  const aprovarLote = async (ids: string[], lbl: string, forma: string) => {
                    setProcessando(ids[0]);
                    try {
                      const results = await Promise.allSettled(ids.map((id) => api.aprovarItemCompra(id)));
                      const ok = results.filter((r) => r.status === "fulfilled").length;
                      const fail = results.length - ok;
                      if (fail === 0) toast.success(`${lbl} · ${ok} itens aprovados`);
                      else toast.error(`${ok} aprovados, ${fail} falharam`);
                      setReload((x) => x + 1);
                    } finally { setProcessando(null); }
                  };
                  return (
                    <>
                      {[...cotacoes.entries()].map(([gid, its]) => {
                        const meta = (its[0] as any).cotacao_grupo_meta || {};
                        const totalG = its.reduce((s, i) => s + Number(i.valor || 0), 0);
                        const fornG = meta.fornecedor_nome || (its[0] as any).forn_nome || (its[0] as any).fornecedor_nome_snapshot || "Fornecedor";
                        const ids = its.map((i) => i.id);
                        return (
                          <div key={gid} className="border-b border-parket-border/60 bg-purple-500/5">
                            <div className="px-5 py-3 flex items-start gap-3 flex-wrap border-b border-purple-500/20">
                              <div className="flex-1 min-w-0">
                                <div className="text-[9px] uppercase tracking-wider text-purple-400 font-bold">🔗 Cotação agrupada</div>
                                <div className="text-sm font-semibold text-parket-text truncate">{fornG}</div>
                                <div className="text-[10.5px] text-parket-textDim mt-0.5">
                                  {its.length} itens · {its[0].forma_pagamento === "faturado" ? `Faturado ${(its[0] as any).prazo_faturamento_texto || its[0].prazo_faturamento_dias}d` : its[0].forma_pagamento === "avista" ? "À vista" : its[0].forma_pagamento}
                                  {meta.arquivo_url && (
                                    <a href={meta.arquivo_url} target="_blank" rel="noreferrer"
                                       className="ml-2 text-purple-400 hover:underline">📄 {meta.arquivo_nome || "PDF"}</a>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[9px] uppercase tracking-wider text-parket-textDim">Total do grupo</div>
                                <div className="text-base font-bold text-purple-400 tabular-nums">{fmtBRL(meta.valor_total || totalG)}</div>
                                <div className="flex justify-end gap-1 mt-1">
                                  <button onClick={() => aprovarLote(ids, fornG, its[0].forma_pagamento)}
                                    disabled={processando !== null}
                                    className="px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 disabled:opacity-30">
                                    {processando === ids[0] ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Aprovar grupo
                                  </button>
                                  <button onClick={() => setRejeitando({ tipo: "compras-item", id: ids[0], label: `Grupo ${fornG}` })}
                                    className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                    <XCircle size={10} /> Rejeitar 1º
                                  </button>
                                </div>
                              </div>
                            </div>
                            <ul className="divide-y divide-parket-border/40">
                              {its.map((it) => (
                                <li key={it.id} className="px-5 py-2 flex flex-col gap-1 text-[11px]">
                                  <div className="flex items-center gap-3">
                                    <span className="text-parket-textDim tabular-nums w-8">#{it.seq}</span>
                                    <span className="flex-1 min-w-0 truncate text-parket-text">{it.material}</span>
                                    {it.quantidade && <span className="text-parket-textDim shrink-0">{it.quantidade}</span>}
                                    <span className="tabular-nums text-parket-textDim shrink-0">{fmtBRL(it.valor)}</span>
                                  </div>
                                  {(it as any).justificativa && (
                                    <div className="text-[10px] text-parket-textDim italic ml-11">{(it as any).justificativa}</div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}

                {/* Itens individuais (sem grupo de cotação) */}
                <ul className="divide-y divide-parket-border/60">
            {itensGrupo.filter((it) => !(it as any).cotacao_grupo_id).map((it) => {
              // Dados já vêm todos da RPC (item + card + fornecedor unificados)
              const obra = (it as any).obra || "—";
              const cliente = (it as any).cliente;
              const solicitante = (it as any).solicitante;
              const setor = (it as any).setor;
              const forma = it.forma_pagamento === "faturado"
                ? `Faturado ${(it as any).prazo_faturamento_texto || it.prazo_faturamento_dias}d`
                : it.forma_pagamento === "avista"
                ? "À vista"
                : it.forma_pagamento;
              const fornNome = (it as any).forn_nome || it.fornecedor_nome_snapshot || "Fornecedor não cadastrado";
              const cnpj  = (it as any).forn_cnpj;
              const razao = (it as any).forn_razao;
              const banco = (it as any).forn_banco;
              const ag    = (it as any).forn_agencia;
              const cc    = (it as any).forn_conta;
              const pix   = (it as any).forn_pix;
              const orcamentos: any[] = Array.isArray((it as any).orcamentos) ? (it as any).orcamentos : [];
              const escolhido = orcamentos.find((o) => o.escolhido);
              const concorrentes = orcamentos.filter((o) => !o.escolhido);
              const semOrc = orcamentos.length === 0;
              const comprarEm = (it as any).comprar_em as string | null;
              const label = `${it.material} · ${fornNome} · ${fmtBRL(it.valor)}`;
              return (
                <li key={it.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-parket-text">
                        <span className="text-[9.5px] font-normal text-parket-textDim mr-1.5">#{it.seq}</span>
                        {it.material}
                      </div>
                      <div className="text-[10.5px] text-parket-textDim mt-0.5 flex flex-wrap gap-2">
                        {it.quantidade && <span>Qtd: {it.quantidade}</span>}
                        {comprarEm && (
                          <span className="text-blue-400 font-semibold inline-flex items-center gap-1"><Calendar size={10} /> Comprar em {comprarEm.split("-").reverse().join("/")}</span>
                        )}
                      </div>
                      {(it as any).justificativa && (
                        <div className="text-[10.5px] text-parket-text mt-1 px-2 py-1 bg-parket-panelLight/60 border-l-2 border-parket-accent/50 italic">
                          <span className="text-[9px] uppercase tracking-wider text-parket-textDim not-italic mr-1">Justificativa:</span>
                          {(it as any).justificativa}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums text-parket-accent">{fmtBRL(it.valor)}</div>
                      <div className="text-[10px] text-parket-textDim mt-0.5">{forma}</div>
                      <div className="text-[9px] text-parket-textDim tabular-nums mt-0.5">{fmtDate(it.created_at)}</div>
                      <div className="flex justify-end gap-1 mt-2">
                        <button onClick={() => aprovarItem(it.id, label, it.forma_pagamento)}
                          disabled={processando === it.id}
                          title={it.forma_pagamento === "faturado"
                            ? `Aprova + cria a pagar no Core (venc = hoje + ${it.prazo_faturamento_dias}d)`
                            : "Aprova — segue direto pra Rota de Entrega (à vista, sem lançamento)"}
                          className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 text-[10px] font-bold uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1">
                          {processando === it.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Aprovar
                        </button>
                        <button onClick={() => setRejeitando({ tipo: "compras-item", id: it.id, label })}
                          className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1" title="Reprovar item">
                          <XCircle size={10} /> Rejeitar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Orçamento (PDF) escolhido pelo Compras — visualização inline pro Financeiro conferir */}
                  <div className="mt-3 pt-3 border-t border-parket-border/40">
                    <div className="text-[9px] uppercase tracking-wider text-parket-textDim font-bold mb-1.5">Orçamento pra aprovação</div>
                    {semOrc ? (
                      <div className="text-[10.5px] text-parket-textDim italic">
                        Sem PDF anexado pelo Compras.
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={escolhido?.arquivo_url || orcamentos[0].arquivo_url} target="_blank" rel="noreferrer"
                           className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-parket-accent/10 hover:bg-parket-accent/20 text-parket-accent text-[11px] font-semibold border border-parket-accent/30">
                          📄 {escolhido?.arquivo_nome || orcamentos[0].arquivo_nome || "Ver PDF do orçamento"}
                        </a>
                        {concorrentes.length > 0 && (
                          <details className="text-[10px]">
                            <summary className="cursor-pointer text-parket-textDim hover:text-parket-text">
                              + {concorrentes.length} orçamento{concorrentes.length > 1 ? "s" : ""} concorrente{concorrentes.length > 1 ? "s" : ""}
                            </summary>
                            <div className="mt-1.5 flex flex-col gap-1 pl-3">
                              {concorrentes.map((o, i) => (
                                <a key={i} href={o.arquivo_url} target="_blank" rel="noreferrer"
                                   className="inline-flex items-center gap-1.5 text-parket-textDim hover:text-parket-accent">
                                  <Paperclip size={10} className="inline mr-0.5" />{o.arquivo_nome || "orcamento.pdf"}
                                </a>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bloco fornecedor: nome/CNPJ + banco/PIX pra Financeiro pagar */}
                  <div className="mt-3 pt-3 border-t border-parket-border/40 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10.5px]">
                    <div>
                      <span className="text-parket-textDim uppercase tracking-wider text-[9px] mr-1.5">Fornecedor</span>
                      <span className="text-parket-text font-semibold">{fornNome}</span>
                      {cnpj && <span className="text-parket-textDim ml-2">CNPJ {cnpj}</span>}
                      {razao && razao !== fornNome && (
                        <div className="text-parket-textDim text-[10px]">Razão: {razao}</div>
                      )}
                    </div>
                    <div>
                      {(banco || ag || cc) && (
                        <div>
                          <span className="text-parket-textDim uppercase tracking-wider text-[9px] mr-1.5">Banco</span>
                          <span className="text-parket-text">{banco || "—"}</span>
                          {ag && <span className="text-parket-textDim ml-2">Ag {ag}</span>}
                          {cc && <span className="text-parket-textDim ml-2">CC {cc}</span>}
                        </div>
                      )}
                      {pix && (
                        <div>
                          <span className="text-parket-textDim uppercase tracking-wider text-[9px] mr-1.5">PIX</span>
                          <span className="text-parket-text">{pix}</span>
                        </div>
                      )}
                      {!banco && !ag && !cc && !pix && (
                        <div className="text-parket-textDim italic">Sem dados bancários cadastrados no fornecedor</div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* SEÇÃO 2: Pedidos ERP (fluxo antigo — pra manter compat) */}
      {rows.length > 0 && (
        <div className="px-1 pt-4 pb-1 text-[10px] uppercase tracking-wider text-parket-textDim font-bold">
          Pedidos ERP · legacy ({rows.length})
        </div>
      )}
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {pc.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!pc.loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhum pedido aguardando aprovação. ✓</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((p) => {
            const forn = p.fornecedor_id ? foById.get(p.fornecedor_id) : null;
            return (
              <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-[10px] tabular-nums text-parket-textDim w-20">{p.data_pedido ? fmtDate(p.data_pedido) : "—"}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{forn?.nome || "Fornecedor —"}</div>
                  <div className="text-[10px] text-parket-textDim truncate">
                    {p.numero}{p.observacao && ` · ${p.observacao}`}
                  </div>
                </div>
                <div className="text-xs font-semibold tabular-nums">{fmtBRL(p.total)}</div>
                <button onClick={() => aprovar(p.id, forn?.nome || p.numero)}
                  disabled={processando === p.id}
                  className="p-1.5 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400 disabled:opacity-30" title="Aprovar pedido (marca APROVADO + cria a pagar no Core +30d)">
                  {processando === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                </button>
                <button onClick={() => setRejeitando({ tipo: "compras", id: p.id, label: `${forn?.nome || p.numero} · ${fmtBRL(p.total)}` })}
                  className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Rejeitar">
                  <XCircle size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

// ─── ABA: Custos de Terceiros (gestao.custo_lancamento via API do gestao) ───
// Fila = lançamentos enviado/em_analise. O financeiro decide despesa a
// despesa (aprovar/glosar) e depois aprova ou devolve o lançamento inteiro.
// Aprovado vai pra tela /pagamentos, onde vira pago + comprovante.
const CUSTO_SUBCAT: Record<string, string> = {
  combustivel_km: "Combustível por km", reembolso_km: "Reembolso km",
  abastecimento: "Abastecimento", pedagio: "Pedágio", passagem: "Passagem",
  aluguel_carro: "Aluguel de carro", uber: "Uber", taxi: "Táxi",
  estacionamento: "Estacionamento", hospedagem: "Hospedagem",
  alimentacao: "Alimentação", diaria_fechada: "Diária fechada", nf: "NF", rpa: "RPA",
};
const fmtCent = (c: number) => fmtBRL((c || 0) / 100);

function TabCustos({ setRejeitando, processando, setProcessando }:
  { setRejeitando: any; processando: string | null; setProcessando: (v: string | null) => void }) {
  const [reload, setReload] = useState(0);
  const fila = useFetch(() => api.custosFila(), [reload]);
  useMemo(() => {
    const on = () => setReload((x) => x + 1);
    window.addEventListener("aprovacoes:reload", on);
    return () => window.removeEventListener("aprovacoes:reload", on);
  }, []);

  const rows = fila.data?.items || [];
  const totalCent = rows.reduce((s, r) => s + Number(r.total_lancado_cent || 0), 0);

  return (
    <>
      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {rows.length} lançamento(s) na fila · <b className="text-parket-accent">{fmtCent(totalCent)}</b> lançados
        <a href="https://gestao.parket.works/custos" target="_blank" rel="noreferrer"
          className="ml-auto text-parket-accent hover:underline inline-flex items-center gap-1">
          Abrir Gestão <ExternalLink size={10} />
        </a>
      </div>
      <div className="space-y-3">
        {fila.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2 bg-parket-panel border border-parket-border rounded-xl"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {fila.error && <div className="p-4 text-xs text-red-400 bg-parket-panel border border-parket-border rounded-xl">{fila.error}</div>}
        {!fila.loading && !fila.error && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim bg-parket-panel border border-parket-border rounded-xl">Nenhum custo de terceiro aguardando análise. ✓</div>
        )}
        {rows.map((r) => (
          <CustoLancCard key={r.id} lanc={r}
            setRejeitando={setRejeitando} processando={processando} setProcessando={setProcessando} />
        ))}
      </div>
    </>
  );
}

// Card expansível de um lançamento OPT-XXXX: header com totais, corpo com as
// despesas (decisão item a item) + histórico + ações de transição.
function CustoLancCard({ lanc, setRejeitando, processando, setProcessando }:
  { lanc: CustoLancResumo; setRejeitando: any; processando: string | null; setProcessando: (v: string | null) => void }) {
  const [aberto, setAberto] = useState(false);
  const [det, setDet] = useState<CustoDetalhe | null>(null);
  const [loadingDet, setLoadingDet] = useState(false);

  const carregar = async () => {
    setLoadingDet(true);
    try { setDet(await api.custosDetalhe(lanc.id)); }
    catch (e: any) { toast.error(e?.message || "Erro ao carregar detalhe"); }
    finally { setLoadingDet(false); }
  };

  // Glosa acontece no ModalRejeitar (fora deste card): quando o modal dispara
  // o reload geral, recarrega o detalhe aberto pra refletir a decisão.
  useEffect(() => {
    const on = () => { if (aberto) carregar(); };
    window.addEventListener("aprovacoes:reload", on);
    return () => window.removeEventListener("aprovacoes:reload", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const toggle = () => {
    const abrir = !aberto;
    setAberto(abrir);
    if (abrir && !det) carregar();
  };

  const decidir = async (did: string, decisao: "aprovado" | "pendente", label: string) => {
    setProcessando(did);
    try {
      await api.custosDecisao(did, decisao);
      toast.success(decisao === "aprovado" ? `${label} aprovada` : `${label} voltou pra pendente`);
      await carregar();
    } catch (e: any) { toast.error(e?.message || "Erro"); } finally { setProcessando(null); }
  };

  const transicao = async (para: "aprovado" | "em_analise") => {
    setProcessando(lanc.id);
    try {
      await api.custosStatus(lanc.id, para);
      toast.success(para === "aprovado"
        ? `${lanc.numero} aprovado — segue pra tela Pagamentos`
        : `${lanc.numero} em análise`);
      window.dispatchEvent(new Event("aprovacoes:reload"));
    } catch (e: any) { toast.error(e?.message || "Erro"); } finally { setProcessando(null); }
  };

  const despesas = det?.despesas || [];
  const nPend = det ? despesas.filter((d) => d.status === "pendente").length : lanc.n_pendentes;
  const statusChip = lanc.status === "enviado"
    ? "bg-amber-500/15 text-amber-300" : "bg-blue-500/15 text-blue-300";

  return (
    <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
      {/* Header clicável: expande pras despesas */}
      <button onClick={toggle} className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-parket-panelLight/30 transition">
        <ChevronDown size={14} className={`text-parket-textDim shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">
            <span className="text-parket-accent">{lanc.numero}</span> · {lanc.prestador_nome || "Prestador ?"}
          </div>
          <div className="text-[10px] text-parket-textDim truncate">
            {lanc.cliente || "Obra ?"}
            {lanc.data_ida && ` · ${fmtDate(lanc.data_ida)}${lanc.data_volta ? ` a ${fmtDate(lanc.data_volta)}` : ""}`}
            {lanc.motivo && ` · ${lanc.motivo}`}
          </div>
        </div>
        {lanc.n_alertas > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500/15 text-yellow-300" title="Despesas com alerta (teto/anexo/data)">
            <AlertCircle size={9} /> {lanc.n_alertas}
          </span>
        )}
        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusChip}`}>
          {lanc.status === "em_analise" ? "em análise" : lanc.status}
        </span>
        <div className="text-right shrink-0 w-24">
          <div className="text-xs font-bold tabular-nums text-parket-accent">{fmtCent(lanc.total_lancado_cent)}</div>
          <div className="text-[9px] text-parket-textDim">{lanc.n_despesas} despesa{lanc.n_despesas !== 1 ? "s" : ""} · {nPend} pend.</div>
        </div>
      </button>

      {aberto && (
        <div className="border-t border-parket-border/60">
          {loadingDet && !det && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando despesas…</div>}
          {det && (
            <>
              {/* Despesas: decisão item a item */}
              <ul className="divide-y divide-parket-border/40">
                {despesas.map((d) => {
                  const label = `${CUSTO_SUBCAT[d.subcategoria] || d.subcategoria}${d.descricao ? ` (${d.descricao})` : ""}`;
                  const alertas = Array.isArray(d.alertas) ? d.alertas : [];
                  return (
                    <li key={d.id} className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="text-[10px] tabular-nums text-parket-textDim w-16">{d.data ? fmtDate(d.data) : "sem data"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold truncate">
                            {CUSTO_SUBCAT[d.subcategoria] || d.subcategoria}
                            {d.descricao && <span className="text-parket-textDim font-normal"> · {d.descricao}</span>}
                          </div>
                          <div className="text-[10px] text-parket-textDim flex flex-wrap gap-x-2">
                            {Number(d.quantidade) !== 1 && <span>{Number(d.quantidade)} x {fmtCent(d.valor_unitario_cent)}</span>}
                            {d.anexo_url
                              ? <a href={d.anexo_url} target="_blank" rel="noreferrer" className="text-parket-accent hover:underline inline-flex items-center gap-0.5"><Paperclip size={9} /> {d.anexo_nome || "anexo"}</a>
                              : <span className="italic">sem anexo</span>}
                            {alertas.map((a, i) => (
                              <span key={i} className="text-yellow-400 inline-flex items-center gap-0.5" title={a.mensagem}><AlertCircle size={9} /> {a.mensagem}</span>
                            ))}
                            {d.status === "glosado" && d.glosa_motivo && <span className="text-red-400">glosa: {d.glosa_motivo}</span>}
                          </div>
                        </div>
                        <div className="text-[11px] font-semibold tabular-nums shrink-0">{fmtCent(d.valor_total_cent)}</div>
                        {d.status === "pendente" ? (
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => decidir(d.id, "aprovado", label)} disabled={processando === d.id}
                              className="p-1.5 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400 disabled:opacity-30" title="Aprovar despesa">
                              {processando === d.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            </button>
                            <button onClick={() => setRejeitando({ tipo: "custos-despesa", id: d.id, label: `${label} · ${fmtCent(d.valor_total_cent)}` })}
                              className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Glosar despesa (exige motivo)">
                              <XCircle size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              d.status === "aprovado" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                              {d.status}
                            </span>
                            <button onClick={() => decidir(d.id, "pendente", label)} disabled={processando === d.id}
                              className="p-1 rounded hover:bg-parket-panelLight text-parket-textDim hover:text-parket-text disabled:opacity-30" title="Desfazer decisão (volta pra pendente)">
                              <Undo2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Rodapé: totais + pendências + ações do lançamento */}
              <div className="px-5 py-3 border-t border-parket-border/60 bg-parket-panelLight/20 flex items-center gap-4 flex-wrap">
                <div className="text-[10px] text-parket-textDim">
                  Aprovado <b className="text-emerald-400 tabular-nums">{fmtCent(det.lancamento.total_aprovado_cent)}</b>
                  {det.lancamento.adiantamento_cent > 0 && <> · Adiantamento <b className="tabular-nums">{fmtCent(det.lancamento.adiantamento_cent)}</b></>}
                  {" "}· Saldo a pagar <b className="text-parket-accent tabular-nums">{fmtCent(det.lancamento.saldo_cent)}</b>
                </div>
                {(det.pendencias || []).length > 0 && (
                  <div className="text-[10px] text-yellow-400 flex items-center gap-1"><AlertCircle size={10} /> {(det.pendencias || []).join(" · ")}</div>
                )}
                <div className="ml-auto flex gap-1.5">
                  <button onClick={() => api.custosOpPdf(lanc.id, lanc.numero).catch((e) => toast.error(e?.message || "Erro"))}
                    className="px-2.5 py-1 rounded bg-parket-panelLight hover:bg-parket-border text-parket-textDim hover:text-parket-text text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1" title="Baixar ordem de pagamento em PDF">
                    <FileText size={10} /> OP PDF
                  </button>
                  <button onClick={() => setRejeitando({ tipo: "custos", id: lanc.id, label: `${lanc.numero} · ${lanc.prestador_nome || ""} · ${fmtCent(lanc.total_lancado_cent)}` })}
                    className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1" title="Devolver pro secretário corrigir (exige motivo)">
                    <XCircle size={10} /> Devolver
                  </button>
                  <button onClick={() => transicao("aprovado")}
                    disabled={processando === lanc.id || nPend > 0 || despesas.length === 0}
                    title={nPend > 0 ? `Decida as ${nPend} despesa(s) pendente(s) antes de aprovar` : "Aprovar lançamento (segue pra tela Pagamentos)"}
                    className="px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed">
                    {processando === lanc.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Aprovar lançamento
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ABA 7: Reembolsos (rh.reembolsos — origem no Core enquanto rh.parket.works não tem form) ───
function TabReembolsos({ setRejeitando, processando, setProcessando }:
  { setRejeitando: any; processando: string | null; setProcessando: (v: string | null) => void }) {
  const [reload, setReload] = useState(0);
  const [novo, setNovo] = useState(false);
  const rb = useFetch(() => api.reembolsosPendentes(), [reload]);
  const co = useFetch(() => api.rhColaboradores(), []);
  useMemo(() => {
    const on = () => setReload((x) => x + 1);
    window.addEventListener("aprovacoes:reload", on);
    return () => window.removeEventListener("aprovacoes:reload", on);
  }, []);

  const coById = new Map((co.data || []).map((c) => [c.id, c]));
  const rows = rb.data || [];
  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);

  const aprovar = async (id: string, label: string) => {
    setProcessando(id);
    try {
      await api.aprovarReembolso(id);
      toast.success(`Reembolso ${label} aprovado — a pagar em 3d`);
      setReload((x) => x + 1);
    } catch (e: any) { toast.error(e?.message || "Erro"); } finally { setProcessando(null); }
  };

  return (
    <>
      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {rows.length} reembolso(s) aguardando · <b className="text-parket-accent">{fmtBRL(total)}</b>
        <button onClick={() => setNovo(true)}
          className="ml-auto inline-flex items-center gap-1 text-parket-accent hover:underline">
          <Plus size={11} /> Novo reembolso
        </button>
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {rb.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!rb.loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhum reembolso pendente. ✓</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((r) => {
            const col = coById.get(r.colaborador_id);
            return (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-[10px] tabular-nums text-parket-textDim w-20">{fmtDate(r.data_gasto)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{(col as any)?.nome || "?"} <span className="text-parket-textDim font-normal">· {r.categoria}</span></div>
                  <div className="text-[10px] text-parket-textDim truncate">
                    {r.descricao}
                    {r.comprovante_url && <a href={r.comprovante_url} target="_blank" rel="noreferrer" className="ml-2 text-parket-accent hover:underline">comprovante</a>}
                  </div>
                </div>
                <div className="text-xs font-semibold tabular-nums">{fmtBRL(r.valor)}</div>
                <button onClick={() => aprovar(r.id, `${(col as any)?.nome || "?"} · ${fmtBRL(r.valor)}`)}
                  disabled={processando === r.id}
                  className="p-1.5 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400 disabled:opacity-30" title="Aprovar reembolso">
                  {processando === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                </button>
                <button onClick={() => setRejeitando({ tipo: "reembolsos", id: r.id, label: `${(col as any)?.nome || "?"} · ${fmtBRL(r.valor)}` })}
                  className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Rejeitar">
                  <XCircle size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <ModalNovoReembolso open={novo} onClose={() => setNovo(false)} onSaved={() => { setNovo(false); setReload((x) => x + 1); }} colaboradores={co.data || []} />
    </>
  );
}

// ─── Modal: cadastrar reembolso (Karla/RH no lugar do colaborador) ─────
function ModalNovoReembolso({ open, onClose, onSaved, colaboradores }:
  { open: boolean; onClose: () => void; onSaved: () => void;
    colaboradores: { id: string; nome: string }[] }) {
  const [saving, setSaving] = useState(false);
  const [colId, setColId] = useState("");
  const [dataGasto, setDataGasto] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState("transporte");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [comprovante, setComprovante] = useState("");
  if (!open) return null;

  const salvar = async () => {
    if (!colId) { toast.error("Escolha o colaborador"); return; }
    const v = Number(valor.replace(",", "."));
    if (!(v > 0)) { toast.error("Valor > 0 obrigatório"); return; }
    if (descricao.trim().length < 3) { toast.error("Descrição obrigatória"); return; }
    setSaving(true);
    try {
      await api.submeterReembolso({
        colaboradorId: colId, dataGasto, categoria, valor: v,
        descricao: descricao.trim(), comprovanteUrl: comprovante.trim() || undefined,
      });
      toast.success("Reembolso cadastrado — aguarda aprovação");
      onSaved();
      setColId(""); setValor(""); setDescricao(""); setComprovante("");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo reembolso">
      <div className="space-y-3 min-w-[420px]">
        <Field label="Colaborador">
          <Select value={colId} onChange={(e) => setColId(e.target.value)}>
            <option value="">— selecionar —</option>
            {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data do gasto">
            <Input type="date" value={dataGasto} onChange={(e) => setDataGasto(e.target.value)} />
          </Field>
          <Field label="Categoria">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="transporte">Transporte</option>
              <option value="alimentacao">Alimentação</option>
              <option value="material">Material</option>
              <option value="hospedagem">Hospedagem</option>
              <option value="combustivel">Combustível</option>
              <option value="outros">Outros</option>
            </Select>
          </Field>
        </div>
        <Field label="Valor (R$)">
          <Input inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Field>
        <Field label="Descrição">
          <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="ex.: Uber cliente → obra 04/08" />
        </Field>
        <Field label="Comprovante (URL — opcional)">
          <Input type="url" placeholder="https://…" value={comprovante} onChange={(e) => setComprovante(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : "Cadastrar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
