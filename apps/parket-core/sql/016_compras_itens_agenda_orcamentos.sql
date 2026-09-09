-- 016_compras_itens_agenda_orcamentos
-- Agendamento por item + orçamentos (PDFs) por item.
-- ===========================================================================
-- Cada compras_item ganha:
--   • comprar_em DATE — quando o item deve virar cotação/aprovação. NULL = agora.
--   • orcamentos jsonb — lista de {fornecedor_id, arquivo_url, valor, obs, ts, escolhido}
--                       (o item pode ter N concorrentes, 1 marcado como escolhido).
-- O trigger de gargalo passa a ignorar itens "agendados" (comprar_em > hoje E status=cotacao)
-- na hora de escolher a coluna — assim o card avança pelos ativos, sem travar.
-- Idempotente. Rollback em 016_compras_itens_agenda_orcamentos.rollback.sql.

BEGIN;

-- Colunas novas
ALTER TABLE public.compras_itens
  ADD COLUMN IF NOT EXISTS comprar_em DATE,
  ADD COLUMN IF NOT EXISTS orcamentos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Guarda de schema: orcamentos precisa ser array
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'compras_itens_orcamentos_array_chk'
  ) THEN
    ALTER TABLE public.compras_itens
      ADD CONSTRAINT compras_itens_orcamentos_array_chk
      CHECK (jsonb_typeof(orcamentos) = 'array');
  END IF;
END $$;

-- Índice pra query "quais agendados venceram hoje"
CREATE INDEX IF NOT EXISTS compras_itens_comprar_em_pending_idx
  ON public.compras_itens (comprar_em)
  WHERE status = 'cotacao' AND comprar_em IS NOT NULL;

-- =========================================================================
-- Recalcular gargalo ignorando itens agendados (comprar_em > hoje E cotacao).
-- Se todos os itens forem agendados, mantém a coluna atual (ninguém pra empurrar).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.compras_recalc_card_column()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_card_id     uuid := COALESCE(NEW.card_id, OLD.card_id);
  v_target_col  text;
  v_total       int;
  v_completos   int;
  v_reprovados  int;
  v_agendados   int;
  v_min_ordem   int;
  v_max_ordem   int;
  v_misto       boolean := false;
BEGIN
  IF v_card_id IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ci.status = 'pago'),
    COUNT(*) FILTER (WHERE ci.status = 'reprovado'),
    COUNT(*) FILTER (WHERE ci.status = 'cotacao' AND ci.comprar_em IS NOT NULL AND ci.comprar_em > CURRENT_DATE),
    -- gargalo IGNORA agendados (cotacao + comprar_em futuro)
    MIN(csm.ordem) FILTER (
      WHERE ci.status <> 'reprovado'
        AND NOT (ci.status = 'cotacao' AND ci.comprar_em IS NOT NULL AND ci.comprar_em > CURRENT_DATE)
    ),
    MAX(csm.ordem) FILTER (
      WHERE ci.status <> 'reprovado'
        AND NOT (ci.status = 'cotacao' AND ci.comprar_em IS NOT NULL AND ci.comprar_em > CURRENT_DATE)
    )
  INTO v_total, v_completos, v_reprovados, v_agendados, v_min_ordem, v_max_ordem
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
             'agendados', COALESCE(v_agendados, 0),
             'andamento_misto', v_misto
           )
         ),
         updated_at = now()
   WHERE id = v_card_id;

  RETURN NEW;
END $$;

-- =========================================================================
-- RPC: destrava agendados vencidos (chamada por cron 1x/dia).
-- Itens com comprar_em <= hoje E ainda em cotacao viram cotacao "ativa" pelo
-- mero fato de comprar_em passar — o UPDATE dispara o trigger de gargalo.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.compras_itens_destravar_agendados()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_n int;
BEGIN
  UPDATE public.compras_itens
     SET updated_at = now()  -- no-op mas força re-trigger do gargalo do card
   WHERE status = 'cotacao'
     AND comprar_em IS NOT NULL
     AND comprar_em <= CURRENT_DATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

GRANT EXECUTE ON FUNCTION public.compras_itens_destravar_agendados() TO authenticated, anon;

-- =========================================================================
-- Bucket Storage 'compras-orcamentos' (idempotente).
-- Public read pra que o Financeiro no Core visualize o PDF sem token.
-- =========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('compras-orcamentos', 'compras-orcamentos', true, 20971520, ARRAY['application/pdf','image/png','image/jpeg']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies: leitura pública, upload/delete só autenticado
DO $$
BEGIN
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "orc_public_read" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "orc_auth_write" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "orc_auth_delete" ON storage.objects';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  EXECUTE $p$CREATE POLICY "orc_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'compras-orcamentos')$p$;
  EXECUTE $p$CREATE POLICY "orc_auth_write" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'compras-orcamentos')$p$;
  EXECUTE $p$CREATE POLICY "orc_auth_delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'compras-orcamentos')$p$;
END $$;

COMMIT;
