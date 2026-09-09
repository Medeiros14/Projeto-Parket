-- Cards do Cloud com o MESMO nome do cliente aparecem em vários depts
-- (comercial, orçamento, operacional, financeiro, projetos...). Cada um com
-- id diferente. O fiscal registra laudo/vistoria/foto no card do dept OPERACIONAL,
-- mas o projetos-app só linkava o card do dept PROJETOS, então nada do fiscal
-- aparecia aqui. Agora guardamos TODOS os card_ids do Cloud que representam
-- a mesma obra, e as queries de fiscal (+ contadores no board) olham essa lista.
ALTER TABLE trello_projetos.cards
  ADD COLUMN IF NOT EXISTS space_card_ids_obra jsonb NOT NULL DEFAULT '[]'::jsonb;

-- GIN pra acelerar consultas "onde X = any dessa lista" quando precisar.
CREATE INDEX IF NOT EXISTS cards_space_card_ids_obra_idx
  ON trello_projetos.cards USING gin (space_card_ids_obra);
