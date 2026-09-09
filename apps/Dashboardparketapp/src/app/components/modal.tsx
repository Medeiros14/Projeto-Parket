/* ═══ Modal — Componente compartilhado de dialog/formulário ═══ */
import React from "react";
import { X } from "lucide-react";
import { BORDER } from "./dept-layout";

const DARK_BG = "#0e0e0e";
const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: "0.75rem",
  color: "white",
  outline: "none",
  boxSizing: "border-box",
};

/* ── Modal wrapper ── */
export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: DARK_BG, border: `1px solid ${BORDER}`, maxHeight: "90vh", overflowY: "auto" }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white" style={{ fontSize: "0.9rem", fontWeight: 600 }}>{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── FormField ── */
export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label style={{ display: "block", fontSize: "0.58rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Input ── */
export function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input style={inputBase} {...props} />;
}

/* ── Select ── */
export function FSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select style={{ ...inputBase, cursor: "pointer" }} {...props} />
  );
}

/* ── Textarea ── */
export function FTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea style={{ ...inputBase, resize: "vertical", minHeight: 72 }} {...props} />;
}

/* ── Btn ── */
export function Btn({
  children, onClick, color = "#10B981", disabled, type = "button", fullWidth, variant = "fill",
}: {
  children: React.ReactNode; onClick?: () => void; color?: string;
  disabled?: boolean; type?: "button" | "submit"; fullWidth?: boolean;
  variant?: "fill" | "ghost";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? "100%" : undefined,
        background: disabled ? "rgba(255,255,255,0.04)" : variant === "fill" ? `${color}22` : "transparent",
        color: disabled ? "rgba(255,255,255,0.25)" : color,
        border: `1px solid ${disabled ? "rgba(255,255,255,0.07)" : `${color}40`}`,
        borderRadius: 8,
        padding: "8px 16px",
        fontSize: "0.7rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity 0.15s",
      }}
    >
      {children}
    </button>
  );
}

/* ── InlineSelect (status badge clickable) ── */
export function StatusSelect({ value, options, onChange, colorMap }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  colorMap: Record<string, string>;
}) {
  const color = colorMap[value] || "rgba(255,255,255,0.4)";
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}35`,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: "0.45rem",
        fontWeight: 700,
        cursor: "pointer",
        outline: "none",
        appearance: "none",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {options.map(o => <option key={o} value={o} style={{ background: "#111", color: "white", textTransform: "none" }}>{o}</option>)}
    </select>
  );
}
