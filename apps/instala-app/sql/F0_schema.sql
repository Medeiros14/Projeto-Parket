-- ============================================================
-- instala.parket.works — F0 schema
-- Tabelas pra check-in (PIN+GPS), check de itens com foto,
-- view `vw_instala_minhas_obras` que o app já espera,
-- trigger que libera pagamento ao concluir 100% do serviço.
-- ============================================================

-- 1) PIN no prestador (4 dígitos)
ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS pin text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS prestadores_pin_uniq ON public.prestadores (pin) WHERE pin IS NOT NULL;

-- 2) Check-ins (chegada na obra com geo + PIN)
CREATE TABLE IF NOT EXISTS public.instala_checkins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id  uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  card_id       uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  lat           numeric(10,7),
  lng           numeric(10,7),
  accuracy_m    numeric(8,2),
  pin_used      text,
  foto_url      text,
  status        text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado','cancelado')),
  observacao    text,
  created_at    timestamptz DEFAULT now(),
  closed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS instala_checkins_prest_card_idx ON public.instala_checkins (prestador_id, card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS instala_checkins_card_day_idx  ON public.instala_checkins (card_id, created_at);

-- 3) Conclusão de itens (cada item do `prestadores_obra_servicos`)
CREATE TABLE IF NOT EXISTS public.instala_item_checks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id      uuid NOT NULL REFERENCES public.prestadores_obra_servicos(id) ON DELETE CASCADE,
  prestador_id    uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  checkin_id      uuid REFERENCES public.instala_checkins(id) ON DELETE SET NULL,
  card_id         uuid REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  qtd_concluida   numeric(12,2) NOT NULL DEFAULT 0,
  foto_url        text,
  lat             numeric(10,7),
  lng             numeric(10,7),
  observacao      text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instala_item_checks_serv_idx ON public.instala_item_checks (servico_id, created_at DESC);
CREATE INDEX IF NOT EXISTS instala_item_checks_card_idx ON public.instala_item_checks (card_id, created_at DESC);

-- 4) View principal do app (Hoje.tsx já consome essa)
CREATE OR REPLACE VIEW public.vw_instala_minhas_obras AS
WITH agg AS (
  SELECT
    pos.obra_id,
    SUM(pos.contrato_qtd)                                  AS contrato_total,
    SUM(COALESCE((
      SELECT SUM(qtd_concluida) FROM public.instala_item_checks iic WHERE iic.servico_id = pos.id
    ), 0))                                                 AS instalado_total
  FROM public.prestadores_obra_servicos pos
  GROUP BY pos.obra_id
)
SELECT
  pc.id                                                    AS atribuicao_id,
  pc.prestador_id,
  pc.card_id,
  COALESCE(pc.data_entrada, kc.created_at::date)           AS data_prevista_inicio,
  NULL::date                                               AS data_prevista_fim,
  NULLIF(kc.details ->> 'hora_inicio','')::time            AS hora_prevista_inicio,
  false::boolean                                           AS lead_prestador,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.instala_checkins ic
      WHERE ic.prestador_id = pc.prestador_id
        AND ic.card_id = pc.card_id
        AND ic.status = 'aberto'
        AND ic.created_at::date = CURRENT_DATE
    ) THEN 'presente'
    WHEN EXISTS (
      SELECT 1 FROM public.instala_checkins ic
      WHERE ic.prestador_id = pc.prestador_id
        AND ic.card_id = pc.card_id
        AND ic.created_at::date = CURRENT_DATE
    ) THEN 'finalizado'
    ELSE NULL
  END                                                      AS presenca_status,
  NULL::timestamptz                                        AS confirmado_em,
  'ativo'                                                  AS atribuicao_status,
  kc.obra                                                  AS obra_code,
  COALESCE(kc.title, '—')                                  AS cliente_nome,
  (kc.details ->> 'cidade')                                AS cidade,
  CASE WHEN COALESCE(agg.contrato_total,0) > 0
       THEN LEAST(100, ROUND((agg.instalado_total / agg.contrato_total) * 100))::int
       ELSE COALESCE(kc.progress, 0)
  END                                                      AS progress_atual,
  kc.column_id                                             AS card_column,
  pc.observacao
FROM public.prestador_card pc
JOIN public.kanban_cards kc ON kc.id = pc.card_id
LEFT JOIN agg ON agg.obra_id = kc.obra
-- Vínculo prestador_card é intencional: obra aparece pro prestador em qualquer
-- dept (ex.: cards do gestão em 'orcamento'), exceto arquivados.
WHERE kc.dept_id NOT ILIKE '%archived%';

-- 5) View dos itens de uma obra (consulta principal dentro da obra)
CREATE OR REPLACE VIEW public.vw_instala_obra_itens AS
SELECT
  pos.id              AS servico_id,
  pos.obra_id,
  pos.descricao,
  pos.unidade,
  pos.contrato_qtd,
  pos.valor_unitario,
  pos.ordem,
  pos.observacao,
  COALESCE((
    SELECT SUM(qtd_concluida) FROM public.instala_item_checks iic WHERE iic.servico_id = pos.id
  ), 0)               AS qtd_instalada,
  CASE WHEN pos.contrato_qtd > 0
       THEN LEAST(100, ROUND((COALESCE((SELECT SUM(qtd_concluida) FROM public.instala_item_checks iic WHERE iic.servico_id = pos.id),0) / pos.contrato_qtd) * 100))::int
       ELSE 0
  END                 AS pct_concluido
FROM public.prestadores_obra_servicos pos;

-- 6) Trigger: ao concluir 100% de um servico, libera pagamento
CREATE OR REPLACE FUNCTION public.trg_instala_liberar_pagamento()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_total numeric(12,2);
  v_contrato numeric(12,2);
  v_valor_unit numeric(14,2);
BEGIN
  SELECT SUM(qtd_concluida) INTO v_total
    FROM public.instala_item_checks WHERE servico_id = NEW.servico_id;

  SELECT contrato_qtd, valor_unitario INTO v_contrato, v_valor_unit
    FROM public.prestadores_obra_servicos WHERE id = NEW.servico_id;

  IF v_total >= v_contrato AND v_contrato > 0 THEN
    -- Cria registro de pagamento liberado se não existir; senão atualiza pra liberado
    INSERT INTO public.prestadores_pagamentos
      (servico_id, prestador_id, prestador_nome, periodo, qtd, valor, status)
    SELECT
      pos.id,
      NEW.prestador_id,
      p.nome,
      to_char(now(), 'YYYY-MM'),
      v_contrato,
      v_contrato * COALESCE(v_valor_unit,0),
      'liberado'
    FROM public.prestadores_obra_servicos pos
    JOIN public.prestadores p ON p.id = NEW.prestador_id
    WHERE pos.id = NEW.servico_id
      AND NOT EXISTS (
        SELECT 1 FROM public.prestadores_pagamentos pp
        WHERE pp.servico_id = NEW.servico_id
          AND pp.prestador_id = NEW.prestador_id
          AND pp.status IN ('liberado','pago')
      );
  END IF;

  -- Atualiza instalado_qtd direto no serviço
  UPDATE public.prestadores_obra_servicos
     SET instalado_qtd = COALESCE(v_total, 0)
   WHERE id = NEW.servico_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instala_liberar_pagamento_t ON public.instala_item_checks;
CREATE TRIGGER trg_instala_liberar_pagamento_t
AFTER INSERT OR UPDATE OF qtd_concluida ON public.instala_item_checks
FOR EACH ROW EXECUTE FUNCTION public.trg_instala_liberar_pagamento();

-- 7) RPC pra checkin via app (assina via PIN, sem JWT do prestador)
CREATE OR REPLACE FUNCTION public.fn_instala_checkin(
  p_pin text,
  p_card_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_accuracy numeric DEFAULT NULL,
  p_foto_url text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prest uuid;
  v_checkin uuid;
BEGIN
  SELECT id INTO v_prest FROM public.prestadores WHERE pin = p_pin AND ativo = true LIMIT 1;
  IF v_prest IS NULL THEN RAISE EXCEPTION 'PIN inválido'; END IF;

  -- Bloqueia 2 checkins abertos no mesmo dia/card
  UPDATE public.instala_checkins
     SET status = 'fechado', closed_at = now()
   WHERE prestador_id = v_prest AND card_id = p_card_id
     AND status = 'aberto' AND created_at::date = CURRENT_DATE;

  INSERT INTO public.instala_checkins
    (prestador_id, card_id, lat, lng, accuracy_m, pin_used, foto_url)
  VALUES (v_prest, p_card_id, p_lat, p_lng, p_accuracy, p_pin, p_foto_url)
  RETURNING id INTO v_checkin;

  RETURN v_checkin;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_instala_checkin TO anon, authenticated;

-- 8) RPC pra autenticar prestador via PIN (login no app)
CREATE OR REPLACE FUNCTION public.fn_instala_login(p_pin text)
RETURNS TABLE (id uuid, nome text, telefone text, categoria text)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT id, nome, telefone, categoria
    FROM public.prestadores
   WHERE pin = p_pin AND ativo = true LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fn_instala_login TO anon, authenticated;

-- 9) RLS — leituras públicas das views (já são views, RLS herda das tables base)
-- Tabelas novas precisam de RLS permissive pra app funcionar com anon
ALTER TABLE public.instala_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instala_item_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instala_checkins_all ON public.instala_checkins;
CREATE POLICY instala_checkins_all ON public.instala_checkins USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS instala_item_checks_all ON public.instala_item_checks;
CREATE POLICY instala_item_checks_all ON public.instala_item_checks USING (true) WITH CHECK (true);

GRANT SELECT ON public.vw_instala_minhas_obras TO anon, authenticated;
GRANT SELECT ON public.vw_instala_obra_itens TO anon, authenticated;
GRANT INSERT, SELECT ON public.instala_checkins TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON public.instala_item_checks TO anon, authenticated;
