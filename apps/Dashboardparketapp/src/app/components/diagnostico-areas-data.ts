/* ═══════════════════════════════════════════════════════════════════
   DIAGNOSTICO POR AREA — Dados estruturados das entrevistas reais
   Base: 10 entrevistas com lideres Parket Pisos (Mar/2026)
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Tipos ─── */
export interface EntregaItem {
  texto: string;
  tipo: "entrega" | "nao_entrega";
}

export interface DefeitoImperdoavel {
  texto: string;
  risco: "financeiro" | "reputacional" | "operacional" | "juridico";
}

export interface Gargalo {
  titulo: string;
  descricao: string;
  impacto: "critico" | "alto" | "medio";
  areaAfetada?: string;
}

export interface ProcessoReal {
  etapa: number;
  descricao: string;
  ferramenta?: string;
  responsavel?: string;
}

export interface Handoff {
  de: string;
  para: string;
  pacoteMinimo: string;
  oQueFalta: string;
  frequenciaProblema: "alta" | "media" | "baixa";
}

export interface RegraOperacional {
  regra: string;
  cumprida: "sim" | "parcial" | "nao";
  consequenciaDescumprimento: string;
}

export interface OportunidadeIA {
  descricao: string;
  tipo: "bloqueio" | "alerta" | "geracao" | "validacao";
  prioridade: "p0" | "p1" | "p2";
}

export interface MetricaSugerida {
  nome: string;
  tipo: "leading" | "lagging";
  formula?: string;
  meta90dias?: string;
}

export interface AreaDiagnostico {
  id: string;
  nome: string;
  lider: string;
  cargoLider: string;
  icon: string;
  cor: string;
  corDim: string;
  sistema: "receita" | "engenharia" | "operacao" | "estrutura";
  missao: string;
  entregas: EntregaItem[];
  defeitosImperdoaveis: DefeitoImperdoavel[];
  gargalos: Gargalo[];
  processoReal: ProcessoReal[];
  handoffs: Handoff[];
  regrasOperacionais: RegraOperacional[];
  oportunidadesIA: OportunidadeIA[];
  metricasSugeridas: MetricaSugerida[];
  cenarioIdeal: string;
  citacaoChave: string;
  scoreAtual: number; // 0-100
  scoreTrend: "subindo" | "estavel" | "caindo";
}

/* ═══════════════════════════════════════════════════════════════════
   DADOS DAS 10 AREAS ENTREVISTADAS
   ═══════════════════════════════════════════════════════════════════ */

export const areasDiagnostico: AreaDiagnostico[] = [

  /* ─── 1. GESTAO DE EQUIPES — DANY ─── */
  {
    id: "gestao-equipes",
    nome: "Gestao de Equipes de Obras",
    lider: "Dany",
    cargoLider: "Coordenadora de Equipes de Campo",
    icon: "🔨",
    cor: "#F87171",
    corDim: "rgba(248,113,113,0.15)",
    sistema: "operacao",
    missao: "Coordenacao ativa das equipes de campo (instalacao e marcenaria) para cumprimento do cronograma semanal.",
    entregas: [
      { texto: "Definicao de qual equipe executa cada servico (piso, forro, deck, marcenaria)", tipo: "entrega" },
      { texto: "Acompanhamento diario de execucao em campo", tipo: "entrega" },
      { texto: "Resolucao de emergencias em obra", tipo: "entrega" },
      { texto: "Fechamento do cronograma semanal toda quarta-feira", tipo: "entrega" },
      { texto: "Contato direto com cliente (responsabilidade de Talita)", tipo: "nao_entrega" },
      { texto: "Definicao de cronograma macro estrategico", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Equipe entrar em obra sem projeto aprovado", risco: "operacional" },
      { texto: "Equipe entrar em obra sem material entregue no local", risco: "financeiro" },
      { texto: "Equipe entrar em obra sem liberacao do fiscal", risco: "reputacional" },
    ],
    gargalos: [
      { titulo: "Telefone sem fio", descricao: "Contrato fechado cai no colo sem projeto, sem material ou sem vistoria, gerando equipes paradas e desgaste com cliente", impacto: "critico", areaAfetada: "Projetos, Compras, Fiscal" },
      { titulo: "Imprevistos climaticos e de obra", descricao: "Dependencia de chuva (atrasa deck), falta de eletrica/hidraulica (trava forro), mudancas de ideia do cliente durante instalacao", impacto: "alto" },
      { titulo: "Falta de insumos basicos", descricao: "Frequentemente faltam itens basicos de marcenaria (cola, parafusos, pivos), exigindo cobrancas constantes entre departamentos", impacto: "alto", areaAfetada: "Compras" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Recebe lista de obras para semana seguinte (toda quarta)", ferramenta: "WhatsApp" },
      { etapa: 2, descricao: "Verifica 3 pilares: projeto aprovado, material entregue, obra liberada pelo fiscal", ferramenta: "Manual" },
      { etapa: 3, descricao: "Define equipes por especialidade (piso, forro, deck, marcenaria)", responsavel: "Dany" },
      { etapa: 4, descricao: "Fecha cronograma semanal", ferramenta: "Excel/WhatsApp" },
      { etapa: 5, descricao: "Acompanha execucao diaria", ferramenta: "WhatsApp + Ligacoes" },
      { etapa: 6, descricao: "Resolve emergencias em tempo real", responsavel: "Dany" },
    ],
    handoffs: [
      { de: "Projetos (Thainara)", para: "Gestao Equipes (Dany)", pacoteMinimo: "Projeto executivo aprovado + cronograma de projetos", oQueFalta: "Projeto chega incompleto ou sem aprovacao do cliente", frequenciaProblema: "alta" },
      { de: "Compras (Ronaldo)", para: "Gestao Equipes (Dany)", pacoteMinimo: "Confirmacao de material comprado e data de entrega", oQueFalta: "Status de compra nao visivel, tem que perguntar individualmente", frequenciaProblema: "alta" },
      { de: "Fiscal (Felipe)", para: "Gestao Equipes (Dany)", pacoteMinimo: "Relatorio de liberacao com checklist aprovado", oQueFalta: "Vistoria sem pre-projeto, gerando vistorias inuteis", frequenciaProblema: "media" },
    ],
    regrasOperacionais: [
      { regra: "3 pilares obrigatorios para entrar em obra", cumprida: "parcial", consequenciaDescumprimento: "Equipes paradas, custo de improdutividade e desgaste com cliente" },
      { regra: "Cronograma fechado semanalmente na quarta", cumprida: "sim", consequenciaDescumprimento: "Equipes sem direcao, obras atrasam" },
      { regra: "Aviso antecipado ao cliente sobre alteracoes", cumprida: "nao", consequenciaDescumprimento: "Cliente pego de surpresa (ex: atraso por chuva), desgaste reputacional" },
    ],
    oportunidadesIA: [
      { descricao: "Dashboard de status em tempo real: material (comprado/em rota/entregue), projeto (pendente/aprovado), vistoria (agendada/aprovada)", tipo: "validacao", prioridade: "p0" },
      { descricao: "Alerta automatico quando 1 dos 3 pilares nao esta completo 48h antes do start", tipo: "alerta", prioridade: "p0" },
      { descricao: "Bloqueio de start sem os 3 pilares confirmados no sistema", tipo: "bloqueio", prioridade: "p1" },
    ],
    metricasSugeridas: [
      { nome: "% obras que iniciaram com 3 pilares completos", tipo: "leading", meta90dias: "> 90%" },
      { nome: "Horas de equipe parada por falta de condicao", tipo: "lagging", formula: "Soma horas improdutivas por bloqueio de frente", meta90dias: "< 5% do total" },
      { nome: "Obras entregues no prazo do cronograma semanal", tipo: "lagging", meta90dias: "> 80%" },
    ],
    cenarioIdeal: "Um sistema onde o status de cada item (comprado, em rota, entregue) seja visivel para todos, evitando a necessidade de perguntar individualmente a cada setor.",
    citacaoChave: "O setor de obras e o local onde os problemas (BOs) sao abracados e resolvidos.",
    scoreAtual: 62,
    scoreTrend: "estavel",
  },

  /* ─── 2. PROJETOS — THAINARA ─── */
  {
    id: "projetos",
    nome: "Coordenacao de Projetos",
    lider: "Thainara",
    cargoLider: "Coordenadora de Projetos",
    icon: "📐",
    cor: "#60A5FA",
    corDim: "rgba(96,165,250,0.15)",
    sistema: "engenharia",
    missao: "Gerenciar o fluxo de projetos, desde a organizacao pos-venda ate a liberacao para producao/instalacao. O departamento de projetos deve ditar o ritmo das demais areas.",
    entregas: [
      { texto: "Mapeamento de obras novas e cronograma de projetos", tipo: "entrega" },
      { texto: "Conferencia de arquivos tecnicos e pre-projeto", tipo: "entrega" },
      { texto: "Suporte a fiscais e fabrica com informacoes de projeto", tipo: "entrega" },
      { texto: "Verificacao diaria de Trello, WhatsApp e retornos de aprovacao", tipo: "entrega" },
      { texto: "Projetos executivos completos (responsabilidade de escritorio externo)", tipo: "nao_entrega" },
      { texto: "Gestao de producao", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Deixar passar informacoes tecnicas especificadas no projeto de arquitetura por falta de atencao", risco: "operacional" },
      { texto: "Confiar na memoria em vez de anotar todas as solicitacoes", risco: "operacional" },
      { texto: "Liberar obra para producao sem projeto executivo aprovado", risco: "financeiro" },
    ],
    gargalos: [
      { titulo: "Alta demanda vs prazos curtos", descricao: "Volume de projetos simultaneos excede capacidade da equipe, gerando correria e risco de erro", impacto: "critico" },
      { titulo: "Avisos em cima da hora", descricao: "Falta de antecipacao do setor de obras: avisos na sexta para comecar na segunda obrigam equipe a trabalhar fora do expediente", impacto: "critico", areaAfetada: "Obras" },
      { titulo: "Retornos lentos de aprovacao", descricao: "Arquitetura demora para aprovar e equipe fica travada esperando", impacto: "alto", areaAfetada: "Cliente/Arquiteto" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Recebe contrato fechado do comercial", ferramenta: "WhatsApp/Trello" },
      { etapa: 2, descricao: "Mapeia obras novas e analisa contratos", responsavel: "Thainara" },
      { etapa: 3, descricao: "Prepara pre-projeto (paginacao, alcapoes, cortineiros, grelhas, recortes)", responsavel: "Thainara" },
      { etapa: 4, descricao: "Envia pre-projeto para aprovacao da arquitetura", ferramenta: "E-mail/WhatsApp" },
      { etapa: 5, descricao: "Acompanha retornos de aprovacao diariamente", ferramenta: "Trello/WhatsApp" },
      { etapa: 6, descricao: "Distribui tarefas para equipe e organiza fila", responsavel: "Thainara" },
      { etapa: 7, descricao: "Libera projeto para compras/producao/fiscal", ferramenta: "WhatsApp" },
    ],
    handoffs: [
      { de: "Comercial", para: "Projetos (Thainara)", pacoteMinimo: "Contrato assinado + dados basicos do cliente + projeto de arquitetura", oQueFalta: "Dados basicos do cliente e definicoes da arquitetura no momento da solicitacao", frequenciaProblema: "alta" },
      { de: "Projetos (Thainara)", para: "Fiscal (Felipe)", pacoteMinimo: "Pre-projeto completo com todas as definicoes", oQueFalta: "Pre-projeto incompleto gera vistoria inutil", frequenciaProblema: "media" },
      { de: "Projetos (Thainara)", para: "Compras (Ronaldo)", pacoteMinimo: "Lista de insumos com especificacoes e quantidades", oQueFalta: "Lista chega atrasada ou incompleta", frequenciaProblema: "media" },
    ],
    regrasOperacionais: [
      { regra: "Sem projeto aprovado, nada avanca para producao ou instalacao", cumprida: "parcial", consequenciaDescumprimento: "Producao com versao errada, retrabalho caro" },
      { regra: "Todas as solicitacoes devem ser registradas (nao confiar na memoria)", cumprida: "parcial", consequenciaDescumprimento: "Informacoes se perdem, erros por esquecimento" },
      { regra: "Pre-projeto pronto antes de agendar vistoria", cumprida: "parcial", consequenciaDescumprimento: "Vistorias inuteis, custo de deslocamento extra" },
    ],
    oportunidadesIA: [
      { descricao: "Checklist automatico de pre-projeto: validar se todos os itens obrigatorios estao presentes antes de enviar", tipo: "validacao", prioridade: "p0" },
      { descricao: "Alerta de prazos: obra que vai iniciar em X dias sem projeto aprovado", tipo: "alerta", prioridade: "p0" },
      { descricao: "Geracao automatica de cronograma baseado em m2 e tipologia", tipo: "geracao", prioridade: "p1" },
    ],
    metricasSugeridas: [
      { nome: "Lead time medio: contrato → projeto aprovado", tipo: "lagging", meta90dias: "< 10 dias uteis" },
      { nome: "% projetos com pre-projeto completo antes da vistoria", tipo: "leading", meta90dias: "> 95%" },
      { nome: "Projetos com mais de 3 revisoes", tipo: "lagging", meta90dias: "< 10%" },
    ],
    cenarioIdeal: "Departamento de projetos ditando o ritmo. Nada avanca sem projeto aprovado. Alertas automaticos de prazo. Sistema unico de versoes.",
    citacaoChave: "Sem projeto aprovado, nada deve avancar para producao ou instalacao.",
    scoreAtual: 55,
    scoreTrend: "caindo",
  },

  /* ─── 3. ESTRATEGICO/CEO — PAMELLA ─── */
  {
    id: "estrategico",
    nome: "Estrategico e Gestao (CEO)",
    lider: "Pamella",
    cargoLider: "Co-CEO / Gestora 360",
    icon: "👑",
    cor: "#B8AA9A",
    corDim: "rgba(184,170,154,0.15)",
    sistema: "estrutura",
    missao: "Gestao 360 de todos os departamentos (RH, Financeiro, Logistica, Obras) para garantir o crescimento e a saude financeira da empresa.",
    entregas: [
      { texto: "Definicao de diretrizes estrategicas e OKRs", tipo: "entrega" },
      { texto: "Revisao e aprovacao de contratos relevantes", tipo: "entrega" },
      { texto: "Gestao tributaria (migracao para Lucro Real)", tipo: "entrega" },
      { texto: "Aprovacao de grandes investimentos e compras", tipo: "entrega" },
      { texto: "Autorizacao de contratacoes e demissoes", tipo: "entrega" },
      { texto: "Auditoria mensal de estoque", tipo: "entrega" },
      { texto: "Execucao operacional diaria (delegada aos lideres)", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Falta de visibilidade sobre status de projetos em andamento", risco: "financeiro" },
      { texto: "Decisoes de investimento sem dados de margem real", risco: "financeiro" },
      { texto: "Gargalos nao identificados que travam a operacao", risco: "operacional" },
    ],
    gargalos: [
      { titulo: "Liberacao do projeto executivo aprovado", descricao: "O maior entrave da empresa: se o fluxo de aprovacao de projeto trava, produção e instalacao param. E a dependencia master.", impacto: "critico", areaAfetada: "Projetos, Producao, Obras" },
      { titulo: "Falta de automacao de prazos", descricao: "Nao existem alertas automaticos para prazos criticos (5 dias para mapa de projeto, 10 dias para medicao)", impacto: "alto" },
      { titulo: "Cronograma de producao manual", descricao: "Nao existe sistema que gere cronogramas de producao automaticamente baseados em m2", impacto: "alto", areaAfetada: "Producao" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Acompanha todos os departamentos em tempo real", ferramenta: "WhatsApp + Reunioes" },
      { etapa: 2, descricao: "Define diretrizes estrategicas e prioridades", responsavel: "Pamella" },
      { etapa: 3, descricao: "Aprova contratacoes, demissoes e investimentos", responsavel: "Pamella" },
      { etapa: 4, descricao: "Revisa contratos e gestao tributaria", responsavel: "Pamella + Karla" },
      { etapa: 5, descricao: "Auditoria mensal de estoque e compras", responsavel: "Pamella" },
    ],
    handoffs: [
      { de: "Todos os departamentos", para: "CEO (Pamella)", pacoteMinimo: "Relatorio semanal com 5 numeros + 3 alertas + 1 pedido de decisao", oQueFalta: "Relatorios nao padronizados, informacao chega por WhatsApp fragmentada", frequenciaProblema: "alta" },
    ],
    regrasOperacionais: [
      { regra: "Alertas automaticos para prazos criticos", cumprida: "nao", consequenciaDescumprimento: "Gargalos so sao descobertos quando ja estao criticos" },
      { regra: "Relatorio semanal padronizado de cada area", cumprida: "nao", consequenciaDescumprimento: "Falta visibilidade, decisoes atrasam" },
    ],
    oportunidadesIA: [
      { descricao: "Cronograma de producao automatico baseado em m2 e tipologia", tipo: "geracao", prioridade: "p0" },
      { descricao: "Alertas automaticos de prazo: 5 dias para mapa, 10 dias para medicao, etc.", tipo: "alerta", prioridade: "p0" },
      { descricao: "Dashboard executivo consolidado com scores por area e obra", tipo: "geracao", prioridade: "p1" },
    ],
    metricasSugeridas: [
      { nome: "Lead time: contrato → projeto aprovado (gargalo master)", tipo: "leading", meta90dias: "< 10 dias" },
      { nome: "Margem real por obra vs orcada", tipo: "lagging", meta90dias: "Delta < 3pp" },
      { nome: "Score de saude operacional por departamento", tipo: "leading", meta90dias: "Nenhum dept score C ou D" },
    ],
    cenarioIdeal: "Sistema com alertas automaticos, cronogramas gerados por IA, dashboard executivo e relatorios padronizados de cada area.",
    citacaoChave: "O maior entrave e a liberacao do projeto executivo aprovado. Se este fluxo nao trava, a producao e a instalacao fluem.",
    scoreAtual: 75,
    scoreTrend: "estavel",
  },

  /* ─── 4. EXPEDICAO E LOGISTICA — AILTON ─── */
  {
    id: "expedicao-logistica",
    nome: "Expedicao e Logistica",
    lider: "Ailton",
    cargoLider: "Responsavel de Expedicao",
    icon: "📦",
    cor: "#FB923C",
    corDim: "rgba(251,146,60,0.15)",
    sistema: "operacao",
    missao: "Garantir que o material chegue ao destino final (cliente) com integridade e dentro do prazo estipulado.",
    entregas: [
      { texto: "Separacao de amostras e materiais por obra", tipo: "entrega" },
      { texto: "Logistica de transporte (proprio ou terceirizado)", tipo: "entrega" },
      { texto: "Acompanhamento ate o descarregamento final", tipo: "entrega" },
      { texto: "Conferencia item a item vs receita de bolo", tipo: "entrega" },
      { texto: "Registro fotografico de carregamento", tipo: "entrega" },
      { texto: "Leitura ou detalhamento de projetos tecnicos", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Falta de conferencia entre material vendido (contrato) e material separado para entrega", risco: "financeiro" },
      { texto: "Enviar material para endereco errado", risco: "financeiro" },
      { texto: "Material avariado por embalagem inadequada", risco: "reputacional" },
    ],
    gargalos: [
      { titulo: "Ruidos de comunicacao CWB ↔ SP", descricao: "Informacoes entre Curitiba e Sao Paulo se perdem ou chegam atrasadas. Expedicao nao sabe que projeto foi alterado e envia material antigo.", impacto: "critico", areaAfetada: "Projetos, Obras" },
      { titulo: "Dados de entrega incorretos", descricao: "Enderecos no sistema muitas vezes estao errados (escritorio em vez de obra), faltam informacoes sobre restricoes (elevador vs escada)", impacto: "alto", areaAfetada: "Comercial, Atendimento" },
      { titulo: "Processo manual de filtragem", descricao: "Toda terca-feira filtro manual no Excel de todos os contratos com previsao de entrega para semana seguinte", impacto: "medio" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Filtra contratos com previsao de entrega (toda terca)", ferramenta: "Excel" },
      { etapa: 2, descricao: "Separa material (Curitiba ou SP)", responsavel: "Ailton + equipe" },
      { etapa: 3, descricao: "Setor de obras confirma com cliente a disponibilidade", ferramenta: "WhatsApp" },
      { etapa: 4, descricao: "Confere item a item vs lista (receita de bolo)", responsavel: "Ailton" },
      { etapa: 5, descricao: "Fotografa carregamento", ferramenta: "Celular" },
      { etapa: 6, descricao: "Contrata frete (proprio ou terceiro)", responsavel: "Ailton" },
      { etapa: 7, descricao: "Acompanha ate descarregamento", ferramenta: "WhatsApp/Telefone" },
    ],
    handoffs: [
      { de: "Compras (Ronaldo)", para: "Expedicao (Ailton)", pacoteMinimo: "Lista de materiais com especificacoes, quantidades e datas", oQueFalta: "Lista incompleta ou atrasada", frequenciaProblema: "media" },
      { de: "Expedicao (Ailton)", para: "Obras (Dany)", pacoteMinimo: "Confirmacao de entrega com fotos + nota fiscal", oQueFalta: "Fotos de entrega nem sempre registradas", frequenciaProblema: "media" },
    ],
    regrasOperacionais: [
      { regra: "Conferencia 100% item a item antes de embarque", cumprida: "parcial", consequenciaDescumprimento: "Item errado ou faltando = frete extra = custo + atraso" },
      { regra: "Registro fotografico de saida e chegada", cumprida: "parcial", consequenciaDescumprimento: "Discussao sobre o que foi entregue, sem evidencia" },
      { regra: "Confirmacao de endereco e restricoes 1 semana antes", cumprida: "nao", consequenciaDescumprimento: "Entrega em endereco errado ou sem condicoes de descarga" },
    ],
    oportunidadesIA: [
      { descricao: "Sistema de checklist dinamico e etiquetas com QR code por obra/item", tipo: "validacao", prioridade: "p0" },
      { descricao: "Rastreamento tipo delivery: cliente e equipe acompanham entrega em tempo real", tipo: "geracao", prioridade: "p1" },
      { descricao: "Alerta automatico de alteracao de projeto que impacta material ja separado", tipo: "alerta", prioridade: "p0" },
    ],
    metricasSugeridas: [
      { nome: "OTIF (On Time In Full) de entregas", tipo: "lagging", formula: "Entregas no prazo e completas / total entregas", meta90dias: "> 95%" },
      { nome: "Entregas com divergencia (item errado/faltante)", tipo: "lagging", meta90dias: "< 2%" },
      { nome: "Fretes extras por falha de planejamento", tipo: "lagging", meta90dias: "< 1 por mes" },
    ],
    cenarioIdeal: "Sistema dinamico de checklist e etiquetas, permitindo que o cliente e a equipe acompanhem a entrega como em um aplicativo de delivery.",
    citacaoChave: "Muitas vezes a expedicao nao sabe que um projeto foi alterado e envia o material antigo.",
    scoreAtual: 70,
    scoreTrend: "estavel",
  },

  /* ─── 5. COMPRAS (MARCENARIA) — RONALDO ─── */
  {
    id: "compras",
    nome: "Compras (Marcenaria)",
    lider: "Ronaldo",
    cargoLider: "Gestor de Compras",
    icon: "🛒",
    cor: "#4ADE80",
    corDim: "rgba(74,222,128,0.15)",
    sistema: "operacao",
    missao: "Suprir a producao e as obras com insumos e materia-prima, otimizando custos e garantindo prazos.",
    entregas: [
      { texto: "Compra de MDF, ferragens, colas e insumos especificos por projeto", tipo: "entrega" },
      { texto: "Contratacao de fretes de carga", tipo: "entrega" },
      { texto: "Cotacao com multiplos fornecedores", tipo: "entrega" },
      { texto: "Negociacao direta com industrias (economia de ate 60%)", tipo: "entrega" },
      { texto: "Definicao de especificacoes tecnicas (responsabilidade de Projetos)", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Comprar itens sem justificativa tecnica ou aprovacao financeira", risco: "financeiro" },
      { texto: "Nao prever tempo de entrega de fornecedores especiais (ferragens sob medida)", risco: "operacional" },
      { texto: "Compra duplicada ou sem conferencia de estoque", risco: "financeiro" },
    ],
    gargalos: [
      { titulo: "Processo manual extremo", descricao: "Recebe listas por planilhas/WhatsApp, precisa limpar dados, orcar com multiplos fornecedores e lancar linha por linha no Brascomm. Burocracia consome tempo estrategico.", impacto: "critico" },
      { titulo: "Lista de insumos atrasada", descricao: "Falta de lista de insumos antecipada pelo setor de orcamento/projetos obriga compras de emergencia", impacto: "alto", areaAfetada: "Projetos, Orcamento" },
      { titulo: "Aprovacao financeira sexta-tarde", descricao: "Atrasos na aprovacao de pagamentos pelo financeiro na sexta para materiais urgentes de segunda, risco de parar fabrica", impacto: "critico", areaAfetada: "Financeiro" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Recebe lista de insumos de Projetos/Orcamento", ferramenta: "Planilha/WhatsApp" },
      { etapa: 2, descricao: "Limpa e organiza dados da lista", responsavel: "Ronaldo" },
      { etapa: 3, descricao: "Orca com multiplos fornecedores", ferramenta: "WhatsApp/E-mail" },
      { etapa: 4, descricao: "Negocia precos (acesso direto a industrias)", responsavel: "Ronaldo" },
      { etapa: 5, descricao: "Lanca linha por linha no sistema Brascomm", ferramenta: "Brascomm" },
      { etapa: 6, descricao: "Envia para aprovacao financeira", ferramenta: "Sistema" },
      { etapa: 7, descricao: "Efetua compra e acompanha entrega", responsavel: "Ronaldo" },
    ],
    handoffs: [
      { de: "Projetos/Orcamento", para: "Compras (Ronaldo)", pacoteMinimo: "Lista limpa de insumos com especificacoes, quantidades e data de necessidade", oQueFalta: "Lista suja, incompleta, sem especificacoes claras ou prazo", frequenciaProblema: "alta" },
      { de: "Compras (Ronaldo)", para: "Expedicao (Ailton)", pacoteMinimo: "Nota fiscal + previsao de chegada + especificacoes", oQueFalta: "Informacao de lead time nem sempre comunicada", frequenciaProblema: "media" },
    ],
    regrasOperacionais: [
      { regra: "Toda compra precisa de justificativa tecnica e aprovacao financeira", cumprida: "sim", consequenciaDescumprimento: "Compra sem controle = estouro de orcamento" },
      { regra: "Sistema deve agrupar pedidos por fornecedor", cumprida: "nao", consequenciaDescumprimento: "Tempo estrategico consumido em burocracia operacional" },
    ],
    oportunidadesIA: [
      { descricao: "Agrupamento automatico de pedidos por fornecedor no ERP", tipo: "geracao", prioridade: "p0" },
      { descricao: "Alerta de lead time critico: item com prazo > X dias dispara plano B", tipo: "alerta", prioridade: "p0" },
      { descricao: "Validacao automatica de lista de insumos (campos obrigatorios, quantidades, especificacoes)", tipo: "validacao", prioridade: "p1" },
    ],
    metricasSugeridas: [
      { nome: "Economia vs preco de mercado", tipo: "lagging", formula: "Preco pago vs preco tabela media", meta90dias: "Economia > 15%" },
      { nome: "Compras de emergencia por mes", tipo: "lagging", meta90dias: "< 5% do total" },
      { nome: "Lead time medio de fornecedores criticos", tipo: "leading", meta90dias: "Monitorar e reduzir 10%" },
    ],
    cenarioIdeal: "Sistema que agrupa pedidos por fornecedor, gera cotacoes automaticas, monitora lead times e dispara alertas de urgencia. Ronaldo foca em negociacao estrategica.",
    citacaoChave: "Consegui reduzir custos em ate 60% acessando industrias diretamente, mas a burocracia do sistema consome meu tempo estrategico.",
    scoreAtual: 72,
    scoreTrend: "estavel",
  },

  /* ─── 6. FISCAL / VISTORIA TECNICA — FELIPE ─── */
  {
    id: "fiscal",
    nome: "Fiscal / Vistoria Tecnica",
    lider: "Felipe",
    cargoLider: "Fiscal de Obras",
    icon: "🔍",
    cor: "#A78BFA",
    corDim: "rgba(167,139,250,0.15)",
    sistema: "engenharia",
    missao: "Garantir que a obra esteja tecnicamente apta (liberacao tecnica) para receber a instalacao. O fiscal e o olhar critico da Parket na obra.",
    entregas: [
      { texto: "Vistorias tecnicas iniciais e de liberacao", tipo: "entrega" },
      { texto: "Medicoes finas (validar metragens vendidas)", tipo: "entrega" },
      { texto: "Acompanhamento de execucao e qualidade", tipo: "entrega" },
      { texto: "Relatorios de conformidade", tipo: "entrega" },
      { texto: "Definicao de cronograma de equipes", tipo: "nao_entrega" },
      { texto: "Negociacao de valores de mao de obra", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Medicao equivocada (erro na metragem real vs vendida)", risco: "financeiro" },
      { texto: "Liberacao de obra sem condicoes ideais (contrapiso umido, sem eletrica/hidraulica)", risco: "operacional" },
      { texto: "Falta de olhar critico para avaliar qualidade do servico do terceiro", risco: "reputacional" },
    ],
    gargalos: [
      { titulo: "1 fiscal para muitas obras", descricao: "Gargalo de capacidade: 1 fiscal para 7+ obras simultaneas, vistoria se torna o bottleneck", impacto: "critico" },
      { titulo: "Vistoria sem pre-projeto", descricao: "Fiscal vai a obra sem pre-projeto em maos, gerando vistoria inutil que precisa ser repetida", impacto: "alto", areaAfetada: "Projetos" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Recebe agendamento de vistoria (1a ou liberacao)", ferramenta: "WhatsApp" },
      { etapa: 2, descricao: "1a Vistoria: medicao fina + checklist de preparacao do cliente", responsavel: "Felipe" },
      { etapa: 3, descricao: "Gera relatorio com pendencias e posta no grupo da obra", ferramenta: "WhatsApp + Pasta" },
      { etapa: 4, descricao: "2a Vistoria (liberacao): umidade, nivel, condicoes tecnicas", responsavel: "Felipe" },
      { etapa: 5, descricao: "Libera ou rejeita obra para inicio de instalacao", responsavel: "Felipe" },
      { etapa: 6, descricao: "Acompanha execucao e qualidade durante instalacao", responsavel: "Felipe" },
    ],
    handoffs: [
      { de: "Projetos (Thainara)", para: "Fiscal (Felipe)", pacoteMinimo: "Pre-projeto completo com definicoes tecnicas", oQueFalta: "Pre-projeto incompleto = vistoria inutil", frequenciaProblema: "media" },
      { de: "Fiscal (Felipe)", para: "Obras (Dany)", pacoteMinimo: "Relatorio de liberacao com checklist OK", oQueFalta: "Atraso na vistoria trava inicio", frequenciaProblema: "media" },
    ],
    regrasOperacionais: [
      { regra: "Fiscal so vai com pre-projeto em maos", cumprida: "parcial", consequenciaDescumprimento: "Vistoria inutil = custo extra de deslocamento" },
      { regra: "3 objetivos da 1a vistoria: metragem, condicoes, logistica", cumprida: "sim", consequenciaDescumprimento: "Surpresas em campo" },
      { regra: "Liberacao so com todas condicoes atendidas", cumprida: "parcial", consequenciaDescumprimento: "Obra entra sem condicoes = retrabalho e equipe parada" },
    ],
    oportunidadesIA: [
      { descricao: "Checklist digital de vistoria com foto obrigatoria por item", tipo: "validacao", prioridade: "p0" },
      { descricao: "Bloqueio de liberacao se itens criticos nao aprovados", tipo: "bloqueio", prioridade: "p0" },
      { descricao: "Alerta para coordenacao quando vistoria tem itens reprovados", tipo: "alerta", prioridade: "p1" },
    ],
    metricasSugeridas: [
      { nome: "Vistorias com pre-projeto completo", tipo: "leading", meta90dias: "> 100%" },
      { nome: "Obras liberadas sem todas condicoes", tipo: "lagging", meta90dias: "Zero" },
      { nome: "Erro de medicao vs vendido", tipo: "lagging", meta90dias: "< 2% de desvio" },
    ],
    cenarioIdeal: "Fiscal com checklist digital, bloqueio automatico de liberacao sem condicoes, e segundo fiscal contratado para desafogar capacidade.",
    citacaoChave: "O fiscal deve ser o olhar critico da Parket na obra, garantindo que o padrao de qualidade seja cumprido desde a base.",
    scoreAtual: 68,
    scoreTrend: "estavel",
  },

  /* ─── 7. ORCAMENTO E PROPOSTAS — RANIERI ─── */
  {
    id: "orcamento",
    nome: "Orcamento e Propostas",
    lider: "Ranieri",
    cargoLider: "Responsavel de Orcamentos",
    icon: "💰",
    cor: "#FBBF24",
    corDim: "rgba(251,191,36,0.15)",
    sistema: "receita",
    missao: "Entrega de propostas comerciais aprovadas com viabilidade tecnica e financeira.",
    entregas: [
      { texto: "Orcamentos detalhados por ambiente", tipo: "entrega" },
      { texto: "Definicao de materia-prima, ferragens e prazos de execucao", tipo: "entrega" },
      { texto: "Propostas com arquivo identificado (nome/versao) e lista de premissas", tipo: "entrega" },
      { texto: "Projetos executivos", tipo: "nao_entrega" },
      { texto: "Gestao de producao", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Orcamento abaixo da tabela fixa de precos (queima margem)", risco: "financeiro" },
      { texto: "Falta de informacoes sobre acabamentos e dimensoes no contrato", risco: "operacional" },
      { texto: "Prazos errados de producao prometidos ao cliente", risco: "reputacional" },
    ],
    gargalos: [
      { titulo: "Falta de dados basicos do cliente e arquitetura", descricao: "No momento da solicitacao do orcamento, faltam medidas e definicoes da arquitetura. Orcamento feito com incertezas gera prejuizo na execucao.", impacto: "critico", areaAfetada: "Comercial" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Recebe solicitacao de orcamento do comercial", ferramenta: "WhatsApp/E-mail" },
      { etapa: 2, descricao: "Analisa projeto (quando disponivel) e medidas", responsavel: "Ranieri" },
      { etapa: 3, descricao: "Define materia-prima, ferragens e prazo de execucao", responsavel: "Ranieri" },
      { etapa: 4, descricao: "Calcula orcamento detalhado por ambiente", ferramenta: "Planilha" },
      { etapa: 5, descricao: "Gera proposta com premissas (incluso/nao incluso/condicional)", responsavel: "Ranieri" },
      { etapa: 6, descricao: "Envia para comercial apresentar ao cliente", ferramenta: "PDF/E-mail" },
    ],
    handoffs: [
      { de: "Comercial", para: "Orcamento (Ranieri)", pacoteMinimo: "Dados do cliente, medidas, projeto da arquitetura, tipo de escopo", oQueFalta: "Dados basicos do cliente e definicoes da arquitetura", frequenciaProblema: "alta" },
      { de: "Orcamento (Ranieri)", para: "Comercial", pacoteMinimo: "Proposta versionada com premissas claras", oQueFalta: "Raramente falta, processo bem estruturado", frequenciaProblema: "baixa" },
    ],
    regrasOperacionais: [
      { regra: "Nunca orcar abaixo da tabela fixa de precos", cumprida: "sim", consequenciaDescumprimento: "Margem negativa, prejuizo por obra" },
      { regra: "Proposta deve ter premissas explicitas (incluso/excluso)", cumprida: "parcial", consequenciaDescumprimento: "Conflito de escopo pos-contrato" },
    ],
    oportunidadesIA: [
      { descricao: "Validacao automatica de proposta vs tabela de precos", tipo: "validacao", prioridade: "p0" },
      { descricao: "Geracao de proposta template com premissas padrao por tipologia", tipo: "geracao", prioridade: "p1" },
      { descricao: "Alerta quando orcamento recebe solicitacao sem campos minimos", tipo: "bloqueio", prioridade: "p1" },
    ],
    metricasSugeridas: [
      { nome: "Lead time: solicitacao → proposta enviada", tipo: "lagging", meta90dias: "< 3 dias uteis" },
      { nome: "Orcamentos com dados incompletos na entrada", tipo: "leading", meta90dias: "< 10%" },
      { nome: "Desvio: orcamento vs custo real executado", tipo: "lagging", meta90dias: "< 8%" },
    ],
    cenarioIdeal: "Comercial envia solicitacao com dados completos. Orcamento gera proposta padronizada com premissas claras. Sem orcamento no escuro.",
    citacaoChave: "Sem dados basicos, o orcamento e feito com incertezas que geram prejuizo na execucao.",
    scoreAtual: 78,
    scoreTrend: "estavel",
  },

  /* ─── 8. RELACIONAMENTO AO CLIENTE — TALITA ─── */
  {
    id: "relacionamento",
    nome: "Relacionamento ao Cliente",
    lider: "Talita",
    cargoLider: "Gestora de Relacionamento / CS",
    icon: "🤝",
    cor: "#F472B6",
    corDim: "rgba(244,114,182,0.15)",
    sistema: "receita",
    missao: "Manter a satisfacao e a seguranca do cliente atraves de comunicacao clara, rapida e verdadeira. Meta de retorno: 40 minutos.",
    entregas: [
      { texto: "Retornos sobre status de obra", tipo: "entrega" },
      { texto: "Solicitacao de insumos urgentes ao time", tipo: "entrega" },
      { texto: "Gestao de custos de viagem de equipes", tipo: "entrega" },
      { texto: "Confirmacao de entregas e agendamentos", tipo: "entrega" },
      { texto: "Onboarding do cliente (grupo, checklist, boas-vindas)", tipo: "entrega" },
      { texto: "Fechamento de cronograma (responsabilidade de Dany)", tipo: "nao_entrega" },
      { texto: "Aprovacao de reembolsos sem liberacao previa", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Passar informacoes erradas ao cliente", risco: "reputacional" },
      { texto: "Deixar grupos sem resposta por longo periodo", risco: "reputacional" },
      { texto: "Enviar material sem confirmacao de local seguro para armazenamento", risco: "financeiro" },
    ],
    gargalos: [
      { titulo: "Multiplas vozes no grupo", descricao: "Outros setores respondem diretamente no grupo do cliente sem alinhar com Talita, gerando confusao sobre quem e o responsavel", impacto: "alto", areaAfetada: "Todas as areas" },
      { titulo: "Informacao reativa em vez de proativa", descricao: "Falta de informacoes proativas obriga o cliente a cobrar a empresa, gerando desgaste", impacto: "alto" },
      { titulo: "Triangulo de comunicacao", descricao: "O triangulo entre Obras, Financeiro e funcionario causa desinformacao sobre pagamentos e solicitacoes", impacto: "medio", areaAfetada: "Obras, Financeiro" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Recebe contrato e faz onboarding (grupo + checklist + pasta)", responsavel: "Talita" },
      { etapa: 2, descricao: "Monitora grupos de obras diariamente", ferramenta: "WhatsApp" },
      { etapa: 3, descricao: "Responde clientes (meta 40 min)", responsavel: "Talita" },
      { etapa: 4, descricao: "Notifica atrasos e confirma enderecos", responsavel: "Talita" },
      { etapa: 5, descricao: "Gere custos de viagem e reembolsos de equipes", ferramenta: "Planilha" },
      { etapa: 6, descricao: "Filtra pre-liberacao antes de agendar 2a vistoria", responsavel: "Talita" },
      { etapa: 7, descricao: "Pos-venda: recebe chamados e encaminha para triagem", responsavel: "Talita" },
    ],
    handoffs: [
      { de: "Comercial", para: "Relacionamento (Talita)", pacoteMinimo: "Contrato + dados completos do cliente + stakeholders", oQueFalta: "Dados de contato incompletos, stakeholders nao identificados", frequenciaProblema: "media" },
      { de: "Relacionamento (Talita)", para: "Fiscal (Felipe)", pacoteMinimo: "Solicitacao de vistoria com checklist do cliente preenchido", oQueFalta: "Solicitacao sem filtro previo", frequenciaProblema: "baixa" },
    ],
    regrasOperacionais: [
      { regra: "Retorno ao cliente em ate 40 minutos", cumprida: "parcial", consequenciaDescumprimento: "Cliente cobra a empresa, desgaste reputacional" },
      { regra: "Apenas Talita fala com cliente no grupo (outros alinham antes)", cumprida: "nao", consequenciaDescumprimento: "Confusao, informacao conflitante, perda de controle" },
      { regra: "Onboarding completo (grupo + pasta + checklist) em D+2 do contrato", cumprida: "parcial", consequenciaDescumprimento: "Cliente sem norte, obra desorganizada desde o inicio" },
    ],
    oportunidadesIA: [
      { descricao: "Bot de status automatico no grupo: atualiza cliente sobre etapas sem precisar perguntar", tipo: "geracao", prioridade: "p0" },
      { descricao: "Alerta quando grupo fica sem resposta por mais de X horas", tipo: "alerta", prioridade: "p1" },
      { descricao: "Templates automaticos de comunicacao por cenario (atraso, mudanca, entrega)", tipo: "geracao", prioridade: "p1" },
    ],
    metricasSugeridas: [
      { nome: "Tempo medio de resposta ao cliente", tipo: "lagging", meta90dias: "< 40 min" },
      { nome: "NPS por obra entregue", tipo: "lagging", meta90dias: "> 9.0" },
      { nome: "% onboardings completos em D+2", tipo: "leading", meta90dias: "> 95%" },
    ],
    cenarioIdeal: "Cliente recebe atualizacoes proativas. Apenas 1 voz oficial no grupo. Bot de status automatico. Onboarding padrao sem falha.",
    citacaoChave: "Quando outros setores respondem diretamente no grupo sem alinhar, cria-se confusao no cliente sobre quem e o responsavel.",
    scoreAtual: 74,
    scoreTrend: "estavel",
  },

  /* ─── 9. OBRAS / PRODUTIVIDADE — NATALIA ─── */
  {
    id: "produtividade-obras",
    nome: "Planejamento e Produtividade (Obras)",
    lider: "Natalia Alves",
    cargoLider: "Gestora de Produtividade e Cronograma",
    icon: "📊",
    cor: "#2DD4BF",
    corDim: "rgba(45,212,191,0.15)",
    sistema: "operacao",
    missao: "Garantir a excelencia na entrega final com qualidade, dentro do prazo e sem custos excedentes por refugo de servico.",
    entregas: [
      { texto: "Pre-cronograma (estimativa de dias uteis)", tipo: "entrega" },
      { texto: "Cronograma final de instalacao (com datas)", tipo: "entrega" },
      { texto: "Monitoramento diario de produtividade (fotos/videos)", tipo: "entrega" },
      { texto: "Pagamento de terceiros com retencao 25%", tipo: "entrega" },
      { texto: "Termos de entrega por item", tipo: "entrega" },
      { texto: "Definicao de cronograma macro (estrategico)", tipo: "nao_entrega" },
      { texto: "Formalizacao de laudos tecnicos", tipo: "nao_entrega" },
      { texto: "Contato direto com cliente sem autorizacao", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Nao realizar a retencao de 25% no pagamento do prestador", risco: "financeiro" },
      { texto: "Pagar 100% do servico sem o termo de aceite assinado pelo cliente", risco: "financeiro" },
      { texto: "Negociar valores fora da tabela sem aprovacao previa da diretoria", risco: "financeiro" },
    ],
    gargalos: [
      { titulo: "Relatorios manuais (70+ obras)", descricao: "Acompanhamento de mais de 70 obras simultaneas e feito de forma manual no Excel e WhatsApp, processo lento e passivel de erros humanos", impacto: "critico" },
      { titulo: "Fotos sem qualidade tecnica", descricao: "Fotos enviadas pelas equipes nao tem qualidade suficiente para documentar produtividade", impacto: "medio" },
      { titulo: "Ocorrencias nao documentadas", descricao: "Ocorrencias em obra nao documentadas impactam o cronograma sem rastreabilidade", impacto: "alto" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Gera pre-cronograma com estimativa de dias uteis", responsavel: "Natalia" },
      { etapa: 2, descricao: "Recebe videos e fotos diarios de produtividade de cada obra", ferramenta: "WhatsApp" },
      { etapa: 3, descricao: "Avalia produtividade diaria por obra", ferramenta: "Excel" },
      { etapa: 4, descricao: "Documenta causa quando produtividade cai por culpa do cliente", responsavel: "Natalia" },
      { etapa: 5, descricao: "Gera cronograma final no dia do start/entrega de material", responsavel: "Natalia" },
      { etapa: 6, descricao: "Processa pagamento quinzenal com retencao 25%", ferramenta: "Planilha" },
      { etapa: 7, descricao: "Libera retencao por item apos assinatura do termo de aceite", responsavel: "Natalia" },
    ],
    handoffs: [
      { de: "Obras (Dany)", para: "Produtividade (Natalia)", pacoteMinimo: "Start confirmado + equipe designada + obra classificada por complexidade", oQueFalta: "Classificacao de complexidade nem sempre feita", frequenciaProblema: "media" },
      { de: "Produtividade (Natalia)", para: "Financeiro", pacoteMinimo: "Planilha de pagamento com retencao + termos de aceite", oQueFalta: "Termos de aceite atrasados", frequenciaProblema: "media" },
    ],
    regrasOperacionais: [
      { regra: "Retencao obrigatoria de 25% no pagamento de prestadores", cumprida: "sim", consequenciaDescumprimento: "Perde poder de correcao, prestador some sem finalizar" },
      { regra: "Pagamento total somente apos termo de aceite assinado", cumprida: "sim", consequenciaDescumprimento: "Discussao infinita sobre qualidade sem evidencia" },
      { regra: "Cronograma final so no dia do start ou entrega de material", cumprida: "sim", consequenciaDescumprimento: "Promessas impossiveis de prazo" },
      { regra: "Diario de obra obrigatorio com fotos", cumprida: "parcial", consequenciaDescumprimento: "Dia sem registro = dia que nao existe" },
    ],
    oportunidadesIA: [
      { descricao: "Dashboard de produtividade em tempo real: m2/dia por equipe por obra", tipo: "geracao", prioridade: "p0" },
      { descricao: "Alerta automatico quando produtividade cai abaixo do threshold", tipo: "alerta", prioridade: "p0" },
      { descricao: "Geracao automatica de relatorio semanal consolidado", tipo: "geracao", prioridade: "p1" },
    ],
    metricasSugeridas: [
      { nome: "m2 instalado por dia por equipe", tipo: "lagging", meta90dias: "Benchmark por tipologia" },
      { nome: "% dias com diario completo", tipo: "leading", meta90dias: "> 95%" },
      { nome: "Custo de retrabalho por obra", tipo: "lagging", meta90dias: "< 3% do custo total" },
    ],
    cenarioIdeal: "Sistema digital de apontamento diario com fotos geolocalizadas. Dashboard automatico de produtividade. Pagamentos automatizados com retencao.",
    citacaoChave: "O acompanhamento de mais de 70 obras simultaneas e feito de forma manual no Excel e WhatsApp.",
    scoreAtual: 65,
    scoreTrend: "estavel",
  },

  /* ─── 10. RH — TALICIA ─── */
  {
    id: "rh",
    nome: "Recursos Humanos",
    lider: "Talicia",
    cargoLider: "Gestora de RH",
    icon: "👥",
    cor: "#818CF8",
    corDim: "rgba(129,140,248,0.15)",
    sistema: "estrutura",
    missao: "Gestao de admissoes, beneficios e jornada de colaboradores, garantindo o cumprimento de prazos legais e administrativos.",
    entregas: [
      { texto: "Processo de admissao (documentacao, exame, infraestrutura)", tipo: "entrega" },
      { texto: "Gestao de beneficios e folha", tipo: "entrega" },
      { texto: "Controle de contratos de experiencia e prazos legais", tipo: "entrega" },
      { texto: "Decisoes de contratacao/demissao (responsabilidade da diretoria)", tipo: "nao_entrega" },
    ],
    defeitosImperdoaveis: [
      { texto: "Funcionario comecando sem exame admissional realizado", risco: "juridico" },
      { texto: "Perder prazo de vencimento de contrato de experiencia", risco: "juridico" },
      { texto: "Funcionario sem infraestrutura no primeiro dia (sem computador)", risco: "operacional" },
    ],
    gargalos: [
      { titulo: "Contratacoes de ultima hora", descricao: "Contratacoes urgentes impedem realizacao de exames admissionais e preparacao de infraestrutura. Funcionario chega sem computador no primeiro dia.", impacto: "critico", areaAfetada: "Todas as areas" },
      { titulo: "Falta de alertas de vencimento", descricao: "Nao existe sistema de alertas para vencimento de contratos de experiencia, aviso previo e datas de pagamento de beneficios", impacto: "alto" },
      { titulo: "Triangulo de comunicacao", descricao: "O triangulo entre Obras, Financeiro e funcionario causa desinformacao sobre pagamentos de passagens e diarias", impacto: "medio", areaAfetada: "Obras, Financeiro" },
    ],
    processoReal: [
      { etapa: 1, descricao: "Recebe solicitacao de contratacao da diretoria", ferramenta: "WhatsApp/Reuniao" },
      { etapa: 2, descricao: "Providencia documentacao e agendamento de exame admissional", responsavel: "Talicia" },
      { etapa: 3, descricao: "Prepara infraestrutura (computador, acesso, materiais)", responsavel: "Talicia + TI" },
      { etapa: 4, descricao: "Realiza onboarding do novo colaborador", responsavel: "Talicia" },
      { etapa: 5, descricao: "Gerencia beneficios e folha mensalmente", ferramenta: "Sistema" },
      { etapa: 6, descricao: "Monitora prazos de experiencia e renovacoes", ferramenta: "Planilha" },
    ],
    handoffs: [
      { de: "Diretoria", para: "RH (Talicia)", pacoteMinimo: "Solicitacao com antecedencia minima de 7 dias uteis, cargo, perfil, area", oQueFalta: "Solicitacao de ultima hora, sem tempo para processo completo", frequenciaProblema: "alta" },
    ],
    regrasOperacionais: [
      { regra: "Minimo 7 dias uteis de antecedencia para contratacao", cumprida: "nao", consequenciaDescumprimento: "Funcionario sem exame, sem computador, sem acesso" },
      { regra: "Alertas de vencimento de contrato 30 dias antes", cumprida: "nao", consequenciaDescumprimento: "Risco juridico, multas trabalhistas" },
    ],
    oportunidadesIA: [
      { descricao: "Sistema de alertas automaticos: vencimento de experiencia, aviso previo, beneficios", tipo: "alerta", prioridade: "p0" },
      { descricao: "Checklist de onboarding automatizado com cobranca de itens pendentes", tipo: "validacao", prioridade: "p1" },
      { descricao: "Dashboard de RH: headcount, turnover, prazos legais", tipo: "geracao", prioridade: "p2" },
    ],
    metricasSugeridas: [
      { nome: "% contratacoes com antecedencia >= 7 dias", tipo: "leading", meta90dias: "> 80%" },
      { nome: "Prazos legais cumpridos (experiencia, aviso)", tipo: "lagging", meta90dias: "100%" },
      { nome: "Turnover mensal", tipo: "lagging", meta90dias: "< 5%" },
    ],
    cenarioIdeal: "Alertas automaticos de prazos, onboarding padronizado, infraestrutura pronta no dia 1. Zero contratacao sem exame admissional.",
    citacaoChave: "Contratacoes de ultima hora geram falta de infraestrutura — funcionario sem computador no primeiro dia.",
    scoreAtual: 58,
    scoreTrend: "caindo",
  },
];

/* ═══════════════════════════════════════════════════════════════════
   MAPA DE DEPENDENCIAS ENTRE AREAS (Gargalo Master identificado)
   ═══════════════════════════════════════════════════════════════════ */

export interface DependenciaCritica {
  id: string;
  de: string;
  para: string;
  descricao: string;
  impactoEmCadeia: string[];
  nivelRisco: "critico" | "alto" | "medio";
}

export const dependenciasCriticas: DependenciaCritica[] = [
  {
    id: "dep-01",
    de: "Comercial",
    para: "Projetos (Thainara)",
    descricao: "Dados incompletos do cliente e arquitetura ao fechar contrato",
    impactoEmCadeia: ["Orcamento no escuro (Ranieri)", "Pre-projeto incompleto (Thainara)", "Vistoria inutil (Felipe)"],
    nivelRisco: "critico",
  },
  {
    id: "dep-02",
    de: "Projetos (Thainara)",
    para: "Todas as areas downstream",
    descricao: "GARGALO MASTER: Liberacao do projeto executivo aprovado trava toda a cadeia",
    impactoEmCadeia: ["Compras atrasam (Ronaldo)", "Producao para (fabrica)", "Expedicao sem material (Ailton)", "Equipes paradas (Dany)", "Cliente cobra (Talita)"],
    nivelRisco: "critico",
  },
  {
    id: "dep-03",
    de: "Compras (Ronaldo)",
    para: "Expedicao (Ailton) e Obras (Dany)",
    descricao: "Aprovacao financeira sexta-tarde para material urgente de segunda",
    impactoEmCadeia: ["Fabrica para", "Material nao entregue", "Equipe parada em obra"],
    nivelRisco: "alto",
  },
  {
    id: "dep-04",
    de: "Fiscal (Felipe)",
    para: "Obras (Dany)",
    descricao: "1 fiscal para 7+ obras gera gargalo de vistoria",
    impactoEmCadeia: ["Obras nao liberam no prazo", "Equipes paradas aguardando liberacao"],
    nivelRisco: "alto",
  },
  {
    id: "dep-05",
    de: "Obras/Financeiro",
    para: "RH (Talicia)",
    descricao: "Triangulo de comunicacao sobre pagamentos e diarias",
    impactoEmCadeia: ["Funcionario desinformado", "Passagens e diarias atrasam"],
    nivelRisco: "medio",
  },
];

/* ═══════════════════════════════════════════════════════════════════
   RESUMO EXECUTIVO — para dashboard e slides
   ═══════════════════════════════════════════════════════════════════ */

export const resumoExecutivo = {
  totalEntrevistados: 10,
  totalGargalos: 22,
  gargalosCriticos: 9,
  defeitosImperdoaveis: 27,
  oportunidadesIA: 30,
  oportunidadesP0: 15,
  gargaloMaster: "Liberacao do projeto executivo aprovado — se trava, toda a cadeia para (Pamella, Thainara, Dany confirmam)",
  top5AcoesImediatas: [
    { acao: "Dashboard de status em tempo real (3 pilares: projeto, material, vistoria)", responsavel: "TI + Dany", prazo: "30 dias", impacto: "Elimina telefone sem fio entre areas" },
    { acao: "Alertas automaticos de prazo critico (projeto, vistoria, compras)", responsavel: "TI + Pamella", prazo: "30 dias", impacto: "Gargalos descobertos antes de virarem crise" },
    { acao: "Contratar 2o fiscal de obras", responsavel: "RH (Talicia) + Pamella", prazo: "15 dias", impacto: "Desafoga Felipe, acelera liberacoes" },
    { acao: "Checklist digital de vistoria com foto obrigatoria", responsavel: "TI + Felipe", prazo: "30 dias", impacto: "Zero liberacao sem condicoes" },
    { acao: "Sistema de agrupamento de compras por fornecedor", responsavel: "TI + Ronaldo", prazo: "60 dias", impacto: "Libera tempo estrategico de Ronaldo" },
  ],
  scoreGeralOperacao: 68,
  sistemasOperacionais: {
    receita: { score: 76, areas: ["Orcamento (Ranieri)", "Relacionamento (Talita)"] },
    engenharia: { score: 62, areas: ["Projetos (Thainara)", "Fiscal (Felipe)"] },
    operacao: { score: 67, areas: ["Gestao Equipes (Dany)", "Expedicao (Ailton)", "Compras (Ronaldo)", "Produtividade (Natalia)"] },
    estrutura: { score: 67, areas: ["CEO (Pamella)", "RH (Talicia)"] },
  },
};
