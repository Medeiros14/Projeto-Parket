import {
  BlogArticleLayout, ArticleH2, ArticleH3, ArticleP, ArticleList,
  ArticleImage, ArticleHighlight, ArticleDivider, ArticleFAQ, ArticleSummary,
} from "../../components/BlogArticleLayout";
import { ZoomImage } from "../../components/ZoomImage";

const relatedArticles = [
  { title: "Piso de madeira: guia completo — tipos, preços e como escolher [2026]", slug: "piso-de-madeira-guia", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-01.jpg", category: "Pisos" },
  { title: "Forro de madeira: tipos, preços e como especificar para projetos de alto padrão", slug: "forro-de-madeira", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_FO-01.jpg", category: "Forros" },
  { title: "Como escolher uma empresa de pisos e marcenaria de alto padrão em São Paulo", slug: "como-escolher-empresa-pisos-madeira", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-05.jpg", category: "Guia" },
];

export function DeckDeMadeira() {
  return (
    <BlogArticleLayout
      title="Deck de Madeira: Qual a Melhor Madeira, Quanto Custa e Como Instalar [2026]"
      subtitle="Espécies ideais (cumaru, ipê, garapa, Kebony), estrutura técnica, sistemas de fixação oculta, drenagem, manutenção e preço por m² — o guia técnico completo para especificar decks de madeira em projetos residenciais e comerciais de alto padrão."
      heroImage="https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_BR-01.jpg"
      category="Decks"
      readTime="15 min de leitura"
      publishDate="24 fev. 2026"
      relatedArticles={relatedArticles}
    >
      <ArticleSummary
        title="O que você vai encontrar neste guia"
        items={[
          "As 4 melhores espécies de madeira para deck: cumaru, ipê, garapa e Kebony",
          "Quanto custa o deck de madeira por m² em 2026 — com material e instalação",
          "Deck de madeira vs. deck de madeira plástica (WPC) — comparativo honesto",
          "A estrutura invisível que determina se o deck vai durar 5 ou 30 anos",
          "Sistemas de fixação oculta vs. aparente — qual usar e por quê",
          "Manutenção correta: o que fazer e quando para máxima longevidade",
        ]}
      />

      <ArticleP>
        O deck de madeira é uma das soluções mais valorizadas em projetos de áreas externas de alto padrão. Piscinas, jardins, varandas, rooftops, áreas de contemplação e spas ganham uma dimensão completamente nova quando a madeira entra na composição — criando uma transição natural e orgânica entre o construído e o paisagismo.
      </ArticleP>
      <ArticleP>
        Mas ambientes externos impõem desafios técnicos severos que não existem em interiores. A madeira está exposta à radiação solar intensa, à chuva, à variação térmica diurna (que pode ultrapassar 30°C entre dia e noite), à umidade constante e à ação de fungos e insetos. Sem a espécie correta, a estrutura adequada e o sistema de fixação apropriado, um deck pode apresentar problemas graves — empenamento, rachaduras, apodrecimento — em poucos anos.
      </ArticleP>
      <ArticleP>
        Este guia reúne as informações técnicas essenciais para especificar um deck de madeira que seja bonito, seguro e durável por décadas.
      </ArticleP>

      <ArticleHighlight>
        Um deck de madeira bem executado não é apenas um piso externo bonito — é uma solução de engenharia que combina material nobre, estrutura calculada e sistema construtivo projetado para resistir a décadas de intempéries.
      </ArticleHighlight>

      <ArticleDivider />

      <ArticleH2>Qual a melhor madeira para deck: espécies ideais para áreas externas</ArticleH2>
      <ArticleP>
        A escolha da espécie é a decisão mais crítica em qualquer projeto de deck. A madeira precisa resistir naturalmente — sem depender exclusivamente de tratamentos químicos — à água, aos fungos xilófagos, aos insetos e à radiação ultravioleta intensa. As espécies brasileiras tropicais de alta densidade são as melhores do mundo para essa aplicação, reconhecidas internacionalmente.
      </ArticleP>

      <ArticleH3>Cumaru (Dipteryx odorata) — a escolha mais popular</ArticleH3>
      <ArticleP>
        Densidade de 1.100 kg/m³ e durabilidade natural classe 1 — a classificação mais alta possível. Resistência comprovada a fungos, insetos xilófagos e apodrecimento, sem necessidade de tratamento químico. Coloração castanho dourado que ganha uma pátina prateada elegante com o tempo se não receber reaplicação de óleo — muitos arquitetos preferem essa evolução natural. É a espécie mais especificada para decks de alto padrão no Brasil e exportada para projetos na Europa, nos EUA e na Ásia. Preço médio do deck em cumaru: R$ 380 a R$ 550/m² instalado.
      </ArticleP>

      <ArticleH3>Ipê (Tabebuia sp.) — a "madeira de ferro"</ArticleH3>
      <ArticleP>
        Densidade de 1.050 kg/m³ e dureza Janka de 3.510 lbf — virtualmente indestrutível em ambientes externos. Utilizado no High Line Park em Nova York, no calçadão de Coney Island, em marinas de luxo na Flórida e em decks de resorts cinco estrelas ao redor do mundo. Coloração marrom escuro a oliva com presença imponente e sofisticada. Uma das poucas madeiras no mundo que pode ser deixada sem qualquer tratamento em área externa e ainda assim resistir por 40+ anos. Preço médio do deck em ipê: R$ 450 a R$ 680/m² instalado.
      </ArticleP>

      <ArticleH3>Garapa (Apuleia leiocarpa) — elegância clara com custo acessível</ArticleH3>
      <ArticleP>
        Densidade de 850 kg/m³ com tonalidade amarelo-dourado luminosa que se destaca em projetos que buscam uma estética mais clara e contemporânea para a área externa. Excelente resistência a intempéries com custo significativamente mais acessível que cumaru e ipê. Ideal para decks de grandes áreas onde o orçamento precisa ser otimizado sem comprometer a durabilidade. Preço médio do deck em garapa: R$ 280 a R$ 420/m² instalado.
      </ArticleP>

      <ArticleH3>Kebony (madeira modificada norueguesa) — sustentabilidade máxima</ArticleH3>
      <ArticleP>
        Tecnologia norueguesa patenteada que modifica madeiras macias (pinus radiata) através de um processo de polimerização com álcool furfurílico — derivado de resíduos agrícolas. O resultado é uma madeira com durabilidade, estabilidade dimensional e resistência comparáveis às tropicais, com certificação FSC e pegada de carbono até 90% menor. Coloração marrom escuro que evolui para pátina prateada. Ideal para projetos com certificação ambiental (LEED, AQUA) ou que priorizam sustentabilidade sem abrir mão de performance. Preço médio do deck em Kebony: R$ 500 a R$ 750/m² instalado.
      </ArticleP>

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_KE-03.jpg"
        alt="Deck de madeira Kebony em projeto residencial contemporâneo"
        caption="Deck em Kebony — madeira modificada com tecnologia norueguesa que combina sustentabilidade certificada e performance equivalente às tropicais."
      />

      <ArticleH2>Deck de madeira vs. deck de madeira plástica (WPC): vale a pena?</ArticleH2>
      <ArticleP>
        O deck de madeira plástica (WPC — Wood Plastic Composite) é frequentemente apresentado como alternativa "sem manutenção" ao deck de madeira natural. A comparação técnica, porém, revela diferenças significativas:
      </ArticleP>
      <ArticleList items={[
        "Estética: madeira natural tem textura tridimensional, variação tonal orgânica e evolução cromática impossível de replicar; WPC tem padrão repetitivo e aparência artificial",
        "Temperatura superficial: WPC esquenta até 60-70°C ao sol direto (impossível pisar descalço); madeira natural esquenta até 40-45°C (confortável)",
        "Durabilidade: cumaru/ipê duram 30-40+ anos; WPC de qualidade 15-20 anos (descoloração, deformação por calor)",
        "Sustentabilidade: madeira certificada é 100% renovável e biodegradável; WPC contém plástico e não é reciclável na maioria dos casos",
        "Reparabilidade: tábuas de madeira podem ser substituídas individualmente e a superfície pode ser lixada/restaurada; WPC não pode ser lixado ou restaurado",
        "Preço: deck de madeira tropical R$ 280-680/m²; WPC de qualidade R$ 250-500/m² — a diferença de preço é menor do que se imagina",
        "Valorização do imóvel: madeira natural valoriza; WPC é percebido como substituto inferior em projetos de alto padrão",
      ]} />

      <ArticleHighlight>
        O deck de madeira plástica pode ser adequado para projetos onde a manutenção zero é prioridade absoluta. Mas em projetos de alto padrão — onde a estética, o conforto térmico ao pisar descalço e a valorização do imóvel importam — a madeira natural é a escolha inequívoca.
      </ArticleHighlight>

      <ArticleDivider />

      <ArticleH2>Estrutura do deck: a base invisível que determina a longevidade</ArticleH2>
      <ArticleP>
        Um deck bem executado depende fundamentalmente de uma estrutura de apoio corretamente dimensionada. A estrutura é a parte que ninguém vê após a instalação — mas é ela que determina se o deck vai funcionar perfeitamente por 30 anos ou apresentar problemas em 5.
      </ArticleP>

      <ArticleH3>Barrotes (vigas de apoio)</ArticleH3>
      <ArticleP>
        Os barrotes são as vigas horizontais sobre as quais as tábuas do deck são fixadas. Podem ser de madeira tratada em autoclave (com CCA ou CCB) ou de alumínio estrutural. O espaçamento entre barrotes varia de 30cm a 50cm, dependendo da espessura e largura das tábuas. Barrotes de alumínio estrutural são mais caros (adicionam R$ 60 a R$ 100/m²), mas eliminam completamente o risco de apodrecimento e oferecem estabilidade dimensional absoluta — são a escolha premium para projetos de alto padrão.
      </ArticleP>

      <ArticleH3>Sistema de drenagem</ArticleH3>
      <ArticleP>
        A água é o principal inimigo de qualquer estrutura de madeira em área externa. O deck precisa de um sistema que garanta que a água escoe rapidamente sem acumular na superfície ou ficar retida entre as tábuas e a estrutura. O espaçamento entre tábuas (6mm a 8mm) permite drenagem superficial eficiente. Sob o deck, a base deve ter caimento mínimo de 1% a 2% direcionando a água para ralos ou bordas. Em decks sobre laje, a impermeabilização prévia é obrigatória.
      </ArticleP>

      <ArticleH3>Ventilação inferior</ArticleH3>
      <ArticleP>
        O espaço entre o deck e a base (laje, contrapiso ou solo) deve ser permanentemente ventilado. A circulação de ar sob as tábuas é fundamental para que a madeira seque após cada ciclo de chuva, evitando acúmulo de umidade que causa apodrecimento, manchas e proliferação de fungos. A altura livre mínima recomendada entre a face inferior das tábuas e a base é de 50mm — idealmente 80mm a 100mm.
      </ArticleP>

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_BR-05.jpg"
        alt="Deck de madeira cumaru ao redor de piscina de alto padrão"
        caption="Deck em cumaru ao redor de piscina — a estrutura elevada com ventilação inferior e drenagem calculada garante longevidade excepcional mesmo com exposição constante à água."
      />

      <ArticleH2>Fixação oculta vs. fixação aparente: qual sistema usar</ArticleH2>

      <ArticleH3>Fixação oculta (clip) — o padrão premium</ArticleH3>
      <ArticleP>
        Sistema onde as tábuas são fixadas por clips metálicos de aço inoxidável inseridos nos encaixes laterais entre elas. Nenhum parafuso fica visível na superfície do deck. É o sistema obrigatório em projetos de alto padrão — cria uma superfície limpa, uniforme e sem pontos metálicos expostos que podem aquecer excessivamente ao sol e causar desconforto. Os clips também permitem a microexpansão natural da madeira, reduzindo o risco de empenamento.
      </ArticleP>

      <ArticleH3>Fixação aparente (parafuso inox) — custo mais acessível</ArticleH3>
      <ArticleP>
        As tábuas são fixadas com parafusos de aço inoxidável 304 ou 316 diretamente nos barrotes. Os parafusos ficam visíveis na superfície, criando um padrão regular que pode conferir uma estética industrial, rústica ou náutica. Custo de material 30-40% menor que o sistema oculto. Manutenção mais simples — tábuas individuais podem ser facilmente substituídas desparafusando.
      </ArticleP>

      <ArticleDivider />

      <ArticleH2>Deck de madeira sobre diferentes bases: soluções para cada situação</ArticleH2>
      <ArticleList items={[
        "Sobre laje (coberturas e varandas) — exige impermeabilização prévia e sistema de apoio com pedestais reguláveis ou barrotes sobre calços de borracha. Permite nivelar desníveis de até 150mm",
        "Sobre contrapiso existente — barrotes colados ou chumbados ao contrapiso. Exige contrapiso com caimento para drenagem e impermeabilização",
        "Sobre solo natural (jardins) — exige preparação com manta geotêxtil anti-ervas, camada de brita compactada e barrotes sobre sapatas de concreto ou pedestais. Ideal para áreas de paisagismo",
        "Sobre estrutura elevada (casas de praia/campo) — decks suspensos sobre pilares de concreto, aço ou madeira tratada. Comuns em terrenos com desnível ou em projetos de casas sobre palafitas",
        "Em torno de piscinas — exige espécies certificadas para contato com água clorada, bordas de segurança com perfil antiderrapante e caimento afastando a água da piscina",
      ]} />

      <ArticleH2>Como fazer a manutenção do deck de madeira</ArticleH2>
      <ArticleP>
        A manutenção periódica é o que diferencia um deck que dura 10 anos de um que dura 30+. Os cuidados são simples, mas precisam ser regulares e consistentes.
      </ArticleP>
      <ArticleList items={[
        "Limpeza trimestral — água e escova de cerdas macias (náilon, nunca aço). Remove sujeira, folhas, acúmulo orgânico e princípio de mofo",
        "Lavagem semestral ou anual — hidrojateamento de baixa pressão (máximo 100 bar, a 30cm de distância). Remove escurecimento superficial e manchas",
        "Reaplicação de óleo protetor — a cada 6 a 12 meses, dependendo da exposição solar. Óleos recomendados: Osmo, Rubio Monocoat, Sayerlack. Aplicação com trincha ou rolo de espuma, sempre no sentido do veio",
        "Inspeção de fixações — semestral. Clips ou parafusos que se soltaram devem ser reajustados. Parafusos de aço inox não enferrujam, mas podem afrouxar com a movimentação da madeira",
        "Verificação da estrutura — anual. Checar barrotes de madeira quanto a sinais de deterioração, umidade retida e presença de insetos",
        "Opção pela pátina natural (prateada) — se o projeto aceita a evolução natural da cor, nenhuma reaplicação de óleo é necessária. A madeira desenvolve uma camada protetora superficial e assume uma tonalidade prateada elegante e uniforme",
      ]} />

      <ArticleHighlight>
        O deck de madeira é a ponte entre a arquitetura e a natureza. Quando bem executado com espécie adequada, estrutura calculada e manutenção regular, ele se integra ao paisagismo dissolvendo os limites entre o construído e o natural — e dura tanto quanto a casa que o cerca.
      </ArticleHighlight>

      <ArticleH2>Conclusão: como especificar o deck de madeira ideal</ArticleH2>
      <ArticleP>
        Especificar um deck de madeira para um projeto de alto padrão exige domínio técnico simultâneo da espécie, do sistema construtivo, das condições ambientais e do uso previsto. Não é um produto de prateleira — é uma solução de engenharia que precisa ser projetada e executada por equipe especializada com experiência comprovada em áreas externas.
      </ArticleP>
      <ArticleP>
        A Parket oferece decks em cumaru, ipê, garapa e Kebony, com sistemas de fixação oculta premium, barrotes de alumínio estrutural, estrutura calculada por engenheiro e equipe de instalação própria. Cada deck é tratado como projeto individual — porque cada área externa tem suas particularidades de exposição solar, regime de chuvas, uso e linguagem arquitetônica. Mais de 500 projetos entregues em São Paulo e litoral paulista.
      </ArticleP>

      <ArticleFAQ items={[
        {
          question: "Quanto custa o deck de madeira por m² em 2026?",
          answer: "O preço varia conforme a espécie: deck de garapa R$ 280 a R$ 420/m², cumaru R$ 380 a R$ 550/m², ipê R$ 450 a R$ 680/m² e Kebony R$ 500 a R$ 750/m². Esses valores incluem material, estrutura de barrotes e instalação por equipe especializada. Sistemas de fixação oculta e barrotes de alumínio adicionam R$ 60 a R$ 120/m² ao custo total."
        },
        {
          question: "Qual a melhor madeira para deck de piscina?",
          answer: "Para decks ao redor de piscinas, as melhores opções são cumaru e ipê — ambas com densidade acima de 1.000 kg/m³, durabilidade natural classe 1 e resistência comprovada ao contato com água clorada. O cumaru é a escolha mais popular por oferecer excelente custo-benefício. O ipê é a opção premium para quem busca a máxima longevidade. Garapa é uma alternativa de custo mais acessível para áreas menos expostas."
        },
        {
          question: "Deck de madeira esquenta muito ao sol?",
          answer: "Significativamente menos que deck de WPC (madeira plástica) ou pedras escuras. A madeira natural tem condutividade térmica inferior a materiais compostos — a temperatura superficial de um deck de cumaru em pleno sol fica entre 40°C e 45°C, enquanto um deck de WPC pode atingir 60°C a 70°C. É perfeitamente possível caminhar descalço sobre deck de madeira natural ao sol, o que não é recomendável com WPC."
        },
        {
          question: "Quanto tempo dura um deck de madeira?",
          answer: "Com a espécie correta e manutenção adequada: cumaru e ipê duram 30 a 40+ anos. Garapa dura 20 a 30 anos. Kebony 25 a 35 anos. Sem manutenção (pátina natural), a durabilidade estrutural é a mesma — apenas a aparência muda para uma tonalidade prateada. A estrutura de barrotes de alumínio dura indefinidamente; barrotes de madeira tratada duram 15 a 25 anos."
        },
        {
          question: "Deck de madeira ou deck de madeira plástica (WPC)?",
          answer: "Para projetos de alto padrão, o deck de madeira natural é superior em estética, conforto térmico (não esquenta como WPC), sustentabilidade, reparabilidade e valorização do imóvel. O WPC pode ser adequado para projetos onde a manutenção zero é prioridade absoluta, mas tem limitações: esquenta muito ao sol, padrão visual repetitivo, não pode ser lixado/restaurado e a diferença de preço para a madeira natural é menor do que se imagina (15-25%)."
        },
        {
          question: "Como evitar que o deck de madeira fique cinza?",
          answer: "A madeira fica cinza (pátina prateada) quando exposta ao sol e à chuva sem proteção de óleo. Para manter a cor original, aplique óleo protetor com filtro UV (Osmo, Rubio Monocoat ou similar) a cada 6-12 meses. A reaplicação é simples e pode ser feita pelo proprietário. Alguns arquitetos preferem a pátina prateada — nesse caso, nenhum tratamento é necessário e a madeira desenvolve uma proteção natural."
        },
      ]} />
    </BlogArticleLayout>
  );
}
