import { type SlideData } from "./slides-data";

/* ─── Image URLs ─── */
const IMG_BOARD = "https://images.unsplash.com/photo-1759774310455-80dba1348cbd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxleGVjdXRpdmUlMjBib2FyZHJvb20lMjBkYXJrJTIwbHV4dXJ5fGVufDF8fHx8MTc3MTgwNDQ1M3ww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_LEGACY = "https://images.unsplash.com/photo-1561710309-cc4cd327effa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBidXNpbmVzcyUyMGxlZ2FjeSUyMGdlbmVyYXRpb25zfGVufDF8fHx8MTc3MTgwNDQ1NHww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_CHESS = "https://images.unsplash.com/photo-1771329967720-007011410986?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJhdGVnaWMlMjBwbGFubmluZyUyMGNoZXNzJTIwbGVhZGVyc2hpcHxlbnwxfHx8fDE3NzE4MDQ0NTR8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_MEETING = "https://images.unsplash.com/photo-1765438869297-6fa4b627906a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3Jwb3JhdGUlMjBtZWV0aW5nJTIwc3RyYXRlZ3klMjB3aGl0ZWJvYXJkfGVufDF8fHx8MTc3MTgwNDQ1NXww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_TREE = "https://images.unsplash.com/photo-1721572204449-d4e315e8fae2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvYWslMjB0cmVlJTIwcm9vdHMlMjBzdHJlbmd0aCUyMG5hdHVyZXxlbnwxfHx8fDE3NzE4MDQ0NTZ8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_SHOWROOM = "https://images.unsplash.com/photo-1765181539706-361512106019?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBzaG93cm9vbSUyMGludGVyaW9yJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzcxODA0NDU2fDA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_COMPASS = "https://images.unsplash.com/photo-1603623898218-0cb7f493309b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21wYXNzJTIwZGlyZWN0aW9uJTIwbmF2aWdhdGlvbiUyMHB1cnBvc2V8ZW58MXx8fHwxNzcxODA0NDU2fDA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_TIMBER = "https://images.unsplash.com/photo-1763926025678-95d196d0ab28?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b29kJTIwdGltYmVyJTIwc3RhY2tlZCUyMHdhcmVob3VzZXxlbnwxfHx8fDE3NzE4MDQ0NTl8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_TEAM = "https://images.unsplash.com/photo-1758873268663-5a362616b5a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjB0ZWFtJTIwY29sbGFib3JhdGlvbnxlbnwxfHx8fDE3NzE3NDYyNjl8MA&ixlib=rb-4.1.0&q=80&w=1080";

export const strategicPlanSlides: SlideData[] = [
  /* ═══════════════════════════════════════════════════════
     CAPA
     ═══════════════════════════════════════════════════════ */
  {
    type: "cover",
    props: {
      title: "Plano Estratégico\n& Governança\nFamiliar",
      subtitle: "O documento-mestre do fundador. Visão, modelo de negócio, OKRs, governança, sucessão, gestão de pessoas, finanças, riscos e rituais de liderança.",
      image: IMG_BOARD,
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 01 — PROPÓSITO & IDENTIDADE ESTRATÉGICA
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 01",
      title: "Propósito &\nIdentidade\nEstratégica",
      subtitle: "A fundação imutável sobre a qual toda estratégia é construída.",
    },
  },
  {
    type: "split",
    props: {
      title: "De Onde\nViemos",
      image: IMG_LEGACY,
      label: "Legado",
      content: "A Parket nasceu da convicção de que madeira é mais que material — é expressão de quem vive ali. Três gerações depois, a convicção se tornou método.",
      items: [
        "Geração 1 — O Artesão: Domínio da matéria-prima. Aprender a ouvir a madeira.",
        "Geração 2 — O Construtor: Escalar sem perder a alma. Processos + artesanato.",
        "Geração 3 — O Estrategista: Profissionalizar, digitalizar, perpetuar.",
        "O que permanece: Obsessão por qualidade, respeito à madeira, compromisso com o cliente.",
        "O que muda: Escala, tecnologia, governança, velocidade de decisão.",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Missão, Visão\n& Propósito",
      label: "Identidade",
      highlight: "Propósito: Transformar espaços em legados, um piso de cada vez.",
      items: [
        "MISSÃO — Entregar a mais alta expressão de pisos e revestimentos em madeira no Brasil, combinando artesanato geracional com engenharia de precisão.",
        "VISÃO 2030 — Ser reconhecida como a empresa definitiva de pisos premium no Brasil: referência em qualidade, inovação e gestão no segmento.",
        "VALORES — Excelência sem atalho · Transparência radical · Obsessão pelo detalhe · Respeito à madeira e às pessoas · Compromisso geracional.",
        "MANIFESTO — \"Não vendemos pisos. Criamos a base sobre a qual famílias constroem suas memórias.\"",
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "A estratégia de uma empresa familiar não é sobre o próximo trimestre.\nÉ sobre os próximos trinta anos.",
      attribution: "Princípio Fundador",
      label: "Norte",
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 02 — DIAGNÓSTICO ESTRATÉGICO
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 02",
      title: "Diagnóstico\nEstratégico",
      subtitle: "SWOT, forças competitivas e o fosso estratégico da Parket.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Análise SWOT",
      label: "Forças & Fraquezas",
      leftTitle: "S — Forças",
      leftItems: [
        "3 gerações de know-how técnico — impossível de replicar rápido",
        "Equipe de instaladores próprios e treinados (raro no mercado)",
        "Portfólio de obras complexas que funciona como barreira de entrada",
        "Marca com percepção premium já estabelecida no nicho",
        "Verticalização: do orçamento à manutenção pós-entrega",
        "Relacionamento profundo com arquitetos especificadores",
      ],
      rightTitle: "W — Fraquezas",
      rightItems: [
        "Dependência de poucos profissionais-chave na instalação",
        "Processos ainda parcialmente informais (em digitalização)",
        "Capacidade de produção limitada — crescimento gera gargalo",
        "Concentração geográfica (grande SP) limita escala",
        "Custo de aquisição de talento artesanal alto e crescente",
        "Gestão financeira granular por projeto ainda em implantação",
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Análise SWOT",
      label: "Oportunidades & Ameaças",
      leftTitle: "O — Oportunidades",
      leftItems: [
        "Mercado de reforma alto padrão crescendo 12% a.a. em SP",
        "Digitalização do canal de vendas (e-showroom, configurador 3D)",
        "Expansão para mercado corporativo (hotéis, escritórios, hospitality)",
        "Parcerias com construtoras de alto padrão para especificação de fábrica",
        "Educação do mercado: conteúdo posiciona a marca como autoridade",
        "Engineered wood: produto de entrada que atrai novos segmentos",
      ],
      rightTitle: "T — Ameaças",
      rightItems: [
        "Porcelanato madeira: alternativa cada vez mais realista e barata",
        "Importações de engineered flooring (Europa, China) com preço agressivo",
        "Escassez de madeira certificada e pressão regulatória ambiental",
        "Inflação de custos (madeira, mão de obra, logística)",
        "Commoditização do segmento por empresas que competem só por preço",
        "Ciclo econômico: mercado de alto padrão sensível a crises",
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "O Fosso\nEstratégico",
      image: IMG_CHESS,
      label: "Competitive Moat",
      content: "O fosso da Parket não é um único diferencial — é a combinação de 5 camadas defensivas que se reforçam mutuamente.",
      items: [
        "CAMADA 1 — Capital Humano: Instaladores com 10+ anos de formação interna. Não se contrata no mercado.",
        "CAMADA 2 — Portfólio de Complexidade: Obras que concorrentes recusam. Cada projeto-referência amplia o fosso.",
        "CAMADA 3 — Rede de Arquitetos: 200+ especificadores com relacionamento de confiança. Lock-in de especificação.",
        "CAMADA 4 — Know-How Geracional: Conhecimento tácito transmitido há 3 gerações. Não está em manuais.",
        "CAMADA 5 — Marca Premium: Percepção construída em décadas. Um novo entrante precisa de 10+ anos para equiparar.",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 03 — MODELO DE NEGÓCIO
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 03",
      title: "Modelo de\nNegócio",
      subtitle: "Revenue streams, unit economics e alavancas de rentabilidade.",
    },
  },
  {
    type: "grid",
    props: {
      title: "Linhas de\nReceita",
      label: "Business Model",
      cards: [
        { icon: "🪵", title: "Revestimentos", description: "60% da receita. Pisos maciços, engineered, herringbone, chevron. Ticket médio R$180K. Margem bruta 42%." },
        { icon: "🪑", title: "Marcenaria Complexa", description: "20% da receita. Painéis, escadas, decks especiais. Ticket médio R$95K. Margem bruta 38%." },
        { icon: "🔧", title: "Manutenção & Restauro", description: "12% da receita. Lixamento, reparo, tratamento. Ticket médio R$22K. Margem bruta 55%. Recorrente." },
        { icon: "📐", title: "Consultoria Técnica", description: "5% da receita. Especificação para construtoras e arquitetos. Ticket médio R$15K. Margem bruta 70%." },
        { icon: "📦", title: "Fornecimento (B2B)", description: "3% da receita. Venda de material para construtoras. Ticket médio R$65K. Margem bruta 25%. Escala." },
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "Unit Economics\nPor Projeto",
      label: "Economia da Unidade",
      metrics: [
        { value: "R$145K", label: "Ticket Médio Ponderado", description: "Considerando mix de revestimento + marcenaria" },
        { value: "41%", label: "Margem Bruta Média", description: "Após materiais + mão de obra direta" },
        { value: "18%", label: "Margem Líquida Target", description: "Meta pós overhead operacional e administrativo" },
        { value: "R$3.2K", label: "CAC Médio", description: "Custo de aquisição (marketing + comercial)" },
        { value: "45:1", label: "LTV/CAC", description: "Lifetime value incluindo manutenção e indicações" },
        { value: "72 dias", label: "Ciclo Médio de Venda", description: "Do primeiro contato ao fechamento do contrato" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Alavancas de\nRentabilidade",
      label: "Margem & Escala",
      highlight: "7 alavancas que podem aumentar a margem líquida de 18% para 25% em 24 meses sem aumentar preço.",
      items: [
        "1. REDUÇÃO DE PERDAS: Corte de desperdício de material de 8% para 3% (Plano Ops 90 dias)",
        "2. PRODUTIVIDADE: m²/dia por equipe de 12 para 16 com melhor planejamento de obra",
        "3. MIX SHIFT: Aumentar participação de manutenção/restauro (margem 55%) de 12% para 18%",
        "4. CONSULTORIA: Escalar receita de especificação com custo marginal quase zero",
        "5. PRICING POWER: Reajuste anual acima da inflação sustentado por percepção premium",
        "6. OVERHEAD: Automação de processos administrativos (orçamentação, compras, financeiro)",
        "7. CANAL DIGITAL: Leads orgânicos reduzem CAC em 40% vs. mídia paga exclusiva",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 04 — METAS & OKRs
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 04",
      title: "Sistema de\nOKRs",
      subtitle: "Objetivos e resultados-chave cascateados do topo até cada colaborador.",
    },
  },
  {
    type: "content",
    props: {
      title: "OKRs da\nEmpresa — 2026",
      label: "Company-Level",
      highlight: "3 objetivos estratégicos com 4 key results cada. Revisão trimestral, score de 0 a 1.0.",
      items: [
        "O1: CRESCER RECEITA COM RENTABILIDADE",
        "  KR1: Receita anual de R$12M → R$16M (+33%)",
        "  KR2: Margem líquida de 15% → 20%",
        "  KR3: 85% dos projetos entregues dentro do orçamento aprovado",
        "  KR4: Pipeline comercial saudável: 3x o target trimestral em oportunidades",
        "",
        "O2: CONSTRUIR MÁQUINA OPERACIONAL DE CLASSE MUNDIAL",
        "  KR1: Zero retrabalhos críticos (> R$5K) em 3 meses consecutivos",
        "  KR2: NPS de entrega ≥ 85",
        "  KR3: 100% das obras com gates formais implementados (G0-G4/GM0-GM4)",
        "  KR4: Perda de material ≤ 3% do orçamento por projeto",
        "",
        "O3: PERPETUAR A EMPRESA PARA A PRÓXIMA GERAÇÃO",
        "  KR1: Protocolo de governança familiar assinado por todos os membros",
        "  KR2: Programa de sucessão em andamento com 2+ candidatos mapeados",
        "  KR3: 90% dos processos-chave documentados e independentes de uma pessoa",
        "  KR4: Reserva estratégica equivalente a 6 meses de despesa fixa",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "OKRs por\nDepartamento",
      label: "Cascateamento",
      cards: [
        {
          icon: "💰",
          title: "Comercial",
          description: "O: Gerar demanda qualificada e converter com eficiência. KR: 40 leads/mês qualificados · Taxa de conversão 25% · Ticket médio +10%.",
        },
        {
          icon: "🔨",
          title: "Operações",
          description: "O: Entregar obras no prazo, no custo e com qualidade. KR: 90% on-time · Perda < 3% · NPS obra ≥ 85 · Zero retrabalho crítico.",
        },
        {
          icon: "📣",
          title: "Marketing",
          description: "O: Posicionar Parket como top-of-mind premium. KR: 25K seguidores IG · 150 leads/mês via digital · Brand awareness 60%.",
        },
        {
          icon: "👥",
          title: "Pessoas & Cultura",
          description: "O: Reter e desenvolver o melhor time do segmento. KR: Turnover < 8% · eNPS ≥ 70 · 100% das posições-chave com backup.",
        },
        {
          icon: "💵",
          title: "Financeiro",
          description: "O: Gestão financeira granular e preditiva. KR: Fechamento em D+3 · Forecast ±5% · Cash flow positivo 12 meses · DRE por projeto.",
        },
        {
          icon: "🤖",
          title: "Tecnologia & IA",
          description: "O: Digitalizar e automatizar processos-chave. KR: 8 agentes IA operando · CRM 100% adotado · ERP integrado · Orçamento automático.",
        },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Cadência de\nReview de OKRs",
      label: "Ritmo de Gestão",
      steps: [
        { number: "S", title: "Check-in Semanal (15min)", description: "Cada líder revisa progresso dos KRs com o time. Atualiza score (0-1.0). Identifica bloqueios. Escala impedimentos." },
        { number: "M", title: "Review Mensal (1h)", description: "Reunião de liderança. Dashboard de OKRs consolidado. Score por departamento. Realocar recursos se necessário. 3 decisões por meeting." },
        { number: "T", title: "Review Trimestral (meio-dia)", description: "Avaliação final do ciclo. Score médio por OKR. Celebrar ≥ 0.7. Analisar < 0.4. Definir OKRs do próximo trimestre." },
        { number: "A", title: "Planning Anual (2 dias)", description: "Offsite de liderança. Revisão estratégica. SWOT atualizado. OKRs anuais. Budget. Projetos estratégicos. Priorização." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 05 — ESTRUTURA ORGANIZACIONAL
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 05",
      title: "Estrutura\nOrganizacional",
      subtitle: "Design organizacional, papéis-chave e accountability matrix.",
    },
  },
  {
    type: "process",
    props: {
      title: "Organograma\nFuncional",
      label: "Estrutura",
      steps: [
        { number: "C-1", title: "CEO / Fundador", description: "Visão estratégica, governança familiar, relações institucionais, decisões de investimento >R$100K, cultura. Accountability final." },
        { number: "C-2", title: "Diretor Comercial", description: "Vendas, marketing, CRM, partnerships com arquitetos. Meta: receita + margem. Reports: SDR, Closer, Marketing." },
        { number: "C-2", title: "Diretor de Operações", description: "Execução de obras, compras, logística, qualidade, instalação. Meta: prazo + custo + qualidade. Reports: Coordenadores, Mestres." },
        { number: "C-2", title: "Gestor Financeiro/Admin", description: "Controladoria, RH, jurídico, TI. Meta: margem + cash flow + compliance. Reports: Financeiro, DP, Admin." },
        { number: "C-3", title: "Coordenadores de Obra (2-3)", description: "Cada um gerencia 4-6 obras simultâneas. Responsável por gates, timeline, custo. Report diário ao Dir. Ops." },
        { number: "C-3", title: "Mestres Instaladores (4-6)", description: "Líderes de equipe de campo. 2-3 auxiliares cada. Responsável pela execução técnica e qualidade final." },
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "As 5 Contratações\nMais Estratégicas",
      image: IMG_TEAM,
      label: "Prioridade de Hiring",
      content: "Cada contratação estratégica deve ser tratada como um investimento, não como um custo. Estas 5 posições destravam o próximo nível de escala.",
      items: [
        "1. COORDENADOR DE OBRAS SÊNIOR — Libera o fundador das operações diárias. Payback: 3 meses.",
        "2. ANALISTA FINANCEIRO/CONTROLLER — DRE por projeto, cash flow, forecast. Visibilidade = decisão.",
        "3. SOCIAL MEDIA MANAGER — Execução diária do playbook de social media. Demanda constante.",
        "4. MESTRE INSTALADOR SÊNIOR — Cada mestre multiplica capacidade em +R$2M/ano de receita.",
        "5. ASSISTENTE COMERCIAL/SDR — Motor de prospecção. Pipeline saudável = receita previsível.",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 06 — GOVERNANÇA FAMILIAR
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 06",
      title: "Governança\nFamiliar",
      subtitle: "O sistema que separa família de negócio — e protege ambos.",
    },
  },
  {
    type: "split",
    props: {
      title: "Por que Governança\nFamiliar é Urgente",
      image: IMG_TREE,
      label: "Contexto",
      content: "70% das empresas familiares não sobrevivem à segunda geração. 90% não sobrevivem à terceira. A Parket está na transição mais crítica — da terceira geração em diante.",
      items: [
        "Sem governança: Decisões são emocionais. Papéis são ambíguos. Conflitos são destrutivos.",
        "Com governança: Decisões são informadas. Papéis são claros. Conflitos são produtivos.",
        "O protocolo familiar não é burocracia — é o seguro de vida da empresa.",
        "Deve ser assinado por TODOS os membros da família, incluindo os que não trabalham na empresa.",
        "Revisão a cada 3 anos, ou quando houver mudança estrutural (casamento, filho, saída).",
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Estrutura de\nGovernança",
      label: "Órgãos",
      steps: [
        { number: "01", title: "Conselho de Família", description: "Todos os familiares. Reúne 2x/ano. Define valores, legado, educação dos herdeiros, uso da marca familiar. NÃO discute operação." },
        { number: "02", title: "Conselho Consultivo", description: "Fundador + 2 conselheiros externos independentes. Reúne bimestralmente. Orienta estratégia, aprova investimentos >R$200K, avalia CEO." },
        { number: "03", title: "Diretoria Executiva", description: "CEO + diretores. Reúne semanalmente. Opera o negócio. Executa a estratégia aprovada. Reporta ao conselho consultivo." },
        { number: "04", title: "Protocolo de Entrada de Familiares", description: "Familiar só entra na empresa após: graduação + 3 anos de experiência EXTERNA + aprovação do conselho consultivo + cargo com job description formal." },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Regras de Ouro\nda Governança",
      label: "Protocolo Familiar",
      cards: [
        { icon: "🔑", title: "Separação de Papéis", description: "Ser dono ≠ ser gestor ≠ ser familiar. Cada papel tem direitos e deveres diferentes, explícitos por escrito." },
        { icon: "💰", title: "Política de Dividendos", description: "Distribuição fixa: 30% do lucro líquido. Restante reinvestido. Retirada extra = aprovação unânime do conselho." },
        { icon: "⚖️", title: "Resolução de Conflitos", description: "Divergências família vs. empresa → mediador externo. Nenhum conflito familiar entra no ambiente de trabalho." },
        { icon: "📋", title: "Avaliação de Performance", description: "Familiares na empresa são avaliados como qualquer colaborador. Mesmos KPIs, mesmo feedback, mesma consequência." },
        { icon: "🚪", title: "Porta de Saída", description: "Qualquer membro pode sair a qualquer momento. Acordo de acionistas define: valoração, prazo de pagamento, non-compete." },
        { icon: "📚", title: "Educação de Herdeiros", description: "Programa estruturado para a próxima geração: exposição ao negócio, mentoria, estágio externo, formação em gestão." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 07 — PLANEJAMENTO DE SUCESSÃO
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 07",
      title: "Planejamento\nde Sucessão",
      subtitle: "O roadmap para garantir que a empresa transcenda qualquer indivíduo.",
    },
  },
  {
    type: "process",
    props: {
      title: "Roadmap de\nSucessão — 5 Anos",
      label: "Plano de Transição",
      steps: [
        { number: "ANO 1", title: "Documentar & Separar", description: "100% dos processos documentados. Fundador sai de 2+ processos operacionais. Conselho consultivo formado. Protocolo familiar redigido." },
        { number: "ANO 2", title: "Desenvolver & Testar", description: "Candidatos internos assumem projetos estratégicos. Avaliação 360° formal. Fundador passa a 70% estratégico, 30% operacional." },
        { number: "ANO 3", title: "Delegar & Validar", description: "Sucessor potencial gerencia um trimestre inteiro sem intervenção. KPIs monitorados. Conselho avalia performance e fit cultural." },
        { number: "ANO 4", title: "Transição Gradual", description: "Co-gestão formal: fundador + sucessor. Decisões conjuntas. Cliente e mercado são apresentados ao novo líder." },
        { number: "ANO 5", title: "Formalizar & Perpetuar", description: "Sucessor assume CEO. Fundador move para presidente do conselho. Revisão do acordo de acionistas. Novo ciclo de planejamento." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Critérios de\nSeleção do Sucessor",
      label: "Perfil Ideal",
      highlight: "O sucessor não precisa ser uma cópia do fundador — precisa ser a versão que a empresa necessita para o próximo ciclo.",
      items: [
        "COMPETÊNCIA TÉCNICA: Entende de madeira, obra e produto. Pode conversar com o mestre instalador e com o arquiteto.",
        "VISÃO DE NEGÓCIO: Lê um DRE, entende margem, faz conta de pricing. Não precisa ser financeiro, mas precisa pensar como dono.",
        "LIDERANÇA: Pessoas querem segui-lo. Inspira sem impor. Delega sem abandonar. Cobra sem humilhar.",
        "RESILIÊNCIA: Já errou, assumiu e corrigiu. Obras complexas dão errado — o que conta é a reação.",
        "VALORES: Internaliza o DNA Parket. Não é algo que se ensina em MBA — é algo que se vive.",
        "HUMILDADE: Sabe o que não sabe. Busca mentoria. Valoriza o conselho. Escuta antes de decidir.",
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Posições-Chave com\nPlano de Backup",
      label: "Key Person Risk",
      leftTitle: "Posição",
      leftItems: [
        "CEO / Fundador — Risco CRÍTICO",
        "Diretor Comercial — Risco ALTO",
        "Mestre Instalador Sênior — Risco ALTO",
        "Coordenador de Obras — Risco MÉDIO",
        "Gestor Financeiro — Risco MÉDIO",
        "Social Media Manager — Risco BAIXO",
      ],
      rightTitle: "Plano de Contingência",
      rightItems: [
        "Conselho + Dir. Comercial assumem interinamente. Protocolo ativado em 24h.",
        "SDR Sênior promovido + fundador assume carteira-chave por 90 dias.",
        "Segundo mestre assume. Backup em treinamento com shadowing semanal.",
        "Dir. Ops absorve 50%. Segundo coordenador assume o restante.",
        "Contador externo + fundador. Migração em 30 dias para novo gestor.",
        "Agência parceira assume emergencialmente. Playbook documentado.",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 08 — GESTÃO DE PESSOAS & CULTURA
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 08",
      title: "Gestão de\nPessoas &\nCultura",
      subtitle: "Atrair, desenvolver e reter o time que sustenta a excelência.",
    },
  },
  {
    type: "content",
    props: {
      title: "Código de Cultura\nParket",
      label: "Culture Code",
      highlight: "Cultura não é o que está na parede do escritório — é o que acontece quando ninguém está olhando.",
      items: [
        "1. DONO DO DETALHE: Cada mm importa. Se está bom mas não está perfeito, não acabou.",
        "2. FALA DIRETO: Feedback no momento, na cara, com respeito. Não existe 'deixa pra depois'.",
        "3. A OBRA É DO TIME: Ninguém brilha sozinho. O mestre, o coordenador e o comercial entregam juntos.",
        "4. ENSINA O PRÓXIMO: Conhecimento que não é passado, morre. Todo sênior tem a obrigação de formar.",
        "5. RESOLVE, DEPOIS RECLAMA: Problema na obra? Resolve agora, analisa depois, previne para sempre.",
        "6. MADEIRA MERECE RESPEITO: Cada tábua tem uma história. Desperdício é inaceitável — técnico e moral.",
        "7. O CLIENTE VÊ O QUE NÃO DIZEMOS: Tom de voz no WhatsApp, pontualidade na obra, limpeza no fim do dia. Tudo comunica.",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Sistema de\nPerformance",
      label: "Avaliação & Desenvolvimento",
      cards: [
        { icon: "🎯", title: "OKRs Individuais", description: "Cada colaborador tem 1-2 OKRs derivados do departamento. Definidos no início do trimestre, revisados mensalmente." },
        { icon: "💬", title: "1:1s Quinzenais", description: "30min líder-liderado. Pauta: bloqueios, feedback, desenvolvimento. Registrado. Não é cobrança — é suporte." },
        { icon: "📊", title: "Review Trimestral", description: "Avaliação 360°: auto + líder + pares. Score 1-5 em competências técnicas e comportamentais. Calibração em comitê." },
        { icon: "🏆", title: "Programa de Reconhecimento", description: "\"Mestre do Trimestre\" — reconhecimento público + bônus. Indicação por pares e coordenadores. Celebração no all-hands." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Retenção &\nRemuneração",
      label: "Compensation",
      highlight: "No mercado de mão de obra artesanal, perder um profissional sênior custa 12-18 meses de formação. Retenção é estratégia, não custo.",
      items: [
        "SALÁRIO BASE: P75 do mercado. Pagamos acima da média porque exigimos acima da média.",
        "BÔNUS POR OBRA: 2-5% da economia de material e prazo. Alinhamento direto de incentivos.",
        "PARTICIPAÇÃO NOS RESULTADOS (PLR): Trimestral, atrelada a OKRs do departamento. Transparência total.",
        "BENEFÍCIOS DIFERENCIADOS: Plano de saúde família, auxílio-educação filhos, adiantamento de 13°.",
        "CARREIRA TÉCNICA: Auxiliar → Instalador → Instalador Sênior → Mestre → Mestre Sênior. Cada nível com salário claro.",
        "PROGRAMA LEGADO: Para colaboradores com 10+ anos — participação especial, formação de sucessor, reconhecimento público.",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 09 — FINANÇAS & PRICING
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 09",
      title: "Finanças,\nPricing &\nRentabilidade",
      subtitle: "Visibilidade financeira granular e estratégia de precificação premium.",
    },
  },
  {
    type: "metrics",
    props: {
      title: "Metas Financeiras\n2026",
      label: "Targets Anuais",
      metrics: [
        { value: "R$16M", label: "Receita Bruta", description: "vs R$12M em 2025 (+33%)" },
        { value: "20%", label: "Margem Líquida", description: "vs 15% em 2025 (+5pp)" },
        { value: "R$3.2M", label: "Lucro Líquido", description: "Meta de resultado final" },
        { value: "6 meses", label: "Reserva de Caixa", description: "Colchão de segurança (despesa fixa)" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Metodologia de\nPricing Premium",
      label: "Precificação",
      highlight: "Pricing premium não é cobrar mais — é justificar mais. Cada centavo acima do mercado precisa ter uma razão que o cliente entenda.",
      items: [
        "1. CUSTO BASE: Material + mão de obra direta + logística. Atualização mensal de tabela de custos.",
        "2. OVERHEAD: Rateio proporcional de custos fixos. Alvo: 18% da receita (reduzir de 22% atual).",
        "3. MARGEM ALVO: 42% bruta / 20% líquida. Projetos abaixo de 35% bruta exigem aprovação do CEO.",
        "4. FATOR DE COMPLEXIDADE: Multiplicador 1.2-1.8x para obras especiais (herringbone, escadas, deck).",
        "5. PRICING PSICOLÓGICO: Proposta apresentada como investimento, não custo. Detalhamento que justifica.",
        "6. REAJUSTE ANUAL: INCC + 3-5% de ajuste de percepção. Comunicar com antecedência e justificativa.",
        "7. DESCONTO CONTROLADO: Máximo 5% e apenas para obras >R$200K ou referência estratégica. Aprovação direta.",
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Cadência\nFinanceira",
      label: "Rotina de Controle",
      steps: [
        { number: "D", title: "Check Diário (5min)", description: "Saldo de caixa, pagamentos do dia, recebimentos pendentes. App bancário + planilha. Responsável: Gestor Financeiro." },
        { number: "S", title: "Flash Report Semanal (30min)", description: "Receita da semana vs meta, custo real vs orçado por obra em andamento, aging de recebíveis. Alerta de desvios >10%." },
        { number: "M", title: "Fechamento Mensal (D+3)", description: "DRE completo. DRE por projeto (top 5). Cash flow realizado vs projetado. Reconciliação bancária. Report ao CEO." },
        { number: "T", title: "Review Trimestral Financeiro", description: "P&L trimestral vs budget. Variação de margem por linha. Forecast rolling 12 meses. Decisões de investimento." },
        { number: "A", title: "Budget Anual (Novembro)", description: "Orçamento do ano seguinte. Bottom-up por departamento. Validação pelo conselho. Aprovação formal com milestones." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 10 — ESTRATÉGIA DE CRESCIMENTO
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 10",
      title: "Estratégia de\nCrescimento",
      subtitle: "As 4 avenidas de crescimento para os próximos 5 anos.",
    },
  },
  {
    type: "split",
    props: {
      title: "Avenida 1\nExpansão Geográfica",
      image: IMG_SHOWROOM,
      label: "Growth Track #1",
      content: "De São Paulo capital para o interior, litoral e estados vizinhos. Modelo hub-and-spoke com showroom central + parceiros regionais.",
      items: [
        "FASE 1 (2026): Interior de SP — Campinas, Ribeirão, São José dos Campos. Via parceiros locais.",
        "FASE 2 (2027): Litoral (Guarujá, Riviera) + Curitiba. Showroom pop-up + operação de instalação.",
        "FASE 3 (2028): Rio de Janeiro + Brasília. Operação própria leve + mestres itinerantes.",
        "MODELO: Não abrir filial — usar parceiro local + equipe Parket de instalação viajante.",
        "KPI: Receita de novas praças = 20% do total em 3 anos.",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Avenidas 2, 3 & 4\nde Crescimento",
      label: "Growth Tracks",
      cards: [
        {
          icon: "🏨",
          title: "Av. 2 — Corporativo & Hospitality",
          description: "Hotéis, restaurantes, escritórios AAA. Ticket +3x. Ciclo de venda mais longo mas contratos recorrentes. Meta: 15% da receita em 3 anos.",
        },
        {
          icon: "🔄",
          title: "Av. 3 — Manutenção Recorrente",
          description: "Contratos anuais de manutenção preventiva. Margem 55%. Receita previsível. Escalar de 12% para 25% da receita em 3 anos.",
        },
        {
          icon: "🎓",
          title: "Av. 4 — Educação & Certificação",
          description: "Cursos de instalação e manutenção. Online + presencial. Formação de mercado gera pipeline de talento E receita. Fonte de autoridade.",
        },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 11 — GESTÃO DE RISCOS
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 11",
      title: "Gestão de\nRiscos",
      subtitle: "Mapeamento, classificação e planos de contingência para os riscos existenciais.",
    },
  },
  {
    type: "process",
    props: {
      title: "Matriz de\nRiscos Críticos",
      label: "Top 7 Riscos",
      steps: [
        { number: "R1", title: "Perda de Mestre Instalador Sênior", description: "IMPACTO: Crítico. PROB: Média. MITIGAÇÃO: 2 mestres em formação por mestre ativo. Retenção agressiva. Documentação de técnicas." },
        { number: "R2", title: "Crise Econômica / Queda de Demanda", description: "IMPACTO: Alto. PROB: Média. MITIGAÇÃO: Reserva de 6 meses. Diversificar para manutenção (anticíclico). Pipeline B2B." },
        { number: "R3", title: "Conflito Familiar Destrutivo", description: "IMPACTO: Existencial. PROB: Baixa. MITIGAÇÃO: Protocolo familiar assinado. Mediador externo. Acordo de acionistas." },
        { number: "R4", title: "Escassez de Madeira Certificada", description: "IMPACTO: Alto. PROB: Média-Alta. MITIGAÇÃO: 3+ fornecedores qualificados. Estoque estratégico 90 dias. Engineered como alternativa." },
        { number: "R5", title: "Acidente Grave em Obra", description: "IMPACTO: Crítico. PROB: Baixa. MITIGAÇÃO: Seguro completo. Protocolos de segurança. Treinamento NR-18. Auditoria mensal." },
        { number: "R6", title: "Falha Reputacional (Obra Mal Entregue)", description: "IMPACTO: Alto. PROB: Baixa. MITIGAÇÃO: Gates de qualidade. Pré-entrega formal. Garantia documentada. Protocolo de crise." },
        { number: "R7", title: "Dependência do Fundador", description: "IMPACTO: Existencial. PROB: Alta. MITIGAÇÃO: Plano de sucessão ativo. Delegação progressiva. Documentação de decisões." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Seguros &\nProteção Legal",
      label: "Risk Transfer",
      highlight: "Risco que pode ser transferido deve ser transferido. O custo do seguro é sempre menor que o custo da crise.",
      items: [
        "SEGURO DE OBRA: Cobertura all-risk para cada projeto. Obrigatório em contratos > R$50K.",
        "RESPONSABILIDADE CIVIL: Cobertura para danos a terceiros durante execução. R$2M de cobertura mínima.",
        "SEGURO DE VIDA / INVALIDEZ: Cobertura key-man para fundador e diretores. Valor = 3x receita anual.",
        "PROTEÇÃO DIGITAL: Cyber insurance + backup diário + MFA em todos os sistemas.",
        "CONTRATO ROBUSTO: Cláusula de aditivo para variação >10% no escopo. Condições de pagamento atreladas a gates.",
        "ASSESSORIA JURÍDICA: Advogado especialista em construção civil + advogado de direito de família (governança).",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 12 — INOVAÇÃO & TECNOLOGIA
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 12",
      title: "Inovação &\nTecnologia",
      subtitle: "O roadmap de digitalização e IA que multiplica a capacidade sem perder a alma artesanal.",
    },
  },
  {
    type: "grid",
    props: {
      title: "Roadmap de\nTecnologia 2026-2028",
      label: "Tech Roadmap",
      cards: [
        { icon: "📋", title: "2026 H1 — Fundação", description: "CRM 100% adotado. ERP implantado. Orçamentação semi-automática. WhatsApp Business API integrado." },
        { icon: "🤖", title: "2026 H2 — Automação", description: "8 agentes IA operando (conforme Plano Ops). Automação de compras. Dashboard de obra em tempo real." },
        { icon: "🖥️", title: "2027 H1 — Digital Sales", description: "Configurador 3D de pisos no site. E-showroom virtual. Proposta interativa digital (substitui PDF)." },
        { icon: "📱", title: "2027 H2 — App de Campo", description: "App mobile para instaladores: checklist de gates, registro fotográfico, reporte de horas e materiais." },
        { icon: "📊", title: "2028 H1 — Inteligência", description: "BI avançado: previsão de demanda, otimização de estoque, pricing dinâmico baseado em dados históricos." },
        { icon: "🌐", title: "2028 H2 — Plataforma", description: "Marketplace de manutenção (agendamento online). Portal do cliente: acompanhar obra em real-time." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     BLOCO 13 — RITUAIS DE GESTÃO
     ═══════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Bloco 13",
      title: "Rituais de\nGestão",
      subtitle: "A cadência de reuniões e decisões que mantém tudo alinhado e em movimento.",
    },
  },
  {
    type: "process",
    props: {
      title: "Cadência de\nReuniões",
      label: "Meeting Rhythm",
      steps: [
        { number: "D", title: "Standup Operacional (15min, 8h)", description: "Obras em andamento + bloqueios + alertas. De pé. Formato: O que fez ontem? O que faz hoje? Algum impedimento? Só operação." },
        { number: "S", title: "Reunião de Liderança (1h, segunda 9h)", description: "CEO + diretores. Pauta fixa: dashboard de KPIs, semáforo de OKRs, decisões pendentes (máx 3), alinhamentos cross." },
        { number: "Q", title: "Reunião Comercial (45min, quarta 10h)", description: "Pipeline review. Forecast. Propostas pendentes. Win/loss analysis da semana. Ações de prospecção." },
        { number: "M", title: "All-Hands (30min, 1ª sexta)", description: "CEO para todo o time. Resultados do mês. Reconhecimentos. Prioridades do próximo mês. Espaço para perguntas." },
        { number: "T", title: "Review Estratégico Trimestral (4h)", description: "OKRs + financeiro + pipeline + operação + pessoas. Decisões de investimento. Ajuste de rota. Priorização." },
        { number: "B", title: "Conselho Consultivo (3h, bimestral)", description: "Fundador + conselheiros externos. Estratégia, governança, riscos, oportunidades. Perspectiva de fora." },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Framework de\nDecisão",
      label: "Decision-Making",
      highlight: "Decisões lentas são piores que decisões imperfeitas. Um framework claro evita paralisia e politicagem.",
      items: [
        "TIPO 1 — Irreversível & Alto Impacto (>R$200K, contratação C-level, novo mercado): CEO decide com input do conselho. Prazo: 2 semanas.",
        "TIPO 2 — Reversível & Alto Impacto (campanha, processo novo, ferramenta): Diretor decide com alinhamento do CEO. Prazo: 48h.",
        "TIPO 3 — Reversível & Baixo Impacto (ajuste de preço <5%, conteúdo, fornecedor pontual): Coordenador/Gerente decide sozinho. Prazo: imediato.",
        "REGRA DE OURO: Quem está mais perto do problema decide. Escalar só quando o impacto justifica.",
        "DOCUMENTAÇÃO: Toda decisão Tipo 1 é registrada com: contexto, alternativas consideradas, decisão, responsável, prazo de revisão.",
        "RETROSPECTIVA: Decisões Tipo 1 são revisadas após 90 dias. O que aprendemos? Decidiríamos igual hoje?",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Dashboards do\nCEO",
      label: "Painel do Fundador",
      highlight: "O fundador precisa ver o estado da empresa inteira em 5 minutos. Estes são os 12 números que importam.",
      items: [
        "1. Receita do mês (realizado vs meta)",
        "2. Margem bruta do mês (realizado vs target)",
        "3. Cash position (saldo + recebíveis 30 dias)",
        "4. Pipeline comercial (valor total em proposta)",
        "5. Obras em andamento (qtd + % on-time + % on-budget)",
        "6. NPS de entrega (últimos 90 dias)",
        "7. Leads novos no mês (por canal)",
        "8. Headcount (total + vagas abertas + turnover)",
        "9. Score médio de OKRs (empresa)",
        "10. Incidentes de qualidade (retrabalho no mês)",
        "11. Engajamento social (seguidores + leads via social)",
        "12. Posição da reserva de caixa (em meses de despesa fixa)",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════
     ENCERRAMENTO
     ═══════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "Uma empresa familiar premium não é construída\nem um trimestre.\nÉ construída em decisões diárias\nque honram o passado\ne constroem o futuro.",
      attribution: "Plano Estratégico — Parket Pisos",
      label: "Encerramento",
    },
  },
  {
    type: "content",
    props: {
      title: "Próximos\nPassos Imediatos",
      label: "Ação Agora",
      highlight: "As 10 ações que devem ser iniciadas nas próximas 2 semanas para colocar este plano em movimento.",
      items: [
        "1. Agendar reunião de alinhamento de OKRs com os 3 diretores (esta semana)",
        "2. Contratar 2 conselheiros externos para o Conselho Consultivo (em 30 dias)",
        "3. Iniciar redação do Protocolo Familiar com advogado especialista (em 15 dias)",
        "4. Implementar cadência de reuniões: standup diário começa amanhã",
        "5. Contratar/designar Controller para gestão financeira granular (em 45 dias)",
        "6. Mapear backup para cada posição-chave e iniciar treinamento cruzado",
        "7. Configurar dashboard de 12 KPIs do CEO (Google Sheets → BI em 90 dias)",
        "8. Revisar política de remuneração vs mercado e ajustar onde necessário",
        "9. Documentar 3 processos-chave por mês (meta: 100% em 12 meses)",
        "10. Comunicar a visão e OKRs ao time inteiro no próximo All-Hands",
      ],
    },
  },
  {
    type: "closing",
    props: {
      title: "Parket Pisos",
      subtitle: "Plano Estratégico & Governança Familiar\n55 Slides — Documento do Fundador\n\nConfidencial · Revisão Anual",
      image: IMG_BOARD,
    },
  },
];
