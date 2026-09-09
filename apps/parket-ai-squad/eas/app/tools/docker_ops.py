"""Docker Swarm tools — leitura é livre, mutações exigem confirmação em prod.

Read tools: list_services, inspect_service, list_tasks, container_logs, exec_read.
Write tools (confirm em prod): service_update, scale, exec_write.
"""

from __future__ import annotations

import subprocess

import structlog
from agno.tools import tool

from app.config import settings
from app.tools.confirm import request_confirmation

log = structlog.get_logger()

DOCKER = "/usr/bin/docker"


def _run(args: list[str], timeout: int = 30) -> dict:
    try:
        cp = subprocess.run(
            [DOCKER, *args],
            capture_output=True, text=True, timeout=timeout, check=False,
        )
        return {
            "ok": cp.returncode == 0,
            "stdout": cp.stdout.strip(),
            "stderr": cp.stderr.strip(),
            "rc": cp.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "stderr": "timeout", "rc": -1}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "stderr": str(exc), "rc": -1}


# ============================================================
# Read tools (sempre permitidas)
# ============================================================

@tool(name="docker_list_services", show_result=True)
def list_services(filter_name: str = "") -> dict:
    """Lista services do Swarm. `filter_name` opcional pra grep."""
    args = ["service", "ls", "--format", "{{.Name}}\t{{.Replicas}}\t{{.Image}}"]
    r = _run(args)
    if filter_name and r["ok"]:
        lines = [l for l in r["stdout"].splitlines() if filter_name in l]
        r["stdout"] = "\n".join(lines)
    return r


@tool(name="docker_inspect_service", show_result=True)
def inspect_service(name: str, fields: list[str] | None = None) -> dict:
    """Inspect service. `fields`: lista de paths (ex: ['Spec.TaskTemplate.ContainerSpec.Image'])."""
    if fields:
        fmt = "{{range .}}" + "\t".join(["{{." + f + "}}" for f in fields]) + "{{end}}"
        return _run(["service", "inspect", name, "--format", fmt])
    return _run(["service", "inspect", name])


@tool(name="docker_service_ps", show_result=True)
def service_ps(name: str, no_trunc: bool = False) -> dict:
    """Lista tasks de um service (estado, erro). Crítico pra detectar zumbi."""
    args = ["service", "ps", name, "--format", "{{.Name}}\t{{.CurrentState}}\t{{.Error}}"]
    if no_trunc:
        args.append("--no-trunc")
    return _run(args)


@tool(name="docker_container_logs", show_result=True)
def container_logs(container_name_or_id: str, tail: int = 100) -> dict:
    """Últimas N linhas de log de um container."""
    return _run(["logs", "--tail", str(tail), container_name_or_id], timeout=20)


@tool(name="docker_exec_read", show_result=True)
def exec_read(container: str, cmd: list[str]) -> dict:
    """Roda comando READ-ONLY dentro de um container (ex: ['ls','/etc']).

    NÃO usar pra mutações — use exec_write (que pede confirmação)."""
    return _run(["exec", container, *cmd], timeout=30)


# ============================================================
# Write tools (exigem confirmação em prod)
# ============================================================

@tool(name="docker_service_update", show_result=True)
def service_update(service: str, image: str | None = None, force: bool = False) -> dict:
    """Atualiza um service (imagem nova, --force). EXIGE confirmação Will em prod.

    Args:
        service: nome do service.
        image: imagem nova (ex: parket-ai-eas:latest). Se None, só --force.
        force: força redeploy mesmo sem mudança.
    """
    summary = f"docker service update {service}" + (f" image={image}" if image else "") + (" --force" if force else "")
    conf = request_confirmation(
        tool_name="docker_service_update",
        summary=summary,
        tool_args={"service": service, "image": image, "force": force},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}

    args = ["service", "update"]
    if image:
        args += ["--image", image]
    if force:
        args.append("--force")
    args.append(service)
    return _run(args, timeout=120)


@tool(name="docker_service_scale", show_result=True)
def service_scale(service: str, replicas: int) -> dict:
    """Escala service. EXIGE confirmação em prod. Usar com replicas=0 pra parar zumbi."""
    conf = request_confirmation(
        tool_name="docker_service_scale",
        summary=f"docker service scale {service}={replicas}",
        tool_args={"service": service, "replicas": replicas},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}
    return _run(["service", "scale", f"{service}={replicas}"], timeout=60)


@tool(name="docker_exec_write", show_result=True)
def exec_write(container: str, cmd: list[str]) -> dict:
    """Roda comando ARBITRÁRIO dentro do container. EXIGE confirmação."""
    conf = request_confirmation(
        tool_name="docker_exec_write",
        summary=f"docker exec {container} {' '.join(cmd)}",
        tool_args={"container": container, "cmd": cmd},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}
    return _run(["exec", container, *cmd], timeout=60)
