-- Fusao de leads duplicados no Homebroker (Romualdo Lopes e Breno Oliveira, 31/08/2026).
--
-- Os dois casos tem o mesmo padrao: o lead chegou pelo WhatsApp e a Teka criou o
-- card automaticamente; dias depois alguem preencheu o formulario manual do HB e
-- gerou um SEGUNDO card pro mesmo telefone, que foi o card levado pra proposta.
-- Resultado: a conversa e a analise de IA ficam num card e a proposta no outro.
--
-- Quem sobrevive e sempre o card original do WhatsApp, porque nele moram o
-- created_at real do lead (base do CAC e do relatorio por vendedor), o historico
-- de eventos, e o qualified_event_id ja enviado pro Meta CAPI. Apagar esse card
-- quebraria a atribuicao. O card manual entra por baixo no details: o
-- sobrevivente vence nos campos em conflito e so ganha o que nao tinha
-- (endereco, cidade, produto de interesse).
--
-- Rodar tambem no PG local: o sync de kanban_cards traz o duplicado de volta se
-- o espelho local ficar sujo.

begin;

-- Backup antes de qualquer escrita. E o que torna a fusao reversivel.
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
        -- sobrevivente (lead WhatsApp)                dup (card manual)                          coluna final             vendedora
        ('492cacec-22fe-4e8f-80e2-c68f46c9cc0b'::uuid, '3e908994-71dc-4b28-a023-43b7a99cc9bc'::uuid, 'apresentacao-proposta', 'Sueli Jorge'),
        ('0eb697bf-101c-4d0b-ae60-8fad729aca05'::uuid, 'edf08bbe-0ef1-4d76-bb7e-896508966255'::uuid, 'apresentacao-proposta', 'Sueli Jorge')
      ) as t(survivor, dup, coluna_final, vendedora)
  loop
    -- Idempotente: se o dup ja sumiu, a fusao dessa dupla ja rodou.
    continue when not exists (select 1 from kanban_cards where id = r.dup);

    select to_jsonb(k) into v_dup from kanban_cards k where id = r.dup;
    select to_jsonb(k) into v_sur from kanban_cards k where id = r.survivor;

    insert into public._hb_merge_backup (motivo, survivor_id, dup_id, dup_row, survivor_row_antes)
    values ('lead duplicado HB: card manual por cima de lead WhatsApp', r.survivor, r.dup, v_dup, v_sur);

    -- A proposta e o historico passam a apontar pro sobrevivente.
    -- card_movements nao entra aqui: e view por cima de card_events, anda junto.
    update simulacao_projetos set card_comercial_id = r.survivor where card_comercial_id = r.dup;
    update card_events         set card_id          = r.survivor where card_id          = r.dup;

    update kanban_cards k
       set details =
             -- dup por baixo: preenche buracos sem sobrescrever o que o lead ja
             -- tinha. strip_nulls evita herdar campo vazio do formulario manual.
             jsonb_strip_nulls(coalesce(v_dup->'details', '{}'::jsonb))
             || coalesce(k.details, '{}'::jsonb)
             || jsonb_build_object(
                  -- O details do card manual trazia o vendedor errado (quem
                  -- preencheu o form). Os dois leads sao da Sueli.
                  'vendedor', r.vendedora,
                  -- Card cru do duplicado fica junto: nada se perde.
                  'merged_from',
                    coalesce(k.details->'merged_from', '[]'::jsonb)
                    || jsonb_build_array(jsonb_build_object('card_id', r.dup, 'merged_at', now(), 'row', v_dup))
                ),
           -- Assume o ponto mais avancado que a dupla alcancou no funil.
           column_id = r.coluna_final
     where k.id = r.survivor;

    delete from kanban_cards where id = r.dup;
  end loop;
end
$mg$;

commit;
