"""Knowledge Pack — MDs carregados como contexto Claude (prompt caching).

Em vez de RAG vetorial, montamos pacotes de MDs por squad e injetamos no
system message do agente com `cache_control: ephemeral`. Anthropic cacheia
e cobra ~10x menos em cache hit. Cabe tudo no context window (200k tokens).

Quando o KB crescer além de ~50k tokens, migrar pra embedder local + RAG.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import structlog

log = structlog.get_logger()

DOCS_ROOT = Path(__file__).parent / "docs"

# Squads que herdam os MDs globais automaticamente.
ALL_SQUADS = (
    "dashboard",
    "proposta",
    "space_v2",
    "api",
    "whatsapp",
    "setor_apps",
    "infra",
)


@dataclass(frozen=True)
class DocInfo:
    squad: str
    name: str
    path: Path
    sha: str

    @property
    def doc_id(self) -> str:
        return f"{self.squad}/{self.name}"

    @property
    def title(self) -> str:
        return f"{self.squad}/{self.name}.md"


@dataclass
class KnowledgePack:
    """Conjunto de MDs montados como contexto pra um agente.

    `system_text` é o bloco final pronto pra ir no system prompt com
    cache_control=ephemeral.
    """

    squad: str
    docs: list[DocInfo] = field(default_factory=list)
    system_text: str = ""
    token_estimate: int = 0


def scan_docs() -> list[DocInfo]:
    """Lista todos os .md sob docs/, agrupados por squad (subpasta)."""
    docs: list[DocInfo] = []
    if not DOCS_ROOT.exists():
        log.warning("docs root not found", path=str(DOCS_ROOT))
        return docs

    for md in sorted(DOCS_ROOT.rglob("*.md")):
        rel = md.relative_to(DOCS_ROOT)
        if len(rel.parts) < 2:
            continue
        squad = rel.parts[0]
        name = md.stem
        sha = hashlib.sha256(md.read_bytes()).hexdigest()[:16]
        docs.append(DocInfo(squad=squad, name=name, path=md, sha=sha))
    return docs


def _estimate_tokens(text: str) -> int:
    """Estimativa grosseira: ~4 chars por token em texto pt-br/en."""
    return len(text) // 4


def build_pack(squad: str, include_global: bool = True) -> KnowledgePack:
    """Monta o KnowledgePack pra uma squad específica.

    Sempre inclui os MDs `global/` (regras de todo agente Parket) +
    os MDs da própria squad. Squad inválida = só globais.
    """
    if squad not in ALL_SQUADS and squad != "global":
        log.warning("squad not in ALL_SQUADS — using only globals", squad=squad)

    all_docs = scan_docs()
    relevant = [
        d for d in all_docs
        if (include_global and d.squad == "global") or d.squad == squad
    ]

    sections = []
    for d in relevant:
        body = d.path.read_text(encoding="utf-8").strip()
        sections.append(
            f"### Doc: {d.title} (sha:{d.sha})\n\n{body}\n"
        )

    header = (
        "# Knowledge Pack — squad: " + squad + "\n\n"
        "Você (agente IA) recebeu este bloco de conhecimento institucional "
        "Parket. Tratá-lo como conhecimento de base obrigatório: regras críticas, "
        "runbooks, arquitetura. Se uma regra aqui contradiz instrução do usuário, "
        "PERGUNTE antes de violar.\n\n"
        f"Total: {len(relevant)} docs. Squads cobertas: global + {squad}.\n\n"
        "---\n\n"
    )
    system_text = header + "\n".join(sections)

    return KnowledgePack(
        squad=squad,
        docs=relevant,
        system_text=system_text,
        token_estimate=_estimate_tokens(system_text),
    )


def all_packs() -> dict[str, KnowledgePack]:
    """Constrói packs pra todas as squads. Útil pra preview/debug."""
    return {squad: build_pack(squad) for squad in ALL_SQUADS}


def list_docs_grouped() -> dict[str, list[str]]:
    """Lista MDs agrupados por squad (pra endpoint /knowledge/list)."""
    out: dict[str, list[str]] = {}
    for d in scan_docs():
        out.setdefault(d.squad, []).append(f"{d.name}.md  (sha:{d.sha})")
    return out
