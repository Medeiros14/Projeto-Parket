-- Índice pros filtros do fluxo de validação fiscal (progresso-validacao e
-- validacao/pendencias): gestao.eventos é varrida por projeto_id + tipo.
CREATE INDEX IF NOT EXISTS idx_gestao_eventos_projeto_tipo
    ON gestao.eventos (projeto_id, tipo);
