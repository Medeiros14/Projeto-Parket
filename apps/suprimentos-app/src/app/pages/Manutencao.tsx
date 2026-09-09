/** Manutenção e Reparos — equipamentos com defeito + concluir reparo (volta pro estoque). */
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { CheckCircle2, Wrench, X } from "lucide-react";
import { Item, Funcionario, fetchItens, fetchFuncionarios, fmtBRL, fmtDataHora, concluirReparo, moverParaManutencao } from "../lib/suprimentos";
import Dialogo from "../components/Dialogo";

export default function Manutencao() {
  const { t } = useTheme();
  const { user } = useAuth();
  const usuario = user?.email || null;

  const [itens, setItens] = useState<Item[]>([]);
  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [addAberto, setAddAberto] = useState(false);
  const [addBusca, setAddBusca] = useState("");
  const [addSel, setAddSel] = useState<Item | null>(null);
  const [addMotivo, setAddMotivo] = useState("");
  const [addRodando, setAddRodando] = useState(false);
  const [addErro, setAddErro] = useState("");

  async function load() {
    const [i, f] = await Promise.all([fetchItens(), fetchFuncionarios()]);
    setItens(i); setFuncs(f); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const funcById = useMemo(() => Object.fromEntries(funcs.map((f) => [f.id, f])), [funcs]);

  const manutencao = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((i) => i.status === "manutencao")
      .filter((i) => !q ||
        i.descricao.toLowerCase().includes(q) ||
        (i.marca || "").toLowerCase().includes(q) ||
        (i.serie || "").toLowerCase().includes(q) ||
        (i.manut_motivo || "").toLowerCase().includes(q));
  }, [itens, busca]);

  const total = manutencao.reduce((s, i) => s + (i.valor || 0), 0);
  const selecionados = manutencao.filter((i) => sel.has(i.id));

  function toggle(id: string) {
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSel((p) => p.size === manutencao.length ? new Set() : new Set(manutencao.map((i) => i.id)));
  }

  async function concluir() {
    await concluirReparo(selecionados, usuario);
    setSel(new Set());
    await load();
  }

  const candidatos = useMemo(() => {
    const q = addBusca.trim().toLowerCase();
    return itens
      .filter((i) => i.status === "estoque" || i.status === "uso")
      .filter((i) => !q ||
        i.descricao.toLowerCase().includes(q) ||
        (i.marca || "").toLowerCase().includes(q) ||
        (i.serie || "").toLowerCase().includes(q) ||
        (i.funcionario_id && (funcById[i.funcionario_id]?.nome || "").toLowerCase().includes(q)))
      .slice(0, 60);
  }, [itens, addBusca, funcById]);

  function fecharAdd() {
    setAddAberto(false); setAddBusca(""); setAddSel(null); setAddMotivo(""); setAddErro("");
  }

  async function enviarParaManutencao() {
    if (!addSel) return;
    setAddRodando(true); setAddErro("");
    try {
      const f = addSel.funcionario_id ? funcById[addSel.funcionario_id] : null;
      await moverParaManutencao(addSel, addMotivo.trim() || "Sem motivo informado", f?.nome || null, usuario);
      fecharAdd();
      await load();
    } catch (e: any) {
      setAddErro("Falha: " + (e?.message || e));
    } finally {
      setAddRodando(false);
    }
  }

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>;

  const thSt: React.CSSProperties = {
    textAlign: "left", padding: "8px 12px", color: t.textMuted,
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: `1px solid ${t.border}`,
  };
  const tdSt: React.CSSProperties = { padding: "9px 12px", borderBottom: `1px solid ${t.border}`, fontSize: 12.5 };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Manutenção e Reparos</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {manutencao.length} item(ns) · total <span style={{ color: t.warning, fontWeight: 600 }}>{fmtBRL(total)}</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar equipamento ou motivo…"
               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, padding: "9px 12px", fontSize: 13, borderRadius: 0, outline: "none", width: 300 }} />
        <button onClick={() => setAddAberto(true)} style={{
          background: "transparent", color: t.warning, border: `1px solid ${t.warning}`,
          padding: "9px 16px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <Wrench size={13} /> Enviar pra manutenção
        </button>
        <button onClick={() => setConfirmando(true)} disabled={selecionados.length === 0} style={{
          background: selecionados.length ? t.warning : t.inputBg, color: selecionados.length ? "#241800" : t.textMuted,
          border: "none", padding: "9px 16px", fontWeight: 600, fontSize: 12.5,
          cursor: selecionados.length ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6,
        }}>
          <CheckCircle2 size={13} /> Concluir Reparo ({selecionados.length})
        </button>
      </header>

      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thSt, width: 34 }}>
              <input type="checkbox" checked={manutencao.length > 0 && sel.size === manutencao.length} onChange={toggleAll} style={{ accentColor: t.accent, cursor: "pointer" }} />
            </th>
            <th style={thSt}>Equipamento com defeito</th>
            <th style={thSt}>Motivo</th>
            <th style={thSt}>Data do reporte</th>
            <th style={{ ...thSt, textAlign: "right" }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {manutencao.map((i) => (
            <tr key={i.id}>
              <td style={tdSt}>
                <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} style={{ accentColor: t.accent, cursor: "pointer" }} />
              </td>
              <td style={tdSt}>
                <div style={{ color: t.textPrimary, fontWeight: 600 }}>
                  {i.descricao}
                  {i.novo && <span style={{ fontSize: 9, fontWeight: 700, color: t.success, border: `1px solid ${t.success}`, padding: "1px 5px", marginLeft: 6, verticalAlign: "middle" }}>NOVO</span>}
                </div>
                <div style={{ fontSize: 10.5, color: t.textMuted }}>
                  {[i.marca, i.serie ? `Série ${i.serie}` : null].filter(Boolean).join(" · ") || "—"}
                </div>
              </td>
              <td style={{ ...tdSt, color: t.warning }}>{i.manut_motivo || "—"}</td>
              <td style={{ ...tdSt, color: t.textSecondary }}>{fmtDataHora(i.manut_data)}</td>
              <td style={{ ...tdSt, textAlign: "right", color: t.textPrimary }}>{fmtBRL(i.valor)}</td>
            </tr>
          ))}
          {manutencao.length === 0 && (
            <tr><td colSpan={5} style={{ ...tdSt, textAlign: "center", color: t.textMuted, padding: 40 }}>Nenhum equipamento em manutenção.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {confirmando && (
        <Dialogo titulo="Concluir reparo" cor={t.warning} confirmLabel="Concluir reparo"
                 mensagem={`Concluir reparo de ${selecionados.length} item(ns)? Eles voltam pro estoque.`}
                 onConfirm={concluir} onClose={() => setConfirmando(false)} />
      )}

      {addAberto && (
        <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 120, display: "grid", placeItems: "center" }}>
          <div style={{
            width: 480, maxHeight: "86vh", background: t.modalBg, border: `1px solid ${t.borderStrong}`,
            padding: 22, display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.warning }}>Enviar máquina pra manutenção</div>
              <button onClick={fecharAdd} style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>
            <input autoFocus value={addBusca} onChange={(e) => { setAddBusca(e.target.value); setAddSel(null); }}
                   placeholder="Buscar máquina pelo nome, marca, série ou funcionário…"
                   style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, padding: "9px 12px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%" }} />
            <div style={{ border: `1px solid ${t.border}`, maxHeight: 240, overflowY: "auto" }}>
              {candidatos.map((i) => {
                const f = i.funcionario_id ? funcById[i.funcionario_id] : null;
                const ativo = addSel?.id === i.id;
                return (
                  <div key={i.id} onClick={() => setAddSel(i)} style={{
                    padding: "9px 12px", borderBottom: `1px solid ${t.border}`, cursor: "pointer",
                    background: ativo ? t.inputBg : "transparent",
                    borderLeft: ativo ? `3px solid ${t.warning}` : "3px solid transparent",
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: t.textPrimary }}>{i.descricao}</div>
                    <div style={{ fontSize: 10.5, color: t.textMuted }}>
                      {[i.marca, i.serie ? `Série ${i.serie}` : null,
                        i.status === "uso" ? `Em uso — ${f?.nome || "?"}` : "Estoque"].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                );
              })}
              {candidatos.length === 0 && (
                <div style={{ fontSize: 12, color: t.textMuted, textAlign: "center", padding: 24 }}>Nenhuma máquina encontrada.</div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textSecondary, marginBottom: 4, display: "block" }}>Motivo do defeito</label>
              <input value={addMotivo} onChange={(e) => setAddMotivo(e.target.value)} placeholder="Ex: motor queimado"
                     onKeyDown={(e) => { if (e.key === "Enter" && addSel && !addRodando) enviarParaManutencao(); }}
                     style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, padding: "9px 12px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%" }} />
            </div>
            {addErro && <div style={{ fontSize: 12, color: t.danger }}>{addErro}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={fecharAdd} style={{
                flex: 1, background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`,
                padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
              }}>
                Cancelar
              </button>
              <button disabled={!addSel || addRodando} onClick={enviarParaManutencao} style={{
                flex: 1, background: addSel ? t.warning : t.inputBg, color: addSel ? "#241800" : t.textMuted,
                border: "none", padding: "10px 14px", fontWeight: 600, fontSize: 12.5,
                cursor: addSel ? "pointer" : "default", opacity: addRodando ? 0.6 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Wrench size={13} /> {addRodando ? "Enviando…" : addSel ? `Enviar "${addSel.descricao.slice(0, 24)}${addSel.descricao.length > 24 ? "…" : ""}"` : "Selecione a máquina"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
