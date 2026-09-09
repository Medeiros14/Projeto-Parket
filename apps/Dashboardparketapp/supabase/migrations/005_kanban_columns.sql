-- ================================================================
-- Parket Dashboard — Kanban Columns
-- Execute no Supabase Dashboard > SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id     TEXT    NOT NULL,
  slug        TEXT    NOT NULL,        -- matches kanban_cards.column_id
  title       TEXT    NOT NULL,
  color       TEXT    NOT NULL DEFAULT 'gray',
  position    INTEGER NOT NULL DEFAULT 0,
  is_handoff  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dept_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_dept ON public.kanban_columns (dept_id, position);

CREATE OR REPLACE TRIGGER trg_kanban_columns_updated_at
  BEFORE UPDATE ON public.kanban_columns
  FOR EACH ROW EXECUTE FUNCTION public.set_kanban_updated_at();

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_columns" ON public.kanban_columns
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_columns" ON public.kanban_columns
  FOR ALL USING (public.current_user_role() IN ('superadmin', 'admin', 'dept_leader'));

-- ================================================================
-- Seed: all 77 columns across 13 departments
-- ================================================================

INSERT INTO public.kanban_columns (dept_id, slug, title, color, position, is_handoff) VALUES
-- COMERCIAL
('comercial','prospeccao','Prospecção','gray',0,false),
('comercial','qualificacao','Qualificação','blue',1,false),
('comercial','proposta','Proposta','purple',2,false),
('comercial','negociacao','Negociação','orange',3,false),
('comercial','fechamento','Fechamento','green',4,false),
('comercial','handoff','Handoff → Projetos','teal',5,true),
-- PROJETOS
('projetos','briefing','Briefing Recebido','gray',0,false),
('projetos','desenvolvimento','Em Desenvolvimento','blue',1,false),
('projetos','revisao','Revisão / Bloqueado','yellow',2,false),
('projetos','aprovado','Projeto Aprovado / Gate Freeze','green',3,false),
('projetos','bom','BOM Gerado → Compras','purple',4,false),
('projetos','handoff-compras','Handoff → Compras/Produção','teal',5,true),
-- COMPRAS
('compras','requisicao','Requisição Recebida','gray',0,false),
('compras','cotacao','Em Cotação','blue',1,false),
('compras','po','PO Emitida','purple',2,false),
('compras','aguardando','Aguardando Entrega','yellow',3,false),
('compras','recebido','Material Recebido / OK','green',4,false),
('compras','handoff-prod','Handoff → Produção','teal',5,true),
-- PRODUCAO
('producao','a-iniciar','A Iniciar','gray',0,false),
('producao','checklist','Checklist / Preparação','blue',1,false),
('producao','em-producao','Em Produção','orange',2,false),
('producao','qc','QC / Liberado','green',3,false),
('producao','handoff-log','Handoff → Logística','teal',4,true),
-- LOGISTICA
('logistica','pronto','Material Pronto','gray',0,false),
('logistica','separacao','Separação / Conferência','blue',1,false),
('logistica','carregamento','Carregamento','purple',2,false),
('logistica','transito','Em Trânsito','orange',3,false),
('logistica','entregue','Entregue em Obra','green',4,false),
('logistica','handoff-obras','Handoff → Obras','teal',5,true),
-- OBRAS
('obras','mobilizacao','Mobilização / Aguardando','gray',0,false),
('obras','execucao','Em Execução','orange',1,false),
('obras','travado','TRAVADO / BLOQUEADO','red',2,false),
('obras','reparos','Reparos / Acabamento','yellow',3,false),
('obras','finalizado','Finalizado / Entrega','green',4,false),
('obras','handoff-pos','Handoff → Pós-Obra','teal',5,true),
-- FINANCEIRO
('financeiro','contrato','Contrato Assinado','gray',0,false),
('financeiro','medicao','Medição Pendente','blue',1,false),
('financeiro','faturamento','Faturamento','orange',2,false),
('financeiro','cobranca','Cobrança / Inadimplência','yellow',3,false),
('financeiro','recebido','Recebido','green',4,false),
-- ATENDIMENTO
('atendimento','onboarding','Onboarding','pink',0,false),
('atendimento','acompanhamento','Acompanhamento Ativo','blue',1,false),
('atendimento','entrega-formal','Entrega Formal','green',2,false),
('atendimento','pos-venda','Pós-Venda / NPS','teal',3,false),
('atendimento','fechado','Fechado / Arquivado','gray',4,false),
-- FISCAL
('fiscal','agendada','Agendada','gray',0,false),
('fiscal','em-campo','Em Campo / Acompanhamento','blue',1,false),
('fiscal','relatorio','Relatório Pendente','yellow',2,false),
('fiscal','liberada','Liberada','green',3,false),
('fiscal','bloqueada','Bloqueada / Impedida','red',4,false),
-- PMO (produtividade)
('produtividade','pre-crono','Pré-Cronograma','gray',0,false),
('produtividade','ativo','Monitoramento Ativo','teal',1,false),
('produtividade','pagamento','Pagamento / Retenção','orange',2,false),
('produtividade','aceite','Termo de Aceite','yellow',3,false),
('produtividade','encerrado','Encerrado','green',4,false),
-- MARKETING
('marketing','briefing','Briefing de Case','gray',0,false),
('marketing','criacao','Em Criação','pink',1,false),
('marketing','revisao-mkt','Revisão','yellow',2,false),
('marketing','publicacao','Publicação','green',3,false),
('marketing','analise','Análise / Portfolio','teal',4,false),
-- RH
('rh','vaga','Vaga Aberta','gray',0,false),
('rh','alocacao','Alocação de Equipes','blue',1,false),
('rh','producao-equipes','Equipes Marcenaria (Fábrica)','orange',2,false),
('rh','internacional','Equipes Internacionais/Viagem','purple',3,false),
('rh','treinamento','Treinamento / Onboarding','green',4,false),
-- ORCAMENTO
('orcamento','solicitacao','Solicitação Recebida','gray',0,false),
('orcamento','analise-orc','Em Análise','blue',1,false),
('orcamento','calculo','Em Cálculo','yellow',2,false),
('orcamento','proposta-pronta','Proposta Pronta / Enviada','green',3,false),
('orcamento','handoff-com','Enviada ao Comercial','teal',4,true)
ON CONFLICT (dept_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  color = EXCLUDED.color,
  position = EXCLUDED.position,
  is_handoff = EXCLUDED.is_handoff;
