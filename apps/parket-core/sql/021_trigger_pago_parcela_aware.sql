-- 021: trg_lancamento_pago_sync_compras parcela-aware.
-- Legado (Fase 3): lancamento vinculado vira 'pago' -> item 'pago' na hora.
-- Com parcelamento (019) isso flipava o item no pagamento da 1a parcela
-- (item.lancamento_id aponta pra ela), sem pago_em/pago_por.
-- Agora: parcela (compras_item_id preenchido) so paga o item quando nao
-- resta parcela pendente; lancamento legado (compras_item_id NULL) mantem
-- o comportamento antigo.

CREATE OR REPLACE FUNCTION public.compras_sync_pago_from_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    IF NEW.compras_item_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM core.lancamentos
         WHERE compras_item_id = NEW.compras_item_id
           AND status NOT IN ('pago','recebido','conciliado','cancelado')
      ) THEN
        UPDATE public.compras_itens
           SET status = 'pago', pago_em = COALESCE(pago_em, now())
         WHERE id = NEW.compras_item_id
           AND status IN ('aprovado','em_rota','entregue','faturado');
      END IF;
    ELSE
      UPDATE public.compras_itens
         SET status = 'pago'
       WHERE lancamento_id = NEW.id
         AND status IN ('aprovado','em_rota','entregue','faturado');
    END IF;
  END IF;
  RETURN NEW;
END $function$;
