-- ============================================================
-- Admissão Digital — formulário público preenchido pelo
-- futuro funcionário (sem login) via link com token único.
-- Inspirado no fluxo do Convenia.
-- ============================================================

-- Coluna pra guardar o form em preenchimento (jsonb estruturado)
ALTER TABLE rh.admissoes
  ADD COLUMN IF NOT EXISTS form_data jsonb DEFAULT '{}'::jsonb;

-- ── RPC: ler dados básicos pelo token (público) ─────────────
-- Retorna info pra renderizar header (empresa, cargo) + form_data
-- atual. Falha (e revela 404) se token inválido/expirado.
CREATE OR REPLACE FUNCTION rh.admissao_public_get(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row rh.admissoes;
  v_emp core.empresas;
  v_cargo rh.cargos;
  v_dept rh.departamentos;
BEGIN
  SELECT * INTO v_row FROM rh.admissoes WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token inválido' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.token_expira_em IS NOT NULL AND v_row.token_expira_em < now() THEN
    RAISE EXCEPTION 'Token expirado em %', v_row.token_expira_em USING ERRCODE = 'P0003';
  END IF;
  IF v_row.etapa IN ('aprovado_ativo','rejeitado','cancelado','expirado') THEN
    RAISE EXCEPTION 'Admissão já finalizada (etapa: %)', v_row.etapa USING ERRCODE = 'P0004';
  END IF;

  SELECT * INTO v_emp FROM core.empresas WHERE id = v_row.empresa_id;
  SELECT * INTO v_cargo FROM rh.cargos WHERE id = v_row.cargo_id;
  SELECT * INTO v_dept FROM rh.departamentos WHERE id = v_row.departamento_id;

  RETURN jsonb_build_object(
    'admissao_id', v_row.id,
    'nome', v_row.nome,
    'email', v_row.email,
    'telefone', v_row.telefone,
    'data_admissao_prevista', v_row.data_admissao_prevista,
    'salario_proposto', v_row.salario_proposto,
    'etapa', v_row.etapa,
    'preenchido_em', v_row.preenchido_em,
    'token_expira_em', v_row.token_expira_em,
    'empresa', jsonb_build_object(
      'id', v_emp.id,
      'razao_social', v_emp.razao_social,
      'nome_fantasia', v_emp.nome_fantasia,
      'cnpj', v_emp.cnpj
    ),
    'cargo', CASE WHEN v_cargo.id IS NOT NULL THEN
      jsonb_build_object('id', v_cargo.id, 'nome', v_cargo.nome) ELSE NULL END,
    'departamento', CASE WHEN v_dept.id IS NOT NULL THEN
      jsonb_build_object('id', v_dept.id, 'nome', v_dept.nome) ELSE NULL END,
    'form_data', COALESCE(v_row.form_data, '{}'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION rh.admissao_public_get(text) TO anon, authenticated;


-- ── RPC: salvar form parcial (auto-save) ────────────────────
CREATE OR REPLACE FUNCTION rh.admissao_public_save(p_token text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_etapa text;
BEGIN
  SELECT id, etapa INTO v_id, v_etapa FROM rh.admissoes WHERE token = p_token
    AND (token_expira_em IS NULL OR token_expira_em >= now());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token inválido ou expirado' USING ERRCODE = 'P0002';
  END IF;
  IF v_etapa IN ('aprovado_ativo','rejeitado','cancelado','expirado') THEN
    RAISE EXCEPTION 'Admissão já finalizada' USING ERRCODE = 'P0004';
  END IF;
  UPDATE rh.admissoes SET
    form_data = COALESCE(form_data, '{}'::jsonb) || p_data,
    etapa = CASE WHEN etapa = 'convite_enviado' THEN 'formulario_em_preenchimento' ELSE etapa END,
    updated_at = now()
  WHERE id = v_id;
END $$;

GRANT EXECUTE ON FUNCTION rh.admissao_public_save(text, jsonb) TO anon, authenticated;


-- ── RPC: submeter form (final) ──────────────────────────────
CREATE OR REPLACE FUNCTION rh.admissao_public_submit(p_token text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_etapa text;
BEGIN
  SELECT id, etapa INTO v_id, v_etapa FROM rh.admissoes WHERE token = p_token
    AND (token_expira_em IS NULL OR token_expira_em >= now());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token inválido ou expirado' USING ERRCODE = 'P0002';
  END IF;
  IF v_etapa IN ('aprovado_ativo','rejeitado','cancelado','expirado','formulario_completo') THEN
    RAISE EXCEPTION 'Admissão já submetida ou finalizada' USING ERRCODE = 'P0004';
  END IF;
  UPDATE rh.admissoes SET
    form_data = COALESCE(form_data, '{}'::jsonb) || p_data,
    etapa = 'formulario_completo',
    preenchido_em = now(),
    updated_at = now()
  WHERE id = v_id
  RETURNING jsonb_build_object('id', id, 'etapa', etapa, 'preenchido_em', preenchido_em) INTO p_data;
  RETURN p_data;
END $$;

GRANT EXECUTE ON FUNCTION rh.admissao_public_submit(text, jsonb) TO anon, authenticated;


-- ── Storage: bucket rh-admissao-docs ────────────────────────
-- Bucket privado; políticas permitem upload por anon QUANDO o path
-- começa com 'admissao/<token_valido>/'. Token é validado via JOIN.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('rh-admissao-docs', 'rh-admissao-docs', false)
  ON CONFLICT (id) DO NOTHING;

-- Limpa policies antigas (se reaplicado)
DROP POLICY IF EXISTS "admissao_anon_upload" ON storage.objects;
DROP POLICY IF EXISTS "admissao_anon_read" ON storage.objects;

-- INSERT (upload): se path = admissao/<token>/... e token existe, ativo, não expirado
CREATE POLICY "admissao_anon_upload" ON storage.objects
FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'rh-admissao-docs'
  AND name LIKE 'admissao/%/%'
  AND EXISTS (
    SELECT 1 FROM rh.admissoes a
    WHERE a.token = split_part(name, '/', 2)
      AND (a.token_expira_em IS NULL OR a.token_expira_em >= now())
      AND a.etapa NOT IN ('aprovado_ativo','rejeitado','cancelado','expirado')
  )
);

-- SELECT (read próprios docs): mesma regra
CREATE POLICY "admissao_anon_read" ON storage.objects
FOR SELECT TO anon
USING (
  bucket_id = 'rh-admissao-docs'
  AND name LIKE 'admissao/%/%'
  AND EXISTS (
    SELECT 1 FROM rh.admissoes a
    WHERE a.token = split_part(name, '/', 2)
      AND (a.token_expira_em IS NULL OR a.token_expira_em >= now())
  )
);

-- ── RPC: registra metadado de documento uploaded ────────────
CREATE OR REPLACE FUNCTION rh.admissao_public_add_doc(
  p_token text, p_tipo text, p_storage_path text,
  p_mime_type text DEFAULT NULL, p_size_bytes bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_doc_id uuid;
BEGIN
  SELECT id INTO v_id FROM rh.admissoes WHERE token = p_token
    AND (token_expira_em IS NULL OR token_expira_em >= now())
    AND etapa NOT IN ('aprovado_ativo','rejeitado','cancelado','expirado');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token inválido ou expirado' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO rh.admissao_documentos (admissao_id, tipo, storage_path, mime_type, size_bytes)
    VALUES (v_id, p_tipo, p_storage_path, p_mime_type, p_size_bytes)
    RETURNING id INTO v_doc_id;
  RETURN v_doc_id;
END $$;

GRANT EXECUTE ON FUNCTION rh.admissao_public_add_doc(text, text, text, text, bigint) TO anon, authenticated;


-- Notifica PostgREST pra recarregar schema
NOTIFY pgrst, 'reload schema';
