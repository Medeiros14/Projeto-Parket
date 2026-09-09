/**
 * Contrato — mini-app de Gestão de Contrato via DocuSign.
 *
 * Acessada como iframe a partir do Space (aba "Gestão de Contrato" do card
 * kanban do Financeiro). URL: /contrato/:cardId
 *
 * MVP: o user faz upload do PDF do contrato (gerado no Dashboard via
 * "Save as PDF"), define signatários (contratante, contratado, 2 testemunhas)
 * e clica em "Enviar para Assinatura". Backend cria envelope DocuSign,
 * todos os signatários recebem email simultaneamente.
 *
 * Status atualiza via polling do GET /api/docusign/by-card/:cardId (a cada 10s).
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabasePublic } from "../../lib/supabase";
import { Loader2, Upload, Send, FileText, Trash2, RefreshCw, CheckCircle2, XCircle, Clock, Link2, MessageCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_DOCUSIGN_API_BASE || "https://core.parket.works";

type Papel = "contratante" | "contratado" | "testemunha1" | "testemunha2";

interface Signatario {
  nome: string;
  email: string;
  papel: Papel;
  anchor: string;
}

interface SignerStatus {
  name?: string;
  email?: string;
  papel?: string;
  status?: string;         // created|sent|delivered|completed|declined|...
  signed_at?: string;
  delivered_at?: string;
  declined_at?: string;
  decline_reason?: string;
}

interface Contrato {
  id: string;
  card_id: string;
  envelope_id: string | null;
  status: string;
  titulo: string;
  signatarios: Signatario[];
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
  last_event?: {
    source?: string;
    envelope_status?: string;
    signers?: SignerStatus[];
  } | null;
}

/** Status DocuSign por signer (cor + label legível). */
const SIGNER_STATUS_INFO: Record<string, { label: string; color: string }> = {
  created: { label: "Não notificado", color: "#71717a" },
  sent: { label: "Email enviado", color: "#3b82f6" },
  delivered: { label: "Abriu o documento", color: "#06b6d4" },
  completed: { label: "Assinou ✓", color: "#10b981" },
  signed: { label: "Assinou ✓", color: "#10b981" },
  declined: { label: "Recusou", color: "#ef4444" },
  autoresponded: { label: "Auto-resposta", color: "#a78bfa" },
};

const PAPEIS: { id: Papel; label: string; anchor: string }[] = [
  { id: "contratante", label: "Contratante (Cliente)", anchor: "\\sign_contratante\\" },
  { id: "contratado", label: "Contratado (Parket)", anchor: "\\sign_contratado\\" },
  { id: "testemunha1", label: "Testemunha 1", anchor: "\\sign_witness1\\" },
  { id: "testemunha2", label: "Testemunha 2", anchor: "\\sign_witness2\\" },
];

const STATUS_INFO: Record<string, { label: string; color: string; icon: any }> = {
  rascunho: { label: "Rascunho", color: "#71717a", icon: FileText },
  enviado: { label: "Enviado — aguardando assinaturas", color: "#3b82f6", icon: Send },
  parcial: { label: "Assinaturas parciais", color: "#eab308", icon: Clock },
  assinado: { label: "Totalmente assinado ✓", color: "#10b981", icon: CheckCircle2 },
  recusado: { label: "Recusado por um signatário", color: "#ef4444", icon: XCircle },
  cancelado: { label: "Cancelado", color: "#a1a1aa", icon: XCircle },
  expirado: { label: "Expirado", color: "#dc2626", icon: XCircle },
  erro: { label: "Erro no envio", color: "#ef4444", icon: XCircle },
};

export function ContratoPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<any>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [signatarios, setSignatarios] = useState<Signatario[]>(
    PAPEIS.map((p) => ({ nome: "", email: "", papel: p.id, anchor: p.anchor })),
  );
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNovoForm, setShowNovoForm] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{ papel: string; nome: string; url: string } | null>(null);

  const ultimoContrato = contratos[0];

  // Busca dados do card + contratos existentes
  async function fetchAll() {
    if (!cardId) return;
    setError(null);
    try {
      // Card kanban com dados do cliente
      const { data: cardData, error: cardErr } = await supabasePublic
        .from("kanban_cards")
        .select("id, title, obra, dept_id, column_id, details")
        .eq("id", cardId)
        .maybeSingle();
      if (cardErr) throw cardErr;
      setCard(cardData);

      // Contratos existentes
      const r = await fetch(`${API_BASE}/api/docusign/by-card/${cardId}`);
      if (!r.ok) throw new Error(`API /by-card: HTTP ${r.status}`);
      const rows = (await r.json()) as Contrato[];
      setContratos(rows);

      // Pré-preenche signatários a partir do último contrato (se houver)
      // OU do details do card. Reusa signatários do anterior é prática
      // pra aditivos — geralmente os mesmos assinam.
      if (rows.length > 0 && rows[0].signatarios?.length) {
        // Garante que cada papel tem entrada (alguns contratos antigos
        // podem não ter todos os 4)
        const byPapel = new Map(rows[0].signatarios.map((s: Signatario) => [s.papel, s]));
        setSignatarios(PAPEIS.map((p) => byPapel.get(p.id) || {
          nome: "", email: "", papel: p.id, anchor: p.anchor,
        }));
      } else if (cardData?.details) {
        const d = cardData.details;
        setSignatarios((prev) =>
          prev.map((s) => {
            if (s.papel === "contratante") {
              return {
                ...s,
                nome: d.contato_principal || d.cliente || cardData.obra || "",
                email: d.email_comercial || d.email_pessoal || "",
              };
            }
            if (s.papel === "contratado") {
              return {
                ...s,
                nome: d.vendedor || "Parket",
                email: d.outro_email || d.vendedor_email || "",
              };
            }
            return s;
          }),
        );
      }
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // Polling — atualiza status a cada 15s se houver QUALQUER envelope
    // pendente nos documentos (contrato principal ou aditivos).
    const id = setInterval(() => {
      const algumPendente = contratos.some(c => ["enviado", "parcial"].includes(c.status));
      if (algumPendente) fetchAll();
    }, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, contratos.length, contratos.map(c => c.status).join(",")]);

  function updateSign(i: number, patch: Partial<Signatario>) {
    setSignatarios((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function refreshStatus(c: Contrato) {
    if (!c.envelope_id) return;
    setRefreshingId(c.id);
    setError(null);
    try {
      const r = await fetch(
        `${API_BASE}/api/docusign/envelopes/${c.envelope_id}/refresh`,
        { method: "POST" },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      await fetchAll();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setRefreshingId(null);
    }
  }

  /** Gera URLs de assinatura pra todos os signers pendentes + envia mensagem
   * formatada no grupo 💰 Parket - Financeiro. Útil pra teste e quando o
   * email não chega. */
  async function gerarLinksWhatsapp(c: Contrato) {
    if (!c.envelope_id) return;
    if (!confirm(
      `Vai gerar links de assinatura pros signatários pendentes de "${c.titulo}" e enviar pelo grupo Financeiro do WhatsApp. Confirma?`,
    )) return;
    setError(null);
    try {
      const r = await fetch(
        `${API_BASE}/api/docusign/envelopes/${c.envelope_id}/send-links-whatsapp`,
        { method: "POST" },
      );
      const data = await r.json();
      if (!r.ok || !data.ok) {
        throw new Error(data.reason || `HTTP ${r.status}`);
      }
      alert(`✓ ${data.count || 0} link(s) enviado(s) no grupo Financeiro do WhatsApp.`);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  /** Gera link individual de um signer. Tenta clipboard; se bloqueado
   * (iframe sem permissão de Clipboard API), abre modal com o link
   * pro user copiar manualmente. */
  async function copiarLinkSigner(envelope_id: string, recipient_id: string, papel: string, nome: string = "") {
    setError(null);
    try {
      const r = await fetch(
        `${API_BASE}/api/docusign/envelopes/${envelope_id}/signing-url/${recipient_id}`,
        { method: "POST" },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);

      // Tenta Clipboard API (rápido). Se bloqueada (iframe policy),
      // mostra modal pro user copiar manual.
      try {
        await navigator.clipboard.writeText(data.url);
        alert(`✓ Link de ${papel} copiado!\n\nLink expira em ~5 min. Cole no WhatsApp do cliente agora.`);
      } catch {
        setLinkModal({ papel, nome, url: data.url });
      }
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function cancelarContrato(c: Contrato) {
    if (!c.envelope_id) return;
    const motivo = prompt(
      `Motivo do cancelamento de "${c.titulo}" (será enviado pros signatários):`,
      "Contrato cancelado pelo Financeiro",
    );
    if (!motivo) return;
    setCancelingId(c.id);
    setError(null);
    try {
      const r = await fetch(
        `${API_BASE}/api/docusign/envelopes/${c.envelope_id}/cancel?reason=${encodeURIComponent(motivo)}`,
        { method: "POST" },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      await fetchAll();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setCancelingId(null);
    }
  }

  async function enviarAssinatura() {
    if (!cardId || !pdfFile) {
      setError("Selecione o PDF do contrato antes de enviar.");
      return;
    }
    const incompletos = signatarios.filter((s) => !s.nome.trim() || !s.email.trim());
    if (incompletos.length > 0) {
      setError(`Preencha nome e email de todos os signatários (${incompletos.length} faltando).`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      // PDF → base64 direto. As âncoras (\sign_contratante\, etc) já vêm
      // embarcadas no PDF pelo gerador do orçamento no Dashboard
      // (propostaGenerator.ts), com CSS color:transparent. Não injeta
      // aqui pra evitar duplicação de âncoras (DocuSign criaria 2 caixas
      // pro mesmo papel).
      const rawBuf = await pdfFile.arrayBuffer();
      const u8 = new Uint8Array(rawBuf);
      let bin = "";
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      const pdfB64 = btoa(bin);

      const tituloFinal = novoTitulo.trim() || null;
      const r = await fetch(`${API_BASE}/api/docusign/envelopes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: cardId,
          pdf_base64: pdfB64,
          pdf_filename: pdfFile.name,
          email_subject: `${tituloFinal || "Contrato Parket"} — ${card?.obra || card?.title || cardId}`,
          email_blurb: `Por favor, revise e assine o documento "${tituloFinal || "Contrato"}". Esta é uma transação segura via DocuSign.`,
          signatarios,
          titulo: tituloFinal,
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`HTTP ${r.status}: ${txt.slice(0, 300)}`);
      }
      await fetchAll();
      setPdfFile(null);
      setNovoTitulo("");
      setShowNovoForm(false);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#a1a1aa" }}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  // O form de novo envio aparece quando:
  //  - usuário clicou em "+ Novo documento" explicitamente (showNovoForm), OU
  //  - é o PRIMEIRO contrato do card (não há nenhum)
  const podeAbrirForm = contratos.length === 0 || showNovoForm;
  const proximoTituloSugerido = contratos.length === 0
    ? "Contrato Principal"
    : `Aditivo ${contratos.length}`;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e4e4e7", padding: 16, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Gestão de Contrato — DocuSign</h1>
          {card && (
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
              {card.obra || card.title || "Card sem identificação"} · {card.dept_id}/{card.column_id}
            </div>
          )}
        </div>
        <button
          onClick={fetchAll}
          style={{ padding: "6px 10px", borderRadius: 6, background: "#27272a", border: "1px solid #3f3f46", color: "#a1a1aa", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
        >
          <RefreshCw size={11} /> Atualizar
        </button>
      </div>

      {/* ═══ Lista de documentos ═══ */}
      {contratos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              📄 Documentos ({contratos.length})
            </div>
            <button
              onClick={() => setShowNovoForm(s => !s)}
              style={{
                padding: "6px 12px", borderRadius: 6,
                background: showNovoForm ? "#27272a" : "#eab308",
                color: showNovoForm ? "#a1a1aa" : "#0a0a0a",
                border: "none", fontSize: 11, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {showNovoForm ? "× Cancelar novo" : `+ Novo (${proximoTituloSugerido})`}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {contratos.map((c) => {
              const cInfo = STATUS_INFO[c.status] || STATUS_INFO.rascunho;
              const CIcon = cInfo.icon;
              const isExpanded = expandedId === c.id;
              const ativo = ["enviado", "parcial"].includes(c.status);

              return (
                <div key={c.id} style={{
                  borderRadius: 8, background: "#18181b",
                  border: `1px solid ${cInfo.color}40`,
                  overflow: "hidden",
                }}>
                  {/* Header (clicável pra expandir) */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                  >
                    <CIcon size={18} style={{ color: cInfo.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e4e4e7" }}>
                        {c.titulo || "Documento"}
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: cInfo.color }}>
                          · {cInfo.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: "#71717a", marginTop: 2 }}>
                        {c.envelope_id && `Envelope ${c.envelope_id.slice(0, 8)}… · `}
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                        {c.completed_at && ` · Concluído ${new Date(c.completed_at).toLocaleString("pt-BR")}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, color: "#52525b" }}>{isExpanded ? "−" : "+"}</div>
                  </div>

                  {/* Conteúdo expandido */}
                  {isExpanded && (
                    <div style={{ padding: "0 12px 12px", borderTop: "1px solid #27272a" }}>
                      {/* Ações */}
                      {ativo && c.envelope_id && (
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                          <button
                            onClick={() => refreshStatus(c)}
                            disabled={refreshingId === c.id}
                            style={{
                              padding: "5px 10px", borderRadius: 6, background: "#3b82f6", color: "#fff",
                              border: "none", fontSize: 10, fontWeight: 600,
                              cursor: refreshingId === c.id ? "not-allowed" : "pointer",
                              opacity: refreshingId === c.id ? 0.5 : 1,
                              display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            {refreshingId === c.id ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                            Atualizar status
                          </button>
                          <button
                            onClick={() => gerarLinksWhatsapp(c)}
                            title="Gera links de assinatura e envia no grupo Financeiro do WhatsApp"
                            style={{
                              padding: "5px 10px", borderRadius: 6, background: "#25D366", color: "#fff",
                              border: "none", fontSize: 10, fontWeight: 600,
                              cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            <MessageCircle size={10} />
                            Enviar links no WhatsApp
                          </button>
                          <button
                            onClick={() => cancelarContrato(c)}
                            disabled={cancelingId === c.id}
                            style={{
                              padding: "5px 10px", borderRadius: 6, background: "#dc2626", color: "#fff",
                              border: "none", fontSize: 10, fontWeight: 600,
                              cursor: cancelingId === c.id ? "not-allowed" : "pointer",
                              opacity: cancelingId === c.id ? 0.5 : 1,
                              display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            {cancelingId === c.id ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                            Cancelar
                          </button>
                        </div>
                      )}

                      {/* Status por signer */}
                      {c.last_event?.signers && c.last_event.signers.length > 0 ? (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 9, color: "#71717a", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            Status por signatário
                          </div>
                          {c.last_event.signers.map((s, i) => {
                            const sStatus = (s.status || "").toLowerCase();
                            const sInfo = SIGNER_STATUS_INFO[sStatus] || { label: s.status || "?", color: "#a1a1aa" };
                            const podeGerarLink = !["completed", "signed", "declined"].includes(sStatus);
                            // Pra gerar link individual precisamos do recipientId — vem do refresh
                            const rId = (s as any).recipient_id || String(i + 1);
                            return (
                              <div key={i} style={{ padding: "6px 8px", borderRadius: 4, background: "#0a0a0a", display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginBottom: 3, flexWrap: "wrap" }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: sInfo.color }} />
                                <span style={{ fontWeight: 600, minWidth: 90, color: "#a1a1aa", fontSize: 9, textTransform: "uppercase" }}>{s.papel}</span>
                                <span style={{ flex: 1, minWidth: 200 }}>{s.name} <span style={{ color: "#52525b" }}>· {s.email}</span></span>
                                <span style={{ color: sInfo.color, fontWeight: 600, fontSize: 10 }}>{sInfo.label}</span>
                                {s.signed_at && <span style={{ color: "#71717a", fontSize: 9 }}>{new Date(s.signed_at).toLocaleString("pt-BR")}</span>}
                                {podeGerarLink && c.envelope_id && (
                                  <button
                                    onClick={() => copiarLinkSigner(c.envelope_id!, rId, s.papel || "")}
                                    title="Gera link de assinatura e copia pro clipboard"
                                    style={{
                                      padding: "3px 7px", borderRadius: 4, background: "#27272a",
                                      border: "1px solid #3f3f46", color: "#a1a1aa",
                                      fontSize: 9, fontWeight: 600, cursor: "pointer",
                                      display: "inline-flex", alignItems: "center", gap: 3,
                                    }}
                                  >
                                    <Link2 size={9} /> Copiar link
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 9, color: "#71717a", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            Signatários
                          </div>
                          {c.signatarios?.map((s, i) => (
                            <div key={i} style={{ padding: "5px 8px", borderRadius: 4, background: "#0a0a0a", fontSize: 11, marginBottom: 3 }}>
                              <span style={{ color: "#a1a1aa", fontSize: 9, textTransform: "uppercase", marginRight: 8 }}>{s.papel}</span>
                              {s.nome} <span style={{ color: "#52525b" }}>· {s.email}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {c.notes && (
                        <div style={{ marginTop: 8, fontSize: 10, color: "#fca5a5", padding: 6, background: "#7f1d1d20", borderRadius: 4 }}>
                          {c.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{ padding: 10, borderRadius: 6, background: "#7f1d1d40", border: "1px solid #dc2626", color: "#fca5a5", marginBottom: 16, fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}

      {podeAbrirForm && (
        <>
          <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 700, color: "#eab308", padding: 10, background: "#3b2408", borderRadius: 6, border: "1px solid #92400e" }}>
            📤 {contratos.length === 0 ? "Enviar Contrato Principal" : `Enviar novo documento (${proximoTituloSugerido})`}
          </div>

          {/* Título do documento */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
              Título do documento (opcional)
            </label>
            <input
              type="text"
              placeholder={proximoTituloSugerido}
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              style={{ width: "100%", padding: "6px 10px", borderRadius: 4, background: "#0a0a0a", border: "1px solid #27272a", color: "#e4e4e7", fontSize: 12, boxSizing: "border-box" }}
            />
            <div style={{ fontSize: 9, color: "#52525b", marginTop: 2 }}>
              Ex: "Aditivo de Prazo", "Termo de Garantia". Se vazio, usa "{proximoTituloSugerido}".
            </div>
          </div>

          {/* Upload do PDF */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
              1. PDF do contrato
            </label>
            <div style={{ padding: 12, borderRadius: 8, background: "#18181b", border: "1px dashed #3f3f46" }}>
              {pdfFile ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={16} style={{ color: "#10b981" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12 }}>{pdfFile.name}</div>
                    <div style={{ fontSize: 10, color: "#71717a" }}>{(pdfFile.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button onClick={() => setPdfFile(null)} style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#a1a1aa", fontSize: 12 }}>
                  <Upload size={16} />
                  Clique pra selecionar o PDF do contrato (gerado no Dashboard via "Save as PDF")
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    style={{ display: "none" }}
                  />
                </label>
              )}
            </div>
            <div style={{ fontSize: 10, color: "#71717a", marginTop: 4 }}>
              ⚠ O PDF precisa conter as âncoras invisíveis: <code>\sign_contratante\</code>, <code>\sign_contratado\</code>,
              {" "}<code>\sign_witness1\</code>, <code>\sign_witness2\</code>. Sem elas, o DocuSign não saberá onde colocar as assinaturas.
            </div>
          </div>

          {/* Signatários */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
              2. Signatários (todos assinam paralelo)
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {signatarios.map((s, i) => {
                const papelLabel = PAPEIS.find((p) => p.id === s.papel)?.label || s.papel;
                return (
                  <div key={i} style={{ padding: 10, borderRadius: 6, background: "#18181b", border: "1px solid #27272a" }}>
                    <div style={{ fontSize: 10, color: "#71717a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{papelLabel}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Nome completo"
                        value={s.nome}
                        onChange={(e) => updateSign(i, { nome: e.target.value })}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 4, background: "#0a0a0a", border: "1px solid #27272a", color: "#e4e4e7", fontSize: 12 }}
                      />
                      <input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={s.email}
                        onChange={(e) => updateSign(i, { email: e.target.value })}
                        style={{ flex: 1.2, padding: "6px 10px", borderRadius: 4, background: "#0a0a0a", border: "1px solid #27272a", color: "#e4e4e7", fontSize: 12 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botão Enviar */}
          <button
            onClick={enviarAssinatura}
            disabled={!pdfFile || sending}
            style={{
              width: "100%", padding: "10px 16px", borderRadius: 8,
              background: !pdfFile || sending ? "#3f3f46" : "#eab308",
              color: !pdfFile || sending ? "#71717a" : "#0a0a0a",
              border: "none", fontWeight: 700, fontSize: 13,
              cursor: !pdfFile || sending ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Enviando…" : "Enviar para Assinatura"}
          </button>
        </>
      )}

      {/* Modal fallback de copiar link (quando Clipboard API tá bloqueada) */}
      {linkModal && (
        <div
          onClick={() => setLinkModal(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0a0a0a", border: "1px solid #3f3f46",
              borderRadius: 8, padding: 20, maxWidth: 600, width: "100%",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Link de assinatura — {linkModal.papel} {linkModal.nome && `(${linkModal.nome})`}
            </div>
            <div style={{ fontSize: 10, color: "#a1a1aa", marginBottom: 10 }}>
              Cliente bloqueou copiar automático. <b>Selecione tudo abaixo</b> (Ctrl+A) e copie (Ctrl+C):
            </div>
            <textarea
              autoFocus
              readOnly
              value={linkModal.url}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: "100%", minHeight: 100, padding: 10,
                background: "#18181b", border: "1px solid #3f3f46",
                color: "#10b981", fontSize: 10, fontFamily: "monospace",
                borderRadius: 4, resize: "vertical", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 9, color: "#71717a", marginTop: 6 }}>
              ⚠️ Link expira em ~5 min. Cola direto no WhatsApp do cliente agora.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, gap: 8 }}>
              <button
                onClick={() => {
                  // Tenta abrir WhatsApp Web diretamente
                  const msg = encodeURIComponent(`Olá, segue o link pra você assinar o contrato:\n\n${linkModal.url}\n\n(link expira em ~5 min)`);
                  window.open(`https://wa.me/?text=${msg}`, "_blank");
                }}
                style={{
                  padding: "6px 12px", borderRadius: 4, background: "#25D366",
                  color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}
              >
                Abrir WhatsApp Web
              </button>
              <button
                onClick={() => setLinkModal(null)}
                style={{
                  padding: "6px 12px", borderRadius: 4, background: "#27272a",
                  color: "#a1a1aa", border: "1px solid #3f3f46",
                  fontSize: 11, cursor: "pointer",
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
