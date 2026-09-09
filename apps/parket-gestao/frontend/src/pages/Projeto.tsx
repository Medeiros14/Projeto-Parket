import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fonts, statusColor, stageCategoryColor, useTokens } from "../theme";
import {
  api, Projeto as P, Etapa, Item, Evento,
  type Laudo, type Foto, type Agenda, type Fiscal,
  type EquipeParket, type CronogramaRow, type PrestadorVinculado,
  type WhatsappMessage, type RelacionamentoConversa, type WhatsappGrupo,
  type CopilotoResp, type CopilotoSugestao, type MapaPrint,
  type Documento, type AnteprojetoPrancha,
  type CustoLancamentoLinha, type CustoStatus,
} from "../api";
import { AgendaModal } from "./Fiscal";
import { LaudoDetalheModal } from "../components/LaudoDetalheModal";
import { ChecklistObraTab } from "../components/ChecklistObraTab";
import {
  categoriaCor,
  inputStyle as inputStyleObras,
  btnGhost, btnAccent, modalBackdrop,
  toISO, fmtBR, STATUS_CONCLUIDO,
} from "./Obras";
import ObraAcompanhamentoPanel from "./ObraAcompanhamento";
import DocumentosTab, { fmtBytes, extIcon } from "./Documentos";
import VisaoGeralTab from "../components/VisaoGeralTab";
import TarefasReuniaoCard from "../components/TarefasReuniaoCard";
import TarefasTab from "../components/TarefasTab";
import { AlertarProblemaModal } from "./Crises";
import type { Crise } from "../api";
import { midiaThumb } from "../lib/midia";

const STATUS_ETAPA = ["pendente","em_andamento","concluida","com_ressalva","na"];

export default function ProjetoPage() {

  const t = useTokens();
  const { id } = useParams<{ id: string }>();
  const [projeto, setProjeto] = useState<P | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregaErro, setCarregaErro] = useState<string | null>(null);
  const [etapaSelecionada, setEtapaSelecionada] = useState<number | null>(null);
  type Aba = "visao" | "tarefas" | "detalhes" | "mapa" | "fiscal" | "instalador" | "custos" | "relacionamento" | "documentos";
  const ABAS: Aba[] = ["visao", "tarefas", "detalhes", "mapa", "fiscal", "instalador", "custos", "relacionamento", "documentos"];
  const tabParam = new URLSearchParams(window.location.search).get("tab");
  // links antigos ?tab=laudos / ?tab=checklist caem na aba Fiscal, na sub certa
  const [aba, setAba] = useState<Aba>(
    tabParam === "laudos" || tabParam === "checklist" ? "fiscal" :
    tabParam && (ABAS as string[]).includes(tabParam) ? (tabParam as Aba) : "visao");
  const fiscalSubInicial: "checklist" | "reconhecimento" =
    tabParam === "laudos" ? "reconhecimento" : "checklist";
  const trocarAba = (a: Aba) => {
    setAba(a);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", a);
    window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
  };
  const [alertarProblema, setAlertarProblema] = useState(false);
  const [crisesAbertas, setCrisesAbertas] = useState<Crise[]>([]);

  useEffect(() => {
    const cardId = projeto?.card_id;
    if (!cardId) { setCrisesAbertas([]); return; }
    api.crises({ card_id: cardId, abertas: true })
      .then(setCrisesAbertas)
      .catch(() => setCrisesAbertas([]));
  }, [projeto?.card_id]);

  const loadAll = () => {
    if (!id) return;
    setCarregaErro(null);
    setProjeto(null);
    api.projeto(id)
      .then((r) => { setProjeto(r.projeto); setEtapas(r.etapas); })
      .catch((e) => {
        console.error(e);
        setCarregaErro(String(e?.message || e || "projeto não encontrado"));
      });
    api.eventos(id).then(setEventos).catch(() => setEventos([]));
  };
  useEffect(loadAll, [id]);

  const patchEtapa = async (numero: number, patch: any) => {
    if (!id) return;
    await api.etapaPatch(id, numero, patch);
    loadAll();
  };

  if (carregaErro) {
    return (
      <div style={{ padding: 40, color: t.textSecondary }}>
        <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary, marginBottom: 12 }}>
          Projeto não encontrado
        </div>
        <div style={{ marginBottom: 16, fontSize: 13 }}>
          O ID <code style={{ background: t.card2, padding: "2px 6px" }}>{id}</code> não existe em gestão.projetos.
          Anexos e edições vão falhar. Abra o projeto correto pela lista.
        </div>
        <Link to="/" style={{
          display: "inline-block", padding: "8px 14px", border: `1px solid ${t.border2}`,
          textDecoration: "none", color: t.textPrimary, fontSize: 11, letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}>
          ← Todos os projetos
        </Link>
      </div>
    );
  }
  if (!projeto) {
    return <div style={{ padding: 40, color: t.textSecondary }}>carregando…</div>;
  }
  const cor = statusColor[projeto.status] || t.textSecondary;

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr", overflow: "hidden" }}>
      {/* HEAD do projeto */}
      <div style={{ padding: "20px 32px 16px", borderBottom: `1px solid ${t.border1}` }}>
        <Link to="/" style={{ fontSize: 9, letterSpacing: "0.24em", color: t.textTertiary, textDecoration: "none", textTransform: "uppercase" }}>
          ← Todos os projetos
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 6, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontFamily: fonts.cinzel, fontSize: 20, letterSpacing: "0.10em", color: t.textPrimary }}>
                {projeto.cliente.toUpperCase()}
              </div>
              {crisesAbertas.length > 0 && (
                <Link to="/crises" title={crisesAbertas.map(c => c.descricao).join("\n")} style={{
                  fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                  padding: "3px 10px", background: "#d05a3b", color: "#fff",
                  textDecoration: "none",
                }}>
                  EM CRISE{crisesAbertas.length > 1 ? ` ×${crisesAbertas.length}` : ""}
                </Link>
              )}
            </div>
            <div style={{ fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase", marginTop: 4 }}>
              #{projeto.numero_proposta || "s/nº"}
              {projeto.obra_code ? ` · ${projeto.obra_code}` : ""}
              {projeto.vendedor ? ` · vendedor ${projeto.vendedor}` : ""}
            </div>
            {projeto.endereco && (
              <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6 }}>{projeto.endereco}</div>
            )}
            <CenterAcesso pid={projeto.id} t={t} />
          </div>
          <div style={{ textAlign: "right" }}>
            <button onClick={() => setAlertarProblema(true)} style={{
              padding: "4px 10px", border: "1px solid #d05a3b", background: "transparent",
              color: "#d05a3b", cursor: "pointer", marginBottom: 6,
              fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
            }}>
              Alertar Problema
            </button>
            <div style={{ fontSize: 9, letterSpacing: "0.22em", color: cor, textTransform: "uppercase" }}>
              {projeto.status.replace("_", " ")}
            </div>
            <div style={{ fontSize: 22, fontFamily: fonts.cinzel, color: t.textPrimary, marginTop: 4 }}>
              {projeto.pct_completo}%
            </div>
            <div style={{ fontSize: 8, letterSpacing: "0.14em", color: t.textTertiary, textTransform: "uppercase" }}>
              {projeto.n_entregues}/{projeto.n_itens} itens · etapa {projeto.etapa_atual}/9
            </div>
          </div>
        </div>
      </div>

      {alertarProblema && (
        <AlertarProblemaModal
          origem="projeto"
          prefill={{
            card_id: projeto.card_id || null,
            projeto_id: projeto.id,
            cliente: projeto.cliente,
          }}
          onFechar={() => setAlertarProblema(false)}
          onOk={() => {
            setAlertarProblema(false);
            if (projeto.card_id) {
              api.crises({ card_id: projeto.card_id, abertas: true })
                .then(setCrisesAbertas).catch(() => {});
            }
          }}
        />
      )}

      {/* TABS — Itens & Cronograma (fusão Itens do Projeto + Obra & Cronograma, Will 10/07) */}
      <div style={{
        display: "flex", gap: 4, padding: "0 32px",
        borderBottom: `1px solid ${t.border1}`, background: t.card1,
      }}>
        <TabBtn active={aba === "visao"} onClick={() => trocarAba("visao")} t={t}>
          Visão Geral
        </TabBtn>
        <TabBtn active={aba === "tarefas"} onClick={() => trocarAba("tarefas")} t={t}>
          Tarefas
        </TabBtn>
        <TabBtn active={aba === "detalhes"} onClick={() => trocarAba("detalhes")} t={t}>
          Itens & Cronograma
        </TabBtn>
        <TabBtn active={aba === "mapa"} onClick={() => trocarAba("mapa")} t={t}>
          Projetos
        </TabBtn>
        <TabBtn active={aba === "fiscal"} onClick={() => trocarAba("fiscal")} t={t}>
          Fiscal
        </TabBtn>
        <TabBtn active={aba === "instalador"} onClick={() => trocarAba("instalador")} t={t}>
          Instalador
        </TabBtn>
        <TabBtn active={aba === "custos"} onClick={() => trocarAba("custos")} t={t}>
          Custos
        </TabBtn>
        <TabBtn active={aba === "relacionamento"} onClick={() => trocarAba("relacionamento")} t={t}>
          Relacionamento
        </TabBtn>
        <TabBtn active={aba === "documentos"} onClick={() => trocarAba("documentos")} t={t}>
          Documentos
        </TabBtn>
      </div>

      {/* CONTEÚDO CONDICIONAL — Visão Geral / Mapa / Laudos / Detalhes */}
      {aba === "visao" ? (
        <VisaoGeralTab
          projeto={projeto}
          t={t}
          onReload={loadAll}
          onAbrirDocumentos={() => trocarAba("documentos")}
        />
      ) : aba === "tarefas" ? (
        <TarefasTab
          projetoId={projeto.id}
          projetoNome={projeto.cliente}
          cardId={projeto.card_id ?? null}
          t={t}
        />
      ) : aba === "mapa" ? (
        <ProjetosTab
          projetoId={projeto.id}
          simulacaoId={projeto.simulacao_id ?? null}
          cardId={projeto.card_id ?? null}
          t={t}
        />
      ) : aba === "fiscal" ? (
        <FiscalTab
          projetoId={projeto.id}
          cardId={projeto.card_id ?? null}
          etapa={etapas.find(e => e.numero === 3)}
          onPatch={(patch) => patchEtapa(3, patch)}
          subInicial={fiscalSubInicial}
          t={t}
        />
      ) : aba === "instalador" ? (
        <InstaladorTab projetoId={projeto.id} t={t} />
      ) : aba === "custos" ? (
        <CustosObraTab projetoId={projeto.id} t={t} />
      ) : aba === "relacionamento" ? (
        <RelacionamentoTab projetoId={projeto.id} projeto={projeto} t={t} />
      ) : aba === "documentos" ? (
        <DocumentosTab projetoId={projeto.id} projeto={projeto} onReload={loadAll} t={t} />
      ) : (
      <>
      {/* STEPPER 9 etapas — oculto a pedido (Will 02/07). Lógica e dados
          continuam intactos: gestao.projeto_etapas segue sendo populada pela RPC
          e o backend expõe /api/projetos/:id + /api/projetos/:id/etapas.
          Pra reativar, descomente o bloco abaixo.

      <div style={{ padding: "16px 32px", borderBottom: `1px solid ${t.border1}`, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 6, minWidth: "max-content" }}>
          {etapas.map((e) => {
            const active = etapaSelecionada === e.numero;
            const cor = statusColor[e.status] || t.textSecondary;
            const catCor = stageCategoryColor[e.categoria] || t.accent;
            return (
              <button
                key={e.numero}
                onClick={() => setEtapaSelecionada(active ? null : e.numero)}
                style={{
                  padding: "10px 14px", background: active ? t.card2 : t.card1,
                  border: `1px solid ${active ? t.border2 : t.border1}`,
                  borderTop: `2px solid ${catCor}`,
                  color: t.textPrimary, cursor: "pointer",
                  textAlign: "left", minWidth: 168, position: "relative",
                }}
              >
                <div style={{ fontSize: 8, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase" }}>
                  {e.numero.toString().padStart(2, "0")} · {e.categoria}
                </div>
                <div style={{ fontFamily: fonts.cinzel, fontSize: 11, marginTop: 4, letterSpacing: "0.08em" }}>
                  {e.titulo}
                </div>
                <div style={{ fontSize: 8, letterSpacing: "0.18em", color: cor, marginTop: 4, textTransform: "uppercase" }}>
                  ● {e.status.replace("_", " ")}
                </div>
              </button>
            );
          })}
        </div>
        {etapaSelecionada && (
          <EtapaDetail
            e={etapas.find(x => x.numero === etapaSelecionada)!}
            onPatch={(patch) => patchEtapa(etapaSelecionada, patch)}
          />
        )}
      </div>
      */}

      {/* CONTEÚDO: acompanhamento de obra item-centric (fusão) + timeline lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", height: "100%", overflow: "hidden" }}>
        <ObraCronogramaTab projetoId={projeto.id} projeto={projeto} t={t} />

        <aside style={{
          overflow: "auto", padding: "16px 20px",
          background: t.card1, borderLeft: `1px solid ${t.border1}`,
        }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.20em", color: t.textPrimary, marginBottom: 12 }}>
            TIMELINE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {eventos.length === 0 && (
              <div style={{ color: t.textTertiary, fontSize: 10 }}>sem eventos ainda</div>
            )}
            {eventos.map((ev) => (
              <div key={ev.id} style={{
                padding: "8px 10px", background: t.card2, border: `1px solid ${t.border1}`,
              }}>
                <div style={{ fontSize: 8, letterSpacing: "0.16em", color: t.accent, textTransform: "uppercase" }}>
                  {new Date(ev.created_at).toLocaleString("pt-BR")} · {ev.tipo}
                </div>
                <div style={{ fontSize: 11, color: t.textPrimary, marginTop: 4 }}>{ev.titulo}</div>
                {ev.descricao && (
                  <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 3 }}>{ev.descricao}</div>
                )}
                {ev.autor_email && (
                  <div style={{ fontSize: 8, color: t.textTertiary, letterSpacing: "0.10em", marginTop: 4 }}>
                    {ev.autor_email}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
      </>
      )}
    </div>
  );
}

function EtapaDetail({ e, onPatch }: { e: Etapa; onPatch: (patch: any) => Promise<void> | void }) {

  const t = useTokens();
  const [status, setStatus] = useState(e.status);
  const [obs, setObs] = useState(e.observacoes || "");
  const [resp, setResp] = useState(e.responsavel || "");
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState<"" | "salvando" | "salvo" | "erro">("");
  const inFlight = useRef(false);

  // Reset ao trocar de etapa (ou após loadAll do pai) — descarta dirty pra evitar re-save.
  useEffect(() => {
    setStatus(e.status); setObs(e.observacoes || ""); setResp(e.responsavel || "");
    setDirty(false);
  }, [e]);

  // Auto-save debounced 800ms: dispara ao editar qualquer campo.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaveMsg("salvando");
      try {
        await onPatch({ status, responsavel: resp, observacoes: obs });
        setDirty(false);
        setSaveMsg("salvo");
        setTimeout(() => setSaveMsg(""), 1800);
      } catch {
        setSaveMsg("erro");
      } finally {
        inFlight.current = false;
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty, status, resp, obs]);

  return (
    <div style={{ marginTop: 12, padding: 14, background: t.card2, border: `1px solid ${t.border1}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <label style={miniLabel(t)}>STATUS</label>
          <select value={status}
            onChange={(ev) => { setStatus(ev.target.value); setDirty(true); }}
            style={inputStyle(t)}>
            {STATUS_ETAPA.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={miniLabel(t)}>RESPONSÁVEL</label>
          <input value={resp}
            onChange={(ev) => { setResp(ev.target.value); setDirty(true); }}
            placeholder="email/nome" style={inputStyle(t)} />
        </div>
        <div style={{ gridColumn: "span 1" }}>
          <label style={miniLabel(t)}>OBSERVAÇÕES</label>
          <input value={obs}
            onChange={(ev) => { setObs(ev.target.value); setDirty(true); }}
            placeholder="—" style={inputStyle(t)} />
        </div>
        <div style={{ alignSelf: "end", minWidth: 60, textAlign: "right" }}>
          {saveMsg && (
            <span style={{
              fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
              color: saveMsg === "erro" ? "#C7625B"
                : saveMsg === "salvo" ? "#7BA394" : t.textTertiary,
            }}>
              {saveMsg === "salvando" ? "salvando…" : saveMsg === "salvo" ? "✓ salvo" : "! erro"}
            </span>
          )}
        </div>
      </div>
      {e.descricao && (
        <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 10 }}>{e.descricao}</div>
      )}
    </div>
  );
}

const inputStyle = (t: any): React.CSSProperties => ({
  padding: "6px 8px", background: t.card2, border: `1px solid ${t.border1}`,
  color: t.textPrimary, outline: "none",
  fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.06em",
  width: "100%",
});

const miniLabel = (t: any): React.CSSProperties => ({
  fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
  color: t.textTertiary, textTransform: "uppercase",
  display: "block", marginBottom: 4,
});

/** Aba do menu (Mapa da Obra / Itens & Etapas). Padrão SO Parket:
 *  Cinzel uppercase 10px, border-bottom accent quando ativa. */
/* ── Acesso do cliente à Central (center.parket.works): link direto, sem login ── */
function CenterAcesso({ pid, t }: { pid: string; t: any }) {
  const [cred, setCred] = useState<{ url: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const abrir = async () => {
    if (cred) { setCred(null); return; }
    setCarregando(true);
    try { setCred(await api.centerLink(pid)); } catch { /* sem acesso */ }
    setCarregando(false);
  };

  const copiar = async () => {
    if (!cred) return;
    const msg = `Central do Cliente Parket\n${cred.url}`;
    try { await navigator.clipboard.writeText(msg); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch {}
  };

  const chip: React.CSSProperties = {
    fontSize: 10, letterSpacing: "0.08em", padding: "3px 8px",
    border: `1px solid ${t.border1}`, borderRadius: 3, color: t.textSecondary,
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={abrir} disabled={carregando} style={{
        background: "none", border: `1px solid ${t.border1}`, color: t.textSecondary,
        fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
        padding: "5px 10px", borderRadius: 3, cursor: "pointer",
      }}>
        {carregando ? "…" : cred ? "✕ Fechar acesso" : "Central do Cliente"}
      </button>
      {cred && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
          <a href={cred.url} target="_blank" rel="noreferrer" style={{ ...chip, color: t.accent, textDecoration: "none" }}>
            {cred.url.replace("https://", "")}
          </a>
          <button onClick={copiar} style={{
            ...chip, cursor: "pointer", background: "none", color: copiado ? t.accent : t.textSecondary,
          }}>{copiado ? "Copiado ✓" : "Copiar acesso"}</button>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children, t }: {
  active: boolean; onClick: () => void; children: any; t: any;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "12px 18px",
      background: "transparent",
      border: "none",
      borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
      color: active ? t.textPrimary : t.textSecondary,
      cursor: "pointer",
      fontFamily: fonts.cinzel,
      fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
      transition: "color 0.15s, border-color 0.15s",
    }}>
      {children}
    </button>
  );
}

/** Aba FISCAL — fusão de Laudos & Vistorias + Checklist de Obra (Will 16/07).
 *  Sub-abas espelham o grupo "documentos/2" da Central do Cliente
 *  (center.parket.works), com cada laudo correlacionado à mesma etapa
 *  que o cliente vê (LAUDO_ETAPA do center DocumentView):
 *  1vistoria/fotografico → Reconhecimento · 2vistoria/termo → Liberação
 *  acompanhamento/reparo/entrega → Acompanhamento & Entrega. */
export type FiscalSub = "checklist" | "reconhecimento" | "liberacao" | "acompanhamento";

function FiscalTab({ projetoId, cardId, etapa, onPatch, subInicial, t }: {
  projetoId: string;
  cardId: string | null;
  etapa: Etapa | undefined;
  onPatch: (patch: any) => Promise<void> | void;
  subInicial: FiscalSub;
  t: any;
}) {
  const [sub, setSub] = useState<FiscalSub>(subInicial);
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", minHeight: 0, height: "100%" }}>
      <div style={{
        display: "flex", gap: 4, padding: "0 32px", flexWrap: "wrap",
        borderBottom: `1px solid ${t.border1}`,
      }}>
        <SubTabBtn active={sub === "checklist"} onClick={() => setSub("checklist")} t={t}>
          Checklist de Início
        </SubTabBtn>
        <SubTabBtn active={sub === "reconhecimento"} onClick={() => setSub("reconhecimento")} t={t}>
          Reconhecimento da Obra
        </SubTabBtn>
        <SubTabBtn active={sub === "liberacao"} onClick={() => setSub("liberacao")} t={t}>
          Liberação de Obra
        </SubTabBtn>
        <SubTabBtn active={sub === "acompanhamento"} onClick={() => setSub("acompanhamento")} t={t}>
          Acompanhamento & Entrega
        </SubTabBtn>
      </div>
      {sub === "checklist" ? (
        <ChecklistObraTab projetoId={projetoId} etapa={etapa} onPatch={onPatch} t={t} />
      ) : sub === "reconhecimento" ? (
        <LaudosVistoriasTab projetoId={projetoId} cardId={cardId} t={t}
          tipos={["1vistoria", "fotografico"]} mostrarVistorias mostrarAvulsas />
      ) : sub === "liberacao" ? (
        <LaudosVistoriasTab projetoId={projetoId} cardId={cardId} t={t}
          tipos={["2vistoria", "termo"]} />
      ) : (
        <LaudosVistoriasTab projetoId={projetoId} cardId={cardId} t={t}
          tipos={["acompanhamento", "reparo", "entrega"]} />
      )}
    </div>
  );
}

/** Aba PROJETOS — agrupa Mapa da Obra + Anteprojeto + Projeto Executivo.
 *  Anteprojeto e Projeto Executivo usam a Central de Documentos
 *  (gestao.documentos, passos 10 e 12 do catálogo). */
function ProjetosTab({ projetoId, simulacaoId, cardId, t }: {
  projetoId: string;
  simulacaoId: string | null;
  cardId: string | null;
  t: any;
}) {
  type Sub = "mapa" | "anteprojeto" | "executivo";
  const [sub, setSub] = useState<Sub>("mapa");
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", minHeight: 0, height: "100%" }}>
      <div style={{
        display: "flex", gap: 4, padding: "0 32px",
        borderBottom: `1px solid ${t.border1}`,
      }}>
        <SubTabBtn active={sub === "mapa"} onClick={() => setSub("mapa")} t={t}>
          Mapa da Obra
        </SubTabBtn>
        <SubTabBtn active={sub === "anteprojeto"} onClick={() => setSub("anteprojeto")} t={t}>
          Anteprojeto
        </SubTabBtn>
        <SubTabBtn active={sub === "executivo"} onClick={() => setSub("executivo")} t={t}>
          Projeto Executivo
        </SubTabBtn>
      </div>
      {sub === "mapa" ? (
        <MapaDaObra simulacaoId={simulacaoId} cardId={cardId} t={t} />
      ) : sub === "anteprojeto" ? (
        <AnteprojetoSub projetoId={projetoId} t={t} />
      ) : (
        <ProjetoDocsFase projetoId={projetoId} codigo="12" titulo="Projeto Executivo" t={t} />
      )}
    </div>
  );
}

function SubTabBtn({ active, onClick, children, t }: {
  active: boolean; onClick: () => void; children: any; t: any;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "9px 14px",
      background: "transparent",
      border: "none",
      borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
      color: active ? t.textPrimary : t.textTertiary,
      cursor: "pointer",
      fontFamily: fonts.inter,
      fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase",
      transition: "color 0.15s, border-color 0.15s",
    }}>
      {children}
    </button>
  );
}

/** Sub-aba Anteprojeto: pranchas geradas no Draw (gerar / editar / publicar
 *  no Center etapa 7) + arquivos do passo 10 da Central de Documentos. */
function AnteprojetoSub({ projetoId, t }: { projetoId: string; t: any }) {
  const [pranchas, setPranchas] = useState<AnteprojetoPrancha[]>([]);
  const [cardId, setCardId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [publicando, setPublicando] = useState<string | null>(null);
  const [docsKey, setDocsKey] = useState(0);

  const load = () => {
    api.anteprojetoPranchas(projetoId)
      .then(r => { setCardId(r.card_id); setPranchas(r.items || []); })
      .catch(() => { setCardId(null); setPranchas([]); })
      .finally(() => setCarregando(false));
  };
  useEffect(() => { setCarregando(true); load(); }, [projetoId]);

  const gerar = async () => {
    setGerando(true);
    try {
      await api.anteprojetoGerar(projetoId);
      load();
    } catch (err: any) {
      alert(`Falha ao gerar anteprojeto: ${err?.message || err}`);
    } finally {
      setGerando(false);
    }
  };

  const [excluindo, setExcluindo] = useState<string | null>(null);
  const excluir = async (p: AnteprojetoPrancha) => {
    if (!confirm(`Apagar a prancha "${p.title || p.code || "prancha"}" do Draw?`)) return;
    setExcluindo(p.id);
    try {
      await api.anteprojetoExcluir(projetoId, p.id);
      setPranchas(prev => prev.filter(x => x.id !== p.id));
    } catch (err: any) {
      alert(`Falha ao apagar: ${err?.message || err}`);
    } finally {
      setExcluindo(null);
    }
  };

  const publicar = async (p: AnteprojetoPrancha) => {
    if (!confirm(`Publicar "${p.title || p.code || "prancha"}" no Center (etapa 7)?`)) return;
    setPublicando(p.id);
    try {
      await api.anteprojetoPublicar(projetoId, p.id);
      setDocsKey(k => k + 1);
    } catch (err: any) {
      alert(`Falha ao publicar: ${err?.message || err}`);
    } finally {
      setPublicando(null);
    }
  };

  const linkStyle: React.CSSProperties = {
    color: t.accent, textDecoration: "none",
    fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.08em",
  };

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", minHeight: 0, height: "100%" }}>
      <div style={{ padding: "16px 32px 12px", borderBottom: `1px solid ${t.border1}` }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 12, flexWrap: "wrap", marginBottom: pranchas.length || gerando ? 12 : 0,
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary }}>
            Pranchas geradas no Draw
            {pranchas.length > 0 ? ` · ${pranchas.length}` : ""}
          </div>
          <button
            onClick={gerar}
            disabled={gerando || !cardId}
            title={!cardId && !carregando ? "Projeto sem card vinculado (gestao.projetos.card_id)" : undefined}
            style={{
              padding: "7px 14px", background: "transparent",
              border: `1px solid ${t.border2}`, borderRadius: 6,
              color: t.textSecondary, cursor: gerando || !cardId ? "default" : "pointer",
              opacity: gerando || !cardId ? 0.6 : 1,
              fontFamily: fonts.cinzel, fontSize: 9,
              letterSpacing: "0.18em", textTransform: "uppercase",
            }}>
            {gerando ? "gerando…" : "Gerar anteprojeto"}
          </button>
        </div>
        {carregando ? (
          <div style={{ color: t.textTertiary, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.08em" }}>
            Carregando…
          </div>
        ) : !cardId ? (
          <div style={{ color: t.textTertiary, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.06em" }}>
            Projeto sem card vinculado — não é possível gerar pelo Draw.
          </div>
        ) : pranchas.length === 0 && !gerando ? (
          <div style={{ color: t.textTertiary, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.06em" }}>
            Nenhuma prancha gerada ainda. "Gerar anteprojeto" monta a prancha A1
            com a planta do Status em escala 1:50, texturas e os detalhes das Definições.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {gerando && (
              <div style={{
                display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                padding: "8px 12px", background: t.card1, borderRadius: 6,
                opacity: 0.45, border: `1px dashed ${t.border2}`,
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontFamily: fonts.inter, fontSize: 11, color: t.textPrimary, letterSpacing: "0.04em" }}>
                    PG 01 · PLANTA GERAL
                  </div>
                  <div style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, marginTop: 2 }}>
                    Gerando prancha no Draw… isso pode levar alguns segundos.
                  </div>
                </div>
              </div>
            )}
            {pranchas.map(p => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                padding: "8px 12px", background: t.card1, borderRadius: 6,
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontFamily: fonts.inter, fontSize: 11, color: t.textPrimary, letterSpacing: "0.04em" }}>
                    {p.code || "ANTEPROJETO"} · {p.title || "sem título"}
                    {p.revision_num ? ` · REV ${p.revision_num}` : ""}
                  </div>
                  <div style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, marginTop: 2 }}>
                    {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <a href={p.pdf_url} target="_blank" rel="noreferrer" style={linkStyle}>PDF</a>
                <a href={p.editor_url} target="_blank" rel="noreferrer" style={linkStyle}>Editor</a>
                <button
                  onClick={() => publicar(p)}
                  disabled={publicando === p.id}
                  style={{
                    padding: "5px 12px", background: "transparent",
                    border: `1px solid ${t.accent}`, borderRadius: 6,
                    color: t.accent, cursor: publicando === p.id ? "default" : "pointer",
                    opacity: publicando === p.id ? 0.6 : 1,
                    fontFamily: fonts.cinzel, fontSize: 8.5,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                  }}>
                  {publicando === p.id ? "publicando…" : "Publicar no Center"}
                </button>
                <button
                  onClick={() => excluir(p)}
                  disabled={excluindo === p.id}
                  title="Apagar prancha no Draw"
                  style={{
                    padding: "5px 12px", background: "transparent",
                    border: `1px solid ${t.border2}`, borderRadius: 6,
                    color: t.textTertiary, cursor: excluindo === p.id ? "default" : "pointer",
                    opacity: excluindo === p.id ? 0.6 : 1,
                    fontFamily: fonts.cinzel, fontSize: 8.5,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                  }}>
                  {excluindo === p.id ? "apagando…" : "Apagar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <ProjetoDocsFase key={docsKey} projetoId={projetoId} codigo="10" titulo="Anteprojeto" t={t} />
    </div>
  );
}

/** Arquivos de um passo da Central de Documentos (Anteprojeto / Projeto
 *  Executivo) com upload + preview inline de imagens e PDFs. */
function ProjetoDocsFase({ projetoId, codigo, titulo, t }: {
  projetoId: string; codigo: string; titulo: string; t: any;
}) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    api.documentos(projetoId)
      .then(all => setDocs(all.filter(d => d.codigo === codigo)))
      .catch(() => setDocs([]))
      .finally(() => setCarregando(false));
  };
  useEffect(() => { setCarregando(true); load(); }, [projetoId, codigo]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviando(true);
    try {
      await api.documentoUpload(projetoId, file, codigo, undefined,
        localStorage.getItem("gestao_user_email"));
      load();
    } catch (err: any) {
      alert(`Falha no upload: ${err?.message || err}`);
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (d: Documento) => {
    if (!confirm(`Remover "${d.nome_arquivo || d.titulo}"?`)) return;
    try {
      await api.documentoDelete(d.id);
      load();
    } catch (err: any) {
      alert(`Falha ao remover: ${err?.message || err}`);
    }
  };

  const isImg = (d: Documento) =>
    (d.content_type || "").startsWith("image/") ||
    /\.(jpe?g|png|webp|gif)$/i.test(d.nome_arquivo || "");
  const isPdf = (d: Documento) =>
    d.content_type === "application/pdf" || /\.pdf$/i.test(d.nome_arquivo || "");

  return (
    <div style={{ padding: "16px 32px 40px", overflowY: "auto", minHeight: 0, height: "100%", boxSizing: "border-box" }}>
      <input ref={fileRef} type="file" style={{ display: "none" }} onChange={onFile} />

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 12, flexWrap: "wrap", marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary }}>
          {titulo} · passo {codigo} da Central de Documentos
          {docs.length > 0 ? ` · ${docs.length} arquivo${docs.length === 1 ? "" : "s"}` : ""}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={enviando}
          style={{
            padding: "7px 14px", background: "transparent",
            border: `1px solid ${t.border2}`, borderRadius: 6,
            color: t.textSecondary, cursor: "pointer",
            fontFamily: fonts.cinzel, fontSize: 9,
            letterSpacing: "0.18em", textTransform: "uppercase",
          }}>
          {enviando ? "enviando…" : "+ Anexar arquivo"}
        </button>
      </div>

      {carregando ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.08em" }}>
          Carregando…
        </div>
      ) : docs.length === 0 ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", padding: 40, textAlign: "center",
          background: t.card1, color: t.textSecondary,
          fontFamily: fonts.inter, lineHeight: 1.6,
        }}>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em",
            textTransform: "uppercase", color: t.textPrimary, marginBottom: 12,
          }}>
            Nenhum arquivo de {titulo}
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.04em", color: t.textSecondary, maxWidth: 460 }}>
            Anexe aqui os arquivos de {titulo.toLowerCase()} (PDF, imagens, DWG).
            Eles também aparecem na aba Documentos, no passo {codigo} da Central.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {docs.map((d) => (
            <div key={d.id}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 10, padding: "6px 10px",
                background: t.card2, border: `1px solid ${t.border1}`,
              }}>
                <a href={d.arquivo_url || "#"} target="_blank" rel="noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 8, minWidth: 0,
                    color: t.textPrimary, textDecoration: "none", fontSize: 11,
                  }}>
                  <span style={{
                    fontSize: 8, letterSpacing: "0.1em", padding: "2px 5px",
                    border: `1px solid ${t.border2}`, color: t.textTertiary, flexShrink: 0,
                  }}>
                    {extIcon(d.nome_arquivo)}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.nome_arquivo || d.titulo}
                  </span>
                  <span style={{ fontSize: 9, color: t.textTertiary, flexShrink: 0 }}>
                    {fmtBytes(d.tamanho_bytes)}
                  </span>
                </a>
                <button onClick={() => remover(d)} title="remover"
                  style={{
                    background: "transparent", border: "none", color: t.textTertiary,
                    cursor: "pointer", fontSize: 12, flexShrink: 0,
                  }}>
                  ×
                </button>
              </div>
              {d.arquivo_url && isImg(d) && (
                <a href={d.arquivo_url} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
                  <img src={d.arquivo_url} alt={d.nome_arquivo || d.titulo} loading="lazy"
                       style={{
                         width: "100%", display: "block", marginTop: 6,
                         border: `1px solid ${t.border1}`, borderRadius: 8,
                         background: "#FFFFFF",
                       }} />
                </a>
              )}
              {isPdf(d) && (d.meta?.paginas?.length > 0 ? (
                <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                  {d.meta.paginas.map((p: { n: number; url: string }) => (
                    <a key={p.n} href={p.url} target="_blank" rel="noreferrer" title={`Página ${p.n} — abrir em tamanho real`}>
                      <img src={p.url} alt={`${d.nome_arquivo || d.titulo} — página ${p.n}`} loading="lazy"
                           style={{
                             width: "100%", display: "block",
                             border: `1px solid ${t.border1}`, borderRadius: 8,
                             background: "#FFFFFF",
                           }} />
                    </a>
                  ))}
                </div>
              ) : d.arquivo_url ? (
                <iframe src={d.arquivo_url} title={d.nome_arquivo || d.titulo}
                        style={{
                          width: "100%", height: "72vh", display: "block", marginTop: 6,
                          border: `1px solid ${t.border1}`, borderRadius: 8,
                          background: "#FFFFFF",
                        }} />
              ) : null)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mapeamento publicado pelo Status — mesma apresentação do center:
 *  páginas-imagem do quadro (kanban_cards.details.mapa_status.print) + PDF.
 *  O editor do Status NÃO abre aqui; edição continua sendo no Space. */
function MapaDaObra({ cardId, t }: {
  simulacaoId: string | null;
  cardId: string | null;
  t: any;
}) {
  const [mapa, setMapa] = useState<MapaPrint | null>(null);
  const [mapaPdf, setMapaPdf] = useState<{url: string; name?: string; uploaded_at?: string} | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ok = true;
    setCarregando(true);
    setMapa(null);
    setMapaPdf(null);
    if (!cardId) { setCarregando(false); return; }
    api.mapaPrint(cardId)
      .then((r: any) => {
        if (!ok) return;
        setMapa(r.print && r.print.paginas?.length ? r.print : null);
        setMapaPdf(r.pdf && r.pdf.url ? r.pdf : null);
      })
      .catch(() => { if (ok) { setMapa(null); setMapaPdf(null); } })
      .finally(() => { if (ok) setCarregando(false); });
    return () => { ok = false; };
  }, [cardId]);

  const fmtData = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
  };

  if (carregando) {
    return (
      <div style={{
        padding: 40, textAlign: "center", color: t.textTertiary,
        fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.08em",
      }}>
        Carregando mapeamento…
      </div>
    );
  }

  // Fallback PDF (mapa_pdf da Valoria) — quando não tem Status/Draw print
  if (!mapa && mapaPdf) {
    return (
      <div style={{ padding: "12px 32px 24px", overflowY: "auto", minHeight: 0, height: "100%", boxSizing: "border-box" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap", marginBottom: 14,
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary }}>
            Mapeamento da obra (PDF)
            {mapaPdf.uploaded_at ? ` · ${fmtData(mapaPdf.uploaded_at)}` : ""}
          </div>
          <button
            onClick={() => window.open(mapaPdf.url, "_blank")}
            style={{
              padding: "7px 14px", background: "transparent",
              border: `1px solid ${t.border2}`, borderRadius: 6,
              color: t.textSecondary, cursor: "pointer",
              fontFamily: fonts.cinzel, fontSize: 9,
              letterSpacing: "0.18em", textTransform: "uppercase",
            }}>
            Abrir em nova aba
          </button>
        </div>
        <iframe
          src={mapaPdf.url}
          title={mapaPdf.name || "Mapeamento da Obra"}
          style={{
            width: "100%", height: "calc(100vh - 200px)",
            border: `1px solid ${t.border1}`, borderRadius: 8, background: "#FFFFFF",
          }} />
      </div>
    );
  }

  if (!mapa) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", padding: 40, textAlign: "center",
        background: t.card1, color: t.textSecondary,
        fontFamily: fonts.inter, lineHeight: 1.6,
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em",
          textTransform: "uppercase", color: t.textPrimary, marginBottom: 12,
        }}>
          Mapeamento ainda não publicado
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.04em", color: t.textSecondary, maxWidth: 460 }}>
          {cardId
            ? "O mapa desta obra ainda não foi publicado pelo módulo Status (botão Imprimir no card do Space) e não há PDF de mapeamento no card do Valoria. Assim que for publicado, as páginas aparecem aqui."
            : "Este projeto não tem card_id vinculado ao Space, então não há mapeamento para exibir."}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 32px 24px", overflowY: "auto", minHeight: 0, height: "100%", boxSizing: "border-box" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary }}>
          Mapeamento da obra{mapa.revisao ? ` · Revisão ${mapa.revisao}` : ""}
          {mapa.gerado_em ? ` · ${fmtData(mapa.gerado_em)}` : ""}
        </div>
        <button
          onClick={() => window.open(mapa.pdf_url, "_blank")}
          style={{
            padding: "7px 14px", background: "transparent",
            border: `1px solid ${t.border2}`, borderRadius: 6,
            color: t.textSecondary, cursor: "pointer",
            fontFamily: fonts.cinzel, fontSize: 9,
            letterSpacing: "0.18em", textTransform: "uppercase",
          }}>
          Arquivo PDF
        </button>
      </div>
      <div style={{ display: "grid", gap: 20 }}>
        {mapa.paginas.map(p => (
          <figure key={p.n} style={{ margin: 0 }}>
            <a href={p.url} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
              <img src={p.url} alt={p.label || `Página ${p.n} do mapeamento`}
                   loading="lazy"
                   style={{
                     width: "100%", display: "block",
                     border: `1px solid ${t.border1}`, borderRadius: 8,
                     background: "#FFFFFF",
                   }} />
            </a>
            <figcaption style={{
              fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
              color: t.textTertiary, marginTop: 6,
            }}>
              {p.label ? `${p.label} · ` : ""}Página {String(p.n).padStart(2, "0")} de {String(mapa.paginas.length).padStart(2, "0")}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LAUDOS & VISTORIAS — vinculados ao card_id do projeto
// Fonte: public.fiscal_agenda / fiscal_laudos / fiscal_fotos no Cloud
// (mesma origem que verifica.parket.works alimenta em campo)
// ═══════════════════════════════════════════════════════════════════

const TIPO_LAUDO_LBL: Record<string, string> = {
  "1vistoria":      "1ª Vistoria",
  "2vistoria":      "2ª Vistoria",
  "acompanhamento": "Acompanhamento",
  "entrega":        "Entrega",
  "reparo":         "Reparo",
  "termo":          "Termo de Responsabilidade",
  "fotografico":    "Relatório Fotográfico",
};

/** Modelos da pasta Fase 4_ Fiscal e Contratual — criáveis direto do card. */
const MODELOS_FASE4: [string, string][] = [
  ["1vistoria",      "9.1 · 1ª Vistoria do Fiscal"],
  ["2vistoria",      "9.1 · 2ª Vistoria do Fiscal"],
  ["termo",          "9.2 · Termo de Responsabilidade de Obra"],
  ["fotografico",    "9.3 · Relatório Fotográfico"],
  ["acompanhamento", "9.4 · Relatório de Acompanhamento"],
  ["entrega",        "Laudo de Entrega"],
  ["reparo",         "Laudo de Reparo"],
];

// chaves = CK do app Verifica (bancos só existe na 2ª vistoria)
const SERVICOS_VISTORIA: [string, string][] = [
  ["piso", "Piso"], ["deck", "Deck"], ["forro", "Forro"],
  ["painel", "Painel"], ["porta", "Porta"], ["marcenaria", "Marcenaria"],
  ["escada", "Escada"], ["bancos", "Bancos"],
];

function servicosDosItens(itens: { categoria: string; meta?: any }[]): Set<string> {
  const s = new Set<string>();
  for (const it of itens) {
    const c = `${it.categoria || ""} ${it.meta?.categoria_raiz || ""}`.toUpperCase();
    if (/PISO|ASSOALHO|VIN[IÍ]LICO|LAMINADO/.test(c)) s.add("piso");
    if (c.includes("DECK"))   s.add("deck");
    if (c.includes("FORRO"))  s.add("forro");
    if (/PAINEL|REVESTIMENTO|BRISE|RIPADO/.test(c)) s.add("painel");
    if (c.includes("PORTA"))  s.add("porta");
    if (/MARCENARIA|M[OÓ]VE/.test(c)) s.add("marcenaria");
    if (c.includes("ESCADA")) s.add("escada");
    if (c.includes("BANCO"))  s.add("bancos");
  }
  return s;
}

function fmtDT(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtD(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function corStatusLaudo(status: string, t: any): string {
  switch ((status || "").toLowerCase()) {
    case "concluido": return t.accent;
    case "em_andamento": return "#C7A45B";
    case "agendado": return "#8CA9B8";
    case "cancelado": return "#5F5D58";
    default: return "#B85B4C";
  }
}

function LaudosVistoriasTab({ projetoId, cardId, t, tipos, mostrarVistorias, mostrarAvulsas }: {
  projetoId: string; cardId: string | null; t: any;
  /** filtra laudos (e modelos de criação) pelos tipos da sub-aba; sem filtro = todos */
  tipos?: string[];
  mostrarVistorias?: boolean;
  mostrarAvulsas?: boolean;
}) {
  const [vistorias, setVistorias] = useState<Agenda[]>([]);
  const [laudos, setLaudos]       = useState<Laudo[]>([]);
  const [fotos, setFotos]         = useState<Foto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [laudoAberto, setLaudoAberto] = useState<string | null>(null);
  const [fiscais, setFiscais] = useState<Fiscal[]>([]);
  const [modalNova, setModalNova] = useState<boolean>(false);
  const [menuNovoLaudo, setMenuNovoLaudo] = useState(false);
  const [criandoLaudo, setCriandoLaudo] = useState(false);
  const [fiscalNovoLaudo, setFiscalNovoLaudo] = useState<string>("");
  const [marcandoServ, setMarcandoServ] = useState<{ tipo: string; lbl: string } | null>(null);
  const [servMarcados, setServMarcados] = useState<Record<string, boolean>>({});

  const criarLaudo = async (tipo: string, servicos?: string[]) => {
    setMenuNovoLaudo(false);
    setMarcandoServ(null);
    setCriandoLaudo(true);
    try {
      const novo = await api.laudoCriar({
        projeto_id: projetoId, tipo,
        fiscal_id: fiscalNovoLaudo || undefined,
        servicos_inclusos: servicos && servicos.length ? servicos : undefined,
      });
      load();
      setLaudoAberto(novo.id);
    } catch (e: any) {
      alert(`Erro ao criar: ${e?.message || e}`);
    } finally {
      setCriandoLaudo(false);
    }
  };

  const abrirModelo = async (tipo: string, lbl: string) => {
    if (tipo !== "1vistoria" && tipo !== "2vistoria") { criarLaudo(tipo); return; }
    // pré-sugere serviços a partir do vendido (itens do projeto)
    let sug = new Set<string>();
    try { sug = servicosDosItens(await api.itens(projetoId)); } catch { /* sem itens = nada pré-marcado */ }
    const init: Record<string, boolean> = {};
    for (const [k] of SERVICOS_VISTORIA) init[k] = sug.has(k);
    setServMarcados(init);
    setMarcandoServ({ tipo, lbl });
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      api.projetoVistorias(projetoId),
      api.projetoLaudos(projetoId),
      api.projetoFotos(projetoId),
    ]).then(([v, l, f]) => { setVistorias(v); setLaudos(l); setFotos(f); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [projetoId]);
  useEffect(() => {
    api.fiscalList({ ativo: true }).then(setFiscais).catch(() => setFiscais([]));
  }, []);

  const laudosVisiveis = useMemo(
    () => (tipos ? laudos.filter(l => tipos.includes(l.tipo)) : laudos),
    [laudos, tipos]);
  const modelosVisiveis = useMemo(
    () => (tipos ? MODELOS_FASE4.filter(([tp]) => tipos.includes(tp)) : MODELOS_FASE4),
    [tipos]);
  const fotosVisiveis = useMemo(() => {
    if (!tipos) return fotos;
    const ids = new Set(laudosVisiveis.map(l => l.id));
    return fotos.filter(f => (f.laudo_id ? ids.has(f.laudo_id) : !!mostrarAvulsas));
  }, [fotos, tipos, laudosVisiveis, mostrarAvulsas]);

  const stats = useMemo(() => ({
    vistorias:  vistorias.length,
    agendadas:  vistorias.filter(v => v.status === "agendado").length,
    realizadas: vistorias.filter(v => v.status === "realizado").length,
    laudos:     laudosVisiveis.length,
    fotos:      fotosVisiveis.length,
  }), [vistorias, laudosVisiveis, fotosVisiveis]);

  if (!cardId) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
        padding: 40, textAlign: "center", background: t.card1, color: t.textSecondary,
        fontFamily: fonts.inter, lineHeight: 1.6,
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em",
          textTransform: "uppercase", color: t.textPrimary, marginBottom: 12,
        }}>
          Projeto sem card vinculado
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary, maxWidth: 420, letterSpacing: "0.04em" }}>
          Laudos e vistorias são indexadas pelo card_id do Space. Este projeto foi importado
          sem esse vínculo, então não há como filtrar.
        </div>
      </div>
    );
  }

  return (
    <section style={{ overflow: "auto", padding: "18px 32px 32px" }}>
      {/* Barra de controle — 2 linhas estruturadas (mesmo padrão do Kanban Semanal/Gestão de Laudos):
          Linha 1: métricas em card 5×1
          Linha 2: ações (nova vistoria + ver na Gestão de Laudos) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${mostrarVistorias || !tipos ? 5 : 2}, 1fr)`,
          gap: 8, padding: "12px 16px",
          background: t.card1, border: `1px solid ${t.border1}`,
        }}>
          {(mostrarVistorias || !tipos) && (
            <>
              <MiniStat label="Vistorias"  v={stats.vistorias}  t={t} />
              <MiniStat label="Agendadas"  v={stats.agendadas}  t={t} corValor="#C7A45B" />
              <MiniStat label="Realizadas" v={stats.realizadas} t={t} corValor={t.accent} />
            </>
          )}
          <MiniStat label="Laudos"     v={stats.laudos}     t={t} />
          <MiniStat label="Fotos"      v={stats.fotos}      t={t} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary }}>
            Sincronizado com Fiscal · public.fiscal_agenda / laudos / fotos
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Link to="/fiscal" style={{
              textDecoration: "none",
              background: "transparent", color: t.textSecondary,
              border: `1px solid ${t.border1}`, padding: "8px 14px",
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", cursor: "pointer",
            }}>
              Ver na Gestão de Laudos →
            </Link>
            <div style={{ position: "relative" }}>
              <button onClick={() => { setMenuNovoLaudo(m => !m); setMarcandoServ(null); }} disabled={criandoLaudo} style={{
                background: "transparent", color: t.textPrimary,
                border: `1px solid ${t.border2 || t.border1}`, padding: "8px 14px",
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
                textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
                opacity: criandoLaudo ? 0.6 : 1,
              }}>
                {criandoLaudo ? "Criando…" : "+ Novo laudo / termo ▾"}
              </button>
              {menuNovoLaudo && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 40,
                  background: t.card1, border: `1px solid ${t.border2 || t.border1}`,
                  boxShadow: "0 8px 28px rgba(0,0,0,0.45)", minWidth: 300,
                }}>
                  <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.border1}` }}>
                    <div style={{
                      fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
                      textTransform: "uppercase", color: t.textTertiary, marginBottom: 6,
                    }}>
                      Fiscal responsável (recebe no app Verifica)
                    </div>
                    <select value={fiscalNovoLaudo} onChange={e => setFiscalNovoLaudo(e.target.value)} style={{
                      width: "100%", background: t.card2, color: t.textPrimary,
                      border: `1px solid ${t.border1}`, padding: "7px 8px", fontSize: 11,
                    }}>
                      <option value="">— sem fiscal —</option>
                      {fiscais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </div>
                  {marcandoServ ? (
                    <div style={{ padding: "10px 14px" }}>
                      <div style={{
                        fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
                        textTransform: "uppercase", color: t.textTertiary, marginBottom: 8,
                      }}>
                        Serviços da vistoria · chega marcado no app do fiscal
                      </div>
                      {SERVICOS_VISTORIA
                        .filter(([k]) => k !== "bancos" || marcandoServ.tipo === "2vistoria")
                        .map(([k, lbl]) => (
                          <label key={k} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
                            fontSize: 11, color: t.textPrimary, cursor: "pointer",
                          }}>
                            <input type="checkbox" checked={!!servMarcados[k]}
                              onChange={e => setServMarcados(m => ({ ...m, [k]: e.target.checked }))} />
                            {lbl}
                          </label>
                        ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={() => setMarcandoServ(null)} style={{
                          background: "transparent", color: t.textSecondary,
                          border: `1px solid ${t.border1}`, padding: "7px 12px",
                          fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em",
                          textTransform: "uppercase", cursor: "pointer",
                        }}>
                          ← Voltar
                        </button>
                        <button onClick={() => criarLaudo(marcandoServ.tipo,
                          SERVICOS_VISTORIA.filter(([k]) => servMarcados[k]).map(([k]) => k))} style={{
                          flex: 1, background: t.accent, color: t.bg, border: "none",
                          padding: "7px 12px", fontFamily: fonts.cinzel, fontSize: 8,
                          letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
                        }}>
                          Criar vistoria
                        </button>
                      </div>
                    </div>
                  ) : modelosVisiveis.map(([tipo, lbl]) => (
                    <div key={tipo + lbl} onClick={() => abrirModelo(tipo, lbl)} style={{
                      padding: "10px 14px", fontSize: 11, color: t.textPrimary,
                      cursor: "pointer", borderBottom: `1px solid ${t.border1}`,
                      letterSpacing: "0.04em",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.card2)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      {lbl}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {(mostrarVistorias || !tipos) && (
              <button onClick={() => setModalNova(true)} style={{
                background: t.accent, color: t.bg, border: "none",
                padding: "9px 16px", fontFamily: fonts.cinzel, fontSize: 9,
                letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer",
                whiteSpace: "nowrap",
              }}>
                + Nova vistoria
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
          carregando…
        </div>
      ) : (
        <>
          {/* Vistorias */}
          {(mostrarVistorias || !tipos) && (
            <>
              <SectionTitle t={t}>Vistorias</SectionTitle>
              {vistorias.length === 0 ? (
                <EmptyRow t={t}>Nenhuma vistoria agendada</EmptyRow>
              ) : (
                <div style={{ display: "grid", gap: 4, marginBottom: 22 }}>
                  {vistorias.map(v => <VistoriaRow key={v.id} v={v} t={t} />)}
                </div>
              )}
            </>
          )}

          {/* Laudos técnicos */}
          <SectionTitle t={t}>Laudos técnicos</SectionTitle>
          {laudosVisiveis.length === 0 ? (
            <EmptyRow t={t}>Nenhum laudo registrado</EmptyRow>
          ) : (
            <div style={{ display: "grid", gap: 4, marginBottom: 22 }}>
              {laudosVisiveis.map(l => (
                <LaudoRow key={l.id} l={l} t={t}
                  onOpen={() => setLaudoAberto(l.id)}
                  fotos={fotos.filter(f => f.laudo_id === l.id)}
                />
              ))}
            </div>
          )}

          {/* Fotos sem laudo vinculado */}
          {(mostrarAvulsas || !tipos) && (() => {
            const orfas = fotos.filter(f => !f.laudo_id);
            if (orfas.length === 0) return null;
            return (
              <>
                <SectionTitle t={t}>Fotos avulsas ({orfas.length})</SectionTitle>
                <GridFotos fotos={orfas} t={t} />
              </>
            );
          })()}
        </>
      )}

      {/* Modal Nova Vistoria — reusa o AgendaModal da Gestão Fiscal, com projeto pré-vinculado */}
      {modalNova && (
        <AgendaModal
          initial={null}
          diaSugerido={new Date()}
          fiscais={fiscais}
          projetoIdInicial={projetoId}
          cardIdInicial={cardId}
          onClose={() => setModalNova(false)}
          onSaved={() => { setModalNova(false); load(); }}
        />
      )}

      {/* Modal de detalhamento do laudo (checklists completos + PDF) */}
      {laudoAberto && (
        <LaudoDetalheModal
          laudoId={laudoAberto}
          onClose={() => setLaudoAberto(null)}
        />
      )}
    </section>
  );
}

function SectionTitle({ children, t }: { children: any; t: any }) {
  return (
    <div style={{
      fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.24em",
      textTransform: "uppercase", color: t.textSecondary, fontWeight: 500,
      margin: "16px 0 10px",
    }}>{children}</div>
  );
}

function EmptyRow({ children, t }: { children: any; t: any }) {
  return (
    <div style={{
      background: t.card1, border: `1px dashed ${t.border1}`,
      padding: "20px 16px", textAlign: "center",
      fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase",
      marginBottom: 12,
    }}>{children}</div>
  );
}

function MiniStat({ label, v, t, corValor }: { label: string; v: number; t: any; corValor?: string }) {
  return (
    <div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: t.textTertiary }}>
        {label}
      </div>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 20, color: corValor || t.textPrimary,
        marginTop: 3, fontVariantNumeric: "tabular-nums" as any, letterSpacing: "0.04em",
      }}>{v}</div>
    </div>
  );
}

function VistoriaRow({ v, t }: { v: Agenda; t: any }) {
  const cor =
    v.status === "confirmado" ? "#7BA394" :
    v.status === "realizado"  ? t.accent :
    v.status === "cancelado"  ? "#B85B4C" : "#C7A45B";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "150px 1fr 160px 130px 110px",
      gap: 12, alignItems: "center", padding: "10px 14px",
      background: t.card1, border: `1px solid ${t.border1}`, borderLeft: `3px solid ${cor}`,
    }}>
      <div>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: cor }}>
          {TIPO_LAUDO_LBL[v.tipo] || v.tipo}
        </div>
        <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 3, fontVariantNumeric: "tabular-nums" as any }}>
          {fmtDT(v.data_inicio)}
        </div>
      </div>
      <div style={{ fontSize: 12, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {v.cliente || v.obra || "—"}
      </div>
      <div style={{ fontSize: 10, color: t.textSecondary, letterSpacing: "0.04em" }}>
        {v.fiscal_nome || "— não atribuído —"}
      </div>
      <div style={{ fontSize: 10, color: t.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {v.endereco || "—"}
      </div>
      <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: cor, textAlign: "right" }}>
        {v.status}
      </div>
    </div>
  );
}

function LaudoRow({ l, t, onOpen, fotos }: {
  l: Laudo; t: any; onOpen: () => void; fotos: Foto[];
}) {
  const cor = corStatusLaudo(l.status, t);
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? t.card2 : t.card1,
        border: `1px solid ${hover ? t.border2 : t.border1}`,
        borderLeft: `3px solid ${cor}`,
        cursor: "pointer",
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      <div style={{
        display: "grid", gridTemplateColumns: "150px 1fr 130px 110px 88px 110px",
        gap: 12, alignItems: "center", padding: "10px 14px",
      }}>
        <div>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: cor }}>
            {TIPO_LAUDO_LBL[l.tipo] || l.tipo}
          </div>
          <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 3, fontVariantNumeric: "tabular-nums" as any }}>
            {fmtD(l.data_vistoria || l.data_agendamento)}
          </div>
        </div>
        <div style={{ fontSize: 12, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {l.cliente || l.obra || "—"}
        </div>
        <div style={{ fontSize: 10, color: t.textSecondary }}>{l.fiscal_nome || "—"}</div>
        <div style={{ fontSize: 10, color: t.textSecondary, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {l.setor || "—"}
        </div>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary, textAlign: "center" }}>
          {fotos.length > 0 ? `${fotos.length} fotos` : "—"}
        </div>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: cor, textAlign: "right" }}>
          {l.status} →
        </div>
      </div>
    </div>
  );
}

function GridFotos({ fotos, t }: { fotos: Foto[]; t: any }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
      {fotos.map(f => {
        const isVideo = (f.tipo || "").toLowerCase() === "video" || /\.(mp4|mov|webm)$/i.test(f.url);
        return (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
            title={f.descricao || f.ambiente || ""}
            style={{
              display: "block", position: "relative", aspectRatio: "4/3",
              background: t.card2, border: `1px solid ${t.border1}`, overflow: "hidden",
              textDecoration: "none",
            }}>
            {isVideo ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 4, background: t.card2 }}>
                <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.20em", color: t.textSecondary, textTransform: "uppercase" }}>[Vídeo]</div>
              </div>
            ) : (
              <img src={midiaThumb(f.url)} alt={f.descricao || ""} loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
            {(f.ambiente || f.descricao) && (
              <div style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                padding: "4px 6px", background: "rgba(0,0,0,0.55)",
                fontFamily: fonts.inter, fontSize: 9, color: "#F4F1EA",
                letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {f.ambiente || f.descricao}
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OBRA & CRONOGRAMA — prestadores vinculados + linhas do cronograma
// deste projeto específico (filtrado por card_id).
// Sincroniza com /obras (Gestão de Obras) e com dept-obras do Space.
// ═══════════════════════════════════════════════════════════════════

function ObraCronogramaTab({ projetoId, projeto, t }: {
  projetoId: string; projeto: P; t: any;
}) {
  const [prestadores, setPrestadores] = useState<PrestadorVinculado[]>([]);
  const [cronograma, setCronograma] = useState<CronogramaRow[]>([]);
  const [equipes, setEquipes] = useState<EquipeParket[]>([]);
  const [loading, setLoading] = useState(true);
  const [adicionar, setAdicionar] = useState<boolean>(false);
  const [busca, setBusca] = useState<string>("");
  const [escopoPrest, setEscopoPrest] = useState<PrestadorVinculado | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.projetoPrestadores(projetoId),
      api.projetoCronograma(projetoId),
    ]).then(([p, c]) => { setPrestadores(p); setCronograma(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [projetoId]);
  useEffect(() => {
    api.equipesList({ ativo: true }).then(setEquipes).catch(() => setEquipes([]));
  }, []);

  const disponíveis = useMemo(() => {
    const linked = new Set(prestadores.map(p => p.id).filter(Boolean));
    return equipes.filter(e => !linked.has(e.id) && (
      !busca || e.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (e.categoria || "").toLowerCase().includes(busca.toLowerCase())
    ));
  }, [equipes, prestadores, busca]);

  // Fallback de datas dos itens = intervalo mínimo/máximo dos cronogramas legacy do projeto
  const cronoDates = useMemo(() => {
    let inicio: string | null = null;
    let termino: string | null = null;
    for (const c of cronograma) {
      const i = toISO(c.inicio_dia);
      const f = toISO(c.termino_dia);
      if (i && (!inicio || i < inicio)) inicio = i;
      if (f && (!termino || f > termino)) termino = f;
    }
    return { inicio: inicio || "", termino: termino || "" };
  }, [cronograma]);

  const semCard = !projeto.card_id;

  const stats = {
    prestadores: prestadores.length,
    cronograma: cronograma.length,
    liberadas: cronograma.filter(c => c.categoria === "obras_liberadas").length,
    finalizadas: cronograma.filter(c => c.categoria === "finalizadas").length,
  };

  return (
    <section style={{ overflow: "auto", padding: "18px 32px 32px" }}>
      {/* Acompanhamento item-centric — cronograma = itens da proposta */}
      <ObraAcompanhamentoPanel projetoId={projetoId} projeto={projeto}
        equipes={equipes} prestadores={prestadores} t={t}
        fallbackInicio={cronoDates.inicio} fallbackTermino={cronoDates.termino} />

      {/* Prestadores + cronograma legacy (sincronizados com o Space) — colapsado */}
      <details style={{ marginTop: 28 }}>
        <summary style={{
          cursor: "pointer", fontFamily: fonts.cinzel, fontSize: 10,
          letterSpacing: "0.24em", textTransform: "uppercase", color: t.textTertiary,
          padding: "12px 0", borderTop: `1px solid ${t.border1}`,
        }}>
          Prestadores & Cronograma do Space (legacy)
        </summary>
        {semCard ? (
          <div style={{
            padding: "18px 16px", background: t.card1, border: `1px dashed ${t.border1}`,
            fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
            color: t.textTertiary, textAlign: "center",
          }}>
            Projeto sem card_id do Space — prestadores e cronograma legacy indisponíveis
          </div>
        ) : (
        <>
      {/* Métricas */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
        padding: "12px 16px", background: t.card1, border: `1px solid ${t.border1}`,
        marginBottom: 14,
      }}>
        <MiniStat label="Prestadores" v={stats.prestadores} t={t} />
        <MiniStat label="Linhas Cronograma" v={stats.cronograma} t={t} />
        <MiniStat label="Liberadas" v={stats.liberadas} t={t} corValor="#C7A45B" />
        <MiniStat label="Finalizadas" v={stats.finalizadas} t={t} corValor="#7BA394" />
      </div>

      {/* Link pra gestão central */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 18, gap: 8, flexWrap: "wrap",
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
          textTransform: "uppercase", color: t.textTertiary,
        }}>
          Sincronizado com public.equipes_parket + public.cronograma_obras
        </div>
        <Link to="/obras" style={{
          textDecoration: "none", background: "transparent", color: t.textSecondary,
          border: `1px solid ${t.border1}`, padding: "8px 14px",
          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}>
          Ver na Gestão de Obras →
        </Link>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
          carregando…
        </div>
      ) : (
        <>
          {/* Prestadores vinculados */}
          <SubTitle t={t}>Equipe vinculada</SubTitle>
          {prestadores.length === 0 ? (
            <div style={{
              background: t.card1, border: `1px dashed ${t.border1}`,
              padding: "18px 16px", textAlign: "center", marginBottom: 14,
              fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase",
            }}>
              Nenhum prestador vinculado ao projeto
            </div>
          ) : (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 8, marginBottom: 14,
            }}>
              {prestadores.map(p => (
                <PrestadorVinculadoCard
                  key={p.id || p.nome}
                  p={p} t={t}
                  onEscopo={() => setEscopoPrest(p)}
                  onDesvincular={async () => {
                    if (!p.id) return;
                    if (!confirm(`Desvincular "${p.nome}" deste projeto?`)) return;
                    await api.projetoPrestadorDel(projetoId, p.id);
                    load();
                  }}
                />
              ))}
            </div>
          )}

          {/* Vincular novo prestador */}
          {adicionar ? (
            <div style={{
              background: t.card1, border: `1px solid ${t.border2}`, padding: 14, marginBottom: 20,
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <input value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar equipe por nome ou categoria…"
                  style={{ ...inputStyleObras(t), flex: 1 }}
                  autoFocus
                />
                <button onClick={() => { setAdicionar(false); setBusca(""); }} style={btnGhost(t)}>Fechar</button>
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 6, maxHeight: 300, overflow: "auto",
              }}>
                {disponíveis.slice(0, 30).map(eq => (
                  <button key={eq.id}
                    onClick={async () => {
                      await api.projetoPrestadorAdd(projetoId, eq.id);
                      setBusca("");
                      load();
                    }}
                    style={{
                      textAlign: "left", padding: "8px 10px",
                      background: t.card2, color: t.textPrimary,
                      border: `1px solid ${t.border1}`, borderLeft: `3px solid ${categoriaCor(eq.categoria)}`,
                      cursor: "pointer",
                    }}>
                    <div style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: categoriaCor(eq.categoria) }}>
                      {eq.categoria}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{eq.nome}</div>
                    {eq.telefone && (
                      <div style={{ fontSize: 9, color: t.textSecondary, marginTop: 2 }}>{eq.telefone}</div>
                    )}
                  </button>
                ))}
                {disponíveis.length === 0 && (
                  <div style={{ padding: 12, color: t.textTertiary, fontSize: 10 }}>
                    {equipes.length === prestadores.length
                      ? "Todos os prestadores já estão vinculados."
                      : "Nenhuma equipe encontrada."}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 22 }}>
              <button onClick={() => setAdicionar(true)} style={btnAccent(t)}>+ Vincular prestador</button>
            </div>
          )}

          {/* Cronograma do projeto */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 8, gap: 8, flexWrap: "wrap",
          }}>
            <SubTitle t={t}>Cronograma da obra</SubTitle>
            <Link to="/obras" style={{
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", color: t.accent, textDecoration: "none",
            }}>
              + Adicionar linha em Gestão de Obras
            </Link>
          </div>
          {cronograma.length === 0 ? (
            <div style={{
              background: t.card1, border: `1px dashed ${t.border1}`,
              padding: "18px 16px", textAlign: "center",
              fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase",
            }}>
              Nenhuma linha de cronograma vinculada a este projeto
            </div>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {cronograma.map(r => (
                <CronogramaCardMini key={r.id} r={r} t={t} />
              ))}
            </div>
          )}
        </>
      )}
        </>
        )}
      </details>
      {escopoPrest && (
        <EscopoItensModal
          pid={projetoId}
          prest={escopoPrest}
          t={t}
          onClose={() => setEscopoPrest(null)}
          onSaved={load}
        />
      )}
    </section>
  );
}

function SubTitle({ children, t }: { children: any; t: any }) {
  return (
    <div style={{
      fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.24em",
      textTransform: "uppercase", color: t.textSecondary, fontWeight: 500,
      margin: "10px 0 8px",
    }}>{children}</div>
  );
}

function PrestadorVinculadoCard({ p, t, onDesvincular, onEscopo }: {
  p: PrestadorVinculado; t: any; onDesvincular: () => void; onEscopo: () => void;
}) {
  const cor = categoriaCor(p.categoria || "");
  const pct = Number((p as any).pct_ok || 0);
  const escopoN = (p.escopo_itens_ids || []).length;
  return (
    <div style={{
      background: t.card1, border: `1px solid ${t.border1}`, borderLeft: `3px solid ${cor}`,
      padding: "10px 12px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
            textTransform: "uppercase", color: cor,
          }}>{p.categoria || "categoria —"}</div>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.10em",
            color: t.textPrimary, marginTop: 3, textTransform: "uppercase",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{p.nome}</div>
          {p.telefone && (
            <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 3 }}>{p.telefone}</div>
          )}
          {(p as any).total_checks !== undefined && (
            <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 6, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {Math.round(pct)}% OK · {(p as any).total_checks} checks · {(p as any).obras_distintas || 0} obras
            </div>
          )}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onEscopo} title="Definir quais itens este prestador executa"
              style={{
                background: escopoN > 0 ? cor : "transparent",
                color: escopoN > 0 ? "#0b0b0b" : t.textSecondary,
                border: `1px solid ${escopoN > 0 ? cor : t.border1}`,
                padding: "4px 10px", fontFamily: fonts.cinzel, fontSize: 9,
                letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
              }}>
              Escopo {escopoN > 0 ? `· ${escopoN} itens` : "· obra inteira"}
            </button>
          </div>
        </div>
        <button onClick={onDesvincular} title="Desvincular"
          style={{
            background: "transparent", color: t.textTertiary,
            border: `1px solid ${t.border1}`, padding: "3px 8px",
            fontFamily: fonts.cinzel, fontSize: 10, cursor: "pointer",
          }}>×</button>
      </div>
    </div>
  );
}

// EscopoItensModal — checkboxes dos itens do cronograma com filtro por
// categoria e ambiente. Escopo vazio significa que o prestador vê a obra
// inteira no instala.parket.works; com escopo, o app filtra pra ele.
function EscopoItensModal({ pid, prest, onClose, onSaved, t }: {
  pid: string; prest: PrestadorVinculado;
  onClose: () => void; onSaved: () => void; t: any;
}) {
  const [itens, setItens] = useState<Item[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set(prest.escopo_itens_ids || []));
  const [cat, setCat] = useState<string>("");
  const [amb, setAmb] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.itens(pid).then(list => { setItens(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, [pid]);
  const categorias = useMemo(() => {
    const s = new Set<string>();
    itens.forEach(i => i.categoria && s.add(i.categoria));
    return Array.from(s).sort();
  }, [itens]);
  const ambientes = useMemo(() => {
    const s = new Set<string>();
    itens.forEach(i => i.ambiente && s.add(i.ambiente));
    return Array.from(s).sort();
  }, [itens]);
  const filtrados = useMemo(() => itens.filter(i =>
    (!cat || i.categoria === cat) && (!amb || i.ambiente === amb)
  ), [itens, cat, amb]);
  const toggleAll = () => {
    const next = new Set(sel);
    const allSelected = filtrados.every(i => next.has(i.id));
    filtrados.forEach(i => allSelected ? next.delete(i.id) : next.add(i.id));
    setSel(next);
  };
  async function salvar() {
    setSaving(true);
    try {
      await api.projetoPrestadorEscopo(pid, prest.id, Array.from(sel));
      onSaved();
      onClose();
    } catch (e: any) {
      alert("Erro ao salvar escopo: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: t.bg, border: `1px solid ${t.border2}`, maxWidth: 800, width: "100%",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.border1}` }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.24em",
            textTransform: "uppercase", color: t.textTertiary }}>Escopo do prestador</div>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.10em",
            textTransform: "uppercase", color: t.textPrimary, marginTop: 4 }}>{prest.nome}</div>
          <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6 }}>
            Marque só o que este prestador vai executar. Sem seleção = obra inteira.
          </div>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${t.border1}`,
          display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={cat} onChange={e => setCat(e.target.value)}
            style={{ background: t.card1, color: t.textPrimary,
              border: `1px solid ${t.border1}`, padding: "6px 10px", fontSize: 11 }}>
            <option value="">Todas categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={amb} onChange={e => setAmb(e.target.value)}
            style={{ background: t.card1, color: t.textPrimary,
              border: `1px solid ${t.border1}`, padding: "6px 10px", fontSize: 11 }}>
            <option value="">Todos ambientes</option>
            {ambientes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={toggleAll}
            style={{ background: "transparent", color: t.textSecondary,
              border: `1px solid ${t.border1}`, padding: "6px 12px",
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.16em",
              textTransform: "uppercase", cursor: "pointer" }}>
            Alternar visíveis
          </button>
          <div style={{ marginLeft: "auto", fontSize: 10, color: t.textTertiary,
            letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {sel.size} de {itens.length} · mostrando {filtrados.length}
          </div>
        </div>
        <div style={{ overflow: "auto", flex: 1, padding: "10px 18px" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: t.textTertiary }}>carregando…</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: t.textTertiary }}>Nenhum item.</div>
          ) : filtrados.map(i => {
            const check = sel.has(i.id);
            const cor = categoriaCor(i.categoria || "");
            const codigo = (i.meta && i.meta.codigo) || "";
            return (
              <label key={i.id} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "8px 10px", cursor: "pointer",
                background: check ? t.card1 : "transparent",
                borderLeft: `3px solid ${check ? cor : "transparent"}`,
              }} onClick={e => {
                e.preventDefault();
                const next = new Set(sel);
                check ? next.delete(i.id) : next.add(i.id);
                setSel(next);
              }}>
                <input type="checkbox" checked={check} readOnly
                  style={{ marginTop: 3, accentColor: cor }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
                    textTransform: "uppercase", color: cor }}>
                    {codigo ? `${codigo} · ` : ""}{i.categoria}
                  </div>
                  <div style={{ fontSize: 11, color: t.textPrimary, marginTop: 2 }}>
                    {i.descritivo}
                  </div>
                  {i.ambiente && (
                    <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 2 }}>
                      {i.ambiente}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
        <div style={{ padding: "12px 18px", borderTop: `1px solid ${t.border1}`,
          display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhost(t)} disabled={saving}>Cancelar</button>
          <button onClick={salvar} style={btnAccent(t)} disabled={saving}>
            {saving ? "Salvando…" : "Salvar escopo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CronogramaCardMini({ r, t }: { r: CronogramaRow; t: any }) {
  const map: Record<string, string> = {
    "acompanhamento":   "#8CA9B8",
    "obras_liberadas":  "#C7A45B",
    "cronograma_final": "#7BA394",
    "travado":          "#B85B4C",
    "finalizadas":      "#5F5D58",
  };
  const cor = map[r.categoria] || "#8CA9B8";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "180px 1fr 130px 120px 100px 100px",
      gap: 10, alignItems: "center", padding: "10px 14px",
      background: t.card1, border: `1px solid ${t.border1}`, borderLeft: `3px solid ${cor}`,
    }}>
      <div>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
          textTransform: "uppercase", color: cor,
        }}>
          {labelCat(r.categoria)}
        </div>
        <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 3, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {r.tipo}
        </div>
      </div>
      <div style={{ fontSize: 12, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {r.nome_obra}
        {r.servico && <span style={{ color: t.textTertiary, marginLeft: 8, fontSize: 10 }}>· {r.servico}</span>}
      </div>
      <div style={{ fontSize: 10, color: t.textSecondary }}>{r.equipe || "— equipe —"}</div>
      <div style={{ fontSize: 10, color: t.textSecondary }}>{r.fiscal || "— fiscal —"}</div>
      <div style={{ fontSize: 10, color: t.textSecondary, fontVariantNumeric: "tabular-nums" as any, letterSpacing: "0.04em" }}>
        {r.inicio_dia || "—"}
      </div>
      <div style={{ fontSize: 10, color: t.textSecondary, fontVariantNumeric: "tabular-nums" as any, letterSpacing: "0.04em" }}>
        {r.termino_dia || "—"}
      </div>
    </div>
  );
}

function labelCat(cat: string): string {
  const map: Record<string, string> = {
    "acompanhamento":   "Acompanhamento",
    "obras_liberadas":  "Obras liberadas",
    "cronograma_final": "Cronograma final",
    "travado":          "Travado",
    "finalizadas":      "Finalizadas",
  };
  return map[cat] || cat;
}

// ═══════════════════════════════════════════════════════════════════
// RELACIONAMENTO (Painel CS) — chat WhatsApp do projeto.
// Fonte: public.whatsapp_messages (autolinked via trigger em phone).
// Grupo do cliente + instância vêm de public.atendimento_conversas.card_id.
// Envio via Evolution (backend proxy /api/projetos/:id/relacionamento/send).
// ═══════════════════════════════════════════════════════════════════

const RELACIONAMENTO_POLL_MS = 15_000;

export function RelacionamentoTab({ projetoId, projeto, t }: {
  projetoId: string; projeto: P; t: any;
}) {
  const [conversa, setConversa] = useState<RelacionamentoConversa | null>(null);
  const [grupoJid, setGrupoJid] = useState<string | null>(null);
  const [instance, setInstance] = useState<string>("");
  const [mensagens, setMensagens] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setErro(null);
    api.relacionamento(projetoId)
      .then(r => {
        setConversa(r.conversa);
        setGrupoJid(r.grupo_jid);
        setInstance(r.instance);
        setMensagens(r.mensagens || []);
      })
      .catch(e => setErro(String(e.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, RELACIONAMENTO_POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [projetoId]);

  // Scroll pra última mensagem quando a lista atualiza
  useEffect(() => {
    if (!listaRef.current) return;
    listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensagens.length]);

  const enviar = async () => {
    const t2 = texto.trim();
    if (!t2 || enviando) return;
    setEnviando(true);
    try {
      // Optimistic: adiciona bolha "enviando" localmente
      const optimistic: WhatsappMessage = {
        id: `tmp-${Date.now()}`, phone: grupoJid || "",
        instance, direction: "out",
        sender_name: "Você", message_text: t2, message_type: "conversation",
        media_url: null, timestamp: new Date().toISOString(),
        evolution_msg_id: null, card_id: projeto.card_id ?? null,
      };
      setMensagens(prev => [...prev, optimistic]);
      setTexto("");
      await api.relacionamentoSend(projetoId, t2);
      // Refetch em 800ms pra pegar o registro real do backend
      setTimeout(load, 800);
    } catch (e: any) {
      setErro(String(e.message || e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section style={{
      display: "grid",
      gridTemplateColumns: "1fr 360px",
      height: "100%", background: t.card1, overflow: "hidden",
    }}>
      {/* Coluna do chat (header + lista + composer) */}
      <div style={{
        display: "grid", gridTemplateRows: "auto 1fr auto",
        height: "100%", overflow: "hidden", minWidth: 0,
      }}>
      {/* Header: identificação do grupo + status */}
      <div style={{
        padding: "12px 32px", borderBottom: `1px solid ${t.border1}`,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
            textTransform: "uppercase", color: t.accent,
          }}>
            Painel CS · Relacionamento
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 3, letterSpacing: "0.04em" }}>
            {conversa ? (
              <>
                {conversa.status && <span style={{ color: statusChatCor(conversa.status), textTransform: "uppercase", letterSpacing: "0.16em", fontFamily: fonts.cinzel, fontSize: 9 }}>● {conversa.status}</span>}
                {conversa.status && grupoJid && <span>{"   ·   "}</span>}
                {grupoJid && <span>{grupoJid}</span>}
                {instance && <span style={{ color: t.textTertiary }}>{"   ·   "}{instance}</span>}
                {conversa.unread_count > 0 && (
                  <span style={{ color: "#B85B4C", marginLeft: 12 }}>{conversa.unread_count} não lidas</span>
                )}
              </>
            ) : (
              <span style={{ color: t.textTertiary, fontStyle: "italic" }}>
                {grupoJid ? `${grupoJid} · ${instance}` : "sem grupo registrado ainda"}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {loading && (
            <span style={{ fontSize: 8, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase" }}>
              atualizando…
            </span>
          )}
          <button onClick={load} disabled={loading}
            title="Recarregar" style={{
              background: "transparent", color: t.textSecondary,
              border: `1px solid ${t.border1}`, padding: "5px 10px",
              fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", cursor: loading ? "default" : "pointer",
            }}>↺</button>
        </div>
      </div>

      {/* Lista de mensagens (ou painel de vínculo manual quando sem grupo) */}
      <div ref={listaRef} style={{
        overflowY: "auto", padding: "18px 32px 12px",
        display: "flex", flexDirection: "column", gap: 8,
        background: t.bg,
      }}>
        {erro && (
          <div style={{
            padding: "10px 14px", background: "rgba(184,91,76,0.14)",
            border: "1px solid #B85B4C", color: "#B85B4C",
            fontSize: 11, letterSpacing: "0.04em",
          }}>{erro}</div>
        )}

        {!loading && !grupoJid && !erro && (
          <VincularGrupoPanel
            projetoId={projetoId}
            projetoCliente={projeto.cliente}
            projetoObraCode={projeto.obra_code || null}
            t={t}
            onVinculado={() => load()}
          />
        )}

        {!loading && grupoJid && mensagens.length === 0 && !erro && (
          <div style={{
            padding: 40, textAlign: "center", color: t.textTertiary,
            fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
            fontFamily: fonts.cinzel,
          }}>
            Grupo vinculado · sem mensagens ainda
          </div>
        )}
        {mensagens.map((m, i) => {
          const anterior = i > 0 ? mensagens[i - 1] : null;
          const showDia = !anterior || dataMsg(anterior.timestamp) !== dataMsg(m.timestamp);
          return (
            <React.Fragment key={m.id}>
              {showDia && (
                <div style={{
                  alignSelf: "center", padding: "4px 12px", margin: "6px 0",
                  background: t.card2, border: `1px solid ${t.border1}`,
                  fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.24em",
                  textTransform: "uppercase", color: t.textTertiary,
                }}>
                  {dataMsg(m.timestamp)}
                </div>
              )}
              <MsgBubble m={m} t={t} />
            </React.Fragment>
          );
        })}
      </div>

      {/* Composer */}
      <div style={{
        padding: "12px 32px", borderTop: `1px solid ${t.border1}`,
        background: t.card1, display: "grid",
        gridTemplateColumns: "1fr auto", gap: 10, alignItems: "flex-end",
      }}>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
          }}
          placeholder={grupoJid ? "Digite uma mensagem… (Enter envia, Shift+Enter quebra linha)" : "Sem grupo registrado — não é possível enviar"}
          disabled={!grupoJid || enviando}
          rows={2}
          style={{
            resize: "none", padding: "10px 12px",
            background: t.card2, border: `1px solid ${t.border1}`,
            color: t.textPrimary, outline: "none",
            fontFamily: fonts.inter, fontSize: 12, letterSpacing: "0.02em",
            width: "100%", boxSizing: "border-box", minWidth: 0,
          }}
        />
        <button
          onClick={enviar}
          disabled={!grupoJid || !texto.trim() || enviando}
          style={{
            background: (!grupoJid || !texto.trim() || enviando) ? t.border1 : t.accent,
            color: (!grupoJid || !texto.trim() || enviando) ? t.textTertiary : t.bg,
            border: "none", padding: "12px 22px",
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.24em",
            textTransform: "uppercase",
            cursor: (!grupoJid || !texto.trim() || enviando) ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >{enviando ? "enviando…" : "enviar →"}</button>
      </div>
      </div>{/* fim coluna chat */}

      {/* Coluna lateral direita: acesso à Central + Teca Copiloto */}
      <aside style={{
        borderLeft: `1px solid ${t.border1}`,
        background: t.card1,
        overflow: "hidden", display: "flex", flexDirection: "column",
        minWidth: 0,
      }}>
        <CenterAcessoPanel projetoId={projetoId} t={t}
          onEnviarNoChat={grupoJid ? (txt) => setTexto(txt) : undefined} />
        {grupoJid && (
          <TecaCopilotoPanel projetoId={projetoId} t={t} onEscolher={(txt) => setTexto(txt)} />
        )}
      </aside>
    </section>
  );
}

/* ── Painel do Relacionamento: acesso do cliente à Central (link direto, sem login) ── */
function CenterAcessoPanel({ projetoId, t, onEnviarNoChat }: {
  projetoId: string; t: any; onEnviarNoChat?: (txt: string) => void;
}) {
  const [cred, setCred] = useState<{ url: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.centerLink(projetoId).then(c => { if (vivo) setCred(c); }).catch(() => {});
    return () => { vivo = false; };
  }, [projetoId]);

  const mensagem = cred
    ? `Central do Cliente Parket\nAcompanhe sua obra: ${cred.url}`
    : "";

  const copiar = async () => {
    if (!cred) return;
    try { await navigator.clipboard.writeText(mensagem); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch {}
  };

  const linha: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", gap: 8,
    fontSize: 11, color: t.textSecondary, letterSpacing: "0.03em",
  };
  const btn: React.CSSProperties = {
    background: "transparent", color: t.textSecondary, border: `1px solid ${t.border1}`,
    padding: "5px 10px", fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.2em",
    textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
  };

  return (
    <div style={{ borderBottom: `1px solid ${t.border1}` }}>
      <div style={{
        padding: "14px 18px 10px", display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 6,
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
          textTransform: "uppercase", color: t.accent, whiteSpace: "nowrap",
        }}>Central do Cliente</div>
      </div>
      {cred ? (
        <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          <a href={cred.url} target="_blank" rel="noreferrer" style={{
            fontSize: 10, color: t.accent, letterSpacing: "0.03em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{cred.url.replace("https://", "")}</a>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button onClick={copiar} style={{ ...btn, color: copiado ? t.accent : t.textSecondary }}>
              {copiado ? "Copiado ✓" : "Copiar"}
            </button>
            {onEnviarNoChat && (
              <button onClick={() => onEnviarNoChat(mensagem)} style={btn}>Enviar no chat</button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: "0 18px 14px", fontSize: 10, color: t.textTertiary }}>carregando acesso…</div>
      )}
    </div>
  );
}

function VincularGrupoPanel({ projetoId, projetoCliente, projetoObraCode, t, onVinculado }: {
  projetoId: string;
  projetoCliente: string;
  projetoObraCode: string | null;
  t: any;
  onVinculado: () => void;
}) {
  // Pré-preenche busca com o nome do cliente (grupos WhatsApp são nomeados pelo cliente,
  // não pelo código da proposta)
  const [q, setQ] = useState<string>(projetoCliente || projetoObraCode || "");
  const [grupos, setGrupos] = useState<WhatsappGrupo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState<string | null>(null);

  const buscar = () => {
    setBuscando(true);
    setErroBusca(null);
    api.relacionamentoGrupos(q.trim() || undefined)
      .then(setGrupos)
      .catch(e => setErroBusca(String(e.message || e)))
      .finally(() => setBuscando(false));
  };
  // Busca inicial + debounce da busca conforme digita
  useEffect(() => {
    const id = setTimeout(buscar, 250);
    return () => clearTimeout(id);
  }, [q]);

  const vincular = async (g: WhatsappGrupo) => {
    if (g.card_id) {
      if (!confirm(`Este grupo já está vinculado a outro projeto. Substituir vínculo?`)) return;
    }
    setVinculando(g.id);
    try {
      await api.relacionamentoVincular(projetoId, g.grupo_jid, g.instance_name);
      onVinculado();
    } catch (e: any) {
      setErroBusca(String(e.message || e));
    } finally {
      setVinculando(null);
    }
  };

  return (
    <div style={{
      background: t.card1, border: `1px solid ${t.border1}`, padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em",
          textTransform: "uppercase", color: t.textPrimary,
        }}>
          Vincular grupo WhatsApp
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6, letterSpacing: "0.04em", lineHeight: 1.5 }}>
          A integração automática não localizou o grupo desse projeto. Busque abaixo pelo
          nome do grupo, cliente ou nº da obra e clique em <b>Vincular</b>. O relacionamento
          fica salvo em <code>atendimento_conversas</code> — mesma tabela que o Space usa,
          então o vínculo passa a valer também lá. Se o projeto ainda não tem card no Kanban,
          um card de ancoragem é criado automaticamente no dept Atendimento.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar grupo por nome / cliente / obra…"
          autoFocus
          style={{
            padding: "10px 12px", background: t.card2, border: `1px solid ${t.border1}`,
            color: t.textPrimary, outline: "none",
            fontFamily: fonts.inter, fontSize: 12, letterSpacing: "0.04em",
            width: "100%", boxSizing: "border-box", minWidth: 0,
          }}
        />
        <button onClick={buscar} disabled={buscando}
          style={{
            background: "transparent", color: t.textSecondary,
            border: `1px solid ${t.border1}`, padding: "8px 14px",
            fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
            textTransform: "uppercase", cursor: buscando ? "default" : "pointer",
          }}>{buscando ? "…" : "buscar"}</button>
      </div>

      {erroBusca && (
        <div style={{
          padding: "8px 12px", background: "rgba(184,91,76,0.14)",
          border: "1px solid #B85B4C", color: "#B85B4C", fontSize: 10,
        }}>{erroBusca}</div>
      )}

      <div style={{
        display: "grid", gap: 4, maxHeight: 380, overflow: "auto",
      }}>
        {!buscando && grupos.length === 0 && (
          <div style={{
            padding: "18px 12px", textAlign: "center", color: t.textTertiary,
            fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase",
            fontFamily: fonts.cinzel, border: `1px dashed ${t.border1}`, background: t.card2,
          }}>
            {q.trim() ? "Nenhum grupo encontrado" : "Digite pra buscar"}
          </div>
        )}
        {grupos.map(g => {
          const isVincLoad = vinculando === g.id;
          return (
            <button key={g.id}
              onClick={() => vincular(g)}
              disabled={isVincLoad}
              style={{
                textAlign: "left",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12, alignItems: "center",
                padding: "10px 14px",
                background: t.card2, color: t.textPrimary,
                border: `1px solid ${t.border1}`,
                borderLeft: `3px solid ${saudeCor(g.saude)}`,
                cursor: isVincLoad ? "default" : "pointer",
              }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.subject || g.cliente || g.grupo_jid}
                </div>
                <div style={{ fontSize: 8, letterSpacing: "0.18em", color: t.textTertiary, marginTop: 3, textTransform: "uppercase", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.instance_name && <span>{g.instance_name}</span>}
                  {g.cliente && g.cliente !== g.subject && <span>· cliente: {g.cliente}</span>}
                  {g.obra_code && <span>· obra {g.obra_code}</span>}
                  {g.membros ? <span>· {g.membros} membros</span> : null}
                  {g.card_id && (
                    <span style={{ color: "#C7A45B" }}>· já vinculado a outro projeto</span>
                  )}
                </div>
              </div>
              <span style={{
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: isVincLoad ? t.textTertiary : t.accent,
                whiteSpace: "nowrap",
              }}>{isVincLoad ? "vinculando…" : "vincular →"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function saudeCor(s: string | null): string {
  switch ((s || "").toLowerCase()) {
    case "verde":    return "#7BA394";
    case "amarelo":  return "#C7A45B";
    case "vermelho": return "#B85B4C";
    case "novo":     return "#8CA9B8";
    default:         return "#5F5D58";
  }
}

// ─── TECA COPILOTO ────────────────────────────────────────────────────
// Analisa projeto + últimas mensagens e sugere 3 respostas (positiva /
// neutra / negativa) pra última mensagem do cliente. Botão "Usar" cola
// a sugestão escolhida na caixa de mensagem pra o atendente editar antes
// de enviar.
function TecaCopilotoPanel({ projetoId, t, onEscolher }: {
  projetoId: string; t: any; onEscolher: (texto: string) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [sugestoes, setSugestoes] = useState<CopilotoSugestao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ultima, setUltima] = useState<string>("");

  const analisar = async () => {
    setCarregando(true); setErro(null); setSugestoes([]);
    try {
      const r: CopilotoResp = await api.relacionamentoCopiloto(projetoId);
      setSugestoes(r.sugestoes || []);
      setUltima(r.ultima_mensagem_cliente || "");
      if (!r.sugestoes?.length) setErro("Copiloto não retornou sugestões");
    } catch (e: any) {
      setErro(String(e.message || e));
    } finally {
      setCarregando(false);
    }
  };

  // Dispara auto ao montar
  useEffect(() => { analisar(); /* eslint-disable-next-line */ }, [projetoId]);

  const tomStyle = (tom: string) => {
    switch (tom) {
      case "positiva": return { cor: "#7BA394", bg: "rgba(123,163,148,0.10)", border: "rgba(123,163,148,0.30)", icone: "▲" };
      case "negativa": return { cor: "#B85B4C", bg: "rgba(184,91,76,0.10)", border: "rgba(184,91,76,0.30)", icone: "▼" };
      default:          return { cor: "#8CA9B8", bg: "rgba(140,169,184,0.10)", border: "rgba(140,169,184,0.30)", icone: "·" };
    }
  };

  return (
    <div style={{
      height: "100%", display: "grid", gridTemplateRows: "auto 1fr",
      overflow: "hidden",
    }}>
      {/* Header fixo */}
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${t.border1}`,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
          textTransform: "uppercase", color: t.accent,
          display: "flex", alignItems: "center", gap: 8, minWidth: 0,
        }}>
          <span style={{ fontSize: 11 }}>✦</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Teca Copiloto
          </span>
        </div>
        <button onClick={analisar} disabled={carregando}
          title="Regenerar sugestões"
          style={{
            background: "transparent", color: t.textSecondary,
            border: `1px solid ${t.border1}`, padding: "4px 10px",
            fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
            textTransform: "uppercase", cursor: carregando ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}>
          {carregando ? "…" : "↺"}
        </button>
      </div>

      {/* Corpo com scroll */}
      <div style={{
        overflowY: "auto", padding: "12px 14px 16px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {carregando && sugestoes.length === 0 && (
          <div style={{
            padding: "24px 10px", textAlign: "center", color: t.textTertiary,
            fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase",
            fontFamily: fonts.cinzel,
          }}>
            Analisando projeto<br />e conversas…
          </div>
        )}

        {ultima && (
          <div style={{
            padding: "8px 10px", background: t.card2, border: `1px solid ${t.border1}`,
            fontSize: 10, color: t.textSecondary, letterSpacing: "0.02em",
            lineHeight: 1.4, fontStyle: "italic",
          }}>
            <div style={{
              fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
              textTransform: "uppercase", color: t.textTertiary, marginBottom: 4,
              fontStyle: "normal",
            }}>
              Respondendo a:
            </div>
            {ultima.length > 260 ? ultima.slice(0, 260) + "…" : ultima}
          </div>
        )}

        {erro && (
          <div style={{
            padding: "8px 10px", background: "rgba(184,91,76,0.14)",
            border: "1px solid #B85B4C", color: "#B85B4C",
            fontSize: 10, letterSpacing: "0.04em",
          }}>{erro}</div>
        )}

        {sugestoes.map((s, i) => {
          const st = tomStyle(s.tom);
          return (
            <div key={i} style={{
              padding: "10px 12px", background: st.bg, border: `1px solid ${st.border}`,
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
              }}>
                <div style={{
                  fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
                  textTransform: "uppercase", color: st.cor, fontWeight: 700,
                }}>
                  {st.icone} {s.tom}
                </div>
                <button onClick={() => onEscolher(s.texto)}
                  style={{
                    background: st.cor, color: t.bg, border: "none",
                    padding: "4px 10px", cursor: "pointer",
                    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
                    textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap",
                  }}>usar →</button>
              </div>
              {s.titulo && (
                <div style={{
                  fontSize: 9, color: t.textTertiary, letterSpacing: "0.10em",
                  textTransform: "uppercase",
                }}>
                  {s.titulo}
                </div>
              )}
              <div style={{
                fontSize: 11, color: t.textPrimary, lineHeight: 1.5,
                letterSpacing: "0.02em", whiteSpace: "pre-wrap",
              }}>
                {s.texto}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MsgBubble({ m, t }: { m: WhatsappMessage; t: any }) {
  const out = m.direction === "out";
  const hasMedia = m.media_url && ["imageMessage", "documentMessage", "audioMessage", "videoMessage"].includes(m.message_type || "");
  return (
    <div style={{
      alignSelf: out ? "flex-end" : "flex-start",
      maxWidth: "68%",
      background: out ? t.card2 : t.card1,
      border: `1px solid ${out ? t.accent : t.border1}`,
      borderLeft: out ? `3px solid ${t.accent}` : `3px solid ${t.border2}`,
      padding: "8px 12px",
    }}>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
        textTransform: "uppercase", color: out ? t.accent : t.textTertiary,
        display: "flex", justifyContent: "space-between", gap: 12,
      }}>
        <span>{m.sender_name || (out ? "Você" : "cliente")}</span>
        <span style={{ color: t.textTertiary, fontVariantNumeric: "tabular-nums" as any }}>
          {horaMsg(m.timestamp)}
        </span>
      </div>
      {hasMedia && (
        <div style={{ marginTop: 6 }}>
          {m.message_type === "imageMessage" ? (
            <a href={m.media_url!} target="_blank" rel="noreferrer">
              <img src={m.media_url!} alt=""
                style={{ maxWidth: "100%", maxHeight: 240, display: "block", border: `1px solid ${t.border1}` }} />
            </a>
          ) : (
            <a href={m.media_url!} target="_blank" rel="noreferrer"
              style={{
                display: "inline-block", padding: "4px 10px",
                background: t.card2, border: `1px solid ${t.border1}`,
                color: t.accent, textDecoration: "none",
                fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}>
              {m.message_type === "documentMessage" ? "Documento" : m.message_type === "audioMessage" ? "Áudio" : "Vídeo"} →
            </a>
          )}
        </div>
      )}
      {m.message_text && (
        <div style={{
          fontSize: 12, color: t.textPrimary, marginTop: 6,
          whiteSpace: "pre-wrap", wordWrap: "break-word", lineHeight: 1.5,
          letterSpacing: "0.02em",
        }}>
          {m.message_text}
        </div>
      )}
    </div>
  );
}

export function statusChatCor(status: string): string {
  switch ((status || "").toLowerCase()) {
    case "aberta":              return "#7BA394";
    case "pendente":            return "#C7A45B";
    case "aguardando_cliente":  return "#8CA9B8";
    case "resolvida":           return "#5F5D58";
    default:                    return "#968473";
  }
}

export function dataMsg(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function horaMsg(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ═══════════════════════════════════════════════════════════════════
// InstaladorTab — dados de instala.parket.works (checkins / ocorrências / conferências)
// ═══════════════════════════════════════════════════════════════════
function InstaladorTab({ projetoId, t }: { projetoId: string; t: any }) {
  const [checkins, setCheckins] = useState<any[]>([]);
  const [ocor, setOcor] = useState<any[]>([]);
  const [conf, setConf] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      api.projetoInstalaCheckins(projetoId).catch(() => []),
      api.projetoInstalaOcorrencias(projetoId).catch(() => []),
      api.projetoInstalaConferencias(projetoId).catch(() => []),
    ]).then(([c, o, cf]) => {
      if (cancel) return;
      setCheckins(c); setOcor(o); setConf(cf); setLoading(false);
    }).catch(e => { if (!cancel) { setErro(String(e)); setLoading(false); } });
    return () => { cancel = true; };
  }, [projetoId]);

  const tituloSec: React.CSSProperties = {
    fontSize: 11, letterSpacing: "0.20em", color: t.textTertiary,
    textTransform: "uppercase", marginBottom: 8, paddingTop: 4,
  };

  if (loading) return <div style={{ padding: 32, color: t.textSecondary }}>Carregando…</div>;
  if (erro)    return <div style={{ padding: 32, color: "#e5484d" }}>Erro: {erro}</div>;

  const vazio = checkins.length === 0 && ocor.length === 0 && conf.length === 0;
  if (vazio) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{
          padding: 24, background: t.card1, border: `1px solid ${t.border1}`,
          color: t.textSecondary, fontSize: 13,
        }}>
          Nenhum dado do instalador ainda pra esta obra. Quando o instalador fizer check-in,
          registrar ocorrência ou conferência de material pelo app instala.parket.works,
          aparece aqui automaticamente.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", display: "grid", gap: 24 }}>
      {/* Check-ins */}
      <section>
        <div style={tituloSec}>Check-ins ({checkins.length})</div>
        {checkins.length === 0 ? (
          <div style={{ color: t.textTertiary, fontSize: 12 }}>—</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {checkins.slice(0, 20).map(c => (
              <div key={c.id} style={{
                padding: 12, background: t.card1, border: `1px solid ${t.border1}`,
                display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center",
              }}>
                <div style={{ fontSize: 11, color: t.textTertiary }}>
                  {new Date(c.created_at).toLocaleString("pt-BR")}
                </div>
                <div style={{ fontSize: 12, color: t.textPrimary }}>
                  {c.status || "check-in"} {c.observacao ? `· ${c.observacao}` : ""}
                </div>
                {c.foto_url && (
                  <a href={c.foto_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: t.accent }}>
                    Foto
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ocorrências */}
      <section>
        <div style={tituloSec}>Ocorrências ({ocor.length})</div>
        {ocor.length === 0 ? (
          <div style={{ color: t.textTertiary, fontSize: 12 }}>—</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {ocor.map(o => (
              <div key={o.id} style={{
                padding: 12, background: t.card1, border: `1px solid ${t.border1}`,
                display: "grid", gap: 6,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: t.accent, fontWeight: 700, textTransform: "uppercase" }}>
                    {o.tipo || "ocorrência"} {o.status === "resolvida" && "· resolvida"}
                  </span>
                  <span style={{ color: t.textTertiary }}>
                    {new Date(o.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: t.textPrimary }}>{o.descricao || "—"}</div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: t.textSecondary }}>
                  {o.prestador_nome && <span>por: {o.prestador_nome}</span>}
                  {o.foto_url && <a href={o.foto_url} target="_blank" rel="noreferrer" style={{ color: t.accent }}>Foto</a>}
                  {o.audio_url && <a href={o.audio_url} target="_blank" rel="noreferrer" style={{ color: t.accent }}>Áudio</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Conferências de material */}
      <section>
        <div style={tituloSec}>Conferências de material ({conf.length})</div>
        {conf.length === 0 ? (
          <div style={{ color: t.textTertiary, fontSize: 12 }}>—</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {conf.slice(0, 30).map(c => (
              <div key={c.id} style={{
                padding: 12, background: t.card1, border: `1px solid ${t.border1}`,
                fontSize: 12, color: t.textPrimary,
              }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                  {JSON.stringify(c, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ABA CUSTOS — Custos de Terceiros desta obra (módulo /custos).
   Somente leitura: KPIs agregados (resumo do backend, nada calculado
   aqui) + lista dos lançamentos do projeto. Lançar/aprovar/pagar
   acontece na tela cheia gestao.parket.works/custos.
   ══════════════════════════════════════════════════════════════════════ */

const CUSTO_STATUS_LABEL: Record<CustoStatus, string> = {
  rascunho: "Rascunho", enviado: "Enviado", em_analise: "Em análise",
  aprovado: "Aprovado", devolvido: "Devolvido", pago: "Pago",
};

// mesmas cores do Selo da tela /custos, pra o status ler igual nos 2 lugares
function custoStatusCor(status: CustoStatus, t: any): string {
  return status === "pago" ? "#5E8A5E"
    : status === "aprovado" ? "#6E8FA8"
    : status === "devolvido" ? "#B4552F"
    : status === "rascunho" ? t.textTertiary
    : t.accent;
}

function custoCentBRL(c: number | null | undefined): string {
  return "R$ " + ((c || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CustosObraTab({ projetoId, t }: { projetoId: string; t: any }) {
  // resumo agregado (n, lancado, aprovado, a_pagar, pago) + lista de lançamentos
  const [resumo, setResumo] = useState<{ n: number; lancado_cent: number; aprovado_cent: number; a_pagar_cent: number; pago_cent: number } | null>(null);
  const [lancs, setLancs] = useState<CustoLancamentoLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      api.custosResumoObra(projetoId),
      api.custosLancamentos({ projeto_id: projetoId }),
    ]).then(([r, l]) => {
      if (cancel) return;
      setResumo(r); setLancs(l.items); setLoading(false);
    }).catch(e => { if (!cancel) { setErro(String(e?.message || e)); setLoading(false); } });
    return () => { cancel = true; };
  }, [projetoId]);

  if (loading) return <div style={{ padding: 32, color: t.textSecondary }}>Carregando…</div>;
  if (erro)    return <div style={{ padding: 32, color: "#e5484d" }}>Erro: {erro}</div>;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 980, display: "grid", gap: 20, alignContent: "start" }}>
      {/* KPIs financeiros da obra (centavos do backend, só formata) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {[
          { rotulo: "Lançado", valor: resumo?.lancado_cent, destaque: false },
          { rotulo: "Aprovado", valor: resumo?.aprovado_cent, destaque: false },
          { rotulo: "A pagar", valor: resumo?.a_pagar_cent, destaque: true },
          { rotulo: "Pago", valor: resumo?.pago_cent, destaque: false },
        ].map(k => (
          <div key={k.rotulo} style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary }}>
              {k.rotulo}
            </div>
            <div style={{ fontSize: k.destaque ? 18 : 15, fontWeight: 600, marginTop: 4, color: k.destaque ? t.accent : t.textPrimary }}>
              {custoCentBRL(k.valor)}
            </div>
          </div>
        ))}
      </div>

      {/* Cabeçalho da lista + atalho pra tela cheia (lançar/aprovar mora lá) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase" }}>
          Lançamentos ({resumo?.n ?? lancs.length})
        </div>
        <Link to="/custos" style={{
          fontSize: 11, color: t.accent, textDecoration: "none",
          border: `1px solid ${t.accent}`, padding: "6px 12px", letterSpacing: "0.08em",
        }}>
          Abrir Custos de Terceiros
        </Link>
      </div>

      {lancs.length === 0 ? (
        <div style={{
          padding: 24, background: t.card1, border: `1px solid ${t.border1}`,
          color: t.textSecondary, fontSize: 13,
        }}>
          Nenhum custo de terceiro lançado pra esta obra ainda. O lançamento
          (gasolina, hospedagem, alimentação, pedágio, NF/RPA do prestador)
          é feito na tela Custos de Terceiros.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {lancs.map(l => {
            const cor = custoStatusCor(l.status, t);
            return (
              <div key={l.id} style={{
                padding: "12px 14px", background: t.card1, border: `1px solid ${t.border1}`,
                display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 14, alignItems: "center",
              }}>
                {/* número da OP + período */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.textPrimary }}>{l.numero}</div>
                  <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>
                    {l.data_ida ? new Date(l.data_ida + "T12:00:00").toLocaleDateString("pt-BR") : ""}
                    {l.data_volta ? " a " + new Date(l.data_volta + "T12:00:00").toLocaleDateString("pt-BR") : ""}
                  </div>
                </div>
                {/* prestador + motivo */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.prestador_nome || "(prestador)"}
                  </div>
                  {l.motivo && (
                    <div style={{ fontSize: 11, color: t.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                      {l.motivo}
                    </div>
                  )}
                </div>
                {/* valores: aprovado prevalece; antes da análise mostra o lançado */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary }}>
                    {custoCentBRL(l.status === "rascunho" || l.status === "enviado" ? l.total_lancado_cent : l.total_aprovado_cent)}
                  </div>
                  <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>
                    {l.n_despesas} {l.n_despesas === 1 ? "despesa" : "despesas"}
                  </div>
                </div>
                <span style={{
                  fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                  color: cor, border: `1px solid ${cor}`, padding: "3px 7px", whiteSpace: "nowrap",
                }}>
                  {CUSTO_STATUS_LABEL[l.status] || l.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

