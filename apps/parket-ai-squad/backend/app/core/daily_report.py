"""
Relatório Diário de Atividades — Squad Parket IA
Envia todos os dias da semana às 21h no grupo Parket IA.
Lê o que foi FEITO em cada conversa do Claude Code e resume por sessão.
"""
import os
import json
import logging
import glob
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

logger = logging.getLogger("daily_report")

SP_TZ = ZoneInfo("America/Sao_Paulo")
TI_GROUP_ID = os.environ.get("TI_WHATSAPP_GROUP_ID", "120363405979905444@g.us")
LOG_DIR = Path("/data/activity-log")

CLAUDE_HISTORY = Path("/root/.claude/history.jsonl")
CLAUDE_SESSIONS_DIR = Path("/root/.claude/sessions")
CLAUDE_PROJECTS_DIR = Path("/root/.claude/projects")

# Sessões sem nome que devem ser ignoradas (testes curtos, /exit, etc.)
MIN_MSGS_PARA_REPORTAR = 3


def _ensure_dirs():
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def _today_file() -> Path:
    return LOG_DIR / f"{datetime.now(SP_TZ).strftime('%Y-%m-%d')}.json"


def _load_json(path: Path) -> list:
    if path.exists():
        return json.loads(path.read_text())
    return []


def _save_json(path: Path, data: list):
    _ensure_dirs()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def registrar_atividade(descricao: str, categoria: str = "geral", detalhes: str = ""):
    _ensure_dirs()
    agora = datetime.now(SP_TZ)
    entry = {
        "ts": agora.isoformat(),
        "hora": agora.strftime("%H:%M"),
        "descricao": descricao,
        "categoria": categoria,
        "detalhes": detalhes,
    }
    dia = _load_json(_today_file())
    dia.append(entry)
    _save_json(_today_file(), dia)


def get_atividades_hoje() -> list:
    return _load_json(_today_file())


def get_atividades_semana() -> list:
    """Retorna atividades dos últimos 7 dias."""
    resultado = []
    for i in range(7):
        dia = datetime.now(SP_TZ) - timedelta(days=i)
        path = LOG_DIR / f"{dia.strftime('%Y-%m-%d')}.json"
        resultado.extend(_load_json(path))
    return resultado


def _carregar_nomes_sessoes() -> dict:
    """Lê /root/.claude/sessions/*.json para mapear sessionId -> nome."""
    name_map = {}
    if not CLAUDE_SESSIONS_DIR.exists():
        return name_map
    for f in CLAUDE_SESSIONS_DIR.glob("*.json"):
        try:
            d = json.loads(f.read_text())
            sid = d.get("sessionId", "")
            name = d.get("name", "")
            if sid and name:
                name_map[sid] = name
        except Exception:
            pass
    return name_map


def _buscar_sessoes_hoje() -> dict:
    """
    Lê history.jsonl e retorna sessões com atividade hoje.
    {session_id: {nome, msgs, first_ts, last_ts, user_messages: [...]}}
    """
    agora = datetime.now(SP_TZ)
    hoje_start = agora.replace(hour=0, minute=0, second=0, microsecond=0)
    hoje_ts = int(hoje_start.timestamp() * 1000)

    name_map = _carregar_nomes_sessoes()
    sessoes = {}

    if not CLAUDE_HISTORY.exists():
        return sessoes

    try:
        with open(CLAUDE_HISTORY) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue

                ts = int(d.get("timestamp", 0))
                if ts < hoje_ts:
                    continue

                sid = d.get("sessionId", "")
                if not sid:
                    continue

                display = (d.get("display", "") or "").strip()

                if sid not in sessoes:
                    sessoes[sid] = {
                        "nome": name_map.get(sid, ""),
                        "msgs": 0,
                        "first_ts": ts,
                        "last_ts": ts,
                        "user_messages": [],
                    }

                sessoes[sid]["msgs"] += 1
                sessoes[sid]["last_ts"] = max(sessoes[sid]["last_ts"], ts)

                if display and not display.startswith("/") and len(display) > 5:
                    sessoes[sid]["user_messages"].append(display[:200])
    except Exception as e:
        logger.warning(f"Erro ao ler history.jsonl: {e}")

    return sessoes


def _extrair_trabalho_sessao(session_id: str) -> list[str]:
    """
    Lê o JSONL da conversa e extrai ações reais executadas pelo assistant.
    Retorna lista de descrições do que foi feito.
    """
    trabalhos = []

    # Buscar arquivo da sessão
    jsonl_files = list(CLAUDE_PROJECTS_DIR.rglob(f"{session_id}.jsonl"))
    if not jsonl_files:
        return trabalhos

    jsonl_path = jsonl_files[0]

    # Só lê os últimos 5MB para performance (pega trabalho recente)
    file_size = jsonl_path.stat().st_size
    read_offset = max(0, file_size - 5 * 1024 * 1024)

    try:
        with open(jsonl_path) as f:
            if read_offset > 0:
                f.seek(read_offset)
                f.readline()  # descarta linha parcial

            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except Exception:
                    continue

                msg = entry.get("message", {})
                if msg.get("role") != "assistant":
                    continue

                content = msg.get("content", "")
                if isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        btype = block.get("type", "")

                        if btype == "tool_use":
                            tool_name = block.get("name", "")
                            inp = block.get("input", {})

                            if tool_name == "Write":
                                fp = (inp.get("file_path", "") or "").replace("/root/", "")
                                trabalhos.append(f"📝 Criou: {fp}")
                            elif tool_name == "Edit":
                                fp = (inp.get("file_path", "") or "").replace("/root/", "")
                                trabalhos.append(f"✏️ Editou: {fp}")
                            elif tool_name == "Bash":
                                desc = inp.get("description", "")
                                cmd = (inp.get("command", "") or "")[:100]
                                if desc:
                                    trabalhos.append(f"⚡ {desc}")
                                elif "docker build" in cmd or "docker service" in cmd:
                                    trabalhos.append(f"🐳 Deploy Docker")
                                elif "npm run build" in cmd:
                                    trabalhos.append("🔨 Build do projeto")
                                elif "git commit" in cmd or "git push" in cmd:
                                    trabalhos.append(f"📦 Git: {cmd[:60]}")
                                elif "curl" in cmd and "supabase" in cmd:
                                    trabalhos.append("🗄️ Operação Supabase")
                            elif tool_name == "Agent":
                                desc = inp.get("description", "")
                                if desc:
                                    trabalhos.append(f"🤖 Agente: {desc}")

                        elif btype == "text":
                            text = (block.get("text", "") or "").strip()
                            # Pega resumos curtos do assistant (não blocos enormes de código)
                            if 30 < len(text) < 300 and "\n" not in text[:100]:
                                first_line = text.split("\n")[0].strip()
                                if (first_line
                                    and not first_line.startswith("{")
                                    and not first_line.startswith("[")
                                    and not first_line.startswith("```")
                                    and not first_line.startswith("<")):
                                    trabalhos.append(first_line[:150])

    except Exception as e:
        logger.warning(f"Erro ao ler sessão {session_id}: {e}")

    return trabalhos


def _resumir_trabalhos(trabalhos: list[str], max_items: int = 10) -> list[str]:
    """Remove duplicatas e agrupa trabalhos por tipo."""
    # Deduplica
    seen = set()
    unique = []
    for t in trabalhos:
        key = t.lower().strip()[:50]
        if key not in seen:
            seen.add(key)
            unique.append(t)

    edits = [t for t in unique if t.startswith("✏️")]
    creates = [t for t in unique if t.startswith("📝")]
    docker = [t for t in unique if t.startswith("🐳")]
    builds = [t for t in unique if t.startswith("🔨")]
    supabase = [t for t in unique if t.startswith("🗄️")]
    agents = [t for t in unique if t.startswith("🤖")]
    git_ops = [t for t in unique if t.startswith("📦")]
    bash_ops = [t for t in unique if t.startswith("⚡")]
    text_ops = [t for t in unique if not any(t.startswith(p) for p in ["✏️", "📝", "🐳", "🔨", "🗄️", "🤖", "📦", "⚡"])]

    result = []

    # Textos descritivos primeiro (resumos do que foi feito)
    for t in text_ops[:4]:
        result.append(t)

    # Arquivos editados
    if edits:
        files = list(set(e.replace("✏️ Editou: ", "") for e in edits))
        if len(files) <= 3:
            for f in files:
                result.append(f"✏️ Editou: {f}")
        else:
            result.append(f"✏️ Editou {len(files)} arquivos")

    # Arquivos criados
    if creates:
        files = list(set(c.replace("📝 Criou: ", "") for c in creates))
        if len(files) <= 3:
            for f in files:
                result.append(f"📝 Criou: {f}")
        else:
            result.append(f"📝 Criou {len(files)} arquivos")

    # Agrupados
    if supabase:
        result.append(f"🗄️ {len(supabase)} operação(ões) Supabase")
    if docker:
        result.append(f"🐳 {len(docker)} deploy(s) Docker")
    if builds:
        result.append(f"🔨 {len(builds)} build(s)")
    if git_ops:
        result.append(f"📦 {len(git_ops)} operação(ões) Git")
    for a in agents[:2]:
        result.append(a)
    for b in bash_ops[:3]:
        result.append(b)

    return result[:max_items]


def formatar_relatorio_diario() -> str:
    agora = datetime.now(SP_TZ)

    DIAS_PT = {
        "Monday": "Segunda", "Tuesday": "Terça", "Wednesday": "Quarta",
        "Thursday": "Quinta", "Friday": "Sexta", "Saturday": "Sábado", "Sunday": "Domingo",
    }
    dia_semana = DIAS_PT.get(agora.strftime("%A"), agora.strftime("%A"))

    linhas = []
    linhas.append("🤖 *RELATÓRIO DIÁRIO — SQUAD PARKET IA*")
    linhas.append(f"📅 {agora.strftime('%d/%m/%Y')} — {dia_semana}")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("")

    # ═══ SESSÕES DO CLAUDE CODE ═══
    sessoes = _buscar_sessoes_hoje()

    # Filtrar sessões com atividade real (>= MIN_MSGS)
    sessoes_ativas = {
        sid: info for sid, info in sessoes.items()
        if info["msgs"] >= MIN_MSGS_PARA_REPORTAR
    }

    if not sessoes_ativas:
        linhas.append("_Nenhuma sessão com atividade significativa hoje._")
        linhas.append("")
    else:
        linhas.append(f"*🖥️ {len(sessoes_ativas)} CONVERSA(S) ATIVAS HOJE:*")
        linhas.append("")

        for sid, info in sorted(sessoes_ativas.items(), key=lambda x: x[1]["first_ts"]):
            nome = info["nome"] or f"Conversa {sid[:8]}"

            first_time = datetime.fromtimestamp(info["first_ts"] / 1000, tz=SP_TZ).strftime("%H:%M")
            last_time = datetime.fromtimestamp(info["last_ts"] / 1000, tz=SP_TZ).strftime("%H:%M")

            linhas.append(f"*👤 {nome}*")
            linhas.append(f"  ⏰ {first_time} → {last_time} | {info['msgs']} interações")

            # Extrair trabalho real da sessão
            trabalhos = _extrair_trabalho_sessao(sid)
            resumo = _resumir_trabalhos(trabalhos)

            if resumo:
                for item in resumo:
                    linhas.append(f"  • {item}")
            else:
                # Fallback: mostrar primeiras mensagens do usuário
                for msg in info["user_messages"][:3]:
                    linhas.append(f"  💬 {msg[:100]}")

            linhas.append("")

    # ═══ ATIVIDADES MANUAIS (se houver) ═══
    atividades = get_atividades_hoje()
    if atividades:
        categorias: dict[str, list] = {}
        for a in atividades:
            cat = a.get("categoria", "geral")
            categorias.setdefault(cat, []).append(a)

        CAT_LABELS = {
            "dashboard": "Dashboard", "backend": "Backend AI",
            "teka": "Agente TEKA", "compras": "Compras",
            "pmo": "PMO", "comercial": "Comercial",
            "financeiro": "Financeiro", "infra": "Infraestrutura",
            "ia": "Setor IA", "geral": "Geral",
        }

        linhas.append(f"*📝 ATIVIDADES REGISTRADAS ({len(atividades)}):*")
        for cat, items in categorias.items():
            linhas.append(f"  *{CAT_LABELS.get(cat, cat.title())}:*")
            for item in items[:6]:
                linhas.append(f"    • {item['descricao']}")
            if len(items) > 6:
                linhas.append(f"    ... +{len(items) - 6} mais")
        linhas.append("")

    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("🔗 dashboard.parket.works")

    return "\n".join(linhas)


async def enviar_relatorio_diario():
    """Cron job: envia relatório diário no grupo Parket IA às 21h SP."""
    from app.core.evolution_client import evolution_client

    try:
        relatorio = formatar_relatorio_diario()

        if not relatorio.strip():
            logger.info("daily_report_empty")
            return

        await evolution_client.send_long_text(TI_GROUP_ID, relatorio)
        logger.info("daily_report_sent", chars=len(relatorio))
    except Exception as e:
        logger.error("daily_report_error", error=str(e), exc_info=True)
