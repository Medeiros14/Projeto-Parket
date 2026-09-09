import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open, onClose, title, children, size = "md", footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Fundo SÓLIDO (--parket-bg), não bg-parket-panel: o panel é rgba quase
          transparente e, em cima do overlay preto/70, virava "fundo escuro com
          letra escura" no tema light — zero contraste (Will 28/08). */}
      <div
        className={`w-full ${widths[size]} max-h-[90vh] flex flex-col bg-parket-bg text-parket-text border border-parket-borderHover rounded-xl shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-parket-border">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-parket-panelLight text-parket-textDim hover:text-parket-text"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-parket-border flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = "Confirmar", danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-parket-border text-parket-text/80 hover:bg-parket-panelLight"
          >
            Cancelar
          </button>
          <button
            onClick={async () => { await onConfirm(); onClose(); }}
            className={`px-3 py-1.5 text-xs rounded font-semibold ${
              danger
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-parket-accent text-parket-bg hover:bg-parket-accentDark"
            }`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-xs text-parket-text/80 leading-relaxed">{message}</p>
    </Modal>
  );
}
