import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fonts, useTokens } from "../theme";
import { api, type ConversaResumo, type WhatsappMessage } from "../api";
import { MsgBubble, dataMsg, statusChatCor } from "./Projeto";
import { AlertarProblemaModal } from "./Crises";

/** Central de Relacionamento — estrutura estilo atendimento do Homebroker:
 *  KPIs no topo, filtro Grupos × Clientes, abas de status, busca,
 *  lista de conversas à esquerda e chat à direita (Will 16/07). */

const POLL_MS = 20_000;

type TipoFiltro = "todas" | "grupos" | "clientes";
type StatusFiltro = "todas" | "nao_lidas" | "aguardando" | "respondidas" | "resolvidas";

function tituloConversa(c: ConversaResumo): string {
  if (c.subject) return c.subject;
  if (c.cliente) return c.cliente;
  const num = (c.grupo_jid || "").split("@")[0];
  return num ? `+${num}` : "—";
}

function iniciais(nome: string): string {
  const parts = nome.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return "";
  const dif = Date.now() - new Date(iso).getTime();
  const min = Math.floor(dif / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const aguardandoResposta = (c: ConversaResumo) =>
  c.last_msg_from_me === false && !c.resolved_at;
const respondida = (c: ConversaResumo) =>
  c.last_msg_from_me === true && !c.resolved_at;

export default function RelacionamentoPage() {
  const t = useTokens();
  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<TipoFiltro>("todas");
  const [status, setStatus] = useState<StatusFiltro>("todas");
  const [selId, setSelId] = useState<string | null>(null);

  const load = () => {
    api.relacionamentoConversas()
      .then(rows => setConversas(rows))
      .catch(e => setErro(String(e.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // KPIs sobre o conjunto inteiro (não muda com filtro/busca)
  const kpi = useMemo(() => ({
    abertas: conversas.filter(c => !c.resolved_at).length,
    naoLidas: conversas.filter(c => (c.unread_count || 0) > 0).length,
    aguardando: conversas.filter(aguardandoResposta).length,
    grupos: conversas.filter(c => c.is_grupo).length,
    clientes: conversas.filter(c => !c.is_grupo).length,
  }), [conversas]);

  const filtradas = useMemo(() => {
    let list = conversas;
    if (tipo === "grupos") list = list.filter(c => c.is_grupo);
    if (tipo === "clientes") list = list.filter(c => !c.is_grupo);
    if (status === "nao_lidas") list = list.filter(c => (c.unread_count || 0) > 0);
    if (status === "aguardando") list = list.filter(aguardandoResposta);
    if (status === "respondidas") list = list.filter(respondida);
    if (status === "resolvidas") list = list.filter(c => !!c.resolved_at);
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(c =>
        (c.subject || "").toLowerCase().includes(s) ||
        (c.cliente || "").toLowerCase().includes(s) ||
        (c.obra_code || "").toLowerCase().includes(s) ||
        (c.grupo_jid || "").toLowerCase().includes(s) ||
        (c.last_msg_preview || "").toLowerCase().includes(s));
    }
    return list;
  }, [conversas, tipo, status, q]);

  const sel = conversas.find(c => c.id === selId) || null;

  return (
    <div style={{
      height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr",
      background: t.bg, overflow: "hidden",
    }}>
      {/* Header + KPIs */}
      <div style={{ padding: "16px 32px 12px", borderBottom: `1px solid ${t.border1}`, background: t.card1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textPrimary }}>
              Relacionamento
            </div>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: t.textTertiary, textTransform: "uppercase", marginTop: 4 }}>
              Central de conversas WhatsApp · Painel CS
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Kpi label="Abertas" valor={kpi.abertas} cor={t.accent} t={t} />
            <Kpi label="Não lidas" valor={kpi.naoLidas} cor="#B85B4C" pulse={kpi.naoLidas > 0} t={t} />
            <Kpi label="Aguardando" valor={kpi.aguardando} cor="#C7A45B" t={t} />
            <Kpi label="Grupos" valor={kpi.grupos} cor="#8CA9B8" t={t} />
            <Kpi label="Clientes" valor={kpi.clientes} cor="#7BA394" t={t} />
          </div>
        </div>
      </div>

      {/* Filtros: tipo + status + busca */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: "10px 32px", borderBottom: `1px solid ${t.border1}`, background: t.card1,
      }}>
        <div style={{ display: "flex", border: `1px solid ${t.border1}` }}>
          {([["todas", "Todas"], ["grupos", "Grupos"], ["clientes", "Clientes"]] as [TipoFiltro, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setTipo(v)} style={{
              padding: "6px 14px", cursor: "pointer", border: "none",
              background: tipo === v ? t.accent : "transparent",
              color: tipo === v ? t.bg : t.textSecondary,
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase",
            }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([["todas", "Todas"], ["nao_lidas", "Não lidas"], ["aguardando", "Aguardando"], ["respondidas", "Respondidas"], ["resolvidas", "Resolvidas"]] as [StatusFiltro, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setStatus(v)} style={{
              padding: "5px 11px", cursor: "pointer",
              background: status === v ? t.card2 : "transparent",
              border: `1px solid ${status === v ? t.accent : t.border1}`,
              color: status === v ? t.textPrimary : t.textTertiary,
              fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: fonts.inter,
            }}>
              {label}
            </button>
          ))}
        </div>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar cliente / grupo / obra / mensagem…"
          style={{
            flex: 1, minWidth: 220, padding: "8px 12px",
            background: t.card2, border: `1px solid ${t.border1}`, color: t.textPrimary,
            outline: "none", fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.04em",
          }}
        />
        <span style={{ fontSize: 9, color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {filtradas.length} conversa{filtradas.length === 1 ? "" : "s"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", overflow: "hidden", minHeight: 0 }}>
        {/* ─── Lista de conversas ─── */}
        <aside style={{
          borderRight: `1px solid ${t.border1}`, background: t.card1,
          overflowY: "auto",
        }}>
          {loading && <div style={emptyStyle(t)}>carregando…</div>}
          {erro && (
            <div style={{
              margin: 12, padding: "8px 12px", background: "rgba(184,91,76,0.14)",
              border: "1px solid #B85B4C", color: "#B85B4C", fontSize: 10,
            }}>{erro}</div>
          )}
          {!loading && !erro && filtradas.length === 0 && (
            <div style={emptyStyle(t)}>nenhuma conversa</div>
          )}
          {filtradas.map(c => {
            const active = c.id === selId;
            const titulo = tituloConversa(c);
            const naoLida = (c.unread_count || 0) > 0;
            return (
              <button key={c.id} onClick={() => setSelId(c.id)} style={{
                display: "flex", gap: 10, width: "100%", textAlign: "left",
                padding: "11px 14px", cursor: "pointer", alignItems: "flex-start",
                background: active ? t.card2 : "transparent", border: "none",
                borderLeft: active ? `2px solid ${t.accent}` : "2px solid transparent",
                borderBottom: `1px solid ${t.border1}`,
              }}>
                {/* Avatar */}
                <div style={{
                  position: "relative", flexShrink: 0,
                  width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                  background: c.is_grupo ? "rgba(140,169,184,0.16)" : "rgba(123,163,148,0.16)",
                  border: `1px solid ${c.is_grupo ? "rgba(140,169,184,0.45)" : "rgba(123,163,148,0.45)"}`,
                  color: c.is_grupo ? "#8CA9B8" : "#7BA394",
                  fontSize: 11, fontWeight: 600, fontFamily: fonts.inter,
                }}>
                  {iniciais(titulo)}
                  {naoLida && (
                    <span style={{
                      position: "absolute", top: -5, right: -5, minWidth: 15, height: 15,
                      borderRadius: 999, background: "#B85B4C", color: "#fff",
                      fontSize: 8, fontWeight: 700, display: "flex",
                      alignItems: "center", justifyContent: "center", padding: "0 3px",
                    }}>
                      {c.unread_count > 99 ? "99+" : c.unread_count}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{
                      fontFamily: fonts.inter, fontSize: 12, fontWeight: naoLida ? 700 : 600,
                      color: active || naoLida ? t.textPrimary : t.textSecondary,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {titulo}
                    </span>
                    <span style={{ fontSize: 9, color: t.textTertiary, flexShrink: 0 }}>
                      {tempoRelativo(c.last_msg_at)}
                    </span>
                  </div>
                  {c.last_msg_preview && (
                    <div style={{
                      fontSize: 10, color: naoLida ? t.textSecondary : t.textTertiary, marginTop: 3,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {c.last_msg_from_me ? "Você: " : ""}{c.last_msg_preview}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 7, letterSpacing: "0.18em", padding: "2px 6px", textTransform: "uppercase",
                      color: c.is_grupo ? "#8CA9B8" : "#7BA394",
                      border: `1px solid ${c.is_grupo ? "rgba(140,169,184,0.45)" : "rgba(123,163,148,0.45)"}`,
                    }}>
                      {c.is_grupo ? "Grupo" : "Cliente"}
                    </span>
                    {c.status && (
                      <span style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: statusChatCor(c.status) }}>
                        ● {c.status.replace("_", " ")}
                      </span>
                    )}
                    {c.obra_code && (
                      <span style={{ fontSize: 8, letterSpacing: "0.12em", color: t.textTertiary, textTransform: "uppercase" }}>
                        {c.obra_code}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* ─── Chat ─── */}
        <div style={{ overflow: "hidden", minWidth: 0 }}>
          {sel ? (
            <ChatPane key={sel.id} conversa={sel} t={t} />
          ) : (
            <div style={{
              height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              color: t.textTertiary, fontFamily: fonts.cinzel, fontSize: 10,
              letterSpacing: "0.24em", textTransform: "uppercase",
            }}>
              {loading ? "carregando…" : "selecione uma conversa"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, valor, cor, pulse, t }: {
  label: string; valor: number; cor: string; pulse?: boolean; t: any;
}) {
  return (
    <div style={{
      padding: "8px 16px", background: t.card2, border: `1px solid ${t.border1}`,
      borderTop: `2px solid ${cor}`, minWidth: 86, textAlign: "center",
    }}>
      <div style={{
        fontSize: 20, fontWeight: 600, color: cor, fontFamily: fonts.inter,
        fontVariantNumeric: "tabular-nums" as any,
        animation: pulse ? "pkt-kpi-pulse 2s ease-in-out infinite" : undefined,
      }}>
        {valor}
      </div>
      <div style={{ fontSize: 8, letterSpacing: "0.20em", textTransform: "uppercase", color: t.textTertiary, marginTop: 2 }}>
        {label}
      </div>
      {pulse && <style>{`@keyframes pkt-kpi-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }`}</style>}
    </div>
  );
}

/** Chat genérico por jid — funciona pra grupo e cliente, com ou sem projeto. */
function ChatPane({ conversa, t }: { conversa: ConversaResumo; t: any }) {
  const [mensagens, setMensagens] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [alertar, setAlertar] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setErro(null);
    api.relacionamentoChat(conversa.grupo_jid, conversa.card_id)
      .then(r => setMensagens(r.mensagens || []))
      .catch(e => setErro(String(e.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [conversa.id]);

  useEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensagens.length]);

  const enviar = async () => {
    const txt = texto.trim();
    if (!txt || enviando) return;
    setEnviando(true);
    try {
      const optimistic: WhatsappMessage = {
        id: `tmp-${Date.now()}`, phone: conversa.grupo_jid,
        instance: conversa.instance_name, direction: "out",
        sender_name: "Você", message_text: txt, message_type: "conversation",
        media_url: null, timestamp: new Date().toISOString(),
        evolution_msg_id: null, card_id: conversa.card_id,
      };
      setMensagens(prev => [...prev, optimistic]);
      setTexto("");
      await api.relacionamentoChatSend(
        conversa.grupo_jid, txt, conversa.instance_name, conversa.card_id,
        localStorage.getItem("gestao_user_email"));
      setTimeout(load, 800);
    } catch (e: any) {
      setErro(String(e.message || e));
    } finally {
      setEnviando(false);
    }
  };

  const titulo = tituloConversa(conversa);

  return (
    <section style={{
      display: "grid", gridTemplateRows: "auto 1fr auto",
      height: "100%", background: t.card1, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 32px", borderBottom: `1px solid ${t.border1}`,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontFamily: fonts.inter, fontSize: 13, fontWeight: 600, color: t.textPrimary }}>
              {titulo}
            </span>
            <span style={{
              fontSize: 7, letterSpacing: "0.18em", padding: "2px 6px", textTransform: "uppercase",
              color: conversa.is_grupo ? "#8CA9B8" : "#7BA394",
              border: `1px solid ${conversa.is_grupo ? "rgba(140,169,184,0.45)" : "rgba(123,163,148,0.45)"}`,
            }}>
              {conversa.is_grupo ? "Grupo" : "Cliente"}
            </span>
            {conversa.status && (
              <span style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: statusChatCor(conversa.status), fontFamily: fonts.cinzel }}>
                ● {conversa.status.replace("_", " ")}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 3, letterSpacing: "0.04em" }}>
            {conversa.grupo_jid}
            {conversa.obra_code && <span>{"   ·   "}{conversa.obra_code}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setAlertar(true)} style={{
            padding: "5px 12px", border: "1px solid #d05a3b",
            background: "transparent", color: "#d05a3b", cursor: "pointer",
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
          }}>
            Alertar Problema
          </button>
          {conversa.projeto_id && (
            <Link to={`/projetos/${conversa.projeto_id}`} style={{
              padding: "5px 12px", border: `1px solid ${t.border1}`,
              color: t.accent, textDecoration: "none",
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
            }}>
              Abrir projeto →
            </Link>
          )}
          <button onClick={load} disabled={loading} title="Recarregar" style={{
            background: "transparent", color: t.textSecondary,
            border: `1px solid ${t.border1}`, padding: "5px 10px",
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
            textTransform: "uppercase", cursor: loading ? "default" : "pointer",
          }}>↺</button>
        </div>
      </div>

      {alertar && (
        <AlertarProblemaModal
          origem="relacionamento"
          prefill={{
            card_id: conversa.card_id || null,
            projeto_id: conversa.projeto_id || null,
            cliente: conversa.cliente || titulo,
          }}
          onFechar={() => setAlertar(false)}
          onOk={() => setAlertar(false)}
        />
      )}

      {/* Mensagens */}
      <div ref={listaRef} style={{
        overflowY: "auto", padding: "18px 32px 12px",
        display: "flex", flexDirection: "column", gap: 8, background: t.bg,
      }}>
        {erro && (
          <div style={{
            padding: "10px 14px", background: "rgba(184,91,76,0.14)",
            border: "1px solid #B85B4C", color: "#B85B4C", fontSize: 11,
          }}>{erro}</div>
        )}
        {!loading && mensagens.length === 0 && !erro && (
          <div style={{
            padding: 40, textAlign: "center", color: t.textTertiary,
            fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontFamily: fonts.cinzel,
          }}>
            sem mensagens ainda
          </div>
        )}
        {mensagens.map((m, i) => {
          const anterior = i > 0 ? mensagens[i - 1] : null;
          const showDia = !anterior || dataMsg(anterior.timestamp) !== dataMsg(m.timestamp);
          return (
            <React.Fragment key={m.id}>
              {showDia && (
                <div style={{
                  alignSelf: "center", padding: "4px 12px", margin: "6px 0",
                  background: t.card2, border: `1px solid ${t.border1}`,
                  fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.24em",
                  textTransform: "uppercase", color: t.textTertiary,
                }}>
                  {dataMsg(m.timestamp)}
                </div>
              )}
              <MsgBubble m={m} t={t} />
            </React.Fragment>
          );
        })}
      </div>

      {/* Composer */}
      <div style={{
        padding: "12px 32px", borderTop: `1px solid ${t.border1}`, background: t.card1,
        display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "flex-end",
      }}>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
          }}
          placeholder="Digite uma mensagem… (Enter envia, Shift+Enter quebra linha)"
          disabled={enviando}
          rows={2}
          style={{
            resize: "none", padding: "10px 12px",
            background: t.card2, border: `1px solid ${t.border1}`, color: t.textPrimary,
            outline: "none", fontFamily: fonts.inter, fontSize: 12,
            width: "100%", boxSizing: "border-box", minWidth: 0,
          }}
        />
        <button
          onClick={enviar}
          disabled={!texto.trim() || enviando}
          style={{
            background: (!texto.trim() || enviando) ? t.border1 : t.accent,
            color: (!texto.trim() || enviando) ? t.textTertiary : t.bg,
            border: "none", padding: "12px 22px",
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.24em",
            textTransform: "uppercase",
            cursor: (!texto.trim() || enviando) ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}>
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </section>
  );
}

const emptyStyle = (t: any): React.CSSProperties => ({
  padding: "24px 14px", textAlign: "center", color: t.textTertiary,
  fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
  textTransform: "uppercase",
});
