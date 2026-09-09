-- Core v2 — Aprovações fase 2: Fretes + Viagens + RH adiantamentos.
-- Mesmo padrão do SQL 011: aprovar via RPC no Core, PATCH origem + INSERT
-- core.lancamentos como side-effect. Rejeição devolve pra origem com motivo.

-- ─── FN 7: aprovar_frete ─────────────────────────────────────────────
-- core.fretes_solicitacoes pendente → aprovado + saida a pagar +15d.

CREATE OR REPLACE FUNCTION core.aprovar_frete(
  p_id uuid, p_cria_lancamento boolean DEFAULT true, p_dias_venc integer DEFAULT 15
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_email text; v_fr record; v_lanc uuid; v_plano uuid; v_centro uuid;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_fr FROM core.fretes_solicitacoes WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'frete_nao_encontrado'; END IF;
  IF v_fr.status <> 'pendente' THEN RAISE EXCEPTION 'frete_nao_pendente: %', v_fr.status; END IF;

  UPDATE core.fretes_solicitacoes
     SET status='aprovado', aprovador=v_email, data_decisao=now()
   WHERE id=p_id;

  IF p_cria_lancamento AND COALESCE(v_fr.valor_orcado, 0) > 0 THEN
    SELECT id INTO v_plano  FROM core.plano_contas WHERE codigo='1018' LIMIT 1; -- FRETES E DESCARGAS
    SELECT id INTO v_centro FROM core.centros_custo WHERE codigo='6' LIMIT 1;
    INSERT INTO core.lancamentos
      (empresa_id, centro_custo_id, obra_id, plano_conta_id,
       tipo, status, descricao, numero_documento, data_emissao,
       data_competencia, data_vencimento, valor, parcela_atual, parcela_total,
       observacoes)
      VALUES (COALESCE(v_fr.empresa_id, '11111111-1111-1111-1111-111111111111'::uuid),
              COALESCE(v_fr.centro_custo_id, v_centro),
              v_fr.obra_id, v_plano,
              'saida', 'previsto',
              'Frete ' || v_fr.tipo_frete || ' — ' || COALESCE(v_fr.transportadora, '?') ||
                COALESCE(' ' || v_fr.origem || '→' || v_fr.destino, ''),
              'FR-' || substring(p_id::text,1,8), CURRENT_DATE, CURRENT_DATE,
              CURRENT_DATE + (p_dias_venc || ' days')::interval,
              v_fr.valor_orcado, 1, 1,
              'Aprovado por ' || v_email || ' via Core (ref core.fretes_solicitacoes.id=' || p_id || ')')
      RETURNING id INTO v_lanc;
  END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, depois)
  VALUES ('core.fretes_solicitacoes', 'BAIXA', p_id, v_email,
          jsonb_build_object('status','aprovado','lancamento_id',v_lanc));
  RETURN v_lanc;
END; $$;
GRANT EXECUTE ON FUNCTION core.aprovar_frete(uuid,boolean,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION core.rejeitar_frete(p_id uuid, p_motivo text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF COALESCE(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  v_email := core.current_user_email();
  UPDATE core.fretes_solicitacoes
     SET status='rejeitado', motivo_rejeicao=p_motivo, aprovador=v_email, data_decisao=now()
   WHERE id=p_id AND status='pendente';
  IF NOT FOUND THEN RAISE EXCEPTION 'frete_nao_rejeitavel'; END IF;
  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, motivo)
  VALUES ('core.fretes_solicitacoes', 'ESTORNO', p_id, v_email, p_motivo);
END; $$;
GRANT EXECUTE ON FUNCTION core.rejeitar_frete(uuid,text) TO authenticated, service_role;


-- ─── FN 8: aprovar_viagem (aprova adiantamento) ──────────────────────
-- core.viagens planejada → em_andamento + saida a pagar do valor adiantamento.

ALTER TABLE core.viagens
  ADD COLUMN IF NOT EXISTS aprovado_por    text,
  ADD COLUMN IF NOT EXISTS aprovado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS rejeitado_por   text,
  ADD COLUMN IF NOT EXISTS rejeitado_em    timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='viagens_status_v2') THEN
    ALTER TABLE core.viagens
      ADD CONSTRAINT viagens_status_v2
      CHECK (status = ANY (ARRAY['planejada','em_andamento','concluida','cancelada','rejeitada']));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION core.aprovar_viagem(
  p_id uuid, p_cria_lancamento boolean DEFAULT true
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_email text; v_v record; v_lanc uuid;
  v_plano uuid; v_centro uuid; v_func record;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_v FROM core.viagens WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'viagem_nao_encontrada'; END IF;
  IF v_v.status <> 'planejada' THEN RAISE EXCEPTION 'viagem_nao_planejada: %', v_v.status; END IF;

  UPDATE core.viagens
     SET status='em_andamento', aprovado_por=v_email, aprovado_em=now()
   WHERE id=p_id;

  IF p_cria_lancamento AND COALESCE(v_v.adiantamento, 0) > 0 THEN
    SELECT id, nome INTO v_func FROM core.funcionarios WHERE id=v_v.funcionario_id;
    SELECT id INTO v_plano  FROM core.plano_contas WHERE codigo='1020' LIMIT 1; -- CUSTO DE VIAGEM
    SELECT id INTO v_centro FROM core.centros_custo WHERE codigo='6' LIMIT 1;
    INSERT INTO core.lancamentos
      (empresa_id, centro_custo_id, obra_id, plano_conta_id,
       tipo, status, descricao, numero_documento, data_emissao,
       data_competencia, data_vencimento, valor, parcela_atual, parcela_total,
       observacoes)
      VALUES (v_v.empresa_id, v_centro, v_v.obra_id, v_plano,
              'saida', 'previsto',
              'Viagem adiantamento — ' || COALESCE(v_func.nome, '?') || ' → ' ||
                COALESCE(v_v.destino_cidade, '?'),
              'VIA-' || substring(p_id::text,1,8), CURRENT_DATE, CURRENT_DATE,
              v_v.data_ida, v_v.adiantamento, 1, 1,
              'Aprovado por ' || v_email || ' via Core (motivo: ' || COALESCE(v_v.motivo, '') || ')')
      RETURNING id INTO v_lanc;
  END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, depois)
  VALUES ('core.viagens', 'BAIXA', p_id, v_email,
          jsonb_build_object('status','em_andamento','lancamento_id',v_lanc));
  RETURN v_lanc;
END; $$;
GRANT EXECUTE ON FUNCTION core.aprovar_viagem(uuid,boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION core.rejeitar_viagem(p_id uuid, p_motivo text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF COALESCE(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  v_email := core.current_user_email();
  UPDATE core.viagens
     SET status='rejeitada', motivo_rejeicao=p_motivo,
         rejeitado_por=v_email, rejeitado_em=now()
   WHERE id=p_id AND status='planejada';
  IF NOT FOUND THEN RAISE EXCEPTION 'viagem_nao_rejeitavel'; END IF;
  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, motivo)
  VALUES ('core.viagens', 'ESTORNO', p_id, v_email, p_motivo);
END; $$;
GRANT EXECUTE ON FUNCTION core.rejeitar_viagem(uuid,text) TO authenticated, service_role;


-- ─── FN 9: aprovar_adiantamento_rh ───────────────────────────────────
-- rh.adiantamentos pendente → aprovado + saida a pagar (folha/adiant).

ALTER TABLE rh.adiantamentos
  ADD COLUMN IF NOT EXISTS aprovado_por_email text,
  ADD COLUMN IF NOT EXISTS rejeitado_por      text,
  ADD COLUMN IF NOT EXISTS rejeitado_em       timestamptz;

CREATE OR REPLACE FUNCTION core.aprovar_adiantamento_rh(
  p_id uuid, p_cria_lancamento boolean DEFAULT true, p_dias_venc integer DEFAULT 3
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_email text; v_ad record; v_lanc uuid;
  v_plano uuid; v_centro uuid; v_contrato record; v_parc_id uuid;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_ad FROM rh.adiantamentos WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'adiantamento_nao_encontrado'; END IF;
  IF v_ad.status <> 'pendente' THEN RAISE EXCEPTION 'adiantamento_nao_pendente: %', v_ad.status; END IF;

  UPDATE rh.adiantamentos
     SET status='aprovado', aprovado_por_email=v_email, aprovado_em=now()
   WHERE id=p_id;

  IF p_cria_lancamento AND COALESCE(v_ad.valor, 0) > 0 THEN
    -- Tenta match parceiro pela referência do contrato RH → funcionario → parceiros por documento
    SELECT c.*, col.nome AS colab_nome, col.cpf INTO v_contrato
      FROM rh.contratos c LEFT JOIN rh.colaboradores col ON col.id=c.colaborador_id
     WHERE c.id=v_ad.contrato_id;
    IF v_contrato.cpf IS NOT NULL THEN
      SELECT id INTO v_parc_id FROM core.parceiros
       WHERE regexp_replace(COALESCE(documento,''),'\D','','g')
           = regexp_replace(v_contrato.cpf,'\D','','g') LIMIT 1;
    END IF;
    SELECT id INTO v_plano  FROM core.plano_contas WHERE codigo='4109' LIMIT 1; -- IMPOSTO/FOLHA (proxy)
    IF v_plano IS NULL THEN
      SELECT id INTO v_plano FROM core.plano_contas WHERE nome ILIKE '%folha%' LIMIT 1;
    END IF;
    SELECT id INTO v_centro FROM core.centros_custo WHERE codigo='2' LIMIT 1; -- ADMINISTRATIVO

    INSERT INTO core.lancamentos
      (empresa_id, centro_custo_id, parceiro_id, plano_conta_id,
       tipo, status, descricao, numero_documento, data_emissao,
       data_competencia, data_vencimento, valor, parcela_atual, parcela_total,
       observacoes)
      VALUES ('11111111-1111-1111-1111-111111111111'::uuid, v_centro,
              v_parc_id, v_plano, 'saida', 'previsto',
              'Adiantamento RH — ' || COALESCE(v_contrato.colab_nome, 'colaborador') ||
                ' (' || COALESCE(v_ad.motivo, '') || ')',
              'ADIRH-' || substring(p_id::text,1,8), CURRENT_DATE, CURRENT_DATE,
              CURRENT_DATE + (p_dias_venc || ' days')::interval,
              v_ad.valor, 1, 1,
              'Aprovado por ' || v_email || ' via Core (ref rh.adiantamentos.id=' || p_id || ')')
      RETURNING id INTO v_lanc;
  END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, depois)
  VALUES ('rh.adiantamentos', 'BAIXA', p_id, v_email,
          jsonb_build_object('status','aprovado','lancamento_id',v_lanc));
  RETURN v_lanc;
END; $$;
GRANT EXECUTE ON FUNCTION core.aprovar_adiantamento_rh(uuid,boolean,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION core.rejeitar_adiantamento_rh(p_id uuid, p_motivo text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF COALESCE(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  v_email := core.current_user_email();
  UPDATE rh.adiantamentos
     SET status='rejeitado', rejeitado_motivo=p_motivo,
         rejeitado_por=v_email, rejeitado_em=now()
   WHERE id=p_id AND status='pendente';
  IF NOT FOUND THEN RAISE EXCEPTION 'adiantamento_nao_rejeitavel'; END IF;
  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, motivo)
  VALUES ('rh.adiantamentos', 'ESTORNO', p_id, v_email, p_motivo);
END; $$;
GRANT EXECUTE ON FUNCTION core.rejeitar_adiantamento_rh(uuid,text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
