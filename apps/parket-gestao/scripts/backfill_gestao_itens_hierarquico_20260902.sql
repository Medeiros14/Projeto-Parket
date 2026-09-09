-- ═══════════════════════════════════════════════════════════════════
-- Migração pro padrão hierárquico (02/09/2026, Will: "insumos e
-- instalação não são itens")
-- QUE FAZ: todo projeto com itens de CÓPIA CRUA da proposta (categoria
-- encoded "X||Y||Z" e sem meta.produto_header) é reprojetado com
-- gestao.itens_hierarquicos_de_sim (sql/024): apaga os itens crus
-- (cascade em item_etapa_status; nenhum tinha progresso nem foto,
-- auditado antes) e insere 1 item por AMBIENTE agregando
-- PRODUTO+INSUMOS+INSTALAÇÃO + recortes expandidos.
-- Escopo auditado: 34 projetos, todos com simulacao_id, 0 etapas
-- avançadas, 0 fotos em item. Projetos legados de planilha (categoria
-- sem "||") ficam fora.
-- Idempotente: depois da migração nenhum item casa no filtro do alvo.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  r record;
  v_n integer;
BEGIN
  FOR r IN
    SELECT p.id, p.simulacao_id, p.cliente
      FROM gestao.projetos p
     WHERE p.simulacao_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM gestao.itens i
                    WHERE i.projeto_id = p.id
                      AND i.categoria LIKE '%||%'
                      AND NOT (i.meta ? 'produto_header'))
  LOOP
    DELETE FROM gestao.itens WHERE projeto_id = r.id;
    v_n := gestao.itens_hierarquicos_de_sim(r.id, r.simulacao_id, false);
    UPDATE gestao.projetos p
       SET valor_total = (SELECT COALESCE(SUM(valor),0) FROM public.simulacao_itens si
                           WHERE si.simulacao_id = r.simulacao_id)
     WHERE p.id = r.id;
    INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
    VALUES (r.id, 'criado', 'Itens reagrupados no padrão hierárquico',
            format('%s itens (1 por ambiente, produto+insumos+instalação agregados)', v_n),
            'will.tape@gmail.com',
            jsonb_build_object('simulacao_id', r.simulacao_id,
                               'backfill', 'hierarquico-02-09'));
    RAISE NOTICE 'migrado % (%) -> % itens', r.cliente, r.id, v_n;
  END LOOP;
END $$;

-- conferência: não deve sobrar item cru encoded sem produto_header
SELECT count(*) AS itens_crus_restantes FROM gestao.itens
 WHERE categoria LIKE '%||%' AND NOT (meta ? 'produto_header');
-- valores continuam batendo com a sim (fora recortes expandidos)
SELECT count(*) AS projetos_valor_divergente FROM gestao.projetos p
 WHERE p.simulacao_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM gestao.eventos e WHERE e.projeto_id = p.id
                AND e.payload->>'backfill' = 'hierarquico-02-09')
   AND ABS(COALESCE((SELECT SUM(i.valor_total) FROM gestao.itens i
                      WHERE i.projeto_id = p.id
                        AND (i.meta->>'is_recorte')::boolean IS NOT TRUE),0)
         - COALESCE((SELECT SUM(si.valor) FROM public.simulacao_itens si
                      WHERE si.simulacao_id = p.simulacao_id),0)) > 0.01;

COMMIT;
