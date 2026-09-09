/**
 * AssignNotifications — toasts no canto inferior direito quando um lead
 * é atribuído ao usuário logado (responsavel troca pra ele).
 *
 * Escuta realtime em kanban_cards (UPDATE) — quando o responsavel muda pra
 * algum nome que matcha o appUser.nome (case-insensitive, primeiro nome),
 * mostra popup com info básica.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, X, User as UserIcon, Volume2, VolumeX } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { AppUser } from "../lib/auth";
import { fmtBRLCompact, fmtIntCompact, parseValueText } from "../lib/format";
import { playSound, isMuted as isGlobalMuted, setMuted as setGlobalMuted } from "../lib/sound";

type Toast = {
  id: string;
  cardId: string;
  cardTitle: string;
  produto: string;
  metragem: number;
  valorMesa: number;
  responsavel: string;
  at: number;
};

function nomesParaMatch(appUser: AppUser): string[] {
  const out = new Set<string>();
  const add = (s: string | null | undefined) => {
    if (!s) return;
    const cleaned = s.trim().toLowerCase();
    if (!cleaned) return;
    out.add(cleaned);
    const primeiro = cleaned.split(/\s+/)[0];
    if (primeiro) out.add(primeiro);
  };
  add(appUser.nome);
  add(appUser.email?.split("@")[0]);
  return [...out];
}

function matchaResponsavel(novoResp: string | null | undefined, meusNomes: string[]): boolean {
  if (!novoResp) return false;
  const r = String(novoResp).toLowerCase().trim();
  if (!r) return false;
  return meusNomes.some((n) => r === n || r.startsWith(n + " ") || r.includes(" " + n));
}

export function AssignNotifications({ appUser }: { appUser: AppUser }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [muted, setMuted] = useState(() => isGlobalMuted());
  const meusNomesRef = useRef<string[]>(nomesParaMatch(appUser));

  useEffect(() => {
    meusNomesRef.current = nomesParaMatch(appUser);
  }, [appUser]);

  useEffect(() => {
    const ch = supabase
      .channel("hb-assign-notify")
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "kanban_cards" },
        (payload: any) => {
          const oldRow = payload.old || {};
          const newRow = payload.new || {};
          const newResp = newRow.responsavel;
          const oldResp = oldRow.responsavel;
          if (newResp === oldResp) return;            // não mudou responsável
          if (!matchaResponsavel(newResp, meusNomesRef.current)) return;
          // Atribuído pra mim! Cria toast
          const det = (newRow.details || {}) as any;
          const metragem = Number(det.metragem_estimada || det.area_m2 || 0) || 0;
          const valor = parseValueText(newRow.value) ||
            parseValueText(det.investimento) || parseValueText(det.orcamento) || 0;
          const toast: Toast = {
            id: `${newRow.id}-${Date.now()}`,
            cardId: newRow.id,
            cardTitle: newRow.title || newRow.id?.slice(0, 8) || "Novo lead",
            produto: String(det.produto_interesse || newRow.subtitle || "—").slice(0, 60),
            metragem,
            valorMesa: valor,
            responsavel: String(newResp),
            at: Date.now(),
          };
          setToasts((arr) => [toast, ...arr].slice(0, 5));
          playSound("atribuicao");
          // auto-dismiss após 15s
          setTimeout(() => {
            setToasts((arr) => arr.filter((t) => t.id !== toast.id));
          }, 15000);
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "kanban_cards" },
        (payload: any) => {
          const newRow = payload.new || {};
          if (!matchaResponsavel(newRow.responsavel, meusNomesRef.current)) return;
          // Card criado já atribuído a mim
          const det = (newRow.details || {}) as any;
          const metragem = Number(det.metragem_estimada || det.area_m2 || 0) || 0;
          const valor = parseValueText(newRow.value) ||
            parseValueText(det.investimento) || parseValueText(det.orcamento) || 0;
          const toast: Toast = {
            id: `${newRow.id}-${Date.now()}`,
            cardId: newRow.id,
            cardTitle: newRow.title || "Novo lead",
            produto: String(det.produto_interesse || newRow.subtitle || "—").slice(0, 60),
            metragem,
            valorMesa: valor,
            responsavel: String(newRow.responsavel || ""),
            at: Date.now(),
          };
          setToasts((arr) => [toast, ...arr].slice(0, 5));
          playSound("atribuicao");
          setTimeout(() => {
            setToasts((arr) => arr.filter((t) => t.id !== toast.id));
          }, 15000);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [muted]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 max-w-xs">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t}
          muted={muted}
          onToggleMute={() => { const m = !muted; setMuted(m); setGlobalMuted(m); }}
          onClose={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))} />
      ))}
    </div>
  );
}

function ToastCard({ toast, muted, onToggleMute, onClose }: {
  toast: Toast; muted: boolean; onToggleMute: () => void; onClose: () => void;
}) {
  return (
    <div className="bg-hb-panel border border-hb-accent rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2"
      style={{ boxShadow: "0 8px 24px rgba(150,132,115,0.30)" }}> {/* Chai */}
      <div className="bg-hb-accent text-hb-bg px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          <Bell size={11} /> Novo lead pra você
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggleMute} title={muted ? "Ativar som" : "Silenciar"}
            className="opacity-70 hover:opacity-100">
            {muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
          </button>
          <button onClick={onClose} className="opacity-70 hover:opacity-100">
            <X size={11} />
          </button>
        </div>
      </div>
      <Link to={`/card/${toast.cardId}`} onClick={onClose} className="block p-3 hover:bg-hb-panelLight">
        <div className="text-sm font-bold text-hb-text mb-1.5 leading-tight">{toast.cardTitle}</div>
        <div className="space-y-1 text-[10px]">
          {toast.produto !== "—" && (
            <div className="flex items-start gap-1.5">
              <span className="text-hb-textDim uppercase tracking-wider font-semibold w-16 shrink-0">Produto</span>
              <span className="text-hb-text">{toast.produto}</span>
            </div>
          )}
          {toast.metragem > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-hb-textDim uppercase tracking-wider font-semibold w-16 shrink-0">Metragem</span>
              <span className="text-hb-text font-semibold">{fmtIntCompact(toast.metragem)} m²</span>
            </div>
          )}
          {toast.valorMesa > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-hb-textDim uppercase tracking-wider font-semibold w-16 shrink-0">Valor mesa</span>
              <span className="text-hb-gold font-bold">{fmtBRLCompact(toast.valorMesa)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 pt-1 border-t border-hb-border mt-1.5">
            <UserIcon size={9} className="text-hb-textDim" />
            <span className="text-hb-textDim">atribuído a <strong className="text-hb-text">{toast.responsavel}</strong></span>
          </div>
        </div>
        <div className="text-[10px] text-hb-accent font-bold mt-2 text-center uppercase tracking-wider">
          Clique pra abrir →
        </div>
      </Link>
    </div>
  );
}
