import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, ChevronLeft, ChevronRight, MapPin, Check } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";

type ObraRow = {
  atribuicao_id: string;
  card_id: string;
  obra_code: string;
  cliente_nome: string;
  cidade: string | null;
  data_prevista_inicio: string;
  observacao?: string | null;
};

type ObraRange = ObraRow & { inicio: Date; fim: Date };

// Check-in real do prestador (instala_checkins) pra sinalizar no calendário
type CheckinRow = { card_id: string; created_at: string };

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA_CURTO = ["D","S","T","Q","Q","S","S"];

const COR_INICIO = "#4a7c59"; // verde harmonizado com bege Navona
const COR_FIM    = "#c07b2e"; // âmbar/terracota
const COR_MEIO   = "#77736A"; // cinza pedra (T.textSecondary)
const COR_CHECK  = "#15803d"; // verde forte: dia com check-in registrado

function parseBR(s: string): Date | null {
  const m = s?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}
function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0,0,0,0); return x; }

function extrairFim(details: any, inicio: Date): Date | null {
  const pc = details?.prazo_contratual as string | undefined;
  if (pc && pc.includes("-")) {
    const partes = pc.split("-").map((p) => p.trim());
    const segunda = parseBR(partes[partes.length - 1] ?? "");
    if (segunda) return segunda;
  }
  const dias = Number(details?.prazo_dias_uteis ?? NaN);
  if (Number.isFinite(dias) && dias > 0) return addDays(inicio, Math.round(dias * 1.4));
  return null;
}

export function Agenda({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const nav = useNavigate();
  const [modo, setModo] = useState<"mes" | "semana">("mes");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selecionado, setSelecionado] = useState(() => new Date());
  const [obras, setObras] = useState<ObraRange[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!prestador?.id) return;
    setLoading(true);
    // Obras e check-ins em paralelo: o check-in NAO depende da lista de obras
    // (e precisa aparecer mesmo se a obra ja saiu da view de atribuidas).
    const [{ data: rows }, { data: cks }] = await Promise.all([
      sb.from("vw_instala_minhas_obras")
        .select("atribuicao_id,card_id,obra_code,cliente_nome,cidade,data_prevista_inicio,observacao")
        // Agenda e o calendario dele: so obra atribuida. Sem isso o fiscal levaria
        // toda obra da empresa pro mes e o .in() de kanban_cards estouraria a URL.
        .eq("prestador_id", prestador.id)
        .eq("vinculo", "atribuido")
        .limit(300),
      sb.from("instala_checkins")
        .select("card_id,created_at")
        .eq("prestador_id", prestador.id)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setCheckins((cks as CheckinRow[]) ?? []);
    const cards = (rows as ObraRow[]) ?? [];
    if (cards.length === 0) { setObras([]); setLoading(false); return; }
    const { data: kc } = await sb.from("kanban_cards")
      .select("id,details")
      .in("id", cards.map((c) => c.card_id));
    const detailsMap = new Map((kc || []).map((r: any) => [r.id, r.details] as const));
    const ranges: ObraRange[] = cards.map((c) => {
      const inicio = new Date(c.data_prevista_inicio + "T00:00:00");
      const fim = extrairFim(detailsMap.get(c.card_id), inicio) ?? inicio;
      return { ...c, inicio, fim };
    });
    setObras(ranges);
    setLoading(false);
  }, [prestador?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // dias do período visível
  const dias = useMemo(() => {
    if (modo === "mes") {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const start = startOfWeek(first);
      return Array.from({ length: 42 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [modo, anchor]);

  const obrasDoDia = useMemo(() => {
    return obras.filter((o) => o.inicio <= endOfDay(selecionado) && o.fim >= startOfDay(selecionado));
  }, [obras, selecionado]);

  const marcadoresPorDia = useMemo(() => {
    // pra cada dia: {inicio, fim, meio} — dias podem ter os 3 (obra começando + outra terminando + terceira no meio)
    const map = new Map<string, { inicio: boolean; fim: boolean; meio: boolean }>();
    const get = (k: string) => map.get(k) ?? { inicio: false, fim: false, meio: false };
    for (const o of obras) {
      const kI = ymd(startOfDay(o.inicio));
      const kF = ymd(startOfDay(o.fim));
      map.set(kI, { ...get(kI), inicio: true });
      map.set(kF, { ...get(kF), fim: true });
      // meio: dias entre início e fim (exclusivo)
      let d = addDays(startOfDay(o.inicio), 1);
      const fim = startOfDay(o.fim);
      while (d < fim) { const k = ymd(d); map.set(k, { ...get(k), meio: true }); d = addDays(d, 1); }
    }
    return map;
  }, [obras]);

  // Dias com check-in do prestador: chave ymd -> set de card_ids checkados no dia.
  // O set permite marcar tanto o dia no grid quanto a obra certa na lista de baixo.
  const checksPorDia = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of checkins) {
      const k = ymd(startOfDay(new Date(c.created_at)));
      const set = map.get(k) ?? new Set<string>();
      set.add(c.card_id);
      map.set(k, set);
    }
    return map;
  }, [checkins]);

  const tituloPeriodo = modo === "mes"
    ? `${MESES[anchor.getMonth()]} ${anchor.getFullYear()}`
    : (() => {
        const s = startOfWeek(anchor), e = addDays(s, 6);
        return `${s.getDate()} ${MESES[s.getMonth()].slice(0,3)} a ${e.getDate()} ${MESES[e.getMonth()].slice(0,3)}`;
      })();

  const navPeriodo = (d: 1 | -1) => setAnchor((a) => {
    if (modo === "mes") return new Date(a.getFullYear(), a.getMonth() + d, 1);
    return addDays(a, d * 7);
  });

  const today = new Date();

  return (
    <Screen
      slug={slug}
      titulo="Agenda"
      subtitulo={tituloPeriodo}
      action={
        <button onClick={fetch} title="Atualizar" style={iconBtn(T)}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      }
    >
      {/* Toggle Mês | Semana */}
      <div style={{ display: "flex", gap: 0, marginBottom: 14, border: `1px solid ${T.border}` }}>
        {(["mes","semana"] as const).map((m) => (
          <button key={m} onClick={() => setModo(m)} style={{
            flex: 1, padding: "10px 0", background: modo === m ? T.textPrimary : "transparent",
            color: modo === m ? T.bg : T.textSecondary, border: "none", cursor: "pointer",
            fontSize: 10, letterSpacing: "0.2em", fontFamily: "'IBM Plex Mono', monospace",
          }}>{m === "mes" ? "MÊS" : "SEMANA"}</button>
        ))}
      </div>

      {/* Navegação < período > */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => navPeriodo(-1)} style={navBtn(T)}><ChevronLeft size={16} /></button>
        <button onClick={() => { setAnchor(new Date()); setSelecionado(new Date()); }} style={{
          background: "transparent", border: "none", color: T.textMuted, fontSize: 10, letterSpacing: "0.2em", cursor: "pointer",
        }}>HOJE</button>
        <button onClick={() => navPeriodo(1)} style={navBtn(T)}><ChevronRight size={16} /></button>
      </div>

      {/* Cabeçalho dias da semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
        {DIAS_SEMANA_CURTO.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, letterSpacing: "0.2em", color: T.textMuted, padding: "6px 0" }}>{d}</div>
        ))}
      </div>

      {/* Grid do calendário */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {dias.map((d, i) => {
          const outroMes = modo === "mes" && d.getMonth() !== anchor.getMonth();
          const isToday = sameDay(d, today);
          const isSel = sameDay(d, selecionado);
          const m = marcadoresPorDia.get(ymd(d));
          const temCheck = checksPorDia.has(ymd(d));
          const cores: string[] = [];
          if (m?.inicio) cores.push(COR_INICIO);
          if (m?.fim) cores.push(COR_FIM);
          if (m?.meio && !m.inicio && !m.fim) cores.push(COR_MEIO);
          return (
            <button key={i} onClick={() => setSelecionado(d)} style={{
              aspectRatio: modo === "semana" ? "1/1.4" : "1/1",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "6px 0 4px",
              gap: 3, background: isSel ? T.textPrimary : (isToday ? T.cardHover : "transparent"),
              color: isSel ? T.bg : (outroMes ? T.textMuted : T.textPrimary),
              border: `1px solid ${isSel ? T.textPrimary : (isToday ? T.borderHover : T.border)}`,
              cursor: "pointer", fontFamily: "'Inter', sans-serif",
            }}>
              <span style={{ fontSize: 13, fontWeight: isToday ? 600 : 400 }}>{d.getDate()}</span>
              {(cores.length > 0 || temCheck) && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: "auto", paddingBottom: 2 }}>
                  {cores.map((c, k) => (
                    <span key={k} style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: c,
                      boxShadow: isSel ? `0 0 0 1.5px ${T.bg}` : "none",
                    }} />
                  ))}
                  {/* check-in registrado no dia: check verde ao lado dos pontos */}
                  {temCheck && (
                    <Check size={9} strokeWidth={3.5} style={{ color: isSel ? T.bg : COR_CHECK }} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda de cores */}
      <div style={{
        display: "flex", gap: 16, justifyContent: "center", marginTop: 10,
        fontSize: 9, letterSpacing: "0.14em", color: T.textMuted, fontFamily: "'IBM Plex Mono', monospace",
      }}>
        <Legenda cor={COR_INICIO} label="INÍCIO" />
        <Legenda cor={COR_FIM}    label="TÉRMINO" />
        <Legenda cor={COR_MEIO}   label="EM ANDAMENTO" />
        <Legenda cor={COR_CHECK}  label="CHECK-IN" check />
      </div>

      {/* Lista de obras do dia selecionado */}
      <section style={{ marginTop: 22 }}>
        <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 10 }}>
          {selecionado.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase()}
          {" · "}{obrasDoDia.length} {obrasDoDia.length === 1 ? "OBRA" : "OBRAS"}
        </p>
        {obrasDoDia.length === 0 ? (
          <div style={{ padding: "24px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
            Nenhuma obra nesse dia.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {obrasDoDia.map((o) => {
              const ehInicio = sameDay(o.inicio, selecionado);
              const ehFim = sameDay(o.fim, selecionado) && !sameDay(o.inicio, o.fim);
              const ehMeio = !ehInicio && !ehFim;
              const badgeCor = ehInicio ? COR_INICIO : ehFim ? COR_FIM : COR_MEIO;
              const badgeTxt = ehInicio ? "INÍCIO HOJE" : ehFim ? "TÉRMINO HOJE" : "EM ANDAMENTO";
              // Check-in dessa obra no dia selecionado: chip verde com a hora do 1o registro.
              // startOfDay antes do ymd: selecionado carrega hora e o toISOString viraria o dia em UTC.
              const temCheckObra = checksPorDia.get(ymd(startOfDay(selecionado)))?.has(o.card_id) ?? false;
              const horaCheck = temCheckObra
                ? checkins.filter((c) => c.card_id === o.card_id && sameDay(new Date(c.created_at), selecionado))
                    .map((c) => new Date(c.created_at)).sort((a, b) => a.getTime() - b.getTime())[0]
                    ?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                : null;
              return (
              <button key={o.atribuicao_id} onClick={() => nav(`/obra/${o.card_id}`)} style={{
                textAlign: "left", background: T.cardBg, border: `1px solid ${T.border}`,
                borderLeft: `4px solid ${badgeCor}`, color: T.textPrimary,
                padding: "14px 16px", cursor: "pointer", fontFamily: "'Inter', sans-serif",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 8, letterSpacing: "0.18em", padding: "3px 7px",
                    background: badgeCor, color: "#fff", fontFamily: "'IBM Plex Mono', monospace",
                  }}>{badgeTxt}</span>
                  {/* chip CHECK: prestador registrou check-in nessa obra nesse dia */}
                  {temCheckObra && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 8, letterSpacing: "0.18em", padding: "3px 7px",
                      background: COR_CHECK, color: "#fff", fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      <Check size={9} strokeWidth={3.5} />
                      CHECK{horaCheck ? ` ${horaCheck}` : ""}
                    </span>
                  )}
                  {ehMeio && <span style={{ fontSize: 10, color: T.textMuted }}>·</span>}
                </div>
                <div style={{ fontSize: 10, letterSpacing: "0.14em", color: T.textMuted, marginBottom: 6, textTransform: "uppercase" }}>
                  <b style={{ color: T.textSecondary }}>INÍCIO</b> {o.inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  {!sameDay(o.inicio, o.fim) && (
                    <>{" → "}<b style={{ color: T.textSecondary }}>TÉRMINO</b> {o.fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {o.cliente_nome}
                </div>
                {(o.observacao || o.cidade) && (
                  <div style={{ fontSize: 11, color: T.textSecondary, display: "flex", gap: 6 }}>
                    {o.cidade && <MapPin size={10} style={{ flexShrink: 0, marginTop: 3 }} />}
                    <span>{o.observacao || o.cidade}</span>
                  </div>
                )}
              </button>
              );
            })}
          </div>
        )}
      </section>

      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function Legenda({ cor, label, check }: { cor: string; label: string; check?: boolean }) {
  // check=true troca o ponto pelo glifo de check (legenda do check-in)
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {check
        ? <Check size={10} strokeWidth={3.5} style={{ color: cor }} />
        : <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor }} />}
      {label}
    </span>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});
const navBtn = (T: any): React.CSSProperties => ({
  background: T.cardBg, border: `1px solid ${T.border}`,
  color: T.textPrimary, padding: 8, cursor: "pointer",
  display: "flex", alignItems: "center",
});
