"""Deploy tools — wrappers seguros pros scripts deploy-*.sh existentes.

Todos exigem confirmação em prod. Scripts internos seguem as regras críticas dos
CLAUDE.md (golden-id, smoke test, rollback automático).
"""

from __future__ import annotations

import subprocess

import structlog
from agno.tools import tool

from app.config import settings
from app.tools.confirm import request_confirmation

log = structlog.get_logger()


def _run(cmd: list[str], cwd: str | None = None, timeout: int = 600) -> dict:
    try:
        cp = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd, check=False,
        )
        return {
            "ok": cp.returncode == 0,
            "stdout": cp.stdout[-4000:],
            "stderr": cp.stderr[-2000:],
            "rc": cp.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "stderr": "timeout", "rc": -1}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "stderr": str(exc), "rc": -1}


@tool(name="deploy_dashboard", show_result=True)
def deploy_dashboard(image_tag: str) -> dict:
    """Wrapper do /root/deploy-dashboard.sh. EXIGE confirmação. Inclui smoke test + rollback automático."""
    conf = request_confirmation(
        tool_name="deploy_dashboard",
        summary=f"/root/deploy-dashboard.sh {image_tag}",
        tool_args={"image_tag": image_tag},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}
    return _run(["/root/deploy-dashboard.sh", image_tag], timeout=600)


@tool(name="deploy_eas", show_result=True)
def deploy_eas() -> dict:
    """Re-deploy do EAS (parket-ai-squad_eas). EXIGE confirmação."""
    conf = request_confirmation(
        tool_name="deploy_eas",
        summary="/root/parket-ai-squad/deploy-eas.sh",
        tool_args={},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}
    return _run(["/root/parket-ai-squad/deploy-eas.sh"], timeout=300)


@tool(name="deploy_run_script", show_result=True)
def run_script(script_path: str, args: list[str] | None = None) -> dict:
    """Roda script de deploy genérico (qualquer /root/*.sh allow-listed). EXIGE confirmação.

    Restrição: só permite scripts dentro de /root/ que terminam em .sh.
    """
    if not script_path.startswith("/root/") or not script_path.endswith(".sh"):
        return {"ok": False, "error": "script_path deve ser /root/*.sh"}
    summary = f"{script_path} {' '.join(args or [])}"
    conf = request_confirmation(
        tool_name="deploy_run_script",
        summary=summary,
        tool_args={"script_path": script_path, "args": args or []},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}
    return _run([script_path, *(args or [])], timeout=600)
