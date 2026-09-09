-- 020: fix status 'baixado' (invalido no check constraint) -> canonico 'pago'
-- Afeta: pagar_lancamento_compra, remover_comprovante_lancamento, pagar_item_compra, reverter_aprovacao_item_compra

CREATE OR REPLACE FUNCTION public.remover_comprovante_lancamento(p_lancamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
DECLARE
  v_item uuid;
  v_pend int;
  v_ultimo_url text;
  v_ultimo_nome text;
BEGIN
  IF NOT core.is_admin() THEN RAISE EXCEPTION 'permissao_negada: apenas financeiro/admin'; END IF;
  UPDATE core.lancamentos
     SET comprovante_url=NULL, comprovante_nome=NULL,
         status = CASE WHEN status='pago' THEN 'previsto' ELSE status END,
         data_pagamento = CASE WHEN status='pago' THEN NULL ELSE data_pagamento END
   WHERE id = p_lancamento_id
   RETURNING compras_item_id INTO v_item;

  IF v_item IS NOT NULL THEN
    SELECT COUNT(*) INTO v_pend
      FROM core.lancamentos
     WHERE compras_item_id=v_item AND status NOT IN ('pago','recebido','conciliado','cancelado');

    -- pega o ultimo comprovante restante (se sobrar algum pago) pra manter o
    -- campo agregado compras_itens.comprovante_pagto_url em sincronia.
    SELECT comprovante_url, comprovante_nome INTO v_ultimo_url, v_ultimo_nome
      FROM core.lancamentos
     WHERE compras_item_id=v_item AND status IN ('pago','conciliado') AND comprovante_url IS NOT NULL
     ORDER BY data_pagamento DESC NULLS LAST, id DESC
     LIMIT 1;

    UPDATE public.compras_itens
       SET comprovante_pagto_url = v_ultimo_url,
           comprovante_pagto_nome = v_ultimo_nome,
           status = CASE WHEN v_pend > 0 AND status='pago' THEN 'aprovado' ELSE status END,
           pago_em = CASE WHEN v_pend > 0 AND status='pago' THEN NULL ELSE pago_em END,
           pago_por = CASE WHEN v_pend > 0 AND status='pago' THEN NULL ELSE pago_por END
     WHERE id = v_item;
  END IF;

  RETURN jsonb_build_object('lancamento_id', p_lancamento_id, 'item_id', v_item, 'parcelas_pendentes', v_pend);
END $function$
;

CREATE OR REPLACE FUNCTION core.pagar_item_compra(p_item_id uuid, p_comprovante_url text, p_comprovante_nome text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
DECLARE
  v_email text;
  v_it    public.compras_itens%ROWTYPE;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  v_email := core.current_user_email();

  IF p_comprovante_url IS NULL OR btrim(p_comprovante_url) = '' THEN
    RAISE EXCEPTION 'comprovante_obrigatorio';
  END IF;

  SELECT * INTO v_it FROM public.compras_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_nao_encontrado'; END IF;
  IF v_it.status NOT IN ('aprovado','em_rota','entregue','faturado') THEN
    RAISE EXCEPTION 'item_nao_pagavel: status=%', v_it.status;
  END IF;

  UPDATE public.compras_itens
     SET status                 = 'pago',
         comprovante_pagto_url  = p_comprovante_url,
         comprovante_pagto_nome = p_comprovante_nome,
         pago_em                = now(),
         pago_por               = v_email
   WHERE id = p_item_id;

  IF v_it.lancamento_id IS NOT NULL THEN
    UPDATE core.lancamentos
       SET status         = 'pago',
           data_pagamento = current_date,
           observacoes    = COALESCE(observacoes,'') ||
             chr(10) || 'Baixado por ' || v_email || ' — comprovante: ' || p_comprovante_url
     WHERE id = v_it.lancamento_id;
  END IF;

  RETURN jsonb_build_object('item_id', p_item_id, 'status', 'pago');
END $function$
;

CREATE OR REPLACE FUNCTION core.reverter_aprovacao_item_compra(p_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
DECLARE
  v_it public.compras_itens%ROWTYPE;
  v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_it FROM public.compras_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_nao_encontrado: %', p_item_id; END IF;
  IF v_it.status = 'pago' THEN RAISE EXCEPTION 'item_ja_pago_nao_pode_reverter'; END IF;
  IF v_it.status NOT IN ('aprovado','em_rota','entregue','faturado') THEN
    RAISE EXCEPTION 'item_nao_esta_aprovado: status=%', v_it.status;
  END IF;

  -- Cancela lançamento (se existir e não foi pago)
  IF v_it.lancamento_id IS NOT NULL THEN
    UPDATE core.lancamentos
       SET status = 'cancelado',
           observacoes = COALESCE(observacoes,'') || chr(10) || 'Cancelado por ' || v_email || ' (reversão de aprovação)'
     WHERE id = v_it.lancamento_id AND status NOT IN ('pago','recebido','conciliado');
  END IF;

  UPDATE public.compras_itens
     SET status = 'cotacao',
         aprovado_por = NULL,
         aprovado_em = NULL,
         lancamento_id = NULL,
         motivo_reprovacao = NULL
   WHERE id = p_item_id;

  RETURN jsonb_build_object('item_id', p_item_id, 'novo_status', 'cotacao');
END $function$
;

CREATE OR REPLACE FUNCTION core.pagar_lancamento_compra(p_lancamento_id uuid, p_comprovante_url text, p_comprovante_nome text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
DECLARE v_email text; v_item_id uuid; v_pend int;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF p_comprovante_url IS NULL OR btrim(p_comprovante_url) = '' THEN RAISE EXCEPTION 'comprovante_obrigatorio'; END IF;
  v_email := core.current_user_email();
  SELECT compras_item_id INTO v_item_id FROM core.lancamentos WHERE id = p_lancamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lancamento_nao_encontrado'; END IF;
  UPDATE core.lancamentos
     SET status='pago', data_pagamento=current_date,
         comprovante_url=p_comprovante_url, comprovante_nome=p_comprovante_nome
   WHERE id = p_lancamento_id;
  IF v_item_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_pend FROM core.lancamentos WHERE compras_item_id=v_item_id AND status NOT IN ('pago','recebido','conciliado','cancelado');
    UPDATE public.compras_itens
       SET comprovante_pagto_url=p_comprovante_url, comprovante_pagto_nome=p_comprovante_nome,
           status=CASE WHEN v_pend=0 THEN 'pago' ELSE status END,
           pago_em=CASE WHEN v_pend=0 THEN now() ELSE pago_em END,
           pago_por=CASE WHEN v_pend=0 THEN v_email ELSE pago_por END
     WHERE id = v_item_id;
  END IF;
  RETURN jsonb_build_object('lancamento_id', p_lancamento_id, 'item_id', v_item_id, 'parcelas_pendentes', v_pend);
END $function$
;

