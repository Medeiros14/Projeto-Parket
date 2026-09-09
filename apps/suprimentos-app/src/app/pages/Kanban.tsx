/** Quadro Kanban — visão geral: Em Uso agrupado por funcionário × Manutenção. */
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Item, Funcionario, fetchItens, fetchFuncionarios, fmtBRL, diasDesde } from "../lib/suprimentos";

export default function Kanban() {
  const { t } = useTheme();
  const [itens, setItens] = useState<Item[]>([]);
  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  function toggleFunc(fid: string) {
    setAbertos((p) => { const n = new Set(p); n.has(fid) ? n.delete(fid) : n.add(fid); return n; });
  }

  useEffect(() => {
    (async () => {
      const [i, f] = await Promise.all([fetchItens(), fetchFuncionarios()]);
      setItens(i); setFuncs(f); setLoading(false);
    })();
  }, []);

  const funcById = useMemo(() => Object.fromEntries(funcs.map((f) => [f.id, f])), [funcs]);
  const emUso = itens.filter((i) => i.status === "uso");
  const manutencao = itens.filter((i) => i.status === "manutencao");
  const estoque = itens.filter((i) => i.status === "estoque");

  const porFuncionario = useMemo(() => {
    const g: Record<string, Item[]> = {};
    emUso.forEach((i) => {
      const k = i.funcionario_id || "?";
      (g[k] = g[k] || []).push(i);
    });
    return Object.entries(g).sort((a, b) =>
      (funcById[a[0]]?.nome || "").localeCompare(funcById[b[0]]?.nome || ""));
  }, [emUso, funcById]);

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>;

  const col: React.CSSProperties = { background: t.cardBg, border: `1px solid ${t.border}`, padding: 16, minHeight: 200 };
  const colHead: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
  };
  const badge = (cor: string): React.CSSProperties => ({
    fontSize: 10.5, fontWeight: 700, color: cor, border: `1px solid ${cor}`, padding: "1px 8px",
  });
  const cardSt: React.CSSProperties = { background: t.inputBg, border: `1px solid ${t.border}`, padding: "10px 12px", marginBottom: 8 };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Quadro Kanban</h1>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          {estoque.length} em estoque · {emUso.length} na rua · {manutencao.length} em manutenção
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
        <div style={col}>
          <div style={colHead}>
            <span style={{ color: t.info }}>Em Uso (Rua) — por funcionário</span>
            <span style={badge(t.info)}>{emUso.length}</span>
          </div>
          {porFuncionario.map(([fid, lista]) => {
            const f = funcById[fid];
            const total = lista.reduce((s, i) => s + (i.valor || 0), 0);
            const aberto = abertos.has(fid);
            return (
              <div key={fid} style={{ ...cardSt, cursor: "pointer" }} onClick={() => toggleFunc(fid)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textPrimary, display: "flex", alignItems: "center", gap: 5 }}>
                    {aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {f?.nome || "Sem funcionário"}
                  </div>
                  <div style={{ fontSize: 11, color: t.success, fontWeight: 600, flexShrink: 0 }}>{fmtBRL(total)}</div>
                </div>
                <div style={{ fontSize: 10.5, color: t.textMuted, marginLeft: 18 }}>
                  {[f?.empresa, `${lista.length} item(ns)`].filter(Boolean).join(" · ")}
                </div>
                {aberto && (
                  <div style={{ marginTop: 6, marginLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                    {lista.map((i) => (
                      <div key={i.id} style={{ fontSize: 11.5, color: t.textSecondary }}>
                        {i.descricao}
                        {i.termo && <span style={{ color: t.textMuted }}> · Termo {i.termo}</span>}
                        <span style={{ color: diasDesde(i.data_emprestimo) >= 30 ? t.danger : t.textMuted }}> · {diasDesde(i.data_emprestimo)}d</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {porFuncionario.length === 0 && <div style={{ fontSize: 12, color: t.textMuted, textAlign: "center", padding: 30 }}>Ninguém com ferramenta na rua.</div>}
        </div>

        <div style={col}>
          <div style={colHead}>
            <span style={{ color: t.warning }}>Manutenção</span>
            <span style={badge(t.warning)}>{manutencao.length}</span>
          </div>
          {manutencao.map((i) => (
            <div key={i.id} style={cardSt}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textPrimary }}>{i.descricao}</div>
              <div style={{ fontSize: 10.5, color: t.textMuted }}>
                {[i.marca, i.serie ? `Série ${i.serie}` : null, fmtBRL(i.valor)].filter(Boolean).join(" · ")}
              </div>
              {i.manut_motivo && <div style={{ fontSize: 11.5, color: t.warning, marginTop: 4 }}>{i.manut_motivo}</div>}
            </div>
          ))}
          {manutencao.length === 0 && <div style={{ fontSize: 12, color: t.textMuted, textAlign: "center", padding: 30 }}>Nada em manutenção.</div>}
        </div>
      </div>
    </div>
  );
}
