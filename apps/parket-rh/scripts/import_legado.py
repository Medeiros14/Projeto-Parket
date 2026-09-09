#!/usr/bin/env python3
"""
Import legado de documentos do GitHub (sistemas825/Todos) → rh.documentos_emitidos.

Estratégia:
1. Itera todas as pastas com nome de pessoa (vs pastas de modelo "ADVERTENCIA_*")
2. Match por nome (slug) com rh.colaboradores
3. Upload de cada PDF pro bucket rh-documentos
4. Cria rh.documentos_emitidos com status='legado_offline' (já assinado em papel)
5. Tipo do documento detectado pelo nome do arquivo

Uso:
  cd /tmp/legado && /root/parket-rh/scripts/import_legado.py
"""
import os
import re
import sys
import unicodedata
from pathlib import Path
import requests
import json

SBKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk0MjUyNywiZXhwIjoyMDg4NTE4NTI3fQ.fTovVTCBFcMrrhVCR6TsneALfMRLLLHZdMmSJH16L4A"
SUPABASE_URL = "https://hbxpilrxmitvzebluoom.supabase.co"
MGMT_API = "https://api.supabase.com/v1/projects/hbxpilrxmitvzebluoom/database/query"
MGMT_TOKEN = "SUPABASE_MGMT_TOKEN_REMOVIDO"
BUCKET = "rh-documentos"
ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/legado")


def slug(s: str) -> str:
    if not s: return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-zA-Z0-9 ]", " ", s).upper()
    return re.sub(r"\s+", " ", s).strip()


def sql(q: str):
    r = requests.post(MGMT_API,
        headers={"Authorization": f"Bearer {MGMT_TOKEN}", "Content-Type": "application/json"},
        json={"query": q}, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"SQL fail: {r.text[:200]}")
    return r.json()


def fetch_colaboradores():
    rows = sql("SELECT id, nome, cpf FROM rh.colaboradores ORDER BY nome")
    out = []
    for r in rows:
        nome = r["nome"]
        out.append({
            "id": r["id"], "nome": nome,
            "slug": slug(nome),
            "tokens": [t for t in slug(nome).split() if len(t) >= 4],
            "cpf": (r["cpf"] or "").replace(".", "").replace("-", "").strip(),
        })
    return out


def best_match_colab(folder_name: str, colabs: list) -> dict | None:
    """Tenta matchear o nome da pasta com um colaborador via slug."""
    s = slug(folder_name)
    if not s: return None
    # exact match (igual ao nome todo)
    for c in colabs:
        if c["slug"] == s: return c
    # tentar match: pega os primeiros N tokens da pasta e vê se forma prefixo de nome
    tokens = s.split()
    if not tokens: return None
    first = tokens[0]
    # filtra colabs cujo slug começa com `first` AND contém algum outro token da pasta
    candidates = [c for c in colabs if c["slug"].startswith(first)]
    if len(candidates) == 1: return candidates[0]
    if len(candidates) > 1:
        # critério: pega o que mais tokens da pasta aparecem no nome
        best = None; best_score = 0
        for c in candidates:
            score = sum(1 for t in tokens if t in c["slug"])
            if score > best_score:
                best_score = score; best = c
        if best_score >= 2: return best
    # nada
    return None


# Detecção de tipo via keywords no path
TIPO_RULES = [
    (re.compile(r"FICHAS? REGISTRO|FICHA[ _]REGISTRO", re.I), ("ficha_registro", None, "Ficha de Registro")),
    (re.compile(r"CONTRATO DE TRABALHO|CONTRATO_TRABALHO", re.I), ("contrato_clt", None, "Contrato de trabalho CLT")),
    (re.compile(r"PRESTACAO[ _]?SERVICOS?|PRESTAÇÃO SERVIÇOS", re.I), ("contrato_pj", None, "Contrato PJ - Prestação de serviços")),
    (re.compile(r"ADITIVO[ _]?HORARIO|ADITIVO HORÁRIO", re.I), ("termo_aditivo_horario", None, "Aditivo de horário")),
    (re.compile(r"ANTECIPAC?A?O? FERIAS|ANTECIPAÇÃO FERIAS", re.I), ("termo_antecipacao_ferias", None, "Antecipação de férias")),
    (re.compile(r"FALTAS? INJUSTIFICAD|FALTA INJUSTIFICADA", re.I), ("advertencia", "falta", "Advertência por faltas")),
    (re.compile(r"ATRASOS?", re.I), ("advertencia", "atraso", "Advertência por atrasos")),
    (re.compile(r"SA[IÍ]DA ANT", re.I), ("advertencia", "saida_antecipada", "Advertência por saída antecipada")),
    (re.compile(r"DESEMPENHO", re.I), ("advertencia", "desempenho", "Advertência por desempenho")),
    (re.compile(r"DES[IÍ]DIA", re.I), ("advertencia", "desidia", "Advertência por desídia")),
    (re.compile(r"\bADVERTENCIA\b|ADVERTÊNCIA", re.I), ("advertencia", None, "Advertência")),
    (re.compile(r"SUSPEN[SÇ][AÃ]O", re.I), ("suspensao", None, "Suspensão disciplinar")),
    (re.compile(r"DESOCUPAC?A?O?[ _]MORADIA", re.I), ("comunicado_desocupacao", None, "Comunicado de desocupação")),
    (re.compile(r"DISPENSA[ _]JUSTA[ _]CAUSA", re.I), ("dispensa_justa_causa", None, "Dispensa por justa causa")),
    (re.compile(r"AVISO[ _]PR[EÉ]VIO", re.I), ("aviso_previo", None, "Aviso prévio")),
    (re.compile(r"\bTRCT\b|RECISAO|RESCIS[AÃ]O", re.I), ("trct", None, "Termo de rescisão (TRCT)")),
    (re.compile(r"NR[ _]?01\b", re.I), ("nr", "01", "NR-01")),
    (re.compile(r"NR[ _]?06\b", re.I), ("nr", "06", "NR-06 (EPI)")),
    (re.compile(r"NR[ _]?12\b", re.I), ("nr", "12", "NR-12")),
    (re.compile(r"NR[ _]?18\b", re.I), ("nr", "18", "NR-18")),
    (re.compile(r"NR[ _]?35\b", re.I), ("nr", "35", "NR-35")),
    (re.compile(r"\bEPI\b|FICHA DE EPI", re.I), ("ficha_epi", None, "Ficha de EPI")),
    (re.compile(r"TERMO[ _]?CELULAR", re.I), ("termo_celular", None, "Termo de celular")),
    (re.compile(r"VEICUL|VEÍCUL|RESPONSABILIDADE.*VEIC", re.I), ("termo_veiculo", None, "Termo de veículo")),
    (re.compile(r"EMPR[EÉ]STIMO|EMPRESTIMO", re.I), ("termo_emprestimo", None, "Termo de empréstimo")),
    (re.compile(r"REQUERIMENTO[ _]?SEGURO", re.I), ("requerimento_seguro", None, "Requerimento de seguro")),
    (re.compile(r"COVID", re.I), ("declaracao_saude", None, "Declaração COVID-19")),
    (re.compile(r"ACOMPANHAMENTO", re.I), ("acompanhamento", None, "Acompanhamento")),
]

def detect_tipo(path_str: str) -> tuple[str, str | None, str]:
    for rule, info in TIPO_RULES:
        if rule.search(path_str):
            return info
    return ("outro", None, "Documento")


def upload_storage(token: str, fname: str, content: bytes, content_type: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", fname)[:120]
    path = f"legado/{token}/{safe}"
    r = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        headers={
            "apikey": SBKEY, "Authorization": f"Bearer {SBKEY}",
            "Content-Type": content_type, "x-upsert": "true",
        },
        data=content, timeout=120,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"upload fail: {r.text[:200]}")
    return path


def main():
    print(f"📂 Lendo {ROOT}…")
    colabs = fetch_colaboradores()
    print(f"   {len(colabs)} colaboradores no DB")

    # Estatísticas
    matched = 0
    skipped = 0
    inserted = 0
    not_matched = []

    # Itera pastas top-level
    for entry in sorted(ROOT.iterdir()):
        if not entry.is_dir(): continue
        fname = entry.name
        # Skip pastas obviamente de modelo (sem nome de pessoa)
        if not re.search(r"[A-Z]{4}", slug(fname).split()[0] if slug(fname) else ""):
            skipped += 1
            continue

        # Tenta extrair nome de pessoa do nome da pasta
        # ex: "ADEIRTON PEREIRA DE LIMA" → match
        # ex: "ADEIRTON PKT - FICHAS REGISTRO-1, ..." → match parcial
        # ex: "ADVERTENCIA_FALTAS INJUSTIFICADAS" → modelo, ignora
        if re.search(r"^ADVERT[EÊ]NCIA|^MODELO|^PKT - |^EXCLUSIVE - |^TRCT$|^TERMO |^COMUNICADO_|^FICHA |^EPI ",
                     slug(fname).strip()):
            skipped += 1
            continue

        colab = best_match_colab(fname, colabs)
        if not colab:
            not_matched.append(fname)
            skipped += 1
            continue

        matched += 1
        # Lista PDFs/imgs/docs nesta pasta (recursivo)
        for f in entry.rglob("*"):
            if not f.is_file(): continue
            if f.suffix.lower() not in (".pdf", ".jpg", ".jpeg", ".png", ".docx"): continue
            try:
                content = f.read_bytes()
                if len(content) > 50 * 1024 * 1024:  # 50MB max
                    continue
                tipo, variante, _label = detect_tipo(str(f.relative_to(ROOT)))
                # Título = nome real do arquivo (limpo, sem extensão e _ → espaço)
                label = re.sub(r"\s+", " ", re.sub(r"[_]+", " ", f.stem)).strip()
                ct = "application/pdf" if f.suffix.lower() == ".pdf" else \
                     "image/jpeg" if f.suffix.lower() in (".jpg", ".jpeg") else \
                     "image/png" if f.suffix.lower() == ".png" else "application/octet-stream"
                # Token único dummy (não vai ser assinado online)
                token = f"legado-{colab['id'][:8]}-{abs(hash(str(f.relative_to(ROOT)))) % 10**10}"
                storage_path = upload_storage(token, f.name, content, ct)
                # Insere
                titulo = label
                # Escape pro SQL
                t_e = titulo.replace("'", "''")
                lab_orig = "github_sistemas825_Todos"
                tipo_e = tipo.replace("'", "''")
                vari_e = (variante or "").replace("'", "''") if variante else None
                vari_sql = f"'{vari_e}'" if vari_e else "NULL"
                sql(f"""
                  INSERT INTO rh.documentos_emitidos
                  (colaborador_id, titulo, conteudo_html, status,
                   storage_path_pdf, legado_origem, legado_pdf_path, modelo_id)
                  VALUES (
                    '{colab["id"]}', '{t_e}',
                    '<p style="text-align:center;padding:60px;color:#888">[Documento legado — anexo PDF]</p>',
                    'legado_offline',
                    '{storage_path}', '{lab_orig}', '{storage_path}',
                    (SELECT id FROM rh.modelos_documento WHERE tipo='{tipo_e}'
                     AND COALESCE(variante,'') = COALESCE({vari_sql},'') LIMIT 1)
                  )
                """)
                inserted += 1
                print(f"  ✓ {colab['nome']}: {f.name} ({tipo}/{variante or '-'})")
            except Exception as e:
                print(f"  ✗ {f.name}: {str(e)[:100]}")

    print(f"\n📊 Matched: {matched} pastas, {inserted} arquivos importados, {skipped} skipped")
    print(f"\n❌ Não matchearam ({len(not_matched)}):")
    for n in not_matched[:30]: print(f"   {n}")


if __name__ == "__main__":
    main()
