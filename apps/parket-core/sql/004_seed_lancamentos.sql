-- ============================================================
-- SEED — Lançamentos financeiros (movimento)
-- Receitas das obras (parcelas) + Custos diretos por obra
-- + Custos fixos mensais + Impostos + Comissões
-- ============================================================

DO $$
DECLARE
  obra RECORD;
  i int;
  pct_sinal numeric := 0.30;
  pct_parcelas numeric := 0.70;
  num_parcelas int;
  valor_parcela numeric;
  valor_sinal numeric;
  custo_total numeric;
  custo_materia numeric;
  custo_mao_obra numeric;
  custo_frete numeric;
  custo_insumos numeric;
  data_inicio_calc date;
  pc_receita_id uuid;
  cc_id uuid;
  empresa_curta text;
  fornecedor_madeira uuid := 'fa111111-0000-0000-0000-000000000001';
  fornecedor_madeira2 uuid := 'fa111111-0000-0000-0000-000000000002';
  fornecedor_vinilico uuid := 'fa111111-0000-0000-0000-000000000004';
  fornecedor_painel uuid := 'fa111111-0000-0000-0000-000000000011';
  fornecedor_ferragem uuid := 'fa111111-0000-0000-0000-000000000009';
  fornecedor_insumos uuid := 'fa111111-0000-0000-0000-000000000007';
  fornecedor_frete uuid := 'fa111111-0000-0000-0000-000000000015';
  instalador1 uuid := 'fa111111-0000-0000-0000-000000000017';
  instalador2 uuid := 'fa111111-0000-0000-0000-000000000019';
  marceneiro1 uuid := 'fa111111-0000-0000-0000-000000000018';
  marceneiro2 uuid := 'fa111111-0000-0000-0000-000000000020';
  conta_e1 uuid := 'ba111111-0000-0000-0000-000000000001';
  conta_e2 uuid := 'bb222222-0000-0000-0000-000000000001';
BEGIN
  -- Para cada obra
  FOR obra IN SELECT * FROM core.obras ORDER BY codigo LOOP
    cc_id := obra.centro_custo_id;
    -- plano de conta de receita: cc1=Pisos -> 1.01; cc2=Marcenaria -> 1.02
    IF cc_id = 'cc111111-1111-1111-1111-111111111111' THEN
      pc_receita_id := 'a1000001-0000-0000-0000-000000000001';
    ELSE
      pc_receita_id := 'a1000002-0000-0000-0000-000000000002';
    END IF;
    empresa_curta := CASE WHEN obra.empresa_id = '11111111-1111-1111-1111-111111111111' THEN 'E1' ELSE 'E2' END;

    -- ── RECEITAS — parcelas ──────────────────────────────────
    num_parcelas := CASE WHEN obra.valor_venda > 800000 THEN 5 WHEN obra.valor_venda > 500000 THEN 4 ELSE 3 END;
    valor_sinal := ROUND(obra.valor_venda * pct_sinal, 2);
    valor_parcela := ROUND(obra.valor_venda * pct_parcelas / num_parcelas, 2);
    -- Sinal
    INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, numero_documento, data_emissao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, parcela_atual, parcela_total, forma_pagamento)
    VALUES (obra.empresa_id, cc_id, obra.id, obra.cliente_id, pc_receita_id,
      CASE WHEN empresa_curta='E1' THEN conta_e1 ELSE conta_e2 END,
      'entrada', 'recebido',
      'Sinal '||obra.codigo||' — '||obra.nome,
      'NF-'||obra.codigo||'-S',
      obra.data_inicio, obra.data_inicio, obra.data_inicio + 5, obra.data_inicio + 5,
      valor_sinal, valor_sinal, 1, num_parcelas + 1, 'transferencia');
    -- Parcelas
    FOR i IN 1..num_parcelas LOOP
      INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, numero_documento, data_emissao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, parcela_atual, parcela_total, forma_pagamento)
      VALUES (obra.empresa_id, cc_id, obra.id, obra.cliente_id, pc_receita_id,
        CASE WHEN empresa_curta='E1' THEN conta_e1 ELSE conta_e2 END,
        'entrada',
        CASE
          WHEN obra.data_inicio + (i*30) > current_date THEN 'previsto'
          ELSE 'recebido'
        END,
        'Parcela '||i||'/'||num_parcelas||' '||obra.codigo,
        'NF-'||obra.codigo||'-P'||i,
        obra.data_inicio + (i*30) - 5, obra.data_inicio + (i*30), obra.data_inicio + (i*30),
        CASE WHEN obra.data_inicio + (i*30) > current_date THEN NULL ELSE obra.data_inicio + (i*30) END,
        valor_parcela,
        CASE WHEN obra.data_inicio + (i*30) > current_date THEN NULL ELSE valor_parcela END,
        i + 1, num_parcelas + 1,
        'boleto');
    END LOOP;

    -- ── CUSTOS DIRETOS ────────────────────────────────────────
    -- custo_total = valor_venda * (1 - margem/100)
    custo_total := obra.valor_venda * (1 - COALESCE(obra.margem_prevista, 40) / 100);
    custo_materia := ROUND(custo_total * 0.45, 2);
    custo_mao_obra := ROUND(custo_total * 0.30, 2);
    custo_frete := ROUND(custo_total * 0.08, 2);
    custo_insumos := ROUND(custo_total * 0.17, 2);

    DECLARE
      pc_materia uuid := CASE WHEN cc_id = 'cc111111-1111-1111-1111-111111111111' THEN 'a2000001-0000-0000-0000-000000000001'::uuid ELSE 'a2000002-0000-0000-0000-000000000002'::uuid END;
      pc_insumos uuid := CASE WHEN cc_id = 'cc111111-1111-1111-1111-111111111111' THEN 'a2000003-0000-0000-0000-000000000003'::uuid ELSE 'a2000004-0000-0000-0000-000000000004'::uuid END;
      pc_mao_obra uuid := CASE WHEN cc_id = 'cc111111-1111-1111-1111-111111111111' THEN 'a2000005-0000-0000-0000-000000000005'::uuid ELSE 'a2000006-0000-0000-0000-000000000006'::uuid END;
      forn_mp uuid := CASE WHEN cc_id = 'cc111111-1111-1111-1111-111111111111' THEN
        (CASE WHEN obra.valor_venda > 700000 THEN fornecedor_madeira2 ELSE fornecedor_madeira END)
      ELSE fornecedor_painel END;
      forn_mo1 uuid := CASE WHEN cc_id='cc111111-1111-1111-1111-111111111111' THEN instalador1 ELSE marceneiro1 END;
      forn_mo2 uuid := CASE WHEN cc_id='cc111111-1111-1111-1111-111111111111' THEN instalador2 ELSE marceneiro2 END;
      conta_uso uuid := CASE WHEN empresa_curta='E1' THEN conta_e1 ELSE conta_e2 END;
    BEGIN
    -- Matéria-prima (1 lançamento principal + 1 complementar)
    INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, numero_documento, data_emissao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
    VALUES (obra.empresa_id, cc_id, obra.id, forn_mp, pc_materia, conta_uso,
      'saida',
      CASE WHEN obra.data_inicio + 30 > current_date THEN 'previsto' ELSE 'pago' END,
      'Matéria-prima '||obra.codigo,
      'NFe-'||obra.codigo||'-MP01',
      obra.data_inicio + 5, obra.data_inicio + 5, obra.data_inicio + 30,
      CASE WHEN obra.data_inicio + 30 > current_date THEN NULL ELSE obra.data_inicio + 30 END,
      ROUND(custo_materia * 0.7, 2),
      CASE WHEN obra.data_inicio + 30 > current_date THEN NULL ELSE ROUND(custo_materia * 0.7, 2) END,
      'boleto');
    INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, numero_documento, data_emissao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
    VALUES (obra.empresa_id, cc_id, obra.id, fornecedor_ferragem, pc_insumos, conta_uso,
      'saida',
      CASE WHEN obra.data_inicio + 60 > current_date THEN 'previsto' ELSE 'pago' END,
      'Ferragens/insumos complementares '||obra.codigo,
      'NFe-'||obra.codigo||'-MP02',
      obra.data_inicio + 30, obra.data_inicio + 30, obra.data_inicio + 60,
      CASE WHEN obra.data_inicio + 60 > current_date THEN NULL ELSE obra.data_inicio + 60 END,
      ROUND(custo_materia * 0.3, 2),
      CASE WHEN obra.data_inicio + 60 > current_date THEN NULL ELSE ROUND(custo_materia * 0.3, 2) END,
      'boleto');

    -- Mão de obra (2 lançamentos: 50% no meio + 50% perto do fim)
    INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, numero_documento, data_emissao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
    VALUES (obra.empresa_id, cc_id, obra.id, forn_mo1, pc_mao_obra, conta_uso,
      'saida',
      CASE WHEN obra.data_inicio + 45 > current_date THEN 'previsto' ELSE 'pago' END,
      'Mão de obra 1ª etapa '||obra.codigo,
      'RPA-'||obra.codigo||'-MO01',
      obra.data_inicio + 20, obra.data_inicio + 20, obra.data_inicio + 45,
      CASE WHEN obra.data_inicio + 45 > current_date THEN NULL ELSE obra.data_inicio + 45 END,
      ROUND(custo_mao_obra * 0.5, 2),
      CASE WHEN obra.data_inicio + 45 > current_date THEN NULL ELSE ROUND(custo_mao_obra * 0.5, 2) END,
      'pix');
    INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, numero_documento, data_emissao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
    VALUES (obra.empresa_id, cc_id, obra.id, forn_mo2, pc_mao_obra, conta_uso,
      'saida',
      CASE WHEN COALESCE(obra.data_termino, obra.previsao_termino) > current_date THEN 'previsto' ELSE 'pago' END,
      'Mão de obra 2ª etapa '||obra.codigo,
      'RPA-'||obra.codigo||'-MO02',
      COALESCE(obra.data_termino, obra.previsao_termino) - 10,
      COALESCE(obra.data_termino, obra.previsao_termino) - 10,
      COALESCE(obra.data_termino, obra.previsao_termino) - 5,
      CASE WHEN COALESCE(obra.data_termino, obra.previsao_termino) > current_date THEN NULL ELSE COALESCE(obra.data_termino, obra.previsao_termino) - 5 END,
      ROUND(custo_mao_obra * 0.5, 2),
      CASE WHEN COALESCE(obra.data_termino, obra.previsao_termino) > current_date THEN NULL ELSE ROUND(custo_mao_obra * 0.5, 2) END,
      'pix');

    -- Frete
    INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, numero_documento, data_emissao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
    VALUES (obra.empresa_id, cc_id, obra.id, fornecedor_frete,
      'a2000007-0000-0000-0000-000000000007'::uuid, conta_uso,
      'saida',
      CASE WHEN obra.data_inicio + 25 > current_date THEN 'previsto' ELSE 'pago' END,
      'Frete entrega/retirada '||obra.codigo,
      'NFS-'||obra.codigo||'-FR',
      obra.data_inicio + 10, obra.data_inicio + 10, obra.data_inicio + 25,
      CASE WHEN obra.data_inicio + 25 > current_date THEN NULL ELSE obra.data_inicio + 25 END,
      custo_frete,
      CASE WHEN obra.data_inicio + 25 > current_date THEN NULL ELSE custo_frete END,
      'boleto');

    -- Insumos / acabamentos
    INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, numero_documento, data_emissao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
    VALUES (obra.empresa_id, cc_id, obra.id, fornecedor_insumos,
      'a2000003-0000-0000-0000-000000000003'::uuid, conta_uso,
      'saida',
      CASE WHEN obra.data_inicio + 40 > current_date THEN 'previsto' ELSE 'pago' END,
      'Cola, verniz e acabamentos '||obra.codigo,
      'NFe-'||obra.codigo||'-INS',
      obra.data_inicio + 15, obra.data_inicio + 15, obra.data_inicio + 40,
      CASE WHEN obra.data_inicio + 40 > current_date THEN NULL ELSE obra.data_inicio + 40 END,
      custo_insumos,
      CASE WHEN obra.data_inicio + 40 > current_date THEN NULL ELSE custo_insumos END,
      'boleto');
    END;
  END LOOP;
END $$;

-- ── CUSTOS FIXOS MENSAIS (12 meses por empresa) ──────────────
DO $$
DECLARE
  m int;
  d_comp date;
  d_venc date;
  d_pag date;
  conta_e1 uuid := 'ba111111-0000-0000-0000-000000000001';
  conta_e2 uuid := 'bb222222-0000-0000-0000-000000000001';
  empresas uuid[] := ARRAY['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid];
  emp uuid;
  cnt_e int;
  conta uuid;
  custos RECORD;
BEGIN
  FOR cnt_e IN 1..2 LOOP
    emp := empresas[cnt_e];
    conta := CASE WHEN cnt_e=1 THEN conta_e1 ELSE conta_e2 END;
    FOR m IN 1..12 LOOP
      d_comp := make_date(2026, m, 1);
      d_venc := make_date(2026, m, 10);
      d_pag := CASE WHEN d_venc > current_date THEN NULL ELSE d_venc END;

      -- Aluguel
      INSERT INTO core.lancamentos (empresa_id, plano_conta_id, parceiro_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
      VALUES (emp, 'a4000001-0000-0000-0000-000000000001', 'fa111111-0000-0000-0000-000000000022', conta, 'saida',
        CASE WHEN d_pag IS NULL THEN 'previsto' ELSE 'pago' END,
        'Aluguel & condomínio '||to_char(d_comp,'MM/YYYY'), d_comp, d_venc, d_pag,
        CASE WHEN cnt_e=1 THEN 28000.00 ELSE 18500.00 END,
        CASE WHEN d_pag IS NULL THEN NULL ELSE (CASE WHEN cnt_e=1 THEN 28000.00 ELSE 18500.00 END) END,
        'boleto');

      -- Salários administrativos
      INSERT INTO core.lancamentos (empresa_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
      VALUES (emp, 'a4000002-0000-0000-0000-000000000002', conta, 'saida',
        CASE WHEN make_date(2026,m,5) > current_date THEN 'previsto' ELSE 'pago' END,
        'Folha administrativa '||to_char(d_comp,'MM/YYYY'), d_comp, make_date(2026,m,5),
        CASE WHEN make_date(2026,m,5) > current_date THEN NULL ELSE make_date(2026,m,5) END,
        CASE WHEN cnt_e=1 THEN 92000.00 ELSE 64000.00 END,
        CASE WHEN make_date(2026,m,5) > current_date THEN NULL ELSE (CASE WHEN cnt_e=1 THEN 92000.00 ELSE 64000.00 END) END,
        'transferencia');

      -- Pró-labore
      INSERT INTO core.lancamentos (empresa_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
      VALUES (emp, 'a4000003-0000-0000-0000-000000000003', conta, 'saida',
        CASE WHEN make_date(2026,m,5) > current_date THEN 'previsto' ELSE 'pago' END,
        'Pró-labore sócios '||to_char(d_comp,'MM/YYYY'), d_comp, make_date(2026,m,5),
        CASE WHEN make_date(2026,m,5) > current_date THEN NULL ELSE make_date(2026,m,5) END,
        CASE WHEN cnt_e=1 THEN 35000.00 ELSE 25000.00 END,
        CASE WHEN make_date(2026,m,5) > current_date THEN NULL ELSE (CASE WHEN cnt_e=1 THEN 35000.00 ELSE 25000.00 END) END,
        'transferencia');

      -- Energia
      INSERT INTO core.lancamentos (empresa_id, plano_conta_id, parceiro_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
      VALUES (emp, 'a4000004-0000-0000-0000-000000000004', 'fa111111-0000-0000-0000-000000000023', conta, 'saida',
        CASE WHEN make_date(2026,m,15) > current_date THEN 'previsto' ELSE 'pago' END,
        'Energia elétrica '||to_char(d_comp,'MM/YYYY'), d_comp, make_date(2026,m,15),
        CASE WHEN make_date(2026,m,15) > current_date THEN NULL ELSE make_date(2026,m,15) END,
        CASE WHEN cnt_e=1 THEN 3800.00 ELSE 4500.00 END,
        CASE WHEN make_date(2026,m,15) > current_date THEN NULL ELSE (CASE WHEN cnt_e=1 THEN 3800.00 ELSE 4500.00 END) END,
        'debito_automatico');

      -- Internet/telefone
      INSERT INTO core.lancamentos (empresa_id, plano_conta_id, parceiro_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
      VALUES (emp, 'a4000005-0000-0000-0000-000000000005', 'fa111111-0000-0000-0000-000000000024', conta, 'saida',
        CASE WHEN make_date(2026,m,18) > current_date THEN 'previsto' ELSE 'pago' END,
        'Telefonia/internet '||to_char(d_comp,'MM/YYYY'), d_comp, make_date(2026,m,18),
        CASE WHEN make_date(2026,m,18) > current_date THEN NULL ELSE make_date(2026,m,18) END,
        1850.00,
        CASE WHEN make_date(2026,m,18) > current_date THEN NULL ELSE 1850.00 END,
        'debito_automatico');

      -- Contabilidade
      INSERT INTO core.lancamentos (empresa_id, plano_conta_id, parceiro_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
      VALUES (emp, 'a4000007-0000-0000-0000-000000000007', 'fa111111-0000-0000-0000-000000000025', conta, 'saida',
        CASE WHEN make_date(2026,m,20) > current_date THEN 'previsto' ELSE 'pago' END,
        'Contabilidade '||to_char(d_comp,'MM/YYYY'), d_comp, make_date(2026,m,20),
        CASE WHEN make_date(2026,m,20) > current_date THEN NULL ELSE make_date(2026,m,20) END,
        4800.00,
        CASE WHEN make_date(2026,m,20) > current_date THEN NULL ELSE 4800.00 END,
        'boleto');

      -- Software/SaaS
      INSERT INTO core.lancamentos (empresa_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
      VALUES (emp, 'a4000006-0000-0000-0000-000000000006', conta, 'saida',
        CASE WHEN make_date(2026,m,12) > current_date THEN 'previsto' ELSE 'pago' END,
        'Softwares (CRM/ERP/Office) '||to_char(d_comp,'MM/YYYY'), d_comp, make_date(2026,m,12),
        CASE WHEN make_date(2026,m,12) > current_date THEN NULL ELSE make_date(2026,m,12) END,
        2400.00,
        CASE WHEN make_date(2026,m,12) > current_date THEN NULL ELSE 2400.00 END,
        'cartao');

      -- Combustível & manutenção (variável: cresce no segundo semestre)
      INSERT INTO core.lancamentos (empresa_id, plano_conta_id, parceiro_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
      VALUES (emp, 'a3000006-0000-0000-0000-000000000006', 'fa111111-0000-0000-0000-000000000021', conta, 'saida',
        CASE WHEN make_date(2026,m,28) > current_date THEN 'previsto' ELSE 'pago' END,
        'Combustível frota '||to_char(d_comp,'MM/YYYY'), d_comp, make_date(2026,m,28),
        CASE WHEN make_date(2026,m,28) > current_date THEN NULL ELSE make_date(2026,m,28) END,
        CASE WHEN cnt_e=1 THEN 4500.00 ELSE 2800.00 END,
        CASE WHEN make_date(2026,m,28) > current_date THEN NULL ELSE (CASE WHEN cnt_e=1 THEN 4500.00 ELSE 2800.00 END) END,
        'cartao');
    END LOOP;
  END LOOP;
END $$;

-- ── IMPOSTOS MENSAIS (Lucro Presumido — 11.33% efetivo aprox) ──
DO $$
DECLARE
  m int;
  emp uuid;
  cnt_e int;
  receita_mes numeric;
  valor_pis numeric; valor_cofins numeric; valor_iss numeric;
  d_venc date;
  d_pag date;
  empresas uuid[] := ARRAY['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid];
  conta uuid;
  conta_e1 uuid := 'ba111111-0000-0000-0000-000000000001';
  conta_e2 uuid := 'bb222222-0000-0000-0000-000000000001';
BEGIN
  FOR cnt_e IN 1..2 LOOP
    emp := empresas[cnt_e];
    conta := CASE WHEN cnt_e=1 THEN conta_e1 ELSE conta_e2 END;
    FOR m IN 1..12 LOOP
      -- receita do mês = soma das entradas pagas no mês
      SELECT COALESCE(SUM(valor),0) INTO receita_mes
        FROM core.lancamentos
        WHERE empresa_id = emp AND tipo = 'entrada'
          AND date_trunc('month', data_competencia) = make_date(2026, m, 1);
      IF receita_mes > 0 THEN
        valor_pis := ROUND(receita_mes * 0.0065, 2);
        valor_cofins := ROUND(receita_mes * 0.030, 2);
        valor_iss := ROUND(receita_mes * 0.05 * 0.4, 2); -- 5% sobre 40% (parcela serviço)
        d_venc := make_date(2026, CASE WHEN m=12 THEN 1 ELSE m+1 END, 25);
        IF m = 12 THEN d_venc := make_date(2027, 1, 25); END IF;
        d_pag := CASE WHEN d_venc > current_date THEN NULL ELSE d_venc END;

        INSERT INTO core.lancamentos (empresa_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
        VALUES (emp, 'a5000002-0000-0000-0000-000000000002', conta, 'saida',
          CASE WHEN d_pag IS NULL THEN 'previsto' ELSE 'pago' END,
          'PIS competência '||to_char(make_date(2026,m,1),'MM/YYYY'), make_date(2026,m,1), d_venc, d_pag,
          valor_pis, CASE WHEN d_pag IS NULL THEN NULL ELSE valor_pis END, 'darf');

        INSERT INTO core.lancamentos (empresa_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
        VALUES (emp, 'a5000003-0000-0000-0000-000000000003', conta, 'saida',
          CASE WHEN d_pag IS NULL THEN 'previsto' ELSE 'pago' END,
          'COFINS competência '||to_char(make_date(2026,m,1),'MM/YYYY'), make_date(2026,m,1), d_venc, d_pag,
          valor_cofins, CASE WHEN d_pag IS NULL THEN NULL ELSE valor_cofins END, 'darf');

        INSERT INTO core.lancamentos (empresa_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
        VALUES (emp, 'a5000005-0000-0000-0000-000000000005', conta, 'saida',
          CASE WHEN d_pag IS NULL THEN 'previsto' ELSE 'pago' END,
          'ISS competência '||to_char(make_date(2026,m,1),'MM/YYYY'), make_date(2026,m,1), d_venc, d_pag,
          valor_iss, CASE WHEN d_pag IS NULL THEN NULL ELSE valor_iss END, 'guia');

        INSERT INTO core.impostos (empresa_id, tipo, competencia, valor, vencimento, data_pagamento, status)
        VALUES (emp, 'PIS', to_char(make_date(2026,m,1),'YYYY-MM'), valor_pis, d_venc, d_pag, CASE WHEN d_pag IS NULL THEN 'a_pagar' ELSE 'pago' END),
               (emp, 'COFINS', to_char(make_date(2026,m,1),'YYYY-MM'), valor_cofins, d_venc, d_pag, CASE WHEN d_pag IS NULL THEN 'a_pagar' ELSE 'pago' END),
               (emp, 'ISS', to_char(make_date(2026,m,1),'YYYY-MM'), valor_iss, d_venc, d_pag, CASE WHEN d_pag IS NULL THEN 'a_pagar' ELSE 'pago' END);
      END IF;
    END LOOP;
    -- IRPJ + CSLL trimestral (lucro presumido — 8% lucro * 15% IRPJ + 12% lucro * 9% CSLL ~3.08%)
    FOR m IN 1..4 LOOP
      DECLARE
        receita_tri numeric;
        valor_irpj numeric; valor_csll numeric;
        venc_tri date;
        ini_mes int := (m-1)*3 + 1;
        fim_mes int := m*3;
      BEGIN
        SELECT COALESCE(SUM(valor),0) INTO receita_tri
          FROM core.lancamentos
          WHERE empresa_id = emp AND tipo='entrada'
            AND data_competencia >= make_date(2026,ini_mes,1)
            AND data_competencia <= (make_date(2026,fim_mes,1) + interval '1 month - 1 day')::date;
        IF receita_tri > 0 THEN
          valor_irpj := ROUND(receita_tri * 0.08 * 0.15, 2);
          valor_csll := ROUND(receita_tri * 0.12 * 0.09, 2);
          venc_tri := CASE
            WHEN fim_mes+1 > 12 THEN make_date(2027, fim_mes+1-12, 30)
            ELSE make_date(2026, fim_mes+1, 30)
          END;
          INSERT INTO core.lancamentos (empresa_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
          VALUES (emp, 'a5000006-0000-0000-0000-000000000006', conta, 'saida',
            CASE WHEN venc_tri > current_date THEN 'previsto' ELSE 'pago' END,
            'IRPJ '||m||'T/2026', make_date(2026,fim_mes,1), venc_tri,
            CASE WHEN venc_tri > current_date THEN NULL ELSE venc_tri END,
            valor_irpj, CASE WHEN venc_tri > current_date THEN NULL ELSE valor_irpj END, 'darf');
          INSERT INTO core.lancamentos (empresa_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
          VALUES (emp, 'a5000007-0000-0000-0000-000000000007', conta, 'saida',
            CASE WHEN venc_tri > current_date THEN 'previsto' ELSE 'pago' END,
            'CSLL '||m||'T/2026', make_date(2026,fim_mes,1), venc_tri,
            CASE WHEN venc_tri > current_date THEN NULL ELSE venc_tri END,
            valor_csll, CASE WHEN venc_tri > current_date THEN NULL ELSE valor_csll END, 'darf');
          INSERT INTO core.impostos (empresa_id, tipo, competencia, valor, vencimento, data_pagamento, status)
          VALUES (emp, 'IRPJ', m||'T/2026', valor_irpj, venc_tri, CASE WHEN venc_tri > current_date THEN NULL ELSE venc_tri END, CASE WHEN venc_tri > current_date THEN 'a_pagar' ELSE 'pago' END),
                 (emp, 'CSLL', m||'T/2026', valor_csll, venc_tri, CASE WHEN venc_tri > current_date THEN NULL ELSE venc_tri END, CASE WHEN venc_tri > current_date THEN 'a_pagar' ELSE 'pago' END);
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- ── COMISSÕES (1 por obra) ───────────────────────────────────
DO $$
DECLARE
  obra RECORD;
  vendedor RECORD;
  perc numeric;
  valor_com numeric;
  d_pag date;
  conta uuid;
BEGIN
  FOR obra IN SELECT * FROM core.obras WHERE vendedor_id IS NOT NULL LOOP
    SELECT * INTO vendedor FROM core.parceiros WHERE id = obra.vendedor_id;
    perc := COALESCE(vendedor.comissao_padrao, 3.0);
    valor_com := ROUND(obra.valor_venda * perc / 100, 2);
    -- comissão paga 30 dias após início da obra
    d_pag := obra.data_inicio + 30;
    conta := CASE WHEN obra.empresa_id = '11111111-1111-1111-1111-111111111111' THEN 'ba111111-0000-0000-0000-000000000001'::uuid ELSE 'bb222222-0000-0000-0000-000000000001'::uuid END;

    INSERT INTO core.comissoes (obra_id, vendedor_id, base_calculo, percentual, valor, status, data_pagamento)
    VALUES (obra.id, obra.vendedor_id, obra.valor_venda, perc, valor_com,
      CASE WHEN d_pag > current_date THEN 'a_pagar' ELSE 'pago' END,
      CASE WHEN d_pag > current_date THEN NULL ELSE d_pag END);

    INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id, conta_bancaria_id, tipo, status, descricao, data_competencia, data_vencimento, data_pagamento, valor, valor_pago, forma_pagamento)
    VALUES (obra.empresa_id, obra.centro_custo_id, obra.id, obra.vendedor_id,
      'a3000001-0000-0000-0000-000000000001', conta,
      'saida',
      CASE WHEN d_pag > current_date THEN 'previsto' ELSE 'pago' END,
      'Comissão '||vendedor.nome||' — '||obra.codigo,
      obra.data_inicio, d_pag,
      CASE WHEN d_pag > current_date THEN NULL ELSE d_pag END,
      valor_com,
      CASE WHEN d_pag > current_date THEN NULL ELSE valor_com END,
      'pix');
  END LOOP;
END $$;

-- Resumo final
DO $$
DECLARE
  total_lanc int;
  total_obras int;
  total_receitas numeric;
  total_despesas numeric;
  total_comissoes int;
  total_impostos int;
BEGIN
  SELECT COUNT(*) INTO total_lanc FROM core.lancamentos;
  SELECT COUNT(*) INTO total_obras FROM core.obras;
  SELECT COALESCE(SUM(valor),0) INTO total_receitas FROM core.lancamentos WHERE tipo='entrada';
  SELECT COALESCE(SUM(valor),0) INTO total_despesas FROM core.lancamentos WHERE tipo='saida';
  SELECT COUNT(*) INTO total_comissoes FROM core.comissoes;
  SELECT COUNT(*) INTO total_impostos FROM core.impostos;
  RAISE NOTICE '=== SEED COMPLETO ===';
  RAISE NOTICE '% obras / % lançamentos / % comissões / % impostos', total_obras, total_lanc, total_comissoes, total_impostos;
  RAISE NOTICE 'Receita total: R$ %', total_receitas;
  RAISE NOTICE 'Despesa total: R$ %', total_despesas;
  RAISE NOTICE 'Resultado: R$ %', total_receitas - total_despesas;
END $$;
