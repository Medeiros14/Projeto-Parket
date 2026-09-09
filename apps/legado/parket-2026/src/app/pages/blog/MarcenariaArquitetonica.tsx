import {
  BlogArticleLayout, ArticleH2, ArticleH3, ArticleP, ArticleList,
  ArticleImage, ArticleHighlight, ArticleDivider, ArticleFAQ, ArticleSummary,
} from "../../components/BlogArticleLayout";
import { ZoomImage } from "../../components/ZoomImage";

const relatedArticles = [
  { title: "Escada de madeira: tipos, espécies, preços e como especificar [2026]", slug: "escadas-de-madeira", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-01.jpg", category: "Escadas" },
  { title: "Piso de madeira: guia completo — tipos, preços e como escolher [2026]", slug: "piso-de-madeira-guia", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-01.jpg", category: "Pisos" },
  { title: "Como escolher uma empresa de pisos e marcenaria de alto padrão em São Paulo", slug: "como-escolher-empresa-pisos-madeira", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-05.jpg", category: "Guia" },
];

export function MarcenariaArquitetonica() {
  return (
    <BlogArticleLayout
      title="Marcenaria Arquitetônica: O Que É, Quanto Custa e Como Especificar [Guia 2026]"
      subtitle="Painéis de parede, portas ocultas, cozinhas sob medida, bibliotecas do piso ao teto e mobiliário fixo — tudo sobre marcenaria arquitetônica de alto padrão: o que diferencia de marcenaria convencional, preços, processo de desenvolvimento e como garantir unidade material no projeto."
      heroImage="https://parket.com.br/wp-content/uploads/2025/10/PRO_MA-01.jpg"
      category="Marcenaria"
      readTime="15 min de leitura"
      publishDate="10 mar. 2026"
      relatedArticles={relatedArticles}
    >
      <ArticleSummary
        title="O que você vai encontrar neste guia"
        items={[
          "O que é marcenaria arquitetônica e como ela se diferencia da marcenaria convencional",
          "As 6 principais aplicações: painéis, portas ocultas, cozinhas, bibliotecas, home theaters, closets",
          "Quanto custa a marcenaria arquitetônica em 2026 — faixas de investimento por tipo",
          "O processo completo de desenvolvimento: do briefing à instalação (9 etapas)",
          "A importância estratégica da unidade material em projetos de alto padrão",
          "Marcenaria arquitetônica vs. marcenaria planejada — por que são categorias diferentes",
        ]}
      />

      <ArticleP>
        Marcenaria arquitetônica vai muito além da produção de móveis sob medida. É a disciplina que integra madeira e arquitetura em uma só linguagem — painéis que revestem paredes inteiras sem costuras, portas ocultas que desaparecem no plano do painel, cozinhas que nascem do mesmo material do piso, bibliotecas do chão ao teto que definem o caráter de um ambiente e mobiliário fixo que é projetado como extensão da arquitetura.
      </ArticleP>
      <ArticleP>
        Nos melhores projetos contemporâneos de escritórios como Studio MK27 (Marcio Kogan), Isay Weinfeld, Jacobsen Arquitetura e Arthur Casas, a marcenaria não é um complemento posterior à obra. É parte da arquitetura desde a fase de projeto — desenvolvida em paralelo com a obra civil e instalada como peça integrada ao espaço, não como móvel encostado na parede.
      </ArticleP>
      <ArticleP>
        Este guia explica em detalhes o que é marcenaria arquitetônica, como ela funciona, quanto custa e como especificá-la corretamente para projetos de alto padrão.
      </ArticleP>

      <ArticleHighlight>
        A marcenaria arquitetônica é o ponto onde a madeira deixa de ser material e se torna linguagem do projeto. Cada peça é desenhada para um espaço específico, com tolerâncias milimétricas e acabamento que reflete a intenção do arquiteto.
      </ArticleHighlight>

      <ArticleDivider />

      <ArticleH2>O que diferencia marcenaria arquitetônica de marcenaria convencional (planejada)</ArticleH2>
      <ArticleP>
        Esta é uma distinção fundamental que muitos clientes e até alguns profissionais confundem. A marcenaria convencional (ou "planejada") trabalha com catálogos de módulos padronizados, medidas fixas e soluções replicáveis em série — tipicamente em MDF revestido com laminados melamínicos ou BP. A marcenaria arquitetônica trabalha com projeto exclusivo — cada peça é única, desenhada para um espaço específico e executada com o mesmo rigor de uma obra de engenharia de precisão.
      </ArticleP>
      <ArticleList items={[
        "Projeto executivo detalhado — modelagem 3D com todas as peças dimensionadas, numeradas e sequenciadas para produção e montagem",
        "Materiais nobres selecionados por lote — madeiras maciças e laminados naturais selecionados individualmente para garantir uniformidade de cor, veio e textura em todo o projeto",
        "Produção com tecnologia CNC — cortes, furos e usinagens com tolerância de 0,1mm, impossível de atingir com máquinas convencionais",
        "Acabamento artesanal — lixamento progressivo até grão 320, aplicação manual de acabamento em múltiplas camadas, inspeção visual peça a peça",
        "Instalação por equipe própria — a mesma equipe que produziu instala, garantindo continuidade técnica e ajustes de precisão no local",
        "Diálogo constante com o arquiteto — do briefing à entrega, o arquiteto é co-autor do projeto de marcenaria",
      ]} />
      <ArticleP>
        A diferença de qualidade entre marcenaria arquitetônica e marcenaria planejada é visível e tátil. É a diferença entre um terno sob medida cortado na Savile Row e um terno de prateleira — ambos são ternos, mas pertencem a categorias completamente diferentes.
      </ArticleP>

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_MA-03.jpg"
        alt="Marcenaria arquitetônica em sala de estar com painel e estante integrados em madeira"
        caption="Painel e estante integrados em freijó — a marcenaria nasce da parede e define toda a composição do ambiente. A superfície contínua sem costuras é impossível com marcenaria modular."
      />

      <ArticleH2>Quais são as principais aplicações da marcenaria arquitetônica</ArticleH2>

      <ArticleH3>Painéis de parede em madeira</ArticleH3>
      <ArticleP>
        Paredes inteiras revestidas em madeira — superfícies contínuas, ripadas ou tridimensionais que transformam completamente a percepção do ambiente. O painel de marcenaria arquitetônica não é simplesmente fixado na parede — ele integra nichos, iluminação embutida, portas ocultas, tomadas escamoteáveis e elementos técnicos (saídas de ar-condicionado, sensores de automação) em uma superfície coesa e sem costuras visíveis. É a aplicação que mais impacta a percepção de qualidade de um ambiente.
      </ArticleP>

      <ArticleH3>Portas ocultas e painéis pivotantes</ArticleH3>
      <ArticleP>
        Uma das aplicações mais sofisticadas e cobiçadas da marcenaria arquitetônica. A porta desaparece completamente no plano do painel de madeira — sem batentes visíveis, sem marcos aparentes, sem puxadores tradicionais. Sistemas de dobradiça oculta com abertura coplanar e mecanismo toque-abre (push-pull) permitem que a porta se integre perfeitamente ao revestimento. Quando fechada, é literalmente impossível distingui-la do painel — um efeito que causa admiração imediata em quem visita o espaço.
      </ArticleP>

      <ArticleH3>Cozinhas e áreas gourmet sob medida</ArticleH3>
      <ArticleP>
        A cozinha é o ambiente que mais exige da marcenaria em termos de funcionalidade, resistência e precisão dimensional. Gavetas com corredores de movimentação total (60 kg de capacidade), dobradiças com amortecimento integrado (soft-close), painéis de madeira compatíveis com calor e umidade, integração com eletrodomésticos embutidos. Quando executada pela mesma empresa que fornece pisos e forros do projeto, a cozinha ganha unidade material absoluta — o mesmo carvalho do piso aparece nos armários, na ilha e no painel do teto.
      </ArticleP>

      <ArticleH3>Bibliotecas e estantes do piso ao teto</ArticleH3>
      <ArticleP>
        Peças de grande escala que organizam e definem ambientes inteiros. A biblioteca arquitetônica não é um móvel — é uma parede funcional que integra armazenamento, exposição, iluminação embutida e presença visual dramática. Estantes de piso ao teto com 3 a 5 metros de altura exigem estrutura calculada, fixação na laje ou parede estrutural e instalação com precisão milimétrica. O resultado são peças que se tornam o ponto focal do ambiente.
      </ArticleP>

      <ArticleH3>Home theaters e salas de mídia</ArticleH3>
      <ArticleP>
        Ambientes onde a marcenaria precisa atender simultaneamente requisitos estéticos (a sala precisa ser bonita), acústicos (controle de reverberação e isolamento) e funcionais (equipamentos, fiação, automação). Painéis com tratamento acústico interno, nichos ventilados para equipamentos, portas de correr que escondem telas e sistemas de som integrados aos painéis de madeira. A marcenaria acústica é uma especialidade dentro da marcenaria arquitetônica.
      </ArticleP>

      <ArticleH3>Closets e walk-in closets</ArticleH3>
      <ArticleP>
        O closet de marcenaria arquitetônica é projetado como uma experiência — iluminação cênica, gavetas com divisórias personalizadas para cada tipo de peça, prateleiras ajustáveis, penteadeira integrada e espelhos com iluminação perimetral. A diferença para um closet de marcenaria planejada está na qualidade dos materiais (madeira maciça vs. MDF), nos acabamentos (óleo ou verniz artesanal vs. laminado industrial) e na precisão dos detalhes.
      </ArticleP>

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_MA-05.jpg"
        alt="Porta oculta de madeira integrada ao painel de marcenaria arquitetônica"
        caption="Porta oculta integrada ao painel de madeira — quando fechada, é absolutamente indistinguível do revestimento. Dobradiça oculta com sistema toque-abre."
      />

      <ArticleDivider />

      <ArticleH2>Quanto custa a marcenaria arquitetônica em 2026</ArticleH2>
      <ArticleP>
        O investimento em marcenaria arquitetônica varia enormemente conforme a complexidade do projeto, as espécies de madeira, os sistemas de ferragens e o volume total. As faixas de referência para projetos de alto padrão em São Paulo em 2026 são:
      </ArticleP>
      <ArticleList items={[
        "Painéis de parede em madeira maciça ou laminado natural: R$ 1.800 a R$ 4.500/m² de superfície",
        "Portas ocultas coplanares (por unidade, padrão 80x240cm): R$ 8.000 a R$ 18.000",
        "Cozinha completa em marcenaria arquitetônica: R$ 80.000 a R$ 250.000 (dependendo do tamanho e complexidade)",
        "Biblioteca piso-ao-teto (por metro linear): R$ 6.000 a R$ 15.000",
        "Closet/walk-in closet completo: R$ 50.000 a R$ 180.000",
        "Home theater (painéis acústicos + equipamentos embutidos): R$ 60.000 a R$ 200.000",
        "Marcenaria completa de um apartamento de alto padrão (120-200m²): R$ 200.000 a R$ 600.000",
      ]} />
      <ArticleP>
        Esses valores refletem projetos executados com madeira nobre (carvalho europeu, freijó, cumaru), ferragens premium (Blum, Hettich), acabamentos artesanais e instalação por equipe própria. A marcenaria arquitetônica não é comparável em preço à marcenaria planejada — são categorias diferentes de produto, processo e resultado.
      </ArticleP>

      <ArticleH2>O processo de desenvolvimento da marcenaria arquitetônica</ArticleH2>
      <ArticleP>
        A marcenaria arquitetônica de alto padrão segue um fluxo de desenvolvimento que se assemelha mais a um projeto de engenharia do que a uma fábrica de móveis. As etapas são:
      </ArticleP>
      <ArticleList items={[
        "1. Briefing com o arquiteto — entendimento profundo do conceito, dos materiais, das premissas funcionais e da linguagem desejada",
        "2. Levantamento dimensional — medição laser do espaço com tolerância de 1mm em todos os pontos de referência",
        "3. Anteprojeto — desenhos esquemáticos em 3D para validação de conceito, proporções e integração com outros elementos",
        "4. Projeto executivo — detalhamento completo com cotas, materiais, ferragens, acabamentos e sequência de produção e montagem",
        "5. Seleção de materiais — escolha dos lotes de madeira com validação visual pelo arquiteto (cor, veio, uniformidade)",
        "6. Produção CNC + artesanal — corte e usinagem com precisão de 0,1mm, seguidos de colagem, lixamento progressivo e acabamento manual",
        "7. Pré-montagem em fábrica — montagem completa na oficina para validação integral antes do envio ao canteiro",
        "8. Instalação no local — montagem final por equipe especializada com ajustes finos de precisão",
        "9. Vistoria e entrega — inspeção final conjunta com o arquiteto para validação de todos os detalhes",
      ]} />

      <ArticleH2>Por que a unidade material transforma projetos</ArticleH2>
      <ArticleP>
        Um dos maiores diferenciais estratégicos da marcenaria arquitetônica é a possibilidade de criar unidade material completa no projeto. Quando pisos, forros, painéis, escadas e marcenaria são produzidos pela mesma empresa, com a mesma espécie de madeira, do mesmo lote de matéria-prima e com o mesmo acabamento, o resultado é uma coesão visual e tátil que nenhuma combinação de fornecedores diferentes consegue replicar.
      </ArticleP>
      <ArticleP>
        Imagine um living onde o piso de carvalho europeu se estende continuamente da entrada ao jantar, o forro ripado na mesma espécie cria ritmo sobre a sala de estar, o painel da TV é contínuo em carvalho com a mesma tonalidade, e a estante lateral complementa a composição. A mesma madeira, do mesmo lote, com o mesmo acabamento artesanal — essa é a unidade material que diferencia projetos excepcionais de projetos meramente bons.
      </ArticleP>
      <ArticleP>
        Quando cada elemento vem de um fornecedor diferente, as variações de tonalidade, textura e brilho de acabamento são inevitáveis — mesmo quando todos especificam "carvalho europeu natural". A madeira é um material orgânico, e lotes diferentes de madeira (mesmo da mesma espécie e serraria) sempre apresentam variações perceptíveis.
      </ArticleP>

      <ArticleHighlight>
        A unidade material não é apenas uma questão estética — é uma filosofia de projeto. Quando todos os elementos de madeira falam a mesma linguagem, o espaço ganha uma coerência que transcende a soma das partes individuais. É o que diferencia uma casa bem decorada de uma casa verdadeiramente projetada.
      </ArticleHighlight>

      <ArticleH2>Conclusão: marcenaria como linguagem do projeto</ArticleH2>
      <ArticleP>
        A marcenaria arquitetônica é a disciplina que eleva a madeira de material de construção a linguagem fundamental do projeto. Quando executada com rigor técnico absoluto, sensibilidade estética e em diálogo constante com o arquiteto desde a fase de projeto, ela transforma espaços em experiências.
      </ArticleP>
      <ArticleP>
        A Parket integra pisos, forros, painéis, escadas e marcenaria em uma operação industrial e artesanal única — do projeto executivo à instalação final, passando pela seleção de matéria-prima por lote, produção CNC em fábrica própria e acabamento artesanal. Essa integração vertical permite oferecer unidade material garantida, controle de qualidade absoluto e prazos previsíveis. Porque quando tudo vem da mesma mão, tudo conversa — e o resultado é incomparável.
      </ArticleP>

      <ArticleFAQ items={[
        {
          question: "O que é marcenaria arquitetônica?",
          answer: "Marcenaria arquitetônica é a produção de elementos de madeira sob medida — painéis de parede, portas ocultas, cozinhas, bibliotecas, closets e mobiliário fixo — projetados como parte integrada da arquitetura, não como móveis independentes. Cada peça é desenhada para um espaço específico, produzida com tecnologia CNC (tolerância de 0,1mm) e instalada por equipe especializada. É fundamentalmente diferente da marcenaria planejada/convencional em materiais, processo e resultado."
        },
        {
          question: "Quanto custa a marcenaria arquitetônica por m²?",
          answer: "O custo varia enormemente conforme a complexidade. Painéis de parede: R$ 1.800 a R$ 4.500/m². Portas ocultas: R$ 8.000 a R$ 18.000 por unidade. Cozinha completa: R$ 80.000 a R$ 250.000. Para um apartamento de alto padrão de 150m², a marcenaria arquitetônica completa (cozinha, closets, painéis, estantes) fica entre R$ 200.000 e R$ 600.000."
        },
        {
          question: "Qual a diferença entre marcenaria arquitetônica e marcenaria planejada?",
          answer: "Marcenaria planejada usa módulos padronizados em MDF com revestimento laminado, catálogos de opções e medidas fixas. Marcenaria arquitetônica usa projeto exclusivo, madeira maciça ou laminado natural, produção CNC com tolerância de 0,1mm, acabamento artesanal e instalação por equipe própria. São categorias completamente diferentes de produto — comparáveis a um terno sob medida vs. um terno de prateleira."
        },
        {
          question: "O que é uma porta oculta de madeira?",
          answer: "Porta oculta é uma porta que desaparece completamente no plano do painel de madeira da parede — sem batentes visíveis, sem marcos aparentes e sem puxadores tradicionais. Usa sistemas de dobradiça oculta com abertura coplanar e mecanismo toque-abre (push-pull). Quando fechada, é impossível distingui-la do painel. É uma das aplicações mais sofisticadas e valorizadas da marcenaria arquitetônica."
        },
        {
          question: "Por que a unidade material importa em projetos de alto padrão?",
          answer: "Quando pisos, forros, painéis e marcenaria são produzidos pela mesma empresa, com a mesma espécie de madeira e do mesmo lote de matéria-prima, a coesão visual e tátil é absoluta — tons, veios e acabamentos são idênticos em todos os elementos. Com fornecedores diferentes, variações de cor e textura são inevitáveis (mesmo na mesma espécie), criando uma desuniformidade perceptível que compromete o resultado do projeto."
        },
        {
          question: "Quanto tempo leva para produzir marcenaria arquitetônica?",
          answer: "O prazo total — do briefing à instalação — varia de 60 a 120 dias, dependendo da complexidade e do volume. As etapas típicas são: briefing e levantamento (1-2 semanas), projeto executivo (2-3 semanas), aprovação e seleção de materiais (1-2 semanas), produção (4-8 semanas) e instalação (1-3 semanas). Projetos de grande escala podem exigir até 6 meses."
        },
      ]} />
    </BlogArticleLayout>
  );
}
