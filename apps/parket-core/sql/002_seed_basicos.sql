-- ============================================================
-- SEED — Cadastros básicos (Simulação 20MM)
-- 2 empresas (CNPJs distintos), 2 centros de custo, plano de
-- contas, fornecedores/clientes/vendedores, contas bancárias.
-- ============================================================

-- ── EMPRESAS ────────────────────────────────────────────────
INSERT INTO core.empresas (id, cnpj, razao_social, nome_fantasia, inscricao_estadual, endereco, cidade, uf, cep, telefone, email, regime_tributario, cor) VALUES
  ('11111111-1111-1111-1111-111111111111', '12.345.678/0001-90', 'PARKET PISOS E DECKS LTDA', 'Parket Pisos', '123.456.789.012', 'Rua dos Pisos, 100', 'São Paulo', 'SP', '04550-000', '(11) 3333-4444', 'financeiro@parket.com.br', 'lucro_presumido', '#B8AA9A'),
  ('22222222-2222-2222-2222-222222222222', '98.765.432/0001-10', 'PARKET MARCENARIA E PAINEIS LTDA', 'Parket Marcenaria', '987.654.321.098', 'Av. das Madeiras, 250', 'São Paulo', 'SP', '04540-000', '(11) 3333-5555', 'marcenaria@parket.com.br', 'lucro_presumido', '#9A8B7A')
ON CONFLICT (id) DO NOTHING;

-- ── CENTROS DE CUSTO ────────────────────────────────────────
INSERT INTO core.centros_custo (id, codigo, nome, descricao, cor) VALUES
  ('cc111111-1111-1111-1111-111111111111', 'CC01', 'Pisos & Decks', 'Instalação e fornecimento de pisos de madeira, vinílico e decks externos', '#8B6F47'),
  ('cc222222-2222-2222-2222-222222222222', 'CC02', 'Marcenaria & Painéis', 'Móveis sob medida, painéis, portas e revestimentos em madeira', '#A0826D')
ON CONFLICT (id) DO NOTHING;

-- ── PLANO DE CONTAS ─────────────────────────────────────────
-- Estrutura: 1.x = RECEITAS, 2.x = CUSTOS DIRETOS, 3.x = DESPESAS OPERACIONAIS,
-- 4.x = DESPESAS ADMINISTRATIVAS, 5.x = TRIBUTOS, 6.x = DESPESAS FINANCEIRAS

-- Nível 1 (sintéticas)
INSERT INTO core.plano_contas (id, codigo, nome, tipo, natureza, parent_id, nivel, analitica) VALUES
  ('a0000001-0000-0000-0000-000000000001', '1', 'RECEITAS', 'receita', 'credito', NULL, 1, false),
  ('a0000002-0000-0000-0000-000000000002', '2', 'CUSTOS DIRETOS DE OBRA', 'despesa', 'debito', NULL, 1, false),
  ('a0000003-0000-0000-0000-000000000003', '3', 'DESPESAS OPERACIONAIS', 'despesa', 'debito', NULL, 1, false),
  ('a0000004-0000-0000-0000-000000000004', '4', 'DESPESAS ADMINISTRATIVAS', 'despesa', 'debito', NULL, 1, false),
  ('a0000005-0000-0000-0000-000000000005', '5', 'TRIBUTOS', 'despesa', 'debito', NULL, 1, false),
  ('a0000006-0000-0000-0000-000000000006', '6', 'DESPESAS FINANCEIRAS', 'despesa', 'debito', NULL, 1, false)
ON CONFLICT (id) DO NOTHING;

-- Nível 2/3 (analíticas — onde se lança)
INSERT INTO core.plano_contas (id, codigo, nome, tipo, natureza, parent_id, nivel, analitica) VALUES
  -- 1. RECEITAS
  ('a1000001-0000-0000-0000-000000000001', '1.01', 'Receita de Pisos & Decks', 'receita', 'credito', 'a0000001-0000-0000-0000-000000000001', 2, true),
  ('a1000002-0000-0000-0000-000000000002', '1.02', 'Receita de Marcenaria & Painéis', 'receita', 'credito', 'a0000001-0000-0000-0000-000000000001', 2, true),
  ('a1000003-0000-0000-0000-000000000003', '1.03', 'Receita de Manutenção & Garantia', 'receita', 'credito', 'a0000001-0000-0000-0000-000000000001', 2, true),
  ('a1000004-0000-0000-0000-000000000004', '1.04', 'Outras Receitas', 'receita', 'credito', 'a0000001-0000-0000-0000-000000000001', 2, true),
  -- 2. CUSTOS DIRETOS
  ('a2000001-0000-0000-0000-000000000001', '2.01', 'Matéria-prima — Madeira', 'despesa', 'debito', 'a0000002-0000-0000-0000-000000000002', 2, true),
  ('a2000002-0000-0000-0000-000000000002', '2.02', 'Matéria-prima — Vinílico/EVA', 'despesa', 'debito', 'a0000002-0000-0000-0000-000000000002', 2, true),
  ('a2000003-0000-0000-0000-000000000003', '2.03', 'Insumos — Cola, Verniz, Pregos', 'despesa', 'debito', 'a0000002-0000-0000-0000-000000000002', 2, true),
  ('a2000004-0000-0000-0000-000000000004', '2.04', 'Ferragens & Acessórios', 'despesa', 'debito', 'a0000002-0000-0000-0000-000000000002', 2, true),
  ('a2000005-0000-0000-0000-000000000005', '2.05', 'Mão de Obra Direta — Instaladores', 'despesa', 'debito', 'a0000002-0000-0000-0000-000000000002', 2, true),
  ('a2000006-0000-0000-0000-000000000006', '2.06', 'Mão de Obra Direta — Marceneiros', 'despesa', 'debito', 'a0000002-0000-0000-0000-000000000002', 2, true),
  ('a2000007-0000-0000-0000-000000000007', '2.07', 'Frete & Logística de Obra', 'despesa', 'debito', 'a0000002-0000-0000-0000-000000000002', 2, true),
  ('a2000008-0000-0000-0000-000000000008', '2.08', 'Subempreitada / Terceiros', 'despesa', 'debito', 'a0000002-0000-0000-0000-000000000002', 2, true),
  -- 3. DESPESAS OPERACIONAIS
  ('a3000001-0000-0000-0000-000000000001', '3.01', 'Comissões de Vendedores', 'despesa', 'debito', 'a0000003-0000-0000-0000-000000000003', 2, true),
  ('a3000002-0000-0000-0000-000000000002', '3.02', 'Marketing & Anúncios', 'despesa', 'debito', 'a0000003-0000-0000-0000-000000000003', 2, true),
  ('a3000003-0000-0000-0000-000000000003', '3.03', 'Custos de Viagens', 'despesa', 'debito', 'a0000003-0000-0000-0000-000000000003', 2, true),
  ('a3000004-0000-0000-0000-000000000004', '3.04', 'RTs & Comissões a Arquitetos', 'despesa', 'debito', 'a0000003-0000-0000-0000-000000000003', 2, true),
  ('a3000005-0000-0000-0000-000000000005', '3.05', 'Manutenção de Veículos', 'despesa', 'debito', 'a0000003-0000-0000-0000-000000000003', 2, true),
  ('a3000006-0000-0000-0000-000000000006', '3.06', 'Combustível', 'despesa', 'debito', 'a0000003-0000-0000-0000-000000000003', 2, true),
  -- 4. DESPESAS ADMINISTRATIVAS (custos fixos)
  ('a4000001-0000-0000-0000-000000000001', '4.01', 'Aluguel & Condomínio', 'despesa', 'debito', 'a0000004-0000-0000-0000-000000000004', 2, true),
  ('a4000002-0000-0000-0000-000000000002', '4.02', 'Salários Administrativos', 'despesa', 'debito', 'a0000004-0000-0000-0000-000000000004', 2, true),
  ('a4000003-0000-0000-0000-000000000003', '4.03', 'Pró-labore', 'despesa', 'debito', 'a0000004-0000-0000-0000-000000000004', 2, true),
  ('a4000004-0000-0000-0000-000000000004', '4.04', 'Energia Elétrica', 'despesa', 'debito', 'a0000004-0000-0000-0000-000000000004', 2, true),
  ('a4000005-0000-0000-0000-000000000005', '4.05', 'Internet & Telefonia', 'despesa', 'debito', 'a0000004-0000-0000-0000-000000000004', 2, true),
  ('a4000006-0000-0000-0000-000000000006', '4.06', 'Software & SaaS', 'despesa', 'debito', 'a0000004-0000-0000-0000-000000000004', 2, true),
  ('a4000007-0000-0000-0000-000000000007', '4.07', 'Contabilidade & Jurídico', 'despesa', 'debito', 'a0000004-0000-0000-0000-000000000004', 2, true),
  ('a4000008-0000-0000-0000-000000000008', '4.08', 'Material de Escritório', 'despesa', 'debito', 'a0000004-0000-0000-0000-000000000004', 2, true),
  ('a4000009-0000-0000-0000-000000000009', '4.09', 'Seguros', 'despesa', 'debito', 'a0000004-0000-0000-0000-000000000004', 2, true),
  -- 5. TRIBUTOS
  ('a5000001-0000-0000-0000-000000000001', '5.01', 'DAS / Simples Nacional', 'despesa', 'debito', 'a0000005-0000-0000-0000-000000000005', 2, true),
  ('a5000002-0000-0000-0000-000000000002', '5.02', 'PIS', 'despesa', 'debito', 'a0000005-0000-0000-0000-000000000005', 2, true),
  ('a5000003-0000-0000-0000-000000000003', '5.03', 'COFINS', 'despesa', 'debito', 'a0000005-0000-0000-0000-000000000005', 2, true),
  ('a5000004-0000-0000-0000-000000000004', '5.04', 'ICMS', 'despesa', 'debito', 'a0000005-0000-0000-0000-000000000005', 2, true),
  ('a5000005-0000-0000-0000-000000000005', '5.05', 'ISS', 'despesa', 'debito', 'a0000005-0000-0000-0000-000000000005', 2, true),
  ('a5000006-0000-0000-0000-000000000006', '5.06', 'IRPJ', 'despesa', 'debito', 'a0000005-0000-0000-0000-000000000005', 2, true),
  ('a5000007-0000-0000-0000-000000000007', '5.07', 'CSLL', 'despesa', 'debito', 'a0000005-0000-0000-0000-000000000005', 2, true),
  ('a5000008-0000-0000-0000-000000000008', '5.08', 'INSS / FGTS', 'despesa', 'debito', 'a0000005-0000-0000-0000-000000000005', 2, true),
  -- 6. FINANCEIRAS
  ('a6000001-0000-0000-0000-000000000001', '6.01', 'Tarifas Bancárias', 'despesa', 'debito', 'a0000006-0000-0000-0000-000000000006', 2, true),
  ('a6000002-0000-0000-0000-000000000002', '6.02', 'Juros & Multas', 'despesa', 'debito', 'a0000006-0000-0000-0000-000000000006', 2, true),
  ('a6000003-0000-0000-0000-000000000003', '6.03', 'IOF', 'despesa', 'debito', 'a0000006-0000-0000-0000-000000000006', 2, true)
ON CONFLICT (id) DO NOTHING;

-- ── PARCEIROS — VENDEDORES (5) ──────────────────────────────
INSERT INTO core.parceiros (id, tipo_pessoa, documento, nome, fantasia, is_vendedor, comissao_padrao, telefone, email, cidade, uf) VALUES
  ('da111111-0000-0000-0000-000000000001', 'PF', '111.222.333-44', 'Carlos Mendes', 'Carlos Vendas', true, 3.00, '(11) 91111-1111', 'carlos@parket.com.br', 'São Paulo', 'SP'),
  ('da111111-0000-0000-0000-000000000002', 'PF', '222.333.444-55', 'Marina Souza', 'Marina Comercial', true, 3.50, '(11) 92222-2222', 'marina@parket.com.br', 'São Paulo', 'SP'),
  ('da111111-0000-0000-0000-000000000003', 'PF', '333.444.555-66', 'Ricardo Almeida', 'Ricardo Vendas', true, 2.50, '(11) 93333-3333', 'ricardo@parket.com.br', 'São Paulo', 'SP'),
  ('da111111-0000-0000-0000-000000000004', 'PF', '444.555.666-77', 'Fernanda Lima', 'Fernanda Comercial', true, 3.00, '(11) 94444-4444', 'fernanda@parket.com.br', 'Campinas', 'SP'),
  ('da111111-0000-0000-0000-000000000005', 'PF', '555.666.777-88', 'João Pedro Silva', 'JP Vendas', true, 4.00, '(11) 95555-5555', 'joao@parket.com.br', 'São Paulo', 'SP')
ON CONFLICT (id) DO NOTHING;

-- ── PARCEIROS — FORNECEDORES (25) ───────────────────────────
INSERT INTO core.parceiros (id, tipo_pessoa, documento, nome, fantasia, is_fornecedor, telefone, email, cidade, uf) VALUES
  ('fa111111-0000-0000-0000-000000000001', 'PJ', '11.111.111/0001-11', 'MADEIRAS PREMIUM SUL LTDA', 'Madeiras Premium', true, '(51) 3000-1111', 'comercial@madeiraspremium.com.br', 'Caxias do Sul', 'RS'),
  ('fa111111-0000-0000-0000-000000000002', 'PJ', '22.222.222/0001-22', 'IPÊ NOBRE COMÉRCIO DE MADEIRAS', 'Ipê Nobre', true, '(91) 3000-2222', 'vendas@ipenobre.com.br', 'Belém', 'PA'),
  ('fa111111-0000-0000-0000-000000000003', 'PJ', '33.333.333/0001-33', 'CUMARU EXPORT IMP LTDA', 'Cumaru Export', true, '(91) 3000-3333', 'comercial@cumaruexport.com.br', 'Belém', 'PA'),
  ('fa111111-0000-0000-0000-000000000004', 'PJ', '44.444.444/0001-44', 'TARKETT BRASIL S/A', 'Tarkett', true, '(11) 4000-4444', 'b2b@tarkett.com.br', 'São Paulo', 'SP'),
  ('fa111111-0000-0000-0000-000000000005', 'PJ', '55.555.555/0001-55', 'EUCAFLOOR INDUSTRIA E COMERCIO', 'Eucafloor', true, '(11) 4000-5555', 'vendas@eucafloor.com.br', 'Curitiba', 'PR'),
  ('fa111111-0000-0000-0000-000000000006', 'PJ', '66.666.666/0001-66', 'DURAFLOOR REVESTIMENTOS', 'Durafloor', true, '(41) 3000-6666', 'comercial@durafloor.com.br', 'Curitiba', 'PR'),
  ('fa111111-0000-0000-0000-000000000007', 'PJ', '77.777.777/0001-77', 'COLAS E ADESIVOS HENKEL', 'Henkel', true, '(11) 4000-7777', 'industrial@henkel.com', 'Itapevi', 'SP'),
  ('fa111111-0000-0000-0000-000000000008', 'PJ', '88.888.888/0001-88', 'SHERWIN WILLIAMS DO BRASIL', 'Sherwin Williams', true, '(11) 4000-8888', 'b2b@sherwin.com.br', 'Sumaré', 'SP'),
  ('fa111111-0000-0000-0000-000000000009', 'PJ', '99.999.999/0001-99', 'BLUM DO BRASIL FERRAGENS', 'Blum', true, '(47) 3000-9999', 'vendas@blum.com.br', 'Joinville', 'SC'),
  ('fa111111-0000-0000-0000-000000000010', 'PJ', '10.111.111/0001-10', 'HAFELE FERRAGENS BRASIL', 'Hafele', true, '(11) 4000-1010', 'b2b@hafele.com.br', 'Carapicuíba', 'SP'),
  ('fa111111-0000-0000-0000-000000000011', 'PJ', '11.111.222/0001-11', 'GUARARAPES PAINÉIS MDF', 'Guararapes', true, '(83) 3000-1111', 'comercial@guararapes.com.br', 'João Pessoa', 'PB'),
  ('fa111111-0000-0000-0000-000000000012', 'PJ', '12.222.222/0001-12', 'BERNECK PAINÉIS DE MADEIRA', 'Berneck', true, '(41) 3000-1212', 'b2b@berneck.com.br', 'Curitiba', 'PR'),
  ('fa111111-0000-0000-0000-000000000013', 'PJ', '13.333.333/0001-13', 'EUCATEX S/A', 'Eucatex', true, '(11) 4000-1313', 'comercial@eucatex.com.br', 'Salto', 'SP'),
  ('fa111111-0000-0000-0000-000000000014', 'PJ', '14.444.444/0001-14', 'MASISA INDUSTRIA DE MADEIRA', 'Masisa', true, '(11) 4000-1414', 'vendas@masisa.com', 'São Paulo', 'SP'),
  ('fa111111-0000-0000-0000-000000000015', 'PJ', '15.555.555/0001-15', 'FOGAÇA TRANSPORTES DE OBRA', 'Fogaça Transp', true, '(11) 91515-1515', 'logistica@fogaca.com.br', 'São Paulo', 'SP'),
  ('fa111111-0000-0000-0000-000000000016', 'PJ', '16.666.666/0001-16', 'EXPRESSO SP CARGAS LTDA', 'Expresso SP', true, '(11) 91616-1616', 'cargas@expressosp.com.br', 'Guarulhos', 'SP'),
  ('fa111111-0000-0000-0000-000000000017', 'PF', '716.171.717-17', 'JOSÉ APARECIDO INSTALADOR', 'José Instalador', true, '(11) 91717-1717', 'jose.aparecido@gmail.com', 'São Paulo', 'SP'),
  ('fa111111-0000-0000-0000-000000000018', 'PF', '818.181.818-18', 'LUIS ALBERTO MARCENEIRO', 'Luis Marceneiro', true, '(11) 91818-1818', 'luis.alberto@gmail.com', 'São Paulo', 'SP'),
  ('fa111111-0000-0000-0000-000000000019', 'PF', '919.191.919-19', 'PAULO ROBERTO INSTALADOR', 'Paulo Instalador', true, '(11) 91919-1919', 'paulo.r@gmail.com', 'Osasco', 'SP'),
  ('fa111111-0000-0000-0000-000000000020', 'PJ', '20.202.020/0001-20', 'MARTELO MARCENARIA TERCEIRIZADA', 'Martelo', true, '(11) 4000-2020', 'orcamento@martelomarcenaria.com.br', 'Cotia', 'SP'),
  ('fa111111-0000-0000-0000-000000000021', 'PJ', '21.212.121/0001-21', 'POSTO SHELL CENTRO LTDA', 'Posto Shell', true, '(11) 4000-2121', 'frota@postoshellcentro.com.br', 'São Paulo', 'SP'),
  ('fa111111-0000-0000-0000-000000000022', 'PJ', '22.232.323/0001-22', 'IMOBILIARIA RHM', 'RHM Imóveis', true, '(11) 4000-2222', 'aluguel@rhm.com.br', 'São Paulo', 'SP'),
  ('fa111111-0000-0000-0000-000000000023', 'PJ', '23.343.434/0001-23', 'ENEL DISTRIBUIÇÃO SP', 'Enel SP', true, '0800 7283', 'sac@enel.com.br', 'São Paulo', 'SP'),
  ('fa111111-0000-0000-0000-000000000024', 'PJ', '24.454.545/0001-24', 'VIVO TELEFONICA BRASIL', 'Vivo', true, '(11) 4000-2424', 'empresas@vivo.com.br', 'São Paulo', 'SP'),
  ('fa111111-0000-0000-0000-000000000025', 'PJ', '25.565.656/0001-25', 'CONTABILIDADE AUDICON', 'Audicon', true, '(11) 4000-2525', 'contato@audiconcontadores.com.br', 'São Paulo', 'SP')
ON CONFLICT (id) DO NOTHING;

-- ── PARCEIROS — CLIENTES (30) ───────────────────────────────
INSERT INTO core.parceiros (id, tipo_pessoa, documento, nome, fantasia, is_cliente, telefone, email, cidade, uf) VALUES
  ('ca111111-0000-0000-0000-000000000001', 'PF', '111.111.111-11', 'Eduardo Marques Ribeiro', NULL, true, '(11) 99111-1111', 'eduardo.marques@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000002', 'PF', '222.222.222-22', 'Carolina Oliveira Castro', NULL, true, '(11) 99222-2222', 'carol.castro@hotmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000003', 'PF', '333.333.333-33', 'Marcelo Costa Almeida', NULL, true, '(11) 99333-3333', 'marcelo.costa@uol.com.br', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000004', 'PF', '444.444.444-44', 'Inácio Passos Pereira', NULL, true, '(11) 99444-4444', 'inacio.pp@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000005', 'PF', '555.555.555-55', 'Walter Dalari Ferreira', NULL, true, '(11) 99555-5555', 'walter.dalari@yahoo.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000006', 'PF', '666.666.666-66', 'André Marcos Campedelli', NULL, true, '(11) 99666-6666', 'andre.marcos@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000007', 'PF', '777.777.777-77', 'Thainara Aparecida Silva', NULL, true, '(11) 99777-7777', 'thai.silva@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000008', 'PF', '888.888.888-88', 'Roberto Carlos Mendonça', NULL, true, '(11) 99888-8888', 'rc.mendonca@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000009', 'PF', '999.999.999-99', 'Patrícia Lima Andrade', NULL, true, '(11) 99999-9999', 'patricia.la@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000010', 'PJ', '50.111.111/0001-50', 'CONSTRUTORA HORIZONTE LTDA', 'Horizonte Const.', true, '(11) 4500-1111', 'compras@horizonte.com.br', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000011', 'PJ', '50.222.222/0001-50', 'CYRELA INVESTIMENTOS S/A', 'Cyrela', true, '(11) 4500-2222', 'incorpora@cyrela.com.br', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000012', 'PJ', '50.333.333/0001-50', 'ARQUITETURA M&M ASSOCIADOS', 'M&M Arq.', true, '(11) 4500-3333', 'projetos@mm-arq.com.br', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000013', 'PF', '101.010.101-01', 'Renata Souza Pinheiro', NULL, true, '(11) 98010-1010', 'renata.sp@gmail.com', 'Campinas', 'SP'),
  ('ca111111-0000-0000-0000-000000000014', 'PF', '111.121.212-12', 'Felipe Gomes Vasconcelos', NULL, true, '(11) 98012-1212', 'felipe.gv@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000015', 'PF', '131.313.131-31', 'Juliana Ramos Beltrão', NULL, true, '(11) 98013-1313', 'juliana.rb@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000016', 'PF', '141.414.141-41', 'Bruno Henrique Tavares', NULL, true, '(11) 98014-1414', 'bruno.ht@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000017', 'PF', '151.515.151-51', 'Larissa Mendes Pacheco', NULL, true, '(11) 98015-1515', 'larissa.mp@gmail.com', 'Santo André', 'SP'),
  ('ca111111-0000-0000-0000-000000000018', 'PF', '161.616.161-61', 'Diego Antonio Barros', NULL, true, '(11) 98016-1616', 'diego.barros@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000019', 'PF', '171.717.171-71', 'Camila Ferreira Duarte', NULL, true, '(11) 98017-1717', 'camila.fd@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000020', 'PJ', '50.444.444/0001-50', 'GAFISA INCORPORAÇÕES S/A', 'Gafisa', true, '(11) 4500-4444', 'compras@gafisa.com.br', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000021', 'PJ', '50.555.555/0001-50', 'YOU INC INCORPORADORA', 'You Inc', true, '(11) 4500-5555', 'compras@youinc.com.br', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000022', 'PJ', '50.666.666/0001-50', 'TRISUL S/A', 'Trisul', true, '(11) 4500-6666', 'b2b@trisul-sa.com.br', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000023', 'PF', '232.323.232-23', 'Henrique Pinto Vargas', NULL, true, '(11) 98023-2323', 'henrique.pv@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000024', 'PF', '242.424.242-42', 'Mariana Cardoso Antunes', NULL, true, '(11) 98024-2424', 'mariana.ca@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000025', 'PF', '252.525.252-52', 'Rafael Oliveira Nunes', NULL, true, '(11) 98025-2525', 'rafael.on@gmail.com', 'Guarulhos', 'SP'),
  ('ca111111-0000-0000-0000-000000000026', 'PF', '262.626.262-62', 'Sabrina Ribeiro Castro', NULL, true, '(11) 98026-2626', 'sabrina.rc@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000027', 'PF', '272.727.272-72', 'Vinicius Bastos Moreira', NULL, true, '(11) 98027-2727', 'vinicius.bm@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000028', 'PJ', '50.777.777/0001-50', 'ARQ. JULIANA SAYÃO', 'Sayão Arq.', true, '(11) 4500-7777', 'projetos@sayaoarq.com.br', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000029', 'PF', '292.929.292-92', 'Talita Ferraz Alvarenga', NULL, true, '(11) 98029-2929', 'talita.fa@gmail.com', 'São Paulo', 'SP'),
  ('ca111111-0000-0000-0000-000000000030', 'PF', '303.030.303-03', 'Caio Murakami Tanaka', NULL, true, '(11) 98030-3030', 'caio.mt@gmail.com', 'São Paulo', 'SP')
ON CONFLICT (id) DO NOTHING;

-- ── CONTAS BANCÁRIAS ────────────────────────────────────────
INSERT INTO core.contas_bancarias (id, empresa_id, banco, agencia, conta, tipo, saldo_inicial, saldo_inicial_data) VALUES
  ('ba111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Itaú', '1234', '56789-0', 'corrente', 850000.00, '2026-01-01'),
  ('ba111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Bradesco', '5678', '12345-6', 'corrente', 320000.00, '2026-01-01'),
  ('ba111111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Caixa Interno', NULL, NULL, 'caixa', 12000.00, '2026-01-01'),
  ('bb222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Itaú', '4321', '98765-4', 'corrente', 480000.00, '2026-01-01'),
  ('bb222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Banco do Brasil', '8765', '43210-9', 'corrente', 175000.00, '2026-01-01'),
  ('bb222222-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Caixa Interno', NULL, NULL, 'caixa', 8000.00, '2026-01-01')
ON CONFLICT (id) DO NOTHING;
