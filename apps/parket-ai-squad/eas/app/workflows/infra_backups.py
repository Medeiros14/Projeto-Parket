"""F3 — Workflows que migram os crons de backup pra schedules do AgentOS.

Cada workflow é um wrapper fino que:
1. Chama o script `.sh` existente via subprocess.
2. Captura stdout/stderr.
3. Loga atividade em claude_atividades (com categoria='config').
4. Alerta Will no WhatsApp se script falhar.

Frequências (mesmas do crontab atual):
- backup-apps.sh        */30 * * * *
- backup-dashboard.sh   0 */2 * * *
- backup-supabase-*.sh  0 3 * * *
- backup-volumes.sh     0 4 * * *
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import structlog
from agno.workflow import Step, Workflow

from app.tools.handoff import log_atividade
from app.tools.whatsapp_evolution import notify_will_impl as notify_will

log = structlog.get_logger()


def _run_backup_script(path: str, timeout: int = 600) -> dict:
    if not Path(path).exists():
        return {"ok": False, "error": f"script não existe: {path}"}
    try:
        cp = subprocess.run([path], capture_output=True, text=True, timeout=timeout, check=False)
        return {
            "ok": cp.returncode == 0,
            "stdout": cp.stdout[-2000:],
            "stderr": cp.stderr[-1000:],
            "rc": cp.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def _make_backup_executor(script_path: str, label: str):
    def _execute(step_input):
        log.info("running backup", script=script_path, label=label)
        result = _run_backup_script(script_path)

        if result.get("ok"):
            log_atividade.entrypoint(
                titulo=f"Backup: {label} OK",
                descricao=f"Script {script_path} rodou com sucesso via EAS scheduler.",
                setor="Engenharia",
                categoria="config",
            )
        else:
            err = result.get("error") or result.get("stderr", "")[:300]
            log_atividade.entrypoint(
                titulo=f"⚠️ Backup FALHOU: {label}",
                descricao=f"Script {script_path} falhou. rc={result.get('rc')}. Erro: {err}",
                setor="Engenharia",
                categoria="config",
            )
            try:
                notify_will(f"🚨 Backup *{label}* FALHOU.\nScript: `{script_path}`\nrc={result.get('rc')}\nErro: {err}")
            except Exception:
                pass
        return result
    return _execute


def build_workflows() -> dict[str, Workflow]:
    """Retorna dict {name: Workflow} pra cada cron de backup."""
    return {
        "backup_apps_30min": Workflow(
            name="backup_apps_30min",
            description="Backup dos apps a cada 30min (substitui /root/backup-apps.sh no crontab).",
            steps=[Step(name="run", executor=_make_backup_executor("/root/backup-apps.sh", "apps"))],
        ),
        "backup_dashboard_2h": Workflow(
            name="backup_dashboard_2h",
            description="Backup do dashboard a cada 2h (substitui /root/backup-dashboard.sh).",
            steps=[Step(name="run", executor=_make_backup_executor("/root/backup-dashboard.sh", "dashboard"))],
        ),
        "backup_supabase_daily": Workflow(
            name="backup_supabase_daily",
            description="Backup Supabase cloud diário 3h (substitui /root/backup-supabase-dashboard.sh).",
            steps=[Step(name="run", executor=_make_backup_executor("/root/backup-supabase-dashboard.sh", "supabase"))],
        ),
        "backup_volumes_daily": Workflow(
            name="backup_volumes_daily",
            description="Backup de volumes diário 4h (substitui /root/backup-volumes.sh).",
            steps=[Step(name="run", executor=_make_backup_executor("/root/backup-volumes.sh", "volumes"))],
        ),
    }


# Mapa nome → cron pra schedule
BACKUP_CRONS = {
    "backup_apps_30min": "*/30 * * * *",
    "backup_dashboard_2h": "0 */2 * * *",
    "backup_supabase_daily": "0 3 * * *",
    "backup_volumes_daily": "0 4 * * *",
}
