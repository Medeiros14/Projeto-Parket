#!/usr/bin/env python3
"""Move as fotos de fiscal_fotos que estao gravadas como data URI pro Storage.

Ate 31/08/2026 o app do fiscal (verifica.parket.works) gravava a foto inteira
em base64 dentro de fiscal_fotos.url. Consequencia: qualquer tela que lista as
fotos de uma obra (aba Itens & Cronograma do gestao, Central do Cliente, PDF do
laudo) baixava as imagens embutidas no JSON. Uma obra com 12 fotos = 1,4 MB por
abertura, sem cache de navegador possivel, porque bytes dentro de JSON nao sao
um recurso cacheavel.

O escritor ja foi corrigido (frontend/index.html: subirMidiaStorage). Este
script cuida do passivo: sobe cada foto pro bucket fiscal-midias e troca a
coluna url pelo link publico, preenchendo storage_path.

Seguranca:
  - Idempotente: so processa linhas cujo url comeca com "data:".
  - Nao destrutivo por engano: o base64 original vai pra um backup .jsonl.gz
    local ANTES de qualquer PATCH, e o PATCH so acontece depois de confirmar
    por HTTP que o objeto novo esta acessivel no bucket.
  - --dry-run mostra o que faria sem escrever nada.

Uso:
  SUPABASE_SERVICE_KEY=... python3 migrar_fotos_base64_storage.py [--dry-run] [--limite N]
"""

import argparse
import base64
import gzip
import json
import os
import sys
import time

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hbxpilrxmitvzebluoom.supabase.co")
BUCKET = "fiscal-midias"
PAGINA = 20

EXT_POR_MIME = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
}


def chave() -> str:
    k = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not k:
        sys.exit("Falta SUPABASE_SERVICE_KEY no ambiente.")
    return k


def decodificar(data_uri: str):
    """data:image/jpeg;base64,AAAA -> (bytes, mime). None se nao for data URI."""
    if not data_uri.startswith("data:"):
        return None
    cabeca, _, corpo = data_uri.partition(",")
    if not corpo:
        return None
    mime = cabeca[5:].split(";")[0].strip().lower() or "image/jpeg"
    try:
        return base64.b64decode(corpo, validate=False), mime
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limite", type=int, default=0, help="processa no maximo N linhas")
    args = ap.parse_args()

    k = chave()
    rest = httpx.Client(
        base_url=f"{SUPABASE_URL}/rest/v1",
        headers={"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json"},
        timeout=120.0,
    )
    stg = httpx.Client(
        base_url=f"{SUPABASE_URL}/storage/v1",
        headers={"apikey": k, "Authorization": f"Bearer {k}"},
        timeout=180.0,
    )

    backup_path = f"/root/backups/fiscal_fotos_base64_{time.strftime('%Y%m%d_%H%M%S')}.jsonl.gz"
    os.makedirs("/root/backups", exist_ok=True)

    ok = falhas = pulados = 0
    bytes_liberados = 0
    backup = None if args.dry_run else gzip.open(backup_path, "wt", encoding="utf-8")

    try:
        while True:
            # Sempre relendo a primeira pagina de linhas base64: como cada linha
            # migrada deixa de casar o filtro, a fila anda sozinha e o script
            # pode ser interrompido e retomado a qualquer momento.
            r = rest.get("/fiscal_fotos", params={
                "select": "id,laudo_id,card_id,servico,tipo,url",
                "url": "like.data:*",
                "order": "created_at.asc",
                "limit": str(PAGINA),
            })
            r.raise_for_status()
            linhas = r.json()
            if not linhas:
                break

            for row in linhas:
                if args.limite and (ok + falhas) >= args.limite:
                    linhas = []
                    break

                fid = row["id"]
                dec = decodificar(row["url"] or "")
                if not dec:
                    print(f"  PULA {fid}: url nao decodificou")
                    pulados += 1
                    continue
                blob, mime = dec
                ext = EXT_POR_MIME.get(mime, "jpg")
                pasta = row.get("laudo_id") or row.get("card_id") or "sem-laudo"
                caminho = f"migrado/{pasta}/{fid}.{ext}"

                if args.dry_run:
                    print(f"  [dry] {fid} {len(blob)//1024}KB -> {caminho}")
                    ok += 1
                    bytes_liberados += len(row["url"])
                    continue

                backup.write(json.dumps({"id": fid, "url": row["url"]}) + "\n")

                up = stg.post(f"/object/{BUCKET}/{caminho}", content=blob,
                              headers={"Content-Type": mime, "x-upsert": "true"})
                if up.status_code >= 400:
                    print(f"  FALHA upload {fid}: {up.status_code} {up.text[:160]}")
                    falhas += 1
                    continue

                publica = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{caminho}"
                # So troca a coluna depois de o objeto responder de fato. Sem
                # esta confirmacao, um upload aceito mas ilegivel viraria uma
                # linha apontando pra imagem quebrada, sem volta.
                chk = httpx.head(publica, timeout=60.0, follow_redirects=True)
                if chk.status_code >= 400:
                    print(f"  FALHA leitura {fid}: HTTP {chk.status_code}")
                    falhas += 1
                    continue

                pt = rest.patch("/fiscal_fotos", params={"id": f"eq.{fid}"},
                                json={"url": publica, "storage_path": caminho},
                                headers={"Prefer": "return=minimal"})
                if pt.status_code >= 400:
                    print(f"  FALHA patch {fid}: {pt.status_code} {pt.text[:160]}")
                    falhas += 1
                    continue

                bytes_liberados += len(row["url"]) - len(publica)
                ok += 1
                if ok % 25 == 0:
                    print(f"  ... {ok} migradas")

            if not linhas:
                break
    finally:
        if backup:
            backup.close()
        rest.close()
        stg.close()

    print(f"\nmigradas={ok} falhas={falhas} pulados={pulados}")
    print(f"JSON encolheu {bytes_liberados/1024/1024:.1f} MB")
    if not args.dry_run:
        print(f"backup do base64: {backup_path}")
    if falhas:
        sys.exit(1)


if __name__ == "__main__":
    main()
