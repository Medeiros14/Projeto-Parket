-- 010: guia ÚNICA de impostos (PROVISAO 28% do recebido/mês por empresa)
-- + limpeza das guias individuais R$ 0 (seed antigo PIS/COFINS/ISS/...).

BEGIN;

ALTER TABLE core.impostos DROP CONSTRAINT impostos_tipo_check;
ALTER TABLE core.impostos ADD CONSTRAINT impostos_tipo_check
  CHECK (tipo = ANY (ARRAY['DAS','PIS','COFINS','ICMS','ISS','IRPJ','CSLL','INSS','FGTS','OUTROS','PROVISAO']));

CREATE UNIQUE INDEX IF NOT EXISTS impostos_empresa_tipo_comp_uq
  ON core.impostos (empresa_id, tipo, competencia);

-- guias R$ 0 do seed antigo + lançamentos espelhados
CREATE TEMP TABLE _del_lanc AS
  SELECT lancamento_id FROM core.impostos WHERE valor = 0 AND lancamento_id IS NOT NULL;
DELETE FROM core.impostos WHERE valor = 0;
DELETE FROM core.lancamentos WHERE id IN (SELECT lancamento_id FROM _del_lanc);

COMMIT;
