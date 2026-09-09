-- 029_instala_fiscal_obras_dele.sql : fiscal enxerga TODAS as obras dele no instala.
--
-- Will 08/09: "O fiscal davi tem acesso ao instala.parket.works precisa ter
-- acesso como de instalador igual o do alvaro aparecendo todas as obras dele,
-- ele esta sinalizando que a obra do Bernardo Amaral nao esta funcionando".
--
-- POR QUE a obra do Bernardo Amaral nao aparecia: o card vinculado ao gestao
-- (ceb73dff) esta em dept 'orcamento', coluna 'handoff-com'. O ramo 'atribuido'
-- da view exige linha em prestador_card (Davi nao tem nesse card) e o ramo
-- 'aberto' so alcanca dept operacional/obras/projetos, alem de o app ainda
-- cortar a lista da empresa pra coluna 'acompanhamento'. Ou seja: nenhum fiscal
-- veria essa obra, nem o Alvaro.
--
-- O QUE muda: a view ganha um ramo 3, "obras onde EU sou o fiscal". O vinculo
-- fiscal <-> card ja existe em kanban_cards.details.fiscais (array de
-- {id: fiscal_equipe.id, nome}) e prestadores.fiscal_equipe_id liga o prestador
-- do instala ao fiscal do verifica. Essas obras entram com vinculo 'atribuido',
-- entao caem na lista principal "ATRIBUIDAS A VOCE" do app, igual instalador,
-- em qualquer dept e qualquer coluna (so archived fica fora). Nenhum deploy do
-- instala-app e necessario: o Hoje.tsx ja consome vinculo='atribuido'.
--
-- O ramo 2 ('aberto') passa a EXCLUIR os cards onde o prestador e o fiscal,
-- senao a mesma obra apareceria nas duas listas do app.
--
-- Vale automatico pra todos os fiscais com fiscal_equipe_id preenchido
-- (Davi 99 cards, Alvaro 126, Cristiano 57, Marcus 51, Ramon 18 em 08/09).
--
-- Colunas identicas as da 021 (CREATE OR REPLACE preserva grants do anon).

begin;

create or replace view public.vw_instala_minhas_obras as
 with agg as (
         select pos.obra_id,
            sum(pos.contrato_qtd) as contrato_total,
            sum(coalesce(( select sum(iic.qtd_concluida) as sum
                   from instala_item_checks iic
                  where iic.servico_id = pos.id), 0::numeric)) as instalado_total
           from prestadores_obra_servicos pos
          group by pos.obra_id
        )
 -- Ramo 1: o que foi atribuido ao prestador em prestador_card (inalterado).
 select pc.id as atribuicao_id,
    pc.prestador_id,
    pc.card_id,
    coalesce(pc.data_entrada, kc.created_at::date) as data_prevista_inicio,
    null::date as data_prevista_fim,
    nullif(kc.details ->> 'hora_inicio'::text, ''::text)::time without time zone as hora_prevista_inicio,
    false as lead_prestador,
        case
            when (exists ( select 1
               from instala_checkins ic
              where ic.prestador_id = pc.prestador_id and ic.card_id = pc.card_id and ic.status = 'aberto'::text and ic.created_at::date = current_date)) then 'presente'::text
            when (exists ( select 1
               from instala_checkins ic
              where ic.prestador_id = pc.prestador_id and ic.card_id = pc.card_id and ic.created_at::date = current_date)) then 'finalizado'::text
            else null::text
        end as presenca_status,
    null::timestamp with time zone as confirmado_em,
    'ativo'::text as atribuicao_status,
    kc.obra as obra_code,
    coalesce(kc.title, '-'::text) as cliente_nome,
    kc.details ->> 'cidade'::text as cidade,
        case
            when coalesce(agg.contrato_total, 0::numeric) > 0::numeric then least(100::numeric, round(agg.instalado_total / agg.contrato_total * 100::numeric))::integer
            else coalesce(kc.progress, 0)
        end as progress_atual,
    kc.column_id as card_column,
    pc.observacao,
    coalesce(nullif(btrim(kc.details ->> 'endereco'::text), ''::text), nullif(btrim(kc.details ->> 'endereco_obra'::text), ''::text)) as endereco,
    coalesce(nullif(btrim(kc.details ->> 'arquiteto'::text), ''::text), nullif(
        case
            when btrim(coalesce(kc.details ->> 'arquitetura'::text, ''::text)) ~* '^vendedor'::text then ''::text
            else btrim(coalesce(kc.details ->> 'arquitetura'::text, ''::text))
        end, ''::text)) as arquiteto,
    coalesce(nullif(btrim(kc.details ->> 'fiscal_responsavel'::text), ''::text), nullif(btrim(kc.details ->> 'fiscal'::text), ''::text)) as fiscal,
    'atribuido'::text as vinculo
   from prestador_card pc
     join kanban_cards kc on kc.id = pc.card_id
     left join agg on agg.obra_id = kc.obra
  where kc.dept_id !~~* '%archived%'::text

union all

 -- Ramo 2: quem tem ve_todas_obras alcanca qualquer card de obra. Coluna
 -- 'projeto' fica de fora (lead que ainda nao virou obra). NOVO na 029: cards
 -- onde o prestador e o fiscal saem daqui, porque agora entram pelo ramo 3
 -- como 'atribuido' (evita a mesma obra nas duas listas do app).
 select md5(p.id::text || kc.id::text)::uuid as atribuicao_id,
    p.id as prestador_id,
    kc.id as card_id,
    kc.created_at::date as data_prevista_inicio,
    null::date as data_prevista_fim,
    nullif(kc.details ->> 'hora_inicio'::text, ''::text)::time without time zone as hora_prevista_inicio,
    false as lead_prestador,
        case
            when (exists ( select 1
               from instala_checkins ic
              where ic.prestador_id = p.id and ic.card_id = kc.id and ic.status = 'aberto'::text and ic.created_at::date = current_date)) then 'presente'::text
            when (exists ( select 1
               from instala_checkins ic
              where ic.prestador_id = p.id and ic.card_id = kc.id and ic.created_at::date = current_date)) then 'finalizado'::text
            else null::text
        end as presenca_status,
    null::timestamp with time zone as confirmado_em,
    'ativo'::text as atribuicao_status,
    kc.obra as obra_code,
    coalesce(kc.title, '-'::text) as cliente_nome,
    kc.details ->> 'cidade'::text as cidade,
        case
            when coalesce(agg.contrato_total, 0::numeric) > 0::numeric then least(100::numeric, round(agg.instalado_total / agg.contrato_total * 100::numeric))::integer
            else coalesce(kc.progress, 0)
        end as progress_atual,
    kc.column_id as card_column,
    null::text as observacao,
    coalesce(nullif(btrim(kc.details ->> 'endereco'::text), ''::text), nullif(btrim(kc.details ->> 'endereco_obra'::text), ''::text)) as endereco,
    coalesce(nullif(btrim(kc.details ->> 'arquiteto'::text), ''::text), nullif(
        case
            when btrim(coalesce(kc.details ->> 'arquitetura'::text, ''::text)) ~* '^vendedor'::text then ''::text
            else btrim(coalesce(kc.details ->> 'arquitetura'::text, ''::text))
        end, ''::text)) as arquiteto,
    coalesce(nullif(btrim(kc.details ->> 'fiscal_responsavel'::text), ''::text), nullif(btrim(kc.details ->> 'fiscal'::text), ''::text)) as fiscal,
    'aberto'::text as vinculo
   from prestadores p
     cross join kanban_cards kc
     left join agg on agg.obra_id = kc.obra
  where p.ve_todas_obras
    and coalesce(p.ativo, true)
    and kc.dept_id in ('operacional', 'obras', 'projetos')
    and coalesce(kc.column_id, ''::text) <> 'projeto'::text
    and not exists (select 1 from prestador_card pc
                     where pc.prestador_id = p.id and pc.card_id = kc.id)
    and not (p.fiscal_equipe_id is not null and exists (
          select 1
            from jsonb_array_elements(
                   case when jsonb_typeof(kc.details -> 'fiscais') = 'array'
                        then kc.details -> 'fiscais'
                        else '[]'::jsonb end) f
           where f ->> 'id' = p.fiscal_equipe_id::text))

union all

 -- Ramo 3 (novo): obras onde EU sou o fiscal (details.fiscais do card contem o
 -- fiscal_equipe_id do prestador). Entram como 'atribuido' pra cair na lista
 -- principal do app, em qualquer dept/coluna que nao seja archived. O guard de
 -- jsonb_typeof evita erro se details.fiscais nao for array. O prefixo 'fiscal'
 -- no md5 evita colidir com o atribuicao_id sintetico do ramo 2. prestador_card
 -- ganha do ramo 3: se um dia o fiscal for atribuido de verdade, vale o ramo 1.
 select md5('fiscal'::text || p.id::text || kc.id::text)::uuid as atribuicao_id,
    p.id as prestador_id,
    kc.id as card_id,
    kc.created_at::date as data_prevista_inicio,
    null::date as data_prevista_fim,
    nullif(kc.details ->> 'hora_inicio'::text, ''::text)::time without time zone as hora_prevista_inicio,
    false as lead_prestador,
        case
            when (exists ( select 1
               from instala_checkins ic
              where ic.prestador_id = p.id and ic.card_id = kc.id and ic.status = 'aberto'::text and ic.created_at::date = current_date)) then 'presente'::text
            when (exists ( select 1
               from instala_checkins ic
              where ic.prestador_id = p.id and ic.card_id = kc.id and ic.created_at::date = current_date)) then 'finalizado'::text
            else null::text
        end as presenca_status,
    null::timestamp with time zone as confirmado_em,
    'ativo'::text as atribuicao_status,
    kc.obra as obra_code,
    coalesce(kc.title, '-'::text) as cliente_nome,
    kc.details ->> 'cidade'::text as cidade,
        case
            when coalesce(agg.contrato_total, 0::numeric) > 0::numeric then least(100::numeric, round(agg.instalado_total / agg.contrato_total * 100::numeric))::integer
            else coalesce(kc.progress, 0)
        end as progress_atual,
    kc.column_id as card_column,
    null::text as observacao,
    coalesce(nullif(btrim(kc.details ->> 'endereco'::text), ''::text), nullif(btrim(kc.details ->> 'endereco_obra'::text), ''::text)) as endereco,
    coalesce(nullif(btrim(kc.details ->> 'arquiteto'::text), ''::text), nullif(
        case
            when btrim(coalesce(kc.details ->> 'arquitetura'::text, ''::text)) ~* '^vendedor'::text then ''::text
            else btrim(coalesce(kc.details ->> 'arquitetura'::text, ''::text))
        end, ''::text)) as arquiteto,
    coalesce(nullif(btrim(kc.details ->> 'fiscal_responsavel'::text), ''::text), nullif(btrim(kc.details ->> 'fiscal'::text), ''::text)) as fiscal,
    'atribuido'::text as vinculo
   from prestadores p
     join kanban_cards kc on exists (
          select 1
            from jsonb_array_elements(
                   case when jsonb_typeof(kc.details -> 'fiscais') = 'array'
                        then kc.details -> 'fiscais'
                        else '[]'::jsonb end) f
           where f ->> 'id' = p.fiscal_equipe_id::text)
     left join agg on agg.obra_id = kc.obra
  where p.fiscal_equipe_id is not null
    and coalesce(p.ativo, true)
    and kc.dept_id !~~* '%archived%'::text
    and not exists (select 1 from prestador_card pc
                     where pc.prestador_id = p.id and pc.card_id = kc.id);

commit;
