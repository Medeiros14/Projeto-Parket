/** Visão Geral — hero, timeline da jornada (kanban do gestão),
 *  grid das etapas e sidebar de status executivo. */
import { useEffect, useState } from "react";
import { ChevronRight, AlertTriangle, MessageCircle } from "lucide-react";
import { api, type CenterData, type FinanceiroObra } from "../api";
import { type ColorScheme, getStatusStyle, serif } from "../theme";
import {
  buildStages, journeyFromKanban, proximaAcao,
  type StageInfo,
} from "../derive";

const fmtBRL = (v: number) => (Number(v) || 0)
  .toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fmtDataCard = (iso?: string | null) => {
  if (!iso) return "";
  try { return new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR"); }
  catch { return iso; }
};

function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const { bg, color } = getStatusStyle(status, isDark);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px",
      background: bg, border: `1px solid ${color}44`, fontSize: 9,
      letterSpacing: "0.12em", textTransform: "uppercase", color,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {status}
    </span>
  );
}

export type StageTab = { label: string; stage: StageInfo };

function StageCard({ numero, categoria, tabs, c, isDark, onAction }: {
  numero: string; categoria: string; tabs: StageTab[];
  c: ColorScheme; isDark: boolean;
  onAction: (s: StageInfo) => void;
}) {
  // Aba inicial: a primeira com pendência do cliente; senão a primeira.
  const [tab, setTab] = useState(() => Math.max(tabs.findIndex(t => t.stage.hasPendency), 0));
  const stage = tabs[Math.min(tab, tabs.length - 1)].stage;
  const e = stage.etapa;
  const clickable = stage.target.kind !== "none";
  return (
    <div style={{
      background: c.card1, padding: "28px 24px", display: "flex",
      flexDirection: "column", gap: 14, minHeight: 260, height: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: c.textTertiary, fontWeight: 300 }}>{numero}</span>
        <span style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: c.textTertiary }}>
          {categoria}
        </span>
      </div>

      {tabs.length > 1 && (
        <div className="stage-tabs">
          {tabs.map((t, i) => {
            const active = i === Math.min(tab, tabs.length - 1);
            return (
              <button key={t.label} onClick={() => setTab(i)} style={{
                background: "none", cursor: "pointer", padding: "5px 10px",
                border: `1px solid ${active ? c.accent : c.border1}`,
                color: active ? c.accent : c.textTertiary,
                fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: 5,
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {t.label}
                {t.stage.hasPendency && (
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: isDark ? "#C8922A" : "#8A6010", flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div>
        <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 400, color: c.textPrimary, lineHeight: 1.15, marginBottom: 4 }}>
          {e.titulo}
        </div>
        <div style={{ fontSize: 11, color: c.textTertiary }}>{e.subtitulo}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <StatusBadge status={stage.status} isDark={isDark} />
        {stage.hasPendency && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: isDark ? "#C8922A" : "#8A6010" }}>
            <AlertTriangle size={10} strokeWidth={1.5} />
            Ação necessária
          </span>
        )}
      </div>

      <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.65, margin: 0 }}>
        {e.descricao}
      </p>

      {stage.micros.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {stage.micros.map(m => (
            <span key={m} style={{
              fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase",
              color: c.textTertiary, padding: "2px 6px", border: `1px solid ${c.border1}`,
            }}>{m}</span>
          ))}
        </div>
      )}

      <div style={{ marginTop: "auto" }}>
        {clickable && (
          <button onClick={() => onAction(stage)} style={{
            background: "none", border: "none", cursor: "pointer", display: "flex",
            alignItems: "center", gap: 6, fontSize: 10, letterSpacing: "0.12em",
            textTransform: "uppercase", color: c.accent, padding: "4px 0 0",
          }}>
            {stage.action}
            <ChevronRight size={11} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

export function DashboardView({ data, c, isDark, onOpenDoc, onViewCronograma, onViewAcompanhamento, onViewAvaliacao, onViewFinanceiro, token }: {
  data: CenterData; c: ColorScheme; isDark: boolean;
  onOpenDoc: (etapa: number) => void;
  onViewCronograma: () => void;
  onViewAcompanhamento: () => void;
  onViewAvaliacao: () => void;
  onViewFinanceiro: () => void;
  token?: string;
}) {
  // Teaser do card Financeiro — chama o mesmo endpoint que a view detalhada,
  // mas ignora o erro (sem obra vinculada = card mostra estado neutro).
  const [fin, setFin] = useState<FinanceiroObra | null>(null);
  useEffect(() => {
    if (!token) return;
    let ativo = true;
    api.financeiro(token).then(f => { if (ativo) setFin(f); }).catch(() => {});
    return () => { ativo = false; };
  }, [token]);
  const heroBg = isDark
    ? "linear-gradient(180deg, #0D0906 0%, #080502 55%, #0A0704 100%)"
    : "linear-gradient(180deg, #EDE8E0 0%, #F2EDE6 55%, #EDE8E0 100%)";

  const p = data.projeto;
  const stages = buildStages(data);
  const journey = journeyFromKanban(data);

  // Etapas 2/3/4 (vistorias + checklist) unificadas num card só com abas (Will 13/07).
  const byNum = (n: number) => stages.find(s => s.etapa.numero === n);
  const vistoriaTabs: StageTab[] = [
    { label: "Checklist de Início", n: 3 },
    { label: "Reconhecimento da Obra", n: 2 },
    { label: "Liberação de Obra", n: 4 },
  ].flatMap(t => { const s = byNum(t.n); return s ? [{ label: t.label, stage: s }] : []; });

  // Etapas 5/7 (mapeamento + projeto executivo) idem — card único "PROJETO" com abas.
  const projetoTabs: StageTab[] = [
    { label: "Mapeamento", n: 5 },
    { label: "Definições", n: 12 },
    { label: "Anteprojeto", n: 11 },
    { label: "Projeto Executivo", n: 7 },
  ].flatMap(t => { const s = byNum(t.n); return s ? [{ label: t.label, stage: s }] : []; });

  // Etapa 1 (Contratação) ganha 2 abas: os itens contratados + o financeiro da
  // obra. Como financeiro não é uma etapa do gestão (dados vêm de core.lancamentos),
  // monto um StageInfo sintético com target "financeiro" pra reusar o StageCard
  // padrão — o handleAction abaixo despacha a view certa.
  const stageContratoBase = byNum(1);
  const contratoTabs: StageTab[] = stageContratoBase ? [
    { label: "Itens Contratados", stage: stageContratoBase },
    { label: "Financeiro", stage: buildFinanceiroStage(stageContratoBase, fin) },
  ] : [];

  const cards: { categoria: string; tabs: StageTab[] }[] = [];
  for (const s of stages) {
    if (s.etapa.numero === 1 && contratoTabs.length) cards.push({ categoria: "CONTRATO", tabs: contratoTabs });
    else if (s.etapa.numero === 2) cards.push({ categoria: "VISTORIAS", tabs: vistoriaTabs });
    else if (s.etapa.numero === 5) cards.push({ categoria: "PROJETO", tabs: projetoTabs });
    else if ([3, 4, 7, 11, 12].includes(s.etapa.numero)) continue;
    else cards.push({ categoria: s.etapa.categoria, tabs: [{ label: s.etapa.titulo, stage: s }] });
  }
  const lastRowStart = cards.length - (cards.length % 3 || 3);

  const infoCards = [
    { label: "CLIENTE", value: p.cliente },
    { label: "ENDEREÇO", value: p.endereco || "—" },
    { label: "PRÓXIMA AÇÃO", value: proximaAcao(data) },
  ];

  // Abre direto o grupo WhatsApp do cliente; fallback = número oficial, sem texto padrão.
  const waUrl = p.grupo_link || "https://wa.me/5511999600222";

  const handleAction = (s: StageInfo) => {
    if (s.target.kind === "document") onOpenDoc(s.target.etapa);
    else if (s.target.kind === "cronograma") onViewCronograma();
    else if (s.target.kind === "acompanhamento") onViewAcompanhamento();
    else if (s.target.kind === "avaliacao") onViewAvaliacao();
    else if (s.target.kind === "financeiro") onViewFinanceiro();
    else if (s.target.kind === "link") window.open(s.target.url, "_blank");
  };

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{ background: heroBg, borderBottom: `1px solid ${c.border1}` }}>
        <div style={{ padding: "48px var(--pkt-pad-x) 0", textAlign: "center" }}>
          <h1 style={{ fontFamily: serif, fontSize: "clamp(32px, 8vw, 52px)", fontWeight: 300, lineHeight: 1.05, color: c.textPrimary, margin: "0 0 14px" }}>
            Central do Cliente
          </h1>
          <p style={{ fontSize: 14, color: c.textSecondary, margin: "0 auto 40px", lineHeight: 1.65, maxWidth: 560 }}>
            Uma visão clara, técnica e documentada de cada etapa da sua obra Parket.
          </p>
        </div>

        {/* Info strip */}
        <div className="pkt-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: `1px solid ${c.border1}` }}>
          {infoCards.map(card => (
            <div key={card.label} style={{ padding: "20px 24px", borderRight: `1px solid ${c.border1}` }}>
              <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 8 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 12, color: c.textPrimary, lineHeight: 1.45 }}>{card.value}</div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 24px" }}>
            <a href={waUrl} target="_blank" rel="noreferrer" style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 22px",
              background: isDark ? "#EEE9E2" : "#131313",
              color: isDark ? "#131313" : "#EEE9E2",
              border: "none", textDecoration: "none",
              fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", whiteSpace: "nowrap",
            }}>
              <MessageCircle size={13} strokeWidth={1.5} />
              Falar com a Parket
            </a>
          </div>
        </div>
      </section>

      {/* ── Progress Timeline (jornada = kanban do gestão) ── */}
      <section style={{ padding: "28px var(--pkt-pad-x)", borderBottom: `1px solid ${c.border1}`, background: c.card1 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 20 }}>
          PROGRESSO DA OBRA
        </div>
        <div className="pkt-journey-wrap">
        <div className="pkt-journey" style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
          <div style={{ position: "absolute", top: 14, left: 14, right: 14, height: 1, background: c.border2 }} />
          {journey.map((step, i) => {
            const statusLabel = step.status === "done" ? "Concluído" : step.status === "current" ? "Em andamento" : "Pendente";
            const { color } = getStatusStyle(statusLabel, isDark);
            const isDone = step.status === "done";
            const isActive = step.status === "current";
            return (
              <div key={step.id} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 10, position: "relative", zIndex: 1,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isActive ? color : isDark ? c.card1 : "#FFFFFF",
                  border: `1px solid ${isDone || isActive ? color : c.border2}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {isDone ? (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  ) : isActive ? (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: isDark ? "#050505" : "#F6F3EE" }} />
                  ) : (
                    <span style={{ fontSize: 9, color: c.textTertiary }}>{i + 1}</span>
                  )}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: c.textSecondary, marginBottom: 3, lineHeight: 1.3 }}>
                    {step.label}
                  </div>
                  <div style={{
                    fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: isDone || isActive ? color : c.textTertiary,
                  }}>
                    {statusLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="pkt-cards3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
        {cards.map((card, i) => (
          <div key={card.categoria + i} style={{
            borderRight: i % 3 < 2 ? `1px solid ${c.border1}` : "none",
            borderBottom: i < lastRowStart ? `1px solid ${c.border1}` : "none",
          }}>
            <StageCard
              numero={String(i + 1).padStart(2, "0")} categoria={card.categoria}
              tabs={card.tabs} c={c} isDark={isDark} onAction={handleAction}
            />
          </div>
        ))}
      </div>

      {/* Documentos NÃO aparecem agregados no dashboard: cada documento vive
          dentro da área que o produz (mapa dentro de Mapa, proposta dentro de
          Contratação, etc.), Will 28/08. */}
    </div>
  );
}

/* Monta um StageInfo sintético pra aba "Financeiro" do card CONTRATO,
   herdando a etapa 1 (mesma numeração/categoria) e sobrescrevendo título,
   descrição, status/micros com o resumo do financeiro (proxima parcela).
   Sem fin ainda, fica em estado neutro; se quitado, badge verde. */
function buildFinanceiroStage(base: StageInfo, fin: FinanceiroObra | null): StageInfo {
  const disponivel = !!fin?.disponivel && !!fin.totais;
  const t = fin?.totais;
  const prox = fin?.proxima || null;
  const quitado = disponivel && t && (t.pago > 0) && (t.falta <= 0.01);
  const status = !disponivel ? "Aguardando"
    : quitado ? "Quitado"
    : prox?.status === "vencido" ? "Em atraso"
    : "Em dia";
  const micros = disponivel && t
    ? [`Pago ${fmtBRL(t.pago)}`, `A pagar ${fmtBRL(t.falta)}`]
    : [];
  const descricao = !disponivel
    ? "Assim que a obra estiver contratada, seu resumo de pagamentos aparece aqui."
    : quitado
    ? "Todas as parcelas do contrato foram quitadas. Consulte os comprovantes a qualquer momento."
    : prox
    ? `Próximo pagamento de ${fmtBRL(prox.valor)}${prox.vencimento ? ` com vencimento em ${fmtDataCard(prox.vencimento)}` : ""}. Baixe o boleto ou pague por Pix na hora.`
    : "Consulte parcelas, gere boleto ou Pix e acompanhe os pagamentos já registrados.";
  // Pendência acende o pontinho da aba quando há parcela vencida.
  const hasPendency = disponivel && !quitado && prox?.status === "vencido";
  return {
    etapa: {
      ...base.etapa,
      titulo: "Financeiro",
      subtitulo: "Pagamentos, boletos e comprovantes",
      descricao,
    },
    numero: base.numero,
    status,
    micros,
    action: quitado ? "Ver comprovantes" : "Abrir financeiro",
    target: { kind: "financeiro" },
    hasPendency,
  };
}

