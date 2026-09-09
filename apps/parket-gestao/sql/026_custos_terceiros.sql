-- =====================================================================
-- 026_custos_terceiros.sql
-- Banco: Postgres LOCAL (container parket-pg-local_postgres), schema gestao
--
-- O QUE FAZ:
--   Custos de Terceiros. Controla o gasto de um prestador terceirizado
--   (instalador, montador, tecnico) que se desloca ate uma obra, do
--   lancamento pelo secretario ate o pagamento pelo financeiro.
--
--   1. gestao.custo_politica   politica de reembolso versionada por vigencia
--   2. gestao.custo_lancamento cabecalho: obra + prestador + status + totais
--   3. gestao.custo_despesa    item a item, com anexo, alertas e glosa
--   4. gestao.custo_historico  trilha de status, append-only (trigger bloqueia
--                              UPDATE e DELETE)
--
-- REAPROVEITA (nao duplica):
--   - a obra e gestao.projetos, FK real.
--   - o terceiro e public.prestadores no Supabase Cloud
--     (hbxpilrxmitvzebluoom). uuid solto, sem FK: e outro banco. Mesmo
--     padrao ja usado em gestao.projetos.simulacao_id / contrato_id.
--   - o centro de custo e o da obra: core.obras.centro_custo_id no Cloud,
--     resolvido pelo card_id (gestao.projetos.card_id = core.obras.space_id).
--     Fica gravado como snapshot pra ordem de pagamento nao mudar depois.
--   - o pagamento vira linha em core.lancamentos (fonte unica de pagamento
--     do grupo). O id volta em custo_lancamento.core_lancamento_id.
--
-- DINHEIRO EM CENTAVOS (int), nunca float nem numeric. Divergencia
-- consciente do resto do schema gestao, que usa numeric(14,2), e fica
-- contida nestas tabelas. Sufixo _cent em todo campo monetario.
--
-- TODO CALCULO E DO BACKEND. As colunas de total sao materializadas pelo
-- backend a cada gravacao; o frontend so exibe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Politica de reembolso (versionada, so admin edita)
--
-- Cada despesa guarda qual versao usou (custo_despesa.politica_id), pra
-- o historico nao mudar quando os valores forem reajustados.
-- ---------------------------------------------------------------------
create table if not exists gestao.custo_politica (
  id                          uuid primary key default gen_random_uuid(),
  vigencia_inicio             date not null,
  -- null = politica corrente (vigente ate segunda ordem)
  vigencia_fim                date,
  -- base do modo reembolso_km e teto de alerta do modo combustivel_km
  km_valor_cent               integer not null default 0,
  hospedagem_teto_noite_cent  integer not null default 0,
  refeicao_teto_cent          integer not null default 0,
  diaria_fechada_cent         integer not null default 0,
  -- despesa acima disso sem anexo gera alerta (nao bloqueia)
  anexo_obrigatorio_acima_cent integer not null default 0,
  observacao                  text,
  criado_por                  text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now(),
  constraint custo_politica_vigencia_ok
    check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

-- So pode existir UMA politica em aberto por vez. Reajuste = fechar a
-- atual (vigencia_fim) e abrir a nova.
create unique index if not exists uq_custo_politica_aberta
  on gestao.custo_politica ((1)) where vigencia_fim is null;

drop trigger if exists trg_custo_politica_touch on gestao.custo_politica;
create trigger trg_custo_politica_touch before update on gestao.custo_politica
  for each row execute function gestao._touch();

-- ---------------------------------------------------------------------
-- 2) Lancamento (cabecalho da viagem/periodo do terceiro na obra)
-- ---------------------------------------------------------------------
create sequence if not exists gestao.custo_lancamento_num_seq;

create table if not exists gestao.custo_lancamento (
  id                uuid primary key default gen_random_uuid(),
  -- OPT-0001, OPT-0002... identifica a ordem de pagamento no PDF
  numero            text unique not null
                    default 'OPT-' || lpad(nextval('gestao.custo_lancamento_num_seq')::text, 4, '0'),

  projeto_id        uuid not null references gestao.projetos(id) on delete restrict,
  -- public.prestadores(id) no Cloud. Sem FK: outro banco.
  prestador_id      uuid not null,
  -- snapshot do nome no momento do lancamento (o cadastro pode ser renomeado)
  prestador_nome    text,

  -- versao da politica congelada na abertura; cada despesa reconfirma a sua
  politica_id       uuid references gestao.custo_politica(id),

  -- snapshot do Core resolvido pelo card_id da obra. Centro de custo e
  -- obrigatorio na regra de negocio; a validacao mora no backend porque a
  -- resolucao depende de outro banco.
  core_obra_id      uuid,
  centro_custo_id   uuid,
  centro_custo_nome text,

  data_ida          date,
  data_volta        date,
  motivo            text,

  status            text not null default 'rascunho'
                    check (status in ('rascunho','enviado','em_analise',
                                      'aprovado','devolvido','pago')),

  -- soma das despesas com status aprovado (backend materializa)
  total_aprovado_cent integer not null default 0,
  -- soma de tudo que foi lancado, aprovado ou nao (visao do secretario)
  total_lancado_cent  integer not null default 0,
  adiantamento_cent   integer not null default 0,
  -- total_aprovado - adiantamento, piso zero
  saldo_cent          integer not null default 0,

  criado_por        text,
  aprovado_por      text,
  aprovado_em       timestamptz,
  pago_por          text,
  pago_em           timestamptz,

  -- core.lancamentos(id) gerado ao marcar pago (write-back no financeiro)
  core_lancamento_id uuid,
  comprovante_url   text,
  comprovante_nome  text,

  meta              jsonb default '{}'::jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  constraint custo_lancamento_datas_ok
    check (data_volta is null or data_ida is null or data_volta >= data_ida)
);

create index if not exists idx_custo_lanc_projeto   on gestao.custo_lancamento(projeto_id);
create index if not exists idx_custo_lanc_prestador on gestao.custo_lancamento(prestador_id);
create index if not exists idx_custo_lanc_status    on gestao.custo_lancamento(status);
create index if not exists idx_custo_lanc_criado    on gestao.custo_lancamento(criado_por);
-- fila do financeiro: enviados/em analise mais antigos primeiro
create index if not exists idx_custo_lanc_fila
  on gestao.custo_lancamento(status, created_at)
  where status in ('enviado','em_analise');

drop trigger if exists trg_custo_lancamento_touch on gestao.custo_lancamento;
create trigger trg_custo_lancamento_touch before update on gestao.custo_lancamento
  for each row execute function gestao._touch();

-- ---------------------------------------------------------------------
-- 3) Despesa (item do lancamento)
--
-- campos jsonb guarda o que e especifico de cada subcategoria, pra nao
-- criar 20 colunas que ficam nulas na maioria das linhas:
--   combustivel_km  {km_ida, km_volta, consumo_km_l, preco_litro_cent}
--   reembolso_km    {km_ida, km_volta}
--   pedagio         {}                      qtd x valor_unitario
--   passagem        {trecho}
--   aluguel_carro   {}                      diarias x valor_unitario
--   hospedagem      {check_in, check_out}   noites x valor_unitario
--   alimentacao     {refeicao}              cafe|almoco|jantar
--   diaria_fechada  {}                      dias x valor_unitario
--   nf / rpa        {documento, numero, emissao}
--
-- alertas: [{codigo, mensagem, nivel}] calculado no backend. Sinaliza,
-- nunca bloqueia. Codigos: acima_teto, sem_anexo, data_fora_periodo,
-- possivel_duplicidade.
-- ---------------------------------------------------------------------
create table if not exists gestao.custo_despesa (
  id                uuid primary key default gen_random_uuid(),
  lancamento_id     uuid not null references gestao.custo_lancamento(id) on delete cascade,

  categoria         text not null
                    check (categoria in ('deslocamento','estadia','documentacao')),
  subcategoria      text not null
                    check (subcategoria in (
                      'combustivel_km','reembolso_km','abastecimento','pedagio',
                      'passagem','aluguel_carro','uber','taxi','estacionamento',
                      'hospedagem','alimentacao','diaria_fechada',
                      'nf','rpa')),
  descricao         text,
  data              date,

  quantidade        numeric(12,3) not null default 1,
  valor_unitario_cent integer not null default 0,
  valor_total_cent    integer not null default 0,

  campos            jsonb not null default '{}'::jsonb,

  anexo_url         text,
  anexo_nome        text,
  anexo_content_type text,

  -- versao da politica usada no calculo e nos tetos desta linha
  politica_id       uuid references gestao.custo_politica(id),
  alertas           jsonb not null default '[]'::jsonb,

  status            text not null default 'pendente'
                    check (status in ('pendente','aprovado','glosado')),
  glosa_motivo      text,
  decidido_por      text,
  decidido_em       timestamptz,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_custo_desp_lanc on gestao.custo_despesa(lancamento_id);
create index if not exists idx_custo_desp_cat  on gestao.custo_despesa(categoria, subcategoria);
create index if not exists idx_custo_desp_data on gestao.custo_despesa(data);

drop trigger if exists trg_custo_despesa_touch on gestao.custo_despesa;
create trigger trg_custo_despesa_touch before update on gestao.custo_despesa
  for each row execute function gestao._touch();

-- ---------------------------------------------------------------------
-- 4) Historico de status (append-only)
--
-- REVOKE nao resolveria: o backend conecta como postgres (superuser) e
-- passaria por cima. O trigger e o que garante a imutabilidade de fato.
-- ---------------------------------------------------------------------
create table if not exists gestao.custo_historico (
  id             bigserial primary key,
  lancamento_id  uuid not null references gestao.custo_lancamento(id) on delete cascade,
  de             text,
  para           text not null,
  usuario_email  text,
  usuario_nome   text,
  observacao     text,
  created_at     timestamptz default now()
);

create index if not exists idx_custo_hist_lanc on gestao.custo_historico(lancamento_id, created_at);

create or replace function gestao._custo_historico_imutavel() returns trigger as $$
begin
  -- Excecao unica: o cascade do lancamento. O FK ON DELETE CASCADE roda
  -- DEPOIS que a linha pai some, entao "pai inexistente" identifica com
  -- seguranca que o delete veio de la, e nao de alguem apagando trilha a
  -- mao. Sem isso, apagar um rascunho estoura aqui e o lancamento fica
  -- preso pra sempre.
  if tg_op = 'DELETE' and not exists (
    select 1 from gestao.custo_lancamento where id = old.lancamento_id
  ) then
    return old;
  end if;
  raise exception 'gestao.custo_historico e append-only (tentativa de %)', tg_op;
end;
$$ language plpgsql;

drop trigger if exists trg_custo_historico_imutavel on gestao.custo_historico;
create trigger trg_custo_historico_imutavel
  before update or delete on gestao.custo_historico
  for each row execute function gestao._custo_historico_imutavel();

-- ---------------------------------------------------------------------
-- 5) Politica inicial
--
-- Vigencia aberta com valores zerados: sem isso a primeira despesa nao
-- teria versao pra congelar. Admin ajusta os numeros na tela.
-- ---------------------------------------------------------------------
insert into gestao.custo_politica (vigencia_inicio, observacao, criado_por)
select current_date, 'Politica inicial criada pela migracao 026. Ajustar os valores em Admin.', 'migracao'
where not exists (select 1 from gestao.custo_politica);

grant all on all tables in schema gestao to gestao_rw;
grant all on all sequences in schema gestao to gestao_rw;
