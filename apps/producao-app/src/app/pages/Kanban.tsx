/** Painel Kanban PCP — 8 etapas fixas com drag & drop (modelo Apps Script PCP Arvo). */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Plus, CalendarDays, AlertTriangle, Paperclip, ShieldAlert, Search, X } from "lucide-react";
import {
  Ordem, ETAPAS,
  fetchOrdens, atualizarEtapa, proximoIdOP, fmtData, isISO, itensPendentes,
  exigeLiberacao, liberacaoResumo, moverComRisco, contagemPorCategoria,
} from "../lib/producao";
import { getCurrentUser } from "../lib/auth";
import OrdemModal from "../components/OrdemModal";

const ETAPA_FINAL = "7. FINALIZADO";
const norm = (s: string | null | undefined) => String(s || "").trim().toUpperCase();

/* QUE FAZ: normaliza texto pra busca — caixa alta + sem acento ("NOVITÁ" acha
   "NOVITA" e vice-versa). POR QUE: nomes de obra vêm com acentuação
   inconsistente entre Valor/gestão/PCP. */
const normBusca = (s: string | null | undefined) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

export default function Kanban() {
  const { t } = useTheme();
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ aberto: boolean; ordem: Ordem | null }>({ aberto: false, ordem: null });
  const [risco, setRisco] = useState<{ ordem: Ordem; etapaAlvo: string } | null>(null);
  // Busca de obra (Will 02/09): filtra os cards de TODAS as fases pelo texto.
  const [busca, setBusca] = useState("");

  async function load() {
    setOrdens(await fetchOrdens());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  /** KPIs refletem SÓ os cards do Kanban (status_producao dos itens da OP).
   *  Registros ad-hoc de /prensa e /marcenaria (sistema legado Arvo) têm KPIs próprios
   *  nas páginas deles — não contam aqui pra não misturar as fontes de verdade. */
  const kpis = useMemo(() => {
    const ativos = ordens.filter((o) => o.etapa !== ETAPA_FINAL);
    const isFinal = (s: string) => s.includes("FINAL");
    const isParalisado = (s: string) => s.includes("PARALIS");
    const isFabricando = (s: string) =>
      s.includes("CONSTR") || s.includes("ACAB") || s.includes("QUALID") || s.includes("EMBAL");
    const opJaSaiuValidacao = (etapa: string) => {
      const idx = ETAPAS.findIndex((e) => e.nome === etapa);
      return idx >= 1 && etapa !== ETAPA_FINAL;
    };

    let itensAndamento = 0;
    let itensParalisados = 0;
    for (const o of ativos) {
      for (const it of o.itens || []) {
        const s = norm(it.status_producao);
        if (isParalisado(s)) { itensParalisados++; continue; }
        if (isFinal(s)) continue;
        if (isFabricando(s) || opJaSaiuValidacao(o.etapa)) itensAndamento++;
      }
    }

    return {
      ativos: ativos.length,
      total: ordens.length,
      emAndamento: itensAndamento,
      paralisados: itensParalisados,
      finalizadas: ordens.filter((o) => o.etapa === ETAPA_FINAL).length,
    };
  }, [ordens]);

  /* QUE FAZ: aplica a busca sobre as OPs antes de montar as colunas. Procura em
     obra/cliente, nº da OP, projeto/proposta, observações e nos itens
     (ambiente, espécie, subtipo, descritivo). POR QUE: com o board cheio,
     achar a obra rolando 8 colunas é lento — a pesquisa filtra os cards de
     todas as fases de uma vez. KPIs e alertas seguem no universo TOTAL
     (a busca é pra localizar, não pra recortar os números). */
  const ordensVisiveis = useMemo(() => {
    const q = normBusca(busca);
    if (!q) return ordens;
    return ordens.filter((o) => {
      const campos = [
        o.cliente_projeto, o.id, o.projeto, o.observacoes, o.solicitante,
        ...(o.itens || []).flatMap((i) => [i.ambiente, i.especie, i.subtipo, i.descritivo, i.numero]),
      ];
      return campos.some((c) => normBusca(c).includes(q));
    });
  }, [ordens, busca]);

  const porEtapa = useMemo(() => {
    const g: Record<string, Ordem[]> = {};
    ETAPAS.forEach((e) => { g[e.nome] = []; });
    ordensVisiveis.forEach((o) => { (g[o.etapa] = g[o.etapa] || []).push(o); });
    return g;
  }, [ordensVisiveis]);

  const hoje = new Date().toISOString().slice(0, 10);
  const alertas = useMemo(() => {
    const a: string[] = [];
    ordens.forEach((o) => {
      if (o.etapa === ETAPA_FINAL) return;
      const itParal = (o.itens || []).filter((i) => norm(i.status_producao).includes("PARALIS"));
      if (itParal.length)
        a.push(`${o.id} (${o.projeto || o.cliente_projeto}): ${itParal.length} item(ns) paralisado(s)`);
      else if (String(o.observacoes).toUpperCase().includes("PARALISADO"))
        a.push(`${o.id} (${o.projeto || o.cliente_projeto}): ${o.observacoes}`);
      else if (isISO(o.prazo_entrega) && o.prazo_entrega.slice(0, 10) < hoje)
        a.push(`${o.id} (${o.projeto || o.cliente_projeto}): prazo vencido em ${fmtData(o.prazo_entrega)}`);
    });
    return a;
  }, [ordens]);

  async function drop(etapa: string) {
    if (!dragId) return;
    const id = dragId;
    const ordem = ordens.find((o) => o.id === id);
    setDragId(null);
    if (!ordem || ordem.etapa === etapa) return;

    /* Etapas 3+ produzem — Will 24/08: sem gate, só aviso. Se há item aguardando
       Projetos ou executivo não subiu, abre o modal pra alguém confirmar o
       risco e ficar no histórico. */
    if (exigeLiberacao(etapa) && liberacaoResumo(ordem).pendencias.length > 0) {
      setRisco({ ordem, etapaAlvo: etapa });
      return;
    }
    setOrdens((prev) => prev.map((o) => (o.id === id ? { ...o, etapa } : o)));
    try {
      await atualizarEtapa(id, etapa);
    } catch (err: any) {
      alert("Falha ao mover: " + (err?.message || err));
    } finally {
      load();
    }
  }

  /* Autoscroll durante drag — Will 24/08. Sem isso, cards no fim da lista
     não conseguem ser soltos em coluna fora da viewport. Estratégia: escuta
     dragover global; se cursor chega em 130px de qualquer borda, força o
     scroll em TODOS os ancestors com overflow (evita depender de identificar
     o scroller certo — algum deles vai efetivamente rolar). */
  const autoScrollRaf = useRef<number | null>(null);
  useEffect(() => {
    if (!dragId) return;
    const EDGE = 130;
    const STEP = 32;
    // Todos os candidatos a scroller — o browser ignora quem já está no fim.
    const scrollers: (HTMLElement | Window)[] = [
      document.querySelector("main") as HTMLElement,
      document.scrollingElement as HTMLElement,
      document.documentElement,
      document.body,
      window,
    ].filter(Boolean) as any;
    let lastX = 0, lastY = 0;
    const onMove = (e: DragEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();  // garante que dragover é aceito globalmente
    };
    const tick = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      let dx = 0, dy = 0;
      if (lastY > 0 && lastY < EDGE) dy = -STEP;
      else if (lastY > vh - EDGE && lastY < vh) dy = STEP;
      if (lastX > 0 && lastX < EDGE) dx = -STEP;
      else if (lastX > vw - EDGE && lastX < vw) dx = STEP;
      if (dx || dy) {
        for (const s of scrollers) {
          try { (s as any).scrollBy({ left: dx, top: dy, behavior: "auto" }); }
          catch { /* window fallback usa (x,y) */ (s as any).scrollBy(dx, dy); }
        }
      }
      autoScrollRaf.current = requestAnimationFrame(tick);
    };
    document.addEventListener("dragover", onMove);
    autoScrollRaf.current = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("dragover", onMove);
      if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
    };
  }, [dragId]);

  async function confirmarRisco(observacao: string) {
    if (!risco) return;
    const { ordem, etapaAlvo } = risco;
    setRisco(null);
    setOrdens((prev) => prev.map((o) => (o.id === ordem.id ? { ...o, etapa: etapaAlvo } : o)));
    try {
      const u = await getCurrentUser();
      await moverComRisco(ordem.id, ordem.etapa, etapaAlvo, ordem,
        u?.email || u?.nome || null, observacao);
    } catch (err: any) {
      alert("Falha ao mover: " + (err?.message || err));
    } finally {
      load();
    }
  }

  if (loading) return <div style={{ padding: 40, color: t.textMuted }}>Carregando quadro…</div>;

  const kpi: React.CSSProperties = { background: t.cardBg, border: `1px solid ${t.border}`, padding: "14px 16px" };
  const kpiTit: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: t.textMuted };
  const kpiVal: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: t.textPrimary, marginTop: 4 };
  const colHead: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", borderBottom: `1px solid ${t.border}`, color: t.textPrimary,
    // Header da fase gruda no topo do kanban ao rolar (Will 24/08). Background
    // sólido pra não deixar cards passarem por trás. zIndex 2 fica acima dos
    // cards + do estado "over" da coluna.
    position: "sticky", top: 0, background: t.cardBg, zIndex: 2,
  };

  return (
    // Layout linear — a página inteira rola. Só o header de cada coluna
    // (colHead com position: sticky top: 0) gruda no topo do main do Shell
    // (que é o container que faz o scroll). Will 24/08.
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Painel Kanban PCP</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>Fluxo de Ordens de Produção — Marcenaria Arvo</div>
        </div>
        <button onClick={() => setModal({ aberto: true, ordem: null })} style={{
          background: t.accent, color: t.bg, border: "none", padding: "10px 16px",
          fontWeight: 600, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          <Plus size={14} /> Cadastrar Ordem de Produção
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <div style={kpi}>
          <div style={kpiTit}>Pedidos ativos</div>
          <div style={kpiVal}>{kpis.ativos}</div>
          <div style={{ fontSize: 10.5, color: t.textMuted }}>{kpis.total} OPs no total</div>
        </div>
        <div style={kpi}>
          <div style={kpiTit}>Itens em andamento</div>
          <div style={{ ...kpiVal, color: t.info }}>{kpis.emAndamento}</div>
          <div style={{ fontSize: 10.5, color: t.textMuted }}>Nas OPs (Prensa/Produção/CQ)</div>
        </div>
        <div style={kpi}>
          <div style={kpiTit}>Itens paralisados</div>
          <div style={{ ...kpiVal, color: kpis.paralisados > 0 ? t.danger : t.success }}>{kpis.paralisados}</div>
          <div style={{ fontSize: 10.5, color: t.textMuted }}>Requerem atenção</div>
        </div>
        <div style={kpi}>
          <div style={kpiTit}>Finalizados</div>
          <div style={{ ...kpiVal, color: t.success }}>{kpis.finalizadas}</div>
          <div style={{ fontSize: 10.5, color: t.textMuted }}>OPs concluídas</div>
        </div>
      </div>

      {/* Barra de pesquisa de obra (Will 02/09): filtra os cards de todas as
          fases ao digitar. Enquanto há busca ativa, mostra o total encontrado
          e o X limpa e volta pro quadro completo. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flex: "0 1 420px",
          background: t.cardBg, border: `1px solid ${busca ? t.accent : t.border}`,
          padding: "8px 12px",
        }}>
          <Search size={14} style={{ color: t.textMuted, flexShrink: 0 }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar obra (cliente, OP, proposta, produto...)"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: t.textPrimary, fontSize: 12.5,
            }} />
          {busca && (
            <button onClick={() => setBusca("")} title="Limpar pesquisa" style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: t.textMuted, display: "flex", padding: 0,
            }}>
              <X size={14} />
            </button>
          )}
        </div>
        {busca && (
          <span style={{ fontSize: 11.5, color: ordensVisiveis.length ? t.textMuted : t.danger }}>
            {ordensVisiveis.length
              ? `${ordensVisiveis.length} OP${ordensVisiveis.length > 1 ? "s" : ""} encontrada${ordensVisiveis.length > 1 ? "s" : ""}`
              : "Nenhuma OP encontrada"}
          </span>
        )}
      </div>

      {alertas.length > 0 && (
        <div style={{
          background: t.cardBg, border: `1px solid ${t.danger}`, padding: "10px 14px",
          fontSize: 12, color: t.textSecondary, display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <AlertTriangle size={14} style={{ color: t.danger, flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ color: t.danger, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Alertas de risco
            </strong>
            {alertas.map((a, i) => <div key={i} style={{ marginTop: 3 }}>• {a}</div>)}
          </div>
        </div>
      )}

      {/* Toolbar de fases FORA das colunas — sticky no topo do main. Alinhada
          com o grid dos cards abaixo pelo mesmo gridTemplateColumns + gap.
          Isso garante que os nomes das fases ficam FIXOS na tela ao rolar,
          independente do sticky do header por coluna. Will 24/08. */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(8, minmax(230px, 1fr))",
        gap: 14, minWidth: "min-content",
        position: "sticky", top: 0, zIndex: 5,
        background: t.bg, paddingTop: 4, paddingBottom: 4,
      }}>
        {ETAPAS.map((et) => {
          const lista = porEtapa[et.nome] || [];
          const over = et.nome === "3. PRODUÇÃO" && lista.length > 4;
          return (
            <div key={et.nome}
                 style={{
                   ...colHead,
                   position: "static", // sobrescreve o sticky do colHead (já é o wrapper que gruda)
                   background: t.cardBg,
                   border: `1px solid ${t.border}`,
                   ...(over ? { background: "rgba(198,89,17,0.12)", color: t.danger } : {}),
                 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span>{et.nome}</span>
                <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>{over ? "⚠️ over capacity" : et.wip}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid dos cards — sem headers (foram pra toolbar sticky acima). */}
      {/* alignItems: stretch (default) faz todas as colunas terem a mesma altura
          da mais alta. Sem isso, coluna com 9 cards fica alta e as outras ficam
          260px só — não dá pra soltar card do fim da lista longa em coluna curta
          adjacente (a droppable não existe naquela altura). Will 24/08. */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(8, minmax(230px, 1fr))",
        gap: 14, alignItems: "stretch",
        minWidth: "min-content",
      }}>
        {ETAPAS.map((et) => {
          const lista = porEtapa[et.nome] || [];
          return (
            <div key={et.nome}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={() => drop(et.nome)}
                 style={{ background: t.cardBg, border: `1px solid ${t.border}`, minHeight: 260 }}>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {lista.map((o) => (
                  <div key={o.id}
                       draggable
                       onDragStart={() => setDragId(o.id)}
                       onClick={() => setModal({ aberto: true, ordem: o })}
                       style={{
                         background: t.inputBg, border: `1px solid ${t.border}`, padding: "10px 12px",
                         cursor: "grab",
                       }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textPrimary }}>{o.cliente_projeto}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: t.accent, marginTop: 3 }}>{o.id}</div>
                    <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                      <CalendarDays size={10} /> {fmtData(o.prazo_entrega) !== "—" ? fmtData(o.prazo_entrega) : "Sem prazo"}
                      {o.prioridade && o.prioridade !== "Normal" && (
                        <span style={{ color: t.danger, fontWeight: 700 }}>· {o.prioridade.toUpperCase()}</span>
                      )}
                    </div>
                    {(() => {
                      const its = o.itens || [];
                      const porCat = contagemPorCategoria(its);
                      const temProjeto = (o.anexos || []).length > 0;
                      const pend = o.etapa === "2. PRENSA E SEPARAÇÃO" ? itensPendentes(o) : 0;
                      const lib = liberacaoResumo(o);
                      if (!its.length && o.origem !== "contrato-assinado") return null;
                      const chip: React.CSSProperties = {
                        fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em",
                        padding: "2px 6px", border: `1px solid ${t.border}`, color: t.textSecondary,
                      };
                      return (
                        <>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                          {/* Um chip por categoria da proposta (PAINEL, FORRO, PORTA…),
                              nunca rotulando tudo como MARCENARIA. */}
                          {porCat.map((c) => <span key={c.cat} style={chip}>{c.label}</span>)}
                          <span style={{
                            ...chip,
                            color: temProjeto ? t.success : t.danger,
                            borderColor: temProjeto ? t.success : t.danger,
                          }}>
                            <Paperclip size={8} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                            {temProjeto ? "PROJETO" : "SEM PROJETO"}
                          </span>
                          {pend > 0 && (
                            <span style={{ ...chip, color: t.warning, borderColor: t.warning }} title="Materiais pendentes de compra">
                              <AlertTriangle size={8} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                              {pend} PENDENTE{pend > 1 ? "S" : ""}
                            </span>
                          )}
                          {/* lista_aprovada_at é gravado no envio pro Ronaldo, então o chip
                              fala de envio, não de liberação de compra: quem lê o card precisa
                              saber que a lista já saiu daqui pro Compras (Will 04/09). */}
                          {o.origem === "contrato-assinado" && (
                            o.lista_aprovada_at
                              ? <span style={{ ...chip, color: t.success, borderColor: t.success }}>ENVIADO PRA COMPRAS</span>
                              : <span style={{ ...chip, color: t.info, borderColor: t.info }}>A ENVIAR PRA COMPRAS</span>
                          )}
                          {/* Verde só quando TUDO liberado e nenhum parcial: liberação
                              parcial mantém o chip amarelo pro PCP não produzir a mais
                              (Will 03/09). Sufixo "PARCIAL" diz o motivo do amarelo. */}
                          {lib.total > 0 && (() => {
                            const cheio = lib.aguardando === 0 && lib.parciais === 0;
                            return (
                              <span
                                title={[
                                  `${lib.liberados} de ${lib.total} itens liberados pra produção pelo Projetos`,
                                  lib.parciais > 0 ? `${lib.parciais} com qtd parcial` : "",
                                  lib.conferidos > 0 ? `${lib.conferidos} conferido(s) mas sem ordem de produzir` : "",
                                ].filter(Boolean).join(" · ")}
                                style={{
                                  ...chip,
                                  color: cheio ? t.success : t.warning,
                                  borderColor: cheio ? t.success : t.warning,
                                }}>
                                PROJETOS {lib.liberados}/{lib.total}
                                {lib.parciais > 0 ? ` PARCIAL ${lib.parciais}` : ""}
                              </span>
                            );
                          })()}
                          {o.projetos_fase && (
                            <span title={`Fase atual no board Projetos: ${o.projetos_fase}`}
                                  style={{ ...chip, color: t.info, borderColor: t.info }}>
                              PROJ: {o.projetos_fase}
                            </span>
                          )}
                        </div>
                        {/* Lista item a item NÃO aparece no card do PCP (Will 26/08):
                            o card fica só com os chips resumo; a liberação por
                            item continua visível dentro da OP (ListaFabricacao). */}
                        </>
                      );
                    })()}
                  </div>
                ))}
                {lista.length === 0 && (
                  <div style={{ fontSize: 11, color: t.textMuted, textAlign: "center", padding: 20 }}>
                    {/* Com busca ativa a coluna vazia é resultado do filtro, não convite pra drop. */}
                    {busca ? "Sem resultados nesta fase." : "Solte um cartão aqui."}
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>

      {modal.aberto && (
        <OrdemModal ordem={modal.ordem} idSugerido={proximoIdOP(ordens)}
                    onClose={() => setModal({ aberto: false, ordem: null })}
                    onSaved={() => { setModal({ aberto: false, ordem: null }); load(); }} />
      )}

      {risco && (
        <ModalRisco ordem={risco.ordem} etapaAlvo={risco.etapaAlvo} t={t}
                    onCancel={() => setRisco(null)}
                    onConfirm={confirmarRisco} />
      )}
    </div>
  );
}

/* Aviso ao mover pra etapa que produz sem tudo liberado pelo Projetos.
   Will 24/08: nunca bloqueia — só registra quem confirmou, quando e
   qual pendência existia na hora. */
function ModalRisco({ ordem, etapaAlvo, t, onCancel, onConfirm }: {
  ordem: Ordem; etapaAlvo: string; t: any;
  onCancel: () => void; onConfirm: (obs: string) => void;
}) {
  const [obs, setObs] = useState("");
  const lib = liberacaoResumo(ordem);
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.cardBg, border: `1px solid ${t.warning}`, maxWidth: 460,
        width: "100%", padding: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <ShieldAlert size={20} color={t.warning} />
          <h3 style={{ margin: 0, fontSize: 15, color: t.textPrimary }}>Aviso de risco</h3>
        </div>
        <div style={{ fontSize: 12.5, color: t.textSecondary, marginBottom: 12 }}>
          Você está movendo <b style={{ color: t.textPrimary }}>{ordem.id}</b> de
          <i> "{ordem.etapa}"</i> para <i>"{etapaAlvo}"</i> com pendências.
        </div>
        <div style={{
          background: "rgba(240,180,50,0.08)", border: `1px dashed ${t.warning}`,
          padding: "10px 12px", marginBottom: 14,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            color: t.warning, textTransform: "uppercase", marginBottom: 6,
          }}>
            Pendências
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textPrimary }}>
            {lib.pendencias.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
        <label style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          color: t.textMuted, textTransform: "uppercase", display: "block", marginBottom: 4,
        }}>
          Observação (opcional)
        </label>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3}
          placeholder="Ex.: liberado por Douglas via chat, projeto executivo vai subir hoje"
          style={{
            width: "100%", boxSizing: "border-box", resize: "vertical",
            background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
            fontSize: 12, padding: "6px 8px", outline: "none", lineHeight: 1.4,
          }} />
        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 4, marginBottom: 16 }}>
          Seu e-mail e a lista de pendências ficam gravados no histórico da OP.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            background: "transparent", color: t.textMuted, border: `1px solid ${t.border}`,
            padding: "7px 14px", fontSize: 12, cursor: "pointer",
          }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(obs)} style={{
            background: t.warning, color: "#fff", border: "none",
            padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            Confirmar e mover
          </button>
        </div>
      </div>
    </div>
  );
}
