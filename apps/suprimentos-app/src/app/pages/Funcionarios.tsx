/** Gestão de Funcionários — cadastro usado nos termos de empréstimo/devolução. */
import { useEffect, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { UserPlus, Pencil, Trash2 } from "lucide-react";
import { sb } from "../lib/supabase";
import { tbl } from "../lib/filial";
import { Funcionario, fetchFuncionarios, fmtData, logMov } from "../lib/suprimentos";
import Dialogo from "../components/Dialogo";

const VAZIO = { nome: "", empresa: "", cpf: "", nascimento: "", telefone: "" };

export default function Funcionarios() {
  const { t } = useTheme();
  const { user } = useAuth();
  const usuario = user?.email || null;

  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<Funcionario | null>(null);

  async function load() {
    setFuncs(await fetchFuncionarios());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvando(true);
    const dados = {
      nome: form.nome.trim(),
      empresa: form.empresa.trim() || null,
      cpf: form.cpf.trim() || null,
      nascimento: form.nascimento || null,
      telefone: form.telefone.trim() || null,
    };
    try {
      if (editandoId) {
        const { error } = await sb.from(tbl("funcionarios"))
          .update({ ...dados, updated_at: new Date().toISOString() }).eq("id", editandoId);
        if (error) throw error;
      } else {
        const { error } = await sb.from(tbl("funcionarios")).insert(dados);
        if (error) throw error;
      }
      setForm(VAZIO); setEditandoId(null);
      await load();
    } catch (err: any) {
      alert("Falha: " + (err?.message || err));
    } finally {
      setSalvando(false);
    }
  }

  function editar(f: Funcionario) {
    setEditandoId(f.id);
    setForm({
      nome: f.nome, empresa: f.empresa || "", cpf: f.cpf || "",
      nascimento: f.nascimento || "", telefone: f.telefone || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remover(f: Funcionario) {
    const { error } = await sb.from(tbl("funcionarios"))
      .update({ ativo: false, updated_at: new Date().toISOString() }).eq("id", f.id);
    if (error) throw error;
    await logMov({ tipo: "remocao_funcionario", funcionario_id: f.id, funcionario_nome: f.nome, usuario });
    await load();
  }

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>;

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%",
  };
  const lbl: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textSecondary, marginBottom: 4, display: "block" };
  const card: React.CSSProperties = { background: t.cardBg, border: `1px solid ${t.border}`, padding: 20 };
  const rowBtn = (cor: string): React.CSSProperties => ({
    background: "transparent", border: `1px solid ${t.border}`, color: cor,
    width: 26, height: 26, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  });

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Gestão de Funcionários</h1>
        <div style={{ fontSize: 12, color: t.textMuted }}>{funcs.length} funcionário(s) ativo(s)</div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
        <form onSubmit={salvar} style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 14px", color: t.textPrimary }}>
            {editandoId ? "Editar funcionário" : "Adicionar funcionário"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={lbl}>Nome completo *</label>
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required placeholder="Ex: José da Silva" style={inp} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Empresa</label>
                <input value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} placeholder="Ex: Parket" style={inp} />
              </div>
              <div>
                <label style={lbl}>CPF</label>
                <input value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" style={inp} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Data de nascimento</label>
                <input value={form.nascimento} onChange={(e) => setForm((f) => ({ ...f, nascimento: e.target.value }))} type="date" style={inp} />
              </div>
              <div>
                <label style={lbl}>Telefone</label>
                <input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} type="tel" placeholder="(11) 90000-0000" style={inp} />
              </div>
            </div>
            <button disabled={salvando} type="submit" style={{
              background: t.accent, color: t.bg, border: "none", padding: "11px 16px",
              fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 6, opacity: salvando ? 0.6 : 1,
            }}>
              <UserPlus size={14} /> {salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Adicionar à lista"}
            </button>
            {editandoId && (
              <button type="button" onClick={() => { setEditandoId(null); setForm(VAZIO); }} style={{
                background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`,
                padding: "9px 16px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
              }}>
                Cancelar edição
              </button>
            )}
            <p style={{ fontSize: 11, color: t.textMuted, margin: 0 }}>
              Só o nome é obrigatório. Os demais campos aparecem nos termos de empréstimo/devolução.
              Remover um funcionário não apaga o histórico — só tira da lista pra novos empréstimos.
            </p>
          </div>
        </form>

        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 14px", color: t.textPrimary }}>Funcionários cadastrados</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
            {funcs.map((f) => (
              <div key={f.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "10px 12px", background: t.inputBg, border: `1px solid ${t.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.textPrimary }}>{f.nome}</div>
                  <div style={{ fontSize: 10.5, color: t.textMuted }}>
                    {[f.empresa, f.cpf, f.telefone, f.nascimento ? `Nasc. ${fmtData(f.nascimento)}` : null].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button title="Editar" onClick={() => editar(f)} style={rowBtn(t.info)}><Pencil size={12} /></button>
                  <button title="Remover" onClick={() => setRemovendo(f)} style={rowBtn(t.danger)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
            {funcs.length === 0 && <div style={{ fontSize: 12, color: t.textMuted, textAlign: "center", padding: 30 }}>Nenhum funcionário cadastrado.</div>}
          </div>
        </div>
      </div>

      {removendo && (
        <Dialogo titulo="Remover funcionário" cor={t.danger} confirmLabel="Remover"
                 mensagem={`Remover "${removendo.nome}" da lista? O histórico de movimentações é preservado.`}
                 onConfirm={() => remover(removendo)} onClose={() => setRemovendo(null)} />
      )}
    </div>
  );
}
