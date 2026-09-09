import React, { useEffect, useMemo, useRef, useState } from "react";
import { fonts } from "../theme";
import {
  api, Projeto as P, Item,
  type Foto, type FotoObra, type ObraAcompanhamento, type ObraAlerta,
  type EquipeParket, type PrestadorVinculado,
} from "../api";
import { MiniStat, inputStyle, btnGhost, btnAccent, STATUS_CONCLUIDO } from "./Obras";
import SolicitacoesComprasSection from "./SolicitacoesCompras";
import { gerarCronogramaPdf, type CronogramaItem, type CronogramaMedia } from "../lib/cronograma-pdf";
import { midiaThumb } from "../lib/midia";

/* ═══════════════════════════════════════════════════════════════════
   ACOMPANHAMENTO DE OBRAS — item-centric (adaptado do Space /operacional)
   Cronograma = os próprios gestao.itens; dados de obra por item vivem em
   meta.obra {rendimento, equipe_id, equipe_nome, qtd_instalada, dias_uteis}.
   Previsão de entrega é MANUAL de propósito (sem auto-calcular).
   ═══════════════════════════════════════════════════════════════════ */

const STATUS_ITEM = ["pendente", "preparando", "em_execucao", "instalado", "entregue", "com_ressalva", "cancelado"];

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", preparando: "Preparando", em_execucao: "Em execução",
  instalado: "Instalado", entregue: "Entregue", com_ressalva: "Com ressalva", cancelado: "Cancelado",
};

const ALERTA_TIPOS: [string, string][] = [
  ["pendencia_obra", "Pendência de Obra (Cliente)"],
  ["atraso_parket", "Atraso da Parket"],
  ["outros", "Outros"],
];

type ObraEdit = {
  rendimento: number | null;
  equipe_id: string | null;
  equipe_nome: string | null;
  qtd_instalada: number | null;
  dias_uteis: number | null;   // override manual; se null usa ceil(qtd/rendimento)
  observacao: string | null;
  previsao_inicio: string | null;  // campos top-level do item (não vão pro meta.obra)
  previsao_fim: string | null;
};

function quemDaFoto(f: FotoObra): string {
  if (f.origem === "instala") {
    const m = /Instalador\s+([^—]+)/i.exec(f.legenda || "");
    return m ? `Instalador ${m[1].trim()}` : "Instalador";
  }
  if (f.origem === "fiscal") return "Fiscal";
  const nome = (f.autor_email || "").split("@")[0].replace(/[._]/g, " ").trim();
  return nome ? `Gestão · ${nome}` : "Gestão";
}

function obraFromMeta(it: Item): ObraEdit {
  const o = (it.meta as any)?.obra || {};
  return {
    rendimento: o.rendimento ?? null,
    equipe_id: o.equipe_id ?? null,
    equipe_nome: o.equipe_nome ?? null,
    qtd_instalada: o.qtd_instalada ?? null,
    dias_uteis: o.dias_uteis ?? null,
    observacao: o.observacao ?? null,
    previsao_inicio: it.previsao_inicio?.slice(0, 10) || null,
    previsao_fim: it.previsao_fim?.slice(0, 10) || null,
  };
}

export const fmtNum = (n: number) => (Math.round(n * 100) / 100).toString();

export function diasUteisDe(qtd: number, e: Pick<ObraEdit, "rendimento" | "dias_uteis">): number {
  if (e.dias_uteis != null) return e.dias_uteis;
  if (e.rendimento && e.rendimento > 0) return Math.ceil(qtd / e.rendimento);
  return 0;
}

export function statusPdfDe(it: { status: string; previsao_fim?: string | null }): "pendente" | "em_andamento" | "concluido" | "atrasado" {
  if (STATUS_CONCLUIDO.has(it.status)) return "concluido";
  const hoje = new Date().toISOString().slice(0, 10);
  if (it.previsao_fim && it.previsao_fim.slice(0, 10) < hoje && it.status !== "cancelado") return "atrasado";
  if (it.status === "em_execucao" || it.status === "preparando") return "em_andamento";
  return "pendente";
}

/** QUE FAZ: resolve o nome do produto pro header de grupo (ex: "CARVALHO EUROPEU · 15/3 × 19 × 190CM").
 *  Usa meta.produto_header quando existe (projetos hierárquicos); senão deriva das partes
 *  2 e 3 da categoria encoded "PISO||ESPECIE||DIM" (projetos de cópia crua/backfill,
 *  que sem isso mostravam header vazio). */
export function produtoHeaderDe(meta: any, categoria?: string | null): string {
  if (meta?.produto_header) return String(meta.produto_header);
  const enc = String(meta?.categoria_encoded || categoria || "");
  if (!enc.includes("||")) return "";
  const partes = enc.split("||");
  const especie = (partes[1] || "").trim();
  const dim = (partes[2] || "").trim();
  return [especie, dim].filter(Boolean).join(" · ");
}

export function itemServicoLabel(it: Item): string {
  const cod = (it.meta as any)?.codigo;
  let desc = it.descritivo || "";
  // descritivo seedado já vem como "2.1 · PRODUTO" — não repetir o código
  if (cod && desc.startsWith(cod)) desc = desc.slice(cod.length).replace(/^\s*[·\-—.]\s*/, "");
  const amb = it.ambiente ? ` — ${it.ambiente}` : "";
  return `${cod ? cod + " " : ""}${desc}${amb}`;
}

/** Monta o input do PDF (usado pela aba interna e pela página pública). */
export function montarPdfInput(opts: {
  projeto: { cliente: string; endereco?: string | null; obra_code?: string | null; vendedor?: string | null; gestor_email?: string | null };
  acomp: ObraAcompanhamento | null;
  itens: Item[];
  fotos: FotoObra[];
  prestadores: { nome: string; categoria?: string | null }[];
}) {
  const { projeto, acomp, itens, fotos, prestadores } = opts;
  const pdfItens: CronogramaItem[] = itens
    .filter(i => i.status !== "cancelado")
    .map(i => {
      const e = obraFromMeta(i);
      const inst = e.qtd_instalada ?? 0;
      return {
        servico: itemServicoLabel(i),
        servico_id: i.id,
        quantidade: Number(i.quantidade) || 0,
        unidade: i.unidade || "un",
        instalado: inst,
        pendente: Math.max((Number(i.quantidade) || 0) - inst, 0),
        dias_uteis: diasUteisDe(Number(i.quantidade) || 0, e),
        rendimento: e.rendimento ?? undefined,
        status: statusPdfDe(i),
      };
    });
  const medias: CronogramaMedia[] = fotos.map(f => ({
    url: f.url,
    type: (f.tipo === "video" ? "video" : "image") as "image" | "video",
    description: f.legenda || undefined,
    ambiente: f.ambiente || undefined,
    categoria: f.categoria || (f.item_id
      ? itens.find(i => i.id === f.item_id)?.descritivo
      : undefined) || undefined,
    date: f.created_at,
  }));
  const alertas = (acomp?.alertas || []).map(a => ({
    tipo: (["pendencia_obra", "atraso_parket", "outros"].includes(a.tipo) ? a.tipo : "outros") as any,
    motivo: a.motivo,
    data: a.data || "",
    status: "aberto" as const,
  }));
  return {
    cliente: projeto.cliente,
    vendedor: projeto.vendedor || undefined,
    responsavel: projeto.gestor_email || undefined,
    endereco: projeto.endereco || undefined,
    equipe: prestadores.length ? prestadores.map(p => p.nome).join(", ") : undefined,
    descricao_produto: acomp?.descricao_produto || undefined,
    obra: projeto.obra_code || undefined,
    itens: pdfItens,
    alertas,
    previsao_inicio: acomp?.inicio_obra || undefined,
    data_entrega: acomp?.previsao_entrega_manual || undefined,
    medias,
  };
}

/* ═══════════════════════ PAINEL PRINCIPAL ═══════════════════════ */

export default function ObraAcompanhamentoPanel({ projetoId, projeto, equipes, prestadores, t, fallbackInicio = "", fallbackTermino = "" }: {
  projetoId: string; projeto: P; equipes: EquipeParket[];
  prestadores: PrestadorVinculado[]; t: any;
  fallbackInicio?: string; fallbackTermino?: string;
}) {
  const [acomp, setAcomp] = useState<ObraAcompanhamento | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [fotos, setFotos] = useState<FotoObra[]>([]);
  const [inbox, setInbox] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // Dados gerais (form local)
  const [inicioObra, setInicioObra] = useState("");
  const [previsaoEntrega, setPrevisaoEntrega] = useState("");
  const [descProduto, setDescProduto] = useState("");
  const [alertas, setAlertas] = useState<ObraAlerta[]>([]);
  const [shareUrl, setShareUrl] = useState<string>("");

  // Edições por item + dirty tracking
  const [edits, setEdits] = useState<Record<string, ObraEdit>>({});
  const [statusEdits, setStatusEdits] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [geralDirty, setGeralDirty] = useState(false);

  // Solicitação de compras (modal controlado aqui pra abrir do botão do topo)
  const [comprasModal, setComprasModal] = useState(false);

  // Fotos UI
  const [fotoItemFiltro, setFotoItemFiltro] = useState<string>("");
  const [fotoOrigemFiltro, setFotoOrigemFiltro] = useState<string>("");
  const [uploadItem, setUploadItem] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [inboxAberta, setInboxAberta] = useState(false);
  const [adotarItem, setAdotarItem] = useState<string>("");
  const [centerAviso, setCenterAviso] = useState<string | null>(null);
  const centerAvisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisarCenter = (msg: string) => {
    setCenterAviso(msg);
    if (centerAvisoTimer.current) clearTimeout(centerAvisoTimer.current);
    centerAvisoTimer.current = setTimeout(() => setCenterAviso(null), 3200);
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      api.acompanhamento(projetoId).catch(() => null),
      api.itens(projetoId).catch(() => [] as Item[]),
      api.fotosObra(projetoId).catch(() => [] as FotoObra[]),
      api.projetoFotos(projetoId).catch(() => [] as Foto[]),
    ]).then(([a, its, fs, inb]) => {
      setAcomp(a);
      setItens(its);
      setFotos(fs);
      setInbox(inb);
      setInicioObra(a?.inicio_obra?.slice(0, 10) || "");
      setPrevisaoEntrega(a?.previsao_entrega_manual?.slice(0, 10) || "");
      setDescProduto(a?.descricao_produto || "");
      setAlertas(a?.alertas || []);
      setShareUrl(a?.share_token ? `https://gestao.parket.works/obra/${a.share_token}` : "");
      const e: Record<string, ObraEdit> = {};
      const s: Record<string, string> = {};
      for (const it of its) { e[it.id] = obraFromMeta(it); s[it.id] = it.status; }
      setEdits(e);
      setStatusEdits(s);
      setDirty(new Set());
      setGeralDirty(false);
    }).finally(() => setLoading(false));
  };
  useEffect(load, [projetoId]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const setEdit = (id: string, patch: Partial<ObraEdit>) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setDirty(prev => new Set(prev).add(id));
  };
  const setStatus = (id: string, st: string) => {
    setStatusEdits(prev => ({ ...prev, [id]: st }));
    setDirty(prev => new Set(prev).add(id));
  };

  // Monta o PATCH do item a partir do estado local (edits + status) —
  // usado tanto pelo salvar em lote quanto pelo auto-save inline.
  const buildItemPatch = (id: string) => {
    const e = edits[id];
    if (!e) return null;
    const patch: any = { meta: { obra: {
      rendimento: e.rendimento, equipe_id: e.equipe_id, equipe_nome: e.equipe_nome,
      qtd_instalada: e.qtd_instalada, dias_uteis: e.dias_uteis,
      observacao: e.observacao?.trim() || null,
    } } };
    if (statusEdits[id]) {
      patch.status = statusEdits[id];
      // transição pra status concluído carimba executado_em (alimenta data_finalizacao no /obras)
      const orig = itens.find(i => i.id === id);
      if (STATUS_CONCLUIDO.has(statusEdits[id]) && orig && !STATUS_CONCLUIDO.has(orig.status)) {
        patch.executado_em = new Date().toISOString().slice(0, 10);
      }
    }
    if (e.previsao_inicio) patch.previsao_inicio = e.previsao_inicio;
    if (e.previsao_fim) patch.previsao_fim = e.previsao_fim;
    return patch;
  };

  // Auto-save por item: dispara no onBlur/onChange dos campos inline.
  // Sem botão "Salvar" — a linha persiste sozinha assim que sai do campo.
  const [autoSaveMsg, setAutoSaveMsg] = useState<Record<string, "salvando" | "salvo" | "erro">>({});
  const autoSaveItem = async (id: string) => {
    if (!dirty.has(id)) return;
    const patch = buildItemPatch(id);
    if (!patch) return;
    setAutoSaveMsg(prev => ({ ...prev, [id]: "salvando" }));
    try {
      await api.itemPatch(id, patch);
      setDirty(prev => { const n = new Set(prev); n.delete(id); return n; });
      setAutoSaveMsg(prev => ({ ...prev, [id]: "salvo" }));
      setTimeout(() => setAutoSaveMsg(prev => { const n = { ...prev }; delete n[id]; return n; }), 1800);
      api.itens(projetoId).then(setItens).catch(() => {});
    } catch (err: any) {
      setAutoSaveMsg(prev => ({ ...prev, [id]: "erro" }));
      flash(`Erro ao salvar: ${err?.message || err}`);
    }
  };

  // Auto-save do bloco "Dados gerais" + alertas: debounce 800ms após qualquer edição.
  // geralDirty é o gatilho — setado por onChange dos inputs; resetado pelo save.
  const [autoSaveGeralMsg, setAutoSaveGeralMsg] = useState<"" | "salvando" | "salvo" | "erro">("");
  const geralSaveInFlight = useRef(false);
  useEffect(() => {
    if (loading || !geralDirty) return;
    const timer = setTimeout(async () => {
      if (geralSaveInFlight.current) return;
      geralSaveInFlight.current = true;
      setAutoSaveGeralMsg("salvando");
      try {
        const a = await api.acompanhamentoPut(projetoId, {
          inicio_obra: inicioObra || null,
          previsao_entrega_manual: previsaoEntrega || null,
          descricao_produto: descProduto || null,
          alertas,
        } as any);
        setAcomp(a);
        setGeralDirty(false);
        setAutoSaveGeralMsg("salvo");
        setTimeout(() => setAutoSaveGeralMsg(""), 1800);
      } catch (err: any) {
        setAutoSaveGeralMsg("erro");
        flash(`Erro ao salvar: ${err?.message || err}`);
      } finally {
        geralSaveInFlight.current = false;
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [geralDirty, inicioObra, previsaoEntrega, descProduto, alertas, loading, projetoId]);

  const gerarLink = async () => {
    try {
      const r = await api.acompanhamentoShare(projetoId);
      setShareUrl(r.url);
      try { await navigator.clipboard.writeText(r.url); flash("Link copiado pra área de transferência."); }
      catch { flash("Link gerado."); }
    } catch (err: any) {
      flash(`Erro ao gerar link: ${err?.message || err}`);
    }
  };

  const revogarLink = async () => {
    if (!confirm("Revogar o link público? Quem tiver o link atual perde o acesso.")) return;
    await api.acompanhamentoShareRevoke(projetoId).catch(() => {});
    setShareUrl("");
    flash("Link revogado.");
  };

  const gerarPdf = async () => {
    setGerandoPdf(true);
    try {
      // usa o estado local (inclui edições ainda não salvas)
      const itensAtuais = itens.map(it => ({
        ...it,
        status: statusEdits[it.id] || it.status,
        previsao_inicio: edits[it.id]?.previsao_inicio ?? it.previsao_inicio,
        previsao_fim: edits[it.id]?.previsao_fim ?? it.previsao_fim,
        meta: { ...(it.meta || {}), obra: edits[it.id] || obraFromMeta(it) },
      }));
      const input = montarPdfInput({
        projeto,
        acomp: {
          ...(acomp || ({} as ObraAcompanhamento)),
          inicio_obra: inicioObra || null,
          previsao_entrega_manual: previsaoEntrega || null,
          descricao_produto: descProduto || null,
          alertas,
        } as ObraAcompanhamento,
        itens: itensAtuais as Item[],
        fotos,
        prestadores,
      });
      await gerarCronogramaPdf(input);
    } catch (err: any) {
      flash(`Erro ao gerar PDF: ${err?.message || err}`);
    } finally {
      setGerandoPdf(false);
    }
  };

  const uploadFotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        await api.fotoObraUpload(projetoId, f, uploadItem ? { item_id: uploadItem } : undefined);
      }
      api.fotosObra(projetoId).then(setFotos).catch(() => {});
      flash(`${files.length} arquivo(s) enviado(s).`);
    } catch (err: any) {
      flash(`Erro no upload: ${err?.message || err}`);
    } finally {
      setUploading(false);
    }
  };

  const adotar = async (f: Foto) => {
    try {
      await api.fotoObraAdotar(projetoId, {
        fonte_id: f.id, url: f.url, item_id: adotarItem || null,
        legenda: f.descricao || f.servico || null, ambiente: f.ambiente || null,
        tipo: f.tipo || "foto",
      });
      api.fotosObra(projetoId).then(setFotos).catch(() => {});
      flash("Foto adotada pro acompanhamento.");
    } catch (err: any) {
      flash(`Erro ao adotar: ${err?.message || err}`);
    }
  };

  const itensAtivos = useMemo(() => itens.filter(i => i.status !== "cancelado"), [itens]);

  /* Agrupamento hierárquico por meta.codigo — mesma organização da antiga lista
     de Itens do Projeto (fusão das abas, Will 10/07):
       - codes "1.1", "1.2" → 1 raiz "1" + filhos diretos
       - codes "1.1.1", "1.2.1" → raiz "1" com sub-grupos "1.1"/"1.2" (pavimentos) */
  const agrupados = useMemo(() => {
    const cmpCodigo = (a: string, b: string) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d;
      }
      return 0;
    };
    const raizes = new Map<string, { direto: Item[]; filhosPor: Map<string, Item[]> }>();
    for (const it of itensAtivos) {
      const cod: string = (it.meta as any)?.codigo || String(it.ordem);
      const parts = cod.split(".");
      const raiz = parts[0];
      const grupo = raizes.get(raiz) || { direto: [] as Item[], filhosPor: new Map<string, Item[]>() };
      if (parts.length >= 3) {
        // sub-item (ex: 3.6.1 é filho de 3.6) — vai pro filhosPor sob o pai
        const parentCod = `${parts[0]}.${parts[1]}`;
        const arr = grupo.filhosPor.get(parentCod) || [];
        arr.push(it);
        grupo.filhosPor.set(parentCod, arr);
      } else {
        grupo.direto.push(it);
      }
      raizes.set(raiz, grupo);
    }
    return Array.from(raizes.entries())
      .sort(([a], [b]) => cmpCodigo(a, b))
      .map(([raiz, g]) => {
        const direto = g.direto.slice().sort((x, y) =>
          cmpCodigo((x.meta as any)?.codigo || "", (y.meta as any)?.codigo || ""));
        // Ordena filhos internos por código
        for (const [k, arr] of g.filhosPor) {
          arr.sort((x, y) => cmpCodigo((x.meta as any)?.codigo || "", (y.meta as any)?.codigo || ""));
          g.filhosPor.set(k, arr);
        }
        const primeiro = direto[0];
        const metaFonte: any = primeiro?.meta || {};
        const categoriaRaiz = (metaFonte.categoria_raiz || primeiro?.categoria?.split("||")[0] || "").toUpperCase();
        const produtoRaiz = produtoHeaderDe(metaFonte, primeiro?.categoria);
        return [raiz, direto, g.filhosPor, categoriaRaiz, produtoRaiz] as
          [string, Item[], Map<string, Item[]>, string, string];
      });
  }, [itensAtivos]);
  const kpis = useMemo(() => {
    let dias = 0, qtdTotal = 0, instTotal = 0;
    for (const it of itensAtivos) {
      const e = edits[it.id] || obraFromMeta(it);
      dias += diasUteisDe(Number(it.quantidade) || 0, e);
      qtdTotal += Number(it.quantidade) || 0;
      instTotal += e.qtd_instalada ?? 0;
    }
    return {
      servicos: itensAtivos.length,
      dias,
      pctInstalado: qtdTotal > 0 ? Math.round((instTotal / qtdTotal) * 100) : 0,
      alertas: alertas.length,
      fotos: fotos.length,
    };
  }, [itensAtivos, edits, alertas, fotos]);

  const fonteAdotadas = useMemo(() => new Set(fotos.map(f => f.fonte_id).filter(Boolean)), [fotos]);
  const inboxPendentes = useMemo(() => inbox.filter(f => !fonteAdotadas.has(f.id)), [inbox, fonteAdotadas]);
  const fotosFiltradas = useMemo(() => fotos.filter(f =>
    (!fotoItemFiltro || f.item_id === fotoItemFiltro) &&
    (!fotoOrigemFiltro || (f.origem || "upload") === fotoOrigemFiltro)
  ), [fotos, fotoItemFiltro, fotoOrigemFiltro]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: t.textTertiary, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
        carregando acompanhamento…
      </div>
    );
  }

  const th: React.CSSProperties = {
    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em", textTransform: "uppercase",
    color: t.textTertiary, padding: "8px 8px", textAlign: "left", borderBottom: `1px solid ${t.border1}`,
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "6px 8px", borderBottom: `1px solid ${t.border1}`, fontSize: 11,
    color: t.textPrimary, verticalAlign: "middle",
  };
  const numInput: React.CSSProperties = {
    ...inputStyle(t), width: 64, padding: "5px 6px", fontSize: 11, textAlign: "right",
  };
  const selStyle: React.CSSProperties = { ...inputStyle(t), padding: "5px 6px", fontSize: 10 };
  const dateInput = (own: string | null, fallback: string, onChange: (v: string | null) => void) => {
    const shown = own || fallback || "";
    const inheriting = !own && !!fallback;
    return (
      <input type="date" value={shown}
        onChange={ev => onChange(ev.target.value || null)}
        style={{
          ...inputStyle(t), width: 118, padding: "5px 6px", fontSize: 10,
          fontVariantNumeric: "tabular-nums" as any,
          colorScheme: (t.bg === "#0a0a0a" || t.bg === "#050505") ? "dark" : "light",
          opacity: inheriting ? 0.7 : 1,
          borderStyle: inheriting ? "dashed" : "solid",
        }}
        title={inheriting ? "Herdado do cronograma da obra" : (shown || "sem data")} />
    );
  };

  const linhaItem = (it: Item, sub: boolean) => {
    const e = edits[it.id] || obraFromMeta(it);
    const qtd = Number(it.quantidade) || 0;
    const inst = e.qtd_instalada ?? 0;
    const pend = Math.max(qtd - inst, 0);
    const st = statusEdits[it.id] || it.status;
    const isDirty = dirty.has(it.id);
    const meta: any = it.meta || {};
    const soMaterial = meta.so_material === true;
    const isRecorteAgg = meta.is_recorte_agregado === true;
    return (
      <tr key={it.id} style={{ background: isDirty ? (t.card2 || "rgba(199,164,91,0.06)") : "transparent" }}>
        <td style={{ ...td, maxWidth: 340, paddingLeft: sub ? 28 : 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }} title={itemServicoLabel(it)}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
              {itemServicoLabel(it)}
            </span>
            {soMaterial && !isRecorteAgg && (
              <span title="Fornecimento sem instalação/gestão da Parket" style={{
                fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase",
                padding: "2px 6px", background: "rgba(199,164,91,0.15)", color: "#C7A45B",
                border: "1px solid #C7A45B", whiteSpace: "nowrap", flexShrink: 0,
              }}>SÓ MATERIAL</span>
            )}
            {isRecorteAgg && Array.isArray(meta.recortes) && (
              <span title={meta.recortes.map((r: any) => `${r.qtd} ${r.unidade} · ${r.nome}`).join("\n")} style={{
                fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase",
                padding: "2px 6px", background: "rgba(150,132,115,0.15)", color: t.textSecondary,
                border: `1px solid ${t.border2 || t.border1}`, whiteSpace: "nowrap", flexShrink: 0, cursor: "help",
              }}>{meta.recortes.length} recortes</span>
            )}
          </div>
        </td>
        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" as any, whiteSpace: "nowrap" }}>
          {fmtNum(qtd)} {it.unidade}
        </td>
        <td style={{ ...td, textAlign: "right", position: "relative" }}>
          <input type="number" min={0} step="any" value={e.qtd_instalada ?? ""}
            onChange={ev => setEdit(it.id, { qtd_instalada: ev.target.value === "" ? null : Number(ev.target.value) })}
            onBlur={() => autoSaveItem(it.id)}
            style={numInput} placeholder="0" />
          {autoSaveMsg[it.id] && (
            <span style={{
              position: "absolute", top: "50%", right: -22, transform: "translateY(-50%)",
              fontSize: 9, letterSpacing: "0.12em",
              color: autoSaveMsg[it.id] === "erro" ? "#C7625B"
                : autoSaveMsg[it.id] === "salvo" ? "#7BA394" : t.textTertiary,
            }}>{autoSaveMsg[it.id] === "salvando" ? "…" : autoSaveMsg[it.id] === "salvo" ? "✓" : "!"}</span>
          )}
        </td>
        <td style={{
          ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" as any,
          color: pend > 0 ? "#C7A45B" : "#7BA394", whiteSpace: "nowrap",
        }}>
          {fmtNum(pend)} {it.unidade}
        </td>
        <td style={td}>
          {dateInput(e.previsao_inicio, fallbackInicio, v => { setEdit(it.id, { previsao_inicio: v }); setTimeout(() => autoSaveItem(it.id), 0); })}
        </td>
        <td style={td}>
          {dateInput(e.previsao_fim, fallbackTermino, v => { setEdit(it.id, { previsao_fim: v }); setTimeout(() => autoSaveItem(it.id), 0); })}
        </td>
        <td style={td}>
          <select value={e.equipe_id || ""}
            onChange={ev => {
              const eq = equipes.find(q => q.id === ev.target.value);
              setEdit(it.id, { equipe_id: eq?.id || null, equipe_nome: eq?.nome || null });
              setTimeout(() => autoSaveItem(it.id), 0);
            }}
            style={{ ...selStyle, maxWidth: 160 }}>
            <option value="">— equipe —</option>
            {e.equipe_id && !equipes.some(q => q.id === e.equipe_id) && (
              <option value={e.equipe_id}>{e.equipe_nome || "equipe"}</option>
            )}
            {equipes.map(q => (
              <option key={q.id} value={q.id}>{q.nome}</option>
            ))}
          </select>
        </td>
        <td style={td}>
          <select value={st}
            onChange={ev => { setStatus(it.id, ev.target.value); setTimeout(() => autoSaveItem(it.id), 0); }}
            style={{ ...selStyle, maxWidth: 130 }}>
            {STATUS_ITEM.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
            ))}
          </select>
        </td>
        <td style={td}>
          <input value={e.observacao ?? ""}
            onChange={ev => setEdit(it.id, { observacao: ev.target.value || null })}
            onBlur={() => autoSaveItem(it.id)}
            placeholder="Observação…"
            title={e.observacao || "Observação interna do item (não sai no PDF)"}
            style={{ ...inputStyle(t), width: 180, padding: "5px 6px", fontSize: 10 }} />
        </td>
      </tr>
    );
  };

  return (
    <div>
      {/* ─── Barra de ações ─── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 8, flexWrap: "wrap", marginBottom: 12,
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.24em",
          textTransform: "uppercase", color: t.textSecondary, fontWeight: 500,
        }}>
          Acompanhamento de Obras
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {msg && (
            <span style={{ fontSize: 10, color: t.accent, letterSpacing: "0.06em" }}>{msg}</span>
          )}
          {autoSaveGeralMsg && (
            <span style={{
              fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
              color: autoSaveGeralMsg === "erro" ? "#C7625B"
                : autoSaveGeralMsg === "salvo" ? "#7BA394" : t.textTertiary,
            }}>
              {autoSaveGeralMsg === "salvando" ? "salvando…" : autoSaveGeralMsg === "salvo" ? "✓ salvo" : "! erro"}
            </span>
          )}
          <button onClick={gerarPdf} disabled={gerandoPdf} style={btnGhost(t)}>
            {gerandoPdf ? "Gerando PDF…" : "Gerar PDF"}
          </button>
          <button onClick={() => setComprasModal(true)} style={btnGhost(t)}>
            Solicitar compras
          </button>
          {shareUrl ? (
            <>
              <button onClick={() => { navigator.clipboard.writeText(shareUrl).then(() => flash("Link copiado.")); }}
                style={btnGhost(t)} title={shareUrl}>
                Copiar link
              </button>
              <button onClick={revogarLink} style={{ ...btnGhost(t), color: "#B85B4C" }}>Revogar</button>
            </>
          ) : (
            <button onClick={gerarLink} style={btnGhost(t)}>Gerar link</button>
          )}
        </div>
      </div>

      {shareUrl && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", background: t.card1, border: `1px solid ${t.border1}`,
          fontSize: 10, color: t.textSecondary, letterSpacing: "0.04em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          Link público:{" "}
          <a href={shareUrl} target="_blank" rel="noreferrer" style={{ color: t.accent }}>{shareUrl}</a>
        </div>
      )}

      {/* ─── KPIs ─── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
        padding: "12px 16px", background: t.card1, border: `1px solid ${t.border1}`, marginBottom: 14,
      }}>
        <MiniStat label="Serviços" v={kpis.servicos} t={t} />
        <MiniStat label="Dias úteis totais" v={kpis.dias} t={t} />
        <MiniStat label="Instalado" v={`${kpis.pctInstalado}%`} t={t} corValor="#7BA394" />
        <MiniStat label="Alertas" v={kpis.alertas} t={t} corValor={kpis.alertas > 0 ? "#B85B4C" : undefined} />
        <MiniStat label="Fotos" v={kpis.fotos} t={t} corValor="#C7A45B" />
      </div>

      {/* ─── Dados gerais ─── */}
      <div style={{
        display: "grid", gridTemplateColumns: "160px 160px 1fr", gap: 10,
        padding: "12px 16px", background: t.card1, border: `1px solid ${t.border1}`, marginBottom: 14,
      }}>
        <div>
          <FieldLabel t={t}>Início da obra</FieldLabel>
          <input type="date" value={inicioObra}
            onChange={e => { setInicioObra(e.target.value); setGeralDirty(true); }}
            style={{ ...inputStyle(t), width: "100%" }} />
        </div>
        <div>
          <FieldLabel t={t}>Previsão de entrega (manual)</FieldLabel>
          <input type="date" value={previsaoEntrega}
            onChange={e => { setPrevisaoEntrega(e.target.value); setGeralDirty(true); }}
            style={{ ...inputStyle(t), width: "100%" }} />
        </div>
        <div>
          <FieldLabel t={t}>Descrição do produto (aparece no PDF)</FieldLabel>
          <input value={descProduto}
            onChange={e => { setDescProduto(e.target.value); setGeralDirty(true); }}
            placeholder="Ex: Piso de madeira maciça Cumaru 15cm, rodapés e escada…"
            style={{ ...inputStyle(t), width: "100%" }} />
        </div>
      </div>

      {/* ─── Cronograma por item (agrupado por produto/pavimento, como a lista de itens) ─── */}
      <div style={{ background: t.card1, border: `1px solid ${t.border1}`, marginBottom: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1260 }}>
          <thead>
            <tr>
              <th style={th}>Serviço (item da proposta)</th>
              <th style={{ ...th, textAlign: "right" }}>Contratado</th>
              <th style={{ ...th, textAlign: "right" }}>Instalado</th>
              <th style={{ ...th, textAlign: "right" }}>Pendente</th>
              <th style={th}>Início</th>
              <th style={th}>Término</th>
              <th style={th}>Equipe</th>
              <th style={th}>Status</th>
              <th style={th}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {agrupados.map(([raiz, direto, filhosPor, categoriaRaiz, produtoRaiz]) => (
              <React.Fragment key={raiz}>
                <GroupRow codigo={raiz} categoria={categoriaRaiz} label={produtoRaiz} nivel={0} t={t} />
                {direto.map(it => {
                  const cod = (it.meta as any)?.codigo || "";
                  const filhos = filhosPor.get(cod);
                  return (
                    <React.Fragment key={it.id}>
                      {linhaItem(it, false)}
                      {filhos?.map(f => linhaItem(f, true))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
            {itensAtivos.length === 0 && (
              <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: t.textTertiary, padding: 24, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                Projeto sem itens
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Alertas ─── */}
      <AlertasSection t={t} alertas={alertas}
        onChange={(next) => { setAlertas(next); setGeralDirty(true); }} />

      {/* ─── Solicitações de Compras (cards no kanban de compras.parket.works) ─── */}
      <SolicitacoesComprasSection projetoId={projetoId} projeto={projeto} t={t}
        modal={comprasModal} setModal={setComprasModal} />

      {/* ─── Registro fotográfico ─── */}
      {centerAviso && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 400, padding: "10px 18px", background: "#C7A45B", color: "#1A1408",
          fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.14em",
          boxShadow: "0 4px 18px rgba(0,0,0,0.35)", maxWidth: "min(92vw, 640px)",
          textTransform: "uppercase",
        }}>
          {centerAviso}
        </div>
      )}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        margin: "18px 0 8px", gap: 8, flexWrap: "wrap",
      }}>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.24em",
          textTransform: "uppercase", color: t.textSecondary, fontWeight: 500,
        }}>
          Registro fotográfico ({fotos.length})
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={fotoOrigemFiltro} onChange={e => setFotoOrigemFiltro(e.target.value)} style={selStyle}
            title="Filtrar por origem da foto">
            <option value="">Todas as origens</option>
            <option value="fiscal">Fiscal</option>
            <option value="instala">Instalador</option>
            <option value="upload">Gestão</option>
          </select>
          <select value={fotoItemFiltro} onChange={e => setFotoItemFiltro(e.target.value)} style={selStyle}>
            <option value="">Todas as fotos</option>
            {itensAtivos.map(it => (
              <option key={it.id} value={it.id}>{itemServicoLabel(it).slice(0, 60)}</option>
            ))}
          </select>
          <select value={uploadItem} onChange={e => setUploadItem(e.target.value)} style={selStyle}
            title="Item de destino do upload">
            <option value="">Upload sem item</option>
            {itensAtivos.map(it => (
              <option key={it.id} value={it.id}>→ {itemServicoLabel(it).slice(0, 55)}</option>
            ))}
          </select>
          <label style={{ ...btnAccent(t), cursor: uploading ? "wait" : "pointer", display: "inline-block" }}>
            {uploading ? "Enviando…" : "+ Enviar fotos"}
            <input type="file" multiple accept="image/*,video/mp4,video/quicktime,video/webm"
              disabled={uploading}
              onChange={e => { uploadFotos(e.target.files); e.target.value = ""; }}
              style={{ display: "none" }} />
          </label>
          <button onClick={() => setInboxAberta(v => !v)} style={btnGhost(t)}>
            Inbox do fiscal ({inboxPendentes.length})
          </button>
          <a href={`/acompanhamento?projeto=${projetoId}`} style={{ ...btnGhost(t), textDecoration: "none", display: "inline-block" }}
            title="Curadoria do InstaParket — selecionar mídias deste perfil e publicar">
            Postar no InstaParket
          </a>
        </div>
      </div>

      {/* Inbox fiscal — fotos enviadas na obra, pra gestora adotar por item */}
      {inboxAberta && (
        <div style={{ background: t.card1, border: `1px solid ${t.border2}`, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: t.textTertiary }}>
              Adotar para o item:
            </span>
            <select value={adotarItem} onChange={e => setAdotarItem(e.target.value)} style={{ ...selStyle, maxWidth: 320 }}>
              <option value="">— sem item (geral) —</option>
              {itensAtivos.map(it => (
                <option key={it.id} value={it.id}>{itemServicoLabel(it).slice(0, 60)}</option>
              ))}
            </select>
          </div>
          {inboxPendentes.length === 0 ? (
            <div style={{ padding: 14, textAlign: "center", fontSize: 10, letterSpacing: "0.18em", color: t.textTertiary, textTransform: "uppercase" }}>
              Nenhuma foto nova do fiscal
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
              {inboxPendentes.map(f => {
                const isVideo = (f.tipo || "").toLowerCase() === "video" || /\.(mp4|mov|webm)$/i.test(f.url);
                return (
                  <div key={f.id} style={{ background: t.card2, border: `1px solid ${t.border1}` }}>
                    <a href={f.url} target="_blank" rel="noreferrer" style={{ display: "block", aspectRatio: "4/3", overflow: "hidden" }}>
                      {isVideo ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.2em", color: t.textSecondary }}>
                          [VÍDEO]
                        </div>
                      ) : (
                        <img src={midiaThumb(f.url)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      )}
                    </a>
                    <div style={{ padding: "4px 6px", fontSize: 9, color: t.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.ambiente || f.descricao || f.servico || "—"}
                    </div>
                    <button onClick={() => adotar(f)}
                      style={{ ...btnAccent(t), width: "100%", padding: "5px 0", fontSize: 8 }}>
                      Adotar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Grid das fotos do acompanhamento */}
      {fotosFiltradas.length === 0 ? (
        <div style={{
          background: t.card1, border: `1px dashed ${t.border1}`, padding: "18px 16px",
          textAlign: "center", fontSize: 10, letterSpacing: "0.20em", color: t.textTertiary,
          textTransform: "uppercase", marginBottom: 18,
        }}>
          Nenhuma foto no acompanhamento
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 8, marginBottom: 18,
        }}>
          {fotosFiltradas.map(f => {
            const isVideo = f.tipo === "video" || /\.(mp4|mov|webm)$/i.test(f.url);
            const itemDo = f.item_id ? itens.find(i => i.id === f.item_id) : null;
            return (
              <div key={f.id} style={{ background: t.card1, border: `1px solid ${t.border1}` }}>
                <a href={f.url} target="_blank" rel="noreferrer"
                  style={{ display: "block", position: "relative", aspectRatio: "4/3", overflow: "hidden", background: t.card2 }}>
                  {isVideo ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.2em", color: t.textSecondary }}>
                      [VÍDEO]
                    </div>
                  ) : (
                    <img src={midiaThumb(f.url)} alt={f.legenda || ""} loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                  <span style={{
                    position: "absolute", bottom: 4, left: 4, right: 30, padding: "2px 6px",
                    background: "rgba(0,0,0,0.62)", color: "#C7A45B",
                    fontFamily: fonts.cinzel, fontSize: 7, letterSpacing: "0.16em", textTransform: "uppercase",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "fit-content", maxWidth: "calc(100% - 38px)",
                  }}>{quemDaFoto(f)}</span>
                  <button
                    onClick={async ev => {
                      ev.preventDefault(); ev.stopPropagation();
                      const ligando = !f.center_visivel;
                      await api.fotoObraPatch(f.id, { center_visivel: ligando }).catch(() => {});
                      api.fotosObra(projetoId).then(setFotos).catch(() => {});
                      const itemF = f.item_id ? itens.find(i => i.id === f.item_id) : null;
                      const rotulo = itemF ? itemServicoLabel(itemF).slice(0, 48) : "a obra";
                      avisarCenter(ligando
                        ? `✓ Foto enviada pra Central do Cliente — Acompanhamento da Instalação (${rotulo})`
                        : "Foto removida da Central do Cliente");
                    }}
                    title={f.center_visivel
                      ? "Selecionada pra Central do Cliente — clique pra tirar"
                      : "Selecionar pra Central do Cliente"}
                    style={{
                      position: "absolute", top: 6, right: 6, width: 22, height: 22,
                      borderRadius: "50%", padding: 0,
                      border: `2px solid ${f.center_visivel ? "#C7A45B" : "rgba(255,255,255,0.85)"}`,
                      background: f.center_visivel ? "#C7A45B" : "rgba(0,0,0,0.35)",
                      color: "#1A1408", fontSize: 13, fontWeight: 700, lineHeight: 1,
                      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    }}>{f.center_visivel ? "✓" : ""}</button>
                </a>
                <div style={{ padding: "6px 8px" }}>
                  {(() => {
                    const bruta = f.legenda || f.ambiente || "—";
                    const titulo = f.origem === "instala" ? bruta.split(" — ")[0].trim() || bruta : bruta;
                    const finalizado = /ambiente finalizado/i.test(f.legenda || "");
                    return (
                      <>
                        <div title={bruta} style={{
                          fontSize: 10, lineHeight: 1.45, color: t.textPrimary, wordBreak: "break-word",
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                        }}>{titulo}</div>
                        {finalizado && (
                          <span style={{
                            display: "inline-block", marginTop: 3, padding: "1px 6px",
                            fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                            color: "#C7A45B", border: "1px solid rgba(199,164,91,0.45)",
                          }}>✓ Ambiente finalizado</span>
                        )}
                      </>
                    );
                  })()}
                  <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
                    <select value={f.item_id || ""}
                      onChange={async ev => {
                        await api.fotoObraPatch(f.id, { item_id: ev.target.value || null } as any).catch(() => {});
                        api.fotosObra(projetoId).then(setFotos).catch(() => {});
                      }}
                      style={{ ...selStyle, flex: 1, fontSize: 9, padding: "3px 4px" }}
                      title={itemDo ? itemServicoLabel(itemDo) : "Sem item"}>
                      <option value="">sem item</option>
                      {itensAtivos.map(it => (
                        <option key={it.id} value={it.id}>{itemServicoLabel(it).slice(0, 45)}</option>
                      ))}
                    </select>
                    <button
                      onClick={async () => {
                        if (!confirm("Remover esta foto do acompanhamento?")) return;
                        await api.fotoObraDelete(f.id).catch(() => {});
                        api.fotosObra(projetoId).then(setFotos).catch(() => {});
                      }}
                      title="Remover"
                      style={{
                        background: "transparent", color: t.textTertiary, border: `1px solid ${t.border1}`,
                        padding: "2px 7px", fontFamily: fonts.cinzel, fontSize: 10, cursor: "pointer",
                      }}>×</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Header de grupo dentro da tabela — mesmo visual do GroupHeader da antiga
 *  lista de Itens do Projeto: "[código] · [CATEGORIA] · [produto/pavimento]". */
function GroupRow({ codigo, categoria, label, nivel, t }: {
  codigo: string; categoria: string; label: string; nivel: 0 | 1; t: any;
}) {
  const isRaiz = nivel === 0;
  const sep = <span style={{ color: t.textTertiary, fontSize: isRaiz ? 12 : 10, letterSpacing: "0.14em" }}>·</span>;
  return (
    <tr>
      <td colSpan={9} style={{
        padding: isRaiz ? "16px 8px 6px 8px" : "10px 8px 4px 24px",
        borderBottom: `1px solid ${t.border1}`,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{
            fontFamily: fonts.cinzel, fontVariantNumeric: "tabular-nums" as any,
            fontSize: isRaiz ? 15 : 12, letterSpacing: "0.12em",
            color: isRaiz ? t.textPrimary : t.textSecondary,
          }}>
            {codigo}
          </span>
          {categoria && (
            <>
              {sep}
              <span style={{
                fontFamily: fonts.cinzel,
                fontSize: isRaiz ? 11 : 9, letterSpacing: "0.22em",
                textTransform: "uppercase", color: t.accent,
              }}>
                {categoria}
              </span>
            </>
          )}
          {sep}
          <span style={{
            fontFamily: fonts.cinzel,
            fontSize: isRaiz ? 12 : 10, letterSpacing: isRaiz ? "0.18em" : "0.16em",
            textTransform: "uppercase",
            color: isRaiz ? t.textPrimary : t.textSecondary,
          }}>
            {label || "—"}
          </span>
        </div>
      </td>
    </tr>
  );
}

/* ═══════════════════════ ALERTAS ═══════════════════════ */

function AlertasSection({ t, alertas, onChange }: {
  t: any; alertas: ObraAlerta[]; onChange: (next: ObraAlerta[]) => void;
}) {
  const [tipo, setTipo] = useState("pendencia_obra");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");

  const label = (tp: string) => ALERTA_TIPOS.find(([k]) => k === tp)?.[1] || tp;

  return (
    <div style={{ background: t.card1, border: `1px solid ${t.border1}`, padding: 12, marginBottom: 4 }}>
      <div style={{
        fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em",
        textTransform: "uppercase", color: alertas.length ? "#B85B4C" : t.textTertiary, marginBottom: 10,
      }}>
        Alertas de atraso ({alertas.length})
      </div>

      {alertas.map((a, i) => (
        <div key={i} style={{
          display: "flex", gap: 10, alignItems: "center", padding: "7px 10px",
          background: t.card2, border: `1px solid ${t.border1}`, borderLeft: "3px solid #B85B4C",
          marginBottom: 6,
        }}>
          <span style={{ fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B85B4C", whiteSpace: "nowrap" }}>
            {label(a.tipo)}
          </span>
          <span style={{ fontSize: 10, color: t.textTertiary, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" as any }}>
            {a.data ? new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
          </span>
          <span style={{ fontSize: 11, color: t.textPrimary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.motivo}
          </span>
          <button onClick={() => onChange(alertas.filter((_, j) => j !== i))}
            title="Remover alerta"
            style={{
              background: "transparent", color: t.textTertiary, border: `1px solid ${t.border1}`,
              padding: "2px 8px", fontFamily: fonts.cinzel, fontSize: 10, cursor: "pointer",
            }}>×</button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...inputStyle(t), padding: "6px 8px", fontSize: 10 }}>
          {ALERTA_TIPOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={data} onChange={e => setData(e.target.value)}
          style={{ ...inputStyle(t), padding: "6px 8px", fontSize: 10 }} />
        <input value={motivo} onChange={e => setMotivo(e.target.value)}
          placeholder="Motivo do alerta…"
          style={{ ...inputStyle(t), flex: 1, minWidth: 200, padding: "6px 8px", fontSize: 11 }} />
        <button
          onClick={() => {
            if (!motivo.trim()) return;
            onChange([...alertas, { tipo, data, motivo: motivo.trim() }]);
            setMotivo("");
          }}
          disabled={!motivo.trim()}
          style={{ ...btnGhost(t), opacity: motivo.trim() ? 1 : 0.5 }}>
          + Alerta
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children, t }: { children: any; t: any }) {
  return (
    <div style={{
      fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.20em",
      textTransform: "uppercase", color: t.textTertiary, marginBottom: 5,
    }}>{children}</div>
  );
}
