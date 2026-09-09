-- Core v2 — Fase 1 da integração Compras↔Financeiro por item.
-- Task Will 13/08: cada material vira uma linha com status próprio; coluna do card
-- é calculada pelo item MENOS avançado ("gargalo"); aprovação item-a-item no
-- Core /aprovacoes cria automaticamente Contas a Pagar em core.lancamentos.
--
-- Padrão: espelho + write-back (memoria CORE = ESPELHO + WRITE-BACK).
--   • Compras é dona: public.compras_itens é fonte da verdade dos itens.
--   • Core lê ao vivo (cross-schema) e devolve aprovação via RPC.
--   • Kanban atualiza sozinho via trigger de gargalo.
--
-- Não-destrutivo: kanban_cards.details.materiais legacy continua funcionando.
-- Cards só entram no fluxo novo quando details.compras_itens_ativo=true.
-- Backfill em massa NÃO acontece aqui — só cards que os operadores tocarem.
--
-- Idempotente (IF NOT EXISTS/OR REPLACE). Rollback em 015_..._rollback.sql.

BEGIN;

-- ═══════ 1. Mapa status → column_id (metadata configurável) ══════════
-- Vive em tabela pra Will renomear colunas sem alterar código de trigger.
CREATE TABLE IF NOT EXISTS public.compras_status_column_map (
  status    text PRIMARY KEY,
  column_id text NOT NULL,
  ordem     int  NOT NULL,     -- menor = "menos avançado" (gargalo)
  label     text NOT NULL
);

-- Prefixo `ci-` (compras itens) evita colidir com slugs existentes em kanban_columns
-- (compras-taiara já tem `cotacao`, `aguarda-aprovacao`, etc — semânticas diferentes).
INSERT INTO public.compras_status_column_map (status, column_id, ordem, label) VALUES
  ('cotacao',              'ci-cotacao',              10, 'Cotação'),
  ('aguardando_aprovacao', 'ci-aguardando-financeiro', 20, 'Aguardando Financeiro'),
  ('aprovado',             'ci-aprovado',             30, 'Aprovado'),
  ('em_rota',              'ci-em-rota',              40, 'Em Rota de Entrega'),
  ('entregue',             'ci-entregue',             50, 'Entregue'),
  ('faturado',             'ci-faturado',             60, 'Faturado'),
  ('pago',                 'ci-pago',                 70, 'Pago'),
  ('reprovado',            'ci-reprovado',            99, 'Reprovado')
ON CONFLICT (status) DO NOTHING;

-- ═══════ 1b. Cria as colunas no kanban_columns pra cada dept de compras ═══════
-- Necessário pra trigger fix_orphan_kanban_column não substituir a coluna alvo
-- por uma default. Posição 900+ pra ficar no fim (colunas legacy mantêm ordem).
DO $seed$
DECLARE
  v_dept text;
  v_depts text[] := ARRAY['compras','compras-taiara','compras-marco','compras-ronaldo'];
  v_status record;
BEGIN
  FOREACH v_dept IN ARRAY v_depts LOOP
    FOR v_status IN SELECT column_id, label, ordem FROM public.compras_status_column_map LOOP
      INSERT INTO public.kanban_columns (dept_id, slug, title, color, position)
      VALUES (
        v_dept,
        v_status.column_id,
        v_status.label,
        CASE v_status.column_id
          WHEN 'ci-cotacao'              THEN '#94A3B8'
          WHEN 'ci-aguardando-financeiro' THEN '#EAB308'
          WHEN 'ci-aprovado'             THEN '#8B5CF6'
          WHEN 'ci-em-rota'              THEN '#3B82F6'
          WHEN 'ci-entregue'             THEN '#14B8A6'
          WHEN 'ci-faturado'             THEN '#F97316'
          WHEN 'ci-pago'                 THEN '#10B981'
          WHEN 'ci-reprovado'            THEN '#EF4444'
        END,
        900 + v_status.ordem
      )
      ON CONFLICT (dept_id, slug) DO NOTHING;
    END LOOP;
  END LOOP;
END $seed$;


-- ═══════ 2. Itens do pedido (fonte da verdade) ═══════════════════════
CREATE TABLE IF NOT EXISTS public.compras_itens (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id                  uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  seq                      int  NOT NULL,   -- 1,2,3… ordem dentro do card
  material                 text NOT NULL,
  quantidade               text,             -- livre (ex "250m", "3 caixas")
  fornecedor_id            uuid REFERENCES public.compras_fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome_snapshot text,             -- histórico caso fornecedor mude/suma
  forma_pagamento          text CHECK (forma_pagamento IN ('avista','faturado')) DEFAULT 'faturado',
  prazo_faturamento_dias   int  DEFAULT 30 CHECK (prazo_faturamento_dias >= 0),
  valor                    numeric(14,2) DEFAULT 0 CHECK (valor >= 0),
  status                   text NOT NULL DEFAULT 'cotacao'
                           REFERENCES public.compras_status_column_map(status)
                           ON UPDATE CASCADE ON DELETE RESTRICT,
  solicitado_por           text,             -- email de quem cadastrou
  aprovado_por             text,             -- email do Financeiro que aprovou
  aprovado_em              timestamptz,
  motivo_reprovacao        text,
  lancamento_id            uuid,             -- FK lógica pra core.lancamentos (sem constraint cross-schema)
  observacoes              text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, seq)
);

CREATE INDEX IF NOT EXISTS compras_itens_card_status_idx ON public.compras_itens (card_id, status);
CREATE INDEX IF NOT EXISTS compras_itens_aguardando_idx  ON public.compras_itens (status) WHERE status = 'aguardando_aprovacao';
CREATE INDEX IF NOT EXISTS compras_itens_fornecedor_idx  ON public.compras_itens (fornecedor_id) WHERE fornecedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS compras_itens_lancamento_idx  ON public.compras_itens (lancamento_id) WHERE lancamento_id IS NOT NULL;


-- ═══════ 3. Trigger: updated_at automático ═══════════════════════════
CREATE OR REPLACE FUNCTION public.compras_itens_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_compras_itens_updated ON public.compras_itens;
CREATE TRIGGER trg_compras_itens_updated
  BEFORE UPDATE ON public.compras_itens
  FOR EACH ROW EXECUTE FUNCTION public.compras_itens_touch_updated_at();


-- ═══════ 4. Trigger de gargalo — recalcula column_id do card ═════════
-- Regra:
--   • Coluna do card = coluna do item com MENOR ordem (menos avançado), ignorando reprovados.
--   • Só move se details.compras_itens_ativo=true (feature flag por card).
--   • Grava stats em details.compras_itens_stats: {total, completos, reprovados, andamento_misto}.
--   • Anti-loop via pg_trigger_depth (evita reentrância se UPDATE em kanban_cards
--     acidentalmente dispara outros triggers que voltem aqui).
CREATE OR REPLACE FUNCTION public.compras_recalc_card_column()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_card_id    uuid := COALESCE(NEW.card_id, OLD.card_id);
  v_target_col text;
  v_total      int;
  v_completos  int;
  v_reprovados int;
  v_min_ordem  int;
  v_max_ordem  int;
  v_misto      boolean := false;
BEGIN
  IF v_card_id IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ci.status = 'pago'),
    COUNT(*) FILTER (WHERE ci.status = 'reprovado'),
    MIN(csm.ordem) FILTER (WHERE ci.status <> 'reprovado'),
    MAX(csm.ordem) FILTER (WHERE ci.status <> 'reprovado')
  INTO v_total, v_completos, v_reprovados, v_min_ordem, v_max_ordem
  FROM public.compras_itens ci
  JOIN public.compras_status_column_map csm ON csm.status = ci.status
  WHERE ci.card_id = v_card_id;

  IF v_min_ordem IS NOT NULL THEN
    SELECT column_id INTO v_target_col
      FROM public.compras_status_column_map
     WHERE ordem = v_min_ordem;
    v_misto := (v_max_ordem - v_min_ordem) >= 30;  -- gap ≥ 3 fases = "misto"
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
             'andamento_misto', v_misto
           )
         ),
         updated_at = now()
   WHERE id = v_card_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_compras_itens_recalc ON public.compras_itens;
CREATE TRIGGER trg_compras_itens_recalc
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.compras_itens
  FOR EACH ROW EXECUTE FUNCTION public.compras_recalc_card_column();


-- ═══════ 4b. Helpers can_reverse + current_user_email (defensivo) ══════
-- Migrations 011/012 assumem que existem mas o CREATE não está commitado.
-- Cria só se não existir (não sobrescreve versão pré-existente do Will).
DO $bootstrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='core' AND p.proname='current_user_email') THEN
    CREATE FUNCTION core.current_user_email() RETURNS text
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_catalog AS $inner$
      SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'email',
        current_user
      )
    $inner$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='core' AND p.proname='can_reverse') THEN
    CREATE FUNCTION core.can_reverse() RETURNS boolean
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_catalog AS $inner$
      DECLARE v_email text; v_role text;
      BEGIN
        v_email := core.current_user_email();
        -- service_role sempre pode (chamadas server-side)
        IF current_user IN ('service_role','postgres','supabase_admin') THEN RETURN true; END IF;
        -- superadmin/admin/dept_leader via user_profiles
        SELECT role INTO v_role FROM public.user_profiles WHERE email = v_email LIMIT 1;
        RETURN COALESCE(v_role, '') IN ('admin','superadmin','dept_leader');
      END $inner$;
  END IF;
END $bootstrap$;
GRANT EXECUTE ON FUNCTION core.current_user_email() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION core.can_reverse()        TO authenticated, service_role;


-- ═══════ 5. RPC: aprovar_item_compra (Core → Compras write-back) ═════
-- Padrão idêntico ao aprovar_pedido_compra (SECURITY DEFINER + can_reverse).
--   • forma_pagamento='avista' → item vai direto pra 'em_rota' (sem lançamento).
--   • forma_pagamento='faturado' → item vira 'aprovado' + cria core.lancamentos
--     (saida, previsto, venc = hoje + prazo_faturamento_dias ou p_venc_override).
-- Match fornecedor → parceiro via CNPJ (mesmo pattern que pedido_compra).
CREATE OR REPLACE FUNCTION core.aprovar_item_compra(
  p_item_id         uuid,
  p_venc_override   date DEFAULT NULL,
  p_cria_lancamento boolean DEFAULT true
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,core,pg_catalog AS $$
DECLARE
  v_email      text;
  v_it         public.compras_itens%ROWTYPE;
  v_novo       text;
  v_lanc       uuid;
  v_venc       date;
  v_parc       uuid;
  v_plano      uuid;
  v_centro     uuid;
  v_empresa    uuid;
  v_forn_doc   text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada: apenas admin'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_it FROM public.compras_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_nao_encontrado: %', p_item_id; END IF;
  IF v_it.status <> 'aguardando_aprovacao' THEN
    RAISE EXCEPTION 'item_nao_aprovavel: status=%', v_it.status;
  END IF;

  v_novo := CASE WHEN v_it.forma_pagamento = 'avista' THEN 'em_rota' ELSE 'aprovado' END;

  IF p_cria_lancamento AND v_it.forma_pagamento = 'faturado' AND COALESCE(v_it.valor, 0) > 0 THEN
    v_venc := COALESCE(p_venc_override, current_date + v_it.prazo_faturamento_dias);

    -- Match fornecedor → parceiro via CNPJ (best effort — pode faltar)
    IF v_it.fornecedor_id IS NOT NULL THEN
      SELECT documento INTO v_forn_doc FROM public.compras_fornecedores WHERE id = v_it.fornecedor_id;
      IF v_forn_doc IS NOT NULL THEN
        SELECT id INTO v_parc FROM core.parceiros
         WHERE documento IS NOT NULL
           AND regexp_replace(documento,'\D','','g') = regexp_replace(v_forn_doc,'\D','','g')
         LIMIT 1;
      END IF;
    END IF;

    SELECT id INTO v_empresa FROM core.empresas LIMIT 1;
    SELECT id INTO v_plano   FROM core.plano_contas WHERE codigo='1018' LIMIT 1;  -- FRETES E DESCARGAS (proxy compras)
    SELECT id INTO v_centro  FROM core.centros_custo WHERE codigo='6' LIMIT 1;    -- OPERACIONAL

    INSERT INTO core.lancamentos (
      empresa_id, centro_custo_id, plano_conta_id, parceiro_id,
      tipo, status, descricao,
      numero_documento, data_competencia, data_vencimento, valor,
      observacoes
    ) VALUES (
      v_empresa, v_centro, v_plano, v_parc,
      'saida', 'previsto',
      'Compra item ' || v_it.material || COALESCE(' — '||v_it.fornecedor_nome_snapshot, ''),
      'CI-'||substr(v_it.id::text, 1, 8),
      current_date, v_venc, v_it.valor,
      'Aprovado por '||v_email||' via item de compra '||v_it.id::text
    ) RETURNING id INTO v_lanc;
  END IF;

  UPDATE public.compras_itens
     SET status         = v_novo,
         aprovado_por   = v_email,
         aprovado_em    = now(),
         lancamento_id  = COALESCE(v_lanc, lancamento_id)
   WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'item_id',       p_item_id,
    'novo_status',   v_novo,
    'lancamento_id', v_lanc,
    'venc',          v_venc
  );
END $$;

GRANT EXECUTE ON FUNCTION core.aprovar_item_compra(uuid,date,boolean)
  TO authenticated, service_role;


-- ═══════ 6. RPC: reprovar_item_compra ════════════════════════════════
CREATE OR REPLACE FUNCTION core.reprovar_item_compra(
  p_item_id uuid,
  p_motivo  text
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,core,pg_catalog AS $$
DECLARE v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada'; END IF;
  IF COALESCE(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  v_email := core.current_user_email();

  UPDATE public.compras_itens
     SET status            = 'reprovado',
         aprovado_por      = v_email,
         aprovado_em       = now(),
         motivo_reprovacao = p_motivo
   WHERE id = p_item_id AND status = 'aguardando_aprovacao';
  IF NOT FOUND THEN RAISE EXCEPTION 'item_nao_encontrado_ou_nao_aguardando: %', p_item_id; END IF;
END $$;

GRANT EXECUTE ON FUNCTION core.reprovar_item_compra(uuid,text)
  TO authenticated, service_role;


-- ═══════ 7. Sync: quando lançamento vira "pago", item também vira ════
-- Fecha o ciclo: Financeiro dá baixa em core.lancamentos → item de Compras
-- avança pra 'pago' automaticamente → trigger de gargalo move o card se cabível.
CREATE OR REPLACE FUNCTION public.compras_sync_pago_from_lancamento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    UPDATE public.compras_itens
       SET status = 'pago'
     WHERE lancamento_id = NEW.id
       AND status IN ('aprovado','em_rota','entregue','faturado');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lancamento_pago_sync_compras ON core.lancamentos;
CREATE TRIGGER trg_lancamento_pago_sync_compras
  AFTER UPDATE OF status ON core.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.compras_sync_pago_from_lancamento();


-- ═══════ 8. GRANTs pra PostgREST ═════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_itens               TO authenticated;
GRANT SELECT                          ON public.compras_status_column_map   TO authenticated, anon;
GRANT USAGE, SELECT                   ON ALL SEQUENCES IN SCHEMA public     TO authenticated;

COMMIT;
