import { type SlideData } from "./slides-data";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";
import parketSpiral from "figma:asset/4a6a8ad24bcda1f844920eb717e3e4d47f57d4d3.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";

const IMG = {
  craft: "https://images.unsplash.com/photo-1577030505165-4b38f69d1b1f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3IlMjBpbnN0YWxsYXRpb24lMjBjcmFmdHNtYW5zaGlwfGVufDF8fHx8MTc3MjA3NzYwMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  team: "https://images.unsplash.com/photo-1758611972678-bc3b29b4718f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHRlYW0lMjBvcGVyYXRpb25zJTIwbWFuYWdlbWVudCUyMG1lZXRpbmd8ZW58MXx8fHwxNzcyMDc3NjAwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  workflow: "https://images.unsplash.com/photo-1685839061205-a3ea35b7b804?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWluaW1hbCUyMHdvcmtmbG93JTIwcHJvY2VzcyUyMGRpYWdyYW18ZW58MXx8fHwxNzcyMDc2ODYzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  interior: "https://images.unsplash.com/photo-1758548157195-67d141468467?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwaW50ZXJpb3IlMjBkZXNpZ24lMjB3b29kJTIwcGFuZWxpbmclMjBsdXh1cnl8ZW58MXx8fHwxNzcyMDc3NjAxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
};

export const workflowPlaybookSlides: SlideData[] = [

  /* ═══════════════════════════════════════════════════════════
     CAPA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "cover",
    props: {
      title: "Playbook do\nWorkflow\nOperacional",
      subtitle: "20 macroestados, fluxos end-to-end Rev + Marc,\ngates com donos nomeados, handoffs, RACI real,\n6 rupturas, 9 checklists e 10 metricas semanais.",
      image: parketDeckLake,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     MANIFESTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "Workflow nao e fluxograma.\nE a forma como o time\nentrega valor ao cliente\ncom previsibilidade,\nqualidade e margem.",
      label: "Manifesto Operacional",
      attribution: "Sistema Operacional Parket",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 01 — VISAO GERAL
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 01",
      title: "Arquitetura\ndo Workflow",
      subtitle: "O sistema completo: 20 estados, 2 fluxos,\n10 gates, 7 donos, 1 objetivo.",
    },
  },

  {
    type: "grid",
    props: {
      title: "10 Componentes\ndo Workflow",
      label: "Visao Geral",
      cards: [
        { title: "20 Macroestados", description: "Funil unico — cada obra em um unico estado por vez", icon: "🔄" },
        { title: "Fluxo Revestimentos", description: "18 etapas end-to-end: piso, forro, deck, escada, painel", icon: "🪵" },
        { title: "Fluxo Marcenaria", description: "19 etapas com gates extras: portas, paineis, fachada", icon: "🔨" },
        { title: "5 Gates Rev", description: "G0 Escopo, G1 Freeze, G2 Compra, G3 Frente, G4 Aceite", icon: "🛡️" },
        { title: "5 Gates Marc", description: "GM0 Briefing, GM1 Freeze, GM2 QA, GM3 Frente, GM4 Aceite", icon: "🔒" },
        { title: "RACI com 7 Donos", description: "Talita, Tainara, Carla, Ailton, Dani, Nat, Germano", icon: "👥" },
        { title: "6 Pontos de Ruptura", description: "Onde o processo quebra — e como o gate trava", icon: "⚠️" },
        { title: "9 Checklists Mestres", description: "Do onboarding ao pos-obra: formularios digitais", icon: "✅" },
        { title: "4 Termos Padrao", description: "Responsabilidade, taxa 3a vistoria, aceite, prestador", icon: "📝" },
        { title: "10 Metricas Semanais", description: "Dashboard automatico — IA gera toda semana", icon: "📊" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "8 Garantias do Sistema",
      label: "O que cada gate protege",
      highlight: "Todo gate existe para garantir uma dessas 8 promessas. Se nao protege nenhuma, elimine-o.",
      items: [
        "1. Escopo vendido coerente com o executavel",
        "2. Medicao correta cedo — aditivo cedo, nao tarde",
        "3. Projeto executivo aprovado antes de entrar na obra",
        "4. Obra liberada antes de entregar e instalar",
        "5. Material entregue com prova e armazenamento correto",
        "6. Instalacao com controle diario, qualidade e produtividade",
        "7. Entrega com termo de aceite + pos-obra com triagem objetiva",
        "8. Pos-venda gerando nova receita (cliente, arquiteto, engenharia, gerenciador)",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 02 — 20 MACROESTADOS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 02",
      title: "20 Macroestados\ndo Funil",
      subtitle: "O workflow que o app e a IA enxergam.\nCada obra em um unico estado por vez — sem obra fantasma.",
    },
  },

  {
    type: "process",
    props: {
      title: "Estados 01-05",
      label: "Comercial e qualificacao",
      steps: [
        { number: "01", title: "Lead capturado", description: "CRM: origem, perfil, cidade, tipo escopo, estagio, proxima acao" },
        { number: "02", title: "Qualificacao e escopo", description: "Reuniao consultiva: solucao/ambiente, driver, decisores, cronograma" },
        { number: "03", title: "Levantamento e proposta", description: "Time levantamento analisa projeto, lista premissas, versao arquivo" },
        { number: "04", title: "Proposta apresentada", description: "Showroom ou call. Follow-up com cadencia no CRM" },
        { number: "05", title: "Contrato assinado", description: "Carla valida: escopo executavel, preco ok, produto em linha" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "Estados 06-10",
      label: "Ativacao e projeto",
      steps: [
        { number: "06", title: "1a parcela paga", description: "Gate real: obra ativada internamente no pipeline" },
        { number: "07", title: "Onboarding de obra", description: "Talita: grupo, pasta, checklist, boas-vindas, passo-a-passo" },
        { number: "08", title: "Pre-projeto pronto", description: "Tainara: arquivos conferidos, paginacao, recortes mapeados" },
        { number: "09", title: "1a vistoria realizada", description: "Fiscal: metragem, condicoes, logistica. Aditivo cedo se precisar" },
        { number: "10", title: "Projeto executivo", description: "Em aprovacao. Forro exige compatibilizacao (iluminacao/ar/automacao)" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "Estados 11-15",
      label: "Compras, liberacao e material",
      steps: [
        { number: "11", title: "Lista insumos aprovada", description: "Receita de bolo calculada. Estoque separa, falta compra" },
        { number: "12", title: "Pre-liberacao", description: "Engenharia envia fotos + checklist. Atendimento filtra" },
        { number: "13", title: "2a vistoria liberacao", description: "Fiscal: umidade, laser, andaime, cacamba, armazenamento" },
        { number: "14", title: "Entrega material", description: "Ailton confere vs receita. Fotos saindo e chegando. Aceite" },
        { number: "15", title: "Contrato prestador", description: "Dani: assinado, custos travados, classificacao complexidade" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "Estados 16-20",
      label: "Execucao, entrega e pos",
      steps: [
        { number: "16", title: "Instalacao controlada", description: "Check-in/out, fotos diarias, pagamento quinzenal, retencao 25%" },
        { number: "17", title: "Entrega e aceite", description: "Termo assinado. Retencao liberada por item aceito" },
        { number: "18", title: "Pos-obra", description: "Talita registra. Fiscal avalia: Parket ou nao? Triagem objetiva" },
        { number: "19", title: "Encerramento e NPS", description: "Nota indicacao, nota equipe, resultado vs expectativa" },
        { number: "20", title: "Reciclagem comercial", description: "Novos leads no circulo: amigos, projetos, arquiteto, engenharia" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 03 — FLUXO REVESTIMENTOS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 03",
      title: "Fluxo End-to-End\nRevestimentos",
      subtitle: "18 etapas — piso, forro, deck, painel, escada, banco.\nDo lead ao pos-venda estrategico.",
    },
  },

  {
    type: "split",
    props: {
      title: "Etapas 0-3: Entrada e Escopo",
      label: "Prospeccao ate contrato",
      items: [
        "0 — Prospeccao: lead registrado no CRM com origem, perfil, escopo",
        "1 — Qualificacao: reuniao consultiva, driver do cliente, decisores",
        "2 — Levantamento: conferencia de projeto, lista premissas, versao arquivo",
        "3 — Proposta e contrato: showroom/call, Carla valida escopo + preco",
      ],
      highlight: "GATE G0 — Escopo Fechado: sem escopo validado por Carla, a obra NAO e ativada.",
      image: IMG.interior,
    },
  },

  {
    type: "split",
    props: {
      title: "Etapas 4-7: Ativacao e Projeto",
      label: "Onboarding ate projeto executivo",
      items: [
        "4 — Ativacao: 1a parcela paga, obra entra no pipeline interno",
        "5 — Onboarding: Talita cria grupo, pasta, checklist, boas-vindas",
        "6 — Pre-projeto: Tainara confere arquivos, paginacao, recortes, forro",
        "7 — Projeto executivo: em aprovacao, compatibilizacao com iluminacao/ar",
      ],
      highlight: "GATE G1 — Freeze Aprovado: projeto executivo congelado com assinatura digital do cliente. Qualquer mudanca = aditivo formal.",
      image: IMG.craft,
    },
  },

  {
    type: "split",
    props: {
      title: "Etapas 8-11: Compras e Liberacao",
      label: "Insumos, vistoria e material",
      items: [
        "8 — 1a vistoria: fiscal mede, verifica condicoes, logistica, umidade",
        "9 — Lista de insumos: receita de bolo calculada, estoque separa",
        "10 — 2a vistoria liberacao: umidade laser, andaime, cacamba, acesso",
        "11 — Entrega material: Ailton confere 100% vs receita, fotos, aceite",
      ],
      highlight: "GATE G2 — Compra Validada: pedidos confirmados com prazo compativel. GATE G3 — Frente Liberada: 2a vistoria aprovada com checklist digital.",
      image: parketStoneWall,
    },
  },

  {
    type: "split",
    props: {
      title: "Etapas 12-17: Execucao e Entrega",
      label: "Instalacao controlada ate aceite formal",
      items: [
        "12 — Contrato prestador: Dani assina, custos travados, complexidade",
        "13 — Instalacao: check-in/out diario, fotos, apontamento, retencao 25%",
        "14 — Controle qualidade: auditoria semanal, NCs registradas",
        "15 — Entrega: checklist item a item, fotos finais, manual de cuidado",
        "16 — Aceite formal: termo assinado, retencao liberada por item aceito",
        "17 — Pos-venda: NPS em 7d, indicacoes, arquiteto engajado",
      ],
      highlight: "GATE G4 — Aceite Formal: checklist 100% + aceite digital. Sem aceite = obra NAO encerrada.",
      image: IMG.team,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 04 — FLUXO MARCENARIA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 04",
      title: "Fluxo End-to-End\nMarcenaria",
      subtitle: "19 etapas com gates extras — portas, paineis, fachada, moveis.\nGermano como dono tecnico do fluxo.",
    },
  },

  {
    type: "split",
    props: {
      title: "Etapas 0-4: Briefing e Projeto",
      label: "Da demanda ao projeto 3D",
      items: [
        "0 — Demanda: briefing tecnico com dimensoes, materiais, interfaces",
        "1 — Escopo validado: compatibilizacao civil/eletrica/hidraulica",
        "2 — Projeto 3D: Germano elabora com renders para aprovacao",
        "3 — Compatibilizacao: forro, piso, iluminacao, ar-condicionado",
        "4 — Aprovacao cliente: projeto congelado com assinatura",
      ],
      highlight: "GATE GM0 — Briefing Validado: escopo tecnico completo. GATE GM1 — Freeze Marcenaria: projeto 3D congelado com compatibilizacao civil.",
      image: parketSpiral,
    },
  },

  {
    type: "split",
    props: {
      title: "Etapas 5-9: Producao e QA",
      label: "Fabrica ate inspecao",
      items: [
        "5 — Lista de materiais: madeiras, ferragens, acabamentos, quantidades",
        "6 — Compras: fornecedores confirmados, prazo compativel",
        "7 — Producao: corte, montagem, acabamento (laca/lamina/verniz)",
        "8 — QA Fabrica: 100% pecas inspecionadas e aprovadas por Germano",
        "9 — Embalagem e expedicao: protecao, identificacao, romaneio",
      ],
      highlight: "GATE GM2 — QA Fabrica: nenhuma peca sai sem inspecao 100%. Registro fotografico obrigatorio.",
      image: IMG.workflow,
    },
  },

  {
    type: "split",
    props: {
      title: "Etapas 10-18: Instalacao e Pos",
      label: "Montagem ate pos-venda",
      items: [
        "10 — 2a vistoria: local nivelado, limpo, com acesso",
        "11 — Entrega no local: conferencia vs romaneio, fotos",
        "12 — Instalacao: montagem com check-in/out diario",
        "13 — Acabamento final: lixamento in loco se necessario",
        "14 — Limpeza e protecao: obra entregue limpa",
        "15 — Checklist entrega: item a item com fotos",
        "16 — Aceite formal: termo + manual laca/lamina",
        "17 — Pos-obra: triagem com fiscal",
        "18 — Pos-venda: NPS + reciclagem",
      ],
      highlight: "GATE GM3 — Frente Liberada: vistoria de local aprovada. GATE GM4 — Aceite Formal: checklist 100% + aceite + manual.",
      image: IMG.craft,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 05 — GATES E CRITERIOS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 05",
      title: "10 Gates\ncom Criterios",
      subtitle: "Cada gate e uma trava que protege a operacao.\nSem criterio 100% atendido, o gate NAO abre.",
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Gates Revestimentos",
      label: "5 travas do fluxo Rev",
      leftTitle: "Gate e Criterio",
      leftItems: [
        "G0 — Escopo Fechado: lead qualificado com escopo e orcamento claros, validado por Carla",
        "G1 — Freeze Aprovado: projeto executivo congelado com assinatura digital do cliente",
        "G2 — Compra Validada: pedidos confirmados com prazo compativel ao cronograma",
        "G3 — Frente Liberada: 2a vistoria aprovada — umidade, nivelamento, acesso OK",
        "G4 — Aceite Formal: checklist 100% + aceite assinado item a item pelo cliente",
      ],
      rightTitle: "O que acontece sem o gate",
      rightItems: [
        "Sem G0: obra comeca sem escopo claro, aditivos constantes, cliente insatisfeito",
        "Sem G1: projeto muda no meio, recompra, atraso, custo dispara",
        "Sem G2: material errado/faltante, frete urgente, obra parada",
        "Sem G3: instalador chega e contrapiso nao esta pronto, retrabalho garantido",
        "Sem G4: obra termina sem aceite, chamados viram buraco negro, NPS despenca",
      ],
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Gates Marcenaria",
      label: "5 travas do fluxo Marc",
      leftTitle: "Gate e Criterio",
      leftItems: [
        "GM0 — Briefing Validado: escopo tecnico com dimensoes, materiais e interfaces definidas",
        "GM1 — Freeze Marcenaria: projeto 3D congelado com compatibilizacao civil aprovada",
        "GM2 — QA Fabrica: 100% pecas inspecionadas e aprovadas antes de sair da fabrica",
        "GM3 — Frente Liberada: local nivelado, limpo e com acesso para montagem",
        "GM4 — Aceite Formal: checklist 100% + aceite assinado + manual laca/lamina entregue",
      ],
      rightTitle: "O que acontece sem o gate",
      rightItems: [
        "Sem GM0: marcenaria produzida com medidas erradas, refacao total",
        "Sem GM1: mudancas apos producao, desperdicio de materia-prima e tempo",
        "Sem GM2: pecas defeituosas chegam na obra, retrabalho + atraso",
        "Sem GM3: montagem em ambiente sujo/umido, danos ao movel",
        "Sem GM4: cliente reclama depois, sem registro de aceite, conflito",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 06 — RACI REAL
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 06",
      title: "RACI com\nNomes Reais",
      subtitle: "Quem faz, quem aprova, quem e consultado e quem e informado.\n7 membros — sem zona cinza.",
    },
  },

  {
    type: "role",
    props: {
      role: "Talita — Coordenadora de Atendimento",
      mission: "Dono do onboarding, entrega e pos-obra. A voz do cliente dentro da Parket.",
      responsibilities: [
        "Onboarding de obra: grupo, pasta, checklist, boas-vindas",
        "Follow-up durante toda a execucao",
        "Entrega e aceite formal com cliente",
        "Registro de pos-obra e triagem de chamados",
        "Pos-venda: NPS, indicacoes, reativacao",
      ],
      kpis: [
        "NPS pos-entrega > 70",
        "100% obras com aceite digital",
        "Chamados no SLA > 90%",
      ],
      image: IMG.team,
    },
  },

  {
    type: "role",
    props: {
      role: "Tainara — Projetista / Atendimento Tecnico",
      mission: "Dona do pre-projeto, paginacao e lista de insumos. Ponte entre o arquiteto e o campo.",
      responsibilities: [
        "Conferencia de arquivos do arquiteto",
        "Paginacao e detalhamentos",
        "Compatibilizacao forro (iluminacao/ar/automacao)",
        "Lista de insumos (receita de bolo)",
        "Suporte tecnico ao atendimento",
      ],
      kpis: [
        "100% projetos com freeze assinado",
        "Aditivos por erro de projeto < 2%",
        "Prazo de pre-projeto < 5 dias uteis",
      ],
      image: IMG.workflow,
    },
  },

  {
    type: "role",
    props: {
      role: "Carla — Gerente Comercial",
      mission: "Dona da prospeccao, escopo e contrato. Garante que so entre no pipeline o que e executavel.",
      responsibilities: [
        "Qualificacao de lead e reuniao consultiva",
        "Proposta e negociacao com cliente",
        "Validacao de escopo executavel + preco",
        "Aprovacao de contrato (A no RACI)",
        "Follow-up pos-venda com arquitetos",
      ],
      kpis: [
        "Conversao lead-contrato > 25%",
        "100% contratos com escopo validado",
        "Ticket medio > R$ 200k",
      ],
      image: IMG.interior,
    },
  },

  {
    type: "role",
    props: {
      role: "Ailton — Logistica / Compras",
      mission: "Dono da conferencia de material e logistica. Nenhum material sai ou chega sem registro.",
      responsibilities: [
        "Conferir receita de bolo vs entrega real",
        "Fotos na saida e na chegada do material",
        "Aceite de material no local da obra",
        "Gestao de estoque e separacao",
        "Coordenacao de fretes e prazos",
      ],
      kpis: [
        "Pedidos com erro < 3%",
        "Custo de urgencia < R$ 3k/mes",
        "100% entregas com foto e aceite",
      ],
      image: parketStoneWall,
    },
  },

  {
    type: "role",
    props: {
      role: "Dani — Administrativo / RH",
      mission: "Dona do contrato de prestador, custos e pagamentos. Trava financeira do fluxo.",
      responsibilities: [
        "Contrato de prestador assinado antes da obra",
        "Classificacao de complexidade por obra",
        "Pagamento quinzenal com retencao 25%",
        "Custos travados e documentados",
        "Interface com contabilidade",
      ],
      kpis: [
        "100% obras com contrato prestador",
        "Retencao 25% aplicada em todas as obras",
        "Custos dentro do orcamento em > 90% das obras",
      ],
      image: IMG.team,
    },
  },

  {
    type: "role",
    props: {
      role: "Germano — Marcenaria / Producao",
      mission: "Dono tecnico do fluxo de marcenaria. Do briefing ao aceite, passando pela fabrica.",
      responsibilities: [
        "Briefing tecnico com dimensoes e interfaces",
        "Projeto 3D com compatibilizacao civil",
        "QA fabrica: inspecao 100% das pecas",
        "Montagem e acabamento in loco",
        "Aceite marcenaria + manual laca/lamina",
      ],
      kpis: [
        "100% pecas com inspecao QA",
        "NCs por obra marc < 2",
        "Prazo de producao cumprido em > 90%",
      ],
      image: IMG.craft,
    },
  },

  {
    type: "role",
    props: {
      role: "Nat — Marketing / Social Media",
      mission: "Dona do conteudo de obra e relacionamento com arquitetos. Transforma entrega em ativo de marca.",
      responsibilities: [
        "Conteudo de obra para social media",
        "Fotos before/after profissionais",
        "Depoimentos e UGC de clientes",
        "Relacionamento com arquitetos e parceiros",
        "Eventos e acoes no showroom",
      ],
      kpis: [
        "4 posts/semana com conteudo de obra",
        "2 depoimentos/mes de clientes",
        "Engajamento medio > 5%",
      ],
      image: IMG.interior,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 07 — 6 PONTOS DE RUPTURA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 07",
      title: "6 Pontos\nde Ruptura",
      subtitle: "Onde o processo quebra — e como cada gate\ntrava o problema antes que ele aconteca.",
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Rupturas 1-3",
      label: "As 3 mais frequentes",
      leftTitle: "Ruptura",
      leftItems: [
        "R1 — Obra comeca sem 2a vistoria: instalador chega e contrapiso nao esta pronto, umidade alta ou acesso bloqueado. Retrabalho garantido.",
        "R2 — Projeto muda depois do freeze: cliente ou arquiteto pede alteracao apos projeto executivo aprovado. Recompra, atraso e custo.",
        "R3 — Material errado ou faltante: receita de bolo nao bate com entrega. Obra para, frete urgente, custo dispara.",
      ],
      rightTitle: "Gate de Mitigacao",
      rightItems: [
        "Gate G3/GM3: 2a vistoria com checklist digital obrigatoria. Sem foto aprovada, obra nao libera no sistema.",
        "Gate G1/GM1: Freeze com assinatura digital. Qualquer mudanca = aditivo formal + novo prazo + aprovacao Carla.",
        "Gate G2/GM2: Ailton confere 100% vs receita. QA fabrica inspeciona 100% das pecas antes de despachar.",
      ],
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Rupturas 4-6",
      label: "Comunicacao, entrega e pos-obra",
      leftTitle: "Ruptura",
      leftItems: [
        "R4 — Decisao sem registro: mudanca de escopo/custo/prazo combinada por WhatsApp sem documentar. Vira conflito depois.",
        "R5 — Entrega sem aceite formal: obra 'termina' mas cliente nao assina aceite. Chamado vira buraco negro, NPS despenca.",
        "R6 — Pos-obra sem triagem objetiva: chamado entra e ninguem sabe se e problema Parket ou pre-existente. Gera custo indevido.",
      ],
      rightTitle: "Gate de Mitigacao",
      rightItems: [
        "Regra: toda decisao de escopo/custo/prazo precisa de registro no sistema em ate 24h. IA audita decisoes nao registradas.",
        "Gate G4/GM4: Checklist 100% + aceite digital item a item. Sem aceite = obra NAO encerrada no sistema.",
        "Fiscal avalia com formulario: Parket, pre-existente, uso indevido. Decisao registrada com foto e categoria.",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 08 — 9 CHECKLISTS MESTRES
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 08",
      title: "9 Checklists\nMestres",
      subtitle: "Formularios digitais do onboarding ao pos-obra.\nCada checklist tem dono, itens e estado da obra.",
    },
  },

  {
    type: "grid",
    props: {
      title: "Os 9 Checklists",
      label: "Formularios do sistema",
      cards: [
        { title: "CK1 — Onboarding", description: "Talita: grupo, pasta, boas-vindas, passo-a-passo, cronograma. Estado 07.", icon: "📋" },
        { title: "CK2 — Pre-Projeto", description: "Tainara: arquivos, paginacao, recortes, compatibilizacao forro. Estado 08.", icon: "📐" },
        { title: "CK3 — 1a Vistoria", description: "Fiscal: metragem, condicoes piso/parede, logistica, umidade. Estado 09.", icon: "📏" },
        { title: "CK4 — 2a Vistoria", description: "Fiscal: umidade laser, andaime, cacamba, armazenamento, acesso. Estado 13.", icon: "🔍" },
        { title: "CK5 — Recebimento", description: "Ailton: conferir vs receita, fotos, aceite, armazenamento. Estado 14.", icon: "📦" },
        { title: "CK6 — Contrato Prestador", description: "Dani: contrato, custos travados, complexidade, seguro. Estado 15.", icon: "📝" },
        { title: "CK7 — Check-in/out", description: "Instalador: foto inicio/fim, apontamento horas, ocorrencias. Estado 16.", icon: "📸" },
        { title: "CK8 — Entrega/Aceite", description: "Talita: termo item a item, fotos finais, manual, satisfacao. Estado 17.", icon: "✅" },
        { title: "CK9 — Pos-Obra", description: "Talita + Fiscal: ocorrencias, causa (Parket/pre/uso), SLA. Estado 18.", icon: "🔧" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 09 — 10 METRICAS SEMANAIS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 09",
      title: "10 Metricas\nSemanais",
      subtitle: "Dashboard automatico que a IA gera toda semana.\n5 categorias de perda mapeadas.",
    },
  },

  {
    type: "metrics",
    props: {
      title: "Metricas de Perda",
      label: "12 indicadores criticos",
      metrics: [
        { label: "M1 — Horas Retrabalho", value: "<40h/mes", description: "Horas refazendo tarefas ja concluidas" },
        { label: "M2 — Custo Retrabalho", value: "<R$ 24k/mes", description: "Horas x custo/hora + material desperdicado" },
        { label: "M3 — Dias Atraso/Obra", value: "<=2 dias", description: "Media de dias alem do prazo contratado" },
        { label: "M4 — Obras no Prazo", value: ">90%", description: "Obras entregues no prazo / total" },
        { label: "M5 — Pedidos com Erro", value: "<3%", description: "Pedidos devolvidos ou trocados" },
        { label: "M6 — Custo Urgencia", value: "<R$ 3k/mes", description: "Fretes expressos + sobrepreco" },
      ],
    },
  },

  {
    type: "metrics",
    props: {
      title: "Metricas de Governanca",
      label: "Comunicacao e qualidade",
      metrics: [
        { label: "M7 — Tarefas sem Dono", value: "0/sem", description: "Tarefas sem responsavel atribuido" },
        { label: "M8 — Decisoes sem Registro", value: "0/sem", description: "Decisoes nao documentadas" },
        { label: "M9 — NCs / Obra", value: "<3/obra", description: "Nao conformidades por obra" },
        { label: "M10 — Score Auditoria", value: ">80 pts", description: "Pontuacao media auditorias (0-100)" },
        { label: "M11 — NPS Pos-Entrega", value: ">70 pts", description: "Net Promoter Score em 7 dias" },
        { label: "M12 — Chamados no SLA", value: ">90%", description: "Chamados resolvidos dentro do SLA" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 10 — HANDOFFS CRITICOS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 10",
      title: "Handoffs\nCriticos",
      subtitle: "Cada passagem de bastao entre areas\ntem pacote minimo e dono definido.",
    },
  },

  {
    type: "content",
    props: {
      title: "10 Handoffs Revestimentos",
      label: "Interfaces entre areas",
      highlight: "Handoff sem pacote minimo = ruptura garantida. Cada interface tem formulario padrao.",
      items: [
        "H1: Comercial → Atendimento: contrato + escopo + cronograma + perfil cliente",
        "H2: Atendimento → Projetos: pasta completa + grupo criado + checklist enviado",
        "H3: Projetos → Fiscal: projeto executivo + lista premissas + versao aprovada",
        "H4: Fiscal → Logistica: metragem real + condicoes + lista de insumos definitiva",
        "H5: Logistica → Campo: material conferido + fotos + aceite + local armazenamento",
        "H6: Campo → Instalador: contrato prestador + classificacao + briefing da obra",
        "H7: Instalador → Atendimento: diario de obra + check-in/out + ocorrencias",
        "H8: Atendimento → Cliente: entrega formal + checklist + fotos + manual",
        "H9: Cliente → Pos-Obra: aceite assinado + pesquisa satisfacao",
        "H10: Pos-Obra → Comercial: NPS + indicacoes + oportunidades reciclagem",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "12 Handoffs Marcenaria",
      label: "Interfaces com QA fabril",
      highlight: "Marcenaria tem 2 handoffs extras: QA fabrica e rastreabilidade de pecas.",
      items: [
        "HM1: Comercial → Germano: briefing tecnico + dimensoes + materiais + acabamentos",
        "HM2: Germano → Arq. Cliente: projeto 3D + renders + compatibilizacao civil",
        "HM3: Arq. Cliente → Germano: aprovacao congelada com assinatura",
        "HM4: Germano → Compras: lista materiais + fornecedores preferenciais",
        "HM5: Compras → Fabrica: materiais recebidos + conferencia + OK",
        "HM6: Fabrica → QA: pecas finalizadas para inspecao (100%)",
        "HM7: QA → Expedicao: pecas aprovadas + embalagem + romaneio",
        "HM8: Expedicao → Obra: entrega conferida vs romaneio + fotos",
        "HM9: Obra → Montagem: ambiente liberado (GM3) + pecas no local",
        "HM10: Montagem → Acabamento: moveis instalados + ajustes finos",
        "HM11: Acabamento → Cliente: checklist + aceite + manual laca/lamina",
        "HM12: Pos-Obra → Comercial: NPS + indicacoes + portfolio atualizado",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 11 — 4 TERMOS PADRAO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 11",
      title: "4 Termos\nPadrao",
      subtitle: "Documentos legais que protegem a operacao\ne estabelecem regras claras com todas as partes.",
    },
  },

  {
    type: "grid",
    props: {
      title: "Termos Contratuais",
      label: "Protecao juridica",
      cards: [
        { title: "T1 — Termo de Responsabilidade", description: "Delimita responsabilidades Parket vs. cliente/construtora. Cobre danos pre-existentes, acesso e armazenamento.", icon: "📄" },
        { title: "T2 — Taxa 3a Vistoria", description: "Se a 2a vistoria reprova e o cliente pede outra, cobra taxa. Evita loops infinitos de 'nao esta pronto'.", icon: "💰" },
        { title: "T3 — Termo de Aceite", description: "Cliente assina item a item na entrega. Base legal para encerrar obra e iniciar prazo de garantia.", icon: "✍️" },
        { title: "T4 — Contrato Prestador", description: "Dani formaliza: escopo, custos, prazos, retencao 25%, classificacao de complexidade e seguro.", icon: "📋" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 12 — IMPLEMENTACAO (6 SPRINTS)
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 12",
      title: "Plano de\n6 Sprints",
      subtitle: "12 semanas para implementar o workflow completo.\nCada sprint tem entregaveis, donos e metricas.",
    },
  },

  {
    type: "process",
    props: {
      title: "Sprints 1-3",
      label: "Fundacao, projeto e campo",
      steps: [
        { number: "S1", title: "Fundacao (Sem 1-2)", description: "CRM com 20 estados, CK1-CK3 digitais, grupo obra padrao, onboarding automatizado. Dono: Talita + Carla" },
        { number: "S2", title: "Projeto & Compras (Sem 3-4)", description: "Gate G1/GM1 implementado, receita de bolo automatizada, CK4-CK5 no app. Dono: Tainara + Ailton" },
        { number: "S3", title: "Liberacao & Campo (Sem 5-6)", description: "Gate G3/GM3 digital, check-in/out com foto, contrato prestador padrao, dashboard v1. Dono: Dani + Fiscal" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "Sprints 4-6",
      label: "Entrega, IA e escala",
      steps: [
        { number: "S4", title: "Entrega & Qualidade (Sem 7-8)", description: "Gate G4/GM4 digital, CK8 item a item, NPS automatizado, ranking equipes. Dono: Talita + Germano" },
        { number: "S5", title: "Pos-Obra & IA (Sem 9-10)", description: "Triagem objetiva, agentes IA (alerta gates + auditoria semanal), SLA pos-obra. Dono: Talita + IA" },
        { number: "S6", title: "Escala & Cultura (Sem 11-12)", description: "War Room semanal, score auditoria > 80, 100% aceite digital, reciclagem comercial ativa. Dono: Todos" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 13 — CADENCIAS E RITUAIS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capitulo 13",
      title: "Cadencias\ne Rituais",
      subtitle: "As reunioes que fazem o workflow funcionar.\nSem ritual, sem disciplina — sem disciplina, sem resultado.",
    },
  },

  {
    type: "grid",
    props: {
      title: "Cadencia Semanal",
      label: "5 rituais obrigatorios",
      cards: [
        { title: "Segunda 08h — War Room", description: "15min. Todos. Pipeline, gates bloqueados, alertas, prioridades da semana.", icon: "🎯" },
        { title: "Terca 09h — Reuniao de Obras", description: "30min. Talita + Fiscal + Instaladores. Status obra a obra, NCs, pendencias.", icon: "🏗️" },
        { title: "Quarta 14h — Comercial", description: "20min. Carla + BDR/SDR. Pipeline, follow-ups, conversao, metas.", icon: "💼" },
        { title: "Quinta 09h — Projetos", description: "20min. Tainara + Germano. Freezes pendentes, compatibilizacao, prazos.", icon: "📐" },
        { title: "Sexta 16h — Retrospectiva", description: "15min. Todos. O que deu certo, o que nao, acoes para proxima semana.", icon: "🔄" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     ENCERRAMENTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "Workflow nao se desenha\nna parede e esquece.\nSe vive nos rituais,\nnos checklists,\nnos gates que nao abrem\nsem criterio atendido.",
      label: "Principio Final",
      attribution: "Sistema Operacional Parket",
    },
  },

  {
    type: "closing",
    props: {
      title: "Playbook do\nWorkflow\nOperacional",
      subtitle: "Parket Pisos — onde cada etapa tem dono,\ncada gate tem trava, cada entrega tem aceite.",
      cta: "Implementar o workflow e elevar o padrao.",
    },
  },
];
