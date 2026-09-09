-- =====================================================================
-- SEED: dominios *.parket.works extraidos das rules Host() do Traefik
-- em 25/08/2026. Grupos seguem o mapeamento setor->app do portal
-- (portal_apps) + classificacao dos demais dominios.
-- Editar grupo/nome/ordem aqui ou direto na tabela: a pagina reflete.
-- =====================================================================

INSERT INTO monitor.apps (slug, nome, url, grupo, grupo_ordem, ordem, interno) VALUES
-- Plataformas principais (nucleo da operacao)
('dash',        'Space Parket (Dashboard)',   'https://dash.parket.works',        'Plataformas Principais', 1, 1,  false),
('base',        'Space Parket (Base)',        'https://base.parket.works',        'Plataformas Principais', 1, 2,  false),
('space',       'Portal Space',               'https://space.parket.works',       'Plataformas Principais', 1, 3,  false),
('center',      'Central do Cliente',         'https://center.parket.works',      'Plataformas Principais', 1, 4,  false),
('homebroker',  'Homebroker (Comercial)',     'https://homebroker.parket.works',  'Plataformas Principais', 1, 5,  false),
('valor',       'Valor (Orcamento)',          'https://valor.parket.works',       'Plataformas Principais', 1, 6,  false),
('gestao',      'Gestao de Obras',            'https://gestao.parket.works',      'Plataformas Principais', 1, 7,  false),
('draw',        'Status / Draw',              'https://draw.parket.works',        'Plataformas Principais', 1, 8,  false),

-- Setores
('projetos',    'Projetos',                   'https://projetos.parket.works',    'Setores', 2, 1,  false),
('producao',    'Producao (PCP)',             'https://producao.parket.works',    'Setores', 2, 2,  false),
('compras',     'Compras',                    'https://compras.parket.works',     'Setores', 2, 3,  false),
('suprimentos', 'Suprimentos',                'https://suprimentos.parket.works', 'Setores', 2, 4,  false),
('expedicao',   'Expedicao (Logistica)',      'https://expedicao.parket.works',   'Setores', 2, 5,  false),
('core',        'Core (Financeiro)',          'https://core.parket.works',        'Setores', 2, 6,  false),
('tasks',       'Tasks (Marketing)',          'https://tasks.parket.works',       'Setores', 2, 7,  false),
('rh',          'RH',                         'https://rh.parket.works',          'Setores', 2, 8,  false),
('cs',          'CS (Sucesso do Cliente)',    'https://cs.parket.works',          'Setores', 2, 9,  false),
('fiscal',      'Fiscal',                     'https://fiscal.parket.works',      'Setores', 2, 10, false),
('cronograma',  'Cronograma',                 'https://cronograma.parket.works',  'Setores', 2, 11, false),
('contrato',    'Contratos',                  'https://contrato.parket.works',    'Setores', 2, 12, false),
('guia',        'Guia',                       'https://guia.parket.works',        'Setores', 2, 13, false),
('erp',         'ERP',                        'https://erp.parket.works',         'Setores', 2, 14, false),
('api-erp',     'ERP API',                    'https://api.erp.parket.works',     'Setores', 2, 15, false),

-- Apps de campo e comunicacao
('chat',        'Chat Parket',                'https://chat.parket.works',        'Campo e Comunicacao', 3, 1, false),
('server',      'Chat Widget (server)',       'https://server.parket.works',      'Campo e Comunicacao', 3, 2, false),
('instala',     'Instalador',                 'https://instala.parket.works',     'Campo e Comunicacao', 3, 3, false),
('verifica',    'Verifica (Fiscal campo)',    'https://verifica.parket.works',    'Campo e Comunicacao', 3, 4, false),
('insta',       'InstaParket',                'https://insta.parket.works',       'Campo e Comunicacao', 3, 5, false),

-- Comercial externo
('site',        'Site Parket',                'https://site.parket.works',        'Site e Vendas', 4, 1, false),
('comercial',   'Comercial',                  'https://comercial.parket.works',   'Site e Vendas', 4, 2, false),
('proposta',    'Proposta',                   'https://proposta.parket.works',    'Site e Vendas', 4, 3, false),

-- IA e automacao
('teca',        'Teca IA',                    'https://teca.parket.works',        'IA e Automacao', 5, 1, false),
('agente',      'Agente IA',                  'https://agente.parket.works',      'IA e Automacao', 5, 2, false),
('os',          'OS (EAS)',                   'https://os.parket.works',          'IA e Automacao', 5, 3, false),
('injexia',     'Injex IA',                   'https://injexia.parket.works',     'IA e Automacao', 5, 4, false),

-- Infraestrutura
('api',         'API Parket (Supabase)',      'https://api.parket.works',         'Infraestrutura', 6, 1, false),
('conect',      'Conect',                     'https://conect.parket.works',      'Infraestrutura', 6, 2, false),
('conect2',     'Conect 2',                   'https://conect2.parket.works',     'Infraestrutura', 6, 3, false),
('painel',      'Painel',                     'https://painel.parket.works',      'Infraestrutura', 6, 4, false),

-- Interno / dev / staging (secao separada no fim da pagina)
('space2',        'Space 2',            'https://space2.parket.works',        'Interno e Staging', 7, 1, true),
('dev',           'Dev Preview',        'https://dev.parket.works',           'Interno e Staging', 7, 2, true),
('staging-space', 'Space Staging',      'https://staging.space.parket.works', 'Interno e Staging', 7, 3, true),
('ux',            'UX',                 'https://ux.parket.works',            'Interno e Staging', 7, 4, true),
('mcp-ux',        'MCP UX',             'https://mcp-ux.parket.works',        'Interno e Staging', 7, 5, true)
ON CONFLICT (slug) DO NOTHING;
