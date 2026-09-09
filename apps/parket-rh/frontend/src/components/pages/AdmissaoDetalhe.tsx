/**
 * AdmissaoDetalhe — visão completa de UMA admissão pra revisão do RH.
 *
 * Mostra:
 *  - Header com nome, empresa, cargo, etapa atual
 *  - Form_data preenchido pelo funcionário (todas as 11 seções)
 *  - Assinatura digital (PNG)
 *  - Documentos uploaded (RG, CPF, comprovante, etc.)
 *  - Botões "Aprovar" / "Rejeitar" quando etapa = assinado | aguardando_aprovacao_rh
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Loader2, ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  User, MapPin, Phone, FileText, GraduationCap, Users, CreditCard, Heart, Shirt, Image as ImageIcon, PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { useFetch, api } from "@/lib/api";
import { fmtBRL, fmtCPF, fmtDate, fmtTel, initials } from "@/lib/format";

const ETAPA_LABEL: Record<string, { label: string; variant: any }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  convite_enviado: { label: "Convite enviado", variant: "warning" },
  formulario_em_preenchimento: { label: "Em preenchimento", variant: "warning" },
  formulario_completo: { label: "Formulário completo", variant: "secondary" },
  contrato_gerado: { label: "Contrato gerado", variant: "secondary" },
  aguardando_assinatura: { label: "Aguardando assinatura", variant: "warning" },
  assinado: { label: "Assinado", variant: "success" },
  aguardando_aprovacao_rh: { label: "Aguardando aprovação", variant: "warning" },
  aprovado_ativo: { label: "Aprovado", variant: "success" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
  expirado: { label: "Expirado", variant: "outline" },
};

type Admissao = any;

export function AdmissaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [adm, setAdm] = useState<Admissao | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const empresas = useFetch(() => api.empresas(), []);
  const cargos = useFetch(() => api.cargos(), []);
  const departamentos = useFetch(() => api.departamentos(), []);

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error: e } = await supabase.from("admissoes").select("*").eq("id", id).single();
      if (e) throw e;
      setAdm(data);
      const { data: docList } = await supabase.from("admissao_documentos")
        .select("*").eq("admissao_id", id).order("created_at");
      setDocs(docList || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar admissão");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, [id]); // eslint-disable-line

  const cargo = useMemo(() => cargos.data?.find((c) => c.id === adm?.cargo_id), [cargos.data, adm]);
  const dept = useMemo(() => departamentos.data?.find((d) => d.id === adm?.departamento_id), [departamentos.data, adm]);
  const empresa = useMemo(() => empresas.data?.find((e) => e.id === adm?.empresa_id), [empresas.data, adm]);

  if (loading) return (
    <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 size={14} className="animate-spin" /> Carregando admissão…
    </div>
  );
  if (error || !adm) return (
    <div className="p-8">
      <Card className="p-6 text-sm text-red-400">Erro: {error || "Admissão não encontrada"}</Card>
    </div>
  );

  const fd = adm.form_data || {};
  const etapaInfo = ETAPA_LABEL[adm.etapa] || { label: adm.etapa, variant: "outline" };
  const podeAprovar = ["assinado", "aguardando_aprovacao_rh", "formulario_completo"].includes(adm.etapa);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link to="/admissoes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft size={12} /> Voltar pra lista
        </Link>
        <Badge variant={etapaInfo.variant} className="text-xs">{etapaInfo.label}</Badge>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center text-base font-bold">
            {initials(adm.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold">{adm.nome}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{adm.email}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {empresa && <Badge variant="outline" className="text-[10px]">{empresa.nome_fantasia || empresa.razao_social}</Badge>}
              {cargo && <Badge variant="outline" className="text-[10px]">{cargo.nome}</Badge>}
              {dept && <Badge variant="outline" className="text-[10px]">{dept.nome}</Badge>}
              {adm.salario_proposto && <Badge variant="outline" className="text-[10px]">{fmtBRL(Number(adm.salario_proposto))}</Badge>}
              {adm.data_admissao_prevista && <Badge variant="outline" className="text-[10px]">Início: {fmtDate(adm.data_admissao_prevista)}</Badge>}
            </div>
          </div>
        </div>
      </Card>

      {/* Aprovação RH */}
      {podeAprovar && (
        <ApprovalActions admissao={adm} onChanged={reload} navigate={navigate} />
      )}

      {/* Aviso se ainda não preencheu */}
      {!adm.preenchido_em && (
        <Card className="p-6 border-amber-500/40 bg-amber-500/10 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <div className="text-sm text-amber-300">
            O funcionário ainda não preencheu o formulário. Use o botão de compartilhar na lista pra reenviar o link.
          </div>
        </Card>
      )}

      {/* Dados preenchidos */}
      {Object.keys(fd).length > 0 && (
        <>
          <SectionBlock icon={User} title="Dados pessoais" empty={!fd.pessoais}>
            {fd.pessoais && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                <Row label="Nome completo" value={fd.pessoais.nome} />
                <Row label="Nome social" value={fd.pessoais.nome_social} />
                <Row label="Data nascimento" value={fmtDate(fd.pessoais.data_nascimento)} />
                <Row label="Sexo" value={fd.pessoais.sexo} />
                <Row label="Gênero documento" value={fd.pessoais.genero_documento} />
                <Row label="Estado civil" value={fd.pessoais.estado_civil} />
                <Row label="Cor / Raça" value={fd.pessoais.raca_cor} />
                <Row label="Nacionalidade" value={fd.pessoais.nacionalidade} />
                <Row label="UF natal" value={fd.pessoais.uf_natal} />
                <Row label="Cidade natal" value={fd.pessoais.cidade_natal} />
                <Row label="Nome da mãe" value={fd.pessoais.nome_mae} />
                <Row label="Nome do pai" value={fd.pessoais.nome_pai} />
              </div>
            )}
          </SectionBlock>

          <SectionBlock icon={Phone} title="Contatos" empty={!fd.contatos}>
            {fd.contatos && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                <Row label="Celular" value={fmtTel(fd.contatos.celular)} />
                <Row label="Telefone fixo" value={fd.contatos.telefone} />
                <Row label="Email pessoal" value={fd.contatos.email} />
                <Row label="WhatsApp consente" value={fd.contatos.whatsapp_consente ? "Sim" : "Não"} />
              </div>
            )}
          </SectionBlock>

          <SectionBlock icon={MapPin} title="Endereço" empty={!fd.endereco}>
            {fd.endereco && (
              <div className="text-sm">
                {[fd.endereco.logradouro, fd.endereco.numero, fd.endereco.complemento].filter(Boolean).join(", ")}
                <br />
                <span className="text-muted-foreground">
                  {fd.endereco.bairro && `${fd.endereco.bairro} · `}
                  {fd.endereco.cidade && `${fd.endereco.cidade}/`}
                  {fd.endereco.uf}
                  {fd.endereco.cep && ` · CEP ${fd.endereco.cep}`}
                </span>
              </div>
            )}
          </SectionBlock>

          <SectionBlock icon={FileText} title="Documentos" empty={!fd.documentos}>
            {fd.documentos && (
              <div className="space-y-3">
                <SubGroup label="CPF / RG">
                  <Row label="CPF" value={fd.documentos.cpf ? fmtCPF(fd.documentos.cpf) : null} />
                  <Row label="RG" value={fd.documentos.rg_numero} />
                  <Row label="RG órgão" value={`${fd.documentos.rg_orgao || ""}/${fd.documentos.rg_uf || ""}`.replace(/^\/|\/$/g, "")} />
                  <Row label="RG emissão" value={fmtDate(fd.documentos.rg_data)} />
                </SubGroup>
                <SubGroup label="CTPS / PIS">
                  <Row label="CTPS" value={`${fd.documentos.ctps_numero || ""} / ${fd.documentos.ctps_serie || ""}`.replace(/^ \/ $|^\/ $| \/ $/g, "")} />
                  <Row label="UF CTPS" value={fd.documentos.ctps_uf} />
                  <Row label="PIS / PASEP" value={fd.documentos.pis} />
                </SubGroup>
                <SubGroup label="Título / Reservista">
                  <Row label="Título eleitor" value={fd.documentos.titulo} />
                  <Row label="Zona" value={fd.documentos.titulo_zona} />
                  <Row label="Seção" value={fd.documentos.titulo_secao} />
                  <Row label="Reservista" value={fd.documentos.reservista} />
                </SubGroup>
                {(fd.documentos.cnh_numero || fd.documentos.cnh_validade) && (
                  <SubGroup label="CNH">
                    <Row label="CNH" value={fd.documentos.cnh_numero} />
                    <Row label="Categoria" value={fd.documentos.cnh_cat} />
                    <Row label="Validade" value={fmtDate(fd.documentos.cnh_validade)} />
                  </SubGroup>
                )}
              </div>
            )}
          </SectionBlock>

          {fd.estrangeiro?.sou_estrangeiro && (
            <SectionBlock icon={MapPin} title="Estrangeiro">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                <Row label="País origem" value={fd.estrangeiro.pais} />
                <Row label="Tipo de visto" value={fd.estrangeiro.visto} />
                <Row label="Data chegada" value={fmtDate(fd.estrangeiro.data_chegada)} />
                <Row label="Data naturalização" value={fmtDate(fd.estrangeiro.data_naturalizacao)} />
                <Row label="Casado(a) c/ brasileiro(a)" value={fd.estrangeiro.casado_brasileiro ? "Sim" : "Não"} />
                <Row label="Tem filho(a) brasileiro(a)" value={fd.estrangeiro.filho_brasileiro ? "Sim" : "Não"} />
                <Row label="Passaporte" value={fd.estrangeiro.passaporte} />
              </div>
            </SectionBlock>
          )}

          <SectionBlock icon={GraduationCap} title="Formação acadêmica" empty={!fd.formacao}>
            {fd.formacao && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                <Row label="Escolaridade" value={fd.formacao.escolaridade} />
                <Row label="Instituição" value={fd.formacao.instituicao} />
                <Row label="Curso" value={fd.formacao.curso} />
                <Row label="Ano conclusão" value={fd.formacao.ano} />
              </div>
            )}
          </SectionBlock>

          <SectionBlock icon={Users} title={`Dependentes (${(fd.dependentes || []).length})`} empty={!fd.dependentes?.length}>
            {(fd.dependentes || []).map((d: any, i: number) => (
              <Card key={i} className="p-3 mb-2 bg-secondary/20">
                <div className="text-sm font-semibold mb-1.5">{d.nome || `Dependente ${i + 1}`}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  <Row label="CPF" value={d.cpf ? fmtCPF(d.cpf) : null} />
                  <Row label="Nascimento" value={fmtDate(d.nascimento)} />
                  <Row label="Parentesco" value={d.parentesco} />
                  <Row label="IRRF" value={d.irrf ? "Sim" : "Não"} />
                  <Row label="Salário-família" value={d.salario_familia ? "Sim" : "Não"} />
                  <Row label="Plano de saúde" value={d.plano_saude ? "Sim" : "Não"} />
                </div>
              </Card>
            ))}
          </SectionBlock>

          <SectionBlock icon={CreditCard} title="Dados bancários / PIX" empty={!fd.bancarios}>
            {fd.bancarios && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                <Row label="Banco" value={fd.bancarios.banco} />
                <Row label="Tipo de conta" value={fd.bancarios.tipo} />
                <Row label="Agência" value={fd.bancarios.agencia} />
                <Row label="Conta" value={`${fd.bancarios.conta || ""}${fd.bancarios.digito ? "-" + fd.bancarios.digito : ""}`} />
                <Row label="PIX (tipo)" value={fd.bancarios.pix_tipo} />
                <Row label="PIX (chave)" value={fd.bancarios.pix_chave} />
              </div>
            )}
          </SectionBlock>

          <SectionBlock icon={Heart} title={`Contatos de emergência (${(fd.emergencia || []).length})`} empty={!fd.emergencia?.length}>
            {(fd.emergencia || []).map((c: any, i: number) => (
              <Card key={i} className="p-3 mb-2 bg-secondary/20">
                <div className="text-sm font-semibold mb-1.5">{c.nome}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  <Row label="Relação" value={c.relacao} />
                  <Row label="Celular" value={fmtTel(c.celular)} />
                  <Row label="Telefone" value={c.telefone} />
                  <Row label="Email" value={c.email} />
                </div>
              </Card>
            ))}
          </SectionBlock>

          <SectionBlock icon={Shirt} title="EPI / Uniforme" empty={!fd.epi}>
            {fd.epi && (
              <div className="grid grid-cols-3 gap-x-6 gap-y-2.5">
                <Row label="Camiseta" value={fd.epi.camiseta} />
                <Row label="Calça" value={fd.epi.calca} />
                <Row label="Bota" value={fd.epi.bota} />
              </div>
            )}
          </SectionBlock>
        </>
      )}

      {/* Documentos uploaded */}
      <SectionBlock icon={ImageIcon} title={`Documentos enviados (${docs.length})`} empty={docs.length === 0}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {docs.map((d) => (
            <DocPreview key={d.id} doc={d} />
          ))}
        </div>
      </SectionBlock>

      {/* Assinatura digital */}
      {adm.assinatura?.png && (
        <SectionBlock icon={PenTool} title="Assinatura digital">
          <div className="bg-white rounded-md border border-border p-4">
            <img src={adm.assinatura.png} alt="Assinatura"
              className="max-w-full max-h-48 mx-auto" />
          </div>
          <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
            <div>Assinado em: <strong>{fmtDate(adm.assinatura.assinado_em || adm.contrato_assinado_em)}</strong></div>
            {adm.assinatura.nome_assinante && <div>Nome do assinante: {adm.assinatura.nome_assinante}</div>}
            {adm.assinatura.ip_user_agent && (
              <div className="font-mono text-[9px] break-all">UA: {adm.assinatura.ip_user_agent}</div>
            )}
          </div>
        </SectionBlock>
      )}

      {adm.rejeitado_motivo && (
        <Card className="p-4 border-red-500/40 bg-red-500/10">
          <div className="text-xs font-semibold text-red-300 mb-1">Motivo da rejeição</div>
          <div className="text-sm">{adm.rejeitado_motivo}</div>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Approval actions
// ────────────────────────────────────────────────────────────────
function ApprovalActions({ admissao, onChanged, navigate }: {
  admissao: any; onChanged: () => void; navigate: any;
}) {
  const [showReject, setShowReject] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const aprovar = async () => {
    if (!confirm(`Aprovar admissão de ${admissao.nome}? Vai virar colaborador ativo.`)) return;
    setErr(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.from("admissoes").update({
        etapa: "aprovado_ativo",
        aprovado_em: new Date().toISOString(),
      }).eq("id", admissao.id);
      if (error) throw error;
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const rejeitar = async () => {
    if (!motivo.trim()) { setErr("Informe o motivo"); return; }
    setErr(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.from("admissoes").update({
        etapa: "rejeitado",
        rejeitado_motivo: motivo.trim(),
      }).eq("id", admissao.id);
      if (error) throw error;
      setShowReject(false);
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-5 border-primary/40">
      <div className="text-sm font-semibold mb-1">Revisão do RH</div>
      <div className="text-xs text-muted-foreground mb-4">
        Confira as informações abaixo. Se estiver tudo certo, aprove pra criar o colaborador ativo.
        Se houver problema, rejeite com o motivo (a admissão pode ser refeita).
      </div>
      {err && <div className="text-xs text-red-400 mb-3">{err}</div>}
      {!showReject ? (
        <div className="flex gap-2">
          <Button onClick={aprovar} disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Aprovar admissão
          </Button>
          <Button variant="outline" onClick={() => setShowReject(true)} disabled={submitting}>
            <XCircle size={12} /> Rejeitar
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da rejeição (ex: documento ilegível, dados incorretos)…" />
          <div className="flex gap-2">
            <Button onClick={rejeitar} disabled={submitting || !motivo.trim()}
              className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              Confirmar rejeição
            </Button>
            <Button variant="outline" onClick={() => { setShowReject(false); setErr(null); }}>Cancelar</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function DocPreview({ doc }: { doc: any }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!doc.storage_path) return;
    supabase.storage.from("rh-admissao-docs")
      .createSignedUrl(doc.storage_path, 3600)
      .then(({ data }) => { if (alive && data?.signedUrl) setUrl(data.signedUrl); });
    return () => { alive = false; };
  }, [doc.storage_path]);

  const isImage = (doc.mime_type || "").startsWith("image/");
  return (
    <a href={url || "#"} target="_blank" rel="noopener noreferrer" className="block">
      <Card className="p-2 hover:bg-secondary/50 transition cursor-pointer">
        <div className="aspect-square bg-secondary rounded overflow-hidden flex items-center justify-center mb-1.5">
          {url && isImage ? (
            <img src={url} alt={doc.tipo} className="w-full h-full object-cover" />
          ) : (
            <FileText size={28} className="text-muted-foreground" />
          )}
        </div>
        <div className="text-[10px] font-semibold truncate">{doc.tipo}</div>
        <div className="text-[9px] text-muted-foreground">{Math.round((doc.size_bytes || 0) / 1024)} KB</div>
      </Card>
    </a>
  );
}

// ────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────
function SectionBlock({ icon: Icon, title, children, empty }: {
  icon: any; title: string; children: any; empty?: boolean;
}) {
  if (empty) return null;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-primary" />
        <div className="text-xs font-bold uppercase tracking-wider">{title}</div>
      </div>
      {children}
    </Card>
  );
}

function SubGroup({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  const v = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-muted-foreground min-w-[110px]">{label}:</span>
      <span className="font-medium flex-1">{v}</span>
    </div>
  );
}
