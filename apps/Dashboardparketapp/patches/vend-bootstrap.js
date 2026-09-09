// Bootstrap dinâmico do dropdown de vendedores do card.
// Popula window.__VENDEDORES__ a partir da view public.vendedores_comercial,
// com cache localStorage pra renderizar instant.
(function () {
  var KEY = "__vend_cache_v1";
  var URL = "https://hbxpilrxmitvzebluoom.supabase.co/rest/v1/vendedores_comercial?select=nome&order=nome";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
  try {
    var c = localStorage.getItem(KEY);
    if (c) window.__VENDEDORES__ = JSON.parse(c);
  } catch (e) {}
  fetch(URL, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.length) return;
      var arr = d.map(function (x) { return x.nome; }).filter(Boolean);
      if (!arr.length) return;
      window.__VENDEDORES__ = arr;
      try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
      window.dispatchEvent(new CustomEvent("vendedores-updated"));
    })
    .catch(function () {});
})();
