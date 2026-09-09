-- 017_compras_itens_atendido_estoque
-- Item pode ser "atendido do estoque" — Ronaldo marca no card que já tem no
-- Almoxarifado, então não vai pro Financeiro comprar. Fica registrado pra auditoria.
-- ===========================================================================
-- Coluna nova + trigger de gargalo ignora esses itens (contabiliza igual a
-- "completos" no cálculo de andamento_misto do card).

BEGIN;

ALTER TABLE public.compras_itens
  ADD COLUMN IF NOT EXISTS atendido_estoque BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS atendido_estoque_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atendido_estoque_por TEXT,
  ADD COLUMN IF NOT EXISTS atendido_estoque_deposito TEXT;

CREATE INDEX IF NOT EXISTS compras_itens_atendido_estoque_idx
  ON public.compras_itens (card_id) WHERE atendido_estoque = true;

-- Recalcular gargalo: itens atendidos do estoque contam como "completos" (não
-- travam a coluna do card) — mesmo tratamento que reprovados/pagos.
CREATE OR REPLACE FUNCTION public.compras_recalc_card_column()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_card_id     uuid := COALESCE(NEW.card_id, OLD.card_id);
  v_target_col  text;
  v_total       int;
  v_completos   int;
  v_reprovados  int;
  v_agendados   int;
  v_estoque     int;
  v_min_ordem   int;
  v_max_ordem   int;
  v_misto       boolean := false;
BEGIN
  IF v_card_id IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ci.status = 'pago' OR ci.atendido_estoque = true),
    COUNT(*) FILTER (WHERE ci.status = 'reprovado'),
    COUNT(*) FILTER (WHERE ci.status = 'cotacao' AND ci.comprar_em IS NOT NULL AND ci.comprar_em > CURRENT_DATE AND ci.atendido_estoque = false),
    COUNT(*) FILTER (WHERE ci.atendido_estoque = true),
    -- gargalo IGNORA agendados + atendidos do estoque
    MIN(csm.ordem) FILTER (
      WHERE ci.status <> 'reprovado'
        AND ci.atendido_estoque = false
        AND NOT (ci.status = 'cotacao' AND ci.comprar_em IS NOT NULL AND ci.comprar_em > CURRENT_DATE)
    ),
    MAX(csm.ordem) FILTER (
      WHERE ci.status <> 'reprovado'
        AND ci.atendido_estoque = false
        AND NOT (ci.status = 'cotacao' AND ci.comprar_em IS NOT NULL AND ci.comprar_em > CURRENT_DATE)
    )
  INTO v_total, v_completos, v_reprovados, v_agendados, v_estoque, v_min_ordem, v_max_ordem
  FROM public.compras_itens ci
  JOIN public.compras_status_column_map csm ON csm.status = ci.status
  WHERE ci.card_id = v_card_id;

  IF v_min_ordem IS NOT NULL THEN
    SELECT column_id INTO v_target_col
      FROM public.compras_status_column_map
     WHERE ordem = v_min_ordem;
    v_misto := (v_max_ordem - v_min_ordem) >= 30;
  END IF;

  UPDATE public.kanban_cards
     SET column_id = CASE
           WHEN COALESCE((details->>'compras_itens_ativo')::boolean, false) AND v_target_col IS NOT NULL
             THEN v_target_col
           ELSE column_id
         END,
         details = COALESCE(details, '{}'::jsonb) || jsonb_build_object(
           'compras_itens_stats', jsonb_build_object(
             'total', COALESCE(v_total, 0),
             'completos', COALESCE(v_completos, 0),
             'reprovados', COALESCE(v_reprovados, 0),
             'agendados', COALESCE(v_agendados, 0),
             'atendidos_estoque', COALESCE(v_estoque, 0),
             'andamento_misto', v_misto
           )
         ),
         updated_at = now()
   WHERE id = v_card_id;

  RETURN NEW;
END $$;

COMMIT;
