import { useState, type FormEvent } from "react";
import { Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { supabase } from "@/lib/supabase";

export function LandingPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Credenciais inválidas. Use o mesmo acesso do Space Parket.");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{
        background: "linear-gradient(135deg, #050505 0%, #14120f 100%)",
      }}
    >
      <div className="mb-10 text-center">
        <img src="/logo-parket.png" alt="Parket" className="h-16 mx-auto mb-6" />
        <p
          className="text-xl text-[#d8d3c7] tracking-[0.35em] uppercase"
          style={{ fontFamily: "Cinzel, serif" }}
        >
          Expedição
        </p>
        <p className="text-xs text-[#77736a] tracking-widest uppercase mt-2">
          "Pra nós, por nós"
        </p>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-[#968473]/30 text-[#d8d3c7] placeholder:text-[#77736a] px-4 py-3 text-sm outline-none focus:border-[#968473]"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-[#968473]/30 text-[#d8d3c7] placeholder:text-[#77736a] px-4 py-3 text-sm outline-none focus:border-[#968473]"
        />
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#968473] text-[#050505] py-3 text-sm font-semibold tracking-widest uppercase hover:bg-[#a89583] disabled:opacity-60"
          style={{ fontFamily: "Cinzel, serif" }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <p className="text-[#77736a] text-[11px] text-center pt-2">
          Mesmo login do Space Parket
        </p>
      </form>
    </div>
  );
}

export default function Index() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="w-48 h-8" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </>
  );
}
