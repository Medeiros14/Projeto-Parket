/** Cronograma — visão em Timeline (Gantt suave) ou Calendário mensal.
 *  Cada serviço tem uma cor da paleta terrosa; períodos de instalação
 *  aparecem como barras no timeline ou pílulas nos dias do calendário. */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { CenterData } from "../api";
import { fmtNum } from "../api";
import { type ColorScheme, serif } from "../theme";
import { produtosLista, fiscalResponsavel } from "../derive";
import { CRONOGRAMA_OVERRIDE, type LinhaCronoOverride } from "../overrides";

const PALETTE_LIGHT = [
  "#3D6B58", "#8A6F3D", "#7A2030", "#556B45", "#8A6010",
  "#6D675F", "#B08A4A", "#4C5C6E", "#7A5F2D", "#5F4B3B",
  "#8B5A44", "#4A6E52",
];
const PALETTE_DARK = [
  "#7BA394", "#C8B68A", "#9B4A5A", "#8CA07A", "#C7A45B",
  "#9D9790", "#B8A06A", "#8A9AB0", "#B08A4A", "#A08670",
  "#B37866", "#7C9E82",
];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MESES_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const DIAS_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

function parseISO(s: string | null): Date | null {
  if (!s) return null;
  return new Date(s + "T12:00:00");
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtDataCurta(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${MESES_ABBR[d.getMonth()]}`;
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

type CronoView = "timeline" | "calendario";
function ToggleVisao({ view, setView, c, isDark }: {
  view: CronoView; setView: (v: CronoView) => void;
  c: ColorScheme; isDark: boolean;
}) {
  const opts: Array<{ v: CronoView; l: string }> = [
    { v: "timeline", l: "TIMELINE" },
    { v: "calendario", l: "CALENDÁRIO" },
  ];
  return (
    <div style={{
      display: "inline-flex", border: `1px solid ${c.border1}`,
      background: isDark ? "rgba(255,255,255,0.02)" : "#FFFFFF",
    }}>
      {opts.map((o, i) => {
        const on = view === o.v;
        return (
          <button key={o.v} onClick={() => setView(o.v)} style={{
            background: on ? (isDark ? "rgba(200,182,138,0.10)" : "#FDF8EC") : "transparent",
            border: "none", cursor: "pointer",
            padding: "10px 20px",
            fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
            color: on ? c.accent : c.textTertiary,
            borderRight: i < opts.length - 1 ? `1px solid ${c.border1}` : undefined,
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

/* ═══ Timeline — Gantt no vocabulário do gestao.parket.works/timeline:
   bloco com faixa superior colorida + header (label + contagem), eixo
   semanal (segunda-feira, dd/mm), coluna fixa à esquerda com borda no
   tom do serviço, barras finas com opacity+radius, linha vertical HOJE
   atravessando o bloco e marcador ATRASADO ao lado da barra. */
const DAY_MS = 86400000;
const COL_LABEL = 260;
const ROW_H = 46;
// Zoom padrão semanal: ~14px/dia = ~98px/semana. Sempre cabe rótulo "SEM 12/AGO";
// se o cronograma for longo, aparece scroll horizontal em vez de comprimir.
const PX_DIA_MIN = 14;
const ATRASADO_COR = "#B85B4C";
const dUTC = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

function Timeline({ linhas, c, isDark, palette }: {
  linhas: LinhaCronoOverride[]; c: ColorScheme; isDark: boolean; palette: string[];
}) {
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

  // Ordena cronologicamente: itens com data por inicio ASC, sem-data no final.
  const linhasOrd = useMemo(() => {
    const idxCor = new Map<string, number>();
    linhas.forEach((l, i) => idxCor.set(l.codigo, i));
    const arr = [...linhas].sort((a, b) => {
      const ai = a.inicio ? parseISO(a.inicio)!.getTime() : Infinity;
      const bi = b.inicio ? parseISO(b.inicio)!.getTime() : Infinity;
      if (ai !== bi) return ai - bi;
      return (a.codigo || "").localeCompare(b.codigo || "");
    });
    return arr.map(l => ({ l, corIdx: idxCor.get(l.codigo) ?? 0 }));
  }, [linhas]);
  const comData = linhas.filter(l => l.inicio && l.fim);
  const hojeMs = useMemo(() => dUTC(new Date()), []);

  const eixo = useMemo(() => {
    if (comData.length === 0) return null;
    const inicios = comData.map(l => dUTC(parseISO(l.inicio)!));
    const fins = comData.map(l => dUTC(parseISO(l.fim)!));
    let min = Math.min(hojeMs, ...inicios);
    const max = Math.max(hojeMs, ...fins);
    // Volta pra segunda anterior (JS UTC: 0=Dom, 1=Seg, ...)
    const dow = new Date(min).getUTCDay();
    min -= ((dow + 6) % 7) * DAY_MS;
    const dias = (max - min) / DAY_MS + 1;
    const usable = avail - COL_LABEL - 2;
    const pxDia = Math.max(PX_DIA_MIN, usable > 0 ? usable / dias : PX_DIA_MIN);
    const semanas: number[] = [];
    for (let d = min; d <= max; d += 7 * DAY_MS) semanas.push(d);
    return { min, max, semanas, pxDia, width: dias * pxDia };
  }, [comData, hojeMs, avail]);

  const x = (ms: number) => eixo ? ((ms - eixo.min) / DAY_MS) * eixo.pxDia : 0;
  const tick = (ms: number) => {
    const d = new Date(ms);
    return `SEM ${String(d.getUTCDate()).padStart(2, "0")}/${MESES_ABBR[d.getUTCMonth()]}`;
  };

  // Faixa de meses acima do eixo semanal — cada bloco cobre o range do mês
  // dentro do eixo (clampado em min/max), mostrando "AGOSTO 2026".
  const meses = useMemo(() => {
    if (!eixo) return [] as Array<{ ano: number; mes: number; leftMs: number; rightMs: number }>;
    const out: Array<{ ano: number; mes: number; leftMs: number; rightMs: number }> = [];
    const start = new Date(eixo.min);
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();
    while (true) {
      const firstOfMonth = Date.UTC(y, m, 1);
      const firstOfNext = Date.UTC(y, m + 1, 1);
      const leftMs = Math.max(firstOfMonth, eixo.min);
      const rightMs = Math.min(firstOfNext - DAY_MS, eixo.max);
      if (leftMs > eixo.max) break;
      out.push({ ano: y, mes: m, leftMs, rightMs });
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    return out;
  }, [eixo]);

  const semDataLinhas = linhas.filter(l => !l.inicio || !l.fim);

  const headerLabelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase",
    color: c.textTertiary, whiteSpace: "nowrap",
  };

  return (
    <div ref={scrollRef} style={{
      overflowX: "auto", overflowY: "hidden",
      border: `1px solid ${c.border1}`,
      borderTop: `3px solid ${c.accent}`,
      background: isDark ? "rgba(255,255,255,0.01)" : "#FFFFFF",
    }}>
      {comData.length === 0 ? (
        <div style={{
          padding: "40px 20px", fontSize: 12,
          color: c.textTertiary, textAlign: "center",
          letterSpacing: "0.14em", textTransform: "uppercase",
        }}>Nenhuma data de instalação informada ainda.</div>
      ) : (
        <div style={{ width: COL_LABEL + (eixo?.width ?? 0), minWidth: "100%" }}>
          {/* Header do bloco: label + contagem */}
          <div style={{
            padding: "14px 18px", borderBottom: `1px solid ${c.border1}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ width: 8, height: 8, background: c.accent, flexShrink: 0 }} />
            <span style={{
              fontFamily: serif, fontSize: 14, color: c.textPrimary,
              letterSpacing: "0.02em",
            }}>Instalação</span>
            <span style={{
              fontSize: 10, letterSpacing: "0.14em", color: c.textTertiary,
              fontVariantNumeric: "tabular-nums",
            }}>
              {linhas.length} {linhas.length === 1 ? "serviço" : "serviços"}
            </span>
          </div>

          {/* Faixa de meses (agosto · setembro · …) acima do eixo semanal */}
          <div style={{ display: "flex", height: 24, borderBottom: `1px solid ${c.border1}` }}>
            <div style={{
              width: COL_LABEL, flexShrink: 0,
              borderRight: `1px solid ${c.border1}`,
            }} />
            {eixo && (
              <div style={{ position: "relative", width: eixo.width }}>
                {meses.map(mm => {
                  const left = x(mm.leftMs);
                  const width = x(mm.rightMs) - left + eixo.pxDia;
                  return (
                    <div key={`${mm.ano}-${mm.mes}`} style={{
                      position: "absolute", left, width, top: 0, bottom: 0,
                      borderLeft: `1px solid ${c.border1}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: serif, fontSize: 11, color: c.textPrimary,
                      textTransform: "uppercase", letterSpacing: "0.16em",
                      whiteSpace: "nowrap", overflow: "hidden",
                    }}>
                      {MESES[mm.mes]}
                      <span style={{ color: c.textTertiary, marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>{mm.ano}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Eixo semanal (segunda-feira, SEM dd/mmm) */}
          <div style={{ display: "flex", height: 30, borderBottom: `1px solid ${c.border1}` }}>
            <div style={{
              width: COL_LABEL, flexShrink: 0,
              borderRight: `1px solid ${c.border1}`,
              display: "flex", alignItems: "center", padding: "0 18px",
              ...headerLabelStyle,
            }}>Serviço</div>
            {eixo && (
              <div style={{ position: "relative", width: eixo.width }}>
                {eixo.semanas.map(s => (
                  <div key={s} style={{
                    position: "absolute", left: x(s), top: 0, bottom: 0,
                    display: "flex", alignItems: "center", paddingLeft: 6,
                    fontSize: 9, letterSpacing: "0.06em", color: c.textTertiary,
                    borderLeft: `1px solid ${c.border1}`,
                    fontVariantNumeric: "tabular-nums",
                  }}>{tick(s)}</div>
                ))}
              </div>
            )}
          </div>

          {/* Área do gráfico (linhas + linha HOJE) */}
          <div style={{ position: "relative" }}>
            {linhasOrd.map(({ l, corIdx }, idx) => {
              const ini = parseISO(l.inicio);
              const fim = parseISO(l.fim);
              const cor = palette[corIdx % palette.length];
              const semData = !ini || !fim;
              const iniMs = ini ? dUTC(ini) : 0;
              const fimMs = fim ? dUTC(fim) : 0;
              const atrasado = !semData && fimMs < hojeMs && (l.instalado ?? 0) < l.contratado;
              const barLeft = semData ? 0 : x(iniMs);
              const barW = semData || !eixo
                ? 0
                : Math.max(x(fimMs) - x(iniMs) + eixo.pxDia, eixo.pxDia);
              const bar = (
                <div title={`${l.codigo} · ${l.descricao}${ini && fim ? `\n${fmtDataCurta(ini)} → ${fmtDataCurta(fim)}` : ""}${atrasado ? " · ATRASADO" : ""}`}
                  style={{
                    position: "absolute", top: (ROW_H - 18) / 2, height: 18,
                    left: barLeft, width: barW,
                    background: cor, opacity: 0.85, borderRadius: 4,
                    border: atrasado ? `1px solid ${ATRASADO_COR}` : "none",
                    boxSizing: "border-box",
                    display: "flex", alignItems: "center", padding: "0 8px",
                    fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                    color: "#FFFFFF", whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}>
                  {fmtNum(l.contratado)} {l.unidade}
                </div>
              );
              return (
                <div key={l.codigo} style={{
                  display: "flex", height: ROW_H,
                  borderBottom: idx === linhasOrd.length - 1 ? "none" : `1px solid ${c.border1}`,
                }}>
                  <div style={{
                    width: COL_LABEL, flexShrink: 0,
                    borderRight: `1px solid ${c.border1}`,
                    borderLeft: `3px solid ${cor}`,
                    display: "flex", flexDirection: "column", justifyContent: "center",
                    padding: "0 15px", minWidth: 0, boxSizing: "border-box",
                    background: isDark ? "rgba(255,255,255,0.01)" : "#FFFFFF",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "baseline", gap: 8, minWidth: 0,
                    }}>
                      <div style={{
                        fontSize: 9, letterSpacing: "0.20em", color: c.textTertiary,
                        fontVariantNumeric: "tabular-nums", flexShrink: 0,
                      }}>{l.codigo}</div>
                      <div style={{
                        fontFamily: serif, fontSize: 13, color: c.textPrimary,
                        lineHeight: 1.2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        minWidth: 0,
                      }} title={l.descricao || ""}>{l.descricao || "—"}</div>
                    </div>
                    {ini && fim && (
                      <div style={{
                        fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase",
                        color: c.textTertiary, marginTop: 3,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {fmtDataCurta(ini)} → {fmtDataCurta(fim)}
                      </div>
                    )}
                  </div>
                  <div style={{ position: "relative", width: eixo?.width ?? 0 }}>
                    {eixo?.semanas.map(s => (
                      <div key={s} style={{
                        position: "absolute", left: x(s), top: 0, bottom: 0,
                        borderLeft: `1px solid ${c.border1}`, opacity: 0.5,
                      }} />
                    ))}
                    {semData ? (
                      <div style={{
                        position: "absolute", top: "50%", left: 14,
                        transform: "translateY(-50%)",
                        fontSize: 9, letterSpacing: "0.14em",
                        color: c.textTertiary, textTransform: "uppercase",
                      }}>Data a definir</div>
                    ) : bar}
                    {atrasado && eixo && (
                      <div style={{
                        position: "absolute",
                        top: "50%", transform: "translateY(-50%)",
                        left: barLeft + barW + 6,
                        fontSize: 8, letterSpacing: "0.18em",
                        color: ATRASADO_COR, fontWeight: 700, whiteSpace: "nowrap",
                      }}>ATRASADO</div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Linha vertical HOJE atravessando as linhas */}
            {eixo && hojeMs >= eixo.min && hojeMs <= eixo.max && (
              <>
                <div style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: COL_LABEL + x(hojeMs),
                  borderLeft: `2px solid ${c.accent}`,
                  pointerEvents: "none",
                }} />
                <div style={{
                  position: "absolute", top: 0,
                  left: COL_LABEL + x(hojeMs),
                  transform: "translate(-50%, -50%)",
                  fontSize: 8, letterSpacing: "0.22em", color: c.accent,
                  padding: "2px 6px",
                  background: isDark ? "#0B0B0B" : "#FFFFFF",
                  border: `1px solid ${c.accent}`,
                  textTransform: "uppercase",
                }}>Hoje</div>
              </>
            )}
          </div>

          {/* Rodapé: linhas sem data (se houver) */}
          {semDataLinhas.length > 0 && (
            <div style={{
              display: "flex", padding: "10px 18px",
              borderTop: `1px solid ${c.border1}`,
              fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
              color: c.textTertiary,
            }}>
              {semDataLinhas.length} {semDataLinhas.length === 1 ? "serviço sem data" : "serviços sem data"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function Calendario({ linhas, c, isDark, palette }: {
  linhas: LinhaCronoOverride[]; c: ColorScheme; isDark: boolean; palette: string[];
}) {
  // Abre no mês onde há atividade — se hoje está dentro do range,
  // usa o mês de hoje; senão, mês da primeira instalação.
  const mesInicial = useMemo(() => {
    const dts = linhas.map(l => parseISO(l.inicio)).filter((d): d is Date => !!d);
    if (dts.length === 0) return new Date();
    const min = new Date(Math.min(...dts.map(d => d.getTime())));
    const max = new Date(Math.max(
      ...linhas.map(l => parseISO(l.fim)?.getTime() ?? min.getTime())
    ));
    const hj = new Date();
    if (hj >= min && hj <= max) return new Date(hj.getFullYear(), hj.getMonth(), 1);
    return new Date(min.getFullYear(), min.getMonth(), 1);
  }, [linhas]);
  const [mesRef, setMesRef] = useState<Date>(mesInicial);

  const ano = mesRef.getFullYear();
  const mes = mesRef.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);
  // Ajuste: segunda-feira como início da semana (JS: 0=Dom, 1=Seg,...)
  const offsetInicio = (primeiro.getDay() + 6) % 7;
  const gridStart = addDays(primeiro, -offsetInicio);
  const totalCelulas = Math.ceil((offsetInicio + ultimo.getDate()) / 7) * 7;
  const hoje = new Date();

  const dias: Date[] = [];
  for (let i = 0; i < totalCelulas; i++) dias.push(addDays(gridStart, i));

  function servicosNoDia(dia: Date): Array<{ l: LinhaCronoOverride; cor: string; idx: number }> {
    const out: Array<{ l: LinhaCronoOverride; cor: string; idx: number }> = [];
    linhas.forEach((l, idx) => {
      const ini = parseISO(l.inicio);
      const fim = parseISO(l.fim);
      if (!ini || !fim) return;
      const d0 = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
      const d1 = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
      const dd = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
      if (dd >= d0 && dd <= d1) {
        out.push({ l, cor: palette[idx % palette.length], idx });
      }
    });
    return out;
  }

  const irMes = (delta: number) => setMesRef(new Date(ano, mes + delta, 1));
  const irHoje = () => setMesRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const navBtn: React.CSSProperties = {
    background: "transparent", border: `1px solid ${c.border1}`, cursor: "pointer",
    padding: "6px 10px", color: c.textPrimary,
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
  };
  const totalRows = totalCelulas / 7;

  return (
    <div style={{
      border: `1px solid ${c.border1}`,
      borderTop: `3px solid ${c.accent}`,
      background: isDark ? "rgba(255,255,255,0.01)" : "#FFFFFF",
    }}>
      {/* Header do bloco: mês corrente + navegação */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 18px", borderBottom: `1px solid ${c.border1}`,
        flexWrap: "wrap",
      }}>
        <span style={{ width: 8, height: 8, background: c.accent, flexShrink: 0 }} />
        <div style={{
          fontFamily: serif, fontSize: 18, fontWeight: 400, color: c.textPrimary,
          letterSpacing: "0.01em",
        }}>
          {MESES[mes]}{" "}
          <span style={{ color: c.textTertiary, fontVariantNumeric: "tabular-nums" }}>{ano}</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => irMes(-1)} aria-label="Mês anterior" style={navBtn}>
            <ChevronLeft size={12} strokeWidth={1.5} /> Ant
          </button>
          <button onClick={irHoje} aria-label="Ir para hoje" style={{
            ...navBtn, borderColor: c.accent, color: c.accent,
          }}>Hoje</button>
          <button onClick={() => irMes(1)} aria-label="Próximo mês" style={navBtn}>
            Próx <ChevronRight size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Dias da semana + grid do mês: no celular rolam juntos na horizontal */}
      <div className="pkt-scroll-x">
      <div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        borderBottom: `1px solid ${c.border1}`,
      }}>
        {DIAS_SEMANA.map((d, i) => (
          <div key={d} style={{
            padding: "8px 10px",
            borderRight: i === 6 ? "none" : `1px solid ${c.border1}`,
            fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase",
            color: c.textTertiary,
          }}>{d}</div>
        ))}
      </div>

      {/* Grid do mês */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {dias.map((d, i) => {
          const noMes = d.getMonth() === mes;
          const hj = sameDay(d, hoje);
          const servs = servicosNoDia(d);
          const col = i % 7;
          const row = Math.floor(i / 7);
          return (
            <div key={i} style={{
              minHeight: 78, padding: "6px 6px 8px",
              borderRight: col === 6 ? "none" : `1px solid ${c.border1}`,
              borderBottom: row === totalRows - 1 ? "none" : `1px solid ${c.border1}`,
              background: hj
                ? (isDark ? "rgba(200,182,138,0.06)" : "#FDF8EC")
                : noMes
                  ? "transparent"
                  : (isDark ? "rgba(255,255,255,0.015)" : "#FAF8F3"),
              display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                padding: "0 2px",
              }}>
                <span style={{
                  fontFamily: serif, fontSize: 14, fontWeight: 400,
                  color: hj ? c.accent : noMes ? c.textPrimary : c.textTertiary,
                  fontVariantNumeric: "tabular-nums",
                }}>{d.getDate()}</span>
                {hj && (
                  <span style={{
                    fontSize: 7, letterSpacing: "0.22em", color: c.accent,
                    textTransform: "uppercase",
                  }}>Hoje</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                {servs.slice(0, 3).map(s => (
                  <div key={s.l.codigo} title={`${s.l.codigo} · ${s.l.descricao}`} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "2px 6px 2px 4px",
                    borderLeft: `3px solid ${s.cor}`,
                    background: isDark ? "rgba(255,255,255,0.03)" : "#F6F3EE",
                    fontSize: 9, letterSpacing: "0.06em",
                    color: c.textPrimary,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    minWidth: 0,
                  }}>
                    <span style={{
                      color: c.textTertiary, fontVariantNumeric: "tabular-nums",
                      letterSpacing: "0.14em", flexShrink: 0,
                    }}>{s.l.codigo}</span>
                    <span style={{
                      overflow: "hidden", textOverflow: "ellipsis",
                    }}>{s.l.descricao}</span>
                  </div>
                ))}
                {servs.length > 3 && (
                  <div style={{
                    fontSize: 8, color: c.textTertiary, letterSpacing: "0.14em",
                    textTransform: "uppercase", paddingLeft: 4,
                  }}>+{servs.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
      </div>

      {/* Legenda compacta */}
      <div style={{
        padding: "12px 18px", borderTop: `1px solid ${c.border1}`,
        display: "flex", flexWrap: "wrap", gap: 12,
      }}>
        {linhas.map((l, idx) => {
          const cor = palette[idx % palette.length];
          return (
            <span key={l.codigo} title={l.descricao || ""} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 9, letterSpacing: "0.10em",
              color: c.textSecondary, textTransform: "uppercase",
              maxWidth: 260, minWidth: 0,
            }}>
              <span style={{
                width: 12, height: 8, background: cor,
                borderRadius: 2, display: "inline-block", flexShrink: 0,
              }} />
              <span style={{
                fontVariantNumeric: "tabular-nums", color: c.textTertiary,
                letterSpacing: "0.16em", flexShrink: 0,
              }}>{l.codigo}</span>
              <span style={{
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                minWidth: 0,
              }}>{l.descricao}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Piloto (Will 14/08/2026): cronograma agrupado por serviço — sub-itens (1.1,
// 1.9.2…) somem e vira 1 linha por número raiz (ex.: FORRO - RIPADO TAUARI
// PREMIUM inteiro). Validar no Bruno Verdugo e depois aplicar geral.
const CRONO_POR_SERVICO = new Set<string>([
  "6938ded5-0a90-436b-9260-9099ddf8d807", // BRUNO VERDUGO
]);

const stripCod = (s: string) => (s || "").replace(/^\d+(\.\d+)*\s*[·\-]\s*/, "").trim();

function linhasPorServico(itens: CenterData["itens"]): LinhaCronoOverride[] {
  // Ambientes (1.1, 1.2…) somem: viram 1 linha por serviço (raiz). Detalhes de
  // projeto (1.9.1 CORTINEIRO, 1.9.2 ALÇAPÃO…) continuam como linhas próprias,
  // com as datas deles; o item-cabeçalho dos detalhes (1.9, qtd 0) não aparece.
  const codigoDe = (it: CenterData["itens"][number]) => String(it.meta?.codigo || it.ordem);
  const detalhes = itens.filter(it => codigoDe(it).split(".").length >= 3);
  const paisDeDetalhe = new Set(detalhes.map(it => codigoDe(it).split(".").slice(0, -1).join(".")));
  const ambientes = itens.filter(it =>
    codigoDe(it).split(".").length < 3 && !paisDeDetalhe.has(codigoDe(it)));

  const grupos = new Map<string, CenterData["itens"]>();
  for (const it of ambientes) {
    const raiz = codigoDe(it).split(".")[0];
    const g = grupos.get(raiz);
    if (g) g.push(it); else grupos.set(raiz, [it]);
  }
  const servicos = [...grupos.entries()].map(([raiz, its]) => {
    const principal = its.find(it => Number(it.quantidade) > 0) ?? its[0];
    const unidade = principal.unidade || "";
    const daUnidade = its.filter(it => (it.unidade || "") === unidade);
    const inicios = its.map(it => it.previsao_inicio).filter((s): s is string => !!s);
    const fins = its.map(it => it.previsao_fim).filter((s): s is string => !!s);
    return {
      codigo: raiz,
      descricao: stripCod(principal.descritivo || "") || principal.meta?.produto_header || principal.categoria || "—",
      contratado: daUnidade.reduce((s, it) => s + (Number(it.quantidade) || 0), 0),
      unidade,
      inicio: inicios.length ? inicios.reduce((a, b) => (a < b ? a : b)) : null,
      fim: fins.length ? fins.reduce((a, b) => (a > b ? a : b)) : null,
      instalado: daUnidade.reduce((s, it) => s + (Number(it.meta?.obra?.qtd_instalada) || 0), 0),
    };
  });
  const linhasDetalhe = detalhes.map(it => ({
    codigo: codigoDe(it),
    descricao: stripCod(it.descritivo || "") || it.categoria || "—",
    contratado: Number(it.quantidade) || 0,
    unidade: it.unidade || "",
    inicio: it.previsao_inicio,
    fim: it.previsao_fim,
    instalado: Number(it.meta?.obra?.qtd_instalada) || 0,
  }));
  return [...servicos, ...linhasDetalhe];
}

export function CronogramaView({ data, c, isDark, onVoltar }: {
  data: CenterData; c: ColorScheme; isDark: boolean; onVoltar: () => void;
}) {
  // Sem override, cada item do contrato vira uma linha (sub-itens visíveis:
  // 1.1, 1.2, 1.3…). Descrição = ambiente do item + material, pra o cliente
  // distinguir cada área — se o descritivo for igual em todos, o ambiente é
  // o único diferenciador útil.
  const itensAtivos = data.itens.filter(it => it.status !== "cancelado" && !(it.meta as any)?.aux_kind);
  const linhas: LinhaCronoOverride[] = CRONOGRAMA_OVERRIDE[data.projeto.id]
    ?? (CRONO_POR_SERVICO.has(data.projeto.id)
      ? linhasPorServico(itensAtivos)
      : itensAtivos.map(it => {
        const codigo = String(it.meta?.codigo || it.ordem);
        const material = stripCod(it.descritivo || "") || it.categoria || "—";
        const ambiente = (it.ambiente || "").trim();
        return {
          codigo,
          descricao: ambiente ? `${ambiente} — ${material}` : material,
          contratado: Number(it.quantidade) || 0,
          unidade: it.unidade || "",
          inicio: it.previsao_inicio,
          fim: it.previsao_fim,
          instalado: Number(it.meta?.obra?.qtd_instalada) || 0,
        };
      }));
  const [view, setView] = useState<CronoView>("timeline");
  const palette = isDark ? PALETTE_DARK : PALETTE_LIGHT;

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
          PRAZOS · CONTRATUAL
        </div>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(30px, 8vw, 46px)", fontWeight: 300, color: c.textPrimary, margin: "0 0 10px", lineHeight: 1.05 }}>
          Cronograma
        </h1>
      </div>

      <CabecalhoObra data={data} c={c} />

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary }}>
          CRONOGRAMA DE INSTALAÇÃO
        </div>
        <ToggleVisao view={view} setView={setView} c={c} isDark={isDark} />
      </div>

      {view === "timeline"
        ? <Timeline linhas={linhas} c={c} isDark={isDark} palette={palette} />
        : <Calendario linhas={linhas} c={c} isDark={isDark} palette={palette} />}

      <div style={{
        marginTop: 32, padding: "16px 20px", border: `1px solid ${c.border1}`,
        fontSize: 12, color: c.textTertiary, lineHeight: 1.65,
      }}>
        Os prazos apresentados no cronograma são equivalentes aos prazos contratuais.
        Este documento possui caráter informativo, com o objetivo de proporcionar uma
        visão geral dos períodos estimados de instalação da Parket.
      </div>
    </div>
  );
}
