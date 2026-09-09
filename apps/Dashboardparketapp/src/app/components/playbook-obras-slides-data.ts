import { type SlideData } from "./slides-data";

/* ─── Images ─── */
const IMG_CONCRETE = "https://images.unsplash.com/photo-1760282853818-cd54418bc8bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWluaW1hbCUyMGNvbmNyZXRlJTIwdGV4dHVyZSUyMHdhbGx8ZW58MXx8fHwxNzcxODA3MjI4fDA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_INSTALL = "https://images.unsplash.com/photo-1588056453784-66b9c79ff420?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3IlMjBpbnN0YWxsYXRpb24lMjBjcmFmdHNtYW58ZW58MXx8fHwxNzcxODA3MjI4fDA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_TOOLS = "https://images.unsplash.com/photo-1501360575895-3f3f2639fd74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwY2FycGVudHJ5JTIwd29ya3Nob3AlMjB0b29scyUyMG9yZ2FuaXplZHxlbnwxfHx8fDE3NzE4MDcyMjl8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_INSPECT = "https://images.unsplash.com/photo-1760963301666-582b92218a19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjB3b3JrZXIlMjBpbnNwZWN0aW9uJTIwYnVpbGRpbmclMjBzaXRlfGVufDF8fHx8MTc3MTgwNzIzMXww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_BLUEPRINT = "https://images.unsplash.com/photo-1721132537184-5494c01ed87f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcmNoaXRlY3R1cmFsJTIwYmx1ZXByaW50JTIwcGxhbm5pbmclMjB0YWJsZXxlbnwxfHx8fDE3NzE4MDcyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_HERRINGBONE = "https://images.unsplash.com/photo-1687398209712-de4252610814?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3IlMjBoZXJyaW5nYm9uZSUyMHBhdHRlcm58ZW58MXx8fHwxNzcxODA2NDgyfDA&ixlib=rb-4.1.0&q=80&w=1080";

export const playbookObrasSlides: SlideData[] = [
  /* ═══════════════════════════════════════════════════════════
     00 · CAPA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "cover",
    props: {
      title: "Playbook\nde Obras",
      subtitle: "Manual de campo alinhado ao funil de 20 macroestados.\nCada gate, cada checklist, cada dono nomeado.\nSem atalho. Sem improviso.",
      image: IMG_INSTALL,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     01 · VISÃO GERAL — O QUE É "OBRA PARKET"
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 01",
      title: "O que é\n\"Obra Parket\"",
      subtitle: "Padrão, promessa e os gates que protegem a experiência.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "Obra Parket não é obra.\nÉ entrega de experiência\ncom tolerância zero\npara improviso.\nCada etapa tem dono,\ncada gate tem trava.",
      attribution: "Princípio operacional #1",
      label: "Manifesto de Campo",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "O Padrão Parket",
      label: "Promessa vs. Proibido",
      leftTitle: "O que prometemos",
      leftItems: [
        "Execução impecável — cada mm importa",
        "Prazo realista, comunicado e cumprido",
        "Registro completo: check-in/out + fotos + diário",
        "Zero dano colateral ao ambiente do cliente",
        "Entrega com termo item a item + manual de cuidado",
        "Transparência total: grupo por obra + feedback cruzado",
      ],
      rightTitle: "O que NUNCA pode acontecer",
      rightItems: [
        "Começar sem 2ª vistoria de liberação aprovada",
        "Instalar sem contrato de prestador assinado",
        "Dia sem diário de obra + fotos",
        "Aditivo executado sem formalização",
        "Fiscal prometendo prazo ao cliente (só fiscal fala prazo)",
        "Entrega sem termo de aceite assinado",
        "Equipe desembalando sem conferir etiqueta vs projeto",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#E85D5D",
    },
  },
  {
    type: "content",
    props: {
      title: "8 Garantias\ndo Sistema",
      label: "O que cada gate protege",
      highlight: "Todo gate existe para garantir uma dessas 8 promessas. Se não protege nenhuma, elimine-o.",
      items: [
        "1. Escopo vendido coerente com o executável (Carla valida)",
        "2. Medição correta cedo — aditivo cedo, não tarde (1ª vistoria)",
        "3. Projeto executivo aprovado antes de entrar na obra (Tainara)",
        "4. Obra liberada antes de entregar e instalar (2ª vistoria)",
        "5. Material entregue com prova e armazenamento correto (Ailton)",
        "6. Instalação com controle diário, qualidade e produtividade (Fiscal + Nat)",
        "7. Entrega com termo de aceite + pós-obra com triagem objetiva (Talita)",
        "8. Pós-venda gerando nova receita — cliente, arquiteto, engenharia (CS)",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     02 · PAPÉIS E RESPONSABILIDADES (RACI REAL)
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 02",
      title: "Papéis &\nResponsabilidades",
      subtitle: "RACI real com nomes — quem faz, quem aprova, quem é consultado.",
    },
  },
  {
    type: "role",
    props: {
      role: "Fiscal de Obra",
      label: "Papel #1 — Olho do fundador no campo",
      mission: "Vistorias (1ª e 2ª), liberação de frente, controle de qualidade em campo, entrega presencial em obras grandes. É quem fala prazo e decisão com o cliente — equipe fala só técnica.",
      responsibilities: [
        "Realizar 1ª vistoria com pré-projeto em mãos (nunca sem ele)",
        "Realizar 2ª vistoria de liberação (umidade, nível, armazenamento)",
        "Acompanhar execução: avaliar conformidade, abrir NCs",
        "Entregar presencialmente (obra grande) com checklist + termo",
        "Avaliar pós-obra: triagem Parket vs não-Parket",
      ],
      kpis: ["% vistorias com pré-projeto", "% liberações na 1ª 2ª vistoria", "NCs/obra", "Score auditoria"],
      image: IMG_INSPECT,
    },
  },
  {
    type: "role",
    props: {
      role: "Talita\n(CS / Atendimento)",
      label: "Papel #2 — Dona do onboarding e pós-obra",
      mission: "Onboarding da obra (grupo, pasta, passo-a-passo), filtro de pré-liberação (evita deslocamento inútil), recebimento de pós-obra, NPS, reciclagem comercial.",
      responsibilities: [
        "Criar grupo + pasta + dashboard da obra em 48h após 1ª parcela",
        "Enviar mensagem de boas-vindas com passo-a-passo Parket",
        "Filtrar pré-liberação: engenharia envia fotos + checklist",
        "Registrar e triar pós-obra (Parket ou não?)",
        "Aplicar NPS e cobrar reciclagem comercial com vendedor",
      ],
      kpis: ["% onboardings em 48h", "% pré-liberações filtradas", "NPS médio", "Leads por pós-venda"],
      image: IMG_BLUEPRINT,
    },
  },
  {
    type: "grid",
    props: {
      title: "Demais Donos\nde Processo",
      label: "RACI — Nomes reais",
      cards: [
        {
          icon: "📐",
          title: "Tainara (Projetos)",
          description: "Pré-projeto, executivo, compatibilização, mapa de itens marc. Fiscal só vai com pré-projeto dela pronto.",
        },
        {
          icon: "🤝",
          title: "Dani (Prestadores)",
          description: "Contrato prestador por escopo. Classificação complexa/média/simples. Custos de obra longe travados por Carla.",
        },
        {
          icon: "📦",
          title: "Ailton (Expedição)",
          description: "Kit por obra conferido item a item vs receita. Fotos saindo do depósito. Agendamento 1 sem + 1 dia antes.",
        },
        {
          icon: "👑",
          title: "Nat (Governança)",
          description: "Cronograma, pagamentos quinzenais, controle de evidência, ranking de equipes, governança semanal.",
        },
        {
          icon: "💰",
          title: "Carla (Financeiro)",
          description: "Valida escopo executável + preço + produto em linha. Trava custos de obra longe. Libera retenções.",
        },
        {
          icon: "🔨",
          title: "Germano (PCP/QA Marc)",
          description: "Auditoria diária na fábrica. ID por item. Timestamps por estágio. QC final antes de embarcar.",
        },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     03 · O FUNIL DE 20 ESTADOS NA VISÃO DA OBRA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 03",
      title: "20 Estados\nna Visão\nda Obra",
      subtitle: "Cada obra num único estado por vez.\nSem estado, a obra não existe.",
    },
  },
  {
    type: "process",
    props: {
      title: "Estados 01-10\nComercial → Projeto",
      label: "O que acontece antes de você tocar na obra",
      steps: [
        { number: "01-05", title: "Comercial", description: "Lead → qualificação → proposta → contrato assinado → 1ª parcela paga" },
        { number: "06", title: "1ª parcela paga", description: "GATE: obra ativa internamente. Antes disso, não existe" },
        { number: "07", title: "Onboarding", description: "Talita: grupo + pasta + dashboard + passo-a-passo" },
        { number: "08", title: "Pré-projeto pronto", description: "Tainara: arquivos, paginação, recortes, compatibilização" },
        { number: "09-10", title: "Vistoria + Executivo", description: "Fiscal: 1ª vistoria com pré-projeto. Aditivo cedo. Exec. em aprovação" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Estados 11-20\nPreparação → Pós",
      label: "Da compra à reciclagem comercial",
      steps: [
        { number: "11", title: "Lista insumos", description: "Receita de bolo: conferência vendido vs medido" },
        { number: "12-13", title: "Liberação", description: "Pré-liberação (Talita filtra) → 2ª vistoria (Fiscal)" },
        { number: "14-15", title: "Material + Contrato", description: "Ailton entrega kit → Dani fecha contrato prestador" },
        { number: "16", title: "Execução", description: "Check-in/out + fotos + retenção 25% + ranking equipes" },
        { number: "17-20", title: "Entrega → Pós", description: "Aceite → triagem pós-obra → NPS → reciclagem comercial" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     04 · PRÉ-PROJETO E 1ª VISTORIA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 04",
      title: "Pré-Projeto &\n1ª Vistoria",
      subtitle: "Sem pré-projeto = sem vistoria.\nSem vistoria = sem aditivo cedo.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Pré-Projeto → 1ª Vistoria",
      label: "Tainara prepara · Fiscal executa",
      leftTitle: "Pré-Projeto (Tainara)",
      leftItems: [
        "Arquivos atualizados coletados",
        "Sentido de paginação/forro definido",
        "Alçapões, cortineiros, grelhas mapeados",
        "Automação e iluminação identificados",
        "Encontros piso frio vs madeira",
        "Recortes previstos = aditivo cedo",
        "GATE: sem pré-projeto no card = sem vistoria",
      ],
      rightTitle: "1ª Vistoria (Fiscal)",
      rightItems: [
        "Metragem real vs projeto (aditivo imediato se diferir)",
        "Contrapiso: traço, nível, seco",
        "Obra fechada, sem infiltração",
        "Gesso, batentes, piso frio prontos",
        "Ar-condicionado, pingadeiras, alçapões",
        "Logística: armazenamento, segurança",
        "Relatório + pendências → grupo + pasta",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#4ECDC4",
    },
  },
  {
    type: "content",
    props: {
      title: "Marc: 1ª Vistoria\nDiferenciada",
      label: "Gates extras que revestimento não tem",
      highlight: "Marcenaria exige aval técnico de fábrica para escopos críticos ANTES da proposta + reunião técnica gravada com arquitetura.",
      items: [
        "Prumo, requadro, paredes — padronizar vãos (evitar 89, 88, 87 aleatórios)",
        "Compatibilização com engenharia e terceiros (fachada, estrutura, quadros)",
        "Mapa de itens versionado: descrição, dimensões, ferragens, acabamentos",
        "Reunião técnica gravada: cava, maçaneta, fechadura, limites técnicos",
        "Medição fina com responsável de produção presente (SP)",
        "Amostras assinadas pelo cliente antes de produzir (sem assinatura = não produz)",
        "\"Ficha Parket de Marcenaria\" padroniza detalhamento com arquiteto",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     05 · COMPRAS, KITAGEM E ENTREGA DE MATERIAL
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 05",
      title: "Compras,\nKitagem &\nEntrega",
      subtitle: "Nunca mandar \"a mais\" por vício.\nManda o necessário medido com lastro.",
    },
  },
  {
    type: "content",
    props: {
      title: "Fluxo de Compras\ne Kitagem",
      label: "Ronaldo/Pâmela (compras) + Ailton (expedição)",
      highlight: "Regra: conferência vendido vs medido → lista insumos (\"receita de bolo\"). Nunca comprar no vendido puro.",
      items: [
        "Estoque separa. Falta: compra nacional (Ronaldo). Importação: Pâmela",
        "Kit por obra (Ailton): piso + cola + barrote + parafuso + insumos",
        "Conferência item a item antes de sair do depósito — fotografar",
        "Forro: compatibilização com iluminação/ar/automação — recortes = aditivo ANTES de produzir",
        "Marc compras: grosso antecipa (lâmina, compensado). Compra final só após medição fina",
        "Agendamento de entrega: 1 semana antes + confirmação 1 dia antes",
        "Fotos saindo do depósito + fotos chegando na obra + aceite com assinatura",
        "Item faltante descoberto na obra = falha de kitagem, não desculpa de campo",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     06 · GATES OBRIGATÓRIOS (ALINHADOS AO FUNIL)
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 06",
      title: "Gates\nObrigatórios",
      subtitle: "6 portões alinhados ao funil de 20 estados.\nSem aprovação, não avança.",
    },
  },
  {
    type: "process",
    props: {
      title: "6 Gates\ndo Campo",
      label: "Cada gate tem: dono · checklist · evidência · SLA",
      steps: [
        {
          number: "G0",
          title: "Onboarding (Talita)",
          description: "Grupo + pasta + dashboard + passo-a-passo. Sem onboarding = obra não está organizada.",
        },
        {
          number: "G1",
          title: "Pré-Projeto (Tainara)",
          description: "Fiscal só vai com pré-projeto em mãos. Sem pré-projeto no card = não agenda vistoria.",
        },
        {
          number: "G2",
          title: "Liberação (Fiscal)",
          description: "2ª vistoria: umidade, nível, armazenamento OK. Sem liberação = equipe não mobiliza.",
        },
        {
          number: "G3",
          title: "Contrato Prestador (Dani)",
          description: "Assinado com classificação + custos travados. Sem contrato = sem start.",
        },
        {
          number: "G4",
          title: "Entrega + Aceite (Fiscal)",
          description: "Checklist item a item + termo assinado. Retenção liberada por item aceito.",
        },
        {
          number: "G5",
          title: "Pós-Obra (Talita)",
          description: "Triagem objetiva Parket/não-Parket + NPS em 7 dias + reciclagem comercial.",
        },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Critérios de Bloqueio\npor Gate",
      label: "Se qualquer item falhar → GATE NÃO ABRE",
      items: [
        "G0: Grupo não criado, pasta não organizada, passo-a-passo não enviado → obra não avança",
        "G1: Pré-projeto não anexado ao card → fiscal NÃO agenda vistoria",
        "G2: Umidade acima do limite, contrapiso irregular, acesso bloqueado → equipe NÃO mobiliza. 3ª ida = taxa ou vídeo+termo",
        "G3: Contrato de prestador não assinado, custos de obra longe não travados por Carla → obra NÃO inicia",
        "G4: NC crítica aberta, limpeza não feita, termo não assinado → retenção NÃO libera",
        "G5: Triagem não realizada, NPS não aplicado → obra NÃO encerra no sistema",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     07 · PRÉ-INSTALAÇÃO & LIBERAÇÃO DE FRENTE
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 07",
      title: "Liberação\nde Frente",
      subtitle: "O gate que separa empresa premium de empresa comum.\n3ª ida = taxa ou vídeo + termo.",
    },
  },
  {
    type: "split",
    props: {
      title: "Checklist de\nLiberação",
      label: "Gate G2 · Dono: Fiscal · Filtro: Talita",
      image: IMG_BLUEPRINT,
      items: [
        "1. Pré-liberação: engenharia envia fotos + confirma checklist. Talita filtra — evita deslocamento inútil",
        "2. Base nivelada — desnível máximo 3mm em 2m (régua + foto)",
        "3. Umidade verificada com higrômetro (foto do valor)",
        "4. Laser de nível em todos os ambientes",
        "5. Obra fornece andaime e caçamba",
        "6. Armazenamento seco e seguro para material",
        "7. Acesso livre para entrada de material",
        "8. Proteções de áreas adjacentes instaladas",
        "9. Se não liberado: lista do que falta + prazo para resolver",
        "10. 3ª ida: taxa cobrada OU vídeo/foto + termo de responsabilidade",
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Rev vs. Marc\nPré-Condições Específicas",
      label: "Gate G2 — Diferenças por Linha",
      leftTitle: "Revestimentos",
      leftItems: [
        "Umidade máxima: porcelanato ≤5%, madeira maciça ≤12%, vinílico ≤3%",
        "Contrapiso curado (mín. 28d cimento, 14d argamassa)",
        "Juntas de dilatação demarcadas conforme projeto",
        "Rodapés e soleiras: medidas conferidas pós-piso de referência",
        "Transições porta/desnível: solução definida e material disponível",
      ],
      rightTitle: "Marcenaria",
      rightItems: [
        "Vãos finais medidos (3 pontos: topo, meio, base)",
        "Gesso/forro finalizado e curado",
        "Pintura concluída nas áreas de interface",
        "Pontos elétricos e hidráulicos conferidos com projeto",
        "Amostras assinadas pelo cliente antes de produzir",
        "Medição fina com responsável de produção presente",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#888",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     08 · EXECUÇÃO CONTROLADA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 08",
      title: "Execução\nControlada",
      subtitle: "Contrato prestador → check-in/out → diário → retenção → ranking.",
    },
  },
  {
    type: "content",
    props: {
      title: "Regras de Start\ne Controle",
      label: "Dono: Fiscal + Dani (prestadores) + Nat (cronograma)",
      highlight: "Cronograma final só no dia do start ou entrega de material. Antes disso = datas estimadas, nunca compromissos.",
      items: [
        "Contrato prestador (Dani): classificação complexa/média/simples. Custos longe travados por Carla",
        "GATE: sem contrato assinado = sem start. Sem exceção",
        "Primeira obrigação da equipe: conferir material (cor, lote, insumos). Abriu e colou = assumiu responsabilidade",
        "Marc: não desembalar sem conferir etiqueta vs projeto executivo. Violou lacre = assumiu risco",
        "Controle diário: check-in/out obrigatório + fotos do produzido + ocorrências + m²/dia",
        "Feedback cruzado: \"como está ficando?\" no grupo para engenharia (radar antifraude)",
        "Só fiscal fala prazo/decisão com cliente. Equipe fala técnica",
        "Pagamento quinzenal: D10→D15, D25→D30. Retenção 25% por item até aceite",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Diário de Obra\nMínimo Obrigatório",
      label: "Preenchido até 18h · Sem diário = dia não existiu",
      highlight: "Dia sem registro = dia invisível = prejuízo não rastreável. Alerta automático em 2h se não preenchido.",
      items: [
        "Data, obra (PKT-YYYY-NNN), fiscal responsável, equipe presente",
        "Check-in (hora chegada) / Check-out (hora saída)",
        "Frentes trabalhadas (ambiente + tipo de serviço)",
        "m² produzido real vs. planejado",
        "Materiais consumidos (tipo + quantidade)",
        "Ocorrências e bloqueios (descrição + status + foto)",
        "NCs abertas no dia (nº do ticket + gravidade)",
        "Fotos obrigatórias: 3 por frente (antes, durante, depois)",
        "Plano para o dia seguinte (1ª tarefa + material necessário)",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     09 · ROTINA DIÁRIA DE CAMPO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 09",
      title: "Rotina Diária\nde Campo",
      subtitle: "Check-in manhã · checkpoint · encerramento. Sem exceção.",
    },
  },
  {
    type: "process",
    props: {
      title: "Ritual de Manhã",
      label: "07:00–07:30 · Antes de tocar em qualquer material",
      steps: [
        { number: "01", title: "Check-in no sistema", description: "Hora de chegada registrada. Equipe presente confirmada." },
        { number: "02", title: "Foto panorâmica da frente", description: "Estado geral antes do início. Referência para o diário." },
        { number: "03", title: "Conferir material do dia", description: "Marc: conferir etiqueta vs projeto. Rev: quantidade, lote, estado." },
        { number: "04", title: "Revisar escopo do dia", description: "Ambientes a executar, sequência, interfaces com outras equipes." },
        { number: "05", title: "Briefing com equipe (5 min)", description: "O que vai ser feito, pontos de atenção, bloqueios pendentes." },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Checkpoint + Encerramento",
      label: "12:00 e 17:00 · Pausa obrigatória para registro",
      steps: [
        { number: "12h", title: "Foto de progresso", description: "Cada ambiente em andamento. Incluir régua/nível quando aplicável." },
        { number: "12h", title: "Atualizar m² produzido", description: "Real vs planejado. Se atraso: comunicar fiscal." },
        { number: "17h", title: "Foto final de cada frente", description: "Estado ao fim do dia. Comparar com foto da manhã." },
        { number: "17h", title: "Fechar diário de obra", description: "Frentes, %, NCs, bloqueios, material consumido." },
        { number: "17h", title: "Proteção + limpeza + check-out", description: "Cobrir piso, proteger marc, isolar área. Obra Parket = obra limpa." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     10 · ROTINA SEMANAL
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 10",
      title: "Rotina Semanal",
      subtitle: "Planejamento, auditoria, ranking e lições aprendidas.",
    },
  },
  {
    type: "grid",
    props: {
      title: "4 Rituais Semanais\nObrigatórios",
      label: "Segunda a Sexta",
      cards: [
        {
          icon: "📋 SEG",
          title: "Planejamento + Ranking",
          description: "Nat publica ranking de equipes da semana anterior. Define frentes da semana, metas por dia, materiais. 30min.",
        },
        {
          icon: "🔍 QUA",
          title: "Auditoria Interna",
          description: "Fiscal audita. Score 0–100. Verifica diários, fotos, NCs, conformidade. Resultado no mesmo dia.",
        },
        {
          icon: "📊 QUI",
          title: "Report Semanal",
          description: "Status por obra no grupo + sistema. Nat consolida métricas semanais do funil para o fundador.",
        },
        {
          icon: "🧠 SEX",
          title: "Lições Aprendidas",
          description: "16h30–17h. 1 erro → causa raiz → ação → atualização de processo. Sem culpa, sem julgamento. 30min.",
        },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     11 · NÃO CONFORMIDADES (NC)
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 11",
      title: "Não Conformidades\n(NC)",
      subtitle: "Abrir, classificar, corrigir e prevenir. Com SLA e causa raiz.",
    },
  },
  {
    type: "process",
    props: {
      title: "Fluxo de NC\nem 5 Passos",
      label: "Dono do fluxo: Fiscal · SLA conforme gravidade",
      steps: [
        {
          number: "01",
          title: "Identificar & Registrar",
          description: "Foto + descrição + localização exata. Ticket aberto no mesmo turno.",
        },
        {
          number: "02",
          title: "Classificar Gravidade",
          description: "NC-A (crítica: impede uso) = 24h. NC-B (funcional: afeta qualidade) = 48h. NC-C (estética) = 72h.",
        },
        {
          number: "03",
          title: "Definir Correção + Dono",
          description: "Ação corretiva, responsável, prazo, material. Tudo no ticket.",
        },
        {
          number: "04",
          title: "Executar & Evidenciar",
          description: "Correção + foto antes vs depois. Comparação obrigatória.",
        },
        {
          number: "05",
          title: "Causa Raiz & Prevenção",
          description: "Por que aconteceu? O que muda? Sem causa raiz, NC NÃO FECHA.",
        },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "10 NCs Mais Comuns\ne Como Prevenir",
      label: "Padrão de erro → Padrão de prevenção",
      items: [
        "1. Desnível em junta — Causa: base irregular. Prevenção: medir 3 pontos antes de assentar.",
        "2. Mancha em madeira — Causa: umidade não medida. Prevenção: higrômetro obrigatório no G2.",
        "3. Vão incorreto marc — Causa: medição com gesso incompleto. Prevenção: medir só com acabamento pronto.",
        "4. Arranhão em superfície — Causa: falta de proteção. Prevenção: cobrir imediatamente após instalar.",
        "5. Paginação fora do projeto — Causa: planta não consultada. Prevenção: projeto na frente.",
        "6. Rodapé desalinhado — Causa: ondulação no piso. Prevenção: verificar planicidade antes.",
        "7. Ferragem mal regulada — Causa: ajuste apressado. Prevenção: teste funcional 10x antes de entregar.",
        "8. Cola aparente — Causa: excesso + limpeza tardia. Prevenção: limpar imediatamente.",
        "9. Peça com defeito de fábrica instalada — Causa: sem inspeção. Prevenção: conferir etiqueta vs projeto.",
        "10. Cor/tonalidade diferente — Causa: lotes misturados. Prevenção: conferir lote + separar por ambiente.",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     12 · MUDANÇAS E ADITIVOS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 12",
      title: "Mudanças &\nAditivos",
      subtitle: "Aditivo só na 1ª vistoria ou fase de executivo.\nDepois = proibido sem aprovação formal.",
    },
  },
  {
    type: "content",
    props: {
      title: "Regras de Aditivo\nAlinhadas ao Funil",
      label: "Proteção de margem e expectativa",
      highlight: "Ruptura #2: aditivo durante/após instalação = margem evapora. Regra: aditivo só na 1ª vistoria ou executivo.",
      items: [
        "1ª Vistoria: se metragem real difere do vendido → aditivo IMEDIATO formalizado",
        "Fase de executivo: forro com recortes, alçapões, grelhas → aditivo ANTES de comprar/produzir",
        "Depois que material está na obra: aditivo só com aprovação formal do cliente + Carla",
        "\"Só faz aí que depois a gente acerta\" é a frase que mais destrói margem. Se não está no ticket, não existe",
        "Fluxo: solicitação → ticket → impacto (custo + prazo) → aprovação documentada → só então executa",
        "Toda mudança registrada no grupo da obra E na pasta — nunca só WhatsApp",
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "Aditivo cedo é profissionalismo.\nAditivo tarde é prejuízo.\nAditivo não formalizado\nNÃO EXISTE.",
      attribution: "Regra operacional #2",
      label: "Proteção de Margem",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     13 · ENTREGA E ACEITE
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 13",
      title: "Entrega &\nAceite",
      subtitle: "Checklist item a item. Termo digital.\nRetenção liberada por item aceito.",
    },
  },
  {
    type: "content",
    props: {
      title: "Checklist de\nEntrega Perfeita",
      label: "Gate G4 · Dono: Fiscal + Talita",
      highlight: "Obra grande = fiscal entrega presencial. Obra pequena = termo digital. Retenção só libera por item aceito.",
      items: [
        "1. Todas as frentes concluídas conforme projeto executivo",
        "2. Zero NC-A ou NC-B abertas",
        "3. Limpeza final profissional — obra como showroom",
        "4. Álbum fotográfico completo (mín. 3 fotos por ambiente)",
        "5. Manual de cuidado e manutenção entregue",
        "6. Termo de aceite preparado — checklist item a item com fotos evidência",
        "7. Walkthrough com cliente/arquiteto realizado",
        "8. Proteções removidas e descartadas",
        "9. Ferramentas e materiais retirados do local",
        "10. Retenção liberada por cada item aceito — não tudo de uma vez",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Pacote de Entrega\npara o Cliente",
      label: "O que o cliente recebe na mão",
      cards: [
        {
          icon: "📸",
          title: "Álbum de Entrega",
          description: "Fotos de cada ambiente: geral + detalhes. Mín. 20 fotos por obra. Autorização para portfólio.",
        },
        {
          icon: "📖",
          title: "Manual de Cuidado",
          description: "Limpeza, manutenção, produtos recomendados/proibidos, frequência, garantias.",
        },
        {
          icon: "✍️",
          title: "Termo de Aceite Digital",
          description: "Assinado pelo cliente. Checklist item a item. Pendências com SLA. Libera retenção.",
        },
        {
          icon: "📋",
          title: "Registro de Materiais",
          description: "Produtos usados, lotes, fornecedores. Para reposição futura e manutenção.",
        },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     14 · PÓS-OBRA E RECICLAGEM COMERCIAL
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 14",
      title: "Pós-Obra &\nReciclagem",
      subtitle: "Triagem objetiva, NPS no pico de satisfação\ne novos leads no círculo.",
    },
  },
  {
    type: "content",
    props: {
      title: "Pós-Obra com\nTriagem Objetiva",
      label: "Dono: Talita (CS) + Fiscal (avaliação técnica)",
      highlight: "Pós-obra não é custo — é oportunidade. NPS no pico de satisfação gera indicação.",
      items: [
        "Talita recebe e registra todo chamado de pós-obra",
        "Fiscal avalia tecnicamente: Parket ou não-Parket?",
        "Parket: agenda e arca (custo e prazo internos)",
        "Não-Parket: explica com relatório técnico cirúrgico + orçamento",
        "Marc pós-obra: portas/requadro geram discussão — relatório precisa ser especialmente detalhado",
        "NPS em 7 dias: nota indicação + nota equipe + resultado vs expectativa",
        "Reciclagem: \"quem mais no círculo?\" Vendedor retoma com arquiteto",
        "Fundador participa pessoalmente quando crise virou vitória",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Handoff\nObras → Pós-Obra",
      label: "Dono: Fiscal → Talita · SLA: 48h após aceite",
      highlight: "Sem pacote completo, pós-obra não assume. Chamado sem contexto = retrabalho para todos.",
      items: [
        "Termo de aceite assinado (com pendências se houver)",
        "Álbum fotográfico completo (antes/durante/depois)",
        "Lista de materiais utilizados (produto, lote, fornecedor)",
        "Diários de obra completos (todos os dias)",
        "NCs abertas e fechadas com causa raiz",
        "Mudanças/aditivos aprovados e executados",
        "Manual de cuidado entregue ao cliente",
        "Contatos de referência (cliente, arquiteto, portaria/zelador)",
        "Mapa de pontos sensíveis (onde ficar atento em revisões futuras)",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     15 · 6 PONTOS DE RUPTURA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 15",
      title: "6 Pontos de\nRuptura",
      subtitle: "Onde o processo quebra no campo e como travar com gate.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Rupturas 1-3",
      label: "Pré-projeto + Aditivo + Cronograma",
      leftTitle: "R1: Fiscal sem Pré-Projeto",
      leftItems: [
        "Vistoria sem saber o que conferir",
        "Aditivo não pego cedo",
        "GATE: card sem pré-projeto = não agenda",
        "Dono: Tainara prepara e anexa",
      ],
      rightTitle: "R2-R3: Aditivo Tarde + Cronograma Ilusório",
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
      title: "Rupturas 4-6",
      label: "Material + Disciplina + Marcenaria",
      leftTitle: "R4-R5: Entrega + Disciplina",
      leftItems: [
        "R4: Material some/estraga = palavra contra palavra",
        "GATE: fotos + assinatura + armazenamento",
        "R5: Dia sem registro = dia invisível",
        "GATE: bônus/multa + check-in/out + prova diária",
      ],
      rightTitle: "R6: Marc sem Rastreabilidade",
      rightItems: [
        "Nunca sabe custo, tempo, margem por item",
        "GATE: ID por item + Germano auditor diário",
        "QC final assinando antes de embarcar",
        "Sem etiqueta = peça não existe",
      ],
      leftColor: "#E85D5D",
      rightColor: "#E8C97A",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     16 · CHECKLISTS POR TIPOLOGIA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 16",
      title: "Checklists Mestres\npor Tipologia",
      subtitle: "Piso · Forro/Painel · Deck · Escada · Marcenaria",
    },
  },
  {
    type: "content",
    props: {
      title: "Checklist Mestre\nPiso",
      label: "16.1 · Revestimento de Piso",
      items: [
        "☐ Base nivelada (desnível máx. 3mm/2m) — foto com régua",
        "☐ Umidade verificada por tipo (maciça ≤12%, engenheirada ≤10%, vinílico ≤3%) — foto higrômetro",
        "☐ Paginação conferida com projeto — planta na frente",
        "☐ Juntas de dilatação demarcadas — foto das marcações",
        "☐ 1ª fileira nivelada e alinhada — nível a laser ligado",
        "☐ Encaixes firmes, sem folga — pressão manual em cada junta",
        "☐ Cola/argamassa uniforme, sem excesso — limpar imediatamente",
        "☐ Transições porta/desnível: peça de arremate conforme projeto",
        "☐ Rodapé alinhado e sem frestas — verificar com lanterna",
        "☐ Limpeza final + proteção instalada — foto do piso protegido",
        "☐ Caminhamento teste — verificar som oco (maciça/engenheirada)",
        "☐ Foto final: panorâmica + 2 detalhes + 1 transição",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Checklist Mestre\nForro & Painel",
      label: "16.2 · Forro de Madeira e Painéis",
      items: [
        "☐ Compatibilização com iluminação/ar/automação ANTES de instalar",
        "☐ Estrutura de suporte verificada (prumo, espaçamento, carga) — foto",
        "☐ Nível conferido nos 4 cantos + centro — laser",
        "☐ Pontos elétricos/luminárias mapeados antes da instalação",
        "☐ Réguas/painéis inspecionados (cor, defeitos, dimensão) — 100%",
        "☐ Primeira peça nivelada e esquadrejada — referência",
        "☐ Juntas uniformes entre peças — gabarito de espaçamento",
        "☐ Fixações ocultas ou conforme padrão — sem pregos aparentes",
        "☐ Recortes em luminárias/spots: precisos, sem lasca",
        "☐ Alçapões, cortineiros, grelhas: conforme mapeamento do pré-projeto",
        "☐ Limpeza + proteção de superfície — foto final",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Checklist Mestre\nDeck & Escada",
      label: "16.3-16.4 · Deck + Escada",
      items: [
        "DECK:",
        "☐ Estrutura/vigamento: espaçamento conforme projeto, nivelado",
        "☐ Caimento verificado (mín. 1% para externa) — nível + régua",
        "☐ Espaçamento entre réguas uniforme (gabarito + foto)",
        "☐ Fixação conforme projeto (parafuso inox, clip oculto)",
        "☐ Ralos e caimentos: água não acumula",
        "☐ Acabamento de bordas: lixado, sem farpa",
        "ESCADA:",
        "☐ Estrutura verificada (prumo, nível, dimensões)",
        "☐ Pisadas: profundidade uniforme, encaixe firme",
        "☐ Espelhos alinhados, sem fresta com pisada",
        "☐ Guarda-corpo: fixação sólida, altura ≥92cm",
        "☐ Teste funcional: subir/descer 5x (sem rangido, sem movimento)",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Checklist Mestre\nMarcenaria",
      label: "16.5 · Instalação e Ajuste Fino",
      items: [
        "☐ NÃO desembalar sem conferir etiqueta vs projeto executivo",
        "☐ Vãos re-medidos antes de descarregar (3 pontos: topo, meio, base)",
        "☐ Peças conferidas vs lista de embarque (quantidade, numeração, estado)",
        "☐ Sequência de montagem definida — mapa na mão do instalador",
        "☐ Nível e prumo verificados a cada módulo",
        "☐ Interfaces conferidas: gesso, pintura, pedra, metal",
        "☐ Ferragens reguladas: dobradiça (3 eixos), corrediça (3 pontos), pistão",
        "☐ Teste funcional: abrir/fechar 10x cada porta, gaveta, basculante",
        "☐ Alinhamento de fronts: folga uniforme entre portas (máx. 3mm)",
        "☐ Toques e acabamentos: ponteiras, puxadores, trincos",
        "☐ Limpeza de superfície: sem cola, sem digital, sem riscos",
        "☐ Proteção em cada módulo concluído + foto",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     17 · COMUNICAÇÃO NO CAMPO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 17",
      title: "Comunicação\nno Campo",
      subtitle: "Grupo por obra, feedback cruzado\ne regra WhatsApp.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Regras de\nComunicação",
      label: "Comunicação sem registro não existe",
      leftTitle: "✅ Pode ir por WhatsApp",
      leftItems: [
        "Alerta rápido: \"cheguei na obra\", \"material recebido\"",
        "Foto de bloqueio urgente (ticket obrigatório em seguida)",
        "Feedback cruzado: \"como está ficando?\" no grupo da obra",
        "Confirmação de horário/logística do dia seguinte",
        "Pedido de ajuda imediata (segurança, emergência)",
      ],
      rightTitle: "🚫 Proibido — só registro formal",
      rightItems: [
        "Decisão de escopo ou mudança de projeto",
        "Aprovação de material, cor, acabamento",
        "Aceitação de aditivo ou mudança de prazo",
        "Registro de NC ou bloqueio",
        "Comunicação oficial com cliente sobre escopo",
        "Qualquer coisa que vire \"eu falei, mas ninguém viu\"",
      ],
      leftColor: "#7BC48A",
      rightColor: "#E85D5D",
    },
  },
  {
    type: "content",
    props: {
      title: "Estrutura do\nGrupo por Obra",
      label: "Padrão de comunicação",
      highlight: "Cada obra tem: grupo WhatsApp + pasta organizada + dashboard no sistema. Sem os 3, obra não está organizada.",
      items: [
        "Membros: cliente/engenharia/arq + vendedor + Tainara + Ailton + fiscal + Nat + marc (se aplicável)",
        "Passo-a-passo enviado no onboarding: etapas, regras, contatos, o que gera custo extra",
        "Feedback cruzado: engenharia confirma no grupo como está ficando — valida sem fiscal 100%",
        "Só fiscal fala prazo e decisão com cliente no grupo. Equipe fala técnica",
        "Toda decisão de escopo/prazo/custo: registro por escrito no mesmo dia",
        "Código da obra (PKT-YYYY-NNN) usado em TODAS as comunicações",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     18 · SEGURANÇA E ZERO DANO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 18",
      title: "Segurança &\nZero Dano",
      subtitle: "Proteção do ambiente, do time e da reputação.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Padrão de Proteção\nObrigatório",
      label: "Zero dano colateral",
      leftTitle: "Proteção do Ambiente",
      leftItems: [
        "Cobrir pisos instalados com manta/papelão antes de trânsito",
        "Proteger marcenaria com plástico bolha + fita crepe",
        "Isolar áreas concluídas — fita zebrada + aviso",
        "Proteger batentes, rodapés, soleiras durante transporte",
        "Cobrir louças, metais e vidros nas áreas de trabalho",
        "Retirar sapatos sujos antes de pisar em área finalizada",
      ],
      rightTitle: "Segurança do Time",
      rightItems: [
        "EPIs obrigatórios por atividade (luva, óculos, máscara, protetor auricular)",
        "Ferramentas elétricas: verificação visual antes de usar",
        "Produtos químicos: ficha de segurança, ventilação",
        "Escadas: base estável, 3 pontos de apoio",
        "Peso: cargas >25kg = duas pessoas ou equipamento",
        "Primeiros socorros: kit acessível em toda obra",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#888",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     19 · MÉTRICAS E RANKING
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 19",
      title: "Métricas,\nRanking &\nRetenção",
      subtitle: "10 métricas semanais + ranking de equipes + sistema bônus/multa.",
    },
  },
  {
    type: "metrics",
    props: {
      title: "KPIs Obrigatórios\nde Campo",
      label: "Medição semanal · Nat consolida",
      metrics: [
        { value: "100%", label: "Diários Completos", sublabel: "Dias com check-in/out + fotos + diário" },
        { value: "<3", label: "NCs / Obra", sublabel: "Não conformidades por obra entregue" },
        { value: "≥85%", label: "FPY", sublabel: "First Pass Yield — aprovado na 1ª inspeção" },
        { value: "m²/dia", label: "Produtividade", sublabel: "m² produzido real vs planejado por equipe" },
        { value: "25%", label: "Retenção por Item", sublabel: "Liberada apenas com aceite assinado" },
        { value: "Ranking", label: "Equipes Semanal", sublabel: "Pontuação: qualidade + prazo + registro + NCs" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Sistema de\nBônus / Multa",
      label: "Incentivo direto por performance",
      highlight: "Pagamento quinzenal: D10→D15, D25→D30. Retenção 25% por item até aceite formal.",
      items: [
        "BÔNUS: obra entregue no prazo + zero NC-A + diários 100% completos → bônus de performance",
        "BÔNUS: equipe no top 3 do ranking por 4 semanas consecutivas → bônus de excelência",
        "MULTA: dia sem diário = dedução no pagamento quinzenal. Notificação automática em 2h",
        "MULTA: NC-A causada por negligência = custo de correção debitado",
        "MULTA: material desperdiçado por falta de conferência = custo debitado",
        "Ranking semanal publicado na segunda-feira — transparência total",
        "Retenção: 25% por item retido até aceite formal do cliente. Libera item a item, não tudo de uma vez",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     20 · AUDITORIA SEMANAL + WAR ROOM
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 20",
      title: "Auditoria Semanal\n& War Room",
      subtitle: "Score 0–100 e o que fazer quando a obra entra em risco.",
    },
  },
  {
    type: "content",
    props: {
      title: "Score de Auditoria\n0–100",
      label: "Critérios de pontuação · Peso por categoria",
      highlight: "Obra com score <60 por 2 semanas consecutivas → War Room automático.",
      items: [
        "DIÁRIOS (25 pts) — 5 pts/dia completo na semana. Sem diário = -5.",
        "FOTOS (15 pts) — 3 pts/dia com padrão fotográfico. Sem foto = 0.",
        "NCs (20 pts) — 20 se zero NC-A. -5 por NC-A aberta. -2 por NC-B > SLA.",
        "CHECKLISTS (15 pts) — 3 pts por checklist preenchido corretamente.",
        "PROTEÇÃO (10 pts) — 10 se zero dano colateral. -5 por incidente.",
        "LIMPEZA (5 pts) — 5 se obra limpa. -2 por ocorrência.",
        "COMUNICAÇÃO (10 pts) — 10 se atualizações no SLA. -3 por atraso.",
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "War Room:\nQuando a Obra\nEntra em Risco",
      label: "Protocolo de intervenção imediata",
      image: IMG_CONCRETE,
      items: [
        "TRIGGER: Score <60 por 2 semanas OU NC-A não resolvida OU atraso >3 dias",
        "AÇÃO 1: Reunião de crise em 24h (Fiscal + Nat + Fundador). Presencial.",
        "AÇÃO 2: Diagnóstico de causa raiz — processo, pessoa ou informação?",
        "AÇÃO 3: Plano de recuperação em 48h com ações diárias e donos.",
        "AÇÃO 4: Auditoria diária até score voltar a ≥70 por 5 dias.",
        "AÇÃO 5: Post-mortem — o que muda no playbook para nunca repetir.",
        "COMUNICAÇÃO: Cliente recebe atualização diária durante War Room.",
        "ESCALAÇÃO: Se não resolver em 1 semana → reforço de equipe ou substituição.",
      ],
    },
  },
  {
    type: "funnel",
    props: {
      title: "Escala de Risco\nda Obra",
      label: "Classificação semanal",
      stages: [
        { name: "🟢 Score 80–100", description: "Obra sob controle. Manter ritmo e rituais.", percentage: "VERDE" },
        { name: "🟡 Score 60–79", description: "Atenção. 2+ itens abaixo. Ação corretiva.", percentage: "AMARELO" },
        { name: "🟠 Score 40–59", description: "Risco alto. War Room ativado. Auditoria diária.", percentage: "LARANJA" },
        { name: "🔴 Score 0–39", description: "Crítico. Intervenção imediata. Escalação fundador.", percentage: "VERMELHO" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     21 · CONTROLES MARCENARIA NO CAMPO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 21",
      title: "Controles\nMarcenaria\nno Campo",
      subtitle: "7 gates extras que revestimento não tem.\nGermano na fábrica, fiscal no campo.",
    },
  },
  {
    type: "content",
    props: {
      title: "Rastreabilidade\nFábrica → Campo",
      label: "Dono fábrica: Germano · Dono campo: Fiscal",
      highlight: "Cada item com ID único (etiqueta) vinculado à obra e ao projeto executivo. Sem etiqueta = peça não existe.",
      items: [
        "Timestamps por estágio: bancada → pintura início/fim → QC final → embalagem → expedição",
        "Germano audita no fim do dia: passa nas bancadas, confere trena, tira fotos, registra por item",
        "QC final: medidas vs etiqueta vs projeto. Acabamento (risco, empeno, tonalidade). Sem assinatura QA = não embarca",
        "Campo: NÃO desembalar sem conferir etiqueta vs projeto executivo",
        "Campo: violou lacre = assumiu responsabilidade. Regra inegociável",
        "Campo: fiscal solta e acompanha — equipe não decide sequência sozinha",
        "Pós-obra marc: portas e requadro geram discussão — relatório técnico cirúrgico obrigatório",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "7 Gates Extras\nMarcenaria",
      label: "O que marc exige além de revestimento",
      items: [
        "① Aval técnico de fábrica antes da proposta (escopos críticos)",
        "② Reunião técnica gravada com arquitetura antes de ir à obra",
        "③ Mapa de itens com versionamento formal (não memória + WhatsApp)",
        "④ Medição fina com responsável de produção presente (SP)",
        "⑤ Aprovação de amostras assinadas antes de produzir",
        "⑥ ID por item + timestamps + QC por peça (Germano)",
        "⑦ \"Ficha Parket de Marcenaria\" padronizando detalhamento com arquiteto",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     22 · TEMPLATES OPERACIONAIS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 22",
      title: "Templates\nOperacionais",
      subtitle: "9 modelos prontos para copiar e usar.",
    },
  },
  {
    type: "grid",
    props: {
      title: "Templates Prontos\npara o Campo",
      label: "Copie, adapte, use. Sem desculpa.",
      cards: [
        {
          icon: "📓",
          title: "Diário de Obra",
          description: "Check-in/out, equipe, frentes, m², bloqueios, NCs, fotos, plano do dia seguinte.",
        },
        {
          icon: "✅",
          title: "Liberação de Frente",
          description: "10 itens de pré-condição + assinatura do fiscal + 6 fotos mínimas.",
        },
        {
          icon: "📝",
          title: "Termo de Aceite",
          description: "Digital: checklist item a item + fotos evidência + assinatura + liberação de retenção.",
        },
        {
          icon: "⚠️",
          title: "Registro de NC",
          description: "Foto, gravidade (A/B/C), causa raiz, correção, dono, SLA, evidência antes/depois.",
        },
        {
          icon: "🤝",
          title: "Contrato Prestador",
          description: "Automático por escopo. Classificação. Retenção 25%. Bônus/multa. Custos travados.",
        },
        {
          icon: "📋",
          title: "Pré-Liberação",
          description: "Fotos da engenharia + checklist + filtro por Talita antes de agendar fiscal.",
        },
        {
          icon: "📊",
          title: "Atualização Semanal",
          description: "Status por frente, NCs, riscos, ranking, m², previsão de entrega.",
        },
        {
          icon: "🔄",
          title: "Handoff Obras → Pós",
          description: "Pacote completo: diários, NCs, materiais, contatos, pontos sensíveis.",
        },
        {
          icon: "🏷️",
          title: "Triagem Pós-Obra",
          description: "Parket ou não-Parket? Relatório técnico + fotos + recomendação + orçamento.",
        },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     FECHAMENTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "Disciplina no processo\né liberdade no resultado.\nQuem segue o playbook\nnão precisa de herói.",
      attribution: "Parket Pisos — Time de Obras",
      label: "Princípio Final",
    },
  },
  {
    type: "content",
    props: {
      title: "Decisões do\nFundador para o Campo",
      label: "Ação Imediata",
      highlight: "Estas decisões habilitam o playbook na prática:",
      items: [
        "① Comunicar ao time: \"sem pré-projeto = sem vistoria\" — gate cultural ativo desde segunda",
        "② Ativar contrato de prestador obrigatório (Dani) com retenção 25% por item",
        "③ Implementar check-in/out diário com foto — sem registro = sem pagamento de bônus",
        "④ Publicar ranking semanal de equipes (Nat) — transparência total",
        "⑤ Definir regra de 3ª vistoria: taxa ou vídeo + termo de responsabilidade",
        "⑥ Ativar triagem pós-obra: Parket/não-Parket com relatório técnico",
        "⑦ Marc: exigir etiqueta por item e QC final assinado (Germano) antes de embarcar",
        "⑧ Escolher 3 obras piloto para rodar todos os gates e checklists",
      ],
    },
  },
  {
    type: "closing",
    props: {
      title: "Playbook\nde Obras",
      subtitle: "22 capítulos · 6 gates · 9 checklists · 6 rupturas\nDonos nomeados · Ranking semanal\nRetenção 25% · Triagem pós-obra\n\nParket Pisos\nwww.parket.com.br",
      image: IMG_HERRINGBONE,
    },
  },
];
