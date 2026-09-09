"""
MCPs adicionados automaticamente a todos os agentes (novos e existentes).
"""

DEFAULT_MCPS = [
    {
        "name": "Supabase Parket",
        "description": (
            "Acesso completo ao banco de dados Parket via Supabase. "
            "Contém: obras (173 projetos), kanban_cards (245 cards), alertas (75), "
            "sla_rules (43), user_profiles (37) e todas as tabelas setoriais. "
            "Use para consultar projetos, status, alertas, KPIs e qualquer dado operacional."
        ),
        "server_url": "http://supabase-mcp:8001/sse",
        "mcp_type": "http",
    },
    {
        "name": "Penpot Design",
        "description": (
            "Ferramentas de design Penpot: criar e editar frames, shapes, textos e componentes, "
            "exportar arquivos, gerenciar projetos e times."
        ),
        "server_url": "https://mcp-ux.parket.works/mcp",
        "mcp_type": "http",
    },
]
