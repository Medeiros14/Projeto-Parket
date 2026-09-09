import { type SlideData } from "./slides-data";

const IMG_CRAFT = "https://images.unsplash.com/photo-1661446569716-86e93bf267d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmFmdHNtYW4lMjBoYW5kcyUyMHdvb2R3b3JrJTIwZGV0YWlsfGVufDF8fHx8MTc3MTgwNDg3OXww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_DARK = "https://images.unsplash.com/photo-1760282853818-cd54418bc8bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWluaW1hbCUyMHRleHR1cmUlMjBjb25jcmV0ZSUyMHdhbGx8ZW58MXx8fHwxNzcxODA0ODgwfDA&ixlib=rb-4.1.0&q=80&w=1080";

export const pocketCultureSlides: SlideData[] = [
  /* ═══ 01 · CAPA ═══ */
  {
    type: "cover",
    props: {
      title: "Código de\nCultura &\nRituais",
      subtitle: "Versão Pocket — O guia de bolso para todo colaborador Parket. 12 slides. Leia, releia, pratique.",
      image: IMG_CRAFT,
    },
  },

  /* ═══ 02 · MANIFESTO ═══ */
  {
    type: "statement",
    props: {
      statement: "Cultura não é o que está\nna parede do escritório.\nÉ o que acontece quando\nninguém está olhando.",
      attribution: "Princípio #0 — Parket Pisos",
      label: "Manifesto",
    },
  },

  /* ═══ 03 · OS 7 CÓDIGOS — PARTE 1 ═══ */
  {
    type: "grid",
    props: {
      title: "Os 7 Códigos\nde Cultura",
      label: "Quem Somos",
      cards: [
        {
          icon: "01",
          title: "Dono do Detalhe",
          description: "Cada mm importa. Se está bom mas não está perfeito, não acabou. O padrão é a excelência — sem exceção, sem atalho.",
        },
        {
          icon: "02",
          title: "Fala Direto",
          description: "Feedback no momento, na cara, com respeito. Não existe \"deixa pra depois\". Transparência radical é regra, não opção.",
        },
        {
          icon: "03",
          title: "A Obra é do Time",
          description: "Ninguém brilha sozinho. O mestre, o coordenador e o comercial entregam juntos. Ego fica na porta.",
        },
        {
          icon: "04",
          title: "Ensina o Próximo",
          description: "Conhecimento que não é passado, morre. Todo sênior tem a obrigação de formar. Reter conhecimento é falha grave.",
        },
      ],
    },
  },

  /* ═══ 04 · OS 7 CÓDIGOS — PARTE 2 ═══ */
  {
    type: "grid",
    props: {
      title: "Os 7 Códigos\nde Cultura",
      label: "Como Agimos",
      cards: [
        {
          icon: "05",
          title: "Resolve, Depois Reclama",
          description: "Problema na obra? Resolve agora, analisa depois, previne para sempre. Reclamar sem agir não existe aqui.",
        },
        {
          icon: "06",
          title: "Madeira Merece Respeito",
          description: "Cada tábua tem uma história. Desperdício é inaceitável — técnico e moral. Tratamos o material como patrimônio.",
        },
        {
          icon: "07",
          title: "O Cliente Vê Tudo",
          description: "Tom no WhatsApp, pontualidade na obra, limpeza no fim do dia. Tudo comunica. Tudo é marca. Tudo é promessa.",
        },
      ],
    },
  },

  /* ═══ 05 · O QUE SOMOS vs O QUE NÃO SOMOS ═══ */
  {
    type: "twocolumn",
    props: {
      title: "Somos &\nNão Somos",
      label: "Identidade",
      leftTitle: "✓ Isso é Parket",
      leftItems: [
        "Entregar antes do prazo e avisar o cliente",
        "Refazer por conta própria se o padrão não ficou perfeito",
        "Pedir ajuda quando não sabe — e ensinar quando sabe",
        "Tratar o auxiliar com o mesmo respeito que o arquiteto",
        "Limpar a obra como se fosse a própria casa",
        "Dar feedback difícil no mesmo dia, olhando nos olhos",
        "Assumir o erro, corrigir rápido e documentar o aprendizado",
      ],
      rightTitle: "✗ Isso NÃO é Parket",
      rightItems: [
        "Esconder problema e torcer para ninguém perceber",
        "\"Isso não é minha responsabilidade\"",
        "Guardar conhecimento como vantagem pessoal",
        "Falar do colega pelas costas em vez de falar direto",
        "Sair da obra deixando sujeira para o próximo dia",
        "Ignorar feedback porque \"sempre fiz assim\"",
        "Justificar erro em vez de aprender com ele",
      ],
    },
  },

  /* ═══ 06 · CADÊNCIA DE REUNIÕES ═══ */
  {
    type: "process",
    props: {
      title: "Rituais de\nGestão",
      label: "Cadência de Reuniões",
      steps: [
        {
          number: "D",
          title: "Standup · Todo dia · 8h · 15min",
          description: "De pé. 3 perguntas: O que fiz? O que faço hoje? Algum bloqueio? Só operação. Sem enrolação. Se não cabe em 15min, agenda separado.",
        },
        {
          number: "S",
          title: "Liderança · Segunda · 9h · 1h",
          description: "CEO + diretores. Dashboard de KPIs. Semáforo de OKRs. Máximo 3 decisões por reunião. Sai com dono e prazo para cada ação.",
        },
        {
          number: "S",
          title: "Comercial · Quarta · 10h · 45min",
          description: "Pipeline review. Propostas pendentes. Win/loss da semana. Forecast atualizado. Cada oportunidade tem next step definido.",
        },
        {
          number: "M",
          title: "All-Hands · 1ª sexta do mês · 30min",
          description: "CEO para todo o time. Resultados. Reconhecimentos (\"Mestre do Mês\"). Prioridades. Espaço para perguntas. Transparência total.",
        },
        {
          number: "T",
          title: "Review Estratégico · Trimestral · 4h",
          description: "OKRs + financeiro + pipeline + ops + pessoas. Celebrar o que funcionou. Analisar o que falhou. Ajustar rota. Priorizar próximo ciclo.",
        },
      ],
    },
  },

  /* ═══ 07 · FRAMEWORK DE DECISÃO ═══ */
  {
    type: "grid",
    props: {
      title: "Como\nDecidimos",
      label: "Framework de Decisão",
      cards: [
        {
          icon: "T1",
          title: "Irreversível + Alto Impacto",
          description: ">R$200K, contratação C-level, novo mercado. CEO decide com input do conselho. Prazo: até 2 semanas. Documenta tudo.",
        },
        {
          icon: "T2",
          title: "Reversível + Alto Impacto",
          description: "Campanha, processo novo, ferramenta. Diretor decide com alinhamento do CEO. Prazo: 48h. Pode ajustar depois.",
        },
        {
          icon: "T3",
          title: "Reversível + Baixo Impacto",
          description: "Ajuste de preço <5%, conteúdo, fornecedor pontual. Coordenador decide sozinho. Prazo: imediato. Autonomia total.",
        },
        {
          icon: "⚡",
          title: "Regra de Ouro",
          description: "Quem está mais perto do problema, decide. Escalar só quando o impacto justifica. Decisão lenta é pior que decisão imperfeita.",
        },
      ],
    },
  },

  /* ═══ 08 · SISTEMA DE PERFORMANCE ═══ */
  {
    type: "process",
    props: {
      title: "Sistema de\nPerformance",
      label: "Como Avaliamos & Desenvolvemos",
      steps: [
        {
          number: "01",
          title: "OKRs Individuais",
          description: "1-2 OKRs por pessoa, derivados do departamento. Definidos no início do trimestre. Score 0-1.0. Revisados mensalmente. Transparentes.",
        },
        {
          number: "02",
          title: "1:1 Quinzenal · 30min",
          description: "Líder + liderado. Pauta: bloqueios, feedback, desenvolvimento. Não é cobrança — é suporte. Registrado. Consistente.",
        },
        {
          number: "03",
          title: "Review 360° Trimestral",
          description: "Auto + líder + pares. Score 1-5 em competências técnicas e comportamentais. Calibração em comitê. Plano de ação individual.",
        },
        {
          number: "04",
          title: "Reconhecimento Público",
          description: "\"Mestre do Trimestre\" — indicação por pares + coordenadores. Bônus + reconhecimento no All-Hands. Celebrar excelência é obrigação.",
        },
      ],
    },
  },

  /* ═══ 09 · CARREIRA TÉCNICA ═══ */
  {
    type: "process",
    props: {
      title: "Trilha de\nCarreira",
      label: "Evolução Técnica",
      steps: [
        {
          number: "N1",
          title: "Auxiliar",
          description: "Entrada. Aprende ferramentas, materiais, segurança. Acompanha mestre em toda obra. Avaliação: 6 meses para N2.",
        },
        {
          number: "N2",
          title: "Instalador",
          description: "Executa tarefas padrão com autonomia. Raspagem, nivelamento, instalação reta. Avaliação: 12-18 meses para N3.",
        },
        {
          number: "N3",
          title: "Instalador Sênior",
          description: "Obras complexas: herringbone, chevron, escadas. Resolve problemas no campo. Referência técnica. Avaliação: 24-36 meses para N4.",
        },
        {
          number: "N4",
          title: "Mestre Instalador",
          description: "Lidera equipe (2-3 auxiliares). Responsável pela qualidade final. Forma a próxima geração. Participa de orçamentação.",
        },
        {
          number: "N5",
          title: "Mestre Sênior",
          description: "Referência máxima. Consultoria interna. Valida obras especiais. Participa do conselho técnico. Programa Legado (10+ anos).",
        },
      ],
    },
  },

  /* ═══ 10 · CHECKLIST DO DIA ═══ */
  {
    type: "twocolumn",
    props: {
      title: "Checklists\nDiários",
      label: "Rotina Não-Negociável",
      leftTitle: "☀️ Início do Dia",
      leftItems: [
        "□ Standup às 8h — pontual, preparado, objetivo",
        "□ Revisar planejamento da obra do dia",
        "□ Verificar materiais e ferramentas necessários",
        "□ Confirmar cronograma com coordenador",
        "□ EPI completo e verificado",
        "□ Comunicar qualquer desvio ANTES de começar",
      ],
      rightTitle: "🌙 Fim do Dia",
      rightItems: [
        "□ Obra limpa — chão varrido, ferramentas guardadas",
        "□ Registrar progresso (fotos + % conclusão)",
        "□ Reportar materiais consumidos vs planejado",
        "□ Sinalizar bloqueios para amanhã",
        "□ Atualizar coordenador sobre status",
        "□ Ferramentas contadas e armazenadas",
      ],
    },
  },

  /* ═══ 11 · COMUNICAÇÃO ═══ */
  {
    type: "content",
    props: {
      title: "Regras de\nComunicação",
      label: "Como Nos Comunicamos",
      highlight: "Cada canal tem um propósito. Usar o canal errado é tão ruim quanto não comunicar.",
      items: [
        "WHATSAPP — Urgências e atualizações rápidas de obra. Resposta esperada: 30min em horário comercial. Sem áudios > 1min.",
        "CRM / SISTEMA — Registro formal. Tudo que importa precisa estar aqui. \"Se não está no sistema, não aconteceu.\"",
        "REUNIÃO — Decisões que precisam de debate. Sempre com pauta prévia. Sempre com ata e donos de ação.",
        "1:1 — Feedback pessoal, desenvolvimento, bloqueios. Espaço seguro. O que é dito no 1:1 fica no 1:1.",
        "ALL-HANDS — Informações para todos. Transparência. Direção. Celebração. Não é lugar de cobrar indivíduo.",
        "REGRA DE OURO — Na dúvida entre escrever e falar, fale. Na dúvida entre escalar e resolver, resolva. Na dúvida entre esperar e comunicar, comunique.",
      ],
    },
  },

  /* ═══ 12 · ENCERRAMENTO ═══ */
  {
    type: "closing",
    props: {
      title: "Parket Pisos",
      subtitle: "Código de Cultura & Rituais\nVersão Pocket · 12 Slides\n\nImprima. Releia. Pratique.\nCultura se constrói todo dia.",
      image: IMG_DARK,
    },
  },
];
