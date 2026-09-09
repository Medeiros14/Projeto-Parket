#!/usr/bin/env python3
"""Sincroniza uma pasta-modelo de obra (Fase N_/passos 0..17.2) pro
gestao.documentos via API. Uso:

    python3 sync_pasta_projeto.py <pasta> <projeto_id> [--base URL] [--dry-run]

Deriva o código do catálogo do diretório numerado mais interno
(ex.: "9.1 - ..." → 9.1); senão, do prefixo do nome do arquivo.
Pula pastas de derivados ("PDF Images").
"""
import re
import sys
from pathlib import Path

import requests

SKIP_DIRS = {"pdf images"}
NUM_RE = re.compile(r"^(\d+(?:\.\d+)?)[\s\._\-]")


def codigo_de(path: Path, raiz: Path) -> str | None:
    rel = path.relative_to(raiz)
    partes = list(rel.parts[:-1])          # diretórios (sem Fase X_)
    for parte in reversed(partes):
        m = NUM_RE.match(parte)
        if m:
            return m.group(1)
    m = NUM_RE.match(path.name)
    return m.group(1) if m else None


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    base = "https://gestao.parket.works"
    if "--base" in " ".join(sys.argv):
        i = sys.argv.index("--base")
        base = sys.argv[i + 1]
        args = [a for a in args if a != base]
    pasta, pid = Path(args[0]), args[1]
    dry = "--dry-run" in flags

    arquivos = sorted(
        p for p in pasta.rglob("*")
        if p.is_file() and not any(d.lower() in SKIP_DIRS for d in p.parts)
    )
    print(f"{len(arquivos)} arquivos em {pasta}")

    ja_tem: set[str] = set()
    if not dry:
        try:
            r = requests.get(f"{base}/api/projetos/{pid}/documentos", timeout=30)
            ja_tem = {d.get("nome_arquivo") for d in r.json() if d.get("nome_arquivo")}
        except Exception:
            pass
    ok = fail = 0
    for f in arquivos:
        cod = codigo_de(f, pasta)
        mb = f.stat().st_size / 1024 / 1024
        tag = f"[{cod or 'avulso':>6}] {f.relative_to(pasta)} ({mb:.1f}MB)"
        if dry:
            print(f"DRY {tag}")
            continue
        if f.name in ja_tem:
            print(f"SKIP {tag} (já enviado)")
            continue
        data = {"catalogo_codigo": cod or "", "titulo": f.stem}
        try:
            with open(f, "rb") as fh:
                r = requests.post(
                    f"{base}/api/projetos/{pid}/documentos",
                    data=data, files={"file": (f.name, fh)}, timeout=600,
                )
            if r.status_code < 400:
                ok += 1
                print(f"OK  {tag}")
            else:
                fail += 1
                print(f"ERR {tag} → {r.status_code} {r.text[:200]}")
        except Exception as e:
            fail += 1
            print(f"ERR {tag} → {e}")
    print(f"\nresumo: {ok} ok, {fail} falhas")


if __name__ == "__main__":
    main()
