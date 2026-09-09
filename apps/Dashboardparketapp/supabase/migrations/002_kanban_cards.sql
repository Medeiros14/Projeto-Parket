-- ================================================================
-- Parket Dashboard — Kanban Cards
-- Execute no Supabase Dashboard > SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id           TEXT        NOT NULL,
  column_id         TEXT        NOT NULL,

  -- Campos básicos (visíveis no card)
  title             TEXT        NOT NULL,
  subtitle          TEXT,
  obra              TEXT,
  responsavel       TEXT        NOT NULL,
  sla               TEXT        NOT NULL DEFAULT '7d',
  sla_status        TEXT        NOT NULL DEFAULT 'ok'
                                CHECK (sla_status IN ('ok', 'warning', 'expired')),
  tags              TEXT[],
  progress          INTEGER     CHECK (progress >= 0 AND progress <= 100),
  value             TEXT,
  checklist_done    INTEGER,
  checklist_total   INTEGER,
  gate              INTEGER,
  priority          TEXT        DEFAULT 'media'
                                CHECK (priority IN ('alta', 'media', 'baixa')),
  parent_card_id    UUID        REFERENCES public.kanban_cards(id) ON DELETE SET NULL,

  -- Campos ricos para informação completa do projeto
  description       TEXT,                          -- Descrição detalhada / histórico do projeto
  details           JSONB       NOT NULL DEFAULT '{}', -- Dados estruturados: cliente, endereço, m², tipo_piso, etc.

  -- Auditoria
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_kanban_cards_dept     ON public.kanban_cards (dept_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_column   ON public.kanban_cards (dept_id, column_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_details  ON public.kanban_cards USING gin (details);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_kanban_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_kanban_cards_updated_at
  BEFORE UPDATE ON public.kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_kanban_updated_at();

-- RLS
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- Leitura: usuários autenticados podem ler cards dos seus departamentos
CREATE POLICY "auth_read_cards" ON public.kanban_cards
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escrita: superadmin, admin e dept_leader podem inserir/atualizar
CREATE POLICY "auth_write_cards" ON public.kanban_cards
  FOR INSERT WITH CHECK (
    public.current_user_role() IN ('superadmin', 'admin', 'dept_leader')
  );

CREATE POLICY "auth_update_cards" ON public.kanban_cards
  FOR UPDATE USING (
    public.current_user_role() IN ('superadmin', 'admin', 'dept_leader')
  );

CREATE POLICY "auth_delete_cards" ON public.kanban_cards
  FOR DELETE USING (
    public.current_user_role() IN ('superadmin', 'admin')
  );

-- Service role bypassa RLS automaticamente
