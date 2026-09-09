/* ═══════════════════════════════════════════════════════════
   Produtividade, Custo & Margem — Roteiro de Workshop
   120 perguntas · 9 blocos · Produção × Obra
   + 8 diagnósticos finais
   ═══════════════════════════════════════════════════════════ */

export interface ProdQuestion {
  id: number;
  text: string;
  tag?: string;
  hint?: string;
  /** if true, only one answer (not split Produção/Obra) */
  single?: boolean;
}

export interface ProdSection {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  questions: ProdQuestion[];
}

export interface ProdFinalItem {
  id: string;
  label: string;
  hint: string;
  single?: boolean;
}

/* ═══════════════════════════════════════════════════════════
   9 BLOCOS DE PERGUNTAS
   ═══════════════════════════════════════════════════════════ */

export const prodSections: ProdSection[] = [

  /* ─── BLOCO 1 · Definições fundamentais ─── */
  {
    id: "definicoes",
    number: 1,
    title: "Definições Fundamentais",
    subtitle: "O que você precisa cravar antes de medir qualquer coisa",
    icon: "📐",
    questions: [
      {
        id: 1,
        text: "Qual é a unidade padrão de produção para PISO?",
        hint: "Ex: m² instalado por dia por equipe, m² retrabalhado. Defina o que conta como 'unidade feita'.",
        single: true,
        tag: "processo",
      },
      {
        id: 2,
        text: "Qual é a unidade padrão de produção para FORRO e PAINEL?",
        hint: "Ex: m² instalado, m linear, número de módulos. O que você reporta como produção diária?",
        single: true,
        tag: "processo",
      },
      {
        id: 3,
        text: "Qual é a unidade padrão de produção para DECK?",
        hint: "Ex: m² instalado por dia por equipe. Qual é a benchmark de referência?",
        single: true,
        tag: "processo",
      },
      {
        id: 4,
        text: "Qual é a unidade padrão de produção para ESCADA?",
        hint: "Ex: degraus por dia, lanços por equipe. Escada tem curva de aprendizado diferente — registre.",
        single: true,
        tag: "processo",
      },
      {
        id: 5,
        text: "Qual é a unidade padrão de produção para MARCENARIA?",
        hint: "Ex: peças/módulos instalados, horas por montagem, % ajuste fino. Separe fabricação de instalação.",
        single: true,
        tag: "processo",
      },
      {
        id: 6,
        text: "Qual é a definição objetiva de 'hora produtiva' na sua operação?",
        hint: "Hora produtiva = execução direta no escopo (instalando, produzindo, montando). Seja específico.",
        single: true,
        tag: "processo",
      },
      {
        id: 7,
        text: "Qual é a definição objetiva de 'hora improdutiva' — e quais categorias existem?",
        hint: "Categorias: espera, falta de material, retrabalho, deslocamento, bloqueio do cliente, erro de projeto/compra, pausa não-planejada. Liste as suas.",
        single: true,
        tag: "processo",
      },
      {
        id: 8,
        text: "Quais centros de custo você quer rastrear por obra?",
        hint: "Mínimo: MO produção, MO obra/instalação, supervisão, materiais, logística/fretes, terceiros, retrabalho, garantia/pós-obra, overhead alocado.",
        single: true,
        tag: "sistema",
      },
      {
        id: 9,
        text: "Qual a regra de alocação quando uma equipe trabalha em várias obras no mesmo dia?",
        hint: "Opções: pro-rata por hora, por horas apontadas, por projeto principal. Defina uma regra e crave.",
        single: true,
        tag: "governança",
      },
      {
        id: 10,
        text: "Quais tipologias você quer medir PRIMEIRO?",
        hint: "Não tente tudo de uma vez. Escolha 2-3 tipologias para pilotar: piso, forro, deck, escada, marcenaria.",
        single: true,
        tag: "destrava",
      },
    ],
  },

  /* ─── BLOCO 2 · Apontamento de tempo em obras ─── */
  {
    id: "apontamento-obra",
    number: 2,
    title: "Apontamento de Tempo — Obras",
    subtitle: "Instalação e fiscalização: quem aponta, quando, como",
    icon: "🏗️",
    questions: [
      {
        id: 11,
        text: "Quem aponta horas hoje em obras, e em que momento do dia?",
        hint: "O líder? Cada instalador? O fiscal? No final do dia? Em tempo real? Se ninguém aponta, diga.",
        single: true,
        tag: "maturidade",
      },
      {
        id: 12,
        text: "O apontamento é por PESSOA ou por EQUIPE?",
        hint: "Por pessoa = mais granular, mais atrito. Por equipe = mais viável, menos preciso. Qual seu trade-off?",
        single: true,
        tag: "processo",
      },
      {
        id: 13,
        text: "O apontamento é por OBRA e por ETAPA/AMBIENTE?",
        hint: "Você consegue saber quantas horas foram gastas na sala vs no corredor? Na etapa de piso vs de forro?",
        single: true,
        tag: "processo",
      },
      {
        id: 14,
        text: "Quais são os campos obrigatórios do apontamento diário de obra?",
        hint: "Mínimo: obra, equipe, pessoas, hora início/fim, pausas, etapa, ambiente, metragem executada, motivo de improdutividade, retrabalho (sim/não + horas + porquê), fotos antes/durante/depois.",
        single: true,
        tag: "sistema",
      },
      {
        id: 15,
        text: "Como você registra deslocamento e tempo de logística? Em qual centro de custo entra?",
        hint: "Tempo de ida/volta à obra é custo de MO ou de logística? Define a regra.",
        single: true,
        tag: "processo",
      },
      {
        id: 16,
        text: "Como você registra bloqueios do cliente e dependências externas?",
        hint: "Ex: base não pronta, acesso negado, decisão pendente. Precisa ser registrado com data, motivo e impacto em horas.",
        single: true,
        tag: "processo",
      },
      {
        id: 17,
        text: "Como você registra retrabalho sem virar 'culpa' — mas virar dado?",
        hint: "O objetivo é medir, não punir. Categorias sugeridas: erro de execução, erro de projeto, erro de material, decisão do cliente, dano colateral.",
        single: true,
        tag: "brutal",
      },
      {
        id: 18,
        text: "Qual é o MENOR formulário possível que funcione todo dia sem quebrar o time?",
        hint: "Se o formulário tiver 20 campos, ninguém preenche. Se tiver 3, não serve. Ache o equilíbrio: 6-10 campos obrigatórios + foto.",
        single: true,
        tag: "destrava",
      },
      {
        id: 19,
        text: "Hoje, qual percentual dos dias tem apontamento completo e confiável?",
        hint: "Seja honesto. 10%? 50%? 0%? Isso define o esforço de implantação.",
        single: true,
        tag: "brutal",
      },
      {
        id: 20,
        text: "Qual ferramenta/sistema é usada para apontar horas em obra (se existe)?",
        hint: "Planilha? WhatsApp? ERP? Papel? Nada? Qual é o ponto de partida?",
        single: true,
        tag: "maturidade",
      },
    ],
  },

  /* ─── BLOCO 3 · Apontamento de tempo em produção ─── */
  {
    id: "apontamento-producao",
    number: 3,
    title: "Apontamento de Tempo — Produção",
    subtitle: "Fábrica e marcenaria: etapas, ordens, refugo e OTIF",
    icon: "🏭",
    questions: [
      {
        id: 21,
        text: "Quais são as etapas de produção que você quer medir?",
        hint: "Ex: corte, usinagem, colagem, acabamento/pintura, embalagem, QA. Liste na ordem do fluxo.",
        single: true,
        tag: "processo",
      },
      {
        id: 22,
        text: "A ordem de produção é por OBRA, por AMBIENTE ou por LOTE?",
        hint: "Obra = mais rastreável. Lote = mais eficiente. Qual é a regra e como funciona na prática?",
        single: true,
        tag: "processo",
      },
      {
        id: 23,
        text: "Quem aponta tempo por etapa na produção, e como evita 'chute'?",
        hint: "Operador preenche? Líder de produção? Há controle de ponto por máquina/célula? Começo/fim registrado?",
        single: true,
        tag: "maturidade",
      },
      {
        id: 24,
        text: "Você mede refugo e retrabalho na fábrica? Como classifica causa raiz?",
        hint: "Categorias sugeridas: erro de operador, defeito de matéria-prima, erro de programação, desgaste de ferramenta, erro de projeto.",
        single: true,
        tag: "processo",
      },
      {
        id: 25,
        text: "Você mede OTIF de produção (entregar no prazo e completo) por ordem?",
        hint: "OTIF = On Time In Full. Mede se a ordem saiu no dia prometido E com 100% das peças. Se não mede, diga.",
        single: true,
        tag: "maturidade",
      },
      {
        id: 26,
        text: "Quais 3 etapas da produção são seu gargalo em horas HOJE?",
        hint: "Se não sabe, este é o primeiro dado que o sistema vai revelar. Diga o que você suspeita e por quê.",
        single: true,
        tag: "brutal",
      },
      {
        id: 27,
        text: "Qual é a capacidade teórica vs real por célula/máquina?",
        hint: "Teórica = 100% ocupação. Real = depois de setup, paradas, manutenção. Qual é a ocupação real?",
        single: true,
        tag: "processo",
      },
      {
        id: 28,
        text: "Como você conecta datas de necessidade por obra com a fila de produção?",
        hint: "Quem puxa o MRP? É manual? Tem gap entre quando a obra precisa e quando produção sabe?",
        single: true,
        tag: "sistema",
      },
      {
        id: 29,
        text: "Qual ferramenta/sistema é usada para controlar produção (se existe)?",
        hint: "ERP? Planilha? Kanban físico? Nada? O ponto de partida importa.",
        single: true,
        tag: "maturidade",
      },
      {
        id: 30,
        text: "Qual é o lead time médio da produção por tipologia (corte → expedição)?",
        hint: "Piso: X dias. Marcenaria: Y dias. Escada: Z dias. Se não sabe, estime e marque 'travei'.",
        single: true,
        tag: "processo",
      },
    ],
  },

  /* ─── BLOCO 4 · Custo real por obra e equipe ─── */
  {
    id: "custo-hora",
    number: 4,
    title: "Custos Reais por Obra e Equipe",
    subtitle: "Custo hora, encargos, terceiros, materiais e logística",
    icon: "💰",
    questions: [
      {
        id: 31,
        text: "Qual é o custo hora COMPLETO por perfil de mão de obra? (não só salário)",
        hint: "Inclui: salário, encargos, benefícios, impostos, custo indireto básico, ferramenta/EPI rateado. Liste por perfil.",
        single: true,
        tag: "sistema",
      },
      {
        id: 32,
        text: "Você tem custo hora calculado para cada um destes perfis?",
        hint: "Instalador, líder de equipe, fiscal, marceneiro, operador de máquina, acabador, logística. Liste os que tem e os que faltam.",
        single: true,
        tag: "maturidade",
      },
      {
        id: 33,
        text: "Como você trata terceirizados no custo por obra?",
        hint: "Opções: por diária, por m², por pacote, por hora. Qual a regra e como vincula à obra?",
        single: true,
        tag: "processo",
      },
      {
        id: 34,
        text: "Como você trata horas extras no custo?",
        hint: "Entra no centro de custo da obra que gerou? É rateado? Tem aprovação prévia?",
        single: true,
        tag: "processo",
      },
      {
        id: 35,
        text: "Retrabalho entra em centro de custo SEPARADO ou contamina a etapa original?",
        hint: "Separar = visibilidade real das perdas. Contaminar = esconde o problema. Qual a sua escolha?",
        single: true,
        tag: "brutal",
      },
      {
        id: 36,
        text: "Você quer margem 'industrial' (custo direto) ou margem 'full' (com overhead alocado)?",
        hint: "Industrial = material + MO direta. Full = inclui rateio de supervisão, admin, overhead fixo. A maioria se engana na industrial.",
        single: true,
        tag: "governança",
      },
      {
        id: 37,
        text: "Como você vincula consumo de material por obra?",
        hint: "Opções: por requisição, por picking list, por lote reservado. Como sabe que material X foi para obra Y?",
        single: true,
        tag: "sistema",
      },
      {
        id: 38,
        text: "Como você registra perdas de material e suas causas?",
        hint: "Perda em corte, quebra em transporte, erro de medida, sobra não-reutilizável. Tem registro? Categoria?",
        single: true,
        tag: "processo",
      },
      {
        id: 39,
        text: "Como você registra fretes extras e reentregas, e quem 'paga' isso?",
        hint: "Frete extra = falha de planejamento. Vai para o centro de custo da obra ou é custo geral?",
        single: true,
        tag: "brutal",
      },
      {
        id: 40,
        text: "Você consegue comparar previsto vs realizado de MATERIAL por obra?",
        hint: "Quantificou na proposta X m² de material. Usou X + Y%. Sabe esse número? Se não, onde está o gap?",
        single: true,
        tag: "maturidade",
      },
      {
        id: 41,
        text: "Fiscalização é custo direto por obra ou custo central rateado?",
        hint: "Fiscal que atende 3 obras: divide por tempo? Por visita? Flat rate? Defina a regra.",
        single: true,
        tag: "governança",
      },
      {
        id: 42,
        text: "Como você aloca tempo do coordenador de obras entre projetos?",
        hint: "Coordenador gerencia 5 obras. Custo dele é rateado como? Pro-rata por receita? Por horas estimadas?",
        single: true,
        tag: "processo",
      },
      {
        id: 43,
        text: "Qual regra simples de rateio de overhead você vai aceitar?",
        hint: "Opções: por receita do projeto, por horas totais, por complexidade. Qual é viável e justa?",
        single: true,
        tag: "governança",
      },
    ],
  },

  /* ─── BLOCO 5 · Controle de prazo e variações ─── */
  {
    id: "prazo",
    number: 5,
    title: "Controle de Prazo e Variações",
    subtitle: "Baseline vs real, mudanças, motivos de atraso",
    icon: "📅",
    questions: [
      {
        id: 44,
        text: "Qual é a data baseline por fase (gates) antes de começar cada obra?",
        hint: "Gates sugeridos: freeze, compra validada, frente liberada, início de cada ambiente, conclusão por ambiente, entrega/aceite.",
        single: true,
        tag: "processo",
      },
      {
        id: 45,
        text: "Quem é dono do baseline e quem pode alterá-lo?",
        hint: "Coordenador propõe, diretoria aprova? Qualquer um muda? Tem registro de mudança?",
        single: true,
        tag: "governança",
      },
      {
        id: 46,
        text: "Quando ocorre mudança de cronograma, vocês registram TODOS estes campos?",
        hint: "Campos: motivo, impacto em prazo (dias), impacto em custo (R$), quem aprovou, data da aprovação. Faltando algum?",
        single: true,
        tag: "sistema",
      },
      {
        id: 47,
        text: "Quais são os 5 códigos padrão de motivo de atraso?",
        hint: "Códigos sugeridos: bloqueio-cliente, falta-material, erro-projeto, retrabalho, clima/acesso. Defina os seus e pare de escrever texto livre.",
        single: true,
        tag: "processo",
      },
      {
        id: 48,
        text: "Qual é a regra para diferenciar 'atraso nosso' vs 'atraso por dependência do cliente'?",
        hint: "Se base não pronta: cliente. Se material atrasou: fornecedor/nosso. Se retrabalho: nosso. Quem arbitra?",
        single: true,
        tag: "governança",
      },
      {
        id: 49,
        text: "Quantas vezes vocês mudam datas SEM registrar motivo?",
        hint: "Pergunta brutal. Se a resposta é 'quase sempre', esse é o primeiro processo a corrigir.",
        single: true,
        tag: "brutal",
      },
      {
        id: 50,
        text: "Você tem visão de previsto vs realizado por gate em um painel único?",
        hint: "Um lugar onde você vê: baseline era dia X, realizado foi dia Y, motivo Z. Se não tem, o que usa?",
        single: true,
        tag: "maturidade",
      },
      {
        id: 51,
        text: "Como você calcula 'dias de atraso imputáveis à Parket' vs 'dias imputáveis a terceiros/cliente'?",
        hint: "Isso impacta diretamente a análise de produtividade. Se mistura, os números mentem.",
        single: true,
        tag: "sistema",
      },
    ],
  },

  /* ─── BLOCO 6 · Qualidade da equipe ─── */
  {
    id: "qualidade",
    number: 6,
    title: "Qualidade da Equipe",
    subtitle: "Defeitos, FPY, NC, auditorias e consequências",
    icon: "⭐",
    questions: [
      {
        id: 52,
        text: "Quais são os 10 defeitos mais comuns por tipologia?",
        hint: "Piso: junta aberta, desnível, marca de rolo, etc. Marcenaria: gaveta travando, folga, acabamento. Liste os seus por tipo.",
        tag: "processo",
      },
      {
        id: 53,
        text: "Quais 5 defeitos são 'imperdoáveis' (NC-A)?",
        hint: "Defeitos que, se acontecerem, param a obra e exigem correção imediata + relatório de causa raiz.",
        single: true,
        tag: "processo",
      },
      {
        id: 54,
        text: "Qual checklist mestre de qualidade por tipologia e qual pontuação mínima para aprovar?",
        hint: "Ex: 15 itens, precisa ter nota ≥ 85%. Se não tem checklist, diga. Se tem mas ninguém usa, diga também.",
        tag: "sistema",
      },
      {
        id: 55,
        text: "Quem audita qualidade e com que frequência?",
        hint: "Fiscal na obra diariamente? QA na fábrica por lote? Coordenador semanalmente? Quem fecha o laudo?",
        tag: "governança",
      },
      {
        id: 56,
        text: "Como você mede FPY (First Pass Yield) por equipe?",
        hint: "FPY = % de entregas aprovadas de primeira, sem retrabalho. Se não mede, aqui está uma das maiores oportunidades.",
        tag: "maturidade",
      },
      {
        id: 57,
        text: "Como você mede retrabalho por equipe em HORAS e em CUSTO?",
        hint: "Horas de retrabalho registradas / horas totais da equipe = % de ineficiência. Multiplica pelo custo hora = R$ perdidos.",
        tag: "processo",
      },
      {
        id: 58,
        text: "Como você mede NC por 100 entregas por equipe?",
        hint: "NC por 100 = (NCs da equipe / entregas da equipe) × 100. Permite comparar equipes de tamanhos diferentes.",
        tag: "sistema",
      },
      {
        id: 59,
        text: "Qual é a regra de consequência quando equipe repete o mesmo defeito 3 vezes?",
        hint: "Sem consequência = sem mudança. Opções: treinamento obrigatório, redução de obra premium, revisão de contrato, feedback formal.",
        single: true,
        tag: "brutal",
      },
      {
        id: 60,
        text: "Você tem ranking de equipes por qualidade e produtividade VISÍVEL para todos?",
        hint: "Transparência gera melhoria. Mas precisa ser justo e baseado em dados, não em opinião.",
        single: true,
        tag: "maturidade",
      },
      {
        id: 61,
        text: "Qual equipe/perfil hoje te dá mais dor de cabeça e por quê?",
        hint: "Não precisa nome. Precisa padrão: 'terceirizado X sempre atrasa', 'equipe Y tem NC alta'. O dado existe?",
        single: true,
        tag: "brutal",
      },
    ],
  },

  /* ─── BLOCO 7 · Fechamento de obra e relatório final ─── */
  {
    id: "fechamento",
    number: 7,
    title: "Fechamento de Obra e Relatório Final",
    subtitle: "Aceite, conciliação, margem real e lições aprendidas",
    icon: "📋",
    questions: [
      {
        id: 62,
        text: "O que encerra oficialmente um projeto no sistema?",
        hint: "Mínimo: termo de aceite assinado + checklist final aprovado + álbum de entrega + conciliação de custos. O que você tem e o que falta?",
        single: true,
        tag: "processo",
      },
      {
        id: 63,
        text: "Qual é o prazo máximo para lançar notas, horas, fretes e terceiros APÓS a entrega?",
        hint: "Sugerido: 5 dias úteis. Depois disso, obra 'trava' e custos atrasados viram exceção com aprovação.",
        single: true,
        tag: "governança",
      },
      {
        id: 64,
        text: "Qual é o ritual de fechamento (30 min) e quem participa?",
        hint: "Participantes: coordenador de obras, compras, financeiro, pós-obra. Pauta: custos vs orçado, qualidade, prazos, lições.",
        single: true,
        tag: "processo",
      },
      {
        id: 65,
        text: "Como você lida com custos que chegam DEPOIS do fechamento?",
        hint: "Nota atrasada, garantia acionada 30 dias depois. Cria 'reserva de garantia' e fecha com ajustes posteriores?",
        single: true,
        tag: "sistema",
      },
      {
        id: 66,
        text: "Qual é a definição de MARGEM por obra que você vai usar?",
        hint: "Sugerido: Receita líquida – custos diretos – custos indiretos alocados – perdas – garantia. Qual a sua fórmula?",
        single: true,
        tag: "governança",
      },
      {
        id: 67,
        text: "Qual regra para 'custo de garantia' entrar na obra?",
        hint: "Janela sugerida: 30-60 dias pós-aceite para fechar definitivo. Depois disso, entra em provisão geral.",
        single: true,
        tag: "processo",
      },
      {
        id: 68,
        text: "O que hoje você NÃO consegue medir e suspeita que esconde margem negativa?",
        hint: "Pergunta que evita autoengano. Liste pelo menos 3 custos 'invisíveis' que você sabe que existem mas não mede.",
        single: true,
        tag: "brutal",
      },
      {
        id: 69,
        text: "Quantas obras dos últimos 12 meses tiveram fechamento formal com todos os custos apurados?",
        hint: "Se a resposta é 'nenhuma' ou 'poucas', esse é o maior gap do sistema.",
        single: true,
        tag: "brutal",
      },
      {
        id: 70,
        text: "Quem é responsável por garantir que TODA obra tem relatório final com margem calculada?",
        hint: "Sem dono, não acontece. Financeiro? Coordenador? Diretoria cobra?",
        single: true,
        tag: "governança",
      },
    ],
  },

  /* ─── BLOCO 8 · Relatórios semanais e final ─── */
  {
    id: "relatorios",
    number: 8,
    title: "Design dos Relatórios",
    subtitle: "Relatório semanal por obra e relatório final de entrega",
    icon: "📊",
    questions: [
      {
        id: 71,
        text: "RELATÓRIO SEMANAL — Qual foi o avanço da semana em unidades (m², módulos, degraus)?",
        hint: "Campo 1 do relatório. A pergunta é: você consegue medir isso TODA semana? Se não, o que impede?",
        single: true,
        tag: "sistema",
      },
      {
        id: 72,
        text: "RELATÓRIO SEMANAL — Quantas horas totais foram gastas e quantas foram improdutivas?",
        hint: "Campo 2. Precisa do apontamento diário funcionando. Qual é o threshold aceitável de improdutividade? 10%? 20%?",
        single: true,
        tag: "sistema",
      },
      {
        id: 73,
        text: "RELATÓRIO SEMANAL — Quais top 3 motivos de improdutividade e seu custo em R$?",
        hint: "Campo 3. Horas improdutivas × custo hora = R$ queimados. Quais categorias você quer ver?",
        single: true,
        tag: "processo",
      },
      {
        id: 74,
        text: "RELATÓRIO SEMANAL — Previsto vs realizado no cronograma (baseline vs real)?",
        hint: "Campo 4. Qual gate deveria ter passado e não passou? Quantos dias de atraso acumulado?",
        single: true,
        tag: "sistema",
      },
      {
        id: 75,
        text: "RELATÓRIO SEMANAL — Materiais críticos em risco (lead time ou estoque)?",
        hint: "Campo 5. Itens que podem parar a obra na próxima semana. Quem monitora?",
        single: true,
        tag: "processo",
      },
      {
        id: 76,
        text: "RELATÓRIO SEMANAL — Quantas NCs abriram e quantas fecharam esta semana?",
        hint: "Campo 6. NC aberta > 5 dias úteis sem resolução = escalonamento automático.",
        single: true,
        tag: "sistema",
      },
      {
        id: 77,
        text: "RELATÓRIO SEMANAL — FPY da semana por equipe?",
        hint: "Campo 7. Entregas aprovadas de primeira / total de entregas. Ranking de equipes.",
        single: true,
        tag: "sistema",
      },
      {
        id: 78,
        text: "RELATÓRIO SEMANAL — Custo acumulado vs orçamento por centro de custo?",
        hint: "Campo 8. Barras de progressão: MO, material, frete, terceiro, retrabalho. Onde está estourando?",
        single: true,
        tag: "sistema",
      },
      {
        id: 79,
        text: "RELATÓRIO SEMANAL — Score de risco da obra e por quê?",
        hint: "Campo 9. Score 0-100 baseado nos leading indicators. Ações recomendadas com dono e prazo.",
        single: true,
        tag: "sistema",
      },
      {
        id: 80,
        text: "RELATÓRIO SEMANAL — Quais decisões precisam do fundador esta semana?",
        hint: "Campo 10. Máximo 3 decisões que SÓ o fundador pode tomar. Restante é delegável.",
        single: true,
        tag: "governança",
      },
      {
        id: 81,
        text: "RELATÓRIO FINAL — Datas baseline vs real por gate, total de dias?",
        hint: "Campo 1 do fechamento. Quanto a obra deveria ter durado vs quanto durou. Por gate.",
        single: true,
        tag: "sistema",
      },
      {
        id: 82,
        text: "RELATÓRIO FINAL — Produção total por tipologia e produtividade média (unidade/hora)?",
        hint: "Campo 2. Total de m²/módulos/degraus + horas totais = produtividade real da obra.",
        single: true,
        tag: "sistema",
      },
      {
        id: 83,
        text: "RELATÓRIO FINAL — Horas totais por equipe e por etapa?",
        hint: "Campo 3. Cada equipe que trabalhou, quantas horas, em quais etapas. Benchmark para futuro.",
        single: true,
        tag: "sistema",
      },
      {
        id: 84,
        text: "RELATÓRIO FINAL — Custo total por centro de custo?",
        hint: "Campo 4. MO produção, MO obra, supervisão, material, frete, terceiro, retrabalho, garantia, overhead.",
        single: true,
        tag: "sistema",
      },
      {
        id: 85,
        text: "RELATÓRIO FINAL — Perdas totais: retrabalho, fretes extras, urgências, garantia?",
        hint: "Campo 5. Somar todas as 'perdas evitáveis' em R$. Esse número precisa doer.",
        single: true,
        tag: "brutal",
      },
      {
        id: 86,
        text: "RELATÓRIO FINAL — Qualidade: NC total, FPY geral, top 5 defeitos?",
        hint: "Campo 6. Resumo de qualidade da obra inteira. Comparável com histórico.",
        single: true,
        tag: "sistema",
      },
      {
        id: 87,
        text: "RELATÓRIO FINAL — Mudanças e aditivos: quantidade, receita extra, impacto em prazo?",
        hint: "Campo 7. Quantas mudanças aconteceram, quanto geraram de receita (ou custo) e quanto atrasaram.",
        single: true,
        tag: "sistema",
      },
      {
        id: 88,
        text: "RELATÓRIO FINAL — Receita líquida do projeto e margem (industrial e full)?",
        hint: "Campo 8. O número final. Receita – custos = margem. Se negativa, precisa de post-mortem.",
        single: true,
        tag: "brutal",
      },
      {
        id: 89,
        text: "RELATÓRIO FINAL — Ranking de performance das equipes e causas?",
        hint: "Campo 9. Quem performou bem, quem não. Com dados (produtividade, FPY, NCs). Sem opinião.",
        single: true,
        tag: "sistema",
      },
      {
        id: 90,
        text: "RELATÓRIO FINAL — Lições aprendidas: 3 padrões para atualizar?",
        hint: "Campo 10. O que repetir, o que corrigir, o que eliminar. Vira input para próxima obra similar.",
        single: true,
        tag: "destrava",
      },
    ],
  },

  /* ─── BLOCO 9 · Disciplina e agente IA ─── */
  {
    id: "disciplina-ia",
    number: 9,
    title: "Disciplina e Agente IA de Produtividade",
    subtitle: "Regras para rodar redondo + design do agente automático",
    icon: "🤖",
    questions: [
      {
        id: 91,
        text: "Qual disciplina você vai impor: sem apontamento diário, não fecha a semana?",
        hint: "Regra sugerida: se até sexta 12h não tem apontamento completo, coordenador recebe alerta e obra fica 'vermelha'.",
        single: true,
        tag: "governança",
      },
      {
        id: 92,
        text: "Quem é o DONO do fechamento semanal dos apontamentos?",
        hint: "Uma pessoa por obra responsável por garantir que todos os dados estão corretos e completos até sexta.",
        single: true,
        tag: "governança",
      },
      {
        id: 93,
        text: "Quem valida inconsistência (horas demais, produção zero, falta de evidência)?",
        hint: "Agente IA detecta, mas quem resolves? Coordenador? Líder de equipe? Financeiro?",
        single: true,
        tag: "processo",
      },
      {
        id: 94,
        text: "Qual limite aceitável de apontamento ESTIMADO vs MEDIDO?",
        hint: "Ex: se > 20% das horas são estimadas (não medidas com hora início/fim), o sistema sinaliza baixa confiabilidade.",
        single: true,
        tag: "governança",
      },
      {
        id: 95,
        text: "Como evitar que o time 'otimize para a métrica' e piore qualidade?",
        hint: "Ex: equipe acelera para mostrar m²/dia alto mas FPY cai. Regra: produtividade SÓ conta com FPY > 85%.",
        single: true,
        tag: "brutal",
      },
      {
        id: 96,
        text: "Qual sistema é a fonte de verdade de horas, custos e cronograma?",
        hint: "ERP? CRM? Planilha? Se mais de um, qual prevalece? Se nenhum, precisa definir antes de rodar IA.",
        single: true,
        tag: "sistema",
      },
      {
        id: 97,
        text: "Quais 12 campos o agente IA deve EXIGIR para fechar a semana de uma obra?",
        hint: "Sugestão: horas por equipe, m² executado, fotos, NCs abertas/fechadas, retrabalho h/R$, motivos de improdutividade, custo acumulado, bloqueios, gates status, score risco, materiais em risco, decisões pendentes.",
        single: true,
        tag: "sistema",
      },
      {
        id: 98,
        text: "Quais regras de validação automática o agente aplica?",
        hint: "Ex: horas sem produção, produção sem foto, frente não liberada com horas, frete extra sem motivo, NC fechada sem evidência.",
        single: true,
        tag: "sistema",
      },
      {
        id: 99,
        text: "Quais alertas o agente dispara e PARA QUEM?",
        hint: "Coordenador: apontamento incompleto, NC aberta. Compras: material em risco. Financeiro: desvio de custo. Fundador: War Room.",
        single: true,
        tag: "processo",
      },
      {
        id: 100,
        text: "Em quais casos o agente BLOQUEIA o fechamento da semana?",
        hint: "Sugestão: falta de evidência fotográfica, falta de apontamento de 2+ dias, divergência > 30% sem justificativa.",
        single: true,
        tag: "governança",
      },
      {
        id: 101,
        text: "O agente gera quais relatórios automaticamente?",
        hint: "3 relatórios: semanal por obra, consolidado semanal (todas as obras), fechamento final pós-aceite.",
        single: true,
        tag: "sistema",
      },
      {
        id: 102,
        text: "Qual é o benchmark de produtividade que você quer atingir em 90 dias?",
        hint: "Ex: piso > 8 m²/dia/equipe com FPY > 90%. Marcenaria > X módulos/dia. Defina metas realistas.",
        single: true,
        tag: "destrava",
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   ENTREGA PRÁTICA — 8 DIAGNÓSTICOS FINAIS
   ═══════════════════════════════════════════════════════════ */

export const prodFinalItems: ProdFinalItem[] = [
  {
    id: "tipologias",
    label: "Quais tipologias medir primeiro (piso/forro/deck/escada/marcenaria)?",
    hint: "Escolha 2-3 para pilotar. Não tente tudo de uma vez.",
    single: true,
  },
  {
    id: "apontamento-atual",
    label: "Como hoje você aponta horas em obra e em produção (se aponta)?",
    hint: "Descreva o processo atual, mesmo que seja informal ou inexistente.",
    single: true,
  },
  {
    id: "unidades-producao",
    label: "Quais são suas unidades atuais de produção (m², módulos, degraus)?",
    hint: "Liste por tipologia o que você já usa como referência.",
    single: true,
  },
  {
    id: "custo-hora",
    label: "Você já tem custo hora por perfil ou precisa construir?",
    hint: "Se tem, liste os perfis calculados. Se não tem, liste os perfis que precisa calcular.",
    single: true,
  },
  {
    id: "onde-dados-horas",
    label: "Onde estão os dados de HORAS e CRONOGRAMA hoje?",
    hint: "ERP, planilha, WhatsApp, papel, cabeça de alguém? Qual o ponto de partida?",
    single: true,
  },
  {
    id: "onde-dados-material",
    label: "Onde estão os dados de MATERIAL consumido e FRETES?",
    hint: "ERP, nota fiscal manual, planilha de compras? Consegue vincular à obra?",
    single: true,
  },
  {
    id: "onde-dados-nc",
    label: "Onde estão os dados de NC, RECEITA e ADITIVOS?",
    hint: "Sistema de qualidade, planilha, proposta comercial? Consegue cruzar com custo?",
    single: true,
  },
  {
    id: "maior-gap",
    label: "Qual é o MAIOR gap que te impede de ter margem real por obra HOJE?",
    hint: "Uma frase: o que está faltando para você saber exatamente quanto lucrou (ou perdeu) em cada projeto.",
    single: true,
  },
];

/* ─── Totals ─── */
export const PROD_TOTAL_QUESTIONS = prodSections.reduce((sum, s) => sum + s.questions.length, 0);
export const PROD_TOTAL_FINAL_ITEMS = prodFinalItems.length;
