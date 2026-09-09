-- Marca a "última vez que o usuário viu" cada tipo de novidade (fiscal / aditivo)
-- por card. O /api/board compara com o max(created_at) dos itens do fiscal /
-- aditivos e liga o chip "◆ FISCAL NOVO" / "◆ ADITIVO NOVO" quando é mais novo.
CREATE TABLE IF NOT EXISTS trello_projetos.notif_seen (
  user_id  uuid        NOT NULL,
  card_id  text        NOT NULL,
  tipo     text        NOT NULL,   -- 'fiscal' | 'aditivo'
  seen_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id, tipo)
);

-- Registro de push subscriptions (web-push VAPID) — fase 2.
CREATE TABLE IF NOT EXISTS trello_projetos.push_subs (
  id            bigserial PRIMARY KEY,
  user_id       uuid        NOT NULL,
  endpoint      text        NOT NULL UNIQUE,
  keys_p256dh   text        NOT NULL,
  keys_auth     text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subs_user_idx ON trello_projetos.push_subs (user_id);

-- Estado do watcher de notificações (última varredura) — evita reenviar push.
CREATE TABLE IF NOT EXISTS trello_projetos.notif_watch_state (
  id         int PRIMARY KEY DEFAULT 1,
  last_run   timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO trello_projetos.notif_watch_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Comentários da aba Aditivo (por card, não por sim aditiva específica).
CREATE TABLE IF NOT EXISTS trello_projetos.aditivo_comentarios (
  id           bigserial PRIMARY KEY,
  card_id      text        NOT NULL,
  user_id      uuid        NOT NULL,
  autor_nome   text        NOT NULL,
  autor_email  text,
  texto        text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aditivo_com_card_idx
  ON trello_projetos.aditivo_comentarios (card_id, created_at DESC);
ALTER TABLE trello_projetos.aditivo_comentarios ADD COLUMN IF NOT EXISTS anexo_url text;
ALTER TABLE trello_projetos.aditivo_comentarios ADD COLUMN IF NOT EXISTS anexo_nome text;
ALTER TABLE trello_projetos.aditivo_comentarios ADD COLUMN IF NOT EXISTS anexo_mime text;
ALTER TABLE trello_projetos.aditivo_comentarios ADD COLUMN IF NOT EXISTS anexo_bytes bigint;

-- Calendário estilo Google (views mês/semana/dia + convites internos).
CREATE TABLE IF NOT EXISTS trello_projetos.calendar_events (
  id           bigserial   PRIMARY KEY,
  user_id      uuid        NOT NULL,
  autor_nome   text        NOT NULL,
  autor_email  text,
  title        text        NOT NULL,
  descr        text,
  dt_start     timestamptz NOT NULL,
  dt_end       timestamptz,
  all_day      boolean     NOT NULL DEFAULT false,
  cor          text        NOT NULL DEFAULT '#3B82F6',
  convidados   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  card_id      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cal_ev_range_idx ON trello_projetos.calendar_events (dt_start, dt_end);
CREATE INDEX IF NOT EXISTS cal_ev_user_idx  ON trello_projetos.calendar_events (user_id);
