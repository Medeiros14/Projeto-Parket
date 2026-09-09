-- Kanban interno do projetista (Will 25/08): as fases do trabalho de quem
-- recebeu a delegação são diferentes das listas do board Trello. O card no
-- board principal NÃO se move quando o projetista arrasta no kanban dele;
-- é só um estado paralelo dentro do app ("uma cópia que atualiza o
-- principal com as informações", nas palavras do Will).
--
-- Valores possíveis de etapa_projetista:
--   a_iniciar | em_andamento | revisao | enviado | aprovado
-- NULL = card ainda não delegado (ou delegação retirada).
ALTER TABLE trello_projetos.cards
  ADD COLUMN IF NOT EXISTS etapa_projetista text,          -- fase interna atual
  ADD COLUMN IF NOT EXISTS etapa_projetista_em timestamptz, -- quando mudou pela última vez
  ADD COLUMN IF NOT EXISTS etapa_projetista_por text;       -- quem moveu (nome/email do login)

-- Backfill: todo card já delegado entra em "a_iniciar" (regra do Will:
-- atribuiu, entrou em A Iniciar). Cards sem projetista ficam NULL.
UPDATE trello_projetos.cards
   SET etapa_projetista = 'a_iniciar',
       etapa_projetista_em = now(),
       etapa_projetista_por = 'backfill-011'
 WHERE projetista_id IS NOT NULL
   AND etapa_projetista IS NULL;
