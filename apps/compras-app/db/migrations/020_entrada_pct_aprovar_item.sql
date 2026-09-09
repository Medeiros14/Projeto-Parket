-- 020: pagamento misto — entrada no ato (entrada_pct% do valor, vence hoje)
--      + restante faturado dividido nos prazos (Will 21/08/2026).
-- Coluna: public.compras_itens.entrada_pct numeric(5,2) (NULL/0 = sem entrada).
-- Tambem corrige arredondamento: ultima parcela absorve a diferenca de centavos.

ALTER TABLE public.compras_itens ADD COLUMN IF NOT EXISTS entrada_pct numeric(5,2);

CREATE OR REPLACE FUNCTION core.aprovar_item_compra(p_item_id uuid, p_venc_override date DEFAULT NULL::date, p_cria_lancamento boolean DEFAULT true, p_obra_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
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
  v_valor_i    numeric(14,2);
  v_i          int;
  v_obra       uuid;
  v_entrada    numeric(14,2) := 0;
  v_restante   numeric(14,2);
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

    -- Entrada no ato: entrada_pct% vence hoje; restante divide nos prazos do faturamento.
    IF v_it.forma_pagamento = 'faturado'
       AND COALESCE(v_it.entrada_pct, 0) > 0 AND COALESCE(v_it.entrada_pct, 0) < 100 THEN
      v_entrada := ROUND(v_it.valor * v_it.entrada_pct / 100.0, 2);
    END IF;
    v_restante := v_it.valor - v_entrada;

    v_n := COALESCE(array_length(v_prazos, 1), 1);
    IF v_n = 0 THEN v_prazos := ARRAY[0]; v_n := 1; END IF;
    v_valor_p := ROUND(v_restante / v_n, 2);

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

    IF v_entrada > 0 THEN
      INSERT INTO core.lancamentos (
        empresa_id, centro_custo_id, plano_conta_id, parceiro_id, obra_id,
        tipo, status, descricao,
        numero_documento, data_competencia, data_vencimento, valor,
        observacoes, compras_item_id
      ) VALUES (
        v_empresa, v_centro, v_plano, v_parc, v_obra,
        'saida', 'previsto',
        'Compra item ' || v_it.material ||
          ' (entrada ' || trim(trailing '.' from trim(trailing '0' from v_it.entrada_pct::text)) || '%)' ||
          COALESCE(' - '||v_it.fornecedor_nome_snapshot, ''),
        'CI-'||substr(v_it.id::text, 1, 8)||'-E',
        current_date, current_date, v_entrada,
        'Aprovado por '||v_email||' via item de compra '||v_it.id::text,
        v_it.id
      ) RETURNING id INTO v_lanc;
      v_lanc_ids := v_lanc_ids || v_lanc;
    END IF;

    FOR v_i IN 1..v_n LOOP
      v_prazo := v_prazos[v_i];
      v_venc := COALESCE(p_venc_override, current_date + v_prazo);
      -- Ultima parcela absorve diferenca de centavos do arredondamento
      v_valor_i := CASE WHEN v_i = v_n THEN v_restante - v_valor_p * (v_n - 1) ELSE v_valor_p END;

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
          CASE WHEN v_entrada > 0 AND v_n = 1 THEN ' (restante)' ELSE '' END ||
          COALESCE(' - '||v_it.fornecedor_nome_snapshot, ''),
        'CI-'||substr(v_it.id::text, 1, 8) || CASE WHEN v_n > 1 THEN '-'||v_i ELSE '' END,
        current_date, v_venc, v_valor_i,
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
    'parcelas',       COALESCE(array_length(v_lanc_ids, 1), 0),
    'entrada',        v_entrada,
    'obra_id',        v_obra
  );
END $function$;
