import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  prodSections,
  prodFinalItems,
  PROD_TOTAL_QUESTIONS,
  PROD_TOTAL_FINAL_ITEMS,
  type ProdQuestion,
  type ProdSection,
} from "../components/productivity-workbook-data";
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
} from "lucide-react";

/* ─── Design tokens ─── */
const ACCENT = "#B8AA9A";
const BG = "#0A0A0A";
const CARD_BG = "rgba(255,255,255,0.02)";
const BORDER = "rgba(255,255,255,0.06)";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";

/* ─── Storage key ─── */
const STORAGE_KEY = "parket-productivity-workbook";

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
  prod: string;
  obra: string;
  single: string;
  stuck: boolean;
}

interface FinalAnswerState {
  text: string;
}

interface WorkbookState {
  answers: Record<number, AnswerState>;
  finalAnswers: Record<string, FinalAnswerState>;
}

function getDefaultAnswer(): AnswerState {
  return { prod: "", obra: "", single: "", stuck: false };
}

function getDefaultFinal(): FinalAnswerState {
  return { text: "" };
}

/* ═══════════════════════════════════════════════════════════ */

export function ProductivityWorkbookPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<WorkbookState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { answers: {}, finalAnswers: {} };
  });
  const [activeSection, setActiveSection] = useState<string>("intro");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  /* save to localStorage */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  /* answer helpers */
  const getAnswer = useCallback(
    (id: number): AnswerState => state.answers[id] || getDefaultAnswer(),
    [state.answers]
  );
  const getFinal = useCallback(
    (id: string): FinalAnswerState => state.finalAnswers[id] || getDefaultFinal(),
    [state.finalAnswers]
  );

  const updateAnswer = (id: number, field: keyof AnswerState, value: string | boolean) => {
    setState((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [id]: { ...(prev.answers[id] || getDefaultAnswer()), [field]: value },
      },
    }));
  };

  const updateFinal = (id: string, value: string) => {
    setState((prev) => ({
      ...prev,
      finalAnswers: {
        ...prev.finalAnswers,
        [id]: { text: value },
      },
    }));
  };

  const resetAll = () => {
    setState({ answers: {}, finalAnswers: {} });
    setShowResetConfirm(false);
  };

  /* progress calculation */
  const isQuestionAnswered = (q: ProdQuestion): boolean => {
    const a = state.answers[q.id];
    if (!a) return false;
    if (q.single) return a.single.trim().length > 0;
    return a.prod.trim().length > 0 || a.obra.trim().length > 0;
  };

  const sectionProgress = (section: ProdSection): number => {
    const answered = section.questions.filter(isQuestionAnswered).length;
    return Math.round((answered / section.questions.length) * 100);
  };

  const totalAnswered = prodSections.reduce(
    (sum, s) => sum + s.questions.filter(isQuestionAnswered).length,
    0
  );
  const finalAnswered = prodFinalItems.filter((fi) => {
    const a = state.finalAnswers[fi.id];
    return a && a.text.trim().length > 0;
  }).length;

  const totalProgress = Math.round(
    ((totalAnswered + finalAnswered) / (PROD_TOTAL_QUESTIONS + PROD_TOTAL_FINAL_ITEMS)) * 100
  );

  const stuckCount = Object.values(state.answers).filter((a) => a.stuck).length;

  /* scroll to top on section change */
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setSidebarOpen(false);
  }, [activeSection]);

  /* export as text */
  const exportText = () => {
    let text = "PARKET PISOS — PRODUTIVIDADE, CUSTO & MARGEM · WORKBOOK\n";
    text += "═".repeat(65) + "\n\n";

    for (const section of prodSections) {
      text += `\n${"─".repeat(55)}\n`;
      text += `BLOCO ${section.number}: ${section.title.toUpperCase()}\n`;
      text += `${section.subtitle}\n`;
      text += `${"─".repeat(55)}\n\n`;

      for (const q of section.questions) {
        const a = state.answers[q.id] || getDefaultAnswer();
        text += `${q.id}. ${q.text}\n`;
        if (a.stuck) text += `  ⚠️ TRAVEI AQUI\n`;
        if (q.single) {
          text += `  → ${a.single || "(sem resposta)"}\n\n`;
        } else {
          text += `  PRODUÇÃO: ${a.prod || "(sem resposta)"}\n`;
          text += `  OBRA: ${a.obra || "(sem resposta)"}\n\n`;
        }
      }
    }

    text += `\n${"═".repeat(65)}\n`;
    text += `ENTREGA PRÁTICA — 8 DIAGNÓSTICOS FINAIS\n`;
    text += `${"═".repeat(65)}\n\n`;

    for (const fi of prodFinalItems) {
      const a = state.finalAnswers[fi.id] || getDefaultFinal();
      text += `• ${fi.label}\n`;
      text += `  → ${a.text || "(sem resposta)"}\n\n`;
    }

    text += `\nBURACOS IDENTIFICADOS (marcados como "travei"):\n`;
    const stuckQuestions = prodSections.flatMap((s) =>
      s.questions.filter((q) => state.answers[q.id]?.stuck).map((q) => `  #${q.id}: ${q.text}`)
    );
    text += stuckQuestions.length > 0 ? stuckQuestions.join("\n") : "  Nenhum identificado.";
    text += `\n\nProgresso: ${totalProgress}% (${totalAnswered + finalAnswered}/${PROD_TOTAL_QUESTIONS + PROD_TOTAL_FINAL_ITEMS})\n`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "parket-produtividade-custo-margem-workbook.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ═══ RENDER HELPERS ═══ */

  const renderQuestionCard = (q: ProdQuestion) => {
    const answer = getAnswer(q.id);
    const answered = isQuestionAnswered(q);
    const tagStyle = q.tag ? TAG_COLORS[q.tag] : null;

    return (
      <div
        key={q.id}
        className="rounded-xl p-5 sm:p-6 transition-all duration-300"
        style={{
          background: answer.stuck
            ? "rgba(220,80,60,0.04)"
            : answered
            ? "rgba(100,180,120,0.03)"
            : CARD_BG,
          border: `1px solid ${
            answer.stuck
              ? "rgba(220,80,60,0.2)"
              : answered
              ? "rgba(100,180,120,0.12)"
              : BORDER
          }`,
        }}
      >
        {/* Header */}
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
          <div className="flex items-center gap-2 shrink-0">
            {q.tag && tagStyle && (
              <span
                className="rounded-full px-2 py-0.5 uppercase tracking-widest"
                style={{
                  fontSize: "0.5rem",
                  fontWeight: 600,
                  background: tagStyle.bg,
                  color: tagStyle.color,
                }}
              >
                {q.tag}
              </span>
            )}
          </div>
        </div>

        {/* Answer fields */}
        {q.single ? (
          <div>
            <textarea
              value={answer.single}
              onChange={(e) => updateAnswer(q.id, "single", e.target.value)}
              placeholder="Responda aqui..."
              rows={3}
              className="w-full rounded-lg px-4 py-3 resize-y outline-none transition-all duration-200 focus:ring-1"
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
                e.target.style.boxShadow = `0 0 0 1px rgba(184,170,154,0.15)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = BORDER;
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block mb-1.5 uppercase tracking-widest"
                style={{ fontSize: "0.55rem", fontWeight: 600, color: "#C8A854" }}
              >
                Produção (Fábrica)
              </label>
              <textarea
                value={answer.prod}
                onChange={(e) => updateAnswer(q.id, "prod", e.target.value)}
                placeholder="Responda para Produção..."
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
                  e.target.style.borderColor = "rgba(200,168,84,0.3)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = BORDER;
                }}
              />
            </div>
            <div>
              <label
                className="block mb-1.5 uppercase tracking-widest"
                style={{ fontSize: "0.55rem", fontWeight: 600, color: ACCENT }}
              >
                Obra (Instalação)
              </label>
              <textarea
                value={answer.obra}
                onChange={(e) => updateAnswer(q.id, "obra", e.target.value)}
                placeholder="Responda para Obra..."
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
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = BORDER;
                }}
              />
            </div>
          </div>
        )}

        {/* Stuck toggle */}
        <button
          onClick={() => updateAnswer(q.id, "stuck", !answer.stuck)}
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
          {answer.stuck ? "Travei aqui — buraco identificado" : 'Marcar como "travei aqui"'}
        </button>
      </div>
    );
  };

  /* ═══ SIDEBAR ═══ */
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
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
          Produtividade, Custo & Margem
        </h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM, lineHeight: 1.5 }} className="mt-1">
          Workbook de Mapeamento
        </p>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Progresso</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: ACCENT }}>{totalProgress}%</span>
          </div>
          <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${totalProgress}%`, background: ACCENT }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>
              {totalAnswered + finalAnswered}/{PROD_TOTAL_QUESTIONS + PROD_TOTAL_FINAL_ITEMS} respostas
            </span>
            {stuckCount > 0 && (
              <span className="flex items-center gap-1" style={{ fontSize: "0.55rem", color: "#E87C6C" }}>
                <AlertTriangle size={9} />
                {stuckCount} buraco{stuckCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="h-px mx-4 my-2" style={{ background: BORDER }} />

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Intro */}
        <button
          onClick={() => setActiveSection("intro")}
          className="w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-all duration-200"
          style={{
            background: activeSection === "intro" ? "rgba(184,170,154,0.1)" : "transparent",
            border: activeSection === "intro" ? `1px solid rgba(184,170,154,0.15)` : "1px solid transparent",
          }}
        >
          <span
            className="flex items-center gap-2"
            style={{
              fontSize: "0.75rem",
              fontWeight: activeSection === "intro" ? 600 : 400,
              color: activeSection === "intro" ? "white" : TEXT_MED,
            }}
          >
            📖 Como usar
          </span>
        </button>

        {/* Sections */}
        {prodSections.map((section) => {
          const progress = sectionProgress(section);
          const isActive = activeSection === section.id;
          const sectionStuck = section.questions.filter((q) => state.answers[q.id]?.stuck).length;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className="w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-all duration-200"
              style={{
                background: isActive ? "rgba(184,170,154,0.1)" : "transparent",
                border: isActive ? `1px solid rgba(184,170,154,0.15)` : "1px solid transparent",
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
                  <span style={{ fontSize: "0.75rem" }}>{section.icon}</span>
                  <span className="truncate">{section.number}. {section.title}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {sectionStuck > 0 && (
                    <AlertTriangle size={10} style={{ color: "#E87C6C" }} />
                  )}
                  {progress === 100 ? (
                    <CheckCircle2 size={12} style={{ color: "#7BC48A" }} />
                  ) : progress > 0 ? (
                    <span style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600 }}>
                      {progress}%
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}

        {/* Final delivery */}
        <button
          onClick={() => setActiveSection("final")}
          className="w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-all duration-200"
          style={{
            background: activeSection === "final" ? "rgba(184,170,154,0.1)" : "transparent",
            border: activeSection === "final" ? `1px solid rgba(184,170,154,0.15)` : "1px solid transparent",
          }}
        >
          <span
            className="flex items-center gap-2"
            style={{
              fontSize: "0.72rem",
              fontWeight: activeSection === "final" ? 600 : 400,
              color: activeSection === "final" ? "white" : TEXT_MED,
            }}
          >
            📊 Entrega Prática
          </span>
        </button>
      </nav>

      {/* Bottom actions */}
      <div className="px-4 py-3 space-y-2" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={exportText}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-200"
          style={{
            background: "rgba(184,170,154,0.12)",
            color: ACCENT,
            fontSize: "0.72rem",
            fontWeight: 500,
            border: `1px solid rgba(184,170,154,0.2)`,
          }}
        >
          <Download size={13} />
          Exportar Respostas
        </button>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all duration-200"
          style={{
            color: TEXT_DIM,
            fontSize: "0.65rem",
          }}
        >
          <RotateCcw size={11} />
          Recomeçar
        </button>
      </div>
    </div>
  );

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

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Reset confirm dialog */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full"
            style={{ background: "#151515", border: `1px solid ${BORDER}` }}
          >
            <h3 className="text-white mb-2" style={{ fontSize: "1rem", fontWeight: 600 }}>
              Recomeçar do zero?
            </h3>
            <p style={{ fontSize: "0.8rem", color: TEXT_MED, lineHeight: 1.6 }}>
              Todas as respostas serão apagadas. Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-lg"
                style={{ fontSize: "0.8rem", color: TEXT_MED, background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}` }}
              >
                Cancelar
              </button>
              <button
                onClick={resetAll}
                className="flex-1 py-2.5 rounded-lg"
                style={{ fontSize: "0.8rem", color: "white", background: "rgba(220,80,60,0.3)", border: "1px solid rgba(220,80,60,0.4)" }}
              >
                Apagar tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12 lg:py-16">
          {/* INTRO */}
          {activeSection === "intro" && (
            <div className="space-y-8">
              {/* Hero */}
              <div>
                <p
                  className="tracking-[0.3em] uppercase mb-3"
                  style={{ fontSize: "0.55rem", color: ACCENT }}
                >
                  Parket Pisos · Workshop de Produtividade
                </p>
                <h1
                  className="text-white"
                  style={{ fontSize: "clamp(1.6rem, 5vw, 2.2rem)", fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em" }}
                >
                  Produtividade, Custo & Margem
                </h1>
                <p className="mt-3" style={{ fontSize: "0.9rem", color: TEXT_MED, lineHeight: 1.7 }}>
                  {PROD_TOTAL_QUESTIONS} perguntas + {PROD_TOTAL_FINAL_ITEMS} diagnósticos para construir o sistema completo de
                  apontamento, custo por obra, relatórios semanais e relatório final com margem real.
                </p>
              </div>

              {/* What you'll get */}
              <div
                className="rounded-xl p-6 sm:p-8"
                style={{
                  background: "rgba(184,170,154,0.04)",
                  border: `1px solid rgba(184,170,154,0.12)`,
                }}
              >
                <h2
                  className="text-white mb-5"
                  style={{ fontSize: "1rem", fontWeight: 600 }}
                >
                  O que este workbook entrega
                </h2>
                <div className="space-y-4">
                  {[
                    { n: "1", text: "Definições de unidades, centros de custo e regras de aloca��ão — a base sem a qual nada funciona.", accent: true },
                    { n: "2", text: "Modelo de apontamento diário para obra e fábrica: os campos mínimos que precisam funcionar todo dia.", accent: true },
                    { n: "3", text: "Custo hora real por perfil, regras de rateio e vinculação de material/frete por obra.", accent: false },
                    { n: "4", text: "Template do relatório semanal (10 campos) e relatório final de fechamento (10 campos).", accent: true },
                    { n: "5", text: "Design do agente IA de produtividade: validações, alertas, bloqueios e relatórios automáticos.", accent: false },
                    { n: "6", text: "Diagnóstico dos gaps: onde estão os dados hoje e o que precisa ser construído.", accent: true },
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

              {/* Rules */}
              <div
                className="rounded-xl p-6 sm:p-8"
                style={{
                  background: CARD_BG,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <h2
                  className="text-white mb-5"
                  style={{ fontSize: "1rem", fontWeight: 600 }}
                >
                  Como usar (sem enrolação)
                </h2>
                <div className="space-y-4">
                  {[
                    { icon: "📐", text: "Responda cada pergunta com a realidade ATUAL. Não como deveria ser — como É hoje." },
                    { icon: "🔴", text: "Onde você travar ou responder 'não sei / não tenho', marque 'travei aqui'. Ali está o gap." },
                    { icon: "🏭", text: "Perguntas com dupla coluna: responda para PRODUÇÃO (fábrica) e OBRA (instalação) separadamente." },
                    { icon: "📊", text: "Ao final, exporte o .txt e use como input para montar o sistema no ERP/CRM e configurar o agente IA." },
                  ].map((rule, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span style={{ fontSize: "1rem" }}>{rule.icon}</span>
                      <p style={{ fontSize: "0.82rem", lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
                        {rule.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tag legend */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: CARD_BG,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <h3
                  className="text-white mb-3"
                  style={{ fontSize: "0.8rem", fontWeight: 600 }}
                >
                  Tipos de Perguntas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TAG_COLORS).map(([tag, style]) => (
                    <span
                      key={tag}
                      className="rounded-full px-2.5 py-1 uppercase tracking-widest"
                      style={{
                        fontSize: "0.5rem",
                        fontWeight: 600,
                        background: style.bg,
                        color: style.color,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5" style={{ fontSize: "0.68rem", color: TEXT_DIM, lineHeight: 1.5 }}>
                  <strong style={{ color: "#E87C6C" }}>brutal</strong> = revela verdade incômoda ·{" "}
                  <strong style={{ color: "#7CA8D4" }}>processo</strong> = define o fluxo ·{" "}
                  <strong style={{ color: "#B490D0" }}>governança</strong> = quem decide ·{" "}
                  <strong style={{ color: "#C8A854" }}>maturidade</strong> = nível atual ·{" "}
                  <strong style={{ color: "#7BC48A" }}>destrava</strong> = abre caminho ·{" "}
                  <strong style={{ color: "#7CA8D4" }}>sistema</strong> = arquitetura
                </p>
              </div>

              {/* Section overview */}
              <div>
                <h3
                  className="text-white mb-4"
                  style={{ fontSize: "0.85rem", fontWeight: 600 }}
                >
                  {prodSections.length} Blocos + Entrega Prática
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {prodSections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className="text-left rounded-lg px-4 py-3 transition-all duration-200 group"
                      style={{
                        background: CARD_BG,
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span style={{ fontSize: "0.9rem" }}>{s.icon}</span>
                        <div className="min-w-0">
                          <span
                            className="block text-white group-hover:text-[#B8AA9A] transition-colors truncate"
                            style={{ fontSize: "0.78rem", fontWeight: 500 }}
                          >
                            {s.number}. {s.title}
                          </span>
                          <span
                            className="block truncate"
                            style={{ fontSize: "0.62rem", color: TEXT_DIM }}
                          >
                            {s.subtitle} · {s.questions.length}p
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={() => setActiveSection("definicoes")}
                className="w-full py-4 rounded-xl transition-all duration-200"
                style={{
                  background: `linear-gradient(135deg, rgba(184,170,154,0.2) 0%, rgba(184,170,154,0.08) 100%)`,
                  border: `1px solid rgba(184,170,154,0.25)`,
                  color: "white",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                }}
              >
                Começar Bloco 1 →
              </button>
            </div>
          )}

          {/* SECTION CONTENT */}
          {prodSections.map((section) => {
            if (activeSection !== section.id) return null;
            const progress = sectionProgress(section);
            const currentIdx = prodSections.findIndex((s) => s.id === section.id);
            const nextSection = prodSections[currentIdx + 1];
            const prevSection = prodSections[currentIdx - 1];

            return (
              <div key={section.id} className="space-y-6">
                {/* Section header */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <span style={{ fontSize: "1.3rem" }}>{section.icon}</span>
                    <span
                      className="uppercase tracking-widest"
                      style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600 }}
                    >
                      Bloco {section.number} de {prodSections.length}
                    </span>
                  </div>
                  <h1
                    className="text-white"
                    style={{
                      fontSize: "clamp(1.4rem, 5vw, 2rem)",
                      fontWeight: 600,
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {section.title}
                  </h1>
                  <p className="mt-2" style={{ fontSize: "0.85rem", color: TEXT_MED, lineHeight: 1.6 }}>
                    {section.subtitle}
                  </p>

                  {/* Section progress */}
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%`, background: progress === 100 ? "#7BC48A" : ACCENT }}
                      />
                    </div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: progress === 100 ? "#7BC48A" : ACCENT }}>
                      {progress}%
                    </span>
                  </div>
                </div>

                {/* Questions */}
                {section.questions.map(renderQuestionCard)}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <button
                    onClick={() => setActiveSection(prevSection?.id || "intro")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200"
                    style={{
                      fontSize: "0.75rem",
                      color: TEXT_MED,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    <ChevronUp size={14} />
                    {prevSection ? `Bloco ${prevSection.number}` : "Início"}
                  </button>
                  <button
                    onClick={() => setActiveSection(nextSection?.id || "final")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200"
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      color: "white",
                      background: "rgba(184,170,154,0.12)",
                      border: `1px solid rgba(184,170,154,0.2)`,
                    }}
                  >
                    {nextSection ? `Bloco ${nextSection.number}` : "Entrega Prática"}
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* FINAL DELIVERY */}
          {activeSection === "final" && (
            <div className="space-y-6">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span style={{ fontSize: "1.3rem" }}>📊</span>
                  <span
                    className="uppercase tracking-widest"
                    style={{ fontSize: "0.55rem", color: ACCENT, fontWeight: 600 }}
                  >
                    Entrega Final
                  </span>
                </div>
                <h1
                  className="text-white"
                  style={{
                    fontSize: "clamp(1.4rem, 5vw, 2rem)",
                    fontWeight: 600,
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Entrega Prática
                </h1>
                <p className="mt-2" style={{ fontSize: "0.85rem", color: TEXT_MED, lineHeight: 1.6 }}>
                  Responda para eu transformar em sistema completo: apontamento, relatórios e agente IA.
                </p>
              </div>

              {/* Intro callout */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "rgba(184,170,154,0.04)",
                  border: `1px solid rgba(184,170,154,0.12)`,
                }}
              >
                <p style={{ fontSize: "0.8rem", lineHeight: 1.6, color: TEXT_MED }}>
                  <strong className="text-white">Me entregue em bullets, sem texto longo.</strong>{" "}
                  São {PROD_TOTAL_FINAL_ITEMS} diagnósticos que, junto com as {PROD_TOTAL_QUESTIONS} perguntas acima, me dão o material para
                  construir: formulário de apontamento, templates de relatório, regras de validação e o agente IA de produtividade.
                </p>
              </div>

              {/* Final items */}
              {prodFinalItems.map((fi, idx) => {
                const answer = getFinal(fi.id);
                const answered = answer.text.trim().length > 0;

                return (
                  <div
                    key={fi.id}
                    className="rounded-xl p-5 sm:p-6 transition-all duration-300"
                    style={{
                      background: answered ? "rgba(100,180,120,0.03)" : CARD_BG,
                      border: `1px solid ${answered ? "rgba(100,180,120,0.12)" : BORDER}`,
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
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white" style={{ fontSize: "0.88rem", lineHeight: 1.5, fontWeight: 500 }}>
                          {fi.label}
                        </p>
                        <p className="mt-1" style={{ fontSize: "0.72rem", lineHeight: 1.5, color: TEXT_DIM }}>
                          {fi.hint}
                        </p>
                      </div>
                    </div>
                    <textarea
                      value={answer.text}
                      onChange={(e) => updateFinal(fi.id, e.target.value)}
                      placeholder="Responda aqui..."
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
                        e.target.style.boxShadow = `0 0 0 1px rgba(184,170,154,0.15)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = BORDER;
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>
                );
              })}

              {/* Back navigation */}
              <div className="flex items-center justify-between pt-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                <button
                  onClick={() => setActiveSection(prodSections[prodSections.length - 1].id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200"
                  style={{
                    fontSize: "0.75rem",
                    color: TEXT_MED,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  <ChevronUp size={14} />
                  Bloco {prodSections.length}
                </button>
                <button
                  onClick={exportText}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all duration-200"
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "white",
                    background: "rgba(184,170,154,0.15)",
                    border: `1px solid rgba(184,170,154,0.25)`,
                  }}
                >
                  <Download size={14} />
                  Exportar tudo
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
