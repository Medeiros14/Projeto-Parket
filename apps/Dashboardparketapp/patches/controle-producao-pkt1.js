// controle-producao-pkt1.js
// ────────────────────────────────────────────────────────────────────
// Modal de Controle de Produção — lista de itens rastreados do card
// + status por item + timeline de checkpoints (produção/logística/obra).
//
// Expõe `window.__pkt_openControleProducao({card})`.
// ────────────────────────────────────────────────────────────────────
import { s as supabase } from "./index-DZtetJYP.js";

const STATUS_COLORS = {
  "pendente":           { bg: "rgba(107,114,128,0.18)", color: "#9CA3AF", label: "Pendente" },
  "em-producao":        { bg: "rgba(245,158,11,0.18)",  color: "#FBBF24", label: "Em produção" },
  "aprovado":           { bg: "rgba(16,185,129,0.18)",  color: "#34D399", label: "Aprovado" },
  "nao-conforme":       { bg: "rgba(239,68,68,0.18)",   color: "#F87171", label: "Não-conforme" },
  "enviado":            { bg: "rgba(59,130,246,0.18)",  color: "#60A5FA", label: "Enviado" },
  "em-transito":        { bg: "rgba(20,184,166,0.18)",  color: "#5EEAD4", label: "Em trânsito" },
  "recebido-na-obra":   { bg: "rgba(168,85,247,0.18)",  color: "#C084FC", label: "Recebido na obra" },
  "instalado":          { bg: "rgba(34,197,94,0.20)",   color: "#4ADE80", label: "Instalado ✓" },
};

const SETOR_LABEL = { producao: "Produção", logistica: "Logística", obra: "Obra" };
const SETOR_COLOR = { producao: "#FBBF24", logistica: "#60A5FA", obra: "#C084FC" };

function _statusPill(status) {
  const s = STATUS_COLORS[status] || STATUS_COLORS["pendente"];
  const el = document.createElement("span");
  el.style.cssText = `background:${s.bg};color:${s.color};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;white-space:nowrap`;
  el.textContent = s.label;
  return el;
}

function _fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function _fetchItens(cardId) {
  const { data, error } = await supabase
    .from("itens_rastreio")
    .select("id, servico, ambiente, descricao, qtd, unidade, status_atual, created_at, updated_at")
    .eq("card_id", cardId)
    .order("servico").order("ambiente");
  if (error) { console.error("[ControleProd] fetch itens:", error); return []; }
  return data || [];
}

async function _fetchCheckpoints(itemIds) {
  if (!itemIds.length) return {};
  const { data, error } = await supabase
    .from("itens_checkpoints")
    .select("id, item_id, setor, acao, status, foto_url, verificado_por, obs, created_at")
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });
  if (error) { console.error("[ControleProd] fetch chk:", error); return {}; }
  const byItem = {};
  for (const c of data || []) {
    if (!byItem[c.item_id]) byItem[c.item_id] = [];
    byItem[c.item_id].push(c);
  }
  return byItem;
}

async function _generateItens(cardId) {
  const { data, error } = await supabase.rpc("generate_rastreio_for_card", { p_card_id: cardId });
  if (error) { alert("Erro ao gerar lista: " + error.message); return 0; }
  return data || 0;
}

// Gera um <img> com data-url do QR pra um texto. Usa biblioteca qrcodejs via CDN
// num iframe interno — não polui o bundle. Fallback: usa API pública (sem deps).
function _qrDataUrl(text, size = 280) {
  // Usa serviço estável: api.qrserver.com — gera PNG sem libs no client.
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(text)}`;
  return url;
}

function _baseUrlForItem(itemId) {
  return `https://base.parket.works/leitor/?id=${itemId}`;
}

async function openQRPrint(cardId, cardTitle, cardObra) {
  const itens = await _fetchItens(cardId);
  if (!itens.length) { alert("Nenhum item rastreado pra gerar QR. Use 'Gerar/Atualizar lista' primeiro."); return; }

  // Gera HTML imprimível em uma nova janela
  const w = window.open("", "_blank", "width=900,height=900");
  if (!w) { alert("Bloqueado pelo navegador. Permita pop-ups."); return; }

  const grupos = {};
  for (const it of itens) {
    const k = it.servico || "—";
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(it);
  }

  let body = "";
  for (const svc of Object.keys(grupos)) {
    for (const it of grupos[svc]) {
      const url = _baseUrlForItem(it.id);
      body += `
        <div class="qr">
          <img src="${_qrDataUrl(url, 260)}" alt="QR"/>
          <div class="meta">
            <div class="t">${svc}</div>
            <div class="d">${it.descricao || "—"}</div>
            <div class="a">${it.ambiente || ""}${it.qtd ? " · " + it.qtd + (it.unidade||"") : ""}</div>
            <div class="id">${it.id.slice(0,8)}</div>
          </div>
        </div>
      `;
    }
  }

  w.document.open();
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>QR — ${cardTitle || "Card"}</title>
    <style>
      @page { margin: 8mm; }
      body { font-family: system-ui, sans-serif; margin: 0; padding: 8mm; background:#fff; color:#111; }
      h1 { font-size: 14px; margin: 0 0 4mm; }
      .sub { font-size: 11px; color: #555; margin-bottom: 8mm; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
      .qr { border: 1px dashed #999; border-radius: 4mm; padding: 4mm; display: flex; gap: 4mm; align-items: flex-start; page-break-inside: avoid; }
      .qr img { width: 32mm; height: 32mm; flex-shrink: 0; }
      .meta { font-size: 11px; line-height: 1.3; }
      .t { font-weight: 700; text-transform: uppercase; font-size: 9px; color: #888; letter-spacing: 0.05em; }
      .d { font-weight: 600; margin: 1mm 0; }
      .a { color: #555; font-size: 10px; }
      .id { font-family: ui-monospace, monospace; color: #999; font-size: 9px; margin-top: 1mm; }
      .actions { margin-bottom: 6mm; }
      .actions button { padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 4px; border: 1px solid #999; background: #fff; }
      @media print { .actions { display: none; } }
    </style>
  </head><body>
    <h1>🔧 Etiquetas de Rastreio — ${cardTitle || ""}${cardObra ? " · " + cardObra : ""}</h1>
    <div class="sub">${itens.length} itens · gerado em ${new Date().toLocaleString("pt-BR")}</div>
    <div class="actions"><button onclick="window.print()">🖨 Imprimir</button></div>
    <div class="grid">${body}</div>
  </body></html>`);
  w.document.close();
}

async function openControleProducao(opts) {
  const card = (opts || {}).card;
  if (!card || !card.id) { alert("Card inválido"); return; }

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;font-family:system-ui,-apple-system,sans-serif";
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.remove(); });

  const modal = document.createElement("div");
  modal.style.cssText = "background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:12px;max-width:920px;width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden";
  overlay.appendChild(modal);

  // Header
  const header = document.createElement("div");
  header.style.cssText = "padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;gap:12px";
  header.innerHTML = `
    <div>
      <div style="color:#fff;font-size:14px;font-weight:700">🔧 Controle de Produção</div>
      <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:2px">${card.title || ""}${card.obra ? " · " + card.obra : ""}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button id="_pkt_btn_qr" style="background:rgba(212,168,83,0.12);border:1px solid rgba(212,168,83,0.3);color:#D4A853;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600">🏷 Imprimir QR</button>
      <button id="_pkt_btn_gen" style="background:rgba(20,184,166,0.12);border:1px solid rgba(20,184,166,0.3);color:#5EEAD4;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600">↻ Gerar/Atualizar lista</button>
      <button id="_pkt_btn_close" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:16px">✕</button>
    </div>
  `;
  modal.appendChild(header);

  // Body
  const body = document.createElement("div");
  body.style.cssText = "flex:1;overflow-y:auto;padding:16px 20px";
  body.innerHTML = `<div style="color:rgba(255,255,255,0.5);font-size:12px;text-align:center;padding:24px">Carregando…</div>`;
  modal.appendChild(body);

  // Footer
  const footer = document.createElement("div");
  footer.style.cssText = "padding:10px 20px;border-top:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:10px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap";
  modal.appendChild(footer);

  document.body.appendChild(overlay);

  // Realtime: re-renderiza quando os itens ou checkpoints mudarem
  let rtChannels = [];
  function startRealtime() {
    try {
      const ch1 = supabase.channel(`ctrl_prod_${card.id}_itens`)
        .on("postgres_changes", { event: "*", schema: "public", table: "itens_rastreio", filter: `card_id=eq.${card.id}` }, () => render())
        .subscribe();
      const ch2 = supabase.channel(`ctrl_prod_${card.id}_chk`)
        .on("postgres_changes", { event: "*", schema: "public", table: "itens_checkpoints" }, () => render())
        .subscribe();
      rtChannels = [ch1, ch2];
    } catch (e) { console.warn("[ControleProd] realtime falhou:", e); }
  }
  function stopRealtime() {
    for (const c of rtChannels) { try { supabase.removeChannel(c); } catch{} }
    rtChannels = [];
  }
  startRealtime();

  function closeModal() {
    stopRealtime();
    overlay.remove();
  }
  document.getElementById("_pkt_btn_close").onclick = closeModal;
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) closeModal(); });

  // Lightbox de foto
  function openLightbox(url) {
    const lb = document.createElement("div");
    lb.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px";
    lb.onclick = () => lb.remove();
    const img = document.createElement("img");
    img.src = url;
    img.style.cssText = "max-width:92vw;max-height:88vh;border-radius:8px;object-fit:contain";
    const btn = document.createElement("button");
    btn.textContent = "✕";
    btn.style.cssText = "position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.12);border:none;color:#fff;width:36px;height:36px;border-radius:8px;font-size:18px;cursor:pointer";
    btn.onclick = (ev) => { ev.stopPropagation(); lb.remove(); };
    lb.appendChild(img);
    lb.appendChild(btn);
    document.body.appendChild(lb);
  }
  window.__pkt_ctrl_openLightbox = openLightbox;

  async function render() {
    const itens = await _fetchItens(card.id);
    const checkpoints = await _fetchCheckpoints(itens.map(i => i.id));

    if (!itens.length) {
      body.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:32px;margin-bottom:8px">📋</div>
          <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-bottom:6px">Nenhum item rastreado ainda.</div>
          <div style="color:rgba(255,255,255,0.5);font-size:11px;max-width:480px;margin:0 auto">
            Os itens são gerados automaticamente a partir do <b>levantamento</b> quando o card entra em <b>Entrada de Projeto</b>.
            Se o card foi importado de outro fluxo, clique em <b>"Gerar/Atualizar lista"</b> acima.
          </div>
        </div>
      `;
      footer.innerHTML = `<span>0 itens</span><span></span>`;
      return;
    }

    // Agrupar por serviço
    const grupos = {};
    for (const it of itens) {
      const k = it.servico || "—";
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push(it);
    }

    body.innerHTML = "";
    for (const servico of Object.keys(grupos)) {
      const sec = document.createElement("div");
      sec.style.cssText = "margin-bottom:18px";
      const h = document.createElement("div");
      h.style.cssText = "color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.08)";
      h.textContent = `${servico} · ${grupos[servico].length} ${grupos[servico].length === 1 ? "item" : "itens"}`;
      sec.appendChild(h);

      for (const it of grupos[servico]) {
        const row = document.createElement("div");
        row.style.cssText = "padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;margin-bottom:6px";

        const top = document.createElement("div");
        top.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start;gap:10px";
        const left = document.createElement("div");
        left.style.cssText = "flex:1;min-width:0";
        left.innerHTML = `
          <div style="color:#fff;font-size:12px;font-weight:600;margin-bottom:2px">${it.descricao || "—"}</div>
          <div style="color:rgba(255,255,255,0.55);font-size:10px">
            ${it.ambiente ? it.ambiente + " · " : ""}${it.qtd ? `${it.qtd}${it.unidade || ""}` : ""}
            ${it.id ? ` · <span style="color:rgba(255,255,255,0.35);font-family:ui-monospace,monospace">${it.id.slice(0,8)}</span>` : ""}
          </div>
        `;
        top.appendChild(left);
        top.appendChild(_statusPill(it.status_atual));
        row.appendChild(top);

        // Timeline de checkpoints
        const chks = checkpoints[it.id] || [];
        if (chks.length) {
          const tl = document.createElement("div");
          tl.style.cssText = "margin-top:8px;padding-top:8px;border-top:1px dashed rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:4px";
          for (const c of chks) {
            const ev = document.createElement("div");
            ev.style.cssText = "display:flex;gap:6px;align-items:center;font-size:10px;color:rgba(255,255,255,0.7)";
            const dot = document.createElement("span");
            dot.style.cssText = `width:6px;height:6px;border-radius:3px;background:${SETOR_COLOR[c.setor]||"#888"};display:inline-block;flex-shrink:0`;
            ev.appendChild(dot);
            const txt = document.createElement("span");
            txt.innerHTML = `<b style="color:#fff">${SETOR_LABEL[c.setor]||c.setor}</b> · ${c.acao} · <span style="color:${c.status==="aprovado"?"#34D399":c.status==="nao-conforme"?"#F87171":"#9CA3AF"}">${c.status}</span> · ${c.verificado_por||"—"} · ${_fmtDate(c.created_at)}${c.obs?` · <i style="color:rgba(255,255,255,0.5)">${c.obs}</i>`:""}`;
            ev.appendChild(txt);
            if (c.foto_url) {
              const img = document.createElement("img");
              img.src = c.foto_url;
              img.style.cssText = "width:36px;height:36px;border-radius:4px;object-fit:cover;cursor:pointer;margin-left:auto;flex-shrink:0;border:1px solid rgba(255,255,255,0.1)";
              img.onclick = () => openLightbox(c.foto_url);
              ev.appendChild(img);
            }
            tl.appendChild(ev);
          }
          row.appendChild(tl);
        }

        sec.appendChild(row);
      }
      body.appendChild(sec);
    }

    const total = itens.length;
    const counts = {};
    for (const it of itens) counts[it.status_atual] = (counts[it.status_atual]||0) + 1;
    const sumarios = Object.keys(counts).map(s => `${STATUS_COLORS[s]?.label||s}: <b>${counts[s]}</b>`).join(" · ");
    footer.innerHTML = `<span>${total} itens</span><span style="text-align:right">${sumarios}</span>`;
  }

  document.getElementById("_pkt_btn_qr").onclick = () => {
    openQRPrint(card.id, card.title, card.obra);
  };

  document.getElementById("_pkt_btn_gen").onclick = async () => {
    const btn = document.getElementById("_pkt_btn_gen");
    const orig = btn.textContent;
    btn.textContent = "Gerando…"; btn.disabled = true;
    await _generateItens(card.id);
    btn.textContent = orig; btn.disabled = false;
    await render();
  };

  await render();
}

if (typeof window !== "undefined") {
  window.__pkt_openControleProducao = openControleProducao;
}
