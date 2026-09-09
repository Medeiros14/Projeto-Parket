-- Comentários do card no espelho local (não vai mais pro Trello).
-- Motivação: até 24/08 o app postava via API do Trello usando o token do setor
-- (conta do Will), então TODO comentário aparecia com autor "Will Tape Souza".
-- Agora cada projetista comenta com o nome/email do login Space.
-- Modelo espelha aditivo_comentarios (mesmo pattern, mesmos anexos).
CREATE TABLE IF NOT EXISTS trello_projetos.comentarios_locais (
  id           bigserial PRIMARY KEY,
  card_id      text        NOT NULL,
  user_id      uuid        NOT NULL,
  autor_nome   text        NOT NULL,
  autor_email  text,
  texto        text        NOT NULL,
  anexo_url    text,
  anexo_nome   text,
  anexo_mime   text,
  anexo_bytes  bigint,
  created_at   timestamptz NOT NULL DEFAULT now(),
  edited_at    timestamptz,
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS coment_locais_card_idx
  ON trello_projetos.comentarios_locais (card_id, created_at DESC)
  WHERE deleted_at IS NULL;
