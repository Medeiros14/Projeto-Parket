-- Core v2 — Aprovações fase 3: Reembolsos (petty cash / gastos de bolso).
-- Cria tabela nova rh.reembolsos + funções aprovar/rejeitar. Enquanto
-- rh.parket.works não tiver formulário do funcionário, submissão vem via
-- Core (Karla registra no lugar do colaborador). Padrão espelho+write-back:
-- aprovar cria core.lancamentos saida a pagar em N dias.

-- ─── Tabela rh.reembolsos ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rh.reembolsos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id     uuid NOT NULL REFERENCES rh.colaboradores(id),
  contrato_id        uuid REFERENCES rh.contratos(id),
  data_gasto         date NOT NULL,
  categoria          text NOT NULL CHECK (categoria IN
                       ('transporte','alimentacao','material','hospedagem','combustivel','outros')),
  valor              numeric(15,2) NOT NULL CHECK (valor > 0),
  descricao          text NOT NULL,
  comprovante_url    text,           -- upload no Storage (bucket rh-reembolsos)
  obra_id            uuid,           -- opcional: liga o gasto à obra (custo por obra)
  status             text NOT NULL DEFAULT 'pendente' CHECK (status IN
                       ('pendente','aprovado','rejeitado','pago')),
  solicitado_por     text NOT NULL,  -- email de quem registrou (self ou Karla)
  solicitado_em      timestamptz NOT NULL DEFAULT now(),
  aprovado_por_email text,
  aprovado_em        timestamptz,
  rejeitado_por      text,
  rejeitado_em       timestamptz,
  rejeitado_motivo   text,
  data_pagamento     date,
  observacao         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_rh_reembolsos_status      ON rh.reembolsos(status);
CREATE INDEX IF NOT EXISTS ix_rh_reembolsos_colaborador ON rh.reembolsos(colaborador_id);
CREATE INDEX IF NOT EXISTS ix_rh_reembolsos_obra        ON rh.reembolsos(obra_id) WHERE obra_id IS NOT NULL;

-- RLS: mesma política do resto do rh (authenticated full).
ALTER TABLE rh.reembolsos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh reembolsos full" ON rh.reembolsos;
CREATE POLICY "rh reembolsos full" ON rh.reembolsos TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON rh.reembolsos TO authenticated, service_role;

-- ─── FN: aprovar_reembolso ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION core.aprovar_reembolso(
  p_id uuid, p_cria_lancamento boolean DEFAULT true, p_dias_venc integer DEFAULT 3
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_email text; v_rb record; v_col record; v_lanc uuid;
  v_plano uuid; v_centro uuid; v_parceiro uuid;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_rb FROM rh.reembolsos WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'reembolso_nao_encontrado'; END IF;
  IF v_rb.status <> 'pendente' THEN RAISE EXCEPTION 'reembolso_nao_pendente: %', v_rb.status; END IF;

  SELECT * INTO v_col FROM rh.colaboradores WHERE id=v_rb.colaborador_id;

  UPDATE rh.reembolsos
     SET status='aprovado', aprovado_por_email=v_email, aprovado_em=now(), updated_at=now()
   WHERE id=p_id;

  IF p_cria_lancamento AND v_rb.valor > 0 THEN
    -- Plano depende da categoria
    SELECT id INTO v_plano FROM core.plano_contas WHERE codigo = CASE v_rb.categoria
      WHEN 'transporte'  THEN '1020'  -- CUSTO DE VIAGEM
      WHEN 'combustivel' THEN '1020'
      WHEN 'hospedagem'  THEN '1020'
      WHEN 'alimentacao' THEN '1020'
      WHEN 'material'    THEN '1015'  -- MATERIAL DE CONSUMO
      ELSE '4109'                     -- fallback: folha/outros
    END LIMIT 1;
    IF v_plano IS NULL THEN
      SELECT id INTO v_plano FROM core.plano_contas WHERE codigo='4109' LIMIT 1;
    END IF;
    SELECT id INTO v_centro FROM core.centros_custo WHERE codigo='6' LIMIT 1;

    -- Tenta matchear parceiro por CPF do colaborador
    IF v_col.cpf IS NOT NULL THEN
      SELECT id INTO v_parceiro FROM core.parceiros
       WHERE regexp_replace(COALESCE(cpf_cnpj,''), '[^0-9]','','g')
           = regexp_replace(v_col.cpf, '[^0-9]','','g') LIMIT 1;
    END IF;

    INSERT INTO core.lancamentos
      (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id,
       tipo, status, descricao, numero_documento, data_emissao,
       data_competencia, data_vencimento, valor, parcela_atual, parcela_total,
       observacoes)
      VALUES ('11111111-1111-1111-1111-111111111111'::uuid, v_centro,
              v_rb.obra_id, v_parceiro, v_plano,
              'saida', 'previsto',
              'Reembolso ' || v_rb.categoria || ' — ' || v_col.nome || ' — ' || v_rb.descricao,
              'RB-' || substring(p_id::text,1,8), v_rb.data_gasto,
              v_rb.data_gasto,
              CURRENT_DATE + (p_dias_venc || ' days')::interval,
              v_rb.valor, 1, 1,
              'Aprovado por ' || v_email || ' via Core (ref rh.reembolsos.id=' || p_id || ')')
      RETURNING id INTO v_lanc;
  END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, depois)
  VALUES ('rh.reembolsos', 'BAIXA', p_id, v_email,
          jsonb_build_object('status','aprovado','lancamento_id',v_lanc));
  RETURN v_lanc;
END; $$;
GRANT EXECUTE ON FUNCTION core.aprovar_reembolso(uuid,boolean,integer) TO authenticated, service_role;

-- ─── FN: rejeitar_reembolso ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION core.rejeitar_reembolso(p_id uuid, p_motivo text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF COALESCE(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  v_email := core.current_user_email();

  UPDATE rh.reembolsos
     SET status='rejeitado', rejeitado_por=v_email, rejeitado_em=now(),
         rejeitado_motivo=p_motivo, updated_at=now()
   WHERE id=p_id AND status='pendente';
  IF NOT FOUND THEN RAISE EXCEPTION 'reembolso_nao_pendente_ou_ausente'; END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, depois, motivo)
  VALUES ('rh.reembolsos', 'ESTORNO', p_id, v_email,
          jsonb_build_object('status','rejeitado'), p_motivo);
END; $$;
GRANT EXECUTE ON FUNCTION core.rejeitar_reembolso(uuid,text) TO authenticated, service_role;

-- ─── FN: submeter_reembolso (Karla/RH cadastra no lugar do colaborador) ──
CREATE OR REPLACE FUNCTION core.submeter_reembolso(
  p_colaborador_id uuid, p_data_gasto date, p_categoria text,
  p_valor numeric, p_descricao text,
  p_comprovante_url text DEFAULT NULL, p_obra_id uuid DEFAULT NULL,
  p_contrato_id uuid DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text; v_id uuid; v_contrato uuid;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  v_email := core.current_user_email();
  IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'valor_invalido'; END IF;
  IF COALESCE(trim(p_descricao),'') = '' THEN RAISE EXCEPTION 'descricao_obrigatoria'; END IF;

  -- Se contrato não informado, pega o ativo do colaborador (data_termino IS NULL ou futuro)
  IF p_contrato_id IS NULL THEN
    SELECT id INTO v_contrato FROM rh.contratos
     WHERE colaborador_id = p_colaborador_id
       AND (data_termino_contrato IS NULL OR data_termino_contrato >= CURRENT_DATE)
     ORDER BY data_admissao DESC LIMIT 1;
  ELSE
    v_contrato := p_contrato_id;
  END IF;

  INSERT INTO rh.reembolsos
    (colaborador_id, contrato_id, data_gasto, categoria, valor,
     descricao, comprovante_url, obra_id, solicitado_por)
    VALUES (p_colaborador_id, v_contrato, p_data_gasto, p_categoria, p_valor,
            p_descricao, p_comprovante_url, p_obra_id, v_email)
  RETURNING id INTO v_id;

  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION core.submeter_reembolso(uuid,date,text,numeric,text,text,uuid,uuid)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
