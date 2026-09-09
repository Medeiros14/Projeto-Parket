CONTEXTO GERAL:
Você é um designer de sistemas operacionais empresariais. Estou construindo o "Sistema Nervoso Central" da Parket — uma empresa premium de pisos de madeira, marcenaria, obras complexas e revestimentos. A empresa tem ~149 colaboradores, modelo Co-CEO, e opera em múltiplas praças (SP, RJ, MG, Brasília, Goiânia, SC).
O sistema tem ARQUITETURA EM 3 CAMADAS:

Camada 1 — Workspace Central: Pasta centralizada por obra/cliente no Google Workspace (estrutura: /Obra_NomeCliente → /01_Comercial, /02_Projetos, /03_Compras, /04_Producao, /05_Obra, /06_Entrega, /07_Pos_Obra)
Camada 2 — Painel do Cliente: Dashboard visual por obra com linha do tempo, status (verde/amarelo/vermelho), Gates 0-4, alertas, risco, última decisão e próxima ação
Camada 3 — Kanban por Departamento: Board próprio por área com colunas padronizadas e cards com campos obrigatórios
COLUNAS PADRÃO DO KANBAN (todas as áreas): Backlog → Planejado → Em Execução → Em Aprovação → Bloqueado → Aguardando → Concluído
CAMPOS OBRIGATÓRIOS DE CADA CARD: Obra/Cliente (vínculo ao workspace), Responsável (pessoa, não equipe), SLA (prazo máximo), Checklist (itens para conclusão), Evidência (foto/documento), Status (automático pela coluna), Handoff (para quem e qual área)
SISTEMA DE GATES (marcos obrigatórios por obra):
Gate 0: Qualificação (lead validado, briefing completo, budget confirmado)
Gate 1: Escopo Aprovado (projeto aprovado, contrato assinado)
Gate 2: Produção Liberada (compras fechadas, materiais confirmados, cronograma validado)
Gate 3: Obra Liberada (vistoria, pré-obra OK, equipe alocada, canteiro pronto)
Gate 4: Entrega Formal (vistoria final, termo de aceite, pesquisa satisfação)
IA COMO COORDENADOR (não executor): Monitora todos os Kanbans simultaneamente, detecta gargalos, alerta SLAs, identifica cards parados, valida handoffs (checklist + evidência + aceite), gera resumos automáticos por obra e consolidado semanal, calcula score de risco (0-100 por obra)
ALERTAS AUTOMÁTICOS: SLA Vencendo, SLA Vencido, Card Parado, Handoff Pendente, Evidência Faltando, Risco Alto
10 MÉTRICAS SEMANAIS DO DASHBOARD: Obras Ativas, Cards Vencidos (meta: zero), Handoffs/semana, Tempo Médio de Aceite (<2h), NCs Abertas, NPS Médio (>9), Margem Real vs Orçada, Produtividade por Área, Score de Risco Geral, Taxa de Retrabalho
INTEGRAÇÃO: O sistema se conecta com Google Workspace (pastas dos clientes), WhatsApp (agente IA nos grupos por obra/departamento), e futuramente todos integrados no mesmo sistema central.


Agora, GERE SEPARADAMENTE cada tela abaixo como se fosse uma aplicação web real (dark theme, moderno, estilo SaaS enterprise). Cada tela deve ter:

Header com logo Parket, nome do usuário logado, foto/avatar, notificações (sino com badge), e breadcrumb
Sidebar com menu de navegação (Home, Meu Kanban, Dashboard, Workspace, Handoffs, Alertas, Configurações)
Visual limpo, responsivo, com dados fictícios realistas da Parket


TELA 1 — LOGIN E SELEÇÃO DE PERFIL
Tela de login com email/senha e logo Parket. Após login, tela de seleção de perfil mostrando o departamento do usuário. Perfis: Comercial, Projetos, Compras, Produção, Logística, Obras, Financeiro, Atendimento/Relacionamento, Pós-Obra, Marketing, RH, Produtividade/PMO, Diretoria (CEO/Fundador). Cada perfil tem ícone e cor própria.
TELA 2 — HOME / VISÃO GERAL DO COLABORADOR
Após login como [DEPARTAMENTO], mostrar: resumo do dia (cards atribuídos, SLAs próximos), alertas pendentes, últimos handoffs recebidos, obras ativas vinculadas, e atalhos rápidos para Kanban e Dashboard.
TELA 3 — KANBAN: COMERCIAL (Login: Talita/Tainara)
Board com colunas: Prospecção → Qualificação → Proposta → Negociação → Fechamento → Handoff para Projetos.
Cards com: nome do lead/cliente, tipo de obra (piso/marcenaria/fachada), orçamento estimado, prazo desejado, origem (indicação/tráfego/showroom), SLA, status Gate 0.
Dashboard lateral: funil de conversão, leads por canal, taxa de fechamento, SLA médio por etapa, receita no pipe.
Integração visual: botão "Criar Pasta no Workspace" e "Enviar Briefing para Projetos".
TELA 4 — KANBAN: PROJETOS/ENGENHARIA (Login: Carla/Tainara)
Board com colunas: Briefing Recebido → Em Desenvolvimento → Revisão Cliente → Aprovado → BOM Gerado → Handoff para Compras.
Cards com: nome da obra, versão do projeto (v1, v2...), responsável, prazo, status de aprovação do cliente, observações técnicas.
Dashboard lateral: projetos em andamento, tempo médio de aprovação, revisões por projeto, BOM pendentes.
Vínculo visual com Workspace /02_Projetos.
TELA 5 — KANBAN: COMPRAS/SUPPLY CHAIN (Login: Dani/Ronaldo)
Board: Requisição Recebida → Cotação → PO Emitida → Aguardando Entrega → Material Recebido → Handoff para Produção.
Cards: lista de materiais (BOM), fornecedor, valor, prazo de entrega, nota fiscal, status do pedido.
Dashboard: custo total por obra, lead time médio, fornecedores ativos, itens em atraso, saving vs orçado.
Vínculo com Workspace /03_Compras.
TELA 6 — KANBAN: PRODUÇÃO INDUSTRIAL/MARCENARIA (Login: Germano)
Board: Ordem Recebida → Em Preparação → Em Produção → Acabamento → QC/Inspeção → Liberado → Handoff para Logística.
Cards: obra vinculada, tipo de peça, horas apontadas, NCs registradas, fotos de etapas, checklist de qualidade.
Dashboard: produtividade (horas/peça), NCs abertas, taxa de retrabalho, capacidade utilizada, ranking de equipes.
Vínculo com /04_Producao.
TELA 7 — KANBAN: LOGÍSTICA/EXPEDIÇÃO (Login: Ailton)
Board: Material Pronto → Separação → Carregamento → Em Trânsito → Entregue no Canteiro → Handoff para Obras.
Cards: obra, lista de materiais, volume, peso, veículo, motorista, data prevista, conferência.
Dashboard: entregas do dia, atrasos, custo de frete por obra, ocupação de frota.
TELA 8 — KANBAN: OBRAS/INSTALAÇÃO (Login: Ailton/Dany)
Board: Mobilização → Em Execução → Vistoria Parcial → Vistoria Final → Entrega Formal → Handoff para Pós-Obra.
Cards: obra, equipe alocada, diário de obra (check-in/out com foto), atividades do dia, NCs, aditivos, % conclusão.
Dashboard: obras em andamento, mapa de localização, cronograma vs real, NCs por obra, checklist de entrega.
Vínculo com /05_Obra. Botão "Registrar Diário de Obra" com upload de foto.
TELA 9 — KANBAN: FINANCEIRO (Login: Felipe/Ranieri)
Board: Contrato Assinado → Medição Pendente → Medição Aprovada → Faturamento → Cobrança → Recebido.
Cards: obra, valor do contrato, medições (% e valor), retenção 25%, notas fiscais, boletos, status pagamento.
Dashboard: fluxo de caixa, margem real vs orçada por obra, inadimplência, DRE simplificado, projeção 90 dias.
Vinculado a Gates do sistema.
TELA 10 — KANBAN: ATENDIMENTO/RELACIONAMENTO (Login: Talita)
Board: Lead Recebido → Primeiro Contato → Em Acompanhamento → Visita Agendada → Proposta Enviada → Follow-up → Ganho/Perdido.
Cards: cliente, canal de origem, histórico de interações, resumo automático da IA, próximo passo, NPS.
Dashboard: satisfação geral, tempo de resposta, clientes por fase, conversão por canal, mapa de calor de interações.
Integração: botão "Ver Resumo IA do Cliente" e "Consultar Timeline Completa".
TELA 11 — KANBAN: PÓS-OBRA (Login: Talita/Tainara)
Board: Entrega Confirmada → Chamado Aberto → Em Análise → Em Execução → Resolvido → Pesquisa NPS.
Cards: obra, tipo de chamado (garantia/manutenção/ajuste), foto do problema, diagnóstico, solução, SLA.
Dashboard: chamados por período, tempo médio resolução, NPS 30/60/90 dias, problemas recorrentes, base de conhecimento.
TELA 12 — KANBAN: MARKETING (Login: equipe MKT)
Board: Briefing → Em Criação → Revisão → Aprovação → Publicação → Análise de Resultado.
Cards: tipo de conteúdo (post/reel/anúncio/case), obra vinculada, prazo, canal, status aprovação.
Dashboard: leads por campanha, CAC, ROI por canal, calendário editorial, cases documentados, conversão do funil.
Integração: puxa fotos de obras do Workspace para criação de cases.
TELA 13 — KANBAN: RH (Login: Talícia)
Board: Vaga Aberta → Triagem → Entrevista → Aprovação → Contratação → Onboarding → Acompanhamento.
Cards: cargo, departamento, candidato, etapa, avaliação, prazo.
Dashboard: headcount por departamento, turnover, treinamentos pendentes, avaliações de desempenho.
TELA 14 — DASHBOARD EXECUTIVO / COMMAND CENTER (Login: Douglas — CEO/Fundador)
Visão de todas as obras em 1 tela. Contém:

Mapa de obras ativas com status por cor
Top 5 obras por risco (score 0-100)
Gargalos atuais por departamento
Funil comercial resumido
Margem real consolidada
Cards vencidos e handoffs pendentes
Score por departamento (A-D)
Alertas críticos
Decisões pendentes do fundador
Botão "War Room" (visão de crise)
Timeline consolidada de toda a empresa
Indicadores: obras ativas, faturamento, margem, NPS, inadimplência, produtividade

TELA 15 — PAINEL DO CLIENTE / OBRA (visão 360º de uma obra específica)
Ao clicar em uma obra de qualquer Kanban, abrir painel 360° com:

Linha do tempo visual completa (lead → entrega → pós-obra)
Status de cada Gate (0-4) com verde/amarelo/vermelho
Todos os responsáveis por etapa
Últimos handoffs realizados
Documentos do Workspace (pastas /01 a /07)
Alertas e riscos
Resumo gerado pela IA
Histórico de decisões
Próximos passos sugeridos pela IA
Chat do WhatsApp vinculado à obra (preview)
NPS e satisfação do cliente

TELA 16 — CENTRO DE HANDOFFS
Tela dedicada mostrando todos os handoffs ativos da empresa:

Handoffs pendentes de aceite
Handoffs concluídos hoje
Tempo médio de aceite
Handoffs bloqueados (faltando evidência/checklist)
Fluxo visual: quem passou → para quem → status
Filtros por departamento, obra, responsável


ESTILO VISUAL: Dark theme premium (#0a0a0a fundo, cards #1a1a1a, accent #d4a853 dourado Parket ou #10b981 verde sucesso). Tipografia clean, espaçamento generoso. Ícones Lucide/Heroicons. Gráficos com Recharts (barras, linhas, donuts). Sidebar colapsável. Responsivo. Notificações real-time badge. Avatar com iniciais quando sem foto.
INSTRUÇÃO FINAL: Gere cada tela INDIVIDUALMENTE e COMPLETA, como se fosse um sistema real em produção. Cada tela deve ter dados fictícios realistas (nomes de obras como "Res. Vila Nova - Piso Carvalho", "Corp. Faria Lima - Marcenaria Nogueira", etc). Use os nomes reais dos líderes: Talita, Tainara, Carla, Germano, Dani, Ailton, Felipe, Ranieri, Natalia, Talícia, Douglas, Pamella. Cada login mostra apenas o que é relevante para aquele perfil, mas com menu lateral para navegar entre áreas autorizadas.