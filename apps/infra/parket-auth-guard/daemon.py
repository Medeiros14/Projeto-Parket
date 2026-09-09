"""Parket Auth Guard — daemon local (127.0.0.1:8891).

Fluxo:
  wrapper → POST /request-auth  { tool, target, argv, requester }
  daemon envia código 6 dígitos no WhatsApp do Will
  daemon aguarda até 300s Will responder com esse código
  daemon retorna 200 { approved: bool, reason }

Fail secure: se daemon não responde/erro, wrappers negam.
"""
from __future__ import annotations
import fnmatch, hashlib, ipaddress, json, os, random, re, secrets, sqlite3, string, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import psycopg2
import psycopg2.extras
import requests
import uvicorn

BASE = Path("/root/parket-auth-guard")
WHITELIST_FILE = BASE / "whitelist.txt"
DB_PATH = BASE / "data" / "audit.db"
LOG_PATH = Path("/var/log/parket-auth-guard/daemon.log")
CODE_TTL_S = 300              # 5min pra Will responder
POLL_INTERVAL_S = 2           # de quanto em quanto tempo consulta Evolution
WILL_NUMBER = "5511939213329" # Will (dm) — memo debug_phone
EVO_BASE = "https://conect.parket.works"
EVO_FETCH = f"{EVO_BASE}/instance/fetchInstances"

app = FastAPI(title="Parket Auth Guard", version="0.1")
_lock = Lock()
_pending: dict[str, dict] = {}   # code → {req_id, expires_at, approved, denied}

LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    line = f"[{ts}] {msg}"
    with open(LOG_PATH, "a") as f: f.write(line + "\n")
    print(line, flush=True)


def db() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def db_init() -> None:
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            tool TEXT, target TEXT, argv TEXT, requester TEXT, host TEXT,
            code TEXT, decision TEXT, reason TEXT, req_id TEXT
        )""")
        c.commit()


def evo_key() -> str:
    """Fetches the Evolution API key from the ai-squad backend container."""
    try:
        bk = subprocess.check_output(["docker","ps","-q","-f","name=parket-ai-squad_backend"], text=True).strip().split("\n")[0]
        if not bk: return ""
        out = subprocess.check_output(["docker","exec",bk,"sh","-c","echo $EVOLUTION_API_KEY"], text=True).strip()
        return out
    except Exception as e:
        log(f"evo_key: {e}")
        return ""


# ─── Whitelist matching ──────────────────────────────────────────────
def load_whitelist() -> list[str]:
    if not WHITELIST_FILE.exists(): return []
    out = []
    for raw in WHITELIST_FILE.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"): continue
        out.append(line)
    return out


def is_whitelisted(target: str) -> tuple[bool, str]:
    """target: 'host' ou 'host/path' ou 'ip'. Retorna (ok, matched_pattern)."""
    if not target: return False, "empty target"
    t = target.lower()
    # extrai host isolado pra comparar contra CIDR/patterns
    host = t.split("/",1)[0]
    for pat in load_whitelist():
        p = pat.lower()
        # CIDR ipv4
        if "/" in p and all(c.isdigit() or c in "./" for c in p):
            try:
                if ipaddress.ip_address(host) in ipaddress.ip_network(p, strict=False):
                    return True, pat
            except (ValueError, TypeError): pass
        # host+path glob
        if fnmatch.fnmatch(t, p): return True, pat
        # host-only glob (match apenas o host)
        if fnmatch.fnmatch(host, p): return True, pat
        # host prefix (whitelist "github.com/ParketBR/*" bate em "github.com/ParketBR/foo.git")
        if "/" in p:
            ph, pp = p.split("/",1)
            if fnmatch.fnmatch(host, ph) and t.startswith(f"{ph}/") and fnmatch.fnmatch(t[len(ph)+1:], pp):
                return True, pat
    return False, ""


# ─── Auth request handling ───────────────────────────────────────────
class AuthReq(BaseModel):
    tool: str
    target: str
    argv: str = ""
    requester: str = ""


def gen_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def list_open_instances(key: str) -> list[str]:
    """Retorna nomes de instâncias Evolution com status 'open'."""
    try:
        r = requests.get(EVO_FETCH, headers={"apikey": key}, timeout=10)
        r.raise_for_status()
        data = r.json()
        items = data if isinstance(data, list) else data.get("instances", [])
        out = []
        for it in items:
            inst = it.get("instance", it) if isinstance(it, dict) else {}
            name = inst.get("instanceName") or inst.get("name")
            status = inst.get("connectionStatus") or inst.get("status")
            if name and status == "open":
                out.append(name)
        return out
    except Exception as e:
        log(f"list_open_instances: {e}")
        return []


def send_wa(code: str, tool: str, target: str, requester: str, argv: str) -> int:
    """Envia por TODAS as instâncias Evolution conectadas. Retorna quantas entregou."""
    key = evo_key()
    if not key:
        log("send_wa: sem chave Evolution")
        return 0
    instances = list_open_instances(key)
    if not instances:
        log("send_wa: nenhuma instância conectada")
        return 0
    msg = (
        f"🔐 *PARKET AUTH GUARD*\n\n"
        f"Pediu autorização pra transferir/publicar fora do padrão Parket:\n\n"
        f"• Ferramenta: `{tool}`\n"
        f"• Destino: `{target}`\n"
        f"• Requerente: {requester or 'root'}\n"
        f"• Comando: `{(argv[:120] + '…') if len(argv)>120 else argv}`\n\n"
        f"👉 Responda com o código *{code}* pra liberar (válido {CODE_TTL_S//60}min).\n"
        f"Se não foi você, ignore — vai ser negado automaticamente."
    )
    delivered = 0
    for inst in instances:
        try:
            r = requests.post(f"{EVO_BASE}/message/sendText/{inst}",
                headers={"apikey": key, "Content-Type": "application/json"},
                json={"number": WILL_NUMBER, "text": msg}, timeout=15)
            if 200 <= r.status_code < 300:
                delivered += 1
                log(f"send_wa OK via {inst}")
            else:
                log(f"send_wa {inst} erro {r.status_code}: {r.text[:150]}")
        except Exception as e:
            log(f"send_wa {inst} exception: {e}")
    return delivered


def poll_reply_for_code(code: str, req_started_ts: int) -> bool:
    """Consulta a tabela Message do Evolution atrás de resposta do Will
    contendo o código, enviada depois de req_started_ts."""
    try:
        cid = subprocess.check_output(["docker","ps","-q","-f","name=evolutionapi_postgresevo"], text=True).strip().split("\n")[0]
        if not cid: return False
        # WhatsApp remoteJid tem sufixo @s.whatsapp.net
        # WhatsApp usa @s.whatsapp.net (número) OU @lid (novo formato Linked ID);
        # nesse caso o número real fica em key.remoteJidAlt. Aceitamos ambos.
        sql = (
            f"SELECT message->>'conversation' AS txt, "
            f"       message->'extendedTextMessage'->>'text' AS ext, "
            f"       \"messageTimestamp\" "
            f"  FROM \"Message\" "
            f" WHERE (key->>'remoteJid' LIKE '{WILL_NUMBER}%' "
            f"        OR key->>'remoteJidAlt' LIKE '{WILL_NUMBER}%') "
            f"   AND key->>'fromMe' = 'false' "
            f"   AND \"messageTimestamp\" >= {req_started_ts} "
            f" ORDER BY \"messageTimestamp\" DESC LIMIT 30"
        )
        out = subprocess.check_output(
            ["docker","exec",cid,"psql","-U","postgres","-d","evolution","-tAF","|","-c",sql],
            text=True, timeout=10)
        for line in out.splitlines():
            parts = line.split("|")
            if len(parts) < 2: continue
            txt = parts[0].strip() or ""
            ext = parts[1].strip() or ""
            body = f"{txt} {ext}"
            if code in body:
                return True
        return False
    except Exception as e:
        log(f"poll_reply: {e}")
        return False


def audit(entry: dict) -> None:
    with db() as c:
        c.execute("""INSERT INTO audit(ts,tool,target,argv,requester,host,code,decision,reason,req_id)
                     VALUES(?,?,?,?,?,?,?,?,?,?)""", (
            datetime.now(timezone.utc).isoformat(timespec="seconds"),
            entry.get("tool"), entry.get("target"), entry.get("argv","")[:2000],
            entry.get("requester",""), entry.get("host",""),
            entry.get("code",""), entry.get("decision",""), entry.get("reason","")[:500],
            entry.get("req_id",""),
        ))
        c.commit()


@app.post("/request-auth")
def request_auth(req: AuthReq):
    host = urlparse(f"//{req.target}").hostname or req.target.split("/")[0]
    ok, matched = is_whitelisted(req.target)
    req_id = secrets.token_hex(6)
    base_entry = {"tool":req.tool, "target":req.target, "argv":req.argv, "requester":req.requester,
                  "host":host, "req_id":req_id}
    if ok:
        audit({**base_entry, "decision":"allow", "reason":f"whitelist:{matched}"})
        return {"approved": True, "reason": f"whitelist:{matched}", "req_id": req_id}

    code = gen_code()
    started = int(time.time())
    log(f"[{req_id}] auth solicitado: {req.tool} → {req.target} (código {code})")
    delivered = send_wa(code, req.tool, req.target, req.requester, req.argv)
    if delivered == 0:
        audit({**base_entry, "code":code, "decision":"deny", "reason":"wa-send-fail"})
        return {"approved": False, "reason": "não consegui enviar WhatsApp por nenhuma instância — negado", "req_id": req_id}
    log(f"[{req_id}] enviado por {delivered} instância(s)")

    # polling loop
    deadline = started + CODE_TTL_S
    while time.time() < deadline:
        if poll_reply_for_code(code, started):
            audit({**base_entry, "code":code, "decision":"allow", "reason":"wa-code-ok"})
            log(f"[{req_id}] LIBERADO por código Will")
            return {"approved": True, "reason": "código validado", "req_id": req_id}
        time.sleep(POLL_INTERVAL_S)
    audit({**base_entry, "code":code, "decision":"deny", "reason":"timeout"})
    log(f"[{req_id}] TIMEOUT — negado")
    return {"approved": False, "reason": f"timeout {CODE_TTL_S}s sem resposta", "req_id": req_id}


@app.get("/health")
def health():
    return {"ok": True, "whitelist_lines": len(load_whitelist())}


@app.get("/audit")
def audit_recent(limit: int = 50):
    with db() as c:
        rows = c.execute("SELECT * FROM audit ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


if __name__ == "__main__":
    db_init()
    log("Daemon iniciando em 127.0.0.1:8891")
    uvicorn.run(app, host="127.0.0.1", port=8891, log_level="warning")
