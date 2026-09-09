-- Alertas de risco sugeridos pela Teca IA a partir do contexto da reunião.
-- Fluxo espelha reuniao_tarefa_sugerida: Claude gera sugestão → humano aprova → cria crise real.
-- Aprovação chama gestao.crises via lógica interna (não este arquivo).

CREATE TABLE IF NOT EXISTS gestao.reuniao_alerta_sugerido (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id                  uuid NOT NULL REFERENCES gestao.reuniao_bloco(id) ON DELETE CASCADE,
  ordem                     int NOT NULL DEFAULT 0,
  descricao                 text NOT NULL,              -- resumo do problema percebido (editável no review)
  descricao_original        text,                       -- o que Claude gerou (audit)
  evidencia                 text,                       -- trecho literal da transcrição que motivou o alerta
  gravidade                 text NOT NULL DEFAULT 'media',   -- leve | media | grave
  status                    text NOT NULL DEFAULT 'pending', -- pending → approved | edited | discarded
  crise_id                  uuid,                       -- id da crise criada em gestao.crises quando aprovado
  decidido_por              text,
  decidido_em               timestamptz,
  meta                      jsonb DEFAULT '{}'::jsonb,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reuniao_alerta_bloco  ON gestao.reuniao_alerta_sugerido(bloco_id, ordem);
CREATE INDEX IF NOT EXISTS idx_reuniao_alerta_status ON gestao.reuniao_alerta_sugerido(status);
DROP TRIGGER IF EXISTS trg_reuniao_alerta_touch ON gestao.reuniao_alerta_sugerido;
CREATE TRIGGER trg_reuniao_alerta_touch BEFORE UPDATE ON gestao.reuniao_alerta_sugerido
FOR EACH ROW EXECUTE FUNCTION gestao._touch();
