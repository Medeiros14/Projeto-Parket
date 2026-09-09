-- 006 — Catálogo canônico de documentos por fase (gabarito de todo projeto)
-- Estrutura extraída da pasta-modelo de obra (6 fases, passos 0..17.2).

CREATE TABLE IF NOT EXISTS gestao.documentos_catalogo (
  id           serial PRIMARY KEY,
  fase         int  NOT NULL,
  fase_titulo  text NOT NULL,
  codigo       text NOT NULL UNIQUE,          -- '0', '1', ... '9.1', '16.2', '17.2'
  titulo       text NOT NULL,
  etapa_numero int REFERENCES gestao.etapas_catalogo(numero),
  obrigatorio  boolean DEFAULT true,
  ordem        int NOT NULL
);

INSERT INTO gestao.documentos_catalogo (fase, fase_titulo, codigo, titulo, etapa_numero, obrigatorio, ordem) VALUES
  (1, 'Inicial',                          '0',    'Solicitação / Projeto de arquitetura',        1,    true,  0),
  (1, 'Inicial',                          '1',    'Lista de itens',                              1,    true,  1),
  (2, 'Orçamento e Planejamento',         '2',    'Orçamento',                                   NULL, true,  2),
  (2, 'Orçamento e Planejamento',         '3',    'Mapeamento',                                  4,    true,  3),
  (2, 'Orçamento e Planejamento',         '4',    'Cronograma',                                  5,    true,  4),
  (3, 'Suprimentos',                      '5',    'Lista de insumos',                            NULL, true,  5),
  (3, 'Suprimentos',                      '6',    'Lista de compras',                            NULL, true,  6),
  (4, 'Fiscal e Contratual',              '7',    'Mapeamento fiscal',                           4,    true,  7),
  (4, 'Fiscal e Contratual',              '8',    'Contrato de prestação de serviço',            NULL, true,  8),
  (4, 'Fiscal e Contratual',              '9.1',  '1ª Vistoria do Fiscal',                       2,    true,  9),
  (4, 'Fiscal e Contratual',              '9.2',  'Termo de Responsabilidade de Obra',           2,    true,  10),
  (4, 'Fiscal e Contratual',              '9.3',  'Relatório Fotográfico',                       3,    true,  11),
  (4, 'Fiscal e Contratual',              '9.4',  'Relatório de Acompanhamento',                 3,    true,  12),
  (5, 'Execução, Produção e Logística',   '10',   'Anteprojeto',                                 6,    true,  13),
  (5, 'Execução, Produção e Logística',   '11',   'Medição fiscal',                              6,    true,  14),
  (5, 'Execução, Produção e Logística',   '12',   'Projeto executivo',                           6,    true,  15),
  (5, 'Execução, Produção e Logística',   '13',   'Arquivos de logística',                       7,    true,  16),
  (5, 'Execução, Produção e Logística',   '14',   'Arquivos de produção',                        7,    true,  17),
  (5, 'Execução, Produção e Logística',   '15',   'Lista do Instalador (Operacional)',           7,    true,  18),
  (5, 'Execução, Produção e Logística',   '16.1', 'Relatório de Acompanhamento de Produtividade',7,    true,  19),
  (5, 'Execução, Produção e Logística',   '16.2', 'Relatório Fotográfico de Obra',               7,    true,  20),
  (6, 'Entrega e Finalização',            '17.1', 'Termo de Entrega da Obra',                    8,    true,  21),
  (6, 'Entrega e Finalização',            '17.2', 'Formulário de Avaliação',                     9,    true,  22)
ON CONFLICT (codigo) DO UPDATE
  SET fase = EXCLUDED.fase, fase_titulo = EXCLUDED.fase_titulo,
      titulo = EXCLUDED.titulo, etapa_numero = EXCLUDED.etapa_numero,
      ordem = EXCLUDED.ordem;

ALTER TABLE gestao.documentos ADD COLUMN IF NOT EXISTS catalogo_id   int REFERENCES gestao.documentos_catalogo(id);
ALTER TABLE gestao.documentos ADD COLUMN IF NOT EXISTS nome_arquivo  text;
ALTER TABLE gestao.documentos ADD COLUMN IF NOT EXISTS tamanho_bytes bigint;

CREATE INDEX IF NOT EXISTS idx_gestao_doc_catalogo ON gestao.documentos(projeto_id, catalogo_id);
