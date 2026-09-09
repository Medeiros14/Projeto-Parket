/* ═══ PROJETOS — Abas Específicas: Equipe, SLA, Calendário, Timeline ═══ */
import React from "react";
import {
  TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT,
  BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL,
} from "../components/dept-layout";
import { supabase, createAdminClient } from "../lib/supabase";
import { Modal, FormField, FInput, FSelect, Btn } from "../components/modal";
import { Users, Plus, X, ChevronLeft, ChevronRight, User, Clock, Calendar, Layers, ShoppingCart, KeyRound, CheckCircle2 } from "lucide-react";
import { SolicitacaoComprasTab } from "../components/dept-layout";

/* ─── Tipos ─── */
interface Projetista {
  id: string;
  nome: string;
  email: string;
  especialidade: string;
  ativo: boolean;
  user_id: string | null;
}

interface ProjetistaCard {
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

interface SlaTemplate {
  id: string;
  tipo: string;
  tamanho: string;
  dias: number;
}

interface ProjetosCard {
  id: string;
  title: string;
  obra: string;
}

/* ─── Defaults ─── */
const SLA_DEFAULTS: { tipo: string; tamanho: string; dias: number }[] = [
  { tipo: "Piso",         tamanho: "pequeno", dias: 5  },
  { tipo: "Piso",         tamanho: "medio",   dias: 8  },
  { tipo: "Piso",         tamanho: "grande",  dias: 12 },
  { tipo: "Marcenaria",   tamanho: "pequeno", dias: 7  },
  { tipo: "Marcenaria",   tamanho: "medio",   dias: 10 },
  { tipo: "Marcenaria",   tamanho: "grande",  dias: 15 },
  { tipo: "Deck",         tamanho: "pequeno", dias: 4  },
  { tipo: "Deck",         tamanho: "medio",   dias: 6  },
  { tipo: "Deck",         tamanho: "grande",  dias: 9  },
  { tipo: "Instalacao",   tamanho: "pequeno", dias: 3  },
  { tipo: "Instalacao",   tamanho: "medio",   dias: 5  },
  { tipo: "Instalacao",   tamanho: "grande",  dias: 8  },
  { tipo: "Revestimento", tamanho: "pequeno", dias: 5  },
  { tipo: "Revestimento", tamanho: "medio",   dias: 7  },
  { tipo: "Revestimento", tamanho: "grande",  dias: 11 },
  { tipo: "Outros",       tamanho: "pequeno", dias: 7  },
  { tipo: "Outros",       tamanho: "medio",   dias: 10 },
  { tipo: "Outros",       tamanho: "grande",  dias: 14 },
];

const KANBAN_COLS = [
  { id: "backlog",      label: "Backlog",       color: TEXT_DIM },
  { id: "em_andamento", label: "Em Andamento",  color: BLUE },
  { id: "revisao",      label: "Revisao",       color: YELLOW },
  { id: "aprovado",     label: "Aprovado",      color: GREEN },
];

/* ─── Hook: projetos do kanban ─── */
function useProjetosKanban() {
  const [projetos, setProjetos] = React.useState<ProjetosCard[]>([]);
  React.useEffect(() => {
    supabase.from("kanban_cards").select("id,title,obra").eq("dept_id", "projetos").order("title").limit(500)
      .then(({ data }) => setProjetos((data ?? []) as ProjetosCard[]));
  }, []);
  return projetos;
}

/* ─── Helpers ─── */
async function logToProjectCard(obraCode: string, tipo: string, descricao: string, usuario: string) {
  try {
    const { data: cards } = await supabase
      .from("kanban_cards")
      .select("id, details")
      .eq("dept_id", "projetos")
      .ilike("title", `%${obraCode}%`)
      .limit(1);
    if (!cards || cards.length === 0) return;
    const card = cards[0];
    const hist = (card.details?.historico_projetos ?? []) as any[];
    hist.push({ tipo, descricao, usuario, data: new Date().toISOString() });
    await supabase.from("kanban_cards").update({ details: { ...(card.details ?? {}), historico_projetos: hist } }).eq("id", card.id);
  } catch { /* silencioso */ }
}

/* ─── Hook: projetistas ─── */
function useProjetistas() {
  const [projetistas, setProjetistas] = React.useState<Projetista[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetch = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("projetos_equipe").select("*").order("nome");
      setProjetistas(data ?? []);
    } catch { setProjetistas([]); }
    setLoading(false);
  }, []);

  React.useEffect(() => { fetch(); }, [fetch]);

  const addProjetista = async (p: Omit<Projetista, "id" | "ativo">) => {
    await supabase.from("projetos_equipe").insert({ ...p, ativo: true });
    fetch();
  };

  const removeProjetista = async (id: string) => {
    await supabase.from("projetos_equipe").update({ ativo: false }).eq("id", id);
    fetch();
  };

  return { projetistas: projetistas.filter(p => p.ativo), loading, addProjetista, removeProjetista, refetch: fetch };
}

/* ─── Hook: cards dos projetistas ─── */
function useProjetistaCards() {
  const [cards, setCards] = React.useState<ProjetistaCard[]>([]);

  const fetch = React.useCallback(async () => {
    try {
      const { data } = await supabase.from("projetos_demandas").select("*").order("prazo");
      setCards(data ?? []);
    } catch { setCards([]); }
  }, []);

  React.useEffect(() => { fetch(); }, [fetch]);

  const moverCard = async (id: string, novoStatus: string) => {
    await supabase.from("projetos_demandas").update({ status: novoStatus }).eq("id", id);
    fetch();
  };

  const criarCard = async (card: Omit<ProjetistaCard, "id">) => {
    await supabase.from("projetos_demandas").insert(card);
    fetch();
  };

  const deletarCard = async (id: string) => {
    await supabase.from("projetos_demandas").delete().eq("id", id);
    fetch();
  };

  return { cards, fetch, moverCard, criarCard, deletarCard };
}

/* ─── Hook: SLA Templates ─── */
function useSlaTemplates() {
  const [templates, setTemplates] = React.useState<SlaTemplate[]>([]);
  const [fromDB, setFromDB] = React.useState(false);

  const fetch = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.from("projetos_sla_templates").select("*");
      if (!error && data && data.length > 0) {
        setTemplates(data);
        setFromDB(true);
      } else {
        setTemplates(SLA_DEFAULTS.map((s, i) => ({ id: String(i), ...s })));
        setFromDB(false);
      }
    } catch {
      setTemplates(SLA_DEFAULTS.map((s, i) => ({ id: String(i), ...s })));
      setFromDB(false);
    }
  }, []);

  React.useEffect(() => { fetch(); }, [fetch]);

  const updateDias = async (id: string, dias: number, tipo: string, tamanho: string) => {
    if (fromDB) {
      await supabase.from("projetos_sla_templates").update({ dias }).eq("id", id);
    } else {
      // Inicializa a tabela com todos os defaults primeiro
      const rows = SLA_DEFAULTS.map(s => ({ ...s, dias: s.tipo === tipo && s.tamanho === tamanho ? dias : s.dias }));
      const { error } = await supabase.from("projetos_sla_templates").upsert(rows, { onConflict: "tipo,tamanho" });
      if (!error) setFromDB(true);
    }
    fetch();
  };

  return { templates, fromDB, updateDias };
}

/* ══════════════════════════════════════════════════════════
   ABA 1 — EQUIPE & DEMANDAS (Kanban por Projetista)
══════════════════════════════════════════════════════════ */
export function EquipeDemandasTab() {
  const { projetistas, loading, addProjetista, removeProjetista, refetch: refetchProjetistas } = useProjetistas();
  const { cards, moverCard, criarCard, deletarCard } = useProjetistaCards();
  const projetosKanban = useProjetosKanban();
  const [addModal, setAddModal] = React.useState(false);
  const [atribuirModal, setAtribuirModal] = React.useState(false);
  const [selectedProjetista, setSelectedProjetista] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ nome: "", email: "", especialidade: "" });
  const [atribuirForm, setAtribuirForm] = React.useState({ projetista_id: "", kanban_card_id: "", obra_code: "", titulo: "", tipo: "Piso", tamanho: "medio", prioridade: "normal", prazo: "" });
  const [saving, setSaving] = React.useState(false);
  const [dragged, setDragged] = React.useState<string | null>(null);
  const [loginModal, setLoginModal] = React.useState<Projetista | null>(null);
  const [loginForm, setLoginForm] = React.useState({ email: "", password: "" });
  const [loginSaving, setLoginSaving] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [loginOk, setLoginOk] = React.useState<string | null>(null);

  const viewProjetista = selectedProjetista ? projetistas.find(p => p.id === selectedProjetista) : null;
  const viewCards = selectedProjetista ? cards.filter(c => c.projetista_id === selectedProjetista) : [];

  const handleAdd = async () => {
    if (!form.nome) return;
    setSaving(true);
    await addProjetista(form);
    setSaving(false);
    setAddModal(false);
    setForm({ nome: "", email: "", especialidade: "" });
  };

  const handleSelecionarProjeto = (cardId: string) => {
    const projeto = projetosKanban.find(p => p.id === cardId);
    if (!projeto) { setAtribuirForm(f => ({ ...f, kanban_card_id: "", obra_code: "", titulo: "" })); return; }
    setAtribuirForm(f => ({ ...f, kanban_card_id: projeto.id, obra_code: projeto.obra, titulo: projeto.title }));
  };

  const handleAtribuir = async () => {
    if (!atribuirForm.projetista_id || !atribuirForm.kanban_card_id) return;
    setSaving(true);
    const { kanban_card_id, ...cardData } = atribuirForm;
    await criarCard({ ...cardData, status: "backlog" });
    await logToProjectCard(atribuirForm.obra_code, "atribuicao", `Projeto atribuído para ${projetistas.find(p => p.id === atribuirForm.projetista_id)?.nome ?? atribuirForm.projetista_id}`, "Thai");
    setSaving(false);
    setAtribuirModal(false);
    setAtribuirForm({ projetista_id: "", kanban_card_id: "", obra_code: "", titulo: "", tipo: "Piso", tamanho: "medio", prioridade: "normal", prazo: "" });
  };

  const handleDrop = (colId: string) => {
    if (dragged) { moverCard(dragged, colId); setDragged(null); }
  };

  const handleCriarLogin = async () => {
    if (!loginModal || !loginForm.email || !loginForm.password) return;
    setLoginSaving(true);
    setLoginError(null);
    try {
      const admin = createAdminClient();
      const { data, error: createErr } = await admin.auth.admin.createUser({
        email: loginForm.email,
        password: loginForm.password,
        email_confirm: true,
        user_metadata: { full_name: loginModal.nome, role: "projetista" },
      });
      if (createErr) throw new Error(createErr.message);
      // Cria perfil
      await supabase.from("user_profiles").upsert({
        id: data.user!.id,
        email: loginForm.email,
        full_name: loginModal.nome,
        role: "projetista",
        dept_permissions: {},
        avatar_color: "#8B5CF6",
      });
      // Vincula ao projetista
      await supabase.from("projetos_equipe").update({ user_id: data.user!.id, email: loginForm.email }).eq("id", loginModal.id);
      setLoginOk(`Login criado! ${loginModal.nome} pode acessar em /login com o e-mail ${loginForm.email}`);
      setLoginModal(null);
      setLoginForm({ email: "", password: "" });
      refetchProjetistas();
    } catch (e: any) {
      setLoginError(e?.message ?? "Erro desconhecido");
    } finally {
      setLoginSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>
            {viewProjetista ? `Demandas — ${viewProjetista.nome}` : "Equipe de Projetistas"}
          </h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>
            {viewProjetista ? "Kanban de demandas do projetista" : "Gestão da equipe e atribuição de projetos"}
          </p>
        </div>
        <div className="flex gap-2">
          {viewProjetista && (
            <Btn color={TEXT_DIM} variant="ghost" onClick={() => setSelectedProjetista(null)}>← Equipe</Btn>
          )}
          {!viewProjetista && (
            <>
              <Btn color={PURPLE} onClick={() => setAtribuirModal(true)}>+ Atribuir</Btn>
              <Btn color={TEAL} onClick={() => setAddModal(true)}>+ Projetista</Btn>
            </>
          )}
        </div>
      </div>

      {/* Lista de Projetistas */}
      {!viewProjetista && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loading && <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Carregando...</p>}
          {!loading && projetistas.length === 0 && (
            <div className="rounded-xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}`, gridColumn: "1/-1" }}>
              <Users size={24} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
              <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhum projetista cadastrado.</p>
              <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 4 }}>Clique em "+ Projetista" para adicionar.</p>
            </div>
          )}
          {projetistas.map(p => {
            const pCards = cards.filter(c => c.projetista_id === p.id);
            const emAnd = pCards.filter(c => c.status === "em_andamento").length;
            const total = pCards.length;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProjetista(p.id)}
                className="rounded-xl p-4 text-left transition-opacity hover:opacity-80"
                style={{ background: CARD_BG, border: `1px solid ${BORDER}`, cursor: "pointer" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${PURPLE}20` }}>
                    <User size={16} style={{ color: PURPLE }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{p.nome}</p>
                    <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{p.especialidade || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); setLoginModal(p); setLoginForm({ email: p.email || "", password: "" }); setLoginError(null); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: p.user_id ? GREEN : TEXT_DIM, padding: 2 }}
                      title={p.user_id ? "Login já criado" : "Criar login"}
                    >{p.user_id ? <CheckCircle2 size={13} /> : <KeyRound size={12} />}</button>
                    <button
                      onClick={e => { e.stopPropagation(); removeProjetista(p.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 2 }}
                      title="Remover projetista"
                    ><X size={12} /></button>
                  </div>
                </div>
                {p.user_id && (
                  <p className="mb-2" style={{ fontSize: "0.48rem", color: GREEN }}>Login ativo — {p.email}</p>
                )}
                <div className="flex gap-3">
                  {KANBAN_COLS.map(col => {
                    const n = pCards.filter(c => c.status === col.id).length;
                    return (
                      <div key={col.id} className="flex-1 text-center rounded-lg py-1" style={{ background: `${col.color}10` }}>
                        <p style={{ fontSize: "0.8rem", fontWeight: 700, color: col.color }}>{n}</p>
                        <p style={{ fontSize: "0.4rem", color: TEXT_DIM }}>{col.label}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{total} demanda{total !== 1 ? "s" : ""} · {emAnd} em andamento</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Kanban do Projetista */}
      {viewProjetista && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_COLS.map(col => (
            <div
              key={col.id}
              className="flex-shrink-0 rounded-xl p-3"
              style={{ width: 220, background: CARD_BG, border: `1px solid ${BORDER}` }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                <p style={{ fontSize: "0.65rem", fontWeight: 600, color: col.color }}>{col.label}</p>
                <span className="ml-auto rounded-full px-1.5" style={{ fontSize: "0.45rem", background: `${col.color}15`, color: col.color }}>
                  {viewCards.filter(c => c.status === col.id).length}
                </span>
              </div>
              <div className="space-y-2">
                {viewCards.filter(c => c.status === col.id).map(card => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDragged(card.id)}
                    className="rounded-lg p-3"
                    style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, cursor: "grab" }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-white" style={{ fontSize: "0.68rem", fontWeight: 500 }}>{card.titulo || card.obra_code}</p>
                      <button onClick={() => deletarCard(card.id)} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 0, flexShrink: 0 }}><X size={10} /></button>
                    </div>
                    <p style={{ fontSize: "0.55rem", color: ACCENT }}>{card.obra_code}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="rounded px-1 py-0.5" style={{ fontSize: "0.4rem", background: `${BLUE}15`, color: BLUE }}>{card.tipo}</span>
                      <span className="rounded px-1 py-0.5" style={{ fontSize: "0.4rem", background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>{card.tamanho}</span>
                      {card.prazo && (
                        <span className="ml-auto" style={{ fontSize: "0.45rem", color: TEXT_DIM }}>{card.prazo}</span>
                      )}
                    </div>
                    {card.prioridade === "urgente" && (
                      <p className="mt-1" style={{ fontSize: "0.45rem", color: RED, fontWeight: 700 }}>URGENTE</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Adicionar Projetista */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Adicionar Projetista">
        <FormField label="Nome Completo"><FInput placeholder="Ana Silva" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></FormField>
        <FormField label="E-mail"><FInput placeholder="ana@parket.com.br" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></FormField>
        <FormField label="Especialidade"><FInput placeholder="Piso, Marcenaria, Deck..." value={form.especialidade} onChange={e => setForm(f => ({ ...f, especialidade: e.target.value }))} /></FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={TEAL} disabled={saving || !form.nome} onClick={handleAdd}>{saving ? "Salvando..." : "Adicionar"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setAddModal(false)}>Cancelar</Btn>
        </div>
      </Modal>

      {/* Modal: Atribuir Projeto */}
      <Modal open={atribuirModal} onClose={() => setAtribuirModal(false)} title="Atribuir Projeto">
        <FormField label="Projetista">
          <FSelect value={atribuirForm.projetista_id} onChange={e => setAtribuirForm(f => ({ ...f, projetista_id: e.target.value }))}>
            <option value="">Selecionar projetista...</option>
            {projetistas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </FSelect>
        </FormField>
        <FormField label="Projeto">
          <FSelect
            value={atribuirForm.kanban_card_id}
            onChange={e => handleSelecionarProjeto(e.target.value)}
          >
            <option value="">Selecionar projeto...</option>
            {projetosKanban.map(p => (
              <option key={p.id} value={p.id}>{p.title}{p.obra ? ` — ${p.obra}` : ""}</option>
            ))}
          </FSelect>
        </FormField>
        {atribuirForm.kanban_card_id && (
          <div className="rounded-lg px-3 py-2" style={{ background: `${PURPLE}10`, border: `1px solid ${PURPLE}20` }}>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Obra: <span style={{ color: ACCENT }}>{atribuirForm.obra_code}</span></p>
            <p className="mt-0.5 truncate" style={{ fontSize: "0.6rem", color: "white" }}>{atribuirForm.titulo}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Tipo">
            <FSelect value={atribuirForm.tipo} onChange={e => setAtribuirForm(f => ({ ...f, tipo: e.target.value }))}>
              {["Piso","Marcenaria","Deck","Instalacao","Revestimento","Outros"].map(t => <option key={t}>{t}</option>)}
            </FSelect>
          </FormField>
          <FormField label="Tamanho">
            <FSelect value={atribuirForm.tamanho} onChange={e => setAtribuirForm(f => ({ ...f, tamanho: e.target.value }))}>
              <option value="pequeno">Pequeno</option>
              <option value="medio">Médio</option>
              <option value="grande">Grande</option>
            </FSelect>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Prioridade">
            <FSelect value={atribuirForm.prioridade} onChange={e => setAtribuirForm(f => ({ ...f, prioridade: e.target.value }))}>
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
              <option value="baixa">Baixa</option>
            </FSelect>
          </FormField>
          <FormField label="Prazo (data)"><FInput type="date" value={atribuirForm.prazo} onChange={e => setAtribuirForm(f => ({ ...f, prazo: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={PURPLE} disabled={saving || !atribuirForm.projetista_id || !atribuirForm.kanban_card_id} onClick={handleAtribuir}>{saving ? "Atribuindo..." : "Atribuir"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setAtribuirModal(false)}>Cancelar</Btn>
        </div>
      </Modal>

      {/* Modal: Criar Login do Projetista */}
      <Modal open={!!loginModal} onClose={() => { setLoginModal(null); setLoginError(null); }} title={`Criar Login — ${loginModal?.nome ?? ""}`}>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM, marginBottom: 12 }}>
          Crie as credenciais de acesso para o projetista. Ele terá acesso somente ao painel pessoal (<strong style={{ color: "white" }}>/meu-painel</strong>).
        </p>
        <FormField label="E-mail de acesso"><FInput type="email" placeholder="ana@parket.com.br" value={loginForm.email} onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))} /></FormField>
        <FormField label="Senha temporária"><FInput type="password" placeholder="Mínimo 6 caracteres" value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} /></FormField>
        {loginError && (
          <p className="rounded-lg px-3 py-2" style={{ fontSize: "0.6rem", color: RED, background: `${RED}10`, border: `1px solid ${RED}20` }}>{loginError}</p>
        )}
        {loginModal?.user_id && (
          <p className="rounded-lg px-3 py-2" style={{ fontSize: "0.6rem", color: YELLOW, background: `${YELLOW}10`, border: `1px solid ${YELLOW}20` }}>
            Este projetista já tem login. Preencha os campos acima para criar um novo acesso adicional.
          </p>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={GREEN} disabled={loginSaving || !loginForm.email || loginForm.password.length < 6} onClick={handleCriarLogin}>
            {loginSaving ? "Criando..." : "Criar Login"}
          </Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => { setLoginModal(null); setLoginError(null); }}>Cancelar</Btn>
        </div>
      </Modal>

      {/* Toast de sucesso */}
      {loginOk && (
        <div
          className="fixed bottom-6 left-1/2 rounded-xl px-4 py-3 flex items-center gap-2"
          style={{ transform: "translateX(-50%)", background: "#111", border: `1px solid ${GREEN}30`, zIndex: 100, maxWidth: 480 }}
        >
          <CheckCircle2 size={14} style={{ color: GREEN, flexShrink: 0 }} />
          <p style={{ fontSize: "0.65rem", color: "white" }}>{loginOk}</p>
          <button onClick={() => setLoginOk(null)} style={{ background:"none",border:"none",cursor:"pointer",color:TEXT_DIM,marginLeft:8 }}><X size={12}/></button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ABA 2 — SLA & PRAZOS
══════════════════════════════════════════════════════════ */
export function SlaTemplatesTab() {
  const { templates, fromDB, updateDias } = useSlaTemplates();
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editVal, setEditVal] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const tipos = [...new Set(templates.map(t => t.tipo))];
  const tamanhos = ["pequeno", "medio", "grande"];

  const getDias = (tipo: string, tam: string) => templates.find(t => t.tipo === tipo && t.tamanho === tam);

  const handleSave = async (t: SlaTemplate) => {
    const dias = parseInt(editVal, 10);
    if (isNaN(dias) || dias < 1) return;
    setSaving(true);
    await updateDias(t.id, dias, t.tipo, t.tamanho);
    setSaving(false);
    setEditId(null);
  };

  const tamLabel: Record<string, string> = { pequeno: "Pequeno (≤50m²)", medio: "Médio (51–150m²)", grande: "Grande (>150m²)" };
  const tamColor: Record<string, string> = { pequeno: GREEN, medio: YELLOW, grande: ORANGE };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>SLA & Prazos de Entrega</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Dias úteis por tipo e tamanho — editável pela Thai</p>
        {!fromDB && (
          <p className="mt-1 rounded px-2 py-1 inline-block" style={{ fontSize: "0.55rem", color: YELLOW, background: `${YELLOW}10`, border: `1px solid ${YELLOW}20` }}>
            Usando valores padrão — edite um campo para salvar no banco
          </p>
        )}
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        {/* Cabeçalho */}
        <div className="grid px-4 py-2" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(255,255,255,0.02)" }}>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Tipo</p>
          {tamanhos.map(t => (
            <p key={t} style={{ fontSize: "0.55rem", color: tamColor[t], fontWeight: 600, textAlign: "center" }}>{tamLabel[t]}</p>
          ))}
        </div>
        {/* Linhas */}
        {tipos.map((tipo, ti) => (
          <div key={tipo} className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", borderTop: `1px solid ${BORDER}`, background: ti % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
            <p className="text-white" style={{ fontSize: "0.7rem", fontWeight: 500 }}>{tipo}</p>
            {tamanhos.map(tam => {
              const cell = getDias(tipo, tam);
              if (!cell) return <div key={tam} />;
              const isEditing = editId === cell.id;
              return (
                <div key={tam} className="flex justify-center">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        className="rounded px-2 py-1 text-center"
                        style={{ width: 56, fontSize: "0.65rem", background: "rgba(255,255,255,0.06)", border: `1px solid ${PURPLE}`, color: "white", outline: "none" }}
                        autoFocus
                        onKeyDown={e => { if (e.key === "Enter") handleSave(cell); if (e.key === "Escape") setEditId(null); }}
                      />
                      <button onClick={() => handleSave(cell)} disabled={saving} style={{ background: "none", border: "none", cursor: "pointer", color: GREEN, padding: 2, fontSize: "0.7rem" }}>✓</button>
                      <button onClick={() => setEditId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: RED, padding: 2, fontSize: "0.7rem" }}>✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditId(cell.id); setEditVal(String(cell.dias)); }}
                      className="rounded-lg px-3 py-1.5 transition-opacity hover:opacity-80"
                      style={{ fontSize: "0.72rem", fontWeight: 700, color: tamColor[tam], background: `${tamColor[tam]}12`, border: `1px solid ${tamColor[tam]}20`, cursor: "pointer" }}
                      title="Clique para editar"
                    >
                      {cell.dias}d
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Clique em qualquer valor para editar. Pressione Enter para salvar ou Esc para cancelar.</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ABA 3 — CALENDÁRIO DE PROJETOS
══════════════════════════════════════════════════════════ */
export function CalendarioProjetosTab() {
  const [cards, setCards] = React.useState<ProjetistaCard[]>([]);
  const today = new Date();
  const [mes, setMes] = React.useState(today.getMonth());
  const [ano, setAno] = React.useState(today.getFullYear());

  React.useEffect(() => {
    supabase.from("projetos_demandas").select("*").then(({ data }) => setCards(data ?? []));
  }, []);

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];

  const eventosNoDia = (dia: number) => {
    const dateStr = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return cards.filter(c => c.prazo === dateStr);
  };

  const statusCol = (s: string) => s === "aprovado" ? GREEN : s === "em_andamento" ? BLUE : s === "revisao" ? YELLOW : TEXT_DIM;

  const prevMes = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
  const nextMes = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };

  const cells: (number | null)[] = [];
  for (let i = 0; i < primeiroDia; i++) cells.push(null);
  for (let d = 1; d <= diasNoMes; d++) cells.push(d);

  const todayNum = today.getMonth() === mes && today.getFullYear() === ano ? today.getDate() : -1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Calendário de Projetos</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Prazos de entrega por data</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMes} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM }}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: "0.75rem", color: "white", fontWeight: 600, minWidth: 120, textAlign: "center" }}>{meses[mes]} {ano}</span>
          <button onClick={nextMes} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Calendário */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        {/* Dias da semana */}
        <div className="grid grid-cols-7" style={{ background: "rgba(255,255,255,0.02)" }}>
          {diasSemana.map(d => (
            <div key={d} className="py-2 text-center" style={{ fontSize: "0.5rem", color: TEXT_DIM, fontWeight: 600, borderRight: `1px solid ${BORDER}` }}>{d}</div>
          ))}
        </div>
        {/* Células */}
        <div className="grid grid-cols-7">
          {cells.map((dia, i) => {
            const eventos = dia ? eventosNoDia(dia) : [];
            const isToday = dia === todayNum;
            return (
              <div
                key={i}
                className="min-h-[64px] p-1.5"
                style={{
                  borderTop: `1px solid ${BORDER}`,
                  borderRight: `1px solid ${BORDER}`,
                  background: isToday ? "rgba(139,92,246,0.06)" : "transparent",
                }}
              >
                {dia && (
                  <>
                    <p style={{ fontSize: "0.6rem", color: isToday ? PURPLE : TEXT_DIM, fontWeight: isToday ? 700 : 400, marginBottom: 2 }}>{dia}</p>
                    {eventos.map(ev => (
                      <div key={ev.id} className="rounded px-1 py-0.5 mb-0.5 truncate" style={{ background: `${statusCol(ev.status)}20`, border: `1px solid ${statusCol(ev.status)}30` }}>
                        <p style={{ fontSize: "0.4rem", color: statusCol(ev.status), fontWeight: 600 }}>{ev.obra_code}</p>
                        <p className="truncate" style={{ fontSize: "0.38rem", color: TEXT_DIM }}>{ev.titulo}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4">
        {KANBAN_COLS.map(col => (
          <div key={col.id} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: `${col.color}40`, border: `1px solid ${col.color}60` }} />
            <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{col.label}</span>
          </div>
        ))}
      </div>

      {/* Lista de prazos */}
      {cards.filter(c => c.prazo).length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Proximos Prazos</p>
          </div>
          {cards
            .filter(c => c.prazo)
            .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""))
            .slice(0, 8)
            .map(c => {
              const d = c.prazo ? new Date(c.prazo + "T00:00:00") : null;
              const diff = d ? Math.ceil((d.getTime() - Date.now()) / 86400000) : null;
              const urgColor = diff !== null ? (diff < 0 ? RED : diff <= 3 ? ORANGE : diff <= 7 ? YELLOW : GREEN) : TEXT_DIM;
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 600, color: ACCENT }}>{c.obra_code}</span>
                  <span className="flex-1 text-white truncate" style={{ fontSize: "0.65rem" }}>{c.titulo || c.tipo}</span>
                  <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{c.prazo}</span>
                  {diff !== null && (
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 700, background: `${urgColor}15`, color: urgColor }}>
                      {diff < 0 ? `${Math.abs(diff)}d atrasado` : diff === 0 ? "Hoje" : `${diff}d`}
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

/* ══════════════════════════════════════════════════════════
   ABA 4 — TIMELINE DO DESENVOLVIMENTO
══════════════════════════════════════════════════════════ */
export function TimelineProjetosTab() {
  const [cards, setCards] = React.useState<ProjetistaCard[]>([]);
  const [projetistas, setProjetistas] = React.useState<Projetista[]>([]);

  React.useEffect(() => {
    Promise.all([
      supabase.from("projetos_demandas").select("*"),
      supabase.from("projetos_equipe").select("*").eq("ativo", true),
    ]).then(([{ data: c }, { data: p }]) => {
      setCards(c ?? []);
      setProjetistas(p ?? []);
    });
  }, []);

  const today = new Date();
  // Janela: 30 dias antes até 60 dias depois
  const startDate = new Date(today); startDate.setDate(startDate.getDate() - 7);
  const endDate   = new Date(today); endDate.setDate(endDate.getDate() + 53);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  const DAY_PX = 28;
  const totalW = totalDays * DAY_PX;

  const getX = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return Math.round((d.getTime() - startDate.getTime()) / 86400000) * DAY_PX;
  };

  const todayX = Math.round((today.getTime() - startDate.getTime()) / 86400000) * DAY_PX;

  const statusCol = (s: string) => s === "aprovado" ? GREEN : s === "em_andamento" ? BLUE : s === "revisao" ? YELLOW : s === "backlog" ? TEXT_DIM : ORANGE;

  // Gerar marcações de semana
  const weekMarks: { x: number; label: string }[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    if (cur.getDay() === 1) { // Segunda-feira
      const x = Math.round((cur.getTime() - startDate.getTime()) / 86400000) * DAY_PX;
      weekMarks.push({ x, label: `${cur.getDate()}/${cur.getMonth() + 1}` });
    }
    cur.setDate(cur.getDate() + 1);
  }

  const cardsWithPrazo = cards.filter(c => c.prazo);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Timeline — Desenvolvimento</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Visão Gantt dos projetos em andamento</p>
      </div>

      {cardsWithPrazo.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <Clock size={24} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
          <p style={{ fontSize: "0.7rem", color: TEXT_DIM }}>Nenhum projeto com prazo definido.</p>
          <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 4 }}>Atribua projetos com prazo na aba "Equipe & Demandas".</p>
        </div>
      )}

      {cardsWithPrazo.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: totalW + 160 }}>
              {/* Cabeçalho de datas */}
              <div className="flex" style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)" }}>
                <div style={{ width: 160, flexShrink: 0, padding: "6px 12px" }}>
                  <p style={{ fontSize: "0.5rem", color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase" }}>Projeto</p>
                </div>
                <div className="relative flex-1" style={{ height: 28, overflow: "hidden" }}>
                  {weekMarks.map((w, i) => (
                    <div key={i} className="absolute" style={{ left: w.x, top: 0, height: "100%", borderLeft: `1px solid ${BORDER}` }}>
                      <p style={{ fontSize: "0.42rem", color: TEXT_DIM, paddingLeft: 3, paddingTop: 8 }}>{w.label}</p>
                    </div>
                  ))}
                  {/* Linha de hoje */}
                  <div className="absolute" style={{ left: todayX, top: 0, height: "100%", borderLeft: `2px solid ${PURPLE}`, opacity: 0.6 }} />
                </div>
              </div>

              {/* Linhas de projetos */}
              {cardsWithPrazo.map((card, i) => {
                const projetista = projetistas.find(p => p.id === card.projetista_id);
                const prazoX = getX(card.prazo!);
                // Barra começa no início ou em hoje, termina no prazo
                const barStart = Math.max(0, todayX - 30 * DAY_PX); // Mostrar últimos 30 dias
                const barW = Math.max(8, prazoX - barStart);
                const sc = statusCol(card.status);
                const isLate = new Date(card.prazo! + "T00:00:00") < today;

                return (
                  <div key={card.id} className="flex items-center" style={{ borderTop: i === 0 ? "none" : `1px solid ${BORDER}`, height: 44, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    {/* Label */}
                    <div style={{ width: 160, flexShrink: 0, padding: "0 12px" }}>
                      <p className="text-white truncate" style={{ fontSize: "0.65rem", fontWeight: 500 }}>{card.obra_code}</p>
                      <p className="truncate" style={{ fontSize: "0.48rem", color: TEXT_DIM }}>{projetista?.nome ?? "—"} · {card.tipo}</p>
                    </div>
                    {/* Linha de tempo */}
                    <div className="relative flex-1" style={{ height: "100%", overflow: "hidden" }}>
                      {/* Marcações de semana */}
                      {weekMarks.map((w, wi) => (
                        <div key={wi} className="absolute" style={{ left: w.x, top: 0, height: "100%", borderLeft: `1px solid ${BORDER}`, opacity: 0.4 }} />
                      ))}
                      {/* Linha de hoje */}
                      <div className="absolute" style={{ left: todayX, top: 0, height: "100%", borderLeft: `2px solid ${PURPLE}`, opacity: 0.5 }} />
                      {/* Barra da tarefa */}
                      <div
                        className="absolute rounded"
                        style={{
                          left: Math.max(0, todayX - (card.status === "backlog" ? 0 : 5 * DAY_PX)),
                          top: "50%", transform: "translateY(-50%)",
                          width: Math.max(8, prazoX - Math.max(0, todayX - 5 * DAY_PX)),
                          height: 16,
                          background: `${sc}25`,
                          border: `1px solid ${sc}50`,
                          minWidth: 24,
                        }}
                      />
                      {/* Marcador de prazo */}
                      <div
                        className="absolute flex items-center gap-1"
                        style={{ left: prazoX - 4, top: "50%", transform: "translateY(-50%)" }}
                      >
                        <div className="rounded-sm" style={{ width: 8, height: 18, background: isLate ? RED : sc, opacity: 0.9 }} />
                        <p style={{ fontSize: "0.42rem", color: isLate ? RED : sc, fontWeight: 600, whiteSpace: "nowrap" }}>
                          {card.prazo} {isLate ? "ATRASADO" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-4 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.01)" }}>
            {KANBAN_COLS.map(col => (
              <div key={col.id} className="flex items-center gap-1.5">
                <div className="rounded-sm" style={{ width: 10, height: 10, background: `${col.color}30`, border: `1px solid ${col.color}60` }} />
                <span style={{ fontSize: "0.45rem", color: TEXT_DIM }}>{col.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <div style={{ width: 2, height: 14, background: PURPLE, opacity: 0.7 }} />
              <span style={{ fontSize: "0.45rem", color: TEXT_DIM }}>Hoje</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Re-export para uso em extraTabs
══════════════════════════════════════════════════════════ */
export { SolicitacaoComprasTab };
