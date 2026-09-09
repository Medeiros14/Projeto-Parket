-- Rollback da migration 015 (compras_itens + trigger de gargalo).
-- Ordem inversa das dependências. Idempotente.
BEGIN;

-- Se houver dados em produção, aborta a menos que --force=1
DO $$
DECLARE v_cnt bigint;
BEGIN
  IF to_regclass('public.compras_itens') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_cnt FROM public.compras_itens;
    IF v_cnt > 0 AND coalesce(current_setting('rollback.force', true), '0') <> '1' THEN
      RAISE EXCEPTION 'compras_itens tem % linhas; rode com SET rollback.force=1 pra forçar', v_cnt;
    END IF;
  END IF;
END $$;

-- Triggers e functions do sync pago
DROP TRIGGER IF EXISTS trg_lancamento_pago_sync_compras ON core.lancamentos;
DROP FUNCTION IF EXISTS public.compras_sync_pago_from_lancamento();

-- RPCs core
DROP FUNCTION IF EXISTS core.reprovar_item_compra(uuid, text);
DROP FUNCTION IF EXISTS core.aprovar_item_compra(uuid, date, boolean);

-- Trigger + fn gargalo
DROP TRIGGER IF EXISTS trg_compras_itens_recalc ON public.compras_itens;
DROP FUNCTION IF EXISTS public.compras_recalc_card_column();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_compras_itens_updated ON public.compras_itens;
DROP FUNCTION IF EXISTS public.compras_itens_touch_updated_at();

-- Remove colunas ci-* do kanban antes de dropar o map
DELETE FROM public.kanban_columns
 WHERE dept_id LIKE 'compras%' AND slug LIKE 'ci-%';

-- Tabelas
DROP TABLE IF EXISTS public.compras_itens;
DROP TABLE IF EXISTS public.compras_status_column_map;

COMMIT;
