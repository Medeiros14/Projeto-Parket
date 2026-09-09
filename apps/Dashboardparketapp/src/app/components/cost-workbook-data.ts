/* ═══════════════════════════════════════════════════════════
   Custos Fixos & Zero-Based Budget — Roteiro de Auditoria
   115 perguntas · 11 blocos
   + 7 diagnósticos finais
   ═══════════════════════════════════════════════════════════ */

export interface CostQuestion {
  id: number;
  text: string;
  tag?: string;
  hint?: string;
  /** if true, single text field instead of dual column */
  single?: boolean;
}

export interface CostSection {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  questions: CostQuestion[];
}

export interface CostFinalItem {
  id: string;
  label: string;
  hint: string;
  single?: boolean;
}

/* ═══════════════════════════════════════════════════════════
   11 BLOCOS DE PERGUNTAS
   ═══════════════════════════════════════════════════════════ */

export const costSections: CostSection[] = [

  /* ─── BLOCO 1 · Inventário total de custos fixos ─── */
  {
    id: "inventario",
    number: 1,
    title: "Inventário Total de Custos Fixos",
    subtitle: "Mapear TUDO sem deixar nada fora — últimos 3 meses como base",
    icon: "🗺️",
    questions: [
      {
        id: 1,
        text: "Liste TODAS as pessoas fixas com cargo, área e custo mensal completo (salário + encargos + benefícios).",
        hint: "Inclui: administrativo, financeiro, fiscal, jurídico, RH, TI, marketing, comercial fixo, coordenação, engenharia, qualidade, planejamento, atendimento/pós-obra, estoque/expedição, manutenção, limpeza, segurança, motoristas, gestores.",
        single: true,
        tag: "inventário",
      },
      {
        id: 2,
        text: "Liste TODOS os custos de estrutura física com valor mensal.",
        hint: "Barracão/fábrica, loja/showroom, escritório, depósitos, condomínio, IPTU, energia base, água, internet, telefonia, segurança, limpeza terceirizada, manutenção predial.",
        single: true,
        tag: "inventário",
      },
      {
        id: 3,
        text: "Liste TODOS os custos de frota e mobilidade com valor mensal.",
        hint: "Leasing/financiamento, seguro, rastreador, combustível mínimo, manutenção, estacionamento, pedágio recorrente, locação de veículos.",
        single: true,
        tag: "inventário",
      },
      {
        id: 4,
        text: "Liste TODOS os softwares e assinaturas com valor mensal e número de licenças.",
        hint: "ERP/CRM, BI, e-mail, WhatsApp API, armazenamento/cloud, CAD/3D, gestão de projetos, assinatura digital, automações, ferramentas marketing, segurança/antivírus.",
        single: true,
        tag: "inventário",
      },
      {
        id: 5,
        text: "Liste TODOS os custos fixos de marketing e comunicação.",
        hint: "Agência, gestor de tráfego, ferramentas de automação, produção de conteúdo, foto/vídeo recorrente, mídia mínima mensal, eventos recorrentes, materiais de showroom.",
        single: true,
        tag: "inventário",
      },
      {
        id: 6,
        text: "Liste TODOS os serviços recorrentes (contabilidade, jurídico, consultorias).",
        hint: "Contabilidade mensal, jurídico mensal, consultorias, auditorias, suporte TI, suporte ERP, treinamentos recorrentes.",
        single: true,
        tag: "inventário",
      },
      {
        id: 7,
        text: "Liste TODOS os custos financeiros e bancários recorrentes.",
        hint: "Tarifas bancárias, mensalidades de máquinas de cartão, custos de antecipação recorrentes, custo de capital fixo (linhas de crédito frequentes), taxas de boleto/Pix.",
        single: true,
        tag: "inventário",
      },
      {
        id: 8,
        text: "Liste TODOS os custos de risco e conformidade.",
        hint: "Seguros (patrimonial, responsabilidade civil, obras), licenças, certificações, saúde e segurança do trabalho, medicina do trabalho, PPRA/PCMSO.",
        single: true,
        tag: "inventário",
      },
      {
        id: 9,
        text: "Liste provisões que se comportam como fixo (recorrentes mesmo que variáveis).",
        hint: "Garantia média mensal, retrabalho médio, perdas logísticas médias, fretes extras recorrentes. Se acontece todo mês, é fixo disfarçado.",
        single: true,
        tag: "brutal",
      },
      {
        id: 10,
        text: "Qual é o TOTAL mensal de custos fixos que você levantou? Confere com o extrato bancário?",
        hint: "Some tudo acima. Compare com DRE ou extrato dos últimos 3 meses. A diferença é o que está faltando no inventário.",
        single: true,
        tag: "brutal",
      },
    ],
  },

  /* ─── BLOCO 2 · Perguntas universais por item ─── */
  {
    id: "universais",
    number: 2,
    title: "Perguntas Universais de Auditoria",
    subtitle: "Para CADA linha de custo fixo — force valor mensurável e alternativa",
    icon: "🔍",
    questions: [
      {
        id: 11,
        text: "Para cada custo: qual decisão RUIM esse custo evita?",
        hint: "Se não evita nenhuma decisão ruim, é conforto. Ex: 'O ERP evita erro de compra duplicada que custava R$ X/mês'.",
        single: true,
        tag: "valor",
      },
      {
        id: 12,
        text: "Para cada custo: qual PERDA ele reduz (retrabalho, atraso, erro, multa, churn)?",
        hint: "Se não reduz nenhuma perda mensurável, questione. Custos que não evitam perdas são candidatos a corte.",
        single: true,
        tag: "valor",
      },
      {
        id: 13,
        text: "Para cada custo: qual MÉTRICA mudou nos últimos 90 dias por causa dele?",
        hint: "Se nenhuma métrica mudou, o custo não está gerando resultado. Pode estar mantendo status quo — ou pode ser inútil.",
        single: true,
        tag: "brutal",
      },
      {
        id: 14,
        text: "Para cada custo: se eu CORTAR por 30 dias, o que quebra e em quanto tempo?",
        hint: "Teste mental: imagina cancelar. Quebraria em 1 dia? 1 semana? 1 mês? Nunca? Quanto mais tempo leva, menos crítico é.",
        single: true,
        tag: "brutal",
      },
      {
        id: 15,
        text: "Para cada custo: existe alternativa 50% mais barata com 80% do resultado?",
        hint: "Quase sempre existe. O que te impede de trocar: contrato, preguiça, hábito, medo ou restrição real?",
        single: true,
        tag: "destrava",
      },
      {
        id: 16,
        text: "Para cada custo: isso é CAPACIDADE (produz output) ou CONVENIÊNCIA (conforto)?",
        hint: "Capacidade = necessário para produzir/entregar. Conveniência = bom de ter. Em momento de otimização, conveniência vira alvo.",
        single: true,
        tag: "brutal",
      },
      {
        id: 17,
        text: "Para cada custo: é fixo por DESIGN ou ficou fixo por PREGUIÇA?",
        hint: "Preguiça = não renegociou, não automatizou, não centralizou. Muitos fixos existem porque 'sempre foi assim'.",
        single: true,
        tag: "brutal",
      },
      {
        id: 18,
        text: "Para cada custo: quem é o DONO e qual o SLA do serviço interno que ele suporta?",
        hint: "Sem dono = sem responsabilidade = sem métrica = custo zumbi. Defina dono para cada linha.",
        single: true,
        tag: "governança",
      },
    ],
  },

  /* ─── BLOCO 3 · Auditoria: Pessoas fixas ─── */
  {
    id: "pessoas",
    number: 3,
    title: "Auditoria: Pessoas Fixas",
    subtitle: "Output semanal, decisões que destrava, processo que suporta",
    icon: "👤",
    questions: [
      {
        id: 19,
        text: "Para cada pessoa fixa: qual output SEMANAL ela entrega que é auditável?",
        hint: "Relatório, fechamento, entregas de obra, propostas enviadas, pedidos processados. Se não tem output semanal, é custo sem visibilidade.",
        single: true,
        tag: "valor",
      },
      {
        id: 20,
        text: "Quantas decisões cada pessoa destrava por SEMANA?",
        hint: "Pessoa que não destrava decisão é executor. Executor pode ser terceirizado ou automatizado mais facilmente.",
        single: true,
        tag: "valor",
      },
      {
        id: 21,
        text: "Que tipo de retrabalho cada pessoa REDUZ e quanto isso vale?",
        hint: "Ex: 'Fiscal reduz retrabalho de obra em ~15h/mês = R$ X'. Se não consegue quantificar, o valor é questionável.",
        single: true,
        tag: "brutal",
      },
      {
        id: 22,
        text: "Se cada pessoa sair, qual processo PARA? Existe playbook?",
        hint: "Pessoa sem playbook = pessoa-dependência = risco. Mas também = custo fixo que você não consegue desafiar.",
        single: true,
        tag: "risco",
      },
      {
        id: 23,
        text: "Quais funções deveriam ser centralizadas, terceirizadas ou automatizadas?",
        hint: "Centralizada = 1 pessoa faz para todos. Terceirizada = paga por demanda. Automatizada = sistema faz. Liste candidatos.",
        single: true,
        tag: "destrava",
      },
      {
        id: 24,
        text: "Quais pessoas estão no lugar certo (estratégia) e quais fazem tarefa repetitiva (automação)?",
        hint: "Pessoa cara fazendo trabalho barato = desperdício. Pessoa barata fazendo trabalho estratégico = risco. Quais estão no lugar errado?",
        single: true,
        tag: "brutal",
      },
      {
        id: 25,
        text: "Quantas horas por semana cada pessoa gasta em tarefas que NÃO são sua função principal?",
        hint: "Coordenador fazendo planilha, gerente respondendo WhatsApp operacional, fiscal preenchendo nota fiscal. Quanto tempo está sendo 'roubado'?",
        single: true,
        tag: "processo",
      },
    ],
  },

  /* ─── BLOCO 4 · Auditoria: Estrutura física ─── */
  {
    id: "estrutura",
    number: 4,
    title: "Auditoria: Estrutura Física",
    subtitle: "Barracão, loja, showroom, escritório — utilização real vs custo",
    icon: "🏢",
    questions: [
      {
        id: 26,
        text: "Qual é a utilização REAL de cada espaço: % ocupação, horas usadas, throughput?",
        hint: "Barracão 100%? Showroom 30%? Escritório 60%? Depósito cheio ou com espaço? Medir antes de opinar.",
        single: true,
        tag: "valor",
      },
      {
        id: 27,
        text: "Quais receitas dependem DIRETAMENTE de cada espaço?",
        hint: "Barracão = produção → receita de obras com marcenaria. Showroom = visitas → propostas → contratos. Qual é a receita vinculada?",
        single: true,
        tag: "valor",
      },
      {
        id: 28,
        text: "Quais custos cada espaço REDUZ (logística, prazo, perdas)?",
        hint: "Depósito próximo de obras reduz frete extra. Barracão próprio reduz terceirização. Qual é a economia real?",
        single: true,
        tag: "valor",
      },
      {
        id: 29,
        text: "Dá para consolidar espaços (menos m²) sem afetar entrega?",
        hint: "Escritório pode ir para dentro do barracão? Depósito pode ser reduzido com JIT? Qual m² pode ser eliminado?",
        single: true,
        tag: "destrava",
      },
      {
        id: 30,
        text: "O showroom gera pipeline MEDÍVEL (visitas → propostas → contratos) ou é 'branding sem métrica'?",
        hint: "Se não mede visitas qualificadas, taxa de conversão e ticket médio de quem visita vs quem não visita, é custo cego.",
        single: true,
        tag: "brutal",
      },
      {
        id: 31,
        text: "A loja é canal de VENDA ou vitrine CARA?",
        hint: "Quanto da receita vem de clientes que entraram pela loja? Se < 10%, é vitrine. Vitrine pode ser menor, mais barata ou compartilhada.",
        single: true,
        tag: "brutal",
      },
      {
        id: 32,
        text: "Qual é o custo total por m² de cada espaço (aluguel + IPTU + energia + manutenção + segurança)?",
        hint: "Custo total ÷ m² úteis = R$/m²/mês. Compare com alternativas no mercado. Está caro?",
        single: true,
        tag: "processo",
      },
    ],
  },

  /* ─── BLOCO 5 · Auditoria: Softwares e assinaturas ─── */
  {
    id: "software",
    number: 5,
    title: "Auditoria: Softwares e Assinaturas",
    subtitle: "Licenças, usuários reais, redundância e software zumbi",
    icon: "💻",
    questions: [
      {
        id: 33,
        text: "Para cada software: qual processo ele faz 10x MELHOR do que planilha?",
        hint: "Se a resposta é 'nenhum', você está pagando por hábito. Se faz igual à planilha, planilha é grátis.",
        single: true,
        tag: "valor",
      },
      {
        id: 34,
        text: "Quantos USUÁRIOS ATIVOS reais usam cada software por semana?",
        hint: "Licenças pagas: X. Usuários que acessam pelo menos 3x/semana: Y. Se Y < 50% de X, está jogando dinheiro fora.",
        single: true,
        tag: "brutal",
      },
      {
        id: 35,
        text: "Qual economia ou ganho cada software gera (tempo, erro, rastreabilidade)?",
        hint: "ERP economiza X horas de retrabalho. CRM evita Y leads perdidos. Se não sabe a economia, como justifica o custo?",
        single: true,
        tag: "valor",
      },
      {
        id: 36,
        text: "Há REDUNDÂNCIA? (dois CRMs, dois gerenciadores, três assinaturas que fazem a mesma coisa)",
        hint: "É comum ter WhatsApp Business API + chatbot + CRM + planilha de contatos. Consolide.",
        single: true,
        tag: "brutal",
      },
      {
        id: 37,
        text: "Você usa 20% do software pagando 100%? Pode trocar por plano menor?",
        hint: "ERP enterprise quando basic resolve. Plano PRO de 50 usuários quando usa 8. Quanto custa o downgrade?",
        single: true,
        tag: "destrava",
      },
      {
        id: 38,
        text: "Quais softwares NÃO TÊM dono interno definido?",
        hint: "Software sem dono = ninguém cobra resultado = vira lixo em 90 dias. Defina dono para cada assinatura.",
        single: true,
        tag: "governança",
      },
      {
        id: 39,
        text: "Quais assinaturas podem ser consolidadas em UMA ferramenta?",
        hint: "Gestão de projeto + anotações + CRM podem virar um só. Ferramentas de design + edição podem ser uma. Liste consolidações possíveis.",
        single: true,
        tag: "destrava",
      },
    ],
  },

  /* ─── BLOCO 6 · Auditoria: Marketing fixo ─── */
  {
    id: "marketing",
    number: 6,
    title: "Auditoria: Marketing Fixo e Recorrente",
    subtitle: "ROI real, lead bom vs ruído, integração com comercial",
    icon: "📣",
    questions: [
      {
        id: 40,
        text: "Qual é o objetivo PRINCIPAL de cada custo de marketing: lead, arquiteto, autoridade ou relacionamento?",
        hint: "Se não tem objetivo claro, é gasto. Se tem, qual indicador mede sucesso?",
        single: true,
        tag: "valor",
      },
      {
        id: 41,
        text: "Quais MÉTRICAS REAIS você tem: CAC, CPL, taxa de qualificação, taxa de visita, taxa de proposta, taxa de ganho, ticket?",
        hint: "Liste quais métricas existem e são acompanhadas semanalmente. As que faltam = cegueira.",
        single: true,
        tag: "sistema",
      },
      {
        id: 42,
        text: "O marketing entrega lead BOM ou lead BARULHO?",
        hint: "Lead bom = perfil certo, orçamento certo, momento certo. Lead barulho = gera trabalho sem conversão. Qual é a taxa de qualificação?",
        single: true,
        tag: "brutal",
      },
      {
        id: 43,
        text: "Quanto do gasto de marketing é produção RECORRENTE vs MÍDIA paga?",
        hint: "Produção (conteúdo, foto, vídeo) cria acervo duradouro. Mídia queima dinheiro hoje. Qual é o split?",
        single: true,
        tag: "processo",
      },
      {
        id: 44,
        text: "Qual parte pode virar 'performance only' — com metas e corte automático se não bater?",
        hint: "Ex: tráfego pago com meta de CPL < R$ X. Se não bater 2 meses seguidos, pausa. Quais custos podem ter essa regra?",
        single: true,
        tag: "destrava",
      },
      {
        id: 45,
        text: "O que pode virar BIBLIOTECA reutilizável para reduzir custo de produção?",
        hint: "Cases, bastidores, provas sociais, templates. Criar uma vez e reutilizar muitas. Quanto disso já existe?",
        single: true,
        tag: "destrava",
      },
      {
        id: 46,
        text: "O marketing tem integração de FEEDBACK do comercial sobre qualidade dos leads?",
        hint: "Se marketing não sabe quais leads viraram proposta e quais foram lixo, está otimizando no escuro. Existe esse loop?",
        single: true,
        tag: "brutal",
      },
      {
        id: 47,
        text: "Qual é o custo TOTAL de marketing por contrato GANHO (não por lead)?",
        hint: "Total de marketing mensal ÷ contratos ganhos do mês = custo real de aquisição. Qual é esse número?",
        single: true,
        tag: "brutal",
      },
    ],
  },

  /* ─── BLOCO 7 · Auditoria: Serviços recorrentes e compliance ─── */
  {
    id: "servicos",
    number: 7,
    title: "Auditoria: Serviços Recorrentes e Compliance",
    subtitle: "Contabilidade, jurídico, consultorias, suporte TI — escopo vs mensalidade",
    icon: "📎",
    questions: [
      {
        id: 48,
        text: "Para contabilidade/fiscal: qual RISCO real esse custo cobre e qual custo de FALHA?",
        hint: "Multa fiscal, atraso em obrigação acessória, erro de apuração. Qual é o histórico de problemas?",
        single: true,
        tag: "risco",
      },
      {
        id: 49,
        text: "Quais SLAs estão no contrato: prazo de emissão, apuração, fechamento, suporte?",
        hint: "Se não tem SLA, você paga 'mensalidade cega'. Renegociar por escopo definido com SLA e penalidade.",
        single: true,
        tag: "governança",
      },
      {
        id: 50,
        text: "Quais erros e multas ocorreram nos últimos 12 meses por falha de serviço?",
        hint: "Se houve erros: o fornecedor pagou? Você absorveu? Isso já é perda que precisa entrar no custo real do serviço.",
        single: true,
        tag: "brutal",
      },
      {
        id: 51,
        text: "Para consultorias ativas: qual entrega SEMANAL cada uma faz?",
        hint: "Consultoria sem entrega semanal é mentoria cara disfarçada. Qual é o output concreto?",
        single: true,
        tag: "valor",
      },
      {
        id: 52,
        text: "Quais rotinas de compliance podem ser AUTOMATIZADAS antes de pagar mais gente?",
        hint: "Emissão de NF, conciliação bancária, obrigações acessórias, relatórios fiscais. Quanto é manual hoje?",
        single: true,
        tag: "destrava",
      },
      {
        id: 53,
        text: "Suporte TI: qual tempo médio de resolução e qual custo de PARADA quando algo quebra?",
        hint: "Se TI demora 4h para resolver e isso para 3 pessoas, são 12h de improdutividade. Quanto custa por mês?",
        single: true,
        tag: "valor",
      },
      {
        id: 54,
        text: "Quais serviços recorrentes podem ser agrupados em UM fornecedor com escopo integrado?",
        hint: "Contabilidade + fiscal + RH/folha + jurídico trabalhista. Às vezes um escritório completo custa menos que 3 fornecedores separados.",
        single: true,
        tag: "destrava",
      },
    ],
  },

  /* ─── BLOCO 8 · Auditoria: Frota e mobilidade ─── */
  {
    id: "frota",
    number: 8,
    title: "Auditoria: Frota e Mobilidade",
    subtitle: "Utilização real, custo por km/entrega, fixo vs sob demanda",
    icon: "🚛",
    questions: [
      {
        id: 55,
        text: "Qual é a taxa de UTILIZAÇÃO por veículo (dias usados / dias disponíveis)?",
        hint: "Veículo parado no pátio é custo puro. Se utilização < 70%, questione se precisa de frota própria.",
        single: true,
        tag: "valor",
      },
      {
        id: 56,
        text: "Quais rotas são RECORRENTES e podem ser terceirizadas?",
        hint: "Entrega de material para obra, coleta de fornecedor, ida ao showroom. Quais podem virar frete sob demanda?",
        single: true,
        tag: "destrava",
      },
      {
        id: 57,
        text: "Qual é o custo TOTAL por km e por ENTREGA de cada veículo?",
        hint: "(Leasing + seguro + combustível + manutenção + motorista) ÷ km rodados = R$/km. Compare com Uber/frete terceiro.",
        single: true,
        tag: "processo",
      },
      {
        id: 58,
        text: "O que é frota ESTRATÉGICA (obra, urgência) e o que é COMODIDADE?",
        hint: "Van para obra = estratégica. Carro para gerente ir ao banco = comodidade. Quais veículos são de cada tipo?",
        single: true,
        tag: "brutal",
      },
      {
        id: 59,
        text: "Locação sob demanda é melhor do que frota fixa para algum veículo?",
        hint: "Caminhão usado 3x/mês custa menos locado do que financiado + seguro + manutenção? Faça a conta.",
        single: true,
        tag: "destrava",
      },
      {
        id: 60,
        text: "Quais custos de frota são 'invisíveis' e não estão no controle?",
        hint: "Multas, estacionamento avulso, lavagem, pedágio não-monitorado, uso pessoal. Quanto escapa do radar?",
        single: true,
        tag: "brutal",
      },
    ],
  },

  /* ─── BLOCO 9 · Score de necessidade e classificação ─── */
  {
    id: "score",
    number: 9,
    title: "Score de Necessidade por Custo",
    subtitle: "Classificar cada linha com 5 dimensões (0–25) para decidir sem debate infinito",
    icon: "📊",
    questions: [
      {
        id: 61,
        text: "Para cada custo: nota 0-5 em 'Protege ENTREGA PREMIUM' (prazo, qualidade, reputação)?",
        hint: "5 = sem ele a entrega cai imediatamente. 0 = zero impacto em entrega. Seja honesto.",
        single: true,
        tag: "score",
      },
      {
        id: 62,
        text: "Para cada custo: nota 0-5 em 'Protege CAIXA e COMPLIANCE' (fiscal, jurídico, risco real)?",
        hint: "5 = cortar gera multa/risco legal imediato. 0 = nenhum risco fiscal/legal.",
        single: true,
        tag: "score",
      },
      {
        id: 63,
        text: "Para cada custo: nota 0-5 em 'Tem ROI COMPROVADO' (crescimento, redução de perdas)?",
        hint: "5 = ROI documentado e medido mensalmente. 0 = nunca ninguém mediu o retorno. SEM MÉTRICA = teto de nota 2.",
        single: true,
        tag: "score",
      },
      {
        id: 64,
        text: "Para cada custo: nota 0-5 em 'Tem SUBSTITUTO mais barato sem perda' (inversão: 5 = sem substituto)?",
        hint: "5 = não existe alternativa viável. 0 = tem 3 alternativas 50% mais baratas. Nota BAIXA = candidato a troca.",
        single: true,
        tag: "score",
      },
      {
        id: 65,
        text: "Para cada custo: nota 0-5 em 'Crítico para CAPACIDADE PRODUTIVA' (gargalo se tirar)?",
        hint: "5 = sem ele a produção para. 0 = produção nem percebe. Ex: máquina de corte = 5. Assinatura de revista = 0.",
        single: true,
        tag: "score",
      },
      {
        id: 66,
        text: "Quais itens ficaram com score 20–25 (manter e otimizar)?",
        hint: "Esses são protegidos. Foco: renegociar para pagar menos pelo mesmo valor.",
        single: true,
        tag: "score",
      },
      {
        id: 67,
        text: "Quais itens ficaram com score 13–19 (reduzir ou provar valor em 30 dias)?",
        hint: "Zona cinzenta. Dá 30 dias para o dono provar o valor com métrica. Se não provar, desce para candidato a corte.",
        single: true,
        tag: "score",
      },
      {
        id: 68,
        text: "Quais itens ficaram com score 7–12 (candidato a corte ou automação)?",
        hint: "Ação imediata: redesenhar, automatizar ou encontrar substituto 50% mais barato. Prazo: 30 dias.",
        single: true,
        tag: "score",
      },
      {
        id: 69,
        text: "Quais itens ficaram com score 0–6 (cortar AGORA)?",
        hint: "Não precisa reunião. Cancela, encerra, pausa. Se ninguém reclama em 30 dias, estava certo.",
        single: true,
        tag: "brutal",
      },
      {
        id: 70,
        text: "Quais itens estão SEM MÉTRICA de valor e por isso começam com teto de 12?",
        hint: "Regra: item sem métrica não pode ter score > 12. Precisa 'provar' valor em 30 dias com dado concreto ou desce para corte.",
        single: true,
        tag: "brutal",
      },
    ],
  },

  /* ─── BLOCO 10 · Plano de corte por ondas ─── */
  {
    id: "ondas",
    number: 10,
    title: "Plano de Corte por Ondas",
    subtitle: "Onda 1 (7 dias), Onda 2 (30 dias), Onda 3 (90 dias) — sem quebrar operação",
    icon: "🌊",
    questions: [
      {
        id: 71,
        text: "ONDA 1 (7 dias): Quais assinaturas e softwares NÃO USADOS podem ser cancelados HOJE?",
        hint: "Software zumbi, licenças extras, ferramentas duplicadas. Corte imediato, baixo risco.",
        single: true,
        tag: "onda1",
      },
      {
        id: 72,
        text: "ONDA 1 (7 dias): Quais planos podem ser rebaixados para versão menor?",
        hint: "Plano PRO → Basic. 50 licenças → 15. Enterprise → Startup. Economias rápidas.",
        single: true,
        tag: "onda1",
      },
      {
        id: 73,
        text: "ONDA 1 (7 dias): Quais consultorias SEM entrega semanal podem ser congeladas?",
        hint: "Consultoria sem output concreto semanal: congela e vê se alguém sente falta.",
        single: true,
        tag: "onda1",
      },
      {
        id: 74,
        text: "ONDA 1 (7 dias): Quais canais de marketing SEM atribuição podem ser pausados?",
        hint: "Mídia paga sem CAC medido, produção de conteúdo sem pipeline, eventos sem ROI. Pausa e mede impacto.",
        single: true,
        tag: "onda1",
      },
      {
        id: 75,
        text: "ONDA 1 (7 dias): Quais contratos ÓBVIOS podem ser renegociados agora (internet, telefonia, ferramentas)?",
        hint: "Ligue, peça desconto, compare com concorrente. Geralmente 15-30% de economia com uma ligação.",
        single: true,
        tag: "onda1",
      },
      {
        id: 76,
        text: "ONDA 2 (30 dias): Quais funções administrativas repetitivas podem ser automatizadas ou centralizadas?",
        hint: "Lançamento de NF, conciliação, relatórios, envio de boletos, acompanhamento de status. Quanto pode virar automação?",
        single: true,
        tag: "onda2",
      },
      {
        id: 77,
        text: "ONDA 2 (30 dias): Quais fornecedores podem ser consolidados (1 no lugar de 3)?",
        hint: "Consolidar reduz complexidade + dá poder de negociação. Quais serviços podem ir para menos fornecedores?",
        single: true,
        tag: "onda2",
      },
      {
        id: 78,
        text: "ONDA 2 (30 dias): O showroom/loja precisa ser redimensionado?",
        hint: "Se ocupação < 50% ou se receita vinculada não justifica custo/m², é hora de redesenhar.",
        single: true,
        tag: "onda2",
      },
      {
        id: 79,
        text: "ONDA 2 (30 dias): Quais regras de governança de aprovação podem ser refeitas para cortar urgência e frete extra?",
        hint: "Muitos fretes extras existem porque alguém deixou de aprovar compra no prazo. Consertar a causa, não o sintoma.",
        single: true,
        tag: "onda2",
      },
      {
        id: 80,
        text: "ONDA 3 (90 dias): Qual redesenho de organograma de suporte faz sentido?",
        hint: "Centralizar admin, terceirizar operações repetitivas, mover pessoas para funções de maior impacto.",
        single: true,
        tag: "onda3",
      },
      {
        id: 81,
        text: "ONDA 3 (90 dias): Qual rebalanceamento de fixo vs variável faz sentido em produção/obra?",
        hint: "Equipe fixa vs por demanda. Material estocado vs JIT. Frota própria vs locada. Qual equilíbrio otimiza caixa?",
        single: true,
        tag: "onda3",
      },
      {
        id: 82,
        text: "ONDA 3 (90 dias): Você vai implantar 'Cost to Serve' por tipologia e por perfil de cliente?",
        hint: "Quanto custa servir um projeto de piso vs marcenaria vs escada. Quanto custa servir cliente A vs cliente B. Quais são rentáveis?",
        single: true,
        tag: "onda3",
      },
      {
        id: 83,
        text: "ONDA 3 (90 dias): Vai criar scorecard de fornecedor para reduzir perdas recorrentes?",
        hint: "Fornecedor que atrasa, entrega errado ou gera retrabalho custa mais que o preço dele. Medir e trocar.",
        single: true,
        tag: "onda3",
      },
      {
        id: 84,
        text: "Qual é a meta de redução TOTAL de custos fixos por onda (R$ e %)?",
        hint: "Onda 1: R$___/mês (___%). Onda 2: R$___/mês (___%). Onda 3: R$___/mês (___%). Total: R$___/mês.",
        single: true,
        tag: "brutal",
      },
    ],
  },

  /* ─── BLOCO 11 · Governança mensal e perguntas por área ─── */
  {
    id: "governanca",
    number: 11,
    title: "Governança Mensal e Perguntas por Área",
    subtitle: "O ritual que impede os custos de voltarem + audit por dono de área",
    icon: "🏛️",
    questions: [
      {
        id: 85,
        text: "RITUAL MENSAL: quem participa da reunião de 60 min de revisão de custos fixos?",
        hint: "Sugerido: fundador + financeiro + coordenadores de área. Sem financeiro, é opinião. Sem coordenadores, é top-down cego.",
        single: true,
        tag: "governança",
      },
      {
        id: 86,
        text: "RITUAL MENSAL: quais são as top 20 linhas de fixo por VALOR?",
        hint: "Princípio de Pareto: 20% das linhas = 80% do custo. Comece por elas.",
        single: true,
        tag: "processo",
      },
      {
        id: 87,
        text: "RITUAL MENSAL: qual é o report de variação mês-a-mês por CATEGORIA?",
        hint: "Pessoas subiu X%? Software subiu Y%? Marketing caiu Z%? Sem variação mês-a-mês, você só vê foto, não filme.",
        single: true,
        tag: "sistema",
      },
      {
        id: 88,
        text: "RITUAL MENSAL: quais itens estão SEM DONO e SEM MÉTRICA este mês?",
        hint: "Candidatos automáticos a corte. Se não ganharam dono e métrica no mês anterior, descem de faixa.",
        single: true,
        tag: "brutal",
      },
      {
        id: 89,
        text: "RITUAL MENSAL: quais renegociações e ganhos foram realizados?",
        hint: "Registro de vitórias: 'Renegociei internet de R$X para R$Y' = economia mensal de R$Z. Mantém motivação.",
        single: true,
        tag: "processo",
      },
      {
        id: 90,
        text: "RITUAL MENSAL: qual é a projeção de overhead por HORA e impacto na margem full?",
        hint: "Overhead total ÷ horas produtivas = R$/hora de overhead. Esse número entra no cálculo de margem de cada obra.",
        single: true,
        tag: "sistema",
      },
      {
        id: 91,
        text: "REGRA DE OURO: todo fixo precisa de DONO e MÉTRICA. Quais não têm?",
        hint: "Se não tem dono → vira projeto de correção (30 dias). Se não tem métrica → vira candidato a corte (30 dias).",
        single: true,
        tag: "brutal",
      },
      {
        id: 92,
        text: "PERGUNTA POR ÁREA: quais 10 custos fixos cada dono de área controla direta ou indiretamente?",
        hint: "Peça para cada líder listar. Muitos custos não têm dono porque caem entre áreas.",
        single: true,
        tag: "processo",
      },
      {
        id: 93,
        text: "PERGUNTA POR ÁREA: quais desses cada líder DEFENDERIA com unhas e dentes e por quê (métrica)?",
        hint: "Se defende sem métrica = apego. Se defende com dado = protegido. A diferença importa.",
        single: true,
        tag: "brutal",
      },
      {
        id: 94,
        text: "PERGUNTA POR ÁREA: quais 3 custos cada líder CORTARIA amanhã sem dó?",
        hint: "Quem está perto sabe o que é desperdício. A informação está nos operadores, não nos dashboards.",
        single: true,
        tag: "destrava",
      },
      {
        id: 95,
        text: "PERGUNTA POR ÁREA: quais 3 custos cada líder RENEGOCIARIA e qual alvo (%)?",
        hint: "Alvo: 10%? 20%? 30%? Quem já tentou? Quem tem contato alternativo? Quem sabe o preço do concorrente?",
        single: true,
        tag: "destrava",
      },
      {
        id: 96,
        text: "PERGUNTA POR ÁREA: qual custo existe porque o PROCESSO é ruim e gera retrabalho?",
        hint: "A pergunta mais reveladora. Ex: 'Frete extra existe porque compras atrasa pedido'. O custo é sintoma, o processo é causa.",
        single: true,
        tag: "brutal",
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   ENTREGA PRÁTICA — 7 DIAGNÓSTICOS FINAIS
   ═══════════════════════════════════════════════════════════ */

export const costFinalItems: CostFinalItem[] = [
  {
    id: "total-fixo",
    label: "Qual é o valor TOTAL mensal de custos fixos da Parket hoje?",
    hint: "Número exato. Se não sabe, coloque a melhor estimativa e marque que precisa confirmar com extrato.",
    single: true,
  },
  {
    id: "percentual-receita",
    label: "Qual percentual da receita bruta mensal os custos fixos representam?",
    hint: "Fixos ÷ Receita × 100 = X%. Em empresa de obras premium, acima de 35-40% é alerta. Qual é o seu?",
    single: true,
  },
  {
    id: "top5-maior",
    label: "Quais são os TOP 5 custos fixos por VALOR e quanto representam do total?",
    hint: "Os 5 maiores provavelmente representam 60-70% do total. São esses que movem a agulha.",
    single: true,
  },
  {
    id: "corte-imediato",
    label: "Quais custos você CORTARIA AMANHÃ se tivesse coragem? E quanto economizaria?",
    hint: "Você já sabe quais são. O que te impede: contrato, medo, política interna ou falta de alternativa?",
    single: true,
  },
  {
    id: "custo-invisivel",
    label: "Quais custos fixos INVISÍVEIS você suspeita que existem mas não estão mapeados?",
    hint: "Gastos em cartão corporativo, pequenos recorrentes, assinaturas esquecidas, extras que ninguém controla.",
    single: true,
  },
  {
    id: "overhead-hora",
    label: "Você sabe qual é o overhead por HORA PRODUTIVA? (fixos ÷ horas produtivas)",
    hint: "Esse número entra na margem full de cada obra. Se não sabe, não tem margem real. Calcule ou marque 'não sei'.",
    single: true,
  },
  {
    id: "meta-reducao",
    label: "Qual é a META de redução de custos fixos nos próximos 90 dias (R$ e %)?",
    hint: "Meta realista. Onda 1 + 2 + 3 combinadas. Quanto vai liberar de caixa mensal?",
    single: true,
  },
];

/* ─── Totals ─── */
export const COST_TOTAL_QUESTIONS = costSections.reduce((sum, s) => sum + s.questions.length, 0);
export const COST_TOTAL_FINAL_ITEMS = costFinalItems.length;
