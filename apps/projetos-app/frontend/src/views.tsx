/* Views extras do Projetos · Parket — Calendário, Timeline e Jornada.
   Todas leem o mesmo board espelhado (cards leves) e abrem o CardModal via onOpen. */
import { useEffect, useMemo, useState } from "react";
import { api, fmtBr, labelCor, listaCor, type CalendarEvento, type CardLeve, type Lista, type ProjetistaListItem } from "./api";

type ViewProps = {
  listas: Lista[];
  cards: CardLeve[];
  t: any;
  onOpen: (id: string) => void;
};

type CalProps = ViewProps & { projetistas?: ProjetistaListItem[] };

/* Paleta de cores do calendário (Google Calendar-ish). */
const CAL_CORES = [
  { hex: "#3B82F6", label: "Azul (padrão)" },
  { hex: "#EF4444", label: "Vermelho (urgente)" },
  { hex: "#F59E0B", label: "Laranja (vistoria)" },
  { hex: "#10B981", label: "Verde (entrega)" },
  { hex: "#8B5CF6", label: "Roxo (reunião)" },
  { hex: "#EC4899", label: "Rosa" },
  { hex: "#14B8A6", label: "Teal" },
  { hex: "#6B7280", label: "Cinza" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const keyDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SEM_RESP = "— Sem responsável";

const atrasadoDe = (c: CardLeve) => !!(c.due && !c.due_complete && new Date(c.due) < new Date());

function navBtn(t: any): React.CSSProperties {
  return {
    background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textSecondary,
    padding: "5px 12px", fontSize: 10, cursor: "pointer",
  };
}

/* ═══ Calendário estilo Google — Mês / Semana / Dia / Agenda + criar/editar
      evento (evento | chamada | tarefa) + cards do kanban aparecem junto.  ═══ */
type CalView = "mes" | "semana" | "dia" | "agenda";

export function CalendarioView({ listas, cards, t, onOpen, projetistas = [], meuEmail, souGestora }: CalProps & { meuEmail?: string; souGestora?: boolean }) {
  const agora = new Date();
  const [view, setView] = useState<CalView>("mes");
  const [ref, setRef] = useState<Date>(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  const [eventos, setEventos] = useState<CalendarEvento[]>([]);
  const [editando, setEditando] = useState<CalendarEvento | null>(null);
  const [criando, setCriando] = useState<{ dt_start: string } | null>(null);
  const [busca, setBusca] = useState("");

  const corLista = useMemo(
    () => Object.fromEntries(listas.map(l => [l.id, listaCor(l.nome)])), [listas]);

  // Janela buscada = mês do 'ref' com folga de 1 semana antes/depois (cobre a visão)
  const janela = useMemo(() => {
    if (view === "agenda") {
      const ini = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      const fim = new Date(agora.getFullYear(), agora.getMonth() + 3, 0, 23, 59, 59);
      return { ini, fim };
    }
    const ini = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 2, 0, 23, 59, 59);
    return { ini, fim };
  }, [ref, view]);

  const carregarEventos = async () => {
    try {
      const r = await api.calendarList(janela.ini.toISOString(), janela.fim.toISOString(),
                                       busca.trim() || undefined);
      setEventos(r.eventos);
    } catch { /* silencia — mostra vazio */ }
  };
  useEffect(() => { carregarEventos(); }, [janela.ini.getTime(), janela.fim.getTime(), busca]);

  const porDiaCards = useMemo(() => {
    const m = new Map<string, CardLeve[]>();
    for (const c of cards) {
      if (!c.due) continue;
      const k = c.due.slice(0, 10);
      const a = m.get(k) || []; a.push(c); m.set(k, a);
    }
    return m;
  }, [cards]);

  const porDiaEv = useMemo(() => {
    const m = new Map<string, CalendarEvento[]>();
    for (const ev of eventos) {
      const d = new Date(ev.dt_start);
      const k = keyDia(d);
      const a = m.get(k) || []; a.push(ev); m.set(k, a);
    }
    return m;
  }, [eventos]);

  const nav = (n: number) => {
    const x = new Date(ref);
    if (view === "mes") x.setMonth(x.getMonth() + n);
    else if (view === "semana") x.setDate(x.getDate() + 7 * n);
    else x.setDate(x.getDate() + n);
    setRef(x);
  };
  const irHoje = () => setRef(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()));

  const titulo = view === "mes"
    ? `${MESES_LONGO[ref.getMonth()]} ${ref.getFullYear()}`
    : view === "semana"
      ? (() => {
          const ini = addDias(ref, -ref.getDay());
          const fim = addDias(ini, 6);
          return `${ini.getDate()}/${pad(ini.getMonth() + 1)} — ${fim.getDate()}/${pad(fim.getMonth() + 1)}/${fim.getFullYear()}`;
        })()
      : `${SEMANA[ref.getDay()]}, ${ref.getDate()} ${MESES_LONGO[ref.getMonth()]} ${ref.getFullYear()}`;

  const abrirCriar = (data: Date, hora?: number) => {
    const d = new Date(data);
    if (hora !== undefined) d.setHours(hora, 0, 0, 0);
    else d.setHours(9, 0, 0, 0);
    setCriando({ dt_start: toLocalIso(d) });
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "12px 18px 14px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <button onClick={() => nav(-1)} style={navBtn(t)}>◀</button>
        <span style={{
          fontSize: 12, fontWeight: 600, color: t.textPrimary, letterSpacing: "0.06em",
          textTransform: "uppercase", minWidth: 210, textAlign: "center",
        }}>
          {titulo}
        </span>
        <button onClick={() => nav(1)} style={navBtn(t)}>▶</button>
        <button onClick={irHoje} style={navBtn(t)}>Hoje</button>
        <div style={{ display: "flex", gap: 0, marginLeft: 8 }}>
          {(["mes", "semana", "dia", "agenda"] as CalView[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                ...navBtn(t),
                background: view === v ? t.cardHover : t.inputBg,
                color: view === v ? t.textPrimary : t.textSecondary,
                borderRight: v !== "agenda" ? "none" : `1px solid ${t.border1}`,
                fontWeight: view === v ? 700 : 400,
                textTransform: "uppercase",
              }}>{v === "mes" ? "Mês" : v === "semana" ? "Semana" : v === "dia" ? "Dia" : "Agenda"}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar evento…"
          style={{
            background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textPrimary,
            padding: "5px 10px", fontSize: 10, outline: "none", width: 160,
          }} />
        <button onClick={() => abrirCriar(new Date())}
          style={{
            background: t.accent, border: `1px solid ${t.accent}`, color: "#0A0A0A",
            padding: "6px 14px", fontSize: 10, cursor: "pointer",
            fontWeight: 700, letterSpacing: "0.1em",
          }}>+ CRIAR</button>
      </div>

      {view === "mes" && (
        <ViewMes refDate={ref} porDiaCards={porDiaCards} porDiaEv={porDiaEv} corLista={corLista}
          t={t} agora={agora} onDia={abrirCriar} onCard={onOpen} onEv={setEditando} />
      )}
      {view === "semana" && (
        <ViewSemana refDate={ref} porDiaCards={porDiaCards} porDiaEv={porDiaEv} corLista={corLista}
          t={t} agora={agora} onSlot={abrirCriar} onCard={onOpen} onEv={setEditando} />
      )}
      {view === "dia" && (
        <ViewDia refDate={ref} porDiaCards={porDiaCards} porDiaEv={porDiaEv} corLista={corLista}
          t={t} agora={agora} onSlot={abrirCriar} onCard={onOpen} onEv={setEditando} />
      )}
      {view === "agenda" && (
        <ViewAgenda eventos={eventos} cards={cards} corLista={corLista} t={t}
          agora={agora} onEv={setEditando} onCard={onOpen} />
      )}

      {criando && (
        <EventoModal key={`novo-${criando.dt_start}`}
          t={t} projetistas={projetistas} meuEmail={meuEmail} souGestora={!!souGestora}
          inicial={{ dt_start: criando.dt_start }}
          onClose={() => setCriando(null)}
          onSaved={() => { setCriando(null); carregarEventos(); }} />
      )}
      {editando && (
        <EventoModal key={`edit-${editando.id}-${editando.updated_at || ""}`}
          t={t} projetistas={projetistas} meuEmail={meuEmail} souGestora={!!souGestora} inicial={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); carregarEventos(); }}
          onDeleted={() => { setEditando(null); carregarEventos(); }} />
      )}
    </div>
  );
}

/* ─── View Mês (grid 7×6) ─── */
function ViewMes({ refDate, porDiaCards, porDiaEv, corLista, t, agora, onDia, onCard, onEv }: any) {
  const prim = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const dias = Array.from({ length: 42 }, (_, i) => addDias(prim, i - prim.getDay()));
  const hojeK = keyDia(agora);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {SEMANA.map(s => (
          <div key={s} style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            color: t.textTertiary, textAlign: "center",
          }}>{s}</div>
        ))}
      </div>
      <div style={{
        flex: 1, minHeight: 0, display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: "repeat(6, 1fr)", gap: 4,
      }}>
        {dias.map((d, i) => {
          const k = keyDia(d);
          const cardsDia = porDiaCards.get(k) || [];
          const evsDia = porDiaEv.get(k) || [];
          const foraDoMes = d.getMonth() !== refDate.getMonth();
          const hoje = k === hojeK;
          return (
            <div key={i}
              onClick={(e) => { if (e.target === e.currentTarget) onDia(d); }}
              style={{
                background: t.statBg, border: `1px solid ${hoje ? t.accent : t.border1}`,
                padding: 4, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3,
                opacity: foraDoMes ? 0.42 : 1, minHeight: 0, cursor: "cell",
              }}>
              <div style={{
                fontSize: 9.5, fontWeight: hoje ? 700 : 500,
                color: hoje ? t.accent : t.textTertiary, flexShrink: 0,
              }}>
                {d.getDate()}{d.getDate() === 1 ? ` ${MESES[d.getMonth()]}` : ""}
              </div>
              {evsDia.map((ev: CalendarEvento) => (
                <div key={"ev" + ev.id} onClick={(e) => { e.stopPropagation(); onEv(ev); }}
                  title={ev.title}
                  style={{
                    background: ev.cor + "22", borderLeft: `3px solid ${ev.cor}`,
                    padding: "2px 6px", fontSize: 9, color: t.textPrimary, cursor: "pointer",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0,
                  }}>
                  {TIPO_ICON[ev.tipo] || "▪"} {ev.all_day ? "" : hhmm(ev.dt_start) + " · "}{ev.title}
                </div>
              ))}
              {cardsDia.map((c: CardLeve) => {
                const atr = atrasadoDe(c);
                return (
                  <div key={c.id} onClick={(e) => { e.stopPropagation(); onCard(c.id); }}
                    title={`${c.nome} (card do kanban)`}
                    style={{
                      background: t.card2, border: `1px solid ${t.border1}`,
                      borderLeft: `3px solid ${atr ? "#EF4444" : c.due_complete ? "#10B981" : corLista[c.lista_id] || "#6B7280"}`,
                      padding: "2px 6px", fontSize: 9, color: t.textPrimary, cursor: "pointer",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                    ▦ {c.nome}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─── View Semana (7 colunas × 24h) ─── */
function ViewSemana({ refDate, porDiaCards, porDiaEv, corLista, t, agora, onSlot, onCard, onEv }: any) {
  const ini = addDias(refDate, -refDate.getDay());
  const dias = Array.from({ length: 7 }, (_, i) => addDias(ini, i));
  const horas = Array.from({ length: 24 }, (_, i) => i);
  const hojeK = keyDia(agora);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: `1px solid ${t.border1}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", position: "sticky", top: 0, background: t.headerBg, zIndex: 2 }}>
        <div />
        {dias.map((d, i) => {
          const hoje = keyDia(d) === hojeK;
          return (
            <div key={i} style={{
              padding: "6px 4px", textAlign: "center", borderLeft: `1px solid ${t.border1}`,
              fontSize: 10, color: hoje ? t.accent : t.textSecondary, fontWeight: hoje ? 700 : 500,
            }}>
              {SEMANA[d.getDay()]} <span style={{ fontSize: 14, marginLeft: 4 }}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        {horas.map(h => (
          <React.Fragment key={h}>
            <div style={{ fontSize: 9, color: t.textTertiary, textAlign: "right", padding: "2px 6px", borderTop: `1px solid ${t.border1}` }}>
              {pad(h)}:00
            </div>
            {dias.map((d, i) => (
              <div key={i}
                onClick={() => onSlot(d, h)}
                style={{
                  minHeight: 34, borderTop: `1px solid ${t.border1}`,
                  borderLeft: `1px solid ${t.border1}`, position: "relative", cursor: "cell",
                }}>
                {(porDiaEv.get(keyDia(d)) || []).filter((ev: CalendarEvento) => new Date(ev.dt_start).getHours() === h).map((ev: CalendarEvento) => (
                  <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEv(ev); }}
                    title={ev.title}
                    style={{
                      background: ev.cor + "33", borderLeft: `3px solid ${ev.cor}`,
                      padding: "2px 5px", fontSize: 9.5, color: t.textPrimary, cursor: "pointer",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                    {hhmm(ev.dt_start)} · {ev.title}
                  </div>
                ))}
                {h === 0 && (porDiaCards.get(keyDia(d)) || []).map((c: CardLeve) => (
                  <div key={c.id} onClick={(e) => { e.stopPropagation(); onCard(c.id); }}
                    style={{
                      background: t.card2, border: `1px solid ${t.border1}`,
                      borderLeft: `3px solid ${corLista[c.lista_id] || "#6B7280"}`,
                      padding: "2px 5px", fontSize: 9, color: t.textPrimary, cursor: "pointer",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>▦ {c.nome}</div>
                ))}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── View Dia (agenda vertical 24h) ─── */
function ViewDia({ refDate, porDiaCards, porDiaEv, corLista, t, agora, onSlot, onCard, onEv }: any) {
  const k = keyDia(refDate);
  const evsDia = porDiaEv.get(k) || [];
  const cardsDia = porDiaCards.get(k) || [];
  const horas = Array.from({ length: 24 }, (_, i) => i);
  const hoje = k === keyDia(agora);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: `1px solid ${t.border1}` }}>
      <div style={{ padding: "8px 14px", background: t.headerBg, borderBottom: `1px solid ${t.border1}` }}>
        <span style={{ color: hoje ? t.accent : t.textPrimary, fontSize: 14, fontWeight: 700 }}>
          {SEMANA[refDate.getDay()]}, {refDate.getDate()} de {MESES_LONGO[refDate.getMonth()]}
        </span>
      </div>
      {cardsDia.length > 0 && (
        <div style={{ padding: 8, borderBottom: `1px solid ${t.border1}` }}>
          <div style={{ fontSize: 9, letterSpacing: "0.12em", color: t.textTertiary, marginBottom: 4 }}>PRAZOS DE CARDS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {cardsDia.map((c: CardLeve) => (
              <div key={c.id} onClick={() => onCard(c.id)}
                style={{
                  background: t.card2, border: `1px solid ${t.border1}`,
                  borderLeft: `3px solid ${corLista[c.lista_id] || "#6B7280"}`,
                  padding: "5px 10px", fontSize: 11, color: t.textPrimary, cursor: "pointer",
                }}>▦ {c.nome}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "62px 1fr" }}>
        {horas.map(h => (
          <React.Fragment key={h}>
            <div style={{ fontSize: 10, color: t.textTertiary, textAlign: "right", padding: "4px 8px", borderTop: `1px solid ${t.border1}` }}>
              {pad(h)}:00
            </div>
            <div onClick={() => onSlot(refDate, h)}
              style={{ minHeight: 46, borderTop: `1px solid ${t.border1}`, cursor: "cell", padding: 2 }}>
              {evsDia.filter((ev: CalendarEvento) => new Date(ev.dt_start).getHours() === h).map((ev: CalendarEvento) => (
                <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEv(ev); }}
                  style={{
                    background: ev.cor + "33", borderLeft: `4px solid ${ev.cor}`,
                    padding: "4px 10px", fontSize: 11, color: t.textPrimary, cursor: "pointer", marginBottom: 2,
                  }}>
                  <div style={{ fontWeight: 600 }}>{hhmm(ev.dt_start)}{ev.dt_end ? ` – ${hhmm(ev.dt_end)}` : ""} · {ev.title}</div>
                  {ev.descr && <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 2 }}>{ev.descr}</div>}
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── View Agenda (lista scrollável de próximos eventos) ─── */
function ViewAgenda({ eventos, cards, corLista, t, agora, onEv, onCard }: any) {
  const items = useMemo(() => {
    const evs = (eventos as CalendarEvento[]).filter(e => new Date(e.dt_start) >= new Date(agora.getTime() - 86400000))
      .map(e => ({ kind: "ev" as const, when: new Date(e.dt_start), ev: e }));
    const cds = (cards as CardLeve[]).filter(c => c.due && new Date(c.due) >= new Date(agora.getTime() - 86400000))
      .map(c => ({ kind: "card" as const, when: new Date(c.due!), c }));
    return [...evs, ...cds].sort((a, b) => a.when.getTime() - b.when.getTime());
  }, [eventos, cards, agora]);

  const groupsByDay = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const it of items) {
      const k = keyDia(it.when);
      const a = m.get(k) || [] as typeof items; a.push(it); m.set(k, a);
    }
    return Array.from(m.entries());
  }, [items]);

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: `1px solid ${t.border1}` }}>
      {items.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 11 }}>
          Nenhum evento ou prazo nos próximos 90 dias.
        </div>
      )}
      {groupsByDay.map(([k, lista]) => {
        const d = new Date(lista[0].when);
        const hoje = k === keyDia(agora);
        return (
          <div key={k}>
            <div style={{
              padding: "10px 14px", background: t.headerBg, borderBottom: `1px solid ${t.border1}`,
              display: "flex", alignItems: "baseline", gap: 10, position: "sticky", top: 0, zIndex: 1,
            }}>
              <span style={{
                fontSize: 22, fontWeight: 700, color: hoje ? t.accent : t.textPrimary, lineHeight: 1,
              }}>{d.getDate()}</span>
              <span style={{ fontSize: 10, letterSpacing: "0.12em", color: t.textTertiary, textTransform: "uppercase" }}>
                {SEMANA[d.getDay()]} · {MESES_LONGO[d.getMonth()]} {d.getFullYear()}{hoje ? " · HOJE" : ""}
              </span>
            </div>
            {lista.map((it, i) => {
              if (it.kind === "ev") {
                const e = it.ev;
                return (
                  <div key={`ev${e.id}${i}`} onClick={() => onEv(e)}
                    style={{
                      display: "flex", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${t.border1}`,
                      cursor: "pointer", alignItems: "flex-start",
                    }}>
                    <div style={{ width: 6, background: e.cor, alignSelf: "stretch", borderRadius: 2 }} />
                    <div style={{ minWidth: 70, fontSize: 11, color: t.textSecondary, paddingTop: 2 }}>
                      {e.all_day ? "Dia inteiro" : hhmm(e.dt_start)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: t.textPrimary, fontWeight: 500 }}>
                        {TIPO_ICON[e.tipo] || "▪"} {e.title}
                        {e.recorrente && <span style={{ fontSize: 9, marginLeft: 6, color: t.textTertiary }}>↻</span>}
                      </div>
                      {(e.local || e.link_chamada || (e.convidados?.length || 0) > 0 || e.responsavel_nome) && (
                        <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {e.responsavel_nome && <span style={{ color: e.cor, fontWeight: 600 }}>→ {e.responsavel_nome.split(" ")[0]}</span>}
                          {e.local && <span>◈ {e.local}</span>}
                          {e.link_chamada && <a href={e.link_chamada} target="_blank" rel="noopener"
                            onClick={(ev) => ev.stopPropagation()}
                            style={{ color: e.cor, textDecoration: "underline" }}>▶ Chamada</a>}
                          {(e.convidados?.length || 0) > 0 && <span>◦ {e.convidados.length}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              const c = it.c;
              return (
                <div key={`card${c.id}${i}`} onClick={() => onCard(c.id)}
                  style={{
                    display: "flex", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${t.border1}`,
                    cursor: "pointer", alignItems: "flex-start",
                  }}>
                  <div style={{ width: 6, background: corLista[c.lista_id] || "#6B7280", alignSelf: "stretch", borderRadius: 2 }} />
                  <div style={{ minWidth: 70, fontSize: 11, color: t.textSecondary, paddingTop: 2 }}>Prazo</div>
                  <div style={{ flex: 1, fontSize: 12, color: t.textPrimary }}>▦ {c.nome}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Modal criar/editar evento (estilo Google Calendar) ─── */
const LEMBRETE_OPCOES = [
  { min: 0,    label: "Na hora" },
  { min: 5,    label: "5 min" },
  { min: 10,   label: "10 min" },
  { min: 15,   label: "15 min" },
  { min: 30,   label: "30 min" },
  { min: 60,   label: "1 hora" },
  { min: 120,  label: "2 horas" },
  { min: 1440, label: "1 dia" },
  { min: 2880, label: "2 dias" },
];

const REPETIR_OPCOES: Array<{ v: string | null; label: string }> = [
  { v: null,                     label: "Não repete" },
  { v: "FREQ=DAILY",             label: "Todo dia" },
  { v: "FREQ=WEEKLY",            label: "Toda semana" },
  { v: "FREQ=WEEKLY;COUNT=4",    label: "Semanal · 4 semanas" },
  { v: "FREQ=MONTHLY",           label: "Todo mês" },
  { v: "FREQ=YEARLY",            label: "Todo ano" },
];

const TIPO_ICON: Record<string, string> = { evento: "▪", chamada: "▶", tarefa: "✓" };

function EventoModal({ t, projetistas, inicial, onClose, onSaved, onDeleted, meuEmail, souGestora }: {
  t: any; projetistas: ProjetistaListItem[];
  inicial: Partial<CalendarEvento> & { dt_start: string };
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
  meuEmail?: string; souGestora?: boolean;
}) {
  const [tipo, setTipo] = useState<CalendarTipoLocal>((inicial.tipo as any) || "evento");
  const [title, setTitle] = useState(inicial.title || "");
  const [descr, setDescr] = useState(inicial.descr || "");
  const [local, setLocal] = useState(inicial.local || "");
  const [linkChamada, setLinkChamada] = useState(inicial.link_chamada || "");
  const [dtStart, setDtStart] = useState(toDateTimeLocal(inicial.dt_start));
  const [dtEnd, setDtEnd] = useState(inicial.dt_end ? toDateTimeLocal(inicial.dt_end) : "");
  const [allDay, setAllDay] = useState(!!inicial.all_day);
  const [cor, setCor] = useState(inicial.cor || CAL_CORES[0].hex);
  const [convidados, setConvidados] = useState<string[]>(inicial.convidados || []);
  const [lembretes, setLembretes] = useState<number[]>(inicial.lembretes || [10]);
  const [rrule, setRrule] = useState<string | null>(inicial.rrule || null);
  const [responsavelId, setResponsavelId] = useState<string | null>(inicial.responsavel_id || null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const editando = !!inicial.id;
  const souAutor = !editando || (meuEmail && inicial.autor_email && meuEmail.toLowerCase() === inicial.autor_email.toLowerCase());
  const rsvpAtual = (meuEmail && inicial.rsvp) ? inicial.rsvp[meuEmail.toLowerCase()] : undefined;

  const toggleConv = (email: string) =>
    setConvidados(v => v.includes(email) ? v.filter(x => x !== email) : [...v, email]);
  const toggleLembrete = (min: number) =>
    setLembretes(v => v.includes(min) ? v.filter(x => x !== min) : [...v, min].sort((a, b) => a - b));

  const salvar = async () => {
    if (!title.trim()) { setErro("Título obrigatório"); return; }
    // dt_end antes de dt_start → ignora (não faz sentido; evento sumia da agenda)
    const iniIso = new Date(dtStart).toISOString();
    const fimIso = dtEnd ? new Date(dtEnd).toISOString() : null;
    const fimValido = fimIso && fimIso > iniIso ? fimIso : null;
    setSalvando(true); setErro("");
    try {
      const payload = {
        title: title.trim(), descr: descr.trim(),
        dt_start: iniIso,
        dt_end: fimValido,
        all_day: allDay, cor, convidados,
        local: local.trim() || undefined,
        tipo: tipo as any,
        link_chamada: linkChamada.trim() || null,
        lembretes,
        rrule: rrule || null,
        responsavel_id: responsavelId || null,
      };
      if (editando) await api.calendarUpdate(inicial.id!, payload);
      else await api.calendarCreate(payload);
      onSaved();
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally { setSalvando(false); }
  };
  const excluir = async () => {
    if (!editando || !onDeleted) return;
    if (!confirm(`Apagar o evento "${title}"?`)) return;
    setSalvando(true);
    try { await api.calendarDelete(inicial.id!); onDeleted(); }
    catch (e: any) { setErro(String(e?.message || e)); }
    finally { setSalvando(false); }
  };
  const responder = async (status: "sim" | "nao" | "talvez") => {
    if (!editando) return;
    setSalvando(true);
    try { await api.calendarRsvp(inicial.id!, status); onSaved(); }
    catch (e: any) { setErro(String(e?.message || e)); }
    finally { setSalvando(false); }
  };

  const TIPOS: Array<{ v: CalendarTipoLocal; label: string }> = [
    { v: "evento",  label: "Compromisso" },
    { v: "chamada", label: "Chamada de vídeo" },
    { v: "tarefa",  label: "Tarefa" },
  ];

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      <div style={{
        background: t.bg, border: `1px solid ${t.border2}`, width: 520, maxWidth: "100%",
        maxHeight: "92vh", overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: t.textPrimary, textTransform: "uppercase" }}>
            {editando ? "Editar" : "Novo"} · {TIPOS.find(x => x.v === tipo)?.label}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.textTertiary, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Tipo — abas topo */}
        <div style={{ display: "flex", gap: 0, marginBottom: 12, border: `1px solid ${t.border1}` }}>
          {TIPOS.map(x => (
            <button key={x.v} onClick={() => setTipo(x.v)} disabled={!souAutor}
              style={{
                flex: 1, padding: "7px 10px", fontSize: 10, letterSpacing: "0.08em",
                background: tipo === x.v ? cor + "22" : t.inputBg,
                color: tipo === x.v ? t.textPrimary : t.textSecondary,
                borderRight: `1px solid ${t.border1}`, border: "none",
                fontWeight: tipo === x.v ? 700 : 400, cursor: souAutor ? "pointer" : "not-allowed",
                textTransform: "uppercase",
              }}>{TIPO_ICON[x.v]} {x.label}</button>
          ))}
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título"
          disabled={!souAutor}
          style={{ ...inpStyle(t), fontSize: 14, fontWeight: 500, marginBottom: 10 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <label style={lblStyle(t)}>
            Início
            <input type={allDay ? "date" : "datetime-local"} value={allDay ? dtStart.slice(0, 10) : dtStart}
              onChange={(e) => setDtStart(e.target.value)} disabled={!souAutor}
              style={inpStyle(t)} />
          </label>
          <label style={lblStyle(t)}>
            Fim {allDay ? "(opcional)" : ""}
            <input type={allDay ? "date" : "datetime-local"} value={dtEnd ? (allDay ? dtEnd.slice(0, 10) : dtEnd) : ""}
              onChange={(e) => setDtEnd(e.target.value)} disabled={!souAutor}
              style={inpStyle(t)} />
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.textSecondary }}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} disabled={!souAutor} />
            Dia inteiro
          </label>
          <label style={{ ...lblStyle(t), flex: 1 }}>
            Repetir
            <select value={rrule || ""} onChange={(e) => setRrule(e.target.value || null)}
              disabled={!souAutor} style={{ ...inpStyle(t), padding: "6px 10px" }}>
              {REPETIR_OPCOES.map(o => (
                <option key={o.label} value={o.v || ""}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label style={lblStyle(t)}>
          Local
          <input value={local} onChange={(e) => setLocal(e.target.value)} disabled={!souAutor}
            placeholder="Endereço, sala, ou vazio" style={inpStyle(t)} />
        </label>

        {tipo === "chamada" && (
          <div style={{ marginTop: 8 }}>
            <label style={lblStyle(t)}>
              Link da chamada (opcional — cole o link do Meet aqui)
              <input value={linkChamada} onChange={(e) => setLinkChamada(e.target.value)}
                disabled={!souAutor} placeholder="https://meet.google.com/xxx-xxxx-xxx"
                style={inpStyle(t)} />
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
              <a href="https://meet.google.com/new" target="_blank" rel="noopener"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "5px 12px", background: t.inputBg, border: `1px solid ${t.border1}`,
                  color: t.textPrimary, fontSize: 10, letterSpacing: "0.1em",
                  textDecoration: "none", fontWeight: 600,
                }}>
                ▶ ABRIR GOOGLE MEET
              </a>
              {linkChamada && (
                <a href={linkChamada} target="_blank" rel="noopener"
                  style={{ fontSize: 10, color: cor, textDecoration: "underline" }}>
                  Abrir link salvo
                </a>
              )}
            </div>
          </div>
        )}

        <label style={{ ...lblStyle(t), marginTop: 10 }}>
          Descrição
          <textarea value={descr} onChange={(e) => setDescr(e.target.value)} rows={2}
            disabled={!souAutor} placeholder="Notas, agenda, links…"
            style={{ ...inpStyle(t), resize: "vertical", fontFamily: "inherit" }} />
        </label>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary, marginBottom: 6 }}>
            LEMBRETES (push antes)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {LEMBRETE_OPCOES.map(o => {
              const on = lembretes.includes(o.min);
              return (
                <button key={o.min} onClick={() => toggleLembrete(o.min)} disabled={!souAutor}
                  style={{
                    padding: "4px 9px", cursor: souAutor ? "pointer" : "not-allowed",
                    background: on ? `${cor}22` : t.inputBg,
                    border: `1px solid ${on ? cor : t.border1}`,
                    color: on ? t.textPrimary : t.textSecondary, fontSize: 10,
                  }}>{o.label}</button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary, marginBottom: 6 }}>COR</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {CAL_CORES.map(c => (
              <button key={c.hex} onClick={() => setCor(c.hex)} title={c.label} disabled={!souAutor}
                style={{
                  width: 22, height: 22, borderRadius: "50%", background: c.hex,
                  cursor: souAutor ? "pointer" : "not-allowed",
                  border: cor === c.hex ? `3px solid ${t.textPrimary}` : "2px solid transparent",
                }} />
            ))}
          </div>
        </div>

        {/* Delegação — só gestora edita; projetista comum vê o nome se estiver setado */}
        {(souGestora || inicial.responsavel_nome) && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary, marginBottom: 6 }}>
              RESPONSÁVEL {souGestora ? "(quem faz)" : ""}
            </div>
            {souGestora ? (
              <select value={responsavelId || ""}
                onChange={(e) => setResponsavelId(e.target.value || null)}
                disabled={!souAutor}
                style={{ ...inpStyle(t), padding: "6px 10px" }}>
                <option value="">— sem responsável (só do autor)</option>
                {projetistas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome}{p.papel === "gestora" ? " ★" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{
                padding: "6px 10px", background: t.inputBg, border: `1px solid ${t.border1}`,
                fontSize: 11, color: t.textSecondary,
              }}>{inicial.responsavel_nome || "— sem responsável"}</div>
            )}
          </div>
        )}

        {projetistas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary, marginBottom: 6 }}>
              CONVIDAR ({convidados.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {projetistas.map(p => {
                const on = convidados.includes(p.email);
                const resp = (inicial.rsvp || {})[p.email?.toLowerCase() || ""];
                const badge = resp === "sim" ? " ✓" : resp === "nao" ? " ✗" : resp === "talvez" ? " ?" : "";
                return (
                  <button key={p.id} onClick={() => toggleConv(p.email)} disabled={!souAutor}
                    title={p.email + (resp ? ` — ${resp}` : "")}
                    style={{
                      padding: "4px 10px", cursor: souAutor ? "pointer" : "default",
                      background: on ? `${cor}22` : t.inputBg,
                      border: `1px solid ${on ? cor : t.border1}`,
                      color: on ? t.textPrimary : t.textSecondary,
                      fontSize: 10,
                    }}>{p.nome.split(" ")[0]}{badge}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* RSVP — só aparece pra convidado (não autor) editando */}
        {editando && !souAutor && meuEmail && convidados.includes(meuEmail) && (
          <div style={{ marginTop: 14, padding: 10, border: `1px solid ${t.border1}`, background: t.inputBg }}>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: t.textTertiary, marginBottom: 6 }}>
              VOCÊ VAI? {rsvpAtual ? `(sua resposta: ${rsvpAtual.toUpperCase()})` : ""}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => responder("sim")} disabled={salvando}
                style={rsvpBtn(t, rsvpAtual === "sim", "#10B981")}>SIM</button>
              <button onClick={() => responder("talvez")} disabled={salvando}
                style={rsvpBtn(t, rsvpAtual === "talvez", "#F59E0B")}>TALVEZ</button>
              <button onClick={() => responder("nao")} disabled={salvando}
                style={rsvpBtn(t, rsvpAtual === "nao", "#EF4444")}>NÃO</button>
            </div>
          </div>
        )}

        {erro && <div style={{ color: "#EF4444", fontSize: 11, marginTop: 10 }}>{erro}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {editando && onDeleted && souAutor && (
            <button onClick={excluir} disabled={salvando}
              style={{
                padding: "8px 14px", background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.35)", color: "#EF4444",
                cursor: "pointer", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              }}>APAGAR</button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose}
            style={{
              padding: "8px 14px", background: "none", border: `1px solid ${t.border1}`,
              color: t.textSecondary, cursor: "pointer", fontSize: 10, letterSpacing: "0.1em",
            }}>{souAutor ? "CANCELAR" : "FECHAR"}</button>
          {souAutor && (
            <button onClick={salvar} disabled={salvando || !title.trim()}
              style={{
                padding: "8px 20px", background: cor, border: `1px solid ${cor}`,
                color: "#fff", cursor: salvando ? "wait" : "pointer",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                opacity: !title.trim() ? 0.5 : 1,
              }}>{editando ? "SALVAR" : "CRIAR"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

type CalendarTipoLocal = "evento" | "chamada" | "tarefa";

const rsvpBtn = (t: any, on: boolean, corAtiva: string): React.CSSProperties => ({
  flex: 1, padding: "7px 10px", fontSize: 10, letterSpacing: "0.1em",
  background: on ? corAtiva + "22" : "none",
  border: `1px solid ${on ? corAtiva : t.border1}`,
  color: on ? corAtiva : t.textSecondary, cursor: "pointer", fontWeight: 700,
});

const inpStyle = (t: any): React.CSSProperties => ({
  width: "100%", background: t.inputBg, border: `1px solid ${t.border1}`,
  color: t.textPrimary, padding: "7px 10px", fontSize: 12, outline: "none", boxSizing: "border-box",
});
const lblStyle = (t: any): React.CSSProperties => ({
  display: "flex", flexDirection: "column", gap: 3, fontSize: 9,
  letterSpacing: "0.14em", color: t.textTertiary,
});

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function toLocalIso(d: Date): string { return toDateTimeLocal(d.toISOString()); }
function hhmm(iso: string): string { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
// eslint-disable-next-line @typescript-eslint/no-namespace
import * as React from "react";

/* ═══ Timeline — eixo de dias, swimlane por projetista ═══ */
export function TimelineView({ listas, cards, t, onOpen }: ViewProps) {
  const DAY = 34, NDIAS = 70, LANE = 26, CHIP_DIAS = 4, NOMES_W = 170;
  const [ini, setIni] = useState(() => {
    const h = new Date(); h.setHours(0, 0, 0, 0);
    return addDias(h, -7 - h.getDay());
  });
  const corLista = useMemo(
    () => Object.fromEntries(listas.map(l => [l.id, listaCor(l.nome)])), [listas]);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const idxHoje = Math.round((hoje.getTime() - ini.getTime()) / 86400000);

  const { lanes, fora, semPrazo } = useMemo(() => {
    type Item = { c: CardLeve; dia: number; row: number };
    const m = new Map<string, Item[]>();
    let fora = 0, semPrazo = 0;
    for (const c of cards) {
      if (!c.due) { semPrazo++; continue; }
      const d = new Date(c.due.slice(0, 10) + "T00:00:00");
      const dia = Math.round((d.getTime() - ini.getTime()) / 86400000);
      if (dia < 0 || dia >= NDIAS) { fora++; continue; }
      const nomes = c.membros.length ? c.membros.map(mb => mb.nome) : [SEM_RESP];
      for (const n of nomes) { const a = m.get(n) || []; a.push({ c, dia, row: 0 }); m.set(n, a); }
    }
    const lanes = [...m.entries()]
      .sort((a, b) => (a[0] === SEM_RESP ? 1 : b[0] === SEM_RESP ? -1 : a[0].localeCompare(b[0], "pt-BR")))
      .map(([nome, itens]) => {
        itens.sort((a, b) => a.dia - b.dia);
        const slots: number[] = [];   // fim (dia exclusivo) ocupado em cada linha da lane
        for (const it of itens) {
          let r = slots.findIndex(s => s <= it.dia);
          if (r === -1) { r = slots.length; slots.push(0); }
          slots[r] = it.dia + CHIP_DIAS;
          it.row = r;
        }
        return { nome, itens, rows: slots.length };
      });
    return { lanes, fora, semPrazo };
  }, [cards, ini]);

  const mesesMarcas: { i: number; label: string }[] = [];
  for (let i = 0; i < NDIAS; i++) {
    const d = addDias(ini, i);
    if (d.getDate() === 1 || i === 0) mesesMarcas.push({ i, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` });
  }
  const shade = t.border1;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "12px 18px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <button onClick={() => setIni(v => addDias(v, -14))} style={navBtn(t)}>◀ 2 sem</button>
        <span style={{
          fontSize: 11, fontWeight: 600, color: t.textPrimary, letterSpacing: "0.06em",
          minWidth: 165, textAlign: "center",
        }}>
          {fmtBr(keyDia(ini))} → {fmtBr(keyDia(addDias(ini, NDIAS - 1)))}
        </span>
        <button onClick={() => setIni(v => addDias(v, 14))} style={navBtn(t)}>2 sem ▶</button>
        <button onClick={() => { const h = new Date(); h.setHours(0, 0, 0, 0); setIni(addDias(h, -7 - h.getDay())); }} style={navBtn(t)}>Hoje</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9.5, color: t.textTertiary }}>
          {fora > 0 && `${fora} com prazo fora da janela`}
          {fora > 0 && semPrazo > 0 && " · "}
          {semPrazo > 0 && `${semPrazo} sem prazo`}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: `1px solid ${t.border1}` }}>
        <div style={{ width: NOMES_W + NDIAS * DAY, position: "relative" }}>
          {/* Header de dias (sticky no scroll vertical) */}
          <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 3, background: t.bg, borderBottom: `1px solid ${t.border1}` }}>
            <div style={{
              width: NOMES_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 4,
              background: t.bg, borderRight: `1px solid ${t.border1}`,
              fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              color: t.textTertiary, padding: "10px 10px 0",
            }}>
              Projetista
            </div>
            <div style={{ position: "relative", height: 32, width: NDIAS * DAY }}>
              {mesesMarcas.map(m => (
                <span key={m.i} style={{
                  position: "absolute", left: m.i * DAY + 3, top: 2, fontSize: 8.5, fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase", color: t.textSecondary,
                }}>{m.label}</span>
              ))}
              {Array.from({ length: NDIAS }, (_, i) => {
                const d = addDias(ini, i);
                const fds = d.getDay() === 0 || d.getDay() === 6;
                const isHoje = i === idxHoje;
                return (
                  <span key={i} style={{
                    position: "absolute", left: i * DAY, top: 17, width: DAY, textAlign: "center",
                    fontSize: 8.5, color: isHoje ? t.accent : fds ? t.textTertiary : t.textSecondary,
                    fontWeight: isHoje ? 700 : 400,
                  }}>{d.getDate()}</span>
                );
              })}
            </div>
          </div>
          {lanes.length === 0 && (
            <div style={{ padding: 30, fontSize: 10, color: t.textTertiary, position: "sticky", left: 0, width: 400 }}>
              Nenhum card com prazo nesta janela.
            </div>
          )}
          {lanes.map(lane => {
            const h = Math.max(lane.rows, 1) * LANE + 8;
            return (
              <div key={lane.nome} style={{ display: "flex", borderBottom: `1px solid ${t.border1}` }}>
                <div style={{
                  width: NOMES_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 2,
                  background: t.bg, borderRight: `1px solid ${t.border1}`, padding: "6px 10px",
                  fontSize: 10, fontWeight: 600, color: lane.nome === SEM_RESP ? t.textTertiary : t.textPrimary,
                }}>
                  {lane.nome}
                  <span style={{ color: t.textTertiary, fontWeight: 400 }}> · {lane.itens.length}</span>
                </div>
                <div style={{
                  position: "relative", width: NDIAS * DAY, height: h,
                  backgroundImage: `repeating-linear-gradient(90deg, ${shade} 0px, ${shade} ${DAY}px, transparent ${DAY}px, transparent ${6 * DAY}px, ${shade} ${6 * DAY}px, ${shade} ${7 * DAY}px)`,
                }}>
                  {idxHoje >= 0 && idxHoje < NDIAS && (
                    <div style={{
                      position: "absolute", left: idxHoje * DAY, top: 0, width: DAY, height: "100%",
                      background: `${t.accent}14`, borderLeft: `1px solid ${t.accent}`,
                    }} />
                  )}
                  {lane.itens.map(it => {
                    const atr = atrasadoDe(it.c);
                    return (
                      <div key={it.c.id} onClick={() => onOpen(it.c.id)}
                        title={`${it.c.nome} — ${fmtBr(it.c.due)}`}
                        style={{
                          position: "absolute", left: it.dia * DAY + 1, top: 4 + it.row * LANE,
                          width: CHIP_DIAS * DAY - 4, height: LANE - 5,
                          background: t.card2, border: `1px solid ${t.border1}`,
                          borderLeft: `3px solid ${atr ? "#EF4444" : it.c.due_complete ? "#10B981" : corLista[it.c.lista_id] || "#6B7280"}`,
                          fontSize: 8.5, color: t.textPrimary, padding: "0 5px", cursor: "pointer",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          lineHeight: `${LANE - 7}px`, zIndex: 1,
                        }}>
                        {it.c.nome}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ Lista — tabela agrupada por fase do board (mesmo padrão da view
      Lista do gestao.parket.works): um bloco por lista com borda superior
      na cor da fase, linhas clicáveis que abrem o CardModal via onOpen. ═══ */
export function ListaView({ listas, cards, t, onOpen }: ViewProps) {
  // Agrupa os cards por lista preservando a ordem do board (pos)
  const grupos = useMemo(() => {
    const porLista = new Map<string, CardLeve[]>();
    for (const c of cards) {
      const a = porLista.get(c.lista_id) || []; a.push(c); porLista.set(c.lista_id, a);
    }
    return listas
      .map(l => ({ l, cor: listaCor(l.nome), cs: (porLista.get(l.id) || []).sort((a, b) => a.pos - b.pos) }))
      .filter(g => g.cs.length > 0);
  }, [listas, cards]);

  // Estilos compartilhados de célula (header e corpo da tabela)
  const th: React.CSSProperties = {
    padding: "7px 12px", textAlign: "left", fontWeight: 400,
    fontSize: 8.5, letterSpacing: "0.18em", color: t.textTertiary, textTransform: "uppercase",
    borderBottom: `1px solid ${t.border1}`, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "9px 12px", fontSize: 10.5, color: t.textSecondary,
    borderBottom: `1px solid ${t.border1}`, verticalAlign: "middle",
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 18px" }}>
      {grupos.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 11 }}>
          Nenhum card.
        </div>
      )}
      {grupos.map(({ l, cor, cs }) => (
        <div key={l.id} style={{
          marginBottom: 16, background: t.statBg,
          border: `1px solid ${t.border1}`, borderTop: `3px solid ${cor}`,
        }}>
          {/* Header do bloco: bolinha da cor + nome da fase + contagem */}
          <div style={{
            padding: "10px 14px", borderBottom: `1px solid ${t.border1}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0 }} />
            <span style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em",
              color: t.textPrimary, textTransform: "uppercase",
            }}>{l.nome}</span>
            <span style={{ fontSize: 9.5, color: t.textTertiary }}>{cs.length}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Card</th>
                <th style={th}>Responsáveis</th>
                <th style={th}>Etiquetas</th>
                <th style={{ ...th, width: 90 }}>Prazo</th>
                <th style={{ ...th, width: 90 }}>Checklist</th>
                <th style={th}>Fiscal</th>
                <th style={{ ...th, width: 95, textAlign: "right" }}>Atividade</th>
              </tr>
            </thead>
            <tbody>
              {cs.map(c => <ListaLinha key={c.id} c={c} cor={cor} t={t} td={td} onOpen={onOpen} />)}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* Linha da tabela da view Lista: clique abre o card. */
function ListaLinha({ c, cor, t, td, onOpen }: {
  c: CardLeve; cor: string; t: any; td: React.CSSProperties; onOpen: (id: string) => void;
}) {
  const atr = atrasadoDe(c);
  const resp = c.responsaveis.length
    ? c.responsaveis.map(r => (r.nome || "").split(" ")[0]).filter(Boolean).join(" · ")
    : c.membros.map(m => m.nome.split(" ")[0]).join(" · ");
  return (
    <tr onClick={() => onOpen(c.id)} style={{ cursor: "pointer" }}
      onMouseEnter={e => { e.currentTarget.style.background = t.cardHover; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      {/* Nome do card + cliente/endereço embaixo, com chips de alerta */}
      <td style={{ ...td, borderLeft: `3px solid ${cor}`, maxWidth: 340 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: t.textPrimary,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{c.nome}</span>
          {c.tem_aditivo && (
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", color: "#8B5CF6",
              border: "1px solid #8B5CF655", padding: "1px 5px", flexShrink: 0,
            }}>ADITIVO</span>
          )}
          {c.pendentes_projetos > 0 && (
            <span title={`${c.pendentes_projetos} itens não liberados`} style={{
              fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", color: "#EF4444",
              border: "1px solid #EF444455", padding: "1px 5px", flexShrink: 0,
            }}>{c.pendentes_projetos} PEND</span>
          )}
        </div>
        {(c.cliente || c.endereco) && (
          <div style={{
            fontSize: 9, color: t.textTertiary, marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {[c.cliente, c.endereco].filter(Boolean).join(" · ")}
          </div>
        )}
      </td>
      <td style={{ ...td, fontSize: 9.5, whiteSpace: "nowrap" }}>{resp || "sem responsável"}</td>
      <td style={td}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, maxWidth: 180 }}>
          {c.labels.map((lb, i) => (
            <span key={i} title={lb.nome} style={{
              fontSize: 8, fontWeight: 600, color: "#111", padding: "1px 7px",
              background: labelCor(lb.cor), borderRadius: 2, whiteSpace: "nowrap",
            }}>{lb.nome}</span>
          ))}
        </div>
      </td>
      <td style={{
        ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
        color: atr ? "#EF4444" : c.due_complete ? "#10B981" : td.color, fontWeight: atr ? 700 : 400,
      }}>
        {c.due ? fmtBr(c.due) : ""}
      </td>
      <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {c.chk_total > 0 ? `${c.chk_done}/${c.chk_total}` : ""}
      </td>
      <td style={{ ...td, fontSize: 9.5, whiteSpace: "nowrap" }}>
        {c.fiscais_nomes.map(n => n.split(" ")[0]).join(" · ")}
      </td>
      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontSize: 9.5 }}>
        {c.date_last_activity ? fmtBr(c.date_last_activity) : ""}
      </td>
    </tr>
  );
}

/* ═══ Jornada — funil de etapas + progresso de cada projeto no fluxo ═══ */
export function JornadaView({ listas, cards, t, onOpen }: ViewProps) {
  const N = listas.length;
  const idxDe = useMemo(() => new Map(listas.map((l, i) => [l.id, i])), [listas]);
  const counts = useMemo(() => {
    const a = listas.map(() => 0);
    for (const c of cards) { const i = idxDe.get(c.lista_id); if (i !== undefined) a[i]++; }
    return a;
  }, [cards, listas, idxDe]);
  const rows = useMemo(() => [...cards].sort((a, b) => {
    const ia = idxDe.get(a.lista_id) ?? 0, ib = idxDe.get(b.lista_id) ?? 0;
    if (ia !== ib) return ia - ib;
    if (!!a.due !== !!b.due) return a.due ? -1 : 1;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    return a.nome.localeCompare(b.nome, "pt-BR");
  }), [cards, idxDe]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "12px 18px 14px", gap: 10 }}>
      {/* Funil: contagem por etapa, na ordem do fluxo */}
      <div style={{ display: "flex", gap: 4, overflowX: "auto", flexShrink: 0, paddingBottom: 2 }}>
        {listas.map((l, i) => (
          <div key={l.id} title={l.nome} style={{
            minWidth: 72, flex: 1, background: t.statBg, border: `1px solid ${t.border1}`,
            borderTop: `2px solid ${listaCor(l.nome)}`, padding: "6px 8px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary }}>{counts[i]}</div>
            <div style={{
              fontSize: 7.5, letterSpacing: "0.06em", textTransform: "uppercase", color: t.textTertiary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{l.nome}</div>
          </div>
        ))}
      </div>
      {/* Jornada card a card */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${t.border1}` }}>
        {rows.map(c => {
          const i = idxDe.get(c.lista_id) ?? 0;
          const cor = listaCor(listas[i]?.nome || "");
          const atr = atrasadoDe(c);
          return (
            <div key={c.id} onClick={() => onOpen(c.id)}
              onMouseEnter={e => { e.currentTarget.style.background = t.cardHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = t.statBg; }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "7px 12px",
                borderBottom: `1px solid ${t.border1}`, cursor: "pointer", background: t.statBg,
              }}>
              <div style={{ width: 300, flexShrink: 0, minWidth: 0 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, color: t.textPrimary,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{c.nome}</div>
                <div style={{
                  fontSize: 8.5, color: t.textTertiary,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  👤 {c.membros.length ? c.membros.map(m => m.nome).join(" · ") : "sem responsável"}
                  {c.due && (
                    <span style={{ color: atr ? "#EF4444" : c.due_complete ? "#10B981" : t.textTertiary }}>
                      {" "}· {atr ? "⚠" : "⏱"} {fmtBr(c.due)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", gap: 2, alignItems: "center" }}>
                {listas.map((l, j) => (
                  <div key={l.id} title={l.nome} style={{
                    flex: 1, height: j === i ? 10 : 6, borderRadius: 1,
                    background: j < i ? `${cor}55` : j === i ? cor : t.border1,
                  }} />
                ))}
              </div>
              <div style={{
                width: 200, flexShrink: 0, fontSize: 8.5, color: t.textSecondary, textAlign: "right",
                letterSpacing: "0.04em", textTransform: "uppercase",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {i + 1}/{N} · {listas[i]?.nome}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ padding: 30, fontSize: 10, color: t.textTertiary }}>Nenhum card.</div>
        )}
      </div>
    </div>
  );
}
