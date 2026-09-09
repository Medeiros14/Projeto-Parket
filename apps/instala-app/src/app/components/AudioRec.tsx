import { useRef, useState, useEffect } from "react";
import { Mic, Square, X } from "lucide-react";
import { useTheme } from "../../lib/theme-context";

type Props = {
  // opcional: Material usa so a transcricao (onText); sem onAudio a gravacao vira apenas ditado
  onAudio?: (blob: Blob | null) => void;
  onText: (segmento: string) => void;
};

/** Grava áudio (MediaRecorder) e transcreve ao vivo (SpeechRecognition pt-BR) em paralelo. */
export function AudioRec({ onAudio, onText }: Props) {
  const { T } = useTheme();
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [temAudio, setTemAudio] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const srRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { parar(true); }, []);

  async function iniciar() {
    setErro(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErro("Permita o uso do microfone pra gravar");
      return;
    }
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size > 0 && onAudio) { setTemAudio(true); onAudio(blob); }
    };
    rec.start();
    recRef.current = rec;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const sr = new SR();
      sr.lang = "pt-BR";
      sr.continuous = true;
      sr.interimResults = false;
      sr.onresult = (ev: any) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) {
            const txt = (ev.results[i][0]?.transcript || "").trim();
            if (txt) onText(txt);
          }
        }
      };
      sr.onerror = () => {};
      try { sr.start(); } catch {}
      srRef.current = sr;
    }

    setSegundos(0);
    timerRef.current = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    setGravando(true);
  }

  function parar(descartar = false) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { srRef.current?.stop(); } catch {}
    srRef.current = null;
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state !== "inactive") {
      if (descartar) rec.ondataavailable = null as any;
      try { rec.stop(); } catch {}
      if (descartar) rec.stream.getTracks().forEach((t) => t.stop());
    }
    setGravando(false);
  }

  function limpar() {
    setTemAudio(false);
    onAudio?.(null);
  }

  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <button
          type="button"
          onClick={() => (gravando ? parar() : iniciar())}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 12px", cursor: "pointer",
            border: `1px ${gravando ? "solid #ef4444" : `dashed ${T.borderHover}`}`,
            background: gravando ? "rgba(239,68,68,0.08)" : "transparent",
            color: gravando ? "#ef4444" : temAudio ? "#34D399" : T.textSecondary,
            fontSize: 10, letterSpacing: "0.14em", fontWeight: 600,
          }}
        >
          {gravando ? (
            <><Square size={12} fill="currentColor" /> GRAVANDO {mm}:{ss} (TOQUE PRA PARAR)</>
          ) : temAudio ? (
            <><Mic size={13} /> ÁUDIO GRAVADO (TOQUE PRA REGRAVAR)</>
          ) : (
            <><Mic size={13} /> FALAR EM VEZ DE ESCREVER</>
          )}
        </button>
        {temAudio && !gravando && (
          <button type="button" onClick={limpar} title="Descartar áudio" style={{
            padding: "0 12px", cursor: "pointer", background: "transparent",
            border: `1px solid ${T.border}`, color: T.textMuted,
            display: "flex", alignItems: "center",
          }}>
            <X size={14} />
          </button>
        )}
      </div>
      {gravando && (
        <div style={{ marginTop: 6, fontSize: 10, color: T.textMuted, letterSpacing: "0.05em" }}>
          {/* sem onAudio o blob nao vai pra lugar nenhum: nao prometer audio pro fiscal */}
          {onAudio ? "Falando vira texto automático. O áudio original também vai junto pro fiscal ouvir." : "Falando vira texto automático nas Observações."}
        </div>
      )}
      {erro && <div style={{ marginTop: 6, fontSize: 11, color: "#ef4444" }}>{erro}</div>}
    </div>
  );
}
