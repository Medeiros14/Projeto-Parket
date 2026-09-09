# Extrai as abas do ERP legado (Apps Script) chamando google.script.run
# dentro do proprio app, via Chromium headless — mesmo canal que o front usa.
import json, os, time
from playwright.sync_api import sync_playwright

EXEC_URL = "https://script.google.com/macros/s/AKfycbx9Tznk38I7i-p2r62Fw1_umQw9USMFjOEq5roRze_pD4e0k4WWNEOKXFmZYgQeFZqr/exec"
OUT_DIR = "/tmp/erp_data"
TIPOS = ["clientes", "produtos", "transportadoras", "fornecedores",
         "financeiro", "estoque-manual", "rel-pedidos"]

os.makedirs(OUT_DIR, exist_ok=True)

JS_CALL = """
(t) => new Promise((resolve) => {
  google.script.run
    .withSuccessHandler((r) => resolve({ ok: true, r }))
    .withFailureHandler((e) => resolve({ ok: false, e: String(e) }))
    .obterDadosAba(t);
})
"""

with sync_playwright() as p:
    browser = p.chromium.launch(args=[
        "--disable-features=AsyncDns",
        "--disable-background-networking",
        "--no-sandbox",
    ])
    page = browser.new_page()
    for tent in range(4):
        try:
            page.goto(EXEC_URL, wait_until="domcontentloaded", timeout=90_000)
            break
        except Exception as e:
            print(f"goto tentativa {tent+1} falhou: {e}")
            if tent == 3:
                raise
            time.sleep(3)

    app_frame = None
    for _ in range(30):
        for f in page.frames:
            try:
                if f.evaluate("() => typeof google !== 'undefined' && !!(google.script && google.script.run)"):
                    app_frame = f
                    break
            except Exception:
                pass
        if app_frame:
            break
        time.sleep(1)

    if not app_frame:
        raise SystemExit("ERRO: frame com google.script.run nao encontrado")
    print("frame do app:", app_frame.url[:80])

    for tipo in TIPOS:
        res = app_frame.evaluate(JS_CALL, tipo)
        if not res.get("ok"):
            print(f"FALHOU {tipo}: {res.get('e')}")
            continue
        payload = res["r"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        linhas = payload.get("linhas") if isinstance(payload, dict) else payload
        linhas = linhas or []
        debug = payload.get("debug", "") if isinstance(payload, dict) else ""
        with open(f"{OUT_DIR}/{tipo}.json", "w") as fh:
            json.dump({"linhas": linhas, "debug": debug}, fh, ensure_ascii=False, indent=1)
        print(f"{tipo}: {max(0, len(linhas)-1)} registros — {debug[:120]}")

    browser.close()
