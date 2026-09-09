-- 022: Contas a Pagar de NF (compras_contas_pagar) integradas ao Core.
-- Will 21/08: quem paga e o Core (Financeiro, com comprovante); Compras so
-- gerencia e acompanha. Parcela criada na entrada de NF/entrada manual vira
-- lancamento 'NF-*' no core.lancamentos; baixa no Core sincroniza de volta
-- status pago + data + comprovante; apagar a conta cancela o lancamento.

ALTER TABLE public.compras_contas_pagar
  ADD COLUMN IF NOT EXISTS lancamento_id uuid REFERENCES core.lancamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS comprovante_nome text;

CREATE INDEX IF NOT EXISTS idx_ccp_lancamento ON public.compras_contas_pagar (lancamento_id)
  WHERE lancamento_id IS NOT NULL;

-- Cria o lancamento no Core quando a parcela nasce no Compras.
CREATE OR REPLACE FUNCTION public.compras_cp_criar_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
DECLARE
  v_empresa uuid;
  v_pc uuid;
  v_lanc uuid;
  v_doc text;
BEGIN
  IF NEW.lancamento_id IS NOT NULL OR NEW.status <> 'pendente' THEN
    RETURN NEW;
  END IF;

  -- documento costuma vir como "NF 12345"; tira o prefixo pra nao virar NF-NF
  v_doc := NULLIF(regexp_replace(COALESCE(NEW.documento,''), '^\s*NFE?[\s.-]*', '', 'i'), '');

  SELECT id INTO v_empresa FROM core.empresas WHERE ativo ORDER BY created_at LIMIT 1;
  SELECT id INTO v_pc FROM core.plano_contas WHERE codigo = '6203' LIMIT 1;
  IF v_pc IS NULL THEN
    SELECT id INTO v_pc FROM core.plano_contas WHERE tipo = 'despesa' ORDER BY codigo LIMIT 1;
  END IF;
  IF v_empresa IS NULL OR v_pc IS NULL THEN
    RETURN NEW; -- sem cadastro base no Core, mantem so o trilho legado
  END IF;

  INSERT INTO core.lancamentos
    (empresa_id, plano_conta_id, tipo, status, descricao, numero_documento,
     data_emissao, data_competencia, data_vencimento, valor, forma_pagamento,
     parcela_atual, observacoes)
  VALUES
    (v_empresa, v_pc, 'saida', 'previsto',
     'NF ' || COALESCE(v_doc, 's/n') || ' - ' || COALESCE(NULLIF(NEW.fornecedor,''), 'fornecedor nao informado')
       || COALESCE(' - ' || NULLIF(NEW.projeto,''), ''),
     'NF-' || COALESCE(v_doc, left(NEW.id::text, 8)) || '/' || COALESCE(NEW.parcela, 1),
     CURRENT_DATE,
     COALESCE(NEW.data_vencimento, CURRENT_DATE),
     COALESCE(NEW.data_vencimento, CURRENT_DATE),
     NEW.valor,
     NEW.forma_pagamento,
     COALESCE(NEW.parcela, 1),
     'Origem: Contas a Pagar do Compras (entrada de NF/estoque). conta_id=' || NEW.id)
  RETURNING id INTO v_lanc;

  NEW.lancamento_id := v_lanc;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_ccp_criar_lancamento ON public.compras_contas_pagar;
CREATE TRIGGER trg_ccp_criar_lancamento
  BEFORE INSERT ON public.compras_contas_pagar
  FOR EACH ROW EXECUTE FUNCTION public.compras_cp_criar_lancamento();

-- Baixa (ou estorno) no Core reflete na conta do Compras: status + comprovante.
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
         comprovante_nome = NEW.comprovante_nome
   WHERE lancamento_id = NEW.id;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_lancamento_sync_ccp ON core.lancamentos;
CREATE TRIGGER trg_lancamento_sync_ccp
  AFTER UPDATE ON core.lancamentos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
     OR OLD.comprovante_url IS DISTINCT FROM NEW.comprovante_url
     OR OLD.data_pagamento IS DISTINCT FROM NEW.data_pagamento)
  EXECUTE FUNCTION public.compras_cp_sync_from_lancamento();

-- Apagar a conta no Compras (ex.: re-import da NF) cancela o lancamento nao pago.
CREATE OR REPLACE FUNCTION public.compras_cp_cancelar_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
BEGIN
  IF OLD.lancamento_id IS NOT NULL THEN
    UPDATE core.lancamentos
       SET status = 'cancelado',
           observacoes = COALESCE(observacoes,'') || chr(10) || 'Cancelado: conta de origem apagada no Compras'
     WHERE id = OLD.lancamento_id AND status = 'previsto';
  END IF;
  RETURN OLD;
END $function$;

DROP TRIGGER IF EXISTS trg_ccp_cancelar_lancamento ON public.compras_contas_pagar;
CREATE TRIGGER trg_ccp_cancelar_lancamento
  AFTER DELETE ON public.compras_contas_pagar
  FOR EACH ROW EXECUTE FUNCTION public.compras_cp_cancelar_lancamento();

-- Backfill: parcelas pendentes existentes ganham lancamento no Core.
DO $$
DECLARE
  r record;
  v_empresa uuid;
  v_pc uuid;
  v_lanc uuid;
BEGIN
  SELECT id INTO v_empresa FROM core.empresas WHERE ativo ORDER BY created_at LIMIT 1;
  SELECT id INTO v_pc FROM core.plano_contas WHERE codigo = '6203' LIMIT 1;
  IF v_empresa IS NULL OR v_pc IS NULL THEN RETURN; END IF;

  FOR r IN SELECT * FROM public.compras_contas_pagar
            WHERE status = 'pendente' AND lancamento_id IS NULL
  LOOP
    INSERT INTO core.lancamentos
      (empresa_id, plano_conta_id, tipo, status, descricao, numero_documento,
       data_emissao, data_competencia, data_vencimento, valor, forma_pagamento,
       parcela_atual, observacoes)
    VALUES
      (v_empresa, v_pc, 'saida', 'previsto',
       'NF ' || COALESCE(NULLIF(r.documento,''), 's/n') || ' - ' || COALESCE(NULLIF(r.fornecedor,''), 'fornecedor nao informado')
         || COALESCE(' - ' || NULLIF(r.projeto,''), ''),
       'NF-' || COALESCE(NULLIF(r.documento,''), left(r.id::text, 8)) || '/' || COALESCE(r.parcela, 1),
       COALESCE(r.created_at::date, CURRENT_DATE),
       COALESCE(r.data_vencimento, CURRENT_DATE),
       COALESCE(r.data_vencimento, CURRENT_DATE),
       r.valor,
       r.forma_pagamento,
       COALESCE(r.parcela, 1),
       'Origem: Contas a Pagar do Compras (backfill 022). conta_id=' || r.id)
    RETURNING id INTO v_lanc;

    UPDATE public.compras_contas_pagar SET lancamento_id = v_lanc WHERE id = r.id;
  END LOOP;
END $$;
