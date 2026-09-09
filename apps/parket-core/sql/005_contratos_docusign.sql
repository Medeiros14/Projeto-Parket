-- 005_contratos_docusign.sql
-- Tabela pra rastrear envelopes DocuSign por card kanban.
-- Um card pode ter vários contratos ao longo do tempo (reenvios, aditivos),
-- mas no momento a UI mostra só o mais recente.

CREATE TABLE IF NOT EXISTS contratos_docusign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  envelope_id text UNIQUE,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviado','parcial','assinado','recusado','cancelado','expirado','erro')),
  signatarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_storage_path text,
  notes text,
  last_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_contratos_docusign_card
  ON contratos_docusign(card_id);
CREATE INDEX IF NOT EXISTS idx_contratos_docusign_envelope
  ON contratos_docusign(envelope_id) WHERE envelope_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contratos_docusign_status
  ON contratos_docusign(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION contratos_docusign_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contratos_docusign_touch ON contratos_docusign;
CREATE TRIGGER trg_contratos_docusign_touch
  BEFORE UPDATE ON contratos_docusign
  FOR EACH ROW EXECUTE FUNCTION contratos_docusign_touch_updated_at();

ALTER TABLE contratos_docusign ENABLE ROW LEVEL SECURITY;

-- Authenticated lê/escreve via Space/Core. Backend usa service_role
-- (que bypassa RLS), então policies aqui são pra os clientes frontend.
DROP POLICY IF EXISTS "contratos_docusign_select" ON contratos_docusign;
CREATE POLICY "contratos_docusign_select" ON contratos_docusign
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contratos_docusign_insert" ON contratos_docusign;
CREATE POLICY "contratos_docusign_insert" ON contratos_docusign
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "contratos_docusign_update" ON contratos_docusign;
CREATE POLICY "contratos_docusign_update" ON contratos_docusign
  FOR UPDATE TO authenticated USING (true);
