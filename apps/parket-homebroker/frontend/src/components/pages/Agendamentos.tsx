import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, Plus, MapPin, Video, X, Clock, User, Settings, Trash2, ExternalLink, Search, Download, Smartphone, ListTodo, Check, Flag } from "lucide-react";
import { AgendaTarefasPanel, TarefaModal } from "./AgendaTarefasPanel";
import { api, useFetch, type Agendamento, type DisponibilidadeDia, type AgendaTarefa } from "../../lib/api";
import { useCards } from "../../lib/cards-store";
import { generateICS, downloadICS, googleCalendarUrl } from "../../lib/calendar-ics";
import { createMeetEvent, isMeetConfigured } from "../../lib/google-meet";
import type { AppUser } from "../../lib/auth";

// Vendedores que devem aparecer sempre no select, mesmo sem cards atribuídos.
const VENDEDORES_EXTRA = ["Alan Laperuda"];

// ── Helpers de data ──────────────────────────────────────────
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}
function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function formatRangeWeek(start: Date) {
  const end = addDays(start, 6);
  return `${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
}
function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Cor estável por vendedor — paleta brand SO Parket.
// Hash do nome escolhe deterministicamente uma das 8 variantes earthy.
// Mesma key → mesma cor sempre.
const VENDOR_PALETTE: { name: string; rgb: string; light: string }[] = [
  { name: "Olive",          rgb: "100,93,59",   light: "213,205,188" }, // Olive bg / Oat text
  { name: "Navy",           rgb: "69,87,99",    light: "232,226,218" }, // Navy bg / Sand text
  { name: "Walnut",         rgb: "96,84,77",    light: "235,229,220" }, // Walnut bg / WhiteChocolate text
  { name: "Shadow",         rgb: "134,131,101", light: "232,226,218" }, // Shadow bg / Sand text
  { name: "Chai",           rgb: "150,132,115", light: "235,229,220" }, // Chai bg / WhiteChocolate text
  { name: "MorningBlue",    rgb: "145,156,157", light: "5,5,5" },        // MorningBlue bg / Preto text
  { name: "Moss",           rgb: "49,51,31",    light: "213,205,188" }, // Moss bg / Oat text
  { name: "RaisinBlack",    rgb: "36,34,30",    light: "200,189,177" }, // RaisinBlack bg / Cream text
];

function corVendedor(nome: string): { bg: string; border: string; text: string } {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) | 0;
  const slot = VENDOR_PALETTE[Math.abs(h) % VENDOR_PALETTE.length];
  return {
    bg:     `rgba(${slot.rgb}, 0.35)`,           // fundo translúcido (legível em dark e light)
    border: `rgb(${slot.rgb})`,                  // borda sólida na cor brand
    // Texto usa var de tema (cream no dark, preto no light) — garante contraste em ambos.
    // Antes tinha cor fixa clara (Oat/Sand/Cream) que sumia no fundo bege do light mode.
    text:   `rgb(var(--hb-text))`,
  };
}

// ── Página principal ────────────────────────────────────────
export function AgendamentosPage({ appUser }: { appUser?: AppUser | null } = {}) {
  // Visibilidade — VENDEDOR puro só vê os próprios. SDR/admin/gestor vê TODOS
  // (SDR precisa coordenar agenda do time de vendas).
  const isVendedorPuro = appUser?.funcaoComercial === "vendedor" && !appUser?.isGestor && !appUser?.canSeeAll;
  const onlyMine = isVendedorPuro;
  const myName = (appUser?.nome || "").trim();
  const [view, setView] = useState<"dia" | "semana" | "mes">("semana");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [vendorFilter, setVendorFilter] = useState<string>(onlyMine ? myName : "");
  // Painel de tarefas pessoais (estilo Google Tasks) — visível por default,
  // toggle persiste em localStorage.
  const [tarefasOpen, setTarefasOpen] = useState<boolean>(
    () => localStorage.getItem("hb-tarefas-panel") !== "0"
  );
  useEffect(() => {
    try { localStorage.setItem("hb-tarefas-panel", tarefasOpen ? "1" : "0"); } catch {}
  }, [tarefasOpen]);

  // Tarefas — fetch no parent pra compartilhar com painel + grids (semana/mes).
  // RLS já filtra por user_id = auth.uid() (admin vê todas).
  const tarefasFetch = useFetch<AgendaTarefa[]>(() => api.tarefas(), []);
  const tarefas = tarefasFetch.data || [];
  const [editingTarefa, setEditingTarefa] = useState<AgendaTarefa | null>(null);
  const [showCreate, setShowCreate] = useState<{ data?: string; hora?: string } | null>(null);
  const [showDispo, setShowDispo] = useState<string | null>(null);
  const [editing, setEditing] = useState<Agendamento | null>(null);

  const range = useMemo(() => {
    if (view === "dia") {
      const d = ymd(anchor);
      return { de: d, ate: d };
    }
    if (view === "semana") {
      const start = startOfWeek(anchor);
      return { de: ymd(start), ate: ymd(addDays(start, 6)) };
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { de: ymd(start), ate: ymd(end) };
  }, [anchor, view]);

  const ags = useFetch(
    () => api.agendamentosNoRange(range.de, range.ate, vendorFilter || undefined),
    [range.de, range.ate, vendorFilter]
  );

  // Lista única de vendedores (filtros)
  const cardsStore = useCards();
  const vendedores = useMemo(() => {
    const set = new Set<string>();
    cardsStore.cards.forEach((c) => { if (c.responsavel) set.add(c.responsavel); });
    (ags.data || []).forEach((a) => set.add(a.vendedor));
    VENDEDORES_EXTRA.forEach((v) => set.add(v));
    return [...set].sort();
  }, [cardsStore.cards, ags.data]);

  return (
    <div className="flex flex-col h-screen bg-hb-bg text-hb-text">
      {/* Header */}
      <div className="border-b border-hb-border bg-hb-panel px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-hb-accent" />
          <h1 className="text-base font-bold uppercase tracking-wider">Agendamentos</h1>
          <span className="text-[10px] text-hb-textDim">{ags.data?.length || 0} eventos no período</span>
        </div>
        <div className="flex items-center gap-2">
          {!onlyMine && (
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="bg-hb-panelLight border border-hb-border rounded px-2 py-1 text-xs text-hb-text"
            >
              <option value="">Todos vendedores</option>
              {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {onlyMine && (
            <span className="text-[10px] uppercase text-hb-textDim px-2 py-1 border border-hb-border" style={{ letterSpacing: "0.12em" }}>
              Meus agendamentos
            </span>
          )}
          <button
            onClick={() => setShowDispo(vendorFilter || "")}
            className="text-xs px-3 py-1.5 rounded border border-hb-border hover:bg-hb-panelLight flex items-center gap-1.5"
          >
            <Settings size={12} /> Meus horários
          </button>
          {appUser && (
            <button
              onClick={() => setTarefasOpen((v) => !v)}
              title={tarefasOpen ? "Ocultar painel de tarefas" : "Mostrar painel de tarefas"}
              className={`text-xs px-3 py-1.5 rounded border flex items-center gap-1.5 transition ${
                tarefasOpen ? "bg-hb-accent/15 border-hb-accent/60 text-hb-accent" : "border-hb-border text-hb-textDim hover:text-hb-text hover:bg-hb-panelLight"
              }`}
            >
              <ListTodo size={12} /> Tarefas
            </button>
          )}
          <button
            onClick={() => setShowCreate({})}
            className="text-xs px-3 py-1.5 rounded bg-hb-accent text-hb-bg font-semibold hover:opacity-90 flex items-center gap-1.5"
          >
            <Plus size={12} /> Novo agendamento
          </button>
        </div>
      </div>

      {/* Banner — agendamentos sem especialista atribuído */}
      <UnassignedBanner ags={ags.data || []} />

      {/* Layout split: conteúdo principal (esquerda) + painel de tarefas (direita) */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">

      {/* Sub-header: navegação + view switch */}
      <div className="border-b border-hb-border px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnchor(
              view === "dia" ? addDays(anchor, -1)
              : view === "semana" ? addDays(anchor, -7)
              : addMonths(anchor, -1)
            )}
            className="p-1.5 rounded hover:bg-hb-panelLight"
          ><ChevronLeft size={14} /></button>
          <button
            onClick={() => setAnchor(new Date())}
            className="text-xs px-2 py-1 rounded border border-hb-border hover:bg-hb-panelLight"
          >Hoje</button>
          <button
            onClick={() => setAnchor(
              view === "dia" ? addDays(anchor, 1)
              : view === "semana" ? addDays(anchor, 7)
              : addMonths(anchor, 1)
            )}
            className="p-1.5 rounded hover:bg-hb-panelLight"
          ><ChevronRight size={14} /></button>
          <span className="text-sm font-semibold ml-2">
            {view === "dia"
              ? `${DIAS[anchor.getDay()]}, ${anchor.getDate()} de ${MESES[anchor.getMonth()].toLowerCase()} ${anchor.getFullYear()}`
              : view === "semana"
              ? formatRangeWeek(startOfWeek(anchor))
              : `${MESES[anchor.getMonth()]} ${anchor.getFullYear()}`}
          </span>
        </div>
        <div className="flex gap-1">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs px-3 py-1 rounded border ${
                view === v ? "bg-hb-accent text-hb-bg border-hb-accent" : "border-hb-border hover:bg-hb-panelLight"
              }`}
            >{v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}</button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto">
        {ags.loading ? (
          <div className="text-center py-16 text-hb-textDim text-xs">Carregando agendamentos…</div>
        ) : view === "dia" ? (
          <DiaGrid
            dia={anchor}
            ags={ags.data || []}
            tarefas={tarefas}
            onClickSlot={(d, h) => setShowCreate({ data: d, hora: h })}
            onClickEvent={(a) => setEditing(a)}
            onClickTarefa={(t) => setEditingTarefa(t)}
            onToggleTarefa={async (t) => {
              await api.toggleTarefa(t.id, t.status !== "feita");
              tarefasFetch.reload();
            }}
          />
        ) : view === "semana" ? (
          <SemanaGrid
            start={startOfWeek(anchor)}
            ags={ags.data || []}
            tarefas={tarefas}
            onClickSlot={(d, h) => setShowCreate({ data: d, hora: h })}
            onClickEvent={(a) => setEditing(a)}
            onClickTarefa={(t) => setEditingTarefa(t)}
            onToggleTarefa={async (t) => {
              await api.toggleTarefa(t.id, t.status !== "feita");
              tarefasFetch.reload();
            }}
          />
        ) : (
          <MesGrid
            anchor={anchor}
            ags={ags.data || []}
            tarefas={tarefas}
            onClickDay={(d) => { setAnchor(d); setView("dia"); }}
            onClickEvent={(a) => setEditing(a)}
            onClickTarefa={(t) => setEditingTarefa(t)}
          />
        )}

        {/* Lista de gestão de agendamentos por status */}
        <AgendamentosList ags={ags.data || []} onEdit={(a) => setEditing(a)} />
      </div>
        </div>

        {/* Painel lateral de tarefas (Google Tasks) — colapsável */}
        {appUser && tarefasOpen && (
          <div className="w-[320px] shrink-0">
            <AgendaTarefasPanel
              appUser={appUser}
              tarefas={tarefas}
              loading={tarefasFetch.loading}
              error={tarefasFetch.error}
              reload={tarefasFetch.reload}
              onEditTarefa={(t) => setEditingTarefa(t)}
              onClose={() => setTarefasOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Modal de edição de tarefa — compartilhado entre painel e grids do calendário */}
      {editingTarefa && appUser && (
        <TarefaModal
          appUser={appUser}
          tarefa={editingTarefa}
          onClose={() => setEditingTarefa(null)}
          onSaved={() => { setEditingTarefa(null); tarefasFetch.reload(); }}
        />
      )}

      {/* Modais */}
      {showCreate && (
        <CriarAgendamentoModal
          vendedores={vendedores}
          dataInit={showCreate.data}
          horaInit={showCreate.hora}
          onClose={() => setShowCreate(null)}
          onCreated={() => { setShowCreate(null); ags.reload(); }}
        />
      )}
      {editing && (
        <EditarAgendamentoModal
          ag={editing}
          vendedores={vendedores}
          onClose={() => setEditing(null)}
          onUpdated={() => { setEditing(null); ags.reload(); }}
        />
      )}
      {showDispo !== null && (
        <DisponibilidadeModal
          vendedores={vendedores}
          vendedorInit={showDispo}
          onClose={() => setShowDispo(null)}
        />
      )}
    </div>
  );
}

// ── Grid semanal ────────────────────────────────────────────
// ── Grid diário ─────────────────────────────────────────────
// Vista única do dia escolhido. Coluna larga, slots de 30min pra dar mais
// granularidade que a vista semanal (que usa 1h). Tarefas all-day no topo.
function DiaGrid({ dia, ags, tarefas, onClickSlot, onClickEvent, onClickTarefa, onToggleTarefa }: {
  dia: Date;
  ags: Agendamento[];
  tarefas: AgendaTarefa[];
  onClickSlot: (data: string, hora: string) => void;
  onClickEvent: (a: Agendamento) => void;
  onClickTarefa: (t: AgendaTarefa) => void;
  onToggleTarefa: (t: AgendaTarefa) => void;
}) {
  const data = ymd(dia);
  const isToday = data === ymd(new Date());
  // Slots de 30 min, 07:00 → 20:30
  const slots = Array.from({ length: 28 }, (_, i) => {
    const totalMin = 7 * 60 + i * 30;
    return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
  });

  const eventosDia = useMemo(
    () => ags.filter((a) => a.status !== "cancelado" && a.data === data),
    [ags, data]
  );
  const tarefasAllDay = useMemo(
    () => tarefas.filter((t) => t.data === data && !t.hora && t.status !== "cancelada"),
    [tarefas, data]
  );
  const tarefasComHora = useMemo(
    () => tarefas.filter((t) => t.data === data && !!t.hora && t.status !== "cancelada"),
    [tarefas, data]
  );

  return (
    <div className="flex flex-col">
      {/* Header do dia com tarefas all-day */}
      <div className={`px-6 py-3 border-b border-hb-border ${isToday ? "bg-hb-accent/10" : "bg-hb-panel"}`}>
        <div className="flex items-center gap-3">
          <div className={`text-3xl font-display ${isToday ? "text-hb-accent" : "text-hb-text"}`} style={{ letterSpacing: "0.08em", fontWeight: 500 }}>
            {dia.getDate()}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-hb-textDim">{DIAS[dia.getDay()]}</div>
            <div className="text-[11px] text-hb-textDim">{MESES[dia.getMonth()]} {dia.getFullYear()}{isToday ? " · Hoje" : ""}</div>
          </div>
        </div>
        {tarefasAllDay.length > 0 && (
          <div className="mt-2.5">
            <div className="text-[9px] uppercase text-hb-textDim mb-1" style={{ letterSpacing: "0.18em", fontWeight: 600 }}>
              Tarefas do dia inteiro
            </div>
            <div className="space-y-0.5 max-w-2xl">
              {tarefasAllDay.map((t) => (
                <TarefaChip key={t.id} tarefa={t} onClick={() => onClickTarefa(t)} onToggle={() => onToggleTarefa(t)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid de horários */}
      <div className="grid grid-cols-[80px_1fr]">
        {slots.map(({ h, m }) => {
          const slotHora = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const slotMin = h * 60 + m;
          const slotEnd = slotMin + 30;
          // Eventos que começam neste slot (intervalo de 30min)
          const eventos = eventosDia.filter((a) => {
            const s = timeToMin(a.hora_inicio);
            return s >= slotMin && s < slotEnd;
          });
          // Tarefas com hora exata neste slot
          const ts = tarefasComHora.filter((t) => {
            const s = timeToMin(t.hora || "00:00");
            return s >= slotMin && s < slotEnd;
          });
          const vazio = eventos.length === 0 && ts.length === 0;
          const inicioHora = m === 0;
          return (
            <div key={`${h}-${m}`} className="contents">
              <div className={`border-r border-b border-hb-border text-[10px] text-hb-textDim p-1 text-right ${inicioHora ? "tabular" : "opacity-50"}`}>
                {inicioHora ? slotHora : ""}
              </div>
              <div
                onClick={() => vazio && onClickSlot(data, slotHora)}
                className={`border-b border-hb-border min-h-[40px] p-1 ${vazio ? "cursor-pointer hover:bg-hb-panelLight/40" : ""} ${inicioHora ? "" : "border-b-hb-border/40"}`}
              >
                <div className="flex flex-col gap-0.5">
                  {eventos.map((a) => (
                    <EventoCard key={a.id} ag={a} onClick={() => onClickEvent(a)} />
                  ))}
                  {ts.map((t) => (
                    <TarefaChip key={t.id} tarefa={t} onClick={() => onClickTarefa(t)} onToggle={() => onToggleTarefa(t)} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SemanaGrid({ start, ags, tarefas, onClickSlot, onClickEvent, onClickTarefa, onToggleTarefa }: {
  start: Date;
  ags: Agendamento[];
  tarefas: AgendaTarefa[];
  onClickSlot: (data: string, hora: string) => void;
  onClickEvent: (a: Agendamento) => void;
  onClickTarefa: (t: AgendaTarefa) => void;
  onToggleTarefa: (t: AgendaTarefa) => void;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const horas = Array.from({ length: 14 }, (_, i) => 7 + i); // 07-20
  const agsPorDia = useMemo(() => {
    const m = new Map<string, Agendamento[]>();
    ags.filter((a) => a.status !== "cancelado").forEach((a) => {
      const lst = m.get(a.data) || [];
      lst.push(a);
      m.set(a.data, lst);
    });
    return m;
  }, [ags]);

  // Tarefas com data: agrupadas por dia. Tarefas com hora vão pro slot da hora,
  // tarefas sem hora aparecem no cabeçalho do dia (all-day).
  const tarefasPorDiaHora = useMemo(() => {
    const m = new Map<string, AgendaTarefa[]>();
    tarefas.filter((t) => t.data && t.status !== "cancelada").forEach((t) => {
      const key = t.hora ? `${t.data}:${t.hora.slice(0,2)}` : `${t.data}:all`;
      const lst = m.get(key) || [];
      lst.push(t);
      m.set(key, lst);
    });
    return m;
  }, [tarefas]);

  return (
    <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-hb-border">
      {/* Header dias */}
      <div className="bg-hb-panel border-r border-b border-hb-border" />
      {dias.map((d) => {
        const isToday = ymd(d) === ymd(new Date());
        const data = ymd(d);
        const tarefasAllDay = tarefasPorDiaHora.get(`${data}:all`) || [];
        return (
          <div key={d.toISOString()} className={`bg-hb-panel border-r border-b border-hb-border py-2 text-center ${isToday ? "bg-hb-accent/10" : ""}`}>
            <div className="text-[10px] uppercase tracking-wider text-hb-textDim">{DIAS[d.getDay()]}</div>
            <div className={`text-base font-bold ${isToday ? "text-hb-accent" : "text-hb-text"}`}>{d.getDate()}</div>
            {/* Tarefas sem hora (all-day) — aparecem no header do dia */}
            {tarefasAllDay.length > 0 && (
              <div className="px-1 mt-1 space-y-0.5">
                {tarefasAllDay.slice(0, 2).map((t) => (
                  <TarefaChip key={t.id} tarefa={t} onClick={() => onClickTarefa(t)} onToggle={() => onToggleTarefa(t)} />
                ))}
                {tarefasAllDay.length > 2 && (
                  <div className="text-[8px] text-hb-textDim text-left px-1">+{tarefasAllDay.length - 2}</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Linhas de horários */}
      {horas.map((h) => (
        <div key={h} className="contents">
          <div className="border-r border-b border-hb-border text-[10px] text-hb-textDim p-1 text-right">
            {String(h).padStart(2, "0")}:00
          </div>
          {dias.map((d) => {
            const data = ymd(d);
            const eventos = (agsPorDia.get(data) || []).filter((a) => {
              const m = timeToMin(a.hora_inicio);
              return m >= h * 60 && m < (h + 1) * 60;
            });
            const hh = String(h).padStart(2, "0");
            const tarefasHora = tarefasPorDiaHora.get(`${data}:${hh}`) || [];
            const vazio = eventos.length === 0 && tarefasHora.length === 0;
            return (
              <div
                key={data + h}
                onClick={() => vazio && onClickSlot(data, `${hh}:00`)}
                className={`border-r border-b border-hb-border min-h-[52px] p-0.5 relative ${vazio ? "cursor-pointer hover:bg-hb-panelLight/40" : ""}`}
              >
                {eventos.map((a) => (
                  <EventoCard key={a.id} ag={a} onClick={() => onClickEvent(a)} />
                ))}
                {tarefasHora.map((t) => (
                  <TarefaChip key={t.id} tarefa={t} onClick={() => onClickTarefa(t)} onToggle={() => onToggleTarefa(t)} />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function UnassignedBanner({ ags }: { ags: Agendamento[] }) {
  const pendentes = useMemo(() =>
    ags.filter((a) => a.status === "agendado" && (a.vendedor === "A definir" || !a.vendedor)),
  [ags]);
  if (pendentes.length === 0) return null;
  return (
    <div className="mx-6 mt-3 px-3 py-2 rounded border border-hb-amber/50 bg-hb-amber/10 text-hb-text text-xs flex items-center gap-2">
      <span className="text-base">⚠️</span>
      <span><b>{pendentes.length}</b> {pendentes.length === 1 ? "agendamento" : "agendamentos"} sem especialista atribuído. Clica num evento amarelo na agenda pra atribuir. Se passar 6h, alerta vai pro grupo Comercial.</span>
    </div>
  );
}

// Chip de tarefa no calendário — visualmente distinto dos agendamentos
// (cantos retos, fundo walnut, borda colorida pela prioridade, checkbox visível).
function TarefaChip({ tarefa, onClick, onToggle }: {
  tarefa: AgendaTarefa;
  onClick: () => void;
  onToggle: () => void;
}) {
  const feita = tarefa.status === "feita";
  const prioBorder = tarefa.prioridade === "alta" ? "rgb(var(--hb-red))" :         // hb-red (walnut clareado)
                     tarefa.prioridade === "baixa" ? "rgb(var(--hb-shadow))" :        // hb-shadow
                     "rgb(var(--hb-accent))";                                          // hb-accent (chai)
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={tarefa.titulo + (tarefa.descricao ? `\n${tarefa.descricao}` : "")}
      className={`text-[9px] px-1 py-0.5 mb-0.5 flex items-center gap-1 hover:brightness-125 transition border-l-2 cursor-pointer ${feita ? "line-through opacity-50" : ""}`}
      style={{ background: "rgb(var(--hb-walnut) / 0.20)", borderLeftColor: prioBorder, color: "rgb(var(--hb-text))" }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title={feita ? "Marcar como pendente" : "Marcar como concluída"}
        className={`w-3 h-3 border shrink-0 inline-flex items-center justify-center ${
          feita ? "bg-hb-green/30 border-hb-green text-hb-green" : "border-hb-cream/40 hover:border-hb-accent"
        }`}
        style={{ background: feita ? undefined : "transparent" }}
      >
        {feita && <Check size={7} />}
      </button>
      {tarefa.hora && <span className="tabular shrink-0">{tarefa.hora.slice(0, 5)}</span>}
      <span className="truncate flex-1 text-left">{tarefa.titulo}</span>
      {tarefa.prioridade === "alta" && !feita && <Flag size={8} className="shrink-0 text-hb-red" />}
    </div>
  );
}

function EventoCard({ ag, onClick }: { ag: Agendamento; onClick: () => void }) {
  const semEspecialista = ag.vendedor === "A definir" || !ag.vendedor;
  const c = corVendedor(ag.vendedor);
  // Sem especialista → destaque walnut/cream (paleta brand)
  const baseStyle = semEspecialista
    ? { background: "rgb(var(--hb-walnut) / 0.30)", borderColor: "rgb(var(--hb-walnut))", color: "rgb(var(--hb-text))" }
    : { background: c.bg, borderColor: c.border, color: c.text };
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={baseStyle}
      className={`text-[10px] rounded px-1.5 py-1 mb-0.5 cursor-pointer border-l-2 hover:brightness-125 transition ${semEspecialista ? "animate-pulse" : ""}`}
      title={semEspecialista ? "⚠️ Sem especialista atribuído — clica pra atribuir" : ""}
    >
      <div className="font-bold flex items-center gap-1">
        {ag.modalidade === "meet" ? <Video size={9} /> : <MapPin size={9} />}
        {ag.hora_inicio.slice(0, 5)}
        {semEspecialista && <span className="ml-auto">⚠️</span>}
      </div>
      <div className="truncate">{ag.cliente_nome || "Cliente"}</div>
      <div className="text-[9px] opacity-75 truncate">
        {semEspecialista ? "Sem especialista" : ag.vendedor}
      </div>
    </div>
  );
}

// ── Grid mensal ─────────────────────────────────────────────
function MesGrid({ anchor, ags, tarefas, onClickDay, onClickEvent, onClickTarefa }: {
  anchor: Date;
  ags: Agendamento[];
  tarefas: AgendaTarefa[];
  onClickDay: (d: Date) => void;
  onClickEvent: (a: Agendamento) => void;
  onClickTarefa: (t: AgendaTarefa) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startCell = addDays(first, -first.getDay());
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => addDays(startCell, i));
  const byDay = useMemo(() => {
    const m = new Map<string, Agendamento[]>();
    ags.filter((a) => a.status !== "cancelado").forEach((a) => {
      const lst = m.get(a.data) || [];
      lst.push(a);
      m.set(a.data, lst);
    });
    return m;
  }, [ags]);
  const tarefasPorDia = useMemo(() => {
    const m = new Map<string, AgendaTarefa[]>();
    tarefas.filter((t) => t.data && t.status !== "cancelada").forEach((t) => {
      const lst = m.get(t.data!) || [];
      lst.push(t);
      m.set(t.data!, lst);
    });
    return m;
  }, [tarefas]);
  const todayYmd = ymd(new Date());

  return (
    <div className="grid grid-cols-7 grid-rows-[auto_repeat(6,1fr)]">
      {DIAS.map((d) => (
        <div key={d} className="bg-hb-panel border-b border-r border-hb-border py-2 text-center text-[10px] uppercase tracking-wider text-hb-textDim">
          {d}
        </div>
      ))}
      {cells.map((d) => {
        const data = ymd(d);
        const isCurrentMonth = d.getMonth() === anchor.getMonth();
        const eventos = byDay.get(data) || [];
        const ts = tarefasPorDia.get(data) || [];
        const isToday = data === todayYmd;
        // Renderiza eventos primeiro, depois tarefas. Limita total a ~4 itens.
        const MAX = 4;
        const evShow = eventos.slice(0, MAX);
        const restoEv = Math.max(0, eventos.length - evShow.length);
        const slotsRestantes = Math.max(0, MAX - evShow.length);
        const tsShow = ts.slice(0, slotsRestantes);
        const restoTs = ts.length - tsShow.length;
        return (
          <div
            key={data}
            onClick={() => onClickDay(d)}
            className={`border-b border-r border-hb-border p-1 min-h-[100px] cursor-pointer hover:bg-hb-panelLight/30 ${
              !isCurrentMonth ? "opacity-40" : ""
            } ${isToday ? "bg-hb-accent/10" : ""}`}
          >
            <div className={`text-[11px] font-semibold mb-1 ${isToday ? "text-hb-accent" : ""}`}>{d.getDate()}</div>
            <div className="space-y-0.5">
              {evShow.map((a) => {
                const c = corVendedor(a.vendedor);
                return (
                  <div
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); onClickEvent(a); }}
                    style={{ background: c.bg, color: c.text }}
                    className="text-[9px] rounded px-1 py-0.5 truncate hover:brightness-125"
                  >
                    {a.hora_inicio.slice(0, 5)} {a.cliente_nome || a.vendedor}
                  </div>
                );
              })}
              {tsShow.map((t) => {
                const feita = t.status === "feita";
                const prioBorder = t.prioridade === "alta" ? "border-l-hb-red" :
                                   t.prioridade === "baixa" ? "border-l-hb-textDim" : "border-l-hb-accent";
                return (
                  <div
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); onClickTarefa(t); }}
                    title={t.titulo + (t.hora ? ` · ${t.hora.slice(0, 5)}` : "") + (t.descricao ? `\n${t.descricao}` : "")}
                    className={`text-[9px] px-1 py-0.5 truncate hover:brightness-125 border-l-2 ${prioBorder} bg-hb-walnut/15 text-hb-cream inline-flex items-center gap-1 w-full ${feita ? "line-through opacity-50" : ""}`}
                  >
                    <Check size={8} className="shrink-0 opacity-60" />
                    {t.hora && <span className="tabular shrink-0">{t.hora.slice(0, 5)}</span>}
                    <span className="truncate">{t.titulo}</span>
                  </div>
                );
              })}
              {(restoEv + restoTs) > 0 && (
                <div className="text-[9px] text-hb-textDim">+{restoEv + restoTs} mais</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Modal criar (FLUXO CALENDLY EM FASES) ───────────────────
function CriarAgendamentoModal({ vendedores, dataInit, horaInit, onClose, onCreated, cardIdInit, clienteInit, vendedorInit }: {
  vendedores: string[];
  dataInit?: string;
  horaInit?: string;
  cardIdInit?: string;
  clienteInit?: string;
  vendedorInit?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  // Lista completa de vendedores — se quem chamou passou poucos (ex: Sala Ao Vivo
  // só tinha o responsável atual), complementa com todos os responsáveis dos cards.
  const cardsStore = useCards();
  const vendedoresFull = useMemo(() => {
    const set = new Set<string>(vendedores.filter(Boolean));
    cardsStore.cards.forEach((c) => { if (c.responsavel) set.add(c.responsavel); });
    VENDEDORES_EXTRA.forEach((v) => set.add(v));
    return [...set].sort();
  }, [vendedores, cardsStore.cards]);

  // ─── Estado (uma única forma por fase) ─────────────────────
  const [step, setStep] = useState(1);
  const [vendedor, setVendedor] = useState(vendedorInit || "");
  const [duracao, setDuracao] = useState(60);
  const [modalidade, setModalidade] = useState<"presencial" | "meet">("meet");
  const [data, setData] = useState(dataInit || "");
  const [hora, setHora] = useState(horaInit || "");
  const [cliente, setCliente] = useState(clienteInit || "");
  const [meetLink, setMeetLink] = useState("");
  const [endereco, setEndereco] = useState("Casa Parket");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [criado, setCriado] = useState<Agendamento | null>(null);

  // SEMPRE começa na fase 1 (seleção de vendedor) — mesmo quando o Book/CardDetail
  // passa vendedorInit, ele só pré-seleciona o card; o user confirma clicando "Próximo".

  const horaFim = useMemo(() => hora ? minToTime(timeToMin(hora) + duracao) : "", [hora, duracao]);

  // Slots disponíveis do vendedor pra data escolhida
  const [slots, setSlots] = useState<string[]>([]);
  useEffect(() => {
    if (!vendedor || !data) { setSlots([]); return; }
    (async () => {
      // 1) Disponibilidade do vendedor (se cadastrada)
      const dispo = await api.disponibilidadeDoVendedor(vendedor);
      const dia = new Date(data + "T00:00:00").getDay();
      const dispoDia = dispo.find((d) => d.dia_semana === dia);
      const inicioMin = dispoDia ? timeToMin(dispoDia.hora_inicio.slice(0,5)) : 7 * 60;
      const fimMin = dispoDia ? timeToMin(dispoDia.hora_fim.slice(0,5)) : 20 * 60;
      // 2) Agendamentos já marcados no dia
      const ags = await api.agendamentosNoRange(data, data, vendedor);
      const ocupados = ags.filter((a) => a.status !== "cancelado").map((a) => ({
        inicio: timeToMin(a.hora_inicio.slice(0,5)),
        fim: timeToMin(a.hora_fim.slice(0,5)),
      }));
      // 3) Gera slots de `duracao` minutos
      const out: string[] = [];
      for (let m = inicioMin; m + duracao <= fimMin; m += 30) {
        const slotEnd = m + duracao;
        const conflita = ocupados.some((o) => !(slotEnd <= o.inicio || m >= o.fim));
        if (!conflita) out.push(minToTime(m));
      }
      setSlots(out);
    })().catch(() => setSlots([]));
  }, [vendedor, data, duracao]);

  // ─── Submit ────────────────────────────────────────────────
  const submit = async () => {
    if (!vendedor || !data || !hora) { setErr("Faltam dados"); return; }
    if (modalidade === "meet" && !meetLink.trim()) { setErr("Cole o link da reunião"); return; }
    if (modalidade === "presencial" && !endereco.trim()) { setErr("Informe o endereço"); return; }
    setBusy(true); setErr(null);
    try {
      const a = await api.criarAgendamento({
        card_id: cardIdInit || null,
        vendedor,
        cliente_nome: cliente || null,
        data,
        hora_inicio: hora + ":00",
        hora_fim: horaFim + ":00",
        modalidade,
        meet_link: modalidade === "meet" ? meetLink : null,
        endereco: modalidade === "presencial" ? endereco : null,
        status: "agendado",
        observacoes: obs || null,
        created_by: null,
      });
      setCriado(a);
      setStep(6);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally { setBusy(false); }
  };

  const canNext = () => {
    if (step === 1) return !!vendedor;
    if (step === 2) return !!modalidade && !!duracao;
    if (step === 3) return !!data;
    if (step === 4) return !!hora;
    if (step === 5) return (modalidade === "meet" ? meetLink.trim() : endereco.trim()).length > 0;
    return false;
  };

  return (
    <ModalShell title={criado ? "Agendamento confirmado" : `Nova reunião · passo ${step}/5`} onClose={onClose}>
      {/* Stepper */}
      {!criado && (
        <div className="flex items-center gap-1 mb-4">
          {[1,2,3,4,5].map((s) => (
            <div key={s} className={`flex-1 h-1 rounded ${s <= step ? "bg-hb-accent" : "bg-hb-border"}`} />
          ))}
        </div>
      )}

      {/* FASE 1: Vendedor */}
      {step === 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2"><User size={14} className="text-hb-accent" /> Quem vai atender?</h3>
          <p className="text-[11px] text-hb-textDim">Selecione o vendedor responsável pela reunião.</p>
          <div className="space-y-1.5 max-h-72 overflow-auto">
            {vendedoresFull.length === 0 && (
              <div className="text-[11px] text-hb-textDim p-3 border border-dashed border-hb-border rounded text-center">
                Nenhum vendedor disponível. Volte ao card e atribua um responsável.
              </div>
            )}
            {vendedoresFull.map((v) => {
              const c = corVendedor(v);
              return (
                <button
                  key={v}
                  onClick={() => setVendedor(v)}
                  className={`w-full p-3 rounded border text-left flex items-center gap-3 transition ${
                    vendedor === v ? "bg-hb-accent/15 border-hb-accent" : "border-hb-border hover:bg-hb-panelLight"
                  }`}
                >
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: c.bg, color: c.text }}>
                    {v.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold flex-1">{v}</span>
                  {vendedor === v && <span className="text-hb-accent text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FASE 2: Tipo de reunião */}
      {step === 2 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2"><Video size={14} className="text-hb-accent" /> Tipo de reunião</h3>
          <p className="text-[11px] text-hb-textDim">Como vai acontecer e por quanto tempo.</p>

          <div className="grid grid-cols-2 gap-2">
            {(["meet", "presencial"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModalidade(m)}
                className={`p-4 rounded border flex flex-col items-center gap-2 transition ${
                  modalidade === m ? "bg-hb-accent/15 border-hb-accent" : "border-hb-border hover:bg-hb-panelLight"
                }`}
              >
                {m === "meet" ? <Video size={20} /> : <MapPin size={20} />}
                <span className="text-xs font-semibold">{m === "meet" ? "Online (Meet/Zoom)" : "Presencial"}</span>
                <span className="text-[10px] text-hb-textDim text-center">{m === "meet" ? "Link compartilhado por você" : "Endereço físico"}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-hb-textDim font-semibold mb-1.5 block">Duração</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[30, 45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  onClick={() => setDuracao(m)}
                  className={`py-2 text-xs rounded border ${
                    duracao === m ? "bg-hb-accent/15 border-hb-accent text-hb-text font-semibold" : "border-hb-border hover:bg-hb-panelLight text-hb-textDim"
                  }`}
                >
                  {m < 60 ? `${m}min` : m === 60 ? "1h" : `${Math.floor(m/60)}h${m%60 ? m%60 : ""}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FASE 3: Data (mini calendário) */}
      {step === 3 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2"><Calendar size={14} className="text-hb-accent" /> Que dia?</h3>
          <p className="text-[11px] text-hb-textDim">Disponibilidade de <strong>{vendedor}</strong> nas próximas semanas.</p>
          <MiniCalendar value={data} onChange={setData} vendedor={vendedor} />
        </div>
      )}

      {/* FASE 4: Horário (slots disponíveis) */}
      {step === 4 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2"><Clock size={14} className="text-hb-accent" /> Que horas?</h3>
          <p className="text-[11px] text-hb-textDim">
            <strong>{vendedor}</strong> · {new Date(data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {duracao} min
          </p>
          {slots.length === 0 ? (
            <div className="text-[11px] text-hb-textDim p-4 border border-dashed border-hb-border rounded text-center">
              Sem horários disponíveis nesse dia. Tente outra data ou ajuste sua disponibilidade em "Meus horários".
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-72 overflow-auto">
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => setHora(s)}
                  className={`py-2.5 text-xs rounded border font-semibold tabular ${
                    hora === s ? "bg-hb-accent text-hb-bg border-hb-accent" : "border-hb-border hover:bg-hb-panelLight"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {hora && (
            <div className="text-[11px] text-hb-text bg-hb-accent/10 border border-hb-accent/40 rounded px-2 py-1.5">
              ✓ Selecionado: <strong>{hora}</strong> – {horaFim}
            </div>
          )}
        </div>
      )}

      {/* FASE 5: Detalhes */}
      {step === 5 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2"><MessageSquareSafe /> Detalhes finais</h3>
          <div className="text-[11px] text-hb-textDim p-2 bg-hb-panelLight rounded border border-hb-border">
            <div className="flex items-center gap-1.5"><User size={11} /> {vendedor}</div>
            <div className="flex items-center gap-1.5"><Clock size={11} /> {new Date(data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {hora} – {horaFim}</div>
            <div className="flex items-center gap-1.5">
              {modalidade === "meet" ? <Video size={11} /> : <MapPin size={11} />} {modalidade === "meet" ? "Online" : "Presencial"}
            </div>
          </div>

          <Field label="Cliente">
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" className={INPUT} />
          </Field>

          {modalidade === "meet" ? (
            <Field label="Link da reunião">
              <MeetLinkField
                meetLink={meetLink}
                setMeetLink={setMeetLink}
                cliente={cliente}
                vendedor={vendedor}
                data={data}
                hora={hora}
                horaFim={horaFim}
                obs={obs}
              />
            </Field>
          ) : (
            <Field label="Endereço">
              <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço completo" className={INPUT} />
            </Field>
          )}

          <Field label="Observações (opcional)">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={INPUT} placeholder="Pauta, contexto, anexos…" />
          </Field>

          {err && <div className="text-xs text-hb-red bg-hb-red/10 border border-hb-red/30 rounded px-2 py-1.5">{err}</div>}
        </div>
      )}

      {/* FASE 6: Confirmação */}
      {step === 6 && criado && (
        <div className="space-y-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-hb-green/20 border-2 border-hb-green flex items-center justify-center">
            <span className="text-hb-green text-2xl">✓</span>
          </div>
          <h3 className="text-base font-bold">Reunião confirmada!</h3>
          <div className="text-xs text-hb-text bg-hb-panelLight rounded p-3 border border-hb-border space-y-1 text-left">
            <div><strong>{cliente || "Cliente"}</strong> com <strong>{vendedor}</strong></div>
            <div>{new Date(criado.data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
            <div>{criado.hora_inicio.slice(0,5)} – {criado.hora_fim.slice(0,5)} · {modalidade === "meet" ? "Online" : "Presencial"}</div>
            {modalidade === "meet" && <div className="text-hb-accent text-[11px] truncate">🔗 {meetLink}</div>}
            {modalidade === "presencial" && <div className="text-[11px]">📍 {endereco}</div>}
          </div>

          <div className="border border-hb-accent/40 bg-hb-accent/5 rounded p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-hb-accent flex items-center justify-center gap-1">
              <Smartphone size={11} /> Adicionar à sua agenda
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const ics = generateICS(criado);
                  const safeName = (criado.cliente_nome || criado.vendedor).replace(/[^a-zA-Z0-9]+/g, "_");
                  downloadICS(ics, `reuniao-${safeName}-${criado.data}.ics`);
                }}
                className="flex-1 text-xs py-2 rounded bg-hb-accent text-hb-bg font-semibold flex items-center justify-center gap-1.5"
              >
                <Download size={12} /> Baixar .ics
              </button>
              <button
                onClick={() => window.open(googleCalendarUrl(criado), "_blank")}
                className="flex-1 text-xs py-2 rounded border border-hb-border hover:bg-hb-panelLight flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={12} /> Google Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botões de navegação */}
      <div className="flex gap-2 justify-between pt-4 mt-4 border-t border-hb-border">
        {criado ? (
          <button
            onClick={() => { onCreated(criado.id); onClose(); }}
            className="ml-auto text-xs px-5 py-2 rounded bg-hb-accent text-hb-bg font-semibold"
          >
            Fechar
          </button>
        ) : (
          <>
            <button
              onClick={() => step === 1 ? onClose() : setStep((s) => s - 1)}
              className="text-xs px-4 py-2 rounded border border-hb-border hover:bg-hb-panelLight"
            >
              {step === 1 ? "Cancelar" : "← Voltar"}
            </button>
            {step < 5 ? (
              <button
                onClick={() => canNext() && setStep((s) => s + 1)}
                disabled={!canNext()}
                className="text-xs px-5 py-2 rounded bg-hb-accent text-hb-bg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próximo →
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={busy || !canNext()}
                className="text-xs px-5 py-2 rounded bg-hb-accent text-hb-bg font-semibold disabled:opacity-40"
              >
                {busy ? "Criando…" : "✓ Confirmar"}
              </button>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}

// MessageSquare sem o ícone real (já tem 1 import só); placeholder pra fase 5
function MessageSquareSafe() {
  return <span className="text-hb-accent">💬</span>;
}

// ── Campo de Link Meet ────────────────────────────────────────
// Se VITE_GOOGLE_CLIENT_ID está setado: botão "🎥 Gerar Meet" cria a sala
// automaticamente via OAuth + Calendar API (popup login só na 1ª vez).
// Senão: fallback pro fluxo manual (abre meet.google.com/new + colar).
function MeetLinkField({
  meetLink, setMeetLink, cliente, vendedor, data, hora, horaFim, obs,
}: {
  meetLink: string;
  setMeetLink: (v: string) => void;
  cliente: string;
  vendedor: string;
  data: string;
  hora: string;
  horaFim: string;
  obs: string;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const oauthOk = isMeetConfigured();

  const gerarAutomatico = async () => {
    if (!data || !hora || !horaFim) { setErro("Selecione data e horário antes"); return; }
    setGerando(true); setErro(null);
    try {
      const titulo = cliente ? `Reunião Parket · ${cliente}` : `Reunião Parket${vendedor ? ` · ${vendedor}` : ""}`;
      const res = await createMeetEvent({
        titulo,
        descricao: obs || `Reunião agendada via Homebroker Parket${vendedor ? ` (${vendedor})` : ""}.`,
        inicio: `${data}T${hora}:00`,
        fim: `${data}T${horaFim}:00`,
      });
      setMeetLink(res.meetLink);
    } catch (e: any) {
      setErro(e?.message || "Falha ao gerar Meet");
    } finally { setGerando(false); }
  };

  const gerarManual = () => {
    window.open("https://meet.google.com/new", "_blank", "noopener");
    setTimeout(async () => {
      try {
        const txt = await navigator.clipboard.readText();
        const m = txt.match(/https?:\/\/meet\.google\.com\/[a-z0-9-]+/i);
        if (m && !meetLink) setMeetLink(m[0]);
      } catch {}
    }, 3000);
  };

  const colar = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const m = txt.match(/https?:\/\/meet\.google\.com\/[a-z0-9-]+/i);
      if (m) setMeetLink(m[0]);
      else alert("Nenhum link Meet no clipboard. Copie o link do Meet primeiro.");
    } catch {
      alert("Browser bloqueou leitura do clipboard. Cole manualmente.");
    }
  };

  return (
    <>
      <div className="flex gap-1">
        <input value={meetLink} onChange={(e) => setMeetLink(e.target.value)}
          placeholder="https://meet.google.com/xxx-yyyy-zzz" className={INPUT + " flex-1"} />
        {oauthOk ? (
          <button type="button" onClick={gerarAutomatico} disabled={gerando}
            className="text-[10px] px-2 py-1 rounded bg-hb-accent text-hb-bg font-semibold uppercase tracking-[0.10em] whitespace-nowrap disabled:opacity-50"
            title="Cria a sala Meet automaticamente na sua conta Google">
            {gerando ? "Gerando…" : "🎥 Gerar Meet"}
          </button>
        ) : (
          <>
            <button type="button" onClick={gerarManual}
              className="text-[10px] px-2 py-1 rounded border border-hb-accent/60 text-hb-accent hover:bg-hb-accent/10 font-semibold uppercase tracking-[0.10em] whitespace-nowrap"
              title="Abre Google Meet em nova aba — crie a sala e cole o link">
              🎥 Gerar
            </button>
            <button type="button" onClick={colar}
              className="text-[10px] px-2 py-1 rounded border border-hb-border text-hb-textDim hover:text-hb-text whitespace-nowrap"
              title="Pega link do clipboard">
              📋 Colar
            </button>
          </>
        )}
      </div>
      {erro && <div className="text-[10px] text-hb-red mt-1">{erro}</div>}
      {oauthOk ? (
        <div className="text-[10px] text-hb-textDim mt-1">
          Clique <b>🎥 Gerar Meet</b> — login Google na 1ª vez, depois cria a sala em 1 click.
        </div>
      ) : (
        <div className="text-[10px] text-hb-textDim mt-1">
          Clique <b>🎥 Gerar</b> → Meet abre em nova aba → copie o link → volte e clique <b>📋 Colar</b>.
        </div>
      )}
    </>
  );
}

// ── Mini calendário pra fase 3 ──────────────────────────────
function MiniCalendar({ value, onChange, vendedor }: { value: string; onChange: (data: string) => void; vendedor: string }) {
  const [mes, setMes] = useState(() => {
    const d = value ? new Date(value + "T00:00:00") : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const first = mes;
  const startCell = addDays(first, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(startCell, i));
  const todayYmd = ymd(new Date());

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setMes(addMonths(mes, -1))} className="p-1 hover:bg-hb-panelLight rounded"><ChevronLeft size={14} /></button>
        <div className="text-sm font-semibold">{MESES[mes.getMonth()]} {mes.getFullYear()}</div>
        <button onClick={() => setMes(addMonths(mes, 1))} className="p-1 hover:bg-hb-panelLight rounded"><ChevronRight size={14} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-hb-textDim uppercase tracking-wider mb-1">
        {DIAS.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const data = ymd(d);
          const noMes = d.getMonth() === mes.getMonth();
          const passou = data < todayYmd;
          const selecionado = data === value;
          const ehHoje = data === todayYmd;
          return (
            <button
              key={data}
              onClick={() => !passou && onChange(data)}
              disabled={passou || !noMes}
              className={`aspect-square text-xs rounded transition ${
                selecionado ? "bg-hb-accent text-hb-bg font-bold" :
                ehHoje ? "border border-hb-accent text-hb-accent font-bold" :
                passou ? "text-hb-textDim opacity-30 cursor-not-allowed" :
                !noMes ? "opacity-25" :
                "hover:bg-hb-panelLight"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal editar ─────────────────────────────────────────────
function EditarAgendamentoModal({ ag, vendedores, onClose, onUpdated }: { ag: Agendamento; vendedores: string[]; onClose: () => void; onUpdated: () => void }) {
  const [vendedor, setVendedor] = useState(ag.vendedor);
  const [data, setData] = useState(ag.data);
  const [hi, setHi] = useState((ag.hora_inicio || "").slice(0, 5));
  const [hf, setHf] = useState((ag.hora_fim || "").slice(0, 5));
  const [modalidade, setModalidade] = useState<"meet" | "presencial">(ag.modalidade as any);
  const [status, setStatus] = useState(ag.status);
  const [obs, setObs] = useState(ag.observacoes || "");
  const [meetLink, setMeetLink] = useState(ag.meet_link || "");
  const [endereco, setEndereco] = useState(ag.endereco || "");
  const [busy, setBusy] = useState(false);

  // Lista de vendedores pro select — inclui o vendedor atual mesmo se não estiver na lista
  const vendOpts = useMemo(() => {
    const set = new Set(vendedores);
    if (vendedor) set.add(vendedor);
    return [...set].sort();
  }, [vendedores, vendedor]);

  const salvar = async () => {
    setBusy(true);
    try {
      const vendedorMudou = vendedor !== ag.vendedor;
      const novoVendedorReal = vendedor && vendedor !== "A definir";
      // Atualiza tudo MENOS vendedor (vendedor vai pelo endpoint dedicado que notifica)
      await api.atualizarAgendamento(ag.id, {
        ...(vendedorMudou && !novoVendedorReal ? { vendedor } : {}),
        data,
        hora_inicio: `${hi}:00`,
        hora_fim: `${hf}:00`,
        modalidade,
        status,
        observacoes: obs || null,
        meet_link: modalidade === "meet" ? meetLink : null,
        endereco: modalidade === "presencial" ? endereco : null,
      });
      // Se vendedor foi atribuído/trocado pra alguém real → endpoint dispara WhatsApp
      if (vendedorMudou && novoVendedorReal) {
        try {
          const r = await fetch(`https://agente.parket.works/api/teca/agendamentos/${ag.id}/atribuir`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendedor }),
          });
          if (!r.ok) {
            console.warn("[atribuir]", await r.text());
          }
        } catch (e) {
          console.warn("[atribuir] erro:", e);
        }
      }
      onUpdated();
    } finally { setBusy(false); }
  };
  const cancelar = async () => {
    if (!confirm("Cancelar este agendamento?")) return;
    setBusy(true);
    try { await api.cancelarAgendamento(ag.id); onUpdated(); }
    finally { setBusy(false); }
  };

  const dataFmt = new Date(ag.data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  const liveAg = {
    ...ag,
    vendedor, data,
    hora_inicio: `${hi}:00`, hora_fim: `${hf}:00`,
    modalidade, observacoes: obs, meet_link: meetLink, endereco,
  } as Agendamento;
  const adicionarNaAgenda = () => {
    const ics = generateICS(liveAg);
    const safeName = (ag.cliente_nome || vendedor).replace(/[^a-zA-Z0-9]+/g, "_");
    downloadICS(ics, `reuniao-${safeName}-${data}.ics`);
  };
  const abrirGoogleCalendar = () => {
    window.open(googleCalendarUrl(liveAg), "_blank");
  };

  return (
    <ModalShell title="Editar agendamento" onClose={onClose}>
      <div className="space-y-3">
        <div className="text-xs text-hb-textDim space-y-1">
          {ag.cliente_nome && <div className="text-hb-text font-medium">{ag.cliente_nome}</div>}
          {ag.card_id && <Link to={`/card/${ag.card_id}`} className="text-hb-accent hover:underline flex items-center gap-1 text-[11px]"><ExternalLink size={10} /> Abrir card</Link>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Vendedor / Consultor(a)">
            <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className={INPUT}>
              {vendOpts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Modalidade">
            <select value={modalidade} onChange={(e) => setModalidade(e.target.value as any)} className={INPUT}>
              <option value="meet">Meet</option>
              <option value="presencial">Presencial</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Data">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Início">
            <input type="time" value={hi} onChange={(e) => setHi(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Fim">
            <input type="time" value={hf} onChange={(e) => setHf(e.target.value)} className={INPUT} />
          </Field>
        </div>

        {/* Adicionar à agenda do celular */}
        <div className="border border-hb-accent/40 bg-hb-accent/5 rounded p-2.5 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-hb-accent flex items-center gap-1">
            <Smartphone size={11} /> Adicionar à agenda
          </div>
          <div className="flex gap-2">
            <button
              onClick={adicionarNaAgenda}
              className="flex-1 text-[11px] py-1.5 rounded border border-hb-border bg-hb-panelLight hover:bg-hb-accent/20 flex items-center justify-center gap-1.5"
              title="Baixa arquivo .ics — funciona em qualquer celular (iOS, Android)"
            >
              <Download size={11} /> Celular / .ics
            </button>
            <button
              onClick={abrirGoogleCalendar}
              className="flex-1 text-[11px] py-1.5 rounded border border-hb-border bg-hb-panelLight hover:bg-hb-accent/20 flex items-center justify-center gap-1.5"
              title="Abre direto no Google Calendar"
            >
              <ExternalLink size={11} /> Google Calendar
            </button>
          </div>
        </div>

        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={INPUT}>
            <option value="agendado">Agendado</option>
            <option value="realizado">Realizado</option>
            <option value="reagendado">Reagendado</option>
            <option value="cancelado">Cancelado</option>
            <option value="no-show">No-show</option>
          </select>
        </Field>

        {ag.modalidade === "meet" ? (
          <Field label="Link da reunião">
            <input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} className={INPUT} />
          </Field>
        ) : (
          <Field label="Endereço">
            <input value={endereco} onChange={(e) => setEndereco(e.target.value)} className={INPUT} />
          </Field>
        )}

        <Field label="Observações">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className={INPUT} />
        </Field>

        <div className="flex gap-2 justify-between pt-2 border-t border-hb-border">
          <button onClick={cancelar} disabled={busy} className="text-xs px-3 py-2 rounded border border-hb-red/40 text-hb-red hover:bg-hb-red/10 flex items-center gap-1.5"><Trash2 size={11} /> Cancelar agendamento</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs px-4 py-2 rounded border border-hb-border hover:bg-hb-panelLight">Fechar</button>
            <button onClick={salvar} disabled={busy} className="text-xs px-4 py-2 rounded bg-hb-accent text-hb-bg font-semibold hover:opacity-90">{busy ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Modal disponibilidade ────────────────────────────────────
function DisponibilidadeModal({ vendedores, vendedorInit, onClose }: { vendedores: string[]; vendedorInit: string; onClose: () => void }) {
  const [vendedor, setVendedor] = useState(vendedorInit || vendedores[0] || "");
  const [slots, setSlots] = useState<DisponibilidadeDia[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!vendedor) return;
    setLoading(true);
    api.disponibilidadeDoVendedor(vendedor).then(setSlots).finally(() => setLoading(false));
  }, [vendedor]);

  const updateSlot = (dia: number, campo: "hora_inicio" | "hora_fim", val: string) => {
    setSlots((cur) => {
      const idx = cur.findIndex((s) => s.dia_semana === dia);
      if (idx >= 0) {
        const n = [...cur];
        n[idx] = { ...n[idx], [campo]: val };
        return n;
      }
      return [...cur, { vendedor, dia_semana: dia, hora_inicio: campo === "hora_inicio" ? val : "08:00", hora_fim: campo === "hora_fim" ? val : "18:00", updated_at: "" }];
    });
  };
  const toggleDia = (dia: number) => {
    setSlots((cur) => {
      const idx = cur.findIndex((s) => s.dia_semana === dia);
      if (idx >= 0) return cur.filter((s) => s.dia_semana !== dia);
      return [...cur, { vendedor, dia_semana: dia, hora_inicio: "08:00", hora_fim: "18:00", updated_at: "" }];
    });
  };
  const salvar = async () => {
    setBusy(true);
    try {
      await api.setDisponibilidade(vendedor, slots.map((s) => ({ dia_semana: s.dia_semana, hora_inicio: s.hora_inicio, hora_fim: s.hora_fim })));
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <ModalShell title="Meus horários de trabalho" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Vendedor">
          <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className={INPUT}>
            <option value="">— selecionar —</option>
            {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <div className="text-[10px] text-hb-textDim">Marque os dias e horários disponíveis pra reuniões. Sem nada marcado = qualquer horário 07h-20h.</div>
        {loading ? <div className="text-center text-xs text-hb-textDim py-4">Carregando…</div> : (
          <div className="space-y-1.5">
            {DIAS.map((d, i) => {
              const slot = slots.find((s) => s.dia_semana === i);
              return (
                <div key={i} className="flex items-center gap-2 p-2 rounded border border-hb-border">
                  <input type="checkbox" checked={!!slot} onChange={() => toggleDia(i)} className="cursor-pointer" />
                  <div className="text-xs font-semibold w-12">{d}</div>
                  {slot ? (
                    <>
                      <input type="time" value={slot.hora_inicio.slice(0,5)} onChange={(e) => updateSlot(i, "hora_inicio", e.target.value)} className={`${INPUT} w-24`} />
                      <span className="text-hb-textDim text-xs">até</span>
                      <input type="time" value={slot.hora_fim.slice(0,5)} onChange={(e) => updateSlot(i, "hora_fim", e.target.value)} className={`${INPUT} w-24`} />
                    </>
                  ) : (
                    <div className="text-xs text-hb-textDim">— folga —</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2 justify-end pt-2 border-t border-hb-border">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded border border-hb-border hover:bg-hb-panelLight">Cancelar</button>
          <button onClick={salvar} disabled={busy || !vendedor} className="text-xs px-4 py-2 rounded bg-hb-accent text-hb-bg font-semibold disabled:opacity-50">{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Helpers UI ───────────────────────────────────────────────
const INPUT = "w-full bg-hb-panelLight border border-hb-border rounded px-2 py-1.5 text-xs text-hb-text focus:outline-none focus:border-hb-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-hb-textDim font-semibold mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-hb-panel border border-hb-border rounded-lg w-full max-w-md max-h-[90vh] overflow-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-hb-border">
          <h2 className="text-sm font-bold uppercase tracking-wider">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-hb-panelLight rounded"><X size={14} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// Export do modal de criar pra reuso no Book/CardDetail
export { CriarAgendamentoModal };

// ── Lista de gestão de agendamentos por status ─────────────────────────
const STATUS_TABS: Array<{ key: Agendamento["status"]; label: string; color: string }> = [
  { key: "agendado",   label: "Agendados",  color: "bg-hb-blue" },
  { key: "realizado",  label: "Realizados", color: "bg-hb-green" },
  { key: "reagendado", label: "Reagendados", color: "bg-hb-amber" },
  { key: "no-show",    label: "No-show",    color: "bg-hb-red" },
  { key: "cancelado",  label: "Cancelados", color: "bg-hb-textDim" },
];

function AgendamentosList({ ags, onEdit }: { ags: Agendamento[]; onEdit: (a: Agendamento) => void }) {
  const [tab, setTab] = useState<Agendamento["status"]>("agendado");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of ags) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [ags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ags
      .filter((a) => a.status === tab)
      .filter((a) => !q || (a.cliente_nome || "").toLowerCase().includes(q) || (a.vendedor || "").toLowerCase().includes(q))
      .sort((a, b) => {
        const k = (x: Agendamento) => `${x.data} ${x.hora_inicio}`;
        return tab === "agendado" ? k(a).localeCompare(k(b)) : k(b).localeCompare(k(a));
      });
  }, [ags, tab, search]);

  return (
    <div className="border-t border-hb-border mt-2">
      <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 border ${
                tab === t.key
                  ? "bg-hb-accent text-hb-bg border-hb-accent"
                  : "border-hb-border hover:bg-hb-panelLight text-hb-text"
              }`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${t.color}`} />
              {t.label}
              <span className={`ml-1 text-[10px] font-bold ${tab === t.key ? "opacity-80" : "text-hb-textDim"}`}>
                {counts[t.key] || 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-hb-textDim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente ou vendedor..."
            className="text-xs pl-7 pr-2 py-1.5 rounded border border-hb-border bg-hb-panelLight w-56"
          />
        </div>
      </div>

      <div className="px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-hb-textDim text-xs">
            Nenhum agendamento {STATUS_TABS.find((t) => t.key === tab)?.label.toLowerCase()}.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-hb-textDim border-b border-hb-border">
              <tr>
                <th className="text-left py-2 px-2 font-semibold">Data</th>
                <th className="text-left py-2 px-2 font-semibold">Hora</th>
                <th className="text-left py-2 px-2 font-semibold">Cliente</th>
                <th className="text-left py-2 px-2 font-semibold">Vendedor</th>
                <th className="text-left py-2 px-2 font-semibold">Modalidade</th>
                <th className="text-left py-2 px-2 font-semibold">Card</th>
                <th className="text-right py-2 px-2 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const [yy, mm, dd] = a.data.split("-");
                const dataFmt = `${dd}/${mm}/${yy}`;
                const horaFmt = `${a.hora_inicio.slice(0, 5)}–${a.hora_fim.slice(0, 5)}`;
                return (
                  <tr key={a.id} className="border-b border-hb-border/40 hover:bg-hb-panelLight">
                    <td className="py-2 px-2">{dataFmt}</td>
                    <td className="py-2 px-2 font-mono">{horaFmt}</td>
                    <td className="py-2 px-2 font-medium">{a.cliente_nome || "—"}</td>
                    <td className="py-2 px-2 text-hb-textDim">{a.vendedor || "—"}</td>
                    <td className="py-2 px-2">
                      <span className="inline-flex items-center gap-1 text-hb-textDim">
                        {a.modalidade === "meet" ? <Video size={11} /> : <MapPin size={11} />}
                        {a.modalidade === "meet" ? "Meet" : "Presencial"}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      {a.card_id ? (
                        <Link to={`/cards/${a.card_id}`} className="text-hb-accent hover:underline inline-flex items-center gap-1">
                          Abrir <ExternalLink size={10} />
                        </Link>
                      ) : (
                        <span className="text-hb-textDim">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => onEdit(a)} className="text-xs px-2 py-1 rounded border border-hb-border hover:bg-hb-panel">
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
