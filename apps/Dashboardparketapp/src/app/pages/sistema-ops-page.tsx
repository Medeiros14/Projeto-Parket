/* ═══════════════════════════════════════════════════════════════
   SISTEMA OPERACIONAL PARKET — Landing page (refactor Navona D.2.a-C)
   Mantém imports, hooks, auth, navegação intactos. Só visual.
   Tokens: bege travertino #D8D3C7, cinza pedra #77736A, off white #F3F0E8.
   Tipografia: Cinzel pra display, Inter pro corpo.
   ═══════════════════════════════════════════════════════════════ */
import { useState } from "react";
import { useNavigate } from "react-router";
import { allProfiles } from "../components/sistema-ops-data";
import {
  LayoutDashboard, ChevronRight, AlertTriangle, Clock, ArrowRightLeft,
  Search, Star, LogOut, UserCog,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

/* ─── Tokens Navona ─── */
const N_BG       = "#050505";                          // Preto Navona
const N_BEGE     = "#D8D3C7";                          // Bege Travertino — texto primário
const N_OFFWHITE = "#F3F0E8";                          // Off White Mineral
const N_STONE    = "#77736A";                          // Cinza Pedra — texto secundário
const N_MUTED    = "rgba(119,115,106,0.45)";           // texto desbotado
const N_CARD     = "rgba(216,211,199,0.025)";          // card bg sutil
const N_CARD_H   = "rgba(216,211,199,0.048)";          // card hover
const N_BORDER   = "rgba(216,211,199,0.08)";           // borda padrão
const N_BORDER_H = "rgba(216,211,199,0.18)";           // borda hover
const N_INPUT    = "rgba(216,211,199,0.04)";

const FONT_DISPLAY = "'Cinzel', Georgia, serif";
const FONT_BODY    = "'Inter', -apple-system, system-ui, sans-serif";

/* Route map for each department */
const DEPT_ROUTES: Record<string, string> = {
  comercial: "/comercial",
  projetos: "/projetos",
  compras: "/compras",
  producao: "/producao",
  logistica: "/logistica",
  obras: "/obras",
  financeiro: "/financeiro",
  atendimento: "/atendimento",
  fiscal: "/fiscal",
  produtividade: "/produtividade",
  marketing: "/marketing",
  rh: "/rh",
  orcamento: "/orcamento",
  ia: "/ia",
  layout: "/layout",
};

/* Quick status per dept */
function getDeptStatus(id: string): { cards: number; alerts: number; handoffs: number } {
  const p = allProfiles.find(x => x.id === id);
  if (!p) return { cards: 0, alerts: 0, handoffs: 0 };
  return {
    cards: p.columns.reduce((acc, col) => acc + col.cards.length, 0),
    alerts: p.alerts.filter(a => a.type === "critical").length,
    handoffs: p.handoffs.filter(h => h.status === "pendente").length,
  };
}

export function SistemaOpsPage() {
  const navigate = useNavigate();
  const { user, signOut, canAccessDept, isSuperAdmin, canAccessCeo } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";

  // Filtra por permissão + busca
  const accessibleProfiles = allProfiles.filter(p => canAccessDept(p.id));
  const filteredProfiles = accessibleProfiles.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.lider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* Global stats */
  const totalCards = allProfiles.reduce((acc, p) => acc + p.columns.reduce((a, c) => a + c.cards.length, 0), 0);
  const totalCritical = allProfiles.reduce((acc, p) => acc + p.alerts.filter(a => a.type === "critical").length, 0);
  const totalHandoffs = allProfiles.reduce((acc, p) => acc + p.handoffs.filter(h => h.status === "pendente").length, 0);
  const totalExpired = allProfiles.reduce((acc, p) => acc + p.columns.reduce((a, c) => a + c.cards.filter(x => x.slaStatus === "expired").length, 0), 0);

  return (
    <div style={{ background: N_BG, minHeight: "100vh", color: N_BEGE, fontFamily: FONT_BODY, transition: "background 0.35s, color 0.35s" }}>
      {/* Header — sidebar horizontal */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 10,
        borderBottom: `1px solid ${N_BORDER}`,
        background: "rgba(4,4,4,0.96)", backdropFilter: "blur(12px)",
        padding: "0 64px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 32, height: 32, border: `1px solid ${N_BORDER_H}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: "0.08em", color: N_BEGE,
          }}>P</div>
          <span style={{
            fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.22em",
            color: N_BEGE, textTransform: "uppercase",
          }}>Parket · Sistema Operacional</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28,
              border: `1px solid ${N_BORDER_H}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: FONT_BODY, fontSize: 10, letterSpacing: "0.06em",
              color: N_BEGE, background: N_CARD,
            }}>
              {user?.full_name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: N_STONE, letterSpacing: "0.04em" }}>
              {user?.full_name}
            </span>
          </div>
          {isSuperAdmin && (
            <button onClick={() => navigate("/admin/usuarios")} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
              background: "transparent", border: `1px solid ${N_BORDER_H}`, color: N_BEGE,
              fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.16em",
              textTransform: "uppercase", cursor: "pointer",
            }}>
              <UserCog size={11} /> Usuários
            </button>
          )}
          <button onClick={() => signOut().then(() => navigate("/login"))} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
            background: "transparent", border: `1px solid ${N_BORDER}`, color: N_STONE,
            fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.16em",
            textTransform: "uppercase", cursor: "pointer",
          }}>
            <LogOut size={11} /> Sair
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", paddingTop: 112, paddingLeft: 64, paddingRight: 64, paddingBottom: 64 }}>
        {/* Header — branding Cinzel */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.22em", color: N_MUTED, marginBottom: 12 }}>
            {greeting.toUpperCase()} · {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase()}
          </p>
          <h1 style={{
            fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: "clamp(28px, 4vw, 42px)",
            letterSpacing: "0.06em", color: N_BEGE, marginBottom: 16, lineHeight: 1.15,
          }}>
            SISTEMA OPERACIONAL PARKET
          </h1>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: N_STONE, maxWidth: 720, lineHeight: 1.7, fontWeight: 300 }}>
            Selecione seu departamento para acessar o painel completo — Kanban, KPIs, Alertas IA, Handoffs, Chat e Painel 360° de cada obra.
          </p>
        </div>

        {/* Global Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, marginBottom: 48, border: `1px solid ${N_BORDER}` }}>
          {[
            { label: "Cards Ativos", value: totalCards, icon: LayoutDashboard, highlight: false },
            { label: "Alertas Críticos", value: totalCritical, icon: AlertTriangle, highlight: totalCritical > 0 },
            { label: "Handoffs Pendentes", value: totalHandoffs, icon: ArrowRightLeft, highlight: totalHandoffs > 0 },
            { label: "SLAs Vencidos", value: totalExpired, icon: Clock, highlight: totalExpired > 0 },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{
                background: N_CARD, padding: "28px 32px",
                borderRight: i < 3 ? `1px solid ${N_BORDER}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Icon size={12} color={s.highlight ? N_BEGE : N_MUTED} />
                  <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.16em", color: N_MUTED, textTransform: "uppercase" }}>
                    {s.label}
                  </p>
                </div>
                <p style={{
                  fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 500,
                  letterSpacing: "0.04em", color: s.highlight ? N_BEGE : N_STONE, lineHeight: 1,
                }}>
                  {s.value}
                </p>
              </div>
            );
          })}
        </div>

        {/* Command Center — CEO link */}
        {canAccessCeo && (
          <button
            onClick={() => navigate("/ceo-dashboard")}
            onMouseEnter={() => setHovered("__ceo__")}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: "100%", textAlign: "left", cursor: "pointer",
              background: hovered === "__ceo__" ? N_CARD_H : N_CARD,
              border: `1px solid ${hovered === "__ceo__" ? N_BORDER_H : N_BORDER}`,
              padding: "28px 32px", marginBottom: 48,
              transition: "background 0.25s, border 0.25s",
              display: "flex", alignItems: "center", gap: 24,
            }}
          >
            <div style={{
              width: 48, height: 48, border: `1px solid ${N_BORDER_H}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Star size={18} color={N_BEGE} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.22em", color: N_MUTED, marginBottom: 6, textTransform: "uppercase" }}>
                Visão executiva
              </p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, letterSpacing: "0.08em", color: N_BEGE, marginBottom: 4 }}>
                CEO DASHBOARD — DOUGLAS & PAMELA
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: N_STONE, lineHeight: 1.6, fontWeight: 300 }}>
                Visão consolidada · 41 obras · 13 departamentos · Alertas IA · Financeiro · Equipes em campo
              </p>
            </div>
            <ChevronRight size={16} color={N_BEGE} style={{ opacity: hovered === "__ceo__" ? 1 : 0.5, transition: "opacity 0.25s" }} />
          </button>
        )}

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.22em", color: N_MUTED, textTransform: "uppercase" }}>
            {filteredProfiles.length} {filteredProfiles.length === accessibleProfiles.length ? "Departamentos" : `de ${accessibleProfiles.length} departamentos`}
          </p>
          <div style={{ flex: 1, height: 1, background: N_BORDER }} />
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 32 }}>
          <Search size={13} color={N_MUTED} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar departamento ou líder..."
            style={{
              width: "100%", background: N_INPUT, border: `1px solid ${N_BORDER}`,
              padding: "14px 16px 14px 44px", color: N_BEGE,
              fontFamily: FONT_BODY, fontSize: 12, letterSpacing: "0.02em",
              outline: "none",
            }}
          />
        </div>

        {/* Department Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 1, border: `1px solid ${N_BORDER}` }}>
          {filteredProfiles.map((p, idx) => {
            const status = getDeptStatus(p.id);
            const route = DEPT_ROUTES[p.id] || "/";
            const isHovered = hovered === p.id;
            return (
              <button
                key={p.id}
                onClick={() => navigate(route)}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isHovered ? N_CARD_H : N_CARD,
                  border: `1px solid ${isHovered ? N_BORDER_H : N_BORDER}`,
                  marginRight: -1, marginBottom: -1,
                  padding: "28px 32px", textAlign: "left", cursor: "pointer",
                  transition: "background 0.25s, border 0.25s",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
                  <div>
                    <p style={{
                      fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.22em",
                      color: N_MUTED, marginBottom: 8, textTransform: "uppercase",
                    }}>
                      {String(idx + 1).padStart(2, "0")} · {p.id}
                    </p>
                    <p style={{
                      fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: "0.06em",
                      color: N_BEGE, marginBottom: 4, textTransform: "uppercase",
                    }}>
                      {p.nome}
                    </p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: N_STONE, fontWeight: 300 }}>
                      {p.lider} · {p.cargo}
                    </p>
                  </div>
                  {status.alerts > 0 && (
                    <span style={{
                      fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em",
                      color: N_BEGE, border: `1px solid ${N_BORDER_H}`,
                      padding: "3px 8px", textTransform: "uppercase",
                    }}>
                      {status.alerts} {status.alerts === 1 ? "alerta" : "alertas"}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <LayoutDashboard size={10} color={N_MUTED} />
                      <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: N_STONE, letterSpacing: "0.04em" }}>
                        {status.cards} cards
                      </span>
                    </div>
                    {status.handoffs > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ArrowRightLeft size={10} color={N_MUTED} />
                        <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: N_STONE, letterSpacing: "0.04em" }}>
                          {status.handoffs} handoffs
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} color={isHovered ? N_BEGE : N_MUTED} style={{ transition: "color 0.25s" }} />
                </div>
              </button>
            );
          })}
        </div>

        {filteredProfiles.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: N_MUTED }}>
              Nenhum departamento encontrado para "{searchTerm}"
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 64, paddingTop: 24, borderTop: `1px solid ${N_BORDER}` }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.18em", color: N_MUTED, textTransform: "uppercase" }}>
            Sistema Operacional Parket v4.0 · 13 departamentos · 149 colaboradores · {totalCards} cards ativos
          </p>
        </div>
      </div>
    </div>
  );
}
