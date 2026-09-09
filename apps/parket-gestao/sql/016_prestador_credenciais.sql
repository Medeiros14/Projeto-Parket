-- =====================================================================
-- 016_prestador_credenciais.sql
-- Banco: Supabase Cloud hbxpilrxmitvzebluoom (Valor)
--
-- O QUE FAZ:
--   1. Grava de vez o vinculo equipes_parket -> prestadores (coluna
--      prestador_id). Hoje esse vinculo e adivinhado a cada request
--      pelo resolver do backend (main.py _resolve_prestador_id), que
--      compara telefone/nome e cria prestador novo quando nao acha.
--   2. Cria prestador_credenciais: login + senha do prestador para o
--      app instala.parket.works. Tabela separada de prestadores porque
--      prestadores tem RLS aberta (policy prestadores_all: ALL/public/true),
--      ou seja qualquer portador da anon key le a tabela inteira.
--      Aqui a RLS fica LIGADA e SEM policy: so service_role passa.
--   3. RPCs SECURITY DEFINER para o app fazer login e para o gestao
--      gerar/resetar senha sem expor a tabela.
--
-- Substitui o login por PIN (fn_instala_login) por login+senha.
-- =====================================================================

-- pgcrypto (crypt/gen_salt) ja vive no schema extensions neste projeto
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) Vinculo equipes_parket -> prestadores
-- ---------------------------------------------------------------------

-- Coluna que passa a guardar o par resolvido (antes so existia em memoria)
alter table public.equipes_parket
  add column if not exists prestador_id uuid references public.prestadores(id) on delete set null;

-- Indice comum (nao unico) de proposito: equipes_parket tem linhas
-- duplicadas do mesmo instalador (BEDEU aparece 4x, GERALDO 4x...).
-- Todas apontam para o mesmo prestador, e a credencial e por prestador,
-- entao o instalador continua com um login so.
create index if not exists ix_equipes_parket_prestador_id
  on public.equipes_parket (prestador_id)
  where prestador_id is not null;

comment on column public.equipes_parket.prestador_id is
  'Vinculo gravado com public.prestadores (base do app instala). Populado pelo backfill 016 e mantido pelo backend ao criar/editar equipe.';

-- ---------------------------------------------------------------------
-- 2) Credenciais do prestador
-- ---------------------------------------------------------------------

create table if not exists public.prestador_credenciais (
  -- 1 credencial por prestador; o proprio id do prestador e a PK
  prestador_id   uuid primary key references public.prestadores(id) on delete cascade,
  -- login no padrao nome.instalador@parket.com.br (case-insensitive no login)
  login          text not null,
  -- bcrypt (extensions.crypt + gen_salt('bf')): o que valida o login
  senha_hash     text not null,
  -- senha em claro: o Will pediu senha visivel na lista do gestao.
  -- So sai daqui via RPC/service_role, nunca pela anon key.
  senha_plain    text not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  -- email do usuario do gestao que gerou ou resetou (auditoria)
  atualizado_por text
);

-- Login e unico e comparado sem diferenciar maiuscula/minuscula
create unique index if not exists ux_prestador_credenciais_login
  on public.prestador_credenciais (lower(login));

-- RLS ligada e SEM policy nenhuma: anon e authenticated nao leem nada.
-- Acesso so por service_role (backend do gestao) ou pelas RPCs abaixo.
alter table public.prestador_credenciais enable row level security;

revoke all on public.prestador_credenciais from anon, authenticated;

comment on table public.prestador_credenciais is
  'Login e senha do prestador para instala.parket.works. RLS fechada de proposito: prestadores tem policy aberta e nao pode hospedar credencial.';

-- ---------------------------------------------------------------------
-- 3) RPC de login usada pelo app instala
-- ---------------------------------------------------------------------

create or replace function public.fn_instala_login_senha(p_login text, p_senha text)
returns table (id uuid, nome text, telefone text, categoria text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Valida o bcrypt dentro da funcao: o hash nunca sai para o cliente
  return query
  select p.id, p.nome, p.telefone, p.categoria
    from public.prestador_credenciais c
    join public.prestadores p on p.id = c.prestador_id
   where lower(c.login) = lower(trim(p_login))
     and c.ativo is true
     and coalesce(p.ativo, true) is true
     and c.senha_hash = extensions.crypt(p_senha, c.senha_hash)
   limit 1;
end;
$$;

-- O app usa a anon key, entao anon precisa poder chamar a RPC
grant execute on function public.fn_instala_login_senha(text, text) to anon, authenticated, service_role;

comment on function public.fn_instala_login_senha(text, text) is
  'Login do app instala por email+senha. Substitui fn_instala_login (PIN).';

-- ---------------------------------------------------------------------
-- 4) RPC de gerar/resetar senha usada pelo backend do gestao
-- ---------------------------------------------------------------------

create or replace function public.fn_prestador_set_senha(
  p_prestador_id uuid,
  p_login        text,
  p_senha        text,
  p_por          text default null
)
returns table (prestador_id uuid, login text, senha_plain text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Upsert: gerar acesso pela primeira vez e resetar senha usam o mesmo caminho
  insert into public.prestador_credenciais as c
    (prestador_id, login, senha_hash, senha_plain, atualizado_por)
  values
    (p_prestador_id, trim(p_login), extensions.crypt(p_senha, extensions.gen_salt('bf')), p_senha, p_por)
  -- Conflito pelo nome da constraint, não pela coluna: "prestador_id" solto
  -- casaria também com o OUT param da função (erro 42702 ambiguous).
  on conflict on constraint prestador_credenciais_pkey do update
    set login          = excluded.login,
        senha_hash     = excluded.senha_hash,
        senha_plain    = excluded.senha_plain,
        ativo          = true,
        atualizado_em  = now(),
        atualizado_por = excluded.atualizado_por;

  return query
  select c.prestador_id, c.login, c.senha_plain
    from public.prestador_credenciais c
   where c.prestador_id = p_prestador_id;
end;
$$;

-- Só o backend (service_role) gera ou reseta senha; anon nao encosta
revoke execute on function public.fn_prestador_set_senha(uuid, text, text, text) from anon, authenticated, public;
grant execute on function public.fn_prestador_set_senha(uuid, text, text, text) to service_role;

comment on function public.fn_prestador_set_senha(uuid, text, text, text) is
  'Gera ou reseta o acesso do prestador. Chamada pelo backend do gestao com service key.';
