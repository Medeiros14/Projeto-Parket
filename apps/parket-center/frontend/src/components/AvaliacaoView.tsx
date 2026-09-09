/** Entrega & Avaliação — termo de entrega assinado na própria página +
 *  avaliação da experiência (grava em gestao.projeto_etapas, etapa 10). */
import { useRef, useState } from "react";
import { CheckCircle, PenLine } from "lucide-react";
import type { CenterData } from "../api";
import { api, fmtDataHora } from "../api";
import { type ColorScheme, serif } from "../theme";
import { laudoPorTipo } from "../derive";

// Mesmo texto do PDF/página de assinatura do gestao (ENTREGA_TERMO_PARAGRAFOS)
const TERMO_TITULO = "TERMO DE ENTREGA E RECEBIMENTO DE OBRA";
const TERMO_PARAGRAFOS = [
  "É com satisfação que a Parket formaliza a entrega da obra, executada conforme as especificações " +
  "acordadas e nos termos contratuais firmados entre as partes.",
  "A CONTRATANTE declara receber a obra pronta e acabada, incluindo os serviços de instalações " +
  "executados, manifestando sua concordância com o resultado entregue.",
  "Permanecem asseguradas as garantias legais e contratuais aplicáveis aos serviços executados.",
];

const EVAL_CRITERIA = [
  { id: "docs", label: "Organização dos documentos" },
  { id: "comm", label: "Clareza da comunicação" },
  { id: "punct", label: "Pontualidade" },
  { id: "quality", label: "Qualidade da instalação" },
  { id: "team", label: "Postura da equipe" },
  { id: "overall", label: "Experiência geral" },
];

export function AvaliacaoView({ data, c, isDark, token, onEnviada }: {
  data: CenterData; c: ColorScheme; isDark: boolean; token: string; onEnviada: () => void;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [name, setName] = useState(data.projeto.cliente);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(false);

  // Assinatura in-page do termo
  const [assNome, setAssNome] = useState(data.projeto.cliente);
  const [assCpf, setAssCpf] = useState("");
  const [assinatura, setAssinatura] = useState<string | undefined>(undefined);
  const [assinando, setAssinando] = useState(false);
  const [assinou, setAssinou] = useState(false);
  const [erroAss, setErroAss] = useState("");

  const termo = laudoPorTipo(data, "entrega", "termo");
  const termoAssinado = !!termo?.assinado || assinou;
  const jaAvaliado = !!data.avaliacao || feito;
  const avaliacaoLiberada = termoAssinado || jaAvaliado;
  const completa = EVAL_CRITERIA.every(cr => (ratings[cr.id] || 0) > 0);

  const signToken = termo?.assinar_url ? termo.assinar_url.split("/").filter(Boolean).pop() || null : null;

  const assinar = async () => {
    if (!signToken || !assNome.trim() || !assinatura) return;
    setAssinando(true); setErroAss("");
    try {
      await api.assinarTermo(signToken, { nome: assNome.trim(), cpf: assCpf.trim() || undefined, assinatura });
      setAssinou(true);
    } catch {
      setErroAss("Não foi possível registrar a assinatura. Tente novamente.");
    } finally {
      setAssinando(false);
    }
  };

  const inputBase: React.CSSProperties = {
    background: "none", border: `1px solid ${c.border1}`, color: c.textPrimary,
    padding: "12px 16px", fontSize: 13, width: "100%", outline: "none",
    fontFamily: "'Inter', sans-serif", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
    color: c.textTertiary, display: "block", marginBottom: 6,
  };

  const enviar = async () => {
    if (!completa) return;
    setEnviando(true); setErro("");
    try {
      await api.avaliar(token, { notas: ratings, comentario: comments, nome: name });
      setFeito(true);
      onEnviada();
    } catch {
      setErro("Não foi possível enviar a avaliação. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ padding: "32px var(--pkt-pad-x) 60px" }}>
      <div style={{ marginBottom: 44 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 14 }}>
          FINALIZAÇÃO · CLIENTE
        </div>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(30px, 8vw, 46px)", fontWeight: 300, color: c.textPrimary, margin: "0 0 10px", lineHeight: 1.05 }}>
          Entrega &amp; Avaliação
        </h1>
        <p style={{ fontSize: 14, color: c.textSecondary }}>
          Documentação final e avaliação da experiência Parket.
        </p>
      </div>

      <div style={{ maxWidth: 640 }}>
        <div style={{ border: `1px solid ${c.border1}`, background: c.card1, padding: "32px clamp(16px, 4vw, 28px)" }}>
          {/* ── Etapa 1 · Termo de entrega ── */}
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 18 }}>
            01 · TERMO DE ENTREGA
          </div>
          {termo ? (
            termoAssinado ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <CheckCircle size={18} strokeWidth={1.5} color={c.accent} />
                  <span style={{ fontFamily: serif, fontSize: 22, color: c.textPrimary }}>Documento assinado</span>
                </div>
                <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.65 }}>
                  {assinou
                    ? `Assinatura registrada — agora responda a avaliação abaixo para concluir.`
                    : <>Assinado por {termo.assinado_por || data.projeto.cliente}
                      {termo.assinado_em ? ` em ${fmtDataHora(termo.assinado_em)}` : ""}.</>}
                </p>
                {!assinou && (
                  <button onClick={() => window.open(termo.pdf_url, "_blank")} style={{
                    background: "none", border: `1px solid ${c.border2}`, color: c.textSecondary,
                    cursor: "pointer", padding: "10px 18px", fontSize: 10,
                    letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 10,
                  }}>Ver documento</button>
                )}
              </div>
            ) : (
              <div>
                {/* Texto do termo — assinatura direto na página */}
                <div style={{
                  fontFamily: serif, fontSize: 19, color: c.textPrimary,
                  letterSpacing: "0.06em", marginBottom: 16,
                }}>
                  {TERMO_TITULO}
                </div>
                {TERMO_PARAGRAFOS.map((p, i) => (
                  <p key={i} style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.7, margin: `0 0 ${i === TERMO_PARAGRAFOS.length - 1 ? 18 : 12}px` }}>
                    {p}
                  </p>
                ))}
                {termo.condicao && (
                  <div style={{
                    margin: "0 0 18px", padding: "12px 14px", borderLeft: `2px solid ${c.accent}`,
                    background: isDark ? "rgba(200,182,138,0.06)" : "#FDF8EC",
                    fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap", color: c.textSecondary,
                  }}>
                    {termo.condicao}
                  </div>
                )}

                {signToken ? (
                  <>
                    <div className="pkt-ass-grid" style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, marginBottom: 14 }}>
                      <div>
                        <label style={labelStyle}>Nome completo *</label>
                        <input style={inputBase} value={assNome} onChange={e => setAssNome(e.target.value)} placeholder="Seu nome" />
                      </div>
                      <div>
                        <label style={labelStyle}>CPF</label>
                        <input style={inputBase} value={assCpf} onChange={e => setAssCpf(e.target.value)} placeholder="000.000.000-00" />
                      </div>
                    </div>
                    <AssinaturaPad c={c} value={assinatura} onChange={setAssinatura} />
                    {erroAss && <div style={{ color: "#9B4A5A", fontSize: 12, marginTop: 8 }}>{erroAss}</div>}
                    <button
                      onClick={assinar}
                      disabled={assinando || !assNome.trim() || !assinatura}
                      style={{
                        background: (!assNome.trim() || !assinatura) ? "none" : c.accent,
                        border: (!assNome.trim() || !assinatura) ? `1px solid ${c.border1}` : "none",
                        color: (!assNome.trim() || !assinatura) ? c.textTertiary : "#0B0B0B",
                        cursor: assinando ? "wait" : (!assNome.trim() || !assinatura) ? "not-allowed" : "pointer",
                        padding: "13px 22px", fontSize: 10, letterSpacing: "0.15em",
                        textTransform: "uppercase", width: "100%", marginTop: 14,
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: assinando ? 0.6 : 1,
                      }}>
                      <PenLine size={12} strokeWidth={1.5} />
                      {assinando ? "Registrando…" : "Assinar documento"}
                    </button>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: c.textTertiary }}>
                    A assinatura será disponibilizada pela equipe Parket.
                  </p>
                )}
              </div>
            )
          ) : (
            <p style={{ fontSize: 13, color: c.textTertiary, lineHeight: 1.65 }}>
              O termo de entrega será emitido pela equipe Parket ao final da execução
              e ficará disponível aqui para assinatura digital.
            </p>
          )}

          {/* ── Etapa 2 · Avaliação (esmaecida até o termo ser assinado) ── */}
          <div style={{
            borderTop: `1px solid ${c.border1}`, margin: "28px -28px 0",
            paddingTop: 28, paddingLeft: 28, paddingRight: 28,
            opacity: avaliacaoLiberada ? 1 : 0.4,
            pointerEvents: avaliacaoLiberada ? "auto" : "none",
          }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: c.textTertiary }}>
              02 · AVALIAÇÃO DA EXPERIÊNCIA
            </span>
            {!avaliacaoLiberada && (
              <span style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: c.textTertiary }}>
                Próximo passo
              </span>
            )}
          </div>

          {jaAvaliado ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <CheckCircle size={18} strokeWidth={1.5} color={c.accent} />
                <span style={{ fontFamily: serif, fontSize: 22, color: c.textPrimary }}>
                  {feito ? "Avaliação enviada" : "Avaliação registrada"}
                </span>
              </div>
              <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.65 }}>
                Obrigado por avaliar a sua experiência com a Parket.
                {data.avaliacao?.enviada_em ? ` Recebida em ${fmtDataHora(data.avaliacao.enviada_em)}.` : ""}
              </p>
              {data.avaliacao?.notas && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {EVAL_CRITERIA.filter(cr => data.avaliacao!.notas[cr.id]).map(cr => (
                    <div key={cr.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: c.textSecondary }}>{cr.label}</span>
                      <span style={{ color: c.accent }}>{"★".repeat(data.avaliacao!.notas[cr.id])}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
                {EVAL_CRITERIA.map(crit => {
                  const rating = ratings[crit.id] || 0;
                  return (
                    <div key={crit.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: c.textSecondary }}>{crit.label}</span>
                        <span style={{ fontSize: 10, color: c.textTertiary }}>
                          {rating > 0 ? `${rating} / 5` : "—"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[1, 2, 3, 4, 5].map(n => {
                          const active = rating >= n;
                          return (
                            <button key={n}
                              onClick={() => setRatings(r => ({ ...r, [crit.id]: n }))}
                              style={{
                                width: 34, height: 30, cursor: "pointer",
                                background: active ? (isDark ? "rgba(200,182,138,0.12)" : "#FDF8EC") : "none",
                                border: `1px solid ${active ? c.accent : c.border1}`,
                                color: active ? c.accent : c.textTertiary, fontSize: 13,
                              }}>★</button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Comentários (opcional)</label>
                <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3}
                  style={{ ...inputBase, resize: "vertical" }}
                  placeholder="Conte como foi a sua experiência…" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Seu nome</label>
                <input style={inputBase} value={name} onChange={e => setName(e.target.value)} />
              </div>

              {erro && <div style={{ color: "#9B4A5A", fontSize: 12, marginBottom: 12 }}>{erro}</div>}
              <button onClick={enviar} disabled={!completa || enviando} style={{
                background: completa ? c.accent : "none",
                border: completa ? "none" : `1px solid ${c.border1}`,
                color: completa ? "#0B0B0B" : c.textTertiary,
                cursor: completa ? (enviando ? "wait" : "pointer") : "not-allowed",
                padding: "13px 22px", fontSize: 10, letterSpacing: "0.15em",
                textTransform: "uppercase", width: "100%", opacity: enviando ? 0.6 : 1,
              }}>
                {enviando ? "Enviando…" : completa ? "Enviar avaliação" : "Avalie todos os critérios"}
              </button>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Quadro de assinatura (dedo ou mouse) — mesmo pad do /assinar/ do gestao. */
function AssinaturaPad({ value, onChange, c }: {
  value?: string; onChange: (v: string | undefined) => void; c: ColorScheme;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const pos = (e: React.PointerEvent) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
  };
  const down = (e: React.PointerEvent) => {
    const cv = canvasRef.current; if (!cv) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = cv.getContext("2d")!;
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#14140f";
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
    dirty.current = true;
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  };
  const limpar = () => {
    const cv = canvasRef.current;
    if (cv) cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height);
    dirty.current = false;
    onChange(undefined);
  };

  return (
    <div>
      <div style={{
        fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
        color: c.textTertiary, marginBottom: 6,
      }}>
        Assine no quadro abaixo (dedo ou mouse)
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <canvas ref={canvasRef} width={760} height={220}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          style={{
            width: "100%", maxWidth: 460, height: 130, background: "#fff",
            border: `1px dashed ${value ? c.accent : c.border2}`,
            cursor: "crosshair", touchAction: "none", boxSizing: "border-box",
          }} />
        <button onClick={limpar} style={{
          background: "none", border: `1px solid ${c.border2}`, color: c.textSecondary,
          cursor: "pointer", padding: "8px 14px", fontSize: 10,
          letterSpacing: "0.12em", textTransform: "uppercase",
        }}>Limpar</button>
      </div>
    </div>
  );
}
