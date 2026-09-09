/* ═══════════════════════════════════════════════════════════
   Mapeamento de Workflow Operacional — Roteiro de Workshop
   120 perguntas · 16 blocos · Revestimentos × Marcenaria
   + 7 diagnósticos finais
   Alinhado ao fluxo de 20 macroestados e jornada completa
   ═══════════════════════════════════════════════════════════ */

export interface WfQuestion {
  id: number;
  text: string;
  tag?: string;
  hint?: string;
  /** if true, only one answer (not split Rev/Marc) */
  single?: boolean;
}

export interface WfSection {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  questions: WfQuestion[];
}

export interface WfFinalItem {
  id: string;
  label: string;
  hint: string;
  /** true = single text field instead of Rev/Marc columns */
  single?: boolean;
}

/* ═══════════════════════════════════════════════════════════
   16 BLOCOS DE PERGUNTAS
   ═══════════════════════════════════════════════════════════ */

export const wfSections: WfSection[] = [
  /* ─── BLOCO 1 · 20 Macroestados e Arquitetura do Funil ─── */
  {
    id: "macroestados",
    number: 1,
    title: "20 Macroestados e Arquitetura do Funil",
    subtitle: "Cada obra em um único estado por vez — sem obra fantasma",
    icon: "🔄",
    questions: [
      {
        id: 1,
        text: "Dos 20 macroestados do funil (lead capturado → reciclagem comercial), quais vocês conseguem identificar hoje no sistema/planilha? Quais são invisíveis?",
        hint: "Liste os 20 estados e marque: ✅ rastreável · ⚠️ parcial · ❌ invisível.",
        single: true,
      },
      {
        id: 2,
        text: "Quantas obras hoje estão em mais de um estado ao mesmo tempo (\"obra fantasma\")?",
        hint: "Ex: está com contrato assinado MAS sem onboarding. Está em execução MAS sem projeto aprovado.",
        single: true,
        tag: "brutal",
      },
      {
        id: 3,
        text: "Quais das 8 garantias do sistema vocês cumprem consistentemente hoje?",
        hint: "1) Escopo coerente 2) Medição cedo 3) Exec. aprovado 4) Obra liberada 5) Material com prova 6) Controle diário 7) Aceite formal 8) Pós-venda gerando receita.",
        single: true,
      },
      {
        id: 4,
        text: "Para cada transição de estado, quem aprova e qual evidência marca a transição?",
        hint: "Ex: Estado 6→7: Talita aprova onboarding. Evidência: grupo criado + checklist enviado. Qual é a realidade hoje?",
      },
      {
        id: 5,
        text: "Onde hoje o estado da obra muda sem registro formal (avança no \"feeling\")?",
        hint: "Qual transição acontece sem aprovação explícita? Ex: obra \"liberada\" sem 2ª vistoria.",
        tag: "governança",
      },
      {
        id: 6,
        text: "Se implementássemos o funil de 20 estados amanhã, quais 5 transições mais dificilmente seriam respeitadas pelo time?",
        hint: "Onde a disciplina cultural precisa mudar mais para o sistema funcionar?",
        single: true,
        tag: "destrava",
      },
    ],
  },

  /* ─── BLOCO 2 · Prospecção e Entrada de Demanda ─── */
  {
    id: "prospeccao",
    number: 2,
    title: "Prospecção e Entrada de Demanda",
    subtitle: "Canais, CRM e o gate cultural: sem registro = não existe",
    icon: "📥",
    questions: [
      {
        id: 7,
        text: "Quais canais de entrada geram leads hoje? (Inbound, Outbound BDR, Relacionamento arquiteto/incorporador/indicação)",
        hint: "Para cada canal: volume mensal estimado, taxa de conversão, quem é responsável.",
        single: true,
      },
      {
        id: 8,
        text: "O gate cultural \"sem CRM preenchido, o lead não existe\" é respeitado hoje? Quantos leads vivem só no WhatsApp ou na cabeça de alguém?",
        hint: "Estimativa honesta: 10%? 30%? 50%? Mais?",
        single: true,
        tag: "brutal",
      },
      {
        id: 9,
        text: "Quais campos obrigatórios existem no CRM para um lead ser \"completo\"?",
        hint: "Origem, perfil, cidade/obra, tipo escopo (piso/forro/deck/marc), estágio, \"motivo do lead\" em 1 frase.",
      },
      {
        id: 10,
        text: "Quem tem autoridade para rejeitar lead incompleto e devolver ao comercial?",
        hint: "Alguém pode dizer \"volta e completa antes\"? Ou tudo segue do jeito que veio?",
        single: true,
        tag: "governança",
      },
      {
        id: 11,
        text: "Como funciona o follow-up quando não fecha no ato? Existe cadência padronizada (D+1, D+3, D+7, D+14, D+30)?",
        hint: "Cadência real vs cadência ideal. Motivo de não-fechamento é classificado no CRM?",
        single: true,
      },
      {
        id: 12,
        text: "Quantos leads \"mortos\" sem próxima ação existem no CRM hoje? São revisados?",
        hint: "Pipeline limpo = pipeline confiável. Pipeline sujo = falsa sensação de oportunidade.",
        single: true,
        tag: "brutal",
      },
    ],
  },

  /* ─── BLOCO 3 · Reunião de Escopo e Qualificação ─── */
  {
    id: "escopo",
    number: 3,
    title: "Reunião de Escopo e Qualificação",
    subtitle: "Consultivo, não orçamentário — definir o que é vendável",
    icon: "🎯",
    questions: [
      {
        id: 13,
        text: "O checklist de perguntas da reunião de escopo é seguido? (solução/ambiente, interno/externo, umidade, insolação, ar, automação, momento da obra, decisores, driver, data-alvo)",
        hint: "Existe checklist formal ou cada vendedor pergunta o que lembra?",
      },
      {
        id: 14,
        text: "Em marcenaria, a reunião de escopo funciona no modo \"Ornare\" (protótipo, exemplos, demonstração de valor) ou é proposta fria?",
        hint: "Experiência consultiva presencial vs PDF genérico.",
        single: true,
      },
      {
        id: 15,
        text: "Quem faz a validação técnica antes da proposta sair? (Levantamento, Projetos, Fábrica para marcenaria)",
        hint: "Time de levantamento analisa projeto + compatibiliza \"o que dá para vender\"? Ou orçam \"no escuro\"?",
      },
      {
        id: 16,
        text: "Para marcenaria: escopos críticos (fachada, portas especiais, pé-direito fora do padrão) passam por aval técnico de fábrica antes da proposta?",
        hint: "Marco Antônio ou direção de produção validam exequibilidade? Ou descobre na hora de produzir?",
        single: true,
        tag: "governança",
      },
      {
        id: 17,
        text: "A proposta calculada tem arquivo identificado (nome/versão) e lista de premissas (incluso, não incluso, condicional)?",
        hint: "Ou é proposta genérica que depois gera surpresa de aditivo?",
      },
      {
        id: 18,
        text: "Propostas são apresentadas no showroom (padrão) ou \"mandadas por PDF\"? Qual % é showroom vs PDF frio?",
        hint: "Apresentar = escopo + técnica + diferença Parket + risco + cronograma. Mandar PDF = commodity.",
        single: true,
      },
    ],
  },

  /* ─── BLOCO 4 · Contrato e Ativação ─── */
  {
    id: "contrato",
    number: 4,
    title: "Contrato, Ativação e Onboarding",
    subtitle: "Gate de ativação: 1ª parcela paga → Onboarding com governança",
    icon: "📋",
    questions: [
      {
        id: 19,
        text: "O fluxo Vendedor fecha → Carla valida (escopo executável, preço ok, produto em linha) → assinatura digital → 1ª parcela → ativa funciona assim hoje?",
        hint: "Onde esse fluxo quebra? O que Carla rejeita com mais frequência?",
        single: true,
      },
      {
        id: 20,
        text: "Quantas obras foram \"ativadas\" internamente ANTES da 1ª parcela ser paga nos últimos 90 dias?",
        hint: "O gate real (só ativa após pagamento) é respeitado? Ou já começa a trabalhar na esperança?",
        single: true,
        tag: "brutal",
      },
      {
        id: 21,
        text: "O onboarding de Talita segue checklist? (Dashboard, grupo com todos os stakeholders, boas-vindas com passo-a-passo, regra 2 vistorias, o que gera custo extra)",
        hint: "Qual % dos onboardings tem grupo completo + checklist + pasta organizada?",
        single: true,
      },
      {
        id: 22,
        text: "O grupo da obra tem todos os stakeholders? (cliente/engenharia/arq, vendedor, projetos, expedição, fiscal, Nat, marcenaria se aplicável)",
        hint: "Quem costuma ficar de fora? Consequência?",
        single: true,
      },
      {
        id: 23,
        text: "Para marcenaria: a mensagem de que \"prazo só começa após projeto aprovado + medição fina + amostras assinadas\" é comunicada formalmente no onboarding?",
        hint: "Se não comunicar aqui, a discussão de prazo vira guerra depois.",
        single: true,
        tag: "governança",
      },
      {
        id: 24,
        text: "Qual é o gap médio entre contrato assinado e onboarding completo (grupo + pasta + checklist)?",
        hint: "Dias? Semanas? O que causa atraso?",
        single: true,
      },
    ],
  },

  /* ─── BLOCO 5 · Pré-Projeto e 1ª Vistoria ─── */
  {
    id: "vistoria",
    number: 5,
    title: "Pré-Projeto e 1ª Vistoria",
    subtitle: "Tainara prepara, Fiscal executa — medir cedo = aditivo cedo",
    icon: "📐",
    questions: [
      {
        id: 25,
        text: "O pré-projeto que Tainara prepara cobre: sentido paginação/forro, alçapões, cortineiros, grelhas, automação/iluminação, encontros piso frio vs madeira, escada/rodapé invertido, recortes?",
        hint: "Quais itens costumam faltar no pré-projeto? Consequência em campo?",
      },
      {
        id: 26,
        text: "O gate \"fiscal só vai com pré-projeto em mãos\" é respeitado? Quantas vistorias aconteceram sem pré-projeto nos últimos 60 dias?",
        hint: "Sem pré-projeto = vistoria inútil = vistoria extra = custo + atraso.",
        tag: "brutal",
      },
      {
        id: 27,
        text: "Na 1ª vistoria, o fiscal verifica os 3 objetivos? (Metragem real vs projeto, condições/pré-requisitos, logística de entrega e armazenamento)",
        hint: "Contrapiso, obra fechada, gesso, batentes, elétrica, ar, pingadeiras, acesso, risco umidade.",
      },
      {
        id: 28,
        text: "Quando a metragem muda na 1ª vistoria, o aditivo é formalizado imediatamente ou \"fica para depois\"?",
        hint: "\"Aditivo cedo\" vs \"aditivo tarde\" muda tudo: margem, relação com cliente, paz operacional.",
        tag: "processo",
      },
      {
        id: 29,
        text: "Para marcenaria: Tainara checa prumo, requadro, padroniza vãos (evitar 89, 88, 87 aleatórios) e valida viabilidade real do vendido?",
        hint: "Se não padronizar vãos aqui, produz errado e retrabalho custa muito caro.",
        single: true,
      },
      {
        id: 30,
        text: "Para marcenaria: a reunião técnica gravada com arquitetura acontece antes da vistoria? (cava, maçaneta, fechadura, furação, ferragens, compatibilização)",
        hint: "Decisões que explodem depois precisam ser travadas e gravadas ANTES de ir à obra.",
        single: true,
        tag: "governança",
      },
      {
        id: 31,
        text: "O relatório da 1ª vistoria + pendências é postado no grupo E salvo na pasta da obra? Em quanto tempo após a visita?",
        hint: "Relatório no grupo = transparência. Salvo na pasta = rastreabilidade. Os dois precisam acontecer.",
      },
    ],
  },

  /* ─── BLOCO 6 · Compras, Produção e Kitagem ─── */
  {
    id: "compras",
    number: 6,
    title: "Compras, Produção e Kitagem",
    subtitle: "Receita de bolo, conferência e anti-desperdício",
    icon: "🚚",
    questions: [
      {
        id: 32,
        text: "A conferência vendido vs medido acontece antes de gerar a lista de insumos (\"receita de bolo\")? Quem faz essa conferência?",
        hint: "Se comprar baseado no vendido e não no medido, manda a mais ou a menos.",
      },
      {
        id: 33,
        text: "A regra \"nunca mandar a mais por vício — manda o necessário medido\" é cumprida? Se comprou 100 e precisa 80, manda 80 com lastro?",
        hint: "Medir, conferir, documentar. Excesso não é segurança, é desperdício.",
        tag: "brutal",
      },
      {
        id: 34,
        text: "Qual o fluxo de compras hoje? Estoque separa → falta compra nacional (Ronaldo) → importação (Pâmela)?",
        hint: "Quem decide o que comprar de cada fonte? SLA de cada etapa?",
        single: true,
      },
      {
        id: 35,
        text: "A expedição kit completo (piso + cola + barrote + parafuso) é separada por obra, conferida item a item e fotografada por Ailton?",
        hint: "Kit incompleto = obra parada = custo de equipe ociosa.",
        single: true,
      },
      {
        id: 36,
        text: "Para marcenaria: compras de matéria-prima crítica (lâmina, compensado) são antecipadas antes da validação final? Compra final só fecha após medição?",
        hint: "Antecipar grosso reduz risco de falta. Compra final sem validação gera desperdício.",
        single: true,
      },
      {
        id: 37,
        text: "Para marcenaria: a produção por item tem rastreabilidade? (ID único, timestamps por etapa: bancada → pintura → QC → embalagem → expedição)",
        hint: "Germano como auditor diário: passa nas bancadas, confere com trena, tira fotos, registra por item.",
        single: true,
        tag: "processo",
      },
    ],
  },

  /* ─── BLOCO 7 · Projeto Executivo e Liberação ─── */
  {
    id: "liberacao",
    number: 7,
    title: "Projeto Executivo e Liberação",
    subtitle: "2 gates obrigatórios para entrar na obra: exec. aprovado + 2ª vistoria",
    icon: "🔒",
    questions: [
      {
        id: 38,
        text: "O gate \"para entrar na obra: projeto executivo aprovado + liberação do fiscal\" é respeitado? Quantas obras entraram sem os dois nos últimos 90 dias?",
        hint: "Sem esses dois gates, a obra entra sem controle e surpresas aparecem tarde.",
        tag: "brutal",
      },
      {
        id: 39,
        text: "Para forro: a compatibilização com iluminação/ar/automação é feita antes da aprovação? Itens cobrados à parte (recortes, caixinhas, grelhas, alçapões) viram aditivo ANTES de produzir?",
        hint: "Aditivo de forro após material na obra = dor e desgaste irreversível.",
      },
      {
        id: 40,
        text: "Para marcenaria: a \"Ficha Parket de Marcenaria\" existe? (padrões de detalhamento, ferragens, folgas, tolerâncias, paginação, nomenclatura de itens)",
        hint: "Padroniza o lado Parket e força arquiteto a jogar no mesmo campo. Reduz ida e volta.",
        single: true,
      },
      {
        id: 41,
        text: "A pré-liberação (engenharia envia fotos + checklist) é filtrada pelo atendimento antes de agendar 2ª vistoria?",
        hint: "Talita filtra: evita deslocamento inútil do fiscal. Se não está pronto, não agenda.",
      },
      {
        id: 42,
        text: "Na 2ª vistoria, o fiscal verifica: umidade (higrômetro), laser de nível, andaime/caçamba (obra), armazenamento seco?",
        hint: "Cada item não verificado aqui vira problema em obra.",
      },
      {
        id: 43,
        text: "Quando a obra não passa na 2ª vistoria, existe a regra formal da 3ª ida (taxa ou vídeo/foto + termo de responsabilidade)?",
        hint: "Sem regra formal, engenharia empurra indefinidamente e Parket arca com o custo.",
        tag: "governança",
      },
      {
        id: 44,
        text: "Para marcenaria: a medição fina acontece com o responsável de produção/instalação junto (SP)? Dimensões são atualizadas item a item e reenviadas para aprovação?",
        hint: "Levar o responsável antecipa risco de montagem e reduz surpresa.",
        single: true,
      },
      {
        id: 45,
        text: "Para marcenaria: amostras de lâmina/cor/acabamento são assinadas pelo cliente antes de produzir? Sem assinatura = não produz?",
        hint: "Isso mata 80% das brigas de expectativa. É regra de ouro.",
        single: true,
        tag: "governança",
      },
    ],
  },

  /* ─── BLOCO 8 · Entrega de Material ─── */
  {
    id: "entrega_material",
    number: 8,
    title: "Entrega de Material",
    subtitle: "Rastreabilidade: fotos saindo, fotos chegando, aceite com evidência",
    icon: "📦",
    questions: [
      {
        id: 46,
        text: "O agendamento de entrega segue a regra: confirmação 1 semana antes + confirmação 1 dia antes?",
        hint: "Entrega sem confirmação = risco de ninguém para receber = material exposto.",
        single: true,
      },
      {
        id: 47,
        text: "Na saída: Ailton confere item a item vs receita e fotografa carregando o caminhão?",
        hint: "Controle na saída é a última chance de pegar erro antes da obra.",
        single: true,
      },
      {
        id: 48,
        text: "Na chegada: foto de tudo entregue + assinatura (canhoto/digital) + evidência de armazenamento seguro (sem umidade)?",
        hint: "\"Material entregue e aceito\" com evidência registrada = zero discussão depois.",
      },
      {
        id: 49,
        text: "Para marcenaria (QC final): medidas vs etiqueta vs projeto são conferidas? Acabamento (risco, empeno, tonalidade) verificado? Ferragens embaladas com executivo?",
        hint: "Sem assinatura do responsável de qualidade, não embarca. Marcenaria sem QC final = retrabalho em obra.",
        single: true,
      },
      {
        id: 50,
        text: "Quantas entregas nos últimos 90 dias tiveram problema de: item faltando, item errado, avaria no transporte, armazenamento inadequado na obra?",
        hint: "Número real. Cada problema = custo + atraso + desgaste.",
        single: true,
        tag: "brutal",
      },
    ],
  },

  /* ─── BLOCO 9 · Contrato Prestador e Start ─── */
  {
    id: "start",
    number: 9,
    title: "Contrato Prestador e Start de Obra",
    subtitle: "Sem contrato = sem start. Classificação de complexidade define acompanhamento",
    icon: "🔨",
    questions: [
      {
        id: 51,
        text: "O gate \"sem contrato assinado, sem adiantamento e sem start\" é respeitado por Dani? Quantas obras começaram sem contrato nos últimos 90 dias?",
        hint: "Contrato protege Parket e prestador. Sem contrato = risco jurídico + financeiro.",
        single: true,
        tag: "brutal",
      },
      {
        id: 52,
        text: "A classificação de complexidade (complexa/média/simples) é definida na reunião semanal de obras com fiscais?",
        hint: "Complexa: fiscal solta junto. Média: acompanha de perto. Simples: visitas pontuais.",
        single: true,
      },
      {
        id: 53,
        text: "Para obras longe: custos (hotel, combustível, alimentação) são travados pelo financeiro ANTES do start?",
        hint: "Custo não travado vira surpresa financeira no meio da obra.",
        single: true,
        tag: "governança",
      },
      {
        id: 54,
        text: "A primeira obrigação da equipe ao chegar (conferir material, cor, lote, insumos) é cumprida? Se abriu e colou, assumiu responsabilidade?",
        hint: "Equipe que não confere material antes de instalar assume risco que era de logística.",
      },
      {
        id: 55,
        text: "Existe o conceito de \"cronograma final enviado no dia do start ou entrega de material, não antes\"?",
        hint: "Cronograma antes de obra liberada + material entregue + equipe confirmada = promessa impossível.",
        tag: "processo",
      },
    ],
  },

  /* ─── BLOCO 10 · Execução e Controle Diário ─── */
  {
    id: "execucao",
    number: 10,
    title: "Execução e Controle Diário",
    subtitle: "Check-in/out, fotos, diário, retenção 25%, bônus/multa",
    icon: "⚙️",
    questions: [
      {
        id: 56,
        text: "O controle diário obrigatório existe? (Check-in/out por geolocalização, fotos do produzido, ocorrências, feedback no grupo)",
        hint: "Dia sem diário + fotos = dia que \"não existe\". Sem registro = sem controle.",
      },
      {
        id: 57,
        text: "Quantas obras estão hoje sem diário de obra? Por quê?",
        hint: "Falta ferramenta? Falta cobrança? Falta cultura? Falta consequência?",
        tag: "brutal",
      },
      {
        id: 58,
        text: "As regras de conduta (uniforme, EPI, limpeza, comportamento, só fiscal fala prazo/decisão com cliente) são aplicadas com multa real?",
        hint: "\"Multa por desvio sem debate\" — existe de verdade ou é aviso vazio?",
        single: true,
      },
      {
        id: 59,
        text: "O feedback \"despretensioso\" no grupo para engenharia (\"como está ficando a instalação até agora?\") funciona como radar antifraude de foto?",
        hint: "Engenharia respondendo no grupo = validação cruzada que fiscal não precisa estar lá 100% do tempo.",
      },
      {
        id: 60,
        text: "Os pagamentos quinzenais seguem a regra? (Fechamento D10 paga D15, D25 paga D30, retenção 25% por item até aceite)",
        hint: "Retenção é a principal alavanca de qualidade. Sem retenção = sem poder de correção.",
        single: true,
        tag: "governança",
      },
      {
        id: 61,
        text: "Para marcenaria: o montador cumpre a regra \"não desembala sem conferir etiqueta vs projeto executivo + registrar evidência\"?",
        hint: "Violou lacre = assumiu risco. Essa regra é cultural e precisa ser inegociável.",
        single: true,
      },
      {
        id: 62,
        text: "Existe sistema de bônus/multa automático vinculado a: diário completo, produtividade, zero retrabalho, NCs?",
        hint: "Quem não envia, não pontua, não recebe bônus e fica mais longe de obra boa.",
        single: true,
        tag: "destrava",
      },
    ],
  },

  /* ─── BLOCO 11 · Entrega Final e Aceite ─── */
  {
    id: "entrega_final",
    number: 11,
    title: "Entrega Final e Aceite",
    subtitle: "Termo assinado, retenção liberada, encerramento formal",
    icon: "🏁",
    questions: [
      {
        id: 63,
        text: "O padrão de entrega é respeitado? (Obra grande: fiscal entrega presencial. Pequena: termo digital no grupo)",
        hint: "Cada porte de obra tem seu ritual. O que acontece quando não é seguido?",
      },
      {
        id: 64,
        text: "O checklist de entrega cobre: conformidade técnica, acabamento, limpeza pós-serviço, pendências registradas?",
        hint: "Entregar sem checklist = cliente encontra defeito na mudança = reclamação pública.",
      },
      {
        id: 65,
        text: "O termo de aceite é assinado (presencial ou digital) antes de liberar retenção?",
        hint: "Sem termo = sem prova de aceite = discussão interminável.",
        tag: "governança",
      },
      {
        id: 66,
        text: "A liberação de retenção é feita por item aceito (não tudo ou nada)?",
        hint: "Item aceito = retenção liberada para aquele item. Pendência = retenção mantida.",
        single: true,
      },
      {
        id: 67,
        text: "Quantas entregas nos últimos 90 dias tiveram pendência registrada? Qual o tempo médio para resolver?",
        hint: "Pendência pós-entrega é normal se registrada. Anormal se vira eternidade.",
        single: true,
        tag: "maturidade",
      },
    ],
  },

  /* ─── BLOCO 12 · Pós-Obra e Triagem ─── */
  {
    id: "pos_obra",
    number: 12,
    title: "Pós-Obra com Triagem Objetiva",
    subtitle: "Talita recebe → Fiscal avalia → Parket ou não? → Resolução",
    icon: "🔧",
    questions: [
      {
        id: 68,
        text: "O fluxo de pós-obra funciona? (Talita recebe e registra → Fiscal avalia e faz relatório → Responsabilidade Parket? Agenda e arca. Não Parket? Explica + orçamento)",
        hint: "Triagem objetiva = paz. Triagem subjetiva = briga.",
        single: true,
      },
      {
        id: 69,
        text: "Os 5 chamados mais frequentes de pós-obra são quais? Quais causas raiz?",
        hint: "Se identificar padrão, pode prevenir no processo antes da entrega.",
      },
      {
        id: 70,
        text: "Para marcenaria: portas, requadro e ferragens geram discussão frequente? O relatório técnico é cirúrgico (responsabilidade definida, termo se é obra)?",
        hint: "Marcenaria precisa de triagem mais sensível porque interfaces são mais complexas.",
        single: true,
      },
      {
        id: 71,
        text: "Qual é o aging médio dos chamados de pós-obra? (0-7 dias, 8-15 dias, 16+ dias)",
        hint: "Chamado aberto > 15 dias sem resolução = cliente detrator. Meta: zero acima de 15 dias.",
        single: true,
        tag: "maturidade",
      },
      {
        id: 72,
        text: "Se um orçamento de pós-obra é aprovado pelo cliente, o fluxo (agenda → executa → termo aceite → paga prestador → encerra) funciona ou emperra?",
        hint: "Pós-obra que gera receita é oportunidade, não custo. Mas só se o fluxo for ágil.",
        single: true,
      },
    ],
  },

  /* ─── BLOCO 13 · Pós-Venda Estratégico ─── */
  {
    id: "pos_venda",
    number: 13,
    title: "Pós-Venda Estratégico",
    subtitle: "NPS + indicação + pipeline novo = reciclagem comercial",
    icon: "🔁",
    questions: [
      {
        id: 73,
        text: "O roteiro mínimo de pós-venda é executado? (NPS 0-10, nota equipe conduta+qualidade, resultado vs expectativa, quem mais no círculo)",
        hint: "Talita como CS (visão neutra). Vendedor com arquiteto. Fundador em obras grandes/crises viradas vitória.",
        single: true,
      },
      {
        id: 74,
        text: "Quantos leads novos foram gerados por pós-venda nos últimos 90 dias?",
        hint: "Se zero: o pós-venda não está gerando receita. A oportunidade mais valiosa está sendo desperdiçada.",
        single: true,
        tag: "brutal",
      },
      {
        id: 75,
        text: "O vendedor retoma relacionamento com arquiteto após obra entregue? Ou o contato morre com a entrega?",
        hint: "Arquiteto é a fonte mais valiosa de recorrência. Relacionamento de longo prazo = pipeline contínuo.",
        single: true,
      },
      {
        id: 76,
        text: "As perguntas \"quem mais pode estar construindo no círculo?\" (amigos, novos projetos, outros clientes do arquiteto, mesma engenharia) são feitas sistematicamente?",
        hint: "Uma pergunta que gera 2-3 leads por obra = crescimento orgânico real.",
        single: true,
        tag: "destrava",
      },
    ],
  },

  /* ─── BLOCO 14 · Handoffs e Passagem de Bastão ─── */
  {
    id: "handoffs",
    number: 14,
    title: "Handoffs entre Áreas",
    subtitle: "Onde informação se perde, prazo estoura e qualidade morre",
    icon: "🤝",
    questions: [
      {
        id: 77,
        text: "Dos 10 handoffs de revestimento (Comercial→Tainara, Tainara→Fiscal, Fiscal→Compras, Compras→Ailton, Talita→Fiscal, Fiscal→Nat, Dani→Prestador, Fiscal→Talita, Talita→Comercial, Ailton→Obra), quais mais dão problema?",
        hint: "Para cada handoff problemático: o que falta no pacote, consequência, frequência.",
      },
      {
        id: 78,
        text: "Para marcenaria: os 12 handoffs específicos (incluindo aval fábrica, reunião gravada, mapa itens, ficha Parket, medição fina, amostra assinada, Germano QC) estão formalizados?",
        hint: "Marcenaria tem handoffs extras de precisão. Qual está mais frágil?",
        single: true,
      },
      {
        id: 79,
        text: "Quais handoffs geram mais retrabalho? Informação incompleta, versão errada, premissa não comunicada, prazo não confirmado?",
        hint: "O handoff é o ponto mais frágil. Cada pacote incompleto gera cascata de problemas.",
      },
      {
        id: 80,
        text: "Se criasse um \"contrato entre áreas\" para os top 3 handoffs, quais seriam as cláusulas? (pacote mínimo, SLA, evidência, consequência)",
        hint: "Handoff sem pacote mínimo = improviso. Improviso = erro. Erro = custo.",
        tag: "destrava",
      },
      {
        id: 81,
        text: "Quais SLAs de resposta por handoff existem de verdade vs existem na fantasia?",
        hint: "Projetos entrega em X dias. Compras responde em Xh. Fiscal agenda em X dias. Real ou aspiracional?",
      },
    ],
  },

  /* ─── BLOCO 15 · Papéis e Governança ─── */
  {
    id: "governanca",
    number: 15,
    title: "Papéis, Governança e Decisão",
    subtitle: "RACI real com nomes — sem dono, ninguém cobra",
    icon: "👑",
    questions: [
      {
        id: 82,
        text: "Os 10 donos de processo por macrobloco estão claros para todo o time? (Comercial, Carla, Talita, Tainara, Fiscal, Ailton, Ronaldo/Pâmela, PCP/Germano, Dani, Nat)",
        hint: "Quem não sabe que é dono, não age como dono.",
        single: true,
      },
      {
        id: 83,
        text: "Quais decisões são centralizadas no fundador hoje que poderiam ser delegadas com critério claro?",
        hint: "Preço, desconto, prazo, contratação, parar obra, trocar material. O que pode descer?",
        single: true,
        tag: "governança",
      },
      {
        id: 84,
        text: "Quais decisões exigem dupla aprovação (ex: aditivo > R$ X, parar obra, trocar material crítico)?",
        hint: "Onde decisão unilateral gera risco alto demais?",
        single: true,
      },
      {
        id: 85,
        text: "Qual é o \"limite de autonomia\" por função hoje? (R$ e prazo que cada dono pode decidir sem escalar)",
        hint: "Ex: fiscal pode gastar até R$ X sem aprovar. Talita pode agendar sem consultar. Existe ou é tudo centralizado?",
        single: true,
      },
      {
        id: 86,
        text: "Quem são os \"heróis\" que se saírem amanhã param tudo? O que precisa ser padronizado para que qualquer líder execute?",
        hint: "Dependência de pessoa = risco. Padronização = escala.",
        single: true,
        tag: "brutal",
      },
      {
        id: 87,
        text: "Quais comportamentos quebram o sistema e devem virar regra disciplinar formal?",
        hint: "Ex: começar sem frente liberada, não registrar diário, aceitar mudança verbal, começar sem contrato.",
        single: true,
      },
    ],
  },

  /* ─── BLOCO 16 · Fechamento: Rupturas e Mapa Final ─── */
  {
    id: "fechamento",
    number: 16,
    title: "Pontos de Ruptura e Mapa Final",
    subtitle: "6 rupturas, 9 checklists, 10 métricas — o workflow desenhado",
    icon: "🗺️",
    questions: [
      {
        id: 88,
        text: "Das 6 rupturas mapeadas, qual é a mais grave na sua operação hoje? (R1: fiscal sem pré-projeto, R2: aditivo tarde, R3: cronograma ilusório, R4: entrega sem prova, R5: equipe sem disciplina, R6: marc sem rastreabilidade)",
        hint: "Ranking das rupturas por impacto real: qual causa mais dano financeiro e de reputação?",
        single: true,
        tag: "brutal",
      },
      {
        id: 89,
        text: "Dos 9 checklists mestres (onboarding, pré-projeto, 1ª vistoria, liberação, entrega material, start, diário, entrega final, pós-obra), quais existem hoje como formulário? Quais são \"na cabeça\"?",
        hint: "Checklist que existe só na cabeça de alguém = checklist que não existe.",
        single: true,
      },
      {
        id: 90,
        text: "Dos 4 termos padrão (responsabilidade, taxa 3ª vistoria, aceite entrega, contrato prestador), quais estão prontos para assinatura digital?",
        hint: "Termo pronto = implementação amanhã. Termo inexistente = meses de atraso.",
        single: true,
      },
      {
        id: 91,
        text: "Das 10 métricas semanais obrigatórias, quais vocês conseguem gerar hoje? (Obras por estado, aguardando arquivos, aguardando vistoria, aditivo pendente, exec. pendente, aguardando liberação, material→equipe, esperado vs real, ranking equipes, pós-obra aging)",
        hint: "Se não mede, não gerencia. Quais métricas são invisíveis hoje?",
        single: true,
      },
      {
        id: 92,
        text: "Qual é o fluxo end-to-end real hoje, em 18 passos, para Revestimentos? Onde difere do que deveria ser?",
        hint: "Do lead à reciclagem comercial. Liste os passos reais vs os desejados.",
        single: true,
      },
      {
        id: 93,
        text: "Qual é o fluxo end-to-end real hoje, em 19 passos, para Marcenaria? Onde difere do que deveria ser?",
        hint: "Mesma lógica: real vs desejado. Onde estão os maiores gaps?",
        single: true,
      },
      {
        id: 94,
        text: "Se pudesse implementar apenas 3 gates amanhã, quais teriam maior impacto imediato?",
        hint: "Pense em: custo evitado, tempo ganho, dor eliminada, cultura mudada.",
        single: true,
        tag: "destrava",
      },
      {
        id: 95,
        text: "Qual é o ritual semanal que mantém todo o sistema vivo? (Reunião de obras com fiscais, revisão de pipeline, auditoria de checklists)",
        hint: "Sem ritual semanal, o sistema morre em 30 dias. Qual reunião nunca pode faltar?",
        single: true,
        tag: "sistema",
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   ENTREGA FINAL — 7 DIAGNÓSTICOS
   ═══════════════════════════════════════════════════════════ */

export const wfFinalItems: WfFinalItem[] = [
  {
    id: "wf1",
    label: "Mapa de macroestados: quais dos 20 estados você rastreia e quais são invisíveis",
    hint: "Para cada estado: ✅ rastreável no sistema · ⚠️ parcial/informal · ❌ invisível. Plano para tornar visível.",
    single: true,
  },
  {
    id: "wf2",
    label: "Ranking dos 6 pontos de ruptura por gravidade na sua operação hoje",
    hint: "R1 a R6 ordenados por impacto (R$, frequência, desgaste). Para cada um: gate proposto e prazo de implementação.",
    single: true,
  },
  {
    id: "wf3",
    label: "Top 5 handoffs que mais quebram e proposta de \"contrato entre áreas\" para cada",
    hint: "Origem → destino → pacote mínimo → SLA → evidência → consequência de descumprir.",
    single: true,
  },
  {
    id: "wf4",
    label: "Status dos 9 checklists mestres: existe / parcial / inexistente / digital / papel / cabeça",
    hint: "Para cada checklist: onde mora hoje, quem usa, o que falta para ficar 100% digital.",
    single: true,
  },
  {
    id: "wf5",
    label: "RACI real por macrobloco com nomes e gaps (quem deveria ser dono mas não é)",
    hint: "10 donos de processo. Para cada um: clareza do time (1-5), gaps de cobertura, ações de alinhamento.",
    single: true,
  },
  {
    id: "wf6",
    label: "Das 10 métricas semanais: quais existem, quais precisam ser criadas, e qual ferramenta",
    hint: "Para cada métrica: disponível hoje? Fonte de dados? Quem calcula? Quem consome? Frequência real.",
    single: true,
  },
  {
    id: "wf7",
    label: "Plano de implementação: 3 gates prioritários + 3 checklists prioritários + prazo de 30/60/90 dias",
    hint: "O que implementar primeiro para maior impacto com menor esforço. Dono de cada implementação.",
    single: true,
  },
];

export const WF_TOTAL_QUESTIONS = 95;
export const WF_TOTAL_FINAL_ITEMS = 7;
