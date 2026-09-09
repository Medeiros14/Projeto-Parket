#!/usr/bin/env python3
"""Parket Auth Guard - hook PreToolUse do Claude Code.

O QUE FAZ: intercepta comandos Bash com git push / remote add / remote set-url.
Destino em github.com/ParketBR/* ou github.com/willzeiras/* = liberado direto.
Qualquer outro destino = pede liberacao ao daemon (127.0.0.1:8891), que manda
codigo de 6 digitos no WhatsApp do Will e aguarda ate 5min.

FAIL-SECURE: daemon fora do ar ou destino indeterminavel = push NEGADO (exit 2).
Comandos que nao sao git push/remote passam direto (exit 0).
"""
import json, re, subprocess, sys, urllib.request

DAEMON = "http://127.0.0.1:8891/request-auth"
# Donos de GitHub liberados sem codigo (espelha a whitelist do daemon)
ALLOWED = re.compile(r"^github\.com/(parketbr|willzeiras)/", re.IGNORECASE)
# Padroes de comando que exigem inspecao
RISKY = re.compile(r"git\s+(?:-C\s+\S+\s+)?(?:push\b|remote\s+(?:add|set-url)\b)")


def normalize_url(url: str) -> str:
    """https://user:tok@github.com/X/y.git ou git@github.com:X/y.git -> github.com/X/y"""
    url = url.strip().strip("'\"")
    m = re.match(r"^(?:ssh://)?git@([^:/]+)[:/](.+)$", url)
    if m:
        host, path = m.group(1), m.group(2)
    else:
        m = re.match(r"^[a-z+]+://(?:[^@/]+@)?([^/]+)/(.+)$", url)
        if not m:
            return ""
        host, path = m.group(1), m.group(2)
    path = re.sub(r"\.git$", "", path.rstrip("/"))
    return f"{host}/{path}"


def resolve_targets(command: str, cwd: str) -> list[str]:
    """Extrai todos os destinos possiveis do comando (URLs explicitas + remotes)."""
    targets = []
    # 1) URLs explicitas no comando (cobre remote add/set-url e push com URL)
    for u in re.findall(r"(?:https?://|ssh://|git@)[^\s'\"]+", command):
        n = normalize_url(u)
        if n:
            targets.append(n)
    # 2) git push [remote] sem URL: resolve o remote no repo certo
    for m in re.finditer(r"git\s+(?:-C\s+(\S+)\s+)?push\b([^|;&]*)", command):
        repo_dir = (m.group(1) or "").strip("'\"") or cwd
        rest = m.group(2) or ""
        # ultimo `cd` antes do push vence o cwd (padrao comum: cd /repo && git push)
        cds = re.findall(r"(?:^|[;&|]{1,2})\s*cd\s+([^\s;&|]+)", command[:m.start()])
        if cds and not m.group(1):
            repo_dir = cds[-1].strip("'\"")
        remote = "origin"
        for tok in rest.split():
            if tok.startswith("-"):
                continue
            remote = tok
            break
        if re.match(r"^(?:https?://|ssh://|git@)", remote):
            continue  # ja coberto no passo 1
        try:
            url = subprocess.check_output(
                ["git", "-C", repo_dir, "remote", "get-url", "--push", remote],
                text=True, stderr=subprocess.DEVNULL, timeout=10).strip()
            n = normalize_url(url)
            targets.append(n if n else f"?remote-ilegivel:{remote}")
        except Exception:
            targets.append(f"?remote-nao-resolvido:{remote}@{repo_dir}")
    return targets


def deny(reason: str) -> None:
    print(f"PARKET AUTH GUARD: NEGADO. {reason}", file=sys.stderr)
    sys.exit(2)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    if payload.get("tool_name") != "Bash":
        sys.exit(0)
    command = (payload.get("tool_input") or {}).get("command") or ""
    if not RISKY.search(command):
        sys.exit(0)

    cwd = payload.get("cwd") or "/root"
    targets = resolve_targets(command, cwd)
    if not targets:
        # remote add/set-url sem URL parseavel: fail-secure
        deny("nao consegui determinar o destino do comando git.")

    pending = [t for t in targets if not ALLOWED.match(t)]
    if not pending:
        sys.exit(0)  # tudo ParketBR/willzeiras

    for target in pending:
        try:
            req = urllib.request.Request(
                DAEMON,
                data=json.dumps({
                    "tool": "git-push-hook",
                    "target": target,
                    "argv": command[:500],
                    "requester": "claude-code",
                }).encode(),
                headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=320) as r:
                resp = json.loads(r.read())
        except Exception as e:
            deny(f"daemon auth-guard inacessivel ({e}); destino fora do padrao: {target}")
        if not resp.get("approved"):
            deny(f"destino {target} sem liberacao do Will ({resp.get('reason','?')}). "
                 "Pushes so pra github.com/ParketBR ou com codigo aprovado no WhatsApp.")
    sys.exit(0)


if __name__ == "__main__":
    main()
