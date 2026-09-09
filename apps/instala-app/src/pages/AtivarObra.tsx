import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, MessageCircle, FileText } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";

/** ATIVACAO DE OBRA (F4, #1988; fluxo novo 01/09).
 *
 *  O QUE: gate + wizard de ativacao da obra. Ao abrir /obra/:cardId por
 *  QUALQUER caminho (Iniciar, Hoje, Agenda ou URL direta), se o prestador
 *  tem termo PENDENTE naquela obra, a gestao da obra nao renderiza: entra
 *  o wizard em tela cheia, etapa por etapa:
 *    01 Servicos da obra (paper, lista itens + metragem, confirmar)
 *    -> 02 Codigo WhatsApp (dark, OTP finalidade ativacao_obra)
 *    -> Obra ativada (success, PDF do anexo + entrar na obra).
 *
 *  POR QUE assim: pedido do Will 01/09, fluxo criado do ZERO ("nao vamos
 *  usar nada de regras e formato atual"): apertar no card da obra tem que
 *  confirmar primeiro os itens a executar e o codigo, e so depois liberar
 *  a gestao da obra. O gate mora na rota da obra pra nenhum ponto de
 *  entrada escapar. Visual = modelo /b (decisao registrada: DM Sans,
 *  ink #1a1a1a, paper #f8f8f7, dourado #D4A853), mesmo DNA etapa por
 *  etapa do wizard do contrato geral (ContratoGeral.tsx). */

const API_URL = "https://gestao.parket.works";

/** POST JSON no gestao API; erro vira Error com .status pra tratar 401/410/429. */
async function apiPost(path: string, body: any) {
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const e: any = new Error(typeof j?.detail === "string" ? j.detail : "Falha na operação. Tente de novo.");
    e.status = r.status;
    throw e;
  }
  return j;
}

// Linha do snapshot de itens gravado no termo (so servico + metragem, sem R$).
type ItemSnapshot = {
  codigo?: string;
  ambiente?: string;
  quantidade?: number | null;
  unidade?: string;
  descritivo?: string;
  categoria_raiz?: string;
  produto_header?: string;
};

type TermoObra = {
  id: string;
  card_id: string;
  itens: ItemSnapshot[];
  cliente: string | null;
  obra_code: string | null;
};

/** Termo PENDENTE deste prestador nesta obra (null = obra liberada).
 *  Vinculo canonico (Will 02/09): equipes_parket.prestador_id = prestador.id,
 *  mesma chave da vw_instala_minhas_obras e do /equipes do gestao (nada de
 *  casar por nome). Termo aceito/ativado nao gateia. */
async function fetchTermoPendenteDaObra(prestadorId: string, cardId: string): Promise<TermoObra | null> {
  const { data: equipes } = await sb.from("equipes_parket").select("id").eq("prestador_id", prestadorId);
  const equipeIds = (equipes || []).map((e: any) => e.id);
  if (equipeIds.length === 0) return null;
  const { data: termos } = await sb.from("prestador_termos")
    .select("id,card_id,itens_snapshot")
    .eq("card_id", cardId).in("equipe_id", equipeIds).eq("status", "pendente").limit(1);
  const t = (termos || [])[0] as any;
  if (!t) return null;
  const { data: cards } = await sb.from("kanban_cards").select("id,title,obra").eq("id", cardId).limit(1);
  const c = (cards || [])[0] as any;
  return {
    id: t.id, card_id: t.card_id,
    itens: Array.isArray(t.itens_snapshot) ? (t.itens_snapshot as ItemSnapshot[]) : [],
    cliente: c?.title || null, obra_code: c?.obra || null,
  };
}

// Quantidade no padrao pt-BR (1.234,56) pra lista de servicos.
function fmtQtd(q: number | null | undefined, unidade?: string): string {
  if (q === null || q === undefined) return "";
  return q.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (unidade || "m²");
}

/* ── CSS do modelo /b escopado com prefixo ao- ──
   Mesmo DNA do wizard do contrato (ContratoGeral.tsx): cores, fontes,
   espacamentos e breakpoint mobile 640px do parket-proposta-b. */
const CSS = `
.ao { font-family: 'DM Sans', Arial, Helvetica, sans-serif; font-weight: 300;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
.ao *, .ao *::before, .ao *::after { box-sizing: border-box; }
.ao button { font-family: inherit; cursor: pointer; }
.ao-page { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
           padding: 44px clamp(20px, 6vw, 96px) 48px; }
.ao-page > * { max-width: 860px; margin-left: auto; margin-right: auto; width: 100%; }
.ao-page--paper { background: #f8f8f7; color: #1a1a1a; }
.ao-page--dark  { background: #1a1a1a; color: #f8f8f7; }

.ao-header { display: flex; align-items: baseline; justify-content: space-between;
             padding-bottom: 22px; border-bottom: 1px solid rgba(26,26,26,0.10); margin-bottom: 44px; }
.ao-page--dark .ao-header { border-bottom-color: rgba(248,248,247,0.14); }
.ao-wordmark { font-weight: 700; font-size: 18px; letter-spacing: 0.34em; text-transform: uppercase; }
.ao-pagenum { font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #6a6a6a; }
.ao-page--dark .ao-pagenum { color: rgba(248,248,247,0.55); }

.ao-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase;
              color: #D4A853; display: inline-block; margin-bottom: 24px; }
.ao-title { font-weight: 600; font-size: clamp(28px, 4vw, 46px); line-height: 1.14;
            letter-spacing: -0.01em; margin: 0 0 20px; }
.ao-title em { font-style: normal; color: #D4A853; }
.ao-lead { font-weight: 300; font-size: 15px; line-height: 1.8; color: #6a6a6a;
           max-width: 680px; margin: 0 0 40px; }
.ao-page--dark .ao-lead { color: rgba(248,248,247,0.7); }

.ao-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 40px;
           border-top: 1px solid rgba(26,26,26,0.10); padding-top: 28px; margin: 0 0 8px; }
.ao-meta dt { font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
              color: #6a6a6a; margin-bottom: 6px; }
.ao-meta dd { font-size: 15px; font-weight: 400; margin: 0; }

.ao-h3 { font-weight: 700; font-size: 13px; letter-spacing: 0.16em; text-transform: uppercase;
         color: #1a1a1a; margin: 36px 0 14px; padding-bottom: 10px;
         border-bottom: 2px solid #D4A853; display: inline-block; align-self: flex-start; }

/* lista de servicos: linhas finas no padrao das tabelas do /b */
.ao-item { display: flex; gap: 14px; align-items: baseline; padding: 12px 0;
           border-bottom: 1px solid rgba(26,26,26,0.08); font-size: 14px; font-weight: 300; }
.ao-item-cod { flex-shrink: 0; min-width: 34px; font-size: 11px; font-weight: 600;
               letter-spacing: 0.08em; color: #6a6a6a; }
.ao-item-nome { flex: 1; min-width: 0; color: #3a3a3a; line-height: 1.5; }
.ao-item-nome small { color: #6a6a6a; }
.ao-item-qtd { flex-shrink: 0; font-weight: 400; font-variant-numeric: tabular-nums; color: #1a1a1a; }
.ao-total { display: flex; justify-content: space-between; align-items: baseline; padding: 16px 0 0; }
.ao-total dt { font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #6a6a6a; }
.ao-total dd { margin: 0; font-size: 18px; font-weight: 600; color: #D4A853; font-variant-numeric: tabular-nums; }

.ao-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px;
             padding-top: 32px; border-top: 1px solid rgba(26,26,26,0.10); margin-top: auto; }
.ao-page--dark .ao-footer { border-top-color: rgba(248,248,247,0.14); }

.ao-btn { font-weight: 600; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
          padding: 16px 30px; border-radius: 999px; display: inline-flex; align-items: center;
          justify-content: center; gap: 8px; transition: all 0.3s ease;
          background: #1a1a1a; color: #f8f8f7; border: 1px solid #1a1a1a; }
.ao-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ao-btn--gold { background: #D4A853; border-color: #D4A853; color: #1a1a1a; }
.ao-btn--cream { background: #f8f8f7; border-color: #f8f8f7; color: #1a1a1a; }
.ao-btn--outline { background: transparent; color: #f8f8f7; border-color: rgba(248,248,247,0.4); }
.ao-btn--link { background: transparent; border: none; padding: 12px 0; font-size: 11px;
                font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #6a6a6a; }
.ao-btn--linkcream { background: transparent; border: none; padding: 12px 0; font-size: 11px;
                     font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
                     color: rgba(248,248,247,0.55); }

.ao-bloco { margin-bottom: 44px; }
.ao-otp-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.ao-otp-input { width: 150px; font: inherit; font-size: 20px; font-weight: 500; letter-spacing: 0.4em;
                text-align: center; color: #f8f8f7; background: transparent; outline: none;
                border: none; border-bottom: 1px solid rgba(248,248,247,0.25); padding: 10px 0;
                border-radius: 0; transition: border-color 0.3s ease; }
.ao-otp-input:focus { border-bottom-color: #D4A853; }
.ao-ok { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: #D4A853; }
.ao-msg { font-size: 12px; line-height: 1.6; color: #D4A853; min-height: 18px; margin-top: 10px; }

/* pagina de sucesso (padrao success do /b) */
.ao-success { align-items: center; justify-content: center; text-align: center; }
.ao-success > * { max-width: 560px; }
.ao-mark { width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;
           color: #f8f8f7; background: #D4A853; border-radius: 50%; margin: 0 auto 22px; }

/* ── mobile: mesmo breakpoint do /b ── */
@media (max-width: 640px) {
  .ao-page { padding: 28px 20px 36px; }
  .ao-header { margin-bottom: 26px; padding-bottom: 14px; }
  .ao-wordmark { font-size: 15px; letter-spacing: 0.28em; }
  .ao-title { font-size: 26px; }
  .ao-lead { font-size: 13.5px; line-height: 1.7; margin-bottom: 26px; }
  .ao-meta { gap: 18px 16px; padding-top: 20px; }
  .ao-meta dd { font-size: 14px; }
  .ao-h3 { font-size: 12px; letter-spacing: 0.12em; margin-top: 28px; }
  .ao-item { font-size: 13px; gap: 10px; }
  .ao-footer { flex-direction: column-reverse; align-items: stretch; gap: 12px; padding-top: 24px; }
  .ao-footer .ao-btn, .ao-footer .ao-btn--link, .ao-footer .ao-btn--linkcream { width: 100%; text-align: center; justify-content: center; }
  .ao-btn { padding: 15px 18px; letter-spacing: 0.16em; }
  .ao-otp-row { gap: 10px; }
  .ao-otp-row .ao-btn { flex: 1; }
}
`;

/** Gate da rota /obra/:cardId: termo pendente = wizard; senao, a obra. */
export function AtivarObraGate({ children }: { children: React.ReactNode }) {
  const { cardId } = useParams();
  const { prestador } = useAuth();
  const [estado, setEstado] = useState<"checando" | "livre">("checando");
  const [termo, setTermo] = useState<TermoObra | null>(null);

  useEffect(() => {
    if (!prestador?.id || !cardId) return;
    let vivo = true;
    (async () => {
      try {
        const t = await fetchTermoPendenteDaObra(prestador.id, cardId);
        if (!vivo) return;
        if (t) setTermo(t);
        else setEstado("livre");
      } catch {
        // offline ou Cloud fora: app de campo nao pode travar por causa do gate
        if (vivo) setEstado("livre");
      }
    })();
    return () => { vivo = false; };
  }, [prestador?.id, cardId]);

  // ativada agora: solta o gate e deixa a obra renderizar
  if (termo && estado !== "livre") {
    return (
      <AtivarObraWizard
        termo={termo}
        prestadorId={prestador!.id}
        onAtivada={() => setEstado("livre")}
      />
    );
  }
  if (estado === "checando") {
    return (
      <div className="ao">
        <style>{CSS}</style>
        <section className="ao-page ao-page--paper ao-success">
          <p className="ao-lead" style={{ margin: 0 }}>Abrindo a obra...</p>
        </section>
      </div>
    );
  }
  return <>{children}</>;
}

/** Wizard de ativacao em tela cheia, etapa por etapa no DNA /b. */
function AtivarObraWizard({
  termo, prestadorId, onAtivada,
}: {
  termo: TermoObra; prestadorId: string; onAtivada: () => void;
}) {
  const nav = useNavigate();
  // servicos (paper) -> codigo (dark) -> pronto (success)
  const [pagina, setPagina] = useState<"servicos" | "codigo" | "pronto">("servicos");

  // Etapa do OTP: inicial = ainda sem envio; enviado = aguardando os 6 digitos
  const [otpEtapa, setOtpEtapa] = useState<"inicial" | "enviado">("inicial");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [telMask, setTelMask] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // DM Sans e a fonte do modelo /b; injeta o <link> uma vez (fallback Arial)
  useEffect(() => {
    if (document.getElementById("ao-dmsans")) return;
    const l = document.createElement("link");
    l.id = "ao-dmsans";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap";
    document.head.appendChild(l);
  }, []);

  // Cada troca de etapa comeca do topo (a lista de servicos e longa no mobile)
  useEffect(() => { window.scrollTo(0, 0); }, [pagina]);

  // Metragem total: soma so o que e medido em metro (m², m, m²/m)
  const totalM2 = termo.itens.reduce((acc, it) =>
    it.quantidade != null && (it.unidade || "m²").toLowerCase().startsWith("m")
      ? acc + Number(it.quantidade) : acc, 0);

  /* ── etapa Codigo: envia e valida o OTP (finalidade ativacao_obra) ── */
  async function enviarCodigo() {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const j = await apiPost("/api/instala/otp/enviar", {
        prestador_id: prestadorId, finalidade: "ativacao_obra", card_id: termo.card_id,
      });
      setOtpId(j.otp_id); setTelMask(j.telefone_mascarado || null);
      setCodigo(""); setOtpEtapa("enviado");
      setMsg("Código enviado pro seu WhatsApp. Digite os 6 dígitos.");
    } catch (e: any) {
      setMsg(e?.status === 429
        ? "Muitos envios. Aguarde alguns minutos e tente de novo."
        : e?.message ?? "Falha ao enviar o código.");
    } finally { setBusy(false); }
  }

  async function confirmarAtivacao() {
    if (busy || codigo.replace(/\D/g, "").length !== 6) return;
    setBusy(true); setMsg(null);
    try {
      // 1) valida o codigo (marca usado_em no backend)
      const v = await apiPost("/api/instala/otp/validar", {
        prestador_id: prestadorId, codigo: codigo.replace(/\D/g, ""),
        finalidade: "ativacao_obra", otp_id: otpId,
      });
      // 2) fecha a ativacao: anexo do contrato geral + PDF + termo aceito
      const a = await apiPost(`/api/instala/termos/${termo.id}/ativar`, {
        prestador_id: prestadorId, otp_id: v.otp_id,
      });
      setPdfUrl(a?.pdf_url || null);
      setPagina("pronto");
    } catch (e: any) {
      // 404/410/429 do OTP = precisa de envio novo; 401 = so errou a digitacao
      if (e?.status === 410 || e?.status === 404 || e?.status === 429) {
        setOtpEtapa("inicial"); setOtpId(null); setCodigo("");
        setMsg(e?.message ?? "Código expirado. Envie um novo.");
      } else {
        setMsg(e?.message ?? "Falha ao ativar a obra.");
      }
    } finally { setBusy(false); }
  }

  const tituloObra = termo.cliente || "Obra";

  return (
    <div className="ao">
      <style>{CSS}</style>

      {/* ── ETAPA 01: servicos da obra (paper, padrao cover do /b) ── */}
      {pagina === "servicos" && (
        <section className="ao-page ao-page--paper">
          <header className="ao-header">
            <span className="ao-wordmark">PARKET</span>
            <span className="ao-pagenum">Etapa 1 de 2</span>
          </header>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <p className="ao-eyebrow">01 &middot; Ativação de obra</p>
            <h1 className="ao-title">{tituloObra}</h1>
            <p className="ao-lead">
              Antes de entrar na obra, confirme os serviços que você assume aqui.
              Ao ativar, esta obra entra como anexo do seu contrato de prestação
              de serviços Parket.
            </p>
            <dl className="ao-meta" style={{ marginBottom: 12 }}>
              <div><dt>Obra</dt><dd>{termo.obra_code || tituloObra}</dd></div>
              <div><dt>Serviços</dt><dd>{termo.itens.length} {termo.itens.length === 1 ? "item" : "itens"}</dd></div>
              <div><dt>Vínculo</dt><dd>Anexo do contrato geral</dd></div>
              <div><dt>Confirmação</dt><dd>Código por WhatsApp</dd></div>
            </dl>

            <h3 className="ao-h3">Serviços desta obra</h3>
            {termo.itens.length === 0 ? (
              <p className="ao-lead" style={{ marginBottom: 0 }}>Nenhum item listado no termo.</p>
            ) : (
              <div>
                {termo.itens.map((it, i) => (
                  <div key={it.codigo || i} className="ao-item">
                    <span className="ao-item-cod">{it.codigo || ""}</span>
                    <span className="ao-item-nome">
                      {(it.produto_header || it.categoria_raiz || it.descritivo || "Serviço")}
                      {it.ambiente ? <small> &middot; {it.ambiente}</small> : null}
                    </span>
                    <span className="ao-item-qtd">{fmtQtd(it.quantidade, it.unidade)}</span>
                  </div>
                ))}
                {totalM2 > 0 && (
                  <dl className="ao-total">
                    <dt>Metragem total</dt>
                    <dd>{totalM2.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²</dd>
                  </dl>
                )}
              </div>
            )}
          </div>
          <footer className="ao-footer">
            <button className="ao-btn--link" onClick={() => nav(-1)}>&larr; Sair</button>
            <button className="ao-btn" onClick={() => setPagina("codigo")}>
              <Check size={15} /> Confirmo os serviços &rarr;
            </button>
          </footer>
        </section>
      )}

      {/* ── ETAPA 02: codigo WhatsApp (dark) ── */}
      {pagina === "codigo" && (
        <section className="ao-page ao-page--dark">
          <header className="ao-header">
            <span className="ao-wordmark">PARKET</span>
            <span className="ao-pagenum">Etapa 2 de 2</span>
          </header>
          <div style={{ flex: 1 }}>
            <p className="ao-eyebrow">02 &middot; Código de ativação</p>
            <h2 className="ao-title">Confirme com o <em>código</em>.</h2>
            <p className="ao-lead">
              Você recebe um código de 6 dígitos no seu WhatsApp. Ele registra a
              sua confirmação dos serviços de {tituloObra} no contrato.
            </p>
            <div className="ao-bloco">
              {otpEtapa === "enviado" && (
                <div className="ao-otp-row">
                  <input
                    className="ao-otp-input"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
                  />
                  <button className="ao-btn ao-btn--gold" onClick={confirmarAtivacao}
                          disabled={busy || codigo.length < 6}>
                    {busy ? "Ativando..." : "Ativar obra"}
                  </button>
                </div>
              )}
              <button className="ao-btn ao-btn--outline" onClick={enviarCodigo} disabled={busy}>
                <MessageCircle size={13} /> {otpEtapa === "enviado" ? "Reenviar código" : "Enviar código por WhatsApp"}
              </button>
              {telMask && otpEtapa === "enviado" && (
                <p className="ao-msg" style={{ color: "rgba(248,248,247,0.55)" }}>Enviado para {telMask}.</p>
              )}
              {msg && <p className="ao-msg">{msg}</p>}
            </div>
          </div>
          <footer className="ao-footer">
            <button className="ao-btn--linkcream" onClick={() => setPagina("servicos")}>&larr; Rever os serviços</button>
            <span />
          </footer>
        </section>
      )}

      {/* ── OBRA ATIVADA (padrao success do /b) ── */}
      {pagina === "pronto" && (
        <section className="ao-page ao-page--paper ao-success">
          <div>
            <div className="ao-mark"><Check size={30} /></div>
            <span className="ao-wordmark">PARKET</span>
            <h2 className="ao-title" style={{ marginTop: 18 }}>Obra <em>ativada</em>.</h2>
            <p className="ao-lead" style={{ marginBottom: 20 }}>
              {tituloObra} agora faz parte do seu contrato de prestação de serviços.
              O anexo com os serviços confirmados ficou registrado.
            </p>
            {pdfUrl && (
              <p style={{ marginBottom: 28 }}>
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="ao-ok" style={{ textDecoration: "none" }}>
                  <FileText size={15} /> VER ANEXO (PDF)
                </a>
              </p>
            )}
            <button className="ao-btn" onClick={onAtivada}>Entrar na obra</button>
          </div>
        </section>
      )}
    </div>
  );
}
