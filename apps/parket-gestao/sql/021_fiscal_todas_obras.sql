-- 021_fiscal_todas_obras.sql — fiscal entra no instala com o login dele e enxerga toda obra.
--
-- Will: "os fiscais Davi, Cristiano e Alvaro devem ter acesso pelo app do
-- instala a todas as obras que eles quiserem fazer registro, como instalador"
-- e "com o mesmo login e senha de fiscal".
--
-- Duas coisas separadas resolvidas aqui:
--
-- 1) LOGIN. O instala autentica em prestador_credenciais (login + senha do
--    gestao.parket.works/equipes). O fiscal autentica no verifica.parket.works
--    pelo GoTrue, que é auth.users do MESMO projeto Cloud, com o vínculo
--    fiscal_equipe.user_id. Então fn_instala_login_senha ganha um segundo
--    caminho: se o e-mail/senha não bater em prestador_credenciais, tenta
--    auth.users + fiscal_equipe e devolve o prestador ligado àquele fiscal.
--    A credencial *.instalador@parket.com.br continua valendo; são dois
--    caminhos pro mesmo prestador, não uma troca.
--
-- 2) OBRAS. A lista do app sai de vw_instala_minhas_obras, que hoje é só
--    prestador_card (o que foi atribuído). Instalador continua assim. Quem tem
--    ve_todas_obras passa a enxergar também todo card de obra, marcado como
--    'aberto' na coluna nova `vinculo`. Isso é leitura pura: não cria linha em
--    prestador_card, então o fiscal não vira instalador da obra no gestão e
--    nada muda na tela Obras x Prestadores.
--
--    `vinculo` existe pra o app separar as duas coisas: tela de dinheiro e de
--    agenda ficam no 'atribuido'; tela de registro aceita as duas.

begin;

-- ── 1) Flag e vínculo do fiscal ───────────────────────────────────────────

alter table public.prestadores
  add column if not exists ve_todas_obras boolean not null default false;

-- Qual fiscal do verifica é este prestador. É por aqui que o login do fiscal
-- acha a linha de prestador que o instala usa em checkin, ocorrência, etc.
alter table public.prestadores
  add column if not exists fiscal_equipe_id uuid references public.fiscal_equipe(id);

update public.prestadores p
set fiscal_equipe_id = f.id,
    ve_todas_obras   = true,
    categoria        = 'Fiscal'
from public.fiscal_equipe f
where f.ativo
  and upper(btrim(f.nome)) = upper(btrim(p.nome))
  and p.categoria = 'FISCAL (teste)';

-- ── 2) Login: credencial do instala OU login de fiscal ────────────────────

drop function if exists public.fn_instala_login_senha(text, text);

create function public.fn_instala_login_senha(p_login text, p_senha text)
returns table(id uuid, nome text, telefone text, categoria text, ve_todas_obras boolean)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  -- Caminho 1: credencial própria do instala (gerada em /equipes).
  -- O bcrypt é conferido aqui dentro: o hash nunca sai para o cliente.
  return query
  select p.id, p.nome, p.telefone, p.categoria, p.ve_todas_obras
    from public.prestador_credenciais c
    join public.prestadores p on p.id = c.prestador_id
   where lower(c.login) = lower(trim(p_login))
     and c.ativo is true
     and coalesce(p.ativo, true) is true
     and c.senha_hash = extensions.crypt(p_senha, c.senha_hash)
   limit 1;
  if found then
    return;
  end if;

  -- Caminho 2: mesmo e-mail e senha do verifica.parket.works. O GoTrue guarda
  -- o bcrypt em auth.users.encrypted_password e fiscal_equipe.user_id diz qual
  -- fiscal é aquele usuário.
  return query
  select p.id, p.nome, p.telefone, p.categoria, p.ve_todas_obras
    from auth.users u
    join public.fiscal_equipe f on f.user_id = u.id and f.ativo is true
    join public.prestadores p   on p.fiscal_equipe_id = f.id
   where lower(u.email) = lower(trim(p_login))
     and u.encrypted_password is not null
     and u.encrypted_password = extensions.crypt(p_senha, u.encrypted_password)
     and coalesce(p.ativo, true) is true
   limit 1;
end;
$function$;

grant execute on function public.fn_instala_login_senha(text, text)
  to public, anon, authenticated, service_role;

-- ── 3) A view ganha o ramo "toda obra" e a coluna vinculo ─────────────────
--
-- Coluna nova entra no fim pra o CREATE OR REPLACE aceitar e os grants do anon
-- continuarem valendo.

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
 -- Ramo 1: o que foi atribuído ao prestador. Era a view inteira até aqui.
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

 -- Ramo 2: quem tem ve_todas_obras alcança qualquer card de obra. Coluna
 -- 'projeto' fica de fora: é lead que ainda não virou obra.
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
                     where pc.prestador_id = p.id and pc.card_id = kc.id);

commit;
