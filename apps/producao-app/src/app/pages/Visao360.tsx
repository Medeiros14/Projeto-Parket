/** Visão 360º do projeto — timeline horizontal das 8 etapas do PCP por OP do cliente,
 *  lista de itens com status_producao, e registros ad-hoc de Prensa/Marcenaria abaixo. */
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { AlertTriangle, Check, Eye, Package, Printer, Ruler, Wrench } from "lucide-react";
import {
  ETAPAS, Ordem, RegistroPrensa, RegistroMarcenaria, ItemFabricacao,
  fetchOrdens, fetchPrensa, fetchMarcenaria, fmtData, imprimirDoc, labelItemFab,
  contagemPorCategoria,
} from "../lib/producao";

const norm = (s: string) => String(s || "").trim().toUpperCase();
const casa = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};

// Rótulos curtos das 8 etapas pra caber na timeline horizontal
const ETAPA_SHORT = [
  "Validação", "Prensa & Sep.", "Produção", "CQ & Emb.",
  "Logística", "Em Obra", "Finalizado", "Manutenção",
];

const statusItemCor = (t: any, s: string | null | undefined) => {
  const up = norm(s || "");
  if (!up) return t.textMuted;
  if (up.includes("PARALIS")) return t.danger;
  if (up.includes("FINAL")) return t.success;
  if (up.includes("EMBAL") || up.includes("QUALID")) return t.info;
  if (up.includes("ACAB")) return "#F97316";
  if (up.includes("CONSTR") || up.includes("ANDAM")) return t.accent;
  return t.textSecondary;
};

export default function Visao360() {
  const { t } = useTheme();
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [prensa, setPrensa] = useState<RegistroPrensa[]>([]);
  const [marcenaria, setMarcenaria] = useState<RegistroMarcenaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState("");

  useEffect(() => {
    (async () => {
      const [o, p, m] = await Promise.all([fetchOrdens(), fetchPrensa(), fetchMarcenaria()]);
      setOrdens(o); setPrensa(p); setMarcenaria(m); setLoading(false);
    })();
  }, []);

  const clientes = useMemo(() => {
    const set = new Set<string>();
    prensa.forEach((r) => r.cliente && set.add(norm(r.cliente)));
    marcenaria.forEach((r) => r.cliente && set.add(norm(r.cliente)));
    ordens.forEach((o) => {
      if (o.cliente_projeto) set.add(norm(o.cliente_projeto));
      if (o.projeto) set.add(norm(o.projeto));
    });
    return Array.from(set).sort();
  }, [ordens, prensa, marcenaria]);

  const opsDoCliente = useMemo(
    () => cliente ? ordens.filter((o) => casa(o.cliente_projeto, cliente) || casa(o.projeto, cliente)) : [],
    [cliente, ordens]
  );
  const prensaDoCliente = useMemo(
    () => cliente ? prensa.filter((r) => casa(r.cliente, cliente)) : [],
    [cliente, prensa]
  );
  const marcDoCliente = useMemo(
    () => cliente ? marcenaria.filter((r) => casa(r.cliente, cliente)) : [],
    [cliente, marcenaria]
  );

  const kpis = useMemo(() => {
    const itensOP = opsDoCliente.flatMap((o) => o.itens || []);
    const paralisadosOp = itensOP.filter((i) => norm(i.status_producao).includes("PARALIS")).length
      + prensaDoCliente.filter((r) => norm(r.status).includes("PARALIS")).length
      + marcDoCliente.filter((r) => norm(r.status).includes("PARALIS")).length;
    return {
      ops: opsDoCliente.length,
      itensOP: itensOP.length,
      prensa: prensaDoCliente.length,
      marc: marcDoCliente.length,
      paralisados: paralisadosOp,
    };
  }, [opsDoCliente, prensaDoCliente, marcDoCliente]);

  function imprimir() {
    const linhas: string[][] = [];
    opsDoCliente.forEach((o) => {
      linhas.push(["PCP", o.id, o.projeto || o.cliente_projeto, o.etapa, fmtData(o.data), fmtData(o.prazo_entrega), o.pedido_por || "PCP"]);
      (o.itens || []).forEach((it) => linhas.push([
        "  Item", labelItemFab(it), (it.descritivo || "").slice(0, 60), it.status_producao || "—", "", "", "",
      ]));
    });
    prensaDoCliente.forEach((r) => linhas.push(["Prensa", r.item, r.lamina_natural, r.status, fmtData(r.inicio), fmtData(r.entrega), "Equipe"]));
    marcDoCliente.forEach((r) => linhas.push(["Marcenaria", r.item, r.acabamento, r.status, fmtData(r.inicio), fmtData(r.entrega), r.equipe || "Equipe"]));
    imprimirDoc(
      `FICHA DO PROJETO — ${cliente}`,
      ["Setor", "Item", "Detalhe", "Status", "Início", "Entrega", "Responsável"],
      linhas
    );
  }

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>;

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none",
  };
  const kpi: React.CSSProperties = { background: t.cardBg, border: `1px solid ${t.border}`, padding: "14px 16px" };
  const kpiTit: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: t.textMuted };
  const kpiVal: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: t.textPrimary, marginTop: 4 };
  const secTit: React.CSSProperties = {
    fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
    color: t.textSecondary, margin: "18px 0 8px", display: "flex", alignItems: "center", gap: 6,
  };
  const th: React.CSSProperties = {
    padding: "9px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase",
    letterSpacing: "0.08em", color: t.textMuted, borderBottom: `1px solid ${t.border}`,
  };
  const td: React.CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${t.border}`, color: t.textSecondary };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <Eye size={17} style={{ color: t.accent }} /> Visão 360º do Projeto
          </h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            Onde cada projeto está no PCP — timeline das 8 etapas + itens em produção.
          </div>
        </div>
        {cliente && (opsDoCliente.length + prensaDoCliente.length + marcDoCliente.length) > 0 && (
          <button onClick={imprimir} style={{
            background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`,
            padding: "8px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}><Printer size={13} /> Imprimir ficha do projeto</button>
        )}
      </header>

      <div>
        <div style={{ fontSize: 10, color: t.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Cliente / Projeto</div>
        <input list="dl-clientes" value={cliente} onChange={(e) => setCliente(e.target.value)}
               placeholder="Digite ou selecione um cliente…" style={{ ...inp, minWidth: 320 }} />
        <datalist id="dl-clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
      </div>

      {!cliente && (
        <div style={{
          background: t.cardBg, border: `1px dashed ${t.border}`, padding: 48,
          textAlign: "center", color: t.textMuted, fontSize: 13,
        }}>
          Selecione um cliente acima para ver a jornada do projeto no PCP.
        </div>
      )}

      {cliente && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
            <div style={kpi}><div style={kpiTit}>Ordens de Produção</div><div style={kpiVal}>{kpis.ops}</div></div>
            <div style={kpi}><div style={kpiTit}>Itens em Fabricação</div><div style={{ ...kpiVal, color: t.accent }}>{kpis.itensOP}</div></div>
            <div style={kpi}><div style={kpiTit}>Registros Prensa</div><div style={{ ...kpiVal, color: t.info }}>{kpis.prensa}</div></div>
            <div style={kpi}><div style={kpiTit}>Registros Marcenaria</div><div style={{ ...kpiVal, color: t.info }}>{kpis.marc}</div></div>
            <div style={kpi}><div style={kpiTit}>Paralisados</div>
              <div style={{ ...kpiVal, color: kpis.paralisados > 0 ? t.danger : t.success }}>{kpis.paralisados}</div></div>
          </div>

          {opsDoCliente.length > 0 && (
            <div>
              <div style={secTit}><Package size={12} /> Ordens de Produção · {opsDoCliente.length}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {opsDoCliente.map((o) => <OpCard key={o.id} o={o} t={t} />)}
              </div>
            </div>
          )}

          {prensaDoCliente.length > 0 && (
            <div>
              <div style={secTit}><Ruler size={12} /> Prensa · {prensaDoCliente.length}</div>
              <div style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr>
                    <th style={th}>Item</th><th style={th}>Lâmina natural</th>
                    <th style={th}>Status</th><th style={th}>Início</th><th style={th}>Entrega</th><th style={th}>Observação</th>
                  </tr></thead>
                  <tbody>
                    {prensaDoCliente.map((r) => (
                      <tr key={r.id}>
                        <td style={{ ...td, color: t.textPrimary, fontWeight: 600 }}>{r.item || "—"}</td>
                        <td style={td}>{r.lamina_natural || "—"}</td>
                        <td style={{ ...td, fontWeight: 700, color: statusItemCor(t, r.status) }}>{r.status || "—"}</td>
                        <td style={td}>{fmtData(r.inicio)}</td>
                        <td style={td}>{fmtData(r.entrega)}</td>
                        <td style={td}>{r.observacao || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {marcDoCliente.length > 0 && (
            <div>
              <div style={secTit}><Wrench size={12} /> Marcenaria · {marcDoCliente.length}</div>
              <div style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr>
                    <th style={th}>Item</th><th style={th}>Acabamento</th><th style={th}>Equipe</th>
                    <th style={th}>Status</th><th style={th}>Início</th><th style={th}>Entrega</th>
                  </tr></thead>
                  <tbody>
                    {marcDoCliente.map((r) => (
                      <tr key={r.id}>
                        <td style={{ ...td, color: t.textPrimary, fontWeight: 600 }}>{r.item || "—"}</td>
                        <td style={td}>{r.acabamento || "—"}</td>
                        <td style={td}>{r.equipe || "—"}</td>
                        <td style={{ ...td, fontWeight: 700, color: statusItemCor(t, r.status) }}>{r.status || "—"}</td>
                        <td style={td}>{fmtData(r.inicio)}</td>
                        <td style={td}>{fmtData(r.entrega)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {opsDoCliente.length + prensaDoCliente.length + marcDoCliente.length === 0 && (
            <div style={{
              background: t.cardBg, border: `1px dashed ${t.border}`, padding: 40,
              textAlign: "center", color: t.textMuted, fontSize: 12.5,
            }}>
              Nenhuma OP, prensa ou marcenaria encontrada pra este cliente.
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Card da OP: cabeçalho + timeline horizontal + lista de itens ────────── */
function OpCard({ o, t }: { o: Ordem; t: any }) {
  const [aberto, setAberto] = useState(true);
  const idxAtual = ETAPAS.findIndex((e) => e.nome === o.etapa);
  const finalizado = idxAtual >= ETAPAS.findIndex((e) => e.nome === "7. FINALIZADO");
  const itens = o.itens || [];
  const porCat = contagemPorCategoria(itens);

  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
      {/* Cabeçalho */}
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ color: t.accent, fontSize: 13 }}>{o.id}</strong>
            <span style={{ fontSize: 13, color: t.textPrimary }}>{o.cliente_projeto}</span>
            {/* Um chip por categoria da proposta (PAINEL, FORRO, PORTA…),
                nunca rotulando tudo como MARCENARIA. */}
            {porCat.map((c) => (
              <span key={c.cat} style={{
                background: t.inputBg, color: t.textSecondary, padding: "2px 8px",
                fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700,
              }}>{c.label}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted }}>
            Prazo: {fmtData(o.prazo_entrega)} · Pedido por {o.pedido_por || "—"}
            {o.projeto && o.projeto !== o.cliente_projeto ? ` · Obra: ${o.projeto}` : ""}
          </div>
        </div>
        <button onClick={() => setAberto((v) => !v)} style={{
          background: "transparent", color: t.textSecondary, border: `1px solid ${t.border}`,
          padding: "5px 10px", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {aberto ? "Recolher itens" : `Ver ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
        </button>
      </div>

      {/* Timeline horizontal das 8 etapas */}
      <div style={{ padding: "18px 16px 14px", overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", minWidth: 720 }}>
          {ETAPAS.map((e, i) => {
            const done = i < idxAtual || (finalizado && i <= idxAtual);
            const current = i === idxAtual && !finalizado;
            const cor = done ? t.success : current ? t.accent : t.border;
            const corTexto = done || current ? t.textPrimary : t.textMuted;
            return (
              <div key={e.nome} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                {/* linha conectora */}
                {i > 0 && (
                  <div style={{
                    position: "absolute", top: 11, left: "-50%", width: "100%", height: 2,
                    background: i <= idxAtual ? t.success : t.border,
                  }} />
                )}
                {/* bolinha */}
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: done ? t.success : t.cardBg,
                  border: `2px solid ${cor}`, display: "grid", placeItems: "center",
                  color: done ? t.bg : cor, fontSize: 11, fontWeight: 700, zIndex: 1, flexShrink: 0,
                }}>
                  {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                </div>
                <div style={{
                  marginTop: 6, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: corTexto, fontWeight: current ? 700 : 500, textAlign: "center", lineHeight: 1.3,
                }}>
                  {ETAPA_SHORT[i]}
                </div>
                {current && (
                  <div style={{ marginTop: 3, fontSize: 8.5, color: t.accent, fontWeight: 700, letterSpacing: "0.05em" }}>
                    ← ATUAL
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista dos itens da OP com status_producao */}
      {aberto && itens.length > 0 && (
        <div style={{ borderTop: `1px solid ${t.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>Item</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>Detalhe</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>Metragem</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>Status da fabricação</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, k) => <ItemRow key={k} it={it} t={t} />)}
            </tbody>
          </table>
        </div>
      )}
      {aberto && itens.length === 0 && (
        <div style={{ padding: "18px 16px", fontSize: 11.5, color: t.textMuted, borderTop: `1px solid ${t.border}` }}>
          Sem itens de fabricação na OP.
        </div>
      )}
    </div>
  );
}

function ItemRow({ it, t }: { it: ItemFabricacao; t: any }) {
  const paralisado = norm(it.status_producao).includes("PARALIS");
  const label = labelItemFab(it);
  const detalhe = it.categoria === "porta" && it.porta?.largura_cm && it.porta?.altura_cm
    ? `${it.porta.largura_cm}×${it.porta.altura_cm} cm${it.porta.tipo ? " · " + it.porta.tipo.toUpperCase() : ""}`
    : (it.dimensao && it.dimensao !== "—" ? it.dimensao : (it.cor || ""));
  return (
    <tr>
      <td style={{ padding: "8px 12px", borderBottom: `1px solid ${t.border}`, color: t.textPrimary, fontWeight: 600 }}>
        {paralisado && <AlertTriangle size={11} style={{ color: t.danger, marginRight: 4, verticalAlign: "-1px" }} />}
        {label}
      </td>
      <td style={{ padding: "8px 12px", borderBottom: `1px solid ${t.border}`, color: t.textSecondary }}>
        {detalhe || "—"}
      </td>
      <td style={{ padding: "8px 12px", borderBottom: `1px solid ${t.border}`, color: t.textSecondary, textAlign: "right", whiteSpace: "nowrap" }}>
        {it.metragem ? `${it.metragem.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²` : "—"}
      </td>
      <td style={{ padding: "8px 12px", borderBottom: `1px solid ${t.border}`, color: statusItemCor(t, it.status_producao), fontWeight: 700, fontSize: 11 }}>
        {(it.status_producao || "AGUARDANDO").toUpperCase()}
      </td>
    </tr>
  );
}
