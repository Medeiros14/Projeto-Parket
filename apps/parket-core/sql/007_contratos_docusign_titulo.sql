-- 007 — Adiciona `titulo` em contratos_docusign pra suportar múltiplos
-- documentos no mesmo card (Contrato Principal + Aditivo 1 + Aditivo 2…).
-- Também adiciona índice composto pra listagem ordenada.

ALTER TABLE contratos_docusign
  ADD COLUMN IF NOT EXISTS titulo text NOT NULL DEFAULT 'Contrato Principal';

CREATE INDEX IF NOT EXISTS idx_contratos_docusign_card_created
  ON contratos_docusign(card_id, created_at DESC);

-- Backfill: pra cada card, o mais antigo vira "Contrato Principal",
-- os subsequentes "Aditivo 1", "Aditivo 2"...
WITH numerados AS (
  SELECT id, card_id,
         ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY created_at ASC) AS rn
    FROM contratos_docusign
)
UPDATE contratos_docusign c
   SET titulo = CASE WHEN n.rn = 1 THEN 'Contrato Principal'
                     ELSE 'Aditivo ' || (n.rn - 1)::text
                END
  FROM numerados n
 WHERE c.id = n.id;
