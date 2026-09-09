-- ================================================================
-- PARKET DASHBOARD — Campo App: Check-ins, Posts, Tarefas, Ordens
-- ================================================================

-- ─── 1. CAMPO CHECK-INS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campo_checkins (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL,
  obra_id         TEXT        NOT NULL,
  obra_nome       TEXT        NOT NULL,
  hora_entrada    TEXT        NOT NULL,           -- "07:02"
  hora_saida      TEXT,
  dentro_do_raio  BOOLEAN     NOT NULL DEFAULT true,
  obs             TEXT,
  data            DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campo_checkins_user ON public.campo_checkins (user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_campo_checkins_obra ON public.campo_checkins (obra_id, data DESC);
ALTER TABLE public.campo_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_checkins" ON public.campo_checkins FOR ALL USING (auth.role() = 'authenticated');

-- ─── 2. CAMPO POSTS (Feed de Obras) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.campo_posts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT        NOT NULL,
  user_name           TEXT        NOT NULL,
  user_avatar         TEXT        NOT NULL,
  obra_id             TEXT        NOT NULL,
  obra_nome           TEXT        NOT NULL,
  etapa               TEXT        NOT NULL,
  descricao           TEXT        NOT NULL,
  foto                TEXT,                       -- URL da foto
  status              TEXT        NOT NULL DEFAULT 'pendente'
                                  CHECK (status IN ('pendente','aprovado','rejeitado')),
  nota_qualidade      INTEGER     CHECK (nota_qualidade BETWEEN 1 AND 5),
  comentario_fiscal   TEXT,
  likes               INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campo_posts_obra   ON public.campo_posts (obra_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campo_posts_status ON public.campo_posts (status, created_at DESC);
ALTER TABLE public.campo_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_posts"  ON public.campo_posts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_posts" ON public.campo_posts FOR ALL   USING (auth.role() = 'authenticated');

-- ─── 3. CAMPO TAREFAS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campo_tarefas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT        NOT NULL,
  obra_id     TEXT        NOT NULL,
  obra_nome   TEXT        NOT NULL,
  user_id     TEXT        NOT NULL,
  prioridade  TEXT        NOT NULL DEFAULT 'media'
              CHECK (prioridade IN ('alta','media','baixa')),
  status      TEXT        NOT NULL DEFAULT 'pendente'
              CHECK (status IN ('pendente','andamento','concluida','atrasada')),
  prazo       DATE,
  etapa       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campo_tarefas_user ON public.campo_tarefas (user_id, status);
CREATE INDEX IF NOT EXISTS idx_campo_tarefas_obra ON public.campo_tarefas (obra_id);
ALTER TABLE public.campo_tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_tarefas" ON public.campo_tarefas FOR ALL USING (auth.role() = 'authenticated');

-- ─── 4. ORDENS DE PRODUÇÃO ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campo_ordens_producao (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          TEXT        NOT NULL UNIQUE,    -- "OP-224"
  obra_destino    TEXT        NOT NULL,           -- "OBR-005"
  obra_nome       TEXT        NOT NULL,
  item            TEXT        NOT NULL,
  material        TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'fila'
                  CHECK (status IN ('fila','cortando','montando','acabamento','pronto','entregue')),
  responsavel     TEXT,
  prazo           DATE,
  conclusao       INTEGER     NOT NULL DEFAULT 0 CHECK (conclusao BETWEEN 0 AND 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.campo_ordens_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_ordens" ON public.campo_ordens_producao FOR ALL USING (auth.role() = 'authenticated');

-- ─── 5. RANKING / GAMIFICAÇÃO ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campo_ranking (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL UNIQUE,
  nome        TEXT        NOT NULL,
  avatar      TEXT        NOT NULL,
  pontos      INTEGER     NOT NULL DEFAULT 0,
  badges      TEXT[]      NOT NULL DEFAULT '{}',
  setor       TEXT        NOT NULL DEFAULT 'campo',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.campo_ranking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_ranking" ON public.campo_ranking FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_ranking" ON public.campo_ranking FOR ALL USING (public.current_user_role() IN ('superadmin','admin','dept_leader'));

-- ─── 6. NOTIFICAÇÕES CAMPO ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campo_notificacoes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('tarefa','aprovado','rejeitado','lembrete','aviso')),
  texto       TEXT        NOT NULL,
  lida        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campo_notif_user ON public.campo_notificacoes (user_id, lida, created_at DESC);
ALTER TABLE public.campo_notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_notif" ON public.campo_notificacoes FOR ALL USING (auth.role() = 'authenticated');

-- ================================================================
-- SEED — dados reais do campo
-- ================================================================

-- CHECK-INS
INSERT INTO public.campo_checkins (user_id, obra_id, obra_nome, hora_entrada, hora_saida, dentro_do_raio, obs, data) VALUES
('u-inst-01', 'OBR-001', 'Pedro Campos', '07:02', '17:15', true, NULL,               '2026-03-07'),
('u-inst-01', 'OBR-001', 'Pedro Campos', '06:58', '17:30', true, NULL,               '2026-03-06'),
('u-inst-01', 'OBR-001', 'Pedro Campos', '07:10', NULL,    true, 'Preparação contrapiso', '2026-03-08'),
('u-marc-01', 'OBR-002', 'Maria e Mel',  '07:05', NULL,    true, NULL,               '2026-03-08'),
('u-fisc-01', 'OBR-001', 'Pedro Campos', '08:00', NULL,    true, 'Vistoria umidade agendada', '2026-03-08');

-- POSTS
INSERT INTO public.campo_posts (user_id, user_name, user_avatar, obra_id, obra_nome, etapa, descricao, status, nota_qualidade, comentario_fiscal, created_at) VALUES
('u-inst-01','Marcos R.','MR','OBR-001','Pedro Campos','Piso — Assentamento',
 'Finalizado assentamento do piso Cumaru no hall de entrada. 22m² executados hoje. Alinhamento e nível verificados.',
 'aprovado', 5, 'Excelente acabamento. Padrão Parket mantido.', '2026-03-08 16:30:00'),
('u-inst-01','Marcos R.','MR','OBR-001','Pedro Campos','Deck — Preparação',
 'Preparação da base para deck na área externa. Nivelamento do contrapiso concluído.',
 'aprovado', 4, NULL, '2026-03-07 15:45:00'),
('u-marc-01','Wilson S.','WS','OBR-002','Maria e Mel','Marcenaria — Montagem',
 'Início da montagem do painel MDF sala de jantar. Peças conferidas e alinhadas.',
 'pendente', NULL, NULL, '2026-03-08 14:20:00'),
('u-prod-01','Altair O.','AO','OBR-003','Inacio','Produção — Usinagem',
 'Usinagem das portas pivotantes concluída. 4 unidades prontas para acabamento.',
 'aprovado', 5, NULL, '2026-03-08 11:00:00'),
('u-fab-01','Germano C.','GC','OBR-004','Leandro Silva','Fábrica — Linha de Produção',
 'Linha 2 produzindo painéis de revestimento Nogueira. Lote de 30 peças — 18 prontas.',
 'pendente', NULL, NULL, '2026-03-08 10:15:00');

-- TAREFAS
INSERT INTO public.campo_tarefas (titulo, obra_id, obra_nome, user_id, prioridade, status, prazo, etapa) VALUES
('Assentamento piso hall — Cumaru',  'OBR-001','Pedro Campos','u-inst-01','alta',  'andamento', '2026-03-10','Piso'),
('Deck área externa — base',          'OBR-001','Pedro Campos','u-inst-01','media', 'pendente',  '2026-03-15','Deck'),
('Vistoria umidade — quarto master',  'OBR-001','Pedro Campos','u-inst-01','alta',  'pendente',  '2026-03-09','Vistoria'),
('Montagem painel MDF — sala',        'OBR-002','Maria e Mel', 'u-marc-01','alta',  'andamento', '2026-03-12','Marcenaria'),
('Usinagem portas pivotantes',        'OBR-003','Inacio',      'u-prod-01','alta',  'concluida', '2026-03-08','Produção'),
('Foto lote painéis Nogueira',        'OBR-004','Leandro Silva','u-fab-01','media', 'andamento', '2026-03-10','Fábrica'),
('Vistoria acabamento — Maria e Mel', 'OBR-002','Maria e Mel', 'u-fisc-01','alta',  'pendente',  '2026-03-09','Vistoria'),
('Validar 3 postagens pendentes',     'OBR-001','Pedro Campos','u-fisc-01','media', 'pendente',  '2026-03-08','Validação');

-- ORDENS DE PRODUÇÃO
INSERT INTO public.campo_ordens_producao (codigo, obra_destino, obra_nome, item, material, status, responsavel, prazo, conclusao) VALUES
('OP-224','OBR-005','Studio Débora Aguiar','Fachada Cumaru — 22 painéis',     'Cumaru',         'fila',      '—',         '2026-03-25', 0),
('OP-221','OBR-003','Inacio',              'Portas Pivotantes Carvalho (4un)', 'Carvalho Europeu','acabamento','Altair O.', '2026-03-12',80),
('OP-220','OBR-004','Leandro Silva',       'Painéis Nogueira (30 peças)',      'Nogueira',        'cortando',  'Equipe C',  '2026-03-18',60),
('OP-218','OBR-001','Pedro Campos',        'Kit Rodapé Cumaru',                'Cumaru',          'pronto',    '—',         '2026-03-08',100),
('OP-219','OBR-002','Maria e Mel',         'Painel MDF Sala + Forro',          'MDF Carvalho',    'montando',  'Equipe B',  '2026-03-14',45);

-- RANKING
INSERT INTO public.campo_ranking (user_id, nome, avatar, pontos, badges, setor) VALUES
('u-inst-01','Marcos Ribeiro','MR', 485, ARRAY['Pontual','Produtivo','5 Estrelas'], 'campo'),
('u-fisc-01','Felipe Mendes', 'FM', 520, ARRAY['Qualidade','Zero Faltas'],          'campo'),
('u-marc-01','Wilson Santos', 'WS', 390, ARRAY['Produtivo'],                        'campo'),
('u-fab-01', 'Germano Costa', 'GC', 620, ARRAY['Líder','Produtivo','Inovador'],     'fabrica'),
('u-prod-01','Altair Oliveira','AO',310, ARRAY['Pontual'],                          'campo')
ON CONFLICT (user_id) DO UPDATE SET pontos = EXCLUDED.pontos, badges = EXCLUDED.badges;

-- NOTIFICAÇÕES
INSERT INTO public.campo_notificacoes (user_id, tipo, texto, lida, created_at) VALUES
('u-inst-01','tarefa',   'Nova tarefa atribuída: Assentamento piso hall — Cumaru', false, NOW() - INTERVAL '1h'),
('u-inst-01','aprovado', 'Sua postagem ''Piso Cumaru hall'' foi aprovada com nota 5!', false, NOW() - INTERVAL '30m'),
('u-inst-01','lembrete', 'Lembrete: Faça o check-in ao chegar na obra',             true,  NOW() - INTERVAL '2h'),
('u-marc-01','aviso',    'Reunião de equipe amanhã às 07:00 na base',               true,  NOW() - INTERVAL '1d'),
('u-marc-01','rejeitado','Postagem ''Deck externo'' precisa de mais detalhes',       true,  NOW() - INTERVAL '2d');

-- ================================================================
-- CONCLUÍDO
-- ================================================================
