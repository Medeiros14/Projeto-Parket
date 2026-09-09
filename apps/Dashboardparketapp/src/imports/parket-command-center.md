Você é um Principal Operating Architect + Executive Dashboard Designer + ERP/CRM Systems Engineer.

Sua missão é criar o **Parket Command Center**: o centro de comando executivo da empresa Parket.

Contexto:
A Parket é uma empresa premium de madeira e obras complexas.
Opera com:
- pisos
- forros / painéis
- decks
- escadas
- marcenaria fina
- fachadas
- móveis fixos

A empresa possui:
- comercial nacional
- projetos / engenharia
- compras
- produção industrial
- logística / expedição
- obras / fiscalização / instalação
- relacionamento / pós-obra
- administrativo / financeiro / fiscal / RH / sistemas
- PMO / produtividade

Objetivo do Command Center:
Criar um sistema de comando executivo capaz de mostrar, de forma simples e acionável:

1. Obras em risco
2. Gargalos por departamento
3. Perdas financeiras
4. Produtividade por equipe
5. Atrasos críticos
6. Handoffs quebrados
7. Margem por obra
8. Performance comercial
9. Capacidade operacional
10. Prioridades da semana

O sistema deve servir para:
- CEO
- diretoria
- coordenadores
- agentes de IA
- reuniões semanais
- war room
- tomada de decisão

---

ARQUITETURA DO COMMAND CENTER

Criar 5 camadas:

CAMADA 1 — VISÃO EXECUTIVA
Painel principal com:
- total de obras ativas
- obras em risco
- obras críticas
- margem média por obra
- custo de perdas no mês
- produtividade média
- score de confiabilidade por departamento
- top 10 decisões da semana

CAMADA 2 — VISÃO DE RISCO POR OBRA
Cada obra deve ter:
- status atual
- avanço real vs planejado
- custo real vs previsto
- score de risco
- top 5 riscos
- retrabalho
- NC
- bloqueios
- responsável atual
- próximo handoff
- próximos 7 dias

CAMADA 3 — VISÃO POR DEPARTAMENTO
Cada departamento deve mostrar:
- cards em atraso
- SLA vencido
- gargalos
- handoffs não aceitos
- retrabalho causado
- score de confiabilidade
- performance da semana

Departamentos:
Comercial
Projetos
Compras
Financeiro
Fiscal
Produção
Logística
Obras
Relacionamento
PMO / Produtividade

CAMADA 4 — VISÃO DE PRODUTIVIDADE E MARGEM
Métricas:
- horas produtivas
- horas improdutivas
- custo por obra
- custo por equipe
- produtividade por tipologia
- margem industrial por obra
- margem full por obra
- retrabalho em horas e R$
- custo de urgência / frete extra

CAMADA 5 — CONTROL TOWER IA
Painel que mostra:
- alertas automáticos
- decisões pendentes
- gargalos por handoff
- handoffs sem confirmação
- score de risco por obra
- score de confiabilidade por departamento
- sugestões de ação da IA

---

PAINÉIS OBRIGATÓRIOS

Criar os seguintes painéis:

1) Dashboard Executivo Principal
2) Dashboard de Obras em Risco
3) Dashboard de Perdas
4) Dashboard de Produtividade
5) Dashboard de Margem por Obra
6) Dashboard Comercial
7) Dashboard de Handoffs
8) Dashboard de Confiabilidade por Departamento
9) Dashboard de Capacidade de Produção
10) Dashboard de Pós-obra e Relacionamento

---

INDICADORES OBRIGATÓRIOS

A) INDICADORES EXECUTIVOS
- número de obras ativas
- número de obras críticas
- faturamento previsto mês
- margem média
- custo de perdas
- prazo médio vs prazo prometido

B) INDICADORES DE OBRAS
- avanço %
- atraso em dias
- custos acumulados
- horas totais
- horas improdutivas
- NC abertas
- retrabalho
- score de risco

C) INDICADORES DE DEPARTAMENTO
- SLA cumprido
- handoffs aceitos no prazo
- cards bloqueados
- retrabalho gerado
- backlog vencido
- score de confiabilidade

D) INDICADORES DE COMERCIAL
- leads
- propostas
- visitas showroom
- follow-ups
- taxa de conversão
- ticket médio
- forecast

E) INDICADORES DE COMPRAS
- urgências
- lead time médio
- compras fora de SLA
- compras sem validação técnica
- score fornecedor

F) INDICADORES DE PRODUÇÃO
- OTIF produção
- ordens atrasadas
- retrabalho fabril
- tempo por lote
- gargalo por etapa

G) INDICADORES DE LOGÍSTICA
- entregas completas no prazo
- reentregas
- avarias
- entregas sem dados completos
- falha de conferência

H) INDICADORES DE OBRAS
- diários completos
- frente liberada na 1ª
- NC / 100 entregas
- FPY
- atraso por equipe

I) INDICADORES DE RELACIONAMENTO
- SLA de resposta
- chamados abertos
- chamados reincidentes
- NPS
- risco reputacional

J) INDICADORES DE PRODUTIVIDADE
- custo hora por equipe
- unidade por hora
- custo direto por obra
- custo total por obra
- margem industrial
- margem full

---

SCORE DE RISCO POR OBRA

Criar modelo de score 0–100 baseado em:
- atraso em gate
- atraso de cronograma
- compras críticas pendentes
- frente não liberada
- falta de diário
- NC alta
- retrabalho alto
- cliente sensível
- mudança de escopo frequente
- material crítico em risco

Classificação:
90–100 saudável
75–89 atenção
60–74 risco
<60 crítico / war room

---

SCORE DE CONFIABILIDADE POR DEPARTAMENTO

Criar score baseado em:
- cumprimento de SLA
- qualidade do handoff
- quantidade de retrabalho gerado
- bloqueios causados
- pendências vencidas
- aderência ao checklist
- qualidade de evidência

Classificação:
A excelente
B boa
C instável
D crítica

---

WAR ROOM

Criar modelo de war room automático para:
- obras abaixo de 60
- departamentos com score D
- atraso crítico
- margem negativa
- cliente escalado

War room deve mostrar:
- causa raiz
- dono
- plano de recuperação
- prazo
- indicador de saída

---

CONTROL TOWER IA

O painel da IA deve consolidar:
- alertas do dia
- handoffs sem aceite
- tarefas críticas vencidas
- obras que pioraram score
- departamentos que pioraram score
- sugestões de ação
- prioridades executivas da semana

---

WORKSPACE CENTRAL

O Command Center deve ser conectado ao Workspace Central:
cada indicador deve conseguir abrir:
- obra
- documento
- decisão
- handoff
- evidência
- responsável

---

FIGMA

Gerar arquivos SVG editáveis para Figma, com layout premium minimalista.
Gerar em /output/figma:

01_Command_Center_Executivo.svg
02_Obras_em_Risco.svg
03_Painel_de_Perdas.svg
04_Painel_Produtividade.svg
05_Painel_Margem.svg
06_Painel_Comercial.svg
07_Painel_Handoffs.svg
08_Score_Departamentos.svg
09_Painel_Producao.svg
10_Painel_Pos_Obra.svg
11_War_Room.svg
12_Control_Tower_IA.svg

---

WORKBOOK

Criar em /output/workbook:

00_Blueprint_Command_Center.md
01_Dashboards_e_Indicadores.md
02_Score_Risco_Obra.md
03_Score_Confiabilidade_Departamentos.md
04_War_Room_Model.md
05_Control_Tower_IA.md
06_Integracao_Workspace.md
07_Backlog_Implementacao.md

---

SPEC TÉCNICO

Criar em /output/spec:
- metrics.json
- scores.json
- alert_rules.json
- executive_dashboard_schema.sql
- reporting_queries.sql

---

REGRAS DE QUALIDADE

- Seja objetivo, executivo e operacional.
- Não criar dashboards genéricos.
- Tudo deve ser acionável.
- Todo indicador deve servir para uma decisão.
- Evitar excesso de informação.
- Construir dashboards para uso real em reunião semanal.

---

EXECUTE:
1. Gerar blueprint do Command Center
2. Gerar workbook
3. Gerar dashboards SVG
4. Gerar lógica dos scores
5. Gerar regras de alertas
6. Gerar árvore final do /output
7. Incluir guia: como usar o Command Center na reunião semanal da diretoria

Não faça perguntas.
Assuma padrões razoáveis.
Entregue completo.