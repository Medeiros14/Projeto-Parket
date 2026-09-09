-- ================================================================
-- PARKET DASHBOARD — Activity Feed Dinâmico por Departamento
-- ================================================================

CREATE TABLE IF NOT EXISTS public.dept_activities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id     TEXT        NOT NULL,
  text        TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'action'
              CHECK (type IN ('action','update','alert','completed')),
  user_name   TEXT,
  obra        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_activities_dept ON public.dept_activities (dept_id, created_at DESC);

ALTER TABLE public.dept_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_activities" ON public.dept_activities
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_activities" ON public.dept_activities
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ================================================================
-- TRIGGER: auto-loga handoffs como atividades
-- ================================================================
CREATE OR REPLACE FUNCTION public.log_handoff_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log na fila de saída (dept_from)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dept_activities (dept_id, text, type, obra)
    VALUES (
      LOWER(NEW.dept_from),
      'Handoff enviado para ' || NEW.dept_to || COALESCE(' — ' || NEW.item, ''),
      'action',
      NEW.obra
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    IF NEW.status = 'aceito' THEN
      INSERT INTO public.dept_activities (dept_id, text, type, obra)
      VALUES (
        LOWER(NEW.dept_to),
        'Handoff de ' || NEW.dept_from || ' aceito — ' || COALESCE(NEW.item, ''),
        'completed',
        NEW.obra
      );
    ELSIF NEW.status = 'vencido' THEN
      INSERT INTO public.dept_activities (dept_id, text, type, obra)
      VALUES (
        LOWER(NEW.dept_to),
        'Handoff de ' || NEW.dept_from || ' VENCIDO — ' || COALESCE(NEW.item, ''),
        'alert',
        NEW.obra
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_handoff_activity
  AFTER INSERT OR UPDATE ON public.handoffs
  FOR EACH ROW EXECUTE FUNCTION public.log_handoff_activity();

-- ================================================================
-- TRIGGER: auto-loga novos alertas como atividades
-- ================================================================
CREATE OR REPLACE FUNCTION public.log_alerta_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT NEW.auto_generated THEN
    INSERT INTO public.dept_activities (dept_id, text, type)
    VALUES (
      LOWER(NEW.dept),
      CASE NEW.severity WHEN 'critical' THEN '🔴 ' WHEN 'warning' THEN '⚠️ ' ELSE 'ℹ️ ' END || NEW.message,
      CASE NEW.severity WHEN 'critical' THEN 'alert' WHEN 'warning' THEN 'alert' ELSE 'update' END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_alerta_activity
  AFTER INSERT ON public.alertas
  FOR EACH ROW EXECUTE FUNCTION public.log_alerta_activity();

-- ================================================================
-- SEED — atividades reais iniciais por departamento
-- ================================================================
INSERT INTO public.dept_activities (dept_id, text, type, obra, created_at) VALUES

-- COMERCIAL
('comercial','Rafael enviou proposta v2 para Corp. Berrini — R$ 185k','action',NULL, NOW() - INTERVAL '2h'),
('comercial','Proposta Jorbel (Paraguay) aprovada — contrato assinado','completed','Jorbel', NOW() - INTERVAL '5h'),
('comercial','Lead Silvia Alarico sem contato há 7 dias — risco de perda','alert',NULL, NOW() - INTERVAL '8h'),
('comercial','Marina agendou showroom Res. Alphaville para Qui 15h','action',NULL, NOW() - INTERVAL '1d'),
('comercial','Meta fechamento batida: 34% vs 30% — parabéns equipe!','completed',NULL, NOW() - INTERVAL '1d 8h'),

-- PROJETOS
('projetos','Projeto Claudio Mohn Franca iniciado — briefing recebido','action','Claudio Mohn Franca', NOW() - INTERVAL '3h'),
('projetos','Eduardo Grunebaum BLOQUEADO — cliente indisponível há 5 dias','alert','Eduardo Grunebaum', NOW() - INTERVAL '6h'),
('projetos','BOM Ana Cristina Garcia aprovada — handoff p/ Compras','completed','Ana Cristina Garcia', NOW() - INTERVAL '1d'),
('projetos','Revisão projeto Bernardo Coutinho concluída — Gate OK','completed','Bernardo Coutinho', NOW() - INTERVAL '2d'),
('projetos','Pedro Campos: obra paralisada — prioridade Priscila Dear','alert','Pedro Campos', NOW() - INTERVAL '2d 6h'),

-- COMPRAS
('compras','PO Bernardo Coutinho emitida — Carvalho Europeu R$ 67k','action','Bernardo Coutinho', NOW() - INTERVAL '4h'),
('compras','Trocha Family: PO Cabreuva R$ 320k aguardando aprovação','alert','Trocha Family', NOW() - INTERVAL '6h'),
('compras','Material Alexandre Assumpção recebido — OK 17/02','completed','Alexandre Assumpção', NOW() - INTERVAL '1d'),
('compras','Cotação Luana Bastos em andamento — 3 fornecedores','update','Luana Bastos', NOW() - INTERVAL '1d 4h'),
('compras','Amanda Rosales: PO Carvalho Mont Blanc emitida R$ 38k','action','Amanda Rosales', NOW() - INTERVAL '2d'),

-- PRODUÇÃO
('producao','Trocha Family: produção iniciada — equipe Marivaldo','action','Trocha Family', NOW() - INTERVAL '2h'),
('producao','Eduardo Grunebaum: BLOQUEADO — 1 card vencido','alert','Eduardo Grunebaum', NOW() - INTERVAL '5h'),
('producao','Casa Florais: 65% concluído — no prazo','update','Casa Florais', NOW() - INTERVAL '1d'),
('producao','Paulo Gontijo: QC aprovado — handoff p/ Logística','completed','Paulo Gontijo', NOW() - INTERVAL '1d 6h'),
('producao','Fazenda Santa Eliza: produção 45% — dentro do SLA','update','Fazenda Santa Eliza', NOW() - INTERVAL '2d'),

-- LOGÍSTICA
('logistica','Inácio Passos: material carregado — saída SP','action','Inácio Passos', NOW() - INTERVAL '3h'),
('logistica','Jorbel (Paraguay): DOCUMENTAÇÃO PENDENTE — SLA vencido','alert','Jorbel', NOW() - INTERVAL '5h'),
('logistica','Casa Florais (Cuiabá): em trânsito — ETA 2 dias','update','Casa Florais', NOW() - INTERVAL '8h'),
('logistica','Pedro Campos (BSB): entregue — conferência OK','completed','Pedro Campos', NOW() - INTERVAL '1d'),
('logistica','Maria e Mel (MG): carregamento confirmado hoje','action','Maria e Mel', NOW() - INTERVAL '2d'),

-- OBRAS
('obras','Felipe Almeida (Baronesa): 35% concluído — no prazo','update','Felipe Almeida', NOW() - INTERVAL '2h'),
('obras','Rafaela Dimasi (SP): TRAVADO — equipe bloqueada','alert','Rafaela Dimasi', NOW() - INTERVAL '4h'),
('obras','Fernando Aragon: finalizado 17/02 — entrega formal agendada','completed','Fernando Aragon', NOW() - INTERVAL '8h'),
('obras','Jorbel (Paraguay): 15% — início execução OK','update','Jorbel', NOW() - INTERVAL '1d'),
('obras','Gabriel Lacher (BSB): TRAVADO — aguardando liberação','alert','Gabriel Lacher', NOW() - INTERVAL '1d 6h'),

-- FINANCEIRO
('financeiro','Medição PKT-053 aprovada — faturar R$ 145k','completed',NULL, NOW() - INTERVAL '3h'),
('financeiro','3 POs aguardando aprovação — Ronaldo cobrando','alert',NULL, NOW() - INTERVAL '5h'),
('financeiro','PKT-050: margem caindo — 28.9% vs 32.8% orçado','alert',NULL, NOW() - INTERVAL '1d'),
('financeiro','PKT-045: Parcela 2 vencida há 8 dias (R$ 28k)','alert',NULL, NOW() - INTERVAL '1d 6h'),
('financeiro','NF parcial Casa Florais emitida — R$ 78k','action',NULL, NOW() - INTERVAL '2d'),

-- ATENDIMENTO
('atendimento','Trocha Family: onboarding internacional iniciado','action','Trocha Family', NOW() - INTERVAL '2h'),
('atendimento','Fernando Aragon: NPS coletado — nota 9.2','completed','Fernando Aragon', NOW() - INTERVAL '4h'),
('atendimento','Pedro Campos (BSB): cliente cobrando — obra paralisada','alert','Pedro Campos', NOW() - INTERVAL '8h'),
('atendimento','Ricardo Fanin: entrega formal concluída','completed','Ricardo Fanin', NOW() - INTERVAL '1d'),
('atendimento','Rosana Braido: entrega formal agendada 19/03','action','Rosana Braido', NOW() - INTERVAL '2d'),

-- FISCAL
('fiscal','Ilka (BSB): liberação técnica emitida','completed','Ilka', NOW() - INTERVAL '3h'),
('fiscal','Rafaela Dimasi: vistoria BLOQUEADA — não agendar','alert','Rafaela Dimasi', NOW() - INTERVAL '5h'),
('fiscal','Bernardo Coutinho (RJ): vistoria forro agendada 27/03','action','Bernardo Coutinho', NOW() - INTERVAL '1d'),
('fiscal','Felipe Almeida (Baronesa): vistoria parcial OK','completed','Felipe Almeida', NOW() - INTERVAL '2d'),
('fiscal','Ana Cristina (GO): fiscalização agendada 13/03','action','Ana Cristina', NOW() - INTERVAL '2d 6h'),

-- PMO (produtividade)
('produtividade','Fernando Aragon: termo de aceite PENDENTE — vencido','alert','Fernando Aragon', NOW() - INTERVAL '2h'),
('produtividade','Rosana Braido: planilha pagamento final enviada p/ Financeiro','action','Rosana Braido', NOW() - INTERVAL '5h'),
('produtividade','Pedro Campos (BSB): produtividade 0 há 10 dias — alerta','alert','Pedro Campos', NOW() - INTERVAL '1d'),
('produtividade','Roberto Bloes: encerrado — aceite + pagamento OK','completed','Roberto Bloes', NOW() - INTERVAL '2d'),
('produtividade','Felipe Almeida: monitoramento diário ativo (Fim: 06/03)','update','Felipe Almeida', NOW() - INTERVAL '2d 6h'),

-- RH
('rh','Vaga 2o Fiscal BSB/GO: candidato entrevistado — aguarda decisão','update',NULL, NOW() - INTERVAL '3h'),
('rh','Vanderson/Kauan/Sidney disponíveis — realocação pendente','alert',NULL, NOW() - INTERVAL '5h'),
('rh','Ademir 4: equipe embarcou para Paraguay — documentação OK','completed',NULL, NOW() - INTERVAL '1d'),
('rh','Cleiton sobrecarregado — monitorar carga Pedro Paulo Ramos','alert',NULL, NOW() - INTERVAL '2d'),
('rh','Treinamento CNC agendado — 2 marceneiros matriculados','action',NULL, NOW() - INTERVAL '2d 6h'),

-- ORÇAMENTO
('orcamento','Claudio Mohn Franca: proposta R$ 420k aprovada — contrato fechado','completed','Claudio Mohn Franca', NOW() - INTERVAL '2h'),
('orcamento','Silvia Alarico: orçamento bloqueado — madeira sem definição','alert','Silvia Alarico', NOW() - INTERVAL '5h'),
('orcamento','GIC Patrimonial: cálculo travado — fechaduras pendentes','alert','GIC Patrimonial', NOW() - INTERVAL '8h'),
('orcamento','Trocha Family: orçamento R$ 850k em cálculo — complexidade alta','update','Trocha Family', NOW() - INTERVAL '1d'),
('orcamento','Jorbel (Paraguay): proposta enviada ao Comercial','action','Jorbel', NOW() - INTERVAL '2d'),

-- MARKETING
('marketing','Case Fernando Aragon publicado no Instagram — 2.4k views','completed',NULL, NOW() - INTERVAL '4h'),
('marketing','Briefing Trocha Family (projeto internacional) em criação','action',NULL, NOW() - INTERVAL '8h'),
('marketing','Revisão case Pedro Campos — fotos pendentes da obra','update',NULL, NOW() - INTERVAL '1d'),
('marketing','Portfolio digital atualizado — 3 novos cases','completed',NULL, NOW() - INTERVAL '2d'),
('marketing','Story revestimento Carvalho 800+ curtidas','completed',NULL, NOW() - INTERVAL '3d');

-- ================================================================
-- CONCLUÍDO
-- ================================================================
