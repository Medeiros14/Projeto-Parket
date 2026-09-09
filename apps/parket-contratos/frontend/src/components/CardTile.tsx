import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTokens, fonts, ACCENT, STATUS_COLOR } from "../theme";
import type { BoardRow } from "../lib/api";

export function CardTile({ row, dragging, onDragStart, onDragEnd }: {
  row: BoardRow;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const T = useTokens();
  const nav = useNavigate();
  const [hover, setHover] = useState(false);
  const { card, contrato, simulacao } = row;

  const c = (simulacao?.meta as any)?.contrato_cliente || {};
  const clienteNome = c.nome || simulacao?.cliente || card.title || "sem cliente";
  const vendedor    = card.responsavel || simulacao?.vendedor || (card.details as any)?.vendedor;
  const numero      = simulacao?.numero;
  const valorText   = card.value || "";
  const status      = contrato?.status || "rascunho";
  const statusColor = STATUS_COLOR[status] || ACCENT.chai;

  const signers = (contrato?.last_event as any)?.signers as any[] | undefined;
  const totalSigners = signers?.length || 0;
  const doneSigners  = signers?.filter((s) => (s.status || "").toLowerCase() === "completed").length || 0;

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("card_id", card.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => nav(`/card/${card.id}`)}
      style={{
        background: hover ? T.cardHover : T.cardBg,
        border: `1px solid ${hover ? T.borderHover : T.border}`,
        padding: 14, cursor: "pointer",
        opacity: dragging ? 0.4 : 1,
        transition: "background 0.15s, border-color 0.15s, opacity 0.15s",
        fontFamily: fonts.inter,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.08em", color: T.textPrimary, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {clienteNome}
          </div>
          {numero && (
            <div style={{ fontSize: 8, letterSpacing: "0.20em", color: T.textMuted, textTransform: "uppercase", marginTop: 2 }}>
              proposta #{numero}
            </div>
          )}
        </div>
        <span style={{
          background: statusColor, color: T.bg,
          padding: "2px 6px", fontSize: 8, letterSpacing: "0.10em",
          textTransform: "uppercase", fontWeight: 600, borderRadius: 2, whiteSpace: "nowrap",
        }}>{status}</span>
      </div>

      <div style={{ fontSize: 10, color: T.textSecondary, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
        {vendedor && (
          <div>
            <div style={{ fontSize: 7, letterSpacing: "0.22em", color: T.textMuted, textTransform: "uppercase" }}>vendedor</div>
            <div style={{ color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vendedor}</div>
          </div>
        )}
        {valorText && (
          <div>
            <div style={{ fontSize: 7, letterSpacing: "0.22em", color: T.textMuted, textTransform: "uppercase" }}>valor</div>
            <div style={{ color: T.textPrimary }}>{valorText}</div>
          </div>
        )}
        {c.cidade && c.uf && (
          <div>
            <div style={{ fontSize: 7, letterSpacing: "0.22em", color: T.textMuted, textTransform: "uppercase" }}>local</div>
            <div style={{ color: T.textPrimary }}>{c.cidade}/{c.uf}</div>
          </div>
        )}
        {(c.arquiteto_nome || row.simulacao?.arquiteto) && (
          <div>
            <div style={{ fontSize: 7, letterSpacing: "0.22em", color: T.textMuted, textTransform: "uppercase" }}>arquiteto{c.arquiteto_rt_pct ? ` · RT ${c.arquiteto_rt_pct}%` : ""}</div>
            <div style={{ color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.arquiteto_nome || row.simulacao?.arquiteto}
            </div>
          </div>
        )}
        {contrato?.sent_at && (
          <div>
            <div style={{ fontSize: 7, letterSpacing: "0.22em", color: T.textMuted, textTransform: "uppercase" }}>enviado</div>
            <div style={{ color: T.textPrimary, fontSize: 10 }}>
              {new Date(contrato.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </div>
          </div>
        )}
      </div>

      {totalSigners > 0 && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, height: 3, background: T.border, position: "relative" }}>
            <div style={{
              position: "absolute", left: 0, top: 0, height: "100%",
              width: `${(doneSigners / totalSigners) * 100}%`,
              background: statusColor, transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontSize: 8, color: T.textSecondary, letterSpacing: "0.14em" }}>
            {doneSigners}/{totalSigners}
          </span>
        </div>
      )}
    </div>
  );
}
