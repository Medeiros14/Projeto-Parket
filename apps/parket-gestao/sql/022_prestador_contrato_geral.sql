-- =====================================================================
-- 022_prestador_contrato_geral.sql
-- Banco: Supabase Cloud hbxpilrxmitvzebluoom (Valor)
--
-- O QUE FAZ (F1 do contrato geral do prestador, tarefa #1985):
--   1. prestador_contrato_aceites: aceite do contrato GERAL de
--      prestacao de servicos, 1 linha por prestador por versao dos
--      termos. Assinado uma unica vez no primeiro login do
--      instala.parket.works (WhatsApp validado por OTP + selfie com
--      hash SHA-256 + assinatura + trilha IP/UA). Cada obra NAO gera
--      contrato novo: adere como ANEXO (prestador_termos abaixo).
--   2. prestador_otp: codigos de verificacao enviados por WhatsApp
--      (Evolution). Guarda SO o hash do codigo, nunca o codigo em
--      claro (regra Auth Guard: codigo so trafega no WhatsApp).
--   3. prestador_termos passa a ser o anexo por obra: ganha
--      contrato_aceite_id (uuid solto, sem FK, porque anexos legados
--      existem antes do contrato geral) + otp_validado_em.
--
-- IMPORTANTE: a tabela prestador_contratos JA EXISTIA no Cloud
-- (esqueleto de 17/06: versao, titulo, conteudo_md, vigente) e vira o
-- CATALOGO versionado dos termos gerais na F2. Nao mexer nela aqui.
--
-- RLS: as duas tabelas novas ficam com RLS LIGADA e SEM policy, igual
-- prestador_credenciais (016): so o service_role do backend passa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Aceite do contrato geral pelo prestador
-- ---------------------------------------------------------------------
create table if not exists public.prestador_contrato_aceites (
  id                 uuid primary key default gen_random_uuid(),
  prestador_id       uuid not null references public.prestadores(id) on delete cascade,
  -- versao dos termos aceita (prestador_contratos.versao, o catalogo)
  versao_termos      integer not null,
  status             text not null default 'pendente'
                     check (status in ('pendente','aceito','revogado')),
  -- telefone confirmado por OTP no onboarding (digits com DDI 55)
  telefone_validado  text,
  whatsapp_validado_em timestamptz,
  -- snapshot dos dados DAS PARTES preenchidos no aceite (nome, cpf/cnpj, endereco)
  dados_prestador    jsonb not null default '{}'::jsonb,
  -- validacao facial nivel A: selfie no ato + hash SHA-256 da imagem
  selfie_url         text,
  selfie_hash        text,
  assinatura_url     text,
  pdf_url            text,
  -- trilha de auditoria do aceite (MP 2.200-2 / Lei 14.063)
  aceito_em          timestamptz,
  aceite_ip          text,
  aceite_user_agent  text,
  criado_em          timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 1 aceite por prestador por versao dos termos (re-aceite = linha nova)
create unique index if not exists uq_prest_aceite_versao
  on public.prestador_contrato_aceites (prestador_id, versao_termos);

-- lookup padrao do gate de login: aceite mais recente do prestador
create index if not exists idx_prest_aceite_prestador
  on public.prestador_contrato_aceites (prestador_id, status, versao_termos desc);

alter table public.prestador_contrato_aceites enable row level security;

-- ---------------------------------------------------------------------
-- 2) OTP WhatsApp (onboarding do contrato + ativacao de obra)
-- ---------------------------------------------------------------------
create table if not exists public.prestador_otp (
  id           uuid primary key default gen_random_uuid(),
  prestador_id uuid not null references public.prestadores(id) on delete cascade,
  -- telefone de destino no momento do envio (digits com DDI)
  telefone     text not null,
  -- sha256(otp_id + ':' + codigo); codigo em claro nunca e persistido
  codigo_hash  text not null,
  finalidade   text not null check (finalidade in ('onboarding','ativacao_obra')),
  -- contexto do pedido (ex: card_id da obra na ativacao)
  contexto     jsonb not null default '{}'::jsonb,
  expira_em    timestamptz not null,
  tentativas   integer not null default 0,
  usado_em     timestamptz,
  criado_em    timestamptz not null default now()
);

-- valida sempre o codigo mais recente por prestador+finalidade
create index if not exists idx_prest_otp_lookup
  on public.prestador_otp (prestador_id, finalidade, criado_em desc);

alter table public.prestador_otp enable row level security;

-- ---------------------------------------------------------------------
-- 3) prestador_termos vira ANEXO do contrato geral
-- ---------------------------------------------------------------------
-- contrato_aceite_id: uuid solto (sem FK) apontando pro aceite vigente
-- no momento da ativacao; NULL = termo legado pre contrato geral
alter table public.prestador_termos
  add column if not exists contrato_aceite_id uuid;

-- prova da ativacao por codigo WhatsApp no Iniciar da obra
alter table public.prestador_termos
  add column if not exists otp_validado_em timestamptz;

create index if not exists idx_prest_termos_aceite
  on public.prestador_termos (contrato_aceite_id) where contrato_aceite_id is not null;
