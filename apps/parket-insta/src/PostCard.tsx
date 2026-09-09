import { useEffect, useRef, useState } from "react";
import type { InstaComentario, InstaMidia, InstaPost } from "./api";
import { tempoRelativo } from "./api";
import { fonts, t } from "./theme";

type Interacoes = {
  curtir: (postId: string) => Promise<{ curtiu: boolean; curtidas: number }>;
  comentarios: (postId: string) => Promise<InstaComentario[]>;
  comentar: (postId: string, texto: string) => Promise<InstaComentario>;
  podeInteragir: boolean;
  aoExigirLogin?: () => void;
};

export function Avatar({ url, nome, size = 34 }: { url?: string | null; nome: string; size?: number }) {
  const inicial = (nome || "?").trim().charAt(0).toUpperCase();
  return url ? (
    <img
      src={url}
      alt={nome}
      style={{ width: size, height: size, objectFit: "cover",
               border: `1px solid ${t.border}`, flexShrink: 0 }}
    />
  ) : (
    <div style={{ width: size, height: size, background: t.card2,
                  color: t.accent, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: fonts.brand, fontWeight: 500, fontSize: size * 0.5,
                  border: `1px solid ${t.border}`, flexShrink: 0 }}>
      {inicial}
    </div>
  );
}

export function SeloConcluido({ mini }: { mini?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
                   border: `1px solid ${t.accent}`, color: t.accent,
                   padding: mini ? "2px 8px" : "3px 10px", fontSize: mini ? 8 : 9,
                   letterSpacing: "0.18em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <svg width={mini ? 8 : 9} height={mini ? 8 : 9} viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Concluído
    </span>
  );
}

function Midia({ m, aoMedir }: { m: InstaMidia; aoMedir?: (razao: number) => void }) {
  const comum: React.CSSProperties = {
    width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#0B0B0B",
  };
  return m.tipo === "video" ? (
    <video src={m.url} controls muted playsInline preload="metadata"
           onLoadedMetadata={(e) => {
             const v = e.currentTarget;
             if (v.videoWidth && v.videoHeight) aoMedir?.(v.videoWidth / v.videoHeight);
           }}
           style={{ ...comum, objectFit: "contain" }} />
  ) : (
    <img src={m.url} alt={m.ambiente || ""} loading="lazy" style={comum} />
  );
}

function Coracao({ cheio }: { cheio: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={cheio ? t.accent : "none"}
         stroke={cheio ? t.accent : t.text} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function Balao() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={t.text}
         strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function PostCard({ post, ix, aoAbrirPerfil }: {
  post: InstaPost; ix: Interacoes; aoAbrirPerfil?: (pid: string) => void;
}) {
  const [curti, setCurti] = useState(post.curti);
  const [curtidas, setCurtidas] = useState(Number(post.curtidas));
  const [nComents, setNComents] = useState(Number(post.comentarios));
  const [comentsAbertos, setComentsAbertos] = useState(false);
  const [coments, setComents] = useState<InstaComentario[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [slide, setSlide] = useState(0);
  const trilhoRef = useRef<HTMLDivElement>(null);
  const ocupado = useRef(false);
  // Drag-to-scroll com mouse. Touch continua usando o gesto nativo.
  const arrasto = useRef<{ startX: number; startScroll: number; moveu: boolean } | null>(null);

  const midias = post.midias || [];
  const varias = midias.length > 1;
  // Vídeo vertical (reels) muda o quadro do post de 4:5 pra proporção do vídeo (limite 9:16).
  const [razaoVideo, setRazaoVideo] = useState<number | null>(null);
  const aspecto = razaoVideo !== null && razaoVideo < 4 / 5 ? Math.max(razaoVideo, 9 / 16) : 4 / 5;

  function onScroll() {
    const el = trilhoRef.current;
    if (!el) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || !varias) return;
    const el = trilhoRef.current; if (!el) return;
    arrasto.current = { startX: e.clientX, startScroll: el.scrollLeft, moveu: false };
    el.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrasto.current; const el = trilhoRef.current;
    if (!a || !el) return;
    const dx = e.clientX - a.startX;
    if (Math.abs(dx) > 4) a.moveu = true;
    el.scrollLeft = a.startScroll - dx;
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrasto.current; const el = trilhoRef.current;
    if (!a || !el) { arrasto.current = null; return; }
    // Snap manual pro slide mais próximo (respeitando direção do gesto).
    const w = el.clientWidth || 1;
    const dx = e.clientX - a.startX;
    let alvo = Math.round(a.startScroll / w);
    if (dx <= -40) alvo = Math.min(midias.length - 1, alvo + 1);
    else if (dx >= 40) alvo = Math.max(0, alvo - 1);
    el.scrollTo({ left: alvo * w, behavior: "smooth" });
    const moveu = a.moveu;
    arrasto.current = null;
    try { el.releasePointerCapture(e.pointerId); } catch {}
    // Se moveu, cancela o click que dispararia no vídeo/imagem por baixo.
    if (moveu) { e.preventDefault(); e.stopPropagation(); }
  }

  async function toggleCurtir() {
    if (!ix.podeInteragir) { ix.aoExigirLogin?.(); return; }
    if (ocupado.current) return;
    ocupado.current = true;
    const prev = { curti, curtidas };
    setCurti(!curti);
    setCurtidas(curtidas + (curti ? -1 : 1));
    try {
      const r = await ix.curtir(post.id);
      setCurti(r.curtiu);
      setCurtidas(Number(r.curtidas));
    } catch {
      setCurti(prev.curti);
      setCurtidas(prev.curtidas);
    } finally {
      ocupado.current = false;
    }
  }

  async function abrirComents() {
    const abrir = !comentsAbertos;
    setComentsAbertos(abrir);
    if (abrir && coments === null) {
      try { setComents(await ix.comentarios(post.id)); } catch { setComents([]); }
    }
  }

  async function enviar() {
    const tx = texto.trim();
    if (!tx || enviando) return;
    if (!ix.podeInteragir) { ix.aoExigirLogin?.(); return; }
    setEnviando(true);
    try {
      const novo = await ix.comentar(post.id, tx);
      setComents((cs) => [...(cs || []), novo]);
      setNComents((n) => n + 1);
      setTexto("");
    } catch (e: any) {
      alert(e?.message || "Não foi possível comentar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article style={{ background: t.card, border: `1px solid ${t.border}`,
                      overflow: "hidden", marginBottom: 20 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <div onClick={() => aoAbrirPerfil?.(post.projeto_id)}
             style={{ display: "flex", alignItems: "center", gap: 12, cursor: aoAbrirPerfil ? "pointer" : "default", minWidth: 0 }}>
          <Avatar url={post.avatar_url} nome={post.cliente} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: fonts.brand, fontWeight: 500, fontSize: 16, color: t.text,
                          lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden",
                          textOverflow: "ellipsis" }}>
              {post.cliente}
            </div>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                          color: t.text3, marginTop: 2 }}>
              {tempoRelativo(post.created_at)}
            </div>
          </div>
        </div>
        {post.concluido && <div style={{ marginLeft: "auto" }}><SeloConcluido mini /></div>}
      </div>

      {/* carrossel */}
      <div style={{ position: "relative", borderTop: `1px solid ${t.border2}`,
                    borderBottom: `1px solid ${t.border2}` }}>
        <div ref={trilhoRef} onScroll={onScroll}
             onPointerDown={onPointerDown} onPointerMove={onPointerMove}
             onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
             onDragStart={(e) => e.preventDefault()}
             style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory",
                      aspectRatio: aspecto, background: "#0B0B0B",
                      cursor: varias ? "grab" : "default",
                      userSelect: arrasto.current ? "none" : "auto" }}>
          {midias.map((m, i) => (
            <div key={m.foto_id || i}
                 style={{ flex: "0 0 100%", scrollSnapAlign: "start", scrollSnapStop: "always" }}>
              <Midia m={m} aoMedir={(r) => setRazaoVideo((cur) => (cur === null || r < cur ? r : cur))} />
            </div>
          ))}
        </div>
        {varias && (
          <>
            <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,.6)",
                          color: "#fff", fontSize: 10, letterSpacing: "0.1em", padding: "3px 9px" }}>
              {slide + 1} / {midias.length}
            </div>
            <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex",
                          justifyContent: "center", gap: 6 }}>
              {midias.map((_, i) => (
                <span key={i} style={{ width: 5, height: 5,
                                       background: i === slide ? t.accent : "rgba(255,255,255,.5)" }} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ações */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 14px 4px" }}>
        <button onClick={toggleCurtir} aria-label="Curtir"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                         display: "flex", alignItems: "center" }}>
          <Coracao cheio={curti} />
        </button>
        <button onClick={abrirComents} aria-label="Comentários"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                         display: "flex", alignItems: "center" }}>
          <Balao />
        </button>
      </div>
      {curtidas > 0 && (
        <div style={{ padding: "4px 14px 0", fontSize: 9, letterSpacing: "0.16em",
                      textTransform: "uppercase", color: t.text2 }}>
          {curtidas} curtida{curtidas > 1 ? "s" : ""}
        </div>
      )}

      {/* legenda */}
      {post.legenda && (
        <div style={{ padding: "8px 14px 0", fontSize: 13, color: t.text, lineHeight: 1.55,
                      whiteSpace: "pre-wrap" }}>
          {post.legenda}
        </div>
      )}

      {/* comentários */}
      {!comentsAbertos && nComents > 0 && (
        <button onClick={abrirComents}
                style={{ background: "none", border: "none", color: t.text3, fontSize: 9,
                         letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: fonts.body,
                         padding: "8px 14px 0", cursor: "pointer", textAlign: "left" }}>
          Ver {nComents === 1 ? "1 comentário" : `os ${nComents} comentários`}
        </button>
      )}
      {comentsAbertos && (
        <div style={{ padding: "10px 14px 0" }}>
          {(coments || []).map((c) => (
            <div key={c.id} style={{ marginBottom: 9, fontSize: 13, lineHeight: 1.45 }}>
              <span style={{ fontWeight: 600, color: c.autor_tipo === "cliente" ? t.accent : t.text }}>
                {c.autor_nome}
              </span>{" "}
              <span style={{ color: t.text2 }}>{c.texto}</span>
              <span style={{ color: t.text3, fontSize: 10, marginLeft: 6 }}>{tempoRelativo(c.created_at)}</span>
            </div>
          ))}
          {coments !== null && coments.length === 0 && (
            <div style={{ color: t.text3, fontSize: 11, letterSpacing: "0.05em", marginBottom: 6 }}>
              Seja o primeiro a comentar.
            </div>
          )}
          <div style={{ display: "flex", gap: 10, padding: "6px 0 6px" }}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && enviar()}
                   placeholder="Adicionar um comentário…" maxLength={2000}
                   style={{ flex: 1, background: "transparent", border: `1px solid ${t.border2}`,
                            color: t.text, fontSize: 13, padding: "9px 12px",
                            outline: "none", fontFamily: fonts.body }} />
            <button onClick={enviar} disabled={!texto.trim() || enviando}
                    style={{ background: "none", border: "none",
                             color: texto.trim() ? t.accent : t.text3, fontFamily: fonts.body,
                             fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                             cursor: "pointer" }}>
              Publicar
            </button>
          </div>
        </div>
      )}
      <div style={{ height: 10 }} />
    </article>
  );
}

export function useTituloDocumento(titulo: string) {
  useEffect(() => { document.title = titulo; }, [titulo]);
}
