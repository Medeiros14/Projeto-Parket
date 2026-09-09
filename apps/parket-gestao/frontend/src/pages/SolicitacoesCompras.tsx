import React, { useEffect, useMemo, useRef, useState } from "react";
import { fonts, useTheme } from "../theme";
import { api, type SolicitacaoCompra, type Projeto as P } from "../api";
import { inputStyle, btnGhost, btnAccent } from "./Obras";

/* ═══════════════════════════════════════════════════════════════════
   SOLICITAÇÃO DE COMPRAS — mesmo fluxo do Space/compras-app:
   cria card no kanban de compras.parket.works (Cloud kanban_cards).
   ═══════════════════════════════════════════════════════════════════ */

export const DEPT_OPTS = [
  { value: "marcenaria-ronaldo", label: "Marcenaria — Ronaldo" },
  { value: "lalamove-ronaldo",   label: "Lalamove / Frete — Ronaldo" },
  { value: "instalacao-taiara",  label: "Instalação — Taiara" },
  { value: "amostras-marco",     label: "Amostras — Marco Antônio" },
];

// Labels das colunas do kanban de compras (espelho de COLUNAS_COMPRAS do compras-app)
const COLUNA_LABEL: Record<string, Record<string, string>> = {
  "compras": {
    "entrada": "Solicitações", "cotacao": "Em Cotação",
    "aguarda-aprovacao": "Aguardando Liberação", "emissao-pedido": "Liberação ao Fornecedor",
    "em-transito": "Em Rota de Entrega", "recebimento-auditoria": "Recebido e Conferido",
    "concluido": "Finalizado",
  },
  "compras-taiara": {
    "entrada": "Entrada de Demandas", "cotacao": "Cotação e Priorização",
    "aguarda-aprovacao": "Interface Financeira", "emissao-pedido": "Emissão do Pedido",
    "em-transito": "Logística e Acompanhamento", "recebimento-auditoria": "Recebimento e Conferência",
    "concluido": "Finalizado", "amostras": "Amostras em Execução",
  },
  "compras-marco": {
    "solicitacao": "Solicitação", "em-execucao": "Em Execução", "amostra-pronta": "Amostra Pronta",
    "em-rota-entrega": "Em Rota de Entrega", "finalizado": "Finalizado",
  },
};

export function colunaLabel(s: SolicitacaoCompra): string {
  if (s.column_id === null) return "removido do kanban";
  if (!s.column_id) return s.status || "pendente";
  return COLUNA_LABEL[s.dept_id || ""]?.[s.column_id] || s.column_id;
}

// Cores das colunas — espelho 1:1 de COLUNAS_COMPRAS do compras-app.
const COLUNA_COR: Record<string, string> = {
  "entrada": "#6B7280", "cotacao": "#3B82F6", "aguarda-aprovacao": "#F59E0B",
  "emissao-pedido": "#8B5CF6", "em-transito": "#14B8A6", "recebimento-auditoria": "#F97316",
  "concluido": "#10B981", "amostras": "#EC4899",
  "solicitacao": "#6B7280", "em-execucao": "#3B82F6", "amostra-pronta": "#F59E0B",
  "em-rota-entrega": "#14B8A6", "finalizado": "#10B981",
};

// Badge de status — 100% vinculado ao compras.parket.works: mostra a coluna
// REAL onde o card está no kanban (mesmo label e cor das colunas de lá).
// Overrides: rejeitado sempre vermelho; pendente enquanto na coluna de entrada.
export function statusBadge(s: SolicitacaoCompra): { label: string; color: string } {
  if (s.column_id === null) return { label: "removido do kanban", color: "#B85B4C" };
  const st = (s.status || "pendente").toLowerCase();
  if (st === "rejeitado") return { label: "Rejeitado", color: "#EF4444" };
  const col = s.column_id || "";
  const lbl = COLUNA_LABEL[s.dept_id || ""]?.[col];
  if (st === "pendente" && (!col || col === "entrada" || col === "solicitacao"))
    return { label: "Pendente", color: "#F59E0B" };
  if (lbl) return { label: lbl, color: COLUNA_COR[col] || "#10B981" };
  return { label: st === "pendente" ? "Pendente" : "Aceito", color: st === "pendente" ? "#F59E0B" : "#10B981" };
}

// Badge de ORIGEM — de onde o pedido entrou no kanban de compras (Will 03/09).
// Fiscal = solicitado no verifica.parket.works pelo próprio fiscal na obra.
const ORIGEM_BADGE: Record<string, { label: string; color: string }> = {
  "fiscal_verifica":           { label: "Fiscal",     color: "#8B5CF6" },
  "instala_prestador":         { label: "Instalador", color: "#0EA5E9" },
  "gestao_projeto":            { label: "Gestão",     color: "#6B7280" },
  "gestao_ferramentas":        { label: "Gestão",     color: "#6B7280" },
  "formulario_publico":        { label: "Space",      color: "#0D9488" },
  "watcher-contrato-assinado": { label: "Automático", color: "#B45309" },
  "watcher-amostra-aprovada":  { label: "Automático", color: "#B45309" },
};

export function origemBadge(s: SolicitacaoCompra): { label: string; color: string } {
  return ORIGEM_BADGE[String(s.origem || "")] || { label: "Outra", color: "#9CA3AF" };
}

export const fmtBr = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

/** Data + hora BR pra solicitações — usa horário local do browser quando
 *  o backend manda ISO com timezone. Cai pra só a data se veio "YYYY-MM-DD".*/
export function fmtBrDateTime(d?: string | null): string {
  if (!d) return "";
  const iso = String(d);
  if (iso.length === 10) return fmtBr(iso);        // veio só a data
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return fmtBr(iso);
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type MatRow = { tipo: string; quantidade: string; justificativa: string };

/* ─── Seção dentro do card do projeto (aba Itens & Cronograma) ─── */

export default function SolicitacoesComprasSection({ projetoId, projeto, t, modal, setModal }: {
  projetoId: string; projeto: P; t: any;
  modal: boolean; setModal: (v: boolean) => void;
}) {
  const [lista, setLista] = useState<SolicitacaoCompra[]>([]);
  const [flashMsg, setFlashMsg] = useState("");

  const load = () => { api.solicitacoesCompras(projetoId).then(setLista).catch(() => {}); };
  useEffect(load, [projetoId]);

  const flash = (m: string) => { setFlashMsg(m); setTimeout(() => setFlashMsg(""), 5000); };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8, gap: 8, flexWrap: "wrap",
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.24em",
          textTransform: "uppercase", color: t.textSecondary, fontWeight: 500,
        }}>
          Solicitações de Compras ({lista.length})
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {flashMsg && <span style={{ fontSize: 10, color: t.accent, letterSpacing: "0.06em" }}>{flashMsg}</span>}
          <button onClick={() => setModal(true)} style={btnAccent(t)}>+ Solicitar compras</button>
        </div>
      </div>

      <ListaSolicitacoes lista={lista} t={t} />

      {modal && (
        <SolicitarComprasModal t={t} projetoFixo={projeto}
          onClose={() => setModal(false)}
          onCriada={(s) => { setModal(false); setLista(prev => [...prev, s]); flash("Solicitação enviada pro kanban de compras."); }} />
      )}
    </div>
  );
}

export function ListaSolicitacoes({ lista, t, mostrarProjeto = false }: {
  lista: SolicitacaoCompra[]; t: any; mostrarProjeto?: boolean;
}) {
  const [aberto, setAberto] = useState<SolicitacaoCompra | null>(null);
  if (lista.length === 0) {
    return (
      <div style={{
        background: t.card1, border: `1px dashed ${t.border1}`, padding: "14px 16px",
        textAlign: "center", fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary,
        textTransform: "uppercase",
      }}>
        Nenhuma solicitação de compras
      </div>
    );
  }
  const th: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase",
    color: t.textTertiary, fontWeight: 500, textAlign: "left", padding: "9px 12px",
    borderBottom: `1px solid ${t.border2}`, whiteSpace: "nowrap",
    position: "sticky", top: 0, background: t.card1, zIndex: 1,
  };
  const td: React.CSSProperties = {
    fontSize: 11, color: t.textPrimary, padding: "9px 12px",
    borderBottom: `1px solid ${t.border1}`, verticalAlign: "top",
  };
  return (
    // rolagem vertical com cabeçalho fixo — linha mostra tudo (células quebram linha)
    <div style={{ background: t.card1, border: `1px solid ${t.border1}`, maxHeight: "calc(100vh / var(--pkz, 1) - 170px)", overflowY: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>Data</th>
            {mostrarProjeto && <th style={th}>Obra / Projeto</th>}
            <th style={th}>Origem / Solicitante</th>
            <th style={th}>Materiais</th>
            <th style={th}>Destino</th>
            <th style={th}>Prazo</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((s) => {
            const badge = statusBadge(s);
            const origem = origemBadge(s);
            const mats = s.materiais?.map(m => `${m.quantidade ? m.quantidade + " — " : ""}${m.tipo}`).join(" · ") || "—";
            return (
              <tr key={String(s.id)}
                  onClick={() => setAberto(s)}
                  title="Ver detalhes da solicitação (somente leitura)"
                  style={{ cursor: "pointer" }}>
                <td style={{ ...td, color: t.textTertiary, fontSize: 10, fontVariantNumeric: "tabular-nums" as any, whiteSpace: "nowrap" }}>
                  {fmtBrDateTime(s.data)}
                </td>
                {mostrarProjeto && (
                  <td style={td}>
                    {s.projeto_id ? (
                      <a href={`/projetos/${s.projeto_id}`}
                         onClick={(e) => e.stopPropagation()}
                         style={{ color: t.accent, textDecoration: "none", fontSize: 10 }}>
                        {s.obra_code ? s.obra_code + " — " : ""}{s.cliente || "—"}
                      </a>
                    ) : (
                      <span style={{ color: t.textSecondary, fontSize: 10 }}>{s.obra || "—"}</span>
                    )}
                  </td>
                )}
                <td style={{ ...td, color: t.textSecondary, fontSize: 10 }}>
                  {/* Chip de origem + nome: mostra se o pedido veio do Fiscal ou não */}
                  <div style={{
                    display: "inline-block", fontFamily: fonts.cinzel, fontSize: 8,
                    letterSpacing: "0.18em", textTransform: "uppercase", padding: "2px 6px",
                    border: `1px solid ${origem.color}55`, color: origem.color,
                    marginBottom: 3, whiteSpace: "nowrap",
                  }}>
                    {origem.label}
                  </div>
                  <div>{s.solicitante || s.origem_nome || "—"}</div>
                </td>
                <td style={td}>{mats}</td>
                <td style={{ ...td, color: t.textSecondary, fontSize: 10 }}>{s.responsavel || "—"}</td>
                <td style={{ ...td, color: t.textSecondary, fontSize: 10, fontVariantNumeric: "tabular-nums" as any, whiteSpace: "nowrap" }}>
                  {s.prazo ? fmtBr(s.prazo) : "—"}
                </td>
                <td style={td}>
                  <span title={colunaLabel(s)} style={{
                    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
                    padding: "3px 8px", border: `1px solid ${badge.color}55`, color: badge.color,
                    whiteSpace: "nowrap",
                  }}>
                    {badge.label}
                  </span>
                  {(s.status || "").toLowerCase() === "rejeitado" && s.motivo && (
                    <div style={{ fontSize: 9, color: "#EF4444", letterSpacing: "0.04em", marginTop: 4 }}>
                      Motivo: {s.motivo}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {aberto && <SolicitacaoDetalheModal s={aberto} t={t} onFechar={() => setAberto(null)} />}
    </div>
  );
}

/* ─── Modal read-only da solicitação (aberto ao clicar linha na lista) ─── */

function SolicitacaoDetalheModal({ s, t, onFechar }: {
  s: SolicitacaoCompra; t: any; onFechar: () => void;
}) {
  const [mode] = useTheme();
  const modalBg = mode === "dark" ? "#141414" : "#F3F0E8"; // sólido (sem alpha) pro form ficar opaco
  const badge = statusBadge(s);
  const label: React.CSSProperties = {
    fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em",
    textTransform: "uppercase", color: t.textTertiary, marginBottom: 4, display: "block",
  };
  const box: React.CSSProperties = {
    background: t.bg, border: `1px solid ${t.border1}`, padding: "10px 12px",
    fontSize: 12, color: t.textPrimary, whiteSpace: "pre-wrap", lineHeight: 1.5,
    fontFamily: fonts.inter,
  };
  return (
    <div onClick={onFechar} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        // Sólido (sem alpha) pro formulário não deixar o backdrop escuro vazar
        background: modalBg, border: `1px solid ${t.border1}`,
        width: "min(760px, 96vw)", maxHeight: "92vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${t.border1}`,
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <span style={{ width: 6, height: 24, background: badge.color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.16em", color: t.textPrimary }}>
              {s.obra_code ? s.obra_code + " — " : ""}{s.cliente || s.obra || "Solicitação de compras"}
            </div>
            <div style={{ fontFamily: fonts.inter, fontSize: 10, color: t.textTertiary, marginTop: 2 }}>
              {fmtBrDateTime(s.data)}{s.solicitante ? ` · por ${s.solicitante}` : ""}
              {` · origem: ${origemBadge(s).label}`}
              {s.projeto_id && (
                <> · <a href={`/projetos/${s.projeto_id}`} style={{ color: t.accent, textDecoration: "none" }}>abrir projeto ↗</a></>
              )}
            </div>
          </div>
          <span style={{
            fontFamily: fonts.inter, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "3px 10px", border: `1px solid ${badge.color}`, color: badge.color,
          }}>{badge.label}</span>
          <button onClick={onFechar} style={{
            background: "transparent", border: "none", color: t.textTertiary,
            cursor: "pointer", fontSize: 18, padding: 4, marginLeft: 4,
          }}>×</button>
        </div>

        {/* Corpo */}
        <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {s.titulo && (
            <div><label style={label}>Título</label><div style={box}>{s.titulo}</div></div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={label}>Destino / Responsável</label>
              <div style={box}>{s.responsavel || "—"}</div>
            </div>
            <div><label style={label}>Departamento</label>
              <div style={box}>{s.departamento || DEPT_OPTS.find(o => o.value === s.dept_id)?.label || s.dept_id || "—"}</div>
            </div>
            <div><label style={label}>Prazo</label>
              <div style={box}>{s.prazo ? fmtBr(s.prazo) : "—"}</div>
            </div>
            <div><label style={label}>Coluna no kanban</label>
              <div style={box}>{colunaLabel(s)}</div>
            </div>
          </div>

          <div>
            <label style={label}>Materiais</label>
            {s.materiais && s.materiais.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {s.materiais.map((m, i) => (
                  <div key={i} style={{ ...box, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ fontSize: 12, color: t.textPrimary }}>
                      <b>{m.quantidade ? m.quantidade + " — " : ""}</b>{m.tipo || "—"}
                    </div>
                    {m.justificativa && (
                      <div style={{ fontSize: 10, color: t.textTertiary, fontStyle: "italic" }}>
                        {m.justificativa}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <div style={{ ...box, color: t.textTertiary, fontStyle: "italic" }}>Sem materiais</div>}
          </div>

          {s.obs && (
            <div><label style={label}>Observações</label><div style={box}>{s.obs}</div></div>
          )}

          {(s.status || "").toLowerCase() === "rejeitado" && s.motivo && (
            <div><label style={{ ...label, color: "#EF4444" }}>Motivo da rejeição</label>
              <div style={{ ...box, borderColor: "#EF4444", color: "#EF4444" }}>{s.motivo}</div>
            </div>
          )}

          <div style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, letterSpacing: "0.06em", marginTop: 4 }}>
            Somente leitura. Pra editar/aprovar/mover, vá em <a href="https://compras.parket.works" target="_blank" rel="noreferrer" style={{ color: t.accent, textDecoration: "none" }}>compras.parket.works ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal — modo fixo (dentro do card) ou com seletor de projeto (página /compras) ─── */

export function SolicitarComprasModal({ t, onClose, onCriada, projetoFixo, projetos, usuario }: {
  t: any; onClose: () => void; onCriada: (s: SolicitacaoCompra) => void;
  projetoFixo?: P | null;   // modo card: projeto já definido
  projetos?: P[];           // modo página: usuário escolhe o projeto
  usuario?: string;         // identidade do usuário logado (trava o solicitante)
}) {
  const [selId, setSelId] = useState(projetoFixo?.id || "");
  // Ferramentas: solicitação sem projeto vinculado (compra pra estoque/equipe)
  const [ferramentas, setFerramentas] = useState(false);
  const projeto = projetoFixo || (projetos || []).find(p => p.id === selId) || null;

  const gestorNome = (projeto?.gestor_email || "").split("@")[0];
  // Solicitante travado no perfil: usuário logado (página) ou gestor do projeto (card).
  const perfilLogado = (usuario || "").trim()
    || (gestorNome ? gestorNome.charAt(0).toUpperCase() + gestorNome.slice(1) : "");
  const [departamento, setDepartamento] = useState("");
  const [solicitante, setSolicitante] = useState(perfilLogado);
  const [pedidoPor, setPedidoPor] = useState("");
  const [setor, setSetor] = useState("Gestão de Projetos");
  const [materiais, setMateriais] = useState<MatRow[]>([{ tipo: "", quantidade: "", justificativa: "" }]);
  const [prazo, setPrazo] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const setMat = (i: number, k: keyof MatRow, v: string) =>
    setMateriais(m => m.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const enviar = async () => {
    const mats = materiais.filter(m => m.tipo.trim());
    const quem = (perfilLogado || solicitante).trim();
    if (!ferramentas && !projeto) { setErro("Selecione o projeto ou marque Ferramentas."); return; }
    if (!departamento) { setErro("Selecione o departamento de destino."); return; }
    if (!quem) { setErro("Informe o solicitante."); return; }
    if (!pedidoPor.trim()) { setErro("Informe quem pediu o material (Pedido por)."); return; }
    if (mats.length === 0) { setErro("Informe ao menos um material."); return; }
    // Compras precisa entender o pra quê de cada item — justificativa obrigatória.
    const semJust = mats.findIndex(m => !m.justificativa.trim());
    if (semJust >= 0) { setErro(`Informe a justificativa do material ${semJust + 1} (por que precisa, obra/aplicação).`); return; }
    if (!prazo) { setErro("Informe o prazo estimado de entrega."); return; }
    setErro(""); setEnviando(true);
    try {
      if (ferramentas) {
        const nova = await api.solicitacaoComprasFerramentas(
          { departamento, materiais: mats, prazo, solicitante: quem, pedido_por: pedidoPor.trim(), setor: setor.trim() || "Ferramentas", obs },
          undefined);
        onCriada({ ...nova, projeto_id: null as any, cliente: "Ferramentas", obra_code: null as any });
        return;
      }
      const nova = await api.solicitacaoComprasCreate(projeto!.id,
        { departamento, materiais: mats, prazo, solicitante: quem, pedido_por: pedidoPor.trim(), setor: setor.trim(), obs },
        projeto!.gestor_email || undefined);
      onCriada({ ...nova, projeto_id: projeto!.id, cliente: projeto!.cliente, obra_code: projeto!.obra_code });
    } catch (err: any) {
      setErro(`Erro ao enviar: ${err?.message || err}`);
      setEnviando(false);
    }
  };

  const lbl: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase",
    color: t.textTertiary, display: "block", marginBottom: 4,
  };

  return (
    // backdrop SEM onClick de fechar — modal com form não fecha em click-fora
    <div style={{
      position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: t.bg, border: `1px solid ${t.border2}`, width: 640, maxWidth: "100%",
        maxHeight: "90vh", overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.24em",
            textTransform: "uppercase", color: t.textPrimary,
          }}>
            Solicitar Compras
          </div>
          <button onClick={onClose} style={{
            background: "transparent", color: t.textTertiary, border: `1px solid ${t.border1}`,
            padding: "3px 10px", fontFamily: fonts.cinzel, fontSize: 12, cursor: "pointer",
          }}>×</button>
        </div>

        {!projetoFixo && (
          <label style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer",
            padding: "8px 10px",
            border: `1px solid ${ferramentas ? t.accent : t.border1}`,
            background: ferramentas ? "rgba(199,164,91,0.08)" : "transparent",
          }}>
            <input type="checkbox" checked={ferramentas}
              onChange={(e) => { setFerramentas(e.target.checked); if (e.target.checked) setSelId(""); }} />
            <span style={{
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", color: ferramentas ? t.accent : t.textSecondary,
            }}>Ferramentas — sem projeto vinculado</span>
          </label>
        )}

        {projetoFixo ? (
          <div style={{ fontSize: 10, color: t.textSecondary, marginBottom: 14, letterSpacing: "0.04em" }}>
            Projeto: <strong style={{ color: t.textPrimary }}>
              {projetoFixo.obra_code ? projetoFixo.obra_code + " — " : ""}{projetoFixo.cliente}
            </strong>
          </div>
        ) : ferramentas ? (
          <div style={{ fontSize: 10, color: t.textTertiary, marginBottom: 14, letterSpacing: "0.04em" }}>
            Solicitação de <b style={{ color: t.textPrimary }}>ferramentas</b> — vai pro kanban de compras
            sem vinculação a obra/projeto.
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <span style={lbl}>Projeto *</span>
            <ProjetoPicker t={t} projetos={projetos || []} selId={selId} onSelect={setSelId} />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <span style={lbl}>Departamento de destino *</span>
            <select value={departamento} onChange={e => setDepartamento(e.target.value)}
              style={{ ...inputStyle(t), width: "100%" }}>
              <option value="">— selecionar —</option>
              {DEPT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Prazo estimado de entrega *</span>
            <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)}
              style={{ ...inputStyle(t), width: "100%" }} />
          </div>
          <div>
            <span style={lbl}>Solicitante *</span>
            {perfilLogado ? (
              <input value={perfilLogado} readOnly disabled title="Travado no perfil logado"
                style={{ ...inputStyle(t), width: "100%", opacity: 0.65, cursor: "not-allowed" }} />
            ) : (
              <input value={solicitante} onChange={e => setSolicitante(e.target.value)}
                style={{ ...inputStyle(t), width: "100%" }} />
            )}
          </div>
          <div>
            <span style={lbl}>Pedido por *</span>
            <input value={pedidoPor} onChange={e => setPedidoPor(e.target.value)}
              placeholder="quem vai usar o material"
              style={{ ...inputStyle(t), width: "100%" }} />
          </div>
          <div>
            <span style={lbl}>Setor</span>
            <input value={setor} onChange={e => setSetor(e.target.value)}
              style={{ ...inputStyle(t), width: "100%" }} />
          </div>
        </div>

        <span style={lbl}>Materiais *</span>
        {materiais.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <input value={m.tipo} onChange={e => setMat(i, "tipo", e.target.value)}
              placeholder="Material / serviço"
              style={{ ...inputStyle(t), flex: "2 1 180px" }} />
            <input value={m.quantidade} onChange={e => setMat(i, "quantidade", e.target.value)}
              placeholder="Qtd"
              style={{ ...inputStyle(t), flex: "0 0 70px" }} />
            <input value={m.justificativa} onChange={e => setMat(i, "justificativa", e.target.value)}
              placeholder="Justificativa * (por quê / obra)" required={!!m.tipo.trim()}
              style={{ ...inputStyle(t), flex: "2 1 160px" }} />
            {materiais.length > 1 && (
              <button onClick={() => setMateriais(ms => ms.filter((_, j) => j !== i))}
                style={{
                  background: "transparent", color: t.textTertiary, border: `1px solid ${t.border1}`,
                  padding: "4px 9px", fontFamily: fonts.cinzel, fontSize: 11, cursor: "pointer",
                }}>×</button>
            )}
          </div>
        ))}
        <button onClick={() => setMateriais(ms => [...ms, { tipo: "", quantidade: "", justificativa: "" }])}
          style={{ ...btnGhost(t), marginBottom: 12 }}>+ Material</button>

        <div style={{ marginBottom: 14 }}>
          <span style={lbl}>Observações</span>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
            style={{ ...inputStyle(t), width: "100%", resize: "vertical" } as any} />
        </div>

        {erro && (
          <div style={{ fontSize: 10, color: "#B85B4C", marginBottom: 10, letterSpacing: "0.04em" }}>{erro}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhost(t)}>Cancelar</button>
          <button onClick={enviar} disabled={enviando}
            style={{ ...btnAccent(t), opacity: enviando ? 0.5 : 1 }}>
            {enviando ? "Enviando…" : "Enviar solicitação"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Seletor de projeto com busca (typeahead) — padrão do Space ─── */

function ProjetoPicker({ t, projetos, selId, onSelect }: {
  t: any; projetos: P[]; selId: string; onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selecionado = projetos.find(p => p.id === selId) || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    setTimeout(() => inputRef.current?.focus(), 20);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtrados = useMemo(() => {
    // Ordena alfabético pelo nome do cliente (case-insensitive, pt-BR)
    // pra deixar a lista/rolagem previsível.
    const base = [...projetos].sort((a, b) =>
      (a.cliente || "").localeCompare(b.cliente || "", "pt-BR", { sensitivity: "base" }));
    const k = q.trim().toLowerCase();
    if (!k) return base;
    return base.filter(p => {
      const alvo = [p.cliente, p.obra_code, (p as any).obra, (p as any).endereco].filter(Boolean).join(" ").toLowerCase();
      return alvo.includes(k);
    });
  }, [projetos, q]);

  const btnStyle: React.CSSProperties = {
    ...inputStyle(t), width: "100%", textAlign: "left", cursor: "pointer",
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={btnStyle}>
        <span style={{ color: selecionado ? t.textPrimary : t.textTertiary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selecionado
            ? `${selecionado.obra_code ? selecionado.obra_code + " — " : ""}${selecionado.cliente}`
            : "Selecionar projeto…"}
        </span>
        <span style={{ color: t.textTertiary, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
          background: t.bg, border: `1px solid ${t.border2}`, zIndex: 400,
          maxHeight: 320, display: "flex", flexDirection: "column",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${t.border1}` }}>
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar por obra ou cliente…"
              style={{ ...inputStyle(t), width: "100%" }} />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtrados.length === 0 ? (
              <div style={{
                padding: "12px 10px", fontSize: 10, letterSpacing: "0.18em",
                textTransform: "uppercase", color: t.textTertiary, textAlign: "center",
              }}>Nenhum projeto</div>
            ) : filtrados.map(p => {
              const ativo = p.id === selId;
              return (
                <button key={p.id} type="button"
                  onClick={() => { onSelect(p.id); setOpen(false); setQ(""); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 10px", cursor: "pointer",
                    background: ativo ? `${t.accent}22` : "transparent",
                    border: "none",
                    borderBottom: `1px solid ${t.border1}`,
                    color: t.textPrimary,
                  }}>
                  <div style={{
                    fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                    textTransform: "uppercase", color: ativo ? t.accent : t.textTertiary,
                  }}>
                    {p.obra_code || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: t.textPrimary, marginTop: 2 }}>
                    {p.cliente}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
