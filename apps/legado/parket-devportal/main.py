"""
Parket Dev Portal — dev.parket.works
Terminal em tempo real com Claude + Preview staging + Deploy seguro.
Notificações WhatsApp + aprovação de deploy via grupo.
"""
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx, json, asyncio, subprocess, os, uuid, re, hashlib
from datetime import datetime

app = FastAPI(title="Parket Dev Portal")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk0MjUyNywiZXhwIjoyMDg4NTE4NTI3fQ.fTovVTCBFcMrrhVCR6TsneALfMRLLLHZdMmSJH16L4A"
H = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"}

# ── Evolution API (WhatsApp) ──
EVO_URL = "https://conect.parket.works"
EVO_INSTANCE = "Parket"
EVO_KEY = "4eab105201410d6865b86dca76ee9fa3"
GRUPO_IA_JID = "120363405979905444@g.us"

# Telefones dos admins que podem aprovar via WhatsApp
ADMIN_PHONES = ["5511939213329", "5511986750031"]
# Telefones que recebem notificação PRIVADA de deploys ALTO IMPACTO e precisam
# aprovar pessoalmente (não basta aprovação no grupo).
SUPERADMIN_PHONES = ["5511939213329", "5511986750031"]

# ── Policy: arquivos críticos (alto impacto) ──
# Qualquer edição/escrita que toque um desses paths relativos OU matche estes
# globs é classificada como HIGH. A lista é conservadora de propósito.
CRITICAL_FILE_PATTERNS = [
    # arquivos proibidos de mexer sem aprovação admin (já documentados no system prompt)
    "dept-layout.tsx", "sistema-ops-data.ts",
    # config / bootstrap / entrypoints
    "main.py", "config.ts", "config.tsx", "config.js",
    "App.tsx", "App.jsx", "index.tsx", "index.jsx", "main.tsx", "main.jsx",
    # libs compartilhadas
    "shared/", "lib/", "packages/",
    # dependências
    "package.json", "package-lock.json", "requirements.txt", "pnpm-lock.yaml", "yarn.lock",
    # auth / sessão
    "auth", "login", "session",
    # deploy / infra
    "deploy-", "Dockerfile", "docker-compose", "stack.yml", "nginx.conf",
    # ambiente / segredos
    ".env",
    # DB / migrations
    "migrations/", ".sql", "schema.sql",
]

def _heuristic_impact(files_touched: list[str], setor: str) -> tuple[str, list[str]]:
    """Piso heurístico — baseline conservador. O classificador Claude pode SUBIR
    o nível, mas nunca baixar disso. Se heurística marcou crítico, fica HIGH."""
    if not files_touched:
        return "LOW", []

    reasons: list[str] = []
    critical_hits: list[str] = []
    for path in files_touched:
        basename = os.path.basename(path)
        for pat in CRITICAL_FILE_PATTERNS:
            if pat in path or pat in basename:
                critical_hits.append(f"{basename} (crítico: {pat})")
                break

    if critical_hits:
        reasons.extend(critical_hits[:5])
        return "HIGH", reasons

    if setor:
        outside = [f for f in files_touched if f"/{setor}/" not in f and setor not in f]
        outside = [f for f in outside if "/root/" in f]
        if outside and len(outside) == len(files_touched):
            reasons.append(f"Todos os {len(outside)} arquivos estão fora do setor '{setor}'")
            return "HIGH", reasons

    n = len(files_touched)
    if n > 10:
        reasons.append(f"{n} arquivos alterados (>10)")
        return "HIGH", reasons
    if n >= 3:
        reasons.append(f"{n} arquivos alterados")
        return "MEDIUM", reasons
    return "LOW", []


async def classify_impact(files_touched: list[str], setor: str, app_name: str = "", app_path: str = "/root") -> tuple[str, list[str]]:
    """Classifica impacto do deploy. Análise = Claude + heurística em piso.
    - Heurística roda primeiro (rápida, barata).
    - Claude lê os arquivos pra julgar contextualmente o que mudou.
    - Nível final = max(heurística, Claude). Heurística nunca pode ser rebaixada."""
    heur_level, heur_reasons = _heuristic_impact(files_touched, setor)

    if not files_touched:
        return heur_level, heur_reasons

    files_bullets = "\n".join(f"- {f}" for f in files_touched[:40])
    prompt = f"""Você é um classificador de risco de deploy de um monorepo Parket. Se precisar, LEIA os arquivos pra entender o que mudou. Responda APENAS JSON válido no final, sem texto antes ou depois.

Contexto:
- App: {app_name or "desconhecido"}
- Setor esperado: {setor or "nenhum"}
- Diretório base: {app_path}

Arquivos alterados:
{files_bullets}

Níveis:
- "LOW": só estilo/copy/texto/ícones, 1-2 arquivos, dentro do setor, risco nulo fora dele
- "MEDIUM": lógica de componente/feature, 3-10 arquivos, setor isolado, risco limitado
- "HIGH": tocou infra/deploy/auth/DB/schema/rotas raiz/config global/shared/lib, OU >10 arquivos, OU cruza setores, OU pode quebrar área fora de "{setor}"

Responda APENAS: {{"level":"LOW|MEDIUM|HIGH","reasons":["motivo 1","motivo 2"]}}"""

    try:
        async with httpx.AsyncClient(timeout=90) as c:
            r = await c.post(
                f"{RUNNER_URL}/run",
                json={
                    "prompt": prompt,
                    "cwd": app_path,
                    "timeout": 60,
                    "allowed_tools": "Read,Grep,Glob",
                },
                headers={"Authorization": f"Bearer {RUNNER_SECRET}"},
            )
        if r.status_code == 200:
            out = (r.json().get("output") or "").strip()
            m = re.search(r"\{[\s\S]*\}", out)
            if m:
                parsed = json.loads(m.group(0))
                lvl = (parsed.get("level") or "").upper()
                if lvl not in ("LOW", "MEDIUM", "HIGH"):
                    lvl = heur_level
                claude_reasons = [str(x) for x in (parsed.get("reasons") or [])][:5]

                order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
                final_level = lvl if order.get(lvl, 0) >= order.get(heur_level, 0) else heur_level
                if heur_level == "HIGH" and heur_reasons:
                    merged = heur_reasons + [r for r in claude_reasons if r not in heur_reasons]
                    return final_level, merged[:5]
                return final_level, (claude_reasons or heur_reasons)[:5]
    except Exception as e:
        print(f"[impact] Claude falhou, usando heurística: {e}")

    return heur_level, heur_reasons


# Último impacto classificado por sessão — consumido no request_deploy
# {session_id: {"level": "HIGH"|"MEDIUM"|"LOW", "files": [...], "reasons": [...], "app": ..., "setor": ...}}
last_impact_by_session: dict[str, dict] = {}

APPS = {
    "dashboardparket": {
        "nome": "Dashboard Parket", "path": "/root/Dashboardparketapp", "icon": "📊",
        "build_cmd": "npm run build",
        "docker_image": "parket-dashboard",
        "service": "parket-dashboard_dashboard",
        "deploy_script": "/root/deploy-dashboard.sh",
    },
    "parket-draw": {
        "nome": "Draw Parket", "path": "/root/parket-draw", "icon": "✏️",
        "build_cmd": "npm run build",
        "docker_image": "parket-draw",
        "service": "parket-draw_draw",
    },
    "parket-ai-squad": {
        "nome": "AI Squad", "path": "/root/parket-ai-squad", "icon": "🤖",
        "docker_image": "parket-ai-backend",
        "service": "parket-ai-squad_backend",
    },
    "parket-skills": {
        "nome": "Parket Skills", "path": "/root/parket-skills", "icon": "📚",
        "docker_image": "parket-skills",
        "service": "parket-skills_skills",
    },
}

# Estado do preview
preview_state = {
    "status": "idle",
    "app": None,
    "message": "",
    "container_id": None,
    "started_at": None,
    "dev_email": None,
}

# Fila de aprovação de deploy pendente
# {deploy_id: {app, dev_email, ws_session, timestamp, status}}
pending_deploys: dict[str, dict] = {}

active_connections: dict[str, WebSocket] = {}
active_sessions: dict[str, dict] = {}  # token → {email, role, expires}
pending_2fa: dict[str, dict] = {}  # email → {code, expires, user, attempts}


# ── WhatsApp Helper ──

async def send_whatsapp(group_jid: str, text: str):
    """Envia mensagem para grupo WhatsApp via Evolution API."""
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            await c.post(
                f"{EVO_URL}/message/sendText/{EVO_INSTANCE}",
                headers={"Content-Type": "application/json", "apikey": EVO_KEY},
                json={"number": group_jid, "text": text}
            )
    except Exception as e:
        print(f"[WA] Erro ao enviar: {e}")


async def notify_action(dev_email: str, app_name: str, setor: str, action: str, details: str = ""):
    """Notifica no grupo Parket IA sobre ação do dev.
    Só notifica ações que envolvem mudanças reais (deploy, preview, aprovações).
    Comandos de leitura/consulta e edições de código são silenciosos."""
    # Ações silenciosas: edição de código e consultas — não notificar
    SILENT_ACTIONS = {"code_edit", "code_done"}
    if action in SILENT_ACTIONS:
        return

    app_info = APPS.get(app_name, {})
    app_nome = app_info.get("nome", app_name)
    timestamp = datetime.now().strftime("%H:%M")

    if action == "code_edit":
        return  # silencioso
    elif action == "code_done":
        return  # silencioso
    elif action == "preview_start":
        msg = (
            f"🔨 *Dev Portal — Build Preview*\n\n"
            f"👤 Dev: {dev_email}\n"
            f"📱 App: {app_nome}\n"
            f"⏰ {timestamp}\n\n"
            f"_Construindo imagem staging para validação..._"
        )
    elif action == "preview_ready":
        msg = (
            f"👁 *Dev Portal — Preview Pronto*\n\n"
            f"👤 Dev: {dev_email}\n"
            f"📱 App: {app_nome}\n"
            f"⏰ {timestamp}\n\n"
            f"✅ Preview disponível para validação.\n"
            f"{details}\n\n"
            f"_Aguardando aprovação para deploy..._"
        )
    elif action == "deploy_request":
        deploy_id = details
        msg = (
            f"🚀 *Dev Portal — SOLICITAÇÃO DE DEPLOY*\n\n"
            f"👤 Dev: {dev_email}\n"
            f"📱 App: {app_nome}\n"
            f"⏰ {timestamp}\n"
            f"🆔 Deploy: #{deploy_id[:8]}\n\n"
            f"⚠️ *Para aprovar, responda neste grupo:*\n"
            f"✅ *aprovar {deploy_id[:8]}*\n"
            f"❌ *negar {deploy_id[:8]}*\n\n"
            f"_Deploy aguardando aprovação (expira em 30min)..._"
        )
    elif action == "deploy_approved":
        msg = (
            f"✅ *Dev Portal — Deploy APROVADO*\n\n"
            f"📱 App: {app_nome}\n"
            f"👤 Aprovado por: {details}\n"
            f"⏰ {timestamp}\n\n"
            f"_Executando deploy para produção..._"
        )
    elif action == "deploy_done":
        msg = (
            f"🎉 *Dev Portal — Deploy Concluído*\n\n"
            f"📱 App: {app_nome}\n"
            f"👤 Dev: {dev_email}\n"
            f"⏰ {timestamp}\n\n"
            f"✅ Produção atualizada com sucesso!\n"
            f"{details}"
        )
    elif action == "deploy_denied":
        msg = (
            f"❌ *Dev Portal — Deploy NEGADO*\n\n"
            f"📱 App: {app_nome}\n"
            f"👤 Negado por: {details}\n"
            f"⏰ {timestamp}\n\n"
            f"_Deploy cancelado. Código permanece apenas em staging._"
        )
    elif action == "deploy_expired":
        msg = (
            f"⏰ *Dev Portal — Deploy EXPIRADO*\n\n"
            f"📱 App: {app_nome}\n"
            f"👤 Dev: {dev_email}\n"
            f"⏰ {timestamp}\n\n"
            f"_Ninguém aprovou em 30 minutos. Deploy cancelado._"
        )
    else:
        msg = f"🔔 *Dev Portal*\n{action}: {dev_email} — {app_nome}/{setor}\n{details}"

    await send_whatsapp(GRUPO_IA_JID, msg)


# ── Supabase Helper ──

async def sb(method, table, **kwargs):
    async with httpx.AsyncClient(timeout=10) as c:
        if method == "GET":
            r = await c.get(f"{SB_URL}/rest/v1/{table}", params=kwargs.get("params",{}), headers=H)
        elif method == "POST":
            r = await c.post(f"{SB_URL}/rest/v1/{table}", json=kwargs.get("data",{}), headers={**H, "Prefer": "return=representation"})
        elif method == "PATCH":
            r = await c.patch(f"{SB_URL}/rest/v1/{table}", params=kwargs.get("params",{}), json=kwargs.get("data",{}), headers={**H, "Prefer": "return=minimal"})
            return {"ok": True} if r.is_success else []
        elif method == "DELETE":
            r = await c.delete(f"{SB_URL}/rest/v1/{table}", params=kwargs.get("params",{}), headers=H)
            return {"ok": True} if r.is_success else []
        return r.json() if r.is_success else []


# ── REST API ──

def hash_senha(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()


import random

@app.post("/api/login")
async def do_login(request: Request):
    """Login com email + senha → envia código 2FA via WhatsApp."""
    body = await request.json()
    email = body.get("email", "").strip().lower()
    senha = body.get("senha", "")
    if not email or not senha:
        return JSONResponse({"error": "Email e senha obrigatórios"}, 400)

    rows = await sb("GET", "dev_workspace", params={"dev_email": f"eq.{email}", "select": "*"})
    if not rows:
        return JSONResponse({"error": "Acesso negado — usuário não cadastrado"}, 401)

    user = rows[0]
    stored_hash = user.get("senha_hash")
    if not stored_hash:
        return JSONResponse({"error": "Senha não configurada. Peça ao admin para definir sua senha."}, 401)

    if hash_senha(senha) != stored_hash:
        return JSONResponse({"error": "Senha incorreta"}, 401)

    telefone = user.get("telefone")
    if not telefone:
        return JSONResponse({"error": "Telefone não cadastrado. Peça ao admin para configurar seu número."}, 401)

    # Gerar código 2FA de 6 dígitos
    code = f"{random.randint(100000, 999999)}"
    pending_2fa[email] = {
        "code": code,
        "expires": datetime.now().timestamp() + 300,  # 5 minutos
        "user": user,
        "attempts": 0,
    }

    # Enviar código via WhatsApp
    phone_jid = f"{telefone}@s.whatsapp.net"
    await send_whatsapp(phone_jid, (
        f"🔐 *Parket Code — Verificação em 2 Passos*\n\n"
        f"Seu código de acesso:\n\n"
        f"*{code}*\n\n"
        f"Válido por 5 minutos.\n"
        f"Se não foi você, ignore esta mensagem."
    ))

    # Não retornar token ainda — precisa do 2FA
    user.pop("senha_hash", None)
    return {"step": "2fa", "message": "Código enviado para seu WhatsApp", "email": email, "dev_name": user.get("dev_name")}


@app.post("/api/verify-2fa")
async def verify_2fa(request: Request):
    """Verifica código 2FA e gera token de sessão."""
    body = await request.json()
    email = body.get("email", "").strip().lower()
    code = body.get("code", "").strip()

    if not email or not code:
        return JSONResponse({"error": "Email e código obrigatórios"}, 400)

    pending = pending_2fa.get(email)
    if not pending:
        return JSONResponse({"error": "Nenhum código pendente. Faça login novamente."}, 401)

    if pending["expires"] < datetime.now().timestamp():
        pending_2fa.pop(email, None)
        return JSONResponse({"error": "Código expirado. Faça login novamente."}, 401)

    pending["attempts"] += 1
    if pending["attempts"] > 5:
        pending_2fa.pop(email, None)
        return JSONResponse({"error": "Muitas tentativas. Faça login novamente."}, 401)

    if code != pending["code"]:
        remaining = 5 - pending["attempts"]
        return JSONResponse({"error": f"Código incorreto. {remaining} tentativas restantes."}, 401)

    # Código correto — gerar sessão
    user = pending["user"]
    pending_2fa.pop(email, None)

    token = uuid.uuid4().hex
    active_sessions[token] = {"email": email, "role": user.get("role"), "expires": datetime.now().timestamp() + 86400}

    await sb("PATCH", "dev_workspace", params={"dev_email": f"eq.{email}"}, data={"ultimo_login": datetime.now().isoformat()})

    user.pop("senha_hash", None)
    return {**user, "token": token}


@app.get("/api/me")
async def get_me(email: str = "", token: str = ""):
    """Valida sessão ativa."""
    session = active_sessions.get(token)
    if not session or session["expires"] < datetime.now().timestamp():
        return {"error": "Sessão expirada. Faça login novamente."}

    rows = await sb("GET", "dev_workspace", params={"dev_email": f"eq.{session['email']}", "select": "*"})
    if not rows:
        return {"error": "Usuário não encontrado"}
    user = rows[0]
    user.pop("senha_hash", None)
    return user

@app.get("/api/devs")
async def list_devs():
    return await sb("GET", "dev_workspace", params={"select": "*", "order": "dev_name"})

@app.post("/api/devs")
async def create_dev(request: Request):
    body = await request.json()
    # Hashear senha se fornecida
    if "senha" in body:
        body["senha_hash"] = hash_senha(body.pop("senha"))
    return await sb("POST", "dev_workspace", data=body)

@app.patch("/api/devs/{dev_id}")
async def update_dev(dev_id: str, request: Request):
    body = await request.json()
    if "senha" in body:
        body["senha_hash"] = hash_senha(body.pop("senha"))
    await sb("PATCH", "dev_workspace", params={"id": f"eq.{dev_id}"}, data=body)
    return {"ok": True}

@app.post("/api/devs/{dev_id}/reset-senha")
async def reset_senha(dev_id: str, request: Request):
    body = await request.json()
    nova_senha = body.get("senha", "")
    if not nova_senha or len(nova_senha) < 6:
        return JSONResponse({"error": "Senha deve ter no mínimo 6 caracteres"}, 400)
    await sb("PATCH", "dev_workspace", params={"id": f"eq.{dev_id}"}, data={"senha_hash": hash_senha(nova_senha)})
    return {"ok": True}

@app.delete("/api/devs/{dev_id}")
async def delete_dev(dev_id: str):
    await sb("DELETE", "dev_workspace", params={"id": f"eq.{dev_id}"})
    return {"ok": True}

@app.get("/api/chat/{dev_email}")
async def get_chat(dev_email: str, app_name: str = "", setor: str = "", since: str = "", limit: int = 400):
    """Busca histórico de chat do dev. Filtros opcionais: app, setor, data ISO.
    Usado pelo frontend pra recarregar conversa ao abrir o terminal — o chat
    fica persistido entre refreshes.

    Ordena DESC no Supabase pra pegar sempre os mais recentes dentro do limit,
    e devolve em ordem cronológica (ASC) pro frontend renderizar direto."""
    params = {
        "dev_email": f"eq.{dev_email}",
        "select": "*",
        "order": "created_at.desc",
        "limit": str(min(max(limit, 1), 1000)),
    }
    if app_name:
        params["app"] = f"eq.{app_name}"
    if setor:
        params["setor"] = f"eq.{setor}"
    if since:
        params["created_at"] = f"gte.{since}"
    rows = await sb("GET", "dev_chat", params=params) or []
    # Devolve em ordem cronológica (mais antigo primeiro) pro terminal pintar top→bottom
    return list(reversed(rows))


@app.get("/api/admin/daily-report")
async def daily_report(date: str = "", send_whatsapp: bool = False):
    """Gera relatório das conversas do dia agrupado por dev+app+setor.
    Cada grupo vira um bloco resumido pelo Claude. Se send_whatsapp=true,
    envia pro privado dos SUPERADMIN_PHONES."""
    report = await generate_daily_report(date)
    if send_whatsapp and report.get("ok"):
        await send_daily_report_whatsapp(report)
    return report

@app.get("/api/preview/status")
async def get_preview_status():
    return preview_state


# ── Webhook WhatsApp (aprovação de deploy) ──

@app.post("/api/webhook/devportal")
async def webhook_whatsapp(request: Request):
    """Recebe mensagens do WhatsApp para aprovar/negar deploys.
    Grupo Parket IA aprova qualquer nível de impacto. Superadmin também pode
    aprovar pelo privado (útil quando recebe a notificação direta)."""
    try:
        body = await request.json()
        data = body.get("data", {})
        message = data.get("message", {})
        msg_text = message.get("conversation", "") or message.get("extendedTextMessage", {}).get("text", "")
        sender = data.get("key", {}).get("participant", "") or data.get("key", {}).get("remoteJid", "")
        remote_jid = data.get("key", {}).get("remoteJid", "")

        if not msg_text:
            return {"ok": True}

        # Classifica origem: grupo Parket IA, privado de superadmin, ou outro (ignora)
        is_group = remote_jid == GRUPO_IA_JID
        sender_clean = re.sub(r"[^0-9]", "", (sender or remote_jid).split("@")[0])
        is_superadmin_private = (not is_group) and sender_clean in SUPERADMIN_PHONES

        if not (is_group or is_superadmin_private):
            return {"ok": True}

        msg_lower = msg_text.strip().lower()

        # Formatos: "aprovar abc12345" ou "negar abc12345"
        match_aprovar = re.match(r"^aprovar\s+([a-f0-9]{6,8})", msg_lower)
        match_negar = re.match(r"^negar\s+([a-f0-9]{6,8})", msg_lower)

        if match_aprovar:
            deploy_short = match_aprovar.group(1)
            await handle_deploy_decision(deploy_short, "approved", sender or remote_jid, via="private" if is_superadmin_private else "group")
        elif match_negar:
            deploy_short = match_negar.group(1)
            await handle_deploy_decision(deploy_short, "denied", sender or remote_jid, via="private" if is_superadmin_private else "group")

    except Exception as e:
        print(f"[Webhook] Erro: {e}")

    return {"ok": True}


async def handle_deploy_decision(deploy_short: str, decision: str, sender: str, via: str = "group"):
    """Processa aprovação ou negação de deploy.
    via='group' → só pode aprovar deploys que NÃO exigem superadmin.
    via='private' → aprovação de superadmin (válida pra qualquer impacto)."""
    # Encontrar o deploy pendente pelo ID curto
    target_deploy = None
    target_id = None
    for did, dinfo in pending_deploys.items():
        if did[:8].startswith(deploy_short) and dinfo["status"] == "pending":
            target_deploy = dinfo
            target_id = did
            break

    if not target_deploy:
        reply_to = GRUPO_IA_JID if via == "group" else f"{re.sub(r'[^0-9]','',sender.split('@')[0])}@s.whatsapp.net"
        await send_whatsapp(reply_to, f"⚠️ Deploy #{deploy_short} não encontrado ou já processado.")
        return

    # Extrair número limpo do sender
    sender_phone = re.sub(r"[^0-9]", "", sender.split("@")[0])
    sender_name = sender_phone

    if decision == "approved":
        target_deploy["status"] = "approved"
        target_deploy["approved_by"] = sender_name

        # Notificar no WhatsApp
        await notify_action(target_deploy["dev_email"], target_deploy["app"], "", "deploy_approved", sender_name)

        # Notificar o WebSocket do dev
        ws_id = target_deploy.get("ws_session")
        ws = active_connections.get(ws_id)
        if ws:
            try:
                await ws.send_json({"type": "line", "text": f"✅ Deploy APROVADO por {sender_name}!", "style": "success"})
                await ws.send_json({"type": "status", "text": "Executando deploy..."})
                # Executar o deploy
                await execute_deploy(ws, target_deploy["app"], target_deploy["dev_email"])
            except:
                pass

    elif decision == "denied":
        target_deploy["status"] = "denied"

        await notify_action(target_deploy["dev_email"], target_deploy["app"], "", "deploy_denied", sender_name)

        ws_id = target_deploy.get("ws_session")
        ws = active_connections.get(ws_id)
        if ws:
            try:
                await ws.send_json({"type": "line", "text": f"❌ Deploy NEGADO por {sender_name}.", "style": "error"})
                await ws.send_json({"type": "done", "text": "Deploy cancelado"})
            except:
                pass


# ── WebSocket Terminal ──

@app.websocket("/ws/terminal/{session_id}")
async def terminal_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    active_connections[session_id] = websocket

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "message":
                dev_email = data.get("dev_email", "")
                app_name = data.get("app", "dashboardparket")
                setor = data.get("setor", "")
                content = data.get("content", "")
                app_info = APPS.get(app_name, {})

                # ── Enforcement de escopo + role ──
                allowed, reason, user_row = await check_scope(dev_email, app_name, setor)
                if not allowed:
                    await websocket.send_json({"type": "error", "text": reason})
                    continue

                await sb("POST", "dev_chat", data={
                    "dev_email": dev_email, "app": app_name,
                    "setor": setor, "role": "user", "content": content
                })

                # Notificar WhatsApp que dev iniciou edição
                await notify_action(dev_email, app_name, setor, "code_edit", content)

                await websocket.send_json({"type": "status", "text": "Processando..."})
                app_path = app_info.get("path", "/root/Dashboardparketapp")
                user_role = (user_row or {}).get("role", "dev")
                await run_claude_command(websocket, content, app_path, setor, dev_email, app_name, session_id, user_role)

            elif action == "command":
                # Shell removido do frontend — backend rejeita pra evitar bypass
                await websocket.send_json({"type": "error", "text": "Shell foi desabilitado. Use a IA."})

            elif action == "preview":
                app_name = data.get("app", "dashboardparket")
                dev_email = data.get("dev_email", "")

                allowed, reason, user_row = await check_scope(dev_email, app_name, None)
                if not allowed:
                    await websocket.send_json({"type": "error", "text": reason})
                    continue
                if (user_row or {}).get("role") == "user":
                    await websocket.send_json({"type": "error", "text": "Seu perfil não pode executar Build Preview."})
                    continue

                await run_preview_build(websocket, app_name, dev_email)

            elif action == "deploy":
                app_name = data.get("app", "dashboardparket")
                dev_email = data.get("dev_email", "")

                allowed, reason, user_row = await check_scope(dev_email, app_name, None)
                if not allowed:
                    await websocket.send_json({"type": "error", "text": reason})
                    continue
                user_role = (user_row or {}).get("role", "dev")
                if user_role == "user":
                    await websocket.send_json({"type": "error", "text": "Seu perfil não pode solicitar Deploy."})
                    continue

                await request_deploy(websocket, app_name, dev_email, user_role, session_id)

            elif action == "deploy_direct":
                # Admin/superadmin pula Build Preview: builda staging + deploy direto
                app_name = data.get("app", "dashboardparket")
                dev_email = data.get("dev_email", "")

                allowed, reason, user_row = await check_scope(dev_email, app_name, None)
                if not allowed:
                    await websocket.send_json({"type": "error", "text": reason})
                    continue
                user_role = (user_row or {}).get("role", "dev")
                if user_role not in ("admin", "superadmin"):
                    await websocket.send_json({"type": "error", "text": "Apenas admin/superadmin pode fazer deploy direto."})
                    continue

                await run_deploy_direct(websocket, app_name, dev_email, user_role, session_id)

    except WebSocketDisconnect:
        active_connections.pop(session_id, None)
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "text": str(e)})
        except:
            pass
        active_connections.pop(session_id, None)


RUNNER_URL = os.environ.get("RUNNER_URL", "http://172.18.0.1:9191")
RUNNER_SECRET = os.environ.get("RUNNER_SECRET", "ti-runner-secret-parket")


# ── Scope enforcement ──

async def check_scope(dev_email: str, app_name: str, setor: str | None):
    """Valida se o dev pode operar no app/setor. Retorna (allowed, reason, user_row).
    superadmin/admin passam por cima do escopo — dev e user precisam estar na lista."""
    if not dev_email:
        return False, "Email do dev ausente.", None

    rows = await sb("GET", "dev_workspace", params={"dev_email": f"eq.{dev_email}", "select": "*"})
    if not rows:
        return False, "Usuário não cadastrado.", None

    user = rows[0]
    if not user.get("ativo", True):
        return False, "Seu acesso foi desativado.", user

    role = user.get("role", "dev")
    # superadmin e admin não têm trava de escopo
    if role in ("superadmin", "admin"):
        return True, "", user

    apps = user.get("apps_permitidos") or []
    setores = user.get("setores_permitidos") or []

    if app_name not in apps:
        return False, f"Você não tem acesso ao app '{app_name}'.", user

    if setor and setores and setor not in setores:
        return False, f"Você não tem acesso ao setor '{setor}'.", user

    return True, "", user


# Tools liberadas por perfil. role=user é 100% read-only — não escreve nada,
# não roda Bash (pra não contornar via script). Só pode consultar e explicar.
TOOLS_BY_ROLE = {
    "user": "Read,Grep,Glob,WebFetch",
    "dev": "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch",
    "admin": "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch",
    "superadmin": "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch",
}


async def run_claude_command(ws, prompt, cwd, setor, dev_email, app_name, session_id, user_role="dev"):
    """Executa Claude Code via claude-runner (stream) e emite eventos
    estruturados pro frontend renderizar como conversa (assistant/tool/result).
    user_role determina o conjunto de ferramentas — 'user' é read-only."""
    is_readonly = user_role == "user"
    allowed_tools = TOOLS_BY_ROLE.get(user_role, TOOLS_BY_ROLE["dev"])

    if is_readonly:
        system_context = f"""Você está ajudando um usuário OPERACIONAL no app {app_name}, setor {setor}.
Diretório: {cwd}
PERFIL: consulta / leitura apenas.
REGRAS:
- Você NÃO pode alterar arquivos. Só pode ler, buscar e explicar.
- Se o usuário pedir uma mudança, responda sugerindo o que ele deve pedir a um dev do setor.
- Foque em ajudar com o setor {setor} do app {app_name}."""
    else:
        system_context = f"""Você está trabalhando no app {app_name}, setor {setor}.
Diretório: {cwd}
REGRAS:
- Só altere arquivos do setor {setor}
- NUNCA altere dept-layout.tsx ou sistema-ops-data.ts sem permissão admin
- NUNCA faça docker build -t parket-dashboard:latest
- NUNCA faça docker service update
- Após finalizar, faça git add e git commit das alterações
- Teste suas alterações antes de confirmar"""

    full_prompt = f"{system_context}\n\nSolicitação do {('usuário' if is_readonly else 'dev')}: {prompt}"

    # Sinaliza início — sem poluir o chat com logs de diretório
    await ws.send_json({"type": "status", "text": "Claude está pensando..."})

    files_changed: list[str] = []
    assistant_texts: list[str] = []
    final_result_text: str | None = None

    def register_files_from_tool(tool_name: str, tool_input: dict):
        """Extrai paths de arquivos tocados por Edit/Write/NotebookEdit."""
        if not isinstance(tool_input, dict):
            return
        if tool_name in ("Edit", "Write", "NotebookEdit", "MultiEdit"):
            p = tool_input.get("file_path") or tool_input.get("notebook_path")
            if p and isinstance(p, str):
                files_changed.append(p)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(300, connect=10)) as client:
            async with client.stream(
                "POST",
                f"{RUNNER_URL}/run-stream",
                json={
                    "prompt": full_prompt,
                    "cwd": cwd,
                    "timeout": 240,
                    "allowed_tools": allowed_tools,
                },
                headers={"Authorization": f"Bearer {RUNNER_SECRET}"},
            ) as resp:
                if resp.status_code != 200:
                    await ws.send_json({"type": "error", "text": f"Runner HTTP {resp.status_code}"})
                    await ws.send_json({"type": "done", "text": f"Erro: Runner HTTP {resp.status_code}"})
                    return

                async for raw_line in resp.aiter_lines():
                    if not raw_line:
                        continue
                    try:
                        evt = json.loads(raw_line)
                    except Exception:
                        # NDJSON malformado — ignora silenciosamente pra não poluir o chat
                        continue

                    etype = evt.get("type")

                    # Sentinela final do runner
                    if etype == "_done":
                        exit_code = evt.get("exit_code", 0)
                        if exit_code != 0:
                            await ws.send_json({
                                "type": "line",
                                "text": f"Claude encerrou com código {exit_code}",
                                "style": "warn",
                            })
                        continue

                    if etype == "_error":
                        await ws.send_json({"type": "error", "text": evt.get("error", "Erro no runner")})
                        continue

                    # system/init — pula, não polui o chat
                    if etype == "system":
                        continue

                    # assistant: pode conter text, tool_use ou thinking
                    if etype == "assistant":
                        msg = evt.get("message", {}) or {}
                        for block in msg.get("content", []) or []:
                            btype = block.get("type")
                            if btype == "text":
                                text = block.get("text", "").strip()
                                if text:
                                    assistant_texts.append(text)
                                    await ws.send_json({"type": "assistant", "text": text})
                                    # Persiste cada bloco de texto — assim o histórico
                                    # reflete a conversa real, não só a última linha.
                                    await sb("POST", "dev_chat", data={
                                        "dev_email": dev_email, "app": app_name,
                                        "setor": setor, "role": "assistant",
                                        "content": text[:2000],
                                    })
                            elif btype == "thinking":
                                thinking = block.get("thinking", "").strip()
                                if thinking:
                                    await ws.send_json({"type": "thinking", "text": thinking})
                            elif btype == "tool_use":
                                tname = block.get("name", "tool")
                                tinput = block.get("input", {}) or {}
                                register_files_from_tool(tname, tinput)
                                await ws.send_json({
                                    "type": "tool",
                                    "tool": tname,
                                    "input": tinput,
                                })
                                # Persiste tool_use de forma compacta pra dar
                                # rastro no histórico (sem explodir a linha).
                                try:
                                    tool_snippet = json.dumps({"tool": tname, "input": tinput})[:1000]
                                except Exception:
                                    tool_snippet = f'{{"tool":"{tname}"}}'
                                await sb("POST", "dev_chat", data={
                                    "dev_email": dev_email, "app": app_name,
                                    "setor": setor, "role": "tool",
                                    "content": tool_snippet,
                                })
                        continue

                    # user: tool_result
                    if etype == "user":
                        msg = evt.get("message", {}) or {}
                        for block in msg.get("content", []) or []:
                            if block.get("type") == "tool_result":
                                content = block.get("content", "")
                                # content pode ser string ou lista de blocos
                                if isinstance(content, list):
                                    content = "\n".join(
                                        c.get("text", "") for c in content
                                        if isinstance(c, dict) and c.get("type") == "text"
                                    )
                                content = (content or "").strip()
                                is_error = block.get("is_error", False)
                                if content:
                                    # Trunca pra não encher o chat de saída enorme
                                    truncated = content if len(content) < 1200 else content[:1200] + "\n… (truncado)"
                                    await ws.send_json({
                                        "type": "result",
                                        "text": truncated,
                                        "is_error": is_error,
                                    })
                        continue

                    # result: resumo final do Claude
                    if etype == "result":
                        final_result_text = evt.get("result") or ""
                        continue

        # Fallback: se não veio nenhum bloco de texto do assistente mas veio um result,
        # mostra o result como mensagem final (acontece em respostas curtas).
        if not assistant_texts and final_result_text:
            await ws.send_json({"type": "assistant", "text": final_result_text.strip()})

        # Dedup de arquivos mantendo ordem
        seen = set()
        unique_files = []
        for f in files_changed:
            if f not in seen:
                seen.add(f)
                unique_files.append(f)

        # Classifica impacto (Claude analisa + heurística como piso) e guarda
        # na sessão — o request_deploy consome isso pra notificação privada.
        if unique_files:
            await ws.send_json({"type": "status", "text": "Analisando impacto do deploy..."})
        impact_level, impact_reasons = await classify_impact(unique_files, setor, app_name, cwd)
        last_impact_by_session[session_id] = {
            "level": impact_level,
            "files": unique_files,
            "reasons": impact_reasons,
            "app": app_name,
            "setor": setor,
        }

        # Card de resumo compacto (só se houve ação real)
        if unique_files:
            await ws.send_json({
                "type": "summary",
                "files": unique_files[:20],
                "count": len(unique_files),
                "impact": impact_level,
                "impact_reasons": impact_reasons,
            })

        # Notificar WhatsApp com resumo
        files_str = "\n".join(f"  • {f}" for f in unique_files[:10]) if unique_files else "Nenhum arquivo alterado"
        summary_msg = f"Arquivos alterados:\n{files_str}"
        if unique_files:
            summary_msg += f"\n\nImpacto: {impact_level}"
            if impact_reasons:
                summary_msg += f" — {impact_reasons[0]}"
        preview_text = "\n\n".join(assistant_texts)[:300] or (final_result_text or "")[:300]
        if preview_text:
            summary_msg += f"\n\nResumo: {preview_text}"
        await notify_action(dev_email, app_name, setor, "code_done", summary_msg)

        # Política pós-run:
        # - user: read-only, não avança
        # - admin/superadmin: deploy direto automático (build + deploy), sem
        #   botão de decisão. HIGH impact continua indo pro grupo de qualquer
        #   forma via request_deploy.
        # - dev: oferece Build Preview pra validar antes
        can_advance = bool(unique_files) and user_role != "user"
        auto_deploy = can_advance and user_role in ("admin", "superadmin")

        # Linha final de summary — antes do deploy, pra já ficar rastreada
        if unique_files:
            summary_row = f"[summary] impacto={impact_level} arquivos={len(unique_files)}: " + ", ".join(unique_files[:6])
            await sb("POST", "dev_chat", data={
                "dev_email": dev_email, "app": app_name,
                "setor": setor, "role": "summary",
                "content": summary_row[:1000],
            })

        if auto_deploy:
            await ws.send_json({
                "type": "done",
                "text": f"Pronto — iniciando deploy direto ({user_role})...",
            })
            await run_deploy_direct(ws, app_name, dev_email, user_role, session_id)
        else:
            await ws.send_json({
                "type": "done",
                "text": "Pronto — use 'Build Preview' pra testar." if can_advance else "Pronto.",
            })
            if can_advance:
                await ws.send_json({"type": "offer_preview", "app": app_name})

    except httpx.TimeoutException:
        await ws.send_json({"type": "error", "text": "Timeout — Claude demorou mais de 4 minutos."})
        await ws.send_json({"type": "done", "text": "Erro: Timeout no processamento"})

    except httpx.ConnectError:
        await ws.send_json({"type": "error", "text": "Claude Runner não acessível."})
        await ws.send_json({"type": "done", "text": "Erro: Runner offline"})

    except Exception as e:
        await ws.send_json({"type": "error", "text": f"Erro: {str(e)}"})


async def build_staging_image(ws, app_info) -> bool:
    """Executa npm run build (se houver) + docker build da imagem staging.
    Retorna True se sucesso. Usado tanto pelo Build Preview quanto pelo Deploy
    Direto (admin) que pula o container de preview."""
    app_path = app_info["path"]
    docker_image = app_info.get("docker_image", "")
    staging_tag = f"{docker_image}:staging"

    build_cmd = app_info.get("build_cmd")
    if build_cmd:
        await ws.send_json({"type": "line", "text": f"📦 {build_cmd}", "style": "cmd"})
        proc = await asyncio.create_subprocess_shell(
            build_cmd, cwd=app_path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
        )
        async for line in proc.stdout:
            t = line.decode("utf-8", errors="replace").rstrip()
            if t:
                await ws.send_json({"type": "line", "text": t, "style": "output"})
        if await proc.wait() != 0:
            await ws.send_json({"type": "error", "text": "❌ Build falhou"})
            return False

    dockerfile = "Dockerfile.patch" if os.path.exists(os.path.join(app_path, "Dockerfile.patch")) else "Dockerfile"
    build_cmd_docker = f"docker build -f {dockerfile} -t {staging_tag} ."
    await ws.send_json({"type": "line", "text": f"🐳 {build_cmd_docker}", "style": "cmd"})
    proc = await asyncio.create_subprocess_shell(
        build_cmd_docker, cwd=app_path,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
    )
    async for line in proc.stdout:
        t = line.decode("utf-8", errors="replace").rstrip()
        if t:
            await ws.send_json({"type": "line", "text": t, "style": "output"})
    if await proc.wait() != 0:
        await ws.send_json({"type": "error", "text": "❌ Docker build falhou"})
        return False
    return True


async def run_deploy_direct(ws, app_name, dev_email, role, session_id):
    """Deploy direto: build da imagem staging + execute_deploy, sem container
    de preview intermediário. Só admin/superadmin pode chamar. HIGH impact
    continua indo pro grupo — role não burla o rastro."""
    if role not in ("admin", "superadmin"):
        await ws.send_json({"type": "error", "text": "Apenas admin/superadmin pode fazer deploy direto."})
        return

    app_info = APPS.get(app_name)
    if not app_info:
        await ws.send_json({"type": "error", "text": f"App desconhecido: {app_name}"})
        return

    await ws.send_json({"type": "line", "text": "", "style": "dim"})
    await ws.send_json({"type": "line", "text": "⚡ DEPLOY DIRETO (sem preview)", "style": "accent"})
    await ws.send_json({"type": "status", "text": "Construindo imagem staging..."})

    ok = await build_staging_image(ws, app_info)
    if not ok:
        await ws.send_json({"type": "done", "text": "Build falhou — deploy abortado"})
        return

    # Agora segue o fluxo normal de deploy (respeita HIGH impact, etc)
    await request_deploy(ws, app_name, dev_email, role, session_id)


async def run_preview_build(ws, app_name, dev_email):
    """Build da imagem staging e roda preview container."""
    global preview_state
    app_info = APPS.get(app_name)
    if not app_info:
        await ws.send_json({"type": "error", "text": f"App desconhecido: {app_name}"})
        return

    app_path = app_info["path"]
    docker_image = app_info.get("docker_image", "")
    if not docker_image:
        await ws.send_json({"type": "error", "text": f"App {app_name} não tem imagem Docker configurada"})
        return

    staging_tag = f"{docker_image}:staging"
    timestamp = datetime.now().strftime("%Y%m%d%H%M")

    preview_state = {"status": "building", "app": app_name, "message": "Construindo...", "container_id": None, "started_at": timestamp, "dev_email": dev_email}

    # Notificar WhatsApp
    await notify_action(dev_email, app_name, "", "preview_start")

    await ws.send_json({"type": "line", "text": "", "style": "dim"})
    await ws.send_json({"type": "line", "text": "🔨 PREVIEW BUILD", "style": "accent"})
    await ws.send_json({"type": "line", "text": f"App: {app_info['nome']} | Imagem: {staging_tag}", "style": "dim"})
    await ws.send_json({"type": "status", "text": "Construindo imagem staging..."})

    try:
        # Steps 1-2: build da aplicação + imagem Docker (helper compartilhado)
        ok = await build_staging_image(ws, app_info)
        if not ok:
            preview_state["status"] = "error"
            return

        # Step 3: Limpar preview anterior
        await asyncio.create_subprocess_shell("docker rm -f parket-preview 2>/dev/null", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)

        # Step 4: Rodar preview
        await ws.send_json({"type": "line", "text": "🚀 Iniciando preview na porta 9090...", "style": "cmd"})
        proc = await asyncio.create_subprocess_exec(
            "docker", "run", "-d", "--name", "parket-preview", "--network", "network_public", "-p", "9090:80", staging_tag,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        container_id = stdout.decode().strip()[:12]
        if proc.returncode != 0:
            preview_state["status"] = "error"
            await ws.send_json({"type": "error", "text": f"❌ Erro: {stderr.decode()}"})
            return

        await asyncio.sleep(3)

        preview_state = {"status": "ready", "app": app_name, "message": f"Container {container_id}", "container_id": container_id, "started_at": timestamp, "dev_email": dev_email}

        host_ip = os.popen("hostname -I").read().strip().split()[0]
        preview_url = f"http://{host_ip}:9090"

        # Notificar WhatsApp
        await notify_action(dev_email, app_name, "", "preview_ready", f"🔗 {preview_url}")

        await ws.send_json({"type": "line", "text": "", "style": "dim"})
        await ws.send_json({"type": "line", "text": "✅ Preview pronto!", "style": "success"})
        await ws.send_json({"type": "line", "text": f"🔗 {preview_url}", "style": "accent"})
        await ws.send_json({"type": "done", "text": "Valide e clique Deploy para produção."})
        await ws.send_json({"type": "offer_deploy", "app": app_name})

    except Exception as e:
        preview_state["status"] = "error"
        await ws.send_json({"type": "error", "text": f"Erro: {str(e)}"})


async def request_deploy(ws, app_name, dev_email, role, session_id):
    """Solicita deploy — envia pedido de aprovação via WhatsApp.
    Fluxo padrão: grupo aprova. Se HIGH impact, o superadmin recebe uma
    notificação PRIVADA paralela com detalhes pra ele ficar ciente — mas o
    fluxo de aprovação pelo grupo continua igual."""
    deploy_id = uuid.uuid4().hex[:12]
    impact = last_impact_by_session.get(session_id) or {"level": "LOW", "files": [], "reasons": []}
    level = impact["level"]

    await ws.send_json({"type": "line", "text": "", "style": "dim"})
    await ws.send_json({"type": "line", "text": "🚀 SOLICITAÇÃO DE DEPLOY", "style": "accent"})
    impact_emoji = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🔴"}.get(level, "⚪")
    await ws.send_json({"type": "line", "text": f"{impact_emoji} Impacto: {level}", "style": "warn" if level == "HIGH" else ("accent" if level == "MEDIUM" else "dim")})
    if impact["reasons"]:
        await ws.send_json({"type": "line", "text": " • " + " | ".join(impact["reasons"][:3]), "style": "dim"})

    # Política de auto-deploy (aprovação automática, sem passar pelo grupo):
    #   - superadmin e admin: qualquer app, desde que impacto != HIGH
    # HIGH continua indo pro grupo em qualquer caso — rastro obrigatório +
    # notificação privada pros superadmins.
    if role in ("superadmin", "admin") and level != "HIGH":
        who = "Superadmin" if role == "superadmin" else "Admin"
        icon = "👑" if role == "superadmin" else "🛠"
        await ws.send_json({"type": "line", "text": f"{icon} {who} — aprovação automática.", "style": "success"})
        await notify_action(dev_email, app_name, "", "deploy_approved", f"{dev_email} ({role})")
        await ws.send_json({"type": "status", "text": "Executando deploy..."})
        await execute_deploy(ws, app_name, dev_email)
        return

    # Fluxo padrão (LOW/MEDIUM/HIGH): grupo aprova
    pending_deploys[deploy_id] = {
        "app": app_name,
        "dev_email": dev_email,
        "ws_session": session_id,
        "timestamp": datetime.now().isoformat(),
        "status": "pending",
        "impact": impact,
    }

    await ws.send_json({"type": "line", "text": f"🆔 Deploy ID: #{deploy_id[:8]}", "style": "dim"})
    await ws.send_json({"type": "line", "text": "📱 Pedido de aprovação enviado no WhatsApp (grupo Parket IA)", "style": "accent"})
    await ws.send_json({"type": "line", "text": "Aguardando resposta do admin...", "style": "dim"})
    await ws.send_json({"type": "status", "text": "Aguardando aprovação via WhatsApp..."})

    # Notificação do grupo (fluxo normal)
    await notify_action(dev_email, app_name, "", "deploy_request", deploy_id)

    # HIGH impact → notifica superadmin no PRIVADO também (ciência, não bloqueia)
    if level == "HIGH":
        files_list = "\n".join(f"  • {f}" for f in impact["files"][:8])
        reasons_list = "\n".join(f"  • {r}" for r in (impact["reasons"] or [])[:5]) or "  • (sem detalhes)"
        msg_private = (
            f"🔴 *ALERTA — Deploy de ALTO IMPACTO*\n\n"
            f"👤 Dev: {dev_email}\n"
            f"📱 App: {APPS.get(app_name,{}).get('nome',app_name)}\n"
            f"🆔 Deploy: #{deploy_id[:8]}\n\n"
            f"*Motivos:*\n{reasons_list}\n\n"
            f"*Arquivos ({len(impact['files'])}):*\n{files_list}"
            + ("\n  • …" if len(impact['files']) > 8 else "")
            + f"\n\n_Aprovação segue pelo grupo Parket IA. Esta notificação é só pra sua ciência._"
        )
        for phone in SUPERADMIN_PHONES:
            jid = f"{phone}@s.whatsapp.net"
            await send_whatsapp(jid, msg_private)

    asyncio.create_task(deploy_timeout(deploy_id, app_name, dev_email, session_id))


async def deploy_timeout(deploy_id: str, app_name: str, dev_email: str, session_id: str):
    """Expira deploy pendente após 30 minutos."""
    await asyncio.sleep(30 * 60)
    deploy = pending_deploys.get(deploy_id)
    if deploy and deploy["status"] == "pending":
        deploy["status"] = "expired"
        await notify_action(dev_email, app_name, "", "deploy_expired")

        ws = active_connections.get(session_id)
        if ws:
            try:
                await ws.send_json({"type": "line", "text": "⏰ Aprovação expirou (30min). Deploy cancelado.", "style": "warn"})
                await ws.send_json({"type": "done", "text": "Deploy expirado"})
            except:
                pass


async def execute_deploy(ws, app_name, dev_email):
    """Executa o deploy efetivo."""
    global preview_state
    app_info = APPS.get(app_name)
    if not app_info:
        await ws.send_json({"type": "error", "text": f"App desconhecido: {app_name}"})
        return

    docker_image = app_info.get("docker_image", "")
    staging_tag = f"{docker_image}:staging"
    service_name = app_info.get("service", "")
    deploy_script = app_info.get("deploy_script", "")
    timestamp = datetime.now().strftime("%Y%m%d%H%M")

    await ws.send_json({"type": "line", "text": "🚀 EXECUTANDO DEPLOY", "style": "accent"})

    try:
        if deploy_script and os.path.exists(deploy_script):
            await ws.send_json({"type": "line", "text": f"📜 Script: {deploy_script} {staging_tag}", "style": "cmd"})
            proc = await asyncio.create_subprocess_shell(
                f"echo s | {deploy_script} {staging_tag}",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
            )
            async for line in proc.stdout:
                t = line.decode("utf-8", errors="replace").rstrip()
                if t:
                    await ws.send_json({"type": "line", "text": t, "style": "output"})
            if await proc.wait() != 0:
                await ws.send_json({"type": "error", "text": "❌ Deploy falhou"})
                return
        else:
            # Backup
            await ws.send_json({"type": "line", "text": f"💾 Backup: {docker_image}:latest → :pre-deploy-{timestamp}", "style": "cmd"})
            proc = await asyncio.create_subprocess_shell(f"docker tag {docker_image}:latest {docker_image}:pre-deploy-{timestamp} 2>/dev/null; echo ok", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await proc.communicate()

            # Verificar staging
            proc = await asyncio.create_subprocess_exec("docker", "image", "inspect", staging_tag, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await proc.communicate()
            if proc.returncode != 0:
                await ws.send_json({"type": "error", "text": f"❌ Imagem {staging_tag} não encontrada. Faça Build Preview primeiro."})
                return

            # Tag
            await ws.send_json({"type": "line", "text": f"🏷 {staging_tag} → {docker_image}:latest", "style": "cmd"})
            proc = await asyncio.create_subprocess_shell(f"docker tag {staging_tag} {docker_image}:latest", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await proc.communicate()

            # Update service
            if service_name:
                await ws.send_json({"type": "line", "text": f"🔄 Atualizando: {service_name}", "style": "cmd"})
                proc = await asyncio.create_subprocess_shell(
                    f"docker service update --force {service_name}",
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
                )
                async for line in proc.stdout:
                    t = line.decode("utf-8", errors="replace").rstrip()
                    if t:
                        await ws.send_json({"type": "line", "text": t, "style": "output"})
                if await proc.wait() != 0:
                    await ws.send_json({"type": "line", "text": f"⚠️ Rollback para pre-deploy-{timestamp}...", "style": "warn"})
                    await asyncio.create_subprocess_shell(f"docker tag {docker_image}:pre-deploy-{timestamp} {docker_image}:latest && docker service update --force {service_name}", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                    await ws.send_json({"type": "error", "text": "❌ Deploy falhou. Rollback executado."})
                    return

        # Limpar preview
        await asyncio.create_subprocess_shell("docker rm -f parket-preview 2>/dev/null", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        preview_state = {"status": "idle", "app": None, "message": "", "container_id": None, "started_at": None, "dev_email": None}

        await ws.send_json({"type": "line", "text": "", "style": "dim"})
        await ws.send_json({"type": "line", "text": "✅ Deploy concluído! Produção atualizada.", "style": "success"})
        await ws.send_json({"type": "line", "text": f"💾 Backup: {docker_image}:pre-deploy-{timestamp}", "style": "dim"})
        await ws.send_json({"type": "done", "text": "Deploy realizado com sucesso"})

        # Notificar WhatsApp
        await notify_action(dev_email, app_name, "", "deploy_done", f"Backup: {docker_image}:pre-deploy-{timestamp}")

        await sb("POST", "dev_deploys", data={
            "dev_email": dev_email, "app": app_name,
            "status": "success", "details": f"Deploy staging→latest. Backup: pre-deploy-{timestamp}"
        })

    except Exception as e:
        await ws.send_json({"type": "error", "text": f"Erro: {str(e)}"})


async def run_shell_command(ws, cmd, cwd):
    """Executa comando shell e streama output."""
    blocked = ["rm -rf /", "docker tag.*latest", "docker build.*latest", "docker service update"]
    for pattern in blocked:
        if re.search(pattern, cmd):
            await ws.send_json({"type": "error", "text": f"⛔ Comando bloqueado: {cmd}"})
            return

    await ws.send_json({"type": "line", "text": f"$ {cmd}", "style": "cmd"})
    try:
        process = await asyncio.create_subprocess_shell(
            cmd, cwd=cwd,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
        )
        async for line in process.stdout:
            text = line.decode("utf-8", errors="replace").rstrip()
            if text:
                await ws.send_json({"type": "line", "text": text, "style": "output"})
        code = await process.wait()
        await ws.send_json({"type": "done", "text": f"Exit code: {code}", "style": "success" if code == 0 else "error"})
    except Exception as e:
        await ws.send_json({"type": "error", "text": str(e)})


# ── Relatório diário ──

async def generate_daily_report(date_iso: str = "") -> dict:
    """Agrega dev_chat do dia, agrupa por (dev_email, app, setor) e pede ao
    Claude um resumo por grupo. Retorna estrutura serializável.
    date_iso = YYYY-MM-DD. Default = hoje (America/Sao_Paulo)."""
    from datetime import timedelta, timezone
    tz = timezone(timedelta(hours=-3))  # America/Sao_Paulo, sem DST por simplicidade

    if date_iso:
        try:
            base = datetime.fromisoformat(date_iso).replace(tzinfo=tz)
        except Exception:
            return {"ok": False, "error": f"data inválida: {date_iso}"}
    else:
        base = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)

    start = base.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    rows = await sb("GET", "dev_chat", params={
        "select": "*",
        "created_at": f"gte.{start.isoformat()}",
        "order": "created_at",
        "limit": "2000",
    })
    # Supabase REST não aceita 2 filtros no mesmo campo via params simples.
    # Filtra "end" em memória — pool de 2000 é suficiente pra um dia.
    rows = [r for r in (rows or []) if r.get("created_at") and r["created_at"] < end.isoformat()]

    if not rows:
        return {"ok": True, "date": start.date().isoformat(), "groups": [], "note": "Nenhuma interação hoje"}

    # Agrupa por (dev_email, app, setor)
    groups: dict[tuple[str, str, str], list[dict]] = {}
    for r in rows:
        k = (r.get("dev_email") or "?", r.get("app") or "?", r.get("setor") or "")
        groups.setdefault(k, []).append(r)

    # Resume cada grupo via Claude
    summarized = []
    for (dev_email, app_name, setor), msgs in groups.items():
        transcript_lines = []
        for m in msgs[:80]:  # teto por grupo pra caber no prompt
            role = m.get("role", "?")
            content = (m.get("content") or "").replace("\n", " ")[:400]
            hhmm = (m.get("created_at") or "")[11:16]
            transcript_lines.append(f"[{hhmm}] {role}: {content}")
        transcript = "\n".join(transcript_lines)

        prompt = f"""Resuma em 3-5 bullets curtos (máx 12 palavras cada) o que este dev/user fez hoje no devportal.

Dev: {dev_email}
App: {app_name}
Setor: {setor or "(nenhum)"}
Total de mensagens: {len(msgs)}

Transcrição:
{transcript}

Responda APENAS texto corrido em bullets começando com "- ". Foco em: o que foi pedido, o que foi feito, arquivos principais tocados, se houve deploy."""
        summary = ""
        try:
            async with httpx.AsyncClient(timeout=90) as c:
                r = await c.post(
                    f"{RUNNER_URL}/run",
                    json={"prompt": prompt, "cwd": "/root", "timeout": 60, "allowed_tools": "Read,Grep,Glob"},
                    headers={"Authorization": f"Bearer {RUNNER_SECRET}"},
                )
            if r.status_code == 200:
                summary = (r.json().get("output") or "").strip()[:800]
        except Exception as e:
            summary = f"(falha ao resumir: {e})"

        summarized.append({
            "dev_email": dev_email,
            "app": app_name,
            "setor": setor,
            "msg_count": len(msgs),
            "first_at": msgs[0].get("created_at"),
            "last_at": msgs[-1].get("created_at"),
            "summary": summary or "(sem resumo)",
        })

    return {"ok": True, "date": start.date().isoformat(), "groups": summarized}


async def send_daily_report_whatsapp(report: dict):
    """Envia o relatório do dia no grupo Parket IA (Squad IA).
    Grupo é o canal oficial — fica visível pra todos que acompanham a IA."""
    if not report.get("ok"):
        return
    groups = report.get("groups", [])
    if not groups:
        msg = f"📊 *Relatório Dev Portal — {report.get('date')}*\n\n_Sem interações hoje._"
    else:
        blocks = []
        for g in groups:
            blocks.append(
                f"👤 *{g['dev_email']}* · {g['app']}"
                + (f" / {g['setor']}" if g['setor'] else "")
                + f"\n⏱ {g['msg_count']} msgs"
                + f"\n{g['summary']}"
            )
        body = "\n\n━━━\n\n".join(blocks)
        msg = f"📊 *Relatório Dev Portal — {report.get('date')}*\n\n{body}"

    # WhatsApp tem limite de ~4k chars por msg. Corta se precisar.
    if len(msg) > 3500:
        msg = msg[:3500] + "\n…(relatório truncado, veja /api/admin/daily-report pra completo)"

    await send_whatsapp(GRUPO_IA_JID, msg)


async def daily_report_scheduler():
    """Loop que roda o relatório todo dia às 21:00 local (America/Sao_Paulo)."""
    from datetime import timedelta, timezone
    tz = timezone(timedelta(hours=-3))
    while True:
        try:
            now = datetime.now(tz)
            target = now.replace(hour=21, minute=0, second=0, microsecond=0)
            if now >= target:
                target = target + timedelta(days=1)
            wait_s = (target - now).total_seconds()
            print(f"[daily-report] próximo envio em {int(wait_s)}s ({target.isoformat()})")
            await asyncio.sleep(wait_s)

            report = await generate_daily_report()
            await send_daily_report_whatsapp(report)
            print(f"[daily-report] enviado — {len(report.get('groups', []))} grupos")
        except Exception as e:
            print(f"[daily-report] erro: {e}")
            await asyncio.sleep(300)  # 5min de cooldown em caso de erro


@app.on_event("startup")
async def _start_scheduler():
    asyncio.create_task(daily_report_scheduler())


# ── Pages ──

@app.get("/api/{p:path}")
async def api_404(p: str): return JSONResponse({"error": "Not found"}, 404)

@app.get("/{p:path}", response_class=HTMLResponse)
@app.get("/", response_class=HTMLResponse)
async def page(p: str = ""): return HTMLResponse(open("/app/index.html").read())

if __name__ == "__main__":
    import uvicorn; uvicorn.run(app, host="0.0.0.0", port=8080)
