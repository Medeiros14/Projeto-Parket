-- 010 — documento_public_sign aceita nome_informado + cpf_informado no payload
-- (assinatura pela parte externa: signatário digita o próprio nome/CPF)
CREATE OR REPLACE FUNCTION rh.documento_public_sign(p_token text, p_assinatura jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_requer_kyc boolean;
  v_now timestamptz := now();
  v_nome text;
  v_cpf text;
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
    IF coalesce(p_assinatura->>'nome_informado','') = '' THEN
      RAISE EXCEPTION 'Nome do signatário obrigatório' USING ERRCODE='P0005';
    END IF;
    IF coalesce(p_assinatura->>'cpf_informado','') = '' THEN
      RAISE EXCEPTION 'CPF do signatário obrigatório' USING ERRCODE='P0005';
    END IF;
  END IF;
  v_nome := p_assinatura->>'nome_informado';
  v_cpf := regexp_replace(coalesce(p_assinatura->>'cpf_informado',''),'\D','','g');
  UPDATE rh.documentos_emitidos SET
    assinatura = p_assinatura,
    status = 'assinado',
    assinado_em = v_now,
    -- Só sobrescreve nome_informado se veio no payload E o atual é placeholder
    nome_informado = CASE
      WHEN v_nome IS NOT NULL AND v_nome <> '' THEN v_nome
      ELSE nome_informado
    END,
    cpf_informado = CASE
      WHEN v_cpf <> '' THEN v_cpf
      ELSE cpf_informado
    END,
    updated_at = v_now
  WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'status', 'assinado', 'assinado_em', v_now);
END $$;
GRANT EXECUTE ON FUNCTION rh.documento_public_sign(text, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
