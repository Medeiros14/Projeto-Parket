/**
 * CardDetailPanel — painel lateral expandido (540px) com paridade ao
 * lead modal do Space v1 (SO Parket style).
 * Inclui: quick actions, controles (vendedor/SDR/etapa/orçamentista),
 * tags, 11 abas (Lead / Contato / Projeto / Qualificação / WhatsApp /
 * Teka / Pagamento / Anexos / Propostas / Notas / Atividade).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Phone, MessageCircle, ExternalLink, Pencil, Check, Loader2, Bell,
  Briefcase, DollarSign, ClipboardCheck, Paperclip, User, Activity,
  Bot, FileBarChart, StickyNote, MessageSquare, Trash2, ThumbsUp, ThumbsDown,
  Tag, Plus, Link2, Upload, RefreshCw, Megaphone, PhoneCall, Sparkles,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, Image as ImageIcon, FileText,
  Calendar, Video, MapPin,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { fmtBRL, fmtRelative, parseValueText } from "../lib/format";
import { api, type KanbanCard, type KanbanColumn } from "../lib/api";

type Tab =
  | "lead" | "contato" | "projeto" | "qualificacao" | "marketing"
  | "whatsapp" | "ligacoes" | "teka" | "ia" | "levantamento" | "orcamentos"
  | "diagrama" | "pagamento" | "anexos" | "propostas" | "notas"
  | "financeira" | "atividade";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "lead",         label: "LEAD",            icon: ThumbsUp },
  { key: "contato",      label: "CONTATO",         icon: User },
  { key: "projeto",      label: "PROJETO",         icon: Briefcase },
  { key: "qualificacao", label: "QUALIFICAÇÃO",    icon: ClipboardCheck },
  { key: "marketing",    label: "MARKETING",       icon: Megaphone },
  { key: "whatsapp",     label: "WHATSAPP",        icon: MessageCircle },
  { key: "ligacoes",     label: "LIGAÇÕES",        icon: PhoneCall },
  { key: "teka",         label: "TEKA",            icon: Bot },
  { key: "ia",           label: "IA COPILOTO",     icon: Sparkles },
  { key: "levantamento", label: "LEVANTAMENTO",    icon: ClipboardCheck },
  { key: "orcamentos",   label: "ORÇAMENTOS",      icon: FileText },
  { key: "diagrama",     label: "DIAGRAMA",        icon: ImageIcon },
  { key: "pagamento",    label: "PAGAMENTO",       icon: DollarSign },
  { key: "anexos",       label: "ANEXOS",          icon: Paperclip },
  { key: "propostas",    label: "PROPOSTAS · VIEWS", icon: FileBarChart },
  { key: "financeira",   label: "FINANCEIRA",      icon: DollarSign },
  { key: "notas",        label: "NOTAS",           icon: StickyNote },
  { key: "atividade",    label: "ATIVIDADE",       icon: Activity },
];

const PAG_DEFAULTS = {
  forma_pagamento:     "A combinar",
  pag_garantia:        "10 anos",
  pag_prazo_entrega:   "120 dias após a contratação",
  pag_prazo_execucao:  "120 dias após a entrega do material",
  pag_dados_bancarios: "Banco Itaú | Agencia 3720 CC 30.288-8 | PIX: pamella@parket.com.br",
  pag_razao_social:    "Mundial Export Assess. Com. e Ext. Imp e Exp Eireli | CNPJ 29.872.616/0001-34",
};

// Orçamentistas (mesma lista do Space v1)
const ORCAMENTISTAS = [
  { id: "2cdd76d5-2730-4d7f-8e6b-d42983f38561", nome: "Raniere Brito ★" },
  { id: "7fb00596-28bb-4ee6-8969-71a11da1c472", nome: "Bruno Silva" },
  { id: "48a744fc-aefe-4cfe-b0a3-95d2516c30bc", nome: "Thayna Rodrigues" },
  { id: "35a372be-5db4-490e-8278-9f3aae3f4da8", nome: "Joyce Silva" },
  { id: "abe31e01-280e-4ef6-9208-adbdfbae214a", nome: "Marina Torino" },
  { id: "3c79ff74-1f76-4f06-915e-6eefb0c1b2b0", nome: "Davi Alves Baptista" },
];

// SDRs conhecidos (lista enxuta)
const SDRS = ["Guilherme Perry", "Vinicius Arruda"];

// Cor por etapa — paleta brand SO Parket (mesma do kanban)
const STAGE_BORDER: Record<string, string> = {
  "leads-entrada":          "rgb(var(--pk-morningBlue))",
  "triagem-ia":             "rgb(var(--pk-morningBlue))",
  "contato-inicial":        "rgb(var(--pk-navy))",
  "follow-up-1":            "rgb(var(--pk-shadow))",
  "follow-up-2":            "rgb(var(--pk-shadow))",
  "follow-up-3":            "rgb(var(--pk-walnut))",
  "em-qualificacao":        "rgb(var(--pk-shadow))",
  "qualificado":            "rgb(var(--pk-olive))",
  "nao-qualificado":        "rgb(var(--pk-walnut))",
  "novas-oportunidades":    "rgb(var(--pk-morningBlue))",
  "em-briefing":            "rgb(var(--pk-shadow))",
  "criacao-orcamento":      "rgb(var(--pk-wood))",
  "apresentacao-proposta":  "rgb(var(--pk-navy))",
  "em-negociacao":          "rgb(var(--pk-olive))",
  "ganho":                  "rgb(var(--pk-olive))",
  "perda":                  "rgb(var(--pk-walnut))",
  "lembretes":              "rgb(var(--pk-navy))",
};
const STAGE_FG = STAGE_BORDER; // mesma cor pro texto do chip

export function CardDetailPanel({ card: initialCard, onClose, onUpdated }: {
  card: KanbanCard;
  onClose: () => void;
  onUpdated?: (next: KanbanCard) => void;
}) {
  const [card, setCard] = useState(initialCard);
  const [tab, setTab] = useState<Tab>("lead");
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [showAgendar, setShowAgendar] = useState(false);

  useEffect(() => setCard(initialCard), [initialCard.id]);

  // Carrega lista de vendedores (distinct responsavel) + colunas do dept
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await supabase
        .from("kanban_cards")
        .select("responsavel")
        .eq("dept_id", card.dept_id)
        .not("responsavel", "is", null)
        .limit(500);
      if (!alive) return;
      const set = new Set<string>();
      (r.data || []).forEach((x: any) => x.responsavel && set.add(x.responsavel));
      setVendedores([...set].sort());
      const cols = await api.columns([card.dept_id]);
      if (alive) setColumns(cols);
    })();
    return () => { alive = false; };
  }, [card.dept_id]);

  const det = card.details || {};
  const nome = det.contato_principal || det.nome || card.title || "(sem nome)";
  const phone = (det.celular || det.telefone || det.contato_principal || "").toString().replace(/\D/g, "");
  const phoneIntl = phone.startsWith("55") ? phone : phone ? "55" + phone : "";
  const valor = parseValueText(det.valor_orcamento_enviado || card.value || "");
  const stage = card.column_id;
  const stageTitle = columns.find((c) => c.slug === stage)?.title || stage;
  const tags = card.tags || [];

  async function patch(updates: Record<string, any>) {
    const next = { ...(det || {}), ...updates };
    const optimistic = { ...card, details: next };
    setCard(optimistic);
    const r = await supabase.from("kanban_cards").update({ details: next }).eq("id", card.id);
    if (r.error) { setCard(card); alert("Erro: " + r.error.message); return; }
    onUpdated?.(optimistic);
  }

  async function patchCard(updates: Partial<KanbanCard>) {
    const optimistic = { ...card, ...updates } as KanbanCard;
    setCard(optimistic);
    const r = await supabase.from("kanban_cards").update(updates).eq("id", card.id);
    if (r.error) { setCard(card); alert("Erro: " + r.error.message); return; }
    onUpdated?.(optimistic);
  }

  async function moveToColumn(slug: string) {
    await supabase.from("card_movements").insert({
      card_id: card.id, from_column: card.column_id, to_column: slug,
      moved_by: "space2", moved_at: new Date().toISOString(),
    });
    await patchCard({ column_id: slug });
  }

  async function setResponsavel(v: string) { await patchCard({ responsavel: v || null }); }
  async function setSdr(v: string)        { await patch({ sdr: v || null }); }
  async function setOrcamentista(id: string) {
    const o = ORCAMENTISTAS.find((x) => x.id === id);
    await patch({ orcamentista_id: id || null, orcamentista_nome: o?.nome || null });
  }

  async function deleteCard() {
    if (!confirm(`Excluir card "${nome}"? Não pode desfazer.`)) return;
    const r = await supabase.from("kanban_cards").delete().eq("id", card.id);
    if (r.error) { alert("Erro: " + r.error.message); return; }
    onClose();
  }

  return (
    <>
      <div onClick={onClose}
        className="fixed inset-0 z-40 bg-pk-raisinBlack/60 backdrop-blur-[2px]" />

      <aside className="fixed top-0 right-0 bottom-0 z-50 w-[540px] max-w-[100vw] bg-pk-bg border-l border-pk-border flex flex-col shadow-2xl">

        {/* Header */}
        <header className="border-b border-pk-border px-5 py-4 shrink-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-1.5 flex items-center gap-2">
                <span className="px-1.5 py-0.5 border text-pk-cream"
                  style={{ borderColor: STAGE_BORDER[stage] || "rgb(var(--pk-border))", color: STAGE_FG[stage] || "rgb(var(--pk-cream))" }}>
                  {stageTitle?.toUpperCase()}
                </span>
                <span>·</span>
                <span>#{card.id.slice(0, 6)}</span>
              </div>
              <h2 className="font-display text-[17px] uppercase tracking-[0.10em] font-medium leading-tight truncate">
                {nome}
              </h2>
              {valor > 0 && (
                <div className="text-[10px] tabular text-pk-cream mt-1.5 tracking-[0.08em]">
                  {fmtBRL(valor)}
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1 text-pk-textDim hover:text-pk-text transition shrink-0">
              <X size={16} />
            </button>
          </div>

          {/* Quick actions — paleta brand SO Parket */}
          <div className="grid grid-cols-4 gap-1 mt-3">
            <QuickBtn icon={<ThumbsUp size={9} />}   label="QUALIFICADO"  onClick={() => moveToColumn("qualificado")}      accent="olive" />
            <QuickBtn icon={<ThumbsDown size={9} />} label="NÃO QUAL."    onClick={() => moveToColumn("nao-qualificado")} accent="shadow" />
            <QuickBtn icon={<Bell size={9} />}       label="LEMBRETE"     onClick={() => moveToColumn("lembretes")}       accent="navy" />
            <QuickBtn icon={<Trash2 size={9} />}     label="EXCLUIR"      onClick={deleteCard}                              accent="walnut-solid" />
          </div>
        </header>

        {/* Controles: Vendedor + SDR + Etapa + Orçamentista */}
        <div className="border-b border-pk-border px-5 py-3 grid grid-cols-2 gap-2 shrink-0 bg-pk-panel/40">
          <Field label="VENDEDOR">
            <Select value={card.responsavel || ""} onChange={setResponsavel}>
              <option value="">— SELECIONE —</option>
              {vendedores.map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}
            </Select>
          </Field>
          <Field label="SDR">
            <Select value={det.sdr || ""} onChange={setSdr}>
              <option value="">— SEM SDR —</option>
              {SDRS.map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}
            </Select>
          </Field>
          <Field label="ETAPA">
            <Select value={stage} onChange={moveToColumn}>
              {columns.map((c) => <option key={c.id} value={c.slug}>{c.title.toUpperCase()}</option>)}
            </Select>
          </Field>
          <Field label="ORÇAMENTISTA">
            <Select value={det.orcamentista_id || ""} onChange={setOrcamentista}>
              <option value="">— SELECIONE —</option>
              {ORCAMENTISTAS.map((o) => <option key={o.id} value={o.id}>{o.nome.toUpperCase()}</option>)}
            </Select>
          </Field>
        </div>

        {/* Tags + contato */}
        <div className="border-b border-pk-border px-5 py-3 shrink-0">
          <TagsRow tags={tags} onChange={(next) => patchCard({ tags: next })} />
          <div className="grid grid-cols-3 gap-2 mt-3">
            <a href={phoneIntl ? `tel:+${phoneIntl}` : undefined}
              onClick={(e) => { if (!phoneIntl) e.preventDefault(); }}
              className={`flex items-center justify-center gap-2 py-2.5 border bg-pk-panel/40 text-[9px] uppercase tracking-[0.18em] font-semibold transition no-underline ${
                phoneIntl ? "border-pk-border hover:border-pk-borderHover text-pk-text" : "border-pk-border text-pk-textDim cursor-not-allowed"
              }`}>
              <Phone size={11} /> LIGAR
            </a>
            <a href={phoneIntl ? `https://wa.me/${phoneIntl}` : undefined} target="_blank" rel="noreferrer"
              onClick={(e) => { if (!phoneIntl) e.preventDefault(); }}
              className={`flex items-center justify-center gap-2 py-2.5 border bg-pk-panel/40 text-[9px] uppercase tracking-[0.18em] font-semibold transition no-underline ${
                phoneIntl ? "border-pk-border hover:border-pk-borderHover text-pk-text" : "border-pk-border text-pk-textDim cursor-not-allowed"
              }`}>
              <MessageCircle size={11} /> WHATSAPP
            </a>
            <button onClick={() => setShowAgendar(true)}
              className="flex items-center justify-center gap-2 py-2.5 border border-pk-border hover:border-pk-borderHover bg-pk-panel/40 text-[9px] uppercase tracking-[0.18em] text-pk-text font-semibold transition">
              <Calendar size={11} /> AGENDAR
            </button>
          </div>
        </div>

        {/* Tabs scroll horizontal */}
        <div className="border-b border-pk-border flex overflow-x-auto shrink-0 scrollbar-thin">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[9px] uppercase tracking-[0.18em] font-medium whitespace-nowrap border-b-2 transition ${
                tab === t.key
                  ? "text-pk-cream border-b-pk-accent bg-pk-accent/5"
                  : "text-pk-textDim border-b-transparent hover:text-pk-text"
              }`}>
              <t.icon size={10} className="opacity-70" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 space-y-2">
          {tab === "lead" && <LeadTab card={card} det={det} />}

          {tab === "contato" && (
            <>
              <EditField label="NOME / CONTATO PRINCIPAL" value={det.contato_principal || det.nome || card.title} onSave={(v) => patch({ contato_principal: v })} />
              <EditField label="EMPRESA DO CONTATO" value={det.empresa_contato} onSave={(v) => patch({ empresa_contato: v })} />
              <EditField label="EMPRESA LEAD" value={det.empresa_lead} onSave={(v) => patch({ empresa_lead: v })} />
              <EditField label="POSIÇÃO" value={det.posicao || det.cargo} onSave={(v) => patch({ posicao: v })} />
              <EditField label="CELULAR" value={det.celular || det.telefone} onSave={(v) => patch({ celular: v })} mono />
              <EditField label="TEL. COMERCIAL" value={det.telefone_comercial} onSave={(v) => patch({ telefone_comercial: v })} mono />
              <EditField label="TEL. DIRETO COMERCIAL" value={det.tel_direto_comercial} onSave={(v) => patch({ tel_direto_comercial: v })} mono />
              <EditField label="TEL. RESIDENCIAL" value={det.telefone_residencial} onSave={(v) => patch({ telefone_residencial: v })} mono />
              <EditField label="FAX" value={det.fax} onSave={(v) => patch({ fax: v })} mono />
              <EditField label="OUTRO TELEFONE" value={det.outro_telefone} onSave={(v) => patch({ outro_telefone: v })} mono />
              <EditField label="EMAIL COMERCIAL" value={det.email_comercial || det.email} onSave={(v) => patch({ email_comercial: v })} />
              <EditField label="EMAIL PESSOAL" value={det.email_pessoal} onSave={(v) => patch({ email_pessoal: v })} />
              <EditField label="OUTRO EMAIL" value={det.outro_email} onSave={(v) => patch({ outro_email: v })} />
            </>
          )}

          {tab === "projeto" && (
            <>
              <EditField label="PRODUTO DE INTERESSE" value={det.produto_interesse} onSave={(v) => patch({ produto_interesse: v })} />
              <EditField label="RELAÇÃO COM A OBRA" value={det.relacao_obra} onSave={(v) => patch({ relacao_obra: v })} />
              <EditField label="CIDADE / ESTADO" value={det.cidade} onSave={(v) => patch({ cidade: v })} />
              <EditField label="ESTADO" value={det.estado} onSave={(v) => patch({ estado: v })} />
              <EditField label="METRAGEM ESTIMADA (M²)" value={det.metragem_estimada || det.area_m2 || det.metragem} onSave={(v) => patch({ metragem_estimada: v })} />
              <EditField label="FAIXA DE INVESTIMENTO" value={det.faixa_investimento} onSave={(v) => patch({ faixa_investimento: v })} />
              <EditField label="PREVISÃO DE INSTALAÇÃO" value={det.previsao_instalacao} onSave={(v) => patch({ previsao_instalacao: v })} />
              <EditField label="ESCRITÓRIO / EMPRESA" value={det.escritorio_empresa} onSave={(v) => patch({ escritorio_empresa: v })} />
              <EditField label="ARQUITETURA" value={det.arquitetura} onSave={(v) => patch({ arquitetura: v })} />
              <EditField label="PREFERÊNCIA DE MADEIRA" value={det.preferencia_madeira} onSave={(v) => patch({ preferencia_madeira: v })} />
              <EditField label="ENDEREÇO DA OBRA" value={det.endereco_obra} onSave={(v) => patch({ endereco_obra: v })} multiline />
              <EditField label="VALOR ORÇAMENTO ENVIADO" value={det.valor_orcamento_enviado} onSave={(v) => patch({ valor_orcamento_enviado: v })} />
            </>
          )}

          {tab === "qualificacao" && (
            <>
              <EditField label="RESUMO DE QUALIFICAÇÃO" value={det.resumo_qualificacao} onSave={(v) => patch({ resumo_qualificacao: v })} multiline />
              <EditField label="OVERVIEW IA" value={det.overview_ia} onSave={(v) => patch({ overview_ia: v })} multiline />
              {det.ia_analise && typeof det.ia_analise === "object" && <IAAnaliseBlock ia={det.ia_analise} />}
            </>
          )}

          {tab === "marketing" && (
            <>
              <EditField label="UTM SOURCE"   value={det.utm_source}   onSave={(v) => patch({ utm_source: v })} mono />
              <EditField label="UTM MEDIUM"   value={det.utm_medium}   onSave={(v) => patch({ utm_medium: v })} mono />
              <EditField label="UTM CAMPAIGN" value={det.utm_campaign} onSave={(v) => patch({ utm_campaign: v })} mono />
              <EditField label="UTM TERM"     value={det.utm_term}     onSave={(v) => patch({ utm_term: v })} mono />
              <EditField label="UTM CONTENT"  value={det.utm_content}  onSave={(v) => patch({ utm_content: v })} mono />
              <EditField label="FONTE"        value={det.fonte}        onSave={(v) => patch({ fonte: v })} />
              <EditField label="ORIGEM"       value={det.origem}       onSave={(v) => patch({ origem: v })} />
              <EditField label="AD ID"        value={det.ad_id}        onSave={(v) => patch({ ad_id: v })} mono />
              <EditField label="ADSET ID"     value={det.adset_id}     onSave={(v) => patch({ adset_id: v })} mono />
              <EditField label="CAMPAIGN ID"  value={det.campaign_id}  onSave={(v) => patch({ campaign_id: v })} mono />
              <EditField label="FORM ID"      value={det.form_id}      onSave={(v) => patch({ form_id: v })} mono />
              <EditField label="REFERRER"     value={det.referrer}     onSave={(v) => patch({ referrer: v })} mono multiline />
              <EditField label="LANDING PAGE" value={det.landing_page} onSave={(v) => patch({ landing_page: v })} mono />
            </>
          )}

          {tab === "whatsapp" && <WhatsAppTab det={det} />}

          {tab === "ligacoes" && <LigacoesTab cardId={card.id} />}

          {tab === "ia" && <IACopilotTab card={card} det={det} onUpdated={(d) => onUpdated?.({ ...card, details: d })} />}

          {tab === "levantamento" && (
            <LevantamentoTab
              servicos={det.levantamento_itens?.servicos || []}
              onChange={(servicos) => patch({ levantamento_itens: { ...(det.levantamento_itens || {}), servicos } })}
            />
          )}

          {tab === "orcamentos" && <OrcamentosTab cardId={card.id} cliente={nome} />}

          {tab === "diagrama" && <DiagramaTab cardId={card.id} />}

          {tab === "financeira" && <FinanceiraTab cardId={card.id} />}

          {tab === "teka" && (
            <>
              <InfoRow label="TEKA ATIVA" value={det.teka_ativa != null ? (det.teka_ativa ? "SIM" : "NÃO") : "—"} />
              <InfoRow label="ETAPA CONVERSA" value={det.teka_etapa || det.etapa_conversa} />
              <InfoRow label="INSTÂNCIA EVO" value={det.evo_instance} />
              <InfoRow label="ÚLTIMA MSG TEKA" value={det.teka_ultima_msg ? fmtRelative(det.teka_ultima_msg) : "—"} />
              <InfoRow label="PAUSADA EM" value={det.teka_pause_ts ? fmtRelative(det.teka_pause_ts) : "—"} />
              <InfoRow label="MOTIVO PAUSA" value={det.teka_pause_reason} multiline />
              <InfoRow label="FOLLOWUPS ENVIADOS" value={det.teka_followup_count ?? 0} />
              <InfoRow label="FOLLOWUP 1" value={det.teka_followup_1_at ? new Date(det.teka_followup_1_at).toLocaleString("pt-BR") : "—"} />
              <InfoRow label="FOLLOWUP 2" value={det.teka_followup_2_at ? new Date(det.teka_followup_2_at).toLocaleString("pt-BR") : "—"} />
              <div className="pt-3">
                <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-2">
                  MENSAGENS IA · {Array.isArray(det.mensagens_ia) ? det.mensagens_ia.length : 0}
                </div>
                <MensagensIA mensagens={det.mensagens_ia || []} />
              </div>
            </>
          )}

          {tab === "pagamento" && (
            <>
              <EditField label="CONDIÇÕES DE PAGAMENTO" value={det.forma_pagamento ?? PAG_DEFAULTS.forma_pagamento} onSave={(v) => patch({ forma_pagamento: v })} multiline placeholder={PAG_DEFAULTS.forma_pagamento} />
              <EditField label="GARANTIA"             value={det.pag_garantia ?? PAG_DEFAULTS.pag_garantia} onSave={(v) => patch({ pag_garantia: v })} placeholder={PAG_DEFAULTS.pag_garantia} />
              <EditField label="PRAZO DE ENTREGA"     value={det.pag_prazo_entrega ?? PAG_DEFAULTS.pag_prazo_entrega} onSave={(v) => patch({ pag_prazo_entrega: v })} placeholder={PAG_DEFAULTS.pag_prazo_entrega} />
              <EditField label="PRAZO DE EXECUÇÃO"    value={det.pag_prazo_execucao ?? PAG_DEFAULTS.pag_prazo_execucao} onSave={(v) => patch({ pag_prazo_execucao: v })} placeholder={PAG_DEFAULTS.pag_prazo_execucao} />
              <EditField label="DADOS BANCÁRIOS"      value={det.pag_dados_bancarios ?? PAG_DEFAULTS.pag_dados_bancarios} onSave={(v) => patch({ pag_dados_bancarios: v })} multiline placeholder={PAG_DEFAULTS.pag_dados_bancarios} />
              <EditField label="RAZÃO SOCIAL EMISSORA" value={det.pag_razao_social ?? PAG_DEFAULTS.pag_razao_social} onSave={(v) => patch({ pag_razao_social: v })} multiline placeholder={PAG_DEFAULTS.pag_razao_social} />
            </>
          )}

          {tab === "anexos" && <AnexosTab cardId={card.id} anexos={det.anexos || []} onChange={(next) => patch({ anexos: next })} />}

          {tab === "propostas" && <PropostasTab tracking={det.proposta_tracking || []} />}

          {tab === "notas" && <NotasTab notas={det.notas || []} onChange={(next) => patch({ notas: next })} />}

          {tab === "atividade" && <ActividadeTab cardId={card.id} />}
        </div>

        {/* Modal de agendar reunião */}
        {showAgendar && (
          <AgendarModal cardId={card.id} cliente={nome} vendedorInicial={card.responsavel || ""}
            onClose={() => setShowAgendar(false)} />
        )}

        {/* Footer */}
        <div className="border-t border-pk-border px-5 py-3 shrink-0 flex items-center justify-between">
          <a href={`https://space.parket.works/?card=${card.id}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-pk-textDim hover:text-pk-text transition no-underline">
            ABRIR NO SPACE LEGADO <ExternalLink size={10} />
          </a>
          <span className="text-[8px] uppercase tracking-[0.18em] text-pk-textDim">
            ATUALIZADO {fmtRelative(card.updated_at || card.created_at).toUpperCase()}
          </span>
        </div>
      </aside>
    </>
  );
}

// ─── Tabs específicas ─────────────────────────────────────────────────

function LeadTab({ card, det }: { card: KanbanCard; det: any }) {
  return (
    <div className="space-y-2">
      <InfoRow label="ETAPA ATUAL" value={card.column_id?.toUpperCase()} />
      <InfoRow label="VENDEDOR" value={card.responsavel} />
      <InfoRow label="SDR" value={det.sdr} />
      <InfoRow label="ORÇAMENTISTA" value={det.orcamentista_nome} />
      <InfoRow label="STATUS LEAD" value={det.status_lead} />
      <InfoRow label="FUNIL VENDAS" value={det.funil_vendas} />
      <InfoRow label="NÍVEL LEAD" value={det.nivel_lead || det.qualificacao} />
      <InfoRow label="DATA CRIAÇÃO" value={card.created_at ? new Date(card.created_at).toLocaleString("pt-BR") : "—"} />
      <InfoRow label="DATA PROPOSTA" value={det.data_proposta} />
      <InfoRow label="PRÓXIMA TAREFA" value={det.proxima_tarefa} />
      <InfoRow label="MODIFICADO POR" value={det.modificado_por} />
      <InfoRow label="FONTE" value={det.fonte} />
      <InfoRow label="ORIGEM" value={det.origem} />
      {det.ad_id && <InfoRow label="AD ID" value={det.ad_id} mono />}
      {det.adset_id && <InfoRow label="ADSET ID" value={det.adset_id} mono />}
      {det.form_id && <InfoRow label="FORM ID" value={det.form_id} mono />}
    </div>
  );
}

function WhatsAppTab({ det }: { det: any }) {
  const msgs = Array.isArray(det.mensagens_ia) ? det.mensagens_ia : [];
  if (msgs.length === 0) return <Empty label="SEM MENSAGENS REGISTRADAS NO CARD" />;
  return <MensagensIA mensagens={msgs} />;
}

function MensagensIA({ mensagens }: { mensagens: any[] }) {
  return (
    <div className="space-y-2">
      {mensagens.slice(-30).reverse().map((m, i) => {
        const cliente = m.de === "cliente";
        return (
          <div key={i} className={`flex ${cliente ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] px-3 py-2 border ${cliente ? "border-pk-border bg-pk-panel/40" : "border-pk-accent/50 bg-pk-accent/10"}`}>
              <div className="text-[10px] text-pk-text leading-snug whitespace-pre-wrap">{m.texto || m.text || "(vazio)"}</div>
              <div className="text-[7px] uppercase tracking-[0.18em] text-pk-textDim mt-1.5">
                {cliente ? "CLIENTE" : (m.de || "BOT").toUpperCase()} · {m.ts ? new Date(m.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActividadeTab({ cardId }: { cardId: string }) {
  const [msgs, setMsgs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const r = await supabase
        .from("whatsapp_messages")
        .select("id, direction, message_text, timestamp")
        .eq("card_id", cardId)
        .order("timestamp", { ascending: false })
        .limit(40);
      if (alive) { setMsgs(r.data || []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [cardId]);
  if (loading) return <div className="flex justify-center py-8"><Loader2 size={14} className="animate-spin text-pk-accent" /></div>;
  if (!msgs || msgs.length === 0) return <Empty label="SEM MENSAGENS WHATSAPP" />;
  return (
    <div className="space-y-2">
      {msgs.map((m) => {
        const out = m.direction === "out" || m.direction === "sent";
        return (
          <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-3 py-2 border ${out ? "border-pk-accent/50 bg-pk-accent/10" : "border-pk-border bg-pk-panel/40"}`}>
              <div className="text-[10px] text-pk-text leading-snug whitespace-pre-wrap">{m.message_text || "(vazio)"}</div>
              <div className="text-[7px] uppercase tracking-[0.18em] text-pk-textDim mt-1.5">
                {out ? "ENVIADA" : "RECEBIDA"} · {new Date(m.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ligações Wavoip ──────────────────────────────────────────────────
function LigacoesTab({ cardId }: { cardId: string }) {
  const [calls, setCalls] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const r = await supabase
        .from("wavoip_calls")
        .select("id, direction, status, duration, record_url, caller, receiver, iniciada_em, finalizada_em")
        .eq("card_id", cardId)
        .order("iniciada_em", { ascending: false })
        .limit(50);
      if (alive) { setCalls(r.data || []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [cardId]);
  if (loading) return <div className="flex justify-center py-8"><Loader2 size={14} className="animate-spin text-pk-accent" /></div>;
  if (!calls || calls.length === 0) return <Empty label="SEM LIGAÇÕES REGISTRADAS" />;
  return (
    <div className="space-y-2">
      {calls.map((c) => {
        const out = c.direction === "outbound" || c.direction === "out";
        const missed = c.status === "missed" || c.status === "no-answer" || c.duration === 0;
        const Icon = missed ? PhoneMissed : out ? PhoneOutgoing : PhoneIncoming;
        const color = missed ? "text-pk-walnut" : out ? "text-pk-olive" : "text-pk-navy";
        return (
          <div key={c.id} className="flex items-center gap-3 p-3 border border-pk-text/[0.08] bg-pk-text/[0.025]">
            <Icon size={14} className={`${color} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.14em] text-pk-text">
                {missed ? "PERDIDA" : out ? "SAÍDA" : "RECEBIDA"}
                {c.duration > 0 && (
                  <span className="text-pk-cream tabular ml-2">
                    {Math.floor(c.duration / 60)}:{String(c.duration % 60).padStart(2, "0")}
                  </span>
                )}
              </div>
              <div className="text-[9px] text-pk-textDim font-mono">{c.caller} → {c.receiver}</div>
              <div className="text-[8px] uppercase tracking-[0.18em] text-pk-textDim mt-0.5">
                {c.iniciada_em ? new Date(c.iniciada_em).toLocaleString("pt-BR") : ""}
              </div>
            </div>
            {c.record_url && (
              <a href={c.record_url} target="_blank" rel="noreferrer"
                className="text-[9px] uppercase tracking-[0.18em] text-pk-accent no-underline px-2 py-1 border border-pk-accent/50">
                OUVIR
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── IA Copiloto ──────────────────────────────────────────────────────
const AGENTE_URL = "https://agente.parket.works";

function IACopilotTab({ card, det, onUpdated }: { card: KanbanCard; det: any; onUpdated: (d: any) => void }) {
  const [analise, setAnalise] = useState<any>(det.ia_analise || null);
  const [busy, setBusy] = useState(false);
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [sugBusy, setSugBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState("qualificar");

  // Auto-trigger se não tem análise
  useEffect(() => { if (!det.ia_analise) analisar(); /* eslint-disable-next-line */ }, [card.id]);

  async function analisar() {
    setBusy(true); setErr(null);
    try {
      const payload = {
        card_id: card.id, card_title: card.title, slug: card.column_id,
        produto_interesse: det.produto_interesse,
        metragem: Number(det.metragem_estimada || det.area_m2 || det.metragem) || null,
        valor_mesa: parseValueText(det.valor_orcamento_enviado || card.value || "") || null,
        cidade: det.cidade, responsavel: card.responsavel,
        mensagens: Array.isArray(det.mensagens_ia)
          ? det.mensagens_ia.slice(-15).map((m: any) => ({
              direction: m.de === "cliente" ? "in" : "out", text: m.texto || "", at: m.ts,
            })) : [],
      };
      const r = await fetch(`${AGENTE_URL}/api/hb-ia/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const novo = { ...data, feita_at: new Date().toISOString(), feita_por: "ia" };
      setAnalise(novo);
      const next = { ...det, ia_analise: novo };
      await supabase.from("kanban_cards").update({ details: next }).eq("id", card.id);
      onUpdated(next);
    } catch (e: any) { setErr(e?.message || "Erro"); }
    finally { setBusy(false); }
  }

  async function sugerir(obj: string) {
    setObjetivo(obj); setSugBusy(true); setSugestoes([]);
    try {
      const payload = {
        card_id: card.id, card_title: card.title, slug: card.column_id,
        produto_interesse: det.produto_interesse, cidade: det.cidade,
        responsavel: card.responsavel, objetivo: obj,
        mensagens: Array.isArray(det.mensagens_ia)
          ? det.mensagens_ia.slice(-15).map((m: any) => ({
              direction: m.de === "cliente" ? "in" : "out", text: m.texto || "", at: m.ts,
            })) : [],
      };
      const r = await fetch(`${AGENTE_URL}/api/hb-ia/suggest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setSugestoes(data.sugestoes || []);
    } catch (e: any) { setErr(e?.message || "Erro"); }
    finally { setSugBusy(false); }
  }

  const objetivos = [
    { key: "qualificar",       label: "QUALIFICAR" },
    { key: "agendar visita",   label: "AGENDAR VISITA" },
    { key: "enviar orcamento", label: "ENVIAR ORÇAMENTO" },
    { key: "negociar",         label: "NEGOCIAR" },
    { key: "fechar",           label: "FECHAR" },
    { key: "followup",         label: "FOLLOW-UP" },
    { key: "reativar",         label: "REATIVAR" },
  ];

  return (
    <div className="space-y-4">
      {/* Análise */}
      <div className="border border-pk-text/[0.08] bg-pk-text/[0.025] p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim flex items-center gap-2">
            <Bot size={11} className="text-pk-accent" /> ANÁLISE DO LEAD
          </div>
          <button onClick={analisar} disabled={busy}
            className="flex items-center gap-1 px-2 py-1 text-[8px] uppercase tracking-[0.20em] border border-pk-accent text-pk-accent hover:bg-pk-accent/10 disabled:opacity-50">
            {busy ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
            {busy ? "ANALISANDO" : "ATUALIZAR"}
          </button>
        </div>
        {err && <div className="text-[9px] text-pk-walnut mb-2">⚠ {err}</div>}
        {analise ? <IAAnaliseBlock ia={analise} /> : <div className="text-[9px] uppercase tracking-[0.18em] text-pk-textDim py-4 text-center">SEM ANÁLISE</div>}
      </div>

      {/* Sugestões */}
      <div className="border border-pk-text/[0.08] bg-pk-text/[0.025] p-3">
        <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-3 flex items-center gap-2">
          <Sparkles size={11} className="text-pk-accent" /> SUGESTÕES DE MENSAGEM
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {objetivos.map((o) => (
            <button key={o.key} onClick={() => sugerir(o.key)} disabled={sugBusy}
              className={`px-2 py-1 text-[8px] uppercase tracking-[0.16em] border transition ${
                objetivo === o.key ? "border-pk-accent text-pk-cream bg-pk-accent/15" : "border-pk-text/[0.1] text-pk-textDim hover:text-pk-text"
              }`}>
              {o.label}
            </button>
          ))}
        </div>
        {sugBusy && <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-pk-accent" /></div>}
        {!sugBusy && sugestoes.length === 0 && (
          <div className="text-[9px] uppercase tracking-[0.18em] text-pk-textDim py-4 text-center">
            ESCOLHA UM OBJETIVO ACIMA
          </div>
        )}
        <div className="space-y-2">
          {sugestoes.map((s, i) => (
            <div key={i} className="border border-pk-text/[0.1] bg-pk-bg p-2.5">
              {s.titulo && <div className="text-[8px] uppercase tracking-[0.20em] text-pk-accent mb-1.5 font-semibold">{s.titulo}</div>}
              <div className="text-[11px] text-pk-text leading-relaxed whitespace-pre-wrap">{s.texto}</div>
              <div className="flex gap-1 mt-2">
                <button onClick={() => { navigator.clipboard.writeText(s.texto); }}
                  className="text-[8px] uppercase tracking-[0.18em] px-2 py-1 border border-pk-text/[0.15] text-pk-textDim hover:text-pk-text">
                  COPIAR
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropostasTab({ tracking }: { tracking: any[] }) {
  if (!tracking || tracking.length === 0) return <Empty label="SEM VISUALIZAÇÕES REGISTRADAS" />;
  return (
    <div className="space-y-1.5">
      {tracking.slice(0, 30).map((p, i) => (
        <div key={i} className="flex items-center gap-3 p-2 border border-pk-border bg-pk-panel/40">
          <div className="text-[9px] font-mono text-pk-textDim w-28 shrink-0">{p.data || "—"}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-pk-text truncate">{p.cliente || "—"}</div>
          </div>
          {p.tempo_fmt && <div className="text-[9px] text-pk-cream tabular shrink-0">{p.tempo_fmt}</div>}
          {p.visualizacao != null && <div className="text-[8px] uppercase tracking-[0.16em] text-pk-textDim shrink-0">#{p.visualizacao}</div>}
        </div>
      ))}
    </div>
  );
}

function NotasTab({ notas, onChange }: { notas: any[]; onChange: (next: any[]) => void }) {
  const [text, setText] = useState("");
  const arr = Array.isArray(notas) ? notas : [];
  const add = () => {
    if (!text.trim()) return;
    onChange([...arr, { text: text.trim(), at: new Date().toISOString() }]);
    setText("");
  };
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="Nova nota..."
          className="flex-1 bg-pk-panel border border-pk-border px-3 py-2 text-[11px] text-pk-text outline-none focus:border-pk-accent" />
        <button onClick={add} disabled={!text.trim()}
          className="px-4 bg-pk-accent text-pk-bg text-[9px] uppercase tracking-[0.20em] font-semibold disabled:opacity-40">
          ADICIONAR
        </button>
      </div>
      {arr.length === 0 ? <Empty label="SEM NOTAS" /> : (
        <div className="space-y-2">
          {[...arr].reverse().map((n: any, i: number) => (
            <div key={i} className="p-2.5 border border-pk-border bg-pk-panel/40">
              <div className="text-[11px] text-pk-text leading-snug whitespace-pre-wrap">{n.text}</div>
              <div className="text-[8px] uppercase tracking-[0.18em] text-pk-textDim mt-1.5">{n.at ? fmtRelative(n.at).toUpperCase() : "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnexosTab({ cardId, anexos, onChange }: { cardId: string; anexos: any[]; onChange: (next: any[]) => void }) {
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const arr = Array.isArray(anexos) ? anexos : [];

  const addLink = () => {
    if (!linkUrl.trim()) return;
    onChange([...arr, { name: linkName.trim() || linkUrl, url: linkUrl, type: "link", size: 0, uploaded_at: new Date().toISOString(), kind: "link" }]);
    setLinkUrl(""); setLinkName(""); setShowLink(false);
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const novos: any[] = [];
      for (const file of files) {
        const path = `cards/${cardId}/${Date.now()}_${file.name}`;
        const up = await supabase.storage.from("obra-media").upload(path, file, { upsert: true });
        if (up.error) { console.error(up.error); continue; }
        const { data } = supabase.storage.from("obra-media").getPublicUrl(path);
        novos.push({
          name: file.name, url: data.publicUrl, type: file.type, size: file.size,
          uploaded_at: new Date().toISOString(), kind: "file",
        });
      }
      if (novos.length) onChange([...arr, ...novos]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 py-2 border border-pk-accent/40 bg-pk-accent/10 text-pk-accent text-[9px] uppercase tracking-[0.20em] hover:bg-pk-accent/20 disabled:opacity-50">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          {busy ? "ENVIANDO" : "ANEXAR ARQUIVO"}
        </button>
        <button onClick={() => setShowLink((v) => !v)}
          className="flex-1 flex items-center justify-center gap-2 py-2 border border-pk-border bg-pk-panel/40 text-pk-text text-[9px] uppercase tracking-[0.20em]">
          <Link2 size={11} /> ADICIONAR LINK
        </button>
        <input ref={fileRef} type="file" multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.dwg,.dxf"
          onChange={onFiles} className="hidden" />
      </div>
      {showLink && (
        <div className="mb-3 p-3 border border-pk-border bg-pk-panel/40">
          <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Nome (opcional)"
            className="w-full mb-2 px-2 py-1.5 bg-pk-bg border border-pk-border text-[11px] outline-none focus:border-pk-accent" />
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://drive.google.com/..."
            className="w-full px-2 py-1.5 bg-pk-bg border border-pk-border text-[11px] font-mono outline-none focus:border-pk-accent" />
          <button onClick={addLink} className="mt-2 px-3 py-1.5 bg-pk-accent text-pk-bg text-[9px] uppercase tracking-[0.20em] font-semibold">
            SALVAR LINK
          </button>
        </div>
      )}
      {arr.length === 0 ? <Empty label="SEM ANEXOS" /> : (
        <ul className="space-y-1.5">
          {arr.map((a: any, i: number) => (
            <li key={i} className="flex items-center gap-2 p-2 border border-pk-border bg-pk-panel/40">
              <Paperclip size={11} className="text-pk-textDim shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-pk-text truncate">{a.name}</div>
                <div className="text-[8px] uppercase tracking-[0.18em] text-pk-textDim">{a.kind || a.type} · {a.uploaded_at ? fmtRelative(a.uploaded_at).toUpperCase() : ""}</div>
              </div>
              <a href={a.url} target="_blank" rel="noreferrer" className="text-[9px] uppercase tracking-[0.16em] text-pk-accent no-underline">
                <ExternalLink size={11} />
              </a>
              <button onClick={() => onChange(arr.filter((_, idx) => idx !== i))} className="text-pk-walnut p-1">
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Levantamento — lista de serviços/itens da medição ───────────────
function LevantamentoTab({ servicos, onChange }: {
  servicos: any[]; onChange: (next: any[]) => void;
}) {
  const [draft, setDraft] = useState({ qtde: "", unid: "m²", tipo: "", obs: "" });
  const add = () => {
    if (!draft.tipo.trim()) return;
    onChange([...servicos, { ...draft, qtde: draft.qtde ? Number(draft.qtde) : null }]);
    setDraft({ qtde: "", unid: "m²", tipo: "", obs: "" });
  };
  const remove = (i: number) => onChange(servicos.filter((_, idx) => idx !== i));
  const total = servicos.reduce((s, x) => s + (Number(x.qtde) || 0), 0);
  return (
    <div>
      {/* Form add */}
      <div className="border border-pk-text/[0.08] bg-pk-text/[0.025] p-3 mb-3">
        <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-2">ADICIONAR ITEM</div>
        <div className="grid grid-cols-12 gap-2">
          <input value={draft.qtde} onChange={(e) => setDraft({ ...draft, qtde: e.target.value })}
            placeholder="Qtde" type="number"
            className="col-span-2 bg-pk-bg border border-pk-border px-2 py-1.5 text-[11px] outline-none focus:border-pk-accent" />
          <Select value={draft.unid} onChange={(v) => setDraft({ ...draft, unid: v })}>
            <option>m²</option><option>m</option><option>un</option><option>kg</option><option>h</option>
          </Select>
          <input value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
            placeholder="Tipo / descrição do item"
            className="col-span-7 bg-pk-bg border border-pk-border px-2 py-1.5 text-[11px] outline-none focus:border-pk-accent" />
          <button onClick={add} disabled={!draft.tipo.trim()}
            className="col-span-1 bg-pk-accent text-pk-bg disabled:opacity-40">
            <Plus size={12} className="mx-auto" />
          </button>
        </div>
        <input value={draft.obs} onChange={(e) => setDraft({ ...draft, obs: e.target.value })}
          placeholder="Observação (opcional)"
          className="w-full mt-2 bg-pk-bg border border-pk-border px-2 py-1.5 text-[11px] outline-none focus:border-pk-accent" />
      </div>

      {/* Lista */}
      {servicos.length === 0 ? (
        <Empty label="SEM ITENS NO LEVANTAMENTO" />
      ) : (
        <>
          <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-2 flex items-center justify-between">
            <span>{servicos.length} {servicos.length === 1 ? "ITEM" : "ITENS"}</span>
            {total > 0 && <span className="tabular text-pk-cream">{total.toFixed(1)} TOTAL</span>}
          </div>
          <div className="space-y-1.5">
            {servicos.map((s, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border border-pk-text/[0.08] bg-pk-text/[0.025]">
                <span className="text-[11px] tabular text-pk-cream w-16 shrink-0">
                  {s.qtde != null ? `${s.qtde} ${s.unid || ""}` : "—"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-pk-text truncate">{s.tipo}</div>
                  {s.obs && <div className="text-[9px] text-pk-textDim truncate">{s.obs}</div>}
                </div>
                <button onClick={() => remove(i)} className="text-pk-walnut p-1 shrink-0">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Orçamentos — simulações de proposta vinculadas ao card ──────────
function OrcamentosTab({ cardId, cliente }: { cardId: string; cliente: string }) {
  const [sims, setSims] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    const r = await supabase
      .from("simulacao_projetos")
      .select("id, numero, cliente, status, vendedor, orcamentista, forma_pagamento, created_at, validade_dias, desconto_perc, frete_valor")
      .or(`card_id.eq.${cardId},card_comercial_id.eq.${cardId}`)
      .order("created_at", { ascending: false })
      .limit(20);
    setSims(r.data || []);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [cardId]);

  const criar = async () => {
    setCreating(true);
    try {
      const r = await supabase.from("simulacao_projetos").insert({
        cliente, card_id: cardId, card_comercial_id: cardId,
        status: "rascunho", validade_dias: 15,
      }).select().single();
      if (r.error) { alert("Erro: " + r.error.message); return; }
      reload();
    } finally { setCreating(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={14} className="animate-spin text-pk-accent" /></div>;
  return (
    <div>
      <button onClick={criar} disabled={creating}
        className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 bg-pk-accent text-pk-bg text-[10px] uppercase tracking-[0.20em] font-semibold disabled:opacity-40">
        {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
        CRIAR ORÇAMENTO
      </button>
      {(!sims || sims.length === 0) ? <Empty label="SEM ORÇAMENTOS CRIADOS" /> : (
        <div className="space-y-2">
          {sims.map((s) => (
            <div key={s.id} className="border border-pk-text/[0.08] bg-pk-text/[0.025] p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="text-[11px] font-medium text-pk-text">
                  {s.numero || `Orçamento ${s.id.slice(0, 6)}`}
                </div>
                <span className="text-[8px] uppercase tracking-[0.16em] px-1.5 py-0.5 border border-pk-text/[0.15] text-pk-textDim">
                  {(s.status || "rascunho").toUpperCase()}
                </span>
              </div>
              <div className="text-[9px] text-pk-textDim uppercase tracking-[0.06em] space-y-0.5">
                {s.vendedor && <div>VENDEDOR: <span className="text-pk-text">{s.vendedor}</span></div>}
                {s.orcamentista && <div>ORÇAMENTISTA: <span className="text-pk-text">{s.orcamentista}</span></div>}
                {s.forma_pagamento && <div>FORMA: <span className="text-pk-text">{s.forma_pagamento}</span></div>}
                <div className="text-[8px] tracking-[0.18em]">
                  CRIADO {new Date(s.created_at).toLocaleDateString("pt-BR")}
                  {s.validade_dias && ` · VAL ${s.validade_dias}D`}
                </div>
              </div>
              <a href={`https://space.parket.works/?simulacao=${s.id}`} target="_blank" rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[8px] uppercase tracking-[0.20em] text-pk-accent no-underline">
                ABRIR NO SPACE <ExternalLink size={9} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Diagrama — embed do parket-draw via iframe ──────────────────────
function DiagramaTab({ cardId }: { cardId: string }) {
  const drawUrl = `https://draw.parket.works/?cardId=${cardId}&embed=1`;
  return (
    <div className="-m-5 h-[calc(100vh-180px)] flex flex-col">
      <div className="border-b border-pk-border px-4 py-2 flex items-center justify-between">
        <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim">DESENHO TÉCNICO · PARKET DRAW</div>
        <a href={`https://draw.parket.works/?cardId=${cardId}`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-[8px] uppercase tracking-[0.20em] text-pk-accent no-underline">
          ABRIR EM TELA CHEIA <ExternalLink size={9} />
        </a>
      </div>
      <iframe src={drawUrl} className="flex-1 w-full border-0 bg-pk-bg"
        title="Parket Draw" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
    </div>
  );
}

// ─── Central Financeira — contratos DocuSign ─────────────────────────
function FinanceiraTab({ cardId }: { cardId: string }) {
  const [contratos, setContratos] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await supabase
        .from("contratos_docusign")
        .select("id, envelope_id, status, titulo, signatarios, sent_at, completed_at, pdf_storage_path, created_at")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (alive) { setContratos(r.data || []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [cardId]);
  if (loading) return <div className="flex justify-center py-8"><Loader2 size={14} className="animate-spin text-pk-accent" /></div>;
  return (
    <div>
      <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-3 flex items-center justify-between">
        <span>CONTRATOS DOCUSIGN</span>
        <a href={`https://space.parket.works/financeiro/contrato/${cardId}`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-pk-accent no-underline">
          NOVO <Plus size={9} />
        </a>
      </div>
      {(!contratos || contratos.length === 0) ? <Empty label="SEM CONTRATOS REGISTRADOS" /> : (
        <div className="space-y-2">
          {contratos.map((c) => {
            const sigs = Array.isArray(c.signatarios) ? c.signatarios : [];
            const statusColor = c.status === "completed" ? "text-pk-olive" : c.status === "voided" ? "text-pk-walnut" : "text-pk-cream";
            return (
              <div key={c.id} className="border border-pk-text/[0.08] bg-pk-text/[0.025] p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="text-[11px] font-medium text-pk-text truncate">
                    {c.titulo || `Contrato ${c.id.slice(0, 6)}`}
                  </div>
                  <span className={`text-[8px] uppercase tracking-[0.16em] px-1.5 py-0.5 border border-pk-text/[0.15] ${statusColor}`}>
                    {(c.status || "rascunho").toUpperCase()}
                  </span>
                </div>
                {c.envelope_id && (
                  <div className="text-[8px] font-mono text-pk-textDim mb-1">ENV: {c.envelope_id.slice(0, 12)}…</div>
                )}
                <div className="text-[9px] uppercase tracking-[0.06em] text-pk-textDim space-y-0.5">
                  <div>SIGNATÁRIOS: <span className="text-pk-text">{sigs.length}</span></div>
                  {c.sent_at && <div>ENVIADO: <span className="text-pk-text">{new Date(c.sent_at).toLocaleDateString("pt-BR")}</span></div>}
                  {c.completed_at && <div>COMPLETO: <span className="text-pk-olive">{new Date(c.completed_at).toLocaleDateString("pt-BR")}</span></div>}
                </div>
                <a href={`https://space.parket.works/financeiro/contrato/${cardId}?envelope=${c.id}`} target="_blank" rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[8px] uppercase tracking-[0.20em] text-pk-accent no-underline">
                  ABRIR <ExternalLink size={9} />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal: agendar reunião (insere em agendamentos) ──────────────────
function AgendarModal({ cardId, cliente, vendedorInicial, onClose }: {
  cardId: string; cliente: string; vendedorInicial: string; onClose: () => void;
}) {
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [vendedor, setVendedor] = useState(vendedorInicial);
  const [data, setData] = useState(ymd);
  const [hora, setHora] = useState("10:00");
  const [duracao, setDuracao] = useState(60);
  const [modalidade, setModalidade] = useState<"meet" | "presencial">("meet");
  const [meetLink, setMeetLink] = useState("");
  const [endereco, setEndereco] = useState("Casa Parket");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  const horaFim = (() => {
    const [h, m] = hora.split(":").map(Number);
    const tot = h * 60 + m + duracao;
    const fh = Math.floor(tot / 60);
    const fm = tot % 60;
    return `${String(fh).padStart(2, "0")}:${String(fm).padStart(2, "0")}`;
  })();

  const submit = async () => {
    if (!vendedor.trim() || !data || !hora) { alert("Preencha vendedor, data e hora"); return; }
    setBusy(true);
    try {
      const r = await supabase.from("agendamentos").insert({
        card_id: cardId, cliente_nome: cliente, vendedor: vendedor.trim(),
        data, hora_inicio: `${hora}:00`, hora_fim: `${horaFim}:00`,
        duracao_min: duracao, modalidade,
        meet_link: modalidade === "meet" ? (meetLink.trim() || null) : null,
        endereco: modalidade === "presencial" ? (endereco.trim() || null) : null,
        observacoes: obs.trim() || null, status: "agendado",
      });
      if (r.error) { alert("Erro: " + r.error.message); return; }
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60] bg-pk-raisinBlack/70 backdrop-blur-[2px]" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[480px] max-w-[100vw] bg-pk-bg border border-pk-border shadow-2xl">
        <div className="border-b border-pk-border px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-1">REUNIÃO COM</div>
            <h2 className="font-display text-[14px] uppercase tracking-[0.14em] truncate">{cliente}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-pk-textDim hover:text-pk-text"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[80vh] overflow-auto">
          <Field label="VENDEDOR / CONSULTOR">
            <input value={vendedor} onChange={(e) => setVendedor(e.target.value)}
              className="w-full bg-pk-bg border border-pk-border px-2 py-2 text-[12px] outline-none focus:border-pk-accent" />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="DATA">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                className="w-full bg-pk-bg border border-pk-border px-2 py-2 text-[11px] outline-none focus:border-pk-accent" />
            </Field>
            <Field label="HORA">
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                className="w-full bg-pk-bg border border-pk-border px-2 py-2 text-[11px] outline-none focus:border-pk-accent" />
            </Field>
            <Field label="DURAÇÃO">
              <Select value={String(duracao)} onChange={(v) => setDuracao(Number(v))}>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hora</option>
                <option value="90">1h30</option>
                <option value="120">2 horas</option>
              </Select>
            </Field>
          </div>
          <Field label="MODALIDADE">
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => setModalidade("meet")}
                className={`flex items-center justify-center gap-2 py-2 text-[10px] uppercase tracking-[0.18em] border transition ${
                  modalidade === "meet" ? "bg-pk-accent/15 border-pk-accent text-pk-cream" : "border-pk-border text-pk-textDim"
                }`}>
                <Video size={11} /> MEET
              </button>
              <button onClick={() => setModalidade("presencial")}
                className={`flex items-center justify-center gap-2 py-2 text-[10px] uppercase tracking-[0.18em] border transition ${
                  modalidade === "presencial" ? "bg-pk-accent/15 border-pk-accent text-pk-cream" : "border-pk-border text-pk-textDim"
                }`}>
                <MapPin size={11} /> PRESENCIAL
              </button>
            </div>
          </Field>
          {modalidade === "meet" ? (
            <Field label="LINK MEET (OPCIONAL)">
              <input value={meetLink} onChange={(e) => setMeetLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full bg-pk-bg border border-pk-border px-2 py-2 text-[11px] font-mono outline-none focus:border-pk-accent" />
            </Field>
          ) : (
            <Field label="ENDEREÇO">
              <input value={endereco} onChange={(e) => setEndereco(e.target.value)}
                className="w-full bg-pk-bg border border-pk-border px-2 py-2 text-[11px] outline-none focus:border-pk-accent" />
            </Field>
          )}
          <Field label="OBSERVAÇÕES">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
              placeholder="Pauta, contexto..."
              className="w-full bg-pk-bg border border-pk-border px-2 py-2 text-[11px] outline-none focus:border-pk-accent" />
          </Field>
          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-pk-accent text-pk-bg text-[10px] uppercase tracking-[0.20em] font-semibold disabled:opacity-40">
              {busy && <Loader2 size={11} className="animate-spin" />}
              CRIAR AGENDAMENTO
            </button>
            <button onClick={onClose} className="px-5 py-2.5 border border-pk-border text-pk-textDim text-[10px] uppercase tracking-[0.20em]">
              CANCELAR
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function IAAnaliseBlock({ ia }: { ia: any }) {
  return (
    <div className="mt-3 border border-pk-border bg-pk-panel/40 p-3">
      <div className="text-[8px] uppercase tracking-[0.22em] text-pk-textDim mb-2">CLASSIFICAÇÃO IA</div>
      <div className="flex gap-4 mb-2">
        {ia.nivel && (
          <div>
            <div className="text-[7px] uppercase tracking-[0.20em] text-pk-textDim">NÍVEL</div>
            <div className="text-[11px] text-pk-cream font-semibold uppercase mt-0.5">{ia.nivel}</div>
          </div>
        )}
        {ia.score != null && (
          <div>
            <div className="text-[7px] uppercase tracking-[0.20em] text-pk-textDim">SCORE</div>
            <div className="font-display text-[15px] tabular mt-0.5">{ia.score}<span className="text-[8px] text-pk-textDim ml-1">/100</span></div>
          </div>
        )}
        {ia.feita_at && (
          <div className="ml-auto">
            <div className="text-[7px] uppercase tracking-[0.20em] text-pk-textDim">QUANDO</div>
            <div className="text-[9px] text-pk-textSecondary text-pk-text mt-0.5">{fmtRelative(ia.feita_at)}</div>
          </div>
        )}
      </div>
      {ia.motivo && <div className="text-[10px] text-pk-text leading-relaxed mb-2">{ia.motivo}</div>}
      {ia.proxima_acao && (
        <div className="mt-2 p-2 border border-pk-accent/50 bg-pk-accent/10">
          <div className="text-[8px] uppercase tracking-[0.20em] text-pk-accent font-semibold mb-1">▸ PRÓXIMA AÇÃO</div>
          <div className="text-[10px] text-pk-text leading-relaxed">{ia.proxima_acao}</div>
        </div>
      )}
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[7px] uppercase tracking-[0.22em] text-pk-textDim mb-1 font-semibold">{label}</div>
      {children}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-pk-bg border border-pk-border px-2 py-1.5 text-[10px] text-pk-text outline-none focus:border-pk-accent appearance-none"
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%2377736A' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center", paddingRight: 22,
      }}>
      {children}
    </select>
  );
}

function QuickBtn({ icon, label, onClick, accent }: {
  icon: React.ReactNode; label: string; onClick: () => void;
  accent: "olive" | "walnut" | "shadow" | "navy" | "morningBlue" | "moss" | "wood" | "walnut-solid";
}) {
  // Tokens literais da paleta brand SO Parket — modos thin (border+text) ou solid (filled)
  const cls = {
    olive:          "border-pk-olive/50 text-pk-olive hover:bg-pk-olive/15",
    walnut:         "border-pk-walnut/60 text-pk-walnut hover:bg-pk-walnut/15",
    shadow:         "border-pk-shadow/50 text-pk-shadow hover:bg-pk-shadow/15",
    navy:           "border-pk-navy/60 text-pk-navy hover:bg-pk-navy/15",
    morningBlue:    "border-pk-morningBlue/60 text-pk-morningBlue hover:bg-pk-morningBlue/15",
    moss:           "border-pk-moss text-pk-moss hover:bg-pk-moss/20",
    wood:           "border-pk-wood/60 text-pk-wood hover:bg-pk-wood/15",
    "walnut-solid": "bg-pk-walnut border-pk-walnut text-pk-cream hover:bg-pk-raisinBlack hover:border-pk-raisinBlack",
  }[accent];
  return (
    <button onClick={onClick}
      className={`flex items-center justify-center gap-1 py-1.5 text-[8px] uppercase tracking-[0.14em] font-semibold border ${cls} transition`}>
      {icon} {label}
    </button>
  );
}

function TagsRow({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...tags, t]);
    setDraft(""); setAdding(false);
  };
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {tags.map((t, i) => (
        <span key={i} className="flex items-center gap-1 text-[8px] uppercase tracking-[0.16em] px-2 py-1 border border-pk-border bg-pk-panel/40 text-pk-text">
          {t}
          <button onClick={() => onChange(tags.filter((_, idx) => idx !== i))}
            className="text-pk-textDim hover:text-pk-walnut">
            <X size={9} />
          </button>
        </span>
      ))}
      {adding ? (
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); else if (e.key === "Escape") setAdding(false); }}
          onBlur={add} placeholder="nova tag"
          className="text-[9px] px-2 py-1 bg-pk-bg border border-pk-accent text-pk-text outline-none w-24" />
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-[8px] uppercase tracking-[0.14em] px-2 py-1 border border-pk-border text-pk-textDim hover:text-pk-text hover:border-pk-borderHover">
          <Plus size={8} /> TAG
        </button>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono, multiline }: { label: string; value: any; mono?: boolean; multiline?: boolean }) {
  if (value == null || value === "") {
    return (
      <div className="flex items-baseline gap-3 py-1.5 border-b border-pk-border/50">
        <div className="text-[7px] uppercase tracking-[0.22em] text-pk-textDim w-44 shrink-0">{label}</div>
        <div className="text-[10px] text-pk-textDim italic">—</div>
      </div>
    );
  }
  if (multiline) {
    return (
      <div className="py-2 border-b border-pk-border/50">
        <div className="text-[7px] uppercase tracking-[0.22em] text-pk-textDim mb-1.5">{label}</div>
        <div className={`text-[11px] text-pk-text leading-snug ${mono ? "font-mono" : ""} whitespace-pre-wrap`}>{String(value)}</div>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-pk-border/50">
      <div className="text-[7px] uppercase tracking-[0.22em] text-pk-textDim w-44 shrink-0">{label}</div>
      <div className={`text-[11px] text-pk-text leading-snug ${mono ? "font-mono" : ""} flex-1 break-words`}>{String(value)}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-[9px] uppercase tracking-[0.20em] text-pk-textDim text-center py-12 border border-dashed border-pk-border">
      {label}
    </div>
  );
}

// ─── Field inline-editável ────────────────────────────────────────────
function EditField({ label, value, onSave, multiline, mono, placeholder }: {
  label: string; value: any; onSave: (v: string) => Promise<void> | void;
  multiline?: boolean; mono?: boolean; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(value == null ? "" : String(value)); }, [value]);
  const commit = async () => {
    setBusy(true);
    try { await onSave(draft); setEditing(false); }
    catch (e: any) { alert("Erro: " + (e?.message || e)); }
    finally { setBusy(false); }
  };
  if (editing) {
    return (
      <div className="border border-pk-accent/50 bg-pk-accent/5 p-2.5">
        <div className="text-[7px] uppercase tracking-[0.22em] text-pk-textDim mb-1.5 font-semibold">{label}</div>
        {multiline ? (
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            rows={3} placeholder={placeholder}
            className={`w-full bg-pk-bg border border-pk-border px-2 py-1.5 text-[11px] ${mono ? "font-mono" : ""} text-pk-text outline-none focus:border-pk-accent`}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }} />
        ) : (
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-pk-bg border border-pk-border px-2 py-1.5 text-[11px] ${mono ? "font-mono" : ""} text-pk-text outline-none focus:border-pk-accent`}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") setEditing(false); }} />
        )}
        <div className="flex gap-1 mt-2">
          <button onClick={commit} disabled={busy}
            className="flex items-center gap-1 px-3 py-1 bg-pk-accent text-pk-bg text-[8px] uppercase tracking-[0.20em] font-semibold disabled:opacity-50">
            {busy ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />} SALVAR
          </button>
          <button onClick={() => { setDraft(value == null ? "" : String(value)); setEditing(false); }}
            className="flex items-center gap-1 px-3 py-1 border border-pk-border text-pk-textDim text-[8px] uppercase tracking-[0.20em]">
            <X size={9} /> CANCELAR
          </button>
        </div>
      </div>
    );
  }
  const display = value == null || value === "" ? "—" : String(value);
  return (
    <div className="group cursor-pointer p-2.5 border border-transparent hover:border-pk-border hover:bg-pk-panel/30 transition"
         onClick={() => setEditing(true)}>
      <div className="text-[7px] uppercase tracking-[0.22em] text-pk-textDim mb-1 flex items-center gap-1.5">
        <span>{label}</span>
        <Pencil size={8} className="opacity-0 group-hover:opacity-100 transition" />
      </div>
      <div className={`text-[11px] ${value ? "text-pk-text" : "text-pk-textDim italic"} ${mono ? "font-mono" : ""} leading-snug whitespace-pre-wrap break-words`}>
        {display}
      </div>
    </div>
  );
}
