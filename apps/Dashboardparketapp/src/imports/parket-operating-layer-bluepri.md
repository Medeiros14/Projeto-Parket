Você é um Chief Operating Architect + Product/ERP Architect + Senior Systems Engineer + Figma Systems Designer.

Contexto (Parket / Parquet):
Empresa premium de madeira e obras complexas.
Dois fluxos diferentes: REvestimentos (piso/forro/painel/deck/escada) e Marcenaria (portas/painéis/fachada/móveis fixos).
Problema atual: retrabalho, atrasos, ruído interno, falhas de qualidade, falta de rastreabilidade, processos quebrando nos handoffs.
Meta: em 90 dias, reduzir perdas com processos padronizados, comunicação rastreável e IA como mecanismo de garantia.
Princípios:
- Menos ferramentas, mais disciplina.
- Processo só vale se tiver dono, SLA, checklist, evidência e auditoria.
- Comunicação sem registro não existe. WhatsApp é interface, não fonte de verdade.
- IA acelera e controla, não substitui liderança.

Sua missão:
Criar um WORKBOOK COMPLETO + BLUEPRINT TÉCNICO do “Operating Layer” da Parket que se integra ao ERP e CRM existentes e substitui o uso fragmentado de WhatsApp/Trello por um sistema único de tarefas/decisões/gates/evidências.
O output tem que ser aplicável, simples e executável por um time real. Sem fantasia.

Entregáveis obrigatórios (todos):
A) Diagnóstico por perdas (Painel de Perdas com 12 métricas e fórmulas)
B) Desenho dos processos críticos end-to-end separados: Revestimentos e Marcenaria
C) Desenho micro por departamento (processos, handoffs, SLAs, inputs/outputs, evidência)
D) “Operating Layer” como produto: arquitetura, modelo de dados, integrações ERP/CRM, e regras de workflow (gates e bloqueios)
E) Design no Figma: telas e componentes (em SVG para importar no Figma)
F) Backlog de implementação em 6 sprints (90 dias), com definition of done, owners, riscos
G) Especificação de 8 agentes de IA por área + 1 Control Tower (CEO dos agentes)
H) Templates operacionais: requisição de compra, check frente liberada, diário de obra, NC, handoff, decisão, solicitação de expedição, alteração/aditivo
I) Relatórios automáticos: semanal por obra, consolidado semanal, relatório final por obra com prazo/custo/qualidade/margem

Escopo de departamentos a mapear (micro):
Comercial
Projetos (com “Trello-like board por projeto”)
Compras
Financeiro
Fiscal (notas/contabilidade)
Expedição/Estoque
Produção
Obras/Fiscalização
Produtividade/PMO
Atendimento ao cliente/Pós-obra
Marketing/Tráfego
Gestão de fornecedores
Importação
Administrativo

Regras de padronização (não negociável):
1) Gates:
Gate 0 Escopo Fechado
Gate 1 Freeze de Projeto
Gate 2 Compra Validada
Gate 3 Frente Liberada
Gate 4 Aceite/Entrega
2) Status:
Backlog, Planejado, Em Execução, Bloqueado, Em Aprovação, Concluído, Auditada
3) Todo processo/handoff deve conter:
Objetivo, Dono, SLA, Input padrão, Output padrão, Checklist, Evidência obrigatória, Erro comum, Prevenção, Métrica leading
4) WhatsApp:
Pode: comunicação rápida, foto de contexto, aviso.
Proibido ficar só no WhatsApp: decisão, mudança de escopo, compra, prazo, aceite, NC. Tudo deve virar registro no sistema em até 2 horas.
5) Versionamento:
Projeto, lista de materiais, proposta e cronograma precisam de versão (v1, v2…) e “verdade única”.
6) Simplicidade:
O sistema deve funcionar com o mínimo de telas e o mínimo de campos, mas com rigidez nos campos obrigatórios.

Parte D: Produto (Operating Layer) deve incluir:
- Entidades (tabelas) mínimas:
Obra, Cliente, Contato, Projeto, Versão_Projeto, Proposta, Contrato, Tarefa, Decisão, Gate, Evidência, Handoff, Checklist_Item, NC, Aditivo, Compra_Requisição, PO, Recebimento, Estoque_Item, Expedição, Entrega, Chamado_PósObra, Equipe, Apontamento_Horas, Produção_Unidade, Fornecedor, Importação_Embarque, Audit_Log
- RBAC (perfis e permissões)
- Audit log obrigatório por ação
- Integrações:
CRM: pipeline, atividades, propostas, ganhos/perdas, visitas showroom
ERP: estoque, POs, notas, contas a pagar/receber, produção, expedição
Tráfego: Meta/Google métricas
WhatsApp: entrada de eventos e coleta de evidência
- Motor de workflow:
regras de bloqueio por gate e por checklist incompleto
SLA e escalonamentos automáticos
- Relatórios:
Painel de perdas, risco por obra, produtividade por equipe, margem por obra (industrial e full)

Parte E: Design Figma (SVGs) obrigatórios:
1) Dashboard executivo (perdas + risco + obras)
2) Tela de Obra (gates, cronograma, diário, evidências, NC, decisões)
3) Board Trello-like de Projetos (cards, status, versão, checklist)
4) Tela de Requisição de Compra (campos obrigatórios + anexos)
5) Tela de PO e validação técnica
6) Tela de Expedição (picking list + dados de entrega: altura elevador, acesso, restrições)
7) Tela de Apontamento diário (horas + unidade + improdutividade)
8) Tela de NC (abrir/fechar/causa raiz)
9) Tela de Handoff (pacote mínimo + SLA + evidências)
10) Tela de Relatório semanal e relatório final

Formato de entrega em arquivos:
Crie /output com:
- /workbook (Markdown + PDF-ready)
- /figma (SVGs)
- /data (JSON do modelo e templates)
- /spec (arquitetura, schema, endpoints, integrações)
- /changelog (CHANGELOG.md)

No /workbook gere:
- 00_Blueprint_1_pagina.md (visão geral)
- 01_Diagnostico_Perdas.md
- 02_Workflow_Revestimentos.md
- 03_Workflow_Marcenaria.md
- 04_Departamentos_Micro_Processos.md (separado por departamento)
- 05_Operating_Layer_Produto.md
- 06_Arquitetura_Tecnica.md
- 07_Backlog_6_Sprints.md
- 08_Agentes_IA_e_Control_Tower.md
- 09_Templates_e_Checklists.md
- 10_Relatorios_e_Metricas.md

No /spec gere:
- schema.sql (Postgres) + ERD em texto
- endpoints.md (APIs e webhooks)
- integrations.md (CRM/ERP/WhatsApp/Ads)
- workflow_rules.md (gates, bloqueios, SLAs)

Requisitos de qualidade:
- Seja extremamente específico, operacional e auditável.
- Trate cada departamento como um micro-sistema com entradas, saídas, filas e contratos (handoffs).
- Explique exatamente como automatizar e quais campos devem ser obrigatórios.
- Para compras e expedição, crie campos concretos (ex: altura elevador, janela, contato, restrições, fotos).
- Produza um backlog com entregáveis executáveis e testes.
- Não peça informações. Assuma padrões razoáveis, mas declare as suposições.

Execute agora:
1) Gere o blueprint de 1 página.
2) Gere o workbook completo.
3) Gere os SVGs para Figma.
4) Gere os JSONs e specs técnicos.
5) Liste a árvore final de /output.
6) Inclua no final um guia: “como o dev deve usar este workbook para construir o sistema”.