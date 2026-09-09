/* ═══ PROJETISTA — Painel pessoal do projetista ═══ */
import React from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { LogOut, Plus, X, ChevronLeft, ChevronRight, Columns, Calendar, GitBranch, User } from "lucide-react";
import { Modal, FormField, FInput, FSelect, Btn } from "../components/modal";

/* ─── Cores ─── */
const BG     = "#0A0A0A";
const CARD   = "#111111";
const BORDER = "rgba(255,255,255,0.06)";
const ACCENT = "#D4A853";
const DIM    = "rgba(255,255,255,0.35)";
const MED    = "rgba(255,255,255,0.6)";
const BLUE   = "#3B82F6";
const GREEN  = "#10B981";
const YELLOW = "#F59E0B";
const RED    = "#EF4444";
const PURPLE = "#8B5CF6";
const ORANGE = "#F97316";

const COLS = [
  { id: "backlog",      label: "Backlog",      color: DIM    },
  { id: "em_andamento", label: "Em Andamento", color: BLUE   },
  { id: "revisao",      label: "Revisão",      color: YELLOW },
  { id: "aprovado",     label: "Aprovado",     color: GREEN  },
];

interface Demanda {
  id: string;
  projetista_id: string;
  obra_code: string;
  titulo: string;
  status: string;
  prazo: string | null;
  tipo: string;
  tamanho: string;
  prioridade: string;
}

interface ProjetosCard {
  id: string;
  title: string;
  obra: string;
}

/* ─── Hook de dados do projetista ─── */
function useMinhasDemandas(projetistaId: string | null) {
  const [demandas, setDemandas] = React.useState<Demanda[]>([]);
  const [projetos, setProjetos] = React.useState<ProjetosCard[]>([]);

  const fetch = React.useCallback(async () => {
    if (!projetistaId) return;
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from("projetos_demandas").select("*").eq("projetista_id", projetistaId).order("prazo"),
      supabase.from("kanban_cards").select("id,title,obra").eq("dept_id", "projetos").order("title").limit(500),
    ]);
    setDemandas(d ?? []);
    setProjetos((p ?? []) as ProjetosCard[]);
  }, [projetistaId]);

  React.useEffect(() => { fetch(); }, [fetch]);

  const mover = async (id: string, status: string) => {
    await supabase.from("projetos_demandas").update({ status }).eq("id", id);
    fetch();
  };

  const adicionar = async (card: Omit<Demanda, "id">) => {
    await supabase.from("projetos_demandas").insert(card);
    fetch();
  };

  const deletar = async (id: string) => {
    await supabase.from("projetos_demandas").delete().eq("id", id);
    fetch();
  };

  return { demandas, projetos, mover, adicionar, deletar, refetch: fetch };
}

/* ─── Kanban ─── */
function KanbanView({ projetistaId }: { projetistaId: string }) {
  const { demandas, projetos, mover, adicionar, deletar } = useMinhasDemandas(projetistaId);
  const [dragged, setDragged] = React.useState<string | null>(null);
  const [novoModal, setNovoModal] = React.useState(false);
  const [form, setForm] = React.useState({ kanban_card_id: "", obra_code: "", titulo: "", tipo: "Piso", tamanho: "medio", prioridade: "normal", prazo: "" });
  const [saving, setSaving] = React.useState(false);

  const handleSelectProjeto = (cardId: string) => {
    const p = projetos.find(x => x.id === cardId);
    if (!p) { setForm(f => ({ ...f, kanban_card_id: "", obra_code: "", titulo: "" })); return; }
    setForm(f => ({ ...f, kanban_card_id: p.id, obra_code: p.obra, titulo: p.title }));
  };

  const handleAdicionar = async () => {
    if (!form.kanban_card_id) return;
    setSaving(true);
    const { kanban_card_id, ...cardData } = form;
    await adicionar({ ...cardData, projetista_id: projetistaId, status: "backlog" });
    setSaving(false);
    setNovoModal(false);
    setForm({ kanban_card_id: "", obra_code: "", titulo: "", tipo: "Piso", tamanho: "medio", prioridade: "normal", prazo: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: "0.65rem", color: DIM }}>Arraste os cards entre colunas para atualizar o status</p>
        <Btn color={PURPLE} onClick={() => setNovoModal(true)}>+ Adicionar Projeto</Btn>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLS.map(col => (
          <div
            key={col.id}
            className="flex-shrink-0 rounded-xl p-3"
            style={{ width: 230, minHeight: 200, background: CARD, border: `1px solid ${BORDER}` }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragged) { mover(dragged, col.id); setDragged(null); } }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <p style={{ fontSize: "0.65rem", fontWeight: 600, color: col.color }}>{col.label}</p>
              <span className="ml-auto rounded-full px-1.5 py-0.5" style={{ fontSize: "0.45rem", background: `${col.color}15`, color: col.color }}>
                {demandas.filter(d => d.status === col.id).length}
              </span>
            </div>
            <div className="space-y-2">
              {demandas.filter(d => d.status === col.id).map(d => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={() => setDragged(d.id)}
                  className="rounded-lg p-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, cursor: "grab" }}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p className="text-white" style={{ fontSize: "0.68rem", fontWeight: 500, lineHeight: 1.3 }}>{d.titulo || d.obra_code}</p>
                    <button onClick={() => deletar(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: DIM, padding: 0, flexShrink: 0 }}><X size={10} /></button>
                  </div>
                  <p style={{ fontSize: "0.52rem", color: ACCENT }}>{d.obra_code}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="rounded px-1 py-0.5" style={{ fontSize: "0.4rem", background: `${BLUE}15`, color: BLUE }}>{d.tipo}</span>
                    <span className="rounded px-1 py-0.5" style={{ fontSize: "0.4rem", background: "rgba(255,255,255,0.05)", color: DIM }}>{d.tamanho}</span>
                    {d.prioridade === "urgente" && <span style={{ fontSize: "0.4rem", color: RED, fontWeight: 700 }}>URGENTE</span>}
                  </div>
                  {d.prazo && (
                    <p className="mt-1.5" style={{ fontSize: "0.45rem", color: DIM }}>Prazo: {d.prazo}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={novoModal} onClose={() => setNovoModal(false)} title="Adicionar Projeto">
        <FormField label="Projeto">
          <FSelect value={form.kanban_card_id} onChange={e => handleSelectProjeto(e.target.value)}>
            <option value="">Selecionar projeto...</option>
            {projetos.map(p => <option key={p.id} value={p.id}>{p.title}{p.obra ? ` — ${p.obra}` : ""}</option>)}
          </FSelect>
        </FormField>
        {form.kanban_card_id && (
          <div className="rounded-lg px-3 py-2" style={{ background: `${PURPLE}10`, border: `1px solid ${PURPLE}20` }}>
            <p style={{ fontSize: "0.55rem", color: DIM }}>Obra: <span style={{ color: ACCENT }}>{form.obra_code}</span></p>
            <p className="truncate mt-0.5" style={{ fontSize: "0.6rem", color: "white" }}>{form.titulo}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Tipo">
            <FSelect value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {["Piso","Marcenaria","Deck","Instalacao","Revestimento","Outros"].map(t => <option key={t}>{t}</option>)}
            </FSelect>
          </FormField>
          <FormField label="Tamanho">
            <FSelect value={form.tamanho} onChange={e => setForm(f => ({ ...f, tamanho: e.target.value }))}>
              <option value="pequeno">Pequeno</option>
              <option value="medio">Médio</option>
              <option value="grande">Grande</option>
            </FSelect>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Prioridade">
            <FSelect value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}>
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
              <option value="baixa">Baixa</option>
            </FSelect>
          </FormField>
          <FormField label="Prazo"><FInput type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={PURPLE} disabled={saving || !form.kanban_card_id} onClick={handleAdicionar}>{saving ? "Salvando..." : "Adicionar"}</Btn>
          <Btn color={DIM} variant="ghost" onClick={() => setNovoModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Calendário ─── */
function CalendarioView({ projetistaId }: { projetistaId: string }) {
  const [demandas, setDemandas] = React.useState<Demanda[]>([]);
  const today = new Date();
  const [mes, setMes] = React.useState(today.getMonth());
  const [ano, setAno] = React.useState(today.getFullYear());

  React.useEffect(() => {
    supabase.from("projetos_demandas").select("*").eq("projetista_id", projetistaId)
      .then(({ data }) => setDemandas(data ?? []));
  }, [projetistaId]);

  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const todayNum = today.getMonth() === mes && today.getFullYear() === ano ? today.getDate() : -1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < primeiroDia; i++) cells.push(null);
  for (let d = 1; d <= diasNoMes; d++) cells.push(d);

  const eventosNoDia = (dia: number) => {
    const s = `${ano}-${String(mes + 1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
    return demandas.filter(d => d.prazo === s);
  };
  const colStatus = (s: string) => s === "aprovado" ? GREEN : s === "em_andamento" ? BLUE : s === "revisao" ? YELLOW : DIM;

  const prevMes = () => { if (mes === 0) { setMes(11); setAno(a => a-1); } else setMes(m => m-1); };
  const nextMes = () => { if (mes === 11) { setMes(0); setAno(a => a+1); } else setMes(m => m+1); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMes} style={{ background:"none",border:"none",cursor:"pointer",color:DIM }}><ChevronLeft size={16}/></button>
        <span style={{ fontSize:"0.8rem",color:"white",fontWeight:600 }}>{meses[mes]} {ano}</span>
        <button onClick={nextMes} style={{ background:"none",border:"none",cursor:"pointer",color:DIM }}><ChevronRight size={16}/></button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border:`1px solid ${BORDER}` }}>
        <div className="grid grid-cols-7" style={{ background:"rgba(255,255,255,0.02)" }}>
          {diasSemana.map(d => <div key={d} className="py-2 text-center" style={{ fontSize:"0.5rem",color:DIM,fontWeight:600,borderRight:`1px solid ${BORDER}` }}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((dia, i) => {
            const ev = dia ? eventosNoDia(dia) : [];
            return (
              <div key={i} className="min-h-[60px] p-1.5" style={{ borderTop:`1px solid ${BORDER}`,borderRight:`1px solid ${BORDER}`,background: dia === todayNum ? `${PURPLE}08` : "transparent" }}>
                {dia && (
                  <>
                    <p style={{ fontSize:"0.6rem",color:dia===todayNum?PURPLE:DIM,fontWeight:dia===todayNum?700:400 }}>{dia}</p>
                    {ev.map(e => (
                      <div key={e.id} className="rounded px-1 py-0.5 mt-0.5 truncate" style={{ background:`${colStatus(e.status)}20`,border:`1px solid ${colStatus(e.status)}30` }}>
                        <p className="truncate" style={{ fontSize:"0.38rem",color:colStatus(e.status),fontWeight:600 }}>{e.titulo || e.obra_code}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Proximos prazos */}
      {demandas.filter(d => d.prazo).length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border:`1px solid ${BORDER}` }}>
          <div className="px-4 py-3" style={{ background:"rgba(255,255,255,0.02)" }}>
            <p style={{ fontSize:"0.7rem",fontWeight:600,color:"white" }}>Próximos Prazos</p>
          </div>
          {demandas.filter(d => d.prazo).sort((a,b) => (a.prazo??"")<(b.prazo??"") ? -1 : 1).slice(0,6).map(d => {
            const diff = d.prazo ? Math.ceil((new Date(d.prazo+"T00:00:00").getTime()-Date.now())/86400000) : null;
            const uc = diff===null ? DIM : diff<0 ? RED : diff<=3 ? ORANGE : diff<=7 ? YELLOW : GREEN;
            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop:`1px solid ${BORDER}` }}>
                <span style={{ fontSize:"0.62rem",fontWeight:600,color:ACCENT }}>{d.obra_code}</span>
                <span className="flex-1 truncate text-white" style={{ fontSize:"0.62rem" }}>{d.titulo}</span>
                <span style={{ fontSize:"0.52rem",color:DIM }}>{d.prazo}</span>
                {diff !== null && (
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize:"0.42rem",fontWeight:700,background:`${uc}15`,color:uc }}>
                    {diff<0?`${Math.abs(diff)}d atrasado`:diff===0?"Hoje":`${diff}d`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Timeline ─── */
function TimelineView({ projetistaId }: { projetistaId: string }) {
  const [demandas, setDemandas] = React.useState<Demanda[]>([]);

  React.useEffect(() => {
    supabase.from("projetos_demandas").select("*").eq("projetista_id", projetistaId)
      .then(({ data }) => setDemandas(data ?? []));
  }, [projetistaId]);

  const today = new Date();
  const startDate = new Date(today); startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(today); endDate.setDate(endDate.getDate() + 53);
  const DAY_PX = 28;
  const totalDays = Math.ceil((endDate.getTime()-startDate.getTime())/86400000);
  const todayX = Math.round((today.getTime()-startDate.getTime())/86400000)*DAY_PX;

  const weekMarks: {x:number;label:string}[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    if (cur.getDay()===1) weekMarks.push({ x:Math.round((cur.getTime()-startDate.getTime())/86400000)*DAY_PX, label:`${cur.getDate()}/${cur.getMonth()+1}` });
    cur.setDate(cur.getDate()+1);
  }

  const colStatus = (s: string) => s === "aprovado" ? GREEN : s === "em_andamento" ? BLUE : s === "revisao" ? YELLOW : DIM;
  const comPrazo = demandas.filter(d => d.prazo);

  if (comPrazo.length === 0) return (
    <div className="rounded-xl p-8 text-center" style={{ background:CARD,border:`1px solid ${BORDER}` }}>
      <p style={{ fontSize:"0.7rem",color:DIM }}>Nenhum projeto com prazo definido ainda.</p>
    </div>
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ border:`1px solid ${BORDER}` }}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 160+totalDays*DAY_PX }}>
          {/* Cabeçalho */}
          <div className="flex" style={{ borderBottom:`1px solid ${BORDER}`,background:"rgba(255,255,255,0.02)" }}>
            <div style={{ width:160,flexShrink:0,padding:"6px 12px" }}><p style={{ fontSize:"0.5rem",color:DIM,fontWeight:600,textTransform:"uppercase" }}>Projeto</p></div>
            <div className="relative flex-1" style={{ height:28,overflow:"hidden" }}>
              {weekMarks.map((w,i) => <div key={i} className="absolute" style={{ left:w.x,top:0,height:"100%",borderLeft:`1px solid ${BORDER}` }}><p style={{ fontSize:"0.42rem",color:DIM,paddingLeft:3,paddingTop:8 }}>{w.label}</p></div>)}
              <div className="absolute" style={{ left:todayX,top:0,height:"100%",borderLeft:`2px solid ${PURPLE}`,opacity:0.6 }}/>
            </div>
          </div>
          {/* Linhas */}
          {comPrazo.map((d,i) => {
            const prazoX = Math.round((new Date(d.prazo!+"T00:00:00").getTime()-startDate.getTime())/86400000)*DAY_PX;
            const sc = colStatus(d.status);
            const isLate = new Date(d.prazo!+"T00:00:00") < today;
            const barStart = Math.max(0, todayX - 5*DAY_PX);
            return (
              <div key={d.id} className="flex items-center" style={{ borderTop:i===0?"none":`1px solid ${BORDER}`,height:44,background:i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                <div style={{ width:160,flexShrink:0,padding:"0 12px" }}>
                  <p className="text-white truncate" style={{ fontSize:"0.65rem",fontWeight:500 }}>{d.titulo||d.obra_code}</p>
                  <p style={{ fontSize:"0.48rem",color:DIM }}>{d.tipo} · {d.tamanho}</p>
                </div>
                <div className="relative flex-1" style={{ height:"100%",overflow:"hidden" }}>
                  {weekMarks.map((w,wi) => <div key={wi} className="absolute" style={{ left:w.x,top:0,height:"100%",borderLeft:`1px solid ${BORDER}`,opacity:0.4 }}/>)}
                  <div className="absolute" style={{ left:todayX,top:0,height:"100%",borderLeft:`2px solid ${PURPLE}`,opacity:0.5 }}/>
                  <div className="absolute rounded" style={{ left:barStart,top:"50%",transform:"translateY(-50%)",width:Math.max(8,prazoX-barStart),height:16,background:`${sc}25`,border:`1px solid ${sc}50`,minWidth:24 }}/>
                  <div className="absolute flex items-center gap-1" style={{ left:prazoX-4,top:"50%",transform:"translateY(-50%)" }}>
                    <div className="rounded-sm" style={{ width:8,height:18,background:isLate?RED:sc,opacity:0.9 }}/>
                    <p style={{ fontSize:"0.42rem",color:isLate?RED:sc,fontWeight:600,whiteSpace:"nowrap" }}>{d.prazo}{isLate?" ATRASADO":""}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 px-4 py-2" style={{ borderTop:`1px solid ${BORDER}`,background:"rgba(255,255,255,0.01)" }}>
        {[{l:"Backlog",c:DIM},{l:"Em Andamento",c:BLUE},{l:"Revisão",c:YELLOW},{l:"Aprovado",c:GREEN}].map(x => (
          <div key={x.l} className="flex items-center gap-1.5">
            <div className="rounded-sm" style={{ width:10,height:10,background:`${x.c}30`,border:`1px solid ${x.c}60` }}/>
            <span style={{ fontSize:"0.45rem",color:DIM }}>{x.l}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div style={{ width:2,height:14,background:PURPLE,opacity:0.7 }}/>
          <span style={{ fontSize:"0.45rem",color:DIM }}>Hoje</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ─── */
const TABS = [
  { id: "kanban",    label: "Meu Kanban",  icon: Columns },
  { id: "calendar",  label: "Calendário",  icon: Calendar },
  { id: "timeline",  label: "Timeline",    icon: GitBranch },
];

export function ProjetistaPage() {
  const { user, projetistaId, signOut } = useAuth();
  const [tab, setTab] = React.useState("kanban");
  const [nome, setNome] = React.useState<string>("");

  // Busca nome do projetista
  React.useEffect(() => {
    if (!projetistaId) return;
    supabase.from("projetos_equipe").select("nome").eq("id", projetistaId).single()
      .then(({ data }) => { if (data) setNome(data.nome); });
  }, [projetistaId]);

  if (!projetistaId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <p style={{ color: DIM, fontSize: "0.8rem" }}>Conta não vinculada a nenhum projetista. Contate a gestora.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, background: "#0D0D0D" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${PURPLE}20` }}>
              <User size={16} style={{ color: PURPLE }} />
            </div>
            <div>
              <p className="text-white" style={{ fontSize: "0.82rem", fontWeight: 600 }}>{nome || user?.full_name || "Projetista"}</p>
              <p style={{ fontSize: "0.52rem", color: DIM }}>Painel de Projetos</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: DIM, cursor: "pointer", fontSize: "0.6rem" }}
          >
            <LogOut size={12} />
            Sair
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4" style={{ maxWidth: 1200, margin: "0 auto" }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-2.5"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "0.65rem", fontWeight: active ? 600 : 400,
                  color: active ? ACCENT : DIM,
                  borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
                }}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6" style={{ maxWidth: 1200, margin: "0 auto" }}>
        {tab === "kanban"   && <KanbanView    projetistaId={projetistaId} />}
        {tab === "calendar" && <CalendarioView projetistaId={projetistaId} />}
        {tab === "timeline" && <TimelineView  projetistaId={projetistaId} />}
      </div>
    </div>
  );
}
