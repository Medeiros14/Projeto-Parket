import { type SlideData } from "./slides-data";

/* ─── Images ─── */
const IMG_COVER = "https://images.unsplash.com/photo-1765766601532-90e9b96320c8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3b29kJTIwZmxvb3IlMjBzaG93cm9vbSUyMGRhcmslMjBlbGVnYW50fGVufDF8fHx8MTc3MjA3MDgxNnww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_INSPECT = "https://images.unsplash.com/photo-1754780960162-839cda44d736?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwaW5zcGVjdGlvbiUyMGJsdWVwcmludCUyMGFyY2hpdGVjdHxlbnwxfHx8fDE3NzIwNzA4MTd8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_MEETING = "https://images.unsplash.com/photo-1652265540589-46f91535337b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1lZXRpbmclMjBjb25zdWx0aW5nJTIwcHJlc2VudGF0aW9uJTIwcHJlbWl1bXxlbnwxfHx8fDE3NzIwNzA4MTh8MA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_WAREHOUSE = "https://images.unsplash.com/photo-1685119166946-d4050647b0e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBsb2dpc3RpY3MlMjBkZWxpdmVyeSUyMHBhY2thZ2luZyUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzcyMDcwODE4fDA&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_INTERIOR = "https://images.unsplash.com/photo-1770381142493-075344e6fc9b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBpbnRlcmlvciUyMGRlc2lnbiUyMG1vZGVybiUyMGxpdmluZyUyMHJvb20lMjB3b29kfGVufDF8fHx8MTc3MjA3MDgxOHww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_WORKSHOP = "https://images.unsplash.com/photo-1497218770144-3fea6dbc33fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXN0b20lMjBjYXJwZW50cnklMjB3b3Jrc2hvcCUyMHByZWNpc2lvbiUyMHdvb2R3b3JraW5nfGVufDF8fHx8MTc3MjA3MDgxOXww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_CONCRETE = "https://images.unsplash.com/photo-1659051637855-cb883350313a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWluaW1hbCUyMGNvbmNyZXRlJTIwdGV4dHVyZSUyMHdhbGwlMjBiYWNrZ3JvdW5kfGVufDF8fHx8MTc3MjA3MDgxOXww&ixlib=rb-4.1.0&q=80&w=1080";
const IMG_FUNNEL = "https://images.unsplash.com/photo-1746988043334-b8677f2ec74c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYWxlcyUyMGZ1bm5lbCUyMHBpcGVsaW5lJTIwYnVzaW5lc3MlMjBzdHJhdGVneSUyMHdoaXRlYm9hcmR8ZW58MXx8fHwxNzcyMDcwODIwfDA&ixlib=rb-4.1.0&q=80&w=1080";

export const journeyPlaybookSlides: SlideData[] = [

  /* ═══════════════════════════════════════════════════════════
     CAPA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "cover",
    props: {
      title: "Playbook da\nJornada do Cliente",
      subtitle: "De lead capturado a pós-venda estratégico.\nCada estado, cada gate, cada evidência.\nRevestimento + Marcenaria.",
      image: IMG_COVER,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 01 · VISÃO DE SISTEMA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 01",
      title: "Visão de Sistema",
      subtitle: "Um funil com gates e \"estado\" único da obra.\nSem isso, obra fantasma é o padrão.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "Cada obra vive em\num único \"estado\" por vez.\nSem estado único,\no caos vira padrão.",
      attribution: "Princípio arquitetural #1",
      label: "Sistema Operacional Parket",
    },
  },
  {
    type: "content",
    props: {
      title: "8 Garantias do Sistema",
      label: "O que o sistema deve proteger",
      highlight: "Todo gate existe para garantir uma dessas 8 promessas. Se o gate não protege nenhuma, elimine-o.",
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
      title: "20 Macroestados do Funil",
      label: "Workflow que o app/IA precisa enxergar",
      steps: [
        { number: "01", title: "Lead capturado", description: "Registro no CRM com origem, perfil, cidade, tipo de escopo" },
        { number: "02", title: "Qualificação", description: "Escopo entendido, viabilidade técnica, driver do cliente" },
        { number: "03", title: "Levantamento", description: "Proposta em elaboração com base em arquivo versionado" },
        { number: "04", title: "Proposta apresentada", description: "Follow-up ativo com cadência no CRM" },
        { number: "05", title: "Contrato assinado", description: "Aguardando 1a parcela para ativação interna" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "20 Macroestados do Funil",
      label: "Estados 06-10",
      steps: [
        { number: "06", title: "1a parcela paga", description: "Obra ativada internamente no pipeline" },
        { number: "07", title: "Onboarding", description: "Grupo, pasta, checklist, mensagem de boas-vindas" },
        { number: "08", title: "Pre-projeto pronto", description: "Arquivos coletados, compatibilizado, fiscal tem material" },
        { number: "09", title: "1a vistoria realizada", description: "Medicao, condicoes, logistica diagnosticados" },
        { number: "10", title: "Projeto executivo", description: "Em aprovacao (interna + cliente + arquiteto)" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "20 Macroestados do Funil",
      label: "Estados 11-15",
      steps: [
        { number: "11", title: "Lista de insumos", description: "Aprovada e compras em andamento" },
        { number: "12", title: "Pre-liberacao", description: "Checklist e fotos da engenharia em avaliacao" },
        { number: "13", title: "2a vistoria", description: "Liberacao final: umidade, laser, conferencias" },
        { number: "14", title: "Entrega de material", description: "Agendada e executada com evidencia" },
        { number: "15", title: "Contrato prestador", description: "Assinado, custos travados, equipe definida" },
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "20 Macroestados do Funil",
      label: "Estados 16-20",
      steps: [
        { number: "16", title: "Instalacao iniciada", description: "Controlada com diario, fotos e check-in/out" },
        { number: "17", title: "Entrega final", description: "Termo de aceite assinado, retencao liberada" },
        { number: "18", title: "Pos-obra", description: "Triagem: Parket, obra ou cliente? Resolucao objetiva" },
        { number: "19", title: "Encerramento", description: "NPS coletado, indicacao solicitada" },
        { number: "20", title: "Reciclagem comercial", description: "Novas oportunidades no circulo do cliente" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 02 · REVESTIMENTO — PROSPECÇÃO E QUALIFICAÇÃO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 02",
      title: "Revestimento\nEtapas 0-2",
      subtitle: "Prospecção, reunião de escopo consultiva\ne levantamento técnico.",
    },
  },
  {
    type: "split",
    props: {
      title: "Etapa 0 — Prospecção\n(Entrada de Demanda)",
      label: "Canais de Origem",
      items: [
        "INBOUND — Instagram, leads (tráfego pago), orgânico",
        "OUTBOUND — BDR cold call para trazer ao showroom",
        "RELACIONAMENTO — Arquiteto, incorporador, cliente antigo, indicação",
      ],
      highlight: "Sem CRM preenchido, o lead \"não existe\". Esse é o primeiro gate cultural.",
      image: IMG_FUNNEL,
    },
  },
  {
    type: "content",
    props: {
      title: "Saídas Obrigatórias\nda Prospecção",
      label: "Etapa 0 — Gate de Entrada",
      highlight: "Lead registrado no CRM. Sem registro = lead fantasma = zero controle.",
      items: [
        "Origem do lead (inbound, outbound, indicação, arquiteto)",
        "Perfil do cliente (pessoa física, jurídica, incorporador)",
        "Cidade e localização da obra",
        "Tipo de escopo (piso, forro, deck, painel, escada, banco, marcenaria)",
        "Estágio atual da obra (subindo, reboco, contrapiso, gesso etc.)",
        "Próxima ação definida e agendada",
        "\"Motivo do lead\" em 1 frase: o que ele quer e para quando",
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "Etapa 1 — Reunião\nde Escopo Consultiva",
      label: "Qualificação Real + Encantamento",
      items: [
        "Definir: o que vai ser vendido, onde será aplicado, se é tecnicamente viável",
        "Criar percepção de valor — não é orçamento, é consultoria",
        "Entender o \"driver\" do cliente: estética, prazo, durabilidade, status, manutenção",
        "Mapear todos os decisores: cliente, arquiteto, engenheiro, gerenciador",
      ],
      highlight: "Saída: escopo preliminar \"vendável\" + próximo passo combinado.",
      image: IMG_MEETING,
    },
  },
  {
    type: "content",
    props: {
      title: "Checklist de Perguntas\nda Reunião de Escopo",
      label: "Etapa 1 — Coleta obrigatória",
      items: [
        "Qual ambiente e qual solução por ambiente (piso, forro, deck, painel, escada)?",
        "Em cada solução: interno/externo? umidade? insolação? ar-condicionado? automação/iluminação?",
        "Qual o \"momento\" da obra: subindo parede, reboco, contrapiso, gesso?",
        "Quem decide: cliente, arquiteto, engenheiro, gerenciador?",
        "Qual o driver: estética, prazo, durabilidade, status, manutenção?",
        "Data-alvo: quando quer instalar e quando precisa entregar",
        "Brief do arquiteto recebido? (planta, renders, fotos, referências)",
        "Preferência estética definida (madeira, paginação, ripado etc.)?",
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "Etapa 2 — Levantamento\ne Validação Técnica",
      label: "Antes da proposta sair",
      items: [
        "Comercial dispara, time de levantamento analisa projeto",
        "Conferência das áreas e condições do projeto recebido",
        "Identificação de riscos que viram aditivo (recortes, alçapões, grelhas, rodapé invertido)",
        "Se necessário: alinhamento com Projetos (pré-projeto) para não orçar \"no escuro\"",
        "Compatibilização do \"que dá para vender\" vs \"que dá para executar\"",
      ],
      highlight: "Proposta calculada com base em arquivo identificado (nome/versão). Lista de premissas anexada.",
      image: IMG_INSPECT,
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 03 · PROPOSTA, FOLLOW-UP E CONTRATO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 03",
      title: "Revestimento\nEtapas 3-5",
      subtitle: "Proposta apresentada, follow-up com cadência\ne contrato com gate de ativação.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Etapa 3 — Proposta\ne Apresentação",
      label: "Não é \"mandar PDF\"",
      leftTitle: "Padrão: Showroom",
      leftItems: [
        "Escopo claro e detalhado",
        "Técnica: como Parket executa diferente",
        "Diferença Parket: o que o cliente leva de valor",
        "Risco reduzido: gates, vistorias, evidências",
        "Cronograma coerente (não promessa)",
        "Lista de premissas e exclusões",
      ],
      rightTitle: "Exceção: Call agendada",
      rightItems: [
        "Mesma qualidade de apresentação",
        "Proposta com premissas e exclusões visíveis",
        "Registro no CRM obrigatório",
        "Próxima ação definida: data de follow-up ou negociação",
        "Nunca mandar PDF frio sem contexto",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#E8C97A",
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 4 — Follow-up\ne Negociação",
      label: "Cadência obrigatória",
      highlight: "Se não fechou no ato, vira máquina de follow-up com cadência. Status no CRM obrigatório após cada contato.",
      items: [
        "Cadência de contato padronizada (D+1, D+3, D+7, D+14, D+30)",
        "Status no CRM atualizado após CADA contato",
        "Motivo de não-fechamento classificado: preço, prazo, indecisão, concorrente, mudança de escopo, timing da obra",
        "Saída: \"Sim\" (fechou) ou \"não agora\" com data para retomar",
        "Leads mortos revisados mensalmente — pipeline limpo",
        "Nunca deixar lead sem próxima ação definida",
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Etapa 5 — Contrato,\nAceite e Ativação",
      label: "Gate de ativação interna",
      steps: [
        { number: "01", title: "Vendedor fecha", description: "Escopo, prazo e condições alinhados" },
        { number: "02", title: "Validação Carla", description: "Escopo executável, preço ok, produto em linha" },
        { number: "03", title: "Assinatura digital", description: "Contrato formal assinado por ambas as partes" },
        { number: "04", title: "1a parcela paga", description: "Gate real: só ativa internamente após pagamento" },
        { number: "05", title: "Obra ativa", description: "Entra no pipeline de obras oficialmente" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 04 · ONBOARDING, PRÉ-PROJETO E 1ª VISTORIA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 04",
      title: "Revestimento\nEtapas 6-8",
      subtitle: "Onboarding de obra, coleta de arquivos,\npré-projeto e 1a vistoria de medição.",
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 6 — Onboarding\nde Obra",
      label: "Responsável: Talita (Atendimento)",
      highlight: "Sem grupo + checklist + pasta, não existe obra organizada. Gate cultural.",
      items: [
        "Criar \"dashboard da obra\" (registro mestre no sistema)",
        "Criar grupo com: cliente/engenharia/arquitetura, vendedor, projetos, expedição, fiscal, Nat (cronograma), marcenaria (se aplicável)",
        "Mensagem de boas-vindas com \"passo a passo Parket\"",
        "Checklist de pré-requisitos enviado no grupo",
        "Regra das 2 vistorias padrão explicada (3a = taxa)",
        "Como funciona entrega e instalação Parket",
        "O que gera custo extra (ex: 3a vistoria, mudança de escopo)",
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "Etapa 7 — Coleta\ne Pré-Projeto",
      label: "Responsável: Tainara (Projetos)",
      items: [
        "Pedir arquivos atualizados e conferir compatibilidade com o orçado",
        "Gerar pré-projeto Parket com o que o fiscal precisa levar:",
        "— Sentido de paginação/forro",
        "— Alçapões, cortineiros, grelhas",
        "— Pontos de automação e iluminação",
        "— Encontros piso frio vs madeira",
        "— Escada e rodapé invertido",
        "— Recortes previstos (para aditivo cedo)",
      ],
      highlight: "REGRA: Fiscal só vai com pré-projeto em mãos. Sem pré-projeto = sem vistoria.",
      image: IMG_INSPECT,
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 8 — 1a Vistoria\n(Medição Inicial)",
      label: "Objetivo triplo",
      highlight: "Bater metragem cedo = aditivo cedo. Diagnosticar condições = zero surpresa. Diagnosticar logística = entrega sem stress.",
      items: [
        "Metragens reais vs projeto — se mudou: aditivo imediato",
        "Condição de contrapiso: traço, nível, seco, sem buraco",
        "Obra fechada, sem infiltração",
        "Gesso finalizado, primeira demão de tinta",
        "Batentes, baguetes, piso frio prontos",
        "Elétrica/hidráulica/automação prontas para forro",
        "Ar-condicionado, pingadeiras, beirais, alçapões",
        "Deck/painel/escada/banco: checklist específico por solução",
        "Logística: onde armazena, risco de umidade, segurança, acesso",
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Saídas da 1a Vistoria",
      label: "Obrigatório após cada vistoria",
      leftTitle: "Relatório + Evidências",
      leftItems: [
        "Relatório de medição e pré-requisitos postado no grupo",
        "Salvo na pasta da obra",
        "Lista de pendências da engenharia para liberação",
        "Fotos de condições atuais como evidência",
        "Status de cada pré-requisito (ok / pendente / bloqueante)",
      ],
      rightTitle: "Decisões Imediatas",
      rightItems: [
        "Se metragem mudou: aditivo imediato (ideal)",
        "Se condições insuficientes: lista de correções para engenharia",
        "Se obra longe: vistoria remota com checklist + fotos + termo (regra formal, não improviso)",
        "Prazo para engenharia resolver pendências",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#E8C97A",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 05 · COMPRAS, PROJETO EXECUTIVO E LIBERAÇÃO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 05",
      title: "Revestimento\nEtapas 9-11",
      subtitle: "Compras e kitagem, projeto executivo\ne liberação final com 2a vistoria.",
    },
  },
  {
    type: "process",
    props: {
      title: "Etapa 9 — Compras,\nProdução e Kitagem no CD",
      label: "Após relatório da 1a vistoria conferido",
      steps: [
        { number: "01", title: "Conferência", description: "Vendido vs medido — ajustar quantidades" },
        { number: "02", title: "Lista de insumos", description: "\"Receita de bolo\" calculada e conferida" },
        { number: "03", title: "Compras: estoque", description: "O que tem em estoque: separa" },
        { number: "04", title: "Compras: mercado", description: "O que falta: compra nacional / Pâmela aciona importação" },
        { number: "05", title: "Expedição kit", description: "Piso + insumos (cola, barrote, parafuso) separados por obra" },
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "Nunca mandar \"a mais\"\npor vício. Manda o\nnecessário medido.\nSe comprou 100 e precisa 80,\nmanda 80 com lastro documental.",
      attribution: "Regra crítica de expedição",
      label: "Anti-desperdício",
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 10 — Projeto\nExecutivo Aprovado",
      label: "Gate de entrada em obra",
      highlight: "Para entrar na obra: projeto executivo aprovado + liberação do fiscal (2a vistoria). Sem esses dois, não entra.",
      items: [
        "PISO/DECK — Muitas vezes pré-projeto já resolve",
        "FORRO — Exige compatibilização com iluminação, ar-condicionado, automação",
        "Itens cobrados à parte no forro: recortes, caixinhas removíveis, grelhas, alçapões",
        "TUDO que é extra precisa virar aditivo ANTES de produzir ou instalar",
        "Aprovação formal registrada (não é \"ok por WhatsApp\")",
      ],
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Etapa 11 — Pré-liberação\ne 2a Vistoria",
      label: "Liberação final da obra",
      leftTitle: "Pré-liberação (filtro)",
      leftItems: [
        "Engenharia envia fotos e confirma checklist",
        "Time de atendimento filtra: evita deslocamento inútil",
        "Confirma que pendências da 1a vistoria foram resolvidas",
        "Se não está pronto: NÃO agenda 2a vistoria",
      ],
      rightTitle: "2a Vistoria (fiscal in loco)",
      rightItems: [
        "Mede umidade com higrômetro",
        "Conferência com laser de nível",
        "Andaimes e caçamba (responsabilidade da obra)",
        "Acessos liberados e local de armazenamento seco",
        "Se não liberado: lista do que falta",
        "3a ida só com taxa OU vídeo/foto + termo de responsabilidade assinado",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#4ECDC4",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 06 · ENTREGA, START E EXECUÇÃO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 06",
      title: "Revestimento\nEtapas 12-14",
      subtitle: "Entrega de material com rastreabilidade,\ncontrato do prestador e execução controlada.",
    },
  },
  {
    type: "process",
    props: {
      title: "Etapa 12 — Entrega\nde Material",
      label: "Com prova e rastreabilidade",
      steps: [
        { number: "01", title: "Agendamento", description: "Confirmação 1 semana antes + 1 dia antes" },
        { number: "02", title: "Controle na saída", description: "Ailton confere item a item vs receita + fotos carregando" },
        { number: "03", title: "Controle na chegada", description: "Foto de tudo entregue + assinatura (canhoto/digital)" },
        { number: "04", title: "Armazenamento", description: "Evidência de local seguro, sem umidade" },
        { number: "05", title: "Aceite", description: "\"Material entregue e aceito\" com evidência registrada" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 13 — Contrato\ndo Prestador e Start",
      label: "Gate: sem contrato = sem start",
      highlight: "Sem contrato assinado, sem adiantamento e sem start. Classificação de complexidade define acompanhamento.",
      items: [
        "COMPLEXA — Fiscal solta junto e acompanha de perto",
        "MÉDIA — Fiscal acompanha, pode soltar junto dependendo da equipe",
        "SIMPLES — Equipe experiente toca com visitas pontuais do fiscal",
        "Custos de obra longe travados ANTES do start: hotel, combustível, alimentação",
        "Tudo condicionado ao contrato e aprovação do financeiro (Carla)",
        "Classificação definida na reunião semanal de obras com fiscais",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 14 — Execução\ne Controle Diário",
      label: "Produtividade + Qualidade",
      highlight: "Primeira obrigação ao chegar: conferir material, cor, lote e insumos. Se abriu e colou, assumiu responsabilidade.",
      items: [
        "Definir armazenamento e responsabilidade por insumos",
        "Uniforme, EPI, limpeza, comportamento — obrigatório",
        "Ninguém fala de prazo/decisão com cliente: só fiscal",
        "Multa por desvio de conduta (sem debate)",
        "Check-in e check-out (ideal geolocalização/app)",
        "Fotos do que foi produzido no dia + ocorrências",
        "Feedback \"despretensioso\" no grupo para engenharia: radar antifraude",
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "Regra de Pagamento\ne Retenção",
      label: "Quinzenal com retenção de 25%",
      items: [
        { title: "Fechamento D10", description: "Pagamento dia 15 do mês" },
        { title: "Fechamento D25", description: "Pagamento dia 30 do mês" },
        { title: "Retenção 25%", description: "Por item, até aceite final do cliente" },
        { title: "Liberação", description: "Conforme itens aceitos no termo de entrega" },
        { title: "Bônus", description: "Produtividade acima da meta, zero retrabalho" },
        { title: "Multa", description: "Desvio de conduta, sem diário, sem EPI" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 07 · ENTREGA FINAL, PÓS-OBRA E PÓS-VENDA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 07",
      title: "Revestimento\nEtapas 15-17",
      subtitle: "Entrega final com aceite, pós-obra\ncom triagem objetiva e pós-venda estratégico.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Etapa 15 — Entrega Final\ne Termo de Aceite",
      label: "Encerramento formal",
      leftTitle: "Obra Grande",
      leftItems: [
        "Fiscal entrega presencialmente",
        "Checklist item a item",
        "Conformidade técnica verificada",
        "Acabamento inspecionado",
        "Limpeza pós-serviço",
        "Pendências registradas e prazos definidos",
        "Termo assinado presencialmente",
      ],
      rightTitle: "Obra Pequena",
      rightItems: [
        "Termo digital no grupo",
        "Fotos de evidência de cada ambiente",
        "Checklist simplificado",
        "Aceite por mensagem formal no grupo",
        "Liberação de retenção por itens aceitos",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#4ECDC4",
    },
  },
  {
    type: "process",
    props: {
      title: "Etapa 16 — Pós-Obra\n(Triagem Objetiva)",
      label: "Fluxo de reparo/manutenção/aditivo",
      steps: [
        { number: "01", title: "Solicitação", description: "Talita recebe e registra no sistema" },
        { number: "02", title: "Avaliação fiscal", description: "Relatório técnico: de quem é a responsabilidade?" },
        { number: "03A", title: "Responsabilidade Parket", description: "Agenda e arca com custos" },
        { number: "03B", title: "Não é Parket", description: "Explica por quê + orçamento ao cliente" },
        { number: "04", title: "Execução e aceite", description: "Se aprovado: agenda → executa → termo → paga prestador → encerra" },
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 17 — Pós-Venda\nEstratégico",
      label: "NPS + Indicação + Pipeline Novo",
      highlight: "Talita como CS (visão neutra). Vendedor faz relação com arquiteto. Fundador liga em obras grandes ou crises que viraram vitória.",
      items: [
        "Nota de 0 a 10 de indicação (NPS)",
        "Nota da equipe (conduta + qualidade)",
        "Resultado final vs expectativa",
        "Quem mais pode estar construindo no círculo?",
        "Amigos, novos projetos, outros clientes do arquiteto, mesma engenharia",
        "Lead novo gerado ou follow-up programado",
        "Vendedor retoma com arquiteto — relacionamento de longo prazo",
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 08 · MARCENARIA — JORNADA COMPLETA
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 08",
      title: "Marcenaria",
      subtitle: "Mais complexa, mais gates.\nErro custa caro e aparece tarde.\nGates precisam ser mais duros.",
    },
  },
  {
    type: "statement",
    props: {
      statement: "Marcenaria é indústria\nde precisão + engenharia\n+ compatibilização.\nO erro custa caro\ne aparece tarde.",
      attribution: "Princípio Marcenaria #1",
      label: "Por que gates mais duros",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Marcenaria vs Revestimento\nEtapas 0-5",
      label: "Igual até contrato, com duas diferenças",
      leftTitle: "Diferença 1: Reunião de Escopo",
      leftItems: [
        "Modo \"Ornare\": protótipo, exemplos, demonstração de valor",
        "Não pode ser proposta fria — experiência consultiva",
        "Demonstrar capacidade técnica e acabamento",
        "Referências visuais obrigatórias para alinhamento",
      ],
      rightTitle: "Diferença 2: Validação Técnica",
      rightItems: [
        "Projetos e fábrica validam exequibilidade ANTES da proposta",
        "Marco Antônio ou direção de produção envolvidos",
        "Escopos críticos: fachada, portas especiais, ferragens, pé-direito fora do padrão",
        "\"Aval técnico de fábrica\" registrado como saída extra obrigatória",
      ],
      leftColor: "#B8AA9A",
      rightColor: "#E8C97A",
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 6 Marc — Onboarding\ncom Regra do Prazo",
      label: "Expectativa alinhada desde o dia 1",
      highlight: "Mensagem clara: prazo de produção só começa a contar após projeto aprovado + medição fina + amostras aprovadas e assinadas.",
      items: [
        "Cliente entende que a bola está com a obra — elimina discussão depois",
        "Passo a passo Parket Marcenaria enviado no grupo",
        "Cronograma condicional: \"após aprovações X, Y, Z o prazo começa\"",
        "Regra formal registrada no grupo e na pasta da obra",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 7 Marc — Pré-Projeto\ne Mapa de Itens",
      label: "Fundação do controle",
      highlight: "Sem mapa de itens, você perde controle de aditivo e vira \"memória e WhatsApp\".",
      items: [
        "Pasta do cliente criada e organizada",
        "Mapa de itens vendido: item a item",
        "Cada item com: descrição, dimensões esperadas, ferragens, acabamentos",
        "Versionamento formal do mapa (Rev 01, Rev 02 etc.)",
        "Base para conferência em todas as etapas seguintes",
        "Qualquer mudança = atualizar mapa + registrar aditivo",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 8 Marc — Reunião\nTécnica Gravada",
      label: "Com arquitetura — antes de ir para obra",
      highlight: "Travar decisões que normalmente explodem depois. Reunião GRAVADA para evidência.",
      items: [
        "Cava e tipo de maçaneta definidos",
        "Fechadura e furação especificados",
        "Ferragens e sistemas de abertura confirmados",
        "Limites técnicos do que foi vendido esclarecidos",
        "Compatibilização com terceiros: fachada, estrutura, quadros",
        "Saída: decisões formalizadas + riscos mapeados + \"pontos de atenção\" para vistoria",
      ],
    },
  },
  {
    type: "split",
    props: {
      title: "Etapa 9 Marc —\n1a Vistoria e Medição",
      label: "Tainara na obra",
      items: [
        "Checa prumo, requadro, paredes, portas",
        "Padroniza vãos (evitar 89, 88, 87 aleatórios)",
        "Valida viabilidade real do que foi vendido",
        "Inicia compatibilização com engenharia e terceiros",
        "Gera relatório + pendências da obra para produzir com segurança",
        "Ajustes e possíveis aditivos cedo",
      ],
      highlight: "Se não padronizar vãos aqui, produz errado e retrabalho custa caro.",
      image: IMG_WORKSHOP,
    },
  },
  {
    type: "content",
    props: {
      title: "Etapas 10-11 Marc —\nCompras e Projeto Executivo",
      label: "Antecipação + Padronização",
      highlight: "Pode comprar \"grosso\" antes (lâmina, compensado), mas compra final só fecha após vistoria e validação.",
      items: [
        "COMPRAS: compras travadas por item e por lote, risco de falta reduzido",
        "PROJETO EXECUTIVO: gargalo clássico — reduzir ida e volta",
        "Criar \"Ficha Parket de Marcenaria\" obrigatória antes de mandar executivo para arquiteto:",
        "— Padrões de detalhamento exigidos por Parket",
        "— Padrões de ferragens, folgas e tolerâncias",
        "— Padrões de paginação e acabamento",
        "— Padrão de nomenclatura de itens",
        "GATE: Projeto executivo aprovado = aprovação formal registrada, não \"ok por WhatsApp\"",
      ],
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 12 Marc —\nMedição Fina",
      label: "\"Prazo começa aqui\"",
      highlight: "Levar o responsável de produção/instalação junto na medição fina (SP). Ele antecipa risco de montagem e reduz surpresa.",
      items: [
        "Após medição fina: atualizar dimensões reais item a item",
        "Reenviar para aprovação final",
        "Só então liberar para produção",
        "Prioridade por ambientes definida (faseamento)",
        "Evidências: fotos e notas por item",
        "Se medida mudou: atualizar mapa + registrar aditivo formal",
      ],
    },
  },
  {
    type: "statement",
    props: {
      statement: "Sem assinatura\natrás da amostra,\nnão produz.\nIsso mata 80% das brigas\nde expectativa.",
      attribution: "Regra de ouro — Marcenaria",
      label: "Etapa 13 — Aprovação de Amostras",
    },
  },
  {
    type: "content",
    props: {
      title: "Etapa 14 Marc — Produção\ncom Rastreabilidade por Item",
      label: "Sistema operacional industrial",
      highlight: "CLT sem medição e sem registro = \"produção invisível\" = prejuízo. Germano como \"Project Marshall\" da marcenaria.",
      items: [
        "Cada item tem ID único (etiqueta)",
        "Timestamps por etapa: início bancada → fim bancada → pintura início/fim → QC final → embalagem → expedição",
        "Germano audita no fim do dia: passa nas bancadas, confere com trena, tira fotos",
        "Registra o que foi feito por item — trava desvio cedo",
        "Sem medição e registro, você nunca sabe custo, tempo e margem por item",
      ],
    },
  },
  {
    type: "process",
    props: {
      title: "Etapas 15-19 Marc —\nFinalização",
      label: "QC final → Logística → Instalação → Entrega → Pós",
      steps: [
        { number: "15", title: "QC Final", description: "Medidas vs etiqueta vs projeto. Acabamento, ferragens. Sem assinatura, não embarca." },
        { number: "16", title: "Logística", description: "Checar elevador, içamento, andaime. Fotos saindo e chegando." },
        { number: "17", title: "Instalação", description: "Não desembala sem conferir etiqueta vs projeto. Violou lacre = assumiu risco." },
        { number: "18", title: "Entrega", description: "Ajustes finais, checklist item a item, termo de aceite." },
        { number: "19", title: "Pós-obra/venda", description: "Triagem cirúrgica. Relatório técnico. NPS e reciclagem comercial." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 09 · PAPÉIS E RESPONSABILIDADES (RACI)
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 09",
      title: "Papéis e\nResponsabilidades",
      subtitle: "RACI simplificado.\nCada macrobloco tem um dono.\nSem dono, ninguém cobra.",
    },
  },
  {
    type: "role",
    props: {
      title: "Donos de Processo\npor Macrobloco",
      label: "Quem é responsável por quê",
      roles: [
        { role: "Comercial (Vendedor/BDR)", responsibility: "Até contrato + 1a parcela paga. Depois: relacionamento e retomadas." },
        { role: "Jurídico/Financeiro (Carla)", responsibility: "Validação contratual, gatilhos de cobrança e liberação de pagamentos." },
        { role: "CS/Obras (Talita)", responsibility: "Onboarding, grupo, comunicação, agendamentos, pós-obra, NPS." },
        { role: "Projetos (Tainara)", responsibility: "Pré-projeto, executivo, compatibilização, mapa de itens." },
        { role: "Fiscal (por obra)", responsibility: "Vistorias, liberação, qualidade em campo, entrega grande." },
      ],
    },
  },
  {
    type: "role",
    props: {
      title: "Donos de Processo\npor Macrobloco",
      label: "Continuação",
      roles: [
        { role: "Expedição (Ailton + time)", responsibility: "Kitagem, conferência item a item, evidência de entrega." },
        { role: "Compras (Ronaldo / Pâmela import)", responsibility: "Disponibilidade e abastecimento. Nacional e importação." },
        { role: "PCP/Produção/Qualidade", responsibility: "Produção por item + QC final + embalagem. Rastreabilidade." },
        { role: "Dani", responsibility: "Contrato prestador, agenda equipes, coordenação do start." },
        { role: "Nat", responsibility: "Cronograma, governança operacional, pagamentos quinzenais, controle de evidência." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 10 · PONTOS DE RUPTURA E GATES
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 10",
      title: "Pontos de Ruptura\ne Gates",
      subtitle: "Os 6 pontos onde o processo quebra.\nComo travar cada um com gate objetivo.",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Ruptura 1\nFiscal sem Pré-Projeto",
      label: "Causa: improviso na vistoria",
      leftTitle: "O Problema",
      leftItems: [
        "Fiscal vai sem pré-projeto",
        "Não sabe o que conferir específico",
        "Volta sem informação para aditivo",
        "Vistoria vira perda de tempo e dinheiro",
      ],
      rightTitle: "O Gate",
      rightItems: [
        "\"Sem pré-projeto anexado no card da obra, não agenda vistoria\"",
        "Sistema bloqueia agendamento sem documento",
        "Responsável: Projetos (Tainara) prepara e anexa",
        "Fiscal só recebe card com pré-projeto completo",
      ],
      leftColor: "#E85D5D",
      rightColor: "#4ECDC4",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Ruptura 2\nAditivo Tarde",
      label: "Causa: falta de medição cedo",
      leftTitle: "O Problema",
      leftItems: [
        "Aditivo aparece durante ou após instalação",
        "Cliente fica bravo: \"achei que estava incluso\"",
        "Margem evapora",
        "Desgaste de relacionamento irreversível",
      ],
      rightTitle: "A Regra",
      rightItems: [
        "Aditivo só nasce na 1a vistoria (metragem) OU na fase de executivo (recortes/alçapões/grelhas)",
        "Aditivo depois de material na obra = proibido",
        "Mapa de itens vendido vs medido = conferência obrigatória",
        "Qualquer diferença vira comunicação imediata ao cliente",
      ],
      leftColor: "#E85D5D",
      rightColor: "#4ECDC4",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Ruptura 3\nCronograma Ilusório",
      label: "Causa: promessa antes de condição",
      leftTitle: "O Problema",
      leftItems: [
        "Cronograma enviado antes de obra liberada",
        "Cria expectativa impossível de cumprir",
        "Frustra cliente e engenharia",
        "Gera pressão errada no time",
      ],
      rightTitle: "A Regra",
      rightItems: [
        "Cronograma só faz sentido quando: obra liberada + material entregue + equipe confirmada",
        "Enviar \"cronograma final\" no dia do start ou no dia da entrega de material",
        "Antes disso: datas estimadas, nunca compromissos",
      ],
      leftColor: "#E85D5D",
      rightColor: "#4ECDC4",
    },
  },
  {
    type: "twocolumn",
    props: {
      title: "Rupturas 4, 5 e 6",
      label: "Entrega, disciplina e rastreabilidade",
      leftTitle: "Rupturas",
      leftItems: [
        "R4: Entrega sem prova e sem armazenamento — material some, estraga, gera discussão",
        "R5: Equipe sem disciplina diária — dia sem registro = dia invisível = prejuízo",
        "R6: Marcenaria sem rastreabilidade por item — nunca sabe custo, tempo e margem",
      ],
      rightTitle: "Gates",
      rightItems: [
        "R4: Checklist de evidência obrigatório com fotos + assinatura digital",
        "R5: Bônus/multa automático + retenção por item + check-in/out + prova diária",
        "R6: ID por item + Germano como auditor diário + QC final assinando",
      ],
      leftColor: "#E85D5D",
      rightColor: "#4ECDC4",
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 11 · ENTREGÁVEIS — CHECKLISTS E TERMOS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 11",
      title: "Entregáveis\ndo Sistema",
      subtitle: "Checklists mestres, termos padrão\ne métricas semanais para implementação.",
    },
  },
  {
    type: "grid",
    props: {
      title: "9 Checklists Mestres\n(Formulários no App)",
      label: "Cada etapa vira formulário digital",
      items: [
        { title: "1. Onboarding", description: "Grupo, pasta, dashboard, mensagem, pré-requisitos, regras de vistoria" },
        { title: "2. Pré-Projeto", description: "Arquivos recebidos, compatibilização, paginação, alçapões, recortes, encontros" },
        { title: "3. 1a Vistoria", description: "Metragens, contrapiso, umidade, gesso, batentes, elétrica, logística, fotos" },
        { title: "4. Liberação", description: "Pré-requisitos ok, umidade ok, nível ok, andaime, caçamba, acesso, armazenamento" },
        { title: "5. Entrega Material", description: "Item a item vs receita, fotos saindo/chegando, assinatura, armazenamento seguro" },
        { title: "6. Start Obra", description: "Contrato prestador, classificação complexidade, custos travados, equipe definida" },
        { title: "7. Diário de Obra", description: "Check-in/out, fotos produção, ocorrências, feedback grupo, m2 produzido" },
        { title: "8. Entrega Final", description: "Conformidade, acabamento, limpeza, pendências, termo aceite assinado" },
        { title: "9. Pós-Obra", description: "Triagem responsabilidade, relatório técnico, orçamento se aplicável, termo encerramento" },
      ],
    },
  },
  {
    type: "grid",
    props: {
      title: "4 Termos Padrão",
      label: "Documentos para assinatura digital",
      items: [
        { title: "Termo de Responsabilidade", description: "Para entrar na obra sem pré-requisito completo. Cliente assume risco por escrito." },
        { title: "Taxa 3a Vistoria", description: "Cobrada quando engenharia não cumpriu checklist nas duas primeiras vistorias." },
        { title: "Aceite de Entrega", description: "Digital, com checklist item a item, fotos de evidência e assinatura." },
        { title: "Contrato Prestador", description: "Automático por escopo e por item. Com retenção de 25% e regras de bônus/multa." },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     CAP 12 · MÉTRICAS SEMANAIS
     ═══════════════════════════════════════════════════════════ */
  {
    type: "section",
    props: {
      block: "Capítulo 12",
      title: "Métricas Semanais",
      subtitle: "O que a IA/sistema precisa gerar\nautomaticamente toda semana.",
    },
  },
  {
    type: "metrics",
    props: {
      title: "10 Métricas Semanais\nObrigatórias",
      label: "Dashboard que a IA precisa cuspir",
      metrics: [
        { value: "#1", label: "Obras por estado do funil", sublabel: "Distribuição dos 20 macroestados" },
        { value: "#2", label: "Obras aguardando arquivos", sublabel: "Bloqueadas por falta de projeto/info" },
        { value: "#3", label: "Obras aguardando 1a vistoria", sublabel: "Medição pendente de agendamento" },
        { value: "#4", label: "Obras com aditivo pendente", sublabel: "Metragem mudou, aditivo não formalizado" },
        { value: "#5", label: "Obras com projeto exec pendente", sublabel: "Aprovação em andamento ou travada" },
      ],
    },
  },
  {
    type: "metrics",
    props: {
      title: "10 Métricas Semanais\nObrigatórias",
      label: "Métricas 6-10",
      metrics: [
        { value: "#6", label: "Obras aguardando liberação", sublabel: "Checklist não cumprido pela engenharia" },
        { value: "#7", label: "Material entregue → equipe", sublabel: "Obras com material esperando start" },
        { value: "#8", label: "Execução: esperado vs real", sublabel: "Produção diária prevista vs realizada" },
        { value: "#9", label: "Ranking de equipes", sublabel: "Pontuação, bônus/multa, retrabalho" },
        { value: "#10", label: "Pós-obra por aging", sublabel: "0-7 dias, 8-15 dias, 16+ dias" },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════
     ENCERRAMENTO
     ═══════════════════════════════════════════════════════════ */
  {
    type: "statement",
    props: {
      statement: "Cada gate existe\npara proteger uma promessa.\nSe o gate não protege,\nelimine-o.\nSe protege, nunca pule.",
      attribution: "Princípio de governança Parket",
      label: "Filosofia do Sistema",
    },
  },
  {
    type: "closing",
    props: {
      title: "Playbook da\nJornada do Cliente",
      subtitle: "Documento vivo — atualizado a cada ciclo de melhoria.\nCada checklist, cada gate, cada evidência.\nDe lead a pós-venda, sem atalho.",
      image: IMG_INTERIOR,
    },
  },
];
