-- Campos da atribuição (modelo do dash antigo): tamanho da obra,
-- prioridade e prazo. Organização interna — não reflete no Trello.
ALTER TABLE trello_projetos.cards
  ADD COLUMN IF NOT EXISTS tamanho    text,
  ADD COLUMN IF NOT EXISTS prioridade text,
  ADD COLUMN IF NOT EXISTS prazo      date;
