-- ================================================================
-- PARKET DASHBOARD — Tabela de Obras
-- Cole no Supabase Dashboard → SQL Editor e clique RUN
-- ================================================================

CREATE TABLE IF NOT EXISTS public.obras (
  id                TEXT        PRIMARY KEY,  -- ex: "OBR-001"
  cliente           TEXT        NOT NULL,
  localizacao       TEXT,
  regiao            TEXT        NOT NULL DEFAULT 'SP'
                                CHECK (regiao IN ('SP','RJ','BSB','MG','BA','MT','GO','RS','PR','PY','OTHER')),
  servicos          TEXT[]      NOT NULL DEFAULT '{}',
  equipes           JSONB       NOT NULL DEFAULT '[]',
  -- equipes: [{ nome: TEXT, tipo: "marcenaria"|"instalacao", servico: TEXT }]
  fiscais           TEXT[]      NOT NULL DEFAULT '{}',
  status            TEXT        NOT NULL DEFAULT 'aguardando'
                                CHECK (status IN ('em_execucao','mobilizacao','acabamento','travado','aguardando','finalizado')),
  data_finalizacao  DATE,
  valor_estimado    TEXT,
  valor_num         NUMERIC     GENERATED ALWAYS AS (
    CASE
      WHEN valor_estimado IS NULL THEN 0
      ELSE (regexp_replace(valor_estimado, '[^0-9.]', '', 'g')::NUMERIC * 1000)
    END
  ) STORED,
  progresso         INTEGER     NOT NULL DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  gate              INTEGER     NOT NULL DEFAULT 1,
  prioridade        TEXT        NOT NULL DEFAULT 'media'
                                CHECK (prioridade IN ('alta','media','baixa')),
  obs               TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obras_status    ON public.obras (status);
CREATE INDEX IF NOT EXISTS idx_obras_regiao    ON public.obras (regiao);
CREATE INDEX IF NOT EXISTS idx_obras_prioridade ON public.obras (prioridade);

CREATE OR REPLACE TRIGGER trg_obras_updated_at
  BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler obras
CREATE POLICY "auth_read_obras" ON public.obras
  FOR SELECT USING (auth.role() = 'authenticated');

-- Apenas admins e líderes podem escrever
CREATE POLICY "auth_write_obras" ON public.obras
  FOR INSERT WITH CHECK (public.current_user_role() IN ('superadmin', 'admin', 'dept_leader'));

CREATE POLICY "auth_update_obras" ON public.obras
  FOR UPDATE USING (public.current_user_role() IN ('superadmin', 'admin', 'dept_leader'));

CREATE POLICY "auth_delete_obras" ON public.obras
  FOR DELETE USING (public.current_user_role() IN ('superadmin', 'admin'));

-- ================================================================
-- SEED — 41 obras reais do cronograma
-- ================================================================

INSERT INTO public.obras (id, cliente, localizacao, regiao, servicos, equipes, fiscais, status, data_finalizacao, valor_estimado, progresso, gate, prioridade, obs) VALUES
('OBR-001','PEDRO CAMPOS','Brasília - DF','BSB',
  ARRAY['Beiral','Aditivo Cavas','Deck/Pinos','Rooftop','Reparo Piso'],
  '[{"nome":"JAILTON E IGOR","tipo":"marcenaria","servico":"Beiral"},{"nome":"CARLOS E RAY","tipo":"marcenaria","servico":"Beiral"},{"nome":"RODNEY E RAY FLAVIANO","tipo":"marcenaria","servico":"Aditivo Cavas"},{"nome":"REINALDO 2","tipo":"instalacao","servico":"Reparo Piso"}]',
  ARRAY['REINALDO'],'em_execucao','2026-02-13','R$ 385k',72,3,'alta','Obra grande em Brasília — múltiplas frentes'),

('OBR-002','MARIA E MEL','Nova Lima - MG','MG',
  ARRAY['Marcenaria','Piso','Forro','Deck'],
  '[{"nome":"VINY E WILSON","tipo":"marcenaria","servico":"Marcenaria"},{"nome":"RAMON E KAIQUE","tipo":"marcenaria","servico":"Marcenaria"},{"nome":"GEOMARIO (4)","tipo":"instalacao","servico":"Piso Forro/Deck"}]',
  ARRAY['DAVI'],'em_execucao','2026-02-20','R$ 290k',65,3,'alta','Solicitação fita e deck'),

('OBR-003','INACIO','São Paulo - SP','SP',
  ARRAY['Marcenaria'],
  '[{"nome":"JOSEMARIO E ALTAIR","tipo":"marcenaria","servico":"Marcenaria"},{"nome":"MOISES E ALESSANDRO","tipo":"marcenaria","servico":"Marcenaria"}]',
  ARRAY[]::TEXT[],'em_execucao','2026-03-06','R$ 210k',45,3,'media',NULL),

('OBR-004','LEANDRO SILVA','São Paulo / Riviera - SP','SP',
  ARRAY['Acabamento','Rodateto'],
  '[{"nome":"LUIZ E LOURIVAL","tipo":"marcenaria","servico":"Acabamento"},{"nome":"FERNANDO E SILVIO","tipo":"marcenaria","servico":"Rodateto"},{"nome":"LUIS NOVO E VALDEDY","tipo":"marcenaria","servico":"Acabamento"}]',
  ARRAY[]::TEXT[],'acabamento',NULL,'R$ 175k',85,4,'media',NULL),

('OBR-005','AUREA ITAIM','São Paulo - SP','SP',
  ARRAY['Marcenaria','Portas','Escada'],
  '[{"nome":"ANDERSON E BRUNO","tipo":"marcenaria","servico":"Marcenaria"},{"nome":"EMERSON E ATILA","tipo":"marcenaria","servico":"Portas"},{"nome":"GEADSON E WALISSON","tipo":"marcenaria","servico":"Escada"}]',
  ARRAY[]::TEXT[],'em_execucao',NULL,'R$ 320k',55,3,'alta',NULL),

('OBR-006','PRISCILA DEAR','Riviera / São Paulo - SP','SP',
  ARRAY['Reparo-Bandeira','Acabamento'],
  '[{"nome":"ANDERSON E BRUNO","tipo":"marcenaria","servico":"Reparo-Bandeira"},{"nome":"LUIZ E LOURIVAL","tipo":"marcenaria","servico":"Acabamento"}]',
  ARRAY[]::TEXT[],'em_execucao',NULL,'R$ 95k',40,3,'media','Custo — reparo e acabamento'),

('OBR-007','CASA FLORAES','Cuiabá - MT / Brasília - DF','MT',
  ARRAY['Forro Lâmina','Piso'],
  '[{"nome":"EDUARDO E LUCID","tipo":"marcenaria","servico":"Forro Lâmina"},{"nome":"LUCAS E AJUDANTE","tipo":"marcenaria","servico":"Forro Lâmina"},{"nome":"DAVID E AJUDANTE","tipo":"marcenaria","servico":"Forro Lâmina"},{"nome":"REINALDO 3","tipo":"instalacao","servico":"Piso"}]',
  ARRAY['REINALDO'],'em_execucao','2026-02-20','R$ 260k',50,3,'alta','Custo — múltiplas equipes em forro'),

('OBR-008','FELIPE ALMEIDA','Baronesa - SP','SP',
  ARRAY['Pergolado','Forro Projeto'],
  '[{"nome":"ALAN (2)","tipo":"instalacao","servico":"Pergolado"},{"nome":"BEDEU (5)","tipo":"instalacao","servico":"Forro Projeto"}]',
  ARRAY['ALVARO'],'em_execucao','2026-03-06','R$ 340k',35,3,'alta','Diário'),

('OBR-009','LUIZ ANDRÉ','Guarujá / São Paulo - SP','SP',
  ARRAY['Acabamento','Reparo Piso','Raspagem Deck'],
  '[{"nome":"VANDERSON, KAUAN E SIDNEY","tipo":"instalacao","servico":"Acabamento"},{"nome":"ALEXANDRE E RAFAEL","tipo":"instalacao","servico":"Reparo Piso"},{"nome":"JUAN E GEOVANI","tipo":"instalacao","servico":"Reparo Piso"},{"nome":"ROGERIO","tipo":"instalacao","servico":"Raspagem Deck"}]',
  ARRAY['ALVARO'],'em_execucao',NULL,'R$ 220k',60,3,'media',NULL),

('OBR-010','FERNANDO ARAGON','São Paulo - SP','SP',
  ARRAY['Acabamento'],
  '[{"nome":"VANDERSON, KAUAN E SIDNEY","tipo":"instalacao","servico":"Acabamento"}]',
  ARRAY['ALVARO'],'acabamento','2026-02-17','R$ 155k',90,4,'baixa',NULL),

('OBR-011','ROSANA BRAIDO','São Paulo - SP','SP',
  ARRAY['Acabamento'],
  '[{"nome":"VANDERSON, KAUAN E SIDNEY","tipo":"instalacao","servico":"Acabamento"}]',
  ARRAY['ALVARO'],'acabamento','2026-02-17','R$ 130k',88,4,'baixa',NULL),

('OBR-012','THIAGO MIRANDA','São Paulo - SP','SP',
  ARRAY['Revestimento Suíte'],
  '[{"nome":"ISAQUE","tipo":"instalacao","servico":"Revestimento Suíte"}]',
  ARRAY['ALVARO'],'em_execucao','2026-03-13','R$ 185k',30,3,'media',NULL),

('OBR-013','RUBENS FUGISACK','São Paulo - SP','SP',
  ARRAY['Instalação Piso'],
  '[{"nome":"DIEGO JAISON","tipo":"instalacao","servico":"Instalação Piso"}]',
  ARRAY['CRISTIANO'],'em_execucao',NULL,'R$ 145k',25,3,'media',NULL),

('OBR-014','RAFAELA DIMASI','São Paulo - SP','SP',
  ARRAY['Forro'],
  '[{"nome":"TRAVADO","tipo":"instalacao","servico":"Forro"}]',
  ARRAY['CRISTIANO'],'travado',NULL,'R$ 110k',10,2,'media',NULL),

('OBR-015','BRUNO SAID','São Paulo - SP','SP',
  ARRAY['Fechamento Painel'],
  '[{"nome":"BRUNO SAID","tipo":"marcenaria","servico":"Marcenaria"},{"nome":"VAGNER E RAFAEL","tipo":"instalacao","servico":"Fechamento Painel"}]',
  ARRAY['ALVARO'],'em_execucao',NULL,'R$ 120k',45,3,'media',NULL),

('OBR-016','DIOGO','São Paulo - SP','SP',
  ARRAY['Deck 8m²'],
  '[{"nome":"VAGNER E RAFAEL","tipo":"instalacao","servico":"8m² de Deck"}]',
  ARRAY['VAGNER'],'em_execucao',NULL,'R$ 35k',60,3,'baixa',NULL),

('OBR-017','RUBEN FEFFER','Guarujá - SP','SP',
  ARRAY['Deck'],
  '[{"nome":"VAGNER E RAFAEL","tipo":"instalacao","servico":"Deck"}]',
  ARRAY['VAGNER'],'aguardando',NULL,'R$ 78k',0,2,'media',NULL),

('OBR-018','DAVIDSON','São Paulo - SP','SP',
  ARRAY['Remoção Forro'],
  '[{"nome":"VAGNER E RAFAEL","tipo":"instalacao","servico":"Remoção Forro"}]',
  ARRAY['VAGNER'],'em_execucao',NULL,'R$ 42k',70,3,'baixa',NULL),

('OBR-019','MARISTELA','São Paulo - SP','SP',
  ARRAY['Acabamento Escada'],
  '[{"nome":"VAGNER E RAFAEL","tipo":"instalacao","servico":"Acabamento Escada"}]',
  ARRAY['VAGNER'],'em_execucao',NULL,'R$ 55k',50,3,'media',NULL),

('OBR-020','RICARDO ERNESTO','Porto Alegre - RS','RS',
  ARRAY['Reparo Piso'],
  '[{"nome":"CARLÃO E JOCEVANIO","tipo":"instalacao","servico":"Reparo Piso"}]',
  ARRAY['CARLOS'],'em_execucao',NULL,'R$ 65k',40,3,'media',NULL),

('OBR-021','ROBERTO BLOES','São Paulo - SP','SP',
  ARRAY['Forro'],
  '[{"nome":"ISMAEL","tipo":"instalacao","servico":"Forro"}]',
  ARRAY['DAVI'],'em_execucao','2026-02-24','R$ 92k',75,3,'media',NULL),

('OBR-022','RICARDO FANIN','São Paulo - SP','SP',
  ARRAY['Piso'],
  '[{"nome":"HENRIQUE-DANY(2)","tipo":"instalacao","servico":"Piso"}]',
  ARRAY['CRISTIANO'],'finalizado','2026-02-13','R$ 125k',100,5,'baixa',NULL),

('OBR-023','SANTA ELISA','Holambra / São Paulo - SP','SP',
  ARRAY['Vigas e Piso','Marcenaria'],
  '[{"nome":"HENRIQUE (2)","tipo":"instalacao","servico":"Vigas e Piso"},{"nome":"MARCO ANTONIO","tipo":"marcenaria","servico":"Marcenaria"}]',
  ARRAY['ALVARO'],'em_execucao','2026-02-13','R$ 195k',55,3,'media','Diário — Custo'),

('OBR-024','BERNADO COUTINHO','Rio de Janeiro - RJ','RJ',
  ARRAY['Forro'],
  '[{"nome":"GERALDO (3)","tipo":"instalacao","servico":"Forro"}]',
  ARRAY['DAVI'],'em_execucao','2026-03-27','R$ 180k',20,3,'media',NULL),

('OBR-025','LUANA BASTOS','Rio de Janeiro - RJ','RJ',
  ARRAY['Forro'],
  '[{"nome":"REGIS (3)","tipo":"instalacao","servico":"Forro"}]',
  ARRAY['DAVI'],'mobilizacao',NULL,'R$ 150k',5,2,'media',NULL),

('OBR-026','BRADESCO IRECÊ/SALVADOR','Irecê - BA','BA',
  ARRAY['Instalação Taco'],
  '[{"nome":"DANY(3)","tipo":"instalacao","servico":"Instalação Taco"}]',
  ARRAY[]::TEXT[],'em_execucao','2026-03-27','R$ 88k',30,3,'media','Diário — Projeto corporativo'),

('OBR-027','BRADESCO CEILÂNDIA','Cuiabá - MT','MT',
  ARRAY['Instalação Taco'],
  '[{"nome":"DANY(3)","tipo":"instalacao","servico":"Instalação Taco"}]',
  ARRAY[]::TEXT[],'aguardando',NULL,'R$ 75k',0,2,'media',NULL),

('OBR-028','JORBEL','Paraguay','PY',
  ARRAY['Piso','Forro','Deck'],
  '[{"nome":"ADEMIR 4","tipo":"instalacao","servico":"Piso-Forro e Deck"}]',
  ARRAY['REINALDO'],'em_execucao','2026-04-30','R$ 420k',15,3,'alta','Projeto internacional'),

('OBR-029','ILKA','Brasília - DF','BSB',
  ARRAY['Estrutura'],
  '[{"nome":"REINALDO 3","tipo":"instalacao","servico":"Estrutura"}]',
  ARRAY['REINALDO'],'em_execucao','2026-03-20','R$ 165k',30,3,'media',NULL),

('OBR-030','GABRIEL LACHER','Brasília - DF','BSB',
  ARRAY['Piso e Painel','Trilho/Brises'],
  '[{"nome":"TRAVADO","tipo":"instalacao","servico":"Piso e Painel"},{"nome":"NIVALDO E VALDINEY","tipo":"marcenaria","servico":"Trilho"}]',
  ARRAY['REINALDO'],'travado','2026-03-13','R$ 275k',20,2,'alta','Travado — aguardando liberação'),

('OBR-031','ANA CRISTINA','Jataí - GO','GO',
  ARRAY['Revestimento Forro'],
  '[{"nome":"TRAVADO","tipo":"instalacao","servico":"Revestimento Forro"}]',
  ARRAY['REINALDO'],'travado','2026-03-13','R$ 110k',5,2,'media',NULL),

('OBR-032','PEDRO RAMOS','Brasília - DF','BSB',
  ARRAY['Estrutura de Forro'],
  '[{"nome":"REINALDO 2","tipo":"instalacao","servico":"Estrutura de Forro"}]',
  ARRAY['REINALDO'],'mobilizacao',NULL,'R$ 140k',10,2,'media',NULL),

('OBR-033','BRUNO LIMA','Salvador - BA','BA',
  ARRAY['Reparo Deck'],
  '[{"nome":"MATERIAL","tipo":"instalacao","servico":"Reparo Deck"}]',
  ARRAY['REINALDO'],'aguardando','2026-03-13','R$ 48k',0,2,'baixa','Aguardando material'),

('OBR-034','FERNANDO E MARAÍSA','Goiânia - GO','GO',
  ARRAY['Estrutura Painel'],
  '[{"nome":"REINALDO 2","tipo":"instalacao","servico":"Estrutura Painel"}]',
  ARRAY['REINALDO'],'travado',NULL,'R$ 195k',0,2,'media','TRAVADO'),

('OBR-035','VALTER E RENATA','São Paulo - SP','SP',
  ARRAY['Forro','Lustração/Painel'],
  '[{"nome":"EDMILSON E RAMON","tipo":"marcenaria","servico":"Lustração"}]',
  ARRAY['DAVI'],'aguardando',NULL,'R$ 165k',5,2,'media',NULL),

('OBR-036','ANDRE GURGEL','São Paulo - SP','SP',
  ARRAY['Forro 5° Andar'],
  '[]',
  ARRAY['CRISTIANO'],'aguardando','2026-02-13','R$ 135k',0,2,'media',NULL),

('OBR-037','RAFAELA','São Paulo - SP','SP',
  ARRAY['Cortineiro'],
  '[{"nome":"EDY DEVSON","tipo":"marcenaria","servico":"Cortineiro"}]',
  ARRAY[]::TEXT[],'em_execucao',NULL,'R$ 28k',60,3,'baixa',NULL),

('OBR-038','PAULO GOTIJO','São Paulo - SP','SP',
  ARRAY['Aditivo'],
  '[{"nome":"FERNANDO E SILVIO","tipo":"marcenaria","servico":"Aditivo"}]',
  ARRAY[]::TEXT[],'em_execucao',NULL,'R$ 45k',50,3,'baixa',NULL),

('OBR-039','ELSON','São Paulo - SP','SP',
  ARRAY['Forro'],
  '[{"nome":"ROGERIO","tipo":"instalacao","servico":"Forro"}]',
  ARRAY['ALVARO'],'em_execucao',NULL,'R$ 98k',40,3,'media',NULL),

('OBR-040','TRILHOS GABRIEL LACHER/BRISES','Brasília - DF','BSB',
  ARRAY['Trilho'],
  '[{"nome":"NIVALDO E VALDINEY","tipo":"marcenaria","servico":"Trilho"}]',
  ARRAY[]::TEXT[],'em_execucao','2026-02-13','R$ 85k',70,3,'media',NULL),

('OBR-041','BARRA F/PAINEL VALTER E RENATA','São Paulo - SP','SP',
  ARRAY['Lustração'],
  '[{"nome":"EDMILSON E RAMON","tipo":"marcenaria","servico":"Lustração"}]',
  ARRAY[]::TEXT[],'em_execucao',NULL,'R$ 38k',55,3,'baixa',NULL)

ON CONFLICT (id) DO UPDATE SET
  cliente          = EXCLUDED.cliente,
  localizacao      = EXCLUDED.localizacao,
  regiao           = EXCLUDED.regiao,
  servicos         = EXCLUDED.servicos,
  equipes          = EXCLUDED.equipes,
  fiscais          = EXCLUDED.fiscais,
  status           = EXCLUDED.status,
  data_finalizacao = EXCLUDED.data_finalizacao,
  valor_estimado   = EXCLUDED.valor_estimado,
  progresso        = EXCLUDED.progresso,
  gate             = EXCLUDED.gate,
  prioridade       = EXCLUDED.prioridade,
  obs              = EXCLUDED.obs,
  updated_at       = NOW();

-- ================================================================
-- CONCLUÍDO
-- ================================================================
