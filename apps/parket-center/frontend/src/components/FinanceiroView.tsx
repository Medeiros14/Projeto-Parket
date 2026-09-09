/** Financeiro da Obra — view fullscreen da Central.
 *  QUÊ: cliente vê contratado × pago × falta, próxima parcela em destaque,
 *  lista das parcelas a pagar (com botão Baixar boleto / Pagar com Pix) e
 *  lista das parcelas já pagas com data, forma e link do comprovante quando
 *  o Financeiro anexou algum.
 *  DADOS: /api/publico/center/<token>/financeiro (gestão) → agrega
 *  core.lancamentos entrada da obra. Boleto/Pix são proxied pro backend do
 *  termo (parket-docusign, Itaú), autenticados pelo token do cliente.
 *  UX: tom marketing (sem alerta, sem travessão), sem emoji. Estrutura de
 *  hero + resumo + seções segue Cronograma/Acompanhamento pra o cliente
 *  ter a mesma leitura em todas as views da Central. */
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, X, Copy, Check, FileDown, QrCode,
  Info, Paperclip, CalendarClock,
} from "lucide-react";
import {
  api, fmtData, type FinanceiroObra as FinData, type ParcelaFinanceiro,
  type CenterData, type CenterNotasResp, type NotaCenter,
} from "../api";
import { type ColorScheme, serif } from "../theme";

const fmtBRL = (v: number | null | undefined): string => {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
};

// Data preserva TZ do banco (yyyy-mm-dd); dias até vencimento pro rótulo do
// próximo pagamento ("Vence em 3 dias" / "Vencida há 2 dias" / "Vence hoje").
function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + "T12:00:00").getTime();
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  return Math.round((d - hoje.getTime()) / 86400000);
}
function rotuloVencimento(p: { vencimento: string | null; status: string }): string {
  const dias = diasAte(p.vencimento);
  if (dias === null) return "Aguardando vencimento";
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  if (dias > 1) return `Vence em ${dias} dias`;
  if (dias === -1) return "Vencida ontem";
  return `Vencida há ${Math.abs(dias)} dias`;
}

// Traduz forma_pagamento (livre no core) pra rótulo humano.
function rotuloForma(s?: string | null): string {
  if (!s) return "Pagamento confirmado";
  const k = s.toLowerCase();
  if (k.includes("pix")) return "Pago via Pix";
  if (k.includes("boleto")) return "Pago via boleto";
  if (k.includes("ted") || k.includes("transf")) return "Pago via transferência";
  if (k.includes("cartao") || k.includes("cartão")) return "Pago no cartão";
  return `Pagamento via ${s}`;
}

type PixState = {
  parcela: ParcelaFinanceiro; txid: string;
  copiaECola: string; ambiente: string;
  status: "ATIVA" | "CONCLUIDA" | string; copiado: boolean;
};

export function FinanceiroView({ data, c, isDark, token, onVoltar }: {
  data: CenterData; c: ColorScheme; isDark: boolean;
  token: string; onVoltar: () => void;
}) {
  const [fin, setFin] = useState<FinData | null>(null);
  const [nfs, setNfs] = useState<CenterNotasResp | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [pix, setPix] = useState<PixState | null>(null);
  const [detalhe, setDetalhe] = useState<ParcelaFinanceiro | null>(null);
  const [gerandoPix, setGerandoPix] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = () => {
    setCarregando(true); setErro("");
    api.financeiro(token)
      .then(setFin)
      .catch(() => setErro("Não foi possível carregar o painel financeiro agora."))
      .finally(() => setCarregando(false));
    // NFe carrega em paralelo; sem NF vinculada só oculta a seção.
    api.centerNotas(token).then(setNfs).catch(() => {});
  };
  useEffect(load, [token]);

  useEffect(() => {
    if (!pix || pix.status === "CONCLUIDA") {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await api.financeiroPixStatus(token, pix.txid);
        if (r.status === "CONCLUIDA") {
          setPix(p => (p ? { ...p, status: "CONCLUIDA" } : p));
          load(); // watcher da baixa; UI atualiza a lista assim que confirma
        }
      } catch { /* silencioso, retenta no próximo tick */ }
    }, 5000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pix?.txid, pix?.status]);

  const abrirBoleto = (parc: ParcelaFinanceiro) => {
    window.open(api.financeiroBoletoUrl(token, parc.id), "_blank", "noopener,noreferrer");
  };
  const gerarPix = async (parc: ParcelaFinanceiro) => {
    if (gerandoPix) return;
    setGerandoPix(parc.id);
    try {
      const r = await api.financeiroPix(token, parc.id);
      setPix({
        parcela: parc, txid: r.txid, copiaECola: r.copia_e_cola,
        ambiente: r.ambiente, status: "ATIVA", copiado: false,
      });
    } catch {
      setErro("Não foi possível gerar o Pix agora. Tente novamente em instantes ou use o boleto.");
    } finally {
      setGerandoPix(null);
    }
  };
  const copiarPix = async () => {
    if (!pix) return;
    try { await navigator.clipboard.writeText(pix.copiaECola); }
    catch { /* browser sem permissão de clipboard */ }
    setPix(p => (p ? { ...p, copiado: true } : p));
    window.setTimeout(() => setPix(p => (p ? { ...p, copiado: false } : p)), 2400);
  };

  const p = data.projeto;

  return (
    <div style={{ padding: "32px var(--pkt-pad-x) 60px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 14 }}>
          <button onClick={onVoltar} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", gap: 6, fontSize: 10,
            letterSpacing: "0.18em", textTransform: "uppercase", color: c.accent,
          }}>
            <ArrowLeft size={12} strokeWidth={1.5} /> Voltar à central
          </button>
        </div>
        <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 14 }}>
          Pagamentos · Contrato {p.numero_proposta ? `#${p.numero_proposta}` : ""}
        </div>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(30px, 8vw, 46px)", fontWeight: 300, color: c.textPrimary, margin: "0 0 10px", lineHeight: 1.05 }}>
          Financeiro
        </h1>
        <p style={{ fontSize: 13, color: c.textSecondary, margin: 0, maxWidth: 620, lineHeight: 1.6 }}>
          Consulte suas parcelas, baixe o boleto ou pague por Pix na hora, e acompanhe
          o histórico de pagamentos com todos os comprovantes registrados pela Parket.
        </p>
      </div>

      {erro && (
        <div style={{
          marginBottom: 20, padding: "10px 14px",
          border: `1px solid ${c.border2}`, background: c.card1,
          fontSize: 12, color: c.textSecondary,
        }}>{erro}</div>
      )}

      {carregando && !fin && (
        <div style={{ padding: "60px 0", textAlign: "center", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary }}>
          Carregando painel financeiro
        </div>
      )}

      {fin && !fin.disponivel && (
        <div style={{
          padding: 32, border: `1px solid ${c.border1}`, background: c.card1,
          fontSize: 12, color: c.textSecondary, lineHeight: 1.55,
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 10 }}>
            Painel financeiro
          </div>
          Seu resumo de pagamentos aparece aqui assim que a obra estiver contratada e ativa.
          Se você já assinou o contrato e o painel continua vazio, fale com a equipe Parket.
        </div>
      )}

      {fin?.disponivel && fin.totais && (
        <ResumoContrato fin={fin} c={c} onGerarPix={gerarPix} onAbrirBoleto={abrirBoleto} gerandoPix={gerandoPix} />
      )}

      {fin?.disponivel && (
        <ListasParcelas
          parcelas={fin.parcelas} c={c}
          onGerarPix={gerarPix} onAbrirBoleto={abrirBoleto}
          onVerDetalhe={setDetalhe} gerandoPix={gerandoPix}
        />
      )}

      {nfs && nfs.total_qtd > 0 && (
        <DocumentosFiscais nfs={nfs.notas} c={c} />
      )}

      {pix && <PixModal
        pix={pix} c={c} onClose={() => setPix(null)} onCopiar={copiarPix}
      />}
      {detalhe && <ComprovanteModal parcela={detalhe} c={c} onClose={() => setDetalhe(null)} />}
    </div>
  );
}

/* ── Cabeçalho com totais + destaque da próxima parcela ── */
function ResumoContrato({ fin, c, onGerarPix, onAbrirBoleto, gerandoPix }: {
  fin: FinData; c: ColorScheme;
  onGerarPix: (p: ParcelaFinanceiro) => void; onAbrirBoleto: (p: ParcelaFinanceiro) => void;
  gerandoPix: string | null;
}) {
  const t = fin.totais!;
  const pct = Math.min(100, Math.max(0, t.pct_pago));
  const prox = fin.proxima;
  // Usa a parcela completa da lista pra ter cobranca_disponivel + descrição
  const parcelaProx = prox && fin.parcelas.find(p => p.id === prox.id);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1,
        background: c.border1, border: `1px solid ${c.border1}`,
      }}>
        {[
          { label: "Total contratado", value: fmtBRL(t.contratado), tone: c.textPrimary },
          { label: "Já pago", value: fmtBRL(t.pago), tone: "#2E7D4F" },
          { label: "A pagar", value: fmtBRL(t.falta), tone: c.accent },
        ].map((k, i) => (
          <div key={i} style={{ background: c.card1, padding: "18px 18px 20px" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 8 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 20, color: k.tone, fontWeight: 400, letterSpacing: "-0.01em" }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
          color: c.textTertiary, marginBottom: 8,
        }}>
          <span>Contrato honrado</span>
          <span style={{ color: c.textPrimary }}>{pct.toFixed(1).replace(".", ",")}%</span>
        </div>
        <div style={{ height: 4, background: c.border1, position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: 0, right: `${100 - pct}%`,
            background: c.accent, transition: "right 400ms ease",
          }} />
        </div>
      </div>

      {parcelaProx && (
        <div style={{
          marginTop: 22, border: `1px solid ${c.border1}`, background: c.card1,
          padding: "22px 22px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <CalendarClock size={13} strokeWidth={1.5} color={c.accent} />
            <span style={{
              fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary,
            }}>Próximo pagamento</span>
          </div>
          <div style={{
            display: "grid", gap: 14, gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center",
          }}>
            <div>
              <div style={{ fontFamily: serif, fontSize: 26, color: c.textPrimary, marginBottom: 4, letterSpacing: "-0.01em" }}>
                {fmtBRL(parcelaProx.valor)}
              </div>
              <div style={{ fontSize: 12, color: c.textSecondary }}>
                {rotuloVencimento(parcelaProx)} · {parcelaProx.vencimento ? fmtData(parcelaProx.vencimento) : "sem data"}
                {parcelaProx.parcela_total > 1 &&
                  ` · Parcela ${parcelaProx.parcela_atual} de ${parcelaProx.parcela_total}`}
              </div>
            </div>
            {parcelaProx.cobranca_disponivel && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button onClick={() => onAbrirBoleto(parcelaProx)} style={btnGhost(c)}>
                  <FileDown size={12} strokeWidth={1.5} /> Baixar boleto
                </button>
                <button onClick={() => onGerarPix(parcelaProx)} disabled={gerandoPix === parcelaProx.id}
                        style={btnPrimary(c, gerandoPix === parcelaProx.id)}>
                  <QrCode size={12} strokeWidth={1.5} />
                  {gerandoPix === parcelaProx.id ? "Gerando Pix" : "Pagar com Pix"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 2 seções: A pagar (com ações) e Pagas (comprovante) ── */
function ListasParcelas({ parcelas, c, onGerarPix, onAbrirBoleto, onVerDetalhe, gerandoPix }: {
  parcelas: ParcelaFinanceiro[]; c: ColorScheme;
  onGerarPix: (p: ParcelaFinanceiro) => void;
  onAbrirBoleto: (p: ParcelaFinanceiro) => void;
  onVerDetalhe: (p: ParcelaFinanceiro) => void;
  gerandoPix: string | null;
}) {
  const abertas = parcelas.filter(p => p.status !== "pago");
  const pagas = parcelas.filter(p => p.status === "pago");

  return (
    <>
      <SecaoParcelas titulo="A pagar" contador={abertas.length} c={c}>
        {abertas.length === 0 ? (
          <VazioBloco c={c}
            titulo="Sem parcelas em aberto"
            texto="Todas as parcelas do contrato estão em dia. Obrigado pela pontualidade." />
        ) : abertas.map(p => (
          <LinhaParcela key={p.id} p={p} c={c}
            onGerarPix={onGerarPix} onAbrirBoleto={onAbrirBoleto}
            gerandoPix={gerandoPix} />
        ))}
      </SecaoParcelas>

      <SecaoParcelas titulo="Pagas" contador={pagas.length} c={c}>
        {pagas.length === 0 ? (
          <VazioBloco c={c}
            titulo="Ainda sem pagamentos registrados"
            texto="Assim que a Parket confirmar sua primeira parcela, ela aparece aqui com o comprovante." />
        ) : pagas.map(p => (
          <LinhaParcelaPaga key={p.id} p={p} c={c} onVerDetalhe={onVerDetalhe} />
        ))}
      </SecaoParcelas>
    </>
  );
}

function SecaoParcelas({ titulo, contador, c, children, unidade = "parcela" }: {
  titulo: string; contador: number; c: ColorScheme; children: React.ReactNode;
  unidade?: string;
}) {
  return (
    <section style={{ marginBottom: 34 }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 12, borderBottom: `1px solid ${c.border1}`, paddingBottom: 8,
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary }}>
          {titulo}
        </div>
        <div style={{ fontSize: 10, color: c.textTertiary }}>
          {contador} {contador === 1 ? unidade : `${unidade}s`}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

function LinhaParcela({ p, c, onGerarPix, onAbrirBoleto, gerandoPix }: {
  p: ParcelaFinanceiro; c: ColorScheme;
  onGerarPix: (p: ParcelaFinanceiro) => void;
  onAbrirBoleto: (p: ParcelaFinanceiro) => void;
  gerandoPix: string | null;
}) {
  const venc = p.status === "vencido" ? "#B0562E" : c.accent;
  return (
    <div style={{
      border: `1px solid ${c.border1}`, background: c.card1,
      padding: "16px 18px", display: "grid",
      gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "center",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
          color: c.textTertiary, marginBottom: 6,
        }}>
          Parcela {p.parcela_atual} de {p.parcela_total}
        </div>
        <div style={{ fontSize: 18, color: c.textPrimary, fontWeight: 400, marginBottom: 6 }}>
          {fmtBRL(p.valor)}
        </div>
        <span style={{
          display: "inline-block", padding: "3px 10px",
          background: `${venc}15`, color: venc,
          fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
        }}>
          {rotuloVencimento(p)} · {p.vencimento ? fmtData(p.vencimento) : "sem data"}
        </span>
      </div>

      {p.cobranca_disponivel ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => onAbrirBoleto(p)} style={btnGhost(c)}>
            <FileDown size={12} strokeWidth={1.5} /> Baixar boleto
          </button>
          <button onClick={() => onGerarPix(p)} disabled={gerandoPix === p.id}
                  style={btnPrimary(c, gerandoPix === p.id)}>
            <QrCode size={12} strokeWidth={1.5} />
            {gerandoPix === p.id ? "Gerando Pix" : "Pagar com Pix"}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 10, color: c.textTertiary, letterSpacing: "0.1em", textAlign: "right", maxWidth: 220 }}>
          Cobrança automática ainda não disponível para esta parcela. Fale com a equipe Parket.
        </div>
      )}
    </div>
  );
}

function LinhaParcelaPaga({ p, c, onVerDetalhe }: {
  p: ParcelaFinanceiro; c: ColorScheme;
  onVerDetalhe: (p: ParcelaFinanceiro) => void;
}) {
  const anx = p.anexos && p.anexos.length > 0 ? p.anexos[0] : null;
  return (
    <div style={{
      border: `1px solid ${c.border1}`, background: c.card1,
      padding: "16px 18px", display: "grid",
      gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "center",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
          color: c.textTertiary, marginBottom: 6,
        }}>
          Parcela {p.parcela_atual} de {p.parcela_total}
        </div>
        <div style={{ fontSize: 18, color: c.textPrimary, fontWeight: 400, marginBottom: 6 }}>
          {fmtBRL(p.valor_pago ?? p.valor)}
        </div>
        <span style={{
          display: "inline-block", padding: "3px 10px",
          background: "rgba(46,125,79,0.10)", color: "#2E7D4F",
          fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
        }}>
          {rotuloForma(p.forma_pagamento)} em {fmtData(p.pago_em)}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {anx && (
          <a href={anx.url} target="_blank" rel="noreferrer" style={{ ...btnGhost(c), textDecoration: "none" }}>
            <Paperclip size={12} strokeWidth={1.5} /> Baixar comprovante
          </a>
        )}
        <button onClick={() => onVerDetalhe(p)} style={btnGhost(c)}>
          <Info size={12} strokeWidth={1.5} /> Detalhes
        </button>
      </div>
    </div>
  );
}

/* ── Notas Fiscais — NFe emitidas pra obra, PDF (DANFE) + XML.
   Mesma estrutura visual das seções de parcela: header uppercase + linhas
   com card cinza claro. Valor da NFe não aparece (redundante com o
   financeiro logo acima). Botão PDF/XML abre em nova aba. */
function DocumentosFiscais({ nfs, c }: { nfs: NotaCenter[]; c: ColorScheme }) {
  return (
    <SecaoParcelas titulo="Notas Fiscais" contador={nfs.length} unidade="nota" c={c}>
      {nfs.map(n => <LinhaNota key={n.ch_nfe} n={n} c={c} />)}
    </SecaoParcelas>
  );
}

function LinhaNota({ n, c }: { n: NotaCenter; c: ColorScheme }) {
  return (
    <div style={{
      border: `1px solid ${c.border1}`, background: c.card1,
      padding: "16px 18px", display: "grid",
      gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "center",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
          color: c.textTertiary, marginBottom: 6,
        }}>
          NFe {n.numero}/{n.serie}
        </div>
        <div style={{ fontSize: 13, color: c.textPrimary, marginBottom: 6 }}>
          Emitida em {fmtData(n.dh_emissao)}
        </div>
        {n.natureza_op && (
          <span style={{
            display: "inline-block", padding: "3px 10px",
            background: `${c.accent}15`, color: c.accent,
            fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            {n.natureza_op}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <a href={api.centerNotaPdfUrl(n.ch_nfe)} target="_blank" rel="noreferrer"
           style={{ ...btnGhost(c), textDecoration: "none" }}>
          <FileDown size={12} strokeWidth={1.5} /> Baixar PDF
        </a>
        <a href={api.centerNotaXmlUrl(n.ch_nfe)} download
           style={{ ...btnGhost(c), textDecoration: "none" }}>
          <FileDown size={12} strokeWidth={1.5} /> XML
        </a>
      </div>
    </div>
  );
}

function VazioBloco({ c, titulo, texto }: { c: ColorScheme; titulo: string; texto: string }) {
  return (
    <div style={{
      border: `1px dashed ${c.border2}`, background: "transparent",
      padding: "20px 22px", color: c.textSecondary,
    }}>
      <div style={{
        fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
        color: c.textTertiary, marginBottom: 6,
      }}>{titulo}</div>
      <div style={{ fontSize: 12, lineHeight: 1.6 }}>{texto}</div>
    </div>
  );
}

/* ── Botões compartilhados ── */
function btnGhost(c: ColorScheme): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 14px", border: `1px solid ${c.border2}`, background: "transparent",
    color: c.textPrimary, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
    cursor: "pointer",
  };
}
function btnPrimary(c: ColorScheme, loading: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 14px", border: "none", background: c.accent, color: c.bg,
    fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
    cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
  };
}

/* ── Modal do Pix — copia-e-cola + polling do banco ── */
function PixModal({ pix, c, onClose, onCopiar }: {
  pix: PixState; c: ColorScheme; onClose: () => void; onCopiar: () => void;
}) {
  const concluido = pix.status === "CONCLUIDA";
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: c.bg, color: c.textPrimary, width: "100%", maxWidth: 520,
        border: `1px solid ${c.border1}`, padding: "28px 28px 24px", position: "relative",
      }}>
        <button onClick={onClose} aria-label="Fechar" style={{
          position: "absolute", top: 12, right: 12, background: "transparent",
          border: "none", color: c.textTertiary, cursor: "pointer", padding: 6,
        }}><X size={18} strokeWidth={1.5} /></button>

        <div style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 8 }}>
          Parcela {pix.parcela.parcela_atual} de {pix.parcela.parcela_total}
        </div>
        <div style={{ fontSize: 26, marginBottom: 4, letterSpacing: "-0.01em" }}>{fmtBRL(pix.parcela.valor)}</div>

        {pix.ambiente !== "producao" && (
          <div style={{
            display: "inline-block", padding: "2px 8px", marginBottom: 12,
            background: `${c.accent}22`, color: c.accent,
            fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
          }}>Modo teste</div>
        )}

        {concluido ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 48, height: 48, borderRadius: "50%", background: "rgba(46,125,79,0.15)",
              color: "#2E7D4F", marginBottom: 12,
            }}><Check size={22} strokeWidth={1.5} /></div>
            <div style={{ fontSize: 16, color: c.textPrimary, marginBottom: 4 }}>Pagamento confirmado</div>
            <div style={{ fontSize: 12, color: c.textSecondary }}>Obrigado. Sua parcela já consta como quitada.</div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, margin: "16px 0" }}>
              Copie o código Pix abaixo e cole no aplicativo do seu banco na opção Pix Copia e Cola.
              O pagamento é confirmado em segundos.
            </p>
            <div style={{
              padding: 12, border: `1px solid ${c.border2}`, background: c.card1,
              wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11, color: c.textPrimary, marginBottom: 12, maxHeight: 140, overflow: "auto",
            }}>{pix.copiaECola}</div>
            <button onClick={onCopiar} style={{
              width: "100%", padding: "12px 14px", background: c.accent, color: c.bg,
              border: "none", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
              cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {pix.copiado ? <><Check size={13} strokeWidth={1.5} /> Copiado</>
                           : <><Copy size={13} strokeWidth={1.5} /> Copiar código Pix</>}
            </button>
            <div style={{ marginTop: 12, fontSize: 10, color: c.textTertiary, letterSpacing: "0.08em" }}>
              Após pagar, esta janela avisa automaticamente. Você pode fechar e voltar quando quiser.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Modal de detalhes da parcela paga (fallback quando não há PDF anexado) ── */
function ComprovanteModal({ parcela, c, onClose }: {
  parcela: ParcelaFinanceiro; c: ColorScheme; onClose: () => void;
}) {
  const linhas: [string, string][] = [
    ["Valor pago", fmtBRL(parcela.valor_pago ?? parcela.valor)],
    ["Data do pagamento", fmtData(parcela.pago_em)],
    ["Vencimento original", fmtData(parcela.vencimento)],
    ["Forma", rotuloForma(parcela.forma_pagamento)],
    parcela.numero_documento ? ["Referência", parcela.numero_documento] : null,
    ["Parcela", `${parcela.parcela_atual} de ${parcela.parcela_total}`],
  ].filter(Boolean) as [string, string][];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: c.bg, color: c.textPrimary, width: "100%", maxWidth: 480,
        border: `1px solid ${c.border1}`, padding: "28px 28px 24px", position: "relative",
      }}>
        <button onClick={onClose} aria-label="Fechar" style={{
          position: "absolute", top: 12, right: 12, background: "transparent",
          border: "none", color: c.textTertiary, cursor: "pointer", padding: 6,
        }}><X size={18} strokeWidth={1.5} /></button>

        <div style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 8 }}>
          Detalhes do pagamento
        </div>
        <div style={{ fontFamily: serif, fontSize: 22, color: c.textPrimary, marginBottom: 18 }}>
          {parcela.descricao || `Parcela ${parcela.parcela_atual}/${parcela.parcela_total}`}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {linhas.map(([k, v]) => (
            <div key={k} style={{
              display: "grid", gridTemplateColumns: "160px 1fr", gap: 12,
              borderBottom: `1px solid ${c.border1}`, padding: "8px 0",
            }}>
              <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: c.textTertiary }}>{k}</div>
              <div style={{ fontSize: 13, color: c.textPrimary, wordBreak: "break-word" }}>{v}</div>
            </div>
          ))}
        </div>

        {(!parcela.anexos || parcela.anexos.length === 0) && (
          <div style={{ marginTop: 18, fontSize: 11, color: c.textTertiary, lineHeight: 1.55 }}>
            Comprovante em PDF não anexado ainda. Se precisar do recibo emitido pelo banco,
            fale com a equipe Parket que enviamos por aqui.
          </div>
        )}
        {parcela.anexos && parcela.anexos.length > 0 && (
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            {parcela.anexos.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{
                ...btnGhost(c), textDecoration: "none", justifyContent: "center",
              }}>
                <Paperclip size={12} strokeWidth={1.5} /> {a.nome || "Baixar comprovante"}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
