-- 009 — Banco de prestadores: avaliação + mancadas + bloqueio
-- ATENÇÃO: este schema mora no Supabase CLOUD (hbxpilrxmitvzebluoom), junto
-- com equipes_parket. NÃO é aplicado pelo deploy-gestao.sh (que roda no PG
-- local). Aplicar via: psql "$URL_CLOUD" -f 009_prestadores_avaliacao.sql

ALTER TABLE public.equipes_parket
  ADD COLUMN IF NOT EXISTS bloqueado_em timestamptz,
  ADD COLUMN IF NOT EXISTS bloqueado_por text,
  ADD COLUMN IF NOT EXISTS bloqueio_motivo text;

-- Avaliação por obra: fiscal da obra + gestão de produtividade (Nathalia).
-- Acumula histórico — nunca sobrescrever.
CREATE TABLE IF NOT EXISTS public.prestador_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES public.equipes_parket(id) ON DELETE CASCADE,
  card_id text,
  obra text,
  avaliador_email text NOT NULL,
  avaliador_nome text,
  papel text NOT NULL DEFAULT 'gestao',  -- fiscal | gestao
  nota_qualidade smallint NOT NULL CHECK (nota_qualidade BETWEEN 1 AND 5),
  nota_prazo smallint NOT NULL CHECK (nota_prazo BETWEEN 1 AND 5),
  nota_postura smallint NOT NULL CHECK (nota_postura BETWEEN 1 AND 5),
  nota_retrabalho smallint NOT NULL CHECK (nota_retrabalho BETWEEN 1 AND 5),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prest_aval_equipe
  ON public.prestador_avaliacoes (equipe_id, created_at DESC);

-- Eventos avulsos: mancada (com gravidade) ou elogio.
CREATE TABLE IF NOT EXISTS public.prestador_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES public.equipes_parket(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'mancada' CHECK (tipo IN ('mancada', 'elogio')),
  gravidade text CHECK (gravidade IN ('leve', 'media', 'grave')),
  descricao text NOT NULL,
  card_id text,
  obra text,
  registrado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prest_evt_equipe
  ON public.prestador_eventos (equipe_id, created_at DESC);
