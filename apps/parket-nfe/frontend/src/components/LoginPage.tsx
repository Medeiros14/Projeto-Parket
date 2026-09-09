import { useState } from "react";
import { FileText, Lock, Mail, Loader2 } from "lucide-react";
import { signIn, clearAllAndReload } from "../lib/auth";

// Página de login do parket-nfe. Visual copiado do parket-homebroker
// pra manter identidade Sistema Operacional Parket entre apps.
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
      {/* Faixa superior de identidade — mesmo padrão dos outros apps Parket */}
      <div className="h-8 bg-hb-panel border-b border-hb-border overflow-hidden flex items-center text-[10px] tabular text-hb-textDim px-4">
        <span className="text-hb-gold font-semibold mr-3">PKT</span>
        Parket · Fiscal NF-e · Upload e gestão de notas fiscais eletrônicas
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-hb-panel border border-hb-border rounded-lg p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-10 h-10 rounded-lg bg-hb-accent/15 border border-hb-accent/40 flex items-center justify-center">
              <FileText size={20} className="text-hb-accent" />
            </div>
          </div>
          <div className="text-center text-lg font-bold mt-3">PARKET · FISCAL</div>
          <div className="text-center text-xs text-hb-textDim mb-6">Notas Fiscais Eletrônicas</div>

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
                {/* Botão "Limpar sessão" pra sair de estado zumbi (token corrompido, cache) */}
                <button type="button" onClick={clearAllAndReload}
                  className="text-[10px] uppercase tracking-wider text-hb-textDim hover:text-hb-text underline">
                  Limpar sessão e tentar de novo
                </button>
              </div>
            )}
            <button type="submit" disabled={loading || !email || !password}
              className="w-full mt-2 bg-hb-accent/20 border border-hb-accent/40 text-hb-accent uppercase tracking-wider text-xs py-2.5 rounded hover:bg-hb-accent/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Entrando...</> : "Entrar"}
            </button>
          </form>
        </div>
      </div>

      <div className="h-6 border-t border-hb-border text-[10px] text-hb-textMuted flex items-center justify-center">
        fiscal.parket.works · v0.1
      </div>
    </div>
  );
}
