#!/usr/bin/env python3
"""
Migração COMPLETA do export Convenia → schema rh.

Lê as 8 abas do XLSX:
  1. Worksheet (153 cols) — colaborador + contrato principal + estrangeiro + estágio + EPI
  2. Nacionalidades (multi por colaborador)
  3. Contatos de emergência
  4. Dados bancários
  5. Faltas e afastamentos
  6. Formação acadêmica
  7. Informações do dependente
  8. Histórico cargos e salários

Resolve empresas via CNPJ (caso A) com fallback de criação (caso B).
Idempotente: pode rodar várias vezes.

Uso:
  export SUPABASE_MGMT_TOKEN=sbp_xxx
  python3 migrate_rh_completo.py [--dry-run] [--xlsx PATH]
"""
import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, date
from typing import Any, Optional

import requests
from openpyxl import load_workbook

SUPABASE_REF = "hbxpilrxmitvzebluoom"
MGMT_API = f"https://api.supabase.com/v1/projects/{SUPABASE_REF}/database/query"
TOKEN = os.environ.get("SUPABASE_MGMT_TOKEN") or os.environ.get("SB_TOKEN")


# ─── SQL helper ────────────────────────────────────────────────────────────
def sql(query: str) -> Any:
    if not TOKEN:
        sys.exit("ERRO: defina SUPABASE_MGMT_TOKEN")
    r = requests.post(
        MGMT_API,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        json={"query": query},
        timeout=120,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"SQL falhou ({r.status_code}): {r.text[:600]}")
    return r.json()


def esc(v: Any) -> str:
    if v is None or v == "":
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (date, datetime)):
        return f"'{v.isoformat()[:10]}'"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def normalize(s) -> Optional[str]:
    if s is None:
        return None
    s = str(s).strip()
    if not s or s.lower() in ("não informado", "nao informado", "n/a", "-", "—", "null"):
        return None
    return re.sub(r"\s+", " ", s)


def parse_date_br(s) -> Optional[str]:
    if s is None or s == "":
        return None
    if isinstance(s, datetime):
        return s.date().isoformat()
    if isinstance(s, date):
        return s.isoformat()
    s = str(s).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_year(s) -> Optional[int]:
    if s is None: return None
    try: return int(str(s).strip()[:4])
    except: return None


def clean_cpf(s) -> Optional[str]:
    if s is None: return None
    digits = re.sub(r"\D", "", str(s))
    return digits if len(digits) == 11 else None


def clean_cnpj(s) -> Optional[str]:
    if s is None: return None
    return re.sub(r"\D", "", str(s)) or None


def parse_bool_pt(v) -> Optional[bool]:
    if v is None: return None
    s = str(v).strip().lower()
    if s in ("sim", "s", "yes", "true", "1"): return True
    if s in ("não", "nao", "n", "no", "false", "0"): return False
    return None


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.upper().strip()


# ─── Cache resolvers ───────────────────────────────────────────────────────
_cache = {"empresas_por_cnpj": {}, "depts": {}, "times": {}, "cargos": {}, "ccs": {},
          "sindicatos": {}, "colab_por_cpf": {}, "colab_por_nome_nasc": {},
          "contratos_por_chave": {}}


def get_or_create_empresa(cnpj_raw: Optional[str], nome: Optional[str], dry: bool) -> Optional[str]:
    """Caso A com fallback B."""
    cnpj = clean_cnpj(cnpj_raw)
    if not cnpj and not nome:
        return None
    if cnpj and cnpj in _cache["empresas_por_cnpj"]:
        return _cache["empresas_por_cnpj"][cnpj]

    # Caso A: tenta match por CNPJ
    if cnpj:
        rows = sql(f"SELECT id FROM core.empresas WHERE regexp_replace(cnpj, '\\D', '', 'g') = '{cnpj}' LIMIT 1")
        if rows:
            _cache["empresas_por_cnpj"][cnpj] = rows[0]["id"]
            return rows[0]["id"]
        # Match por razão_social
        if nome:
            rows = sql(f"SELECT id FROM core.empresas WHERE upper(razao_social) = upper({esc(nome)}) "
                       f"OR upper(nome_fantasia) = upper({esc(nome)}) LIMIT 1")
            if rows:
                _cache["empresas_por_cnpj"][cnpj] = rows[0]["id"]
                return rows[0]["id"]

    # Caso B: cria
    if dry:
        print(f"   [dry] criaria empresa CNPJ={cnpj} nome={nome!r}")
        return None
    cnpj_fmt = f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:14]}" if cnpj else "00.000.000/0000-00"
    rows = sql(
        f"INSERT INTO core.empresas (cnpj, razao_social, nome_fantasia, ativo) "
        f"VALUES ({esc(cnpj_fmt)}, {esc(nome or 'EMPRESA SEM NOME')}, {esc(nome)}, true) "
        f"RETURNING id"
    )
    if cnpj: _cache["empresas_por_cnpj"][cnpj] = rows[0]["id"]
    return rows[0]["id"]


def get_or_create_dept(empresa_id: str, nome: str, dry: bool) -> Optional[str]:
    nome = normalize(nome)
    if not nome: return None
    key = (empresa_id, slug(nome))
    if key in _cache["depts"]: return _cache["depts"][key]
    rows = sql(f"SELECT id FROM rh.departamentos WHERE empresa_id = {esc(empresa_id)} "
               f"AND upper(nome) = upper({esc(nome)}) LIMIT 1")
    if rows:
        _cache["depts"][key] = rows[0]["id"]; return rows[0]["id"]
    if dry: return None
    rows = sql(f"INSERT INTO rh.departamentos (empresa_id, nome) VALUES ({esc(empresa_id)}, {esc(nome)}) RETURNING id")
    _cache["depts"][key] = rows[0]["id"]
    return rows[0]["id"]


def get_or_create_time(empresa_id: str, dept_id: Optional[str], nome: str, dry: bool) -> Optional[str]:
    nome = normalize(nome)
    if not nome: return None
    key = (empresa_id, slug(nome))
    if key in _cache["times"]: return _cache["times"][key]
    rows = sql(f"SELECT id FROM rh.times WHERE empresa_id = {esc(empresa_id)} "
               f"AND upper(nome) = upper({esc(nome)}) LIMIT 1")
    if rows:
        _cache["times"][key] = rows[0]["id"]; return rows[0]["id"]
    if dry: return None
    rows = sql(f"INSERT INTO rh.times (empresa_id, departamento_id, nome) "
               f"VALUES ({esc(empresa_id)}, {esc(dept_id)}, {esc(nome)}) RETURNING id")
    _cache["times"][key] = rows[0]["id"]
    return rows[0]["id"]


def get_or_create_cargo(empresa_id: str, nome: str, salario: Optional[float],
                        cbo: Optional[str], descricao: Optional[str], dry: bool) -> Optional[str]:
    nome = normalize(nome)
    if not nome: return None
    key = (empresa_id, slug(nome))
    if key in _cache["cargos"]: return _cache["cargos"][key]
    rows = sql(f"SELECT id FROM rh.cargos WHERE empresa_id = {esc(empresa_id)} "
               f"AND upper(nome) = upper({esc(nome)}) LIMIT 1")
    if rows:
        _cache["cargos"][key] = rows[0]["id"]; return rows[0]["id"]
    if dry: return None
    rows = sql(f"INSERT INTO rh.cargos (empresa_id, nome, descricao, salario_base_default, cbo_codigo) "
               f"VALUES ({esc(empresa_id)}, {esc(nome)}, {esc(descricao)}, {esc(salario)}, "
               f"  (SELECT codigo FROM rh.cbos WHERE codigo = {esc(cbo)})) "
               f"RETURNING id")
    _cache["cargos"][key] = rows[0]["id"]
    return rows[0]["id"]


def get_or_create_centro_custo(empresa_id: str, nome: str, dry: bool) -> Optional[str]:
    nome = normalize(nome)
    if not nome: return None
    key = (empresa_id, slug(nome))
    if key in _cache["ccs"]: return _cache["ccs"][key]
    rows = sql(f"SELECT id FROM rh.centros_custo_rh WHERE empresa_id = {esc(empresa_id)} "
               f"AND upper(nome) = upper({esc(nome)}) LIMIT 1")
    if rows:
        _cache["ccs"][key] = rows[0]["id"]; return rows[0]["id"]
    if dry: return None
    rows = sql(f"INSERT INTO rh.centros_custo_rh (empresa_id, nome) "
               f"VALUES ({esc(empresa_id)}, {esc(nome)}) RETURNING id")
    _cache["ccs"][key] = rows[0]["id"]
    return rows[0]["id"]


def get_or_create_sindicato(nome: str, cnpj: Optional[str], website: Optional[str],
                             telefone: Optional[str], data_base: Optional[str], dry: bool) -> Optional[str]:
    nome = normalize(nome)
    if not nome: return None
    cnpj_clean = clean_cnpj(cnpj)
    key = cnpj_clean or slug(nome)
    if key in _cache["sindicatos"]: return _cache["sindicatos"][key]
    if cnpj_clean:
        rows = sql(f"SELECT id FROM rh.sindicatos WHERE regexp_replace(cnpj, '\\D', '', 'g') = '{cnpj_clean}' LIMIT 1")
    else:
        rows = sql(f"SELECT id FROM rh.sindicatos WHERE upper(nome) = upper({esc(nome)}) LIMIT 1")
    if rows:
        _cache["sindicatos"][key] = rows[0]["id"]; return rows[0]["id"]
    if dry: return None
    cnpj_fmt = (f"{cnpj_clean[:2]}.{cnpj_clean[2:5]}.{cnpj_clean[5:8]}/{cnpj_clean[8:12]}-{cnpj_clean[12:14]}"
                if cnpj_clean else None)
    rows = sql(
        f"INSERT INTO rh.sindicatos (nome, cnpj, website, telefone, data_base) "
        f"VALUES ({esc(nome)}, {esc(cnpj_fmt)}, {esc(website)}, {esc(telefone)}, {esc(data_base)}) "
        f"RETURNING id"
    )
    _cache["sindicatos"][key] = rows[0]["id"]
    return rows[0]["id"]


# ─── Aba 1: Worksheet (colaborador + contrato + extras) ────────────────────
def process_worksheet(rows, headers, dry, default_empresa_id, stats):
    idx = {h: i for i, h in enumerate(headers)}
    g = lambda r, key: r[idx[key]] if key in idx else None

    for i, row in enumerate(rows, 1):
        try:
            nome = normalize(g(row, "Nome do colaborador"))
            if not nome:
                continue

            external_id = normalize(g(row, "Dados da empresa - ID (identificador do colaborador)"))
            empresa_nome = normalize(g(row, "Dados da empresa - Empresa"))
            empresa_cnpj = g(row, "Dados da empresa - CNPJ")
            empresa_id = get_or_create_empresa(empresa_cnpj, empresa_nome, dry) or default_empresa_id
            if not empresa_id:
                stats["erros"].append({"linha": i, "nome": nome, "erro": "sem empresa"})
                continue

            # Identidade
            nome_social = normalize(g(row, "Informações pessoais - Nome social"))
            uf_natal = normalize(g(row, "Informações pessoais - UF natal"))
            cidade_natal = normalize(g(row, "Informações pessoais - Cidade natal"))
            raca_cor = normalize(g(row, "Informações pessoais - Cor/Raça"))
            sexo = normalize(g(row, "Informações pessoais - Gênero"))
            genero_doc = normalize(g(row, "Informações pessoais - Gênero no documento"))
            estado_civil = normalize(g(row, "Informações pessoais - Estado civil"))
            data_nasc = parse_date_br(g(row, "Informações pessoais - Data de nascimento"))
            nome_mae = normalize(g(row, "Informações pessoais - Nome da mãe"))
            nome_pai = normalize(g(row, "Informações pessoais - Nome do pai"))
            # Contatos
            celular = normalize(g(row, "Contatos - Celular"))
            telefone = normalize(g(row, "Contatos - Telefone"))
            email_pessoal = normalize(g(row, "Contatos - E-mail pessoal"))
            email_prof = normalize(g(row, "Informações de trabalho - E-mail profissional"))
            # Endereço
            cep = normalize(g(row, "Endereços - CEP"))
            log = normalize(g(row, "Endereços - Endereço"))
            num = normalize(g(row, "Endereços - Número"))
            compl = normalize(g(row, "Endereços - Complemento do endereço"))
            bairro = normalize(g(row, "Endereços - Bairro"))
            uf = normalize(g(row, "Endereços - Estado"))
            cidade = normalize(g(row, "Endereços - Cidade"))
            # Documentos
            rg_num = normalize(g(row, "Documentos - RG - Número"))
            rg_emit = parse_date_br(g(row, "Documentos - RG - Data de emissão"))
            rg_org = normalize(g(row, "Documentos - RG - Órgão emissor"))
            rg_uf = normalize(g(row, "Documentos - RG - UF emissor"))
            cpf = clean_cpf(g(row, "Documentos - CPF"))
            ctps_num = normalize(g(row, "Documentos - CTPS - Número"))
            ctps_serie = normalize(g(row, "Documentos - CTPS - Número de série"))
            ctps_emit = parse_date_br(g(row, "Documentos - CTPS - Data de emissão"))
            ctps_uf = normalize(g(row, "Documentos - CTPS - Estado emissor"))
            pis = normalize(g(row, "Documentos - CTPS - PIS"))
            te_num = normalize(g(row, "Documentos - Titulo de eleitor - Número"))
            te_zona = normalize(g(row, "Documentos - Titulo de eleitor - Ala Eleitoral"))
            te_secao = normalize(g(row, "Documentos - Titulo de eleitor - Sessão"))
            te_uf = normalize(g(row, "Documentos - Titulo de eleitor - Estado"))
            te_cidade = normalize(g(row, "Documentos - Titulo de eleitor - Cidade"))
            res_num = normalize(g(row, "Documentos - Reservista - Número"))
            res_ra = normalize(g(row, "Documentos - Reservista - RA"))
            res_serie = normalize(g(row, "Documentos - Reservista - Série"))
            cnh_num = normalize(g(row, "Documentos - CNH - Número"))
            cnh_emit = parse_date_br(g(row, "Documentos - CNH - Data de emissão"))
            cnh_val = parse_date_br(g(row, "Documentos - CNH - Validade"))
            cnh_cat = normalize(g(row, "Documentos - CNH - Categoria"))
            # Deficiência
            def_tipo = normalize(g(row, "Deficiência - Tipo"))
            def_obs = normalize(g(row, "Deficiência - Observações"))
            # IR
            qtd_dep = g(row, "Quantidade de dependentes declarados no IR")
            qtd_dep_int = int(qtd_dep) if isinstance(qtd_dep, (int, float)) else 0

            # ─ Upsert colaborador ─
            if cpf:
                cur = sql(f"SELECT id FROM rh.colaboradores WHERE cpf = {esc(cpf)} LIMIT 1")
            elif external_id:
                cur = sql(f"SELECT id FROM rh.colaboradores WHERE external_id_convenia = {esc(external_id)} LIMIT 1")
            else:
                cur = sql(f"SELECT id FROM rh.colaboradores WHERE upper(nome) = upper({esc(nome)}) "
                          f"AND COALESCE(data_nascimento::text,'') = COALESCE({esc(data_nasc)},'') LIMIT 1")
            if cur:
                colab_id = cur[0]["id"]
                stats["colab_existentes"] += 1
            else:
                if dry:
                    colab_id = "<DRY>"
                else:
                    rows_ins = sql(f"""
                        INSERT INTO rh.colaboradores (
                          external_id_convenia, nome, nome_social, cpf, data_nascimento,
                          sexo, genero_documento, estado_civil, raca_cor,
                          uf_natal, cidade_natal, nome_mae, nome_pai,
                          email_pessoal, email_profissional, celular, telefone_residencial,
                          endereco_logradouro, endereco_numero, endereco_complemento,
                          endereco_bairro, endereco_cidade, endereco_uf, endereco_cep,
                          rg_numero, rg_data_emissao, rg_orgao_emissor, rg_uf_emissor,
                          ctps_numero, ctps_serie, ctps_data_emissao, ctps_uf_emissora, pis_pasep,
                          titulo_eleitor_numero, titulo_eleitor_zona, titulo_eleitor_secao,
                          titulo_eleitor_uf, titulo_eleitor_cidade,
                          reservista_numero, reservista_ra, reservista_serie,
                          cnh_numero, cnh_data_emissao, cnh_validade, cnh_categoria,
                          deficiencia_tipo, deficiencia_observacoes, qtd_dependentes_ir,
                          status_dados, observacoes
                        ) VALUES (
                          {esc(external_id)}, {esc(nome)}, {esc(nome_social)}, {esc(cpf)}, {esc(data_nasc)},
                          {esc(sexo)}, {esc(genero_doc)}, {esc(estado_civil)}, {esc(raca_cor)},
                          {esc(uf_natal)}, {esc(cidade_natal)}, {esc(nome_mae)}, {esc(nome_pai)},
                          {esc(email_pessoal)}, {esc(email_prof)}, {esc(celular)}, {esc(telefone)},
                          {esc(log)}, {esc(num)}, {esc(compl)},
                          {esc(bairro)}, {esc(cidade)}, {esc(uf)}, {esc(cep)},
                          {esc(rg_num)}, {esc(rg_emit)}, {esc(rg_org)}, {esc(rg_uf)},
                          {esc(ctps_num)}, {esc(ctps_serie)}, {esc(ctps_emit)}, {esc(ctps_uf)}, {esc(pis)},
                          {esc(te_num)}, {esc(te_zona)}, {esc(te_secao)},
                          {esc(te_uf)}, {esc(te_cidade)},
                          {esc(res_num)}, {esc(res_ra)}, {esc(res_serie)},
                          {esc(cnh_num)}, {esc(cnh_emit)}, {esc(cnh_val)}, {esc(cnh_cat)},
                          {esc(def_tipo)}, {esc(def_obs)}, {qtd_dep_int},
                          {esc('completo' if cpf else 'incompleto')},
                          'Importado de Convenia em {datetime.utcnow().isoformat()}Z'
                        ) RETURNING id
                    """)
                    colab_id = rows_ins[0]["id"]
                    stats["colab_criados"] += 1

            if cpf and colab_id != "<DRY>": _cache["colab_por_cpf"][cpf] = colab_id

            # ─ Estrangeiro (1:1 opt-in) ─
            reside_brasil = parse_bool_pt(g(row, "Estrangeiro - Reside no Brasil"))
            if reside_brasil is False and colab_id != "<DRY>":  # explicit não → opt-in
                if not dry:
                    sql(f"""
                        INSERT INTO rh.colaborador_estrangeiro (
                          colaborador_id, reside_no_brasil, pais_origem, tipo_visto,
                          data_chegada, data_naturalizacao, condicao_ingresso,
                          casado_com_brasileiro, tem_filho_brasileiro,
                          cep_exterior, descricao_logradouro_exterior, endereco_exterior,
                          numero_exterior, complemento_exterior, bairro_exterior, cidade_exterior
                        ) VALUES (
                          {esc(colab_id)}, false,
                          {esc(normalize(g(row, "Estrangeiro - País")))},
                          {esc(normalize(g(row, "Estrangeiro - Tipo de visto")))},
                          {esc(parse_date_br(g(row, "Estrangeiro - Data de chegada")))},
                          {esc(parse_date_br(g(row, "Estrangeiro - Data de naturalização")))},
                          {esc(normalize(g(row, "Estrangeiro - Condição de ingresso")))},
                          {esc(parse_bool_pt(g(row, "Estrangeiro - Casado(a) com Brasileiro(a)?")))},
                          {esc(parse_bool_pt(g(row, "Estrangeiro - Tem filho(a) Brasileiro(a)?")))},
                          {esc(normalize(g(row, "Estrangeiro - CEP no exterior")))},
                          {esc(normalize(g(row, "Estrangeiro - Descrição do logradouro")))},
                          {esc(normalize(g(row, "Estrangeiro - Endereço no exterior")))},
                          {esc(normalize(g(row, "Estrangeiro - Número no exterior")))},
                          {esc(normalize(g(row, "Estrangeiro - Complemento no exterior")))},
                          {esc(normalize(g(row, "Estrangeiro - Bairro/Distrito no exterior")))},
                          {esc(normalize(g(row, "Estrangeiro - Cidade no exterior")))}
                        ) ON CONFLICT (colaborador_id) DO NOTHING
                    """)
                    stats["estrangeiros"] += 1

            # ─ Org / Cargo / Sindicato ─
            dept_nome = normalize(g(row, "Informações de trabalho - Departamento"))
            time_nome = normalize(g(row, "Informações de trabalho - Time"))
            cargo_nome = normalize(g(row, "Informações de trabalho - Cargo"))
            cc_nome = normalize(g(row, "Informações de trabalho - Centro de custo"))
            cbo = normalize(g(row, "Informações de trabalho - CBO"))
            cargo_desc = normalize(g(row, "Informações de trabalho - Descrição do cargo"))
            salario = g(row, "Informações de trabalho - Salário")
            salario = float(salario) if isinstance(salario, (int, float)) else None

            dept_id = get_or_create_dept(empresa_id, dept_nome, dry) if dept_nome else None
            time_id = get_or_create_time(empresa_id, dept_id, time_nome, dry) if time_nome else None
            cargo_id = get_or_create_cargo(empresa_id, cargo_nome, salario, cbo, cargo_desc, dry) if cargo_nome else None
            cc_id = get_or_create_centro_custo(empresa_id, cc_nome, dry) if cc_nome else None

            # Sindicato
            sind_nome = normalize(g(row, "Informações de trabalho - Sindicato"))
            sind_id = None
            if sind_nome:
                sind_id = get_or_create_sindicato(
                    sind_nome,
                    g(row, "Informações de trabalho - Sindicato - CNPJ"),
                    normalize(g(row, "Informações de trabalho - Sindicato - Website")),
                    normalize(g(row, "Informações de trabalho - Sindicato - Telefone")),
                    normalize(g(row, "Informações de trabalho - Sindicato - Database")),
                    dry,
                )

            # ─ Contrato ─
            matricula = g(row, "Informações de trabalho - Matrícula")
            matricula_str = (str(int(matricula)) if isinstance(matricula, (int, float))
                             else (str(matricula) if matricula else None))
            data_adm = parse_date_br(g(row, "Informações de trabalho - Data de admissão"))
            data_term_apr = parse_date_br(g(row, "Informações de trabalho - Data de término do contrato de aprendiz"))
            vinculo = normalize(g(row, "Informações de trabalho - Vínculo"))
            tipo_admissao = normalize(g(row, "Informações de trabalho - Tipo de admissão"))
            forma_pgto = normalize(g(row, "Informações de trabalho - Forma de pagamento"))
            tipo_sal = normalize(g(row, "Informações de trabalho - Tipo de salário"))
            hora_contr = g(row, "Informações de trabalho - Hora contratual")
            hora_contr_num = float(hora_contr) if isinstance(hora_contr, (int, float)) else None
            cargo_conf = parse_bool_pt(g(row, "Informações de trabalho - Cargo de confiança"))
            estabilidade = normalize(g(row, "Informações de trabalho - Estabilidade"))
            primeiro_emp = parse_bool_pt(g(row, "Informações de trabalho - Primeiro emprego"))
            data_exame = parse_date_br(g(row, "Informações de trabalho - Data do exame admissional"))
            aposentado = parse_bool_pt(g(row, "Informações de trabalho - Aposentado"))
            seg_des = parse_bool_pt(g(row, "Informações de trabalho - Tem seguro desemprego?"))
            cipa = parse_bool_pt(g(row, "Informações de trabalho - CIPA"))
            reg_ponto = parse_bool_pt(g(row, "Informações de trabalho - Possui registro de ponto?"))
            insc_orgao = normalize(g(row, "Informações de trabalho - Inscrição no órgão de classe"))
            conselho = normalize(g(row, "Informações de trabalho - Conselho profissional"))
            cota_apr = parse_bool_pt(g(row, "Informações de trabalho - Este cargo deve ser considerado para cota aprendiz?"))
            senior = normalize(g(row, "Informações de trabalho - Senioridade"))
            nivel_sen = normalize(g(row, "Informações de trabalho - Nível de senioridade"))
            jornada = normalize(g(row, "Jornada de trabalho - Jornada de trabalho"))
            jornada_motivo = normalize(g(row, "Jornada de trabalho - Motivo da jornada"))
            jornada_obs = normalize(g(row, "Jornada de trabalho - Observações"))
            horas_mens = g(row, "Horas mensais")
            horas_mens_num = float(horas_mens) if isinstance(horas_mens, (int, float)) else None
            regime_jorn = normalize(g(row, "Regime de jornada do colaborador"))
            per_exp = g(row, "Período de experiência - Período")
            per_exp_int = int(per_exp) if isinstance(per_exp, (int, float)) else None
            per_1term = parse_date_br(g(row, "Período de experiência - Primeiro término"))
            per_2term = parse_date_br(g(row, "Período de experiência - Segundo término"))
            per_dias = g(row, "Período de experiência - Dias totais")
            per_dias_int = int(per_dias) if isinstance(per_dias, (int, float)) else None

            tipo_contrato = "CLT"
            if vinculo and "JURIDICA" in slug(vinculo): tipo_contrato = "PJ"
            elif vinculo and "ESTAGIO" in slug(vinculo): tipo_contrato = "estagio"
            elif vinculo and "APRENDIZ" in slug(vinculo): tipo_contrato = "aprendiz"
            if data_term_apr and tipo_contrato == "CLT": tipo_contrato = "aprendiz"

            # Status default
            status = "ativo"
            data_demissao = parse_date_br(g(row, "Desligados - Data de desligamento"))
            if data_demissao: status = "desligado"

            # ─ Verifica se contrato já existe ─
            if matricula_str:
                cur = sql(f"SELECT id FROM rh.contratos WHERE empresa_id = {esc(empresa_id)} "
                          f"AND matricula = {esc(matricula_str)} LIMIT 1")
            else:
                cur = sql(f"SELECT id FROM rh.contratos WHERE colaborador_id = {esc(colab_id)} "
                          f"AND empresa_id = {esc(empresa_id)} "
                          f"AND COALESCE(data_admissao::text,'') = COALESCE({esc(data_adm)},'') LIMIT 1")
            if cur:
                contrato_id = cur[0]["id"]
                stats["contratos_existentes"] += 1
            elif dry:
                contrato_id = "<DRY>"
            else:
                rows_ins = sql(f"""
                    INSERT INTO rh.contratos (
                      colaborador_id, empresa_id, matricula,
                      cargo_id, departamento_id, time_id, centro_custo_rh_id,
                      sindicato_id,
                      salario_base, tipo_salario, forma_pagamento, hora_contratual,
                      data_admissao, data_termino_contrato, data_exame_admissional,
                      data_demissao,
                      vinculo, tipo_admissao, tipo_contrato, cota_aprendiz,
                      senioridade, nivel_senioridade,
                      jornada_descricao, jornada_motivo, jornada_observacoes,
                      horas_mensais, regime_jornada,
                      periodo_experiencia_dias, primeiro_termino_experiencia, segundo_termino_experiencia,
                      cargo_confianca, estabilidade, primeiro_emprego, aposentado,
                      seguro_desemprego, cipa, registro_ponto,
                      inscricao_orgao_classe, conselho_profissional,
                      status
                    ) VALUES (
                      {esc(colab_id)}, {esc(empresa_id)}, {esc(matricula_str)},
                      {esc(cargo_id)}, {esc(dept_id)}, {esc(time_id)}, {esc(cc_id)},
                      {esc(sind_id)},
                      {esc(salario or 0)}, {esc(tipo_sal)}, {esc(forma_pgto)}, {esc(hora_contr_num)},
                      {esc(data_adm or datetime.utcnow().date().isoformat())},
                      {esc(data_term_apr)}, {esc(data_exame)},
                      {esc(data_demissao)},
                      {esc(vinculo)}, {esc(tipo_admissao)}, {esc(tipo_contrato)},
                      {esc(cota_apr or False)},
                      {esc(senior)}, {esc(nivel_sen)},
                      {esc(jornada)}, {esc(jornada_motivo)}, {esc(jornada_obs)},
                      {esc(horas_mens_num)}, {esc(regime_jorn)},
                      {esc(per_exp_int)}, {esc(per_1term)}, {esc(per_2term)},
                      {esc(cargo_conf or False)}, {esc(estabilidade)}, {esc(primeiro_emp or False)},
                      {esc(aposentado or False)},
                      {esc(seg_des)}, {esc(cipa or False)}, {esc(reg_ponto or True)},
                      {esc(insc_orgao)}, {esc(conselho)},
                      {esc(status)}
                    ) RETURNING id
                """)
                contrato_id = rows_ins[0]["id"]
                stats["contratos_criados"] += 1

            # ─ Contabilidade dados (1:1) ─
            if not dry and contrato_id != "<DRY>":
                sql(f"""
                    INSERT INTO rh.contabilidade_dados (
                      contrato_id, tipo_regime_previdenciario, natureza_atividade,
                      indicativo_admissao, numero_processo, cota_pcd,
                      apolice_seguro_estagiario, fgts_optante, agente_nocivo,
                      imovel_proprio, imovel_adquirido_fgts
                    ) VALUES (
                      {esc(contrato_id)},
                      {esc(normalize(g(row, "Contabilidade - Tipo de regime previdenciário")))},
                      {esc(normalize(g(row, "Contabilidade - Natureza da atividade")))},
                      {esc(normalize(g(row, "Contabilidade - Indicativo de admissão")))},
                      {esc(normalize(g(row, "Contabilidade - Número do processo")))},
                      {esc(parse_bool_pt(g(row, "Contabilidade - Colaborador preenche cota de pessoas com deficiência?")))},
                      {esc(normalize(g(row, "Contabilidade - Número da apólice do seguro para estagiário")))},
                      {esc(parse_bool_pt(g(row, "Contabilidade - Optante FGTS?")))},
                      {esc(normalize(g(row, "Contabilidade - Agente nocivo")))},
                      {esc(parse_bool_pt(g(row, "Contabilidade - Possui imóvel próprio?")))},
                      {esc(parse_bool_pt(g(row, "Contabilidade - Adquirido com FGTS?")))}
                    ) ON CONFLICT (contrato_id) DO NOTHING
                """)

            # ─ Estágio (1:1 opt-in) ─
            est_inicio = parse_date_br(g(row, "Informações para estagiário - Data de início do estágio"))
            if est_inicio and not dry and contrato_id != "<DRY>":
                sql(f"""
                    INSERT INTO rh.estagio_info (
                      contrato_id, data_inicio, data_termino, natureza_estagio,
                      instituicao_ensino, cnpj_instituicao,
                      cep_instituicao, endereco_instituicao, numero_instituicao,
                      complemento_instituicao, bairro_instituicao, uf_instituicao, cidade_instituicao
                    ) VALUES (
                      {esc(contrato_id)},
                      {esc(est_inicio)},
                      {esc(parse_date_br(g(row, "Informações para estagiário - Data de término do estágio")))},
                      {esc(normalize(g(row, "Informações para estagiário - Natureza do estágio")))},
                      {esc(normalize(g(row, "Informações para estagiário - Instituição de ensino")))},
                      {esc(normalize(g(row, "Informações para estagiário - CNPJ da instituição de ensino")))},
                      {esc(normalize(g(row, "Informações para estagiário - CEP")))},
                      {esc(normalize(g(row, "Informações para estagiário - Endereço")))},
                      {esc(normalize(g(row, "Informações para estagiário - Número")))},
                      {esc(normalize(g(row, "Informações para estagiário - Complemento")))},
                      {esc(normalize(g(row, "Informações para estagiário - Bairro")))},
                      {esc(normalize(g(row, "Informações para estagiário - UF")))},
                      {esc(normalize(g(row, "Informações para estagiário - Cidade")))}
                    ) ON CONFLICT (contrato_id) DO NOTHING
                """)
                stats["estagios"] += 1

            # ─ EPI tamanhos (1:1) ─
            cam = normalize(g(row, "TAMANHO CAMISETA"))
            cal = normalize(g(row, "TAMANHO CALÇA"))
            bot = normalize(g(row, "TAMANHO BOTA"))
            if (cam or cal or bot) and not dry and colab_id != "<DRY>":
                sql(f"""
                    INSERT INTO rh.epi_tamanhos (colaborador_id, camiseta, calca, bota)
                    VALUES ({esc(colab_id)}, {esc(cam)}, {esc(cal)}, {esc(bot)})
                    ON CONFLICT (colaborador_id) DO UPDATE SET
                      camiseta = EXCLUDED.camiseta,
                      calca = EXCLUDED.calca,
                      bota = EXCLUDED.bota,
                      updated_at = now()
                """)
                stats["epi"] += 1

            # ─ Desligamento ─
            if data_demissao and not dry and contrato_id != "<DRY>":
                tipo_des = normalize(g(row, "Desligados - Tipo de desligamento"))
                aviso = normalize(g(row, "Desligados - Aviso prévio"))
                quebra = parse_bool_pt(g(row, "Desligados - Quebra de contrato?"))
                data_remocao = parse_date_br(g(row, "Desligados - Data da remoção de acesso à plataforma"))
                data_envio_cont = parse_date_br(g(row, "Desligados - Data de envio a contabilidade"))
                desv_ben = parse_bool_pt(g(row, "Desligados - Desvincular benefícios?"))
                motivo_des = normalize(g(row, "Desligados - Motivo do desligamento"))
                obs_des = normalize(g(row, "Desligados - Observações"))
                data_aviso = parse_date_br(g(row, "Desligados - Data de aviso pŕevio"))

                cur = sql(f"SELECT id FROM rh.desligamentos WHERE contrato_id = {esc(contrato_id)} LIMIT 1")
                if not cur:
                    sql(f"""
                        INSERT INTO rh.desligamentos (
                          contrato_id, data_desligamento, motivo, aviso_previo_tipo, observacao, status
                        ) VALUES (
                          {esc(contrato_id)}, {esc(data_demissao)},
                          {esc(motivo_des or tipo_des or 'desligamento')},
                          {esc(aviso)}, {esc(obs_des)}, 'concluido'
                        )
                    """)
                    stats["desligamentos"] += 1

            stats["total"] += 1
            if i % 25 == 0:
                print(f"   ...{i}/{len(rows)} processados")

        except Exception as e:
            stats["erros"].append({"linha": i, "nome": str(row[0])[:50] if row[0] else "?", "erro": str(e)[:200]})


# ─── Outras abas ────────────────────────────────────────────────────────────
def find_colab_by_cpf(cpf: str) -> Optional[str]:
    cpf_clean = clean_cpf(cpf)
    if not cpf_clean: return None
    if cpf_clean in _cache["colab_por_cpf"]: return _cache["colab_por_cpf"][cpf_clean]
    rows = sql(f"SELECT id FROM rh.colaboradores WHERE cpf = {esc(cpf_clean)} LIMIT 1")
    if rows:
        _cache["colab_por_cpf"][cpf_clean] = rows[0]["id"]
        return rows[0]["id"]
    return None


def find_colab_by_nome(nome: str) -> Optional[str]:
    nome = normalize(nome)
    if not nome: return None
    rows = sql(f"SELECT id FROM rh.colaboradores WHERE upper(nome) = upper({esc(nome)}) LIMIT 1")
    return rows[0]["id"] if rows else None


def find_contrato_by_colab(colab_id: str, empresa_id: Optional[str] = None) -> Optional[str]:
    cond = f"colaborador_id = {esc(colab_id)}"
    if empresa_id: cond += f" AND empresa_id = {esc(empresa_id)}"
    rows = sql(f"SELECT id FROM rh.contratos WHERE {cond} ORDER BY data_admissao DESC LIMIT 1")
    return rows[0]["id"] if rows else None


def process_nacionalidades(rows, headers, dry, stats):
    idx = {h: i for i, h in enumerate(headers)}
    for row in rows:
        cpf = row[idx.get("CPF do colaborador", 2)]
        nac = normalize(row[idx.get("Informações pessoais - Nacionalidade", 3)])
        if not nac: continue
        colab_id = find_colab_by_cpf(cpf) or find_colab_by_nome(row[idx.get("Nome do colaborador", 1)])
        if not colab_id: continue
        if dry: stats["nacionalidades"] += 1; continue
        sql(f"INSERT INTO rh.colaborador_nacionalidades (colaborador_id, nacionalidade) "
            f"VALUES ({esc(colab_id)}, {esc(nac)}) ON CONFLICT DO NOTHING")
        stats["nacionalidades"] += 1


def process_contatos_emergencia(rows, headers, dry, stats):
    idx = {h: i for i, h in enumerate(headers)}
    g = lambda r, k: r[idx[k]] if k in idx else None
    for row in rows:
        nome_contato = normalize(g(row, "Contatos de emergência - Nome"))
        if not nome_contato: continue
        cpf = g(row, "CPF do colaborador")
        colab_id = find_colab_by_cpf(cpf) or find_colab_by_nome(g(row, "Nome do colaborador"))
        if not colab_id: continue
        if dry: stats["contatos_emerg"] += 1; continue
        sql(f"""
            INSERT INTO rh.contatos_emergencia (
              colaborador_id, nome, relacao, telefone, telefone_comercial, celular, email
            ) VALUES (
              {esc(colab_id)}, {esc(nome_contato)},
              {esc(normalize(g(row, "Contatos de emergência - Relação")))},
              {esc(normalize(g(row, "Contatos de emergência - Telefone")))},
              {esc(normalize(g(row, "Contatos de emergência - Telefone comercial")))},
              {esc(normalize(g(row, "Contatos de emergência - Celular")))},
              {esc(normalize(g(row, "Contatos de emergência - E-mail")))}
            )
        """)
        stats["contatos_emerg"] += 1


def process_dados_bancarios(rows, headers, dry, stats):
    idx = {h: i for i, h in enumerate(headers)}
    g = lambda r, k: r[idx[k]] if k in idx else None
    seen_principal = set()
    for row in rows:
        banco = normalize(g(row, "Dados bancários - Banco"))
        if not banco: continue
        cpf = g(row, "CPF do colaborador")
        colab_id = find_colab_by_cpf(cpf) or find_colab_by_nome(g(row, "Nome do colaborador"))
        if not colab_id: continue
        principal = colab_id not in seen_principal
        seen_principal.add(colab_id)
        if dry: stats["bancarios"] += 1; continue
        sql(f"""
            INSERT INTO rh.dados_bancarios (
              colaborador_id, banco_nome, tipo, modalidade, agencia, conta, digito, pix_chave, principal
            ) VALUES (
              {esc(colab_id)}, {esc(banco)},
              CASE WHEN upper({esc(normalize(g(row, "Dados bancários - Tipo de conta")))}) LIKE '%POUPAN%' THEN 'poupanca'
                   WHEN upper({esc(normalize(g(row, "Dados bancários - Tipo de conta")))}) LIKE '%SALAR%' THEN 'salario'
                   ELSE 'corrente' END,
              {esc(normalize(g(row, "Dados bancários - Modalidade")))},
              {esc(normalize(g(row, "Dados bancários - Agência bancária")))},
              {esc(normalize(g(row, "Dados bancários - Conta bancária")))},
              {esc(normalize(g(row, "Dados bancários - Dígito")))},
              {esc(normalize(g(row, "Dados bancários - PIX")))},
              {esc(principal)}
            )
        """)
        stats["bancarios"] += 1


def process_formacao(rows, headers, dry, stats):
    idx = {h: i for i, h in enumerate(headers)}
    g = lambda r, k: r[idx[k]] if k in idx else None
    for row in rows:
        esc_grau = normalize(g(row, "Formação acadêmica - Escolaridade"))
        if not esc_grau: continue
        cpf = g(row, "CPF do colaborador")
        colab_id = find_colab_by_cpf(cpf) or find_colab_by_nome(g(row, "Nome do colaborador"))
        if not colab_id: continue
        if dry: stats["formacao"] += 1; continue
        sql(f"""
            INSERT INTO rh.formacao_academica (
              colaborador_id, escolaridade, instituicao, curso, ano_conclusao
            ) VALUES (
              {esc(colab_id)}, {esc(esc_grau)},
              {esc(normalize(g(row, "Formação acadêmica - Instituição de ensino")))},
              {esc(normalize(g(row, "Formação acadêmica - Curso")))},
              {esc(parse_year(g(row, "Formação acadêmica - Ano de conclusão")))}
            )
        """)
        stats["formacao"] += 1


def process_dependentes(rows, headers, dry, stats):
    idx = {h: i for i, h in enumerate(headers)}
    g = lambda r, k: r[idx[k]] if k in idx else None
    for row in rows:
        nome_dep = normalize(g(row, "Informações de dependentes - Nome"))
        if not nome_dep: continue
        cpf_colab = g(row, "CPF do colaborador")
        colab_id = find_colab_by_cpf(cpf_colab) or find_colab_by_nome(g(row, "Nome do colaborador"))
        if not colab_id: continue
        if dry: stats["dependentes"] += 1; continue
        sql(f"""
            INSERT INTO rh.dependentes (
              colaborador_id, nome, parentesco, irrf, data_nascimento, cpf, nome_mae,
              telefone, email, descricao, incapacidade_fisica_mental, estrangeiro,
              genero_documento, escolaridade, renda_familiar
            ) VALUES (
              {esc(colab_id)}, {esc(nome_dep)},
              {esc(normalize(g(row, "Informações de dependentes - Relação")))},
              {esc(parse_bool_pt(g(row, "Informações de dependentes - Incluir para fins de imposto de renda")) or False)},
              {esc(parse_date_br(g(row, "Informações de dependentes - Data de aniversário")))},
              {esc(clean_cpf(g(row, "Informações de dependentes - CPF")))},
              {esc(normalize(g(row, "Informações de dependentes - Nome da mãe")))},
              {esc(normalize(g(row, "Informações de dependentes - Telefone")))},
              {esc(normalize(g(row, "Informações de dependentes - E-mail")))},
              {esc(normalize(g(row, "Informações de dependentes - Descrição")))},
              {esc(parse_bool_pt(g(row, "Informações de dependentes - Dependente possui incapacidade física ou mental para trabalho?")))},
              {esc(parse_bool_pt(g(row, "Informações de dependentes - Estrangeiro")))},
              {esc(normalize(g(row, "Informações de dependentes - Gênero no documento")))},
              {esc(normalize(g(row, "Informações de dependentes - Escolaridade")))},
              {esc(parse_bool_pt(g(row, "Informações de dependentes - Renda familiar")))}
            )
        """)
        stats["dependentes"] += 1


def process_historico_salarios(rows, headers, dry, stats):
    idx = {h: i for i, h in enumerate(headers)}
    g = lambda r, k: r[idx[k]] if k in idx else None
    for row in rows:
        cpf = g(row, "CPF do colaborador")
        colab_id = find_colab_by_cpf(cpf) or find_colab_by_nome(g(row, "Nome do colaborador"))
        if not colab_id: continue
        contrato_id = find_contrato_by_colab(colab_id)
        if not contrato_id: continue

        salario = g(row, "Salário")
        salario = float(salario) if isinstance(salario, (int, float)) else None
        data_de = parse_date_br(g(row, "De"))
        if not data_de: continue
        data_ate = parse_date_br(g(row, "Até"))
        if dry: stats["historico"] += 1; continue
        sql(f"""
            INSERT INTO rh.contrato_alteracoes (
              contrato_id, data_de, data_ate, vinculo, categoria_trabalhador,
              cargo_snapshot, departamento_snapshot, time_snapshot, centro_custo_snapshot,
              salario, senioridade, nivel_senioridade, motivo, descricao
            ) VALUES (
              {esc(contrato_id)}, {esc(data_de)}, {esc(data_ate)},
              {esc(normalize(g(row, "Vínculo")))},
              {esc(normalize(g(row, "Categoria de trabalhadores")))},
              {esc(normalize(g(row, "Cargo")))},
              {esc(normalize(g(row, "Departamento")))},
              {esc(normalize(g(row, "Time")))},
              {esc(normalize(g(row, "Centro de custo")))},
              {esc(salario)},
              {esc(normalize(g(row, "Senioridade")))},
              {esc(normalize(g(row, "Nível de senioridade")))},
              {esc(normalize(g(row, "Motivo")))},
              {esc(normalize(g(row, "Descrição")))}
            )
        """)
        stats["historico"] += 1


# ─── Main ───────────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--xlsx", default="/tmp/rh_completo.xlsx")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--default-empresa", default=None)
    args = p.parse_args()

    if not os.path.exists(args.xlsx):
        sys.exit(f"Arquivo não encontrado: {args.xlsx}")

    print(f"📂 Lendo {args.xlsx} ...")
    wb = load_workbook(args.xlsx, read_only=True, data_only=True)

    stats = {"total": 0, "colab_criados": 0, "colab_existentes": 0,
             "contratos_criados": 0, "contratos_existentes": 0,
             "estrangeiros": 0, "estagios": 0, "epi": 0, "desligamentos": 0,
             "nacionalidades": 0, "contatos_emerg": 0, "bancarios": 0,
             "formacao": 0, "dependentes": 0, "historico": 0,
             "erros": []}

    # ─ Aba 1: Worksheet ─
    ws = wb["Worksheet"]
    rows = list(ws.iter_rows(values_only=True))
    print(f"\n=== Aba 'Worksheet' ({len(rows)-1} colaboradores) ===")
    process_worksheet(rows[1:], rows[0], args.dry_run, args.default_empresa, stats)

    # ─ Aba 2: Nacionalidades ─
    ws = wb["Nacionalidades"]
    rows = list(ws.iter_rows(values_only=True))
    print(f"\n=== Aba 'Nacionalidades' ({len(rows)-1}) ===")
    process_nacionalidades(rows[1:], rows[0], args.dry_run, stats)

    # ─ Aba 3: Contatos de emergência ─
    ws = wb["Contatos de emergência"]
    rows = list(ws.iter_rows(values_only=True))
    print(f"\n=== Aba 'Contatos de emergência' ({len(rows)-1}) ===")
    process_contatos_emergencia(rows[1:], rows[0], args.dry_run, stats)

    # ─ Aba 4: Dados bancários ─
    ws = wb["Dados bancários"]
    rows = list(ws.iter_rows(values_only=True))
    print(f"\n=== Aba 'Dados bancários' ({len(rows)-1}) ===")
    process_dados_bancarios(rows[1:], rows[0], args.dry_run, stats)

    # ─ Aba 6: Formação acadêmica ─
    ws = wb["Formação acadêmica"]
    rows = list(ws.iter_rows(values_only=True))
    print(f"\n=== Aba 'Formação acadêmica' ({len(rows)-1}) ===")
    process_formacao(rows[1:], rows[0], args.dry_run, stats)

    # ─ Aba 7: Informações do dependente ─
    ws = wb["Informações do dependente"]
    rows = list(ws.iter_rows(values_only=True))
    print(f"\n=== Aba 'Informações do dependente' ({len(rows)-1}) ===")
    process_dependentes(rows[1:], rows[0], args.dry_run, stats)

    # ─ Aba 8: Histórico cargos e salários ─
    ws = wb["Histórico cargos e salários"]
    rows = list(ws.iter_rows(values_only=True))
    print(f"\n=== Aba 'Histórico cargos e salários' ({len(rows)-1}) ===")
    process_historico_salarios(rows[1:], rows[0], args.dry_run, stats)

    # Faltas e afastamentos: aba vazia, skip

    print()
    print("═" * 60)
    print(f"{'DRY RUN' if args.dry_run else 'EXECUTADO'} — Resumo")
    print("═" * 60)
    print(f"  Colaboradores processados : {stats['total']}")
    print(f"     → criados              : {stats['colab_criados']}")
    print(f"     → já existiam          : {stats['colab_existentes']}")
    print(f"  Contratos criados         : {stats['contratos_criados']}")
    print(f"  Contratos existentes      : {stats['contratos_existentes']}")
    print(f"  Estrangeiros (1:1)        : {stats['estrangeiros']}")
    print(f"  Estágios (1:1)            : {stats['estagios']}")
    print(f"  EPI tamanhos (1:1)        : {stats['epi']}")
    print(f"  Desligamentos             : {stats['desligamentos']}")
    print(f"  Nacionalidades (multi)    : {stats['nacionalidades']}")
    print(f"  Contatos emergência       : {stats['contatos_emerg']}")
    print(f"  Dados bancários           : {stats['bancarios']}")
    print(f"  Formação acadêmica        : {stats['formacao']}")
    print(f"  Dependentes IR            : {stats['dependentes']}")
    print(f"  Histórico salarial (alts) : {stats['historico']}")
    print(f"  Erros                     : {len(stats['erros'])}")
    if stats["erros"]:
        print("\n  Primeiros erros:")
        for e in stats["erros"][:10]:
            print(f"    L{e['linha']} ({e['nome']}): {e['erro']}")


if __name__ == "__main__":
    main()
