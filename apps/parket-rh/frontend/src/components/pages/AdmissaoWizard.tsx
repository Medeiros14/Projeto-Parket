import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Check, ArrowLeft, ArrowRight, Send, Copy, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useFetch, api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { fmtBRL, fmtCPF, fmtDate } from "@/lib/format";

const STEPS = [
  { n: 1, title: "Empresa & Cargo" },
  { n: 2, title: "Dados do candidato" },
  { n: 3, title: "Mensagem" },
  { n: 4, title: "Revisar & Enviar" },
];

function genToken(len = 32): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const out = new Array(len);
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out[i] = chars[buf[i] % chars.length];
  return out.join("");
}

const DEFAULT_MSG = (nome: string) =>
  `Olá ${nome || "{nome}"}, bem-vindo à Parket! Estamos animados em receber você no time.\n\n` +
  `Pra agilizar a admissão, preencha seu cadastro pelo link que vai chegar junto com este convite. ` +
  `Vai levar uns 10 minutos — tenha em mãos seu CPF, RG, comprovante de endereço e dados bancários.\n\n` +
  `Qualquer dúvida é só responder este e-mail.\n\nTime de Pessoas — Parket`;

type Form = {
  empresa_id: string;
  cargo_id: string;
  data_admissao_prevista: string;
  salario_proposto: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  mensagem: string;
};

export function AdmissaoWizardPage() {
  const navigate = useNavigate();
  const empresas = useFetch(() => api.empresas(), []);
  const cargos = useFetch(() => api.cargos(), []);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>({
    empresa_id: "",
    cargo_id: "",
    data_admissao_prevista: "",
    salario_proposto: "",
    nome: "",
    email: "",
    telefone: "",
    cpf: "",
    mensagem: DEFAULT_MSG(""),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ token: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const cargosFiltrados = useMemo(() => {
    if (!form.empresa_id) return [];
    return (cargos.data || []).filter((c) => c.empresa_id === form.empresa_id);
  }, [cargos.data, form.empresa_id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // se nome mudou e mensagem ainda é padrão, atualiza mensagem
      if (k === "nome" && f.mensagem === DEFAULT_MSG(f.nome)) {
        next.mensagem = DEFAULT_MSG(v as string);
      }
      // troca de empresa zera cargo
      if (k === "empresa_id") next.cargo_id = "";
      return next;
    });
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.empresa_id) e.empresa_id = "Selecione a empresa";
      if (!form.cargo_id) e.cargo_id = "Selecione o cargo";
    }
    if (s === 2) {
      if (!form.nome.trim()) e.nome = "Nome é obrigatório";
      if (!form.email.trim()) e.email = "Email é obrigatório";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email inválido";
    }
    if (s === 3) {
      if (!form.mensagem.trim()) e.mensagem = "Mensagem não pode estar vazia";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 4));
  };
  const back = () => setStep((s) => Math.max(s - 1, 1));

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = genToken(32);
      const cargo = cargosFiltrados.find((c) => c.id === form.cargo_id);
      const payload: any = {
        empresa_id: form.empresa_id,
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone ? form.telefone.replace(/\D/g, "") : null,
        cargo_id: form.cargo_id || null,
        departamento_id: null,
        data_admissao_prevista: form.data_admissao_prevista || null,
        salario_proposto: form.salario_proposto ? Number(form.salario_proposto) : (cargo?.salario_base_default ?? null),
        etapa: "convite_enviado",
        token,
        mensagem_convite: form.mensagem,
        cpf: form.cpf ? form.cpf.replace(/\D/g, "") : null,
      };
      const { data, error } = await supabase
        .from("admissoes")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      setSuccess({ token, id: data.id });
    } catch (err: any) {
      setSubmitError(err?.message || "Erro ao enviar convite");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    const link = `https://rh.parket.works/admissao/${success.token}`;
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/15 text-green-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Convite enviado!</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {form.nome} já pode preencher o cadastro pelo link abaixo.
            </p>
            <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-md px-3 py-2 mb-6">
              <code className="flex-1 text-xs truncate text-left">{link}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => navigate("/admissoes")}>
                Voltar pra lista
              </Button>
              <Button
                onClick={() => {
                  setSuccess(null);
                  setStep(1);
                  setForm({
                    empresa_id: "",
                    cargo_id: "",
                    data_admissao_prevista: "",
                    salario_proposto: "",
                    nome: "",
                    email: "",
                    telefone: "",
                    cpf: "",
                    mensagem: DEFAULT_MSG(""),
                  });
                }}
              >
                Nova admissão
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nova admissão</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Convide um novo colaborador a preencher seu cadastro.
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((s, idx) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} className="flex items-center flex-1 last:flex-initial gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition " +
                    (done
                      ? "bg-green-500/20 text-green-400 border-green-500/40"
                      : active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-border")
                  }
                >
                  {done ? <Check size={14} /> : s.n}
                </div>
                <div className={"text-[10px] uppercase tracking-wider " + (active ? "text-foreground" : "text-muted-foreground")}>
                  {s.title}
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={"flex-1 h-px " + (done ? "bg-green-500/40" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 1 && (
            <>
              <Field label="Empresa" error={errors.empresa_id}>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm"
                  value={form.empresa_id}
                  onChange={(e) => set("empresa_id", e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {(empresas.data || []).map((e) => (
                    <option key={e.id} value={e.id}>{e.razao_social}</option>
                  ))}
                </select>
              </Field>
              <Field label="Cargo" error={errors.cargo_id}>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm disabled:opacity-50"
                  value={form.cargo_id}
                  onChange={(e) => set("cargo_id", e.target.value)}
                  disabled={!form.empresa_id}
                >
                  <option value="">{form.empresa_id ? "Selecione…" : "Selecione a empresa primeiro"}</option>
                  {cargosFiltrados.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Data prevista de admissão">
                  <Input
                    type="date"
                    value={form.data_admissao_prevista}
                    onChange={(e) => set("data_admissao_prevista", e.target.value)}
                  />
                </Field>
                <Field label="Salário proposto (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={form.salario_proposto}
                    onChange={(e) => set("salario_proposto", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Nome completo" error={errors.nome}>
                <Input
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder="Maria da Silva"
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="maria@email.com"
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Telefone">
                  <Input
                    value={form.telefone}
                    onChange={(e) => set("telefone", e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </Field>
                <Field label="CPF">
                  <Input
                    value={form.cpf}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                      set("cpf", raw.length === 11 ? fmtCPF(raw) : raw);
                    }}
                    placeholder="000.000.000-00"
                  />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <Field label="Mensagem ao candidato" error={errors.mensagem}>
              <textarea
                className="flex w-full min-h-[200px] rounded-md border border-border bg-input px-3 py-2 text-sm resize-y"
                value={form.mensagem}
                onChange={(e) => set("mensagem", e.target.value)}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Esta mensagem vai junto com o link de cadastro no e-mail de convite.
              </div>
            </Field>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold">Revisar antes de enviar</div>
              <ReviewRow label="Empresa" value={(empresas.data || []).find((e) => e.id === form.empresa_id)?.razao_social || "—"} />
              <ReviewRow label="Cargo" value={cargosFiltrados.find((c) => c.id === form.cargo_id)?.nome || "—"} />
              <ReviewRow label="Início previsto" value={form.data_admissao_prevista ? fmtDate(form.data_admissao_prevista) : "—"} />
              <ReviewRow label="Salário proposto" value={form.salario_proposto ? fmtBRL(Number(form.salario_proposto)) : "—"} />
              <div className="border-t border-border pt-3">
                <ReviewRow label="Nome" value={form.nome} />
                <ReviewRow label="Email" value={form.email} />
                <ReviewRow label="Telefone" value={form.telefone || "—"} />
                <ReviewRow label="CPF" value={form.cpf || "—"} />
              </div>
              <div className="border-t border-border pt-3">
                <div className="text-xs text-muted-foreground mb-1">Mensagem</div>
                <div className="text-sm whitespace-pre-wrap bg-secondary/30 border border-border rounded-md p-3">
                  {form.mensagem}
                </div>
              </div>
              {submitError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-md p-3">
                  {submitError}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={step === 1 ? () => navigate("/admissoes") : back} disabled={submitting}>
          <ArrowLeft size={14} /> {step === 1 ? "Cancelar" : "Voltar"}
        </Button>
        {step < 4 ? (
          <Button onClick={next}>
            Próximo <ArrowRight size={14} />
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar convite
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-right truncate">{value}</div>
    </div>
  );
}
