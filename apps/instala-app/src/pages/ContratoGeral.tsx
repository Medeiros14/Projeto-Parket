import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, RotateCcw, Check, MessageCircle, FileText } from "lucide-react";
import { useAuth } from "../lib/auth";

/** CONTRATO GERAL de prestacao de servicos (F3, #1987; fluxo etapa por etapa 01/09).
 *
 *  O QUE: wizard do primeiro login do Instala em paginas sequenciais, uma etapa
 *  por tela (pedido do Will 01/09, "igual o do termos indo etapa por etapa"):
 *    capa -> 01 termos (leitura + aceite) -> 02 seus dados (DAS PARTES)
 *    -> 03 WhatsApp (OTP) -> 04 selfie -> 05 assinatura (canvas) -> sucesso.
 *  Os placeholders {{PRESTADOR_*}} do texto refletem ao vivo o que o prestador
 *  digita na etapa Seus dados.
 *
 *  POR QUE assim: modelo visual = renderer do proposta.parket.works/b
 *  (DM Sans, ink #1a1a1a, dourado #D4A853, paper #f8f8f7, eyebrows, paginas
 *  com header/footer) e 100% responsivo no mobile. O CSS vive num <style>
 *  proprio com media queries (inline style nao faz breakpoint) e nada aqui
 *  usa o tema padrao do app. Ordem das etapas fixada pelo Will: aceite,
 *  depois confirmar o WhatsApp, depois a foto, por ultimo a assinatura.
 *  Mudou a versao dos termos no catalogo, o ContratoGate manda de volta pra
 *  ca (re-aceite) sem deploy novo. */

const API_URL = "https://gestao.parket.works";

const PLACEHOLDER_RE = /(\{\{PRESTADOR_(?:NOME|CPF_CNPJ|ENDERECO)\}\})/g;
const BOLD_RE = /(\*\*[^*]+\*\*)/g;

type Vigente = {
  versao: number;
  titulo: string;
  conteudo_md: string;
  aceite: { id: string; status: string; versao_termos: number; aceito_em: string | null; pdf_url: string | null } | null;
  precisa_aceite: boolean;
};

// Etapas do wizard, na ordem que o Will definiu (aceite -> whatsapp -> foto -> assinatura)
type Pagina = "capa" | "termos" | "dados" | "whatsapp" | "selfie" | "assinatura";

/** POST JSON pro gestao API; erro vira Error com o detail do FastAPI. */
async function apiPost(path: string, body: any) {
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(j?.detail || `Erro ${r.status}`), { status: r.status });
  return j;
}

/** Quebra o markdown do catalogo em blocos renderizaveis.
 *  "## " abre clausula (titulo), linhas "- " consecutivas viram uma lista,
 *  o resto e paragrafo. Mantem a ordem do texto original. */
function mdBlocos(md: string) {
  const blocos: Array<{ tipo: "h2" | "p"; texto: string } | { tipo: "ul"; itens: string[] }> = [];
  for (const linha of md.split("\n")) {
    const raw = linha.trim();
    if (!raw) continue;
    if (raw.startsWith("## ")) blocos.push({ tipo: "h2", texto: raw.slice(3) });
    else if (raw.startsWith("- ")) {
      const ultimo = blocos[blocos.length - 1];
      // agrupa bullets consecutivos num <ul> so (senao cada item vira lista propria)
      if (ultimo && ultimo.tipo === "ul") ultimo.itens.push(raw.slice(2));
      else blocos.push({ tipo: "ul", itens: [raw.slice(2)] });
    } else blocos.push({ tipo: "p", texto: raw });
  }
  return blocos;
}

/* ── CSS do modelo /b (proposta.parket.works) escopado com prefixo cg- ──
   Copiado/adaptado do styles.css do parket-proposta-b: mesmas cores, fontes,
   espacamentos e o mesmo breakpoint mobile de 640px. */
const CSS = `
.cg { font-family: 'DM Sans', Arial, Helvetica, sans-serif; font-weight: 300;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
.cg *, .cg *::before, .cg *::after { box-sizing: border-box; }
.cg button { font-family: inherit; cursor: pointer; }
.cg-page { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
           padding: 44px clamp(20px, 6vw, 96px) 48px; }
.cg-page > * { max-width: 860px; margin-left: auto; margin-right: auto; width: 100%; }
.cg-page--paper { background: #f8f8f7; color: #1a1a1a; }
.cg-page--dark  { background: #1a1a1a; color: #f8f8f7; }

.cg-header { display: flex; align-items: baseline; justify-content: space-between;
             padding-bottom: 22px; border-bottom: 1px solid rgba(26,26,26,0.10); margin-bottom: 44px; }
.cg-page--dark .cg-header { border-bottom-color: rgba(248,248,247,0.14); }
.cg-wordmark { font-weight: 700; font-size: 18px; letter-spacing: 0.34em; text-transform: uppercase; }
.cg-pagenum { font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #6a6a6a; }
.cg-page--dark .cg-pagenum { color: rgba(248,248,247,0.55); }

.cg-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase;
              color: #D4A853; display: inline-block; margin-bottom: 24px; }
.cg-title { font-weight: 600; font-size: clamp(28px, 4vw, 46px); line-height: 1.14;
            letter-spacing: -0.01em; margin: 0 0 20px; }
.cg-title em { font-style: normal; color: #D4A853; }
.cg-lead { font-weight: 300; font-size: 15px; line-height: 1.8; color: #6a6a6a;
           max-width: 680px; margin: 0 0 40px; }
.cg-page--dark .cg-lead { color: rgba(248,248,247,0.7); }

.cg-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 40px;
           border-top: 1px solid rgba(26,26,26,0.10); padding-top: 28px; margin: 0 0 8px; }
.cg-meta dt { font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
              color: #6a6a6a; margin-bottom: 6px; }
.cg-meta dd { font-size: 15px; font-weight: 400; margin: 0; }

.cg-h3 { font-weight: 700; font-size: 13px; letter-spacing: 0.16em; text-transform: uppercase;
         color: #1a1a1a; margin: 36px 0 14px; padding-bottom: 10px;
         border-bottom: 2px solid #D4A853; display: inline-block; align-self: flex-start; }
.cg-p { font-size: 14px; font-weight: 300; line-height: 1.8; color: #3a3a3a; margin: 0 0 12px; }
.cg-ul { list-style: none; font-size: 14px; font-weight: 300; line-height: 1.8; color: #3a3a3a;
         margin: 0 0 12px; padding: 0; }
.cg-ul li { position: relative; padding-left: 22px; margin-bottom: 6px; }
.cg-ul li::before { content: ''; position: absolute; left: 0; top: 13px; width: 12px; height: 2px; background: #D4A853; }

/* placeholder DAS PARTES dentro do texto: reflete a etapa Seus dados */
.cg-fill { border-bottom: 1px solid #D4A853; padding: 0 2px; font-weight: 500; }
.cg-fill--empty { color: #b08a3e; font-size: 12px; letter-spacing: 0.08em; }

.cg-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px;
             padding-top: 32px; border-top: 1px solid rgba(26,26,26,0.10); margin-top: auto; }
.cg-page--dark .cg-footer { border-top-color: rgba(248,248,247,0.14); }

.cg-btn { font-weight: 600; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
          padding: 16px 30px; border-radius: 999px; display: inline-flex; align-items: center;
          justify-content: center; gap: 8px; transition: all 0.3s ease;
          background: #1a1a1a; color: #f8f8f7; border: 1px solid #1a1a1a; }
.cg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cg-btn--ghost { background: transparent; color: #1a1a1a; }
.cg-btn--gold { background: #D4A853; border-color: #D4A853; color: #1a1a1a; }
.cg-btn--cream { background: #f8f8f7; border-color: #f8f8f7; color: #1a1a1a; }
.cg-btn--link { background: transparent; border: none; padding: 12px 0; font-size: 11px;
                font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #6a6a6a; }
.cg-btn--linkcream { background: transparent; border: none; padding: 12px 0; font-size: 11px;
                     font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
                     color: rgba(248,248,247,0.55); }

/* blocos das etapas escuras (padrao close do /b) */
.cg-bloco { margin-bottom: 44px; }
.cg-bloco-title { font-weight: 700; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase;
                  color: #f8f8f7; margin: 0 0 18px; padding-bottom: 10px;
                  border-bottom: 2px solid #D4A853; display: inline-block; }
.cg-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.cg-field label { font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
                  color: rgba(248,248,247,0.55); }
.cg-field input { font: inherit; font-size: 15px; font-weight: 400; color: #f8f8f7;
                  background: transparent; border: none; outline: none; border-radius: 0;
                  border-bottom: 1px solid rgba(248,248,247,0.25); padding: 10px 0;
                  transition: border-color 0.3s ease; }
.cg-field input:focus { border-bottom-color: #D4A853; }

.cg-otp-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.cg-otp-input { width: 150px; font: inherit; font-size: 20px; font-weight: 500; letter-spacing: 0.4em;
                text-align: center; color: #f8f8f7; background: transparent; outline: none;
                border: none; border-bottom: 1px solid rgba(248,248,247,0.25); padding: 10px 0;
                border-radius: 0; transition: border-color 0.3s ease; }
.cg-otp-input:focus { border-bottom-color: #D4A853; }

.cg-selfie-label { display: flex; align-items: center; justify-content: center; gap: 10px;
                   padding: 24px 12px; border: 1px dashed rgba(248,248,247,0.4); cursor: pointer;
                   font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase;
                   color: rgba(248,248,247,0.8); transition: border-color 0.3s ease; }
.cg-selfie-label:hover { border-color: #D4A853; }
.cg-selfie-img { max-width: 100%; max-height: 300px; border: 1px solid rgba(248,248,247,0.3); display: block; margin: 0 auto; }

.cg-canvasbox { background: #fff; border: 1px solid rgba(248,248,247,0.3); width: 100%;
                max-width: 440px; height: 130px; margin: 0 auto; touch-action: none; }
.cg-sigline { border-top: 1px solid rgba(248,248,247,0.3); max-width: 320px; margin: 14px auto 0;
              padding-top: 8px; text-align: center; font-size: 10px; font-weight: 600;
              letter-spacing: 0.2em; text-transform: uppercase; color: rgba(248,248,247,0.7); }

.cg-ok { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: #D4A853; }
.cg-msg { font-size: 12px; line-height: 1.6; color: #D4A853; min-height: 18px; margin-top: 10px; }
.cg-mini { background: transparent; border: none; color: rgba(248,248,247,0.55); font-size: 10px;
           font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase;
           display: inline-flex; align-items: center; gap: 5px; padding: 8px 0; }
.cg-mini:hover { color: #f8f8f7; }

/* pagina de sucesso (padrao success do /b) */
.cg-success { align-items: center; justify-content: center; text-align: center; }
.cg-success > * { max-width: 560px; }
.cg-mark { width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;
           color: #f8f8f7; background: #D4A853; border-radius: 50%; margin: 0 auto 22px; }

/* ── mobile: mesmo breakpoint do /b ── */
@media (max-width: 640px) {
  .cg-page { padding: 28px 20px 36px; }
  .cg-header { margin-bottom: 26px; padding-bottom: 14px; }
  .cg-wordmark { font-size: 15px; letter-spacing: 0.28em; }
  .cg-title { font-size: 26px; }
  .cg-lead { font-size: 13.5px; line-height: 1.7; margin-bottom: 26px; }
  .cg-meta { grid-template-columns: 1fr 1fr; gap: 18px 16px; padding-top: 20px; }
  .cg-meta dd { font-size: 14px; }
  .cg-h3 { font-size: 12px; letter-spacing: 0.12em; margin-top: 28px; }
  .cg-p, .cg-ul { font-size: 13px; line-height: 1.7; }
  .cg-footer { flex-direction: column-reverse; align-items: stretch; gap: 12px; padding-top: 24px; }
  .cg-footer .cg-btn, .cg-footer .cg-btn--link, .cg-footer .cg-btn--linkcream { width: 100%; text-align: center; justify-content: center; }
  .cg-btn { padding: 15px 18px; letter-spacing: 0.16em; }
  .cg-bloco { margin-bottom: 34px; }
  .cg-otp-row { gap: 10px; }
  .cg-otp-row .cg-btn { flex: 1; }
}
`;

export function ContratoGeral() {
  const { prestador } = useAuth();
  const nav = useNavigate();

  const [vigente, setVigente] = useState<Vigente | null>(null);
  const [carregaErro, setCarregaErro] = useState<string | null>(null);

  // Etapa atual do wizard (uma tela por etapa, modelo do fluxo de termos do /b)
  const [pagina, setPagina] = useState<Pagina>("capa");

  // DAS PARTES: snapshot preenchido pelo prestador (vai no dados_prestador do aceite)
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");

  // Etapa WhatsApp: inicial -> enviado (aguardando codigo) -> validado (otpId pronto)
  // O numero e editavel: o que o prestador digitar vai no otp/enviar e o
  // backend ATUALIZA prestadores.telefone (mesma fonte do /equipes do gestao)
  const [whatsapp, setWhatsapp] = useState("");
  const [otpEtapa, setOtpEtapa] = useState<"inicial" | "enviado" | "validado">("inicial");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [telefoneMascarado, setTelefoneMascarado] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [otpMsg, setOtpMsg] = useState<string | null>(null);
  const [otpOcupado, setOtpOcupado] = useState(false);

  const [selfie, setSelfie] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  // canvas da assinatura manuscrita (mesmo esquema do AceitarTermo)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const desenhandoRef = useRef(false);
  const [temAssinatura, setTemAssinatura] = useState(false);

  // DM Sans e a fonte do modelo /b; injeta o <link> uma vez (fallback Arial se offline)
  useEffect(() => {
    if (document.getElementById("cg-dmsans")) return;
    const l = document.createElement("link");
    l.id = "cg-dmsans";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap";
    document.head.appendChild(l);
  }, []);

  // Carrega os termos vigentes + status do aceite deste prestador
  useEffect(() => {
    if (!prestador) return;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/instala/contrato/vigente?prestador_id=${prestador.id}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.detail || `Erro ${r.status}`);
        setVigente(j);
        setNome(prestador.nome || "");
        setWhatsapp(prestador.telefone || "");
        if (j.aceite?.pdf_url) setPdfUrl(j.aceite.pdf_url);
      } catch (e: any) {
        setCarregaErro(String(e?.message || e));
      }
    })();
  }, [prestador?.id]);

  // Cada troca de etapa comeca do topo (a pagina de termos e longa no mobile)
  useEffect(() => { window.scrollTo(0, 0); }, [pagina, concluido]);

  // Prepara o canvas branco quando a etapa de assinatura monta.
  // O canvas desmonta ao voltar de etapa, entao o traco anterior se perde:
  // zera temAssinatura junto pra validacao nao aceitar canvas em branco.
  useEffect(() => {
    if (pagina !== "assinatura") return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    setTemAssinatura(false);
  }, [pagina]);

  /* ── assinatura no canvas: pointer events com escala rect->canvas ── */
  function posDoEvento(ev: React.PointerEvent) {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (cv.width / r.width),
              y: (ev.clientY - r.top) * (cv.height / r.height) };
  }
  function comecarDesenho(ev: React.PointerEvent<HTMLCanvasElement>) {
    ev.preventDefault(); desenhandoRef.current = true;
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    const { x, y } = posDoEvento(ev);
    ctx.beginPath(); ctx.moveTo(x, y);
  }
  function moverDesenho(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhandoRef.current) return;
    ev.preventDefault();
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    const { x, y } = posDoEvento(ev);
    ctx.lineTo(x, y); ctx.stroke();
    if (!temAssinatura) setTemAssinatura(true);
  }
  function pararDesenho() { desenhandoRef.current = false; }
  function limparAssinatura() {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    setTemAssinatura(false);
  }
  function tirarSelfie(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setSelfie(String(rd.result));
    rd.readAsDataURL(f);
  }

  /* ── etapa WhatsApp (OTP finalidade onboarding) ── */
  async function enviarCodigo() {
    if (!prestador || otpOcupado) return;
    // DDD + numero (10 ou 11 digitos); o backend normaliza o DDI 55
    const digitos = whatsapp.replace(/\D/g, "");
    if (digitos.length < 10) { setOtpMsg("Informe o número com DDD, ex: 41 99999-9999."); return; }
    setOtpOcupado(true); setOtpMsg(null);
    try {
      const j = await apiPost("/api/instala/otp/enviar", {
        prestador_id: prestador.id, finalidade: "onboarding",
        telefone: whatsapp.trim(),
      });
      setTelefoneMascarado(j.telefone_mascarado || null);
      setCodigo("");
      setOtpEtapa("enviado");
      setOtpMsg("Código enviado pro seu WhatsApp. Digite os 6 dígitos.");
    } catch (e: any) {
      setOtpMsg(String(e?.message || e));
    } finally { setOtpOcupado(false); }
  }
  async function validarCodigo() {
    if (!prestador || otpOcupado || codigo.length < 6) return;
    setOtpOcupado(true); setOtpMsg(null);
    try {
      const j = await apiPost("/api/instala/otp/validar", {
        prestador_id: prestador.id, codigo, finalidade: "onboarding",
      });
      setOtpId(j.otp_id);
      setOtpEtapa("validado");
      setOtpMsg(null);
    } catch (e: any) {
      // 410 = expirou (recomecar do envio); 401 = codigo errado (tentar de novo)
      if (e?.status === 410) { setOtpEtapa("inicial"); setOtpId(null); }
      setOtpMsg(String(e?.message || e));
    } finally { setOtpOcupado(false); }
  }

  /* ── aceite final: valida os passos e fecha no backend ── */
  async function aceitar() {
    if (!prestador || !vigente) return;
    // As etapas anteriores ja travam o avanco, mas revalida por seguranca
    if (!nome || !cnpj || !endereco) { setErro("Preencha nome, CNPJ/CPF e endereço na etapa Seus dados."); setPagina("dados"); return; }
    if (otpEtapa !== "validado" || !otpId) { setErro("Confirme o código do WhatsApp antes de assinar."); setPagina("whatsapp"); return; }
    if (!selfie) { setErro("Tire a selfie de registro."); setPagina("selfie"); return; }
    if (!temAssinatura) { setErro("Assine no espaço do prestador de serviços."); return; }
    setEnviando(true); setErro(null);
    try {
      const assinatura = canvasRef.current?.toDataURL("image/png") || "";
      const salvo = await apiPost("/api/instala/contrato/aceitar", {
        prestador_id: prestador.id,
        otp_id: otpId,
        dados_prestador: { nome, cnpj_cpf: cnpj, endereco },
        selfie_b64: selfie,
        assinatura_b64: assinatura,
      });
      setPdfUrl(salvo?.pdf_url || null);
      setConcluido(true);
    } catch (e: any) {
      // validacao do WhatsApp venceu (>30min): volta pra etapa do codigo
      if (e?.status === 401 || e?.status === 410) {
        setOtpEtapa("inicial"); setOtpId(null);
        setPagina("whatsapp");
        setOtpMsg("A confirmação do WhatsApp venceu. Envie um novo código.");
      }
      setErro(String(e?.message || e));
    } finally { setEnviando(false); }
  }

  /* ── inline do markdown: **negrito** + placeholders viram spans ao vivo ──
     O preenchimento acontece na etapa Seus dados; aqui o texto so ESPELHA
     (sublinhado dourado = preenchido, ambar = falta). */
  function fill(valor: string, rotulo: string, chave: string) {
    return valor
      ? <span key={chave} className="cg-fill">{valor}</span>
      : <span key={chave} className="cg-fill cg-fill--empty">{rotulo}</span>;
  }
  function renderCampos(texto: string, chave: string) {
    return texto.split(PLACEHOLDER_RE).map((seg, i) => {
      if (seg === "{{PRESTADOR_NOME}}")      return fill(nome, "NOME DO PRESTADOR", `${chave}-n${i}`);
      if (seg === "{{PRESTADOR_CPF_CNPJ}}")  return fill(cnpj, "CNPJ OU CPF", `${chave}-c${i}`);
      if (seg === "{{PRESTADOR_ENDERECO}}")  return fill(endereco, "ENDEREÇO COMPLETO", `${chave}-e${i}`);
      return <span key={`${chave}-t${i}`}>{seg}</span>;
    });
  }
  function renderInline(texto: string, chave: string) {
    // negrito primeiro: **{{X}}** vira <b> com o span dentro
    return texto.split(BOLD_RE).map((seg, i) => {
      const m = seg.match(/^\*\*([^*]+)\*\*$/);
      if (m) return <b key={`${chave}-b${i}`}>{renderCampos(m[1], `${chave}-b${i}`)}</b>;
      return <span key={`${chave}-s${i}`}>{renderCampos(seg, `${chave}-s${i}`)}</span>;
    });
  }

  const hoje = new Date();
  const dataFmt = hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  /* ── carregando / erro de carga ── */
  if (!vigente) {
    return (
      <div className="cg">
        <style>{CSS}</style>
        <section className="cg-page cg-page--paper cg-success">
          <p className="cg-lead" style={{ color: carregaErro ? "#b0503b" : undefined, margin: 0 }}>
            {carregaErro ? `Não foi possível carregar o contrato: ${carregaErro}` : "Carregando contrato..."}
          </p>
        </section>
      </div>
    );
  }

  /* ── sucesso / ja assinado (padrao success do /b) ── */
  if (concluido || !vigente.precisa_aceite) {
    return (
      <div className="cg">
        <style>{CSS}</style>
        <section className="cg-page cg-page--paper cg-success">
          <div>
            <div className="cg-mark"><Check size={30} /></div>
            <span className="cg-wordmark">PARKET</span>
            <h2 className="cg-title" style={{ marginTop: 18 }}>Contrato <em>assinado</em>.</h2>
            <p className="cg-lead" style={{ marginBottom: 20 }}>
              Seu Contrato Geral de Prestação de Serviços (versão {vigente.versao}) está ativo.
              Cada obra que você iniciar adere a este contrato com o código do WhatsApp.
            </p>
            {pdfUrl && (
              <p style={{ marginBottom: 28 }}>
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="cg-ok" style={{ textDecoration: "none" }}>
                  <FileText size={15} /> VER PDF DO CONTRATO
                </a>
              </p>
            )}
            <button className="cg-btn" onClick={() => nav("/", { replace: true })}>Entrar no app</button>
          </div>
        </section>
      </div>
    );
  }

  const blocos = mdBlocos(vigente.conteudo_md || "");

  /* Header padrao das etapas escuras: wordmark + posicao no fluxo */
  function headerEscuro(rotulo: string) {
    return (
      <header className="cg-header">
        <span className="cg-wordmark">PARKET</span>
        <span className="cg-pagenum">{rotulo}</span>
      </header>
    );
  }

  return (
    <div className="cg">
      <style>{CSS}</style>

      {/* ── CAPA (paper, padrao cover do /b) ── */}
      {pagina === "capa" && (
        <section className="cg-page cg-page--paper">
          <header className="cg-header">
            <span className="cg-wordmark">PARKET</span>
            <span className="cg-pagenum">Contrato &middot; v{vigente.versao}</span>
          </header>
          <div style={{ flex: 1 }}>
            <p className="cg-eyebrow">Contrato de prestação de serviços</p>
            <h1 className="cg-title">{prestador?.nome || "Prestador"}</h1>
            <p className="cg-lead">
              Bem-vindo ao padrão Parket. Este é o seu contrato geral: você assina uma única
              vez e cada obra nova adere a ele direto pelo app, com o código do WhatsApp.
            </p>
            <dl className="cg-meta">
              <div><dt>Contratante</dt><dd>PKT Serviços de Revestimentos Ltda</dd></div>
              <div><dt>Data</dt><dd>{dataFmt}</dd></div>
              <div><dt>Versão dos termos</dt><dd>v{vigente.versao}</dd></div>
              <div><dt>Assinatura</dt><dd>Eletrônica: WhatsApp + selfie</dd></div>
            </dl>
          </div>
          <footer className="cg-footer">
            <span />
            <button className="cg-btn cg-btn--ghost" onClick={() => setPagina("termos")}>Ler o contrato &rarr;</button>
          </footer>
        </section>
      )}

      {/* ── ETAPA 01: termos (paper) + botao de aceite no footer ── */}
      {pagina === "termos" && (
        <section className="cg-page cg-page--paper">
          <header className="cg-header">
            <span className="cg-wordmark">PARKET</span>
            <span className="cg-pagenum">Etapa 1 de 5</span>
          </header>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <p className="cg-eyebrow">01 &middot; Termos</p>
            <h2 className="cg-title">Contrato geral de <em>prestação de serviços</em>.</h2>
            <p className="cg-lead">
              Leia com atenção. Os campos destacados em dourado são preenchidos por você
              na próxima etapa e entram no texto do contrato.
            </p>

            {/* Clausulas renderizadas do markdown versionado do catalogo */}
            {blocos.map((b, i) => {
              if (b.tipo === "h2") return <h3 key={i} className="cg-h3">{renderInline(b.texto, `h${i}`)}</h3>;
              if (b.tipo === "ul") return (
                <ul key={i} className="cg-ul">
                  {b.itens.map((it, k) => <li key={k}>{renderInline(it, `u${i}-${k}`)}</li>)}
                </ul>
              );
              return <p key={i} className="cg-p">{renderInline(b.texto, `p${i}`)}</p>;
            })}

            <p className="cg-p" style={{ marginTop: 24 }}>Curitiba, {dataFmt}.</p>
          </div>
          <footer className="cg-footer">
            <button className="cg-btn--link" onClick={() => setPagina("capa")}>&larr; Voltar</button>
            <button className="cg-btn" onClick={() => setPagina("dados")}>
              <Check size={15} /> Aceito os termos &rarr;
            </button>
          </footer>
        </section>
      )}

      {/* ── ETAPA 02: seus dados (dark) preenche DAS PARTES ── */}
      {pagina === "dados" && (
        <section className="cg-page cg-page--dark">
          {headerEscuro("Etapa 2 de 5")}
          <div style={{ flex: 1 }}>
            <p className="cg-eyebrow">02 &middot; Seus dados</p>
            <h2 className="cg-title">Quem <em>assina</em>.</h2>
            <p className="cg-lead">
              Estes dados entram na cláusula Das Partes e no PDF do contrato.
              Confira antes de continuar.
            </p>
            <div className="cg-bloco">
              <p className="cg-bloco-title">Das partes</p>
              <div className="cg-field">
                <label htmlFor="cg-nome">Nome completo</label>
                <input id="cg-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
              </div>
              <div className="cg-field">
                <label htmlFor="cg-cnpj">CNPJ ou CPF</label>
                <input id="cg-cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} inputMode="numeric" />
              </div>
              <div className="cg-field">
                <label htmlFor="cg-end">Endereço completo</label>
                <input id="cg-end" value={endereco} onChange={(e) => setEndereco(e.target.value)} autoComplete="street-address" />
              </div>
            </div>
          </div>
          <footer className="cg-footer">
            <button className="cg-btn--linkcream" onClick={() => setPagina("termos")}>&larr; Reler os termos</button>
            <button className="cg-btn cg-btn--cream" onClick={() => setPagina("whatsapp")}
                    disabled={!nome.trim() || !cnpj.trim() || !endereco.trim()}>
              Continuar &rarr;
            </button>
          </footer>
        </section>
      )}

      {/* ── ETAPA 03: WhatsApp (dark) confirma o numero por codigo OTP ── */}
      {pagina === "whatsapp" && (
        <section className="cg-page cg-page--dark">
          {headerEscuro("Etapa 3 de 5")}
          <div style={{ flex: 1 }}>
            <p className="cg-eyebrow">03 &middot; WhatsApp</p>
            <h2 className="cg-title">Confirme seu <em>WhatsApp</em>.</h2>
            <p className="cg-lead">
              Confira seu número, corrija se precisar e receba um código de 6 dígitos.
              Essa confirmação faz parte da sua assinatura eletrônica e o número
              fica salvo no seu cadastro Parket.
            </p>
            <div className="cg-bloco">
              {otpEtapa === "validado" ? (
                <p className="cg-ok"><Check size={15} /> WhatsApp confirmado{telefoneMascarado ? ` · ${telefoneMascarado}` : ""}</p>
              ) : (
                <>
                  {/* Numero editavel: enviado no otp/enviar e persistido no cadastro */}
                  <div className="cg-field">
                    <label htmlFor="cg-wpp">Número do WhatsApp (com DDD)</label>
                    <input id="cg-wpp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                           inputMode="tel" autoComplete="tel" placeholder="41 99999-9999" />
                  </div>
                  {otpEtapa === "enviado" && (
                    <div className="cg-otp-row">
                      <input
                        className="cg-otp-input"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
                      />
                      <button className="cg-btn cg-btn--gold" onClick={validarCodigo} disabled={otpOcupado || codigo.length < 6}>
                        Validar
                      </button>
                    </div>
                  )}
                  <button className="cg-btn cg-btn--ghost" style={{ color: "#f8f8f7", borderColor: "rgba(248,248,247,0.4)" }}
                          onClick={enviarCodigo} disabled={otpOcupado}>
                    <MessageCircle size={13} /> {otpEtapa === "enviado" ? "Reenviar código" : "Enviar código por WhatsApp"}
                  </button>
                  {telefoneMascarado && otpEtapa === "enviado" && (
                    <p className="cg-msg" style={{ color: "rgba(248,248,247,0.55)" }}>Enviado para {telefoneMascarado}.</p>
                  )}
                </>
              )}
              {otpMsg && otpEtapa !== "validado" && <p className="cg-msg">{otpMsg}</p>}
            </div>
          </div>
          <footer className="cg-footer">
            <button className="cg-btn--linkcream" onClick={() => setPagina("dados")}>&larr; Voltar</button>
            <button className="cg-btn cg-btn--cream" onClick={() => setPagina("selfie")} disabled={otpEtapa !== "validado"}>
              Continuar &rarr;
            </button>
          </footer>
        </section>
      )}

      {/* ── ETAPA 04: selfie (dark) registro facial com hash SHA-256 no backend ── */}
      {pagina === "selfie" && (
        <section className="cg-page cg-page--dark">
          {headerEscuro("Etapa 4 de 5")}
          <div style={{ flex: 1 }}>
            <p className="cg-eyebrow">04 &middot; Selfie</p>
            <h2 className="cg-title">Selfie de <em>registro</em>.</h2>
            <p className="cg-lead">
              Tire uma foto do seu rosto agora. Ela fica registrada junto com a
              assinatura como prova de que foi você quem assinou.
            </p>
            <div className="cg-bloco">
              {selfie ? (
                <div style={{ textAlign: "center" }}>
                  <img src={selfie} alt="selfie" className="cg-selfie-img" />
                  <button className="cg-mini" onClick={() => setSelfie(null)} style={{ marginTop: 10 }}>
                    <RotateCcw size={11} /> Tirar outra
                  </button>
                </div>
              ) : (
                <label className="cg-selfie-label">
                  <Camera size={16} /> Tirar selfie
                  <input type="file" accept="image/*" capture="user" onChange={tirarSelfie} style={{ display: "none" }} />
                </label>
              )}
            </div>
          </div>
          <footer className="cg-footer">
            <button className="cg-btn--linkcream" onClick={() => setPagina("whatsapp")}>&larr; Voltar</button>
            <button className="cg-btn cg-btn--cream" onClick={() => setPagina("assinatura")} disabled={!selfie}>
              Continuar &rarr;
            </button>
          </footer>
        </section>
      )}

      {/* ── ETAPA 05: assinatura manuscrita (dark) + confirmacao final ── */}
      {pagina === "assinatura" && (
        <section className="cg-page cg-page--dark">
          {headerEscuro("Etapa 5 de 5")}
          <div style={{ flex: 1 }}>
            <p className="cg-eyebrow">05 &middot; Assinatura</p>
            <h2 className="cg-title">Assine para <em>concluir</em>.</h2>
            <p className="cg-lead">
              Desenhe sua assinatura no espaço abaixo, do jeito que você assina no papel.
            </p>
            <div className="cg-bloco">
              <div className="cg-canvasbox">
                <canvas
                  ref={canvasRef}
                  width={880} height={260}
                  onPointerDown={comecarDesenho}
                  onPointerMove={moverDesenho}
                  onPointerUp={pararDesenho}
                  onPointerCancel={pararDesenho}
                  onPointerLeave={pararDesenho}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              </div>
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <button className="cg-mini" onClick={limparAssinatura}><RotateCcw size={11} /> Limpar</button>
              </div>
              <div className="cg-sigline">
                Prestador de serviços
                {nome && <div style={{ marginTop: 4, color: "#f8f8f7", letterSpacing: "0.06em" }}>{nome}</div>}
              </div>
            </div>
            {erro && <p className="cg-msg" style={{ marginBottom: 8 }}>{erro}</p>}
          </div>
          <footer className="cg-footer">
            <button className="cg-btn--linkcream" onClick={() => setPagina("selfie")}>&larr; Voltar</button>
            <button className="cg-btn cg-btn--gold" onClick={aceitar} disabled={enviando || !temAssinatura}>
              <Check size={15} /> {enviando ? "Gerando contrato..." : "Confirmar e assinar"}
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
