import { useEffect, useMemo, useState } from "react";
import { fonts, useTheme, useTokens } from "./theme";
import { api, anexoUrl, ETAPAS_PROJETISTA, etapaProjetistaInfo, extrairCamposTemplate, extrairVendido, fmtBr, HttpError, labelCor, limparDesc, listaCor, parseEndereco, VENDIDO_RE, type AppUser, type Board, type BoardMeta, type CardLeve, type ProjetistaListItem } from "./api";
import { pushState, enablePush, disablePush, type PushState } from "./push";
import CardModal from "./components/CardModal";
import LoginScreen from "./components/LoginScreen";
import AtribuirModal from "./components/AtribuirModal";
import RelatorioView from "./components/RelatorioView";
import { CalendarioView, TimelineView, JornadaView, ListaView } from "./views";

/* ═══════════════════════════════════════════════════════════════════
   PROJETOS · PARKET — board do setor de Projetos (Thainara), 100%
   no banco local desde 02/09 (vínculo com o Trello cortado).
   Colunas = listas do board, na mesma ordem de sempre.
   Cards no padrão visual do kanban do compras.parket.works.
   Menu lateral: Kanban · Gestão de Equipe · Calendário · Timeline · Jornada.
   ═══════════════════════════════════════════════════════════════════ */

const SEM_RESP = "__sem_responsavel__";

const NAV: { path: string; icone: string; label: string; soGestora?: boolean }[] = [
  { path: "/", icone: "▦", label: "Kanban" },
  { path: "/lista", icone: "☰", label: "Lista" },
  { path: "/equipe", icone: "👥", label: "Gestão de Equipe" },
  { path: "/calendario", icone: "📅", label: "Calendário" },
  { path: "/timeline", icone: "▤", label: "Timeline" },
  { path: "/jornada", icone: "◈", label: "Jornada" },
  // BI de saúde do setor: expõe desempenho individual do time, só gestora vê.
  { path: "/relatorio", icone: "◉", label: "Relatório", soGestora: true },
];

/* Entrega a credencial do usuário logado pro widget do chat entre setores.
   O widget (server.parket.works/app.js) monta só se achar um token: ele varre
   o localStorage atrás da sessão do Supabase e, na falta dela, lê
   sessionStorage["pk-chat-token"]. O projetos não usa Supabase (login próprio
   contra user_profiles), então sem isso o balão do chat nunca aparecia aqui.
   O widget repolla a cada 2s, então basta gravar. */
function aplicarChatToken(u: AppUser) {
  if (u.chat_token) sessionStorage.setItem("pk-chat-token", u.chat_token);
}

export default function App() {
  const t = useTokens();
  const [mode, , toggleTheme] = useTheme();

  // ─── Gate de auth (Space GoTrue via user_profiles._senha) ───
  const [user, setUser] = useState<AppUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  useEffect(() => {
    api.authMe()
      .then(u => { setUser(u); aplicarChatToken(u); })
      .catch(() => setUser(null))
      .finally(() => setLoadingAuth(false));
  }, []);
  const sair = async () => {
    try { await api.authLogout(); } catch {}
    sessionStorage.removeItem("pk-chat-token");
    setUser(null);
  };

  const [board, setBoard] = useState<Board | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [fEtiquetas, setFEtiquetas] = useState<string[]>([]);
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(false);
  const [fMembro, setFMembro] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fCidade, setFCidade] = useState("");
  // Visão por grupo de produto (Will 01/09): "" = Todos, ou REVESTIMENTO /
  // MARCENARIA (card com os dois grupos aparece nas duas visões; card sem
  // itens no gestão só aparece em Todos). Persistida igual à view do gestão.
  const [fGrupo, setFGrupo] = useState<string>(
    () => localStorage.getItem("projetos_kanban_grupo") || "");
  const trocarGrupo = (g: string) => {
    setFGrupo(g);
    localStorage.setItem("projetos_kanban_grupo", g);
  };
  const [cardAberto, setCardAberto] = useState<string | null>(null);
  const [hover, setHover] = useState<{ c: CardLeve; cor: string; x: number; y: number } | null>(null);
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [atribuir, setAtribuir] = useState<{ cardId: string; x: number; y: number } | null>(null);
  const [atribuindo, setAtribuindo] = useState(false);
  const [rota, setRota] = useState(window.location.pathname);
  const [membroSel, setMembroSel] = useState<string | null>(null);
  // Se vem string com uuid, o AtribuirModal abre com essa obra pré-selecionada
  // (fluxo do botão "+ Atribuir" da lista do KPI). Boolean true = fluxo antigo
  // (dropdown vazio pra escolher).
  const [atribuirAberto, setAtribuirAberto] = useState<string | boolean>(false);
  const [notif, setNotif] = useState<PushState>({ state: "off" });
  useEffect(() => { if (user) pushState().then(setNotif); }, [user]);
  const toggleNotif = async () => {
    if (notif.state === "on") setNotif(await disablePush());
    else if (notif.state === "off" || notif.state === "blocked") setNotif(await enablePush());
  };

  const go = (p: string) => { window.history.pushState({}, "", p); setRota(p); };
  useEffect(() => {
    const f = () => setRota(window.location.pathname);
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, []);

  const load = () => api.board().then(b => { setBoard(b); setErro(""); })
    .catch(e => {
      // 401 = sessão expirou → volta pra tela de login
      if (e instanceof HttpError && e.status === 401) setUser(null);
      else setErro(String(e));
    });
  useEffect(() => {
    if (!user) return;
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, [user]);
  useEffect(() => { if (user) api.meta().then(setMeta).catch(() => {}); }, [user]);

  // Lista de projetistas (pra dashboard /equipe) — só a gestora vê algo útil,
  // porque projetista comum já vê só os cards dela no board.
  const [projetistas, setProjetistas] = useState<ProjetistaListItem[]>([]);
  // Lista carregada pra todo mundo (alimenta o dropdown de responsável no header
  // — se for projetista comum, o /api/projetistas só devolve dado leve não sensível).
  useEffect(() => {
    if (user) api.projetistas().then(d => setProjetistas(d.projetistas)).catch(() => {});
  }, [user]);

  const listaNome = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of board?.listas || []) m[l.id] = l.nome;
    return m;
  }, [board]);

  // Etiquetas em uso no board, com cor (pro filtro visual estilo Trello)
  const etiquetas = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of board?.cards || [])
      for (const lb of c.labels) if (lb.nome && !m.has(lb.nome)) m.set(lb.nome, lb.cor);
    return [...m.entries()].map(([nome, cor]) => ({ nome, cor }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [board]);

  const toggleEtiqueta = (nome: string) =>
    setFEtiquetas(v => (v.includes(nome) ? v.filter(x => x !== nome) : [...v, nome]));

  // Prioriza a lista de projetistas do setor (todo mundo que pode ser responsável,
  // incluindo a gestora Thainara pra ela também delegar/filtrar por ela mesma).
  // Fallback: nomes vistos nos cards do Trello, caso ainda não tenha projetista_id.
  const membros = useMemo(() => {
    const s = new Set<string>();
    for (const p of projetistas) if (p.nome) s.add(p.nome);
    for (const c of board?.cards || []) for (const m of c.membros) if (m.nome) s.add(m.nome);
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projetistas, board]);

  // Estados e cidades presentes nos cards do board (pra popular os dropdowns).
  const estadosCidades = useMemo(() => {
    const est = new Set<string>();
    const cidPorEst = new Map<string, Set<string>>();
    for (const c of board?.cards || []) {
      const { estado, cidade } = parseEndereco(c.endereco);
      if (estado) est.add(estado);
      if (cidade) {
        const key = estado || "";
        if (!cidPorEst.has(key)) cidPorEst.set(key, new Set());
        cidPorEst.get(key)!.add(cidade);
      }
    }
    return {
      estados: [...est].sort(),
      // Cidades do estado filtrado (ou todas se sem filtro)
      cidades: (fEstado
        ? [...(cidPorEst.get(fEstado) || new Set<string>())]
        : [...cidPorEst.values()].flatMap(s => [...s])
      ).sort(),
    };
  }, [board, fEstado]);

  // Busca + etiquetas (sem filtro de responsável — a view Equipe seleciona o membro por aba)
  const cardsBase = useMemo(() => {
    if (!board) return [] as CardLeve[];
    const q = busca.trim().toLowerCase();
    return board.cards.filter(c => {
      // Visão por grupo: card precisa ter >=1 item do grupo escolhido no
      // gestão. Card sem itens (grupos_produto vazio) só aparece em Todos.
      if (fGrupo && !(c.grupos_produto || []).includes(fGrupo)) return false;
      if (fEtiquetas.length && !c.labels.some(lb => fEtiquetas.includes(lb.nome))) return false;
      if (fEstado || fCidade) {
        const { estado, cidade } = parseEndereco(c.endereco);
        if (fEstado && estado !== fEstado) return false;
        if (fCidade && cidade !== fCidade) return false;
      }
      if (q) {
        // busca ampla: projeto, cliente (nome/descrição), etiqueta, responsável, coluna
        // + produtos vendidos (bloco "O QUE FOI VENDIDO" da descrição)
        // + cliente/endereço/CNPJ do gestao.projetos
        const blob = [
          c.nome, c.descricao, listaNome[c.lista_id],
          ...c.labels.map(lb => lb.nome), ...c.membros.map(mb => mb.nome),
          ...extrairVendido(c.descricao),
          c.cliente, c.endereco, c.cnpj_cpf,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [board, busca, fEtiquetas, fEstado, fCidade, fGrupo, listaNome]);

  const cardsFiltrados = useMemo(
    () => {
      if (!fMembro) return cardsBase;
      // Filtro casa por 2 caminhos: (a) o projetista com esse nome está entre
      // os responsáveis do card (modelo multi — NÃO usar c.projetista_id, que
      // é só o primeiro da lista); (b) nome bate em membros Trello (cards antigos).
      const projAlvo = projetistas.find(p => p.nome === fMembro);
      return cardsBase.filter(c =>
        (projAlvo && (c.responsaveis || []).some(r => r.projetista_id === projAlvo.id)) ||
        c.membros.some(mb => mb.nome === fMembro)
      );
    },
    [cardsBase, fMembro, projetistas]);

  const nVisiveis = cardsFiltrados.length;
  const filtrando = !!(busca.trim() || fEtiquetas.length || fMembro || fEstado || fCidade || fGrupo);
  const cardAtribuir = atribuir ? board?.cards.find(c => c.id === atribuir.cardId) : null;

  // Stats por projetista — cards do board por responsável.
  // Semelhante ao valor.parket/equipe do Raniere: para cada projetista,
  // conta ativos, liberados, atrasados, pra produção.
  // Card com N responsáveis conta pros N (obra atribuída a 2 pessoas aparece
  // na gestão das 2).
  const listaFinalidade = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of board?.listas || []) m[l.id] = l.nome.toLowerCase();
    return m;
  }, [board]);

  const equipeStats = useMemo(() => {
    const map = new Map<string, {
      p: ProjetistaListItem; ativos: number; finalizados: number;
      atrasados: number; producao: number;
    }>();
    for (const p of projetistas) {
      map.set(p.id, { p, ativos: 0, finalizados: 0, atrasados: 0, producao: 0 });
    }
    let semDelegar = 0;
    for (const c of board?.cards || []) {
      const resp = c.responsaveis || [];
      if (!resp.length) { semDelegar++; continue; }
      const nl = listaFinalidade[c.lista_id] || "";
      const atrasado = c.due && !c.due_complete && new Date(c.due) < new Date();
      const finalizado = /finalizado|feita/.test(nl);
      for (const r of resp) {
        const e = map.get(r.projetista_id);
        if (!e) continue;
        if (!finalizado) e.ativos++;
        if (finalizado) e.finalizados++;
        if (atrasado && !finalizado) e.atrasados++;
        if (/produção|producao|entrega|instalação|instalacao/.test(nl)) e.producao++;
      }
    }
    return {
      lista: [...map.values()].sort((a, b) => {
        // gestora primeiro, depois por nome
        if (a.p.papel !== b.p.papel) return a.p.papel === "gestora" ? -1 : 1;
        return a.p.nome.localeCompare(b.p.nome, "pt-BR");
      }),
      semDelegar,
    };
  }, [projetistas, board, listaFinalidade]);

  // (Trello members - só mantido pra outros lugares que ainda usam)
  const equipe = useMemo(() => {
    const m = new Map<string, { iniciais: string; n: number }>();
    for (const mb of meta?.membros || []) if (mb.nome) m.set(mb.nome, { iniciais: mb.iniciais, n: 0 });
    let semResp = 0;
    for (const c of cardsBase) {
      if (!c.membros.length) semResp++;
      for (const mb of c.membros) {
        if (!mb.nome) continue;
        const e = m.get(mb.nome) || { iniciais: mb.iniciais, n: 0 };
        e.n++; m.set(mb.nome, e);
      }
    }
    const lista = [...m.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0], "pt-BR"));
    return { lista, semResp };
  }, [meta, cardsBase]);

  // Quando um projetista é selecionado no dashboard, filtra o kanban
  // pelos responsáveis do card (novo modelo). Mantém compat com membroSel legado.
  const projetistaAtivo = membroSel && membroSel.length === 36
    ? projetistas.find(p => p.id === membroSel) || null
    : null;
  const membroAtivo = membroSel ?? equipe.lista[0]?.[0] ?? SEM_RESP;
  const cardsEquipe = useMemo(() => {
    if (projetistaAtivo) return cardsBase.filter(c =>
      (c.responsaveis || []).some(r => r.projetista_id === projetistaAtivo.id));
    if (membroAtivo === SEM_RESP) return cardsBase.filter(c => !c.membros.length);
    return cardsBase.filter(c => c.membros.some(mb => mb.nome === membroAtivo));
  }, [cardsBase, membroAtivo, projetistaAtivo]);

  const toggleMembroCard = async (c: CardLeve, membroId: string, on: boolean) => {
    setAtribuindo(true);
    try { await api.toggleMembro(c.id, membroId, on); await load(); }
    catch (e) { setErro(String(e)); }
    finally { setAtribuindo(false); }
  };

  const selectStyle: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textPrimary,
    padding: "7px 8px", fontSize: 11, outline: "none", maxWidth: 170,
  };

  /* Colunas do kanban (usadas na view Kanban e na Gestão de Equipe) */
  const renderColunas = (cs: CardLeve[], ocultarVazias: boolean) => {
    const porLista = new Map<string, CardLeve[]>();
    for (const c of cs) { const a = porLista.get(c.lista_id) || []; a.push(c); porLista.set(c.lista_id, a); }
    return (
      <div style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "hidden", display: "flex", gap: 10, padding: "14px 18px" }}>
        {board?.listas.map(l => {
          const cards = porLista.get(l.id) || [];
          if ((ocultarVazias || filtrando) && cards.length === 0) return null;
          const cor = listaCor(l.nome);
          return (
            <div key={l.id} style={{
              width: 290, minWidth: 290, display: "flex", flexDirection: "column",
              background: t.statBg, border: `1px solid ${t.border1}`, maxHeight: "100%",
              alignSelf: "flex-start", padding: 8,
            }}>
              <div style={{
                padding: "4px 6px 10px", display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                  <span title={l.nome} style={{
                    fontSize: 11, fontWeight: 600, color: t.textPrimary, letterSpacing: "0.04em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {l.nome}
                  </span>
                </div>
                <span style={{
                  fontSize: 10, color: t.textTertiary, background: t.card2,
                  padding: "2px 8px", borderRadius: 999, flexShrink: 0,
                }}>
                  {cards.length}
                </span>
              </div>
              <div onScroll={() => { setHover(null); setAtribuir(null); }}
                style={{ flex: "0 1 auto", overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, minHeight: 0 }}>
                {cards.map(c => (
                  <Linha key={c.id} c={c} t={t} cor={cor}
                    onClick={() => { setHover(null); setCardAberto(c.id); }}
                    onHover={(x, y) => setHover({ c, cor, x, y })}
                    onLeave={() => setHover(h => (h?.c.id === c.id ? null : h))}
                    onFiltrarEtiqueta={toggleEtiqueta}
                    onAtribuir={(x, y) => { setHover(null); setAtribuir(a => (a?.cardId === c.id ? null : { cardId: c.id, x, y })); }} />
                ))}
                {cards.length === 0 && (
                  <div style={{ padding: 16, textAlign: "center", color: t.textTertiary, fontSize: 10 }}>
                    Sem cards
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* Kanban INTERNO do projetista: 5 fases fixas (A Iniciar → Aprovado),
     paralelas às listas do Trello. Arrastar aqui só muda etapa_projetista
     no app (PATCH); o card do board principal NÃO se move (Will 25/08:
     "o que eles fazem nao move o card do kanban principal porem sobe as
     informacoes"). Usado: no "/" pra projetista logado e no /equipe
     quando a gestora abre um projetista específico. */
  const renderColunasProjetista = (cs: CardLeve[], pessoaId?: string | null) => {
    // A fase é POR PESSOA: num card com 2 responsáveis, cada um tem a sua.
    // pessoaId = de quem é o kanban aberto; sem ele cai no campo derivado
    // do card (primeiro responsável).
    const etapaDe = (c: CardLeve) => {
      const meu = pessoaId && (c.responsaveis || []).find(r => r.projetista_id === pessoaId);
      return (meu ? meu.etapa_projetista : c.etapa_projetista) || "a_iniciar";
    };
    // Agrupa por fase interna; card delegado sem fase (legado) cai em A Iniciar.
    const porEtapa = new Map<string, CardLeve[]>();
    for (const c of cs) {
      const k = etapaDe(c);
      const a = porEtapa.get(k) || []; a.push(c); porEtapa.set(k, a);
    }
    const soltar = async (cardId: string, etapa: string) => {
      const c = cs.find(x => x.id === cardId);
      if (!c || etapaDe(c) === etapa) return;
      try { await api.moverEtapaProjetista(cardId, etapa, pessoaId); await load(); }
      catch (e) { setErro(String(e)); }
    };
    return (
      <div style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "hidden", display: "flex", gap: 10, padding: "14px 18px" }}>
        {ETAPAS_PROJETISTA.map(et => {
          const cards = porEtapa.get(et.id) || [];
          return (
            <div key={et.id}
              // Drop target da fase: aceita o card arrastado e faz o PATCH.
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/card-id");
                if (id) soltar(id, et.id);
              }}
              style={{
                flex: 1, minWidth: 250, display: "flex", flexDirection: "column",
                background: t.statBg, border: `1px solid ${t.border1}`, maxHeight: "100%",
                borderTop: `2px solid ${et.cor}`, padding: 8,
              }}>
              <div style={{
                padding: "4px 6px 10px", display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: et.cor, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: t.textPrimary, letterSpacing: "0.06em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {et.nome}
                  </span>
                </div>
                <span style={{
                  fontSize: 10, color: t.textTertiary, background: t.card2,
                  padding: "2px 8px", borderRadius: 999, flexShrink: 0,
                }}>
                  {cards.length}
                </span>
              </div>
              <div onScroll={() => { setHover(null); setAtribuir(null); }}
                style={{ flex: "0 1 auto", overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, minHeight: 0 }}>
                {cards.map(c => (
                  // Wrapper draggable: leva o id do card no dataTransfer pro drop da coluna.
                  <div key={c.id} draggable
                    onDragStart={e => { setHover(null); e.dataTransfer.setData("text/card-id", c.id); }}>
                    <Linha c={c} t={t} cor={et.cor}
                      onClick={() => { setHover(null); setCardAberto(c.id); }}
                      onHover={(x, y) => setHover({ c, cor: et.cor, x, y })}
                      onLeave={() => setHover(h => (h?.c.id === c.id ? null : h))}
                      onFiltrarEtiqueta={toggleEtiqueta}
                      onAtribuir={(x, y) => { setHover(null); setAtribuir(a => (a?.cardId === c.id ? null : { cardId: c.id, x, y })); }} />
                  </div>
                ))}
                {cards.length === 0 && (
                  <div style={{ padding: 16, textAlign: "center", color: t.textTertiary, fontSize: 10 }}>
                    Sem cards
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loadingAuth) return (
    <div style={{
      minHeight: "100vh", background: t.bg, color: t.textTertiary,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
    }}>Carregando…</div>
  );
  if (!user) return <LoginScreen t={t} onLogin={u => { setUser(u); aplicarChatToken(u); }} />;

  return (
    // Shell raiz: 100vh cru fica errado dentro do body{zoom} (Chrome nao compensa
    // vh), sobra vao vazio embaixo. --pkz espelha o zoom (ver index.html).
    <div style={{ height: "calc(100vh / var(--pkz, 1))", display: "flex", background: t.bg }}>
      {/* ─── Menu lateral ─── */}
      <div style={{
        width: 172, flexShrink: 0, background: t.sidebarBg, borderRight: `1px solid ${t.border1}`,
        display: "flex", flexDirection: "column", paddingTop: 14,
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase",
          color: t.textTertiary, padding: "0 16px 12px",
        }}>
          Menu
        </div>
        {NAV.filter(item => !item.soGestora || user.is_gestora).map(item => {
          const ativo = rota === item.path;
          return (
            <button key={item.path} onClick={() => go(item.path)}
              style={{
                display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                padding: "10px 14px", cursor: "pointer", fontSize: 10.5, letterSpacing: "0.05em",
                background: ativo ? `${t.accent}1a` : "transparent",
                border: "none", borderLeft: `2px solid ${ativo ? t.accent : "transparent"}`,
                color: ativo ? t.textPrimary : t.textSecondary, fontWeight: ativo ? 600 : 400,
              }}>
              <span style={{ fontSize: 12, width: 16, textAlign: "center" }}>{item.icone}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ─── Conteúdo ─── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* ─── Header ─── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 22px",
          borderBottom: `1px solid ${t.border1}`, background: t.headerBg, flexWrap: "wrap",
        }}>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 15, letterSpacing: "0.28em",
            textTransform: "uppercase", color: t.textPrimary, fontWeight: 600,
          }}>
            Projetos <span style={{ color: t.accent }}>·</span> Parket
          </div>
          <div style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.06em" }}>
            {board ? (filtrando ? `${nVisiveis} de ${board.cards.length} cards` : `${board.cards.length} cards`) : "carregando…"}
          </div>
          {/* Seletor de modo de exibição no topo (mesmo padrão do gestão):
              Kanban | Lista. Navega entre as rotas "/" e "/lista". */}
          <div style={{ display: "flex" }}>
            {[["/", "Kanban"], ["/lista", "Lista"]].map(([path, rotulo], i) => (
              <button key={path} onClick={() => go(path)}
                title={`Ver board em modo ${rotulo.toLowerCase()}`}
                style={{
                  padding: "7px 12px",
                  background: rota === path ? t.accent : "transparent",
                  color: rota === path ? "#111" : t.textSecondary,
                  border: `1px solid ${t.border2}`,
                  borderLeft: i > 0 ? "none" : `1px solid ${t.border2}`,
                  fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.16em",
                  textTransform: "uppercase", cursor: "pointer",
                  fontWeight: rota === path ? 600 : 400,
                }}>
                {rotulo}
              </button>
            ))}
          </div>
          {/* Seletor de visão por grupo de produto (estilo botões de view do
              gestão): Todos | Revestimento | Marcenaria. Filtra os cards em
              todas as views (kanban, calendário, timeline, jornada). */}
          <div style={{ display: "flex" }}>
            {[["", "Todos"], ["REVESTIMENTO", "Revestimento"], ["MARCENARIA", "Marcenaria"]].map(([val, rotulo], i) => (
              <button key={val} onClick={() => trocarGrupo(val)}
                title={val ? `Só cards com item de ${rotulo.toLowerCase()} no gestão` : "Todos os cards"}
                style={{
                  padding: "7px 12px",
                  background: fGrupo === val ? t.accent : "transparent",
                  color: fGrupo === val ? "#111" : t.textSecondary,
                  border: `1px solid ${t.border2}`,
                  borderLeft: i > 0 ? "none" : `1px solid ${t.border2}`,
                  fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.16em",
                  textTransform: "uppercase", cursor: "pointer",
                  fontWeight: fGrupo === val ? 600 : 400,
                }}>
                {rotulo}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative" }}>
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar projeto, cliente, obra…"
              style={{
                background: t.inputBg, border: `1px solid ${t.border1}`, color: t.textPrimary,
                padding: "7px 26px 7px 12px", fontSize: 11, width: 230, outline: "none",
              }} />
            {busca && (
              <button onClick={() => setBusca("")} title="Limpar" style={{
                position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", color: t.textTertiary,
                cursor: "pointer", fontSize: 11, padding: 4,
              }}>✕</button>
            )}
          </div>
          <button onClick={() => setMostrarEtiquetas(v => !v)} title="Filtrar por etiquetas"
            style={{
              background: fEtiquetas.length ? `${t.accent}1f` : t.inputBg,
              border: `1px solid ${fEtiquetas.length ? t.accent : t.border1}`,
              color: fEtiquetas.length ? t.accent : t.textSecondary,
              padding: "7px 10px", fontSize: 11, cursor: "pointer",
            }}>
            🏷 Etiquetas{fEtiquetas.length ? ` (${fEtiquetas.length})` : ""} {mostrarEtiquetas ? "▴" : "▾"}
          </button>
          {rota !== "/equipe" && (
            <select value={fMembro} onChange={e => setFMembro(e.target.value)} style={selectStyle}
              title="Filtrar por responsável">
              <option value="">Responsável: todos</option>
              {membros.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <select value={fEstado} onChange={e => { setFEstado(e.target.value); setFCidade(""); }}
            style={{ ...selectStyle, maxWidth: 110 }} title="Filtrar por estado (UF)">
            <option value="">UF: todas</option>
            {estadosCidades.estados.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          <select value={fCidade} onChange={e => setFCidade(e.target.value)}
            style={{ ...selectStyle, maxWidth: 160 }} title="Filtrar por cidade">
            <option value="">Cidade: todas</option>
            {estadosCidades.cidades.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={toggleNotif}
            title={
              notif.state === "on" ? "Notificações ligadas — clique para desligar" :
              notif.state === "blocked" ? "Permissão bloqueada — libere no navegador" :
              notif.state === "unsupported" ? "Seu navegador não suporta" :
              "Ativar notificações do fiscal / aditivo"
            }
            style={{
              background: notif.state === "on" ? `${t.accent}1f` : t.inputBg,
              border: `1px solid ${notif.state === "on" ? t.accent : t.border1}`,
              color: notif.state === "on" ? t.accent : notif.state === "blocked" ? "#EF4444" : t.textSecondary,
              padding: "7px 10px", fontSize: 12, cursor: "pointer",
            }}>
            {notif.state === "on" ? "🔔" : notif.state === "blocked" ? "🔕" : "🔔"}
          </button>
          <button onClick={toggleTheme} title="Tema claro/escuro"
            style={{
              background: "transparent", border: `1px solid ${t.border2}`, color: t.textSecondary,
              padding: "7px 10px", cursor: "pointer", fontSize: 11,
            }}>
            {mode === "dark" ? "☀" : "☾"}
          </button>

          {/* Badge do usuário + logout */}
          <div title={`${user.nome} · ${user.email}\nPapel: ${user.papel}${user.especialidade !== "ambos" ? ` (${user.especialidade})` : ""}`}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "4px 10px",
              background: t.card1, border: `1px solid ${t.border1}`,
            }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: user.avatar_color, color: "#111", fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {(user.nome || user.email).trim().split(/\s+/).slice(0, 2)
                .map(s => s[0]).join("").toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <span style={{ fontSize: 10.5, color: t.textPrimary, fontWeight: 600 }}>
                {user.nome.split(" ")[0]}
              </span>
              <span style={{ fontSize: 8.5, color: t.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {user.papel}{user.especialidade !== "ambos" ? ` · ${user.especialidade}` : ""}
              </span>
            </div>
            <button onClick={sair} title="Sair" style={{
              background: "transparent", border: "none", color: t.textTertiary,
              cursor: "pointer", fontSize: 12, padding: "0 4px",
            }}>
              ⎋
            </button>
          </div>
        </div>

        {/* ─── Barra de etiquetas (filtro multi-seleção estilo Trello) ─── */}
        {(mostrarEtiquetas || fEtiquetas.length > 0) && (
          <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5,
            padding: "8px 22px", borderBottom: `1px solid ${t.border1}`, background: t.headerBg,
          }}>
            {etiquetas.map(e => {
              const ativo = fEtiquetas.includes(e.nome);
              return (
                <button key={e.nome} onClick={() => toggleEtiqueta(e.nome)}
                  title={ativo ? "Remover filtro" : "Filtrar por esta etiqueta"}
                  style={{
                    fontSize: 9, fontWeight: 600, padding: "3px 10px", cursor: "pointer",
                    color: "#111", background: labelCor(e.cor), borderRadius: 2,
                    border: `2px solid ${ativo ? t.textPrimary : "transparent"}`,
                    opacity: ativo || !fEtiquetas.length ? 1 : 0.45,
                  }}>
                  {ativo ? "✓ " : ""}{e.nome}
                </button>
              );
            })}
            {fEtiquetas.length > 0 && (
              <button onClick={() => setFEtiquetas([])} style={{
                background: "transparent", border: "none", color: t.textTertiary,
                cursor: "pointer", fontSize: 10, padding: "3px 6px",
              }}>
                ✕ limpar
              </button>
            )}
            {etiquetas.length === 0 && (
              <span style={{ fontSize: 10, color: t.textTertiary }}>Nenhuma etiqueta em uso.</span>
            )}
          </div>
        )}

        {erro && (
          <div style={{ padding: "8px 22px", fontSize: 10, color: "#EF4444" }}>{erro}</div>
        )}

        {/* ─── View ativa ─── */}
        {!board && !erro ? (
          <div style={{
            margin: "60px auto", fontFamily: fonts.cinzel, fontSize: 10,
            letterSpacing: "0.24em", textTransform: "uppercase", color: t.textTertiary,
          }}>
            Carregando board…
          </div>
        ) : rota === "/equipe" ? (
          projetistaAtivo ? (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{
                padding: "12px 22px", borderBottom: `1px solid ${t.border1}`,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <button onClick={() => setMembroSel(null)} style={{
                  background: "transparent", border: `1px solid ${t.border1}`,
                  color: t.textSecondary, padding: "6px 12px", fontSize: 10,
                  fontFamily: fonts.cinzel, letterSpacing: "0.14em",
                  textTransform: "uppercase", cursor: "pointer",
                }}>
                  ← Equipe
                </button>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: projetistaAtivo.avatar_color, color: "#111",
                  fontWeight: 700, fontSize: 12, display: "grid", placeItems: "center",
                }}>
                  {iniciaisDoNome(projetistaAtivo.nome)}
                </div>
                <div>
                  <div style={{
                    fontFamily: fonts.cinzel, fontSize: 13, fontWeight: 500,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: t.textPrimary,
                  }}>{projetistaAtivo.nome}</div>
                  <div style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.06em" }}>
                    {projetistaAtivo.email} · {projetistaAtivo.especialidade}
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: t.textTertiary }}>
                  {cardsEquipe.length} card{cardsEquipe.length === 1 ? "" : "s"} delegado{cardsEquipe.length === 1 ? "" : "s"}
                </span>
              </div>
              {/* Gestora abrindo um projetista: vê o kanban INTERNO dele
                  (5 fases), não as 20 listas do Trello. */}
              {renderColunasProjetista(cardsEquipe, projetistaAtivo.id)}
            </div>
          ) : (
            <EquipeDashboard t={t} board={board} equipeStats={equipeStats}
              listaFinalidade={listaFinalidade}
              onAbrir={id => setMembroSel(id)}
              onAtribuir={user.is_gestora ? (cardId?: string) => setAtribuirAberto(cardId || true) : undefined} />
          )
        ) : rota === "/lista" ? (
          // Lista: tabela agrupada por fase do board (espelho da view Lista do gestão)
          <ListaView listas={board?.listas || []} cards={cardsFiltrados} t={t} onOpen={id => setCardAberto(id)} />
        ) : rota === "/calendario" ? (
          <CalendarioView listas={board?.listas || []} cards={cardsFiltrados} t={t} onOpen={id => setCardAberto(id)} projetistas={projetistas} meuEmail={user.email} souGestora={user.is_gestora} />
        ) : rota === "/timeline" ? (
          <TimelineView listas={board?.listas || []} cards={cardsFiltrados} t={t} onOpen={id => setCardAberto(id)} />
        ) : rota === "/jornada" ? (
          <JornadaView listas={board?.listas || []} cards={cardsFiltrados} t={t} onOpen={id => setCardAberto(id)} />
        ) : rota === "/relatorio" && user.is_gestora ? (
          <RelatorioView t={t} onOpen={id => setCardAberto(id)} />
        ) : user.is_gestora ? (
          renderColunas(cardsFiltrados, false)
        ) : (
          // Projetista logado: o Kanban "/" é o kanban interno dele
          // (A Iniciar → Aprovado), só com os cards delegados a ele.
          // Passa o próprio id: em card compartilhado com outro responsável,
          // ele vê e move a SUA fase, não a do colega.
          renderColunasProjetista(cardsFiltrados, user.id)
        )}
      </div>

      {hover && !cardAberto && !atribuir && <Preview c={hover.c} cor={hover.cor} x={hover.x} y={hover.y} t={t} />}

      {/* ─── Popover de atribuição de projetista ─── */}
      {atribuir && cardAtribuir && !cardAberto && (
        <>
          <div onClick={() => setAtribuir(null)} style={{ position: "fixed", inset: 0, zIndex: 94 }} />
          <div style={{
            position: "fixed", zIndex: 95, width: 230,
            left: Math.min(atribuir.x, window.innerWidth - 246),
            top: Math.min(atribuir.y + 6, window.innerHeight - 300),
            background: t.bg, border: `1px solid ${t.border2}`,
            boxShadow: "0 14px 44px rgba(0,0,0,0.5)",
            opacity: atribuindo ? 0.7 : 1,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px", borderBottom: `1px solid ${t.border1}`,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: t.textTertiary,
              }}>
                👤 Atribuir projetista
              </span>
              <button onClick={() => setAtribuir(null)} style={{
                background: "transparent", border: "none", color: t.textTertiary,
                cursor: "pointer", fontSize: 12, padding: 2, lineHeight: 1,
              }}>✕</button>
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto", padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              {!meta && <span style={{ fontSize: 10, color: t.textTertiary, padding: 8 }}>Carregando…</span>}
              {meta?.membros.map(m => {
                const ativo = cardAtribuir.membros.some(x => x.id === m.id);
                return (
                  <button key={m.id} disabled={atribuindo}
                    onClick={() => toggleMembroCard(cardAtribuir, m.id, !ativo)}
                    style={{
                      textAlign: "left", fontSize: 11, cursor: "pointer", padding: "6px 9px",
                      background: ativo ? `${t.accent}22` : "transparent",
                      border: `1px solid ${ativo ? t.accent : t.border1}`, color: t.textPrimary,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      border: `1px solid ${t.border2}`, background: t.card1, color: t.textSecondary,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 7.5, fontWeight: 600, letterSpacing: "0.05em",
                    }}>
                      {m.iniciais || m.nome.charAt(0)}
                    </span>
                    <span style={{ flex: 1 }}>{m.nome}</span>
                    {ativo && <span style={{ color: t.accent, fontWeight: 700 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {atribuirAberto && (
        <AtribuirModal t={t} board={board} projetistas={projetistas}
          cardIdInicial={typeof atribuirAberto === "string" ? atribuirAberto : undefined}
          onClose={() => setAtribuirAberto(false)}
          onDone={() => { setAtribuirAberto(false); load(); }} />
      )}
      {/* onAtribuir: o botão dentro do card abre o mesmo AtribuirModal
          multi-responsável da Gestão de Equipe, com a obra pré-selecionada. */}
      {cardAberto && <CardModal id={cardAberto} t={t} user={user} listas={board?.listas || []}
        onChanged={load} onClose={() => setCardAberto(null)}
        onAtribuir={cid => setAtribuirAberto(cid)} />}
    </div>
  );
}

/* Renderiza o modelo de descrição do Trello (Vendedor/Arquiteto/Projetista/
   Fiscal/Caminho/E-mail) numa lista compacta com o label em NEGRITO e valor
   em cinza. Campo sem valor sai esmaecido pra virar "pendente" visualmente.
   Se o card não veio com o template (descrição livre), não mostra nada. */
function TemplateTrello({ desc, fiscais, t }: {
  desc: string; fiscais?: string[] | null; t: any;
}) {
  const campos = extrairCamposTemplate(desc);
  // Se a gestora atribuiu fiscais no Cloud, esse valor manda em cima do template
  // do Trello (que geralmente fica em branco). Se o template não tinha o campo
  // "Fiscal:" ainda, adiciona ele no fim pra aparecer mesmo assim.
  const nomesFiscal = (fiscais || []).filter(Boolean).join(", ");
  let jaTemFiscal = false;
  const finalCampos = campos.map(c => {
    if (/^Fiscal(\s+Responsável)?$/i.test(c.label)) {
      jaTemFiscal = true;
      return { label: c.label, valor: nomesFiscal || c.valor };
    }
    return c;
  });
  if (!jaTemFiscal && nomesFiscal) {
    finalCampos.push({ label: "Fiscal", valor: nomesFiscal });
  }
  if (finalCampos.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 6 }}>
      {finalCampos.map(c => (
        <div key={c.label} style={{
          fontSize: 9.5, lineHeight: 1.35,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          <b style={{ color: t.textSecondary, fontWeight: 700 }}>{c.label}:</b>{" "}
          <span style={{
            color: c.valor ? t.textSecondary : t.textTertiary,
            fontStyle: c.valor ? "normal" : "italic",
          }}>
            {c.valor || "(pendente)"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Card completo na coluna — todas as infos (etiquetas, responsáveis, prazo,
   contadores, capa). Hover mostra o preview ampliado com descrição. */
function Linha({ c, t, cor, onClick, onHover, onLeave, onFiltrarEtiqueta, onAtribuir }: {
  c: CardLeve; t: any; cor: string; onClick: () => void;
  onHover: (x: number, y: number) => void; onLeave: () => void;
  onFiltrarEtiqueta: (nome: string) => void;
  onAtribuir: (x: number, y: number) => void;
}) {
  const atrasado = c.due && !c.due_complete && new Date(c.due) < new Date();
  return (
    <div onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.background = t.cardHover;
        const r = e.currentTarget.getBoundingClientRect();
        onHover(r.right, r.top);
      }}
      onMouseLeave={e => { e.currentTarget.style.background = t.card2; onLeave(); }}
      style={{
        background: t.card2, border: `1px solid ${t.border1}`, cursor: "pointer",
        overflow: "hidden", transition: "background 0.12s", flexShrink: 0,
        borderLeft: `3px solid ${atrasado ? "#EF4444" : cor}`,
      }}>
      <div style={{ padding: "9px 11px" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {c.labels.length > 0 ? c.labels.map((lb, i) => (
            <span key={i} title={lb.nome ? `Filtrar por "${lb.nome}"` : ""}
              onClick={e => { if (lb.nome) { e.stopPropagation(); onFiltrarEtiqueta(lb.nome); } }}
              style={{
                fontSize: 8, letterSpacing: "0.04em", padding: "2px 7px", color: "#111",
                background: labelCor(lb.cor), fontWeight: 600, borderRadius: 2,
                cursor: lb.nome ? "pointer" : "default",
              }}>
              {lb.nome || "   "}
            </span>
          )) : (
            <span title="Abrir card para adicionar etiqueta" style={{
              fontSize: 8, letterSpacing: "0.04em", padding: "2px 7px",
              color: t.textTertiary, border: `1px dashed ${t.border2}`,
              fontWeight: 600, borderRadius: 2,
            }}>
              SEM ETIQUETA
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textPrimary, lineHeight: 1.35, marginBottom: 5 }}>
          {c.nome}
        </div>
        {/* Modelo de descrição do Trello (Vendedor/Arquiteto/Projetista/Fiscal/…):
            fica logo abaixo do título pra vender o card na hora de olhar o kanban.
            Label em negrito, valor em cinza. Vazios saem esmaecidos pra chamar atenção.
            Fiscal vem via Cloud (kanban_cards.details.fiscais[]) sobrescrevendo o
            template do Trello, então aparece assim que a gestora atribui. */}
        <TemplateTrello desc={c.descricao} fiscais={c.fiscais_nomes} t={t} />
        <div title="Atribuir projetista"
          onClick={e => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onAtribuir(r.left, r.bottom);
          }}
          style={{
            fontSize: 9.5, marginBottom: 5, cursor: "pointer",
            color: c.membros.length ? t.textSecondary : t.textTertiary,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
          👤 {c.membros.length ? c.membros.map(m => m.nome).join(" · ") : "atribuir…"}{" "}
          <span style={{ color: t.accent, fontSize: 9 }}>✎</span>
        </div>
        {/* Fase do kanban INTERNO do projetista: sobe pro board principal
            como chip, pra gestora ver em que pé o trabalho dele está
            sem o card do Trello se mover. */}
        {(() => {
          const et = etapaProjetistaInfo(c.etapa_projetista);
          return et ? (
            <div style={{ marginBottom: 5 }}>
              <span title="Fase no kanban do projetista" style={{
                fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 2,
                background: `${et.cor}22`, color: et.cor, border: `1px solid ${et.cor}`,
                letterSpacing: "0.06em",
              }}>
                {et.nome}
              </span>
            </div>
          ) : null;
        })()}
        {Array.isArray(c.tipos) && c.tipos.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
            {c.tipos.map(tp => (
              <span key={tp} style={{
                fontSize: 8, fontWeight: 600, padding: "2px 7px", borderRadius: 2,
                background: `${t.accent}22`, color: t.accent,
                border: `1px solid ${t.accent}`, letterSpacing: "0.04em",
              }}>
                {tp}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 9.5, color: t.textTertiary }}>
            {c.chk_total > 0 && (
              <span style={{ color: c.chk_done >= c.chk_total ? "#10B981" : t.textTertiary }}>
                ☑ {c.chk_done}/{c.chk_total}
              </span>
            )}
            {c.n_comentarios > 0 && <span>💬 {c.n_comentarios}</span>}
            {c.n_anexos > 0 && <span>📎 {c.n_anexos}</span>}
            {VENDIDO_RE.test(c.descricao || "") && (
              <span title="Card com bloco O QUE FOI VENDIDO" style={{
                color: t.accent, fontWeight: 700, letterSpacing: "0.06em", fontSize: 8.5,
              }}>
                ◆ VENDIDO
              </span>
            )}
            {c.tem_aditivo && (
              <span title="Cliente tem orçamento aditivo aberto no Valor" style={{
                color: "#8B5CF6", fontWeight: 700, letterSpacing: "0.06em", fontSize: 8.5,
                border: "1px solid #8B5CF655", padding: "1px 5px",
              }}>
                ◆ ADITIVO
              </span>
            )}
            {c.fiscal_novo && (
              <span title="O fiscal registrou algo novo neste card desde a última vez que você abriu"
                style={{
                  color: "#0A0A0A", background: "#F59E0B", fontWeight: 700,
                  letterSpacing: "0.06em", fontSize: 8.5, padding: "1px 6px",
                  animation: "pkt-pulse 1.6s ease-in-out infinite",
                }}>
                ◆ FISCAL NOVO
              </span>
            )}
            {c.aditivo_novo && (
              <span title="Novo aditivo desde a última vez que você abriu"
                style={{
                  color: "white", background: "#8B5CF6", fontWeight: 700,
                  letterSpacing: "0.06em", fontSize: 8.5, padding: "1px 6px",
                  animation: "pkt-pulse 1.6s ease-in-out infinite",
                }}>
                ◆ NOVO ADITIVO
              </span>
            )}
            {c.pendentes_projetos > 0 && (
              <span title={`${c.pendentes_projetos} item(ns) aguardando liberação de projetos`}
                style={{
                  color: "#EF4444", fontWeight: 700, letterSpacing: "0.06em", fontSize: 8.5,
                  border: "1px solid #EF444455", padding: "1px 5px",
                }}>
                {c.pendentes_projetos} PENDENTE{c.pendentes_projetos > 1 ? "S" : ""}
              </span>
            )}
          </div>
          <span style={{
            fontSize: 9.5, whiteSpace: "nowrap",
            color: atrasado ? "#EF4444" : c.due_complete ? "#10B981" : t.textTertiary,
          }}>
            {c.due ? <>{atrasado ? "⚠" : "⏱"} {fmtBr(c.due)}</> : "⏱ sem prazo"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* Preview flutuante ampliado no hover — card no padrão visual das referências
   do Sistema Operacional Parket (avatar com iniciais, tipografia espaçada, tags). */
function Preview({ c, cor, x, y, t }: { c: CardLeve; cor: string; x: number; y: number; t: any }) {
  const W = 400;
  const H = (c.capa ? 210 : 0) + 170 + (c.descricao ? 60 : 0);
  const left = x + 10 + W > window.innerWidth ? Math.max(8, x - 300 - W) : x + 10;
  const top = Math.max(8, Math.min(y - 40, window.innerHeight - H - 8));
  const atrasado = c.due && !c.due_complete && new Date(c.due) < new Date();
  return (
    <div style={{
      position: "fixed", left, top, width: W, zIndex: 90, pointerEvents: "none",
      background: t.bg, border: `1px solid ${t.border2}`,
      borderLeft: `3px solid ${atrasado ? "#EF4444" : cor}`,
      boxShadow: "0 14px 44px rgba(0,0,0,0.5)", overflow: "hidden",
    }}>
      {c.capa && (
        <img src={anexoUrl(c.capa)} alt=""
          style={{ width: "100%", height: 210, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ padding: "14px 16px" }}>
        {/* Top row: avatares + título (padrão KanbanCardItem do SO Parket) */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 1 }}>
            {(c.membros.length ? c.membros : [{ nome: "—", iniciais: "—" }]).slice(0, 3).map((m, i) => (
              <span key={i} title={m.nome} style={{
                width: 22, height: 22, borderRadius: "50%",
                border: `1px solid ${t.border2}`, background: t.card1, color: t.textSecondary,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, letterSpacing: "0.06em", fontWeight: 600,
              }}>
                {m.iniciais || m.nome.charAt(0)}
              </span>
            ))}
          </div>
          <div style={{
            flex: 1, fontSize: 13, fontWeight: 400, color: t.textPrimary,
            letterSpacing: "0.02em", lineHeight: 1.45,
          }}>
            {c.nome}
          </div>
        </div>

        {/* Subtitle: responsáveis + atividade */}
        <div style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.02em", lineHeight: 1.5, marginBottom: 8 }}>
          {c.membros.length > 0 && <>{c.membros.map(m => m.nome).join(" · ")}<br /></>}
          {c.date_last_activity && `Atividade em ${fmtBr(c.date_last_activity)}`}
        </div>

        {/* Descrição resumida */}
        {limparDesc(c.descricao) && (
          <div style={{
            fontSize: 10.5, color: t.textSecondary, lineHeight: 1.55, marginBottom: 10,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {limparDesc(c.descricao)}
          </div>
        )}

        {/* Tags / etiquetas */}
        {c.labels.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {c.labels.map((lb, i) => (
              <span key={i} style={{
                fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase",
                color: t.textPrimary, background: `${labelCor(lb.cor)}2b`,
                border: `1px solid ${labelCor(lb.cor)}`, padding: "2px 8px",
              }}>
                {lb.nome || "—"}
              </span>
            ))}
          </div>
        )}

        {/* Rodapé: contadores + prazo */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderTop: `1px solid ${t.border1}`, paddingTop: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 10, color: t.textTertiary }}>
            {c.chk_total > 0 && (
              <span style={{ color: c.chk_done >= c.chk_total ? "#10B981" : t.textTertiary }}>
                ☑ {c.chk_done}/{c.chk_total}
              </span>
            )}
            {c.n_comentarios > 0 && <span>💬 {c.n_comentarios}</span>}
            {c.n_anexos > 0 && <span>📎 {c.n_anexos}</span>}
            {!c.chk_total && !c.n_comentarios && !c.n_anexos && <span>—</span>}
          </div>
          {c.due && (
            <span style={{
              fontSize: 10, letterSpacing: "0.04em",
              color: atrasado ? "#EF4444" : c.due_complete ? "#10B981" : t.textTertiary,
            }}>
              {atrasado ? "⚠ atrasado" : "⏱"} {fmtBr(c.due)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ /equipe — dashboard estilo valor.parket/equipe do Raniere
       (cards por projetista com stats + KPIs no topo). Só a
       gestora vê algo útil aqui — projetista comum vê 0/0. ═══ */

function iniciaisDoNome(nome: string): string {
  return (nome || "").trim().split(/\s+/).slice(0, 2)
    .map(s => s[0] || "").join("").toUpperCase() || "?";
}

function fmtInt(n: number): string {
  return n.toLocaleString("pt-BR");
}

type KpiFiltro = "ativos" | "delegados" | "sem-delegar" | "producao" | "atrasados";

function EquipeDashboard({ t, board, equipeStats, onAbrir, onAtribuir, listaFinalidade }: {
  t: any; board: Board | null;
  equipeStats: {
    lista: {
      p: ProjetistaListItem;
      ativos: number; finalizados: number;
      atrasados: number; producao: number;
    }[];
    semDelegar: number;
  };
  listaFinalidade: Record<string, string>;
  // Recebe cardId opcional: usado pelo botão "+ Atribuir" da lista da KPI,
  // que abre o AtribuirModal com a obra já pré-selecionada.
  onAtribuir?: (cardIdInicial?: string) => void;
  onAbrir: (id: string) => void;
}) {
  const [kpiOpen, setKpiOpen] = useState<KpiFiltro | null>(null);
  const totalCards = board?.cards.length ?? 0;
  const totalAtivos = board?.cards.filter(c => {
    const nl = listaFinalidade[c.lista_id] || "";
    return !/finalizado|feita/.test(nl);
  }).length ?? 0;
  const totalProducao = equipeStats.lista.reduce((s, x) => s + x.producao, 0);
  const totalAtrasados = equipeStats.lista.reduce((s, x) => s + x.atrasados, 0);
  const totalDelegados = equipeStats.lista.reduce((s, x) => s + x.ativos + x.finalizados, 0);

  // Filtra os cards que compõem cada KPI (mesma regra do equipeStats no App,
  // pra o modal bater com o número que apareceu). Ao clicar num KPI, mostra
  // essa lista pra Thainara ver exatamente o que falta delegar/o que travou.
  function cardsDoKpi(filtro: KpiFiltro): CardLeve[] {
    const cards = board?.cards || [];
    return cards.filter(c => {
      const nl = listaFinalidade[c.lista_id] || "";
      const finalizado = /finalizado|feita/.test(nl);
      const atrasado = !!c.due && !c.due_complete && new Date(c.due) < new Date();
      if (filtro === "ativos") return !finalizado;
      if (filtro === "sem-delegar") return !c.projetista_id;
      if (filtro === "delegados") return !!c.projetista_id;
      if (filtro === "producao") return !!c.projetista_id && /produção|producao|entrega|instalação|instalacao/.test(nl);
      if (filtro === "atrasados") return !!c.projetista_id && atrasado && !finalizado;
      return false;
    });
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div style={{ padding: "32px 36px", maxWidth: 1320, margin: "0 auto" }}>
        <header style={{
          marginBottom: 28, display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <h1 style={{
              fontFamily: fonts.cinzel, fontSize: 22, fontWeight: 500, margin: 0,
              letterSpacing: "0.14em", textTransform: "uppercase", color: t.textPrimary,
            }}>
              Equipe &amp; Delegação
            </h1>
            <p style={{
              color: t.textTertiary, fontSize: 12, margin: "8px 0 0",
              letterSpacing: "0.04em",
            }}>
              Projetistas Parket: clique num card pra abrir o kanban delegado a cada um.
            </p>
          </div>
          {/* Chama sem argumento: passar o onClick direto mandava o evento
              do mouse como cardIdInicial. */}
          {onAtribuir && (
            <button type="button" onClick={() => onAtribuir()} style={{
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", padding: "8px 14px", cursor: "pointer",
              background: t.accent, border: `1px solid ${t.accent}`,
              color: "#111", fontWeight: 600,
            }}>
              + Atribuir
            </button>
          )}
        </header>

        {/* KPIs — todos clicáveis: abrem lista das obras que compõem o número. */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12, marginBottom: 28,
        }}>
          <Kpi t={t} label="Cards ativos" value={fmtInt(totalAtivos)}
            onClick={() => setKpiOpen("ativos")} />
          <Kpi t={t} label="Delegados" value={fmtInt(totalDelegados)}
            onClick={() => setKpiOpen("delegados")} />
          <Kpi t={t} label="Sem delegar" value={fmtInt(equipeStats.semDelegar)}
            color={equipeStats.semDelegar > 0 ? "#F59E0B" : undefined}
            onClick={() => setKpiOpen("sem-delegar")} />
          <Kpi t={t} label="Em produção" value={fmtInt(totalProducao)}
            color="#14B8A6" onClick={() => setKpiOpen("producao")} />
          <Kpi t={t} label="Atrasados" value={fmtInt(totalAtrasados)}
            color={totalAtrasados > 0 ? "#EF4444" : undefined}
            onClick={() => setKpiOpen("atrasados")} />
        </div>

        {kpiOpen && (
          <KpiDetalheModal t={t} filtro={kpiOpen}
            cards={cardsDoKpi(kpiOpen)}
            onClose={() => setKpiOpen(null)}
            onAbrirCard={id => { setKpiOpen(null); onAbrir(id); }}
            onAtribuirCard={id => { setKpiOpen(null); onAtribuir && onAtribuir(id); }} />
        )}

        <h2 style={{
          fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em",
          textTransform: "uppercase", color: t.textSecondary, fontWeight: 500,
          margin: "8px 0 14px",
        }}>
          Projetistas
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {equipeStats.lista.map(e => (
            <ProjetistaCard key={e.p.id} t={t} stats={e}
              onClick={() => onAbrir(e.p.id)} />
          ))}
          {equipeStats.semDelegar > 0 && (
            <button onClick={() => onAbrir(SEM_RESP)}
              style={{
                border: `1px dashed ${t.border1}`, padding: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, color: t.textSecondary, cursor: "pointer",
                fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.2em",
                textTransform: "uppercase", background: "transparent",
                minHeight: 200, flexDirection: "column",
              }}>
              <span style={{ fontSize: 24 }}>📥</span>
              {fmtInt(equipeStats.semDelegar)} sem delegar
              <span style={{ color: t.textTertiary, fontSize: 9, letterSpacing: "0.14em" }}>
                fila da Thainara
              </span>
            </button>
          )}
        </div>

        {equipeStats.lista.length === 0 && (
          <div style={{
            marginTop: 40, textAlign: "center", color: t.textTertiary,
            fontSize: 12, letterSpacing: "0.06em",
          }}>
            Nenhuma projetista cadastrada. Peça pro admin liberar acesso ao
            setor Projetos no Space.
          </div>
        )}
      </div>
    </div>
  );
}

/* Lista as obras que compõem o número de um KPI. Cada linha:
   - Nome do card + cliente/responsáveis/prazo
   - Botão "Atribuir" abre o mesmo AtribuirModal do "+ Atribuir" no topo
     (multi-responsáveis, tipos, tamanho, prioridade, prazo), com essa
     obra já pré-selecionada. Evita ter que procurar a obra no dropdown
     entre 470 cards toda vez.
   - Clique no card (fora do botão) abre no kanban. Não fecha em click-fora. */
function KpiDetalheModal({ t, filtro, cards, onClose, onAbrirCard, onAtribuirCard }: {
  t: any;
  filtro: KpiFiltro;
  cards: CardLeve[];
  onClose: () => void;
  onAbrirCard: (id: string) => void;
  onAtribuirCard: (id: string) => void;
}) {

  const titulos: Record<KpiFiltro, string> = {
    ativos: "Cards ativos",
    delegados: "Cards delegados",
    "sem-delegar": "Sem delegar",
    producao: "Em produção",
    atrasados: "Atrasados",
  };
  const sub: Record<KpiFiltro, string> = {
    ativos: "todas as obras que ainda não foram finalizadas",
    delegados: "obras já atribuídas a um ou mais responsáveis",
    "sem-delegar": "obras aguardando atribuição — clique pra abrir e delegar",
    producao: "obras que já estão nas fases finais (produção/instalação)",
    atrasados: "obras com prazo vencido — priorize essas",
  };
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: 720, maxWidth: "100%", maxHeight: "85vh",
        background: t.bg, border: `1px solid ${t.border2}`,
        boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
        display: "flex", flexDirection: "column",
      }}>
        <header style={{
          padding: "20px 24px 14px", borderBottom: `1px solid ${t.border1}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
        }}>
          <div>
            <h2 style={{
              fontFamily: fonts.cinzel, fontSize: 14, fontWeight: 500, margin: 0,
              letterSpacing: "0.16em", textTransform: "uppercase", color: t.textPrimary,
            }}>
              {titulos[filtro]} · {cards.length}
            </h2>
            <p style={{ color: t.textTertiary, fontSize: 11, margin: "6px 0 0" }}>
              {sub[filtro]}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: t.textTertiary,
            cursor: "pointer", fontSize: 16, padding: 2, lineHeight: 1,
          }}>{"✕"}</button>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px 20px" }}>
          {cards.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: t.textTertiary, fontSize: 12 }}>
              Nenhuma obra nessa categoria.
            </div>
          ) : (
            cards
              .slice()
              .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"))
              .map(c => {
                const atrasado = !!c.due && !c.due_complete && new Date(c.due) < new Date();
                const responsaveis = Array.isArray(c.responsaveis) ? c.responsaveis : [];
                const nomes = responsaveis.map(r => r.nome).filter(Boolean).join(", ");
                return (
                  <div key={c.id}
                    style={{
                      padding: "12px 14px", borderBottom: `1px solid ${t.border1}`,
                      display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", gap: 10,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.card1}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ flex: 1, cursor: "pointer" }}
                      onClick={() => onAbrirCard(c.id)}>
                      <div style={{
                        fontSize: 13, color: t.textPrimary, fontWeight: 500,
                        marginBottom: 4, letterSpacing: "0.02em",
                      }}>
                        {c.nome}
                      </div>
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: 12, fontSize: 10,
                        color: t.textTertiary, letterSpacing: "0.04em",
                      }}>
                        {c.cliente && c.cliente !== c.nome && <span>Cliente: {c.cliente}</span>}
                        {nomes && <span>Responsável: {nomes}</span>}
                        {!nomes && !c.projetista_id && (
                          <span style={{ color: "#F59E0B" }}>Sem responsável</span>
                        )}
                        {c.due && (
                          <span style={{ color: atrasado ? "#EF4444" : t.textTertiary }}>
                            {atrasado ? "⚠ atrasado" : "Prazo"}: {fmtBr(c.due)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button type="button"
                      onClick={e => { e.stopPropagation(); onAtribuirCard(c.id); }}
                      style={{
                        background: t.accent, border: `1px solid ${t.accent}`,
                        color: "#111", padding: "8px 14px",
                        fontSize: 9, fontFamily: fonts.cinzel,
                        letterSpacing: "0.18em", textTransform: "uppercase",
                        fontWeight: 600, cursor: "pointer",
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}>
                      {nomes ? "Editar" : "+ Atribuir"}
                    </button>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}


function Kpi({ t, label, value, color, onClick }: {
  t: any; label: string; value: string; color?: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div onClick={onClick}
      title={clickable ? "Clique pra ver as obras" : undefined}
      style={{
        background: t.card1, border: `1px solid ${t.border1}`, padding: "14px 16px",
        cursor: clickable ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={e => clickable && (e.currentTarget.style.borderColor = t.accent)}
      onMouseLeave={e => clickable && (e.currentTarget.style.borderColor = t.border1)}
    >
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 9, textTransform: "uppercase",
        letterSpacing: "0.22em", color: t.textTertiary, fontWeight: 500,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 22, fontWeight: 500, marginTop: 6,
        color: color || t.textPrimary, letterSpacing: "0.04em",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>
    </div>
  );
}

function ProjetistaCard({ t, stats, onClick }: {
  t: any;
  stats: {
    p: ProjetistaListItem;
    ativos: number; finalizados: number;
    atrasados: number; producao: number;
  };
  onClick: () => void;
}) {
  const { p } = stats;
  const gestora = p.papel === "gestora";
  return (
    <div onClick={onClick} style={{
      background: t.card1, border: `1px solid ${gestora ? t.accent : t.border1}`,
      padding: 18, cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 12,
      transition: "border-color 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = t.accent)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = gestora ? t.accent : t.border1)}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          background: p.avatar_color, color: "#111",
          display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14,
        }}>
          {iniciaisDoNome(p.nome)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: fonts.cinzel, fontWeight: 500, fontSize: 13,
            letterSpacing: "0.12em", textTransform: "uppercase", color: t.textPrimary,
          }}>
            {p.nome}
          </div>
          <div style={{
            fontSize: 10, color: t.textTertiary,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3,
          }}>
            {gestora ? "Gestora do setor" : p.especialidade}
          </div>
        </div>
        <span style={{ color: t.textTertiary, fontSize: 16 }}>→</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <MiniStat t={t} label="Ativos" value={stats.ativos} />
        <MiniStat t={t} label="Finalizados" value={stats.finalizados} color="#10B981" />
        <MiniStat t={t} label="Atrasados" value={stats.atrasados}
          color={stats.atrasados > 0 ? "#EF4444" : undefined} />
        <MiniStat t={t} label="Produção" value={stats.producao} color="#14B8A6" />
      </div>
    </div>
  );
}

function MiniStat({ t, label, value, color }: {
  t: any; label: string; value: number; color?: string;
}) {
  return (
    <div style={{ background: t.statBg, padding: "6px 10px" }}>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 8, color: t.textTertiary,
        letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 14, fontWeight: 500, marginTop: 3,
        color: color || t.textPrimary, letterSpacing: "0.04em",
        fontVariantNumeric: "tabular-nums",
      }}>
        {fmtInt(value)}
      </div>
    </div>
  );
}
