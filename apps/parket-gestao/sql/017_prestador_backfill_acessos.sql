-- =====================================================================
-- 017_prestador_backfill_acessos.sql
-- Banco: Supabase Cloud hbxpilrxmitvzebluoom (Valor)
--
-- O QUE FAZ (roda uma vez, mas e idempotente):
--   Passo 1: vincula equipes_parket -> prestadores por telefone (so digitos)
--   Passo 2: vincula o que sobrou por nome normalizado (sem acento/caixa)
--   Passo 3: cria prestador novo para a equipe que nao casou com ninguem
--            (autorizado pelo Will) e ja vincula
--   Passo 4: gera login e senha para todo prestador ativo que ainda nao tem
--            login  = <primeiro-nome>.instalador@parket.com.br
--            senha  = <primeiro-nome>@parket2026
--            colisao de primeiro nome vira <nome><sobrenome>.instalador@...
--
-- equipes_parket tem linhas duplicadas do mesmo instalador (BEDEU 4x,
-- GERALDO 4x, ANDERSON 3x...). Todas as copias apontam para o MESMO
-- prestador; a credencial e por prestador, entao ele tem um login so.
--
-- Replica a logica do resolver do backend (main.py _resolve_prestador_id),
-- mas grava o resultado em vez de adivinhar a cada request.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: normaliza nome (sem acento, minusculo, so letras e espaco)
-- ---------------------------------------------------------------------
create or replace function public.fn_norm_nome(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(regexp_replace(lower(public.unaccent(coalesce(p,''))), '[^a-z0-9 ]', ' ', 'g'));
$$;

-- ---------------------------------------------------------------------
-- Passo 1: match por telefone (so digitos, minimo 8 para evitar lixo)
-- rn_e garante que cada equipe pega no maximo um prestador
-- ---------------------------------------------------------------------
with cand as (
  select e.id as eq_id,
         p.id as pr_id,
         row_number() over (partition by e.id order by p.created_at nulls last, p.id) as rn_e
    from public.equipes_parket e
    join public.prestadores p
      on regexp_replace(coalesce(p.telefone,''), '\D', '', 'g')
       = regexp_replace(coalesce(e.telefone,''), '\D', '', 'g')
   where e.prestador_id is null
     and length(regexp_replace(coalesce(e.telefone,''), '\D', '', 'g')) >= 8
)
update public.equipes_parket e
   set prestador_id = c.pr_id
  from cand c
 where e.id = c.eq_id and c.rn_e = 1;

-- ---------------------------------------------------------------------
-- Passo 2: match por nome normalizado
-- ---------------------------------------------------------------------
with cand as (
  select e.id as eq_id,
         p.id as pr_id,
         row_number() over (partition by e.id order by p.created_at nulls last, p.id) as rn_e
    from public.equipes_parket e
    join public.prestadores p
      on public.fn_norm_nome(p.nome) = public.fn_norm_nome(e.nome)
   where e.prestador_id is null
     and public.fn_norm_nome(e.nome) <> ''
)
update public.equipes_parket e
   set prestador_id = c.pr_id
  from cand c
 where e.id = c.eq_id and c.rn_e = 1;

-- ---------------------------------------------------------------------
-- Passo 3: equipe orfa vira prestador novo
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_id uuid;
begin
  for r in
    select id, nome, telefone, categoria
      from public.equipes_parket
     where prestador_id is null
       and coalesce(trim(nome),'') <> ''
  loop
    -- prestadores.nome e unico: se ja existe alguem com esse nome, reusa
    select id into v_id from public.prestadores where nome = trim(r.nome) limit 1;

    if v_id is null then
      insert into public.prestadores (nome, telefone, categoria, ativo)
      values (trim(r.nome), r.telefone, r.categoria, true)
      returning id into v_id;
    end if;

    update public.equipes_parket set prestador_id = v_id where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Passo 4: gera acesso para todo prestador ativo sem credencial
-- ---------------------------------------------------------------------
do $$
declare
  r          record;
  v_tokens   text[];
  v_base     text;
  v_login    text;
  v_senha    text;
  v_try      int;
begin
  for r in
    select p.id, p.nome
      from public.prestadores p
     where coalesce(p.ativo, true) is true
       and coalesce(trim(p.nome),'') <> ''
       and not exists (select 1 from public.prestador_credenciais c where c.prestador_id = p.id)
     order by p.created_at nulls last, p.id
  loop
    -- "Ailton Souza Lima" -> {ailton,souza,lima}
    v_tokens := regexp_split_to_array(public.fn_norm_nome(r.nome), '\s+');
    v_base   := replace(v_tokens[1], ' ', '');
    if v_base = '' then
      continue;
    end if;

    -- senha sempre pelo primeiro nome, do jeito que o Will pediu
    v_senha := v_base || '@parket2026';

    -- login: primeiro nome; se ja existe, gruda o proximo sobrenome
    v_login := v_base || '.instalador@parket.com.br';
    v_try   := 2;
    while exists (select 1 from public.prestador_credenciais c where lower(c.login) = v_login) loop
      if v_tokens[v_try] is not null then
        v_base  := v_base || v_tokens[v_try];
        v_login := v_base || '.instalador@parket.com.br';
        v_try   := v_try + 1;
      else
        -- acabaram os sobrenomes: sufixo numerico
        v_login := v_base || (v_try - 1)::text || '.instalador@parket.com.br';
        v_try   := v_try + 1;
      end if;
    end loop;

    insert into public.prestador_credenciais
      (prestador_id, login, senha_hash, senha_plain, atualizado_por)
    values
      (r.id, v_login, extensions.crypt(v_senha, extensions.gen_salt('bf')), v_senha, 'backfill-017');
  end loop;
end $$;
