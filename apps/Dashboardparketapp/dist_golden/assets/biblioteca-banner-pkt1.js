/**
 * Banner "Biblioteca completa" — injetado no topo da aba "Tabela de Preços"
 * do Space (/orcamento). Aponta pro ERP Biblioteca, que tem o catálogo
 * completo organizado em 8 seções (Produtos, Espécies, Acabamentos, Réguas,
 * Ferragens, MDF/Compensado, Insumos, Mão de Obra).
 *
 * Os dados são os mesmos (Supabase compartilhado) — edição no ERP reflete
 * em tempo real no Space e vice-versa.
 */
(function () {
  if (window.__pktBibliotecaBannerLoaded) return;
  window.__pktBibliotecaBannerLoaded = true;

  var BANNER_ID = "pkt-biblioteca-banner";
  var ERP_URL = "https://erp.parket.works/biblioteca";

  function findTabelaContainer() {
    // A aba "Tabela de Preços" do dept-orcamento renderiza um container
    // próprio. Procuramos pelo título característico.
    var headings = document.querySelectorAll("h1, h2, h3");
    for (var i = 0; i < headings.length; i++) {
      var t = (headings[i].textContent || "").trim();
      if (/Gest[aã]o da Tabela|Tabela de Pre/i.test(t)) {
        // Sobe até a div mais próxima que pareça um wrapper de aba
        var el = headings[i];
        for (var j = 0; j < 6 && el && el.parentElement; j++) {
          el = el.parentElement;
          if (el.tagName === "DIV" && el.children.length > 1) return el;
        }
        return headings[i].parentElement;
      }
    }
    return null;
  }

  function buildBanner() {
    var div = document.createElement("div");
    div.id = BANNER_ID;
    div.style.cssText = [
      "background: linear-gradient(135deg,rgba(184,170,154,0.10),rgba(184,170,154,0.04))",
      "border: 1px solid rgba(184,170,154,0.30)",
      "border-radius: 10px",
      "padding: 14px 16px",
      "margin-bottom: 14px",
      "display: flex",
      "align-items: center",
      "justify-content: space-between",
      "gap: 16px",
      "flex-wrap: wrap",
      "font-family: -apple-system,Segoe UI,system-ui,sans-serif",
    ].join(";");
    div.innerHTML =
      '<div style="flex:1;min-width:240px">' +
        '<div style="font-size:12px;font-weight:700;color:#B8AA9A;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:4px">📚 Biblioteca Completa</div>' +
        '<div style="font-size:13px;color:#fff;line-height:1.45">' +
          'O catálogo unificado da Parket está no ERP — com seções organizadas para ' +
          '<b>Produtos</b>, <b>Espécies</b>, <b>Acabamentos</b>, <b>Réguas</b>, ' +
          '<b>Ferragens</b>, <b>MDF/Compensado</b>, <b>Insumos</b> e <b>Mão de Obra</b>.' +
        '</div>' +
        '<div style="font-size:11px;color:#999;margin-top:6px">' +
          'Os dados são os mesmos — alterações refletem aqui em tempo real.' +
        '</div>' +
      '</div>' +
      '<a href="' + ERP_URL + '" target="_blank" rel="noopener" ' +
         'style="background:#B8AA9A;color:#000;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.05em;white-space:nowrap;display:inline-flex;align-items:center;gap:6px">' +
        'Abrir Biblioteca no ERP ' +
        '<span style="font-size:14px">→</span>' +
      '</a>';
    return div;
  }

  function ensureBanner() {
    if (document.getElementById(BANNER_ID)) return;
    var container = findTabelaContainer();
    if (!container) return;
    var banner = buildBanner();
    container.insertBefore(banner, container.firstChild);
  }

  // Observer global — quando o user troca de aba, o React re-renderiza.
  var obs = new MutationObserver(function () { try { ensureBanner(); } catch (e) {} });
  obs.observe(document.body, { childList: true, subtree: true });

  // Tenta imediatamente caso a aba já esteja aberta
  setTimeout(ensureBanner, 500);
  setTimeout(ensureBanner, 1500);
})();
