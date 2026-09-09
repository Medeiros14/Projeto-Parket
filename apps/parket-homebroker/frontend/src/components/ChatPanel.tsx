/**
 * ChatPanel — sala de atendimento ao vivo (estilo WhatsApp Web).
 * - Carrega histórico do card via Supabase
 * - Subscribe realtime (postgres_changes) na whatsapp_messages
 * - Composer envia via /api/hb-whatsapp/send (parket-ai-squad)
 * - IA NÃO envia mensagem — só sugere (Fase 3).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2, MessageSquare, AlertCircle, Phone, Bot, Volume2, VolumeX, Sparkles, Paperclip, Mic, Square, Image as ImageIcon, FileText, Download, X, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneOff, Play, Pause } from "lucide-react";
import { supabase } from "../lib/supabase";
import { fmtDateTime, fmtRelative, initials } from "../lib/format";
import type { WhatsAppMessage } from "../lib/api";
import type { AppUser } from "../lib/auth";
import { CopilotPanel } from "./CopilotPanel";
import { CardActions } from "./CardActions";
import { useReconnect } from "../lib/use-reconnect";
import { wavoip, type CallState } from "../lib/wavoip-client";

const AGENTE_URL = "https://agente.parket.works";
const WAVOIP_API = "https://core.parket.works";

// Tipo das ligações Wavoip
type WavoipCall = {
  id: string;
  whatsapp_call_id: string;
  caller: string | null;
  receiver: string | null;
  direction: "INCOMING" | "OUTCOMING" | string;
  status: string;
  duration: number;
  record_url: string | null;
  record_status: string | null;
  iniciada_em: string;
  finalizada_em: string | null;
};

function fmtCallDuration(s: number): string {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const CALL_STATUS_LABEL: Record<string, string> = {
  ENDED: "Encerrada",
  REJECTED: "Rejeitada",
  FAILED: "Falhou",
  NOT_ANSWERED: "Não atendida",
  ACTIVE: "Em curso",
  OUTGOING_RING: "Tocando",
  INCOMING_RING: "Entrante",
  CONNECTING: "Conectando",
  HANDLED_REMOTELY: "Atendida em outro",
  ACCEPTED_ELSEWHERE: "Atendida em outro",
  CANCELLED: "Cancelada",
};

type Props = {
  cardId: string;
  fallbackPhone?: string | null;  // do details.telefone, caso queira pré-popular
  cardTitle?: string;
  appUser: AppUser;
  // contexto extra pro copiloto IA — opcional, melhora as sugestões
  cardCtx?: {
    slug?: string | null;
    produto_interesse?: string | null;
    metragem?: number | null;
    valor_mesa?: number | null;
    cidade?: string | null;
    responsavel?: string | null;
    ia_analise?: any;  // análise IA persistida em card.details.ia_analise
  };
  // Pra controles inline de etapa/atribuição
  cardMeta?: {
    dept_id: string;
    column_id: string | null;
    responsavel: string | null;
  };
  onCardChanged?: () => void;
};

export function ChatPanel({ cardId, fallbackPhone, cardTitle, appUser, cardCtx, cardMeta, onCardChanged }: Props) {
  const [msgs, setMsgs] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem("hb-mute") === "1");
  // Default OCULTO — só aparece quando user clica no botão "IA" do header.
  // Persiste a escolha em localStorage: "1" = aberto, qualquer outra coisa = fechado.
  const [showCopilot, setShowCopilot] = useState(() => localStorage.getItem("hb-copilot-show") === "1");
  // Largura do painel Copiloto IA — resizable, persistida em localStorage.
  // Range: 220px (mínimo legível) até 600px (não passa de meia tela).
  const [copilotWidth, setCopilotWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem("hb-copilot-width") || "340");
    return v >= 220 && v <= 600 ? v : 340;
  });
  useEffect(() => { try { localStorage.setItem("hb-copilot-show", showCopilot ? "1" : "0"); } catch {} }, [showCopilot]);
  useEffect(() => { try { localStorage.setItem("hb-copilot-width", String(copilotWidth)); } catch {} }, [copilotWidth]);
  // Drag handle pra redimensionar (mouse move global)
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      // Posição do mouse relativa à direita da janela = largura do painel
      const w = window.innerWidth - e.clientX;
      const clamped = Math.max(220, Math.min(600, w));
      setCopilotWidth(clamped);
    };
    const onUp = () => setResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing]);
  const [calls, setCalls] = useState<WavoipCall[]>([]);
  // Estado da Teca IA (V2) — pausa/retomada manual
  const [tecaPaused, setTecaPaused] = useState<boolean | null>(null);  // null = não carregado ainda
  const [tecaBusy, setTecaBusy] = useState(false);
  const tecaPhone = useMemo(() => {
    const p = msgs.find((m) => m.phone)?.phone || fallbackPhone || "";
    return (p || "").replace(/\D/g, "");
  }, [msgs, fallbackPhone]);

  // Carrega status inicial da Teca
  useEffect(() => {
    if (!tecaPhone) { setTecaPaused(null); return; }
    let alive = true;
    fetch(`https://agente.parket.works/api/teca/status/${tecaPhone}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setTecaPaused(!!j.paused); })
      .catch(() => { if (alive) setTecaPaused(null); });
    return () => { alive = false; };
  }, [tecaPhone]);

  async function toggleTeca() {
    if (!tecaPhone || tecaPaused === null) return;
    setTecaBusy(true);
    try {
      const action = tecaPaused ? "resume" : "pause";
      const body = action === "pause" ? { motivo: "pausada manualmente pelo painel" } : undefined;
      const r = await fetch(`https://agente.parket.works/api/teca/${action}/${tecaPhone}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) throw new Error(await r.text());
      setTecaPaused((v) => !v);
    } catch (e) {
      alert("Falhou: " + (e as Error).message);
    } finally {
      setTecaBusy(false);
    }
  }
  const [showCalls, setShowCalls] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenAt = useRef<number>(Date.now());

  // Histórico de ligações Wavoip do card
  useEffect(() => {
    if (!cardId) return;
    let alive = true;
    supabase
      .from("wavoip_calls")
      .select("id, whatsapp_call_id, caller, receiver, direction, status, duration, record_url, record_status, iniciada_em, finalizada_em")
      .eq("card_id", cardId)
      .order("iniciada_em", { ascending: false })
      .limit(30)
      .then(({ data }) => { if (alive) setCalls(((data || []) as any) as WavoipCall[]); });
    // Realtime: nova ligação reordena
    const ch = supabase
      .channel(`hb-calls-${cardId}`)
      .on("postgres_changes" as any,
        { event: "*", schema: "public", table: "wavoip_calls", filter: `card_id=eq.${cardId}` },
        () => {
          supabase.from("wavoip_calls").select("*").eq("card_id", cardId).order("iniciada_em", { ascending: false }).limit(30)
            .then(({ data }) => setCalls(((data || []) as any) as WavoipCall[]));
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [cardId]);

  // Estado da ligação ativa (overlay no canto)
  const [callState, setCallState] = useState<CallState>({
    status: "idle", phone: null, startedAt: null, answeredAt: null,
    endedAt: null, muted: false, error: null,
  });
  useEffect(() => {
    return wavoip.subscribe(setCallState);
  }, []);

  // Botão Ligar — usa SDK @wavoip/wavoip-api v2 in-place (WebRTC no browser).
  // Webhook do Wavoip continua registrando em wavoip_calls — histórico realtime
  // aparece no botão "Calls (N)" do header e o overlay CallOverlay mostra
  // status/mute/desligar.
  const handleLigar = async () => {
    if (callState.status !== "idle" && callState.status !== "ended" && callState.status !== "rejected" && callState.status !== "failed") {
      // chamada já em andamento — não dispara outra
      return;
    }
    const phone = msgs.find((m) => m.phone)?.phone || fallbackPhone || "";
    const digits = (phone || "").replace(/\D/g, "");
    if (!digits) { alert("Telefone não encontrado pra esse card"); return; }
    try {
      await wavoip.startCall(digits);
    } catch (e: any) {
      alert("Falha ao iniciar ligação: " + (e?.message || e));
    }
  };
  const handleEndCall = async () => {
    await wavoip.endCall();
    // Mantém overlay no estado "ended" por 2s pra usuário ver, depois reseta.
    setTimeout(() => wavoip.reset(), 2000);
  };
  const handleToggleMute = async () => {
    await wavoip.setMute(!callState.muted);
  };

  // Carrega histórico — busca por card_id OU phone normalizado
  // (fallback caso vínculo card_id<>msg esteja quebrado pra essa conversa).
  useEffect(() => {
    if (!cardId) return;
    setLoading(true);
    const fbDigits = (fallbackPhone || "").replace(/\D/g, "");
    // Constrói o OR filter: card_id=eq.X OR phone IN (variações DDI/sem DDI)
    const orParts: string[] = [`card_id.eq.${cardId}`];
    if (fbDigits.length >= 10) {
      // Inclui formato com 55 e sem 55, e com/sem 9º dígito
      const variants = new Set<string>([fbDigits]);
      if (fbDigits.startsWith("55") && fbDigits.length >= 12) variants.add(fbDigits.slice(2));
      else if (!fbDigits.startsWith("55") && fbDigits.length <= 11) variants.add("55" + fbDigits);
      orParts.push(`phone.in.(${Array.from(variants).join(",")})`);
    }
    supabase
      .from("whatsapp_messages")
      .select("id, card_id, phone, direction, message_text, message_type, media_url, sender_name, timestamp, evolution_msg_id, metadata, instance")
      .or(orParts.join(","))
      .order("timestamp", { ascending: false })
      .limit(300)
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else {
          const list = ((data || []) as any[]).reverse().map((r) => ({
            id: r.id,
            card_id: r.card_id,
            phone: r.phone,
            direction: r.direction,
            text: r.message_text,
            created_at: r.timestamp || r.created_at,
            message_type: r.message_type,
            media_url: r.media_url,
            evolution_msg_id: r.evolution_msg_id,
            metadata: r.metadata,
          })) as WhatsAppMessage[];
          setMsgs(list);
          lastSeenAt.current = Date.now();
        }
        setLoading(false);
      });
  }, [cardId, reloadKey]);

  // Reconnect — quando volta a aba, força reload das mensagens (compensa
  // realtime que pode ter caído enquanto a aba estava em background).
  useReconnect(() => { if (cardId) setReloadKey((k) => k + 1); });

  // Realtime — entra mensagem nova
  useEffect(() => {
    if (!cardId) return;
    const ch = supabase
      .channel(`hb-chat-${cardId}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `card_id=eq.${cardId}` },
        (payload: any) => {
          const r = payload.new || {};
          const newMsg: WhatsAppMessage = {
            id: r.id,
            card_id: r.card_id,
            phone: r.phone,
            direction: r.direction,
            text: r.message_text,
            created_at: r.timestamp || r.created_at,
            message_type: r.message_type,
            media_url: r.media_url,
            evolution_msg_id: r.evolution_msg_id,
            metadata: r.metadata,
          };
          setMsgs((curr) => {
            if (curr.some((m) => m.id === newMsg.id)) return curr; // de-dup
            return [...curr, newMsg];
          });
          // Sound + glow só pra "in" (recebidas)
          if (newMsg.direction === "in" && !muted) playBeep();
          lastSeenAt.current = Date.now();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cardId, muted]);

  // Auto-scroll pro fim ao receber/enviar
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  const phoneDisplay = msgs.find((m) => m.phone)?.phone || fallbackPhone || "—";

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError(null);
    // Optimistic: adiciona localmente. Vai ser dedup quando o realtime chegar.
    const tempId = "tmp-" + Date.now();
    const optimistic: WhatsAppMessage = {
      id: tempId,
      card_id: cardId,
      phone: phoneDisplay,
      direction: "out",
      text: t,
      created_at: new Date().toISOString(),
    };
    setMsgs((c) => [...c, optimistic]);
    setText("");
    try {
      const r = await fetch(`${AGENTE_URL}/api/hb-whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: cardId,
          mensagem: t,
          telefone: fallbackPhone || undefined,
          sender_name: appUser.nome || appUser.email,
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`HTTP ${r.status}: ${err.slice(0, 200)}`);
      }
      // Remove optimistic — vai chegar via realtime com id real
      // (timeout pra esperar realtime — se não chegar, mantém o optimistic)
      setTimeout(() => {
        setMsgs((c) => {
          const real = c.find((m) => m.direction === "out" && m.text === t && m.id !== tempId);
          if (real) return c.filter((m) => m.id !== tempId);
          return c;
        });
      }, 1500);
    } catch (e: any) {
      // Marca o optimistic como falha
      setMsgs((c) => c.map((m) => m.id === tempId ? { ...m, id: tempId + "-err" } : m));
      setError(e.message || String(e));
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ─── ENVIO DE MÍDIA (imagem/pdf/qualquer arquivo) ───────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const sendFile = async (f: File, caption = "") => {
    if (!f) return;
    if (f.size > 16 * 1024 * 1024) { setError("Arquivo > 16MB (limite WhatsApp)"); return; }
    setUploading(true); setError(null);
    try {
      const form = new FormData();
      form.append("card_id", cardId);
      form.append("file", f);
      if (caption) form.append("caption", caption);
      if (fallbackPhone) form.append("telefone", fallbackPhone);
      form.append("sender_name", appUser.nome || appUser.email);
      const r = await fetch(`${AGENTE_URL}/api/hb-whatsapp/send-media`, { method: "POST", body: form });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    } catch (e: any) {
      setError(e.message || "Falha enviando arquivo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── GRAVAÇÃO DE ÁUDIO (PTT) ─────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);

  const startRec = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefere ogg/opus pra compat com WhatsApp; cai pra webm se browser não suportar
      const mime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus"
                 : MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
                 : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
        const file = new File([blob], `audio.${(mr.mimeType.includes("ogg") ? "ogg" : "webm")}`, { type: mr.mimeType });
        setUploading(true);
        try {
          const form = new FormData();
          form.append("card_id", cardId);
          form.append("file", file);
          if (fallbackPhone) form.append("telefone", fallbackPhone);
          form.append("sender_name", appUser.nome || appUser.email);
          const r = await fetch(`${AGENTE_URL}/api/hb-whatsapp/send-audio`, { method: "POST", body: form });
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
        } catch (e: any) { setError(e.message || "Falha enviando áudio"); }
        finally { setUploading(false); }
      };
      mr.start();
      setRecording(true); setRecSeconds(0);
      recTimerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      setError("Sem acesso ao microfone: " + (e.message || e));
    }
  };
  const stopRec = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };
  const cancelRec = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      // Limpa chunks pra não enviar
      mr.onstop = () => { mr.stream?.getTracks?.().forEach((t) => t.stop()); };
      mr.stop();
    }
    audioChunksRef.current = [];
    setRecording(false); setRecSeconds(0);
  };

  return (
    <div className="flex h-full gap-2">
    <div className="flex flex-col flex-1 min-w-0 bg-hb-panel border border-hb-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-hb-border flex items-center justify-between gap-2 bg-hb-panelLight">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-hb-accent/15 border border-hb-accent/30 text-hb-accent flex items-center justify-center text-xs font-bold">
            {initials(cardTitle || "?")}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-hb-text truncate">{cardTitle || "Atendimento"}</div>
            <div className="text-[10px] text-hb-textDim tabular flex items-center gap-1">
              <Phone size={9} /> {phoneDisplay}
              <span className="text-hb-green ml-1.5">· via Comercial Parket</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleLigar}
            title="Ligar via Wavoip · WhatsApp Call"
            className="text-[10px] px-2 py-0.5 rounded border bg-hb-green/15 border-hb-green/50 text-hb-green hover:bg-hb-green/25 inline-flex items-center gap-1 font-semibold">
            <PhoneCall size={11} /> Ligar
          </button>
          <button onClick={() => setShowCalls(!showCalls)}
            title="Histórico de ligações Wavoip"
            className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 transition ${
              showCalls ? "bg-hb-amber/20 border-hb-amber text-hb-amber" : "border-hb-border text-hb-textDim hover:text-hb-amber"
            }`}>
            <Phone size={10} /> Calls{calls.length > 0 ? ` (${calls.length})` : ""}
          </button>
          <button onClick={() => setShowCopilot(!showCopilot)}
            title="Copiloto IA · sugestões"
            className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 transition ${
              showCopilot ? "bg-hb-blue/20 border-hb-blue text-hb-blue" : "border-hb-border text-hb-textDim hover:text-hb-blue"
            }`}>
            <Sparkles size={10} /> IA
          </button>
          {tecaPaused !== null && (
            <button
              onClick={toggleTeca}
              disabled={tecaBusy}
              title={tecaPaused ? "Reativar Teca IA para esse lead" : "Pausar Teca IA para esse lead (humano assume)"}
              className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 transition ${
                tecaPaused
                  ? "bg-hb-green/15 border-hb-green/50 text-hb-green hover:bg-hb-green/25"
                  : "bg-hb-amber/15 border-hb-amber/50 text-hb-amber hover:bg-hb-amber/25"
              } ${tecaBusy ? "opacity-50 cursor-wait" : ""}`}
            >
              {tecaPaused ? <><Play size={10} /> Reativar Teca</> : <><Pause size={10} /> Pausar Teca</>}
            </button>
          )}
          <button onClick={() => { const m = !muted; setMuted(m); localStorage.setItem("hb-mute", m ? "1" : "0"); }}
            title={muted ? "Ativar som" : "Silenciar"} className="text-hb-textDim hover:text-hb-text">
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <span className="text-[9px] text-hb-textDim flex items-center gap-1 px-1.5 py-0.5 rounded bg-hb-bg border border-hb-border">
            <span className="w-1.5 h-1.5 rounded-full bg-hb-green animate-blink" /> AO VIVO
          </span>
        </div>
      </div>

      {/* Linha de ações do card — mover etapa + atribuir responsável */}
      {cardMeta && (
        <div className="px-3 py-1.5 border-b border-hb-border bg-hb-bg/60">
          <CardActions
            cardId={cardId}
            deptId={cardMeta.dept_id}
            columnId={cardMeta.column_id}
            responsavel={cardMeta.responsavel}
            onChanged={onCardChanged}
            compact
          />
        </div>
      )}

      {/* Histórico Wavoip — toggle pelo botão Calls */}
      {showCalls && (
        <div className="px-3 py-2 border-b border-hb-border bg-hb-amber/5 max-h-[280px] overflow-auto">
          <div className="text-[10px] uppercase tracking-wider font-bold text-hb-amber flex items-center gap-1 mb-2">
            <Phone size={10} /> Histórico de ligações Wavoip
          </div>
          {calls.length === 0 && (
            <div className="text-[10px] text-hb-textDim italic py-2">Nenhuma ligação ainda. Clique em "Ligar" pra iniciar.</div>
          )}
          <div className="space-y-1.5">
            {calls.map(c => (
              <div key={c.id} className="bg-hb-panel border border-hb-border rounded p-2 text-[10px]">
                <div className="flex items-center gap-2 mb-1">
                  {c.direction === "OUTCOMING" ? (
                    <PhoneOutgoing size={11} className="text-hb-blue" />
                  ) : ["REJECTED","FAILED","NOT_ANSWERED","CANCELLED"].includes(c.status) ? (
                    <PhoneOff size={11} className="text-hb-red" />
                  ) : (
                    <PhoneIncoming size={11} className="text-hb-green" />
                  )}
                  <span className="font-semibold text-hb-text">{CALL_STATUS_LABEL[c.status] || c.status}</span>
                  <span className="text-hb-textDim ml-auto">{fmtRelative(c.iniciada_em)}</span>
                </div>
                <div className="flex items-center gap-2 text-hb-textDim tabular">
                  <span>📞 {c.direction === "OUTCOMING" ? c.receiver : c.caller}</span>
                  {c.duration > 0 && <span>· {fmtCallDuration(c.duration)}</span>}
                </div>
                {c.record_url ? (
                  <div className="mt-1.5">
                    <audio controls preload="none" src={c.record_url} className="w-full h-7" />
                    <a href={c.record_url} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] text-hb-blue underline inline-flex items-center gap-1 mt-0.5">
                      <Download size={9} /> Baixar gravação
                    </a>
                  </div>
                ) : c.record_status === "PROCESSING" ? (
                  <div className="mt-1 text-[9px] text-hb-amber italic">Gravação sendo processada…</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2 bg-hb-bg">
        {loading && (
          <div className="text-center text-[11px] text-hb-textDim py-8">
            <Loader2 size={14} className="animate-spin inline mr-1" /> Carregando histórico…
          </div>
        )}
        {!loading && msgs.length === 0 && (
          <div className="text-center text-[11px] text-hb-textDim py-8">
            <MessageSquare size={18} className="mx-auto mb-2 opacity-50" />
            Nenhuma mensagem ainda. Quebre o gelo!
          </div>
        )}
        {msgs.map((m) => <Bubble key={m.id} msg={m} />)}
      </div>

      {/* Composer */}
      <div className="border-t border-hb-border bg-hb-panel p-2 space-y-1.5"
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) sendFile(f, text); }}>
        {error && (
          <div className="text-[10px] text-hb-red bg-hb-red/10 border border-hb-red/30 rounded px-2 py-1 flex items-center gap-1">
            <AlertCircle size={10} /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={10} /></button>
          </div>
        )}
        {recording ? (
          <div className="flex items-center gap-2 bg-hb-red/10 border border-hb-red/40 rounded p-2">
            <span className="w-2 h-2 rounded-full bg-hb-red animate-blink" />
            <span className="text-[11px] text-hb-red font-semibold">Gravando…</span>
            <span className="text-[11px] text-hb-text tabular">{Math.floor(recSeconds/60).toString().padStart(2,"0")}:{(recSeconds%60).toString().padStart(2,"0")}</span>
            <div className="flex-1" />
            <button onClick={cancelRec} className="text-[11px] text-hb-red hover:underline px-2">Cancelar</button>
            <button onClick={stopRec}
              className="bg-hb-accent text-hb-bg font-semibold rounded px-3 py-1 text-[11px] hover:bg-hb-gold transition flex items-center gap-1">
              <Send size={11} /> Enviar
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f, text); }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              title="Anexar arquivo (imagem, PDF, etc — até 16MB)"
              className="text-hb-textDim hover:text-hb-accent p-2.5 disabled:opacity-40">
              <Paperclip size={14} />
            </button>
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
              placeholder="Digite a mensagem · 📎 anexar · 🎤 gravar · arrasta arquivos aqui"
              rows={Math.min(4, Math.max(1, text.split("\n").length))}
              className="flex-1 bg-hb-bg border border-hb-border rounded px-3 py-2 text-xs text-hb-text outline-none focus:border-hb-accent resize-none" />
            {text.trim() ? (
              <button onClick={send} disabled={sending}
                className="bg-hb-accent text-hb-bg font-semibold rounded p-2.5 hover:bg-hb-gold transition disabled:opacity-50 flex items-center justify-center">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            ) : (
              <button onClick={startRec} disabled={uploading}
                title="Gravar áudio (mensagem de voz)"
                className="bg-hb-red/15 border border-hb-red/40 text-hb-red rounded p-2.5 hover:bg-hb-red/25 disabled:opacity-40">
                <Mic size={14} />
              </button>
            )}
          </div>
        )}
        {uploading && (
          <div className="text-[10px] text-hb-textDim flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" /> enviando…
          </div>
        )}
        <div className="text-[9px] text-hb-textDim flex items-center justify-between">
          <span>SDR: <strong className="text-hb-text">{appUser.nome || appUser.email}</strong></span>
          <span className="flex items-center gap-1"><Bot size={9} /> IA só sugere — você envia</span>
        </div>
      </div>
    </div>
    {showCopilot && (
      <div className="shrink-0 relative" style={{ width: copilotWidth }}>
        {/* Drag handle (botão pequeno embutido no meio da borda esquerda) —
            ocupa a beira do painel sem roubar espaço da coluna.
            Visual: pílula vertical 14x44px, ícone de grip, fica sutil até hover. */}
        <button
          onMouseDown={(e) => { e.preventDefault(); setResizing(true); }}
          title="Arrastar pra redimensionar"
          aria-label="Redimensionar painel"
          className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-3.5 h-11 cursor-col-resize flex items-center justify-center border border-hb-border bg-hb-panel hover:bg-hb-accent/20 hover:border-hb-accent transition ${
            resizing ? "bg-hb-accent border-hb-accent" : ""
          }`}
        >
          {/* 2 traços verticais como grip indicator */}
          <div className="flex gap-[2px]">
            <span className={`block w-[1.5px] h-4 ${resizing ? "bg-hb-bg" : "bg-hb-textDim"}`} />
            <span className={`block w-[1.5px] h-4 ${resizing ? "bg-hb-bg" : "bg-hb-textDim"}`} />
          </div>
        </button>
        <CopilotPanel
          cardId={cardId}
          cardCtx={{ card_title: cardTitle, ...cardCtx }}
          messages={msgs.map((m) => ({ direction: m.direction, text: m.text, at: m.created_at }))}
          onPickSuggestion={(t) => { setText(t); }}
          onClose={() => setShowCopilot(false)}
        />
      </div>
    )}
    {callState.status !== "idle" && (
      <CallOverlay state={callState} onEnd={handleEndCall} onToggleMute={handleToggleMute} cardTitle={cardTitle} />
    )}
    </div>
  );
}

function CallOverlay({ state, onEnd, onToggleMute, cardTitle }: {
  state: CallState;
  onEnd: () => void;
  onToggleMute: () => void;
  cardTitle?: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = state.answeredAt
    ? Math.floor((now - state.answeredAt) / 1000)
    : state.startedAt
      ? Math.floor((now - state.startedAt) / 1000)
      : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const STATUS_PT: Record<string, string> = {
    connecting: "Conectando…",
    starting: "Iniciando…",
    ringing: "Tocando…",
    active: "Em ligação",
    ended: "Encerrada",
    failed: "Falhou",
    rejected: "Rejeitada",
  };
  const isLive = ["connecting","starting","ringing","active"].includes(state.status);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[300px] bg-hb-panel border-2 border-hb-green rounded-lg shadow-2xl p-3 animate-pulse-once">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 rounded-full bg-hb-green/15 border border-hb-green/40 text-hb-green flex items-center justify-center text-[11px] font-bold">
          {initials(cardTitle || state.phone || "?")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-hb-text truncate">{cardTitle || state.phone}</div>
          <div className="text-[10px] text-hb-textDim tabular flex items-center gap-1">
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-hb-green animate-blink" />}
            {STATUS_PT[state.status] || state.status} · {mm}:{ss}
          </div>
        </div>
      </div>
      {state.error && (
        <div className="text-[10px] text-hb-red bg-hb-red/10 border border-hb-red/30 rounded p-1.5 mb-2">
          {state.error}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={onToggleMute}
          disabled={!isLive}
          className={`flex-1 text-[10px] py-2 rounded font-semibold inline-flex items-center justify-center gap-1 border ${
            state.muted ? "bg-hb-amber/20 border-hb-amber text-hb-amber" : "border-hb-border text-hb-textDim hover:text-hb-text"
          } disabled:opacity-40 disabled:cursor-not-allowed`}>
          {state.muted ? <Mic size={11} /> : <Volume2 size={11} />}
          {state.muted ? "Desmutar" : "Mute"}
        </button>
        <button onClick={onEnd}
          className="flex-1 text-[10px] py-2 rounded font-semibold inline-flex items-center justify-center gap-1 bg-hb-red text-hb-bg hover:bg-hb-red/90">
          <PhoneOff size={11} /> Desligar
        </button>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: WhatsAppMessage }) {
  const out = msg.direction === "out";
  const err = String(msg.id).endsWith("-err");
  const type = msg.message_type || "conversation";
  const isMedia = type !== "conversation" && type !== "text" && type !== "reactionMessage";
  const mediaUrl = msg.evolution_msg_id
    ? `${AGENTE_URL}/api/hb-whatsapp/media/${encodeURIComponent(msg.evolution_msg_id)}`
    : null;

  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-xs break-words whitespace-pre-wrap ${
        out
          ? err
            ? "bg-hb-red/15 border border-hb-red/40 text-hb-text rounded-br-sm"
            : "bg-hb-accent/15 border border-hb-accent/30 text-hb-text rounded-br-sm"
          : "bg-hb-panel border border-hb-border text-hb-text rounded-bl-sm"
      }`}>
        {/* Render por tipo */}
        {type === "imageMessage" && mediaUrl && (
          <div className="mb-1">
            <img src={mediaUrl} alt="imagem"
              className="rounded-lg max-w-[280px] max-h-[260px] cursor-pointer hover:opacity-90 transition"
              onClick={() => window.open(mediaUrl, "_blank")} />
            <a href={mediaUrl} download
              className="mt-1 inline-flex items-center gap-1 text-[10px] text-hb-textDim hover:text-hb-accent">
              <Download size={10} /> Baixar imagem
            </a>
          </div>
        )}
        {type === "videoMessage" && mediaUrl && (
          <div className="mb-1">
            <video controls className="rounded-lg max-w-[280px] max-h-[260px]" src={mediaUrl} />
            <a href={mediaUrl} download
              className="mt-1 inline-flex items-center gap-1 text-[10px] text-hb-textDim hover:text-hb-accent">
              <Download size={10} /> Baixar vídeo
            </a>
          </div>
        )}
        {type === "audioMessage" && mediaUrl && (
          <div className="mb-1 flex items-center gap-2">
            <audio controls src={mediaUrl} className="h-8 max-w-[260px]" />
            <a href={mediaUrl} download
              title="Baixar áudio"
              className="text-hb-textDim hover:text-hb-accent">
              <Download size={12} />
            </a>
          </div>
        )}
        {type === "documentMessage" && mediaUrl && (
          <a href={mediaUrl} target="_blank" rel="noreferrer" download
            className="flex items-center gap-2 bg-hb-bg/40 rounded p-2 hover:bg-hb-bg/60 mb-1 border border-hb-border">
            <FileText size={16} className="text-hb-accent shrink-0" />
            <span className="text-[11px] flex-1 truncate">{(msg.text || "documento").slice(0, 50)}</span>
            <Download size={11} className="text-hb-textDim" />
          </a>
        )}
        {type === "stickerMessage" && (
          <div className="text-2xl">🏷️ sticker</div>
        )}
        {type === "locationMessage" && (
          <div className="text-xs flex items-center gap-1">📍 localização compartilhada</div>
        )}
        {type === "contactMessage" && (
          <div className="text-xs flex items-center gap-1">👤 contato compartilhado</div>
        )}
        {type === "reactionMessage" && (
          <div className="text-xs italic text-hb-textDim">↩ reagiu: {msg.text}</div>
        )}
        {/* Texto / caption */}
        {(msg.text && type !== "reactionMessage") && (
          <div className={isMedia ? "mt-1" : ""}>
            {msg.text}
          </div>
        )}
        {!msg.text && !isMedia && type !== "reactionMessage" && (
          <div className="text-hb-textDim italic">(sem texto)</div>
        )}
        <div className={`text-[9px] mt-1 tabular ${out ? "text-right" : ""} text-hb-textDim`}
          title={fmtDateTime(msg.created_at)}>
          {err ? "⚠ falha ao enviar · tente de novo" : fmtRelative(msg.created_at)}
        </div>
      </div>
    </div>
  );
}

// Som curto pra notificação de mensagem recebida (sem arquivo externo)
let audioCtx: AudioContext | null = null;
function playBeep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.05, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
    o.start(); o.stop(audioCtx.currentTime + 0.2);
  } catch {}
}
