"""Testbed — smoke tests pós-deploy. Tudo read-only / sem side-effects.

- `http_check`: status code + corpo curto.
- `md5_file_local` / `md5_file_remote`: compara md5 entre patches/ e container.
- `node_check`: valida sintaxe JS.
- `playwright_screenshot`: snapshot full page (URL pública).
- `playwright_eval`: roda JS no contexto da página (ex: inspect computed style).
"""

from __future__ import annotations

import hashlib
import subprocess
import tempfile

import structlog
from agno.tools import tool
import httpx

log = structlog.get_logger()


@tool(name="testbed_http_check", show_result=True)
def http_check(url: str, basic_auth: str | None = None, timeout: int = 10) -> dict:
    """GET na URL. Retorna status, latência, primeiros 600 chars de body."""
    auth = None
    if basic_auth and ":" in basic_auth:
        u, p = basic_auth.split(":", 1)
        auth = (u, p)
    try:
        with httpx.Client(timeout=timeout, auth=auth, follow_redirects=True) as client:
            r = client.get(url)
        return {
            "ok": r.status_code < 400,
            "status_code": r.status_code,
            "latency_ms": int(r.elapsed.total_seconds() * 1000),
            "headers": {k: v for k, v in list(r.headers.items())[:8]},
            "body_preview": r.text[:600],
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


@tool(name="testbed_md5_local", show_result=True)
def md5_local(path: str) -> dict:
    """md5 de arquivo local."""
    try:
        h = hashlib.md5()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return {"ok": True, "md5": h.hexdigest(), "path": path}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "path": path}


@tool(name="testbed_md5_in_container", show_result=True)
def md5_in_container(container_name: str, path_in_container: str) -> dict:
    """md5 de arquivo dentro de container Docker."""
    try:
        cp = subprocess.run(
            ["docker", "exec", container_name, "md5sum", path_in_container],
            capture_output=True, text=True, timeout=20,
        )
        if cp.returncode != 0:
            return {"ok": False, "stderr": cp.stderr[:300]}
        md5 = cp.stdout.split()[0] if cp.stdout else ""
        return {"ok": True, "md5": md5, "container": container_name, "path": path_in_container}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


@tool(name="testbed_node_check", show_result=True)
def node_check(js_path: str) -> dict:
    """`node --check <arquivo>`. Valida sintaxe sem executar."""
    try:
        # Renomeia pra .mjs temporariamente pra evitar erro com top-level await
        with open(js_path, "rb") as f:
            content = f.read()
        with tempfile.NamedTemporaryFile(suffix=".mjs", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        cp = subprocess.run(
            ["node", "--check", tmp_path],
            capture_output=True, text=True, timeout=15,
        )
        return {"ok": cp.returncode == 0, "stderr": cp.stderr[:500]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


@tool(name="testbed_playwright_screenshot", show_result=True)
def playwright_screenshot(url: str, output_path: str, viewport_width: int = 1400, viewport_height: int = 1800, wait_ms: int = 5000) -> dict:
    """Snapshot full-page de uma URL (Playwright headless). Útil pra smoke pós-deploy.

    Args:
        url: URL completa.
        output_path: onde salvar (PNG).
        viewport_width/height: tamanho da viewport.
        wait_ms: espera após networkidle (pra apps SPA estabilizarem).
    """
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": viewport_width, "height": viewport_height})
            page.goto(url, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(wait_ms)
            page.screenshot(path=output_path, full_page=True)
            browser.close()
        return {"ok": True, "path": output_path, "url": url}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "hint": "Playwright não está instalado nesta imagem. Use http_check + md5 pra smoke nessa fase."}


@tool(name="testbed_compare_md5", show_result=True)
def compare_md5(patches_path: str, container_name: str, container_path: str) -> dict:
    """Atalho: md5 local × md5 container. Retorna 'match' bool."""
    a = md5_local(patches_path)
    b = md5_in_container(container_name, container_path)
    if not a.get("ok") or not b.get("ok"):
        return {"ok": False, "local": a, "container": b}
    match = a["md5"] == b["md5"]
    return {"ok": True, "match": match, "local_md5": a["md5"], "container_md5": b["md5"]}
