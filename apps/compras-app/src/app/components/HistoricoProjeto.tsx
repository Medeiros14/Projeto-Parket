/** Histórico de compras de um projeto/cliente: solicitações (kanban), entradas,
 *  saídas/consumo (incl. fabricação na marcenaria) e contas a pagar.
 *  Match por nome do projeto (case-insensitive, contém). Usado no Cadastros
 *  (clique na linha) e dentro do card de solicitação no Kanban. */
import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { fmtBRL, fmtData } from "../lib/erp";
import { X, History } from "lucide-react";

export function useHistoricoProjeto(nome: string) {
  const [loading, setLoading] = useState(true);
  const [sols, setSols] = useState<any[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);

  useEffect(() => {
    if (!nome) { setSols([]); setMovs([]); setContas([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const like = `%${nome}%`;
      const [porTitulo, porDetalhe, m, c] = await Promise.all([
        sb.from("kanban_cards").select("id,title,column_id,responsavel,created_at,details")
          .in("dept_id", ["compras", "compras-taiara", "compras-marco"])
          .ilike("title", like).order("created_at", { ascending: false }).limit(100),
        sb.from("kanban_cards").select("id,title,column_id,responsavel,created_at,details")
          .in("dept_id", ["compras", "compras-taiara", "compras-marco"])
          .ilike("details->>projeto_nome", like).order("created_at", { ascending: false }).limit(100),
        sb.from("compras_estoque_mov").select("*").ilike("projeto", like)
          .order("data", { ascending: false }).limit(300),
        sb.from("compras_contas_pagar").select("*").ilike("projeto", like)
          .order("data_vencimento", { ascending: false }).limit(100),
      ]);
      const vistos = new Set<string>();
      const cards = [...(porTitulo.data || []), ...(porDetalhe.data || [])].filter((r: any) => {
        if (vistos.has(r.id)) return false;
        vistos.add(r.id);
        return true;
      }).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
      setSols(cards);
      setMovs((m.data as any[]) || []);
      setContas((c.data as any[]) || []);
      setLoading(false);
    })();
  }, [nome]);

  const entradas = movs.filter((x) => x.tipo === "Entrada");
  const saidas = movs.filter((x) => x.tipo !== "Entrada");
  const totEnt = entradas.reduce((s, x) => s + (Number(x.valor_total) || 0), 0);
  const totSai = saidas.reduce((s, x) => s + (Number(x.valor_total) || 0), 0);
  const totCon = contas.reduce((s, x) => s + (Number(x.valor) || 0), 0);

  return { loading, sols, entradas, saidas, contas, totEnt, totSai, totCon };
}

const ETAPA: Record<string, string> = {
  entrada: "Entrada", solicitacao: "Solicitação", cotacao: "Cotação", pedido: "Pedido",
  transporte: "Transporte", entregue: "Entregue", concluido: "Concluído",
};

export default function HistoricoProjeto({ nome, subtitulo, t, onClose }: {
  nome: string; subtitulo?: string; t: any; onClose: () => void;
}) {
  const { loading, sols, entradas, saidas, contas, totEnt, totSai, totCon } = useHistoricoProjeto(nome);

  const thSt: React.CSSProperties = {
    textAlign: "left", padding: "6px 10px", color: t.textMuted,
    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: `1px solid ${t.border}`,
  };
  const tdSt: React.CSSProperties = { padding: "7px 10px", borderBottom: `1px solid ${t.border}`, fontSize: 12 };
  const secSt: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    color: t.accent, margin: "18px 0 6px",
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 120, display: "grid", placeItems: "center", padding: "24px 0" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 900, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto",
        background: t.modalBg, border: `1px solid ${t.borderStrong}`, padding: 24,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary }}>{nome}</div>
            <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 3 }}>
              {subtitulo || "—"}{" · histórico de compras"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 30, color: t.textMuted }}>Carregando histórico…</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 11.5, color: t.textSecondary, flexWrap: "wrap" }}>
              <span><b style={{ color: t.textPrimary }}>{sols.length}</b> solicitações</span>
              <span><b style={{ color: t.textPrimary }}>{entradas.length}</b> entradas · {fmtBRL(totEnt)}</span>
              <span><b style={{ color: t.textPrimary }}>{saidas.length}</b> saídas/consumo · {fmtBRL(totSai)}</span>
              <span><b style={{ color: t.textPrimary }}>{contas.length}</b> contas a pagar · {fmtBRL(totCon)}</span>
            </div>

            <div style={secSt}>Solicitações de compra ({sols.length})</div>
            {sols.length === 0 ? <div style={{ fontSize: 12, color: t.textMuted }}>Nenhuma solicitação vinculada a este projeto.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={thSt}>Data</th><th style={thSt}>Solicitante</th><th style={thSt}>Materiais</th><th style={thSt}>Responsável</th><th style={thSt}>Etapa</th></tr></thead>
                <tbody>{sols.map((s) => (
                  <tr key={s.id}>
                    <td style={tdSt}>{fmtData(String(s.created_at))}</td>
                    <td style={tdSt}>{s.details?.solicitante || s.details?.pedido_por || "—"}</td>
                    <td style={{ ...tdSt, color: t.textPrimary }}>
                      {((s.details?.materiais as any[]) || []).map((m) => `${m.quantidade ? m.quantidade + " " : ""}${m.tipo}`).join(", ") || s.title}
                    </td>
                    <td style={tdSt}>{s.responsavel || "—"}</td>
                    <td style={tdSt}>{ETAPA[s.column_id] || s.column_id || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}

            <div style={secSt}>Entradas de material ({entradas.length} · {fmtBRL(totEnt)})</div>
            {entradas.length === 0 ? <div style={{ fontSize: 12, color: t.textMuted }}>Nenhuma entrada registrada pra este projeto.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={thSt}>Data</th><th style={thSt}>Material</th><th style={thSt}>Qtd</th><th style={thSt}>Valor</th><th style={thSt}>Fornecedor</th><th style={thSt}>Depósito</th></tr></thead>
                <tbody>{entradas.map((m) => (
                  <tr key={m.id}>
                    <td style={tdSt}>{fmtData(m.data)}</td>
                    <td style={{ ...tdSt, color: t.textPrimary }}>{m.descricao}</td>
                    <td style={tdSt}>{m.quantidade} {m.unidade || ""}</td>
                    <td style={tdSt}>{fmtBRL(m.valor_total)}</td>
                    <td style={tdSt}>{m.fornecedor || "—"}</td>
                    <td style={tdSt}>{m.deposito === "instalacao" ? "Instalação" : "Marcenaria"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}

            <div style={secSt}>Saídas / consumo ({saidas.length} · {fmtBRL(totSai)})</div>
            {saidas.length === 0 ? <div style={{ fontSize: 12, color: t.textMuted }}>Nenhum material usado/enviado pra este projeto ainda.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={thSt}>Data</th><th style={thSt}>Material</th><th style={thSt}>Qtd</th><th style={thSt}>Valor</th><th style={thSt}>Documento</th><th style={thSt}>Depósito</th></tr></thead>
                <tbody>{saidas.map((m) => (
                  <tr key={m.id}>
                    <td style={tdSt}>{fmtData(m.data)}</td>
                    <td style={{ ...tdSt, color: t.textPrimary }}>{m.descricao}</td>
                    <td style={tdSt}>{m.quantidade} {m.unidade || ""}</td>
                    <td style={tdSt}>{fmtBRL(m.valor_total)}</td>
                    <td style={tdSt}>{m.documento || "—"}</td>
                    <td style={tdSt}>{m.deposito === "instalacao" ? "Instalação" : "Marcenaria"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}

            <div style={secSt}>Contas a pagar ({contas.length} · {fmtBRL(totCon)})</div>
            {contas.length === 0 ? <div style={{ fontSize: 12, color: t.textMuted }}>Nenhuma conta vinculada a este projeto.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={thSt}>Vencimento</th><th style={thSt}>Fornecedor</th><th style={thSt}>Documento</th><th style={thSt}>Valor</th><th style={thSt}>Status</th></tr></thead>
                <tbody>{contas.map((cta) => (
                  <tr key={cta.id}>
                    <td style={tdSt}>{fmtData(cta.data_vencimento)}</td>
                    <td style={{ ...tdSt, color: t.textPrimary }}>{cta.fornecedor || "—"}</td>
                    <td style={tdSt}>{cta.documento || "—"}{cta.parcela ? ` (${cta.parcela})` : ""}</td>
                    <td style={tdSt}>{fmtBRL(cta.valor)}</td>
                    <td style={tdSt}>{cta.status || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Resumo inline dos gastos do projeto pro card de solicitação:
 *  contadores + totais sempre visíveis e botão pro histórico completo. */
export function GastosProjeto({ nome, t }: { nome: string; t: any }) {
  const { loading, sols, entradas, saidas, contas, totEnt, totSai, totCon } = useHistoricoProjeto(nome);
  const [aberto, setAberto] = useState(false);
  if (!nome) return null;
  return (
    <div style={{ marginBottom: 18, border: `1px solid ${t.border}`, background: t.statBg, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.textMuted }}>
          <History size={9} style={{ marginRight: 5, verticalAlign: "-1px" }} />
          Gastos do projeto — {nome}
        </div>
        <button onClick={() => setAberto(true)} style={{
          background: "transparent", border: `1px solid ${t.border}`, color: t.textSecondary,
          padding: "4px 10px", borderRadius: 0, fontSize: 10.5, fontWeight: 600, cursor: "pointer",
        }}>
          Ver histórico completo
        </button>
      </div>
      {loading ? (
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>Carregando…</div>
      ) : (
        <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: 11.5, color: t.textSecondary, flexWrap: "wrap" }}>
          <span><b style={{ color: t.textPrimary }}>{sols.length}</b> solicitações</span>
          <span><b style={{ color: t.textPrimary }}>{entradas.length}</b> entradas · {fmtBRL(totEnt)}</span>
          <span><b style={{ color: t.textPrimary }}>{saidas.length}</b> saídas/consumo · {fmtBRL(totSai)}</span>
          <span><b style={{ color: t.textPrimary }}>{contas.length}</b> contas a pagar · {fmtBRL(totCon)}</span>
        </div>
      )}
      {aberto && <HistoricoProjeto nome={nome} t={t} onClose={() => setAberto(false)} />}
    </div>
  );
}
