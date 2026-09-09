-- ============================================================
-- Parket Signer — Assinatura eletrônica (PAdES/MP 2.200-2)
-- Schema isolado pra facilitar pen-test e auditoria.
-- Sem FK direta pra rh.* — usa contexto polimórfico (tipo+id).
--
-- TSA é modular: provider="internal" agora; troca pra "freetsa"/
-- "serpro"/etc na v2 sem refactor (Strategy via tsa_providers).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS signer;
GRANT USAGE ON SCHEMA signer TO authenticated;

CREATE OR REPLACE FUNCTION signer.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Certificados Parket (X.509 internos pra emitir PAdES)
CREATE TABLE IF NOT EXISTS signer.certificados_parket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL UNIQUE,             -- "parket-2026-pri"
  certificado_pem text NOT NULL,
  chave_privada_pem_kms text,             -- ref pro KMS — chave NÃO em plaintext
  serial text,
  issuer text,
  subject text,                           -- "CN=Parket Pisos LTDA, C=BR"
  valido_de timestamptz NOT NULL,
  valido_ate timestamptz NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TSA Providers (Strategy/Adapter pra trocar TSA sem refactor)
CREATE TABLE IF NOT EXISTS signer.tsa_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL UNIQUE,             -- "internal", "freetsa", "serpro_icpbr"
  url text,                               -- endpoint TSA real (RFC 3161) — null pro internal
  credential_ref text,                    -- ref no secrets manager
  algoritmo text NOT NULL DEFAULT 'sha256',
  icp_brasil boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  prioridade int NOT NULL DEFAULT 100,    -- menor = mais prioridade
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO signer.tsa_providers (alias, algoritmo, icp_brasil, ativo, prioridade)
VALUES ('internal','sha256',false,true,100)
ON CONFLICT (alias) DO NOTHING;

-- Documento principal
CREATE TABLE IF NOT EXISTS signer.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificação
  titulo text NOT NULL,
  -- Polimórfico: liga a uma entidade origem (rh.contrato, rh.ferias, etc)
  contexto_tipo text NOT NULL,            -- "rh.admissao", "rh.contrato", "rh.ferias_solicitacao"
  contexto_id uuid NOT NULL,
  empresa_id uuid REFERENCES core.empresas(id),
  -- Ordem de assinatura
  ordem_obrigatoria boolean NOT NULL DEFAULT false,  -- true = sequencial
  -- PDFs
  storage_path_original text NOT NULL,    -- PDF antes de qualquer assinatura
  hash_original text NOT NULL,            -- SHA-256 do original
  storage_path_final text,                -- PDF selado (todos assinaram + log)
  hash_final text,
  -- Estado
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviado','em_assinatura','assinado','cancelado','expirado')),
  expira_em timestamptz,
  -- Auditoria
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz,
  assinado_em timestamptz,                -- timestamp da última assinatura
  cancelado_em timestamptz,
  cancelado_motivo text,
  metadata jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS doc_status_idx ON signer.documentos(status);
CREATE INDEX IF NOT EXISTS doc_contexto_idx ON signer.documentos(contexto_tipo, contexto_id);

-- Signatários (N por documento)
CREATE TABLE IF NOT EXISTS signer.signatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES signer.documentos(id) ON DELETE RESTRICT,
  ordem int NOT NULL DEFAULT 1,
  -- Identificação
  nome text NOT NULL,
  cpf text,
  email text,
  telefone text,                          -- E.164 sem espaço
  -- Método de autenticação
  metodo_auth text NOT NULL
    CHECK (metodo_auth IN ('otp_email','otp_whatsapp','otp_sms','selfie','livre','certificado_a3')),
  -- Estado
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','convidado','autenticando','assinou','recusou','expirado')),
  recusou_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(documento_id, ordem)
);
CREATE INDEX IF NOT EXISTS sig_doc_idx ON signer.signatarios(documento_id);

-- Links únicos enviados ao signatário (cada vez que reenvia, cria novo)
CREATE TABLE IF NOT EXISTS signer.signatario_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signatario_id uuid NOT NULL REFERENCES signer.signatarios(id) ON DELETE RESTRICT,
  token text NOT NULL UNIQUE,             -- nanoid 32 chars
  canal text NOT NULL CHECK (canal IN ('whatsapp','email','sms')),
  enviado_em timestamptz,
  expira_em timestamptz NOT NULL,
  primeiro_acesso_em timestamptz,
  ultimo_acesso_em timestamptz,
  acessos_count int NOT NULL DEFAULT 0,
  revogado_em timestamptz,
  revogado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS link_token_idx ON signer.signatario_links(token);

-- Códigos OTP (email/SMS/WhatsApp)
CREATE TABLE IF NOT EXISTS signer.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signatario_id uuid NOT NULL REFERENCES signer.signatarios(id) ON DELETE RESTRICT,
  link_id uuid REFERENCES signer.signatario_links(id),
  canal text NOT NULL,
  codigo_hash text NOT NULL,              -- SHA-256 do código (não armazenamos plaintext)
  codigo_dica text,                       -- ex: primeiros 2 dígitos pra UX (opcional)
  enviado_em timestamptz,
  validado_em timestamptz,
  tentativas int NOT NULL DEFAULT 0,
  expira_em timestamptz NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Assinatura efetiva (1 por signatário ao assinar)
CREATE TABLE IF NOT EXISTS signer.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signatario_id uuid NOT NULL UNIQUE REFERENCES signer.signatarios(id) ON DELETE RESTRICT,
  documento_id uuid NOT NULL REFERENCES signer.documentos(id),
  link_id uuid REFERENCES signer.signatario_links(id),
  -- Hash do PDF NESSE momento (antes desse selo) — anti-tampering
  hash_pdf_pre text NOT NULL,
  hash_pdf_pos text NOT NULL,
  -- Assinatura PAdES gerada
  certificado_id uuid REFERENCES signer.certificados_parket(id),
  pades_signature_b64 text,
  -- Carimbo do tempo
  ts_servidor timestamptz NOT NULL DEFAULT now(),  -- UTC
  tsa_provider_id uuid REFERENCES signer.tsa_providers(id),
  tsa_token_b64 text,                     -- TSR retorno (RFC 3161) — null pro internal
  -- Identidade verificada
  metodo_auth_usado text NOT NULL,
  otp_id uuid REFERENCES signer.otp_codes(id),
  -- Evidências
  ip text,
  user_agent text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  geocidade text,
  geouf text,
  geopais text,
  selfie_storage_path text,               -- selfie dinâmica se método = selfie
  -- Snapshot identidade
  signatario_nome_snapshot text NOT NULL,
  signatario_cpf_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ass_doc_idx ON signer.assinaturas(documento_id);

-- Audit log (TODO evento, retenção 5+ anos)
CREATE TABLE IF NOT EXISTS signer.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid REFERENCES signer.documentos(id),
  signatario_id uuid REFERENCES signer.signatarios(id),
  evento text NOT NULL,                   -- doc_criado, link_gerado, link_enviado, link_aberto,
                                          -- otp_enviado, otp_validado, otp_falha,
                                          -- doc_visualizado, assinatura_iniciada, assinada,
                                          -- recusada, expirado, cancelado, retificado
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id), -- quem disparou (RH ou signatário)
  ip text,
  user_agent text,
  payload jsonb DEFAULT '{}'::jsonb,
  hash_pdf_naquele_momento text,
  observacao text
);
CREATE INDEX IF NOT EXISTS audit_doc_idx ON signer.audit_logs(documento_id, ts DESC);
CREATE INDEX IF NOT EXISTS audit_evento_idx ON signer.audit_logs(evento);

-- Carimbos TSA aplicados (quando provider real for usado)
CREATE TABLE IF NOT EXISTS signer.tsa_carimbos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id uuid NOT NULL REFERENCES signer.assinaturas(id),
  provider_id uuid NOT NULL REFERENCES signer.tsa_providers(id),
  request_b64 text,                       -- TSQ
  response_b64 text NOT NULL,             -- TSR
  ts_carimbado timestamptz NOT NULL,
  serial text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers updated_at
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['documentos','signatarios'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON signer.%I; '
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON signer.%I '
      'FOR EACH ROW EXECUTE FUNCTION signer.set_updated_at()', t, t);
  END LOOP;
END $$;

-- FK pendentes nos schemas RH apontando pra signer.documentos
ALTER TABLE rh.admissoes
  DROP CONSTRAINT IF EXISTS admissoes_contrato_doc_fkey,
  ADD CONSTRAINT admissoes_contrato_doc_fkey
  FOREIGN KEY (contrato_documento_id) REFERENCES signer.documentos(id);

ALTER TABLE rh.ferias_solicitacoes
  DROP CONSTRAINT IF EXISTS ferias_aviso_doc_fkey,
  ADD CONSTRAINT ferias_aviso_doc_fkey
  FOREIGN KEY (aviso_documento_id) REFERENCES signer.documentos(id);

-- E na contrato_alteracoes apontando pra esocial
ALTER TABLE rh.contrato_alteracoes
  DROP CONSTRAINT IF EXISTS contrato_alt_esocial_fkey,
  ADD CONSTRAINT contrato_alt_esocial_fkey
  FOREIGN KEY (esocial_evento_id) REFERENCES rh.esocial_eventos(id);
