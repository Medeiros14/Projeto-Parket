-- 012_card_projetistas_multi.sql — Will 26/08:
-- Uma obra pode ter mais de um responsável (Vinicius + Suelen no mesmo card, por ex).
-- Cada pessoa carrega seus próprios tipos/tamanho/prioridade/prazo/etapa_projetista,
-- porque o mesmo card pode ser "Piso pra sexta pro Vinicius" e "Marcenaria pra
-- segunda pra Suelen" ao mesmo tempo.
--
-- A coluna cards.projetista_id continua existindo — passa a ser derivada
-- (o primeiro responsável, pela ordem de delegação) via trigger. Assim
-- o watcher do trello.py, o kanban interno legado e leitores externos que só
-- sabem do UUID único continuam vendo algo válido enquanto migram.

CREATE TABLE IF NOT EXISTS trello_projetos.card_projetistas (
    card_id              text        NOT NULL REFERENCES trello_projetos.cards(id) ON DELETE CASCADE,
    projetista_id        uuid        NOT NULL,
    -- Campos por pessoa (idênticos aos que ficavam em cards.*)
    tipos                jsonb       NOT NULL DEFAULT '[]'::jsonb,
    tamanho              text,
    prioridade           text        NOT NULL DEFAULT 'normal',
    prazo                date,
    -- Kanban interno é POR PESSOA agora: cada responsável tem sua própria fase.
    etapa_projetista     text        NOT NULL DEFAULT 'a_iniciar',
    etapa_projetista_em  timestamptz NOT NULL DEFAULT now(),
    etapa_projetista_por text,
    -- Auditoria da delegação em si
    delegado_em          timestamptz NOT NULL DEFAULT now(),
    delegado_por         text,
    PRIMARY KEY (card_id, projetista_id)
);

CREATE INDEX IF NOT EXISTS idx_card_projetistas_pj
    ON trello_projetos.card_projetistas (projetista_id);

-- BACKFILL: migra tudo que já estava atribuído (1 pessoa por card) pra 1 linha.
INSERT INTO trello_projetos.card_projetistas
       (card_id, projetista_id, tipos, tamanho, prioridade, prazo,
        etapa_projetista, etapa_projetista_em, etapa_projetista_por, delegado_em, delegado_por)
SELECT c.id, c.projetista_id,
       COALESCE(c.tipos, '[]'::jsonb),
       c.tamanho,
       COALESCE(c.prioridade, 'normal'),
       c.prazo,
       COALESCE(c.etapa_projetista, 'a_iniciar'),
       COALESCE(c.etapa_projetista_em, now()),
       c.etapa_projetista_por,
       now(),
       'backfill-012'
  FROM trello_projetos.cards c
 WHERE c.projetista_id IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM trello_projetos.card_projetistas x
        WHERE x.card_id = c.id AND x.projetista_id = c.projetista_id
   );

-- Sync inverso: quando muda card_projetistas, atualiza cards.projetista_id/tipos/etc
-- com o valor da PRIMEIRA linha (mais antiga em delegado_em). Mantém legado vivo.
CREATE OR REPLACE FUNCTION trello_projetos._sync_cards_from_projetistas(p_card_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v RECORD;
BEGIN
    SELECT projetista_id, tipos, tamanho, prioridade, prazo,
           etapa_projetista, etapa_projetista_em, etapa_projetista_por
      INTO v
      FROM trello_projetos.card_projetistas
     WHERE card_id = p_card_id
     ORDER BY delegado_em ASC
     LIMIT 1;
    IF FOUND THEN
        UPDATE trello_projetos.cards
           SET projetista_id        = v.projetista_id,
               tipos                = v.tipos,
               tamanho              = v.tamanho,
               prioridade           = v.prioridade,
               prazo                = v.prazo,
               etapa_projetista     = v.etapa_projetista,
               etapa_projetista_em  = v.etapa_projetista_em,
               etapa_projetista_por = v.etapa_projetista_por
         WHERE id = p_card_id;
    ELSE
        UPDATE trello_projetos.cards
           SET projetista_id = NULL, tipos = NULL, tamanho = NULL,
               prioridade = NULL, prazo = NULL,
               etapa_projetista = NULL, etapa_projetista_em = NULL,
               etapa_projetista_por = NULL
         WHERE id = p_card_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trello_projetos._trg_card_projetistas_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM trello_projetos._sync_cards_from_projetistas(OLD.card_id);
        RETURN OLD;
    ELSE
        PERFORM trello_projetos._sync_cards_from_projetistas(NEW.card_id);
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_card_projetistas_sync ON trello_projetos.card_projetistas;
CREATE TRIGGER trg_card_projetistas_sync
AFTER INSERT OR UPDATE OR DELETE ON trello_projetos.card_projetistas
FOR EACH ROW EXECUTE FUNCTION trello_projetos._trg_card_projetistas_sync();
