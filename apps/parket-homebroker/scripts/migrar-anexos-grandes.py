#!/usr/bin/env python3
"""
Migracao dos anexos GRANDES (>35MB) do Homebroker: Supabase -> Drive.
(PKT-HB-DRIVE-20260901, task #1978; complemento do backfill #1975)

O backfill principal (backfill-anexos-drive.py) pulou arquivos acima de
35MB porque o POST base64 do Apps Script nao aguenta. Os 5 restantes tem
de 56MB a 168MB, acima ate do UrlFetchApp (~50MB), entao a saida e upload
RESUMABLE direto na Drive API v3:

  1. pede o OAuth token do sistemas@ pro Apps Script v2.1 (action
     get_upload_token, gated por secret em Script Properties; a copia
     local do secret vive em /root/.compras-watcher/drive_token_secret,
     fora do git, mesmo padrao do PAT);
  2. baixa o arquivo da URL publica do bucket;
  3. UPSERT por nome: lista os arquivos da pasta via files.list e, se ja
     existe um com o mesmo nome normalizado, faz update (mesmo file_id);
     senao cria. Rerodar e seguro;
  4. upload resumable (sessao + PUT unico do corpo, qualquer tamanho);
  5. reescreve o item em details.anexos (url do Drive, storage="drive",
     drive_file_id, supabase_url guardada) e persiste local + Cloud.

NAO apaga nada do bucket: a limpeza dos migrados e passo separado, depois
da verificacao de existencia no Drive (regra do processo de 01/09).

Uso:
  python3 migrar-anexos-grandes.py --dry-run   # so lista
  python3 migrar-anexos-grandes.py             # migra tudo
"""
import argparse
import json
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

# /exec do Apps Script (projeto "Parket Drive Bot"; GET deve responder v2.1).
DRIVE_SCRIPT_URL = ("https://script.google.com/macros/s/"
                    "AKfycbz07KaMoECR5EemL9UyGT8SZfOpYiJDKir7qQzOyRDPu8XZzvXfBq8ZdSSMMel_qRrg/exec")
CLOUD = "hbxpilrxmitvzebluoom"       # Parket Cloud (espelho do kanban)
PAT_FILE = "/root/.compras-watcher/mgmt_pat"
SECRET_FILE = "/root/.compras-watcher/drive_token_secret"  # fora do git


def log(msg):
    # stdout direto; quem roda redireciona pra arquivo se quiser historico
    print(msg, flush=True)


def http_json(url, method="GET", headers=None, body=None, timeout=300):
    """HTTP com corpo/resposta JSON. urllib segue o 302 do Apps Script."""
    h = {"User-Agent": "hb-migrar-grandes/1.0 (parket.works)"}
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, headers=h)
    with urllib.request.urlopen(req, data=data, timeout=timeout) as r:
        return json.loads(r.read().decode() or "null")


def drive_post(payload):
    """POST text/plain no Apps Script (text/plain evita preflight/CORS)."""
    return http_json(DRIVE_SCRIPT_URL, method="POST",
                     headers={"Content-Type": "text/plain"}, body=payload)


def baixar(url):
    """Baixa o arquivo pela URL publica do bucket. Retorna bytes."""
    req = urllib.request.Request(url, headers={"User-Agent": "hb-migrar-grandes/1.0"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.read()


def local_pg(query):
    """SELECT no parket-pg-local via docker exec. Retorna lista de dicts."""
    cid = subprocess.check_output(
        ["docker", "ps", "-q", "-f", "name=parket-pg-local_postgres"], text=True
    ).strip().splitlines()[0]
    out = subprocess.check_output(
        ["docker", "exec", cid, "psql", "-U", "postgres", "-d", "postgres", "-tA",
         "-c", f"SELECT coalesce(json_agg(t), '[]'::json) FROM ({query}) t;"],
        text=True,
    ).strip()
    return json.loads(out or "[]")


def local_pg_dml(query):
    """UPDATE no parket-pg-local via docker exec."""
    cid = subprocess.check_output(
        ["docker", "ps", "-q", "-f", "name=parket-pg-local_postgres"], text=True
    ).strip().splitlines()[0]
    subprocess.check_output(
        ["docker", "exec", cid, "psql", "-U", "postgres", "-d", "postgres", "-tA",
         "-c", query], text=True)


def cloud_sql(query):
    """SQL no Cloud via Management API (PAT lido de arquivo, fora do git)."""
    pat = open(PAT_FILE).read().strip()
    return http_json(
        f"https://api.supabase.com/v1/projects/{CLOUD}/database/query",
        method="POST",
        headers={"Authorization": f"Bearer {pat}",
                 "Content-Type": "application/json"},
        body={"query": query})


def salvar_details(card_id, patch):
    """Merge jsonb do patch em kanban_cards.details, local + Cloud."""
    j = json.dumps(patch, ensure_ascii=False).replace("'", "''")
    local_pg_dml(
        f"UPDATE kanban_cards SET details = COALESCE(details,'{{}}'::jsonb) "
        f"|| '{j}'::jsonb WHERE id::text = '{card_id}';")
    try:
        cloud_sql(
            f"UPDATE kanban_cards SET details = COALESCE(details,'{{}}'::jsonb) "
            f"|| '{j}'::jsonb WHERE id = '{card_id}'")
    except Exception as e:
        log(f"  aviso: merge no Cloud falhou (ok, e espelho): {e}")


def eh_legado(a):
    """Anexo que ainda mora no bucket card-attachments e nao migrou."""
    return ("card-attachments" in (a.get("url") or "")
            and a.get("storage") != "drive")


def normalizar_nome(nome):
    """Mesma normalizacao do Apps Script: sem acento, caixa baixa, espacos."""
    s = unicodedata.normalize("NFD", str(nome or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return " ".join(s.split()).lower()


# ── Drive API v3 direto (token do Apps Script) ──────────────────────────

def pegar_token():
    """Troca o secret local pelo OAuth token do sistemas@ (valido ~1h)."""
    secret = open(SECRET_FILE).read().strip()
    r = drive_post({"action": "get_upload_token", "secret": secret})
    if not (r or {}).get("success"):
        raise RuntimeError(f"get_upload_token falhou: {r}")
    return r["token"]


def drive_api(token, path, method="GET", body=None):
    """Chamada JSON simples na Drive API v3."""
    return http_json("https://www.googleapis.com/drive/v3/" + path,
                     method=method,
                     headers={"Authorization": f"Bearer {token}",
                              "Content-Type": "application/json"},
                     body=body)


def achar_arquivo_por_nome(token, folder_id, filename):
    """Procura arquivo com o mesmo nome NORMALIZADO na pasta (upsert)."""
    q = urllib.parse.quote(f"'{folder_id}' in parents and trashed=false")
    r = drive_api(token, f"files?q={q}&fields=files(id,name)&pageSize=1000"
                         "&supportsAllDrives=true&includeItemsFromAllDrives=true"
                         "&corpora=allDrives")
    alvo = normalizar_nome(filename)
    for f in r.get("files", []):
        if normalizar_nome(f["name"]) == alvo:
            return f["id"]
    return None


def upload_resumable(token, folder_id, filename, mime, blob):
    """Upload resumable: sessao (POST/PATCH) + corpo inteiro num PUT.
    Se ja existe arquivo de mesmo nome, atualiza o CONTEUDO (mesmo file_id,
    Drive guarda o historico de versoes); senao cria na pasta."""
    existente = achar_arquivo_por_nome(token, folder_id, filename)
    if existente:
        url = (f"https://www.googleapis.com/upload/drive/v3/files/{existente}"
               "?uploadType=resumable&supportsAllDrives=true")
        meta, metodo = {}, "PATCH"
    else:
        url = ("https://www.googleapis.com/upload/drive/v3/files"
               "?uploadType=resumable&supportsAllDrives=true")
        meta = {"name": filename, "parents": [folder_id], "mimeType": mime}
        metodo = "POST"

    # 1) abre a sessao: a resposta traz a URL de upload no header Location
    req = urllib.request.Request(url, method=metodo,
                                 data=json.dumps(meta).encode(),
                                 headers={
                                     "Authorization": f"Bearer {token}",
                                     "Content-Type": "application/json",
                                     "X-Upload-Content-Type": mime,
                                     "X-Upload-Content-Length": str(len(blob)),
                                 })
    with urllib.request.urlopen(req, timeout=120) as r:
        sessao = r.headers.get("Location")
    if not sessao:
        raise RuntimeError("sessao resumable sem Location")

    # 2) manda o corpo inteiro (timeout largo: pode ser 168MB)
    req = urllib.request.Request(sessao, method="PUT", data=blob,
                                 headers={"Content-Type": mime})
    with urllib.request.urlopen(req, timeout=1800) as r:
        info = json.loads(r.read().decode())
    return {"file_id": info["id"],
            "file_url": f"https://drive.google.com/file/d/{info['id']}/view",
            "updated": bool(existente)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="so lista o que faria, sem tocar Drive nem banco")
    args = ap.parse_args()

    # Guarda: so roda com o deploy v2.1 no ar (action get_upload_token existe).
    if not args.dry_run:
        ver = (http_json(DRIVE_SCRIPT_URL) or {}).get("version")
        if ver != "v2.1":
            log(f"ABORTADO: Apps Script responde version={ver!r}, preciso de "
                "v2.1 (colar o codigo novo no editor e atualizar o deploy)")
            sys.exit(2)
        token = pegar_token()

    # Cards comerciais que ainda tem anexo legado no bucket (os >35MB).
    cards = local_pg("""
        SELECT id::text AS id, title,
               COALESCE(details->>'drive_folder_id','') AS folder_id,
               details->'anexos' AS anexos
          FROM kanban_cards
         WHERE dept_id = 'comercial'
           AND COALESCE(title,'') <> ''
           AND jsonb_typeof(details->'anexos') = 'array'
           AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(details->'anexos') a
                  WHERE a->>'url' LIKE '%card-attachments%'
                    AND COALESCE(a->>'storage','') <> 'drive')
         ORDER BY created_at
    """)
    log(f"{len(cards)} cards com anexo legado no bucket"
        f"{' (DRY-RUN)' if args.dry_run else ''}")

    tot_ok = tot_err = 0
    for c in cards:
        anexos = c["anexos"] or []
        legados = [a for a in anexos if eh_legado(a)]
        log(f"card {c['id']} '{c['title']}': {len(legados)} legado(s)")
        if args.dry_run:
            for a in legados:
                log(f"  - {a.get('name')} ({a.get('size')} bytes)")
            continue

        # 1) pasta do cliente (backfill ja criou; ensure so por seguranca)
        try:
            folder_id = c["folder_id"]
            patch = {}
            if not folder_id:
                r = drive_post({"action": "ensure_hb_folder",
                                "client_name": c["title"]})
                if not (r or {}).get("success"):
                    log(f"  ERRO ensure_hb_folder: {r}")
                    tot_err += len(legados)
                    continue
                folder_id = r["folder_id"]
                patch = {"drive_folder_id": folder_id,
                         "drive_folder_url": r.get("folder_url"),
                         "drive_arquivado": False}
                log(f"  pasta {folder_id} (origem={r.get('origem')})")
        except Exception as e:
            log(f"  ERRO resolvendo pasta: {e}")
            tot_err += len(legados)
            continue

        # 2) baixa do bucket e sobe resumable (upsert por nome)
        novos = []
        mudou = False
        for a in anexos:
            if not eh_legado(a):
                novos.append(a)
                continue
            try:
                blob = baixar(a["url"])
                log(f"  baixado: {a.get('name')} ({len(blob)} bytes)")
                r = upload_resumable(
                    token, folder_id,
                    a.get("name") or "anexo",
                    a.get("type") or "application/octet-stream",
                    blob)
                novos.append({**a,
                              "url": r["file_url"],
                              "storage": "drive",
                              "drive_file_id": r["file_id"],
                              "supabase_url": a["url"]})
                mudou = True
                tot_ok += 1
                log(f"  ok: {a.get('name')} -> {r['file_id']}"
                    f"{' (atualizado)' if r.get('updated') else ''}")
                time.sleep(1)
            except Exception as e:
                log(f"  ERRO upload '{a.get('name')}': {e}")
                novos.append(a)  # mantem o item; rerun tenta de novo
                tot_err += 1

        # 3) persiste anexos novos (+ pasta se acabou de ser criada)
        if mudou or patch:
            if mudou:
                patch["anexos"] = novos
            salvar_details(c["id"], patch)

    log(f"fim: {tot_ok} migrados, {tot_err} erros")
    sys.exit(1 if tot_err else 0)


if __name__ == "__main__":
    main()
