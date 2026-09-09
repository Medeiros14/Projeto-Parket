/**
 * Solicitação de compras da PRODUÇÃO — mesmo fluxo do compras.parket.works/solicitar
 * (anti-dup 10min por pedido_por, roteamento por departamento → dept_id/responsável,
 * seed de checklists (8 itens), vínculo OBRIGATÓRIO com projeto existente ou local
 * interno (Will 02/09: solicitação sempre em cima de projeto que já temos) e webhook
 * de notificação WhatsApp). O card cai direto no kanban do Compras.
 */
import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { Plus, Trash2, CheckCircle2, Search, X } from "lucide-react";

type Material = { tipo: string; quantidade: string; justificativa: string };
type ProjetoLite = { id: string; title: string; obra: string | null };

// Locais internos Parket — opções fixas no topo do dropdown de projeto.
// Não são cards do kanban de Projetos, então NÃO geram parent_card_id.
const LOCAIS_INTERNOS: ProjetoLite[] = [
  { id: "interno:marcenaria-curitiba",    title: "Marcenaria Curitiba",    obra: null },
  { id: "interno:marcenaria-barra-funda", title: "Marcenaria Barra Funda", obra: null },
  { id: "interno:casa-parket",            title: "Casa Parket",            obra: null },
  { id: "interno:office-parket",          title: "Office Parket",          obra: null },
  { id: "interno:expedicao-barra-funda",  title: "Expedição Barra Funda",  obra: null },
];

const DEPT_ROUTING: Record<string, { dept_id: string; responsavel: string }> = {
  "marcenaria-ronaldo": { dept_id: "compras",        responsavel: "Ronaldo" },
  "lalamove-ronaldo":   { dept_id: "compras",        responsavel: "Ronaldo" },
  "instalacao-taiara":  { dept_id: "compras-taiara", responsavel: "Taiara" },
  "amostras-marco":     { dept_id: "compras-marco",  responsavel: "Marco Antônio" },
};

const DEPT_OPTS = [
  { value: "marcenaria-ronaldo", label: "Marcenaria — Ronaldo" },
  { value: "lalamove-ronaldo",   label: "Lalamove / Frete — Ronaldo" },
  { value: "instalacao-taiara",  label: "Instalação — Taiara" },
  { value: "amostras-marco",     label: "Amostras — Marco Antônio" },
];

// Seed idêntico ao form do Compras — checklist_total: 8
const CHECKLISTS_SEED = [
  { name: "Cotação", items: [
    { name: "Identificar fornecedores qualificados", done: false },
    { name: "Solicitar 03 cotações para comparação", done: false },
    { name: "Analisar custo-benefício (preço, prazo, qualidade, condições de pagamento)", done: false },
    { name: "Registrar cotações e decisões no sistema", done: false },
  ]},
  { name: "Interface Financeira", items: [
    { name: "Confirmar Valor", done: false },
    { name: "Confirmar prazo de entrega", done: false },
    { name: "Informar BF/FÁBRICA", done: false },
    { name: "Salvar Comprovante do Pedido", done: false },
  ]},
];

export default function SolicitarCompra() {
  const { t } = useTheme();
  const [nome, setNome] = useState("");
  const [pedidoPor, setPedidoPor] = useState("");
  const [setor, setSetor] = useState("PRODUÇÃO");
  const [deptDestino, setDeptDestino] = useState("marcenaria-ronaldo");
  const [projetoId, setProjetoId] = useState("");
  const [projetos, setProjetos] = useState<ProjetoLite[]>([]);
  const [cardsProjetos, setCardsProjetos] = useState<ProjetoLite[]>([]);
  const [projBusca, setProjBusca] = useState("");
  const [projOpen, setProjOpen] = useState(false);
  const [materiais, setMateriais] = useState<Material[]>([{ tipo: "", quantidade: "", justificativa: "" }]);
  const [prazo, setPrazo] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // Projetos vêm do banco de obras (mesma fonte do Compras), sem duplicata.
  // Cards do kanban de Projetos ficam só pra resolver o vínculo (parent_card_id).
  useEffect(() => {
    (async () => {
      const [{ data: obras }, { data: cards }] = await Promise.all([
        sb.from("obras").select("id,cliente").not("cliente", "is", null).order("cliente").limit(2000),
        sb.from("kanban_cards").select("id,title,obra").eq("dept_id", "projetos").limit(1000),
      ]);
      const vistos = new Set<string>();
      const lista: ProjetoLite[] = [];
      ((obras as any[]) || []).forEach((o) => {
        const nomeObra = String(o.cliente || "").trim();
        if (!nomeObra || vistos.has(nomeObra.toUpperCase())) return;
        vistos.add(nomeObra.toUpperCase());
        lista.push({ id: `obra:${o.id}`, title: nomeObra, obra: null });
      });
      setProjetos(lista);
      setCardsProjetos((cards as unknown as ProjetoLite[]) || []);
    })();
  }, []);

  const projLabel = (p: ProjetoLite) => `${p.obra ? p.obra + " — " : ""}${p.title}`;
  const todosProjetos = useMemo(() => [...LOCAIS_INTERNOS, ...projetos], [projetos]);
  const projetoSel = projetoId ? todosProjetos.find((p) => p.id === projetoId) : undefined;
  const projFiltrados = useMemo(() => {
    const q = projBusca.trim().toLowerCase();
    if (!q) return todosProjetos.slice(0, 45);
    return todosProjetos.filter((p) => projLabel(p).toLowerCase().includes(q)).slice(0, 45);
  }, [todosProjetos, projBusca]);

  const addMat = () => setMateriais((m) => [...m, { tipo: "", quantidade: "", justificativa: "" }]);
  const rmMat = (i: number) => setMateriais((m) => m.filter((_, j) => j !== i));
  const setMat = (i: number, k: keyof Material, v: string) =>
    setMateriais((m) => m.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mats = materiais.filter((m) => m.tipo.trim());
    if (!nome.trim()) { setErro("Informe seu nome."); return; }
    if (!pedidoPor.trim()) { setErro("Informe quem está pedindo o material."); return; }
    if (!deptDestino) { setErro("Selecione o departamento de destino."); return; }
    // Will 02/09: toda solicitação nasce em cima de um projeto existente (ou local
    // interno Parket). Sem seleção da lista não passa — nada de solicitação órfã.
    if (!projetoId) { setErro("Selecione o projeto vinculado na lista (ou um local interno Parket)."); return; }
    if (mats.length === 0) { setErro("Informe ao menos um material."); return; }
    // Compras precisa entender o pra quê de cada item — justificativa obrigatória.
    const semJust = mats.findIndex((m) => !m.justificativa.trim());
    if (semJust >= 0) { setErro(`Informe a justificativa do material ${semJust + 1} (por que precisa, obra/aplicação).`); return; }
    if (!prazo) { setErro("Informe o prazo estimado de entrega."); return; }

    setEnviando(true); setErro(null);

    // Anti-dup — solicitações do mesmo pedido_por nos últimos 10 minutos
    try {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recs } = await sb.from("kanban_cards")
        .select("id,title,created_at,details")
        .eq("details->>pedido_por", pedidoPor.trim())
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5);
      if (recs && recs.length > 0) {
        const lista = recs.map((c: any) => {
          const hora = new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const ms = ((c.details?.materiais as any[]) || []).map((i) => i.tipo).filter(Boolean).join(", ").slice(0, 60);
          return "• " + hora + " — " + (ms || "(sem materiais)");
        }).join("\n");
        const ok = window.confirm(
          `⚠️ Já existem ${recs.length} solicitação(ões) recente(s) de ${pedidoPor.trim()} nos últimos 10 minutos:\n\n${lista}\n\nTem certeza que quer criar mais uma?`
        );
        if (!ok) { setEnviando(false); return; }
      }
    } catch (err) {
      console.warn("[producao] check anti-dup falhou", err);
    }

    const rota = DEPT_ROUTING[deptDestino] ?? { dept_id: "compras", responsavel: "Ronaldo" };
    const nowIso = new Date().toISOString();
    const hoje = new Date().toLocaleDateString("pt-BR");
    const solicitante = `${pedidoPor.trim()}${nome.trim() && nome.trim() !== pedidoPor.trim() ? " · " + nome.trim() : ""}${setor.trim() ? " (" + setor.trim() + ")" : ""}`;
    const projeto = projetoId ? todosProjetos.find((p) => p.id === projetoId) : undefined;
    // Vínculo com o card do kanban de Projetos: match por nome (obra: ids vêm do banco de obras).
    let parentId: string | undefined;
    if (projeto && !projetoId.startsWith("interno:")) {
      const alvo = projeto.title.trim().toUpperCase();
      parentId = cardsProjetos.find((c) => String(c.title || "").trim().toUpperCase() === alvo)?.id;
    }
    const projetoNome = projeto ? `${projeto.obra ? projeto.obra + " — " : ""}${projeto.title}` : "";
    const titulo = projetoNome || `Solicitação — ${hoje}`;

    const { data: novo, error } = await sb.from("kanban_cards").insert({
      dept_id: rota.dept_id,
      column_id: rota.dept_id === "compras-marco" ? "solicitacao" : "entrada",
      title: titulo,
      obra: projeto?.obra ?? null,
      responsavel: rota.responsavel,
      sla: "7d",
      sla_status: "ok",
      priority: "media",
      parent_card_id: parentId,
      checklist_done: 0,
      checklist_total: 8,
      details: {
        solicitante,
        projeto_nome: projetoNome || undefined,
        setor: setor.trim(),
        pedido_por: pedidoPor.trim(),
        departamento_compras: deptDestino,
        responsavel_compras: rota.responsavel,
        data_solicitacao: nowIso,
        data_solicitacao_fmt: hoje,
        data_limite_entrega: prazo,
        materiais: mats,
        obs_solicitacao: obs,
        observacoes: obs,
        status_solicitacao: "pendente",
        tipo_requisicao: "obra",
        itens: mats.map((m) => `${m.quantidade ? m.quantidade + " — " : ""}${m.tipo}`),
        origem: "producao_app",
        checklists: CHECKLISTS_SEED,
      },
    }).select().single();

    if (error || !novo) {
      setErro("Erro ao enviar solicitação. Por favor, tente novamente.");
      setEnviando(false);
      return;
    }

    // Vínculo reverso no card de projeto (details.solicitacoes_compras)
    if (parentId) {
      const { data: pc } = await sb.from("kanban_cards").select("details").eq("id", parentId).single();
      if (pc) {
        const d = ((pc as any).details as any) ?? {};
        const arr = d.solicitacoes_compras ?? [];
        await sb.from("kanban_cards").update({
          details: { ...d, solicitacoes_compras: [...arr, { id: (novo as any).id, solicitante, data: nowIso, prazo, materiais: mats, status: "pendente" }] },
        }).eq("id", parentId);
      }
    }

    // Notificação WhatsApp do grupo de Compras (best-effort)
    try {
      fetch("https://agente.parket.works/api/handoffs/nova-solicitacao-compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          solicitante,
          itens: mats.map((m) => `${m.quantidade ? m.quantidade + " — " : ""}${m.tipo}${m.justificativa ? ` (${m.justificativa})` : ""}`),
          prazo,
          projeto_vinculado: projeto ? `${projeto.obra ? projeto.obra + " — " : ""}${projeto.title}` : undefined,
          card_id: (novo as any).id,
        }),
      });
    } catch { /* noop */ }

    setEnviando(false);
    setEnviado(true);
  }

  const inp: React.CSSProperties = {
    width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
    color: t.textPrimary, fontSize: 13, padding: "10px 12px", borderRadius: 0,
    outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em",
    color: t.textMuted, textTransform: "uppercase", marginBottom: 6,
  };

  if (enviado) {
    return (
      <div style={{ padding: "24px 28px", display: "grid", placeItems: "center", minHeight: "70vh" }}>
        <div style={{
          width: 440, padding: 36, background: t.bgElevated, border: `1px solid ${t.border}`,
          textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center",
        }}>
          <CheckCircle2 size={40} color={t.success} />
          <div style={{ fontSize: 17, fontWeight: 600 }}>Solicitação enviada!</div>
          <div style={{ fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5 }}>
            O time de Compras foi notificado e sua solicitação já está no kanban.
          </div>
          <button onClick={() => {
            setEnviado(false);
            setMateriais([{ tipo: "", quantidade: "", justificativa: "" }]);
            setObs(""); setPrazo(""); setProjetoId(""); setProjBusca("");
          }} style={{
            background: t.accent, color: t.bg, border: "none", padding: "10px 18px",
            fontWeight: 600, fontSize: 13, cursor: "pointer", marginTop: 6,
          }}>
            Nova solicitação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Solicitar Compra</h1>
        <div style={{ fontSize: 12, color: t.textMuted }}>Pedido de material da Produção · cai direto no kanban do Compras</div>
      </header>

      <form onSubmit={submit} style={{
        padding: 32,
        background: t.bgElevated, border: `1px solid ${t.border}`,
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>Seu nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} style={inp} required />
          </div>
          <div>
            <label style={lbl}>Pedido por (quem usa o material) *</label>
            <input value={pedidoPor} onChange={(e) => setPedidoPor(e.target.value)} style={inp} required />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>Setor</label>
            <input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="PRODUÇÃO, FÁBRICA…" style={inp} />
          </div>
          <div>
            <label style={lbl}>Departamento de destino *</label>
            <select value={deptDestino} onChange={(e) => setDeptDestino(e.target.value)} style={inp} required>
              <option value="">Selecione…</option>
              {DEPT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={lbl}>Projeto vinculado *</label>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: t.textMuted, pointerEvents: "none" }} />
            <input
              value={projetoSel ? projLabel(projetoSel) : projBusca}
              onChange={(e) => { setProjetoId(""); setProjBusca(e.target.value); setProjOpen(true); }}
              onFocus={() => setProjOpen(true)}
              onBlur={() => setProjOpen(false)}
              placeholder="Buscar projeto pelo nome ou obra…"
              style={{ ...inp, paddingLeft: 32, paddingRight: projetoSel ? 32 : undefined }}
            />
            {projetoSel && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setProjetoId(""); setProjBusca(""); }}
                title="Remover vínculo"
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: t.textMuted, cursor: "pointer", display: "grid", placeItems: "center", padding: 4 }}>
                <X size={13} />
              </button>
            )}
            {projOpen && !projetoSel && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                maxHeight: 260, overflowY: "auto", background: t.bgElevated,
                border: `1px solid ${t.borderHover}`, borderTop: "none",
              }}>
                {projFiltrados.map((p) => (
                  <div key={p.id}
                    onMouseDown={(e) => { e.preventDefault(); setProjetoId(p.id); setProjBusca(""); setProjOpen(false); }}
                    style={{ padding: "9px 12px", fontSize: 12.5, cursor: "pointer", borderBottom: `1px solid ${t.border}`, color: t.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.inputBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    {projLabel(p)}
                  </div>
                ))}
                {projFiltrados.length === 0 && (
                  <div style={{ padding: "10px 12px", fontSize: 12, color: t.textMuted }}>Nenhum projeto encontrado.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label style={lbl}>Materiais *</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {materiais.map((m, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr auto", gap: 8, alignItems: "center" }}>
                <input value={m.tipo} onChange={(e) => setMat(i, "tipo", e.target.value)} placeholder="Material" style={inp} />
                <input value={m.quantidade} onChange={(e) => setMat(i, "quantidade", e.target.value)} placeholder="Qtd (10 PÇ)" style={inp} />
                <input value={m.justificativa} onChange={(e) => setMat(i, "justificativa", e.target.value)}
                       placeholder="Justificativa * (por quê / obra)" required={!!m.tipo.trim()} style={inp} />
                <button type="button" onClick={() => rmMat(i)} disabled={materiais.length === 1} title="Remover" style={{
                  background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted,
                  width: 34, height: 38, cursor: materiais.length === 1 ? "default" : "pointer",
                  opacity: materiais.length === 1 ? 0.3 : 1, display: "grid", placeItems: "center",
                }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addMat} style={{
            marginTop: 8, background: "transparent", border: `1px dashed ${t.borderHover}`,
            color: t.textSecondary, padding: "8px 14px", fontSize: 12, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <Plus size={12} /> Adicionar material
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
          <div>
            <label style={lbl}>Prazo estimado de entrega *</label>
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inp} required />
          </div>
          <div>
            <label style={lbl}>Observações</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} style={inp} />
          </div>
        </div>

        {erro && (
          <div style={{ color: t.danger, fontSize: 12, padding: "8px 12px", background: "rgba(178,80,80,0.08)", border: `1px solid ${t.danger}` }}>
            {erro}
          </div>
        )}

        <button disabled={enviando} type="submit" style={{
          background: t.accent, color: t.bg, border: "none", padding: "13px 18px",
          fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: enviando ? 0.6 : 1,
        }}>
          {enviando ? "Enviando…" : "Enviar solicitação"}
        </button>
      </form>
      </div>
    </div>
  );
}
