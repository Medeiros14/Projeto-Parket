import { useState } from "react";
import { LogOut, Users, Star, AlertTriangle, Activity, Clock, CheckSquare, Sun, Moon, ChevronRight, X, Search } from "lucide-react";
import type { Department, DepartmentId } from "./data-figma";
import { DEPARTMENTS as DEFAULT_DEPARTMENTS } from "./data-figma";
import type { ThemeMode, ThemeTokens } from "./theme";
import parketLogo from "../../../imports/Captura_de_Tela_2026-06-12_a_s_12.20.58.png";

const CHAI  = "#968473";
const CREAM = "#C8BDB1";

interface NavonaDashboardProps {
  onSelectDept: (id: DepartmentId) => void;
  onGoInstaParket: () => void;
  onBack: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  T: ThemeTokens;
  /** Lista de departamentos (default: estática do data-figma). Phase 2: passa live. */
  departments?: Department[];
}

const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY = "'Inter', sans-serif";

const JORNADA_ETAPAS = [
  { id: "prospeccao",  label: "Prospecção",      desc: "Lead qualificado",              dept: "comercial"   },
  { id: "projeto",     label: "Projeto",          desc: "Medição · Projeto técnico",     dept: "projetos"    },
  { id: "orcamento",   label: "Orçamento",        desc: "Proposta aprovada · Lote",      dept: "orcamento"   },
  { id: "producao",    label: "Produção",         desc: "Beneficiamento em andamento",   dept: "producao"    },
  { id: "instalacao",  label: "Instalação",       desc: "Equipe em campo · Obra ativa",  dept: "operacional" },
];

function buildJornada(depts: Department[]) {
  const clientes: Record<string, { nome: string; etapa: number; coluna: string; dept: string }> = {};

  const deptEtapaIdx: Record<string, number> = {
    comercial: 0, projetos: 1, orcamento: 2, producao: 3, operacional: 4,
  };

  depts.forEach((dept) => {
    const etapaIdx = deptEtapaIdx[dept.id];
    if (etapaIdx === undefined) return;
    dept.columns.forEach((col) => {
      col.cards.forEach((card) => {
        const nome = card.title.split("·")[0].trim();
        if (!clientes[nome]) {
          clientes[nome] = { nome, etapa: etapaIdx, coluna: col.title, dept: dept.name };
        } else if (etapaIdx > clientes[nome].etapa) {
          clientes[nome] = { nome, etapa: etapaIdx, coluna: col.title, dept: dept.name };
        }
      });
    });
  });

  return Object.values(clientes);
}

function JornadaCliente({ T, onClose, depts }: { T: ThemeTokens; onClose: () => void; depts: Department[] }) {
  const clientes = buildJornada(depts);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 64px 48px" }}>
      <div style={{
        border: `1px solid ${T.border}`,
        backgroundColor: T.statBg,
        padding: "28px 32px",
        transition: "background 0.35s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 8 }}>
              CEO DASHBOARD · DOUGLAS & PAMELA
            </p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.12em", color: T.textPrimary }}>
              JORNADA DO CLIENTE — VISÃO OPERACIONAL
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex",
          }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2, marginBottom: 20 }}>
          {JORNADA_ETAPAS.map((etapa, i) => (
            <div key={etapa.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em", color: T.textMuted }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {i < 4 && <div style={{ flex: 1, height: 1, backgroundColor: T.border }} />}
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em", color: T.textSecondary, marginBottom: 3 }}>
                {etapa.label.toUpperCase()}
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textMuted }}>{etapa.desc}</p>
            </div>
          ))}
        </div>

        {clientes.length === 0 ? (
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.textMuted, textAlign: "center", padding: "24px 0" }}>
            Nenhum cliente ativo no momento.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {clientes.map((cliente) => (
              <div key={cliente.nome} style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2 }}>
                {JORNADA_ETAPAS.map((_, etapaIdx) => {
                  const isAtual = etapaIdx === cliente.etapa;
                  const isConcluido = etapaIdx < cliente.etapa;
                  const isPendente = etapaIdx > cliente.etapa;
                  return (
                    <div key={etapaIdx} style={{
                      padding: "10px 16px",
                      border: `1px solid ${isAtual ? T.borderHover : T.border}`,
                      backgroundColor: isAtual ? T.cardHover : isConcluido ? T.statBg : "transparent",
                      transition: "background 0.2s",
                    }}>
                      {isAtual && (
                        <div>
                          <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textPrimary, fontWeight: 400, marginBottom: 3, letterSpacing: "0.02em" }}>
                            {cliente.nome}
                          </p>
                          <p style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textSecondary, letterSpacing: "0.04em" }}>
                            {cliente.coluna}
                          </p>
                        </div>
                      )}
                      {isConcluido && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: T.textMuted }} />
                          <span style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textMuted, letterSpacing: "0.08em" }}>CONCLUÍDO</span>
                        </div>
                      )}
                      {isPendente && <div style={{ width: 20, height: 1, backgroundColor: T.border }} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 24, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
          {[
            { label: "EM ANDAMENTO", style: { border: `1px solid ${T.borderHover}`, backgroundColor: T.cardHover } },
            { label: "ETAPA CONCLUÍDA", style: { backgroundColor: T.statBg, border: `1px solid ${T.border}` } },
            { label: "AGUARDANDO", style: { border: `1px solid ${T.border}`, backgroundColor: "transparent" } },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 10, ...item.style }} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em", color: T.textMuted }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NavonaDashboard({ onSelectDept, onGoInstaParket, onBack, theme, onToggleTheme, T, departments }: NavonaDashboardProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [showJornada, setShowJornada] = useState(false);
  const [search, setSearch] = useState("");

  const DEPARTMENTS = departments ?? DEFAULT_DEPARTMENTS;

  const totalCards = DEPARTMENTS.reduce((acc, d) => acc + (d.kanbanCount ?? d.columns.reduce((a, c) => a + c.cards.length, 0)), 0);
  const totalAlerts = DEPARTMENTS.reduce((acc, d) => acc + d.alertsCount, 0);
  const totalHandoffs = DEPARTMENTS.reduce((acc, d) => acc + d.handoffsCount, 0);
  const totalVencidos = DEPARTMENTS.reduce((acc, d) => acc + (d.vencidosCount ?? 0), 0);

  const stats = [
    { label: "Cards Ativas", value: totalCards, icon: CheckSquare },
    { label: "Alertas Críticos", value: totalAlerts, icon: AlertTriangle },
    { label: "Handoffs Pendentes", value: totalHandoffs, icon: Activity },
    { label: "SLAs Vencidos", value: totalVencidos, icon: Clock },
  ];

  const visibleDepts = DEPARTMENTS.filter((d) => !d.hidden);

  const filtered = search.trim()
    ? visibleDepts.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.teamDesc.toLowerCase().includes(search.toLowerCase()) ||
        d.fullName.toLowerCase().includes(search.toLowerCase())
      )
    : visibleDepts;

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100vh", color: T.textPrimary, transition: "background 0.35s, color 0.35s" }}>
      {/* Header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 10,
        borderBottom: `1px solid ${T.border}`,
        padding: "0 64px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        backgroundColor: T.headerBg, backdropFilter: "blur(12px)", transition: "background 0.35s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src={parketLogo}
            alt="Parket"
            style={{
              height: 20,
              width: "auto",
              filter: theme === "light" ? "invert(1)" : "none",
              transition: "filter 0.35s",
            }}
          />
          <div style={{ width: 1, height: 16, backgroundColor: T.border }} />
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.18em", color: T.textSecondary }}>
            SISTEMA OPERACIONAL
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onToggleTheme} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "5px 14px",
            border: `1px solid ${T.border}`, background: T.cardBg, cursor: "pointer",
            fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em", color: T.textSecondary,
            transition: "border-color 0.2s, background 0.2s",
          }}>
            {theme === "dark" ? <><Sun size={10} /> MODO CLARO</> : <><Moon size={10} /> MODO ESCURO</>}
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 7, background: "none",
            border: `1px solid ${T.border}`, padding: "5px 14px", cursor: "pointer",
            color: T.textSecondary, fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em",
          }}>
            <Users size={11} /> USUÁRIOS
          </button>
          <button onClick={onBack} style={{
            display: "flex", alignItems: "center", gap: 7, background: "none", border: "none",
            cursor: "pointer", color: T.textMuted, fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em",
          }}>
            <LogOut size={11} /> SAIR
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingTop: 64 }}>
        {/* Hero */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 64px 36px", textAlign: "center" }}>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 36, letterSpacing: "0.08em", color: T.textPrimary, fontWeight: 400, marginBottom: 20 }}>
            SISTEMA OPERACIONAL PARKET
          </h1>
          <div style={{ width: 40, height: 1, backgroundColor: T.border, margin: "0 auto 24px" }} />
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.textMuted, lineHeight: 1.9, fontWeight: 300, maxWidth: 580, margin: "0 auto" }}>
            Selecione o departamento para acessar o painel completo —
            Kanban, KPIs, Alertas IA, Handoffs e Painel 360° de cada obra.
          </p>
        </div>

        {/* Stats */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 64px 56px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
          {stats.map((s) => (
            <div key={s.label} style={{
              border: `1px solid ${T.border}`, backgroundColor: T.statBg,
              padding: "28px 32px", display: "flex", flexDirection: "column", gap: 12, transition: "background 0.35s",
            }}>
              <s.icon size={14} color={T.textMuted} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: s.value > 0 ? T.textPrimary : T.border, fontWeight: 400, lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em", color: T.textSecondary }}>
                {s.label.toUpperCase()}
              </p>
            </div>
          ))}
        </div>

        {/* CEO Card */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 64px 40px" }}>
          <div style={{
            border: `1px solid ${T.borderHover}`, padding: "22px 32px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            backgroundColor: T.statBg, transition: "background 0.35s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <Star size={16} color={T.textMuted} />
              <div>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: "0.1em", color: T.textPrimary, marginBottom: 6 }}>
                  CEO DASHBOARD — DOUGLAS & PAMELA
                </p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textMuted, letterSpacing: "0.04em" }}>
                  Visão consolidada · 41 obras · 14 departamentos · Alertas IA · Financeiro · Equipes em campo
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowJornada((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 22px",
                border: `1px solid ${showJornada ? T.borderHover : T.border}`,
                background: showJornada ? T.cardHover : "none",
                cursor: "pointer",
                fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.16em",
                color: showJornada ? T.textPrimary : T.textSecondary,
                transition: "all 0.2s",
              }}>
              OPERACIONAL
              <ChevronRight size={10} style={{ transform: showJornada ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
            </button>
          </div>
        </div>

        {/* Jornada */}
        {showJornada && <JornadaCliente T={T} onClose={() => setShowJornada(false)} depts={DEPARTMENTS} />}

        {/* Search */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 64px 24px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color={T.textMuted} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar departamento ou líder..."
              style={{
                width: "100%",
                padding: "11px 14px 11px 38px",
                backgroundColor: T.inputBg,
                border: `1px solid ${T.border}`,
                color: T.textPrimary,
                fontFamily: FONT_BODY,
                fontSize: 12,
                outline: "none",
                boxSizing: "border-box",
                letterSpacing: "0.02em",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = String(T.borderHover))}
              onBlur={(e) => (e.currentTarget.style.borderColor = String(T.border))}
            />
          </div>
        </div>

        {/* Departments */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 64px 100px" }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.24em", color: T.textMuted, marginBottom: 24 }}>
            {filtered.length} {filtered.length === visibleDepts.length ? "DEPARTAMENTOS" : `DE ${visibleDepts.length} DEPARTAMENTOS`}
          </p>
          {/* InstaParket card — full width, before the dept grid */}
          <button
            onClick={onGoInstaParket}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = CHAI; e.currentTarget.style.background = `${CHAI}0C`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = String(T.border); e.currentTarget.style.background = T.cardBg; }}
            style={{
              width: "100%", textAlign: "left",
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              padding: "24px 32px", cursor: "pointer",
              transition: "border-color 0.3s, background 0.3s",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 2,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {["#3D2B1F","#6B4C35","#8B6245","#A07855"].map((c, i) => (
                  <div key={i} style={{ width: 28, height: 28, backgroundColor: c, borderRadius: 4 }} />
                ))}
              </div>
              <div>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.14em", color: T.textPrimary, fontWeight: 400, marginBottom: 4 }}>
                  INSTAPARKET
                </p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textSecondary, letterSpacing: "0.04em" }}>
                  Feed interno · Fotos de obra · Equipes em campo · Curtidas e comentários
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em",
                color: CREAM, backgroundColor: `${CHAI}30`, border: `1px solid ${CHAI}60`,
                padding: "3px 10px",
              }}>NOVO</span>
              <ChevronRight size={14} color={T.textMuted} />
            </div>
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {filtered.map((dept) => (
              <button
                key={dept.id}
                onClick={() => onSelectDept(dept.id)}
                onMouseEnter={() => setHovered(dept.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  textAlign: "left",
                  background: hovered === dept.id ? T.cardHover : T.cardBg,
                  border: `1px solid ${hovered === dept.id ? T.borderHover : T.border}`,
                  padding: "32px", cursor: "pointer",
                  transition: "border-color 0.3s, background 0.3s",
                  display: "flex", flexDirection: "column", gap: 20, minHeight: 190,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 10 }}>
                      {dept.id.toUpperCase()}
                    </p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.08em", color: T.textPrimary, fontWeight: 400, marginBottom: 6 }}>
                      {dept.name.toUpperCase()}
                    </p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textSecondary, letterSpacing: "0.03em" }}>
                      {dept.teamDesc}
                    </p>
                  </div>
                  {dept.alertsCount > 0 && (
                    <span style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em", color: T.textSecondary, border: `1px solid ${T.border}`, padding: "3px 8px" }}>
                      {dept.alertsCount} ALERTAS
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {[...Array(Math.min(dept.memberCount, 3))].map((_, i) => (
                    <div key={i} style={{
                      width: 22, height: 22, borderRadius: "50%",
                      border: `1px solid ${T.border}`, backgroundColor: T.cardBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: FONT_BODY, fontSize: 8, color: T.textSecondary,
                    }}>·</div>
                  ))}
                  <span style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textMuted, letterSpacing: "0.06em", marginLeft: 4 }}>
                    {dept.memberCount} MEMBROS
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.18em", color: hovered === dept.id ? T.textPrimary : T.textMuted, transition: "color 0.3s" }}>
                    ACESSAR KANBAN
                  </span>
                  <div style={{
                    width: hovered === dept.id ? 28 : 14, height: 1,
                    backgroundColor: hovered === dept.id ? T.textSecondary : T.border,
                    transition: "width 0.3s, background-color 0.3s",
                  }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "20px 64px", display: "flex", justifyContent: "space-between" }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em", color: T.textMuted }}>
            PARKET · SISTEMA OPERACIONAL INTERNO · 2026
          </p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em", color: T.textMuted }}>
            parket.com.br
          </p>
        </div>
      </div>
    </div>
  );
}
