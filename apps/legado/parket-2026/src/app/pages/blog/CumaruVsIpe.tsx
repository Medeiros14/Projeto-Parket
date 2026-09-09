import {
  BlogArticleLayout, ArticleH2, ArticleH3, ArticleP, ArticleList,
  ArticleImage, ArticleHighlight, ArticleDivider, ArticleFAQ,
} from "../../components/BlogArticleLayout";
import { ZoomImage } from "../../components/ZoomImage";

const relatedArticles = [
  { title: "Piso de madeira: guia completo — tipos, preços e como escolher [2026]", slug: "piso-de-madeira-guia", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-01.jpg", category: "Pisos" },
  { title: "Deck de madeira: qual a melhor madeira, quanto custa e como instalar", slug: "deck-de-madeira", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_BR-01.jpg", category: "Decks" },
  { title: "Como escolher uma empresa de pisos e marcenaria de alto padrão", slug: "como-escolher-empresa-pisos-madeira", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-05.jpg", category: "Guia" },
];

export function CumaruVsIpe() {
  return (
    <BlogArticleLayout
      title="Cumaru vs Ipê: Qual a Melhor Madeira para Piso e Deck? [Comparativo 2026]"
      subtitle="Densidade, durabilidade, preço por m², estabilidade dimensional e estética — comparativo técnico completo entre as duas madeiras brasileiras mais nobres para pisos e decks de alto padrão."
      heroImage="https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-01.jpg"
      category="Pisos"
      readTime="10 min de leitura"
      publishDate="12 mar. 2026"
      relatedArticles={relatedArticles}
    >
      <ArticleP>
        Cumaru e Ipê são as duas madeiras brasileiras mais especificadas em projetos de alto padrão — tanto para pisos internos quanto para decks externos. Ambas pertencem à classe de durabilidade natural 1 (muito durável), ambas possuem densidade acima de 1.000 kg/m³ e ambas são aprovadas para uso externo sem tratamento químico. Mas não são intercambiáveis. Cada uma tem características técnicas e estéticas que a tornam mais adequada para determinadas aplicações.
      </ArticleP>
      <ArticleP>
        Este artigo é um comparativo técnico objetivo para ajudar arquitetos e clientes a tomar a decisão certa. Se você busca um panorama mais amplo sobre todas as espécies disponíveis, recomendamos a leitura do nosso <a href="/blog/piso-de-madeira-guia" className="text-[#9C8B6E] underline underline-offset-2 hover:text-[#2A2A2A] transition-colors">Guia Completo de Pisos de Madeira</a>.
      </ArticleP>

      <ArticleH2>Densidade e Dureza: Cumaru leva vantagem</ArticleH2>
      <ArticleP>
        O Cumaru possui densidade média de 1.100 kg/m³, enquanto o Ipê fica em torno de 1.050 kg/m³. Na prática, essa diferença de 5% se traduz em uma resistência ligeiramente superior do Cumaru a riscos, impactos e desgaste por tráfego intenso. Ambas são classificadas como "muito duras" na escala Janka — o Cumaru com índice de 3.540 lbf e o Ipê com 3.510 lbf.
      </ArticleP>
      <ArticleP>
        Para pisos residenciais de alto tráfego — halls de entrada, salas integradas, corredores — a diferença é marginal. Ambas suportam décadas de uso sem desgaste visível. A vantagem do Cumaru se torna mais relevante em aplicações comerciais ou em decks públicos com tráfego muito intenso.
      </ArticleP>

      <ArticleH2>Estabilidade Dimensional</ArticleH2>
      <ArticleP>
        A estabilidade dimensional mede o quanto a madeira se move (contrai e expande) em resposta a variações de umidade. Aqui, o Ipê leva ligeira vantagem. Sua estrutura fibrosa é mais densa e compacta, resultando em menor movimentação tangencial e radial comparado ao Cumaru.
      </ArticleP>
      <ArticleP>
        Em ambientes com ar-condicionado constante (que reduz a umidade relativa do ar para 40-50%), essa diferença pode ser relevante. O Ipê tende a apresentar menos frestas entre as tábuas ao longo dos anos. Para decks externos, onde a umidade varia drasticamente, ambas as espécies necessitam de espaçamento técnico entre as tábuas — e nesse caso a diferença é irrelevante.
      </ArticleP>

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-03.jpg"
        alt="Piso em cumaru — projeto residencial"
        caption="Piso em Cumaru com acabamento natural acetinado — Residência Jardim Europa, SP"
      />

      <ArticleH2>Coloração e Estética</ArticleH2>
      <ArticleP>
        O Cumaru apresenta coloração castanho-dourada a avermelhada, com veios intercalados que conferem um aspecto quente e vibrante. Com o tempo e exposição à luz, a tonalidade se aprofunda, ficando mais rica e acobreada.
      </ArticleP>
      <ArticleP>
        O Ipê varia de marrom escuro a oliva, com veios mais sutis e um aspecto mais sóbrio e uniforme. É a escolha natural para projetos que pedem sobriedade e neutralidade — ambientes de tons frios, concreto aparente e paletas monocromáticas.
      </ArticleP>

      <ArticleHighlight>
        "A escolha entre Cumaru e Ipê é, em última instância, uma decisão estética. Tecnicamente, ambas entregam desempenho excepcional. O que muda é a linguagem visual que cada uma traz ao projeto."
      </ArticleHighlight>

      <ArticleH2>Preço por m² em 2026</ArticleH2>
      <ArticleP>
        O Cumaru é, em média, 15% a 25% mais acessível que o Ipê. Em março de 2026, o piso de Cumaru maciço instalado situa-se na faixa de R$ 380 a R$ 520/m², enquanto o Ipê varia de R$ 450 a R$ 650/m². A diferença se explica pela menor oferta de Ipê no mercado — a espécie tem restrições de manejo mais severas e menor volume de produção sustentável.
      </ArticleP>
      <ArticleP>
        Para decks, a diferença percentual é semelhante. Considerando que um deck residencial médio tem entre 30 m² e 80 m², a economia ao optar pelo Cumaru pode variar de R$ 2.100 a R$ 10.400 — valor significativo que deve ser ponderado contra a preferência estética.
      </ArticleP>

      <ArticleH2>Resistência à Umidade: Empate técnico</ArticleH2>
      <ArticleP>
        Ambas as espécies possuem resistência natural excepcional a fungos, insetos e apodrecimento. São classificadas como Classe 1 de durabilidade natural pela norma brasileira (ABNT NBR 7190). Para decks de piscina, ambas são aprovadas — desde que instaladas com espaçamento técnico, ventilação inferior e tratamento antiderrapante adequado. Leia mais sobre estrutura técnica de decks no nosso <a href="/blog/deck-de-madeira" className="text-[#9C8B6E] underline underline-offset-2 hover:text-[#2A2A2A] transition-colors">Guia Completo de Deck de Madeira</a>.
      </ArticleP>

      <ArticleH2>Quando Escolher Cada Uma?</ArticleH2>
      <ArticleH3>Escolha Cumaru quando:</ArticleH3>
      <ArticleList items={[
        "O projeto pede uma tonalidade quente, dourada e vibrante",
        "O orçamento é relevante e a relação custo-benefício é prioridade",
        "A aplicação é em deck externo com tráfego intenso",
        "Você deseja uma madeira que enriquece visivelmente com o tempo",
      ]} />

      <ArticleH3>Escolha Ipê quando:</ArticleH3>
      <ArticleList items={[
        "O projeto pede sobriedade, tons mais escuros e aspecto uniforme",
        "A estabilidade dimensional em ambientes climatizados é crítica",
        "O cliente busca o status da madeira mais nobre do Brasil",
        "O projeto é residencial com foco em áreas internas de longo prazo",
      ]} />

      <ArticleDivider />

      <ArticleFAQ items={[
        { question: "Qual madeira dura mais: Cumaru ou Ipê?", answer: "Ambas possuem durabilidade natural excepcional (Classe 1). Em testes de campo, ambas superam 30 anos de uso externo sem tratamento. A diferença prática de longevidade é negligenciável." },
        { question: "Cumaru é mais barato que Ipê?", answer: "Sim. O Cumaru é, em média, 15% a 25% mais acessível que o Ipê, considerando material instalado. A diferença se deve à maior oferta sustentável de Cumaru no mercado." },
        { question: "Posso misturar Cumaru e Ipê no mesmo projeto?", answer: "Sim, mas com cautela. As tonalidades são bastante diferentes — o Cumaru é dourado/avermelhado e o Ipê é marrom escuro/oliva. A combinação pode funcionar em projetos que busquem contraste intencional entre áreas internas e externas." },
        { question: "Qual é melhor para deck de piscina?", answer: "Ambas são excelentes para deck de piscina. O Cumaru leva leve vantagem pela maior dureza superficial e melhor custo-benefício. O Ipê é escolhido quando a estética mais escura é desejada." },
      ]} />
    </BlogArticleLayout>
  );
}
