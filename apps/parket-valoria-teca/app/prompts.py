"""Carrega prompts com auto-reload por mtime.

Arquitetura multi-agent:
- `_base_transversal.md`: comum a todos (papel, atitude, tools, princípios, actions genéricas)
- `_router.md`: instrução ROUTER (decide qual specialist chamar)
- `specialist_*.md`: uma por categoria (porta, marcenaria, lista_arquiteto, sauna, generico)

Cada request final é: base + (router | specialist), carregados dinamicamente.
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

PROMPT_DIR = Path("/app/prompt/multi")

_CACHE: Dict[str, Tuple[float, str]] = {}


def _load(name: str) -> str:
    p = PROMPT_DIR / name
    m = 0.0
    try:
        m = p.stat().st_mtime
    except FileNotFoundError:
        return f"(arquivo ausente: {name})"
    cached = _CACHE.get(name)
    if cached and cached[0] == m:
        return cached[1]
    text = p.read_text()
    _CACHE[name] = (m, text)
    return text


def base() -> str:
    return _load("_base_transversal.md")


def router_prompt() -> str:
    return base() + "\n\n---\n\n" + _load("_router.md")


VALID_SPECIALISTS = {"porta", "marcenaria", "lista_arquiteto", "sauna", "generico"}


def specialist_prompt(name: str) -> str:
    if name not in VALID_SPECIALISTS:
        raise ValueError(f"specialist desconhecido: {name}")
    return base() + "\n\n---\n\n" + _load(f"specialist_{name}.md")
