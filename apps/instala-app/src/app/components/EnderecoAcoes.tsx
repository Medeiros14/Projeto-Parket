// Ações de endereço da obra: onde o endereço aparece, o instalador pode abrir
// no Google Maps, navegar pelo Waze ou copiar (pedido do Will 04/09).
// Container com stopPropagation porque vários pontos de render ficam dentro de
// card clicável (ObraCard, lista do Iniciar etc.).
import { useState } from "react";
import { Map, Navigation, Copy, Check } from "lucide-react";

const MONO = "'IBM Plex Mono', monospace";

// Fallback pra webview antiga sem clipboard API: textarea invisível + execCommand.
function copiarFallback(txt: string) {
  const ta = document.createElement("textarea");
  ta.value = txt;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch { /* sem clipboard, segue */ }
  document.body.removeChild(ta);
}

export function EnderecoAcoes({ endereco, T }: { endereco?: string | null; T: any }) {
  const [copiado, setCopiado] = useState(false);
  if (!endereco) return null;

  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
  // Scheme direto waze:// abre o app ja navegando; o link universal waze.com/ul
  // caia na pagina "instale o Waze" dentro do webview (Will 04/09).
  const waze = `waze://?q=${encodeURIComponent(endereco)}&navigate=yes`;

  // Chip com ícone e alvo de toque de verdade (min 34px de altura): o app é
  // usado em obra, com luva/dedo grande e sol na tela; 9px de fonte era míope.
  const chip: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
    padding: "8px 12px", minHeight: 34, border: `1px solid ${T.border}`, borderRadius: 6,
    color: T.textSecondary, background: "transparent",
    textDecoration: "none", cursor: "pointer", lineHeight: 1, width: "auto",
  };

  const copiar = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(endereco).catch(() => copiarFallback(endereco));
    } else {
      copiarFallback(endereco);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1400);
  };

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
      <a href={maps} target="_blank" rel="noopener noreferrer" style={chip}><Map size={13} /> MAPS</a>
      <a href={waze} style={chip}><Navigation size={13} /> WAZE</a>
      <button type="button" onClick={copiar} style={chip}>
        {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? "COPIADO" : "COPIAR"}
      </button>
    </div>
  );
}
