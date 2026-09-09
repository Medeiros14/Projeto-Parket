/**
 * LoginPage — entrada do Space v2. Identidade SO Parket: Cinzel display,
 * Inter body, paleta brand, cantos retos. Suporta dark/light via root class.
 */
import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Sun, Moon } from "lucide-react";
import { signIn } from "../lib/auth";

export function LoginPage({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(initialError || null);
  const [mode, setMode] = useState<"dark" | "light">(() =>
    (localStorage.getItem("pk-theme") as "dark" | "light") || "dark"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("light", mode === "light");
    try { localStorage.setItem("pk-theme", mode); } catch {}
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await signIn(email.trim(), password); }
    catch (e: any) { setErr(e?.message || "Falha ao entrar"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-pk-bg text-pk-text flex flex-col items-center justify-center px-6 relative">
      {/* Toggle tema canto sup. direito */}
      <button onClick={() => setMode((m) => m === "dark" ? "light" : "dark")}
        className="absolute top-5 right-5 p-2 border border-pk-border text-pk-textDim hover:text-pk-text hover:border-pk-borderHover transition"
        title={mode === "dark" ? "Modo claro" : "Modo escuro"}>
        {mode === "dark" ? <Sun size={13} /> : <Moon size={13} />}
      </button>

      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-10">
          <div className="text-[8px] uppercase tracking-[0.30em] text-pk-textDim mb-3">PARKET · OS</div>
          <h1 className="font-display text-[28px] tracking-[0.18em] uppercase font-medium">SPACE</h1>
          <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mt-2">SISTEMA OPERACIONAL · v2</div>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-5 border border-pk-border p-6 bg-pk-panel">
          <Field label="EMAIL">
            <input
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-pk-bg border border-pk-border px-3 py-2.5 text-[13px] font-mono text-pk-text outline-none focus:border-pk-accent transition"
              placeholder="seu.email@parket.com.br"
            />
          </Field>

          <Field label="SENHA">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-pk-bg border border-pk-border px-3 py-2.5 text-[13px] font-mono text-pk-text outline-none focus:border-pk-accent transition"
              placeholder="••••••••"
            />
          </Field>

          {err && (
            <div className="flex items-start gap-2 px-3 py-2 border border-pk-walnut bg-pk-walnut/15">
              <AlertCircle size={12} className="text-pk-walnut shrink-0 mt-0.5" />
              <span className="text-[10px] text-pk-walnut leading-relaxed">{err}</span>
            </div>
          )}

          <button type="submit" disabled={busy || !email || !password}
            className="w-full bg-pk-accent hover:bg-pk-cream text-pk-bg uppercase tracking-[0.20em] text-[10px] font-semibold py-3 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {busy && <Loader2 size={12} className="animate-spin" />}
            {busy ? "ENTRANDO" : "ENTRAR"}
          </button>
        </form>

        <div className="text-center mt-6 text-[8px] uppercase tracking-[0.22em] text-pk-textDim">
          ACESSO RESTRITO · TIME PARKET
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-1.5 font-semibold">
        {label}
      </div>
      {children}
    </div>
  );
}
