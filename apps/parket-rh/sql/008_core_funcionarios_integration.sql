-- ============================================================
-- Migration: Integração core.funcionarios ← rh.colaboradores
-- Data: 2026-05-19
--
-- `core.funcionarios` vira VIEW sobre rh.colaboradores + rh.contratos
-- + rh.beneficios + rh.dados_bancarios. Edição bidirecional via
-- INSTEAD OF triggers — frontend do core continua chamando
-- supabase.from("funcionarios").update/delete sem precisar mudar.
--
-- Criação de NOVOS funcionários é bloqueada via INSTEAD OF INSERT —
-- admissão deve passar pelo onboarding do RH (rh.parket.works).
-- ============================================================

-- 1. Adiciona dia_pagamento em rh.contratos (não existia)
ALTER TABLE rh.contratos
  ADD COLUMN IF NOT EXISTS dia_pagamento int DEFAULT 5
    CHECK (dia_pagamento BETWEEN 1 AND 31);

-- 2. Helper: mapeia vínculo RH → core
CREATE OR REPLACE FUNCTION core._map_vinculo_rh_to_core(tipo_contrato text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(tipo_contrato, ''))
    WHEN 'clt' THEN 'CLT'
    WHEN 'pj' THEN 'PJ'
    WHEN 'autonomo' THEN 'freelance'
    WHEN 'aprendiz' THEN 'estagio'
    WHEN 'estagio' THEN 'estagio'
    WHEN 'temporario' THEN 'CLT'
    WHEN 'intermitente' THEN 'CLT'
    WHEN 'diretor' THEN 'socio'
    ELSE 'CLT'
  END;
$$;

CREATE OR REPLACE FUNCTION core._map_vinculo_core_to_rh(vinculo text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(vinculo, ''))
    WHEN 'clt' THEN 'CLT'
    WHEN 'pj' THEN 'PJ'
    WHEN 'mei' THEN 'PJ'
    WHEN 'estagio' THEN 'estagio'
    WHEN 'freelance' THEN 'autonomo'
    WHEN 'socio' THEN 'diretor'
    ELSE 'CLT'
  END;
$$;

-- 3. Drop tabela antiga (estava vazia, conferimos)
DROP TABLE IF EXISTS core.funcionarios CASCADE;

-- 4. View core.funcionarios
CREATE OR REPLACE VIEW core.funcionarios AS
SELECT
  c.id,
  ct.empresa_id,
  c.nome,
  c.cpf AS documento,
  COALESCE(c.email_profissional, c.email_pessoal) AS email,
  COALESCE(c.celular, c.telefone_residencial) AS telefone,
  cg.nome AS cargo,
  dp.nome AS setor,
  core._map_vinculo_rh_to_core(ct.tipo_contrato) AS vinculo,
  ct.data_admissao,
  ct.data_demissao,
  COALESCE(ct.salario_base, 0)::numeric AS salario_base,
  COALESCE((SELECT SUM(b.valor_mensal)::numeric FROM rh.beneficios b
            WHERE b.contrato_id = ct.id AND b.ativo AND b.tipo = 'VT'), 0) AS vale_transporte,
  COALESCE((SELECT SUM(b.valor_mensal)::numeric FROM rh.beneficios b
            WHERE b.contrato_id = ct.id AND b.ativo AND b.tipo = 'VR'), 0) AS vale_refeicao,
  COALESCE((SELECT SUM(b.valor_mensal)::numeric FROM rh.beneficios b
            WHERE b.contrato_id = ct.id AND b.ativo AND b.tipo = 'plano_saude'), 0) AS plano_saude,
  COALESCE((SELECT SUM(b.valor_mensal)::numeric FROM rh.beneficios b
            WHERE b.contrato_id = ct.id AND b.ativo
              AND b.tipo NOT IN ('VT','VR','plano_saude')), 0) AS outros_beneficios,
  db.banco_nome AS banco,
  db.agencia,
  CASE WHEN db.conta IS NOT NULL AND db.digito IS NOT NULL
       THEN db.conta || '-' || db.digito
       ELSE db.conta
  END AS conta,
  db.pix_chave AS pix,
  COALESCE(ct.dia_pagamento, 5) AS dia_pagamento,
  c.observacoes,
  (ct.status = 'ativo' AND c.deleted_at IS NULL) AS ativo,
  c.created_at,
  GREATEST(c.updated_at, ct.updated_at) AS updated_at
FROM rh.colaboradores c
-- LATERAL pra pegar O contrato mais recente do colaborador (ativos primeiro)
LEFT JOIN LATERAL (
  SELECT * FROM rh.contratos
  WHERE colaborador_id = c.id AND deleted_at IS NULL
  ORDER BY (status = 'ativo') DESC, data_admissao DESC
  LIMIT 1
) ct ON true
LEFT JOIN rh.cargos cg ON cg.id = ct.cargo_id
LEFT JOIN rh.departamentos dp ON dp.id = ct.departamento_id
-- Dados bancários principais (1 por colaborador)
LEFT JOIN LATERAL (
  SELECT * FROM rh.dados_bancarios
  WHERE colaborador_id = c.id AND ativo
  ORDER BY principal DESC, created_at DESC
  LIMIT 1
) db ON true
WHERE c.deleted_at IS NULL;

COMMENT ON VIEW core.funcionarios IS
  'VIEW editável (INSTEAD OF triggers) sobre rh.colaboradores + rh.contratos. '
  'Frontend do core escreve aqui; triggers propagam pro RH.';

-- 5. Grant pra que o frontend (anon/authenticated) consiga ler/editar
GRANT SELECT, UPDATE, DELETE ON core.funcionarios TO authenticated, service_role;
-- INSERT NÃO concedido — bloqueado via trigger com mensagem específica

-- 6. INSTEAD OF INSERT — bloqueia criação direta pelo core
CREATE OR REPLACE FUNCTION core.funcionarios_block_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING
    MESSAGE = 'Funcionários novos devem ser admitidos pelo RH (rh.parket.works/admissao). Edição de funcionários existentes funciona normalmente aqui.',
    ERRCODE = 'P0001',
    HINT = 'Acesse rh.parket.works → Admissão pra cadastrar.';
END;
$$;

DROP TRIGGER IF EXISTS funcionarios_block_insert_tr ON core.funcionarios;
CREATE TRIGGER funcionarios_block_insert_tr
  INSTEAD OF INSERT ON core.funcionarios
  FOR EACH ROW EXECUTE FUNCTION core.funcionarios_block_insert();

-- 7. INSTEAD OF UPDATE — propaga mudanças pro RH
CREATE OR REPLACE FUNCTION core.funcionarios_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_contrato_id uuid;
  v_cargo_id uuid;
  v_dept_id uuid;
  v_bank_id uuid;
BEGIN
  -- Pega o contrato em uso (mesmo critério da VIEW)
  SELECT id INTO v_contrato_id
  FROM rh.contratos
  WHERE colaborador_id = OLD.id AND deleted_at IS NULL
  ORDER BY (status = 'ativo') DESC, data_admissao DESC
  LIMIT 1;

  -- ── Campos de rh.colaboradores ──
  UPDATE rh.colaboradores SET
    nome = COALESCE(NEW.nome, nome),
    cpf = COALESCE(NEW.documento, cpf),
    email_profissional = CASE
      WHEN NEW.email IS DISTINCT FROM OLD.email THEN NEW.email
      ELSE email_profissional END,
    celular = CASE
      WHEN NEW.telefone IS DISTINCT FROM OLD.telefone THEN NEW.telefone
      ELSE celular END,
    observacoes = COALESCE(NEW.observacoes, observacoes),
    updated_at = now()
  WHERE id = OLD.id;

  -- ── Campos de rh.contratos ──
  IF v_contrato_id IS NOT NULL THEN
    -- Resolver cargo por NOME (se mudou)
    IF NEW.cargo IS DISTINCT FROM OLD.cargo AND NEW.cargo IS NOT NULL THEN
      SELECT id INTO v_cargo_id FROM rh.cargos WHERE nome = NEW.cargo LIMIT 1;
      IF v_cargo_id IS NULL THEN
        INSERT INTO rh.cargos (nome) VALUES (NEW.cargo) RETURNING id INTO v_cargo_id;
      END IF;
    END IF;

    -- Resolver departamento por NOME (se mudou)
    IF NEW.setor IS DISTINCT FROM OLD.setor AND NEW.setor IS NOT NULL THEN
      SELECT id INTO v_dept_id FROM rh.departamentos WHERE nome = NEW.setor LIMIT 1;
      IF v_dept_id IS NULL THEN
        INSERT INTO rh.departamentos (nome) VALUES (NEW.setor) RETURNING id INTO v_dept_id;
      END IF;
    END IF;

    UPDATE rh.contratos SET
      empresa_id = COALESCE(NEW.empresa_id, empresa_id),
      cargo_id = COALESCE(v_cargo_id, cargo_id),
      departamento_id = COALESCE(v_dept_id, departamento_id),
      tipo_contrato = COALESCE(core._map_vinculo_core_to_rh(NEW.vinculo), tipo_contrato),
      data_admissao = COALESCE(NEW.data_admissao, data_admissao),
      data_demissao = NEW.data_demissao,
      salario_base = COALESCE(NEW.salario_base, salario_base),
      dia_pagamento = COALESCE(NEW.dia_pagamento, dia_pagamento),
      status = CASE
        WHEN NEW.ativo IS FALSE AND OLD.ativo IS TRUE THEN 'desligado'
        WHEN NEW.ativo IS TRUE AND OLD.ativo IS FALSE THEN 'ativo'
        ELSE status END,
      updated_at = now()
    WHERE id = v_contrato_id;

    -- ── Benefícios — upsert por tipo ──
    IF NEW.vale_transporte IS DISTINCT FROM OLD.vale_transporte THEN
      PERFORM core._upsert_beneficio(v_contrato_id, 'VT', NEW.vale_transporte);
    END IF;
    IF NEW.vale_refeicao IS DISTINCT FROM OLD.vale_refeicao THEN
      PERFORM core._upsert_beneficio(v_contrato_id, 'VR', NEW.vale_refeicao);
    END IF;
    IF NEW.plano_saude IS DISTINCT FROM OLD.plano_saude THEN
      PERFORM core._upsert_beneficio(v_contrato_id, 'plano_saude', NEW.plano_saude);
    END IF;
    -- outros_beneficios: vai como tipo='outros'
    IF NEW.outros_beneficios IS DISTINCT FROM OLD.outros_beneficios THEN
      PERFORM core._upsert_beneficio(v_contrato_id, 'outros', NEW.outros_beneficios);
    END IF;
  END IF;

  -- ── Dados bancários — upsert no registro principal ──
  IF (NEW.banco, NEW.agencia, NEW.conta, NEW.pix) IS DISTINCT FROM
     (OLD.banco, OLD.agencia, OLD.conta, OLD.pix) THEN
    SELECT id INTO v_bank_id FROM rh.dados_bancarios
    WHERE colaborador_id = OLD.id AND ativo
    ORDER BY principal DESC, created_at DESC LIMIT 1;

    IF v_bank_id IS NULL THEN
      INSERT INTO rh.dados_bancarios
        (colaborador_id, banco_nome, agencia, conta, pix_chave, principal, ativo)
      VALUES (OLD.id, NEW.banco, NEW.agencia, NEW.conta, NEW.pix, true, true);
    ELSE
      UPDATE rh.dados_bancarios SET
        banco_nome = NEW.banco,
        agencia = NEW.agencia,
        conta = NEW.conta,
        pix_chave = NEW.pix,
        updated_at = now()
      WHERE id = v_bank_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Helper: upsert de benefício por tipo
CREATE OR REPLACE FUNCTION core._upsert_beneficio(
  p_contrato_id uuid, p_tipo text, p_valor numeric
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM rh.beneficios
  WHERE contrato_id = p_contrato_id AND tipo = p_tipo AND ativo
  ORDER BY created_at DESC LIMIT 1;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    -- Zerou: desativa o benefício existente
    IF v_id IS NOT NULL THEN
      UPDATE rh.beneficios SET ativo = false, data_fim = CURRENT_DATE, updated_at = now()
      WHERE id = v_id;
    END IF;
  ELSE
    IF v_id IS NULL THEN
      INSERT INTO rh.beneficios (contrato_id, tipo, valor_mensal, data_inicio, ativo)
      VALUES (p_contrato_id, p_tipo, p_valor, CURRENT_DATE, true);
    ELSE
      UPDATE rh.beneficios SET valor_mensal = p_valor, updated_at = now()
      WHERE id = v_id;
    END IF;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS funcionarios_update_tr ON core.funcionarios;
CREATE TRIGGER funcionarios_update_tr
  INSTEAD OF UPDATE ON core.funcionarios
  FOR EACH ROW EXECUTE FUNCTION core.funcionarios_update();

-- 8. INSTEAD OF DELETE — soft delete via desligamento
CREATE OR REPLACE FUNCTION core.funcionarios_soft_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Marca contrato ativo como desligado
  UPDATE rh.contratos
  SET status = 'desligado',
      data_demissao = COALESCE(data_demissao, CURRENT_DATE),
      updated_at = now()
  WHERE colaborador_id = OLD.id AND status = 'ativo';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS funcionarios_delete_tr ON core.funcionarios;
CREATE TRIGGER funcionarios_delete_tr
  INSTEAD OF DELETE ON core.funcionarios
  FOR EACH ROW EXECUTE FUNCTION core.funcionarios_soft_delete();
