import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { T, fonts, useIsMobile } from "../theme";
import { marked } from "marked";
import DOMPurify from "dompurify";

type Msg = {
  role: "user" | "assistant";
  text: string;
  citations?: string[];
  contextNodes?: string[];
  streaming?: boolean;
  sqlSteps?: { sql: string; count: number; error?: string | null }[];
  currentStep?: string | null;  // "consultando banco…" | null
};

export default function Consultar() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const pad = isMobile ? "16px 20px" : "24px 32px";
  const padCentral = isMobile ? "24px 20px" : "32px 48px";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const p = q.trim();
    if (!p) return;
    setMsgs((m) => [...m, { role: "user", text: p }]);
    const asstIdx = msgs.length + 1;
    setMsgs((m) => [...m, { role: "assistant", text: "", streaming: true, citations: [], contextNodes: [] }]);
    setQ("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: p }),
      });
      if (!res.body) throw new Error("sem stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let ctxNodes: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";
        for (const chunk of chunks) {
          const evtMatch = chunk.match(/^event:\s*(\w+)/m);
          const dataMatch = chunk.match(/^data:\s*(.+)$/m);
          if (!evtMatch || !dataMatch) continue;
          const evt = evtMatch[1];
          let data: any;
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }

          if (evt === "context") {
            ctxNodes = data.nodes || [];
            setMsgs((m) => {
              const copy = [...m];
              copy[asstIdx] = { ...copy[asstIdx], contextNodes: ctxNodes };
              return copy;
            });
          } else if (evt === "delta") {
            acc += data.t || "";
            setMsgs((m) => {
              const copy = [...m];
              copy[asstIdx] = { ...copy[asstIdx], text: acc, currentStep: null };
              return copy;
            });
            setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 20);
          } else if (evt === "reset") {
            // Backend detectou <sql>: descarta o texto parcial deste turno (era narração).
            acc = "";
            setMsgs((m) => {
              const copy = [...m];
              copy[asstIdx] = { ...copy[asstIdx], text: "", currentStep: "consultando o banco…" };
              return copy;
            });
          } else if (evt === "sql") {
            setMsgs((m) => {
              const copy = [...m];
              const cur = copy[asstIdx];
              copy[asstIdx] = {
                ...cur,
                currentStep: "executando consulta…",
                sqlSteps: [...(cur.sqlSteps || []), { sql: data.sql || "", count: 0 }],
              };
              return copy;
            });
          } else if (evt === "sql_result") {
            setMsgs((m) => {
              const copy = [...m];
              const cur = copy[asstIdx];
              const steps = [...(cur.sqlSteps || [])];
              if (steps.length) {
                steps[steps.length - 1] = { ...steps[steps.length - 1], count: data.count || 0, error: data.error };
              }
              copy[asstIdx] = {
                ...cur, sqlSteps: steps,
                currentStep: data.error ? `erro na query: ${data.error.slice(0, 80)}` : "compondo resposta…",
              };
              return copy;
            });
          } else if (evt === "done") {
            const cited = Array.from(
              new Set(Array.from(acc.matchAll(/\[([a-z]+:[^\]]+)\]/g)).map(m => m[1]))
            );
            setMsgs((m) => {
              const copy = [...m];
              copy[asstIdx] = {
                ...copy[asstIdx], streaming: false,
                citations: cited.length ? cited : ctxNodes.slice(0, 4),
                currentStep: null,
              };
              return copy;
            });
          }
        }
      }
    } catch (err: any) {
      setMsgs((m) => {
        const copy = [...m];
        copy[asstIdx] = { role: "assistant", text: `⚠️ erro: ${err.message}`, streaming: false };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bg }}>
      <div style={{
        padding: pad,
        borderBottom: `1px solid ${T.border}`,
        background: T.headerBg, backdropFilter: "blur(8px)",
      }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.22em", color: T.textPrimary }}>
          CONSULTAR
        </div>
        <div style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em", color: T.textMuted, textTransform: "uppercase", marginTop: 4 }}>
          pergunte qualquer coisa sobre a parket
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: padCentral }}>
        {msgs.length === 0 && (
          <div style={{ maxWidth: 640, margin: "40px auto", textAlign: "center" }}>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 22, letterSpacing: "0.10em", color: T.textPrimary, marginBottom: 12 }}>
              SEGUNDA MENTE PARKET
            </div>
            <div style={{ fontFamily: fonts.inter, fontSize: 12, color: T.textSecondary, letterSpacing: "0.04em", lineHeight: 1.7, marginBottom: 40 }}>
              Cruza o banco de dados vivo, memórias, briefings e relatórios pra te devolver o mapa completo.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 2, textAlign: "left" }}>
              {[
                "Quantas propostas foram criadas essa semana?",
                "Quais cards do kanban comercial estão parados há mais de 7 dias?",
                "Resuma o estado da migração pra Hetzner",
                "Como funciona o fluxo de assinatura Docusign?",
              ].map((s) => (
                <button key={s} onClick={() => setQ(s)} style={{
                  padding: 16, background: T.cardBg, border: `1px solid ${T.border}`,
                  color: T.textSecondary, cursor: "pointer",
                  fontFamily: fonts.inter, fontSize: 11, textAlign: "left",
                  letterSpacing: "0.02em", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.borderHover; e.currentTarget.style.color = T.textPrimary; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSecondary; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{
            maxWidth: 820, margin: "0 auto 20px",
            display: "flex", flexDirection: "column",
            alignItems: m.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.22em",
              color: T.textMuted, textTransform: "uppercase", marginBottom: 8,
            }}>
              {m.role === "user" ? "você" : "núcleo"}
              {m.streaming && m.currentStep && (
                <span style={{ marginLeft: 8, color: T.walnut, textTransform: "none", letterSpacing: "0.06em" }}>
                  ▪ {m.currentStep}
                </span>
              )}
              {m.streaming && !m.currentStep && (
                <span style={{ marginLeft: 8, color: T.walnut }}>▪ streaming…</span>
              )}
            </div>

            {/* Chips das queries executadas — pequeno feedback do que rolou */}
            {m.role === "assistant" && m.sqlSteps && m.sqlSteps.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {m.sqlSteps.map((s, k) => (
                  <span key={k} style={{
                    fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.06em",
                    color: s.error ? "#B85B4C" : T.textMuted,
                    padding: "2px 6px", border: `1px solid ${T.border}`,
                    background: T.statBg,
                  }} title={s.sql}>
                    {s.error ? "⚠ query com erro" : `▸ query · ${s.count} linhas`}
                  </span>
                ))}
              </div>
            )}

            {/* Chips de contexto RAG aparecem ANTES do texto */}
            {m.role === "assistant" && m.contextNodes && m.contextNodes.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                {m.contextNodes.slice(0, 6).map((c) => (
                  <Link
                    key={c}
                    to={`/?focus=${encodeURIComponent(c)}`}
                    style={{
                      background: T.statBg, border: `1px solid ${T.border}`,
                      color: T.textMuted, padding: "3px 8px", textDecoration: "none",
                      fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.10em",
                    }}
                    title={`Ver no núcleo: ${c}`}
                  >
                    ◆ {c.replace(/^[a-z]+:/, "").slice(0, 42)}
                  </Link>
                ))}
              </div>
            )}

            <div style={{
              padding: "18px 22px",
              background: m.role === "user" ? "transparent" : T.cardBg,
              border: `1px solid ${m.role === "user" ? T.border : T.borderHover}`,
              color: T.textPrimary,
              fontFamily: fonts.inter, fontSize: 13, lineHeight: 1.7,
              letterSpacing: "0.02em",
              maxWidth: "100%",
            }}
              dangerouslySetInnerHTML={{
                __html: m.role === "assistant"
                  ? DOMPurify.sanitize(marked.parse(m.text || (m.streaming ? "…" : "")) as string)
                  : m.text,
              }}
            />

            {/* Citações confirmadas (extraídas do [id]) */}
            {!m.streaming && m.citations && m.citations.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 12 }}>
                {m.citations.map((c) => (
                  <Link
                    key={c}
                    to={`/?focus=${encodeURIComponent(c)}`}
                    style={{
                      background: T.walnut, color: T.bg,
                      padding: "3px 8px", textDecoration: "none",
                      fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.10em",
                    }}
                    title={`Ver no núcleo: ${c}`}
                  >
                    ◆ {c.replace(/^[a-z]+:/, "").slice(0, 42)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} style={{ padding: isMobile ? "14px 16px" : "20px 48px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pergunte ao núcleo…"
          disabled={loading}
          style={{
            flex: 1, padding: "14px 18px",
            background: T.inputBg, border: `1px solid ${T.border}`,
            color: T.textPrimary, outline: "none",
            fontFamily: fonts.inter, fontSize: 13, letterSpacing: "0.02em",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = T.borderHover)}
          onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
        />
        <button type="submit" disabled={loading || !q.trim()} style={{
          padding: isMobile ? "0 18px" : "0 32px",
          background: loading ? T.textSecondary : T.textPrimary,
          color: T.bg, border: "none", cursor: loading ? "wait" : "pointer",
          fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.22em",
          textTransform: "uppercase", transition: "background 0.2s",
        }}>
          {isMobile ? "→" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
