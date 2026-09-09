🚀 PROMPT PARA DESENVOLVIMENTO — MÓDULO CAMPO & PRODUÇÃO (PARKET)
Copie e use este prompt:

Crie o módulo "Campo & Produção" para o sistema Parket, um ERP empresarial que já possui dashboards administrativos funcionando. Este módulo controla funcionários de campo e equipes de produção em empresas de obra e serviços. O design deve ser profissional, minimalista e sóbrio, otimizado para uso rápido em campo (menos de 2 minutos por dia no celular). Use a identidade visual do Parket com cores neutras e tom de destaque verde menta #A0D4C4, fundo claro, botões grandes e layout limpo para funcionar bem sob luz solar.

PERFIS DE USUÁRIO E TELAS

1 . FUNCIONÁRIO DE CAMPO (Mobile-first — 9 telas)

Dashboard do Funcionário: Saudação com nome e foto, status do check-in do dia (ativo/inativo), card de pontuação do dia, resumo de tarefas pendentes, atalhos rápidos para Check-in e Feed.
Check-in / Check-out: Botão grande central com geolocalização automática (mostrar mapa com pin), captura de horário, campo opcional de observação, confirmação visual com animação sutil. Validação: impedir check-in fora do raio configurado da obra.
Feed de Postagens: Timeline estilo rede social onde o funcionário posta fotos do serviço realizado com legenda, tags de obra/etapa, e botão de câmera. Mostrar posts anteriores com data, foto e status de validação (pendente/aprovado/rejeitado pelo fiscal).
Nova Postagem: Upload de foto (câmera ou galeria), seleção de obra (dropdown), seleção de etapa/serviço, campo de descrição, botão enviar. Preview da foto antes de enviar.
Min has Tarefas: Lista de tarefas atribuídas com status (pendente, em andamento, concluída), filtro por obra, possibilidade de marcar como concluída com foto de evidência.
Ranking / Pontuação: Ranking dos funcionários da semana/mês com pontuação gamificada (pontos por check-in no horário, postagens, tarefas concluídas). Posição do usuário destacada. Badges/conquistas.
Histó rico: Calendário mensal com dias trabalhados marcados, total de horas, histórico de check-ins/outs, filtro por período.
Perf il: Foto, nome, cargo, matrícula, obra atual, contato. Edição de foto e dados básicos.
Not ificações: Lista de notificações (tarefa atribuída, post validado/rejeitado, lembrete de check-in, avisos do gestor).
2. FISCAL DE CAMPO (Mobile-first — 4 telas)

Dashboard do Fiscal: Resumo das obras sob supervisão, quantidade de check-ins do dia, postagens pendentes de validação, alertas (funcionários sem check-in).
** Validação de Postagens:** Feed com todas as postagens dos funcionários das suas obras, com botões de Aprovar/Rejeitar e campo de comentário. Filtro por obra e por funcionário.
M apa de Equipe: Mapa com localização dos funcionários que fizeram check-in, agrupados por obra. Status em tempo real.
Relatório Diário Rápido: Formulário rápido de relatório do dia (condições do tempo, ocorrências, % de avanço estimado, fotos gerais da obra).
3. GESTOR / ENCARREGADO (Mobile-first — 4 telas)

Dashboard do Gestor: Visão geral de todas as obras ativas, total de funcionários em campo hoje, taxa de check-in, postagens do dia, score médio da equipe. Cards clicáveis por obra.
Gest ão de Equipes: Lista de funcionários por obra, possibilidade de realocar entre obras, ver score individual, histórico resumido.
At ribuição de Tarefas: Criar e atribuir tarefas para funcionários, definir prazo, prioridade, obra e etapa. Lista de tarefas criadas com status.
Relató rios Consolidados: Relatórios por obra com gráficos (LineChart, BarChart) de presença, produtividade, tarefas concluídas. Filtro por período. Exportação simulada (botão de PDF/Excel).
4 . ADMIN — INTEGRAÇÃO COM DASHBOARDS EXISTENTES (Desktop/Web — 3 telas novas)

** Painel Campo & Produção:** Dashboard desktop com KPIs (funcionários ativos, taxa de presença, posts do dia, obras ativas), gráficos de tendência, tabela de últimos check-ins, mapa geral com todas as obras.
** Gestão de Obras:** CRUD de obras (nome, endereço, coordenadas GPS para raio de check-in, status, equipe atribuída, fiscal responsável, datas). Tabela com busca e filtros.
Configur ações do Módulo: Raio de geolocalização para check-in, horários permitidos, sistema de pontuação (configurar pontos por ação), notificações automáticas, permissões por perfil.
REGRAS TÉCNICAS

Navegação: Use React Router (Data mode com createBrowserRouter). As telas mobile devem ter BottomNav fixo no rodapé e Header no topo. As telas desktop/admin devem integrar com sidebar existente.

Compon entes compartilhados: Crie e reutilize Header, BottomNav, StatusBadge, ScoreCard, TaskCard, PostCard, MapPlaceholder, RankingList, KPICard.
Dados mock: Use dados realistas de construção civil (nomes brasileiros, obras como "Residencial Vila Nova", "Edifício Corporate Tower", etapas como "Fundação", "Alvenaria", "Acabamento").
Fotos: Use Unsplash para fotos de construção civil, canteiro de obras, trabalhadores com EPI, equipamentos. Todas as fotos devem ser únicas.
Ge olocalização: Simule com componente de mapa placeholder mostrando coordenadas e pin. Não precisa de API real de mapas.
Respons ividade: Telas de funcionário/fiscal/gestor devem ser mobile-first (max-width ~430px centrado com fundo cinza atrás). Telas admin devem ser desktop responsivo.
Gam ificação: Sistema de pontos visível (check-in no horário = 10pts, postagem aprovada = 15pts, tarefa concluída = 20pts). Ranking semanal e mensal.
** Transições:** Navegação fluida entre telas do mesmo perfil. Simular troca de perfil via menu ou rota.
Estado : Use React state/context para simular autenticação e perfil ativo. Dados mock centralizados em arquivo separado (/data/mockData.ts).
Como usar este prompt:
Cole diretamente em uma nova conversa do Figma Make
Se o Parket já tem código aqui, adicione no início: "O sistema Parket já está implementado com [descreva o que já existe]. Adicione o seguinte módulo mantendo a estrutura existente:"
Pode ir por partes — peça primeiro as telas do Funcionário, depois Fiscal, depois Gestor, depois Admin
Para integração com backend, peça conexão com Supabase depois (tabelas de check-ins, postagens, tarefas, obras, pontuação)
Sugestões de próximos passos:
Fase 1: Comece pelas 9 telas do Funcionário (é o core do módulo)
Fase 2: Adicione Fiscal + Gestor (validação e supervisão)
Fase 3: Integre o Painel Admin com os dashboards existentes do Parket
Fase 4: Conecte Supabase para persistência real (check-ins, posts, tarefas)
Quer que eu comece a implementar esse módulo aqui agora, ou prefere usar o prompt em outro projeto? 🚀

prefiro usar o prompt em outro projeto ... o meu objetivo principal alem de controle do que cada equipe esta fazendo em cada obra , e controle financeiro do meu time de campo, e pode gerar relatorios de produtividade e acompanhar em tempo real o que esta aconte3cendo de fato em cada obra, quem faltou, como esta o acabamento, como esta a producao tanto in loco quanto na marcenaria ou fabrica ... me passe um prompt poderoso para eu colar em outro projeto
Aqui está o prompt completo, pronto para colar:

PROMPT — MÓDULO CAMPO, PRODUÇÃO & CONTROLE FINANCEIRO (PARKET)
Crie um módulo completo chamado "Campo & Produção" para o sistema Parket. Este módulo é o centro de controle operacional e financeiro de equipes de campo (obras) e produção (marcenaria/fábrica). O objetivo é saber em tempo real: onde cada funcionário está, o que está fazendo, quanto está custando, qual a qualidade do trabalho, quem faltou, e qual o status real de cada obra e de cada peça em produção. Design profissional, minimalista e sóbrio. Cor de destaque verde menta #A0D4C4, fundo claro #F8FAFB, textos escuros #1A1A2E, cards brancos com sombra sutil. Botões grandes para uso em campo com sol. Mobile-first para funcionários/fiscais/gestores, desktop para admin.

ARQUITETURA DE DADOS (arquivo /data/mockData.ts)

Criar dados mock realistas e centralizados com:

** Obras:** id, nome (ex: "Residencial Vila Nova", "Edifício Corporate Tower", "Casa Alto Padrão Jardins"), endereço, coordenadas GPS, status (ativa/pausada/concluída), % progresso, orçamento total, gasto atual, fiscal responsável, equipes alocadas, data início/previsão término.
Funcionários: id, nome brasileiro, foto (Unsplash), cargo (pedreiro, eletricista, marceneiro, pintor, encanador, ajudante, mestre de obras), matrícula, salário/dia, obra atual, setor (campo/fábrica), status (ativo/afastado/férias), pontuação acumulada.
Check -ins: id, funcionárioId, obraId, horário entrada/saída, coordenadas GPS, dentro do raio (boolean), observação, foto.
Postagens: id, funcionárioId, obraId, etapa (Fundação/Estrutura/Alvenaria/Elétrica/Hidráulica/Acabamento/Pintura/Limpeza), fotos[], descrição, data, status validação (pendente/aprovado/rejeitado), nota qualidade (1-5), comentário fiscal.
Taref as: id, título, descrição, obraId, funcionárioId, prioridade (alta/média/baixa), status (pendente/andamento/concluída/atrasada), prazo, etapa, foto evidência.
Or dens de Produção (Fábrica/Marcenaria): id, código (OP-001), obraDestino, item (ex: "Porta Pivotante Carvalho", "Painel MDF Sala", "Bancada Cozinha Granito"), material, dimensões, status (fila/cortando/montando/acabamento/pronto/entregue), responsável, prazo, % conclusão, fotos progresso[].
Contr ole Financeiro por Obra: obraId, orçamento, gastos (mão de obra, material, transporte, equipamento, alimentação), receita contratada, medições aprovadas, saldo.
Registro de Ocorrências: id, obraId, tipo (acidente/atraso/material faltando/retrabalho/clima), descrição, gravidade, foto, data, resolução.
Pon tuação: funcionárioId, pontos (check-in horário=10, postagem aprovada=15, tarefa concluída no prazo=20, qualidade 5 estrelas=25, zero faltas na semana=50).
PERFIL 1 — FUNCIONÁRIO DE CAMPO (Mobile-first, 10 telas)

** Rota base:** /campo/funcionario

Dashboard (/campo/funcionario): Saudação "Bom dia, [Nome]" com foto. Card de status check-in (ativo com timer ou botão para fazer). Card de pontuação do dia/semana. Tarefas pendentes (contador). Última postagem com status. Atalhos rápidos: Check-in, Nova Postagem, Minhas Tarefas.
Check -in/Check-out (/campo/funcionario/checkin): Botão circular grande (verde para check-in, vermelho para check-out). Mapa placeholder mostrando localização atual com pin e raio da obra. Horário atual grande. Campo de observação opcional. Histórico dos últimos 3 check-ins embaixo. Validação visual: dentro/fora do raio.
Feed de Postagens (/campo/funcionario/feed): Timeline vertical com PostCards mostrando: foto do serviço, nome do funcionário, obra, etapa, descrição, data/hora, badge de status (pendente amarelo, aprovado verde, rejeitado vermelho), nota de qualidade se aprovado. Botão flutuante "+" para nova postagem. Filtro por obra.

** Nova Postagem** (/campo/funcionario/feed/nova): Upload de foto com preview (simular com placeholder clicável). Dropdown de obra (pré-selecionada se só tem uma). Dropdown de etapa. Campo de descrição. Botão grande "Enviar Registro". Feedback visual de sucesso.

** Minhas Tarefas** (/campo/funcionario/tarefas): Lista de TaskCards com: título, obra, prazo (com cor se atrasado), prioridade (badge), status. Filtro por status. Ao clicar: detalhe com descrição completa, botão "Marcar como Concluída" que pede foto de evidência.

** Ranking** (/campo/funcionario/ranking): Pódio top 3 com foto e pontuação. Lista completa abaixo com posição, foto, nome, pontos. Destaque na posição do usuário logado. Toggle semana/mês. Badges de conquistas (ex: "Pontual", "Produtivo", "Qualidade").

7 . Histórico (/campo/funcionario/historico): Calendário mensal com dias marcados (verde=presente, vermelho=falta, cinza=folga). Resumo: dias trabalhados, horas totais, média de pontuação, faltas. Lista de check-ins do mês com horários. Filtro por mês.

** Perfil** (/campo/funcionario/perfil): Foto grande, nome, cargo, matrícula, obra atual, setor, telefone, e-mail. Score total e badges. Botão editar (simular).

** Notificações** (/campo/funcionario/notificacoes): Lista com ícones: tarefa atribuída (azul), postagem aprovada (verde), postagem rejeitada (vermelho), lembrete check-in (amarelo), aviso geral (cinza). Data/hora. Badge de não lidas no BottomNav.

** Minhas Ordens de Produção** (/campo/funcionario/ordens): Para funcionários do setor fábrica. Lista de OPs atribuídas com status visual (barra de progresso), item, prazo. Botão para atualizar % e adicionar foto de progresso.

** BottomNav do Funcionário:** Home | Check-in | Feed | Tarefas | Perfil

PERFIL
2 — FISCAL DE CAMPO (Mobile-first, 5 telas)

Rota base: /campo/fiscal

Dashboard do Fiscal (/campo/fiscal): Cards resumo: obras supervisionadas, check-ins do dia (x de y esperados), postagens pendentes de validação, ocorrências abertas, funcionários ausentes (lista com nome e obra). Alertas em destaque vermelho.
** Validação de Serviços** (/campo/fiscal/validacao): Feed de postagens pendentes. Cada card mostra foto grande, dados do funcionário e obra, etapa. Botões grandes: Aprovar (verde) com slider de qualidade (1-5 estrelas) | Rejeitar (vermelho) com campo obrigatório de motivo. Filtro por obra.

Mapa de Equipe (/campo/fiscal/mapa): Mapa placeholder grande com pins coloridos por obra. Lista lateral/abaixo com funcionários agrupados por obra, mostrando horário de check-in e status. Indicador de quem ainda não fez check-in.
** Registro de Ocorrências** (/campo/fiscal/ocorrencias): Formulário: obra (dropdown), tipo (dropdown), gravidade (alta/média/baixa), descrição, foto. Lista de ocorrências anteriores com status (aberta/resolvida). Timeline da obra.

** Relatório Diário** (/campo/fiscal/relatorio): Formulário rápido: obra, condições climáticas (ícones sol/nublado/chuva), % avanço estimado do dia, equipe presente (número), observações, até 3 fotos gerais. Botão "Enviar Relatório". Histórico de relatórios enviados.

** BottomNav do Fiscal:** Home | Validação | Mapa | Ocorrências | Relatório

PERFIL
3 — GESTOR / ENCARREGADO (Mobile-first, 5 telas)

R ota base: /campo/gestor

Dashboard do Gestor (/campo/gestor): KPIs em cards: obras ativas, funcionários em campo hoje, taxa de presença (%), postagens do dia, tarefas concluídas hoje, custo do dia (R$). Gráfico de linha (últimos 7 dias) de presença. Cards de obras clicáveis com % progresso e status.

Visão por Obra (/campo/gestor/obra/:id): Detalhe da obra: nome, endereço, progresso, orçamento vs gasto (barra comparativa), equipe alocada (avatares), fiscal, últimas postagens, tarefas pendentes, ocorrências. Gráficos de produtividade da obra.

3 . Gestão de Equipes (/campo/gestor/equipes): Lista de funcionários agrupados por obra. Card com foto, nome, cargo, score, status do dia (presente/ausente). Botão de realocar (simular mover entre obras). Filtro por obra/cargo/setor.

4 . Controle de Tarefas (/campo/gestor/tarefas): Criar nova tarefa: título, descrição, obra, etapa, funcionário responsável, prazo, prioridade. Kanban simplificado ou lista com filtros (por obra, por status, por funcionário). Indicadores de atrasadas.

** Controle de Produção (Fábrica)** (/campo/gestor/producao): Kanban visual das Ordens de Produção: colunas Fila → Cortando → Montando → Acabamento → Pronto → Entregue. Cards com item, obra destino, responsável, prazo, % conclusão. Filtro por obra destino. Alertas de OPs atrasadas.
** BottomNav do Gestor:** Home | Obras | Equipes | Tarefas | Produção

PERFIL 4
— ADMIN (Desktop, 5 telas integráveis)

** Rota base:** /admin/campo (para integrar com admin existente)

Painel Operacional (/admin/campo): Dashboard desktop completo. KPIs grandes: funcionários ativos agora, taxa presença hoje, postagens hoje, ocorrências abertas, custo diário total, obras ativas. Gráficos: presença dos últimos 30 dias (LineChart), custo por obra (BarChart), produtividade por equipe (BarChart). Tabela de últimos check-ins com busca. Mapa geral placeholder com todas as obras.
Gestão de Obras (/admin/campo/obras): Tabela completa com colunas: nome, endereço, status, progresso, orçamento, gasto, saldo, fiscal, equipe (count). Busca e filtros. Modal de nova obra / editar com todos os campos incluindo coordenadas GPS e raio de check-in. Delete com confirmação.
Controle Financeiro (/admin/campo/financeiro): Visão financeira por obra: tabela com orçamento, gastos categorizados (mão de obra, material, transporte, equipamento, alimentação), receita, medições, saldo. Gráficos de pizza (distribuição de gastos), barras (comparativo orçado vs realizado por obra). Totalizadores gerais. Filtro por período e obra. Simulação de exportação PDF/Excel.
Relatórios de Produtividade (/admin/campo/relatorios): Relatórios configuráveis: presença por período, produtividade por funcionário, por equipe, por obra. Ranking geral. Horas trabalhadas. Tarefas concluídas vs atrasadas. Gráficos interativos (LineChart, BarChart, PieChart com recharts). Filtros por data, obra, setor (campo/fábrica), cargo. Cards de insights (ex: "3 funcionários com mais de 2 faltas no mês", "Obra X com 85% de tarefas atrasadas").

Configurações do Módulo (/admin/campo/configuracoes): Raio de geolocalização (metros, input numérico). Horário permitido de check-in (hora início/fim). Tabela de pontuação (configurar pontos por ação). Notificações automáticas (toggles: lembrete check-in, alerta ausência, resumo diário). Configuração por obra (raio e horário específicos).
COMPON
ENTES COMPARTILHADOS (pasta /components/campo/)

Header.tsx: Logo "PARKET" + título da seção + avatar do usuário + sino de notificações com badge.

BottomNav .tsx: Navegação inferior mobile com ícones Lucide, item ativo com cor #A0D4C4, badge de notificação.
K PICard.tsx: Ícone + valor grande + label + variação (↑↓ com cor).
Post Card.tsx: Foto, avatar do autor, nome, obra, etapa, descrição, data, badge status, nota qualidade.
Task Card.tsx: Título, obra, prazo (vermelho se atrasado), prioridade badge, status badge, responsável.
O PCard.tsx: Ordem de produção com item, obra destino, barra de progresso, status, responsável, prazo.
Sc oreCard.tsx: Pontuação com ícone de troféu, valor, posição no ranking.
Status Badge.tsx: Badge reutilizável com variantes (pendente/aprovado/rejeitado/ativo/atrasado/concluído).
Map Placeholder.tsx: Simulação de mapa com fundo cinza, pins coloridos posicionados, legenda.
R ankingList.tsx: Lista ordenada com posição, avatar, nome, pontos, destaque no usuário atual.
Cal endarGrid.tsx: Grid de calendário mensal com dias coloridos por status.
O braProgressCard.tsx: Card de obra com nome, barra de progresso, orçamento, equipe count.
Fin anceBar.tsx: Barra comparativa orçado vs realizado com cores.
Photo Upload.tsx: Área de upload com preview, ícone de câmera, placeholder.
REGRAS TÉCNICAS OBRIGATÓRIAS

** React Router Data Mode** com createBrowserRouter e RouterProvider. Rotas aninhadas com layout compartilhado por perfil.
Layout Mobile: Container max-w-[430px] mx-auto com bg-gray-100 atrás. Header fixo no topo, BottomNav fixo embaixo, conteúdo com scroll entre eles e padding-bottom para não ficar atrás do nav.
Layout Desktop Admin: Full-width com sidebar colapsável (ou integrar com sidebar existente do Parket).
** Fotos Unsplash:** Usar unsplash_tool para TODAS as fotos. Buscar: "construction site workers", "building construction progress", "carpentry workshop", "woodworking factory", "concrete foundation", "brick wall construction", "painting house interior", "electrical wiring installation". Todas únicas.
G ráficos: Usar recharts (LineChart, BarChart, PieChart, AreaChart). Cores consistentes com a paleta.
** Ícones:** Usar lucide-react exclusivamente.
Tip ografia: Não usar classes de font-size, font-weight ou line-height do Tailwind (usar defaults do globals.css).
** Seletor de Perfil:** Tela inicial ou rota /campo com cards para selecionar perfil (Funcionário, Fiscal, Gestor) para demonstração. Admin acessível via /admin/campo.
** Estado:** React useState/useContext para perfil ativo, check-in status, dados filtrados. Context provider para dados mock.
Anim ações: Transições suaves com Motion (motion/react) em cards e modais.
Gam ificação visível: Pontuação presente em toda interação do funcionário. Feedback positivo ao completar ações.
Responsividade : Mobile-first nas telas de campo, desktop-first nas telas admin. Telas admin devem funcionar em tablet também.
Cores : Fundo #F8FAFB, cards #FFFFFF, destaque #A0D4C4, texto #1A1A2E, secundário #6B7280, perigo #EF4444, alerta #F59E0B, sucesso #10B981.
** Dados financeiros mock:** Valores realistas em R$ (obras de 500k a 5M, salários de 150 a 400/dia, materiais variados).
Dicas de uso:
Se o projeto for novo, cole o prompt inteiro
Se já tem código, adicione no início: "O sistema Parket já está implementado com sidebar e dashboards administrativos. Adicione o seguinte módulo sem alterar o que já existe:"
Para ir por partes, quebre assim:
Prompt 1: "Crie a estrutura base, mockData, componentes compartilhados e as 10 telas do Funcionário"
Prompt 2: "Adicione as 5 telas do Fiscal e as 5 telas do Gestor"
Prompt 3: "Adicione as 5 telas Admin desktop com gráficos e controle financeiro"
Prompt 4: "Conecte com Supabase para persistência real"
