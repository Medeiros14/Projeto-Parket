/**
 * Integração Google Meet via Google Identity Services (GIS) + Calendar API.
 *
 * Fluxo client-side puro (sem backend):
 *  1. Carrega script https://accounts.google.com/gsi/client (lazy)
 *  2. Pede access_token com escopo calendar.events
 *  3. Cria evento no Calendar do user com conferenceData.createRequest
 *  4. Google devolve o evento criado com `hangoutLink` (URL Meet)
 *
 * Token vive em memória da sessão. Re-pedido silencioso (sem popup) enquanto
 * sessão Google do browser estiver ativa — popup só na primeira vez.
 *
 * Setup necessário: VITE_GOOGLE_CLIENT_ID no .env do frontend (ID OAuth Web
 * criado no Google Cloud Console + Calendar API habilitada).
 */

import { getAccessToken as gisGetAccessToken, SCOPES, clearGoogleAuth, isGoogleConfigured } from "./google-auth";

async function getAccessToken(): Promise<string> {
  return gisGetAccessToken([SCOPES.CALENDAR]);
}

export type CreateMeetInput = {
  titulo: string;
  descricao?: string;
  /** YYYY-MM-DDTHH:MM:SS (sem timezone — assume America/Sao_Paulo) */
  inicio: string;
  fim: string;
  /** Convidados (lista de emails). Se vazio, evento só do organizador. */
  convidados?: string[];
};

export type CreateMeetResult = {
  meetLink: string;
  eventId: string;
  htmlLink: string;
};

/** Cria evento no Calendar com Meet anexado. Retorna URL do Meet pronta pra colar.
 *  Erro se VITE_GOOGLE_CLIENT_ID não setado ou usuário cancelar o popup. */
export async function createMeetEvent(input: CreateMeetInput): Promise<CreateMeetResult> {
  const token = await getAccessToken();

  const body: any = {
    summary: input.titulo,
    description: input.descricao || "Reunião agendada via Parket Homebroker",
    start: { dateTime: input.inicio, timeZone: "America/Sao_Paulo" },
    end:   { dateTime: input.fim,    timeZone: "America/Sao_Paulo" },
    conferenceData: {
      createRequest: {
        requestId: `parket-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  if (input.convidados && input.convidados.length > 0) {
    body.attendees = input.convidados
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .map((email) => ({ email }));
  }

  const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1";
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errBody = await r.text().catch(() => "");
    throw new Error(`Google Calendar ${r.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await r.json();
  const meetLink = data.hangoutLink || data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri;
  if (!meetLink) {
    throw new Error("Google criou o evento mas não devolveu link Meet (verifique se Calendar API está habilitada).");
  }
  return {
    meetLink,
    eventId: data.id,
    htmlLink: data.htmlLink,
  };
}

/** Limpa o cache de token (logout, debug). */
export function clearMeetAuth() { clearGoogleAuth(); }

/** True se VITE_GOOGLE_CLIENT_ID está configurado. */
export function isMeetConfigured(): boolean { return isGoogleConfigured(); }
