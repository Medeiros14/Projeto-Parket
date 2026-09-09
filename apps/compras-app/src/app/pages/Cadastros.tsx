/** Cadastros do ERP — Projetos / Produtos / Transportadoras (Fornecedores tem página própria).
 *  Projetos é read-only: espelha a tabela `obras` (banco de obras da Parket, gerido no gestão).
 *  Produtos/Transportadoras seguem CRUD genérico por config, herdado do ERP legado. */
import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { categoriaInsumo } from "../lib/erp";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import HistoricoProjeto from "../components/HistoricoProjeto";

type Entidade = "projetos" | "produtos" | "transportadoras";

type CampoCfg = {
  key: string; label: string; placeholder?: string; obrigatorio?: boolean; largo?: boolean;
  tipo?: "text" | "select"; opcoes?: { value: string; label: string }[]; padrao?: string;
};

const STATUS_OBRA: Record<string, string> = {
  aguardando: "Aguardando", mobilizacao: "Mobilização", em_execucao: "Em execução",
  finalizado: "Finalizado", travado: "Travado",
};

const UNIDADES = ["UN", "M²", "M", "M³", "LT", "KG", "CX", "PC", "PAR", "RL", "JG"];
const CAT_LABEL: Record<string, string> = { MATERIA_PRIMA: "Matéria prima", FERRAGEM: "Ferragem", EMBALAGEM: "Embalagem" };

const CFG: Record<Entidade, { titulo: string; tabela: string; prefixoCodigo: string; somenteLeitura?: boolean; campos: CampoCfg[]; colunas: CampoCfg[] }> = {
  projetos: {
    titulo: "Projetos",
    tabela: "obras",
    prefixoCodigo: "",
    somenteLeitura: true,
    campos: [],
    colunas: [
      { key: "cliente", label: "Projeto / Cliente" }, { key: "localizacao", label: "Localização" },
      { key: "regiao", label: "Região" }, { key: "status", label: "Status" }, { key: "progresso", label: "Progresso" },
      { key: "obras_qtd", label: "Obras" },
    ],
  },
  produtos: {
    titulo: "Produtos",
    tabela: "compras_produtos",
    prefixoCodigo: "PRD-",
    campos: [
      { key: "descricao", label: "Descrição *", obrigatorio: true, largo: true },
      { key: "unidade", label: "Unidade", tipo: "select", padrao: "UN",
        opcoes: UNIDADES.map((u) => ({ value: u, label: u })) },
      { key: "categoria", label: "Tipo", tipo: "select", padrao: "MATERIA_PRIMA",
        opcoes: [{ value: "MATERIA_PRIMA", label: "Matéria prima" }, { value: "FERRAGEM", label: "Ferragem" }, { value: "EMBALAGEM", label: "Embalagem" }] },
    ],
    colunas: [
      { key: "codigo", label: "Código" }, { key: "descricao", label: "Descrição" },
      { key: "unidade", label: "Unidade" }, { key: "categoria_label", label: "Tipo" },
    ],
  },
  transportadoras: {
    titulo: "Transportadoras",
    tabela: "compras_transportadoras",
    prefixoCodigo: "TRA-",
    campos: [
      { key: "nome", label: "Nome *", obrigatorio: true, largo: true },
      { key: "cnpj", label: "CNPJ" },
      { key: "telefone", label: "Telefone" },
      { key: "email", label: "E-mail" },
      { key: "obs", label: "Observações", largo: true },
    ],
    colunas: [
      { key: "codigo", label: "Código" }, { key: "nome", label: "Nome" }, { key: "cnpj", label: "CNPJ" },
      { key: "telefone", label: "Telefone" }, { key: "email", label: "E-mail" },
    ],
  },
};

type Row = Record<string, any>;

export default function Cadastros() {
  const { t } = useTheme();
  const [aba, setAba] = useState<Entidade>("projetos");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [histProjeto, setHistProjeto] = useState<Row | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Row>({});
  const [salvando, setSalvando] = useState(false);
  // Editor específico da aba Projetos: aba é dedup por cliente (1 linha = N obras),
  // então rename/edit precisa cascatear pra TODAS as obras com o cliente original.
  // Guarda o cliente original pra usar como WHERE no bulk update ao salvar.
  const [editProj, setEditProj] = useState<Row | null>(null);
  const [projOriginal, setProjOriginal] = useState<string>("");
  const [projObrasQtd, setProjObrasQtd] = useState<number>(0);
  const [salvandoProj, setSalvandoProj] = useState(false);

  const cfg = CFG[aba];

  async function load(a: Entidade = aba) {
    setLoading(true);
    if (a === "projetos") {
      const { data } = await sb.from("obras")
        .select("id,cliente,localizacao,regiao,status,progresso")
        .order("cliente").limit(2000);
      // Dedup por nome: 1 linha por projeto/cliente, mesmo que tenha várias obras no banco.
      const rankStatus: Record<string, number> = { em_execucao: 4, mobilizacao: 3, travado: 2, aguardando: 1, finalizado: 0 };
      const porNome = new Map<string, Row>();
      ((data as Row[]) || []).forEach((r) => {
        const nome = String(r.cliente || "").trim();
        if (!nome) return;
        const key = nome.toUpperCase();
        const ex = porNome.get(key);
        if (!ex) { porNome.set(key, { ...r, cliente: nome, obras_qtd: 1 }); return; }
        ex.obras_qtd += 1;
        if (!ex.localizacao && r.localizacao) ex.localizacao = r.localizacao;
        if (!ex.regiao && r.regiao) ex.regiao = r.regiao;
        if ((rankStatus[r.status] ?? -1) > (rankStatus[ex.status] ?? -1)) { ex.status = r.status; ex.progresso = r.progresso; }
      });
      setRows(Array.from(porNome.values()).map((r) => ({
        ...r,
        status: STATUS_OBRA[r.status] || r.status || "—",
        progresso: r.progresso != null ? `${r.progresso}%` : "—",
        obras_qtd: r.obras_qtd > 1 ? `${r.obras_qtd} obras` : "1 obra",
      })));
    } else {
      const { data } = await sb.from(CFG[a].tabela).select("*").eq("ativo", true).order("codigo");
      const linhas = (data as Row[]) || [];
      if (a === "produtos") {
        linhas.forEach((r) => { r.categoria_label = CAT_LABEL[String(r.categoria || "MATERIA_PRIMA")] || r.categoria || "—"; });
      }
      setRows(linhas);
    }
    setLoading(false);
  }
  useEffect(() => { load(aba); }, [aba]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => cfg.colunas.some((c) => String(r[c.key] || "").toLowerCase().includes(q)));
  }, [rows, busca, cfg]);

  function abrirNovo() { setEditId(null); setForm({}); setModalOpen(true); }
  function abrirEdicao(r: Row) { setEditId(r.id); setForm({ ...r }); setModalOpen(true); }

  /** Abre editor de projeto (aba Projetos). Guarda o cliente original pra usar
   *  como WHERE do bulk update — o rename bate em TODAS as obras daquele cliente. */
  function abrirEdicaoProjeto(r: Row) {
    const nomeOriginal = String(r.cliente || "").trim();
    // Status vem formatado ("Em execução"), progresso vem "N%". Guarda o valor bruto
    // do banco pro form editar: acha a key do STATUS_OBRA pelo label, extrai número do progresso.
    const statusKey = Object.keys(STATUS_OBRA).find((k) => STATUS_OBRA[k] === r.status) || "aguardando";
    const progNum = typeof r.progresso === "string"
      ? parseInt(r.progresso.replace(/[^\d]/g, ""), 10) || 0
      : Number(r.progresso) || 0;
    // Extrai qtd de obras do label ("3 obras" -> 3; "1 obra" -> 1) pra avisar no modal.
    const qtd = typeof r.obras_qtd === "string"
      ? parseInt(r.obras_qtd.replace(/[^\d]/g, ""), 10) || 1
      : Number(r.obras_qtd) || 1;
    setProjOriginal(nomeOriginal);
    setProjObrasQtd(qtd);
    setEditProj({
      cliente: nomeOriginal,
      localizacao: r.localizacao || "",
      regiao: r.regiao || "",
      status: statusKey,
      progresso: progNum,
    });
  }

  /** Salva edição de projeto: bulk UPDATE em TODAS as obras com cliente = original.
   *  Rename propaga em cascata pra que a dedup da lista continue funcionando. */
  async function salvarProjeto(e: React.FormEvent) {
    e.preventDefault();
    if (!editProj || !projOriginal) return;
    const novoNome = String(editProj.cliente || "").trim();
    if (!novoNome) { alert("Nome do projeto não pode ficar vazio."); return; }
    setSalvandoProj(true);
    // WHERE por nome exato (case-sensitive) pra bater no mesmo grupo do dedup da lista.
    // Se o usuário mudou o nome, avisa que vai renomear N obras — evita rename silencioso em massa.
    if (novoNome !== projOriginal && projObrasQtd > 1) {
      if (!confirm(`Isso vai renomear ${projObrasQtd} obras de "${projOriginal}" pra "${novoNome}". Continuar?`)) {
        setSalvandoProj(false);
        return;
      }
    }
    const payload: Row = {
      cliente: novoNome,
      localizacao: String(editProj.localizacao || "").trim() || null,
      regiao: String(editProj.regiao || "").trim() || null,
      status: editProj.status,
      progresso: Math.max(0, Math.min(100, Number(editProj.progresso) || 0)),
    };
    const { error } = await sb.from("obras").update(payload).eq("cliente", projOriginal);
    setSalvandoProj(false);
    if (error) { alert("Falha ao salvar: " + error.message); return; }
    setEditProj(null);
    setProjOriginal("");
    load();
  }

  async function proximoCodigo(): Promise<string> {
    const { data } = await sb.from(cfg.tabela).select("codigo")
      .like("codigo", `${cfg.prefixoCodigo}%`).order("codigo", { ascending: false }).limit(1);
    const ultimo = (data as any[])?.[0]?.codigo ? parseInt(String((data as any[])[0].codigo).replace(cfg.prefixoCodigo, ""), 10) || 0 : 0;
    return `${cfg.prefixoCodigo}${String(ultimo + 1).padStart(4, "0")}`;
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const payload: Row = {};
    cfg.campos.forEach((c) => { payload[c.key] = String(form[c.key] || "").trim() || c.padrao || null; });
    if (aba === "produtos" && payload.descricao) payload.descricao = payload.descricao.toUpperCase();
    if (aba === "produtos" && !payload.categoria) payload.categoria = categoriaInsumo(payload.descricao || "");

    let error;
    if (editId) {
      ({ error } = await sb.from(cfg.tabela).update(payload).eq("id", editId));
    } else {
      payload.codigo = await proximoCodigo();
      payload.ativo = true;
      ({ error } = await sb.from(cfg.tabela).insert(payload));
    }
    setSalvando(false);
    if (error) { alert("Falha ao salvar: " + error.message); return; }
    setModalOpen(false);
    load();
  }

  async function excluir() {
    if (!editId) return;
    if (!confirm("Excluir este registro? (fica inativo, não some do histórico)")) return;
    const { error } = await sb.from(cfg.tabela).update({ ativo: false }).eq("id", editId);
    if (error) { alert("Falha ao excluir: " + error.message); return; }
    setModalOpen(false);
    load();
  }

  const thSt: React.CSSProperties = {
    textAlign: "left", padding: "8px 12px", color: t.textMuted,
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: `1px solid ${t.border}`,
  };
  const tdSt: React.CSSProperties = { padding: "10px 12px", borderBottom: `1px solid ${t.border}`, fontSize: 12.5 };
  const inpSt: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%", boxSizing: "border-box",
  };
  const lblSt: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: t.textMuted, marginBottom: 4, display: "block",
  };

  return (
    <div style={{ padding: "24px 28px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Cadastros</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {filtradas.length} registros em {cfg.titulo.toLowerCase()}
            {cfg.somenteLeitura ? " · banco de obras da Parket (edição no gestão)" : ""}
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <Search size={12} style={{ position: "absolute", left: 9, top: 11, color: t.textMuted }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…"
                 style={{ ...inpSt, width: 220, paddingLeft: 28 }} />
        </div>
        {!cfg.somenteLeitura && (
          <button onClick={abrirNovo} style={{
            background: t.accent, color: t.bg, border: "none",
            padding: "9px 16px", borderRadius: 0, fontWeight: 600, fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Plus size={14} /> Novo
          </button>
        )}
      </header>

      <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
        {(Object.keys(CFG) as Entidade[]).map((k) => (
          <button key={k} onClick={() => { setAba(k); setBusca(""); }} style={{
            background: aba === k ? t.accent : t.inputBg,
            color: aba === k ? t.bg : t.textSecondary,
            border: `1px solid ${aba === k ? t.accent : t.border}`,
            padding: "7px 14px", borderRadius: 0, fontSize: 11, fontWeight: 600, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            {CFG[k].titulo}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {cfg.colunas.map((c) => <th key={c.key} style={thSt}>{c.label}</th>)}
              {aba === "projetos" && <th style={{ ...thSt, width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r) => (
              <tr key={r.id} onClick={aba === "projetos" ? () => setHistProjeto(r) : cfg.somenteLeitura ? undefined : () => abrirEdicao(r)}
                  style={{ cursor: aba === "projetos" || !cfg.somenteLeitura ? "pointer" : "default" }}
                  title={aba === "projetos" ? "Ver histórico de compras do projeto" : cfg.somenteLeitura ? undefined : "Clique para editar"}>
                {cfg.colunas.map((c, i) => (
                  <td key={c.key} style={{ ...tdSt, color: i === 0 ? t.accent : i === 1 ? t.textPrimary : t.textSecondary, fontWeight: i <= 1 ? 600 : 400 }}>
                    {r[c.key] || "—"}
                  </td>
                ))}
                {aba === "projetos" && (
                  <td style={{ ...tdSt, textAlign: "right", width: 40 }}
                      // stopPropagation: senão o click do lápis dispara o click da linha e abre o histórico junto.
                      onClick={(e) => { e.stopPropagation(); abrirEdicaoProjeto(r); }}>
                    <Pencil size={13} style={{ color: t.textMuted, cursor: "pointer" }} aria-label="Editar projeto" />
                  </td>
                )}
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={cfg.colunas.length + (aba === "projetos" ? 1 : 0)} style={{ ...tdSt, textAlign: "center", color: t.textMuted }}>
                Nenhum registro{busca ? " encontrado" : " cadastrado"}.
              </td></tr>
            )}
          </tbody>
        </table>
      )}

      {histProjeto && (
        <HistoricoProjeto
          nome={String(histProjeto.cliente || "").trim()}
          subtitulo={[histProjeto.localizacao, histProjeto.regiao, histProjeto.status].filter(Boolean).join(" · ")}
          t={t} onClose={() => setHistProjeto(null)} />
      )}

      {editProj && (
        // Modal específico da aba Projetos: edita cliente/localização/região/status/progresso.
        // Salva via bulk UPDATE em obras WHERE cliente = projOriginal (cascata em N obras).
        <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 100, display: "grid", placeItems: "center", overflowY: "auto", padding: "30px 0" }}>
          <form onSubmit={salvarProjeto} style={{
            width: 520, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto",
            background: t.modalBg, border: `1px solid ${t.borderStrong}`,
            padding: 24, display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                Editar projeto
                {projObrasQtd > 1 && (
                  <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                    · {projObrasQtd} obras vinculadas
                  </span>
                )}
              </div>
              <button type="button" onClick={() => { setEditProj(null); setProjOriginal(""); }}
                      style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lblSt}>Projeto / Cliente *</label>
                <input value={editProj.cliente || ""} required autoFocus
                       onChange={(e) => setEditProj((f) => ({ ...(f || {}), cliente: e.target.value }))}
                       style={inpSt} />
              </div>
              <div>
                <label style={lblSt}>Localização</label>
                <input value={editProj.localizacao || ""}
                       onChange={(e) => setEditProj((f) => ({ ...(f || {}), localizacao: e.target.value }))}
                       placeholder="Cidade / bairro" style={inpSt} />
              </div>
              <div>
                <label style={lblSt}>Região</label>
                <input value={editProj.regiao || ""}
                       onChange={(e) => setEditProj((f) => ({ ...(f || {}), regiao: e.target.value }))}
                       placeholder="Ex.: SP capital" style={inpSt} />
              </div>
              <div>
                <label style={lblSt}>Status</label>
                <select value={editProj.status || "aguardando"}
                        onChange={(e) => setEditProj((f) => ({ ...(f || {}), status: e.target.value }))}
                        style={{ ...inpSt, appearance: "auto" as any }}>
                  {Object.entries(STATUS_OBRA).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lblSt}>Progresso (%)</label>
                <input type="number" min={0} max={100} value={editProj.progresso ?? 0}
                       onChange={(e) => setEditProj((f) => ({ ...(f || {}), progresso: e.target.value }))}
                       style={inpSt} />
              </div>
            </div>

            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
              Fonte: tabela <code>obras</code> (banco de obras da Parket).
              Alterações aqui aplicam em {projObrasQtd > 1 ? `todas as ${projObrasQtd} obras` : "essa obra"} deste cliente.
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={salvandoProj} type="submit" style={{
                flex: 1, background: t.accent, color: t.bg, border: "none", padding: "10px 16px",
                fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: salvandoProj ? 0.6 : 1,
              }}>
                {salvandoProj ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 100, display: "grid", placeItems: "center", overflowY: "auto", padding: "30px 0" }}>
          <form onSubmit={salvar} style={{
            width: 520, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto",
            background: t.modalBg, border: `1px solid ${t.borderStrong}`,
            padding: 24, display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {editId ? `Editar — ${form.codigo || ""}` : `Novo em ${cfg.titulo}`}
                {!editId && <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 11, marginLeft: 8 }}>código automático</span>}
              </div>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {cfg.campos.map((c) => (
                <div key={c.key} style={c.largo ? { gridColumn: "1 / -1" } : undefined}>
                  <label style={lblSt}>{c.label}</label>
                  {c.tipo === "select" ? (
                    <select value={form[c.key] || c.padrao || ""} required={c.obrigatorio}
                            onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))}
                            style={{ ...inpSt, appearance: "auto" as any }}>
                      {(c.opcoes || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input value={form[c.key] || ""} required={c.obrigatorio} autoFocus={c.obrigatorio}
                           onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))}
                           placeholder={c.placeholder || ""} style={inpSt} />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={salvando} type="submit" style={{
                flex: 1, background: t.accent, color: t.bg, border: "none", padding: "10px 16px",
                fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: salvando ? 0.6 : 1,
              }}>
                {salvando ? "Salvando…" : "Salvar"}
              </button>
              {editId && (
                <button type="button" onClick={excluir} title="Excluir (inativa)" style={{
                  background: "transparent", color: t.danger, border: `1px solid ${t.danger}`,
                  padding: "10px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Trash2 size={13} /> Excluir
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
