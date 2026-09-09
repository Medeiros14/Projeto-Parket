-- ============================================================
-- Parket RH — Schema completo (Full HRMS)
-- Aderente a eSocial, suporta multi-CNPJ, multi-vínculo, ponto,
-- banco de horas, férias, folha, holerites, desligamento,
-- treinamentos, avaliação, contatos emergência, formação acadêmica,
-- estrangeiro, sindicato, EPI, dependentes IR, afastamentos,
-- contabilidade.
--
-- Convenções:
-- - id uuid + created_at + updated_at + deleted_at (soft-delete)
-- - core.empresas REUTILIZADA p/ multi-CNPJ
-- - auth.users único p/ SSO (Space + Core + RH)
-- - RLS habilitada com policies por papel
-- - Sem CASCADE em tabelas com retenção legal
-- ============================================================

CREATE SCHEMA IF NOT EXISTS rh;
GRANT USAGE ON SCHEMA rh TO authenticated;

CREATE OR REPLACE FUNCTION rh.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ── Whitelist (criada ANTES das funções que a referenciam) ──
CREATE TABLE IF NOT EXISTS rh.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','rh','gestor','colaborador')),
  nome text,
  ativo boolean NOT NULL DEFAULT true,
  empresa_id uuid REFERENCES core.empresas(id),
  colaborador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_users_role_idx ON rh.app_users(role);

-- ── Helpers (referenciam rh.app_users / rh.colaboradores) ───
CREATE OR REPLACE FUNCTION rh.is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM rh.app_users
    WHERE user_id = auth.uid() AND role = 'admin' AND ativo = true);
$$;

CREATE OR REPLACE FUNCTION rh.is_rh() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM rh.app_users
    WHERE user_id = auth.uid() AND role IN ('admin','rh') AND ativo = true);
$$;

-- placeholder retornando NULL — substituída depois que rh.colaboradores existe
CREATE OR REPLACE FUNCTION rh.current_colaborador_id() RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$ SELECT NULL::uuid; $$;

-- ============================================================
-- CATÁLOGOS eSocial
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.cbos (
  codigo text PRIMARY KEY,
  titulo text NOT NULL,
  familia text,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS rh.lotacoes_tributarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  codigo text NOT NULL,
  tp_lotacao text NOT NULL,
  tp_inscricao text,
  insc_responsavel text,
  fpas text,
  cod_terc text,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS rh.rubricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  codigo text NOT NULL,
  descricao text NOT NULL,
  natureza text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('provento','desconto','informativa','base','outros')),
  inc_cp text, inc_irrf text, inc_fgts text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS rh.sindicatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text UNIQUE,
  website text,
  telefone text,
  data_base text,                          -- ex: "MAIO" (mês de reajuste)
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ORGANIZAÇÃO
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  nome text NOT NULL,
  descricao text,
  parent_id uuid REFERENCES rh.departamentos(id),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS rh.times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  departamento_id uuid REFERENCES rh.departamentos(id),
  nome text NOT NULL,
  gestor_colaborador_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS rh.cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  nome text NOT NULL,
  cbo_codigo text REFERENCES rh.cbos(codigo),
  descricao text,
  salario_base_default numeric(15,2),
  cota_aprendiz boolean NOT NULL DEFAULT false,
  cargo_confianca boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS rh.centros_custo_rh (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  codigo text,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE(empresa_id, nome)
);

-- ============================================================
-- COLABORADORES (pessoa física — TUDO de identidade)
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  -- ID externo da Convenia (rastreabilidade)
  external_id_convenia text UNIQUE,
  -- Identidade
  nome text NOT NULL,
  nome_social text,
  cpf text UNIQUE,
  data_nascimento date,
  sexo text,                               -- "Homem"/"Mulher"/"Outro"/null
  genero_documento text,                   -- "Masculino"/"Feminino"
  estado_civil text,                       -- "Solteiro(a)"/"Casado(a)"/"União Estável"/"Divorciado(a)"/"Separado(a)"/"Viúvo(a)"
  raca_cor text,                           -- "Branca"/"Preta"/"Parda"/"Amarela"/"Indígena"/"Não informado"
  -- Naturalidade
  uf_natal text,
  cidade_natal text,
  -- Filiação
  nome_mae text,
  nome_pai text,
  -- Contatos
  email_pessoal text,
  email_profissional text,
  celular text,
  telefone_residencial text,
  whatsapp_consente boolean NOT NULL DEFAULT true,
  -- Endereço Brasil
  endereco_logradouro text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf text,
  endereco_cep text,
  endereco_pais text DEFAULT 'BRASIL',
  -- Documentos
  rg_numero text,
  rg_data_emissao date,
  rg_orgao_emissor text,
  rg_uf_emissor text,
  ctps_numero text,
  ctps_serie text,
  ctps_data_emissao date,
  ctps_uf_emissora text,
  pis_pasep text,
  titulo_eleitor_numero text,
  titulo_eleitor_zona text,
  titulo_eleitor_secao text,
  titulo_eleitor_uf text,
  titulo_eleitor_cidade text,
  reservista_numero text,
  reservista_ra text,
  reservista_serie text,
  cnh_numero text,
  cnh_data_emissao date,
  cnh_validade date,
  cnh_categoria text,
  passaporte_numero text,
  -- Deficiência
  deficiencia_tipo text,
  deficiencia_observacoes text,
  -- IR
  qtd_dependentes_ir int DEFAULT 0,        -- pra alerta dashboard quando > 0 sem detalhes
  -- Observações / Status
  status_dados text NOT NULL DEFAULT 'incompleto'
    CHECK (status_dados IN ('incompleto','pendente_validacao','completo')),
  foto_url text,
  observacoes text,
  -- Auditoria
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS colaboradores_user_idx ON rh.colaboradores(user_id);
CREATE INDEX IF NOT EXISTS colaboradores_cpf_idx ON rh.colaboradores(cpf);
CREATE INDEX IF NOT EXISTS colaboradores_nome_idx ON rh.colaboradores(nome);
CREATE INDEX IF NOT EXISTS colaboradores_ext_id_idx ON rh.colaboradores(external_id_convenia);

-- FK pendentes (após rh.colaboradores existir)
ALTER TABLE rh.times
  DROP CONSTRAINT IF EXISTS times_gestor_fkey,
  ADD CONSTRAINT times_gestor_fkey
  FOREIGN KEY (gestor_colaborador_id) REFERENCES rh.colaboradores(id);

ALTER TABLE rh.app_users
  DROP CONSTRAINT IF EXISTS app_users_colab_fkey,
  ADD CONSTRAINT app_users_colab_fkey
  FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id);

-- Substitui placeholder pela versão real
CREATE OR REPLACE FUNCTION rh.current_colaborador_id() RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT id FROM rh.colaboradores WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Estrangeiro (1:1 opt-in — só preenchido pra quem é estrangeiro)
CREATE TABLE IF NOT EXISTS rh.colaborador_estrangeiro (
  colaborador_id uuid PRIMARY KEY REFERENCES rh.colaboradores(id) ON DELETE CASCADE,
  reside_no_brasil boolean,
  pais_origem text,
  tipo_visto text,
  data_chegada date,
  data_naturalizacao date,
  tempo_residencia_anos int,
  condicao_ingresso text,
  casado_com_brasileiro boolean,
  tem_filho_brasileiro boolean,
  -- Endereço no exterior
  cep_exterior text,
  descricao_logradouro_exterior text,
  endereco_exterior text,
  numero_exterior text,
  complemento_exterior text,
  bairro_exterior text,
  cidade_exterior text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Nacionalidades (1:N — multi-nacionalidade existe na export)
CREATE TABLE IF NOT EXISTS rh.colaborador_nacionalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES rh.colaboradores(id) ON DELETE CASCADE,
  nacionalidade text NOT NULL,
  ordem int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(colaborador_id, nacionalidade)
);

-- Contatos de emergência (1:N)
CREATE TABLE IF NOT EXISTS rh.contatos_emergencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES rh.colaboradores(id) ON DELETE CASCADE,
  nome text NOT NULL,
  relacao text,                           -- pai, mãe, cônjuge, etc
  telefone text,
  telefone_comercial text,
  celular text,
  email text,
  ordem int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Formação acadêmica (1:N)
CREATE TABLE IF NOT EXISTS rh.formacao_academica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES rh.colaboradores(id) ON DELETE CASCADE,
  escolaridade text,                      -- "Superior completo", "Médio completo"...
  instituicao text,
  curso text,
  ano_conclusao int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dependentes (1:N)
CREATE TABLE IF NOT EXISTS rh.dependentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES rh.colaboradores(id),
  nome text NOT NULL,
  cpf text,
  data_nascimento date,
  parentesco text,                        -- "Filho(a)", "Cônjuge", etc
  irrf boolean NOT NULL DEFAULT false,
  salario_familia boolean NOT NULL DEFAULT false,
  plano_saude boolean NOT NULL DEFAULT false,
  renda_familiar boolean,                 -- compõe renda familiar?
  nome_mae text,
  telefone text,
  email text,
  descricao text,
  incapacidade_fisica_mental boolean,
  estrangeiro boolean,
  genero_documento text,
  escolaridade text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Dados bancários (1:N)
CREATE TABLE IF NOT EXISTS rh.dados_bancarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES rh.colaboradores(id),
  banco_codigo text,
  banco_nome text,
  agencia text,
  conta text,
  digito text,
  tipo text CHECK (tipo IN ('corrente','poupanca','salario')),
  modalidade text,                        -- da Convenia: "Pessoal", "Salário", etc
  pix_chave text,
  pix_tipo text CHECK (pix_tipo IN ('cpf','email','telefone','aleatoria')),
  principal boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- EPI tamanhos (1:1)
CREATE TABLE IF NOT EXISTS rh.epi_tamanhos (
  colaborador_id uuid PRIMARY KEY REFERENCES rh.colaboradores(id) ON DELETE CASCADE,
  camiseta text,
  calca text,
  bota text,
  observacoes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Documentos pessoais (uploads — RG, CPF scan, comprovante residência, etc)
CREATE TABLE IF NOT EXISTS rh.documentos_pessoais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES rh.colaboradores(id),
  tipo text NOT NULL,
  numero text,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  validade date,
  observacoes text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS documentos_pessoais_colab_idx ON rh.documentos_pessoais(colaborador_id);

-- ============================================================
-- VÍNCULOS / CONTRATOS (employments — multi-empresa)
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES rh.colaboradores(id),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  matricula text,
  -- Organização
  cargo_id uuid REFERENCES rh.cargos(id),
  departamento_id uuid REFERENCES rh.departamentos(id),
  time_id uuid REFERENCES rh.times(id),
  centro_custo_rh_id uuid REFERENCES rh.centros_custo_rh(id),
  lotacao_tributaria_id uuid REFERENCES rh.lotacoes_tributarias(id),
  -- Gestor
  gestor_colaborador_id uuid REFERENCES rh.colaboradores(id),
  gestor_nome_snapshot text,              -- snapshot pro caso do gestor sair
  -- Salário & Pagamento
  salario_base numeric(15,2) NOT NULL DEFAULT 0,
  tipo_salario text,                      -- "Por mês", "Por hora", "Por dia"
  forma_pagamento text,                   -- "Salário", "Honorários", etc
  hora_contratual numeric(7,2),           -- hora base pra cálculos
  -- Datas
  data_admissao date NOT NULL,
  data_termino_contrato date,
  data_inicio_periodo_experiencia date,
  data_fim_periodo_experiencia date,
  periodo_experiencia_dias int,
  primeiro_termino_experiencia date,
  segundo_termino_experiencia date,
  data_exame_admissional date,
  data_demissao date,
  -- Tipo
  vinculo text,                           -- "CLT", "Pessoa Jurídica", "Estágio", "Aprendiz"
  tipo_admissao text,                     -- eSocial: "Admissão", "Transferência", etc
  tipo_contrato text NOT NULL DEFAULT 'CLT'
    CHECK (tipo_contrato IN ('CLT','PJ','autonomo','aprendiz','estagio','temporario','intermitente','diretor')),
  cota_aprendiz boolean NOT NULL DEFAULT false,
  -- Senioridade
  senioridade text,                       -- "Junior", "Pleno", "Senior"
  nivel_senioridade text,                 -- "I", "II", "III"
  -- Jornada
  jornada_horas_semanais numeric(5,2),
  carga_horaria_mensal numeric(7,2),
  horas_mensais numeric(7,2),
  jornada_descricao text,
  jornada_motivo text,
  jornada_observacoes text,
  regime_jornada text,
  -- Flags
  cargo_confianca boolean NOT NULL DEFAULT false,
  estabilidade text,
  primeiro_emprego boolean NOT NULL DEFAULT false,
  aposentado boolean NOT NULL DEFAULT false,
  seguro_desemprego boolean,
  cipa boolean NOT NULL DEFAULT false,
  registro_ponto boolean NOT NULL DEFAULT true,
  inscricao_orgao_classe text,
  conselho_profissional text,
  -- Sindicato
  sindicato_id uuid REFERENCES rh.sindicatos(id),
  -- Status
  status text NOT NULL DEFAULT 'em_admissao'
    CHECK (status IN ('em_admissao','aguardando_aprovacao','ativo','afastado','desligado','suspenso','encerrado')),
  motivo_afastamento text,
  -- Observações
  observacoes text,
  -- Auditoria
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(empresa_id, matricula)
);
CREATE INDEX IF NOT EXISTS contratos_colab_idx ON rh.contratos(colaborador_id);
CREATE INDEX IF NOT EXISTS contratos_empresa_idx ON rh.contratos(empresa_id);
CREATE INDEX IF NOT EXISTS contratos_status_idx ON rh.contratos(status);

-- Histórico de cargos/salários (1:N — fonte: aba "Histórico cargos e salários")
CREATE TABLE IF NOT EXISTS rh.contrato_alteracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  data_de date NOT NULL,
  data_ate date,
  vinculo text,
  categoria_trabalhador text,             -- eSocial S-2200
  cargo_id uuid REFERENCES rh.cargos(id),
  cargo_snapshot text,                    -- snapshot do nome (cargo pode mudar de id)
  departamento_id uuid REFERENCES rh.departamentos(id),
  departamento_snapshot text,
  time_id uuid REFERENCES rh.times(id),
  time_snapshot text,
  centro_custo_snapshot text,
  salario numeric(15,2),
  senioridade text,
  nivel_senioridade text,
  motivo text,                            -- "Promoção", "Aumento dissídio", etc
  descricao text,
  esocial_evento_id uuid,                 -- FK pra rh.esocial_eventos (S-2206)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contrato_alt_contrato_idx ON rh.contrato_alteracoes(contrato_id, data_de);

-- Contabilidade / eSocial específicos do contrato (1:1)
CREATE TABLE IF NOT EXISTS rh.contabilidade_dados (
  contrato_id uuid PRIMARY KEY REFERENCES rh.contratos(id) ON DELETE CASCADE,
  tipo_regime_previdenciario text,        -- "RGPS", "RPPS", etc
  natureza_atividade text,                -- "Urbano", "Rural"
  indicativo_admissao text,               -- eSocial: "Normal", "Decorrente de ação"...
  numero_processo text,
  cota_pcd boolean,                       -- preenche cota PCD?
  apolice_seguro_estagiario text,
  fgts_optante boolean,
  agente_nocivo text,                     -- código eSocial
  imovel_proprio boolean,
  imovel_adquirido_fgts boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Estágio (1:1, opt-in)
CREATE TABLE IF NOT EXISTS rh.estagio_info (
  contrato_id uuid PRIMARY KEY REFERENCES rh.contratos(id) ON DELETE CASCADE,
  data_inicio date,
  data_termino date,
  natureza_estagio text,                  -- "Obrigatório", "Não obrigatório"
  instituicao_ensino text,
  cnpj_instituicao text,
  cep_instituicao text,
  endereco_instituicao text,
  numero_instituicao text,
  complemento_instituicao text,
  bairro_instituicao text,
  uf_instituicao text,
  cidade_instituicao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Benefícios (1:N por contrato)
CREATE TABLE IF NOT EXISTS rh.beneficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  tipo text NOT NULL,                     -- VR, VT, VA, plano_saude, etc
  fornecedor text,
  valor_mensal numeric(15,2),
  desconto_colaborador numeric(15,2),
  data_inicio date NOT NULL,
  data_fim date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Afastamentos (1:N — aba "Faltas e afastamentos")
CREATE TABLE IF NOT EXISTS rh.afastamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  motivo text NOT NULL,
  tipo text,
  data_inicio date NOT NULL,
  data_fim date,
  total_dias int,
  cid text,
  justificativa text,
  documento_storage_path text,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','aprovado','rejeitado','encerrado')),
  esocial_evento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS afastamentos_contrato_idx ON rh.afastamentos(contrato_id);

-- ============================================================
-- ADMISSÃO (Onboarding)
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.admissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  contrato_id uuid REFERENCES rh.contratos(id),
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  cargo_id uuid REFERENCES rh.cargos(id),
  departamento_id uuid REFERENCES rh.departamentos(id),
  data_admissao_prevista date,
  salario_proposto numeric(15,2),
  token text UNIQUE NOT NULL,
  token_expira_em timestamptz,
  etapa text NOT NULL DEFAULT 'convite_enviado'
    CHECK (etapa IN ('rascunho','convite_enviado','formulario_em_preenchimento','formulario_completo',
                     'contrato_gerado','aguardando_assinatura','assinado','aguardando_aprovacao_rh',
                     'aprovado_ativo','rejeitado','cancelado','expirado')),
  preenchido_em timestamptz,
  contrato_documento_id uuid,
  contrato_assinado_em timestamptz,
  aprovado_em timestamptz,
  aprovado_por uuid REFERENCES auth.users(id),
  rejeitado_motivo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admissoes_etapa_idx ON rh.admissoes(etapa);
CREATE INDEX IF NOT EXISTS admissoes_empresa_idx ON rh.admissoes(empresa_id);

CREATE TABLE IF NOT EXISTS rh.admissao_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id uuid NOT NULL REFERENCES rh.admissoes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  validado boolean DEFAULT false,
  validado_por uuid REFERENCES auth.users(id),
  validado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
