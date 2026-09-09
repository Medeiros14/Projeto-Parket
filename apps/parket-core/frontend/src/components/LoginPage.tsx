import { useState } from "react";
import { signIn } from "../lib/auth";
import { Lock, Mail, Loader2 } from "lucide-react";

export function LoginPage({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(initialError ?? null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) setErr(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-parket-bg p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-[34px] h-[34px] border border-parket-accent bg-parket-accent/10 mb-4">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#968473" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h10M4 18h6" />
            </svg>
          </div>
          <h1 className="text-[15px]" style={{ letterSpacing: "0.22em" }}>PARKET</h1>
          <p className="text-[9px] text-parket-textDim/70 uppercase mt-1.5" style={{ letterSpacing: "0.24em" }}>Core · Gestão Financeira</p>
        </div>

        <form onSubmit={onSubmit} className="bg-parket-panel border border-parket-border rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-parket-textDim block mb-1.5">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-parket-textDim" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@parket.com.br"
                className="w-full pl-9 pr-3 py-2.5 bg-parket-bg border border-parket-border rounded-lg text-sm focus:outline-none focus:border-parket-accent"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-parket-textDim block mb-1.5">Senha</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-parket-textDim" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-parket-bg border border-parket-border rounded-lg text-sm focus:outline-none focus:border-parket-accent"
              />
            </div>
          </div>
          {err && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-2.5">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-parket-accent text-[11px] hover:bg-parket-accentDark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
            style={{ color: "#0b0b0b", letterSpacing: "0.22em" }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="text-center text-[9px] text-parket-textDim/70 uppercase mt-6" style={{ letterSpacing: "0.18em" }}>
          Acesso restrito — mesma conta do Parket Space
        </p>
      </div>
    </div>
  );
}
