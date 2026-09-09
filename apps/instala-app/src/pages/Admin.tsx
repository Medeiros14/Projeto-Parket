import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Search, KeyRound, Send, MapPin, Users, ChevronDown, ChevronRight as CR, LogOut, AlertCircle, X } from "lucide-react";
import { sb } from "../lib/supabase";
import { useTheme } from "../lib/theme-context";
import { confirmar } from "../lib/confirmar";
import type { User } from "@supabase/supabase-js";

const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY = "'Inter', sans-serif";
const EVO_URL = "https://conect.parket.works";
const EVO_KEY = "4eab105201410d6865b86dca76ee9fa3";
const EVO_INSTANCE = "Parket";
const GESTAO_API = "https://gestao.parket.works";

// Slugs do kanban de projetos do gestao.parket.works. Se aparecer um slug novo
// aqui, cai no fallback (título capitalizado com hifen removido).
const FASE_GESTAO: Record<string, { label: string; cor: string }> = {
  "entrada":           { label: "Entrada",           cor: "#8B8681" },
  "pendente":          { label: "Pendente",          cor: "#C97A2A" },
  "acompanhamento":    { label: "Acompanhamento",    cor: "#5C8AA6" },
  "primeira-vistoria": { label: "1ª Vistoria",       cor: "#7BA394" },
  "segunda-vistoria":  { label: "2ª Vistoria",       cor: "#5F8E7C" },
  "pre-cronograma":    { label: "Pré-Cronograma",    cor: "#A8B37A" },
  "cronograma-final":  { label: "Cronograma Final",  cor: "#7BA394" },
  "obras-liberadas":   { label: "Obras Liberadas",   cor: "#C7A45B" },
  "reparos":           { label: "Reparos",           cor: "#D48A6A" },
  "travado":           { label: "Travado",           cor: "#B85B4C" },
  "projeto":           { label: "Projeto",           cor: "#7F6E9C" },
};
function faseInfo(slug: string | null | undefined) {
  if (!slug) return null;
  const hit = FASE_GESTAO[slug];
  if (hit) return hit;
  const label = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return { label, cor: "#6B6B6B" };
}

type Prest = {
  id: string;
  nome: string;
  telefone: string | null;
  categoria: string | null;
  pin: string | null;
};

type PrestVinc = Prest & { pc_id: string };

type Obra = {
  card_id: string;
  obra_code: string | null;
  cliente_nome: string;
  cidade: string | null;
  column_id: string | null;
  prestadores: PrestVinc[];
  gestao?: boolean;
};

export function Admin() {
  const { T } = useTheme();
  const nav = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [readyAuth, setReadyAuth] = useState(false);

  // login
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInErr, setSignInErr] = useState<string | null>(null);

  // dados
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [todosPrests, setTodosPrests] = useState<Prest[]>([]);
  const [vincSel, setVincSel] = useState<Record<string, string>>({});
  // Multi-seleção: cardId -> array de prestador ids selecionados (ainda não vinculados).
  const [multiSel, setMultiSel] = useState<Record<string, string[]>>({});
  const [buscaPrest, setBuscaPrest] = useState<Record<string, string>>({});

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReadyAuth(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    // 1) cards do dept operacional (e obras/projetos como fallback) com prestadores vinculados
    const [{ data: pcs }, { data: cards }, { data: prests }, gestao] = await Promise.all([
      sb.from("prestador_card").select("id,prestador_id,card_id").limit(5000),
      sb.from("kanban_cards")
        .select("id,obra,title,column_id,dept_id,details")
        .in("dept_id", ["operacional", "obras", "projetos"])
        .limit(2000),
      sb.from("prestadores").select("id,nome,telefone,categoria,pin").eq("ativo", true).limit(3000),
      // Obras do gestao.parket.works (best-effort: gestão fora do ar não derruba o admin)
      fetch(`${GESTAO_API}/api/projetos`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [] as any[]),
    ]);

    const prestById = new Map<string, Prest>();
    for (const p of (prests as Prest[]) ?? []) prestById.set(p.id, p);
    setTodosPrests(((prests as Prest[]) ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome)));

    const byCard = new Map<string, PrestVinc[]>();
    for (const pc of (pcs as any[]) ?? []) {
      const p = prestById.get(pc.prestador_id);
      if (!p) continue;
      if (!byCard.has(pc.card_id)) byCard.set(pc.card_id, []);
      byCard.get(pc.card_id)!.push({ ...p, pc_id: pc.id });
    }

    const lista: Obra[] = ((cards as any[]) ?? [])
      .filter((c) => byCard.has(c.id))
      .map((c) => ({
        card_id: c.id,
        obra_code: c.obra,
        cliente_nome: c.title,
        cidade: c.details?.cidade ?? null,
        column_id: c.column_id,
        prestadores: byCard.get(c.id) ?? [],
      }));

    const jaTem = new Set(lista.map((o) => o.card_id));
    // Only obras: excluir a coluna "projeto" (leads que ainda não viraram obra).
    // Fases de obra reais: entrada, pendente, acompanhamento, primeira/segunda-vistoria,
    // pre-cronograma, cronograma-final, obras-liberadas, reparos, travado.
    for (const g of (gestao as any[]) ?? []) {
      if (!g?.card_id) continue;
      if ((g.column_id ?? "") === "projeto") continue;
      if (jaTem.has(g.card_id)) {
        const o = lista.find((x) => x.card_id === g.card_id)!;
        o.gestao = true;
        if (!o.obra_code && g.obra_code) o.obra_code = g.obra_code;
        continue;
      }
      jaTem.add(g.card_id);
      lista.push({
        card_id: g.card_id,
        obra_code: g.obra_code ?? null,
        cliente_nome: g.cliente ?? "-",
        cidade: g.endereco ?? null,
        column_id: g.column_id ?? null,
        prestadores: byCard.get(g.card_id) ?? [],
        gestao: true,
      });
    }

    lista.sort((a, b) => (a.cliente_nome || "").localeCompare(b.cliente_nome || ""));
    setObras(lista);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    reload();
    // Polling a cada 15s — pega mudanças de card/prestador/updates
    const id = setInterval(reload, 15000);
    // Realtime via Supabase channels (pra mudanças instantâneas)
    const ch = sb.channel("admin-instala")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "prestador_card" }, () => reload())
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "kanban_cards" }, () => reload())
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "instala_updates_cliente" }, () => reload())
      .subscribe();
    return () => { clearInterval(id); sb.removeChannel(ch); };
    // user?.id (não o objeto user): onAuthStateChange re-emite SIGNED_IN em refresh de token
    // e foco de aba com um objeto novo — usar o objeto re-dispara reload/resubscribe à toa
  }, [user?.id, reload]);

  async function signIn() {
    if (!email || !pass) { setSignInErr("Preencha email e senha"); return; }
    setSignInBusy(true); setSignInErr(null);
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    setSignInBusy(false);
    if (error) setSignInErr(error.message);
  }
  async function signOut() {
    await sb.auth.signOut(); setUser(null); setObras([]); setEmail(""); setPass("");
  }

  async function gerarPin(p: Prest, obraCardId: string) {
    setBusyId(`${obraCardId}:${p.id}`); setMsg(null);
    const { data, error } = await sb.rpc("fn_instala_gerar_pin", { p_prestador_id: p.id });
    if (error) { setMsg(`Erro: ${error.message}`); setBusyId(null); return; }
    const novoPin = String(data);
    setObras((arr) =>
      arr.map((o) => ({
        ...o,
        prestadores: o.prestadores.map((x) => x.id === p.id ? { ...x, pin: novoPin } : x),
      }))
    );
    setMsg(`✓ PIN ${novoPin} gerado pra ${p.nome}`);
    setBusyId(null);
  }

  async function enviarWA(p: Prest, obraCardId: string) {
    if (!p.pin) { setMsg("Gere o PIN primeiro"); return; }
    if (!p.telefone) { setMsg("Prestador sem telefone cadastrado"); return; }
    setBusyId(`${obraCardId}:${p.id}`); setMsg(null);
    const phone = p.telefone.replace(/\D/g, "");
    const numero = phone.startsWith("55") ? phone : `55${phone}`;
    const texto =
      `Olá ${p.nome.split(" ")[0]}! Você foi cadastrado no app de prestadores Parket.\n\n` +
      `🔑 Seu PIN de acesso: *${p.pin}*\n\n` +
      `Acesse: https://instala.parket.works\n\n` +
      `Guarde esse PIN. Qualquer dúvida, fale com a Parket.`;
    try {
      const r = await fetch(`${EVO_URL}/message/sendText/${encodeURIComponent(EVO_INSTANCE)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVO_KEY },
        body: JSON.stringify({ number: numero, text: texto }),
      });
      if (!r.ok) throw new Error(await r.text());
      setMsg(`✓ WhatsApp enviado pra ${p.nome}`);
    } catch (e: any) {
      setMsg(`Erro WhatsApp: ${e?.message ?? "falha"}`);
    } finally {
      setBusyId(null);
    }
  }

  async function vincular(o: Obra) {
    const ids = (multiSel[o.card_id] || []).filter(
      (pid) => !o.prestadores.some((p) => p.id === pid)
    );
    if (ids.length === 0) { setMsg("Escolha ao menos um prestador"); return; }
    setBusyId(`vinc:${o.card_id}`); setMsg(null);
    const rows = ids.map((pid) => ({ prestador_id: pid, card_id: o.card_id }));
    const { error } = await sb.from("prestador_card").insert(rows);
    if (error) setMsg(`Erro ao vincular: ${error.message}`);
    else {
      const nomes = ids
        .map((pid) => todosPrests.find((x) => x.id === pid)?.nome)
        .filter(Boolean);
      setMsg(`✓ ${ids.length} prestador${ids.length > 1 ? "es" : ""} vinculado${ids.length > 1 ? "s" : ""}: ${nomes.join(", ")}`);
      setMultiSel((s) => ({ ...s, [o.card_id]: [] }));
      setBuscaPrest((s) => ({ ...s, [o.card_id]: "" }));
      await reload();
    }
    setBusyId(null);
  }

  async function desvincular(o: Obra, p: PrestVinc) {
    if (!(await confirmar(`Desvincular ${p.nome} da obra ${o.cliente_nome}?`, "Sim, desvincular", "#ef4444"))) return;
    setBusyId(`${o.card_id}:${p.id}`); setMsg(null);
    const { error } = await sb.from("prestador_card").delete().eq("id", p.pc_id);
    if (error) setMsg(`Erro ao desvincular: ${error.message}`);
    else { setMsg(`✓ ${p.nome} desvinculado`); await reload(); }
    setBusyId(null);
  }

  function toggle(cardId: string) {
    const next = new Set(expanded);
    if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
    setExpanded(next);
  }

  // Prioridade de fase (menor = mais urgente, aparece antes). "sem-fase" no fim.
  const PRIO_FASE: Record<string, number> = {
    "reparos": 0, "travado": 1,
    "segunda-vistoria": 2, "primeira-vistoria": 3,
    "pendente": 4, "entrada": 5,
    "pre-cronograma": 6, "acompanhamento": 7,
    "cronograma-final": 8, "obras-liberadas": 9,
  };
  const prioFase = (slug: string | null | undefined) =>
    (slug && PRIO_FASE[slug] !== undefined) ? PRIO_FASE[slug] : 99;

  // Filtro por fase: "" = todas, "__sem_prest__" = sem prestador, senão slug.
  const [faseFiltro, setFaseFiltro] = useState<string>("");

  // Contagem por fase pra badges dos chips.
  const contPorFase = useMemo(() => {
    const c: Record<string, number> = { __all__: obras.length, __sem_prest__: 0 };
    for (const o of obras) {
      const k = o.column_id || "__sem_fase__";
      c[k] = (c[k] || 0) + 1;
      if (o.prestadores.length === 0) c.__sem_prest__++;
    }
    return c;
  }, [obras]);

  // Fases presentes ordenadas por prioridade — só as que têm ao menos uma obra.
  const fasesPresentes = useMemo(() => {
    const set = new Set<string>();
    obras.forEach(o => o.column_id && set.add(o.column_id));
    return Array.from(set).sort((a, b) => prioFase(a) - prioFase(b));
  }, [obras]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    let list = obras;
    if (k) {
      list = list.filter((o) =>
        (o.cliente_nome ?? "").toLowerCase().includes(k)
        || (o.obra_code ?? "").toLowerCase().includes(k)
        || o.prestadores.some((p) => p.nome.toLowerCase().includes(k))
      );
    }
    if (faseFiltro === "__sem_prest__") {
      list = list.filter(o => o.prestadores.length === 0);
    } else if (faseFiltro) {
      list = list.filter(o => o.column_id === faseFiltro);
    }
    // Ordena por prioridade da fase primeiro, depois alfabético do cliente.
    return [...list].sort((a, b) => {
      const d = prioFase(a.column_id) - prioFase(b.column_id);
      if (d !== 0) return d;
      return (a.cliente_nome || "").localeCompare(b.cliente_nome || "");
    });
  }, [obras, q, faseFiltro]);

  const totalPrest = obras.reduce((s, o) => s + o.prestadores.length, 0);

  if (!readyAuth) {
    return (
      <div style={{
        minHeight: "100vh", background: T.bg, color: T.textMuted,
        display: "grid", placeItems: "center", fontFamily: FONT_BODY, fontSize: 11, letterSpacing: "0.2em",
      }}>CARREGANDO…</div>
    );
  }

  if (!user) {
    return (
      <div style={{
        minHeight: "100vh", background: T.bg, color: T.textPrimary,
        display: "grid", placeItems: "center", padding: 24, fontFamily: FONT_BODY,
      }}>
        <div style={{ maxWidth: 360, width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 6, textAlign: "center" }}>Admin</p>
          <p style={{ fontSize: 10, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 22, textAlign: "center" }}>
            LOGIN PARKET
          </p>
          <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textSecondary, marginBottom: 8 }}>EMAIL</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            type="email" autoComplete="email" placeholder="seu@parket.com.br"
            style={inputStyle(T)} autoFocus
          />
          <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textSecondary, marginBottom: 8, marginTop: 14 }}>SENHA</p>
          <input value={pass} onChange={(e) => setPass(e.target.value)}
            type="password" autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            style={inputStyle(T)}
          />
          {signInErr && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={12} /> {signInErr}
            </div>
          )}
          <button onClick={signIn} disabled={signInBusy || !email || !pass} style={{
            width: "100%", padding: "13px 18px", marginTop: 20,
            background: T.textPrimary, color: T.bg, border: "none",
            fontSize: 11, letterSpacing: "0.22em", fontWeight: 600,
            cursor: signInBusy ? "not-allowed" : "pointer", opacity: signInBusy ? 0.6 : 1,
          }}>
            {signInBusy ? "ENTRANDO…" : "ENTRAR"}
          </button>
          <button onClick={() => nav("/")} style={{
            marginTop: 14, width: "100%", background: "transparent", border: "none",
            color: T.textMuted, fontSize: 10, letterSpacing: "0.18em", cursor: "pointer",
            textDecoration: "underline", textUnderlineOffset: 3,
          }}>
            VOLTAR PRO APP DO INSTALADOR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.textPrimary, fontFamily: FONT_BODY }}>
      <header style={{
        padding: "16px 22px", borderBottom: `1px solid ${T.border}`,
        background: T.headerBg, backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={() => nav("/")} style={iconBtn(T)} aria-label="Voltar">
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>
            ADMIN · {user.email}
          </p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500 }}>
            Obras × Prestadores
          </h1>
        </div>
        <button onClick={() => nav("/admin/central")} style={iconBtn(T)} title="Central de localização & registros">
          <MapPin size={14} />
        </button>
        <button onClick={reload} style={iconBtn(T)} aria-label="Atualizar">
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
        <button onClick={signOut} style={iconBtn(T)} aria-label="Sair">
          <LogOut size={14} />
        </button>
      </header>

      <main style={{ padding: "16px 22px 80px" }}>
        <button onClick={() => nav("/admin/central")} style={{
          width: "100%", boxSizing: "border-box", textAlign: "left",
          border: `1px solid ${T.borderHover ?? T.border}`, background: T.cardBg,
          padding: "16px 18px", cursor: "pointer", fontFamily: FONT_BODY,
          display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
          color: T.textPrimary,
        }}>
          <div style={{ padding: 10, background: T.statBg, border: `1px solid ${T.border}`, borderRadius: 999, color: T.textSecondary }}>
            <MapPin size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em" }}>Central de Pontos & Localização</div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>
              Mapa ao vivo · histórico de entrada/saída · pontos por funcionário
            </div>
          </div>
          <CR size={16} style={{ color: T.textMuted }} />
        </button>
        <div style={{
          display: "flex", gap: 14, marginBottom: 14,
          fontSize: 10, letterSpacing: "0.18em", color: T.textMuted,
        }}>
          <span>{filtered.length} OBRA{filtered.length !== 1 ? "S" : ""}</span>
          <span>·</span>
          <span>{totalPrest} VÍNCULO{totalPrest !== 1 ? "S" : ""}</span>
        </div>

        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por obra, cliente ou prestador…"
            style={{
              width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 32px",
              background: T.inputBg, border: `1px solid ${T.border}`, color: T.textPrimary,
              fontSize: 13, outline: "none", fontFamily: FONT_BODY,
            }}
          />
        </div>

        {msg && (
          <div style={{
            padding: "10px 14px", marginBottom: 12,
            background: msg.startsWith("✓") ? "#22c55e10" : "#ef444410",
            border: `1px solid ${msg.startsWith("✓") ? "#22c55e44" : "#ef444444"}`,
            fontSize: 12, color: msg.startsWith("✓") ? "#22c55e" : "#ef4444",
          }}>{msg}</div>
        )}

        {/* Chips-filtro por fase do kanban gestão. "Todas" e "Sem prestador"
             ficam fixos; as demais são as fases presentes em ordem de prioridade. */}
        {obras.length > 0 && (
          <div style={{
            display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14,
            paddingBottom: 12, borderBottom: `1px solid ${T.border}`,
          }}>
            {(() => {
              const chips: Array<{ key: string; label: string; cor: string; n: number }> = [
                { key: "", label: "Todas", cor: "#6B6B6B", n: contPorFase.__all__ },
                { key: "__sem_prest__", label: "Sem prestador", cor: "#B85B4C", n: contPorFase.__sem_prest__ },
                ...fasesPresentes.map(slug => {
                  const f = faseInfo(slug)!;
                  return { key: slug, label: f.label, cor: f.cor, n: contPorFase[slug] || 0 };
                }),
              ];
              return chips.map(c => {
                const on = faseFiltro === c.key;
                return (
                  <button key={c.key || "todas"}
                    onClick={() => setFaseFiltro(c.key)}
                    style={{
                      padding: "6px 12px", fontSize: 10, letterSpacing: "0.14em",
                      textTransform: "uppercase", cursor: "pointer",
                      background: on ? c.cor : c.cor + "18",
                      color: on ? "#0b0b0b" : c.cor,
                      border: `1px solid ${on ? c.cor : c.cor + "55"}`,
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontFamily: FONT_BODY, fontWeight: on ? 600 : 500,
                    }}>
                    {c.label}
                    <span style={{
                      background: on ? "#00000022" : c.cor + "22",
                      padding: "1px 6px", fontSize: 9, letterSpacing: 0,
                    }}>{c.n}</span>
                  </button>
                );
              });
            })()}
          </div>
        )}

        {loading && obras.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: T.textMuted, fontSize: 12 }}>
            Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: "28px 18px", textAlign: "center", color: T.textMuted,
            border: `1px dashed ${T.border}`, fontSize: 12,
          }}>
            Nenhuma obra encontrada.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((o) => {
              const exp = expanded.has(o.card_id);
              return (
                <div key={o.card_id} style={{
                  border: `1px solid ${T.border}`, background: T.cardBg,
                }}>
                  <button onClick={() => toggle(o.card_id)} style={{
                    width: "100%", textAlign: "left",
                    padding: "14px 16px", background: "transparent", border: "none",
                    color: T.textPrimary, cursor: "pointer", fontFamily: FONT_BODY,
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    {exp ? <ChevronDown size={14} /> : <CR size={14} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {o.cliente_nome}
                      </div>
                      <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 5, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {(() => {
                          const f = faseInfo(o.column_id);
                          return f ? (
                            <span style={{
                              padding: "2px 8px", fontSize: 9,
                              letterSpacing: "0.14em", textTransform: "uppercase",
                              background: f.cor + "22", color: f.cor,
                              border: `1px solid ${f.cor}66`,
                            }}>{f.label}</span>
                          ) : null;
                        })()}
                        {o.gestao && (
                          <span style={{ color: "#34D399", letterSpacing: "0.14em", fontSize: 9, textTransform: "uppercase" }}>Gestão</span>
                        )}
                        {o.obra_code && <span>{o.obra_code}</span>}
                        {o.cidade && <span>· {o.cidade}</span>}
                      </div>
                    </div>
                    <span style={{
                      padding: "3px 10px", fontSize: 10, letterSpacing: "0.1em",
                      background: T.statBg, border: `1px solid ${T.border}`,
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <Users size={10} /> {o.prestadores.length}
                    </span>
                  </button>
                  {exp && (
                    <div style={{ borderTop: `1px solid ${T.border}`, padding: "8px 0" }}>
                      {o.prestadores.length === 0 && (
                        <div style={{ padding: "10px 16px 6px 38px", fontSize: 11, color: T.textMuted }}>
                          Nenhum prestador vinculado ainda.
                        </div>
                      )}
                      {o.prestadores.map((p) => (
                        <div key={p.id} style={{
                          padding: "10px 16px 10px 38px",
                          display: "flex", alignItems: "center", gap: 12,
                          borderBottom: `1px solid ${T.border}40`,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: T.textPrimary }}>{p.nome}</div>
                            <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {p.categoria && <span>{p.categoria}</span>}
                              {p.telefone && <span>· {p.telefone}</span>}
                            </div>
                          </div>
                          <div style={{
                            fontFamily: "monospace", fontSize: 13, fontWeight: 700,
                            color: p.pin ? T.textPrimary : T.textMuted, minWidth: 48, textAlign: "center",
                            letterSpacing: "0.1em",
                          }}>
                            {p.pin ?? "-"}
                          </div>
                          <button onClick={() => gerarPin(p, o.card_id)}
                            disabled={busyId === `${o.card_id}:${p.id}`}
                            style={iconBtn(T)} title="Gerar/Regerar PIN">
                            <KeyRound size={12} />
                          </button>
                          <button
                            onClick={() => enviarWA(p, o.card_id)}
                            disabled={busyId === `${o.card_id}:${p.id}` || !p.pin || !p.telefone}
                            style={{ ...iconBtn(T), opacity: (!p.pin || !p.telefone) ? 0.3 : 1 }}
                            title="Enviar PIN no WhatsApp"
                          >
                            <Send size={12} />
                          </button>
                          <button
                            onClick={() => desvincular(o, p)}
                            disabled={busyId === `${o.card_id}:${p.id}`}
                            style={{ ...iconBtn(T), color: "#ef4444" }}
                            title="Desvincular da obra"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {(() => {
                        const sel = new Set(multiSel[o.card_id] || []);
                        const busca = (buscaPrest[o.card_id] || "").toLowerCase();
                        const disponiveis = todosPrests.filter(
                          (p) => !o.prestadores.some((x) => x.id === p.id)
                        );
                        const listaFiltro = busca
                          ? disponiveis.filter(
                              (p) =>
                                p.nome.toLowerCase().includes(busca) ||
                                (p.categoria ?? "").toLowerCase().includes(busca)
                            )
                          : disponiveis;
                        return (
                          <div style={{ padding: "10px 16px 6px 38px" }}>
                            <div style={{
                              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                              color: T.textMuted, marginBottom: 6,
                            }}>Adicionar prestadores</div>
                            <input
                              value={buscaPrest[o.card_id] ?? ""}
                              onChange={(e) =>
                                setBuscaPrest((s) => ({ ...s, [o.card_id]: e.target.value }))
                              }
                              placeholder="Buscar por nome ou categoria…"
                              style={{
                                width: "100%", padding: "8px 10px", background: T.inputBg,
                                border: `1px solid ${T.border}`, color: T.textPrimary,
                                fontSize: 12, outline: "none", fontFamily: FONT_BODY,
                                boxSizing: "border-box", marginBottom: 8,
                              }}
                            />
                            <div style={{
                              maxHeight: 180, overflow: "auto",
                              border: `1px solid ${T.border}`, background: T.cardBg,
                            }}>
                              {listaFiltro.length === 0 ? (
                                <div style={{ padding: 12, fontSize: 11, color: T.textMuted, textAlign: "center" }}>
                                  Nenhum prestador disponível.
                                </div>
                              ) : listaFiltro.map((p) => {
                                const on = sel.has(p.id);
                                return (
                                  <label key={p.id} style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "7px 12px", cursor: "pointer",
                                    background: on ? T.statBg : "transparent",
                                    borderLeft: `3px solid ${on ? "#34D399" : "transparent"}`,
                                    fontSize: 12,
                                  }}>
                                    <input type="checkbox" checked={on}
                                      onChange={() => {
                                        const next = new Set(sel);
                                        on ? next.delete(p.id) : next.add(p.id);
                                        setMultiSel((s) => ({ ...s, [o.card_id]: Array.from(next) }));
                                      }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ color: T.textPrimary, overflow: "hidden",
                                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
                                      {p.categoria && (
                                        <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 2 }}>
                                          {p.categoria}
                                        </div>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button
                                onClick={() => vincular(o)}
                                disabled={busyId === `vinc:${o.card_id}` || sel.size === 0}
                                style={{
                                  padding: "9px 16px", background: T.textPrimary, color: T.bg,
                                  border: "none", fontSize: 10, letterSpacing: "0.18em", fontWeight: 600,
                                  cursor: sel.size === 0 ? "not-allowed" : "pointer",
                                  opacity: sel.size === 0 ? 0.4 : 1,
                                }}
                              >
                                {sel.size === 0 ? "VINCULAR" : `VINCULAR ${sel.size}`}
                              </button>
                              {sel.size > 0 && (
                                <button
                                  onClick={() =>
                                    setMultiSel((s) => ({ ...s, [o.card_id]: [] }))
                                  }
                                  style={{
                                    padding: "9px 14px", background: "transparent",
                                    color: T.textMuted, border: `1px solid ${T.border}`,
                                    fontSize: 10, letterSpacing: "0.16em", cursor: "pointer",
                                  }}
                                >LIMPAR</button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center", justifyContent: "center",
});

const inputStyle = (T: any): React.CSSProperties => ({
  width: "100%", padding: "11px 14px", boxSizing: "border-box",
  background: T.inputBg, border: `1px solid ${T.border}`, color: T.textPrimary,
  fontSize: 14, outline: "none", fontFamily: FONT_BODY,
});
