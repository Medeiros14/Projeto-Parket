-- ═══════════════════════════════════════════════════════════════════
-- 018 — Custo de compra cai na OBRA certa do Core (Will 18/08/2026)
--
-- Gap: aprovar_item_compra criava core.lancamentos SEM obra_id → o
-- custo nunca aparecia na obra. O compras-app agora persiste a
-- referência escolhida na lista (kanban_cards.details.obra_ref =
-- "obra:<public.obras.id>" ou uuid do card de Projetos; watcher grava
-- details.obra_codigo = nº da proposta). Aqui: resolver + wire.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Resolver: card de Compras → core.obras.id ────────────────────
CREATE OR REPLACE FUNCTION core.resolver_obra_do_card(p_card_id uuid)
RETURNS uuid
  LANGUAGE plpgsql STABLE
  SET search_path = public, core, pg_catalog AS $$
DECLARE
  v_ref     text;
  v_key     text;
  v_codigo  text;
  v_parent  uuid;
  v_pnome   text;
  v_title   text;
  v_obra    uuid;
  v_t       text;
  v_cands   text[] := '{}';
  v_n       text;
  v_arr     uuid[];
BEGIN
  SELECT details->>'obra_ref', details->>'obra_codigo', parent_card_id,
         NULLIF(btrim(COALESCE(details->>'projeto_nome','')),''),
         NULLIF(btrim(COALESCE(title,'')),'')
    INTO v_ref, v_codigo, v_parent, v_pnome, v_title
    FROM public.kanban_cards WHERE id = p_card_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 0) código da proposta (watcher contrato-assinado) = core.obras.codigo
  IF v_codigo IS NOT NULL AND btrim(v_codigo) <> '' THEN
    SELECT array_agg(id) INTO v_arr FROM (
      SELECT id FROM core.obras WHERE codigo = btrim(v_codigo) LIMIT 2) s;
    IF COALESCE(array_length(v_arr,1),0) = 1 THEN RETURN v_arr[1]; END IF;
  END IF;

  v_key := CASE WHEN v_ref LIKE 'obra:%' THEN substr(v_ref, 6) ELSE v_ref END;

  -- 1) referência escolhida na solicitação → space_id direto
  IF v_key IS NOT NULL AND btrim(v_key) <> '' THEN
    SELECT id INTO v_obra FROM core.obras WHERE space_id = v_key LIMIT 1;
    IF v_obra IS NOT NULL THEN RETURN v_obra; END IF;
  END IF;

  -- 2) parent card (Projetos) como space_id
  IF v_parent IS NOT NULL THEN
    SELECT id INTO v_obra FROM core.obras WHERE space_id = v_parent::text LIMIT 1;
    IF v_obra IS NOT NULL THEN RETURN v_obra; END IF;
  END IF;

  -- 3) fallback por nome — só match ÚNICO (case/trim-insensitive)
  IF v_key IS NOT NULL AND btrim(v_key) <> '' THEN
    SELECT title INTO v_t FROM public.kanban_cards WHERE id::text = v_key;
    IF v_t IS NOT NULL THEN v_cands := v_cands || v_t; END IF;
    v_t := NULL;
    SELECT cliente INTO v_t FROM public.obras WHERE id = v_key;
    IF v_t IS NOT NULL THEN v_cands := v_cands || v_t; END IF;
  END IF;
  IF v_pnome IS NOT NULL THEN
    v_cands := v_cands || v_pnome;
    -- projeto_nome pode vir "OBRA — CLIENTE": tenta só a parte do cliente
    IF position(' — ' IN v_pnome) > 0 THEN
      v_cands := v_cands || btrim(split_part(v_pnome, ' — ', 2));
    END IF;
  END IF;
  IF v_title IS NOT NULL THEN v_cands := v_cands || v_title; END IF;

  FOREACH v_n IN ARRAY v_cands LOOP
    CONTINUE WHEN v_n IS NULL OR btrim(v_n) = '';
    v_arr := NULL;
    SELECT array_agg(id) INTO v_arr FROM (
      SELECT id FROM core.obras
       WHERE upper(btrim(nome)) = upper(btrim(v_n)) LIMIT 2) s;
    IF COALESCE(array_length(v_arr,1),0) = 1 THEN RETURN v_arr[1]; END IF;
  END LOOP;

  RETURN NULL;
END $$;

-- ─── 2. aprovar_item_compra: honra p_obra_id + resolve e grava obra_id
--     (base = versão deployada com parcelas de prazo_faturamento_texto)
CREATE OR REPLACE FUNCTION core.aprovar_item_compra(
  p_item_id         uuid,
  p_venc_override   date DEFAULT NULL,
  p_cria_lancamento boolean DEFAULT true,
  p_obra_id         uuid DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, core, pg_catalog AS $$
DECLARE
  v_email      text;
  v_it         public.compras_itens%ROWTYPE;
  v_novo       text;
  v_lanc_ids   uuid[] := '{}';
  v_lanc       uuid;
  v_venc       date;
  v_parc       uuid;
  v_plano      uuid;
  v_centro     uuid;
  v_empresa    uuid;
  v_forn_doc   text;
  v_prazos     int[] := '{}';
  v_prazo      int;
  v_n          int;
  v_valor_p    numeric(14,2);
  v_i          int;
  v_obra       uuid;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada: apenas admin'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_it FROM public.compras_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_nao_encontrado: %', p_item_id; END IF;
  IF v_it.status <> 'aguardando_aprovacao' THEN
    RAISE EXCEPTION 'item_nao_aprovavel: status=%', v_it.status;
  END IF;

  v_novo := 'aprovado';

  IF p_cria_lancamento AND COALESCE(v_it.valor, 0) > 0 THEN
    v_obra := COALESCE(p_obra_id, core.resolver_obra_do_card(v_it.card_id));

    IF v_it.forma_pagamento = 'faturado' THEN
      v_prazos := public.parse_prazo_faturamento(v_it.prazo_faturamento_texto);
      IF v_prazos = ARRAY[0] AND COALESCE(v_it.prazo_faturamento_dias,0) > 0 THEN
        v_prazos := ARRAY[v_it.prazo_faturamento_dias];
      END IF;
    ELSE
      v_prazos := ARRAY[0];
    END IF;

    v_n := COALESCE(array_length(v_prazos, 1), 1);
    IF v_n = 0 THEN v_prazos := ARRAY[0]; v_n := 1; END IF;
    v_valor_p := ROUND(v_it.valor / v_n, 2);

    -- Prefere snapshot do CNPJ (bancário congelado) sobre live
    v_forn_doc := COALESCE(v_it.forn_snap_cnpj, NULL);
    IF v_forn_doc IS NULL AND v_it.fornecedor_id IS NOT NULL THEN
      SELECT cnpj INTO v_forn_doc FROM public.compras_fornecedores WHERE id = v_it.fornecedor_id;
    END IF;
    IF v_forn_doc IS NOT NULL THEN
      SELECT id INTO v_parc FROM core.parceiros
       WHERE documento IS NOT NULL
         AND regexp_replace(documento,'\D','','g') = regexp_replace(v_forn_doc,'\D','','g')
       LIMIT 1;
    END IF;

    SELECT id INTO v_empresa FROM core.empresas LIMIT 1;
    SELECT id INTO v_plano   FROM core.plano_contas WHERE codigo='1018' LIMIT 1;
    SELECT id INTO v_centro  FROM core.centros_custo WHERE codigo='6' LIMIT 1;

    FOR v_i IN 1..v_n LOOP
      v_prazo := v_prazos[v_i];
      v_venc := COALESCE(p_venc_override, current_date + v_prazo);

      INSERT INTO core.lancamentos (
        empresa_id, centro_custo_id, plano_conta_id, parceiro_id, obra_id,
        tipo, status, descricao,
        numero_documento, data_competencia, data_vencimento, valor,
        observacoes, compras_item_id
      ) VALUES (
        v_empresa, v_centro, v_plano, v_parc, v_obra,
        'saida', 'previsto',
        'Compra item ' || v_it.material ||
          CASE WHEN v_n > 1 THEN ' (parc ' || v_i || '/' || v_n || ')' ELSE '' END ||
          COALESCE(' - '||v_it.fornecedor_nome_snapshot, ''),
        'CI-'||substr(v_it.id::text, 1, 8) || CASE WHEN v_n > 1 THEN '-'||v_i ELSE '' END,
        current_date, v_venc, v_valor_p,
        'Aprovado por '||v_email||' via item de compra '||v_it.id::text,
        v_it.id
      ) RETURNING id INTO v_lanc;
      v_lanc_ids := v_lanc_ids || v_lanc;
    END LOOP;
  END IF;

  UPDATE public.compras_itens
     SET status         = v_novo,
         aprovado_por   = v_email,
         aprovado_em    = now(),
         lancamento_id  = COALESCE(v_lanc_ids[1], lancamento_id)
   WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'item_id',        p_item_id,
    'novo_status',    v_novo,
    'lancamento_ids', to_jsonb(v_lanc_ids),
    'parcelas',       v_n,
    'obra_id',        v_obra
  );
END $$;

GRANT EXECUTE ON FUNCTION core.resolver_obra_do_card(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.aprovar_item_compra(uuid,date,boolean,uuid) TO authenticated, service_role;

-- ─── 3. Backfill: lançamentos de item de compra sem obra ─────────────
UPDATE core.lancamentos l
   SET obra_id = core.resolver_obra_do_card(ci.card_id)
  FROM public.compras_itens ci
 WHERE ci.id = l.compras_item_id
   AND l.compras_item_id IS NOT NULL
   AND l.obra_id IS NULL
   AND core.resolver_obra_do_card(ci.card_id) IS NOT NULL;
