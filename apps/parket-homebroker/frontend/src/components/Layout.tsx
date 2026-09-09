/**
 * Layout do Home Broker — sidebar compacta + topbar com ticker.
 * Roteamento via React Router; aqui só o frame visual.
 */
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, LogOut, TrendingUp, BookOpen, Headphones, ListOrdered, PanelLeftClose, PanelLeftOpen, FileSpreadsheet, BarChart3, Trophy, Volume2, VolumeX, CalendarDays, ShieldCheck, Play, Pause, CheckCircle2, Sun, Moon, Briefcase, Package, HardHat, Target, Star, Heart, History, Megaphone, FileBarChart, Share2 } from "lucide-react";
import { isMuted, setMuted as setSoundMuted } from "../lib/sound";
import { supabase } from "../lib/supabase";
import { signOut, canSeeMonitoramento, type AppUser } from "../lib/auth";
import { useEffect, useState } from "react";
// Ticker removido.

// Itens do NAV — to é relativo à raiz ("" = home).
// Flags de visibilidade:
//  - onlyAdmin: só admin/superadmin
//  - onlyGestor: gestor (manage perm) ou admin/superadmin
//  - onlyAprovador: Douglas + admin/superadmin (dept_leader NÃO entra)
//  - hideForVendedor: oculta pra quem é funcao_comercial = "vendedor" puro
//    (vendedor vê só: Dashboard, Pipeline, WhatsApp, Agendamentos, Orçamento)
const NAV = [
  { to: "", label: "Dashboard", icon: Activity, end: true },
  { to: "book/sdr", label: "Pipeline SDR", icon: ListOrdered, hint: "Funil de Entrada", hideForVendedor: true },
  { to: "oportunidades-sdr", label: "Oportunidades", icon: Target, hint: "Acompanhamento dos leads que você enviou pro Comercial", hideForVendedor: true, hideForAprovador: true },
  { to: "oportunidades", label: "Oportunidades", icon: Star, hint: "Cards que você favoritou no Pipeline", onlyAprovador: true },
  { to: "book/vendas", label: "Pipeline", icon: ListOrdered, hint: "Funil Comercial", hideForSdr: true },
  { to: "atendimento", label: "WhatsApp", icon: Headphones, hint: "Chat WhatsApp ao vivo" },
  { to: "sucesso-cliente", label: "Sucesso do Cliente", icon: Heart, hint: "Grupos WhatsApp de clientes (CS) — painel exclusivo", onlyAprovador: true },
  { to: "agendamentos", label: "Agendamentos", icon: CalendarDays, hint: "Reuniões semanais/mensais" },
  { to: "carteira", label: "Carteira", icon: Briefcase, hint: "Parceiros — arquitetos, engenheiros, gerenciadoras", hideForSdr: true },
  { to: "orcamento", label: "Orçamento", icon: FileSpreadsheet, hint: "Fila de propostas", hideForSdr: true },
  { to: "orcamento/aprovacao", label: "Aprovação Douglas", icon: CheckCircle2, hint: "Aprovar/rejeitar propostas finalizadas", onlyAprovador: true },
  { to: "amostras", label: "Amostras", icon: Package, hint: "Solicitar e acompanhar mostruário", hideForSdr: true },
  { to: "acompanhamento-obras", label: "Acompanhamento de Obras", icon: HardHat, hint: "Suas obras em produção · pós-venda", hideForSdr: true },
  { to: "scripts", label: "Scripts", icon: BookOpen, hideForVendedor: true, hideForSdr: true, hideForDouglas: true },
  { to: "performance", label: "Performance", icon: Trophy, hint: "Sua performance individual", hideForVendedor: true, hideForSdr: true, hideForDouglas: true },
  { to: "marketing", label: "Marketing", icon: Megaphone, hint: "Investimento em ads × custo por lead qualificado", onlyGestor: true },
  { to: "report", label: "Report", icon: FileBarChart, hint: "Relatório executivo por vendedor · leads do marketing + CAC por etapa", onlyGestor: true },
  // Social Selling — funil de relacionamento com arquitetos (WhatsApp + Instagram
  // pelo perfil da Parket). Operado pelo Vinicius; visível só admins + Vinicius.
  { to: "social-selling", label: "Social Selling", icon: Share2, hint: "Relacionamento com arquitetos · WhatsApp + Instagram", onlySocial: true },
  { to: "auditoria", label: "Auditoria", icon: ShieldCheck, hint: "Ligações Wavoip + gravações", hideForVendedor: true, hideForSdr: true, hideForDouglas: true },
  { to: "teca-monitor", label: "Teca Monitor", icon: Activity, hint: "Performance da Teca IA (Will/Douglas/Raphael)", hideForVendedor: true, hideForSdr: true, hideForDouglas: true },
  { to: "monitoramento", label: "Monitoramento", icon: History, hint: "Histórico de ações — quem moveu/apagou cards", onlyMonitor: true },
  { to: "admin/usuarios-comercial", label: "Usuários Comercial", icon: ShieldCheck, hint: "Gerenciar SDRs e Vendedores", onlyAdmin: true },
];

// Rotação de TV/Monitor — ciclo definido pelo Will
const KIOSK_ROUTES = [
  "", "book/sdr", "book/vendas", "atendimento",
  "agendamentos", "performance", "teca-monitor",
];
const KIOSK_INTERVAL_MS = 60_000; // 1min entre cada
const KIOSK_KEY = "hb-kiosk-mode-v1";

export function Layout({ appUser }: { appUser: AppUser }) {

  const location = useLocation();
  const [userPref, setUserPref] = useState<boolean>(() => localStorage.getItem("hb-sidebar-collapsed") === "1");
  // Override temporário (não persiste) — usado quando user expande manualmente
  // numa rota que recolhe automático (ex: /card/:id vindo do book)
  const [override, setOverride] = useState<boolean | null>(null);
  // Reset override toda vez que muda de rota (não persiste entre páginas)
  useEffect(() => { setOverride(null); }, [location.pathname]);

  // Rotas que forçam menu recolhido por default (mais espaço pro chat/dados)
  const forceCollapseRoute = location.pathname.startsWith("/card/");
  const collapsed = override !== null ? override : (forceCollapseRoute ? true : userPref);

  const toggleSidebar = () => {
    if (forceCollapseRoute) {
      setOverride(!collapsed);
    } else {
      const next = !collapsed;
      setUserPref(next);
      localStorage.setItem("hb-sidebar-collapsed", next ? "1" : "0");
    }
  };

  // ─── Modo Monitor (kiosk) — rotaciona páginas a cada 1min ─────
  const navigate = useNavigate();
  const fullKioskRoutes = KIOSK_ROUTES.map((r) => `/${r}`);
  const [kioskOn, setKioskOn] = useState<boolean>(() => localStorage.getItem(KIOSK_KEY) === "1");
  useEffect(() => {
    if (!kioskOn) return;
    // Não roda em rotas que não estão no ciclo (ex: /card/:id)
    const id = setInterval(() => {
      const cur = window.location.pathname;
      const idx = fullKioskRoutes.indexOf(cur);
      const next = idx === -1 ? fullKioskRoutes[0] : fullKioskRoutes[(idx + 1) % fullKioskRoutes.length];
      navigate(next);
    }, KIOSK_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kioskOn, navigate]);
  const toggleKiosk = () => {
    const next = !kioskOn;
    setKioskOn(next);
    localStorage.setItem(KIOSK_KEY, next ? "1" : "0");
    // Quando liga, pula pro início do ciclo pra começar limpo
    if (next && !fullKioskRoutes.includes(window.location.pathname)) {
      navigate(fullKioskRoutes[0]);
    }
  };

  // ─── Toggle global de som ─────────────────────────────────
  const [muted, setMutedLocal] = useState<boolean>(() => isMuted());
  useEffect(() => {
    const onChange = () => setMutedLocal(isMuted());
    window.addEventListener("hb-sound-changed", onChange);
    return () => window.removeEventListener("hb-sound-changed", onChange);
  }, []);
  const toggleSound = () => {
    const m = !muted;
    setMutedLocal(m);
    setSoundMuted(m);
  };

  // ─── Toggle tema (light/dark) — persiste via classe `.light` em <html>
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("hb-theme") as "dark" | "light") || "dark";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    try { localStorage.setItem("hb-theme", theme); } catch {}
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // ─── Contador de mensagens não-lidas (Sala Ao Vivo) ───────
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const recount = () => {
      if (!alive) return;
      // Carrega últimas msgs dos últimos 7 dias e marca quais não foram vistas pelo user
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      supabase
        .from("whatsapp_messages")
        .select("card_id, direction, timestamp")
        .gt("timestamp", since)
        .eq("direction", "in")
        .not("card_id", "is", null)
        .order("timestamp", { ascending: false })
        .limit(500)
        .then(({ data }) => {
          if (!alive || !data) return;
          // Pega a última msg "in" por card
          const latest = new Map<string, string>();
          (data as any[]).forEach((m) => {
            if (!latest.has(m.card_id)) latest.set(m.card_id, m.timestamp);
          });
          let readMap: Record<string, string> = {};
          try { readMap = JSON.parse(localStorage.getItem(`hb-read-${appUser.id}`) || "{}"); } catch {}
          let n = 0;
          latest.forEach((ts, cardId) => {
            const seen = readMap[cardId];
            if (!seen || seen < ts) n++;
          });
          setUnreadCount(n);
        });
    };
    recount();
    const id = setInterval(recount, 60000);
    // Reage a updates de localStorage (quando o user marca como lido em outra aba/click)
    const onStorage = (e: StorageEvent) => { if (e.key === `hb-read-${appUser.id}`) recount(); };
    window.addEventListener("storage", onStorage);
    // Realtime — nova mensagem entrando reconta
    const ch = supabase.channel("hb-layout-unread")
      .on("postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload: any) => { if (payload.new?.direction === "in") recount(); })
      .subscribe();
    return () => { alive = false; clearInterval(id); window.removeEventListener("storage", onStorage); supabase.removeChannel(ch); };
  }, [appUser.id]);

  return (
    <div className="flex h-screen bg-hb-bg text-hb-text">
      <aside className={`${collapsed ? "w-14" : "w-52"} shrink-0 bg-hb-sidebar border-r border-hb-border flex flex-col transition-[width] duration-200 relative`}>
        <div className={`${collapsed ? "p-2 justify-center" : "p-4"} border-b border-hb-border flex items-center gap-2`}>
          <div className="w-8 h-8 bg-hb-accent/15 border border-hb-accent/40 flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-hb-accent" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-display font-medium text-[13px] leading-tight tracking-[0.16em]">PARKET</div>
              <div className="text-[8px] uppercase tracking-[0.22em] text-hb-textDim mt-1">HOME BROKER</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={toggleTheme}
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
              aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              className="shrink-0 w-6 h-6 flex items-center justify-center text-hb-textDim hover:text-hb-text transition opacity-60 hover:opacity-100">
              {theme === "dark" ? <Sun size={11} /> : <Moon size={11} />}
            </button>
          )}
        </div>

        {/* Setinha pra recolher/expandir — flutuante na borda direita do sidebar,
            posicionada logo abaixo da barra de ticker (top:~58px) */}
        <button onClick={toggleSidebar}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3 top-[52px] z-30 w-6 h-6 rounded-full bg-hb-panel border border-hb-border text-hb-textDim hover:text-hb-text hover:border-hb-accent flex items-center justify-center shadow transition">
          {collapsed ? <PanelLeftOpen size={11} /> : <PanelLeftClose size={11} />}
        </button>

        <nav className={`flex-1 ${collapsed ? "p-1.5" : "p-2"} space-y-0.5 overflow-y-auto`}>
          {NAV.filter((n) => {
            const isAdminLike = appUser?.canSeeAll;
            // onlyAdmin — só admin/superadmin
            if ((n as any).onlyAdmin) {
              return appUser?.role === "admin" || appUser?.role === "superadmin";
            }
            // onlyMonitor — admins + Raphael (mesma regra da página/RLS)
            if ((n as any).onlyMonitor) {
              return canSeeMonitoramento(appUser);
            }
            // onlySocial — Social Selling: canSeeAll = admins + Vinicius (exatamente
            // a população que opera o funil de arquitetos)
            if ((n as any).onlySocial) {
              return !!isAdminLike;
            }
            // onlyGestor — gestor (manage perm) ou admin/superadmin
            if ((n as any).onlyGestor) {
              return appUser?.isGestor || isAdminLike;
            }
            // onlyAprovador (Aprovação Douglas) — Douglas + admin/superadmin
            // NÃO incluir dept_leader: a Parket tem todos os vendedores como
            // dept_leader, e Aprovação é função exclusiva do Douglas/admin.
            const emailLower = (appUser?.email || "").toLowerCase();
            const isAprovador = emailLower === "douglas@parket.com.br"
              || appUser?.role === "admin" || appUser?.role === "superadmin";
            if ((n as any).onlyAprovador) {
              return isAprovador;
            }
            // hideForAprovador — esconde item pro Douglas/admin (usado pra ocultar
            // a "Oportunidades" SDR pra ele, já que a versão dele é outra entrada)
            if ((n as any).hideForAprovador && isAprovador) {
              return false;
            }
            // hideForDouglas — esconde SÓ pra douglas@parket.com.br (não afeta
            // admins/superadmins). Usado pra abas que ele não precisa acessar:
            // Scripts, Análise técnica, Performance, Auditoria, Teca Monitor.
            if ((n as any).hideForDouglas && emailLower === "douglas@parket.com.br") {
              return false;
            }
            // hideForVendedor / hideForSdr — flags adicionais. Admin/gestor sempre vê.
            // Item pode ter AMBAS: aí pra ser escondido o user precisa bater em qualquer uma.
            // (early-return aqui era bug: hideForVendedor decidia antes de hideForSdr rodar.)
            const hideV = !!(n as any).hideForVendedor;
            const hideS = !!(n as any).hideForSdr;
            if (hideV || hideS) {
              if (isAdminLike || appUser?.isGestor) return true;
              const f = appUser?.funcaoComercial;
              if (hideV && f === "vendedor") return false;
              if (hideS && f === "sdr") return false;
              return true;
            }
            return true;
          }).map((n) => {
            const fullTo = n.to ? `/${n.to}` : "/";
            const badge = n.to === "atendimento" && unreadCount > 0 ? unreadCount : null;
            return (
              <NavLink key={n.to || "home"} to={fullTo} end={(n as any).end}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"} text-[10px] font-medium uppercase tracking-[0.10em] transition ${
                    isActive
                      ? "bg-hb-accent/15 text-hb-accent border-l-2 border-l-hb-accent border-t border-r border-b border-transparent"
                      : "text-hb-textDim hover:bg-hb-panelLight hover:text-hb-text border-l-2 border-l-transparent border-t border-r border-b border-transparent"
                  }`}
                title={collapsed ? `${n.label}${(n as any).hint ? " — " + (n as any).hint : ""}${badge ? ` (${badge} não lidas)` : ""}` : (n as any).hint}>
                <n.icon size={collapsed ? 16 : 12} className="shrink-0 opacity-70" />
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <div>{n.label}</div>
                    {(n as any).hint && <div className="text-[7px] opacity-50 tracking-[0.18em] mt-0.5 normal-case">{(n as any).hint}</div>}
                  </div>
                )}
                {badge && (
                  <span className={`${collapsed ? "absolute top-0.5 right-0.5" : ""} bg-hb-accent text-hb-bg text-[9px] font-bold tabular min-w-[16px] h-4 px-1 flex items-center justify-center`}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Toggle MODO MONITOR — rotaciona páginas a cada 1min. Restrito a admin/superadmin. */}
        {(appUser?.role === "admin" || appUser?.role === "superadmin") && (
          <button onClick={toggleKiosk}
            title={kioskOn ? "Parar rotação automática de telas" : "Ativar rotação automática: muda de tela a cada 1min (Pregão, Books, Sala ao Vivo, Agendamentos, Performance, Teca Monitor)"}
            className={`${collapsed ? "p-2 justify-center" : "px-3 py-2 justify-start"} border-t border-hb-border ${
              kioskOn ? "text-hb-green animate-pulse" : "text-hb-textDim"
            } hover:bg-hb-panelLight flex items-center gap-2 text-[10px] transition`}>
            {kioskOn ? <Pause size={14} /> : <Play size={14} />}
            {!collapsed && <span>{kioskOn ? "Modo monitor ON" : "Modo monitor"}</span>}
          </button>
        )}

        {/* Toggle de som global — sutil no rodapé */}
        <button onClick={toggleSound}
          title={muted ? "Ativar sons (ganhos, novos leads, atribuições)" : "Silenciar todos os sons"}
          className={`${collapsed ? "p-2 justify-center" : "px-3 py-2 justify-start"} border-t border-hb-border ${
            muted ? "text-hb-textDim" : "text-hb-green"
          } hover:bg-hb-panelLight flex items-center gap-2 text-[10px] transition`}>
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          {!collapsed && <span>{muted ? "Sons mutados" : "Sons ativos"}</span>}
        </button>

        <div className={`${collapsed ? "p-1.5" : "p-3"} border-t border-hb-border space-y-2`}>
          {!collapsed ? (
            <>
              <div className="text-[10px] text-hb-textDim leading-tight">
                <div className="text-hb-text font-semibold truncate">{appUser.nome || appUser.email.split("@")[0]}</div>
                <div className="uppercase tracking-widest mt-0.5">{(() => {
                  // Prioriza função comercial (SDR/Vendedor/Ambos) — role técnica fica como fallback
                  if (appUser.role === "superadmin" || appUser.role === "admin") return appUser.role === "superadmin" ? "Super Admin" : "Admin";
                  if (appUser.funcaoComercial === "sdr") return "SDR";
                  if (appUser.funcaoComercial === "vendedor") return "Vendedor";
                  if (appUser.funcaoComercial === "ambos") return "SDR + Vendedor";
                  return appUser.role;  // fallback (viewer, dept_leader, etc)
                })()}</div>
              </div>
              <button onClick={() => signOut()} className="w-full text-[10px] text-hb-textDim hover:text-hb-red flex items-center gap-1.5">
                <LogOut size={10} /> Sair
              </button>
            </>
          ) : (
            <button onClick={() => signOut()}
              title={`${appUser.nome || appUser.email} · Sair`}
              className="w-full p-2 flex justify-center text-hb-textDim hover:text-hb-red">
              <LogOut size={14} />
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
