/**
 * Pagamentos v2 (task #1669) — gerenciador cross-obra com abas por tipo.
 *
 * Abas core-native (RT/Comissão/Impostos): filtram core.lancamentos por
 * prefixo de numero_documento (COM-, RT-, IMP-).
 *
 * Abas integradas (Compras/Prestadores): leem direto das plataformas de
 * origem (erp.pedidos_compra + public.prestadores_pagamentos) via
 * crossSchemaFetch — sem duplicar dado no core. Baixa acontece na origem.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, Undo2, ArrowUpFromLine, Receipt, ShoppingCart, HardHat, ClipboardCheck, FileText, ExternalLink, Loader2, Settings2, X, Package, Paperclip } from "lucide-react";
import { api, useFetch, type Lancamento, type CustoLancResumo } from "../../../lib/api";
import { supabase } from "../../../lib/supabase";

const CLOUD_URL  = "https://hbxpilrxmitvzebluoom.supabase.co";
const CLOUD_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

async function uploadCloud(bucket: string, path: string, file: File): Promise<string> {
  const r = await fetch(`${CLOUD_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { apikey: CLOUD_ANON, Authorization: `Bearer ${CLOUD_ANON}`, "Content-Type": file.type || "application/pdf" },
    body: file,
  });
  if (!r.ok) throw new Error(`Upload falhou (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return `${CLOUD_URL}/storage/v1/object/public/${bucket}/${path}`;
}
import { fmtBRL, fmtDate, colorByStatus, obraLabel } from "../../../lib/format";
import { useSelectedEmpresa } from "../../../lib/store";
import { Select, Button } from "../../ui/Form";
import { BaixarLancamentoModal } from "../../forms/BaixarLancamentoModal";
import { EstornarLancamentoModal } from "../../forms/EstornarLancamentoModal";
import { useAuth } from "../../../lib/auth";
import { toast } from "../../../lib/toast";

type TabKey = "rt" | "comissao" | "compras" | "notas" | "prestadores" | "fiscais" | "custos";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "rt",          label: "RT",          icon: ClipboardCheck },
  { key: "comissao",    label: "Comissão",    icon: Receipt },
  { key: "compras",     label: "Compras",     icon: ShoppingCart },
  { key: "notas",       label: "Notas NF",    icon: Package },
  { key: "prestadores", label: "Prestadores", icon: HardHat },
  { key: "fiscais",     label: "Fiscais",     icon: FileText },
  // Custos de Terceiros (gestao.parket.works/custos): aprovados na aba
  // Aprovações caem aqui pra pagar com comprovante (task #2060).
  { key: "custos",      label: "Terceiros",   icon: Wallet },
];

const STATUS_FILTERS = ["a_pagar", "futuros", "todos", "pagos"] as const;

export function PagamentosV2Page() {
  const [tab, setTab] = useState<TabKey>("rt");
  const [statusF, setStatusF] = useState<typeof STATUS_FILTERS[number]>("a_pagar");

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><ArrowUpFromLine size={18} className="text-parket-accent" /> Pagamentos</h1>
        <p className="text-xs text-parket-textDim mt-1">Gerenciador de saídas por categoria — integrado com as plataformas de origem</p>
      </div>

      <div className="flex gap-1 bg-parket-panel border border-parket-border rounded-lg p-1 w-fit flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] uppercase tracking-wider font-bold transition ${
                tab === t.key ? "bg-parket-accent text-parket-bg" : "text-parket-textDim hover:text-parket-text"
              }`}>
              <Icon size={12} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusF(s)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
                statusF === s ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
                              : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
              }`}>{s.replace("_", " ")}</button>
          ))}
        </div>
      </div>

      {(tab === "notas" || tab === "compras") && (
        <div className="flex items-center gap-2.5 flex-wrap bg-parket-panel border border-parket-border rounded-lg px-3.5 py-2 text-[11px] text-parket-textDim">
          {[
            ["1", "Compras anexa o boleto", false],
            ["2", "Financeiro confere e paga aqui (com comprovante)", true],
            ["3", "Comprovante volta automático pro Compras", false],
          ].map(([n, txt, forte], i) => (
            <span key={String(n)} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-parket-textDim/50 mx-0.5">→</span>}
              <span className={`w-[17px] h-[17px] rounded-full inline-flex items-center justify-center text-[9px] font-bold ${
                forte ? "bg-parket-accent text-parket-bg" : "bg-parket-accent/15 text-parket-textDim"
              }`}>{n}</span>
              <span className={forte ? "text-parket-text font-semibold" : ""}>{txt}</span>
            </span>
          ))}
        </div>
      )}

      {tab === "rt" && <CoreTab tipo="rt" statusF={statusF} />}
      {tab === "comissao" && <CoreTab tipo="comissao" statusF={statusF} />}
      {tab === "fiscais" && <CoreTab tipo="fiscais" statusF={statusF} />}
      {tab === "notas" && <CoreTab tipo="notas" statusF={statusF} />}
      {tab === "compras" && <ComprasTab statusF={statusF} />}
      {tab === "prestadores" && <PrestadoresTab statusF={statusF} />}
      {tab === "custos" && <CustosTab statusF={statusF} />}
    </div>
  );
}

/** Abas nativas do core: filtram core.lancamentos por prefixo. Baixa 1-clique
 *  + checkbox + barra flutuante de baixa em lote (task #1671). */
function CoreTab({ tipo, statusF }: { tipo: "rt" | "comissao" | "fiscais" | "notas"; statusF: typeof STATUS_FILTERS[number] }) {
  const [empresaId] = useSelectedEmpresa();
  const auth = useAuth();
  const isAdmin = auth.appUser?.role === "admin";
  const lan = useFetch(() => api.lancamentos(5000), []);
  const pa  = useFetch(() => api.parceiros(), []);
  const ob  = useFetch(() => api.obras(), []);
  const cb  = useFetch(() => api.contasBancarias(), []);
  const [baixando, setBaixando] = useState<Lancamento | null>(null);
  const [estornando, setEstornando] = useState<Lancamento | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [contaLote, setContaLote] = useState("");
  const [proc, setProc] = useState(false);

  const rows = useMemo(() => {
    if (!lan.data) return [];
    const prefix = tipo === "rt" ? "RT-" : tipo === "comissao" ? "COM-" : tipo === "notas" ? "NF-" : "IMP-";
    return lan.data
      .filter((l) => l.tipo === "saida")
      .filter((l) => empresaId == null || l.empresa_id === empresaId)
      .filter((l) => (l.numero_documento || "").startsWith(prefix))
      .filter((l) => {
        const baixado = l.status === "pago" || l.status === "conciliado" || l.status === "recebido";
        if (statusF === "a_pagar") return !baixado && l.status !== "cancelado";
        if (statusF === "pagos") return baixado;
        return true;
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [lan.data, empresaId, tipo, statusF]);

  const paById = new Map((pa.data || []).map((p) => [p.id, p]));
  const obById = new Map((ob.data || []).map((o) => [o.id, o]));
  const contasPorEmpresa = (eid: string) => (cb.data || []).filter((c) => c.ativo !== false && c.empresa_id === eid);
  const contasElegiveisLote = useMemo(() => {
    const list = cb.data || [];
    if (empresaId) return list.filter((c) => c.ativo !== false && c.empresa_id === empresaId);
    return list.filter((c) => c.ativo !== false);
  }, [cb.data, empresaId]);

  const totalABaixar = rows.filter((l) => l.status === "previsto" || l.status === "a_pagar" || l.status === "atrasado")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totalSel = rows.filter((l) => selecionados.has(l.id)).reduce((s, l) => s + Number(l.valor), 0);
  const abertos = rows.filter((l) => l.status !== "pago" && l.status !== "conciliado" && l.status !== "recebido" && l.status !== "cancelado");

  const baixarQuick = async (l: Lancamento) => {
    try {
      await api.baixarLancamentoQuick(l, contasPorEmpresa(l.empresa_id));
      toast.success("Pago");
      lan.reload();
    } catch (e: any) {
      const msg = String(e?.message || e);
      toast.error(msg.includes("nenhuma_conta_ativa") ? "Sem conta ativa nesta empresa" : msg);
    }
  };

  const baixarLote = async () => {
    if (!contaLote) { toast.error("Escolha a conta destino"); return; }
    const alvos = rows.filter((l) => selecionados.has(l.id));
    setProc(true);
    let ok = 0, err = 0;
    for (const l of alvos) {
      try {
        await api.baixarLancamento({
          lancId: l.id, contaBancariaId: contaLote, valorPago: Number(l.valor),
          dataPagamento: new Date().toISOString().slice(0, 10),
          formaPagamento: l.forma_pagamento || "PIX",
        });
        ok++;
      } catch { err++; }
    }
    toast.success(`${ok} baixado(s)${err > 0 ? ` · ${err} com erro` : ""}`);
    setSelecionados(new Set()); setContaLote(""); setProc(false); lan.reload();
  };

  const toggleSel = (id: string) => setSelecionados((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const toggleTodos = () => {
    if (selecionados.size === abertos.length) setSelecionados(new Set());
    else setSelecionados(new Set(abertos.map((l) => l.id)));
  };

  return (
    <>
      <div className="text-[10px] text-parket-textDim">
        {rows.length} item(ns) · <b className="text-parket-accent">{fmtBRL(totalABaixar)}</b> a pagar
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {statusF === "a_pagar" && abertos.length > 0 && (
          <div className="px-5 py-2.5 border-b border-parket-border/60 flex items-center gap-2 text-[10px] text-parket-textDim">
            <input type="checkbox" checked={selecionados.size > 0 && selecionados.size === abertos.length}
              onChange={toggleTodos} className="accent-parket-accent" />
            <span>Selecionar todos abertos</span>
          </div>
        )}
        {lan.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!lan.loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">
            {tipo === "rt" && "Nenhum RT liberado ainda. Configure rt% + arquiteto nas obras."}
            {tipo === "comissao" && "Nenhuma comissão liberada ainda. Configure comissão% + vendedor nas obras."}
            {tipo === "fiscais" && "Nenhum imposto no período. Cron dia 20."}
            {tipo === "notas" && "Nenhuma parcela de NF. Elas nascem na entrada de nota do Compras/Almoxarifado."}
          </div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((l) => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const venc = new Date(l.data_vencimento + "T00:00:00");
            const baixado = l.status === "pago" || l.status === "conciliado" || l.status === "recebido";
            const isFinal = baixado || l.status === "cancelado";
            const atrasado = !isFinal && venc < today;
            const eff = atrasado ? "atrasado" : l.status;
            const c = colorByStatus[eff];
            const parc = l.parceiro_id ? paById.get(l.parceiro_id) : null;
            const obra = l.obra_id ? obById.get(l.obra_id) : null;
            const sel = selecionados.has(l.id);
            return (
              <li key={l.id} className={`px-5 py-3 flex items-center gap-3 ${sel ? "bg-parket-panelLight/40" : ""}`}>
                {!isFinal ? (
                  <input type="checkbox" checked={sel} onChange={() => toggleSel(l.id)}
                    className="accent-parket-accent" />
                ) : <div className="w-3.5" />}
                <div className="text-[10px] tabular-nums text-parket-textDim w-20">{fmtDate(l.data_vencimento)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{parc?.nome || l.descricao}</div>
                  <div className="text-[10px] text-parket-textDim truncate">
                    {obra && <Link to={`/obras/${obra.id}`} className="text-parket-accent hover:underline">{obraLabel(obra.codigo, obra.nome)}</Link>}
                    {l.numero_documento && ` · ${l.numero_documento}`}
                  </div>
                </div>
                {(l as any).boleto_url ? (
                  <a href={(l as any).boleto_url} target="_blank" rel="noreferrer" title={(l as any).boleto_nome || "Boleto"}
                    className="inline-flex items-center gap-1 text-[10px] text-parket-accent hover:underline shrink-0">
                    <Paperclip size={11} /> Boleto
                  </a>
                ) : (tipo === "notas" && !isFinal && (
                  <span className="text-[9.5px] text-parket-textDim italic shrink-0">sem boleto</span>
                ))}
                <div className="text-xs font-semibold tabular-nums">{fmtBRL(l.valor)}</div>
                {c && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase w-24 text-center" style={{ color: c.fg, background: c.bg }}>
                    {eff.replace("_", " ")}
                  </span>
                )}
                {!isFinal && (
                  <>
                    <button onClick={() => baixarQuick(l)}
                      className="p-1.5 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400" title="Pagar 1-clique">
                      <Wallet size={12} />
                    </button>
                    <button onClick={() => setBaixando(l)}
                      className="p-1.5 rounded hover:bg-parket-panelLight text-parket-textDim hover:text-parket-accent" title="Pagar com opções">
                      <Settings2 size={12} />
                    </button>
                  </>
                )}
                {baixado && isAdmin && (
                  <button onClick={() => setEstornando(l)}
                    className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Estornar">
                    <Undo2 size={12} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {selecionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-parket-panel border border-parket-borderHover rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3 z-40">
          <button onClick={() => setSelecionados(new Set())} className="p-1 rounded hover:bg-parket-panelLight text-parket-textDim">
            <X size={13} />
          </button>
          <div className="text-xs"><b className="text-parket-accent">{selecionados.size}</b> item(ns) · {fmtBRL(totalSel)}</div>
          <Select value={contaLote} onChange={(e) => setContaLote(e.target.value)} className="w-56">
            <option value="">— Conta destino —</option>
            {contasElegiveisLote.map((c) => (
              <option key={c.id} value={c.id}>{c.banco}{c.agencia ? ` · ${c.agencia}` : ""}{c.conta ? ` · CC ${c.conta}` : ""}</option>
            ))}
          </Select>
          <Button onClick={baixarLote} loading={proc} disabled={!contaLote}>
            <Wallet size={12} /> Pagar {selecionados.size}
          </Button>
        </div>
      )}

      <BaixarLancamentoModal open={!!baixando} lancamento={baixando}
        onClose={() => setBaixando(null)} onSaved={() => lan.reload()} />
      <EstornarLancamentoModal open={!!estornando} lancamento={estornando}
        onClose={() => setEstornando(null)} onSaved={() => lan.reload()} />
    </>
  );
}

/** Aba Compras: lê erp.pedidos_compra direto — cross-schema, sem sync. */
function ComprasTab({ statusF }: { statusF: typeof STATUS_FILTERS[number] }) {
  const [reload, setReload] = useState(0);
  const ci = useFetch(() => api.comprasItensPagamento(statusF), [statusF, reload]);
  const [detalhe, setDetalhe] = useState<string | null>(null); // card_id do card aberto
  const [busca, setBusca] = useState("");
  const [fornF, setFornF] = useState<string>(""); // "" = todos
  const [urgF, setUrgF] = useState<"todos"|"vencido"|"hoje"|"semana">("todos");
  const [valorMin, setValorMin] = useState<string>("");

  // Realtime: recarrega quando qualquer item de compra ou lançamento muda.
  useEffect(() => {
    const ch = supabase.channel("compras-pagamentos-live")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "compras_itens" }, () => setReload((x) => x + 1))
      .on("postgres_changes" as any, { event: "*", schema: "core",   table: "lancamentos"    }, () => setReload((x) => x + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const cards = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const it of (ci.data || [])) {
      const arr = map.get(it.card_id) || [];
      arr.push(it);
      map.set(it.card_id, arr);
    }
    const hojeIso = new Date().toISOString().slice(0, 10);
    return [...map.entries()].map(([cardId, itens]) => {
      const primeiro = itens[0];
      const totalCard = itens.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);
      // venc mais próximo de PARCELA ainda não paga (ou venc do item se sem parcela)
      const vencsAbertos = itens.flatMap((i: any) => {
        const parcs = (i.parcelas || []).filter((p: any) => !["pago", "conciliado", "recebido", "cancelado"].includes(p.status));
        if (parcs.length > 0) return parcs.map((p: any) => p.data_vencimento);
        return i.venc ? [i.venc] : [];
      }).filter(Boolean).sort();
      return { cardId, primeiro, itens, total: totalCard, venc: vencsAbertos[0] || null, vencsAbertos };
    }).filter((g) => {
      if (statusF === "futuros") return g.vencsAbertos.some((v: string) => v > hojeIso);
      if (statusF === "a_pagar") return g.vencsAbertos.some((v: string) => v <= hojeIso);
      return true;
    }).sort((a, b) => {
      // A vencer/vencidos primeiro; pagos por último
      if (!a.venc && b.venc) return 1;
      if (a.venc && !b.venc) return -1;
      if (!a.venc && !b.venc) return 0;
      return String(a.venc).localeCompare(String(b.venc));
    });
  }, [ci.data]);

  function statusVenc(venc: string | null) {
    if (!venc) return null;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const d = new Date(venc + "T12:00:00");
    const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
    if (dias < 0) return { label: `${Math.abs(dias)}d atraso`, cls: "text-parket-accent border-parket-accent" };
    if (dias === 0) return { label: "hoje", cls: "text-parket-text border-parket-text" };
    if (dias <= 7) return { label: `${dias}d`, cls: "text-parket-textDim border-parket-border" };
    return { label: `${dias}d`, cls: "text-parket-textDim border-parket-border" };
  }

  // Fornecedores únicos pro dropdown (nome do snapshot)
  const fornecedoresLista = useMemo(() => {
    const s = new Set<string>();
    for (const it of (ci.data || [])) {
      const n = it.forn_nome || it.fornecedor_nome_snapshot;
      if (n) s.add(n);
    }
    return [...s].sort();
  }, [ci.data]);

  // Aplica busca + filtro por fornecedor + urgência + valor mínimo
  const cardsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const hojeIso = new Date().toISOString().slice(0, 10);
    const vMin = parseFloat(valorMin.replace(",", ".")) || 0;
    return cards.filter((g) => {
      const p = g.primeiro;
      const forn = p.forn_nome || p.fornecedor_nome_snapshot || "";
      if (fornF && forn !== fornF) return false;
      if (vMin > 0 && g.total < vMin) return false;
      if (urgF !== "todos") {
        const vencs = g.vencsAbertos || [];
        if (urgF === "vencido" && !vencs.some((v: string) => v < hojeIso)) return false;
        if (urgF === "hoje" && !vencs.some((v: string) => v === hojeIso)) return false;
        if (urgF === "semana") {
          const semana = new Date(); semana.setDate(semana.getDate() + 7);
          const semanaIso = semana.toISOString().slice(0, 10);
          if (!vencs.some((v: string) => v > hojeIso && v <= semanaIso)) return false;
        }
      }
      if (!q) return true;
      const alvo = [p.obra, forn, p.solicitante, ...g.itens.map((i: any) => i.material)]
        .filter(Boolean).join(" ").toLowerCase();
      return alvo.includes(q);
    });
  }, [cards, busca, fornF, urgF, valorMin]);

  // KPIs: agrupa valores por urgência olhando as parcelas em aberto
  const kpis = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    let vencido = 0, deHoje = 0, semana = 0, total = 0;
    for (const g of cardsFiltrados) {
      for (const it of g.itens) {
        const parcs = (it.parcelas || []).filter((p: any) => !["pago", "conciliado", "recebido", "cancelado"].includes(p.status));
        for (const p of parcs) {
          const v = Number(p.valor || 0);
          total += v;
          if (p.data_vencimento < hoje) vencido += v;
          else if (p.data_vencimento === hoje) deHoje += v;
          else {
            const dias = Math.round((new Date(p.data_vencimento + "T12:00:00").getTime() - new Date(hoje + "T12:00:00").getTime()) / 86400000);
            if (dias <= 7) semana += v;
          }
        }
        // Item sem parcela mas ainda não pago
        if (parcs.length === 0 && it.status !== "pago" && it.venc) {
          const v = Number(it.valor || 0);
          total += v;
          if (it.venc < hoje) vencido += v;
          else if (it.venc === hoje) deHoje += v;
        }
      }
    }
    return { vencido, deHoje, semana, total };
  }, [cardsFiltrados]);

  const totalGeral = cardsFiltrados.reduce((s, c) => s + c.total, 0);
  const itensAbertos = detalhe ? cards.find((c) => c.cardId === detalhe)?.itens || [] : [];

  return (
    <>
      {/* KPIs resumo topo */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { lb: "Vencido", v: kpis.vencido, cls: "text-parket-accent border-parket-accent/40" },
          { lb: "Vence hoje", v: kpis.deHoje, cls: "text-parket-text border-parket-border" },
          { lb: "Próx. 7 dias", v: kpis.semana, cls: "text-parket-textDim border-parket-border" },
          { lb: "Total aberto", v: kpis.total, cls: "text-parket-accent border-parket-border" },
        ].map((k) => (
          <div key={k.lb} className={`bg-parket-panel border rounded-lg px-3 py-2 hover:border-parket-accent/40 transition-colors ${k.cls}`}>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-parket-textDim">{k.lb}</div>
            <div className="text-sm font-bold tabular-nums mt-0.5">{fmtBRL(k.v)}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar obra/fornecedor/material…"
          className="flex-1 min-w-40 bg-parket-panel border border-parket-border rounded px-2 py-1 text-[11px] text-parket-text placeholder:text-parket-textDim" />
        <select value={fornF} onChange={(e) => setFornF(e.target.value)}
          className="bg-parket-panel border border-parket-border rounded px-2 py-1 text-[11px] text-parket-text">
          <option value="">Todos fornecedores</option>
          {fornecedoresLista.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={urgF} onChange={(e) => setUrgF(e.target.value as any)}
          className="bg-parket-panel border border-parket-border rounded px-2 py-1 text-[11px] text-parket-text">
          <option value="todos">Qualquer prazo</option>
          <option value="vencido">Só vencidos</option>
          <option value="hoje">Só de hoje</option>
          <option value="semana">Próx. 7 dias</option>
        </select>
        <input value={valorMin} onChange={(e) => setValorMin(e.target.value)}
          placeholder="Valor ≥"
          className="w-24 bg-parket-panel border border-parket-border rounded px-2 py-1 text-[11px] text-parket-text placeholder:text-parket-textDim tabular-nums" />
      </div>

      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {cardsFiltrados.length} pedido(s) · {cardsFiltrados.reduce((s, c) => s + c.itens.length, 0)} item(ns) · <b className="text-parket-accent">{fmtBRL(totalGeral)}</b>
        <a href="https://compras.parket.works" target="_blank" rel="noreferrer"
          className="ml-auto text-parket-accent hover:underline inline-flex items-center gap-1">
          Abrir Compras <ExternalLink size={10} />
        </a>
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {ci.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!ci.loading && cards.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhum pedido nesse filtro.</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {cardsFiltrados.map((g) => {
            const p = g.primeiro;
            const forn = p.forn_nome || p.fornecedor_nome_snapshot || "Fornecedor —";
            const isPago = g.itens.every((i: any) => i.status === "pago");
            return (
              <li key={g.cardId}>
                <button onClick={() => setDetalhe(g.cardId)}
                  className="w-full px-5 py-3 flex items-center gap-3 hover:bg-parket-panelLight text-left">
                  <div className="flex flex-col w-24 shrink-0">
                    <div className="text-[10px] tabular-nums text-parket-textDim">{g.venc ? fmtDate(g.venc) : "—"}</div>
                    {(() => { const sv = statusVenc(g.venc); return sv ? (
                      <span className={`inline-block mt-0.5 px-1.5 py-0 rounded text-[9px] font-bold uppercase border ${sv.cls} w-fit`}>{sv.label}</span>
                    ) : null; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate text-parket-accent hover:underline">
                      {p.obra} — {forn}
                    </div>
                    <div className="text-[10px] text-parket-textDim truncate">
                      {g.itens.length} item(ns) · {p.forma_pagamento === "faturado" ? `Faturado ${p.prazo_faturamento_texto || p.prazo_faturamento_dias}d` : p.forma_pagamento === "avista" ? "À vista" : p.forma_pagamento}
                      {(() => { const tot = g.itens.reduce((s: number, i: any) => s + (i.parcelas?.length || 0), 0); return tot > g.itens.length ? ` · ${tot} parcelas` : ""; })()}
                      {p.solicitante && ` · ${p.solicitante}`}
                    </div>
                  </div>
                  <div className="text-xs font-semibold tabular-nums">{fmtBRL(g.total)}</div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase w-24 text-center border ${
                    isPago ? "border-parket-border text-parket-textDim" : "border-parket-accent text-parket-accent"
                  }`}>
                    {isPago ? "Pago" : "A pagar"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {detalhe && (
        <ComprasCardDetalheModal
          cardId={detalhe}
          itens={itensAbertos}
          onClose={() => setDetalhe(null)}
          onPago={() => { setReload((x) => x + 1); }}
        />
      )}
    </>
  );
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }); }}
      title={`Copiar ${label}`}
      className={`px-1 rounded border text-[8.5px] font-bold uppercase tracking-wider transition ${
        ok ? "border-parket-accent text-parket-accent" : "border-parket-border text-parket-textDim hover:text-parket-text hover:border-parket-textDim"
      }`}>{ok ? "✓" : "copiar"}</button>
  );
}

function ComprasCardDetalheModal({ cardId, itens, onClose, onPago }: {
  cardId: string; itens: any[]; onClose: () => void; onPago: () => void;
}) {
  const primeiro = itens[0];
  const [pagando, setPagando] = useState<string | null>(null);
  const [batchSel, setBatchSel] = useState<Record<string, boolean>>({});
  const totalCard = itens.reduce((s, i) => s + Number(i.valor || 0), 0);

  // Timeline: primeira data de solicitação → aprovação → boleto anexado → pago
  const timeline = useMemo(() => {
    const parcs = itens.flatMap((i) => i.parcelas || []);
    const solicitado = itens.map((i) => i.created_at || i.aprovado_em).filter(Boolean).sort()[0];
    const aprovado = itens.map((i) => i.aprovado_em).filter(Boolean).sort()[0];
    const primeiroBoleto = parcs.map((p) => p.boleto_url ? p.data_vencimento : null).filter(Boolean).sort()[0];
    const primeiroPago = parcs.map((p) => ["pago", "conciliado", "recebido"].includes(p.status) ? p.data_pagamento : null).filter(Boolean).sort()[0];
    const totalParc = parcs.length;
    const parcPagas = parcs.filter((p: any) => ["pago", "conciliado", "recebido"].includes(p.status)).length;
    return [
      { lb: "Solicitado", d: solicitado, done: !!solicitado },
      { lb: "Aprovado", d: aprovado, done: !!aprovado },
      { lb: "Boleto", d: primeiroBoleto, done: !!primeiroBoleto },
      { lb: `Pago${totalParc > 1 ? ` (${parcPagas}/${totalParc})` : ""}`, d: primeiroPago, done: parcPagas === totalParc && totalParc > 0 },
    ];
  }, [itens]);

  const parcelasAbertas = useMemo(() =>
    itens.flatMap((i) => (i.parcelas || []).filter((p: any) => !["pago", "conciliado", "recebido", "cancelado"].includes(p.status) && !p.comprovante_url)),
  [itens]);
  const batchTotal = parcelasAbertas.filter((p: any) => batchSel[p.id]).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
  const batchCount = parcelasAbertas.filter((p: any) => batchSel[p.id]).length;

  async function batchPagarComUpload() {
    const ids = parcelasAbertas.filter((p: any) => batchSel[p.id]).map((p: any) => p.id);
    if (!ids.length) return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/pdf,image/*";
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      setPagando("batch");
      try {
        const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
        const path = `${cardId}/lote-${Date.now()}.${ext}`;
        const url = await uploadCloud("compras-comprovantes", path, f);
        for (const id of ids) {
          await api.pagarLancamentoCompra(id, url, f.name);
        }
        toast.success(`${ids.length} parcelas pagas com 1 comprovante`);
        setBatchSel({}); onPago();
      } catch (e: any) { toast.error(e?.message || "Falha no batch"); }
      finally { setPagando(null); }
    };
    input.click();
  }

  async function uploadArquivo(bucket: string, prefixo: string, f: File): Promise<string> {
    const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${cardId}/${prefixo}-${Date.now()}.${ext}`;
    return uploadCloud(bucket, path, f);
  }
  function pickFile(cb: (f: File) => void) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/pdf,image/*";
    input.onchange = () => { const f = input.files?.[0]; if (f) cb(f); };
    input.click();
  }
  const pagarParcela = (parcela: any) => pickFile(async (f) => {
    setPagando(parcela.id);
    try {
      const url = await uploadArquivo("compras-comprovantes", `pgto-${parcela.id}`, f);
      await api.pagarLancamentoCompra(parcela.id, url, f.name);
      toast.success("Parcela paga com comprovante");
      onPago();
    } catch (e: any) { toast.error(e?.message || "Falha ao pagar"); }
    finally { setPagando(null); }
  });

  const removerComprovante = async (parcela: any) => {
    if (!confirm("Remover comprovante? A parcela voltará como não paga.")) return;
    setPagando(`rc-${parcela.id}`);
    try {
      await api.removerComprovanteLancamento(parcela.id);
      toast.success("Comprovante removido");
      onPago();
    } catch (e: any) { toast.error(e?.message || "Falha ao remover comprovante"); }
    finally { setPagando(null); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="border border-parket-accent/35 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto relative shadow-2xl shadow-black/60"
        style={{ background: "linear-gradient(165deg, rgba(150,132,115,0.16) 0%, rgba(150,132,115,0.05) 34%, rgba(150,132,115,0.02) 100%), var(--parket-bg)" }}
        onClick={(e) => e.stopPropagation()}>
        {batchCount > 0 && (
          <div className="sticky top-0 z-10 bg-parket-accent text-parket-bg px-4 py-2 flex items-center gap-3 shadow-lg">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {batchCount} parcela(s) selecionada(s) · {fmtBRL(batchTotal)}
            </span>
            <button onClick={() => setBatchSel({})}
              className="ml-auto text-[10px] uppercase tracking-wider font-bold hover:underline">Limpar</button>
            <button onClick={batchPagarComUpload} disabled={pagando === "batch"}
              className="px-3 py-1 bg-parket-bg text-parket-accent rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-50">
              {pagando === "batch" ? <Loader2 size={10} className="animate-spin inline" /> : "Pagar todas com 1 comprovante"}
            </button>
          </div>
        )}
        <div className="px-6 py-5 border-b border-parket-accent/25 flex items-start gap-3">
          <div className="flex-1">
            <div className="text-[9px] uppercase tracking-[0.22em] text-parket-accent font-bold">Obra</div>
            <div className="text-xl text-parket-text mt-0.5" style={{ fontFamily: "Cinzel, serif", letterSpacing: "0.04em" }}>{primeiro.obra}</div>
            <div className="w-10 h-px bg-parket-accent/60 my-2" />
            <div className="text-[11px] text-parket-textDim">
              {itens.length} item(ns) · Total <span className="text-parket-accent font-semibold tabular-nums">{fmtBRL(totalCard)}</span>
              {primeiro.solicitante && ` · Solicitou: ${primeiro.solicitante}`}
              {primeiro.setor && ` · ${primeiro.setor}`}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-parket-panelLight text-parket-textDim"><X size={16} /></button>
        </div>

        {/* Timeline visual: solicitado → aprovado → boleto → pago */}
        <div className="px-5 py-3 border-b border-parket-border">
          <div className="flex items-center gap-1">
            {timeline.map((et, i) => (
              <div key={et.lb} className="flex items-center gap-1 flex-1">
                <div className={`flex-1 flex items-center gap-1.5 ${et.done ? "" : "opacity-50"}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${et.done ? "bg-parket-accent ring-2 ring-parket-accent/25" : "bg-parket-border"}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[9px] uppercase tracking-wider font-bold ${et.done ? "text-parket-text" : "text-parket-textDim"}`}>{et.lb}</div>
                    {et.d && <div className="text-[9px] text-parket-textDim tabular-nums">{fmtDate(String(et.d).slice(0, 10))}</div>}
                  </div>
                </div>
                {i < timeline.length - 1 && <div className={`h-px w-3 ${timeline[i + 1].done ? "bg-parket-accent" : "bg-parket-border"}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-b border-parket-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[9px] uppercase tracking-[0.2em] text-parket-accent font-bold">Fornecedor</div>
            {primeiro.forn_snap_em && (
              <span title={`Dados congelados em ${new Date(primeiro.forn_snap_em).toLocaleDateString("pt-BR")}`}
                className="text-[8.5px] px-1 py-0 rounded border border-parket-border text-parket-textDim uppercase tracking-wider">Snap</span>
            )}
          </div>
          <div className="text-xs font-semibold text-parket-text">{primeiro.forn_nome || primeiro.fornecedor_nome_snapshot || "—"}</div>
          {primeiro.forn_cnpj && (
            <div className="text-[10.5px] text-parket-textDim flex items-center gap-1">
              CNPJ {primeiro.forn_cnpj}
              <CopyBtn value={primeiro.forn_cnpj} label="CNPJ" />
              {primeiro.forn_razao && primeiro.forn_razao !== primeiro.forn_nome ? <> · {primeiro.forn_razao}</> : null}
            </div>
          )}
          <div className="text-[10.5px] text-parket-text mt-1 space-y-0.5">
            {primeiro.forn_pix && (
              <div className="flex items-center gap-1">
                <span className="text-parket-textDim">PIX:</span>
                <span className="font-semibold">{primeiro.forn_pix}</span>
                <CopyBtn value={primeiro.forn_pix} label="PIX" />
              </div>
            )}
            {(primeiro.forn_banco || primeiro.forn_agencia || primeiro.forn_conta) && (
              <div className="flex items-center gap-1">
                <span className="text-parket-textDim">Banco:</span> {primeiro.forn_banco || "—"} · Ag {primeiro.forn_agencia || "—"} · CC {primeiro.forn_conta || "—"}
                <CopyBtn value={`${primeiro.forn_banco || ""} Ag ${primeiro.forn_agencia || ""} CC ${primeiro.forn_conta || ""}`.trim()} label="Banco" />
              </div>
            )}
            {(primeiro.forn_telefone || primeiro.forn_email) && (
              <div className="text-parket-textDim">
                {primeiro.forn_telefone && <>Tel {primeiro.forn_telefone}</>}
                {primeiro.forn_telefone && primeiro.forn_email && " · "}
                {primeiro.forn_email && <>{primeiro.forn_email}</>}
              </div>
            )}
          </div>
        </div>

        {primeiro.dados_pagto_obs && (
          <div className="px-5 py-3 border-b border-parket-border">
            <div className="text-[9px] uppercase tracking-[0.2em] text-parket-accent font-bold mb-1">Dados de pagamento (Compras)</div>
            <div className="text-[11px] text-parket-text whitespace-pre-wrap leading-relaxed">{primeiro.dados_pagto_obs}</div>
          </div>
        )}

        {Array.isArray(primeiro.chat_messages) && primeiro.chat_messages.length > 0 && (
          <details className="px-5 py-2 border-b border-parket-border">
            <summary className="text-[9px] uppercase tracking-[0.2em] text-parket-accent font-bold cursor-pointer">
              Comentários do Compras ({primeiro.chat_messages.length})
            </summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {primeiro.chat_messages.slice(-8).map((m: any, i: number) => (
                <div key={m.id || i} className="text-[10.5px] text-parket-text">
                  <span className="font-semibold">{m.user || m.user_id || "—"}</span>
                  <span className="text-parket-textDim ml-2 text-[9.5px]">{m.ts ? new Date(m.ts).toLocaleString("pt-BR") : ""}</span>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.msg}</div>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="px-5 py-3">
          <div className="mb-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-parket-accent font-bold">Itens</div>
          </div>
          <ul className="flex flex-col gap-2">
            {itens.map((it) => {
              const parcelas: any[] = it.parcelas || [];
              const nParc = parcelas.length;
              return (
              <li key={it.id} className="border border-parket-border rounded-lg p-3.5 bg-parket-panel hover:border-parket-accent/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-parket-text">
                      <span className="text-[9.5px] text-parket-textDim mr-1.5">#{it.seq}</span>{it.material}
                    </div>
                    <div className="text-[10px] text-parket-textDim mt-0.5 flex flex-wrap gap-2">
                      {it.quantidade && <span>Qtd: {it.quantidade}</span>}
                      {it.forma_pagamento === "faturado" && <span>Faturado {it.prazo_faturamento_texto || it.prazo_faturamento_dias}d</span>}
                      {nParc > 1 && <span>{nParc} parcelas</span>}
                    </div>
                    {it.justificativa && (
                      <div className="text-[10px] text-parket-textDim mt-1">
                        <span className="uppercase tracking-wider text-[9px] mr-1">Justificativa:</span>
                        <span className="text-parket-text">{it.justificativa}</span>
                      </div>
                    )}
                    {Array.isArray(it.orcamentos) && it.orcamentos.length > 0 && (
                      <div className="text-[9.5px] text-parket-textDim mt-1">
                        Orçamentos: {it.orcamentos.map((o: any, i: number) => (
                          <a key={i} href={o.arquivo_url} target="_blank" rel="noreferrer" className="text-parket-accent hover:underline mr-2">
                            {o.arquivo_nome || "PDF"}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums text-parket-text">{fmtBRL(it.valor)}</div>
                  </div>
                </div>

                {nParc > 0 && (
                  <div className="mt-3 pt-2 border-t border-parket-border">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-parket-accent font-bold mb-1">
                      {nParc === 1 ? "Boleto" : `Parcelas (${nParc})`}
                    </div>
                    <ul className="flex flex-col gap-2">
                      {parcelas.map((p, i) => {
                        const isPaga = ["pago", "conciliado", "recebido"].includes(p.status);
                        const hojeIso = new Date().toISOString().slice(0,10);
                        const isVencida = !isPaga && p.data_vencimento < hojeIso;
                        const isHoje = !isPaga && p.data_vencimento === hojeIso;
                        const podeSel = !isPaga && !p.comprovante_url;
                        return (
                          <li key={p.id} className={`flex flex-col gap-1 text-[11px] py-1.5 border-b border-parket-border/40 last:border-0 ${isVencida ? "bg-parket-accent/5 px-1 -mx-1 rounded" : ""}`}>
                            <div className="flex items-center gap-2">
                              {podeSel && (
                                <input type="checkbox" checked={!!batchSel[p.id]}
                                  onChange={(e) => setBatchSel((s) => ({ ...s, [p.id]: e.target.checked }))}
                                  title="Selecionar pra pagar em lote com 1 comprovante"
                                  className="w-3 h-3 shrink-0" />
                              )}
                              <span className="text-parket-textDim tabular-nums w-10 font-bold">{nParc > 1 ? `${i+1}/${nParc}` : ""}</span>
                              <span className={isVencida ? "text-parket-accent font-bold" : isHoje ? "text-parket-text font-bold" : "text-parket-textDim"}>
                                Venc {fmtDate(p.data_vencimento)}{isVencida ? " · vencida" : isHoje ? " · hoje" : ""}
                              </span>
                              <span className="tabular-nums text-parket-text font-semibold ml-auto">{fmtBRL(p.valor)}</span>
                              {isPaga && (
                                <span className="text-[10px] uppercase tracking-wider text-parket-textDim font-bold">
                                  Pago {p.data_pagamento ? fmtDate(p.data_pagamento) : ""}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-10 flex-wrap">
                              {p.boleto_url ? (
                                <a href={p.boleto_url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-parket-accent hover:underline">
                                  <Paperclip size={11} /> {p.boleto_nome || "boleto"}
                                </a>
                              ) : !isPaga && (
                                <span className="text-[10px] text-parket-textDim italic">Aguardando boleto do Compras</span>
                              )}
                              {p.comprovante_url && (
                                <span className="inline-flex items-center gap-0.5">
                                  <a href={p.comprovante_url} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-parket-accent hover:underline">
                                    <Receipt size={11} /> {p.comprovante_nome || "comprovante"}
                                  </a>
                                  <button onClick={() => removerComprovante(p)} disabled={!!pagando}
                                    title="Remover comprovante (parcela volta a não paga)"
                                    className="px-1 rounded text-parket-textDim hover:text-red-400 text-[11px] leading-none disabled:opacity-30">
                                    {pagando === `rc-${p.id}` ? <Loader2 size={9} className="animate-spin inline" /> : "×"}
                                  </button>
                                </span>
                              )}
                              {!isPaga && (
                                <button onClick={() => pagarParcela(p)} disabled={!!pagando}
                                  className="ml-auto px-2 py-1 rounded border border-parket-accent text-parket-accent hover:bg-parket-accent hover:text-parket-bg text-[10px] font-bold uppercase tracking-wider disabled:opacity-30">
                                  {pagando === p.id ? <Loader2 size={10} className="animate-spin inline" /> : "Marcar pago"}
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );})}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Aba Prestadores: lê public.prestadores_pagamentos direto. */
function PrestadoresTab({ statusF }: { statusF: typeof STATUS_FILTERS[number] }) {
  const pp = useFetch(() => api.prestadoresPagamentos(), []);
  const os = useFetch(() => api.prestadoresObraServicos(), []);

  const rows = useMemo(() => {
    if (!pp.data) return [];
    return pp.data
      .filter((r) => {
        if (statusF === "a_pagar") return r.status === "pendente";
        if (statusF === "pagos")   return r.status === "pago";
        return true;
      })
      .sort((a, b) => (b.data_pagamento || "").localeCompare(a.data_pagamento || ""));
  }, [pp.data, statusF]);

  const osById = new Map((os.data || []).map((s) => [s.id, s]));
  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <>
      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {rows.length} pagamento(s) · <b className="text-parket-accent">{fmtBRL(total)}</b>
        <a href="https://dashboard.parket.works" target="_blank" rel="noreferrer"
          className="ml-auto text-parket-accent hover:underline inline-flex items-center gap-1">
          Abrir Prestadores <ExternalLink size={10} />
        </a>
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {pp.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!pp.loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nenhum pagamento a prestador nesse filtro.</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((r) => {
            const serv = osById.get(r.servico_id);
            return (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-[10px] tabular-nums text-parket-textDim w-20">{r.data_pagamento ? fmtDate(r.data_pagamento) : "—"}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{r.prestador_nome}</div>
                  <div className="text-[10px] text-parket-textDim truncate">
                    {serv && `Obra ${serv.obra_id} · ${serv.descricao}`}
                    {` · ${r.periodo}${r.qtd ? ` · ${r.qtd}` : ""}`}
                  </div>
                </div>
                <div className="text-xs font-semibold tabular-nums">{fmtBRL(r.valor)}</div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase w-20 text-center ${
                  r.status === "pago" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                }`}>{r.status}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/** Aba Terceiros (task #2060): Custos de Terceiros aprovados na aba
 *  Aprovações caem aqui pra pagar. Fonte = API do gestão
 *  (gestao.parket.works/api/custos); pagar grava o write-back em
 *  core.lancamentos e o comprovante sobe pro gestão, então a tela
 *  gestao.parket.works/custos reflete na hora (mesma tabela). */
function CustosTab({ statusF }: { statusF: typeof STATUS_FILTERS[number] }) {
  // reload manual: incrementa depois de pagar pra refazer as 2 buscas
  const [reload, setReload] = useState(0);
  const aprov = useFetch(() => api.custosAprovados(), [reload]);
  const pagos = useFetch(() => api.custosPagos(), [reload]);
  const [proc, setProc] = useState<string | null>(null);

  const rows = useMemo(() => {
    const a = aprov.data?.items || [];
    const p = pagos.data?.items || [];
    if (statusF === "a_pagar") return a;
    if (statusF === "pagos") return p;
    if (statusF === "todos") return [...a, ...p];
    return []; // "futuros" não se aplica: custo aprovado já está liberado pra pagar
  }, [aprov.data, pagos.data, statusF]);

  // Pagar com comprovante: escolhe o arquivo ANTES, aí marca pago (write-back
  // no core.lancamentos) e sobe o comprovante — o endpoint exige status pago,
  // então a ordem das 2 chamadas importa.
  function pagar(l: CustoLancResumo) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/pdf,image/*";
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      setProc(l.id);
      try {
        await api.custosStatus(l.id, "pago");
        await api.custosComprovante(l.id, f);
        toast.success(`${l.numero} pago com comprovante`);
      } catch (e: any) { toast.error(e?.message || "Falha ao pagar"); }
      finally { setProc(null); setReload((n) => n + 1); }
    };
    input.click();
  }

  // O resumo da lista não traz comprovante_url: busca o detalhe e abre.
  async function verComprovante(l: CustoLancResumo) {
    setProc(`comp-${l.id}`);
    try {
      const d = await api.custosDetalhe(l.id);
      const url = (d.lancamento as any).comprovante_url;
      if (url) window.open(url, "_blank", "noopener");
      else toast.error("Lançamento pago sem comprovante anexado");
    } catch (e: any) { toast.error(e?.message || "Falha ao buscar comprovante"); }
    finally { setProc(null); }
  }

  const loading = aprov.loading || pagos.loading;
  // A pagar mostra o saldo (aprovado menos adiantamento); pago mostra o que saiu.
  const total = rows.reduce((s, r) => s + (r.status === "pago" ? r.total_aprovado_cent : r.saldo_cent) / 100, 0);

  return (
    <>
      <div className="text-[10px] text-parket-textDim flex items-center gap-2">
        {rows.length} lançamento(s) · <b className="text-parket-accent">{fmtBRL(total)}</b>
        <a href="https://gestao.parket.works/custos" target="_blank" rel="noreferrer"
          className="ml-auto text-parket-accent hover:underline inline-flex items-center gap-1">
          Abrir Gestão <ExternalLink size={10} />
        </a>
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
        {!loading && rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">
            {statusF === "futuros" ? "Custos aprovados já estão liberados pra pagar: use A PAGAR." : "Nenhum custo de terceiro nesse filtro."}
          </div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((l) => (
            <li key={l.id} className="px-5 py-3 flex items-center gap-3">
              <span className="text-[10px] font-bold tabular-nums text-parket-accent w-20 shrink-0">{l.numero}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{l.cliente || l.projeto_id}</div>
                <div className="text-[10px] text-parket-textDim truncate">
                  {l.prestador_nome || "Prestador"}
                  {l.motivo ? ` · ${l.motivo}` : ""}
                  {l.data_ida ? ` · ${fmtDate(l.data_ida)}${l.data_volta ? ` a ${fmtDate(l.data_volta)}` : ""}` : ""}
                  {l.centro_custo_nome ? ` · CC ${l.centro_custo_nome}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold tabular-nums">{fmtBRL((l.status === "pago" ? l.total_aprovado_cent : l.saldo_cent) / 100)}</div>
                {l.adiantamento_cent > 0 && (
                  <div className="text-[9px] text-parket-textDim tabular-nums">adiant. {fmtBRL(l.adiantamento_cent / 100)}</div>
                )}
              </div>
              <button onClick={() => api.custosOpPdf(l.id, l.numero).catch((e: any) => toast.error(e?.message || "Falha no PDF"))}
                title="Ordem de pagamento em PDF"
                className="p-1.5 rounded hover:bg-parket-panelLight text-parket-textDim shrink-0"><FileText size={13} /></button>
              {l.status === "aprovado" ? (
                <button onClick={() => pagar(l)} disabled={proc === l.id}
                  className="px-3 py-1.5 bg-parket-accent text-parket-bg rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 shrink-0">
                  {proc === l.id ? <Loader2 size={11} className="animate-spin inline" /> : "Pagar"}
                </button>
              ) : (
                <button onClick={() => verComprovante(l)} disabled={proc === `comp-${l.id}`}
                  className="px-3 py-1.5 bg-emerald-500/15 text-emerald-300 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 disabled:opacity-50 shrink-0">
                  {proc === `comp-${l.id}` ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />} Comprovante
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
