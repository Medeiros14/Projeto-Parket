/** Confirmação com cara de app — substitui o confirm() nativo do navegador. */
export function confirmar(msg: string, okLabel = "Confirmar", cor = "#4a7c59"): Promise<boolean> {
  return new Promise((res) => {
    const ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:24px;";
    const card = document.createElement("div");
    card.style.cssText =
      "width:100%;max-width:340px;background:#171610;border:1px solid rgba(255,255,255,0.14);padding:18px 16px;display:flex;flex-direction:column;gap:14px;font-family:'Inter',sans-serif;";
    const p = document.createElement("div");
    p.style.cssText = "font-size:13px;color:#e8e4da;line-height:1.55;";
    p.textContent = msg;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;";
    const ok = document.createElement("button");
    ok.textContent = okLabel;
    ok.style.cssText =
      `flex:1;padding:12px 10px;background:${cor};border:none;color:#fff;cursor:pointer;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;font-weight:600;`;
    const no = document.createElement("button");
    no.textContent = "Voltar";
    no.style.cssText =
      "padding:12px 14px;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#a8a396;cursor:pointer;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;";
    row.append(ok, no);
    card.append(p, row);
    ov.append(card);
    const done = (v: boolean) => { ov.remove(); res(v); };
    ov.onclick = (e) => { if (e.target === ov) done(false); };
    ok.onclick = () => done(true);
    no.onclick = () => done(false);
    document.body.appendChild(ov);
  });
}
