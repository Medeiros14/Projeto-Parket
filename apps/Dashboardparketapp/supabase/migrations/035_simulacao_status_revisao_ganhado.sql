-- Adiciona novos valores ao status de simulacao_projetos
ALTER TABLE simulacao_projetos DROP CONSTRAINT IF EXISTS simulacao_projetos_status_check;
ALTER TABLE simulacao_projetos ADD CONSTRAINT simulacao_projetos_status_check
  CHECK (status IN ('rascunho','enviada','aprovada','perdida','revisao','ganhado'));
