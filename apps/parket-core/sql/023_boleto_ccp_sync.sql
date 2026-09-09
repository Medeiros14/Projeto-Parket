-- 023: Boleto nas parcelas de NF (compras_contas_pagar).
-- Will 21/08: quem anexa o boleto e o Compras (/financeiro), o Core so paga.
-- Compras chama anexar_boleto_lancamento/remover_boleto_lancamento (019) no
-- lancamento vinculado; este sync espelha boleto_url/nome de volta na conta,
-- igual ja acontece com o comprovante (022).

ALTER TABLE public.compras_contas_pagar
  ADD COLUMN IF NOT EXISTS boleto_url text,
  ADD COLUMN IF NOT EXISTS boleto_nome text;

CREATE OR REPLACE FUNCTION public.compras_cp_sync_from_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
BEGIN
  UPDATE public.compras_contas_pagar
     SET status = CASE WHEN NEW.status IN ('pago','conciliado','recebido') THEN 'pago' ELSE 'pendente' END,
         data_pagamento = CASE WHEN NEW.status IN ('pago','conciliado','recebido')
                               THEN COALESCE(NEW.data_pagamento, CURRENT_DATE) ELSE NULL END,
         comprovante_url = NEW.comprovante_url,
         comprovante_nome = NEW.comprovante_nome,
         boleto_url = NEW.boleto_url,
         boleto_nome = NEW.boleto_nome
   WHERE lancamento_id = NEW.id;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_lancamento_sync_ccp ON core.lancamentos;
CREATE TRIGGER trg_lancamento_sync_ccp
  AFTER UPDATE ON core.lancamentos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
     OR OLD.comprovante_url IS DISTINCT FROM NEW.comprovante_url
     OR OLD.data_pagamento IS DISTINCT FROM NEW.data_pagamento
     OR OLD.boleto_url IS DISTINCT FROM NEW.boleto_url)
  EXECUTE FUNCTION public.compras_cp_sync_from_lancamento();

-- Backfill: contas ja vinculadas herdam boleto existente do lancamento.
UPDATE public.compras_contas_pagar c
   SET boleto_url = l.boleto_url,
       boleto_nome = l.boleto_nome
  FROM core.lancamentos l
 WHERE l.id = c.lancamento_id
   AND l.boleto_url IS NOT NULL
   AND c.boleto_url IS DISTINCT FROM l.boleto_url;
