-- ═══════════════════════════════════════════════════════════════════
-- 025 — Fretes (expedicao_fretes) sobem no painel /obras
-- Will 24/08/2026 (fase C do #1889)
--
-- Fluxo: cada frete cria 3 lançamentos separados no Core (adiantamento 1,
-- adiantamento 2, saldo) — cada um com obra_id resolvido pelo cliente_nome.
-- Status previsto vira pago quando o flag correspondente marca true no
-- expedicao_fretes. Assim, comprometido sobe assim que o frete é lançado
-- e realizado sobe quando cada parcela é baixada.
--
-- Match por nome tem cobertura ~15% hoje (obras homônimas ou fora do Core
-- ficam sem obra — igual às NFs). UI da expedição pode setar obra_id manual
-- num passo futuro.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.expedicao_fretes
  ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES core.obras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lancamento_ad1_id uuid REFERENCES core.lancamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lancamento_ad2_id uuid REFERENCES core.lancamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lancamento_saldo_id uuid REFERENCES core.lancamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expfretes_obra ON public.expedicao_fretes (obra_id) WHERE obra_id IS NOT NULL;


-- Helper: gera 1 parcela do frete no core.lancamentos (idempotente).
-- Retorna o id do lançamento (criado ou já existente).
CREATE OR REPLACE FUNCTION public.expedicao_frete_upsert_parcela(
  p_frete_id      uuid,
  p_lanc_id       uuid,
  p_parcela_label text,           -- "adiantamento 1", "adiantamento 2", "saldo"
  p_valor         numeric,
  p_pago          boolean,
  p_obra_id       uuid,
  p_numero        text,
  p_cliente_nome  text,
  p_data_saida    date
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, core, pg_catalog AS $$
DECLARE
  v_empresa uuid;
  v_pc      uuid;
  v_id      uuid := p_lanc_id;
  v_status  text := CASE WHEN p_pago THEN 'pago' ELSE 'previsto' END;
  v_venc    date := COALESCE(p_data_saida, CURRENT_DATE);
BEGIN
  IF COALESCE(p_valor, 0) <= 0 THEN
    -- parcela zerada: se existia lançamento, cancela (permite re-gerar depois)
    IF v_id IS NOT NULL THEN
      UPDATE core.lancamentos SET status='cancelado',
        observacoes = COALESCE(observacoes,'') || chr(10) || 'Cancelado: parcela zerada no frete ' || p_numero
       WHERE id = v_id AND status <> 'cancelado';
    END IF;
    RETURN NULL;
  END IF;

  SELECT id INTO v_empresa FROM core.empresas WHERE ativo ORDER BY created_at LIMIT 1;
  SELECT id INTO v_pc FROM core.plano_contas WHERE codigo='6203' LIMIT 1;
  IF v_pc IS NULL THEN
    SELECT id INTO v_pc FROM core.plano_contas WHERE tipo='despesa' ORDER BY codigo LIMIT 1;
  END IF;
  IF v_empresa IS NULL OR v_pc IS NULL THEN RETURN NULL; END IF;

  IF v_id IS NULL THEN
    INSERT INTO core.lancamentos
      (empresa_id, plano_conta_id, obra_id, tipo, status, descricao, numero_documento,
       data_emissao, data_competencia, data_vencimento, valor, data_pagamento, observacoes)
    VALUES
      (v_empresa, v_pc, p_obra_id, 'saida', v_status,
       'Frete ' || p_numero || ' — ' || p_parcela_label
         || COALESCE(' - ' || NULLIF(p_cliente_nome,''), ''),
       'FR-' || p_numero || '/' || p_parcela_label,
       CURRENT_DATE, v_venc, v_venc, p_valor,
       CASE WHEN p_pago THEN v_venc END,
       'Origem: expedicao_fretes ' || p_frete_id::text)
    RETURNING id INTO v_id;
  ELSE
    -- atualiza valor/status/obra do lançamento existente
    UPDATE core.lancamentos
       SET valor = p_valor,
           obra_id = p_obra_id,
           status = CASE
                      WHEN status='cancelado' THEN status  -- nao ressuscita
                      ELSE v_status
                    END,
           data_pagamento = CASE WHEN p_pago THEN COALESCE(data_pagamento, v_venc) END
     WHERE id = v_id;
  END IF;

  RETURN v_id;
END $$;


-- Trigger: mantém expedicao_fretes ↔ core.lancamentos sincronizados
CREATE OR REPLACE FUNCTION public.expedicao_frete_sync_core()
RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, core, pg_catalog AS $$
DECLARE
  v_obra uuid;
  v_data date;
BEGIN
  -- Resolve obra_id (uma vez; respeita override manual se já setado)
  v_obra := COALESCE(NEW.obra_id, core.resolver_obra_por_projeto_texto(NEW.cliente_nome));
  NEW.obra_id := v_obra;

  -- data_saida vem como text no schema — parse best-effort
  BEGIN v_data := NEW.data_saida::date; EXCEPTION WHEN OTHERS THEN v_data := CURRENT_DATE; END;

  -- Fretes cancelados não geram lançamento; se existia, cancela
  IF NEW.status = 'cancelado' THEN
    IF NEW.lancamento_ad1_id IS NOT NULL THEN
      UPDATE core.lancamentos SET status='cancelado' WHERE id=NEW.lancamento_ad1_id AND status<>'cancelado';
    END IF;
    IF NEW.lancamento_ad2_id IS NOT NULL THEN
      UPDATE core.lancamentos SET status='cancelado' WHERE id=NEW.lancamento_ad2_id AND status<>'cancelado';
    END IF;
    IF NEW.lancamento_saldo_id IS NOT NULL THEN
      UPDATE core.lancamentos SET status='cancelado' WHERE id=NEW.lancamento_saldo_id AND status<>'cancelado';
    END IF;
    RETURN NEW;
  END IF;

  NEW.lancamento_ad1_id := public.expedicao_frete_upsert_parcela(
    NEW.id, NEW.lancamento_ad1_id, 'adiantamento 1',
    NEW.valor_adiantamento1, COALESCE(NEW.adiantamento1_pago, false),
    v_obra, NEW.numero, NEW.cliente_nome, v_data);
  NEW.lancamento_ad2_id := public.expedicao_frete_upsert_parcela(
    NEW.id, NEW.lancamento_ad2_id, 'adiantamento 2',
    NEW.valor_adiantamento2, COALESCE(NEW.adiantamento2_pago, false),
    v_obra, NEW.numero, NEW.cliente_nome, v_data);
  NEW.lancamento_saldo_id := public.expedicao_frete_upsert_parcela(
    NEW.id, NEW.lancamento_saldo_id, 'saldo',
    NEW.valor_saldo, COALESCE(NEW.saldo_pago, false),
    v_obra, NEW.numero, NEW.cliente_nome, v_data);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_expedicao_frete_sync_core ON public.expedicao_fretes;
CREATE TRIGGER trg_expedicao_frete_sync_core
  BEFORE INSERT OR UPDATE ON public.expedicao_fretes
  FOR EACH ROW EXECUTE FUNCTION public.expedicao_frete_sync_core();


-- Delete físico do frete cancela os lançamentos
CREATE OR REPLACE FUNCTION public.expedicao_frete_cancelar_lancamentos()
RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, core, pg_catalog AS $$
BEGIN
  IF OLD.lancamento_ad1_id IS NOT NULL THEN
    UPDATE core.lancamentos SET status='cancelado' WHERE id=OLD.lancamento_ad1_id AND status='previsto';
  END IF;
  IF OLD.lancamento_ad2_id IS NOT NULL THEN
    UPDATE core.lancamentos SET status='cancelado' WHERE id=OLD.lancamento_ad2_id AND status='previsto';
  END IF;
  IF OLD.lancamento_saldo_id IS NOT NULL THEN
    UPDATE core.lancamentos SET status='cancelado' WHERE id=OLD.lancamento_saldo_id AND status='previsto';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_expedicao_frete_cancelar_lancamentos ON public.expedicao_fretes;
CREATE TRIGGER trg_expedicao_frete_cancelar_lancamentos
  AFTER DELETE ON public.expedicao_fretes
  FOR EACH ROW EXECUTE FUNCTION public.expedicao_frete_cancelar_lancamentos();


-- Backfill: dispara o trigger para todos os fretes existentes (UPDATE trivial).
UPDATE public.expedicao_fretes SET numero = numero
  WHERE lancamento_ad1_id IS NULL
     OR lancamento_ad2_id IS NULL
     OR lancamento_saldo_id IS NULL
     OR obra_id IS NULL;
