CREATE TABLE IF NOT EXISTS public.notificacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('alerta','handoff','mencao','comentario','sistema')),
  titulo          TEXT NOT NULL,
  mensagem        TEXT NOT NULL DEFAULT '',
  referencia_id   UUID,
  referencia_tipo TEXT,
  lida            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user    ON public.notificacoes (user_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_ref     ON public.notificacoes (referencia_id);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Usuário vê só as suas
CREATE POLICY "notif_select" ON public.notificacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update" ON public.notificacoes FOR UPDATE USING (auth.uid() = user_id);
-- Service role pode inserir (backend/webhook)
CREATE POLICY "notif_insert" ON public.notificacoes FOR INSERT WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
