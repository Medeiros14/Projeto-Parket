// Gera arquivo .ics (iCalendar) compatível com Google Calendar, Apple Calendar,
// Outlook, Samsung Calendar — qualquer app que entenda RFC 5545.
//
// Uso típico:
//   downloadICS(generateICS(agendamento))
//
// O vendedor clica no botão "Adicionar à minha agenda" no celular → o sistema
// operacional abre o app de calendário automaticamente e oferece importar.

import type { Agendamento } from "./api";

/** Escapa caracteres especiais conforme RFC 5545 §3.3.11 */
function escapeICS(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Formata Date pro padrão iCal: 20260601T140000Z (UTC) */
function fmtICalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Combina data + hora locais (Brasil) em Date UTC */
function parseLocalDateTime(data: string, hora: string): Date {
  // data: YYYY-MM-DD · hora: HH:MM:SS
  const [y, m, d] = data.split("-").map(Number);
  const [hh, mm, ss] = hora.split(":").map(Number);
  // new Date(ano,mes,dia,h,m,s) usa timezone local — o navegador converte pra UTC ao usar getUTC*
  return new Date(y, m - 1, d, hh, mm, ss || 0);
}

/** Gera o conteúdo do arquivo .ics pra um agendamento */
export function generateICS(ag: Agendamento): string {
  const dtStart = parseLocalDateTime(ag.data, ag.hora_inicio);
  const dtEnd = parseLocalDateTime(ag.data, ag.hora_fim);
  const dtStamp = new Date();

  const titulo = ag.cliente_nome
    ? `Reunião · ${ag.cliente_nome}`
    : `Reunião · ${ag.vendedor}`;

  // Descrição: vendedor, link, observações
  const descParts: string[] = [];
  descParts.push(`Vendedor: ${ag.vendedor}`);
  if (ag.cliente_nome) descParts.push(`Cliente: ${ag.cliente_nome}`);
  descParts.push(
    `Modalidade: ${ag.modalidade === "meet" ? "Online" : "Presencial"}`
  );
  if (ag.meet_link) descParts.push(`Link da reunião: ${ag.meet_link}`);
  if (ag.observacoes) descParts.push("", ag.observacoes);
  const description = descParts.join("\\n");

  // Location: link (Meet) ou endereço (Presencial)
  const location =
    ag.modalidade === "meet" ? ag.meet_link || "" : ag.endereco || "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parket Homebroker//Agendamentos//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ag.id}@homebroker.parket.works`,
    `DTSTAMP:${fmtICalDate(dtStamp)}`,
    `DTSTART:${fmtICalDate(dtStart)}`,
    `DTEND:${fmtICalDate(dtEnd)}`,
    `SUMMARY:${escapeICS(titulo)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    location && `LOCATION:${escapeICS(location)}`,
    ag.meet_link && `URL:${escapeICS(ag.meet_link)}`,
    `STATUS:${ag.status === "cancelado" ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M", // lembrete 15 min antes
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeICS("Lembrete: " + titulo)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  // RFC 5545 exige CRLF
  return lines.join("\r\n");
}

/** Dispara o download do .ics no browser. */
export function downloadICS(content: string, filename = "agendamento.ics") {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoga após 5s pra dar tempo do mobile abrir
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Gera link Google Calendar (abre na web — útil pra desktop). */
export function googleCalendarUrl(ag: Agendamento): string {
  const dtStart = parseLocalDateTime(ag.data, ag.hora_inicio);
  const dtEnd = parseLocalDateTime(ag.data, ag.hora_fim);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const titulo = ag.cliente_nome
    ? `Reunião · ${ag.cliente_nome}`
    : `Reunião · ${ag.vendedor}`;
  const details = [
    `Vendedor: ${ag.vendedor}`,
    ag.cliente_nome && `Cliente: ${ag.cliente_nome}`,
    `Modalidade: ${ag.modalidade === "meet" ? "Online" : "Presencial"}`,
    ag.meet_link && `Link: ${ag.meet_link}`,
    ag.observacoes,
  ]
    .filter(Boolean)
    .join("\n");
  const location =
    ag.modalidade === "meet" ? ag.meet_link || "" : ag.endereco || "";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${fmt(dtStart)}/${fmt(dtEnd)}`,
    details,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
