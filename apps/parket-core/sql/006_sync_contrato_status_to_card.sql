-- 006_sync_contrato_status_to_card.sql
-- Trigger pra propagar o status de `contratos_docusign` pro JSONB
-- `kanban_cards.details.docusign_status`. Assim o frontend (Space) pode
-- ler o status direto do details do card e exibir badge sem novo fetch.
--
-- Também mantém:
--   details.docusign_envelope_id   — pra deep-link
--   details.docusign_sent_at       — pra calcular "vencido"
--   details.docusign_completed_at  — pra histórico
--
-- Sempre usa o registro MAIS RECENTE de contratos_docusign por card_id.

CREATE OR REPLACE FUNCTION sync_contrato_status_to_card()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  latest RECORD;
  prev_details jsonb;
  new_details jsonb;
BEGIN
  -- Pega o contrato mais recente desse card (incluindo a linha NEW)
  SELECT status, envelope_id, sent_at, completed_at, updated_at
    INTO latest
    FROM contratos_docusign
   WHERE card_id = NEW.card_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF latest IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT details INTO prev_details FROM kanban_cards WHERE id = NEW.card_id;
  IF prev_details IS NULL THEN
    prev_details := '{}'::jsonb;
  END IF;

  new_details := prev_details
    || jsonb_build_object(
         'docusign_status', latest.status,
         'docusign_envelope_id', latest.envelope_id,
         'docusign_sent_at', latest.sent_at,
         'docusign_completed_at', latest.completed_at,
         'docusign_updated_at', latest.updated_at
       );

  UPDATE kanban_cards SET details = new_details WHERE id = NEW.card_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_sync_status ON contratos_docusign;
CREATE TRIGGER trg_contrato_sync_status
  AFTER INSERT OR UPDATE ON contratos_docusign
  FOR EACH ROW EXECUTE FUNCTION sync_contrato_status_to_card();

-- Backfill — popula details pros contratos existentes
UPDATE kanban_cards k
   SET details = COALESCE(details, '{}'::jsonb)
     || jsonb_build_object(
          'docusign_status', c.status,
          'docusign_envelope_id', c.envelope_id,
          'docusign_sent_at', c.sent_at,
          'docusign_completed_at', c.completed_at,
          'docusign_updated_at', c.updated_at
        )
  FROM (
    SELECT DISTINCT ON (card_id) card_id, status, envelope_id, sent_at, completed_at, updated_at
      FROM contratos_docusign
      ORDER BY card_id, created_at DESC
  ) c
 WHERE c.card_id = k.id;
