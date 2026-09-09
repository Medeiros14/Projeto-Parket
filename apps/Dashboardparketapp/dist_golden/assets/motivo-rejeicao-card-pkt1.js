/**
 * Motivo Rejeição no Card — chunk hotpatch Parket
 * No Kanban do setor Orçamento, quando um card está na coluna "Refazer" e
 * tem `details.ultima_rejeicao_motivo`, mostra um badge vermelho com o
 * motivo na frente do orçamentista — pra ele saber o que corrigir.
 *
 * Detecta via MutationObserver. Universal — funciona no Kanban principal
 * do Dashboard e na aba "Equipe & Demandas" do setor Orçamento.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktMotivoRejLoaded) return;
  window.__pktMotivoRejLoaded = true;

  const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

  // Cache: card_id → {motivo, em, por}
  const cardCache = new Map();
  let lastFetch = 0;

  async function carregarMotivos() {
    const now = Date.now();
    if (now - lastFetch < 15_000) return;  // 15s rate-limit
    lastFetch = now;
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/kanban_cards?select=id,details&dept_id=eq.orcamento&column_id=eq.refazer`,
        { headers: { apikey: SB_KEY } }
      );
      const a = await r.json();
      if (!Array.isArray(a)) return;
      cardCache.clear();
      for (const c of a) {
        const d = c.details || {};
        if (d.ultima_rejeicao_motivo) {
          cardCache.set(c.id, {
            motivo: d.ultima_rejeicao_motivo,
            em: d.ultima_rejeicao_em || null,
            por: d.ultima_rejeicao_por || null,
            n: (d.rejeicoes || []).length || 1,
          });
        }
      }
    } catch (e) { /* silent */ }
  }

  function fmtData(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("pt-BR") + " " + d.toTimeString().slice(0, 5);
    } catch { return ""; }
  }

  function makeBadge(info) {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-pkt-rej-badge", "1");
    Object.assign(wrap.style, {
      marginTop: "8px",
      padding: "8px 10px",
      background: "rgba(239,68,68,0.10)",
      border: "1px solid rgba(239,68,68,0.45)",
      borderRadius: "6px",
      fontSize: "11px",
      lineHeight: "1.35",
      color: "#fff",
    });
    const dataStr = info.em ? '<span style="opacity:0.6;font-size:10px"> · ' + fmtData(info.em) + '</span>' : '';
    const porStr = info.por ? ' <span style="color:rgba(255,255,255,0.65);font-size:10px">por ' + info.por + '</span>' : '';
    const nStr = info.n > 1 ? ' <span style="color:#F59E0B;font-weight:700">(' + info.n + 'ª)</span>' : '';
    wrap.innerHTML =
      '<div style="font-size:9px;color:#EF4444;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:4px">' +
      '⚠ Reprovado' + nStr + porStr + dataStr + '</div>' +
      '<div style="color:rgba(255,255,255,0.92)">' + escapeHtml(info.motivo) + '</div>';
    return wrap;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Acha cards na DOM e injeta badge. Estratégia: procura por elementos que
  // têm um UUID-ish que bate com nosso cache (data-card-id, data-id, etc).
  function injetarBadges() {
    if (cardCache.size === 0) return;
    cardCache.forEach((info, cardId) => {
      // Procura elementos com card_id no data-* ou no atributo key/href
      const sels = [
        `[data-card-id="${cardId}"]`,
        `[data-id="${cardId}"]`,
        `[id*="${cardId}"]`,
        `a[href*="${cardId}"]`,
      ];
      let alvos = [];
      for (const sel of sels) {
        try {
          alvos = Array.from(document.querySelectorAll(sel));
          if (alvos.length > 0) break;
        } catch {}
      }
      if (alvos.length === 0) return;
      for (const el of alvos) {
        // Sobe pra encontrar o cardzinho do Kanban (geralmente um container clicável)
        let card = el;
        for (let i = 0; i < 4; i++) {
          if (!card) break;
          if (card.querySelector("[data-pkt-rej-badge='1']")) return; // já injetado
          card = card.parentElement;
        }
        // Pega o elemento mais "card-like"
        let mountIn = el;
        for (let i = 0; i < 3; i++) {
          if (!mountIn.parentElement) break;
          const cs = window.getComputedStyle(mountIn.parentElement);
          if (cs.display === "flex" || cs.display === "grid") break;
          mountIn = mountIn.parentElement;
        }
        if (mountIn.querySelector("[data-pkt-rej-badge='1']")) continue;
        mountIn.appendChild(makeBadge(info));
      }
    });
  }

  async function tick() {
    await carregarMotivos();
    injetarBadges();
  }

  setInterval(tick, 5000);
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(tick, 800);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(tick, 800));
  }
})();
