-- F7 — Idempotência pra fila offline (Feature 1)
-- client_id gerado no aparelho; retry com o mesmo client_id NUNCA duplica.

-- 1) Colunas client_id
ALTER TABLE public.instala_checkins    ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.instala_item_checks ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.instala_updates_cliente ADD COLUMN IF NOT EXISTS client_id uuid;

-- UNIQUE constraint real (não índice parcial): PostgREST upsert on_conflict=client_id
-- precisa de constraint como árbitro do ON CONFLICT. NULLs múltiplos são permitidos.
ALTER TABLE public.instala_checkins        ADD CONSTRAINT uq_instala_checkins_client_id UNIQUE (client_id);
ALTER TABLE public.instala_item_checks     ADD CONSTRAINT uq_instala_item_checks_client_id UNIQUE (client_id);
ALTER TABLE public.instala_updates_cliente ADD CONSTRAINT uq_instala_updates_cliente_client_id UNIQUE (client_id);

-- 2) fn_instala_checkin idempotente (DROP da assinatura atual — CREATE OR REPLACE
--    com param novo criaria OVERLOAD e PostgREST daria PGRST203)
DROP FUNCTION IF EXISTS public.fn_instala_checkin(uuid, uuid, numeric, numeric, numeric, text);

CREATE FUNCTION public.fn_instala_checkin(
  p_prestador_id uuid, p_card_id uuid, p_lat numeric, p_lng numeric,
  p_accuracy numeric DEFAULT NULL, p_foto_url text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_prest uuid;
  v_checkin uuid;
BEGIN
  -- Idempotência: retry da fila offline com o mesmo client_id devolve o existente
  IF p_client_id IS NOT NULL THEN
    SELECT id INTO v_checkin FROM public.instala_checkins WHERE client_id = p_client_id;
    IF v_checkin IS NOT NULL THEN RETURN v_checkin; END IF;
  END IF;

  SELECT id INTO v_prest FROM public.prestadores WHERE id = p_prestador_id AND ativo = true LIMIT 1;
  IF v_prest IS NULL THEN RAISE EXCEPTION 'Prestador inválido'; END IF;

  -- Bloqueia 2 checkins abertos no mesmo dia/card
  UPDATE public.instala_checkins
     SET status = 'fechado', closed_at = now()
   WHERE prestador_id = v_prest AND card_id = p_card_id
     AND status = 'aberto' AND created_at::date = CURRENT_DATE;

  -- id = client_id quando informado: o app offline já conhece o id do check-in
  -- antes de sincronizar (medições offline referenciam checkin_id válido).
  INSERT INTO public.instala_checkins
    (id, prestador_id, card_id, lat, lng, accuracy_m, pin_used, foto_url, client_id)
  VALUES (COALESCE(p_client_id, gen_random_uuid()), v_prest, p_card_id, p_lat, p_lng, p_accuracy, NULL, p_foto_url, p_client_id)
  RETURNING id INTO v_checkin;

  RETURN v_checkin;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_instala_checkin(uuid, uuid, numeric, numeric, numeric, text, uuid) TO anon, authenticated;

-- 3) fn_instala_finalizar_dia idempotente
DROP FUNCTION IF EXISTS public.fn_instala_finalizar_dia(uuid, uuid, text);

CREATE FUNCTION public.fn_instala_finalizar_dia(
  p_card_id uuid, p_prestador_id uuid, p_observacao text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_checkin_id uuid;
  v_nome text;
  v_obra text;
  v_qtd_itens int;
  v_update_id uuid;
BEGIN
  IF p_client_id IS NOT NULL THEN
    SELECT id INTO v_update_id FROM public.instala_updates_cliente WHERE client_id = p_client_id;
    IF v_update_id IS NOT NULL THEN RETURN v_update_id; END IF;
  END IF;

  -- Fecha o check-in aberto de hoje
  UPDATE public.instala_checkins
     SET status = 'fechado', closed_at = now(),
         observacao = COALESCE(observacao, '') || COALESCE(' | ' || p_observacao, '')
   WHERE prestador_id = p_prestador_id AND card_id = p_card_id
     AND status = 'aberto' AND created_at::date = CURRENT_DATE
   RETURNING id INTO v_checkin_id;

  SELECT count(*) INTO v_qtd_itens
    FROM public.instala_item_checks
   WHERE prestador_id = p_prestador_id AND card_id = p_card_id
     AND created_at::date = CURRENT_DATE;

  SELECT nome INTO v_nome FROM public.prestadores WHERE id = p_prestador_id;
  SELECT obra INTO v_obra FROM public.kanban_cards WHERE id = p_card_id;

  INSERT INTO public.instala_updates_cliente
    (card_id, obra_code, prestador_id, kind, titulo, detalhe, payload, client_id)
  VALUES (
    p_card_id, v_obra, p_prestador_id, 'dia_finalizado',
    COALESCE(v_nome,'Instalador') || ' finalizou o dia',
    v_qtd_itens || ' item(ns) concluído(s) hoje',
    jsonb_build_object('checkin_id', v_checkin_id, 'itens_count', v_qtd_itens, 'observacao', p_observacao),
    p_client_id
  )
  RETURNING id INTO v_update_id;

  RETURN v_update_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_instala_finalizar_dia(uuid, uuid, text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
