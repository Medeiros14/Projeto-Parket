"""Tools de integração com o Teca Núcleo (teca.parket.works) — second-brain Parket.

Leitura: busca semântica no grafo mapeado (tabelas+notas+insights+aprendizados),
busca por registros, dossiê de cliente, notas, insights ativos (Pulsar), aprendizados.
Escrita: notas, insights no Pulsar (slug eas:*, protegidos do sweep) e aprendizados.
"""

from __future__ import annotations

import httpx
import structlog
from agno.tools import tool

log = structlog.get_logger()

BASE = "https://teca.parket.works/api"
HEADERS = {"x-user-email": "eas@parket.works"}


def _get(path: str, params: dict | None = None) -> dict | list:
    with httpx.Client(timeout=30, headers=HEADERS) as c:
        r = c.get(f"{BASE}{path}", params={k: v for k, v in (params or {}).items() if v is not None})
        r.raise_for_status()
        return r.json()


def _send(method: str, path: str, body: dict) -> dict:
    with httpx.Client(timeout=30, headers=HEADERS) as c:
        r = c.request(method, f"{BASE}{path}", json=body)
        r.raise_for_status()
        return r.json()


@tool(name="teca_buscar", show_result=True)
def teca_buscar(pergunta: str, k: int = 8) -> dict:
    """Busca semântica no Teca Núcleo (grafo com TODAS as tabelas, notas, insights e aprendizados mapeados da Parket).

    Use PRIMEIRO quando precisar de contexto sobre qualquer área da empresa
    (schemas de dados, processos, histórico). Retorna nodes com id/kind/title/body.

    Args:
        pergunta: o que procurar (ex: 'propostas paradas', 'estrutura kanban comercial').
        k: quantos resultados (default 8).
    """
    try:
        return _get("/search", {"q": pergunta, "k": k})
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@tool(name="teca_buscar_registros", show_result=True)
def teca_buscar_registros(termo: str, k: int = 5) -> dict:
    """Busca REGISTROS reais (linhas de tabelas-entidade: clientes, propostas, cards) no Núcleo.

    Args:
        termo: nome/termo a procurar (ex: nome de cliente).
        k: resultados por tabela.
    """
    try:
        return _get("/search/rows", {"q": termo, "k": k})
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@tool(name="teca_dossier_cliente", show_result=True)
def teca_dossier_cliente(nome: str) -> dict:
    """Dossiê consolidado de um cliente Parket (propostas + cards kanban + mensagens WhatsApp).

    Args:
        nome: nome (ou parte) do cliente.
    """
    try:
        return _get("/client/dossier", {"nome": nome})
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@tool(name="teca_nota_ler", show_result=True)
def teca_nota_ler(slug: str = "") -> dict | list:
    """Lê uma nota do Núcleo pelo slug; sem slug, lista todas as notas (slug/titulo/tags).

    Args:
        slug: slug da nota (vazio = listar).
    """
    try:
        return _get(f"/notas/{slug}" if slug else "/notas")
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@tool(name="teca_nota_salvar", show_result=True)
def teca_nota_salvar(slug: str, titulo: str, conteudo_md: str, tags: list[str] | None = None) -> dict:
    """Cria/atualiza uma nota markdown no Teca Núcleo (entra no grafo 3D e vira contexto RAG).

    Use pra registrar conhecimento durável: mapeamentos, decisões, runbooks, análises.
    Wikilinks [[slug-de-outra-nota]] no conteúdo criam arestas no grafo.

    Args:
        slug: identificador kebab-case (ex: 'eas-otimizacao-teca-v2').
        titulo: título da nota.
        conteudo_md: corpo em markdown.
        tags: lista de tags (ex: ['eas','comercial']).
    """
    try:
        r = _send("PUT", f"/notas/{slug}", {
            "slug": slug, "titulo": titulo, "conteudo_md": conteudo_md, "tags": tags or [],
        })
        log.info("teca nota salva", slug=slug)
        return {"ok": True, "slug": r.get("slug"), "id": str(r.get("id"))}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@tool(name="teca_insights_listar", show_result=True)
def teca_insights_listar(setor: str | None = None, severidade: str | None = None, limit: int = 30) -> dict | list:
    """Lista insights ATIVOS no Pulsar do Teca Núcleo (alertas vivos sobre a operação).

    Args:
        setor: filtro opcional (comercial, orçamento, teca, geral...).
        severidade: info|warn|crit.
        limit: máximo de resultados.
    """
    try:
        return _get("/insights", {"setor": setor, "severidade": severidade, "limit": limit})
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@tool(name="teca_insight_criar", show_result=True)
def teca_insight_criar(
    titulo: str,
    corpo: str,
    severidade: str = "info",
    setor: str = "geral",
    slug: str | None = None,
    node_ids: list[str] | None = None,
) -> dict:
    """Cria (ou atualiza, por slug) um insight ATIVO no Pulsar do Teca Núcleo.

    Use quando detectar algo acionável que o time Parket precisa acompanhar:
    anomalia, gargalo, oportunidade de otimização, risco. Insights eas:* ficam
    ativos até serem dispensados por humano — não crie duplicados, reuse o slug.

    Args:
        titulo: manchete curta do insight.
        corpo: detalhe: evidência + impacto + ação recomendada.
        severidade: info|warn|crit.
        setor: comercial, orçamento, obras, rh, teca, geral...
        slug: identificador estável pra atualizar o mesmo insight depois (ex: 'leads-sem-followup').
        node_ids: nodes do grafo relacionados (ex: ['table:public.kanban_cards']).
    """
    try:
        r = _send("POST", "/insights", {
            "titulo": titulo, "corpo": corpo, "severidade": severidade,
            "setor": setor, "slug": slug, "node_ids": node_ids or [], "payload": {"origem": "eas"},
        })
        log.info("teca insight criado", slug=r.get("slug"))
        return {"ok": True, "id": str(r.get("id")), "slug": r.get("slug")}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@tool(name="teca_aprendizados_listar", show_result=True)
def teca_aprendizados_listar(app: str | None = None, categoria: str | None = None, status: str | None = None, limit: int = 30) -> dict | list:
    """Lista aprendizados registrados no Teca Núcleo (histórico de erros/acertos/melhorias por app).

    Args:
        app: valoria, draw, status, space, proposta, dashboard, homebroker, teca, teca_v2, rh, fiscal.
        categoria: erro|acerto|melhoria|automacao|padrao_repetitivo.
        status: aberto|em_analise|automatizado|implementado|descartado.
        limit: máximo de resultados.
    """
    try:
        return _get("/aprendizados", {"app": app, "categoria": categoria, "status": status, "limit": limit})
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@tool(name="teca_aprendizado_criar", show_result=True)
def teca_aprendizado_criar(
    app: str,
    categoria: str,
    titulo: str,
    descricao: str,
    prioridade: str = "media",
    tags: list[str] | None = None,
) -> dict:
    """Registra um aprendizado no Teca Núcleo pra acompanhamento e otimização futura.

    Use ao concluir trabalho relevante: causa raiz encontrada, padrão que se repete,
    melhoria aplicada, automação possível.

    Args:
        app: valoria, draw, status, space, proposta, dashboard, homebroker, teca, teca_v2, rh, fiscal.
        categoria: erro|acerto|melhoria|automacao|padrao_repetitivo.
        titulo: resumo em 1 linha.
        descricao: contexto + causa + o que fazer com isso.
        prioridade: baixa|media|alta.
        tags: lista opcional.
    """
    try:
        r = _send("POST", "/aprendizados", {
            "app": app, "categoria": categoria, "titulo": titulo, "descricao": descricao,
            "fonte": "eas", "prioridade": prioridade, "tags": tags or [],
        })
        log.info("teca aprendizado criado", titulo=titulo)
        return {"ok": True, "id": str(r.get("id"))}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


ALL_TOOLS = [
    teca_buscar,
    teca_buscar_registros,
    teca_dossier_cliente,
    teca_nota_ler,
    teca_nota_salvar,
    teca_insights_listar,
    teca_insight_criar,
    teca_aprendizados_listar,
    teca_aprendizado_criar,
]
