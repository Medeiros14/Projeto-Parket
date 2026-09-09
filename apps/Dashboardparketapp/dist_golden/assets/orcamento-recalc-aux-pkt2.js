/**
 * Recalcula auxiliares "INSUMOS — <ambiente>" e "INSTALAÇÃO E GESTÃO DE OBRAS — <ambiente>"
 * POR AMBIENTE individual. Cada ambiente vira BLOCO DE 3:
 *   ordem N*10     → o próprio ambiente
 *   ordem N*10+1   → INSUMOS — <ambiente>
 *   ordem N*10+2   → INSTALAÇÃO E GESTÃO — <ambiente>
 *
 * Marca filhas com meta = {parent_item_id, aux_kind} pra updates idempotentes.
 *
 * Usa RPC public.pkt_recalc_aux_per_ambiente(uuid) por padrão (atômico + rápido).
 * Mantém função JS equivalente como fallback se RPC falhar.
 *
 * Percentuais:
 *   PISO: 70% ambiente / 10% insumos / 20% instalação
 *   resto: 60% / 15% / 25%
 *
 * Expõe:
 *   window.__pktRecalcAuxSimulacao(D, simulacao_id)         [async]
 *   window.__pktQueueRecalcAuxGrupo(D, simulacao_id, ...)   [debounced, retro-compat com V() do MARCFIX]
 *   window.__pktQueueRecalcAuxSimulacao(D, simulacao_id)    [debounced]
 *   window.__pktRecalcAuxAmbiente(D, simulacao_id, ambiente_id)
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktRecalcAuxSimulacao) return;

  var SUPA_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
  var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

  function getToken() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var raw = k && localStorage.getItem(k);
        if (!raw || (raw[0] !== "{" && raw[0] !== "[")) continue;
        try {
          var p = JSON.parse(raw);
          var t = (p && p.access_token) || (p && p.currentSession && p.currentSession.access_token) || null;
          if (t && t.length > 40) return t;
        } catch (e) {}
      }
    } catch (e) {}
    return SUPA_KEY;
  }

  // ── Debounce ──
  var _pending = {};
  function _queue(key, fn, delay) {
    if (_pending[key]) clearTimeout(_pending[key]);
    _pending[key] = setTimeout(function () {
      delete _pending[key];
      try { fn(); } catch (e) { console.warn("[recalc queue]", e); }
    }, delay || 800);
  }

  function rpcRecalc(simulacao_id) {
    return fetch(SUPA_URL + "/rest/v1/rpc/pkt_recalc_aux_per_ambiente", {
      method: "POST",
      headers: {
        apikey: SUPA_KEY,
        Authorization: "Bearer " + getToken(),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ p_sim_id: simulacao_id }),
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + " " + t); });
      return r.json();
    });
  }

  // Recalc por simulação — primeiro tenta RPC, depois fallback JS
  window.__pktRecalcAuxSimulacao = async function (D, simulacao_id) {
    if (!simulacao_id) return;
    try {
      await rpcRecalc(simulacao_id);
      return;
    } catch (e) {
      console.warn("[recalc rpc falhou, fallback JS]", e);
    }
    if (D) {
      try {
        await _fallbackRecalcJS(D, simulacao_id);
      } catch (e) {
        console.warn("[recalc fallback]", e);
      }
    }
  };

  // Retro-compat: V() do MARCFIX continua chamando essa
  window.__pktQueueRecalcAuxGrupo = function (D, simulacao_id, _categoria) {
    if (!simulacao_id) return;
    _queue("sim|" + simulacao_id, function () {
      window.__pktRecalcAuxSimulacao(D, simulacao_id);
    });
  };

  window.__pktQueueRecalcAuxSimulacao = window.__pktQueueRecalcAuxGrupo;
  window.__pktRecalcAuxAmbiente = function (D, simulacao_id, _ambiente_id) {
    // Granularidade fina — por simplicidade roda recalc da sim inteira
    return window.__pktRecalcAuxSimulacao(D, simulacao_id);
  };
  window.__pktRecalcAuxGrupo = window.__pktRecalcAuxSimulacao;

  // ── Fallback JS (se RPC falhar) ──
  function isAuxiliar(desc) {
    return /^(INSUMOS|INSTALA[ÇC][AÃ]O|RECORTES|RODAP[ÉE])/i.test(String(desc || "").trim());
  }
  function parseMetragem(desc) {
    var m = String(desc || "").match(/Metragem\s+real(?:\s+total)?\s+([\d.,]+)\s*m²/i);
    return m ? parseFloat(m[1].replace(",", ".")) : 0;
  }
  function nomeAmbiente(desc) {
    return String(desc || "").split("\n")[0].trim() || "AMBIENTE";
  }
  function percentuais(categoria) {
    var isPiso = /PISO/i.test(String(categoria || ""));
    return isPiso ? { amb: 0.7, ins: 0.1, ges: 0.2 } : { amb: 0.6, ins: 0.15, ges: 0.25 };
  }

  async function _fallbackRecalcJS(D, simulacao_id) {
    var resp = await D.from("simulacao_itens")
      .select("id,descritivo,valor,categoria,ordem,meta")
      .eq("simulacao_id", simulacao_id);
    var items = resp.data || [];
    if (!items.length) return;

    var ambientes = items.filter(function (i) { return !isAuxiliar(i.descritivo); });
    var auxiliares = items.filter(function (i) { return isAuxiliar(i.descritivo); });
    var auxByParent = {};
    auxiliares.forEach(function (a) {
      var meta = a.meta || {};
      if (meta.parent_item_id && meta.aux_kind) {
        auxByParent[meta.parent_item_id + "|" + meta.aux_kind] = a;
      }
    });
    var validParentIds = {};
    ambientes.forEach(function (a) { validParentIds[a.id] = true; });
    var orphanIds = auxiliares
      .filter(function (a) {
        var meta = a.meta || {};
        return !meta.parent_item_id || !validParentIds[meta.parent_item_id];
      })
      .map(function (a) { return a.id; });

    ambientes.sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });

    var blockIdx = 1;
    for (var k = 0; k < ambientes.length; k++) {
      var amb = ambientes[k];
      if (/^PORTA/i.test(String(amb.categoria || ""))) {
        var ordBaseP = blockIdx * 10;
        if ((amb.ordem || 0) !== ordBaseP) {
          await D.from("simulacao_itens").update({ ordem: ordBaseP }).eq("id", amb.id);
        }
        blockIdx++;
        continue;
      }
      if (/^M[ÃA]O\s+DE\s+OBRA/i.test(String(amb.categoria || ""))) {
        var ordBaseM = blockIdx * 10;
        await D.from("simulacao_itens").update({ ordem: ordBaseM, meta: Object.assign({}, amb.meta || {}, { skip_auxiliares: true }) }).eq("id", amb.id);
        blockIdx++;
        continue;
      }
      var p = percentuais(amb.categoria);
      var valorAmb = Number(amb.valor) || 0;
      if (valorAmb <= 0 || p.amb <= 0) { blockIdx++; continue; }
      var totalAmb = valorAmb / p.amb;
      var valorIns = +(totalAmb * p.ins).toFixed(2);
      var valorGes = +(totalAmb * p.ges).toFixed(2);
      var ambNome = nomeAmbiente(amb.descritivo);
      var ambMet = parseMetragem(amb.descritivo);
      var catLabel = String(amb.categoria || "").replace(/\|\|/g, " ");
      var sufMet = ambMet > 0
        ? "\n" + "Metragem real " + ambMet.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + "m² · " + catLabel
        : "\n" + catLabel;
      var descIns = "INSUMOS — " + ambNome;
      var descGes = "INSTALAÇÃO E GESTÃO DE OBRAS — " + ambNome + sufMet;
      var ordBase = blockIdx * 10;

      if ((amb.ordem || 0) !== ordBase) {
        await D.from("simulacao_itens").update({ ordem: ordBase }).eq("id", amb.id);
      }

      var exIns = auxByParent[amb.id + "|insumos"];
      if (exIns) {
        await D.from("simulacao_itens").update({
          valor: valorIns, descritivo: descIns, ordem: ordBase + 1, categoria: amb.categoria,
          meta: Object.assign({}, exIns.meta || {}, { parent_item_id: amb.id, aux_kind: "insumos" }),
        }).eq("id", exIns.id);
      } else {
        await D.from("simulacao_itens").insert({
          simulacao_id: simulacao_id, categoria: amb.categoria,
          descritivo: descIns, valor: valorIns, ordem: ordBase + 1,
          meta: { parent_item_id: amb.id, aux_kind: "insumos" },
        });
      }

      var exGes = auxByParent[amb.id + "|instalacao"];
      if (exGes) {
        await D.from("simulacao_itens").update({
          valor: valorGes, descritivo: descGes, ordem: ordBase + 2, categoria: amb.categoria,
          meta: Object.assign({}, exGes.meta || {}, { parent_item_id: amb.id, aux_kind: "instalacao" }),
        }).eq("id", exGes.id);
      } else {
        await D.from("simulacao_itens").insert({
          simulacao_id: simulacao_id, categoria: amb.categoria,
          descritivo: descGes, valor: valorGes, ordem: ordBase + 2,
          meta: { parent_item_id: amb.id, aux_kind: "instalacao" },
        });
      }

      blockIdx++;
    }

    if (orphanIds.length) {
      await D.from("simulacao_itens").delete().in("id", orphanIds);
    }
  }

  // ── Botão "↻ Reorganizar blocos" — DESATIVADO a pedido do Will (2026-06-09).
  // Lógica de recalc auto continua ativa. Só não injeta o botão flutuante.
  function injectReorgBtn() { return; }
  function _injectReorgBtnDisabled_legacy() {
    document.querySelectorAll("[data-pkt-sim-id]").forEach(function (el) {
      if (el.querySelector(":scope > .pkt-reorg-btn")) return;
      var simId = el.getAttribute("data-pkt-sim-id");
      var btn = document.createElement("button");
      btn.className = "pkt-reorg-btn";
      btn.title = "Reorganizar em blocos: ambiente → INSUMOS → INSTALAÇÃO";
      btn.style.cssText = "position:absolute;bottom:8px;right:8px;background:rgba(184,170,154,0.12);color:#B8AA9A;border:1px solid rgba(184,170,154,0.3);border-radius:50px;padding:5px 10px;font-weight:600;font-size:10px;cursor:pointer;z-index:5;font-family:-apple-system,Segoe UI,system-ui,sans-serif;";
      btn.textContent = "↻ Reorganizar blocos";
      btn.onclick = async function (e) {
        e.stopPropagation();
        btn.disabled = true;
        btn.textContent = "Reorganizando…";
        try {
          await rpcRecalc(simId);
          btn.textContent = "✓ Reorganizado";
          setTimeout(function () { location.reload(); }, 500);
        } catch (err) {
          console.warn("[reorg]", err);
          alert("Falha: " + (err.message || err));
          btn.disabled = false;
          btn.textContent = "↻ Reorganizar blocos";
        }
      };
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.appendChild(btn);
    });
  }
  setInterval(injectReorgBtn, 1000);
  injectReorgBtn();
})();
