-- Reunião Semanal do Cronograma — gravação por projeto (10min max),
-- transcrição Whisper self-hosted, extração de resumo+tarefas via Claude,
-- review humano, e ao aprovar a tarefa vira obra_tasks no parket-chat via HTTP.
--
-- Fluxo:
--   1) Pamela abre /gestao/reuniao → cria gestao.reuniao_semanal
--   2) Toca no projeto ativo → cria gestao.reuniao_bloco (status=gravando)
--   3) FIM → upload áudio → status=processando → Whisper + Claude
--      → status=review, popula transcricao/resumo + N gestao.reuniao_tarefa_sugerida
--   4) Pamela revisa → aprova/edita/descarta cada tarefa
--   5) Aprovar tarefa: backend POST /api/obra/:card_id/tarefas no parket-chat,
--      guarda chat_task_id retornado, marca status=approved
--   6) Card gestão lê tarefas via GET /api/obra/:card_id/tarefas (sem espelho)

-- ── Sessões de reunião ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS gestao.reuniao_semanal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data           date NOT NULL DEFAULT CURRENT_DATE,   -- data da reunião
  conduzido_por  text,                                  -- email do operador (Pamela por padrão)
  titulo         text,                                  -- "Reunião de 12/ago/2026" etc
  status         text NOT NULL DEFAULT 'em_andamento', -- em_andamento|encerrada
  meta           jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  encerrada_em   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reuniao_data ON gestao.reuniao_semanal(data DESC);
DROP TRIGGER IF EXISTS trg_reuniao_semanal_touch ON gestao.reuniao_semanal;
CREATE TRIGGER trg_reuniao_semanal_touch BEFORE UPDATE ON gestao.reuniao_semanal
FOR EACH ROW EXECUTE FUNCTION gestao._touch();

-- ── Bloco de projeto dentro da reunião (1 áudio por projeto, até 10min) ─
CREATE TABLE IF NOT EXISTS gestao.reuniao_bloco (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id                uuid NOT NULL REFERENCES gestao.reuniao_semanal(id) ON DELETE CASCADE,
  projeto_id                uuid REFERENCES gestao.projetos(id) ON DELETE SET NULL,
  projeto_nome_snapshot     text NOT NULL,             -- nome do cliente no momento (não muda se renomear)
  card_id_snapshot          uuid,                       -- kanban_cards.id (pra postar no chat)
  audio_url                 text,                       -- storage path/URL no bucket
  audio_bytes               bigint,
  duracao_seg               int,
  transcricao               text,                       -- texto puro do Whisper
  resumo                    text,                       -- resumo gerado pelo Claude (3-5 bullets)
  status                    text NOT NULL DEFAULT 'gravando',
    -- gravando → processando → review → aprovado | descartado | erro
  erro_msg                  text,
  meta                      jsonb DEFAULT '{}'::jsonb,  -- {whisper_ms, claude_ms, participantes_falados[]}
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  encerrado_em              timestamptz,               -- quando a gravação parou (upload iniciado)
  aprovado_em               timestamptz                -- quando review terminou
);
CREATE INDEX IF NOT EXISTS idx_reuniao_bloco_reuniao ON gestao.reuniao_bloco(reuniao_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reuniao_bloco_projeto ON gestao.reuniao_bloco(projeto_id);
CREATE INDEX IF NOT EXISTS idx_reuniao_bloco_status  ON gestao.reuniao_bloco(status);
DROP TRIGGER IF EXISTS trg_reuniao_bloco_touch ON gestao.reuniao_bloco;
CREATE TRIGGER trg_reuniao_bloco_touch BEFORE UPDATE ON gestao.reuniao_bloco
FOR EACH ROW EXECUTE FUNCTION gestao._touch();

-- ── Tarefas sugeridas por bloco (buffer de review) ──────────
-- Ao aprovar, backend faz POST no parket-chat e guarda chat_task_id.
-- Fonte da verdade da tarefa executável é o obra_tasks do chat; aqui é audit trail.
CREATE TABLE IF NOT EXISTS gestao.reuniao_tarefa_sugerida (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id                  uuid NOT NULL REFERENCES gestao.reuniao_bloco(id) ON DELETE CASCADE,
  ordem                     int NOT NULL DEFAULT 0,     -- ordem em que Claude gerou
  titulo                    text NOT NULL,              -- texto da tarefa (editável no review)
  titulo_original           text,                       -- o que Claude gerou originalmente (audit)
  responsavel_nome_falado   text,                       -- "Fulano", "Pamela", "eu mesma"...
  responsavel_user_id       text,                       -- resolvido pra user_profiles.id na aprovação
  responsavel_email         text,                       -- fallback pra display
  prazo_texto               text,                       -- "sexta", "semana que vem", "quando o piso chegar"
  prazo_data                date,                       -- resolvido pra data absoluta (nullable)
  tipo                      text,                       -- livre|prazo|bloqueio|followup
  status                    text NOT NULL DEFAULT 'pending',
    -- pending → approved | edited | discarded
  chat_task_id              int,                        -- id retornado pelo POST /api/obra/:tid/tarefas
  chat_thread_id            int,                        -- obra_thread.id (cache)
  decidido_por              text,                       -- email de quem aprovou/descartou
  decidido_em               timestamptz,
  meta                      jsonb DEFAULT '{}'::jsonb,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reuniao_tarefa_bloco  ON gestao.reuniao_tarefa_sugerida(bloco_id, ordem);
CREATE INDEX IF NOT EXISTS idx_reuniao_tarefa_status ON gestao.reuniao_tarefa_sugerida(status);
DROP TRIGGER IF EXISTS trg_reuniao_tarefa_touch ON gestao.reuniao_tarefa_sugerida;
CREATE TRIGGER trg_reuniao_tarefa_touch BEFORE UPDATE ON gestao.reuniao_tarefa_sugerida
FOR EACH ROW EXECUTE FUNCTION gestao._touch();

-- ── View: reunião + contagem de blocos e tarefas ─────────────
CREATE OR REPLACE VIEW gestao.v_reuniao_resumo AS
SELECT r.id, r.data, r.conduzido_por, r.titulo, r.status,
       r.created_at, r.encerrada_em,
       COUNT(DISTINCT b.id)                                          AS n_blocos,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'aprovado')     AS n_aprovados,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'review')       AS n_review,
       COUNT(t.id)                                                    AS n_tarefas_total,
       COUNT(t.id) FILTER (WHERE t.status = 'approved')              AS n_tarefas_aprovadas,
       COUNT(t.id) FILTER (WHERE t.status = 'pending')               AS n_tarefas_pending
  FROM gestao.reuniao_semanal r
  LEFT JOIN gestao.reuniao_bloco b ON b.reuniao_id = r.id
  LEFT JOIN gestao.reuniao_tarefa_sugerida t ON t.bloco_id = b.id
 GROUP BY r.id;
