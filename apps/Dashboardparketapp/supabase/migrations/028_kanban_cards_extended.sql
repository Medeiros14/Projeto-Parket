ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS details          JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gates_data       JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS checklist_items  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS handoffs_data    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS financeiro_data  JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS raci_data        JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS chat_messages    JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_kanban_gates      ON public.kanban_cards USING gin (gates_data);
CREATE INDEX IF NOT EXISTS idx_kanban_checklist  ON public.kanban_cards USING gin (checklist_items);
CREATE INDEX IF NOT EXISTS idx_kanban_handoffs   ON public.kanban_cards USING gin (handoffs_data);
CREATE INDEX IF NOT EXISTS idx_kanban_financeiro ON public.kanban_cards USING gin (financeiro_data);
CREATE INDEX IF NOT EXISTS idx_kanban_details    ON public.kanban_cards USING gin (details);
