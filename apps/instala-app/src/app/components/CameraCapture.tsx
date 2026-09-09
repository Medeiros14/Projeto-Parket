// Câmera nativa dentro do app via getUserMedia: abre um visor em tela cheia e o
// próprio navegador pede a autorização de uso da câmera na hora (pedido do Will 08/09).
// Motivo: o atributo capture do <input type="file"> é só uma dica; em vários
// Android/webviews o browser ignora e cai no seletor de arquivos ("abrindo a pasta").
// Foto sai por canvas.toBlob (jpeg) e vídeo por MediaRecorder (webm, mp4 no Safari).
// Se a permissão for negada ou não existir câmera, oferece o fallback da galeria
// (onFallback dispara o input file clássico do chamador).
import { useEffect, useRef, useState } from "react";
import { X, Camera, SwitchCamera, Video, Check, FolderOpen, Square } from "lucide-react";

const MONO = "'IBM Plex Mono', monospace";

type Shot = { file: File; tipo: "foto" | "video"; previewUrl: string };

// Escolhe o container de vídeo que o navegador sabe gravar (Chrome/Firefox = webm,
// Safari iOS = mp4). String vazia deixa o MediaRecorder decidir sozinho.
function mimeVideo(): { mime: string; ext: string } {
  const cands: [string, string][] = [
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
    ["video/mp4", "mp4"],
  ];
  for (const [mime, ext] of cands) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(mime)) {
      return { mime, ext };
    }
  }
  return { mime: "", ext: "webm" };
}

export function CameraCapture({
  allowVideo = false, multiple = false, onFiles, onFallback, onClose,
}: {
  allowVideo?: boolean;                 // mostra o botão de gravar vídeo (com áudio)
  multiple?: boolean;                   // acumula várias capturas antes de confirmar
  onFiles: (files: File[]) => void;     // entrega as mídias confirmadas pro chamador
  onFallback?: () => void;              // abre a galeria (input file) do chamador
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shotsRef = useRef<Shot[]>([]);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [tick, setTick] = useState(0); // religar a câmera no "tentar de novo"
  const [err, setErr] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [gravando, setGravando] = useState(false);
  shotsRef.current = shots;

  // Liga a câmera (e religa ao virar a lente ou no retry). audio junto quando pode
  // gravar vídeo: assim a autorização de câmera+microfone sai num pedido só.
  useEffect(() => {
    let vivo = true;
    setErr(null); setPronto(false);
    (async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: allowVideo,
        });
        if (!vivo) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setPronto(true);
      } catch (e: any) {
        if (!vivo) return;
        setErr(
          e?.name === "NotAllowedError" || e?.name === "SecurityError"
            ? "Autorização de câmera negada. Toque no cadeado na barra de endereço, libere a câmera e tente de novo."
            : e?.name === "NotFoundError" || e?.name === "OverconstrainedError"
              ? "Nenhuma câmera encontrada neste aparelho."
              : "Não consegui abrir a câmera aqui. Dá pra escolher a foto do aparelho.",
        );
      }
    })();
    return () => {
      vivo = false;
      if (recRef.current?.state === "recording") { try { recRef.current.stop(); } catch {} }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing, allowVideo, tick]);

  // Previews não confirmados morrem junto com o visor (só no unmount de verdade,
  // não no religar da lente). Os File confirmados seguem válidos no chamador.
  useEffect(() => () => { shotsRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl)); }, []);

  // Sem multiple, a captura nova substitui a anterior (caso foto única do Material)
  function addShot(shot: Shot) {
    setShots((prev) => {
      if (!multiple) { prev.forEach((p) => URL.revokeObjectURL(p.previewUrl)); return [shot]; }
      return [...prev, shot];
    });
  }

  function tirarFoto() {
    const v = videoRef.current;
    if (!v || !pronto || gravando) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      if (!blob) { setErr("Falha ao capturar a foto. Tente de novo."); return; }
      const file = new File([blob], `cam-${Date.now()}.jpg`, { type: "image/jpeg" });
      addShot({ file, tipo: "foto", previewUrl: URL.createObjectURL(file) });
    }, "image/jpeg", 0.85);
  }

  // Um toque começa a gravar, outro para; ao parar a gravação vira um shot na fila
  function toggleGravar() {
    if (!streamRef.current || !pronto) return;
    if (gravando) { try { recRef.current?.stop(); } catch {} return; }
    const { mime, ext } = mimeVideo();
    try {
      const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = () => {
        setGravando(false);
        const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
        const file = new File([blob], `cam-${Date.now()}.${ext}`, { type: blob.type });
        addShot({ file, tipo: "video", previewUrl: URL.createObjectURL(file) });
      };
      recRef.current = rec;
      rec.start();
      setGravando(true);
    } catch {
      setErr("Este navegador não grava vídeo por aqui. Tire fotos ou use a galeria.");
    }
  }

  function removerShot(idx: number) {
    setShots((prev) => {
      const alvo = prev[idx];
      if (alvo) URL.revokeObjectURL(alvo.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function usar() {
    if (shots.length === 0 || gravando) return;
    onFiles(shots.map((s) => s.file));
  }

  const btnRound: React.CSSProperties = {
    width: 46, height: 46, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)",
    color: "#f3f0e8", cursor: "pointer", padding: 0,
  };

  return (
    // Overlay fixo cobrindo a tela toda sem 100vh (regra Parket: zoom + vh corta a tela)
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: "#000", display: "flex", flexDirection: "column", fontFamily: MONO,
    }}>
      {/* Topo: estado + fechar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", flexShrink: 0 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", fontWeight: 600, color: gravando ? "#ef4444" : "#f3f0e8", display: "flex", alignItems: "center", gap: 8 }}>
          {gravando && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />}
          {gravando ? "GRAVANDO... TOQUE NO QUADRADO PRA PARAR" : "CÂMERA"}
        </span>
        <button onClick={onClose} aria-label="Fechar câmera" style={{ ...btnRound, width: 36, height: 36 }}>
          <X size={16} />
        </button>
      </div>

      {/* Visor: o vídeo preenche o meio; selfie sai espelhada como o usuário espera */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <video
          ref={videoRef} autoPlay playsInline muted
          style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none",
          }}
        />
        {err && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "#000",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 14, padding: 24, textAlign: "center",
          }}>
            <p style={{ color: "#f3f0e8", fontSize: 13, lineHeight: 1.6, maxWidth: 320, margin: 0 }}>{err}</p>
            <button onClick={() => setTick((t) => t + 1)} style={{
              padding: "12px 18px", background: "#f3f0e8", color: "#050505", border: "none",
              fontSize: 11, letterSpacing: "0.16em", fontWeight: 700, cursor: "pointer", fontFamily: MONO,
            }}>
              TENTAR DE NOVO
            </button>
            {onFallback && (
              <button onClick={onFallback} style={{
                padding: "12px 18px", background: "transparent", border: "1px solid rgba(255,255,255,0.35)",
                color: "#f3f0e8", fontSize: 11, letterSpacing: "0.16em", fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, fontFamily: MONO,
              }}>
                <FolderOpen size={14} /> ESCOLHER DO APARELHO
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fila de capturas: confere e tira a errada antes de confirmar */}
      {shots.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "10px 14px 0", overflowX: "auto", flexShrink: 0 }}>
          {shots.map((s, i) => (
            <div key={s.previewUrl} style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
              {s.tipo === "video" ? (
                <video src={s.previewUrl} preload="metadata" muted playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", border: "1px solid #34D39966" }} />
              ) : (
                <img src={s.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", border: "1px solid #34D39966" }} />
              )}
              <button onClick={() => removerShot(i)} aria-label="Descartar esta captura" style={{
                position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                background: "#000", border: "1px solid rgba(255,255,255,0.4)", color: "#f3f0e8", cursor: "pointer",
              }}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Controles: galeria, virar lente, disparo grande no centro, vídeo opcional */}
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexShrink: 0 }}>
        {onFallback ? (
          <button onClick={onFallback} disabled={gravando} aria-label="Escolher do aparelho" style={{ ...btnRound, opacity: gravando ? 0.4 : 1 }}>
            <FolderOpen size={18} />
          </button>
        ) : <span style={{ width: 46 }} />}
        <button
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          disabled={!!err || gravando} aria-label="Virar câmera"
          style={{ ...btnRound, opacity: err || gravando ? 0.4 : 1 }}
        >
          <SwitchCamera size={18} />
        </button>
        <button onClick={tirarFoto} disabled={!pronto || gravando} aria-label="Tirar foto" style={{
          width: 66, height: 66, borderRadius: "50%", padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#f3f0e8", border: "4px solid rgba(255,255,255,0.35)",
          color: "#050505", cursor: "pointer", opacity: !pronto || gravando ? 0.4 : 1,
        }}>
          <Camera size={26} />
        </button>
        {allowVideo ? (
          <button onClick={toggleGravar} disabled={!pronto} aria-label={gravando ? "Parar gravação" : "Gravar vídeo"} style={{
            ...btnRound,
            borderColor: gravando ? "#ef4444" : "rgba(255,255,255,0.25)",
            color: gravando ? "#ef4444" : "#f3f0e8",
            opacity: pronto ? 1 : 0.4,
          }}>
            {gravando ? <Square size={16} /> : <Video size={18} />}
          </button>
        ) : <span style={{ width: 46 }} />}
        <span style={{ width: 46 }} />
      </div>

      {/* Confirmação: só aparece com captura na fila */}
      <div style={{ padding: "0 16px 22px", flexShrink: 0 }}>
        {shots.length > 0 && (
          <button onClick={usar} disabled={gravando} style={{
            width: "100%", padding: "14px 16px",
            background: "#34D399", color: "#052e22", border: "none",
            fontSize: 12, letterSpacing: "0.16em", fontWeight: 700,
            cursor: gravando ? "not-allowed" : "pointer", opacity: gravando ? 0.5 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: MONO,
          }}>
            <Check size={15} />
            {shots.length === 1
              ? (shots[0].tipo === "video" ? "USAR VÍDEO" : "USAR FOTO")
              : `USAR ${shots.length} MÍDIAS`}
          </button>
        )}
      </div>
    </div>
  );
}
