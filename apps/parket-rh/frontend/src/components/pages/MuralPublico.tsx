/**
 * MuralPublico — página pública sem branding "Parket".
 * Fluxo:
 *   1. Tela 1: form Nome + CPF (gate).
 *   2. Tela 2: conteúdo do mural + botão "Li e concordo — assinar".
 *   3. Submit cria documentos_emitidos com mural_id + nome_informado +
 *      cpf_informado e redireciona pra /assinar/:token (PAdES existente).
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertTriangle, FileText, PenLine } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

type Mural = { id: string; slug: string; titulo: string; conteudo_html: string };

function validaCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10) r = 0;
  if (r !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  r = (s * 10) % 11;
  if (r === 10) r = 0;
  return r === +d[10];
}

function fmtCpfMask(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function MuralPublicoPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const colabId = searchParams.get("c"); // link do broadcast inclui ?c=<id>
  const [mural, setMural] = useState<Mural | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Força light mode no <html>/<body> pra essa rota pública.
  // Sem isso, o "class=dark" do index.html deixa o fundo preto
  // por trás do container branco do mural (efeito flash em celular).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const hadDark = html.classList.contains("dark");
    if (hadDark) html.classList.remove("dark");
    const prevBg = body.style.background;
    const prevColor = body.style.color;
    body.style.background = "#ffffff";
    body.style.color = "#0f172a";
    return () => {
      if (hadDark) html.classList.add("dark");
      body.style.background = prevBg;
      body.style.color = prevColor;
    };
  }, []);

  // Tela 1 — gate
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [step, setStep] = useState<"gate" | "doc">("gate");
  const [submitting, setSubmitting] = useState(false);

  // Marca opened_at IMEDIATAMENTE quando o link é aberto (?c=<colab_id>),
  // antes mesmo de preencher Nome+CPF. Best-effort, não bloqueia UI.
  useEffect(() => {
    if (!slug || !colabId) return;
    fetch("https://agente.parket.works/api/rh-whatsapp/mural-opened", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mural_slug: slug, colaborador_id: colabId }),
    }).catch(() => {});
  }, [slug, colabId]);

  useEffect(() => {
    if (!slug) return;
    supabase.rpc("mural_public_get", { p_slug: slug }).then(({ data, error: e }) => {
      if (e) setError(e.message || "Mural indisponível");
      else setMural(data as Mural);
      setLoading(false);
    });
  }, [slug]);

  const onContinuar = () => {
    setError(null);
    if (nome.trim().split(/\s+/).length < 2) {
      setError("Informe seu nome completo (nome + sobrenome).");
      return;
    }
    if (!validaCpf(cpf)) {
      setError("CPF inválido.");
      return;
    }
    setStep("doc");
    window.scrollTo({ top: 0 });
  };

  const onAssinar = async () => {
    if (!slug) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc("mural_public_register", {
        p_slug: slug,
        p_nome: nome.trim(),
        p_cpf: cpf.replace(/\D/g, ""),
      });
      if (e) throw new Error(e.message);
      const token = (data as any)?.token;
      if (!token) throw new Error("Falha ao gerar link de assinatura");

      // ⚠ Notificação no grupo Parket-RH foi MOVIDA pra acontecer
      // só após a assinatura concluída (AssinarDocumento.tsx).
      // Aqui o colaborador só identificou-se; ainda não assinou.

      navigate(`/assinar/${token}`);
    } catch (e: any) {
      setError(e.message || "Erro ao gerar assinatura");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3">
        <Loader2 size={20} className="animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Carregando…</span>
      </div>
    );
  }
  if (!mural) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <AlertTriangle size={32} className="text-amber-400" />
        <div className="font-semibold">Documento indisponível</div>
        <div className="text-xs text-muted-foreground max-w-md text-center">{error || "Link inválido ou expirado."}</div>
      </div>
    );
  }

  // Página pública = sempre fundo branco, sem dark mode (vai ser
  // aberta por colaboradores em celulares, então tem que ser legível
  // independente da preferência do browser deles).
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#ffffff", color: "#0f172a" }}>
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="max-w-3xl mx-auto px-6 py-5">
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{mural.titulo}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Documento interno · Leitura e assinatura obrigatórias
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 space-y-4">
        {step === "gate" && (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <FileText size={18} style={{ color: "#0f172a" }} />
                <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>Identifique-se pra continuar</div>
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Pra ler e assinar este documento informe seu nome completo e CPF.
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 6, display: "block" }}>Nome completo *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                autoFocus
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, color: "#0f172a", background: "#ffffff", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 6, display: "block" }}>CPF *</label>
              <input
                value={cpf}
                onChange={(e) => setCpf(fmtCpfMask(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, color: "#0f172a", background: "#ffffff", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {error && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</div>}

            <button
              onClick={onContinuar}
              disabled={!nome || !cpf}
              style={{
                width: "100%", padding: "12px 20px",
                background: (!nome || !cpf) ? "#cbd5e1" : "#0f172a",
                color: "white", border: "none", borderRadius: 6,
                fontSize: 14, fontWeight: 600,
                cursor: (!nome || !cpf) ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              Continuar pra leitura
            </button>

            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 12 }}>
              Ao continuar, você confirma que as informações são verdadeiras.
            </div>
          </div>
        )}

        {step === "doc" && (
          <>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Lendo como: <strong style={{ color: "#0f172a" }}>{nome}</strong> · CPF {cpf}
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "32px 28px", color: "#0f172a", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="mural-content" dangerouslySetInnerHTML={{ __html: mural.conteudo_html }} />
            </div>

            {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}

            <div className="sticky bottom-0 pt-3" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 30%, rgba(255,255,255,1) 100%)" }}>
              <button
                onClick={onAssinar}
                disabled={submitting}
                style={{
                  width: "100%", padding: "14px 20px",
                  background: submitting ? "#94a3b8" : "#0f172a",
                  color: "white", border: "none", borderRadius: 8,
                  fontSize: 15, fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 14px rgba(15,23,42,0.25)",
                }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                <PenLine size={16} />
                Li e concordo — assinar documento
              </button>
              <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 8 }}>
                Você será redirecionado para a tela de assinatura virtual.
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
