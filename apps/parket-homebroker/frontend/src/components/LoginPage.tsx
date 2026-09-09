import { useState } from "react";
import { TrendingUp, Lock, Mail, Loader2 } from "lucide-react";
import { signIn, clearAllAndReload } from "../lib/auth";

export function LoginPage({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-hb-bg text-hb-text">
      {/* Pseudo-ticker no topo da página de login pra dar clima */}
      <div className="h-8 bg-hb-panel border-b border-hb-border overflow-hidden flex items-center text-[10px] tabular text-hb-textDim px-4">
        <span className="text-hb-gold font-semibold mr-3">PKT</span>
        Parket • Home Broker • Plataforma comercial • Atendimento • Copiloto IA • Mercado de alta performance
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-hb-panel border border-hb-border rounded-lg p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-10 h-10 rounded-lg bg-hb-accent/15 border border-hb-accent/40 flex items-center justify-center">
              <TrendingUp size={20} className="text-hb-accent" />
            </div>
          </div>
          <div className="text-center text-lg font-bold mt-3">PARKET • Home Broker</div>
          <div className="text-center text-xs text-hb-textDim mb-6">Atendimento e Vendas</div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-hb-textDim font-semibold mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hb-textDim" />
                <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-hb-bg border border-hb-border rounded pl-9 pr-3 py-2.5 text-sm text-hb-text outline-none focus:border-hb-accent" />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-hb-textDim font-semibold mb-1.5 block">Senha</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hb-textDim" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-hb-bg border border-hb-border rounded pl-9 pr-3 py-2.5 text-sm text-hb-text outline-none focus:border-hb-accent" />
              </div>
            </div>
            {error && (
              <div className="text-xs text-hb-red bg-hb-red/10 border border-hb-red/30 rounded px-3 py-2 space-y-2">
                <div>{error}</div>
                {/timeout|sessão|cache/i.test(error) && (
                  <button type="button" onClick={clearAllAndReload}
                    className="w-full text-[11px] bg-hb-red/20 hover:bg-hb-red/30 border border-hb-red/40 text-hb-red font-semibold rounded py-1.5 transition">
                    🧹 Limpar sessão e recarregar
                  </button>
                )}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-hb-accent text-hb-bg font-semibold rounded py-2.5 text-sm hover:bg-hb-gold transition flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Entrar
            </button>
          </form>

          <div className="text-[10px] text-hb-textDim text-center mt-5 space-y-1">
            <div>Acesso restrito · use suas credenciais Parket</div>
            <button type="button" onClick={clearAllAndReload}
              className="text-hb-textDim hover:text-hb-accent underline">
              Travou? Limpar sessão e recarregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
