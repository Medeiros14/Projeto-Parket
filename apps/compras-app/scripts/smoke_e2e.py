# Smoke E2E do compras.parket.works: loga com user de teste e valida cada tela.
import os, sys, time, json
from playwright.sync_api import sync_playwright

BASE = "https://compras.parket.works"
EMAIL = os.environ["SMOKE_EMAIL"]
SENHA = os.environ["SMOKE_SENHA"]

CHECKS = [
    ("/cadastros", "ANA PAULA RIBEIRO BELLI", "aba Projetos puxando do banco de obras"),
    ("/fornecedores", "TERABYTESHOP", "fornecedores migrados"),
    ("/estoque", None, "estoque & POs (dados do Space, nao migra)"),
    ("/financeiro", "FABESUL", "contas a pagar"),
    ("/relatorios", None, "relatorios carrega"),
    ("/almoxarifado", "Taiara", "depósitos Marcenaria (Ronaldo) + Instalação (Taiara)"),
    ("/almoxarifado", "Ronaldo", "depósito Marcenaria visível"),
    ("/almoxarifado", "Alvejante", "estoque do Ronaldo restaurado (posição marcenaria)"),
    ("/", None, "kanban carrega"),
]

erros_console, erros_page = [], []
falhas = []

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--disable-features=AsyncDns", "--no-sandbox"])
    page = browser.new_page()
    page.on("console", lambda m: erros_console.append(f"{page.url} :: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: erros_page.append(f"{page.url} :: {e}"))

    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=60_000)
    page.fill("input[type=email]", EMAIL)
    page.fill("input[type=password]", SENHA)
    page.click("button[type=submit]")
    try:
        page.wait_for_url(lambda u: "/login" not in u, timeout=30_000)
        print("LOGIN OK ->", page.url)
    except Exception:
        print("LOGIN FALHOU — ainda em", page.url)
        page.screenshot(path="/tmp/smoke_login_fail.png")
        browser.close()
        sys.exit(1)

    for rota, esperado, desc in CHECKS:
        page.goto(f"{BASE}{rota}", wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(4000)
        corpo = page.inner_text("body")
        nome = rota.strip("/").replace("/", "_") or "kanban"
        page.screenshot(path=f"/tmp/smoke_{nome}.png", full_page=False)
        if "Carregando" in corpo and esperado and esperado not in corpo:
            page.wait_for_timeout(5000)
            corpo = page.inner_text("body")
        if esperado:
            ok = esperado.upper() in corpo.upper()
            print(f"{'OK ' if ok else 'FALHA'} {rota} — {desc}" + ("" if ok else f" (não achei '{esperado}')"))
            if not ok:
                falhas.append(rota)
        else:
            vazio = len(corpo.strip()) < 40
            print(f"{'OK ' if not vazio else 'FALHA'} {rota} — {desc} ({len(corpo)} chars)")
            if vazio:
                falhas.append(rota)

    # aba Produtos dentro de Cadastros — 22 produtos do estoque Ronaldo restaurados 04/08
    page.goto(f"{BASE}/cadastros", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    try:
        page.click("text=Produtos", timeout=5000)
        page.wait_for_timeout(3000)
        corpo = page.inner_text("body")
        ok = "ALVEJANTE" in corpo.upper()
        print(("OK " if ok else "FALHA") + " /cadastros aba Produtos — produtos do estoque restaurado")
        if not ok: falhas.append("/cadastros#produtos")
        page.screenshot(path="/tmp/smoke_cadastros_produtos.png")
    except Exception as e:
        print("FALHA aba Produtos:", e)
        falhas.append("/cadastros#produtos")

    browser.close()

print("\n--- console errors:", len(erros_console))
for e in erros_console[:10]: print("  ", e[:200])
print("--- page errors:", len(erros_page))
for e in erros_page[:10]: print("  ", e[:200])
print("\nRESULTADO:", "TUDO OK" if not falhas and not erros_page else f"FALHAS: {falhas} pageerrors: {len(erros_page)}")
sys.exit(0 if not falhas and not erros_page else 2)
