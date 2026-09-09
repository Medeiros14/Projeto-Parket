import { type SlideData } from "./slides-data";
import parketHerringbone from "figma:asset/b9bdf6119029ab1e402ac73b9a4bf22363cd3ff6.png";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";
import parketCurvedShelving from "figma:asset/599bac592a9aaa0e1b24504b427fc642dc39a574.png";
import parketWoodInterior from "figma:asset/e602455ef9adc036da056c804817732f86ab9037.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";
import parketLatticeLiving from "figma:asset/34ef7cbd988ad5d042ed3fc1f86d054998bbf494.png";
import parketInterior from "figma:asset/8895fbbf8e799621eb29613c0c646fae87caae91.png";

export const metricasSlides: SlideData[] = [

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1 — INTRODUÇÃO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  // 1. Capa
  {
    type: "cover",
    props: {
      title: "Funil, Métricas\n& Rotinas",
      subtitle: "O painel de controle da máquina comercial",
      image: parketLatticeLiving,
    },
  },

  // 2. Statement
  {
    type: "statement",
    props: {
      statement: "Se você não pode medir, não pode gerenciar. Se não pode gerenciar, não pode melhorar. E se não pode melhorar, o concorrente vai te engolir.",
      label: "Princípio Fundamental",
      attribution: "Máquina de Vendas Parket",
    },
  },

  // 3. Content — O sistema
  {
    type: "content",
    props: {
      title: "Por Que Métricas\n& Rotinas?",
      label: "O Sistema",
      highlight: "Vendedor estrela ganha jogos. Processo ganha campeonatos. Métricas e rotinas são o que transformam um time de talentos individuais numa máquina previsível de receita.",
      items: [
        "Previsibilidade: com métricas, você sabe hoje quanto vai vender daqui a 60 dias",
        "Diagnóstico rápido: se o resultado cai, os números mostram ONDE o problema está",
        "Meritocracia real: números eliminam achismos. Quem performa, aparece",
        "Escala: um processo medido pode ser replicado. Um 'feeling' não pode",
        "Independência de pessoas: quando o processo é rei, ninguém é insubstituível",
        "Cultura de alta performance: o que é medido é melhorado. O que é melhorado, gera resultado",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 2 — O FUNIL PARKET (8 slides)
  // ═══════════════════════════════════════════════════════════════

  // 4. Section
  {
    type: "section",
    props: {
      block: "Bloco 01",
      title: "O Funil\nParket",
      subtitle: "6 etapas. Critérios claros de entrada e saída. Nenhum lead se perde no meio do caminho.",
    },
  },

  // 5. Funnel visual
  {
    type: "funnel",
    props: {
      title: "Visão Geral\ndo Funil",
      label: "6 Etapas",
      stages: [
        { name: "Prospecção", description: "Identificar e contatar leads qualificados", percentage: "100%" },
        { name: "Qualificação", description: "Confirmar perfil, necessidade e timing", percentage: "60%" },
        { name: "Reunião / Visita", description: "Showroom, visita técnica ou call consultiva", percentage: "35%" },
        { name: "Proposta", description: "Proposta técnica + comercial personalizada", percentage: "20%" },
        { name: "Negociação", description: "Ajustes, objeções, aprovação final", percentage: "12%" },
        { name: "Fechamento", description: "Contrato assinado, projeto inicia", percentage: "8%" },
      ],
    },
  },

  // 6. Etapa 1 — Prospecção
  {
    type: "content",
    props: {
      title: "Etapa 1:\nProspecção",
      label: "Funil Parket",
      highlight: "O topo do funil determina tudo. Se prospectamos errado, o funil inteiro sofre. Qualidade > Quantidade.",
      items: [
        "Critério de entrada: lead identificado por qualquer fonte (inbound, outbound, indicação, arquiteto)",
        "Critério de saída: primeiro contato realizado + lead respondeu (move para Qualificação) OU cadência completa sem resposta (move para Nurturing)",
        "Responsável: BDR (outbound) e SDR (inbound)",
        "Tempo máximo nessa etapa: 21 dias (cadência outbound) ou 7 dias (cadência inbound)",
        "KPI chave: Taxa de Conexão — % de leads que responderam",
        "Meta: mínimo 50 novos leads na prospecção por semana por BDR/SDR",
      ],
    },
  },

  // 7. Etapa 2 — Qualificação
  {
    type: "content",
    props: {
      title: "Etapa 2:\nQualificação",
      label: "Funil Parket",
      highlight: "Qualificar é decidir se vale investir tempo. É aqui que separamos curiosos de compradores reais.",
      items: [
        "Critério de entrada: lead respondeu e demonstrou interesse mínimo",
        "O que validar: BANT — Budget (tem orçamento?), Authority (decide?), Need (precisa agora?), Timeline (quando?)",
        "Perguntas-chave: 'Já tem arquiteto?', 'Qual a metragem?', 'Qual o prazo da obra?', 'Já visitou algum concorrente?'",
        "Critério de saída: lead qualificado (move para Reunião) OU desqualificado (move para Nurturing com motivo)",
        "Responsável: SDR (qualifica e passa para Closer) ou Closer (se veio direto)",
        "Tempo máximo: 5 dias úteis. Lead qualificado parado = oportunidade morrendo",
        "KPI chave: Taxa de Qualificação — % dos conectados que passam para Reunião",
      ],
    },
  },

  // 8. Etapa 3 — Reunião / Visita
  {
    type: "split",
    props: {
      title: "Etapa 3:\nReunião / Visita",
      label: "Funil Parket",
      image: parketWoodInterior,
      content: "Este é o momento da verdade. O showroom é nossa arma mais poderosa — é aqui que o lead pisa na madeira, sente a diferença e se apaixona.",
      items: [
        "Critério de entrada: lead qualificado com reunião agendada",
        "Formatos: visita ao showroom (ideal), visita à obra do lead, call consultiva (remoto)",
        "Preparação: pesquisar projeto, separar amostras, preparar portfólio de referência",
        "Objetivo: entender profundamente o projeto e posicionar a Parket como a única escolha",
        "Critério de saída: lead pede proposta (move para Proposta) OU não avança (motivo + nurturing)",
        "KPI chave: Taxa de Proposta — % das reuniões que geram pedido de proposta",
      ],
    },
  },

  // 9. Etapa 4 — Proposta
  {
    type: "content",
    props: {
      title: "Etapa 4:\nProposta",
      label: "Funil Parket",
      highlight: "A proposta não é um orçamento — é um documento de valor que traduz o sonho do cliente em realidade tangível.",
      items: [
        "Critério de entrada: lead solicitou proposta após reunião/visita",
        "Tempo para envio: máximo 48h após a reunião. Cada dia de atraso = 10% menos chance de fechar",
        "O que deve conter: escopo técnico, materiais especificados, imagens de referência, prazo, investimento, condições",
        "Apresentação: NUNCA envie proposta por e-mail sem apresentar antes (call ou presencial)",
        "Critério de saída: lead aceita (Negociação) OU pede ajustes (continua em Proposta) OU recusa (motivo + nurturing)",
        "KPI chave: Tempo de Proposta — dias entre pedido e envio da proposta",
        "Meta: 100% das propostas enviadas em até 48h",
      ],
    },
  },

  // 10. Etapa 5 — Negociação
  {
    type: "content",
    props: {
      title: "Etapa 5:\nNegociação",
      label: "Funil Parket",
      highlight: "Negociar não é dar desconto. É alinhar expectativas, resolver objeções finais e facilitar a decisão.",
      items: [
        "Critério de entrada: lead recebeu proposta e está em análise/discussão",
        "Objeções típicas: preço (use Mapa de Objeções), prazo, comparação com concorrentes, decisão compartilhada",
        "Regra de desconto: máximo 5% com aprovação do gestor. Acima disso, somente diretoria",
        "Alternativa ao desconto: parcelar diferente, incluir serviço adicional, antecipar entrega",
        "Critério de saída: contrato assinado (Fechamento) OU perdida (motivo detalhado + aprendizado)",
        "Tempo máximo: 15 dias úteis. Negociação que passa de 30 dias morre em 70% dos casos",
        "KPI chave: Win Rate — % das propostas que viram contrato",
      ],
    },
  },

  // 11. Etapa 6 — Fechamento
  {
    type: "content",
    props: {
      title: "Etapa 6:\nFechamento",
      label: "Funil Parket",
      highlight: "Fechou o contrato? O trabalho de vendas NÃO acabou. O pós-venda é onde nasce a próxima venda e a indicação.",
      items: [
        "Critério de entrada: contrato assinado e pagamento inicial confirmado",
        "Handoff operacional: documento completo para equipe de projeto/instalação — briefing, prazos, especificações",
        "Comunicação pós-venda: atualizar o cliente sobre status da produção a cada 15 dias",
        "NPS: enviar pesquisa de satisfação 30 dias após instalação concluída",
        "Pedido de indicação: 'Se ficou satisfeito, adoraríamos atender alguém do seu círculo' — timing = 7 dias após elogio",
        "Celebrar: compartilhar a venda com o time. Vitória coletiva reforça a cultura",
        "KPI chave: NPS + Indicações geradas por cliente fechado",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 3 — KPIS POR PAPEL (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 12. Section
  {
    type: "section",
    props: {
      block: "Bloco 02",
      title: "KPIs\npor Papel",
      subtitle: "Cada posição tem números claros. Sem ambiguidade. Sem desculpa.",
    },
  },

  // 13. Metrics — BDR
  {
    type: "metrics",
    props: {
      title: "KPIs do BDR",
      label: "Business Development",
      metrics: [
        { value: "200+", label: "Contatos/mês", description: "Novos leads inseridos na cadência outbound" },
        { value: "25%", label: "Taxa Conexão", description: "Leads que responderam em qualquer canal" },
        { value: "40", label: "Reuniões/mês", description: "Qualificados passados para Closer" },
        { value: "85%", label: "Cadência Completa", description: "Leads que receberam todos os toques" },
        { value: "<24h", label: "Tempo Follow-up", description: "Máximo entre um toque e o registro no CRM" },
        { value: "100%", label: "CRM Compliance", description: "Todos os campos obrigatórios preenchidos" },
      ],
    },
  },

  // 14. Metrics — SDR
  {
    type: "metrics",
    props: {
      title: "KPIs do SDR",
      label: "Sales Development",
      metrics: [
        { value: "<5m", label: "Tempo Resposta", description: "Lead inbound respondido em até 5 minutos" },
        { value: "70%", label: "Taxa Conexão", description: "Inbound tem conversão muito maior" },
        { value: "50%", label: "Taxa Agendamento", description: "Conectados que agendam visita/reunião" },
        { value: "30+", label: "Reuniões/mês", description: "Qualificados agendados para Closer" },
        { value: "90%", label: "No-show < 15%", description: "Confirmação ativa reduz no-show" },
        { value: "100%", label: "Cadência Completa", description: "Nenhum lead inbound abandonado" },
      ],
    },
  },

  // 15. Metrics — Closer
  {
    type: "metrics",
    props: {
      title: "KPIs do Closer",
      label: "Executivo de Vendas",
      metrics: [
        { value: "30%", label: "Win Rate", description: "Propostas enviadas que viram contrato" },
        { value: "<48h", label: "Tempo Proposta", description: "Da reunião ao envio da proposta" },
        { value: "R$__", label: "Ticket Médio", description: "Valor médio por contrato fechado" },
        { value: "60d", label: "Ciclo de Venda", description: "Dias médios do primeiro contato ao contrato" },
        { value: "R$__", label: "Pipeline Valor", description: "Valor total das oportunidades ativas" },
        { value: "3+", label: "Indicações/mês", description: "Novas indicações geradas por cliente" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 4 — ROTINAS (7 slides)
  // ═══════════════════════════════════════════════════════════════

  // 16. Section
  {
    type: "section",
    props: {
      block: "Bloco 03",
      title: "Rotinas\nComerciais",
      subtitle: "Rituais diários, semanais e mensais que transformam intenção em execução. Sem rotina, não há máquina.",
    },
  },

  // 17. Process — Rotina Diária
  {
    type: "process",
    props: {
      title: "Rotina Diária\ndo Vendedor",
      label: "Todos os Dias, Sem Exceção",
      steps: [
        { number: "08:30", title: "Daily Standup (15 min)", description: "Em pé. Cada um diz: O que fiz ontem? O que faço hoje? Algum impedimento? Sem enrolação." },
        { number: "09:00", title: "Bloco de Prospecção (2h)", description: "Ligações, WhatsApp, e-mails. Cadências do dia. Essa é a hora MAIS PRODUTIVA. Celular no silencioso." },
        { number: "11:00", title: "Atender Inbound", description: "Responder novos leads que chegaram. Prioridade máxima. Menos de 5 minutos." },
        { number: "11:30", title: "Follow-ups & Propostas", description: "Enviar propostas pendentes, fazer follow-ups em negociações ativas." },
        { number: "14:00", title: "Reuniões & Visitas", description: "Período reservado para showroom, visitas técnicas, calls consultivas." },
        { number: "17:00", title: "CRM & Planejamento (30 min)", description: "Atualizar CRM. Registrar tudo. Preparar cadências de amanhã. Fechar o dia limpo." },
      ],
    },
  },

  // 18. Process — Rotina Semanal
  {
    type: "process",
    props: {
      title: "Rotina Semanal\ndo Time",
      label: "Ritmo de Gestão",
      steps: [
        { number: "SEG", title: "Segunda — Planning", description: "Revisão de pipeline individual. Definir metas da semana. Quais deals priorizar?" },
        { number: "QUA", title: "Quarta — Pipeline Review", description: "Gestor revisa cada oportunidade ativa com o Closer. Deal por deal. Sem achismos." },
        { number: "QUI", title: "Quinta — Role Play (1h)", description: "Simulações de vendas, objeções, cold calls. Todo vendedor treina. Todo atleta treina." },
        { number: "SEX", title: "Sexta — Weekly Review", description: "Números da semana. O que funcionou? O que precisa mudar? Celebrar vitórias." },
      ],
    },
  },

  // 19. Process — Rotina Mensal
  {
    type: "process",
    props: {
      title: "Rotina Mensal\nEstratégica",
      label: "Ciclo de Melhoria",
      steps: [
        { number: "M01", title: "Fechamento do Mês", description: "Resultado vs. meta. Análise de cada KPI. Ranking de performance individual." },
        { number: "M05", title: "1:1 com Gestor", description: "Conversa individual. Feedback construtivo. Plano de desenvolvimento pessoal." },
        { number: "M10", title: "Análise de Pipeline", description: "Forecast do próximo mês. Oportunidades que vão fechar, quais precisam de push." },
        { number: "M15", title: "Review Estratégico", description: "O que funcionou esse mês? Quais cadências performaram melhor? Ajustar o processo." },
        { number: "M20", title: "Treinamento Mensal", description: "Tema definido pela análise do mês anterior. Produto, técnica, mercado." },
      ],
    },
  },

  // 20. Content — Daily Standup
  {
    type: "content",
    props: {
      title: "O Daily\nStandup",
      label: "O Ritual Mais Importante",
      highlight: "15 minutos. Em pé. Todo dia. Sem exceção. É o único ritual que, sozinho, já transforma a cultura do time.",
      items: [
        "Formato: cada pessoa fala no máximo 2 minutos. Gestor facilita. Sem discussões longas",
        "3 perguntas: (1) O que fiz ontem? (2) O que faço hoje? (3) Algum impedimento?",
        "Impedimento: se alguém trava, o gestor resolve DEPOIS do standup, não durante",
        "Transparência: todos ouvem todos. Quem está performando, inspira. Quem está travado, recebe ajuda",
        "Accountability: se disse que ia fazer e não fez, todo mundo sabe. Isso gera compromisso",
        "Energia: comece com uma vitória do dia anterior. Celebrar pequenos resultados mantém o moral alto",
        "Regra de ferro: se chegar atrasado no daily, perde a vez. Pontualidade é respeito ao time",
      ],
    },
  },

  // 21. Content — Weekly Pipeline Review
  {
    type: "content",
    props: {
      title: "Pipeline Review\nSemanal",
      label: "O Ritual do Gestor",
      highlight: "O gestor que não faz pipeline review semanal está gerenciando no escuro. Esse ritual é o farol do time.",
      items: [
        "Deal por deal: cada oportunidade ativa é revisada com o Closer. 'Qual o próximo passo? Quando? Com quem?'",
        "Stale deals: qualquer deal sem atividade há 5+ dias recebe alerta. 'O que está travando?'",
        "Forecast: classificar cada deal como Commit (90%), Best Case (50%) ou Pipeline (20%). Somar e comparar com meta",
        "Coaching ao vivo: o gestor ouve, questiona e sugere. 'Você já tentou...?' 'E se abordasse por...?'",
        "Higiene: deals mortos devem ser movidos para Perdidos com motivo. Pipeline limpo = previsão precisa",
        "Duração: 30-45 minutos. Objetivo: sair com ações claras para cada oportunidade",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 5 — CRM & PIPELINE (6 slides)
  // ═══════════════════════════════════════════════════════════════

  // 22. Section
  {
    type: "section",
    props: {
      block: "Bloco 04",
      title: "CRM &\nPipeline",
      subtitle: "O CRM não é burocracia — é a memória do time e o GPS da venda. Quem não registra, não gerencia.",
    },
  },

  // 23. Grid — Campos obrigatórios
  {
    type: "grid",
    props: {
      title: "Campos Obrigatórios\nno CRM",
      label: "Sem Esses, Não Existe Registro",
      columns: 2,
      cards: [
        { title: "Dados do Lead", description: "Nome, telefone, e-mail, cidade, bairro, origem (inbound/outbound/indicação).", icon: "01" },
        { title: "Projeto", description: "Tipo (residencial/comercial), metragem, produto (piso/painel/escada), estágio da obra.", icon: "02" },
        { title: "Qualificação", description: "Tem arquiteto? Orçamento estimado? Timeline? Quem decide? Visitou concorrente?", icon: "03" },
        { title: "Histórico", description: "Cada contato registrado com data, canal, resultado e próximo passo definido.", icon: "04" },
        { title: "Proposta", description: "Valor, data de envio, data de follow-up, status (enviada/apresentada/em negociação).", icon: "05" },
        { title: "Resultado", description: "Ganhou ou perdeu? Motivo detalhado. Valor final. Aprendizado para o time.", icon: "06" },
      ],
    },
  },

  // 24. TwoColumn — CRM bem feito vs. mal feito
  {
    type: "twocolumn",
    props: {
      title: "CRM Bem Feito\nvs. Mal Feito",
      label: "A Diferença é Abissal",
      leftTitle: "CRM Bem Feito",
      leftItems: [
        "Pipeline reflete a realidade — forecast preciso em 90%+",
        "Qualquer pessoa do time pode assumir um deal sem perder contexto",
        "Gestor identifica gargalos em 5 minutos olhando o dashboard",
        "Vendedor sai de férias e o deal continua andando",
        "Dados históricos permitem melhorar cadências, scripts e processo",
        "Meritocracia baseada em números — sem política, sem achismo",
      ],
      rightTitle: "CRM Mal Feito",
      rightItems: [
        "Pipeline é ficção — ninguém sabe o que vai fechar",
        "Se o vendedor sai, o cliente some junto. Zero continuidade",
        "Gestor só descobre problemas quando o resultado já despencou",
        "Vendedor guarda informação na cabeça — poder individual, fraqueza coletiva",
        "Sem dados históricos, cada mês começa do zero. Sem aprendizado",
        "Decisões baseadas em 'eu acho que...' em vez de 'os números mostram que...'",
      ],
    },
  },

  // 25. Content — Forecast
  {
    type: "content",
    props: {
      title: "Forecast:\nPrevisão de Receita",
      label: "O Superpoder do Gestor",
      highlight: "Forecast preciso é o que separa uma operação amadora de uma profissional. Com ele, você sabe hoje quanto vai faturar no mês que vem.",
      items: [
        "Commit (90%): contrato verbal fechado, aguardando assinatura. Só entra aqui se o lead CONFIRMOU que vai fechar",
        "Best Case (50%): proposta aceita em princípio, negociação ativa. Depende de alinhamento final",
        "Pipeline (20%): reunião realizada, proposta a enviar ou enviada, sem sinal claro de fechamento",
        "Upside (10%): oportunidades novas com potencial, mas ainda em qualificação. Não conta para meta",
        "Fórmula: Forecast = (Commit × 0.9) + (Best Case × 0.5) + (Pipeline × 0.2)",
        "Regra: forecast que erra mais de 20% por 2 meses consecutivos = processo quebrado. Investigar",
      ],
    },
  },

  // 26. Content — Higiene do CRM
  {
    type: "content",
    props: {
      title: "Higiene do\nPipeline",
      label: "Limpeza é Disciplina",
      highlight: "Um pipeline inflado dá falsa sensação de segurança. Pipeline limpo dói — mas é real. E real é o que gera resultado.",
      items: [
        "Deal sem atividade há 15 dias → contatar ou mover para Perdido. Não existe 'ele vai voltar'",
        "Deal sem próximo passo definido → definir AGORA ou mover para Perdido. Sem ação = sem deal",
        "Proposta sem follow-up há 7 dias → ligar HOJE. Proposta esquecida = venda perdida",
        "Lead que disse 'não' → mover para Perdido COM MOTIVO detalhado. Motivo alimenta aprendizado",
        "Pipeline ideal: 3x a meta em valor total. Menos que isso = risco. Mais que 5x = inflado",
        "Limpeza semanal: na sexta-feira, cada vendedor revisa seu pipeline e remove deals mortos",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 6 — BENCHMARKS & DIAGNÓSTICO (4 slides)
  // ═══════════════════════════════════════════════════════════════

  // 27. Section
  {
    type: "section",
    props: {
      block: "Bloco 05",
      title: "Benchmarks &\nDiagnóstico",
      subtitle: "Os números de referência e como diagnosticar problemas antes que eles matem o resultado.",
    },
  },

  // 28. Grid — Benchmarks
  {
    type: "grid",
    props: {
      title: "Benchmarks de\nConversão",
      label: "Referência Parket",
      columns: 2,
      cards: [
        { title: "Prospecção → Conexão", description: "Inbound: 70%+ | Outbound: 25%+ | Indicação: 85%+", icon: "%" },
        { title: "Conexão → Reunião", description: "50%+ dos leads conectados devem agendar reunião/visita", icon: "%" },
        { title: "Reunião → Proposta", description: "60%+ das reuniões devem gerar pedido de proposta", icon: "%" },
        { title: "Proposta → Fechamento", description: "Win Rate mínimo de 30%. Meta: 40%+", icon: "%" },
        { title: "Ciclo de Venda", description: "Residencial: 45-60 dias | Corporativo: 60-90 dias | Arquiteto: 90-180 dias", icon: "⏱" },
        { title: "No-show Rate", description: "Máximo 15%. Acima disso: melhorar confirmação e qualificação", icon: "!" },
      ],
    },
  },

  // 29. Content — Árvore de diagnóstico
  {
    type: "content",
    props: {
      title: "Árvore de\nDiagnóstico",
      label: "Quando o Resultado Cai, Siga o Mapa",
      highlight: "Resultado ruim nunca é mistério — é um sintoma. Siga a árvore e encontre a causa raiz.",
      items: [
        "Poucas reuniões? → Verifique: leads suficientes entrando? Cadências sendo executadas? Taxa de conexão OK?",
        "Muitas reuniões, poucas propostas? → Verifique: qualificação bem feita? Reunião bem conduzida? Seller está preparado?",
        "Muitas propostas, poucos fechamentos? → Verifique: proposta enviada rápido? Follow-up feito? Objeções tratadas? Preço competitivo?",
        "Ciclo longo demais? → Verifique: próximo passo definido? Decisor envolvido? Urgência criada? Há competidor?",
        "Pipeline inflado sem resultado? → Verifique: deals estão vivos de verdade? Próxima ação clara? Higiene sendo feita?",
        "Resultado bom de um e ruim de outro? → Verifique: o processo é o mesmo? O que o top performer faz diferente? Replicar",
      ],
    },
  },

  // 30. TwoColumn — Cultura de alta performance
  {
    type: "twocolumn",
    props: {
      title: "Cultura de\nAlta Performance",
      label: "O Intangível que Muda Tudo",
      leftTitle: "Time de Alta Performance",
      leftItems: [
        "Compete consigo mesmo — recorde pessoal é a meta real",
        "Números são públicos — transparência gera responsabilidade",
        "Celebra vitórias coletivas — gongo, ranking, reconhecimento",
        "Treina toda semana — role play não é castigo, é afiação",
        "Feedback é diário — não espera 1:1 mensal para falar",
        "Processo é lei — até o melhor vendedor segue a cadência",
      ],
      rightTitle: "Time Medíocre",
      rightItems: [
        "Faz o mínimo necessário — meta é teto, não piso",
        "Esconde resultados — medo de julgamento",
        "Cada um por si — zero colaboração, zero aprendizado",
        "Nunca treina — 'já sei vender, não preciso'",
        "Feedback só quando dá problema — cultura reativa",
        "Processo é sugestão — cada um faz do seu jeito",
      ],
    },
  },

  // 31. Statement final
  {
    type: "statement",
    props: {
      statement: "A diferença entre um time que bate meta e um que reza para bater não é talento — é processo, métrica e rotina. Monte o sistema, e o resultado vem.",
      label: "Verdade",
      attribution: "Máquina de Vendas Parket",
    },
  },

  // 32. Closing
  {
    type: "closing",
    props: {
      title: "Funil, Métricas\n& Rotinas",
      subtitle: "Meça tudo.\nGerencie por números.\nVença por processo.",
      image: parketDeckLake,
    },
  },
];
