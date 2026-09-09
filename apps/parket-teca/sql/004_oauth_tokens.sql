-- Persistência de tokens OAuth Anthropic pra auto-refresh.
-- Antes: só access_token via Docker secret, expirava em 8h e exigia /login manual.
-- Agora: access + refresh persistidos, rotação automática quando falta <5min.
CREATE TABLE IF NOT EXISTS public.teca_oauth_tokens (
    provider       TEXT PRIMARY KEY,
    access_token   TEXT NOT NULL,
    refresh_token  TEXT,
    expires_at     TIMESTAMPTZ NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
