/** Entrada / Baixas — cadastrar ferramenta nova e dar baixa em patrimônio. */
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { Plus, Trash2 } from "lucide-react";
import { Item, fetchItens, fmtBRL, adicionarFerramenta, darBaixa } from "../lib/suprimentos";

const MOTIVOS_BAIXA = ["Extravio", "Roubo", "Descarte por defeito permanente"];

export default function Entrada() {
  const { t } = useTheme();
  const { user } = useAuth();
  const usuario = user?.email || null;

  const [itens, setItens] = useState<Item[]>([]);
  const [form, setForm] = useState({ descricao: "", marca: "", serie: "", valor: "", qtd: "1" });
  const [salvando, setSalvando] = useState(false);
  const [buscaBaixa, setBuscaBaixa] = useState("");
  const [baixando, setBaixando] = useState<Item | null>(null);
  const [motivoBaixa, setMotivoBaixa] = useState(MOTIVOS_BAIXA[0]);

  async function load() { setItens(await fetchItens()); }
  useEffect(() => { load(); }, []);

  const candidatosBaixa = useMemo(() => {
    const q = buscaBaixa.trim().toLowerCase();
    if (!q) return [];
    return itens.filter((i) =>
      i.descricao.toLowerCase().includes(q) ||
      (i.marca || "").toLowerCase().includes(q) ||
      (i.serie || "").toLowerCase().includes(q)
    ).slice(0, 30);
  }, [itens, buscaBaixa]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim()) return;
    const qtd = Math.max(1, parseInt(form.qtd) || 1);
    setSalvando(true);
    try {
      await adicionarFerramenta({
        descricao: form.descricao.trim(),
        marca: form.marca.trim(),
        serie: form.serie.trim(),
        valor: parseFloat(form.valor.replace(",", ".")) || 0,
        qtd,
      }, usuario);
      setForm({ descricao: "", marca: "", serie: "", valor: "", qtd: "1" });
      await load();
      alert(`${qtd} item(ns) registrado(s) no estoque.`);
    } catch (err: any) {
      alert("Falha: " + (err?.message || err));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarBaixa() {
    if (!baixando) return;
    try {
      await darBaixa(baixando, motivoBaixa, usuario);
      setBaixando(null);
      setBuscaBaixa("");
      await load();
    } catch (err: any) {
      alert("Falha: " + (err?.message || err));
    }
  }

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%",
  };
  const lbl: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textSecondary, marginBottom: 4, display: "block" };
  const card: React.CSSProperties = { background: t.cardBg, border: `1px solid ${t.border}`, padding: 20 };
  const statusLabel: Record<string, string> = { estoque: "Estoque", uso: "Em uso", manutencao: "Manutenção" };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Cadastro e Baixas</h1>
        <div style={{ fontSize: 12, color: t.textMuted }}>Entrada de ferramentas e baixa de patrimônio</div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
        <form onSubmit={registrar} style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: t.textPrimary }}>Adicionar ferramenta (entrada)</h2>
          <p style={{ fontSize: 11.5, color: t.textMuted, margin: "0 0 14px" }}>O item entra automaticamente em Estoque.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={lbl}>Descrição do equipamento *</label>
              <input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} required placeholder="Ex: Furadeira de Impacto Makita" style={inp} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Nº de série</label>
                <input value={form.serie} onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))} placeholder="Ex: 12345678" style={inp} />
              </div>
              <div>
                <label style={lbl}>Marca</label>
                <input value={form.marca} onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))} placeholder="Ex: Makita" style={inp} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Valor estimado (R$)</label>
                <input value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} type="text" inputMode="decimal" placeholder="0,00" style={inp} />
              </div>
              <div>
                <label style={lbl}>Quantidade</label>
                <input value={form.qtd} onChange={(e) => setForm((f) => ({ ...f, qtd: e.target.value }))} type="number" min={1} step={1} style={inp} />
              </div>
            </div>
            <button disabled={salvando} type="submit" style={{
              background: t.success, color: "#08240f", border: "none", padding: "11px 16px",
              fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 6, opacity: salvando ? 0.6 : 1,
            }}>
              <Plus size={14} /> {salvando ? "Registrando…" : "Registrar entrada no estoque"}
            </button>
          </div>
        </form>

        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: t.danger }}>Dar baixa em patrimônio (saída)</h2>
          <p style={{ fontSize: 11.5, color: t.textMuted, margin: "0 0 14px" }}>
            Pra casos de extravio, roubo ou descarte por defeito permanente. Some do sistema, mas fica na auditoria.
          </p>
          <input value={buscaBaixa} onChange={(e) => setBuscaBaixa(e.target.value)} placeholder="Buscar ferramenta pra dar baixa…" style={{ ...inp, marginBottom: 10 }} />
          <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {candidatosBaixa.map((i) => (
              <div key={i.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "10px 12px", background: t.inputBg, border: `1px solid ${t.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.textPrimary }}>{i.descricao}</div>
                  <div style={{ fontSize: 10.5, color: t.textMuted }}>
                    {[statusLabel[i.status], i.marca, i.serie ? `Série ${i.serie}` : null, fmtBRL(i.valor)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <button onClick={() => setBaixando(i)} title="Dar baixa" style={{
                  background: "transparent", border: `1px solid ${t.danger}`, color: t.danger,
                  width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {buscaBaixa.trim() && candidatosBaixa.length === 0 && (
              <div style={{ fontSize: 12, color: t.textMuted, padding: 16, textAlign: "center" }}>Nada encontrado.</div>
            )}
            {!buscaBaixa.trim() && (
              <div style={{ fontSize: 12, color: t.textMuted, padding: 16, textAlign: "center" }}>Digite pra buscar o item.</div>
            )}
          </div>
        </div>
      </div>

      {baixando && (
        <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 100, display: "grid", placeItems: "center" }}>
          <div style={{ width: 400, background: t.modalBg, border: `1px solid ${t.borderStrong}`, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.danger }}>Confirmar baixa</div>
            <div style={{ fontSize: 12.5, color: t.textPrimary }}>
              {baixando.descricao}
              <span style={{ color: t.textMuted }}> {baixando.serie ? `· Série ${baixando.serie}` : ""} · {fmtBRL(baixando.valor)}</span>
            </div>
            <div>
              <label style={lbl}>Motivo</label>
              <select value={motivoBaixa} onChange={(e) => setMotivoBaixa(e.target.value)} style={inp}>
                {MOTIVOS_BAIXA.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBaixando(null)} style={{
                flex: 1, background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`,
                padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
              }}>
                Cancelar
              </button>
              <button onClick={confirmarBaixa} style={{
                flex: 1, background: t.danger, color: "#fff", border: "none",
                padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
              }}>
                Dar baixa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
