/**
 * Modal pra digitar insumos de MARCENARIA (Ferragens / MDF / Compensado).
 * Cada um tem qty × preço unit. Retorna { total, descricao } via Promise.
 * Exposto como window.__pktAskMarcInsumos pra ser chamado pelo simulador
 * após salvar um item MARCENARIA.
 */
(function(){
  if (window.__pktAskMarcInsumos) return; // já injetado

  function fmtBRL(v){ return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

  window.__pktAskMarcInsumos = function(){
    return new Promise(function(resolve){
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;z-index:999999;font-family:-apple-system,Segoe UI,system-ui,sans-serif";
      ov.innerHTML =
        '<div style="background:#141414;border:1px solid #B8AA9A;border-radius:10px;padding:22px;width:min(520px,100%);max-height:90vh;overflow-y:auto;color:#fff">'+
          '<div style="font-size:11px;color:#B8AA9A;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px">Insumos de Marcenaria</div>'+
          '<div style="font-size:14px;font-weight:600;margin-bottom:4px">Ferragens · MDF · Compensado</div>'+
          '<div style="font-size:11px;color:#888;margin-bottom:18px">Informe a quantidade e o preço unitário de cada insumo. Total será somado e enviado como linha "INSUMOS DE MARCENARIA" na proposta.</div>'+
          buildRow("ferragens","Ferragens","un")+
          buildRow("mdf","MDF","chapa")+
          buildRow("comp","Compensado","chapa")+
          '<div id="mi-tot" style="margin-top:10px;padding:10px;background:#0e0e0e;border:1px solid #2a2a2a;border-radius:6px;display:flex;justify-content:space-between;align-items:center">'+
            '<span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em">Total dos insumos</span>'+
            '<span id="mi-tot-v" style="font-size:18px;font-weight:700;color:#B8AA9A">R$ 0,00</span>'+
          '</div>'+
          '<div style="margin-top:18px;display:flex;gap:8px;justify-content:flex-end">'+
            '<button id="mi-cancel" style="background:transparent;color:#ccc;border:1px solid #333;border-radius:5px;padding:9px 16px;cursor:pointer;font-weight:600;font-size:12px">Pular</button>'+
            '<button id="mi-ok" style="background:#B8AA9A;color:#000;border:none;border-radius:5px;padding:9px 22px;cursor:pointer;font-weight:700;font-size:12px;letter-spacing:0.05em">Salvar Insumos</button>'+
          '</div>'+
        '</div>';
      document.body.appendChild(ov);

      function buildRow(id, label, unit){
        return '<div style="display:grid;grid-template-columns:1fr 80px 110px 110px;gap:8px;align-items:end;margin-bottom:10px">'+
          '<div>'+
            '<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">'+label+'</div>'+
            '<div style="font-size:11px;color:#666">'+unit+'</div>'+
          '</div>'+
          '<div>'+
            '<div style="font-size:9px;color:#888;text-transform:uppercase;margin-bottom:2px">Qtd</div>'+
            '<input class="mi-in" data-k="'+id+'-qty" type="number" min="0" step="1" value="0" style="width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:7px;border-radius:4px;font-size:13px;text-align:center"/>'+
          '</div>'+
          '<div>'+
            '<div style="font-size:9px;color:#888;text-transform:uppercase;margin-bottom:2px">Preço un (R$)</div>'+
            '<input class="mi-in" data-k="'+id+'-pu" type="number" min="0" step="0.01" value="0" style="width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:7px;border-radius:4px;font-size:13px;text-align:right"/>'+
          '</div>'+
          '<div>'+
            '<div style="font-size:9px;color:#888;text-transform:uppercase;margin-bottom:2px">Subtotal</div>'+
            '<div id="mi-sub-'+id+'" style="padding:7px;text-align:right;color:#B8AA9A;font-weight:700;font-size:13px">R$ 0,00</div>'+
          '</div>'+
        '</div>';
      }

      var state = { ferragens:{qty:0,pu:0}, mdf:{qty:0,pu:0}, comp:{qty:0,pu:0} };
      function recalc(){
        var tot = 0;
        ["ferragens","mdf","comp"].forEach(function(k){
          var sub = (state[k].qty||0) * (state[k].pu||0);
          var el = ov.querySelector("#mi-sub-"+k);
          if (el) el.textContent = fmtBRL(sub);
          tot += sub;
        });
        ov.querySelector("#mi-tot-v").textContent = fmtBRL(tot);
        return tot;
      }

      ov.querySelectorAll(".mi-in").forEach(function(inp){
        inp.addEventListener("input", function(){
          var parts = inp.dataset.k.split("-");
          var k = parts[0], f = parts[1];
          state[k][f] = parseFloat(inp.value)||0;
          recalc();
        });
      });

      function close(result){ try{ov.remove();}catch(e){} resolve(result); }
      ov.querySelector("#mi-cancel").onclick = function(){ close(null); };
      ov.querySelector("#mi-ok").onclick = function(){
        var tot = recalc();
        var descParts = [];
        if (state.ferragens.qty>0 || state.ferragens.pu>0) descParts.push("Ferragens: "+state.ferragens.qty+" un × "+fmtBRL(state.ferragens.pu));
        if (state.mdf.qty>0 || state.mdf.pu>0) descParts.push("MDF: "+state.mdf.qty+" chapa × "+fmtBRL(state.mdf.pu));
        if (state.comp.qty>0 || state.comp.pu>0) descParts.push("Compensado: "+state.comp.qty+" chapa × "+fmtBRL(state.comp.pu));
        close({ total: tot, descricao: descParts.join(" · ") });
      };
      ov.addEventListener("click", function(e){ if (e.target===ov) close(null); });
    });
  };
})();
