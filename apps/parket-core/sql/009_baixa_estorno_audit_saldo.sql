-- Sprint 1 do Core operacional (task #1664):
--   1) Motor de baixa/estorno como funções SQL atômicas
--   2) Audit log de tudo que escreve
--   3) View de saldo bancário ao vivo
--   4) Perfil 'finance' pode lançar+baixar (não pode estornar/deletar)
--
-- Estratégia: SECURITY DEFINER nas funções + checagem manual de permissão
-- via core.can_write()/can_reverse(). Isso preserva RLS "admin only" para
-- INSERT/UPDATE crus e obriga o time (perfil finance) a passar pela função,
-- que garante consistência (movimenta conta + grava audit num só passo).

-- ─── Permissões ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION core.current_user_email() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    (SELECT email FROM core.app_users WHERE user_id = auth.uid() LIMIT 1),
    'system'
  );
$$;

-- OBS: SEM `STABLE` — PostgreSQL inlina funções SQL STABLE dentro de queries
-- e o SECURITY DEFINER perde efeito, fazendo current_user vazar do caller.
CREATE OR REPLACE FUNCTION core.can_write() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT current_user IN ('service_role','postgres','supabase_admin')
    OR core.is_admin()
    OR EXISTS (
      SELECT 1 FROM core.app_users a
      WHERE a.user_id = auth.uid() AND a.ativo = true
        AND a.role IN ('admin','finance')
    );
$$;

CREATE OR REPLACE FUNCTION core.can_reverse() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT current_user IN ('service_role','postgres','supabase_admin') OR core.is_admin();
$$;

-- ─── Audit log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS core.audit_log (
  id          bigserial PRIMARY KEY,
  tabela      text NOT NULL,
  acao        text NOT NULL CHECK (acao IN ('INSERT','UPDATE','DELETE','BAIXA','ESTORNO')),
  row_id      uuid,
  user_email  text NOT NULL DEFAULT 'system',
  antes       jsonb,
  depois      jsonb,
  motivo      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_tabela_row_idx ON core.audit_log(tabela, row_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_created_idx  ON core.audit_log(created_at DESC);

ALTER TABLE core.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read" ON core.audit_log;
CREATE POLICY "auth read" ON core.audit_log FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT ON core.audit_log TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE core.audit_log_id_seq TO authenticated, service_role;

-- Trigger genérica: registra INSERT/UPDATE/DELETE em qualquer tabela do core.
CREATE OR REPLACE FUNCTION core.log_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id     uuid;
  v_antes  jsonb;
  v_depois jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := (row_to_json(OLD)::jsonb ->> 'id')::uuid;
    v_antes := row_to_json(OLD)::jsonb;
  ELSIF TG_OP = 'INSERT' THEN
    v_id := (row_to_json(NEW)::jsonb ->> 'id')::uuid;
    v_depois := row_to_json(NEW)::jsonb;
  ELSE  -- UPDATE
    v_id := (row_to_json(NEW)::jsonb ->> 'id')::uuid;
    v_antes := row_to_json(OLD)::jsonb;
    v_depois := row_to_json(NEW)::jsonb;
    IF v_antes = v_depois THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, antes, depois)
  VALUES (TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, TG_OP, v_id,
          core.current_user_email(), v_antes, v_depois);

  RETURN COALESCE(NEW, OLD);
END; $$;

-- Vincular a tudo que impacta finanças. Idempotente via DROP IF EXISTS.
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lancamentos','comissoes','rt_liberacoes','rts','impostos',
    'obras','parceiros','contas_bancarias','centros_custo','plano_contas',
    'empresas','viagens','fretes_solicitacoes','comissao_faixas'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON core.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON core.%I FOR EACH ROW EXECUTE FUNCTION core.log_change()', t);
  END LOOP;
END; $$;

-- ─── Saldo bancário ao vivo ─────────────────────────────────────────

CREATE OR REPLACE VIEW core.contas_bancarias_saldo AS
SELECT
  cb.id,
  cb.empresa_id,
  cb.banco,
  cb.agencia,
  cb.conta,
  cb.tipo,
  cb.ativo,
  cb.saldo_inicial,
  cb.saldo_inicial_data,
  COALESCE(SUM(CASE
    WHEN l.status IN ('pago','recebido','conciliado')
      THEN (CASE WHEN l.tipo = 'entrada' THEN 1 ELSE -1 END) * COALESCE(l.valor_pago, l.valor)
    ELSE 0
  END), 0) AS movimento,
  cb.saldo_inicial + COALESCE(SUM(CASE
    WHEN l.status IN ('pago','recebido','conciliado')
      THEN (CASE WHEN l.tipo = 'entrada' THEN 1 ELSE -1 END) * COALESCE(l.valor_pago, l.valor)
    ELSE 0
  END), 0) AS saldo_atual,
  MAX(l.data_pagamento) AS ultima_movimentacao
FROM core.contas_bancarias cb
LEFT JOIN core.lancamentos l ON l.conta_bancaria_id = cb.id
GROUP BY cb.id;

GRANT SELECT ON core.contas_bancarias_saldo TO authenticated, anon, service_role;

-- ─── Baixa (marcar pago/recebido/conciliado) ────────────────────────

CREATE OR REPLACE FUNCTION core.baixar_lancamento(
  p_lanc_id           uuid,
  p_conta_bancaria_id uuid,
  p_valor_pago        numeric,
  p_data_pagamento    date,
  p_forma_pagamento   text DEFAULT NULL,
  p_marcar_conciliado boolean DEFAULT false,
  p_observacoes       text DEFAULT NULL
) RETURNS core.lancamentos
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_l      core.lancamentos%ROWTYPE;
  v_novo   text;
  v_email  text;
BEGIN
  IF NOT core.can_write() THEN RAISE EXCEPTION 'permissao_negada: baixar'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_l FROM core.lancamentos WHERE id = p_lanc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lancamento_nao_encontrado: %', p_lanc_id; END IF;
  IF v_l.status IN ('pago','recebido','conciliado','cancelado') THEN
    RAISE EXCEPTION 'lancamento_ja_baixado_ou_cancelado: status=%', v_l.status;
  END IF;

  IF p_conta_bancaria_id IS NULL THEN RAISE EXCEPTION 'conta_bancaria_obrigatoria'; END IF;
  IF NOT EXISTS (SELECT 1 FROM core.contas_bancarias WHERE id = p_conta_bancaria_id AND ativo) THEN
    RAISE EXCEPTION 'conta_bancaria_inativa_ou_inexistente';
  END IF;
  IF COALESCE(p_valor_pago, 0) <= 0 THEN RAISE EXCEPTION 'valor_pago_invalido'; END IF;
  IF p_data_pagamento IS NULL THEN RAISE EXCEPTION 'data_pagamento_obrigatoria'; END IF;

  IF p_marcar_conciliado THEN
    v_novo := 'conciliado';
  ELSE
    v_novo := CASE WHEN v_l.tipo = 'entrada' THEN 'recebido' ELSE 'pago' END;
  END IF;

  UPDATE core.lancamentos SET
    status            = v_novo,
    conta_bancaria_id = p_conta_bancaria_id,
    data_pagamento    = p_data_pagamento,
    valor_pago        = p_valor_pago,
    forma_pagamento   = COALESCE(p_forma_pagamento, forma_pagamento),
    observacoes       = CASE
      WHEN p_observacoes IS NULL OR p_observacoes = '' THEN observacoes
      ELSE COALESCE(observacoes || E'\n', '') || '[baixa ' || p_data_pagamento || ' por ' || v_email || '] ' || p_observacoes
    END
  WHERE id = p_lanc_id
  RETURNING * INTO v_l;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, depois, motivo)
  VALUES ('core.lancamentos', 'BAIXA', p_lanc_id, v_email,
          jsonb_build_object('status', v_novo, 'conta_bancaria_id', p_conta_bancaria_id,
                             'valor_pago', p_valor_pago, 'data_pagamento', p_data_pagamento),
          COALESCE(p_observacoes, ''));

  RETURN v_l;
END; $$;

GRANT EXECUTE ON FUNCTION core.baixar_lancamento(uuid,uuid,numeric,date,text,boolean,text)
  TO authenticated, service_role;

-- ─── Estorno (volta pra previsto) ───────────────────────────────────

CREATE OR REPLACE FUNCTION core.estornar_lancamento(
  p_lanc_id uuid,
  p_motivo  text
) RETURNS core.lancamentos
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_l     core.lancamentos%ROWTYPE;
  v_email text;
BEGIN
  IF NOT core.can_reverse() THEN RAISE EXCEPTION 'permissao_negada: estornar (apenas admin)'; END IF;
  IF COALESCE(trim(p_motivo), '') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  v_email := core.current_user_email();

  SELECT * INTO v_l FROM core.lancamentos WHERE id = p_lanc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lancamento_nao_encontrado: %', p_lanc_id; END IF;
  IF v_l.status NOT IN ('pago','recebido','conciliado') THEN
    RAISE EXCEPTION 'lancamento_nao_esta_baixado: status=%', v_l.status;
  END IF;

  UPDATE core.lancamentos SET
    status         = 'previsto',
    data_pagamento = NULL,
    valor_pago     = NULL,
    observacoes    = COALESCE(observacoes || E'\n', '') ||
                     '[estorno ' || CURRENT_DATE || ' por ' || v_email || '] ' || p_motivo
  WHERE id = p_lanc_id
  RETURNING * INTO v_l;

  INSERT INTO core.audit_log (tabela, acao, row_id, user_email, antes, motivo)
  VALUES ('core.lancamentos', 'ESTORNO', p_lanc_id, v_email,
          jsonb_build_object('status', 'baixado', 'valor_pago', v_l.valor_pago,
                             'data_pagamento', v_l.data_pagamento,
                             'conta_bancaria_id', v_l.conta_bancaria_id),
          p_motivo);

  RETURN v_l;
END; $$;

GRANT EXECUTE ON FUNCTION core.estornar_lancamento(uuid,text) TO authenticated, service_role;

-- ─── Ajuste RLS: perfil 'finance' pode INSERT/UPDATE lancamentos ────
-- (mas não DELETE — pra deletar de verdade só admin, e ideal é estornar+cancelar)

DROP POLICY IF EXISTS "admin write" ON core.lancamentos;
DROP POLICY IF EXISTS "finance write" ON core.lancamentos;
DROP POLICY IF EXISTS "admin delete" ON core.lancamentos;
CREATE POLICY "finance write" ON core.lancamentos FOR INSERT TO authenticated
  WITH CHECK (core.can_write());
CREATE POLICY "finance update" ON core.lancamentos FOR UPDATE TO authenticated
  USING (core.can_write()) WITH CHECK (core.can_write());
CREATE POLICY "admin delete"  ON core.lancamentos FOR DELETE TO authenticated
  USING (core.is_admin());

-- Idem para tabelas satélites que 'finance' precisa mexer no dia a dia.
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['comissoes','impostos','viagens','fretes_solicitacoes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin write" ON core.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "finance write" ON core.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "finance update" ON core.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin delete" ON core.%I', t);
    EXECUTE format('CREATE POLICY "finance write" ON core.%I FOR INSERT TO authenticated WITH CHECK (core.can_write())', t);
    EXECUTE format('CREATE POLICY "finance update" ON core.%I FOR UPDATE TO authenticated USING (core.can_write()) WITH CHECK (core.can_write())', t);
    EXECUTE format('CREATE POLICY "admin delete"  ON core.%I FOR DELETE TO authenticated USING (core.is_admin())', t);
  END LOOP;
END; $$;

-- ─── Reload PostgREST cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
