/**
 * cronograma-pdf.ts — Acompanhamento de Obras (PDF paisagem A4 estilo Parket)
 * Port fiel do gerador do Space (Dashboardparketapp cronograma-pdf.ts).
 */
import jsPDF from "jspdf";

/* ═══════════════════════  Tipos  ═══════════════════════ */

export interface CronogramaItem {
  servico: string;
  servico_id?: string;
  quantidade: number;
  unidade: string;
  instalado?: number;
  pendente?: number;
  dias_uteis: number;
  rendimento?: number;
  status?: "pendente" | "em_andamento" | "concluido" | "atrasado";
  observacao?: string;
}

export interface CronogramaAlerta {
  tipo: "pendencia_obra" | "atraso_parket" | "outros";
  tipo_outro?: string;
  motivo: string;
  data: string;
  servico_ref?: string;
  status?: "aberto" | "resolvido";
}

export interface CronogramaMedia {
  url: string;
  type?: "image" | "video";
  description?: string;
  categoria?: string;
  produtos?: string[];
  ambiente?: string;
  caption?: string;
  date?: string;
  thumbUrl?: string;
}

export interface CronogramaPdfInput {
  cliente: string;
  vendedor?: string;
  responsavel?: string;
  endereco?: string;
  equipe?: string;
  descricao_produto?: string;
  obra?: string;
  itens: CronogramaItem[];
  alertas?: CronogramaAlerta[];
  previsao_inicio?: string;
  data_entrega?: string;
  observacao?: string;
  medias?: CronogramaMedia[];
}

/* ═══════════════════  Helpers  ═══════════════════ */

function fmtDate(d: string | undefined | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

/** Converte imagem remota em data-URI JPEG (max 800×600). */
async function imageToDataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.startsWith("image/")) {
        const bmp = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        const scale = Math.min(800 / bmp.width, 600 / bmp.height, 1);
        canvas.width = bmp.width * scale;
        canvas.height = bmp.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/jpeg", 0.8);
        }
      }
    }
  } catch {
    /* fallback below */
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(800 / img.width, 600 / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      } else {
        reject(new Error("no ctx"));
      }
    };
    img.onerror = () => reject(new Error("img load failed"));
    setTimeout(() => reject(new Error("timeout")), 10_000);
    img.src = url;
  });
}

/** Captura thumbnail de vídeo (frame em 0.5s). */
function videoThumbnail(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const vid = document.createElement("video");
    vid.crossOrigin = "anonymous";
    vid.muted = true;
    vid.preload = "metadata";
    vid.onloadeddata = () => {
      vid.currentTime = 0.5;
    };
    vid.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(vid.videoWidth, 640);
        canvas.height = Math.min(vid.videoHeight, 480);
        const sx = Math.min(canvas.width / vid.videoWidth, canvas.height / vid.videoHeight);
        const w = vid.videoWidth * sx;
        const h = vid.videoHeight * sx;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(vid, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } else {
          reject(new Error("no canvas ctx"));
        }
      } catch (err) {
        reject(err);
      } finally {
        vid.src = "";
        vid.load();
      }
    };
    vid.onerror = () => reject(new Error("video load failed"));
    setTimeout(() => reject(new Error("timeout")), 5_000);
    vid.src = url;
  });
}

const fmtNum = (n: number) => (Math.round(n * 100) / 100).toString();

/* ═══════════════  STATUS LABELS  ═══════════════ */

const STATUS_LABEL: Record<string, string> = {
  pendente: "PENDENTE",
  em_andamento: "EM ANDAMENTO",
  concluido: "CONCLUÍDO",
  atrasado: "ATRASADO",
};

const ALERTA_TIPO_LABEL: Record<string, string> = {
  pendencia_obra: "Pendência de Obra (Cliente)",
  atraso_parket: "Atraso da Parket",
  outros: "Outros",
};

/* ═══════════════  DISCLAIMER FOOTER  ═══════════════ */

const DISCLAIMER =
  "Os prazos apresentados no cronograma são equivalentes aos prazos contratuais. " +
  "Este documento possui caráter informativo, com o objetivo de proporcionar uma visão geral " +
  "dos períodos estimados de instalação da Parket. Após o projeto aprovado e a liberação da " +
  "obra enviaremos um novo cronograma contendo as datas de início e finalização de cada item.";

/* ═══════════════════════════════════════════════════════
   FUNÇÃO PRINCIPAL — gerarCronogramaPdf
   ═══════════════════════════════════════════════════════ */

export async function gerarCronogramaPdf(n: CronogramaPdfInput): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const pageH = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;

  const hasDelay =
    n.itens.some((i) => i.status === "atrasado") ||
    (n.alertas ?? []).some((a) => a.status !== "resolvido");

  /* ─── CAPA ─── */
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(52);
  doc.text("PARKET", 30, pageH * 0.38);
  doc.setFontSize(14);
  doc.setTextColor(200, 200, 200);
  doc.text("ACOMPANHAMENTO DE OBRAS", 30, pageH * 0.38 + 18);

  if (n.obra || n.cliente) {
    doc.setFontSize(11);
    doc.setTextColor(180, 170, 154);
    doc.text(
      `${n.obra ? n.obra + " — " : ""}${n.cliente}`.toUpperCase(),
      30,
      pageH * 0.38 + 32,
    );
  }
  if (hasDelay) {
    doc.setFontSize(12);
    doc.setTextColor(239, 68, 68);
    doc.text("PROJETO COM ALERTA DE ATRASO", 30, pageH * 0.38 + 48);
  }
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    30,
    pageH - 15,
  );

  /* ─── DADOS DO PROJETO ─── */
  doc.addPage();
  let y = margin;
  const rowH = 10;
  const labelW = 65;
  const valW = contentW - labelW;

  doc.setFillColor(40, 40, 40);
  doc.rect(margin, y, contentW, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DADOS DO PROJETO", pageW / 2, y + 6, { align: "center" });
  y += 11;

  const projectRows: [string, string][] = [
    ["CLIENTE", (n.cliente || "").toUpperCase()],
    ["VENDEDOR", n.vendedor || "—"],
    ["RESPONSÁVEL DA OBRA", n.responsavel || "—"],
    ["ENDEREÇO", n.endereco || "—"],
  ];
  if (n.equipe) projectRows.push(["EQUIPE", n.equipe]);

  for (const [label, value] of projectRows) {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, labelW, rowH, "F");
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, labelW, rowH, "S");
    doc.rect(margin + labelW, y, valW, rowH, "S");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    doc.text(label, margin + 3, y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + labelW + 3, y + 6.5);
    y += rowH;
  }

  /* ─── DESCRIÇÃO DO PRODUTO ─── */
  if (n.descricao_produto) {
    y += 8;
    doc.setFillColor(90, 90, 90);
    doc.rect(margin, y, contentW, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("DESCRIÇÃO DO PRODUTO", pageW / 2, y + 6, { align: "center" });
    y += 11;
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(n.descricao_produto, contentW - 4);
    doc.text(descLines, margin + 2, y + 4);
    y += descLines.length * 4.5 + 8;
  }

  /* ─── CRONOGRAMA DE SERVIÇOS ───
   * IMPORTANTE: a coluna OBSERVAÇÃO foi removida intencionalmente
   * (decisão do produto) — esse PDF vai pro cliente. NÃO RE-ADICIONAR. */
  const colWidths = [contentW - 150, 30, 30, 30, 30, 30];
  const colHeaders = [
    "DESCRIÇÃO DO SERVIÇO",
    "CONTRATADO",
    "INSTALADO",
    "PENDENTE",
    "DIAS ÚTEIS",
    "STATUS",
  ];

  if (y + 30 > pageH - 15) {
    doc.addPage();
    y = margin;
  }

  doc.setFillColor(40, 40, 40);
  doc.rect(margin, y, contentW, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CRONOGRAMA DE SERVIÇOS", pageW / 2, y + 6, { align: "center" });
  y += 11;

  doc.setFillColor(90, 90, 90);
  doc.rect(margin, y, contentW, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  let cx = margin;
  for (let i = 0; i < colHeaders.length; i++) {
    doc.text(colHeaders[i], cx + colWidths[i] / 2, y + 5.5, { align: "center" });
    cx += colWidths[i];
  }
  y += 8;

  for (let idx = 0; idx < n.itens.length; idx++) {
    const item = n.itens[idx];
    const isLate = item.status === "atrasado";
    const rh = 14;

    if (y + rh > pageH - 15) {
      doc.addPage();
      y = margin;
    }

    if (isLate) {
      doc.setFillColor(255, 240, 240);
      doc.rect(margin, y, contentW, rh, "F");
    }

    let bx = margin;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    for (const w of colWidths) {
      doc.rect(bx, y, w, rh, "S");
      bx += w;
    }

    const mid = y + rh / 2 + 1;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text(`${String(idx + 1).padStart(2, "0")} - ${item.servico.toUpperCase()}`, margin + 2, mid);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `${fmtNum(item.quantidade)} ${item.unidade.toUpperCase()}`,
      margin + colWidths[0] + colWidths[1] / 2,
      mid,
      { align: "center" },
    );

    doc.text(
      `${fmtNum(item.instalado ?? 0)} ${item.unidade.toUpperCase()}`,
      margin + colWidths[0] + colWidths[1] + colWidths[2] / 2,
      mid,
      { align: "center" },
    );

    const pend = item.pendente ?? item.quantidade;
    if (pend > 0) doc.setTextColor(200, 120, 0);
    doc.text(
      `${fmtNum(pend)} ${item.unidade.toUpperCase()}`,
      margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] / 2,
      mid,
      { align: "center" },
    );
    doc.setTextColor(40, 40, 40);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text(
      `${item.dias_uteis} DIAS`,
      margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] / 2,
      mid,
      { align: "center" },
    );

    const statusText = STATUS_LABEL[item.status ?? "pendente"] ?? (item.status ?? "PENDENTE").toUpperCase();
    if (isLate) {
      doc.setTextColor(200, 30, 30);
    } else if (item.status === "concluido") {
      doc.setTextColor(20, 140, 80);
    } else if (item.status === "em_andamento") {
      doc.setTextColor(30, 100, 200);
    } else {
      doc.setTextColor(100, 100, 100);
    }
    doc.setFontSize(7);
    doc.text(
      statusText,
      margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] / 2,
      mid,
      { align: "center" },
    );
    doc.setTextColor(40, 40, 40);

    y += rh;
  }

  y += 10;

  /* ─── ALERTAS DE ATRASO ─── */
  const alertas = (n.alertas ?? []).filter((a) => a.status !== "resolvido");
  if (alertas.length > 0) {
    if (y > pageH - 40) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(200, 30, 30);
    doc.rect(margin, y, contentW, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`ALERTAS DE ATRASO (${alertas.length})`, pageW / 2, y + 5.5, { align: "center" });
    y += 10;

    for (const al of alertas) {
      if (y > pageH - 20) {
        doc.addPage();
        y = margin;
      }

      doc.setFillColor(255, 245, 245);
      doc.rect(margin, y, contentW, 14, "F");
      doc.setDrawColor(220, 180, 180);
      doc.setLineWidth(0.3);
      doc.rect(margin, y, contentW, 14, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(200, 30, 30);
      const tipoLabel = ALERTA_TIPO_LABEL[al.tipo] ?? al.tipo_outro ?? al.tipo;
      const svcRef = al.servico_ref ? ` — ${al.servico_ref}` : "";
      doc.text(`${tipoLabel}${svcRef}`, margin + 3, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text(fmtDate(al.data), margin + contentW - 25, y + 5);

      const motLines = doc.splitTextToSize(al.motivo, contentW - 8);
      doc.text(motLines[0] ?? "", margin + 3, y + 10);

      y += 16;
    }
    y += 6;
  }

  /* ─── PRAZO DE ENTREGA ─── */
  if (n.previsao_inicio || n.data_entrega) {
    if (y > pageH - 55) {
      doc.addPage();
      y = margin;
    }

    const totalDias = n.itens.reduce((sum, i) => sum + i.dias_uteis, 0);
    const boxW = 180;
    const boxX = (pageW - boxW) / 2;

    doc.setFillColor(40, 40, 40);
    doc.rect(boxX, y, boxW, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PRAZO DE ENTREGA", pageW / 2, y + 6, { align: "center" });
    y += 11;

    const statusPrazo = hasDelay ? "ATRASADO" : "NO PRAZO";
    const prazoRows: [string, string][] = [
      ["INÍCIO", fmtDate(n.previsao_inicio)],
      ["PRAZO DE FINALIZAÇÃO", fmtDate(n.data_entrega)],
      ["TOTAL DIAS ÚTEIS", `${totalDias} DIAS`],
      ["STATUS", statusPrazo],
    ];

    doc.setFontSize(10);
    for (const [label, value] of prazoRows) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(boxX, y, boxW / 2, 10, "S");
      doc.rect(boxX + boxW / 2, y, boxW / 2, 10, "S");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(label, boxX + boxW / 4, y + 6.5, { align: "center" });

      if (label === "STATUS") {
        if (hasDelay) {
          doc.setFillColor(255, 230, 230);
          doc.setTextColor(200, 30, 30);
        } else {
          doc.setFillColor(220, 245, 220);
          doc.setTextColor(20, 140, 80);
        }
        doc.rect(boxX + boxW / 2, y, boxW / 2, 10, "F");
        doc.rect(boxX + boxW / 2, y, boxW / 2, 10, "S");
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }

      doc.text(value, boxX + (boxW * 3) / 4, y + 6.5, { align: "center" });
      doc.setTextColor(40, 40, 40);
      y += 10;
    }
    y += 12;
  }

  /* ─── REGISTRO FOTOGRÁFICO ─── */
  const medias = (n.medias ?? []).filter((m) => m.url);
  if (medias.length > 0) {
    const processed: CronogramaMedia[] = [];
    for (const media of medias) {
      if (media.type === "video") {
        try {
          const thumb = await videoThumbnail(media.url);
          processed.push({ ...media, thumbUrl: thumb });
        } catch {
          processed.push({ ...media, thumbUrl: undefined });
        }
      } else if (media.url.startsWith("http")) {
        try {
          const dataUri = await imageToDataUri(media.url);
          processed.push({ ...media, thumbUrl: dataUri });
        } catch {
          processed.push(media);
        }
      } else {
        processed.push(media);
      }
    }

    doc.addPage();
    y = margin;

    doc.setFillColor(40, 40, 40);
    doc.rect(margin, y, contentW, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`REGISTRO FOTOGRÁFICO (${medias.length})`, pageW / 2, y + 6, { align: "center" });
    y += 14;

    const groups: Record<string, CronogramaMedia[]> = {};
    for (const m of processed) {
      const tags: string[] = [];
      if (m.ambiente) tags.push(m.ambiente);
      if (m.produtos?.length) {
        tags.push(m.produtos.join(", "));
      } else if (m.categoria && m.categoria !== "Geral") {
        tags.push(m.categoria);
      }
      const key = tags.length > 0 ? tags.join(" — ") : "Geral";
      (groups[key] ??= []).push(m);
    }

    const thumbW = 82;
    const thumbH = 62;
    const gap = 8;
    const cols = 3;
    const captionH = 18;

    for (const [groupName, items] of Object.entries(groups)) {
      if (y + 20 > pageH - 15) {
        doc.addPage();
        y = margin;
      }

      doc.setFillColor(60, 60, 60);
      doc.rect(margin, y, contentW, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`  ${groupName.toUpperCase()}  (${items.length})`, margin + 3, y + 5);
      y += 10;

      for (let i = 0; i < items.length; i++) {
        const col = i % cols;

        if (col === 0 && i > 0) {
          y += thumbH + captionH + 4;
        }
        if (y + thumbH + captionH > pageH - 10) {
          doc.addPage();
          y = margin;
        }

        const px = margin + col * (thumbW + gap);
        const media = items[i];
        const isVideo = media.type === "video";
        const src = media.thumbUrl || media.url;

        try {
          if (src && src.startsWith("data:image/")) {
            doc.addImage(src, "JPEG", px, y, thumbW, thumbH);
          } else {
            throw new Error("no image");
          }
        } catch {
          doc.setFillColor(isVideo ? 30 : 230, isVideo ? 30 : 230, isVideo ? 30 : 230);
          doc.rect(px, y, thumbW, thumbH, "F");
          doc.setFontSize(isVideo ? 14 : 8);
          doc.setTextColor(isVideo ? 255 : 150, isVideo ? 255 : 150, isVideo ? 255 : 150);
          doc.text(isVideo ? "VIDEO" : "FOTO", px + thumbW / 2, y + thumbH / 2, { align: "center" });
        }

        if (isVideo) {
          doc.setFillColor(200, 30, 30);
          doc.roundedRect(px + 2, y + 2, 20, 7, 1, 1, "F");
          doc.setFontSize(5);
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.text("VIDEO", px + 12, y + 6.5, { align: "center" });
        }

        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.rect(px, y, thumbW, thumbH, "S");

        let captionY = y + thumbH + 3;

        const desc = media.description || "";
        if (desc) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6);
          doc.setTextColor(40, 40, 40);
          const dl = doc.splitTextToSize(desc, thumbW - 2);
          doc.text(dl.slice(0, 2).join("\n"), px + 1, captionY);
          captionY += Math.min(dl.length, 2) * 3;
        }

        const tags: string[] = [];
        if (media.ambiente) tags.push(media.ambiente);
        if (media.produtos?.length) {
          tags.push(media.produtos.join(", "));
        } else if (media.categoria && media.categoria !== "Geral") {
          tags.push(media.categoria);
        }
        if (tags.length) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5);
          doc.setTextColor(100, 100, 100);
          doc.text(tags.join(" · "), px + 1, captionY + 2);
          captionY += 3;
        }

        if (media.date) {
          doc.setFontSize(5);
          doc.setTextColor(160, 160, 160);
          doc.text(fmtDate(media.date?.split("T")[0]), px + 1, captionY + 2);
        }
      }

      y += thumbH + captionH + 6;
    }
  }

  /* ─── DISCLAIMER ─── */
  if (y > pageH - 25) {
    doc.addPage();
    y = margin;
  }
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  const discLines = doc.splitTextToSize(DISCLAIMER, contentW);
  doc.text(discLines, margin, y);

  /* ─── SALVAR ─── */
  const filename = `ACOMPANHAMENTO - ${n.obra ?? "OBRA"} ${n.cliente}`
    .replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, "")
    .trim();
  doc.save(`${filename}.pdf`);
}
