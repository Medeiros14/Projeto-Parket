"""Git tools — read livre, push/merge exigem confirmação em prod."""

from __future__ import annotations

import subprocess

import structlog
from agno.tools import tool

from app.config import settings
from app.tools.confirm import request_confirmation

log = structlog.get_logger()


def _run(args: list[str], cwd: str | None = None, timeout: int = 30) -> dict:
    try:
        cp = subprocess.run(
            ["git", *args],
            capture_output=True, text=True, timeout=timeout, cwd=cwd, check=False,
        )
        return {
            "ok": cp.returncode == 0,
            "stdout": cp.stdout.strip(),
            "stderr": cp.stderr.strip(),
            "rc": cp.returncode,
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "stderr": str(exc), "rc": -1}


@tool(name="git_status", show_result=True)
def git_status(repo: str) -> dict:
    """`git status` num repo."""
    return _run(["status", "--short"], cwd=repo)


@tool(name="git_current_branch", show_result=True)
def current_branch(repo: str) -> dict:
    return _run(["rev-parse", "--abbrev-ref", "HEAD"], cwd=repo)


@tool(name="git_log", show_result=True)
def git_log(repo: str, n: int = 10, oneline: bool = True) -> dict:
    args = ["log", f"-{n}"]
    if oneline:
        args.append("--oneline")
    return _run(args, cwd=repo, timeout=10)


@tool(name="git_diff", show_result=True)
def git_diff(repo: str, staged: bool = False, file: str | None = None) -> dict:
    args = ["diff"]
    if staged:
        args.append("--cached")
    if file:
        args.append(file)
    return _run(args, cwd=repo, timeout=15)


@tool(name="git_create_branch", show_result=True)
def create_branch(repo: str, name: str) -> dict:
    return _run(["checkout", "-b", name], cwd=repo)


@tool(name="git_add", show_result=True)
def git_add(repo: str, paths: list[str]) -> dict:
    """`git add <paths>`. Evite `.` ou `-A` (risco de incluir segredos)."""
    if not paths or paths == ["."] or paths == ["-A"]:
        return {"ok": False, "error": "paths must be explicit files, not '.' or '-A'"}
    return _run(["add", *paths], cwd=repo)


@tool(name="git_commit", show_result=True)
def git_commit(repo: str, message: str) -> dict:
    return _run(["commit", "-m", message], cwd=repo)


@tool(name="git_push", show_result=True)
def git_push(repo: str, remote: str = "origin", branch: str | None = None) -> dict:
    """Push pro remoto. EXIGE confirmação em prod (especialmente pra main/golden)."""
    conf = request_confirmation(
        tool_name="git_push",
        summary=f"git push {remote} {branch or '(current)'} (repo: {repo})",
        tool_args={"repo": repo, "remote": remote, "branch": branch},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}
    args = ["push", remote]
    if branch:
        args.append(branch)
    return _run(args, cwd=repo, timeout=60)
