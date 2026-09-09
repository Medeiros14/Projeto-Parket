/* ═══════════════════════════════════════════════════════════
   Entrevistas por Área — Roteiro de Workshop
   16 áreas · 40 universais + específicas + 8 IA por área
   ═══════════════════════════════════════════════════════════ */

export interface AIQuestion {
  id: number;
  text: string;
  hint?: string;
}

export interface AreaQuestion {
  id: number;
  text: string;
  hint?: string;
  tag?: string;
}

export interface UniversalSubBlock {
  id: string;
  title: string;
  subtitle: string;
  questions: AreaQuestion[];
}

export interface AreaDef {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  toolSummary: string;
  questions: AreaQuestion[];
}

export interface DeliveryItem {
  id: string;
  label: string;
  hint: string;
}

/* ═══════════════════════════════════════════════════════════
   PERGUNTAS UNIVERSAIS (40) — aplicadas em toda entrevista
   ═══════════════════════════════════════════════════════════ */

export const universalBlocks: UniversalSubBlock[] = [
  {
    id: "missao",
    title: "1.1 Missão, Resultado e Escopo",
    subtitle: "O que a área entrega e o que não entrega",
    questions: [
      { id: 1, text: "Qual é o resultado final dessa área em uma frase mensurável?", hint: "Ex: \"Toda obra começa com frente liberada e checklist aprovado\" — não vale genérico." },
      { id: 2, text: "O que essa área entrega e o que ela não entrega, explicitamente?", hint: "Faça duas listas: \"eu faço\" e \"eu não faço\". Isso evita conflito de escopo." },
      { id: 3, text: "Quais são os 3 \"defeitos imperdoáveis\" dessa área?", hint: "O que, se acontecer, gera retrabalho grave, perda financeira ou de reputação." },
      { id: 4, text: "Quais são os 5 outputs que a área gera (documentos, decisões, entregas, liberações)?", hint: "Documentos, aprovações, checklists, liberações, relatórios." },
      { id: 5, text: "Quem é o \"cliente interno\" principal e o que ele precisa receber de você?", hint: "Área seguinte no fluxo. O que ela espera, no formato e prazo certo." },
    ],
  },
  {
    id: "entradas",
    title: "1.2 Entradas, Filas e Gatilhos",
    subtitle: "De onde o trabalho vem e como entra",
    questions: [
      { id: 6, text: "Quais são todas as entradas de demanda dessa área (de onde vem)?", hint: "Outras áreas, clientes, fornecedores, diretoria, sistemas." },
      { id: 7, text: "Onde cada demanda entra hoje (WhatsApp, e-mail, sistema, reunião, ligação)?", hint: "Seja honesto — onde de verdade entra, não onde deveria entrar." },
      { id: 8, text: "Quais campos são obrigatórios para aceitar uma demanda?", hint: "O mínimo que precisa vir junto para você começar sem retrabalho." },
      { id: 9, text: "Quem rejeita demanda incompleta e qual frase padrão usa?", hint: "Existe autoridade para devolver? Ou tudo entra de qualquer jeito?", tag: "governança" },
      { id: 10, text: "Quais filas existem hoje e qual é a maior fila escondida?", hint: "Fila formal (sistema) vs fila real (WhatsApp, cabeça de alguém)." },
    ],
  },
  {
    id: "processo-real",
    title: "1.3 Processo Real vs Oficial",
    subtitle: "O que acontece de verdade, não o que deveria",
    questions: [
      { id: 11, text: "Descreva o processo real em 8 a 12 passos, como acontece hoje.", hint: "Não o processo ideal — o que realmente acontece. Passo a passo." },
      { id: 12, text: "Onde o processo \"pula etapas\" quando está corrido?", hint: "Cite exemplos reais da última semana.", tag: "brutal" },
      { id: 13, text: "Quais são as 3 principais causas de retrabalho da área?", hint: "Causa raiz, não sintoma. Ex: versão errada, não: \"refiz o documento\"." },
      { id: 14, text: "Quais são as 3 principais causas de atraso da área?", hint: "Dependência de outro? Falta de informação? Capacidade? Prioridade?" },
      { id: 15, text: "Quais são as 5 exceções mais frequentes?", hint: "\"Normalmente faz X, mas quando Y acontece, a gente faz Z\". Liste 5." },
    ],
  },
  {
    id: "handoffs",
    title: "1.4 Handoffs e Contratos entre Áreas",
    subtitle: "Onde o trabalho morre na passagem",
    questions: [
      { id: 16, text: "Quais são os 5 handoffs mais frequentes (origem → destino)?", hint: "Ex: Comercial → Projetos, Projetos → Compras. Liste com seta." },
      { id: 17, text: "Para cada handoff: qual é o pacote mínimo que deve ir junto?", hint: "Documento, aprovação, medição, checklist, projeto. O que TEM que ir." },
      { id: 18, text: "O que sempre falta nesse pacote?", hint: "O que a outra área reclama que \"nunca vem junto\"?", tag: "processo" },
      { id: 19, text: "Qual SLA você espera do outro lado? E qual SLA eles esperam de você?", hint: "Tempo de resposta, tempo de execução. Existe formalmente ou é feeling?" },
      { id: 20, text: "Como vocês provam que entregaram o handoff corretamente (evidência)?", hint: "E-mail? Check no sistema? Foto? Ou não existe prova?" },
    ],
  },
  {
    id: "qualidade",
    title: "1.5 Qualidade, Evidência e Auditoria",
    subtitle: "O que é \"feito\" e como provar",
    questions: [
      { id: 21, text: "O que significa \"feito\" para cada output? Definição de pronto.", hint: "Para cada um dos 5 outputs: qual critério objetivo marca \"terminei\"?" },
      { id: 22, text: "Qual evidência é obrigatória para não virar discussão depois?", hint: "Foto, assinatura, checklist, e-mail de aprovação, registro em sistema." },
      { id: 23, text: "Quais 5 erros precisam virar checklist para nunca mais repetir?", hint: "Erros recorrentes que já causaram prejuízo e precisam de prevenção.", tag: "destrava" },
      { id: 24, text: "O que é auditável semanalmente sem burocracia?", hint: "Amostra de 3 a 5 itens por semana que alguém pode conferir em 10 min." },
      { id: 25, text: "Qual padrão deve bloquear avanço se não for cumprido?", hint: "O que é gate: se não cumprir, para tudo. Qual é esse critério?", tag: "governança" },
    ],
  },
  {
    id: "dados",
    title: "1.6 Dados, Versões e Verdade Única",
    subtitle: "Onde mora a verdade e onde ela se perde",
    questions: [
      { id: 26, text: "Onde mora a verdade de: demanda, status, documento, decisão, aprovação?", hint: "Para cada um: qual sistema/lugar/pessoa? É confiável?" },
      { id: 27, text: "Quais versões existem e como vocês evitam trabalhar na versão errada?", hint: "Controle de versão: existe ou é \"peguei o último que me mandaram\"?" },
      { id: 28, text: "Quais dados vocês coletam que ninguém usa?", hint: "Relatórios que ninguém lê, campos que ninguém consulta." },
      { id: 29, text: "Quais dados vocês não coletam e isso mata a operação?", hint: "Informação que falta e causa retrabalho/surpresa.", tag: "brutal" },
      { id: 30, text: "Qual relatório semanal a área deveria gerar para a diretoria?", hint: "5 números + 3 alertas + 1 pedido de decisão. O que seria?" },
    ],
  },
  {
    id: "metricas",
    title: "1.7 Métricas e Incentivos",
    subtitle: "Como medir e o que a métrica causa",
    questions: [
      { id: 31, text: "Quais 5 métricas definem performance da área (2 leading, 3 lagging)?", hint: "Leading: antecipa problema. Lagging: resultado final. Liste 5." },
      { id: 32, text: "Qual comportamento errado a métrica atual incentiva?", hint: "Ex: medir velocidade incentiva pular checklist. Medir volume incentiva aceitar ruim.", tag: "maturidade" },
      { id: 33, text: "Qual é a meta realista para 90 dias?", hint: "Não a meta aspiracional — a que de verdade é atingível com capacidade atual." },
      { id: 34, text: "Qual é o gargalo de capacidade (pessoas, ferramentas, decisão, conhecimento)?", hint: "O que, se resolvido, destranca 30% de produtividade?" },
      { id: 35, text: "O que você eliminaria do fluxo amanhã para ganhar 20% de velocidade?", hint: "Etapa desnecessária, aprovação burocrática, retrabalho evitável.", tag: "destrava" },
    ],
  },
  {
    id: "ia-universal",
    title: "1.8 IA como Gatekeeper",
    subtitle: "Onde a IA deve proteger, alertar e gerar",
    questions: [
      { id: 36, text: "Em quais 3 pontos do processo a IA deve bloquear avanço por falta de dados/evidência?", hint: "Gates automáticos: se campo X vazio, não avança.", tag: "sistema" },
      { id: 37, text: "Que validações a IA pode fazer automaticamente (com regras claras)?", hint: "Regras sem opinião: se A então B, se C falta então alerta." },
      { id: 38, text: "Quais alertas a IA deve disparar (para quem e quando)?", hint: "Destinatário + gatilho + urgência. Ex: \"alerta para líder se diário não preenchido até 18h\"." },
      { id: 39, text: "Quais documentos a IA deve gerar automaticamente (templates preenchidos)?", hint: "Templates que hoje alguém preenche manualmente e poderia ser automático." },
      { id: 40, text: "O que a IA nunca deve fazer sem aprovação humana?", hint: "Decisões que exigem julgamento, exceções, mudanças de escopo, valores.", tag: "governança" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   16 ÁREAS COM PERGUNTAS ESPECÍFICAS
   ════════════════════════════════════════════════════════════ */

export const areas: AreaDef[] = [
  {
    id: "comercial",
    name: "Comercial",
    icon: "💼",
    subtitle: "Do lead ao contrato assinado",
    toolSummary: "CRM com etapas e campos obrigatórios, proposta versionada, aprovação de margem, checklist de kickoff, log de decisões de escopo.",
    questions: [
      { id: 1, text: "Quais são as etapas do funil real hoje (de lead a contrato) e taxas em cada uma?", hint: "Lead → Qualificado → Visita → Proposta → Negociação → Contrato. Com % de conversão real." },
      { id: 2, text: "Qual é o critério de qualificação e o que desqualifica um lead?", hint: "O que faz um lead virar \"qualificado\"? E o que faz você desistir?" },
      { id: 3, text: "Quais dados mínimos entram antes de proposta (10 itens)?", hint: "Metragem, produto, prazo, acesso, decisor, orçamento, projeto, etc." },
      { id: 4, text: "Onde escopo vaza e vira conflito depois? Cite 5 exemplos.", hint: "\"Achei que estava incluso\", \"mudou depois\", \"não combinamos isso\".", tag: "brutal" },
      { id: 5, text: "Como vocês registram premissas e exclusões e fazem o cliente aceitar?", hint: "Proposta com clausulas? E-mail? Verbal? Contrato?" },
      { id: 6, text: "Onde a margem morre: desconto, erro de custo, urgência, aditivo não cobrado?", hint: "Top 5 causas de erosão de margem.", tag: "processo" },
      { id: 7, text: "Qual é o fluxo de aprovação de desconto e exceção?", hint: "Quem aprova? Até quanto? Com que critério?", tag: "governança" },
      { id: 8, text: "Quais são as 10 objeções mais comuns e qual resposta padrão (curta) para cada?", hint: "Preço, prazo, concorrente, \"vou pensar\", \"meu arquiteto\"..." },
      { id: 9, text: "Qual é o handoff perfeito para Projetos e para Obras?", hint: "O que deve ir junto quando comercial passa o bastão?" },
      { id: 10, text: "IA: o agente deve validar o quê antes de permitir enviar proposta e antes de permitir contrato?", hint: "Campos obrigatórios, aprovações necessárias, documentos anexos.", tag: "sistema" },
    ],
  },
  {
    id: "administrativo",
    name: "Administrativo",
    icon: "📋",
    subtitle: "Cadastros, contratos, documentos e suporte interno",
    toolSummary: "Central de solicitações internas com SLA, biblioteca de documentos padrão, checklist de onboarding de obra.",
    questions: [
      { id: 1, text: "Quais são as rotinas críticas semanais e mensais (cadastros, contratos, documentos)?", hint: "O que precisa acontecer toda semana/mês sem falhar?" },
      { id: 2, text: "Quais solicitações chegam de outras áreas e qual o SLA?", hint: "O que pedem? Com que frequência? Em quanto tempo resolvem?" },
      { id: 3, text: "Onde existem retrabalhos por falta de padrão de documento?", hint: "Modelos desatualizados, formatos diferentes, campos faltando." },
      { id: 4, text: "Quais documentos são \"chave\" para não travar financeiro/fiscal?", hint: "Contratos, cadastros, procurações, certidões." },
      { id: 5, text: "Quais autorizações administrativas travam obra (ex: condomínio, acesso, seguros)?", hint: "O que precisa estar liberado antes de começar e quem é responsável?" },
      { id: 6, text: "IA: quais documentos e checklists o agente pode padronizar e cobrar?", hint: "Templates automáticos, alertas de vencimento, cobrança de documentação.", tag: "sistema" },
    ],
  },
  {
    id: "financeiro",
    name: "Financeiro",
    icon: "💰",
    subtitle: "Margem, caixa, aprovações e controle",
    toolSummary: "DRE por obra, forecast 8 semanas, política de aprovação, dashboard de perdas e desvios, workflow de exceções.",
    questions: [
      { id: 1, text: "Como vocês medem margem por obra hoje e com que frequência?", hint: "Custo previsto vs real. Mensal? Por gate? Só no fim?" },
      { id: 2, text: "Quais são as 5 principais causas de estouro de custo?", hint: "Aditivo não cobrado, urgência, retrabalho, erro de orçamento, escopo mal definido.", tag: "brutal" },
      { id: 3, text: "Como é o fluxo de contas a pagar e aprovações (limites por função)?", hint: "Quem solicita? Quem aprova? Até quanto? Em quanto tempo?" },
      { id: 4, text: "Como é o fluxo de faturamento e cobrança por marco?", hint: "Marcos de medição? Aprovação do cliente? Prazo de recebimento?" },
      { id: 5, text: "Qual é o ciclo real de caixa por obra (entrada vs saída)?", hint: "Quando você paga vs quando recebe. Onde o descasamento aperta?" },
      { id: 6, text: "Quais exceções são mais perigosas (desconto, aditivo, urgência, compra fora de PO)?", hint: "O que fura o processo e come margem?", tag: "governança" },
      { id: 7, text: "Quais relatórios semanais são obrigatórios para diretoria?", hint: "Caixa, inadimplência, margem, desvios, forecast." },
      { id: 8, text: "IA: quais alertas devem ser automáticos (desvio, atraso de recebível, compra fora de orçamento)?", hint: "Gatilhos quantitativos: se X > Y%, alerta para Z.", tag: "sistema" },
    ],
  },
  {
    id: "compras",
    name: "Compras",
    icon: "🛒",
    subtitle: "Requisição, cotação, PO, recebimento",
    toolSummary: "Workflow: requisição → validação técnica → cotação → PO → rastreio → recebimento. Catálogo padrão, score fornecedor.",
    questions: [
      { id: 1, text: "O que dispara uma compra hoje e quem valida tecnicamente?", hint: "Proposta aprovada? Projeto? Pedido do líder? Quem confere especificação?" },
      { id: 2, text: "Quais campos mínimos para abrir uma solicitação de compra?", hint: "Item, especificação, quantidade, data necessidade, obra, centro de custo." },
      { id: 3, text: "Como vocês controlam lead time e itens críticos?", hint: "Planilha? Sistema? Memória? Existe plano B para itens longos?" },
      { id: 4, text: "Onde surgem urgências e quem paga a conta do frete extra?", hint: "Causa raiz da urgência: planejamento ruim, mudança de escopo, fornecedor atrasou?", tag: "brutal" },
      { id: 5, text: "Como é a homologação de fornecedores e critérios?", hint: "Existe processo? Critérios de entrada? Avaliação periódica?" },
      { id: 6, text: "Como funciona inspeção de recebimento e tratativa de divergência?", hint: "Quem confere? Contra o quê? O que acontece com item errado?" },
      { id: 7, text: "Quais itens deveriam estar em catálogo padrão com preço e fornecedor fixo?", hint: "Itens de alto giro que não precisam de cotação." },
      { id: 8, text: "IA: validações automáticas de especificação, versão, quantidade, custo alvo, e bloqueio de urgência sem motivo.", hint: "Regras objetivas que a IA pode checar antes de aprovar.", tag: "sistema" },
    ],
  },
  {
    id: "producao",
    name: "Produção",
    icon: "🏭",
    subtitle: "Fábrica — revestimento e marcenaria",
    toolSummary: "Ordem de produção com checklist QA, fila por prioridade e data de necessidade, rastreio por lote/ambiente.",
    questions: [
      { id: 1, text: "Quais são os tipos de ordem de produção e gatilhos de entrada?", hint: "O que dispara uma OP? Pedido, projeto aprovado, compra liberada?" },
      { id: 2, text: "Como vocês garantem que produziram a versão correta (controle de versão)?", hint: "Numeração? Etiqueta? Conferência? Já produziram na versão errada?", tag: "processo" },
      { id: 3, text: "Quais são os gargalos por etapa (corte, usinagem, acabamento, cura, embalagem)?", hint: "Onde o fluxo para? O que limita capacidade?" },
      { id: 4, text: "Qual é o padrão de inspeção de qualidade fabril e liberação?", hint: "Checklist? Amostragem? Liberação formal? Quem assina?" },
      { id: 5, text: "Como vocês registram retrabalho fabril e suas causas?", hint: "Existe registro? Classificação por causa? Ação corretiva?" },
      { id: 6, text: "Como vocês planejam capacidade vs demanda de obras?", hint: "Fila de produção vs data de necessidade. Existe visibilidade?" },
      { id: 7, text: "IA: previsão de carga, verificação de versão, checklist de liberação QA, alerta de atraso de lote.", hint: "O que a IA pode automatizar no chão de fábrica?", tag: "sistema" },
    ],
  },
  {
    id: "obras",
    name: "Obras",
    icon: "🔨",
    subtitle: "Execução, fiscalização, diário e gates",
    toolSummary: "Cronograma baseline, diário, checklists mestres, tickets de bloqueio/NC/mudança, score semanal por obra.",
    questions: [
      { id: 1, text: "Como a obra nasce formalmente (kickoff) e o que é obrigatório?", hint: "Checklist de kickoff: projeto, material, equipe, acesso, cronograma." },
      { id: 2, text: "Quais são seus gates e critérios objetivos de aprovação?", hint: "Gate 0 a 4: quais existem? Quem aprova? O que precisa estar pronto?", tag: "governança" },
      { id: 3, text: "Qual o padrão mínimo de diário e fotos?", hint: "Campos obrigatórios, frequência, quem preenche, onde fica." },
      { id: 4, text: "Como vocês lidam com bloqueios e dependências do cliente?", hint: "Frente não liberada, base não pronta, acesso negado. O que fazem?" },
      { id: 5, text: "Como vocês abrem e fecham NCs e com que SLA?", hint: "Quem abre? Classificação? Quem valida correção? Tempo de resposta?" },
      { id: 6, text: "Como vocês registram mudanças e exigem aditivo?", hint: "Fluxo: pedido → impacto → aprovação → execução. Existe ou é verbal?" },
      { id: 7, text: "Quais são os 10 defeitos mais comuns por tipologia e como prevenir?", hint: "Piso, forro, deck, escada, marcenaria. Os que mais aparecem.", tag: "processo" },
      { id: 8, text: "IA: bloqueio sem frente liberada, cobrança de diário, alerta de atraso, checklist por etapa.", hint: "Automações que protegem qualidade e prazo.", tag: "sistema" },
    ],
  },
  {
    id: "produtividade",
    name: "Produtividade / PMO",
    icon: "📊",
    subtitle: "Planejamento, performance e war room",
    toolSummary: "Painel de controle de obras, score risco, alocação de equipes, calendário de frentes e gates.",
    questions: [
      { id: 1, text: "Qual é o método de planejamento semanal e quem participa?", hint: "Reunião? Frequência? Quem decide prioridade?" },
      { id: 2, text: "Como vocês medem produtividade por equipe e por obra?", hint: "m²/dia? Peças/dia? Frentes/semana? Existe indicador?" },
      { id: 3, text: "Quais são os 5 indicadores que antecipam obra em risco?", hint: "Leading indicators: diário sem preencher, NC aberta, atraso >X dias, etc.", tag: "maturidade" },
      { id: 4, text: "Como vocês fazem balanceamento de recursos entre obras?", hint: "Critério de alocação quando tem mais obra que equipe." },
      { id: 5, text: "Qual é o ritual de \"war room\" e critérios de entrada/saída?", hint: "Quando uma obra entra em war room? Quem participa? Quando sai?" },
      { id: 6, text: "IA: score de risco automático, sugestões de priorização, alertas de capacidade, geração de relatório semanal.", hint: "O que a IA pode calcular e reportar automaticamente?", tag: "sistema" },
    ],
  },
  {
    id: "atendimento",
    name: "Atendimento ao Cliente",
    icon: "🤝",
    subtitle: "Comunicação durante obra + pós-obra",
    toolSummary: "Log de comunicação por obra, fila de chamados com SLA, NPS, base de conhecimento.",
    questions: [
      { id: 1, text: "Quais são os momentos de comunicação obrigatória com o cliente/arquiteto?", hint: "Kickoff, semanal, gate, mudança, entrega. Quais existem hoje?" },
      { id: 2, text: "Qual é o template de atualização semanal e o que deve conter?", hint: "% avanço, fotos, próximos passos, bloqueios, decisões pendentes." },
      { id: 3, text: "Como vocês registram decisões e aprovações do cliente?", hint: "E-mail? WhatsApp? Sistema? Ou fica na conversa?", tag: "processo" },
      { id: 4, text: "Como vocês gerenciam reclamações e escalonamento?", hint: "Quem recebe? Em quanto tempo responde? Quando escalona para diretoria?" },
      { id: 5, text: "Pós-obra: SLA real, triagem, causas mais comuns, custo por chamado.", hint: "Primeiro retorno, visita, correção. Top 5 chamados e custo médio.", tag: "brutal" },
      { id: 6, text: "IA: assistente para triagem, cobrança de evidência, respostas padrão, alertas de risco de reputação.", hint: "O que a IA pode fazer para agilizar e padronizar atendimento?", tag: "sistema" },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    icon: "📣",
    subtitle: "Leads, autoridade, conteúdo e performance",
    toolSummary: "Funil de aquisição, dashboard de CAC e qualidade do lead, pipeline de conteúdo e aprovação.",
    questions: [
      { id: 1, text: "Quais são os objetivos do marketing hoje (leads, autoridade, parceiros, arquitetos)?", hint: "Prioridade clara: gerar lead? Construir marca? Relacionamento com arquitetos?" },
      { id: 2, text: "Como o lead é capturado e qual dado mínimo entra no CRM?", hint: "Formulário? WhatsApp? Ligação? O que chega e o que falta?" },
      { id: 3, text: "Como vocês medem qualidade do lead e feedback do comercial?", hint: "O comercial diz se o lead era bom? Existe loop de feedback?", tag: "processo" },
      { id: 4, text: "Quais campanhas trazem lead bom vs lead ruim?", hint: "Google, Instagram, indicação, evento. Qual converte mais?" },
      { id: 5, text: "Quais ativos precisam existir para suportar vendas premium (cases, prova, bastidores, processos)?", hint: "Fotos de obra, vídeos de processo, depoimentos, portfólio." },
      { id: 6, text: "IA: geração de briefing de campanha, análise de performance, produção de variações de criativo, roteiros, calendário.", hint: "O que a IA pode produzir para acelerar o marketing?", tag: "sistema" },
    ],
  },
  {
    id: "expedicao",
    name: "Expedição",
    icon: "📦",
    subtitle: "Separação, conferência, embalagem e entrega",
    toolSummary: "Picking list por obra/ambiente, checklist embalagem, OTIF, registro fotográfico.",
    questions: [
      { id: 1, text: "Como o pedido vira separação e expedição?", hint: "Gatilho: PO aprovada? Cronograma? Pedido do líder? Quem dispara?" },
      { id: 2, text: "Quais são os checkpoints de conferência e embalagem?", hint: "Picking list? Conferência dupla? Checklist de embalagem?" },
      { id: 3, text: "Quais são as causas de erro de expedição (item errado, falta, avaria)?", hint: "Top 5 erros reais e por que acontecem.", tag: "brutal" },
      { id: 4, text: "Como vocês garantem rastreio por obra e por ambiente?", hint: "Etiqueta? Lote? Separação por ambiente? Mapa de montagem?" },
      { id: 5, text: "Como vocês registram evidência de expedição e recebimento?", hint: "Foto? Check? Assinatura? Canhoto?" },
      { id: 6, text: "IA: validação de picking list, conferência de itens críticos, alertas de janela de entrega.", hint: "Validações automáticas antes de liberar expedição.", tag: "sistema" },
    ],
  },
  {
    id: "fiscal",
    name: "Fiscal",
    icon: "📑",
    subtitle: "Notas, impostos e contabilidade",
    toolSummary: "Checklist fiscal por tipo de operação, fila de emissão com SLA, integração com pedidos e expedição.",
    questions: [
      { id: 1, text: "Quais documentos travam emissão de nota e por quê?", hint: "Cadastro incompleto, CFOP errado, falta de pedido, etc." },
      { id: 2, text: "Como é o fluxo pedido → faturamento → nota → entrega?", hint: "Passo a passo real. Onde trava?" },
      { id: 3, text: "Quais erros mais comuns de NCM, CFOP, impostos, e como prevenir?", hint: "Top 5 erros fiscais e causa raiz.", tag: "processo" },
      { id: 4, text: "Como vocês tratam devolução, remessa, industrialização, garantia?", hint: "Fluxo por tipo de operação." },
      { id: 5, text: "Qual é o SLA de emissão de nota e quem depende disso?", hint: "Expedição espera nota? Obra espera remessa? Quem trava?" },
      { id: 6, text: "IA: validação de campos, checklist de documentação, alertas de inconsistência.", hint: "Regras objetivas de conferência fiscal automatizável.", tag: "sistema" },
    ],
  },
  {
    id: "fornecedores",
    name: "Gestão de Fornecedores",
    icon: "🏪",
    subtitle: "Homologação, score, contratos e QBR",
    toolSummary: "Cadastro e homologação, scorecard, QBR, registro de incidentes por fornecedor.",
    questions: [
      { id: 1, text: "Quais categorias de fornecedor existem e quais são críticos?", hint: "Madeira, ferragens, acabamentos, MO, logística. Quais param a operação?" },
      { id: 2, text: "Como vocês homologam e deshomologam fornecedores?", hint: "Critérios de entrada, período de teste, critérios de saída." },
      { id: 3, text: "Qual score de fornecedor (qualidade, prazo, avaria, retrabalho, atendimento)?", hint: "Existe avaliação formal? Com que frequência? Quem avalia?", tag: "maturidade" },
      { id: 4, text: "Como vocês tratam não conformidade do fornecedor?", hint: "Registro? Comunicação? Penalidade? Troca?" },
      { id: 5, text: "Quais contratos e SLAs existem e quais deveriam existir?", hint: "O que está formalizado vs o que é acordo verbal?" },
      { id: 6, text: "IA: score automático, detecção de recorrência, alertas de risco, geração de QBR mensal.", hint: "Automação de avaliação e reporting de fornecedor.", tag: "sistema" },
    ],
  },
  {
    id: "importacao",
    name: "Importação",
    icon: "🚢",
    subtitle: "Pipeline de embarque, documentação e lead time",
    toolSummary: "Pipeline de importação por embarque, checklist documental, dashboard de lead time e custo total, histórico por fornecedor.",
    questions: [
      { id: 1, text: "Quais itens vocês importam e quais riscos por item (prazo, qualidade, documentação)?", hint: "Lista de itens importados e seus pontos de atenção." },
      { id: 2, text: "Como nasce uma importação: demanda, especificação, Incoterm, pagamento, inspeção, embarque?", hint: "Fluxo real passo a passo." },
      { id: 3, text: "Quais documentos são críticos e onde falham (invoice, packing, BL/AWB, certificado, origem)?", hint: "Documentos que travam desembaraço. Onde mais dá erro?", tag: "processo" },
      { id: 4, text: "Como vocês controlam lead time total e marcos (produção, porto, trânsito, desembaraço)?", hint: "Timeline por embarque? Alertas por marco? Ou só no susto?" },
      { id: 5, text: "Qual é o custo real de urgência (aéreo, armazenagem, demurrage) e por que acontece?", hint: "R$ por mês. Causa raiz: planejamento? Fornecedor? Documentação?", tag: "brutal" },
      { id: 6, text: "IA: checklist documental, timeline automática, alerta de marcos, comparação de fornecedores, detecção de risco de atraso.", hint: "Automação de monitoramento e prevenção.", tag: "sistema" },
    ],
  },
  {
    id: "logistica",
    name: "Logística",
    icon: "🚚",
    subtitle: "Planejamento, transporte e entrega",
    toolSummary: "Dashboard de lead time, rotas otimizadas, checklist de embarque, score de fornecedores de transporte.",
    questions: [
      { id: 1, text: "Como vocês planejam e otimizam rotas de transporte?", hint: "Software de roteirização? Manual? Existe otimização?" },
      { id: 2, text: "Quais são os principais fornecedores de transporte e critérios de escolha?", hint: "Preço, qualidade, prazo, capacidade. Quem decide?" },
      { id: 3, text: "Quais são os 5 principais riscos de transporte e como prevenir?", hint: "Atraso, avaria, perda, demurrage, custo. Causa raiz e solução.", tag: "brutal" },
      { id: 4, text: "Como vocês garantem rastreio e segurança do frete?", hint: "Etiqueta? GPS? Seguro? Comunicação com fornecedor?" },
      { id: 5, text: "Qual é o SLA de entrega e quem depende disso?", hint: "Expedição espera entrega? Obra espera material? Quem trava?" },
      { id: 6, text: "IA: otimização de rotas, validação de documentos, alertas de atraso, score de fornecedores, geração de relatório semanal.", hint: "Automação de planejamento e monitoramento de transporte.", tag: "sistema" },
    ],
  },
  {
    id: "projetos",
    name: "Projetos (Executivo)",
    icon: "📐",
    subtitle: "Projeto executivo, detalhamento, compatibilização e aprovação",
    toolSummary: "Workflow: briefing → levantamento → estudo preliminar → executivo → detalhamento → aprovação → liberação. Controle de versão, checklist de entrega por tipologia, log de revisões.",
    questions: [
      { id: 1, text: "Como nasce a demanda de projeto executivo? O que dispara e o que vem junto do comercial?", hint: "Proposta aprovada? Contrato? Pedido verbal? Quais informações chegam e quais FALTAM para começar?", tag: "processo" },
      { id: 2, text: "Quais são os 10 campos OBRIGATÓRIOS do briefing para começar o projeto sem retrabalho?", hint: "Metragem por ambiente, tipologia por ambiente, produto definido, base/contrapiso, acesso, alturas, pontos de elétrica/hidráulica, referências do arquiteto, prazo, premissas." },
      { id: 3, text: "Qual é o fluxo real do projeto executivo em 8-12 passos?", hint: "Briefing → levantamento/medição → estudo preliminar → aprovação interna → detalhamento → compatibilização → aprovação cliente/arquiteto → liberação para compras/produ��ão.", tag: "processo" },
      { id: 4, text: "Como vocês fazem levantamento e medição? Quem vai? Qual checklist? Como registra?", hint: "Trena? Laser? Quem confere? Existe checklist de medição? Já errou e produziu na medida errada?" },
      { id: 5, text: "Quais são os 5 defeitos IMPERDOÁVEIS do projeto (que geram retrabalho em produção ou obra)?", hint: "Medida errada, produto errado, paginação impossível, incompatibilidade com base, detalhe faltando para produção.", tag: "brutal" },
      { id: 6, text: "Como vocês garantem CONTROLE DE VERSÃO? Já produziram/instalaram na versão errada?", hint: "Nomenclatura de arquivo? Sistema? E-mail com versão? Como a produção sabe que tem a versão final?", tag: "brutal" },
      { id: 7, text: "Qual é o detalhamento necessário por TIPOLOGIA (piso, forro, deck, escada, marcenaria)?", hint: "Piso: paginação, junta, sentido, soleira. Forro: modulação, luminárias, recortes. Escada: espelho, bocel, corrimão. Marc: elevações, ferragens, acabamentos." },
      { id: 8, text: "Como funciona a compatibilização com outros projetos (arquitetura, elétrica, hidráulica, ar-condicionado)?", hint: "Quem confere interferências? Existe reunião de compatibilização? Já teve problema por falta de compatibilização?", tag: "processo" },
      { id: 9, text: "Qual é o fluxo de APROVAÇÃO (interna → cliente → arquiteto) e onde trava?", hint: "Quem aprova internamente? Como manda para o cliente? Quanto tempo leva retorno? O que acontece quando o arquiteto muda tudo?", tag: "governança" },
      { id: 10, text: "O que muda no projeto durante a obra e como vocês registram revisões?", hint: "Mudança de escopo, adaptação de campo, decisão do cliente in loco. Fluxo: quem pede → quem avalia impacto → quem aprova → quem atualiza projeto?", tag: "processo" },
      { id: 11, text: "Quais informações o projeto precisa entregar para COMPRAS (lista de materiais/quantitativos)?", hint: "Lista de materiais com especificação, quantidade, unidade, tolerância de perda. Compras recebe isso pronto ou precisa interpretar?", tag: "processo" },
      { id: 12, text: "Quais informações o projeto precisa entregar para PRODUÇÃO (detalhamento de fabricação)?", hint: "Plano de corte, modulação, acabamentos, ferragens, dimensões exatas. O que falta e gera retrabalho na fábrica?" },
      { id: 13, text: "Quais informações o projeto precisa entregar para OBRAS (detalhamento de instalação)?", hint: "Paginação com cotas, sentido de instalação, detalhes de arremate, sequência de ambientes, pontos de atenção." },
      { id: 14, text: "Qual é o SLA por tipo de projeto (piso simples vs marcenaria complexa vs obra mista)?", hint: "Quanto tempo leva de briefing a projeto liberado? Varia por complexidade? Existe meta de prazo?", tag: "maturidade" },
      { id: 15, text: "Quais são as 3 principais causas de RETRABALHO no projeto?", hint: "Informação que mudou, medida errada, falta de detalhe, cliente mudou de ideia, arquiteto não validou. Causa raiz.", tag: "brutal" },
      { id: 16, text: "Quais são as 3 principais causas de ATRASO no projeto?", hint: "Falta de definição do cliente, sobrecarga da equipe, dependência de medição, mudança de escopo, aprovação lenta." },
      { id: 17, text: "Como vocês lidam com mudanças de escopo DURANTE o projeto?", hint: "Cliente muda produto, arquiteto muda layout, obra descobre problema. Fluxo de change request existe?", tag: "governança" },
      { id: 18, text: "Qual é o handoff PERFEITO de Projetos → Compras, Projetos → Produção, Projetos → Obras?", hint: "O que cada área precisa receber do projeto para começar sem perguntas? Liste por destino." },
      { id: 19, text: "Quais ferramentas vocês usam (CAD, 3D, planilhas, ERP) e quais gaps existem?", hint: "AutoCAD? SketchUp? Revit? Planilha de quantitativos? O que falta para ser mais rápido e preciso?", tag: "maturidade" },
      { id: 20, text: "IA: o agente deve validar o quê antes de liberar projeto para compras/produção/obra?", hint: "Checklist de campos obrigatórios, versão aprovada, compatibilização feita, quantitativos conferidos, aprovação registrada.", tag: "sistema" },
    ],
  },
  {
    id: "rh",
    name: "Recursos Humanos",
    icon: "👥",
    subtitle: "Contratação, treinamento, benefícios e desenvolvimento",
    toolSummary: "Processo de contratação, treinamento inicial e contínuo, benefícios, avaliação de desempenho, desenvolvimento de carreira.",
    questions: [
      { id: 1, text: "Qual é o processo de contratação de novos funcionários?", hint: "Anúncio, seleção, entrevista, teste, oferta de emprego." },
      { id: 2, text: "Quais são os principais requisitos para cada cargo?", hint: "Habilidades técnicas, experiência, educação, soft skills." },
      { id: 3, text: "Como vocês fazem treinamento inicial e contínuo?", hint: "Cursos internos, externos, mentoria, workshops." },
      { id: 4, text: "Quais são os benefícios oferecidos aos funcionários?", hint: "Salário, PLR, vale-refeição, plano de saúde, férias." },
      { id: 5, text: "Como é o processo de avaliação de desempenho?", hint: "Frequência, critérios, feedback, metas." },
      { id: 6, text: "Quais são as oportunidades de desenvolvimento de carreira?", hint: "Promoções, treinamentos, cursos, mentoria." },
      { id: 7, text: "Como vocês lidam com reclamações e feedback dos funcionários?", hint: "Canal aberto, investigação, solução, acompanhamento." },
      { id: 8, text: "IA: validação de requisitos de cargo, automação de treinamento, alertas de avaliação de desempenho, geração de relatório de desenvolvimento.", hint: "O que a IA pode automatizar no RH?", tag: "sistema" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   PERGUNTAS DE DESIGN DO AGENTE IA (8 por área)
   ═══════════════════════════════════════════════════════════ */

export const aiAgentQuestions: AIQuestion[] = [
  { id: 1, text: "Quais são os 3 \"gates\" que a IA deve proteger?", hint: "Pontos onde a IA bloqueia avanço sem critério cumprido." },
  { id: 2, text: "Quais campos são obrigatórios para o processo avançar?", hint: "Lista de campos que, se vazios, travam o fluxo." },
  { id: 3, text: "Quais 10 validações a IA consegue fazer por regra (sem opinião)?", hint: "Regras binárias: se X, então Y. Sem julgamento humano." },
  { id: 4, text: "Quais 5 alertas ela deve emitir (para quem, quando, por quê)?", hint: "Destinatário + gatilho + ação esperada." },
  { id: 5, text: "Quais 3 documentos ela deve gerar automaticamente (templates preenchidos)?", hint: "Templates que hoje alguém preenche manual." },
  { id: 6, text: "Quando a IA deve bloquear e quando só avisar?", hint: "Bloquear = impedir avanço. Avisar = alerta sem travar." },
  { id: 7, text: "Quais métricas o agente deve reportar semanalmente?", hint: "Report automático semanal. Quais números?" },
  { id: 8, text: "Qual amostra de auditoria humana valida se a IA está certa?", hint: "Ex: conferir 5% das validações por semana." },
];

/* ═══════════════════════════════════════════════════════════
   ENTREGAS OBRIGATÓRIAS POR ENTREVISTA
   ═══════════════════════════════════════════════════════════ */

export const deliveryItems: DeliveryItem[] = [
  { id: "d1", label: "Mapa de Fluxo", hint: "Processo real em 8-12 passos com gates, decisões e handoffs marcados." },
  { id: "d2", label: "Lista de Handoffs", hint: "Origem → destino → pacote mínimo → SLA → evidência. Top 5 da área." },
  { id: "d3", label: "Checklist de Entrada", hint: "O que precisa existir para a área começar a trabalhar. Campos obrigatórios." },
  { id: "d4", label: "Checklist de Saída", hint: "O que precisa existir para a área entregar para a próxima. Definição de pronto." },
  { id: "d5", label: "SLAs Definidos", hint: "Tempo de resposta e tempo de execução por tipo de demanda." },
  { id: "d6", label: "5 Métricas da Área", hint: "2 leading (antecipam problema) + 3 lagging (resultado final)." },
  { id: "d7", label: "10 Exceções Mapeadas", hint: "As 10 exceções mais frequentes com regra de tratamento." },
  { id: "d8", label: "Proposta de Agente IA", hint: "3 gates + 10 validações + 5 alertas + 3 templates + regras de bloqueio." },
];

/* ═══════════════════════════════════════════════════════════
   CONTADORES
   ═══════════════════════════════════════════════════════════ */

export const UNIVERSAL_COUNT = 40;
export const AI_AGENT_COUNT = 8;
export const DELIVERY_COUNT = 8;