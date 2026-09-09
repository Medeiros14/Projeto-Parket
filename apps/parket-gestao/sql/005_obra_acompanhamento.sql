-- 005 — Acompanhamento de Obras item-centric (adaptado do Space /operacional)
-- 1 linha por projeto com os dados gerais do acompanhamento; o cronograma
-- em si são os próprios gestao.itens (meta.obra = rendimento/equipe/instalado).

CREATE TABLE IF NOT EXISTS gestao.obra_acompanhamento (
  projeto_id               uuid PRIMARY KEY REFERENCES gestao.projetos(id) ON DELETE CASCADE,
  inicio_obra              date,
  previsao_entrega_manual  date,          -- manual de propósito (sem auto-calcular)
  descricao_produto        text,
  alertas                  jsonb DEFAULT '[]'::jsonb,   -- [{tipo, data, motivo}]
  share_token              text UNIQUE,                  -- link público /obra/<token>
  meta                     jsonb DEFAULT '{}'::jsonb,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
-- Entrada da obra editável na ficha do cliente (sem isso a data era sempre
-- o created_at do projeto, que é quando o registro nasceu no gestão).
ALTER TABLE gestao.obra_acompanhamento ADD COLUMN IF NOT EXISTS entrada_obra date;

DROP TRIGGER IF EXISTS trg_gestao_obra_acomp_touch ON gestao.obra_acompanhamento;
CREATE TRIGGER trg_gestao_obra_acomp_touch BEFORE UPDATE ON gestao.obra_acompanhamento
FOR EACH ROW EXECUTE FUNCTION gestao._touch();

-- Fotos do acompanhamento: vínculo por item + origem (upload direto ou
-- adotada da inbox fiscal_fotos pelo time de produtividade).
ALTER TABLE gestao.fotos ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE gestao.fotos ADD COLUMN IF NOT EXISTS ambiente     text;
ALTER TABLE gestao.fotos ADD COLUMN IF NOT EXISTS categoria    text;
ALTER TABLE gestao.fotos ADD COLUMN IF NOT EXISTS tipo         text DEFAULT 'foto';   -- foto|video
ALTER TABLE gestao.fotos ADD COLUMN IF NOT EXISTS origem       text DEFAULT 'upload'; -- upload|fiscal
ALTER TABLE gestao.fotos ADD COLUMN IF NOT EXISTS fonte_id     text;                  -- fiscal_fotos.id (dedup)
ALTER TABLE gestao.fotos ADD COLUMN IF NOT EXISTS ordem        int  DEFAULT 0;
ALTER TABLE gestao.fotos ADD COLUMN IF NOT EXISTS url_web      text;                  -- derivado otimizado (JPEG ≤1280px) no Storage
-- Curadoria: foto marcada pra aparecer na Central do Cliente (center.parket.works)
ALTER TABLE gestao.fotos ADD COLUMN IF NOT EXISTS center_visivel boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gestao_fotos_item ON gestao.fotos(item_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gestao_fotos_fonte
  ON gestao.fotos(projeto_id, fonte_id) WHERE fonte_id IS NOT NULL;

GRANT ALL ON ALL TABLES IN SCHEMA gestao TO gestao_rw;
