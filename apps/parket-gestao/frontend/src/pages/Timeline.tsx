import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api, CronogramaRow } from "../api";
import { fonts, useTokens } from "../theme";
import { toISO, fmtBR } from "./Obras";

/* ═══ TIMELINE — visão Gantt do cronograma ═══════════════════
   Mesmo vocabulário visual da view Cronograma de /projetos:
   blocos por categoria (borda superior colorida + header com
   quadradinho/label/contagem) e linhas com borda esquerda na
   cor da categoria. Barras = data de início → data final
   planejada (inicio_dia → termino_dia). Sem valores em R$. */

const CATS = [
  { id: "acompanhamento",   label: "Acompanhamento",   cor: "#8CA9B8" },
  { id: "obras_liberadas",  label: "Obras liberadas",  cor: "#C7A45B" },
  { id: "cronograma_final", label: "Cronograma final", cor: "#7BA394" },
  { id: "travado",          label: "Travado",          cor: "#B85B4C" },
  { id: "finalizadas",      label: "Finalizadas",      cor: "#5F5D58" },
] as const;

const TIPOS = [
  { id: "",           label: "Todos" },
  { id: "obras",      label: "Obras" },
  { id: "marcenaria", label: "Marcenaria" },
  { id: "reparos",    label: "Reparos" },
] as const;

const PX_DIA_MIN = 9;
const COL_LABEL = 250;
const ROW_H = 44;
const MARGEM = 20;
const ATRASADO = "#B85B4C";

const DAY = 86400000;
const dUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

type Linha = {
  r: CronogramaRow;
  ini: number;   // ms UTC
  fim: number;   // ms UTC
  atrasado: boolean;
};

type Grupo = { cat: string; label: string; cor: string; linhas: Linha[] };

export default function Timeline() {
  const t = useTokens();
  const [rows, setRows] = useState<CronogramaRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tipo, setTipo] = useState<string>("");

  useEffect(() => {
    let ok = true;
    setCarregando(true);
    api.cronogramaList()
      .then(r => { if (ok) setRows(r); })
      .catch(() => { if (ok) setRows([]); })
      .finally(() => { if (ok) setCarregando(false); });
    return () => { ok = false; };
  }, []);

  const hoje = useMemo(() => dUTC(new Date().toISOString().slice(0, 10)), []);

  const grupos: Grupo[] = useMemo(() => {
    const porCat = new Map<string, Linha[]>();
    for (const r of rows) {
      if (tipo && r.tipo !== tipo) continue;
      const iniISO = toISO(r.inicio_dia);
      const fimISO = toISO(r.termino_dia);
      if (!iniISO || !fimISO) continue;
      let ini = dUTC(iniISO), fim = dUTC(fimISO);
      if (fim < ini) [ini, fim] = [fim, ini];
      const finalizado = !!toISO(r.data_finalizacao) || r.categoria === "finalizadas";
      const cat = r.categoria || "acompanhamento";
      const linha: Linha = { r, ini, fim, atrasado: !finalizado && fim < hoje };
      (porCat.get(cat) ?? porCat.set(cat, []).get(cat)!).push(linha);
    }
    const ordem = CATS.map(c => c.id as string);
    return [...porCat.entries()]
      .sort((a, b) => {
        const ia = ordem.indexOf(a[0]), ib = ordem.indexOf(b[0]);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .map(([cat, linhas]) => ({
        cat,
        label: CATS.find(c => c.id === cat)?.label || cat,
        cor: CATS.find(c => c.id === cat)?.cor || "#8CA9B8",
        linhas: linhas.sort((a, b) => a.ini - b.ini || a.fim - b.fim),
      }));
  }, [rows, tipo, hoje]);

  // Largura disponível do scroll container — pra esticar os dias até
  // preencher a tela quando o range é curto (sem sobra no final)
  const scrollRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setAvail(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Eixo global (compartilhado entre os blocos, pra alinhar as barras):
  // da segunda-feira anterior ao menor início até o maior término/hoje.
  // Escala: dias esticam pra cobrir a tela inteira; se o range for longo
  // demais, mínimo de PX_DIA_MIN por dia com scroll horizontal.
  const eixo = useMemo(() => {
    const todas = grupos.flatMap(g => g.linhas);
    if (!todas.length) return null;
    let min = Math.min(hoje, ...todas.map(l => l.ini));
    const max = Math.max(hoje, ...todas.map(l => l.fim));
    const dow = new Date(min).getUTCDay();               // 0=dom
    min -= ((dow + 6) % 7) * DAY;                        // volta pra segunda
    const dias = (max - min) / DAY + 1;
    const usable = avail - COL_LABEL - MARGEM * 2 - 2;   // -2 = bordas do bloco
    const pxDia = Math.max(PX_DIA_MIN, usable > 0 ? usable / dias : 0);
    const semanas: number[] = [];
    for (let d = min; d <= max; d += 7 * DAY) semanas.push(d);
    return { min, max, semanas, pxDia, width: dias * pxDia };
  }, [grupos, hoje, avail]);

  const x = (ms: number) => eixo ? ((ms - eixo.min) / DAY) * eixo.pxDia : 0;

  const tick = (ms: number) => {
    const d = new Date(ms);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  };

  const hd: React.CSSProperties = {
    fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
    color: t.textTertiary, textTransform: "uppercase", whiteSpace: "nowrap",
  };

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr auto", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "18px 32px 14px", borderBottom: `1px solid ${t.border1}`,
        display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 15, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textPrimary }}>
          Timeline
        </div>
        <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: t.textTertiary }}>
          Início → término planejado do cronograma
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {TIPOS.map(tp => (
            <button key={tp.id} onClick={() => setTipo(tp.id)}
              style={{
                padding: "5px 12px", cursor: "pointer", borderRadius: 6,
                border: `1px solid ${tipo === tp.id ? t.accent : t.border2}`,
                background: tipo === tp.id ? "rgba(150,132,115,0.14)" : "transparent",
                color: tipo === tp.id ? t.textPrimary : t.textSecondary,
                fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
              }}>
              {tp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt agrupado por categoria — mesmo padrão da view Cronograma */}
      <div ref={scrollRef} style={{ overflow: "auto", paddingTop: 16, paddingBottom: 16 }}>
        {carregando ? (
          <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 11, letterSpacing: "0.08em" }}>
            Carregando cronograma…
          </div>
        ) : !eixo ? (
          <div style={{
            padding: 32, textAlign: "center", fontSize: 9,
            color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            nenhuma obra com início e término planejado
          </div>
        ) : (
          grupos.map(({ cat, label, cor, linhas }) => (
            <div key={cat} style={{
              margin: `0 ${MARGEM}px 18px`,
              width: COL_LABEL + eixo.width,
              background: t.card1,
              border: `1px solid ${t.border1}`, borderTop: `3px solid ${cor}`,
            }}>
              {/* Header do bloco (igual ao Cronograma) */}
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${t.border1}` }}>
                <div style={{
                  position: "sticky", left: MARGEM + 15, width: "fit-content",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ width: 8, height: 8, background: cor, flexShrink: 0 }} />
                  <span style={{
                    fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.20em",
                    color: t.textPrimary, textTransform: "uppercase",
                  }}>{label}</span>
                  <span style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary }}>
                    {linhas.length}
                  </span>
                </div>
              </div>

              {/* Área do gráfico (eixo + linhas) com overlay do Hoje */}
              <div style={{ position: "relative" }}>
                {/* Eixo de semanas */}
                <div style={{ display: "flex", height: 28, borderBottom: `1px solid ${t.border1}` }}>
                  <div style={{
                    width: COL_LABEL, flexShrink: 0,
                    position: "sticky", left: MARGEM + 1, zIndex: 3,
                    background: t.card1, borderRight: `1px solid ${t.border1}`,
                    display: "flex", alignItems: "center", padding: "0 14px",
                    ...hd,
                  }}>
                    Obra
                  </div>
                  <div style={{ position: "relative", width: eixo.width }}>
                    {eixo.semanas.map(s => (
                      <div key={s} style={{
                        position: "absolute", left: x(s), top: 0, bottom: 0,
                        display: "flex", alignItems: "center", paddingLeft: 4,
                        fontSize: 8, letterSpacing: "0.08em", color: t.textTertiary,
                        borderLeft: `1px solid ${t.border1}`,
                        fontVariantNumeric: "tabular-nums" as any,
                      }}>
                        {tick(s)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linhas */}
                {linhas.map(l => (
                  <div key={l.r.id} style={{
                    display: "flex", height: ROW_H,
                    borderBottom: `1px solid ${t.border1}`,
                  }}>
                    <div style={{
                      width: COL_LABEL, flexShrink: 0,
                      position: "sticky", left: MARGEM + 1, zIndex: 2,
                      background: t.card1,
                      borderRight: `1px solid ${t.border1}`,
                      borderLeft: `3px solid ${cor}`,
                      display: "flex", flexDirection: "column", justifyContent: "center",
                      padding: "0 14px", minWidth: 0, boxSizing: "border-box",
                    }}>
                      <div style={{
                        fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.08em",
                        color: t.textPrimary,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {(l.r.nome_obra || "—").toUpperCase()}
                      </div>
                      <div style={{
                        fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase",
                        color: t.textTertiary, marginTop: 2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {[l.r.equipe, l.r.tipo].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div style={{ position: "relative", width: eixo.width }}>
                      {eixo.semanas.map(s => (
                        <div key={s} style={{
                          position: "absolute", left: x(s), top: 0, bottom: 0,
                          borderLeft: `1px solid ${t.border1}`, opacity: 0.5,
                        }} />
                      ))}
                      <div
                        title={`${l.r.nome_obra || ""}\n${fmtBR(toISO(l.r.inicio_dia))} → ${fmtBR(toISO(l.r.termino_dia))}${l.atrasado ? " · ATRASADO" : ""}`}
                        style={{
                          position: "absolute", top: (ROW_H - 16) / 2, height: 16,
                          left: x(l.ini), width: Math.max(x(l.fim) - x(l.ini) + eixo.pxDia, eixo.pxDia),
                          background: cor, opacity: 0.85, borderRadius: 4,
                          border: l.atrasado ? `1px solid ${ATRASADO}` : "none",
                          boxSizing: "border-box",
                        }} />
                      {l.atrasado && (
                        <div style={{
                          position: "absolute", top: 0, bottom: 0,
                          left: x(l.fim) + eixo.pxDia + 6,
                          display: "flex", alignItems: "center",
                          fontSize: 8, letterSpacing: "0.12em", color: ATRASADO,
                          fontWeight: 700, whiteSpace: "nowrap",
                        }}>
                          {fmtBR(toISO(l.r.termino_dia))} ATRASADO
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Linha Hoje */}
                <div style={{
                  position: "absolute", top: 0, bottom: 0, zIndex: 1,
                  left: COL_LABEL + x(hoje), width: 0,
                  borderLeft: `2px solid ${t.accent}`, pointerEvents: "none",
                }} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legenda */}
      <div style={{
        padding: "10px 32px", borderTop: `1px solid ${t.border1}`,
        display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center",
      }}>
        {CATS.map(c => (
          <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, letterSpacing: "0.10em", color: t.textSecondary, textTransform: "uppercase" }}>
            <span style={{ width: 14, height: 8, background: c.cor, borderRadius: 2, display: "inline-block" }} />
            {c.label}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, letterSpacing: "0.10em", color: t.textSecondary, textTransform: "uppercase" }}>
          <span style={{ width: 2, height: 12, background: t.accent, display: "inline-block" }} />
          Hoje
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, letterSpacing: "0.10em", color: ATRASADO, textTransform: "uppercase", fontWeight: 700 }}>
          Atrasado
        </span>
      </div>
    </div>
  );
}
