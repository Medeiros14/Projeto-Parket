import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Package, RefreshCw, X } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";
import { AudioRec } from "../app/components/AudioRec";
import { GESTAO_API } from "../lib/offline";

/* ── Solicitar material = modal "Solicitar Compras" do gestão ──
 * Will 08/09: o prestador pede material na MESMA base do modal do gestão
 * (paridade com o fiscal do Verifica, PKT-MAT-MODAL-COMPRAS-20260903):
 * checkbox Ferramentas (sem projeto), seletor de projeto com busca,
 * departamento de destino, prazo, solicitante travado no perfil logado,
 * pedido por, setor, linhas de material com justificativa obrigatória e
 * observações. Will 08/09 (2a rodada): o pedido NÃO vai mais direto pro kanban
 * de compras; cai pro FISCAL da obra analisar no verifica via
 * /api/instala/material/para-analise. Aprovado = o fiscal sobe pelo fluxo
 * oficial de compras (e o status ao vivo volta por /minhas, igual antes);
 * recusado = motivo_recusa aparece no card da lista.
 * PKT-INSTALA-MAT-ANALISE-FISCAL-20260908. */

// Departamentos de destino (espelho de DEPT_OPTS do gestão; "·" no lugar do
// travessão porque texto visível da Parket não usa travessão).
const DEPT_OPTS = [
  { value: "marcenaria-ronaldo", label: "Marcenaria · Ronaldo" },
  { value: "lalamove-ronaldo", label: "Lalamove / Frete · Ronaldo" },
  { value: "instalacao-taiara", label: "Instalação · Taiara" },
  { value: "amostras-marco", label: "Amostras · Marco Antônio" },
];

/* Status da solicitação, espelho de SolicitacoesCompras.tsx do gestão: o
 * prestador vê na lista dele o mesmo estágio do kanban de compras. */
const COLUNA_LABEL: Record<string, Record<string, string>> = {
  "compras": { "entrada": "Solicitações", "cotacao": "Em Cotação",
    "aguarda-aprovacao": "Aguardando Liberação", "emissao-pedido": "Liberação ao Fornecedor",
    "em-transito": "Em Rota de Entrega", "recebimento-auditoria": "Recebido e Conferido",
    "concluido": "Finalizado" },
  "compras-taiara": { "entrada": "Entrada de Demandas", "cotacao": "Cotação e Priorização",
    "aguarda-aprovacao": "Interface Financeira", "emissao-pedido": "Emissão do Pedido",
    "em-transito": "Logística e Acompanhamento", "recebimento-auditoria": "Recebimento e Conferência",
    "concluido": "Finalizado", "amostras": "Amostras em Execução" },
  "compras-marco": { "solicitacao": "Solicitação", "em-execucao": "Em Execução",
    "amostra-pronta": "Amostra Pronta", "em-rota-entrega": "Em Rota de Entrega", "finalizado": "Finalizado" },
};
const COLUNA_COR: Record<string, string> = {
  "entrada": "#6B7280", "cotacao": "#3B82F6", "aguarda-aprovacao": "#F59E0B",
  "emissao-pedido": "#8B5CF6", "em-transito": "#14B8A6", "recebimento-auditoria": "#F97316",
  "concluido": "#10B981", "amostras": "#EC4899",
  "solicitacao": "#6B7280", "em-execucao": "#3B82F6", "amostra-pronta": "#F59E0B",
  "em-rota-entrega": "#14B8A6", "finalizado": "#10B981",
};
// Ordem real das colunas do kanban de compras por departamento: o badge diz
// onde o pedido está agora, a trilha diz quanto falta pra chegar no fim.
const FLUXO: Record<string, string[]> = {
  "compras": ["entrada", "cotacao", "aguarda-aprovacao", "emissao-pedido", "em-transito", "recebimento-auditoria", "concluido"],
  "compras-taiara": ["entrada", "cotacao", "aguarda-aprovacao", "emissao-pedido", "em-transito", "recebimento-auditoria", "concluido"],
  "compras-marco": ["solicitacao", "em-execucao", "amostra-pronta", "em-rota-entrega", "finalizado"],
};

type Compra = {
  id: string; dept_id: string | null; column_id: string | null; titulo: string | null;
  departamento: string | null; responsavel: string | null; prazo: string | null;
  materiais: { tipo?: string; quantidade?: string; justificativa?: string }[];
  obs: string; status: string; motivo: string | null;
  obra: string | null; obra_code?: string | null; cliente?: string | null;
};
type Solicitacao = {
  id: string; card_id: string | null; itens: string; status: string;
  created_at: string; compra?: Compra | null; motivo_recusa?: string | null;
};
type ProjetoGestao = { id: string; card_id: string | null; cliente: string; obra_code: string; endereco: string };
type MatLinha = { tipo: string; quantidade: string; justificativa: string };

/** Posição do card no fluxo do seu departamento; null quando a coluna está
 *  fora do caminho normal ou o card saiu do kanban. */
function progresso(c: Compra) {
  const fluxo = FLUXO[c.dept_id || ""] || [];
  const idx = fluxo.indexOf(c.column_id || "");
  if (idx < 0) return null;
  const labels = COLUNA_LABEL[c.dept_id || ""] || {};
  return { idx, total: fluxo.length, etapas: fluxo.map((k) => labels[k] || k) };
}
function statusBadge(c: Compra) {
  if (c.column_id === null) return { label: "Removido do kanban", color: "#B85B4C" };
  const stt = String(c.status || "pendente").toLowerCase();
  if (stt === "rejeitado") return { label: "Rejeitado", color: "#ef4444" };
  const col = c.column_id || "";
  const lbl = (COLUNA_LABEL[c.dept_id || ""] || {})[col];
  if (stt === "pendente" && (!col || col === "entrada" || col === "solicitacao"))
    return { label: "Pendente", color: "#F59E0B" };
  if (lbl) return { label: lbl, color: COLUNA_COR[col] || "#10B981" };
  return { label: stt === "pendente" ? "Pendente" : "Aceito", color: stt === "pendente" ? "#F59E0B" : "#10B981" };
}

export function Material({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const [sp] = useSearchParams();

  // ── Estado do formulário (mesmos campos do modal do gestão) ──
  const [ferramentas, setFerramentas] = useState(false);
  const [selId, setSelId] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [prazo, setPrazo] = useState("");
  // Pedido por = quem vai usar o material; solicitante fica travado no login
  const [pedidoPor, setPedidoPor] = useState(prestador?.nome ?? "");
  const [setor, setSetor] = useState("");
  const [obs, setObs] = useState("");
  const [materiais, setMateriais] = useState<MatLinha[]>([{ tipo: "", quantidade: "", justificativa: "" }]);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  // client_key idempotente: reenvio manual do mesmo pedido não duplica o histórico
  const clientKey = useRef(crypto.randomUUID());

  // ── Dados ──
  const [projetos, setProjetos] = useState<ProjetoGestao[]>([]);
  const [lista, setLista] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  // Título de obra pra solicitações antigas (sem card de compras vinculado)
  const [obraNomes, setObraNomes] = useState<Record<string, string>>({});

  // Projetos do gestão (fonte do seletor, mesma do modal do gestão)
  useEffect(() => {
    let vivo = true;
    fetch(`${GESTAO_API}/api/projetos?limit=2000`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        if (!vivo) return;
        const ps: ProjetoGestao[] = (rows ?? []).map((p) => ({
          id: p.id, card_id: p.card_id ?? null, cliente: p.cliente || "",
          obra_code: p.obra_code || "", endereco: p.endereco || "",
        }));
        setProjetos(ps);
        // ?obra=<card_id>: chegou pelo atalho da página da obra, já pré-seleciona
        const obra = sp.get("obra");
        if (obra) {
          const match = ps.find((p) => p.card_id === obra);
          if (match) setSelId((cur) => cur || match.id);
        }
      })
      .catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback(async () => {
    if (!prestador) return;
    setLoading(true);
    // Minhas solicitações vêm pelo gestão (junção com o card de compras lê
    // kanban_cards, bloqueado pro anon aqui); Cloud direto é só fallback.
    let sols: Solicitacao[] = [];
    try {
      const r = await fetch(`${GESTAO_API}/api/instala/material/minhas?prestador_id=${encodeURIComponent(prestador.id)}&limit=30`);
      if (r.ok) sols = await r.json();
    } catch { /* offline: cai no fallback */ }
    if (!sols.length) {
      const { data } = await sb.from("instala_material_solicitacoes")
        .select("id,card_id,itens,status,created_at")
        .eq("prestador_id", prestador.id)
        .order("created_at", { ascending: false }).limit(30);
      sols = (data as Solicitacao[]) ?? [];
    }
    setLista(sols);
    // Nome das obras das solicitações sem compra vinculada (via view liberada pro prestador)
    const { data: vObras } = await sb.from("vw_instala_minhas_obras")
      .select("card_id,obra_code,cliente_nome").eq("prestador_id", prestador.id);
    const nomes: Record<string, string> = {};
    for (const o of (vObras as any[]) ?? []) nomes[o.card_id] = `${o.obra_code ?? ""} ${o.cliente_nome}`.trim();
    setObraNomes(nomes);
    setLoading(false);
  }, [prestador]);

  useEffect(() => { reload(); }, [reload]);

  // ── Seletor de projeto: alfabético por cliente, busca cliente/código/endereço ──
  const filtrados = useMemo(() => {
    const base = [...projetos].sort((a, b) =>
      (a.cliente || "").localeCompare(b.cliente || "", "pt-BR", { sensitivity: "base" }));
    const k = pickerQ.trim().toLowerCase();
    if (!k) return base;
    return base.filter((p) => [p.cliente, p.obra_code, p.endereco].filter(Boolean).join(" ").toLowerCase().includes(k));
  }, [projetos, pickerQ]);
  const projetoSel = projetos.find((p) => p.id === selId) ?? null;
  /* Chegou pelo card da obra (?obra=<card_id>): projeto FIXO nessa obra, sem
   * seletor e sem Ferramentas (Will 08/09). Se a obra não tem projeto no
   * gestão, cai no seletor normal (o backend exige projeto_id). */
  const obraCard = sp.get("obra");
  const projetoFixo = obraCard ? projetos.find((p) => p.card_id === obraCard) ?? null : null;

  const setMat = (i: number, k: keyof MatLinha, v: string) =>
    setMateriais((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  function limpar() {
    // Projeto fixado pela obra sobrevive ao limpar/enviar: o prestador segue na mesma obra
    setFerramentas(false); setSelId(projetoFixo?.id ?? ""); setDepartamento(""); setPrazo("");
    setPedidoPor(prestador?.nome ?? ""); setSetor(""); setObs("");
    setMateriais([{ tipo: "", quantidade: "", justificativa: "" }]);
    setErro(""); setOkMsg(""); setPickerOpen(false); setPickerQ("");
    clientKey.current = crypto.randomUUID();
  }

  // Mesma ordem de validação (e mensagens) do SolicitarComprasModal do gestão
  async function enviar() {
    if (enviando || !prestador) return;
    const mats = materiais.filter((m) => m.tipo.trim());
    if (!ferramentas && !projetoSel) { setErro("Selecione o projeto ou marque Ferramentas."); return; }
    if (!departamento) { setErro("Selecione o departamento de destino."); return; }
    if (!pedidoPor.trim()) { setErro("Informe quem pediu o material (Pedido por)."); return; }
    if (mats.length === 0) { setErro("Informe ao menos um material."); return; }
    const semJust = mats.findIndex((m) => !m.justificativa.trim());
    if (semJust >= 0) { setErro(`Informe a justificativa do material ${semJust + 1} (por que precisa, obra/aplicação).`); return; }
    if (!prazo) { setErro("Informe o prazo estimado de entrega."); return; }
    setErro(""); setOkMsg(""); setEnviando(true);
    try {
      const r = await fetch(`${GESTAO_API}/api/instala/material/para-analise`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departamento, materiais: mats, prazo,
          solicitante: prestador.nome, pedido_por: pedidoPor.trim(),
          setor: setor.trim(), obs, ferramentas,
          projeto_id: ferramentas ? null : projetoSel!.id,
          card_id: sp.get("obra") || null,
          prestador_id: prestador.id, prestador_nome: prestador.nome,
          client_key: clientKey.current,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(typeof j.detail === "string" ? j.detail : `Falha (${r.status})`);
      }
      const res = await r.json();
      if (res?.solicitacao) setLista((ls) => [{ ...res.solicitacao, compra: res.compra ?? null }, ...ls]);
      limpar();
      setOkMsg("Solicitação enviada pro fiscal da obra analisar.");
    } catch (e: any) {
      // O pedido continua preenchido na tela: prestador em obra reenvia quando pegar sinal
      setErro(`Não deu pra enviar (${e?.message ?? e}). O pedido continua preenchido: verifique o sinal e toque em Enviar de novo.`);
    } finally {
      setEnviando(false);
    }
  }

  const dtBR = (v: string | null) =>
    v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  // Pendente = aguardando o fiscal analisar (o card de compras ainda nem existe)
  const stSimples = (s: string) =>
    s === "atendida" ? { l: "ATENDIDA", c: "#34D399" } :
    s === "recusada" ? { l: "RECUSADA", c: "#ef4444" } :
    { l: "COM O FISCAL", c: "#FBBF24" };

  return (
    <Screen slug={slug} titulo="Solicitar material" subtitulo="o fiscal analisa e envia pro setor de compras" voltar={`/${slug}/mais`}
      action={<button onClick={reload} title="Atualizar" style={iconBtn(T)}><RefreshCw size={14} className={loading ? "spin" : ""} /></button>}>

      {/* ── Formulário: base do modal Solicitar Compras do gestão ── */}
      <div style={{ padding: "14px 16px", background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 20 }}>

        {projetoFixo ? (
          /* Veio do card da obra: projeto travado nela, sem seletor nem Ferramentas */
          <div style={{ marginBottom: 14 }}>
            <span style={lbl(T)}>Projeto · fixado pela obra</span>
            <div style={{ ...inp(T), opacity: 0.65 }}>
              {`${projetoFixo.obra_code ? projetoFixo.obra_code + " · " : ""}${projetoFixo.cliente}`}
            </div>
          </div>
        ) : (<>
        {/* Ferramentas: compra pra estoque/equipe, sem projeto vinculado */}
        <label style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer",
          padding: "8px 10px", borderRadius: 8, border: `1px solid ${ferramentas ? "#FBBF24" : T.border}`,
          background: ferramentas ? "rgba(251,191,36,0.07)" : "transparent",
        }}>
          <input type="checkbox" checked={ferramentas}
            onChange={(e) => { setFerramentas(e.target.checked); if (e.target.checked) { setSelId(""); setPickerOpen(false); } }} />
          <span style={{ fontSize: 9, letterSpacing: "0.2em", fontWeight: 600, textTransform: "uppercase", color: ferramentas ? "#FBBF24" : T.textSecondary }}>
            Ferramentas · sem projeto vinculado
          </span>
        </label>

        {ferramentas ? (
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14 }}>
            Solicitação de <b style={{ color: T.textPrimary }}>ferramentas</b>: vai pro kanban de compras sem vinculação a obra/projeto.
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <span style={lbl(T)}>Projeto *</span>
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setPickerOpen((v) => !v)} style={{
                ...inp(T), textAlign: "left", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              }}>
                <span style={{ color: projetoSel ? T.textPrimary : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {projetoSel ? `${projetoSel.obra_code ? projetoSel.obra_code + " · " : ""}${projetoSel.cliente}` : "Selecionar projeto…"}
                </span>
                {pickerOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {pickerOpen && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 40,
                  background: T.bg, border: `1px solid ${T.borderHover}`, borderRadius: 10, overflow: "hidden", maxHeight: 320,
                  display: "flex", flexDirection: "column", boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}>
                  <div style={{ padding: 8, borderBottom: `1px solid ${T.border}` }}>
                    <input autoFocus value={pickerQ} onChange={(e) => setPickerQ(e.target.value)}
                      placeholder="Buscar por obra ou cliente…" style={inp(T)} />
                  </div>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    {filtrados.length === 0 ? (
                      <div style={{ padding: "12px 10px", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: T.textMuted, textAlign: "center" }}>
                        Nenhum projeto
                      </div>
                    ) : filtrados.slice(0, 400).map((p) => (
                      <button key={p.id} type="button"
                        onClick={() => { setSelId(p.id); setPickerOpen(false); setPickerQ(""); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left", padding: "8px 10px", cursor: "pointer",
                          background: p.id === selId ? "rgba(251,191,36,0.1)" : "transparent",
                          border: "none", borderBottom: `1px solid ${T.border}`, color: T.textPrimary,
                        }}>
                        <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: p.id === selId ? "#FBBF24" : T.textMuted }}>
                          {p.obra_code || "sem código"}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>{p.cliente}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </>)}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <span style={lbl(T)}>Departamento de destino *</span>
            <select value={departamento} onChange={(e) => setDepartamento(e.target.value)} style={inp(T)}>
              <option value="">selecionar</option>
              {DEPT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl(T)}>Prazo estimado de entrega *</span>
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inp(T)} />
          </div>
          <div>
            <span style={lbl(T)}>Solicitante *</span>
            {/* Travado no perfil logado, igual ao modal do gestão */}
            <input value={prestador?.nome ?? ""} readOnly style={{ ...inp(T), opacity: 0.65 }} />
          </div>
          <div>
            <span style={lbl(T)}>Pedido por *</span>
            <input value={pedidoPor} onChange={(e) => setPedidoPor(e.target.value)} placeholder="quem vai usar o material" style={inp(T)} />
          </div>
          <div>
            <span style={lbl(T)}>Setor</span>
            <input value={setor} onChange={(e) => setSetor(e.target.value)} style={inp(T)} />
          </div>
        </div>

        <span style={lbl(T)}>Materiais *</span>
        {materiais.map((m, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: materiais.length > 1 ? "1fr 64px 1fr 30px" : "1fr 64px 1fr", gap: 6, marginBottom: 6 }}>
            <input value={m.tipo} onChange={(e) => setMat(i, "tipo", e.target.value)} placeholder="Material / serviço" style={inp(T)} />
            <input value={m.quantidade} onChange={(e) => setMat(i, "quantidade", e.target.value)} placeholder="Qtd" style={inp(T)} />
            <input value={m.justificativa} onChange={(e) => setMat(i, "justificativa", e.target.value)} placeholder="Justificativa * (por quê / obra)" style={inp(T)} />
            {materiais.length > 1 && (
              <button onClick={() => setMateriais((ms) => ms.filter((_, j) => j !== i))} style={{
                background: "transparent", color: T.textSecondary, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><X size={12} /></button>
            )}
          </div>
        ))}
        <button onClick={() => setMateriais((ms) => [...ms, { tipo: "", quantidade: "", justificativa: "" }])} style={{
          background: "transparent", color: T.textSecondary, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 14px",
          fontSize: 9, letterSpacing: "0.16em", fontWeight: 600, cursor: "pointer", marginBottom: 12, textTransform: "uppercase",
        }}>+ Material</button>

        <div style={{ marginBottom: 6 }}>
          <span style={lbl(T)}>Observações</span>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="opcional"
            style={{ ...inp(T), resize: "vertical", fontFamily: "inherit" }} />
        </div>
        {/* Ditado por voz: transcrição cai nas Observações (padrão dos apps de campo) */}
        <div style={{ marginBottom: 12 }}>
          <AudioRec onText={(t) => setObs((d) => (d ? d.trimEnd() + "\n" : "") + t)} />
        </div>

        {erro && <div style={{ marginBottom: 8, fontSize: 11, color: "#ef4444" }}>{erro}</div>}
        {okMsg && <div style={{ marginBottom: 8, fontSize: 11, color: "#34D399" }}>{okMsg}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={limpar} style={{
            flex: 1, padding: "12px 16px", background: "transparent", color: T.textSecondary, borderRadius: 10,
            border: `1px solid ${T.border}`, fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, cursor: "pointer",
          }}>LIMPAR</button>
          <button onClick={enviar} disabled={enviando} style={{
            flex: 2, padding: "12px 16px", background: T.textPrimary, color: T.bg, border: "none", borderRadius: 10,
            fontSize: 11, letterSpacing: "0.16em", fontWeight: 700,
            cursor: enviando ? "not-allowed" : "pointer", opacity: enviando ? 0.6 : 1,
          }}>{enviando ? "ENVIANDO…" : "ENVIAR SOLICITAÇÃO"}</button>
        </div>
      </div>

      {/* ── Lista com o status ao vivo do kanban de compras ── */}
      <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 10 }}>SUAS SOLICITAÇÕES</p>
      {lista.length === 0 ? (
        <div style={{ padding: "30px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, borderRadius: 12, fontSize: 12 }}>
          Nenhuma solicitação enviada.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((s) => {
            const cp = s.compra ?? null;
            // Sem card de compras vinculado (solicitações antigas), o badge cai
            // no status simples da própria tabela de material.
            const bd = cp ? statusBadge(cp) : (() => { const x = stSimples(s.status); return { label: x.l, color: x.c }; })();
            const pg = cp ? progresso(cp) : null;
            const obra = cp && (cp.cliente || cp.obra)
              ? `${cp.obra_code ? cp.obra_code + " · " : ""}${cp.cliente || cp.obra}`
              : (s.card_id ? obraNomes[s.card_id] ?? "-" : "Ferramentas");
            const aberta = abertas.has(s.id);
            return (
              <div key={s.id} style={{ padding: "12px 14px", background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, letterSpacing: "0.1em", color: T.textMuted, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Package size={10} style={{ marginRight: 4 }} />{obra}
                  </span>
                  <span style={{ fontSize: 9, letterSpacing: "0.12em", fontWeight: 600, whiteSpace: "nowrap", color: bd.color }}>
                    {bd.label.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.textPrimary, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{s.itens}</div>
                <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 4 }}>
                  {new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {cp?.responsavel ? ` · com ${cp.responsavel}` : ""}
                </div>
                {/* Recusa do fiscal na análise: o instalador vê o porquê aqui */}
                {s.status === "recusada" && s.motivo_recusa && (
                  <div style={{ fontSize: 10, color: "#B85B4C", marginTop: 6 }}>
                    Motivo da recusa: {s.motivo_recusa}
                  </div>
                )}
                {/* Trilha do fluxo: onde o pedido está e quanto falta */}
                {pg && (
                  <>
                    <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
                      {pg.etapas.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= pg.idx ? bd.color : T.border }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 4 }}>Etapa {pg.idx + 1} de {pg.total}</div>
                  </>
                )}
                {cp && (
                  <button onClick={() => setAbertas((a) => { const n = new Set(a); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                    style={{
                      background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, color: T.textSecondary,
                      padding: "6px 12px", marginTop: 8, cursor: "pointer", fontSize: 9, letterSpacing: "0.14em", fontWeight: 600,
                    }}>
                    {aberta ? "OCULTAR DETALHES" : "VER DETALHES"}
                  </button>
                )}
                {cp && aberta && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 10, color: T.textSecondary }}>
                      Destino: {cp.departamento || ""} · Prazo: {dtBR(cp.prazo) || "sem prazo"}
                    </div>
                    {pg && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {pg.etapas.map((et, i) => {
                          // Etapa cumprida ganha a cor do status; a atual em destaque; futuras apagadas
                          const feito = i < pg.idx, agora = i === pg.idx;
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{
                                width: 8, height: 8, flex: "none", borderRadius: "50%",
                                background: feito || agora ? bd.color : "transparent",
                                border: `1px solid ${feito || agora ? bd.color : T.border}`,
                              }} />
                              <span style={{ fontSize: 10, color: agora ? T.textPrimary : feito ? T.textSecondary : T.textMuted, fontWeight: agora ? 600 : 400 }}>
                                {et}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(cp.materiais || []).map((m, i) => (
                      <div key={i} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 12, color: T.textPrimary }}>
                          <b>{m.quantidade || ""}{m.quantidade ? " · " : ""}</b>{m.tipo || ""}
                        </div>
                        {m.justificativa && <div style={{ fontSize: 10, color: T.textSecondary, fontStyle: "italic", marginTop: 2 }}>{m.justificativa}</div>}
                      </div>
                    ))}
                    {cp.obs && <div style={{ fontSize: 10, color: T.textSecondary }}>Observações: {cp.obs}</div>}
                    {cp.motivo && <div style={{ fontSize: 10, color: "#B85B4C" }}>Motivo: {cp.motivo}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

const inp = (T: any): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box", padding: "11px 12px",
  background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8,
  color: T.textPrimary, fontSize: 13, outline: "none",
});

const lbl = (T: any): React.CSSProperties => ({
  fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase",
  color: T.textMuted, display: "block", marginBottom: 4, fontWeight: 600,
});

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});
