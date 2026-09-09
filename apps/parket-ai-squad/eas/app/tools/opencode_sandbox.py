"""OpenCode sandbox — interface pra rodar edição de código em ambiente isolado.

`parket-ai-squad_opencode` já roda no stack. F2 expõe uma fina camada:
- `edit_file_in_place`: edição direta no filesystem do servidor (usa Python, NÃO OpenCode).
- `run_node_check`: validação sintática rápida.
- `run_shell_in_repo`: executa shell num diretório específico (com timeout).

A integração FULL com OpenCode HTTP API (clone repo isolado → edit → diff → result)
fica pra F3-F4 quando precisar de isolamento real. Pra F2 MVP, edição direta + node_check
cobre 90% dos hotpatches simples.
"""

from __future__ import annotations

import os
import subprocess

import structlog
from agno.tools import tool

from app.tools.confirm import request_confirmation

log = structlog.get_logger()


@tool(name="opencode_edit_file_in_place", show_result=True)
def edit_file_in_place(file_path: str, old_text: str, new_text: str, allow_multi: bool = False) -> dict:
    """Edição literal de arquivo. EXIGE confirmação.

    Args:
        file_path: caminho absoluto.
        old_text: texto literal a substituir (deve ser único, exceto se allow_multi=True).
        new_text: texto novo.
        allow_multi: se True, substitui todas ocorrências. Default False (mais seguro).
    """
    summary = f"Edit {file_path} (replace {len(old_text)} chars → {len(new_text)} chars)"
    conf = request_confirmation(
        tool_name="opencode_edit_file_in_place",
        summary=summary,
        tool_args={"file_path": file_path, "old_preview": old_text[:200], "new_preview": new_text[:200]},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}

    if not os.path.exists(file_path):
        return {"ok": False, "error": f"file not found: {file_path}"}

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        occurrences = content.count(old_text)
        if occurrences == 0:
            return {"ok": False, "error": "old_text não encontrado"}
        if occurrences > 1 and not allow_multi:
            return {
                "ok": False,
                "error": f"old_text aparece {occurrences}x — use allow_multi=True ou amplie o contexto pra ficar único",
            }
        new_content = content.replace(old_text, new_text, occurrences if allow_multi else 1)
        backup = file_path + f".bak-eas-{int(__import__('time').time())}"
        with open(backup, "w", encoding="utf-8") as f:
            f.write(content)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return {"ok": True, "replacements": occurrences if allow_multi else 1, "backup": backup}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


@tool(name="opencode_run_shell_in_repo", show_result=True)
def run_shell_in_repo(repo_path: str, cmd, timeout: int = 60) -> dict:
    """Roda shell command num repo. EXIGE confirmação. Limita timeout.

    `cmd` aceita list[str] (preferido) OU string JSON-encoded
    (ex: '["bash","-c","..."]') que alguns modelos passam por hábito.
    """
    if not os.path.isdir(repo_path):
        return {"ok": False, "error": f"not a directory: {repo_path}"}

    # Coerce string → list pra ser robusto a fluencia do modelo
    if isinstance(cmd, str):
        import json as _json
        s = cmd.strip()
        try:
            parsed = _json.loads(s)
            if isinstance(parsed, list):
                cmd = [str(x) for x in parsed]
            else:
                cmd = ["sh", "-c", s]
        except Exception:
            cmd = ["sh", "-c", s]
    elif not isinstance(cmd, list):
        return {"ok": False, "error": f"cmd must be list or string, got {type(cmd).__name__}"}
    cmd = [str(x) for x in cmd]

    summary = f"Run in {repo_path}: {' '.join(cmd)}"
    conf = request_confirmation(
        tool_name="opencode_run_shell_in_repo",
        summary=summary,
        tool_args={"repo_path": repo_path, "cmd": cmd, "timeout": timeout},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}
    try:
        cp = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=repo_path, check=False)
        return {
            "ok": cp.returncode == 0,
            "stdout": cp.stdout[-3000:],
            "stderr": cp.stderr[-1000:],
            "rc": cp.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "stderr": "timeout"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "stderr": str(exc)}
