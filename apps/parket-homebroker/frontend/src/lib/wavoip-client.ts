/**
 * Wavoip client wrapper — usa @wavoip/wavoip-api v2 (WebRTC).
 *
 * O SDK v2 conecta sozinho a partir do construtor com `{ tokens: [...] }` e expõe
 * uma API limpa baseada em eventos (`peerAccept`, `peerReject`, `unanswered`,
 * `ended`). O v1 antigo (pacote `wavoip-api`) é o que pendurava em "iniciando"
 * sem signaling — abandonado aqui.
 *
 * Webhook do servidor Wavoip continua gravando em `public.wavoip_calls`,
 * histórico realtime aparece no botão "Calls (N)" do header do ChatPanel.
 */
import { Wavoip } from "@wavoip/wavoip-api";

const WAVOIP_API = "https://core.parket.works";

export type CallStatus =
  | "idle"
  | "connecting"      // resolvendo token + abrindo socket
  | "starting"        // startCall em voo
  | "ringing"         // tocando no destinatário
  | "active"          // atendida
  | "ended"           // encerrada normalmente
  | "failed"          // erro técnico
  | "rejected";       // destinatário rejeitou (ou não atendeu)

export type CallState = {
  status: CallStatus;
  phone: string | null;
  startedAt: number | null;     // ms (Date.now)
  answeredAt: number | null;
  endedAt: number | null;
  muted: boolean;
  error: string | null;
};

type Listener = (s: CallState) => void;

class WavoipClient {
  private wavoip: Wavoip | null = null;
  private deviceToken: string | null = null;
  private connecting: Promise<void> | null = null;

  private outgoing: any = null;       // CallOutgoing
  private active: any = null;         // CallActive
  private unsubs: Array<() => void> = [];

  private listeners = new Set<Listener>();
  private state: CallState = {
    status: "idle",
    phone: null,
    startedAt: null,
    answeredAt: null,
    endedAt: null,
    muted: false,
    error: null,
  };

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => { this.listeners.delete(fn); };
  }

  private setState(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  private clearCallSubs() {
    for (const u of this.unsubs) { try { u(); } catch { /* ignore */ } }
    this.unsubs = [];
  }

  /** Garante que temos token + instância Wavoip viva. Idempotente. */
  private async ensureReady(): Promise<void> {
    if (this.wavoip) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      try {
        if (!this.deviceToken) {
          const r = await fetch(`${WAVOIP_API}/api/wavoip/config`);
          const cfg = await r.json();
          if (!r.ok || !cfg.device_token) {
            throw new Error(cfg.detail || "config indisponível");
          }
          this.deviceToken = cfg.device_token as string;
        }
        // SDK v2: o construtor já abre socket pra cada token
        this.wavoip = new Wavoip({ tokens: [this.deviceToken], platform: "homebroker-parket" });
      } finally {
        this.connecting = null;
      }
    })();
    return this.connecting;
  }

  /**
   * Acorda o dispositivo se estiver hibernando e espera ele entrar em "open"/"UP".
   * Tem que ser chamado DEPOIS de ensureReady e ANTES de cada startCall, porque
   * o servidor Wavoip dorme dispositivos inativos depois de ~2,5 min e responde
   * 503 device_not_running se você tentar discar sem acordar antes.
   */
  private async wakeUpAndWaitOpen(timeoutMs: number): Promise<void> {
    if (!this.wavoip) return;
    const devs = this.wavoip.getDevices();
    const dev = devs[0];
    if (!dev) return;

    const ready = (s: string) => s === "open" || s === "UP";
    if (ready(dev.status as any)) return;

    // Dispara wake-up sem aguardar — o servidor pode demorar; vamos escutar status.
    try {
      const waiters = this.wavoip.wakeUpDevices([this.deviceToken!]);
      if (Array.isArray(waiters)) {
        // não bloqueia mais que timeoutMs/2 esperando o wake
        Promise.race([
          Promise.allSettled(waiters),
          new Promise((r) => setTimeout(r, Math.floor(timeoutMs / 2))),
        ]).catch(() => {});
      }
    } catch (e) {
      console.warn("[wavoip] wakeUpDevices fail:", e);
    }

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => {
        try { unsub(); } catch {}
        const st = String(dev.status || "disconnected");
        const explain =
          st === "connecting" ? "Wavoip está aguardando o WhatsApp do Comercial escanear o QR code. Avisa o time."
          : st === "close" ? "Wavoip está conectado mas sem WhatsApp pareado."
          : st === "WAITING_PAYMENT" ? "Conta Wavoip aguardando pagamento."
          : st === "disconnected" ? "Wavoip está fora do ar ou device foi desconectado do WhatsApp."
          : `device em estado '${st}'.`;
        reject(new Error(`Não foi possível discar — ${explain}`));
      }, timeoutMs);
      const unsub = dev.on("statusChanged", (st: any) => {
        if (ready(st)) { clearTimeout(t); try { unsub(); } catch {} resolve(); }
      });
    });
  }

  /** Inicia ligação. phone aceita 5511..., +5511..., 11... — normaliza pra E.164. */
  async startCall(phone: string): Promise<void> {
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length < 10) throw new Error("telefone inválido");
    const e164 = "+" + (digits.startsWith("55") ? digits : "55" + digits);

    this.clearCallSubs();
    this.setState({
      status: "connecting",
      phone: e164,
      startedAt: Date.now(),
      answeredAt: null,
      endedAt: null,
      error: null,
      muted: false,
    });

    try {
      // Pede permissão de microfone ANTES do SDK — o SDK falha silenciosamente
      // se o browser bloqueou. Erro aqui é o mais comum.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop()); // libera (SDK abrirá o dele)
      } catch (mediaErr: any) {
        const name = mediaErr?.name || "MediaError";
        const explain =
          name === "NotAllowedError" ? "Permissão de microfone negada. Libere nas configurações do site (cadeado da URL → Microfone → Permitir)."
          : name === "NotFoundError" ? "Nenhum microfone detectado. Conecte um e tente novamente."
          : name === "NotReadableError" ? "Microfone em uso por outro app. Feche Zoom/Meet/etc."
          : `Falha no microfone: ${mediaErr?.message || name}`;
        this.setState({ status: "failed", error: explain, endedAt: Date.now() });
        throw new Error(explain);
      }

      await this.ensureReady();
      if (!this.wavoip) throw new Error("Wavoip não inicializado");
      // Acorda o device se estiver hibernando — Wavoip dorme após ~2,5min
      // e responde 503 device_not_running se discar direto.
      await this.wakeUpAndWaitOpen(15000);
      this.setState({ status: "starting" });
      const { call, err } = await this.wavoip.startCall({ to: e164 });
      if (err || !call) {
        // Sempre dump completo no console pra debug
        console.error("[wavoip] startCall err detalhe:", err);
        const devs = (err as any)?.devices || [];
        const reasons = devs.map((d: any) => `device ${(d.token || "?").slice(0, 8)}: ${d.reason || d.err || "?"}`).join(" | ");
        const msg = reasons
          ? `${err?.message || "Falha"} → ${reasons}`
          : (err?.message || "falha ao iniciar chamada");
        this.setState({ status: "failed", error: msg, endedAt: Date.now() });
        throw new Error(msg);
      }
      this.outgoing = call;
      this.setState({ status: "ringing" });

      // Eventos do CallOutgoing
      this.unsubs.push(call.on("peerAccept", (active: any) => {
        this.active = active;
        this.outgoing = null;
        this.setState({ status: "active", answeredAt: Date.now() });
        // Eventos do CallActive
        this.unsubs.push(active.on("ended", () => {
          this.setState({ status: "ended", endedAt: Date.now() });
          this.active = null;
        }));
        this.unsubs.push(active.on("error", (e: string) => {
          this.setState({ error: e });
        }));
      }));
      this.unsubs.push(call.on("peerReject", () => {
        this.setState({ status: "rejected", endedAt: Date.now() });
        this.outgoing = null;
      }));
      this.unsubs.push(call.on("unanswered", () => {
        this.setState({ status: "rejected", endedAt: Date.now(), error: "Não atendeu" });
        this.outgoing = null;
      }));
      this.unsubs.push(call.on("ended", () => {
        // ended antes de atender (ex: dispositivo encerrou)
        if (this.state.status === "ringing" || this.state.status === "starting") {
          this.setState({ status: "ended", endedAt: Date.now() });
        }
        this.outgoing = null;
      }));
    } catch (e: any) {
      console.error("[wavoip] startCall fail:", e);
      this.setState({ status: "failed", error: e?.message || String(e), endedAt: Date.now() });
      throw e;
    }
  }

  async endCall(): Promise<void> {
    try {
      if (this.active) await this.active.end();
      else if (this.outgoing) await this.outgoing.end();
    } catch (e) {
      console.warn("[wavoip] endCall fail:", e);
    }
    this.clearCallSubs();
    this.active = null;
    this.outgoing = null;
    this.setState({ status: "ended", endedAt: Date.now() });
  }

  async setMute(mute: boolean): Promise<void> {
    const target = this.active || this.outgoing;
    if (!target) return;
    try {
      const res = mute ? await target.mute() : await target.unmute();
      if (res?.err) {
        console.warn("[wavoip] mute err:", res.err);
        return;
      }
      this.setState({ muted: mute });
    } catch (e) {
      console.warn("[wavoip] mute fail:", e);
    }
  }

  reset() {
    this.clearCallSubs();
    this.active = null;
    this.outgoing = null;
    this.setState({
      status: "idle",
      phone: null,
      startedAt: null,
      answeredAt: null,
      endedAt: null,
      error: null,
      muted: false,
    });
  }
}

export const wavoip = new WavoipClient();
