-- F8 — Ficha técnica v2 (Feature 2)
-- chave_match: alternativas separadas por | (match sem acento/caixa no texto do item;
-- um item pode casar VÁRIAS fichas). corpo_md: markdown. consumo_cola_m2: kg/m².

ALTER TABLE public.instala_fichas_tecnicas
  ADD COLUMN IF NOT EXISTS chave_match text,
  ADD COLUMN IF NOT EXISTS corpo_md text,
  ADD COLUMN IF NOT EXISTS consumo_cola_m2 numeric,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill das fichas existentes
UPDATE public.instala_fichas_tecnicas
   SET corpo_md = COALESCE(corpo_md, conteudo),
       chave_match = COALESCE(chave_match,
         CASE
           WHEN categoria = 'FORRO'  THEN 'toblerone'
           WHEN categoria = 'PAINEL' THEN 'painel|ripado'
           ELSE COALESCE(material, categoria)
         END);

-- Seed 1/3 — instalação reta (evolui a ficha PISO existente)
UPDATE public.instala_fichas_tecnicas
   SET titulo = 'Piso de madeira — instalação reta (régua / assoalho)',
       chave_match = 'regua|assoalho|tabua',
       consumo_cola_m2 = 1.2,
       corpo_md = E'[GESTÃO: revisar conteúdo]\n\n## Antes de começar\n- Contrapiso limpo, seco e nivelado (desnível máx. 3 mm a cada 2 m).\n- Deixe o material aclimatando no ambiente por 72h, na embalagem.\n- Confira o sentido de instalação com o mapa da obra — na dúvida, chame o fiscal.\n\n## Instalação\n1. Marque a linha guia da primeira fiada com linha de nylon ou laser.\n2. Aplique a cola com desempenadeira dentada, em faixas que dê pra cobrir em 20-30 min.\n3. Assente as réguas com junta amarrada (emendas desencontradas fiada a fiada).\n4. Deixe junta de dilatação de 10-12 mm em todo o perímetro e em portas.\n\n## Atenção\n- NUNCA bata direto na peça — use batedor e martelo de borracha.\n- Limpe excesso de cola na hora com pano levemente umedecido.\n- Não libere trânsito pesado antes de 24h.',
       updated_at = now()
 WHERE categoria = 'PISO';

-- Seed 2/3 — chevron / espinha de peixe
INSERT INTO public.instala_fichas_tecnicas (categoria, material, titulo, conteudo, chave_match, corpo_md, consumo_cola_m2)
SELECT 'PISO', 'CHEVRON', 'Piso de madeira — chevron / espinha de peixe',
       '[GESTÃO: revisar conteúdo]',
       'chevron|espinha',
       E'[GESTÃO: revisar conteúdo]\n\n## Antes de começar\n- Marque o eixo central do ambiente — chevron parte do meio pro lado.\n- Peças têm lado A e lado B (corte 45°): separe os dois lados antes de colar.\n- Deixe o material aclimatando no ambiente por 72h.\n\n## Instalação\n1. Estique a linha guia central (nylon ou laser) no sentido combinado com o fiscal.\n2. Monte a primeira fiada seca (sem cola) pra conferir o fechamento das pontas.\n3. Aplique a cola com desempenadeira dentada, em faixas de 20-30 min de trabalho.\n4. As pontas devem fechar alinhadas na linha guia — desvio pequeno acumula nas próximas fiadas.\n5. Deixe junta de dilatação de 10-12 mm no perímetro.\n\n## Atenção\n- NUNCA bata direto na peça — use batedor e martelo de borracha.\n- Confira o alinhamento do espinhado a cada 3 fiadas.\n- Limpe excesso de cola na hora com pano levemente umedecido.',
       1.4
 WHERE NOT EXISTS (SELECT 1 FROM public.instala_fichas_tecnicas WHERE chave_match = 'chevron|espinha');

-- Seed 3/3 — rodapé
INSERT INTO public.instala_fichas_tecnicas (categoria, material, titulo, conteudo, chave_match, corpo_md)
SELECT 'RODAPE', NULL, 'Rodapé — instalação e acabamento',
       '[GESTÃO: revisar conteúdo]',
       'rodape',
       E'[GESTÃO: revisar conteúdo]\n\n## Antes de começar\n- Piso assentado e perímetro limpo.\n- Meça os panos de parede e planeje as emendas longe dos cantos.\n\n## Instalação\n1. Corte os encontros de canto a 45° (meia esquadria).\n2. Fixe com cola de montagem; use pino quando a parede permitir.\n3. Emendas sempre coladas e lixadas depois de secas.\n4. Vede o encontro com a parede com selante acrílico da cor do rodapé.\n\n## Atenção\n- Parede torta: não force a peça reta — trabalhe o acabamento com selante.\n- Não deixe pino aparente sem massa de correção.'
 WHERE NOT EXISTS (SELECT 1 FROM public.instala_fichas_tecnicas WHERE chave_match = 'rodape');

NOTIFY pgrst, 'reload schema';
