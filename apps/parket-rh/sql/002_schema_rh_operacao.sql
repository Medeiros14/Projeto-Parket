-- ============================================================
-- Parket RH — Operação: Ponto, Banco de Horas, Férias, Folha,
-- Holerites, Desligamento, Treinamentos, Avaliação, eSocial,
-- Notificações.
-- ============================================================

-- ============================================================
-- PONTO ELETRÔNICO + BANCO DE HORAS
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.escalas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  nome text NOT NULL,                     -- "Comercial 8-18", "Noturno 22-6"
  carga_horaria_semanal numeric(5,2) NOT NULL,
  permite_compensacao boolean NOT NULL DEFAULT true,
  tolerancia_min int NOT NULL DEFAULT 5,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS rh.escala_horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id uuid NOT NULL REFERENCES rh.escalas(id) ON DELETE CASCADE,
  dia_semana int NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),  -- 0=domingo
  entrada time,
  intervalo_inicio time,
  intervalo_fim time,
  saida time,
  folga boolean NOT NULL DEFAULT false,
  UNIQUE(escala_id, dia_semana)
);

CREATE TABLE IF NOT EXISTS rh.colaborador_escala (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  escala_id uuid NOT NULL REFERENCES rh.escalas(id),
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS colab_escala_contrato_idx ON rh.colaborador_escala(contrato_id);

CREATE TABLE IF NOT EXISTS rh.batidas_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  registrado_em timestamptz NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','intervalo_inicio','intervalo_fim')),
  origem text NOT NULL DEFAULT 'app'
    CHECK (origem IN ('app','web','manual_rh','importado','catraca','rep')),
  ip text,
  user_agent text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  foto_url text,                          -- selfie/biometria opcional
  hash_assinatura text,                   -- hash imutável (Portaria 671/2021)
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS batidas_contrato_idx ON rh.batidas_ponto(contrato_id, registrado_em);

CREATE TABLE IF NOT EXISTS rh.justificativas_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  data date NOT NULL,
  tipo text NOT NULL,                     -- atestado_medico, falta_justificada, abono_legal, etc
  motivo text,
  documento_storage_path text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovada','rejeitada')),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh.banco_horas_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  data date NOT NULL,
  minutos numeric(8,2) NOT NULL,           -- positivo = crédito; negativo = débito
  tipo text NOT NULL,                      -- hora_extra, compensacao, falta, ajuste_manual
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bh_mov_contrato_idx ON rh.banco_horas_movimentos(contrato_id, data);

CREATE TABLE IF NOT EXISTS rh.banco_horas_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  competencia text NOT NULL,               -- "2026-04"
  saldo_minutos numeric(8,2) NOT NULL DEFAULT 0,
  fechado boolean NOT NULL DEFAULT false,
  fechado_em timestamptz,
  fechado_por uuid REFERENCES auth.users(id),
  UNIQUE(contrato_id, competencia)
);

-- ============================================================
-- FÉRIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.ferias_periodos_aquisitivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  inicio date NOT NULL,
  fim date NOT NULL,
  dias_direito int NOT NULL DEFAULT 30,
  faltas_descontadas int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','concluido','perdido')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ferias_aq_contrato_idx ON rh.ferias_periodos_aquisitivos(contrato_id);

CREATE TABLE IF NOT EXISTS rh.ferias_periodos_concessivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aquisitivo_id uuid NOT NULL REFERENCES rh.ferias_periodos_aquisitivos(id),
  limite_concessao date NOT NULL,         -- 12 meses após o aquisitivo
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','expirando','vencido','concluido')),
  observacao text
);

CREATE TABLE IF NOT EXISTS rh.ferias_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aquisitivo_id uuid NOT NULL REFERENCES rh.ferias_periodos_aquisitivos(id),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  inicio date NOT NULL,
  fim date NOT NULL,
  dias int NOT NULL,
  abono_pecuniario_dias int NOT NULL DEFAULT 0,    -- 1/3 vendido
  adiantamento_13 boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovada','rejeitada','cancelada','iniciada','concluida')),
  bypass_clt boolean NOT NULL DEFAULT false,        -- override 30 dias antecedência (admin/RH)
  bypass_motivo text,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  rejeitado_motivo text,
  aviso_documento_id uuid,                          -- FK pra signer.documentos
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ferias_sol_status_idx ON rh.ferias_solicitacoes(status);
CREATE INDEX IF NOT EXISTS ferias_sol_contrato_idx ON rh.ferias_solicitacoes(contrato_id);

-- ============================================================
-- FOLHA / HOLERITES
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  competencia text NOT NULL,              -- "2026-04"
  tipo text NOT NULL DEFAULT 'mensal'
    CHECK (tipo IN ('mensal','adiantamento','13o_primeira','13o_segunda','rescisao','ferias')),
  data_pagamento date,
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','calculada','fechada','transmitida_esocial')),
  fechado_por uuid REFERENCES auth.users(id),
  fechado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, competencia, tipo)
);

CREATE TABLE IF NOT EXISTS rh.holerites_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id uuid NOT NULL REFERENCES rh.competencias(id),
  storage_path text NOT NULL,             -- PDF original único
  total_paginas int,
  total_distribuidos int DEFAULT 0,
  total_falha int DEFAULT 0,
  status text NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando','processando','concluido','erro')),
  log_processamento jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh.holerites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  competencia_id uuid REFERENCES rh.competencias(id),
  lote_id uuid REFERENCES rh.holerites_lotes(id),
  -- PDF individual (split do lote)
  storage_path text NOT NULL,
  -- Totalizadores
  total_proventos numeric(15,2),
  total_descontos numeric(15,2),
  liquido numeric(15,2),
  -- Identificação no PDF
  pagina_no_lote int,
  cpf_match text,
  matricula_match text,
  -- Distribuição
  visualizado_em timestamptz,
  notificado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS holerites_contrato_idx ON rh.holerites(contrato_id);
CREATE INDEX IF NOT EXISTS holerites_competencia_idx ON rh.holerites(competencia_id);

CREATE TABLE IF NOT EXISTS rh.holerite_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holerite_id uuid NOT NULL REFERENCES rh.holerites(id) ON DELETE CASCADE,
  rubrica_id uuid REFERENCES rh.rubricas(id),
  rubrica_codigo text,                    -- snapshot do código no momento
  rubrica_descricao text,                 -- snapshot
  tipo text NOT NULL CHECK (tipo IN ('provento','desconto','informativa','base')),
  referencia text,                        -- ex: "30 d", "100 h"
  valor numeric(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS rh.adiantamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  competencia_id uuid REFERENCES rh.competencias(id),
  valor numeric(15,2) NOT NULL,
  motivo text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovado','rejeitado','pago','descontado_folha')),
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  rejeitado_motivo text,
  data_pagamento date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DESLIGAMENTO
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.desligamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES rh.contratos(id),
  data_desligamento date NOT NULL,
  motivo text NOT NULL,                   -- demissao_sj/com_jc/pedido_demissao/acordo/justa_causa/...
  aviso_previo_tipo text,                 -- trabalhado/indenizado/dispensado
  aviso_previo_dias int,
  observacao text,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','em_processo','concluido','cancelado')),
  comunicado_por uuid REFERENCES auth.users(id),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  contexto text NOT NULL DEFAULT 'desligamento'
    CHECK (contexto IN ('admissao','desligamento','transferencia','retorno_ferias')),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, contexto, nome)
);

CREATE TABLE IF NOT EXISTS rh.checklist_template_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES rh.checklist_templates(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  setor text NOT NULL,                    -- TI, DP, Gestao, RH, Financeiro
  descricao text NOT NULL,
  responsavel_padrao_user_id uuid REFERENCES auth.users(id),
  prazo_dias int,
  obrigatorio boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS rh.checklist_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES rh.checklist_templates(id),
  contexto_tipo text NOT NULL,            -- "desligamento", "admissao"
  contexto_id uuid NOT NULL,              -- ref polimórfica pra rh.desligamentos / rh.admissoes
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  status text NOT NULL DEFAULT 'em_andamento'
    CHECK (status IN ('em_andamento','concluido','cancelado')),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh.checklist_execucao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES rh.checklist_execucoes(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES rh.checklist_template_itens(id),
  setor text NOT NULL,
  descricao text NOT NULL,
  responsavel_user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_andamento','concluido','nao_aplicavel')),
  prazo date,
  concluido_por uuid REFERENCES auth.users(id),
  concluido_em timestamptz,
  observacao text
);

CREATE TABLE IF NOT EXISTS rh.verbas_rescisorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desligamento_id uuid NOT NULL REFERENCES rh.desligamentos(id),
  rubrica_id uuid REFERENCES rh.rubricas(id),
  rubrica_descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('provento','desconto')),
  referencia text,
  valor numeric(15,2) NOT NULL
);

-- ============================================================
-- TREINAMENTOS / CERTIFICAÇÕES
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.treinamentos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  categoria text,                         -- NR, soft_skill, tecnico, lideranca
  carga_horaria numeric(6,2),
  valida_dias int,                        -- NR-10 = 730 (2 anos)
  obrigatorio_para_cargos uuid[],         -- lista de cargo_id
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh.trilhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  empresa_id uuid REFERENCES core.empresas(id),
  publico_alvo text,                      -- todos, gestores, marcenaria, etc
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh.trilha_treinamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trilha_id uuid NOT NULL REFERENCES rh.trilhas(id) ON DELETE CASCADE,
  treinamento_id uuid NOT NULL REFERENCES rh.treinamentos_catalogo(id),
  ordem int NOT NULL DEFAULT 0,
  obrigatorio boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS rh.colaborador_treinamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES rh.colaboradores(id),
  treinamento_id uuid NOT NULL REFERENCES rh.treinamentos_catalogo(id),
  trilha_id uuid REFERENCES rh.trilhas(id),
  status text NOT NULL DEFAULT 'matriculado'
    CHECK (status IN ('matriculado','em_andamento','concluido','reprovado','expirado')),
  data_inicio date,
  data_conclusao date,
  data_validade date,                     -- calculada via valida_dias
  nota numeric(5,2),
  certificado_storage_path text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS colab_trein_validade_idx ON rh.colaborador_treinamentos(data_validade);

-- ============================================================
-- AVALIAÇÃO DE DESEMPENHO
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.ciclos_avaliacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  nome text NOT NULL,                     -- "1Q 2026", "Anual 2026"
  inicio date NOT NULL,
  fim date NOT NULL,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','em_andamento','encerrado','arquivado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh.avaliacao_formularios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES rh.ciclos_avaliacao(id),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT '180'
    CHECK (tipo IN ('autoavaliacao','gestor','par','subordinado','360')),
  publico_alvo text,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS rh.avaliacao_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES rh.avaliacao_formularios(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  enunciado text NOT NULL,
  tipo_resposta text NOT NULL DEFAULT 'escala_5'
    CHECK (tipo_resposta IN ('escala_5','escala_10','sim_nao','texto_livre','multipla_escolha')),
  opcoes jsonb,
  obrigatoria boolean NOT NULL DEFAULT true,
  competencia_avaliada text                -- ex: "comunicacao", "tecnico"
);

CREATE TABLE IF NOT EXISTS rh.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES rh.ciclos_avaliacao(id),
  formulario_id uuid NOT NULL REFERENCES rh.avaliacao_formularios(id),
  avaliado_id uuid NOT NULL REFERENCES rh.colaboradores(id),
  avaliador_id uuid REFERENCES rh.colaboradores(id),  -- null = autoavaliação
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_andamento','concluida','expirada')),
  prazo date,
  enviado_em timestamptz,
  concluido_em timestamptz,
  nota_final numeric(5,2),                -- calculada agregando respostas
  feedback_texto text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS avaliacoes_ciclo_idx ON rh.avaliacoes(ciclo_id);
CREATE INDEX IF NOT EXISTS avaliacoes_avaliado_idx ON rh.avaliacoes(avaliado_id);

CREATE TABLE IF NOT EXISTS rh.avaliacao_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES rh.avaliacoes(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES rh.avaliacao_perguntas(id),
  resposta_numero numeric(5,2),
  resposta_texto text,
  resposta_jsonb jsonb,
  respondido_em timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- eSocial (estrutura aderente — mensageria fica pra v2)
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.esocial_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  protocolo_envio text,
  recibo text,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','validado','enviado','processado','rejeitado')),
  enviado_em timestamptz,
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh.esocial_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  lote_id uuid REFERENCES rh.esocial_lotes(id),
  tipo_evento text NOT NULL,              -- S-2200, S-2206, S-2299, S-1010, S-1020, S-2230, S-1200...
  contexto_tipo text,                     -- "rh.contrato", "rh.contrato_alteracoes", etc
  contexto_id uuid,
  payload jsonb NOT NULL,                 -- estrutura aderente ao XSD
  xml_gerado text,
  hash text,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','validado','enviado','aceito','rejeitado','retificado','excluido')),
  rejeicao_motivo text,
  retificacao_de uuid REFERENCES rh.esocial_eventos(id),
  enviado_em timestamptz,
  aceito_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS esocial_evt_tipo_idx ON rh.esocial_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS esocial_evt_ctx_idx ON rh.esocial_eventos(contexto_tipo, contexto_id);

-- ============================================================
-- NOTIFICAÇÕES (canal preferido por colaborador)
-- ============================================================

CREATE TABLE IF NOT EXISTS rh.notificacoes_canal_preferencias (
  colaborador_id uuid PRIMARY KEY REFERENCES rh.colaboradores(id),
  whatsapp boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  app boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rh.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid REFERENCES rh.colaboradores(id),
  user_id uuid REFERENCES auth.users(id),
  canal text NOT NULL CHECK (canal IN ('whatsapp','email','app','sms')),
  destino text NOT NULL,                  -- numero/email
  template text,                          -- "admissao_link", "holerite_disponivel", etc
  payload jsonb,                          -- variáveis do template
  mensagem text,                          -- mensagem renderizada (snapshot)
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','enviando','enviada','falhou','cancelada')),
  enviado_em timestamptz,
  resposta_externa jsonb,                 -- response da Evolution / SMTP
  erro text,
  agendado_para timestamptz,
  contexto_tipo text,                     -- "admissao","ferias","holerite",...
  contexto_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_status_idx ON rh.notificacoes(status, agendado_para);
CREATE INDEX IF NOT EXISTS notif_colab_idx ON rh.notificacoes(colaborador_id);

-- ============================================================
-- TRIGGERS de updated_at
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'app_users','lotacoes_tributarias','rubricas',
      'departamentos','times','cargos',
      'colaboradores','dependentes','dados_bancarios',
      'contratos','beneficios',
      'admissoes',
      'escalas','justificativas_ponto',
      'ferias_periodos_aquisitivos','ferias_solicitacoes',
      'competencias','adiantamentos',
      'desligamentos','checklist_templates',
      'treinamentos_catalogo','trilhas','colaborador_treinamentos',
      'avaliacoes',
      'esocial_eventos'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON rh.%I; '
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON rh.%I '
      'FOR EACH ROW EXECUTE FUNCTION rh.set_updated_at()', t, t);
  END LOOP;
END $$;
