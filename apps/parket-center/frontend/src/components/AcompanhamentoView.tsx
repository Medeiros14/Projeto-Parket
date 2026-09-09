/** Acompanhamento de Obras — execução, foco em INSTALADO × PENDENTE × STATUS.
 *  Header do projeto + lista de produtos + tabela resumo + detalhamento
 *  por ambiente (item·m²·descrição·datas) para cada serviço. */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { CenterData, ItemObra, FotoObraCenter, InstaPostCenter } from "../api";
import { api, fmtNum } from "../api";
import { type ColorScheme, serif } from "../theme";
import { produtosLista, fiscalResponsavel } from "../derive";
import { CRONOGRAMA_OVERRIDE, statusAcomp, type LinhaCronoOverride } from "../overrides";
import { midiaThumb } from "../midia";

const FOTOS_POR_ITEM: Record<string, string[]> = {};

function codigoItem(it: ItemObra): string {
  if (it.meta?.codigo) return it.meta.codigo!;
  const m = (it.descritivo || "").match(/^(\d+(?:\.\d+)?)/);
  return m ? m[1] : "";
}

function CabecalhoObra({ data, c }: { data: CenterData; c: ColorScheme }) {
  const p = data.projeto;
  const produtos = produtosLista(data);
  const linhas: [string, string][] = [
    ["DESCRIÇÃO DO PRODUTO", produtos.length ? produtos.join(" · ") : "—"],
    ["ARQUITETURA / ENGENHARIA", p.arquiteto || "—"],
    ["FISCAL RESPONSÁVEL", fiscalResponsavel(data)],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", border: `1px solid ${c.border1}`, marginBottom: 26 }}>
      {linhas.map(([lbl, val]) => (
        <div key={lbl} style={{ padding: "18px 20px", borderRight: `1px solid ${c.border1}`, marginRight: -1 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 8 }}>
            {lbl}
          </div>
          <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 400, color: c.textPrimary, lineHeight: 1.1, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={val}>
            {val}
          </div>
        </div>
      ))}
    </div>
  );
}

function CarrosselFotos({ fotos, autores, videos, c, isDark }: { fotos: string[]; autores?: (string | null)[]; videos?: boolean[]; c: ColorScheme; isDark: boolean }) {
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const total = fotos.length;
  if (total === 0) return null;

  const scroll = (dir: -1 | 1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const btn: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    background: isDark ? "rgba(20,20,20,0.82)" : "rgba(255,255,255,0.9)",
    border: `1px solid ${c.border1}`, color: c.textPrimary,
    width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", zIndex: 2,
  };
  return (
    <>
      <div style={{ position: "relative" }}>
        <div ref={stripRef} style={{
          display: "flex", gap: 12, overflowX: "auto", scrollBehavior: "smooth",
          paddingBottom: 8, scrollSnapType: "x mandatory",
        }}>
          {fotos.map((src, i) => (
            <button key={`${src}-${i}`} onClick={() => setZoomIdx(i)} title={`Foto ${i + 1}`} style={{
              flex: "0 0 auto", width: 260, height: 200, padding: 0, cursor: "zoom-in",
              border: `1px solid ${c.border1}`, background: isDark ? "#0F0F0F" : "#F2EDE5",
              scrollSnapAlign: "start", overflow: "hidden", position: "relative",
            }}>
              {videos?.[i] ? (
                <video src={src} muted playsInline preload="metadata"
                  style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
              ) : (
                <img src={midiaThumb(src, 600)} alt={`Foto ${i + 1}`}
                  style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              {videos?.[i] && (
                <span style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                  width: 44, height: 44, borderRadius: 22, background: "rgba(0,0,0,0.55)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 16, pointerEvents: "none",
                }}>▶</span>
              )}
              {autores?.[i] && (
                <span style={{
                  position: "absolute", bottom: 6, left: 6, padding: "2px 8px",
                  background: "rgba(0,0,0,0.62)", color: "#C7A45B",
                  fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase",
                }}>{autores[i]}</span>
              )}
            </button>
          ))}
        </div>
        {total > 1 && (
          <>
            <button onClick={() => scroll(-1)} aria-label="Rolar para trás" style={{ ...btn, left: -8 }}>
              <ChevronLeft size={20} strokeWidth={1.5} />
            </button>
            <button onClick={() => scroll(1)} aria-label="Rolar para frente" style={{ ...btn, right: -8 }}>
              <ChevronRight size={20} strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
      {zoomIdx !== null && (
        <Lightbox
          src={fotos[zoomIdx]}
          video={videos?.[zoomIdx]}
          onClose={() => setZoomIdx(null)}
          onPrev={() => setZoomIdx(i => (i! - 1 + total) % total)}
          onNext={() => setZoomIdx(i => (i! + 1) % total)}
          total={total} idx={zoomIdx}
        />
      )}
    </>
  );
}

function Lightbox({ src, video, onClose, onPrev, onNext, total, idx }: {
  src: string; video?: boolean; onClose: () => void; onPrev: () => void; onNext: () => void; total: number; idx: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);
  const nav: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.35)",
    color: "#fff", width: 46, height: 46, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 40,
    }}>
      <button onClick={e => { e.stopPropagation(); onClose(); }} aria-label="Fechar" style={{
        position: "absolute", top: 20, right: 20,
        background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.35)",
        color: "#fff", width: 40, height: 40, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><X size={20} strokeWidth={1.5} /></button>
      {total > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); onPrev(); }} aria-label="Anterior" style={{ ...nav, left: 24 }}>
            <ChevronLeft size={22} strokeWidth={1.5} />
          </button>
          <button onClick={e => { e.stopPropagation(); onNext(); }} aria-label="Próxima" style={{ ...nav, right: 24 }}>
            <ChevronRight size={22} strokeWidth={1.5} />
          </button>
        </>
      )}
      {video ? (
        <video src={src} controls autoPlay playsInline onClick={e => e.stopPropagation()}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "default" }} />
      ) : (
        <img src={src} alt="" onClick={e => e.stopPropagation()}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "default" }} />
      )}
      <div style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        color: "#fff", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
      }}>{idx + 1} / {total}</div>
    </div>
  );
}

function corStatus(status: string, isDark: boolean): string {
  const s = status.toLowerCase();
  if (s.includes("concluí") || s.includes("entregue") || s.includes("instalado")) return isDark ? "#7BA394" : "#3D6B58";
  if (s.includes("ressalva")) return isDark ? "#C7A45B" : "#8A6010";
  if (s.includes("andamento") || s.includes("execução")) return isDark ? "#C8B68A" : "#8A6F3D";
  if (s.includes("programado")) return isDark ? "#C8B68A" : "#8A6F3D";
  if (s.includes("atrasado")) return isDark ? "#C7A45B" : "#8A6010";
  return isDark ? "#5F5D58" : "#9D9790";
}

function pctLinha(l: LinhaCronoOverride): number {
  if (!l.contratado) return 0;
  const inst = l.instalado ?? 0;
  return Math.max(0, Math.min(100, (inst / l.contratado) * 100));
}

function MiniDonut({ pct, cor, size, c }: {
  pct: number; cor: string; size: number; c: ColorScheme;
}) {
  const stroke = size >= 100 ? 5 : 4;
  const r = size / 2 - stroke - 2;
  const CIRC = 2 * Math.PI * r;
  const dash = (pct / 100) * CIRC;
  const pctInt = Math.round(pct);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={c.border2} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={cor} strokeWidth={stroke}
          strokeDasharray={`${dash} ${CIRC - dash}`}
          strokeDashoffset={CIRC / 4}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 500ms ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          fontFamily: serif, fontSize: size * 0.28, fontWeight: 300,
          color: pctInt > 0 ? c.textPrimary : c.textTertiary, lineHeight: 1,
        }}>
          {pctInt}<span style={{ fontSize: size * 0.14, color: c.textTertiary, marginLeft: 1 }}>%</span>
        </div>
      </div>
    </div>
  );
}

function CardServico({ l, c, isDark }: {
  l: LinhaCronoOverride; c: ColorScheme; isDark: boolean;
}) {
  const inst = l.instalado ?? 0;
  const pend = Math.max(l.contratado - inst, 0);
  const st = statusAcomp(l);
  const cor = corStatus(st, isDark);
  const pct = pctLinha(l);

  return (
    <div style={{
      border: `1px solid ${c.border1}`,
      padding: "22px 22px 18px",
      display: "flex", flexDirection: "column", gap: 16,
      background: isDark ? "rgba(255,255,255,0.01)" : "#FFFFFF",
    }}>
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <MiniDonut pct={pct} cor={cor} size={96} c={c} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
            color: c.textTertiary, marginBottom: 4,
          }}>
            {l.codigo}
          </div>
          <div style={{
            fontFamily: serif, fontSize: 17, fontWeight: 400,
            color: c.textPrimary, lineHeight: 1.2, marginBottom: 10,
          }}>
            {l.descricao || "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, background: cor }} />
            <div style={{
              fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
              color: cor, lineHeight: 1,
            }}>{st.toUpperCase()}</div>
          </div>
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4,
        borderTop: `1px solid ${c.border1}`, paddingTop: 14,
      }}>
        {([
          ["CONTRATADO", fmtNum(l.contratado), c.textSecondary],
          ["INSTALADO", fmtNum(inst), inst > 0 ? c.textPrimary : c.textTertiary],
          ["PENDENTE", fmtNum(pend), pend > 0 ? (isDark ? "#C7A45B" : "#8A6010") : c.textTertiary],
        ] as const).map(([lbl, val, cor]) => (
          <div key={lbl}>
            <div style={{
              fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
              color: c.textTertiary, marginBottom: 4,
            }}>{lbl}</div>
            <div style={{ fontFamily: serif, fontSize: 15, color: cor, lineHeight: 1.1 }}>
              {val} <span style={{ fontSize: 10, color: c.textTertiary, letterSpacing: "0.06em" }}>{l.unidade}</span>
            </div>
          </div>
        ))}
      </div>
      {l.observacao && (
        <div style={{
          fontSize: 11, color: c.textTertiary, lineHeight: 1.5,
          paddingTop: 12, borderTop: `1px solid ${c.border1}`,
        }}>
          {l.observacao}
        </div>
      )}
    </div>
  );
}

function VisaoGeral({ resumo, c, isDark }: {
  resumo: LinhaCronoOverride[]; c: ColorScheme; isDark: boolean;
}) {
  if (resumo.length === 0) return null;
  const pctGeral = resumo.reduce((a, l) => a + pctLinha(l), 0) / resumo.length;
  const pctInt = Math.round(pctGeral);

  const contagem = { concluido: 0, andamento: 0, programado: 0, atrasado: 0 };
  for (const l of resumo) {
    const st = statusAcomp(l).toLowerCase();
    if (st.includes("concluí") || st.includes("entregue") || st.includes("instalado")) contagem.concluido++;
    else if (st.includes("andamento") || st.includes("execução") || st.includes("ressalva")) contagem.andamento++;
    else if (st.includes("atrasado")) contagem.atrasado++;
    else contagem.programado++;
  }
  const chips: Array<{ label: string; n: number; cor: string }> = [
    { label: "CONCLUÍDO", n: contagem.concluido, cor: isDark ? "#7BA394" : "#3D6B58" },
    { label: "EM ANDAMENTO", n: contagem.andamento, cor: isDark ? "#C8B68A" : "#8A6F3D" },
    { label: "PROGRAMADO", n: contagem.programado, cor: isDark ? "#8D8A84" : "#6D675F" },
    { label: "ATRASADO", n: contagem.atrasado, cor: isDark ? "#C7A45B" : "#8A6010" },
  ];

  const R = 82, W = 200;
  const CIRC = 2 * Math.PI * R;
  const dash = (pctGeral / 100) * CIRC;

  const porUnidade = new Map<string, { contratado: number; instalado: number }>();
  for (const l of resumo) {
    const u = l.unidade || "";
    const cur = porUnidade.get(u) ?? { contratado: 0, instalado: 0 };
    cur.contratado += l.contratado;
    cur.instalado += l.instalado ?? 0;
    porUnidade.set(u, cur);
  }
  const totais = [...porUnidade.entries()]
    .sort((a, b) => b[1].contratado - a[1].contratado);

  return (
    <div className="pkt-ass-grid" style={{
      display: "grid", gridTemplateColumns: "auto 1fr", gap: 40,
      alignItems: "center", padding: "32px clamp(16px, 4vw, 40px)",
      border: `1px solid ${c.border1}`, marginBottom: 26,
      background: isDark ? "rgba(200,182,138,0.02)" : "#FBF8F1",
    }}>
      <div style={{ position: "relative", width: W, height: W }}>
        <svg width={W} height={W} style={{ display: "block" }}>
          <defs>
            <linearGradient id="pkt-donut-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isDark ? "#C8B68A" : "#8A6F3D"} />
              <stop offset="100%" stopColor={isDark ? "#B8A06A" : "#B08A4A"} />
            </linearGradient>
          </defs>
          <circle
            cx={W / 2} cy={W / 2} r={R}
            fill="none" stroke={c.border2} strokeWidth={6}
          />
          <circle
            cx={W / 2} cy={W / 2} r={R}
            fill="none" stroke="url(#pkt-donut-grad)" strokeWidth={6}
            strokeDasharray={`${dash} ${CIRC - dash}`}
            strokeDashoffset={CIRC / 4}
            strokeLinecap="round"
            transform={`rotate(-90 ${W / 2} ${W / 2})`}
            style={{ transition: "stroke-dasharray 500ms ease" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            fontFamily: serif, fontSize: 52, fontWeight: 300,
            color: c.textPrimary, lineHeight: 1,
          }}>
            {pctInt}<span style={{ fontSize: 22, color: c.textTertiary, marginLeft: 2 }}>%</span>
          </div>
          <div style={{
            fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
            color: c.textTertiary, marginTop: 8,
          }}>CONCLUÍDO</div>
        </div>
      </div>

      <div>
        <div style={{
          fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
          color: c.textTertiary, marginBottom: 14,
        }}>
          PANORAMA GERAL · {resumo.length} SERVIÇO{resumo.length === 1 ? "" : "S"}
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 20, marginBottom: 22,
        }}>
          {chips.map(ch => (
            <div key={ch.label}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, background: ch.cor }} />
                <div style={{
                  fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
                  color: c.textTertiary,
                }}>{ch.label}</div>
              </div>
              <div style={{
                fontFamily: serif, fontSize: 32, fontWeight: 300,
                color: ch.n > 0 ? c.textPrimary : c.textTertiary, lineHeight: 1,
              }}>{ch.n}</div>
            </div>
          ))}
        </div>
        <div style={{
          display: "flex", gap: 32, paddingTop: 18,
          borderTop: `1px solid ${c.border1}`, flexWrap: "wrap",
        }}>
          {totais.map(([un, t]) => (
            <div key={un}>
              <div style={{
                fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
                color: c.textTertiary, marginBottom: 4,
              }}>TOTAL {un}</div>
              <div style={{ fontFamily: serif, fontSize: 18, color: c.textPrimary, lineHeight: 1.1 }}>
                {fmtNum(t.instalado)} <span style={{ color: c.textTertiary, fontSize: 13 }}>/ {fmtNum(t.contratado)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ProgressoObra — feed do instalador (check-ins, ocorrências) + andamento
// Dados vêm do payload /api/publico/center/{token}: feed_instalador,
// ocorrencias_instalador, andamento. Instala.parket.works alimenta em tempo
// real. Cliente vê "JUNINHO chegou na obra" e fotos de ocorrências.
// ════════════════════════════════════════════════════════════════
function ProgressoObra({ data, c, isDark }: { data: CenterData; c: ColorScheme; isDark: boolean }) {
  const feed = data.feed_instalador ?? [];
  const ocor = data.ocorrencias_instalador ?? [];
  const and_ = data.andamento;
  if (feed.length === 0 && ocor.length === 0 && !and_) return null;

  const fmtHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  const iconePara = (kind: string): string => {
    if (kind === "checkin") return "→";
    if (kind === "checkout" || kind === "fim") return "←";
    if (kind === "ocorrencia") return "!";
    if (kind === "foto") return "◧";
    return "·";
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 14 }}>
        PROGRESSO DA OBRA
      </div>

      {and_ && and_.pct_geral > 0 && (
        <div style={{
          padding: 20, marginBottom: 20,
          border: `1px solid ${c.border1}`, background: c.card1,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: c.textSecondary }}>
              Andamento geral
            </div>
            <div style={{ fontSize: 22, fontWeight: 300, color: c.textPrimary, letterSpacing: "-0.02em" }}>
              {and_.pct_geral}%
            </div>
          </div>
          <div style={{ height: 6, background: isDark ? "#1a1a1a" : "#eee", position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${and_.pct_geral}%`,
              background: c.accent, transition: "width 0.6s ease",
            }} />
          </div>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", color: c.textTertiary, marginTop: 8, display: "flex", gap: 20 }}>
            <span>ETAPAS: {and_.pct_etapas}%</span>
            <span>ITENS: {and_.pct_itens}%</span>
            {and_.ultima_atividade && <span>ÚLT: {fmtHora(and_.ultima_atividade)}</span>}
          </div>
        </div>
      )}

      {ocor.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: c.textSecondary, marginBottom: 10 }}>
            Ocorrências reportadas
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {ocor.slice(0, 10).map(o => (
              <div key={o.id} style={{
                padding: 14, border: `1px solid ${c.border1}`, background: c.card1,
                display: "grid", gridTemplateColumns: o.foto_url ? "80px 1fr" : "1fr", gap: 12, alignItems: "flex-start",
              }}>
                {o.foto_url && (
                  <a href={o.foto_url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                    <img src={o.foto_url} alt="" style={{
                      width: 80, height: 80, objectFit: "cover", display: "block",
                    }} />
                  </a>
                )}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
                    <span style={{
                      fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: o.status === "resolvida" ? c.textTertiary : c.accent, fontWeight: 700,
                    }}>
                      {o.tipo || "Ocorrência"} {o.status === "resolvida" ? "· resolvida" : ""}
                    </span>
                    <span style={{ fontSize: 10, color: c.textTertiary }}>{fmtHora(o.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: c.textPrimary, lineHeight: 1.5 }}>
                    {o.descricao || "—"}
                  </div>
                  {o.prestador_nome && (
                    <div style={{ fontSize: 10, color: c.textTertiary, marginTop: 6 }}>
                      por {o.prestador_nome}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {feed.length > 0 && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: c.textSecondary, marginBottom: 10 }}>
            Atividade recente
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {feed.slice(0, 20).map(f => (
              <div key={f.id} style={{
                padding: "10px 14px", background: c.card1, borderLeft: `2px solid ${c.accent}`,
                display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center",
              }}>
                <span style={{ color: c.accent, fontWeight: 700, fontSize: 13 }}>{iconePara(f.kind)}</span>
                <div>
                  <div style={{ fontSize: 12, color: c.textPrimary, fontWeight: 500 }}>{f.titulo}</div>
                  {f.detalhe && <div style={{ fontSize: 11, color: c.textSecondary, marginTop: 2 }}>{f.detalhe}</div>}
                </div>
                <span style={{ fontSize: 10, color: c.textTertiary, whiteSpace: "nowrap" }}>{fmtHora(f.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// InstaParket — posts curados (curadoria no gestão) do perfil do cliente,
// cada post vira um carrossel horizontal. Mesmo token da Central.
// ════════════════════════════════════════════════════════════════
function InstaParketSection({ token, c, isDark }: { token: string; c: ColorScheme; isDark: boolean }) {
  const [posts, setPosts] = useState<InstaPostCenter[] | null>(null);
  useEffect(() => {
    let vivo = true;
    api.instaPerfil(token)
      .then(p => { if (vivo) setPosts(p.posts || []); })
      .catch(() => { if (vivo) setPosts([]); });
    return () => { vivo = false; };
  }, [token]);
  if (!posts || posts.length === 0) return null;

  const fmtData = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: 12, marginBottom: 12, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary }}>
          INSTAPARKET · REGISTRO DO PROJETO
        </div>
        <a href={`https://insta.parket.works/${token}`} target="_blank" rel="noreferrer" style={{
          fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
          color: c.accent, textDecoration: "none",
        }}>ABRIR NO INSTAPARKET →</a>
      </div>
      {posts.map(p => {
        const midias = p.midias || [];
        if (midias.length === 0) return null;
        return (
          <div key={p.id} style={{ marginBottom: 28 }}>
            <div style={{
              display: "flex", alignItems: "baseline", gap: 10,
              marginBottom: 10, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: c.textSecondary }}>
                {p.legenda || "Momentos do projeto"}
              </span>
              <span style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: c.textTertiary }}>
                {fmtData(p.created_at)}
              </span>
            </div>
            <CarrosselFotos
              fotos={midias.map(m => m.url)}
              videos={midias.map(m => m.tipo === "video")}
              autores={midias.map(m => m.ambiente || null)}
              c={c} isDark={isDark}
            />
          </div>
        );
      })}
    </div>
  );
}

export function AcompanhamentoView({ data, c, isDark, onVoltar, token }: {
  data: CenterData; c: ColorScheme; isDark: boolean; onVoltar: () => void; token: string;
}) {
  const override = CRONOGRAMA_OVERRIDE[data.projeto.id];
  const stripCod = (s: string) => (s || "").replace(/^\d+(\.\d+)?\s*[·\-]\s*/, "").trim();
  // Sub-itens visíveis: 1 card por item do contrato (mesmo grão dos Itens Contratados).
  const resumo: LinhaCronoOverride[] = override ?? data.itens
    .filter(it => it.status !== "cancelado")
    .map(it => {
      const material = stripCod(it.descritivo || "") || it.categoria || "—";
      const ambiente = (it.ambiente || "").trim();
      return {
        codigo: String(it.meta?.codigo || it.ordem),
        descricao: ambiente ? `${ambiente} — ${material}` : material,
        contratado: Number(it.quantidade) || 0,
        unidade: it.unidade || "",
        inicio: it.previsao_inicio,
        fim: it.previsao_fim,
        instalado: Number(it.meta?.obra?.qtd_instalada) || 0,
        observacao: it.meta?.obra?.observacao || undefined,
      };
    });

  return (
    <div style={{ padding: "32px var(--pkt-pad-x) 60px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 14 }}>
          <button onClick={onVoltar} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", gap: 6, fontSize: 10,
            letterSpacing: "0.18em", textTransform: "uppercase", color: c.accent,
          }}>
            <ArrowLeft size={12} strokeWidth={1.5} /> Voltar à central
          </button>
        </div>
        <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 14 }}>
          EXECUÇÃO · EVOLUÇÃO
        </div>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(30px, 8vw, 46px)", fontWeight: 300, color: c.textPrimary, margin: "0 0 10px", lineHeight: 1.05 }}>
          Acompanhamento de Obras
        </h1>
      </div>

      <CabecalhoObra data={data} c={c} />

      <VisaoGeral resumo={resumo} c={c} isDark={isDark} />

      <ProgressoObra data={data} c={c} isDark={isDark} />

      <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 14 }}>
        EVOLUÇÃO POR SERVIÇO
      </div>
      <div className="pkt-evo-grid">
        {resumo.map(l => (
          <CardServico key={l.codigo} l={l} c={c} isDark={isDark} />
        ))}
      </div>

      {(() => {
        // Fotos reais curadas no gestão (fiscal + instalador), agrupadas por
        // item com ambiente e material; hardcoded fica só como fallback.
        const reais = (data.fotos_obra ?? []).filter(f => f.tipo !== "video");
        type GrupoFotos = { chave: string; titulo: string; fotos: string[]; autores?: (string | null)[] };
        const autorDe = (f: FotoObraCenter): string | null => {
          if (f.origem === "instala") {
            const m = /Instalador\s+([^—]+)/i.exec(f.legenda || "");
            return m ? `Instalador ${m[1].trim()}` : "Instalador";
          }
          if (f.origem === "fiscal") return "Fiscal";
          return "Parket";
        };
        let grupos: GrupoFotos[] = [];
        if (reais.length > 0) {
          const map = new Map<string, GrupoFotos>();
          for (const f of reais) {
            const ambiente = (f.ambiente || f.item_ambiente || "").toUpperCase();
            const material = (f.item_produto || f.item_categoria || "").toUpperCase();
            const titulo = [f.item_codigo || "", ambiente, material]
              .filter(Boolean).join(" · ") || "OBRA";
            const chave = f.item_id || titulo;
            const g = map.get(chave) ?? { chave, titulo, fotos: [], autores: [] };
            g.fotos.push(f.url);
            g.autores!.push(autorDe(f));
            map.set(chave, g);
          }
          grupos = [...map.values()];
        } else {
          grupos = data.itens
            .filter(i => i.status !== "cancelado")
            .map(i => ({
              chave: i.id,
              titulo: `${codigoItem(i)} · ${i.ambiente || i.descritivo}`,
              fotos: FOTOS_POR_ITEM[codigoItem(i)] || [],
            }))
            .filter(g => g.fotos.length > 0);
        }
        if (grupos.length === 0) return null;
        return (
          <div style={{ marginTop: 36 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 12 }}>
              FOTOS DA OBRA
            </div>
            {grupos.map(g => (
              <div key={g.chave} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: c.textSecondary, marginBottom: 10 }}>
                  {g.titulo}
                </div>
                <CarrosselFotos fotos={g.fotos} autores={g.autores} c={c} isDark={isDark} />
              </div>
            ))}
          </div>
        );
      })()}

      <InstaParketSection token={token} c={c} isDark={isDark} />
    </div>
  );
}
