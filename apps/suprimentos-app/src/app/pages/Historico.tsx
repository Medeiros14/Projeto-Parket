/** Histórico de Termos — todo termo emitido (empréstimo e devolução), com reimpressão.
 *  Lê suprimentos_termos da filial do login: Ronaldo vê SP, Edson vê CWB. */
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Printer, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import {
  TermoRegistro, Funcionario, fetchTermos, fetchFuncionariosTodos,
  fmtBRL, fmtDataHora,
} from "../lib/suprimentos";
import { imprimirTermo, TermoGrupo } from "../components/TermoModal";

type FiltroTipo = "todos" | "emprestimo" | "devolucao";

export default function Historico() {
  const { t } = useTheme();

  const [termos, setTermos] = useState<TermoRegistro[]>([]);
  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [aberto, setAberto] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const [ts, fs] = await Promise.all([fetchTermos(), fetchFuncionariosTodos()]);
    setTermos(ts); setFuncs(fs); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // CPF e empresa não ficam salvos no termo: vêm do cadastro na hora de reimprimir.
  const funcById = useMemo(() => Object.fromEntries(funcs.map((f) => [f.id, f])), [funcs]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return termos
      .filter((r) => tipo === "todos" || r.tipo === tipo)
      .filter((r) => !q ||
        r.numero.toLowerCase().includes(q) ||
        (r.funcionario_nome || "").toLowerCase().includes(q) ||
        (r.itens || []).some((i) =>
          (i.descricao || "").toLowerCase().includes(q) ||
          (i.serie || "").toLowerCase().includes(q) ||
          (i.marca || "").toLowerCase().includes(q)));
  }, [termos, busca, tipo]);

  const totalDe = (r: TermoRegistro) => (r.itens || []).reduce((s, i) => s + (i.valor || 0), 0);

  /** Monta o grupo do renderer a partir do que ficou salvo no termo. */
  function grupoDoTermo(r: TermoRegistro): TermoGrupo {
    const f = r.funcionario_id ? funcById[r.funcionario_id] : null;
    const itens = r.itens || [];
    const origens = Array.from(new Set(itens.map((i) => i.termo_origem).filter(Boolean))) as string[];
    return {
      numero: r.numero,
      referenteA: origens.length ? origens.join(", ") : null,
      funcionarioNome: r.funcionario_nome || f?.nome || "Não identificado",
      cpf: f?.cpf || null,
      empresa: f?.empresa || null,
      data: r.created_at,
      itens: itens.map((i) => ({
        descricao: i.descricao, marca: i.marca ?? null, serie: i.serie ?? null, valor: i.valor || 0,
      })),
    };
  }

  function alternar(id: string) {
    setAberto((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>;

  const thSt: React.CSSProperties = {
    textAlign: "left", padding: "8px 12px", color: t.textMuted,
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: `1px solid ${t.border}`,
  };
  const tdSt: React.CSSProperties = { padding: "9px 12px", borderBottom: `1px solid ${t.border}`, fontSize: 12.5 };
  const inputSt: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 12px", fontSize: 13, borderRadius: 0, outline: "none",
  };

  const badgeTipo = (v: string) => {
    const emp = v === "emprestimo";
    const cor = emp ? t.info : t.success;
    return (
      <span style={{ fontSize: 9.5, fontWeight: 700, color: cor, border: `1px solid ${cor}`, padding: "2px 6px", letterSpacing: "0.08em" }}>
        {emp ? "EMPRÉSTIMO" : "DEVOLUÇÃO"}
      </span>
    );
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Histórico de Termos</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {lista.length} termo(s) emitido(s)
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as FiltroTipo)} style={{ ...inputSt, minWidth: 170 }}>
          <option value="todos">Todos os tipos</option>
          <option value="emprestimo">Só empréstimo</option>
          <option value="devolucao">Só devolução</option>
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nº, funcionário, ferramenta ou série…"
               style={{ ...inputSt, width: 320 }} />
        <button onClick={load} title="Atualizar" style={{
          background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.borderStrong}`,
          padding: "9px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <RefreshCw size={13} /> Atualizar
        </button>
      </header>

      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thSt, width: 34 }} />
            <th style={thSt}>Nº controle</th>
            <th style={thSt}>Tipo</th>
            <th style={thSt}>Funcionário</th>
            <th style={thSt}>Emissão</th>
            <th style={{ ...thSt, textAlign: "right" }}>Itens</th>
            <th style={{ ...thSt, textAlign: "right" }}>Valor</th>
            <th style={{ ...thSt, width: 130 }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((r) => {
            const itens = r.itens || [];
            const origens = Array.from(new Set(itens.map((i) => i.termo_origem).filter(Boolean))) as string[];
            const expandido = aberto.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr>
                  <td style={tdSt}>
                    <button onClick={() => alternar(r.id)} title={expandido ? "Recolher" : "Ver itens"} style={{
                      background: "transparent", border: "none", color: t.textMuted, cursor: "pointer", padding: 0,
                    }}>
                      {expandido ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  </td>
                  <td style={{ ...tdSt, color: t.textPrimary, fontWeight: 600 }}>
                    {r.numero}
                    {origens.length > 0 && (
                      <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 400 }}>
                        {origens.length > 1 ? `Termos ${origens.join(", ")}` : `Termo ${origens[0]}`}
                      </div>
                    )}
                  </td>
                  <td style={tdSt}>{badgeTipo(r.tipo)}</td>
                  <td style={{ ...tdSt, color: t.info, fontWeight: 600 }}>{r.funcionario_nome || "Não identificado"}</td>
                  <td style={{ ...tdSt, color: t.textSecondary }}>{fmtDataHora(r.created_at)}</td>
                  <td style={{ ...tdSt, textAlign: "right", color: t.textSecondary }}>{itens.length}</td>
                  <td style={{ ...tdSt, textAlign: "right", color: t.textPrimary }}>{fmtBRL(totalDe(r))}</td>
                  <td style={tdSt}>
                    <button onClick={() => imprimirTermo(r.tipo, [grupoDoTermo(r)])} style={{
                      background: "transparent", border: `1px solid ${t.border}`, color: t.textPrimary,
                      padding: "5px 10px", fontSize: 11.5, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}>
                      <Printer size={12} /> Reimprimir
                    </button>
                  </td>
                </tr>
                {expandido && (
                  <tr>
                    <td />
                    <td colSpan={7} style={{ ...tdSt, background: t.inputBg }}>
                      {itens.map((i, ix) => (
                        <div key={ix} style={{ fontSize: 11.5, color: t.textSecondary, padding: "2px 0" }}>
                          {String(ix + 1).padStart(2, "0")} · {i.descricao}
                          {i.marca ? ` · ${i.marca}` : ""}
                          {i.serie ? ` · Série ${i.serie}` : ""}
                          {i.termo_origem ? ` · do termo ${i.termo_origem}` : ""}
                          <span style={{ color: t.textMuted }}> · {fmtBRL(i.valor)}</span>
                        </div>
                      ))}
                      {itens.length === 0 && <span style={{ color: t.textMuted }}>Termo sem itens registrados.</span>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {lista.length === 0 && (
            <tr><td colSpan={8} style={{ ...tdSt, textAlign: "center", color: t.textMuted, padding: 40 }}>Nenhum termo encontrado.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
