-- ============================================================
-- F2: tabela de updates pra "central do cliente" + RPCs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.instala_updates_cliente (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  obra_code     text,
  prestador_id  uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
  kind          text NOT NULL CHECK (kind IN ('checkin','item','dia_finalizado','progresso')),
  titulo        text NOT NULL,
  detalhe       text,
  foto_url      text,
  payload       jsonb DEFAULT '{}'::jsonb,
  enviado       boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instala_updates_card_idx ON public.instala_updates_cliente (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS instala_updates_pendentes_idx ON public.instala_updates_cliente (enviado, created_at) WHERE enviado = false;

ALTER TABLE public.instala_updates_cliente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instala_updates_all ON public.instala_updates_cliente;
CREATE POLICY instala_updates_all ON public.instala_updates_cliente USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.instala_updates_cliente TO anon, authenticated;

-- Trigger 1: gravar update toda vez que tem check-in novo
CREATE OR REPLACE FUNCTION public.trg_instala_update_on_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_obra text;
  v_nome text;
BEGIN
  SELECT obra INTO v_obra FROM public.kanban_cards WHERE id = NEW.card_id;
  SELECT nome INTO v_nome FROM public.prestadores WHERE id = NEW.prestador_id;
  INSERT INTO public.instala_updates_cliente
    (card_id, obra_code, prestador_id, kind, titulo, detalhe, payload)
  VALUES (
    NEW.card_id, v_obra, NEW.prestador_id, 'checkin',
    COALESCE(v_nome, 'Instalador') || ' chegou na obra',
    'Check-in realizado com geolocalização',
    jsonb_build_object('lat', NEW.lat, 'lng', NEW.lng, 'accuracy_m', NEW.accuracy_m, 'checkin_id', NEW.id)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_instala_update_on_checkin_t ON public.instala_checkins;
CREATE TRIGGER trg_instala_update_on_checkin_t
AFTER INSERT ON public.instala_checkins
FOR EACH ROW EXECUTE FUNCTION public.trg_instala_update_on_checkin();

-- Trigger 2: gravar update quando item é concluído (foto + qtd)
CREATE OR REPLACE FUNCTION public.trg_instala_update_on_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_obra text;
  v_nome text;
  v_desc text;
  v_un   text;
  v_card uuid;
BEGIN
  -- Resolve card via servico→obra→kanban_cards quando NEW.card_id é nulo
  v_card := NEW.card_id;
  SELECT pos.descricao, pos.unidade, COALESCE(NEW.card_id, kc.id), kc.obra
    INTO v_desc, v_un, v_card, v_obra
    FROM public.prestadores_obra_servicos pos
    LEFT JOIN public.kanban_cards kc ON kc.obra = pos.obra_id AND kc.dept_id IN ('operacional','obras','projetos')
   WHERE pos.id = NEW.servico_id LIMIT 1;
  IF v_card IS NULL THEN RETURN NEW; END IF;

  SELECT nome INTO v_nome FROM public.prestadores WHERE id = NEW.prestador_id;
  INSERT INTO public.instala_updates_cliente
    (card_id, obra_code, prestador_id, kind, titulo, detalhe, foto_url, payload)
  VALUES (
    v_card, v_obra, NEW.prestador_id, 'item',
    COALESCE(v_nome, 'Instalador') || ' concluiu parte de "' || COALESCE(v_desc,'item') || '"',
    NEW.qtd_concluida || ' ' || COALESCE(v_un,'un') || ' registrados',
    NEW.foto_url,
    jsonb_build_object('servico_id', NEW.servico_id, 'qtd', NEW.qtd_concluida, 'lat', NEW.lat, 'lng', NEW.lng)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_instala_update_on_item_t ON public.instala_item_checks;
CREATE TRIGGER trg_instala_update_on_item_t
AFTER INSERT ON public.instala_item_checks
FOR EACH ROW EXECUTE FUNCTION public.trg_instala_update_on_item();

-- RPC: finalizar o dia (fecha o check-in + grava update agregando o que foi feito)
CREATE OR REPLACE FUNCTION public.fn_instala_finalizar_dia(
  p_card_id uuid,
  p_prestador_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_checkin_id uuid;
  v_nome text;
  v_obra text;
  v_qtd_itens int;
  v_update_id uuid;
BEGIN
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
    (card_id, obra_code, prestador_id, kind, titulo, detalhe, payload)
  VALUES (
    p_card_id, v_obra, p_prestador_id, 'dia_finalizado',
    COALESCE(v_nome,'Instalador') || ' finalizou o dia',
    v_qtd_itens || ' item(ns) concluído(s) hoje',
    jsonb_build_object('checkin_id', v_checkin_id, 'itens_count', v_qtd_itens, 'observacao', p_observacao)
  )
  RETURNING id INTO v_update_id;

  RETURN v_update_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_instala_finalizar_dia TO anon, authenticated;

-- View do dia (pra UI mostrar resumo: quanto fez hoje)
CREATE OR REPLACE VIEW public.vw_instala_resumo_dia AS
SELECT
  ic.prestador_id, ic.card_id,
  ic.created_at AS checkin_em,
  ic.closed_at,
  ic.status AS checkin_status,
  COALESCE((
    SELECT count(*) FROM public.instala_item_checks iic
     WHERE iic.prestador_id = ic.prestador_id
       AND iic.card_id = ic.card_id
       AND iic.created_at::date = ic.created_at::date
  ), 0) AS itens_hoje,
  COALESCE((
    SELECT SUM(qtd_concluida) FROM public.instala_item_checks iic
     WHERE iic.prestador_id = ic.prestador_id
       AND iic.card_id = ic.card_id
       AND iic.created_at::date = ic.created_at::date
  ), 0) AS qtd_total_hoje
FROM public.instala_checkins ic;

GRANT SELECT ON public.vw_instala_resumo_dia TO anon, authenticated;
