/** Modal de cadastro/edição de Ordem de Produção (producao_ordens). */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Paperclip, ExternalLink, CheckCircle2, FileText, History, PackageSearch, Trash2, Send, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import {
  Ordem, EdicaoLista, ItemFabricacao, ConferenciaEstoque, ETAPAS, TIPOS_INSUMO,
  salvarOrdem, salvarItens, aprovarLista, fmtData, diffListaFabricacao,
  imprimirRelatorioOP, resumoMateriais, conferirEstoque, salvarConferencia, excluirOrdem,
  enviarParaCompras, tipoFab, chaveItemFab, temKitFabricacao, nomeProdutoFab,
} from "../lib/producao";
import { getCurrentUser } from "../lib/auth";
import ListaFabricacao from "./ListaFabricacao";
import DocsUnificados from "./DocsUnificados";

type Props = {
  ordem: Ordem | null;          // null = nova
  idSugerido: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function OrdemModal({ ordem, idSugerido, onClose, onSaved }: Props) {
  const { t } = useTheme();
  const nova = !ordem;
  const [form, setForm] = useState<Ordem>(
    ordem ?? {
      id: idSugerido, cliente_projeto: "", solicitante: "", setor: "Marcenaria",
      etapa: "1. VALIDAÇÃO", prioridade: "Normal", valor: 0, data: new Date().toISOString().slice(0, 10),
      pedido_por: "PCP", projeto: "", prazo_entrega: "", observacoes: "",
    }
  );
  const [salvando, setSalvando] = useState(false);
  const [conf, setConf] = useState<ConferenciaEstoque | null>(ordem?.estoque_conferencia || null);
  const [conferindo, setConferindo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confAberto, setConfAberto] = useState(true);
  const [resumoAberto, setResumoAberto] = useState(false);
  /** Mapa nome_normalizado → saldo disponível, extraído da conferência salva.
   *  ListaFabricacao usa pra marcar KIT sozinho conforme Ronaldo dá entrada. */
  const estoqueSaldoMap = useMemo(() => {
    if (!conf) return undefined;
    const m = new Map<string, number>();
    const norm = (s: string) =>
      String(s || "").toUpperCase().replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    for (const it of conf.itens) m.set(norm(it.nome), it.saldo || 0);
    return m;
  }, [conf]);
  // Índices marcados pra enviar pro Ronaldo — inicia com todos que faltam.
  const [envSel, setEnvSel] = useState<Set<number>>(new Set());
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!conf) { setEnvSel(new Set()); return; }
    const idx = new Set<number>();
    conf.itens.forEach((it, i) => { if (it.falta > 0 && !it.enviado_at) idx.add(i); });
    setEnvSel(idx);
  }, [conf]);
  /* Escopo de compra: quais ITENS da OP entram na rodada que vai pro Ronaldo.
     Will 04/09: "quero liberar a lista de porta porem de marcenaria eu nao quero".
     Guarda chaveItemFab (numero|categoria|ambiente) e não o índice, porque o
     watcher reordena a lista pela numeração da proposta a cada 3 minutos. */
  const [escopoSel, setEscopoSel] = useState<Set<string>>(new Set());
  const [escopoAberto, setEscopoAberto] = useState(false);
  // Itens que têm material pra comprar (painel/forro só com insumo de instalação
  // nunca vão pro Ronaldo, então ficam fora da escolha).
  const itensComKit = useMemo(
    () => (form.itens || []).filter(temKitFabricacao),
    [form.itens]
  );
  // Abre com o escopo da última conferência; OP nova (ou conferência antiga, sem
  // escopo gravado) começa com a OP inteira marcada, que é o comportamento antigo.
  useEffect(() => {
    const validas = new Set((ordem?.itens || []).filter(temKitFabricacao).map(chaveItemFab));
    const salvo = ordem?.estoque_conferencia?.escopo;
    setEscopoSel(new Set(
      salvo?.length ? salvo.filter((k) => validas.has(k)) : Array.from(validas)
    ));
  }, [ordem?.id]);
  const [justificativa, setJustificativa] = useState("");
  // Última versão SALVA dos itens — base do diff/justificativa e dos quick-saves.
  const salvosRef = useRef<ItemFabricacao[]>(ordem?.itens || []);

  /** Status do item / conferência de kit: persiste NA HORA, sem justificativa.
   *  Aplica só status_producao + conferido sobre a versão salva (casando insumo
   *  por nome) — edições pendentes de qtd/nome continuam exigindo Salvar + OBS. */
  async function quickSave(novos: ItemFabricacao[]) {
    setForm((f) => ({ ...f, itens: novos }));
    if (!ordem) return;
    const base = salvosRef.current.map((it, i) => {
      const n = novos[i];
      if (!n) return it;
      const conf = new Map((n.insumos || []).map((x) => [String(x.nome || "").trim().toUpperCase(), !!x.conferido]));
      return {
        ...it,
        status_producao: n.status_producao ?? null,
        insumos: (it.insumos || []).map((ins) => {
          const k = String(ins.nome || "").trim().toUpperCase();
          return conf.has(k) ? { ...ins, conferido: conf.get(k) } : ins;
        }),
      };
    });
    try {
      await salvarItens(ordem.id, base);
      salvosRef.current = base;
    } catch (err: any) {
      alert("Falha ao salvar status/conferência: " + (err?.message || err));
    }
  }

  const itensLimpos = () => form.itens?.map((it) => ({
    ...it,
    insumos: (it.insumos || []).filter((ins) => String(ins.nome || "").trim()),
  }));

  /** Itens que entram nesta rodada de compra. É essa lista (e não a OP inteira)
   *  que alimenta o resumo e a conferência: o resumo soma os materiais de todos
   *  os itens e depois não dá mais pra saber de qual item veio cada material. */
  const itensEscopo = () =>
    (itensLimpos() || []).filter((it) => temKitFabricacao(it) && escopoSel.has(chaveItemFab(it)));

  // Escopo escolhido agora × escopo que gerou a conferência salva. Se mudou, as
  // quantidades da tabela são de outra combinação de itens e o envio fica travado
  // até conferir de novo. Conferência antiga (sem escopo) = OP inteira.
  const escopoChave = Array.from(escopoSel).sort().join("~");
  const escopoConferido = conf
    ? (conf.escopo?.length ? [...conf.escopo] : itensComKit.map(chaveItemFab)).sort().join("~")
    : null;
  const escopoDesatualizado = !!conf && escopoConferido !== escopoChave;

  const mudancas = useMemo(
    () => (nova ? [] : diffListaFabricacao(ordem?.itens || [], itensLimpos() || [])),
    [form.itens]
  );

  /** Histórico + entrada nova quando a lista mudou. Retorna null se falta justificativa. */
  async function edicoesComEntrada(): Promise<EdicaoLista[] | null | undefined> {
    if (!mudancas.length) return ordem?.edicoes;
    if (!justificativa.trim()) {
      alert("A lista foi alterada — descreva a justificativa da mudança antes de salvar.");
      return null;
    }
    const u = await getCurrentUser();
    return [...(ordem?.edicoes || []), {
      at: new Date().toISOString(),
      por: u?.nome || u?.email || "Produção",
      justificativa: justificativa.trim(),
      mudancas,
    }];
  }

  /** Bate o resumo com o saldo do Almoxarifado Curitiba e persiste na OP —
   *  o watcher abate as qtds do card do Ronaldo quando a lista recebe o OK. */
  async function conferir() {
    setConferindo(true);
    try {
      const itensConf = await conferirEstoque(itensEscopo(), conf?.itens);
      const u = await getCurrentUser();
      const c: ConferenciaEstoque = {
        at: new Date().toISOString(),
        por: u?.nome || u?.email || "Produção",
        deposito: "marcenaria-curitiba",
        itens: itensConf,
        // Guarda quais itens geraram estas quantidades, pra saber depois se o
        // escopo mudou e a tabela virou histórico.
        escopo: Array.from(escopoSel),
      };
      setConf(c);
      if (ordem) await salvarConferencia(ordem.id, c);
    } catch (err: any) {
      alert("Falha ao conferir estoque: " + (err?.message || err));
    } finally {
      setConferindo(false);
    }
  }

  /** Atualiza obs do item enviado. Debounce leve pra não hammering o banco. */
  const obsTimer = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  function setObs(i: number, valor: string) {
    if (!conf || !ordem) return;
    const nova: ConferenciaEstoque = {
      ...conf,
      itens: conf.itens.map((it, k) => (k === i ? { ...it, obs: valor } : it)),
    };
    setConf(nova);
    clearTimeout(obsTimer.current[i]);
    obsTimer.current[i] = setTimeout(() => {
      salvarConferencia(ordem.id, nova).catch((e) => console.warn("obs save:", e));
    }, 600);
  }

  async function enviar() {
    if (!ordem || !conf) return;
    if (escopoDesatualizado) {
      alert("A escolha de itens mudou depois da última conferência. Clique em Conferir estoque de novo antes de enviar.");
      return;
    }
    const indices = Array.from(envSel).sort((a, b) => a - b);
    if (!indices.length) { alert("Marque pelo menos 1 item pra enviar."); return; }
    if (!confirm(`Enviar ${indices.length} item(ns) pra Compras (Ronaldo)?\n\nOs desmarcados continuam pendentes e podem ser enviados depois.`)) return;
    setEnviando(true);
    try {
      const u = await getCurrentUser();
      const quem = u?.nome || u?.email || "Produção";
      // Manda também os itens do escopo pra carimbar quais foram pra compras —
      // o que ficar de fora aparece como "NÃO ENVIADO PRA COMPRAS" na lista.
      const r = await enviarParaCompras(ordem, indices, quem, conf, {
        itens: salvosRef.current, chaves: Array.from(escopoSel),
      });
      // Mantém a base dos quick-saves alinhada com o que acabou de ir pro banco:
      // sem isso, marcar um status logo depois regravaria os itens sem o carimbo.
      const dentro = new Set(escopoSel);
      const agora = new Date().toISOString();
      salvosRef.current = salvosRef.current.map((it) =>
        dentro.has(chaveItemFab(it)) && temKitFabricacao(it)
          ? { ...it, compras_enviado_em: agora, compras_envio_id: r.envio_id }
          : it
      );
      // Primeiro envio aprova a lista (equivale ao antigo "Dar OK") — libera o watcher
      // a NÃO recriar cards e serve de marcador de auditoria (aprovada por/quando).
      if (!ordem.lista_aprovada_at) await aprovarLista(ordem.id, quem);
      alert(`Enviado pra Compras: ${r.qtd_itens} item(ns) no card do Ronaldo (envio ${r.envio_id}).`);
      onSaved();
    } catch (err: any) {
      alert("Falha ao enviar: " + (err?.message || err));
    } finally {
      setEnviando(false);
    }
  }

  async function excluir() {
    if (!ordem) return;
    if (!confirm(`Excluir a ordem ${ordem.id} (${ordem.cliente_projeto})?\n\nAção definitiva — a OP some do Kanban e não vai voltar. Continuar?`)) return;
    setExcluindo(true);
    try {
      await excluirOrdem(ordem.id);
      onSaved();
    } catch (err: any) {
      alert("Falha ao excluir: " + (err?.message || err));
      setExcluindo(false);
    }
  }

  const set = (k: keyof Ordem, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_projeto.trim()) return;
    const edicoes = await edicoesComEntrada();
    if (edicoes === null) return;
    setSalvando(true);
    try {
      await salvarOrdem({ ...form, itens: itensLimpos(), edicoes, valor: Number(form.valor) || 0 }, nova);
      onSaved();
    } catch (err: any) {
      alert("Falha ao salvar: " + (err?.message || err));
    } finally {
      setSalvando(false);
    }
  }

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%",
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
    color: t.textSecondary, marginBottom: 4, display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border}`, padding: 22,
        width: "100%", maxWidth: 980, maxHeight: "94vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: t.textPrimary }}>
            {nova ? "Cadastrar Ordem de Produção" : `Editar ${form.id}`}
          </h2>
          {/* Lado direito do header: botão de PDF + chip da fase no board Projetos */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Atalho pro relatório de fabricação (mesmo do rodapé) — pedido do Will 25/08: ficar em cima, do lado do status */}
            {!nova && !!form.itens?.length && (
              <button type="button" title="Imprimir/baixar o relatório da OP com a lista completa de materiais por item"
                      onClick={() => imprimirRelatorioOP({ ...form, itens: itensLimpos(), edicoes: ordem?.edicoes || [] })}
                      style={{
                        background: "transparent", color: t.textPrimary, border: `1px solid ${t.textPrimary}`,
                        padding: "6px 12px", fontWeight: 700, fontSize: 11, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.05em",
                        textTransform: "uppercase", whiteSpace: "nowrap",
                      }}>
                <FileText size={12} /> Relatório PDF
              </button>
            )}
            {ordem?.projetos_fase && (
              <div title="Fase atual do card no board Projetos (Trello)"
                   style={{
                     display: "flex", alignItems: "center", gap: 8,
                     padding: "6px 12px", border: `1px solid ${t.info}`,
                     background: `${t.info}14`, color: t.info,
                     fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                     textTransform: "uppercase", whiteSpace: "nowrap",
                   }}>
                <span style={{ fontSize: 9, opacity: 0.75 }}>PROJETOS</span>
                {ordem.projetos_fase}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>ID (OP)</label>
              <input value={form.id} onChange={(e) => set("id", e.target.value)} disabled={!nova} style={{ ...inp, opacity: nova ? 1 : 0.6 }} />
            </div>
            <div>
              <label style={lbl}>Cliente / Projeto *</label>
              <input value={form.cliente_projeto} onChange={(e) => set("cliente_projeto", e.target.value)} required style={inp} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Setor</label>
              <select value={form.setor} onChange={(e) => set("setor", e.target.value)} style={inp}>
                <option>Marcenaria</option>
                <option>Prensa</option>
                <option>Geral / PCP</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Etapa</label>
              <select value={form.etapa} onChange={(e) => set("etapa", e.target.value)} style={inp}>
                {ETAPAS.map((et) => <option key={et.nome}>{et.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Prioridade</label>
              <select value={form.prioridade} onChange={(e) => set("prioridade", e.target.value)} style={inp}>
                <option>Normal</option>
                <option>Alta</option>
                <option>Urgente</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Data</label>
              <input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Prazo entrega</label>
              <input type="date" value={form.prazo_entrega} onChange={(e) => set("prazo_entrega", e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Valor (R$)</label>
              <input type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Solicitante</label>
              <input value={form.solicitante} onChange={(e) => set("solicitante", e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Pedido por</label>
              <input value={form.pedido_por} onChange={(e) => set("pedido_por", e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Projeto (obra)</label>
              <input value={form.projeto} onChange={(e) => set("projeto", e.target.value)} style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>Observações</label>
            <textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />
          </div>

          {!!form.itens && form.itens.length > 0 && (
            <div>
              <label style={lbl}>Lista de fabricação — Portas & Marcenaria ({form.itens.length})</label>
              <ListaFabricacao itens={form.itens} maxHeight="56vh" etapa={form.etapa}
                               onChange={(itens) => setForm((f) => ({ ...f, itens }))}
                               onQuick={quickSave}
                               estoqueSaldo={estoqueSaldoMap} />
              <div style={{ marginTop: 5, fontSize: 10, color: t.textMuted }}>
                Clique no item pra expandir. Qtd, unidade e nome dos materiais são editáveis — Salvar registro grava. Status do item e conferência de kit salvam na hora. Compras: use Conferir estoque → Enviar pra Compras em rodadas.
              </div>

              {mudancas.length > 0 && (
                <div style={{ marginTop: 10, border: `1px solid ${t.warning}`, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.warning, marginBottom: 6 }}>
                    Alterações na lista ({mudancas.length})
                  </div>
                  <ul style={{ margin: "0 0 8px", paddingLeft: 16, fontSize: 11.5, color: t.textPrimary, display: "flex", flexDirection: "column", gap: 3 }}>
                    {mudancas.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                  <label style={lbl}>OBS / Justificativa da alteração *</label>
                  <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2}
                            placeholder="Por que a lista foi alterada? (obrigatório pra salvar)"
                            style={{ ...inp, resize: "vertical", borderColor: t.warning }} />
                </div>
              )}

              {!!ordem?.edicoes?.length && (
                <div style={{ marginTop: 10, border: `1px solid ${t.border}`, padding: "10px 12px" }}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                    color: t.textSecondary, marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <History size={12} /> Histórico de edições da lista ({ordem.edicoes.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ordem.edicoes.map((ed, i) => (
                      <div key={i} style={{ borderLeft: `2px solid ${t.warning}`, paddingLeft: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: t.textPrimary }}>
                          {fmtData(ed.at)} — {ed.por}
                        </div>
                        <div style={{ fontSize: 11, color: t.textSecondary, margin: "2px 0" }}>
                          <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9.5, letterSpacing: "0.06em" }}>OBS: </span>
                          {ed.justificativa}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10.5, color: t.textMuted }}>
                          {(ed.mudancas || []).map((m, j) => <li key={j}>{m}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {ordem?.origem === "contrato-assinado" && ordem.lista_aprovada_at && (
                <div style={{
                  marginTop: 8, padding: "9px 12px", border: `1px solid ${t.success}`,
                  color: t.success, fontSize: 11.5, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                  <span>
                    Lista enviada pra Compras por {ordem.lista_aprovada_por || "Produção"} em {fmtData(ordem.lista_aprovada_at)}. Novas rodadas podem ser enviadas pro Ronaldo.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Escolha do que vai pro Ronaldo nesta rodada. Fica ANTES do resumo de
              propósito: o resumo soma os materiais dos itens escolhidos, e depois
              da soma não dá mais pra separar o que era porta e o que era
              marcenaria. Vale em qualquer fase da OP, não só na validação. */}
          {!!itensComKit.length && (() => {
            const grupos: { cat: string; itens: ItemFabricacao[] }[] = [];
            for (const it of itensComKit) {
              const cat = (it.categoria || "OUTROS").toUpperCase();
              const g = grupos.find((x) => x.cat === cat);
              if (g) g.itens.push(it); else grupos.push({ cat, itens: [it] });
            }
            const toggleItem = (k: string) => setEscopoSel((prev) => {
              const n = new Set(prev);
              n.has(k) ? n.delete(k) : n.add(k);
              return n;
            });
            const toggleGrupo = (itens: ItemFabricacao[]) => {
              const ks = itens.map(chaveItemFab);
              const todosDentro = ks.every((k) => escopoSel.has(k));
              setEscopoSel((prev) => {
                const n = new Set(prev);
                ks.forEach((k) => (todosDentro ? n.delete(k) : n.add(k)));
                return n;
              });
            };
            const fora = itensComKit.length - escopoSel.size;
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>O que vai pra Compras nesta rodada</label>
                  <button type="button" onClick={() => setEscopoAberto((v) => !v)} style={{
                    background: "transparent", color: t.textSecondary, border: `1px solid ${t.border}`,
                    padding: "5px 10px", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {escopoAberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {escopoAberto ? "Recolher" : "Escolher itens"}
                  </button>
                </div>
                <div style={{ border: `1px solid ${fora > 0 ? t.warning : t.border}` }}>
                  <div style={{ padding: "10px 12px", fontSize: 11.5, color: t.textSecondary, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span>
                      <strong style={{ color: t.textPrimary }}>{escopoSel.size}</strong> de {itensComKit.length} itens entram no pedido
                      {fora > 0 && <strong style={{ color: t.warning }}> · {fora} fora desta rodada</strong>}
                    </span>
                    <span style={{ color: t.textMuted }}>
                      {grupos.map((g) => {
                        const dentro = g.itens.filter((it) => escopoSel.has(chaveItemFab(it))).length;
                        return `${g.cat} ${dentro}/${g.itens.length}`;
                      }).join(" · ")}
                    </span>
                  </div>
                  {escopoAberto && grupos.map((g) => {
                    const dentro = g.itens.filter((it) => escopoSel.has(chaveItemFab(it))).length;
                    return (
                      <div key={g.cat} style={{ borderTop: `1px solid ${t.border}` }}>
                        <div onClick={() => toggleGrupo(g.itens)} style={{
                          padding: "7px 12px", background: t.inputBg, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 8,
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                          textTransform: "uppercase", color: t.accent,
                        }}>
                          <input type="checkbox" readOnly checked={dentro === g.itens.length}
                                 ref={(el) => { if (el) el.indeterminate = dentro > 0 && dentro < g.itens.length; }}
                                 style={{ accentColor: t.accent, cursor: "pointer" }} />
                          {g.cat} · {dentro}/{g.itens.length}
                        </div>
                        {g.itens.map((it) => {
                          const k = chaveItemFab(it);
                          const on = escopoSel.has(k);
                          return (
                            <label key={k} style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                              fontSize: 11, color: on ? t.textPrimary : t.textMuted, cursor: "pointer",
                              borderTop: `1px solid ${t.border}`,
                            }}>
                              <input type="checkbox" checked={on} onChange={() => toggleItem(k)}
                                     style={{ accentColor: t.accent, cursor: "pointer" }} />
                              <span style={{ flex: 1, minWidth: 0 }}>
                                {it.numero && <span style={{ color: t.accent, fontWeight: 700 }}>{it.numero} </span>}
                                {nomeProdutoFab(it)}
                                {it.ambiente ? ` — ${it.ambiente}` : ""}
                              </span>
                              {it.compras_enviado_em && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                                  color: t.success, whiteSpace: "nowrap",
                                }}>
                                  JÁ FOI {new Date(it.compras_enviado_em).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div style={{ padding: "6px 12px", fontSize: 10, color: t.textMuted, borderTop: `1px solid ${t.border}` }}>
                    Desmarcar um item tira o material dele do pedido do Ronaldo. Ele fica marcado como não enviado na lista de fabricação e pode ser liberado depois, em qualquer fase da OP.
                  </div>
                </div>
                {escopoDesatualizado && (
                  <div style={{
                    marginTop: 8, padding: "9px 12px", border: `1px solid ${t.warning}`,
                    background: t.inputBg, color: t.warning, fontSize: 11.5, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>A escolha mudou depois da última conferência. Clique em Conferir estoque pra recalcular as quantidades antes de enviar.</span>
                  </div>
                )}
              </div>
            );
          })()}

          {!!form.itens?.length && (() => {
            const resumo = resumoMateriais(itensEscopo());
            if (!resumo.length && !conf) return null;
            const nMP = resumo.filter((r) => r.tipo === "MATERIA_PRIMA").length;
            const nFer = resumo.filter((r) => r.tipo === "FERRAGEM").length;
            const nEmb = resumo.filter((r) => r.tipo === "EMBALAGEM").length;
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>Resumo de materiais dos itens escolhidos</label>
                  <button type="button" onClick={() => setResumoAberto((v) => !v)} style={{
                    background: "transparent", color: t.textSecondary, border: `1px solid ${t.border}`,
                    padding: "5px 10px", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {resumoAberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {resumoAberto ? "Recolher" : `Ver ${resumo.length} materiais`}
                  </button>
                </div>
                <div style={{ border: `1px solid ${t.border}` }}>
                  {!resumoAberto && (
                    <div style={{ padding: "10px 12px", fontSize: 11.5, color: t.textSecondary, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <span><strong>{nMP}</strong> matéria prima · <strong>{nFer}</strong> ferragens{nEmb > 0 ? <> · <strong>{nEmb}</strong> embalagem</> : null}</span>
                      <span style={{ color: t.textMuted }}>Soma dos {escopoSel.size} itens escolhidos, clique em Ver materiais.</span>
                    </div>
                  )}
                  {resumoAberto && TIPOS_INSUMO.map(({ id, label }) => {
                    const doTipo = resumo.filter((r) => r.tipo === id);
                    if (!doTipo.length) return null;
                    return (
                      <div key={id} style={{ padding: "8px 12px", borderBottom: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: t.accent, marginBottom: 4 }}>
                          {label}
                        </div>
                        {doTipo.map((r, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: t.textPrimary, marginTop: 2 }}>
                            <span>{r.nome}</span>
                            <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                              {r.qtd.toLocaleString("pt-BR")} {r.unidade}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {resumoAberto && (
                    <div style={{ padding: "6px 12px", fontSize: 10, color: t.textMuted }}>
                      Soma dos materiais dos {escopoSel.size} itens marcados pra esta rodada de compra.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" disabled={conferindo} onClick={conferir} style={{
                    background: "transparent", color: t.accent, border: `1px solid ${t.accent}`,
                    padding: "8px 12px", fontWeight: 700, fontSize: 11.5, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6, opacity: conferindo ? 0.6 : 1,
                  }}>
                    <PackageSearch size={13} /> {conferindo ? "Conferindo…" : "Conferir estoque (Almoxarifado Curitiba)"}
                  </button>
                  {conf && (
                    <>
                      <span style={{ fontSize: 10, color: t.textMuted }}>
                        Última conferência: {new Date(conf.at).toLocaleString("pt-BR")} — {conf.por}
                      </span>
                      <button type="button" onClick={() => setConfAberto((v) => !v)} style={{
                        marginLeft: "auto", background: "transparent", color: t.textSecondary,
                        border: `1px solid ${t.border}`, padding: "5px 10px", fontSize: 10.5, fontWeight: 600,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        {confAberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {confAberto ? "Recolher" : `Ver ${conf.itens.length} materiais`}
                      </button>
                    </>
                  )}
                </div>

                {conf && (() => {
                  const fq = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
                  const cobertos = conf.itens.filter((c) => c.falta === 0).length;
                  const pendentes = conf.itens.filter((c) => c.falta > 0 && !c.enviado_at).length;
                  const enviados = conf.itens.filter((c) => c.enviado_at).length;
                  const emPrensa = form.etapa === "2. PRENSA E SEPARAÇÃO";
                  const th: React.CSSProperties = {
                    textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                    color: t.textSecondary, padding: "6px 10px", borderBottom: `1px solid ${t.border}`,
                  };
                  const td: React.CSSProperties = {
                    fontSize: 11, color: t.textPrimary, padding: "5px 10px", borderBottom: `1px solid ${t.border}`,
                  };
                  const toggle = (i: number) => setEnvSel((prev) => {
                    const n = new Set(prev);
                    n.has(i) ? n.delete(i) : n.add(i);
                    return n;
                  });
                  const linha = (c: typeof conf.itens[number], i: number) => (
                    <tr key={i}>
                      <td style={{ ...td, width: 28, textAlign: "center" }}>
                        {c.falta > 0 && !c.enviado_at ? (
                          <input type="checkbox" checked={envSel.has(i)} onChange={() => toggle(i)}
                                 style={{ accentColor: t.accent, cursor: "pointer" }} />
                        ) : c.enviado_at ? (
                          <span title={`Enviado ${new Date(c.enviado_at).toLocaleDateString("pt-BR")}`} style={{ color: t.success, fontSize: 11 }}>✓</span>
                        ) : (
                          <span style={{ color: t.textMuted }}>—</span>
                        )}
                      </td>
                      <td style={td}>
                        {c.nome}
                        {!c.encontrado && (
                          <span style={{ marginLeft: 6, fontSize: 9, color: t.warning, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            não encontrado no estoque
                          </span>
                        )}
                        {c.enviado_at && (
                          <span style={{ marginLeft: 6, fontSize: 9, color: t.success, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                            enviado {new Date(c.enviado_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fq(c.qtd_necessaria)} {c.unidade}</td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fq(c.saldo)}</td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: c.abatida > 0 ? t.success : t.textMuted }}>
                        {c.abatida > 0 ? `−${fq(c.abatida)}` : "—"}
                      </td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700,
                                    color: c.enviado_at ? t.success : c.falta > 0 ? t.warning : t.success }}>
                        {c.enviado_at ? "ENVIADO"
                          : c.falta > 0 ? `${fq(c.falta)} ${c.unidade}` : "OK"}
                      </td>
                    </tr>
                  );
                  // A tabela principal mostra só o que ainda tá em aberto (pendente
                  // ou já coberto pelo estoque). Enviados vão pro bloco separado abaixo.
                  const grupos = TIPOS_INSUMO.map((g) => ({
                    ...g, rows: conf.itens
                      .map((c, i) => ({ c, i }))
                      .filter(({ c }) => !c.enviado_at)
                      .filter(({ c }) => tipoFab(c.tipo) === g.id),
                  })).filter((g) => g.rows.length);
                  const enviadosList = conf.itens
                    .map((c, i) => ({ c, i }))
                    .filter(({ c }) => c.enviado_at);
                  return (
                    <>
                      {emPrensa && pendentes > 0 && (
                        <div style={{
                          marginTop: 8, padding: "9px 12px", border: `1px solid ${t.warning}`,
                          background: t.inputBg, color: t.warning, fontSize: 11.5, fontWeight: 600,
                          display: "flex", alignItems: "center", gap: 8,
                        }}>
                          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                          <span>
                            OP em Prensa e Separação mas ainda tem {pendentes} material(is) pendente(s). Envie pra Compras antes de fabricar.
                          </span>
                        </div>
                      )}
                      <div style={{ marginTop: 8, border: `1px solid ${t.border}` }}>
                        {!confAberto && (
                          <div style={{ padding: "10px 12px", fontSize: 11.5, color: t.textSecondary, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <span>{cobertos} cobertos · <strong style={{ color: pendentes > 0 ? t.warning : t.success }}>{pendentes} a comprar</strong> · {enviados} enviados</span>
                            <span style={{ color: t.textMuted }}>Clique em Ver materiais pra expandir e marcar o que enviar.</span>
                          </div>
                        )}
                        {confAberto && <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead><tr>
                            <th style={{ ...th, width: 28 }} />
                            <th style={th}>Material</th>
                            <th style={{ ...th, textAlign: "right" }}>Necessário</th>
                            <th style={{ ...th, textAlign: "right" }}>Em estoque</th>
                            <th style={{ ...th, textAlign: "right" }}>Abate</th>
                            <th style={{ ...th, textAlign: "right" }}>Comprar</th>
                          </tr></thead>
                          <tbody>
                            {grupos.map((g) => (
                              <Fragment key={g.id}>
                                <tr><td colSpan={6} style={{
                                  ...td, background: t.inputBg, fontSize: 10, fontWeight: 700,
                                  letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent,
                                }}>{g.label} · {g.rows.length}</td></tr>
                                {g.rows.map(({ c, i }) => linha(c, i))}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>}
                        {confAberto && (
                          <div style={{ padding: "6px 10px", fontSize: 10, color: t.textMuted, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                            <span>{cobertos} cobertos pelo estoque · {pendentes} a comprar · {enviados} já enviados</span>
                            <span>Baixa física continua pela Saída de Material do Almoxarifado.</span>
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {(() => {
                          // Trava o envio enquanto a escolha de itens estiver mais
                          // nova que a conferência: as quantidades da tabela seriam
                          // de outra combinação de itens.
                          const bloqueado = enviando || envSel.size === 0 || escopoDesatualizado;
                          return (
                            <button type="button" disabled={bloqueado} onClick={enviar} style={{
                              background: bloqueado ? t.inputBg : t.accent, color: bloqueado ? t.textMuted : t.bg,
                              border: "none", padding: "9px 14px", fontWeight: 700, fontSize: 12,
                              cursor: bloqueado ? "default" : "pointer",
                              display: "flex", alignItems: "center", gap: 6, opacity: enviando ? 0.6 : 1,
                            }}>
                              <Send size={13} /> {enviando ? "Enviando pra Compras…" : `Enviar pra Compras · Ronaldo (${envSel.size})`}
                            </button>
                          );
                        })()}
                        <span style={{ fontSize: 10.5, color: t.textMuted }}>
                          Marca os materiais que quer comprar agora. Desmarcados esperam e podem ser enviados depois em nova rodada.
                        </span>
                      </div>

                      {enviadosList.length > 0 && (
                        <details style={{ marginTop: 10, border: `1px solid ${t.border}` }}>
                          <summary style={{
                            padding: "8px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                            color: t.success, textTransform: "uppercase", letterSpacing: "0.06em",
                            background: t.inputBg, listStyle: "none",
                          }}>
                            ✓ Já enviados pro Ronaldo · {enviadosList.length} · clique pra ver / anotar obs
                          </summary>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px" }}>
                            {enviadosList.map(({ c, i }) => (
                              <div key={i} style={{
                                border: `1px solid ${t.border}`, padding: "8px 10px", background: t.cardBg,
                                display: "grid", gridTemplateColumns: "1fr 130px", gap: 8, alignItems: "start",
                              }}>
                                <div>
                                  <div style={{ fontSize: 11.5, color: t.textPrimary, fontWeight: 600 }}>{c.nome}</div>
                                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                                    {fq(c.falta)} {c.unidade} · enviado {new Date(c.enviado_at!).toLocaleDateString("pt-BR")}
                                    {c.envio_id ? ` · ${c.envio_id}` : ""}
                                  </div>
                                  <textarea rows={1} value={c.obs || ""} onChange={(e) => setObs(i, e.target.value)}
                                            placeholder="Observação (ex.: combinado com fornecedor, prazo, urgência…)"
                                            style={{
                                              marginTop: 5, width: "100%", background: t.inputBg,
                                              border: `1px solid ${t.border}`, color: t.textPrimary,
                                              padding: "6px 8px", fontSize: 11, borderRadius: 0, outline: "none",
                                              resize: "vertical", fontFamily: "inherit",
                                            }} />
                                </div>
                                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em",
                                              textTransform: "uppercase", color: t.textSecondary, textAlign: "right" }}>
                                  {c.tipo === "FERRAGEM" ? "FERRAGEM" : c.tipo === "EMBALAGEM" ? "EMBALAGEM" : "MATÉRIA PRIMA"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })()}

          {(ordem?.origem === "contrato-assinado" || ordem?.origem === "projetos-aprovado") && (
            <div>
              <label style={lbl}>Projeto (anexos do card Valoria)</label>
              {(ordem.anexos || []).length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {ordem.anexos!.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                      border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 12,
                      textDecoration: "none", background: t.inputBg,
                    }}>
                      <Paperclip size={12} style={{ color: t.accent, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{a.name}</span>
                      <ExternalLink size={12} style={{ color: t.textMuted, flexShrink: 0 }} />
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "10px 12px", border: `1px dashed ${t.border}`, fontSize: 11.5, color: t.textMuted }}>
                  Nenhum projeto anexado ainda — quando anexarem no card do valor.parket.works, aparece aqui automaticamente.
                </div>
              )}
            </div>
          )}

          {!nova && <DocsUnificados id={ordem!.id} />}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {!nova && !!form.itens?.length && (
              <button type="button" onClick={() => imprimirRelatorioOP({ ...form, itens: itensLimpos(), edicoes: ordem?.edicoes || [] })}
                      style={{
                        background: "transparent", color: t.textPrimary, border: `1px solid ${t.border}`,
                        padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6, marginRight: "auto",
                      }}>
                <FileText size={13} /> Relatório PDF
              </button>
            )}
            {!nova && (
              <button type="button" onClick={excluir} disabled={excluindo} title="Excluir OP" style={{
                background: "transparent", color: t.danger, border: `1px solid ${t.danger}`,
                padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, opacity: excluindo ? 0.6 : 1,
              }}>
                <Trash2 size={13} /> {excluindo ? "Excluindo…" : "Excluir"}
              </button>
            )}
            <button type="button" onClick={onClose} style={{
              background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`,
              padding: "10px 16px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
            }}>Cancelar</button>
            <button disabled={salvando} type="submit" style={{
              background: t.accent, color: t.bg, border: "none", padding: "10px 18px",
              fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: salvando ? 0.6 : 1,
            }}>{salvando ? "Salvando…" : "Salvar registro"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
