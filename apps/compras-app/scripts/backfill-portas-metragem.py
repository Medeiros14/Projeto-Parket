"""Recalcula a metragem (e as medidas) das portas das OPs a partir da proposta.

Por que existe: o watcher copiava metragem_informada direto pra OP, mas no modo
UN esse campo guarda a QUANTIDADE de portas, nao m2. Resultado: porta de
1,58 x 2,50 que a proposta vende como 16,00 m2 chegava na fabrica como "2 m2"
(Will 04/09). O fix ja esta no watcher pras OPs novas; este script atualiza as
que ja existem.

Fonte da verdade = ops.simulacao_itens da Valoria, mesma leitura do watcher
(lista_fabricacao), casando item da OP com item da proposta por numero e por
ambiente. OP sem sim viva (fallback gestao.itens) fica intacta e sai listada.

Uso: python3 backfill-portas-metragem.py [--apply]   (sem --apply = dry-run)
"""
import importlib.util, json, sys, urllib.request
from datetime import datetime, timezone

spec = importlib.util.spec_from_file_location("w", "/root/compras-contratos-watcher.py")
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)

APLICAR = "--apply" in sys.argv


def rest_get(table, qs):
    req = urllib.request.Request(
        f"{w.CLOUD_URL}/rest/v1/{table}?{qs}",
        headers={"apikey": w.SERVICE_KEY, "Authorization": f"Bearer {w.SERVICE_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())


ops = rest_get("producao_ordens",
               "select=id,cliente_projeto,valoria_simulacao_id,itens&order=id")

sem_sim, sem_match, patched, total_itens = [], [], [], 0

for o in ops:
    itens = o.get("itens") or []
    portas = [i for i in itens if (i.get("categoria") or "").lower() == "porta"]
    if not portas:
        continue
    vid = o.get("valoria_simulacao_id")
    if not vid:
        sem_sim.append((o["id"], o["cliente_projeto"], len(portas), "sem valoria_simulacao_id"))
        continue
    try:
        sim_itens = w.sql(w.VALORIA, f"""
            SELECT si.categoria, si.subtipo, si.especie_nome, si.dimensao_label, si.cor,
                   si.metragem_informada, si.meta, si.descritivo, si.valor_total,
                   si.insumos_fabricacao, si.insumos_instalacao,
                   si.ambiente_id, a.nome AS ambiente_nome
              FROM ops.simulacao_itens si
              LEFT JOIN ops.ambientes a ON a.id = si.ambiente_id
             WHERE si.simulacao_id = '{vid}'
             ORDER BY COALESCE(a.ordem, 1000000000000), si.ordem NULLS LAST, si.created_at
        """) or []
    except Exception as e:
        sem_sim.append((o["id"], o["cliente_projeto"], len(portas), f"erro sim: {e}"))
        continue
    if not sim_itens:
        sem_sim.append((o["id"], o["cliente_projeto"], len(portas), "sim vazia/deletada"))
        continue

    # Mesmo indice do sync_insumos_valoria: chave ambigua e descartada (None),
    # melhor nao atualizar do que colar a medida no item errado.
    por_amb, por_num = {}, {}
    for novo in w.lista_fabricacao(sim_itens):
        if (novo.get("categoria") or "").lower() != "porta":
            continue
        k_amb, k_num = w._chaves_item_fab(novo)
        for mapa, k in ((por_amb, k_amb), (por_num, k_num)):
            if k:
                mapa[k] = None if k in mapa else novo

    novos, linhas = [], []
    for it in itens:
        if (it.get("categoria") or "").lower() != "porta":
            novos.append(it)
            continue
        k_amb, k_num = w._chaves_item_fab(it)
        alvo = por_amb.get(k_amb) if k_amb else None
        if alvo is None:
            alvo = por_num.get(k_num)
        if alvo is None:
            sem_match.append((o["id"], it.get("numero"), it.get("ambiente")))
            novos.append(it)
            continue
        novo = dict(it)
        novo["metragem"] = alvo.get("metragem")
        # qtd junto: a consolidacao de portas identicas mudou a contagem de algumas
        # linhas, e qtd fora de sincronia com a metragem confunde a fabrica.
        if alvo.get("qtd") is not None:
            novo["qtd"] = alvo["qtd"]
        # Medidas junto: OP antiga podia nem ter L x A, e a fabrica precisa delas.
        p = dict(novo.get("porta") or {})
        pa = alvo.get("porta") or {}
        for campo in ("largura_cm", "altura_cm", "qtd_folhas", "codigo", "tipo"):
            if pa.get(campo) is not None:
                p[campo] = pa[campo]
        novo["porta"] = p
        if novo != it:
            linhas.append("    {} {} L{} A{} qtd={} : {} -> {}".format(
                it.get("numero"), (pa.get("tipo") or ""),
                p.get("largura_cm"), p.get("altura_cm"), alvo.get("qtd"),
                it.get("metragem"), novo["metragem"]))
            total_itens += 1
        novos.append(novo)

    if linhas:
        print(f"{o['id']} {o['cliente_projeto']}")
        print("\n".join(linhas))
        patched.append(o["id"])
        if APLICAR:
            w.rest_patch("producao_ordens", f"id=eq.{o['id']}",
                         {"itens": novos,
                          "updated_at": datetime.now(timezone.utc).isoformat()})

print(f"\n{'APLICADO' if APLICAR else 'DRY-RUN'} | OPs alteradas: {len(patched)} | itens: {total_itens}")
print(f"\nOPs sem sim viva (nao tocadas): {len(sem_sim)}")
for oid, cli, n, motivo in sem_sim:
    print(f"  {oid} {cli} ({n} portas) - {motivo}")
print(f"\nPortas sem match na proposta (nao tocadas): {len(sem_match)}")
for oid, num, amb in sem_match:
    print(f"  {oid} item {num} amb={amb}")
