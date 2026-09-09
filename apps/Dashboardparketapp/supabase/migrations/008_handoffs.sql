-- ================================================================
-- PARKET DASHBOARD — Tabela de Handoffs Dinâmicos
-- ================================================================

CREATE TABLE IF NOT EXISTS public.handoffs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_from     TEXT        NOT NULL,   -- "Comercial"
  dept_to       TEXT        NOT NULL,   -- "Projetos"
  responsavel_from TEXT,               -- "Closer"
  responsavel_to   TEXT,               -- "Thainara"
  obra          TEXT,                  -- nome livre do cliente/obra
  obra_id       TEXT        REFERENCES public.obras(id) ON DELETE SET NULL,
  item          TEXT        NOT NULL,  -- descrição do que está sendo passado
  status        TEXT        NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente','aceito','vencido','cancelado')),
  sla_hours     INTEGER     NOT NULL DEFAULT 24,
  aceito_em     TIMESTAMPTZ,
  aceito_por    TEXT,
  observacao    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_from    ON public.handoffs (dept_from);
CREATE INDEX IF NOT EXISTS idx_handoffs_to      ON public.handoffs (dept_to);
CREATE INDEX IF NOT EXISTS idx_handoffs_status  ON public.handoffs (status);
CREATE INDEX IF NOT EXISTS idx_handoffs_obra    ON public.handoffs (obra_id);

CREATE OR REPLACE TRIGGER trg_handoffs_updated_at
  BEFORE UPDATE ON public.handoffs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_handoffs" ON public.handoffs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_handoffs" ON public.handoffs
  FOR INSERT WITH CHECK (public.current_user_role() IN ('superadmin','admin','dept_leader'));

CREATE POLICY "auth_update_handoffs" ON public.handoffs
  FOR UPDATE USING (public.current_user_role() IN ('superadmin','admin','dept_leader'));

CREATE POLICY "auth_delete_handoffs" ON public.handoffs
  FOR DELETE USING (public.current_user_role() IN ('superadmin','admin'));

-- ================================================================
-- SEED — Handoffs reais de todos os departamentos
-- ================================================================

INSERT INTO public.handoffs (dept_from, dept_to, responsavel_from, responsavel_to, obra, item, status, sla_hours) VALUES

-- COMERCIAL → outros
('Comercial','Projetos','Closer','Thainara','Claudio Mohn Franca',
  'Contrato + briefing + projeto arq. — 48.6m2 + 46 portas','pendente',24),
('Comercial','Orçamento','Closer','Ranieri','Silvia Alarico Neves',
  'Briefing 3 portas pivotantes — definir madeira','pendente',12),
('Comercial','Atendimento','Closer','Talita','Trocha Family',
  'Dados cliente + stakeholders — projeto internacional','aceito',4),

-- PROJETOS → outros
('Projetos','Produção','Thainara','Germano','Ana Cristina Garcia',
  'Projeto + BOM 10 Portas Pivotantes Nogueira','pendente',8),
('Projetos','Compras','Thainara','Ronaldo','Luana Bastos',
  'BOM 12 Portas + 23m3 Painel Tauari + Cortineiro','pendente',24),
('Projetos','Fiscal','Thainara','Felipe','Bernardo Coutinho',
  'Pre-projeto forro RJ — checklist vistoria','aceito',8),

-- COMPRAS → Produção
('Compras','Produção','Ronaldo','Germano','Alexandre Assumpção',
  'Carvalho Europeu Natural + NF + especificações 4 portas','pendente',12),
('Compras','Produção','Ronaldo','Germano','Bernardo Coutinho',
  'Carvalho Europeu + ferragens 10 portas pivotantes','pendente',24),
('Compras','Produção','Ronaldo','Germano','Luana Bastos',
  'Tauari + acessórios 12 portas + 23m3 painel','pendente',24),

-- PRODUÇÃO → Logística
('Produção','Logística','Germano','Ailton','Paulo Gontijo',
  'Fechadura Rolete + Painéis Cozinha + Closet + Réguas — QC OK','pendente',24),
('Produção','Logística','Germano','Ailton','Inácio Passos',
  '56m2 Forro/Painel Tauari + 1 Porta — embalado','pendente',24),
('Compras','Produção','Ronaldo','Germano','Bernardo Coutinho',
  'Carvalho Europeu + ferragens 10 portas — recebido OK','aceito',4),

-- LOGÍSTICA → Obras
('Logística','Obras','Ailton','Dany','Inácio',
  '56m2 Tauari Forro/Painel + 1 Porta — entrega SP','pendente',4),
('Produção','Logística','Germano','Ailton','Paulo Gontijo',
  'Fechadura + Painéis + Closet — QC pendente','pendente',24),
('Logística','Obras','Ailton','Reinaldo','Casa Florais',
  'Forro Lâmina → Cuiabá + Piso → Brasília','aceito',48),

-- OBRAS → Atendimento / Fiscal
('Obras','Atendimento','Dany','Talita','Fernando Aragon',
  'Checklist acabamento + fotos + termo — finalizado 17/02','pendente',12),
('Fiscal','Obras','Reinaldo','Dany','Ilka',
  'Liberação técnica estrutura BSB','aceito',4),
('Obras','Atendimento','Dany','Talita','Rosana Braido',
  'Acabamento finalizado 17/02 — entrega formal','pendente',12),

-- FINANCEIRO → Compras
('Financeiro','Compras','Karla','Ronaldo','Trocha Family',
  'Aprovação POs Cabreuva — R$ 320k volume','pendente',8),

-- ATENDIMENTO → Fiscal
('Atendimento','Fiscal','Talita','Davi','Bernardo Coutinho',
  'Solicitação vistoria forro RJ + checklist cliente','pendente',8),
('Obras','Atendimento','Dany','Talita','Fernando Aragon',
  'Checklist acabamento + fotos + termo','pendente',12),

-- FISCAL → Obras
('Fiscal','Obras','Reinaldo','Dany','Ilka',
  'Relatório liberação estrutura BSB','pendente',8),
('Fiscal','Obras','Davi','Dany','Bernardo Coutinho',
  'Liberação forro RJ + checklist','pendente',8),
('Fiscal','Obras','Alvaro','Dany','Felipe Almeida',
  'Vistoria parcial pergolado + forro OK','aceito',4),

-- PMO → Financeiro
('PMO','Financeiro','Natalia','Karla','Fernando Aragon',
  'Planilha pagamento final + retenção + termos — obra concluída 17/02','pendente',48),
('PMO','Financeiro','Natalia','Karla','Rosana Braido',
  'Planilha pagamento final + retenção + termos — obra concluída 17/02','pendente',48);

-- ================================================================
-- FUNÇÃO: aceitar handoff
-- ================================================================

CREATE OR REPLACE FUNCTION public.aceitar_handoff(p_id UUID, p_aceito_por TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE public.handoffs
  SET status = 'aceito',
      aceito_em = NOW(),
      aceito_por = p_aceito_por
  WHERE id = p_id AND status = 'pendente';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- VIEW: handoffs com contagem por fluxo departamental
-- ================================================================

CREATE OR REPLACE VIEW public.handoffs_flow AS
SELECT
  dept_from,
  dept_to,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes,
  COUNT(*) FILTER (WHERE status = 'aceito')  AS aceitos,
  COUNT(*) FILTER (WHERE status = 'vencido') AS vencidos,
  BOOL_OR(status = 'vencido') AS tem_vencido
FROM public.handoffs
GROUP BY dept_from, dept_to
ORDER BY total DESC;

-- ================================================================
-- CONCLUÍDO
-- ================================================================
