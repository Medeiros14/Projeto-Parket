/**
 * TecaOrcamentoWizard — passo a passo com a Teca IA (valoria_assistant) pra
 * gerar o orçamento automaticamente a partir do modal Solicitar Orçamento.
 *
 * Fluxo: seed com os dados do form → Teca entrevista o vendedor (uma pergunta
 * por vez, catálogo real via tool) → resume e pede OK → emite action
 * montar_orcamento → aqui a gente cria a solicitação pelo fluxo normal
 * (api.solicitarOrcamento) e insere a simulação pronta no banco da Valoria.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import {
  runTeca, parseActions, stripActions, buildSeedMessage,
  montarOrcamentoValoria, type MontarResultado,
} from "../../lib/tecaOrcamento";

type ChatMsg = { role: "user" | "assistant"; text: string };

export type TecaSeed = {
  cliente: string; vendedor: string;
  cidade?: string; condominio?: string; endereco?: string;
  produtos: string[]; metragem?: number | null;
  metragens_por_produto?: Record<string, number>;
  observacoes?: string;
};

export function TecaOrcamentoWizard({ seed, criarSolicitacao, onVoltar, onConcluido }: {
  seed: TecaSeed;
  /** Cria a solicitação pelo fluxo normal do modal e devolve os ids (inclusive o card da Valoria). */
  criarSolicitacao: () => Promise<{ demanda_id: string; card_orc_id: string; valoria_card_id: string | null }>;
  onVoltar: () => void;
  onConcluido: () => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fase, setFase] = useState<"chat" | "gerando" | "concluido">("chat");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<MontarResultado | null>(null);
  const [avisoValoria, setAvisoValoria] = useState<string | null>(null);

  const sessionRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, streamText, fase]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const enviar = async (message: string, mostrarNoChat: boolean) => {
    setBusy(true);
    setErro(null);
    if (mostrarNoChat) setMsgs((m) => [...m, { role: "user", text: message }]);
    setStreamText("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { sessionId, full } = await runTeca({
        message,
        sessionId: sessionRef.current,
        signal: ctrl.signal,
        onEvent: (e) => {
          if (e.type === "delta") setStreamText((cur) => (cur || "") + e.text);
        },
      });
      if (sessionId) sessionRef.current = sessionId;
      const visivel = stripActions(full);
      setStreamText(null);
      if (visivel) setMsgs((m) => [...m, { role: "assistant", text: visivel }]);

      const action = parseActions(full).find((a) => a.type === "montar_orcamento");
      if (action) await gerar(action.payload);
    } catch (e: any) {
      setStreamText(null);
      if (e?.name !== "AbortError") setErro(e?.message || "Falha ao falar com a Teca.");
    } finally {
      setBusy(false);
    }
  };

  // Seed automático ao abrir (guarda contra StrictMode double-mount)
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    void enviar(buildSeedMessage(seed), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gerar = async (payload: any) => {
    setFase("gerando");
    setErro(null);
    try {
      const r = await criarSolicitacao();
      if (r.valoria_card_id) {
        try {
          const res = await montarOrcamentoValoria(r.valoria_card_id, payload);
          setResultado(res);
        } catch (e: any) {
          setAvisoValoria(e?.message || "Falha ao montar a simulação na Valoria.");
        }
      } else {
        setAvisoValoria("Solicitação criada, mas o card na Valoria não foi gerado — o orçamentista montará manualmente com a lista abaixo.");
      }
      setFase("concluido");
    } catch (e: any) {
      setFase("chat");
      setErro(e?.message || "Falha ao criar a solicitação de orçamento.");
    }
  };

  const submit = () => {
    const text = input.trim();
    if (!text || busy || fase !== "chat") return;
    setInput("");
    void enviar(text, true);
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[320px]">
        <div className="flex items-center gap-2 text-[9px] uppercase text-hb-textDim" style={{ letterSpacing: "0.18em" }}>
          <Sparkles size={10} className="text-hb-accent" /> Teca IA · geração automática de orçamento
        </div>

        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap border ${
              m.role === "user"
                ? "bg-hb-accent/10 border-hb-accent/40 text-hb-text"
                : "bg-hb-bg/40 border-hb-border text-hb-text"
            }`}>
              {m.text}
            </div>
          </div>
        ))}

        {streamText !== null && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap border bg-hb-bg/40 border-hb-border text-hb-text">
              {stripActions(streamText) || (
                <span className="inline-flex items-center gap-1.5 text-hb-textDim">
                  <Loader2 size={10} className="animate-spin" /> Teca está pensando…
                </span>
              )}
            </div>
          </div>
        )}

        {fase === "gerando" && (
          <div className="flex items-center gap-2 px-3 py-2 border border-hb-accent/40 bg-hb-accent/10 text-[11px] text-hb-accent">
            <Loader2 size={11} className="animate-spin" /> Gerando solicitação + orçamento na Valoria…
          </div>
        )}

        {fase === "concluido" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 border border-hb-green/40 bg-hb-green/10 text-[11px] text-hb-green">
              <CheckCircle2 size={11} /> Solicitação de orçamento enviada ao orçamentista.
            </div>
            {resultado && (
              <div className="px-3 py-2 border border-hb-border bg-hb-bg/40 text-[11px] text-hb-text space-y-1">
                <div className="text-[9px] uppercase text-hb-textDim" style={{ letterSpacing: "0.14em" }}>Orçamento montado automaticamente</div>
                <div>{resultado.nItens} {resultado.nItens === 1 ? "item" : "itens"} em {resultado.nAmbientes} {resultado.nAmbientes === 1 ? "ambiente" : "ambientes"} · total <b>{fmt(resultado.total)}</b></div>
                {resultado.semPreco.length > 0 && (
                  <div className="text-hb-amber text-[10px]">
                    ⚠ Sem preço no catálogo (orçamentista precisa precificar): {resultado.semPreco.join("; ")}
                  </div>
                )}
              </div>
            )}
            {avisoValoria && (
              <div className="flex items-start gap-2 px-3 py-2 border border-hb-amber/40 bg-hb-amber/10 text-[10px] text-hb-amber">
                <AlertCircle size={11} className="shrink-0 mt-0.5" /> {avisoValoria}
              </div>
            )}
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 px-3 py-2 border border-hb-red/40 bg-hb-red/10 text-[10px] text-hb-red">
            <AlertCircle size={11} className="shrink-0 mt-0.5" /> {erro}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-hb-border bg-hb-panelLight/40">
        {fase === "concluido" ? (
          <div className="flex justify-end">
            <button type="button" onClick={onConcluido}
              className="px-4 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg inline-flex items-center gap-1.5"
              style={{ letterSpacing: "0.14em", fontWeight: 600 }}>
              <CheckCircle2 size={10} /> Concluir
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onVoltar} disabled={fase === "gerando"}
              title="Voltar ao formulário manual"
              className="px-2.5 py-1.5 text-[10px] uppercase border border-hb-border text-hb-textDim hover:text-hb-text disabled:opacity-40 inline-flex items-center gap-1"
              style={{ letterSpacing: "0.14em" }}>
              <ArrowLeft size={10} /> Voltar
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={busy ? "Teca respondendo…" : "Responda a Teca aqui…"}
              disabled={busy || fase !== "chat"}
              className="hb-orc-input flex-1"
              autoFocus
            />
            <button type="button" onClick={submit} disabled={busy || !input.trim() || fase !== "chat"}
              className="px-3 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg disabled:opacity-40 inline-flex items-center gap-1.5"
              style={{ letterSpacing: "0.14em", fontWeight: 600 }}>
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
