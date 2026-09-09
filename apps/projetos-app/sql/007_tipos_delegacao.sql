-- tipos: o que o projetista vai fazer nessa obra (multi-seleção da gestora
-- no + Atribuir da Gestão de Equipe). Array jsonb de strings dentre:
-- Piso / Forro / Deck / Marcenaria / Escada / Paineis / Outros.
-- NULL = nunca atribuído com tipo. Não reflete no Trello (interno).
ALTER TABLE trello_projetos.cards
  ADD COLUMN IF NOT EXISTS tipos jsonb;
