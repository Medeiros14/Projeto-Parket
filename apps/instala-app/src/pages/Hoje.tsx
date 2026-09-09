import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronRight, LogOut, Sun, Moon, RefreshCw, Phone, CheckCircle2, Clock, HardHat } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { BottomNav } from "../app/components/BottomNav";
import { EnderecoAcoes } from "../app/components/EnderecoAcoes";

const GESTAO_API = "https://gestao.parket.works";

const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY = "'Inter', sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";

type ObraDoDia = {
  atribuicao_id: string;
  card_id: string;
  obra_code: string | null;
  cliente_nome: string;
  cidade: string | null;
  data_prevista_inicio: string;
  hora_prevista_inicio: string | null;
  presenca_status: string | null;
  progress_atual: number | null;
  atribuicao_status: string | null;
  observacao: string | null;
  endereco: string | null;
  arquiteto: string | null;
  fiscal: string | null;
  card_column: string | null;
};

type CardDetails = {
  id: string;
  details: any;
};

type Checkin = { card_id: string; created_at: string };
type ItemCheck = { card_id: string; qtd_concluida: number; created_at: string };
type Servico = { obra_id: string; contrato_qtd: number };

type GestaoInfo = {
  obra_code: string | null;
  numero_proposta: string | null;
  pct_completo: number;
  n_entregues: number;
  n_em_execucao: number;
  n_total: number;
};

type ObraEnriched = ObraDoDia & {
  _details: any;
  _nCheckins: number;
  _nItens: number;
  _pct: number;
  _ultima: string | null;
  _g: GestaoInfo | null;
};

function slugify(nome: string) {
  return nome.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Compara sem acento e sem caixa: o fiscal digita "sao paulo" e acha "São Paulo".
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// obra_code às vezes vem com o UUID do card (import antigo). UUID não é código
// legível pra quem está em obra — melhor esconder do que estampar hash no card.
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function codigoLegivel(code: string | null | undefined): string | null {
  const c = (code ?? "").trim();
  if (!c || RE_UUID.test(c)) return null;
  return c;
}

// Junta endereço + cidade sem repetir: muitos endereços já terminam com a
// cidade ("... BRASILIA-DF"), e o card saía com "BRASILIA · BRASILIA".
function localLegivel(endereco?: string | null, cidade?: string | null): string {
  const e = (endereco ?? "").trim();
  const c = (cidade ?? "").trim();
  if (!e) return c;
  if (!c || norm(e).includes(norm(c))) return e;
  return `${e} · ${c}`;
}

// Quantas obras da empresa desenham de uma vez. O resto entra no "Ver mais":
// sao centenas de cards e o celular do instalador nao aguenta tudo de uma vez.
const PAGINA_TODAS = 30;

function fmtRel(dt: string | null): string {
  if (!dt) return "sem atividade";
  const diff = Date.now() - new Date(dt).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(dt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function Hoje() {
  const { prestador, signOut } = useAuth();
  const { mode, T, toggle } = useTheme();
  const nav = useNavigate();
  const [obras, setObras] = useState<ObraEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  // Fiscal: alcanca qualquer obra da empresa pra fazer registro.
  const podeVerTodas = prestador?.ve_todas_obras === true;
  const [busca, setBusca] = useState("");
  // Obras na coluna Acompanhamento de Obras (vinculo 'aberto'), so pro fiscal.
  // Vem crua da view, sem o enriquecimento pesado: cada lote de enriquecimento
  // dispara 5 consultas com os card_id na URL.
  const [todas, setTodas] = useState<ObraDoDia[]>([]);
  const [visiveis, setVisiveis] = useState(PAGINA_TODAS);

  // Enriquece um punhado de linhas da view com o que o app mostra no card:
  // details do kanban, check-ins, itens conferidos e a % oficial do gestao.
  // Recebe a lista ja recortada porque os .in() abaixo viram URL — mandar
  // centenas de card_id de uma vez estoura o limite do PostgREST.
  const enriquecer = useCallback(async (rows: ObraDoDia[]): Promise<ObraEnriched[]> => {
    if (rows.length === 0) return [];
    const cardIds = rows.map(r => r.card_id);
    const obraCodes = rows.map(r => r.obra_code).filter(Boolean) as string[];
    const [
      { data: kcRows },
      { data: checkins },
      { data: itens },
      { data: servicos },
      gestaoMap,
    ] = await Promise.all([
      sb.from("kanban_cards").select("id, details").in("id", cardIds),
      sb.from("instala_checkins").select("card_id, created_at").in("card_id", cardIds).order("created_at", { ascending: false }).limit(500),
      sb.from("instala_item_checks").select("card_id, qtd_concluida, created_at").in("card_id", cardIds).order("created_at", { ascending: false }).limit(1000),
      obraCodes.length
        ? sb.from("prestadores_obra_servicos").select("obra_id, contrato_qtd").in("obra_id", obraCodes)
        : Promise.resolve({ data: [] as Servico[] }),
      // Progresso real do gestão (fonte oficial da %) — best-effort
      fetch(`${GESTAO_API}/api/fiscal/obras-no-gestao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_ids: cardIds }),
      }).then(r => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<Record<string, GestaoInfo>>,
    ]);
    const detailsMap = new Map<string, any>();
    (kcRows as CardDetails[] || []).forEach(r => detailsMap.set(r.id, r.details || {}));
    const checkinsByCard = new Map<string, Checkin[]>();
    (checkins as Checkin[] || []).forEach(c => {
      if (!checkinsByCard.has(c.card_id)) checkinsByCard.set(c.card_id, []);
      checkinsByCard.get(c.card_id)!.push(c);
    });
    const itensByCard = new Map<string, ItemCheck[]>();
    (itens as ItemCheck[] || []).forEach(it => {
      if (!itensByCard.has(it.card_id)) itensByCard.set(it.card_id, []);
      itensByCard.get(it.card_id)!.push(it);
    });
    const contratoByObra = new Map<string, number>();
    (servicos as Servico[] || []).forEach(s => {
      contratoByObra.set(s.obra_id, (contratoByObra.get(s.obra_id) || 0) + Number(s.contrato_qtd || 0));
    });
    const instaladoByCard = new Map<string, number>();
    (itens as ItemCheck[] || []).forEach(it => {
      instaladoByCard.set(it.card_id, (instaladoByCard.get(it.card_id) || 0) + Number(it.qtd_concluida || 0));
    });
    const enriched: ObraEnriched[] = rows.map(o => {
      const det = detailsMap.get(o.card_id) || {};
      const cs = checkinsByCard.get(o.card_id) || [];
      const its = itensByCard.get(o.card_id) || [];
      const g = (gestaoMap || {})[o.card_id] || null;
      const contrato = o.obra_code ? contratoByObra.get(o.obra_code) || 0 : 0;
      const instalado = instaladoByCard.get(o.card_id) || 0;
      // % oficial vem do gestão (pct ponderado por qtd instalada); fallback pro cálculo antigo
      const pct = det.obra_concluida
        ? 100
        : g && g.n_total > 0
        ? Math.min(100, Math.round(Number(g.pct_completo)))
        : contrato > 0 ? Math.min(100, Math.round((instalado / contrato) * 100)) : (o.progress_atual ?? 0);
      const dates = [...cs.map(c => c.created_at), ...its.map(i => i.created_at)].filter(Boolean).map(x => new Date(x).getTime());
      const ultima = dates.length ? new Date(Math.max(...dates)).toISOString() : null;
      return {
        ...o,
        obra_code: o.obra_code || (g?.numero_proposta ? `PROPOSTA ${g.numero_proposta}` : null),
        _details: det, _nCheckins: cs.length, _nItens: its.length, _pct: pct, _ultima: ultima, _g: g,
      };
    }).sort((a, b) => {
      // Mesma ordem do app do fiscal: % crescente; empate = atividade mais recente primeiro
      if (a._pct !== b._pct) return a._pct - b._pct;
      const at = a._ultima ? new Date(a._ultima).getTime() : 0;
      const bt = b._ultima ? new Date(b._ultima).getTime() : 0;
      return bt - at;
    });
    return enriched;
  }, []);

  // Duas listas: as obras atribuidas a ele (enriquecidas, e onde ele trabalha)
  // e, pro fiscal, as obras em andamento logo abaixo. O fiscal precisa achar
  // qualquer obra em execucao sem depender de alguem atribuir ele antes.
  const fetchObras = useCallback(async () => {
    if (!prestador?.id) return;
    setLoading(true);
    const [{ data: baseObras }, { data: baseTodas }] = await Promise.all([
      sb.from("vw_instala_minhas_obras")
        .select("*")
        .eq("prestador_id", prestador.id)
        .eq("vinculo", "atribuido")
        .limit(300),
      podeVerTodas
        ? sb.from("vw_instala_minhas_obras")
            .select("*")
            .eq("prestador_id", prestador.id)
            .eq("vinculo", "aberto")
            // Obra em execucao mora na coluna Acompanhamento de Obras do
            // operacional. Sem esse corte a lista virava o funil inteiro
            // (contrato novo, projeto executivo, finalizado) e o fiscal
            // perdia de vista as obras onde ele realmente entra.
            .eq("card_column", "acompanhamento")
            .order("cliente_nome")
            .limit(3000)
        : Promise.resolve({ data: [] as ObraDoDia[] }),
    ]);
    setObras(await enriquecer((baseObras as ObraDoDia[]) ?? []));
    setTodas((baseTodas as ObraDoDia[]) ?? []);
    setVisiveis(PAGINA_TODAS);
    setLoading(false);
  }, [prestador?.id, podeVerTodas, enriquecer]);

  useEffect(() => { fetchObras(); }, [fetchObras]);

  // Filtro da lista da empresa. Roda na memoria porque a lista inteira ja veio:
  // resultado sai enquanto ele digita, sem ida ao banco.
  const termo = norm(busca.trim());
  const filtradas = termo.length === 0
    ? todas
    : todas.filter(o =>
        norm(o.cliente_nome).includes(termo) ||
        norm(o.obra_code).includes(termo) ||
        norm(o.cidade).includes(termo) ||
        norm(o.endereco).includes(termo));

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  })();

  // Altura via classe .hoje-page: 100vh com fallback 100dvh (Chrome + zoom corta
  // a tela com 100vh cru; inline style não aceita a declaração dupla).
  return (
    <div className="hoje-page" style={{ background: T.bg, color: T.textPrimary, fontFamily: FONT_BODY }}>
      <header style={{
        padding: "20px 22px 16px", borderBottom: `1px solid ${T.border}`,
        background: T.headerBg, backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 4 }}>{greeting.toUpperCase()}</p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 500, letterSpacing: "0.06em", color: T.textPrimary }}>
            {prestador?.nome?.split(" ")[0] ?? "Instalador"}
          </h1>
          {prestador?.categoria && (
            <p style={{ fontSize: 10, letterSpacing: "0.18em", color: T.textSecondary, marginTop: 4, textTransform: "uppercase" }}>
              {prestador.categoria}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchObras} title="Atualizar" style={iconBtn(T)}><RefreshCw size={14} className={loading ? "spin" : ""} /></button>
          <button onClick={toggle} title="Tema" style={iconBtn(T)}>{mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}</button>
          <button onClick={signOut} title="Sair" style={iconBtn(T)}><LogOut size={14} /></button>
        </div>
      </header>

      <main style={{ padding: "20px 22px 120px" }}>
        <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 16 }}>
          {podeVerTodas ? "ATRIBUÍDAS A VOCÊ" : "TODAS AS OBRAS SUAS"} · {obras.length}
        </p>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 120, background: T.statBg, border: `1px solid ${T.border}` }} />)}
          </div>
        ) : obras.length === 0 ? (
          <div style={{ padding: "40px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
            {podeVerTodas
              ? "Nenhuma obra atribuída a você. As obras em acompanhamento estão logo abaixo."
              : "Nenhuma obra atribuída ainda."}
          </div>
        ) : (() => {
          const grupos: [string, ObraEnriched[]][] = [
            ["NÃO INICIADAS", obras.filter(o => o._pct === 0)],
            ["EM EXECUÇÃO", obras.filter(o => o._pct > 0 && o._pct < 100)],
            ["CONCLUÍDAS", obras.filter(o => o._pct >= 100)],
          ];
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {grupos.map(([titulo, lista]) => lista.length === 0 ? null : (
                <div key={titulo} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginTop: 6 }}>
                    {titulo} · {lista.length}
                  </p>
                  {lista.map(o => <ObraCardPainel key={o.atribuicao_id} obra={o} T={T} onClick={() => nav(`/obra/${o.card_id}?ver=1`)} />)}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Obras em andamento: so pro fiscal, que registra em qualquer uma. */}
        {podeVerTodas && (
          <div style={{ marginTop: 28 }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 4 }}>
              ACOMPANHAMENTO DE OBRAS · {filtradas.length}
            </p>
            {/* Deixa claro pro fiscal o que essa lista significa: sao obras da
                empresa, ele registra nelas mas nao recebe por elas. */}
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
              Todas as obras em execução da empresa. Você entra pra registrar, mas não ganha por elas.
            </p>
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setVisiveis(PAGINA_TODAS); }}
              placeholder="Filtrar por cliente, código, cidade ou endereço"
              style={{
                width: "100%", padding: "12px 14px", background: T.statBg,
                border: `1px solid ${T.border}`, color: T.textPrimary,
                fontFamily: FONT_BODY, fontSize: 13, outline: "none", marginBottom: 12,
              }}
            />
            {filtradas.length === 0 ? (
              <div style={{ padding: "24px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
                {loading ? "Carregando obras..." : "Nenhuma obra encontrada com esse termo."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtradas.slice(0, visiveis).map(o => (
                  <ObraCardLeve key={o.atribuicao_id} obra={o} T={T} onClick={() => nav(`/obra/${o.card_id}?ver=1`)} />
                ))}
              </div>
            )}
            {visiveis < filtradas.length && (
              <button
                onClick={() => setVisiveis(v => v + PAGINA_TODAS)}
                style={{
                  width: "100%", marginTop: 12, padding: "12px 14px", background: T.statBg,
                  border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer",
                  fontFamily: FONT_BODY, fontSize: 11, letterSpacing: "0.16em",
                }}
              >
                VER MAIS {Math.min(PAGINA_TODAS, filtradas.length - visiveis)} DE {filtradas.length - visiveis}
              </button>
            )}
          </div>
        )}
      </main>

      {prestador?.nome && <BottomNav slug={slugify(prestador.nome)} />}

      <style>{`.hoje-page { min-height: 100vh; min-height: 100dvh; } .spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Linha compacta da lista de toda a empresa. Usa so o que a view ja entrega
// (sem check-ins nem % do gestao), pra centenas de obras caberem numa tela so.
function ObraCardLeve({ obra, T, onClick }: { obra: ObraDoDia; T: any; onClick: () => void }) {
  const pct = obra.progress_atual ?? 0;
  const local = localLegivel(obra.endereco, obra.cidade);
  const etapa = (obra.card_column || "").replace(/-/g, " ");
  // Linha de rótulo só com o que presta: código legível e/ou etapa (UUID fora).
  const rotulo = [codigoLegivel(obra.obra_code), etapa].filter(Boolean).join(" · ");
  const barCor = pct >= 100 ? "#4a7c59" : pct >= 50 ? T.textSecondary : T.textMuted;

  return (
    <div onClick={onClick} style={{
      background: T.cardBg, border: `1px solid ${T.border}`, padding: "12px 14px",
      cursor: "pointer", display: "flex", flexDirection: "column", gap: 8,
      fontFamily: FONT_BODY, color: T.textPrimary,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = T.cardHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = T.cardBg; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {rotulo && (
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: T.textMuted, textTransform: "uppercase", marginBottom: 3 }}>
              {rotulo}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {obra.cliente_nome}
          </div>
          {local && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, minWidth: 0 }}>
              <MapPin size={12} style={{ color: T.textMuted, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{local}</span>
            </div>
          )}
          {/* Ações Maps/Waze/Copiar quando há endereço de verdade (não só cidade) */}
          {obra.endereco && <EnderecoAcoes endereco={obra.endereco} T={T} />}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500, color: barCor, lineHeight: 1 }}>{pct}%</div>
          <ChevronRight size={13} style={{ color: T.textMuted, marginTop: 4 }} />
        </div>
      </div>
      <div style={{ height: 3, background: T.border }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barCor }} />
      </div>
    </div>
  );
}

function ObraCardPainel({ obra, T, onClick }: { obra: ObraEnriched; T: any; onClick: () => void }) {
  const d = obra._details || {};
  const endereco = obra.endereco || d.endereco || "";
  const cidade = obra.cidade || d.cidade || "";
  const telefone = d.telefone || d.telefone_cliente || "";
  const arquiteto = obra.arquiteto || d.arquiteto || d.arquiteta || "";
  const fiscal = obra.fiscal || d.fiscal || "";
  const prazo = d.prazo_contratual || (d.prazo_inicio && d.prazo_fim ? `${d.prazo_inicio} a ${d.prazo_fim}` : (d.previsao_inicio || ""));
  const barCor = obra._pct >= 100 ? "#4a7c59" : obra._pct >= 50 ? T.textSecondary : T.textMuted;
  const hasInfoCliente = endereco || cidade || telefone || arquiteto || fiscal || prazo;
  // Código de exibição: obra_code legível ou nº da proposta; UUID fica de fora.
  const codigo = codigoLegivel(obra.obra_code) || (obra._g?.numero_proposta ? `PROPOSTA ${obra._g.numero_proposta}` : null);
  const local = localLegivel(endereco, cidade);

  return (
    <div onClick={onClick} style={{
      background: T.cardBg, border: `1px solid ${T.border}`,
      padding: "16px 18px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12,
      fontFamily: FONT_BODY, color: T.textPrimary,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = T.cardHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = T.cardBg; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Só mostra a linha de código quando há código de gente (UUID não conta) */}
          {codigo && (
            <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: T.textMuted, marginBottom: 4 }}>
              {codigo}
            </div>
          )}
          {/* Nome do cliente pode quebrar em até 2 linhas: em campo, ler inteiro vale mais que caber em 1 linha */}
          <div style={{
            fontSize: 17, fontWeight: 500, color: T.textPrimary, lineHeight: 1.25,
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
          }}>
            {obra.cliente_nome}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500, color: barCor, lineHeight: 1 }}>{obra._pct}%</div>
          <div style={{ fontSize: 9, letterSpacing: "0.1em", color: T.textMuted, textTransform: "uppercase" }}>concluído</div>
        </div>
      </div>

      {hasInfoCliente && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "10px 12px", background: T.statBg, borderLeft: `2px solid ${T.textSecondary}` }}>
          {local && (
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <MapPin size={14} style={{ color: T.textMuted, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.45 }}>
                {local}
              </span>
            </div>
          )}
          {/* Ações Maps/Waze/Copiar do endereço da obra */}
          {endereco && <EnderecoAcoes endereco={endereco} T={T} />}
          {telefone && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Phone size={11} style={{ color: T.textMuted }} />
              <a href={`tel:${telefone}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 12, color: T.textSecondary, textDecoration: "none" }}>{telefone}</a>
            </div>
          )}
          {arquiteto && <MiniLine T={T} label="Arquiteto" valor={arquiteto} />}
          {fiscal && <MiniLine T={T} label="Fiscal" valor={fiscal} />}
          {prazo && <MiniLine T={T} label="Prazo" valor={prazo} />}
        </div>
      )}

      <div style={{ height: 6, background: T.border }}>
        <div style={{ height: "100%", width: `${obra._pct}%`, background: barCor, transition: "width .4s" }} />
      </div>

      {/* Stats com ícone lucide (sem emoji — regra global do app) */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.1em", color: T.textMuted, textTransform: "uppercase" }}>
        {obra._g && obra._g.n_total > 0 ? (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <CheckCircle2 size={13} /> {obra._g.n_entregues}/{obra._g.n_total} AMBIENTES
            </span>
            {obra._g.n_total - obra._g.n_entregues > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.textSecondary }}>
                <Clock size={13} /> {obra._g.n_total - obra._g.n_entregues} PRA FAZER
              </span>
            )}
          </>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <HardHat size={13} /> {obra._nCheckins} CHECK-IN{obra._nCheckins === 1 ? "" : "S"}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>{fmtRel(obra._ultima)}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, color: T.textMuted, fontSize: 11, letterSpacing: "0.14em" }}>
        VER MAPA E ITENS <ChevronRight size={16} />
      </div>
    </div>
  );
}

function MiniLine({ T, label, valor }: { T: any; label: string; valor: string }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}>
      <span style={{ fontSize: 9, letterSpacing: "0.14em", color: T.textMuted, textTransform: "uppercase", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valor}</span>
    </div>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});
