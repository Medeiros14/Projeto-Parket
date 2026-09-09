/* ═══ OBRAS — Visao da Dany (Coordenadora de Equipes) ═══ */
import React from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, CTip, SolicitacaoComprasTab, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT, BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "../components/dept-layout";
import { HardHat, MapPin, Cloud, FileText, Camera, ClipboardCheck, AlertTriangle, CheckCircle2, Calendar, ShoppingCart, Users, Building2, Clock, ChevronDown, ChevronUp, Plus, X, MessageSquare, Phone, Send, Square, RefreshCw, CircleDot, BarChart3 } from "lucide-react";
import { useObrasExtra } from "../hooks/useObrasExtra";
import { useEquipesParket } from "../hooks/useEquipesParket";
import { useCheckDiario, useHistoricoPrestadores, GRUPO_OBRAS_JID, setGrupoObrasJid, type PrestadorHistorico } from "../hooks/useCheckDiario";
import { supabase } from "../lib/supabase";
import { Modal, FormField, FInput, FSelect, Btn } from "../components/modal";
import EquipesParketPanel from "../components/equipes-parket-panel";

const EQUIPES_CAMPO = [
  { equipe: "Equipe Alpha", lider: "Marcos R.", obra: "PKT-042", local: "Ipiranga, SP", progresso: 88, tipo: "piso", membros: 3, status: "executando" },
  { equipe: "Equipe Beta", lider: "Ricardo S.", obra: "PKT-053", local: "Paulista, SP", progresso: 0, tipo: "rev", membros: 2, status: "mobilizacao" },
  { equipe: "Equipe Gamma", lider: "Tiago M.", obra: "PKT-050", local: "Jardins, SP", progresso: 55, tipo: "marc", membros: 4, status: "PARADA" },
  { equipe: "Equipe Delta", lider: "Fernando L.", obra: "PKT-048", local: "Vila Madalena, SP", progresso: 40, tipo: "piso+forro", membros: 3, status: "executando" },
  { equipe: "Equipe Epsilon", lider: "Diego A.", obra: "PKT-047", local: "Pinheiros, SP", progresso: 0, tipo: "rev+deck", membros: 0, status: "SEM PROJETO" },
];

const TRES_PILARES = [
  { pilar: "Projeto Aprovado", total: 7, ok: 5, percent: 71, desc: "Projeto executivo aprovado + gate freeze" },
  { pilar: "Material na Obra", total: 7, ok: 6, percent: 86, desc: "Insumos conferidos e disponiveis" },
  { pilar: "Pre-Requisitos", total: 7, ok: 5, percent: 71, desc: "Vistoria + contrapiso + EPI + ferramentas" },
];

const DIARIOS_HOJE = [
  { equipe: "Equipe Alpha", obra: "PKT-042", preenchido: true, m2: 22, obs: "Piso 88% — finalizando ult. ambiente" },
  { equipe: "Equipe Delta", obra: "PKT-048", preenchido: true, m2: 15, obs: "Piso 60% — forro iniciado" },
  { equipe: "Equipe Gamma", obra: "PKT-050", preenchido: false, m2: 0, obs: "PARADA — falta cola e pivots" },
  { equipe: "Equipe Beta", obra: "PKT-053", preenchido: true, m2: 0, obs: "Mobilizacao — checklist em andamento" },
  { equipe: "Equipe Epsilon", obra: "PKT-047", preenchido: false, m2: 0, obs: "SEM PROJETO — nao iniciar" },
];

const CRONOGRAMA = [
  { obra: "PKT-042", inicio: "10/02", prev: "13/03", real: "12/03", status: "adiantado", dias: -1 },
  { obra: "PKT-050", inicio: "17/02", prev: "21/03", real: "—", status: "atrasado", dias: 6 },
  { obra: "PKT-048", inicio: "24/02", prev: "28/03", real: "—", status: "no prazo", dias: 0 },
  { obra: "PKT-053", inicio: "10/03", prev: "04/04", real: "—", status: "aguardando", dias: 0 },
  { obra: "PKT-047", inicio: "—", prev: "—", real: "—", status: "bloqueado", dias: 12 },
];

/* ── Sub-componentes dinâmicos ── */
function EquipesCampoTab() {
  const { equipes: dbEquipes, diarios: dbDiarios, cronograma: dbCronograma } = useObrasExtra();
  const equipes = dbEquipes.length > 0 ? dbEquipes.map(e => ({
    equipe: e.equipe, lider: e.lider, obra: e.obra_code,
    local: e.local, progresso: e.progresso, tipo: e.tipo,
    membros: e.membros, status: e.status,
  })) : EQUIPES_CAMPO;
  const diarios = dbDiarios.length > 0 ? dbDiarios.map(d => ({
    equipe: d.equipe, obra: d.obra_code, preenchido: d.preenchido,
    m2: d.m2 ?? 0, obs: d.obs ?? "",
  })) : DIARIOS_HOJE;
  const cronograma = dbCronograma.length > 0 ? dbCronograma.map(c => ({
    obra: c.obra_code,
    inicio: c.inicio,
    prev: c.fim_previsto,
    real: c.fim_real ?? "—",
    status: c.status === "em_andamento" ? "em andamento" : c.status,
    dias: 0,
  })) : CRONOGRAMA;

  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Equipes em Campo</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{equipes.length} equipes · {equipes.reduce((s, e) => s + e.membros, 0)} instaladores</p></div>
      <div className="space-y-3">
        {equipes.map((e, i) => {
          const sc = e.status === "executando" ? GREEN : e.status === "deslocamento" ? BLUE : e.status === "pausado" ? RED : YELLOW;
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: e.status === "pausado" ? "rgba(239,68,68,0.03)" : CARD_BG, border: `1px solid ${e.status === "pausado" ? "rgba(239,68,68,0.15)" : BORDER}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HardHat size={14} style={{ color: sc }} />
                  <span className="text-white" style={{ fontSize: "0.82rem", fontWeight: 600 }}>{e.equipe}</span>
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{e.status}</span>
                </div>
                <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{e.membros} pessoas</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <div><p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Obra</p><p style={{ fontSize: "0.65rem", color: ACCENT }}>{e.obra}</p></div>
                <div><p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Lider</p><p style={{ fontSize: "0.65rem", color: TEXT_MED }}>{e.lider}</p></div>
                <div><p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Local</p><p style={{ fontSize: "0.65rem", color: TEXT_MED }}>{e.local}</p></div>
                <div><p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Tipo</p><p style={{ fontSize: "0.65rem", color: TEXT_MED }}>{e.tipo}</p></div>
              </div>
              {e.progresso > 0 && (
                <div>
                  <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${e.progresso}%`, background: e.progresso > 75 ? GREEN : ORANGE }} />
                  </div>
                  <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{e.progresso}% concluido</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PilaresTab() {
  const { diarios: dbDiarios, cronograma: dbCronograma, marcarDiario, criarDiario } = useObrasExtra();
  const [novoModal, setNovoModal] = React.useState(false);
  const [diarioForm, setDiarioForm] = React.useState({ equipe: "", obra_code: "", m2: "", obs: "" });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    const h = () => setNovoModal(true);
    document.addEventListener("open-novo-diario", h);
    return () => document.removeEventListener("open-novo-diario", h);
  }, []);
  const rawDiarios = dbDiarios.length > 0 ? dbDiarios : null;
  const diarios = rawDiarios
    ? rawDiarios.map(d => ({ id: d.id, equipe: d.equipe, obra: d.obra_code, preenchido: d.preenchido, m2: d.m2 ?? 0, obs: d.obs ?? "" }))
    : DIARIOS_HOJE.map((d, i) => ({ id: String(i), ...d }));
  const cronograma = dbCronograma.length > 0 ? dbCronograma.map(c => ({
    obra: c.obra_code, inicio: c.inicio, prev: c.fim_previsto,
    status: c.status === "em_andamento" ? "em andamento" : c.status, dias: 0,
  })) : CRONOGRAMA;

  const handleMarcar = async (d: typeof diarios[0]) => {
    if (!rawDiarios) return;
    await marcarDiario(d.id, { m2: d.m2, obs: d.obs });
  };

  const handleCriar = async () => {
    setSaving(true);
    await criarDiario({ equipe: diarioForm.equipe, obra_code: diarioForm.obra_code, m2: Number(diarioForm.m2), obs: diarioForm.obs });
    setSaving(false);
    setNovoModal(false);
    setDiarioForm({ equipe: "", obra_code: "", m2: "", obs: "" });
  };

  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>3 Pilares — Pre-Requisitos de Obra</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Nenhuma obra comeca sem os 3 pilares verificados</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TRES_PILARES.map((p, i) => {
          const sc = p.percent >= 85 ? GREEN : p.percent >= 70 ? YELLOW : RED;
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 4 }}>{p.pilar}</p>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, color: sc }}>{p.percent}%</span>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 4 }}>{p.ok}/{p.total} obras OK</p>
              <div className="w-full h-2 rounded-full mt-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${p.percent}%`, background: sc }} />
              </div>
              <p style={{ fontSize: "0.5rem", color: TEXT_DIM, marginTop: 6 }}>{p.desc}</p>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Diarios de Obra — Hoje</p>
          <Btn color={GREEN} onClick={() => setNovoModal(true)}>+ Novo Diario</Btn>
        </div>
        <div className="space-y-2">
          {diarios.map((d, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${!d.preenchido ? "rgba(239,68,68,0.12)" : BORDER}` }}>
              <button
                onClick={() => !d.preenchido && handleMarcar(d)}
                style={{ cursor: d.preenchido ? "default" : "pointer", background: "none", border: "none", padding: 0 }}
                title={d.preenchido ? "Diario preenchido" : "Clique para marcar como preenchido"}
              >
                {d.preenchido ? <CheckCircle2 size={14} style={{ color: GREEN }} /> : <AlertTriangle size={14} style={{ color: RED }} />}
              </button>
              <div className="flex-1">
                <p className="text-white" style={{ fontSize: "0.72rem" }}>{d.equipe} — {d.obra}</p>
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{d.obs}{d.m2 > 0 ? ` · ${d.m2} m²/dia` : ""}</p>
              </div>
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: d.preenchido ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: d.preenchido ? GREEN : RED }}>{d.preenchido ? "OK" : "PENDENTE"}</span>
            </div>
          ))}
        </div>
      </div>
      <Modal open={novoModal} onClose={() => setNovoModal(false)} title="Novo Diario de Obra">
        <FormField label="Equipe"><FInput placeholder="Equipe Alpha" value={diarioForm.equipe} onChange={e => setDiarioForm(f => ({ ...f, equipe: e.target.value }))} /></FormField>
        <FormField label="Codigo da Obra"><FInput placeholder="PKT-042" value={diarioForm.obra_code} onChange={e => setDiarioForm(f => ({ ...f, obra_code: e.target.value }))} /></FormField>
        <FormField label="M2 Executados Hoje"><FInput type="number" placeholder="0" value={diarioForm.m2} onChange={e => setDiarioForm(f => ({ ...f, m2: e.target.value }))} /></FormField>
        <FormField label="Observacoes"><FInput placeholder="Situacao da obra, impedimentos..." value={diarioForm.obs} onChange={e => setDiarioForm(f => ({ ...f, obs: e.target.value }))} /></FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={GREEN} disabled={saving || !diarioForm.equipe || !diarioForm.obra_code} onClick={handleCriar}>{saving ? "Salvando..." : "Registrar Diario"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setNovoModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Cronograma Geral</p>
        <div className="space-y-2">
          {cronograma.map((c, i) => {
            const sc = c.status === "adiantado" ? GREEN : c.status === "atrasado" ? RED : c.status === "em andamento" || c.status === "no prazo" ? GREEN : c.status === "bloqueado" ? RED : YELLOW;
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, color: ACCENT, width: 60 }}>{c.obra}</span>
                <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Inicio: {c.inicio}</span>
                <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Prev: {c.prev}</span>
                <span className="flex-1" />
                {"dias" in c && c.dias !== 0 && <span style={{ fontSize: "0.55rem", color: sc }}>{(c.dias as number) > 0 ? `+${c.dias}d atraso` : `${c.dias}d adiantado`}</span>}
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{c.status}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ CHECK DIÁRIO ═══ */
function CheckDiarioTab() {
  const { checks, loading, hoje, resumo, porObra, progresso, gerarChecksDoDia, dispararMensagens, cancelarDisparo, marcarStatus, marcarSemResposta, reload, enviarRelatorio } = useCheckDiario();
  const [marcandoId, setMarcandoId] = React.useState<string | null>(null);
  const [grupoJid, setGrupoJid] = React.useState(GRUPO_OBRAS_JID);
  const [showConfig, setShowConfig] = React.useState(false);
  const [ocorrenciaTexto, setOcorrenciaTexto] = React.useState("");
  const [gravidade, setGravidade] = React.useState("media");
  const sc = (s: string) => s === "ok" ? GREEN : s === "ocorrencia" ? RED : s === "enviado" ? YELLOW : s === "erro_envio" ? RED : s === "sem_resposta" ? ORANGE : TEXT_DIM;
  const sl = (s: string) => s === "ok" ? "✓ OK" : s === "ocorrencia" ? "⚠ Ocorrência" : s === "enviado" ? "⏳ Aguardando" : s === "erro_envio" ? "✕ Erro" : s === "sem_resposta" ? "— Sem resposta" : "● Pendente";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Check Diário de Obras</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Data: {new Date(hoje + "T12:00:00").toLocaleDateString("pt-BR")} · Disparo WhatsApp para prestadores ativos</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowConfig(!showConfig)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, fontSize: "0.55rem", background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: TEXT_DIM, cursor: "pointer" }}>⚙ Grupo</button>
          <button onClick={reload} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, fontSize: "0.55rem", background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: TEXT_DIM, cursor: "pointer" }}><RefreshCw size={11} /> Atualizar</button>
          {resumo.total > 0 && resumo.pendentes === 0 && <button onClick={enviarRelatorio} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, fontSize: "0.55rem", background: `${GREEN}15`, border: `1px solid ${GREEN}30`, color: GREEN, cursor: "pointer" }}><Send size={11} /> Relatório</button>}
          {resumo.enviados > 0 && resumo.pendentes === 0 && <button onClick={marcarSemResposta} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, fontSize: "0.55rem", background: `${ORANGE}15`, border: `1px solid ${ORANGE}30`, color: ORANGE, cursor: "pointer" }}>Fechar sem resposta</button>}
        </div>
      </div>
      {showConfig && <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600, marginBottom: 6 }}>Grupo WhatsApp de Obras</p>
        <div className="flex gap-2"><input value={grupoJid} onChange={e => setGrupoJid(e.target.value)} placeholder="JID do grupo — ex: 120363XXX@g.us" style={{ flex: 1, padding: "7px 10px", borderRadius: 6, background: "#0a0a0a", border: `1px solid ${BORDER}`, color: "white", fontSize: "0.6rem", outline: "none" }} />
          <button onClick={() => { setGrupoObrasJid(grupoJid); setShowConfig(false); }} style={{ padding: "7px 14px", borderRadius: 6, fontSize: "0.6rem", fontWeight: 600, background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30`, cursor: "pointer" }}>Salvar</button></div>
      </div>}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[{ l: "Total", v: resumo.total, c: ACCENT }, { l: "Pendentes", v: resumo.pendentes, c: TEXT_DIM }, { l: "Enviados", v: resumo.enviados, c: YELLOW }, { l: "OK", v: resumo.oks, c: GREEN }, { l: "Ocorrências", v: resumo.ocorrencias, c: RED }, { l: "Sem resposta", v: resumo.semResposta, c: ORANGE }].map(s =>
          <div key={s.l} className="rounded-lg p-3 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}><span style={{ fontSize: "1.1rem", fontWeight: 700, color: s.c, display: "block" }}>{s.v}</span><p style={{ fontSize: "0.45rem", color: TEXT_DIM, marginTop: 2 }}>{s.l}</p></div>)}
      </div>
      <div className="rounded-xl p-4" style={{ background: "rgba(37,211,102,0.04)", border: "1px solid rgba(37,211,102,0.15)" }}>
        {progresso.running ? <div>
          <div className="flex items-center justify-between mb-2"><p style={{ fontSize: "0.7rem", color: "#25D366", fontWeight: 600 }}><Send size={12} style={{ display: "inline", marginRight: 6 }} />Disparando… {progresso.enviados}/{progresso.total}</p>
            <button onClick={cancelarDisparo} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: "0.55rem", background: `${RED}15`, border: `1px solid ${RED}30`, color: RED, cursor: "pointer" }}><Square size={10} /> Parar</button></div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 6 }}><div style={{ height: "100%", width: `${progresso.total > 0 ? (progresso.enviados / progresso.total) * 100 : 0}%`, borderRadius: 3, background: "#25D366", transition: "width 0.5s" }} /></div>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{progresso.atual}</p>
        </div> : <div className="flex items-center gap-3">
          {resumo.total === 0 ? <button onClick={gerarChecksDoDia} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: "0.65rem", fontWeight: 700, background: "#25D366", color: "#000", border: "none", cursor: "pointer" }}><CircleDot size={13} /> Gerar checks do dia</button>
            : resumo.pendentes > 0 ? <button onClick={dispararMensagens} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: "0.65rem", fontWeight: 700, background: "#25D366", color: "#000", border: "none", cursor: "pointer" }}><Send size={13} /> Disparar ({resumo.pendentes} pendentes)</button>
              : <div><p style={{ fontSize: "0.65rem", color: "#25D366", fontWeight: 600 }}>✓ Mensagens enviadas</p>
                {resumo.enviados > 0 && <p style={{ fontSize: "0.5rem", color: YELLOW, marginTop: 2 }}>🤖 Webhook ativo — respostas processadas em tempo real via Claude</p>}</div>}
          <p style={{ fontSize: "0.5rem", color: TEXT_DIM, flex: 1 }}>Anti-bloqueio: 25+ variações · delay 45-150s · personalizado</p>
        </div>}
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 30, color: TEXT_DIM }}>Carregando…</div> : porObra.length === 0 ?
        <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}><MessageSquare size={28} style={{ color: TEXT_DIM, margin: "0 auto 10px" }} /><p style={{ fontSize: "0.75rem", color: TEXT_DIM }}>Nenhum check gerado para hoje</p></div>
        : <div className="space-y-3">{porObra.map(obra => {
          const hasOc = obra.checks.some(c => c.status === "ocorrencia"); const allOk = obra.checks.every(c => c.status === "ok");
          return (<div key={obra.obra_id} className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${hasOc ? RED : allOk ? GREEN : BORDER}` }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <span className="text-white" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{obra.obra_titulo}</span>
              {obra.obra_codigo && <span style={{ fontSize: "0.5rem", color: ACCENT, background: `${ACCENT}15`, padding: "1px 6px", borderRadius: 4 }}>{obra.obra_codigo}</span>}
              <span style={{ marginLeft: "auto", fontSize: "0.5rem", color: TEXT_DIM }}>{obra.checks.length} prestador(es)</span></div>
            <div>{obra.checks.map(c => <div key={c.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${sc(c.status)}20`, fontSize: "0.45rem", fontWeight: 700, color: sc(c.status) }}>{c.prestador_nome.charAt(0)}</div>
              <div className="flex-1 min-w-0"><span style={{ fontSize: "0.65rem", color: "white", fontWeight: 500 }}>{c.prestador_nome}</span><span style={{ fontSize: "0.5rem", color: TEXT_DIM, marginLeft: 6 }}>— {c.prestador_categoria}</span>
                {c.ocorrencia_texto && <p style={{ fontSize: "0.55rem", color: RED, marginTop: 2 }}>⚠ {c.ocorrencia_texto}</p>}
                {c.resposta && c.status === "ok" && <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 2 }}>"{c.resposta}"</p>}</div>
              <span className="rounded-full px-2 py-0.5 flex-shrink-0" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc(c.status)}15`, color: sc(c.status) }}>{sl(c.status)}</span>
              {c.status === "enviado" && <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => marcarStatus(c.id, "ok", "Tudo certo")} style={{ fontSize: "0.45rem", padding: "3px 8px", borderRadius: 4, background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30`, cursor: "pointer" }}>OK</button>
                <button onClick={() => setMarcandoId(c.id)} style={{ fontSize: "0.45rem", padding: "3px 8px", borderRadius: 4, background: `${RED}15`, color: RED, border: `1px solid ${RED}30`, cursor: "pointer" }}>Ocorrência</button></div>}
            </div>)}</div></div>);
        })}</div>}
      {marcandoId && <div onClick={() => setMarcandoId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, width: 400 }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: RED, marginTop: 0 }}>Registrar Ocorrência</h3>
          <textarea value={ocorrenciaTexto} onChange={e => setOcorrenciaTexto(e.target.value)} rows={3} placeholder="Descreva o problema…" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "#0a0a0a", border: `1px solid ${BORDER}`, color: "white", fontSize: "0.65rem", outline: "none", resize: "vertical", boxSizing: "border-box" as const, marginBottom: 10 }} />
          <select value={gravidade} onChange={e => setGravidade(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "#0a0a0a", border: `1px solid ${BORDER}`, color: "white", fontSize: "0.65rem", outline: "none", marginBottom: 14 }}>
            <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></select>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setMarcandoId(null)} style={{ padding: "7px 14px", borderRadius: 6, fontSize: "0.6rem", background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: TEXT_DIM, cursor: "pointer" }}>Cancelar</button>
            <button onClick={async () => { await marcarStatus(marcandoId, "ocorrencia", undefined, ocorrenciaTexto, gravidade); setMarcandoId(null); setOcorrenciaTexto(""); }} style={{ padding: "7px 14px", borderRadius: 6, fontSize: "0.6rem", fontWeight: 700, background: RED, border: "none", color: "white", cursor: "pointer" }}>Registrar</button></div></div></div>}
    </div>);
}

/* ═══ RELATÓRIOS / HISTÓRICO POR PRESTADOR ═══ */
function RelatoriosPrestadoresTab() {
  const { historico, detalhe, loading, carregarDetalhe } = useHistoricoPrestadores();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected = historico.find(h => h.prestador_id === selectedId);

  return (
    <div className="space-y-4">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Relatórios por Prestador</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Histórico de checks, ocorrências e performance de cada equipe</p></div>

      {loading ? <div style={{ textAlign: "center", padding: 30, color: TEXT_DIM }}>Carregando...</div> : historico.length === 0 ?
        <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}><p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhum histórico disponível. Execute checks diários para gerar dados.</p></div>
      : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lista de prestadores */}
          <div className="space-y-2">
            {historico.map(h => {
              const isActive = selectedId === h.prestador_id;
              const barOk = h.total_checks > 0 ? (h.total_ok / h.total_checks) * 100 : 0;
              const barOc = h.total_checks > 0 ? (h.total_ocorrencias / h.total_checks) * 100 : 0;
              return (
                <button key={h.prestador_id} onClick={() => { setSelectedId(h.prestador_id); carregarDetalhe(h.prestador_id); }}
                  className="w-full rounded-xl p-4 text-left transition-all" style={{ background: isActive ? `${TEAL}08` : CARD_BG, border: `1px solid ${isActive ? TEAL : BORDER}` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${TEAL}20`, color: TEAL, fontSize: "0.55rem", fontWeight: 700 }}>{h.prestador_nome.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <span style={{ fontSize: "0.75rem", color: "white", fontWeight: 600 }}>{h.prestador_nome}</span>
                      <span style={{ fontSize: "0.5rem", color: TEXT_DIM, marginLeft: 6 }}>— {h.prestador_categoria}</span>
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: h.pct_ok >= 80 ? GREEN : h.pct_ok >= 50 ? YELLOW : RED }}>{h.pct_ok}%</span>
                  </div>
                  {/* Barra de performance */}
                  <div className="flex gap-0.5 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ width: `${barOk}%`, background: GREEN, borderRadius: 4 }} />
                    <div style={{ width: `${barOc}%`, background: RED, borderRadius: 4 }} />
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span style={{ fontSize: "0.5rem", color: GREEN }}>✓ {h.total_ok} ok</span>
                    <span style={{ fontSize: "0.5rem", color: RED }}>⚠ {h.total_ocorrencias} ocorrências</span>
                    <span style={{ fontSize: "0.5rem", color: ORANGE }}>⏳ {h.total_sem_resposta} s/ resp</span>
                    <span style={{ fontSize: "0.5rem", color: TEXT_DIM, marginLeft: "auto" }}>{h.total_checks} checks · {h.dias_verificados} dias · {h.obras_distintas} obras</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalhe do prestador selecionado */}
          {selected && (
            <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${TEAL}20`, color: TEAL, fontSize: "0.7rem", fontWeight: 700 }}>{selected.prestador_nome.charAt(0)}</div>
                <div>
                  <p style={{ fontSize: "0.85rem", color: "white", fontWeight: 700 }}>{selected.prestador_nome}</p>
                  <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{selected.prestador_categoria} · {selected.prestador_telefone || "—"}</p>
                </div>
              </div>
              {/* Métricas */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="rounded-lg p-2 text-center" style={{ background: `${GREEN}10` }}><span style={{ fontSize: "1rem", fontWeight: 700, color: GREEN }}>{selected.total_ok}</span><p style={{ fontSize: "0.4rem", color: GREEN }}>OK</p></div>
                <div className="rounded-lg p-2 text-center" style={{ background: `${RED}10` }}><span style={{ fontSize: "1rem", fontWeight: 700, color: RED }}>{selected.total_ocorrencias}</span><p style={{ fontSize: "0.4rem", color: RED }}>Ocorrências</p></div>
                <div className="rounded-lg p-2 text-center" style={{ background: `${ORANGE}10` }}><span style={{ fontSize: "1rem", fontWeight: 700, color: ORANGE }}>{selected.total_sem_resposta}</span><p style={{ fontSize: "0.4rem", color: ORANGE }}>S/ Resposta</p></div>
                <div className="rounded-lg p-2 text-center" style={{ background: `${TEAL}10` }}><span style={{ fontSize: "1rem", fontWeight: 700, color: TEAL }}>{selected.dias_verificados}</span><p style={{ fontSize: "0.4rem", color: TEAL }}>Dias</p></div>
              </div>
              {/* Timeline */}
              <p style={{ fontSize: "0.5rem", color: ACCENT, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Últimos checks</p>
              <div className="space-y-1.5" style={{ maxHeight: 350, overflowY: "auto" }}>
                {detalhe.map(d => {
                  const dc = d.status === "ok" ? GREEN : d.status === "ocorrencia" ? RED : d.status === "sem_resposta" ? ORANGE : TEXT_DIM;
                  return (
                    <div key={d.id} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: `${dc}06`, border: `1px solid ${dc}15` }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: dc }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: "0.6rem", color: "white", fontWeight: 500 }}>{d.data}</span>
                          <span style={{ fontSize: "0.5rem", color: dc, fontWeight: 600 }}>{d.status === "ok" ? "OK" : d.status === "ocorrencia" ? "OCORRÊNCIA" : d.status === "sem_resposta" ? "SEM RESPOSTA" : d.status.toUpperCase()}</span>
                          <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{d.obra_titulo}</span>
                        </div>
                        {d.resposta && <p style={{ fontSize: "0.55rem", color: TEXT_MED, marginTop: 2 }}>"{d.resposta}"</p>}
                        {d.ocorrencia_texto && <p style={{ fontSize: "0.55rem", color: RED, marginTop: 1 }}>⚠ {d.ocorrencia_texto}</p>}
                      </div>
                    </div>
                  );
                })}
                {detalhe.length === 0 && <p style={{ fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center", padding: 16 }}>Selecione um prestador para ver o histórico</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ ACOMPANHAMENTO DE OBRAS (com seletor de equipes) ═══ */
function AcompanhamentoObrasTabObras() {
  const [obras, setObras] = React.useState<any[]>([]);
  const [loadingObras, setLoadingObras] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const loadObras = React.useCallback(async () => {
    setLoadingObras(true);
    const { data } = await supabase.from("kanban_cards").select("id,title,obra,responsavel,progress,details,column_id,updated_at").eq("dept_id", "obras").order("updated_at", { ascending: false });
    setObras(data ?? []); setLoadingObras(false);
  }, []);
  React.useEffect(() => { loadObras(); }, [loadObras]);
  if (loadingObras) return <div style={{ textAlign: "center", padding: 40, color: TEXT_DIM, fontSize: "0.7rem" }}>Carregando obras...</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Acompanhamento de Obras</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{obras.length} obras · Expanda para atribuir equipes</p></div>
        <button onClick={loadObras} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ fontSize: "0.6rem", fontWeight: 600, background: `${RED}10`, color: RED, border: `1px solid ${RED}25`, cursor: "pointer" }}><Clock size={11} /> Atualizar</button></div>
      <div className="space-y-2">{obras.map(obra => {
        const det = (obra.details ?? {}) as Record<string, any>; const prestadores: any[] = det.prestadores ?? [];
        const expanded = expandedId === obra.id; const pct = obra.progress ?? 0; const sColor = pct >= 100 ? GREEN : pct > 0 ? BLUE : TEXT_DIM;
        return (<div key={obra.id} className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${expanded ? `${RED}40` : BORDER}` }}>
          <button onClick={() => setExpandedId(expanded ? null : obra.id)} className="w-full flex items-center gap-3 p-4 text-left" style={{ cursor: "pointer" }}>
            <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}><svg width={40} height={40} style={{ transform: "rotate(-90deg)" }}><circle cx={20} cy={20} r={16} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3.5} /><circle cx={20} cy={20} r={16} fill="none" stroke={sColor} strokeWidth={3.5} strokeDasharray={`${(pct/100)*100} 100`} strokeLinecap="round" /></svg>
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.48rem", fontWeight: 700, color: sColor }}>{pct}%</span></div>
            <div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><span className="text-white truncate" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{obra.title}</span>
              {obra.obra && <span style={{ fontSize: "0.5rem", color: ACCENT, background: `${ACCENT}15`, padding: "1px 6px", borderRadius: 4 }}>{obra.obra}</span>}</div>
              <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{obra.responsavel}</span>
              {prestadores.length > 0 ? <p style={{ fontSize: "0.6rem", color: ORANGE, marginTop: 4, lineHeight: 1.5 }}><span style={{ fontWeight: 600 }}>Equipes: </span>{prestadores.map((p: any, i: number) => <span key={p.id}><span style={{ color: "white", fontWeight: 500 }}>{p.nome}</span><span style={{ color: TEXT_DIM }}> - {p.categoria}</span>{i < prestadores.length - 1 && <span style={{ color: TEXT_DIM }}>, </span>}</span>)}</p>
                : <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 4, fontStyle: "italic" }}>Sem equipe — clique para alocar</p>}</div>
            <div className="flex items-center gap-2 shrink-0">{expanded ? <ChevronUp size={14} style={{ color: TEXT_DIM }} /> : <ChevronDown size={14} style={{ color: TEXT_DIM }} />}</div></button>
          {expanded && <div style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px" }}><PrestadoresInlineObras obraId={obra.id} details={det} onUpdated={loadObras} /></div>}
        </div>);
      })}</div></div>);
}

/* ═══ SELETOR INLINE DE PRESTADORES ═══ */
function PrestadoresInlineObras({ obraId, details, onUpdated }: { obraId: string; details: Record<string, any>; onUpdated: () => void }) {
  const { porCategoria, addMembro, CATEGORIAS_ORDEM, categorias: existingCats } = useEquipesParket();
  const [prestadores, setPrestadores] = React.useState<Array<{id:string;nome:string;telefone?:string;categoria:string}>>(details.prestadores ?? []);
  const [showPicker, setShowPicker] = React.useState(false); const [filtro, setFiltro] = React.useState(""); const [showNew, setShowNew] = React.useState(false);
  const [newTeam, setNewTeam] = React.useState({ nome: "", telefone: "", categoria: "" }); const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { setPrestadores(details.prestadores ?? []); }, [details.prestadores]);
  const save = async (next: typeof prestadores) => { setSaving(true); await supabase.from("kanban_cards").update({ details: { ...details, prestadores: next } }).eq("id", obraId); setSaving(false); onUpdated(); };
  const add = async (eq: {id:string;nome:string;telefone?:string|null;categoria:string}) => { if (prestadores.some(p => p.id === eq.id)) return; const next = [...prestadores, {id:eq.id,nome:eq.nome,telefone:eq.telefone||undefined,categoria:eq.categoria}]; setPrestadores(next); await save(next); };
  const remove = async (id: string) => { const next = prestadores.filter(p => p.id !== id); setPrestadores(next); await save(next); };
  const allCats = [...CATEGORIAS_ORDEM, ...existingCats.filter(c => !CATEGORIAS_ORDEM.includes(c))];
  return (<div style={{ background: "rgba(20,184,166,0.08)", border: "2px solid rgba(20,184,166,0.3)", borderRadius: 10, padding: 14 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <p style={{ fontSize: "0.45rem", fontWeight: 700, letterSpacing: "0.1em", color: TEAL, textTransform: "uppercase" }}>Equipes Responsáveis {saving && <span style={{ color: YELLOW, fontWeight: 400, fontStyle: "italic" }}>— salvando…</span>}</p>
      <div className="flex gap-1.5">
        <button onClick={() => setShowNew(!showNew)} style={{ fontSize: "0.5rem", padding: "3px 10px", borderRadius: 6, background: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}25`, cursor: "pointer" }}>+ Nova</button>
        <button onClick={() => setShowPicker(!showPicker)} style={{ fontSize: "0.5rem", padding: "3px 10px", borderRadius: 6, background: `${TEAL}15`, color: TEAL, border: `1px solid ${TEAL}30`, cursor: "pointer" }}>+ Adicionar</button></div></div>
    {showNew && <div className="rounded-lg p-3 mb-2 space-y-2" style={{ background: `${GREEN}05`, border: `1px solid ${GREEN}20` }}>
      <div className="grid grid-cols-3 gap-2"><input value={newTeam.nome} onChange={e => setNewTeam(s => ({...s, nome: e.target.value}))} placeholder="Nome" className="px-2 py-1.5 rounded bg-black/40 text-white outline-none" style={{ border: `1px solid ${BORDER}`, fontSize: "0.6rem" }} />
        <input value={newTeam.telefone} onChange={e => setNewTeam(s => ({...s, telefone: e.target.value}))} placeholder="Telefone" className="px-2 py-1.5 rounded bg-black/40 text-white outline-none" style={{ border: `1px solid ${BORDER}`, fontSize: "0.6rem" }} />
        <select value={newTeam.categoria} onChange={e => setNewTeam(s => ({...s, categoria: e.target.value}))} className="px-2 py-1.5 rounded bg-black/40 text-white outline-none" style={{ border: `1px solid ${BORDER}`, fontSize: "0.6rem" }}><option value="">Categoria…</option>{allCats.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      <div className="flex gap-2"><button onClick={async () => { if (!newTeam.nome || !newTeam.categoria) return; await addMembro(newTeam.nome, newTeam.telefone || null, newTeam.categoria); setShowNew(false); setNewTeam({nome:"",telefone:"",categoria:""}); }} className="rounded px-3 py-1" style={{ fontSize: "0.55rem", background: `${GREEN}20`, color: GREEN, border: `1px solid ${GREEN}30`, cursor: "pointer" }}>Salvar</button>
        <button onClick={() => setShowNew(false)} className="rounded px-3 py-1" style={{ fontSize: "0.55rem", color: TEXT_DIM, border: `1px solid ${BORDER}`, cursor: "pointer" }}>Cancelar</button></div></div>}
    {showPicker && <div className="rounded-lg p-2 mb-2" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${BORDER}`, maxHeight: 250, overflowY: "auto" }}>
      <input autoFocus value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar equipe…" className="w-full px-2 py-1.5 rounded bg-black/40 text-white outline-none mb-1" style={{ border: `1px solid ${BORDER}`, fontSize: "0.6rem" }} />
      {porCategoria.filter(c => c.membros.some(m => m.ativo && (!filtro || m.nome.toLowerCase().includes(filtro.toLowerCase()) || m.categoria.toLowerCase().includes(filtro.toLowerCase())))).map(cat => <div key={cat.categoria}>
        <p style={{ fontSize: "0.42rem", fontWeight: 700, color: ACCENT, textTransform: "uppercase", padding: "3px 0" }}>{cat.categoria}</p>
        {cat.membros.filter(m => m.ativo && (!filtro || m.nome.toLowerCase().includes(filtro.toLowerCase()))).map(m => {
          const added = prestadores.some(p => p.id === m.id);
          return <button key={m.id} onClick={() => !added && add(m)} disabled={added} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 4, border: "none", background: "transparent", cursor: added?"default":"pointer", opacity: added?0.35:1, textAlign: "left" }}><span style={{ fontSize: "0.6rem", color: "white" }}>{m.nome}</span><span style={{ fontSize: "0.48rem", color: TEXT_DIM }}>- {m.categoria}</span>{m.telefone && <span style={{ fontSize: "0.48rem", color: TEXT_DIM, marginLeft: "auto" }}>{m.telefone}</span>}{added && <span style={{ fontSize: "0.45rem", color: GREEN, marginLeft: "auto" }}>✓</span>}</button>;
        })}</div>)}
      <button onClick={() => setShowPicker(false)} style={{ width: "100%", padding: "5px", borderRadius: 4, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, color: TEXT_DIM, fontSize: "0.5rem", cursor: "pointer", marginTop: 4 }}>Fechar</button></div>}
    {prestadores.length > 0 ? <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{prestadores.map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
      <span style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: TEAL, color: "#000", fontSize: "0.45rem", fontWeight: 700, flexShrink: 0 }}>{p.nome.charAt(0)}</span>
      <span style={{ flex: 1, fontSize: "0.65rem", color: "white", fontWeight: 500 }}>{p.nome} <span style={{ color: TEXT_DIM, fontWeight: 400 }}>- {p.categoria}</span></span>
      {p.telefone && <a href={`https://wa.me/55${p.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener" style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{p.telefone}</a>}
      <button onClick={() => remove(p.id)} style={{ color: "#ef4444", cursor: "pointer", background: "none", border: "none", padding: 2, display: "flex" }}>✕</button></div>)}</div>
      : <p style={{ fontSize: "0.6rem", color: TEXT_DIM, fontStyle: "italic" }}>Nenhuma equipe — clique em Adicionar</p>}
  </div>);
}

const extraTabs: ExtraTab[] = [
  { id: "check-diario", label: "Check Diário", icon: CircleDot, render: () => <CheckDiarioTab /> },
  { id: "relatorios", label: "Relatórios", icon: BarChart3, render: () => <RelatoriosPrestadoresTab /> },
  { id: "acompanhamento", label: "Acompanhamento", icon: Building2, render: () => <AcompanhamentoObrasTabObras /> },
  { id: "equipes", label: "Equipes em Campo", icon: HardHat, render: () => <EquipesCampoTab /> },
  { id: "gestao-equipes", label: "Gestão de Equipes", icon: Users, render: () => <EquipesParketPanel accentColor={RED} titulo="Equipes Parket — Obras" /> },
  { id: "pilares", label: "3 Pilares", icon: CheckCircle2, render: () => <PilaresTab /> },
  { id: "solicitar-compras", label: "Solicitar Compras", icon: ShoppingCart, render: () => <SolicitacaoComprasTab /> },
];

const team: TeamMember[] = [];

const quickActions: QuickAction[] = [
  { label: "Diario Obra", icon: FileText, color: RED, badge: "2" },
  { label: "Foto Obra", icon: Camera, color: BLUE },
  { label: "Checklist", icon: ClipboardCheck, color: GREEN, badge: "3" },
  { label: "3 Pilares", icon: CheckCircle2, color: ORANGE },
];

const activity: ActivityItem[] = [
  { id: "1", text: "PKT-050: Equipe Alpha PARADA — falta cola e pivots — cobrar Ronaldo", time: "Hoje 08:00", type: "alert" },
  { id: "2", text: "PKT-053: Chuva prevista amanha — deck pode atrasar", time: "Hoje 07:30", type: "alert" },
  { id: "3", text: "PKT-042: Instalacao 88% — entrega prevista em 5 dias", time: "Hoje 10:00", type: "update" },
  { id: "4", text: "PKT-047: SEM PROJETO APROVADO — NAO INICIAR obra", time: "Ontem 14:00", type: "alert" },
  { id: "5", text: "2 diarios de obra pendentes ontem (Gamma, Epsilon)", time: "Ontem 18:00", type: "alert" },
];

export function DeptObrasPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Diario Obra", icon: FileText, color: RED, badge: "2", onClick: () => { tabRef.current?.("pilares"); setTimeout(() => document.dispatchEvent(new CustomEvent("open-novo-diario")), 80); } },
    { label: "Foto Obra", icon: Camera, color: BLUE, onClick: () => tabRef.current?.("pilares") },
    { label: "Checklist", icon: ClipboardCheck, color: GREEN, badge: "3", onClick: () => tabRef.current?.("pilares") },
    { label: "3 Pilares", icon: CheckCircle2, color: ORANGE, onClick: () => tabRef.current?.("pilares") },
    { label: "Solicitar Compras", icon: ShoppingCart, color: "#10B981", onClick: () => document.dispatchEvent(new CustomEvent("open-solicitar-compras")) },
  ];
  return <DeptPage deptId="obras" extraTabs={extraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
