import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  universalBlocks,
  areas,
  aiAgentQuestions,
  deliveryItems,
  UNIVERSAL_COUNT,
  AI_AGENT_COUNT,
  DELIVERY_COUNT,
  type AreaDef,
  type AreaQuestion,
  type AIQuestion,
} from "../components/area-interview-data";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Download,
  RotateCcw,
  Menu,
  X,
  ChevronRight,
  Wrench,
} from "lucide-react";

/* ─── Design tokens ─── */
const ACCENT = "#B8AA9A";
const BG = "#0A0A0A";
const CARD_BG = "rgba(255,255,255,0.02)";
const BORDER = "rgba(255,255,255,0.06)";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";

/* ─── Storage key ─── */
const STORAGE_KEY = "parket-area-interviews";

/* ─── Tag badge colors ─── */
const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  brutal: { bg: "rgba(220,80,60,0.15)", color: "#E87C6C" },
  processo: { bg: "rgba(100,150,220,0.15)", color: "#7CA8D4" },
  governança: { bg: "rgba(160,120,200,0.15)", color: "#B490D0" },
  maturidade: { bg: "rgba(200,160,80,0.15)", color: "#C8A854" },
  destrava: { bg: "rgba(100,180,120,0.15)", color: "#7BC48A" },
  sistema: { bg: "rgba(100,150,220,0.15)", color: "#7CA8D4" },
};

/* ═══════════════════════════════════════════════════════════ */
/* ─── State Types ─── */
interface AnswerState {
  text: string;
  stuck: boolean;
}

interface AreaState {
  universal: Record<number, AnswerState>;
  specific: Record<number, AnswerState>;
  aiAgent: Record<number, AnswerState>;
  deliveries: Record<string, string>;
}

interface AllState {
  areas: Record<string, AreaState>;
}

function getDefaultAnswer(): AnswerState {
  return { text: "", stuck: false };
}

function getEmptyArea(): AreaState {
  return { universal: {}, specific: {}, aiAgent: {}, deliveries: {} };
}

/* ═══════════════════════════════════════════════════════════ */

type SectionView = "overview" | "universal" | "specific" | "ai-agent" | "deliveries";

export function AreaInterviewPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<AllState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { areas: {} };
  });
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<SectionView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [universalBlockIdx, setUniversalBlockIdx] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  /* save to localStorage */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  /* scroll to top on view/area change */
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setSidebarOpen(false);
  }, [selectedArea, activeView, universalBlockIdx]);

  /* area state helpers */
  const getAreaState = useCallback(
    (areaId: string): AreaState => state.areas[areaId] || getEmptyArea(),
    [state.areas]
  );

  const updateUniversal = (areaId: string, qId: number, field: "text" | "stuck", value: string | boolean) => {
    setState((prev) => {
      const area = prev.areas[areaId] || getEmptyArea();
      return {
        ...prev,
        areas: {
          ...prev.areas,
          [areaId]: {
            ...area,
            universal: {
              ...area.universal,
              [qId]: { ...(area.universal[qId] || getDefaultAnswer()), [field]: value },
            },
          },
        },
      };
    });
  };

  const updateSpecific = (areaId: string, qId: number, field: "text" | "stuck", value: string | boolean) => {
    setState((prev) => {
      const area = prev.areas[areaId] || getEmptyArea();
      return {
        ...prev,
        areas: {
          ...prev.areas,
          [areaId]: {
            ...area,
            specific: {
              ...area.specific,
              [qId]: { ...(area.specific[qId] || getDefaultAnswer()), [field]: value },
            },
          },
        },
      };
    });
  };

  const updateAiAgent = (areaId: string, qId: number, field: "text" | "stuck", value: string | boolean) => {
    setState((prev) => {
      const area = prev.areas[areaId] || getEmptyArea();
      return {
        ...prev,
        areas: {
          ...prev.areas,
          [areaId]: {
            ...area,
            aiAgent: {
              ...area.aiAgent,
              [qId]: { ...(area.aiAgent[qId] || getDefaultAnswer()), [field]: value },
            },
          },
        },
      };
    });
  };

  const updateDelivery = (areaId: string, deliveryId: string, value: string) => {
    setState((prev) => {
      const area = prev.areas[areaId] || getEmptyArea();
      return {
        ...prev,
        areas: {
          ...prev.areas,
          [areaId]: {
            ...area,
            deliveries: { ...area.deliveries, [deliveryId]: value },
          },
        },
      };
    });
  };

  const resetArea = (areaId: string) => {
    setState((prev) => ({
      ...prev,
      areas: { ...prev.areas, [areaId]: getEmptyArea() },
    }));
    setShowResetConfirm(false);
  };

  const resetAll = () => {
    setState({ areas: {} });
    setShowResetConfirm(false);
    setSelectedArea(null);
    setActiveView("overview");
  };

  /* progress calculation */
  const areaProgress = (areaId: string): {
    universalDone: number;
    specificDone: number;
    aiDone: number;
    deliveriesDone: number;
    total: number;
    max: number;
    pct: number;
    stuckCount: number;
  } => {
    const as = getAreaState(areaId);
    const areaDef = areas.find((a) => a.id === areaId);
    const specificCount = areaDef?.questions.length || 0;

    const universalDone = Object.values(as.universal).filter((a) => a.text.trim().length > 0).length;
    const specificDone = Object.values(as.specific).filter((a) => a.text.trim().length > 0).length;
    const aiDone = Object.values(as.aiAgent).filter((a) => a.text.trim().length > 0).length;
    const deliveriesDone = Object.values(as.deliveries).filter((t) => t.trim().length > 0).length;
    const total = universalDone + specificDone + aiDone + deliveriesDone;
    const max = UNIVERSAL_COUNT + specificCount + AI_AGENT_COUNT + DELIVERY_COUNT;
    const pct = max > 0 ? Math.round((total / max) * 100) : 0;
    const stuckCount =
      Object.values(as.universal).filter((a) => a.stuck).length +
      Object.values(as.specific).filter((a) => a.stuck).length +
      Object.values(as.aiAgent).filter((a) => a.stuck).length;

    return { universalDone, specificDone, aiDone, deliveriesDone, total, max, pct, stuckCount };
  };

  const globalProgress = (): { totalDone: number; totalMax: number; pct: number } => {
    let totalDone = 0;
    let totalMax = 0;
    for (const area of areas) {
      const p = areaProgress(area.id);
      totalDone += p.total;
      totalMax += p.max;
    }
    return { totalDone, totalMax, pct: totalMax > 0 ? Math.round((totalDone / totalMax) * 100) : 0 };
  };

  const gp = globalProgress();
  const currentArea = selectedArea ? areas.find((a) => a.id === selectedArea) : null;
  const currentProgress = selectedArea ? areaProgress(selectedArea) : null;

  /* export */
  const exportText = () => {
    let text = "PARKET PISOS — ENTREVISTAS POR ÁREA · WORKBOOK COMPLETO\n";
    text += "═".repeat(65) + "\n\n";

    for (const area of areas) {
      const as = getAreaState(area.id);
      const prog = areaProgress(area.id);
      if (prog.total === 0) continue;

      text += `\n${"█".repeat(65)}\n`;
      text += `${area.icon} ${area.name.toUpperCase()} (${prog.pct}% completo)\n`;
      text += `${area.subtitle}\n`;
      text += `${"█".repeat(65)}\n`;

      // Universal
      text += `\n${"─".repeat(55)}\nPERGUNTAS UNIVERSAIS\n${"─".repeat(55)}\n\n`;
      for (const block of universalBlocks) {
        text += `\n${block.title}\n`;
        for (const q of block.questions) {
          const a = as.universal[q.id] || getDefaultAnswer();
          text += `  ${q.id}. ${q.text}\n`;
          if (a.stuck) text += `    ⚠️ TRAVEI AQUI\n`;
          text += `    → ${a.text || "(sem resposta)"}\n\n`;
        }
      }

      // Specific
      text += `\n${"─".repeat(55)}\nPERGUNTAS ESPECÍFICAS — ${area.name}\n${"─".repeat(55)}\n\n`;
      for (const q of area.questions) {
        const a = as.specific[q.id] || getDefaultAnswer();
        text += `  ${q.id}. ${q.text}\n`;
        if (a.stuck) text += `    ⚠️ TRAVEI AQUI\n`;
        text += `    → ${a.text || "(sem resposta)"}\n\n`;
      }

      // AI Agent
      text += `\n${"─".repeat(55)}\nDESIGN DO AGENTE IA — ${area.name}\n${"─".repeat(55)}\n\n`;
      for (const q of aiAgentQuestions) {
        const a = as.aiAgent[q.id] || getDefaultAnswer();
        text += `  ${q.id}. ${q.text}\n`;
        if (a.stuck) text += `    ⚠️ TRAVEI AQUI\n`;
        text += `    → ${a.text || "(sem resposta)"}\n\n`;
      }

      // Deliveries
      text += `\n${"─".repeat(55)}\nENTREGAS OBRIGATÓRIAS\n${"─".repeat(55)}\n\n`;
      for (const d of deliveryItems) {
        text += `  • ${d.label}\n`;
        text += `    → ${as.deliveries[d.id] || "(sem resposta)"}\n\n`;
      }

      // Tool
      text += `  Ferramenta de gestão sugerida:\n  ${area.toolSummary}\n\n`;
    }

    text += `\nProgresso total: ${gp.pct}% (${gp.totalDone}/${gp.totalMax})\n`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "parket-entrevistas-areas.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ═══ QUESTION CARD ═══ */
  const renderQuestion = (
    q: AreaQuestion | AIQuestion,
    answer: AnswerState,
    onUpdate: (field: "text" | "stuck", value: string | boolean) => void,
    prefix?: string
  ) => {
    const answered = answer.text.trim().length > 0;
    const tag = "tag" in q ? q.tag : undefined;
    const tagStyle = tag ? TAG_COLORS[tag] : null;

    return (
      <div
        key={`${prefix}-${q.id}`}
        className="rounded-xl p-5 sm:p-6 transition-all duration-300"
        style={{
          background: answer.stuck
            ? "rgba(220,80,60,0.04)"
            : answered
            ? "rgba(100,180,120,0.03)"
            : CARD_BG,
          border: `1px solid ${
            answer.stuck ? "rgba(220,80,60,0.2)" : answered ? "rgba(100,180,120,0.12)" : BORDER
          }`,
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          <span
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
            style={{
              background: answered ? "rgba(100,180,120,0.15)" : "rgba(184,170,154,0.1)",
              fontSize: "0.65rem",
              fontWeight: 600,
              color: answered ? "#7BC48A" : ACCENT,
            }}
          >
            {q.id}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white" style={{ fontSize: "0.88rem", lineHeight: 1.5, fontWeight: 500 }}>
              {q.text}
            </p>
            {q.hint && (
              <p className="mt-1.5" style={{ fontSize: "0.72rem", lineHeight: 1.5, color: TEXT_DIM }}>
                {q.hint}
              </p>
            )}
          </div>
          {tag && tagStyle && (
            <span
              className="rounded-full px-2 py-0.5 uppercase tracking-widest shrink-0"
              style={{ fontSize: "0.5rem", fontWeight: 600, background: tagStyle.bg, color: tagStyle.color }}
            >
              {tag}
            </span>
          )}
        </div>

        <textarea
          value={answer.text}
          onChange={(e) => onUpdate("text", e.target.value)}
          placeholder="Responda aqui — cite exemplo real da última semana..."
          rows={3}
          className="w-full rounded-lg px-4 py-3 resize-y outline-none transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${BORDER}`,
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.8rem",
            lineHeight: 1.65,
            minHeight: "70px",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(184,170,154,0.3)";
            e.target.style.boxShadow = "0 0 0 1px rgba(184,170,154,0.15)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = BORDER;
            e.target.style.boxShadow = "none";
          }}
        />

        <button
          onClick={() => onUpdate("stuck", !answer.stuck)}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200"
          style={{
            fontSize: "0.65rem",
            fontWeight: 500,
            background: answer.stuck ? "rgba(220,80,60,0.12)" : "rgba(255,255,255,0.03)",
            color: answer.stuck ? "#E87C6C" : TEXT_DIM,
            border: `1px solid ${answer.stuck ? "rgba(220,80,60,0.2)" : "transparent"}`,
          }}
        >
          <AlertTriangle size={11} />
          {answer.stuck ? "Travei aqui — buraco identificado" : "Marcar como \"travei aqui\""}
        </button>
      </div>
    );
  };

  /* ═══ SIDEBAR ═══ */
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 mb-4 transition-colors"
          style={{ color: TEXT_DIM, fontSize: "0.7rem" }}
        >
          <ArrowLeft size={14} />
          <span className="tracking-wider uppercase">Hub</span>
        </button>
        <h2 className="text-white" style={{ fontSize: "0.95rem", fontWeight: 600, lineHeight: 1.3 }}>
          Entrevistas por Área
        </h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM, lineHeight: 1.5 }} className="mt-1">
          13 áreas · Workshop 60-90 min
        </p>

        {/* Global progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Progresso geral</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: ACCENT }}>{gp.pct}%</span>
          </div>
          <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${gp.pct}%`, background: ACCENT }}
            />
          </div>
          <span style={{ fontSize: "0.55rem", color: TEXT_DIM }} className="mt-1.5 block">
            {gp.totalDone}/{gp.totalMax} respostas
          </span>
        </div>
      </div>

      <div className="h-px mx-4 my-2" style={{ background: BORDER }} />

      {/* Area list */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Overview button */}
        <button
          onClick={() => { setSelectedArea(null); setActiveView("overview"); }}
          className="w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-all duration-200"
          style={{
            background: !selectedArea ? "rgba(184,170,154,0.1)" : "transparent",
            border: !selectedArea ? "1px solid rgba(184,170,154,0.15)" : "1px solid transparent",
          }}
        >
          <span
            className="flex items-center gap-2"
            style={{
              fontSize: "0.75rem",
              fontWeight: !selectedArea ? 600 : 400,
              color: !selectedArea ? "white" : TEXT_MED,
            }}
          >
            📋 Visão Geral
          </span>
        </button>

        <div className="h-px mx-2 my-2" style={{ background: BORDER }} />

        {/* Areas */}
        {areas.map((area) => {
          const prog = areaProgress(area.id);
          const isActive = selectedArea === area.id;
          return (
            <button
              key={area.id}
              onClick={() => { setSelectedArea(area.id); setActiveView("overview"); setUniversalBlockIdx(0); }}
              className="w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-all duration-200"
              style={{
                background: isActive ? "rgba(184,170,154,0.1)" : "transparent",
                border: isActive ? "1px solid rgba(184,170,154,0.15)" : "1px solid transparent",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex items-center gap-2 min-w-0"
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "white" : TEXT_MED,
                  }}
                >
                  <span style={{ fontSize: "0.75rem" }}>{area.icon}</span>
                  <span className="truncate">{area.name}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {prog.stuckCount > 0 && <AlertTriangle size={10} style={{ color: "#E87C6C" }} />}
                  {prog.pct === 100 ? (
                    <CheckCircle2 size={12} style={{ color: "#7BC48A" }} />
                  ) : prog.pct > 0 ? (
                    <span style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600 }}>{prog.pct}%</span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-3 space-y-2" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={exportText}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-200"
          style={{
            background: "rgba(184,170,154,0.12)",
            color: ACCENT,
            fontSize: "0.72rem",
            fontWeight: 500,
            border: "1px solid rgba(184,170,154,0.2)",
          }}
        >
          <Download size={13} /> Exportar Tudo
        </button>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg"
          style={{ color: TEXT_DIM, fontSize: "0.65rem" }}
        >
          <RotateCcw size={11} /> Recomeçar
        </button>
      </div>
    </div>
  );

  /* ═══ SECTION NAV TABS (inside area) ═══ */
  const renderAreaTabs = () => {
    if (!selectedArea || !currentArea || !currentProgress) return null;
    const tabs: { id: SectionView; label: string; count: number; done: number }[] = [
      { id: "overview", label: "Resumo", count: 0, done: 0 },
      { id: "universal", label: "Universais", count: UNIVERSAL_COUNT, done: currentProgress.universalDone },
      { id: "specific", label: currentArea.name, count: currentArea.questions.length, done: currentProgress.specificDone },
      { id: "ai-agent", label: "Agente IA", count: AI_AGENT_COUNT, done: currentProgress.aiDone },
      { id: "deliveries", label: "Entregas", count: DELIVERY_COUNT, done: currentProgress.deliveriesDone },
    ];

    return (
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {tabs.map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveView(tab.id); setUniversalBlockIdx(0); }}
              className="shrink-0 px-3 py-2 rounded-lg transition-all duration-200"
              style={{
                background: isActive ? "rgba(184,170,154,0.12)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isActive ? "rgba(184,170,154,0.2)" : BORDER}`,
                fontSize: "0.7rem",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "white" : TEXT_MED,
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="ml-1.5"
                  style={{
                    fontSize: "0.55rem",
                    color: tab.done === tab.count ? "#7BC48A" : ACCENT,
                    fontWeight: 600,
                  }}
                >
                  {tab.done}/{tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  /* ═══ MAIN RENDER ═══ */
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: "rgba(10,10,10,0.9)", border: `1px solid ${BORDER}` }}
      >
        {sidebarOpen ? <X size={18} className="text-white" /> : <Menu size={18} className="text-white" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "rgba(10,10,10,0.98)",
          borderRight: `1px solid ${BORDER}`,
          backdropFilter: "blur(12px)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Content */}
      <main ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12 lg:py-16">

          {/* ═══ GLOBAL OVERVIEW ═══ */}
          {!selectedArea && (
            <div className="space-y-8">
              <div>
                <p className="tracking-[0.3em] uppercase mb-3" style={{ fontSize: "0.55rem", color: ACCENT }}>
                  Parket Pisos · Entrevistas Operacionais
                </p>
                <h1
                  className="text-white"
                  style={{ fontSize: "clamp(1.6rem, 5vw, 2.2rem)", fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em" }}
                >
                  Entrevistas por Área
                </h1>
                <p className="mt-3" style={{ fontSize: "0.9rem", color: TEXT_MED, lineHeight: 1.7 }}>
                  13 áreas · 40 universais + específicas + 8 IA por área · 8 entregas obrigatórias por entrevista.
                </p>
              </div>

              {/* Rules */}
              <div
                className="rounded-xl p-6 sm:p-8"
                style={{ background: "rgba(184,170,154,0.04)", border: "1px solid rgba(184,170,154,0.12)" }}
              >
                <h2 className="text-white mb-5" style={{ fontSize: "1rem", fontWeight: 600 }}>
                  Como rodar isso sem virar conversa improdutiva
                </h2>
                <div className="space-y-4">
                  {[
                    { n: "1", text: "Entrevista por área: 60 a 90 minutos, com alguém do processo e alguém \"cliente interno\" da área.", accent: false },
                    { n: "2", text: "Saída obrigatória: 1 mapa de fluxo, 1 lista de handoffs, 1 checklist de entrada, 1 de saída, 1 SLA, 5 métricas, 10 exceções, 1 proposta de agente IA.", accent: true },
                    { n: "3", text: "Regra: toda resposta precisa citar um exemplo real da última semana.", accent: true },
                    { n: "4", text: "Use as perguntas universais em toda entrevista + as específicas da área + o bloco de IA no final.", accent: false },
                  ].map((rule) => (
                    <div key={rule.n} className="flex items-start gap-4">
                      <span
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{
                          background: rule.accent ? "rgba(184,170,154,0.15)" : "rgba(255,255,255,0.05)",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          color: rule.accent ? ACCENT : TEXT_MED,
                        }}
                      >
                        {rule.n}
                      </span>
                      <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "rgba(255,255,255,0.7)" }}>
                        {rule.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Area cards */}
              <div>
                <h3 className="text-white mb-4" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  13 Áreas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {areas.map((area) => {
                    const prog = areaProgress(area.id);
                    return (
                      <button
                        key={area.id}
                        onClick={() => { setSelectedArea(area.id); setActiveView("overview"); }}
                        className="text-left rounded-xl px-4 py-4 transition-all duration-200 group"
                        style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
                      >
                        <div className="flex items-start gap-3">
                          <span style={{ fontSize: "1.2rem" }}>{area.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span
                                className="block text-white group-hover:text-[#B8AA9A] transition-colors truncate"
                                style={{ fontSize: "0.82rem", fontWeight: 500 }}
                              >
                                {area.name}
                              </span>
                              <ChevronRight size={14} style={{ color: TEXT_DIM }} className="shrink-0 ml-2" />
                            </div>
                            <span className="block mt-0.5" style={{ fontSize: "0.65rem", color: TEXT_DIM }}>
                              {area.subtitle}
                            </span>
                            <span className="block mt-0.5" style={{ fontSize: "0.6rem", color: TEXT_DIM }}>
                              {UNIVERSAL_COUNT + area.questions.length + AI_AGENT_COUNT} perguntas + {DELIVERY_COUNT} entregas
                            </span>

                            {/* Mini progress */}
                            {prog.pct > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${prog.pct}%`, background: prog.pct === 100 ? "#7BC48A" : ACCENT }}
                                  />
                                </div>
                                <span style={{ fontSize: "0.55rem", fontWeight: 600, color: prog.pct === 100 ? "#7BC48A" : ACCENT }}>
                                  {prog.pct}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ AREA VIEW ═══ */}
          {selectedArea && currentArea && currentProgress && (
            <div className="space-y-6">
              {/* Area header */}
              <div>
                <button
                  onClick={() => { setSelectedArea(null); setActiveView("overview"); }}
                  className="flex items-center gap-2 mb-4 transition-colors"
                  style={{ color: TEXT_DIM, fontSize: "0.7rem" }}
                >
                  <ArrowLeft size={14} />
                  <span className="tracking-wider uppercase">Todas as áreas</span>
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <span style={{ fontSize: "1.5rem" }}>{currentArea.icon}</span>
                  <div>
                    <h1 className="text-white" style={{ fontSize: "clamp(1.4rem, 5vw, 2rem)", fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
                      {currentArea.name}
                    </h1>
                    <p style={{ fontSize: "0.8rem", color: TEXT_MED }}>{currentArea.subtitle}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${currentProgress.pct}%`, background: currentProgress.pct === 100 ? "#7BC48A" : ACCENT }}
                    />
                  </div>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: currentProgress.pct === 100 ? "#7BC48A" : ACCENT }}>
                    {currentProgress.pct}%
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>
                    {currentProgress.total}/{currentProgress.max} respostas
                  </span>
                  {currentProgress.stuckCount > 0 && (
                    <span className="flex items-center gap-1" style={{ fontSize: "0.55rem", color: "#E87C6C" }}>
                      <AlertTriangle size={9} /> {currentProgress.stuckCount} buraco{currentProgress.stuckCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              {renderAreaTabs()}

              {/* ─── OVERVIEW TAB ─── */}
              {activeView === "overview" && (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Universais", done: currentProgress.universalDone, total: UNIVERSAL_COUNT, view: "universal" as SectionView },
                      { label: currentArea.name, done: currentProgress.specificDone, total: currentArea.questions.length, view: "specific" as SectionView },
                      { label: "Agente IA", done: currentProgress.aiDone, total: AI_AGENT_COUNT, view: "ai-agent" as SectionView },
                      { label: "Entregas", done: currentProgress.deliveriesDone, total: DELIVERY_COUNT, view: "deliveries" as SectionView },
                    ].map((s) => (
                      <button
                        key={s.label}
                        onClick={() => setActiveView(s.view)}
                        className="rounded-xl p-4 text-left transition-all duration-200 group"
                        style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
                      >
                        <span className="block text-white group-hover:text-[#B8AA9A] transition-colors" style={{ fontSize: "1.3rem", fontWeight: 600 }}>
                          {s.done}<span style={{ fontSize: "0.7rem", color: TEXT_DIM }}>/{s.total}</span>
                        </span>
                        <span style={{ fontSize: "0.62rem", color: TEXT_DIM }}>{s.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Tool summary */}
                  <div
                    className="rounded-xl p-5"
                    style={{ background: "rgba(184,170,154,0.04)", border: "1px solid rgba(184,170,154,0.12)" }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench size={14} style={{ color: ACCENT }} />
                      <h3 style={{ fontSize: "0.8rem", fontWeight: 600, color: "white" }}>Ferramenta de Gestão Sugerida</h3>
                    </div>
                    <p style={{ fontSize: "0.78rem", lineHeight: 1.6, color: TEXT_MED }}>{currentArea.toolSummary}</p>
                  </div>

                  {/* Start button */}
                  <button
                    onClick={() => { setActiveView("universal"); setUniversalBlockIdx(0); }}
                    className="w-full py-4 rounded-xl transition-all duration-200"
                    style={{
                      background: "linear-gradient(135deg, rgba(184,170,154,0.2) 0%, rgba(184,170,154,0.08) 100%)",
                      border: "1px solid rgba(184,170,154,0.25)",
                      color: "white",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      letterSpacing: "0.05em",
                    }}
                  >
                    Começar Entrevista →
                  </button>
                </div>
              )}

              {/* ─── UNIVERSAL QUESTIONS TAB ─── */}
              {activeView === "universal" && (
                <div className="space-y-6">
                  {/* Block selector */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {universalBlocks.map((block, idx) => {
                      const blockDone = block.questions.filter(
                        (q) => (getAreaState(selectedArea).universal[q.id]?.text || "").trim().length > 0
                      ).length;
                      const isActive = universalBlockIdx === idx;
                      return (
                        <button
                          key={block.id}
                          onClick={() => setUniversalBlockIdx(idx)}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg transition-all duration-200"
                          style={{
                            background: isActive ? "rgba(184,170,154,0.12)" : "rgba(255,255,255,0.02)",
                            border: `1px solid ${isActive ? "rgba(184,170,154,0.2)" : BORDER}`,
                            fontSize: "0.62rem",
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? "white" : TEXT_DIM,
                          }}
                        >
                          1.{idx + 1}
                          {blockDone === block.questions.length && <CheckCircle2 size={9} className="inline ml-1" style={{ color: "#7BC48A" }} />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active block */}
                  {(() => {
                    const block = universalBlocks[universalBlockIdx];
                    const as = getAreaState(selectedArea);
                    return (
                      <div className="space-y-5">
                        <div className="mb-4">
                          <span className="uppercase tracking-widest" style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600 }}>
                            Perguntas Universais · Bloco {universalBlockIdx + 1} de {universalBlocks.length}
                          </span>
                          <h2 className="text-white mt-2" style={{ fontSize: "1.2rem", fontWeight: 600, lineHeight: 1.2 }}>
                            {block.title}
                          </h2>
                          <p style={{ fontSize: "0.82rem", color: TEXT_MED, lineHeight: 1.5 }} className="mt-1">
                            {block.subtitle}
                          </p>
                        </div>

                        {block.questions.map((q) =>
                          renderQuestion(
                            q,
                            as.universal[q.id] || getDefaultAnswer(),
                            (field, value) => updateUniversal(selectedArea, q.id, field, value),
                            "u"
                          )
                        )}

                        {/* Block nav */}
                        <div className="flex items-center justify-between pt-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                          <button
                            onClick={() => {
                              if (universalBlockIdx > 0) setUniversalBlockIdx(universalBlockIdx - 1);
                              else setActiveView("overview");
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
                            style={{ fontSize: "0.75rem", color: TEXT_MED, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}
                          >
                            <ChevronUp size={14} />
                            {universalBlockIdx > 0 ? `1.${universalBlockIdx}` : "Resumo"}
                          </button>
                          <button
                            onClick={() => {
                              if (universalBlockIdx < universalBlocks.length - 1) setUniversalBlockIdx(universalBlockIdx + 1);
                              else setActiveView("specific");
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              color: "white",
                              background: "rgba(184,170,154,0.12)",
                              border: "1px solid rgba(184,170,154,0.2)",
                            }}
                          >
                            {universalBlockIdx < universalBlocks.length - 1 ? `1.${universalBlockIdx + 2}` : `Específicas ${currentArea.name}`}
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ─── SPECIFIC QUESTIONS TAB ─── */}
              {activeView === "specific" && (
                <div className="space-y-5">
                  <div className="mb-4">
                    <span className="uppercase tracking-widest" style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600 }}>
                      Perguntas Específicas
                    </span>
                    <h2 className="text-white mt-2" style={{ fontSize: "1.2rem", fontWeight: 600, lineHeight: 1.2 }}>
                      {currentArea.icon} {currentArea.name}
                    </h2>
                    <p style={{ fontSize: "0.82rem", color: TEXT_MED }} className="mt-1">{currentArea.subtitle}</p>
                  </div>

                  {currentArea.questions.map((q) => {
                    const as = getAreaState(selectedArea);
                    return renderQuestion(
                      q,
                      as.specific[q.id] || getDefaultAnswer(),
                      (field, value) => updateSpecific(selectedArea, q.id, field, value),
                      "s"
                    );
                  })}

                  {/* Nav */}
                  <div className="flex items-center justify-between pt-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <button
                      onClick={() => { setActiveView("universal"); setUniversalBlockIdx(universalBlocks.length - 1); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
                      style={{ fontSize: "0.75rem", color: TEXT_MED, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}
                    >
                      <ChevronUp size={14} /> Universais 1.8
                    </button>
                    <button
                      onClick={() => setActiveView("ai-agent")}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: "white",
                        background: "rgba(184,170,154,0.12)",
                        border: "1px solid rgba(184,170,154,0.2)",
                      }}
                    >
                      Design Agente IA <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ─── AI AGENT TAB ─── */}
              {activeView === "ai-agent" && (
                <div className="space-y-5">
                  <div className="mb-4">
                    <span className="uppercase tracking-widest" style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600 }}>
                      Design do Agente IA · {currentArea.name}
                    </span>
                    <h2 className="text-white mt-2" style={{ fontSize: "1.2rem", fontWeight: 600 }}>
                      🤖 Agente IA — {currentArea.name}
                    </h2>
                    <p style={{ fontSize: "0.82rem", color: TEXT_MED }} className="mt-1">
                      8 perguntas para desenhar o agente de IA que protege, valida e reporta nesta área.
                    </p>
                  </div>

                  {aiAgentQuestions.map((q) => {
                    const as = getAreaState(selectedArea);
                    return renderQuestion(
                      q,
                      as.aiAgent[q.id] || getDefaultAnswer(),
                      (field, value) => updateAiAgent(selectedArea, q.id, field, value),
                      "ai"
                    );
                  })}

                  {/* Nav */}
                  <div className="flex items-center justify-between pt-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <button
                      onClick={() => setActiveView("specific")}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
                      style={{ fontSize: "0.75rem", color: TEXT_MED, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}
                    >
                      <ChevronUp size={14} /> Específicas
                    </button>
                    <button
                      onClick={() => setActiveView("deliveries")}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: "white",
                        background: "rgba(184,170,154,0.12)",
                        border: "1px solid rgba(184,170,154,0.2)",
                      }}
                    >
                      Entregas Obrigatórias <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ─── DELIVERIES TAB ─── */}
              {activeView === "deliveries" && (
                <div className="space-y-5">
                  <div className="mb-4">
                    <span className="uppercase tracking-widest" style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600 }}>
                      Entregas Obrigatórias · {currentArea.name}
                    </span>
                    <h2 className="text-white mt-2" style={{ fontSize: "1.2rem", fontWeight: 600 }}>
                      📋 Saída da Entrevista
                    </h2>
                    <p style={{ fontSize: "0.82rem", color: TEXT_MED }} className="mt-1">
                      8 deliverables que precisam sair desta entrevista. Sem esses, a entrevista não está completa.
                    </p>
                  </div>

                  {deliveryItems.map((d, idx) => {
                    const as = getAreaState(selectedArea);
                    const value = as.deliveries[d.id] || "";
                    const answered = value.trim().length > 0;
                    return (
                      <div
                        key={d.id}
                        className="rounded-xl p-5 sm:p-6"
                        style={{
                          background: answered ? "rgba(100,180,120,0.03)" : CARD_BG,
                          border: `1px solid ${answered ? "rgba(100,180,120,0.12)" : BORDER}`,
                        }}
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <span
                            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{
                              background: answered ? "rgba(100,180,120,0.15)" : "rgba(184,170,154,0.1)",
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              color: answered ? "#7BC48A" : ACCENT,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-white" style={{ fontSize: "0.88rem", fontWeight: 500 }}>{d.label}</p>
                            <p className="mt-1" style={{ fontSize: "0.72rem", color: TEXT_DIM }}>{d.hint}</p>
                          </div>
                        </div>
                        <textarea
                          value={value}
                          onChange={(e) => updateDelivery(selectedArea, d.id, e.target.value)}
                          placeholder="Documente a entrega aqui..."
                          rows={5}
                          className="w-full rounded-lg px-4 py-3 resize-y outline-none"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${BORDER}`,
                            color: "rgba(255,255,255,0.85)",
                            fontSize: "0.8rem",
                            lineHeight: 1.65,
                            minHeight: "100px",
                          }}
                          onFocus={(e) => { e.target.style.borderColor = "rgba(184,170,154,0.3)"; }}
                          onBlur={(e) => { e.target.style.borderColor = BORDER; }}
                        />
                      </div>
                    );
                  })}

                  {/* Summary */}
                  <div
                    className="rounded-xl p-6 sm:p-8"
                    style={{ background: "rgba(184,170,154,0.04)", border: "1px solid rgba(184,170,154,0.12)" }}
                  >
                    <h3 className="text-white mb-4" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                      Resumo — {currentArea.name}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <span className="block text-white" style={{ fontSize: "1.6rem", fontWeight: 600 }}>{currentProgress.universalDone}</span>
                        <span style={{ fontSize: "0.65rem", color: TEXT_DIM }}>de {UNIVERSAL_COUNT} universais</span>
                      </div>
                      <div>
                        <span className="block text-white" style={{ fontSize: "1.6rem", fontWeight: 600 }}>{currentProgress.specificDone}</span>
                        <span style={{ fontSize: "0.65rem", color: TEXT_DIM }}>de {currentArea.questions.length} específicas</span>
                      </div>
                      <div>
                        <span className="block text-white" style={{ fontSize: "1.6rem", fontWeight: 600 }}>{currentProgress.aiDone}</span>
                        <span style={{ fontSize: "0.65rem", color: TEXT_DIM }}>de {AI_AGENT_COUNT} agente IA</span>
                      </div>
                      <div>
                        <span className="block text-white" style={{ fontSize: "1.6rem", fontWeight: 600 }}>{currentProgress.deliveriesDone}</span>
                        <span style={{ fontSize: "0.65rem", color: TEXT_DIM }}>de {DELIVERY_COUNT} entregas</span>
                      </div>
                    </div>

                    {/* Stuck list */}
                    {currentProgress.stuckCount > 0 && (
                      <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                        <h4 className="mb-3 flex items-center gap-2" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#E87C6C" }}>
                          <AlertTriangle size={13} /> Buracos Identificados
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const as = getAreaState(selectedArea);
                            const stuckItems: { prefix: string; id: number; text: string }[] = [];
                            universalBlocks.forEach((b) =>
                              b.questions.forEach((q) => {
                                if (as.universal[q.id]?.stuck) stuckItems.push({ prefix: "U", id: q.id, text: q.text });
                              })
                            );
                            currentArea.questions.forEach((q) => {
                              if (as.specific[q.id]?.stuck) stuckItems.push({ prefix: "E", id: q.id, text: q.text });
                            });
                            aiAgentQuestions.forEach((q) => {
                              if (as.aiAgent[q.id]?.stuck) stuckItems.push({ prefix: "IA", id: q.id, text: q.text });
                            });
                            return stuckItems.map((item) => (
                              <div
                                key={`${item.prefix}-${item.id}`}
                                className="flex items-start gap-2 rounded-lg px-3 py-2"
                                style={{ background: "rgba(220,80,60,0.06)", fontSize: "0.75rem", color: TEXT_MED }}
                              >
                                <span style={{ color: "#E87C6C", fontWeight: 600, fontSize: "0.65rem" }}>
                                  {item.prefix}#{item.id}
                                </span>
                                <span>{item.text}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={exportText}
                      className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl transition-all duration-200"
                      style={{
                        background: "linear-gradient(135deg, rgba(184,170,154,0.2) 0%, rgba(184,170,154,0.08) 100%)",
                        border: "1px solid rgba(184,170,154,0.25)",
                        color: "white",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                      }}
                    >
                      <Download size={15} /> Exportar Todas as Entrevistas (.txt)
                    </button>
                  </div>

                  {/* Back nav */}
                  <div className="flex items-center pt-4">
                    <button
                      onClick={() => setActiveView("ai-agent")}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
                      style={{ fontSize: "0.75rem", color: TEXT_MED, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}
                    >
                      <ChevronUp size={14} /> Agente IA
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Reset confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: "#141414", border: `1px solid ${BORDER}` }}>
            <h3 className="text-white mb-2" style={{ fontSize: "0.95rem", fontWeight: 600 }}>Recomeçar tudo?</h3>
            <p style={{ fontSize: "0.8rem", color: TEXT_DIM, lineHeight: 1.6 }}>
              Todas as respostas de todas as 13 áreas serão apagadas. Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: TEXT_MED, fontSize: "0.78rem" }}
              >
                Cancelar
              </button>
              <button
                onClick={resetAll}
                className="flex-1 py-2.5 rounded-lg"
                style={{ background: "rgba(220,80,60,0.15)", border: "1px solid rgba(220,80,60,0.3)", color: "#E87C6C", fontSize: "0.78rem", fontWeight: 500 }}
              >
                Apagar Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
