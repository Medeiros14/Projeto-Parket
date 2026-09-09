/**
 * AdmissaoPublica — formulário PÚBLICO de admissão preenchido pelo
 * próprio funcionário, sem necessidade de login.
 *
 * Acessado via /admissao/:token onde token é único e enviado pelo RH.
 * Toda comunicação com DB é via RPC SECURITY DEFINER (rh.admissao_public_*).
 *
 * VALIDAÇÕES (v2 — 10/Jun/2026):
 *   - Tudo obrigatório em DADOS PESSOAIS
 *   - Tudo obrigatório em DOCUMENTOS menos CTPS
 *   - Reservista obrigatório SE sexo = Homem
 *   - Tudo obrigatório em BANCO
 *   - Pelo menos 1 contato emergência (nome + relação + celular)
 *   - Email + telefone fixo do contato emergência OPCIONAIS
 *   - Camiseta: PP/P/M/G/G1/G2 (XG removido)
 *   - Calça: P/M/G/G1/G2 (campo separado)
 *
 * Auto-save por debounce + retomada de onde parou (etapa).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ChevronLeft, ChevronRight, Check, Upload, X, AlertTriangle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const BUCKET = "rh-admissao-docs";

const STEPS = [
  { key: "pessoais", label: "Dados pessoais" },
  { key: "contatos", label: "Contatos" },
  { key: "endereco", label: "Endereço" },
  { key: "documentos", label: "Documentos" },
  { key: "estrangeiro", label: "Estrangeiro" },
  { key: "formacao", label: "Formação" },
  { key: "dependentes", label: "Dependentes" },
  { key: "bancarios", label: "Banco / PIX" },
  { key: "emergencia", label: "Emergência" },
  { key: "epi", label: "Uniforme / EPI" },
  { key: "uploads", label: "Documentos (foto)" },
  { key: "assinatura", label: "Assinatura" },
] as const;
type StepKey = typeof STEPS[number]["key"];

type AdmissaoMeta = {
  admissao_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  data_admissao_prevista: string | null;
  salario_proposto: number | null;
  etapa: string;
  preenchido_em: string | null;
  empresa: { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string };
  cargo: { id: string; nome: string } | null;
  departamento: { id: string; nome: string } | null;
  form_data: any;
};

// ══════════════════════════════════════════════════════════════════
// VALIDAÇÃO POR STEP — retorna array de mensagens (vazio = válido)
// ══════════════════════════════════════════════════════════════════
function validateStep(key: StepKey, data: any): string[] {
  const errs: string[] = [];
  const req = (v: any, label: string) => {
    if (v === null || v === undefined || (typeof v === "string" && !v.trim())) errs.push(`${label} é obrigatório`);
  };

  if (key === "pessoais") {
    const p = data.pessoais || {};
    req(p.nome, "Nome completo");
    req(p.data_nascimento, "Data de nascimento");
    req(p.sexo, "Sexo");
    req(p.genero_documento, "Gênero no documento");
    req(p.estado_civil, "Estado civil");
    req(p.raca_cor, "Cor/Raça");
    req(p.nacionalidade, "Nacionalidade");
    req(p.uf_natal, "UF natal");
    req(p.cidade_natal, "Cidade natal");
    req(p.nome_mae, "Nome da mãe");
  }
  if (key === "contatos") {
    const c = data.contatos || {};
    req(c.celular, "Celular");
    req(c.email, "Email pessoal");
  }
  if (key === "endereco") {
    const e = data.endereco || {};
    req(e.cep, "CEP");
    req(e.logradouro, "Logradouro");
    req(e.numero, "Número");
    req(e.bairro, "Bairro");
    req(e.cidade, "Cidade");
    req(e.uf, "UF");
  }
  if (key === "documentos") {
    const d = data.documentos || {};
    const sexo = (data.pessoais?.sexo || "").toLowerCase();
    req(d.cpf, "CPF");
    req(d.rg_numero, "RG");
    req(d.rg_orgao, "RG órgão emissor");
    req(d.rg_uf, "RG UF");
    req(d.rg_data, "RG data de emissão");
    req(d.pis, "PIS/PASEP");
    req(d.titulo, "Título de eleitor");
    req(d.titulo_zona, "Zona do título");
    req(d.titulo_secao, "Seção do título");
    if (sexo === "homem" || sexo === "masculino") {
      req(d.reservista, "Reservista (obrigatório para sexo masculino)");
    }
    // CTPS e CNH OPCIONAIS
  }
  if (key === "bancarios") {
    const b = data.bancarios || {};
    req(b.banco, "Banco");
    req(b.tipo, "Tipo de conta");
    req(b.agencia, "Agência");
    req(b.conta, "Conta");
    req(b.digito, "Dígito");
  }
  if (key === "emergencia") {
    const list = data.emergencia || [];
    if (list.length === 0) errs.push("Adicione pelo menos 1 contato de emergência");
    list.forEach((c: any, i: number) => {
      if (!c.nome?.trim()) errs.push(`Contato #${i + 1}: nome é obrigatório`);
      if (!c.relacao?.trim()) errs.push(`Contato #${i + 1}: relação é obrigatória`);
      if (!c.celular?.trim()) errs.push(`Contato #${i + 1}: celular é obrigatório`);
      // email e telefone fixo OPCIONAIS
    });
  }
  if (key === "epi") {
    const e = data.epi || {};
    req(e.camiseta, "Tamanho da camiseta");
    req(e.calca, "Tamanho da calça");
  }
  if (key === "uploads") {
    const list: any[] = data.uploads || [];
    const has = (tipo: string) => list.some((u) => u.tipo === tipo);
    if (!has("rg_frente")) errs.push("Foto do RG (frente) é obrigatória");
    if (!has("rg_verso")) errs.push("Foto do RG (verso) é obrigatória");
    if (!has("cpf")) errs.push("Foto do CPF é obrigatória");
    if (!has("comprovante_residencia")) errs.push("Comprovante de residência é obrigatório");
  }
  if (key === "assinatura") {
    if (!data?.assinatura?.png) errs.push("Assinatura é obrigatória");
  }
  // dependentes / estrangeiro / formação: opcionais

  return errs;
}

// % de progresso (steps completos vs total)
function calcProgresso(data: any): { pct: number; ultimoStep: StepKey | null } {
  let ultimo: StepKey | null = null;
  let done = 0;
  for (const s of STEPS) {
    if (validateStep(s.key, data).length === 0) { done++; ultimo = s.key; }
    else break;
  }
  return { pct: Math.round((done / STEPS.length) * 100), ultimoStep: ultimo };
}

export function AdmissaoPublicaPage() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<AdmissaoMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const dirtyRef = useRef(false);
  const saveTimer = useRef<any>(null);

  // ── Load meta ──
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    supabase.rpc("admissao_public_get", { p_token: token }).then(({ data: d, error: e }) => {
      if (e) {
        setError(e.message || "Token inválido ou expirado");
        setLoading(false);
        return;
      }
      const m = d as AdmissaoMeta;
      setMeta(m);
      const fd = m.form_data || {};
      setData(fd);
      if (m.preenchido_em) setSubmitted(true);
      // Retoma do step que parou
      const { ultimoStep } = calcProgresso(fd);
      if (ultimoStep) {
        const idx = STEPS.findIndex((s) => s.key === ultimoStep);
        // Pula 1 passo à frente do último completo
        setStepIdx(Math.min(idx + 1, STEPS.length - 1));
      }
      setLoading(false);
    });
  }, [token]);

  // ── Auto-save ──
  const saveData = async (newData: any) => {
    if (!token) return;
    setSaving(true);
    try {
      await supabase.rpc("admissao_public_save", { p_token: token, p_data: newData });
    } finally {
      setSaving(false);
    }
  };
  const updateField = (path: string, value: any) => {
    setData((d: any) => {
      const next = { ...d };
      const parts = path.split(".");
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = obj[parts[i]] || {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (dirtyRef.current) {
          dirtyRef.current = false;
          saveData(next);
        }
      }, 1500);
      return next;
    });
  };

  const currentStep = STEPS[stepIdx];
  const currentErrors = useMemo(() => validateStep(currentStep.key, data), [currentStep.key, data]);
  const progresso = useMemo(() => calcProgresso(data), [data]);

  const tentarProximo = () => {
    if (currentErrors.length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStepIdx((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    if (!token) return;
    // Valida todos os steps obrigatórios antes
    for (const s of STEPS) {
      const errs = validateStep(s.key, data);
      if (errs.length > 0) {
        setStepIdx(STEPS.findIndex((x) => x.key === s.key));
        setShowErrors(true);
        alert(`Faltam dados no passo "${s.label}":\n\n${errs.slice(0, 3).join("\n")}`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        ...data,
        _assinatura: {
          png: data.assinatura.png,
          assinado_em: new Date().toISOString(),
          nome_assinante: data?.pessoais?.nome || "",
          ip_user_agent: navigator.userAgent.slice(0, 200),
        },
      };
      const { error: e } = await supabase.rpc("admissao_public_submit", { p_token: token, p_data: payload });
      if (e) throw new Error(e.message);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || "Falha ao submeter");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <FullScreen>
      <Loader2 size={28} className="animate-spin text-primary" />
      <div className="text-sm text-muted-foreground">Carregando…</div>
    </FullScreen>;
  }
  if (error || !meta) {
    return <FullScreen>
      <AlertTriangle size={32} className="text-amber-400" />
      <div className="text-base font-semibold">Não foi possível abrir este formulário</div>
      <div className="text-xs text-muted-foreground max-w-md text-center">{error || "Token inválido"}</div>
    </FullScreen>;
  }
  if (submitted) {
    return <FullScreen>
      <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><Check size={24} /></div>
      <div className="text-base font-semibold">Tudo pronto! Formulário assinado.</div>
      <div className="text-xs text-muted-foreground max-w-md text-center">
        Recebemos suas informações e a assinatura digital. O RH da {meta.empresa.nome_fantasia || meta.empresa.razao_social} vai revisar e te chamar pros próximos passos.
      </div>
    </FullScreen>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-base font-bold">Admissão · {meta.empresa.nome_fantasia || meta.empresa.razao_social}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Olá, {meta.nome.split(" ")[0]}! {meta.cargo ? `Cargo: ${meta.cargo.nome}.` : ""} Preenche os dados pra gente formalizar tua entrada.
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {saving && <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Loader2 size={10} className="animate-spin" /> salvando…
            </div>}
            <div className="text-[10px] text-muted-foreground">Progresso: <span className="font-bold text-primary">{progresso.pct}%</span></div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1 bg-secondary">
          <div className="h-1 bg-primary transition-all" style={{ width: `${progresso.pct}%` }} />
        </div>
      </header>

      {/* Stepper */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-6 py-3 flex gap-1.5 overflow-x-auto">
          {STEPS.map((s, i) => {
            const errs = validateStep(s.key, data);
            const completo = errs.length === 0;
            return (
              <button key={s.key} onClick={() => { setStepIdx(i); setShowErrors(false); }}
                className={`text-[10px] px-2.5 py-1.5 rounded whitespace-nowrap transition ${
                  i === stepIdx ? "bg-primary text-primary-foreground font-semibold"
                  : completo ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                {i + 1}. {s.label} {completo && i !== stepIdx && <Check size={10} className="inline ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form body */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto p-6">
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-1">{currentStep.label}</h2>
            <div className="text-xs text-muted-foreground mb-5">Passo {stepIdx + 1} de {STEPS.length}</div>
            {renderStep(currentStep.key, data, updateField, token!)}

            {showErrors && currentErrors.length > 0 && (
              <div className="mt-4 p-3 rounded border border-amber-500/40 bg-amber-500/10 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-amber-400 mb-1.5">
                  <AlertCircle size={12} /> Faltam preencher:
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-amber-300">
                  {currentErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </Card>

          <div className="flex justify-between mt-4">
            <Button variant="outline" disabled={stepIdx === 0} onClick={() => { setStepIdx((s) => Math.max(0, s - 1)); setShowErrors(false); }}>
              <ChevronLeft size={14} /> Voltar
            </Button>
            {stepIdx < STEPS.length - 1 ? (
              <Button onClick={tentarProximo}>
                Próximo <ChevronRight size={14} />
              </Button>
            ) : (
              <Button onClick={submit} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Enviar formulário
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Step renderers
// ────────────────────────────────────────────────────────────────
function renderStep(key: StepKey, data: any, set: (path: string, v: any) => void, token: string) {
  if (key === "pessoais") return <PessoaisStep data={data} set={set} />;
  if (key === "contatos") return <ContatosStep data={data} set={set} />;
  if (key === "endereco") return <EnderecoStep data={data} set={set} />;
  if (key === "documentos") return <DocumentosStep data={data} set={set} />;
  if (key === "estrangeiro") return <EstrangeiroStep data={data} set={set} />;
  if (key === "formacao") return <FormacaoStep data={data} set={set} />;
  if (key === "dependentes") return <DependentesStep data={data} set={set} />;
  if (key === "bancarios") return <BancariosStep data={data} set={set} />;
  if (key === "emergencia") return <EmergenciaStep data={data} set={set} />;
  if (key === "epi") return <EpiStep data={data} set={set} />;
  if (key === "uploads") return <UploadsStep data={data} set={set} token={token} />;
  if (key === "assinatura") return <AssinaturaStep data={data} set={set} />;
  return null;
}

function Field({ label, children, hint }: { label: string; children: any; hint?: string }) {
  return (
    <label className="block mb-3">
      <div className="text-xs font-medium mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 bg-input border border-border rounded-md text-sm px-3 outline-none focus:ring-2 focus:ring-ring">
      <option value="">— selecione —</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function PessoaisStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const p = data.pessoais || {};
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nome completo *">
          <Input value={p.nome || ""} onChange={(e) => set("pessoais.nome", e.target.value)} />
        </Field>
        <Field label="Nome social (opcional)">
          <Input value={p.nome_social || ""} onChange={(e) => set("pessoais.nome_social", e.target.value)} />
        </Field>
        <Field label="Data de nascimento *">
          <Input type="date" value={p.data_nascimento || ""} onChange={(e) => set("pessoais.data_nascimento", e.target.value)} />
        </Field>
        <Field label="Sexo *">
          <Select value={p.sexo} onChange={(v) => set("pessoais.sexo", v)} options={["Homem", "Mulher", "Outro"]} />
        </Field>
        <Field label="Gênero no documento *">
          <Select value={p.genero_documento} onChange={(v) => set("pessoais.genero_documento", v)} options={["Masculino", "Feminino"]} />
        </Field>
        <Field label="Estado civil *">
          <Select value={p.estado_civil} onChange={(v) => set("pessoais.estado_civil", v)}
            options={["Solteiro(a)", "Casado(a)", "União Estável", "Divorciado(a)", "Separado(a)", "Viúvo(a)"]} />
        </Field>
        <Field label="Cor / Raça *">
          <Select value={p.raca_cor} onChange={(v) => set("pessoais.raca_cor", v)}
            options={["Branca", "Preta", "Parda", "Amarela", "Indígena", "Não informado"]} />
        </Field>
        <Field label="Nacionalidade *">
          <Input value={p.nacionalidade || ""} onChange={(e) => set("pessoais.nacionalidade", e.target.value)} placeholder="Brasileira" />
        </Field>
        <Field label="UF natal *">
          <Input value={p.uf_natal || ""} onChange={(e) => set("pessoais.uf_natal", e.target.value)} maxLength={2} />
        </Field>
        <Field label="Cidade natal *">
          <Input value={p.cidade_natal || ""} onChange={(e) => set("pessoais.cidade_natal", e.target.value)} />
        </Field>
        <Field label="Nome da mãe *">
          <Input value={p.nome_mae || ""} onChange={(e) => set("pessoais.nome_mae", e.target.value)} />
        </Field>
        <Field label="Nome do pai">
          <Input value={p.nome_pai || ""} onChange={(e) => set("pessoais.nome_pai", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function ContatosStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const c = data.contatos || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Celular *">
        <Input value={c.celular || ""} onChange={(e) => set("contatos.celular", e.target.value)} placeholder="(11) 99999-9999" />
      </Field>
      <Field label="Telefone fixo (opcional)">
        <Input value={c.telefone || ""} onChange={(e) => set("contatos.telefone", e.target.value)} />
      </Field>
      <Field label="Email pessoal *">
        <Input type="email" value={c.email || ""} onChange={(e) => set("contatos.email", e.target.value)} />
      </Field>
      <Field label="WhatsApp consente?">
        <Select value={c.whatsapp_consente ? "Sim" : "Não"} onChange={(v) => set("contatos.whatsapp_consente", v === "Sim")} options={["Sim", "Não"]} />
      </Field>
    </div>
  );
}

function EnderecoStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const e = data.endereco || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Field label="CEP *"><Input value={e.cep || ""} onChange={(ev) => set("endereco.cep", ev.target.value)} /></Field>
      <Field label="Logradouro *"><Input value={e.logradouro || ""} onChange={(ev) => set("endereco.logradouro", ev.target.value)} /></Field>
      <Field label="Número *"><Input value={e.numero || ""} onChange={(ev) => set("endereco.numero", ev.target.value)} /></Field>
      <Field label="Complemento"><Input value={e.complemento || ""} onChange={(ev) => set("endereco.complemento", ev.target.value)} /></Field>
      <Field label="Bairro *"><Input value={e.bairro || ""} onChange={(ev) => set("endereco.bairro", ev.target.value)} /></Field>
      <Field label="Cidade *"><Input value={e.cidade || ""} onChange={(ev) => set("endereco.cidade", ev.target.value)} /></Field>
      <Field label="UF *"><Input value={e.uf || ""} onChange={(ev) => set("endereco.uf", ev.target.value)} maxLength={2} /></Field>
    </div>
  );
}

function DocumentosStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const d = data.documentos || {};
  const sexo = (data.pessoais?.sexo || "").toLowerCase();
  const homemPrecisaReservista = sexo === "homem" || sexo === "masculino";
  return (
    <>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 mt-2">CPF / RG (obrigatórios)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="CPF *"><Input value={d.cpf || ""} onChange={(e) => set("documentos.cpf", e.target.value)} /></Field>
        <Field label="RG *"><Input value={d.rg_numero || ""} onChange={(e) => set("documentos.rg_numero", e.target.value)} /></Field>
        <Field label="RG órgão emissor *"><Input value={d.rg_orgao || ""} onChange={(e) => set("documentos.rg_orgao", e.target.value)} /></Field>
        <Field label="RG UF *"><Input value={d.rg_uf || ""} onChange={(e) => set("documentos.rg_uf", e.target.value)} maxLength={2} /></Field>
        <Field label="RG data emissão *"><Input type="date" value={d.rg_data || ""} onChange={(e) => set("documentos.rg_data", e.target.value)} /></Field>
        <Field label="PIS / PASEP *"><Input value={d.pis || ""} onChange={(e) => set("documentos.pis", e.target.value)} /></Field>
      </div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 mt-4">CTPS (opcional)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="CTPS número"><Input value={d.ctps_numero || ""} onChange={(e) => set("documentos.ctps_numero", e.target.value)} /></Field>
        <Field label="CTPS série"><Input value={d.ctps_serie || ""} onChange={(e) => set("documentos.ctps_serie", e.target.value)} /></Field>
        <Field label="CTPS UF"><Input value={d.ctps_uf || ""} onChange={(e) => set("documentos.ctps_uf", e.target.value)} maxLength={2} /></Field>
      </div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 mt-4">Título de eleitor *</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Número do título *"><Input value={d.titulo || ""} onChange={(e) => set("documentos.titulo", e.target.value)} /></Field>
        <Field label="Zona *"><Input value={d.titulo_zona || ""} onChange={(e) => set("documentos.titulo_zona", e.target.value)} /></Field>
        <Field label="Seção *"><Input value={d.titulo_secao || ""} onChange={(e) => set("documentos.titulo_secao", e.target.value)} /></Field>
      </div>
      {homemPrecisaReservista && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 mt-4">Reservista * <span className="text-amber-400 font-normal normal-case">(obrigatório para sexo masculino)</span></h3>
          <Field label="Certificado de Reservista *">
            <Input value={d.reservista || ""} onChange={(e) => set("documentos.reservista", e.target.value)} />
          </Field>
        </>
      )}
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 mt-4">CNH (opcional)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="CNH número"><Input value={d.cnh_numero || ""} onChange={(e) => set("documentos.cnh_numero", e.target.value)} /></Field>
        <Field label="Categoria"><Input value={d.cnh_cat || ""} onChange={(e) => set("documentos.cnh_cat", e.target.value)} /></Field>
        <Field label="Validade"><Input type="date" value={d.cnh_validade || ""} onChange={(e) => set("documentos.cnh_validade", e.target.value)} /></Field>
      </div>
    </>
  );
}

function EstrangeiroStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const x = data.estrangeiro || {};
  const sou = x.sou_estrangeiro;
  return (
    <div>
      <Field label="Você é estrangeiro?">
        <Select value={sou ? "Sim" : "Não"} onChange={(v) => set("estrangeiro.sou_estrangeiro", v === "Sim")} options={["Não", "Sim"]} />
      </Field>
      {sou && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
          <Field label="País de origem"><Input value={x.pais || ""} onChange={(e) => set("estrangeiro.pais", e.target.value)} /></Field>
          <Field label="Tipo de visto"><Input value={x.visto || ""} onChange={(e) => set("estrangeiro.visto", e.target.value)} /></Field>
          <Field label="Data de chegada"><Input type="date" value={x.data_chegada || ""} onChange={(e) => set("estrangeiro.data_chegada", e.target.value)} /></Field>
          <Field label="Data de naturalização"><Input type="date" value={x.data_naturalizacao || ""} onChange={(e) => set("estrangeiro.data_naturalizacao", e.target.value)} /></Field>
          <Field label="Casado com brasileiro(a)?">
            <Select value={x.casado_brasileiro ? "Sim" : "Não"} onChange={(v) => set("estrangeiro.casado_brasileiro", v === "Sim")} options={["Não", "Sim"]} />
          </Field>
          <Field label="Tem filho brasileiro(a)?">
            <Select value={x.filho_brasileiro ? "Sim" : "Não"} onChange={(v) => set("estrangeiro.filho_brasileiro", v === "Sim")} options={["Não", "Sim"]} />
          </Field>
          <Field label="Passaporte"><Input value={x.passaporte || ""} onChange={(e) => set("estrangeiro.passaporte", e.target.value)} /></Field>
        </div>
      )}
    </div>
  );
}

function FormacaoStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const f = data.formacao || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Escolaridade">
        <Select value={f.escolaridade} onChange={(v) => set("formacao.escolaridade", v)}
          options={["Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo",
                   "Técnico", "Superior incompleto", "Superior completo", "Pós-graduação", "Mestrado", "Doutorado"]} />
      </Field>
      <Field label="Instituição"><Input value={f.instituicao || ""} onChange={(e) => set("formacao.instituicao", e.target.value)} /></Field>
      <Field label="Curso"><Input value={f.curso || ""} onChange={(e) => set("formacao.curso", e.target.value)} /></Field>
      <Field label="Ano de conclusão"><Input type="number" value={f.ano || ""} onChange={(e) => set("formacao.ano", e.target.value)} /></Field>
    </div>
  );
}

function DependentesStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const list = data.dependentes || [];
  const update = (i: number, key: string, val: any) => {
    const arr = [...list];
    arr[i] = { ...arr[i], [key]: val };
    set("dependentes", arr);
  };
  const add = () => set("dependentes", [...list, {}]);
  const remove = (i: number) => set("dependentes", list.filter((_: any, j: number) => j !== i));
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-3">
        Adicione cônjuge, filhos ou outros dependentes (cada um vira 1 cartão).
        <span className="text-emerald-400 ml-1">Opcional — pule se não tiver.</span>
      </div>
      {list.map((d: any, i: number) => (
        <Card key={i} className="p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold">Dependente {i + 1}</div>
            <button onClick={() => remove(i)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome *"><Input value={d.nome || ""} onChange={(e) => update(i, "nome", e.target.value)} /></Field>
            <Field label="CPF"><Input value={d.cpf || ""} onChange={(e) => update(i, "cpf", e.target.value)} /></Field>
            <Field label="Data de nascimento"><Input type="date" value={d.nascimento || ""} onChange={(e) => update(i, "nascimento", e.target.value)} /></Field>
            <Field label="Parentesco *">
              <Select value={d.parentesco} onChange={(v) => update(i, "parentesco", v)}
                options={["Cônjuge", "Filho(a)", "Enteado(a)", "Pai", "Mãe", "Outro"]} />
            </Field>
            <Field label="Inclui no IRRF?">
              <Select value={d.irrf ? "Sim" : "Não"} onChange={(v) => update(i, "irrf", v === "Sim")} options={["Não", "Sim"]} />
            </Field>
            <Field label="Salário-família?">
              <Select value={d.salario_familia ? "Sim" : "Não"} onChange={(v) => update(i, "salario_familia", v === "Sim")} options={["Não", "Sim"]} />
            </Field>
            <Field label="Plano de saúde?">
              <Select value={d.plano_saude ? "Sim" : "Não"} onChange={(v) => update(i, "plano_saude", v === "Sim")} options={["Não", "Sim"]} />
            </Field>
            <Field label="Nome da mãe"><Input value={d.nome_mae || ""} onChange={(e) => update(i, "nome_mae", e.target.value)} /></Field>
          </div>
        </Card>
      ))}
      <Button variant="outline" onClick={add}>+ Adicionar dependente</Button>
    </div>
  );
}

function BancariosStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const b = data.bancarios || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Banco *"><Input value={b.banco || ""} onChange={(e) => set("bancarios.banco", e.target.value)} placeholder="ex: Itaú" /></Field>
      <Field label="Tipo de conta *">
        <Select value={b.tipo} onChange={(v) => set("bancarios.tipo", v)} options={["Corrente", "Poupança", "Salário"]} />
      </Field>
      <Field label="Agência *"><Input value={b.agencia || ""} onChange={(e) => set("bancarios.agencia", e.target.value)} /></Field>
      <Field label="Conta *"><Input value={b.conta || ""} onChange={(e) => set("bancarios.conta", e.target.value)} /></Field>
      <Field label="Dígito *"><Input value={b.digito || ""} onChange={(e) => set("bancarios.digito", e.target.value)} /></Field>
      <Field label="Tipo de PIX">
        <Select value={b.pix_tipo} onChange={(v) => set("bancarios.pix_tipo", v)} options={["CPF", "Email", "Telefone", "Aleatória"]} />
      </Field>
      <Field label="Chave PIX"><Input value={b.pix_chave || ""} onChange={(e) => set("bancarios.pix_chave", e.target.value)} /></Field>
    </div>
  );
}

function EmergenciaStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const list = data.emergencia || [];
  const update = (i: number, key: string, val: any) => {
    const arr = [...list];
    arr[i] = { ...arr[i], [key]: val };
    set("emergencia", arr);
  };
  const add = () => set("emergencia", [...list, {}]);
  const remove = (i: number) => set("emergencia", list.filter((_: any, j: number) => j !== i));
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-3">
        Pessoas pra contatar em caso de emergência (mínimo 1).
        Nome, relação e celular são obrigatórios. Email e telefone fixo são opcionais.
      </div>
      {list.map((c: any, i: number) => (
        <Card key={i} className="p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold">Contato {i + 1}</div>
            <button onClick={() => remove(i)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome *"><Input value={c.nome || ""} onChange={(e) => update(i, "nome", e.target.value)} /></Field>
            <Field label="Relação *">
              <Select value={c.relacao} onChange={(v) => update(i, "relacao", v)}
                options={["Cônjuge", "Pai", "Mãe", "Filho(a)", "Irmão(ã)", "Amigo(a)", "Outro"]} />
            </Field>
            <Field label="Celular *"><Input value={c.celular || ""} onChange={(e) => update(i, "celular", e.target.value)} /></Field>
            <Field label="Telefone fixo"><Input value={c.telefone || ""} onChange={(e) => update(i, "telefone", e.target.value)} /></Field>
            <Field label="Email"><Input value={c.email || ""} onChange={(e) => update(i, "email", e.target.value)} /></Field>
          </div>
        </Card>
      ))}
      <Button variant="outline" onClick={add}>+ Adicionar contato</Button>
    </div>
  );
}

function EpiStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const e = data.epi || {};
  return (
    <>
      <div className="text-xs text-muted-foreground mb-3">Tamanhos pra entrega de uniforme. Camiseta e calça são obrigatórios.</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Camiseta *">
          <Select value={e.camiseta} onChange={(v) => set("epi.camiseta", v)} options={["PP", "P", "M", "G", "G1", "G2"]} />
        </Field>
        <Field label="Calça *">
          <Select value={e.calca} onChange={(v) => set("epi.calca", v)} options={["PP", "P", "M", "G", "G1", "G2"]} />
        </Field>
        <Field label="Cópia da camiseta">
          <Select value={e.copia_camiseta} onChange={(v) => set("epi.copia_camiseta", v)} options={["PP", "P", "M", "G", "G1", "G2"]} />
        </Field>
        <Field label="Bota"><Input type="number" value={e.bota || ""} onChange={(ev) => set("epi.bota", ev.target.value)} placeholder="ex: 41" /></Field>
      </div>
    </>
  );
}

function UploadsStep({ data, set, token }: { data: any; set: (p: string, v: any) => void; token: string }) {
  const list: any[] = data.uploads || [];
  const TIPOS = [
    { key: "rg_frente", label: "RG (frente) *", req: true },
    { key: "rg_verso", label: "RG (verso) *", req: true },
    { key: "cpf", label: "CPF *", req: true },
    { key: "comprovante_residencia", label: "Comprovante de residência *", req: true },
    { key: "ctps", label: "CTPS (página da foto + verso)", req: false },
    { key: "foto_3x4", label: "Foto 3x4", req: false },
    { key: "outro", label: "Outro documento", req: false },
  ];

  const upload = async (file: File, tipo: string) => {
    const ext = file.name.split(".").pop();
    const fname = `${tipo}_${Date.now()}.${ext}`;
    const path = `admissao/${token}/${fname}`;
    const { error: e } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
    if (e) {
      alert("Erro ao subir: " + e.message);
      return;
    }
    const { error: e2 } = await supabase.rpc("admissao_public_add_doc", {
      p_token: token, p_tipo: tipo, p_storage_path: path,
      p_mime_type: file.type, p_size_bytes: file.size,
    });
    if (e2) {
      alert("Erro registro: " + e2.message);
      return;
    }
    set("uploads", [...list, { tipo, path, name: file.name, size: file.size }]);
  };

  return (
    <>
      <div className="text-xs text-muted-foreground mb-3">
        Subir fotos legíveis dos documentos. Aceita PDF, JPG e PNG até 10MB cada.
        Os marcados com <span className="text-amber-400 font-bold">*</span> são obrigatórios.
      </div>
      <div className="space-y-2">
        {TIPOS.map((t) => {
          const uploaded = list.filter((u) => u.tipo === t.key);
          const ok = uploaded.length > 0;
          return (
            <div key={t.key} className={`flex items-center justify-between gap-2 p-3 rounded ${
              t.req && !ok ? "bg-amber-500/10 border border-amber-500/30" : "bg-secondary/30"}`}>
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {ok ? `✓ ${uploaded.length} arquivo(s) enviados` : (t.req ? "Pendente — obrigatório" : "Não enviado")}
                </div>
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*,.pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, t.key); }} />
                <span className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5">
                  <Upload size={12} /> Enviar
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AssinaturaStep({ data, set }: { data: any; set: (p: string, v: any) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const [hasContent, setHasContent] = useState(!!data?.assinatura?.png);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (data?.assinatura?.png) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, c.width, c.height); };
      img.src = data.assinatura.png;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getPos = (ev: any): { x: number; y: number } => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const t = ev.touches?.[0];
    const cx = t ? t.clientX : ev.clientX;
    const cy = t ? t.clientY : ev.clientY;
    return {
      x: ((cx - rect.left) / rect.width) * c.width,
      y: ((cy - rect.top) / rect.height) * c.height,
    };
  };
  const start = (ev: any) => { ev.preventDefault(); drawing.current = true; lastPt.current = getPos(ev); };
  const move = (ev: any) => {
    if (!drawing.current) return;
    ev.preventDefault();
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = getPos(ev);
    const lp = lastPt.current!;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPt.current = p;
    if (!hasContent) setHasContent(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPt.current = null;
    const c = canvasRef.current!;
    const png = c.toDataURL("image/png");
    set("assinatura", { png, ts: new Date().toISOString() });
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasContent(false);
    set("assinatura", null);
  };

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-3">
        Assina abaixo com o dedo (mobile) ou mouse. Essa assinatura confirma que tudo que tu preencheu acima
        está correto e dá início ao processo de admissão na empresa.
      </div>
      <div className="border-2 border-dashed border-border rounded-md bg-white">
        <canvas
          ref={canvasRef}
          width={800} height={260}
          style={{ width: "100%", height: 260, touchAction: "none", cursor: "crosshair", display: "block" }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground underline">
          Limpar e assinar de novo
        </button>
        <div className="text-[10px] text-muted-foreground">
          {hasContent ? "✓ Assinatura registrada" : "Aguardando assinatura"}
        </div>
      </div>
      <div className="mt-4 p-3 bg-secondary/30 rounded text-[10px] text-muted-foreground">
        <strong>Importante:</strong> ao clicar em "Enviar formulário" você declara que as informações são
        verdadeiras e completas. A assinatura digital tem validade legal nos termos da MP 2.200-2/2001.
      </div>
    </div>
  );
}

function FullScreen({ children }: { children: any }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-3 bg-background">
      {children}
    </div>
  );
}
