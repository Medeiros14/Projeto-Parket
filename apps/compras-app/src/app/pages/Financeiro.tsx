/** Financeiro — Contas a Pagar (herdado do ERP legado Apps Script, aba Financeiro).
 *  Parcelas nascem na Entrada Manual e no Import XML NF-e (compras_contas_pagar).
 *  Divisão com /faturamentos (Will 21/08): AQUI o Compras deixa a NOTA FISCAL
 *  (arquivo por documento, nf_url/nf_nome); boleto NÃO se anexa aqui — boleto de NF
 *  é anexado no Core (aba Notas NF) e boleto de pedido faturado fica em /faturamentos. */
import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { fmtBRL, fmtData, printHtml } from "../lib/erp";
import { FileCheck2, Paperclip, Printer, Search, Trash2 } from "lucide-react";

type Conta = {
  id: string;
  fornecedor: string | null;
  documento: string | null;
  parcela: string | null;
  data_vencimento: string | null;
  valor: number;
  forma_pagamento: string | null;
  status: "pendente" | "pago";
  data_pagamento: string | null;
  projeto: string | null;
  obs: string | null;
  lancamento_id: string | null;
  comprovante_url: string | null;
  comprovante_nome: string | null;
  boleto_url: string | null;
  boleto_nome: string | null;
  nf_url: string | null;
  nf_nome: string | null;
};

export default function Financeiro() {
  const { t } = useTheme();
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fStatus, setFStatus] = useState<"todos" | "pendente" | "pago">("pendente");
  const [busca, setBusca] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await sb
      .from("compras_contas_pagar").select("*")
      .order("data_vencimento", { ascending: true }).limit(5000);
    setContas((data as unknown as Conta[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contas.filter((c) => {
      if (fStatus !== "todos" && c.status !== fStatus) return false;
      if (fDe && (c.data_vencimento || "") < fDe) return false;
      if (fAte && (c.data_vencimento || "") > fAte) return false;
      if (q && ![c.fornecedor, c.documento, c.projeto, c.forma_pagamento]
        .some((v) => String(v || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [contas, fDe, fAte, fStatus, busca]);

  const totPendente = useMemo(() => filtradas.filter((c) => c.status === "pendente").reduce((s, c) => s + (c.valor || 0), 0), [filtradas]);
  const totPago = useMemo(() => filtradas.filter((c) => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0), [filtradas]);

  const [busy, setBusy] = useState<string | null>(null);

  // A NF é 1 arquivo por documento — anexa/remove em TODAS as parcelas do mesmo doc+fornecedor.
  const idsDoc = (c: Conta) =>
    contas.filter((x) => x.documento === c.documento && x.fornecedor === c.fornecedor).map((x) => x.id);

  function anexarNF(c: Conta) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/pdf,text/xml,application/xml,image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(c.id);
      try {
        const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
        const path = `nf/${c.id}-${Date.now()}.${ext}`;
        const { data, error } = await sb.storage.from("compras-orcamentos").upload(path, f, {
          contentType: f.type || "application/pdf",
        });
        if (error) { alert("Falha upload: " + error.message); return; }
        const url = sb.storage.from("compras-orcamentos").getPublicUrl(data.path).data.publicUrl;
        const ids = idsDoc(c);
        const { error: e2 } = await sb.from("compras_contas_pagar")
          .update({ nf_url: url, nf_nome: f.name }).in("id", ids);
        if (e2) { alert("Falha ao gravar NF: " + e2.message); return; }
        setContas((prev) => prev.map((x) => ids.includes(x.id) ? { ...x, nf_url: url, nf_nome: f.name } : x));
      } catch (err: any) { alert(err?.message || String(err));
      } finally { setBusy(null); }
    };
    input.click();
  }

  async function removerNF(c: Conta) {
    if (!confirm(`Remover a nota fiscal "${c.nf_nome || "anexada"}" da NF ${c.documento || "—"} (todas as parcelas)?`)) return;
    setBusy(c.id);
    try {
      const ids = idsDoc(c);
      const { error } = await sb.from("compras_contas_pagar")
        .update({ nf_url: null, nf_nome: null }).in("id", ids);
      if (error) { alert("Falha: " + error.message); return; }
      setContas((prev) => prev.map((x) => ids.includes(x.id) ? { ...x, nf_url: null, nf_nome: null } : x));
    } finally { setBusy(null); }
  }

  async function apagar(c: Conta) {
    if (!confirm(`APAGAR a parcela ${c.parcela || "única"} de ${c.fornecedor || "—"} (${fmtBRL(c.valor)})? Essa ação não tem volta.`)) return;
    const { error } = await sb.from("compras_contas_pagar").delete().eq("id", c.id);
    if (error) { alert("Falha: " + error.message); return; }
    setContas((prev) => prev.filter((x) => x.id !== c.id));
  }

  function imprimir() {
    const linhas = filtradas.map((c) => `<tr>
      <td>${c.fornecedor || "—"}</td><td>${c.documento || "—"}</td><td>${c.parcela || "—"}</td>
      <td>${fmtData(c.data_vencimento)}</td><td>${fmtBRL(c.valor)}</td>
      <td>${c.forma_pagamento || "—"}</td><td>${c.status.toUpperCase()}</td><td>${c.projeto || "—"}</td>
    </tr>`).join("");
    printHtml("Contas a Pagar", `
      <p class="meta">Filtro: ${fStatus === "todos" ? "todas" : fStatus} · ${fDe ? "de " + fmtData(fDe) : ""} ${fAte ? "até " + fmtData(fAte) : ""}</p>
      <table><thead><tr><th>Fornecedor</th><th>NF/Doc</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Forma</th><th>Status</th><th>Projeto</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <p class="meta tot">Pendente: ${fmtBRL(totPendente)} · Pago: ${fmtBRL(totPago)} · ${filtradas.length} parcelas</p>`);
  }

  const thSt: React.CSSProperties = {
    textAlign: "left", padding: "8px 12px", color: t.textMuted,
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: `1px solid ${t.border}`,
  };
  const tdSt: React.CSSProperties = { padding: "10px 12px", borderBottom: `1px solid ${t.border}`, fontSize: 12.5 };
  const inpSt: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", boxSizing: "border-box",
  };
  const lblSt: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: t.textMuted, marginBottom: 4, display: "block",
  };

  const hoje = new Date().toISOString().slice(0, 10);

  const nAtrasadas = useMemo(() => contas.filter((c) => c.status === "pendente" && (c.data_vencimento || "") < hoje), [contas, hoje]);
  const nPendentes = useMemo(() => contas.filter((c) => c.status === "pendente" && (c.data_vencimento || "") >= hoje), [contas, hoje]);
  const nSemNF = useMemo(() => contas.filter((c) => c.status === "pendente" && !c.nf_url), [contas]);
  const nPagas = useMemo(() => contas.filter((c) => c.status === "pago"), [contas]);
  const soma = (arr: Conta[]) => arr.reduce((s, c) => s + (c.valor || 0), 0);

  const kpiSt = (cor: string, ativo: boolean): React.CSSProperties => ({
    flex: 1, minWidth: 170, padding: "12px 14px", cursor: "pointer",
    background: ativo ? t.cardHover : t.statBg,
    border: `1px solid ${ativo ? t.borderStrong : t.border}`,
    borderLeft: `3px solid ${cor}`,
  });
  const kpiNum: React.CSSProperties = { fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" };
  const kpiLbl: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    color: t.textSecondary, marginBottom: 5,
  };
  const pill = (cor: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
    color: cor, background: `${cor}1c`, border: `1px solid ${cor}55`,
    padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap",
  });

  return (
    <div style={{ padding: "24px 28px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Financeiro — Contas a Pagar</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>Notas fiscais (entrada de nota / estoque) · boletos de pedidos faturados ficam em Faturamentos</div>
        </div>
        <button onClick={imprimir} style={{
          background: "transparent", color: t.textSecondary, border: `1px solid ${t.border}`,
          padding: "9px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <Printer size={13} /> Imprimir
        </button>
      </header>

      {/* Fluxo: quem faz o quê */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: t.cardBg, border: `1px solid ${t.border}`, padding: "10px 14px", marginBottom: 14,
        fontSize: 11.5, color: t.textSecondary,
      }}>
        {[
          ["1", "Compras deixa a nota fiscal aqui", true],
          ["2", "Financeiro anexa o boleto e paga no Core (aba Notas NF)", false],
          ["3", "Comprovante volta automático nesta tela", false],
        ].map(([n, txt, forte], i) => (
          <span key={String(n)} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {i > 0 && <span style={{ color: t.textMuted }}>→</span>}
            <span style={{
              width: 17, height: 17, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 9.5, fontWeight: 700, background: forte ? t.accent : t.accentSoft,
              color: forte ? t.bg : t.textSecondary,
            }}>{n}</span>
            <span style={{ color: forte ? t.textPrimary : t.textSecondary, fontWeight: forte ? 600 : 400 }}>{txt}</span>
          </span>
        ))}
      </div>

      {/* Resumo clicável */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={kpiSt(t.danger, fStatus === "pendente" && !!fAte && fAte < hoje)}
             onClick={() => { setFStatus("pendente"); setFDe(""); setFAte(nAtrasadas.length ? new Date(Date.now() - 86400000).toISOString().slice(0, 10) : ""); }}>
          <div style={kpiLbl}>Atrasadas</div>
          <div style={{ ...kpiNum, color: nAtrasadas.length ? t.danger : t.textMuted }}>{fmtBRL(soma(nAtrasadas))}</div>
          <div style={{ fontSize: 10.5, color: t.textMuted }}>{nAtrasadas.length} parcela{nAtrasadas.length === 1 ? "" : "s"}</div>
        </div>
        <div style={kpiSt(t.warning, fStatus === "pendente" && !fAte)}
             onClick={() => { setFStatus("pendente"); setFDe(""); setFAte(""); }}>
          <div style={kpiLbl}>A vencer</div>
          <div style={{ ...kpiNum, color: t.warning }}>{fmtBRL(soma(nPendentes))}</div>
          <div style={{ fontSize: 10.5, color: t.textMuted }}>{nPendentes.length} parcela{nPendentes.length === 1 ? "" : "s"}</div>
        </div>
        <div style={kpiSt(t.info, false)} title="Pendentes sem nota fiscal anexada — ação do Compras">
          <div style={kpiLbl}>Sem NF (ação Compras)</div>
          <div style={{ ...kpiNum, color: nSemNF.length ? t.info : t.textMuted }}>{nSemNF.length}</div>
          <div style={{ fontSize: 10.5, color: t.textMuted }}>parcela{nSemNF.length === 1 ? "" : "s"} aguardando anexo</div>
        </div>
        <div style={kpiSt(t.success, fStatus === "pago")}
             onClick={() => { setFStatus("pago"); setFDe(""); setFAte(""); }}>
          <div style={kpiLbl}>Pagas</div>
          <div style={{ ...kpiNum, color: t.success }}>{fmtBRL(soma(nPagas))}</div>
          <div style={{ fontSize: 10.5, color: t.textMuted }}>{nPagas.length} parcela{nPagas.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <label style={lblSt}>Venc. de</label>
          <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} style={{ ...inpSt, width: 150 }} />
        </div>
        <div>
          <label style={lblSt}>Venc. até</label>
          <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} style={{ ...inpSt, width: 150 }} />
        </div>
        <div>
          <label style={lblSt}>Status</label>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)} style={{ ...inpSt, width: 130 }}>
            <option value="pendente">Pendentes</option>
            <option value="pago">Pagas</option>
            <option value="todos">Todas</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <label style={lblSt}>Buscar</label>
          <Search size={12} style={{ position: "absolute", left: 9, bottom: 11, color: t.textMuted }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Fornecedor, NF, projeto…" style={{ ...inpSt, width: "100%", paddingLeft: 28 }} />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <style>{`.fin-row:hover td { background: ${t.cardHover}; }`}</style>
          <thead>
            <tr>
              <th style={thSt}>Fornecedor</th><th style={thSt}>NF / Doc</th><th style={thSt}>Parcela</th>
              <th style={thSt}>Vencimento</th><th style={{ ...thSt, textAlign: "right" }}>Valor</th>
              <th style={thSt}>Forma</th><th style={thSt}>Projeto</th><th style={thSt}>Status</th><th style={thSt}>Nota fiscal</th><th style={thSt}>Comprovante</th><th style={thSt}></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => {
              const atrasada = c.status === "pendente" && (c.data_vencimento || "") < hoje;
              return (
                <tr key={c.id} className="fin-row">
                  <td style={{ ...tdSt, fontWeight: 600 }}>{c.fornecedor || "—"}</td>
                  <td style={{ ...tdSt, color: t.textSecondary }}>{c.documento || "—"}</td>
                  <td style={{ ...tdSt, color: t.textSecondary }}>{c.parcela || "—"}</td>
                  <td style={{ ...tdSt, color: atrasada ? t.danger : t.textPrimary, fontWeight: atrasada ? 700 : 400 }}>
                    {fmtData(c.data_vencimento)}
                  </td>
                  <td style={{ ...tdSt, textAlign: "right", fontWeight: 600 }}>{fmtBRL(c.valor)}</td>
                  <td style={{ ...tdSt, color: t.textSecondary }}>{c.forma_pagamento || "—"}</td>
                  <td style={{ ...tdSt, color: t.textSecondary }}>{c.projeto || "—"}</td>
                  <td style={tdSt}>
                    <span style={pill(c.status === "pago" ? t.success : atrasada ? t.danger : t.warning)}>
                      {c.status === "pago" ? `Pago ${c.data_pagamento ? fmtData(c.data_pagamento) : ""}` : atrasada ? "Atrasada" : c.boleto_url ? "No Core p/ pagar" : "Pendente"}
                    </span>
                  </td>
                  <td style={tdSt}>
                    {c.nf_url ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <a href={c.nf_url} target="_blank" rel="noreferrer" title={c.nf_nome || "Nota fiscal"}
                           style={{ ...pill(c.status === "pago" ? t.success : t.info), textDecoration: "none", cursor: "pointer" }}>
                          <Paperclip size={11} /> Ver NF
                        </a>
                        {c.status === "pendente" && (
                          <button onClick={() => removerNF(c)} disabled={busy === c.id} title="Remover nota fiscal"
                                  style={{ background: "transparent", border: "none", cursor: "pointer", color: t.textMuted, fontSize: 13, lineHeight: 1, padding: "0 3px" }}>
                            ×
                          </button>
                        )}
                      </span>
                    ) : c.status === "pendente" ? (
                      <button onClick={() => anexarNF(c)} disabled={busy === c.id} title="Anexar a nota fiscal (PDF/XML) — vale pra todas as parcelas desta NF"
                              style={{
                                background: t.accentSoft, border: `1px solid ${t.borderStrong}`, cursor: "pointer",
                                color: t.textPrimary, padding: "5px 10px", borderRadius: 999,
                                display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700,
                                letterSpacing: "0.05em", textTransform: "uppercase",
                              }}>
                        <Paperclip size={11} /> {busy === c.id ? "Enviando…" : "Anexar NF"}
                      </button>
                    ) : (
                      <span style={{ color: t.textMuted }}>—</span>
                    )}
                  </td>
                  <td style={tdSt}>
                    {c.comprovante_url ? (
                      <a href={c.comprovante_url} target="_blank" rel="noreferrer" title={c.comprovante_nome || "Comprovante"}
                         style={{ ...pill(t.success), textDecoration: "none", cursor: "pointer" }}>
                        <FileCheck2 size={11} /> Ver
                      </a>
                    ) : c.status === "pendente" && c.boleto_url ? (
                      <span style={{ fontSize: 10.5, color: t.textMuted, fontStyle: "italic" }}>aguardando Core</span>
                    ) : (
                      <span style={{ color: t.textMuted }}>—</span>
                    )}
                  </td>
                  <td style={{ ...tdSt, textAlign: "right" }}>
                    <button onClick={() => apagar(c)} title="Apagar parcela"
                            style={{
                              background: "transparent", border: `1px solid ${t.border}`, cursor: "pointer",
                              color: t.danger, padding: "5px 8px",
                              display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 600,
                            }}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr><td colSpan={11} style={{ ...tdSt, textAlign: "center", color: t.textMuted }}>Nenhuma parcela encontrada.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
