-- 007 — Painel Jornada = 11 entregas espelhando o center do cliente (Will 22/07)
--
-- Estrutura do center:
--   VISTORIA TÉCNICA: Itens Contratados, Checklist de Início, Reconhecimento da Obra, Liberação de Obra
--   PROJETO: Mapeamento, Definições, Anteprojeto, Projeto Executivo
--   ACOMPANHAMENTO DE OBRAS: Cronograma
--   CONCLUSÃO: Validação de Entrega, Avaliação da Experiência
--
-- Linhas removidas do painel (Orçamento, Contrato, Insumos/Compras, Mapeamento fiscal,
-- Relatórios, Medição fiscal, Arquivos de logística/produção, Lista do Instalador)
-- ficam no DB pra não quebrar uploads antigos (gestao.documentos.catalogo_id FK).
-- Escondemos via visivel_jornada=false.

ALTER TABLE gestao.documentos_catalogo
  ADD COLUMN IF NOT EXISTS visivel_jornada boolean DEFAULT true;

-- ── Fase 1 · Vistoria Técnica ────────────────────────────────
UPDATE gestao.documentos_catalogo SET
  fase=1, fase_titulo='Vistoria Técnica', titulo='Itens Contratados',
  etapa_numero=1, ordem=1, visivel_jornada=true
 WHERE codigo='1';

INSERT INTO gestao.documentos_catalogo
  (fase, fase_titulo, codigo, titulo, etapa_numero, obrigatorio, ordem, visivel_jornada) VALUES
  (1, 'Vistoria Técnica', '0.1', 'Checklist de Início', 3, true, 2, true)
ON CONFLICT (codigo) DO UPDATE SET
  fase=EXCLUDED.fase, fase_titulo=EXCLUDED.fase_titulo, titulo=EXCLUDED.titulo,
  etapa_numero=EXCLUDED.etapa_numero, ordem=EXCLUDED.ordem, visivel_jornada=true;

UPDATE gestao.documentos_catalogo SET
  fase=1, fase_titulo='Vistoria Técnica', titulo='Reconhecimento da Obra',
  etapa_numero=2, ordem=3, visivel_jornada=true
 WHERE codigo='9.1';

UPDATE gestao.documentos_catalogo SET
  fase=1, fase_titulo='Vistoria Técnica', titulo='Liberação de Obra',
  etapa_numero=4, ordem=4, visivel_jornada=true
 WHERE codigo='9.2';

-- ── Fase 2 · Projeto ─────────────────────────────────────────
UPDATE gestao.documentos_catalogo SET
  fase=2, fase_titulo='Projeto', titulo='Mapeamento',
  etapa_numero=5, ordem=5, visivel_jornada=true
 WHERE codigo='3';

INSERT INTO gestao.documentos_catalogo
  (fase, fase_titulo, codigo, titulo, etapa_numero, obrigatorio, ordem, visivel_jornada) VALUES
  (2, 'Projeto', '3.1', 'Definições', 12, true, 6, true)
ON CONFLICT (codigo) DO UPDATE SET
  fase=EXCLUDED.fase, fase_titulo=EXCLUDED.fase_titulo, titulo=EXCLUDED.titulo,
  etapa_numero=EXCLUDED.etapa_numero, ordem=EXCLUDED.ordem, visivel_jornada=true;

UPDATE gestao.documentos_catalogo SET
  fase=2, fase_titulo='Projeto', titulo='Anteprojeto',
  etapa_numero=11, ordem=7, visivel_jornada=true
 WHERE codigo='10';

UPDATE gestao.documentos_catalogo SET
  fase=2, fase_titulo='Projeto', titulo='Projeto Executivo',
  etapa_numero=7, ordem=8, visivel_jornada=true
 WHERE codigo='12';

-- ── Fase 3 · Acompanhamento de Obras ─────────────────────────
UPDATE gestao.documentos_catalogo SET
  fase=3, fase_titulo='Acompanhamento de Obras', titulo='Cronograma',
  etapa_numero=6, ordem=9, visivel_jornada=true
 WHERE codigo='4';

-- ── Fase 4 · Conclusão ───────────────────────────────────────
UPDATE gestao.documentos_catalogo SET
  fase=4, fase_titulo='Conclusão', titulo='Validação de Entrega',
  etapa_numero=9, ordem=10, visivel_jornada=true
 WHERE codigo='17.1';

UPDATE gestao.documentos_catalogo SET
  fase=4, fase_titulo='Conclusão', titulo='Avaliação da Experiência',
  etapa_numero=10, ordem=11, visivel_jornada=true
 WHERE codigo='17.2';

-- ── Ocultas (legado dos documentos já subidos) ───────────────
UPDATE gestao.documentos_catalogo SET visivel_jornada=false
 WHERE codigo IN ('0', '2', '5', '6', '7', '8', '9.3', '9.4', '11', '13', '14', '15', '16.1', '16.2');
