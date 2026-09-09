-- Override manual dos dados do cliente por card do kanban (Trello).
-- Alguns cards vêm sem cliente/endereço/CNPJ do sync (Space); a gestora
-- pode preencher manualmente aqui. O /api/board dá prioridade ao override
-- (só cai no dado do simulacao_projetos se o override estiver vazio).
CREATE TABLE IF NOT EXISTS trello_projetos.card_override_dados (
  card_id     text        PRIMARY KEY,
  cliente     text,
  endereco    text,
  cnpj_cpf    text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);
