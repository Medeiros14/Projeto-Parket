-- Link simulacao_projetos to obras
ALTER TABLE simulacao_projetos ADD COLUMN IF NOT EXISTS obra_id TEXT REFERENCES obras(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_simulacao_projetos_obra_id ON simulacao_projetos(obra_id);
