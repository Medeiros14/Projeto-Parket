// gravacoes-wavoip-pkt1.js
// ────────────────────────────────────────────────────────────────────
// Componente de lista de Gravações Wavoip do setor Comercial.
// Lê wavoip_calls (Supabase + RLS authenticated) filtrado por card_setor.
// Mostra: número, data, direção, duração, status, link de download da gravação.
// Lazy-importado pelo dept-comercial. Padrão idêntico ao status-report-pkt1.js.
// ────────────────────────────────────────────────────────────────────
import { r as React, s as supabase, j as _jrt } from "./index-DZtetJYP.js";

const h = _jrt.jsx;
const hs = _jrt.jsxs;
const u = React;

const STATUS_LABEL = {
  ENDED: "Encerrada",
  REJECTED: "Rejeitada",
  FAILED: "Falhou",
  NOT_ANSWERED: "Não atendida",
  ACTIVE: "Em curso",
  OUTGOING_RING: "Tocando",
  INCOMING_RING: "Entrante",
  CONNECTING: "Conectando",
  HANDLED_REMOTELY: "Atendida em outro",
};
const STATUS_COLOR = {
  ENDED: "#22C55E",
  REJECTED: "#EF4444",
  FAILED: "#EF4444",
  NOT_ANSWERED: "#F59E0B",
  ACTIVE: "#3B82F6",
  OUTGOING_RING: "#3B82F6",
  INCOMING_RING: "#3B82F6",
  CONNECTING: "#A1A1AA",
  HANDLED_REMOTELY: "#A78BFA",
};

function fmtDuration(s) {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

function fmtPhone(p) {
  if (!p) return "—";
  // 5511999999999 → +55 11 99999-9999
  const s = String(p).replace(/\D/g,"");
  if (s.length === 13) return `+${s.slice(0,2)} ${s.slice(2,4)} ${s.slice(4,9)}-${s.slice(9)}`;
  if (s.length === 12) return `+${s.slice(0,2)} ${s.slice(2,4)} ${s.slice(4,8)}-${s.slice(8)}`;
  return p;
}

export default function GravacoesWavoip() {
  const [calls, setCalls] = u.useState([]);
  const [loading, setLoading] = u.useState(true);
  const [err, setErr] = u.useState(null);
  const [filter, setFilter] = u.useState("all"); // all | with-rec | no-rec

  async function fetchCalls() {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("wavoip_calls")
        .select("*")
        .eq("card_setor", "comercial")
        .order("iniciada_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      setCalls(data || []);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  u.useEffect(() => {
    fetchCalls();
    // Refresh quando aba ganha foco
    const onVis = () => { if (!document.hidden) fetchCalls(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const filtered = u.useMemo(() => {
    if (filter === "with-rec") return calls.filter(c => c.record_url);
    if (filter === "no-rec") return calls.filter(c => !c.record_url);
    return calls;
  }, [calls, filter]);

  const stats = u.useMemo(() => {
    const total = calls.length;
    const comGravacao = calls.filter(c => c.record_url).length;
    const ended = calls.filter(c => c.status === "ENDED").length;
    const failed = calls.filter(c => ["FAILED","REJECTED","NOT_ANSWERED"].includes(c.status)).length;
    return { total, comGravacao, ended, failed };
  }, [calls]);

  return h("div", { style: { padding: 20, color: "#E5E7EB" } },
    // Header
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
      h("div", {},
        h("h2", { style: { margin: 0, fontSize: 20, fontWeight: 700 } }, "Gravações de Chamadas"),
        h("div", { style: { fontSize: 11, color: "#9CA3AF", marginTop: 4 } },
          "Comercial · capturadas via webhook Wavoip · atualiza ao focar a aba"
        ),
      ),
      h("button", {
        onClick: fetchCalls,
        style: {
          padding: "6px 12px", fontSize: 12, fontWeight: 600,
          background: "#27272A", color: "#E5E7EB",
          border: "1px solid #3F3F46", borderRadius: 4, cursor: "pointer",
        },
      }, loading ? "Atualizando…" : "↻ Atualizar"),
    ),

    // Stats cards
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 } },
      [
        ["Total", stats.total, "#A1A1AA"],
        ["Com gravação", stats.comGravacao, "#22C55E"],
        ["Encerradas", stats.ended, "#3B82F6"],
        ["Falhas", stats.failed, "#EF4444"],
      ].map(([label, value, color], idx) =>
        h("div", {
          key: idx,
          style: {
            background: "#18181B", border: "1px solid #27272A", borderRadius: 6,
            padding: 12,
          }
        },
          h("div", { style: { fontSize: 10, color: "#71717A", textTransform: "uppercase", fontWeight: 700 } }, label),
          h("div", { style: { fontSize: 22, fontWeight: 700, color, marginTop: 4 } }, value),
        )
      )
    ),

    // Filter
    h("div", { style: { display: "flex", gap: 6, marginBottom: 12 } },
      [
        ["all", "Todas"],
        ["with-rec", "Com gravação"],
        ["no-rec", "Sem gravação"],
      ].map(([k, lbl]) =>
        h("button", {
          key: k,
          onClick: () => setFilter(k),
          style: {
            padding: "5px 10px", fontSize: 11, fontWeight: 600,
            background: filter === k ? "#3B82F6" : "transparent",
            color: filter === k ? "#fff" : "#A1A1AA",
            border: "1px solid " + (filter === k ? "#3B82F6" : "#3F3F46"),
            borderRadius: 4, cursor: "pointer",
          },
        }, lbl)
      )
    ),

    // Lista
    err ? h("div", { style: { color: "#EF4444", padding: 12, background: "#1F1F1F", borderRadius: 4, fontSize: 12 } }, `Erro: ${err}`)
      : loading ? h("div", { style: { color: "#9CA3AF", padding: 30, textAlign: "center", fontSize: 12 } }, "Carregando…")
      : filtered.length === 0 ? h("div", { style: { color: "#9CA3AF", padding: 30, textAlign: "center", fontSize: 12 } },
          calls.length === 0
            ? "Nenhuma chamada registrada ainda. Configure o webhook no painel Wavoip pra começar."
            : "Nenhuma chamada com esse filtro."
        )
      : h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
          filtered.map(c => {
            const otherSide = c.direction === "OUTCOMING" ? c.receiver : c.caller;
            const isOut = c.direction === "OUTCOMING";
            const statusColor = STATUS_COLOR[c.status] || "#9CA3AF";
            return h("div", {
              key: c.id,
              style: {
                display: "grid",
                gridTemplateColumns: "24px 140px 1fr 90px 90px 100px 30px",
                gap: 12, padding: "10px 12px",
                background: "#0F0F0F", border: "1px solid #27272A", borderRadius: 4,
                alignItems: "center", fontSize: 12,
              },
            },
              // direção icone
              h("div", { style: { color: isOut ? "#22C55E" : "#3B82F6", fontWeight: 700, fontSize: 14 } },
                isOut ? "↗" : "↙"
              ),
              // data
              h("div", { style: { color: "#A1A1AA" } }, fmtDate(c.iniciada_em)),
              // número
              h("div", { style: { fontFamily: "monospace", fontSize: 12, color: "#E5E7EB" } }, fmtPhone(otherSide)),
              // duração
              h("div", { style: { color: "#A1A1AA", textAlign: "right", fontFamily: "monospace" } }, fmtDuration(c.duration)),
              // status badge
              h("div", { style: { textAlign: "center" } },
                h("span", {
                  style: {
                    padding: "2px 6px", fontSize: 10, fontWeight: 700,
                    background: statusColor + "20",
                    color: statusColor,
                    borderRadius: 3,
                  },
                }, STATUS_LABEL[c.status] || c.status || "—")
              ),
              // gravação
              c.record_url
                ? h("audio", { src: c.record_url, controls: true, preload: "none", style: { width: "100%", height: 28 } })
                : h("div", { style: { color: "#52525B", fontSize: 10, textAlign: "center" } }, "—"),
              // download
              c.record_url
                ? h("a", {
                    href: c.record_url, target: "_blank", rel: "noopener",
                    title: "Baixar gravação",
                    style: { color: "#A1A1AA", textDecoration: "none", fontSize: 14, textAlign: "center" },
                  }, "⬇")
                : h("span", {}, ""),
            );
          })
        ),
    h("div", { style: { fontSize: 10, color: "#52525B", marginTop: 16, textAlign: "center" } },
      `Mostrando ${filtered.length} de ${calls.length} chamada(s)`
    )
  );
}
