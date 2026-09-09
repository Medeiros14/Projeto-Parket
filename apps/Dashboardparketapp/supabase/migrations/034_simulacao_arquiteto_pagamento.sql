-- Adiciona campos de arquiteto e forma de pagamento à simulação de orçamento
ALTER TABLE simulacao_projetos ADD COLUMN IF NOT EXISTS arquiteto TEXT DEFAULT '';
ALTER TABLE simulacao_projetos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT '';
