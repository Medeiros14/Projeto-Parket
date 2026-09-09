import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTokens, fonts, STATUS_COLOR, ACCENT } from "../theme";
import { supabase } from "../lib/supabase";
import { docusignRefresh, docusignSend, docusignSendFromHtml, docusignSigningUrl, saveContratoCliente, saveContratoCorpoOverride, aceitarContrato, solicitarCorrecaoContrato, type BoardRow, type ContratoRow, type ContratoReview } from "../lib/api";
import { gerarHTMLContrato, abrirContratoParaImpressao } from "../lib/contratoGenerator";
import { carregarClausulaAtiva, type Clausula } from "../lib/clausulas";
import { numerarItensProposta, type SimulacaoItemRaw, type ItemHierarquico } from "../lib/numerarItensProposta";
import type { AppUser } from "../lib/auth";
import Header from "../components/Header";

export default function CardPage({ user }: { user: AppUser }) {
  const T = useTokens();
  const { cardId } = useParams<{ cardId: string }>();
  const [row, setRow]         = useState<BoardRow | null>(null);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [itensRaw, setItensRaw] = useState<SimulacaoItemRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  async function reload() {
    if (!cardId) return;
    setLoading(true);
    const card = await supabase.from("kanban_cards")
      .select("id,title,column_id,responsavel,created_at,updated_at,details,tags,value")
      .eq("id", cardId).maybeSingle();
    const simId = (card.data?.details as any)?.simulacao_id;
    const [sim, cs, itensRes] = await Promise.all([
      simId ? supabase.from("simulacao_projetos").select("id,numero,cliente,vendedor,arquiteto,meta,forma_pagamento,pag_prazo_entrega,pag_prazo_execucao,pag_dados_bancarios,pag_razao_social,pag_garantia,cnpj_cpf,endereco,desconto_perc,desconto_valor,desconto_modo,validade_dias,frete_valor").eq("id", simId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("contratos_docusign")
        .select("id,card_id,envelope_id,status,titulo,sent_at,completed_at,last_event,created_at")
        .eq("card_id", cardId).order("created_at", { ascending: false }),
      simId ? supabase.from("simulacao_itens").select("id,categoria,descritivo,valor,ordem").eq("simulacao_id", simId).order("ordem", { ascending: true }) : Promise.resolve({ data: [] }),
    ]);
    setRow({ card: card.data as any, contrato: (cs.data as any)?.[0] || null, simulacao: sim.data as any });
    setContratos((cs.data as any) || []);
    setItensRaw(((itensRes as any).data || []) as SimulacaoItemRaw[]);
    setLoading(false);
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [cardId]);

  // ── Todos os hooks precisam vir ANTES de qualquer return condicional
  //    (Rules of Hooks — React error #310)
  //
  // Memoizamos cc/det pra manter referências estáveis entre renders —
  // caso contrário o useMemo de `c` recomputa infinitamente e o useEffect
  // do preview fica setando previewHtml num loop (piscar do PDF).
  const cc  = useMemo(() => ((row?.simulacao?.meta as any)?.contrato_cliente) || {},
    [row?.simulacao?.meta]);
  const det = useMemo(() => (row?.card.details as any) || {},
    [row?.card.details]);
  const sim = row?.simulacao as any;

  // Moeda da proposta — vem de simulacao_projetos.meta.moeda, que aceita duas
  // formas: string ("USD") ou objeto ({codigo:"USD"}). Os valores gravados no
  // banco JA estao convertidos; a flag so troca simbolo e locale na exibicao.
  const moeda = useMemo(() => {
    const raw = (sim?.meta as any)?.moeda ?? (sim as any)?.moeda ?? null;
    const cod = typeof raw === "string" ? raw : raw?.codigo;
    return cod ? String(cod).toUpperCase() : "BRL";
  }, [sim]);

  // O renderer PGSTRUCT35 le window._pktPropCurrency na hora de formatar cada
  // valor (mesmo contrato do valor.parket.works). Precisa estar setado ANTES de
  // gerar o HTML — depois disso os valores ja estao "assados" na string.
  function aplicarMoedaGlobal() {
    (window as any)._pktPropCurrency = moeda !== "BRL" ? moeda : null;
  }

  // Merge mesmo esquema do Homebroker (CardDetail.tsx → EnviarContratoModal)
  // Prioridade: contrato_cliente da proposta > card.details (dados do handoff comercial) > simulação
  const c = useMemo(() => ({
    nome:              cc.nome              || det.contato_principal || det.nome_completo || row?.card.title || "",
    cpf_cnpj:          cc.cpf_cnpj          || det.cpf_cnpj          || det.cnpj          || sim?.cnpj_cpf   || "",
    rg:                cc.rg                || det.rg                || det.inscricao_estadual || "",
    telefone:          cc.telefone          || det.telefone_comercial|| det.celular       || det.telefone    || "",
    email:             cc.email             || det.email             || det.email_comercial || "",
    cep:               cc.cep               || det.cep               || "",
    estado_civil:      cc.estado_civil      || "",
    rua:               cc.rua               || det.endereco          || det.endereco_obra || "",
    numero:            cc.numero            || det.numero            || "",
    complemento:       cc.complemento       || det.complemento       || "",
    bairro:            cc.bairro            || det.bairro            || "",
    cidade:            cc.cidade            || det.cidade            || "",
    uf:                cc.uf                || det.uf                || det.estado        || "",
    arquiteto_nome:    cc.arquiteto_nome    || sim?.arquiteto        || det.arquitetura   || det.arquiteto   || "",
    arquiteto_rt_pct:  cc.arquiteto_rt_pct  || det.arquiteto_rt_pct  || "",
    forma_pagamento:   cc.forma_pagamento   || sim?.forma_pagamento  || det.forma_pagamento  || "",
    pag_prazo_entrega: cc.pag_prazo_entrega || sim?.pag_prazo_entrega|| det.pag_prazo_entrega|| "",
    pag_prazo_execucao:cc.pag_prazo_execucao|| sim?.pag_prazo_execucao|| det.pag_prazo_execucao|| "",
    pag_dados_bancarios: cc.pag_dados_bancarios || sim?.pag_dados_bancarios || det.pag_dados_bancarios || "",
    pag_razao_social:    cc.pag_razao_social    || sim?.pag_razao_social    || det.pag_razao_social    || "",
    pag_garantia:        cc.pag_garantia        || sim?.pag_garantia        || det.pag_garantia        || "",
    vendedor:            cc.vendedor            || row?.card.responsavel    || sim?.vendedor           || det.vendedor || "",
    numero_proposta:     cc.numero_proposta     || sim?.numero              || det.numero_proposta     || "",
    aceito_em:           cc.aceito_em,
  }), [cc, det, sim, row?.card.responsavel, row?.card.title]);

  const clienteNome = c.nome || sim?.cliente || row?.card.title || "sem cliente";

  // Puxa itens da simulação pra montar o objeto do contrato (produtos + m²)
  const [itens, setItens] = useState<any[]>([]);
  useEffect(() => {
    const simId = (row?.card.details as any)?.simulacao_id;
    if (!simId) { setItens([]); return; }
    supabase.from("simulacao_itens").select("id,categoria,descritivo,valor,ordem").eq("simulacao_id", simId).order("ordem")
      .then(({ data }) => setItens((data as any[]) || []));
  }, [row?.card?.id]);

  // Itens hierárquicos (numeração N.M) — memoizado pra não recalcular no re-render.
  // Mesma lógica que a RPC gestao.projetar_de_proposta aplica no handoff.
  const itensHierarquicos = useMemo<ItemHierarquico[]>(
    () => numerarItensProposta(itensRaw),
    [itensRaw],
  );

  // Corpo customizado do contrato (versão ativa em `contrato_clausulas`) —
  // se null, o renderer usa o hardcoded do PGSTRUCT35. Carrega uma vez.
  const [clausulaAtiva, setClausulaAtiva] = useState<Clausula | null>(null);
  useEffect(() => { carregarClausulaAtiva().then(setClausulaAtiva); }, []);

  // Override por proposta em `simulacao_projetos.meta.contrato_corpo_override`.
  // Vem do sim.meta e vence a clausula global. Editor inline salva aqui.
  const overrideStored: string | null = ((sim?.meta as any)?.contrato_corpo_override) || null;
  const [showEditor, setShowEditor] = useState(false);
  // Editor guarda texto plano — <br> renderiza como \n na tela, e volta a virar
  // <br> ao salvar. Isso deixa a edição parecendo o contrato final, sem HTML cru.
  const [editorTexto, setEditorTexto] = useState<string>("");
  const [savingCorpo, setSavingCorpo] = useState(false);
  const htmlToTexto = (html: string) => (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/?p>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const textoToHtml = (t: string) => (t || "").replace(/\n/g, "<br>");
  useEffect(() => {
    if (showEditor) {
      const source = overrideStored ?? clausulaAtiva?.corpo_html ?? "";
      setEditorTexto(htmlToTexto(source));
    }
    // eslint-disable-next-line
  }, [showEditor, sim?.id, clausulaAtiva?.id]);
  // Preview reflete edições ao vivo enquanto o editor está aberto.
  const corpoContratoEfetivo: string | undefined =
    (showEditor && editorTexto.trim().length > 0)
      ? textoToHtml(editorTexto)
      : (overrideStored || clausulaAtiva?.corpo_html || undefined);

  // Gera HTML do contrato via renderer oficial da Parket (PGSTRUCT35).
  // Preview em iframe srcdoc — o motor do browser interpreta @page/DM Sans.
  // Input espelha exatamente o do Homebroker pra sair o MESMO PDF.
  const inputRef = useRef<any>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  useEffect(() => {
    if (!row) return;
    const input = {
      card: {
        ...row.card,
        responsavel: c.vendedor || row.card.responsavel,
        title: c.nome || row.card.title,
        details: {
          ...det,
          contato_principal: c.nome, celular: c.telefone, email: c.email,
          cnpj_cpf: c.cpf_cnpj, forma_pagamento: c.forma_pagamento,
          pag_prazo_entrega: c.pag_prazo_entrega, pag_prazo_execucao: c.pag_prazo_execucao,
          pag_garantia: c.pag_garantia, pag_dados_bancarios: c.pag_dados_bancarios,
          pag_razao_social: c.pag_razao_social, arquitetura: c.arquiteto_nome,
        },
      },
      sim: {
        ...(sim || {}),
        numero: c.numero_proposta || sim?.numero,
        forma_pagamento: c.forma_pagamento || sim?.forma_pagamento,
        arquiteto: c.arquiteto_nome || sim?.arquiteto,
        cnpj_cpf: c.cpf_cnpj,
        endereco: [c.rua, c.numero, c.complemento, c.bairro, c.cidade, c.uf, c.cep].filter(Boolean).join(", "),
        pag_garantia: c.pag_garantia, pag_prazo_entrega: c.pag_prazo_entrega,
        pag_prazo_execucao: c.pag_prazo_execucao, pag_dados_bancarios: c.pag_dados_bancarios,
        pag_razao_social: c.pag_razao_social,
      },
      itens,
      contratoCliente: c,
      corpoContrato: corpoContratoEfetivo,
    };
    inputRef.current = input;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        aplicarMoedaGlobal();
        const html = gerarHTMLContrato(input);
        // Só atualiza se o HTML realmente mudou — evita recarregar o iframe
        // (e resetar o scroll) quando nada de relevante mudou.
        setPreviewHtml((prev) => (prev === html ? prev : html));
      } catch (e) { console.error(e); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [c, itens, row, corpoContratoEfetivo, moeda]);

  // Hooks de review — ANTES do early return pra não quebrar Rules of Hooks
  const [busyReview, setBusyReview]     = useState(false);
  const [showRejeitar, setShowRejeitar] = useState(false);
  const [motivoRejeitar, setMotivoRejeitar] = useState("");
  const [camposRejeitar, setCamposRejeitar] = useState<string[]>([]);

  // Toast de sucesso (fica 5s na tela após envio)
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Modal de signatários (contratante, contratado, 2 testemunhas) — igual ao Core
  const [showSignModal, setShowSignModal] = useState(false);
  const [sigForm, setSigForm] = useState({
    contratante: { nome: "", email: "" },
    contratado:  { nome: "", email: "" },
    testemunha1: { nome: "", email: "", rg: "", cpf: "" },
    testemunha2: { nome: "", email: "", rg: "", cpf: "" },
  });

  async function patchC(patch: Record<string, any>) {
    const simId = (row?.card.details as any)?.simulacao_id;
    if (!simId) { alert("Card sem simulacao_id"); return; }
    await saveContratoCliente(simId, patch);
    await reload();
  }

  // Edição acumulada dos campos do cliente: nada salva por campo; alterações ficam
  // em `dirty` e só persistem quando o usuário clica no botão geral "Salvar alterações".
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [savingAll, setSavingAll] = useState(false);
  const setField = (k: string) => (v: string) => setDirty((d) => ({ ...d, [k]: v }));
  // Valor exibido: rascunho editado (se houver) senão o valor atual do banco
  const val = (k: string, atual: any) => (k in dirty ? dirty[k] : atual);
  async function salvarCampos() {
    setSavingAll(true);
    try { await patchC(dirty); setDirty({}); }
    catch (e: any) { alert("Erro: " + e.message); }
    finally { setSavingAll(false); }
  }

  if (loading || !row) {
    return (
      <div style={{ background: T.bg, color: T.textSecondary, height: "calc(100vh / var(--pkz, 1))", display: "grid", placeItems: "center", fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
        Carregando…
      </div>
    );
  }

  const review: ContratoReview = (det.contrato_review || null);
  const podeEnviar = review?.status === "aceito";

  async function onAceitar() {
    if (!row?.card.id) return;
    setBusyReview(true);
    try {
      await aceitarContrato(row.card.id, user.email);
      await reload();
    } catch (e: any) { alert(e?.message || "Falha ao aceitar"); }
    finally { setBusyReview(false); }
  }

  async function onConfirmarRejeitar() {
    if (!row?.card.id) return;
    if (!motivoRejeitar.trim() && camposRejeitar.length === 0) {
      alert("Descreva o que está faltando ou marque os campos a corrigir.");
      return;
    }
    setBusyReview(true);
    try {
      const { vendedor } = await solicitarCorrecaoContrato({
        contratoCardId: row.card.id,
        clienteNome: clienteNome,
        motivo: motivoRejeitar.trim() || `Campos a corrigir: ${camposRejeitar.join(", ")}`,
        camposFaltando: camposRejeitar,
        userEmail: user.email,
      });
      setShowRejeitar(false);
      setMotivoRejeitar("");
      setCamposRejeitar([]);
      await reload();
      alert(vendedor
        ? `Solicitação enviada pro ${vendedor.nome} (${vendedor.email}). Ele recebe uma tarefa e notificação no Homebroker.`
        : "Solicitação registrada, mas não achei o vendedor no user_profiles — verifique o campo Responsável do card.");
    } catch (e: any) { alert(e?.message || "Falha ao solicitar correção"); }
    finally { setBusyReview(false); }
  }

  function onSendContract() {
    if (!row?.card.id) return;
    if (!podeEnviar) {
      alert("Aceite as informações do contrato antes de enviar pra assinatura.");
      return;
    }
    if (!row.simulacao?.id) {
      alert("Card sem proposta vinculada (simulacao_id ausente). Não dá pra enviar contrato sem os valores da proposta.");
      return;
    }
    if (itens.length === 0) {
      alert("A proposta vinculada não tem itens carregados. Aguarde ou recarregue — contrato não pode sair sem os valores.");
      return;
    }
    const totalItens = itens.reduce((s, i) => s + Number(i.valor || 0), 0);
    if (totalItens <= 0) {
      alert(`Proposta com valor total ${(0).toLocaleString(moeda === "USD" ? "en-US" : "pt-BR", { style: "currency", currency: moeda })}. Ajuste os valores antes de enviar o contrato.`);
      return;
    }
    // Pré-preenche o modal com dados que já temos
    setSigForm({
      contratante: { nome: c.nome || "", email: c.email || "" },
      contratado:  { nome: "", email: "" },
      testemunha1: { nome: "", email: "", rg: "", cpf: "" },
      testemunha2: { nome: "", email: "", rg: "", cpf: "" },
    });
    setShowSignModal(true);
  }

  async function doSend() {
    if (!row?.card.id) return;
    // Monta lista com os anchors iguais aos que o renderer coloca no HTML
    const sigs: any[] = [];
    if (sigForm.contratante.nome.trim() && sigForm.contratante.email.trim()) {
      sigs.push({ nome: sigForm.contratante.nome.trim(), email: sigForm.contratante.email.trim(), papel: "contratante", anchor: "\\sign_contratante\\" });
    }
    if (sigForm.contratado.nome.trim() && sigForm.contratado.email.trim()) {
      sigs.push({ nome: sigForm.contratado.nome.trim(), email: sigForm.contratado.email.trim(), papel: "contratado", anchor: "\\sign_contratado\\" });
    }
    if (sigForm.testemunha1.nome.trim() && sigForm.testemunha1.email.trim()) {
      sigs.push({
        nome: sigForm.testemunha1.nome.trim(), email: sigForm.testemunha1.email.trim(),
        papel: "testemunha1", anchor: "\\sign_witness1\\",
        rg:  sigForm.testemunha1.rg.trim()  || undefined,
        cpf: sigForm.testemunha1.cpf.trim() || undefined,
      });
    }
    if (sigForm.testemunha2.nome.trim() && sigForm.testemunha2.email.trim()) {
      sigs.push({
        nome: sigForm.testemunha2.nome.trim(), email: sigForm.testemunha2.email.trim(),
        papel: "testemunha2", anchor: "\\sign_witness2\\",
        rg:  sigForm.testemunha2.rg.trim()  || undefined,
        cpf: sigForm.testemunha2.cpf.trim() || undefined,
      });
    }
    if (sigs.length < 2) {
      alert("Preencha ao menos Contratante e Contratado (nome + email) antes de enviar.");
      return;
    }
    setSending(true);
    try {
      if (pdfFile) {
        // Usuário anexou um PDF customizado → usa esse
        const pdfB64 = (await fileToBase64(pdfFile)).replace(/^data:.+;base64,/, "");
        await docusignSend({
          card_id: row.card.id, pdf_base64: pdfB64, pdf_filename: pdfFile.name,
          email_subject: `Contrato Parket — ${clienteNome}`,
          email_blurb: "Segue o contrato para sua assinatura digital.",
          titulo: "Contrato Principal", signatarios: sigs,
        });
      } else {
        // Sem anexo — backend renderiza o PDF do próprio preview (mesma
        // saída do 'Abrir e imprimir', só que server-side via Playwright).
        if (!previewHtml) {
          alert("Preview do contrato ainda tá sendo gerado — aguarde alguns segundos e tenta de novo.");
          setSending(false); return;
        }
        const htmlB64 = btoaUtf8(previewHtml);
        await docusignSendFromHtml({
          card_id: row.card.id, html_base64: htmlB64, pdf_filename: `contrato-${clienteNome.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`,
          email_subject: `Contrato Parket — ${clienteNome}`,
          email_blurb: "Segue o contrato para sua assinatura digital.",
          titulo: "Contrato Principal", signatarios: sigs,
        });
      }
      setPdfFile(null);
      setShowSignModal(false);
      setToast(`✓ Contrato enviado para assinatura com sucesso. Card movido para "Contrato Enviado".`);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Falha ao enviar contrato");
    } finally { setSending(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.textPrimary, fontFamily: fonts.inter }}>
      <Header user={user} />

      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ fontSize: 10, letterSpacing: "0.18em", color: T.textSecondary, textTransform: "uppercase", textDecoration: "none" }}>
          ← Voltar ao Kanban
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, padding: "0 24px 40px" }}>
        {/* Coluna principal — dados do cliente */}
        <div>
          <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 8, letterSpacing: "0.24em", color: T.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
              {row.simulacao?.numero ? `PROPOSTA #${row.simulacao.numero}` : "CONTRATO"}
            </div>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 22, letterSpacing: "0.10em", color: T.textPrimary, textTransform: "uppercase" }}>
              {clienteNome}
            </div>
            <div style={{ fontSize: 10, letterSpacing: "0.16em", color: T.textSecondary, marginTop: 8, textTransform: "uppercase" }}>
              {row.card.column_id?.replace("-", " ")} · {row.card.responsavel || row.simulacao?.vendedor || "sem vendedor"}
            </div>
          </div>

          <SectionTitle T={T}>Dados do cliente</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <FieldEdit T={T} label="Nome completo" value={val("nome", c.nome)}         onChange={setField("nome")} changed={"nome" in dirty} span={2} />
            {/* Máscara ao digitar: CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) conforme o nº de dígitos */}
            <FieldEdit T={T} label="CPF / CNPJ"   value={val("cpf_cnpj", c.cpf_cnpj)} onChange={setField("cpf_cnpj")} changed={"cpf_cnpj" in dirty} format={formatCpfCnpj} />
            <FieldEdit T={T} label="RG / IE"      value={val("rg", c.rg)}             onChange={setField("rg")} changed={"rg" in dirty} />
            <FieldEdit T={T} label="Telefone"     value={val("telefone", c.telefone)} onChange={setField("telefone")} changed={"telefone" in dirty} />
            <FieldEdit T={T} label="E-mail"       value={val("email", c.email)}       onChange={setField("email")} changed={"email" in dirty} />
            <FieldEdit T={T} label="Endereço"     value={val("rua", c.rua)}           onChange={setField("rua")} changed={"rua" in dirty} span={2} />
            {/* CEP mascarado (00000-000), posicionado logo abaixo do Endereço */}
            <FieldEdit T={T} label="CEP"          value={val("cep", c.cep)}           onChange={setField("cep")} changed={"cep" in dirty} format={formatCep} />
            <FieldEdit T={T} label="Número"       value={val("numero", c.numero)}     onChange={setField("numero")} changed={"numero" in dirty} />
            <FieldEdit T={T} label="Complemento"  value={val("complemento", c.complemento)} onChange={setField("complemento")} changed={"complemento" in dirty} />
            <FieldEdit T={T} label="Bairro"       value={val("bairro", c.bairro)}     onChange={setField("bairro")} changed={"bairro" in dirty} />
            <FieldEdit T={T} label="Cidade"       value={val("cidade", c.cidade)}     onChange={setField("cidade")} changed={"cidade" in dirty} />
            <FieldEdit T={T} label="UF"           value={val("uf", c.uf)}             onChange={setField("uf")} changed={"uf" in dirty} format={(v) => v.toUpperCase().slice(0, 2)} />
          </div>

          {/* Botão geral: salva de uma vez todos os campos editados (cliente + arquiteto) */}
          {Object.keys(dirty).length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: -12, marginBottom: 24 }}>
              <button onClick={salvarCampos} disabled={savingAll}
                style={{ background: "#5A9CE0", border: "1px solid #5A9CE0", color: "#fff", padding: "8px 16px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: fonts.inter }}>
                {savingAll ? "Salvando..." : `Salvar alterações (${Object.keys(dirty).length})`}
              </button>
              <button onClick={() => setDirty({})} disabled={savingAll}
                style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textSecondary, padding: "8px 16px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: fonts.inter }}>
                Descartar
              </button>
            </div>
          )}

          <SectionTitle T={T}>Arquiteto / RT</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 24 }}>
            <FieldEdit T={T} label="Arquiteto responsável" value={val("arquiteto_nome", c.arquiteto_nome || row.simulacao?.arquiteto)} onChange={setField("arquiteto_nome")} changed={"arquiteto_nome" in dirty} />
            <FieldEdit T={T} label="RT (%)" value={val("arquiteto_rt_pct", c.arquiteto_rt_pct)} onChange={setField("arquiteto_rt_pct")} changed={"arquiteto_rt_pct" in dirty} />
          </div>

          <SectionTitle T={T}>Verificação</SectionTitle>
          <ReviewPanel
            T={T}
            review={review}
            busy={busyReview}
            vendedorNome={row.card.responsavel || row.simulacao?.vendedor || ""}
            onAceitar={onAceitar}
            onAbrirRejeitar={() => setShowRejeitar(true)}
          />

          {/* <ItensComprados T={T} itens={itensHierarquicos} /> — oculto por decisão do Will (02/07).
              A lógica de numeração hierárquica (numerarItensProposta) continua rodando
              e a RPC gestao.projetar_de_proposta segue herdando tudo na assinatura DocuSign.
              Pra reativar, descomente esta linha. */}

          <SectionTitle T={T}>Contrato Parket · Preview</SectionTitle>
          <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, padding: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, fontSize: 10, letterSpacing: "0.14em", color: T.textSecondary, textTransform: "uppercase" }}>
                Renderizado com o padrão oficial Parket · dados do card + form do cliente
                {overrideStored && <span style={{ marginLeft: 8, color: ACCENT.gold }}>· Cláusulas customizadas pra esta proposta</span>}
              </div>
              <button
                type="button"
                onClick={() => setShowEditor((v) => !v)}
                style={{ background: showEditor ? T.textPrimary : "transparent", border: `1px solid ${T.textPrimary}`, color: showEditor ? T.bg : T.textPrimary, padding: "6px 14px", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", cursor: "pointer", fontFamily: fonts.inter }}
                title="Editar as cláusulas desta proposta (não afeta outras)"
              >
                {showEditor ? "Fechar editor" : "Editar contrato"}
              </button>
              <button
                type="button"
                onClick={() => { if (inputRef.current) { aplicarMoedaGlobal(); abrirContratoParaImpressao(inputRef.current); } }}
                style={{ background: "transparent", border: `1px solid ${ACCENT.gold}`, color: ACCENT.gold, padding: "6px 14px", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", cursor: "pointer", fontFamily: fonts.inter }}
                title="Abre em nova aba com impressão automática — salvar como PDF"
              >
                Abrir e imprimir
              </button>
            </div>

            {showEditor && (
              <div style={{ marginBottom: 12, padding: 12, background: T.bg, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ flex: 1, fontSize: 9, letterSpacing: "0.16em", color: T.textMuted, textTransform: "uppercase" }}>
                    Cláusulas · use {"{{CLIENTE}}"}, {"{{CPF}}"}, {"{{ENDERECO}}"} pra dados do cliente · Enter = nova linha
                  </span>
                  <button
                    type="button"
                    disabled={savingCorpo}
                    onClick={() => setEditorTexto(htmlToTexto(clausulaAtiva?.corpo_html ?? ""))}
                    style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textSecondary, padding: "5px 10px", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", fontFamily: fonts.inter }}
                    title="Recarrega o texto padrão do sistema (não salva)"
                  >
                    Restaurar padrão
                  </button>
                  {overrideStored && (
                    <button
                      type="button"
                      disabled={savingCorpo}
                      onClick={async () => {
                        if (!sim?.id) return;
                        if (!confirm("Remover as cláusulas desta proposta e voltar ao padrão?")) return;
                        setSavingCorpo(true);
                        try { await saveContratoCorpoOverride(sim.id, null); await reload(); setShowEditor(false); }
                        catch (e: any) { alert(e.message || "Erro"); }
                        finally { setSavingCorpo(false); }
                      }}
                      style={{ background: "transparent", border: `1px solid ${ACCENT.gold}`, color: ACCENT.gold, padding: "5px 10px", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", fontFamily: fonts.inter }}
                    >
                      Remover customização
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={savingCorpo || !editorTexto.trim()}
                    onClick={async () => {
                      if (!sim?.id) { alert("Card sem simulacao_id"); return; }
                      setSavingCorpo(true);
                      try { await saveContratoCorpoOverride(sim.id, textoToHtml(editorTexto)); await reload(); setShowEditor(false); }
                      catch (e: any) { alert(e.message || "Erro"); }
                      finally { setSavingCorpo(false); }
                    }}
                    style={{ background: T.textPrimary, color: T.bg, border: "none", padding: "6px 14px", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", cursor: "pointer", fontFamily: fonts.inter, opacity: savingCorpo ? 0.5 : 1 }}
                  >
                    {savingCorpo ? "Salvando…" : "Salvar pra esta proposta"}
                  </button>
                </div>
                <textarea
                  value={editorTexto}
                  onChange={(e) => setEditorTexto(e.target.value)}
                  spellCheck={true}
                  style={{
                    width: "100%", height: 520, resize: "vertical",
                    fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                    fontSize: 13, lineHeight: 1.7, padding: "18px 22px",
                    background: "#ededed", color: "#1a1a1a",
                    border: `1px solid ${T.border}`, outline: "none",
                    whiteSpace: "pre-wrap",
                  }}
                />
              </div>
            )}

            {previewHtml ? (
              <iframe srcDoc={previewHtml} title="Preview do contrato" style={{ width: "100%", height: 720, border: `1px solid ${T.border}`, background: "#ffffff" }} />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                Gerando preview…
              </div>
            )}
          </div>

          <SectionTitle T={T}>Envelope DocuSign</SectionTitle>
          <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <label style={{
                flex: 1, cursor: "pointer",
                background: T.inputBg, border: `1px dashed ${T.border}`,
                padding: 12, textAlign: "center",
                fontSize: 9, letterSpacing: "0.16em", color: T.textSecondary, textTransform: "uppercase",
              }}>
                <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
                {pdfFile ? `⚙ ${pdfFile.name}` : "Anexar PDF externo (opcional — padrão é o preview acima)"}
              </label>
              <button
                onClick={onSendContract} disabled={sending || !podeEnviar}
                title={!podeEnviar ? "Aceite as informações na seção Verificação antes de enviar" : ""}
                style={{
                  background: (sending || !podeEnviar) ? T.textMuted : ACCENT.gold, color: T.bg,
                  border: "none", padding: "10px 20px",
                  fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
                  fontWeight: 600, cursor: (sending || !podeEnviar) ? "not-allowed" : "pointer",
                  opacity: !podeEnviar ? 0.6 : 1,
                  fontFamily: fonts.inter,
                }}
              >{sending ? "enviando…" : "enviar pra assinatura"}</button>
            </div>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", color: T.textMuted, textTransform: "uppercase", marginBottom: 10 }}>
              {!podeEnviar
                ? "🔒 Verificação pendente — aceite as informações acima antes de enviar."
                : "Sem anexo, o backend renderiza o preview acima em PDF e envia. Após envio, o cliente recebe email do DocuSign."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {contratos.length === 0 && (
                <div style={{ padding: 16, fontSize: 10, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center" }}>
                  Nenhum contrato enviado ainda
                </div>
              )}
              {contratos.map((ct) => <EnvelopeRow key={ct.id} ct={ct} T={T} onRefresh={reload} />)}
            </div>
          </div>
        </div>

        {/* Sidebar — metadados + timeline */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, padding: 18 }}>
            <SectionTitle T={T} tight>Metadados</SectionTitle>
            <Meta T={T} label="Card ID"  value={row.card.id.slice(0, 8)} mono />
            <Meta T={T} label="Vendedor" value={row.card.responsavel || row.simulacao?.vendedor} />
            <Meta T={T} label="Arquiteto" value={row.simulacao?.arquiteto} />
            <Meta T={T} label="Criado em" value={new Date(row.card.created_at).toLocaleDateString("pt-BR")} />
            <Meta T={T} label="Atualizado" value={new Date(row.card.updated_at).toLocaleDateString("pt-BR")} />
            {c.aceito_em && <Meta T={T} label="Cliente aceitou termos" value={new Date(c.aceito_em).toLocaleString("pt-BR")} />}
          </div>
          <TimelinePanel T={T} row={row} contratos={contratos} review={review} />
        </aside>
      </div>

      {showRejeitar && (
        <RejeitarModal
          T={T}
          motivo={motivoRejeitar}
          campos={camposRejeitar}
          busy={busyReview}
          onChangeMotivo={setMotivoRejeitar}
          onToggleCampo={(k) => setCamposRejeitar((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])}
          onCancel={() => { setShowRejeitar(false); setMotivoRejeitar(""); setCamposRejeitar([]); }}
          onConfirm={onConfirmarRejeitar}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 100,
          background: ACCENT.green, color: T.bg,
          padding: "14px 22px", border: `1px solid ${ACCENT.green}`,
          fontFamily: fonts.inter, fontSize: 12, fontWeight: 600,
          maxWidth: 380, boxShadow: `0 8px 24px ${T.overlay}`,
        }}>
          {toast}
        </div>
      )}

      {showSignModal && (
        <SignatariosModal
          T={T}
          form={sigForm}
          setForm={setSigForm}
          busy={sending}
          onCancel={() => setShowSignModal(false)}
          onConfirm={doSend}
        />
      )}
    </div>
  );
}

// ── Verificação / Aceite ────────────────────────────────────────────────────

function ReviewPanel({ T, review, busy, vendedorNome, onAceitar, onAbrirRejeitar }: {
  T: any; review: any; busy: boolean; vendedorNome: string;
  onAceitar: () => void; onAbrirRejeitar: () => void;
}) {
  const status = review?.status || null;
  if (status === "aceito") {
    return (
      <div style={{ background: "rgba(122,160,122,0.10)", border: "1px solid rgba(122,160,122,0.35)", padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: ACCENT.green, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
          ✓ Informações aceitas
        </div>
        <div style={{ fontSize: 11, color: T.textSecondary }}>
          Aceito por {review.aceito_por_email} em {new Date(review.aceito_em).toLocaleString("pt-BR")}. Envio pra DocuSign liberado.
        </div>
      </div>
    );
  }
  if (status === "pendente_vendedor") {
    return (
      <div style={{ background: "rgba(201,148,74,0.10)", border: "1px solid rgba(201,148,74,0.45)", padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: ACCENT.amber, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>
          ⏳ Aguardando {vendedorNome || "vendedor"}
        </div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6, lineHeight: 1.5 }}>
          {review.motivo}
        </div>
        {review.campos_faltando?.length > 0 && (
          <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Campos: {review.campos_faltando.join(" · ")}
          </div>
        )}
        <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>
          Solicitado por {review.aberto_por_email} em {new Date(review.aberto_em).toLocaleString("pt-BR")}
        </div>
      </div>
    );
  }
  // sem review ainda OU reenviado — mostra os botões
  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, padding: 20, marginBottom: 24 }}>
      {status === "reenviado" && (
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#5A9CE0", textTransform: "uppercase", marginBottom: 12 }}>
          ↻ Vendedor reenviou · revise abaixo
        </div>
      )}
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
        Confira dados do cliente + valores da proposta acima. Aceite pra liberar o envio ao DocuSign, ou solicite correção pro vendedor.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onAceitar} disabled={busy}
          style={{
            background: "#5AA05A", color: "#0a0a0a", border: "none",
            padding: "10px 18px", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase",
            fontWeight: 600, cursor: busy ? "wait" : "pointer", fontFamily: fonts.inter,
          }}
        >{busy ? "…" : "✓ Aceitar informações"}</button>
        <button
          onClick={onAbrirRejeitar} disabled={busy}
          style={{
            background: "transparent", color: "#E6AA32", border: "1px solid #E6AA32",
            padding: "10px 18px", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase",
            fontWeight: 600, cursor: busy ? "wait" : "pointer", fontFamily: fonts.inter,
          }}
        >✗ Solicitar correção</button>
      </div>
    </div>
  );
}

const CAMPOS_OPCOES = [
  { k: "nome",         label: "Nome / CPF / RG" },
  { k: "endereco",     label: "Endereço completo" },
  { k: "contato",      label: "Telefone / e-mail" },
  { k: "pagamento",    label: "Forma de pagamento" },
  { k: "prazos",       label: "Prazos entrega/execução" },
  { k: "dados_bancarios", label: "Dados bancários / razão social" },
  { k: "arquiteto",    label: "Arquiteto / RT" },
  { k: "proposta",     label: "Valores da proposta" },
];

function RejeitarModal({ T, motivo, campos, busy, onChangeMotivo, onToggleCampo, onCancel, onConfirm }: {
  T: any; motivo: string; campos: string[]; busy: boolean;
  onChangeMotivo: (v: string) => void; onToggleCampo: (k: string) => void;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: T.overlay,
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }}
    onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg, border: `1px solid ${T.borderHover}`,
        maxWidth: 520, width: "90%", padding: 24, fontFamily: fonts.inter,
      }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em", color: T.textPrimary, textTransform: "uppercase", marginBottom: 4 }}>
          Solicitar correção
        </div>
        <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
          O vendedor recebe tarefa + notificação no Homebroker
        </div>

        <div style={{ fontSize: 9, letterSpacing: "0.20em", color: T.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
          O que precisa ajustar?
        </div>
        <textarea
          value={motivo}
          onChange={(e) => onChangeMotivo(e.target.value)}
          placeholder="Ex: falta CNPJ, dados bancários pra emissão da NF, e o cliente é PJ mas os dados estão como PF."
          rows={4}
          style={{
            width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
            color: T.textPrimary, padding: 10, fontSize: 12, fontFamily: fonts.inter,
            outline: "none", resize: "vertical", marginBottom: 16, boxSizing: "border-box",
          }}
        />

        <div style={{ fontSize: 9, letterSpacing: "0.20em", color: T.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
          Campos a revisar (opcional)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
          {CAMPOS_OPCOES.map((op) => {
            const on = campos.includes(op.k);
            return (
              <label key={op.k} style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: "8px 10px", background: on ? T.statBg : "transparent",
                border: `1px solid ${on ? "var(--borderHover)" : T.border}`,
                fontSize: 11, color: T.textSecondary,
              }}>
                <input type="checkbox" checked={on} onChange={() => onToggleCampo(op.k)} style={{ margin: 0 }} />
                {op.label}
              </label>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} disabled={busy}
            style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textSecondary, padding: "10px 18px", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: fonts.inter, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{ background: busy ? T.textMuted : "#E6AA32", color: "#0a0a0a", border: "none", padding: "10px 18px", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, fontFamily: fonts.inter, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "enviando…" : "enviar solicitação"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── UI helpers ───────────────────────────────────────────────────────────────

function SectionTitle({ children, T, tight }: { children: React.ReactNode; T: any; tight?: boolean }) {
  return (
    <div style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.24em", color: T.textPrimary, textTransform: "uppercase", marginBottom: tight ? 10 : 12 }}>
      {children}
    </div>
  );
}

function Meta({ label, value, T, mono }: { label: string; value: any; T: any; mono?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 8, letterSpacing: "0.22em", color: T.textMuted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 11, color: T.textPrimary, fontFamily: mono ? "monospace" : fonts.inter, marginTop: 2 }}>{String(value)}</div>
    </div>
  );
}

/* Máscaras de preenchimento (aplicadas ao digitar via prop `format` do FieldEdit) */
// CPF/CNPJ: só dígitos; até 11 = CPF 000.000.000-00, acima = CNPJ 00.000.000/0000-00
function formatCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

// CEP: 00000-000
function formatCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

/* Campo editável SEM salvamento próprio: o rascunho vive no pai (state `dirty` do CardPage)
 * e só persiste quando o usuário clica no botão geral "Salvar alterações".
 * `changed` destaca a borda do campo com edição pendente. */
function FieldEdit({ label, value, onChange, T, span, format, changed }: { label: string; value: any; onChange: (v: string) => void; T: any; span?: number; format?: (v: string) => string; changed?: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <div style={{ gridColumn: span ? `span ${span}` : "auto" }}>
      <div style={{ fontSize: 8, letterSpacing: "0.22em", color: T.textMuted, textTransform: "uppercase" }}>{label}</div>
      {editing ? (
        <input autoFocus value={value == null ? "" : String(value)}
          onChange={(e) => onChange(format ? format(e.target.value) : e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(false); }}
          style={{ width: "100%", boxSizing: "border-box", marginTop: 4, background: T.inputBg, border: `1px solid ${changed ? "#5A9CE0" : T.borderHover}`, color: T.textPrimary, padding: "6px 8px", fontSize: 12, outline: "none", fontFamily: fonts.inter }}
        />
      ) : (
        <div onClick={() => setEditing(true)}
          style={{ fontSize: 12, color: value ? T.textPrimary : T.textMuted, marginTop: 4, padding: "6px 8px", background: T.statBg, border: `1px solid ${changed ? "#5A9CE0" : T.border}`, cursor: "text", minHeight: 30 }}>
          {value || <span style={{ fontStyle: "italic" }}>vazio</span>}
        </div>
      )}
    </div>
  );
}

const SIGNER_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  created:   { label: "aguardando envio",  color: "#a1a1aa" },
  sent:      { label: "enviado",           color: "#5A9CE0" },
  delivered: { label: "aberto",            color: "#3B82F6" },
  completed: { label: "assinou ✓",         color: "#10B981" },
  signed:    { label: "assinou ✓",         color: "#10B981" },
  declined:  { label: "recusou",           color: "#EF4444" },
  autoresponded: { label: "auto-resposta", color: "#A78BFA" },
};

function EnvelopeRow({ ct, T, onRefresh }: { ct: ContratoRow; T: any; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const c = STATUS_COLOR[ct.status] || "#77736A";
  const signers = ((ct.last_event as any)?.signers as any[] | undefined) || [];
  const assinaram = signers.filter((s) => (s.status || "").toLowerCase() === "completed" || (s.status || "").toLowerCase() === "signed").length;
  async function refresh() {
    if (!ct.envelope_id) return;
    setBusy(true);
    try { await docusignRefresh(ct.envelope_id); onRefresh(); } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }
  return (
    <div style={{ background: T.statBg, border: `1px solid ${T.border}`, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: T.textPrimary, marginBottom: 2 }}>{ct.titulo || "Contrato"}</div>
          <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {ct.sent_at ? new Date(ct.sent_at).toLocaleString("pt-BR") : "—"} · {assinaram}/{signers.length} assinaram
          </div>
        </div>
        <span style={{ background: c, color: T.bg, padding: "3px 8px", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
          {ct.status}
        </span>
        {ct.envelope_id && (
          <button onClick={refresh} disabled={busy}
            style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textSecondary, padding: "6px 10px", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>
            {busy ? "…" : "sincronizar"}
          </button>
        )}
      </div>

      {signers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${T.border}` }}>
          {signers.map((s, i) => {
            const st = (s.status || "").toLowerCase();
            const info = SIGNER_STATUS_LABEL[st] || { label: st || "—", color: T.textMuted };
            const nome = s.name || s.email || "(sem nome)";
            const papel = (s.roleName || s.papel || "").replace(/[-_]/g, " ");
            const quando = s.signedDateTime || s.deliveredDateTime || s.sentDateTime;
            const podeGerarLink = !["completed", "signed", "declined"].includes(st);
            const recipientId = s.recipientId || s.recipient_id;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: T.textSecondary }}>
                <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ color: T.textPrimary }}>{nome}</span>
                  {papel && <span style={{ color: T.textMuted, marginLeft: 6, textTransform: "uppercase", fontSize: 8, letterSpacing: "0.10em" }}>· {papel}</span>}
                </div>
                {quando && (
                  <span style={{ color: T.textMuted, fontSize: 9 }}>
                    {new Date(quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {podeGerarLink && ct.envelope_id && recipientId && (
                  <CopiarLinkBtn envelopeId={ct.envelope_id} recipientId={String(recipientId)} T={T} />
                )}
                <span style={{ background: info.color, color: "#0a0a0a", padding: "1px 6px", fontSize: 8, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {info.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Timeline consolidada ────────────────────────────────────────────────────
// Junta eventos do card + review + envelopes + signatários em ordem cronológica.

type TimelineEvent = {
  when: string;         // ISO date
  icon: string;
  color: string;
  title: string;
  detail?: string;
};

function buildTimeline(row: BoardRow, contratos: ContratoRow[], review: any): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const cc = (row.simulacao?.meta as any)?.contrato_cliente || {};

  events.push({
    when: row.card.created_at,
    icon: "🆕", color: "#5A9CE0",
    title: "Card criado no Financeiro",
    detail: `Origem: ${(row.card.details as any)?.origem || "manual"}`,
  });

  if (cc.aceito_em) {
    events.push({
      when: cc.aceito_em,
      icon: "✓", color: "#10B981",
      title: "Cliente aceitou termos",
      detail: cc.nome,
    });
  }

  if (review?.aberto_em) {
    events.push({
      when: review.aberto_em,
      icon: "✗", color: "#E6AA32",
      title: "Financeiro solicitou correção",
      detail: `${review.aberto_por_email} — ${review.motivo?.slice(0, 90) || ""}`,
    });
  }
  if (review?.reenviado_em) {
    events.push({
      when: review.reenviado_em,
      icon: "↻", color: "#5A9CE0",
      title: "Vendedor reenviou informações",
      detail: review.reenviado_por_email,
    });
  }
  if (review?.aceito_em && review.status === "aceito") {
    events.push({
      when: review.aceito_em,
      icon: "✓", color: "#10B981",
      title: "Financeiro aceitou informações",
      detail: review.aceito_por_email,
    });
  }

  for (const ct of contratos) {
    events.push({
      when: ct.created_at,
      icon: "📄", color: "#A78BFA",
      title: `${ct.titulo || "Contrato"} criado`,
    });
    if (ct.sent_at) {
      events.push({
        when: ct.sent_at,
        icon: "📤", color: "#5A9CE0",
        title: `${ct.titulo || "Contrato"} enviado ao DocuSign`,
        detail: ct.envelope_id ? `Env ${ct.envelope_id.slice(0, 8)}…` : undefined,
      });
    }
    const signers = (ct.last_event as any)?.signers as any[] | undefined;
    for (const s of signers || []) {
      if (s.signed_at || s.signedDateTime) {
        events.push({
          when: s.signed_at || s.signedDateTime,
          icon: "✍️", color: "#10B981",
          title: `${s.name || s.email} assinou`,
          detail: (s.papel || s.roleName || "").replace(/[-_]/g, " "),
        });
      }
      if (s.declined_at || s.declinedDateTime) {
        events.push({
          when: s.declined_at || s.declinedDateTime,
          icon: "⛔", color: "#EF4444",
          title: `${s.name || s.email} recusou`,
          detail: s.decline_reason || s.declineReason,
        });
      }
    }
    if (ct.completed_at) {
      events.push({
        when: ct.completed_at,
        icon: "🎉", color: "#10B981",
        title: `${ct.titulo || "Contrato"} 100% assinado`,
      });
    }
  }

  // Ordena mais recente primeiro
  return events
    .filter((e) => !!e.when)
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
}

function TimelinePanel({ T, row, contratos, review }: { T: any; row: BoardRow; contratos: ContratoRow[]; review: any }) {
  const events = useMemo(() => buildTimeline(row, contratos, review), [row, contratos, review]);
  if (events.length === 0) return null;
  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, padding: 18 }}>
      <SectionTitle T={T} tight>Histórico ({events.length})</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
        {events.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 10, position: "relative" }}>
            <div style={{ width: 22, textAlign: "center", fontSize: 14, lineHeight: 1, color: e.color }}>{e.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: T.textPrimary, lineHeight: 1.3 }}>{e.title}</div>
              {e.detail && (
                <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.detail}
                </div>
              )}
              <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: "0.10em", marginTop: 3, textTransform: "uppercase" }}>
                {new Date(e.when).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CopiarLinkBtn({ envelopeId, recipientId, T }: { envelopeId: string; recipientId: string; T: any }) {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  async function copiar() {
    setBusy(true); setOk(false);
    try {
      const r = await docusignSigningUrl(envelopeId, recipientId);
      await navigator.clipboard.writeText(r.url);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e: any) {
      alert("Falha ao gerar link: " + (e?.message || e));
    } finally { setBusy(false); }
  }
  return (
    <button onClick={copiar} disabled={busy}
      title="Gera link de assinatura (válido ~5min) e copia pro clipboard"
      style={{
        background: ok ? "#10B981" : "transparent",
        border: `1px solid ${ok ? "#10B981" : T.border}`,
        color: ok ? "#0a0a0a" : T.textSecondary,
        padding: "3px 8px", fontSize: 8, letterSpacing: "0.10em",
        textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {busy ? "…" : ok ? "✓ copiado" : "🔗 copiar link"}
    </button>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** btoa que aguenta chars UTF-8 (o btoa nativo quebra em caracteres não-ASCII). */
function btoaUtf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

function SignatariosModal({ T, form, setForm, busy, onCancel, onConfirm }: {
  T: any;
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const patch = (k: string, field: string, v: string) =>
    setForm((f: any) => ({ ...f, [k]: { ...f[k], [field]: v } }));

  type Row = { k: string; label: string; hint: string; extras?: boolean };
  const rows: Row[] = [
    { k: "contratante", label: "Contratante (Cliente)", hint: "Quem contrata a Parket — assina no anchor \\sign_contratante\\" },
    { k: "contratado",  label: "Contratado (Parket)",   hint: "Representante da Parket — assina no anchor \\sign_contratado\\" },
    { k: "testemunha1", label: "Testemunha 1 (Contratante)", hint: "Opcional · lado do cliente · pode pré-preencher RG/CPF ou deixar em branco pra testemunha preencher no DocuSign", extras: true },
    { k: "testemunha2", label: "Testemunha 2 (Contratada)",  hint: "Opcional · lado da Parket · pode pré-preencher RG/CPF ou deixar em branco pra testemunha preencher no DocuSign", extras: true },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: T.overlay,
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
      padding: 20,
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg, border: `1px solid ${T.borderHover}`, padding: 28,
        width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto",
        fontFamily: fonts.inter,
      }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 13, letterSpacing: "0.22em", color: T.textPrimary, textTransform: "uppercase", marginBottom: 6 }}>
          Confirmar signatários
        </div>
        <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
          Cada signatário recebe email do DocuSign · testemunhas são opcionais
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          {rows.map((r) => (
            <div key={r.k} style={{ padding: 14, background: T.statBg, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, color: T.textPrimary, marginBottom: 2, fontWeight: 600 }}>{r.label}</div>
              <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.06em", marginBottom: 10 }}>{r.hint}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  placeholder="Nome completo"
                  value={form[r.k].nome}
                  onChange={(e) => patch(r.k as string, "nome", e.target.value)}
                  style={{ background: T.inputBg, border: `1px solid ${T.border}`, color: T.textPrimary, padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: fonts.inter }}
                />
                <input
                  placeholder="E-mail"
                  value={form[r.k].email}
                  onChange={(e) => patch(r.k as string, "email", e.target.value)}
                  style={{ background: T.inputBg, border: `1px solid ${T.border}`, color: T.textPrimary, padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: fonts.inter }}
                />
                {r.extras && (
                  <>
                    <input
                      placeholder="RG (opcional)"
                      value={form[r.k].rg || ""}
                      onChange={(e) => patch(r.k as string, "rg", e.target.value)}
                      style={{ background: T.inputBg, border: `1px solid ${T.border}`, color: T.textPrimary, padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: fonts.inter }}
                    />
                    <input
                      placeholder="CPF (opcional)"
                      value={form[r.k].cpf || ""}
                      onChange={(e) => patch(r.k as string, "cpf", e.target.value)}
                      style={{ background: T.inputBg, border: `1px solid ${T.border}`, color: T.textPrimary, padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: fonts.inter }}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} disabled={busy}
            style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textSecondary, padding: "10px 18px", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer", fontFamily: fonts.inter }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{ background: busy ? T.textMuted : "#C9A26A", color: "#0a0a0a", border: "none", padding: "10px 20px", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 600, cursor: busy ? "wait" : "pointer", fontFamily: fonts.inter }}>
            {busy ? "enviando…" : "✓ Enviar pra assinatura"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ ITENS COMPRADOS — hierarquia N.M idêntica à proposta pública ═══════
function ItensComprados({ T, itens }: { T: any; itens: ItemHierarquico[] }) {
  if (!itens || itens.length === 0) return null;

  const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtM2  = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} m²`);

  // Agrupa por raiz N
  const raizes = new Map<string, ItemHierarquico[]>();
  for (const it of itens) {
    (raizes.get(it.raiz) || raizes.set(it.raiz, []).get(it.raiz)!).push(it);
  }
  const raizesOrdenadas = Array.from(raizes.entries()).sort(([a], [b]) => Number(a) - Number(b));
  const totalGeral = itens.reduce((s, it) => s + it.valor_total, 0);

  return (
    <>
      <SectionTitle T={T}>Itens comprados</SectionTitle>
      <div style={{
        background: T.cardBg, border: `1px solid ${T.border}`,
        padding: 20, marginBottom: 16,
      }}>
        <div style={{
          fontSize: 9, letterSpacing: "0.20em", color: T.textMuted,
          textTransform: "uppercase", marginBottom: 14,
        }}>
          {itens.length} entregas · {raizes.size} produto{raizes.size > 1 ? "s" : ""}
        </div>

        {raizesOrdenadas.map(([raiz, arr]) => {
          const primeiro = arr[0];
          const subtotal = arr.reduce((s, it) => s + it.valor_total, 0);
          return (
            <div key={raiz} style={{ marginBottom: 20 }}>
              {/* Header do produto pai (N) */}
              <div style={{
                display: "flex", alignItems: "baseline", gap: 10,
                paddingBottom: 8, borderBottom: `1px solid ${T.borderHover}`,
                marginBottom: 8,
              }}>
                <span style={{
                  fontFamily: fonts.cinzel, fontSize: 15, letterSpacing: "0.12em",
                  color: T.textPrimary, fontVariantNumeric: "tabular-nums" as any,
                }}>{raiz}</span>
                <span style={{ color: T.textMuted, fontSize: 12, letterSpacing: "0.14em" }}>·</span>
                <span style={{
                  fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em",
                  textTransform: "uppercase", color: T.accent,
                }}>{primeiro.categoria_raiz}</span>
                <span style={{ color: T.textMuted, fontSize: 12, letterSpacing: "0.14em" }}>·</span>
                <span style={{
                  fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.18em",
                  textTransform: "uppercase", color: T.textPrimary,
                }}>{primeiro.produto_header || "—"}</span>
                <div style={{ flex: 1 }} />
                <span style={{
                  fontSize: 11, color: T.textSecondary,
                  fontVariantNumeric: "tabular-nums" as any,
                }}>{fmtBRL(subtotal)}</span>
              </div>

              {/* Sub-itens (N.M) */}
              {arr.map((it) => (
                <div key={it.codigo} style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr 200px 120px",
                  gap: 12, alignItems: "center",
                  padding: "8px 12px", marginLeft: 16,
                  background: T.cardBg, border: `1px solid ${T.border}`,
                  borderLeft: `2px solid ${T.borderHover}`,
                  marginBottom: 2,
                }}>
                  <span style={{
                    fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.10em",
                    color: T.textSecondary, fontVariantNumeric: "tabular-nums" as any,
                  }}>{it.codigo}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.ambiente || it.descritivo}
                    </div>
                    {(it.metragem_real !== null || it.metragem_com_perda !== null) && (
                      <div style={{
                        fontSize: 8, letterSpacing: "0.14em", color: T.textMuted,
                        marginTop: 2, textTransform: "uppercase",
                      }}>
                        {it.metragem_real !== null && `real · ${fmtM2(it.metragem_real)}`}
                        {it.metragem_real !== null && it.metragem_com_perda !== null && " · "}
                        {it.metragem_com_perda !== null && `c/ perda · ${fmtM2(it.metragem_com_perda)}`}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 9, letterSpacing: "0.14em", color: T.textMuted,
                    textTransform: "uppercase", textAlign: "right",
                  }}>
                    {it.valor_insumos > 0 && <span>ins {fmtBRL(it.valor_insumos).replace("R$ ", "")} · </span>}
                    {it.valor_instalacao > 0 && <span>inst {fmtBRL(it.valor_instalacao).replace("R$ ", "")}</span>}
                  </div>
                  <div style={{
                    fontSize: 11, color: T.textPrimary, textAlign: "right",
                    fontVariantNumeric: "tabular-nums" as any,
                  }}>{fmtBRL(it.valor_total)}</div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Total geral */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          paddingTop: 10, borderTop: `1px solid ${T.borderHover}`,
        }}>
          <span style={{
            fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em",
            textTransform: "uppercase", color: T.textSecondary,
          }}>Total dos produtos</span>
          <span style={{
            fontFamily: fonts.cinzel, fontSize: 14, color: T.textPrimary,
            fontVariantNumeric: "tabular-nums" as any, letterSpacing: "0.06em",
          }}>{fmtBRL(totalGeral)}</span>
        </div>
      </div>
    </>
  );
}
