#!/usr/bin/env python3
"""
Cria gestao.projetos automaticamente pra cards que precisam aparecer no gestão.

Regras (13/08/2026, ampliadas 02/09/2026):
1. Cards em dept operacional/projetos/producao no PG local → sempre viram projeto
2. Cards que têm laudo (fiscal_laudos) OU agenda (fiscal_agenda) apontando pra
   eles no Cloud → também viram projeto, MESMO se dept for comercial/orcamento
   (vistoria pré-venda ainda tem que aparecer na gestão)
3. Cards com contrato DocuSign assinado (contratos_docusign.status='assinado'
   no Cloud) → viram projeto independente do dept
4. Cards do funil comercial na coluna 'ganho' (contrato fechado manualmente,
   sem DocuSign — fluxo real da equipe) com atividade >= GANHO_DESDE → viram
   projeto. Sem o corte de data os 206 ganhos históricos de julho (migração
   em massa) inundariam o gestão; contrato novo move o card pra 'ganho' e
   bumpa updated_at, então entra no sync em até 5min.

Dedup em 2 níveis: por card_id E por cliente (nome). Evita múltiplas linhas
pra o mesmo cliente que tem cards em vários departments.

5. (02/09/2026, Will) Depois de criar, VINCULA: projeto sem simulacao_id
   ganha a sim do Valor por match de card_id/card_comercial_id OU nome
   exato normalizado (unaccent+upper). Entre múltiplas sims vence match
   por card, depois selected_at mais recente, depois created_at.
   Match por prefixo/aproximação fica FORA (falso positivo: sims de teste
   com só o primeiro nome tipo "Lucas", "Ma" — visto no backfill 02/09).
6. (02/09/2026, Will) Projeto com simulacao_id e ZERO itens recebe os itens
   da proposta no PADRÃO HIERÁRQUICO (Will: "insumos e instalação não são
   itens"): gestao.itens_hierarquicos_de_sim (sql/024) agrega
   PRODUTO+INSUMOS+INSTALAÇÃO em 1 item por ambiente, com produto_header,
   metragem em m², recortes expandidos, etapas + valor_total + evento.

Roda a cada 5min via cron. Idempotente.
"""
import requests, subprocess, sys

PAT = "SUPABASE_MGMT_TOKEN_REMOVIDO"
CLOUD = "hbxpilrxmitvzebluoom"
H = {"Authorization": f"Bearer {PAT}", "Content-Type": "application/json"}

DEPTS = "('operacional','projetos','producao')"

# QUE FAZ: corte de data da regra 4. Ganhos com updated_at anterior a isso sao
# a migracao em massa de julho (206 cards) e ficam FORA; ganho novo bumpa
# updated_at ao mover de coluna, entao entra.
GANHO_DESDE = "2026-08-01"


def cloud_sql(q):
    r = requests.post(
        f"https://api.supabase.com/v1/projects/{CLOUD}/database/query",
        headers=H, json={"query": q}, timeout=60,
    )
    if r.status_code not in (200, 201):
        return None
    return r.json()


def main():
    # 1) Pega no Cloud a lista de card_ids que têm laudo, agenda OU contrato
    # DocuSign assinado vinculado (regras 2 e 3 — a regra 3 entra por aqui
    # porque contratos_docusign vive no Cloud, não no PG local)
    rows = cloud_sql("""
        SELECT DISTINCT card_id FROM public.fiscal_laudos WHERE card_id IS NOT NULL
        UNION
        SELECT DISTINCT card_id FROM public.fiscal_agenda WHERE card_id IS NOT NULL
        UNION
        SELECT DISTINCT card_id FROM public.contratos_docusign
         WHERE status = 'assinado' AND card_id IS NOT NULL;
    """) or []
    card_ids_com_fiscal = [str(r["card_id"]) for r in rows if r.get("card_id")]

    # 2) Constrói SQL local: cria projeto pra cards operacional/projetos/producao
    # OU pra cards que estão na lista de card_ids_com_fiscal
    lista_sql = (",".join(f"'{c}'::uuid" for c in card_ids_com_fiscal)
                 if card_ids_com_fiscal else "NULL::uuid")

    local_sql = f"""
    INSERT INTO gestao.projetos (card_id, cliente, endereco, obra_code, cnpj_cpf,
                                 status, column_id, meta)
    -- QUE FAZ: DISTINCT ON por grupo de obra = no maximo 1 projeto por obra
    -- POR RODADA (sem isso os cards irmaos entram juntos no mesmo INSERT).
    -- POR QUE (02/09): a mesma obra tem cards Cloud em varios depts com
    -- titulos que variam (acento, LTDA, sufixo "- PEDRO"); o dedup por nome
    -- exato nao pegava e o sync recriava as cascas que a Thainara apagou.
    SELECT DISTINCT ON (coalesce(t.id, k.id::text))
           k.id,
           coalesce(nullif(trim(k.title),''), '(sem nome)'),
           nullif(trim(k.details->>'endereco'),''),
           nullif(trim(k.details->>'obra_code'),''),
           nullif(trim(coalesce(k.details->>'cnpj_cpf', k.details->>'cnpj', k.details->>'cpf')),''),
           'novo', 'projeto',
           jsonb_build_object('criado_por','auto-sync-cards',
                              'origem', k.dept_id,
                              'card_column', k.column_id)
    FROM public.kanban_cards k
    -- grupo de obra: card do board Projetos que lista k entre os cards Cloud
    -- da mesma obra (space_card_ids_obra); LATERAL+LIMIT 1 garante 1 grupo
    LEFT JOIN LATERAL (
      -- so cards ABERTOS do board: os dups arquivados no merge de 02/09
      -- mantem um grupo proprio incompleto e furavam a guarda
      SELECT t.id, t.space_card_id, t.space_card_ids_obra
        FROM trello_projetos.cards t
       WHERE NOT t.closed
         AND k.id::text IN (SELECT jsonb_array_elements_text(
                              coalesce(t.space_card_ids_obra,'[]'::jsonb)))
       LIMIT 1
    ) t ON true
    LEFT JOIN gestao.projetos p  ON p.card_id = k.id
    LEFT JOIN gestao.projetos pn ON upper(trim(pn.cliente)) = upper(trim(k.title))
    WHERE k.title IS NOT NULL
      AND p.id IS NULL
      AND pn.id IS NULL
      -- tombstone do merge de duplicados 08/09: card cujo projeto foi absorvido
      -- por outro NUNCA renasce como projeto novo (dedup por nome nao pega
      -- porque os fantasmas tinham titulo divergente do sobrevivente).
      -- Barra tambem os IRMAOS: se qualquer card do grupo trello da obra esta
      -- tombstoned, a obra ja e representada pelo sobrevivente (a guarda de
      -- grupo acima falha quando o card do sobrevivente nao esta no grupo)
      AND NOT EXISTS (
        SELECT 1 FROM gestao.projetos_excluidos x
         WHERE x.card_id = k.id
            OR (t.id IS NOT NULL AND x.card_id::text IN (
                  SELECT jsonb_array_elements_text(
                    coalesce(t.space_card_ids_obra,'[]'::jsonb))))
      )
      -- guarda por obra: se QUALQUER card do grupo ja tem projeto na gestao,
      -- nenhum irmao cria outra linha (a obra ja esta representada)
      AND NOT EXISTS (
        SELECT 1 FROM gestao.projetos px
         WHERE px.card_id = t.space_card_id
            OR px.card_id::text IN (SELECT jsonb_array_elements_text(
                                      coalesce(t.space_card_ids_obra,'[]'::jsonb)))
      )
      AND (
        k.dept_id IN {DEPTS}
        OR k.id IN ({lista_sql})
        -- regra 4: contrato fechado manualmente = card comercial na coluna
        -- 'ganho'; corte GANHO_DESDE deixa fora os 206 ganhos da migracao de julho
        OR (k.dept_id = 'comercial' AND k.column_id = 'ganho'
            AND k.updated_at >= '{GANHO_DESDE}'::timestamptz)
      )
    -- dentro do grupo, prefere o card que e o vinculo direto do board
    -- (space_card_id) e depois o mais ativo
    ORDER BY coalesce(t.id, k.id::text),
             (k.id = t.space_card_id) DESC NULLS LAST,
             k.updated_at DESC
    RETURNING id, cliente, card_id;
    """

    cid = subprocess.run(
        "docker ps -q -f name=parket-pg-local_postgres",
        shell=True, capture_output=True, text=True,
    ).stdout.strip().split("\n")[0]
    if not cid:
        print("ERRO: container parket-pg-local não encontrado", file=sys.stderr)
        sys.exit(1)

    r = subprocess.run(
        ["docker", "exec", cid, "psql", "-U", "postgres", "-d", "postgres", "-tAc", local_sql],
        capture_output=True, text=True, timeout=120,
    )
    if r.returncode != 0:
        print(f"ERRO psql: {r.stderr[:500]}", file=sys.stderr)
        sys.exit(1)
    # QUE FAZ: conta so as linhas do RETURNING (formato -tA = campos com "|").
    # O psql imprime a command tag "INSERT 0 0" no stdout mesmo com zero rows;
    # sem este filtro o log dizia "criou 1 projeto(s)" toda rodada (bug 26/08).
    out = [l for l in r.stdout.strip().split("\n") if l and "|" in l]
    if out:
        print(f"[sync-gestao-projetos] criou {len(out)} projeto(s) "
              f"({len(card_ids_com_fiscal)} cards com fiscal_* no Cloud)")

    # 3) Regra 5: vincula simulacao_id nos projetos órfãos (match conservador)
    vincular_sql = r"""
    WITH alvo AS (
      SELECT p.id, p.card_id,
             upper(unaccent(regexp_replace(trim(p.cliente),'\s+',' ','g'))) AS norm
        FROM gestao.projetos p
       WHERE p.simulacao_id IS NULL
    ),
    cand AS (
      -- QUE FAZ: sims ja vinculadas ficam fora (simulacao_id e UNIQUE em
      -- gestao.projetos - 1 projeto por sim; sem o filtro o UPDATE estoura
      -- a constraint quando 2 projetos do mesmo cliente casam a mesma sim)
      SELECT a.id AS projeto_id, s.id AS sim_id, s.numero,
             (s.card_id = a.card_id OR s.card_comercial_id = a.card_id) AS por_card,
             row_number() OVER (PARTITION BY a.id ORDER BY
               (s.card_id = a.card_id OR s.card_comercial_id = a.card_id) DESC,
               s.selected_at DESC NULLS LAST, s.created_at DESC) AS rk
        FROM alvo a
        JOIN public.kanban_cards k ON k.id = a.card_id
        JOIN public.simulacao_projetos s
          ON (s.card_id = a.card_id OR s.card_comercial_id = a.card_id
          OR upper(unaccent(regexp_replace(trim(s.cliente),'\s+',' ','g'))) = a.norm
          OR upper(trim(s.cliente)) = upper(trim(k.title)))
       WHERE NOT EXISTS (SELECT 1 FROM gestao.projetos px WHERE px.simulacao_id = s.id)
         -- QUE FAZ: sims FATIA do split Revestimento x Marcenaria (#2001,
         -- meta.proposta_grupo) ficam fora - sao recortes da proposta
         -- completa, sem card proprio; vinculadas aqui projetavam itens
         -- parciais na gestao (NOVITA 02/09: fatia de R$775k virou projeto)
         AND s.meta->>'proposta_grupo' IS NULL
    ),
    escolha AS (
      -- dedup no lote: se 2 projetos escolheram a mesma sim, so o primeiro leva
      SELECT *, row_number() OVER (PARTITION BY sim_id ORDER BY projeto_id) AS rk_sim
        FROM cand WHERE rk = 1
    )
    UPDATE gestao.projetos p
       SET simulacao_id = c.sim_id,
           numero_proposta = coalesce(p.numero_proposta, c.numero::text),
           meta = coalesce(p.meta,'{}'::jsonb) || jsonb_build_object(
             'sim_link','auto-sync',
             'sim_match', CASE WHEN c.por_card THEN 'card' ELSE 'nome' END)
      FROM escolha c
     WHERE c.projeto_id = p.id AND c.rk_sim = 1
    RETURNING p.cliente;
    """
    r2 = subprocess.run(
        ["docker", "exec", cid, "psql", "-U", "postgres", "-d", "postgres", "-tAc", vincular_sql],
        capture_output=True, text=True, timeout=120,
    )
    vinc = [l for l in r2.stdout.strip().split("\n") if l.strip() and "UPDATE" not in l]
    if r2.returncode != 0:
        print(f"ERRO vincular sim: {r2.stderr[:300]}", file=sys.stderr)
    elif vinc:
        print(f"[sync-gestao-projetos] vinculou sim em {len(vinc)} projeto(s): "
              + ", ".join(vinc[:5]))

    # 4) Regra 6: projeta itens da proposta pra projeto vinculado com zero itens
    # no PADRAO HIERARQUICO (Will 02/09: insumos/instalacao NAO sao itens).
    # gestao.itens_hierarquicos_de_sim (sql/024) agrega por ambiente, poe
    # produto_header + categoria_raiz + subtipo FORRO e cria item_etapa_status.
    itens_sql = r"""
    WITH vazio AS (
      SELECT p.id AS projeto_id, p.simulacao_id AS sim_id
        FROM gestao.projetos p
       WHERE p.simulacao_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM gestao.itens gi WHERE gi.projeto_id = p.id)
    ),
    ins AS (
      SELECT projeto_id, sim_id,
             gestao.itens_hierarquicos_de_sim(projeto_id, sim_id, false) AS n
        FROM vazio
    ),
    etapas_proj AS (
      INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
      SELECT i.projeto_id, ec.numero, 'pendente'
        FROM ins i CROSS JOIN gestao.etapas_catalogo ec
       WHERE i.n > 0
      ON CONFLICT DO NOTHING
      RETURNING projeto_id
    ),
    upd AS (
      UPDATE gestao.projetos p
         SET valor_total = (SELECT COALESCE(SUM(si.valor),0) FROM public.simulacao_itens si
                             WHERE si.simulacao_id = p.simulacao_id)
       WHERE p.id IN (SELECT projeto_id FROM ins WHERE n > 0)
      RETURNING p.id
    ),
    ev AS (
      INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
      SELECT projeto_id, 'criado', 'Itens copiados da proposta (auto-sync hierarquico)',
             format('%s itens (1 por ambiente, produto+insumos+instalacao agregados)', n),
             'will.tape@gmail.com',
             jsonb_build_object('simulacao_id', sim_id, 'origem', 'auto-sync')
        FROM ins WHERE n > 0
      RETURNING projeto_id
    )
    SELECT COALESCE(SUM(n),0), count(*) FILTER (WHERE n > 0) FROM ins;
    """
    r3 = subprocess.run(
        ["docker", "exec", cid, "psql", "-U", "postgres", "-d", "postgres", "-tAc", itens_sql],
        capture_output=True, text=True, timeout=180,
    )
    if r3.returncode != 0:
        print(f"ERRO copiar itens: {r3.stderr[:300]}", file=sys.stderr)
    else:
        # QUE FAZ: primeira linha com "|" = "itens|projetos" do SELECT final
        # (mesmo cuidado do bug 26/08: ignora command tags do psql)
        nums = [l for l in r3.stdout.strip().split("\n") if "|" in l]
        if nums and nums[0].split("|")[0].strip() not in ("", "0"):
            it, pj = nums[0].split("|")[:2]
            print(f"[sync-gestao-projetos] copiou {it.strip()} item(ns) pra {pj.strip()} projeto(s)")

    # 5) Regra 7 (08/09, Will): card com projeto no gestao FECHA no proprio
    # funil em vez de ficar pra tras: Pipeline comercial vai pra 'ganho',
    # board de orcamentos (Valoria) vai pra 'proposta-aceita'. O card NAO some
    # do kanban dele (Will: "nao podem sumir de la"). POR QUE: dos 107 projetos
    # em execucao, so 30 tinham card em acompanhamento; 22 seguiam parados em
    # comercial/orcamento (caso Bernardo Amaral, que nem aparecia pro fiscal).
    # comercial-entrada fica FORA: aquele board nao tem coluna 'ganho'.
    # Atualiza so o PG LOCAL (fonte); o sync-kanban-cards leva pro Cloud em 1min.
    fechar_sql = """
    UPDATE public.kanban_cards kc
       SET column_id = CASE kc.dept_id WHEN 'comercial' THEN 'ganho'
                                       ELSE 'proposta-aceita' END,
           updated_at = now()
     WHERE kc.dept_id IN ('comercial', 'orcamento')
       AND kc.column_id IS DISTINCT FROM
           CASE kc.dept_id WHEN 'comercial' THEN 'ganho'
                           ELSE 'proposta-aceita' END
       AND EXISTS (SELECT 1 FROM gestao.projetos gp WHERE gp.card_id = kc.id)
    RETURNING kc.dept_id, kc.title;
    """
    r4 = subprocess.run(
        ["docker", "exec", cid, "psql", "-U", "postgres", "-d", "postgres", "-tAc", fechar_sql],
        capture_output=True, text=True, timeout=120,
    )
    if r4.returncode != 0:
        print(f"ERRO fechar funil: {r4.stderr[:300]}", file=sys.stderr)
    else:
        # mesmo cuidado do bug 26/08: conta so linhas do RETURNING, nao a command tag
        fech = [l for l in r4.stdout.strip().split("\n") if l and "|" in l]
        if fech:
            print(f"[sync-gestao-projetos] fechou funil de {len(fech)} card(s): "
                  + ", ".join(l.split("|")[1] for l in fech[:5]))


if __name__ == "__main__":
    main()
