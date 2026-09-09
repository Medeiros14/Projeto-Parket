/* ═══ PÁGINA PÚBLICA — SOLICITAÇÃO DE COMPRAS ═══
   Acessível sem autenticação via /solicitar-compras
   Qualquer pessoa pode preencher e enviar uma solicitação de materiais.
   ═══════════════════════════════════════════════ */
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { CheckCircle2, Plus, X, ShoppingCart, Briefcase } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const ACCENT = "#D4A853";
const GREEN = "#10B981";
const RED = "#EF4444";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const CARD_BG = "#111";

interface MaterialItem { tipo: string; quantidade: string; justificativa: string; }
interface ObraOption { id: string; title: string; obra: string; }

/* ── Routing por departamento ── */
const DEPT_ROUTING: Record<string, { dept_id: string; responsavel: string }> = {
  "marcenaria-ronaldo":  { dept_id: "compras",        responsavel: "Ronaldo" },
  "lalamove-ronaldo":    { dept_id: "compras",        responsavel: "Ronaldo" },
  "instalacao-taiara":   { dept_id: "compras-taiara", responsavel: "Taiara" },
  "amostras-marco":      { dept_id: "compras-marco",  responsavel: "Marco Antônio" },
  "expedicao-ailton":    { dept_id: "logistica",      responsavel: "Ailton" },
};

/* ── Projetos fixos pré-definidos ── */
const FIXED_PROJECTS: ObraOption[] = [
  { id: "fix-pk01", title: "Casa Parket",                       obra: "PK01" },
  { id: "fix-pk02", title: "Office - Cidade Jardim",            obra: "PK02" },
  { id: "fix-pk03", title: "Arvo Marcenaria - Fábrica Curitiba", obra: "PK03" },
  { id: "fix-pk04", title: "Marcenaria Barra Funda",            obra: "PK04" },
];

/* ── Embed wrapper ── */
export function SolicitarComprasEmbed({ onSuccess }: { onSuccess?: () => void }) {
  return <SolicitarComprasPage embed onSuccess={onSuccess} />;
}

/* ── Página principal ── */
export function SolicitarComprasPage({ embed, onSuccess }: { embed?: boolean; onSuccess?: () => void } = {}) {
  // Auto-preenche o solicitante a partir do usuário logado (quando há).
  // No uso público (rota /solicitar-compras sem login), useAuth retorna
  // null e cai pro fallback "" — mantém o comportamento legado intacto.
  const { user } = useAuth();
  const solicitanteDefault = (user as any)?.name || (user as any)?.email || "";
  const [materiais, setMateriais] = useState<MaterialItem[]>([{ tipo: "", quantidade: "", justificativa: "" }]);
  const [solicitante, setSolicitante] = useState(solicitanteDefault);
  const [setor, setSetor] = useState("");
  const [destDept, setDestDept] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [linkedProject, setLinkedProject] = useState<ObraOption | null>(null);
  const [obraOptions, setObraOptions] = useState<ObraOption[]>([]);
  const [loadingObras, setLoadingObras] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectObra, setNewProjectObra] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Carrega lista de projetos para o picker (inclui fixos)
  useEffect(() => {
    if (!showProjectPicker) return;
    if (obraOptions.length > 0) return;
    setLoadingObras(true);
    supabase.from("kanban_cards").select("id,title,obra")
      .in("dept_id", ["obras", "projetos"])
      .order("title").limit(1000)
      .then(({ data }) => {
        const rows = data ?? [];
        const existing = new Set(rows.map(r => r.title.toLowerCase()));
        const extras = FIXED_PROJECTS.filter(fp => !existing.has(fp.title.toLowerCase()));
        setObraOptions([...extras, ...rows] as ObraOption[]);
        setLoadingObras(false);
      });
  }, [showProjectPicker]);

  const filteredObras = obraOptions.filter(o => {
    const q = projectSearch.toLowerCase();
    return !q || o.title.toLowerCase().includes(q) || (o.obra ?? "").toLowerCase().includes(q);
  });

  /* ── Criar projeto inline ── */
  const handleCreateProject = async () => {
    setCreateProjectError(null);
    if (!newProjectName.trim()) { setCreateProjectError("Informe o nome do projeto/cliente"); return; }
    setCreatingProject(true);
    const { data, error: err } = await supabase.from("kanban_cards").insert({
      dept_id: "projetos", column_id: "novo", title: newProjectName.trim(),
      obra: newProjectObra.trim() || null, sla: "7d", sla_status: "ok", priority: "media",
    }).select("id,title,obra").single();
    setCreatingProject(false);
    if (err || !data) { setCreateProjectError("Erro ao criar projeto. Tente novamente."); return; }
    const created = data as ObraOption;
    setObraOptions(prev => [created, ...prev]);
    setProjectId(created.id);
    setLinkedProject(created);
    setShowNewProject(false);
    setShowProjectPicker(false);
    setNewProjectName("");
    setNewProjectObra("");
    setProjectSearch("");
  };

  const addMaterial = () => setMateriais(prev => [...prev, { tipo: "", quantidade: "", justificativa: "" }]);
  const removeMaterial = (i: number) => setMateriais(prev => prev.filter((_, idx) => idx !== i));
  const updateMaterial = (i: number, field: keyof MaterialItem, value: string) =>
    setMateriais(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = materiais.filter(m => m.tipo.trim());
    if (!solicitante.trim()) { setError("Informe seu nome."); return; }
    if (!destDept) { setError("Selecione o departamento de destino."); return; }
    if (valid.length === 0) { setError("Informe ao menos um material."); return; }
    if (!prazo) { setError("Informe o prazo estimado de entrega."); return; }
    setSaving(true); setError(null);

    const routing = DEPT_ROUTING[destDept] ?? { dept_id: "compras", responsavel: "Ronaldo" };
    const now = new Date().toISOString();
    const dataCurta = new Date().toLocaleDateString("pt-BR");
    const nomeExibido = setor ? `${solicitante} (${setor})` : solicitante;

    const isFixed = projectId?.startsWith("fix-");
    const parentCardId = projectId && !isFixed ? projectId : undefined;

    const { data: created, error: insertErr } = await supabase.from("kanban_cards").insert({
      dept_id: routing.dept_id,
      column_id: "entrada",
      title: `Solicitação — ${nomeExibido} — ${dataCurta}`,
      responsavel: routing.responsavel,
      sla: "7d",
      sla_status: "ok",
      priority: "media",
      parent_card_id: parentCardId,
      checklist_done: 0,
      checklist_total: 8,
      details: {
        solicitante: nomeExibido,
        setor,
        projeto_fixo: isFixed ? linkedProject?.title : undefined,
        projeto_fixo_codigo: isFixed ? linkedProject?.obra : undefined,
        departamento_compras: destDept,
        responsavel_compras: routing.responsavel,
        data_solicitacao: now,
        data_solicitacao_fmt: dataCurta,
        data_limite_entrega: prazo,
        materiais: valid,
        obs_solicitacao: observacoes,
        status_solicitacao: "pendente",
        tipo_requisicao: "obra",
        itens: valid.map(m => `${m.quantidade ? m.quantidade + " — " : ""}${m.tipo}`),
        origem: "formulario_publico",
        checklists: [
          {
            name: "Cotação",
            items: [
              { name: "Identificar fornecedores qualificados", done: false },
              { name: "Solicitar 03 cotações para comparação", done: false },
              { name: "Analisar custo-benefício (preço, prazo, qualidade, condições de pagamento)", done: false },
              { name: "Registrar cotações e decisões no sistema", done: false },
            ],
          },
          {
            name: "Interface Financeira",
            items: [
              { name: "Confirmar Valor", done: false },
              { name: "Confirmar prazo de entrega", done: false },
              { name: "Informar BF/FÁBRICA", done: false },
              { name: "Salvar Comprovante do Pedido", done: false },
            ],
          },
        ],
      },
    }).select().single();

    if (insertErr || !created) {
      setError("Erro ao enviar solicitação. Por favor, tente novamente.");
      setSaving(false);
      return;
    }

    // Vincula ao projeto se selecionado (somente se não for fixo)
    if (parentCardId) {
      const { data: proj } = await supabase.from("kanban_cards").select("details").eq("id", parentCardId).single();
      if (proj) {
        const pd = (proj.details as Record<string, unknown>) ?? {};
        const existing = ((pd.solicitacoes_compras as unknown[]) ?? []);
        await supabase.from("kanban_cards").update({
          details: { ...pd, solicitacoes_compras: [...existing, { id: (created as any).id, solicitante: nomeExibido, data: now, prazo, materiais: valid, status: "pendente" }] },
        }).eq("id", parentCardId);
      }
    }

    // Webhook — notifica agente IA
    try {
      fetch("https://agente.parket.works/api/handoffs/nova-solicitacao-compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: `Solicitação — ${nomeExibido} — ${dataCurta}`,
          solicitante: nomeExibido,
          itens: valid.map(m => `${m.quantidade ? m.quantidade + " — " : ""}${m.tipo}${m.justificativa ? ` (${m.justificativa})` : ""}`),
          prazo,
          projeto_vinculado: linkedProject ? `${linkedProject.obra ? linkedProject.obra + " — " : ""}${linkedProject.title}` : undefined,
          card_id: (created as any)?.id,
        }),
      });
    } catch { /* silently ignore webhook errors */ }

    setSaving(false);
    setSuccess(true);
    onSuccess?.();
  };

  const iStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
    borderRadius: 8, color: "white", fontSize: "0.8rem", padding: "10px 12px",
    outline: "none", boxSizing: "border-box",
  };
  const lStyle: React.CSSProperties = {
    display: "block", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.1em",
    color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 6,
  };

  const pad = "24px 28px";

  return (
    <div style={{ minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : "#0A0A0A", display: "flex", flexDirection: "column", alignItems: "center", padding: embed ? "1rem" : "2rem 1rem" }}>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 640, marginBottom: 32 }}>
        <div className="flex items-center gap-3 mb-6">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShoppingCart size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>Parket</p>
            <h1 style={{ color: "white", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Solicitação de Compras</h1>
          </div>
        </div>
        <p style={{ fontSize: "0.75rem", color: TEXT_DIM, lineHeight: 1.6 }}>
          Preencha o formulário abaixo para solicitar materiais ao setor de Compras.
          Sua solicitação será analisada e você receberá uma resposta em breve.
        </p>
      </div>

      {/* Form */}
      <div style={{ width: "100%", maxWidth: 640, background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden" }}>
        {success ? (
          <div style={{ padding: "60px 40px", textAlign: "center" }}>
            <CheckCircle2 size={52} style={{ color: GREEN, margin: "0 auto 16px" }} />
            <h2 style={{ color: "white", fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px" }}>Solicitação enviada!</h2>
            <p style={{ fontSize: "0.75rem", color: TEXT_DIM, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 24px" }}>
              Sua solicitação foi registrada no setor de Compras e será analisada em breve.
              {linkedProject && <> O projeto <strong style={{ color: ACCENT }}>{linkedProject.obra || linkedProject.title}</strong> também foi atualizado.</>}
            </p>
            <button
              onClick={() => { setSuccess(false); setMateriais([{ tipo: "", quantidade: "", justificativa: "" }]); setSolicitante(""); setSetor(""); setDestDept(""); setPrazo(""); setObservacoes(""); setProjectId(null); setLinkedProject(null); }}
              style={{ padding: "10px 24px", background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, borderRadius: 10, color: ACCENT, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
            >
              Nova Solicitação
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ padding: pad, borderBottom: `1px solid ${BORDER}` }}>
              <h3 style={{ color: "white", fontSize: "0.85rem", fontWeight: 600, margin: "0 0 4px" }}>Dados da Solicitação</h3>
              <p style={{ fontSize: "0.6rem", color: TEXT_DIM, margin: 0 }}>Campos marcados com * são obrigatórios</p>
            </div>

            <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Solicitante + Setor */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={lStyle}>Seu Nome *</label>
                  <input value={solicitante} onChange={e => setSolicitante(e.target.value)} placeholder="Nome completo" style={iStyle} required />
                </div>
                <div>
                  <label style={lStyle}>Setor / Departamento</label>
                  <input value={setor} onChange={e => setSetor(e.target.value)} placeholder="Ex: Obras, Fiscal..." style={iStyle} />
                </div>
              </div>

              {/* Departamento de Destino */}
              <div>
                <label style={lStyle}>Departamento de Destino *</label>
                <select
                  value={destDept}
                  onChange={e => setDestDept(e.target.value)}
                  style={{ ...iStyle, cursor: "pointer" }}
                  required
                >
                  <option value="">Selecione para onde vai a solicitação...</option>
                  <option value="marcenaria-ronaldo">Marcenaria — Ronaldo</option>
                  <option value="lalamove-ronaldo">Pedidos Lalamove — Ronaldo</option>
                  <option value="instalacao-taiara">Compras Instalação — Taiara</option>
                  <option value="amostras-marco">Amostras Marcenaria — Marco Antônio</option>
                  <option value="expedicao-ailton">Expedição — Ailton</option>
                </select>
              </div>

              {/* Projeto vinculado */}
              <div>
                <label style={lStyle}>Projeto / Obra (se aplicável)</label>
                {linkedProject ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <Briefcase size={13} style={{ color: GREEN, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", color: GREEN, fontWeight: 600 }}>{linkedProject.obra ? `${linkedProject.obra} — ` : ""}{linkedProject.title}</span>
                    </div>
                    <button type="button" onClick={() => { setProjectId(null); setLinkedProject(null); }} style={{ fontSize: "0.6rem", color: TEXT_DIM, background: "none", border: "none", cursor: "pointer", padding: "4px 6px" }}>Trocar</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowProjectPicker(prev => !prev)} style={{ ...iStyle, textAlign: "left", cursor: "pointer", color: TEXT_DIM }}>
                    Selecionar projeto (opcional)...
                  </button>
                )}

                {/* Picker inline — busca + lista */}
                {showProjectPicker && !showNewProject && (
                  <div style={{ marginTop: 6, background: "#161616", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", maxHeight: 280 }}>
                    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
                      <input autoFocus value={projectSearch} onChange={e => setProjectSearch(e.target.value)} placeholder="Buscar por obra ou cliente..." style={{ ...iStyle, fontSize: "0.75rem" }} />
                    </div>
                    <div style={{ overflowY: "auto", maxHeight: 170 }}>
                      {loadingObras && <p style={{ padding: 14, fontSize: "0.68rem", color: TEXT_DIM, textAlign: "center" }}>Carregando projetos...</p>}
                      {!loadingObras && filteredObras.length === 0 && <p style={{ padding: 14, fontSize: "0.68rem", color: TEXT_DIM, textAlign: "center" }}>Nenhum projeto encontrado.</p>}
                      {filteredObras.map(o => (
                        <button key={o.id} type="button" onClick={() => { setProjectId(o.id); setLinkedProject(o); setShowProjectPicker(false); setProjectSearch(""); }}
                          className="w-full text-left flex items-center gap-2 px-4 py-2.5"
                          style={{ background: "transparent", border: "none", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                          {o.obra && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: ACCENT, flexShrink: 0 }}>{o.obra}</span>}
                          <span className="truncate" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.8)" }}>{o.title}</span>
                        </button>
                      ))}
                    </div>
                    {/* Botao para criar novo projeto */}
                    <button type="button" onClick={() => { setShowNewProject(true); setNewProjectName(projectSearch); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3"
                      style={{ background: "rgba(212,168,83,0.08)", border: "none", borderTop: `1px solid ${BORDER}`, color: ACCENT, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
                      <Plus size={13} /> ADICIONAR NOVO
                    </button>
                  </div>
                )}

                {/* Formulario inline — criar novo projeto */}
                {showProjectPicker && showNewProject && (
                  <div style={{ marginTop: 6, background: "#161616", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, color: ACCENT, letterSpacing: "0.08em" }}>NOVO PROJETO / OBRA</p>
                    <div>
                      <label style={lStyle}>Nome do cliente / projeto *</label>
                      <input autoFocus value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Ex: João Silva — Casa Alphaville" style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>Identificação da obra (opcional)</label>
                      <input value={newProjectObra} onChange={e => setNewProjectObra(e.target.value)} placeholder="Ex: OB-2026-042" style={iStyle} />
                    </div>
                    {createProjectError && <p style={{ fontSize: "0.62rem", color: RED }}>{createProjectError}</p>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => { setShowNewProject(false); setCreateProjectError(null); }}
                        style={{ flex: 1, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT_DIM, fontSize: "0.68rem", padding: "9px 12px", cursor: "pointer", fontWeight: 600 }}>
                        Cancelar
                      </button>
                      <button type="button" onClick={handleCreateProject} disabled={creatingProject}
                        style={{ flex: 2, background: ACCENT, border: "none", borderRadius: 7, color: "#000", fontSize: "0.68rem", padding: "9px 12px", cursor: creatingProject ? "wait" : "pointer", fontWeight: 700, letterSpacing: "0.05em" }}>
                        {creatingProject ? "CRIANDO..." : "CRIAR E SELECIONAR"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Prazo */}
              <div>
                <label style={lStyle}>Prazo Estimado de Entrega *</label>
                <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} style={iStyle} required />
              </div>

              {/* Materiais */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <label style={{ ...lStyle, marginBottom: 0 }}>Materiais Solicitados *</label>
                  <button type="button" onClick={addMaterial}
                    className="flex items-center gap-1.5"
                    style={{ fontSize: "0.65rem", color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    <Plus size={12} /> Adicionar material
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {materiais.map((m, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span style={{ fontSize: "0.6rem", color: TEXT_DIM, fontWeight: 600 }}>Material {i + 1}</span>
                        {materiais.length > 1 && (
                          <button type="button" onClick={() => removeMaterial(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", padding: 3 }}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={lStyle}>Tipo / Descrição *</label>
                          <input value={m.tipo} onChange={e => updateMaterial(i, "tipo", e.target.value)} placeholder="Ex: Piso vinílico, Cola Sika, Prego..." style={iStyle} />
                        </div>
                        <div>
                          <label style={lStyle}>Quantidade</label>
                          <input value={m.quantidade} onChange={e => updateMaterial(i, "quantidade", e.target.value)} placeholder="Ex: 50m², 10 cx" style={iStyle} />
                        </div>
                      </div>
                      <div>
                        <label style={lStyle}>Justificativa / Especificação</label>
                        <textarea value={m.justificativa} onChange={e => updateMaterial(i, "justificativa", e.target.value)} rows={2}
                          placeholder="Descreva para que será usado, especificações técnicas, urgência..."
                          style={{ ...iStyle, resize: "vertical" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observacoes gerais */}
              <div>
                <label style={lStyle}>Observações Gerais (opcional)</label>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3}
                  placeholder="Informações adicionais, endereço de entrega, contato, urgência..."
                  style={{ ...iStyle, resize: "vertical" }} />
              </div>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: "0.72rem", color: RED, margin: 0 }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={saving}
                style={{ width: "100%", padding: "13px", background: saving ? "rgba(212,168,83,0.2)" : ACCENT, border: "none", borderRadius: 10, color: saving ? TEXT_DIM : "#0A0A0A", fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", marginTop: 4 }}>
                {saving ? "Enviando solicitação..." : "Enviar Solicitação de Compras"}
              </button>
            </div>
          </form>
        )}
      </div>

      <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 24 }}>Parket · Sistema Operacional</p>
    </div>
  );
}
