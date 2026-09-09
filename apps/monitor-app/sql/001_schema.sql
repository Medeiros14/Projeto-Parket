-- =====================================================================
-- MONITOR PARKET (monitor.parket.works)
-- Schema de monitoramento de disponibilidade das aplicacoes Parket.
-- Roda no PG LOCAL (parket-pg-local_postgres, rede parket-api_internal).
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS monitor;

-- ---------------------------------------------------------------------
-- APPS: cada aplicacao monitorada (1 linha por dominio *.parket.works)
-- grupo/ordem controlam a exibicao na pagina de status.
-- interno=true agrupa apps de dev/staging numa secao separada no fim.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitor.apps (
  id          serial PRIMARY KEY,
  slug        text UNIQUE NOT NULL,       -- subdominio (ex: valor)
  nome        text NOT NULL,              -- nome exibido na pagina
  url         text NOT NULL,              -- URL checada pelo checker
  grupo       text NOT NULL,              -- secao da pagina (setor)
  ordem       int  NOT NULL DEFAULT 0,    -- ordem dentro do grupo
  grupo_ordem int  NOT NULL DEFAULT 0,    -- ordem do grupo na pagina
  ativo       boolean NOT NULL DEFAULT true,
  interno     boolean NOT NULL DEFAULT false,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- CHECKS: resultado cru de cada checagem (retencao ~7 dias, o checker
-- apaga o que passar disso). ok = resposta HTTP com status < 500.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitor.checks (
  id          bigserial PRIMARY KEY,
  app_id      int NOT NULL REFERENCES monitor.apps(id) ON DELETE CASCADE,
  ts          timestamptz NOT NULL DEFAULT now(),
  ok          boolean NOT NULL,
  http_status int,                        -- NULL = erro de conexao/timeout
  latencia_ms int,
  erro        text                        -- mensagem quando ok=false
);
CREATE INDEX IF NOT EXISTS idx_checks_app_ts ON monitor.checks (app_id, ts DESC);

-- ---------------------------------------------------------------------
-- CHECKS_DIARIO: rollup por dia alimentado incrementalmente a cada
-- checagem (upsert). E a fonte da barra de 90 dias e do uptime %.
-- latencia_soma acumula pra calcular a media sem reprocessar.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitor.checks_diario (
  app_id        int NOT NULL REFERENCES monitor.apps(id) ON DELETE CASCADE,
  dia           date NOT NULL,
  total         int NOT NULL DEFAULT 0,
  ok_total      int NOT NULL DEFAULT 0,
  latencia_soma bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (app_id, dia)
);

-- ---------------------------------------------------------------------
-- INCIDENTES: abertos automaticamente pelo checker apos 3 falhas
-- consecutivas; resolvidos (fim preenchido) apos 2 sucessos seguidos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitor.incidentes (
  id      serial PRIMARY KEY,
  app_id  int NOT NULL REFERENCES monitor.apps(id) ON DELETE CASCADE,
  inicio  timestamptz NOT NULL DEFAULT now(),
  fim     timestamptz,                    -- NULL = incidente em aberto
  titulo  text NOT NULL,
  detalhe text
);
CREATE INDEX IF NOT EXISTS idx_incidentes_app ON monitor.incidentes (app_id, inicio DESC);
