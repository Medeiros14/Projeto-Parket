/* ═══════════════════════════════════════════════════════════
   Jornada do Cliente — Roteiro de Workshop Interativo
   80 perguntas · 14 blocos · Revestimentos × Marcenaria
   ═══════════════════════════════════════════════════════════ */

export interface WorkbookQuestion {
  id: number;
  text: string;
  /** "brutal", "mata-ruido", "decisiva", "destrava", "processo", "maturidade", "governanca", "reputacao", "sistema" */
  tag?: string;
  /** hints/examples below the question */
  hint?: string;
  /** if true, only one answer (not split Rev/Marc) */
  single?: boolean;
}

export interface WorkbookSection {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  questions: WorkbookQuestion[];
}

export interface FinalDeliveryItem {
  id: string;
  label: string;
  hint: string;
}

export const workbookSections: WorkbookSection[] = [
  /* ─── BLOCO 1 ─── */
  {
    id: "definicao",
    number: 1,
    title: "Definição de Jornada",
    subtitle: "O que o cliente compra de verdade",
    icon: "🎯",
    questions: [
      {
        id: 1,
        text: "Qual é o resultado que o cliente quer comprar em uma frase?",
        hint: "Rev: ex. \"piso impecável entregue no prazo sem dor de cabeça\". Marc: ex. \"solução sob medida perfeita que encaixa com a obra e fica do jeito da referência\".",
      },
      {
        id: 2,
        text: "O que o cliente teme perder?",
        hint: "Tempo, estética, reputação com arquiteto, dor na obra, surpresa no preço, problema pós-obra.",
      },
      {
        id: 3,
        text: "Qual é o \"momento de verdade\" que define se ele te ama ou te odeia?",
        hint: "Rev: início da instalação e entrega. Marc: compatibilização e instalação com ajuste fino.",
      },
      {
        id: 4,
        text: "Qual é a promessa que você faz hoje, explicitamente, na primeira conversa?",
      },
      {
        id: 5,
        text: "Qual promessa o cliente entende, mesmo que você não fale?",
      },
    ],
  },

  /* ─── BLOCO 2 ─── */
  {
    id: "qualificacao",
    number: 2,
    title: "Entrada e Qualificação",
    subtitle: "O que precisa estar claro antes de \"aceitar\" o cliente",
    icon: "🔍",
    questions: [
      {
        id: 6,
        text: "Quais são os 10 dados mínimos que você exige para aceitar o lead como \"qualificado\"?",
      },
      {
        id: 7,
        text: "Quais dados vocês frequentemente não têm, mas mesmo assim avançam?",
      },
      {
        id: 8,
        text: "Quais 5 sinais de que a obra vai dar problema e deveria entrar em \"risco C\"?",
      },
      {
        id: 9,
        text: "Quem decide de verdade (cliente, arquiteto, engenheiro, gerente)?",
      },
      {
        id: 10,
        text: "Qual é o critério para dizer \"não\" para um lead?",
      },
      {
        id: 11,
        text: "Qual é o primeiro documento que você entrega que prova profissionalismo e reduz ansiedade?",
        tag: "mata-ruído",
      },
    ],
  },

  /* ─── BLOCO 3 ─── */
  {
    id: "escopo",
    number: 3,
    title: "Escopo e Premissas",
    subtitle: "Onde nasce 80% do retrabalho",
    icon: "📋",
    questions: [
      {
        id: 12,
        text: "Quais itens sempre viram \"estava incluso\" vs \"não estava\"?",
      },
      {
        id: 13,
        text: "Quais exclusões deveriam estar em negrito por padrão?",
      },
      {
        id: 14,
        text: "O que precisa estar congelado antes de cotar com precisão?",
      },
      {
        id: 15,
        text: "Qual parte do escopo muda mais: layout, acabamento, paginação, ferragens, interfaces?",
      },
      {
        id: 16,
        text: "Qual é seu processo atual para registrar decisão e aprovação do cliente/arquiteto?",
      },
      {
        id: 17,
        text: "Se você tivesse que reduzir seu portfólio de opções em 30% para diminuir erro, o que cortaria primeiro?",
        tag: "brutal",
      },
    ],
  },

  /* ─── BLOCO 4 ─── */
  {
    id: "proposta",
    number: 4,
    title: "Proposta e Fechamento",
    subtitle: "Clareza, margem e alinhamento de expectativa",
    icon: "💰",
    questions: [
      {
        id: 18,
        text: "Onde o cliente mais confunde preço com escopo?",
      },
      {
        id: 19,
        text: "O que você mostra para justificar preço premium sem virar \"discurso\"?",
      },
      {
        id: 20,
        text: "Sua proposta deixa claro o que é: entregue, pré-condição do cliente, opcional, aditivo?",
        hint: "Liste cada categoria com exemplos reais.",
      },
      {
        id: 21,
        text: "Qual é a principal objeção hoje e como você responde?",
      },
      {
        id: 22,
        text: "O que é \"vitória\" no fechamento além de assinar contrato?",
        hint: "Prazo realista, acesso, pagamento alinhado, freeze aceito.",
      },
    ],
  },

  /* ─── BLOCO 5 ─── */
  {
    id: "kickoff",
    number: 5,
    title: "Kickoff",
    subtitle: "O primeiro marco que define se a obra será controlada",
    icon: "🚀",
    questions: [
      {
        id: 23,
        text: "O que acontece no kickoff ideal em 30 minutos?",
      },
      {
        id: 24,
        text: "Quais decisões obrigatórias precisam sair do kickoff?",
      },
      {
        id: 25,
        text: "Quais pessoas precisam estar presentes para evitar retrabalho depois?",
      },
      {
        id: 26,
        text: "Qual é o pacote mínimo do kickoff (anexos, fotos, plantas, restrições)?",
      },
      {
        id: 27,
        text: "Quando o kickoff termina, qual é a primeira tarefa que nasce e qual é o dono?",
        tag: "processo",
      },
    ],
  },

  /* ─── BLOCO 6 ─── */
  {
    id: "freeze",
    number: 6,
    title: "Projeto Executivo e Freeze",
    subtitle: "O \"contrato invisível\" que mais protege a operação",
    icon: "🔒",
    questions: [
      {
        id: 28,
        text: "O que \"freeze\" significa exatamente na sua empresa?",
      },
      {
        id: 29,
        text: "Quais itens entram no freeze em Revestimentos? E em Marcenaria?",
      },
      {
        id: 30,
        text: "O que é permitido mudar depois do freeze sem aditivo? E o que é proibido?",
      },
      {
        id: 31,
        text: "Como você captura aprovação do cliente/arquiteto (assinatura, e-mail, sistema)?",
      },
      {
        id: 32,
        text: "Qual é a taxa atual de mudanças pós-freeze? Quais são as causas?",
      },
      {
        id: 33,
        text: "Se você tivesse que criar um checklist de 12 itens para freeze amanhã, quais seriam?",
        tag: "destrava",
      },
    ],
  },

  /* ─── BLOCO 7 ─── */
  {
    id: "compras",
    number: 7,
    title: "Compras, Produção e Logística",
    subtitle: "Onde atrasos e urgências nascem",
    icon: "📦",
    questions: [
      {
        id: 34,
        text: "O que dispara uma compra hoje? Quem autoriza?",
      },
      {
        id: 35,
        text: "Qual é o seu maior \"vazamento\" de urgência? Falta de lista? Mudança? Erro de previsão?",
      },
      {
        id: 36,
        text: "Quais itens são críticos e deveriam ter plano B sempre?",
      },
      {
        id: 37,
        text: "Qual é o padrão de inspeção de recebimento?",
      },
      {
        id: 38,
        text: "O que acontece quando chega material errado ou avariado?",
      },
      {
        id: 39,
        text: "Você sabe dizer, por obra, quantas \"corridas\" extras de logística aconteceram e por quê?",
        tag: "maturidade",
      },
    ],
  },

  /* ─── BLOCO 8 ─── */
  {
    id: "pre-instalacao",
    number: 8,
    title: "Pré-Instalação",
    subtitle: "O ponto que separa empresa premium de empresa comum",
    icon: "🔧",
    questions: [
      {
        id: 40,
        text: "Quais são as pré-condições para começar sem risco?",
      },
      {
        id: 41,
        text: "Quem mede e registra base/umidade/prumo?",
      },
      {
        id: 42,
        text: "Qual é o critério objetivo para dizer \"frente não liberada\"?",
      },
      {
        id: 43,
        text: "Você tem coragem institucional de parar o início? Quem banca isso?",
      },
      {
        id: 44,
        text: "Quantas vezes vocês começaram sem frente liberada nos últimos 30 dias?",
        tag: "destrava",
      },
    ],
  },

  /* ─── BLOCO 9 ─── */
  {
    id: "execucao",
    number: 9,
    title: "Execução e Fiscalização",
    subtitle: "Como garantir padrão sem depender do herói",
    icon: "⚙️",
    questions: [
      {
        id: 45,
        text: "Qual é o \"diário mínimo\" que precisa existir todo dia?",
      },
      {
        id: 46,
        text: "Quais são os 10 defeitos mais comuns por tipo de entrega?",
        hint: "Piso, forro/painel, deck, escada, marcenaria.",
      },
      {
        id: 47,
        text: "Quem decide ajustes em campo e como registra?",
      },
      {
        id: 48,
        text: "Qual é a cadência de inspeção: por ambiente, por etapa, por dia?",
      },
      {
        id: 49,
        text: "Qual é o padrão de fotos obrigatório?",
      },
      {
        id: 50,
        text: "Quais 3 checkpoints, se auditados toda semana, cortariam 50% do retrabalho?",
        tag: "sistema",
      },
    ],
  },

  /* ─── BLOCO 10 ─── */
  {
    id: "mudancas",
    number: 10,
    title: "Controle de Mudanças e Aditivos",
    subtitle: "Proteção de margem e paz mental",
    icon: "🔄",
    questions: [
      {
        id: 51,
        text: "Em que momento a mudança vira aditivo oficialmente?",
      },
      {
        id: 52,
        text: "Quem calcula impacto (custo/prazo) e em quanto tempo?",
      },
      {
        id: 53,
        text: "Qual é o SLA de resposta ao cliente?",
      },
      {
        id: 54,
        text: "O que acontece se o cliente pede \"só faz\" sem formalizar?",
      },
      {
        id: 55,
        text: "Qual porcentagem do seu retrabalho vem de mudança não formalizada?",
        tag: "decisiva",
      },
    ],
  },

  /* ─── BLOCO 11 ─── */
  {
    id: "entrega",
    number: 11,
    title: "Entrega e Aceite",
    subtitle: "Como reduzir pós-obra e aumentar recomendação",
    icon: "✅",
    questions: [
      {
        id: 56,
        text: "O que significa \"entrega perfeita\" em 10 critérios objetivos?",
      },
      {
        id: 57,
        text: "Você entrega manual de cuidado/manutenção? Em que formato?",
      },
      {
        id: 58,
        text: "Como você coleta aceite: termo, e-mail, sistema?",
      },
      {
        id: 59,
        text: "Qual é a lista padrão de pendências aceitáveis e SLA?",
      },
      {
        id: 60,
        text: "O cliente sai da entrega sentindo \"controle\" ou \"alívio\"? Por quê?",
        tag: "reputação",
      },
    ],
  },

  /* ─── BLOCO 12 ─── */
  {
    id: "pos-obra",
    number: 12,
    title: "Pós-Obra",
    subtitle: "Reputação, recorrência e fechamento de loop",
    icon: "🔁",
    questions: [
      {
        id: 61,
        text: "Quais são os 5 motivos mais comuns de chamado?",
      },
      {
        id: 62,
        text: "Você consegue classificar por equipe, por obra, por tipo?",
      },
      {
        id: 63,
        text: "Qual é seu SLA real de primeiro retorno?",
      },
      {
        id: 64,
        text: "Você mede NPS por obra? Em que momento?",
      },
      {
        id: 65,
        text: "Como um erro vira mudança de padrão (checklist/gate/template)?",
      },
      {
        id: 66,
        text: "Quantos chamados são repetição do mesmo padrão quebrado?",
        tag: "governança",
      },
    ],
  },

  /* ─── BLOCO 13 ─── */
  {
    id: "especificas",
    number: 13,
    title: "Diferenças Críticas",
    subtitle: "Perguntas específicas por linha de negócio",
    icon: "🔀",
    questions: [
      {
        id: 67,
        text: "[REV] Qual é sua política de tolerâncias de base e umidade, por tipo de produto?",
        single: true,
      },
      {
        id: 68,
        text: "[REV] Quem é responsável pela preparação da base e onde isso está escrito?",
        single: true,
      },
      {
        id: 69,
        text: "[REV] Quais encontros e transições mais dão problema (porta, rodapé, ralo, desnível)?",
        single: true,
      },
      {
        id: 70,
        text: "[REV] O cronograma do cliente frequentemente atropela qual etapa?",
        single: true,
      },
      {
        id: 71,
        text: "[MARC] Qual é o \"sistema de medidas\" oficial (vãos finais, folgas, prumo, esquadro)?",
        single: true,
      },
      {
        id: 72,
        text: "[MARC] Quais interfaces mais quebram (gesso, pintura, elétrica, pedra, metal)?",
        single: true,
      },
      {
        id: 73,
        text: "[MARC] Você usa mock/protótipo para itens críticos? Quando vale?",
        single: true,
      },
      {
        id: 74,
        text: "[MARC] Como você controla versão para evitar \"produziu na versão errada\"?",
        single: true,
      },
      {
        id: 75,
        text: "[MARC] Como você garante embalagem, transporte e sequência de montagem?",
        single: true,
      },
    ],
  },

  /* ─── BLOCO 14 ─── */
  {
    id: "desenho",
    number: 14,
    title: "Perguntas de Desenho",
    subtitle: "Transformar respostas em um processo fechado",
    icon: "✏️",
    questions: [
      {
        id: 76,
        text: "Quais são os 5 gates que você quer que o cliente perceba como \"marcos de confiança\"?",
      },
      {
        id: 77,
        text: "Em cada gate, qual evidência você mostra pro cliente?",
      },
      {
        id: 78,
        text: "Qual é a frequência ideal de atualização pro cliente durante execução?",
      },
      {
        id: 79,
        text: "Qual é o template padrão de atualização semanal?",
      },
      {
        id: 80,
        text: "Qual é a sua regra de comunicação: o que vai em WhatsApp e o que vira registro?",
      },
    ],
  },
];

export const finalDeliveryItems: FinalDeliveryItem[] = [
  { id: "fd1", label: "Top 5 reclamações reais que você recebe hoje (texto cru)", hint: "O que os clientes escrevem/falam literalmente" },
  { id: "fd2", label: "Top 5 causas de retrabalho hoje", hint: "Raiz do problema, não o sintoma" },
  { id: "fd3", label: "Top 5 causas de atraso hoje", hint: "Internas e externas" },
  { id: "fd4", label: "Top 5 pontos onde o escopo muda", hint: "Em que momento e quem muda" },
  { id: "fd5", label: "Seus 5 maiores gargalos internos", hint: "Pessoas / processo / informação" },
  { id: "fd6", label: "Como vocês registram hoje: tarefa, decisão, aprovação, evidência", hint: "Ferramentas e fluxo" },
  { id: "fd7", label: "Quais são seus 5 gates atuais (mesmo que informais)", hint: "Os checkpoints reais, não os desejados" },
];

export const TOTAL_QUESTIONS = 80;
export const TOTAL_FINAL_ITEMS = 7;
