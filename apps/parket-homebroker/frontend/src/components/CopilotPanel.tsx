/**
 * CopilotPanel — painel lateral da IA dentro do ChatPanel.
 *  1) Botão "Analisar" → IA classifica quente/morno/frio + score + próxima ação
 *  2) Botão "Sugerir resposta" por objetivo → 3 sugestões pro SDR escolher e enviar
 *
 * A IA NUNCA envia. Apenas sugere — o SDR clica e a sugestão vai pro composer.
 */
import { useEffect, useRef, useState } from "react";
import { Bot, Sparkles, Loader2, Copy, AlertCircle, RefreshCw, X } from "lucide-react";

const AGENTE_URL = "https://agente.parket.works";

type Analise = {
  nivel: "quente" | "morno" | "frio";
  score: number;
  motivo: string;
  proxima_acao: string;
};

type Sugestao = { titulo: string; texto: string };

type Props = {
  cardId: string;
  cardCtx: {
    card_title?: string | null;
    card_subtitle?: string | null;
    slug?: string | null;
    produto_interesse?: string | null;
    metragem?: number | null;
    valor_mesa?: number | null;
    cidade?: string | null;
    responsavel?: string | null;
    // Análise IA já persistida no card.details.ia_analise
    ia_analise?: (Analise & { feita_at?: string; feita_por?: string }) | null;
  };
  messages: { direction: string; text: string | null; at?: string }[];
  onPickSuggestion: (texto: string) => void;
  onClose?: () => void;
};

const OBJETIVOS = [
  { key: "qualificar",     label: "🔍 Qualificar lead" },
  { key: "agendar visita", label: "📅 Agendar visita" },
  { key: "enviar orcamento", label: "💰 Enviar orçamento" },
  { key: "negociar",       label: "🤝 Negociar" },
  { key: "fechar",         label: "🏆 Fechar venda" },
  { key: "followup",       label: "📞 Follow-up" },
  { key: "reativar",       label: "🔥 Reativar lead frio" },
];

/**
 * Determina o PRÓXIMO objetivo da jornada baseado na etapa atual do funil.
 * Segue a sequência: triagem→qualifica→agenda visita→briefing→orçamento→proposta→negociação→fechar
 */
function objetivoAutoPelaEtapa(slug?: string | null): { key: string; label: string; razao: string } {
  const s = (slug || "").toLowerCase();
  if (!s || /lead|entrada/.test(s)) return { key: "qualificar", label: OBJETIVOS[0].label, razao: "Lead acabou de entrar — qualificar antes de tudo" };
  if (/triagem/.test(s))            return { key: "qualificar", label: OBJETIVOS[0].label, razao: "Em triagem IA — confirmar dados básicos" };
  if (/em-qualif/.test(s))          return { key: "qualificar", label: OBJETIVOS[0].label, razao: "Em qualificação — descobrir metragem, prazo e decisor" };
  if (/qualificado/.test(s))        return { key: "agendar visita", label: OBJETIVOS[1].label, razao: "Lead qualificado — próximo passo é agendar visita ao showroom" };
  if (/follow-up/.test(s))          return { key: "followup", label: OBJETIVOS[5].label, razao: "Em follow-up — reativar conversa sem ser invasivo" };
  if (/vendedor/.test(s))           return { key: "qualificar", label: OBJETIVOS[0].label, razao: "Acabou de chegar pro vendedor — quebrar o gelo e validar briefing" };
  if (/contato-inicial/.test(s))    return { key: "qualificar", label: OBJETIVOS[0].label, razao: "Contato inicial com vendedor — coletar briefing" };
  if (/em-briefing/.test(s))        return { key: "enviar orcamento", label: OBJETIVOS[2].label, razao: "Briefing em andamento — caminhar pra orçamento" };
  if (/criacao-orcamento/.test(s))  return { key: "enviar orcamento", label: OBJETIVOS[2].label, razao: "Orçamento em criação — alinhar premissas e prazo de envio" };
  if (/apresentacao-proposta/.test(s)) return { key: "negociar", label: OBJETIVOS[3].label, razao: "Proposta apresentada — sondar objeções e avançar" };
  if (/em-negociac/.test(s))        return { key: "fechar", label: OBJETIVOS[4].label, razao: "Em negociação — empurrar pro fechamento" };
  if (/nao-qualif|perda/.test(s))   return { key: "reativar", label: OBJETIVOS[6].label, razao: "Lead esfriou — tentar reativar com valor" };
  return { key: "qualificar", label: OBJETIVOS[0].label, razao: "Etapa desconhecida — começar qualificando" };
}

// Paleta brand SO Parket: Walnut/Olive/Navy.
const NIVEL_META: Record<Analise["nivel"], { color: string; bg: string; label: string }> = {
  quente: { color: "rgb(var(--hb-text))", bg: "rgba(96,84,77,0.45)",  label: "🔥 QUENTE" },
  morno:  { color: "rgb(var(--hb-text))", bg: "rgba(100,93,59,0.35)", label: "MORNO" },
  frio:   { color: "rgb(var(--hb-text))", bg: "rgba(69,87,99,0.30)",  label: "FRIO" },
};

export function CopilotPanel({ cardId, cardCtx, messages, onPickSuggestion, onClose }: Props) {
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [analiseFeitaAt, setAnaliseFeitaAt] = useState<Date | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [objetivoEscolhido, setObjetivoEscolhido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoTriggeredFor = useRef<string | null>(null);

  // Reset ao trocar de card — e carrega análise persistida se já existir
  useEffect(() => {
    setSugestoes([]); setObjetivoEscolhido(null); setError(null);
    if (cardCtx.ia_analise && cardCtx.ia_analise.nivel) {
      setAnalise({
        nivel: cardCtx.ia_analise.nivel,
        score: cardCtx.ia_analise.score,
        motivo: cardCtx.ia_analise.motivo,
        proxima_acao: cardCtx.ia_analise.proxima_acao,
      });
      setAnaliseFeitaAt(cardCtx.ia_analise.feita_at ? new Date(cardCtx.ia_analise.feita_at) : null);
    } else {
      setAnalise(null); setAnaliseFeitaAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const payloadBase = {
    card_id: cardId,
    ...cardCtx,
    mensagens: messages.slice(-15).map((m) => ({
      direction: m.direction, text: m.text || "", at: m.at,
    })),
  };

  const analisar = async () => {
    setLoadingAnalise(true);
    setError(null);
    try {
      const r = await fetch(`${AGENTE_URL}/api/hb-ia/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBase),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      setAnalise(await r.json());
      setAnaliseFeitaAt(new Date());
    } catch (e: any) {
      setError(e.message || "Erro na análise");
    } finally { setLoadingAnalise(false); }
  };

  // Objetivo automático baseado na etapa do funil
  const objetivoAuto = objetivoAutoPelaEtapa(cardCtx.slug);

  // Auto-disparo na 1ª vez por card:
  //  - Análise SÓ se não existe persistida (preserva a anterior; user clica "Atualizar" pra refazer)
  //  - Sugestões SEMPRE auto (são contextuais à conversa atual)
  useEffect(() => {
    if (!cardId) return;
    if (autoTriggeredFor.current === cardId) return;
    if (messages.length === 0) return;
    autoTriggeredFor.current = cardId;
    if (!cardCtx.ia_analise) analisar();   // ← só analisa se nunca foi analisado
    sugerir(objetivoAuto.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, messages.length]);

  const sugerir = async (objetivo: string) => {
    setLoadingSug(true);
    setObjetivoEscolhido(objetivo);
    setError(null);
    setSugestoes([]);
    try {
      const r = await fetch(`${AGENTE_URL}/api/hb-ia/suggest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payloadBase, objetivo }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const data = await r.json();
      setSugestoes(data.sugestoes || []);
    } catch (e: any) {
      setError(e.message || "Erro sugerindo");
    } finally { setLoadingSug(false); }
  };

  return (
    <div className="bg-hb-panel border border-hb-border rounded-lg h-full overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-hb-border bg-hb-panelLight flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bot size={13} className="text-hb-blue" />
          <span className="text-xs font-bold uppercase tracking-wider text-hb-blue">Copiloto IA</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-hb-textDim flex items-center gap-1 font-semibold">
            <img src="/claude-symbol.svg" alt="" className="h-3 w-3" /> Claude
          </span>
          {onClose && (
            <button
              onClick={onClose}
              title="Ocultar painel (botão flutuante reaparece no canto)"
              className="p-0.5 text-hb-textDim hover:text-hb-text"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* ANÁLISE (fixa após primeira vez) */}
        <div className="border border-hb-border bg-hb-bg/40 rounded p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-hb-textDim font-bold">Análise do lead</span>
            <button onClick={analisar} disabled={loadingAnalise}
              className="text-[10px] font-semibold text-hb-blue hover:text-hb-text inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-hb-blue/30 hover:border-hb-blue/60 transition disabled:opacity-50">
              {loadingAnalise ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              Atualizar
            </button>
          </div>
          {loadingAnalise && !analise ? (
            <div className="text-[10px] text-hb-textDim italic py-2 flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin" /> IA analisando…
            </div>
          ) : analise ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ color: NIVEL_META[analise.nivel].color, background: NIVEL_META[analise.nivel].bg }}>
                  {NIVEL_META[analise.nivel].label}
                </span>
                <span className="text-[10px] tabular text-hb-textDim">
                  score <span className="font-bold text-hb-text">{analise.score}</span>/100
                </span>
              </div>
              <div className="text-[11px] text-hb-text leading-snug">{analise.motivo}</div>
              <div className="text-[11px] bg-hb-blue/10 border border-hb-blue/30 rounded px-2 py-1.5">
                <div className="text-[9px] uppercase font-bold text-hb-blue mb-0.5">Próxima ação</div>
                <div className="text-hb-text leading-snug">{analise.proxima_acao}</div>
              </div>
              {analiseFeitaAt && (
                <div className="text-[9px] text-hb-textDim text-right">
                  análise feita às {analiseFeitaAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </>
          ) : (
            <div className="text-[10px] text-hb-textDim italic py-2">Aguardando mensagens pra IA analisar…</div>
          )}
        </div>

        {/* OBJETIVO AUTOMÁTICO (baseado na jornada) */}
        <div className="border border-hb-border bg-hb-bg/40 rounded p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-hb-textDim font-bold flex items-center gap-1">
              <Sparkles size={9} /> Sugestões consultivas
            </span>
            <button onClick={() => sugerir(objetivoEscolhido || objetivoAuto.key)} disabled={loadingSug}
              className="text-[10px] font-semibold text-hb-accent hover:text-hb-text inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-hb-accent/30 hover:border-hb-accent/60 transition disabled:opacity-50">
              {loadingSug ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              Atualizar
            </button>
          </div>

          {/* Banner do objetivo escolhido pelo funil */}
          <div className="bg-hb-accent/10 border border-hb-accent/30 rounded px-2 py-1.5">
            <div className="text-[9px] uppercase font-bold text-hb-accent">
              Próximo passo da jornada:
            </div>
            <div className="text-[11px] text-hb-text font-medium leading-snug">
              {(objetivoEscolhido && OBJETIVOS.find((o) => o.key === objetivoEscolhido)?.label) || objetivoAuto.label}
            </div>
            <div className="text-[9px] text-hb-textDim mt-0.5 leading-snug">{objetivoAuto.razao}</div>
          </div>

          {/* Pequeno seletor pra trocar manualmente */}
          <details className="text-[10px]">
            <summary className="cursor-pointer text-hb-textDim hover:text-hb-text">Mudar objetivo →</summary>
            <div className="grid grid-cols-2 gap-1 mt-1.5">
              {OBJETIVOS.map((o) => (
                <button key={o.key} onClick={() => sugerir(o.key)} disabled={loadingSug}
                  className={`text-[10px] px-2 py-1 rounded border transition text-left ${
                    (objetivoEscolhido || objetivoAuto.key) === o.key
                      ? "bg-hb-accent text-hb-bg border-hb-accent"
                      : "border-hb-border text-hb-textDim hover:text-hb-text hover:border-hb-accent/40"
                  } disabled:opacity-50`}>
                  {o.label}
                </button>
              ))}
            </div>
          </details>

          {loadingSug && sugestoes.length === 0 && (
            <div className="text-center py-3 text-hb-textDim text-[10px]">
              <Loader2 size={12} className="animate-spin inline mr-1" /> IA pensando…
            </div>
          )}

          <div className="space-y-2">
            {sugestoes.map((s, i) => (
              <div key={i} className="bg-hb-bg border border-hb-border rounded p-2 hover:border-hb-accent/60 transition">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-hb-accent">
                    💡 {s.titulo}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigator.clipboard.writeText(s.texto)}
                      title="Copiar"
                      className="text-hb-textDim hover:text-hb-text p-0.5">
                      <Copy size={9} />
                    </button>
                    <button onClick={() => onPickSuggestion(s.texto)}
                      className="text-[9px] uppercase font-bold tracking-wider bg-hb-accent text-hb-bg rounded px-1.5 py-0.5 hover:bg-hb-gold">
                      Usar →
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-hb-text whitespace-pre-wrap leading-snug">{s.texto}</div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-[10px] text-hb-red bg-hb-red/10 border border-hb-red/30 rounded px-2 py-1.5 flex items-start gap-1">
            <AlertCircle size={10} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
