-- ================================================================
-- Parket Dashboard — Kanban Cards: colunas ricas por seção
-- Execute no Supabase Dashboard > SQL Editor
-- ================================================================

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS gates_data       JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS checklist_items  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS handoffs_data    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS financeiro_data  JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS raci_data        JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS chat_messages    JSONB NOT NULL DEFAULT '[]';

-- Índices GIN para consultas dentro dos JSONBs
CREATE INDEX IF NOT EXISTS idx_kanban_gates      ON public.kanban_cards USING gin (gates_data);
CREATE INDEX IF NOT EXISTS idx_kanban_checklist  ON public.kanban_cards USING gin (checklist_items);
CREATE INDEX IF NOT EXISTS idx_kanban_handoffs   ON public.kanban_cards USING gin (handoffs_data);
CREATE INDEX IF NOT EXISTS idx_kanban_financeiro ON public.kanban_cards USING gin (financeiro_data);

-- ================================================================
-- Estrutura esperada de cada coluna:
--
-- gates_data: [{gate: 0, label: "Briefing & Qualificacao", status: "done",
--               date: "15/02", responsible: "Comercial"}, ...]
--
-- checklist_items: [{item: "Contrapiso nivelado", done: true}, ...]
--
-- handoffs_data: [{from: "Comercial", to: "Projetos",
--                  item: "Contrato + briefing", status: "done", date: "15/02"}, ...]
--
-- financeiro_data: {
--   valorContrato: "R$ 185k",
--   orcado: "R$ 118k",
--   realizado: "R$ 89k",
--   margemOrc: "36.2%",
--   margemReal: "34.5%",
--   parcelas: [{num: 1, valor: "R$ 62k", status: "pago", venc: "15/02"}],
--   custos: [{cat: "Material", valor: "R$ 52k", perc: 58}]
-- }
--
-- raci_data: [{atividade: "Briefing inicial", r: "Comercial",
--              a: "Co-CEO", c: "Projetos", i: "Atendimento"}, ...]
--
-- chat_messages: [{id: 1, user: "Dany", msg: "...", time: "09:30", avatar: "D"}, ...]
-- ================================================================
