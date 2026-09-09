/** Tabela de Ordens de Produção filtrada por etapa (Projetos / Finalizado). */
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Printer, Pencil, Plus } from "lucide-react";
import { Ordem, fetchOrdens, proximoIdOP, fmtData, passaFiltro, imprimirDoc } from "../lib/producao";
import OrdemModal from "../components/OrdemModal";

const COLS: { key: keyof Ordem; label: string; data?: boolean }[] = [
  { key: "id", label: "ID" },
  { key: "cliente_projeto", label: "Cliente / Projeto" },
  { key: "solicitante", label: "Solicitante" },
  { key: "setor", label: "Setor" },
  { key: "prioridade", label: "Prioridade" },
  { key: "data", label: "Data", data: true },
  { key: "prazo_entrega", label: "Prazo Entrega", data: true },
  { key: "projeto", label: "Projeto" },
  { key: "observacoes", label: "Observações" },
];

export default function Ordens({ etapa, titulo }: { etapa: string; titulo: string }) {
  const { t } = useTheme();
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [loading, setLoading] = useState(true);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<{ aberto: boolean; ordem: Ordem | null }>({ aberto: false, ordem: null });

  async function load() {
    setOrdens(await fetchOrdens());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const lista = useMemo(
    () => ordens
      .filter((o) => o.etapa === etapa)
      .filter((o) => passaFiltro(
        { datas: [o.data, o.prazo_entrega], texto: [o.cliente_projeto, o.projeto, o.solicitante, o.observacoes] },
        de, ate, busca
      )),
    [ordens, etapa, de, ate, busca]
  );

  function imprimir() {
    imprimirDoc(
      `RELATÓRIO DE ${titulo.toUpperCase()}`,
      COLS.map((c) => c.label),
      lista.map((o) => COLS.map((c) => (c.data ? fmtData(o[c.key] as string) : String(o[c.key] ?? ""))))
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

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>{titulo}</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>{lista.length} ordem(ns) na etapa {etapa}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={imprimir} style={btn}><Printer size={13} /> Imprimir relatório</button>
          <button onClick={() => setModal({ aberto: true, ordem: null })} style={{ ...btn, background: t.accent, color: t.bg, border: "none" }}>
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
          <div style={{ fontSize: 10, color: t.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Cliente / Projeto</div>
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
              <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>Ações</th>
              {COLS.map((c) => (
                <th key={c.key} style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.id}>
                <td style={{ padding: "8px 10px", borderBottom: `1px solid ${t.border}` }}>
                  <button title="Editar" onClick={() => setModal({ aberto: true, ordem: o })} style={{
                    background: "transparent", border: `1px solid ${t.border}`, color: t.info,
                    width: 26, height: 26, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}><Pencil size={12} /></button>
                </td>
                {COLS.map((c) => (
                  <td key={c.key} style={{ padding: "8px 10px", borderBottom: `1px solid ${t.border}`, color: t.textSecondary }}>
                    {c.data ? fmtData(o[c.key] as string) : String(o[c.key] ?? "") || "—"}
                  </td>
                ))}
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={COLS.length + 1} style={{ padding: 24, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                Nenhuma ordem nesta etapa.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal.aberto && (
        <OrdemModal ordem={modal.ordem} idSugerido={proximoIdOP(ordens)}
                    onClose={() => setModal({ aberto: false, ordem: null })}
                    onSaved={() => { setModal({ aberto: false, ordem: null }); load(); }} />
      )}
    </div>
  );
}
