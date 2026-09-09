-- 018_equipes_dedup.sql — uma linha por prestador em equipes_parket.
--
-- A tabela nasceu de uma importação em que cada frente de trabalho virava uma
-- linha própria: GERALDO aparecia 4x (Piso, Escada, Deck, Forro/Painel), sempre
-- com o mesmo prestador_id e o mesmo telefone. Como a tela /equipes agrupa por
-- categoria, o mesmo instalador aparecia em 4 grupos diferentes.
--
-- Aqui as linhas do mesmo prestador viram uma só:
--   categorias  = todas as frentes que ele atende (array novo)
--   categoria   = a principal, primeira da ordem canônica abaixo. Continua
--                 sendo o que agrupa a lista, então o agrupamento segue limpo.
-- Os contadores de check são somados porque estavam repartidos entre as linhas
-- (DANY tinha 14 numa e 8 na outra) e pct_ok é recalculado sobre o total.
--
-- No fim entra um índice único por prestador_id pra a duplicata não voltar.
-- Ele é parcial: linha recém-criada pela tela ainda tem prestador_id nulo e o
-- resolver só preenche depois de casar com a base do instala.

begin;

alter table public.equipes_parket
  add column if not exists categorias text[];

-- Staging concreta (e não temp table) porque a migração roda por HTTP na
-- Management API, onde a sessão não é garantida entre statements.
drop table if exists public._equipes_merge_018;

create table public._equipes_merge_018 as
with ordem(categoria, ord) as (
  values ('Piso', 1), ('Deck', 2), ('Escada', 3), ('Estrutura', 4),
         ('Marcenaria', 5), ('Marcenaria Acabamento', 6), ('Acabamento', 7),
         ('Forro/Painel Revestimento', 8), ('Brasilia Instalação/Marcenaria', 9),
         ('Reparo', 10), ('Terceiro Salvador', 11), ('Orçamentista', 12),
         ('Simulação Teste', 99)
)
select
  e.prestador_id,
  -- Sobrevivente e categoria principal: melhor posição da ordem canônica,
  -- id como desempate (created_at é idêntico, veio tudo do mesmo import).
  (array_agg(e.id       order by coalesce(o.ord, 50), e.id))[1] as keep_id,
  (array_agg(e.categoria order by coalesce(o.ord, 50), e.id))[1] as categoria,
  (array_agg(e.categoria order by coalesce(o.ord, 50), e.id))    as cats_ordenadas,
  (array_remove(array_agg(e.telefone), null))[1]  as telefone,
  (array_remove(array_agg(e.cnpj_cpf), null))[1]  as cnpj_cpf,
  (array_remove(array_agg(e.endereco), null))[1]  as endereco,
  (array_remove(array_agg(e.email),    null))[1]  as email,
  (array_remove(array_agg(e.foto_url), null))[1]  as foto_url,
  (array_remove(array_agg(e.bloqueado_em),    null))[1] as bloqueado_em,
  (array_remove(array_agg(e.bloqueado_por),   null))[1] as bloqueado_por,
  (array_remove(array_agg(e.bloqueio_motivo), null))[1] as bloqueio_motivo,
  bool_or(e.ativo)                     as ativo,
  sum(coalesce(e.total_checks, 0))     as total_checks,
  sum(coalesce(e.total_ok, 0))         as total_ok,
  sum(coalesce(e.total_ocorrencias, 0)) as total_ocorrencias,
  sum(coalesce(e.total_sem_resposta, 0)) as total_sem_resposta,
  sum(coalesce(e.dias_verificados, 0)) as dias_verificados,
  sum(coalesce(e.obras_distintas, 0))  as obras_distintas,
  max(e.ultimo_check)                  as ultimo_check
from public.equipes_parket e
left join ordem o on o.categoria = e.categoria
where e.prestador_id is not null
group by e.prestador_id;

-- Mapa id-que-morre -> id-que-fica, base do repontamento e do delete.
drop table if exists public._equipes_mapa_018;

create table public._equipes_mapa_018 as
select e.id as dead_id, m.keep_id
from public.equipes_parket e
join public._equipes_merge_018 m on m.prestador_id = e.prestador_id
where e.id <> m.keep_id;

-- 1) Consolida no sobrevivente. categorias sai deduplicado mantendo a ordem
-- canônica (primeira aparição de cada frente no array agregado).
update public.equipes_parket e
set categoria          = m.categoria,
    categorias         = d.cats,
    telefone           = coalesce(e.telefone, m.telefone),
    cnpj_cpf           = coalesce(e.cnpj_cpf, m.cnpj_cpf),
    endereco           = coalesce(e.endereco, m.endereco),
    email              = coalesce(e.email,    m.email),
    foto_url           = coalesce(e.foto_url, m.foto_url),
    bloqueado_em       = coalesce(e.bloqueado_em,    m.bloqueado_em),
    bloqueado_por      = coalesce(e.bloqueado_por,   m.bloqueado_por),
    bloqueio_motivo    = coalesce(e.bloqueio_motivo, m.bloqueio_motivo),
    ativo              = m.ativo,
    total_checks       = m.total_checks,
    total_ok           = m.total_ok,
    total_ocorrencias  = m.total_ocorrencias,
    total_sem_resposta = m.total_sem_resposta,
    dias_verificados   = m.dias_verificados,
    obras_distintas    = m.obras_distintas,
    ultimo_check       = m.ultimo_check,
    pct_ok             = case when m.total_checks > 0
                              then round(100.0 * m.total_ok / m.total_checks, 1)
                              else 0 end,
    updated_at         = now()
from public._equipes_merge_018 m
cross join lateral (
  select array_agg(c order by primeira) as cats
  from (
    select c, min(i) as primeira
    from unnest(m.cats_ordenadas) with ordinality as u(c, i)
    group by c
  ) z
) d
where e.id = m.keep_id;

-- 2) Cards que citam um id que vai sumir passam a citar o sobrevivente.
-- São vínculos antigos, de antes do trigger normalizar details.prestadores
-- pro id da base do instala. Sem isso o instalador some do card.
update public.kanban_cards k
set details = jsonb_set(
      k.details, '{prestadores}',
      (select coalesce(jsonb_agg(
                 case when mp.keep_id is not null
                      then jsonb_set(p, '{id}', to_jsonb(mp.keep_id::text))
                      else p end
                 order by ord), '[]'::jsonb)
       from jsonb_array_elements(k.details->'prestadores') with ordinality as u(p, ord)
       left join public._equipes_mapa_018 mp on mp.dead_id::text = p->>'id'))
where jsonb_typeof(k.details->'prestadores') = 'array'
  and exists (
    select 1 from jsonb_array_elements(k.details->'prestadores') p
    join public._equipes_mapa_018 mp on mp.dead_id::text = p->>'id');

-- 3) Histórico do prestador segue apontando pra linha que fica.
update public.prestador_termos t
set equipe_id = m.keep_id from public._equipes_mapa_018 m where t.equipe_id = m.dead_id;

update public.prestador_avaliacoes a
set equipe_id = m.keep_id from public._equipes_mapa_018 m where a.equipe_id = m.dead_id;

update public.prestador_eventos v
set equipe_id = m.keep_id from public._equipes_mapa_018 m where v.equipe_id = m.dead_id;

-- 4) Some com as linhas extras.
delete from public.equipes_parket e
using public._equipes_mapa_018 m
where e.id = m.dead_id;

-- 5) Quem nunca teve prestador_id fica com categorias coerente mesmo assim.
update public.equipes_parket
set categorias = array[categoria]
where categorias is null and categoria is not null;

-- 6) Trava: um prestador, uma linha. Substitui o índice não único do 016.
drop index if exists public.ix_equipes_parket_prestador_id;

create unique index if not exists ux_equipes_parket_prestador_id
  on public.equipes_parket (prestador_id)
  where prestador_id is not null;

drop table public._equipes_merge_018;
drop table public._equipes_mapa_018;

commit;
