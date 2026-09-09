/** Catálogo de definições técnicas por serviço — Guia 1 (Google Doc do Will).
 *  Cada serviço agrupa definições OBRIGATÓRIAS (marcadas [#] no Doc) e
 *  ESSENCIAIS (aditivos e refinamentos). Os itens de "Pré projeto — Obra"
 *  do Doc não entram: são responsabilidade da obra, não do cliente.
 *  Imagens: /definicoes/tec/<img>.webp (pranchas do DXF). */

export type OpcaoDef = {
  id: string; nome: string; desc: string; texto?: string; titulo?: string;
  img?: string; cota?: number;
  /** Definição válida mas sem prancha técnica ainda desenhada. UI
   *  renderiza card informativo "Detalhe em desenvolvimento" no lugar
   *  da imagem. Fluxo com o cliente segue normal — a definição existe. */
  emDesenvolvimento?: boolean;
};

/* Camada da seção (usada pela pilha visual do piso/deck): assoalho → mexe
 * na régua; entre → estrutura entre base e assoalho; encontro → borda. */
export type Camada = "assoalho" | "entre" | "encontro";

export type CampoDef = {
  id: string; rotulo: string;
  tipo: "medida" | "texto" | "opcao-curta";
  unidade?: string; sugestoes?: number[]; valores?: string[]; placeholder?: string;
};

/* Sugestão cruzada: quando o cliente escolhe uma opção num serviço, a UI
 * destaca em outro serviço a opção que casa. Sugestão, nunca bloqueio —
 * detalhes podem ser diferentes de propósito. */
export type Servico = "PISO" | "DECK" | "FORRO" | "PAINEL";
export type SugestaoCruzada = {
  servico: Servico;
  definicao: string;              // id da definição no serviço destino
  opcao?: string;                 // id da opção destacada (opcional)
  quandoOpcao?: string | string[]; // gatilho: opcao(ões) que ativam a sugestão
  motivo: string;                 // texto explicativo pro banner
};

export type DefinicaoDef = {
  id: string; nome: string; pergunta?: string; nota?: string;
  tipo: "opcao" | "multi" | "sim-nao" | "texto-longo" | "transicoes";
  obrigatorio?: boolean;
  categoria?: "obrigatorio" | "essencial";
  recusa?: string; aditivo?: boolean;
  opcoes?: OpcaoDef[]; campos?: CampoDef[]; placeholder?: string;
  camada?: Camada; notaPilha?: string;
  sugestoesCruzadas?: SugestaoCruzada[];
};

/* ── PISO ────────────────────────────────────────────────────────────
 * Doc §2 (Projeto) + §3 (Acabamentos). Obrigatórios [#] do Doc:
 * 2.1 paginação, 2.2 instalação, 2.3 partida, 2.6 transições,
 * 2.7 alinhamento, 3.1 rodapé. */
export const DEF_PISO: DefinicaoDef[] = [
  { id: "paginacao", nome: "Paginação",
    pergunta: "Qual o desenho do piso neste ambiente?",
    nota: "A paginação é por ambiente: a sala pode ser chevron e o closet reto. Ela decide o corte, a perda de material e o ponto de partida.",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "2.1.1", nome: "Reta", img: "reta",
        titulo: "A régua corre num sentido só",
        desc: "A régua corre num sentido só.",
        texto: "É a paginação que menos desperdiça — e a que mais depende de um bom ponto de início." },
      { id: "2.1.2", nome: "Chevron", img: "chevron",
        titulo: "O desenho vem do corte em ângulo",
        desc: "Réguas cortadas em ângulo, ponta com ponta.",
        texto: "As réguas são usinadas em ângulo e se encontram numa linha contínua. O desenho vem do corte — e a perda de material é maior que na reta." },
      { id: "2.1.3", nome: "Espinha de peixe", img: "espinha-de-peixe",
        titulo: "O desenho nasce do encaixe, não do corte",
        desc: "O desenho nasce do encaixe, não do corte.",
        texto: "As réguas continuam retas e se encostam a 90°. O padrão vem da posição, não da usinagem." },
      { id: "2.1.4", nome: "Tabeira", img: "tabeira",
        titulo: "Uma moldura contorna o ambiente",
        desc: "Uma moldura contorna o ambiente.",
        texto: "O campo corre por dentro e a tabeira fecha o perímetro. Ela é sempre a última a ser assentada." },
      { id: "2.1.5", nome: "Versailles", img: "versailles",
        titulo: "O painel se repete como um módulo",
        desc: "O painel se repete como um módulo.",
        texto: "Cada quadro é montado antes de descer ao contrapiso. A paginação parte do centro do ambiente." },
      { id: "2.1.6", nome: "Wood + marble", img: "wood-marble",
        titulo: "O mármore entra como parte da paginação",
        desc: "O mármore entra como parte da paginação.",
        texto: "A pedra é embutida na própria régua. Exige usinagem por peça e paginação fechada antes do corte." },
    ] },

  /* Detalhe único do Doc §2.2. */
  { id: "instalacao", nome: "Sistema de instalação",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "2.2", nome: "Sistema de instalação", img: "sistema-instalacao", desc: "" },
    ] },

  { id: "transicoes", nome: "Transição de piso",
    pergunta: "Como o piso encontra o piso vizinho?",
    nota: "Cada encontro tem a sua própria solução — um ambiente pode ter várias.",
    tipo: "multi", obrigatorio: true, categoria: "obrigatorio",
    camada: "encontro", notaPilha: "A borda onde o assoalho topa com outro piso.",
    opcoes: [
      { id: "2.6.1", nome: "Baguete", img: "transicao-baguete",
        desc: "Baguete de madeira em nível." },
      { id: "2.6.2", nome: "Baguete em desnível", img: "transicao-baguete-desnivel",
        desc: "Baguete de madeira em desnível." },
      { id: "2.6.3", nome: "Perfil metálico", img: "transicao-perfil",
        desc: "Perfil metálico em nível." },
      { id: "2.6.4", nome: "Perfil metálico em desnível", img: "transicao-perfil-desnivel",
        desc: "Perfil metálico em desnível." },
      { id: "2.6.5", nome: "Junta seca", img: "transicao-junta-seca",
        desc: "Sem peça de transição — só a folga." },
      { id: "2.6.6", nome: "Soleira", img: "transicao-soleira",
        desc: "Soleira em nível." },
      { id: "2.6.7", nome: "Soleira em desnível", img: "transicao-soleira-desnivel",
        desc: "Soleira absorve a diferença de cota." },
      { id: "2.6.8", nome: "Soleira madeira + piso frio", img: "transicao-soleira-madeira-frio",
        desc: "Soleira de madeira contra piso frio (porcelanato, pedra)." },
      { id: "2.6.9", nome: "Soleira madeira + piso madeira", img: "transicao-soleira-madeira-madeira",
        desc: "Soleira de madeira entre dois pisos de madeira." },
    ] },

  { id: "alinhamento", nome: "Alinhamento de transição",
    pergunta: "Onde a transição cai no vão da porta?",
    nota: "Junta no eixo esconde melhor a peça; na face acompanha o batente.",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    camada: "encontro", notaPilha: "Posição da junta dentro do vão da porta.",
    opcoes: [
      { id: "2.7.1", nome: "No eixo da porta", img: "alinhamento-eixo",
        desc: "Junta no eixo da folha." },
      { id: "2.7.2", nome: "Na face da porta", img: "alinhamento-face",
        desc: "Junta na face do batente." },
      { id: "2.7.3", nome: "Na face, em desnível", img: "alinhamento-face-desnivel",
        desc: "Junta na face, em desnível." },
    ] },

  { id: "rodape", nome: "Rodapé",
    pergunta: "Como o piso encontra a parede?",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    camada: "encontro", notaPilha: "O encontro do piso com a parede.",
    opcoes: [
      { id: "3.1.1", nome: "Invertido (metálico)", img: "rodape-invertido",
        titulo: "A parede desce até o piso",
        desc: "Perfil embutido na parede.",
        texto: "O perfil metálico é embutido na alvenaria e o assoalho encosta nele. Não há rodapé para ver: a parede chega ao chão numa linha só." },
      { id: "3.1.2", nome: "Cordão de madeira", img: "rodape-cordao",
        titulo: "Uma seção mínima encosta na parede",
        desc: "Seção reduzida, sobreposta.",
        texto: "Rodapé Parket de seção reduzida, apoiado sobre o assoalho. Resolve a folga de dilatação com o mínimo de presença." },
      { id: "3.1.3", nome: "Embutido com perfil metálico", img: "rodape-embutido",
        titulo: "O perfil metálico embute o rodapé na parede",
        desc: "Perfil metálico embutido na alvenaria.",
        texto: "O perfil embutido cria uma junta metálica horizontal contra o assoalho — resolve dilatação e mantém a parede visualmente contínua até o piso." },
      { id: "3.1.4", nome: "Invertido com iluminação", img: "rodape-invertido-iluminacao",
        titulo: "O rodapé invertido esconde a linha de luz",
        desc: "Perfil embutido com fita LED.",
        texto: "O perfil metálico ganha um recorte pra fita LED. A luz corre rente ao piso, sem que o rodapé apareça — banho de luz indireto no assoalho." },
      { id: "3.1.5", nome: "Invertido em painel", img: "rodape-invertido-painel",
        titulo: "O rodapé invertido se apoia no painel de madeira",
        desc: "Painel arremata contra o piso.",
        texto: "Quando o painel de madeira desce até o piso, o rodapé invertido se apoia no painel, não na alvenaria. A junta fica coordenada com a paginação do painel." },
    ],
    campos: [
      { id: "altura", rotulo: "Altura", tipo: "medida", unidade: "mm", sugestoes: [70, 100, 150, 200] },
      { id: "espessura", rotulo: "Espessura", tipo: "medida", unidade: "mm", sugestoes: [10, 15, 20] },
      { id: "acabamento", rotulo: "Acabamento", tipo: "texto", placeholder: "mesma madeira, laca branca…" },
    ] },

  /* ── PISO essenciais (aditivos e refinamentos) ────────────────────── */
  { id: "elevado", nome: "Piso elevado",
    pergunta: "O piso sobe da laje?",
    tipo: "opcao", recusa: "Não quero piso elevado", aditivo: true,
    categoria: "essencial",
    camada: "entre", notaPilha: "Entra uma estrutura entre o contrapiso e o assoalho.",
    opcoes: [
      { id: "2.4.1", nome: "Com barrote", img: "elevado-barrote", cota: 70,
        titulo: "O barrote levanta o piso numa altura fixa",
        desc: "Altura fixa, definida pelo barrote.",
        texto: "Barrote de 4,5 × 2,5 cm entre o contrapiso e o assoalho, servindo de fixação para os painéis. Ganha altura constante e abre o vão para passagem de instalação.",
        emDesenvolvimento: true },
      { id: "2.4.2", nome: "Com estrutura metálica", img: "elevado-metalica", cota: 45,
        titulo: "O suporte telescópico regula ponto a ponto",
        desc: "Altura regulável em cada apoio.",
        texto: "Cada apoio é ajustável em altura. Resolve desnível grande e contrapiso fora de nível sem depender da regularização — o acerto é feito no próprio suporte.",
        emDesenvolvimento: true },
    ] },

  { id: "aquecido", nome: "Piso aquecido",
    pergunta: "Vai ter piso aquecido?",
    tipo: "sim-nao", recusa: "Não quero piso aquecido", aditivo: true,
    categoria: "essencial",
    camada: "entre", notaPilha: "A tubulação ocupa a faixa entre o contrapiso e a cola.",
    opcoes: [
      { id: "2.5", nome: "Tubulação aquecida", img: "aquecido", cota: 12,
        titulo: "O calor sobe por contato, através da régua",
        desc: "O calor sobe por contato, através da régua.",
        texto: "A tubulação corre em manta ou dentro do próprio contrapiso, logo abaixo da cola. Como o calor atravessa a madeira, espessura e espécie deixam de ser só estética e entram na conta térmica.",
        emDesenvolvimento: true },
    ] },

  { id: "recortes", nome: "Recortes",
    pergunta: "O que interrompe o piso neste ambiente?",
    tipo: "multi", recusa: "Sem recorte", aditivo: true,
    categoria: "essencial",
    camada: "assoalho", notaPilha: "Aberturas feitas no próprio assoalho.",
    opcoes: [
      { id: "3.2.1", nome: "Tomada", img: "recorte-tomada",
        titulo: "A tomada de piso some quando não está em uso",
        desc: "Tampa em assoalho chanfrado.",
        texto: "Perfil metálico em L e caixa fornecidos pela obra; a tampa é de assoalho chanfrado e sai inteira. Fechada, ela devolve o desenho da paginação.",
        emDesenvolvimento: true },
      { id: "3.2.2", nome: "Ralo", img: "recorte-ralo",
        titulo: "O acesso continua, o desenho não quebra",
        desc: "Tampa removível sobre o ralo.",
        texto: "Tampa removível em assoalho sobre o ralo. A manutenção segue possível sem que o piso ganhe uma peça estranha no meio.",
        emDesenvolvimento: true },
    ] },

  { id: "entretrilho", nome: "Entretrilho",
    pergunta: "Há trilho embutido no contrapiso?",
    tipo: "sim-nao", recusa: "Não quero entretrilho",
    categoria: "essencial",
    camada: "encontro", notaPilha: "O vão dos trilhos embutidos.",
    opcoes: [
      { id: "3.3", nome: "Trilho oculto", img: "entretrilho",
        titulo: "O piso corre por baixo das portas",
        desc: "O piso corre por baixo das portas.",
        texto: "Peças entre-trilho preenchem os vãos entre os trilhos embutidos no contrapiso. Com as portas abertas, o assoalho atravessa o vão sem interrupção.",
        emDesenvolvimento: true },
    ] },

  { id: "encontros", nome: "Encontros",
    pergunta: "O piso encontra outro plano de madeira?",
    tipo: "multi", recusa: "Sem encontros especiais",
    categoria: "essencial",
    camada: "encontro",
    opcoes: [
      { id: "3.4.1", nome: "Com forro de madeira", img: "piso-encontro-forro",
        desc: "Piso e forro se encontram alinhados.",
        emDesenvolvimento: true },
      { id: "3.4.2", nome: "Com guarda-corpo", img: "piso-encontro-guarda-corpo",
        desc: "O piso arremata contra o guarda-corpo.",
        emDesenvolvimento: true },
    ],
    sugestoesCruzadas: [
      { servico: "FORRO", definicao: "encontros", opcao: "9.13.1",
        quandoOpcao: "3.4.1",
        motivo: "Considere marcar o mesmo detalhe no FORRO (Encontro com o piso de madeira) para o desenho casar em obra." },
    ] },

];

/* ── DECK ────────────────────────────────────────────────────────────
 * Doc §5 (Projeto) + §6 (Acabamentos). Obrigatórios [#] do Doc:
 * 5.1 sentido, 5.2 instalação, 5.3 partida, 5.5 transição. */
export const DEF_DECK: DefinicaoDef[] = [
  /* Detalhes únicos do Doc §5.1, §5.2, §5.3. */
  { id: "sentido", nome: "Sentido de paginação",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "5.1", nome: "Sentido de paginação", img: "deck-sentido-paginacao", desc: "" },
    ] },

  { id: "instalacao", nome: "Sistema de instalação",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "5.2", nome: "Sistema de instalação", img: "deck-sistema-instalacao", desc: "" },
    ] },

  { id: "transicao", nome: "Transição de piso",
    pergunta: "Como o deck encontra outro piso?",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    recusa: "Sem transição",
    camada: "encontro", notaPilha: "A borda onde o deck topa com outro piso.",
    opcoes: [
      { id: "5.5", nome: "Perfil de transição", img: "deck-transicao",
        titulo: "Perfil resolve a diferença de cota",
        desc: "Arremate entre o deck e o piso vizinho.",
        texto: "Perfil metálico ou baguete de madeira faz a transição entre o deck e o piso vizinho, absorvendo a folga de dilatação e a diferença de cota." },
    ] },

  /* ── DECK essenciais ─────────────────────────────────────────────── */
  { id: "elevado", nome: "Deck elevado",
    pergunta: "O deck sobe da base?",
    tipo: "opcao", recusa: "Deck direto sobre a base", aditivo: true,
    categoria: "essencial",
    camada: "entre", notaPilha: "Estrutura entre a base e o assoalho do deck.",
    opcoes: [
      { id: "5.4.1", nome: "Com barrote", img: "deck-elevado-barrote", cota: 70,
        titulo: "Barrote levanta o deck numa altura fixa",
        desc: "Altura fixa, definida pelo barrote.",
        texto: "Barrote fixado à base recebe o assoalho do deck. Ganha altura constante, cria vão para drenagem e passagem de instalação." },
      { id: "5.4.2", nome: "Com estrutura metálica", img: "deck-elevado-metalica", cota: 45,
        titulo: "Suporte telescópico regula ponto a ponto",
        desc: "Altura regulável em cada apoio.",
        texto: "Cada apoio é ajustável em altura. Resolve desnível grande e base fora de nível sem depender de regularização do contrapiso." },
    ] },

  { id: "borda", nome: "Borda",
    pergunta: "Como fecha a borda do deck?",
    tipo: "opcao", recusa: "Sem borda especial", aditivo: true,
    categoria: "essencial",
    camada: "encontro",
    opcoes: [
      { id: "5.6.1", nome: "Borda simples", img: "deck-borda-simples",
        desc: "Arremate reto na borda." },
      { id: "5.6.2", nome: "Borda de piscina", img: "deck-borda-piscina",
        titulo: "A testeira fecha a borda da piscina",
        desc: "Peça em L cobre a face vertical.",
        texto: "Peça em L, na mesma madeira do deck ou em perfil metálico, cobre a testeira da piscina e protege a estrutura interna." },
    ] },

  { id: "desnivel", nome: "Desnível",
    pergunta: "Há desnível a resolver no deck?",
    tipo: "multi", recusa: "Sem desnível", aditivo: true,
    categoria: "essencial",
    camada: "encontro",
    opcoes: [
      { id: "5.7.1", nome: "Rampa", img: "deck-desnivel-rampa",
        desc: "Estrutura corre inclinada." },
      { id: "5.7.2", nome: "Desnível de piso", img: "deck-desnivel-piso",
        desc: "Degrau entre duas cotas de deck." },
      { id: "5.7.3", nome: "Sobre piso frio", img: "deck-desnivel-piso-frio",
        desc: "O deck escala sobre um piso já executado." },
    ] },

  { id: "rebaixo", nome: "Rebaixo do contrapiso",
    pergunta: "A base foi rebaixada pro deck?",
    tipo: "sim-nao", recusa: "Sem rebaixo",
    categoria: "essencial",
    camada: "entre", notaPilha: "O rebaixo na base recebe a estrutura do deck.",
    opcoes: [
      { id: "5.8", nome: "Rebaixo executado", img: "deck-rebaixo-contrapiso",
        titulo: "O contrapiso é rebaixado para receber o deck",
        desc: "Base rebaixada mantém o piso final no nível.",
        texto: "Contrapiso rebaixado na área do deck faz com que o piso final saia no mesmo nível dos ambientes vizinhos, sem degrau." },
    ] },

  { id: "degraus", nome: "Degraus",
    pergunta: "Vai ter degraus no deck?",
    tipo: "multi", recusa: "Sem degraus", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "5.9.1", nome: "Degrau com iluminação", img: "deck-degrau-led",
        desc: "LED embutido na altura do espelho." },
      { id: "5.9.2", nome: "Degrau simples", img: "deck-degrau-simples",
        desc: "Pisada com espelho reto." },
      { id: "5.9.3", nome: "Degrau simples recuado", img: "deck-degrau-recuado",
        desc: "Espelho recuado sob a pisada." },
    ] },

  { id: "alcapao", nome: "Alçapão",
    pergunta: "Vai ter alçapão para acesso sob o deck?",
    tipo: "opcao", recusa: "Sem alçapão", aditivo: true,
    categoria: "essencial",
    camada: "assoalho", notaPilha: "Abertura no assoalho para inspeção.",
    opcoes: [
      { id: "6.1.1", nome: "Removível", img: "deck-alcapao-removivel",
        titulo: "Tampa sai inteira para acesso",
        desc: "Tampa em assoalho, removível.",
        texto: "Tampa executada em assoalho sobre o ponto de acesso. Sai inteira para inspeção e devolve o desenho da paginação quando recolocada." },
      { id: "6.1.2", nome: "Articulado", img: "deck-alcapao-articulado",
        titulo: "Tampa abre por dobradiça",
        desc: "Articulação embutida.",
        texto: "Tampa fixada por dobradiça oculta, abre para cima. Facilita acesso frequente sem perder o alinhamento com o resto do deck." },
    ] },

  { id: "recortes", nome: "Recortes",
    pergunta: "O que interrompe o deck neste ambiente?",
    tipo: "multi", recusa: "Sem recorte", aditivo: true,
    categoria: "essencial",
    camada: "assoalho", notaPilha: "Aberturas feitas no próprio deck.",
    opcoes: [
      { id: "6.2.1", nome: "Tomada", img: "deck-recorte-tomada",
        titulo: "Tomada de piso some quando não usada",
        desc: "Tampa em assoalho chanfrado.",
        texto: "Caixa metálica fornecida pela obra recebe tampa em assoalho chanfrado. Fechada, devolve o desenho da paginação." },
      { id: "6.2.2", nome: "Balizador", img: "deck-recorte-balizador",
        titulo: "Ponto de luz baixa embutido",
        desc: "Iluminação de piso.",
        texto: "Balizador embutido no deck marca caminho ou perímetro. Requer conduíte e ponto elétrico pré-executados pela obra." },
      { id: "6.2.3", nome: "LED linear", img: "deck-recorte-led",
        titulo: "Linha contínua de iluminação",
        desc: "Fita LED em canaleta.",
        texto: "Fita LED em canaleta usinada na madeira do deck, com difusor. Precisa de projeto de iluminação e ponto elétrico." },
      { id: "6.2.4.1", nome: "Jacuzzi removível", img: "deck-jacuzzi-removivel",
        titulo: "Tampa sai inteira",
        desc: "Módulo removível do deck.",
        texto: "Tampa da jacuzzi como módulo removível do deck. Mais leve de manusear em uso pontual." },
      { id: "6.2.4.2", nome: "Jacuzzi articulada", img: "deck-jacuzzi-articulada",
        titulo: "Tampa dobra para abrir",
        desc: "Dobradiça oculta.",
        texto: "Tampa da jacuzzi fixa por dobradiça, dobra em duas partes para abrir. Facilita acesso sem remover a peça inteira." },
    ] },

];

/* ── FORRO ───────────────────────────────────────────────────────────
 * Doc §8 (Projeto) + §9 (Acabamentos). Obrigatórios [#] do Doc:
 * 8.1 paginação, 8.2 instalação, 8.3 partida, 9.7 tabica, 9.8 sanca,
 * 9.9 cortineiro. */
export const DEF_FORRO: DefinicaoDef[] = [
  { id: "paginacao", nome: "Tipo de paginação",
    pergunta: "Qual o desenho do forro?",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "8.1.1", nome: "Reto", img: "forro-paginacao-reto",
        desc: "Forro em régua contínua." },
      { id: "8.1.2", nome: "Ripado", img: "forro-paginacao-ripado",
        desc: "Réguas afastadas com friso entre elas." },
      { id: "8.1.3", nome: "Laminado", img: "forro-paginacao-laminado",
        desc: "Painel em lâmina contínua." },
    ] },

  /* Detalhes únicos do Doc §8.2 e §8.3. */
  { id: "instalacao", nome: "Sistema de instalação",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "8.2", nome: "Sistema de instalação", img: "forro-sistema-instalacao", desc: "" },
    ] },

  { id: "tabica", nome: "Tabica",
    pergunta: "Como o forro encontra a parede?",
    nota: "A tabica é a sombra que separa o forro da parede — esconde a dilatação e dispensa o arremate colado.",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "9.7.1", nome: "Simples em régua", img: "forro-tabica-regua",
        desc: "Friso de sombra no perímetro · forro em régua." },
      { id: "9.7.2", nome: "Com painel passante", img: "forro-tabica-painel-passante",
        desc: "O painel da parede sobe e passa pela tabica." },
      { id: "9.7.3", nome: "Com painel recuado", img: "forro-tabica-painel-recuado",
        desc: "O painel para antes; a sombra marca o recuo." },
      { id: "9.7.4", nome: "Simples em ripado", img: "forro-tabica-ripado",
        desc: "Friso de sombra no perímetro · forro ripado." },
      { id: "9.7.5", nome: "Em ripado toblerone", img: "forro-tabica-toblerone",
        desc: "Friso de sombra · ripado toblerone." },
      { id: "9.7.6", nome: "Com retorno de ar", img: "forro-tabica-retorno-ar",
        desc: "A sombra da tabica vira grelha de retorno." },
    ],
    sugestoesCruzadas: [
      { servico: "PAINEL", definicao: "rodateto", opcao: "23.5.3",
        quandoOpcao: "9.7.2",
        motivo: "No PAINEL considere Rodateto com painel passante (23.5.3) — sugere continuidade, mas o detalhe pode ser outro se o projeto pedir." },
      { servico: "PAINEL", definicao: "rodateto", opcao: "23.5.4",
        quandoOpcao: "9.7.3",
        motivo: "No PAINEL considere Rodateto faceando com a tabica (23.5.4) para o recuo casar." },
    ] },

  { id: "sanca", nome: "Sanca iluminada",
    pergunta: "Vai ter sanca iluminada?",
    nota: "A variante certa depende do material do forro e da base — barrote ou laje.",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    recusa: "Sem sanca iluminada", aditivo: true,
    opcoes: [
      { id: "9.8.1", nome: "Régua — barrote", img: "forro-sanca-regua-barrote",
        desc: "Forro em régua · base em barrote." },
      { id: "9.8.2", nome: "Régua — laje", img: "forro-sanca-regua-laje",
        desc: "Forro em régua · direto na laje." },
      { id: "9.8.3", nome: "Painel — barrote", img: "forro-sanca-painel-barrote",
        desc: "Forro em painel · base em barrote." },
      { id: "9.8.4", nome: "Painel — laje", img: "forro-sanca-painel-laje",
        desc: "Forro em painel · direto na laje." },
      { id: "9.8.5", nome: "Ripado — barrote", img: "forro-sanca-ripado-barrote",
        desc: "Forro ripado · base em barrote." },
      { id: "9.8.6", nome: "Ripado — laje", img: "forro-sanca-ripado-laje",
        desc: "Forro ripado · direto na laje." },
      { id: "9.8.7", nome: "Toblerone — barrote", img: "forro-sanca-toblerone-barrote",
        desc: "Ripado toblerone · base em barrote." },
      { id: "9.8.8", nome: "Toblerone — laje", img: "forro-sanca-toblerone-laje",
        desc: "Ripado toblerone · direto na laje." },
      { id: "9.8.9", nome: "Com retorno de ar", img: "forro-sanca-retorno-ar",
        desc: "A sanca absorve a grelha de retorno." },
    ] },

  { id: "cortineiro", nome: "Cortineiro",
    pergunta: "Vai ter cortineiro? Escolha o formato.",
    nota: "Reto acompanha uma parede; em L contorna o canto; em U fecha três lados. Cada um existe na versão barrote e laje.",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    recusa: "Sem cortineiro", aditivo: true,
    opcoes: [
      { id: "9.9.1.1", nome: "Régua — barrote", img: "forro-cortineiro-regua-barrote",
        desc: "Reto · forro em régua · barrote." },
      { id: "9.9.1.2", nome: "Régua em L — barrote", img: "forro-cortineiro-regua-l-barrote",
        desc: "Contorna o canto · régua · barrote." },
      { id: "9.9.1.3", nome: "Régua — laje", img: "forro-cortineiro-regua-laje",
        desc: "Reto · forro em régua · laje." },
      { id: "9.9.1.4", nome: "Régua em U — barrote", img: "forro-cortineiro-regua-u-barrote",
        desc: "Fecha três lados · régua · barrote." },
      { id: "9.9.1.5", nome: "Régua em U — laje", img: "forro-cortineiro-regua-u-laje",
        desc: "Fecha três lados · régua · laje." },
      { id: "9.9.1.6", nome: "Ripado — barrote", img: "forro-cortineiro-ripado-barrote",
        desc: "Reto · forro ripado · barrote." },
      { id: "9.9.1.7", nome: "Ripado em L — barrote", img: "forro-cortineiro-ripado-l-barrote",
        desc: "Contorna o canto · ripado · barrote." },
      { id: "9.9.1.8", nome: "Ripado — laje", img: "forro-cortineiro-ripado-laje",
        desc: "Reto · forro ripado · laje." },
      { id: "9.9.1.9", nome: "Ripado em U — barrote", img: "forro-cortineiro-ripado-u-barrote",
        desc: "Fecha três lados · ripado · barrote." },
      { id: "9.9.1.10", nome: "Ripado em U — laje", img: "forro-cortineiro-ripado-u-laje",
        desc: "Fecha três lados · ripado · laje." },
      { id: "9.9.1.11", nome: "Toblerone — barrote", img: "forro-cortineiro-toblerone-barrote",
        desc: "Reto · toblerone · barrote." },
      { id: "9.9.1.12", nome: "Toblerone em L — barrote", img: "forro-cortineiro-toblerone-l-barrote",
        desc: "Contorna o canto · toblerone · barrote." },
      { id: "9.9.1.13", nome: "Toblerone — laje", img: "forro-cortineiro-toblerone-laje",
        desc: "Reto · toblerone · laje." },
      { id: "9.9.1.14", nome: "Toblerone em U — barrote", img: "forro-cortineiro-toblerone-u-barrote",
        desc: "Fecha três lados · toblerone · barrote." },
      { id: "9.9.1.15", nome: "Toblerone em U — laje", img: "forro-cortineiro-toblerone-u-laje",
        desc: "Fecha três lados · toblerone · laje." },
      { id: "9.9.2.1", nome: "Iluminado régua — barrote", img: "forro-cortineiro-ilum-regua-barrote",
        desc: "Com iluminação embutida · régua · barrote." },
      { id: "9.9.2.2", nome: "Iluminado régua — laje", img: "forro-cortineiro-ilum-regua-laje",
        desc: "Com iluminação embutida · régua · laje." },
      { id: "9.9.2.3", nome: "Iluminado ripado — barrote", img: "forro-cortineiro-ilum-ripado-barrote",
        desc: "Com iluminação embutida · ripado · barrote." },
      { id: "9.9.2.4", nome: "Iluminado ripado — laje", img: "forro-cortineiro-ilum-ripado-laje",
        desc: "Com iluminação embutida · ripado · laje." },
      { id: "9.9.2.5", nome: "Iluminado toblerone — barrote", img: "forro-cortineiro-ilum-toblerone-barrote",
        desc: "Com iluminação embutida · toblerone · barrote." },
      { id: "9.9.2.6", nome: "Iluminado toblerone — laje", img: "forro-cortineiro-ilum-toblerone-laje",
        desc: "Com iluminação embutida · toblerone · laje." },
      { id: "9.9.3", nome: "Com portinhola", img: "forro-cortineiro-portinhola",
        desc: "Cortineiro com portinhola de acesso ao trilho." },
    ],
    sugestoesCruzadas: [
      { servico: "FORRO", definicao: "bando", opcao: "9.10.3",
        quandoOpcao: ["9.9.2.1", "9.9.2.2", "9.9.2.3", "9.9.2.4", "9.9.2.5", "9.9.2.6"],
        motivo: "Se combinar com Bandô, considere a variante iluminada com cortineiro (9.10.3) — vira uma peça só." },
    ] },

  /* ── FORRO essenciais ────────────────────────────────────────────── */
  { id: "rebaixo", nome: "Rebaixo / entreforro",
    pergunta: "Há rebaixo com testeira de entreforro?",
    tipo: "sim-nao", recusa: "Sem rebaixo", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "8.4", nome: "Rebaixo com testeira", img: "forro-rebaixo-entreforro",
        titulo: "A testeira fecha a diferença de planos",
        desc: "Dois planos de forro, testeira no encontro.",
        texto: "Quando o forro muda de cota — pra esconder viga, duto ou criar desenho — a testeira de entreforro fecha a face vertical entre os dois planos, na mesma madeira." },
    ] },

  { id: "inclinado", nome: "Forro inclinado",
    pergunta: "O forro segue a inclinação da cobertura?",
    tipo: "sim-nao", recusa: "Forro plano", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "8.5", nome: "Inclinado", img: "forro-inclinado",
        desc: "O forro acompanha a inclinação do telhado." },
    ] },

  { id: "beiral", nome: "Beiral",
    pergunta: "O forro avança pra área externa?",
    nota: "No beiral a borda fica exposta ao tempo — a pingadeira descola a água da fachada.",
    tipo: "opcao", recusa: "Sem beiral", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "8.6.1", nome: "Inclinado", img: "forro-beiral-inclinado",
        desc: "O forro acompanha a inclinação da cobertura." },
      { id: "8.6.2", nome: "Com pingadeira", img: "forro-beiral-pingadeira",
        desc: "A borda ganha friso que descola a água." },
      { id: "8.6.3", nome: "Inclinado com pingadeira", img: "forro-beiral-inclinado-pingadeira",
        desc: "Inclinação + friso de pingadeira." },
      { id: "8.6.4", nome: "Com testeira", img: "forro-beiral-testeira",
        desc: "Testeira fecha a face vertical do beiral." },
      { id: "9.12.1", nome: "Com tabica simples", img: "forro-beiral-tabica",
        desc: "A sombra da tabica arremata o beiral." },
      { id: "9.12.2", nome: "Com cortineiro iluminado", img: "forro-beiral-cortineiro-ilum",
        desc: "O beiral absorve cortineiro com luz." },
    ] },

  { id: "alcapoes", nome: "Alçapões",
    pergunta: "Há acessos a manter no forro?",
    tipo: "multi", recusa: "Sem alçapões", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "9.1.1", nome: "Simples (quadrado)", img: "forro-alcapao-simples",
        desc: "Tampa quadrada removível, no desenho do forro." },
      { id: "9.1.2", nome: "Intercalado", img: "forro-alcapao-intercalado",
        desc: "A tampa segue o intercalado das réguas." },
      { id: "9.1.3", nome: "Articulado", img: "forro-alcapao-articulado",
        desc: "Tampa com dobradiça oculta." },
    ] },

  { id: "recortes", nome: "Iluminação e climatização",
    pergunta: "O que se embute no forro deste ambiente?",
    nota: "Cada embutido é um recorte usinado — o ponto elétrico e o duto são da obra; o recorte e o revestimento, da Parket.",
    tipo: "multi", recusa: "Sem embutidos", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "9.2.1", nome: "Luminária spot", img: "forro-spot",
        desc: "Recorte circular pro spot embutido." },
      { id: "9.2.2", nome: "Grelha de ar — régua", img: "forro-grelha-regua",
        desc: "Grelha de ar-condicionado em forro de régua." },
      { id: "9.2.3", nome: "Grelha de ar — ripado", img: "forro-grelha-ripado",
        desc: "Grelha de ar-condicionado em forro ripado." },
      { id: "9.2.4", nome: "Grelha de ar — toblerone", img: "forro-grelha-toblerone",
        desc: "Grelha de ar-condicionado em toblerone." },
      { id: "9.2.5", nome: "Perfil de LED", img: "forro-perfil-led",
        desc: "Canaleta usinada com perfil e difusor." },
    ] },

  { id: "flap", nome: "FLAP",
    pergunta: "Vai ter tampa articulada (kit festa/TV) no forro?",
    tipo: "multi", recusa: "Sem FLAP", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "9.3.1", nome: "Kit festa", img: "forro-tampa-kit-festa",
        desc: "Acesso ao ponto de gancho/kit no teto." },
      { id: "9.3.2", nome: "FLAP TV", img: "forro-tampa-flap-tv",
        desc: "Suporte articulado da TV embutido no forro." },
    ] },

  { id: "revestimento_grelhas", nome: "Revestimento de grelhas",
    pergunta: "As grelhas de ar recebem revestimento em madeira?",
    tipo: "sim-nao", recusa: "Grelha padrão sem revestimento", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "9.4", nome: "Grelha revestida", img: "forro-revestimento-grelhas",
        desc: "A grelha metálica some sob a madeira." },
    ] },

  { id: "som", nome: "Caixa de som",
    pergunta: "Vai ter som no forro?",
    tipo: "multi", recusa: "Sem caixa de som", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "9.5.1", nome: "Sobreposta", img: "forro-som-sobreposta",
        desc: "A caixa assenta sobre o plano do forro." },
      { id: "9.5.2.1", nome: "Embutida frisada — régua", img: "forro-som-embutida-regua",
        desc: "O som atravessa frisos usinados na régua." },
      { id: "9.5.2.2", nome: "Embutida frisada — ripado", img: "forro-som-embutida-ripado",
        desc: "O som atravessa o vão do ripado." },
      { id: "9.5.3", nome: "Acústica", img: "forro-som-acustica",
        desc: "Caixa acústica integrada ao forro." },
    ] },

  { id: "acustica", nome: "Lã acústica",
    pergunta: "Vai ter tratamento acústico?",
    tipo: "sim-nao", recusa: "Sem lã acústica", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "9.6", nome: "Lã acústica", img: "forro-la-acustica",
        titulo: "A lã preenche o vão sobre o forro",
        desc: "Preenche o vão entre a laje e o forro.",
        texto: "A manta de lã ocupa o vão entre a estrutura e o forro, absorvendo a reverberação. Combinada ao ripado ou aos frisos, é o que transforma o forro em tratamento acústico." },
    ] },

  { id: "bando", nome: "Bandô",
    pergunta: "Vai ter bandô?",
    tipo: "opcao", recusa: "Sem bandô", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "9.10.1", nome: "Simples", img: "forro-bando-simples",
        titulo: "A faixa vertical esconde o trilho",
        desc: "Faixa na mesma madeira do forro." },
      { id: "9.10.2", nome: "Simples iluminado", img: "forro-bando-iluminado",
        titulo: "O bandô ganha luz embutida",
        desc: "Com iluminação embutida na faixa." },
      { id: "9.10.3", nome: "Iluminado com cortineiro", img: "forro-bando-cortineiro",
        titulo: "Bandô e cortineiro numa peça só",
        desc: "Luz + vão de cortina no mesmo detalhe." },
    ] },

  { id: "grelha", nome: "Grelha na testeira",
    pergunta: "A insuflação sai pela testeira do forro?",
    tipo: "sim-nao", recusa: "Sem grelha na testeira", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "9.11.1", nome: "Grelha na testeira", img: "forro-grelha-testeira",
        desc: "A grelha de ar-condicionado sai pela face vertical." },
    ] },

  { id: "encontros", nome: "Encontros",
    pergunta: "O forro encontra outro plano de madeira?",
    tipo: "multi", recusa: "Sem encontros especiais",
    categoria: "essencial",
    opcoes: [
      { id: "9.13.1", nome: "Com o piso de madeira", img: "forro-encontro-piso",
        desc: "Forro e piso se encontram alinhados." },
      { id: "9.13.2", nome: "Com guarda-corpo", img: "forro-encontro-guarda-corpo",
        desc: "O forro arremata contra o guarda-corpo." },
    ],
    sugestoesCruzadas: [
      { servico: "PISO", definicao: "encontros", opcao: "3.4.1",
        quandoOpcao: "9.13.1",
        motivo: "No PISO considere o mesmo detalhe (Encontro com forro de madeira) para o desenho casar em obra." },
    ] },

];

/* ── PAINEL ──────────────────────────────────────────────────────────
 * Doc §23 (Projeto) + §24 (Acabamentos). Obrigatórios [#] do Doc:
 * 23.1 tipo, 23.2 fixação, 23.3 fechamento de topo, 23.4 rodapé, 23.5 rodateto. */
export const DEF_PAINEL: DefinicaoDef[] = [
  { id: "tipo", nome: "Tipo de painel",
    pergunta: "Qual o tipo de painel deste ambiente?",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "23.1.1", nome: "Régua paginação reta", img: "painel-regua-reta",
        desc: "Painel em régua contínua." },
      { id: "23.1.2", nome: "Régua paginação aleatória", img: "painel-regua-aleatoria",
        desc: "Régua com juntas escalonadas." },
      { id: "23.1.3", nome: "Lâmina", img: "painel-lamina",
        desc: "Painel em lâmina contínua." },
      { id: "23.1.4", nome: "MDF", img: "painel-mdf",
        desc: "Painel em MDF." },
      { id: "23.1.5", nome: "Ripado", img: "painel-ripado",
        desc: "Ripas afastadas com friso." },
      { id: "23.1.6", nome: "Toblerone", img: "painel-toblerone",
        desc: "Ripado toblerone." },
      { id: "23.1.7", nome: "Veneziana", img: "painel-veneziana",
        desc: "Painel em veneziana." },
      { id: "23.1.8", nome: "Com moldura", img: "painel-moldura",
        desc: "Painel com moldura aplicada." },
      { id: "23.1.9", nome: "Com boiserie", img: "painel-boiserie",
        desc: "Painel com desenho boiserie." },
      { id: "23.1.10", nome: "Com frisos", img: "painel-frisos",
        desc: "Painel com frisos usinados." },
      { id: "23.1.11", nome: "Brise", img: "painel-brise",
        desc: "Painel tipo brise, com passagem de ar." },
      { id: "23.1.12", nome: "Muxarabi", img: "painel-muxarabi",
        desc: "Painel vazado muxarabi." },
    ] },

  { id: "fixacao", nome: "Fixação",
    pergunta: "Como o painel se fixa na parede?",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "23.2.1", nome: "Com barrotes", img: "painel-fixacao-barrote",
        desc: "Barrote estruturando o painel." },
      { id: "23.2.2", nome: "Com mão amiga", img: "painel-fixacao-mao-amiga",
        desc: "Ferragem oculta tipo mão amiga." },
      { id: "23.2.3", nome: "Autoportante", img: "painel-fixacao-autoportante",
        desc: "Painel autoportante, sem estrutura à vista." },
    ] },

  { id: "fechamento_topo", nome: "Fechamento de topo",
    pergunta: "Como fecha o topo do painel?",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "23.3.1", nome: "Topo 45°", img: "painel-topo-45",
        desc: "Corte 45° no topo." },
      { id: "23.3.2", nome: "Topo aparente", img: "painel-topo-aparente",
        desc: "Face do topo à vista." },
      { id: "23.3.3", nome: "Topo passante", img: "painel-topo-passante",
        desc: "Painel passa por cima da tabica." },
      { id: "23.3.4", nome: "Rebaixo LED", img: "painel-topo-led",
        desc: "Rebaixo no topo com fita LED." },
    ] },

  { id: "rodape", nome: "Rodapé",
    pergunta: "Como fecha o encontro do painel com o piso?",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "23.4.1", nome: "Invertido", img: "painel-rodape-invertido",
        desc: "Perfil embutido, sem rodapé à vista." },
      { id: "23.4.2", nome: "Invertido com perfil metálico", img: "painel-rodape-invertido-metalico",
        desc: "Perfil metálico no rebaixo." },
    ] },

  { id: "rodateto", nome: "Rodateto",
    pergunta: "Como fecha o encontro do painel com o forro?",
    tipo: "opcao", obrigatorio: true, categoria: "obrigatorio",
    opcoes: [
      { id: "23.5.1", nome: "Invertido", img: "painel-rodateto-invertido",
        desc: "Perfil embutido, sem rodateto à vista." },
      { id: "23.5.2", nome: "Com perfil metálico", img: "painel-rodateto-metalico",
        desc: "Perfil metálico no encontro." },
      { id: "23.5.3", nome: "Com painel passante", img: "painel-rodateto-passante",
        desc: "O painel sobe e atravessa a tabica." },
      { id: "23.5.4", nome: "Faceando com a tabica", img: "painel-rodateto-face-tabica",
        desc: "O painel encontra a tabica na mesma face." },
    ],
    sugestoesCruzadas: [
      { servico: "FORRO", definicao: "tabica", opcao: "9.7.2",
        quandoOpcao: "23.5.3",
        motivo: "No FORRO considere Tabica com painel passante (9.7.2) — o painel só passa se a tabica também abrir espaço." },
      { servico: "FORRO", definicao: "tabica", opcao: "9.7.3",
        quandoOpcao: "23.5.4",
        motivo: "No FORRO considere Tabica com painel recuado (9.7.3) — a face do painel encaixa no recuo." },
    ] },

  /* ── PAINEL essenciais ───────────────────────────────────────────── */
  { id: "recortes", nome: "Recortes",
    pergunta: "O que interrompe o painel neste ambiente?",
    tipo: "multi", recusa: "Sem recortes", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "23.6.1", nome: "Automação", img: "painel-recorte-automacao",
        desc: "Recorte para atuador/automação." },
      { id: "23.6.2", nome: "Pontos elétricos mimetizados", img: "painel-recorte-pontos",
        desc: "Tomadas/interruptores no desenho do painel." },
    ] },

  { id: "grelha_ac", nome: "Grelha de ar-condicionado",
    pergunta: "O painel recebe grelha de ar-condicionado?",
    tipo: "sim-nao", recusa: "Sem grelha no painel", aditivo: true,
    categoria: "essencial",
    opcoes: [
      { id: "23.7", nome: "Grelha embutida", img: "painel-grelha-ac",
        desc: "Grelha usinada no desenho do painel." },
    ] },

  { id: "acabamento", nome: "Acabamento",
    pergunta: "Qual o acabamento do painel?",
    tipo: "multi", categoria: "essencial",
    opcoes: [
      { id: "24.1", nome: "Cor laca", desc: "Laca colorida." },
      { id: "24.2", nome: "Madeira", desc: "Madeira natural/lâmina." },
      { id: "24.3", nome: "Espelho", desc: "Espelho aplicado." },
      { id: "24.4", nome: "Tecido", desc: "Painel revestido em tecido." },
      { id: "24.5", nome: "Shaft", desc: "Shaft técnico." },
    ] },

];

/* Compat: subset ilustrado ainda usado pelo DefinicoesView atual até o
 * refactor por serviço (task #1812). Depois some. */
const soIlustradas = (d: DefinicaoDef): DefinicaoDef =>
  ({ ...d, opcoes: (d.opcoes || []).filter(o => o.img) });
const byId = (id: string) => DEF_PISO.find(d => d.id === id)!;

export const TRANSICAO_PECAS: OpcaoDef[] = (byId("transicoes").opcoes || []).filter(o => o.img);
export const TRANSICAO_POSICOES: OpcaoDef[] = (byId("alinhamento").opcoes || []).filter(o => o.img);

export const DEF_TEC: DefinicaoDef[] = [
  soIlustradas(byId("elevado")),
  soIlustradas(byId("aquecido")),
  { id: "transicao", nome: "Transição de piso",
    pergunta: "Como o piso encontra o revestimento vizinho?", tipo: "opcao",
    recusa: "Este ambiente não encosta em outro piso", opcoes: TRANSICAO_PECAS,
    camada: "encontro", notaPilha: "A borda onde o assoalho topa com o piso frio." },
  { id: "alinhamento", nome: "Alinhamento de transição",
    pergunta: "Onde a transição cai no vão da porta?", tipo: "opcao",
    opcoes: TRANSICAO_POSICOES,
    camada: "encontro", notaPilha: "O arremate dentro do vão da porta." },
  soIlustradas(byId("rodape")),
  soIlustradas(byId("recortes")),
  soIlustradas(byId("entretrilho")),
];

export const DESTINOS_EXTERNOS = [
  "Banheiro", "Lavabo", "Cozinha", "Área de serviço",
  "Área externa", "Sacada", "Closet",
];

/* Regras de engenharia: quando `quando` é verdadeira sobre as escolhas
 * (defId → id da opção, ou "nao"), a definição `bloqueia` sai da tela. */
export type Escolhas = Record<string, string | string[] | undefined>;

/* Regras/avisos que dependiam de sub-opções de instalação/soleira/junta/
 * acabamento sumiram junto com essas defs (Doc §2.2 não lista alternativas).
 * Mantidas as que ainda fazem sentido sobre as opções que existem. */
export const REGRAS: { quando: (e: Escolhas) => boolean; bloqueia: string; motivo: string }[] = [];

export const AVISOS: { quando: (e: Escolhas) => boolean; texto: string }[] = [
  { quando: e => e.paginacao === "2.1.2" || e.paginacao === "2.1.5" || e.paginacao === "2.1.6",
    texto: "Esta paginação exige o desenho fechado antes do primeiro corte, e a perda de material é bem maior que na reta." },
  { quando: e => e.rodape === "3.1.1",
    texto: "O rodapé invertido é embutido na alvenaria: precisa ser decidido antes do reboco. Depois dele, não há como executar." },
  { quando: e => e.aquecido === "2.5",
    texto: "Com aquecimento, a espessura e a espécie da régua deixam de ser só estética: entram na conta térmica, e o protocolo de partida precisa ser combinado." },
];

/* Perguntas por texto pras categorias sem entrevista estruturada.
 * PAINEL saiu daqui — agora tem DEF_PAINEL. */
export const PERGUNTAS_TEXTO: { categoria: string; perguntas: string[] }[] = [
  { categoria: "PORTA", perguntas: [
    "Qual o acabamento da porta (face interna e externa)?",
    "Qual a altura da porta e o tipo de ferragem/fechadura?",
  ] },
  { categoria: "ESCADA", perguntas: [
    "Como será o revestimento da escada (degraus e espelhos)?",
    "Como será o topo da pisada e haverá LED no degrau?",
    "Haverá corrimão ou guarda-corpo no escopo Parket?",
  ] },
  { categoria: "MARCENARIA", perguntas: [
    "Qual o acabamento da marcenaria neste ambiente?",
    "Onde ficam os pontos elétricos/hidráulicos que o móvel encosta?",
    "Há aditivos de marcenaria pendentes de aprovação?",
  ] },
  { categoria: "RODAPE", perguntas: [
    "Qual o modelo e a altura do rodapé?",
  ] },
  { categoria: "REVESTIMENTO", perguntas: [
    "Qual o acabamento do revestimento neste ambiente?",
    "Como será o arremate com os demais revestimentos?",
  ] },
  { categoria: "ADEGA", perguntas: [
    "Qual o acabamento e a configuração da adega?",
  ] },
  { categoria: "SAUNA", perguntas: [
    "Qual o acabamento da sauna e dos sub-serviços (forro, banco, porta)?",
  ] },
];

export function normCat(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

export function isPiso(cat: string): boolean {
  const c = normCat(cat);
  return c.includes("PISO") || c.includes("ASSOALHO");
}

export function isDeck(cat: string): boolean {
  const c = normCat(cat);
  return c === "DECK" || c.startsWith("DECK ") || c.endsWith(" DECK");
}

export function isForro(cat: string): boolean {
  return normCat(cat).includes("FORRO");
}

export function isPainel(cat: string): boolean {
  const c = normCat(cat);
  return c.includes("PAINEL") || c.includes("PAINE");  // PAINEIS
}

/* Serviço canônico do item, se casar com um dos 4 estruturados. */
export function servicoDoItem(cat: string): Servico | null {
  if (isPiso(cat)) return "PISO";
  if (isDeck(cat)) return "DECK";
  if (isForro(cat)) return "FORRO";
  if (isPainel(cat)) return "PAINEL";
  return null;
}

export function defsDoServico(servico: Servico): DefinicaoDef[] {
  switch (servico) {
    case "PISO": return DEF_PISO;
    case "DECK": return DEF_DECK;
    case "FORRO": return DEF_FORRO;
    case "PAINEL": return DEF_PAINEL;
  }
}

/* ── derivações do contrato (sem escolha do cliente) ────────────────
 * Paginação vem do produto vendido: se contém chevron/espinha/versailles/
 * tabeira/wood+marble, esse; senão, Reta (produto régua). O cliente vê a
 * prancha derivada, não escolhe. */
const PAGINACAO_KEYWORDS: { id: string; test: RegExp }[] = [
  { id: "2.1.6", test: /wood\s*[+&]\s*marble|marble/i },
  { id: "2.1.5", test: /versailles/i },
  { id: "2.1.4", test: /tabeira/i },
  { id: "2.1.3", test: /espinha(\s+de\s+peixe)?/i },
  { id: "2.1.2", test: /chevron/i },
];

/** Retorna o id da opção de paginação derivada do texto do item.
 *  Default: "2.1.1" (Reta) — só muda se aparecer alguma keyword. */
export function derivarPaginacao(...blobs: (string | undefined | null)[]): string {
  const blob = blobs.filter(Boolean).join(" ");
  for (const k of PAGINACAO_KEYWORDS) if (k.test.test(blob)) return k.id;
  return "2.1.1";
}

/** Uma def é "derivada" (não clicável, marca automática) só quando:
 *   - paginação → vem da proposta
 *   - obrigatória com 1 opção → detalhe fixo, sempre presente
 *  Def complementar com 1 opção (piso aquecido, entretrilho, lã acústica,
 *  grelha testeira etc.) é escolha do cliente — pode marcar e desmarcar. */
export function ehDerivada(def: DefinicaoDef): boolean {
  if (def.id === "paginacao") return true;
  if (def.categoria !== "obrigatorio") return false;
  return (def.opcoes?.length ?? 0) === 1 && def.tipo !== "texto-longo";
}

export function perguntasTexto(cat: string): string[] {
  const c = normCat(cat);
  const grupo = PERGUNTAS_TEXTO.find(g => c.includes(g.categoria));
  return grupo ? grupo.perguntas : [
    "Qual a definição de acabamento deste item?",
    "Há alguma observação específica deste item?",
  ];
}
