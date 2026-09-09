-- 015 — Aceita origem 'fiscal' em gestao.crises
-- Fiscal em campo (verifica.parket.works) pode abrir crise direto pelo card da obra.
ALTER TABLE gestao.crises DROP CONSTRAINT IF EXISTS crises_origem_check;
ALTER TABLE gestao.crises ADD CONSTRAINT crises_origem_check
  CHECK (origem IN ('relacionamento', 'projeto', 'manual', 'fiscal'));
