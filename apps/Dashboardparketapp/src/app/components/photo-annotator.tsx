/* ═══ PhotoAnnotator — editor de anotação sobre foto (camada JSON reeditável) ═══ */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Save, Undo2, Trash2 } from "lucide-react";
import { BORDER, TEXT_DIM, GREEN, RED, ORANGE } from "./dept-layout";

export type Stroke = {
  color: string;
  size: number;
  points: [number, number][]; /* normalizados 0..1 */
};

export type Annotations = { strokes: Stroke[] };

const COLORS = ["#ff2d2d", "#ffd400", "#00c853", "#2979ff", "#ffffff", "#000000"];
const SIZES = [3, 6, 12];

function drawStrokes(ctx: CanvasRenderingContext2D, w: number, h: number, strokes: Stroke[]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    if (s.points.length === 0) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.beginPath();
    const [x0, y0] = s.points[0];
    ctx.moveTo(x0 * w, y0 * h);
    for (let i = 1; i < s.points.length; i++) {
      const [x, y] = s.points[i];
      ctx.lineTo(x * w, y * h);
    }
    if (s.points.length === 1) {
      /* ponto único = dot */
      ctx.arc(x0 * w, y0 * h, Math.max(1, s.size / 2), 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }
}

export function PhotoAnnotator({
  open, url, initial, onClose, onSave, ambiente,
}: {
  open: boolean;
  url: string;
  initial: Annotations | null;
  ambiente?: string;
  onClose: () => void;
  onSave: (a: Annotations) => Promise<void> | void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(initial?.strokes || []);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [size, setSize] = useState<number>(SIZES[1]);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const drawing = useRef(false);
  const current = useRef<Stroke | null>(null);

  useEffect(() => {
    if (open) setStrokes(initial?.strokes || []);
  }, [open, initial]);

  const [loadError, setLoadError] = useState(false);

  /* carrega imagem pra descobrir aspect ratio */
  useEffect(() => {
    if (!open || !url) return;
    setLoadError(false);
    setDims(null);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const w = img.naturalWidth || 800;
      const h = img.naturalHeight || 600;
      setDims({ w, h });
    };
    img.onerror = () => {
      setLoadError(true);
      /* fallback: canvas 4:3 pra permitir desenho mesmo se imagem falhar */
      setDims({ w: 800, h: 600 });
    };
    img.src = url;
  }, [open, url]);

  const layout = useMemo(() => {
    if (!dims) return null;
    /* ajusta ao viewport com margem pra toolbar */
    const maxW = Math.min(window.innerWidth - 32, 1280);
    const maxH = window.innerHeight - 160;
    const ratio = dims.w / dims.h;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    return { w: Math.floor(w), h: Math.floor(h) };
  }, [dims]);

  /* redesenha canvas quando strokes ou layout mudam */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !layout) return;
    cv.width = layout.w;
    cv.height = layout.h;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, layout.w, layout.h);
    drawStrokes(ctx, layout.w, layout.h, strokes);
  }, [strokes, layout]);

  const pointerToNorm = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!layout) return;
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    const pt = pointerToNorm(e);
    current.current = { color, size, points: [pt] };
    setStrokes(prev => [...prev, current.current!]);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !current.current) return;
    const pt = pointerToNorm(e);
    current.current.points.push(pt);
    /* força repaint */
    setStrokes(prev => prev.slice());
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    current.current = null;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const undo = () => setStrokes(prev => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  const doSave = async () => {
    setSaving(true);
    try {
      await onSave({ strokes });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", padding: 12 }}
      onMouseDown={onClose}
    >
      <div
        className="rounded-2xl flex flex-col gap-3 p-3"
        style={{ background: "#0e0e0e", border: `1px solid ${BORDER}`, maxWidth: "100%" }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* toolbar */}
        <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: "0.7rem", color: TEXT_DIM }}>
          <span style={{ color: "white", fontWeight: 600 }}>{ambiente || "Foto"}</span>
          <span>·</span>
          <span>Cor</span>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              style={{
                width: 22, height: 22, borderRadius: "50%", background: c,
                border: color === c ? "2px solid #fff" : "2px solid rgba(255,255,255,0.2)",
                cursor: "pointer", padding: 0,
              }}
            />
          ))}
          <span style={{ marginLeft: 8 }}>Espessura</span>
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              style={{
                width: 30, height: 22, borderRadius: 6,
                background: size === s ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${size === s ? "#fff" : BORDER}`,
                color: "white", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <span style={{ width: s, height: s, background: "white", borderRadius: "50%" }} />
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6,
              background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white",
              cursor: strokes.length === 0 ? "not-allowed" : "pointer", opacity: strokes.length === 0 ? 0.4 : 1,
            }}
          >
            <Undo2 size={12} /> Desfazer
          </button>
          <button
            onClick={clear}
            disabled={strokes.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6,
              background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: RED,
              cursor: strokes.length === 0 ? "not-allowed" : "pointer", opacity: strokes.length === 0 ? 0.4 : 1,
            }}
          >
            <Trash2 size={12} /> Limpar
          </button>
          <button
            onClick={doSave}
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6,
              background: GREEN, border: "none", color: "#000", fontWeight: 600, cursor: "pointer",
            }}
          >
            <Save size={12} /> {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6,
              background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "white",
              cursor: "pointer",
            }}
          >
            <X size={12} /> Fechar
          </button>
        </div>

        {/* canvas + imagem */}
        {!layout ? (
          <div style={{ padding: 40, color: TEXT_DIM, fontSize: "0.75rem", textAlign: "center", minWidth: 400 }}>
            Carregando foto...
          </div>
        ) : (
          <div
            ref={wrapRef}
            style={{
              position: "relative",
              width: layout.w,
              height: layout.h,
              background: "#000",
              borderRadius: 8,
              overflow: "hidden",
              alignSelf: "center",
            }}
          >
            {!loadError && (
              <img
                src={url}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", userSelect: "none", pointerEvents: "none" }}
                draggable={false}
              />
            )}
            {loadError && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: RED, fontSize: "0.7rem", padding: 16, textAlign: "center" }}>
                Nao foi possivel carregar a imagem. Voce ainda pode desenhar sobre uma prancha em branco.
              </div>
            )}
            <canvas
              ref={canvasRef}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
        )}

        <div style={{ fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center" }}>
          {strokes.length} traco{strokes.length === 1 ? "" : "s"} - desenhe direto na foto - toque/arraste
        </div>
      </div>
    </div>
  );
}

/* Overlay read-only usado na thumbnail pra dar hint de "tem anotação" */
export function AnnotationBadge({ anotacoes }: { anotacoes?: Annotations | null }) {
  const n = anotacoes?.strokes?.length || 0;
  if (n === 0) return null;
  return (
    <div
      style={{
        position: "absolute", bottom: 4, left: 4,
        background: ORANGE, color: "#000",
        borderRadius: 4, padding: "1px 4px",
        fontSize: "0.5rem", fontWeight: 700,
      }}
    >
      {n} anot.
    </div>
  );
}
