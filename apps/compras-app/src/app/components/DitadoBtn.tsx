import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

/** Botão de ditado: fala vira texto (SpeechRecognition pt-BR) appendado no campo. */
export function DitadoBtn({ onText, t }: { onText: (segmento: string) => void; t: any }) {
  const [gravando, setGravando] = useState(false);
  const srRef = useRef<any>(null);

  useEffect(() => () => { try { srRef.current?.stop(); } catch {} }, []);

  const suportado = typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  if (!suportado) return null;

  function toggle() {
    if (gravando) {
      try { srRef.current?.stop(); } catch {}
      srRef.current = null;
      setGravando(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
    sr.onend = () => { srRef.current = null; setGravando(false); };
    sr.onerror = () => {};
    try { sr.start(); srRef.current = sr; setGravando(true); } catch {}
  }

  return (
    <button type="button" onClick={toggle}
      title={gravando ? "Parar ditado" : "Falar em vez de escrever"}
      style={{
        flexShrink: 0, padding: "4px 8px", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
        border: `1px ${gravando ? "solid #ef4444" : `dashed ${t.border}`}`,
        background: gravando ? "rgba(239,68,68,0.08)" : "transparent",
        color: gravando ? "#ef4444" : t.textSecondary,
        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
      {gravando ? <Square size={10} fill="currentColor" /> : <Mic size={11} />}
      {gravando ? "parar" : "voz"}
    </button>
  );
}
