/**
 * Gestão da Tabela de Preços — Orçamentos
 * CRUD completo: produtos, dimensões, variações, preços
 */
import React from "react";
import { supabase } from "../lib/supabase";
import {
  CARD_BG, BORDER, TEXT_DIM, TEXT_MED, YELLOW, GREEN, BLUE, ORANGE, ACCENT,
} from "../components/dept-layout";
import {
  Plus, Pencil, Trash2, Check, X, Search, ChevronDown, ToggleLeft, ToggleRight, Save, RefreshCw,
} from "lucide-react";

// ─── TIPOS ───────────────────────────────────────────────────────────────────

export interface TabelaPreco {
  id: string;
  categoria: string;
  origem: string | null;
  subtipo: string | null;
  especie_id: string;
  especie_nome: string;
  tem_cores: boolean;
  cores: string[];
  dimensao_id: string | null;
  dimensao_label: string | null;
  dimensao_obs: string;
  preco: number;
  ativo: boolean;
  ordem: number;
}

// ─── HOOK ────────────────────────────────────────────────────────────────────

export function useTabelaPrecos() {
  const [rows, setRows] = React.useState<TabelaPreco[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetch = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orcamento_tabela_precos")
      .select("*")
      .order("categoria")
      .order("origem", { nullsFirst: true })
      .order("subtipo", { nullsFirst: true })
      .order("especie_nome")
      .order("ordem");
    setRows((data ?? []) as TabelaPreco[]);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetch(); }, [fetch]);

  return { rows, loading, refetch: fetch };
}

// ─── LABELS ──────────────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = { piso: "Piso", forro: "Forro", painel: "Painel", deck: "Deck" };
const ORI_LABEL: Record<string, string> = { nacional: "Nacional", importado: "Importado" };
const SUB_LABEL: Record<string, string> = { regua: "Régua", ripado: "Ripado", toblerone: "Toblerone" };

function tag(label: string, color: string) {
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 600,
    }}>{label}</span>
  );
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── FORM DE EDIÇÃO / CRIAÇÃO ────────────────────────────────────────────────

const EMPTY: Omit<TabelaPreco, "id"> = {
  categoria: "piso", origem: "nacional", subtipo: "regua",
  especie_id: "", especie_nome: "", tem_cores: false, cores: [],
  dimensao_id: "", dimensao_label: "", dimensao_obs: "", preco: 0, ativo: true, ordem: 0,
};

function RowForm({
  initial, onSave, onCancel,
}: { initial: Omit<TabelaPreco, "id"> & { id?: string }; onSave: (d: any) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = React.useState({ ...initial });
  const [saving, setSaving] = React.useState(false);
  const [coresStr, setCoresStr] = React.useState((initial.cores ?? []).join(", "));

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  async function handleSave() {
    if (!form.especie_id || !form.especie_nome || form.preco <= 0) return;
    setSaving(true);
    const cores = coresStr.split(",").map(s => s.trim()).filter(Boolean);
    await onSave({ ...form, cores, preco: Number(form.preco) });
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    background: "#0d1117", border: `1px solid ${BORDER}`, borderRadius: 6,
    padding: "6px 10px", color: "#fff", fontSize: 12, width: "100%", boxSizing: "border-box",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle };
  const labelStyle: React.CSSProperties = { color: TEXT_DIM, fontSize: 11, marginBottom: 3, display: "block" };

  return (
    <div style={{ background: "#0d1117", border: `1px solid ${YELLOW}44`, borderRadius: 10, padding: 16, marginBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>

        <div>
          <label style={labelStyle}>Categoria *</label>
          <select value={form.categoria} onChange={f("categoria")} style={selectStyle}>
            <option value="piso">Piso</option>
            <option value="forro">Forro</option>
            <option value="painel">Painel</option>
            <option value="deck">Deck</option>
          </select>
        </div>

        {form.categoria !== "deck" && (
          <div>
            <label style={labelStyle}>Origem *</label>
            <select value={form.origem ?? ""} onChange={f("origem")} style={selectStyle}>
              <option value="nacional">Nacional</option>
              <option value="importado">Importado</option>
            </select>
          </div>
        )}

        {form.categoria === "forro" && (
          <div>
            <label style={labelStyle}>Subtipo *</label>
            <select value={form.subtipo ?? ""} onChange={f("subtipo")} style={selectStyle}>
              <option value="regua">Régua</option>
              <option value="ripado">Ripado</option>
              <option value="toblerone">Toblerone</option>
            </select>
          </div>
        )}

        <div>
          <label style={labelStyle}>ID da Espécie *</label>
          <input value={form.especie_id} onChange={f("especie_id")} style={inputStyle} placeholder="ex: tauari" />
        </div>

        <div>
          <label style={labelStyle}>Nome da Espécie *</label>
          <input value={form.especie_nome} onChange={f("especie_nome")} style={inputStyle} placeholder="ex: Tauari" />
        </div>

        <div>
          <label style={labelStyle}>ID da Dimensão</label>
          <input value={form.dimensao_id ?? ""} onChange={f("dimensao_id")} style={inputStyle} placeholder="ex: 15/3x100" />
        </div>

        <div>
          <label style={labelStyle}>Label da Dimensão</label>
          <input value={form.dimensao_label ?? ""} onChange={f("dimensao_label")} style={inputStyle} placeholder="ex: Régua 15/3 × 100mm" />
        </div>

        <div>
          <label style={labelStyle}>Obs. da Dimensão</label>
          <input value={form.dimensao_obs} onChange={f("dimensao_obs")} style={inputStyle} placeholder="ex: +20% perda" />
        </div>

        <div>
          <label style={labelStyle}>Preço R$/m² *</label>
          <input type="number" value={form.preco} onChange={f("preco")} style={inputStyle} min={0} step={10} />
        </div>

        <div>
          <label style={labelStyle}>Ordem</label>
          <input type="number" value={form.ordem} onChange={f("ordem")} style={inputStyle} min={0} />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label style={labelStyle}>Cores/Acabamentos (vírgula separado) — deixe vazio se não há variação</label>
        <textarea
          value={coresStr}
          onChange={e => setCoresStr(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Naturalle, Mont Blanc, Marrone, ..."
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
          borderRadius: 6, border: `1px solid ${BORDER}`, background: "transparent",
          color: TEXT_DIM, cursor: "pointer", fontSize: 12,
        }}>
          <X size={13} /> Cancelar
        </button>
        <button onClick={handleSave} disabled={saving} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
          borderRadius: 6, border: "none", background: GREEN,
          color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600,
        }}>
          {saving ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
          Salvar
        </button>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export function TabelaPrecoAdminTab() {
  const { rows, loading, refetch } = useTabelaPrecos();
  const [busca, setBusca] = React.useState("");
  const [catFiltro, setCatFiltro] = React.useState("todos");
  const [editId, setEditId] = React.useState<string | null>(null);
  const [criando, setCriando] = React.useState(false);
  const [deletando, setDeletando] = React.useState<string | null>(null);

  const filtered = rows.filter(r => {
    if (catFiltro !== "todos" && r.categoria !== catFiltro) return false;
    const q = busca.toLowerCase();
    if (!q) return true;
    return (
      r.especie_nome.toLowerCase().includes(q) ||
      r.dimensao_label?.toLowerCase().includes(q) ||
      r.categoria.includes(q)
    );
  });

  async function handleCreate(data: Omit<TabelaPreco, "id">) {
    const { error } = await supabase.from("orcamento_tabela_precos").insert(data);
    if (!error) { setCriando(false); refetch(); }
    else alert("Erro ao criar: " + error.message);
  }

  async function handleUpdate(id: string, data: Partial<TabelaPreco>) {
    const { error } = await supabase.from("orcamento_tabela_precos").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) { setEditId(null); refetch(); }
    else alert("Erro ao salvar: " + error.message);
  }

  async function handleToggle(row: TabelaPreco) {
    await supabase.from("orcamento_tabela_precos").update({ ativo: !row.ativo }).eq("id", row.id);
    refetch();
  }

  async function handleDelete(id: string) {
    await supabase.from("orcamento_tabela_precos").delete().eq("id", id);
    setDeletando(null);
    refetch();
  }

  async function handlePriceEdit(id: string, preco: number) {
    await supabase.from("orcamento_tabela_precos").update({ preco, updated_at: new Date().toISOString() }).eq("id", id);
    refetch();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* Busca */}
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search size={14} color={TEXT_DIM} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            placeholder="Buscar espécie, dimensão..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: "100%", background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
              padding: "8px 12px 8px 32px", color: "#fff", fontSize: 13, boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filtro categoria */}
        <div style={{ display: "flex", gap: 6 }}>
          {["todos", "piso", "forro", "painel", "deck"].map(cat => (
            <button key={cat} onClick={() => setCatFiltro(cat)} style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
              border: `1px solid ${catFiltro === cat ? YELLOW : BORDER}`,
              background: catFiltro === cat ? `${YELLOW}22` : "transparent",
              color: catFiltro === cat ? YELLOW : TEXT_DIM, fontWeight: catFiltro === cat ? 600 : 400,
            }}>
              {cat === "todos" ? "Todos" : CAT_LABEL[cat]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={() => { setCriando(true); setEditId(null); }} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
          borderRadius: 8, border: "none", background: GREEN, color: "#fff",
          cursor: "pointer", fontSize: 13, fontWeight: 600,
        }}>
          <Plus size={15} /> Novo Produto
        </button>
      </div>

      {/* Formulário de criação */}
      {criando && (
        <RowForm
          initial={EMPTY}
          onSave={handleCreate}
          onCancel={() => setCriando(false)}
        />
      )}

      {/* Resumo */}
      <div style={{ color: TEXT_DIM, fontSize: 12 }}>
        {loading ? "Carregando..." : `${filtered.length} registros${busca || catFiltro !== "todos" ? " (filtrado)" : ""} · ${rows.filter(r => r.ativo).length} ativos`}
      </div>

      {/* Tabela */}
      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["Categoria","Origem/Subtipo","Espécie","Dimensão","Obs","Preço R$/m²","Cores","Ativo","Ações"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", color: TEXT_DIM, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                editId === row.id ? (
                  <tr key={row.id}>
                    <td colSpan={9} style={{ padding: "8px 14px" }}>
                      <RowForm
                        initial={row}
                        onSave={data => handleUpdate(row.id, data)}
                        onCancel={() => setEditId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} style={{
                    borderBottom: `1px solid ${BORDER}`,
                    opacity: row.ativo ? 1 : 0.45,
                    background: deletando === row.id ? "#2a1010" : "transparent",
                  }}>
                    <td style={{ padding: "9px 14px" }}>
                      {tag(CAT_LABEL[row.categoria] ?? row.categoria, YELLOW)}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {row.origem && tag(ORI_LABEL[row.origem] ?? row.origem, BLUE)}
                        {row.subtipo && tag(SUB_LABEL[row.subtipo] ?? row.subtipo, ORANGE)}
                      </div>
                    </td>
                    <td style={{ padding: "9px 14px", color: "#fff", fontWeight: 500 }}>{row.especie_nome}</td>
                    <td style={{ padding: "9px 14px", color: TEXT_MED }}>{row.dimensao_label ?? "—"}</td>
                    <td style={{ padding: "9px 14px", color: TEXT_DIM, fontSize: 11 }}>{row.dimensao_obs || "—"}</td>

                    {/* Preço editável inline */}
                    <td style={{ padding: "9px 14px" }}>
                      <InlinePreco value={row.preco} onSave={v => handlePriceEdit(row.id, v)} />
                    </td>

                    <td style={{ padding: "9px 14px", color: TEXT_DIM }}>
                      {row.cores?.length > 0 ? `${row.cores.length} cores` : "—"}
                    </td>

                    <td style={{ padding: "9px 14px" }}>
                      <button onClick={() => handleToggle(row)} style={{
                        background: "none", border: "none", cursor: "pointer", padding: 0,
                        color: row.ativo ? GREEN : TEXT_DIM,
                      }}>
                        {row.ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </td>

                    <td style={{ padding: "9px 14px" }}>
                      {deletando === row.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleDelete(row.id)} style={{
                            background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 3,
                          }}><Check size={14} /></button>
                          <button onClick={() => setDeletando(null)} style={{
                            background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 3,
                          }}><X size={14} /></button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => { setEditId(row.id); setCriando(false); }} style={{
                            background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 3,
                          }} title="Editar"><Pencil size={13} /></button>
                          <button onClick={() => setDeletando(row.id)} style={{
                            background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 3,
                          }} title="Excluir"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── EDIÇÃO INLINE DE PREÇO ──────────────────────────────────────────────────

function InlinePreco({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [v, setV] = React.useState(String(value));

  if (!editing) return (
    <button onClick={() => { setEditing(true); setV(String(value)); }} style={{
      background: "none", border: "none", cursor: "pointer",
      color: GREEN, fontWeight: 600, fontSize: 12, padding: 0,
      display: "flex", alignItems: "center", gap: 4,
    }}>
      {formatBRL(value)} <Pencil size={10} color={TEXT_DIM} />
    </button>
  );

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input
        type="number"
        value={v}
        onChange={e => setV(e.target.value)}
        autoFocus
        onKeyDown={e => {
          if (e.key === "Enter") { onSave(Number(v)); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        style={{
          width: 90, background: "#0d1117", border: `1px solid ${YELLOW}`,
          borderRadius: 5, padding: "4px 7px", color: "#fff", fontSize: 12,
        }}
      />
      <button onClick={() => { onSave(Number(v)); setEditing(false); }} style={{
        background: "none", border: "none", cursor: "pointer", color: GREEN, padding: 2,
      }}><Check size={12} /></button>
      <button onClick={() => setEditing(false)} style={{
        background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 2,
      }}><X size={12} /></button>
    </div>
  );
}
