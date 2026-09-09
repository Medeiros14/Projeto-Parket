/**
 * WhatsApp Media Renderer — patch chunk Parket
 * Componente reutilizável que renderiza mídias do WhatsApp dentro do chat
 * (áudio com player, imagem com preview/download, documento com link).
 *
 * Como funciona: a URL salva no Supabase (`media_url`) é o link encriptado
 * do mmg.whatsapp.net (.enc), que não dá pra abrir direto. Pra decodificar,
 * chamamos `chat/getBase64FromMediaMessage/{instance}` na Evolution API,
 * que devolve o base64 já decifrado. Daí montamos um Blob + ObjectURL e
 * renderizamos no <audio>/<img>/<a download>.
 */
import { r as p } from "./index-DZtetJYP.js";

const EVO_API = "https://conect.parket.works";
const EVO_KEY = "4eab105201410d6865b86dca76ee9fa3";

// Cache em memória pra evitar refetch (instance::msgId → blob URL)
const _cache = new Map();

async function _fetchMedia(instance, msgId) {
  const key = `${instance}::${msgId}`;
  if (_cache.has(key)) return _cache.get(key);
  const r = await fetch(
    `${EVO_API}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`,
    {
      method: "POST",
      headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { key: { id: msgId } },
        convertToMp4: false,
      }),
    }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const mime = j.mimetype || "application/octet-stream";
  const fileName = j.fileName || `media-${msgId}`;
  const bin = atob(j.base64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const data = { url, mime, fileName };
  _cache.set(key, data);
  return data;
}

function WhatsMediaRender({ m, fallbackInstance }) {
  const [state, setState] = p.useState({ loading: false, error: null, data: null });
  const t = String(m && m.message_type || "").toLowerCase();
  const isAudio = t.includes("audio") || t.includes("ptt");
  const isImage = t.includes("image") || t.includes("sticker");
  const isDoc = t.includes("document");
  const isVideo = t.includes("video");
  const icon = isAudio ? "🎵" : isImage ? "🖼️" : isDoc ? "📄" : isVideo ? "🎬" : "📎";
  const label = isAudio
    ? "Ouvir áudio"
    : isImage
    ? "Ver imagem"
    : isDoc
    ? "Baixar documento"
    : isVideo
    ? "Ver vídeo"
    : "Baixar mídia";

  const instance = (m && m.instance) || fallbackInstance || "";
  const msgId = m && (m.evolution_msg_id || (m.id && String(m.id).startsWith("evo-") && m.id.slice(4)));

  async function loadMedia() {
    if (!instance || !msgId) {
      setState({ loading: false, error: "sem ID Evolution", data: null });
      return;
    }
    setState({ loading: true, error: null, data: null });
    try {
      const d = await _fetchMedia(instance, msgId);
      setState({ loading: false, error: null, data: d });
    } catch (e) {
      setState({ loading: false, error: String(e.message || e), data: null });
    }
  }

  const btnStyle = {
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.9)",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: "0.6rem",
    cursor: "pointer",
    marginTop: 4,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    lineHeight: 1.4,
    fontFamily: "inherit",
  };

  if (state.loading) {
    return p.createElement(
      "div",
      { style: { ...btnStyle, opacity: 0.6 } },
      `${icon} carregando…`
    );
  }
  if (state.error) {
    return p.createElement(
      "div",
      { style: { ...btnStyle, color: "#FCA5A5", borderColor: "#EF444460" } },
      `${icon} ${state.error}`
    );
  }
  if (state.data) {
    const { url, mime, fileName } = state.data;
    if (isAudio) {
      return p.createElement("audio", {
        controls: true,
        src: url,
        style: { width: "100%", maxWidth: 260, marginTop: 4, height: 30 },
      });
    }
    if (isImage) {
      return p.createElement(
        "a",
        {
          href: url,
          target: "_blank",
          rel: "noreferrer",
          download: fileName,
          style: { display: "block", marginTop: 4 },
        },
        p.createElement("img", {
          src: url,
          style: {
            maxWidth: 240,
            maxHeight: 200,
            borderRadius: 6,
            display: "block",
          },
        })
      );
    }
    if (isVideo) {
      return p.createElement("video", {
        controls: true,
        src: url,
        style: { maxWidth: 260, maxHeight: 240, marginTop: 4, borderRadius: 6 },
      });
    }
    // Documento / outros: link de download
    return p.createElement(
      "a",
      {
        href: url,
        download: fileName,
        style: { ...btnStyle, textDecoration: "none" },
      },
      `${icon} Baixar ${fileName}`
    );
  }
  return p.createElement(
    "button",
    { onClick: loadMedia, style: btnStyle },
    `${icon} ${label}`
  );
}

export { WhatsMediaRender as W };
