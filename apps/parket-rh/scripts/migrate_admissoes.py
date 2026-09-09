#!/usr/bin/env python3
"""
Migração admissoes.xlsx (export Convenia) → schema rh.

O que faz:
  1. Lê /tmp/admissoes.xlsx (146 colaboradores)
  2. Resolve/cria empresa default (Parket Pisos / Parket Marcenaria por inferência)
  3. Resolve/cria departamentos, times, cargos a partir das colunas
  4. Cria rh.colaboradores (cpf=null pra preencher manualmente depois)
  5. Cria rh.contratos vinculando colaborador → empresa → cargo → depto → time
  6. Marca status_dados='incompleto' nos colaboradores

Idempotente: usa ON CONFLICT por matrícula+empresa pra contratos e nome+nascimento
pra colaboradores. Pode rodar várias vezes sem duplicar.

Uso:
  export SUPABASE_MGMT_TOKEN=...
  python3 migrate_admissoes.py [--dry-run] [--xlsx PATH] [--empresa-id UUID]
"""
import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import datetime
from typing import Any, Optional

import requests
from openpyxl import load_workbook

# ─── Config ─────────────────────────────────────────────────────────────────
SUPABASE_REF = "hbxpilrxmitvzebluoom"
MGMT_API = f"https://api.supabase.com/v1/projects/{SUPABASE_REF}/database/query"
TOKEN = os.environ.get("SUPABASE_MGMT_TOKEN") or os.environ.get("SB_TOKEN")

# Fallback default — empresa Parket Marcenaria (já existente em core.empresas)
DEFAULT_EMPRESA_MARCENARIA = "22222222-2222-2222-2222-222222222222"
DEFAULT_EMPRESA_PISOS = "11111111-1111-1111-1111-111111111111"

# Inferência de empresa a partir de departamento
DEPT_TO_EMPRESA = {
    "MARCENARIA": DEFAULT_EMPRESA_MARCENARIA,
    "PAINEL": DEFAULT_EMPRESA_MARCENARIA,
    "PORTA": DEFAULT_EMPRESA_MARCENARIA,
    "PISO": DEFAULT_EMPRESA_PISOS,
    "FORRO": DEFAULT_EMPRESA_PISOS,
    "DECK": DEFAULT_EMPRESA_PISOS,
}


# ─── Helpers ────────────────────────────────────────────────────────────────
def sql(query: str) -> Any:
    """Roda query via Management API."""
    if not TOKEN:
        sys.exit("ERRO: defina SUPABASE_MGMT_TOKEN com o token de admin do projeto")
    r = requests.post(
        MGMT_API,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        json={"query": query},
        timeout=60,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"SQL falhou ({r.status_code}): {r.text[:500]}")
    return r.json()


def esc(v: Any) -> str:
    """Escapa pra SQL — sempre retorna literal entre quotes ou NULL."""
    if v is None or v == "":
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, bool):
        return "true" if v else "false"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def normalize(s: Optional[str]) -> Optional[str]:
    """Limpa string: trim + collapse whitespace + 'Não informado' → None."""
    if s is None:
        return None
    s = str(s).strip()
    if not s or s.lower() in ("não informado", "nao informado", "n/a", "-", "—"):
        return None
    s = re.sub(r"\s+", " ", s)
    return s


def parse_date_br(s: Optional[str]) -> Optional[str]:
    """DD/MM/YYYY → YYYY-MM-DD ISO. Aceita também já-ISO ou datetime."""
    if s is None or s == "":
        return None
    if isinstance(s, datetime):
        return s.date().isoformat()
    s = str(s).strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def clean_cpf(s: Optional[str]) -> Optional[str]:
    """Tira tudo que não é dígito; retorna 11 dígitos ou None."""
    if s is None:
        return None
    digits = re.sub(r"\D", "", str(s))
    return digits if len(digits) == 11 else None


def slug(s: str) -> str:
    """Slug ASCII pra deduplicar nomes."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.upper().strip()


# ─── Resolvers ──────────────────────────────────────────────────────────────
def resolve_empresa(departamento: Optional[str], default: str) -> str:
    """Decide qual empresa o colaborador pertence baseado no departamento."""
    if not departamento:
        return default
    d = slug(departamento)
    for key, eid in DEPT_TO_EMPRESA.items():
        if key in d:
            return eid
    return default


def get_or_create_departamento(empresa_id: str, nome: str, dry_run: bool) -> Optional[str]:
    """Retorna id do departamento, criando se preciso."""
    nome = normalize(nome)
    if not nome:
        return None
    rows = sql(
        f"SELECT id FROM rh.departamentos WHERE empresa_id = {esc(empresa_id)} "
        f"AND upper(nome) = upper({esc(nome)}) LIMIT 1"
    )
    if rows:
        return rows[0]["id"]
    if dry_run:
        print(f"   [dry] criaria departamento '{nome}'")
        return None
    rows = sql(
        f"INSERT INTO rh.departamentos (empresa_id, nome) VALUES ({esc(empresa_id)}, {esc(nome)}) RETURNING id"
    )
    return rows[0]["id"]


def get_or_create_time(
    empresa_id: str, departamento_id: Optional[str], nome: str, dry_run: bool
) -> Optional[str]:
    nome = normalize(nome)
    if not nome:
        return None
    rows = sql(
        f"SELECT id FROM rh.times WHERE empresa_id = {esc(empresa_id)} "
        f"AND upper(nome) = upper({esc(nome)}) LIMIT 1"
    )
    if rows:
        return rows[0]["id"]
    if dry_run:
        print(f"   [dry] criaria time '{nome}'")
        return None
    rows = sql(
        f"INSERT INTO rh.times (empresa_id, departamento_id, nome) "
        f"VALUES ({esc(empresa_id)}, {esc(departamento_id)}, {esc(nome)}) RETURNING id"
    )
    return rows[0]["id"]


def get_or_create_cargo(
    empresa_id: str, nome: str, salario_default: Optional[float], dry_run: bool
) -> Optional[str]:
    nome = normalize(nome)
    if not nome:
        return None
    rows = sql(
        f"SELECT id FROM rh.cargos WHERE empresa_id = {esc(empresa_id)} "
        f"AND upper(nome) = upper({esc(nome)}) LIMIT 1"
    )
    if rows:
        return rows[0]["id"]
    if dry_run:
        print(f"   [dry] criaria cargo '{nome}'")
        return None
    rows = sql(
        f"INSERT INTO rh.cargos (empresa_id, nome, salario_base_default) "
        f"VALUES ({esc(empresa_id)}, {esc(nome)}, {esc(salario_default)}) RETURNING id"
    )
    return rows[0]["id"]


def upsert_colaborador(
    nome: str,
    nome_social: Optional[str],
    data_nascimento: Optional[str],
    dry_run: bool,
) -> Optional[str]:
    """Idempotência por nome+nascimento (sem CPF nessa massa).

    Em produção, quando o CPF estiver preenchido, troque pra UNIQUE (cpf).
    """
    rows = sql(
        f"SELECT id FROM rh.colaboradores WHERE upper(nome) = upper({esc(nome)}) "
        f"AND COALESCE(data_nascimento::text, '') = COALESCE({esc(data_nascimento)}, '') LIMIT 1"
    )
    if rows:
        return rows[0]["id"]
    if dry_run:
        print(f"   [dry] criaria colaborador '{nome}'")
        return None
    rows = sql(
        f"""INSERT INTO rh.colaboradores
            (nome, nome_social, data_nascimento, status_dados, observacoes)
            VALUES ({esc(nome)}, {esc(nome_social)}, {esc(data_nascimento)},
                    'incompleto',
                    'Importado de admissoes.xlsx (Convenia) em {datetime.utcnow().isoformat()}Z. Falta: CPF, RG, contatos, endereço.')
            RETURNING id"""
    )
    return rows[0]["id"]


def upsert_contrato(
    colaborador_id: str,
    empresa_id: str,
    matricula: Optional[str],
    cargo_id: Optional[str],
    departamento_id: Optional[str],
    time_id: Optional[str],
    salario: Optional[float],
    senioridade: Optional[str],
    nivel_senioridade: Optional[str],
    data_admissao: Optional[str],
    data_termino_aprendiz: Optional[str],
    status_admissao: Optional[str],
    dry_run: bool,
) -> Optional[str]:
    """Idempotência: empresa_id + matricula. Sem matrícula, usa colab+admissão."""
    if matricula:
        rows = sql(
            f"SELECT id FROM rh.contratos WHERE empresa_id = {esc(empresa_id)} "
            f"AND matricula = {esc(matricula)} LIMIT 1"
        )
        if rows:
            return rows[0]["id"]
    else:
        rows = sql(
            f"SELECT id FROM rh.contratos WHERE colaborador_id = {esc(colaborador_id)} "
            f"AND empresa_id = {esc(empresa_id)} "
            f"AND COALESCE(data_admissao::text,'') = COALESCE({esc(data_admissao)},'') LIMIT 1"
        )
        if rows:
            return rows[0]["id"]

    # Mapeia status da Convenia → nosso enum
    status = "ativo"
    if status_admissao:
        s = slug(status_admissao)
        if "RASCUNHO" in s or "PENDENTE" in s:
            status = "em_admissao"
        elif "PROCESSO" in s or "ANDAMENTO" in s:
            status = "aguardando_aprovacao"

    tipo_contrato = "CLT"
    if data_termino_aprendiz:
        tipo_contrato = "aprendiz"

    if dry_run:
        print(f"   [dry] criaria contrato matricula={matricula} salario={salario}")
        return None

    rows = sql(
        f"""INSERT INTO rh.contratos
            (colaborador_id, empresa_id, matricula, cargo_id, departamento_id, time_id,
             salario_base, senioridade, nivel_senioridade,
             data_admissao, data_termino_contrato, tipo_contrato, status)
            VALUES (
                {esc(colaborador_id)}, {esc(empresa_id)}, {esc(matricula)},
                {esc(cargo_id)}, {esc(departamento_id)}, {esc(time_id)},
                {esc(salario or 0)}, {esc(senioridade)}, {esc(nivel_senioridade)},
                {esc(data_admissao or datetime.utcnow().date().isoformat())},
                {esc(data_termino_aprendiz)},
                {esc(tipo_contrato)},
                {esc(status)}
            )
            RETURNING id"""
    )
    return rows[0]["id"]


# ─── Main ───────────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--xlsx", default="/tmp/admissoes.xlsx")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--default-empresa",
        default=DEFAULT_EMPRESA_MARCENARIA,
        help="UUID da empresa default quando departamento não infere",
    )
    args = p.parse_args()

    if not os.path.exists(args.xlsx):
        sys.exit(f"Arquivo não encontrado: {args.xlsx}")

    print(f"📂 Lendo {args.xlsx} ...")
    wb = load_workbook(args.xlsx, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    headers = rows[0]
    data = rows[1:]
    print(f"   {len(data)} linhas (cabeçalho com {len(headers)} colunas)")

    # Pre-compute índices das colunas
    idx = {h: i for i, h in enumerate(headers)}
    COL_NOME = idx["Nome do colaborador"]
    COL_NOME_SOCIAL = idx.get("Informações pessoais - Nome social")
    COL_CARGO = idx.get("Informações de trabalho - Cargo")
    COL_SENIOR = idx.get("Informações de trabalho - Senioridade")
    COL_NIVEL = idx.get("Informações de trabalho - Nível de senioridade")
    COL_DEPTO = idx.get("Informações de trabalho - Departamento")
    COL_TIME = idx.get("Informações de trabalho - Time")
    COL_SAL = idx.get("Informações de trabalho - Salário")
    COL_NASC = idx.get("Informações pessoais - Data de nascimento")
    COL_ADM = idx.get("Informações de trabalho - Data de admissão")
    COL_TERM_APR = idx.get("Informações de trabalho - Data de término do contrato de aprendiz")
    COL_MATR = idx.get("Informações de trabalho - Matrícula")
    COL_STATUS = idx.get("Status de admissão")

    stats = {
        "total": 0,
        "colab_criados": 0,
        "colab_existentes": 0,
        "contratos_criados": 0,
        "contratos_existentes": 0,
        "depts_criados": set(),
        "times_criados": set(),
        "cargos_criados": set(),
        "erros": [],
    }

    for i, row in enumerate(data, start=1):
        try:
            nome = normalize(row[COL_NOME])
            if not nome:
                continue
            stats["total"] += 1

            nome_social = normalize(row[COL_NOME_SOCIAL]) if COL_NOME_SOCIAL is not None else None
            cargo_nome = normalize(row[COL_CARGO]) if COL_CARGO is not None else None
            senior = normalize(row[COL_SENIOR]) if COL_SENIOR is not None else None
            nivel = normalize(row[COL_NIVEL]) if COL_NIVEL is not None else None
            dept = normalize(row[COL_DEPTO]) if COL_DEPTO is not None else None
            time_nome = normalize(row[COL_TIME]) if COL_TIME is not None else None
            sal_raw = row[COL_SAL] if COL_SAL is not None else None
            nasc = parse_date_br(row[COL_NASC]) if COL_NASC is not None else None
            adm = parse_date_br(row[COL_ADM]) if COL_ADM is not None else None
            term_apr = parse_date_br(row[COL_TERM_APR]) if COL_TERM_APR is not None else None
            matr = row[COL_MATR] if COL_MATR is not None else None
            status_adm = normalize(row[COL_STATUS]) if COL_STATUS is not None else None

            salario = float(sal_raw) if isinstance(sal_raw, (int, float)) else None
            matricula = str(int(matr)) if isinstance(matr, (int, float)) else (str(matr) if matr else None)

            # 1. Empresa
            empresa_id = resolve_empresa(dept, args.default_empresa)

            # 2. Departamento → Time → Cargo
            dept_id = get_or_create_departamento(empresa_id, dept, args.dry_run) if dept else None
            time_id = get_or_create_time(empresa_id, dept_id, time_nome, args.dry_run) if time_nome else None
            cargo_id = get_or_create_cargo(empresa_id, cargo_nome, salario, args.dry_run) if cargo_nome else None

            # 3. Colaborador
            colab_pre = sql(
                f"SELECT id FROM rh.colaboradores WHERE upper(nome) = upper({esc(nome)}) LIMIT 1"
            )
            already_colab = bool(colab_pre)
            colab_id = upsert_colaborador(nome, nome_social, nasc, args.dry_run)
            if already_colab:
                stats["colab_existentes"] += 1
            else:
                stats["colab_criados"] += 1

            # 4. Contrato
            ctr_pre = None
            if matricula:
                ctr_pre = sql(
                    f"SELECT id FROM rh.contratos WHERE empresa_id = {esc(empresa_id)} "
                    f"AND matricula = {esc(matricula)} LIMIT 1"
                )
            already_ctr = bool(ctr_pre)
            if colab_id:
                upsert_contrato(
                    colab_id, empresa_id, matricula,
                    cargo_id, dept_id, time_id,
                    salario, senior, nivel,
                    adm, term_apr, status_adm,
                    args.dry_run,
                )
            if already_ctr:
                stats["contratos_existentes"] += 1
            else:
                stats["contratos_criados"] += 1

            if dept:
                stats["depts_criados"].add(dept)
            if time_nome:
                stats["times_criados"].add(time_nome)
            if cargo_nome:
                stats["cargos_criados"].add(cargo_nome)

            if i % 25 == 0:
                print(f"   ...{i}/{len(data)} processados")

        except Exception as e:  # noqa: BLE001
            stats["erros"].append({"linha": i, "nome": str(row[COL_NOME]), "erro": str(e)[:200]})

    # ─ Resumo ─
    print()
    print("═══════════════════════════════════════════════════════════════")
    print(f"{'DRY RUN' if args.dry_run else 'EXECUTADO'} — Resumo")
    print("═══════════════════════════════════════════════════════════════")
    print(f"  Linhas processadas        : {stats['total']}")
    print(f"  Colaboradores criados     : {stats['colab_criados']}")
    print(f"  Colaboradores já existiam : {stats['colab_existentes']}")
    print(f"  Contratos criados         : {stats['contratos_criados']}")
    print(f"  Contratos já existiam     : {stats['contratos_existentes']}")
    print(f"  Departamentos distintos   : {len(stats['depts_criados'])} {sorted(stats['depts_criados'])}")
    print(f"  Times distintos           : {len(stats['times_criados'])}")
    print(f"  Cargos distintos          : {len(stats['cargos_criados'])}")
    print(f"  Erros                     : {len(stats['erros'])}")
    if stats["erros"]:
        print("\n  Detalhes dos erros:")
        for e in stats["erros"][:10]:
            print(f"    L{e['linha']} ({e['nome']}): {e['erro']}")
    print()
    print("⚠ Próximos passos manuais:")
    print("  - Preencher CPF, RG, contatos, endereço de cada colaborador")
    print("  - Validar empresa atribuída (departamento → empresa via heurística)")
    print("  - Vincular user_id quando o colaborador criar conta")
    print()


if __name__ == "__main__":
    main()
