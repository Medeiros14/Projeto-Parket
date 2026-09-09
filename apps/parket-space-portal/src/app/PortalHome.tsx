import { useMemo, useState } from "react";
import {
  LogOut, Star, Sun, Moon, ChevronRight, Search,
  LayoutGrid, Layers, BookOpen, Sparkles, ShieldCheck,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import type { ThemeMode, ThemeTokens } from "./components/gestao/theme";
import type { AppUser } from "../lib/auth";
import type { PortalApp } from "../lib/portalData";
import parketLogo from "../imports/Captura_de_Tela_2026-06-12_a_s_12.20.58.png";

const CHAI  = "#968473";
const CREAM = "#C8BDB1";
const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY = "'Inter', sans-serif";

export interface BibModule {
  id: string;
  nome: string;
  desc: string;
  categoria: string;
}

export const BIB_MODULES: BibModule[] = [
  { id: "business-plan",         nome: "Business Plan",          desc: "Plano de negócio · Oportunidade · Financeiro",      categoria: "ESTRATÉGIA" },
  { id: "manual-marca",          nome: "Manual da Marca",        desc: "Logo · Cores · Tipografia · Voz · Aplicações",      categoria: "MARCA" },
  { id: "playbook-atendimento",  nome: "Playbook de Atendimento", desc: "Jornada comercial · Scripts · Padrões",            categoria: "COMERCIAL" },
  { id: "playbook-produto",      nome: "Playbook de Produto",     desc: "Linhas · Especificações · Aplicações",             categoria: "PRODUTO" },
  { id: "cultura-ritual",        nome: "Cultura & Ritual",        desc: "Valores · Rituais · Jeito Parket",                 categoria: "CULTURA" },
  { id: "workflow",              nome: "Workflow & Processos",    desc: "Fluxos entre setores · Handoffs · SLAs",           categoria: "OPERAÇÃO" },
];

interface PortalHomeProps {
  user: AppUser;
  apps: PortalApp[];          // já filtrados pelo acesso do usuário
  session: Session | null;
  theme: ThemeMode;
  onToggleTheme: () => void;
  T: ThemeTokens;
  onOpenModule: (id: string) => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

// SSO: apps *.parket.works usam o mesmo GoTrue (api.parket.works); passar a
// sessão no fragment loga automático via detectSessionInUrl do supabase-js.
function openApp(app: PortalApp, session: Session | null) {
  let url = app.url;
  if (session && /^https:\/\/[^/]*\.parket\.works/.test(url)) {
    const params = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: String(session.expires_in ?? 3600),
      token_type: "bearer",
    });
    if (session.expires_at) params.set("expires_at", String(session.expires_at));
    url = `${url.replace(/\/+$/, "")}/#${params.toString()}`;
  }
  window.open(url, "_blank", "noopener");
}

export function PortalHome({
  user, apps, session, theme, onToggleTheme, T, onOpenModule, onOpenAdmin, onLogout,
}: PortalHomeProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const destaque = apps.find((a) => a.destaque);
  const wides = apps.filter((a) => a.wide && !a.destaque);
  const gridApps = apps.filter((a) => !a.destaque && !a.wide);

  const categorias = useMemo(
    () => new Set(apps.map((a) => a.categoria)).size,
    [apps]
  );

  const stats = [
    { label: "Aplicativos Liberados", value: apps.length, icon: LayoutGrid },
    { label: "Categorias", value: categorias, icon: Layers },
    { label: "Setores", value: apps.filter((a) => a.categoria === "SETOR").length, icon: BookOpen },
    { label: "Novidades", value: apps.filter((a) => a.badge).length, icon: Sparkles },
  ];

  const q = search.trim().toLowerCase();
  const filtered = q
    ? gridApps.filter((a) =>
        a.nome.toLowerCase().includes(q) ||
        a.categoria.toLowerCase().includes(q) ||
        a.descricao.toLowerCase().includes(q))
    : gridApps;
  // Will 18/08: Biblioteca oculta por enquanto — trocar pra true quando for liberar.
  const SHOW_BIBLIOTECA = false;
  const bibModules = SHOW_BIBLIOTECA ? BIB_MODULES : [];
  const filteredBib = q
    ? bibModules.filter((m) =>
        m.nome.toLowerCase().includes(q) ||
        m.categoria.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q))
    : bibModules;

  const firstName = (user.nome || user.email).split(" ")[0];

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
            style={{ height: 20, width: "auto", filter: theme === "light" ? "invert(1)" : "none", transition: "filter 0.35s" }}
          />
          <div style={{ width: 1, height: 16, backgroundColor: T.border }} />
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.18em", color: T.textSecondary }}>
            SISTEMA OPERACIONAL
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.12em", color: T.textMuted }}>
            {firstName.toUpperCase()}
          </span>
          <button onClick={onToggleTheme} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "5px 14px",
            border: `1px solid ${T.border}`, background: T.cardBg, cursor: "pointer",
            fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em", color: T.textSecondary,
            transition: "border-color 0.2s, background 0.2s",
          }}>
            {theme === "dark" ? <><Sun size={10} /> MODO CLARO</> : <><Moon size={10} /> MODO ESCURO</>}
          </button>
          {user.isAdmin && (
            <button onClick={onOpenAdmin} style={{
              display: "flex", alignItems: "center", gap: 7, background: "none",
              border: `1px solid ${T.border}`, padding: "5px 14px", cursor: "pointer",
              color: T.textSecondary, fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em",
            }}>
              <ShieldCheck size={11} /> ACESSOS
            </button>
          )}
          <button onClick={onLogout} style={{
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
            Selecione o aplicativo para acessar — todos os sistemas da Parket
            em um só lugar, conforme o seu departamento.
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

        {/* Destaque */}
        {destaque && (
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
                    {destaque.nome.toUpperCase()}
                  </p>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textMuted, letterSpacing: "0.04em" }}>
                    {destaque.descricao}
                  </p>
                </div>
              </div>
              <button
                onClick={() => openApp(destaque, session)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 22px",
                  border: `1px solid ${T.border}`,
                  background: "none",
                  cursor: "pointer",
                  fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.16em",
                  color: T.textSecondary,
                  transition: "all 0.2s",
                }}>
                ACESSAR
                <ChevronRight size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 64px 24px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color={T.textMuted} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aplicativo ou categoria..."
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

        {/* Apps */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 64px 64px" }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.24em", color: T.textMuted, marginBottom: 24 }}>
            {filtered.length} {filtered.length === gridApps.length ? "APLICATIVOS" : `DE ${gridApps.length} APLICATIVOS`}
          </p>

          {/* Wide cards */}
          {!q && wides.map((app) => (
            <button
              key={app.id}
              onClick={() => openApp(app, session)}
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
                  {["#3D2B1F", "#6B4C35", "#8B6245", "#A07855"].map((c, i) => (
                    <div key={i} style={{ width: 28, height: 28, backgroundColor: c, borderRadius: 4 }} />
                  ))}
                </div>
                <div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.14em", color: T.textPrimary, fontWeight: 400, marginBottom: 4 }}>
                    {app.nome.toUpperCase()}
                  </p>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textSecondary, letterSpacing: "0.04em" }}>
                    {app.descricao}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {app.badge && (
                  <span style={{
                    fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em",
                    color: CREAM, backgroundColor: `${CHAI}30`, border: `1px solid ${CHAI}60`,
                    padding: "3px 10px",
                  }}>{app.badge}</span>
                )}
                <ChevronRight size={14} color={T.textMuted} />
              </div>
            </button>
          ))}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginTop: q ? 0 : 2 }}>
            {filtered.map((app) => (
              <button
                key={app.id}
                onClick={() => openApp(app, session)}
                onMouseEnter={() => setHovered(app.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  textAlign: "left",
                  background: hovered === app.id ? T.cardHover : T.cardBg,
                  border: `1px solid ${hovered === app.id ? T.borderHover : T.border}`,
                  padding: "32px", cursor: "pointer",
                  transition: "border-color 0.3s, background 0.3s",
                  display: "flex", flexDirection: "column", gap: 20, minHeight: 190,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 10 }}>
                      {app.categoria.toUpperCase()}
                    </p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.08em", color: T.textPrimary, fontWeight: 400, marginBottom: 6 }}>
                      {app.nome.toUpperCase()}
                    </p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textSecondary, letterSpacing: "0.03em" }}>
                      {app.descricao}
                    </p>
                  </div>
                  {app.badge && (
                    <span style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em", color: T.textSecondary, border: `1px solid ${T.border}`, padding: "3px 8px", flexShrink: 0 }}>
                      {app.badge}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
                  {(app.depts === null ? ["todos"] : app.depts.slice(0, 3)).map((d) => (
                    <span key={d} style={{
                      fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.1em",
                      color: T.textMuted, border: `1px solid ${T.border}`,
                      padding: "2px 8px",
                    }}>{d.toUpperCase()}</span>
                  ))}
                  {app.depts !== null && app.depts.length > 3 && (
                    <span style={{ fontFamily: FONT_BODY, fontSize: 8, color: T.textMuted }}>
                      +{app.depts.length - 3}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.18em", color: hovered === app.id ? T.textPrimary : T.textMuted, transition: "color 0.3s" }}>
                    ACESSAR
                  </span>
                  <div style={{
                    width: hovered === app.id ? 28 : 14, height: 1,
                    backgroundColor: hovered === app.id ? T.textSecondary : T.border,
                    transition: "width 0.3s, background-color 0.3s",
                  }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Biblioteca */}
        {filteredBib.length > 0 && (
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 64px 100px" }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.24em", color: T.textMuted, marginBottom: 24 }}>
              BIBLIOTECA PARKET
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
              {filteredBib.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onOpenModule(m.id)}
                  onMouseEnter={() => setHovered(`bib-${m.id}`)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    textAlign: "left",
                    background: hovered === `bib-${m.id}` ? T.cardHover : T.cardBg,
                    border: `1px solid ${hovered === `bib-${m.id}` ? T.borderHover : T.border}`,
                    padding: "28px 32px", cursor: "pointer",
                    transition: "border-color 0.3s, background 0.3s",
                    display: "flex", flexDirection: "column", gap: 16,
                  }}
                >
                  <div>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 10 }}>
                      {m.categoria}
                    </p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.08em", color: T.textPrimary, fontWeight: 400, marginBottom: 6 }}>
                      {m.nome.toUpperCase()}
                    </p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textSecondary, letterSpacing: "0.03em" }}>
                      {m.desc}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.18em", color: hovered === `bib-${m.id}` ? T.textPrimary : T.textMuted, transition: "color 0.3s" }}>
                      ABRIR
                    </span>
                    <div style={{
                      width: hovered === `bib-${m.id}` ? 28 : 14, height: 1,
                      backgroundColor: hovered === `bib-${m.id}` ? T.textSecondary : T.border,
                      transition: "width 0.3s, background-color 0.3s",
                    }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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
