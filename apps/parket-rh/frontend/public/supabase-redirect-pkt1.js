/**
 * Redireciona TODAS as requisições do Supabase pro nosso proxy api.parket.works.
 *
 * Por que: ISP brasileiro tem problema de roteamento pros IPs do Supabase.
 * Nosso servidor (Hetzner DE) não passa pelo ISP problemático.
 * api.parket.works → REST self-host + Auth/Realtime/Storage proxy reverso.
 *
 * Deve rodar ANTES de qualquer chamada Supabase — incluir no <head>, síncrono.
 */
(function () {
  if (window.__pktSupabaseRedirect) return;
  window.__pktSupabaseRedirect = true;

  var SUPA_HOST = 'hbxpilrxmitvzebluoom.supabase.co';
  var PROXY_HOST = 'api.parket.works';

  function rewrite(url) {
    if (typeof url !== 'string') return url;
    if (url.indexOf(SUPA_HOST) === -1) return url;
    // https://hbxpilrxmitvzebluoom.supabase.co/auth/v1/... → https://api.parket.works/auth/v1/...
    // wss://...                                            → wss://api.parket.works/...
    return url
      .replace('https://' + SUPA_HOST, 'https://' + PROXY_HOST)
      .replace('http://'  + SUPA_HOST, 'https://' + PROXY_HOST)
      .replace('wss://'   + SUPA_HOST, 'wss://'   + PROXY_HOST)
      .replace('ws://'    + SUPA_HOST, 'wss://'   + PROXY_HOST);
  }

  // ── fetch ───────────────────────────────────────────────────────────────
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      if (typeof input === 'string') {
        input = rewrite(input);
      } else if (input && input.url) {
        var u = rewrite(input.url);
        if (u !== input.url) input = new Request(u, input);
      }
    } catch (e) {}
    return origFetch(input, init);
  };

  // ── XMLHttpRequest ──────────────────────────────────────────────────────
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { arguments[1] = rewrite(url); } catch (e) {}
    return origOpen.apply(this, arguments);
  };

  // ── WebSocket (pra Realtime) ────────────────────────────────────────────
  var OrigWS = window.WebSocket;
  function PktWS(url, protocols) {
    try { url = rewrite(url); } catch (e) {}
    return protocols !== undefined ? new OrigWS(url, protocols) : new OrigWS(url);
  }
  PktWS.prototype = OrigWS.prototype;
  PktWS.CONNECTING = OrigWS.CONNECTING;
  PktWS.OPEN       = OrigWS.OPEN;
  PktWS.CLOSING    = OrigWS.CLOSING;
  PktWS.CLOSED     = OrigWS.CLOSED;
  window.WebSocket = PktWS;

  console.log('[pkt] Supabase requests redirected to ' + PROXY_HOST);
})();
