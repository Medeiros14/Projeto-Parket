-- Faixas de comissão por volume vendido (por contrato), com % distinto com/sem RT.
-- Regras (Will 07/08/2026): faixa definida pelo valor do PRÓPRIO contrato;
-- % cheio da faixa sobre o valor; obra com arquiteto/RT usa percentual_com_rt.
CREATE TABLE IF NOT EXISTS core.comissao_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_min numeric NOT NULL DEFAULT 0,
  volume_max numeric,                          -- NULL = sem teto
  percentual_sem_rt numeric NOT NULL DEFAULT 0,
  percentual_com_rt numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comissao_faixas_range_chk CHECK (volume_max IS NULL OR volume_max > volume_min)
);

ALTER TABLE core.comissao_faixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read" ON core.comissao_faixas;
CREATE POLICY "auth read" ON core.comissao_faixas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin write" ON core.comissao_faixas;
CREATE POLICY "admin write" ON core.comissao_faixas FOR ALL TO authenticated
  USING (core.is_admin()) WITH CHECK (core.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON core.comissao_faixas TO authenticated, service_role;
GRANT SELECT ON core.comissao_faixas TO anon, teca_reader;
