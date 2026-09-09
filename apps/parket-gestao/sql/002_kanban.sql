-- Espelha estrutura de colunas Kanban do operacional em gestao.projetos.
-- Assim a landing do gestor tem o mesmo fluxo visual do dept-operacional do Space.

ALTER TABLE gestao.projetos
  ADD COLUMN IF NOT EXISTS column_id text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS ordem_coluna int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_gestao_projetos_column
  ON gestao.projetos(column_id, ordem_coluna);

-- Catálogo local (referência das colunas do dept-operacional, mesma ordem que Space)
CREATE TABLE IF NOT EXISTS gestao.colunas_kanban (
  id       text PRIMARY KEY,
  titulo   text NOT NULL,
  cor      text NOT NULL,
  ordem    int  NOT NULL DEFAULT 0
);

INSERT INTO gestao.colunas_kanban (id, titulo, cor, ordem) VALUES
  ('projeto',            'Projeto',              '#8B5CF6',  1),
  ('pendente',           'Pendente',             '#F59E0B',  2),
  ('primeira-vistoria',  'Primeira Vistoria',    '#3B82F6',  3),
  ('pre-cronograma',     'Pre Cronograma',       '#06B6D4',  4),
  ('segunda-vistoria',   'Segunda Vistoria',     '#3B82F6',  5),
  ('entrega-material',   'Entrega do Material',  '#14B8A6',  6),
  ('obras-liberadas',    'Obras Liberadas',      '#84CC16',  7),
  ('cronograma-final',   'Cronograma Final',     '#06B6D4',  8),
  ('acompanhamento',     'Acompanhamento de Obras','#22C55E',9),
  ('travado',            'TRAVADO',              '#EF4444', 10),
  ('reparos',            'Reparos',              '#F97316', 11),
  ('reparos-concluidos', 'Reparos Concluídos',   '#10B981', 12),
  ('obras-finalizadas',  'Obras Finalizadas',    '#10B981', 13)
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo, cor = EXCLUDED.cor, ordem = EXCLUDED.ordem;

-- Move projeto pra outra coluna (com timeline)
CREATE OR REPLACE FUNCTION gestao.mover_projeto(
  p_projeto_id uuid,
  p_column_id  text,
  p_autor      text DEFAULT NULL
) RETURNS gestao.projetos AS $$
DECLARE
  v_row gestao.projetos;
  v_prev text;
BEGIN
  SELECT column_id INTO v_prev FROM gestao.projetos WHERE id = p_projeto_id;
  IF v_prev IS NULL THEN RAISE EXCEPTION 'projeto não encontrado'; END IF;
  IF v_prev = p_column_id THEN
    SELECT * INTO v_row FROM gestao.projetos WHERE id = p_projeto_id;
    RETURN v_row;
  END IF;

  UPDATE gestao.projetos
     SET column_id = p_column_id
   WHERE id = p_projeto_id
   RETURNING * INTO v_row;

  INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
  VALUES (p_projeto_id, 'status_change',
          format('Coluna: %s → %s', v_prev, p_column_id),
          p_autor,
          jsonb_build_object('from', v_prev, 'to', p_column_id));
  RETURN v_row;
END;
$$ LANGUAGE plpgsql;

-- Ao criar projeto pela RPC, copiar column_id do card operacional (se houver)
CREATE OR REPLACE FUNCTION gestao.projetar_de_proposta(
  p_simulacao_id uuid,
  p_contrato_id  uuid DEFAULT NULL,
  p_gestor_email text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_projeto_id uuid;
  v_prop record;
  v_new_item_id uuid;
  v_column_id text := 'projeto';
BEGIN
  SELECT * INTO v_prop FROM public.simulacao_projetos WHERE id = p_simulacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'simulacao_projetos % not found', p_simulacao_id;
  END IF;

  SELECT id INTO v_projeto_id FROM gestao.projetos WHERE simulacao_id = p_simulacao_id;
  IF v_projeto_id IS NOT NULL THEN
    UPDATE gestao.projetos
       SET contrato_id  = COALESCE(p_contrato_id, contrato_id),
           gestor_email = COALESCE(p_gestor_email, gestor_email)
     WHERE id = v_projeto_id;
    RETURN v_projeto_id;
  END IF;

  -- Se o card já está em alguma coluna do operacional, herda
  IF v_prop.card_id IS NOT NULL THEN
    SELECT column_id INTO v_column_id
      FROM public.kanban_cards
     WHERE id = v_prop.card_id AND dept_id = 'operacional'
     LIMIT 1;
    v_column_id := COALESCE(v_column_id, 'projeto');
  END IF;

  INSERT INTO gestao.projetos (
    simulacao_id, card_id, contrato_id, numero_proposta, cliente, cnpj_cpf,
    endereco, obra_code, vendedor, arquiteto, orcamentista, gestor_email,
    valor_total, status, column_id, assinado_em
  ) VALUES (
    v_prop.id, v_prop.card_id, p_contrato_id,
    v_prop.numero, COALESCE(v_prop.cliente, 'Cliente'), v_prop.cnpj_cpf,
    v_prop.endereco, v_prop.obra_code, v_prop.vendedor, v_prop.arquiteto,
    v_prop.orcamentista, p_gestor_email,
    COALESCE((SELECT SUM(valor) FROM public.simulacao_itens WHERE simulacao_id = v_prop.id), 0),
    'novo', v_column_id,
    CASE WHEN p_contrato_id IS NOT NULL THEN now() ELSE NULL END
  ) RETURNING id INTO v_projeto_id;

  FOR v_prop IN
    SELECT * FROM public.simulacao_itens
    WHERE simulacao_id = p_simulacao_id ORDER BY ordem
  LOOP
    INSERT INTO gestao.itens (
      projeto_id, simulacao_item_id, ordem, categoria, descritivo,
      quantidade, unidade, valor_unit, valor_total, meta
    ) VALUES (
      v_projeto_id, v_prop.id, v_prop.ordem, v_prop.categoria, v_prop.descritivo,
      COALESCE((v_prop.meta->>'quantidade')::numeric, 1),
      COALESCE(v_prop.meta->>'unidade', 'un'),
      COALESCE((v_prop.meta->>'preco')::numeric, v_prop.valor),
      v_prop.valor,
      COALESCE(v_prop.meta, '{}'::jsonb)
    ) RETURNING id INTO v_new_item_id;
    INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
    SELECT v_new_item_id, numero, 'pendente' FROM gestao.etapas_catalogo;
  END LOOP;

  INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
  SELECT v_projeto_id, numero, 'pendente' FROM gestao.etapas_catalogo
  ON CONFLICT DO NOTHING;

  INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
  VALUES (
    v_projeto_id, 'criado', 'Projeto criado a partir da proposta',
    format('%s itens copiados, entrou em coluna %s',
           (SELECT COUNT(*) FROM gestao.itens WHERE projeto_id = v_projeto_id),
           v_column_id),
    p_gestor_email,
    jsonb_build_object('simulacao_id', p_simulacao_id, 'contrato_id', p_contrato_id, 'column_id', v_column_id)
  );

  RETURN v_projeto_id;
END;
$$ LANGUAGE plpgsql;
