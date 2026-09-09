/** Almoxarifado da Produção — depósito Marcenaria Curitiba, mesmas tabelas do ERP Compras
 *  (compras_estoque_mov/compras_notas/compras_saidas/compras_contas_pagar no Supabase Cloud).
 *  Cópia de compras-app/src/app/pages/Almoxarifado.tsx com DEPOSITOS restrito. */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { sb } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { parseNfeXml, type NfeData } from "../lib/nfe";
import {
  fmtBRL, fmtQtd, fmtData, hojeISO, printHtml,
  fetchProdutos, ensureProduto, fetchProjetos, proximoProtocolo, categoriaInsumo,
  type Movimento, type Produto,
} from "../lib/erp";
import { FileUp, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";

type Aba = "posicao" | "entrada" | "saida" | "historico" | "xml";
export type Deposito = "marcenaria" | "instalacao" | "marcenaria-curitiba";

const DEPOSITOS: { id: Deposito; label: string; resp: string }[] = [
  { id: "marcenaria-curitiba", label: "Marcenaria Curitiba", resp: "Produção" },
];

const CNPJ_FMT = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

// Unidades de medida da entrada/saída manual (quantidade, m², metro linear…)
const UNIDADES = ["UN", "M²", "M", "M³", "LT", "KG", "CX", "PC", "PAR", "RL", "JG"];
const CATS = [
  { id: "MATERIA_PRIMA", label: "MATÉRIA PRIMA" },
  { id: "FERRAGEM", label: "FERRAGENS" },
  { id: "EMBALAGEM", label: "MATERIAL DE EMBALAGEM" },
] as const;

export default function Almoxarifado() {
  const { t } = useTheme();
  const [aba, setAba] = useState<Aba>("posicao");
  const [deposito, setDeposito] = useState<Deposito>("marcenaria-curitiba");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [projetos, setProjetos] = useState<string[]>([]);
  const [fornecedores, setFornecedores] = useState<{ nome: string; cnpj: string | null }[]>([]);

  useEffect(() => {
    fetchProdutos().then(setProdutos);
    fetchProjetos().then(setProjetos);
    sb.from("compras_fornecedores").select("nome,cnpj").eq("ativo", true).order("nome")
      .then(({ data }) => setFornecedores((data as any[]) || []));
  }, []);

  const st = useMemo(() => estilos(t), [t]);

  const ABAS: { id: Aba; label: string }[] = [
    { id: "posicao", label: "Posição de Estoque" },
    { id: "entrada", label: "Entrada Manual" },
    { id: "saida", label: "Saída de Material" },
    { id: "historico", label: "Histórico de Saídas" },
    { id: "xml", label: "Importar XML NF-e" },
  ];

  return (
    <div style={{ padding: "24px 28px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Almoxarifado</h1>
        <div style={{ fontSize: 12, color: t.textMuted }}>Estoque físico · entradas, saídas e importação de NF-e</div>
      </header>

      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
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

      {aba !== "historico" && <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.textMuted, marginRight: 4 }}>
          Depósito
        </span>
        {DEPOSITOS.map((d) => (
          <button key={d.id} onClick={() => setDeposito(d.id)} title={`responsável: ${d.resp}`} style={{
            background: deposito === d.id ? t.accent : t.inputBg,
            color: deposito === d.id ? t.bg : t.textSecondary,
            border: `1px solid ${deposito === d.id ? t.accent : t.border}`,
            padding: "5px 12px", borderRadius: 0, fontSize: 10.5, fontWeight: 600, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            {d.label} · {d.resp}
          </button>
        ))}
      </div>}

      {aba === "posicao" && <Posicao st={st} t={t} deposito={deposito} produtos={produtos} onProdutos={() => fetchProdutos().then(setProdutos)} />}
      {aba === "entrada" && <Entrada st={st} t={t} deposito={deposito} setDeposito={setDeposito} produtos={produtos} projetos={projetos} fornecedores={fornecedores} onSaved={() => fetchProdutos().then(setProdutos)} />}
      {aba === "saida" && <Saida st={st} t={t} deposito={deposito} setDeposito={setDeposito} produtos={produtos} projetos={projetos} />}
      {aba === "historico" && <HistoricoSaidas st={st} t={t} />}
      {aba === "xml" && <ImportXml st={st} t={t} deposito={deposito} setDeposito={setDeposito} produtos={produtos} projetos={projetos} onSaved={() => fetchProdutos().then(setProdutos)} />}
    </div>
  );
}

/* ─── estilos compartilhados ────────────────────────────────────────────── */
function estilos(t: any) {
  const thSt: React.CSSProperties = {
    textAlign: "left", padding: "8px 12px", color: t.textMuted,
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: `1px solid ${t.border}`,
  };
  const tdSt: React.CSSProperties = { padding: "9px 12px", borderBottom: `1px solid ${t.border}`, fontSize: 12.5 };
  const inpSt: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%", boxSizing: "border-box",
  };
  const lblSt: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: t.textMuted, marginBottom: 4, display: "block",
  };
  const btnPri: React.CSSProperties = {
    background: t.accent, color: t.bg, border: "none", padding: "10px 18px",
    fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
  };
  const btnSec: React.CSSProperties = {
    background: t.inputBg, color: t.textSecondary, border: `1px solid ${t.border}`,
    padding: "8px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
  };
  const painel: React.CSSProperties = { background: t.panelBg || "transparent", border: `1px solid ${t.border}`, padding: 18 };
  return { thSt, tdSt, inpSt, lblSt, btnPri, btnSec, painel };
}
type St = ReturnType<typeof estilos>;

/* ─── POSIÇÃO DE ESTOQUE ────────────────────────────────────────────────── */
function Posicao({ st, t, deposito, produtos, onProdutos }: { st: St; t: any; deposito: Deposito; produtos: Produto[]; onProdutos: () => void }) {
  const [movs, setMovs] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    sb.from("compras_estoque_mov").select("*").eq("deposito", deposito)
      .order("data").order("created_at").limit(20000)
      .then(({ data }) => { setMovs((data as unknown as Movimento[]) || []); setLoading(false); });
  }
  useEffect(reload, [deposito]);

  const saldos = useMemo(() => {
    const map = new Map<string, { key: string; codigo: string; descricao: string; unidade: string; entradas: number; saidas: number; custo: number }>();
    for (const m of movs) {
      const key = m.produto_codigo || m.descricao;
      const cur = map.get(key) || { key, codigo: m.produto_codigo || "—", descricao: m.descricao, unidade: m.unidade || "UN", entradas: 0, saidas: 0, custo: 0 };
      if (m.tipo === "Entrada") { cur.entradas += Number(m.quantidade); if (Number(m.valor_unitario) > 0) cur.custo = Number(m.valor_unitario); }
      else cur.saidas += Number(m.quantidade);
      cur.descricao = m.descricao || cur.descricao;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((x) => {
        const p = produtos.find((pp) => pp.codigo === x.codigo || pp.descricao === x.descricao);
        return {
          ...x, saldo: x.entradas - x.saidas, valor: (x.entradas - x.saidas) * x.custo,
          categoria: p?.categoria || categoriaInsumo(x.descricao),
        };
      })
      .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
  }, [movs, produtos]);

  const movsDe = (key: string) => movs.filter((m) => (m.produto_codigo || m.descricao) === key);

  async function excluirProduto(s: { key: string; descricao: string }) {
    const its = movsDe(s.key);
    if (!confirm(`Excluir "${s.descricao}" deste depósito? Isso apaga ${its.length} movimento(s) de estoque. Essa ação não tem volta.`)) return;
    const { error } = await sb.from("compras_estoque_mov").delete().in("id", its.map((m) => m.id));
    if (error) { alert("Falha ao excluir: " + error.message); return; }
    reload();
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? saldos.filter((s) => s.descricao.toLowerCase().includes(q) || s.codigo.toLowerCase().includes(q)) : saldos;
  }, [saldos, busca]);

  const totalValor = filtrados.reduce((s, x) => s + x.valor, 0);
  const grupos = CATS.map((c) => ({ ...c, rows: filtrados.filter((s) => s.categoria === c.id) })).filter((g) => g.rows.length);

  function imprimir() {
    const linhas = grupos.map((g) =>
      `<tr><td colspan="6" style="font-weight:700;letter-spacing:0.06em">${g.label}</td></tr>` +
      g.rows.map((s) =>
        `<tr><td>${s.codigo}</td><td>${s.descricao}</td><td>${s.unidade}</td><td>${fmtQtd(s.saldo)}</td><td>${fmtBRL(s.custo)}</td><td>${fmtBRL(s.valor)}</td></tr>`).join("")).join("");
    printHtml("Posição de Estoque", `
      <p class="meta">Emitido em ${fmtData(hojeISO())} · ${filtrados.length} itens · valor total ${fmtBRL(totalValor)}</p>
      <table><thead><tr><th>Código</th><th>Descrição</th><th>Unid.</th><th>Saldo</th><th>Últ. custo</th><th>Valor</th></tr></thead>
      <tbody>${linhas}</tbody></table>`);
  }

  if (loading) return <div style={{ padding: 30, color: t.textMuted }}>Carregando movimentos…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "0 0 260px" }}>
          <Search size={12} style={{ position: "absolute", left: 9, top: 11, color: t.textMuted }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…" style={{ ...st.inpSt, paddingLeft: 28 }} />
        </div>
        <div style={{ flex: 1, fontSize: 12, color: t.textMuted }}>
          {filtrados.length} itens · valor em estoque {fmtBRL(totalValor)}
        </div>
        <button onClick={imprimir} style={st.btnSec}><Printer size={13} /> Imprimir</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={st.thSt}>Código</th><th style={st.thSt}>Descrição</th><th style={st.thSt}>Unid.</th>
          <th style={st.thSt}>Entradas</th><th style={st.thSt}>Saídas</th><th style={st.thSt}>Saldo</th>
          <th style={st.thSt}>Últ. custo</th><th style={st.thSt}>Valor em estoque</th>
          <th style={{ ...st.thSt, textAlign: "right" }}>Ações</th>
        </tr></thead>
        <tbody>
          {grupos.map((g) => (
          <Fragment key={g.id}>
          <tr><td colSpan={9} style={{ ...st.tdSt, background: t.inputBg, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent }}>
            {g.label} · {g.rows.length}
          </td></tr>
          {g.rows.map((s) => (
            <tr key={s.codigo + s.descricao}>
              <td style={{ ...st.tdSt, color: t.accent, fontWeight: 600 }}>{s.codigo}</td>
              <td style={{ ...st.tdSt, color: t.textPrimary }}>{s.descricao}</td>
              <td style={{ ...st.tdSt, color: t.textSecondary }}>{s.unidade}</td>
              <td style={{ ...st.tdSt, color: t.textSecondary }}>{fmtQtd(s.entradas)}</td>
              <td style={{ ...st.tdSt, color: t.textSecondary }}>{fmtQtd(s.saidas)}</td>
              <td style={{ ...st.tdSt, fontWeight: 700, color: s.saldo < 0 ? t.danger : s.saldo === 0 ? t.textMuted : t.success }}>{fmtQtd(s.saldo)}</td>
              <td style={{ ...st.tdSt, color: t.textSecondary }}>{s.custo ? fmtBRL(s.custo) : "—"}</td>
              <td style={{ ...st.tdSt, color: t.textSecondary }}>{s.valor ? fmtBRL(s.valor) : "—"}</td>
              <td style={{ ...st.tdSt, textAlign: "right", whiteSpace: "nowrap" }}>
                <button onClick={() => setEditKey(s.key)} title="Editar produto e movimentos"
                        style={{ background: "transparent", border: "none", color: t.textSecondary, cursor: "pointer", padding: 4 }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => excluirProduto(s)} title="Excluir produto (todos os movimentos)"
                        style={{ background: "transparent", border: "none", color: t.danger, cursor: "pointer", padding: 4 }}>
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          </Fragment>
          ))}
          {filtrados.length === 0 && (
            <tr><td colSpan={9} style={{ ...st.tdSt, textAlign: "center", color: t.textMuted }}>
              Sem movimentos de estoque ainda. Use Entrada Manual ou Importar XML.
            </td></tr>
          )}
        </tbody>
      </table>

      {editKey && (
        <EditarProduto st={st} t={t} movs={movsDe(editKey)}
          categoria={saldos.find((s) => s.key === editKey)?.categoria || "MATERIA_PRIMA"}
          onClose={() => setEditKey(null)}
          onSaved={() => { setEditKey(null); reload(); onProdutos(); }} />
      )}
    </div>
  );
}

/* ─── MODAL EDITAR PRODUTO / MOVIMENTOS ─────────────────────────────────── */
type EditRow = { id: string; data: string; tipo: string; documento: string | null; quantidade: string; valorUnitario: string; del: boolean };

function EditarProduto({ st, t, movs, categoria, onClose, onSaved }: {
  st: St; t: any; movs: Movimento[]; categoria: string; onClose: () => void; onSaved: () => void;
}) {
  const [nome, setNome] = useState(movs[movs.length - 1]?.descricao || "");
  const [cat, setCat] = useState(categoria);
  const [rows, setRows] = useState<EditRow[]>(movs.map((m) => ({
    id: m.id, data: (m.data || "").slice(0, 10), tipo: m.tipo, documento: m.documento,
    quantidade: String(Number(m.quantidade)).replace(".", ","),
    valorUnitario: String(Number(m.valor_unitario)).replace(".", ","),
    del: false,
  })));
  const [salvando, setSalvando] = useState(false);

  function setRow(i: number, k: keyof EditRow, v: string | boolean) {
    setRows((prev) => prev.map((x, ix) => (ix === i ? { ...x, [k]: v } : x)));
  }

  async function salvar() {
    const nomeNovo = nome.trim().toUpperCase();
    if (!nomeNovo) { alert("O nome do produto não pode ficar vazio."); return; }
    setSalvando(true);
    try {
      for (const r of rows) {
        if (r.del) {
          const { error } = await sb.from("compras_estoque_mov").delete().eq("id", r.id);
          if (error) throw new Error(error.message);
          continue;
        }
        const orig = movs.find((m) => m.id === r.id)!;
        const qtd = parseFloat(r.quantidade.replace(",", ".")) || 0;
        const vu = parseFloat(r.valorUnitario.replace(",", ".")) || 0;
        const patch: Record<string, any> = {};
        if (r.data && r.data !== (orig.data || "").slice(0, 10)) patch.data = r.data;
        if (qtd !== Number(orig.quantidade)) patch.quantidade = qtd;
        if (vu !== Number(orig.valor_unitario)) patch.valor_unitario = vu;
        if ("quantidade" in patch || "valor_unitario" in patch) patch.valor_total = qtd * vu;
        if (nomeNovo !== orig.descricao) patch.descricao = nomeNovo;
        if (Object.keys(patch).length) {
          const { error } = await sb.from("compras_estoque_mov").update(patch).eq("id", r.id);
          if (error) throw new Error(error.message);
        }
      }
      const codigo = movs.find((m) => m.produto_codigo)?.produto_codigo;
      const nomeAntigo = movs[movs.length - 1]?.descricao;
      if (codigo && (nomeNovo !== nomeAntigo || cat !== categoria)) {
        await sb.from("compras_produtos").update({ descricao: nomeNovo, categoria: cat }).eq("codigo", codigo);
      }
      onSaved();
    } catch (err: any) {
      alert("Falha ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.bg, border: `1px solid ${t.border}`, width: "min(860px, 100%)",
        maxHeight: "85vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent }}>Editar produto</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={16} /></button>
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 190px", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={st.lblSt}>Nome / descrição do produto</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} style={st.inpSt} />
            </div>
            <div>
              <label style={st.lblSt}>Tipo</label>
              <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...st.inpSt, appearance: "auto" as any }}>
                {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.textMuted, marginBottom: 6 }}>
            Movimentos ({rows.length}) — edite quantidade e valor, ou marque a lixeira pra excluir
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={st.thSt}>Data</th><th style={st.thSt}>Tipo</th><th style={st.thSt}>Documento</th>
              <th style={st.thSt}>Qtd</th><th style={st.thSt}>Vlr unit. R$</th><th style={st.thSt}>Total</th><th style={st.thSt}></th>
            </tr></thead>
            <tbody>
              {rows.map((r, ix) => {
                const tot = (parseFloat(r.quantidade.replace(",", ".")) || 0) * (parseFloat(r.valorUnitario.replace(",", ".")) || 0);
                return (
                  <tr key={r.id} style={{ opacity: r.del ? 0.35 : 1, textDecoration: r.del ? "line-through" : "none" }}>
                    <td style={{ ...st.tdSt, width: 140 }}>
                      <input type="date" value={r.data} disabled={r.del} onChange={(e) => setRow(ix, "data", e.target.value)} style={{ ...st.inpSt, padding: "6px 8px", fontSize: 12 }} />
                    </td>
                    <td style={{ ...st.tdSt, color: r.tipo === "Entrada" ? t.success : t.warning, fontWeight: 600 }}>{r.tipo}</td>
                    <td style={{ ...st.tdSt, color: t.textMuted, fontSize: 11.5 }}>{r.documento || "—"}</td>
                    <td style={{ ...st.tdSt, width: 90 }}>
                      <input value={r.quantidade} disabled={r.del} onChange={(e) => setRow(ix, "quantidade", e.target.value)} style={{ ...st.inpSt, padding: "6px 8px", fontSize: 12 }} />
                    </td>
                    <td style={{ ...st.tdSt, width: 110 }}>
                      <input value={r.valorUnitario} disabled={r.del} onChange={(e) => setRow(ix, "valorUnitario", e.target.value)} style={{ ...st.inpSt, padding: "6px 8px", fontSize: 12 }} />
                    </td>
                    <td style={{ ...st.tdSt, color: t.textSecondary }}>{fmtBRL(tot)}</td>
                    <td style={{ ...st.tdSt, width: 34 }}>
                      <button onClick={() => setRow(ix, "del", !r.del)} title={r.del ? "Desfazer exclusão" : "Excluir movimento"}
                              style={{ background: "transparent", border: "none", color: r.del ? t.textMuted : t.danger, cursor: "pointer" }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 18px", borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} style={st.btnSec}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...st.btnPri, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ENTRADA MANUAL ────────────────────────────────────────────────────── */
type ItemLinha = { descricao: string; quantidade: string; unidade: string; valorUnitario: string; categoria: "MATERIA_PRIMA" | "FERRAGEM" | "EMBALAGEM" };
type ParcelaLinha = { vencimento: string; valor: string; forma: string };

function Entrada({ st, t, deposito, setDeposito, produtos, projetos, fornecedores, onSaved }: {
  st: St; t: any; deposito: Deposito; setDeposito: (d: Deposito) => void; produtos: Produto[]; projetos: string[];
  fornecedores: { nome: string; cnpj: string | null }[]; onSaved: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState(hojeISO());
  const [projeto, setProjeto] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [documento, setDocumento] = useState("");
  const [itens, setItens] = useState<ItemLinha[]>([{ descricao: "", quantidade: "", unidade: "UN", valorUnitario: "", categoria: "MATERIA_PRIMA" }]);
  const [parcelas, setParcelas] = useState<ParcelaLinha[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  const totalItens = itens.reduce((s, i) => s + (parseFloat(i.quantidade.replace(",", ".")) || 0) * (parseFloat(i.valorUnitario.replace(",", ".")) || 0), 0);
  const totalParcelas = parcelas.reduce((s, p) => s + (parseFloat(p.valor.replace(",", ".")) || 0), 0);

  function setItem(i: number, k: keyof ItemLinha, v: string) {
    setItens((prev) => prev.map((x, ix) => {
      if (ix !== i) return x;
      const next: ItemLinha = { ...x, [k]: v } as ItemLinha;
      // Ao digitar/escolher a descrição, sugere Tipo: match no cadastro → categoria do produto;
      // senão, keyword do watcher. Usuário pode sobrescrever no select ao lado.
      if (k === "descricao") {
        const desc = String(v || "").trim().toUpperCase();
        const hit = produtos.find((p) => p.descricao.trim().toUpperCase() === desc);
        const sugestao = (hit?.categoria as ItemLinha["categoria"]) || categoriaInsumo(desc);
        next.categoria = sugestao;
        if (hit?.unidade && !UNIDADES.includes(x.unidade)) next.unidade = hit.unidade;
      }
      return next;
    }));
  }
  function setParcela(i: number, k: keyof ParcelaLinha, v: string) {
    setParcelas((prev) => prev.map((x, ix) => (ix === i ? { ...x, [k]: v } : x)));
  }

  async function salvar() {
    const validos = itens.filter((i) => i.descricao.trim() && parseFloat(i.quantidade.replace(",", ".")) > 0);
    if (!validos.length) { alert("Adicione ao menos 1 material com quantidade."); return; }
    if (!projeto.trim()) { alert("Informe o projeto / centro de custo."); return; }
    setSalvando(true);
    setMsg("");
    try {
      const { data: nota, error: eNota } = await sb.from("compras_notas").insert({
        tipo: "manual",
        numero_nf: documento.trim() || null,
        chave_acesso: null,
        fornecedor_nome: fornecedor.trim() || null,
        fornecedor_cnpj: null,
        projeto: projeto.trim(),
        data_emissao: data,
        data_entrada: data,
        valor_total: totalItens,
        criado_por: user?.email || null,
      }).select().single();
      if (eNota) throw new Error(eNota.message);

      const cache = [...produtos];
      const movRows = [];
      for (const i of validos) {
        const qtd = parseFloat(i.quantidade.replace(",", ".")) || 0;
        const vu = parseFloat(i.valorUnitario.replace(",", ".")) || 0;
        const codigo = await ensureProduto(i.descricao, i.unidade, cache, i.categoria);
        movRows.push({
          data, produto_codigo: codigo, descricao: i.descricao.trim().toUpperCase(),
          tipo: "Entrada", quantidade: qtd, unidade: i.unidade || "UN",
          valor_unitario: vu, valor_total: qtd * vu,
          documento: documento.trim() || "ENTRADA MANUAL", fornecedor: fornecedor.trim() || null,
          projeto: projeto.trim(), nota_id: (nota as any).id, saida_id: null, deposito,
        });
      }
      const { error: eMov } = await sb.from("compras_estoque_mov").insert(movRows);
      if (eMov) throw new Error(eMov.message);

      const parcelasValidas = parcelas.filter((p) => p.vencimento && parseFloat(p.valor.replace(",", ".")) > 0);
      if (parcelasValidas.length) {
        const cpRows = parcelasValidas.map((p, ix) => ({
          fornecedor: fornecedor.trim() || null,
          documento: documento.trim() || "ENTRADA MANUAL",
          nota_id: (nota as any).id,
          parcela: ix + 1,
          data_vencimento: p.vencimento,
          valor: parseFloat(p.valor.replace(",", ".")) || 0,
          forma_pagamento: p.forma || null,
          status: "pendente",
          data_pagamento: null,
          projeto: projeto.trim(),
          obs: null,
        }));
        const { error: eCp } = await sb.from("compras_contas_pagar").insert(cpRows);
        if (eCp) throw new Error(eCp.message);
      }

      setMsg(`Entrada registrada — ${validos.length} itens (${fmtBRL(totalItens)})${parcelasValidas.length ? ` + ${parcelasValidas.length} parcelas no financeiro` : ""}.`);
      setItens([{ descricao: "", quantidade: "", unidade: "UN", valorUnitario: "", categoria: "MATERIA_PRIMA" }]);
      setParcelas([]);
      setDocumento("");
      onSaved();
    } catch (err: any) {
      alert("Falha ao registrar entrada: " + err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
      <div style={st.painel}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 190px 1fr 1fr 180px", gap: 12 }}>
          <div><label style={st.lblSt}>Data *</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={st.inpSt} /></div>
          <div><label style={st.lblSt}>Depósito *</label>
            <select value={deposito} onChange={(e) => setDeposito(e.target.value as Deposito)} style={{ ...st.inpSt, appearance: "auto" as any }}>
              {DEPOSITOS.map((d) => <option key={d.id} value={d.id}>{d.label} · {d.resp}</option>)}
            </select></div>
          <div><label style={st.lblSt}>Projeto / Centro de custo *</label>
            <input list="dl-projetos" value={projeto} onChange={(e) => setProjeto(e.target.value)} placeholder="Obra / setor…" style={st.inpSt} />
            <datalist id="dl-projetos">{projetos.map((p) => <option key={p} value={p} />)}</datalist></div>
          <div><label style={st.lblSt}>Fornecedor</label>
            <input list="dl-fornecedores" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" style={st.inpSt} />
            <datalist id="dl-fornecedores">{fornecedores.map((f) => <option key={f.nome} value={f.nome} />)}</datalist></div>
          <div><label style={st.lblSt}>Documento / NF</label>
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="nº NF, recibo…" style={st.inpSt} /></div>
        </div>
      </div>

      <div style={st.painel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent }}>Materiais</div>
          <button onClick={() => setItens((p) => [...p, { descricao: "", quantidade: "", unidade: "UN", valorUnitario: "", categoria: "MATERIA_PRIMA" }])} style={st.btnSec}><Plus size={12} /> Material</button>
        </div>
        {itens.map((i, ix) => (
          <div key={ix} style={{ display: "grid", gridTemplateColumns: "1fr 130px 110px 90px 130px 110px 34px", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input list="dl-produtos" value={i.descricao} onChange={(e) => setItem(ix, "descricao", e.target.value)} placeholder="Descrição do material" style={st.inpSt} />
            <select value={i.categoria} onChange={(e) => setItem(ix, "categoria", e.target.value)} title="Tipo de material" style={{ ...st.inpSt, appearance: "auto" as any }}>
              <option value="MATERIA_PRIMA">Matéria prima</option>
              <option value="FERRAGEM">Ferragem</option>
              <option value="EMBALAGEM">Embalagem</option>
            </select>
            <input value={i.quantidade} onChange={(e) => setItem(ix, "quantidade", e.target.value)} placeholder="Qtd" style={st.inpSt} />
            <select value={i.unidade} onChange={(e) => setItem(ix, "unidade", e.target.value)} title="Unidade de medida" style={{ ...st.inpSt, appearance: "auto" as any }}>
              {(UNIDADES.includes(i.unidade) ? UNIDADES : [i.unidade, ...UNIDADES]).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <input value={i.valorUnitario} onChange={(e) => setItem(ix, "valorUnitario", e.target.value)} placeholder="Vlr unit. R$" style={st.inpSt} />
            <div style={{ fontSize: 12, color: t.textSecondary, textAlign: "right" }}>
              {fmtBRL((parseFloat(i.quantidade.replace(",", ".")) || 0) * (parseFloat(i.valorUnitario.replace(",", ".")) || 0))}
            </div>
            <button onClick={() => setItens((p) => p.filter((_, j) => j !== ix))} disabled={itens.length === 1}
                    style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer", opacity: itens.length === 1 ? 0.3 : 1 }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <datalist id="dl-produtos">{produtos.map((p) => <option key={p.id} value={p.descricao} />)}</datalist>
        <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: t.textPrimary, marginTop: 6 }}>
          Total: {fmtBRL(totalItens)}
        </div>
      </div>

      <div style={st.painel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent }}>
            Financeiro — parcelas / pagamentos <span style={{ color: t.textMuted, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional, vira Contas a Pagar)</span>
          </div>
          <button onClick={() => setParcelas((p) => [...p, { vencimento: "", valor: "", forma: "" }])} style={st.btnSec}><Plus size={12} /> Parcela</button>
        </div>
        {parcelas.map((p, ix) => (
          <div key={ix} style={{ display: "grid", gridTemplateColumns: "160px 140px 1fr 34px", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="date" value={p.vencimento} onChange={(e) => setParcela(ix, "vencimento", e.target.value)} style={st.inpSt} />
            <input value={p.valor} onChange={(e) => setParcela(ix, "valor", e.target.value)} placeholder="Valor R$" style={st.inpSt} />
            <select value={p.forma} onChange={(e) => setParcela(ix, "forma", e.target.value)} style={{ ...st.inpSt, appearance: "auto" as any }}>
              <option value="">Forma de pagamento…</option>
              <option>PIX</option><option>Boleto</option><option>Transferência</option><option>Cartão</option><option>Dinheiro</option>
            </select>
            <button onClick={() => setParcelas((prev) => prev.filter((_, j) => j !== ix))}
                    style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {parcelas.length > 0 && (
          <div style={{ textAlign: "right", fontSize: 12, color: Math.abs(totalParcelas - totalItens) > 0.01 ? t.warning : t.success }}>
            Parcelas: {fmtBRL(totalParcelas)} {Math.abs(totalParcelas - totalItens) > 0.01 ? `(difere do total ${fmtBRL(totalItens)})` : "· confere com o total"}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={salvar} disabled={salvando} style={{ ...st.btnPri, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "Registrando…" : "Registrar Entrada & Financeiro"}
        </button>
        {msg && <div style={{ fontSize: 12.5, color: t.success }}>{msg}</div>}
      </div>
    </div>
  );
}

/* ─── SAÍDA DE MATERIAL ─────────────────────────────────────────────────── */
type SaidaLinha = { descricao: string; quantidade: string; unidade: string };

function Saida({ st, t, deposito, setDeposito, produtos, projetos }: { st: St; t: any; deposito: Deposito; setDeposito: (d: Deposito) => void; produtos: Produto[]; projetos: string[] }) {
  const { user } = useAuth();
  const [data, setData] = useState(hojeISO());
  const [projeto, setProjeto] = useState("");
  const [obras, setObras] = useState<{ id: string; cliente: string; localizacao: string | null }[]>([]);
  const [obraId, setObraId] = useState("");
  const [endereco, setEndereco] = useState("");
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<SaidaLinha[]>([{ descricao: "", quantidade: "", unidade: "UN" }]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [estoque, setEstoque] = useState<{ descricao: string; unidade: string; saldo: number }[]>([]);

  useEffect(() => {
    sb.from("obras").select("id,cliente,localizacao").order("cliente").limit(2000)
      .then(({ data }) => setObras((data as any[]) || []));
  }, []);

  // Materiais disponíveis = só o que tem saldo NESTE depósito (estoques nunca se misturam)
  useEffect(() => {
    let ativo = true;
    setEstoque([]);
    sb.from("compras_estoque_mov").select("produto_codigo,descricao,unidade,tipo,quantidade")
      .eq("deposito", deposito).limit(20000)
      .then(({ data }) => {
        if (!ativo) return;
        const map = new Map<string, { descricao: string; unidade: string; saldo: number }>();
        for (const m of (data as any[]) || []) {
          const key = m.produto_codigo || m.descricao;
          const cur = map.get(key) || { descricao: m.descricao, unidade: m.unidade || "UN", saldo: 0 };
          cur.saldo += m.tipo === "Entrada" ? Number(m.quantidade) : -Number(m.quantidade);
          cur.descricao = m.descricao || cur.descricao;
          map.set(key, cur);
        }
        setEstoque(Array.from(map.values()).filter((x) => x.saldo > 0)
          .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")));
      });
    return () => { ativo = false; };
  }, [deposito]);

  // Materiais cuja quantidade pedida (somando linhas repetidas) excede o saldo do depósito
  const excedidos = useMemo(() => {
    const pedidos = new Map<string, number>();
    for (const i of itens) {
      const d = i.descricao.trim().toUpperCase();
      const q = parseFloat(i.quantidade.replace(",", ".")) || 0;
      if (!d || q <= 0) continue;
      pedidos.set(d, (pedidos.get(d) || 0) + q);
    }
    const out = new Set<string>();
    for (const [d, q] of pedidos) {
      const e = estoque.find((x) => x.descricao.toUpperCase() === d);
      if (q > (e?.saldo || 0)) out.add(d);
    }
    return out;
  }, [itens, estoque]);

  useEffect(() => {
    const o = obras.find((x) => x.id === obraId);
    if (o) {
      setEndereco(o.localizacao || "");
      setProjeto((p) => p || o.cliente);
    }
  }, [obraId, obras]);

  function setItem(i: number, k: keyof SaidaLinha, v: string) {
    setItens((prev) => prev.map((x, ix) => {
      if (ix !== i) return x;
      const nx = { ...x, [k]: v };
      if (k === "descricao") {
        const e = estoque.find((ee) => ee.descricao === v);
        const p = produtos.find((pp) => pp.descricao === v);
        if (e || p) nx.unidade = e?.unidade || p?.unidade || "UN";
      }
      return nx;
    }));
  }

  async function salvar() {
    const validos = itens.filter((i) => i.descricao.trim() && parseFloat(i.quantidade.replace(",", ".")) > 0);
    if (!validos.length) { alert("Adicione ao menos 1 material com quantidade."); return; }
    if (excedidos.size) { alert("Quantidade maior que o saldo em estoque neste depósito: " + Array.from(excedidos).join(", ")); return; }
    const projetoFinal = projeto.trim() || "USO INTERNO";
    setSalvando(true);
    setMsg("");
    try {
      const protocolo = await proximoProtocolo();
      const obra = obras.find((x) => x.id === obraId);
      const { data: saida, error: eSai } = await sb.from("compras_saidas").insert({
        protocolo, data_emissao: data, projeto: projetoFinal,
        cliente: obra?.cliente || null,
        endereco_cliente: endereco.trim() || null,
        observacoes: obs.trim() || null,
        criado_por: user?.email || null,
      }).select().single();
      if (eSai) throw new Error(eSai.message);

      const movRows = validos.map((i) => {
        const p = produtos.find((pp) => pp.descricao === i.descricao.trim() || pp.descricao === i.descricao.trim().toUpperCase());
        return {
          data, produto_codigo: p?.codigo || null, descricao: i.descricao.trim().toUpperCase(),
          tipo: "Saída", quantidade: parseFloat(i.quantidade.replace(",", ".")) || 0,
          unidade: i.unidade || "UN", valor_unitario: 0, valor_total: 0,
          documento: protocolo, fornecedor: null, projeto: projetoFinal,
          nota_id: null, saida_id: (saida as any).id, deposito,
        };
      });
      const { error: eMov } = await sb.from("compras_estoque_mov").insert(movRows);
      if (eMov) throw new Error(eMov.message);

      setMsg(`Saída registrada — protocolo ${protocolo}.`);
      imprimirProtocolo(protocolo, validos);
      setItens([{ descricao: "", quantidade: "", unidade: "UN" }]);
      setObs("");
    } catch (err: any) {
      alert("Falha ao registrar saída: " + err.message);
    } finally {
      setSalvando(false);
    }
  }

  function imprimirProtocolo(protocolo: string, its: SaidaLinha[]) {
    const obra = obras.find((x) => x.id === obraId);
    const linhas = its.map((i, ix) =>
      `<tr><td>${ix + 1}</td><td>${i.descricao.toUpperCase()}</td><td>${fmtQtd(parseFloat(i.quantidade.replace(",", ".")) || 0)}</td><td>${i.unidade}</td></tr>`).join("");
    printHtml(`Protocolo de Entrega ${protocolo}`, `
      <p class="meta"><b>Protocolo:</b> ${protocolo} &nbsp;·&nbsp; <b>Data:</b> ${fmtData(data)} &nbsp;·&nbsp; <b>Projeto:</b> ${projeto.trim() || "USO INTERNO"}</p>
      ${obra ? `<p class="meta"><b>Projeto/Cliente:</b> ${obra.cliente}${endereco ? ` — ${endereco}` : ""}</p>` : ""}
      ${obs ? `<p class="meta"><b>Observações:</b> ${obs}</p>` : ""}
      <table><thead><tr><th>#</th><th>Material</th><th>Qtd</th><th>Unid.</th></tr></thead><tbody>${linhas}</tbody></table>
      <div class="assin"><div>Liberado por (Estoque)</div><div>Recebido por</div></div>`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
      <div style={st.painel}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 190px 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label style={st.lblSt}>Data *</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={st.inpSt} /></div>
          <div><label style={st.lblSt}>Depósito de origem *</label>
            <select value={deposito} onChange={(e) => setDeposito(e.target.value as Deposito)} style={{ ...st.inpSt, appearance: "auto" as any }}>
              {DEPOSITOS.map((d) => <option key={d.id} value={d.id}>{d.label} · {d.resp}</option>)}
            </select></div>
          <div><label style={st.lblSt}>Projeto de destino</label>
            <input list="dl-projetos-s" value={projeto} onChange={(e) => setProjeto(e.target.value)} placeholder="Obra… (vazio = uso interno)" style={st.inpSt} />
            <datalist id="dl-projetos-s">{projetos.map((p) => <option key={p} value={p} />)}</datalist></div>
          <div><label style={st.lblSt}>Projeto (banco de obras)</label>
            <select value={obraId} onChange={(e) => setObraId(e.target.value)} style={{ ...st.inpSt, appearance: "auto" as any }}>
              <option value="">— sem projeto vinculado —</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente}</option>)}
            </select></div>
        </div>
        <div>
          <label style={st.lblSt}>Observações</label>
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Transportadora, motorista…" style={st.inpSt} />
        </div>
      </div>

      <div style={st.painel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent }}>Materiais</div>
          <button onClick={() => setItens((p) => [...p, { descricao: "", quantidade: "", unidade: "UN" }])} style={st.btnSec}><Plus size={12} /> Material</button>
        </div>
        {itens.map((i, ix) => {
          const d = i.descricao.trim().toUpperCase();
          const e = estoque.find((x) => x.descricao.toUpperCase() === d);
          const excede = excedidos.has(d);
          return (
            <div key={ix} style={{ marginBottom: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 34px", gap: 8, alignItems: "center" }}>
                <input list="dl-produtos-s" value={i.descricao} onChange={(e) => setItem(ix, "descricao", e.target.value)} placeholder="Material com saldo neste depósito" style={st.inpSt} />
                <input value={i.quantidade} onChange={(e) => setItem(ix, "quantidade", e.target.value)} placeholder="Qtd"
                       style={{ ...st.inpSt, ...(excede ? { borderColor: t.danger, color: t.danger, fontWeight: 700 } : {}) }} />
                <select value={i.unidade} onChange={(e) => setItem(ix, "unidade", e.target.value)} title="Unidade de medida" style={{ ...st.inpSt, appearance: "auto" as any }}>
                  {(UNIDADES.includes(i.unidade) ? UNIDADES : [i.unidade, ...UNIDADES]).map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button onClick={() => setItens((p) => p.filter((_, j) => j !== ix))} disabled={itens.length === 1}
                        style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer", opacity: itens.length === 1 ? 0.3 : 1 }}>
                  <Trash2 size={13} />
                </button>
              </div>
              {excede && (
                <div style={{ fontSize: 10.5, color: t.danger, marginTop: 3 }}>
                  Saldo disponível neste depósito: {fmtQtd(e?.saldo || 0)} {e?.unidade || i.unidade} — reduza a quantidade.
                </div>
              )}
            </div>
          );
        })}
        <datalist id="dl-produtos-s">{estoque.map((p) => <option key={p.descricao} value={p.descricao}>{`Saldo: ${fmtQtd(p.saldo)} ${p.unidade}`}</option>)}</datalist>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={salvar} disabled={salvando || excedidos.size > 0}
                style={{ ...st.btnPri, opacity: salvando || excedidos.size > 0 ? 0.5 : 1, cursor: excedidos.size > 0 ? "not-allowed" : "pointer" }}>
          {salvando ? "Registrando…" : "Registrar Saída + Protocolo"}
        </button>
        {excedidos.size > 0 && <div style={{ fontSize: 12.5, color: t.danger }}>Quantidade acima do saldo em estoque — ajuste os itens em vermelho.</div>}
        {msg && <div style={{ fontSize: 12.5, color: t.success }}>{msg}</div>}
      </div>
    </div>
  );
}

/* ─── HISTÓRICO DE SAÍDAS (relatório de todos os almoxarifados) ─────────── */
type SaidaHist = {
  id: string; protocolo: string; data_emissao: string; projeto: string;
  cliente: string | null; observacoes: string | null; criado_por: string | null;
  depositos: string[];
  itens: { descricao: string; quantidade: number; unidade: string }[];
};

function HistoricoSaidas({ st, t }: { st: St; t: any }) {
  const [rows, setRows] = useState<SaidaHist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fDep, setFDep] = useState<"" | Deposito>("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const depLabel = (d: string) => DEPOSITOS.find((x) => x.id === d)?.label || d;

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    (async () => {
      const [{ data: saidas }, { data: movs }] = await Promise.all([
        sb.from("compras_saidas").select("id,protocolo,data_emissao,projeto,cliente,observacoes,criado_por")
          .order("data_emissao", { ascending: false }).limit(500),
        sb.from("compras_estoque_mov").select("saida_id,documento,deposito,descricao,quantidade,unidade")
          .eq("tipo", "Saída").in("deposito", DEPOSITOS.map((d) => d.id)).limit(20000),
      ]);
      if (!ativo) return;
      const porId = new Map<string, any[]>();
      const porDoc = new Map<string, any[]>();
      for (const m of (movs as any[]) || []) {
        if (m.saida_id) { const a = porId.get(m.saida_id) || []; a.push(m); porId.set(m.saida_id, a); }
        else if (m.documento) { const a = porDoc.get(m.documento) || []; a.push(m); porDoc.set(m.documento, a); }
      }
      const out: SaidaHist[] = [];
      for (const s of (saidas as any[]) || []) {
        const its = porId.get(s.id) || porDoc.get(s.protocolo) || [];
        if (!its.length) continue;
        out.push({
          ...s,
          depositos: Array.from(new Set(its.map((m: any) => m.deposito).filter(Boolean))),
          itens: its.map((m: any) => ({ descricao: m.descricao, quantidade: Number(m.quantidade), unidade: m.unidade || "UN" })),
        });
      }
      setRows(out);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return rows.filter((r) => {
      if (fDep && !r.depositos.includes(fDep)) return false;
      if (de && r.data_emissao < de) return false;
      if (ate && r.data_emissao > ate) return false;
      if (!q) return true;
      return r.protocolo.toUpperCase().includes(q)
        || (r.projeto || "").toUpperCase().includes(q)
        || (r.cliente || "").toUpperCase().includes(q)
        || r.itens.some((i) => i.descricao.toUpperCase().includes(q));
    });
  }, [rows, busca, fDep, de, ate]);

  function reimprimir(r: SaidaHist) {
    const linhas = r.itens.map((i, ix) =>
      `<tr><td>${ix + 1}</td><td>${i.descricao}</td><td>${fmtQtd(i.quantidade)}</td><td>${i.unidade}</td></tr>`).join("");
    printHtml(`Protocolo de Entrega ${r.protocolo}`, `
      <p class="meta"><b>Protocolo:</b> ${r.protocolo} &nbsp;·&nbsp; <b>Data:</b> ${fmtData(r.data_emissao)} &nbsp;·&nbsp; <b>Projeto:</b> ${r.projeto}</p>
      <p class="meta"><b>Depósito:</b> ${r.depositos.map(depLabel).join(", ")}${r.cliente ? ` &nbsp;·&nbsp; <b>Cliente:</b> ${r.cliente}` : ""}</p>
      ${r.observacoes ? `<p class="meta"><b>Observações:</b> ${r.observacoes}</p>` : ""}
      <table><thead><tr><th>#</th><th>Material</th><th>Qtd</th><th>Unid.</th></tr></thead><tbody>${linhas}</tbody></table>
      <div class="assin"><div>Liberado por (Estoque)</div><div>Recebido por</div></div>`);
  }

  function imprimirRelatorio() {
    const linhas = filtradas.map((r) => r.itens.map((i, ix) => `
      <tr>${ix === 0 ? `<td rowspan="${r.itens.length}">${r.protocolo}</td><td rowspan="${r.itens.length}">${fmtData(r.data_emissao)}</td><td rowspan="${r.itens.length}">${r.depositos.map(depLabel).join(", ")}</td><td rowspan="${r.itens.length}">${r.projeto}</td>` : ""}
      <td>${i.descricao}</td><td>${fmtQtd(i.quantidade)} ${i.unidade}</td></tr>`).join("")).join("");
    const periodo = de || ate ? ` · Período: ${de ? fmtData(de) : "…"} a ${ate ? fmtData(ate) : "…"}` : "";
    printHtml("Relatório de Saídas — Almoxarifados", `
      <p class="meta"><b>Depósito:</b> ${fDep ? depLabel(fDep) : "Todos"}${periodo} &nbsp;·&nbsp; <b>Saídas:</b> ${filtradas.length}</p>
      <table><thead><tr><th>Protocolo</th><th>Data</th><th>Depósito</th><th>Projeto/Destino</th><th>Material</th><th>Qtd</th></tr></thead><tbody>${linhas}</tbody></table>`);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar protocolo, projeto, material…"
                 style={{ ...st.inpSt, paddingLeft: 30 }} />
        </div>
        <div><label style={st.lblSt}>Depósito</label>
          <select value={fDep} onChange={(e) => setFDep(e.target.value as any)} style={{ ...st.inpSt, width: 200, appearance: "auto" as any }}>
            <option value="">Todos os almoxarifados</option>
            {DEPOSITOS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select></div>
        <div><label style={st.lblSt}>De</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ ...st.inpSt, width: 140 }} /></div>
        <div><label style={st.lblSt}>Até</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ ...st.inpSt, width: 140 }} /></div>
        <button onClick={imprimirRelatorio} style={st.btnSec}><Printer size={12} /> Imprimir relatório</button>
      </div>

      <div style={{ border: `1px solid ${t.border}`, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={st.thSt}>Protocolo</th><th style={st.thSt}>Data</th><th style={st.thSt}>Depósito</th>
            <th style={st.thSt}>Projeto / Destino</th><th style={st.thSt}>Materiais</th>
            <th style={st.thSt}>Por</th><th style={{ ...st.thSt, width: 40 }} />
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ ...st.tdSt, color: t.textMuted }}>Carregando…</td></tr>}
            {!loading && !filtradas.length && <tr><td colSpan={7} style={{ ...st.tdSt, color: t.textMuted }}>Nenhuma saída encontrada.</td></tr>}
            {filtradas.map((r) => (
              <tr key={r.id}>
                <td style={{ ...st.tdSt, fontWeight: 600, whiteSpace: "nowrap" }}>{r.protocolo}</td>
                <td style={{ ...st.tdSt, whiteSpace: "nowrap" }}>{fmtData(r.data_emissao)}</td>
                <td style={st.tdSt}>{r.depositos.map(depLabel).join(", ")}</td>
                <td style={st.tdSt}>{r.projeto}{r.cliente && r.cliente !== r.projeto ? ` · ${r.cliente}` : ""}</td>
                <td style={st.tdSt}>
                  {r.itens.map((i, ix) => (
                    <div key={ix} style={{ whiteSpace: "nowrap" }}>{i.descricao} — {fmtQtd(i.quantidade)} {i.unidade}</div>
                  ))}
                </td>
                <td style={{ ...st.tdSt, color: t.textMuted, fontSize: 11 }}>{r.criado_por || "—"}</td>
                <td style={st.tdSt}>
                  <button onClick={() => reimprimir(r)} title="Reimprimir protocolo"
                          style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}>
                    <Printer size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>
        {filtradas.length} saída{filtradas.length === 1 ? "" : "s"} · últimas 500, todos os almoxarifados deste app.
      </div>
    </div>
  );
}

/* ─── IMPORTAR XML NF-e ─────────────────────────────────────────────────── */
function ImportXml({ st, t, deposito, setDeposito, produtos, projetos, onSaved }: {
  st: St; t: any; deposito: Deposito; setDeposito: (d: Deposito) => void; produtos: Produto[]; projetos: string[]; onSaved: () => void;
}) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nfe, setNfe] = useState<NfeData | null>(null);
  const [erro, setErro] = useState("");
  const [projeto, setProjeto] = useState("");
  const [processando, setProcessando] = useState(false);
  const [msg, setMsg] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErro(""); setMsg(""); setNfe(null);
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const texto = await f.text();
      setNfe(parseNfeXml(texto));
    } catch (err: any) {
      setErro(err.message || "Falha ao ler o XML.");
    }
  }

  async function processar() {
    if (!nfe) return;
    if (!projeto.trim()) { alert("Informe o projeto / centro de custo da entrada."); return; }
    setProcessando(true);
    setMsg("");
    try {
      // dedup por chave de acesso
      if (nfe.chaveAcesso) {
        const { data: dup } = await sb.from("compras_notas").select("id").eq("chave_acesso", nfe.chaveAcesso).limit(1);
        if (dup?.length) throw new Error("Esta NF-e já foi importada (chave de acesso duplicada).");
      }

      // fornecedor: upsert por CNPJ
      if (nfe.fornecedorCnpj) {
        const cnpjFmt = CNPJ_FMT(nfe.fornecedorCnpj);
        const { data: forn } = await sb.from("compras_fornecedores").select("id")
          .or(`cnpj.eq.${nfe.fornecedorCnpj},cnpj.eq.${cnpjFmt}`).limit(1);
        if (!forn?.length) {
          await sb.from("compras_fornecedores").insert({
            nome: nfe.fornecedorNome, razao_social: nfe.fornecedorNome, cnpj: cnpjFmt,
            tipo: "geral", categoria: null, avaliacao: 0, entregas: 0, atrasos: 0, valor_k: 0, ativo: true,
          });
        }
      }

      const { data: nota, error: eNota } = await sb.from("compras_notas").insert({
        tipo: "xml",
        numero_nf: nfe.numeroNf || null,
        chave_acesso: nfe.chaveAcesso || null,
        fornecedor_nome: nfe.fornecedorNome,
        fornecedor_cnpj: nfe.fornecedorCnpj ? CNPJ_FMT(nfe.fornecedorCnpj) : null,
        projeto: projeto.trim(),
        data_emissao: nfe.dataEmissao || null,
        data_entrada: hojeISO(),
        valor_total: nfe.valorTotal,
        criado_por: user?.email || null,
      }).select().single();
      if (eNota) throw new Error(eNota.message);

      const cache = [...produtos];
      const movRows = [];
      for (const i of nfe.itens) {
        const codigo = await ensureProduto(i.descricao, i.unidade, cache);
        movRows.push({
          data: hojeISO(), produto_codigo: codigo, descricao: i.descricao.trim().toUpperCase(),
          tipo: "Entrada", quantidade: i.quantidade, unidade: i.unidade,
          valor_unitario: i.valorUnitario, valor_total: i.valorTotal,
          documento: `NF ${nfe.numeroNf}`, fornecedor: nfe.fornecedorNome,
          projeto: projeto.trim(), nota_id: (nota as any).id, saida_id: null, deposito,
        });
      }
      const { error: eMov } = await sb.from("compras_estoque_mov").insert(movRows);
      if (eMov) throw new Error(eMov.message);

      const parcelas = nfe.parcelas.length
        ? nfe.parcelas
        : [{ numero: "1", vencimento: nfe.dataEmissao, valor: nfe.valorTotal }];
      const cpRows = parcelas.map((p, ix) => ({
        fornecedor: nfe.fornecedorNome,
        documento: `NF ${nfe.numeroNf}`,
        nota_id: (nota as any).id,
        parcela: ix + 1,
        data_vencimento: p.vencimento || null,
        valor: p.valor,
        forma_pagamento: null,
        status: "pendente",
        data_pagamento: null,
        projeto: projeto.trim(),
        obs: null,
      }));
      const { error: eCp } = await sb.from("compras_contas_pagar").insert(cpRows);
      if (eCp) throw new Error(eCp.message);

      setMsg(`NF ${nfe.numeroNf} integrada — ${nfe.itens.length} itens no estoque + ${parcelas.length} parcela(s) no financeiro.`);
      setNfe(null);
      if (fileRef.current) fileRef.current.value = "";
      onSaved();
    } catch (err: any) {
      alert("Falha ao integrar NF-e: " + err.message);
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
      <div style={st.painel}>
        <div style={{ display: "flex", gap: 14, alignItems: "end" }}>
          <div style={{ flex: 1 }}>
            <label style={st.lblSt}>Arquivo XML da NF-e</label>
            <input ref={fileRef} type="file" accept=".xml,text/xml" onChange={onFile} style={{ ...st.inpSt, padding: 7 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={st.lblSt}>Projeto / Centro de custo *</label>
            <input list="dl-projetos-x" value={projeto} onChange={(e) => setProjeto(e.target.value)} placeholder="Obra / setor…" style={st.inpSt} />
            <datalist id="dl-projetos-x">{projetos.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div style={{ width: 190 }}>
            <label style={st.lblSt}>Depósito *</label>
            <select value={deposito} onChange={(e) => setDeposito(e.target.value as Deposito)} style={{ ...st.inpSt, appearance: "auto" as any }}>
              {DEPOSITOS.map((d) => <option key={d.id} value={d.id}>{d.label} · {d.resp}</option>)}
            </select>
          </div>
        </div>
        {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: t.danger }}>{erro}</div>}
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: t.success }}>{msg}</div>}
      </div>

      {nfe && (
        <>
          <div style={st.painel}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent, marginBottom: 10 }}>Resumo da NF-e</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, fontSize: 12.5 }}>
              <div><div style={st.lblSt}>Fornecedor</div><div style={{ color: t.textPrimary, fontWeight: 600 }}>{nfe.fornecedorNome}</div></div>
              <div><div style={st.lblSt}>CNPJ</div><div style={{ color: t.textSecondary }}>{nfe.fornecedorCnpj ? CNPJ_FMT(nfe.fornecedorCnpj) : "—"}</div></div>
              <div><div style={st.lblSt}>NF / Emissão</div><div style={{ color: t.textSecondary }}>{nfe.numeroNf} · {fmtData(nfe.dataEmissao)}</div></div>
              <div><div style={st.lblSt}>Valor total</div><div style={{ color: t.textPrimary, fontWeight: 700 }}>{fmtBRL(nfe.valorTotal)}</div></div>
            </div>
          </div>

          <div style={st.painel}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent, marginBottom: 6 }}>
              Itens ({nfe.itens.length})
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={st.thSt}>Cód. fornecedor</th><th style={st.thSt}>Descrição</th><th style={st.thSt}>Qtd</th>
                <th style={st.thSt}>Unid.</th><th style={st.thSt}>Vlr unit.</th><th style={st.thSt}>Total</th>
              </tr></thead>
              <tbody>
                {nfe.itens.map((i, ix) => (
                  <tr key={ix}>
                    <td style={{ ...st.tdSt, color: t.textMuted }}>{i.codigo}</td>
                    <td style={{ ...st.tdSt, color: t.textPrimary }}>{i.descricao}</td>
                    <td style={st.tdSt}>{fmtQtd(i.quantidade)}</td>
                    <td style={st.tdSt}>{i.unidade}</td>
                    <td style={st.tdSt}>{fmtBRL(i.valorUnitario)}</td>
                    <td style={{ ...st.tdSt, fontWeight: 600 }}>{fmtBRL(i.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={st.painel}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent, marginBottom: 6 }}>
              Parcelas (financeiro)
            </div>
            {nfe.parcelas.length ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={st.thSt}>#</th><th style={st.thSt}>Vencimento</th><th style={st.thSt}>Valor</th></tr></thead>
                <tbody>
                  {nfe.parcelas.map((p, ix) => (
                    <tr key={ix}>
                      <td style={st.tdSt}>{p.numero}</td>
                      <td style={st.tdSt}>{fmtData(p.vencimento)}</td>
                      <td style={{ ...st.tdSt, fontWeight: 600 }}>{fmtBRL(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ fontSize: 12, color: t.textMuted }}>
                XML sem duplicatas — será criada 1 parcela única de {fmtBRL(nfe.valorTotal)} no Contas a Pagar.
              </div>
            )}
          </div>

          <button onClick={processar} disabled={processando} style={{ ...st.btnPri, alignSelf: "flex-start", opacity: processando ? 0.6 : 1 }}>
            <FileUp size={14} /> {processando ? "Integrando…" : "Processar e Integrar (estoque + financeiro)"}
          </button>
        </>
      )}
    </div>
  );
}
