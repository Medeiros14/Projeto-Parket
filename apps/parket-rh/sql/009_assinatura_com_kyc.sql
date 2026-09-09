-- ============================================================
-- 009 — Assinatura interna com KYC (selfie + foto RG/CNH)
--
-- Fluxo próprio de assinatura (sem Clicksign) que exige:
--   • Assinatura no canvas (já existente)
--   • Selfie do rosto (novo)
--   • Foto do documento oficial com foto — RG/CNH (novo)
--
-- Design:
--   • Novo flag rh.documentos_emitidos.requer_kyc — quando true, o
--     AssinarDocumento.tsx obriga captura de selfie+doc antes de assinar.
--   • Selfie e foto do doc sobem via anon direto pro bucket
--     rh-documentos em kyc/{token}/selfie.jpg e kyc/{token}/doc.jpg
--   • Depois, documento_public_sign grava referências (paths) dentro
--     do JSONB assinatura junto com o PNG do canvas + IP + user-agent.
--   • Backend parket-rh-api gera o PDF final juntando o contrato +
--     página de manifesto (assinatura + thumbs selfie/doc + hash + IP + real timestamp).
-- ============================================================

ALTER TABLE rh.documentos_emitidos
  ADD COLUMN IF NOT EXISTS requer_kyc boolean NOT NULL DEFAULT false;

-- documento_public_get devolve requer_kyc pro frontend decidir o wizard
CREATE OR REPLACE FUNCTION rh.documento_public_get(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_doc rh.documentos_emitidos;
  v_colab rh.colaboradores;
  v_emp core.empresas;
  v_mural rh.murais;
  v_colab_nome text;
  v_colab_cpf text;
  v_emp_obj jsonb;
BEGIN
  SELECT * INTO v_doc FROM rh.documentos_emitidos WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Token inválido' USING ERRCODE='P0002'; END IF;
  IF v_doc.token_expira_em IS NOT NULL AND v_doc.token_expira_em < now() THEN
    RAISE EXCEPTION 'Token expirado' USING ERRCODE='P0003';
  END IF;
  IF v_doc.status IN ('cancelado','recusado') THEN
    RAISE EXCEPTION 'Documento não está mais disponível (status: %)', v_doc.status USING ERRCODE='P0004';
  END IF;

  IF v_doc.colaborador_id IS NOT NULL THEN
    SELECT * INTO v_colab FROM rh.colaboradores WHERE id = v_doc.colaborador_id;
    v_colab_nome := v_colab.nome;
    v_colab_cpf := v_colab.cpf;
  ELSE
    v_colab_nome := COALESCE(v_doc.nome_informado, '');
    v_colab_cpf := COALESCE(v_doc.cpf_informado, '');
  END IF;

  IF v_doc.empresa_id IS NOT NULL THEN
    SELECT * INTO v_emp FROM core.empresas WHERE id = v_doc.empresa_id;
    v_emp_obj := jsonb_build_object('razao_social', v_emp.razao_social, 'nome_fantasia', v_emp.nome_fantasia, 'cnpj', v_emp.cnpj);
  ELSE
    v_emp_obj := jsonb_build_object('razao_social', '', 'nome_fantasia', '', 'cnpj', '');
  END IF;

  IF v_doc.mural_id IS NOT NULL THEN
    SELECT * INTO v_mural FROM rh.murais WHERE id = v_doc.mural_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_doc.id,
    'titulo', v_doc.titulo,
    'conteudo_html', v_doc.conteudo_html,
    'status', v_doc.status,
    'assinado_em', v_doc.assinado_em,
    'assinatura', v_doc.assinatura,
    'requer_kyc', v_doc.requer_kyc,
    'colaborador', jsonb_build_object('nome', v_colab_nome, 'cpf', v_colab_cpf),
    'empresa', v_emp_obj,
    'mural_id', v_doc.mural_id,
    'mural_slug', v_mural.slug,
    'mural_titulo', v_mural.titulo
  );
END $$;
GRANT EXECUTE ON FUNCTION rh.documento_public_get(text) TO anon, authenticated;


-- documento_public_sign continua com a mesma assinatura mas passa a exigir
-- selfie_path + doc_path no JSONB quando o doc tem requer_kyc=true.
CREATE OR REPLACE FUNCTION rh.documento_public_sign(p_token text, p_assinatura jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_requer_kyc boolean;
  v_now timestamptz := now();
BEGIN
  SELECT id, status, requer_kyc INTO v_id, v_status, v_requer_kyc
    FROM rh.documentos_emitidos
    WHERE token = p_token
      AND (token_expira_em IS NULL OR token_expira_em >= v_now);
  IF NOT FOUND THEN RAISE EXCEPTION 'Token inválido ou expirado' USING ERRCODE='P0002'; END IF;
  IF v_status NOT IN ('aguardando_assinatura','rascunho','visualizado') THEN
    RAISE EXCEPTION 'Documento não disponível pra assinatura (%)', v_status USING ERRCODE='P0004';
  END IF;
  IF p_assinatura->>'png' IS NULL THEN
    RAISE EXCEPTION 'Assinatura obrigatória' USING ERRCODE='P0005';
  END IF;
  IF v_requer_kyc THEN
    IF p_assinatura->>'selfie_path' IS NULL OR p_assinatura->>'doc_path' IS NULL THEN
      RAISE EXCEPTION 'Selfie e foto do documento são obrigatórias' USING ERRCODE='P0005';
    END IF;
  END IF;
  UPDATE rh.documentos_emitidos SET
    assinatura = p_assinatura,
    status = 'assinado',
    assinado_em = v_now,
    updated_at = v_now
  WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'status', 'assinado', 'assinado_em', v_now);
END $$;
GRANT EXECUTE ON FUNCTION rh.documento_public_sign(text, jsonb) TO anon, authenticated;


-- Storage: permitir INSERT anônimo em kyc/{token}/(selfie|doc).jpg
-- quando o token bate com um documento com requer_kyc=true e não assinado.
DROP POLICY IF EXISTS "kyc_anon_write_by_token" ON storage.objects;
CREATE POLICY "kyc_anon_write_by_token" ON storage.objects
FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'rh-documentos'
  AND (name LIKE 'kyc/%/selfie.jpg' OR name LIKE 'kyc/%/doc.jpg')
  AND EXISTS (
    SELECT 1 FROM rh.documentos_emitidos d
    WHERE d.token = split_part(name, '/', 2)
      AND d.requer_kyc = true
      AND (d.token_expira_em IS NULL OR d.token_expira_em >= now())
      AND d.status IN ('rascunho','aguardando_assinatura','visualizado')
  )
);

-- E SELECT anônimo do próprio path enquanto tiver token válido (o backend
-- assina URLs autenticadas pra gerar o PDF final; anon precisa só pra preview)
DROP POLICY IF EXISTS "kyc_anon_read_by_token" ON storage.objects;
CREATE POLICY "kyc_anon_read_by_token" ON storage.objects
FOR SELECT TO anon
USING (
  bucket_id = 'rh-documentos'
  AND (name LIKE 'kyc/%/selfie.jpg' OR name LIKE 'kyc/%/doc.jpg')
  AND EXISTS (
    SELECT 1 FROM rh.documentos_emitidos d
    WHERE d.token = split_part(name, '/', 2)
      AND (d.token_expira_em IS NULL OR d.token_expira_em >= now())
  )
);

NOTIFY pgrst, 'reload schema';
