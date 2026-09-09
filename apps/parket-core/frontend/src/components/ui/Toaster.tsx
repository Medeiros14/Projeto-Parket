import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { subscribeToasts } from "../../lib/toast";

export function Toaster() {
  const [toasts, setToasts] = useState<{ id: string; type: string; message: string }[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const styles = {
          success: { icon: CheckCircle2, color: "#34D399", bg: "#022C22" },
          error: { icon: XCircle, color: "#F87171", bg: "#3F1D1D" },
          info: { icon: Info, color: "#60A5FA", bg: "#1E3A8A" },
        }[t.type] || { icon: Info, color: "#60A5FA", bg: "#1E3A8A" };
        const Icon = styles.icon;
        return (
          <div
            key={t.id}
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-parket-border shadow-lg animate-in slide-in-from-right text-xs"
            style={{ background: styles.bg, color: "#fff" }}
          >
            <Icon size={14} style={{ color: styles.color, flexShrink: 0, marginTop: 1 }} />
            <span className="leading-relaxed">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
