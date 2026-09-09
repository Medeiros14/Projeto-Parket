(function(){
  try {
    if (new URLSearchParams(location.search).get('print') !== '1') return;
  } catch(_) { return; }
  var done = false;
  var tries = 0;
  function findPropostaIframe() {
    // O renderer do V12FIX injeta a proposta num <iframe srcdoc>. Pode ter
    // outros iframes na página (vídeo), então prefere o que tem srcdoc.
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      var f = iframes[i];
      if (f.srcdoc || (f.getAttribute && f.getAttribute('srcdoc'))) return f;
    }
    return iframes[0] || null;
  }
  function iframeReady(f) {
    try {
      var doc = f.contentDocument;
      if (!doc || doc.readyState !== 'complete') return false;
      var imgs = Array.from(doc.images || []);
      return imgs.length === 0 || imgs.every(function(i){ return i.complete && i.naturalWidth > 0; });
    } catch(_) { return false; }
  }
  function tryPrint() {
    tries++;
    if (done) return;
    var f = findPropostaIframe();
    if (f && iframeReady(f)) {
      done = true;
      // Delay pequeno pra fontes carregarem depois de imgs OK
      setTimeout(function(){
        try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){
          try { window.print(); } catch(_){}
        }
      }, 400);
      return;
    }
    if (tries > 80) return; // ~20s: desiste sem imprimir a página inteira
    setTimeout(tryPrint, 250);
  }
  function boot() { setTimeout(tryPrint, 800); }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
