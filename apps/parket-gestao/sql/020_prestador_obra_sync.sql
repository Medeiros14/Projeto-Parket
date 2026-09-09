-- 020_prestador_obra_sync.sql — o instalador fica preso na obra, não no card de compras.
--
-- Contexto. O vínculo instalador<->obra vive em três lugares:
--   kanban_cards.details.prestadores[]                     (o que o gestão lê/escreve)
--   kanban_cards.details.cronograma_pmo.itens[].prestadores_ids[]  (quem faz cada frente)
--   public.prestador_card                                  (o que o app do instalador lê)
--
-- O card de compras é FILHO do card de obra (parent_card_id) e o trigger
-- fn_sync_card_details copia details entre pai e filho nos dois sentidos. Como
-- 'prestadores' e 'cronograma_pmo' não estão na lista de chaves excluídas, o
-- card de compras herda os prestadores da obra sozinho. Isso não é erro: é a
-- mesma obra vista pelo setor de compras.
--
-- O erro estava em prestador_card: o reconcile varria TODO card com
-- details.prestadores, inclusive os de compras, e criava uma linha pra cada.
-- Das 241 linhas, só 86 eram card de obra (operacional 78, projetos 6, obras 2).
-- As outras 155 eram card de compras (compras-taiara 95, compras 45) ou de
-- setor nenhum a ver (orcamento 5, financeiro, comercial, logistica...). Como
-- prestador_card é exatamente o que o instala.parket.works lista, o instalador
-- via o card de compras da obra. Ele não precisa ver isso.
--
-- Aqui a base é acertada em três passos. O lado do código (main.py) passa a
-- restringir reconcile/backfill aos departamentos de obra pra não voltar.

begin;

-- ── 1) Conserta os ids que o 018 deixou pendurados no cronograma ──────────
--
-- O 018 repontou details.prestadores[] pro sobrevivente do dedup, mas passou
-- batido em cronograma_pmo.itens[].prestadores_ids[]. Sobraram 8 referências a
-- linhas de equipes_parket que foram apagadas (ISMAEL, DIEGO JAILSON, DANY).

drop table if exists public._prest_mapa_020;

create table public._prest_mapa_020 as
select b.id as dead_id, e.id as keep_id
from public._equipes_backup_018 b
join public.equipes_parket e on e.prestador_id = b.prestador_id
where not exists (select 1 from public.equipes_parket x where x.id = b.id);

update public.kanban_cards k
set details = jsonb_set(
      k.details, '{cronograma_pmo,itens}',
      (select coalesce(jsonb_agg(
                case when jsonb_typeof(it->'prestadores_ids') = 'array'
                     then jsonb_set(it, '{prestadores_ids}',
                            (select coalesce(jsonb_agg(coalesce(to_jsonb(m.keep_id::text), pid)
                                                       order by o2), '[]'::jsonb)
                             from jsonb_array_elements(it->'prestadores_ids')
                                  with ordinality as u2(pid, o2)
                             left join public._prest_mapa_020 m
                                    on m.dead_id::text = (pid #>> '{}')))
                     else it end
                order by ord), '[]'::jsonb)
       from jsonb_array_elements(k.details->'cronograma_pmo'->'itens')
            with ordinality as u(it, ord))
    )
where jsonb_typeof(k.details->'cronograma_pmo'->'itens') = 'array'
  and exists (
    select 1
    from jsonb_array_elements(k.details->'cronograma_pmo'->'itens') it
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(it->'prestadores_ids') = 'array'
           then it->'prestadores_ids' else '[]'::jsonb end) pid
    join public._prest_mapa_020 m on m.dead_id::text = (pid #>> '{}'));

-- ── 2) O que o cronograma sabe entra em details.prestadores da obra ───────
--
-- Will: "a obra por exemplo Amauri tem o prestador X tanto lá no cronograma
-- quanto em equipes, deverá ter sincronizado o mesmo instalador." O cronograma
-- é a fonte de quem trabalha na obra, então quem aparece nele (na obra ou no
-- card de compras filho) tem que aparecer na lista de prestadores da obra.
--
-- id do prestador vem misturado da importação: umas vezes é equipes_parket.id,
-- outras é prestadores.id. Os dois resolvem pra mesma linha de equipes_parket,
-- que é o formato que o gestão grava.

drop table if exists public._prest_alvo_020;

create table public._prest_alvo_020 as
with base as (
  -- Card de compras responde pela obra do pai; card de obra responde por si.
  select k.id as card_id,
         case when k.dept_id in ('compras', 'compras-taiara')
              then k.parent_card_id else k.id end as obra_id,
         k.details
  from public.kanban_cards k
  where k.dept_id in ('compras', 'compras-taiara', 'operacional', 'obras', 'projetos')
),
brutos as (
  select b.obra_id, p->>'id' as raw
  from base b, jsonb_array_elements(b.details->'prestadores') p
  where jsonb_typeof(b.details->'prestadores') = 'array'
  union
  select b.obra_id, pid #>> '{}'
  from base b,
       jsonb_array_elements(b.details->'cronograma_pmo'->'itens') it,
       jsonb_array_elements(
         case when jsonb_typeof(it->'prestadores_ids') = 'array'
              then it->'prestadores_ids' else '[]'::jsonb end) pid
  where jsonb_typeof(b.details->'cronograma_pmo'->'itens') = 'array'
),
resolvidos as (
  select distinct br.obra_id, e.id as equipe_id, e.prestador_id,
         e.nome, e.telefone, e.categoria
  from brutos br
  join public.equipes_parket e
    on e.id::text = br.raw or e.prestador_id::text = br.raw
  where br.obra_id is not null and e.ativo
),
ja_tem as (
  -- Lista atual da obra, nas duas identidades possíveis.
  select k.id as obra_id, p->>'id' as raw
  from public.kanban_cards k, jsonb_array_elements(k.details->'prestadores') p
  where jsonb_typeof(k.details->'prestadores') = 'array'
)
select r.*
from resolvidos r
join public.kanban_cards ok on ok.id = r.obra_id
where ok.dept_id in ('operacional', 'obras', 'projetos')
  and not exists (
    select 1 from ja_tem j
    where j.obra_id = r.obra_id
      and j.raw in (r.equipe_id::text, r.prestador_id::text));

-- Anexa os que faltam no formato que o gestão grava (id da equipe).
update public.kanban_cards k
set details = jsonb_set(
      coalesce(k.details, '{}'::jsonb), '{prestadores}',
      coalesce(k.details->'prestadores', '[]'::jsonb) || novos.entradas)
from (
  select obra_id,
         jsonb_agg(jsonb_build_object(
           'id',        equipe_id::text,
           'nome',      nome,
           'telefone',  telefone,
           'categoria', categoria)) as entradas
  from public._prest_alvo_020
  group by obra_id
) novos
where k.id = novos.obra_id;

-- ── 3) Instalador não vê card de compras ─────────────────────────────────
--
-- prestador_card é a lista de obras do app do instalador. Card de compras sai.
-- O vínculo não se perde: o card de obra pai continua lá.

delete from public.prestador_card pc
using public.kanban_cards k
where k.id = pc.card_id
  and k.dept_id not in ('operacional', 'obras', 'projetos');

drop table public._prest_mapa_020;
drop table public._prest_alvo_020;

commit;
