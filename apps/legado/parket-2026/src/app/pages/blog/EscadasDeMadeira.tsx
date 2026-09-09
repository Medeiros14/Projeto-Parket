import {
  BlogArticleLayout, ArticleH2, ArticleH3, ArticleP, ArticleList,
  ArticleImage, ArticleHighlight, ArticleDivider, ArticleFAQ, ArticleSummary,
} from "../../components/BlogArticleLayout";
import { ZoomImage } from "../../components/ZoomImage";

const relatedArticles = [
  { title: "Marcenaria arquitetônica: painéis, portas ocultas e mobiliário sob medida", slug: "marcenaria-arquitetonica", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_MA-01.jpg", category: "Marcenaria" },
  { title: "Piso de madeira: guia completo — tipos, preços e como escolher [2026]", slug: "piso-de-madeira-guia", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-01.jpg", category: "Pisos" },
  { title: "Forro de madeira: tipos, preços e como especificar para projetos de alto padrão", slug: "forro-de-madeira", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_FO-01.jpg", category: "Forros" },
];

export function EscadasDeMadeira() {
  return (
    <BlogArticleLayout
      title="Escada de Madeira: Tipos, Espécies, Preços e Como Especificar [Guia 2026]"
      subtitle="Escada revestida, estrutural e flutuante — tipos, espécies de madeira ideais, engenharia estrutural, detalhes de marcenaria, preço médio e o processo completo para especificar escadas de madeira de alto padrão."
      heroImage="https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-01.jpg"
      category="Escadas"
      readTime="14 min de leitura"
      publishDate="3 mar. 2026"
      relatedArticles={relatedArticles}
    >
      <ArticleSummary
        title="O que você vai encontrar neste guia"
        items={[
          "Os 3 tipos de escada de madeira: revestida, estrutural e flutuante — quando usar cada um",
          "As melhores espécies de madeira para escada (carvalho, cumaru, freijó, ipê)",
          "Quanto custa uma escada de madeira em 2026 — faixas de investimento",
          "O processo completo: do levantamento ao projeto 3D, produção CNC e instalação",
          "Detalhes que definem a qualidade: nariz do pisante, junções, corrimão e iluminação",
          "Escada de madeira vs. escada de porcelanato vs. escada de mármore — comparativo",
        ]}
      />

      <ArticleP>
        A escada é frequentemente o elemento que define o caráter de uma residência. É a peça que conecta pavimentos, mas que vai muito além da função vertical — quando executada em madeira, a escada se torna uma escultura habitável, uma peça de engenharia visível e um statement arquitetônico que é visto de múltiplos ângulos e alturas.
      </ArticleP>
      <ArticleP>
        Diferentemente de um piso ou de um forro, a escada combina três disciplinas simultaneamente: engenharia estrutural (precisa sustentar cargas dinâmicas de até 300 kg por degrau), marcenaria de precisão milimétrica (cada peça é customizada para o espaço específico) e design tridimensional (é observada por baixo, pelos lados e de frente). Essa complexidade é o que torna a escada de madeira uma das peças mais nobres — e mais desafiadoras — da arquitetura residencial.
      </ArticleP>

      <ArticleDivider />

      <ArticleH2>Quais são os tipos de escada de madeira</ArticleH2>

      <ArticleH3>Escada revestida em madeira</ArticleH3>
      <ArticleP>
        A escada revestida transforma uma estrutura existente de concreto, metal ou alvenaria em uma peça de madeira nobre. Pisantes, espelhos (parte vertical do degrau) e laterais são produzidos sob medida em madeira maciça e instalados com encaixe preciso sobre a base existente. É a solução mais versátil e mais especificada — adequada tanto para projetos novos (onde a estrutura de concreto é executada pela construtora) quanto para reformas (onde a escada existente é completamente transformada).
      </ArticleP>
      <ArticleList items={[
        "Pisantes maciços de 30mm a 40mm de espessura — garantem rigidez e durabilidade",
        "Espelhos e laterais na mesma espécie ou em material contrastante (vidro, metal, pintura)",
        "Encaixe sobre base de concreto, metal ou alvenaria — cada peça é templada no local",
        "Corrimão e guarda-corpo opcionais em madeira maciça, perfil arredondado ou reto",
        "Combinação frequente com guarda-corpo em vidro temperado — leveza visual máxima",
        "Preço médio em 2026: R$ 2.500 a R$ 6.000 por degrau (com pisante, espelho e acabamento)",
      ]} />

      <ArticleH3>Escada estrutural em madeira</ArticleH3>
      <ArticleP>
        A escada estrutural é projetada e executada inteiramente em madeira — da estrutura de sustentação portante aos acabamentos finais. Não existe base de concreto: a madeira é simultaneamente estrutura e acabamento. Cada componente é calculado estruturalmente por engenheiro para suportar cargas estáticas e dinâmicas, e produzido com encaixes de marcenaria de alta precisão. É a solução para projetos onde a madeira precisa ser protagonista absoluta — sem metal, sem concreto, apenas madeira e engenharia.
      </ArticleP>
      <ArticleList items={[
        "Estrutura autoportante em madeira maciça laminada colada (MLC) ou maciça monolítica",
        "Cálculo estrutural dedicado por engenheiro civil com ART",
        "Encaixes de marcenaria artesanal: cauda de andorinha, emenda finger-joint, sambladuras",
        "Vãos livres de até 4 metros entre apoios",
        "Projeto personalizado desenvolvido em diálogo direto com o arquiteto",
        "Preço médio em 2026: R$ 4.000 a R$ 10.000 por degrau (projeto estrutural + produção + instalação)",
      ]} />

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-03.jpg"
        alt="Escada estrutural em madeira maciça de freijó em projeto residencial"
        caption="Escada estrutural em freijó — cada componente é calculado por engenheiro e executado com precisão milimétrica em CNC e marcenaria artesanal."
      />

      <ArticleH3>Escada flutuante (degraus suspensos)</ArticleH3>
      <ArticleP>
        A escada flutuante é a expressão máxima da leveza e do minimalismo na arquitetura contemporânea. Cada pisante é fixado individualmente à parede estrutural ou a um perfil metálico oculto na parede, gerando um efeito visual de degraus suspensos no vazio. É uma peça escultural que desafia a percepção de gravidade e define a personalidade do espaço de forma dramática.
      </ArticleP>
      <ArticleList items={[
        "Pisantes engastados em parede estrutural (mínimo 20cm de alvenaria) ou fixados em perfil metálico oculto embutido na parede",
        "Espessura dos pisantes de 40mm a 60mm para garantir rigidez sob carga dinâmica",
        "Efeito visual de suspensão, leveza e transparência espacial",
        "Combinação frequente com guarda-corpo em vidro temperado ou cabos de aço tensionados",
        "Exige projeto estrutural específico — a parede precisa ser dimensionada para suportar as cargas pontuais de cada degrau",
        "Preço médio em 2026: R$ 3.500 a R$ 8.000 por degrau (estrutura metálica oculta + pisante + acabamento)",
      ]} />

      <ArticleHighlight>
        A escada de madeira é possivelmente a peça mais complexa da marcenaria arquitetônica — cada milímetro conta, cada ângulo importa, e o resultado final é a soma indissociável de engenharia, artesanato e sensibilidade estética.
      </ArticleHighlight>

      <ArticleH2>Qual a melhor madeira para escada</ArticleH2>
      <ArticleP>
        A escolha da espécie para escada precisa equilibrar três critérios: resistência mecânica (a escada recebe impactos dinâmicos a cada passo), estética (é uma peça escultural vista de múltiplos ângulos) e trabalhabilidade (precisa permitir usinagem de precisão em CNC e detalhes artesanais de marcenaria).
      </ArticleP>

      <ArticleH3>Carvalho europeu — o clássico universal</ArticleH3>
      <ArticleP>
        Densidade de 710 kg/m³, dureza adequada para tráfego intenso com excelente conforto tátil no pisante. Veios longos e regulares que criam uma estética refinada e atemporal. Disponível em acabamentos naturais, defumados e branqueados. Permite unidade material com piso e forro quando a mesma espécie é utilizada em todo o projeto. É a espécie mais especificada para escadas de alto padrão na Europa e cada vez mais presente no Brasil.
      </ArticleP>

      <ArticleH3>Cumaru — resistência absoluta</ArticleH3>
      <ArticleP>
        Densidade de 1.100 kg/m³ — praticamente indestrutível sob tráfego intenso. Ideal para escadas de residências com crianças, pets e alto fluxo de pessoas, ou em projetos comerciais. Tonalidade castanho dourado rica que escurece levemente com o tempo, ganhando profundidade. A espécie que oferece a maior resistência mecânica entre as opções disponíveis.
      </ArticleP>

      <ArticleH3>Freijó — complexidade geométrica</ArticleH3>
      <ArticleP>
        Excelente trabalhabilidade para peças curvas, helicoidais e detalhes de marcenaria fina. Tonalidade castanho médio dourado que remete ao carvalho tropical, com veios elegantes e presença sofisticada. A espécie preferida para escadas que exigem curvas, geometrias complexas e acabamento artesanal refinado.
      </ArticleP>

      <ArticleH3>Ipê — nobreza e longevidade máximas</ArticleH3>
      <ArticleP>
        Coloração marrom escuro a oliva com presença imponente e sofisticada. Para escadas que precisam durar gerações com mínima manutenção e que pedem uma estética dramática e profunda. Ideal quando o projeto demanda presença visual máxima e resistência extrema.
      </ArticleP>

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-06.jpg"
        alt="Escada de madeira revestida em carvalho europeu com guarda-corpo de vidro"
        caption="Escada revestida em carvalho europeu com guarda-corpo em vidro temperado — a combinação de madeira e vidro cria leveza e sofisticação simultâneas."
      />

      <ArticleH2>Escada de madeira vs. escada de porcelanato vs. escada de mármore</ArticleH2>
      <ArticleP>
        A escolha do material de revestimento da escada impacta significativamente a estética, o conforto e a segurança do projeto:
      </ArticleP>
      <ArticleList items={[
        "Conforto térmico: madeira é naturalmente quente ao toque; porcelanato e mármore são frios — especialmente desagradável para subir/descer descalço no inverno",
        "Segurança antiderrapante: madeira com acabamento acetinado ou óleo oferece aderência natural; porcelanato polido e mármore são escorregadios (especialmente com meia)",
        "Conforto acústico: madeira absorve ruído de passos; porcelanato e mármore amplificam (especialmente em escadas com vão livre)",
        "Restaurabilidade: pisantes de madeira podem ser lixados e reenvernizados; porcelanato e mármore trincados precisam ser substituídos",
        "Personalização: madeira permite qualquer formato, curva e detalhe artesanal; porcelanato e mármore são limitados a cortes retos",
        "Investimento: escada revestida em madeira R$ 2.500-6.000/degrau; porcelanato R$ 800-2.500/degrau; mármore R$ 3.000-8.000/degrau",
      ]} />

      <ArticleDivider />

      <ArticleH2>Como é o processo de projeto e execução de uma escada de madeira</ArticleH2>
      <ArticleP>
        Diferentemente de pisos e forros (que são produtos relativamente padronizáveis), a escada é sempre um projeto único e irreprodutível. Cada escada é desenhada para um espaço específico, com dimensões, ângulos, alturas e proporções exclusivas. O processo típico de uma escada de alto padrão envolve:
      </ArticleP>
      <ArticleList items={[
        "Levantamento dimensional in loco — medição com laser scanner 3D de todos os pontos de referência: piso inferior, piso superior, paredes laterais, aberturas, instalações",
        "Projeto executivo em 3D — modelagem completa da escada com todas as peças dimensionadas, numeradas, cotadas e sequenciadas para produção e montagem",
        "Aprovação do projeto com o arquiteto — validação de dimensões, materiais, acabamentos, guarda-corpo, iluminação e detalhes construtivos",
        "Produção em oficina com CNC + marcenaria artesanal — peças cortadas com precisão de 0,1mm em CNC e finalizadas com ajustes artesanais",
        "Pré-montagem completa em fábrica — a escada é montada integralmente na oficina antes do envio ao canteiro, garantindo encaixe perfeito",
        "Instalação por equipe especializada — montagem final no local com ajustes de precisão, calafetação e acabamento in loco",
        "Vistoria final com o arquiteto — inspeção conjunta de todos os detalhes, ajustes e aceite do projeto",
      ]} />

      <ArticleH2>Detalhes que diferenciam uma escada excepcional de uma escada comum</ArticleH2>
      <ArticleList items={[
        "Nariz do pisante (boleado) — o perfil do bordo frontal do degrau define o conforto ao subir e a estética vista de frente. Perfis retos criam linguagem minimalista; perfis boleados criam suavidade e conforto",
        "Junção pisante-espelho — como o pisante encontra o espelho (encaixe reto, meia-esquadria a 45° ou espelho recuado 20mm) define a linguagem visual da escada",
        "Corrimão — seção (circular, oval, retangular), dimensão (Ø 40mm a 60mm), material e sistema de fixação. Um corrimão de seção oval em madeira maciça é incomparavelmente superior a um tubo metálico",
        "Iluminação integrada — fitas LED embutidas sob o nariz do pisante ou em recortes laterais criam efeito cênico noturno e melhoram significativamente a segurança",
        "Acabamento antiderrapante — o acabamento dos pisantes deve ser acetinado ou em óleo (nunca alto brilho), garantindo aderência segura mesmo com pés descalços ou meias",
      ]} />

      <ArticleH2>Conclusão: a escada como peça de arquitetura</ArticleH2>
      <ArticleP>
        A escada de madeira é uma das peças mais nobres e complexas da arquitetura residencial. Especificá-la corretamente exige domínio simultâneo de engenharia estrutural, marcenaria de precisão e design tridimensional — e a execução precisa de uma equipe que trabalhe com tolerâncias milimétricas e equipamentos CNC de última geração.
      </ArticleP>
      <ArticleP>
        Na Parket, cada escada é tratada como projeto individual — do levantamento dimensional com laser ao projeto executivo 3D, da produção CNC em fábrica própria à instalação por equipe especializada. Trabalhamos com as principais espécies de madeira do mundo, equipamentos de última geração e marceneiros com décadas de experiência. O resultado são escadas que definem projetos — e que são lembradas por quem as sobe pela primeira vez.
      </ArticleP>

      <ArticleFAQ items={[
        {
          question: "Quanto custa uma escada de madeira em 2026?",
          answer: "O preço varia conforme o tipo: escada revestida em madeira (sobre base de concreto) custa entre R$ 2.500 e R$ 6.000 por degrau. Escada flutuante (degraus suspensos) entre R$ 3.500 e R$ 8.000 por degrau. Escada estrutural integralmente em madeira entre R$ 4.000 e R$ 10.000 por degrau. Uma escada residencial completa de 15 degraus em carvalho europeu, tipo revestida, fica entre R$ 40.000 e R$ 90.000 com projeto, produção e instalação."
        },
        {
          question: "Qual a melhor madeira para escada residencial?",
          answer: "Carvalho europeu é a escolha mais popular globalmente — combina elegância atemporal, dureza adequada e versatilidade de acabamentos. Cumaru é ideal para alto tráfego e máxima resistência. Freijó é a melhor opção para escadas curvas e geometrias complexas. Ipê para presença visual máxima e tonalidade escura. A escolha depende do estilo do projeto, do fluxo de uso e da integração com outros elementos de madeira."
        },
        {
          question: "Escada de madeira é escorregadia?",
          answer: "Não, quando o acabamento é correto. Pisos de madeira com acabamento acetinado ou em óleo natural oferecem excelente aderência — superior ao porcelanato polido e ao mármore. O acabamento nunca deve ser alto brilho em escadas. A Parket utiliza acabamentos específicos para pisantes de escada com coeficiente de atrito adequado para uso seguro mesmo com pés descalços ou meias."
        },
        {
          question: "É possível revestir uma escada de concreto com madeira?",
          answer: "Sim, essa é a solução mais comum e mais versátil. A escada revestida transforma uma estrutura de concreto ou metal em uma peça de madeira nobre. Pisantes, espelhos e laterais são produzidos sob medida e instalados com encaixe preciso sobre a base existente. O processo inclui templação no local, produção em oficina e instalação por equipe especializada."
        },
        {
          question: "Escada flutuante é segura?",
          answer: "Sim, quando projetada e executada corretamente. Cada pisante flutuante é calculado por engenheiro para suportar no mínimo 300 kg de carga pontual. A fixação pode ser feita diretamente em parede estrutural (mínimo 20cm de alvenaria armada) ou em perfil metálico oculto embutido na parede. A combinação com guarda-corpo de vidro temperado ou cabos de aço tensionados garante segurança conforme norma NBR 9077."
        },
      ]} />
    </BlogArticleLayout>
  );
}
