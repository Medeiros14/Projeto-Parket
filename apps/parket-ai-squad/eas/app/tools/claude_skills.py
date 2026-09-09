"""Skills — arquivos MD de memória do Claude Code do terminal Parket.

Montados read-only em /claude-skills (bind de /root/.claude/projects/-root/memory).
Cada MD é um aprendizado validado em produção (design system, regras de deploy,
armadilhas conhecidas). Os agentes usam como skill sob demanda.
"""

from __future__ import annotations

import re
from pathlib import Path

from agno.tools import tool

SKILLS_DIR = Path("/claude-skills")


def _frontmatter(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    meta: dict[str, str] = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
    return meta


@tool(name="skills_listar", show_result=True)
def skills_listar(filtro: str = "") -> dict:
    """Lista as skills disponíveis (MDs de memória validados em produção do terminal Parket).

    Cobrem design system, regras de deploy, armadilhas conhecidas, arquitetura.
    SEMPRE consulte antes de mexer em layout/UI (skill 'so_parket_design_system'),
    deploy de dashboard, propostas, Valoria etc.

    Args:
        filtro: termo opcional pra filtrar por nome/descrição (ex: 'design', 'valoria', 'deploy').
    """
    try:
        out = []
        for f in sorted(SKILLS_DIR.glob("*.md")):
            if f.name == "MEMORY.md":
                continue
            meta = _frontmatter(f.read_text(errors="ignore")[:2000])
            item = {"arquivo": f.stem, "nome": meta.get("name", f.stem), "descricao": meta.get("description", "")}
            if filtro and filtro.lower() not in (f.stem + item["nome"] + item["descricao"]).lower():
                continue
            out.append(item)
        return {"total": len(out), "skills": out}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@tool(name="skill_ler", show_result=True)
def skill_ler(arquivo: str) -> dict:
    """Lê o conteúdo completo de uma skill pelo nome do arquivo (sem .md).

    Args:
        arquivo: nome retornado por skills_listar (ex: 'project_so_parket_design_system').
    """
    try:
        name = Path(arquivo).name.removesuffix(".md")
        f = SKILLS_DIR / f"{name}.md"
        if not f.is_file():
            return {"ok": False, "error": f"skill '{name}' não existe — use skills_listar"}
        return {"arquivo": name, "conteudo": f.read_text(errors="ignore")}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


ALL_TOOLS = [skills_listar, skill_ler]
