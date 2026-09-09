/** Em Uso (Rua) — ferramentas emprestadas, com devolução via termo. */
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { Undo2, Wrench, Pencil } from "lucide-react";
import {
  Item, Funcionario, fetchItens, fetchFuncionarios, fmtBRL, fmtDataHora, diasDesde,
  devolverItens, moverParaManutencao, proximoTermo, DevolucaoTermoInput,
} from "../lib/suprimentos";
import TermoModal, { TermoGrupo } from "../components/TermoModal";
import EditarItemModal from "../components/EditarItemModal";
import Dialogo from "../components/Dialogo";

export default function EmUso() {
  const { t } = useTheme();
  const { user } = useAuth();
  const usuario = user?.email || null;

  const [itens, setItens] = useState<Item[]>([]);
  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [termoGrupos, setTermoGrupos] = useState<TermoGrupo[] | null>(null);
  const [termosNovos, setTermosNovos] = useState<DevolucaoTermoInput[]>([]);
  const [gerando, setGerando] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);
  const [manutItem, setManutItem] = useState<Item | null>(null);

  async function load() {
    const [i, f] = await Promise.all([fetchItens(), fetchFuncionarios()]);
    setItens(i); setFuncs(f); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const funcById = useMemo(() => Object.fromEntries(funcs.map((f) => [f.id, f])), [funcs]);
  const emUso = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((i) => i.status === "uso")
      .filter((i) => !q ||
        i.descricao.toLowerCase().includes(q) ||
        (i.marca || "").toLowerCase().includes(q) ||
        (i.serie || "").toLowerCase().includes(q) ||
        (i.funcionario_id && (funcById[i.funcionario_id]?.nome || "").toLowerCase().includes(q)));
  }, [itens, busca, funcById]);

  const total = emUso.reduce((s, i) => s + (i.valor || 0), 0);

  // Igual ao Estoque: a busca filtra só o que aparece, nunca o que já foi marcado pra devolver.
  const selecionados = useMemo(
    () => itens.filter((i) => i.status === "uso" && sel.has(i.id)),
    [itens, sel]
  );
  const idsVisiveis = useMemo(() => new Set(emUso.map((i) => i.id)), [emUso]);
  const selOcultos = selecionados.filter((i) => !idsVisiveis.has(i.id)).length;
  const todosVisiveisMarcados = emUso.length > 0 && emUso.every((i) => sel.has(i.id));

  function toggle(id: string) {
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSel((p) => {
      const n = new Set(p);
      emUso.forEach((i) => (todosVisiveisMarcados ? n.delete(i.id) : n.add(i.id)));
      return n;
    });
  }

  async function abrirDevolucao() {
    if (selecionados.length === 0) return;
    setGerando(true);
    try {
      // Agrupa SÓ por funcionário: tudo que a pessoa está devolvendo agora sai num único termo,
      // mesmo que os itens tenham vindo de empréstimos (Nº CONTROLE) diferentes.
      type Bucket = { func: Funcionario | null; termosOrigem: string[]; itens: Item[] };
      const buckets: Record<string, Bucket> = {};
      selecionados.forEach((i) => {
        const f = i.funcionario_id ? funcById[i.funcionario_id] : null;
        const chave = i.funcionario_id || "";
        const b = (buckets[chave] = buckets[chave] || { func: f, termosOrigem: [], itens: [] });
        b.itens.push(i);
        if (i.termo && !b.termosOrigem.includes(i.termo)) b.termosOrigem.push(i.termo);
      });
      const grupos: TermoGrupo[] = [];
      const novos: DevolucaoTermoInput[] = [];
      for (const b of Object.values(buckets)) {
        const numero = await proximoTermo();
        // Rastreabilidade: todos os empréstimos que este termo de devolução encerra.
        const referenteA = b.termosOrigem.length ? b.termosOrigem.join(", ") : null;
        grupos.push({
          numero, referenteA,
          funcionarioNome: b.func?.nome || "Não identificado",
          cpf: b.func?.cpf || null,
          empresa: b.func?.empresa || null,
          itens: b.itens.map((i) => ({ descricao: i.descricao, marca: i.marca, serie: i.serie, valor: i.valor })),
        });
        novos.push({
          numero, referenteA,
          funcionarioId: b.func?.id || null,
          funcionarioNome: b.func?.nome || "Não identificado",
          itensIds: b.itens.map((i) => i.id),
        });
      }
      setTermoGrupos(grupos);
      setTermosNovos(novos);
    } catch (e: any) {
      alert("Erro ao gerar número da devolução: " + (e?.message || e));
    } finally {
      setGerando(false);
    }
  }

  async function confirmarDevolucao() {
    const nomes = Object.fromEntries(funcs.map((f) => [f.id, f.nome]));
    await devolverItens(selecionados, nomes, usuario, termosNovos);
    setSel(new Set());
    setTermosNovos([]);
    await load();
  }

  async function paraManutencao(i: Item, motivo: string) {
    const f = i.funcionario_id ? funcById[i.funcionario_id] : null;
    await moverParaManutencao(i, motivo.trim() || "Sem motivo informado", f?.nome || null, usuario);
    await load();
  }

  function badgeDias(dias: number) {
    const cor = dias >= 30 ? t.danger : dias >= 10 ? t.warning : t.textMuted;
    return (
      <span style={{ fontSize: 10, fontWeight: 700, color: cor, border: `1px solid ${cor}`, padding: "1px 6px", marginLeft: 6 }}>
        {dias}d
      </span>
    );
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
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Em Uso (Rua)</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {emUso.length} item(ns) · total <span style={{ color: t.success, fontWeight: 600 }}>{fmtBRL(total)}</span>
          </div>
        </div>
        {/* Contador de seleção: o que foi marcado antes da busca continua entrando na devolução. */}
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
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ferramenta, série, marca ou funcionário…"
               style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, padding: "9px 12px", fontSize: 13, borderRadius: 0, outline: "none", width: 320 }} />
        <button onClick={abrirDevolucao} disabled={gerando || selecionados.length === 0} style={{
          background: selecionados.length ? t.success : t.inputBg, color: selecionados.length ? "#08240f" : t.textMuted,
          border: "none", padding: "9px 16px", fontWeight: 600, fontSize: 12.5,
          cursor: selecionados.length ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6,
          opacity: gerando ? 0.6 : 1,
        }}>
          <Undo2 size={13} /> {gerando ? "Gerando termo…" : `Devolução (${selecionados.length})`}
        </button>
      </header>

      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thSt, width: 34 }}>
              <input type="checkbox" checked={todosVisiveisMarcados} onChange={toggleAll} style={{ accentColor: t.accent, cursor: "pointer" }} />
            </th>
            <th style={thSt}>Funcionário</th>
            <th style={thSt}>Ferramenta</th>
            <th style={thSt}>Termo / Empresa</th>
            <th style={thSt}>Empréstimo</th>
            <th style={{ ...thSt, textAlign: "right" }}>Valor</th>
            <th style={{ ...thSt, width: 80 }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {emUso.map((i) => {
            const f = i.funcionario_id ? funcById[i.funcionario_id] : null;
            return (
              <tr key={i.id}>
                <td style={tdSt}>
                  <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} style={{ accentColor: t.accent, cursor: "pointer" }} />
                </td>
                <td style={tdSt}>
                  <div style={{ color: t.info, fontWeight: 600 }}>{f?.nome || "—"}</div>
                  {f?.cpf && <div style={{ fontSize: 10.5, color: t.textMuted }}>{f.cpf}</div>}
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
                <td style={{ ...tdSt, color: t.textSecondary }}>
                  {i.termo ? `Termo ${i.termo}` : "—"}
                  {f?.empresa ? <div style={{ fontSize: 10.5, color: t.textMuted }}>{f.empresa}</div> : null}
                </td>
                <td style={{ ...tdSt, color: t.textSecondary }}>
                  {fmtDataHora(i.data_emprestimo)}
                  {badgeDias(diasDesde(i.data_emprestimo))}
                </td>
                <td style={{ ...tdSt, textAlign: "right", color: t.textPrimary }}>{fmtBRL(i.valor)}</td>
                <td style={tdSt}>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button title="Mover pra manutenção" onClick={() => setManutItem(i)} style={rowBtn(t.warning)}><Wrench size={12} /></button>
                    <button title="Editar" onClick={() => setEditando(i)} style={rowBtn(t.info)}><Pencil size={12} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
          {emUso.length === 0 && (
            <tr><td colSpan={7} style={{ ...tdSt, textAlign: "center", color: t.textMuted, padding: 40 }}>Nenhuma ferramenta na rua.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {termoGrupos && (
        <TermoModal tipo="devolucao" grupos={termoGrupos}
                    onConfirm={confirmarDevolucao}
                    onClose={() => { setTermoGrupos(null); setTermosNovos([]); }} />
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
    </div>
  );
}
