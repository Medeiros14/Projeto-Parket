/* Toggle do tema Navona — sem dependências, lê localStorage e/ou ?theme=navona */
(function() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__pkt_navonaToggleLoaded) return;
  window.__pkt_navonaToggleLoaded = true;

  function getStoredTheme() {
    try { return localStorage.getItem('space-theme'); } catch (e) { return null; }
  }
  function setStoredTheme(v) {
    try { localStorage.setItem('space-theme', v); } catch (e) {}
  }
  function getUrlTheme() {
    try {
      var p = new URLSearchParams(window.location.search);
      return p.get('theme');
    } catch (e) { return null; }
  }

  function applyTheme(name) {
    if (name === 'navona') {
      document.body.classList.add('theme-navona');
    } else {
      document.body.classList.remove('theme-navona');
    }
    // atualiza label do toggle
    var btn = document.getElementById('navona-theme-toggle');
    if (btn) {
      btn.textContent = name === 'navona' ? '✦ Tema Navona ON' : '✦ Ativar Navona';
    }
  }

  function toggleTheme() {
    var current = document.body.classList.contains('theme-navona') ? 'navona' : 'default';
    var next = current === 'navona' ? 'default' : 'navona';
    setStoredTheme(next);
    applyTheme(next);
  }

  function createToggle() {
    if (document.getElementById('navona-theme-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'navona-theme-toggle';
    btn.type = 'button';
    btn.addEventListener('click', toggleTheme);
    document.body.appendChild(btn);
  }

  /** Hosts onde o tema Navona NÃO deve ser aplicado (mesmo container serve
   *  todos esses hosts: space/dash/base/proposta — só queremos Navona no
   *  Space interno; proposta vai direto pro cliente e deve manter look
   *  neutro). */
  function isExcludedHost() {
    try {
      var h = (window.location && window.location.hostname) || '';
      if (h === 'proposta.parket.works') return true;
      return false;
    } catch (e) { return false; }
  }

  function init() {
    // Default = navona (Caminho D.1 — 2026-06-15). Opt-out: ?theme=default
    // prioridade: URL > localStorage > navona
    // Guard 2026-06-15: pular hosts de cliente (proposta.parket.works).
    if (isExcludedHost()) {
      applyTheme('default');
      return; // sem botão flutuante, sem persist
    }
    var urlTheme = getUrlTheme();
    var stored = getStoredTheme();
    var active = urlTheme || stored || 'navona';
    if (urlTheme) setStoredTheme(urlTheme); // se veio via URL, persiste
    applyTheme(active);
    createToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
