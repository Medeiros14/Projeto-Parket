// recortes-forro-modal-pkt1.js
// ────────────────────────────────────────────────────────────────────
// Modal de Recortes pro Levantamento (forro only).
// Mesma lista usada no Gerar Orçamento → Forro → Recortes.
// Expõe window.__pkt_openRecortesForro({recortes, onSave}).
// ────────────────────────────────────────────────────────────────────

const RECORTES_FORRO = [
  { id: "rec_lum", nome: "Recorte para Luminária", u: "UNI", p: 60 },
  { id: "rec_led", nome: "Recorte para LED linear", u: "MTL", p: 85 },
  { id: "rec_gre_ar", nome: "Recorte para grelha de ar condicionado", u: "UNI", p: 650 },
  { id: "rec_gre_fri", nome: "Grelha frisada", u: "UNI", p: 650 },
  { id: "rec_ref_pen", nome: "Reforço para pendente", u: "UNI", p: 320 },
  { id: "rec_sanca", nome: "Sanca iluminada", u: "MTL", p: 980 },
  { id: "rec_bando_p", nome: "Bandô 15cm a 30cm", u: "MTL", p: 890 },
  { id: "rec_bando_g", nome: "Bandô 30cm a 40cm", u: "MTL", p: 1080 },
  { id: "rec_cort", nome: "Cortineiro", u: "MTL", p: 980 },
  { id: "rec_alc_s", nome: "Alçapão simples (até 60x60cm)", u: "UNI", p: 750 },
  { id: "rec_alc_g", nome: "Alçapão grande (a partir de 80x80cm)", u: "UNI", p: 1280 },
  { id: "rec_cx_fri", nome: "Caixa de som frisada", u: "UNI", p: 175 },
  { id: "rec_cx_acu", nome: "Caixa de som com revestimento acústico", u: "UNI", p: 238 },
  { id: "rec_flap_tv", nome: "Flap TV", u: "UNI", p: 1620 },
  { id: "rec_tab_s", nome: "Tabica simples", u: "MTL", p: 50 },
  { id: "rec_tab_ar", nome: "Tabica com retorno de ar", u: "MTL", p: 80 },
];

const brl = (v) =>
  "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function openRecortesForro({ recortes, onSave } = {}) {
  // Cleanup modal anterior se existir
  const old = document.getElementById("__pkt_recortes_forro_modal");
  if (old) old.remove();

  // Estado interno — começa do que foi passado, indexado por id
  const state = {};
  for (const r of RECORTES_FORRO) state[r.id] = 0;
  for (const r of recortes || []) {
    if (r && r.id && state[r.id] != null) state[r.id] = Number(r.qtd) || 0;
  }

  const root = document.createElement("div");
  root.id = "__pkt_recortes_forro_modal";
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "300",
    background: "rgba(0,0,0,0.78)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  });
  root.addEventListener("mousedown", (ev) => { if (ev.target === root) close(); });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#0e0e0e",
    border: "1px solid rgba(139,92,246,0.4)",
    borderRadius: "14px",
    width: "100%",
    maxWidth: "640px",
    maxHeight: "88vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  });

  // Header
  const head = document.createElement("div");
  head.style.cssText =
    "padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between";
  head.innerHTML =
    '<div><div style="font-size:13px;font-weight:700;color:#c4b5fd">🧩 Recortes — Forro</div>' +
    '<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">Mesma lista usada no Gerar Orçamento. Preencha a quantidade.</div></div>';
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText =
    "background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:22px;line-height:1;padding:0 6px";
  closeBtn.onclick = close;
  head.appendChild(closeBtn);
  card.appendChild(head);

  // Body
  const body = document.createElement("div");
  body.style.cssText = "flex:1;overflow-y:auto;padding:10px 6px";

  // Refs do footer (preenchidas mais abaixo) — renderTotal pode rodar antes
  // do footer existir, então protege com guards.
  let totalEl = null;
  let selCountEl = null;
  function renderTotal() {
    let total = 0;
    for (const r of RECORTES_FORRO) total += (state[r.id] || 0) * r.p;
    if (totalEl) totalEl.textContent = brl(total);
    if (selCountEl) {
      selCountEl.textContent = String(
        RECORTES_FORRO.filter((r) => (state[r.id] || 0) > 0).length
      );
    }
  }

  for (const r of RECORTES_FORRO) {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.04)";
    const info = document.createElement("div");
    info.style.cssText = "flex:1;min-width:0";
    info.innerHTML =
      `<div style="font-size:12px;color:#fff;font-weight:500">${r.nome}</div>` +
      `<div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:2px">${brl(r.p)} / ${r.u}</div>`;
    row.appendChild(info);

    const dec = document.createElement("button");
    dec.textContent = "−";
    dec.style.cssText =
      "width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;cursor:pointer;font-size:14px;padding:0";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.inputMode = "decimal";
    inp.autocomplete = "off";
    inp.value = state[r.id] || "";
    inp.style.cssText =
      "width:64px;text-align:center;background:#1a1a1a;border:1px solid rgba(139,92,246,0.3);border-radius:6px;color:#fff;font-size:13px;padding:5px 4px;outline:none";
    // Converte vírgula → ponto pra parse
    function parseQty(s) {
      const t = String(s == null ? "" : s).trim().replace(",", ".");
      if (t === "") return 0;
      const n = Number(t);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    const inc = document.createElement("button");
    inc.textContent = "+";
    inc.style.cssText = dec.style.cssText;

    const sub = document.createElement("div");
    sub.style.cssText =
      "min-width:90px;text-align:right;font-size:11px;color:#86efac;font-weight:600;font-family:monospace";

    function update(v, fromInput) {
      const num = parseQty(v);
      state[r.id] = num;
      // Só re-escreve o input se a mudança veio de fora (botão +/−)
      // pra não interferir enquanto o usuário digita (ex: "0,").
      if (!fromInput) {
        inp.value = num || "";
      }
      sub.textContent = num > 0 ? brl(num * r.p) : "";
      renderTotal();
    }
    dec.onclick = () => update((state[r.id] || 0) - (r.u === "MTL" ? 0.5 : 1), false);
    inc.onclick = () => update((state[r.id] || 0) + (r.u === "MTL" ? 0.5 : 1), false);
    inp.oninput = () => update(inp.value, true);
    inp.onblur = () => { inp.value = state[r.id] || ""; };
    update(state[r.id] || 0, false);

    row.appendChild(dec);
    row.appendChild(inp);
    row.appendChild(inc);
    row.appendChild(sub);
    body.appendChild(row);
  }
  card.appendChild(body);

  // Footer
  const foot = document.createElement("div");
  foot.style.cssText =
    "padding:12px 18px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;gap:10px";
  const left = document.createElement("div");
  left.style.cssText = "font-size:11px;color:rgba(255,255,255,0.55)";
  selCountEl = document.createElement("span");
  selCountEl.style.color = "#fff";
  selCountEl.style.fontWeight = "700";
  totalEl = document.createElement("span");
  totalEl.style.color = "#86efac";
  totalEl.style.fontWeight = "700";
  totalEl.style.marginLeft = "10px";
  left.appendChild(document.createTextNode("Selecionados: "));
  left.appendChild(selCountEl);
  left.appendChild(document.createTextNode("  ·  Total: "));
  left.appendChild(totalEl);

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:8px";
  const cancel = document.createElement("button");
  cancel.textContent = "Cancelar";
  cancel.style.cssText =
    "padding:8px 14px;border-radius:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);cursor:pointer;font-size:12px";
  cancel.onclick = close;
  const save = document.createElement("button");
  save.textContent = "✓ Salvar recortes";
  save.style.cssText =
    "padding:8px 16px;border-radius:7px;background:rgba(16,185,129,0.18);border:1px solid #34D39955;color:#34D399;cursor:pointer;font-size:12px;font-weight:700";
  save.onclick = () => {
    const out = [];
    for (const r of RECORTES_FORRO) {
      const q = Number(state[r.id]) || 0;
      if (q > 0) out.push({ id: r.id, nome: r.nome, u: r.u, p: r.p, qtd: q });
    }
    try { typeof onSave === "function" && onSave(out); } catch (e) { console.error("[recortes-forro save]", e); }
    close();
  };
  btnRow.appendChild(cancel);
  btnRow.appendChild(save);
  foot.appendChild(left);
  foot.appendChild(btnRow);
  card.appendChild(foot);

  root.appendChild(card);
  document.body.appendChild(root);
  renderTotal();

  function close() {
    if (root.parentNode) root.parentNode.removeChild(root);
  }
}

window.__pkt_openRecortesForro = openRecortesForro;
window.__pkt_RECORTES_FORRO = RECORTES_FORRO;

export { openRecortesForro, RECORTES_FORRO };
