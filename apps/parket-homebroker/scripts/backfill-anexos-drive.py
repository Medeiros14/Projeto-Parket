#!/usr/bin/env python3
"""
Backfill de anexos legados do Homebroker: Supabase Storage -> Google Drive.
(PKT-HB-DRIVE-20260901, task #1975)

O QUE FAZ, card a card (dept comercial com anexo no bucket card-attachments):
  1. garante a pasta do cliente no Drive ("Home Broker/<CLIENTE>") via action
     ensure_hb_folder do Apps Script "Parket Drive Bot" (dedup por nome,
     reusa pasta em Projetos, desarquiva do _Arquivo se o lead voltou);
  2. baixa cada anexo pela URL PUBLICA do bucket (sem chave) e sobe pro Drive
     via action upsert_file: substitui pelo nome mantendo file_id, entao
     RERODAR o script e seguro (nao duplica arquivo nem quebra link);
  3. reescreve o item em details.anexos: url passa a ser a do Drive,
     storage="drive", drive_file_id preenchido e a URL antiga fica guardada
     em supabase_url (referencia; NADA e apagado do bucket);
  4. persiste details (anexos + drive_folder_id/url) no PG local E no Cloud
     (espelho, best-effort: o card pode nem existir la).

O QUE NAO FAZ:
  - NAO apaga nada do bucket card-attachments (regra Will: limpeza so com
    ok explicito, e delete definitivo de pasta/arquivo e sempre manual);
  - arquivo acima de 35MB fica no Supabase (base64 infla ~33% e estoura o
    limite de POST do Apps Script) e o item permanece intocado;
  - NAO move pasta pra Projetos/_Arquivo: quem faz isso e a perna 9 do
    compras-contratos-watcher, que passa a enxergar esses cards assim que o
    drive_folder_id existe.

Credenciais: PAT da Management API lido de /root/.compras-watcher/mgmt_pat
(arquivo fora do git). PG local via docker exec no parket-pg-local.

Uso:
  python3 backfill-anexos-drive.py --dry-run          # so lista o que faria
  python3 backfill-anexos-drive.py --limit 5          # processa 5 cards
  python3 backfill-anexos-drive.py                    # tudo
"""
import argparse
import base64
import json
import subprocess
import sys
import time
import urllib.request

# /exec do Apps Script v2 (projeto "Parket Drive Bot", roda como sistemas@).
DRIVE_SCRIPT_URL = ("https://script.google.com/macros/s/"
                    "AKfycbz07KaMoECR5EemL9UyGT8SZfOpYiJDKir7qQzOyRDPu8XZzvXfBq8ZdSSMMel_qRrg/exec")
DRIVE_MAX_BYTES = 35 * 1024 * 1024   # acima disso o Apps Script rejeita o POST
CLOUD = "hbxpilrxmitvzebluoom"       # Parket Cloud (espelho do kanban)
PAT_FILE = "/root/.compras-watcher/mgmt_pat"


def log(msg):
    # stdout direto; quem roda redireciona pra arquivo se quiser historico
    print(msg, flush=True)


def http_json(url, method="GET", headers=None, body=None, timeout=180):
    """HTTP com corpo/resposta JSON. urllib segue o 302 do Apps Script
    (POST vira GET no redirect, que e exatamente o echo com o JSON)."""
    h = {"User-Agent": "hb-backfill-anexos/1.0 (parket.works)"}
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
    req = urllib.request.Request(url, headers={"User-Agent": "hb-backfill-anexos/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="so lista o que faria, sem tocar Drive nem banco")
    ap.add_argument("--limit", type=int, default=0,
                    help="processa no maximo N cards (0 = todos)")
    args = ap.parse_args()

    # Cards comerciais com pelo menos 1 anexo legado no bucket.
    lim = f"LIMIT {args.limit}" if args.limit > 0 else ""
    cards = local_pg(f"""
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
         {lim}
    """)
    log(f"{len(cards)} cards com anexo legado no bucket"
        f"{' (DRY-RUN)' if args.dry_run else ''}")

    tot_ok = tot_skip = tot_err = 0
    for c in cards:
        anexos = c["anexos"] or []
        legados = [a for a in anexos if eh_legado(a)]
        log(f"card {c['id']} '{c['title']}': {len(legados)} legado(s)")
        if args.dry_run:
            for a in legados:
                grande = (a.get("size") or 0) > DRIVE_MAX_BYTES
                log(f"  - {a.get('name')} ({a.get('size')} bytes)"
                    f"{' [>35MB, ficaria no Supabase]' if grande else ''}")
            continue

        # 1) pasta do cliente (reusa a do card se ja existe)
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

        # 2) sobe cada legado e reescreve o item no array (ordem preservada)
        novos = []
        mudou = False
        for a in anexos:
            if not eh_legado(a):
                novos.append(a)
                continue
            if (a.get("size") or 0) > DRIVE_MAX_BYTES:
                log(f"  pulado (> 35MB, fica no Supabase): {a.get('name')}")
                novos.append(a)
                tot_skip += 1
                continue
            try:
                blob = baixar(a["url"])
                r = drive_post({
                    "action": "upsert_file",   # substitui pelo nome: rerun-safe
                    "folder_id": folder_id,
                    "filename": a.get("name") or "anexo",
                    "mime_type": a.get("type") or "application/octet-stream",
                    "data_base64": base64.b64encode(blob).decode(),
                })
                if not (r or {}).get("success"):
                    raise RuntimeError(str(r))
                novos.append({**a,
                              "url": r["file_url"],
                              "storage": "drive",
                              "drive_file_id": r["file_id"],
                              "supabase_url": a["url"]})
                mudou = True
                tot_ok += 1
                log(f"  ok: {a.get('name')} -> {r['file_id']}"
                    f"{' (atualizado)' if r.get('updated') else ''}")
                time.sleep(1)  # respiro pro Apps Script (quota de execucao)
            except Exception as e:
                log(f"  ERRO upload '{a.get('name')}': {e}")
                novos.append(a)  # mantem o item original; rerun tenta de novo
                tot_err += 1

        # 3) persiste: anexos novos + pasta (se acabou de ser criada)
        if mudou or patch:
            if mudou:
                patch["anexos"] = novos
            salvar_details(c["id"], patch)

    log(f"fim: {tot_ok} migrados, {tot_skip} pulados (>35MB), {tot_err} erros")
    sys.exit(1 if tot_err else 0)


if __name__ == "__main__":
    main()
