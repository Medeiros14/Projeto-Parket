-- 012 — Fix policy de storage KYC (anon não tem SELECT em documentos_emitidos).
-- Move o EXISTS pra uma SECURITY DEFINER function → policy passa a checar via função.
CREATE OR REPLACE FUNCTION rh.can_upload_kyc(p_token text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM rh.documentos_emitidos
    WHERE token = p_token
      AND requer_kyc = true
      AND (token_expira_em IS NULL OR token_expira_em >= now())
      AND status IN ('rascunho','aguardando_assinatura','visualizado')
  )
$$;
GRANT EXECUTE ON FUNCTION rh.can_upload_kyc(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION rh.can_read_kyc(p_token text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM rh.documentos_emitidos
    WHERE token = p_token
      AND (token_expira_em IS NULL OR token_expira_em >= now())
  )
$$;
GRANT EXECUTE ON FUNCTION rh.can_read_kyc(text) TO anon, authenticated;

DROP POLICY IF EXISTS "kyc_anon_write_by_token" ON storage.objects;
CREATE POLICY "kyc_anon_write_by_token" ON storage.objects
FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'rh-documentos'
  AND (name LIKE 'kyc/%/selfie.jpg' OR name LIKE 'kyc/%/doc.jpg')
  AND rh.can_upload_kyc(split_part(name, '/', 2))
);

-- UPDATE também: anon precisa poder sobrescrever via upsert=true
DROP POLICY IF EXISTS "kyc_anon_update_by_token" ON storage.objects;
CREATE POLICY "kyc_anon_update_by_token" ON storage.objects
FOR UPDATE TO anon
USING (
  bucket_id = 'rh-documentos'
  AND (name LIKE 'kyc/%/selfie.jpg' OR name LIKE 'kyc/%/doc.jpg')
  AND rh.can_upload_kyc(split_part(name, '/', 2))
) WITH CHECK (
  bucket_id = 'rh-documentos'
  AND (name LIKE 'kyc/%/selfie.jpg' OR name LIKE 'kyc/%/doc.jpg')
  AND rh.can_upload_kyc(split_part(name, '/', 2))
);

DROP POLICY IF EXISTS "kyc_anon_read_by_token" ON storage.objects;
CREATE POLICY "kyc_anon_read_by_token" ON storage.objects
FOR SELECT TO anon
USING (
  bucket_id = 'rh-documentos'
  AND (name LIKE 'kyc/%/selfie.jpg' OR name LIKE 'kyc/%/doc.jpg')
  AND rh.can_read_kyc(split_part(name, '/', 2))
);

NOTIFY pgrst, 'reload schema';
