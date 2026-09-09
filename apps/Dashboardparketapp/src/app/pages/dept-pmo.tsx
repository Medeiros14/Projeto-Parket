/* ═══ PMO / PRODUTIVIDADE — Visao da Natalia ═══ */
import React from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, CTip, SolicitacaoComprasTab, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT, BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, AlertTriangle, CheckCircle2, Clock, Building2, Calendar, FileText, BarChart3, Users } from "../components/dept-layout";
import { Gauge, TrendingUp, Target, Award, ShoppingCart, MapPin, RefreshCw, MessageSquare, ChevronUp, ChevronDown, Eye } from "lucide-react";
import { usePMO } from "../hooks/usePMO";
import { useEquipesParket } from "../hooks/useEquipesParket";
import { Btn, StatusSelect } from "../components/modal";
import { supabase } from "../lib/supabase";

const PRODUTIVIDADE_DATA = [
  { equipe: "Alpha", m2dia: 22, meta: 18, obra: "PKT-042", tipo: "piso" },
  { equipe: "Delta", m2dia: 15, meta: 18, obra: "PKT-048", tipo: "piso+forro" },
  { equipe: "Gamma", m2dia: 0, meta: 18, obra: "PKT-050", tipo: "marc (PARADA)" },
  { equipe: "Beta", m2dia: 0, meta: 18, obra: "PKT-053", tipo: "rev (mobilizacao)" },
];

const M2_SEMANAL = [
  { sem: "S1", piso: 95, forro: 42, deck: 15 }, { sem: "S2", piso: 88, forro: 38, deck: 12 },
  { sem: "S3", piso: 102, forro: 45, deck: 18 }, { sem: "S4", piso: 78, forro: 40, deck: 20 },
];

const RETENCOES = [
  { obra: "PKT-042", valor: "R$ 18.5k", status: "retido", vencimento: "30d pos-entrega" },
  { obra: "PKT-045", valor: "R$ 12.8k", status: "retido", vencimento: "30d pos-entrega" },
  { obra: "PKT-048", valor: "R$ 22.0k", status: "retido", vencimento: "30d pos-entrega" },
  { obra: "PKT-050", valor: "R$ 15.2k", status: "retido", vencimento: "30d pos-entrega" },
  { obra: "PKT-053", valor: "R$ 14.5k", status: "retido", vencimento: "30d pos-entrega" },
  { obra: "PKT-039", valor: "R$ 8.5k", status: "liberar", vencimento: "VENCIDO — 15d" },
];

const RANKING_EQUIPES = [
  { equipe: "Equipe Alpha", lider: "Marcos R.", m2Total: 198, m2Media: 22, obras: 1, bonus: true },
  { equipe: "Equipe Delta", lider: "Fernando L.", m2Total: 135, m2Media: 15, obras: 1, bonus: false },
  { equipe: "Equipe Beta", lider: "Ricardo S.", m2Total: 0, m2Media: 0, obras: 0, bonus: false },
  { equipe: "Equipe Gamma", lider: "Tiago M.", m2Total: 85, m2Media: 12, obras: 1, bonus: false },
];

/* ─── Produtividade Tab (original) ─── */
function ProdutividadeTab() {
  const { m2Semanal: dbM2, produtividade: dbProd } = usePMO();
  const m2Semanal = dbM2.length > 0 ? dbM2.map(m => ({ sem: m.semana, piso: m.piso, forro: m.forro, deck: m.deck })) : M2_SEMANAL;
  const produtividade = dbProd.length > 0 ? dbProd.map(p => ({
    equipe: p.equipe, m2dia: p.m2dia, meta: p.meta, obra: p.obra_code, tipo: p.tipo,
  })) : PRODUTIVIDADE_DATA;
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Painel de Produtividade</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>m2/dia por equipe e evolucao semanal</p></div>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>m2 Produzidos por Semana</p>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m2Semanal}>
              <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xa" dataKey="sem" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <Tooltip key="tt" content={<CTip />} />
              <Bar key="piso" dataKey="piso" name="Piso" fill={GREEN} fillOpacity={0.6} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar key="forro" dataKey="forro" name="Forro" fill={BLUE} fillOpacity={0.5} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar key="deck" dataKey="deck" name="Deck" fill={ORANGE} fillOpacity={0.5} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>m2/dia por Equipe</p>
        <div className="space-y-3">
          {produtividade.map((p, i) => {
            const sc = p.m2dia >= p.meta ? GREEN : p.m2dia > 0 ? YELLOW : RED;
            return (
              <div key={i} className="flex items-center gap-3">
                <span style={{ fontSize: "0.65rem", color: TEXT_MED, width: 60 }}>{p.equipe}</span>
                <div className="flex-1 h-6 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="h-full rounded flex items-center px-2" style={{ width: p.m2dia > 0 ? `${(p.m2dia / 25) * 100}%` : "5%", background: `${sc}20`, minWidth: 40 }}>
                    <span style={{ fontSize: "0.6rem", color: sc, fontWeight: 600 }}>{p.m2dia} m2</span>
                  </div>
                </div>
                <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{p.obra} · {p.tipo}</span>
                {p.m2dia >= p.meta && <Award size={12} style={{ color: GOLD }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Retencoes & Ranking Tab (original) ─── */
function RetencoesRankingTab() {
  const { retencoes: dbRet, ranking: dbRank, updateRetencaoStatus } = usePMO();
  const rawRet = dbRet.length > 0 ? dbRet : null;
  const retencoes = rawRet ? rawRet : RETENCOES.map((r, i) => ({ ...r, id: String(i) }));
  const retStatusColors: Record<string, string> = { retido: BLUE, liberar: RED, liberado: GREEN };
  const [localStatus, setLocalStatus] = React.useState<Record<string, string>>({});
  const ranking = dbRank.length > 0 ? dbRank.map(r => ({
    equipe: r.equipe, lider: r.lider, m2Total: r.m2_total,
    m2Media: r.m2_media, obras: r.obras, bonus: r.bonus,
  })) : RANKING_EQUIPES;
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Retencoes & Ranking de Equipes</h2></div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Retencoes Ativas — R$ 92k total</p>
        <div className="space-y-2">
          {retencoes.map((r, i) => {
            const effectiveStatus = localStatus[r.id] ?? r.status;
            const sc = effectiveStatus === "liberar" ? RED : effectiveStatus === "liberado" ? GREEN : BLUE;
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: effectiveStatus === "liberar" ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${effectiveStatus === "liberar" ? "rgba(239,68,68,0.12)" : BORDER}` }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, color: ACCENT }}>{r.obra}</span>
                <span style={{ fontSize: "0.65rem", color: "white" }}>{r.valor}</span>
                <span className="flex-1" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{r.vencimento}</span>
                {rawRet ? (
                  <StatusSelect value={(r as any).status} options={["retido","liberar","liberado"]} onChange={v => updateRetencaoStatus((r as any).id, v)} colorMap={retStatusColors} />
                ) : (
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{effectiveStatus}</span>
                )}
                {effectiveStatus === "liberar" && !rawRet && (
                  <button className="rounded-lg px-2 py-1" onClick={() => setLocalStatus(s => ({ ...s, [r.id]: "liberado" }))} style={{ fontSize: "0.5rem", fontWeight: 600, background: "rgba(16,185,129,0.12)", color: GREEN, border: "1px solid rgba(16,185,129,0.2)", cursor: "pointer" }}>Liberar</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Ranking de Equipes — Mes</p>
        </div>
        {ranking.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}`, background: r.bonus ? "rgba(212,168,83,0.04)" : "transparent" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: r.bonus ? GOLD : TEXT_DIM, width: 20 }}>#{i + 1}</span>
            <div className="flex-1">
              <p className="text-white" style={{ fontSize: "0.72rem", fontWeight: 500 }}>{r.equipe} — {r.lider}</p>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{r.m2Total} m2 total · {r.m2Media} m2/dia avg · {r.obras} obras</p>
            </div>
            {r.bonus && <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 700, background: "rgba(212,168,83,0.2)", color: GOLD }}>BONUS</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Equipe Atribuicao Panel (ported from golden) ─── */
function EquipeAtribuicaoPanel({ obraId, details, onUpdated }: { obraId: string; details: any; onUpdated: () => void }) {
  const { porCategoria } = useEquipesParket();
  const [atribuidos, setAtribuidos] = React.useState<any[]>(details.prestadores ?? []);
  const [showPicker, setShowPicker] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { setAtribuidos(details.prestadores ?? []); }, [details.prestadores]);

  const persist = async (next: any[]) => {
    setSaving(true);
    await supabase.from("kanban_cards").update({ details: { ...details, prestadores: next } }).eq("id", obraId);
    setSaving(false);
    onUpdated();
  };

  const addEquipe = async (m: any) => {
    if (atribuidos.some(a => a.id === m.id)) return;
    const next = [...atribuidos, { id: m.id, nome: m.nome, telefone: m.telefone || undefined, categoria: m.categoria }];
    setAtribuidos(next);
    await persist(next);
  };

  const removeEquipe = async (id: string) => {
    const next = atribuidos.filter(a => a.id !== id);
    setAtribuidos(next);
    await persist(next);
  };

  return (
    <div style={{ background: "rgba(20,184,166,0.08)", border: "2px solid rgba(20,184,166,0.3)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ fontSize: "0.45rem", fontWeight: 700, letterSpacing: "0.1em", color: TEAL, textTransform: "uppercase" }}>
          Equipes Responsaveis {saving && <span style={{ color: "#F59E0B", fontWeight: 400, fontStyle: "italic" }}> — salvando...</span>}
        </p>
        <button onClick={() => setShowPicker(!showPicker)} style={{ fontSize: "0.55rem", padding: "3px 10px", borderRadius: 6, background: `${TEAL}15`, color: TEAL, border: `1px solid ${TEAL}30`, cursor: "pointer" }}>+ Adicionar</button>
      </div>

      {atribuidos.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: showPicker ? 10 : 0 }}>
          {atribuidos.map(n => (
            <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: TEAL, color: "#000", fontSize: "0.45rem", fontWeight: 700, flexShrink: 0 }}>{n.nome.charAt(0)}</span>
              <span style={{ flex: 1, fontSize: "0.65rem", color: "white", fontWeight: 500 }}>{n.nome} <span style={{ color: TEXT_DIM, fontWeight: 400 }}>- {n.categoria}</span></span>
              {n.telefone && <a href={`https://wa.me/55${n.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener" style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{n.telefone}</a>}
              <button onClick={() => removeEquipe(n.id)} style={{ color: "#ef4444", cursor: "pointer", background: "none", border: "none", padding: 2, display: "flex" }}>&#10005;</button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: "0.6rem", color: TEXT_DIM, fontStyle: "italic", marginBottom: showPicker ? 10 : 0 }}>Nenhuma equipe atribuida — clique em Adicionar</p>
      )}

      {showPicker && (
        <div style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, maxHeight: 250, overflowY: "auto" }}>
          <input autoFocus value={busca} onChange={ev => setBusca(ev.target.value)} placeholder="Buscar equipe por nome ou categoria..." style={{ width: "100%", padding: "6px 10px", borderRadius: 6, background: "#0a0a0a", border: `1px solid ${BORDER}`, color: "white", fontSize: "0.6rem", outline: "none", marginBottom: 6, boxSizing: "border-box" }} />
          {porCategoria
            .filter(cat => cat.membros.some(m => m.ativo && (!busca || m.nome.toLowerCase().includes(busca.toLowerCase()) || m.categoria.toLowerCase().includes(busca.toLowerCase()))))
            .map(cat => (
              <div key={cat.categoria}>
                <p style={{ fontSize: "0.42rem", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 0" }}>{cat.categoria}</p>
                {cat.membros.filter(m => m.ativo && (!busca || m.nome.toLowerCase().includes(busca.toLowerCase()) || m.categoria.toLowerCase().includes(busca.toLowerCase()))).map(m => {
                  const ja = atribuidos.some(a => a.id === m.id);
                  return (
                    <button key={m.id} onClick={() => !ja && addEquipe(m)} disabled={ja} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 4, border: "none", background: "transparent", cursor: ja ? "default" : "pointer", opacity: ja ? 0.35 : 1, textAlign: "left" }}>
                      <span style={{ fontSize: "0.6rem", color: "white", fontWeight: 500 }}>{m.nome}</span>
                      <span style={{ fontSize: "0.48rem", color: TEXT_DIM }}>- {m.categoria}</span>
                      {m.telefone && <span style={{ fontSize: "0.48rem", color: TEXT_DIM, marginLeft: "auto" }}>{m.telefone}</span>}
                      {ja && <span style={{ fontSize: "0.45rem", color: GREEN, marginLeft: "auto" }}>&#10003;</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          <button onClick={() => setShowPicker(false)} style={{ width: "100%", padding: "5px", borderRadius: 4, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, color: TEXT_DIM, fontSize: "0.5rem", cursor: "pointer", marginTop: 4 }}>Fechar</button>
        </div>
      )}
    </div>
  );
}

/* ─── Acompanhamento de Obras Tab (ported from golden) ─── */
function AcompanhamentoObrasTab() {
  const [obras, setObras] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [filtro, setFiltro] = React.useState("todas");

  const fetchObras = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("kanban_cards")
      .select("id,title,obra,responsavel,sla,sla_status,priority,progress,details,column_id,created_at,updated_at")
      .eq("dept_id", "obras")
      .order("updated_at", { ascending: false });
    setObras(data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchObras(); }, [fetchObras]);

  const enriched = obras.map(card => {
    const det = card.details ?? {};
    const crono = det.cronograma_pmo ?? {};
    const itens = crono.itens ?? [];
    const alertas = crono.alertas ?? [];
    const alertasAtivos = alertas.filter((a: any) => a.status !== "resolvido").length;
    const totalItens = itens.length;
    const concluidos = itens.filter((it: any) => it.status === "concluido").length;
    const atrasados = itens.filter((it: any) => it.status === "atrasado").length;
    const emAndamento = itens.filter((it: any) => it.status === "em_andamento").length;
    const pct = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : (card.progress ?? 0);
    const previsaoInicio = crono.previsao_inicio || det.previsao_inicio || "";
    const totalDias = crono.total_dias_uteis || det.prazo_dias_uteis || 0;
    let statusGeral = "nao_iniciado";
    if (pct >= 100) statusGeral = "concluido";
    else if (atrasados > 0 || alertasAtivos > 0) statusGeral = "atrasado";
    else if (emAndamento > 0 || concluidos > 0) statusGeral = "em_andamento";
    return { ...card, pct, statusGeral, totalItens, concluidos, atrasados, emAndamento, alertasAtivos, itens, alertas, previsaoInicio, totalDias };
  });

  const filtered = filtro === "todas" ? enriched : enriched.filter(o => o.statusGeral === filtro);

  const statusColor = (s: string) => s === "concluido" ? GREEN : s === "atrasado" ? RED : s === "em_andamento" ? BLUE : TEXT_DIM;
  const statusLabel = (s: string) => s === "concluido" ? "Concluido" : s === "atrasado" ? "Atrasado" : s === "em_andamento" ? "Em Andamento" : "Nao Iniciado";
  const itemStatusColor = (s: string) => s === "concluido" ? GREEN : s === "atrasado" ? RED : s === "em_andamento" ? BLUE : TEXT_DIM;

  const totalObras = enriched.length;
  const totalEmAndamento = enriched.filter(o => o.statusGeral === "em_andamento").length;
  const totalAtrasado = enriched.filter(o => o.statusGeral === "atrasado").length;
  const totalConcluido = enriched.filter(o => o.statusGeral === "concluido").length;

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: TEXT_DIM, fontSize: "0.7rem" }}>Carregando obras...</div>;

  const summaryCards: { label: string; value: number; color: string; icon: any; filter: string }[] = [
    { label: "Total de Obras", value: totalObras, color: ACCENT, icon: Building2, filter: "todas" },
    { label: "Em Andamento", value: totalEmAndamento, color: BLUE, icon: Clock, filter: "em_andamento" },
    { label: "Com Atraso", value: totalAtrasado, color: RED, icon: AlertTriangle, filter: "atrasado" },
    { label: "Concluidas", value: totalConcluido, color: GREEN, icon: CheckCircle2, filter: "concluido" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Acompanhamento de Obras</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{obras.length} obras carregadas · Expanda para atribuir equipes</p>
        </div>
        <button onClick={fetchObras} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: "0.6rem", fontWeight: 600, cursor: "pointer", background: "rgba(184,170,154,0.1)", border: "1px solid rgba(184,170,154,0.2)", color: ACCENT }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map(sc => {
          const Icon = sc.icon;
          const active = filtro === sc.filter;
          return (
            <button key={sc.label} onClick={() => setFiltro(active ? "todas" : sc.filter)} className="rounded-xl p-3.5 text-center transition-all" style={{ background: active ? `${sc.color}15` : CARD_BG, border: `1px solid ${active ? `${sc.color}40` : BORDER}`, cursor: "pointer" }}>
              <Icon size={14} style={{ color: sc.color, margin: "0 auto 6px" }} />
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: sc.color, display: "block" }}>{sc.value}</span>
              <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 2 }}>{sc.label}</p>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <Building2 size={32} style={{ color: TEXT_DIM, margin: "0 auto 12px" }} />
            <p style={{ fontSize: "0.75rem", color: TEXT_DIM }}>Nenhuma obra encontrada</p>
          </div>
        )}
        {filtered.map(card => {
          const expanded = expandedId === card.id;
          const sc = statusColor(card.statusGeral);
          return (
            <div key={card.id} className="rounded-xl overflow-hidden transition-all" style={{ background: CARD_BG, border: `1px solid ${expanded ? `${sc}40` : BORDER}` }}>
              {/* Header row */}
              <button onClick={() => setExpandedId(expanded ? null : card.id)} className="w-full flex items-center gap-3 p-4 text-left transition-all" style={{ cursor: "pointer" }}>
                {/* Progress ring */}
                <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
                  <svg width={44} height={44} style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={22} cy={22} r={18} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
                    <circle cx={22} cy={22} r={18} fill="none" stroke={sc} strokeWidth={4} strokeDasharray={`${(card.pct / 100) * 113} 113`} strokeLinecap="round" />
                  </svg>
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", fontWeight: 700, color: sc }}>{card.pct}%</span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white truncate" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{card.title}</span>
                    {card.obra && <span style={{ fontSize: "0.55rem", color: ACCENT, background: `${ACCENT}15`, padding: "1px 6px", borderRadius: 4 }}>{card.obra}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}><Users size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{card.responsavel}</span>
                    {card.previsaoInicio && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}><MapPin size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />Inicio: {new Date(card.previsaoInicio).toLocaleDateString("pt-BR")}</span>}
                    {card.totalDias > 0 && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}><Clock size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{card.totalDias} dias uteis</span>}
                  </div>
                  {/* Prestadores inline */}
                  {(() => {
                    const prestadores = (card.details ?? {}).prestadores ?? [];
                    return prestadores.length > 0 ? (
                      <p style={{ fontSize: "0.6rem", color: ORANGE, marginTop: 4, lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 600 }}>Equipes: </span>
                        {prestadores.map((pr: any, idx: number) => (
                          <span key={pr.id}>
                            <span style={{ color: "white", fontWeight: 500 }}>{pr.nome}</span>
                            <span style={{ color: TEXT_DIM }}> - {pr.categoria}</span>
                            {idx < prestadores.length - 1 && <span style={{ color: TEXT_DIM }}>, </span>}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 4, fontStyle: "italic" }}>Sem equipe atribuida — expanda para alocar</p>
                    );
                  })()}
                </div>
                {/* Badges */}
                <div className="flex items-center gap-2 shrink-0">
                  {card.alertasAtivos > 0 && (
                    <span style={{ fontSize: "0.5rem", fontWeight: 700, color: RED, background: `${RED}15`, padding: "2px 8px", borderRadius: 20 }}>
                      <AlertTriangle size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{card.alertasAtivos} alerta{card.alertasAtivos > 1 ? "s" : ""}
                    </span>
                  )}
                  <span style={{ fontSize: "0.55rem", fontWeight: 600, color: sc, background: `${sc}15`, padding: "3px 10px", borderRadius: 20 }}>{statusLabel(card.statusGeral)}</span>
                  {expanded ? <ChevronUp size={16} style={{ color: TEXT_DIM }} /> : <ChevronDown size={16} style={{ color: TEXT_DIM }} />}
                </div>
              </button>

              {/* Expanded detail */}
              {expanded && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px" }}>
                  {/* Team assignment */}
                  <div style={{ marginBottom: 16 }}>
                    <EquipeAtribuicaoPanel obraId={card.id} details={card.details ?? {}} onUpdated={fetchObras} />
                  </div>

                  {/* Cronograma items */}
                  {card.itens.length > 0 ? (
                    <div>
                      <p className="tracking-[0.2em] uppercase mb-3" style={{ fontSize: "0.45rem", color: ACCENT }}>Servicos do Cronograma</p>
                      <div className="space-y-2">
                        {card.itens.map((item: any, idx: number) => {
                          const isc = itemStatusColor(item.status || "pendente");
                          const instalado = item.instalado ?? 0;
                          const quantidade = item.quantidade ?? 0;
                          const pctItem = quantidade > 0 ? Math.round((instalado / quantidade) * 100) : 0;
                          return (
                            <div key={idx} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span style={{ fontSize: "0.7rem", color: "white", fontWeight: 600 }}>{item.servico}</span>
                                  <span style={{ fontSize: "0.5rem", color: isc, fontWeight: 600, background: `${isc}15`, padding: "1px 6px", borderRadius: 10, textTransform: "uppercase" }}>{(item.status || "pendente").replace("_", " ")}</span>
                                </div>
                                <span style={{ fontSize: "0.6rem", color: TEXT_MED }}>{instalado}/{quantidade} {item.unidade || "m\u00B2"} · {item.dias_uteis || 0}d</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(pctItem, 100)}%`, borderRadius: 3, background: isc, transition: "width 0.3s" }} />
                              </div>
                              {item.observacao && <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 6 }}>{item.observacao}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <MapPin size={24} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
                      <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Cronograma ainda nao configurado</p>
                      <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 4 }}>Abra o card no Kanban para configurar o cronograma</p>
                    </div>
                  )}

                  {/* Active alerts */}
                  {card.alertas.filter((a: any) => a.status !== "resolvido").length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <p className="tracking-[0.2em] uppercase mb-3" style={{ fontSize: "0.45rem", color: RED }}>Alertas Ativos</p>
                      <div className="space-y-2">
                        {card.alertas.filter((a: any) => a.status !== "resolvido").map((alerta: any, idx: number) => {
                          const tipoLabel = alerta.tipo === "pendencia_obra" ? "Pendencia Obra" : alerta.tipo === "atraso_parket" ? "Atraso Parket" : (alerta.tipo_outro || "Outros");
                          return (
                            <div key={idx} className="rounded-lg p-3 flex items-start gap-3" style={{ background: `${RED}08`, border: `1px solid ${RED}25` }}>
                              <Eye size={14} style={{ color: RED, flexShrink: 0, marginTop: 2 }} />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span style={{ fontSize: "0.55rem", fontWeight: 700, color: RED, background: `${RED}20`, padding: "1px 6px", borderRadius: 4 }}>{tipoLabel}</span>
                                  {alerta.servico_ref && <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>· {alerta.servico_ref}</span>}
                                  <span style={{ fontSize: "0.5rem", color: ACCENT, background: `${ACCENT}15`, padding: "1px 6px", borderRadius: 4 }}>{alerta.status?.replace("_", " ")}</span>
                                </div>
                                <p style={{ fontSize: "0.6rem", color: TEXT_MED, lineHeight: 1.5 }}>{alerta.motivo}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Footer stats */}
                  <div className="flex items-center gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: "0.55rem", color: GREEN }}><CheckCircle2 size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{card.concluidos} concluidos</span>
                    <span style={{ fontSize: "0.55rem", color: BLUE }}><Clock size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{card.emAndamento} em andamento</span>
                    <span style={{ fontSize: "0.55rem", color: RED }}><AlertTriangle size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{card.atrasados} atrasados</span>
                    <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{card.totalItens} servicos total</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Gestao de Alertas / Cronograma Tab (ported from golden) ─── */
function AlertasCronoTab() {
  const [cards, setCards] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [openChat, setOpenChat] = React.useState<string | null>(null);
  const [chatMsg, setChatMsg] = React.useState("");

  const fetchAlerts = React.useCallback(async () => {
    const { data } = await supabase
      .from("kanban_cards")
      .select("id,title,obra,responsavel,details,column_id")
      .eq("dept_id", "produtividade");
    const filtered = (data ?? []).filter((c: any) => {
      const crono = c.details?.cronograma_pmo;
      return crono?.alertas?.length > 0;
    });
    filtered.sort((a: any, b: any) => {
      const aPending = (a.details?.cronograma_pmo?.alertas ?? []).filter((al: any) => al.status !== "resolvido").length;
      const bPending = (b.details?.cronograma_pmo?.alertas ?? []).filter((al: any) => al.status !== "resolvido").length;
      return bPending - aPending;
    });
    setCards(filtered);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const updateAlertStatus = async (cardId: string, alertId: string, newStatus: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const crono = { ...(card.details?.cronograma_pmo ?? {}) };
    crono.alertas = (crono.alertas ?? []).map((a: any) => a.id === alertId ? { ...a, status: newStatus } : a);
    await supabase.from("kanban_cards").update({ details: { ...card.details, cronograma_pmo: crono } }).eq("id", cardId);
    fetchAlerts();
  };

  const sendChatMsg = async (cardId: string, alertId: string, msg: string) => {
    if (!msg.trim()) return;
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const crono = { ...(card.details?.cronograma_pmo ?? {}) };
    crono.alertas = (crono.alertas ?? []).map((a: any) =>
      a.id === alertId ? { ...a, chat: [...(a.chat ?? []), { autor: "PMO", msg: msg.trim(), ts: new Date().toISOString() }] } : a
    );
    await supabase.from("kanban_cards").update({ details: { ...card.details, cronograma_pmo: crono } }).eq("id", cardId);
    setChatMsg("");
    fetchAlerts();
  };

  if (loading) return <p style={{ color: TEXT_DIM, fontSize: "0.65rem", textAlign: "center", padding: 40 }}>Carregando alertas...</p>;

  const totalAlertas = cards.reduce((s, c) => s + (c.details?.cronograma_pmo?.alertas?.length ?? 0), 0);
  const pendentes = cards.reduce((s, c) => s + (c.details?.cronograma_pmo?.alertas ?? []).filter((a: any) => a.status !== "resolvido").length, 0);

  const TIPO_LABELS: Record<string, string> = { pendencia_obra: "Pendencia de Obra", atraso_parket: "Atraso Parket", outros: "Outros" };
  const STATUS_COLORS: Record<string, string> = { em_analise: "rgba(255,255,255,0.4)", fazendo: BLUE, resolvido: GREEN, aguardando: RED };
  const STATUS_LABELS: Record<string, string> = { em_analise: "Pendente", fazendo: "Em Andamento", resolvido: "Concluido", aguardando: "Atrasado" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>Gestao de Alertas — Cronograma Geral</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Todos os alertas de atraso ordenados por prioridade</p>
        </div>
        <div className="flex gap-3">
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: RED, margin: 0 }}>{pendentes}</p>
            <p style={{ fontSize: "0.45rem", color: TEXT_DIM, margin: 0, textTransform: "uppercase" }}>Pendentes</p>
          </div>
          <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: GREEN, margin: 0 }}>{totalAlertas - pendentes}</p>
            <p style={{ fontSize: "0.45rem", color: TEXT_DIM, margin: 0, textTransform: "uppercase" }}>Resolvidos</p>
          </div>
        </div>
      </div>

      {cards.length === 0 && <p style={{ color: TEXT_DIM, fontSize: "0.65rem", textAlign: "center", padding: 40 }}>Nenhum alerta de atraso registrado</p>}

      {cards.map(card => {
        const alertas = card.details?.cronograma_pmo?.alertas ?? [];
        return (
          <div key={card.id} className="rounded-xl" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            {/* Card header */}
            <div className="p-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div>
                <span style={{ fontSize: "0.6rem", fontWeight: 700, color: ACCENT }}>{card.obra}</span>
                <span style={{ fontSize: "0.6rem", color: TEXT_MED, marginLeft: 8 }}>{card.title?.slice(0, 50)}</span>
              </div>
              <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{alertas.length} alerta(s)</span>
            </div>

            {/* Alert rows */}
            {alertas.map((alerta: any) => {
              const chatKey = `${card.id}-${alerta.id}`;
              const isChatOpen = openChat === chatKey;
              return (
                <div key={alerta.id} className="px-3 py-2.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={11} style={{ color: alerta.status === "resolvido" ? GREEN : RED }} />
                        <span style={{ fontSize: "0.55rem", fontWeight: 700, color: alerta.status === "resolvido" ? GREEN : RED }}>{TIPO_LABELS[alerta.tipo] ?? alerta.tipo_outro ?? alerta.tipo}</span>
                        <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{new Date(alerta.data).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5 }}>{alerta.motivo}</p>
                    </div>
                    <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                      <select
                        value={alerta.status}
                        onChange={ev => updateAlertStatus(card.id, alerta.id, ev.target.value)}
                        style={{ padding: "3px 6px", borderRadius: 6, fontSize: "0.5rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: STATUS_COLORS[alerta.status] ?? TEXT_DIM, outline: "none", cursor: "pointer", width: 90 }}
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button
                        onClick={() => setOpenChat(isChatOpen ? null : chatKey)}
                        style={{ padding: "3px 8px", borderRadius: 6, fontSize: "0.5rem", background: isChatOpen ? `${BLUE}20` : "rgba(255,255,255,0.04)", color: isChatOpen ? BLUE : TEXT_DIM, border: `1px solid ${isChatOpen ? BLUE + "40" : BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                      >
                        <MessageSquare size={10} /> {alerta.chat?.length ?? 0}
                      </button>
                    </div>
                  </div>

                  {/* Inline chat */}
                  {isChatOpen && (
                    <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                      <div style={{ maxHeight: 120, overflowY: "auto", marginBottom: 6 }}>
                        {(alerta.chat ?? []).length === 0 && <p style={{ fontSize: "0.55rem", color: TEXT_DIM, textAlign: "center", padding: 8 }}>Sem mensagens</p>}
                        {(alerta.chat ?? []).map((msg: any, idx: number) => (
                          <div key={idx} className="mb-1.5" style={{ fontSize: "0.55rem" }}>
                            <span style={{ fontWeight: 700, color: ACCENT }}>{msg.autor}</span>
                            <span style={{ color: TEXT_DIM, marginLeft: 4 }}>{new Date(msg.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                            <p style={{ margin: "1px 0 0", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{msg.msg}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={openChat === chatKey ? chatMsg : ""}
                          onChange={ev => setChatMsg(ev.target.value)}
                          onKeyDown={ev => { if (ev.key === "Enter") sendChatMsg(card.id, alerta.id, chatMsg); }}
                          placeholder="Mensagem interna..."
                          style={{ flex: 1, padding: "5px 8px", borderRadius: 6, fontSize: "0.58rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white", outline: "none" }}
                        />
                        <button onClick={() => sendChatMsg(card.id, alerta.id, chatMsg)} style={{ padding: "5px 12px", borderRadius: 6, fontSize: "0.55rem", background: `${BLUE}20`, color: BLUE, border: `1px solid ${BLUE}40`, cursor: "pointer" }}>Enviar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Extra Tabs & Page Config ─── */
const extraTabs: ExtraTab[] = [
  { id: "acompanhamento", label: "Acompanhamento", icon: Building2, render: () => <AcompanhamentoObrasTab /> },
  { id: "prod", label: "Produtividade", icon: Gauge, render: () => <ProdutividadeTab /> },
  { id: "alertas-crono", label: "Gestao de Riscos", icon: AlertTriangle, render: () => <AlertasCronoTab /> },
  { id: "retencoes", label: "Retencoes & Ranking", icon: Target, render: () => <RetencoesRankingTab /> },
  { id: "solicitar-compras", label: "Solicitar Compras", icon: ShoppingCart, render: () => <SolicitacaoComprasTab /> },
];

const team: TeamMember[] = [];

const activity: ActivityItem[] = [
  { id: "1", text: "PKT-050: produtividade caiu 30% — equipe parada por falta de material", time: "Hoje 08:00", type: "alert" },
  { id: "2", text: "PKT-042: produtividade 22 m2/dia — 28% acima da media — candidata a bonus", time: "Hoje 10:00", type: "completed" },
  { id: "3", text: "2 equipes sem diario de obra ontem — Gamma e Epsilon", time: "Hoje 08:30", type: "alert" },
  { id: "4", text: "PKT-039: retencao R$ 8.5k vencida — liberar para Karla", time: "Ontem 14:00", type: "alert" },
];

export function DeptPmoPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Cronograma", icon: MapPin, color: TEAL, onClick: () => tabRef.current?.("prod") },
    { label: "Report", icon: BarChart3, color: BLUE, onClick: () => tabRef.current?.("prod") },
    { label: "Retencoes", icon: Target, color: ORANGE, badge: "1", onClick: () => tabRef.current?.("retencoes") },
    { label: "Diarios", icon: FileText, color: YELLOW, badge: "2", onClick: () => tabRef.current?.("prod") },
    { label: "Solicitar Compras", icon: ShoppingCart, color: "#10B981", onClick: () => document.dispatchEvent(new CustomEvent("open-solicitar-compras")) },
  ];
  return <DeptPage deptId="produtividade" extraTabs={extraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
