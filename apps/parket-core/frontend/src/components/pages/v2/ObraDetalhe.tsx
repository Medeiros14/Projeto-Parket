/**
 * Obra detalhe v2 (task #1669) — a tela-mãe do Core no visual Nubank.
 *
 * Resumo financeiro + tabs (Recebimentos / Pagamentos / Aditivos).
 * Cada tab lista os lançamentos daquela obra por categoria. Aditivo abre
 * modal simples pra adicionar novo (dispara trigger de liberação proporcional
 * recalcular no server automaticamente).
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, ArrowDownToLine, ArrowUpFromLine, FilePlus, Trash2, Loader2, Settings, FileText, Download } from "lucide-react";
import { api, useFetch, type Lancamento, type ObraAditivo } from "../../../lib/api";
import { fmtBRL, fmtDate, colorByStatus, obraCodigo } from "../../../lib/format";
import { Button, Field, Input, Textarea, FormGrid } from "../../ui/Form";
import { Modal, ConfirmDialog } from "../../ui/Modal";
import { BaixarLancamentoModal } from "../../forms/BaixarLancamentoModal";
import { LancamentoDetalheModal } from "../../forms/LancamentoDetalheModal";
import { ConfigObraModal } from "../../forms/ConfigObraModal";
import { toast } from "../../../lib/toast";
import { useAuth } from "../../../lib/auth";

type Tab = "recebimentos" | "pagamentos" | "aditivos" | "notas";

// NFe emitida vinculada à obra (vem do parket-nfe via /api/fiscal/notas-por-core-obra).
// Cada linha representa uma NF-e autorizada pela SEFAZ que o Ronaldo Fiscal subiu.
type FiscalNota = {
  ch_nfe: string;
  numero: number;
  serie: number;
  dh_emissao: string;
  dest_nome: string;
  dest_cnpj_cpf: string;
  valor_nf: number;
  status_vinculo: "vinculado" | "pendente";
  emit_nome: string;
  uploaded_at: string;
};

/** Fetch das NFs vinculadas à obra do Core via proxy /api/fiscal/*.
 *  Resolve core.obras.id → gestao.projetos.id no backend do gestão API. */
function useFiscalNotas(coreObraId: string) {
  const [data, setData] = useState<{ notas: FiscalNota[]; total_valor: number; total_qtd: number } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/fiscal/notas-por-core-obra/${coreObraId}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setData(j); })
      .catch(() => { if (alive) setData({ notas: [], total_valor: 0, total_qtd: 0 }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [coreObraId]);
  return { data, loading };
}

export function ObraDetalhePage() {
  const { id = "" } = useParams();
  const auth = useAuth();
  const isAdmin = auth.appUser?.role === "admin";
  const resumo = useFetch(() => api.obraResumo(id), [id]);
  const pa = useFetch(() => api.parceiros(), []);
  const lan = useFetch(() => api.lancamentos(5000), []);
  const adi = useFetch(() => api.aditivosPorObra(id), [id]);

  const [tab, setTab] = useState<Tab>("recebimentos");
  // NFs emitidas pelo Fiscal (parket-nfe) vinculadas a essa obra.
  const nfs = useFiscalNotas(id);
  const [aditivoOpen, setAditivoOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [baixando, setBaixando] = useState<Lancamento | null>(null);
  // Parcela aberta no modal de detalhe (clique na linha, Will 28/08 #1940).
  const [detalhe, setDetalhe] = useState<Lancamento | null>(null);
  const [confirmDel, setConfirmDel] = useState<ObraAditivo | null>(null);

  const cliente = useMemo(() => {
    if (!pa.data || !resumo.data?.cliente_id) return null;
    return pa.data.find((p) => p.id === resumo.data!.cliente_id) || null;
  }, [pa.data, resumo.data]);
  const vendedor = useMemo(() => {
    if (!pa.data || !resumo.data?.vendedor_id) return null;
    return pa.data.find((p) => p.id === resumo.data!.vendedor_id) || null;
  }, [pa.data, resumo.data]);
  const arquiteto = useMemo(() => {
    if (!pa.data || !resumo.data?.arquiteto_id) return null;
    return pa.data.find((p) => p.id === resumo.data!.arquiteto_id) || null;
  }, [pa.data, resumo.data]);

  const lancObra = useMemo(() => (lan.data || []).filter((l) => l.obra_id === id), [lan.data, id]);
  const entradas = lancObra.filter((l) => l.tipo === "entrada");
  const saidas = lancObra.filter((l) => l.tipo === "saida");

  if (resumo.loading) return <div className="p-10 text-parket-textDim text-xs">Carregando obra…</div>;
  if (!resumo.data) return <div className="p-10 text-xs">Obra não encontrada.</div>;
  const r = resumo.data;
  const pct = Math.min(1, Math.max(0, Number(r.pct_pago) || 0));

  // Cálculos: imposto, RT total, comissão total (baseline)
  const imposto = Number(r.venda_total) * Number(r.imposto_pct) / 100;
  const rtTotal = Number(r.venda_total) * (1 - Number(r.imposto_pct) / 100) * (Number(r.rt_percentual || 0) / 100);
  const comissaoTotal = Number(r.venda_total) * (Number(r.comissao_pct || 0) / 100);
  const custoRealizado = Number(r.custo_realizado);
  const custoComprometido = Number(r.custo_comprometido ?? r.custo_realizado);
  const margemPrev = Number(r.venda_total) - imposto - rtTotal - comissaoTotal;
  // Margem realizada agora usa comprometido — reflete gasto assumido (compras aprovadas)
  // não só o que já foi baixado no banco.
  const margem = Number(r.venda_total) - custoComprometido;

  // Barras de progresso (Will 28/08): o que FALTA, não só o que já entrou.
  // 1. Falta receber do cliente (o principal).
  const faltaReceber = Math.max(0, Number(r.venda_total) - Number(r.entradas_recebidas));
  // 2. Gate do RT/comissão: no threshold, alvo = venda_total × threshold%;
  //    o que falta é a diferença entre o alvo e o já recebido.
  const alvoGateRT = Number(r.venda_total) * (Number(r.rt_threshold_pct) || 50) / 100;
  const pctGateRT = alvoGateRT > 0 ? Math.min(1, Number(r.entradas_recebidas) / alvoGateRT) : 0;
  const faltaGateRT = Math.max(0, alvoGateRT - Number(r.entradas_recebidas));
  //    No proporcional não existe gate: RT+comissão liberam junto com o pago.
  const liberadoProporcional = pct * (rtTotal + comissaoTotal);
  // 3. Ponto de lucro: recebido precisa cobrir custos previstos totais
  //    (gasto comprometido + imposto + RT + comissão). Cruza = obra no lucro.
  const custoTotalPrevisto = custoComprometido + imposto + rtTotal + comissaoTotal;
  const pctLucro = custoTotalPrevisto > 0
    ? Math.min(1, Number(r.entradas_recebidas) / custoTotalPrevisto) : 1;
  const faltaLucro = Math.max(0, custoTotalPrevisto - Number(r.entradas_recebidas));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/obras" className="text-[10px] uppercase tracking-wider text-parket-textDim hover:text-parket-text flex items-center gap-1">
            <ArrowLeft size={11} /> Obras
          </Link>
          <h1 className="text-xl font-bold mt-1">{r.nome}</h1>
          <div className="text-[11px] text-parket-textDim mt-1 flex flex-wrap gap-x-4">
            {obraCodigo(r.codigo) && <span>{obraCodigo(r.codigo)}</span>}
            {cliente && <span>Cliente: <b className="text-parket-text">{cliente.nome}</b></span>}
            {vendedor && <span>Vendedor: <b className="text-parket-text">{vendedor.nome}</b>{r.comissao_pct != null && ` (${r.comissao_pct}%)`}</span>}
            {arquiteto && <span>Arquiteto: <b className="text-parket-text">{arquiteto.nome}</b>{r.rt_percentual != null && ` (RT ${r.rt_percentual}%)`}</span>}
          </div>
        </div>
        <Button variant="outline" onClick={() => setConfigOpen(true)}>
          <Settings size={12} /> Configurar
        </Button>
      </div>

      {/* Barras de progresso (Will 28/08): não só "pago pelo cliente" — o
          principal é QUANTO FALTA receber, depois quanto falta pra LIBERAR
          o RT/comissão (gate ou proporcional) e quanto falta pro PONTO DE
          LUCRO (recebido cobrir todos os custos previstos da obra). */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Falta receber: a barra segue o pago, mas o número em destaque
            é o que ainda falta entrar (é o que o financeiro cobra). */}
        <BarraProgresso
          label="Falta receber"
          destaque={faltaReceber > 0 ? fmtBRL(faltaReceber) : "Quitado"}
          pct={pct}
          pctLabel={`${(pct * 100).toFixed(1)}% pago`}
          cor={faltaReceber > 0 ? "accent" : "ok"}
          foot={`${fmtBRL(r.entradas_recebidas)} recebidos de ${fmtBRL(r.venda_total)}`}
        />
        {/* 2. Liberação de RT/comissão: com gate (threshold) mostra quanto
            falta receber pra bater o gatilho; no proporcional mostra quanto
            de RT+comissão já está liberado pelo recebido. */}
        {r.regra_liberacao === "threshold_50" ? (
          <BarraProgresso
            label={`Liberar RT/comissão (gate ${r.rt_threshold_pct}%)`}
            destaque={faltaGateRT > 0 ? fmtBRL(faltaGateRT) : "Liberado"}
            pct={pctGateRT}
            pctLabel={`${(pctGateRT * 100).toFixed(1)}%`}
            cor={faltaGateRT > 0 ? "accent" : "ok"}
            foot={faltaGateRT > 0
              ? `falta receber até ${fmtBRL(alvoGateRT)} pra liberar ${fmtBRL(rtTotal + comissaoTotal)}`
              : `gate atingido: ${fmtBRL(rtTotal + comissaoTotal)} de RT/comissão liberados`}
          />
        ) : (
          <BarraProgresso
            label="RT/comissão liberados"
            destaque={fmtBRL(liberadoProporcional)}
            pct={pct}
            pctLabel={`${(pct * 100).toFixed(1)}%`}
            cor="accent"
            foot={`de ${fmtBRL(rtTotal + comissaoTotal)} totais · proporcional ao recebido`}
          />
        )}
        {/* 3. Ponto de lucro: obra "dá lucro" quando o recebido cobre TODOS
            os custos previstos (gasto comprometido + imposto + RT + comissão).
            Antes disso mostra quanto falta receber pra cruzar o equilíbrio. */}
        <BarraProgresso
          label="Ponto de lucro"
          destaque={faltaLucro > 0 ? fmtBRL(faltaLucro) : `+${fmtBRL(Number(r.entradas_recebidas) - custoTotalPrevisto)}`}
          pct={pctLucro}
          pctLabel={faltaLucro > 0 ? `${(pctLucro * 100).toFixed(1)}%` : "No lucro"}
          cor={faltaLucro > 0 ? "accent" : "ok"}
          foot={faltaLucro > 0
            ? `falta receber pra cobrir ${fmtBRL(custoTotalPrevisto)} de custos previstos`
            : `recebido já cobre os ${fmtBRL(custoTotalPrevisto)} de custos previstos`}
        />
      </div>

      {/* Resumo financeiro */}
      <div className="bg-parket-panel border border-parket-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-4">Resumo financeiro</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-xs">
          <ResumoLinha label="Venda contratada" value={fmtBRL(r.venda_contrato)} />
          {Number(r.valor_aditivos) > 0 && (
            <ResumoLinha label={`+ Aditivos`} value={fmtBRL(r.valor_aditivos)} accent />
          )}
          <ResumoLinha label="═ Venda total" value={fmtBRL(r.venda_total)} bold />
          <div className="col-span-2 border-t border-parket-border/50 my-1" />
          <ResumoLinha label="Recebido" value={fmtBRL(r.entradas_recebidas)} sub={`${(pct * 100).toFixed(0)}%`} />
          <ResumoLinha label="A receber" value={fmtBRL(Number(r.venda_total) - Number(r.entradas_recebidas))} />
          <div className="col-span-2 border-t border-parket-border/50 my-1" />
          <ResumoLinha label={`Imposto ${r.imposto_pct}%`} value={fmtBRL(imposto)} neg />
          <ResumoLinha label={`RT arquiteto${r.rt_percentual ? ` (${r.rt_percentual}%)` : ""}`} value={fmtBRL(rtTotal)} neg />
          <ResumoLinha label={`Comissão${r.comissao_pct ? ` (${r.comissao_pct}%)` : ""}`} value={fmtBRL(comissaoTotal)} neg />
          <ResumoLinha label="Gasto (comprometido)" value={fmtBRL(custoComprometido)} neg
             sub={custoRealizado < custoComprometido ? `${fmtBRL(custoRealizado)} já pago` : undefined} />
          <div className="col-span-2 border-t border-parket-border/50 my-1" />
          <ResumoLinha label="Margem prevista" value={fmtBRL(margemPrev)} bold />
          <ResumoLinha label="Margem realizada" value={fmtBRL(margem)} bold accent={margem >= 0} danger={margem < 0} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-parket-panel border border-parket-border rounded-lg p-1 w-fit">
        {(["recebimentos", "pagamentos", "aditivos", "notas"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-[11px] uppercase tracking-wider font-bold transition flex items-center gap-1.5 ${
              tab === t ? "bg-parket-accent text-parket-bg" : "text-parket-textDim hover:text-parket-text"
            }`}>
            {t === "notas" ? "NF-e" : t}
            {t === "notas" && nfs.data && nfs.data.total_qtd > 0 && (
              <span className={`text-[9px] tabular-nums px-1.5 py-0.5 rounded-full ${
                tab === "notas" ? "bg-parket-bg/25 text-parket-bg" : "bg-parket-accent/20 text-parket-accent"
              }`}>{nfs.data.total_qtd}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "recebimentos" && (
        <TabList title="Parcelas do cliente" icon={ArrowDownToLine} rows={entradas}>
          {(l) => <LancRow l={l} pa={pa.data || []} onAbrir={() => setDetalhe(l)} />}
        </TabList>
      )}
      {tab === "pagamentos" && (
        <TabList title="Saídas" icon={ArrowUpFromLine} rows={saidas}>
          {(l) => <LancRow l={l} pa={pa.data || []} onAbrir={() => setDetalhe(l)} />}
        </TabList>
      )}
      {tab === "notas" && (
        <div className="bg-parket-panel border border-parket-border rounded-xl">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-parket-border">
            <FileText size={13} className="text-parket-accent" />
            <h2 className="text-sm font-semibold">Notas Fiscais Emitidas</h2>
            <span className="text-[10px] text-parket-textDim ml-auto tabular-nums">
              {nfs.loading ? "carregando…" : `${nfs.data?.total_qtd || 0} NF · ${fmtBRL(nfs.data?.total_valor || 0)}`}
            </span>
          </div>
          {nfs.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
          {!nfs.loading && (!nfs.data || nfs.data.notas.length === 0) && (
            <div className="p-6 text-center text-xs text-parket-textDim">
              Nenhuma NF-e emitida pra esta obra ainda.
              <div className="text-[10px] text-parket-textMuted mt-1">
                As notas aparecem quando o Fiscal (Ronaldo) sobe o XML em <a href="https://fiscal.parket.works" target="_blank" rel="noreferrer" className="text-parket-accent underline">fiscal.parket.works</a>.
              </div>
            </div>
          )}
          {nfs.data && nfs.data.notas.length > 0 && (
            <ul className="divide-y divide-parket-border/60">
              {nfs.data.notas.map((n) => (
                <li key={n.ch_nfe} className="px-5 py-3 flex items-center gap-3">
                  <div className="text-[10px] tabular-nums text-parket-textDim w-20">
                    {fmtDate(n.dh_emissao.substring(0, 10))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">
                      NF-e {n.numero}/{n.serie}
                      {n.status_vinculo === "pendente" && (
                        <span className="text-[9px] uppercase tracking-wider text-parket-textDim ml-2">pendente</span>
                      )}
                    </div>
                    <div className="text-[10px] text-parket-textDim truncate">
                      Emitida por {n.emit_nome.substring(0, 40)} · Dest: {n.dest_nome}
                    </div>
                  </div>
                  <div className="text-xs font-semibold tabular-nums">{fmtBRL(n.valor_nf)}</div>
                  <a href={`/api/fiscal/notas/${n.ch_nfe}/pdf`} target="_blank" rel="noreferrer"
                    className="px-2 py-1 rounded hover:bg-parket-accent/15 text-parket-textDim hover:text-parket-accent flex items-center gap-1 text-[10px] uppercase tracking-wider"
                    title="Baixar DANFE (PDF)">
                    <Download size={11} /> PDF
                  </a>
                  <a href={`/api/fiscal/notas/${n.ch_nfe}/xml`} download
                    className="px-2 py-1 rounded hover:bg-parket-accent/15 text-parket-textDim hover:text-parket-accent flex items-center gap-1 text-[10px] uppercase tracking-wider"
                    title="Baixar XML">
                    <Download size={11} /> XML
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {tab === "aditivos" && (
        <div className="bg-parket-panel border border-parket-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-3 border-b border-parket-border">
            <div className="text-sm font-semibold flex items-center gap-2"><FilePlus size={13} className="text-parket-accent" /> Aditivos do contrato</div>
            <Button onClick={() => setAditivoOpen(true)}><Plus size={11} /> Novo aditivo</Button>
          </div>
          {adi.loading && <div className="p-4 text-xs text-parket-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
          {adi.data && adi.data.length === 0 && (
            <div className="p-6 text-center text-xs text-parket-textDim">Sem aditivos.</div>
          )}
          <ul className="divide-y divide-parket-border/60">
            {(adi.data || []).map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold w-10">ADT-{a.numero}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{a.descricao}</div>
                  <div className="text-[10px] text-parket-textDim">
                    {fmtDate(a.data)}{a.forma_pagamento && ` · ${a.forma_pagamento}`}
                  </div>
                </div>
                <div className="text-xs font-semibold text-parket-accent tabular-nums">{fmtBRL(a.valor)}</div>
                {isAdmin && (
                  <button onClick={() => setConfirmDel(a)}
                    className="p-1 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Remover">
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <NovoAditivoModal open={aditivoOpen} onClose={() => setAditivoOpen(false)} obraId={id}
        proxNum={((adi.data || []).length + 1)}
        vendaTotal={Number(r.venda_total)}
        onSaved={() => { adi.reload(); resumo.reload(); }} />
      <ConfigObraModal open={configOpen} onClose={() => setConfigOpen(false)} obra={r}
        onSaved={() => { resumo.reload(); lan.reload(); }} />
      {/* Detalhe da parcela: reenviar, copiar, PDF, vencimento e Dar baixa */}
      <LancamentoDetalheModal open={!!detalhe} lancamento={detalhe}
        parceiro={detalhe?.parceiro_id ? (pa.data || []).find((p) => p.id === detalhe.parceiro_id) : null}
        obra={r}
        onClose={() => setDetalhe(null)}
        onDarBaixa={(l) => setBaixando(l)}
        onChanged={() => { lan.reload(); resumo.reload(); }} />
      <BaixarLancamentoModal open={!!baixando} lancamento={baixando}
        onClose={() => setBaixando(null)}
        onSaved={() => { lan.reload(); resumo.reload(); }} />
      <ConfirmDialog
        open={!!confirmDel} onClose={() => setConfirmDel(null)}
        title="Remover aditivo"
        message={`Confirma remoção do aditivo ADT-${confirmDel?.numero}? Recalcula liberação de RT/comissão automaticamente.`}
        confirmLabel="Remover" danger
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api.removerAditivo(confirmDel.id);
            toast.success("Aditivo removido");
            adi.reload(); resumo.reload();
          } catch (e: any) {
            toast.error(e?.message || "Erro");
          }
        }}
      />
    </div>
  );
}

/* Card de barra de progresso do topo da obra (Will 28/08): label pequeno,
   número em destaque (o que falta / o que liberou), barra e rodapé de
   contexto. cor="ok" pinta verde quando a meta já foi atingida. */
function BarraProgresso({ label, destaque, pct, pctLabel, cor, foot }:
  { label: string; destaque: string; pct: number; pctLabel: string; cor: "accent" | "ok"; foot: string }) {
  const fill = cor === "ok" ? "bg-emerald-500" : "bg-parket-accent";
  const txt = cor === "ok" ? "text-emerald-400" : "text-parket-text";
  return (
    <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
      <div className="flex justify-between items-baseline gap-2 text-[11px]">
        <span className="text-parket-textDim uppercase tracking-wider font-semibold">{label}</span>
        <span className="text-parket-textDim tabular-nums shrink-0">{pctLabel}</span>
      </div>
      <div className={`mt-1.5 mb-2 text-lg font-bold tabular-nums ${txt}`}>{destaque}</div>
      <div className="h-2 bg-parket-panelLight rounded-full overflow-hidden">
        <div className={`h-full ${fill} rounded-full transition-all`} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-2 text-[10px] text-parket-textDim leading-relaxed">{foot}</div>
    </div>
  );
}

function ResumoLinha({ label, value, sub, bold, neg, accent, danger }:
  { label: string; value: string; sub?: string; bold?: boolean; neg?: boolean; accent?: boolean; danger?: boolean }) {
  return (
    <>
      <div className={`${bold ? "font-semibold" : ""} ${neg ? "text-parket-textDim" : ""}`}>{label}</div>
      <div className={`text-right tabular-nums ${bold ? "font-semibold" : ""} ${accent ? "text-parket-accent" : ""} ${danger ? "text-red-400" : ""}`}>
        {neg && "− "}{value}
        {sub && <span className="text-parket-textDim font-normal ml-1">· {sub}</span>}
      </div>
    </>
  );
}

function TabList({ title, icon: Icon, rows, children }:
  { title: string; icon: any; rows: Lancamento[]; children: (l: Lancamento) => React.ReactNode }) {
  return (
    <div className="bg-parket-panel border border-parket-border rounded-xl">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-parket-border">
        <Icon size={13} className="text-parket-accent" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-[10px] text-parket-textDim ml-auto">{rows.length} item(ns)</span>
      </div>
      {rows.length === 0 && (
        <div className="p-6 text-center text-xs text-parket-textDim">Nenhum lançamento nesta categoria.</div>
      )}
      <ul className="divide-y divide-parket-border/60">
        {rows.map((l) => <li key={l.id}>{children(l)}</li>)}
      </ul>
    </div>
  );
}

/* Linha de lançamento: SEM ícone de baixa 1-clique (Will 28/08 #1940).
   O clique abre o modal de detalhe, onde vive o botão explícito "Dar baixa". */
function LancRow({ l, pa, onAbrir }: { l: Lancamento; pa: any[]; onAbrir: () => void }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const venc = new Date(l.data_vencimento + "T00:00:00");
  const baixado = l.status === "pago" || l.status === "recebido" || l.status === "conciliado";
  const isFinal = baixado || l.status === "cancelado";
  const atrasado = !isFinal && venc < today;
  const eff = atrasado ? "atrasado" : l.status;
  const c = colorByStatus[eff];
  const parc = l.parceiro_id ? pa.find((p) => p.id === l.parceiro_id) : null;
  return (
    <div onClick={onAbrir}
      className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-parket-panelLight/30">
      <div className="text-[10px] tabular-nums text-parket-textDim w-20">
        {fmtDate(l.data_vencimento)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{l.descricao}</div>
        <div className="text-[10px] text-parket-textDim">
          {parc?.nome && `${parc.nome} · `}{l.numero_documento || "sem documento"}
        </div>
      </div>
      <div className="text-xs font-semibold tabular-nums">{fmtBRL(l.valor)}</div>
      {c && (
        <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase w-24 text-center" style={{ color: c.fg, background: c.bg }}>
          {eff.replace("_", " ")}
        </span>
      )}
    </div>
  );
}

function NovoAditivoModal({ open, onClose, obraId, proxNum, vendaTotal, onSaved }:
  { open: boolean; onClose: () => void; obraId: string; proxNum: number; vendaTotal: number; onSaved: () => void }) {
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [fp, setFp] = useState("");
  const [saving, setSaving] = useState(false);

  // Templates (Will 11/08): reduzem burocracia — 1 clique pra pre-preencher.
  const templates = [
    { key: "10pct",     label: "Escopo extra 10%", desc: "Aditivo — escopo extra 10% do contrato original", valor: () => (vendaTotal * 0.10).toFixed(2) },
    { key: "marc",      label: "Marcenaria adicional", desc: "Aditivo — marcenaria adicional",             valor: () => "" },
    { key: "reforma",   label: "Reforma extra",        desc: "Aditivo — reforma/complemento",              valor: () => "" },
    { key: "livre",     label: "Personalizado",        desc: "",                                            valor: () => "" },
  ];
  const aplicarTemplate = (t: typeof templates[number]) => {
    setDesc(t.desc); const v = t.valor(); if (v) setValor(v);
  };

  const salvar = async () => {
    const v = Number(valor);
    if (!desc.trim() || !v || v <= 0) { toast.error("Preencha descrição e valor"); return; }
    setSaving(true);
    try {
      await api.criarAditivo({ obra_id: obraId, numero: proxNum, descricao: desc.trim(),
                                valor: v, data, forma_pagamento: fp.trim() || null });
      toast.success(`Aditivo ADT-${proxNum} criado — liberação recalculada`);
      onSaved(); onClose();
      setDesc(""); setValor(""); setFp("");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Novo aditivo · ADT-${proxNum}`} size="md"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} loading={saving}>Salvar aditivo</Button>
      </>}>
      <div className="space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1.5">Templates</div>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button key={t.key} type="button" onClick={() => aplicarTemplate(t)}
                className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-parket-panelLight border border-parket-border text-parket-textDim hover:text-parket-text hover:border-parket-borderHover">
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Descrição do aditivo" required>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Ampliação de 20m² sala de estar" />
        </Field>
        <FormGrid cols={2}>
          <Field label="Valor" required>
            <Input type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Field>
          <Field label="Data" required>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
        </FormGrid>
        <Field label="Forma de pagamento (opcional)">
          <Textarea rows={2} value={fp} onChange={(e) => setFp(e.target.value)}
            placeholder="Ex.: 50% sinal + 50% na entrega" />
        </Field>
        <div className="text-[10px] text-parket-textDim">
          Aumenta venda_total automaticamente e recalcula RT/comissão proporcional.
        </div>
      </div>
    </Modal>
  );
}
