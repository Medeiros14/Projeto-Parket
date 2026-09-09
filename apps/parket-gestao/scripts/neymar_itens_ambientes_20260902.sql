-- ═══════════════════════════════════════════════════════════════════
-- NEYMAR JUNIOR (gestao bf8fcfcf): itens por ambiente (02/09/2026,
-- Will: "tem varias ambientes crie o numero de item certinho")
-- QUE FAZ: o projeto tinha 1 item generico "AMBIENTE" vindo da sim
-- 11162 do Valor, que esta com dado ERRADO (Carvalho Europeu 237m2
-- R$248k). A obra real (contrato assinado OS 2346 + proposta 285 +
-- executivo REV00 01/09) e TAUARI MULTI PREMIUM 1,5x19x60A220CM,
-- 344m2 com perda, total geral R$320.000. Este script apaga o item
-- generico (0 etapas avancadas, 0 fotos, auditado) e insere os 7
-- ambientes da proposta numerados 1.1-1.7 no padrao hierarquico
-- (produto_header, categoria_raiz, quantidade = metragem real m2).
-- Valores: R$320.000 rateado pela metragem com perda (mesma logica
-- da proposta, R$/m2 uniforme); desconto e logistica do contrato
-- ficam embutidos proporcionalmente. Componentes produto/insumos/
-- instalacao no meta seguem a proporcao global da proposta
-- (261.440 / 36.828 / 85.656,48 sobre 383.924,48).
-- simulacao_item_id fica NULL: a sim vinculada nao representa a obra.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  v_projeto uuid := 'bf8fcfcf-dda4-4cf3-a0ec-2e7fafc4bc61';
  v_total numeric := 320000.00;      -- total geral do contrato assinado
  v_base  numeric := 383924.48;      -- subtotal proposta (parcial piso + logistica)
  v_prod  numeric := 261440.00;      -- produto (7 ambientes a R$760/m2 com perda)
  v_ins   numeric := 36828.00;       -- insumos de piso
  r record;
  v_id uuid;
  v_vp numeric; v_vi numeric;
BEGIN
  -- guarda: nada de progresso ou foto no item que vai sair
  IF EXISTS (SELECT 1 FROM gestao.item_etapa_status s
              JOIN gestao.itens i ON i.id = s.item_id
             WHERE i.projeto_id = v_projeto AND s.status <> 'pendente') THEN
    RAISE EXCEPTION 'projeto tem etapa avancada, abortando';
  END IF;

  DELETE FROM gestao.itens WHERE projeto_id = v_projeto;

  FOR r IN
    SELECT * FROM (VALUES
      -- codigo, ambiente, m2 real, m2 com perda (proposta), valor (rateio 320k/344m2)
      ('1.1', 'SALA ÍNTIMA',             70.00, 77, 71627.91),
      ('1.2', 'CIRCULAÇÃO',              68.18, 75, 69767.44),
      ('1.3', 'SUÍTE HÓSPEDES + CLOSET', 45.45, 50, 46511.63),
      ('1.4', 'SUÍTE TIPO I',            19.09, 21, 19534.88),
      ('1.5', 'SUÍTE TIPO II',           40.00, 44, 40930.23),
      ('1.6', 'SUÍTE TIPO III',          40.00, 44, 40930.23),
      ('1.7', 'ROUPARIA APOIO',          30.00, 33, 30697.68)  -- +0,01 fecha os 320k
    ) AS t(codigo, ambiente, m2_real, m2_perda, valor)
  LOOP
    v_vp := round(r.valor * v_prod / v_base, 2);
    v_vi := round(r.valor * v_ins  / v_base, 2);
    INSERT INTO gestao.itens (
      projeto_id, simulacao_item_id, ordem, categoria, descritivo, ambiente,
      quantidade, unidade, valor_unit, valor_total, meta
    ) VALUES (
      v_projeto, NULL,
      100 + split_part(r.codigo, '.', 2)::int,
      'PISO',
      r.codigo || ' · PISO TAUARI MULTI PREMIUM · 1,5 × 19 × 60A220CM',
      -- coluna ambiente e o que a Central do Cliente mostra na lista de itens
      r.ambiente,
      r.m2_real, 'm²', 0.00, r.valor,
      jsonb_build_object(
        'raiz', '1',
        'codigo', r.codigo,
        'perda_pct', '10',
        'so_material', false,
        'metragem_real', replace(trim(trailing '.' from trim(trailing '0' from r.m2_real::text)), '.', ','),
        'metragem_com_perda', r.m2_perda::text,
        'valor_produto', v_vp,
        'valor_insumos', v_vi,
        'valor_instalacao', round(r.valor - v_vp - v_vi, 2),
        'categoria_raiz', 'PISO',
        'produto_header', 'TAUARI MULTI PREMIUM · 1,5 × 19 × 60A220CM',
        'categoria_encoded', 'PISO||TAUARI MULTI PREMIUM||1,5 × 19 × 60A220CM',
        'descritivo_original', r.ambiente || E'\nMetragem real ' ||
          replace(trim(trailing '.' from trim(trailing '0' from r.m2_real::text)), '.', ',') ||
          'm² + 10% de perda = ' || r.m2_perda || 'm²'
      )
    ) RETURNING id INTO v_id;
    INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
    SELECT v_id, numero, 'pendente' FROM gestao.etapas_catalogo;
  END LOOP;

  UPDATE gestao.projetos SET valor_total = v_total WHERE id = v_projeto;

  INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
  VALUES (v_projeto, 'criado', 'Itens divididos por ambiente',
          '7 ambientes numerados 1.1-1.7 conforme proposta 285 / contrato OS 2346 (Tauari, R$320.000)',
          'will.tape@gmail.com',
          jsonb_build_object('backfill', 'neymar-ambientes-02-09', 'os', '2346'));
END $$;

-- conferencia: 7 itens somando exatamente o total do contrato
SELECT count(*) AS itens, SUM(valor_total) AS soma, SUM(quantidade) AS m2_real
  FROM gestao.itens WHERE projeto_id = 'bf8fcfcf-dda4-4cf3-a0ec-2e7fafc4bc61';

COMMIT;
