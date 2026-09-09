/** Faturamentos — boletos POR PARCELA dos itens faturados.
 *  Parcelas vivem em core.lancamentos (Cloud) e chegam via RPC compras_itens_parcelas_bulk;
 *  anexo grava via RPC anexar_boleto_lancamento (gate: login SSO). */
import { useEffect, useMemo, useRef, useState } from "react";
import { sb } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { fmtBRL, fmtData, hojeISO } from "../lib/erp";
import { ExternalLink, Paperclip, RefreshCw, Search, Trash2 } from "lucide-react";

type Status = "cotacao" | "aguardando_aprovacao" | "aprovado" | "em_rota" | "entregue" | "faturado" | "pago" | "reprovado";

type Item = {
  id: string;
  card_id: string;
  seq: number;
  material: string;
  quantidade: string | null;
  fornecedor_nome_snapshot: string | null;
  forma_pagamento: string;
  prazo_faturamento_texto: string | null;
  valor: number;
  status: Status;
  aprovado_em: string | null;
};

type Parcela = {
  compras_item_id: string;
  id: string;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  numero_documento: string | null;
  boleto_url: string | null;
  boleto_nome: string | null;
  comprovante_url: string | null;
  comprovante_nome: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  aprovado: "Aprovado",
  em_rota: "Em Rota",
  entregue: "Entregue",
  faturado: "Faturado",
  pago: "Pago",
};

export default function Faturamentos() {
  const { t } = useTheme();
  const [itens, setItens] = useState<Item[]>([]);
  const [cards, setCards] = useState<Record<string, string>>({});
  const [parcelas, setParcelas] = useState<Record<string, Parcela[]>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const alvoRef = useRef<{ item: Item; parcela: Parcela } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: its, error } = await sb
        .from("compras_itens").select("id,card_id,seq,material,quantidade,fornecedor_nome_snapshot,forma_pagamento,prazo_faturamento_texto,valor,status,aprovado_em")
        .eq("forma_pagamento", "faturado")
        .in("status", ["aprovado", "em_rota", "entregue", "faturado", "pago"])
        .order("aprovado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      const lista = (its as unknown as Item[]) || [];
      setItens(lista);

      const cardIds = [...new Set(lista.map((i) => i.card_id))];
      if (cardIds.length) {
        const { data: cs } = await sb.from("kanban_cards").select("id,title").in("id", cardIds);
        setCards(Object.fromEntries(((cs as any[]) || []).map((c) => [c.id, c.title || "Sem título"])));
      } else setCards({});

      if (lista.length) {
        const { data: ps, error: e2 } = await sb.rpc("compras_itens_parcelas_bulk", { p_item_ids: lista.map((i) => i.id) });
        if (e2) throw e2;
        const map: Record<string, Parcela[]> = {};
        for (const p of (ps as unknown as Parcela[]) || []) (map[p.compras_item_id] ||= []).push(p);
        setParcelas(map);
      } else setParcelas({});
    } catch (e: any) {
      alert("Falha ao carregar faturamentos: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function pedirBoleto(item: Item, parcela: Parcela) {
    alvoRef.current = { item, parcela };
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    const alvo = alvoRef.current;
    alvoRef.current = null;
    if (!f || !alvo) return;
    const { item, parcela } = alvo;
    setBusy(parcela.id);
    try {
      const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
      const path = `boletos/${item.card_id}/${parcela.id}-${Date.now()}.${ext}`;
      const { data, error } = await sb.storage.from("compras-orcamentos").upload(path, f, {
        contentType: f.type || "application/pdf",
      });
      if (error) { alert("Falha upload: " + error.message); return; }
      const { data: pub } = sb.storage.from("compras-orcamentos").getPublicUrl(data.path);
      const { error: e2 } = await sb.rpc("anexar_boleto_lancamento", {
        p_lancamento_id: parcela.id, p_boleto_url: pub.publicUrl, p_boleto_nome: f.name,
      });
      if (e2) { alert("Falha ao anexar boleto: " + e2.message); return; }
      if (item.status === "entregue") {
        await sb.from("compras_itens").update({ status: "faturado", updated_at: new Date().toISOString() }).eq("id", item.id);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function removerBoleto(parcela: Parcela) {
    if (!confirm(`Remover o boleto "${parcela.boleto_nome || "anexado"}" desta parcela?`)) return;
    setBusy(parcela.id);
    try {
      const { error } = await sb.rpc("remover_boleto_lancamento", { p_lancamento_id: parcela.id });
      if (error) { alert("Falha: " + error.message); return; }
      await load();
    } finally {
      setBusy(null);
    }
  }

  const hoje = hojeISO();

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((it) => {
      const ps = parcelas[it.id] || [];
      if (soPendentes && it.status === "pago") return false;
      if (soPendentes && ps.length && ps.every((p) => p.boleto_url || ["pago", "conciliado", "recebido"].includes(p.status))) return false;
      if (q && ![it.material, it.fornecedor_nome_snapshot, cards[it.card_id]]
        .some((v) => String(v || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [itens, parcelas, cards, busca, soPendentes]);

  const grupos = useMemo(() => {
    const g: Record<string, Item[]> = {};
    for (const it of itensFiltrados) (g[it.card_id] ||= []).push(it);
    return Object.entries(g);
  }, [itensFiltrados]);

  const totParcelas = useMemo(() => Object.values(parcelas).flat(), [parcelas]);
  const semBoleto = totParcelas.filter((p) => !p.boleto_url && !["pago", "conciliado", "recebido", "cancelado"].includes(p.status)).length;

  const lblSt: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: t.textMuted, marginBottom: 4, display: "block",
  };
  const inpSt: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", boxSizing: "border-box",
  };
  const thSt: React.CSSProperties = {
    textAlign: "left", padding: "7px 10px", color: t.textMuted,
    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: `1px solid ${t.border}`,
  };
  const tdSt: React.CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${t.border}`, fontSize: 12 };
  const btnSt: React.CSSProperties = {
    background: "transparent", border: `1px solid ${t.border}`, cursor: "pointer",
    padding: "5px 8px", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
  };

  return (
    <div style={{ padding: "24px 28px" }}>
      <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={onFile} />

      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Faturamentos — Boletos por Parcela</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {itens.length} itens faturados · {semBoleto} parcelas sem boleto
          </div>
        </div>
        <button onClick={load} style={{ ...btnSt, color: t.textSecondary, padding: "9px 14px", fontSize: 12 }}>
          <RefreshCw size={13} /> Atualizar
        </button>
      </header>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <label style={lblSt}>Buscar</label>
          <Search size={12} style={{ position: "absolute", left: 9, bottom: 11, color: t.textMuted }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Material, fornecedor, solicitação…" style={{ ...inpSt, width: "100%", paddingLeft: 28 }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", paddingBottom: 9, fontSize: 12, color: t.textSecondary }}>
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />
          Só pendentes de boleto
        </label>
      </div>

      {loading ? (
        <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>
      ) : grupos.length === 0 ? (
        <div style={{ padding: 40, color: t.textMuted, border: `1px dashed ${t.border}`, textAlign: "center" }}>
          Nenhum item faturado {soPendentes ? "pendente de boleto" : ""} encontrado.
        </div>
      ) : (
        grupos.map(([cardId, lista]) => (
          <section key={cardId} style={{ border: `1px solid ${t.border}`, marginBottom: 18 }}>
            <div style={{
              padding: "10px 14px", borderBottom: `1px solid ${t.border}`, background: t.inputBg,
              fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em",
            }}>
              {cards[cardId] || "Solicitação"}
            </div>

            {lista.map((it) => {
              const ps = parcelas[it.id] || [];
              return (
                <div key={it.id} style={{ padding: "12px 14px", borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{it.material}</span>
                    {it.quantidade && <span style={{ fontSize: 11.5, color: t.textMuted }}>{it.quantidade}</span>}
                    <span style={{ fontSize: 11.5, color: t.textSecondary }}>{it.fornecedor_nome_snapshot || "—"}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{fmtBRL(it.valor)}</span>
                    {it.prazo_faturamento_texto && (
                      <span style={{ fontSize: 10.5, color: t.textMuted }}>Prazo: {it.prazo_faturamento_texto}</span>
                    )}
                    <span style={{
                      marginLeft: "auto", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      color: it.status === "pago" ? t.success : t.warning,
                    }}>
                      {STATUS_LABEL[it.status] || it.status}
                    </span>
                  </div>

                  {ps.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: t.textMuted }}>
                      Sem parcelas geradas (aguardando aprovação do Financeiro).
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={thSt}>Parcela</th><th style={thSt}>Vencimento</th>
                          <th style={{ ...thSt, textAlign: "right" }}>Valor</th>
                          <th style={thSt}>Status</th><th style={thSt}>Boleto</th><th style={thSt}>Comprovante</th><th style={thSt}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ps.map((p, i) => {
                          const paga = ["pago", "conciliado", "recebido"].includes(p.status);
                          const atrasada = !paga && p.status !== "cancelado" && (p.data_vencimento || "") < hoje;
                          return (
                            <tr key={p.id}>
                              <td style={{ ...tdSt, color: t.textSecondary }}>{i + 1}/{ps.length}</td>
                              <td style={{ ...tdSt, color: atrasada ? t.danger : t.textPrimary, fontWeight: atrasada ? 700 : 400 }}>
                                {fmtData(p.data_vencimento)}
                              </td>
                              <td style={{ ...tdSt, textAlign: "right", fontWeight: 600 }}>{fmtBRL(p.valor)}</td>
                              <td style={tdSt}>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                                  color: paga ? t.success : atrasada ? t.danger : t.warning,
                                }}>
                                  {paga ? `Paga ${p.data_pagamento ? "em " + fmtData(p.data_pagamento) : ""}` : atrasada ? "Atrasada" : "Pendente"}
                                </span>
                              </td>
                              <td style={tdSt}>
                                {p.boleto_url ? (
                                  <a href={p.boleto_url} target="_blank" rel="noreferrer"
                                     style={{ color: t.textPrimary, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
                                    <ExternalLink size={11} /> {p.boleto_nome || "Ver boleto"}
                                  </a>
                                ) : (
                                  <span style={{ fontSize: 11, color: t.textMuted }}>Sem boleto</span>
                                )}
                              </td>
                              <td style={tdSt}>
                                {p.comprovante_url ? (
                                  <a href={p.comprovante_url} target="_blank" rel="noreferrer" title={p.comprovante_nome || "Comprovante"}
                                     style={{ color: t.success, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
                                    <ExternalLink size={11} /> Ver comprovante
                                  </a>
                                ) : paga ? (
                                  <span style={{ fontSize: 11, color: t.textMuted, fontStyle: "italic" }}>paga sem comprovante</span>
                                ) : (
                                  <span style={{ fontSize: 11, color: t.textMuted }}>—</span>
                                )}
                              </td>
                              <td style={{ ...tdSt, textAlign: "right", whiteSpace: "nowrap" }}>
                                <button onClick={() => pedirBoleto(it, p)} disabled={busy === p.id}
                                        style={{ ...btnSt, color: t.textSecondary, opacity: busy === p.id ? 0.5 : 1 }}>
                                  <Paperclip size={11} /> {p.boleto_url ? "Substituir" : "Anexar boleto"}
                                </button>
                                {p.boleto_url && !paga && (
                                  <button onClick={() => removerBoleto(p)} disabled={busy === p.id} title="Remover boleto"
                                          style={{ ...btnSt, color: t.danger, marginLeft: 6, opacity: busy === p.id ? 0.5 : 1 }}>
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
