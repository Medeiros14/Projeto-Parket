/** Scorecard de fornecedores — mesma tabela compras_fornecedores do Space. */
import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { Plus, Star, X, Trash2, Search } from "lucide-react";

type Fornecedor = {
  id: string;
  nome: string;
  categoria: string | null;
  avaliacao: number | null;
  entregas: number | null;
  atrasos: number | null;
  valor_k: number | null;
  ativo: boolean;
  created_at: string;
  tipo: string | null;
  cnpj: string | null;
  razao_social: string | null;
  telefone: string | null;
  email: string | null;
  pix: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  forma_pagamento: string | null;
  prazo_pagamento: string | null;
  obs: string | null;
};

export const TIPOS_FORNECEDOR: { id: string; label: string }[] = [
  { id: "fabricacao", label: "Fabricação (Ronaldo)" },
  { id: "instalacao", label: "Instalação (Taiara)" },
  { id: "geral", label: "Geral (todos)" },
];
const tipoLabel = (tipo: string | null) =>
  TIPOS_FORNECEDOR.find((x) => x.id === (tipo || "geral"))?.label.replace(/ \(.+\)$/, "") || "Geral";

type FormState = {
  nome: string; categoria: string; tipo: string; cnpj: string; razao_social: string;
  telefone: string; email: string; pix: string; banco: string;
  agencia: string; conta: string; forma_pagamento: string; prazo_pagamento: string; obs: string;
};

const FORM_VAZIO: FormState = {
  nome: "", categoria: "", tipo: "geral", cnpj: "", razao_social: "", telefone: "", email: "",
  pix: "", banco: "", agencia: "", conta: "", forma_pagamento: "", prazo_pagamento: "", obs: "",
};

export default function Fornecedores() {
  const { t } = useTheme();
  const [rows, setRows] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [busca, setBusca] = useState("");

  const rowsFiltradas = useMemo(() => {
    let out = filtroTipo ? rows.filter((r) => (r.tipo || "geral") === filtroTipo) : rows;
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const q = norm(busca.trim());
    if (q) {
      out = out.filter((r) =>
        [r.nome, r.razao_social, r.cnpj, r.categoria, r.email, r.telefone]
          .some((v) => v && norm(v).includes(q))
      );
    }
    return out;
  }, [rows, filtroTipo, busca]);

  async function load() {
    const { data } = await sb.from("compras_fornecedores")
      .select("*").eq("ativo", true).order("avaliacao", { ascending: false });
    setRows((data as unknown as Fornecedor[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function abrirNovo() {
    setEditId(null);
    setForm(FORM_VAZIO);
    setModalOpen(true);
  }

  function abrirEdicao(r: Fornecedor) {
    setEditId(r.id);
    setForm({
      nome: r.nome || "", categoria: r.categoria || "", tipo: r.tipo || "geral", cnpj: r.cnpj || "",
      razao_social: r.razao_social || "", telefone: r.telefone || "", email: r.email || "",
      pix: r.pix || "", banco: r.banco || "", agencia: r.agencia || "", conta: r.conta || "",
      forma_pagamento: r.forma_pagamento || "", prazo_pagamento: r.prazo_pagamento || "", obs: r.obs || "",
    });
    setModalOpen(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvando(true);
    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim() || null,
      tipo: form.tipo || "geral",
      cnpj: form.cnpj.trim() || null,
      razao_social: form.razao_social.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      pix: form.pix.trim() || null,
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta: form.conta.trim() || null,
      forma_pagamento: form.forma_pagamento.trim() || null,
      prazo_pagamento: form.prazo_pagamento.trim() || null,
      obs: form.obs.trim() || null,
    };
    const { error } = editId
      ? await sb.from("compras_fornecedores").update(payload).eq("id", editId)
      : await sb.from("compras_fornecedores").insert({
          ...payload, avaliacao: 0, entregas: 0, atrasos: 0, valor_k: 0, ativo: true,
        });
    setSalvando(false);
    if (error) { alert("Falha ao salvar: " + error.message); return; }
    setModalOpen(false);
    setForm(FORM_VAZIO);
    setEditId(null);
    load();
  }

  const totais = useMemo(() => ({
    entregas: rows.reduce((s, r) => s + (r.entregas || 0), 0),
    atrasos: rows.reduce((s, r) => s + (r.atrasos || 0), 0),
    valor: rows.reduce((s, r) => s + (r.valor_k || 0), 0),
  }), [rows]);

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>;

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

  const campo = (label: string, key: keyof FormState, placeholder = "", props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label style={lblSt}>{label}</label>
      <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
             placeholder={placeholder} style={inpSt} {...props} />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Fornecedores</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {rows.length} ativos · {totais.entregas} entregas · {totais.atrasos} atrasos · R$ {totais.valor}k movimentados
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: t.textMuted, pointerEvents: "none" }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Buscar fornecedor, CNPJ, categoria..."
                 style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
                          padding: "7px 10px 7px 28px", fontSize: 12, borderRadius: 0, outline: "none", width: 240 }} />
          {busca && (
            <button type="button" onClick={() => setBusca("")} title="Limpar busca"
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                             background: "transparent", border: "none", cursor: "pointer", color: t.textMuted,
                             padding: 2, display: "inline-grid", placeItems: "center" }}>
              <X size={12} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ id: "", label: "Todos" }, ...TIPOS_FORNECEDOR].map((x) => (
            <button key={x.id} onClick={() => setFiltroTipo(x.id)} style={{
              background: filtroTipo === x.id ? t.accent : t.inputBg,
              color: filtroTipo === x.id ? t.bg : t.textSecondary,
              border: `1px solid ${filtroTipo === x.id ? t.accent : t.border}`,
              padding: "6px 10px", borderRadius: 0, fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
              {x.label.replace(/ \(.+\)$/, "")}
            </button>
          ))}
        </div>
        <button onClick={abrirNovo} style={{
          background: t.accent, color: t.bg, border: "none",
          padding: "9px 16px", borderRadius: 0, fontWeight: 600, fontSize: 13,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          <Plus size={14} /> Novo fornecedor
        </button>
      </header>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thSt}>Fornecedor</th>
            <th style={thSt}>Tipo</th>
            <th style={thSt}>CNPJ</th>
            <th style={thSt}>Categoria</th>
            <th style={thSt}>Pagamento</th>
            <th style={thSt}>Avaliação</th>
            <th style={thSt}>Entregas</th>
            <th style={thSt}>Atrasos</th>
            <th style={thSt}>OTD</th>
            <th style={thSt}>Volume</th>
            <th style={{ ...thSt, width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {rowsFiltradas.map((r) => {
            const otd = r.entregas ? Math.round(((r.entregas - (r.atrasos || 0)) / r.entregas) * 100) : null;
            const tp = r.tipo || "geral";
            return (
              <tr key={r.id} onClick={() => abrirEdicao(r)} style={{ cursor: "pointer" }}
                  title="Clique para ver/editar dados completos">
                <td style={{ ...tdSt, color: t.textPrimary, fontWeight: 600 }}>{r.nome}</td>
                <td style={{ ...tdSt, color: tp === "fabricacao" ? "#8B5CF6" : tp === "instalacao" ? "#14B8A6" : t.textSecondary, fontWeight: 600 }}>{tipoLabel(r.tipo)}</td>
                <td style={{ ...tdSt, color: t.textSecondary }}>{r.cnpj || "—"}</td>
                <td style={{ ...tdSt, color: t.textSecondary }}>{r.categoria || "—"}</td>
                <td style={{ ...tdSt, color: t.textSecondary }}>
                  {r.forma_pagamento || (r.pix ? "PIX" : r.banco ? "Transferência" : "—")}
                </td>
                <td style={tdSt}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: t.warning }}>
                    <Star size={11} fill="currentColor" />
                    <span style={{ color: t.textPrimary }}>{r.avaliacao?.toFixed(1) ?? "—"}</span>
                  </span>
                </td>
                <td style={{ ...tdSt, color: t.textSecondary }}>{r.entregas ?? 0}</td>
                <td style={{ ...tdSt, color: (r.atrasos || 0) > 0 ? t.danger : t.textSecondary }}>{r.atrasos ?? 0}</td>
                <td style={{ ...tdSt, color: otd == null ? t.textMuted : otd >= 90 ? t.success : otd >= 70 ? t.warning : t.danger }}>
                  {otd == null ? "—" : `${otd}%`}
                </td>
                <td style={{ ...tdSt, color: t.textSecondary }}>{r.valor_k ? `R$ ${r.valor_k}k` : "—"}</td>
                <td style={{ ...tdSt, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                  <button title="Remover fornecedor da lista"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm(`Remover "${r.nome}" da lista?\n\n(Fica arquivado — dá pra restaurar se precisar. Cards antigos que já usam continuam funcionando.)`)) return;
                            const { error } = await sb.from("compras_fornecedores").update({ ativo: false }).eq("id", r.id);
                            if (error) { alert("Falha: " + error.message); return; }
                            await load();
                          }}
                          style={{ background: "transparent", border: "none", cursor: "pointer",
                                   color: t.textMuted, padding: 4, display: "inline-grid", placeItems: "center" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = t.danger)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = t.textMuted)}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
          {rowsFiltradas.length === 0 && (
            <tr><td colSpan={11} style={{ ...tdSt, textAlign: "center", color: t.textMuted }}>
              {busca.trim() ? `Nenhum fornecedor encontrado para "${busca.trim()}".` : "Nenhum fornecedor cadastrado."}
            </td></tr>
          )}
        </tbody>
      </table>

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 100, display: "grid", placeItems: "center", overflowY: "auto", padding: "30px 0" }}>
          <form onSubmit={salvar} style={{
            width: 560, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto",
            background: t.modalBg, border: `1px solid ${t.borderStrong}`,
            padding: 24, display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{editId ? "Editar fornecedor" : "Novo fornecedor"}</div>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {campo("Nome *", "nome", "Nome fantasia", { required: true, autoFocus: true })}
              <div>
                <label style={lblSt}>Tipo *</label>
                <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                        style={{ ...inpSt, appearance: "auto" as React.CSSProperties["appearance"] }}>
                  {TIPOS_FORNECEDOR.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </div>
              {campo("Categoria", "categoria", "Piso, Insumos, Ferragens…")}
              {campo("Razão social", "razao_social")}
              {campo("CNPJ", "cnpj", "00.000.000/0000-00")}
              {campo("Telefone", "telefone", "(11) 99999-9999")}
              {campo("E-mail", "email", "financeiro@fornecedor.com", { type: "email" })}
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent, borderBottom: `1px solid ${t.border}`, paddingBottom: 6 }}>
              Dados de pagamento
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lblSt}>Forma de pagamento</label>
                <select value={form.forma_pagamento} onChange={(e) => setForm((f) => ({ ...f, forma_pagamento: e.target.value }))}
                        style={{ ...inpSt, appearance: "auto" as React.CSSProperties["appearance"] }}>
                  <option value="">—</option>
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Transferência">Transferência (TED)</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </div>
              {campo("Prazo de pagamento", "prazo_pagamento", "À vista, 28 dias, 30/60…")}
              {campo("Chave PIX", "pix", "CNPJ, e-mail, telefone…")}
              {campo("Banco", "banco", "Itaú, Bradesco…")}
              {campo("Agência", "agencia", "0000")}
              {campo("Conta", "conta", "00000-0")}
            </div>

            <div>
              <label style={lblSt}>Observações</label>
              <textarea value={form.obs} onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
                        placeholder="Condições, contatos, detalhes de faturamento…" rows={3}
                        style={{ ...inpSt, resize: "vertical", fontFamily: "inherit" }} />
            </div>

            <button disabled={salvando} type="submit" style={{
              background: t.accent, color: t.bg, border: "none", padding: "10px 16px",
              fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: salvando ? 0.6 : 1,
            }}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
