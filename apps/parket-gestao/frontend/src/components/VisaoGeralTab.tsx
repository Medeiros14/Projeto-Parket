import React, { useEffect, useMemo, useState } from "react";
import { fonts, useTokens } from "../theme";
import {
  api, type Projeto, type Coluna, type EntregaCatalogo,
  type FiscalVinculado, type Fiscal,
  type PrestadorVinculado, type EquipeParket, type Item,
  type ObraAcompanhamento,
} from "../api";
import { itemServicoLabel, fmtNum, produtoHeaderDe } from "../pages/ObraAcompanhamento";
import { toISO, fmtBR } from "../pages/Obras";
import {
  FASE_POR_COLUNA, mapearEntregas, agruparFases, type FaseEntrega,
} from "../lib/jornada";

/* ═══ ABA VISÃO GERAL do projeto ══════════════════════════
   1) Ficha: cliente + responsáveis (arquiteto/engenheiro, gestor,
      vendedor, orçamentista) editáveis.
   2) Fiscal responsável + Equipe da obra (vínculos do card).
   3) Jornada macro: as mesmas 5 fases/bolinhas da visão Jornada,
      recortadas pra ESTE projeto. */

export default function VisaoGeralTab({ projeto, t, onReload, onAbrirDocumentos }: {
  projeto: Projeto; t: any;
  onReload: () => void;
  onAbrirDocumentos: () => void;
}) {
  const [itens, setItens] = useState<Item[]>([]);
  const [itensLoading, setItensLoading] = useState(true);
  const [cronoDatas, setCronoDatas] = useState<{ inicio: string; termino: string }>({ inicio: "", termino: "" });

  useEffect(() => {
    setItensLoading(true);
    api.itens(projeto.id)
      .then(setItens)
      .catch(() => setItens([]))
      .finally(() => setItensLoading(false));
    api.projetoCronograma(projeto.id)
      .then((rows) => {
        let inicio = "", termino = "";
        for (const c of rows) {
          const i = toISO(c.inicio_dia);
          const f = toISO(c.termino_dia);
          if (i && (!inicio || i < inicio)) inicio = i;
          if (f && (!termino || f > termino)) termino = f;
        }
        setCronoDatas({ inicio, termino });
      })
      .catch(() => setCronoDatas({ inicio: "", termino: "" }));
  }, [projeto.id]);

  // Previsões alinhadas com a aba Itens & Cronograma:
  // menor início / maior término dos itens, completados pelo cronograma legacy
  const datas = useMemo(() => {
    let inicio = cronoDatas.inicio, termino = cronoDatas.termino;
    for (const it of itens) {
      if (it.status === "cancelado") continue;
      const i = (it.previsao_inicio || "").slice(0, 10);
      const f = (it.previsao_fim || "").slice(0, 10);
      if (i && (!inicio || i < inicio)) inicio = i;
      if (f && (!termino || f > termino)) termino = f;
    }
    return { inicio, termino };
  }, [itens, cronoDatas]);

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "18px 32px 40px" }}>
      <JornadaDoProjeto projeto={projeto} t={t} onAbrirDocumentos={onAbrirDocumentos} />
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 14, marginTop: 14,
      }}>
        <FichaCliente projeto={projeto} t={t} datas={datas} />
        <Responsaveis projeto={projeto} t={t} onReload={onReload} />
        <FiscalResponsavel projeto={projeto} t={t} />
        <EquipeDaObra projeto={projeto} t={t} />
      </div>
      <ResumoItens itens={itens} loading={itensLoading} t={t} />
    </div>
  );
}

/* ── helpers de estilo ── */
const secTitle = (t: any): React.CSSProperties => ({
  fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.20em",
  color: t.textPrimary, marginBottom: 12,
});
const cardBox = (t: any): React.CSSProperties => ({
  background: t.card1, border: `1px solid ${t.border1}`, padding: "16px 18px",
});
const lbl = (t: any): React.CSSProperties => ({
  fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
  color: t.textTertiary, textTransform: "uppercase", display: "block", marginBottom: 3,
});
const val = (t: any): React.CSSProperties => ({
  fontFamily: fonts.inter, fontSize: 11, color: t.textPrimary,
});
const inp = (t: any): React.CSSProperties => ({
  padding: "6px 8px", background: t.card2, border: `1px solid ${t.border1}`,
  color: t.textPrimary, outline: "none", width: "100%",
  fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.04em",
});
const btnSalvar = (t: any): React.CSSProperties => ({
  padding: "7px 16px", background: t.accent, color: "#050505",
  border: "none", cursor: "pointer",
  fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
});

/* ── 1. Ficha do cliente (dados do card + datas da obra editáveis) ── */
function FichaCliente({ projeto, t, datas }: {
  projeto: Projeto; t: any;
  datas: { inicio: string; termino: string };
}) {
  const campos: [string, React.ReactNode][] = [
    ["Cliente", projeto.cliente],
    ["CPF / CNPJ", projeto.cnpj_cpf || "—"],
    ["Endereço da obra", projeto.endereco || "—"],
    ["Proposta", `#${projeto.numero_proposta || "s/nº"}`],
    ["Nº da obra", projeto.obra_code || "—"],
  ];

  /* As 3 datas ficam em gestao.obra_acompanhamento, a mesma fonte da aba
     Acompanhamento (inicio_obra / previsao_entrega_manual). Enquanto não há
     data manual salva o campo mostra o valor calculado: created_at do projeto
     pra entrada, menor início / maior término do cronograma pras previsões. */
  const [acomp, setAcomp] = useState<ObraAcompanhamento | null>(null);
  // null = campo não editado nesta sessão (segue o valor calculado)
  const [edEntrada, setEdEntrada] = useState<string | null>(null);
  const [edInicio, setEdInicio] = useState<string | null>(null);
  const [edTermino, setEdTermino] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setEdEntrada(null); setEdInicio(null); setEdTermino(null);
    api.acompanhamento(projeto.id).then(setAcomp).catch(() => setAcomp(null));
  }, [projeto.id]);

  const baseEntrada = (acomp?.entrada_obra || projeto.created_at || "").slice(0, 10);
  const baseInicio = (acomp?.inicio_obra || "").slice(0, 10) || datas.inicio || "";
  const baseTermino = (acomp?.previsao_entrega_manual || "").slice(0, 10) || datas.termino || "";
  const vEntrada = edEntrada ?? baseEntrada;
  const vInicio = edInicio ?? baseInicio;
  const vTermino = edTermino ?? baseTermino;
  const sujo = vEntrada !== baseEntrada || vInicio !== baseInicio || vTermino !== baseTermino;

  const salvar = async () => {
    setSalvando(true);
    try {
      const a = await api.acompanhamentoPut(projeto.id, {
        entrada_obra: vEntrada || null,
        inicio_obra: vInicio || null,
        previsao_entrega_manual: vTermino || null,
      } as any);
      setAcomp(a);
      setEdEntrada(null); setEdInicio(null); setEdTermino(null);
      setOk(true); setTimeout(() => setOk(false), 1600);
    } catch (e) { console.error(e); }
    setSalvando(false);
  };

  // input de data com dica do valor calculado quando ainda não foi fixado à mão
  const campoData = (
    rotulo: string, valor: string, set: (v: string) => void,
    calculado: string, manual: boolean,
  ) => (
    <div>
      <label style={lbl(t)}>{rotulo}</label>
      <input type="date" value={valor} onChange={(e) => set(e.target.value)}
        style={{ ...inp(t), fontVariantNumeric: "tabular-nums" as any }} />
      {!manual && calculado ? (
        <span style={{
          display: "block", marginTop: 3, fontFamily: fonts.inter,
          fontSize: 8, letterSpacing: "0.06em", color: t.textTertiary,
        }}>
          calculado do cronograma: {fmtBR(calculado)}
        </span>
      ) : null}
    </div>
  );

  return (
    <div style={cardBox(t)}>
      <div style={secTitle(t)}>CLIENTE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {campos.map(([k, v]) => (
          <div key={k}>
            <span style={lbl(t)}>{k}</span>
            <span style={val(t)}>{v}</span>
          </div>
        ))}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
          paddingTop: 10, borderTop: `1px solid ${t.border1}`,
        }}>
          {campoData("Entrada da obra", vEntrada, setEdEntrada, "", !!acomp?.entrada_obra)}
          {campoData("Previsão de início", vInicio, setEdInicio,
            datas.inicio, !!acomp?.inicio_obra)}
          {campoData("Previsão de término", vTermino, setEdTermino,
            datas.termino, !!acomp?.previsao_entrega_manual)}
        </div>
        {(sujo || ok) && (
          <button onClick={salvar} disabled={salvando}
            style={{ ...btnSalvar(t), alignSelf: "flex-start", opacity: salvando ? 0.6 : 1 }}>
            {ok ? "salvo" : salvando ? "salvando…" : "Salvar alterações"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── 2. Responsáveis (arquiteto/engenheiro/gestor + vendedor/orçamentista) ── */
function Responsaveis({ projeto, t, onReload }: {
  projeto: Projeto; t: any; onReload: () => void;
}) {
  const [arquiteto, setArquiteto] = useState(projeto.arquiteto || "");
  const [gestor, setGestor] = useState(projeto.gestor_email || "");
  const [vendedor, setVendedor] = useState(projeto.vendedor || "");
  const [orcamentista, setOrcamentista] = useState(projeto.orcamentista || "");
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setArquiteto(projeto.arquiteto || ""); setGestor(projeto.gestor_email || "");
    setVendedor(projeto.vendedor || ""); setOrcamentista(projeto.orcamentista || "");
  }, [projeto]);

  const sujo = arquiteto !== (projeto.arquiteto || "") || gestor !== (projeto.gestor_email || "")
    || vendedor !== (projeto.vendedor || "") || orcamentista !== (projeto.orcamentista || "");

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.projetoPatch(projeto.id, {
        arquiteto, gestor_email: gestor, vendedor, orcamentista,
      } as any);
      setOk(true); setTimeout(() => setOk(false), 1600);
      onReload();
    } catch (e) { console.error(e); }
    setSalvando(false);
  };

  return (
    <div style={cardBox(t)}>
      <div style={secTitle(t)}>RESPONSÁVEIS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={lbl(t)}>Arquiteto / Engenheiro / Gestor da obra (cliente)</label>
          <input value={arquiteto} onChange={(e) => setArquiteto(e.target.value)}
            placeholder="nome + contato" style={inp(t)} />
        </div>
        <div>
          <label style={lbl(t)}>Gestor do projeto (Parket)</label>
          <input value={gestor} onChange={(e) => setGestor(e.target.value)}
            placeholder="email do gestor" style={inp(t)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl(t)}>Vendedor</label>
            <input value={vendedor} onChange={(e) => setVendedor(e.target.value)}
              placeholder="—" style={inp(t)} />
          </div>
          <div>
            <label style={lbl(t)}>Orçamentista</label>
            <input value={orcamentista} onChange={(e) => setOrcamentista(e.target.value)}
              placeholder="—" style={inp(t)} />
          </div>
        </div>
        {(sujo || ok) && (
          <button onClick={salvar} disabled={salvando} style={{ ...btnSalvar(t), alignSelf: "flex-start", opacity: salvando ? 0.6 : 1 }}>
            {ok ? "✓ salvo" : salvando ? "salvando…" : "Salvar"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── 3. Fiscal responsável (vínculo kanban_cards.details.fiscais) ── */
function FiscalResponsavel({ projeto, t }: { projeto: Projeto; t: any }) {
  const [vinculados, setVinculados] = useState<FiscalVinculado[]>([]);
  const [fiscais, setFiscais] = useState<Fiscal[]>([]);
  const [addId, setAddId] = useState("");

  const load = () => api.projetoFiscais(projeto.id).then(setVinculados).catch(() => setVinculados([]));
  useEffect(() => {
    load();
    api.fiscalList({ ativo: true }).then(setFiscais).catch(() => setFiscais([]));
  }, [projeto.id]);

  const disponiveis = useMemo(() => {
    const ids = new Set(vinculados.map((f) => f.id));
    return fiscais.filter((f) => !ids.has(f.id));
  }, [fiscais, vinculados]);

  const add = async (fid: string) => {
    if (!fid) return;
    setAddId("");
    try { await api.fiscalProjetoAdd(fid, projeto.id); load(); } catch (e) { console.error(e); }
  };
  const del = async (fid: string) => {
    try { await api.fiscalProjetoDel(fid, projeto.id); load(); } catch (e) { console.error(e); }
  };

  return (
    <div style={cardBox(t)}>
      <div style={secTitle(t)}>FISCAL RESPONSÁVEL</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {vinculados.length === 0 && (
          <div style={{ fontSize: 10, color: t.textTertiary }}>nenhum fiscal vinculado</div>
        )}
        {vinculados.map((f) => (
          <div key={f.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", background: t.card2, border: `1px solid ${t.border1}`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...val(t), fontWeight: 600 }}>{f.nome}</div>
              <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 2 }}>
                {[f.telefone, f.email].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <button onClick={() => del(f.id)} title="desvincular fiscal" style={{
              background: "transparent", border: "none", color: t.textTertiary,
              cursor: "pointer", fontSize: 12,
            }}>✕</button>
          </div>
        ))}
        <select value={addId} onChange={(e) => add(e.target.value)} style={inp(t)}>
          <option value="">+ vincular fiscal…</option>
          {disponiveis.map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ── 4. Equipe da obra (prestadores vinculados ao card) ── */
function EquipeDaObra({ projeto, t }: { projeto: Projeto; t: any }) {
  const [prestadores, setPrestadores] = useState<PrestadorVinculado[]>([]);
  const [equipes, setEquipes] = useState<EquipeParket[]>([]);
  const [addId, setAddId] = useState("");

  const load = () => api.projetoPrestadores(projeto.id).then(setPrestadores).catch(() => setPrestadores([]));
  useEffect(() => {
    load();
    api.equipesList({ ativo: true }).then(setEquipes).catch(() => setEquipes([]));
  }, [projeto.id]);

  const disponiveis = useMemo(() => {
    const ids = new Set(prestadores.map((p) => p.id));
    return equipes.filter((e) => !ids.has(e.id));
  }, [equipes, prestadores]);

  const add = async (eid: string) => {
    if (!eid) return;
    setAddId("");
    try { await api.projetoPrestadorAdd(projeto.id, eid); load(); } catch (e) { console.error(e); }
  };
  const del = async (eid: string) => {
    try { await api.projetoPrestadorDel(projeto.id, eid); load(); } catch (e) { console.error(e); }
  };

  return (
    <div style={cardBox(t)}>
      <div style={secTitle(t)}>EQUIPE DA OBRA</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {prestadores.length === 0 && (
          <div style={{ fontSize: 10, color: t.textTertiary }}>nenhuma equipe vinculada</div>
        )}
        {prestadores.map((p) => (
          <div key={p.id || p.nome} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", background: t.card2, border: `1px solid ${t.border1}`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...val(t), fontWeight: 600 }}>{p.nome}</div>
              <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 2 }}>
                {[p.categoria, p.telefone].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            {p.id && (
              <button onClick={() => del(p.id)} title="desvincular equipe" style={{
                background: "transparent", border: "none", color: t.textTertiary,
                cursor: "pointer", fontSize: 12,
              }}>✕</button>
            )}
          </div>
        ))}
        {!projeto.card_id ? (
          <div style={{ fontSize: 9, color: t.textTertiary }}>
            projeto sem card no Space — vínculo de equipe indisponível
          </div>
        ) : (
          <select value={addId} onChange={(e) => add(e.target.value)} style={inp(t)}>
            <option value="">+ vincular equipe…</option>
            {disponiveis.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}{e.categoria ? ` · ${e.categoria}` : ""}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

/* ── 5. Resumo dos itens — mesma organização da tabela Itens & Cronograma,
       porém cada grupo minimizado por padrão (▸/▾, leitura apenas) ── */
const ITEM_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", preparando: "Preparando", em_execucao: "Em execução",
  instalado: "Instalado", entregue: "Entregue", com_ressalva: "Com ressalva",
};
const ITEM_STATUS_COR: Record<string, string> = {
  pendente: "#968473", preparando: "#C7A45B", em_execucao: "#C7A45B",
  instalado: "#7BA394", entregue: "#7BA394", com_ressalva: "#B85B4C",
};

function StatusChip({ status, t }: { status: string; t: any }) {
  const cor = ITEM_STATUS_COR[status] || t.textTertiary;
  return (
    <span style={{
      fontFamily: fonts.inter, fontSize: 8, fontWeight: 700,
      letterSpacing: "0.14em", textTransform: "uppercase",
      padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap",
      background: `${cor}22`, color: cor,
    }}>{ITEM_STATUS_LABEL[status] || status}</span>
  );
}

function ResumoItens({ itens, loading, t }: { itens: Item[]; loading: boolean; t: any }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const ativos = useMemo(() => itens.filter((i) => i.status !== "cancelado"), [itens]);

  // Aditivo: separa itens em 2 arrays. Originais aparecem primeiro; abaixo
  // um separador "ADITIVO" seguido dos itens do aditivo — bloco visual claro
  // pra fiscal/instalador entender que veio depois da proposta original.
  const ativosOriginais = useMemo(
    () => ativos.filter((i) => !((i.meta as any)?.eh_aditivo)),
    [ativos],
  );
  const ativosAditivo = useMemo(
    () => ativos.filter((i) => (i.meta as any)?.eh_aditivo === true),
    [ativos],
  );

  // Mesmo agrupamento hierárquico por meta.codigo da aba Itens & Cronograma —
  // aplicado independentemente pros dois blocos (aditivo continua a numeração
  // por categoria, ex: piso 1.6 original + piso 1.7 aditivo).
  const gruparPorRaiz = (arr: Item[]) => {
    const cmpCodigo = (a: string, b: string) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d;
      }
      return 0;
    };
    const raizes = new Map<string, Item[]>();
    for (const it of arr) {
      const cod: string = (it.meta as any)?.codigo || (it.meta as any)?.numero_display || String(it.ordem);
      const raiz = cod.split(".")[0];
      const arrLocal = raizes.get(raiz) || [];
      arrLocal.push(it);
      raizes.set(raiz, arrLocal);
    }
    return Array.from(raizes.entries())
      .sort(([a], [b]) => cmpCodigo(a, b))
      .map(([raiz, arrLocal]) => {
        arrLocal.sort((x, y) => cmpCodigo(
          (x.meta as any)?.codigo || (x.meta as any)?.numero_display || String(x.ordem),
          (y.meta as any)?.codigo || (y.meta as any)?.numero_display || String(y.ordem)));
        const primeiro = arrLocal[0];
        const metaFonte: any = primeiro?.meta || {};
        const categoria = (metaFonte.categoria_raiz || primeiro?.categoria?.split("||")[0] || "").toUpperCase();
        // produto do header: meta.produto_header ou derivado da categoria encoded (fallback backfills)
        const produto = produtoHeaderDe(metaFonte, primeiro?.categoria);
        return { raiz, itens: arrLocal, categoria, produto };
      });
  };
  const gruposOriginais = useMemo(() => gruparPorRaiz(ativosOriginais), [ativosOriginais]);
  const gruposAditivo = useMemo(() => gruparPorRaiz(ativosAditivo), [ativosAditivo]);
  const grupos = useMemo(() => [...gruposOriginais, ...gruposAditivo], [gruposOriginais, gruposAditivo]);

  const toggle = (raiz: string) => setAbertos((prev) => {
    const s = new Set(prev);
    if (s.has(raiz)) s.delete(raiz); else s.add(raiz);
    return s;
  });

  if (!loading && ativos.length === 0) return null;

  return (
    <div style={{ ...cardBox(t), marginTop: 14 }}>
      <div style={{ ...secTitle(t), marginBottom: 10 }}>
        RESUMO DOS ITENS
        <span style={{
          marginLeft: 10, fontFamily: fonts.inter, fontSize: 9,
          letterSpacing: "0.10em", color: t.textTertiary,
        }}>
          {loading ? "carregando…" : `${grupos.length} ${grupos.length === 1 ? "grupo" : "grupos"} · ${ativos.length} ${ativos.length === 1 ? "serviço" : "serviços"}`}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {gruposOriginais.map((g) => {
          const aberto = abertos.has(g.raiz);
          const concluidos = g.itens.filter((i) => i.status === "instalado" || i.status === "entregue").length;
          return (
            <div key={g.raiz} style={{ border: `1px solid ${t.border1}`, background: t.card2 }}>
              {/* linha do grupo — minimizada por padrão */}
              <div
                onClick={() => toggle(g.raiz)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", cursor: "pointer", minWidth: 0,
                }}
              >
                <button
                  onClick={(ev) => { ev.stopPropagation(); toggle(g.raiz); }}
                  title={aberto ? "recolher" : "ver serviços do item"}
                  style={{
                    width: 24, height: 24, padding: 0, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: t.card1, border: `1px solid ${t.border2}`,
                    color: t.textSecondary, fontSize: 10, cursor: "pointer",
                  }}
                >{aberto ? "▾" : "▸"}</button>
                <span style={{
                  fontFamily: fonts.cinzel, fontVariantNumeric: "tabular-nums" as any,
                  fontSize: 13, letterSpacing: "0.12em", color: t.textPrimary, flexShrink: 0,
                }}>{g.raiz}</span>
                {g.categoria && (
                  <span style={{
                    fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
                    textTransform: "uppercase", color: t.accent, flexShrink: 0,
                  }}>{g.categoria}</span>
                )}
                <span style={{
                  fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.16em",
                  textTransform: "uppercase", color: t.textSecondary,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  flex: 1, minWidth: 0,
                }}>{g.produto || "—"}</span>
                <span style={{
                  fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary,
                  letterSpacing: "0.08em", whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {g.itens.length} {g.itens.length === 1 ? "serviço" : "serviços"}
                  {concluidos > 0 ? ` · ${concluidos} ✓` : ""}
                </span>
              </div>

              {/* serviços do grupo — só quando expandido */}
              {aberto && (
                <div style={{ borderTop: `1px solid ${t.border1}`, padding: "4px 0" }}>
                  {g.itens.map((it) => {
                    const meta: any = it.meta || {};
                    const cod: string = meta.codigo || String(it.ordem);
                    const sub = cod.split(".").length >= 3;
                    return (
                      <div key={it.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: `5px 12px 5px ${sub ? 58 : 46}px`, minWidth: 0,
                      }}>
                        <span title={itemServicoLabel(it)} style={{
                          flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 10,
                          color: sub ? t.textSecondary : t.textPrimary,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{itemServicoLabel(it)}</span>
                        {meta.so_material === true && meta.is_recorte_agregado !== true && (
                          <span style={{
                            fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.18em",
                            textTransform: "uppercase", padding: "2px 6px", whiteSpace: "nowrap",
                            background: "rgba(199,164,91,0.15)", color: "#C7A45B",
                            border: "1px solid #C7A45B", flexShrink: 0,
                          }}>SÓ MATERIAL</span>
                        )}
                        {meta.is_recorte_agregado === true && Array.isArray(meta.recortes) && (
                          <span title={meta.recortes.map((r: any) => `${r.qtd} ${r.unidade} · ${r.nome}`).join("\n")} style={{
                            fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.18em",
                            textTransform: "uppercase", padding: "2px 6px", whiteSpace: "nowrap",
                            background: "rgba(150,132,115,0.15)", color: t.textSecondary,
                            border: `1px solid ${t.border2 || t.border1}`, flexShrink: 0, cursor: "help",
                          }}>{meta.recortes.length} recortes</span>
                        )}
                        <span style={{
                          fontFamily: fonts.inter, fontSize: 10, color: t.textSecondary,
                          fontVariantNumeric: "tabular-nums" as any, whiteSpace: "nowrap", flexShrink: 0,
                        }}>{fmtNum(Number(it.quantidade) || 0)} {it.unidade}</span>
                        <StatusChip status={it.status} t={t} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Bloco ADITIVO — itens que entraram depois via aditivo assinado.
            Separador visual amarelo + grupos renderizados abaixo dos originais,
            preservando a numeração continuada (ex: piso 1.6 acima, 1.7 aqui). */}
        {gruposAditivo.length > 0 && (
          <>
            <div style={{
              marginTop: 12, marginBottom: 4, padding: "8px 12px",
              background: "rgba(199,164,91,0.10)", border: "1px solid #C7A45B",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{
                fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.28em",
                color: "#C7A45B", fontWeight: 700,
              }}>ADITIVO</span>
              <span style={{ fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary, letterSpacing: "0.08em" }}>
                {gruposAditivo.reduce((n, g) => n + g.itens.length, 0)} serviço(s) adicionado(s) após contrato original
              </span>
            </div>
            {gruposAditivo.map((g) => {
              const aberto = abertos.has(g.raiz);
              const concluidos = g.itens.filter((i) => i.status === "instalado" || i.status === "entregue").length;
              return (
                <div key={`ad-${g.raiz}`} style={{ border: "1px solid #C7A45B", background: "rgba(199,164,91,0.05)" }}>
                  <div
                    onClick={() => toggle(g.raiz)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", minWidth: 0 }}
                  >
                    <button
                      onClick={(ev) => { ev.stopPropagation(); toggle(g.raiz); }}
                      title={aberto ? "recolher" : "ver serviços do item"}
                      style={{
                        width: 24, height: 24, padding: 0, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: t.card1, border: `1px solid ${t.border2}`,
                        color: t.textSecondary, fontSize: 10, cursor: "pointer",
                      }}
                    >{aberto ? "▾" : "▸"}</button>
                    <span style={{
                      fontFamily: fonts.cinzel, fontVariantNumeric: "tabular-nums" as any,
                      fontSize: 13, letterSpacing: "0.12em", color: t.textPrimary, flexShrink: 0,
                    }}>{g.raiz}</span>
                    {g.categoria && (
                      <span style={{
                        fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em",
                        textTransform: "uppercase", color: "#C7A45B", flexShrink: 0,
                      }}>{g.categoria}</span>
                    )}
                    <span style={{
                      fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.16em",
                      textTransform: "uppercase", color: t.textSecondary,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      flex: 1, minWidth: 0,
                    }}>{g.produto || "—"}</span>
                    <span style={{
                      fontFamily: fonts.inter, fontSize: 9, color: t.textTertiary,
                      letterSpacing: "0.08em", whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {g.itens.length} {g.itens.length === 1 ? "serviço" : "serviços"}
                      {concluidos > 0 ? ` · ${concluidos} ✓` : ""}
                    </span>
                  </div>
                  {aberto && (
                    <div style={{ borderTop: "1px solid #C7A45B", padding: "4px 0" }}>
                      {g.itens.map((it) => {
                        const meta: any = it.meta || {};
                        const cod: string = meta.codigo || meta.numero_display || String(it.ordem);
                        const sub = cod.split(".").length >= 3;
                        return (
                          <div key={it.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: `5px 12px 5px ${sub ? 58 : 46}px`, minWidth: 0,
                          }}>
                            <span title={itemServicoLabel(it)} style={{
                              flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 10,
                              color: sub ? t.textSecondary : t.textPrimary,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>{itemServicoLabel(it)}</span>
                            <span style={{
                              fontFamily: fonts.inter, fontSize: 10, color: t.textSecondary,
                              fontVariantNumeric: "tabular-nums" as any, whiteSpace: "nowrap", flexShrink: 0,
                            }}>{fmtNum(Number(it.quantidade) || 0)} {it.unidade}</span>
                            <StatusChip status={it.status} t={t} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 9, color: t.textTertiary, letterSpacing: "0.06em" }}>
        ▸ abre os serviços de cada item · edição completa na aba Itens & Cronograma
      </div>
    </div>
  );
}

/* ── Jornada macro recortada pro projeto (mesma linguagem da visão Jornada) ── */
function JornadaDoProjeto({ projeto, t, onAbrirDocumentos }: {
  projeto: Projeto; t: any; onAbrirDocumentos: () => void;
}) {
  const [entregas, setEntregas] = useState<EntregaCatalogo[]>([]);
  const [filled, setFilled] = useState<Set<number>>(new Set());
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    api.jornada()
      .then((r) => {
        setEntregas(mapearEntregas(r.entregas || []));
        setFilled(new Set((r.preenchidos || {})[projeto.id] || []));
      })
      .catch(() => { setEntregas([]); setFilled(new Set()); });
    api.colunas().then(setColunas).catch(() => setColunas([]));
  }, [projeto.id]);

  const fases: FaseEntrega[] = useMemo(() => agruparFases(entregas), [entregas]);

  const travado = projeto.column_id === "travado";
  const faseMax = useMemo(() => {
    if (!travado) return FASE_POR_COLUNA[projeto.column_id] ?? 4;
    return Math.max(1, ...entregas.filter((e) => filled.has(e.id)).map((e) => e.fase));
  }, [travado, projeto.column_id, entregas, filled]);
  const atual = useMemo(
    () => entregas.find((e) => e.fase <= faseMax && !filled.has(e.id)) || null,
    [entregas, faseMax, filled]);

  const col = colunas.find((c) => c.id === projeto.column_id) || null;
  const corPill = travado ? "#B85B4C" : (col?.cor || t.accent);

  const dot = (e: EntregaCatalogo): React.CSSProperties => {
    if (atual && e.id === atual.id) return {
      width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
      background: t.card1, border: `1.5px solid ${travado ? "#B85B4C" : t.accent}`,
      boxShadow: `0 0 0 3px ${travado ? "#B85B4C" : t.accent}44`,
    };
    if (filled.has(e.id)) return {
      width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
      background: t.accent, border: `1.5px solid ${t.accent}`,
    };
    if (e.fase > faseMax) return {
      width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
      background: "transparent", border: `1.5px solid ${t.border1}`,
    };
    return {
      width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
      background: t.border1, border: `1.5px solid ${t.border2}`,
    };
  };
  const linha = (e: EntregaCatalogo): React.CSSProperties => ({
    flex: 1, height: 2,
    background: filled.has(e.id)
      ? `linear-gradient(90deg, ${t.accentDim || t.accent}, ${t.accent})`
      : t.border1,
  });

  return (
    <div style={cardBox(t)}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setAberto((v) => !v)}
            title={aberto ? "recolher" : "ver as entregas por extenso"}
            style={{
              width: 24, height: 24, padding: 0, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: t.card2, border: `1px solid ${t.border2}`,
              color: t.textSecondary, fontSize: 10, cursor: "pointer",
            }}
          >{aberto ? "▾" : "▸"}</button>
          <div style={{ ...secTitle(t), marginBottom: 0 }}>
            JORNADA DA OBRA
            <span style={{
              marginLeft: 10, fontFamily: fonts.inter, fontSize: 9,
              letterSpacing: "0.10em", color: t.textTertiary,
            }}>{filled.size}/{entregas.length} entregas</span>
          </div>
        </div>
        <span title={col ? `coluna do kanban: ${col.titulo}` : undefined} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 10px", borderRadius: 99,
          background: `${corPill}26`, color: corPill,
          fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.06em", fontWeight: 700,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
          {travado ? "TRAVADO" : (col?.titulo || "—")}
          {atual ? ` · ${atual.codigo}` : ""}
        </span>
      </div>

      {/* trilha de bolinhas — mesma linguagem da visão Jornada */}
      <div
        onClick={() => setAberto((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflowX: "auto", cursor: "pointer" }}
      >
        {fases.map((f) => (
          <span key={f.fase} style={{
            flex: Math.max(f.entregas.length, 1.6), minWidth: 90,
            display: "flex", alignItems: "center",
            background: f.fase > faseMax ? `${f.cor}0D` : `${f.cor}1E`,
            borderRadius: 7, padding: 6,
            opacity: f.fase > faseMax ? 0.55 : 1,
          }}>
            <span style={{ flex: 1, height: 2, background: t.border1 }} />
            {f.entregas.map((e) => (
              <span key={e.id} style={{ display: "contents" }}>
                <span title={`${e.codigo} · ${e.titulo}${e.fase > faseMax ? " (habilita ao avançar no kanban)" : ""}`}
                  style={dot(e)} />
                <span style={linha(e)} />
              </span>
            ))}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {fases.map((f) => (
          <span key={f.fase} style={{
            flex: Math.max(f.entregas.length, 1.6), minWidth: 90, textAlign: "center",
            fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.14em",
            color: f.cor, textTransform: "uppercase",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{f.label}</span>
        ))}
      </div>

      {/* passo a passo por extenso — só quando expandido */}
      {aberto && (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, paddingTop: 16 }}>
        {fases.map((f) => (
          <div key={f.fase} style={{ minWidth: 170, flex: 1 }}>
            <div style={{
              display: "inline-block", marginBottom: 9,
              fontFamily: fonts.inter, fontSize: 8, fontWeight: 700,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: f.cor, background: `${f.cor}1E`,
              borderRadius: 5, padding: "3px 9px",
              opacity: f.fase > faseMax ? 0.55 : 1,
            }}>{f.label}{f.fase > faseMax ? " · travada" : ""}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {f.entregas.map((e) => {
                const isAtual = atual?.id === e.id;
                const isDone = filled.has(e.id);
                const bloqueada = e.fase > faseMax;
                const cor = isDone || isAtual ? t.accent : t.textTertiary;
                return (
                  <button key={e.id}
                    onClick={onAbrirDocumentos}
                    title={bloqueada ? "habilita quando o projeto avançar no kanban" : "abrir na central de documentos"}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "6px 10px", borderRadius: 7, cursor: "pointer", textAlign: "left",
                      background: isDone ? `${t.accent}1C` : t.card1,
                      border: `1px solid ${isAtual ? t.accent : isDone ? `${t.accent}55` : t.border1}`,
                      opacity: bloqueada ? 0.55 : 1,
                    }}
                  >
                    <span style={{
                      width: 26, fontFamily: fonts.inter, fontSize: 9,
                      fontVariantNumeric: "tabular-nums" as any, color: cor,
                    }}>{e.codigo}</span>
                    <span style={{
                      flex: 1, fontFamily: fonts.inter, fontSize: 10,
                      color: isAtual ? t.textPrimary : isDone ? t.textSecondary : t.textTertiary,
                    }}>{e.titulo}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: cor, whiteSpace: "nowrap" }}>
                      {isDone ? "✓" : isAtual ? "● agora" : bloqueada ? "🔒" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      )}
      <div style={{ marginTop: 12, fontSize: 9, color: t.textTertiary, letterSpacing: "0.06em" }}>
        {aberto
          ? "ponto cheio = documento preenchido · anel maior = próxima entrega · fases travadas habilitam conforme o projeto avança no kanban · clique em uma entrega para abrir a central de documentos"
          : "▸ abre as entregas por extenso · ponto cheio = documento preenchido · anel maior = próxima entrega"}
      </div>
    </div>
  );
}
