/**
 * Google Identity Services (GIS) auth compartilhado.
 * Usado por google-meet.ts (Calendar) e google-drive.ts (Drive).
 *
 * Cache incremental por scope: quando pede um scope novo, GIS estende o
 * grant existente sem popup novo (silent).
 */

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export const SCOPES = {
  CALENDAR:  "https://www.googleapis.com/auth/calendar.events",
  DRIVE_FILE: "https://www.googleapis.com/auth/drive.file",
  // Drive completo: o painel "Drive do cliente" do card lista e sobe arquivo
  // em pastas do shared drive Comercial (drive.file so enxerga arquivo criado
  // pelo proprio app, nao serve pra navegar a pasta do cliente).
  DRIVE: "https://www.googleapis.com/auth/drive",
} as const;

let gisLoadPromise: Promise<void> | null = null;
// Cache por conjunto de scopes concedidos (guardamos o mais amplo já autorizado)
let cachedToken: { value: string; scopes: string[]; expiresAt: number } | null = null;
let tokenClient: any = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SCRIPT_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisLoadPromise;
}

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  if (!id) throw new Error("VITE_GOOGLE_CLIENT_ID não configurado");
  return id;
}

/** Pede access_token pra um ou mais scopes. Reusa cache se já tem TODOS os
 *  scopes autorizados. Caso contrário faz incremental auth (silencioso se
 *  sessão Google ativa). */
export async function getAccessToken(scopes: string[]): Promise<string> {
  const needScopes = Array.from(new Set(scopes));
  const cacheOk = cachedToken
    && cachedToken.expiresAt > Date.now() + 30_000
    && needScopes.every((s) => cachedToken!.scopes.includes(s));
  if (cacheOk) return cachedToken!.value;

  await loadGis();
  const google = (window as any).google;
  return new Promise((resolve, reject) => {
    // Cria/atualiza tokenClient — GIS combina os scopes automaticamente
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: needScopes.join(" "),
      callback: () => {},
      error_callback: (err: any) => {
        if (err?.type === "popup_failed_to_open") {
          reject(new Error("O navegador bloqueou o popup de login do Google. Permita popups para homebroker.parket.works (ícone na barra de endereço) e tente de novo."));
        } else if (err?.type === "popup_closed") {
          reject(new Error("Login do Google cancelado (popup fechado)."));
        } else {
          reject(new Error(`Auth Google: ${err?.type || err?.message || "erro desconhecido"}`));
        }
      },
    });
    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        reject(new Error(`Auth Google: ${resp.error_description || resp.error}`));
        return;
      }
      cachedToken = {
        value: resp.access_token,
        scopes: (resp.scope as string || needScopes.join(" ")).split(/\s+/),
        expiresAt: Date.now() + Number(resp.expires_in || 3600) * 1000,
      };
      resolve(resp.access_token);
    };
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

/** Pré-carrega o script GIS pra que o popup de auth abra ainda dentro do
 *  gesto de clique do usuário (senão o navegador bloqueia o popup). */
export function preloadGis(): void { loadGis().catch(() => {}); }

export function clearGoogleAuth() { cachedToken = null; }
export function isGoogleConfigured(): boolean { return !!(import.meta.env.VITE_GOOGLE_CLIENT_ID); }
