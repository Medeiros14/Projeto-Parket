import {
  BlogArticleLayout, ArticleH2, ArticleH3, ArticleP, ArticleList,
  ArticleImage, ArticleHighlight, ArticleDivider, ArticleFAQ, ArticleSummary,
} from "../../components/BlogArticleLayout";
import { ZoomImage } from "../../components/ZoomImage";

const relatedArticles = [
  { title: "Piso de madeira: guia completo — tipos, preços e como escolher [2026]", slug: "piso-de-madeira-guia", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-01.jpg", category: "Pisos" },
  { title: "Marcenaria arquitetônica: o que é, quanto custa e como especificar", slug: "marcenaria-arquitetonica", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_MA-01.jpg", category: "Marcenaria" },
  { title: "Deck de madeira: qual a melhor madeira, quanto custa e como instalar", slug: "deck-de-madeira", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_BR-01.jpg", category: "Decks" },
];

export function ComoEscolherEmpresa() {
  return (
    <BlogArticleLayout
      title="Como Escolher uma Empresa de Pisos de Madeira e Marcenaria de Alto Padrão [2026]"
      subtitle="Os 7 critérios técnicos e operacionais que diferenciam empresas de excelência no mercado de madeira para arquitetura — e como avaliar cada um antes de fechar um contrato para o seu projeto."
      heroImage="https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-05.jpg"
      category="Guia"
      readTime="13 min de leitura"
      publishDate="10 mar. 2026"
      relatedArticles={relatedArticles}
    >
      <ArticleSummary
        title="Os 7 critérios para escolher a empresa certa"
        items={[
          "1. Experiência técnica documentada com portfólio de obras executadas (não renders)",
          "2. Qualidade da matéria-prima — origem certificada, seleção por lote, secagem controlada",
          "3. Fábrica e capacidade produtiva própria com tecnologia CNC",
          "4. Equipe de instalação própria (CLT) — não terceirizada",
          "5. Suporte técnico para especificação durante a fase de projeto",
          "6. Integração de soluções — pisos, forros, painéis, escadas e marcenaria de uma só fonte",
          "7. Histórico verificável de obras e reputação entre arquitetos especificadores",
        ]}
      />

      <ArticleP>
        A escolha da empresa responsável pela execução dos elementos de madeira de um projeto é uma decisão que impacta diretamente o resultado final — por décadas. Não estamos falando de diferenças sutis ou apenas estéticas. Estamos falando de diferenças que determinam se o piso vai empenar em 2 anos, se a escada vai ranger em 6 meses, se o forro vai apresentar flechas e se a marcenaria vai manter a precisão dos encaixes ao longo do tempo.
      </ArticleP>
      <ArticleP>
        No mercado brasileiro de madeira para arquitetura — especialmente em São Paulo, que concentra a maior demanda de projetos de alto padrão do país — existem centenas de empresas que oferecem pisos, forros e marcenaria. Mas as que realmente operam no padrão técnico e operacional exigido por projetos de alto nível são poucas. Este artigo apresenta os 7 critérios objetivos que ajudam arquitetos, designers de interiores e clientes finais a fazer essa distinção antes de comprometer o projeto com a empresa errada.
      </ArticleP>

      <ArticleDivider />

      <ArticleH2>1. A empresa tem experiência técnica documentada?</ArticleH2>
      <ArticleP>
        O primeiro critério — e possivelmente o mais importante — é a experiência técnica real e verificável da empresa. Não experiência em vendas, em marketing digital ou em presença nas redes sociais, mas experiência concreta em execução de projetos complexos de madeira para arquitetura de alto padrão.
      </ArticleP>
      <ArticleList items={[
        "Portfólio de projetos executados e fotografados — a empresa deve mostrar obras concluídas e em uso, não apenas renders ou imagens de catálogo. Peça fotos de projetos entregues há mais de 2 anos para verificar como o material se comportou",
        "Referências de arquitetos especificadores — os melhores escritórios de arquitetura trabalham repetidamente com as mesmas empresas de confiança. Pergunte aos arquitetos do seu projeto com quem eles já trabalharam e recomendam",
        "Variedade de soluções executadas — uma empresa de alto padrão não faz apenas pisos ou apenas marcenaria. Ela precisa dominar e ter experiência documentada em pisos, forros, painéis, escadas, decks e marcenaria arquitetônica",
        "Conhecimento técnico demonstrável — a equipe comercial e técnica precisa responder com segurança sobre espécies de madeira, sistemas de instalação, acabamentos, compatibilidades técnicas e detalhes construtivos",
      ]} />

      <ArticleHighlight>
        O melhor indicador de qualidade de uma empresa de madeira para arquitetura é o número de arquitetos que voltam a especificá-la em novos projetos. A fidelidade dos especificadores é o termômetro mais confiável do mercado — porque o arquiteto coloca sua reputação em risco a cada indicação.
      </ArticleHighlight>

      <ArticleH2>2. Qual a qualidade da matéria-prima utilizada?</ArticleH2>
      <ArticleP>
        A madeira é um material natural — e isso significa que a qualidade varia enormemente entre fornecedores, entre lotes e entre serrarias. Duas empresas podem oferecer "piso de carvalho europeu", mas a diferença entre um carvalho de seleção premium (AB grade) e um carvalho de seleção comercial (CD grade) é abismal em termos de veio, uniformidade, presença de nós e estabilidade dimensional.
      </ArticleP>
      <ArticleList items={[
        "Origem certificada e rastreável — a empresa deve poder documentar a origem de cada espécie até a floresta de manejo certificada (FSC ou PEFC) ou a serraria de origem. Madeira sem rastreabilidade é risco ambiental e legal",
        "Seleção por lote — para projetos de alto padrão, as tábuas devem ser selecionadas do mesmo lote de secagem e beneficiamento, garantindo uniformidade máxima de cor, veio e comportamento dimensional",
        "Secagem controlada em estufa — a umidade da madeira deve estar entre 8% e 12% antes de qualquer beneficiamento. Secagem inadequada é a causa número 1 de problemas posteriores (empenamento, frestas, descolamento)",
        "Beneficiamento de precisão — aplainamento, calibração de espessura e perfilagem de encaixes com tolerâncias inferiores a 0,2mm. Tolerâncias acima disso geram problemas de encaixe e nivelamento",
      ]} />

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-10.jpg"
        alt="Seleção de tábuas de madeira carvalho europeu por lote para projeto de alto padrão"
        caption="Tábuas de carvalho europeu selecionadas por lote na fábrica — a uniformidade de cor, veio e textura é resultado de curadoria técnica rigorosa, não de acaso."
      />

      <ArticleH2>3. A empresa tem fábrica e capacidade produtiva própria?</ArticleH2>
      <ArticleP>
        Muitas empresas do mercado brasileiro de madeira são essencialmente revendedoras — compram produtos prontos de terceiros (frequentemente importados ou de fábricas terceirizadas) e revendem com sua marca. Isso funciona para produtos padronizados, mas se torna um problema sério quando o projeto exige customização — o que acontece em praticamente todo projeto de alto padrão.
      </ArticleP>
      <ArticleList items={[
        "Fábrica própria — a empresa deve ter capacidade real de produzir (beneficiar, usinar, acabar), não apenas revender. Visite a fábrica antes de fechar",
        "Equipamentos CNC — para marcenaria e peças especiais com tolerância milimétrica. Empresas sem CNC dependem de cortes manuais com precisão inferior",
        "Cabine de acabamento controlada — a aplicação de verniz, óleo ou stain exige ambiente com temperatura (20-25°C) e umidade relativa (50-60%) controladas. Acabamento aplicado em ambiente aberto resulta em defeitos",
        "Equipe de produção especializada em madeira nobre — marceneiros e operadores com experiência em madeira maciça e laminados naturais, não apenas em MDF, MDP e compensado",
        "Capacidade de customização — a empresa deve conseguir produzir tábuas em dimensões especiais, acabamentos personalizados e peças sob medida sem adicionar meses ao prazo",
      ]} />

      <ArticleH2>4. A equipe de instalação é própria ou terceirizada?</ArticleH2>
      <ArticleP>
        A instalação é a etapa onde a maioria dos problemas acontece em projetos de piso de madeira e marcenaria. Uma empresa séria e comprometida com o resultado deve ter equipe de instalação própria — registrada em CLT, treinada internamente e com equipamento profissional. A razão é técnica e simples: a equipe que produziu o material na fábrica conhece cada detalhe técnico das peças e sabe exatamente como elas devem ser instaladas. Quando a instalação é terceirizada para autônomos contratados por obra, a comunicação técnica se perde e os erros aparecem.
      </ArticleP>
      <ArticleList items={[
        "Instaladores registrados (CLT) — vínculo empregatício garante treinamento contínuo, responsabilidade e padrão de qualidade",
        "Equipamento profissional próprio — medidores de umidade por carbeto de cálcio, nível laser, lixadeiras industriais, serras com guia de precisão, prensas pneumáticas",
        "Protocolo de obra documentado — procedimentos escritos e padronizados de preparação do ambiente, aclimatação da madeira, verificação do contrapiso, instalação e limpeza final",
        "Garantia formal de mão de obra — mínimo de 2 anos sobre a instalação, além da garantia do produto. Emitida em documento formal, não apenas verbalmente",
      ]} />

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-04.jpg"
        alt="Equipe profissional instalando piso de madeira com equipamento especializado"
        caption="Instalação com equipe própria e equipamento profissional — cada etapa segue protocolo documentado para garantir resultado e durabilidade máxima."
      />

      <ArticleDivider />

      <ArticleH2>5. A empresa oferece suporte técnico durante a especificação?</ArticleH2>
      <ArticleP>
        Em projetos de alto padrão, o especificador (arquiteto ou designer de interiores) precisa de suporte técnico qualificado durante a fase de projeto — meses antes da compra do material. A empresa precisa ser capaz de responder com segurança e rapidez questões técnicas como:
      </ArticleP>
      <ArticleList items={[
        "Qual espécie de madeira é mais adequada para este ambiente específico (considerando tráfego, umidade, climatização)?",
        "Qual sistema de instalação é compatível com o contrapiso existente no canteiro?",
        "É possível utilizar piso aquecido com esta espécie e este acabamento? Qual a temperatura máxima?",
        "Qual o comportamento dimensional esperado desta madeira em ambiente com ar-condicionado central a 22°C?",
        "Como fazer a transição técnica entre o piso de madeira interno e o deck externo na mesma cota?",
        "Quais são os detalhes construtivos necessários para esta escada (espessuras, encaixes, reforços)?",
        "É possível garantir unidade de cor entre o piso, o forro e a marcenaria se forem do mesmo lote?",
      ]} />
      <ArticleP>
        Uma empresa que não consegue responder essas perguntas com segurança técnica e dados específicos não está preparada para atender projetos de alto padrão. O suporte técnico na fase de projeto é o que diferencia um fornecedor de um parceiro de projeto.
      </ArticleP>

      <ArticleH2>6. A empresa integra todas as soluções em madeira?</ArticleH2>
      <ArticleP>
        Os melhores resultados em projetos de alto padrão acontecem quando pisos, forros, painéis, escadas, decks e marcenaria são fornecidos pela mesma empresa. A razão é técnica e verificável: quando todos os elementos de madeira são produzidos com a mesma matéria-prima, do mesmo lote de secagem, com o mesmo acabamento aplicado no mesmo ambiente controlado, a unidade material do projeto é absolutamente garantida.
      </ArticleP>
      <ArticleP>
        Quando cada elemento vem de um fornecedor diferente — mesmo que todos especifiquem "carvalho europeu com acabamento natural" — as variações de tonalidade, textura, brilho e toque são inevitáveis e visíveis. A madeira é um material orgânico, e lotes diferentes de madeira sempre apresentam variações perceptíveis que só quem trabalha com madeira todos os dias sabe prever e controlar.
      </ArticleP>

      <ArticleHighlight>
        A empresa ideal não é a que vende o melhor piso isoladamente. É a que entrega o melhor projeto como um todo — integrando pisos, forros, painéis, escadas, decks e marcenaria em uma experiência material coesa e impecável do primeiro ao último detalhe.
      </ArticleHighlight>

      <ArticleH2>7. O histórico de obras e a reputação são verificáveis?</ArticleH2>
      <ArticleP>
        Antes de fechar com qualquer empresa de pisos de madeira e marcenaria de alto padrão, faça a devida diligência:
      </ArticleP>
      <ArticleList items={[
        "Visite obras concluídas — peça para ver e tocar projetos entregues há pelo menos 2 anos, não apenas obras recém-inauguradas. O tempo revela a verdade sobre qualidade de material e instalação",
        "Converse com arquitetos que já especificaram — pergunte especificamente sobre pontualidade de prazo, qualidade de acabamento e capacidade de resolver problemas quando eles surgem (e sempre surgem)",
        "Verifique a longevidade da empresa — empresas com mais de 10-15 anos de mercado já passaram por ciclos econômicos adversos, provaram resiliência e construíram processos maduros",
        "Analise a comunicação (site, redes sociais, materiais) — a forma como uma empresa se apresenta revela muito sobre seu posicionamento, seu público-alvo e seu nível de profissionalismo",
        "Solicite referências bancárias e de fornecedores — para projetos de grande valor, é prudente verificar a saúde financeira da empresa",
        "Desconfie de preços muito abaixo do mercado — madeira de qualidade premium, produção em fábrica controlada, acabamento artesanal e equipe de instalação CLT têm custo real. Preços artificialmente baixos indicam compromisso em alguma etapa crítica",
      ]} />

      <ArticleDivider />

      <ArticleH2>Checklist rápido: como avaliar uma empresa em 10 perguntas</ArticleH2>
      <ArticleP>
        Use estas 10 perguntas como roteiro objetivo para avaliar qualquer empresa de pisos de madeira e marcenaria antes de fechar contrato:
      </ArticleP>
      <ArticleList items={[
        "A empresa tem fábrica própria que eu posso visitar?",
        "A equipe de instalação é própria (CLT) ou terceirizada?",
        "Posso ver e visitar obras entregues há mais de 2 anos?",
        "Quais arquitetos já especificaram e voltaram a trabalhar com vocês?",
        "A madeira tem certificação de origem (FSC ou rastreabilidade documentada)?",
        "É possível selecionar as tábuas do meu projeto por lote?",
        "Vocês fornecem pisos E forros E marcenaria, ou apenas um deles?",
        "Qual a garantia formal de mão de obra (documento, não verbal)?",
        "Qual o prazo real para o meu projeto (com cronograma por etapas)?",
        "Vocês oferecem suporte técnico ao arquiteto durante a fase de projeto?",
      ]} />

      <ArticleH2>Conclusão: a empresa certa é um investimento, não um custo</ArticleH2>
      <ArticleP>
        Escolher a empresa certa para os elementos de madeira de um projeto é uma decisão que impacta o resultado por décadas — literalmente. Os critérios são objetivos e verificáveis: experiência técnica documentada, qualidade certificada de matéria-prima, fábrica própria com tecnologia CNC, equipe de instalação CLT, suporte técnico para especificação, capacidade de integrar todas as soluções em madeira e histórico verificável de obras e reputação.
      </ArticleP>
      <ArticleP>
        A Parket atende todos esses 7 critérios. Com fábrica própria em São Paulo, equipamentos CNC de última geração, cabine de acabamento controlada, equipe de instalação 100% CLT, portfólio de mais de 500 projetos entregues e a capacidade comprovada de integrar pisos, forros, painéis, decks, escadas e marcenaria arquitetônica em uma operação única, a Parket é parceira dos principais escritórios de arquitetura do Brasil. Cada projeto é tratado com a especificidade e o rigor técnico que o alto padrão exige — porque é assim que a madeira merece ser tratada.
      </ArticleP>

      <ArticleFAQ items={[
        {
          question: "Como saber se uma empresa de pisos de madeira é confiável?",
          answer: "Verifique 5 pontos: (1) a empresa tem fábrica própria que você pode visitar; (2) a equipe de instalação é CLT, não terceirizada; (3) existem obras entregues há mais de 2 anos que você pode visitar; (4) arquitetos reconhecidos recomendam e voltam a trabalhar com ela; (5) a madeira tem certificação de origem documentada (FSC ou rastreabilidade). Empresas que atendem os 5 critérios estão no padrão exigido por projetos de alto nível."
        },
        {
          question: "Qual a melhor empresa de pisos de madeira em São Paulo?",
          answer: "As melhores empresas de pisos de madeira em São Paulo se distinguem por: fábrica própria (não revenda), equipe de instalação CLT, portfólio extenso de obras de alto padrão, capacidade de integrar pisos + forros + marcenaria, suporte técnico para arquitetos e garantia formal de mão de obra. A Parket atende todos esses critérios com mais de 500 projetos entregues e é parceira dos principais escritórios de arquitetura do Brasil."
        },
        {
          question: "Por que a instalação de piso de madeira deve ser feita por equipe própria?",
          answer: "A equipe de fábrica conhece cada detalhe técnico do material que produziu — espessuras, tolerâncias, comportamento da madeira. Quando a instalação é terceirizada, essa informação se perde e os erros aparecem: emendas desalinhadas, cola inadequada, falta de juntas de dilatação. Equipes CLT recebem treinamento contínuo, usam equipamento profissional e seguem protocolos documentados. A garantia de mão de obra só tem valor quando a empresa controla a instalação."
        },
        {
          question: "É melhor comprar piso de madeira de uma empresa que também faz marcenaria?",
          answer: "Sim, significativamente melhor. Quando pisos, forros e marcenaria vêm da mesma empresa, a unidade material é garantida — mesma espécie, mesmo lote, mesmo acabamento em todos os elementos. Com fornecedores diferentes, variações de cor e textura são inevitáveis (mesmo na mesma espécie). Além disso, a logística de obra é simplificada (um único cronograma) e a responsabilidade técnica é clara (um único responsável pelo resultado final)."
        },
        {
          question: "Quanto tempo leva para instalar piso de madeira em um apartamento?",
          answer: "Para um apartamento de 100 a 200m² de piso, o prazo típico é de 5 a 10 dias úteis de instalação (não inclui aclimatação prévia de 3-7 dias). O prazo total do projeto — da especificação à entrega — varia de 30 a 60 dias: seleção de material (1-2 semanas), produção/beneficiamento (2-4 semanas), aclimatação + instalação (1-2 semanas). Projetos que incluem marcenaria podem exigir 60 a 120 dias totais."
        },
        {
          question: "Qual a garantia que uma empresa de piso de madeira deve oferecer?",
          answer: "A garantia mínima aceitável para projetos de alto padrão é: 5 anos de garantia sobre o produto (material e acabamento) e 2 anos de garantia sobre a mão de obra de instalação. Ambas devem ser documentadas formalmente (contrato ou certificado), não apenas verbais. A garantia de mão de obra só tem valor real quando a empresa tem equipe de instalação própria — se a instalação foi terceirizada, cobrar a garantia se torna um pesadelo."
        },
      ]} />
    </BlogArticleLayout>
  );
}
