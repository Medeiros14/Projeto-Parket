/**
 * Calendario — grid mensal com aniversariantes (derivados de
 * rh.colaboradores.data_nascimento) + avisos (rh.avisos).
 *
 * Click no dia abre painel lateral com a lista detalhada.
 * Botão "+ Novo aviso" abre modal de cadastro.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Cake, X, Trash2, Bell, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { supabase } from "@/lib/supabase";

type TipoAviso = "aviso" | "feriado" | "reuniao" | "evento";

interface Aviso {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;     // 'YYYY-MM-DD'
  data_fim: string | null;
  tipo: TipoAviso;
  cor: string;
}

interface Aniversariante {
  id: string;
  nome: string;
  data_nascimento: string; // 'YYYY-MM-DD'
}

const TIPO_LABEL: Record<TipoAviso, string> = {
  aviso: "Aviso",
  feriado: "Feriado",
  reuniao: "Reunião",
  evento: "Evento",
};
const TIPO_COR: Record<TipoAviso, string> = {
  aviso: "#3B82F6",      // azul
  feriado: "#EF4444",    // vermelho
  reuniao: "#A855F7",    // roxo
  evento: "#10B981",     // verde
};

const MES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEM = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Formata 'YYYY-MM-DD' do componente Y/M/D pra evitar timezone do JS. */
function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "MM-DD" do nascimento — usado pra match independente do ano. */
function mmdd(date: string): string {
  return date.slice(5, 10);
}

/** Constrói o grid 6×7 (Mon-Sun) cobrindo o mês + dias adjacentes pra preencher. */
function buildGrid(year: number, month: number) {
  // 1º dia do mês — getDay() devolve 0=Dom; convertemos pra 0=Seg
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const startDate = new Date(year, month, 1 - offset);

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  return cells;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function CalendarioPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [proximosAvisos, setProximosAvisos] = useState<Aviso[]>([]);
  const [aniv, setAniv] = useState<Aniversariante[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hideTypes, setHideTypes] = useState<Set<TipoAviso | "aniv">>(new Set());

  const toggleType = (t: TipoAviso | "aniv") => {
    setHideTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  // ── Carrega aniversariantes (todos colaboradores ativos com nascimento) ──
  useEffect(() => {
    let alive = true;
    supabase
      .from("colaboradores")
      .select("id,nome,data_nascimento")
      .not("data_nascimento", "is", null)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error("[Calendario] aniv:", error);
        setAniv((data || []) as Aniversariante[]);
      });
    return () => { alive = false; };
  }, []);

  // ── Carrega avisos da próxima janela (próximos 30 dias) pro painel
  // "Próximos 7 dias" funcionar independente do mês visualizado ──
  useEffect(() => {
    let alive = true;
    const t = new Date();
    const start = ymd(t.getFullYear(), t.getMonth(), t.getDate());
    const end30 = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 30);
    const endStr = ymd(end30.getFullYear(), end30.getMonth(), end30.getDate());
    supabase
      .from("avisos")
      .select("*")
      .gte("data_inicio", start)
      .lte("data_inicio", endStr)
      .order("data_inicio", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { console.error("[Calendario] prox:", error); return; }
        setProximosAvisos((data || []) as Aviso[]);
      });
    return () => { alive = false; };
  }, []);

  // ── Carrega avisos do mês visível (range com tolerância de 1 mês) ──
  useEffect(() => {
    let alive = true;
    setLoading(true);
    // new Date(y, m, 0) = último dia do mês m (porque dia 0 do mês m+1
    // é o dia anterior). Não passar 0 direto pro ymd() — não faz aritmética.
    const rangeStart = ymd(year, month - 1, 1);
    const endDate = new Date(year, month + 2, 0);
    const rangeEnd = ymd(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    supabase
      .from("avisos")
      .select("*")
      .gte("data_inicio", rangeStart)
      .lte("data_inicio", rangeEnd)
      .order("data_inicio", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error("[Calendario] avisos:", error);
        setAvisos((data || []) as Aviso[]);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [year, month]);

  const cells = useMemo(() => buildGrid(year, month), [year, month]);

  // Indexa eventos por dia (YYYY-MM-DD) pra lookup O(1) na grid.
  // Tipos ocultos no filtro são removidos aqui.
  const avisosByDay = useMemo(() => {
    const m: Record<string, Aviso[]> = {};
    for (const a of avisos) {
      if (hideTypes.has(a.tipo)) continue;
      (m[a.data_inicio] ||= []).push(a);
    }
    return m;
  }, [avisos, hideTypes]);

  const anivByMmdd = useMemo(() => {
    const m: Record<string, Aniversariante[]> = {};
    if (hideTypes.has("aniv")) return m;
    for (const a of aniv) (m[mmdd(a.data_nascimento)] ||= []).push(a);
    return m;
  }, [aniv, hideTypes]);

  /** Lista cronológica dos próximos 7 dias (avisos + aniversários).
   *  Independente do mês visualizado — sempre a partir de hoje. */
  const proximos7 = useMemo(() => {
    type Item = { date: string; kind: "aniv" | "aviso"; label: string; cor: string; sub: string; daysAway: number; };
    const out: Item[] = [];
    const t0 = new Date();
    const todayKey = ymd(t0.getFullYear(), t0.getMonth(), t0.getDate());
    // Range [hoje, hoje+7]
    const lim = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + 7);
    const limKey = ymd(lim.getFullYear(), lim.getMonth(), lim.getDate());

    // Avisos no range (respeita filtro)
    for (const a of proximosAvisos) {
      if (hideTypes.has(a.tipo)) continue;
      if (a.data_inicio < todayKey || a.data_inicio > limKey) continue;
      const days = Math.round((new Date(a.data_inicio + "T00:00").getTime() - new Date(todayKey + "T00:00").getTime()) / 86400000);
      out.push({
        date: a.data_inicio, kind: "aviso",
        label: a.titulo, cor: a.cor || TIPO_COR[a.tipo],
        sub: TIPO_LABEL[a.tipo], daysAway: days,
      });
    }
    // Aniversários do range (compara MM-DD) — respeita filtro
    if (!hideTypes.has("aniv")) for (let i = 0; i <= 7; i++) {
      const d = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i);
      const key = ymd(d.getFullYear(), d.getMonth(), d.getDate());
      const md = mmdd(key);
      const lista = anivByMmdd[md] || [];
      for (const p of lista) {
        out.push({
          date: key, kind: "aniv",
          label: p.nome, cor: "#EC4899", sub: "Aniversário", daysAway: i,
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  }, [proximosAvisos, anivByMmdd, hideTypes]);

  const dayLabel = (n: number) =>
    n === 0 ? "Hoje" : n === 1 ? "Amanhã" : `Em ${n} dias`;

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Calendário</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Avisos, feriados, reuniões e aniversários
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft size={16} />
          </Button>
          <div className="min-w-[180px] text-center font-semibold">
            {MES_LABEL[month]} {year}
          </div>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight size={16} />
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus size={14} className="mr-1" /> Novo aviso
          </Button>
        </div>
      </div>

      {/* Próximos 7 dias */}
      {proximos7.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={14} className="text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Próximos 7 dias
            </span>
            <span className="text-xs text-muted-foreground">
              · {proximos7.length} {proximos7.length === 1 ? "evento" : "eventos"}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {proximos7.map((p, i) => (
              <div
                key={`${p.kind}-${p.date}-${i}`}
                className="shrink-0 border rounded-lg px-3 py-2 min-w-[200px] flex flex-col gap-1"
                style={{ borderLeftWidth: 3, borderLeftColor: p.cor }}
              >
                <div className="flex items-center gap-2">
                  <span className={[
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                    p.daysAway === 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                    p.daysAway === 1 ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" :
                    "bg-muted text-muted-foreground",
                  ].join(" ")}>
                    {dayLabel(p.daysAway)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{p.sub}</span>
                </div>
                <div className="text-sm font-medium truncate flex items-center gap-1.5">
                  {p.kind === "aniv" && <Cake size={12} className="text-pink-500 shrink-0" />}
                  {p.kind === "aviso" && <CalendarDays size={12} className="shrink-0" style={{ color: p.cor }} />}
                  <span className="truncate">{p.label}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filtros de tipo */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground">Mostrar:</span>
        {([
          ["aniv", "🎂 Aniversários", "#EC4899"],
          ["aviso", "Avisos", TIPO_COR.aviso],
          ["feriado", "Feriados", TIPO_COR.feriado],
          ["reuniao", "Reuniões", TIPO_COR.reuniao],
          ["evento", "Eventos", TIPO_COR.evento],
        ] as const).map(([key, label, cor]) => {
          const active = !hideTypes.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleType(key)}
              className={[
                "px-2.5 py-1 rounded-full text-xs font-medium border transition",
                active ? "text-white border-transparent" : "bg-background text-muted-foreground hover:bg-secondary line-through opacity-60",
              ].join(" ")}
              style={active ? { background: cor } : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-secondary/30">
          {DIAS_SEM.map(d => (
            <div key={d} className="px-3 py-2 text-xs font-semibold text-muted-foreground text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(110px, auto)" }}>
          {cells.map(({ date, inMonth }, i) => {
            const key = ymd(date.getFullYear(), date.getMonth(), date.getDate());
            const avs = avisosByDay[key] || [];
            const ans = anivByMmdd[mmdd(key)] || [];
            const isToday = isSameDay(date, today);
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={[
                  "border-b border-r p-2 text-left transition flex flex-col gap-1 overflow-hidden",
                  inMonth ? "bg-background hover:bg-secondary/50" : "bg-secondary/20 text-muted-foreground/60 hover:bg-secondary/40",
                  (i + 1) % 7 === 0 ? "border-r-0" : "",
                  i >= 35 ? "border-b-0" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className={isToday
                    ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold"
                    : "font-semibold"
                  }>{date.getDate()}</span>
                  {ans.length > 0 && (
                    <Cake size={12} className="text-pink-500 shrink-0" />
                  )}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {avs.slice(0, 2).map(a => (
                    <div
                      key={a.id}
                      title={a.titulo}
                      className="text-[10px] px-1.5 py-0.5 rounded truncate text-white"
                      style={{ background: a.cor || TIPO_COR[a.tipo] }}
                    >
                      {a.titulo}
                    </div>
                  ))}
                  {avs.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{avs.length - 2} mais
                    </div>
                  )}
                  {ans.length > 0 && ans.slice(0, 2 - Math.min(avs.length, 2)).map(a => (
                    <div key={a.id} className="text-[10px] px-1.5 py-0.5 rounded truncate bg-pink-500/15 text-pink-700 dark:text-pink-300">
                      🎂 {a.nome.split(" ")[0]}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Sidebar/Modal — Detalhe do dia */}
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          avisos={avisosByDay[ymd(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())] || []}
          aniversariantes={anivByMmdd[mmdd(ymd(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()))] || []}
          onClose={() => setSelectedDate(null)}
          onDeleted={(id) => setAvisos(prev => prev.filter(a => a.id !== id))}
        />
      )}

      {/* Modal — Novo aviso */}
      {showNew && (
        <NewAvisoModal
          defaultDate={ymd(today.getFullYear(), today.getMonth(), today.getDate())}
          onClose={() => setShowNew(false)}
          onSaved={(nv) => {
            setAvisos(prev => [...prev, nv].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)));
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

// ── Modal: detalhe do dia ─────────────────────────────────────────
function DayDetailModal({
  date, avisos, aniversariantes, onClose, onDeleted,
}: {
  date: Date;
  avisos: Aviso[];
  aniversariantes: Aniversariante[];
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este aviso?")) return;
    const { error } = await supabase.from("avisos").delete().eq("id", id);
    if (error) { alert(`Erro: ${error.message}`); return; }
    onDeleted(id);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-background rounded-lg border max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <div className="text-sm text-muted-foreground">
              {DIAS_SEM[(date.getDay() + 6) % 7]}
            </div>
            <div className="font-semibold">
              {date.getDate()} de {MES_LABEL[date.getMonth()]} de {date.getFullYear()}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {aniversariantes.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                Aniversariantes
              </div>
              <div className="space-y-2">
                {aniversariantes.map(a => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded bg-pink-500/10">
                    <Cake size={16} className="text-pink-500" />
                    <span className="text-sm font-medium">{a.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {avisos.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                Avisos
              </div>
              <div className="space-y-2">
                {avisos.map(a => (
                  <div key={a.id} className="p-3 rounded border" style={{ borderLeftWidth: 4, borderLeftColor: a.cor || TIPO_COR[a.tipo] }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{a.titulo}</div>
                        {a.descricao && (
                          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {a.descricao}
                          </div>
                        )}
                        <div className="mt-2">
                          <Badge variant="outline" className="text-[10px]">
                            {TIPO_LABEL[a.tipo]}
                          </Badge>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {avisos.length === 0 && aniversariantes.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhum evento neste dia.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal: novo aviso ─────────────────────────────────────────────
function NewAvisoModal({
  defaultDate, onClose, onSaved,
}: {
  defaultDate: string;
  onClose: () => void;
  onSaved: (a: Aviso) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState(defaultDate);
  const [dataFim, setDataFim] = useState("");
  const [tipo, setTipo] = useState<TipoAviso>("aviso");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!titulo.trim() || !dataInicio) {
      alert("Título e data são obrigatórios");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("avisos")
      .insert({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        tipo,
        cor: TIPO_COR[tipo],
      })
      .select()
      .single();
    setSaving(false);
    if (error) { alert(`Erro: ${error.message}`); return; }
    onSaved(data as Aviso);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-background rounded-lg border max-w-md w-full overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="font-semibold">Novo aviso</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1">Tipo</label>
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(TIPO_LABEL) as TipoAviso[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={[
                    "px-2 py-2 rounded text-xs font-medium transition border",
                    tipo === t ? "text-white border-transparent" : "bg-background hover:bg-secondary",
                  ].join(" ")}
                  style={tipo === t ? { background: TIPO_COR[t] } : undefined}
                >
                  {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Título</label>
            <Input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Confraternização de Natal"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Descrição (opcional)</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border bg-background"
              placeholder="Detalhes do evento"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Data início</label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Data fim (opcional)</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
