-- Core v2 — aprovações cross-plataforma com write-back (task Will 12/08).
-- Padrão: Core lê ao vivo cross-schema, aprovação faz PATCH na tabela ORIGEM
-- (nunca sync/mirror) + cria lançamento em core.lancamentos como side-effect.
--
-- 3 tipos suportados (top do mapa de origens):
--   1) erp.pedidos_compra          → aprovar_pedido_compra
--   2) public.prestadores_pagamentos → aprovar_prestador_pagamento
--   3) erp.contas_receber          → aprovar_conta_receber
--
-- Rejeição devolve pra origem com motivo (visível pro solicitante refazer).
-- Só admin pode aprovar/rejeitar (por decisão Will 12/08).

-- ─── ALTER: adiciona campos de aprovação/rejeição onde faltam ────────

ALTER TABLE erp.pedidos_compra
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS rejeitado_por   text,
  ADD COLUMN IF NOT EXISTS rejeitado_em    timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por_email text;  -- backup do aprovado_por uuid

ALTER TABLE public.prestadores_pagamentos
  ADD COLUMN IF NOT EXISTS aprovado_por    text,
  ADD COLUMN IF NOT EXISTS aprovado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS rejeitado_por   text,
  ADD COLUMN IF NOT EXISTS rejeitado_em    timestamptz;

ALTER TABLE erp.contas_receber
  ADD COLUMN IF NOT EXISTS aprovado_por    text,
  ADD COLUMN IF NOT EXISTS aprovado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS rejeitado_por   text,
  ADD COLUMN IF NOT EXISTS rejeitado_em    timestamptz;

-- prestadores_pagamentos: aceita 'rejeitado' como status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='prestadores_pagamentos_status_v2') THEN
    ALTER TABLE public.prestadores_pagamentos
      ADD CONSTRAINT prestadores_pagamentos_status_v2
      CHECK (status = ANY (ARRAY['pendente','liberado','pago','rejeitado','cancelado']));
  END IF;
END $$;

-- ─── FN 1: aprovar_pedido_compra ─────────────────────────────────────
-- RASCUNHO → APROVADO. Opcionalmente cria core.lancamentos saída venc +30d.

CREATE OR REPLACE FUNCTION core.aprovar_pedido_compra(
  p_id uuid,
  p_cria_lancamento boolean DEFAULT true,
  p_dias_vencimento integer DEFAULT 30
) RETURNS uuid  -- retorna lancamento_id criado (ou NULL)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_email  text;
  v_pc     record;
  v_forn   record;
  v_lanc   uuid;
  v_plano  uuid;
  v_centro uuid;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada: apenas admin'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_pc FROM erp.pedidos_compra WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido_nao_encontrado: %', p_id; END IF;
  IF v_pc.status NOT IN ('RASCUNHO') THEN
    RAISE EXCEPTION 'pedido_nao_aprovavel: status=%', v_pc.status;
  END IF;

  UPDATE erp.pedidos_compra
     SET status='APROVADO', aprovado_por_email=v_email, aprovado_em=now()
   WHERE id=p_id;

  IF p_cria_lancamento AND COALESCE(v_pc.total, 0) > 0 THEN
    SELECT * INTO v_forn FROM erp.fornecedores WHERE id=v_pc.fornecedor_id;
    -- Match fornecedor ERP → core.parceiros pelo documento (CNPJ) se der
    DECLARE v_parc_id uuid;
    BEGIN
      SELECT id INTO v_parc_id FROM core.parceiros
       WHERE documento IS NOT NULL AND v_forn.documento IS NOT NULL
         AND regexp_replace(documento,'\D','','g') = regexp_replace(v_forn.documento,'\D','','g')
       LIMIT 1;

      SELECT id INTO v_plano  FROM core.plano_contas WHERE codigo='1018' LIMIT 1; -- FRETES E DESCARGAS (proxy compras)
      SELECT id INTO v_centro FROM core.centros_custo WHERE codigo='6' LIMIT 1;   -- OPERACIONAL

      INSERT INTO core.lancamentos
        (empresa_id, centro_custo_id, parceiro_id, plano_conta_id,
         tipo, status, descricao, numero_documento, data_emissao,
         data_competencia, data_vencimento, valor, parcela_atual, parcela_total,
         observacoes)
        VALUES ('11111111-1111-1111-1111-111111111111'::uuid, v_centro,
                v_parc_id, v_plano, 'saida', 'previsto',
                'Compra ' || COALESCE(v_forn.nome, '?') || ' — pedido ' || v_pc.numero,
                'PC-' || v_pc.numero, CURRENT_DATE, CURRENT_DATE,
                CURRENT_DATE + (p_dias_vencimento || ' days')::interval,
                v_pc.total, 1, 1,
                'Aprovado por ' || v_email || ' em ' || CURRENT_DATE ||
                ' via aprovação Core (ref erp.pedidos_compra.id=' || p_id || ')')
        RETURNING id INTO v_lanc;
    END;
  END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, depois, motivo)
  VALUES ('erp.pedidos_compra', 'BAIXA', p_id, v_email,
          jsonb_build_object('status','APROVADO','lancamento_id',v_lanc),
          'Aprovação de pedido de compra via Core');

  RETURN v_lanc;
END; $$;

GRANT EXECUTE ON FUNCTION core.aprovar_pedido_compra(uuid,boolean,integer)
  TO authenticated, service_role;

-- ─── FN 2: rejeitar_pedido_compra ────────────────────────────────────

CREATE OR REPLACE FUNCTION core.rejeitar_pedido_compra(
  p_id uuid, p_motivo text
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF COALESCE(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  v_email := core.current_user_email();

  UPDATE erp.pedidos_compra
     SET status='CANCELADO', motivo_rejeicao=p_motivo,
         rejeitado_por=v_email, rejeitado_em=now()
   WHERE id=p_id AND status='RASCUNHO';
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido_nao_rejeitavel'; END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, motivo)
  VALUES ('erp.pedidos_compra', 'ESTORNO', p_id, v_email, p_motivo);
END; $$;
GRANT EXECUTE ON FUNCTION core.rejeitar_pedido_compra(uuid,text) TO authenticated, service_role;

-- ─── FN 3: aprovar_prestador_pagamento ───────────────────────────────
-- pendente/liberado → pago (via Core). Cria saída no core.lancamentos.

CREATE OR REPLACE FUNCTION core.aprovar_prestador_pagamento(
  p_id uuid, p_cria_lancamento boolean DEFAULT true
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_email text; v_pp record; v_serv record;
  v_lanc uuid; v_plano uuid; v_centro uuid;
  v_parc_id uuid; v_obra_id uuid;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_pp FROM public.prestadores_pagamentos WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pagamento_nao_encontrado'; END IF;
  IF v_pp.status IN ('pago','rejeitado','cancelado') THEN
    RAISE EXCEPTION 'pagamento_ja_finalizado: %', v_pp.status;
  END IF;

  UPDATE public.prestadores_pagamentos
     SET status='pago', data_pagamento=CURRENT_DATE,
         aprovado_por=v_email, aprovado_em=now()
   WHERE id=p_id;

  IF p_cria_lancamento AND COALESCE(v_pp.valor,0) > 0 THEN
    SELECT * INTO v_serv FROM public.prestadores_obra_servicos WHERE id=v_pp.servico_id;
    -- Match prestador Space → core.parceiros
    IF v_pp.prestador_id IS NOT NULL THEN
      SELECT id INTO v_parc_id FROM core.parceiros
       WHERE space_prestador_id::text = v_pp.prestador_id::text LIMIT 1;
    END IF;
    -- Match obra Space → core.obras
    IF v_serv.obra_id IS NOT NULL THEN
      SELECT id INTO v_obra_id FROM core.obras WHERE space_id = v_serv.obra_id LIMIT 1;
    END IF;

    SELECT id INTO v_plano  FROM core.plano_contas WHERE codigo='1004' LIMIT 1; -- MO/prestadores (fallback abaixo)
    IF v_plano IS NULL THEN
      SELECT id INTO v_plano FROM core.plano_contas WHERE codigo LIKE '10%' AND nome ILIKE '%prestador%' LIMIT 1;
    END IF;
    SELECT id INTO v_centro FROM core.centros_custo WHERE codigo='6' LIMIT 1;

    INSERT INTO core.lancamentos
      (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id,
       tipo, status, descricao, numero_documento, data_emissao,
       data_competencia, data_vencimento, valor, valor_pago, data_pagamento,
       parcela_atual, parcela_total, observacoes)
      VALUES ('11111111-1111-1111-1111-111111111111'::uuid, v_centro,
              v_obra_id, v_parc_id, v_plano, 'saida', 'pago',
              'Prestador ' || v_pp.prestador_nome || ' — ' ||
                COALESCE(v_serv.descricao,'servico') || ' (' || v_pp.periodo || ')',
              'PRE-' || substring(p_id::text,1,8), CURRENT_DATE, CURRENT_DATE,
              CURRENT_DATE, v_pp.valor, v_pp.valor, CURRENT_DATE,
              1, 1,
              'Aprovado por ' || v_email || ' via Core (ref public.prestadores_pagamentos.id=' || p_id || ')')
      RETURNING id INTO v_lanc;
  END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, depois, motivo)
  VALUES ('public.prestadores_pagamentos', 'BAIXA', p_id, v_email,
          jsonb_build_object('status','pago','lancamento_id',v_lanc),
          'Aprovação repasse prestador via Core');

  RETURN v_lanc;
END; $$;
GRANT EXECUTE ON FUNCTION core.aprovar_prestador_pagamento(uuid,boolean) TO authenticated, service_role;

-- ─── FN 4: rejeitar_prestador_pagamento ──────────────────────────────

CREATE OR REPLACE FUNCTION core.rejeitar_prestador_pagamento(
  p_id uuid, p_motivo text
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF COALESCE(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  v_email := core.current_user_email();

  UPDATE public.prestadores_pagamentos
     SET status='rejeitado', motivo_rejeicao=p_motivo,
         rejeitado_por=v_email, rejeitado_em=now()
   WHERE id=p_id AND status IN ('pendente','liberado');
  IF NOT FOUND THEN RAISE EXCEPTION 'pagamento_nao_rejeitavel'; END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, motivo)
  VALUES ('public.prestadores_pagamentos', 'ESTORNO', p_id, v_email, p_motivo);
END; $$;
GRANT EXECUTE ON FUNCTION core.rejeitar_prestador_pagamento(uuid,text) TO authenticated, service_role;

-- ─── FN 5: aprovar_conta_receber (o mais crítico — dispara motor RT/comissão) ─
-- Quando o financeiro do ERP registra recebimento do cliente, aprovar aqui:
-- (1) PATCH erp.contas_receber (status='PAGO', valor_pago, data_pagamento)
-- (2) Cria core.lancamentos tipo=entrada status=recebido linkado à obra (via ref_tipo/ref_id)
-- (3) Trigger de core.lancamentos dispara core.recalcular_liberacoes(obra)
--     que libera comissão vendedor + RT arquiteto proporcional
--
-- ref_tipo esperado em erp.contas_receber: 'CT' (contrato Docusign, ref_id=contrato.id)
-- ou 'OBRA' (ref_id=core.obras.id). Se ausente, cria lancamento sem obra_id.

CREATE OR REPLACE FUNCTION core.aprovar_conta_receber(
  p_id uuid,
  p_conta_bancaria_id uuid DEFAULT NULL,
  p_data_pagamento date DEFAULT NULL,
  p_valor_pago numeric DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_email text; v_cr record; v_lanc uuid;
  v_plano uuid; v_centro uuid; v_obra uuid; v_data date; v_valor numeric;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_cr FROM erp.contas_receber WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'conta_receber_nao_encontrada'; END IF;
  IF v_cr.status = 'PAGO' THEN RAISE EXCEPTION 'ja_paga'; END IF;

  v_data  := COALESCE(p_data_pagamento, CURRENT_DATE);
  v_valor := COALESCE(p_valor_pago, v_cr.valor);

  UPDATE erp.contas_receber
     SET status='PAGO', valor_pago=v_valor, data_pagamento=v_data,
         aprovado_por=v_email, aprovado_em=now()
   WHERE id=p_id;

  -- Resolve obra via ref_tipo/ref_id
  IF v_cr.ref_tipo = 'OBRA' AND v_cr.ref_id IS NOT NULL THEN
    v_obra := v_cr.ref_id;
  ELSIF v_cr.ref_tipo = 'CT' AND v_cr.ref_id IS NOT NULL THEN
    SELECT id INTO v_obra FROM core.obras
     WHERE codigo IN (SELECT numero FROM public.simulacao_projetos sp
                       WHERE EXISTS (SELECT 1 FROM public.contratos_docusign cd
                                      WHERE cd.id::text=v_cr.ref_id::text
                                        AND cd.simulacao_id=sp.id))
     LIMIT 1;
  END IF;

  SELECT id INTO v_plano  FROM core.plano_contas WHERE codigo='9101' LIMIT 1; -- REC/PISOS
  SELECT id INTO v_centro FROM core.centros_custo WHERE codigo='6' LIMIT 1;

  INSERT INTO core.lancamentos
    (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id,
     tipo, status, descricao, numero_documento, data_emissao,
     data_competencia, data_vencimento, data_pagamento, valor, valor_pago,
     parcela_atual, parcela_total, observacoes)
    VALUES ('11111111-1111-1111-1111-111111111111'::uuid, v_centro,
            v_obra, v_cr.cliente_id, v_plano, p_conta_bancaria_id,
            'entrada', 'recebido',
            'Recebimento cliente — ' || COALESCE(v_cr.descricao, v_cr.numero),
            'CR-' || v_cr.numero, v_cr.data_emissao,
            COALESCE(v_cr.data_emissao, v_data), v_cr.data_vencimento,
            v_data, v_cr.valor, v_valor, 1, 1,
            'Aprovado por ' || v_email || ' via Core (ref erp.contas_receber.id=' || p_id || ')')
    RETURNING id INTO v_lanc;

  -- O trigger _trigger_recalcular_liberacoes já dispara recalcular_liberacoes(obra_id)
  -- automático no INSERT do lancamento entrada baixado — motor de RT/comissão libera cota.

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, depois, motivo)
  VALUES ('erp.contas_receber', 'BAIXA', p_id, v_email,
          jsonb_build_object('status','PAGO','lancamento_id',v_lanc,'obra_id',v_obra),
          'Aprovação recebimento cliente via Core');

  RETURN v_lanc;
END; $$;
GRANT EXECUTE ON FUNCTION core.aprovar_conta_receber(uuid,uuid,date,numeric) TO authenticated, service_role;

-- ─── FN 6: rejeitar_conta_receber ────────────────────────────────────

CREATE OR REPLACE FUNCTION core.rejeitar_conta_receber(
  p_id uuid, p_motivo text
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF COALESCE(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  v_email := core.current_user_email();

  UPDATE erp.contas_receber
     SET status='CANCELADO', motivo_rejeicao=p_motivo,
         rejeitado_por=v_email, rejeitado_em=now()
   WHERE id=p_id AND status <> 'PAGO';
  IF NOT FOUND THEN RAISE EXCEPTION 'conta_nao_rejeitavel'; END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, motivo)
  VALUES ('erp.contas_receber', 'ESTORNO', p_id, v_email, p_motivo);
END; $$;
GRANT EXECUTE ON FUNCTION core.rejeitar_conta_receber(uuid,text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
