/** Substitui confirm()/prompt() nativos — browsers podem suprimi-los e o clique morre em silêncio. */
import { useState } from "react";
import { useTheme } from "../hooks/useTheme";

type Props = {
  titulo: string;
  mensagem?: React.ReactNode;
  cor?: string;
  confirmLabel?: string;
  aviso?: boolean;
  input?: { label: string; placeholder?: string };
  onConfirm?: (valor: string) => void | Promise<void>;
  onClose: () => void;
};

export default function Dialogo({ titulo, mensagem, cor, confirmLabel, aviso, input, onConfirm, onClose }: Props) {
  const { t } = useTheme();
  const [valor, setValor] = useState("");
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState("");
  const corAcao = cor || t.accent;

  async function confirmar() {
    if (!onConfirm) { onClose(); return; }
    setRodando(true);
    setErro("");
    try {
      await onConfirm(valor);
      onClose();
    } catch (e: any) {
      setErro("Falha: " + (e?.message || e));
      setRodando(false);
    }
  }

  const btn: React.CSSProperties = { flex: 1, padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" };

  return (
    <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 120, display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: 400, maxWidth: "100%", background: t.modalBg, border: `1px solid ${t.borderStrong}`, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: corAcao }}>{titulo}</div>
        {mensagem && <div style={{ fontSize: 12.5, color: t.textPrimary, lineHeight: 1.5 }}>{mensagem}</div>}
        {input && (
          <div>
            <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textSecondary, marginBottom: 4, display: "block" }}>
              {input.label}
            </label>
            <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)} placeholder={input.placeholder}
                   onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
                   style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%", boxSizing: "border-box" }} />
          </div>
        )}
        {erro && <div style={{ fontSize: 12, color: t.danger }}>{erro}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          {aviso ? (
            <button onClick={onClose} style={{ ...btn, background: corAcao, color: t.bg, border: "none" }}>Entendi</button>
          ) : (
            <>
              <button onClick={onClose} disabled={rodando}
                      style={{ ...btn, background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}` }}>
                Cancelar
              </button>
              <button onClick={confirmar} disabled={rodando}
                      style={{ ...btn, background: corAcao, color: t.bg, border: "none", opacity: rodando ? 0.6 : 1 }}>
                {rodando ? "Aguarde…" : confirmLabel || "Confirmar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
