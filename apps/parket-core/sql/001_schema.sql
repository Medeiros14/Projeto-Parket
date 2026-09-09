-- ============================================================
-- Parket Core — Schema ERP Financeiro
-- Multi-empresa (CNPJs) + Centros de Custo + Obras
-- ============================================================

-- ── EMPRESAS (multi-CNPJ) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS core.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text UNIQUE NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text,
  inscricao_estadual text,
  endereco text,
  cidade text,
  uf text,
  cep text,
  telefone text,
  email text,
  regime_tributario text CHECK (regime_tributario IN ('simples','lucro_presumido','lucro_real')),
  cor text DEFAULT '#B8AA9A',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── CENTROS DE CUSTO (linhas de negócio) ────────────────────
CREATE TABLE IF NOT EXISTS core.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nome text NOT NULL,
  descricao text,
  cor text DEFAULT '#B8AA9A',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── PLANO DE CONTAS (hierárquico) ───────────────────────────
CREATE TABLE IF NOT EXISTS core.plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa','ativo','passivo','patrimonio')),
  natureza text CHECK (natureza IN ('credito','debito')),
  parent_id uuid REFERENCES core.plano_contas(id) ON DELETE SET NULL,
  nivel int NOT NULL,
  analitica boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plano_contas_parent_idx ON core.plano_contas(parent_id);
CREATE INDEX IF NOT EXISTS plano_contas_tipo_idx ON core.plano_contas(tipo);

-- ── PARCEIROS (clientes / fornecedores / vendedores) ────────
CREATE TABLE IF NOT EXISTS core.parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa text NOT NULL CHECK (tipo_pessoa IN ('PF','PJ')),
  documento text,
  nome text NOT NULL,
  fantasia text,
  is_cliente boolean NOT NULL DEFAULT false,
  is_fornecedor boolean NOT NULL DEFAULT false,
  is_vendedor boolean NOT NULL DEFAULT false,
  is_arquiteto boolean NOT NULL DEFAULT false,
  email text,
  telefone text,
  cidade text,
  uf text,
  comissao_padrao numeric(5,2),
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parceiros_cliente_idx ON core.parceiros(is_cliente);
CREATE INDEX IF NOT EXISTS parceiros_fornecedor_idx ON core.parceiros(is_fornecedor);
CREATE INDEX IF NOT EXISTS parceiros_arquiteto_idx ON core.parceiros(is_arquiteto);

-- ── CONTAS BANCÁRIAS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id) ON DELETE CASCADE,
  banco text NOT NULL,
  agencia text,
  conta text,
  tipo text NOT NULL DEFAULT 'corrente' CHECK (tipo IN ('corrente','poupanca','aplicacao','caixa')),
  saldo_inicial numeric(15,2) NOT NULL DEFAULT 0,
  saldo_inicial_data date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contas_bancarias_empresa_idx ON core.contas_bancarias(empresa_id);

-- ── OBRAS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  centro_custo_id uuid NOT NULL REFERENCES core.centros_custo(id),
  codigo text UNIQUE NOT NULL,
  nome text NOT NULL,
  cliente_id uuid REFERENCES core.parceiros(id),
  vendedor_id uuid REFERENCES core.parceiros(id),
  endereco text,
  cidade text,
  uf text,
  data_inicio date,
  previsao_termino date,
  data_termino date,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('orcamento','contratada','em_andamento','concluida','cancelada','garantia')),
  valor_venda numeric(15,2) NOT NULL DEFAULT 0,
  valor_orcamento numeric(15,2),
  margem_prevista numeric(5,2),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS obras_empresa_idx ON core.obras(empresa_id);
CREATE INDEX IF NOT EXISTS obras_cc_idx ON core.obras(centro_custo_id);
CREATE INDEX IF NOT EXISTS obras_cliente_idx ON core.obras(cliente_id);
CREATE INDEX IF NOT EXISTS obras_status_idx ON core.obras(status);

-- ── LANÇAMENTOS (movimento financeiro) ──────────────────────
CREATE TABLE IF NOT EXISTS core.lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  centro_custo_id uuid REFERENCES core.centros_custo(id),
  obra_id uuid REFERENCES core.obras(id),
  parceiro_id uuid REFERENCES core.parceiros(id),
  plano_conta_id uuid NOT NULL REFERENCES core.plano_contas(id),
  conta_bancaria_id uuid REFERENCES core.contas_bancarias(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  status text NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','pago','recebido','cancelado','conciliado')),
  descricao text NOT NULL,
  numero_documento text,
  data_emissao date,
  data_competencia date NOT NULL,
  data_vencimento date NOT NULL,
  data_pagamento date,
  valor numeric(15,2) NOT NULL,
  valor_pago numeric(15,2),
  juros numeric(15,2) NOT NULL DEFAULT 0,
  desconto numeric(15,2) NOT NULL DEFAULT 0,
  forma_pagamento text,
  parcela_atual int NOT NULL DEFAULT 1,
  parcela_total int NOT NULL DEFAULT 1,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lancamentos_empresa_idx ON core.lancamentos(empresa_id);
CREATE INDEX IF NOT EXISTS lancamentos_obra_idx ON core.lancamentos(obra_id);
CREATE INDEX IF NOT EXISTS lancamentos_cc_idx ON core.lancamentos(centro_custo_id);
CREATE INDEX IF NOT EXISTS lancamentos_pc_idx ON core.lancamentos(plano_conta_id);
CREATE INDEX IF NOT EXISTS lancamentos_competencia_idx ON core.lancamentos(data_competencia);
CREATE INDEX IF NOT EXISTS lancamentos_vencimento_idx ON core.lancamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS lancamentos_status_idx ON core.lancamentos(status);
CREATE INDEX IF NOT EXISTS lancamentos_tipo_idx ON core.lancamentos(tipo);

-- ── COMISSÕES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES core.obras(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES core.parceiros(id),
  base_calculo numeric(15,2) NOT NULL,
  percentual numeric(5,2) NOT NULL,
  valor numeric(15,2) NOT NULL,
  status text NOT NULL DEFAULT 'a_pagar' CHECK (status IN ('a_pagar','pago','cancelado')),
  data_pagamento date,
  lancamento_id uuid REFERENCES core.lancamentos(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comissoes_obra_idx ON core.comissoes(obra_id);
CREATE INDEX IF NOT EXISTS comissoes_vendedor_idx ON core.comissoes(vendedor_id);

-- ── IMPOSTOS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core.impostos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES core.empresas(id),
  tipo text NOT NULL CHECK (tipo IN ('DAS','PIS','COFINS','ICMS','ISS','IRPJ','CSLL','INSS','FGTS','OUTROS')),
  competencia text NOT NULL,
  valor numeric(15,2) NOT NULL,
  vencimento date NOT NULL,
  data_pagamento date,
  status text NOT NULL DEFAULT 'a_pagar' CHECK (status IN ('a_pagar','pago','atrasado')),
  lancamento_id uuid REFERENCES core.lancamentos(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS impostos_empresa_idx ON core.impostos(empresa_id);
CREATE INDEX IF NOT EXISTS impostos_status_idx ON core.impostos(status);

-- ============================================================
-- RLS — todos os autenticados podem ler tudo (Fase de simulação)
-- Em fase produtiva, restringir por empresa/role
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['empresas','centros_custo','plano_contas','parceiros',
                        'contas_bancarias','obras','lancamentos','comissoes','impostos'])
  LOOP
    EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth read" ON core.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin write" ON core.%I', t);
    EXECUTE format('CREATE POLICY "auth read" ON core.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "admin write" ON core.%I FOR ALL TO authenticated USING (core.is_admin()) WITH CHECK (core.is_admin())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON core.%I TO authenticated', t);
  END LOOP;
END $$;
