import { MapPin, ChevronRight } from "lucide-react";
import { EnderecoAcoes } from "./EnderecoAcoes";

const FONT_BODY = "'Inter', sans-serif";

export type ObraDoDia = {
  atribuicao_id: string;
  card_id: string;
  obra_code: string;
  cliente_nome: string;
  cidade: string | null;
  data_prevista_inicio: string;
  hora_prevista_inicio: string | null;
  presenca_status: string | null;
  progress_atual: number | null;
  atribuicao_status: string | null;
  observacao?: string | null;
  endereco?: string | null;
  arquiteto?: string | null;
  fiscal?: string | null;
};

const COR_ATRASADA = "#b3421a";

export function ObraCard({ obra, funcao, T, highlight, onClick, actionLabel, overdue, diasAtraso }: {
  obra: ObraDoDia; funcao: string | null; T: any;
  highlight?: boolean; onClick?: () => void; actionLabel?: string;
  overdue?: boolean; diasAtraso?: number;
}) {
  const data = new Date(obra.data_prevista_inicio + "T00:00:00");
  const dataStr = data.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const clickable = !!onClick;
  return (
    <div onClick={onClick}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = T.cardHover; } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = T.cardBg; } : undefined}
      style={{
        textAlign: "left",
        border: `1px solid ${overdue ? COR_ATRASADA : (highlight ? T.borderHover : T.border)}`,
        borderLeft: overdue ? `4px solid ${COR_ATRASADA}` : (highlight ? `1px solid ${T.borderHover}` : `1px solid ${T.border}`),
        background: T.cardBg, padding: "16px 18px", cursor: clickable ? "pointer" : "default",
        fontFamily: FONT_BODY, color: T.textPrimary, transition: "background .2s, border .2s",
        display: "flex", alignItems: "center", gap: 14,
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {overdue && (
          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontSize: 8, letterSpacing: "0.18em", padding: "3px 7px",
              background: COR_ATRASADA, color: "#fff", fontFamily: "'IBM Plex Mono', monospace",
            }}>
              ATRASADA{diasAtraso != null && diasAtraso > 0 ? ` · ${diasAtraso} DIA${diasAtraso === 1 ? "" : "S"}` : ""}
            </span>
          </div>
        )}
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: overdue ? COR_ATRASADA : T.textMuted, marginBottom: 6, textTransform: "uppercase" }}>
          {dataStr}{obra.hora_prevista_inicio && <> · {obra.hora_prevista_inicio.slice(0, 5)}</>}
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: T.textPrimary, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {obra.cliente_nome}
        </div>
        {funcao && (
          <div style={{ fontSize: 10, letterSpacing: "0.14em", color: T.textMuted, marginBottom: 4, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {funcao}
          </div>
        )}
        {(obra.endereco || obra.cidade) && (
          <div style={{ fontSize: 11, color: T.textSecondary, display: "flex", gap: 6, marginBottom: 4 }}>
            <MapPin size={10} style={{ flexShrink: 0, marginTop: 3 }} />
            <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", wordBreak: "break-word", lineHeight: 1.4 }}>
              {obra.endereco || obra.cidade}
            </span>
          </div>
        )}
        {/* Ações Maps/Waze/Copiar quando há endereço de verdade (não só cidade) */}
        {obra.endereco && <div style={{ marginBottom: 4 }}><EnderecoAcoes endereco={obra.endereco} T={T} /></div>}
        <div style={{ fontSize: 10, color: T.textSecondary, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {obra.arquiteto && (
            <span style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ color: T.textMuted }}>ARQ · </span>{obra.arquiteto}
            </span>
          )}
          {obra.fiscal && (
            <span style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ color: T.textMuted }}>FISCAL · </span>{obra.fiscal}
            </span>
          )}
          {obra.progress_atual != null && (
            <span style={{ marginLeft: "auto", padding: "2px 8px", background: T.statBg, fontSize: 10, letterSpacing: "0.1em", border: `1px solid ${T.border}` }}>
              {obra.progress_atual}%
            </span>
          )}
        </div>
        {actionLabel && (
          <div style={{ marginTop: 10, padding: "6px 10px", background: T.textPrimary, color: T.bg, fontSize: 10, letterSpacing: "0.2em", display: "inline-block" }}>
            {actionLabel}
          </div>
        )}
      </div>
      {clickable && <ChevronRight size={16} style={{ color: T.textMuted }} />}
    </div>
  );
}
