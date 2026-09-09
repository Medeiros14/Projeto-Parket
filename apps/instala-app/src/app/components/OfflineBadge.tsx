import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, X, AlertTriangle } from "lucide-react";
import { useTheme } from "../../lib/theme-context";
import {
  listQueue, onQueueChange, forceFlush, retryJob, discardJob, jobNeedsAttention,
  type QueuedJob,
} from "../../lib/offline";
import { BOTTOM_NAV_HEIGHT } from "./BottomNav";
import { confirmar } from "../../lib/confirmar";

const FONT_MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

function fmtHora(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Chip discreto acima da bottom nav: "N registros aguardando sinal". Toca pra abrir a fila. */
export function OfflineBadge() {
  const { T, mode } = useTheme();
  const [jobs, setJobs] = useState<QueuedJob[]>([]);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => { listQueue().then((j) => { if (alive) setJobs(j); }); };
    load();
    const off = onQueueChange(load);
    const iv = setInterval(load, 15_000);
    return () => { alive = false; off(); clearInterval(iv); };
  }, []);

  if (jobs.length === 0) return null;

  const nAtencao = jobs.filter(jobNeedsAttention).length;
  const barBg = mode === "light" ? "#EDE9E0" : "#0E0E0E";

  // Agrupa a fila por obra (lane), na mesma ordem em que o flushQueue envia.
  // O nome da obra sai do label dos jobs de chegada/finalizar ("... · CLIENTE");
  // sem esses jobs na fila o grupo fica com o rótulo genérico OBRA.
  const lanes: { key: string; nome: string | null; jobs: QueuedJob[] }[] = [];
  const laneIdx = new Map<string, number>();
  for (const j of jobs) {
    const k = j.obra_id || "_global";
    let i = laneIdx.get(k);
    if (i === undefined) { i = lanes.length; laneIdx.set(k, i); lanes.push({ key: k, nome: null, jobs: [] }); }
    lanes[i].jobs.push(j);
    if (!lanes[i].nome && k !== "_global") {
      const m = /^(?:Chegada na obra|Finalizar dia) [—·] (.+)$/.exec(j.label || "");
      if (m) lanes[i].nome = m[1].toUpperCase();
    }
  }

  async function reenviarTudo() {
    setSending(true);
    try { await forceFlush(); } finally { setSending(false); }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom) + 10px)`,
          zIndex: 45, cursor: "pointer",
          background: nAtencao > 0 ? "#7c2d12" : barBg,
          color: nAtencao > 0 ? "#fdba74" : T.textPrimary,
          border: `1.5px solid ${nAtencao > 0 ? "#fb923c" : T.textPrimary}`,
          padding: "8px 14px", display: "flex", alignItems: "center", gap: 8,
          fontSize: 10, letterSpacing: "0.08em", fontWeight: 600, fontFamily: FONT_MONO,
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)", whiteSpace: "nowrap",
        }}
      >
        {nAtencao > 0 ? <AlertTriangle size={13} /> : <CloudOff size={13} />}
        {nAtencao > 0
          ? `${nAtencao} REGISTRO${nAtencao > 1 ? "S" : ""} PRECISA${nAtencao > 1 ? "M" : ""} DE ATENÇÃO`
          : `${jobs.length} REGISTRO${jobs.length > 1 ? "S" : ""} AGUARDANDO SINAL`}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxHeight: "72vh", overflowY: "auto",
              background: T.bg, borderTop: `3px solid ${T.textPrimary}`,
              padding: `18px 20px calc(20px + env(safe-area-inset-bottom))`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <p style={{ flex: 1, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, fontFamily: FONT_MONO }}>
                FILA DE ENVIO · {jobs.length}
              </p>
              <button onClick={() => setOpen(false)} aria-label="Fechar" style={{
                background: "transparent", border: `1px solid ${T.border}`, color: T.textSecondary,
                width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}>
                <X size={14} />
              </button>
            </div>
            <p style={{ fontSize: 11, color: T.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
              Nada aqui se perde — tudo salvo no aparelho e enviado sozinho quando pegar sinal.
            </p>

            <button onClick={reenviarTudo} disabled={sending || !navigator.onLine} style={{
              width: "100%", padding: "13px 16px", marginBottom: 14,
              background: T.textPrimary, color: T.bg, border: "none",
              fontSize: 11, letterSpacing: "0.18em", fontWeight: 700, fontFamily: FONT_MONO,
              cursor: sending ? "wait" : "pointer", opacity: sending || !navigator.onLine ? 0.6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <RefreshCw size={13} className={sending ? "spin" : ""} />
              {navigator.onLine ? "REENVIAR TUDO AGORA" : "SEM SINAL AGORA"}
            </button>

            {/* Agrupado por obra (lane): o flushQueue envia em ordem por obra e um
                job travado segura os seguintes da MESMA obra (offline.ts). A lista
                espelha isso: separador por obra + aviso "esperando o de cima". */}
            <div style={{ display: "grid", gap: 16 }}>
              {lanes.map((lane) => {
                // Depois do primeiro job travado da lane, os seguintes ficam bloqueados
                let travadoAcima = false;
                return (
                  <div key={lane.key} style={{ display: "grid", gap: 8 }}>
                    {lanes.length > 1 && (
                      <p style={{ fontSize: 9, letterSpacing: "0.2em", color: T.textMuted, fontFamily: FONT_MONO }}>
                        {lane.nome ?? (lane.key === "_global" ? "OUTROS ENVIOS" : "OBRA")} · {lane.jobs.length}
                      </p>
                    )}
                    {lane.jobs.map((job) => {
                      const atencao = jobNeedsAttention(job);
                      const bloqueado = travadoAcima && !atencao;
                      if (atencao) travadoAcima = true;
                      return (
                        <div key={job.client_key} style={{
                          border: `1px solid ${atencao ? "#fb923c66" : T.border}`,
                          background: atencao ? "#fb923c0d" : T.cardBg,
                          padding: "10px 12px",
                          opacity: bloqueado ? 0.75 : 1,
                        }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, lineHeight: 1.4 }}>
                                {job.label}
                              </p>
                              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>
                                criado às {fmtHora(job.created_at)}
                                {(job.attempts ?? 0) > 0 && ` · ${job.attempts} tentativa${(job.attempts ?? 0) > 1 ? "s" : ""}`}
                              </p>
                              {atencao && (
                                <p style={{ fontSize: 10.5, color: "#fb923c", marginTop: 4, lineHeight: 1.4 }}>
                                  <AlertTriangle size={10} style={{ verticalAlign: "-1px", marginRight: 4 }} />
                                  {job.status === "attention"
                                    ? (job.last_error || "O servidor recusou esse envio. Chame a gestão.")
                                    : "Muitas tentativas sem sucesso. Verifique o sinal ou chame a gestão."}
                                </p>
                              )}
                              {bloqueado && (
                                <p style={{ fontSize: 10.5, color: T.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                                  Esperando o registro travado acima ser resolvido; a ordem dos envios da obra é garantida.
                                </p>
                              )}
                            </div>
                            {/* Job normal: só o botãozinho de reenviar. Bloqueado: nada
                                (reenviar não ajuda enquanto o de cima segura a lane). */}
                            {!atencao && !bloqueado && (
                              <button onClick={() => retryJob(job.client_key)} aria-label="Reenviar" style={{
                                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                                background: "transparent", border: `1px solid ${T.borderHover}`, color: T.textSecondary, cursor: "pointer",
                              }}>
                                <RefreshCw size={13} />
                              </button>
                            )}
                          </div>
                          {/* Job travado: decisão importante = 2 botões grandes, sem ícone miúdo */}
                          {atencao && (
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <button onClick={() => retryJob(job.client_key)} style={{
                                flex: 1, padding: "12px 10px",
                                background: T.textPrimary, color: T.bg, border: "none",
                                fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, fontFamily: FONT_MONO,
                                cursor: "pointer",
                              }}>
                                TENTAR DE NOVO
                              </button>
                              <button
                                onClick={async () => {
                                  if (await confirmar("Descartar esse registro? Ele NÃO foi enviado e vai se perder de vez. Depois refaça o registro na obra.", "Sim, descartar", "#ef4444")) {
                                    discardJob(job.client_key);
                                  }
                                }}
                                style={{
                                  flex: 1, padding: "12px 10px",
                                  background: "transparent", color: "#ef4444", border: "1px solid #ef4444",
                                  fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, fontFamily: FONT_MONO,
                                  cursor: "pointer",
                                }}
                              >
                                DESCARTAR E REFAZER
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
