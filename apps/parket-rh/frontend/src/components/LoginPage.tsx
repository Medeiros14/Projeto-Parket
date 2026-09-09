import { useState } from "react";
import { Lock, Mail, Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
            <span className="text-primary text-2xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            PARKET <span className="text-primary">RH</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de pessoas</p>
        </div>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-lg">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="email" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@parket.com.br" className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Senha</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {err && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-md p-2.5">
              {err}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 size={14} className="animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Mesma conta do Parket Space — acesso liberado por convite.
        </p>
      </div>
    </div>
  );
}
