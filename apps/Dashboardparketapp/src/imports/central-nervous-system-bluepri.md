Você é um Principal Systems Architect + Product Engineer + Operating Architect especializado em ERP, CRM e sistemas internos integrados.

Contexto:
Empresa premium de madeira e obras complexas.
Objetivo: criar um Sistema Nervoso Central da empresa.

Este sistema deve:

1) Mapear e padronizar os processos de cada departamento.
2) Criar um Workspace Central único com histórico completo.
3) Criar um Painel de Gestão do Cliente (Customer Control Panel).
4) Criar Kanbans por departamento integrados.
5) Implementar um sistema formal de passagem de bastão.
6) Integrar IA como coordenador entre departamentos.
7) Garantir rastreabilidade total da jornada do cliente.
8) Tornar simples o suficiente para qualquer colaborador operar.

---

VISÃO DO SISTEMA

Arquitetura em 3 camadas:

Camada 1 – Fonte de Verdade (Workspace Central)
- Pasta centralizada por Obra/Cliente.
- Histórico completo:
  - Decisões
  - Versões de projeto
  - Propostas
  - Compras
  - Notas
  - Diário de obra
  - NC
  - Handoffs
  - Aditivos
  - Chamados pós-obra
- Todos os arquivos organizados por estrutura padronizada.
- Acesso controlado por perfil.
- Audit log obrigatório.

Camada 2 – Painel de Gestão do Cliente
Cada cliente/obra possui:
- Linha do tempo da jornada
- Status geral
- Gates (0 a 4)
- Alertas
- Risco
- Última decisão
- Próxima ação

Camada 3 – Kanban por Departamento (integrado)
Cada departamento possui:
- Board próprio (Trello-like)
- Colunas padronizadas:
  Backlog
  Planejado
  Em Execução
  Em Aprovação
  Bloqueado
  Aguardando Próxima Área
  Concluído
- Campos obrigatórios em cada card
- Checklists vinculados
- SLA
- Evidência obrigatória

---

PASSAGEM DE BASTÃO (Handoff System)

Toda vez que um card sai de um departamento e vai para outro:

1) A IA verifica:
   - Checklist completo?
   - Campos obrigatórios preenchidos?
   - Evidências anexadas?
2) Se não estiver completo → bloqueia.
3) Se estiver completo → envia notificação automática.
4) Próximo responsável deve:
   - Confirmar recebimento.
   - Aceitar responsabilidade.
5) Se não confirmar em X horas → escalonamento automático.

Toda passagem de bastão gera:
- Log estruturado
- Timestamp
- Responsável anterior
- Novo responsável
- Evidências anexadas

---

IA COMO COORDENADOR

A IA deve:

1) Monitorar todos os Kanbans.
2) Detectar gargalos.
3) Alertar SLAs vencidos.
4) Identificar cards parados.
5) Cobrar confirmação de handoff.
6) Preparar resumo semanal por obra.
7) Gerar resumo consolidado da empresa.
8) Sugerir riscos antecipados.
9) Gerar insights para relacionamento com cliente.

A IA não executa decisões críticas.
Ela valida, alerta e coordena.

---

RELACIONAMENTO / ATENDIMENTO

O atendente deve ter acesso a:

- Linha do tempo completa do cliente.
- Últimas decisões.
- Pendências.
- Próximo marco.
- Histórico de mensagens.
- Resumo automático da IA:
   "Cliente em fase X. Última decisão foi Y. Próximo passo Z. Risco atual A."

Além disso:
IA deve sugerir mensagens baseadas no contexto.

---

MAPEAMENTO OBRIGATÓRIO POR DEPARTAMENTO

Para cada departamento gerar:

1) Missão
2) Inputs (campos obrigatórios)
3) Microprocesso atual (as-is)
4) Microprocesso ideal (to-be)
5) Handoffs
6) SLA
7) Evidência obrigatória
8) Campos obrigatórios do card
9) Integrações necessárias
10) Métricas
11) Alertas automáticos
12) Como IA atua como gatekeeper

Departamentos:

Comercial
Projetos
Compras
Financeiro
Fiscal
Produção
Expedição/Estoque
Obras
Produtividade/PMO
Pós-obra
Marketing
Gestão de Fornecedores
Importação
Administrativo

---

MODELO DE DADOS MÍNIMO

Entidades obrigatórias:

Cliente
Obra
Projeto
Versão_Projeto
Proposta
Contrato
Gate
Card
Handoff
Decisão
Checklist
Evidência
Compra_Requisição
PO
Nota_Fiscal
Estoque
Expedição
Entrega
Apontamento_Horas
Produção_Unidade
NC
Aditivo
Chamado
Fornecedor
Usuário
Audit_Log

---

ENTREGÁVEIS

Criar estrutura de /output com:

/workspace_model
- estrutura_pastas.md
- padrao_nomenclatura.md
- governanca.md

/customer_panel
- modelo_painel_cliente.md
- fluxo_gates.md
- resumo_IA.md

/departamentos
- um arquivo por departamento detalhado

/kanban_system
- modelo_board.md
- regras_handoff.md
- SLA_e_alertas.md

/IA
- agentes_por_area.md
- control_tower.md
- alertas.md
- score_risco.md

/figma
- blueprint_geral.svg
- painel_cliente.svg
- modelo_kanban.svg
- fluxo_handoff.svg
- arquitetura_sistema.svg

/spec
- schema.sql
- api_endpoints.md
- eventos_webhooks.md
- integracoes.md

---

CRITÉRIOS DE QUALIDADE

- Específico para empresa premium de obra.
- Simples o suficiente para time operacional.
- Bloqueios reais para evitar retrabalho.
- Automatizações práticas.
- Nenhuma etapa dependente de “boa vontade”.
- Tudo rastreável.
- Tudo auditável.
- Sem excesso de telas.

---

EXECUTE:

1) Gere Blueprint do Sistema Nervoso Central.
2) Gere workbook completo.
3) Gere SVGs para Figma.
4) Gere especificação técnica.
5) Liste árvore final de /output.
6) Inclua guia: “Como implementar em 90 dias”.
Não faça perguntas.
Assuma padrões razoáveis.
Entregue completo.