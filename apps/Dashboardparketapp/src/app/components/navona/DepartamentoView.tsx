import { useState } from "react";
import {
  LayoutGrid, Bell, ChevronRight, ChevronDown, Plus,
  MoreHorizontal, ArrowLeft, Activity, AlertTriangle, Repeat2,
  Tag, Filter, ExternalLink, Home, Settings, Users,
  Clock, CheckSquare, Sun, Moon, Lightbulb, Zap,
} from "lucide-react";
import type { Department, KanbanCard, KanbanColumn, DepartmentId } from "./data-figma";
import { DEPT_MAP } from "./data-figma";
import type { ThemeMode, ThemeTokens } from "./theme";
import parketLogo from "../../../imports/Captura_de_Tela_2026-06-12_a_s_12.20.58.png";

const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY = "'Inter', sans-serif";

// Paleta Parket — 3 cores de destaque
const CREAM = "#C8BDB1";   // destaques sutis: fundo de tag, info
const CHAI  = "#968473";   // estado ativo, badge normal
const WALNUT = "#60544D";  // alerta, vencido, importante

function StatusDot({ status }: { status?: string }) {
  if (!status) return null;
  const color = status === "atrasado" ? WALNUT : status === "atencao" ? CHAI : "transparent";
  if (color === "transparent") return null;
  return <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />;
}

function KanbanCardItem({ card, T }: { card: KanbanCard; T: ThemeTokens }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: hov ? T.cardHover : T.cardBg,
        border: `1px solid ${hov ? T.borderHover : T.border}`,
        padding: "12px 14px", marginBottom: 6, cursor: "pointer",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <StatusDot status={card.status} />
          {card.assignees.slice(0, 1).map((a, i) => (
            <div key={i} style={{
              width: 20, height: 20, borderRadius: "50%",
              border: `1px solid ${T.border}`, backgroundColor: T.cardBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.06em", color: T.textSecondary, flexShrink: 0,
            }}>
              {a.name.charAt(0)}
            </div>
          ))}
          <span style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 300, color: T.textPrimary, letterSpacing: "0.02em", lineHeight: 1.4, flex: 1 }}>
            {card.title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
          {card.badge !== undefined && (
            <span style={{
              fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.08em",
              backgroundColor: WALNUT, color: CREAM,
              padding: "2px 6px", borderRadius: 2,
            }}>{card.badge}</span>
          )}
          <MoreHorizontal size={11} color={T.textMuted} />
        </div>
      </div>

      {/* Subtitle */}
      {card.subtitle && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textMuted, marginBottom: 6, lineHeight: 1.5, letterSpacing: "0.02em" }}>
          {card.subtitle}
        </p>
      )}

      {/* Value */}
      {card.value && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 9, color: CHAI, letterSpacing: "0.04em", marginBottom: 6 }}>
          {card.value}
        </p>
      )}

      {/* Tags */}
      {card.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: card.hasAbrir ? 8 : 0 }}>
          {card.tags.map((tag) => (
            <span key={tag} style={{
              fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.1em",
              color: T.textMuted,
              backgroundColor: `${CREAM}14`,
              border: `1px solid ${CREAM}30`,
              padding: "2px 7px",
            }}>{tag}</span>
          ))}
        </div>
      )}

      {card.hasAbrir && (
        <button style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 0", border: "none", borderTop: `1px solid ${T.border}`,
          background: "none", cursor: "pointer", color: T.textMuted,
          fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em", width: "100%", marginTop: 6,
        }}>
          <ExternalLink size={8} />
          ABRIR PROJETO
        </button>
      )}
    </div>
  );
}

function KanbanCol({ col, T }: { col: KanbanColumn; T: ThemeTokens }) {
  return (
    <div style={{ width: 248, flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 10, backgroundColor: T.border }} />
          <span style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.18em", color: T.textSecondary }}>
            {col.title.toUpperCase()}
          </span>
          <span style={{
            fontFamily: FONT_BODY, fontSize: 8, color: CREAM,
            backgroundColor: `${CREAM}18`, border: `1px solid ${CREAM}30`,
            padding: "1px 6px",
          }}>
            {col.cards.length}
          </span>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex", padding: 3 }}>
            <Plus size={11} />
          </button>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex", padding: 3 }}>
            <MoreHorizontal size={11} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {col.cards.map((card) => (
          <KanbanCardItem key={card.id} card={card} T={T} />
        ))}
      </div>
      <button style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "9px 0", border: "none", borderTop: `1px dashed ${T.border}`,
        background: "none", cursor: "pointer", color: T.textMuted,
        fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em", width: "100%", marginTop: 8,
      }}>
        <Plus size={9} /> NOVO CARD
      </button>
    </div>
  );
}

function SidebarLink({ label, icon, active, onClick, T, badge }: {
  label: string; icon?: React.ReactNode; active?: boolean; onClick?: () => void;
  T: ThemeTokens; badge?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, padding: "6px 10px",
        width: "100%", textAlign: "left",
        background: active ? `${CHAI}18` : hov ? T.cardBg : "none",
        border: "none",
        borderLeft: `2px solid ${active ? CHAI : "transparent"}`,
        cursor: "pointer",
        color: active ? CREAM : hov ? T.textSecondary : T.textMuted,
        fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.1em",
        transition: "all 0.15s", marginBottom: 1,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ opacity: 0.7 }}>{icon}</span>}
        {label.toUpperCase()}
      </span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.06em",
          backgroundColor: active ? WALNUT : CHAI,
          color: CREAM, padding: "1px 6px", borderRadius: 2, flexShrink: 0,
        }}>{badge}</span>
      )}
    </button>
  );
}

export interface DepartamentoViewProps {
  dept: Department;
  onBack: () => void;
  onGoDashboard: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  T: ThemeTokens;
}

export function DepartamentoView({ dept, onBack, onGoDashboard, theme, onToggleTheme, T }: DepartamentoViewProps) {
  const [activeNav, setActiveNav] = useState("kanban");
  const [activeTabId, setActiveTabId] = useState<DepartmentId>(dept.id);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(dept.sidebarSections.map((s) => [s.title, true]))
  );
  const [showSuggestion, setShowSuggestion] = useState(false);

  // The currently rendered department data (switches per tab)
  const activeDept: Department = activeTabId === dept.id
    ? dept
    : (DEPT_MAP[activeTabId] ?? dept);

  const toggleSection = (title: string) =>
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const displayName = activeDept.teamDesc.split("·")[0].trim();

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      backgroundColor: T.bg, color: T.textPrimary, overflow: "hidden",
      transition: "background 0.35s, color 0.35s",
    }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52,
        borderBottom: `1px solid ${T.border}`,
        backgroundColor: T.headerBg, flexShrink: 0, backdropFilter: "blur(12px)",
        transition: "background 0.35s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex", padding: 4 }}>
            <ArrowLeft size={14} />
          </button>
          <div style={{ width: 1, height: 16, backgroundColor: T.border }} />
          <img
            src={parketLogo}
            alt="Parket"
            style={{ height: 14, width: "auto", filter: theme === "light" ? "invert(1)" : "none", transition: "filter 0.35s" }}
          />
          <ChevronRight size={11} color={T.textMuted} />
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.16em", color: T.textSecondary }}>
            {dept.fullName.toUpperCase()}
          </p>
          <div style={{ width: 1, height: 16, backgroundColor: T.border }} />
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.08em", color: T.textMuted }}>
            {dept.breadcrumb}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onToggleTheme} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 12px", border: `1px solid ${T.border}`, background: T.cardBg,
            cursor: "pointer", fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.12em", color: T.textSecondary,
          }}>
            {theme === "dark" ? <><Sun size={10} /> CLARO</> : <><Moon size={10} /> ESCURO</>}
          </button>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}>
            <Bell size={14} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{
          width: 210, flexShrink: 0, backgroundColor: T.sidebarBg,
          borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column", overflowY: "auto", padding: "12px 0",
          transition: "background 0.35s",
        }}>
          {/* User */}
          <div style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "0 12px 12px", borderBottom: `1px solid ${T.border}`, marginBottom: 12,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: `1px solid ${T.border}`, backgroundColor: T.cardBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: FONT_DISPLAY, fontSize: 8, color: T.textSecondary, flexShrink: 0,
            }}>
              {dept.avatarInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.08em", color: T.textPrimary, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName.toUpperCase()}
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 8, color: T.textMuted, letterSpacing: "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {dept.userRole}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#4CAF50" }} />
              <Bell size={11} color={T.textMuted} />
            </div>
          </div>

          {/* Status */}
          <div style={{ padding: "0 12px", marginBottom: 14 }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.12em", color: T.textMuted, marginBottom: 2 }}>
              Online · Boa tarde, {displayName}
            </p>
          </div>

          {/* AÇÕES RÁPIDAS */}
          {dept.quickActions.length > 0 && (
            <div style={{ padding: "0 10px", marginBottom: 16 }}>
              <p style={{ fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.2em", color: T.textMuted, padding: "0 2px", marginBottom: 8 }}>
                AÇÕES RÁPIDAS
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                {dept.quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "5px 8px",
                      background: T.cardBg,
                      border: `1px solid ${T.border}`,
                      cursor: "pointer",
                      fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.08em",
                      color: T.textSecondary,
                      transition: "border-color 0.15s, background 0.15s",
                      gap: 4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = CHAI;
                      e.currentTarget.style.color = CREAM;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = String(T.border);
                      e.currentTarget.style.color = String(T.textSecondary);
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {qa.label}
                    </span>
                    {qa.badge !== undefined && (
                      <span style={{
                        fontFamily: FONT_BODY, fontSize: 7,
                        backgroundColor: WALNUT, color: CREAM,
                        padding: "1px 4px", borderRadius: 2, flexShrink: 0,
                      }}>{qa.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MEU DEPARTAMENTO */}
          <div style={{ padding: "0 10px", marginBottom: 16 }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.2em", color: T.textMuted, padding: "0 2px", marginBottom: 6 }}>
              MEU DEPARTAMENTO
            </p>
            <SidebarLink
              label="Meu Kanban"
              icon={<LayoutGrid size={10} />}
              active={activeNav === "kanban"}
              onClick={() => setActiveNav("kanban")}
              T={T}
              badge={activeDept.kanbanCount > 0 ? activeDept.kanbanCount : undefined}
            />
            <SidebarLink label="Dashboard & KPIs" icon={<Activity size={10} />} active={activeNav === "dashboard"} onClick={() => setActiveNav("dashboard")} T={T} />
            <SidebarLink label="Alertas" icon={<AlertTriangle size={10} />} active={activeNav === "alertas"} onClick={() => setActiveNav("alertas")} T={T} badge={activeDept.alertsCount > 0 ? activeDept.alertsCount : undefined} />
            <SidebarLink label="Handoffs" icon={<Repeat2 size={10} />} active={activeNav === "handoffs"} onClick={() => setActiveNav("handoffs")} T={T} badge={activeDept.handoffsCount > 0 ? activeDept.handoffsCount : undefined} />
          </div>

          {/* Department sections */}
          {dept.sidebarSections.map((section) => (
            <div key={section.title} style={{ padding: "0 10px", marginBottom: 14 }}>
              <button
                onClick={() => toggleSection(section.title)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", background: "none", border: "none", cursor: "pointer",
                  padding: "0 2px", marginBottom: 5,
                }}
              >
                <p style={{ fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.2em", color: T.textMuted }}>{section.title}</p>
                {openSections[section.title]
                  ? <ChevronDown size={8} color={T.textMuted} />
                  : <ChevronRight size={8} color={T.textMuted} />}
              </button>
              {openSections[section.title] && section.items.map((item) => (
                <SidebarLink key={item.label} label={item.label} T={T} />
              ))}
            </div>
          ))}

          <div style={{ flex: 1 }} />

          {/* Bottom */}
          <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 10px 0" }}>
            <SidebarLink label="CEO Dashboard" icon={<Home size={10} />} onClick={onGoDashboard} T={T} />
            <SidebarLink label="Gerenciar Usuários" icon={<Users size={10} />} T={T} />
            <SidebarLink label="Trocar Perfil" icon={<Settings size={10} />} onClick={onBack} T={T} />
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Sub-department tabs */}
          {dept.subDeptIds && dept.subDeptIds.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 0,
              borderBottom: `1px solid ${T.border}`,
              padding: "0 24px", flexShrink: 0,
              backgroundColor: T.sidebarBg,
            }}>
              {/* parent tab */}
              {[dept, ...dept.subDeptIds.map((id) => DEPT_MAP[id])].map((d, i) => {
                const isActive = d.id === activeTabId;
                // First tab in Compras says "TODOS (GESTOR)" only for the parent
                const label = dept.id === "compras" && i === 0 ? "TODOS · GESTOR" : d.name.toUpperCase();
                return (
                  <button
                    key={d.id}
                    onClick={() => setActiveTabId(d.id)}
                    style={{
                      padding: "10px 18px",
                      border: "none",
                      borderBottom: `2px solid ${isActive ? CHAI : "transparent"}`,
                      background: "none",
                      cursor: "pointer",
                      fontFamily: FONT_BODY,
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      color: isActive ? CREAM : T.textMuted,
                      transition: "color 0.15s, border-color 0.15s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                    {d.kanbanCount > 0 && (
                      <span style={{
                        marginLeft: 7,
                        fontFamily: FONT_BODY, fontSize: 8,
                        backgroundColor: isActive ? `${WALNUT}80` : `${T.border}`,
                        color: isActive ? CREAM : T.textMuted,
                        padding: "1px 5px", borderRadius: 2,
                      }}>{d.kanbanCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Toolbar */}
          <div style={{
            padding: "8px 20px", borderBottom: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { label: "TAGS", icon: <Tag size={9} /> },
                { label: "FILTRAR", icon: <Filter size={9} /> },
              ].map((b) => (
                <button key={b.label} style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "4px 12px",
                  border: `1px solid ${T.border}`, background: "none", cursor: "pointer",
                  color: T.textMuted, fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em",
                }}>
                  {b.icon}{b.label}
                </button>
              ))}
              {dept.suggestion && (
                <button
                  onClick={() => setShowSuggestion((v) => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "4px 12px",
                    border: `1px solid ${showSuggestion ? CHAI : T.border}`,
                    background: showSuggestion ? `${CHAI}18` : "none",
                    cursor: "pointer",
                    color: showSuggestion ? CREAM : T.textMuted,
                    fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em",
                    transition: "all 0.2s",
                  }}>
                  <Lightbulb size={9} />
                  INSIGHT PARKET
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 16px",
                border: `1px solid ${CHAI}`, background: `${CHAI}18`, cursor: "pointer",
                color: CREAM, fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em",
              }}>
                <Zap size={9} /> NOVA SOLICITAÇÃO
              </button>
              <button style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 16px",
                border: `1px solid ${T.borderHover}`, background: T.cardBg, cursor: "pointer",
                color: T.textPrimary, fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em",
              }}>
                <Plus size={9} /> NOVO CARD
              </button>
              <button style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                border: `1px solid ${T.border}`, background: "none", cursor: "pointer",
                color: T.textMuted, fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em",
              }}>
                COLUNAS
              </button>
            </div>
          </div>

          {/* Insight banner */}
          {showSuggestion && activeDept.suggestion && (
            <div style={{
              padding: "12px 24px",
              borderBottom: `1px solid ${T.border}`,
              backgroundColor: `${CHAI}10`,
              display: "flex", alignItems: "flex-start", gap: 12,
              flexShrink: 0,
            }}>
              <Lightbulb size={13} color={CHAI} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.2em", color: CHAI, marginBottom: 5 }}>
                  INSIGHT OPERACIONAL — PARKET
                </p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textSecondary, lineHeight: 1.8, fontWeight: 300 }}>
                  {activeDept.suggestion}
                </p>
              </div>
              <button onClick={() => setShowSuggestion(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, flexShrink: 0, fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em" }}>
                FECHAR
              </button>
            </div>
          )}

          {/* Alert banner */}
          {activeDept.alertBanner && (
            <div style={{
              padding: "10px 24px",
              borderBottom: `1px solid ${WALNUT}60`,
              backgroundColor: `${WALNUT}18`,
              display: "flex", alignItems: "flex-start", gap: 10,
              flexShrink: 0,
            }}>
              <AlertTriangle size={12} color={CREAM} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: CREAM, lineHeight: 1.6, fontWeight: 300, flex: 1 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.12em", color: CREAM, fontWeight: 500 }}>
                  {activeDept.alertBanner!.split("—")[0]}
                </span>
                {activeDept.alertBanner!.includes("—") && (
                  <span style={{ color: `${CREAM}99` }}> — {activeDept.alertBanner!.split("—")[1]}</span>
                )}
              </p>
            </div>
          )}

          {/* Greeting + stats */}
          <div style={{ padding: "14px 24px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 15, letterSpacing: "0.1em", color: T.textPrimary, fontWeight: 400, marginBottom: 4 }}>
                  {greeting}, {displayName}!
                </h2>
                <p style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textMuted, letterSpacing: "0.04em" }}>
                  {activeDept.kanbanCount} cards no Kanban · {activeDept.vencidosCount} vencidos · {activeDept.handoffsCount} handoffs pendentes
                </p>
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 8, color: T.textMuted, letterSpacing: "0.08em" }}>
                {dateStr} · {timeStr}
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 2 }}>
              {[
                { label: "CARDS ATIVAS", value: activeDept.kanbanCount, icon: <CheckSquare size={9} />, highlight: false },
                { label: "VENCIDAS", value: activeDept.vencidosCount, icon: <Clock size={9} />, highlight: activeDept.vencidosCount > 0 },
                { label: "HANDOFFS", value: activeDept.handoffsCount, icon: <Repeat2 size={9} />, highlight: false },
                { label: "ALERTAS", value: activeDept.alertsCount, icon: <AlertTriangle size={9} />, highlight: activeDept.alertsCount > 0 },
              ].map((s) => (
                <div key={s.label} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 18px",
                  border: `1px solid ${s.highlight ? WALNUT : T.border}`,
                  backgroundColor: s.highlight ? `${WALNUT}18` : T.statBg,
                  transition: "background 0.35s",
                }}>
                  <span style={{ color: s.highlight ? CREAM : T.textMuted }}>{s.icon}</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: s.highlight ? CREAM : s.value > 0 ? T.textPrimary : T.border, fontWeight: 400 }}>
                    {s.value}
                  </span>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.14em", color: s.highlight ? `${CREAM}99` : T.textMuted }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Kanban board */}
          <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", padding: "18px 24px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: "max-content" }}>
              {activeDept.columns.map((col) => (
                <KanbanCol key={col.id} col={col} T={T} />
              ))}
              <button style={{
                width: 190, flexShrink: 0, display: "flex", alignItems: "center", gap: 7,
                padding: "9px 14px", border: `1px dashed ${T.border}`, background: "none",
                cursor: "pointer", color: T.textMuted, fontFamily: FONT_BODY,
                fontSize: 8, letterSpacing: "0.14em", alignSelf: "flex-start",
              }}>
                <Plus size={9} /> NOVA COLUNA
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
