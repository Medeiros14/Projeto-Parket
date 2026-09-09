import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  areasDiagnostico,
  dependenciasCriticas,
  resumoExecutivo,
  type AreaDiagnostico,
} from "../components/diagnostico-areas-data";
import {
  ArrowLeft,
  Menu,
  X,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Target,
  Zap,
  Shield,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  Brain,
  BarChart3,
  Link2,
  Download,
  Eye,
} from "lucide-react";

/* ─── Design tokens ─── */
const ACCENT = "#B8AA9A";
const BG = "#0A0A0A";
const CARD_BG = "rgba(255,255,255,0.02)";
const BORDER = "rgba(255,255,255,0.06)";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";

type ViewMode = "resumo" | "area" | "dependencias" | "acoes";

function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 80 ? "#4ADE80" : score >= 65 ? "#FBBF24" : score >= 50 ? "#FB923C" : "#F87171";
  const bg = score >= 80 ? "rgba(74,222,128,0.15)" : score >= 65 ? "rgba(251,191,36,0.15)" : score >= 50 ? "rgba(251,146,60,0.15)" : "rgba(248,113,113,0.15)";
  const label = score >= 80 ? "Saudavel" : score >= 65 ? "Atencao" : score >= 50 ? "Risco" : "Critico";
  const sizeMap = { sm: "0.6rem", md: "0.75rem", lg: "0.9rem" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: bg, color, fontSize: sizeMap[size], fontWeight: 600 }}>
      {score} <span style={{ fontSize: "0.55rem", opacity: 0.8 }}>{label}</span>
    </span>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "subindo") return <TrendingUp size={12} style={{ color: "#4ADE80" }} />;
  if (trend === "caindo") return <TrendingDown size={12} style={{ color: "#F87171" }} />;
  return <Minus size={12} style={{ color: TEXT_DIM }} />;
}

function ImpactBadge({ impacto }: { impacto: string }) {
  const color = impacto === "critico" ? "#F87171" : impacto === "alto" ? "#FB923C" : "#FBBF24";
  const bg = impacto === "critico" ? "rgba(248,113,113,0.12)" : impacto === "alto" ? "rgba(251,146,60,0.12)" : "rgba(251,191,36,0.12)";
  return (
    <span className="rounded-full px-2 py-0.5 uppercase tracking-widest" style={{ fontSize: "0.5rem", fontWeight: 600, background: bg, color }}>
      {impacto}
    </span>
  );
}

export function DiagnosticoAreasPage() {
  const navigate = useNavigate();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("resumo");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [areaTab, setAreaTab] = useState<string>("visao-geral");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setSidebarOpen(false);
  }, [selectedAreaId, viewMode, areaTab]);

  const selectedArea = selectedAreaId ? areasDiagnostico.find((a) => a.id === selectedAreaId) : null;

  const handleExport = () => {
    let text = "PARKET PISOS — DIAGNOSTICO POR AREA\n";
    text += "Base: 10 entrevistas com lideres (Mar/2026)\n";
    text += "=".repeat(65) + "\n\n";
    text += `Score geral: ${resumoExecutivo.scoreGeralOperacao}/100\n`;
    text += `Gargalo master: ${resumoExecutivo.gargaloMaster}\n\n`;

    for (const area of areasDiagnostico) {
      text += `\n${"█".repeat(65)}\n`;
      text += `${area.icon} ${area.nome.toUpperCase()} — ${area.lider} (${area.cargoLider})\n`;
      text += `Score: ${area.scoreAtual}/100 | Trend: ${area.scoreTrend}\n`;
      text += `${"█".repeat(65)}\n\n`;
      text += `MISSAO: ${area.missao}\n\n`;

      text += "ENTREGAS:\n";
      for (const e of area.entregas) text += `  ${e.tipo === "entrega" ? "✅" : "❌"} ${e.texto}\n`;

      text += "\nDEFEITOS IMPERDOAVEIS:\n";
      for (const d of area.defeitosImperdoaveis) text += `  🚫 [${d.risco}] ${d.texto}\n`;

      text += "\nGARGALOS:\n";
      for (const g of area.gargalos) text += `  ⚠️ [${g.impacto}] ${g.titulo}: ${g.descricao}\n`;

      text += "\nPROCESSO REAL:\n";
      for (const p of area.processoReal) text += `  ${p.etapa}. ${p.descricao} ${p.ferramenta ? `(${p.ferramenta})` : ""} ${p.responsavel ? `→ ${p.responsavel}` : ""}\n`;

      text += "\nOPORTUNIDADES IA:\n";
      for (const o of area.oportunidadesIA) text += `  🤖 [${o.prioridade}] ${o.descricao}\n`;

      text += "\nMETRICAS SUGERIDAS:\n";
      for (const m of area.metricasSugeridas) text += `  📊 ${m.nome} (${m.tipo}) → Meta 90d: ${m.meta90dias || "definir"}\n`;

      text += `\nCENARIO IDEAL: ${area.cenarioIdeal}\n`;
      text += `CITACAO: "${area.citacaoChave}"\n\n`;
    }

    text += "\n\nDEPENDENCIAS CRITICAS:\n";
    for (const d of dependenciasCriticas) {
      text += `\n  [${d.nivelRisco}] ${d.de} → ${d.para}: ${d.descricao}\n`;
      text += `  Cadeia: ${d.impactoEmCadeia.join(" → ")}\n`;
    }

    text += "\n\nTOP 5 ACOES IMEDIATAS:\n";
    for (const a of resumoExecutivo.top5AcoesImediatas) {
      text += `  → ${a.acao} (${a.responsavel}, ${a.prazo})\n    Impacto: ${a.impacto}\n`;
    }

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "parket-diagnostico-areas.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ═══ SIDEBAR ═══ */
  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 mb-4 transition-colors" style={{ color: TEXT_DIM, fontSize: "0.7rem" }}>
          <ArrowLeft size={14} />
          <span className="tracking-wider uppercase">Hub</span>
        </button>
        <h2 className="text-white" style={{ fontSize: "0.95rem", fontWeight: 600, lineHeight: 1.3 }}>
          Diagnostico por Area
        </h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }} className="mt-1">
          10 lideres entrevistados · {resumoExecutivo.totalGargalos} gargalos
        </p>
        <div className="mt-3">
          <ScoreBadge score={resumoExecutivo.scoreGeralOperacao} size="md" />
        </div>
      </div>
      <div className="h-px mx-4 my-2" style={{ background: BORDER }} />
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Nav buttons */}
        {([
          { id: "resumo" as ViewMode, icon: "📋", label: "Resumo Executivo" },
          { id: "dependencias" as ViewMode, icon: "🔗", label: "Mapa de Dependencias" },
          { id: "acoes" as ViewMode, icon: "⚡", label: "Top 5 Acoes" },
        ] as const).map((item) => (
          <button
            key={item.id}
            onClick={() => { setViewMode(item.id); setSelectedAreaId(null); }}
            className="w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-all duration-200"
            style={{
              background: viewMode === item.id && !selectedAreaId ? "rgba(184,170,154,0.1)" : "transparent",
              border: viewMode === item.id && !selectedAreaId ? "1px solid rgba(184,170,154,0.15)" : "1px solid transparent",
            }}
          >
            <span style={{ fontSize: "0.72rem", fontWeight: viewMode === item.id && !selectedAreaId ? 600 : 400, color: viewMode === item.id && !selectedAreaId ? "white" : TEXT_MED }}>
              {item.icon} {item.label}
            </span>
          </button>
        ))}

        <div className="h-px mx-2 my-2" style={{ background: BORDER }} />
        <p className="px-3 mb-2 tracking-[0.2em] uppercase" style={{ fontSize: "0.5rem", color: ACCENT, opacity: 0.6 }}>Areas Entrevistadas</p>

        {areasDiagnostico.map((area) => (
          <button
            key={area.id}
            onClick={() => { setSelectedAreaId(area.id); setViewMode("area"); setAreaTab("visao-geral"); }}
            className="w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-all duration-200"
            style={{
              background: selectedAreaId === area.id ? "rgba(184,170,154,0.1)" : "transparent",
              border: selectedAreaId === area.id ? "1px solid rgba(184,170,154,0.15)" : "1px solid transparent",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 min-w-0" style={{ fontSize: "0.72rem", fontWeight: selectedAreaId === area.id ? 600 : 400, color: selectedAreaId === area.id ? "white" : TEXT_MED }}>
                <span style={{ fontSize: "0.75rem" }}>{area.icon}</span>
                <span className="truncate">{area.lider}</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <TrendIcon trend={area.scoreTrend} />
                <span style={{ fontSize: "0.55rem", color: area.scoreAtual >= 70 ? "#4ADE80" : area.scoreAtual >= 55 ? "#FBBF24" : "#F87171", fontWeight: 600 }}>
                  {area.scoreAtual}
                </span>
              </div>
            </div>
            <span className="block mt-0.5 truncate" style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{area.nome}</span>
          </button>
        ))}
      </nav>
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button onClick={handleExport} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg" style={{ background: "rgba(184,170,154,0.12)", color: ACCENT, fontSize: "0.72rem", fontWeight: 500, border: "1px solid rgba(184,170,154,0.2)" }}>
          <Download size={13} /> Exportar Tudo
        </button>
      </div>
    </div>
  );

  /* ═══ RENDER: AREA DETAIL ═══ */
  const renderAreaDetail = (area: AreaDiagnostico) => {
    const tabs = [
      { id: "visao-geral", label: "Visao Geral", icon: Eye },
      { id: "processo", label: "Processo Real", icon: Target },
      { id: "gargalos", label: "Gargalos", icon: AlertTriangle },
      { id: "handoffs", label: "Handoffs", icon: Link2 },
      { id: "ia", label: "IA", icon: Brain },
      { id: "metricas", label: "Metricas", icon: BarChart3 },
    ];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: "1.8rem" }}>{area.icon}</span>
            <div>
              <h1 className="text-white" style={{ fontSize: "clamp(1.3rem, 4vw, 1.8rem)", fontWeight: 600, lineHeight: 1.2 }}>
                {area.nome}
              </h1>
              <p style={{ fontSize: "0.8rem", color: TEXT_MED }}>{area.lider} — {area.cargoLider}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <ScoreBadge score={area.scoreAtual} />
            <TrendIcon trend={area.scoreTrend} />
            <span className="rounded-full px-2 py-0.5 uppercase tracking-widest" style={{ fontSize: "0.5rem", fontWeight: 600, background: "rgba(184,170,154,0.1)", color: ACCENT }}>
              {area.sistema}
            </span>
          </div>
        </div>

        {/* Mission */}
        <div className="rounded-xl p-5" style={{ background: `${area.corDim}`, border: `1px solid ${area.cor}22` }}>
          <p className="tracking-[0.2em] uppercase mb-2" style={{ fontSize: "0.55rem", color: area.cor }}>Missao</p>
          <p className="text-white" style={{ fontSize: "0.88rem", lineHeight: 1.6 }}>{area.missao}</p>
        </div>

        {/* Quote */}
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "rgba(255,255,255,0.7)", fontStyle: "italic" }}>
            "{area.citacaoChave}"
          </p>
          <p className="mt-2" style={{ fontSize: "0.65rem", color: ACCENT }}>— {area.lider}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
          {tabs.map((tab) => {
            const isActive = areaTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setAreaTab(tab.id)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200" style={{ background: isActive ? "rgba(184,170,154,0.12)" : "rgba(255,255,255,0.02)", border: `1px solid ${isActive ? "rgba(184,170,154,0.2)" : BORDER}`, fontSize: "0.7rem", fontWeight: isActive ? 600 : 400, color: isActive ? "white" : TEXT_MED }}>
                <TabIcon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {areaTab === "visao-geral" && (
          <div className="space-y-5">
            {/* Entregas */}
            <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <h3 className="text-white mb-4" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Entregas e Escopo</h3>
              <div className="space-y-2">
                {area.entregas.map((e, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    {e.tipo === "entrega" ? <CheckCircle2 size={14} style={{ color: "#4ADE80", marginTop: 2 }} /> : <X size={14} style={{ color: "#F87171", marginTop: 2 }} />}
                    <span style={{ fontSize: "0.78rem", color: e.tipo === "entrega" ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                      {e.texto}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Defeitos imperdoaveis */}
            <div className="rounded-xl p-5" style={{ background: "rgba(248,113,113,0.03)", border: "1px solid rgba(248,113,113,0.12)" }}>
              <h3 className="text-white mb-4" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                <Shield size={14} className="inline mr-2" style={{ color: "#F87171" }} />
                Defeitos Imperdoaveis
              </h3>
              <div className="space-y-3">
                {area.defeitosImperdoaveis.map((d, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(248,113,113,0.15)", fontSize: "0.6rem", fontWeight: 600, color: "#F87171" }}>
                      {i + 1}
                    </span>
                    <div>
                      <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{d.texto}</p>
                      <span className="rounded-full px-2 py-0.5 uppercase tracking-widest mt-1 inline-block" style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(248,113,113,0.1)", color: "#F87171" }}>
                        {d.risco}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regras operacionais */}
            <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <h3 className="text-white mb-4" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Regras Operacionais</h3>
              <div className="space-y-3">
                {area.regrasOperacionais.map((r, i) => {
                  const statusColor = r.cumprida === "sim" ? "#4ADE80" : r.cumprida === "parcial" ? "#FBBF24" : "#F87171";
                  const statusBg = r.cumprida === "sim" ? "rgba(74,222,128,0.15)" : r.cumprida === "parcial" ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)";
                  const statusLabel = r.cumprida === "sim" ? "Cumprida" : r.cumprida === "parcial" ? "Parcial" : "Nao cumprida";
                  return (
                    <div key={i} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.5, flex: 1 }}>{r.regra}</p>
                        <span className="shrink-0 rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: statusBg, color: statusColor }}>
                          {statusLabel}
                        </span>
                      </div>
                      {r.cumprida !== "sim" && (
                        <p className="mt-1.5" style={{ fontSize: "0.65rem", color: "#FB923C", lineHeight: 1.5 }}>
                          Risco: {r.consequenciaDescumprimento}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cenario ideal */}
            <div className="rounded-xl p-5" style={{ background: "rgba(74,222,128,0.03)", border: "1px solid rgba(74,222,128,0.12)" }}>
              <p className="tracking-[0.2em] uppercase mb-2" style={{ fontSize: "0.55rem", color: "#4ADE80" }}>Cenario Ideal</p>
              <p style={{ fontSize: "0.82rem", lineHeight: 1.6, color: "rgba(255,255,255,0.75)" }}>{area.cenarioIdeal}</p>
            </div>
          </div>
        )}

        {areaTab === "processo" && (
          <div className="space-y-3">
            <h3 className="text-white" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Processo Real (como acontece hoje)</h3>
            {area.processoReal.map((p) => (
              <div key={p.etapa} className="flex items-start gap-3 rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <span className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${area.corDim}`, fontSize: "0.7rem", fontWeight: 600, color: area.cor }}>
                  {p.etapa}
                </span>
                <div className="flex-1">
                  <p className="text-white" style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>{p.descricao}</p>
                  <div className="flex gap-3 mt-1.5">
                    {p.ferramenta && <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>🔧 {p.ferramenta}</span>}
                    {p.responsavel && <span style={{ fontSize: "0.6rem", color: ACCENT }}>👤 {p.responsavel}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {areaTab === "gargalos" && (
          <div className="space-y-3">
            <h3 className="text-white" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              {area.gargalos.length} Gargalos Identificados
            </h3>
            {area.gargalos.map((g, i) => (
              <div key={i} className="rounded-xl p-5" style={{ background: g.impacto === "critico" ? "rgba(248,113,113,0.03)" : CARD_BG, border: `1px solid ${g.impacto === "critico" ? "rgba(248,113,113,0.15)" : BORDER}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <ImpactBadge impacto={g.impacto} />
                  <h4 className="text-white" style={{ fontSize: "0.82rem", fontWeight: 600 }}>{g.titulo}</h4>
                </div>
                <p style={{ fontSize: "0.78rem", color: TEXT_MED, lineHeight: 1.6 }}>{g.descricao}</p>
                {g.areaAfetada && (
                  <p className="mt-2" style={{ fontSize: "0.6rem", color: ACCENT }}>Afeta: {g.areaAfetada}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {areaTab === "handoffs" && (
          <div className="space-y-3">
            <h3 className="text-white" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Handoffs (passagem de bastao)</h3>
            {area.handoffs.map((h, i) => {
              const freqColor = h.frequenciaProblema === "alta" ? "#F87171" : h.frequenciaProblema === "media" ? "#FBBF24" : "#4ADE80";
              return (
                <div key={i} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>{h.de}</span>
                    <ChevronRight size={14} style={{ color: ACCENT }} />
                    <span style={{ fontSize: "0.75rem", color: "white", fontWeight: 600 }}>{h.para}</span>
                    <span className="ml-auto rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${freqColor}22`, color: freqColor }}>
                      freq. {h.frequenciaProblema}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p style={{ fontSize: "0.6rem", color: "#4ADE80", fontWeight: 500 }}>Pacote minimo:</p>
                      <p style={{ fontSize: "0.75rem", color: TEXT_MED, lineHeight: 1.5 }}>{h.pacoteMinimo}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "0.6rem", color: "#F87171", fontWeight: 500 }}>O que sempre falta:</p>
                      <p style={{ fontSize: "0.75rem", color: TEXT_MED, lineHeight: 1.5 }}>{h.oQueFalta}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {areaTab === "ia" && (
          <div className="space-y-3">
            <h3 className="text-white" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Oportunidades de IA</h3>
            {area.oportunidadesIA.map((o, i) => {
              const prioColor = o.prioridade === "p0" ? "#F87171" : o.prioridade === "p1" ? "#FBBF24" : "#4ADE80";
              const prioLabel = o.prioridade === "p0" ? "Urgente" : o.prioridade === "p1" ? "Importante" : "Desejavel";
              const tipoIcon = o.tipo === "bloqueio" ? "🚫" : o.tipo === "alerta" ? "⚠️" : o.tipo === "geracao" ? "✨" : "✅";
              return (
                <div key={i} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <div className="flex items-start gap-3">
                    <span style={{ fontSize: "1rem" }}>{tipoIcon}</span>
                    <div className="flex-1">
                      <p className="text-white" style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>{o.descricao}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="rounded-full px-2 py-0.5 uppercase tracking-widest" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${prioColor}22`, color: prioColor }}>
                          {prioLabel}
                        </span>
                        <span className="rounded-full px-2 py-0.5 uppercase tracking-widest" style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(184,170,154,0.1)", color: ACCENT }}>
                          {o.tipo}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {areaTab === "metricas" && (
          <div className="space-y-3">
            <h3 className="text-white" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Metricas Sugeridas</h3>
            {area.metricasSugeridas.map((m, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white" style={{ fontSize: "0.8rem", fontWeight: 500 }}>{m.nome}</p>
                    {m.formula && <p className="mt-1" style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{m.formula}</p>}
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: m.tipo === "leading" ? "rgba(96,165,250,0.15)" : "rgba(167,139,250,0.15)", color: m.tipo === "leading" ? "#60A5FA" : "#A78BFA" }}>
                    {m.tipo}
                  </span>
                </div>
                {m.meta90dias && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Target size={10} style={{ color: ACCENT }} />
                    <span style={{ fontSize: "0.65rem", color: ACCENT }}>Meta 90 dias: {m.meta90dias}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ═══ RENDER: RESUMO EXECUTIVO ═══ */
  const renderResumo = () => (
    <div className="space-y-8">
      <div>
        <p className="tracking-[0.3em] uppercase mb-3" style={{ fontSize: "0.55rem", color: ACCENT }}>Parket Pisos · Diagnostico Operacional</p>
        <h1 className="text-white" style={{ fontSize: "clamp(1.5rem, 5vw, 2rem)", fontWeight: 600, lineHeight: 1.15 }}>
          Resumo Executivo
        </h1>
        <p className="mt-3" style={{ fontSize: "0.85rem", color: TEXT_MED, lineHeight: 1.7 }}>
          10 lideres entrevistados · {resumoExecutivo.totalGargalos} gargalos mapeados · {resumoExecutivo.oportunidadesIA} oportunidades de IA
        </p>
      </div>

      {/* Score geral */}
      <div className="rounded-xl p-6" style={{ background: "rgba(184,170,154,0.04)", border: "1px solid rgba(184,170,154,0.12)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Score Geral da Operacao</h2>
          <ScoreBadge score={resumoExecutivo.scoreGeralOperacao} size="lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(resumoExecutivo.sistemasOperacionais) as [string, { score: number; areas: string[] }][]).map(([key, val]) => (
            <div key={key} className="rounded-lg p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="uppercase tracking-[0.15em]" style={{ fontSize: "0.6rem", color: ACCENT, fontWeight: 500 }}>{key}</span>
                <ScoreBadge score={val.score} size="sm" />
              </div>
              {val.areas.map((a, i) => (
                <p key={i} style={{ fontSize: "0.6rem", color: TEXT_DIM, lineHeight: 1.5 }}>{a}</p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Gargalo master */}
      <div className="rounded-xl p-6" style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.15)" }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} style={{ color: "#F87171" }} />
          <h2 className="text-white" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Gargalo Master</h2>
        </div>
        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>
          {resumoExecutivo.gargaloMaster}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Gargalos", value: resumoExecutivo.totalGargalos, sub: `${resumoExecutivo.gargalosCriticos} criticos`, color: "#F87171" },
          { label: "Defeitos Imperdoaveis", value: resumoExecutivo.defeitosImperdoaveis, sub: "identificados", color: "#FB923C" },
          { label: "Oportunidades IA", value: resumoExecutivo.oportunidadesIA, sub: `${resumoExecutivo.oportunidadesP0} urgentes`, color: "#60A5FA" },
          { label: "Entrevistados", value: resumoExecutivo.totalEntrevistados, sub: "lideres", color: "#4ADE80" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl p-4 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <p style={{ fontSize: "1.5rem", fontWeight: 600, color: kpi.color }}>{kpi.value}</p>
            <p style={{ fontSize: "0.65rem", color: "white", fontWeight: 500 }}>{kpi.label}</p>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* All areas grid */}
      <div>
        <h2 className="text-white mb-4" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Mapa de Areas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {areasDiagnostico.map((area) => (
            <button
              key={area.id}
              onClick={() => { setSelectedAreaId(area.id); setViewMode("area"); setAreaTab("visao-geral"); }}
              className="text-left rounded-xl p-4 transition-all duration-200 group"
              style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
            >
              <div className="flex items-start gap-3">
                <span style={{ fontSize: "1.2rem" }}>{area.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white group-hover:text-[#B8AA9A] transition-colors truncate" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                      {area.lider}
                    </span>
                    <ScoreBadge score={area.scoreAtual} size="sm" />
                  </div>
                  <span className="block mt-0.5 truncate" style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{area.nome}</span>
                  <div className="flex gap-2 mt-2">
                    <span style={{ fontSize: "0.55rem", color: "#F87171" }}>{area.gargalos.filter((g) => g.impacto === "critico").length} criticos</span>
                    <span style={{ fontSize: "0.55rem", color: "#60A5FA" }}>{area.oportunidadesIA.filter((o) => o.prioridade === "p0").length} IA urgentes</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ═══ RENDER: DEPENDENCIAS ═══ */
  const renderDependencias = () => (
    <div className="space-y-6">
      <div>
        <p className="tracking-[0.3em] uppercase mb-3" style={{ fontSize: "0.55rem", color: ACCENT }}>Analise de Dependencias</p>
        <h1 className="text-white" style={{ fontSize: "clamp(1.3rem, 4vw, 1.8rem)", fontWeight: 600 }}>
          Mapa de Dependencias Criticas
        </h1>
        <p className="mt-2" style={{ fontSize: "0.8rem", color: TEXT_MED }}>
          {dependenciasCriticas.length} dependencias mapeadas entre areas
        </p>
      </div>
      {dependenciasCriticas.map((dep) => (
        <div key={dep.id} className="rounded-xl p-5" style={{ background: dep.nivelRisco === "critico" ? "rgba(248,113,113,0.03)" : CARD_BG, border: `1px solid ${dep.nivelRisco === "critico" ? "rgba(248,113,113,0.15)" : BORDER}` }}>
          <div className="flex items-center gap-2 mb-3">
            <ImpactBadge impacto={dep.nivelRisco} />
            <span style={{ fontSize: "0.75rem", color: TEXT_MED }}>{dep.de}</span>
            <ChevronRight size={14} style={{ color: ACCENT }} />
            <span style={{ fontSize: "0.75rem", color: "white", fontWeight: 600 }}>{dep.para}</span>
          </div>
          <p className="text-white mb-3" style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{dep.descricao}</p>
          <div>
            <p style={{ fontSize: "0.6rem", color: "#F87171", fontWeight: 500, marginBottom: 4 }}>Impacto em cadeia:</p>
            <div className="flex flex-wrap gap-1.5">
              {dep.impactoEmCadeia.map((item, i) => (
                <span key={i} className="rounded-full px-2.5 py-1" style={{ fontSize: "0.6rem", background: "rgba(248,113,113,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(248,113,113,0.12)" }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  /* ═══ RENDER: ACOES ═══ */
  const renderAcoes = () => (
    <div className="space-y-6">
      <div>
        <p className="tracking-[0.3em] uppercase mb-3" style={{ fontSize: "0.55rem", color: ACCENT }}>Plano de Acao Imediato</p>
        <h1 className="text-white" style={{ fontSize: "clamp(1.3rem, 4vw, 1.8rem)", fontWeight: 600 }}>
          Top 5 Acoes Imediatas
        </h1>
        <p className="mt-2" style={{ fontSize: "0.8rem", color: TEXT_MED }}>
          Baseado nas entrevistas com os 10 lideres
        </p>
      </div>
      {resumoExecutivo.top5AcoesImediatas.map((acao, i) => (
        <div key={i} className="rounded-xl p-5" style={{ background: i === 0 ? "rgba(184,170,154,0.06)" : CARD_BG, border: `1px solid ${i === 0 ? "rgba(184,170,154,0.2)" : BORDER}` }}>
          <div className="flex items-start gap-4">
            <span className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: i === 0 ? "rgba(184,170,154,0.2)" : "rgba(255,255,255,0.05)", fontSize: "0.85rem", fontWeight: 600, color: i === 0 ? ACCENT : TEXT_MED }}>
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="text-white" style={{ fontSize: "0.88rem", fontWeight: 500, lineHeight: 1.5 }}>{acao.acao}</p>
              <div className="flex flex-wrap gap-3 mt-3">
                <span style={{ fontSize: "0.65rem", color: ACCENT }}>
                  <Users size={10} className="inline mr-1" />{acao.responsavel}
                </span>
                <span style={{ fontSize: "0.65rem", color: TEXT_MED }}>
                  ⏱ {acao.prazo}
                </span>
              </div>
              <div className="mt-2 rounded-lg px-3 py-2" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.1)" }}>
                <p style={{ fontSize: "0.7rem", color: "#4ADE80", lineHeight: 1.5 }}>
                  <Zap size={10} className="inline mr-1" />Impacto: {acao.impacto}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  /* ═══ MAIN ═══ */
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      {/* Mobile hamburger */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(10,10,10,0.9)", border: `1px solid ${BORDER}` }}>
        {sidebarOpen ? <X size={18} className="text-white" /> : <Menu size={18} className="text-white" />}
      </button>

      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ background: "rgba(10,10,10,0.98)", borderRight: `1px solid ${BORDER}`, backdropFilter: "blur(12px)" }}>
        {sidebar}
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 lg:hidden" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSidebarOpen(false)} />}

      <main ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12 lg:py-16">
          {viewMode === "resumo" && !selectedArea && renderResumo()}
          {viewMode === "dependencias" && !selectedArea && renderDependencias()}
          {viewMode === "acoes" && !selectedArea && renderAcoes()}
          {viewMode === "area" && selectedArea && renderAreaDetail(selectedArea)}
        </div>
      </main>
    </div>
  );
}
