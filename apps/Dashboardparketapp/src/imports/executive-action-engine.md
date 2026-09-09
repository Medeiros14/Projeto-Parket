Esse módulo é o que transforma dashboard em gestão real.
Sem ele, você vê problema.
Com ele, você recebe:
	1.	o que precisa ser decidido
	2.	o que precisa ser escalado
	3.	o que está queimando margem
	4.	quem está segurando fluxo
	5.	quais obras precisam de intervenção imediata

Abaixo está a execução completa, já pronta para entrar no workbook, no Claude Code e no Figma.

⸻

Executive Action Engine da Parket

1. O que é

O Executive Action Engine é a camada decisória do Command Center.

Ele pega os dados do sistema e transforma em 5 saídas executivas:
	1.	Top prioridades da semana
	2.	Top obras para intervenção
	3.	Top gargalos por departamento
	4.	Top perdas evitáveis
	5.	Top decisões que precisam do fundador

Ele deve ser o primeiro painel que você lê toda segunda-feira.

⸻

2. Função estratégica

O sistema da Parket não pode só mostrar informação.
Ele precisa gerar direção.

O Executive Action Engine existe para responder, semanalmente:
	•	Onde estamos perdendo dinheiro agora
	•	Onde vamos atrasar se nada for feito
	•	Qual departamento está travando o fluxo
	•	Qual obra precisa de war room
	•	O que precisa da decisão do fundador

⸻

3. Estrutura do módulo

Bloco 1. Top 10 prioridades da semana

Objetivo

Gerar a lista objetiva do que precisa ser atacado na semana.

Lógica de priorização

Cada item recebe score baseado em:
	•	impacto em margem
	•	impacto em prazo
	•	risco reputacional
	•	dependência entre áreas
	•	proximidade do prazo
	•	criticidade do cliente/obra

Output

Cada prioridade deve sair com:
	•	título da prioridade
	•	obra/departamento
	•	motivo
	•	impacto
	•	responsável
	•	prazo
	•	ação sugerida

Exemplo de formato

Prioridade 01
Obra: Casa Jardim Europa
Tema: Frente não liberada e entrega crítica em 4 dias
Impacto: risco de atraso + frete extra + cliente sensível
Responsável: Coordenação de Obras
Ação: validar base até hoje 17h e confirmar logística amanhã 9h

⸻

Bloco 2. Top 5 obras para intervenção

Objetivo

Forçar foco nas obras que mais ameaçam resultado.

Critérios para entrar
	•	score de risco abaixo de 60
	•	atraso em gate
	•	2 semanas com piora de score
	•	NC alta
	•	cliente com escalonamento
	•	margem projetada em queda

Output por obra
	•	score atual
	•	principal causa de risco
	•	principal decisão pendente
	•	próximo marco
	•	plano de recuperação em 3 ações
	•	dono da recuperação

Regra

Obra com score <60 entra automaticamente no War Room.

⸻

Bloco 3. Top 5 gargalos por departamento

Objetivo

Mostrar onde o sistema está travando.

Critérios
	•	backlog vencido
	•	handoffs não aceitos
	•	SLA estourado
	•	retrabalho gerado
	•	cards bloqueados acima do normal

Saída
	•	departamento
	•	gargalo
	•	número de ocorrências
	•	impacto
	•	área afetada
	•	ação corretiva sugerida

Exemplo

Compras
Gargalo: requisições voltando por falta de especificação
Ocorrências: 11
Impacto: atraso de compras + urgência logística
Ação: travar requisição sem versão do projeto e campo de acabamento

⸻

Bloco 4. Top 5 perdas evitáveis

Objetivo

Atacar diretamente o desperdício operacional.

Fontes
	•	retrabalho
	•	frete extra
	•	urgência de compra
	•	erro de compra
	•	improdutividade
	•	reentrega
	•	garantia recorrente

Output
	•	tipo de perda
	•	obra/departamento
	•	valor estimado
	•	causa raiz
	•	contramedida de processo
	•	dono

Regra

Toda perda recorrente precisa virar:
	•	checklist
	•	regra de bloqueio
	•	atualização de template
	•	treinamento

⸻

Bloco 5. Top 5 decisões do fundador

Objetivo

Separar o que é operação do que realmente precisa da sua intervenção.

Uma decisão sobe para o fundador quando:
	•	envolve exceção financeira
	•	impacta cliente estratégico
	•	exige mudança de prioridade entre obras
	•	pede contratação/demissão crítica
	•	envolve desconto, aditivo ou risco reputacional

Saída
	•	decisão
	•	contexto
	•	trade-off
	•	recomendação da IA
	•	impacto se decidir hoje
	•	impacto se adiar

Exemplo

Decisão 03
Tema: antecipar produção do lote X para a obra Y
Trade-off: atrasa 2 dias obra Z, mas preserva cliente mais estratégico
Recomendação: aprovar remanejamento e compensar obra Z com equipe extra

⸻

4. Estrutura dos scores que alimentam o Engine

4.1 Score de risco por obra

Escala: 0 a 100

Variáveis
	•	atraso de gate
	•	atraso cronograma
	•	frente não liberada
	•	compras críticas pendentes
	•	diário incompleto
	•	NC
	•	retrabalho
	•	cliente sensível
	•	mudança de escopo
	•	material crítico em risco

Faixas
	•	90–100 saudável
	•	75–89 atenção
	•	60–74 risco
	•	abaixo de 60 crítico

⸻

4.2 Score de confiabilidade por departamento

Escala: A, B, C, D

Variáveis
	•	SLA cumprido
	•	qualidade do handoff
	•	cards bloqueados
	•	retrabalho gerado
	•	aderência ao checklist
	•	qualidade da evidência
	•	tempo de aceite de handoff

Faixas
	•	A excelente
	•	B boa
	•	C instável
	•	D crítica

⸻

5. Painéis que o Executive Action Engine precisa alimentar

Painel 1. Executive Action Board

Visual único com:
	•	Top 10 prioridades
	•	Top 5 obras
	•	Top 5 gargalos
	•	Top 5 perdas
	•	Top 5 decisões

Painel 2. Weekly Decision Deck

Versão resumida para reunião semanal da diretoria.

Painel 3. War Room Trigger Board

Painel só de obras e áreas que entraram em regime de intervenção.

⸻

6. Lógica operacional semanal

Segunda-feira 7h

O sistema roda e gera:
	•	relatório consolidado
	•	score das obras
	•	score dos departamentos
	•	prioridades da semana
	•	decisões críticas

Segunda-feira 8h

O Control Tower envia:
	•	resumo executivo
	•	link dos painéis
	•	lista de responsáveis cobrados

Segunda-feira reunião da diretoria

Agenda:
	1.	prioridades da semana
	2.	obras críticas
	3.	perdas evitáveis
	4.	gargalos por área
	5.	decisões do fundador

Sexta-feira

O sistema compara:
	•	o que foi priorizado
	•	o que foi executado
	•	o que ficou em aberto
	•	quem respondeu
	•	qual impacto gerou

⸻

7. Lógica dos alertas

Alertas vermelhos

Disparam imediatamente
	•	obra <60
	•	margem projetada negativa
	•	cliente escalado
	•	gate crítico vencido
	•	handoff crítico sem aceite

Alertas amarelos

Disparam no resumo diário
	•	backlog crescente
	•	SLA perto do vencimento
	•	produtividade abaixo da meta
	•	frete extra anormal
	•	NC subindo

Alertas azuis

Insights e melhoria
	•	padrão recorrente
	•	oportunidade de automação
	•	equipe com melhor performance
	•	fornecedor com melhora/piora

⸻

8. Como isso entra no Figma

O Claude Code deve gerar estes SVGs adicionais:
	•	13_Executive_Action_Board.svg
	•	14_Weekly_Decision_Deck.svg
	•	15_War_Room_Trigger_Board.svg

Estrutura visual recomendada

Linha 1
	•	prioridades da semana
	•	custo de perdas
	•	obras críticas
	•	decisões do fundador

Linha 2
	•	gargalos por área
	•	score de confiabilidade
	•	handoffs quebrados
	•	clientes sensíveis

Linha 3
	•	plano de ação
	•	responsáveis
	•	prazos
	•	status

⸻

9. O que deve entrar no workbook

Criar mais 3 capítulos:

08_Executive_Action_Engine.md

Conteúdo:
	•	objetivo
	•	inputs
	•	lógica
	•	outputs
	•	regras de priorização
	•	rotina semanal

09_Weekly_Decision_System.md

Conteúdo:
	•	como rodar reunião semanal
	•	decisões do fundador
	•	critérios de escalonamento

10_War_Room_Protocol.md

Conteúdo:
	•	gatilho
	•	rito
	•	papéis
	•	plano de recuperação
	•	critério de saída