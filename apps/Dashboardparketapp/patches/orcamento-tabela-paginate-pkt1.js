/**
 * Paginação overlay pra /orcamento/tabela (catálogo de produtos).
 * v3 — CSS-first, sem DOM scan custoso.
 */
(function () {
  if (window.__pktTabelaPaginateLoaded) return;
  window.__pktTabelaPaginateLoaded = true;
  var DBG = function () {};

  var PAGE_SIZE = 50;
  var BAR_ID = "pkt-tabela-paginate-bar";
  var STYLE_ID = "pkt-tabela-paginate-style";
  var state = { page: 1, total: 0, tbody: null };

  try {
    var saved = parseInt(localStorage.getItem("pktTabelaPaginatePageSize") || "0", 10);
    if (saved > 0) PAGE_SIZE = saved;
  } catch (_) {}

  function isTabelaPage() {
    // URL only — não toca em document.body.innerText (caro)
    var p = location.pathname || "";
    var s = location.search || "";
    return /\/orcamento\/tabela/.test(p) || /tab=tabela/.test(s);
  }

  function injectStyleRule() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = "";
    document.head && document.head.appendChild(st);
  }

  function updateStyleRule(start, end) {
    var st = document.getElementById(STYLE_ID);
    if (!st) return;
    // Esconde linhas fora da página atual.
    // nth-child é 1-based; start é 0-based.
    // visíveis: rows[start..end-1] → :nth-child(start+1) até :nth-child(end)
    st.textContent =
      "tbody[data-pkt-tabela-tbody] > tr { display: none !important; }\n" +
      "tbody[data-pkt-tabela-tbody] > tr:nth-child(n+" + (start + 1) + "):nth-child(-n+" + end + ") { display: table-row !important; }";
  }

  function clearStyleRule() {
    var st = document.getElementById(STYLE_ID);
    if (st) st.textContent = "";
  }

  function findTbody() {
    // Procura tbody com >= 30 linhas. Sem div fallback.
    var tbodies = document.querySelectorAll("tbody");
    var best = null;
    for (var i = 0; i < tbodies.length; i++) {
      var trs = tbodies[i].children;
      if (trs.length >= 30 && trs[0] && trs[0].tagName === "TR") {
        if (!best || trs.length > best.children.length) best = tbodies[i];
      }
    }
    if (!best && tbodies.length) {
      DBG("findTbody: no tbody with 30+ TRs.", "total tbodies:", tbodies.length,
          "max children:", Math.max.apply(null, [0].concat([].slice.call(tbodies).map(function(t){return t.children.length;}))));
    }
    return best;
  }

  function btnStyle() {
    return "background:rgba(184,170,154,0.12);border:1px solid rgba(184,170,154,0.35);color:#B8AA9A;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer";
  }

  function buildBar() {
    var bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.style.cssText = "background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 14px;margin:10px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:-apple-system,Segoe UI,sans-serif;color:#eee;font-size:13px";

    var info = document.createElement("div");
    info.id = BAR_ID + "-info";

    var nav = document.createElement("div");
    nav.style.cssText = "display:flex;gap:8px;align-items:center";

    var btnPrev = document.createElement("button");
    btnPrev.id = BAR_ID + "-prev";
    btnPrev.textContent = "← Anterior";
    btnPrev.style.cssText = btnStyle();
    btnPrev.onclick = function () { goPage(state.page - 1); };

    var pageInput = document.createElement("input");
    pageInput.id = BAR_ID + "-page";
    pageInput.type = "number";
    pageInput.min = "1";
    pageInput.style.cssText = "width:60px;background:#0d1117;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:5px 8px;color:#fff;text-align:center;font-size:12px";
    pageInput.onchange = function () {
      var n = parseInt(pageInput.value, 10);
      if (!isNaN(n)) goPage(n);
    };

    var ofLabel = document.createElement("span");
    ofLabel.id = BAR_ID + "-of";
    ofLabel.style.cssText = "color:rgba(255,255,255,0.55);font-size:12px";

    var btnNext = document.createElement("button");
    btnNext.id = BAR_ID + "-next";
    btnNext.textContent = "Próxima →";
    btnNext.style.cssText = btnStyle();
    btnNext.onclick = function () { goPage(state.page + 1); };

    var sel = document.createElement("select");
    sel.id = BAR_ID + "-size";
    sel.style.cssText = "background:#0d1117;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:5px 8px;color:#fff;font-size:12px;margin-left:8px";
    ["20", "50", "100", "200"].forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = n; opt.textContent = n + " / página";
      if (parseInt(n, 10) === PAGE_SIZE) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = function () {
      PAGE_SIZE = parseInt(sel.value, 10) || 50;
      try { localStorage.setItem("pktTabelaPaginatePageSize", String(PAGE_SIZE)); } catch (_) {}
      state.page = 1;
      apply();
    };

    nav.appendChild(btnPrev);
    nav.appendChild(pageInput);
    nav.appendChild(ofLabel);
    nav.appendChild(btnNext);
    nav.appendChild(sel);

    bar.appendChild(info);
    bar.appendChild(nav);
    return bar;
  }

  function goPage(n) {
    var totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
    state.page = Math.max(1, Math.min(totalPages, n));
    apply();
  }

  function apply() {
    if (!state.tbody) return;
    var totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, state.total);
    updateStyleRule(start, end);

    var info = document.getElementById(BAR_ID + "-info");
    if (info) info.textContent = "Mostrando " + (start + 1) + "–" + end + " de " + state.total + " itens";
    var pi = document.getElementById(BAR_ID + "-page");
    if (pi) { pi.value = String(state.page); pi.max = String(totalPages); }
    var of = document.getElementById(BAR_ID + "-of");
    if (of) of.textContent = "de " + totalPages;
    var bp = document.getElementById(BAR_ID + "-prev");
    var bn = document.getElementById(BAR_ID + "-next");
    if (bp) bp.style.opacity = state.page <= 1 ? "0.4" : "1";
    if (bn) bn.style.opacity = state.page >= totalPages ? "0.4" : "1";
  }

  function teardown() {
    var bar = document.getElementById(BAR_ID); if (bar) bar.remove();
    clearStyleRule();
    if (state.tbody) state.tbody.removeAttribute("data-pkt-tabela-tbody");
    state = { page: state.page, total: 0, tbody: null };
  }

  function ensure() {
    if (!isTabelaPage()) {
      if (state.tbody || document.getElementById(BAR_ID)) teardown();
      return;
    }
    injectStyleRule();
    var tbody = findTbody();
    if (!tbody) { DBG("ensure: tbody not found"); return; }
    DBG("ensure: tbody found, children=", tbody.children.length);

    var changedTbody = state.tbody !== tbody;
    var total = tbody.children.length;
    var changedCount = state.total !== total;

    if (changedTbody) {
      if (state.tbody) state.tbody.removeAttribute("data-pkt-tabela-tbody");
      tbody.setAttribute("data-pkt-tabela-tbody", "1");
      state.tbody = tbody;
    }
    if (changedTbody || changedCount) {
      state.total = total;
    }

    if (!document.getElementById(BAR_ID)) {
      var bar = buildBar();
      var table = tbody.closest("table") || tbody;
      var parent = table.parentElement;
      if (parent) parent.insertBefore(bar, table);
    }

    if (changedTbody || changedCount) apply();
  }

  // Debounce
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      try { ensure(); } catch (_) {}
    }, 300);
  }

  // Initial tries
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }
  setTimeout(schedule, 1500);
  setTimeout(schedule, 3000);

  // MutationObserver — só childList, sem attributes/subtree-attribute
  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch (_) {}

  // SPA routes
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      var ret = orig.apply(this, arguments);
      schedule();
      return ret;
    };
  });
  window.addEventListener("popstate", schedule);
})();
