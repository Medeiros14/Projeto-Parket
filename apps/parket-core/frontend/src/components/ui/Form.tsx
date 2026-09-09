import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({ label, hint, error, children, required }: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
        {label}{required && <span className="text-parket-accent ml-0.5">*</span>}
      </label>
      {children}
      {error && <div className="text-[10px] text-red-400">{error}</div>}
      {hint && !error && <div className="text-[10px] text-parket-textDim">{hint}</div>}
    </div>
  );
}

const inputBase =
  "w-full px-2.5 py-2 bg-parket-panelLight border border-parket-border rounded-md text-xs " +
  "focus:outline-none focus:border-parket-accent placeholder:text-parket-textDim/60";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className || ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 3} className={`${inputBase} resize-y ${props.className || ""}`} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} className={`${inputBase} cursor-pointer ${props.className || ""}`}>
      {children}
    </select>
  );
}

export function Button({
  variant = "primary", size = "md", loading, children, ...props
}: {
  variant?: "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md";
  loading?: boolean;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: "bg-parket-accent text-parket-bg hover:bg-parket-accentDark font-semibold",
    ghost: "text-parket-textDim hover:bg-parket-panelLight hover:text-parket-text",
    danger: "bg-red-500 text-white hover:bg-red-600 font-semibold",
    outline: "border border-parket-border text-parket-text/80 hover:bg-parket-panelLight",
  };
  const sizes = { sm: "px-2.5 py-1 text-[11px]", md: "px-3 py-1.5 text-xs" };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`rounded ${variants[variant]} ${sizes[size]} disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition ${props.className || ""}`}
    >
      {loading && (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

export function FormGrid({ cols = 2, children }: { cols?: 1 | 2 | 3 | 4; children: ReactNode }) {
  const map = { 1: "grid-cols-1", 2: "grid-cols-1 md:grid-cols-2", 3: "grid-cols-1 md:grid-cols-3", 4: "grid-cols-2 md:grid-cols-4" };
  return <div className={`grid ${map[cols]} gap-4`}>{children}</div>;
}
