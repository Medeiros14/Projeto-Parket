"""HTML → PDF via Playwright (Chromium headless).

O objetivo é produzir um PDF *idêntico* ao "Cmd+P → Salvar como PDF" do Chrome
que o Homebroker/Contratos usam no botão 'Abrir e imprimir'. Playwright é a
única opção que garante paridade 100% com o preview do frontend (fontes web,
@page, page-break, etc).
"""
from __future__ import annotations
from playwright.async_api import async_playwright


async def html_to_pdf(html: str) -> bytes:
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",   # container ficaria sem /dev/shm
        ])
        try:
            page = await browser.new_page()
            # `wait_until='networkidle'` garante que fontes remotas (DM Sans/Cinzel)
            # e imagens (proposta-cover.png) terminaram de carregar antes de
            # renderizar o PDF.
            await page.set_content(html, wait_until="networkidle", timeout=20000)
            pdf = await page.pdf(
                format="A4",
                print_background=True,
                prefer_css_page_size=True,   # respeita `@page { size: ... }` do CSS
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
            return pdf
        finally:
            await browser.close()
