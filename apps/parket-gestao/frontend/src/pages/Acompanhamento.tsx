import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, InstaQueueItem, InstaMidiaIn } from "../api";
import { fonts, useTokens } from "../theme";

/** Acompanhamento — curadoria do InstaParket (Nathalia · produtividade).
 *  Fila cronológica de mídias de campo (fiscal + instalador + gestão) de todos
 *  os projetos. Curadora seleciona mídias de um perfil → cria post (carrossel)
 *  que vai pro ar na hora em insta.parket.works. */

const ORIGENS = [
  { key: "",        label: "Todas" },
  { key: "fiscal",  label: "Fiscal" },
  { key: "instala", label: "Instalador" },
  { key: "gestao",  label: "Gestão" },
];

type Sel = { key: string; item: InstaQueueItem };

const keyOf = (i: InstaQueueItem) => i.foto_id || i.fonte_id || i.url;

export default function Acompanhamento() {
  const t = useTokens();
  const [params] = useSearchParams();
  const projetoParam = params.get("projeto") || "";

  const [fila, setFila] = useState<InstaQueueItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [origem, setOrigem] = useState("");
  const [busca, setBusca] = useState("");
  const [ocultarPostadas, setOcultarPostadas] = useState(true);
  const [sel, setSel] = useState<Sel[]>([]);
  const [modal, setModal] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = () => {
    setCarregando(true);
    api.instaAcompanhamento({ limit: 300, projeto_id: projetoParam || undefined })
      .then(f => { setFila(f); setErro(null); })
      .catch(e => setErro(String(e?.message || e)))
      .finally(() => setCarregando(false));
  };
  useEffect(load, [projetoParam]);

  const visiveis = useMemo(() => {
    let v = fila;
    if (origem) v = v.filter(i => i.fonte === origem || i.origem === origem);
    if (ocultarPostadas) v = v.filter(i => !i.postada);
    const q = busca.trim().toLowerCase();
    if (q) v = v.filter(i =>
      i.cliente.toLowerCase().includes(q) ||
      (i.ambiente || "").toLowerCase().includes(q) ||
      (i.legenda || "").toLowerCase().includes(q));
    return v;
  }, [fila, origem, busca, ocultarPostadas]);

  const grupos = useMemo(() => {
    const m = new Map<string, { cliente: string; itens: InstaQueueItem[] }>();
    for (const i of visiveis) {
      if (!m.has(i.projeto_id)) m.set(i.projeto_id, { cliente: i.cliente, itens: [] });
      m.get(i.projeto_id)!.itens.push(i);
    }
    return [...m.entries()];
  }, [visiveis]);

  const selProjeto = sel[0]?.item.projeto_id || null;
  const selCliente = sel[0]?.item.cliente || "";

  const toggleSel = (i: InstaQueueItem) => {
    const k = keyOf(i);
    setSel(prev => {
      const jaTem = prev.some(s => s.key === k);
      if (jaTem) return prev.filter(s => s.key !== k);
      // post pertence a UM perfil — trocar de projeto reinicia a seleção
      if (prev.length && prev[0].item.projeto_id !== i.projeto_id)
        return [{ key: k, item: i }];
      return [...prev, { key: k, item: i }];
    });
  };

  const aoPublicar = () => {
    setModal(false);
    setSel([]);
    setFlash("Post publicado no InstaParket ✓");
    setTimeout(() => setFlash(null), 4000);
    load();
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: t.bg }}>
      {/* Header */}
      <div style={{ padding: "26px 32px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontFamily: fonts.cinzel, fontSize: 20, letterSpacing: "0.14em", color: t.textPrimary }}>
            ACOMPANHAMENTO
          </h1>
          <span style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: t.textTertiary }}>
            Curadoria do InstaParket · selecione as melhores mídias e publique
          </span>
        </div>
        {projetoParam && (
          <div style={{ marginTop: 8, fontSize: 10, color: t.textSecondary }}>
            Filtrando um perfil ·{" "}
            <Link to="/acompanhamento" style={{ color: t.accent }}>ver todos</Link>
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
          {ORIGENS.map(o => (
            <button key={o.key} onClick={() => setOrigem(o.key)} style={{
              padding: "6px 12px", cursor: "pointer",
              fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
              background: origem === o.key ? t.accent : "transparent",
              color: origem === o.key ? "#fff" : t.textSecondary,
              border: `1px solid ${origem === o.key ? t.accent : t.border1}`,
            }}>{o.label}</button>
          ))}
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente / ambiente…"
            style={{
              padding: "7px 10px", fontSize: 11, minWidth: 220,
              background: t.card1, color: t.textPrimary,
              border: `1px solid ${t.border1}`, outline: "none",
            }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: t.textSecondary, cursor: "pointer" }}>
            <input type="checkbox" checked={ocultarPostadas} onChange={e => setOcultarPostadas(e.target.checked)} />
            ocultar já postadas
          </label>
          <button onClick={load} title="Atualizar" style={{
            padding: "6px 12px", cursor: "pointer", fontSize: 9, letterSpacing: "0.16em",
            textTransform: "uppercase", background: "transparent",
            color: t.textSecondary, border: `1px solid ${t.border1}`,
          }}>Atualizar</button>
        </div>
      </div>

      {flash && (
        <div style={{
          margin: "14px 32px 0", padding: "10px 14px", fontSize: 11,
          border: `1px solid ${t.accent}`, color: t.accent, background: t.card1,
        }}>{flash}</div>
      )}

      {/* Fila */}
      <div style={{ padding: "20px 32px 120px" }}>
        {carregando ? (
          <div style={{ color: t.textTertiary, fontSize: 11, padding: 40, textAlign: "center" }}>Carregando fila…</div>
        ) : erro ? (
          <div style={{ color: "#c0392b", fontSize: 11, padding: 40, textAlign: "center" }}>{erro}</div>
        ) : grupos.length === 0 ? (
          <div style={{ color: t.textTertiary, fontSize: 11, padding: 40, textAlign: "center" }}>
            Nenhuma mídia na fila com esses filtros.
          </div>
        ) : grupos.map(([pid, g]) => (
          <div key={pid} style={{ marginBottom: 30 }}>
            <div style={{
              display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10,
              borderBottom: `1px solid ${t.border1}`, paddingBottom: 6,
            }}>
              <Link to={`/projetos/${pid}`} style={{
                fontFamily: fonts.cinzel, fontSize: 13, letterSpacing: "0.1em",
                color: t.textPrimary, textDecoration: "none",
              }}>{g.cliente}</Link>
              <span style={{ fontSize: 9, color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                {g.itens.length} mídia{g.itens.length === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{
              display: "grid", gap: 10,
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            }}>
              {g.itens.map(i => {
                const k = keyOf(i);
                const idx = sel.findIndex(s => s.key === k);
                const marcada = idx >= 0;
                return (
                  <div key={k} onClick={() => !i.postada && toggleSel(i)} style={{
                    position: "relative", cursor: i.postada ? "default" : "pointer",
                    border: `2px solid ${marcada ? t.accent : t.border1}`,
                    background: t.card1, opacity: i.postada ? 0.55 : 1,
                  }}>
                    <Midia url={i.url} tipo={i.tipo} h={130} />
                    {marcada && (
                      <div style={{
                        position: "absolute", top: 6, right: 6, width: 22, height: 22,
                        borderRadius: "50%", background: t.accent, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                      }}>{idx + 1}</div>
                    )}
                    <div style={{
                      position: "absolute", top: 6, left: 6, padding: "2px 6px",
                      fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                      background: "rgba(0,0,0,0.55)", color: "#fff",
                    }}>
                      {i.postada ? "postada" : i.fonte === "gestao" ? (i.origem || "gestão") : i.fonte}
                      {i.tipo === "video" ? " · vídeo" : ""}
                    </div>
                    <div style={{ padding: "6px 8px" }}>
                      <div style={{
                        fontSize: 9, color: t.textSecondary, whiteSpace: "nowrap",
                        overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {i.ambiente || i.legenda || "—"}
                      </div>
                      <div style={{ fontSize: 8, color: t.textTertiary, marginTop: 2 }}>
                        {fmtData(i.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Barra flutuante de seleção */}
      {sel.length > 0 && (
        <div style={{
          position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 14, zIndex: 50,
          padding: "12px 18px", background: t.card1,
          border: `1px solid ${t.accent}`, boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
        }}>
          <span style={{ fontSize: 11, color: t.textPrimary }}>
            <b>{sel.length}</b> mídia{sel.length === 1 ? "" : "s"} · {selCliente}
          </span>
          <button onClick={() => setModal(true)} style={{
            padding: "8px 16px", cursor: "pointer", fontSize: 10,
            letterSpacing: "0.16em", textTransform: "uppercase",
            background: t.accent, color: "#fff", border: `1px solid ${t.accent}`,
          }}>Criar post</button>
          <button onClick={() => setSel([])} style={{
            padding: "8px 12px", cursor: "pointer", fontSize: 10,
            letterSpacing: "0.14em", textTransform: "uppercase",
            background: "transparent", color: t.textSecondary, border: `1px solid ${t.border1}`,
          }}>Limpar</button>
        </div>
      )}

      {modal && selProjeto && (
        <InstaPostModal
          projetoId={selProjeto}
          cliente={selCliente}
          itens={sel.map(s => s.item)}
          onFechar={() => setModal(false)}
          onPublicado={aoPublicar}
          t={t}
        />
      )}
    </div>
  );
}

function Midia({ url, tipo, h }: { url: string; tipo: string; h: number }) {
  if (tipo === "video") {
    return <video src={url} muted playsInline preload="metadata"
      style={{ width: "100%", height: h, objectFit: "cover", display: "block", background: "#000" }} />;
  }
  return <img src={url} loading="lazy" alt=""
    style={{ width: "100%", height: h, objectFit: "cover", display: "block", background: "#111" }} />;
}

function fmtData(s: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

/** Modal de publicação — usado aqui e na aba Registro fotográfico do card. */
export function InstaPostModal({ projetoId, cliente, itens, onFechar, onPublicado, t }: {
  projetoId: string; cliente: string; itens: InstaQueueItem[];
  onFechar: () => void; onPublicado: () => void; t: any;
}) {
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const publicar = async () => {
    setEnviando(true); setErro(null);
    const midias: InstaMidiaIn[] = itens.map(i => i.foto_id
      ? { foto_id: i.foto_id }
      : { fonte: i.fonte, fonte_id: i.fonte_id, url: i.url, tipo: i.tipo,
          legenda: i.legenda, ambiente: i.ambiente });
    try {
      await api.instaPostCriar(
        { projeto_id: projetoId, legenda: legenda.trim() || null, midias },
        localStorage.getItem("gestao_user_email"));
      onPublicado();
    } catch (e: any) {
      const msg = String(e?.message || e);
      setErro(msg.startsWith("403")
        ? "Faça login no gestão para publicar no InstaParket."
        : `Falha ao publicar: ${msg}`);
      setEnviando(false);
    }
  };

  return (
    <div onClick={onFechar} style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto",
        background: t.bg, border: `1px solid ${t.border2}`, padding: 22,
      }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.12em", color: t.textPrimary }}>
          NOVO POST · {cliente.toUpperCase()}
        </div>
        <div style={{ fontSize: 9, color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4 }}>
          {itens.length === 1 ? "1 mídia" : `Carrossel · ${itens.length} mídias`} · publica na hora
        </div>

        <div style={{
          display: "grid", gap: 8, marginTop: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        }}>
          {itens.map((i, n) => (
            <div key={keyOf(i)} style={{ position: "relative", border: `1px solid ${t.border1}` }}>
              <Midia url={i.url} tipo={i.tipo} h={96} />
              <div style={{
                position: "absolute", top: 4, left: 4, width: 18, height: 18,
                borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
              }}>{n + 1}</div>
            </div>
          ))}
        </div>

        <textarea
          value={legenda} onChange={e => setLegenda(e.target.value)}
          placeholder="Legenda (opcional)…" rows={3} maxLength={3000}
          style={{
            width: "100%", boxSizing: "border-box", marginTop: 14, padding: 10,
            fontSize: 12, fontFamily: fonts.inter, resize: "vertical",
            background: t.card1, color: t.textPrimary,
            border: `1px solid ${t.border1}`, outline: "none",
          }} />

        {erro && <div style={{ marginTop: 10, fontSize: 11, color: "#c0392b" }}>{erro}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button onClick={onFechar} disabled={enviando} style={{
            padding: "9px 14px", cursor: "pointer", fontSize: 10,
            letterSpacing: "0.14em", textTransform: "uppercase",
            background: "transparent", color: t.textSecondary, border: `1px solid ${t.border1}`,
          }}>Cancelar</button>
          <button onClick={publicar} disabled={enviando} style={{
            padding: "9px 18px", cursor: enviando ? "wait" : "pointer", fontSize: 10,
            letterSpacing: "0.16em", textTransform: "uppercase",
            background: t.accent, color: "#fff", border: `1px solid ${t.accent}`,
            opacity: enviando ? 0.7 : 1,
          }}>{enviando ? "Publicando…" : "Publicar"}</button>
        </div>
      </div>
    </div>
  );
}
