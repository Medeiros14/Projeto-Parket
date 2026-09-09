"""Backfill de meta.paginas nos gestao.documentos ja subidos pelo Drive do gestao.

Documentos enviados antes do fix de rasterizacao ficaram com meta vazio, entao a
Central do Cliente so mostrava o botao de download em vez das paginas do desenho.
Este script baixa o PDF do storage, rasteriza em JPG 200dpi e grava meta.paginas.

Uso (dentro do container parket-gestao_api):
    python backfill_doc_paginas.py <projeto_id> [--apply]
"""
from __future__ import annotations

import io
import json
import os
import sys
import uuid

import fitz
import httpx
import psycopg
from PIL import Image
from psycopg.rows import dict_row

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET = "obra-media"
DB_URL = ("postgresql://{u}:{p}@{h}:{P}/{d}".format(
    u=os.environ["GESTAO_PG_USER"], p=os.environ["GESTAO_PG_PASSWORD"],
    h=os.environ["GESTAO_PG_HOST"], P=os.environ.get("GESTAO_PG_PORT", "5432"),
    d=os.environ["GESTAO_PG_DB"]))


def main() -> None:
    pid = sys.argv[1]
    apply = "--apply" in sys.argv

    with psycopg.connect(DB_URL, row_factory=dict_row) as db:
        docs = db.execute("""
            SELECT id::text AS id, titulo, storage_path
              FROM gestao.documentos
             WHERE projeto_id::text = %s
               AND storage_path IS NOT NULL
               AND lower(storage_path) LIKE '%%.pdf'
               AND COALESCE(jsonb_array_length(meta->'paginas'), 0) = 0
             ORDER BY created_at
        """, (pid,)).fetchall()

        print(f"{len(docs)} documento(s) sem paginas")
        if not apply:
            for d in docs:
                print("  -", d["titulo"])
            print("dry-run; rode com --apply")
            return

        st = httpx.Client(base_url=f"{SUPABASE_URL}/storage/v1",
                          headers={"apikey": SUPABASE_KEY,
                                   "Authorization": f"Bearer {SUPABASE_KEY}"},
                          timeout=180.0)
        for d in docs:
            r = st.get(f"/object/{BUCKET}/{d['storage_path']}")
            r.raise_for_status()
            pdf = r.content
            base = d["storage_path"].rsplit("/", 1)[0].replace("/pdf", "")
            doc_uuid = str(uuid.uuid4())
            paginas = []
            pdfdoc = fitz.open(stream=pdf, filetype="pdf")
            for i, page in enumerate(pdfdoc, 1):
                pix = page.get_pixmap(dpi=200)
                img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                buf = io.BytesIO()
                img.save(buf, "JPEG", quality=85, optimize=True)
                path = f"{base}/paginas/{doc_uuid}/page_{i:02d}.jpg"
                up = st.post(f"/object/{BUCKET}/{path}", content=buf.getvalue(),
                             headers={"Content-Type": "image/jpeg", "x-upsert": "true"})
                up.raise_for_status()
                paginas.append({"n": i,
                                "url": f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"})
            db.execute("""
                UPDATE gestao.documentos
                   SET meta = COALESCE(meta, '{}'::jsonb) || %s::jsonb
                 WHERE id::text = %s
            """, (json.dumps({"paginas": paginas}), d["id"]))
            db.commit()
            print(f"  OK {d['titulo']}: {len(paginas)} pagina(s)")


if __name__ == "__main__":
    main()
