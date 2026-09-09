import { useEffect, useState, useRef } from "react";
import { Calendar, X, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";

/**
 * Listener global que mostra popup + toca som quando a Teca IA cria um agendamento.
 * Filtra por `created_by` contendo "teca".
 * Som carregado via Web Audio (gera bip — não depende de arquivo externo).
 */

type Agendamento = {
  id: string;
  vendedor: string | null;
  cliente_nome: string | null;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  modalidade: string | null;
  meet_link: string | null;
  endereco: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string | null;
};

// ── AudioContext persistente, desbloqueado na primeira interação da página ──
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    if (!_ctx) _ctx = new Ctx();
    return _ctx;
  } catch { return null; }
}
function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}
if (typeof window !== "undefined") {
  // Primeira interação do user (clique/toque/tecla) desbloqueia o áudio
  const evts = ["click", "touchstart", "keydown", "pointerdown"];
  const handler = () => { unlockAudio(); };
  evts.forEach((e) => window.addEventListener(e, handler, { once: false, passive: true }));
}

function playAlert() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    // tenta desbloquear (caso já tenha havido gesto)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    // 2 bips ascendentes — "ding-dong" curto
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
    // NÃO fechar o context — vamos reusar nos próximos alerts
  } catch {
    // ignora
  }
}

function fmtDataHora(a: Agendamento): string {
  try {
    const [y, m, d] = (a.data || "").split("-").map((x) => parseInt(x, 10));
    if (!y || !m || !d) return a.data || "";
    const dt = new Date(y, m - 1, d);
    const dia = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    return `${dia} · ${(a.hora_inicio || "").slice(0, 5)}–${(a.hora_fim || "").slice(0, 5)}`;
  } catch {
    return `${a.data} ${a.hora_inicio}`;
  }
}

const SEEN_KEY = "teca_agend_seen_ids_v1";
const POLL_INTERVAL_MS = 20000;
const LOOKBACK_MS = 5 * 60 * 1000; // 5min — pega inserts perdidos quando aba estava fechada/dormindo

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function persistSeen(s: Set<string>) {
  try {
    // mantém só os últimos 200 ids pra não inchar
    const arr = Array.from(s).slice(-200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch { /* ignora */ }
}

export function TecaAgendamentoNotifier() {
  const [popups, setPopups] = useState<Agendamento[]>([]);
  const lastSeenRef = useRef<Set<string>>(loadSeen());

  function showAgendamento(row: Agendamento) {
    if (!row || !row.id) return;
    const createdBy = (row.created_by || "").toLowerCase();
    if (!createdBy.includes("teca") && !createdBy.includes("teka")) return;
    if (lastSeenRef.current.has(row.id)) return;
    lastSeenRef.current.add(row.id);
    persistSeen(lastSeenRef.current);
    playAlert();
    setPopups((p) => [row, ...p].slice(0, 5));
    setTimeout(() => {
      setPopups((p) => p.filter((x) => x.id !== row.id));
    }, 25000);
  }

  useEffect(() => {
    // ── 1. Realtime: caminho principal ──
    const ch = supabase.channel("hb-teca-agendamentos")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "agendamentos" },
        (payload: any) => showAgendamento(payload.new as Agendamento),
      )
      .subscribe();

    // ── 2. Polling fallback (caso WebSocket caia / aba reabra) ──
    let cancelled = false;
    async function pollOnce() {
      try {
        const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
        const { data, error } = await supabase
          .from("agendamentos")
          .select("id,vendedor,cliente_nome,data,hora_inicio,hora_fim,modalidade,meet_link,endereco,observacoes,created_by,created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(20);
        if (error || cancelled || !data) return;
        for (const row of data) showAgendamento(row as Agendamento);
      } catch { /* ignora */ }
    }
    // primeira execução depois de 2s (deixa o componente montar)
    const t0 = setTimeout(pollOnce, 2000);
    const tInterval = setInterval(pollOnce, POLL_INTERVAL_MS);
    // refaz polling quando a aba volta pro foco
    const onVis = () => { if (document.visibilityState === "visible") pollOnce(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearTimeout(t0);
      clearInterval(tInterval);
      document.removeEventListener("visibilitychange", onVis);
      supabase.removeChannel(ch);
    };
  }, []);

  if (popups.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm pointer-events-none">
      {popups.map((a) => (
        <div
          key={a.id}
          className="pointer-events-auto bg-gradient-to-br from-hb-green/95 to-hb-green/80 backdrop-blur-sm border border-hb-green/60 text-black rounded-lg shadow-2xl p-3 animate-slide-in"
          style={{ animation: "slideIn 0.3s ease-out" }}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <CheckCircle2 size={14} />
              <span>🎯 Teca agendou!</span>
            </div>
            <button
              onClick={() => setPopups((p) => p.filter((x) => x.id !== a.id))}
              className="text-black/70 hover:text-black"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
          </div>
          <div className="text-xs font-semibold mb-0.5">{a.cliente_nome || "Cliente"}</div>
          <div className="text-[11px] flex items-center gap-1">
            <Calendar size={10} />
            <span>{fmtDataHora(a)}</span>
          </div>
          <div className="text-[11px] mt-0.5">
            <b>{a.vendedor || "—"}</b> · {a.modalidade === "meet" ? "🎥 Meet" : "📍 Presencial"}
          </div>
          {a.observacoes && (
            <div className="text-[10px] mt-1 opacity-75 line-clamp-2">{a.observacoes}</div>
          )}
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
