/**
 * Tabela editável do cronograma. 1 linha = 1 registro em `cronograma_obras`.
 *
 * - Inline edit: clica num campo, edita, Tab/Enter salva.
 * - Coluna "Período" (obras/reparos): popover com data inicial + final → calcula dias.
 *   Salva em inicio_dia, termino_dia e dias (texto "Nd") simultaneamente.
 * - Dropdowns: cliente (kanban_cards filtrados por dept_id=operacional), fiscal, equipe.
 * - Tema dark/light via useTheme.
 * - Bidirecional: salvar atualiza também kanban_cards.details (quando há card_id).
 */
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { sb } from "../lib/supabase";
import { useCatalogos } from "../hooks/useCatalogos";
import { useTheme, type Tokens } from "../lib/theme";
import { Plus, Trash2, Save, X, Link2, Calendar as CalIcon } from "lucide-react";

export type Tipo = "obras" | "marcenaria" | "reparos";

type Row = {
  id?: string;
  tipo: Tipo;
  card_id: string | null;
  nome_obra: string | null;
  equipe: string | null;
  fiscal: string | null;
  servico: string | null;
  data_finalizacao: string | null;
  observacao: string | null;
  localizacao: string | null;
  custos: string | null;
  dias: string | null;
  data: string | null;
  inicio_dia: string | null;
  termino_dia: string | null;
  contrato: string | null;
  dispos: string | null;
  status_obra: string | null;
  posicao: number | null;
};

type Kind = "text" | "fiscal" | "equipe" | "cliente" | "date" | "periodo";
type ColDef = { key: keyof Row; label: string; width: string; kind: Kind };

const COLS_OBRAS: ColDef[] = [
  { key: "equipe",           label: "Equipe",      width: "180px", kind: "equipe" },
  { key: "dias",             label: "Período",     width: "190px", kind: "periodo" },
  { key: "custos",           label: "Custos",      width: "120px", kind: "text" },
  { key: "card_id",          label: "Cliente",     width: "200px", kind: "cliente" },
  { key: "servico",          label: "Serviço",     width: "160px", kind: "text" },
  { key: "fiscal",           label: "Fiscal",      width: "140px", kind: "fiscal" },
  { key: "data_finalizacao", label: "Finalização", width: "130px", kind: "date" },
  { key: "observacao",       label: "Observação",  width: "200px", kind: "text" },
  { key: "localizacao",      label: "Localização", width: "150px", kind: "text" },
];

const COLS_MARC: ColDef[] = [
  { key: "data",             label: "Data",        width: "120px", kind: "date" },
  { key: "inicio_dia",       label: "Início",      width: "100px", kind: "text" },
  { key: "termino_dia",      label: "Término",     width: "100px", kind: "text" },
  { key: "contrato",         label: "Contrato",    width: "100px", kind: "text" },
  { key: "equipe",           label: "Equipe",      width: "180px", kind: "equipe" },
  { key: "dispos",           label: "Dispos.",     width: "100px", kind: "text" },
  { key: "card_id",          label: "Cliente",     width: "200px", kind: "cliente" },
  { key: "servico",          label: "Serviço",     width: "160px", kind: "text" },
  { key: "observacao",       label: "Observação",  width: "200px", kind: "text" },
  { key: "fiscal",           label: "Fiscal",      width: "140px", kind: "fiscal" },
  { key: "data_finalizacao", label: "Finalização", width: "130px", kind: "date" },
  { key: "localizacao",      label: "Localização", width: "150px", kind: "text" },
];

export function TabelaCronograma({ tipo }: { tipo: Tipo }) {
  const cat = useCatalogos();
  const { t } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const cols = tipo === "marcenaria" ? COLS_MARC : COLS_OBRAS;

  const cardMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cat.cards) m.set(c.id, c.title);
    return m;
  }, [cat.cards]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await sb.from("cronograma_obras")
      .select("*")
      .eq("tipo", tipo)
      .order("posicao", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    setRows((data || []) as Row[]);
    setLoading(false);
  }, [tipo]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const card = r.card_id ? (cardMap.get(r.card_id) || "") : "";
      return [r.equipe, r.fiscal, r.servico, r.localizacao, r.observacao, r.nome_obra, card]
        .filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [rows, q, cardMap]);

  async function saveField(rowId: string | undefined, patch: Partial<Row>) {
    if (!rowId) return;
    setSaving(rowId);
    try {
      await sb.from("cronograma_obras").update(patch).eq("id", rowId);
      const row = rows.find((r) => r.id === rowId);
      if (row?.card_id) {
        const cardPatch: any = {};
        if ("fiscal" in patch) cardPatch.fiscal_responsavel = patch.fiscal;
        if ("data_finalizacao" in patch) cardPatch.data_finalizacao = patch.data_finalizacao;
        if ("equipe" in patch) cardPatch.equipe = patch.equipe;
        if (Object.keys(cardPatch).length) {
          const { data: card } = await sb.from("kanban_cards").select("details").eq("id", row.card_id).maybeSingle();
          const newDetails = { ...(card?.details || {}), ...cardPatch };
          await sb.from("kanban_cards").update({ details: newDetails }).eq("id", row.card_id);
        }
      }
      setRows((p) => p.map((r) => r.id === rowId ? { ...r, ...patch } : r));
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSaving(null);
    }
  }

  async function addRow() {
    const nextPos = Math.max(0, ...rows.map((r) => r.posicao || 0)) + 10;
    const { data, error } = await sb.from("cronograma_obras")
      .insert({ tipo, posicao: nextPos })
      .select("*").single();
    if (error) { alert("Erro: " + error.message); return; }
    setRows((p) => [data as Row, ...p]);
  }

  async function delRow(id: string) {
    if (!confirm("Apagar esta linha do cronograma?")) return;
    await sb.from("cronograma_obras").delete().eq("id", id);
    setRows((p) => p.filter((r) => r.id !== id));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar cliente, equipe, fiscal, serviço…"
          style={{
            flex: 1, background: t.bgInput,
            border: `1px solid ${t.borderStrong}`, color: t.text,
            padding: "9px 14px", borderRadius: 8, fontSize: 13, outline: "none",
          }} />
        <div style={{ fontSize: 11, color: t.textFaint }}>
          {filtered.length} {filtered.length === 1 ? "linha" : "linhas"}
        </div>
        <button onClick={addRow} style={{
          background: t.accent, color: t.accentInk, border: "none",
          padding: "9px 16px", borderRadius: 8, fontWeight: 600,
          fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          <Plus size={14} /> Nova linha
        </button>
      </div>

      <div style={{
        background: t.bgPanel, border: `1px solid ${t.border}`,
        borderRadius: 10, overflow: "auto", maxHeight: "calc(100vh - 240px)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: cols.reduce((s, c) => s + parseInt(c.width), 0) + 80 }}>
          <thead style={{ position: "sticky", top: 0, background: t.bgPanel, zIndex: 1 }}>
            <tr>
              {cols.map((c) => (
                <th key={String(c.key)} style={{
                  padding: "10px 12px", textAlign: "left",
                  fontSize: 9, color: t.textMuted,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  fontWeight: 600, borderBottom: `1px solid ${t.border}`,
                  width: c.width, whiteSpace: "nowrap",
                }}>{c.label}</th>
              ))}
              <th style={{ width: 48, borderBottom: `1px solid ${t.border}` }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length + 1} style={{ textAlign: "center", padding: 40, color: t.textFaint }}>Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={cols.length + 1} style={{ textAlign: "center", padding: 40, color: t.textFaint }}>Nada por aqui.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${t.border}` }}>
                {cols.map((c) => (
                  <td key={String(c.key)} style={{ padding: 0, verticalAlign: "top" }}>
                    <Cell row={r} col={c} catalogos={cat} cardMap={cardMap} tokens={t} onSave={(patch) => saveField(r.id, patch)} />
                  </td>
                ))}
                <td style={{ padding: "6px 8px", textAlign: "center" }}>
                  {saving === r.id ? <Save size={12} style={{ color: t.accent }} /> : (
                    <button onClick={() => r.id && delRow(r.id)} style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      color: t.textFaint, padding: 4,
                    }}><Trash2 size={13} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ row, col, catalogos, cardMap, tokens, onSave }: {
  row: Row; col: ColDef;
  catalogos: ReturnType<typeof useCatalogos>;
  cardMap: Map<string, string>;
  tokens: Tokens;
  onSave: (patch: Partial<Row>) => void;
}) {
  if (col.kind === "periodo") {
    return <PeriodoCell row={row} tokens={tokens} onSave={onSave} />;
  }
  return <SimpleCell row={row} col={col} catalogos={catalogos} cardMap={cardMap} tokens={tokens} onSave={onSave} />;
}

function SimpleCell({ row, col, catalogos, cardMap, tokens, onSave }: {
  row: Row; col: ColDef;
  catalogos: ReturnType<typeof useCatalogos>;
  cardMap: Map<string, string>;
  tokens: Tokens;
  onSave: (patch: Partial<Row>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const initial = col.key === "card_id" ? (row.card_id || "") : ((row[col.key] as any) ?? "");
  const [value, setValue] = useState(String(initial));

  useEffect(() => { setValue(String(initial)); }, [initial]);

  function commit() {
    setEditing(false);
    const cur = String((row[col.key] as any) ?? "");
    if (value === cur) return;
    onSave({ [col.key]: value || null } as any);
  }

  const editStyle = makeEditStyle(tokens);

  if (!editing) {
    const raw = (row[col.key] as any) || "";
    const disp = col.key === "card_id"
      ? (row.card_id ? cardMap.get(row.card_id) || "—" : "")
      : (col.kind === "date" ? fmtBR(raw) : raw);
    return (
      <div onClick={() => setEditing(true)} style={{
        padding: "8px 12px", color: tokens.text, cursor: "text",
        minHeight: 32, fontSize: 12,
        background: "transparent", display: "flex", alignItems: "center", gap: 6,
      }}>
        {col.key === "card_id" && row.card_id && (
          <Link2 size={10} style={{ color: tokens.accent, opacity: 0.7, flexShrink: 0 }} />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {disp || <span style={{ color: tokens.textFaint }}>—</span>}
        </span>
      </div>
    );
  }

  if (col.kind === "fiscal") {
    return (
      <select autoFocus value={value} onBlur={commit}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        style={editStyle}>
        <option value="">—</option>
        {catalogos.fiscais.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
      </select>
    );
  }
  if (col.kind === "equipe") {
    return (
      <select autoFocus value={value} onBlur={commit}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        style={editStyle}>
        <option value="">—</option>
        {catalogos.equipes.map((e) => <option key={e.id} value={e.nome}>{e.nome}</option>)}
      </select>
    );
  }
  if (col.kind === "cliente") {
    return (
      <select autoFocus value={value} onBlur={commit}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        style={editStyle}>
        <option value="">—</option>
        {catalogos.cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
    );
  }
  if (col.kind === "date") {
    return (
      <input type="date" autoFocus value={toISODate(value) || ""} onBlur={commit}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        style={editStyle} />
    );
  }
  return (
    <input autoFocus value={value} onBlur={commit}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setValue(String(initial)); setEditing(false); }
      }}
      style={editStyle} />
  );
}

/* --- Período: popover com data início + término previsto, calcula dias --- */

function PeriodoCell({ row, tokens, onSave }: {
  row: Row; tokens: Tokens;
  onSave: (patch: Partial<Row>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ini, setIni] = useState<string>(toISODate(row.inicio_dia));
  const [fim, setFim] = useState<string>(toISODate(row.termino_dia));
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setIni(toISODate(row.inicio_dia)); setFim(toISODate(row.termino_dia)); }, [row.inicio_dia, row.termino_dia]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        commit();
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ini, fim]);

  function commit() {
    setOpen(false);
    const iniCur = toISODate(row.inicio_dia);
    const fimCur = toISODate(row.termino_dia);
    if (ini === iniCur && fim === fimCur) return;
    const dias = diffDias(ini, fim);
    onSave({
      inicio_dia: ini || null,
      termino_dia: fim || null,
      dias: dias != null ? `${dias}d` : (row.dias || null),
    } as any);
  }

  function clear() {
    setIni("");
    setFim("");
    setOpen(false);
    onSave({ inicio_dia: null, termino_dia: null, dias: null } as any);
  }

  const display = formatPeriodoDisplay(row.inicio_dia, row.termino_dia, row.dias);

  return (
    <div style={{ position: "relative" }}>
      <div onClick={() => setOpen(true)} style={{
        padding: "8px 12px", color: tokens.text, cursor: "pointer",
        minHeight: 32, fontSize: 12,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <CalIcon size={11} style={{ color: tokens.accent, opacity: 0.7, flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {display || <span style={{ color: tokens.textFaint }}>—</span>}
        </span>
      </div>

      {open && (
        <div ref={popRef} style={{
          position: "absolute", zIndex: 50, top: "100%", left: 0, marginTop: 4,
          background: tokens.bgPanel, border: `1px solid ${tokens.borderStrong}`,
          borderRadius: 8, padding: 12, minWidth: 240,
          boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={popLabel(tokens)}>
              <span>Início</span>
              <input type="date" value={ini} autoFocus
                onChange={(e) => setIni(e.target.value)}
                style={popInput(tokens)} />
            </label>
            <label style={popLabel(tokens)}>
              <span>Término previsto</span>
              <input type="date" value={fim}
                onChange={(e) => setFim(e.target.value)}
                style={popInput(tokens)} />
            </label>
            {ini && fim && (
              <div style={{ fontSize: 11, color: tokens.textMuted }}>
                {(() => {
                  const d = diffDias(ini, fim);
                  if (d == null) return "Datas inválidas";
                  return `${d} dia${d === 1 ? "" : "s"} de obra`;
                })()}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, justifyContent: "space-between", paddingTop: 4 }}>
              <button onClick={clear} title="Limpar" style={popBtnSecondary(tokens)}>
                <X size={11} /> Limpar
              </button>
              <button onClick={commit} style={popBtnPrimary(tokens)}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- helpers --- */

function toISODate(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // try DD/MM[/YYYY]
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3] || String(new Date().getFullYear());
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  return "";
}

function fmtBR(iso: string | null | undefined): string {
  const s = toISODate(iso);
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function diffDias(a: string, b: string): number | null {
  if (!a || !b) return null;
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  if (isNaN(+da) || isNaN(+db)) return null;
  const ms = +db - +da;
  return Math.round(ms / 86400000) + 1;
}

function formatPeriodoDisplay(ini: string | null, fim: string | null, dias: string | null): string {
  const a = toISODate(ini);
  const b = toISODate(fim);
  if (a && b) {
    const d = diffDias(a, b);
    return `${fmtBR(a)} → ${fmtBR(b)}${d != null ? ` · ${d}d` : ""}`;
  }
  if (a) return `desde ${fmtBR(a)}`;
  if (b) return `até ${fmtBR(b)}`;
  return dias || "";
}

const makeEditStyle = (t: Tokens): React.CSSProperties => ({
  width: "100%", padding: "8px 12px",
  background: t.bgInputEdit, border: `1px solid ${t.accent}`,
  color: t.text, fontSize: 12, outline: "none", boxSizing: "border-box",
  fontFamily: "inherit",
});

const popLabel = (t: Tokens): React.CSSProperties => ({
  display: "flex", flexDirection: "column", gap: 4,
  fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em",
});

const popInput = (t: Tokens): React.CSSProperties => ({
  background: t.bgInput, border: `1px solid ${t.borderStrong}`,
  color: t.text, padding: "7px 10px", borderRadius: 6, fontSize: 12,
  outline: "none", fontFamily: "inherit",
});

const popBtnPrimary = (t: Tokens): React.CSSProperties => ({
  background: t.accent, color: t.accentInk, border: "none",
  padding: "7px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
  cursor: "pointer",
});

const popBtnSecondary = (t: Tokens): React.CSSProperties => ({
  background: "transparent", color: t.textMuted, border: `1px solid ${t.borderStrong}`,
  padding: "6px 10px", borderRadius: 6, fontSize: 11,
  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
});
