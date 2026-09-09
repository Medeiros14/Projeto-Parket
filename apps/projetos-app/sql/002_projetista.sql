-- projetista_id: FK lógica pra public.user_profiles (mesmo PG local).
-- Não pomos constraint pra não amarrar o sync do Trello com o cadastro
-- de user_profiles (que é gerenciado no Space). NULL = ainda não
-- delegado — só Thainara (gestora) vê esses no board dela.
ALTER TABLE trello_projetos.cards
  ADD COLUMN IF NOT EXISTS projetista_id uuid;

CREATE INDEX IF NOT EXISTS idx_cards_projetista
  ON trello_projetos.cards(projetista_id)
  WHERE projetista_id IS NOT NULL;
