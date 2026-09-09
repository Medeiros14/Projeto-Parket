// PARKET · Proposta Opção B — estrutura ref. Navona, dados via api.parket.works
(function () {
  'use strict';

  var API = 'https://api.parket.works/rest/v1';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0';
  var HDRS = { apikey: ANON, Authorization: 'Bearer ' + ANON };

  var m = location.pathname.match(/\/b\/([0-9a-f-]{36})/i);
  var simId = (m && m[1]) || new URLSearchParams(location.search).get('id') || '';

  var FINE_RE = /^(PAINEL|PORTA|MARCEN|ESCADA|SAUNA|REVEST|ADEGA)/i;

  var state = {
    propostaNum: '—', cliente: '—', endereco: '—', consultor: '—',
    dataEmissao: '—', validade: '—', pagamento: 'A combinar',
    prazoEntrega: 'A combinar', garantia: 'Garantia Parket',
    aplicacoes: [], marcenaria: [],
    subAplicacoes: 0, subMarcenaria: 0, frete: 0, desconto: 0, total: 0,
    catsAplicacoes: '', catsMarcenaria: ''
  };

  // ─── Páginas
  var pages = document.querySelectorAll('.page');
  function go(id) {
    pages.forEach(function (p) { p.classList.toggle('is-active', p.dataset.page === id); });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  document.querySelectorAll('[data-go]').forEach(function (btn) {
    btn.addEventListener('click', function () { go(btn.dataset.go); });
  });

  // ─── Intro vídeo → auto-avança
  var introVideo = document.getElementById('introVideo');
  var skipBtn = document.getElementById('skipIntro');
  var advanced = false;
  function advanceFromIntro() {
    if (advanced) return;
    advanced = true;
    go('cover');
  }
  if (introVideo) {
    var started = false;
    introVideo.addEventListener('ended', advanceFromIntro);
    introVideo.addEventListener('playing', function () {
      if (started) return;
      started = true;
      setTimeout(advanceFromIntro, 6000);
    });
    setTimeout(function () { if (!started) advanceFromIntro(); }, 6500);
    var pr = introVideo.play();
    if (pr && pr.catch) pr.catch(function () { /* autoplay bloqueado — timeout avança */ });
  }
  if (skipBtn) skipBtn.addEventListener('click', advanceFromIntro);

  // ─── Carrega sim + itens
  function fetchJson(url) {
    return fetch(url, { headers: HDRS }).then(function (r) { return r.json(); });
  }

  function catLabel(c) {
    var s = String(c || '').toUpperCase();
    if (/^MARCEN/.test(s)) return 'Marcenaria';
    if (/^REVEST/.test(s)) return 'Revestimento';
    return s.charAt(0) + s.slice(1).toLowerCase();
  }

  function buildItems(rows) {
    var mains = [];
    var last = null;
    rows.forEach(function (r) {
      var meta = r.meta || {};
      if (meta.aux_kind) {
        if (last) last.preco += Number(r.valor) || 0;
        return;
      }
      var parts = String(r.categoria || '').split('||');
      var cat = (parts[0] || '').trim();
      var material = (parts[1] || '').trim();
      var dim = (parts[2] || '').trim();
      var linhas = String(r.descritivo || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var ambiente = linhas.shift() || cat;
      var descParts = [material];
      if (dim) descParts.push(dim);
      linhas.forEach(function (l) { descParts.push(l); });
      var qm = String(r.descritivo || '').match(/Metragem real\s*(?:total\s*)?([\d.,]+)\s*m/i);
      last = {
        cat: cat,
        ambiente: ambiente,
        desc: descParts.join(' · '),
        qtd: qm ? qm[1] + ' m²' : '',
        preco: Number(r.valor) || 0
      };
      mains.push(last);
    });
    return mains;
  }

  function renderGroup(elId, items) {
    var el = document.getElementById(elId);
    if (!el) return;
    var byCat = {};
    var catOrder = [];
    items.forEach(function (it) {
      if (!byCat[it.cat]) { byCat[it.cat] = []; catOrder.push(it.cat); }
      byCat[it.cat].push(it);
    });
    var html = '';
    var n = 0;
    catOrder.forEach(function (cat) {
      html += '<div class="prop-secao">' + escapeHTML(catLabel(cat)) + '</div>';
      byCat[cat].forEach(function (it) {
        n += 1;
        html += '<div class="prop-item">' +
          '<span class="prop-item-n">' + String(n).padStart(2, '0') + '</span>' +
          '<div>' +
            '<p class="prop-item-name">' + escapeHTML(it.ambiente) + '</p>' +
            '<p class="prop-item-desc">' + escapeHTML(it.desc) + '</p>' +
          '</div>' +
          '<span class="prop-item-qty">' + escapeHTML(it.qtd) + '</span>' +
          '<span class="prop-item-price">R$ ' + brl(it.preco) + '</span>' +
        '</div>';
      });
    });
    el.innerHTML = html;
  }

  function bind() {
    var out = {
      propostaNum: state.propostaNum, propostaNum2: state.propostaNum,
      propostaNum3: state.propostaNum, propostaNum4: state.propostaNum, propostaNum5: state.propostaNum,
      cliente: state.cliente, endereco: state.endereco,
      dataEmissao: state.dataEmissao, validade: state.validade, validade2: state.validade,
      consultor: state.consultor,
      pagamento: state.pagamento, prazoEntrega: state.prazoEntrega, garantia: state.garantia,
      subAplicacoes: brl(state.subAplicacoes), subAplicacoes2: brl(state.subAplicacoes),
      subMarcenaria: brl(state.subMarcenaria), subMarcenaria2: brl(state.subMarcenaria),
      freteFmt: brl(state.frete), descontoFmt: brl(state.desconto), totalFmt: brl(state.total),
      catsAplicacoes: state.catsAplicacoes, catsMarcenaria: state.catsMarcenaria
    };
    document.querySelectorAll('[data-out]').forEach(function (el) {
      var k = el.dataset.out;
      if (out[k] !== undefined) el.textContent = out[k];
    });
    var rf = document.getElementById('rowFrete');
    if (rf) rf.hidden = !(state.frete > 0);
    var rd = document.getElementById('rowDesconto');
    if (rd) rd.hidden = !(state.desconto > 0);
    renderGroup('itensAplicacoes', state.aplicacoes);
    renderGroup('itensMarcenaria', state.marcenaria);
  }

  function loadProposta() {
    if (!simId) { state.cliente = 'Proposta não encontrada'; bind(); return; }
    Promise.all([
      fetchJson(API + '/simulacao_projetos?id=eq.' + encodeURIComponent(simId) + '&select=*'),
      fetchJson(API + '/simulacao_itens?simulacao_id=eq.' + encodeURIComponent(simId) + '&select=categoria,descritivo,valor,ordem,meta&order=ordem.asc')
    ]).then(function (res) {
      var sim = Array.isArray(res[0]) ? res[0][0] : null;
      var rows = Array.isArray(res[1]) ? res[1] : [];
      if (!sim) { state.cliente = 'Proposta não encontrada'; bind(); return; }

      state.propostaNum = sim.numero || '—';
      state.cliente = sim.cliente || '—';
      state.endereco = sim.endereco || sim.obra_code || '—';
      state.consultor = sim.vendedor || 'Equipe Parket';
      var created = sim.created_at ? new Date(sim.created_at) : new Date();
      state.dataEmissao = formatDate(created);
      var vd = Number(sim.validade_dias) || 30;
      state.validade = vd + ' dias · até ' + formatDate(addDays(created, vd));
      if (sim.forma_pagamento) state.pagamento = sim.forma_pagamento;
      if (sim.pag_prazo_entrega) state.prazoEntrega = sim.pag_prazo_entrega;
      if (sim.pag_garantia) state.garantia = sim.pag_garantia;

      var mains = buildItems(rows);
      state.aplicacoes = mains.filter(function (it) { return !FINE_RE.test(it.cat); });
      state.marcenaria = mains.filter(function (it) { return FINE_RE.test(it.cat); });
      state.subAplicacoes = state.aplicacoes.reduce(function (s, it) { return s + it.preco; }, 0);
      state.subMarcenaria = state.marcenaria.reduce(function (s, it) { return s + it.preco; }, 0);
      state.catsAplicacoes = uniqCats(state.aplicacoes);
      state.catsMarcenaria = uniqCats(state.marcenaria);

      state.frete = Number(sim.frete_valor) || 0;
      var subtotal = state.subAplicacoes + state.subMarcenaria + state.frete;
      state.desconto = sim.desconto_modo === 'perc'
        ? subtotal * ((Number(sim.desconto_perc) || 0) / 100)
        : (Number(sim.desconto_valor) || 0);
      state.total = subtotal - state.desconto;
      bind();
    }).catch(function () {
      state.cliente = 'Erro ao carregar a proposta';
      bind();
    });
  }
  loadProposta();

  function uniqCats(items) {
    var seen = [];
    items.forEach(function (it) {
      var l = catLabel(it.cat);
      if (seen.indexOf(l) < 0) seen.push(l);
    });
    return seen.join(' · ');
  }

  // ─── Form de fechamento (por enquanto visual — não grava)
  var form = document.getElementById('closeForm');
  var submitBtn = document.getElementById('submitClose');
  var msg = document.getElementById('closeMsg');
  var aceite = document.getElementById('f-aceite');

  function validate() {
    var data = new FormData(form);
    var ok = data.get('documento') && data.get('razaoSocial') &&
      /\S+@\S+\.\S+/.test(data.get('email') || '') &&
      String(data.get('telefone') || '').replace(/\D/g, '').length >= 10 &&
      data.get('endereco') &&
      aceite.checked;
    submitBtn.disabled = !ok;
  }
  if (form) {
    form.addEventListener('input', validate);
    form.addEventListener('change', validate);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitBtn.disabled = true;
      msg.textContent = 'Enviando…';
      var payload = {};
      new FormData(form).forEach(function (v, k) { payload[k] = v; });
      payload.proposta = state.propostaNum;
      payload.sim_id = simId;
      console.log('[fechamento parket opção B]', payload);
      setTimeout(function () { msg.textContent = ''; go('success'); }, 900);
    });
  }

  // ─── Helpers
  function brl(n) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatDate(d) {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  function addDays(d, days) {
    var n = new Date(d);
    n.setDate(n.getDate() + days);
    return n;
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
