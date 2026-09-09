/* ═══ FISCAL — Departamento Fiscal de Obras ═══ */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, SolicitacaoComprasTab, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT, BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD } from "../components/dept-layout";
import { Search, Ruler, ClipboardCheck, FileText, Calendar, Camera, MapPin, CheckCircle2, AlertTriangle, ShoppingCart, Users, Plus, Edit2, Trash2, Phone, Mail, Shield, X, Upload, ChevronDown, ChevronRight, Eye, Save } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Modal, FormField, FInput, FSelect, FTextarea, Btn, StatusSelect } from "../components/modal";
import { PhotoAnnotator, AnnotationBadge, type Annotations } from "../components/photo-annotator";

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS & CHECKLIST DATA
   ═══════════════════════════════════════════════════════════════════ */

const TIPO_OPTIONS = [
  { value: "1vistoria", label: "1a Vistoria" },
  { value: "2vistoria", label: "2a Vistoria" },
  { value: "acompanhamento", label: "Acompanhamento" },
  { value: "entrega", label: "Entrega" },
  { value: "reparo", label: "Reparo" },
];

const STATUS_COLORS: Record<string, string> = {
  pendente: YELLOW,
  em_andamento: BLUE,
  concluido: GREEN,
  cancelado: RED,
  agendada: GREEN,
  realizada: BLUE,
  confirmada: PURPLE,
};

/* — 1a VISTORIA — */
const CK_1V_PISO = [
  "Encontra-se nivelado e sem ondulacoes",
  "Encontra-se liso",
  "Apresenta arenoso",
  "Apresenta buracos ou calombos",
  "Pisos frios finalizados",
  "A espessura deixada para o nosso piso esta de acordo com o nivel dos pisos frios",
  "Baguetes finalizadas",
  "Tem espaco para dilatacao do rodape invertido",
  "Soleiras finalizadas",
  "Hidraulica esta finalizada",
  "Eletrica esta finalizada",
  "Gesso finalizado",
  "Massa corrida finalizada",
  "Primeira demao de tinta finalizada",
  "Portas instaladas",
  "Janelas instaladas",
  "Vidros e esquadrias instalados",
  "Realizada medicao final",
  "Cacamba disponivel",
  "Area de instalacao livre de objetos e pessoas",
  "Umidade no contrapiso",
  "Area liberada para instalacao?",
];

const CK_1V_DECK = [
  "Hidraulica esta finalizada",
  "Eletrica esta finalizada",
  "Pisos frios finalizados",
  "Alcapoes no contrapiso",
  "Espessura deixada para nosso material acabado esta de acordo",
  "Estrutura metalica finalizada (caso tenha)",
  "Tem encontro com piscinas/spas",
  "Tem escada na area de instalacao do deck",
  "Vidros e esquadrias instalados",
  "Realizada a medicao final",
  "Cacamba disponivel",
  "Area de instalacao livre de objetos e pessoas",
  "Area liberada para instalacao?",
];

const CK_1V_FORRO = [
  "Laje finalizada",
  "A laje tem alguma especificacao",
  "Area de instalacao do forro tem encontro com outros tipos de forros",
  "Vai ter cortineiro/sanca",
  "Vai ter beiral",
  "Estrutura do beiral finalizada",
  "Paredes finalizadas",
  "Portas instaladas",
  "Janelas instaladas",
  "Vidros e esquadrias instalados",
  "Hidraulica esta finalizada",
  "Eletrica esta finalizada",
  "Realizada a medicao final",
  "Cacamba disponivel",
  "Area de instalacao livre de objetos e pessoas",
  "Existe necessidade de andaime e escada",
  "Umidade na laje",
  "Area liberada para instalacao?",
  "Projeto confere com a obra",
];

const CK_1V_FORRO_EXTRA = [
  { q: "Qual o tipo de laje?", type: "text" as const },
  { q: "Sera necessario algum reforco?", type: "text" as const },
  { q: "Quais insumos serao necessario?", type: "text" as const },
];

const CK_1V_PAINEL = [
  "Parede estruturada",
  "Parede requadrada",
  "Parede sem buracos",
  "Parede masseada",
  "Existe encontro com outros materiais",
  "Rodape finalizado",
  "Cacamba disponivel",
  "Area de instalacao livre de objetos e pessoas",
  "Existe necessidade de andaime e escada",
  "Caso forro e piso nao sejam Parket: Forro finalizado",
  "Caso forro e piso nao sejam Parket: Piso finalizado",
  "Realizada a medicao fina",
];

/* — 2a VISTORIA — */
const CK_2V_LIBERACAO = [
  "Area liberada para instalacao?",
  "Andaimes em obra",
  "Insumos e material em obra",
];

const CK_2V_PISO = [
  "O contrapiso esta apto a instalacao",
  "Pisos frios finalizados",
  "A espessura deixada para o nosso piso esta de acordo com o nivel dos pisos frios",
  "Baguetes/soleiras finalizadas",
  "Tem espaco para dilatacao do rodape invertido",
  "Hidraulica esta finalizada",
  "Eletrica esta finalizada",
  "Gesso/massa corrida e pintura finalizado",
  "Portas/janelas/vidros e esquadrias instalados",
  "Realizada medicao",
  "Cacamba disponivel",
  "Area de instalacao livre de objetos e pessoas",
  "Umidade no contrapiso",
  "Area liberada para instalacao?",
];

const CK_2V_DECK = [
  "Hidraulica esta finalizada",
  "Eletrica esta finalizada",
  "Pisos frios finalizados",
  "Alcapoes no contrapiso",
  "Espessura deixada para nosso material acabado esta de acordo",
  "Estrutura metalica finalizada (caso tenha)",
  "Tem encontro com piscinas/spas",
  "Tem escada na area de instalacao do deck",
  "Vidros e esquadrias instalados",
  "Realizada a medicao final",
  "Cacamba disponivel",
  "Area de instalacao livre de objetos e pessoas",
];

const CK_2V_FORRO = CK_1V_FORRO;
const CK_2V_PAINEL = CK_1V_PAINEL;

/* — ACOMPANHAMENTO — */
const CK_ACOMP_EQUIPE = ["Uniformizados", "Postura em obra", "Uso de EPI"];
const CK_ACOMP_PRODUTIVIDADE = [
  "Tem alguma frente de trabalho travada por conta da engenharia",
  "Falta algum insumo",
  "Falta algum material",
  "As partes instaladas estao de acordo",
];
const ACOMP_TEXT_FIELDS = [
  "Lista os materiais em falta",
  "Lista os insumos em falta",
  "Metragem realizada e areas finalizadas",
  "Ocorrencias",
];

/* — ENTREGA — */
const ENTREGA_TEXT_FIELDS = ["Descritivo do sistema", "Descritivo do material", "Ocorrencias"];
const CK_ENTREGA = [
  "A instalacao esta na qualidade esperada e padroes Parket?",
  "Tivemos muitas ocorrencias ao longo da obra?",
  "A obra foi entregue dentro do prazo?",
  "O cliente esta satisfeito com a entrega?",
];

/* — REPARO — */
const CK_REPARO_TIPO = ["Mal uso do material", "Reparo Parket"];
const CK_REPARO_MATERIAIS = ["Possui material em obra", "Possui insumos em obra"];
const REPARO_TEXT_FIELDS = [
  "Descritivo dos servicos e materiais com problema",
  "Descritivo de sistema de instalacao necessario",
  "Observacoes para solucao",
];

/* Helper: detect which sections apply based on tipo_projeto */
function detectSections(tipoProjeto: string): { piso: boolean; deck: boolean; forro: boolean; painel: boolean } {
  const t = (tipoProjeto || "").toLowerCase();
  return {
    piso: t.includes("piso") || t.includes("escada") || t === "piso_forro",
    deck: t.includes("deck"),
    forro: t.includes("forro") || t === "piso_forro",
    painel: t.includes("painel") || t.includes("marcenaria"),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function SectionCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl" style={{ background: CARD_BG, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-3"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        {open ? <ChevronDown size={14} style={{ color: PURPLE }} /> : <ChevronRight size={14} style={{ color: TEXT_DIM }} />}
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "white" }}>{title}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function ChecklistToggleRow({ label, value, onChange, obs, onObsChange }: {
  label: string; value: boolean | null; onChange: (v: boolean) => void; obs?: string; onObsChange?: (v: string) => void;
}) {
  return (
    <div className="py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2">
        <div className="flex-1" style={{ fontSize: "0.7rem", color: TEXT_MED }}>{label}</div>
        <div className="flex gap-1">
          <button
            onClick={() => onChange(true)}
            style={{
              padding: "3px 10px", borderRadius: 6, fontSize: "0.6rem", fontWeight: 700, cursor: "pointer",
              background: value === true ? `${GREEN}30` : "rgba(255,255,255,0.04)",
              color: value === true ? GREEN : TEXT_DIM,
              border: `1px solid ${value === true ? `${GREEN}50` : "rgba(255,255,255,0.08)"}`,
            }}
          >SIM</button>
          <button
            onClick={() => onChange(false)}
            style={{
              padding: "3px 10px", borderRadius: 6, fontSize: "0.6rem", fontWeight: 700, cursor: "pointer",
              background: value === false ? `${RED}30` : "rgba(255,255,255,0.04)",
              color: value === false ? RED : TEXT_DIM,
              border: `1px solid ${value === false ? `${RED}50` : "rgba(255,255,255,0.08)"}`,
            }}
          >NAO</button>
        </div>
      </div>
      {onObsChange && (
        <input
          placeholder="Observacao..."
          value={obs || ""}
          onChange={e => onObsChange(e.target.value)}
          style={{
            marginTop: 4, width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.06)`,
            borderRadius: 6, padding: "4px 8px", fontSize: "0.6rem", color: "white", outline: "none",
          }}
        />
      )}
    </div>
  );
}

function BadgePill({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase",
      background: `${color}18`, color, border: `1px solid ${color}35`,
    }}>{text}</span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 1: EQUIPE FISCAL
   ═══════════════════════════════════════════════════════════════════ */

interface Fiscal { id: string; nome: string; telefone: string; email: string; ativo: boolean; permissoes: Record<string, boolean>; }

function EquipeFiscalTab() {
  const [equipe, setEquipe] = useState<Fiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Fiscal | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", ativo: true, permissoes: {} as Record<string, boolean> });
  const [saving, setSaving] = useState(false);

  const PERMS = ["laudos", "agenda", "fotos", "compras", "admin"];

  const fetchEquipe = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("fiscal_equipe").select("*").order("nome");
    setEquipe(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEquipe();
    const ch = supabase.channel("fiscal_equipe_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "fiscal_equipe" }, fetchEquipe)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchEquipe]);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", telefone: "", email: "", ativo: true, permissoes: {} });
    setModal(true);
  };

  const openEdit = (f: Fiscal) => {
    setEditing(f);
    setForm({ nome: f.nome, telefone: f.telefone, email: f.email, ativo: f.ativo, permissoes: f.permissoes || {} });
    setModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { nome: form.nome, telefone: form.telefone, email: form.email, ativo: form.ativo, permissoes: form.permissoes };
    if (editing) {
      await supabase.from("fiscal_equipe").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("fiscal_equipe").insert(payload);
    }
    setSaving(false);
    setModal(false);
    fetchEquipe();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este fiscal?")) return;
    await supabase.from("fiscal_equipe").delete().eq("id", id);
    fetchEquipe();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>Equipe Fiscal</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{equipe.filter(e => e.ativo).length} ativos de {equipe.length} total</p>
        </div>
        <Btn color={PURPLE} onClick={openNew}><Plus size={12} style={{ display: "inline", marginRight: 4 }} />Adicionar Fiscal</Btn>
      </div>

      {loading ? (
        <p style={{ color: TEXT_DIM, fontSize: "0.7rem" }}>Carregando...</p>
      ) : equipe.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <Users size={32} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
          <p style={{ color: TEXT_DIM, fontSize: "0.72rem" }}>Nenhum fiscal cadastrado</p>
          <p style={{ color: TEXT_DIM, fontSize: "0.6rem", marginTop: 4 }}>Clique em "Adicionar Fiscal" para comecar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {equipe.map(f => (
            <div key={f.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}`, opacity: f.ativo ? 1 : 0.5 }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${PURPLE}20`, color: PURPLE, fontWeight: 700, fontSize: "0.8rem" }}>
                {f.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{f.nome}</span>
                  {!f.ativo && <BadgePill text="Inativo" color={RED} />}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  {f.telefone && <span className="flex items-center gap-1" style={{ fontSize: "0.6rem", color: TEXT_DIM }}><Phone size={10} />{f.telefone}</span>}
                  {f.email && <span className="flex items-center gap-1" style={{ fontSize: "0.6rem", color: TEXT_DIM }}><Mail size={10} />{f.email}</span>}
                </div>
                {f.permissoes && Object.keys(f.permissoes).filter(k => f.permissoes[k]).length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {Object.entries(f.permissoes).filter(([, v]) => v).map(([k]) => (
                      <span key={k} style={{ fontSize: "0.45rem", padding: "1px 6px", borderRadius: 4, background: `${BLUE}15`, color: BLUE, fontWeight: 600 }}>{k}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(f)} style={{ background: `${BLUE}15`, border: "none", borderRadius: 6, padding: 6, cursor: "pointer" }}>
                  <Edit2 size={12} style={{ color: BLUE }} />
                </button>
                <button onClick={() => handleDelete(f.id)} style={{ background: `${RED}15`, border: "none", borderRadius: 6, padding: 6, cursor: "pointer" }}>
                  <Trash2 size={12} style={{ color: RED }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Editar Fiscal" : "Novo Fiscal"}>
        <FormField label="Nome"><FInput value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" /></FormField>
        <FormField label="Telefone"><FInput value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" /></FormField>
        <FormField label="Email"><FInput value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@parket.com.br" /></FormField>
        <FormField label="Status">
          <FSelect value={form.ativo ? "1" : "0"} onChange={e => setForm(f => ({ ...f, ativo: e.target.value === "1" }))}>
            <option value="1">Ativo</option>
            <option value="0">Inativo</option>
          </FSelect>
        </FormField>
        <FormField label="Permissoes">
          <div className="flex flex-wrap gap-2 mt-1">
            {PERMS.map(p => (
              <button
                key={p}
                onClick={() => setForm(f => ({ ...f, permissoes: { ...f.permissoes, [p]: !f.permissoes[p] } }))}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: "0.6rem", fontWeight: 600, cursor: "pointer",
                  background: form.permissoes[p] ? `${GREEN}25` : "rgba(255,255,255,0.04)",
                  color: form.permissoes[p] ? GREEN : TEXT_DIM,
                  border: `1px solid ${form.permissoes[p] ? `${GREEN}40` : "rgba(255,255,255,0.08)"}`,
                }}
              >{p}</button>
            ))}
          </div>
        </FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={PURPLE} disabled={saving || !form.nome} onClick={handleSave}>{saving ? "Salvando..." : editing ? "Salvar" : "Criar"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 2: AGENDA
   ═══════════════════════════════════════════════════════════════════ */

interface AgendaItem {
  id: string; card_id: string | null; fiscal_id: string | null; tipo: string;
  data_inicio: string; data_fim: string | null; obra: string; cliente: string;
  status: string; fiscal_nome?: string;
}

function AgendaTab() {
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [equipe, setEquipe] = useState<Fiscal[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ card_id: "", fiscal_id: "", tipo: "1vistoria", data_inicio: "", data_fim: "", obra: "", cliente: "" });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: ag }, { data: eq }, { data: kc }] = await Promise.all([
      supabase.from("fiscal_agenda").select("*").order("data_inicio", { ascending: true }),
      supabase.from("fiscal_equipe").select("*").eq("ativo", true).order("nome"),
      supabase.from("kanban_cards").select("id, title, code").eq("dept_id", "fiscal").order("created_at", { ascending: false }).limit(100),
    ]);
    setAgenda(ag ?? []);
    setEquipe(eq ?? []);
    setCards(kc ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel("fiscal_agenda_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "fiscal_agenda" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const handleCardSelect = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    setForm(f => ({ ...f, card_id: cardId, obra: card?.code || "", cliente: card?.title || "" }));
  };

  const handleCreate = async () => {
    setSaving(true);
    const fiscal = equipe.find(e => e.id === form.fiscal_id);
    await supabase.from("fiscal_agenda").insert({
      card_id: form.card_id || null,
      fiscal_id: form.fiscal_id || null,
      fiscal_nome: fiscal?.nome || null,
      tipo: form.tipo,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      obra: form.obra,
      cliente: form.cliente,
      status: "agendada",
    });
    setSaving(false);
    setModal(false);
    setForm({ card_id: "", fiscal_id: "", tipo: "1vistoria", data_inicio: "", data_fim: "", obra: "", cliente: "" });
    fetchAll();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("fiscal_agenda").update({ status }).eq("id", id);
    fetchAll();
  };

  const deleteItem = async (id: string) => {
    await supabase.from("fiscal_agenda").delete().eq("id", id);
    fetchAll();
  };

  // Group by date for calendar view
  const grouped = agenda.reduce<Record<string, AgendaItem[]>>((acc, item) => {
    const d = item.data_inicio?.split("T")[0] || "sem-data";
    if (!acc[d]) acc[d] = [];
    acc[d].push(item);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort();

  const statusOpts = ["agendada", "confirmada", "realizada", "cancelada"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>Agenda Fiscal</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{agenda.filter(a => a.status === "agendada" || a.status === "confirmada").length} agendamentos ativos</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            {(["lista", "calendario"] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: "4px 10px", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer",
                background: viewMode === m ? `${PURPLE}25` : "transparent", color: viewMode === m ? PURPLE : TEXT_DIM, border: "none",
              }}>{m === "lista" ? "Lista" : "Calendario"}</button>
            ))}
          </div>
          <Btn color={PURPLE} onClick={() => setModal(true)}><Plus size={12} style={{ display: "inline", marginRight: 4 }} />Agendar</Btn>
        </div>
      </div>

      {loading ? (
        <p style={{ color: TEXT_DIM, fontSize: "0.7rem" }}>Carregando...</p>
      ) : agenda.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <Calendar size={32} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
          <p style={{ color: TEXT_DIM, fontSize: "0.72rem" }}>Nenhum agendamento</p>
        </div>
      ) : viewMode === "lista" ? (
        <div className="space-y-2">
          {agenda.map(item => {
            const sc = STATUS_COLORS[item.status] || TEXT_DIM;
            return (
              <div key={item.id} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{item.obra || "—"}</span>
                    <BadgePill text={TIPO_OPTIONS.find(t => t.value === item.tipo)?.label || item.tipo} color={PURPLE} />
                    <StatusSelect value={item.status} options={statusOpts} onChange={v => updateStatus(item.id, v)} colorMap={STATUS_COLORS} />
                  </div>
                  <button onClick={() => deleteItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <Trash2 size={12} style={{ color: `${RED}80` }} />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <span style={{ fontSize: "0.65rem", color: ACCENT }}>{item.cliente}</span>
                  <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>
                    <Calendar size={10} style={{ display: "inline", marginRight: 3 }} />
                    {item.data_inicio ? new Date(item.data_inicio).toLocaleDateString("pt-BR") : "—"}
                  </span>
                  {item.fiscal_nome && (
                    <span style={{ fontSize: "0.6rem", color: BLUE }}>
                      <Users size={10} style={{ display: "inline", marginRight: 3 }} />{item.fiscal_nome}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: PURPLE }}>
                  {date === "sem-data" ? "Sem data" : new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
                </span>
                <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{grouped[date].length} item(s)</span>
              </div>
              <div className="space-y-1.5 ml-3">
                {grouped[date].map(item => {
                  const sc = STATUS_COLORS[item.status] || TEXT_DIM;
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: sc, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "white" }}>{item.obra}</span>
                      <span style={{ fontSize: "0.6rem", color: ACCENT }}>{item.cliente}</span>
                      <BadgePill text={TIPO_OPTIONS.find(t => t.value === item.tipo)?.label || item.tipo} color={PURPLE} />
                      {item.fiscal_nome && <span style={{ fontSize: "0.55rem", color: BLUE }}>{item.fiscal_nome}</span>}
                      <div className="flex-1" />
                      <StatusSelect value={item.status} options={statusOpts} onChange={v => updateStatus(item.id, v)} colorMap={STATUS_COLORS} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Novo Agendamento">
        <FormField label="Card (Kanban Fiscal)">
          <FSelect value={form.card_id} onChange={e => handleCardSelect(e.target.value)}>
            <option value="">— Selecionar card —</option>
            {cards.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </FSelect>
        </FormField>
        <FormField label="Fiscal Responsavel">
          <FSelect value={form.fiscal_id} onChange={e => setForm(f => ({ ...f, fiscal_id: e.target.value }))}>
            <option value="">— Selecionar fiscal —</option>
            {equipe.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </FSelect>
        </FormField>
        <FormField label="Tipo">
          <FSelect value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </FSelect>
        </FormField>
        <FormField label="Obra (codigo)"><FInput value={form.obra} onChange={e => setForm(f => ({ ...f, obra: e.target.value }))} placeholder="PKT-054" /></FormField>
        <FormField label="Cliente"><FInput value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} placeholder="Nome do cliente" /></FormField>
        <FormField label="Data Inicio"><FInput type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} /></FormField>
        <FormField label="Data Fim (opcional)"><FInput type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} /></FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={PURPLE} disabled={saving || !form.data_inicio || !form.obra} onClick={handleCreate}>{saving ? "Salvando..." : "Agendar"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 3: LAUDOS & VISTORIAS
   ═══════════════════════════════════════════════════════════════════ */

interface Laudo {
  id: string; card_id: string | null; obra: string; cliente: string;
  tipo: string; fiscal_id: string | null; fiscal_nome: string | null;
  data_vistoria: string | null; status: string;
  servicos_inclusos: string[];
  checklist_piso: any; checklist_deck: any; checklist_forro: any; checklist_painel: any;
  checklist_extra: any;
  observacoes: string | null;
  created_at: string;
}

interface LaudoFoto {
  id: string; laudo_id: string; card_id: string | null; ambiente: string; url: string; descricao: string | null;
  anotacoes?: Annotations | null;
}

/* Checklist state helper */
type CkState = Record<string, { valor: boolean | null; obs: string }>;

function buildCkState(items: string[]): CkState {
  const s: CkState = {};
  items.forEach(i => { s[i] = { valor: null, obs: "" }; });
  return s;
}

function mergeCkState(items: string[], saved: any): CkState {
  const s = buildCkState(items);
  if (saved && typeof saved === "object") {
    Object.entries(saved).forEach(([k, v]: [string, any]) => {
      if (s[k] !== undefined) {
        s[k] = { valor: v?.valor ?? null, obs: v?.obs || "" };
      }
    });
  }
  return s;
}

function ChecklistSection({ title, items, state, onChange }: {
  title: string; items: string[]; state: CkState; onChange: (s: CkState) => void;
}) {
  const answered = items.filter(i => state[i]?.valor !== null).length;
  return (
    <SectionCard title={`${title} (${answered}/${items.length})`}>
      {items.map((item, idx) => (
        <ChecklistToggleRow
          key={idx}
          label={item}
          value={state[item]?.valor ?? null}
          onChange={v => onChange({ ...state, [item]: { ...state[item], valor: v } })}
          obs={state[item]?.obs}
          onObsChange={v => onChange({ ...state, [item]: { ...state[item], obs: v } })}
        />
      ))}
    </SectionCard>
  );
}

function LaudosVistoriasTab() {
  const [laudos, setLaudos] = useState<Laudo[]>([]);
  const [equipe, setEquipe] = useState<Fiscal[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [projCards, setProjCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Laudo | null>(null);
  const [saving, setSaving] = useState(false);

  // New laudo form state
  const [formCardId, setFormCardId] = useState("");
  const [formTipo, setFormTipo] = useState("1vistoria");
  const [formFiscalId, setFormFiscalId] = useState("");
  const [formDataVistoria, setFormDataVistoria] = useState("");
  const [formObs, setFormObs] = useState("");
  const [detectedSections, setDetectedSections] = useState({ piso: false, deck: false, forro: false, painel: false });
  const [servicos, setServicos] = useState<string[]>([]);

  // Checklist states
  const [ckPiso, setCkPiso] = useState<CkState>({});
  const [ckDeck, setCkDeck] = useState<CkState>({});
  const [ckForro, setCkForro] = useState<CkState>({});
  const [ckPainel, setCkPainel] = useState<CkState>({});
  const [ckExtra, setCkExtra] = useState<any>({});

  // Acompanhamento/Entrega/Reparo text fields
  const [textFields, setTextFields] = useState<Record<string, string>>({});

  // Reparo material table
  const [reparoMateriais, setReparoMateriais] = useState<{ material: string; insumo: string; quantidade: string }[]>([]);

  // Fotos
  const [fotos, setFotos] = useState<LaudoFoto[]>([]);
  const [fotoAmbiente, setFotoAmbiente] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingFoto, setEditingFoto] = useState<LaudoFoto | null>(null);

  // Filters
  const [filterTipo, setFilterTipo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: ld }, { data: eq }, { data: kc }, { data: pc }] = await Promise.all([
      supabase.from("fiscal_laudos").select("*").order("created_at", { ascending: false }),
      supabase.from("fiscal_equipe").select("*").eq("ativo", true).order("nome"),
      supabase.from("kanban_cards").select("id, title, code").eq("dept_id", "fiscal").order("created_at", { ascending: false }).limit(100),
      supabase.from("kanban_cards").select("id, title, code, tipo_projeto").eq("dept_id", "projetos").order("created_at", { ascending: false }).limit(200),
    ]);
    setLaudos(ld ?? []);
    setEquipe(eq ?? []);
    setCards(kc ?? []);
    setProjCards(pc ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel("fiscal_laudos_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "fiscal_laudos" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // Auto-detect sections when card is picked
  const handleCardSelect = (cardId: string) => {
    setFormCardId(cardId);
    const card = cards.find(c => c.id === cardId);
    if (card) {
      // Find matching projetos card by title
      const projMatch = projCards.find(p => p.title && card.title && p.title.toLowerCase() === card.title.toLowerCase());
      if (projMatch?.tipo_projeto) {
        const sections = detectSections(projMatch.tipo_projeto);
        setDetectedSections(sections);
        const svcs: string[] = [];
        if (sections.piso) svcs.push("piso");
        if (sections.deck) svcs.push("deck");
        if (sections.forro) svcs.push("forro");
        if (sections.painel) svcs.push("painel");
        setServicos(svcs);
      } else {
        // Default: show all sections
        setDetectedSections({ piso: true, deck: true, forro: true, painel: true });
        setServicos(["piso", "deck", "forro", "painel"]);
      }
    }
  };

  const toggleServico = (s: string) => {
    setServicos(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setDetectedSections(prev => ({ ...prev, [s]: !prev[s as keyof typeof prev] }));
  };

  const getChecklistItems = (tipo: string, section: string) => {
    if (tipo === "1vistoria") {
      if (section === "piso") return CK_1V_PISO;
      if (section === "deck") return CK_1V_DECK;
      if (section === "forro") return CK_1V_FORRO;
      if (section === "painel") return CK_1V_PAINEL;
    }
    if (tipo === "2vistoria") {
      if (section === "piso") return CK_2V_PISO;
      if (section === "deck") return CK_2V_DECK;
      if (section === "forro") return CK_2V_FORRO;
      if (section === "painel") return CK_2V_PAINEL;
    }
    return [];
  };

  const initChecklist = (tipo: string) => {
    if (tipo === "1vistoria" || tipo === "2vistoria") {
      setCkPiso(buildCkState(getChecklistItems(tipo, "piso")));
      setCkDeck(buildCkState(getChecklistItems(tipo, "deck")));
      setCkForro(buildCkState(getChecklistItems(tipo, "forro")));
      setCkPainel(buildCkState(getChecklistItems(tipo, "painel")));
      if (tipo === "1vistoria") {
        const extra: Record<string, string> = {};
        CK_1V_FORRO_EXTRA.forEach(e => { extra[e.q] = ""; });
        setCkExtra(extra);
      }
      if (tipo === "2vistoria") {
        setCkExtra({ liberacao: buildCkState(CK_2V_LIBERACAO) });
      }
    }
    if (tipo === "acompanhamento") {
      setCkExtra({
        equipe: buildCkState(CK_ACOMP_EQUIPE),
        produtividade: buildCkState(CK_ACOMP_PRODUTIVIDADE),
      });
      const tf: Record<string, string> = {};
      ACOMP_TEXT_FIELDS.forEach(f => { tf[f] = ""; });
      setTextFields(tf);
    }
    if (tipo === "entrega") {
      setCkExtra({ entrega: buildCkState(CK_ENTREGA) });
      const tf: Record<string, string> = {};
      ENTREGA_TEXT_FIELDS.forEach(f => { tf[f] = ""; });
      setTextFields(tf);
    }
    if (tipo === "reparo") {
      setCkExtra({
        reparo: buildCkState(CK_REPARO_TIPO),
        materiais: buildCkState(CK_REPARO_MATERIAIS),
      });
      const tf: Record<string, string> = {};
      REPARO_TEXT_FIELDS.forEach(f => { tf[f] = ""; });
      setTextFields(tf);
      setReparoMateriais([{ material: "", insumo: "", quantidade: "" }]);
    }
  };

  const startCreating = () => {
    setCreating(true);
    setViewing(null);
    setFormCardId("");
    setFormTipo("1vistoria");
    setFormFiscalId("");
    setFormDataVistoria(new Date().toISOString().split("T")[0]);
    setFormObs("");
    setDetectedSections({ piso: false, deck: false, forro: false, painel: false });
    setServicos([]);
    setCkPiso({});
    setCkDeck({});
    setCkForro({});
    setCkPainel({});
    setCkExtra({});
    setTextFields({});
    setReparoMateriais([]);
    setFotos([]);
    initChecklist("1vistoria");
  };

  const handleTipoChange = (tipo: string) => {
    setFormTipo(tipo);
    initChecklist(tipo);
  };

  const handleSaveLaudo = async () => {
    setSaving(true);
    const card = cards.find(c => c.id === formCardId);
    const fiscal = equipe.find(e => e.id === formFiscalId);

    const payload: any = {
      card_id: formCardId || null,
      obra: card?.code || "",
      cliente: card?.title || "",
      tipo: formTipo,
      fiscal_id: formFiscalId || null,
      fiscal_nome: fiscal?.nome || null,
      data_vistoria: formDataVistoria || null,
      status: "pendente",
      servicos_inclusos: servicos,
      observacoes: formObs || null,
    };

    if (formTipo === "1vistoria" || formTipo === "2vistoria") {
      if (detectedSections.piso) payload.checklist_piso = ckPiso;
      if (detectedSections.deck) payload.checklist_deck = ckDeck;
      if (detectedSections.forro) payload.checklist_forro = ckForro;
      if (detectedSections.painel) payload.checklist_painel = ckPainel;
      payload.checklist_extra = ckExtra;
    } else {
      payload.checklist_extra = { ...ckExtra, textFields, reparoMateriais: reparoMateriais.length > 0 ? reparoMateriais : undefined };
    }

    let laudoId: string | null = null;

    if (viewing) {
      await supabase.from("fiscal_laudos").update(payload).eq("id", viewing.id);
      laudoId = viewing.id;
    } else {
      const { data } = await supabase.from("fiscal_laudos").insert(payload).select("id").single();
      laudoId = data?.id || null;
    }

    // Upload queued fotos metadata
    if (laudoId && fotos.length > 0) {
      const fotosToInsert = fotos.filter(f => !f.id.startsWith("existing_")).map(f => ({
        laudo_id: laudoId,
        card_id: formCardId || null,
        ambiente: f.ambiente,
        url: f.url,
        descricao: f.descricao,
        anotacoes: f.anotacoes ?? null,
      }));
      if (fotosToInsert.length > 0) {
        await supabase.from("fiscal_fotos").insert(fotosToInsert);
      }
    }

    setSaving(false);
    setCreating(false);
    setViewing(null);
    fetchAll();
  };

  const openViewLaudo = async (laudo: Laudo) => {
    setViewing(laudo);
    setCreating(true);
    setFormCardId(laudo.card_id || "");
    setFormTipo(laudo.tipo);
    setFormFiscalId(laudo.fiscal_id || "");
    setFormDataVistoria(laudo.data_vistoria || "");
    setFormObs(laudo.observacoes || "");
    setServicos(laudo.servicos_inclusos || []);
    const sections = { piso: false, deck: false, forro: false, painel: false };
    (laudo.servicos_inclusos || []).forEach(s => { if (s in sections) sections[s as keyof typeof sections] = true; });
    setDetectedSections(sections);

    // Restore checklists from saved JSONB
    const items1v = laudo.tipo === "1vistoria";
    const items2v = laudo.tipo === "2vistoria";
    if (items1v || items2v) {
      setCkPiso(mergeCkState(getChecklistItems(laudo.tipo, "piso"), laudo.checklist_piso));
      setCkDeck(mergeCkState(getChecklistItems(laudo.tipo, "deck"), laudo.checklist_deck));
      setCkForro(mergeCkState(getChecklistItems(laudo.tipo, "forro"), laudo.checklist_forro));
      setCkPainel(mergeCkState(getChecklistItems(laudo.tipo, "painel"), laudo.checklist_painel));
      setCkExtra(laudo.checklist_extra || {});
    } else {
      const extra = laudo.checklist_extra || {};
      setCkExtra(extra);
      setTextFields(extra.textFields || {});
      setReparoMateriais(extra.reparoMateriais || []);
    }

    // Load fotos
    const { data: existingFotos } = await supabase.from("fiscal_fotos").select("*").eq("laudo_id", laudo.id);
    setFotos((existingFotos || []).map(f => ({ ...f, id: "existing_" + f.id })));
  };

  const updateLaudoStatus = async (id: string, status: string) => {
    await supabase.from("fiscal_laudos").update({ status }).eq("id", id);
    fetchAll();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `laudos/${formCardId || "sem-card"}/${Date.now()}_${i}.${ext}`;
      const { error } = await supabase.storage.from("fiscal-fotos").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("fiscal-fotos").getPublicUrl(path);
        setFotos(prev => [...prev, {
          id: `new_${Date.now()}_${i}`,
          laudo_id: viewing?.id || "",
          card_id: formCardId || null,
          ambiente: fotoAmbiente || "Geral",
          url: urlData.publicUrl,
          descricao: null,
        }]);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFoto = (fotoId: string) => {
    setFotos(prev => prev.filter(f => f.id !== fotoId));
  };

  const saveAnotacoes = async (foto: LaudoFoto, anotacoes: Annotations) => {
    /* Foto ja gravada no banco: UPDATE imediato */
    if (foto.id.startsWith("existing_")) {
      const realId = foto.id.replace(/^existing_/, "");
      await supabase.from("fiscal_fotos").update({ anotacoes }).eq("id", realId);
    }
    /* Espelha no estado local pra thumbnail atualizar e Salvar Laudo respeitar */
    setFotos(prev => prev.map(f => f.id === foto.id ? { ...f, anotacoes } : f));
  };

  const filteredLaudos = laudos.filter(l => {
    if (filterTipo && l.tipo !== filterTipo) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  // FORM VIEW (create / edit)
  if (creating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>{viewing ? "Editar Laudo" : "Novo Laudo"}</h2>
          <div className="flex gap-2">
            <Btn color={GREEN} disabled={saving} onClick={handleSaveLaudo}>
              <Save size={12} style={{ display: "inline", marginRight: 4 }} />{saving ? "Salvando..." : "Salvar Laudo"}
            </Btn>
            <Btn color={TEXT_DIM} variant="ghost" onClick={() => { setCreating(false); setViewing(null); }}>Voltar</Btn>
          </div>
        </div>

        {/* Base info */}
        <SectionCard title="Informacoes do Laudo">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Card (Kanban Fiscal)">
              <FSelect value={formCardId} onChange={e => handleCardSelect(e.target.value)}>
                <option value="">— Selecionar —</option>
                {cards.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
              </FSelect>
            </FormField>
            <FormField label="Tipo de Vistoria">
              <FSelect value={formTipo} onChange={e => handleTipoChange(e.target.value)}>
                {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </FSelect>
            </FormField>
            <FormField label="Fiscal Responsavel">
              <FSelect value={formFiscalId} onChange={e => setFormFiscalId(e.target.value)}>
                <option value="">— Selecionar —</option>
                {equipe.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </FSelect>
            </FormField>
            <FormField label="Data da Vistoria">
              <FInput type="date" value={formDataVistoria} onChange={e => setFormDataVistoria(e.target.value)} />
            </FormField>
          </div>
        </SectionCard>

        {/* Service toggles — only for vistoria types */}
        {(formTipo === "1vistoria" || formTipo === "2vistoria") && (
          <SectionCard title="Servicos Inclusos">
            <div className="flex gap-2 flex-wrap">
              {(["piso", "deck", "forro", "painel"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => toggleServico(s)}
                  style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: "0.68rem", fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                    background: servicos.includes(s) ? `${PURPLE}25` : "rgba(255,255,255,0.04)",
                    color: servicos.includes(s) ? PURPLE : TEXT_DIM,
                    border: `1px solid ${servicos.includes(s) ? `${PURPLE}50` : "rgba(255,255,255,0.08)"}`,
                  }}
                >{s}</button>
              ))}
            </div>
          </SectionCard>
        )}

        {/* 2a vistoria: Liberacao section */}
        {formTipo === "2vistoria" && ckExtra.liberacao && (
          <ChecklistSection
            title="Liberacao"
            items={CK_2V_LIBERACAO}
            state={ckExtra.liberacao}
            onChange={s => setCkExtra((prev: any) => ({ ...prev, liberacao: s }))}
          />
        )}

        {/* Dynamic checklists for 1a/2a vistoria */}
        {(formTipo === "1vistoria" || formTipo === "2vistoria") && (
          <>
            {detectedSections.piso && (
              <ChecklistSection title="Piso" items={getChecklistItems(formTipo, "piso")} state={ckPiso} onChange={setCkPiso} />
            )}
            {detectedSections.deck && (
              <ChecklistSection title="Deck" items={getChecklistItems(formTipo, "deck")} state={ckDeck} onChange={setCkDeck} />
            )}
            {detectedSections.forro && (
              <>
                <ChecklistSection title="Forro" items={getChecklistItems(formTipo, "forro")} state={ckForro} onChange={setCkForro} />
                {formTipo === "1vistoria" && (
                  <SectionCard title="Forro — Perguntas Adicionais">
                    {CK_1V_FORRO_EXTRA.map((item, idx) => (
                      <FormField key={idx} label={item.q}>
                        <FInput
                          value={ckExtra[item.q] || ""}
                          onChange={e => setCkExtra((prev: any) => ({ ...prev, [item.q]: e.target.value }))}
                          placeholder="Responder..."
                        />
                      </FormField>
                    ))}
                  </SectionCard>
                )}
              </>
            )}
            {detectedSections.painel && (
              <ChecklistSection title="Painel" items={getChecklistItems(formTipo, "painel")} state={ckPainel} onChange={setCkPainel} />
            )}
          </>
        )}

        {/* Acompanhamento */}
        {formTipo === "acompanhamento" && ckExtra.equipe && (
          <>
            <ChecklistSection title="Equipe Parket" items={CK_ACOMP_EQUIPE} state={ckExtra.equipe} onChange={s => setCkExtra((prev: any) => ({ ...prev, equipe: s }))} />
            <ChecklistSection title="Produtividade" items={CK_ACOMP_PRODUTIVIDADE} state={ckExtra.produtividade} onChange={s => setCkExtra((prev: any) => ({ ...prev, produtividade: s }))} />
            <SectionCard title="Campos de Texto">
              {ACOMP_TEXT_FIELDS.map((field, idx) => (
                <FormField key={idx} label={field}>
                  <FTextarea value={textFields[field] || ""} onChange={e => setTextFields(prev => ({ ...prev, [field]: e.target.value }))} placeholder={field} />
                </FormField>
              ))}
            </SectionCard>
          </>
        )}

        {/* Entrega */}
        {formTipo === "entrega" && ckExtra.entrega && (
          <>
            <SectionCard title="Campos Descritivos">
              {ENTREGA_TEXT_FIELDS.map((field, idx) => (
                <FormField key={idx} label={field}>
                  <FTextarea value={textFields[field] || ""} onChange={e => setTextFields(prev => ({ ...prev, [field]: e.target.value }))} placeholder={field} />
                </FormField>
              ))}
            </SectionCard>
            <ChecklistSection title="Entrega" items={CK_ENTREGA} state={ckExtra.entrega} onChange={s => setCkExtra((prev: any) => ({ ...prev, entrega: s }))} />
          </>
        )}

        {/* Reparo */}
        {formTipo === "reparo" && ckExtra.reparo && (
          <>
            <ChecklistSection title="Tipo de Reparo" items={CK_REPARO_TIPO} state={ckExtra.reparo} onChange={s => setCkExtra((prev: any) => ({ ...prev, reparo: s }))} />
            <ChecklistSection title="Materiais em Obra" items={CK_REPARO_MATERIAIS} state={ckExtra.materiais} onChange={s => setCkExtra((prev: any) => ({ ...prev, materiais: s }))} />
            <SectionCard title="Tabela de Materiais Necessarios">
              <div className="space-y-2">
                {reparoMateriais.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2">
                    <FInput placeholder="Material" value={row.material} onChange={e => {
                      const copy = [...reparoMateriais];
                      copy[idx] = { ...copy[idx], material: e.target.value };
                      setReparoMateriais(copy);
                    }} />
                    <FInput placeholder="Insumo" value={row.insumo} onChange={e => {
                      const copy = [...reparoMateriais];
                      copy[idx] = { ...copy[idx], insumo: e.target.value };
                      setReparoMateriais(copy);
                    }} />
                    <div className="flex gap-1">
                      <FInput placeholder="Qtd" value={row.quantidade} onChange={e => {
                        const copy = [...reparoMateriais];
                        copy[idx] = { ...copy[idx], quantidade: e.target.value };
                        setReparoMateriais(copy);
                      }} />
                      <button onClick={() => setReparoMateriais(prev => prev.filter((_, i) => i !== idx))}
                        style={{ background: `${RED}15`, border: "none", borderRadius: 6, padding: "0 6px", cursor: "pointer" }}>
                        <X size={10} style={{ color: RED }} />
                      </button>
                    </div>
                  </div>
                ))}
                <Btn color={BLUE} onClick={() => setReparoMateriais(prev => [...prev, { material: "", insumo: "", quantidade: "" }])}>
                  <Plus size={10} style={{ display: "inline", marginRight: 4 }} />Adicionar Linha
                </Btn>
              </div>
            </SectionCard>
            <SectionCard title="Descritivos">
              {REPARO_TEXT_FIELDS.map((field, idx) => (
                <FormField key={idx} label={field}>
                  <FTextarea value={textFields[field] || ""} onChange={e => setTextFields(prev => ({ ...prev, [field]: e.target.value }))} placeholder={field} />
                </FormField>
              ))}
            </SectionCard>
          </>
        )}

        {/* Observacoes gerais */}
        <SectionCard title="Observacoes Gerais">
          <FTextarea value={formObs} onChange={e => setFormObs(e.target.value)} placeholder="Observacoes sobre a vistoria..." />
        </SectionCard>

        {/* Fotos */}
        <SectionCard title={`Fotos (${fotos.length})`}>
          <div className="flex items-center gap-2 mb-3">
            <FInput placeholder="Ambiente (ex: Sala, Quarto 1)" value={fotoAmbiente} onChange={e => setFotoAmbiente(e.target.value)} style={{ flex: 1 }} />
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: "none" }} />
            <Btn color={ORANGE} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload size={12} style={{ display: "inline", marginRight: 4 }} />{uploading ? "Enviando..." : "Upload"}
            </Btn>
          </div>
          {fotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {fotos.map(f => (
                <div key={f.id} className="relative rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: "rgba(0,0,0,0.3)" }}>
                  <img
                    src={f.url}
                    alt={f.ambiente}
                    title="Clique para editar / desenhar"
                    style={{ width: "100%", height: 80, objectFit: "cover", cursor: "pointer" }}
                    onClick={() => setEditingFoto(f)}
                  />
                  <AnnotationBadge anotacoes={f.anotacoes} />
                  <div className="p-1.5">
                    <span style={{ fontSize: "0.5rem", color: ACCENT }}>{f.ambiente}</span>
                  </div>
                  <button
                    onClick={() => removeFoto(f.id)}
                    style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 4, padding: 2, cursor: "pointer" }}
                  >
                    <X size={10} style={{ color: RED }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {editingFoto && (
          <PhotoAnnotator
            open={!!editingFoto}
            url={editingFoto.url}
            initial={editingFoto.anotacoes || null}
            ambiente={editingFoto.ambiente}
            onClose={() => setEditingFoto(null)}
            onSave={anot => saveAnotacoes(editingFoto, anot)}
          />
        )}
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>Laudos & Vistorias</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{laudos.length} laudos registrados</p>
        </div>
        <Btn color={PURPLE} onClick={startCreating}><Plus size={12} style={{ display: "inline", marginRight: 4 }} />Novo Laudo</Btn>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <FSelect value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">Todos os tipos</option>
          {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </FSelect>
        <FSelect value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluido">Concluido</option>
        </FSelect>
      </div>

      {loading ? (
        <p style={{ color: TEXT_DIM, fontSize: "0.7rem" }}>Carregando...</p>
      ) : filteredLaudos.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <FileText size={32} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
          <p style={{ color: TEXT_DIM, fontSize: "0.72rem" }}>Nenhum laudo encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLaudos.map(laudo => {
            const sc = STATUS_COLORS[laudo.status] || TEXT_DIM;
            const tipoLabel = TIPO_OPTIONS.find(t => t.value === laudo.tipo)?.label || laudo.tipo;
            return (
              <div key={laudo.id} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}`, cursor: "pointer" }} onClick={() => openViewLaudo(laudo)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{laudo.obra || "Sem obra"}</span>
                    <BadgePill text={tipoLabel} color={PURPLE} />
                    <StatusSelect
                      value={laudo.status}
                      options={["pendente", "em_andamento", "concluido", "cancelado"]}
                      onChange={v => { updateLaudoStatus(laudo.id, v); }}
                      colorMap={STATUS_COLORS}
                    />
                  </div>
                  <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>
                    {laudo.data_vistoria ? new Date(laudo.data_vistoria).toLocaleDateString("pt-BR") : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span style={{ fontSize: "0.65rem", color: ACCENT }}>{laudo.cliente || "—"}</span>
                  {laudo.fiscal_nome && <span style={{ fontSize: "0.6rem", color: BLUE }}>{laudo.fiscal_nome}</span>}
                  {laudo.servicos_inclusos && laudo.servicos_inclusos.length > 0 && (
                    <div className="flex gap-1">
                      {laudo.servicos_inclusos.map(s => (
                        <span key={s} style={{ fontSize: "0.45rem", padding: "1px 5px", borderRadius: 4, background: `${ORANGE}15`, color: ORANGE, fontWeight: 600, textTransform: "capitalize" }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

export const fiscalTabs: ExtraTab[] = [
  { id: "equipe", label: "Equipe Fiscal", icon: Users, render: () => <EquipeFiscalTab /> },
  { id: "agenda", label: "Agenda", icon: Calendar, render: () => <AgendaTab /> },
  { id: "laudos", label: "Laudos & Vistorias", icon: ClipboardCheck, render: () => <LaudosVistoriasTab /> },
  { id: "solicitar-compras", label: "Solicitar Compras", icon: ShoppingCart, render: () => <SolicitacaoComprasTab /> },
];

const team: TeamMember[] = [];

const activity: ActivityItem[] = [
  { id: "1", text: "PKT-053: Vistoria umidade pendente — obra inicia em 5 dias", time: "Hoje 07:30", type: "alert" },
  { id: "2", text: "PKT-048: 1a vistoria concluida — relatorio postado no grupo", time: "Ontem 15:00", type: "completed" },
  { id: "3", text: "PKT-042: Checklist final — 22/24 itens OK — 2 pendentes", time: "Ontem 11:00", type: "update" },
  { id: "4", text: "PKT-047: NAO IR — sem pre-projeto de Thainara", time: "Ontem 09:00", type: "alert" },
];

export function DeptFiscalPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Novo Laudo", icon: ClipboardCheck, color: PURPLE, onClick: () => tabRef.current?.("laudos") },
    { label: "Agendar Vistoria", icon: Calendar, color: BLUE, onClick: () => tabRef.current?.("agenda") },
    { label: "Equipe", icon: Users, color: GREEN, onClick: () => tabRef.current?.("equipe") },
    { label: "Foto Obra", icon: Camera, color: ORANGE, onClick: () => tabRef.current?.("laudos") },
    { label: "Solicitar Compras", icon: ShoppingCart, color: "#10B981", onClick: () => document.dispatchEvent(new CustomEvent("open-solicitar-compras")) },
  ];
  return <DeptPage deptId="fiscal" extraTabs={fiscalTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
