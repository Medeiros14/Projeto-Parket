/** Estoque (Almoxarifado) — seleção múltipla + empréstimo com termo numerado. */
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { ArrowRight, Wrench, Pencil } from "lucide-react";
import {
  Item, Funcionario, fetchItens, fetchFuncionarios, fmtBRL,
  emprestarItens, moverParaManutencao, proximoTermo,
} from "../lib/suprimentos";
import TermoModal, { TermoGrupo } from "../components/TermoModal";
import EditarItemModal from "../components/EditarItemModal";
import Dialogo from "../components/Dialogo";

export default function Estoque() {
  const { t } = useTheme();
  const { user } = useAuth();
  const usuario = user?.email || null;

  const [itens, setItens] = useState<Item[]>([]);
  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [funcId, setFuncId] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [termo, setTermo] = useState<{ grupos: TermoGrupo[]; numero: string; func: Funcionario } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);
  const [manutItem, setManutItem] = useState<Item | null>(null);
  const [avisoFunc, setAvisoFunc] = useState(false);

  async function load() {
    const [i, f] = await Promise.all([fetchItens(), fetchFuncionarios()]);
    setItens(i); setFuncs(f); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const estoque = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((i) => i.status === "estoque")
      .filter((i) => !q ||
        i.descricao.toLowerCase().includes(q) ||
        (i.marca || "").toLowerCase().includes(q) ||
        (i.serie || "").toLowerCase().includes(q));
  }, [itens, busca]);

  const total = estoque.reduce((s, i) => s + (i.valor || 0), 0);

  // A seleção NÃO depende da busca: quem marca ferramenta a ferramenta filtrando o campo
  // de busca continua acumulando tudo num termo só. Sem isso o termo saía com o último item.
  const selecionados = useMemo(
    () => itens.filter((i) => i.status === "estoque" && sel.has(i.id)),
    [itens, sel]
  );
  const idsVisiveis = useMemo(() => new Set(estoque.map((i) => i.id)), [estoque]);
  const selOcultos = selecionados.filter((i) => !idsVisiveis.has(i.id)).length;
  const todosVisiveisMarcados = estoque.length > 0 && estoque.every((i) => sel.has(i.id));

  function toggle(id: string) {
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  // Marca/desmarca só o que está visível no filtro atual, preservando o resto da seleção.
  function toggleAll() {
    setSel((p) => {
      const n = new Set(p);
      estoque.forEach((i) => (todosVisiveisMarcados ? n.delete(i.id) : n.add(i.id)));
      return n;
    });
  }

  async function abrirEmprestimo() {
    if (!funcId) { setAvisoFunc(true); return; }
    if (selecionados.length === 0) return;
    const func = funcs.find((f) => f.id === funcId)!;
    setGerando(true);
    try {
      const numero = await proximoTermo();
      setTermo({
        numero, func,
        grupos: [{
          numero, funcionarioNome: func.nome, cpf: func.cpf, empresa: func.empresa,
          itens: selecionados.map((i) => ({ descricao: i.descricao, marca: i.marca, serie: i.serie, valor: i.valor })),
        }],
      });
    } catch (e: any) {
      alert("Erro ao gerar número do termo: " + (e?.message || e));
    } finally {
      setGerando(false);
    }
  }

  async function confirmarEmprestimo() {
    if (!termo) return;
    await emprestarItens(selecionados.map((i) => i.id), termo.func, termo.numero, usuario);
    setSel(new Set());
    await load();
  }

  async function paraManutencao(i: Item, motivo: string) {
    await moverParaManutencao(i, motivo.trim() || "Sem motivo informado", null, usuario);
    await load();
  }

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>;

  const thSt: React.CSSProperties = {
    textAlign: "left", padding: "8px 12px", color: t.textMuted,
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: `1px solid ${t.border}`,
  };
  const tdSt: React.CSSProperties = { padding: "9px 12px", borderBottom: `1px solid ${t.border}`, fontSize: 12.5 };
  const rowBtn = (cor: string): React.CSSProperties => ({
    background: "transparent", border: `1px solid ${t.border}`, color: cor,
    width: 26, height: 26, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
  });

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Estoque (Almoxarifado)</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {estoque.length} item(ns) · total <span style={{ color: t.success, fontWeight: 600 }}>{fmtBRL(total)}</span>
          </div>
        </div>
        {/* Contador de seleção: deixa claro que o que foi marcado antes da busca continua no termo. */}
        {selecionados.length > 0 && (
          <div style={{ fontSize: 11.5, color: t.textSecondary, border: `1px solid ${t.border}`, padding: "5px 10px" }}>
            {selecionados.length} selecionado(s)
            {selOcultos > 0 ? ` · ${selOcultos} fora da busca` : ""}
            <button onClick={() => setSel(new Set())} style={{
              marginLeft: 8, background: "transparent", border: "none", color: t.textMuted,
              fontSize: 11.5, cursor: "pointer", textDecoration: "underline",
            }}>limpar</button>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <select value={funcId} onChange={(e) => setFuncId(e.target.value)} style={{
          background: t.inputBg, border: `1px solid ${t.border}`, color: funcId ? t.textPrimary : t.textMuted,
          padding: "9px 12px", fontSize: 13, borderRadius: 0, outline: "none", minWidth: 240,
        }}>
          <option value="">— 1º passo: selecione o funcionário —</option>
          {funcs.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.empresa ? ` · ${f.empresa}` : ""}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ferramenta, série ou marca…"
               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, padding: "9px 12px", fontSize: 13, borderRadius: 0, outline: "none", width: 260 }} />
        <button onClick={abrirEmprestimo} disabled={gerando || selecionados.length === 0} style={{
          background: selecionados.length ? t.accent : t.inputBg, color: selecionados.length ? t.bg : t.textMuted,
          border: "none", padding: "9px 16px", fontWeight: 600, fontSize: 12.5,
          cursor: selecionados.length ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6,
          opacity: gerando ? 0.6 : 1,
        }}>
          <ArrowRight size={13} /> {gerando ? "Gerando termo…" : `Empréstimo (${selecionados.length})`}
        </button>
      </header>

      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thSt, width: 34 }}>
              <input type="checkbox" checked={todosVisiveisMarcados} onChange={toggleAll} style={{ accentColor: t.accent, cursor: "pointer" }} />
            </th>
            <th style={thSt}>Descrição</th>
            <th style={thSt}>Marca / Série</th>
            <th style={{ ...thSt, textAlign: "right" }}>Valor estimado</th>
            <th style={{ ...thSt, width: 80 }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {estoque.map((i) => (
            <tr key={i.id}>
              <td style={tdSt}>
                <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} style={{ accentColor: t.accent, cursor: "pointer" }} />
              </td>
              <td style={{ ...tdSt, color: t.textPrimary, fontWeight: 600 }}>
                {i.descricao}
                {i.novo && <span style={{ fontSize: 9, fontWeight: 700, color: t.success, border: `1px solid ${t.success}`, padding: "1px 5px", marginLeft: 6, verticalAlign: "middle" }}>NOVO</span>}
              </td>
              <td style={{ ...tdSt, color: t.textSecondary }}>
                {[i.marca, i.serie ? `Série ${i.serie}` : null].filter(Boolean).join(" · ") || "—"}
              </td>
              <td style={{ ...tdSt, textAlign: "right", color: t.textPrimary }}>{fmtBRL(i.valor)}</td>
              <td style={tdSt}>
                <div style={{ display: "flex", gap: 5 }}>
                  <button title="Mover pra manutenção" onClick={() => setManutItem(i)} style={rowBtn(t.warning)}><Wrench size={12} /></button>
                  <button title="Editar" onClick={() => setEditando(i)} style={rowBtn(t.info)}><Pencil size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
          {estoque.length === 0 && (
            <tr><td colSpan={5} style={{ ...tdSt, textAlign: "center", color: t.textMuted, padding: 40 }}>Estoque vazio.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {termo && (
        <TermoModal tipo="emprestimo" grupos={termo.grupos}
                    onConfirm={confirmarEmprestimo}
                    onClose={() => setTermo(null)} />
      )}
      {editando && (
        <EditarItemModal item={editando} usuario={usuario}
                         onSaved={() => { setEditando(null); load(); }}
                         onClose={() => setEditando(null)} />
      )}
      {manutItem && (
        <Dialogo titulo="Mover pra manutenção" cor={t.warning} confirmLabel="Mover"
                 mensagem={manutItem.descricao}
                 input={{ label: "Motivo do defeito", placeholder: "Ex: motor queimado" }}
                 onConfirm={(motivo) => paraManutencao(manutItem, motivo)}
                 onClose={() => setManutItem(null)} />
      )}
      {avisoFunc && (
        <Dialogo titulo="Selecione o funcionário" aviso
                 mensagem="Escolha o funcionário no 1º passo (lista no topo) antes de gerar o empréstimo."
                 onClose={() => setAvisoFunc(false)} />
      )}
    </div>
  );
}
