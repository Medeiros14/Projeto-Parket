-- RPC pra gerar PIN único pro prestador (4 dígitos)
CREATE OR REPLACE FUNCTION public.fn_instala_gerar_pin(p_prestador_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_pin text;
  v_tentativas int := 0;
BEGIN
  LOOP
    v_pin := LPAD(((random()*9999)::int)::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.prestadores WHERE pin = v_pin);
    v_tentativas := v_tentativas + 1;
    IF v_tentativas > 50 THEN RAISE EXCEPTION 'Esgotaram tentativas pra gerar PIN único'; END IF;
  END LOOP;

  UPDATE public.prestadores SET pin = v_pin, updated_at = now()
   WHERE id = p_prestador_id;

  RETURN v_pin;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_instala_gerar_pin TO anon, authenticated;

-- View pra listar prestadores (pra admin)
CREATE OR REPLACE VIEW public.vw_instala_prestadores AS
SELECT
  p.id, p.nome, p.telefone, p.categoria, p.pin, p.ativo,
  (SELECT count(*) FROM public.prestador_card pc WHERE pc.prestador_id = p.id) AS obras_vinculadas,
  (SELECT count(*) FROM public.instala_checkins ic WHERE ic.prestador_id = p.id) AS checkins_total,
  (SELECT max(created_at) FROM public.instala_checkins ic WHERE ic.prestador_id = p.id) AS ultimo_checkin
FROM public.prestadores p
WHERE p.ativo = true;

GRANT SELECT ON public.vw_instala_prestadores TO anon, authenticated;
