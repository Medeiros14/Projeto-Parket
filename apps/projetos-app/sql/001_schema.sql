-- Setor de Projetos — espelho 1:1 do board Trello "PROJETOS | Thainara" (CsJmU6DM).
-- Fonte da verdade = Trello; este schema é a cópia sincronizada que o app serve.

CREATE SCHEMA IF NOT EXISTS trello_projetos;

CREATE TABLE IF NOT EXISTS trello_projetos.listas (
  id          text PRIMARY KEY,          -- id da lista no Trello
  nome        text NOT NULL,
  pos         numeric,
  closed      boolean NOT NULL DEFAULT false,
  sync_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trello_projetos.cards (
  id                 text PRIMARY KEY,   -- id do card no Trello
  lista_id           text REFERENCES trello_projetos.listas(id),
  nome               text NOT NULL DEFAULT '',
  descricao          text NOT NULL DEFAULT '',
  pos                numeric,
  due                timestamptz,
  due_complete       boolean NOT NULL DEFAULT false,
  closed             boolean NOT NULL DEFAULT false,
  labels             jsonb NOT NULL DEFAULT '[]',   -- [{nome, cor}]
  membros            jsonb NOT NULL DEFAULT '[]',   -- [{nome, iniciais}]
  checklists         jsonb NOT NULL DEFAULT '[]',   -- [{nome, itens:[{nome, done}]}]
  short_link         text,
  url                text,
  capa_anexo_id      text,               -- idAttachmentCover do Trello (se setado)
  date_last_activity timestamptz,
  space_card_id      uuid,               -- vínculo com public.kanban_cards (Cloud, dept projetos)
  sync_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cards_lista_idx ON trello_projetos.cards (lista_id, pos);

CREATE TABLE IF NOT EXISTS trello_projetos.anexos (
  id          text PRIMARY KEY,          -- id do attachment no Trello
  card_id     text NOT NULL REFERENCES trello_projetos.cards(id) ON DELETE CASCADE,
  nome        text NOT NULL DEFAULT '',
  mime        text,
  bytes       bigint,
  url_trello  text,
  path_local  text,                      -- relativo a /data (ex.: anexos/<card>/<id>_<nome>)
  is_imagem   boolean NOT NULL DEFAULT false,
  is_upload   boolean NOT NULL DEFAULT true,   -- false = link externo anexado
  baixado     boolean NOT NULL DEFAULT false,
  criado_em   timestamptz,
  pos         numeric
);
CREATE INDEX IF NOT EXISTS anexos_card_idx ON trello_projetos.anexos (card_id, pos);

CREATE TABLE IF NOT EXISTS trello_projetos.comentarios (
  id       text PRIMARY KEY,             -- id da action no Trello
  card_id  text NOT NULL REFERENCES trello_projetos.cards(id) ON DELETE CASCADE,
  autor    text,
  texto    text NOT NULL DEFAULT '',
  data     timestamptz
);
CREATE INDEX IF NOT EXISTS comentarios_card_idx ON trello_projetos.comentarios (card_id, data DESC);

CREATE TABLE IF NOT EXISTS trello_projetos.sync_log (
  id               bigserial PRIMARY KEY,
  iniciado         timestamptz NOT NULL DEFAULT now(),
  terminado        timestamptz,
  tipo             text NOT NULL DEFAULT 'incremental',  -- full | incremental
  n_cards          int,
  n_anexos_baixados int,
  erro             text
);
