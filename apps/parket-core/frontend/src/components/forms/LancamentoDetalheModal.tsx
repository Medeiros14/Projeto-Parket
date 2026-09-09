/**
 * Modal de detalhe da parcela (Will 28/08).
 *
 * QUÊ: clicar numa parcela (Recebimentos e Obra detalhe) abre este modal com
 * todos os dados do lançamento + ações de cobrança:
 *   - Vencimento editável: o vendedor renegocia o prazo aqui. Salvar chama a
 *     RPC core.alterar_vencimento_lancamento (audit no Cloud) e, quando a
 *     parcela é TERMO- com boleto emitido, o backend do termo EMITE UM BOLETO
 *     NOVO com o prazo renegociado (o watcher re-anota a linha digitável).
 *   - Reenviar: envio REAL pelo WhatsApp (Evolution API, não wa.me). O
 *     operador confere telefone + texto num painel de confirmação antes de
 *     disparar — nada sai sem revisão.
 *   - Copiar Pix / Copiar boleto: o instrumento REAL da cobrança, buscado do
 *     backend (GET /termo/cobranca/pagamento): Pix copia-e-cola (EMV) ou a
 *     linha digitável do boleto — pro gestor financeiro colar e mandar pro
 *     cliente por onde quiser (Will 28/08: nada de link do termo).
 *   - Baixar Boleto: gera o boleto NA HORA (GET /termo/cobranca/boleto-pdf
 *     emite pro valor/vencimento da parcela e devolve o PDF direto) — o
 *     gestor baixa e reenvia ele mesmo pro cliente, sem depender de boleto
 *     pré-emitido. boleto_url anexado (NF/Compras) tem prioridade.
 *   - Dar baixa: botão explícito que abre o BaixarLancamentoModal (conta +
 *     valor + data + "Confirmar receber") — substitui o ícone Wallet de baixa
 *     1-clique que o Will pediu pra tirar (baixa fácil demais nas linhas).
 *
 * POR QUÊ: baixa é ação financeira séria; precisa de intenção explícita e
 * confirmação. As ações de cobrança vivem junto do detalhe pra o financeiro
 * e o vendedor resolverem tudo num lugar só.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Send, Copy, FileDown, Wallet, CalendarClock } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button, Field, Input, Textarea } from "../ui/Form";
import { api, type Lancamento, type Parceiro, type Obra } from "../../lib/api";
import { fmtBRL, fmtDate, colorByStatus, obraLabel } from "../../lib/format";
import { toast } from "../../lib/toast";

// API do fluxo de termo/boleto (mesmo host do Core em produção).
const DOCUSIGN_API = "https://core.parket.works/api/docusign";

/** Extrai boleto_id e linha digitável das observações. O watcher anota
 *  "Boleto PKTBOL... emitido pelo termo — linha 34191... venc. AAAA-MM-DD."
 *  quando o cliente emite o boleto na página do termo. */
function parseBoleto(obs: string | null | undefined) {
  const texto = obs || "";
  // Pega a ÚLTIMA anotação (re-emissões empilham notas novas no fim).
  const ids = [...texto.matchAll(/Boleto\s+(\S+)\s+emitido/g)];
  const linhas = [...texto.matchAll(/linha\s+([\d.\s]+?)\s+venc/g)];
  const id = ids.length ? ids[ids.length - 1][1] : null;
  const linha = linhas.length ? linhas[linhas.length - 1][1].trim() : null;
  return { id, linha };
}

export function LancamentoDetalheModal({
  open, onClose, lancamento, parceiro, obra, onDarBaixa, onChanged,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: Lancamento | null;
  parceiro?: Parceiro | null;
  /* Só id/codigo/nome: aceita tanto Obra quanto ObraResumo (Obra detalhe). */
  obra?: Pick<Obra, "id" | "codigo" | "nome"> | null;
  /** Abre o BaixarLancamentoModal (a confirmação da baixa acontece lá). */
  onDarBaixa: (l: Lancamento) => void;
  /** Avisa a página pra recarregar depois de mudar o vencimento. */
  onChanged?: () => void;
}) {
  const l = lancamento;

  // Deriva o contexto de cobrança do TERMO-: sim_id embutido no documento.
  const simId = useMemo(() => {
    const doc = l?.numero_documento || "";
    return doc.startsWith("TERMO-") ? doc.slice("TERMO-".length) : null;
  }, [l?.numero_documento]);
  const boletoParsed = useMemo(() => parseBoleto(l?.observacoes), [l?.observacoes]);

  // Boleto "vivo": começa no que o watcher anotou; quando o vendedor muda o
  // vencimento e o backend re-emite, atualizamos aqui na hora (o watcher só
  // re-anota as observações no próximo ciclo).
  const [boleto, setBoleto] = useState(boletoParsed);
  // Pix copia-e-cola (EMV) da cobrança do termo — buscado do backend ao
  // abrir, porque o EMV não fica gravado na parcela (só o txid na sim).
  const [pixEmv, setPixEmv] = useState<string | null>(null);
  // Vencimento editável + estado das duas ações assíncronas.
  const [venc, setVenc] = useState("");
  const [salvandoVenc, setSalvandoVenc] = useState(false);
  // Painel de confirmação do reenvio (telefone + texto revisáveis).
  const [envioAberto, setEnvioAberto] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Re-sincroniza o estado local quando troca a parcela aberta.
  useEffect(() => {
    setBoleto(boletoParsed);
    setPixEmv(null);
    setVenc(l?.data_vencimento || "");
    setEnvioAberto(false);
    setEnviando(false);
    setSalvandoVenc(false);
  }, [l?.id, boletoParsed, l?.data_vencimento]);

  // Busca o instrumento REAL da cobrança no backend (Pix copia-e-cola ou
  // boleto): é o que o gestor financeiro precisa mandar pro cliente.
  useEffect(() => {
    if (!open || !simId) return;
    let vivo = true;
    fetch(`${DOCUSIGN_API}/termo/cobranca/pagamento?sim_id=${encodeURIComponent(simId)}`)
      .then((r) => r.json())
      .then((r) => {
        if (!vivo || !r?.ok) return;
        if (r.modo === "pix" && r.pix?.copia_e_cola) setPixEmv(r.pix.copia_e_cola);
        // Boleto do backend manda: é mais fresco que o parse das observações.
        if (r.modo === "boleto" && r.boleto?.linha_digitavel) {
          setBoleto({ id: r.boleto.id, linha: r.boleto.linha_digitavel });
        }
      })
      .catch(() => { /* segue com o que veio das observações */ });
    return () => { vivo = false; };
  }, [open, simId]);

  if (!l) return null;

  const baixado = l.status === "pago" || l.status === "recebido" || l.status === "conciliado";
  const isFinal = baixado || l.status === "cancelado";
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const atrasado = !isFinal && new Date(l.data_vencimento + "T00:00:00") < hoje;
  const eff = atrasado ? "atrasado" : l.status;
  const c = colorByStatus[eff];
  const vencMudou = !isFinal && venc && venc !== l.data_vencimento;

  // Baixar Boleto: anexo direto (boleto_url do Compras/NF) tem prioridade;
  // parcela de termo GERA o boleto na hora no backend (valor + vencimento
  // desta parcela) e o PDF abre direto na aba nova.
  const podeBoleto = Boolean((l as any).boleto_url || simId) && !isFinal;
  const baixarBoleto = () => {
    const direto = (l as any).boleto_url;
    if (direto) { window.open(direto, "_blank", "noopener"); return; }
    if (!simId) return;
    const qs = new URLSearchParams({
      sim_id: simId,
      valor: String(l.valor),
      vencimento: venc || l.data_vencimento,
    });
    toast.info("Gerando o boleto... o PDF abre em nova aba");
    window.open(`${DOCUSIGN_API}/termo/cobranca/boleto-pdf?${qs.toString()}`, "_blank", "noopener");
  };

  /** Texto da cobrança pro WhatsApp (o operador revisa antes de enviar).
   *  Leva o instrumento de pagamento direto: Pix copia-e-cola ou linha
   *  digitável do boleto — o cliente paga sem abrir link nenhum. */
  const montarMensagem = (linha: string | null, vencimento: string) => {
    const partes = [
      `Olá${parceiro?.nome ? " " + parceiro.nome.split(" ")[0] : ""}! Segue sua parcela Parket:`,
      `${l.descricao}`,
      `Valor: ${fmtBRL(l.valor)} · Vencimento: ${fmtDate(vencimento)}`,
    ];
    if (linha) partes.push(`Linha digitável do boleto: ${linha}`);
    else if (pixEmv) partes.push(`Pix copia e cola:\n${pixEmv}`);
    return partes.join("\n");
  };

  /** Copia texto pro clipboard com feedback (Pix, linha digitável). */
  const copiarTexto = async (texto: string, oQue: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${oQue} copiado`);
    } catch {
      toast.error("Não consegui copiar (permissão do navegador)");
    }
  };

  /** Salva o vencimento novo: TERMO- com boleto re-emite primeiro (se a
   *  emissão falhar, nada muda no Core — evita boleto e parcela divergirem). */
  const salvarVencimento = async () => {
    if (!vencMudou || salvandoVenc) return;
    setSalvandoVenc(true);
    try {
      let motivo: string | null = null;
      if (simId && boleto.id) {
        const r = await fetch(`${DOCUSIGN_API}/termo/cobranca/reenviar`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sim_id: simId, novo_vencimento: venc }),
        }).then((x) => x.json());
        if (!r.ok) throw new Error(r.error || "Falha na emissão do boleto novo");
        if (r.boleto) {
          setBoleto({ id: r.boleto.id, linha: r.boleto.linha_digitavel });
          motivo = `Boleto reemitido ${r.boleto.id} com o novo prazo.`;
        }
      }
      await api.alterarVencimentoLancamento(l.id, venc, motivo);
      toast.success(motivo ? "Vencimento alterado e boleto novo emitido" : "Vencimento alterado");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Não consegui alterar o vencimento");
      setVenc(l.data_vencimento);
    } finally {
      setSalvandoVenc(false);
    }
  };

  /** Abre o painel de confirmação já preenchido (telefone + texto). */
  const abrirEnvio = () => {
    setTelefone(parceiro?.telefone || "");
    setMensagem(montarMensagem(boleto.linha, venc || l.data_vencimento));
    setEnvioAberto(true);
  };

  /** Dispara o envio REAL via backend (Evolution API do WhatsApp Parket). */
  const confirmarEnvio = async () => {
    if (enviando) return;
    if (!telefone.replace(/\D/g, "")) { toast.error("Informe o telefone do cliente"); return; }
    if (!mensagem.trim()) { toast.error("Mensagem vazia"); return; }
    setEnviando(true);
    try {
      const r = await fetch(`${DOCUSIGN_API}/termo/cobranca/reenviar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sim_id: simId || "", telefone, mensagem }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error || "Falha no envio");
      toast.success("Cobrança enviada pelo WhatsApp");
      setEnvioAberto(false);
    } catch (e: any) {
      toast.error(e?.message || "Não consegui enviar a cobrança");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Detalhe da parcela" size="lg"
      footer={
        <>
          {l.tipo === "entrada" && !isFinal && (
            <Button variant="outline" onClick={abrirEnvio} title="Revisar e enviar a cobrança pelo WhatsApp">
              <Send size={12} /> Reenviar
            </Button>
          )}
          {/* Instrumento real da cobrança pro gestor mandar pro cliente:
              Pix copia-e-cola OU linha digitável (nunca os dois juntos). */}
          {pixEmv && (
            <Button variant="outline" onClick={() => copiarTexto(pixEmv, "Pix copia e cola")}
              title="Copia o código Pix copia e cola pra mandar pro cliente">
              <Copy size={12} /> Copiar Pix
            </Button>
          )}
          {boleto.linha && (
            <Button variant="outline" onClick={() => copiarTexto(boleto.linha!, "Linha digitável")}
              title="Copia a linha digitável do boleto pra mandar pro cliente">
              <Copy size={12} /> Copiar boleto
            </Button>
          )}
          <Button variant="outline" disabled={!podeBoleto} onClick={baixarBoleto}
            title={podeBoleto
              ? "Gera o boleto desta parcela na hora e baixa o PDF pra reenviar ao cliente"
              : "Parcela sem termo vinculado nem boleto anexado"}>
            <FileDown size={12} /> Baixar Boleto
          </Button>
          <div className="flex-1" />
          {!isFinal && (
            <Button onClick={() => { onClose(); onDarBaixa(l); }}
              title="Abre a confirmação da baixa (conta, valor, data)">
              <Wallet size={12} /> Dar baixa
            </Button>
          )}
        </>
      }>
      <div className="space-y-4">
        {/* Cabeçalho hero: contexto + status + valor grande da parcela */}
        <div className="bg-parket-panelLight border border-parket-border rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9.5px] uppercase tracking-widest text-parket-textDim font-semibold">
                {l.tipo === "entrada" ? "A receber" : "A pagar"} · Parcela {l.parcela_atual}/{l.parcela_total}
              </div>
              <div className="mt-1 text-sm font-semibold leading-snug text-parket-text">{l.descricao}</div>
            </div>
            {c && (
              <span className="inline-block px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0"
                style={{ color: c.fg, background: c.bg }}>
                {eff.replace("_", " ")}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
            <div className="text-2xl font-bold tabular-nums text-parket-accent leading-none">{fmtBRL(l.valor)}</div>
            <div className={`text-[11px] font-semibold ${atrasado ? "text-red-400" : "text-parket-textDim"}`}>
              {atrasado ? "Venceu em " : "Vence em "}{fmtDate(l.data_vencimento)}
            </div>
          </div>
        </div>

        {/* Grade de dados do lançamento */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2.5 text-[11px]">
          <Dado label="Cliente" valor={parceiro?.nome || "Sem cadastro"} />
          <Dado label="Obra" valor={obra
            ? <Link to={`/obras/${obra.id}`} onClick={onClose} className="text-parket-accent hover:underline">{obraLabel(obra.codigo, obra.nome)}</Link>
            : "Sem vínculo"} />
          <Dado label="Parcela" valor={`${l.parcela_atual}/${l.parcela_total}`} />
          <Dado label="Vencimento" destaque={atrasado} valor={
            isFinal ? fmtDate(l.data_vencimento) : (
              /* Vencimento editável: o vendedor renegocia aqui. Salvar só
                 aparece quando a data mudou (ação explícita, sem surpresa). */
              <span className="flex items-center gap-1.5">
                <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)}
                  className="bg-parket-panelLight border border-parket-border rounded px-1.5 py-0.5 text-[11px] font-semibold" />
                {vencMudou && (
                  <button onClick={salvarVencimento} disabled={salvandoVenc}
                    title={simId && boleto.id
                      ? "Grava o novo prazo e emite um boleto novo pro cliente"
                      : "Grava o novo prazo da parcela"}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-parket-accent/15 text-parket-accent font-bold text-[10px] hover:bg-parket-accent/25 disabled:opacity-50">
                    <CalendarClock size={11} /> {salvandoVenc ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </span>
            )} />
          <Dado label="Competência" valor={fmtDate(l.data_competencia)} />
          <Dado label="Forma" valor={l.forma_pagamento || "A definir"} />
          {baixado && (
            <>
              <Dado label={l.tipo === "entrada" ? "Recebido em" : "Pago em"}
                valor={l.data_pagamento ? fmtDate(l.data_pagamento) : "..."} />
              <Dado label="Valor baixado" valor={fmtBRL(l.valor_pago ?? l.valor)} />
            </>
          )}
          <div className="col-span-2 md:col-span-3">
            <Dado label="Documento" valor={<span className="break-all">{l.numero_documento || "Sem número"}</span>} />
          </div>
        </div>

        {/* Painel de confirmação do reenvio: o operador confere o número e o
            texto ANTES do disparo real via Evolution (nada sai sem revisão). */}
        {envioAberto && (
          <div className="border border-parket-accent/40 rounded p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-parket-accent font-semibold">Reenviar cobrança pelo WhatsApp</div>
            <Field label="WhatsApp do cliente (DDD + número)">
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="11987654321" />
            </Field>
            <Field label="Mensagem">
              <Textarea rows={6} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEnvioAberto(false)}>Cancelar</Button>
              <Button onClick={confirmarEnvio} disabled={enviando}>
                <Send size={12} /> {enviando ? "Enviando..." : "Confirmar envio"}
              </Button>
            </div>
          </div>
        )}

        {/* Cobrança: o instrumento de pagamento pra mandar pro cliente
            (clicar no texto também copia — atalho pro gestor financeiro) */}
        {(boleto.linha || pixEmv) && (
          <div className="border border-parket-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-parket-panelLight border-b border-parket-border">
              <span className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">Cobrança</span>
              <span className="text-[9.5px] text-parket-textDim">clique pra copiar</span>
            </div>
            {boleto.linha && (
              <div className="group flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-parket-panelLight/60 transition"
                title="Clique pra copiar a linha digitável"
                onClick={() => copiarTexto(boleto.linha!, "Linha digitável")}>
                <div className="min-w-0 flex-1">
                  <div className="text-[9.5px] uppercase tracking-wider text-parket-textDim">Linha digitável do boleto</div>
                  <div className="mt-0.5 text-[11px] font-semibold tabular-nums break-all text-parket-text">{boleto.linha}</div>
                </div>
                <Copy size={13} className="shrink-0 mt-1.5 text-parket-textDim group-hover:text-parket-accent" />
              </div>
            )}
            {pixEmv && (
              <div className="group flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-parket-panelLight/60 transition"
                title="Clique pra copiar o Pix copia e cola"
                onClick={() => copiarTexto(pixEmv, "Pix copia e cola")}>
                <div className="min-w-0 flex-1">
                  <div className="text-[9.5px] uppercase tracking-wider text-parket-textDim">Pix copia e cola</div>
                  {/* line-clamp-2: o EMV é gigante; 2 linhas bastam pra reconhecer
                      — copiar é o clique (o texto inteiro vai pro clipboard) */}
                  <div className="mt-0.5 text-[11px] font-mono break-all text-parket-text line-clamp-2">{pixEmv}</div>
                </div>
                <Copy size={13} className="shrink-0 mt-1.5 text-parket-textDim group-hover:text-parket-accent" />
              </div>
            )}
          </div>
        )}

        {/* Observações completas (histórico do watcher: aceite, boleto, baixa) */}
        {l.observacoes && (
          <div className="border border-parket-border rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1.5">Observações</div>
            {/* text/70 (não textDim): o cinza pedra sumia no fundo escuro */}
            <div className="text-[11px] text-parket-text/70 leading-relaxed whitespace-pre-wrap">{l.observacoes}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Par rótulo + valor da grade de detalhes. */
function Dado({ label, valor, destaque }: { label: string; valor: ReactNode; destaque?: boolean }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-parket-textDim">{label}</div>
      {/* Cor explícita no valor: sem ela o texto herdava tom apagado e o
          modal ficava sem contraste (Will 28/08) */}
      <div className={`font-semibold mt-0.5 ${destaque ? "text-red-400" : "text-parket-text"}`}>{valor}</div>
    </div>
  );
}
