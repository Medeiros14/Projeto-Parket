-- =====================================================================
-- 027_cloud_prestadores_terceiro.sql
-- Banco: Supabase CLOUD (hbxpilrxmitvzebluoom), schema public
--
-- ATENCAO: este arquivo NAO roda no deploy-gestao.sh. O deploy so aplica
-- SQL no Postgres local. Este aqui vai pela Management API do Supabase.
--
-- O QUE FAZ:
--   Completa public.prestadores com os campos de pagamento que faltavam
--   pro modulo Custos de Terceiros. Decisao de projeto: NAO criar tabela
--   `terceiro`. O terceiro que se desloca ate a obra ja e o prestador
--   cadastrado aqui, com login no Instala, contrato geral assinado e
--   vinculo com as obras. Duplicar viraria dois cadastros do mesmo
--   sujeito, divergindo em telefone, pix e status ativo.
--
--   Ja existiam: nome, telefone, email, categoria (= especialidade),
--   cpf, pix_chave, ativo.
--   Faltavam: tipo de pessoa, cnpj e os dados bancarios (o PIX sozinho
--   nao fecha ordem de pagamento quando o terceiro so tem conta).
-- =====================================================================

alter table public.prestadores
  -- PF paga por RPA (com retencao), PJ e MEI por NF. Muda o documento
  -- exigido na despesa e o tratamento fiscal do repasse.
  add column if not exists tipo_pessoa       text,
  add column if not exists cnpj              text,
  add column if not exists banco             text,
  add column if not exists agencia           text,
  add column if not exists conta             text,
  -- corrente | poupanca
  add column if not exists conta_tipo        text,
  -- titular da conta: nem sempre e o proprio prestador (conta da esposa,
  -- conta da PJ). Sem isso o financeiro trava na hora de transferir.
  add column if not exists titular           text,
  add column if not exists titular_documento text;

-- Constraints em ADD COLUMN separado: se a coluna ja existia com lixo,
-- o alter acima passa e o check abaixo e que denuncia.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prestadores_tipo_pessoa_ok'
  ) then
    alter table public.prestadores
      add constraint prestadores_tipo_pessoa_ok
      check (tipo_pessoa is null or tipo_pessoa in ('PF','PJ','MEI'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'prestadores_conta_tipo_ok'
  ) then
    alter table public.prestadores
      add constraint prestadores_conta_tipo_ok
      check (conta_tipo is null or conta_tipo in ('corrente','poupanca'));
  end if;
end $$;

-- Sem backfill de tipo_pessoa. Conferido na aplicacao (04/09/2026): dos 118
-- prestadores, ZERO tem cpf preenchido. Nao ha de onde inferir PF/PJ, e
-- chutar seria pior que deixar null. Consequencia pratica: nenhum terceiro
-- hoje tem documento cadastrado, entao a primeira ordem de pagamento de
-- cada um vai exigir completar a ficha. A tela precisa tratar isso como
-- pendencia visivel, nao como erro.

comment on column public.prestadores.tipo_pessoa is
  'PF|PJ|MEI. Define se o repasse sai como RPA (PF) ou NF (PJ/MEI).';
comment on column public.prestadores.titular is
  'Titular da conta bancaria quando diferente do prestador.';
