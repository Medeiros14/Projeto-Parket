import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, AlertCircle, RefreshCw, Flag, FileText, BookOpen, X, Users, PenLine, Package } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { BottomNav } from "../app/components/BottomNav";
import { DitadoBtn } from "../app/components/Ditado";
import { submitOrQueue, listQueue, onQueueChange, jobNeedsAttention } from "../lib/offline";
import { loadFichas, fichasDoItem, type Ficha } from "../lib/fichas";
import { confirmar } from "../lib/confirmar";
import { Markdown } from "../app/components/Markdown";
import { ProjetoObra, type MapaPagina } from "../app/components/ProjetoObra";
import { CameraCapture } from "../app/components/CameraCapture";

function slugify(nome: string) {
  return nome.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY = "'Inter', sans-serif";
const GESTAO_API = "https://gestao.parket.works";

const GESTAO_ST: Record<string, { label: string; cor: string }> = {
  pendente: { label: "pendente", cor: "#FBBF24" },
  em_execucao: { label: "executando", cor: "#60A5FA" },
  em_andamento: { label: "executando", cor: "#60A5FA" },
  entregue: { label: "finalizado", cor: "#34D399" },
  concluido: { label: "finalizado", cor: "#34D399" },
};

const itemFinalizado = (status: string | null | undefined) =>
  status === "entregue" || status === "concluido";

function fmtData(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const VIDEO_MAX_SEG = 180; // 3 minutos
const MIN_MIDIAS = 3; // fotos/vídeos obrigatórios pra finalizar um item

function videoDuracao(file: File): Promise<number> {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); res(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(v.src); rej(new Error("Não consegui ler o vídeo")); };
    v.src = URL.createObjectURL(file);
  });
}

async function validarMidia(file: File): Promise<"foto" | "video"> {
  if (!file.type.startsWith("video/")) return "foto";
  const dur = await videoDuracao(file);
  if (dur > VIDEO_MAX_SEG + 3) {
    throw new Error(`Vídeo de ${Math.round(dur / 60)} min. O máximo é 3 minutos. Grave um mais curto.`);
  }
  return "video";
}

function numerarModelos(items: GestaoItem[]): Map<string, string> {
  // Preserva meta.codigo quando existe. Pros importados sem código, agrupa por
  // (categoria_raiz+produto_header) — mesmo produto compartilha "N.M", casando
  // com a organização do fiscal e do gestão web.
  const catIdx = new Map<string, number>();
  const bucketNext = new Map<string, number>(); // raiz "N" -> próximo sufixo
  const bucketCode = new Map<string, string>(); // "CAT|PRODUTO" -> "N.M"
  const out = new Map<string, string>();
  for (const it of items) {
    if (it.meta?.codigo) { out.set(it.id, it.meta.codigo); continue; }
    const catRaw = (it.meta?.categoria_raiz || (it.categoria ?? "").split("||")[0] || "GERAL");
    const cat = String(catRaw).trim().toUpperCase() || "GERAL";
    const prod = String(it.meta?.produto_header || it.descritivo || "").trim();
    const bkey = `${cat}|${prod}`;
    if (!bucketCode.has(bkey)) {
      if (!catIdx.has(cat)) catIdx.set(cat, catIdx.size + 1);
      const raiz = String(catIdx.get(cat));
      const sub = (bucketNext.get(raiz) ?? 0) + 1;
      bucketNext.set(raiz, sub);
      bucketCode.set(bkey, `${raiz}.${sub}`);
    }
    out.set(it.id, bucketCode.get(bkey)!);
  }
  return out;
}

type Obra = {
  card_id: string;
  obra_code: string | null;
  cliente_nome: string;
  cidade: string | null;
  progress_atual: number | null;
  observacao: string | null;
};

type Item = {
  servico_id: string;
  obra_id: string;
  descricao: string;
  unidade: string;
  contrato_qtd: number;
  qtd_instalada: number;
  pct_concluido: number;
  ordem: number | null;
  midias?: number;
};

function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function textoDoItem(item: GestaoItem): string {
  return [
    item.meta?.categoria_raiz, item.categoria, item.meta?.produto_header, item.descritivo,
  ].filter(Boolean).join(" ");
}

type GestaoItem = {
  id: string;
  ordem: number | null;
  categoria: string | null;
  descritivo: string | null;
  ambiente: string | null;
  quantidade: number | null;
  unidade: string | null;
  status: string | null;
  meta: any;
  previsao_inicio: string | null;
  previsao_fim: string | null;
  executado_em: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  midias?: number;
};

// Envio de progresso na fila de validação do fiscal (gestao.eventos, payload.fiscal).
// fiscal = null é envio legado, anterior à validação: não mostra nada pro instalador.
type PvEnvio = {
  id: string;
  item_id: string;
  created_at: string;
  // Mídia que o instalador anexou nesse envio (o endpoint progresso-validacao já devolve;
  // alimenta a galeria "fotos que já chegaram" no card do item)
  midia_url?: string | null;
  midia_tipo?: string | null;
  // qtd_delta = quanto o instalador registrou naquele envio (m² feitos naquela hora);
  // alimenta a linha "07/09 30m² · 08/09 20m²" abaixo da barra do item (pedido do Will
  // 08/09: ele quer ver o dia a dia do que foi feito no item)
  qtd_delta?: number | null;
  prestador_nome?: string | null;
  finalizado?: boolean;
  fiscal: { status: string; nome?: string; motivo?: string; foto_url?: string; em?: string } | null;
};

// Modo somente-leitura do card de item: "consulta" = abriu pela lista de Obras (?ver=1),
// "checkin" = ainda não registrou a chegada de hoje (mostra hint em vez de sumir os botões)
type ReadOnlyMode = false | "consulta" | "checkin";

type GestaoDatas = {
  inicio_obra: string | null;
  previsao_entrega: string | null;
};

type Checkin = {
  id: string;
  status: string;
  created_at: string;
  lat: number | null;
  lng: number | null;
  foto_url: string | null;
};

export function ObraDetalhe() {
  const { cardId } = useParams<{ cardId: string }>();
  const [sp] = useSearchParams();
  // ?ver=1 = abriu pela lista de Obras só pra consultar — sem controles de execução
  const consulta = sp.get("ver") === "1";
  const nav = useNavigate();
  const { prestador } = useAuth();
  const { T } = useTheme();
  const [obra, setObra] = useState<Obra | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [prestadoresCard, setPrestadoresCard] = useState<{ nome: string; categoria?: string }[]>([]);
  const [fiscaisCard, setFiscaisCard] = useState<string[]>([]);
  const [gestaoItens, setGestaoItens] = useState<GestaoItem[]>([]);
  const [gestaoDatas, setGestaoDatas] = useState<GestaoDatas | null>(null);
  // Escopo atribuído pelo fiscal no Verifica (prestador_card.escopo_itens_ids =
  // ids de gestao.itens). Vazio = obra inteira; preenchido = a lista "O QUE FOI
  // CONTRATADO" mostra só os itens desse prestador.
  const [escopoIds, setEscopoIds] = useState<string[]>([]);
  // Vereditos do fiscal por item (item_id → envios, mais recente primeiro)
  const [validacao, setValidacao] = useState<Record<string, PvEnvio[]>>({});
  const [mapaPaginas, setMapaPaginas] = useState<MapaPagina[]>([]);
  const [mapaLiveId, setMapaLiveId] = useState<string | null>(null);
  const [mapaPdf, setMapaPdf] = useState<{ url: string; name?: string } | null>(null);
  const [checkinHoje, setCheckinHoje] = useState<Checkin | null>(null);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [termoPdf, setTermoPdf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Obra com contrato no gestão: itens legados ficam num bloco colapsado
  // (MEDIÇÕES DE PAGAMENTO) pra não duplicar a lista; começa fechado.
  const [legadoAberto, setLegadoAberto] = useState(false);
  // Registros DESTA obra travados na fila offline (servidor recusou ou 10+
  // tentativas): banner vermelho no topo apontando pro aviso laranja da fila.
  const [filaAtencao, setFilaAtencao] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      listQueue().then((js) => {
        if (alive) setFilaAtencao(js.filter((j) => j.obra_id === cardId && jobNeedsAttention(j)).length);
      });
    };
    load();
    const off = onQueueChange(load);
    return () => { alive = false; off(); };
  }, [cardId]);

  const reload = useCallback(async () => {
    if (!cardId || !prestador) return;
    setLoading(true);
    const [vObra, vItens, vCheck, vFichas] = await Promise.all([
      sb.from("vw_instala_minhas_obras")
        .select("card_id,obra_code,cliente_nome,cidade,progress_atual,observacao")
        .eq("card_id", cardId).eq("prestador_id", prestador.id).maybeSingle(),
      sb.from("kanban_cards").select("obra,details").eq("id", cardId).maybeSingle(),
      sb.from("instala_checkins")
        .select("id,status,created_at,lat,lng,foto_url")
        .eq("card_id", cardId).eq("prestador_id", prestador.id)
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      loadFichas(),
    ]);
    setObra((vObra.data as Obra | null) ?? null);
    setCheckinHoje((vCheck.data as Checkin | null) ?? null);
    setFichas(vFichas);
    // Termo assinado dessa obra pra esse prestador
    try {
      // vinculo canonico (Will 02/09): equipes_parket.prestador_id, nunca por nome
      const { data: eqs } = await sb.from("equipes_parket").select("id").eq("prestador_id", prestador.id);
      const eqIds = (eqs || []).map((e: any) => e.id);
      if (eqIds.length) {
        const { data: tms } = await sb.from("prestador_termos")
          .select("pdf_url").eq("card_id", cardId).eq("status", "aceito")
          .in("equipe_id", eqIds).order("aceito_em", { ascending: false }).limit(1);
        setTermoPdf((tms?.[0] as any)?.pdf_url || null);
      } else {
        setTermoPdf(null);
      }
    } catch { setTermoPdf(null); }
    // Escopo de itens atribuído pelo fiscal (Verifica grava em prestador_card.
    // escopo_itens_ids via gestão). Match direto por prestador_id + card_id:
    // aqui temos o id real do prestador logado, sem heurística de telefone/nome.
    try {
      const { data: pc } = await sb.from("prestador_card")
        .select("escopo_itens_ids")
        .eq("card_id", cardId).eq("prestador_id", prestador.id)
        .limit(1).maybeSingle();
      const ids = (pc as any)?.escopo_itens_ids;
      setEscopoIds(Array.isArray(ids) ? ids.filter((v: any) => typeof v === "string") : []);
    } catch { setEscopoIds([]); }
    // Código da obra: kanban_cards fica invisível pro anon quando o card é do dept
    // operacional (RLS), então cai na view vw_instala_minhas_obras, que é liberada
    // pro anon e já traz o mesmo obra_code. Sem esse fallback a lista de itens some.
    const obraCode = (vItens.data as { obra: string | null } | null)?.obra
      ?? (vObra.data as Obra | null)?.obra_code
      ?? null;
    const cardDet = ((vItens.data as any)?.details ?? {}) as {
      mapa_pdf?: { url?: string; name?: string };
      prestadores?: { nome?: string; categoria?: string }[];
      fiscais?: { nome?: string }[];
      fiscal?: string;
    };
    setMapaPdf(cardDet.mapa_pdf?.url ? { url: cardDet.mapa_pdf.url, name: cardDet.mapa_pdf.name } : null);
    setPrestadoresCard(
      Array.isArray(cardDet.prestadores)
        ? cardDet.prestadores.filter(p => p && p.nome).map(p => ({ nome: p.nome!, categoria: p.categoria }))
        : []
    );
    // Fiscal responsável: formato novo (array details.fiscais) ou legado (string details.fiscal)
    const fnovo = Array.isArray(cardDet.fiscais)
      ? cardDet.fiscais.map(f => (f?.nome || "").trim()).filter(Boolean)
      : [];
    const flegado = typeof cardDet.fiscal === "string"
      ? cardDet.fiscal.split(/[\/,]/).map(s => s.trim()).filter(Boolean)
      : [];
    const dedup: string[] = [];
    for (const n of [...fnovo, ...flegado]) if (!dedup.includes(n)) dedup.push(n);
    setFiscaisCard(dedup);
    if (obraCode) {
      const { data } = await sb.from("vw_instala_obra_itens")
        .select("*").eq("obra_id", obraCode).order("ordem", { ascending: true });
      setItens((data as Item[]) ?? []);
    } else {
      setItens([]);
    }
    // Modelos + mapa da obra no gestao.parket.works (best-effort: gestão fora do ar não quebra a tela)
    try {
      const [r, rm, rl, rv] = await Promise.all([
        fetch(`${GESTAO_API}/api/fiscal/obra/${cardId}`),
        fetch(`${GESTAO_API}/api/mapa-print/${cardId}`),
        fetch(`https://draw.parket.works/api/status/mapas/resolve-for-card/${cardId}`).catch(() => null),
        fetch(`${GESTAO_API}/api/fiscal/obra/${cardId}/progresso-validacao`).catch(() => null),
      ]);
      if (r.ok) {
        const g = await r.json();
        setGestaoItens((g?.itens as GestaoItem[]) ?? []);
        setGestaoDatas({
          inicio_obra: g?.projeto?.inicio_obra ?? null,
          previsao_entrega: g?.projeto?.previsao_entrega ?? null,
        });
      } else {
        setGestaoItens([]); setGestaoDatas(null);
      }
      if (rm.ok) {
        const m = await rm.json();
        setMapaPaginas(((m?.print?.paginas as MapaPagina[]) ?? []).filter((pg) => pg?.url));
      } else {
        setMapaPaginas([]);
      }
      if (rl && rl.ok) {
        const lv = await rl.json();
        setMapaLiveId((lv?.mapa_id as string | null) ?? null);
      } else {
        setMapaLiveId(null);
      }
      // Agrupa os envios validados por item; a API já devolve mais recente primeiro
      if (rv && rv.ok) {
        const v = await rv.json();
        const porItem: Record<string, PvEnvio[]> = {};
        for (const e of (v?.envios as PvEnvio[]) ?? []) {
          (porItem[e.item_id] = porItem[e.item_id] ?? []).push(e);
        }
        setValidacao(porItem);
      } else {
        setValidacao({});
      }
    } catch {
      setGestaoItens([]); setGestaoDatas(null); setMapaPaginas([]); setMapaLiveId(null); setValidacao({});
    }
    setLoading(false);
  }, [cardId, prestador]);

  useEffect(() => { reload(); }, [reload]);

  const [finDiaOpen, setFinDiaOpen] = useState(false);
  const [obsDia, setObsDia] = useState("");

  async function finalizarDia() {
    if (!cardId || !prestador) return;
    const obs = obsDia.trim() || null;
    setBusy("finalizar"); setErr(null); setInfo(null);
    try {
      const ck = crypto.randomUUID();
      const res = await submitOrQueue({
        client_key: ck,
        kind: "sb_rpc",
        endpoint: "fn_instala_finalizar_dia",
        body: {
          p_card_id: cardId,
          p_prestador_id: prestador.id,
          p_observacao: obs || null,
          p_client_id: ck,
        },
        files: [],
        label: `Finalizar dia · ${obra?.cliente_nome ?? "obra"}`,
        obra_id: cardId,
      });
      setFinDiaOpen(false); setObsDia("");
      if (res === "queued") {
        setInfo("Dia finalizado! Salvo no aparelho · enviando quando pegar sinal.");
        setCheckinHoje((c) => (c ? { ...c, status: "fechado" } : c));
      } else {
        await reload();
      }
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao finalizar dia");
    } finally {
      setBusy(null);
    }
  }

  const checkinFotoRef = useRef<HTMLInputElement>(null);
  // Visor de câmera in-app do check-in (getUserMedia pede a autorização na hora)
  const [camCheckin, setCamCheckin] = useState(false);
  const numerosModelo = numerarModelos(gestaoItens);

  // O input file vira só fallback de galeria; a câmera entrega o File direto
  async function onCheckinFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await fazerCheckin(file);
  }

  async function fazerCheckin(file: File) {
    if (!file || !cardId || !prestador) return;
    setBusy("checkin"); setErr(null); setInfo(null);
    try {
      // GPS negado (code 1): oferece registrar SEM localização em vez de travar
      // o prestador — instala_checkins.lat/lng aceitam NULL (conferido 04/09).
      let coords: { lat: number | null; lng: number | null; accuracy: number | null };
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 })
        );
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      } catch (ge: any) {
        if (ge?.code === 1 && await confirmar(
          "O aparelho está sem acesso à localização. Registrar a chegada sem localização? A foto continua valendo como prova.",
          "Registrar sem localização", "#FBBF24",
        )) {
          coords = { lat: null, lng: null, accuracy: null };
        } else {
          throw new Error(ge?.code === 1
            ? "Permita o acesso à localização pra registrar a chegada."
            : "Não conseguimos sua localização. Verifique o GPS e tente de novo.");
        }
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const ck = crypto.randomUUID();
      const res = await submitOrQueue({
        client_key: ck,
        kind: "sb_rpc",
        endpoint: "fn_instala_checkin",
        body: {
          p_prestador_id: prestador.id,
          p_card_id: cardId,
          p_lat: coords.lat,
          p_lng: coords.lng,
          p_accuracy: coords.accuracy,
          p_foto_url: null,
          p_client_id: ck, // vira o id do check-in no banco — medições offline já referenciam
        },
        files: [{
          field: "p_foto_url",
          bucket: "instala-fotos",
          bucketPath: `checkins/${cardId}/${prestador.id}/${ck}.${ext}`,
          blob: file,
          contentType: file.type || "image/jpeg",
        }],
        label: `Chegada na obra · ${obra?.cliente_nome ?? "obra"}`,
        obra_id: cardId,
      });
      if (res === "queued") {
        setInfo("Chegada registrada! Salva no aparelho · enviando quando pegar sinal.");
        setCheckinHoje({
          id: ck, status: "aberto", created_at: new Date().toISOString(),
          lat: coords.lat, lng: coords.lng, foto_url: null,
        });
      } else {
        await reload();
      }
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao registrar a chegada");
    } finally {
      setBusy(null);
      if (checkinFotoRef.current) checkinFotoRef.current.value = "";
    }
  }

  // Altura via classe .od-page: 100vh com fallback 100dvh (Chrome + zoom corta
  // a tela com 100vh cru; inline style não aceita a declaração dupla).
  return (
    <div className="od-page" style={{ background: T.bg, color: T.textPrimary, fontFamily: FONT_BODY }}>
      <header style={{
        padding: "16px 22px", borderBottom: `1px solid ${T.border}`,
        background: T.headerBg, backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={() => nav(-1)} style={iconBtn(T)} aria-label="Voltar">
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>
            {obra?.obra_code ?? "-"}
          </p>
          <h1 style={{
            fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500,
            letterSpacing: "0.04em", color: T.textPrimary,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {obra?.cliente_nome ?? "Carregando…"}
          </h1>
          {(obra?.observacao?.trim() || prestador?.categoria) && (
            <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textSecondary, marginTop: 3, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {obra?.observacao?.trim() || prestador?.categoria}
            </p>
          )}
        </div>
        {/* Atalho: solicitar material já vinculado a ESTA obra (Material pré-seleciona via ?obra=) */}
        {prestador?.nome && cardId && (
          <button
            onClick={() => nav(`/${slugify(prestador.nome)}/material?obra=${cardId}`)}
            style={iconBtn(T)} aria-label="Solicitar material desta obra" title="Solicitar material"
          >
            <Package size={14} />
          </button>
        )}
        <button onClick={reload} style={iconBtn(T)} aria-label="Atualizar">
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      </header>

      <main style={{ padding: "20px 22px 130px" }}>
        {info && (
          <div style={{
            border: "1px solid #FBBF2444", background: "#FBBF240a",
            padding: "10px 14px", marginBottom: 14,
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 11, color: T.textSecondary,
          }}>
            <CheckCircle2 size={14} color="#FBBF24" />
            <span style={{ flex: 1 }}>{info}</span>
          </div>
        )}
        {err && (
          <div style={{
            border: "1px solid #ef444455", background: "#ef44440a",
            padding: "10px 14px", marginBottom: 14,
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 11, color: "#ef4444",
          }}>
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{err}</span>
          </div>
        )}
        {/* Registro desta obra travado na fila offline: sem esse aviso o prestador
            só descobre tocando no chip laranja lá embaixo (fácil de não ver). */}
        {filaAtencao > 0 && (
          <div style={{
            border: "1px solid #ef4444", background: "#ef44440d",
            padding: "12px 14px", marginBottom: 14,
            display: "flex", alignItems: "flex-start", gap: 10,
            fontSize: 11, color: T.textPrimary, lineHeight: 1.5,
          }}>
            <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1 }}>
              {filaAtencao === 1
                ? "1 registro desta obra travou no envio."
                : `${filaAtencao} registros desta obra travaram no envio.`}
              {" "}Toque no aviso laranja embaixo da tela pra resolver.
            </span>
          </div>
        )}
        {consulta && (
          <div style={{
            border: `1px dashed ${T.borderHover}`, background: T.statBg,
            padding: "10px 14px", marginBottom: 20,
            fontSize: 11, color: T.textSecondary,
          }}>
            Só consulta: pra trabalhar nessa obra, use a aba INICIAR.
          </div>
        )}
        {/* Gate de check-in VISÍVEL: sem chegada registrada hoje os cards ficam
            travados, então o banner explica o porquê e oferece o botão de check-in
            aqui mesmo (fazerCheckin já cuida de GPS + foto + fila offline). */}
        {!consulta && !checkinHoje && !loading && (
          <div style={{
            border: "1px solid #FBBF24", background: "#FBBF240d",
            padding: "14px", marginBottom: 20, display: "grid", gap: 10,
          }}>
            <p style={{ fontSize: 11, color: T.textPrimary, lineHeight: 1.5 }}>
              Você ainda não registrou a chegada de hoje nesta obra.
              Registre com uma foto pra liberar o envio de fotos e progresso dos itens.
            </p>
            <button
              onClick={() => setCamCheckin(true)}
              disabled={busy === "checkin"}
              style={{
                width: "100%", padding: "13px 14px",
                background: "#FBBF24", color: "#1c1400", border: "none",
                fontSize: 11, letterSpacing: "0.16em", fontWeight: 700,
                cursor: busy === "checkin" ? "not-allowed" : "pointer",
                opacity: busy === "checkin" ? 0.6 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Camera size={14} />
              {busy === "checkin" ? "REGISTRANDO CHEGADA..." : "REGISTRAR CHEGADA (FOTO)"}
            </button>
            {/* Fallback de galeria (sem capture): usado quando a câmera é negada */}
            <input
              ref={checkinFotoRef} type="file" accept="image/*"
              style={{ display: "none" }} onChange={onCheckinFile}
              disabled={busy === "checkin"}
            />
            {camCheckin && (
              <CameraCapture
                onFiles={(fs) => { setCamCheckin(false); if (fs[0]) fazerCheckin(fs[0]); }}
                onFallback={() => { setCamCheckin(false); checkinFotoRef.current?.click(); }}
                onClose={() => setCamCheckin(false)}
              />
            )}
          </div>
        )}
        {!consulta && checkinHoje && (
          <div style={{
            border: "1px solid #22c55e44", background: "#22c55e0a",
            padding: "10px 14px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            fontSize: 11, color: T.textSecondary,
          }}>
            <CheckCircle2 size={14} color="#22c55e" />
            <span style={{ flex: 1 }}>Chegada registrada às {new Date(checkinHoje.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            {checkinHoje.status === "aberto" && (
              <button onClick={() => setFinDiaOpen((v) => !v)} disabled={busy === "finalizar"} style={{
                padding: "7px 12px", background: T.textPrimary, color: T.bg, border: "none",
                cursor: "pointer", fontSize: 10, letterSpacing: "0.18em", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6, opacity: busy === "finalizar" ? 0.6 : 1,
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                <Flag size={11} /> FINALIZAR DIA
              </button>
            )}
          </div>
        )}
        {!consulta && checkinHoje && finDiaOpen && (
          <div style={{
            padding: 14, marginBottom: 20, border: `1px solid ${T.borderHover}`,
            background: T.statBg, display: "grid", gap: 10,
          }}>
            <p style={{ fontSize: 9, letterSpacing: "0.2em", color: T.textMuted }}>FECHAR O DIA DE HOJE?</p>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={obsDia} onChange={(e) => setObsDia(e.target.value)}
                placeholder="Algum recado sobre o dia? (opcional)"
                style={{
                  flex: 1, minWidth: 0, padding: "11px 12px", background: T.inputBg, border: `1px solid ${T.border}`,
                  color: T.textPrimary, fontSize: 13, outline: "none", fontFamily: "inherit",
                }}
              />
              <DitadoBtn onText={(t) => setObsDia((old) => (old ? old + " " : "") + t)} />
            </div>
            <button onClick={finalizarDia} disabled={busy === "finalizar"} style={{
              padding: "13px 16px", background: T.textPrimary, color: T.bg, border: "none",
              fontSize: 11, letterSpacing: "0.2em", fontWeight: 700,
              cursor: busy === "finalizar" ? "not-allowed" : "pointer", opacity: busy === "finalizar" ? 0.6 : 1,
            }}>
              {busy === "finalizar" ? "FINALIZANDO…" : "CONFIRMAR E FECHAR O DIA"}
            </button>
            <button onClick={() => { setFinDiaOpen(false); setObsDia(""); }} disabled={busy === "finalizar"} style={{
              padding: "8px 0", background: "transparent", border: "none",
              color: T.textMuted, fontSize: 10, letterSpacing: "0.2em", fontWeight: 600,
              cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3,
            }}>
              VOLTAR
            </button>
          </div>
        )}

        {/* Datas da obra (setor gestão) */}
        {gestaoDatas && (fmtData(gestaoDatas.inicio_obra) || fmtData(gestaoDatas.previsao_entrega)) && (
          <section style={{
            border: `1px solid ${T.border}`, background: T.statBg,
            padding: "10px 16px", marginBottom: 24,
            display: "flex", justifyContent: "space-around", gap: 12, textAlign: "center",
          }}>
            <div>
              <p style={{ fontSize: 8, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 3 }}>INÍCIO DA OBRA</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{fmtData(gestaoDatas.inicio_obra) ?? "-"}</p>
            </div>
            <div style={{ width: 1, background: T.border }} />
            <div>
              <p style={{ fontSize: 8, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 3 }}>PREVISÃO DE ENTREGA</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{fmtData(gestaoDatas.previsao_entrega) ?? "-"}</p>
            </div>
          </section>
        )}

        {/* Contrato assinado dessa obra (link do PDF) */}
        {termoPdf && (
          <section style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 10 }}>
              CONTRATO DESSA OBRA
            </p>
            <a href={termoPdf} target="_blank" rel="noreferrer" style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              border: `1px solid ${T.border}`, background: T.statBg,
              color: T.textPrimary, textDecoration: "none",
            }}>
              <FileText size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontFamily: FONT_DISPLAY, letterSpacing: "0.04em" }}>
                  Termo de prestação de serviço
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  Assinado · toque pra abrir
                </div>
              </div>
            </a>
          </section>
        )}

        {/* Progresso geral (mesma fórmula da barra do gestao.parket.works, pra
            ficarem fiéis). Obra com contrato no gestão: só os itens do gestão
            entram na conta, senão as medições legadas de pagamento distorceriam
            o % em relação ao que o gestão e o Hoje mostram. Obra 100% legada
            segue ponderando os itens avulsos, como sempre foi. */}
        {(itens.length > 0 || gestaoItens.length > 0) && (() => {
          const usarLegado = gestaoItens.length === 0;
          let totC = usarLegado ? itens.reduce((s, i) => s + Number(i.contrato_qtd), 0) : 0;
          let totI = usarLegado ? itens.reduce((s, i) => s + Number(i.qtd_instalada), 0) : 0;
          for (const g of gestaoItens) {
            const q = Number(g.quantidade ?? 0);
            const peso = q > 0 ? q : 1;
            const inst = itemFinalizado(g.status)
              ? peso : q > 0 ? Math.min(Number(g.meta?.obra?.qtd_instalada ?? 0), q) : 0;
            totC += peso; totI += inst;
          }
          const pct = totC > 0 ? Math.round((totI / totC) * 100) : 0;
          return (
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>
                  EVOLUÇÃO
                </p>
                <p style={{ fontSize: 24, fontFamily: FONT_DISPLAY, color: T.textPrimary }}>{pct}%</p>
              </div>
              <div style={{ height: 4, background: T.statBg, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: T.textPrimary, transition: "width .4s" }} />
              </div>
            </section>
          );
        })()}

        {/* Projeto da obra: mapa e projeto executivo lado a lado, o fiscal
            escolhe qual dos dois abrir. */}
        <ProjetoObra cardId={cardId!} T={T}
          mapaPaginas={mapaPaginas} mapaLiveId={mapaLiveId} mapaPdf={mapaPdf} />

        {/* O QUE FOI CONTRATADO (proposta gestão).
            Aditivo: itens marcados com meta.eh_aditivo saem num bloco separado
            embaixo, com separador amarelo, pra fiscal/instalador enxergar
            claramente o que veio depois do contrato original. */}
        {gestaoItens.length > 0 && (() => {
          // Escopo do fiscal: com atribuição, o prestador vê só os itens dele.
          // Interseção vazia (item excluído/re-mergeado no gestão) cai pra lista
          // completa: escopo obsoleto nunca pode esconder o contrato inteiro.
          const escopo = new Set(escopoIds);
          const filtrados = escopo.size ? gestaoItens.filter((it) => escopo.has(it.id)) : gestaoItens;
          const visiveis = filtrados.length ? filtrados : gestaoItens;
          const escopado = visiveis.length < gestaoItens.length;
          const originais = visiveis.filter((it) => !((it.meta as any)?.eh_aditivo));
          const aditivos = visiveis.filter((it) => (it.meta as any)?.eh_aditivo === true);
          return (
            <section style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 6 }}>
                O QUE FOI CONTRATADO · {visiveis.length} {visiveis.length === 1 ? "ITEM" : "ITENS"}
              </p>
              {escopado && (
                <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 6 }}>
                  Itens atribuídos a você pelo fiscal ({visiveis.length} de {gestaoItens.length} da obra)
                </p>
              )}
              {fiscaisCard.length > 0 && (
                <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 10 }}>
                  Fiscal{fiscaisCard.length > 1 ? "s" : ""}: {fiscaisCard.join(" · ")}
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {originais.map((it) => (
                  <GestaoItemRow
                    key={it.id} item={it} numero={numerosModelo.get(it.id) ?? ""} T={T}
                    prestador={prestador!} cardId={cardId!} onChanged={reload}
                    readOnly={consulta ? "consulta" : !checkinHoje ? "checkin" : false}
                    prestadoresCard={prestadoresCard}
                    fichas={fichasDoItem(fichas, textoDoItem(it))}
                    envios={validacao[it.id] ?? []}
                  />
                ))}
              </div>
              {aditivos.length > 0 && (
                <>
                  <div style={{
                    marginTop: 16, marginBottom: 8, padding: "8px 12px",
                    background: "rgba(199,164,91,0.10)", border: "1px solid #C7A45B",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.28em", color: "#C7A45B", fontWeight: 700 }}>
                      ADITIVO
                    </span>
                    <span style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.08em" }}>
                      {aditivos.length} item(ns) adicionado(s) após contrato original
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {aditivos.map((it) => (
                      <GestaoItemRow
                        key={it.id} item={it} numero={numerosModelo.get(it.id) ?? ""} T={T}
                        prestador={prestador!} cardId={cardId!} onChanged={reload}
                        readOnly={consulta ? "consulta" : !checkinHoje ? "checkin" : false}
                        prestadoresCard={prestadoresCard}
                        fichas={fichasDoItem(fichas, textoDoItem(it))}
                        envios={validacao[it.id] ?? []}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })()}

        {/* Itens legados (prestadores_obra_servicos): alimentam a medição de
            pagamento (página Pagamentos), então nunca somem. Obra 100% legada:
            lista aberta, idêntica ao que sempre foi. Obra com contrato no
            gestão: bloco colapsado "MEDIÇÕES DE PAGAMENTO" pra não duplicar a
            lista de itens (16 obras híbridas na base em 04/09). */}
        {itens.length > 0 && gestaoItens.length === 0 && (
          <section>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 10 }}>
              ITENS DA OBRA · {itens.length}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {itens.map((item, i) => (
                <ItemRow
                  key={item.servico_id} item={item} numero={`${i + 1}`} T={T}
                  prestadorId={prestador!.id} cardId={cardId!}
                  checkinId={checkinHoje?.id ?? null}
                  onChanged={reload}
                  readOnly={consulta ? "consulta" : !checkinHoje ? "checkin" : false}
                />
              ))}
            </div>
          </section>
        )}

        {itens.length > 0 && gestaoItens.length > 0 && (
          <section>
            <button
              onClick={() => setLegadoAberto((v) => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 10, padding: "12px 14px",
                background: T.statBg, border: `1px solid ${T.border}`,
                color: T.textPrimary, cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>
                MEDIÇÕES DE PAGAMENTO · {itens.length}
              </span>
              <span style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted }}>
                {legadoAberto ? "FECHAR" : "ABRIR"}
              </span>
            </button>
            {legadoAberto && (
              <>
                <p style={{ fontSize: 10, color: T.textMuted, margin: "10px 0", lineHeight: 1.5 }}>
                  Itens fora do contrato do gestão. O que você registrar aqui entra
                  na sua página Receber.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {itens.map((item, i) => (
                    <ItemRow
                      key={item.servico_id} item={item} numero={`${i + 1}`} T={T}
                      prestadorId={prestador!.id} cardId={cardId!}
                      checkinId={checkinHoje?.id ?? null}
                      onChanged={reload}
                      readOnly={consulta ? "consulta" : !checkinHoje ? "checkin" : false}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {prestador?.nome && <BottomNav slug={slugify(prestador.nome)} />}

      <style>{`.od-page { min-height: 100vh; min-height: 100dvh; } .spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function GestaoItemRow({
  item, numero, T, prestador, cardId, onChanged, readOnly, prestadoresCard, fichas, envios,
}: {
  item: GestaoItem; numero: string; T: any;
  prestador: { id: string; nome: string }; cardId: string; onChanged: () => void;
  readOnly?: ReadOnlyMode;
  prestadoresCard?: { nome: string; categoria?: string }[];
  fichas: Ficha[];
  envios?: PvEnvio[];
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "midia" | "confirmar">(null);
  const [showFicha, setShowFicha] = useState(false);
  // Visor fullscreen genérico: foto do fiscal, foto da galeria de envios ou thumb pendente
  const [visor, setVisor] = useState<{ url: string; tipo: "foto" | "video"; titulo: string; cor: string } | null>(null);
  // Cada pendência guarda previewUrl (objectURL) pro prestador VER a foto antes de enviar
  const [pends, setPends] = useState<{ file: File; tipo: "foto" | "video"; previewUrl: string }[]>([]);
  const [qtdStr, setQtdStr] = useState("");
  // Mídias deste item paradas na fila offline (salvas no aparelho, ainda não chegaram no servidor)
  const [nFila, setNFila] = useState(0);
  // Visor de câmera in-app (getUserMedia): foto e vídeo sem cair no seletor de arquivos
  const [cam, setCam] = useState(false);
  // Timestamp da ultima vez que o prestador desmarcou "fazendo hoje" NESTE item.
  // Alimenta o aviso "VOCE PAROU AS HH:MM" abaixo do botao amarelo (Will 08/09:
  // antes o botao alternava e sumia sem feedback, ficava "sem marca nada").
  const [paradoEm, setParadoEm] = useState<Date | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    const conta = () => {
      listQueue().then((jobs) => {
        if (!vivo) return;
        setNFila(jobs.filter((j) =>
          j.endpoint.includes(`/itens/${item.id}/progresso`) && j.files.length > 0
        ).length);
      });
    };
    conta();
    const off = onQueueChange(conta);
    return () => { vivo = false; off(); };
  }, [item.id]);

  const st = GESTAO_ST[item.status ?? "pendente"] ?? GESTAO_ST.pendente;
  const entregue = itemFinalizado(item.status);
  const qtd = Number(item.quantidade ?? 0);
  const inst = Number(item.meta?.obra?.qtd_instalada ?? 0);
  const restante = Math.max(0, qtd - inst);
  // midiasEfetivas soma o que já chegou no servidor + o que está na fila do aparelho,
  // pro app não pedir de novo fotos que já foram tiradas (a lane FIFO garante a ordem)
  const midias = Number(item.midias ?? 0);
  const midiasEfetivas = midias + nFila;
  const faltamMidias = Math.max(0, MIN_MIDIAS - midiasEfetivas - pends.length);
  const pct = entregue ? 100 : qtd > 0 ? Math.min(100, Math.round((inst / qtd) * 100)) : 0;
  const desc = (item.descritivo ?? "").trim() || "Item";
  const titulo = desc.startsWith(numero) ? desc : `${numero} · ${desc}`;

  // Veredito do fiscal sobre o envio mais recente que entrou na fila de validação
  // (fiscal=null é envio legado, anterior à validação: não mostra nada).
  // Reprovado ganha destaque no card com motivo e foto do fiscal.
  const vf = ((envios ?? []).find((e) => e.fiscal && e.fiscal.status) ?? null)?.fiscal ?? null;

  const dNow = new Date();
  const hojeStr = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, "0")}-${String(dNow.getDate()).padStart(2, "0")}`;
  const fh = item.meta?.obra?.fazendo_hoje;
  const equipeHoje: string[] = fh?.data === hojeStr ? (fh?.prestadores ?? []) : [];
  const euHoje = equipeHoje.includes(prestador.nome);
  const outrosHoje = equipeHoje.filter((n) => n !== prestador.nome);

  // Voltou a marcar como fazendo -> limpa o aviso "PAROU AS" anterior
  useEffect(() => { if (euHoje && paradoEm) setParadoEm(null); }, [euHoje, paradoEm]);

  async function toggleFazendoHoje() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${GESTAO_API}/api/fiscal/obra/${cardId}/itens/${item.id}/fazendo-hoje`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prestador_id: prestador.id, prestador_nome: prestador.nome, fazendo: !euHoje,
        }),
      });
      if (!r.ok) {
        let msg = `Falha ao marcar (${r.status})`;
        try { const j = await r.json(); if (typeof j?.detail === "string") msg = j.detail; } catch {}
        throw new Error(msg);
      }
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao marcar");
    } finally {
      setBusy(false);
    }
  }

  // Recebe File[] tanto da câmera in-app quanto do input de galeria (fallback)
  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setErr(null);
    try {
      const novos: { file: File; tipo: "foto" | "video"; previewUrl: string }[] = [];
      for (const file of files) {
        const tipo = await validarMidia(file);
        // objectURL barato só pro thumbnail; revogado no envio/cancelamento
        novos.push({ file, tipo, previewUrl: URL.createObjectURL(file) });
      }
      setPends((prev) => [...prev, ...novos]);
      setPanel("midia");
    } catch (er: any) {
      setErr(er?.message ?? "Não consegui ler a mídia");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    await addFiles(Array.from(e.target.files ?? []));
    if (inputRef.current) inputRef.current.value = "";
  }

  // Tira UMA foto errada da lista sem cancelar as outras
  function removerPend(idx: number) {
    setPends((prev) => {
      const alvo = prev[idx];
      if (alvo) URL.revokeObjectURL(alvo.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function limparPends() {
    setPends((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }

  async function enviar(finalizado: boolean) {
    if (busy) return;
    let qtd_delta: number | null = null;
    if (!finalizado) {
      const raw = qtdStr.trim();
      if (!raw) {
        if (qtd > 0) { setErr(`Informe quanto você fez hoje (${item.unidade ?? "m²"})`); return; }
      } else {
        const n = Number(raw.replace(",", "."));
        if (!Number.isFinite(n) || n <= 0) { setErr("Quantidade inválida"); return; }
        qtd_delta = n;
      }
    }
    setBusy(true); setErr(null); setOk(null);
    try {
      // Cada envio = 1 job idempotente (client_key). Mídia sobe junto no flush —
      // sem sinal, tudo (inclusive as fotos) fica salvo no aparelho.
      const jobs: { ck: string; body: Record<string, unknown>; files: import("../lib/offline").QueuedFile[] }[] = [];
      if (pends.length === 0) {
        jobs.push({ ck: crypto.randomUUID(), body: { qtd_delta, finalizado, midia_url: null, midia_tipo: null }, files: [] });
      } else {
        pends.forEach((p, i) => {
          const ck = crypto.randomUUID();
          const ext = p.file.name.split(".").pop()?.toLowerCase() ?? (p.tipo === "video" ? "mp4" : "jpg");
          jobs.push({
            ck,
            body: {
              qtd_delta: i === 0 ? qtd_delta : null,
              finalizado: finalizado && i === pends.length - 1,
              finalizando: finalizado,
              midia_url: null, midia_tipo: p.tipo,
            },
            files: [{
              field: "midia_url",
              bucketPath: `instala/${cardId}/${item.id}/${ck}.${ext}`,
              blob: p.file,
              contentType: p.file.type || "application/octet-stream",
            }],
          });
        });
      }
      let queued = false;
      for (const j of jobs) {
        const r = await submitOrQueue({
          client_key: j.ck,
          endpoint: `/api/fiscal/obra/${cardId}/itens/${item.id}/progresso`,
          body: { prestador_id: prestador.id, prestador_nome: prestador.nome, ...j.body },
          files: j.files,
          label: `${finalizado ? "Finalizar ambiente" : "Progresso"} · ${titulo}`,
          obra_id: cardId,
        });
        if (r === "queued") queued = true;
      }
      const nEnviadas = pends.length;
      setPanel(null); limparPends(); setQtdStr("");
      // Sempre confirmar o resultado em palavras: o prestador precisa saber que "pegou"
      if (queued) {
        setOk("Salvo no aparelho. Vai subir sozinho quando pegar sinal.");
      } else if (finalizado) {
        setOk("Ambiente finalizado. O fiscal vai conferir as fotos.");
      } else if (nEnviadas > 0) {
        setOk(nEnviadas > 1 ? "Fotos enviadas. O fiscal vai conferir." : "Foto enviada. O fiscal vai conferir.");
      } else {
        setOk("Progresso registrado.");
      }
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao registrar");
    } finally {
      setBusy(false);
    }
  }

  function fechar() { setPanel(null); limparPends(); setQtdStr(""); setErr(null); }

  return (
    <div style={{
      border: `1px solid ${entregue ? "#34D39944" : T.border}`,
      background: entregue ? "#34D39908" : T.cardBg,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: T.textPrimary, marginBottom: 4, lineHeight: 1.45 }}>
            {titulo}
          </div>
          <div style={{ fontSize: 11, color: T.textSecondary, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {item.ambiente && <span>· {item.ambiente.toUpperCase()}</span>}
            {qtd > 0 && <span>· {inst.toFixed(2)} / {qtd.toFixed(2)} {item.unidade ?? "m²"}</span>}
            {!entregue && (
              <span style={{ color: midiasEfetivas >= MIN_MIDIAS ? "#34D399" : T.textMuted }}>
                · {midiasEfetivas}/{MIN_MIDIAS} mídias
              </span>
            )}
            {/* Mídias que ainda estão na fila offline do aparelho: o prestador vê que não se perderam */}
            {!entregue && nFila > 0 && (
              <span style={{ color: "#FBBF24" }}>
                · {nFila} no aparelho, esperando sinal
              </span>
            )}
            {/* Veredito do fiscal sobre o último envio: aprovado/pendente viram chip discreto */}
            {vf?.status === "aprovado" && (
              <span style={{ color: "#34D399" }}>· aprovado pelo fiscal</span>
            )}
            {vf?.status === "pendente" && (
              <span style={{ color: T.textMuted }}>· aguardando fiscal</span>
            )}
          </div>
          {/* Galeria das mídias já enviadas: o prestador VÊ que a foto chegou (prova visual).
              Selo colorido = veredito do fiscal daquele envio. Toque abre no visor fullscreen. */}
          {(() => {
            const comMidia = (envios ?? []).filter((e) => e.midia_url);
            if (!comMidia.length) return null;
            const corSelo = (e: PvEnvio) =>
              e.fiscal?.status === "aprovado" ? "#34D399"
              : e.fiscal?.status === "reprovado" ? "#ef4444"
              : "#FBBF24";
            return (
              <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto", paddingBottom: 2 }}>
                {comMidia.map((e) => (
                  <button key={e.id}
                    onClick={() => setVisor({
                      url: e.midia_url!,
                      tipo: e.midia_tipo === "video" ? "video" : "foto",
                      titulo: "FOTO ENVIADA",
                      cor: corSelo(e),
                    })}
                    style={{
                      position: "relative", width: 56, height: 56, flexShrink: 0,
                      padding: 0, border: `1px solid ${T.border}`, background: "#000",
                      cursor: "pointer", overflow: "hidden",
                    }}>
                    {e.midia_tipo === "video" ? (
                      <video src={e.midia_url!} preload="metadata" muted playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                    ) : (
                      <img src={e.midia_url!} alt="" loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <span style={{
                      position: "absolute", top: 3, right: 3, width: 8, height: 8,
                      borderRadius: "50%", background: corSelo(e), border: "1px solid rgba(0,0,0,0.4)",
                    }} />
                  </button>
                ))}
              </div>
            );
          })()}
          {(() => {
            const pi = fmtData(item.previsao_inicio), pf = fmtData(item.previsao_fim);
            const ex = entregue ? fmtData(item.executado_em) : null;
            if (!pi && !pf && !ex) return null;
            return (
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(pi || pf) && <span>execução: {pi ?? "-"}{pf && pf !== pi ? ` → ${pf}` : ""}</span>}
                {ex && <span style={{ color: "#34D399" }}>finalizado em {ex}</span>}
              </div>
            );
          })()}
          {(() => {
            const lista = prestadoresCard || [];
            if (!lista.length) return null;
            const catItem = String(
              item.meta?.categoria_raiz || (item.categoria || "").split("||")[0] || ""
            ).toLowerCase();
            const bate = lista.filter(p =>
              catItem && (p.categoria || "").toLowerCase().split(/[\/,]/)
                .some(c => c.trim() && catItem.includes(c.trim().toLowerCase()))
            );
            const usar = bate.length ? bate : lista;
            const nomes: string[] = [];
            for (const p of usar) { const n = (p.nome || "").trim(); if (n && !nomes.includes(n)) nomes.push(n); }
            if (!nomes.length) return null;
            return (
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                <Users size={10} style={{ flexShrink: 0 }} /> {nomes.join(" · ")}
              </div>
            );
          })()}
          {(item.observacoes || "").trim() && (
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2, fontStyle: "italic", lineHeight: 1.4, display: "flex", alignItems: "flex-start", gap: 5 }}>
              <PenLine size={10} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{item.observacoes}</span>
            </div>
          )}
          {fichas.length > 0 && (
            <button onClick={() => setShowFicha(true)} style={{
              marginTop: 8, padding: "6px 10px",
              background: "transparent", border: `1px dashed ${T.borderHover}`,
              color: T.textSecondary, fontSize: 9.5, letterSpacing: "0.12em", fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <BookOpen size={11} /> FICHA TÉCNICA{fichas.length > 1 ? ` · ${fichas.length}` : ""}
            </button>
          )}
          {/* Botão-status do item no dia. Pedido do Will 08/09: quando ja estou
              marcado como FAZENDO HOJE, o botao grande abre a camera direto
              (era o que ele esperava do "tocar de novo" — antes desmarcava sem
              feedback). O X pequeno ao lado desmarca; ao desmarcar aparece um
              chip verde "VOCE PAROU AS HH:MM" pra ele ter certeza que pegou.
              AGUARDANDO = ninguem marcou hoje; FAZENDO HOJE = alguem esta no
              item (amarelo cheio se sou eu, contorno se e so outro colega). */}
          {!entregue && !readOnly && (() => {
            const alguemHoje = euHoje || outrosHoje.length > 0;
            const quem = [...(euHoje ? ["VOCÊ"] : []), ...outrosHoje];
            const abrirRegistro = () => { setErr(null); setCam(true); };
            const pararComRegistro = async () => {
              // Marca timestamp otimista antes do await — se falhar, o botao
              // volta pra amarelo e o effect no topo limpa o paradoEm.
              const agora = new Date();
              await toggleFazendoHoje();
              setParadoEm(agora);
            };
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={euHoje ? abrirRegistro : toggleFazendoHoje}
                    disabled={busy}
                    style={{
                      flex: 1, padding: "10px",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      background: euHoje ? "#FBBF24" : alguemHoje ? "#FBBF2414" : "transparent",
                      border: `1.5px solid ${alguemHoje ? "#FBBF24" : T.textPrimary}`,
                      color: euHoje ? "#111" : alguemHoje ? "#FBBF24" : T.textPrimary,
                      cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
                    }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, letterSpacing: "0.14em", fontWeight: 700 }}>
                      {alguemHoje && <CheckCircle2 size={14} style={{ flexShrink: 0 }} />}
                      {alguemHoje ? "FAZENDO HOJE" : "AGUARDANDO"}
                      {quem.length > 0 && ` · ${quem.join(", ")}`}
                    </span>
                    <span style={{ fontSize: 9, letterSpacing: "0.06em", opacity: 0.75, fontWeight: 500 }}>
                      {euHoje ? "toque pra registrar o que fez" : "toque se você está fazendo hoje"}
                    </span>
                  </button>
                  {euHoje && (
                    <button
                      onClick={pararComRegistro} disabled={busy}
                      aria-label="Parar de fazer este item hoje"
                      title="Parar"
                      style={{
                        width: 46, padding: "0", flexShrink: 0,
                        background: "transparent", border: `1.5px solid #FBBF24`,
                        color: "#FBBF24",
                        cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, fontWeight: 700, lineHeight: 1,
                      }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
                {paradoEm && !euHoje && (
                  <div style={{
                    marginTop: 6, padding: "6px 10px",
                    background: "#34D39914", border: "1px solid #34D39955",
                    color: "#34D399",
                    fontSize: 10, letterSpacing: "0.12em", fontWeight: 600,
                    textAlign: "center", textTransform: "uppercase",
                  }}>
                    VOCÊ PAROU ÀS {paradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Sem check-in do dia os botões de envio ficam escondidos: explica o porquê
              e aponta pro banner de chegada no topo (em consulta não mostra nada) */}
          {!entregue && readOnly === "checkin" && (
            <div style={{ marginTop: 10, fontSize: 10, color: "#FBBF24", lineHeight: 1.5 }}>
              Registre a chegada lá em cima pra liberar as fotos e o progresso deste item.
            </div>
          )}
          {qtd > 0 && (() => {
            // Bloco "PROGRESSO" pedido pelo Will 08/09: barra mais grossa + label
            // "FALTA X m²" bem visível + mini-histórico dos dias em que a equipe
            // registrou execução naquele item (ex.: 200m² total, 50 feitos hoje,
            // ainda faltam 150). qtd_delta vem no PvEnvio do endpoint
            // /progresso-validacao (payload.qtd_delta gravado por /progresso).
            const un = item.unidade ?? "m²";
            const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            // Agrupa envios por dia (YYYY-MM-DD) somando qtd_delta > 0 — mais recente primeiro
            const porDia = new Map<string, number>();
            for (const e of envios ?? []) {
              const q = Number(e.qtd_delta ?? 0);
              if (!q) continue;
              const d = String(e.created_at).slice(0, 10);
              porDia.set(d, (porDia.get(d) ?? 0) + q);
            }
            const dias = Array.from(porDia.entries()).sort((a, b) => b[0].localeCompare(a[0]));
            const chipDia = (iso: string) => {
              const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
              if (!m) return iso;
              return `${m[3]}/${m[2]}`;
            };
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4,
                }}>
                  <span style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, fontWeight: 600 }}>
                    PROGRESSO · {fmt(inst)} / {fmt(qtd)} {un}
                  </span>
                  {!entregue && restante > 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24" }}>
                      FALTA {fmt(restante)} {un}
                    </span>
                  ) : entregue ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#34D399", letterSpacing: "0.14em" }}>
                      FINALIZADO
                    </span>
                  ) : null}
                </div>
                <div style={{ height: 6, background: T.statBg, overflow: "hidden", borderRadius: 2 }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: entregue ? "#34D399" : pct > 0 ? "#FBBF24" : T.textPrimary,
                    transition: "width .4s",
                  }} />
                </div>
                {dias.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {dias.slice(0, 6).map(([d, q]) => (
                      <span key={d} style={{
                        fontSize: 10, padding: "3px 7px", background: T.statBg,
                        border: `1px solid ${T.border}`, color: T.textSecondary,
                        letterSpacing: "0.04em",
                      }}>
                        {chipDia(d)} · {fmt(q)} {un}
                      </span>
                    ))}
                    {dias.length > 6 && (
                      <span style={{ fontSize: 10, color: T.textMuted, padding: "3px 4px" }}>
                        +{dias.length - 6} dia{dias.length - 6 > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Item finalizado com envio ainda na fila do fiscal: box amarelo dizendo
              que está tudo certo do lado do instalador, só falta a conferência.
              Sem isso o prestador finalizava e ficava sem saber se "pegou". */}
          {entregue && (envios ?? [])[0]?.fiscal?.status === "pendente" && (
            <div style={{
              marginTop: 8, padding: "10px 12px",
              border: "1px solid #FBBF24", background: "#FBBF240d",
            }}>
              <div style={{
                fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
                color: "#FBBF24", textTransform: "uppercase",
              }}>
                AGUARDANDO O FISCAL
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                Ambiente finalizado e fotos enviadas. O fiscal vai conferir e o
                resultado aparece aqui neste card.
              </div>
            </div>
          )}
          {/* Reprovação do fiscal ganha destaque: motivo, foto e orientação de refazer */}
          {vf?.status === "reprovado" && (
            <div style={{
              marginTop: 8, padding: "10px 12px",
              border: "1px solid #ef4444", background: "#ef44440d",
            }}>
              <div style={{
                fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
                color: "#ef4444", textTransform: "uppercase",
              }}>
                REPROVADO PELO FISCAL{vf.nome ? ` · ${vf.nome.toUpperCase()}` : ""}
              </div>
              {(vf.motivo || "").trim() && (
                <div style={{ fontSize: 11, color: T.textPrimary, marginTop: 6, lineHeight: 1.5 }}>
                  {vf.motivo}
                </div>
              )}
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 6, lineHeight: 1.4 }}>
                Refaça o apontado e envie novas fotos: o próximo envio volta pra validação.
              </div>
              {vf.foto_url && (
                <button onClick={() => setVisor({ url: vf.foto_url!, tipo: "foto", titulo: "FOTO DO FISCAL", cor: "#ef4444" })} style={{
                  marginTop: 8, padding: "6px 10px",
                  background: "transparent", border: "1px dashed #ef4444",
                  color: "#ef4444", fontSize: 9.5, letterSpacing: "0.12em", fontWeight: 600,
                  cursor: "pointer",
                }}>
                  VER FOTO DO FISCAL
                </button>
              )}
            </div>
          )}
          {err && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#ef4444" }}>{err}</div>
          )}
          {ok && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#FBBF24" }}>{ok}</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <span style={{
            fontSize: 9, letterSpacing: "0.12em", fontWeight: 600,
            color: st.cor, whiteSpace: "nowrap", textTransform: "uppercase",
          }}>
            {st.label}
          </span>
          {!entregue && !readOnly && (
            <>
              {/* Abre a câmera in-app; a galeria vira fallback dentro do visor */}
              <button onClick={() => setCam(true)} disabled={busy} aria-label="Abrir câmera" style={{
                ...iconBtn(T),
                cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
              }}>
                <Camera size={14} />
              </button>
              <input
                ref={inputRef} type="file" accept="image/*,video/*" multiple
                style={{ display: "none" }} onChange={onFile} disabled={busy}
              />
              <button onClick={() => { setErr(null); setPanel(panel === "confirmar" ? null : "confirmar"); }}
                disabled={busy} aria-label="Finalizar ambiente" style={{
                ...iconBtn(T), color: "#34D399", borderColor: "#34D39955",
                cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
              }}>
                <CheckCircle2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {panel === "midia" && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 10 }}>
            {pends.length > 1 ? `${pends.length} MÍDIAS PRONTAS` : pends[0]?.tipo === "video" ? "VÍDEO PRONTO" : "FOTO PRONTA"} · COMO FICOU O AMBIENTE?
          </p>
          {/* Thumbs do que vai ser enviado: dá pra conferir cada foto e tirar uma errada
              sem cancelar o envio inteiro. Toque na thumb abre no visor fullscreen. */}
          {pends.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 2 }}>
              {pends.map((p, i) => (
                <div key={p.previewUrl} style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
                  <button
                    onClick={() => setVisor({ url: p.previewUrl, tipo: p.tipo, titulo: "FOTO PRA ENVIAR", cor: "#FBBF24" })}
                    style={{
                      width: "100%", height: "100%", padding: 0,
                      border: "1px solid #FBBF2466", background: "#000",
                      cursor: "pointer", overflow: "hidden",
                    }}>
                    {p.tipo === "video" ? (
                      <video src={p.previewUrl} preload="metadata" muted playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                    ) : (
                      <img src={p.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                  </button>
                  <button
                    onClick={() => removerPend(i)} disabled={busy} aria-label="Tirar esta foto do envio"
                    style={{
                      position: "absolute", top: -6, right: -6, width: 22, height: 22,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: T.bg, border: `1px solid ${T.borderHover}`, color: T.textPrimary,
                      cursor: busy ? "not-allowed" : "pointer", padding: 0, borderRadius: "50%",
                    }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setCam(true)} disabled={busy} style={{
            width: "100%", padding: "9px 12px", marginBottom: 8,
            background: "transparent", border: `1px dashed ${T.borderHover}`, color: T.textSecondary,
            fontSize: 10, letterSpacing: "0.14em", fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Camera size={12} /> ADICIONAR MAIS FOTOS
          </button>
          {faltamMidias === 0 ? (
            <button onClick={() => enviar(true)} disabled={busy} style={{
              width: "100%", padding: "12px 14px", marginBottom: 8,
              background: "#34D399", color: "#052e22", border: "none",
              fontSize: 11, letterSpacing: "0.16em", fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
            }}>
              {busy ? "ENVIANDO…" : "AMBIENTE FINALIZADO"}
            </button>
          ) : (
            <div style={{
              marginBottom: 8, padding: "10px 12px",
              border: "1px dashed #FBBF2466", color: "#FBBF24", fontSize: 11, lineHeight: 1.5,
            }}>
              Pra finalizar são {MIN_MIDIAS} fotos ou vídeos: {pends.length > 1 ? "com essas" : "com essa"}, {faltamMidias === 1 ? "falta 1" : `faltam ${faltamMidias}`}.
            </div>
          )}
          <input
            value={qtdStr} onChange={(e) => setQtdStr(e.target.value)}
            inputMode="decimal"
            placeholder={qtd > 0 ? `Quanto você fez hoje (${item.unidade ?? "m²"}) · falta ${restante.toFixed(2)}` : `Quanto você fez hoje (${item.unidade ?? "m²"}) · opcional`}
            style={{
              width: "100%", boxSizing: "border-box", padding: "11px 12px", marginBottom: 8,
              background: T.inputBg, border: `1px solid ${T.border}`,
              color: T.textPrimary, fontSize: 12, outline: "none",
            }}
          />
          <button onClick={() => enviar(false)} disabled={busy} style={{
            width: "100%", padding: "12px 14px", marginBottom: 8,
            background: T.textPrimary, color: T.bg,
            border: "none", fontSize: 11, letterSpacing: "0.16em", fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
          }}>
            {busy ? "ENVIANDO…" : pends.length > 1 ? `ENVIAR ${pends.length} FOTOS · AINDA EXECUTANDO` : "ENVIAR FOTO · AINDA EXECUTANDO"}
          </button>
          <button onClick={fechar} disabled={busy} style={{
            width: "100%", padding: 8, background: "transparent", border: "none",
            color: T.textMuted, fontSize: 10, letterSpacing: "0.18em", cursor: "pointer",
          }}>
            CANCELAR
          </button>
        </div>
      )}

      {panel === "confirmar" && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          {midiasEfetivas < MIN_MIDIAS ? (
            <>
              <p style={{ fontSize: 9, letterSpacing: "0.18em", color: "#FBBF24", marginBottom: 10 }}>
                PRA FINALIZAR PRECISA DE {MIN_MIDIAS} FOTOS OU VÍDEOS
              </p>
              <p style={{ fontSize: 11, color: T.textSecondary, marginBottom: 10, lineHeight: 1.5 }}>
                Você enviou {midiasEfetivas} de {MIN_MIDIAS}. Registre o ambiente pronto pela câmera pra liberar a finalização.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setPanel(null); setCam(true); }} disabled={busy} style={{
                  flex: 1, padding: "12px 14px",
                  background: "transparent", border: `1px solid ${T.borderHover}`, color: T.textPrimary,
                  fontSize: 11, letterSpacing: "0.16em", fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <Camera size={13} /> ENVIAR MÍDIA
                </button>
                <button onClick={fechar} disabled={busy} style={{
                  padding: "12px 14px", background: "transparent",
                  border: `1px solid ${T.border}`, color: T.textMuted,
                  fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, cursor: "pointer",
                }}>
                  VOLTAR
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 10 }}>
                FINALIZAR ESTE AMBIENTE?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => enviar(true)} disabled={busy} style={{
                  flex: 1, padding: "12px 14px",
                  background: "#34D399", color: "#052e22", border: "none",
                  fontSize: 11, letterSpacing: "0.16em", fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
                }}>
                  {busy ? "ENVIANDO…" : "SIM, FINALIZAR"}
                </button>
                <button onClick={fechar} disabled={busy} style={{
                  padding: "12px 14px", background: "transparent",
                  border: `1px solid ${T.border}`, color: T.textMuted,
                  fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, cursor: "pointer",
                }}>
                  VOLTAR
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Câmera in-app: getUserMedia pede autorização e devolve File[] direto;
          o input file escondido fica como fallback de galeria */}
      {cam && (
        <CameraCapture
          allowVideo multiple
          onFiles={(fs) => { setCam(false); addFiles(fs); }}
          onFallback={() => { setCam(false); inputRef.current?.click(); }}
          onClose={() => setCam(false)}
        />
      )}

      {/* Visor genérico em tela cheia: foto do fiscal, foto/vídeo da galeria de envios ou
          preview de mídia pendente (app de campo: nada abre em aba) */}
      {visor && (
        <div onClick={() => setVisor(null)} style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.88)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 16, gap: 12,
        }}>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", color: visor.cor, textTransform: "uppercase" }}>
            {visor.titulo} · TOQUE PRA FECHAR
          </div>
          {visor.tipo === "video" ? (
            <video
              src={visor.url} controls playsInline autoPlay
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "100%", maxHeight: "86vh", background: "#000",
                border: `1px solid ${visor.cor}`,
              }}
            />
          ) : (
            <img src={visor.url} alt={visor.titulo} style={{
              maxWidth: "100%", maxHeight: "86vh", objectFit: "contain",
              border: `1px solid ${visor.cor}`,
            }} />
          )}
        </div>
      )}

      {showFicha && fichas.length > 0 && (
        <div onClick={() => setShowFicha(false)} style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.72)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "100%", maxWidth: 560, maxHeight: "82vh", overflowY: "auto",
            background: T.bg, border: `1px solid ${T.border}`, borderBottom: "none",
            padding: "18px 18px 24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: T.textMuted }}>
                FICHA{fichas.length > 1 ? `S TÉCNICAS · ${fichas.length}` : " TÉCNICA"}
              </div>
              <button onClick={() => setShowFicha(false)} style={{
                ...iconBtn(T), flexShrink: 0,
              }}>
                <X size={14} />
              </button>
            </div>
            {fichas.map((f, fi) => {
              const m2 = /m²|m2/i.test(item.unidade ?? "") ? Number(item.quantidade ?? 0) : 0;
              const cola = f.consumo_cola_m2 && m2 > 0 ? f.consumo_cola_m2 * m2 : null;
              const yt = f.video_url ? ytEmbed(f.video_url) : null;
              return (
                <div key={f.id} style={{ marginTop: fi === 0 ? 10 : 22, paddingTop: fi === 0 ? 0 : 18, borderTop: fi === 0 ? "none" : `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 4 }}>
                    {f.categoria}{f.material ? ` · ${f.material}` : ""}
                  </div>
                  <div style={{ fontSize: 14, color: T.textPrimary }}>{f.titulo}</div>
                  {cola != null && (
                    <div style={{
                      marginTop: 10, padding: "10px 12px",
                      background: "#FBBF2414", border: "1px solid #FBBF2455",
                      fontSize: 12, color: "#FBBF24", lineHeight: 1.5,
                    }}>
                      Consumo estimado pra este item:{" "}
                      <strong>{cola.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg de cola</strong>
                      {" "}({f.consumo_cola_m2!.toLocaleString("pt-BR")} kg/m² × {m2.toLocaleString("pt-BR")} m²)
                    </div>
                  )}
                  <div style={{ marginTop: 12 }}>
                    <Markdown text={f.corpo_md || f.conteudo} T={T} />
                  </div>
                  {f.video_url && (
                    <div style={{ marginTop: 12 }}>
                      {yt ? (
                        <iframe src={yt} title={f.titulo} allowFullScreen style={{
                          width: "100%", aspectRatio: "16/9", border: `1px solid ${T.border}`,
                        }} />
                      ) : (
                        <video src={f.video_url} controls playsInline preload="metadata" style={{
                          width: "100%", maxHeight: 300, background: "#000", border: `1px solid ${T.border}`,
                        }} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item, numero, T, prestadorId, cardId, checkinId, onChanged, readOnly,
}: {
  item: Item; numero: string; T: any; prestadorId: string; cardId: string;
  checkinId: string | null; onChanged: () => void; readOnly?: ReadOnlyMode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "midia" | "confirmar">(null);
  const [pend, setPend] = useState<File | null>(null);
  const [qtdStr, setQtdStr] = useState("");
  // cam: visor de câmera in-app (getUserMedia); o input file vira só fallback de galeria
  const [cam, setCam] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Galeria: mídias deste item que JÁ CHEGARAM no servidor (instala_item_checks.foto_url).
  // O prestador vê a prova visual de que a foto subiu, igual à galeria do fluxo gestão.
  const [fotos, setFotos] = useState<{ id: string; foto_url: string }[]>([]);
  // Visor fullscreen da galeria (app de campo: nada abre em aba nova)
  const [visor, setVisor] = useState<{ url: string; tipo: "foto" | "video" } | null>(null);
  // Bump após envio ok pra galeria recarregar na hora, sem esperar o reload do pai
  const [galTick, setGalTick] = useState(0);

  // Busca as mídias já anexadas deste item (checks com foto_url preenchida)
  useEffect(() => {
    let vivo = true;
    sb.from("instala_item_checks")
      .select("id,foto_url")
      .eq("servico_id", item.servico_id)
      .eq("card_id", cardId)
      .not("foto_url", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (vivo) setFotos((data ?? []).filter((f) => f.foto_url) as { id: string; foto_url: string }[]);
      });
    return () => { vivo = false; };
  }, [item.servico_id, cardId, galTick]);

  const restante = Math.max(0, Number(item.contrato_qtd) - Number(item.qtd_instalada));
  const midias = Number(item.midias ?? 0);
  const faltamMidias = Math.max(0, MIN_MIDIAS - midias - (pend ? 1 : 0));
  const concluido = restante <= 0;
  const emExecucao = !concluido && Number(item.qtd_instalada) > 0;
  const stCor = concluido ? "#34D399" : emExecucao ? "#60A5FA" : "#FBBF24";
  const stLabel = concluido ? "finalizado" : emExecucao ? "executando" : "pendente";

  // Valida e assume a mídia pendente (vem da câmera in-app OU do fallback de galeria)
  async function addFile(file: File) {
    setErr(null);
    try {
      await validarMidia(file);
      setPend(file);
      setQtdStr(restante.toFixed(2));
      setPanel("midia");
    } catch (er: any) {
      setErr(er?.message ?? "Não consegui ler a mídia");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await addFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function enviar(finalizado: boolean) {
    if (busy) return;
    let qtdEnvio = restante;
    if (!finalizado) {
      const n = Number(qtdStr.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) { setErr("Quantidade inválida"); return; }
      qtdEnvio = n;
    }
    setBusy(true); setErr(null); setOk(null);
    try {
      // Pega geolocalização (best-effort)
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 8000 })
        );
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {}

      const ck = crypto.randomUUID();
      const ext = pend ? (pend.name.split(".").pop()?.toLowerCase() || (pend.type.startsWith("video/") ? "mp4" : "jpg")) : null;
      const r = await submitOrQueue({
        client_key: ck,
        kind: "sb_insert",
        endpoint: "instala_item_checks",
        body: {
          servico_id: item.servico_id,
          prestador_id: prestadorId,
          checkin_id: checkinId,
          card_id: cardId,
          qtd_concluida: qtdEnvio,
          foto_url: null,
          lat, lng,
        },
        files: pend ? [{
          field: "foto_url",
          bucketPath: `instala/${cardId}/${item.servico_id}/${ck}.${ext}`,
          blob: pend,
          contentType: pend.type || "application/octet-stream",
        }] : [],
        label: `Medição · ${item.descricao}`,
        obra_id: cardId,
      });
      setPanel(null); setPend(null); setQtdStr("");
      if (r === "queued") setOk("Salvo no aparelho · enviando quando pegar sinal.");
      // Recarrega a galeria na hora (se subiu direto, a mídia nova já aparece)
      setGalTick((t) => t + 1);
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao registrar item");
    } finally {
      setBusy(false);
    }
  }

  function fechar() { setPanel(null); setPend(null); setQtdStr(""); setErr(null); }

  return (
    <div style={{
      border: `1px solid ${concluido ? "#34D39944" : T.border}`,
      background: concluido ? "#34D39908" : T.cardBg,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: T.textPrimary, marginBottom: 4, lineHeight: 1.45 }}>
            {numero} · {item.descricao}
          </div>
          <div style={{ fontSize: 11, color: T.textSecondary, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>· {Number(item.qtd_instalada).toFixed(2)} / {Number(item.contrato_qtd).toFixed(2)} {item.unidade}</span>
            <span>· {item.pct_concluido}%</span>
            {!concluido && (
              <span style={{ color: midias >= MIN_MIDIAS ? "#34D399" : T.textMuted }}>
                · {midias}/{MIN_MIDIAS} mídias
              </span>
            )}
          </div>
          {/* Barra + "FALTA X" em destaque (mesmo padrão do card de item do gestão) */}
          {(() => {
            const un = item.unidade || "m²";
            const fmt = (n: number) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const pct = Number(item.pct_concluido) || 0;
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4,
                }}>
                  <span style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, fontWeight: 600 }}>
                    PROGRESSO · {fmt(item.qtd_instalada)} / {fmt(item.contrato_qtd)} {un}
                  </span>
                  {!concluido && restante > 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24" }}>
                      FALTA {fmt(restante)} {un}
                    </span>
                  ) : concluido ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#34D399", letterSpacing: "0.14em" }}>
                      FINALIZADO
                    </span>
                  ) : null}
                </div>
                <div style={{ height: 6, background: T.statBg, overflow: "hidden", borderRadius: 2 }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: concluido ? "#34D399" : pct > 0 ? "#FBBF24" : T.textPrimary,
                    transition: "width .4s",
                  }} />
                </div>
              </div>
            );
          })()}
          {/* Galeria das mídias já anexadas: thumbnails dos checks com foto_url.
              Toque abre no visor fullscreen (nada abre em aba nova no app de campo) */}
          {fotos.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto", paddingBottom: 2 }}>
              {fotos.map((f) => {
                // Extensão da URL decide o elemento: vídeo (mp4/webm/mov) ou imagem
                const ehVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(f.foto_url);
                return (
                  <button key={f.id}
                    onClick={() => setVisor({ url: f.foto_url, tipo: ehVideo ? "video" : "foto" })}
                    style={{
                      width: 56, height: 56, flexShrink: 0, padding: 0,
                      border: `1px solid ${T.border}`, background: "#000",
                      cursor: "pointer", overflow: "hidden",
                    }}>
                    {ehVideo ? (
                      <video src={f.foto_url} preload="metadata" muted playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                    ) : (
                      <img src={f.foto_url} alt="" loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {/* Sem check-in do dia os botões de envio ficam escondidos: explica o porquê
              e aponta pro banner de chegada no topo (em consulta não mostra nada) */}
          {!concluido && readOnly === "checkin" && (
            <div style={{ marginTop: 10, fontSize: 10, color: "#FBBF24", lineHeight: 1.5 }}>
              Registre a chegada lá em cima pra liberar as fotos e o progresso deste item.
            </div>
          )}
          {err && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#ef4444" }}>{err}</div>
          )}
          {ok && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#FBBF24" }}>{ok}</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <span style={{
            fontSize: 9, letterSpacing: "0.12em", fontWeight: 600,
            color: stCor, whiteSpace: "nowrap", textTransform: "uppercase",
          }}>
            {stLabel}
          </span>
          {!concluido && !readOnly && (
            <>
              {/* Abre a câmera in-app (getUserMedia pede autorização); input escondido é o fallback de galeria */}
              <button onClick={() => setCam(true)} disabled={busy} aria-label="Registrar mídia" style={{
                ...iconBtn(T),
                cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
              }}>
                <Camera size={14} />
              </button>
              <input
                ref={inputRef} type="file" accept="image/*,video/*"
                style={{ display: "none" }} onChange={onFile} disabled={busy}
              />
              <button onClick={() => { setErr(null); setPanel(panel === "confirmar" ? null : "confirmar"); }}
                disabled={busy} aria-label="Finalizar ambiente" style={{
                ...iconBtn(T), color: "#34D399", borderColor: "#34D39955",
                cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
              }}>
                <CheckCircle2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {panel === "midia" && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 10 }}>
            MÍDIA PRONTA · COMO FICOU O AMBIENTE?
          </p>
          {faltamMidias === 0 ? (
            <button onClick={() => enviar(true)} disabled={busy} style={{
              width: "100%", padding: "12px 14px", marginBottom: 8,
              background: "#34D399", color: "#052e22", border: "none",
              fontSize: 11, letterSpacing: "0.16em", fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
            }}>
              {busy ? "ENVIANDO…" : "AMBIENTE FINALIZADO"}
            </button>
          ) : (
            <div style={{
              marginBottom: 8, padding: "10px 12px",
              border: "1px dashed #FBBF2466", color: "#FBBF24", fontSize: 11, lineHeight: 1.5,
            }}>
              Pra finalizar são {MIN_MIDIAS} fotos ou vídeos: com essa, {faltamMidias === 1 ? "falta 1" : `faltam ${faltamMidias}`}.
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={qtdStr} onChange={(e) => setQtdStr(e.target.value)}
              inputMode="decimal" placeholder={`Qtd de agora (${item.unidade})`}
              style={{
                flex: 1, minWidth: 0, padding: "11px 12px",
                background: T.inputBg, border: `1px solid ${T.border}`,
                color: T.textPrimary, fontSize: 12, outline: "none",
              }}
            />
            <button onClick={() => enviar(false)} disabled={busy} style={{
              padding: "11px 14px", background: "transparent",
              border: `1px solid ${T.borderHover}`, color: T.textPrimary,
              fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, whiteSpace: "nowrap",
              cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
            }}>
              {busy ? "…" : "AINDA EXECUTANDO"}
            </button>
          </div>
          <button onClick={fechar} disabled={busy} style={{
            width: "100%", padding: 8, background: "transparent", border: "none",
            color: T.textMuted, fontSize: 10, letterSpacing: "0.18em", cursor: "pointer",
          }}>
            CANCELAR
          </button>
        </div>
      )}

      {panel === "confirmar" && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          {midias < MIN_MIDIAS ? (
            <>
              <p style={{ fontSize: 9, letterSpacing: "0.18em", color: "#FBBF24", marginBottom: 10 }}>
                PRA FINALIZAR PRECISA DE {MIN_MIDIAS} FOTOS OU VÍDEOS
              </p>
              <p style={{ fontSize: 11, color: T.textSecondary, marginBottom: 10, lineHeight: 1.5 }}>
                Você enviou {midias} de {MIN_MIDIAS}. Registre o ambiente pronto pela câmera pra liberar a finalização.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setPanel(null); setCam(true); }} disabled={busy} style={{
                  flex: 1, padding: "12px 14px",
                  background: "transparent", border: `1px solid ${T.borderHover}`, color: T.textPrimary,
                  fontSize: 11, letterSpacing: "0.16em", fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <Camera size={13} /> ENVIAR MÍDIA
                </button>
                <button onClick={fechar} disabled={busy} style={{
                  padding: "12px 14px", background: "transparent",
                  border: `1px solid ${T.border}`, color: T.textMuted,
                  fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, cursor: "pointer",
                }}>
                  VOLTAR
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 10 }}>
                FINALIZAR ESTE AMBIENTE?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => enviar(true)} disabled={busy} style={{
                  flex: 1, padding: "12px 14px",
                  background: "#34D399", color: "#052e22", border: "none",
                  fontSize: 11, letterSpacing: "0.16em", fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
                }}>
                  {busy ? "ENVIANDO…" : "SIM, FINALIZAR"}
                </button>
                <button onClick={fechar} disabled={busy} style={{
                  padding: "12px 14px", background: "transparent",
                  border: `1px solid ${T.border}`, color: T.textMuted,
                  fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, cursor: "pointer",
                }}>
                  VOLTAR
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Visor de câmera in-app: mídia única por medição (pend), foto ou vídeo */}
      {cam && (
        <CameraCapture
          allowVideo
          onFiles={(fs) => { setCam(false); if (fs[0]) addFile(fs[0]); }}
          onFallback={() => { setCam(false); inputRef.current?.click(); }}
          onClose={() => setCam(false)}
        />
      )}

      {/* Visor fullscreen da galeria: foto/vídeo já anexado abre em tela cheia no app */}
      {visor && (
        <div onClick={() => setVisor(null)} style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.88)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 16, gap: 12,
        }}>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#FBBF24", textTransform: "uppercase" }}>
            MÍDIA ENVIADA · TOQUE PRA FECHAR
          </div>
          {visor.tipo === "video" ? (
            <video
              src={visor.url} controls playsInline autoPlay
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "100%", maxHeight: "86vh", background: "#000",
                border: "1px solid #FBBF24",
              }}
            />
          ) : (
            <img src={visor.url} alt="Mídia enviada" style={{
              maxWidth: "100%", maxHeight: "86vh", objectFit: "contain",
              border: "1px solid #FBBF24",
            }} />
          )}
        </div>
      )}
    </div>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});
