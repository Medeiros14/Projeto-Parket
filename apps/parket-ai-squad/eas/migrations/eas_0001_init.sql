-- EAS (Engineering Agent System) — schema bootstrap
-- Mantém o sistema EAS isolado da Teca V2 e demais agentes existentes no schema public.

CREATE SCHEMA IF NOT EXISTS eas;

GRANT USAGE ON SCHEMA eas TO parket;
GRANT ALL ON SCHEMA eas TO parket;
ALTER DEFAULT PRIVILEGES IN SCHEMA eas GRANT ALL ON TABLES TO parket;
ALTER DEFAULT PRIVILEGES IN SCHEMA eas GRANT ALL ON SEQUENCES TO parket;
