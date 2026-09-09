/**
 * SolicitarOrcamentoModal — formulário do vendedor pra solicitar orçamento.
 *
 * Replica o fluxo do Space:
 *  - INSERT em orcamento_demandas + kanban_cards (dept=orcamento, col=solicitacao)
 *  - Auto-atribui o orçamentista vinculado ao vendedor (user_profiles.orcamentista_padrao_id)
 *  - Tag criado_via=orcamento-picker pra satisfazer RLS
 *  - Aparece em valor.parket.works (mesmo backend Supabase)
 *
 * Reúne os MESMOS campos do form "Adicionar Lead" + dados do card pra entregar
 * o pacote completo ao orçamentista (cidade, endereço, condomínio, produtos
 * multi-select, metragem, previsão, observações + contatos adicionais e anexos
 * já existentes no card como read-only).
 */
import { useEffect, useMemo, useState } from "react";
import { X, Loader2, CheckCircle2, AlertCircle, Calculator, Flag, Calendar, FileText, Package, Ruler, Users, MapPin, Building2, Phone, Mail, Paperclip, Link as LinkIcon, ExternalLink, Plus, Trash2, Sparkles } from "lucide-react";
import { api, type OrcamentistaEquipe, type KanbanCard } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { CondominioInput } from "../CondominioInput";
import type { AppUser } from "../../lib/auth";
import { uploadAnexo } from "../../lib/anexo-upload";
import { TecaOrcamentoWizard } from "./TecaOrcamentoWizard";

// Mesma lista do NovoLeadModal pra consistência
const PRODUTOS_DISPONIVEIS = ["Piso", "Deck", "Painel", "Forro", "Porta", "Marcenaria", "Revestimento", "Rodapé", "Escada", "Brise", "Sauna"] as const;

const PRIORIDADES: { key: "baixa" | "normal" | "alta"; label: string; color: string }[] = [
  { key: "baixa",  label: "Baixa",  color: "text-hb-textDim border-hb-textDim/40" },
  { key: "normal", label: "Normal", color: "text-hb-accent border-hb-accent/40" },
  { key: "alta",   label: "Alta",   color: "text-hb-red border-hb-red/40" },
];

/** Formata phone do WhatsApp (com DDI BR) pra padrão visual brasileiro.
 *  Ex.: 5511995332736 → (11) 99533-2736 */
function formatPhoneBR(raw: string): string {
  const s = String(raw || "").replace(/\D/g, "");
  // Tira o 55 do BR se tiver
  const local = s.length === 13 && s.startsWith("55") ? s.slice(2)
              : s.length === 12 && s.startsWith("55") ? s.slice(2)
              : s;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return raw;
}

/** Normaliza datas pra YYYY-MM-DD (formato do input type=date).
 *  Aceita: "2026-09-15" (já ISO), "15/09/2026" (BR), Date objects. */
function normalizeDateISO(raw: any): string {
  if (!raw) return "";
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  // Já ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // BR DD/MM/YYYY?
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const [, d, m, y] = br;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Outros: tenta parse e devolve ISO
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

/** Tenta extrair lista de produtos de um valor que pode ser string CSV, array ou texto livre. */
function parseProdutos(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  const s = String(raw);
  // CSV ou separado por +/,/·
  const parts = s.split(/[,+·;]/).map((p) => p.trim()).filter(Boolean);
  // Normaliza casing — bate com PRODUTOS_DISPONIVEIS quando possível
  const norm = parts.map((p) => {
    const match = PRODUTOS_DISPONIVEIS.find((d) => d.toLowerCase() === p.toLowerCase());
    return match || p;
  });
  return Array.from(new Set(norm));
}

export function SolicitarOrcamentoModal({ card, appUser, onClose, onCreated }: {
  card: KanbanCard;
  appUser: AppUser;
  onClose: () => void;
  onCreated?: (ids: { demanda_id: string; card_orc_id: string }) => void;
}) {
  const det = (card.details as any) || {};

  // Equipe + orçamentista padrão
  const [equipe, setEquipe] = useState<OrcamentistaEquipe[]>([]);
  const [orcamentistaPadrao, setOrcamentistaPadrao] = useState<string | null>(null);
  const [orcamentistaId, setOrcamentistaId] = useState<string>("");

  // Mapeamento amplo dos campos do card — cobre todas as variações de chave
  // que apareceram em cards antigos/Space/Teca/forms diferentes.
  // Lista completa baseada em estatística do banco (descending por uso):
  //   celular(2023) > telefone_comercial(749) > telefone(155)
  //   cidade(1105)
  //   metragem_estimada(836) > area_m2(701) > metragem(31)
  //   endereco_obra(510) > endereco(447)
  //   previsao_inicio(451) > previsao_instalacao(173)
  //   observacoes(450) > observacao_lead(67) > observacao(8) > orc_observacoes(449)
  //   email(299) > email_comercial(65) > email_pessoal(54) > outro_email(1)
  const [celular, setCelular] = useState<string>(() => {
    const raw = det.celular || det.telefone_comercial || det.telefone
             || det.whatsapp || det.tel_direto_comercial || det.outro_telefone || "";
    return raw ? formatPhoneBR(raw) : "";
  });
  const [email, setEmail] = useState<string>(
    det.email || det.email_comercial || det.email_pessoal || det.outro_email
    || (Array.isArray(det.emails) ? det.emails.find(Boolean) : null)
    || ""
  );

  // Endereço / local — endereco_obra é o mais comum nos cards do Space
  const [cidade, setCidade] = useState<string>(det.cidade || det.city || "");
  const [condominio, setCondominio] = useState<string>(
    det.condominio || det.edificio || det.residencial || ""
  );
  const [endereco, setEndereco] = useState<string>(
    det.endereco_obra || det.endereco || det.endereco_completo || ""
  );

  // Produtos + medidas
  const [produtos, setProdutos] = useState<string[]>(
    parseProdutos(det.produtos_lista || det.produtos || det.produto_interesse || det.produto || det.relacao_obra)
  );
  // Metragem POR produto (Piso 120, Painel 45, ...). Legado = 1 campo único
  // agora vira N campos, um por produto selecionado. `metragem` no payload =
  // soma das partes (compat com backend/Valoria/proposta).
  const _metragemLegada = Number(
    det.metragem_estimada || det.area_m2 || det.metragem || det.metros || det.m2
    || det.area_m2_total || det.area_aplicacao || det.orc_metragem_real || 0
  ) || 0;
  const _metragensSalvas = (det.metragens_por_produto && typeof det.metragens_por_produto === "object")
    ? det.metragens_por_produto as Record<string, number> : null;
  const [metragensPorProduto, setMetragensPorProduto] = useState<Record<string, number | "">>(() => {
    const out: Record<string, number | ""> = {};
    const iniciais = parseProdutos(det.produtos_lista || det.produtos || det.produto_interesse || det.produto || det.relacao_obra);
    for (const p of iniciais) {
      if (_metragensSalvas && typeof _metragensSalvas[p] === "number") out[p] = _metragensSalvas[p];
      else if (_metragemLegada > 0) out[p] = _metragemLegada;
      else out[p] = "";
    }
    return out;
  });
  const metragem = Object.values(metragensPorProduto).reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
  const [previsaoInstalacao, setPrevisaoInstalacao] = useState<string>(
    // previsao_inicio é o mais comum (451); previsao_instalacao em segundo (173).
    // Datas vêm em vários formatos (YYYY-MM-DD ou DD/MM/YYYY) — normaliza pro input date.
    normalizeDateISO(det.previsao_instalacao || det.previsao_inicio || det.previsao || det.prazo || det.prazo_contratual)
  );

  // Workflow
  const [prioridade, setPrioridade] = useState<"baixa" | "normal" | "alta">("normal");
  const [prazoDias, setPrazoDias] = useState<number | "">(4);
  const [observacoes, setObservacoes] = useState<string>(
    det.observacoes || det.observacao_lead || det.observacao
    || det.obs_solicitacao || det.lembrete_observacao || ""
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [criado, setCriado] = useState(false);

  // Anexos novos adicionados NESTE formulário (upload pro DRIVE do cliente,
  // resumable via gestao API, sem teto de tamanho; Supabase aposentado
  // PKT-HB-DRIVE-20260902B). Vão junto da demanda + persistidos no card.
  const [anexosNovos, setAnexosNovos] = useState<Array<{ name: string; url: string; bytes: number; mimeType: string }>>([]);
  const [linkInputUrl, setLinkInputUrl] = useState("");
  const [linkInputName, setLinkInputName] = useState("");
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);

  const doUploadAnexos = async (files: File[]) => {
    // Pasta do cliente resolvida 1x pro lote; se nascer agora (ensure-folder),
    // persiste drive_folder_id no card pra reuso em uploads futuros.
    let folderId: string | undefined = det.drive_folder_id;
    for (const f of files) {
      setUploadingFile(f.name);
      try {
        const up = await uploadAnexo(f, card.id, {
          driveFolderId: folderId,
          clientName: cliente,
          onFolder: (info) => {
            folderId = info.folderId;
            void supabase.from("kanban_cards")
              .update({ details: { ...det, drive_folder_id: info.folderId, drive_folder_url: info.folderUrl } })
              .eq("id", card.id)
              .then(() => {});
          },
          onProgress: (frac) => setUploadingFile(`${f.name} (${Math.round(frac * 100)}%)`),
        });
        setAnexosNovos((cur) => [...cur, { name: up.name, url: up.url, bytes: up.size, mimeType: up.mimeType }]);
      } catch (err: any) { setError(`Falha ao subir ${f.name}: ${err?.message}`); break; }
    }
    setUploadingFile(null);
  };

  // Carrega equipe + orçamentista padrão do vendedor logado
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [eq, padrao] = await Promise.all([
          api.equipeOrcamento(),
          supabase.from("user_profiles")
            .select("orcamentista_padrao_id")
            .eq("id", appUser.id)
            .maybeSingle()
            .then((r) => r.data?.orcamentista_padrao_id || null),
        ]);
        if (!alive) return;
        setEquipe(eq);
        setOrcamentistaPadrao(padrao);
        const initial = padrao && eq.find((o) => o.id === padrao) ? padrao : (eq[0]?.id || "");
        setOrcamentistaId(initial);
      } catch (e: any) {
        setError(e?.message || "Falha ao carregar equipe.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [appUser.id]);

  // Fallback do celular — quando details não tem, busca o phone da última msg WhatsApp do card.
  // Acontece em cards antigos onde o número só ficou na tabela whatsapp_messages.
  useEffect(() => {
    if (celular.trim()) return;  // já tem, não precisa buscar
    let alive = true;
    (async () => {
      const r = await supabase
        .from("whatsapp_messages")
        .select("phone")
        .eq("card_id", card.id)
        .not("phone", "is", null)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive || !r.data?.phone) return;
      setCelular(formatPhoneBR(r.data.phone));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const orcamentistaSelecionado = useMemo(
    () => equipe.find((o) => o.id === orcamentistaId),
    [equipe, orcamentistaId]
  );

  // Card HB grava title concatenado "Cliente — Arq Nome" (NovoLead:api.ts:1062).
  // Aqui separa: cliente puro pro campo Cliente do Valor, arquiteto pro campo próprio.
  // Fonte primária = details.arquitetura (populado no NovoLead); fallback = sufixo
  // "— Arq X" do title. Cards antigos sem arquitetura em details caem no fallback.
  const titleRaw = card.title || "Cliente";
  const arqDoTitle = titleRaw.match(/\s*[—–-]\s*Arq(?:\.|uiteto|uiteta)?\s+(.+)$/i)?.[1]?.trim() || "";
  const clienteLimpo = titleRaw.replace(/\s*[—–-]\s*Arq(?:\.|uiteto|uiteta)?\s+.+$/i, "").trim() || "Cliente";
  const arquiteto = (det.arquitetura as string) || (det.arquiteto as string) || arqDoTitle || "";
  const cliente = clienteLimpo;
  const vendedor = card.responsavel || appUser.nome || appUser.email;

  // Contatos adicionais e anexos vêm direto do card (read-only no modal).
  // Anexos podem estar em `details.attachments` (form NovoLead, 45 cards no DB)
  // OU em `details.anexos` (chave usada no Space/CardDetail). Faço merge das 2.
  const contatosAdicionais = Array.isArray(det.contatos_adicionais) ? det.contatos_adicionais : [];
  const anexosCard = useMemo(() => {
    const fromAttachments = Array.isArray(det.attachments) ? det.attachments : [];
    const fromAnexos = Array.isArray(det.anexos) ? det.anexos : [];
    // Dedup por URL pra não duplicar quando o mesmo arquivo estiver nas 2 chaves
    const seen = new Set<string>();
    const all: any[] = [];
    [...fromAttachments, ...fromAnexos].forEach((a: any) => {
      if (!a || !a.url || seen.has(a.url)) return;
      seen.add(a.url);
      all.push({
        url: a.url,
        name: a.name || "anexo",
        bytes: a.bytes || a.size || 0,
        mimeType: a.mimeType || a.type || a.contentType || "",
      });
    });
    return all;
  }, [det.attachments, det.anexos]);
  const linksCard = Array.isArray(det.links) ? det.links : [];

  const toggleProduto = (p: string) => {
    setProdutos((arr) => {
      const on = arr.includes(p);
      setMetragensPorProduto((cur) => {
        if (on) {
          const { [p]: _drop, ...rest } = cur;
          return rest;
        }
        // ao ligar: reaproveita valor salvo, senão vazio
        return { ...cur, [p]: (cur[p] !== undefined ? cur[p] : "") };
      });
      return on ? arr.filter((x) => x !== p) : [...arr, p];
    });
  };

  const podeSalvar = !!orcamentistaId && !saving && !loading && produtos.length > 0;

  // Modo Teca IA — passo a passo pra gerar o orçamento automaticamente
  const [tecaMode, setTecaMode] = useState(false);

  /** Cria a demanda + card pelo fluxo normal. Compartilhado entre o salvar
   *  manual e o wizard da Teca (que depois insere a simulação na Valoria). */
  const criarSolicitacao = async (viaTeca: boolean) => {
    if (!orcamentistaSelecionado) throw new Error("Selecione um orçamentista.");
    const prazoData = prazoDias === "" ? undefined : (() => {
      const d = new Date(); d.setDate(d.getDate() + Number(prazoDias));
      return d.toISOString().slice(0, 10);
    })();

    const obs = viaTeca
      ? [observacoes.trim(), "[Orçamento montado automaticamente pela Teca IA — revisar a simulação gerada antes de enviar]"].filter(Boolean).join("\n\n")
      : observacoes.trim();

    const r = await api.solicitarOrcamento({
      parent_card_id: card.id,
      titulo: cliente,
      arquiteto: arquiteto || undefined,
      orcamentista_id: orcamentistaSelecionado.id,
      orcamentista_nome: orcamentistaSelecionado.nome,
      vendedor_nome: vendedor,
      criado_por: appUser.nome || appUser.email,
      contato_celular: celular.trim() || undefined,
      contato_email: email.trim() || undefined,
      cidade: cidade.trim() || undefined,
      condominio: condominio.trim() || undefined,
      endereco: endereco.trim() || undefined,
      produtos: produtos.length > 0 ? produtos : undefined,
      metragem: metragem > 0 ? metragem : undefined,
      metragens_por_produto: Object.keys(metragensPorProduto).length > 0
        ? Object.fromEntries(
            Object.entries(metragensPorProduto)
              .filter(([, v]) => Number(v) > 0)
              .map(([k, v]) => [k, Number(v)])
          )
        : undefined,
      previsao_instalacao: previsaoInstalacao || undefined,
      contatos_adicionais: contatosAdicionais.length > 0 ? contatosAdicionais : undefined,
      // Anexos do card (herdados) + os novos subidos neste form.
      anexos: [...anexosCard, ...anexosNovos].length > 0 ? [...anexosCard, ...anexosNovos] : undefined,
      prioridade,
      prazo_horas: prazoDias === "" ? undefined : Number(prazoDias) * 24,
      prazo_unidade: "dias",
      prazo_data: prazoData,
      observacoes: obs || undefined,
    });
    // Persiste os anexos novos no card (merge com anexos existentes)
    // pra ficarem visíveis no accordion Anexos & Links.
    if (anexosNovos.length > 0) {
      const currentAnexos = Array.isArray(det.anexos) ? det.anexos : [];
      const merged = [...currentAnexos, ...anexosNovos.map((a) => ({
        name: a.name, url: a.url, type: a.mimeType, size: a.bytes,
        uploaded_at: new Date().toISOString(),
        uploaded_by: appUser.nome || appUser.email || "?",
        kind: a.mimeType === "link" ? "link" : "file",
      }))];
      await supabase.from("kanban_cards").update({ details: { ...det, anexos: merged } }).eq("id", card.id);
    }
    return r;
  };

  const salvar = async () => {
    if (!podeSalvar || !orcamentistaSelecionado) return;
    setSaving(true);
    setError(null);
    try {
      const r = await criarSolicitacao(false);
      setCriado(true);
      onCreated?.(r);
      setTimeout(() => onClose(), 1400);
    } catch (e: any) {
      setError(e?.message || "Falha ao solicitar orçamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-hb-panel border border-hb-border w-full max-w-2xl max-h-[92vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-hb-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="block w-[3px] h-[14px] bg-hb-accent shrink-0" />
            <h2 className="text-[11px] font-display uppercase text-hb-text" style={{ letterSpacing: "0.22em" }}>
              Solicitar Orçamento
            </h2>
            <span className="text-[9px] text-hb-textDim uppercase ml-2 truncate" style={{ letterSpacing: "0.14em" }}>
              · {cliente}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-hb-textDim hover:text-hb-text shrink-0">
            <X size={14} />
          </button>
        </div>

        {tecaMode ? (
          <TecaOrcamentoWizard
            seed={{
              cliente,
              vendedor,
              cidade: cidade.trim() || undefined,
              condominio: condominio.trim() || undefined,
              endereco: endereco.trim() || undefined,
              produtos,
              metragem: metragem > 0 ? metragem : null,
              metragens_por_produto: Object.fromEntries(
                Object.entries(metragensPorProduto)
                  .filter(([, v]) => Number(v) > 0)
                  .map(([k, v]) => [k, Number(v)])
              ),
              observacoes: observacoes.trim() || undefined,
            }}
            criarSolicitacao={async () => {
              const r = await criarSolicitacao(true);
              onCreated?.(r);
              return r;
            }}
            onVoltar={() => setTecaMode(false)}
            onConcluido={onClose}
          />
        ) : (<>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* SEÇÃO 1 — Cliente / Vendedor / Orçamentista */}
          <Section icon={<Users size={10} />} label="Quem">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente">
                <div className="hb-orc-readonly">{cliente}</div>
              </Field>
              <Field label="Vendedor">
                <div className="hb-orc-readonly">{vendedor}</div>
              </Field>
            </div>
            <Field label="Orçamentista responsável *" icon={<Calculator size={9} />} className="mt-3">
              {loading ? (
                <div className="hb-orc-input text-hb-textDim inline-flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" /> Carregando equipe…
                </div>
              ) : (
                <select value={orcamentistaId} onChange={(e) => setOrcamentistaId(e.target.value)} className="hb-orc-input">
                  {equipe.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}{o.id === orcamentistaPadrao ? " (padrão deste vendedor)" : ""}{o.is_gestor ? " · gestor" : ""}
                    </option>
                  ))}
                </select>
              )}
              {orcamentistaPadrao && orcamentistaSelecionado?.id !== orcamentistaPadrao && (
                <div className="mt-1 text-[9px] text-hb-amber" style={{ letterSpacing: "0.04em" }}>
                  ⚠ Você escolheu um orçamentista diferente do padrão vinculado ao vendedor.
                </div>
              )}
            </Field>
          </Section>

          {/* SEÇÃO 2 — Contato principal (pré-preenchido do card, editável) */}
          <Section icon={<Phone size={10} />} label="Contato principal">
            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp / Telefone" icon={<Phone size={9} />}>
                <input value={celular} onChange={(e) => setCelular(e.target.value)}
                  placeholder="(11) 99999-9999" className="hb-orc-input" inputMode="tel" />
              </Field>
              <Field label="E-mail" icon={<Mail size={9} />}>
                <input value={email} onChange={(e) => setEmail(e.target.value)}
                  type="email" placeholder="email@dominio.com" className="hb-orc-input" />
              </Field>
            </div>
            {/* Contatos adicionais do card — read-only, vão junto na demanda */}
            {contatosAdicionais.length > 0 && (
              <div className="mt-3 pt-2 border-t border-hb-border">
                <div className="text-[9px] uppercase text-hb-textDim mb-1.5" style={{ letterSpacing: "0.14em" }}>
                  Contatos adicionais do projeto (do card, irão junto)
                </div>
                <div className="space-y-1">
                  {contatosAdicionais.map((c: any, i: number) => (
                    <div key={i} className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-hb-bg/40 border border-hb-border">
                      <span className="px-1 py-0.5 bg-hb-walnut/30 text-hb-cream uppercase text-[8px] font-bold" style={{ letterSpacing: "0.14em" }}>
                        {c.papel_label || c.papel}
                      </span>
                      <span className="font-semibold text-hb-text">{c.nome}</span>
                      {Array.isArray(c.telefones) && c.telefones.filter(Boolean).length > 0 && (
                        <span className="text-hb-textDim font-mono ml-1">📞 {c.telefones.filter(Boolean).join(" · ")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* SEÇÃO 3 — Endereço da obra */}
          <Section icon={<MapPin size={10} />} label="Endereço da obra">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade" icon={<MapPin size={9} />}>
                <input value={cidade} onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex.: São Paulo" className="hb-orc-input" />
              </Field>
              <Field label="Condomínio / Edifício" icon={<Building2 size={9} />}>
                <CondominioInput
                  value={condominio}
                  onChange={setCondominio}
                  placeholder="Comece a digitar — sugere existentes"
                  className="hb-orc-input"
                />
              </Field>
            </div>
            <Field label="Endereço completo" icon={<MapPin size={9} />} className="mt-3">
              <input value={endereco} onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, complemento, bairro" className="hb-orc-input" />
            </Field>
          </Section>

          {/* SEÇÃO 4 — Produtos + medidas */}
          <Section icon={<Package size={10} />} label="Produtos & medidas">
            <Field label="Produtos a orçar * (selecione um ou mais)" icon={<Package size={9} />}>
              <div className="flex flex-wrap gap-1">
                {PRODUTOS_DISPONIVEIS.map((p) => {
                  const on = produtos.includes(p);
                  return (
                    <button key={p} type="button" onClick={() => toggleProduto(p)}
                      className={`px-2 py-1 text-[9px] uppercase border transition ${
                        on ? "bg-hb-accent/15 border-hb-accent/60 text-hb-accent" : "border-hb-border text-hb-textDim hover:text-hb-text"
                      }`}
                      style={{ letterSpacing: "0.14em" }}>
                      {p}
                    </button>
                  );
                })}
              </div>
              {produtos.length === 0 && (
                <div className="mt-1 text-[9px] text-hb-amber">⚠ Selecione ao menos um produto.</div>
              )}
            </Field>
            {produtos.length > 0 && (
              <Field label={`Metragem (m²) por produto${produtos.length > 1 ? ` — total ${metragem.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²` : ""}`} icon={<Ruler size={9} />}>
                <div className="space-y-1.5">
                  {produtos.map((p) => {
                    const val = metragensPorProduto[p];
                    return (
                      <div key={p} className="grid grid-cols-[110px_1fr] items-center gap-2">
                        <span className="text-[10px] uppercase text-hb-text px-2 py-1 bg-hb-bg/40 border border-hb-border" style={{ letterSpacing: "0.14em" }}>
                          {p}
                        </span>
                        <div className="flex items-center gap-1">
                          <input type="number" inputMode="decimal" min={0} step="0.01"
                            value={val === undefined ? "" : val}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMetragensPorProduto((cur) => ({ ...cur, [p]: v === "" ? "" : Number(v) }));
                            }}
                            placeholder={`Ex.: 120`} className="hb-orc-input tabular text-right flex-1" />
                          <span className="text-[10px] text-hb-textDim">m²</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Field>
            )}
            <div className="mt-3">
              <Field label="Previsão de instalação" icon={<Calendar size={9} />}>
                <input type="date" value={previsaoInstalacao}
                  onChange={(e) => setPrevisaoInstalacao(e.target.value)}
                  className="hb-orc-input tabular" />
              </Field>
            </div>
          </Section>

          {/* SEÇÃO 5 — Workflow (prioridade + prazo) */}
          <Section icon={<Flag size={10} />} label="Prioridade & prazo do orçamento">
            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <Field label="Prioridade" icon={<Flag size={9} />}>
                <div className="flex gap-1">
                  {PRIORIDADES.map((p) => (
                    <button key={p.key} type="button" onClick={() => setPrioridade(p.key)}
                      className={`flex-1 px-2 py-1.5 text-[10px] uppercase border transition ${
                        prioridade === p.key ? `bg-hb-walnut/15 ${p.color}` : "border-hb-border text-hb-textDim hover:text-hb-text"
                      }`}
                      style={{ letterSpacing: "0.14em" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Prazo (dias)" icon={<Calendar size={9} />}>
                <input type="number" min={1} max={60} step={1}
                  value={prazoDias}
                  onChange={(e) => setPrazoDias(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="4"
                  className="hb-orc-input tabular text-right w-20" />
              </Field>
            </div>
          </Section>

          {/* SEÇÃO 6 — Observações */}
          <Section icon={<FileText size={10} />} label="Observações para o orçamentista">
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Contexto da obra, urgência, restrições, especificações de madeira/acabamento, preferências…"
              rows={4} className="hb-orc-input resize-none" />
          </Section>

          {/* SEÇÃO 6.5 — Anexos novos desta demanda (upload direto do computador) */}
          <Section icon={<Paperclip size={10} />} label={`Anexos desta demanda${anexosNovos.length > 0 ? ` (${anexosNovos.length})` : ""}`}>
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <label className={`flex-1 text-[10px] py-1.5 rounded border cursor-pointer inline-flex items-center justify-center gap-1 ${uploadingFile ? "border-hb-border text-hb-textDim" : "border-hb-accent/40 bg-hb-accent/10 text-hb-accent hover:bg-hb-accent/20"}`}
                  title="Sobe o arquivo do seu computador. Aceita PDFs, projetos, imagens.">
                  {uploadingFile ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                  {uploadingFile ? `enviando… ${uploadingFile.slice(0, 22)}` : "Upload de arquivo do computador"}
                  <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.dwg,.dxf,.skp"
                    disabled={!!uploadingFile}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const input = e.target as HTMLInputElement;
                      await doUploadAnexos(files);
                      input.value = "";
                    }}
                    className="hidden" />
                </label>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-1.5">
                <input value={linkInputUrl} onChange={(e) => setLinkInputUrl(e.target.value)}
                  placeholder="…ou cole um link (Drive, WeTransfer, Trello, etc)"
                  className="hb-orc-input" />
                <button type="button"
                  onClick={() => {
                    const url = linkInputUrl.trim();
                    if (!url) return;
                    setAnexosNovos((cur) => [...cur, { name: linkInputName.trim() || url, url, bytes: 0, mimeType: "link" }]);
                    setLinkInputUrl(""); setLinkInputName("");
                  }}
                  className="px-3 text-[10px] py-1.5 rounded border border-hb-border bg-hb-panelLight text-hb-text hover:bg-hb-bg inline-flex items-center gap-1"
                  style={{ letterSpacing: "0.14em" }}>
                  <LinkIcon size={10} /> Adicionar link
                </button>
              </div>
              {anexosNovos.length > 0 && (
                <div className="space-y-1 pt-1">
                  {anexosNovos.map((a, i) => (
                    <div key={i}
                      className="flex items-center gap-2 px-2 py-1.5 border border-hb-border bg-hb-bg/40 text-[10px] text-hb-text">
                      {a.mimeType === "link" ? <LinkIcon size={9} className="text-hb-accent shrink-0" /> : <Paperclip size={9} className="text-hb-accent shrink-0" />}
                      <a href={a.url} target="_blank" rel="noreferrer" className="truncate flex-1 hover:underline">{a.name}</a>
                      {a.bytes > 0 && <span className="text-[9px] text-hb-textDim tabular shrink-0">{Math.round(a.bytes / 1024)} KB</span>}
                      <button type="button" onClick={() => setAnexosNovos((cur) => cur.filter((_, j) => j !== i))}
                        className="text-hb-textDim hover:text-hb-red shrink-0" title="Remover">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* SEÇÃO 7 — Anexos do card (read-only). Lê tanto `attachments`
              (form NovoLead) quanto `anexos` (Space/CardDetail) — merge + dedup. */}
          {(anexosCard.length > 0 || linksCard.length > 0) && (
            <Section
              icon={<Paperclip size={10} />}
              label={`Anexos & links do card (${anexosCard.length + linksCard.length}) — vão junto na demanda`}>
              <div className="space-y-1">
                {anexosCard.map((a, i: number) => (
                  <a key={`f${i}`} href={a.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-2 py-1.5 border border-hb-border bg-hb-bg/40 hover:border-hb-accent/60 text-[10px] text-hb-text">
                    <Paperclip size={9} className="text-hb-textDim shrink-0" />
                    <span className="truncate flex-1">{a.name}</span>
                    {a.bytes > 0 && (
                      <span className="text-[9px] text-hb-textDim tabular shrink-0">{Math.round(a.bytes / 1024)} KB</span>
                    )}
                    <ExternalLink size={9} className="text-hb-textDim shrink-0" />
                  </a>
                ))}
                {linksCard.map((l: string, i: number) => (
                  <a key={`l${i}`} href={l} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-2 py-1.5 border border-hb-border bg-hb-bg/40 hover:border-hb-accent/60 text-[10px] text-hb-text">
                    <LinkIcon size={9} className="text-hb-textDim shrink-0" />
                    <span className="truncate flex-1">{l}</span>
                    <ExternalLink size={9} className="text-hb-textDim shrink-0" />
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-hb-border bg-hb-panelLight/40">
          <div className="text-[10px] min-h-[14px]">
            {error && (
              <span className="text-hb-red inline-flex items-center gap-1">
                <AlertCircle size={10} /> {error}
              </span>
            )}
            {criado && (
              <span className="text-hb-green inline-flex items-center gap-1">
                <CheckCircle2 size={10} /> Solicitação enviada · {orcamentistaSelecionado?.nome} foi notificado
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-[10px] uppercase border border-hb-border text-hb-textDim hover:text-hb-text transition"
              style={{ letterSpacing: "0.14em" }}>
              Cancelar
            </button>
            <button type="button" onClick={() => setTecaMode(true)} disabled={!podeSalvar}
              title="A Teca IA entrevista você passo a passo e monta o orçamento automaticamente na Valoria — ideal quando há lista de itens mas não há anexo."
              className="px-3 py-1.5 text-[10px] uppercase border border-hb-accent/50 text-hb-accent hover:bg-hb-accent/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
              style={{ letterSpacing: "0.14em", fontWeight: 600 }}>
              <Sparkles size={10} /> Gerar com Teca IA
            </button>
            <button type="button" onClick={salvar} disabled={!podeSalvar}
              className="px-4 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
              style={{ letterSpacing: "0.14em", fontWeight: 600 }}>
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Calculator size={10} />}
              {saving ? "Enviando" : "Solicitar Orçamento"}
            </button>
          </div>
        </div>
        </>)}
      </div>

      <style>{`
        .hb-orc-input {
          width: 100%;
          background: rgb(var(--hb-bg) / 1);
          border: 1px solid rgb(var(--hb-border) / 1);
          padding: 6px 9px;
          font-size: 11px;
          color: rgb(var(--hb-text) / 1);
          outline: none;
          transition: border-color .15s;
        }
        .hb-orc-input::placeholder { color: rgb(var(--hb-textDim) / 0.7); }
        .hb-orc-input:focus { border-color: rgb(var(--hb-accent) / 1); }
        .hb-orc-readonly {
          width: 100%;
          background: rgb(var(--hb-panel) / 1);
          border: 1px solid rgb(var(--hb-border) / 0.5);
          padding: 6px 9px;
          font-size: 11px;
          color: rgb(var(--hb-text) / 1);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="block w-[3px] h-[10px] bg-hb-cream/40" />
        <span className="text-[9px] text-hb-textDim uppercase inline-flex items-center gap-1" style={{ letterSpacing: "0.18em", fontWeight: 600 }}>
          {icon} {label}
        </span>
      </div>
      <div className="pl-2">{children}</div>
    </section>
  );
}

function Field({ label, icon, children, className }: { label: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ""}`}>
      <div className="text-[9px] uppercase text-hb-textDim mb-1 inline-flex items-center gap-1" style={{ letterSpacing: "0.14em" }}>
        {icon} {label}
      </div>
      {children}
    </label>
  );
}
