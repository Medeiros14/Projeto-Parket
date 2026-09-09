/** Tabela genérica de setor (Prensa / Marcenaria) com filtros, CRUD e impressão. */
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Printer, Pencil, Plus, Trash2 } from "lucide-react";
import { fmtData, passaFiltro, imprimirDoc, salvarRegistro, excluirRegistro } from "../lib/producao";

export type ColDef = {
  key: string;
  label: string;
  tipo?: "date" | "select" | "textarea";
  opcoes?: string[];
};

type Registro = Record<string, any>;

const STATUS_CORES: Record<string, string> = {
  "EM ANDAMENTO": "info",
  "PARALISADO": "danger",
  "FINALIZADO": "success",
};

type Props = {
  titulo: string;
  subtitulo: string;
  tabela: "producao_prensa" | "producao_marcenaria";
  cols: ColDef[];
  fetch: () => Promise<Registro[]>;
};

export default function SetorTabela({ titulo, subtitulo, tabela, cols, fetch }: Props) {
  const { t } = useTheme();
  const [regs, setRegs] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<{ aberto: boolean; reg: Registro | null }>({ aberto: false, reg: null });

  async function load() {
    setRegs(await fetch());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const lista = useMemo(
    () => regs.filter((r) => passaFiltro(
      { datas: [r.inicio, r.entrega], texto: [r.cliente, r.item, r.observacao, r.equipe, r.acabamento] },
      de, ate, busca
    )),
    [regs, de, ate, busca]
  );

  function imprimir() {
    imprimirDoc(
      `RELATÓRIO — ${titulo.toUpperCase()}`,
      cols.map((c) => c.label),
      lista.map((r) => cols.map((c) => (c.tipo === "date" ? fmtData(r[c.key]) : String(r[c.key] ?? ""))))
    );
  }

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>;

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "8px 10px", fontSize: 12.5, borderRadius: 0, outline: "none",
  };
  const btn: React.CSSProperties = {
    background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`,
    padding: "8px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6,
  };
  const th: React.CSSProperties = {
    padding: "9px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase",
    letterSpacing: "0.08em", color: t.textMuted, borderBottom: `1px solid ${t.border}`,
  };
  const td: React.CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${t.border}`, color: t.textSecondary };

  const corStatus = (s: string) => {
    const chave = STATUS_CORES[String(s || "").toUpperCase()];
    return chave ? (t as any)[chave] : t.textSecondary;
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>{titulo}</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>{subtitulo} · {lista.length} item(ns)</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={imprimir} style={btn}><Printer size={13} /> Imprimir relatório</button>
          <button onClick={() => setModal({ aberto: true, reg: null })} style={{ ...btn, background: t.accent, color: t.bg, border: "none" }}>
            <Plus size={13} /> Cadastrar
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 10, color: t.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>De</div>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={inp} /></div>
        <div><div style={{ fontSize: 10, color: t.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Até</div>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10, color: t.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Cliente / Item</div>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" style={{ ...inp, width: "100%" }} />
        </div>
        {(de || ate || busca) && (
          <button onClick={() => { setDe(""); setAte(""); setBusca(""); }} style={btn}>Limpar</button>
        )}
      </div>

      <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={th}>Ações</th>
              {cols.map((c) => <th key={c.key} style={th}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  <button title="Editar" onClick={() => setModal({ aberto: true, reg: r })} style={{
                    background: "transparent", border: `1px solid ${t.border}`, color: t.info,
                    width: 26, height: 26, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}><Pencil size={12} /></button>
                </td>
                {cols.map((c) => (
                  <td key={c.key} style={{
                    ...td,
                    ...(c.key === "status" ? { color: corStatus(r.status), fontWeight: 700, fontSize: 11 } : {}),
                  }}>
                    {c.tipo === "date" ? fmtData(r[c.key]) : String(r[c.key] ?? "") || "—"}
                  </td>
                ))}
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={cols.length + 1} style={{ padding: 24, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                Nenhum registro encontrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal.aberto && (
        <RegistroModal
          tabela={tabela} cols={cols} reg={modal.reg}
          onClose={() => setModal({ aberto: false, reg: null })}
          onSaved={() => { setModal({ aberto: false, reg: null }); load(); }}
        />
      )}
    </div>
  );
}

function RegistroModal({ tabela, cols, reg, onClose, onSaved }: {
  tabela: "producao_prensa" | "producao_marcenaria";
  cols: ColDef[];
  reg: Registro | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTheme();
  const novo = !reg;
  const [form, setForm] = useState<Registro>(() => {
    if (reg) return { ...reg };
    const f: Registro = {};
    cols.forEach((c) => { f[c.key] = c.tipo === "select" ? (c.opcoes?.[0] ?? "") : ""; });
    return f;
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const dados: Registro = {};
      cols.forEach((c) => { dados[c.key] = form[c.key] ?? ""; });
      await salvarRegistro(tabela, dados, reg ? reg.id : null);
      onSaved();
    } catch (err: any) {
      alert("Falha ao salvar: " + (err?.message || err));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!reg) return;
    if (!confirm(`Excluir o item "${reg.item || reg.cliente}"?`)) return;
    try {
      await excluirRegistro(tabela, reg.id);
      onSaved();
    } catch (err: any) {
      alert("Falha ao excluir: " + (err?.message || err));
    }
  }

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%",
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
    color: t.textSecondary, marginBottom: 4, display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} style={{
        background: t.cardBg, border: `1px solid ${t.border}`, padding: 22,
        width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px", color: t.textPrimary }}>
          {novo ? "Cadastrar registro" : "Editar registro"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {cols.map((c) => (
            <div key={c.key} style={c.tipo === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
              <label style={lbl}>{c.label}</label>
              {c.tipo === "select" ? (
                <select value={form[c.key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))} style={inp}>
                  {(c.opcoes ?? []).map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : c.tipo === "textarea" ? (
                <textarea value={form[c.key] ?? ""} rows={3}
                          onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))}
                          style={{ ...inp, resize: "vertical" }} />
              ) : (
                <input type={c.tipo === "date" ? "date" : "text"} value={form[c.key] ?? ""}
                       onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))} style={inp} />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, gap: 10 }}>
          {!novo ? (
            <button type="button" onClick={excluir} style={{
              background: "transparent", color: t.danger, border: `1px solid ${t.danger}`,
              padding: "10px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}><Trash2 size={12} /> Excluir</button>
          ) : <span />}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={{
              background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`,
              padding: "10px 16px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
            }}>Cancelar</button>
            <button disabled={salvando} type="submit" style={{
              background: t.accent, color: t.bg, border: "none", padding: "10px 18px",
              fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: salvando ? 0.6 : 1,
            }}>{salvando ? "Salvando…" : "Salvar registro"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
