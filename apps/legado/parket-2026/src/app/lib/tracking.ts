// Captura UTM + click IDs (fbclid/gclid/gbraid/wbraid/ttclid) + referrer/
// landing_url e persiste em sessionStorage. Roda 1× no bootstrap; o form lê
// no submit. Sobrevive navegação entre páginas; reseta a cada nova sessão.
//
// Google Ads: gclid (legacy, web c/ cookies), gbraid (iOS app→web sem cookies),
// wbraid (web→app iOS). Todos os 3 precisam ser capturados senão perdemos
// atribuição em campanhas modernas.

const KEY = "pkt_attrib";

export interface AttribData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  ttclid?: string;
  landing_url?: string;
  referrer?: string;
  captured_at?: string;
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const CLICK_IDS = ["fbclid", "gclid", "gbraid", "wbraid", "ttclid"] as const;

/** Roda no bootstrap do app — captura attribution se ainda não tem salvo. */
export function initAttributionTracking() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const existing = readAttribution();
    const next: AttribData = { ...existing };

    let novo = false;
    UTM_KEYS.forEach((k) => {
      const v = url.searchParams.get(k);
      if (v && next[k] !== v) { next[k] = v; novo = true; }
    });
    CLICK_IDS.forEach((k) => {
      const v = url.searchParams.get(k);
      if (v && next[k] !== v) { (next as any)[k] = v; novo = true; }
    });

    // Landing URL — só seta uma vez (primeira página da sessão)
    if (!next.landing_url) { next.landing_url = window.location.href; novo = true; }
    if (!next.referrer && document.referrer) { next.referrer = document.referrer; novo = true; }
    if (novo) { next.captured_at = new Date().toISOString(); save(next); }
  } catch (e) {
    // sessionStorage pode estar bloqueado (modo privado)
  }
}

export function readAttribution(): AttribData {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function save(a: AttribData) {
  try { sessionStorage.setItem(KEY, JSON.stringify(a)); } catch {}
}

/** Lê cookies _fbp / _fbc (set pelo Pixel JS). */
export function readMetaCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};
  const get = (n: string): string | undefined => {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${n}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : undefined;
  };
  return { fbp: get("_fbp"), fbc: get("_fbc") };
}

/** Lê cookies _ga / _gid (Google Analytics). */
export function readGaCookies(): { ga?: string; gid?: string } {
  if (typeof document === "undefined") return {};
  const get = (n: string): string | undefined => {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${n}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : undefined;
  };
  return { ga: get("_ga"), gid: get("_gid") };
}
