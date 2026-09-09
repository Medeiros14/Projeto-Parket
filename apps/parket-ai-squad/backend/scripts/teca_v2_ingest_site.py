#!/usr/bin/env python3
"""
Ingest parket.com.br conteúdo em teca_v2_kb (pgvector).

Estratégia: extrair strings de texto significativas (≥80 chars, sem código)
dos bundles JS do site e ingerir em chunks indexáveis.

Uso:
  python -m app.scripts.teca_v2_ingest_site --site-dir /usr/share/nginx/html \
       --source parket.com.br --wipe-first

Quando rodado dentro do container do site, lê os arquivos diretamente. Quando
rodado fora (no host), receba o diretório montado.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import logging
from pathlib import Path

# Permite rodar fora do container — pula o ambiente FastAPI se faltar
sys.path.insert(0, "/app")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.teca_v2 import kb_site  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ingest")


# Strings curtas/inúteis pra filtrar
NOISE_PATTERNS = [
    re.compile(r"^[\d\W_]+$"),                          # só dígitos/punct
    re.compile(r"^https?://", re.I),                    # URLs
    re.compile(r"^/[A-Za-z0-9_-]+/?$"),                 # paths
    re.compile(r"^[A-Za-z]+-\d+\.(webp|jpg|png|svg)$"), # nomes de arquivo
    re.compile(r"^(rgb|rgba|#|px|em|rem|vh|vw)"),       # CSS units
    re.compile(r"^(true|false|null|undefined)$"),
    re.compile(r"^[A-Z][A-Za-z]*-[\dA-Za-z_-]{6,}\.(js|css)$"),
]

KEEP_MIN_LEN = 80     # mínimo de chars
KEEP_MAX_LEN = 1200   # split em chunks acima disso
MIN_WORDS = 8         # mínimo de palavras


def is_noise(s: str) -> bool:
    s = s.strip()
    if len(s) < KEEP_MIN_LEN:
        return True
    if len(s.split()) < MIN_WORDS:
        return True
    for p in NOISE_PATTERNS:
        if p.match(s):
            return True
    # filtra "código" — strings com muitos símbolos sem espaço
    symbols = sum(1 for c in s if c in "{}[]()<>;=+/")
    if symbols / max(1, len(s)) > 0.06:
        return True
    return False


def extract_strings(content: str) -> list[str]:
    """Extract double-quoted and template-literal strings from JS source."""
    out = []
    # "..."  (não-greedy, sem escapes complexos)
    for m in re.finditer(r'"([^"\\]{40,}(?:\\.[^"\\]*){0,3})"', content):
        out.append(m.group(1))
    # `...`  template literals — pega o segmento literal antes de ${
    for m in re.finditer(r'`([^`$\\]{40,}(?:\\.[^`\\]*){0,3})`', content):
        out.append(m.group(1))
    return out


def chunk_long_text(text: str, max_len: int = KEEP_MAX_LEN) -> list[str]:
    """Quebra texto longo em pedaços por sentença."""
    if len(text) <= max_len:
        return [text]
    parts = re.split(r"(?<=[\.\!\?])\s+", text)
    chunks = []
    cur = ""
    for p in parts:
        if len(cur) + len(p) + 1 > max_len and cur:
            chunks.append(cur.strip())
            cur = p
        else:
            cur = (cur + " " + p).strip() if cur else p
    if cur:
        chunks.append(cur.strip())
    return chunks


def process_file(path: Path) -> list[dict]:
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        logger.warning("read failed %s: %s", path, e)
        return []
    raw_strings = extract_strings(content)
    rows = []
    seen = set()
    for s in raw_strings:
        s = s.replace("\\n", " ").replace("\\t", " ").replace("\\\"", '"').strip()
        s = re.sub(r"\s+", " ", s)
        if is_noise(s):
            continue
        h = s[:120]
        if h in seen:
            continue
        seen.add(h)
        for chunk in chunk_long_text(s):
            rows.append({
                "source": "parket.com.br",
                "title": path.name,
                "content": chunk,
                "meta": {"file": path.name},
            })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site-dir", default="/usr/share/nginx/html",
                    help="Diretório do site (dentro do container parket-site_site)")
    ap.add_argument("--source", default="parket.com.br")
    ap.add_argument("--wipe-first", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    site = Path(args.site_dir)
    if not site.exists():
        logger.error("dir não existe: %s", site)
        sys.exit(1)

    if args.wipe_first and not args.dry_run:
        n = kb_site.wipe_source(args.source)
        logger.info("removidos %d chunks antigos de %s", n, args.source)

    all_rows = []
    # Cobre JS + HTML
    for ext in ("*.js", "*.html"):
        for fp in sorted(site.glob(f"**/{ext}")):
            # Pula HTMLs de fallback
            if fp.name in ("50x.html",):
                continue
            rows = process_file(fp)
            if rows:
                logger.info("%s → %d chunks", fp.relative_to(site), len(rows))
                all_rows.extend(rows)

    logger.info("TOTAL: %d chunks coletados", len(all_rows))
    if args.dry_run:
        # Mostra amostra
        for r in all_rows[:5]:
            print(f"[{r['title']}] {r['content'][:200]}")
        return

    BATCH = 64
    inserted = 0
    for i in range(0, len(all_rows), BATCH):
        batch = all_rows[i : i + BATCH]
        n = kb_site.ingest_chunks(batch)
        inserted += n
        logger.info("ingest batch %d/%d → %d", (i // BATCH) + 1, (len(all_rows) + BATCH - 1) // BATCH, n)

    logger.info("FIM: %d chunks ingeridos", inserted)
    counts = kb_site.count_chunks()
    logger.info("teca_v2_kb totals: %s", counts)


if __name__ == "__main__":
    main()
