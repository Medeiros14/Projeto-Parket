-- 013: Relatório de saúde do setor (BI) + histórico de movimentação.
--
-- 1) card_movimentos: até aqui NÃO existia histórico de troca de fase
--    (lista) dos cards, então "tempo médio por fase" era impossível de
--    medir. A trigger abaixo grava cada mudança de lista_id, venha ela
--    do sync Trello (full ou incremental) ou de escrita direta da API.
-- 2) relatorio_insights: cache das análises geradas pela IA no painel
--    Relatório (evita chamar o Claude a cada abertura de página).

CREATE TABLE IF NOT EXISTS trello_projetos.card_movimentos (
    id          bigserial PRIMARY KEY,
    card_id     text NOT NULL,
    de_lista_id text,               -- lista de origem (NULL = card novo)
    para_lista_id text NOT NULL,    -- lista de destino
    movido_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS card_movimentos_card_idx
    ON trello_projetos.card_movimentos (card_id, movido_em);

-- Trigger: dispara em INSERT (nascimento do card) e em UPDATE que troca
-- a lista. UPDATE sem troca de lista (sync re-upserta tudo a cada rodada)
-- não gera linha nenhuma.
CREATE OR REPLACE FUNCTION trello_projetos.log_card_movimento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO trello_projetos.card_movimentos (card_id, de_lista_id, para_lista_id)
        VALUES (NEW.id, NULL, NEW.lista_id);
    ELSIF OLD.lista_id IS DISTINCT FROM NEW.lista_id THEN
        INSERT INTO trello_projetos.card_movimentos (card_id, de_lista_id, para_lista_id)
        VALUES (NEW.id, OLD.lista_id, NEW.lista_id);
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_card_movimento ON trello_projetos.cards;
CREATE TRIGGER trg_log_card_movimento
    AFTER INSERT OR UPDATE OF lista_id ON trello_projetos.cards
    FOR EACH ROW EXECUTE FUNCTION trello_projetos.log_card_movimento();

-- Cache dos insights da IA (1 linha por geração; a API serve a mais
-- recente com menos de 24h, ou regenera sob demanda com force=1).
CREATE TABLE IF NOT EXISTS trello_projetos.relatorio_insights (
    id         bigserial PRIMARY KEY,
    gerado_em  timestamptz NOT NULL DEFAULT now(),
    modelo     text,
    snapshot   jsonb NOT NULL,      -- métricas enviadas pro Claude (auditoria)
    insights   jsonb NOT NULL       -- [{titulo, detalhe, prioridade}, ...]
);
