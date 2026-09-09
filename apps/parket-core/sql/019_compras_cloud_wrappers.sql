-- 019 — Compras x Financeiro (Cloud hbxpilrxmitvzebluoom)
--
-- 1) Versiona o drift: funcoes que existiam no Cloud aplicadas ad-hoc e nunca
--    entraram no repo (parse_prazo_faturamento, pagar_lancamento_compra,
--    boleto/comprovante, parcelas_bulk).
-- 2) Endurece os wrappers public: por serem SECURITY DEFINER (owner postgres),
--    core.can_reverse() via current_user SEMPRE passava — ate anon conseguia
--    dar baixa. Gate agora e por JWT: core.is_admin() (auth.uid) pra pagar/
--    aprovar/reprovar, auth.uid() IS NOT NULL pra boleto (setor Compras anexa).
-- 3) Cria wrappers public.aprovar_item_compra / public.reprovar_item_compra
--    (Cloud REST nao expoe schema core; Core UI chama via /rest/v1/rpc).
-- 4) View consolidada public.v_pagamentos_compras (item + card + fornecedor)
--    pra tela Pagamentos fazer 1 GET em vez de 3.
--
-- Aplicar no CLOUD via Management API. O pg-local nao usa nada disso.

-- ---------------------------------------------------------------------------
-- Parser de prazo de faturamento ("10/20/30", "28 dias", "a vista" -> {0})
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parse_prazo_faturamento(p_texto text)
 RETURNS integer[]
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_clean text;
  v_out   int[] := '{}';
  v_num   int;
BEGIN
  IF p_texto IS NULL OR btrim(p_texto) = '' THEN
    RETURN ARRAY[0];
  END IF;
  v_clean := lower(p_texto);
  -- Remove trechos com % (nao sao prazo, sao fracao)
  v_clean := regexp_replace(v_clean, '\d+\s*%[^,/;]*', '', 'g');
  FOR v_num IN
    SELECT (m[1])::int FROM regexp_matches(v_clean, '(\d+)', 'g') m
  LOOP
    IF v_num >= 0 AND v_num <= 3650 THEN
      v_out := v_out || v_num;
    END IF;
  END LOOP;
  IF array_length(v_out, 1) IS NULL THEN
    RETURN ARRAY[0]; -- "a vista", "sem prazo" -> 1 parcela dia 0
  END IF;
  RETURN v_out;
END $function$;

-- ---------------------------------------------------------------------------
-- Baixa de parcela de compra (core) — comprovante obrigatorio; ultima parcela
-- baixada marca compras_itens.status='pago' + comprovante agregado no item.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.pagar_lancamento_compra(p_lancamento_id uuid, p_comprovante_url text, p_comprovante_nome text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
DECLARE v_email text; v_item_id uuid; v_pend int;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF p_comprovante_url IS NULL OR btrim(p_comprovante_url) = '' THEN RAISE EXCEPTION 'comprovante_obrigatorio'; END IF;
  v_email := core.current_user_email();
  SELECT compras_item_id INTO v_item_id FROM core.lancamentos WHERE id = p_lancamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lancamento_nao_encontrado'; END IF;
  UPDATE core.lancamentos
     SET status='baixado', data_pagamento=current_date,
         comprovante_url=p_comprovante_url, comprovante_nome=p_comprovante_nome
   WHERE id = p_lancamento_id;
  IF v_item_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_pend FROM core.lancamentos WHERE compras_item_id=v_item_id AND status<>'baixado' AND status<>'cancelado';
    UPDATE public.compras_itens
       SET comprovante_pagto_url=p_comprovante_url, comprovante_pagto_nome=p_comprovante_nome,
           status=CASE WHEN v_pend=0 THEN 'pago' ELSE status END,
           pago_em=CASE WHEN v_pend=0 THEN now() ELSE pago_em END,
           pago_por=CASE WHEN v_pend=0 THEN v_email ELSE pago_por END
     WHERE id = v_item_id;
  END IF;
  RETURN jsonb_build_object('lancamento_id', p_lancamento_id, 'item_id', v_item_id, 'parcelas_pendentes', v_pend);
END $function$;

-- Wrapper REST. Gate por JWT (is_admin via auth.uid) — can_reverse sozinho nao
-- segura porque dentro de SECDEF current_user='postgres'.
CREATE OR REPLACE FUNCTION public.pagar_lancamento_compra(p_lancamento_id uuid, p_comprovante_url text, p_comprovante_nome text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT core.is_admin() THEN RAISE EXCEPTION 'permissao_negada: apenas financeiro/admin'; END IF;
  RETURN core.pagar_lancamento_compra(p_lancamento_id, p_comprovante_url, p_comprovante_nome);
END $function$;

-- ---------------------------------------------------------------------------
-- Boleto por parcela — setor Compras anexa (qualquer usuario logado).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.anexar_boleto_lancamento(p_lancamento_id uuid, p_boleto_url text, p_boleto_nome text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permissao_negada: login necessario'; END IF;
  UPDATE core.lancamentos SET boleto_url=p_boleto_url, boleto_nome=p_boleto_nome WHERE id = p_lancamento_id;
END $function$;

CREATE OR REPLACE FUNCTION public.remover_boleto_lancamento(p_lancamento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permissao_negada: login necessario'; END IF;
  UPDATE core.lancamentos SET boleto_url=NULL, boleto_nome=NULL WHERE id = p_lancamento_id;
END $function$;

-- ---------------------------------------------------------------------------
-- Remover comprovante (estorna baixa da parcela) — so financeiro/admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remover_comprovante_lancamento(p_lancamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
DECLARE
  v_item uuid;
  v_pend int;
  v_ultimo_url text;
  v_ultimo_nome text;
BEGIN
  IF NOT core.is_admin() THEN RAISE EXCEPTION 'permissao_negada: apenas financeiro/admin'; END IF;
  UPDATE core.lancamentos
     SET comprovante_url=NULL, comprovante_nome=NULL,
         status = CASE WHEN status='baixado' THEN 'previsto' ELSE status END,
         data_pagamento = CASE WHEN status='baixado' THEN NULL ELSE data_pagamento END
   WHERE id = p_lancamento_id
   RETURNING compras_item_id INTO v_item;

  IF v_item IS NOT NULL THEN
    SELECT COUNT(*) INTO v_pend
      FROM core.lancamentos
     WHERE compras_item_id=v_item AND status<>'baixado' AND status<>'cancelado';

    -- pega o ultimo comprovante restante (se sobrar algum pago) pra manter o
    -- campo agregado compras_itens.comprovante_pagto_url em sincronia.
    SELECT comprovante_url, comprovante_nome INTO v_ultimo_url, v_ultimo_nome
      FROM core.lancamentos
     WHERE compras_item_id=v_item AND status='baixado' AND comprovante_url IS NOT NULL
     ORDER BY data_pagamento DESC NULLS LAST, id DESC
     LIMIT 1;

    UPDATE public.compras_itens
       SET comprovante_pagto_url = v_ultimo_url,
           comprovante_pagto_nome = v_ultimo_nome,
           status = CASE WHEN v_pend > 0 AND status='pago' THEN 'aprovado' ELSE status END,
           pago_em = CASE WHEN v_pend > 0 AND status='pago' THEN NULL ELSE pago_em END,
           pago_por = CASE WHEN v_pend > 0 AND status='pago' THEN NULL ELSE pago_por END
     WHERE id = v_item;
  END IF;

  RETURN jsonb_build_object('lancamento_id', p_lancamento_id, 'item_id', v_item, 'parcelas_pendentes', v_pend);
END $function$;

-- ---------------------------------------------------------------------------
-- Parcelas (core.lancamentos) por lote de itens — tela Pagamentos + Faturamentos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compras_itens_parcelas_bulk(p_item_ids uuid[])
 RETURNS TABLE(compras_item_id uuid, id uuid, valor numeric, data_vencimento date, data_pagamento date, status text, numero_documento text, boleto_url text, boleto_nome text, comprovante_url text, comprovante_nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'core', 'public', 'pg_catalog'
AS $function$
  SELECT compras_item_id, id, valor, data_vencimento, data_pagamento, status, numero_documento, boleto_url, boleto_nome, comprovante_url, comprovante_nome
    FROM core.lancamentos WHERE compras_item_id = ANY(p_item_ids) ORDER BY compras_item_id, data_vencimento
$function$;

-- ---------------------------------------------------------------------------
-- Aprovacao item-a-item via REST (Core UI /aprovacoes). Cloud REST nao expoe
-- schema core -> wrapper public com gate JWT.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aprovar_item_compra(p_item_id uuid, p_venc_override date DEFAULT NULL::date, p_cria_lancamento boolean DEFAULT true, p_obra_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT core.is_admin() THEN RAISE EXCEPTION 'permissao_negada: apenas financeiro/admin'; END IF;
  RETURN core.aprovar_item_compra(p_item_id, p_venc_override, p_cria_lancamento, p_obra_id);
END $function$;

CREATE OR REPLACE FUNCTION public.reprovar_item_compra(p_item_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT core.is_admin() THEN RAISE EXCEPTION 'permissao_negada: apenas financeiro/admin'; END IF;
  PERFORM core.reprovar_item_compra(p_item_id, p_motivo);
END $function$;

-- ---------------------------------------------------------------------------
-- View consolidada: item + card + fornecedor em 1 GET (tela Pagamentos e
-- Aprovacoes deixam de fazer 3 fetches encadeados). security_invoker herda a
-- RLS das tabelas base.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_pagamentos_compras
WITH (security_invoker = true) AS
SELECT it.*,
       c.title          AS card_title,
       c.dept_id        AS card_dept_id,
       c.obra           AS card_obra,
       c.details        AS card_details,
       c.responsavel    AS card_responsavel,
       c.chat_messages  AS card_chat_messages,
       f.nome           AS forn_nome_cad,
       f.cnpj           AS forn_cnpj_cad,
       f.razao_social   AS forn_razao_cad,
       f.banco          AS forn_banco_cad,
       f.agencia        AS forn_agencia_cad,
       f.conta          AS forn_conta_cad,
       f.pix            AS forn_pix_cad,
       f.forma_pagamento AS forn_forma_pgto_cad,
       f.prazo_pagamento AS forn_prazo_pgto_cad,
       f.telefone       AS forn_telefone_cad,
       f.email          AS forn_email_cad
  FROM public.compras_itens it
  LEFT JOIN public.kanban_cards c ON c.id = it.card_id
  LEFT JOIN public.compras_fornecedores f ON f.id = it.fornecedor_id;

GRANT SELECT ON public.v_pagamentos_compras TO anon, authenticated;
