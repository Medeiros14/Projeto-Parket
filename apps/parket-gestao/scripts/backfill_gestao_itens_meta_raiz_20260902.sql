-- ═══════════════════════════════════════════════════════════════════
-- Backfill meta.categoria_raiz + meta.subtipo em gestao.itens (02/09/2026)
-- QUE FAZ: o watcher do PCP (sync_criar_op_de_projetos + lista_fabricacao_gestao
-- no compras-contratos-watcher.py) classifica fabricação por meta.categoria_raiz
-- ('MARCENARIA','PORTA','PAINEL') e, pra FORRO, por meta.subtipo em
-- FORRO_SUB_PRODUCAO. Os itens copiados dos backfills 26/08 e 02/09 herdaram o
-- meta cru da proposta SEM essas chaves — projeto fabril ficava invisível pro PCP.
-- 1) categoria_raiz = split_part(categoria,'||',1) onde falta;
-- 2) subtipo de FORRO derivado por palavra-chave do descritivo (mesmos tokens
--    do FORRO_SUB_PRODUCAO), só onde falta e onde há keyword.
-- Idempotente: cada UPDATE filtra pela ausência da chave.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

UPDATE gestao.itens
   SET meta = COALESCE(meta, '{}'::jsonb)
              || jsonb_build_object('categoria_raiz', split_part(categoria, '||', 1))
 WHERE NOT (COALESCE(meta, '{}'::jsonb) ? 'categoria_raiz')
   AND COALESCE(split_part(categoria, '||', 1), '') <> '';

UPDATE gestao.itens
   SET meta = meta || jsonb_build_object('subtipo',
       CASE WHEN lower(unaccent(descritivo)) ~ 'toblerone' THEN 'toblerone'
            WHEN lower(unaccent(descritivo)) ~ 'muxarabi'  THEN 'muxarabi'
            WHEN lower(unaccent(descritivo)) ~ 'ripado'    THEN 'ripado'
            WHEN lower(unaccent(descritivo)) ~ 'lamin'     THEN 'laminado'
            WHEN lower(unaccent(descritivo)) ~ 'macico'    THEN 'macico'
            WHEN lower(unaccent(descritivo)) ~ 'regua'     THEN 'regua'
            ELSE 'recortes' END)
 WHERE meta->>'categoria_raiz' = 'FORRO'
   AND NOT (meta ? 'subtipo')
   AND lower(unaccent(COALESCE(descritivo, ''))) ~ '(toblerone|muxarabi|ripado|lamin|macico|regua|recorte)';

-- conferência
SELECT (meta ? 'categoria_raiz') AS tem_raiz, count(*) FROM gestao.itens GROUP BY 1;
SELECT meta->>'subtipo' AS subtipo_forro, count(*) FROM gestao.itens
 WHERE meta->>'categoria_raiz' = 'FORRO' GROUP BY 1 ORDER BY 2 DESC;

COMMIT;
