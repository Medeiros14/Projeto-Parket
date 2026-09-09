import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, RefreshCw, MapPin, Clock, Camera, LogIn, LogOut, ChevronRight, User } from "lucide-react";
import { sb } from "../lib/supabase";
import { useTheme } from "../lib/theme-context";

// Fix de ícones do Leaflet (vite quebra os defaults)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY = "'Inter', sans-serif";

type Checkin = {
  id: string;
  prestador_id: string;
  card_id: string;
  lat: number | null;
  lng: number | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  foto_url?: string | null;
};

type ItemCheck = {
  id: string;
  prestador_id: string;
  card_id: string | null;
  servico_id: string;
  qtd_concluida: number;
  foto_url: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

type PrestadorMap = Map<string, { nome: string; categoria: string | null; telefone: string | null }>;
type CardMap = Map<string, { obra: string | null; title: string }>;
type ServicoMap = Map<string, { descricao: string; unidade: string }>;

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(points as any, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

export function AdminCentral() {
  const { T } = useTheme();
  const nav = useNavigate();
  const [tab, setTab] = useState<"mapa" | "registros" | "pontos">("mapa");
  const [loading, setLoading] = useState(false);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [itemChecks, setItemChecks] = useState<ItemCheck[]>([]);
  const [prestadores, setPrestadores] = useState<PrestadorMap>(new Map());
  const [cards, setCards] = useState<CardMap>(new Map());
  const [servicos, setServicos] = useState<ServicoMap>(new Map());
  const [filtroReg, setFiltroReg] = useState<"todos" | "ponto" | "itens">("todos");
  const [pontosDe, setPontosDe] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Checkin[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [buscaNome, setBuscaNome] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const sinceTs = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [ch, itc, prs, kc] = await Promise.all([
      sb.from("instala_checkins")
        .select("id,prestador_id,card_id,lat,lng,status,created_at,closed_at,foto_url")
        .gte("created_at", sinceTs)
        .order("created_at", { ascending: false }).limit(400),
      sb.from("instala_item_checks")
        .select("id,prestador_id,card_id,servico_id,qtd_concluida,foto_url,lat,lng,created_at")
        .gte("created_at", sinceTs)
        .order("created_at", { ascending: false }).limit(200),
      sb.from("prestadores").select("id,nome,categoria,telefone").eq("ativo", true).limit(2000),
      sb.from("kanban_cards").select("id,obra,title").limit(3000),
    ]);

    setCheckins((ch.data as Checkin[]) ?? []);
    setItemChecks((itc.data as ItemCheck[]) ?? []);
    const pm: PrestadorMap = new Map();
    for (const p of (prs.data as any[]) ?? []) pm.set(p.id, { nome: p.nome, categoria: p.categoria, telefone: p.telefone });
    setPrestadores(pm);
    const cm: CardMap = new Map();
    for (const c of (kc.data as any[]) ?? []) cm.set(c.id, { obra: c.obra, title: c.title });
    setCards(cm);

    // serviços só dos IDs que apareceram
    const svcIds = Array.from(new Set(((itc.data as ItemCheck[]) ?? []).map((x) => x.servico_id))).filter(Boolean);
    if (svcIds.length > 0) {
      const { data } = await sb.from("prestadores_obra_servicos")
        .select("id,descricao,unidade").in("id", svcIds);
      const sm: ServicoMap = new Map();
      for (const s of (data as any[]) ?? []) sm.set(s.id, { descricao: s.descricao, unidade: s.unidade });
      setServicos(sm);
    } else setServicos(new Map());
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!pontosDe) { setHistorico([]); return; }
    let alive = true;
    (async () => {
      setHistLoading(true);
      const desde = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      const { data } = await sb.from("instala_checkins")
        .select("id,prestador_id,card_id,lat,lng,status,created_at,closed_at,foto_url")
        .eq("prestador_id", pontosDe)
        .gte("created_at", desde)
        .order("created_at", { ascending: false }).limit(200);
      if (alive) { setHistorico((data as Checkin[]) ?? []); setHistLoading(false); }
    })();
    return () => { alive = false; };
  }, [pontosDe]);

  // Pega o check-in mais recente de cada prestador hoje (pino no mapa)
  const checkinsMapa = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const byPrest = new Map<string, Checkin>();
    for (const c of checkins) {
      if (c.lat == null || c.lng == null) continue;
      if (new Date(c.created_at) < hoje) continue;
      if (!byPrest.has(c.prestador_id)) byPrest.set(c.prestador_id, c);
    }
    return Array.from(byPrest.values());
  }, [checkins]);

  const pontos: [number, number][] = checkinsMapa.map((c) => [Number(c.lat), Number(c.lng)] as [number, number]);

  // Linha do tempo unificada (entrada + saída + atividades)
  const registros = useMemo(() => {
    type Reg = {
      kind: "entrou" | "saiu" | "item";
      id: string;
      created_at: string;
      prestador_id: string;
      card_id: string | null;
      duracao_min?: number;
      data: Checkin | ItemCheck;
    };
    const all: Reg[] = [];
    for (const c of checkins) {
      // entrada
      all.push({ kind: "entrou", id: c.id + ":in", created_at: c.created_at, prestador_id: c.prestador_id, card_id: c.card_id, data: c });
      // saída (se já fechou)
      if (c.closed_at) {
        const min = Math.round((new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 60000);
        all.push({ kind: "saiu", id: c.id + ":out", created_at: c.closed_at, prestador_id: c.prestador_id, card_id: c.card_id, duracao_min: min, data: c });
      }
    }
    for (const it of itemChecks) {
      all.push({ kind: "item", id: it.id, created_at: it.created_at, prestador_id: it.prestador_id, card_id: it.card_id, data: it });
    }
    all.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return all;
  }, [checkins, itemChecks]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.textPrimary, fontFamily: FONT_BODY }}>
      <header style={{
        padding: "16px 22px", borderBottom: `1px solid ${T.border}`,
        background: T.headerBg, backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 500,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={() => nav("/admin")} style={iconBtn(T)} aria-label="Voltar">
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>CENTRAL</p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500 }}>
            Localização & Registros
          </h1>
        </div>
        <button onClick={reload} style={iconBtn(T)} aria-label="Atualizar">
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      </header>

      {/* Tabs */}
      <div style={{
        display: "flex", borderBottom: `1px solid ${T.border}`,
        background: T.bg, position: "sticky", top: 64, zIndex: 400,
      }}>
        {[
          { id: "mapa", label: "MAPA AO VIVO", count: checkinsMapa.length },
          { id: "registros", label: "REGISTROS", count: registros.length },
          { id: "pontos", label: "PONTOS", count: prestadores.size },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            flex: 1, padding: "12px 14px", background: "transparent", border: "none",
            color: tab === t.id ? T.textPrimary : T.textMuted,
            fontSize: 10, letterSpacing: "0.22em", fontWeight: 600,
            borderBottom: `2px solid ${tab === t.id ? T.textPrimary : "transparent"}`,
            cursor: "pointer", fontFamily: FONT_BODY,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {t.label} <span style={{ color: T.textMuted, fontWeight: 400 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {tab === "mapa" && (
        <div style={{ position: "relative" }}>
          <div style={{ height: "calc(100vh - 140px)", background: T.statBg }}>
            <MapContainer center={[-23.5505, -46.6333] as [number, number]} zoom={11} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {pontos.length > 0 && <FitBounds points={pontos} />}
              {checkinsMapa.map((c) => {
                const p = prestadores.get(c.prestador_id);
                const card = cards.get(c.card_id);
                return (
                  <Marker key={c.id} position={[Number(c.lat), Number(c.lng)]}>
                    <Popup>
                      <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: "#000" }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{p?.nome ?? "-"}</div>
                        {p?.categoria && <div style={{ color: "#666", fontSize: 11 }}>{p.categoria}</div>}
                        <div style={{ marginTop: 6, color: "#444" }}>
                          {card?.obra && <><strong>{card.obra}</strong> · </>}
                          {card?.title ?? "-"}
                        </div>
                        <div style={{ color: "#777", fontSize: 10, marginTop: 4 }}>
                          {new Date(c.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                          {" · "}{c.status}
                        </div>
                        <a href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-block", marginTop: 6, fontSize: 10, color: "#0ea5e9" }}>
                          Abrir no Google Maps ↗
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
          {checkinsMapa.length === 0 && !loading && (
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              background: T.cardBg, border: `1px solid ${T.border}`,
              padding: "14px 18px", fontSize: 12, color: T.textMuted, textAlign: "center",
              fontFamily: FONT_BODY,
            }}>
              Nenhum check-in com localização hoje.
            </div>
          )}
        </div>
      )}

      {tab === "registros" && (
        <main style={{ padding: "16px 22px 80px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {([
              { id: "todos", label: "TODOS" },
              { id: "ponto", label: "ENTRADA/SAÍDA" },
              { id: "itens", label: "ATIVIDADES" },
            ] as const).map((f) => (
              <button key={f.id} onClick={() => setFiltroReg(f.id)} style={{
                padding: "8px 14px", cursor: "pointer", fontFamily: FONT_BODY,
                fontSize: 10, letterSpacing: "0.14em", fontWeight: 600,
                background: filtroReg === f.id ? T.textPrimary : T.cardBg,
                color: filtroReg === f.id ? T.bg : T.textSecondary,
                border: `1px solid ${filtroReg === f.id ? T.textPrimary : T.border}`,
              }}>
                {f.label}
              </button>
            ))}
          </div>
          {registros.length === 0 && !loading && (
            <div style={{
              padding: "28px 18px", textAlign: "center", color: T.textMuted,
              border: `1px dashed ${T.border}`, fontSize: 12,
            }}>
              Sem atividade recente.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {registros
              .filter((r) => filtroReg === "todos"
                || (filtroReg === "ponto" && r.kind !== "item")
                || (filtroReg === "itens" && r.kind === "item"))
              .map((r) => {
              const p = prestadores.get(r.prestador_id);
              const card = r.card_id ? cards.get(r.card_id) : null;
              const itc = r.kind === "item" ? (r.data as ItemCheck) : null;
              const svc = itc ? servicos.get(itc.servico_id) : null;
              const icon = r.kind === "entrou" ? <LogIn size={14} /> : r.kind === "saiu" ? <LogOut size={14} /> : <Camera size={14} />;
              const color = r.kind === "entrou" ? "#22c55e" : r.kind === "saiu" ? "#f59e0b" : "#0ea5e9";
              const label = r.kind === "entrou" ? "ENTROU NA OBRA" : r.kind === "saiu" ? `SAIU DA OBRA${r.duracao_min ? ` · ${Math.floor((r.duracao_min)/60)}h${String((r.duracao_min)%60).padStart(2,"0")}` : ""}` : null;
              return (
                <div key={r.id} style={{
                  border: `1px solid ${T.border}`, background: T.cardBg,
                  padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start",
                }}>
                  <div style={{
                    padding: 8, background: T.statBg, border: `1px solid ${T.border}`, borderRadius: 999,
                    color, flexShrink: 0,
                  }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p?.nome ?? "-"}
                      </div>
                      <div style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>
                        <Clock size={9} style={{ display: "inline", marginRight: 4 }} />
                        {new Date(r.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>
                      {label ? (
                        <span style={{ color, fontWeight: 600, letterSpacing: "0.05em" }}>{label}</span>
                      ) : (
                        <span>
                          Concluiu <strong>{itc?.qtd_concluida}</strong> {svc?.unidade}
                          {svc?.descricao ? ` · ${svc.descricao}` : ""}
                        </span>
                      )}
                      {card?.obra && <> · <strong>{card.obra}</strong></>}
                      {card?.title && <> · {card.title}</>}
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      {(r.data as any).lat != null && (
                        <a href={`https://www.google.com/maps?q=${(r.data as any).lat},${(r.data as any).lng}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, color: "#0ea5e9", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={10} /> {Number((r.data as any).lat).toFixed(4)}, {Number((r.data as any).lng).toFixed(4)}
                        </a>
                      )}
                      {(() => {
                        const foto = itc?.foto_url ?? (r.kind === "entrou" ? (r.data as Checkin).foto_url : null);
                        return foto ? (
                          <a href={foto} target="_blank" rel="noopener noreferrer">
                            <img src={foto} alt="" style={{ width: 64, height: 64, objectFit: "cover", border: `1px solid ${T.border}` }} />
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {tab === "pontos" && (
        <main style={{ padding: "16px 22px 80px" }}>
          {!pontosDe ? (
            <>
              <input
                value={buscaNome} onChange={(e) => setBuscaNome(e.target.value)}
                placeholder="Buscar funcionário…"
                style={{
                  width: "100%", boxSizing: "border-box", padding: "12px 14px", marginBottom: 12,
                  background: T.cardBg, border: `1px solid ${T.border}`, color: T.textPrimary,
                  fontFamily: FONT_BODY, fontSize: 13, outline: "none",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from(prestadores.entries())
                  .filter(([, p]) => p.nome.toLowerCase().includes(buscaNome.toLowerCase()))
                  .sort((a, b) => a[1].nome.localeCompare(b[1].nome))
                  .map(([id, p]) => (
                    <button key={id} onClick={() => setPontosDe(id)} style={{
                      textAlign: "left", border: `1px solid ${T.border}`, background: T.cardBg,
                      padding: "14px 16px", cursor: "pointer", fontFamily: FONT_BODY,
                      display: "flex", alignItems: "center", gap: 12, color: T.textPrimary,
                    }}>
                      <div style={{ padding: 8, background: T.statBg, border: `1px solid ${T.border}`, borderRadius: 999, color: T.textSecondary }}>
                        <User size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
                        {p.categoria && (
                          <div style={{ fontSize: 10, letterSpacing: "0.14em", color: T.textMuted, textTransform: "uppercase", marginTop: 2 }}>
                            {p.categoria}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={14} style={{ color: T.textMuted }} />
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setPontosDe(null)} style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
                background: "transparent", border: "none", color: T.textSecondary,
                fontSize: 11, letterSpacing: "0.1em", cursor: "pointer", fontFamily: FONT_BODY, padding: 0,
              }}>
                <ArrowLeft size={12} /> TODOS OS FUNCIONÁRIOS
              </button>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 500, color: T.textPrimary }}>
                  {prestadores.get(pontosDe)?.nome ?? "-"}
                </h2>
                <p style={{ fontSize: 10, letterSpacing: "0.18em", color: T.textMuted, textTransform: "uppercase", marginTop: 2 }}>
                  {prestadores.get(pontosDe)?.categoria ?? ""} · ÚLTIMOS 60 DIAS · {historico.length} REGISTRO{historico.length === 1 ? "" : "S"}
                </p>
              </div>
              {histLoading ? (
                <div style={{ padding: 30, textAlign: "center", color: T.textMuted, fontSize: 12 }}>Carregando…</div>
              ) : historico.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
                  Nenhum registro de chegada nos últimos 60 dias.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {historico.map((c) => {
                    const card = cards.get(c.card_id);
                    const dur = c.closed_at
                      ? Math.round((new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 60000)
                      : null;
                    return (
                      <div key={c.id} style={{
                        border: `1px solid ${T.border}`, background: T.cardBg,
                        padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start",
                      }}>
                        {c.foto_url ? (
                          <a href={c.foto_url} target="_blank" rel="noopener noreferrer">
                            <img src={c.foto_url} alt="" style={{ width: 48, height: 48, objectFit: "cover", border: `1px solid ${T.border}`, borderRadius: 999 }} />
                          </a>
                        ) : (
                          <div style={{ padding: 8, background: T.statBg, border: `1px solid ${T.border}`, borderRadius: 999, color: "#22c55e" }}>
                            <LogIn size={14} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                              {new Date(c.created_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                            </div>
                            <div style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>
                              <Clock size={9} style={{ display: "inline", marginRight: 4 }} />
                              {new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              {c.closed_at && <> → {new Date(c.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>}
                              {dur != null && <> · {Math.floor(dur / 60)}h{String(dur % 60).padStart(2, "0")}</>}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>
                            {card?.obra && <strong>{card.obra}</strong>}
                            {card?.title && <> · {card.title}</>}
                            {!card && "Obra não identificada"}
                          </div>
                          {c.lat != null && (
                            <a href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 10, color: "#0ea5e9", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <MapPin size={10} /> Ver local da chegada ↗
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      )}

      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center", justifyContent: "center",
});
