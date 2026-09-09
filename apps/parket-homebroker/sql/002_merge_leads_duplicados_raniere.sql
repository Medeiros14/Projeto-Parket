-- Fusao de leads duplicados do Raniere Brito (7 clientes, 31/08/2026).
--
-- Mesmo padrao do 001, agora com dois vetores de duplicacao misturados:
--   a) formulario manual do HB por cima de um lead que ja existia (Alexia,
--      Clayton, Frederico, Rafael, Sammy, Stefanie);
--   b) card de reativacao de leads frios criado por cima do lead original
--      (Ricardo Dorea).
-- Em Alexia, Clayton e Stefanie ainda ha um terceiro card: o WhatsApp abriu
-- dois cards pro mesmo telefone antes do formulario manual.
--
-- Sobrevive sempre o card mais antigo do lead, que e onde moram o created_at
-- real (base do CAC e do relatorio por vendedor), o historico de card_events e
-- a conversa da Teka. Os duplicados entram por baixo no details: o sobrevivente
-- vence nos campos em conflito e so ganha o que nao tinha (cidade, endereco,
-- arquiteto, e o marcador de qualificacao ja enviado pro Meta CAPI).
--
-- Quando ha dois duplicados, a ordem importa: o card de WhatsApp e aplicado
-- antes do formulario manual, entao o telefone normalizado do lead vence o
-- telefone digitado a mao.
--
-- card_movements nao aparece aqui: e view sobre card_events nos dois bancos.
-- Rodar tambem no PG local, senao o sync traz os duplicados de volta.

begin;

create table if not exists public._hb_merge_backup (
  merged_at          timestamptz not null default now(),
  motivo             text,
  survivor_id        uuid,
  dup_id             uuid,
  dup_row            jsonb,
  survivor_row_antes jsonb
);

do $mg$
declare
  r     record;
  v_dup jsonb;
  v_sur jsonb;
begin
  for r in
    select *
      from (values
        -- ord  sobrevivente (lead original)                  duplicado                                      coluna final             vendedor
        ( 1, '544c3c0c-12cd-4747-8561-0620923af0f0'::uuid, 'efc01bbe-40f3-49b8-9a11-df1b66b77b87'::uuid, 'apresentacao-proposta', 'Raniere Brito'), -- Alexia: 2o card WhatsApp
        ( 2, '544c3c0c-12cd-4747-8561-0620923af0f0'::uuid, '3ba93c7b-897e-4f73-ba55-d90e45174021'::uuid, 'apresentacao-proposta', 'Raniere Brito'), -- Alexia: form manual
        ( 3, '54563af2-5be2-40d5-870d-4284a2068fe3'::uuid, '31bb6654-d651-42f5-bce3-71c6b1faf3b1'::uuid, 'apresentacao-proposta', 'Raniere Brito'), -- Clayton: 2o card WhatsApp
        ( 4, '54563af2-5be2-40d5-870d-4284a2068fe3'::uuid, 'b296df2d-b80e-4510-947e-5bda633aa82d'::uuid, 'apresentacao-proposta', 'Raniere Brito'), -- Clayton: form manual
        ( 5, '94c1dcb8-7be8-48ad-8819-4560f5c762d8'::uuid, '9d9fb823-61f1-4662-b5b7-1175d2d88b76'::uuid, 'apresentacao-proposta', 'Raniere Brito'), -- Frederico: form manual (telefone da arquiteta)
        ( 6, 'a8d91bba-8a1f-48ac-87cb-4cd34693c9d0'::uuid, '98f047a6-7339-4231-afc2-7a67a6b2b776'::uuid, 'apresentacao-proposta', 'Raniere Brito'), -- Rafael: form manual
        ( 7, '1dd12b39-eab5-4b09-a97a-48d326af1cf3'::uuid, 'da7dc625-4af4-496d-a4ba-34cf888f65b1'::uuid, 'contato-inicial',       'Raniere Brito'), -- Ricardo: card de reativacao
        ( 8, 'b3dc2509-af11-4ed4-8fed-0c5507170619'::uuid, '4d77fc13-7bd9-4b38-b833-d7f41b291063'::uuid, 'novas-oportunidades',   'Raniere Brito'), -- Sammy: form manual
        ( 9, 'e5894f79-f247-4e5e-ae6e-6d3ada244d36'::uuid, '5dec1a81-565c-4c86-b9f5-a06ae6092bd5'::uuid, 'apresentacao-proposta', 'Raniere Brito'), -- Stefanie: 2o card WhatsApp
        (10, 'e5894f79-f247-4e5e-ae6e-6d3ada244d36'::uuid, '7b8b3704-ec66-4497-bee4-c8ebc2533a74'::uuid, 'apresentacao-proposta', 'Raniere Brito')  -- Stefanie: form manual
      ) as t(ord, survivor, dup, coluna_final, vendedor)
     order by ord
  loop
    -- Idempotente: se o dup ja sumiu, a fusao dessa dupla ja rodou.
    continue when not exists (select 1 from kanban_cards where id = r.dup);

    select to_jsonb(k) into v_dup from kanban_cards k where id = r.dup;
    select to_jsonb(k) into v_sur from kanban_cards k where id = r.survivor;

    insert into public._hb_merge_backup (motivo, survivor_id, dup_id, dup_row, survivor_row_antes)
    values ('lead duplicado HB Raniere Brito', r.survivor, r.dup, v_dup, v_sur);

    -- Proposta, historico e conversa passam a apontar pro sobrevivente.
    update simulacao_projetos set card_comercial_id = r.survivor where card_comercial_id = r.dup;
    update card_events         set card_id          = r.survivor where card_id          = r.dup;
    update whatsapp_messages   set card_id          = r.survivor where card_id          = r.dup;

    update kanban_cards k
       set details =
             -- dup por baixo: preenche buracos sem sobrescrever o que o lead ja
             -- tinha. strip_nulls evita herdar campo vazio do formulario manual.
             jsonb_strip_nulls(coalesce(v_dup->'details', '{}'::jsonb))
             || coalesce(k.details, '{}'::jsonb)
             || jsonb_build_object(
                  'vendedor', r.vendedor,
                  -- Card cru do duplicado fica junto: nada se perde.
                  'merged_from',
                    coalesce(k.details->'merged_from', '[]'::jsonb)
                    || jsonb_build_array(jsonb_build_object('card_id', r.dup, 'merged_at', now(), 'row', v_dup))
                ),
           -- Assume o ponto mais avancado que o grupo alcancou no funil.
           column_id = r.coluna_final
     where k.id = r.survivor;

    delete from kanban_cards where id = r.dup;
  end loop;
end
$mg$;

commit;
