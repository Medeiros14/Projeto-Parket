import { type SlideData } from "./slides-data";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";

const IMG = {
  construction: "https://images.unsplash.com/photo-1673978483427-a26a15670e42?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwd29vZCUyMGNvbnN0cnVjdGlvbiUyMHNpdGUlMjBtYW5hZ2VtZW50fGVufDF8fHx8MTc3MTc5MDMwMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  blueprint: "https://images.unsplash.com/photo-1754780960162-839cda44d736?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBibHVlcHJpbnQlMjBwbGFubmluZyUyMHRhYmxlfGVufDF8fHx8MTc3MTc5MDMwMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  flooring: "https://images.unsplash.com/photo-1675325152993-b3a5fa7f0356?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBpbnRlcmlvciUyMHdvb2QlMjBmbG9vcmluZyUyMGluc3RhbGxhdGlvbnxlbnwxfHx8fDE3NzE3OTAzMDN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  meeting: "https://images.unsplash.com/photo-1758611972678-bc3b29b4718f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwbWVldGluZyUyMG9wZXJhdGlvbnMlMjBtYW5hZ2VtZW50fGVufDF8fHx8MTc3MTc5MDMwM3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  quality: "https://images.unsplash.com/photo-1581092157699-83c90752400a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxxdWFsaXR5JTIwY29udHJvbCUyMGluc3BlY3Rpb24lMjBjaGVja2xpc3R8ZW58MXx8fHwxNzcxNzkwMzA0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  warehouse: "https://images.unsplash.com/photo-1573209680076-bd7ec7007616?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBsb2dpc3RpY3MlMjBzdXBwbHklMjBjaGFpbnxlbnwxfHx8fDE3NzE3NDQyNDV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  dashboard: "https://images.unsplash.com/photo-1748609160056-7b95f30041f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBkYXNoYm9hcmQlMjBhbmFseXRpY3N8ZW58MXx8fHwxNzcxNzUyMjMzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  woodwork: "https://images.unsplash.com/photo-1761544775659-aaa6fa2e5b3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmFmdHNtYW4lMjB3b29kd29ya2luZyUyMHByZWNpc2lvbiUyMHRvb2xzfGVufDF8fHx8MTc3MTc5MDMwNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  ai: "https://images.unsplash.com/photo-1660165458059-57cfb6cc87e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpZmljaWFsJTIwaW50ZWxsaWdlbmNlJTIwdGVjaG5vbG9neSUyMGFic3RyYWN0fGVufDF8fHx8MTc3MTc2NDM4NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
};

export const opsPlanSlides: SlideData[] = [

  // ═══════════════════════════════════════════════════════════════
  // ABERTURA (3 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "cover",
    props: {
      title: "Plano\nOperacional\n90 Dias",
      subtitle: "20 macroestados, 10 donos de processo,\n6 rupturas travadas, 9 checklists digitais\ne 10 métricas semanais em 6 sprints.",
      image: parketDeckLake,
    },
  },

  {
    type: "statement",
    props: {
      statement: "Cada obra vive em\num único estado por vez.\nSem estado, a obra\nnão existe.\nSem gate, a obra\nnão avança.",
      label: "Princípio Arquitetural",
      attribution: "Sistema Operacional Parket",
    },
  },

  {
    type: "grid",
    props: {
      title: "Blueprint Executivo",
      label: "8 Entregas · 90 Dias",
      cards: [
        { title: "A. Funil de 20 Estados", description: "Cada obra num estado único — visibilidade total do pipeline para fundador, gestão e IA", icon: "🔄" },
        { title: "B. 10 Processos Críticos", description: "Cada etapa com dono nomeado, gate, checklist, evidência e métrica leading", icon: "⚙️" },
        { title: "C. Comunicação", description: "Grupo por obra, regra WhatsApp, feedback cruzado, passo-a-passo para cliente", icon: "📡" },
        { title: "D. Quality OS", description: "9 checklists mestres, 4 termos padrão, 6 pontos de ruptura com gate travado", icon: "✅" },
        { title: "E. Agentes IA", description: "8 agentes alinhados aos 10 donos de processo — garantia, cobrança, aceleração", icon: "🤖" },
        { title: "F. 6 Sprints", description: "Backlog quinzenal com entregáveis concretos, owners nomeados e definition of done", icon: "🏃" },
        { title: "G. Métricas Semanais", description: "10 métricas que a IA gera automaticamente toda semana — dashboard obrigatório", icon: "📊" },
        { title: "H. Próximo Nível", description: "5 movimentos: biblioteca técnica, industrialização, academia, central compras, preditivos", icon: "🔺" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO A — FUNIL DE 20 ESTADOS E DIAGNÓSTICO (7 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Parte A",
      title: "Funil de\n20 Macroestados\ne Diagnóstico",
      subtitle: "Cada obra num único estado. Sem visibilidade, sem controle. Meça antes de corrigir.",
    },
  },

  {
    type: "content",
    props: {
      title: "8 Garantias do Sistema",
      label: "O que cada gate protege",
      highlight: "Todo gate existe para garantir uma dessas 8 promessas. Se não protege nenhuma, elimine-o.",
      items: [
        "1. Escopo vendido coerente com o executável",
        "2. Medição correta cedo — aditivo cedo, não tarde",
        "3. Projeto executivo aprovado antes de entrar na obra",
        "4. Obra liberada antes de entregar e instalar",
        "5. Material entregue com prova e armazenamento correto",
        "6. Instalação com controle diário, qualidade e produtividade",
        "7. Entrega com termo de aceite + pós-obra com triagem objetiva",
        "8. Pós-venda gerando nova receita (cliente, arquiteto, engenharia, gerenciador)",
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "20 Estados\n(Visão Geral)",
      label: "Do lead à reciclagem comercial",
      steps: [
        { number: "01-05", title: "Comercial", description: "Lead → Qualificação → Levantamento → Proposta → Contrato assinado" },
        { number: "06-10", title: "Ativação", description: "1ª parcela paga → Onboarding (Talita) → Pré-projeto (Tainara) → 1ª Vistoria → Exec. aprovado" },
        { number: "11-15", title: "Preparação", description: "Insumos → Pré-liberação → 2ª Vistoria → Entrega material (Ailton) → Contrato prestador (Dani)" },
        { number: "16-18", title: "Execução", description: "Instalação controlada → Entrega + aceite → Pós-obra (triagem)" },
        { number: "19-20", title: "Pós-venda", description: "NPS + encerramento → Reciclagem comercial (novos leads no círculo)" },
      ],
    },
  },

  {
    type: "metrics",
    props: {
      title: "Painel de Perdas\nMétricas 1–5",
      label: "Retrabalho, atrasos e compras",
      metrics: [
        { value: "M1", label: "Horas de Retrabalho / Mês", sublabel: "Σ horas refazendo. Meta: <5% do total produtivo" },
        { value: "M2", label: "Custo de Retrabalho (R$)", sublabel: "(Horas × custo/hora) + material. Meta: <2% faturamento" },
        { value: "M3", label: "Dias de Atraso / Obra", sublabel: "Dias além do prazo. Meta: 0 (máx tolerável: 2)" },
        { value: "M4", label: "% Obras no Prazo", sublabel: "Entregues ≤ prazo / total entregues. Meta: >90%" },
        { value: "M5", label: "% Pedidos com Erro", sublabel: "Devolvidos ou trocados / total. Meta: <3%" },
      ],
    },
  },

  {
    type: "metrics",
    props: {
      title: "Painel de Perdas\nMétricas 6–10",
      label: "Comunicação, qualidade e satisfação",
      metrics: [
        { value: "M6", label: "Custo de Urgência (R$)", sublabel: "Fretes extras + sobrepreço emergencial. Meta: <1% custo material" },
        { value: "M7", label: "Tarefas sem Dono", sublabel: "Tarefas sem responsável atribuído. Meta: 0/semana" },
        { value: "M8", label: "NCs / Obra", sublabel: "Defeitos na auditoria ou check final. Meta: <3" },
        { value: "M9", label: "NPS Pós-Entrega", sublabel: "Net Promoter Score 7 dias. Meta: >70" },
        { value: "M10", label: "Chamados no SLA", sublabel: "% pós-obra resolvidos no prazo. Meta: >90%" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Como Implementar\no Painel de Perdas",
      label: "Implementação pragmática",
      highlight: "O painel não precisa ser sofisticado. Precisa ser preenchido religiosamente toda semana.",
      items: [
        "Semana 1: definir quem coleta cada métrica e de onde vem o dado",
        "Semana 2: criar dashboard compartilhado com as 10 métricas + 10 métricas semanais do funil",
        "Semana 3: primeira coleta real — aceitar que os números serão feios",
        "Semana 4: reunião 30 min com coordenadores para revisar",
        "A partir da semana 5: coleta semanal vira rotina. Quem não preenche, explica.",
        "Regra de ouro: dado ruim é melhor que dado inexistente. Nunca maquie.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO B — 10 PROCESSOS CRÍTICOS COM DONOS (12 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Parte B",
      title: "10 Processos\nCríticos\ncom Donos",
      subtitle: "Cada processo com dono nomeado, gate específico,\nchecklist e métrica leading.",
    },
  },

  {
    type: "process",
    props: {
      title: "10 Processos\nVisão Geral",
      label: "Processos com donos reais",
      steps: [
        { number: "01", title: "CRM e Qualificação", description: "Comercial · Gate: sem CRM = lead não existe" },
        { number: "02", title: "Escopo e Proposta", description: "Comercial + Levantamento · Gate: Carla valida executabilidade" },
        { number: "03", title: "Onboarding de Obra", description: "Talita · Gate: grupo + pasta + checklist antes de tudo" },
        { number: "04", title: "Pré-Projeto e 1ª Vistoria", description: "Tainara + Fiscal · Gate: sem pré-projeto = sem vistoria" },
        { number: "05", title: "Compras e Kitagem", description: "Ronaldo/Pâmela + Ailton · Gate: conferência item a item" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "10 Processos\n(continuação)",
      label: "Processos 6-10",
      steps: [
        { number: "06", title: "Liberação de Frente", description: "Fiscal + Talita (filtro) · Gate: 2ª vistoria ou taxa/termo" },
        { number: "07", title: "Execução Controlada", description: "Fiscal + Nat + Dani · Gate: check-in/out + fotos diárias" },
        { number: "08", title: "Entrega e Aceite", description: "Fiscal + Talita · Gate: termo assinado = libera retenção" },
        { number: "09", title: "Pós-Obra com Triagem", description: "Talita + Fiscal · Gate: triagem objetiva Parket/não-Parket" },
        { number: "10", title: "Pós-Venda e Reciclagem", description: "Talita (CS) + Comercial · Gate: NPS + lead gerado" },
      ],
    },
  },

  // P01
  {
    type: "content",
    props: {
      title: "P01 · CRM e\nQualificação de Lead",
      label: "Dono: Comercial (BDR/Vendedor)",
      highlight: "GATE CULTURAL: sem CRM preenchido, o lead \"não existe\". Sem \"motivo do lead\" em 1 frase, não avança.",
      items: [
        "Input: Lead bruto (inbound, outbound BDR, relacionamento arq/incorporador/indicação)",
        "Output: Lead qualificado no CRM com: origem, perfil, cidade/obra, tipo escopo, \"motivo\" em 1 frase",
        "Checklist: decisores mapeados, driver (estética/prazo/durabilidade/status), orçamento estimado, data-alvo",
        "Evidência: CRM preenchido + reunião consultiva realizada + escopo preliminar vendável",
        "Erro fatal: Avançar lead sem confirmar decisor e orçamento → reunião inútil",
        "Métrica: % leads com ficha completa · tempo médio qualificação · taxa conversão por canal",
      ],
    },
  },

  // P02
  {
    type: "content",
    props: {
      title: "P02 · Escopo, Proposta\ne Contrato",
      label: "Dono: Comercial + Levantamento · Validação: Carla",
      highlight: "Gate: Carla valida escopo executável + preço ok + produto em linha. Sem validação = não assina.",
      items: [
        "Input: Lead qualificado + projeto do arquiteto (se existir)",
        "Output: Proposta com arquivo versionado + lista premissas (incluso / não incluso / condicional)",
        "Levantamento: analisa projeto, identifica riscos aditivo (recortes, alçapões, grelhas, rodapé invertido)",
        "Marc extra: escopos críticos passam por aval técnico de fábrica (Marco Antônio/direção produção)",
        "Apresentação: showroom (padrão) ou call (exceção) — não \"mandar PDF\"",
        "Follow-up: cadência D+1, D+3, D+7, D+14, D+30. Motivo não-fechamento classificado no CRM",
        "Gate de ativação: obra só ativa internamente após assinatura + 1ª parcela paga",
      ],
    },
  },

  // P03
  {
    type: "content",
    props: {
      title: "P03 · Onboarding\nde Obra",
      label: "Dono: Talita (CS/Atendimento)",
      highlight: "GATE: sem grupo + pasta + checklist, obra não está organizada. Sem onboarding = caos garantido.",
      items: [
        "Input: Contrato assinado + 1ª parcela paga",
        "Output: Dashboard da obra + grupo WhatsApp + pasta organizada + passo-a-passo enviado",
        "Grupo: cliente/engenharia/arq + vendedor + projetos + expedição + fiscal + Nat + marc (se aplicável)",
        "Mensagem de boas-vindas: \"passo a passo Parket\" com regras, etapas, prazos e contatos",
        "Checklist enviado: regra 2 vistorias (3ª = taxa ou vídeo+termo), como funciona entrega/instalação, o que gera custo extra",
        "Marc extra: mensagem de prazo condicional (\"após aprovações X, Y, Z\")",
        "Métrica: % obras com onboarding completo em 48h após 1ª parcela",
      ],
    },
  },

  // P04
  {
    type: "content",
    props: {
      title: "P04 · Pré-Projeto\ne 1ª Vistoria",
      label: "Dono: Tainara (Projetos) + Fiscal",
      highlight: "GATE: fiscal só vai com pré-projeto em mãos. Sem pré-projeto no card = não agenda vistoria.",
      items: [
        "Pré-projeto (Tainara): arquivos atualizados, paginação/forro, alçapões, cortineiros, grelhas, automação, encontros",
        "Marc extra: mapa de itens versionado + reunião técnica gravada com arquitetura antes de ir à obra",
        "1ª Vistoria (Fiscal): metragem real vs projeto, contrapiso, umidade, gesso, batentes, elétrica, logística",
        "Saída: relatório + pendências + aditivo cedo (se metragem mudou) — no grupo E na pasta",
        "Marc vistoria: prumo, requadro, padronização de vãos, compatibilização com engenharia",
        "Erro fatal: fiscal vai sem pré-projeto → vistoria inútil → vistoria extra = custo + atraso",
        "Métrica: % vistorias com pré-projeto completo · % aditivos formalizados na 1ª vistoria",
      ],
    },
  },

  // P05
  {
    type: "content",
    props: {
      title: "P05 · Compras,\nKitagem e Exec. Aprovado",
      label: "Dono: Ronaldo/Pâmela (compras) + Ailton (expedição) + Tainara (exec.)",
      highlight: "Regra: nunca mandar \"a mais\" por vício. Manda o necessário medido com lastro documental.",
      items: [
        "Conferência vendido vs medido → lista insumos (\"receita de bolo\")",
        "Estoque separa. Falta: compra nacional (Ronaldo). Importação: Pâmela",
        "Kit por obra (Ailton): piso + cola + barrote + parafuso. Conferido item a item e fotografado",
        "Forro: compatibilização com iluminação/ar/automação — recortes = aditivo ANTES de produzir",
        "Marc compras: grosso antecipa (lâmina, compensado). Compra final só após validação",
        "Marc exec.: \"Ficha Parket de Marcenaria\" padroniza detalhamento com arquiteto. Aprovação formal registrada",
        "Métrica: % kits completos na 1ª entrega · % exec. aprovados sem revisão posterior",
      ],
    },
  },

  // P06
  {
    type: "content",
    props: {
      title: "P06 · Liberação\nde Frente",
      label: "Dono: Fiscal + Talita (filtro pré-liberação)",
      highlight: "GATE: sem 2ª vistoria aprovada = obra não começa. 3ª ida = taxa ou vídeo+foto + termo de responsabilidade.",
      items: [
        "Pré-liberação: engenharia envia fotos + confirma checklist. Talita filtra — evita deslocamento inútil",
        "2ª Vistoria (Fiscal): umidade (higrômetro), laser de nível, andaime/caçamba, armazenamento seco",
        "Se não liberado: lista do que falta + prazo para resolver",
        "3ª ida: taxa cobrada OU vídeo/foto + termo de responsabilidade assinado pelo cliente",
        "Marc extra: medição fina com responsável de produção junto (SP). Amostras assinadas antes de produzir",
        "Erro fatal: entrar na obra sem liberação = instalar sobre base inadequada = retrabalho total",
        "Métrica: % liberações na 1ª 2ª vistoria · % obras que precisaram de 3ª ida",
      ],
    },
  },

  // P07
  {
    type: "content",
    props: {
      title: "P07 · Execução\nControlada",
      label: "Dono: Fiscal + Nat (cronograma) + Dani (prestadores)",
      highlight: "GATE: sem contrato prestador assinado = sem start. Cronograma final só no dia do start ou entrega de material.",
      items: [
        "Contrato prestador (Dani): classificação complexa/média/simples. Custos longe travados por Carla",
        "Primeira obrigação equipe: conferir material (cor, lote, insumos). Abriu e colou = assumiu responsabilidade",
        "Controle diário: check-in/out, fotos do produzido, ocorrências, m²/dia",
        "Feedback cruzado: \"como está ficando?\" no grupo para engenharia (radar antifraude)",
        "Pagamento quinzenal: D10→D15, D25→D30. Retenção 25% por item até aceite",
        "Só fiscal fala prazo/decisão com cliente. Equipe fala técnica.",
        "Métrica: % dias com diário completo · m²/dia médio · ranking equipes · NCs por obra",
      ],
    },
  },

  // P08-P10
  {
    type: "content",
    props: {
      title: "P08-P10 · Entrega,\nPós-Obra e Pós-Venda",
      label: "Dono: Fiscal (entrega) + Talita (pós-obra/CS) + Comercial (reciclagem)",
      highlight: "Pós-obra não é custo — é oportunidade. NPS no pico de satisfação gera indicação e receita nova.",
      items: [
        "P08 Entrega: obra grande = fiscal presencial. Pequena = termo digital. Checklist + aceite item a item. Retenção liberada por item aceito",
        "P09 Pós-obra: Talita recebe e registra. Fiscal avalia: Parket ou não? Parket: agenda e arca. Não Parket: explica + orçamento",
        "P09 Triagem: relatório técnico cirúrgico — especialmente marc (portas/requadro geram discussão)",
        "P10 Pós-venda: Talita (CS) aplica NPS (nota indicação, nota equipe, resultado vs expectativa)",
        "P10 Reciclagem: \"quem mais no círculo?\" Vendedor retoma com arquiteto. Fundador em crises viradas vitória",
        "Métrica: % entregas com aceite sem ressalva · NPS médio · leads gerados por pós-venda · aging pós-obra",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO C — COMUNICAÇÃO INTERNA (6 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Parte C",
      title: "Protocolo de\nComunicação\nInterna",
      subtitle: "Grupo por obra, passo-a-passo para cliente,\nfeedback cruzado e regra WhatsApp.",
    },
  },

  {
    type: "content",
    props: {
      title: "Estrutura de\nComunicação por Obra",
      label: "O padrão que elimina ruído",
      highlight: "Cada obra tem grupo + pasta + dashboard. Sem esses 3, a obra não está organizada.",
      items: [
        "GRUPO: cliente/engenharia/arq + vendedor + Tainara + Ailton/expedição + fiscal + Nat + marc (se aplicável)",
        "PASTA: organizada por obra com subpastas (projeto, compras, vistoria, execução, entrega, pós-obra)",
        "DASHBOARD: registro mestre da obra no sistema (estado atual, pendências, próxima ação)",
        "Passo-a-passo: mensagem de boas-vindas com etapas, regras, contatos e o que gera custo extra",
        "Feedback cruzado: engenharia confirma no grupo como está ficando — valida sem fiscal estar lá 100%",
        "Código da obra: PKT-YYYY-NNN usado em TODAS as comunicações, pastas e documentos",
      ],
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "WhatsApp: O que\nPode vs. Proibido",
      label: "Protocolo de Comunicação",
      leftTitle: "✓ Pode no WhatsApp",
      leftItems: [
        "Alinhamento rápido do dia (\"Chego 8h\")",
        "Foto de progresso para registro rápido",
        "Confirmação de recebimento material",
        "Feedback cruzado \"como está ficando?\"",
        "Aviso urgente que precisa ação imediata",
      ],
      rightTitle: "✕ Proibido ficar SÓ no WhatsApp",
      rightItems: [
        "Aprovação de escopo/mudança de projeto",
        "Decisão sobre preço/desconto/pagamento",
        "Instrução técnica de instalação",
        "Reclamação/chamado de pós-obra",
        "Aditivo ou alteração de escopo",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#D4716A",
    },
  },

  {
    type: "content",
    props: {
      title: "12 Regras de\nComunicação",
      label: "Inegociáveis",
      items: [
        "01 · Decisão de escopo/prazo/custo = registro por escrito (e-mail, sistema ou ata)",
        "02 · Tarefa sem dono, prazo e status no sistema = tarefa que não existe",
        "03 · WhatsApp = agilidade. Toda info relevante vai para sistema em 2h",
        "04 · Mudança de escopo = aditivo formal. Conversa verbal não conta",
        "05 · Handoff entre áreas = checklist de passagem + aceite do receptor",
        "06 · Reunião sem ata = não aconteceu. Ata em 2h após término",
        "07 · Status de obra atualizado toda sexta até 16h — sem exceção",
        "08 · Alerta de risco comunicado no mesmo dia da identificação",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Definição de Pronto\npara Passar a Bola",
      label: "Comunicação · Handoff",
      highlight: "Nenhuma etapa está \"pronta\" até que TODOS os itens abaixo estejam cumpridos:",
      items: [
        "☐ Documentação completa e atualizada no sistema (não em e-mail solto)",
        "☐ Checklist específico da etapa 100% preenchido — sem exceção",
        "☐ Evidências anexadas: fotos, assinaturas, prints, documentos",
        "☐ Receptor do handoff confirmou recebimento por escrito",
        "☐ Nenhum item bloqueante em aberto — todos resolvidos ou escalados",
        "☐ Prazo do próximo passo definido, comunicado e registrado",
        "Se faltar 1 item: a etapa NÃO está pronta. Devolver ao responsável.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO D — QUALITY OS (7 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Parte D",
      title: "Quality OS\n9 Checklists,\n4 Termos,\n6 Rupturas",
      subtitle: "O sistema de qualidade baseado em gates que travam o avanço sem evidência.",
    },
  },

  {
    type: "grid",
    props: {
      title: "9 Checklists\nMestres Digitais",
      label: "Quality OS · Formulários que viram app",
      cards: [
        { title: "1. Onboarding", description: "Grupo, pasta, dashboard, mensagem, pré-requisitos, regras vistoria", icon: "✅" },
        { title: "2. Pré-Projeto", description: "Arquivos, compatibilização, paginação, alçapões, recortes, encontros", icon: "✅" },
        { title: "3. 1ª Vistoria", description: "Metragem, contrapiso, umidade, gesso, batentes, elétrica, logística", icon: "✅" },
        { title: "4. Liberação", description: "Pré-requisitos, umidade, nível, andaime, caçamba, armazenamento", icon: "✅" },
        { title: "5. Entrega Material", description: "Item vs receita, fotos saindo/chegando, assinatura, armazenamento", icon: "✅" },
        { title: "6. Start Obra", description: "Contrato prestador, complexidade, custos travados, equipe definida", icon: "✅" },
        { title: "7. Diário de Obra", description: "Check-in/out, fotos produção, ocorrências, feedback, m²/dia", icon: "✅" },
        { title: "8. Entrega Final", description: "Conformidade, acabamento, limpeza, pendências, termo aceite", icon: "✅" },
        { title: "9. Pós-Obra", description: "Triagem responsabilidade, relatório técnico, orçamento, encerramento", icon: "✅" },
      ],
    },
  },

  {
    type: "grid",
    props: {
      title: "4 Termos Padrão\npara Assinatura Digital",
      label: "Quality OS · Proteção documental",
      cards: [
        { title: "Termo Responsabilidade", description: "Entrar sem pré-requisito completo. Cliente assume risco por escrito.", icon: "📝" },
        { title: "Taxa 3ª Vistoria", description: "Cobrada quando engenharia não cumpriu checklist em 2 visitas.", icon: "📝" },
        { title: "Aceite de Entrega", description: "Digital: checklist item a item + fotos evidência + assinatura.", icon: "📝" },
        { title: "Contrato Prestador", description: "Automático por escopo. Retenção 25%. Bônus/multa.", icon: "📝" },
      ],
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "6 Pontos de Ruptura\n(1-3)",
      label: "Quality OS · Onde o processo quebra",
      leftTitle: "R1: Fiscal sem Pré-Projeto",
      leftItems: [
        "Vistoria sem saber o que conferir",
        "Aditivo não pego cedo",
        "GATE: card sem pré-projeto = não agenda",
      ],
      rightTitle: "R2: Aditivo Tarde + R3: Cronograma Ilusório",
      rightItems: [
        "R2: Aditivo durante/após instalação = margem evapora",
        "REGRA: aditivo só na 1ª vistoria ou executivo",
        "R3: Cronograma antes de condição existir = frustração",
        "REGRA: cronograma final só no dia do start",
      ],
      leftColor: "#E85D5D",
      rightColor: "#E8C97A",
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "6 Pontos de Ruptura\n(4-6)",
      label: "Quality OS · Prevenção com gate",
      leftTitle: "R4: Entrega sem Prova + R5: Sem Disciplina",
      leftItems: [
        "R4: Material some/estraga = palavra contra palavra",
        "GATE: fotos + assinatura + armazenamento",
        "R5: Dia sem registro = dia invisível = prejuízo",
        "GATE: bônus/multa + check-in/out + prova diária",
      ],
      rightTitle: "R6: Marc sem Rastreabilidade",
      rightItems: [
        "Nunca sabe custo, tempo, margem por item",
        "Marcenaria = caixa-preta operacional",
        "GATE: ID por item + Germano auditor diário",
        "QC final assinando antes de embarcar",
        "Sem etiqueta = peça não existe",
      ],
      leftColor: "#E85D5D",
      rightColor: "#E8C97A",
    },
  },

  {
    type: "statement",
    props: {
      statement: "Qualidade não é o que\nvocê faz quando está\nolhando. É o que seu\nsistema impede quando\nninguém está olhando.",
      label: "Quality OS",
      attribution: "Princípio Parket",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO E — AGENTES IA (10 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Parte E",
      title: "8 Agentes IA\nalinhados aos\n10 Donos",
      subtitle: "IA como mecanismo de garantia. Cada agente tem dono humano que é accountable.",
    },
  },

  {
    type: "grid",
    props: {
      title: "8 Agentes de Controle\ne seus Donos Humanos",
      label: "Agentes IA · Mapa",
      cards: [
        { title: "Comercial", description: "Dono humano: Vendedor/BDR · CRM, qualificação, follow-up, margem", icon: "💼" },
        { title: "Onboarding", description: "Dono humano: Talita · Grupo, pasta, checklist, passo-a-passo", icon: "📋" },
        { title: "Projetos", description: "Dono humano: Tainara · Pré-projeto, executivo, compatibilização", icon: "📐" },
        { title: "Compras/Expedição", description: "Dono humano: Ronaldo/Pâmela/Ailton · Receita, kit, conferência", icon: "📦" },
        { title: "Obras/Execução", description: "Dono humano: Fiscal + Dani + Nat · Vistoria, start, diário, QA", icon: "🏗️" },
        { title: "Produção Marc", description: "Dono humano: Germano · ID por item, timestamps, QC final", icon: "🔨" },
        { title: "Financeiro", description: "Dono humano: Carla · Validação contratual, cobrança, retenções", icon: "💰" },
        { title: "Pós-Obra/CS", description: "Dono humano: Talita · Triagem, NPS, reciclagem, indicações", icon: "⭐" },
      ],
    },
  },

  {
    type: "role",
    props: {
      role: "Agente IA\nComercial",
      label: "Agente 01 · Dono: Vendedor/BDR",
      mission: "Garantir que nenhum lead avance sem qualificação completa e que toda proposta proteja margem + tenha arquivo versionado.",
      responsibilities: [
        "Valida ficha CRM: campos obrigatórios, \"motivo do lead\" em 1 frase, decisor mapeado",
        "Bloqueia: lead sem orçamento estimado não avança no funil",
        "Alerta: lead >24h sem contato no CRM",
        "Valida proposta: arquivo versionado + lista premissas + margem conferida por Carla",
        "Cobra follow-up cadenciado (D+1, D+3, D+7, D+14, D+30)",
        "Auditoria: 10 leads/semana conferidos contra checklist de qualificação",
      ],
      kpis: ["Tempo médio qualificação", "% leads com ficha completa", "Taxa conversão por canal", "Margem média propostas"],
      image: IMG.meeting,
    },
  },

  {
    type: "role",
    props: {
      role: "Agente IA\nProjetos & Vistoria",
      label: "Agente 02 · Dono: Tainara + Fiscal",
      mission: "Garantir que nenhum fiscal vá sem pré-projeto e que nenhuma compra inicie sem executivo aprovado formalmente.",
      responsibilities: [
        "Valida pré-projeto: arquivos, paginação, compatibilização, recortes mapeados",
        "Bloqueia: card sem pré-projeto anexo = não agenda 1ª vistoria",
        "Cobra relatório da 1ª vistoria em 48h — no grupo E na pasta",
        "Alerta: aditivo identificado na vistoria não formalizado em 72h",
        "Bloqueia: compra sem executivo aprovado = bloqueada",
        "Marc: cobra reunião técnica gravada, mapa de itens versionado, ficha Parket",
      ],
      kpis: ["% vistorias com pré-projeto", "Tempo médio relatório", "% aditivos formalizados na 1ª vistoria", "% exec. sem revisão pós-compra"],
      image: IMG.blueprint,
    },
  },

  {
    type: "role",
    props: {
      role: "Agente IA\nObras & Execução",
      label: "Agente 03 · Dono: Fiscal + Dani + Nat",
      mission: "Garantir que nenhuma obra comece sem contrato/liberação e que execução tenha registro diário + controle de retenção.",
      responsibilities: [
        "Bloqueia: sem contrato prestador assinado (Dani) = sem start",
        "Bloqueia: sem 2ª vistoria aprovada = equipe não mobiliza",
        "Valida: check-in/out diário + fotos do produzido + m² realizado",
        "Alerta: dia sem diário = notificação automática em 2h para fiscal e Nat",
        "Controla: pagamento quinzenal + retenção 25% por item + bônus/multa",
        "Marc: conferência etiqueta vs projeto na desembalagem (violou lacre = assumiu)",
      ],
      kpis: ["% dias com diário completo", "% obras com contrato antes do start", "m²/dia médio", "Ranking equipes"],
      image: IMG.woodwork,
    },
  },

  {
    type: "role",
    props: {
      role: "Agente IA\nCompras & Expedição",
      label: "Agente 04 · Dono: Ronaldo/Pâmela + Ailton",
      mission: "Garantir que toda compra tenha origem em medição conferida e que todo kit saia completo com evidência.",
      responsibilities: [
        "Valida: lista insumos originada em conferência vendido vs medido (não no vendido puro)",
        "Bloqueia: compra sem receita de bolo conferida = bloqueada",
        "Cobra conferência item a item por Ailton + fotos saindo do depósito",
        "Alerta: item faltante no kit antes de sair — nunca na obra",
        "Controla: agendamento entrega (1 semana + 1 dia antes) + fotos chegando + aceite",
        "Marc: separa compra antecipada (grosso) vs compra final (pós-medição fina)",
      ],
      kpis: ["% kits completos na 1ª entrega", "% entregas com evidência completa", "Custo frete extra", "Compras emergenciais/mês"],
      image: IMG.warehouse,
    },
  },

  {
    type: "role",
    props: {
      role: "Agente IA\nProdução Marcenaria",
      label: "Agente 05 · Dono: Germano (PCP/QA)",
      mission: "Rastrear cada item da fábrica ao site com ID único, timestamps e QC final assinado.",
      responsibilities: [
        "Cada item com ID único (etiqueta) vinculado à obra e ao projeto executivo",
        "Timestamps por estágio: bancada → pintura início/fim → QC → embalagem → expedição",
        "Germano audita no fim do dia: passa nas bancadas, confere trena, tira fotos, registra por item",
        "Bloqueia: peça sem QC final assinado = não embarca",
        "Alerta: desvio dimensional ou de acabamento travado antes de virar retrabalho",
        "Controla: amostras assinadas pelo cliente antes de produzir (sem assinatura = não produz)",
      ],
      kpis: ["% itens com rastreabilidade completa", "Tempo médio por item", "% QC aprovado 1ª vez", "Custo retrabalho fábrica"],
      image: IMG.woodwork,
    },
  },

  {
    type: "role",
    props: {
      role: "Agente IA\nFinanceiro + Pós-Obra",
      label: "Agente 06-07 · Dono: Carla (Fin.) + Talita (CS)",
      mission: "Proteger margem, controlar retenções e garantir que pós-obra gere receita e indicações.",
      responsibilities: [
        "Fin: valida escopo executável + preço + produto em linha antes de assinar contrato",
        "Fin: libera retenção só por item aceito com termo assinado",
        "Fin: alerta se margem real < mínima definida pelo fundador",
        "CS: registra pós-obra. Fiscal avalia: Parket ou não? Triagem objetiva",
        "CS: NPS em 7 dias (nota indicação + equipe + resultado vs expectativa)",
        "CS: cobra vendedor sobre reciclagem comercial (\"quem mais no círculo?\")",
      ],
      kpis: ["Margem real média", "% retenções no prazo", "NPS médio", "Leads por pós-venda", "Aging pós-obra"],
      image: IMG.dashboard,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO F — BACKLOG 6 SPRINTS (8 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Parte F",
      title: "Backlog de\nImplementação\n6 Sprints",
      subtitle: "90 dias. 6 sprints quinzenais.\nDo registro básico à operação com IA.",
    },
  },

  {
    type: "process",
    props: {
      title: "Roadmap\n90 Dias",
      label: "Sprints Quinzenais com Owners",
      steps: [
        { number: "S1", title: "Dias 1–15 · Fundação", description: "Funil 20 estados + onboarding padrão + 3 checklists prioritários + painel de perdas" },
        { number: "S2", title: "Dias 16–30 · Comercial → Vistoria", description: "P01-P04 ativos: CRM → proposta → onboarding → pré-projeto + 1ª vistoria" },
        { number: "S3", title: "Dias 31–45 · Compras → Liberação", description: "P05-P06 ativos: receita de bolo → kitagem → exec. aprovado → liberação" },
        { number: "S4", title: "Dias 46–60 · Execução + QA", description: "P07 ativo: contrato prestador → diário obrigatório → retenção → ranking equipes" },
        { number: "S5", title: "Dias 61–75 · Entrega + Pós", description: "P08-P10 ativos: aceite formal → triagem pós-obra → NPS → reciclagem comercial" },
        { number: "S6", title: "Dias 76–90 · IA + Dashboard", description: "8 agentes configurados + 10 métricas semanais automáticas + 1ª auditoria completa" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Sprint 1 · Dias 1–15\nFundação e Visibilidade",
      label: "Owner: Fundador + Nat",
      highlight: "Antes de corrigir, enxergue. Sem dados e sem funil, sem controle.",
      items: [
        "Entregáveis: funil de 20 estados implementado no sistema, padrão de onboarding documentado, 3 checklists digitais (onboarding + pré-projeto + 1ª vistoria)",
        "Ação cultural: comunicar \"sem CRM = não existe\" + \"sem pré-projeto = sem vistoria\"",
        "Painel de Perdas: 10 métricas definidas com fonte de dados e responsável por coleta",
        "RACI publicado: 10 donos de processo com nomes comunicados ao time",
        "Definition of Done: toda obra ativa tem estado no funil + grupo + pasta + dashboard mestre",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Sprint 2 · Dias 16–30\nComercial ao Pré-Projeto",
      label: "Owner: Comercial + Talita + Tainara",
      highlight: "P01-P04 padronizados: lead qualificado → proposta com margem → onboarding → pré-projeto + 1ª vistoria.",
      items: [
        "Entregáveis: checklist CRM implantado, template proposta com premissas, onboarding com passo-a-passo, pré-projeto obrigatório antes de vistoria",
        "Gates ativos: Carla valida contrato + 1ª parcela ativa obra + fiscal só vai com pré-projeto",
        "Marc extra: aval técnico de fábrica para escopos críticos + mapa de itens versionado",
        "Métricas: % leads com ficha completa · % onboardings em 48h · % vistorias com pré-projeto",
        "Definition of Done: nenhuma vistoria sem pré-projeto, nenhum contrato sem validação Carla",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Sprint 3 · Dias 31–45\nCompras e Liberação",
      label: "Owner: Ronaldo/Ailton + Fiscal + Tainara",
      highlight: "P05-P06 padronizados: receita de bolo → kit conferido → exec. aprovado → liberação.",
      items: [
        "Entregáveis: conferência vendido vs medido implantada, kitagem com foto obrigatória, checklist liberação ativo, regra 3ª vistoria publicada",
        "Gates ativos: nunca mandar \"a mais\" por vício + pré-liberação filtrada por Talita + 2ª vistoria obrigatória",
        "Marc extra: ficha Parket de Marcenaria pronta + medição fina com produção junto + amostras assinadas",
        "Métricas: % kits completos · % liberações na 1ª 2ª vistoria · % exec. aprovados formalmente",
        "Definition of Done: nenhum kit sem conferência, nenhuma obra sem liberação formal",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Sprint 4 · Dias 46–60\nExecução e QA",
      label: "Owner: Dani + Fiscal + Nat + Germano (marc)",
      highlight: "P07 padronizado: contrato prestador → diário obrigatório → retenção → ranking equipes.",
      items: [
        "Entregáveis: contrato prestador automático, diário de obra digital, sistema bônus/multa, ranking equipes semanal",
        "Gates ativos: sem contrato = sem start + dia sem diário = notificação 2h + retenção 25% por item",
        "Marc: Germano auditando diário na fábrica + QC final assinado antes de embarcar",
        "Métricas: % dias com diário completo · m²/dia médio · NCs por obra · ranking equipes",
        "Definition of Done: 80% dias com diário, toda obra com contrato prestador, retenção ativa",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Sprint 5 · Dias 61–75\nEntrega e Pós",
      label: "Owner: Fiscal + Talita + Comercial",
      highlight: "P08-P10 padronizados: entrega com aceite → triagem pós-obra → NPS → reciclagem comercial.",
      items: [
        "Entregáveis: checklist entrega final digital, termo aceite digital, triagem pós-obra com relatório, roteiro NPS + reciclagem",
        "Gates ativos: termo assinado = libera retenção + triagem Parket/não-Parket + NPS em 7 dias obrigatório",
        "Marc: relatório técnico cirúrgico para portas/requadro + indicação para arquiteto",
        "Métricas: % entregas com aceite · NPS médio · leads por pós-venda · aging pós-obra <15 dias",
        "Definition of Done: 100% entregas com checklist, NPS em 7 dias, reciclagem comercial ativa",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Sprint 6 · Dias 76–90\nIA e Dashboard",
      label: "Owner: Fundador + Gestor IA",
      highlight: "8 agentes IA configurados, 10 métricas semanais automáticas, primeira auditoria completa.",
      items: [
        "Entregáveis: 8 agentes IA operacionais (shadow mode 2 semanas → produção), dashboard com 10 métricas semanais do funil + 10 métricas de perdas",
        "Agentes em shadow mode: sugerem, não bloqueiam. Calibrar falsos positivos antes de travar",
        "Dashboard semanal: obras por estado, aguardando arquivos/vistoria/aditivo/exec/liberação, material→equipe, ranking, pós-obra aging",
        "1ª auditoria completa de processos: score por área, gaps identificados, plano de correção",
        "Definition of Done: agentes em todas as áreas, dashboard rodando, auditoria publicada",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO G — MÉTRICAS SEMANAIS (3 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Parte G",
      title: "10 Métricas\nSemanais\nObrigatórias",
      subtitle: "O dashboard que a IA/sistema gera\ntoda semana. Se não mede, não gerencia.",
    },
  },

  {
    type: "metrics",
    props: {
      title: "Métricas 1-5",
      label: "Dashboard semanal do funil",
      metrics: [
        { value: "#1", label: "Obras por estado do funil", sublabel: "Distribuição dos 20 macroestados" },
        { value: "#2", label: "Obras aguardando arquivos", sublabel: "Bloqueadas por falta de projeto/info" },
        { value: "#3", label: "Obras aguardando 1ª vistoria", sublabel: "Medição pendente de agendamento" },
        { value: "#4", label: "Obras com aditivo pendente", sublabel: "Metragem mudou, aditivo não formalizado" },
        { value: "#5", label: "Obras com exec. pendente", sublabel: "Aprovação em andamento ou travada" },
      ],
    },
  },

  {
    type: "metrics",
    props: {
      title: "Métricas 6-10",
      label: "Dashboard semanal do funil",
      metrics: [
        { value: "#6", label: "Obras aguardando liberação", sublabel: "Checklist não cumprido pela engenharia" },
        { value: "#7", label: "Material entregue → equipe", sublabel: "Obras com material esperando start" },
        { value: "#8", label: "Produção esperada vs real", sublabel: "m²/dia previsto vs realizado por obra" },
        { value: "#9", label: "Ranking de equipes", sublabel: "Pontuação, bônus/multa, retrabalho, NCs" },
        { value: "#10", label: "Pós-obra por aging", sublabel: "0-7 dias · 8-15 dias · 16+ dias" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO H — PRÓXIMO NÍVEL (4 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Parte H",
      title: "O Próximo\nNível",
      subtitle: "5 movimentos realistas que levam a Parket adiante — sem mirabolâncias.",
    },
  },

  {
    type: "grid",
    props: {
      title: "5 Movimentos\nEstratégicos",
      label: "Próximo Nível · Visão Geral",
      cards: [
        { title: "Biblioteca Técnica", description: "Catálogo digital com espécies, acabamentos, fichas de performance e detalhes construtivos reutilizáveis", icon: "📚" },
        { title: "Industrialização Parcial", description: "Pré-corte, kits por projeto, pré-montagens que reduzem tempo de obra em 20-30%", icon: "🏭" },
        { title: "Central de Compras", description: "Tabela negociada trimestral, volume agregado, fornecedores homologados com governança", icon: "🤝" },
        { title: "Academia de Instalação", description: "3 níveis (Aprendiz, Profissional, Mestre), certificação prática, afeta escala e remuneração", icon: "🎓" },
        { title: "Dados Preditivos", description: "Dashboard por obra em tempo real com alertas de tendência e scoring de risco para liderança", icon: "📈" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Impacto Esperado\nde Cada Movimento",
      label: "Próximo Nível · Detalhamento",
      items: [
        "Biblioteca Técnica → elimina erros de especificação, acelera projetos 30%, profissionaliza venda com arquitetos",
        "Industrialização → reduz tempo obra 20-30%, diminui desperdício, padroniza qualidade",
        "Central de Compras → reduz custo material 5-10%, elimina 90% compras emergenciais",
        "Academia → padroniza qualidade, cria plano de carreira, reduz turnover 40%",
        "Dados Preditivos → antecipa problemas 5-7 dias, prioriza gestão por exceção, documenta histórico",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ENCERRAMENTO (3 slides)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "statement",
    props: {
      statement: "O plano está desenhado.\nAgora depende de uma\nsó coisa: a decisão\nde executar.\nNão amanhã.\nEsta semana.",
      label: "Hora de Decidir",
      attribution: "Para o Fundador",
    },
  },

  {
    type: "content",
    props: {
      title: "Decisões do Fundador\nNesta Semana",
      label: "Ação Imediata · 8 Decisões",
      highlight: "Estas decisões não podem esperar. São a fundação dos próximos 90 dias:",
      items: [
        "① Implementar o funil de 20 estados no sistema/app — cada obra num único estado a partir de segunda",
        "② Comunicar ao time os 10 donos de processo com nomes — publicar RACI e pendurar na parede",
        "③ Ativar os 3 gates culturais: \"sem CRM = não existe\" + \"sem pré-projeto = sem vistoria\" + \"sem contrato = sem start\"",
        "④ Escolher 3 obras piloto para rodar os 9 checklists digitais (não espere ter tudo pronto)",
        "⑤ Agendar reunião semanal de obras com fiscais para classificação de complexidade",
        "⑥ Definir margem mínima inegociável e regra de aprovação de Carla",
        "⑦ Implantar regra de retenção 25% por item nos próximos contratos de prestador",
        "⑧ Definir meta NPS + meta de leads por pós-venda para os próximos 90 dias",
      ],
    },
  },

  {
    type: "closing",
    props: {
      title: "Parket\nOperacional",
      subtitle: "90 dias: 20 estados, 10 donos, 6 rupturas travadas,\n9 checklists, 8 agentes IA, 10 métricas semanais.\nDo lead ao pós-venda, sem atalho.",
      image: parketDeckLake,
    },
  },
];
