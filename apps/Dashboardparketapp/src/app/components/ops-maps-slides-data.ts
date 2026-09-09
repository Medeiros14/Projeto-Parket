import { type SlideData } from "./slides-data";
import parketDeckLake from "figma:asset/4d5981327c581648268ef6760447eb46d6931f4c.png";
import parketSpiral from "figma:asset/4a6a8ad24bcda1f844920eb717e3e4d47f57d4d3.png";
import parketStoneWall from "figma:asset/e709d3507fb615d8e01cdd56b0745f81577f6d89.png";

const IMG = {
  herringbone: "https://images.unsplash.com/photo-1687398209712-de4252610814?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b29kJTIwZmxvb3IlMjBoZXJyaW5nYm9uZSUyMHBhdHRlcm4lMjBsdXh1cnl8ZW58MXx8fHwxNzcxNzk4Mzg4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  carpentry: "https://images.unsplash.com/photo-1497218770144-3fea6dbc33fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXN0b20lMjB3b29kd29yayUyMGNhcnBlbnRyeSUyMGZ1cm5pdHVyZSUyMHdvcmtzaG9wfGVufDF8fHx8MTc3MTc5ODM4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  workflow: "https://images.unsplash.com/photo-1769738360873-3ba6cac0b308?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Nlc3MlMjB3b3JrZmxvdyUyMGRpYWdyYW18ZW58MXx8fHwxNzcxNzk4Mzg5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  consultation: "https://images.unsplash.com/photo-1734937743443-a50fff0c0b40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwaW50ZXJpb3IlMjBkZXNpZ24lMjBjbGllbnQlMjBjb25zdWx0YXRpb258ZW58MXx8fHwxNzcxNzk4Mzg5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  meeting: "https://images.unsplash.com/photo-1758611972678-bc3b29b4718f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwbWVldGluZyUyMG9wZXJhdGlvbnMlMjBtYW5hZ2VtZW50fGVufDF8fHx8MTc3MTc5MDMwM3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  quality: "https://images.unsplash.com/photo-1581092157699-83c90752400a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxxdWFsaXR5JTIwY29udHJvbCUyMGluc3BlY3Rpb24lMjBjaGVja2xpc3R8ZW58MXx8fHwxNzcxNzkwMzA0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
};

export const opsMapsSlides: SlideData[] = [

  // ═══════════════════════════════════════════════════════════════
  // ABERTURA
  // ═══════════════════════════════════════════════════════════════

  {
    type: "cover",
    props: {
      title: "Mapas\nOperacionais",
      subtitle: "20 macroestados, fluxos end-to-end Rev + Marc,\nhandoffs com nomes, RACI real, gates, rupturas\ne 9 checklists mestres.",
      image: parketDeckLake,
    },
  },

  {
    type: "statement",
    props: {
      statement: "Cada obra vive em\num único estado por vez.\nSem estado único,\no caos vira padrão.",
      label: "Princípio Arquitetural",
      attribution: "Sistema Operacional Parket",
    },
  },

  {
    type: "grid",
    props: {
      title: "10 Artefatos\nOperacionais",
      label: "Mapa Geral",
      cards: [
        { title: "01 · 20 Macroestados", description: "Funil único com gates — o workflow que o sistema/IA enxerga", icon: "🔄" },
        { title: "02 · Fluxo Revestimentos", description: "18 etapas end-to-end — piso, forro, deck, escada, painel, banco", icon: "🪵" },
        { title: "03 · Fluxo Marcenaria", description: "19 etapas com gates extras — portas, painéis, fachada, móveis", icon: "🔨" },
        { title: "04 · Handoffs Rev", description: "10 interfaces críticas com pacote mínimo e dono", icon: "🔁" },
        { title: "05 · Handoffs Marc", description: "12 interfaces com QA fabril e rastreabilidade", icon: "🔃" },
        { title: "06 · RACI Real", description: "Matriz com nomes: Talita, Tainara, Carla, Ailton, Nat, Dani, Germano", icon: "📋" },
        { title: "07 · 6 Pontos de Ruptura", description: "Onde o processo quebra e como travar com gate", icon: "⚠️" },
        { title: "08 · 9 Checklists Mestres", description: "Formulários digitais: onboarding a pós-obra", icon: "✅" },
        { title: "09 · 4 Termos Padrão", description: "Responsabilidade, taxa 3ª vistoria, aceite, contrato prestador", icon: "📝" },
        { title: "10 · 10 Métricas Semanais", description: "Dashboard automático que a IA gera toda semana", icon: "📊" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1 — 20 MACROESTADOS
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Artefato 01",
      title: "20 Macroestados\ndo Funil",
      subtitle: "O workflow que o app e a IA precisam enxergar.\nCada obra em um único estado por vez.",
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
      title: "Estados 01-05",
      label: "Comercial e qualificação",
      steps: [
        { number: "01", title: "Lead capturado", description: "CRM: origem, perfil, cidade, tipo escopo, estágio, próxima ação" },
        { number: "02", title: "Qualificação e escopo", description: "Reunião consultiva: solução/ambiente, driver, decisores, cronograma" },
        { number: "03", title: "Levantamento e proposta", description: "Time levantamento analisa projeto, lista premissas, versão arquivo" },
        { number: "04", title: "Proposta apresentada", description: "Showroom ou call. Follow-up com cadência no CRM" },
        { number: "05", title: "Contrato assinado", description: "Carla valida: escopo executável, preço ok, produto em linha" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "Estados 06-10",
      label: "Ativação e projeto",
      steps: [
        { number: "06", title: "1ª parcela paga", description: "Gate real: obra ativada internamente no pipeline" },
        { number: "07", title: "Onboarding de obra", description: "Talita: grupo, pasta, checklist, boas-vindas, passo-a-passo" },
        { number: "08", title: "Pré-projeto pronto", description: "Tainara: arquivos conferidos, paginação, recortes mapeados" },
        { number: "09", title: "1ª vistoria realizada", description: "Fiscal: metragem, condições, logística. Aditivo cedo se precisar" },
        { number: "10", title: "Projeto executivo", description: "Em aprovação. Forro exige compatibilização (iluminação/ar/automação)" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "Estados 11-15",
      label: "Compras, liberação e material",
      steps: [
        { number: "11", title: "Lista insumos aprovada", description: "Receita de bolo calculada. Estoque separa, falta compra" },
        { number: "12", title: "Pré-liberação", description: "Engenharia envia fotos + checklist. Atendimento filtra" },
        { number: "13", title: "2ª vistoria liberação", description: "Fiscal: umidade, laser, andaime, caçamba, armazenamento" },
        { number: "14", title: "Entrega material", description: "Ailton confere vs receita. Fotos saindo e chegando. Aceite" },
        { number: "15", title: "Contrato prestador", description: "Dani: assinado, custos travados, classificação complexidade" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "Estados 16-20",
      label: "Execução, entrega e pós",
      steps: [
        { number: "16", title: "Instalação controlada", description: "Check-in/out, fotos diárias, pagamento quinzenal, retenção 25%" },
        { number: "17", title: "Entrega e aceite", description: "Termo assinado. Retenção liberada por item aceito" },
        { number: "18", title: "Pós-obra", description: "Talita registra. Fiscal avalia: Parket ou não? Triagem objetiva" },
        { number: "19", title: "Encerramento e NPS", description: "Nota indicação, nota equipe, resultado vs expectativa" },
        { number: "20", title: "Reciclagem comercial", description: "Novos leads no círculo: amigos, projetos, arquiteto, engenharia" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 2 — FLUXO REVESTIMENTOS
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Artefato 02",
      title: "Fluxo End-to-End\nRevestimentos",
      subtitle: "18 etapas — piso, forro, deck, painel, escada, banco.\nDo lead ao pós-venda estratégico.",
    },
  },

  {
    type: "split",
    props: {
      title: "Etapa 0 — Prospecção",
      label: "Entrada de demanda",
      items: [
        "INBOUND — Instagram, tráfego pago, orgânico",
        "OUTBOUND — BDR cold call para showroom",
        "RELACIONAMENTO — Arquiteto, incorporador, cliente antigo, indicação",
        "Lead registrado no CRM: origem, perfil, cidade, escopo, estágio, próxima ação",
        "\"Motivo do lead\" em 1 frase: o que quer e para quando",
      ],
      highlight: "GATE CULTURAL: sem CRM preenchido, o lead \"não existe\".",
      image: IMG.consultation,
    },
  },

  {
    type: "content",
    props: {
      title: "Etapas 1-2 — Escopo\ne Levantamento",
      label: "Qualificação → Validação técnica",
      highlight: "Saída da Etapa 2: proposta com arquivo versionado + lista de premissas (incluso/não incluso/condicional).",
      items: [
        "ET1 · Reunião consultiva: qual solução por ambiente, interno/externo, umidade, insolação, ar, automação",
        "ET1 · Decisores mapeados: cliente, arquiteto, engenheiro, gerenciador",
        "ET1 · Driver: estética, prazo, durabilidade, status, manutenção",
        "ET1 · Escopo preliminar \"vendável\" + próximo passo combinado",
        "ET2 · Comercial dispara, time levantamento analisa projeto",
        "ET2 · Riscos de aditivo identificados: recortes, alçapões, grelhas, rodapé invertido",
        "ET2 · Se necessário: pré-projeto para não orçar \"no escuro\"",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Etapas 3-5 — Proposta,\nFollow-up e Contrato",
      label: "Da apresentação à ativação",
      highlight: "Gate de ativação: obra só ativa internamente após pagamento da 1ª parcela. Antes disso, não existe.",
      items: [
        "ET3 · Apresentar no showroom (padrão) ou call agendada (exceção)",
        "ET3 · Não é \"mandar PDF\" — é escopo + técnica + diferença + risco + cronograma",
        "ET4 · Follow-up com cadência (D+1, D+3, D+7, D+14, D+30)",
        "ET4 · Motivo de não-fechamento classificado no CRM",
        "ET5 · Carla valida: escopo executável, preço ok, produto em linha",
        "ET5 · Assinatura digital → 1ª parcela paga → obra ativa no pipeline",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Etapa 6 — Onboarding\nde Obra",
      label: "Responsável: Talita",
      highlight: "GATE: sem grupo + checklist + pasta, não existe obra organizada.",
      items: [
        "Criar dashboard da obra (registro mestre no sistema)",
        "Grupo: cliente/engenharia/arq + vendedor + projetos + expedição + fiscal + Nat + marcenaria (se aplicável)",
        "Mensagem de boas-vindas com \"passo a passo Parket\"",
        "Checklist de pré-requisitos no grupo",
        "Regra 2 vistorias padrão (3ª = taxa ou vídeo/foto + termo)",
        "Como funciona entrega e instalação",
        "O que gera custo extra",
      ],
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Etapas 7-8 — Pré-Projeto\ne 1ª Vistoria",
      label: "Projetos (Tainara) + Fiscal",
      leftTitle: "ET7 · Pré-Projeto",
      leftItems: [
        "Arquivos atualizados coletados",
        "Sentido paginação/forro",
        "Alçapões, cortineiros, grelhas",
        "Automação e iluminação",
        "Encontros piso frio vs madeira",
        "Recortes previstos (aditivo cedo)",
        "REGRA: fiscal só vai com pré-projeto",
      ],
      rightTitle: "ET8 · 1ª Vistoria",
      rightItems: [
        "Metragem real vs projeto (aditivo imediato)",
        "Contrapiso: traço, nível, seco",
        "Obra fechada, sem infiltração",
        "Gesso, batentes, piso frio, elétrica prontos",
        "Ar-condicionado, pingadeiras, alçapões",
        "Logística: armazena onde, segurança",
        "Relatório + pendências no grupo e pasta",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#4ECDC4",
    },
  },

  {
    type: "content",
    props: {
      title: "Etapas 9-10 — Compras\ne Projeto Executivo",
      label: "Após 1ª vistoria conferida",
      highlight: "Regra crítica: nunca mandar \"a mais\" por vício. Manda o necessário medido com lastro documental.",
      items: [
        "ET9 · Conferência vendido vs medido → lista de insumos (\"receita de bolo\")",
        "ET9 · Estoque: separa. Falta: compra nacional. Importação: Pâmela",
        "ET9 · Expedição kit por obra: piso + cola + barrote + parafuso. Ailton confere e fotografa",
        "ET10 · Piso/deck: pré-projeto geralmente resolve",
        "ET10 · Forro: compatibilização com iluminação/ar/automação — recortes, grelhas, alçapões = aditivo ANTES",
        "ET10 · Aprovação formal registrada (não \"ok por WhatsApp\")",
      ],
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Etapa 11 — Pré-liberação\ne 2ª Vistoria",
      label: "Liberação final para entrar na obra",
      leftTitle: "Pré-liberação (filtro)",
      leftItems: [
        "Engenharia envia fotos + confirma checklist",
        "Atendimento filtra: evita deslocamento inútil",
        "Pendências da 1ª vistoria resolvidas?",
        "Se não pronto: NÃO agenda 2ª vistoria",
      ],
      rightTitle: "2ª Vistoria (fiscal)",
      rightItems: [
        "Umidade com higrômetro",
        "Laser de nível",
        "Andaime e caçamba (obra fornece)",
        "Armazenamento seco e seguro",
        "Se não liberado: lista do que falta",
        "3ª ida: taxa ou vídeo + termo assinado",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#4ECDC4",
    },
  },

  {
    type: "process",
    props: {
      title: "Etapas 12-14 — Entrega,\nContrato e Execução",
      label: "Material → Prestador → Campo",
      steps: [
        { number: "12", title: "Entrega material", description: "Agendamento 1 sem antes + 1 dia antes. Ailton confere item a item. Fotos saindo/chegando. Aceite com evidência" },
        { number: "13", title: "Contrato prestador", description: "Dani: sem contrato = sem start. Classificação: complexa/média/simples. Custos longe travados antes" },
        { number: "14", title: "Execução controlada", description: "Conferir material ao chegar. Check-in/out. Fotos diárias. Só fiscal fala prazo. Retenção 25% por item" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Etapas 15-17 — Entrega,\nPós-obra e Pós-venda",
      label: "Encerramento e reciclagem",
      highlight: "Pós-obra não é custo — é oportunidade. NPS no pico de satisfação gera indicação.",
      items: [
        "ET15 · Obra grande: fiscal entrega presencial. Pequena: termo digital",
        "ET15 · Checklist: conformidade, acabamento, limpeza, pendências. Termo assinado",
        "ET15 · Retenção liberada por itens aceitos",
        "ET16 · Talita recebe e registra. Fiscal avalia: Parket ou não?",
        "ET16 · Parket: agenda e arca. Não Parket: explica + orçamento",
        "ET17 · Talita (CS): NPS 0-10, nota equipe, resultado vs expectativa",
        "ET17 · Quem mais no círculo? Vendedor retoma com arquiteto",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 3 — FLUXO MARCENARIA
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Artefato 03",
      title: "Fluxo End-to-End\nMarcenaria",
      subtitle: "19 etapas — mais complexa, mais gates.\nErro custa caro e aparece tarde.",
    },
  },

  {
    type: "statement",
    props: {
      statement: "Marcenaria é indústria\nde precisão + engenharia\n+ compatibilização.\nOs gates precisam ser\nmais duros.",
      label: "Princípio Marcenaria",
      attribution: "Parket Operations",
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Etapas 0-5 Marc\nvs Revestimento",
      label: "Igual até contrato, com 2 diferenças",
      leftTitle: "Diferença 1: Escopo \"Ornare\"",
      leftItems: [
        "Protótipo, exemplos, demonstração de valor",
        "Não pode ser proposta fria",
        "Referências visuais obrigatórias",
        "Experiência consultiva presencial",
      ],
      rightTitle: "Diferença 2: Aval Técnico",
      rightItems: [
        "Projetos + fábrica validam exequibilidade ANTES da proposta",
        "Marco Antônio ou direção de produção",
        "Escopos críticos: fachada, portas especiais, ferragens, pé-direito",
        "\"Aval técnico de fábrica\" registrado",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#E8C97A",
    },
  },

  {
    type: "content",
    props: {
      title: "Etapas 6-7 Marc — Onboarding\ne Mapa de Itens",
      label: "Fundação do controle",
      highlight: "Prazo de produção só começa após: projeto aprovado + medição fina + amostras assinadas. Sem mapa de itens = memória e WhatsApp.",
      items: [
        "ET6 · Mensagem: prazo condicional (\"após aprovações X, Y, Z\")",
        "ET6 · Cliente entende que bola está com a obra — elimina discussão",
        "ET7 · Pasta do cliente criada e organizada",
        "ET7 · Mapa de itens vendido: item a item com descrição, dimensões, ferragens, acabamentos",
        "ET7 · Versionamento formal (Rev 01, Rev 02)",
        "ET7 · Qualquer mudança = atualizar mapa + registrar aditivo",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Etapa 8 Marc — Reunião\nTécnica Gravada",
      label: "Com arquitetura — antes de ir para obra",
      highlight: "Decisões que explodem depois precisam ser travadas e gravadas aqui. Sem gravação = sem evidência.",
      items: [
        "Cava e tipo de maçaneta definidos",
        "Fechadura e furação especificados",
        "Ferragens e sistemas de abertura confirmados",
        "Limites técnicos do escopo vendido",
        "Compatibilização com terceiros: fachada, estrutura, quadros",
        "Saída: decisões formalizadas + riscos + pontos de atenção para vistoria",
      ],
    },
  },

  {
    type: "split",
    props: {
      title: "Etapa 9 Marc — 1ª Vistoria\ne Medição",
      label: "Tainara na obra",
      items: [
        "Checa prumo, requadro, paredes, portas",
        "Padroniza vãos (evitar 89, 88, 87 aleatórios)",
        "Valida viabilidade real do vendido",
        "Compatibilização com engenharia e terceiros",
        "Relatório + pendências para produzir com segurança",
        "Ajustes e possíveis aditivos cedo",
      ],
      highlight: "Se não padronizar vãos aqui, produz errado e retrabalho custa caro.",
      image: IMG.carpentry,
    },
  },

  {
    type: "content",
    props: {
      title: "Etapas 10-11 Marc —\nCompras e Executivo",
      label: "Antecipação + \"Ficha Parket\"",
      highlight: "Grosso (lâmina, compensado) pode antecipar. Compra final só após vistoria e validação. Projeto executivo aprovado ≠ \"ok por WhatsApp\".",
      items: [
        "ET10 · Compras travadas por item e por lote",
        "ET10 · Matéria-prima crítica antecipada para reduzir risco de falta",
        "ET11 · \"Ficha Parket de Marcenaria\" antes de mandar executivo ao arquiteto:",
        "— Padrões de detalhamento exigidos por Parket",
        "— Padrões de ferragens, folgas e tolerâncias",
        "— Padrões de paginação e acabamento",
        "— Padrão de nomenclatura de itens",
        "ET11 · GATE: aprovação formal registrada",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Etapa 12 Marc —\nMedição Fina",
      label: "\"Prazo começa aqui\"",
      highlight: "Levar responsável de produção/instalação junto na medição fina (SP) — antecipa risco de montagem.",
      items: [
        "Atualizar dimensões reais item a item",
        "Reenviar para aprovação final",
        "Só então liberar para produção",
        "Prioridade por ambientes (faseamento)",
        "Evidências: fotos e notas por item",
        "Se medida mudou: atualizar mapa + aditivo formal",
      ],
    },
  },

  {
    type: "statement",
    props: {
      statement: "Sem assinatura atrás\nda amostra, não produz.\nIsso mata 80%\ndas brigas\nde expectativa.",
      label: "Etapa 13 — Aprovação de Amostras",
      attribution: "Regra de ouro Marc",
    },
  },

  {
    type: "content",
    props: {
      title: "Etapa 14 Marc — Produção\ncom Rastreabilidade",
      label: "Sistema operacional industrial",
      highlight: "Germano como \"Project Marshall\": passa nas bancadas, confere com trena, tira fotos, registra por item. Sem registro = produção invisível = prejuízo.",
      items: [
        "Cada item tem ID único (etiqueta)",
        "Timestamps: início bancada → fim → pintura início/fim → QC final → embalagem → expedição",
        "Germano audita no fim do dia por item",
        "Desvio travado cedo — antes de virar retrabalho",
        "CLT sem medição = custo, tempo e margem invisíveis",
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "Etapas 15-19 Marc\nFinalização",
      label: "QC → Logística → Instalação → Entrega → Pós",
      steps: [
        { number: "15", title: "QC Final", description: "Medidas vs etiqueta vs projeto. Acabamento (risco, empeno, tonalidade). Sem assinatura QA = não embarca" },
        { number: "16", title: "Logística", description: "Checar elevador/içamento. Obra fornece andaime/caçamba. Fotos saindo e chegando. Aceite" },
        { number: "17", title: "Instalação", description: "Não desembala sem conferir etiqueta vs executivo. Violou lacre = assumiu risco. Fiscal solta e acompanha" },
        { number: "18", title: "Entrega final", description: "Ajustes finais. Checklist item a item. Termo aceite. Retenção liberada por item" },
        { number: "19", title: "Pós-obra/venda", description: "Triagem cirúrgica (portas/requadro geram discussão). Relatório técnico. NPS e reciclagem" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Diferenciais Marc\nvs Revestimento",
      label: "7 controles exclusivos",
      highlight: "Marcenaria exige controles que não existem em revestimentos:",
      items: [
        "① Aval técnico de fábrica antes da proposta (escopos críticos)",
        "② Reunião técnica gravada com arquitetura antes de ir à obra",
        "③ Mapa de itens com versionamento formal (não memória + WhatsApp)",
        "④ Medição fina com responsável de produção presente",
        "⑤ Aprovação de amostras assinadas antes de produzir",
        "⑥ Rastreabilidade por item (ID + timestamps + QC por peça)",
        "⑦ \"Ficha Parket de Marcenaria\" padronizando detalhamento com arquiteto",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 4 — HANDOFFS
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Artefatos 04-05",
      title: "Handoffs\nentre Áreas",
      subtitle: "Cada passagem de bastão com dono,\npacote mínimo, SLA e prevenção de erro.",
    },
  },

  {
    type: "process",
    props: {
      title: "10 Handoffs\nRevestimentos",
      label: "Interfaces críticas com nomes",
      steps: [
        { number: "H1", title: "Comercial → Projetos (Tainara)", description: "Proposta + brief + arquivos do arquiteto · SLA 24h após contrato" },
        { number: "H2", title: "Projetos → Fiscal", description: "Pré-projeto completo em mãos · Sem pré-projeto = sem vistoria" },
        { number: "H3", title: "Fiscal → Projetos/Compras", description: "Relatório 1ª vistoria + metragem + aditivo cedo · SLA 48h" },
        { number: "H4", title: "Projetos → Compras (Ronaldo/Pâmela)", description: "Lista insumos vs medido + versão arquivo · SLA 48h pós-relatório" },
        { number: "H5", title: "Compras → Expedição (Ailton)", description: "Kit completo por obra: piso + insumos. Conferido e fotografado" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "10 Handoffs Rev\n(continuação)",
      label: "Interfaces 6-10",
      steps: [
        { number: "H6", title: "Atendimento (Talita) → Fiscal", description: "Pré-liberação filtrada: fotos + checklist da engenharia · Evita deslocamento inútil" },
        { number: "H7", title: "Fiscal → Nat (cronograma)", description: "\"Obra liberada\" oficialmente · Cronograma final só agora" },
        { number: "H8", title: "Dani → Prestador", description: "Contrato assinado + custos travados + classificação complexidade" },
        { number: "H9", title: "Fiscal → Talita (CS)", description: "Termo aceite + fotos + pendências · Liberação retenção por item" },
        { number: "H10", title: "Talita → Comercial", description: "NPS + lead novo ou follow-up programado · Reciclagem comercial" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "12 Handoffs\nMarcenaria",
      label: "Interfaces com QA fabril",
      steps: [
        { number: "HM1", title: "Comercial → Projetos + Fábrica", description: "Brief \"Ornare\" + aval técnico de fábrica para escopos críticos" },
        { number: "HM2", title: "Talita → Grupo", description: "Onboarding + regra do prazo condicional" },
        { number: "HM3", title: "Tainara → Pasta", description: "Mapa de itens versionado (descrição, dimensões, ferragens)" },
        { number: "HM4", title: "Tainara → Arquitetura", description: "Reunião técnica gravada: decisões formalizadas + riscos" },
        { number: "HM5", title: "Tainara (obra) → Projetos", description: "Medição inicial + padronização de vãos + pendências" },
        { number: "HM6", title: "Compras → Produção", description: "Matéria-prima crítica antecipada + compra final pós-validação" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "12 Handoffs Marc\n(continuação)",
      label: "Interfaces 7-12",
      steps: [
        { number: "HM7", title: "Tainara → Ficha Parket", description: "Ficha padronização para arquiteto: detalhamento, folgas, nomenclatura" },
        { number: "HM8", title: "Medição fina → Produção", description: "Dimensões atualizadas item a item + aprovação final + faseamento" },
        { number: "HM9", title: "Cliente → Amostra assinada", description: "Sem assinatura = não produz. Aceite digital equivalente" },
        { number: "HM10", title: "Produção → QA (Germano)", description: "Etiqueta individual + timestamps + conferência trena + fotos" },
        { number: "HM11", title: "QA → Logística", description: "Assinatura responsável qualidade. Sem assinatura = não embarca" },
        { number: "HM12", title: "Instalação → Entrega", description: "Não desembala sem conferir etiqueta vs projeto. Termo aceite item a item" },
      ],
    },
  },

  {
    type: "statement",
    props: {
      statement: "O handoff é onde\ninformação se perde,\nprazo estoura e\nqualidade morre.\nTrate cada handoff\ncomo um contrato.",
      label: "Princípio de Handoff",
      attribution: "Parket Operations",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 5 — RACI REAL
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Artefato 06",
      title: "RACI Real\ncom Nomes",
      subtitle: "R = Responsável · A = Aprovador · C = Consultado · I = Informado\nCom donos de processo por macrobloco.",
    },
  },

  {
    type: "grid",
    props: {
      title: "Donos de Processo\npor Macrobloco",
      label: "Quem é dono de quê",
      cards: [
        { title: "Comercial (Vendedor/BDR)", description: "Até contrato + 1ª parcela paga. Depois: relacionamento e retomadas comerciais.", icon: "💼" },
        { title: "Jurídico/Financeiro (Carla)", description: "Validação contratual, gatilhos de cobrança, liberação de pagamentos e retenções.", icon: "💰" },
        { title: "CS/Obras (Talita)", description: "Onboarding, grupo, comunicação cliente, agendamentos, pós-obra inicial, NPS.", icon: "📋" },
        { title: "Projetos (Tainara)", description: "Pré-projeto, executivo, compatibilização, mapa de itens, medição marc.", icon: "📐" },
        { title: "Fiscal (por obra)", description: "Vistorias, liberação de frente, qualidade em campo, entrega presencial.", icon: "🔍" },
      ],
    },
  },

  {
    type: "grid",
    props: {
      title: "Donos de Processo\n(continuação)",
      label: "Expedição, compras, produção, coordenação",
      cards: [
        { title: "Expedição (Ailton + time)", description: "Kitagem por obra, conferência item a item vs receita, evidência de entrega.", icon: "📦" },
        { title: "Compras (Ronaldo / Pâmela import)", description: "Disponibilidade e abastecimento. Nacional e importação.", icon: "🚚" },
        { title: "PCP/Produção/QA (Germano)", description: "Produção por item + auditoria diária + QC final + embalagem + rastreabilidade.", icon: "🔨" },
        { title: "Coord. Prestadores (Dani)", description: "Contrato prestador, agenda equipes, custos de obra longe, coordenação do start.", icon: "🤝" },
        { title: "Governança Operacional (Nat)", description: "Cronograma, pagamentos quinzenais, controle de evidência, governança semanal.", icon: "👑" },
      ],
    },
  },

  {
    type: "grid",
    props: {
      title: "RACI\nRevestimentos",
      label: "Quem faz o quê — etapas 0-9",
      cards: [
        { title: "ET0 Prospecção", description: "R: Comercial · I: CRM", icon: "→" },
        { title: "ET1 Escopo", description: "R: Comercial · C: Projetos", icon: "→" },
        { title: "ET2 Levantamento", description: "R: Levantamento · C: Projetos · I: Comercial", icon: "→" },
        { title: "ET3-4 Proposta/FU", description: "R: Comercial · C: Projetos/Compras", icon: "→" },
        { title: "ET5 Contrato", description: "R: Comercial · A: Carla · I: Talita", icon: "→" },
        { title: "ET6 Onboarding", description: "R: Talita · C: Comercial/Fiscal · I: Nat", icon: "→" },
        { title: "ET7 Pré-Projeto", description: "R: Tainara · C: Fiscal · I: Talita", icon: "→" },
        { title: "ET8 1ª Vistoria", description: "R: Fiscal · C: Tainara · I: Talita/Compras", icon: "→" },
        { title: "ET9 Compras", description: "R: Ronaldo/Pâmela · C: Tainara · A: Carla", icon: "→" },
      ],
    },
  },

  {
    type: "grid",
    props: {
      title: "RACI\nRevestimentos",
      label: "Etapas 10-17",
      cards: [
        { title: "ET10 Exec. Aprovado", description: "R: Tainara · A: Cliente/Arq · I: Compras", icon: "→" },
        { title: "ET11 Liberação", description: "R: Fiscal · C: Talita (filtro) · I: Nat", icon: "→" },
        { title: "ET12 Entrega Mat.", description: "R: Ailton · C: Fiscal · I: Talita", icon: "→" },
        { title: "ET13 Contrato Prest.", description: "R: Dani · A: Carla · I: Nat", icon: "→" },
        { title: "ET14 Execução", description: "R: Fiscal/Equipe · C: Nat · I: Talita", icon: "→" },
        { title: "ET15 Entrega", description: "R: Fiscal · A: Cliente · I: Talita/Carla", icon: "→" },
        { title: "ET16 Pós-Obra", description: "R: Talita · C: Fiscal · A: Carla", icon: "→" },
        { title: "ET17 Pós-Venda", description: "R: Talita (CS) · C: Comercial · I: Fundador", icon: "→" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 6 — PONTOS DE RUPTURA
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Artefato 07",
      title: "6 Pontos\nde Ruptura",
      subtitle: "Onde o processo quebra e como\ntravar com gate objetivo.",
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Rupturas 1-2",
      label: "Fiscal sem pré-projeto + Aditivo tarde",
      leftTitle: "R1: Fiscal sem Pré-Projeto",
      leftItems: [
        "Problema: fiscal vai sem saber o que conferir",
        "Consequência: vistoria inútil, sem aditivo cedo",
        "GATE: \"sem pré-projeto no card = não agenda vistoria\"",
        "Dono: Tainara prepara e anexa",
      ],
      rightTitle: "R2: Aditivo Tarde",
      rightItems: [
        "Problema: aditivo aparece durante/após instalação",
        "Consequência: margem evapora, cliente bravo",
        "REGRA: aditivo só na 1ª vistoria ou fase de executivo",
        "Aditivo depois de material na obra = proibido",
      ],
      leftColor: "#E85D5D",
      rightColor: "#E8C97A",
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Rupturas 3-4",
      label: "Cronograma ilusório + Entrega sem prova",
      leftTitle: "R3: Cronograma Ilusório",
      leftItems: [
        "Problema: cronograma antes de condição existir",
        "Consequência: expectativa → frustração",
        "REGRA: cronograma final só no dia do start ou entrega de material",
        "Antes: datas estimadas, nunca compromissos",
      ],
      rightTitle: "R4: Entrega sem Prova",
      rightItems: [
        "Problema: material some, estraga, gera discussão",
        "Consequência: palavra contra palavra",
        "GATE: checklist evidência obrigatório",
        "Fotos + assinatura digital + armazenamento",
      ],
      leftColor: "#E85D5D",
      rightColor: "#E8C97A",
    },
  },

  {
    type: "twocolumn",
    props: {
      title: "Rupturas 5-6",
      label: "Disciplina diária + Rastreabilidade marc",
      leftTitle: "R5: Equipe sem Disciplina",
      leftItems: [
        "Problema: dia sem registro = dia invisível",
        "Consequência: prejuízo não rastreável",
        "GATE: bônus/multa automático",
        "Retenção por item + check-in/out + prova diária",
        "Quem não envia, não pontua, não recebe bônus",
      ],
      rightTitle: "R6: Marc sem Rastreabilidade",
      rightItems: [
        "Problema: nunca sabe custo, tempo, margem por item",
        "Consequência: marcenaria é caixa-preta",
        "GATE: ID por item + Germano auditor diário",
        "QC final assinando antes de embarcar",
        "Sem etiqueta = peça não existe",
      ],
      leftColor: "#E85D5D",
      rightColor: "#E8C97A",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 7 — CHECKLISTS E TERMOS
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Artefatos 08-09",
      title: "Checklists Mestres\ne Termos Padrão",
      subtitle: "9 formulários digitais + 4 termos\npara assinatura. Prontos para implementação.",
    },
  },

  {
    type: "grid",
    props: {
      title: "9 Checklists Mestres",
      label: "Cada etapa vira formulário no app",
      cards: [
        { title: "1. Onboarding", description: "Grupo, pasta, dashboard, mensagem, pré-requisitos, regras vistoria", icon: "✅" },
        { title: "2. Pré-Projeto", description: "Arquivos, compatibilização, paginação, alçapões, recortes, encontros", icon: "✅" },
        { title: "3. 1ª Vistoria", description: "Metragem, contrapiso, umidade, gesso, batentes, elétrica, logística", icon: "✅" },
        { title: "4. Liberação", description: "Pré-requisitos ok, umidade, nível, andaime, caçamba, armazenamento", icon: "✅" },
        { title: "5. Entrega Material", description: "Item vs receita, fotos saindo/chegando, assinatura, armazenamento", icon: "✅" },
        { title: "6. Start Obra", description: "Contrato prestador, complexidade, custos travados, equipe definida", icon: "✅" },
        { title: "7. Diário de Obra", description: "Check-in/out, fotos produção, ocorrências, feedback, m² produzido", icon: "✅" },
        { title: "8. Entrega Final", description: "Conformidade, acabamento, limpeza, pendências, termo aceite", icon: "✅" },
        { title: "9. Pós-Obra", description: "Triagem responsabilidade, relatório técnico, orçamento, encerramento", icon: "✅" },
      ],
    },
  },

  {
    type: "grid",
    props: {
      title: "4 Termos Padrão",
      label: "Documentos para assinatura digital",
      cards: [
        { title: "Termo Responsabilidade", description: "Entrar sem pré-requisito completo. Cliente assume risco por escrito.", icon: "📝" },
        { title: "Taxa 3ª Vistoria", description: "Cobrada quando engenharia não cumpriu checklist em 2 visitas.", icon: "📝" },
        { title: "Aceite de Entrega", description: "Digital: checklist item a item, fotos evidência, assinatura.", icon: "📝" },
        { title: "Contrato Prestador", description: "Automático por escopo/item. Retenção 25%. Bônus/multa.", icon: "📝" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 8 — MÉTRICAS SEMANAIS
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Artefato 10",
      title: "10 Métricas\nSemanais",
      subtitle: "O que a IA/sistema precisa gerar\nautomaticamente toda semana.",
    },
  },

  {
    type: "metrics",
    props: {
      title: "Métricas 1-5",
      label: "Dashboard semanal obrigatório",
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
      label: "Dashboard semanal obrigatório",
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
  // JORNADA DO CLIENTE (VISÃO DO CLIENTE)
  // ═══════════════════════════════════════════════════════════════

  {
    type: "section",
    props: {
      block: "Visão do Cliente",
      title: "Jornada\ndo Cliente",
      subtitle: "O que o cliente vê, sente e espera.\nTudo nos bastidores existe para isso.",
    },
  },

  {
    type: "process",
    props: {
      title: "7 Momentos\nRevestimentos",
      label: "Perspectiva do cliente",
      steps: [
        { number: "01", title: "Descoberta", description: "Espera: fornecedor premium confiável · Entrega: contato profissional + portfólio" },
        { number: "02", title: "Consultoria", description: "Espera: ser ouvido sem pressão · Entrega: reunião consultiva + escopo claro" },
        { number: "03", title: "Proposta", description: "Espera: proposta clara sem surpresas · Entrega: apresentação presencial no showroom" },
        { number: "04", title: "Onboarding", description: "Espera: saber o que acontece, quando, quem · Entrega: grupo + passo-a-passo + regras" },
        { number: "05", title: "Obra", description: "Espera: profissionalismo e transparência · Entrega: feedbacks no grupo + fotos + controle" },
      ],
    },
  },

  {
    type: "process",
    props: {
      title: "7 Momentos Rev\n(continuação)",
      label: "Perspectiva do cliente",
      steps: [
        { number: "06", title: "Entrega", description: "Espera: resultado impecável · Entrega: walkthrough + termo aceite + manual cuidado" },
        { number: "07", title: "Pós-venda", description: "Espera: resposta rápida se algo der errado · Entrega: triagem objetiva + NPS + indicação" },
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Riscos em Cada\nMomento — Revestimentos",
      label: "Onde perdemos o cliente",
      highlight: "O cliente não vê processos, gates ou checklists. Ele vê atenção, prazo e qualidade.",
      items: [
        "Descoberta: tempo de resposta lento → cliente vai pro concorrente",
        "Consultoria: reunião genérica sem escuta → cliente se sente um número",
        "Proposta: proposta atrasada ou genérica → perda de credibilidade",
        "Onboarding: falta de clareza → ansiedade e desconfiança desde dia 1",
        "Obra: silêncio durante obra → cliente liga nervoso para saber status",
        "Entrega: defeito visível → destrói TODA a experiência mesmo se 99% perfeito",
        "Pós-venda: abandono pós-entrega → cliente nunca mais indica",
      ],
    },
  },

  {
    type: "content",
    props: {
      title: "Riscos em Cada\nMomento — Marcenaria",
      label: "Percepção de perfeição artesanal",
      highlight: "Marcenaria tem riscos de percepção mais altos — portas, requadro e ferragens geram discussão.",
      items: [
        "Briefing: não entender estilo → projeto errado desde o início",
        "Proposta: subestimar complexidade → surpresa de custo = quebra de confiança",
        "Projeto: aprovar sem amostra física → cor/textura diferente do esperado",
        "Produção: zero comunicação → ansiedade cresce a cada dia de silêncio",
        "Instalação: apressada ou sem conferência → desalinhamento visível",
        "Entrega: sem orientação manutenção → cliente danifica em 1 mês e culpa Parket",
        "Pós-obra: portas/requadro geram discussão — triagem cirúrgica é obrigatória",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ENCERRAMENTO
  // ═══════════════════════════════════════════════════════════════

  {
    type: "content",
    props: {
      title: "Como Usar\nEstes Artefatos",
      label: "Implementação",
      highlight: "10 artefatos, 1 objetivo: que nenhuma informação se perca entre áreas, pessoas ou etapas.",
      items: [
        "Macroestados (01): Cada obra tem 1 estado. Sistema/IA rastreia. Sem estado = obra fantasma",
        "Fluxos (02-03): Imprima e cole. Todo novo funcionário lê na primeira semana",
        "Handoffs (04-05): Checklist REAL em cada passagem. Se faltar 1 item, devolva",
        "RACI (06): Conflito de \"quem faz\"? Aponte para a matriz. Não discuta — consulte",
        "Rupturas (07): Os 6 pontos onde o processo quebra. Gate travado = ruptura prevenida",
        "Checklists (08-09): 9 formulários + 4 termos. Use desde o primeiro dia",
        "Métricas (10): 10 números toda semana. Se não mede, não gerencia",
        "Regra: artefatos são vivos — atualize a cada lição aprendida",
      ],
    },
  },

  {
    type: "closing",
    props: {
      title: "Mapas\nOperacionais",
      subtitle: "20 macroestados, 18 etapas Rev, 19 etapas Marc,\n10 handoffs por fluxo, RACI com nomes,\n6 rupturas travadas, 9 checklists, 10 métricas.\nDo lead ao pós-venda, sem atalho.",
      image: parketDeckLake,
    },
  },
];