/** Relatórios — Pedidos de Compra (kanban) / Entradas / Saídas / Por Projeto.
 *  Herdado da aba Relatórios do ERP legado (Apps Script), agora sobre Supabase. */
import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { COLUNAS_COMPRAS, RESPONSAVEIS_COMPRAS, DeptCompras } from "../lib/theme";
import { fmtBRL, fmtQtd, fmtData, Movimento, printHtml } from "../lib/erp";
import { Printer, Trash2 } from "lucide-react";

type AbaRel = "pedidos" | "entradas" | "saidas" | "projeto";

type CardRow = {
  id: string;
  dept_id: string;
  column_id: string;
  title: string;
  obra: string | null;
  responsavel: string | null;
  details: any;
  created_at: string;
};

const ABAS: { id: AbaRel; label: string }[] = [
  { id: "pedidos", label: "Pedidos de Compra" },
  { id: "entradas", label: "Entradas" },
  { id: "saidas", label: "Saídas" },
  { id: "projeto", label: "Por Projeto" },
];

const DEP_LABEL: Record<string, string> = {
  marcenaria: "Marcenaria",
  instalacao: "Instalação",
  "marcenaria-curitiba": "Marcenaria Curitiba",
};
const depLabel = (d: string | null | undefined) => (d ? DEP_LABEL[d] || d : "—");

function colunaLabel(dept: string, col: string): string {
  const cols = COLUNAS_COMPRAS[dept as DeptCompras] || [];
  return cols.find((c) => c.id === col)?.label || col;
}
function deptNome(dept: string): string {
  return RESPONSAVEIS_COMPRAS.find((r) => r.dept === dept)?.nome || dept;
}

export default function Relatorios() {
  const { t } = useTheme();
  const [aba, setAba] = useState<AbaRel>("pedidos");
  const [cards, setCards] = useState<CardRow[]>([]);
  const [movs, setMovs] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);

  const primeiroDiaMes = new Date().toISOString().slice(0, 8) + "01";
  const [fDe, setFDe] = useState(primeiroDiaMes);
  const [fAte, setFAte] = useState(new Date().toISOString().slice(0, 10));
  const [fProjeto, setFProjeto] = useState("");
  const [fDeposito, setFDeposito] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: cs }, { data: ms }] = await Promise.all([
        sb.from("kanban_cards")
          .select("id,dept_id,column_id,title,obra,responsavel,details,created_at")
          .in("dept_id", ["compras", "compras-taiara", "compras-marco"])
          .order("created_at", { ascending: false }).limit(2000),
        sb.from("compras_estoque_mov").select("*")
          .order("data", { ascending: false }).limit(20000),
      ]);
      setCards((cs as unknown as CardRow[]) || []);
      setMovs((ms as unknown as Movimento[]) || []);
      setLoading(false);
    })();
  }, []);

  const projetos = useMemo(() => {
    const set = new Set<string>();
    movs.forEach((m) => m.projeto && set.add(m.projeto));
    cards.forEach((c) => {
      const p = c.details?.projeto_nome || c.obra;
      if (p) set.add(p);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [movs, cards]);

  const noPeriodo = (iso: string | null | undefined) => {
    const d = (iso || "").slice(0, 10);
    return (!fDe || d >= fDe) && (!fAte || d <= fAte);
  };
  const matchProjeto = (p: string | null | undefined) =>
    !fProjeto || (p || "").toLowerCase().includes(fProjeto.toLowerCase());

  const cardsFilt = useMemo(() =>
    cards.filter((c) => noPeriodo(c.created_at) && matchProjeto(c.details?.projeto_nome || c.obra)),
    [cards, fDe, fAte, fProjeto]);

  const movsFilt = useMemo(() =>
    movs.filter((m) => noPeriodo(m.data) && matchProjeto(m.projeto) && (!fDeposito || m.deposito === fDeposito)),
    [movs, fDe, fAte, fProjeto, fDeposito]);

  const entradas = useMemo(() => movsFilt.filter((m) => m.tipo === "Entrada"), [movsFilt]);
  const saidas = useMemo(() => movsFilt.filter((m) => m.tipo === "Saída"), [movsFilt]);

  const porProjeto = useMemo(() => {
    const m = new Map<string, { entradas: number; saidas: number; valorEntrada: number; movs: number }>();
    movsFilt.forEach((x) => {
      const key = x.projeto || "(sem projeto)";
      const agg = m.get(key) || { entradas: 0, saidas: 0, valorEntrada: 0, movs: 0 };
      if (x.tipo === "Entrada") { agg.entradas += x.quantidade || 0; agg.valorEntrada += x.valor_total || 0; }
      else agg.saidas += x.quantidade || 0;
      agg.movs++;
      m.set(key, agg);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [movsFilt]);

  async function apagarMov(m: Movimento) {
    if (!confirm(`APAGAR ${m.tipo === "Entrada" ? "a entrada" : "a saída"} de ${fmtQtd(m.quantidade)} ${m.unidade || ""} — ${m.descricao} (${fmtData(m.data)})? Essa ação não tem volta e afeta o saldo do estoque.`)) return;
    const { error } = await sb.from("compras_estoque_mov").delete().eq("id", m.id);
    if (error) { alert("Falha: " + error.message); return; }
    setMovs((prev) => prev.filter((x) => x.id !== m.id));
  }

  async function apagarProjeto(p: string) {
    const alvo = movsFilt.filter((x) => (x.projeto || "(sem projeto)") === p);
    if (alvo.length === 0) return;
    if (!confirm(`APAGAR TODOS os ${alvo.length} movimentos (entradas e saídas) de "${p}" no período ${fmtData(fDe)} a ${fmtData(fAte)}? Essa ação não tem volta e afeta o saldo do estoque.`)) return;
    const ids = alvo.map((x) => x.id);
    const { error } = await sb.from("compras_estoque_mov").delete().in("id", ids);
    if (error) { alert("Falha: " + error.message); return; }
    setMovs((prev) => prev.filter((x) => !ids.includes(x.id)));
  }

  function imprimir() {
    const periodo = `<p class="meta">Período: ${fmtData(fDe)} a ${fmtData(fAte)}${fProjeto ? " · Projeto: " + fProjeto : ""}</p>`;
    if (aba === "pedidos") {
      const linhas = cardsFilt.map((c) => `<tr>
        <td>${c.details?.projeto_nome || c.obra || "—"}</td><td>${c.title || "—"}</td>
        <td>${deptNome(c.dept_id)}</td><td>${colunaLabel(c.dept_id, c.column_id)}</td>
        <td>${fmtData(c.created_at)}</td></tr>`).join("");
      printHtml("Relatório · Pedidos de Compra", `${periodo}
        <table><thead><tr><th>Projeto / Obra</th><th>Solicitação</th><th>Responsável</th><th>Etapa</th><th>Data</th></tr></thead>
        <tbody>${linhas}</tbody></table><p class="meta tot">${cardsFilt.length} pedidos</p>`);
    } else if (aba === "entradas" || aba === "saidas") {
      const rows = aba === "entradas" ? entradas : saidas;
      const linhas = rows.map((m) => `<tr>
        <td>${fmtData(m.data)}</td><td>${depLabel(m.deposito)}</td><td>${m.produto_codigo || "—"}</td><td>${m.descricao}</td>
        <td>${fmtQtd(m.quantidade)} ${m.unidade || ""}</td>
        ${aba === "entradas" ? `<td>${fmtBRL(m.valor_unitario)}</td><td>${fmtBRL(m.valor_total)}</td><td>${m.fornecedor || "—"}</td>` : ""}
        <td>${m.documento || "—"}</td><td>${m.projeto || "—"}</td></tr>`).join("");
      const tot = rows.reduce((s, m) => s + (m.valor_total || 0), 0);
      printHtml(`Relatório · ${aba === "entradas" ? "Entradas" : "Saídas"} de Material`, `${periodo}
        ${fDeposito ? `<p class="meta">Depósito: ${depLabel(fDeposito)}</p>` : `<p class="meta">Depósito: todos os almoxarifados</p>`}
        <table><thead><tr><th>Data</th><th>Depósito</th><th>Código</th><th>Descrição</th><th>Qtd</th>
        ${aba === "entradas" ? "<th>V. Unit.</th><th>V. Total</th><th>Fornecedor</th>" : ""}
        <th>Doc</th><th>Projeto</th></tr></thead><tbody>${linhas}</tbody></table>
        <p class="meta tot">${rows.length} movimentos${aba === "entradas" ? " · Total " + fmtBRL(tot) : ""}</p>`);
    } else {
      const linhas = porProjeto.map(([p, a]) => `<tr>
        <td>${p}</td><td>${fmtQtd(a.entradas)}</td><td>${fmtQtd(a.saidas)}</td>
        <td>${fmtBRL(a.valorEntrada)}</td><td>${a.movs}</td></tr>`).join("");
      printHtml("Relatório · Consumo por Projeto", `${periodo}
        <table><thead><tr><th>Projeto</th><th>Qtd Entradas</th><th>Qtd Saídas</th><th>Valor Comprado</th><th>Movs</th></tr></thead>
        <tbody>${linhas}</tbody></table>`);
    }
  }

  const thSt: React.CSSProperties = {
    textAlign: "left", padding: "8px 12px", color: t.textMuted,
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: `1px solid ${t.border}`,
  };
  const tdSt: React.CSSProperties = { padding: "10px 12px", borderBottom: `1px solid ${t.border}`, fontSize: 12.5 };
  const inpSt: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", boxSizing: "border-box",
  };
  const lblSt: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: t.textMuted, marginBottom: 4, display: "block",
  };
  const delBtnSt: React.CSSProperties = {
    background: "transparent", border: `1px solid ${t.border}`, color: "#c0504d",
    padding: "5px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center",
  };

  return (
    <div style={{ padding: "24px 28px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Relatórios</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>Pedidos, movimentação de estoque e consumo por projeto</div>
        </div>
        <button onClick={imprimir} style={{
          background: "transparent", color: t.textSecondary, border: `1px solid ${t.border}`,
          padding: "9px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <Printer size={13} /> Imprimir
        </button>
      </header>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, flexWrap: "wrap" }}>
        {ABAS.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            background: aba === a.id ? t.accent : t.inputBg,
            color: aba === a.id ? t.bg : t.textSecondary,
            border: `1px solid ${aba === a.id ? t.accent : t.border}`,
            padding: "7px 14px", borderRadius: 0, fontSize: 11, fontWeight: 600, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            {a.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <label style={lblSt}>De</label>
          <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} style={{ ...inpSt, width: 150 }} />
        </div>
        <div>
          <label style={lblSt}>Até</label>
          <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} style={{ ...inpSt, width: 150 }} />
        </div>
        <div style={{ minWidth: 220 }}>
          <label style={lblSt}>Projeto</label>
          <input list="rel-projetos" value={fProjeto} onChange={(e) => setFProjeto(e.target.value)}
                 placeholder="Todos" style={{ ...inpSt, width: "100%" }} />
          <datalist id="rel-projetos">{projetos.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div>
          <label style={lblSt}>Depósito</label>
          <select value={fDeposito} onChange={(e) => setFDeposito(e.target.value)} style={{ ...inpSt, width: 190, appearance: "auto" as any }}>
            <option value="">Todos</option>
            {Object.entries(DEP_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>
      ) : aba === "pedidos" ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={thSt}>Projeto / Obra</th><th style={thSt}>Solicitação</th>
            <th style={thSt}>Responsável</th><th style={thSt}>Etapa</th><th style={thSt}>Data</th>
          </tr></thead>
          <tbody>
            {cardsFilt.map((c) => (
              <tr key={c.id}>
                <td style={{ ...tdSt, fontWeight: 600 }}>{c.details?.projeto_nome || c.obra || "—"}</td>
                <td style={{ ...tdSt, color: t.textSecondary, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.title}>{c.title || "—"}</td>
                <td style={{ ...tdSt, color: t.textSecondary }}>{deptNome(c.dept_id)}</td>
                <td style={tdSt}>{colunaLabel(c.dept_id, c.column_id)}</td>
                <td style={{ ...tdSt, color: t.textSecondary }}>{fmtData(c.created_at)}</td>
              </tr>
            ))}
            {cardsFilt.length === 0 && <tr><td colSpan={5} style={{ ...tdSt, textAlign: "center", color: t.textMuted }}>Nenhum pedido no período.</td></tr>}
          </tbody>
        </table>
      ) : aba === "projeto" ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={thSt}>Projeto</th><th style={{ ...thSt, textAlign: "right" }}>Qtd Entradas</th>
            <th style={{ ...thSt, textAlign: "right" }}>Qtd Saídas</th>
            <th style={{ ...thSt, textAlign: "right" }}>Valor Comprado</th>
            <th style={{ ...thSt, textAlign: "right" }}>Movimentos</th>
            <th style={thSt}></th>
          </tr></thead>
          <tbody>
            {porProjeto.map(([p, a]) => (
              <tr key={p}>
                <td style={{ ...tdSt, fontWeight: 600 }}>{p}</td>
                <td style={{ ...tdSt, textAlign: "right" }}>{fmtQtd(a.entradas)}</td>
                <td style={{ ...tdSt, textAlign: "right" }}>{fmtQtd(a.saidas)}</td>
                <td style={{ ...tdSt, textAlign: "right", fontWeight: 600 }}>{fmtBRL(a.valorEntrada)}</td>
                <td style={{ ...tdSt, textAlign: "right", color: t.textSecondary }}>{a.movs}</td>
                <td style={{ ...tdSt, textAlign: "right" }}>
                  <button onClick={() => apagarProjeto(p)} title="Apagar todos os movimentos do projeto no período" style={delBtnSt}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {porProjeto.length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: "center", color: t.textMuted }}>Nenhum movimento no período.</td></tr>}
          </tbody>
        </table>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={thSt}>Data</th><th style={thSt}>Depósito</th><th style={thSt}>Código</th><th style={thSt}>Descrição</th>
            <th style={{ ...thSt, textAlign: "right" }}>Qtd</th>
            {aba === "entradas" && <><th style={{ ...thSt, textAlign: "right" }}>V. Unit.</th>
            <th style={{ ...thSt, textAlign: "right" }}>V. Total</th><th style={thSt}>Fornecedor</th></>}
            <th style={thSt}>Doc</th><th style={thSt}>Projeto</th><th style={thSt}></th>
          </tr></thead>
          <tbody>
            {(aba === "entradas" ? entradas : saidas).map((m) => (
              <tr key={m.id}>
                <td style={{ ...tdSt, color: t.textSecondary }}>{fmtData(m.data)}</td>
                <td style={{ ...tdSt, color: t.textSecondary, whiteSpace: "nowrap" }}>{depLabel(m.deposito)}</td>
                <td style={{ ...tdSt, color: t.accent, fontWeight: 600 }}>{m.produto_codigo || "—"}</td>
                <td style={{ ...tdSt, fontWeight: 600 }}>{m.descricao}</td>
                <td style={{ ...tdSt, textAlign: "right" }}>{fmtQtd(m.quantidade)} {m.unidade || ""}</td>
                {aba === "entradas" && <>
                  <td style={{ ...tdSt, textAlign: "right" }}>{fmtBRL(m.valor_unitario)}</td>
                  <td style={{ ...tdSt, textAlign: "right", fontWeight: 600 }}>{fmtBRL(m.valor_total)}</td>
                  <td style={{ ...tdSt, color: t.textSecondary }}>{m.fornecedor || "—"}</td>
                </>}
                <td style={{ ...tdSt, color: t.textSecondary }}>{m.documento || "—"}</td>
                <td style={{ ...tdSt, color: t.textSecondary }}>{m.projeto || "—"}</td>
                <td style={{ ...tdSt, textAlign: "right" }}>
                  <button onClick={() => apagarMov(m)} title="Apagar movimento" style={delBtnSt}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {(aba === "entradas" ? entradas : saidas).length === 0 && (
              <tr><td colSpan={aba === "entradas" ? 11 : 8} style={{ ...tdSt, textAlign: "center", color: t.textMuted }}>Nenhum movimento no período.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
