import {
  BlogArticleLayout, ArticleH2, ArticleP, ArticleList,
  ArticleImage, ArticleHighlight, ArticleDivider, ArticleFAQ,
} from "../../components/BlogArticleLayout";
import { ZoomImage } from "../../components/ZoomImage";

const relatedArticles = [
  { title: "Forro de madeira: tipos, preços e como especificar [Guia 2026]", slug: "forro-de-madeira", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_FO-01.jpg", category: "Forros" },
  { title: "Piso de madeira: guia completo — tipos, preços e como escolher", slug: "piso-de-madeira-guia", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-01.jpg", category: "Pisos" },
  { title: "Marcenaria arquitetônica: o que é, quanto custa e como especificar", slug: "marcenaria-arquitetonica", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_MA-01.jpg", category: "Marcenaria" },
];

export function ForroRipadoVsContinuo() {
  return (
    <BlogArticleLayout
      title="Forro Ripado ou Contínuo? Como Decidir para o Seu Projeto [2026]"
      subtitle="Estética, acústica, custo e aplicação — quando usar forro ripado e quando optar pelo contínuo. Guia prático com exemplos de projetos reais."
      heroImage="https://parket.com.br/wp-content/uploads/2025/10/PRO_FO-02.jpg"
      category="Forros"
      readTime="8 min de leitura"
      publishDate="14 mar. 2026"
      relatedArticles={relatedArticles}
    >
      <ArticleP>
        A escolha entre forro ripado e forro contínuo é uma das decisões mais frequentes na especificação de interiores de alto padrão. Ambos usam madeira natural, ambos criam ambientes sofisticados, mas produzem efeitos radicalmente diferentes — tanto estéticos quanto funcionais. Este artigo ajuda a tomar essa decisão com base em critérios técnicos e projetuais. Para uma visão completa de todos os tipos de forro, incluindo o colmeia, leia nosso <a href="/blog/forro-de-madeira" className="text-[#9C8B6E] underline underline-offset-2 hover:text-[#2A2A2A] transition-colors">Guia Completo de Forro de Madeira</a>.
      </ArticleP>

      <ArticleH2>Forro Contínuo: Superfície Fluida e Uniforme</ArticleH2>
      <ArticleP>
        O forro contínuo cria um plano homogêneo no teto, onde as junções entre as tábuas são quase imperceptíveis. O encaixe macho e fêmea garante alinhamento preciso, e o resultado visual é de uma superfície fluida de madeira que "abraça" o ambiente. É a escolha para projetos que buscam amplitude, serenidade e protagonismo da madeira como textura pura.
      </ArticleP>
      <ArticleP>
        Funciona excepcionalmente bem em grandes vãos — salas de estar, quartos com pé-direito generoso e áreas sociais integradas. A iluminação embutida pode ser integrada de forma discreta, com rasgos lineares ou spots embutidos que não competem com a superfície.
      </ArticleP>

      <ArticleImage
        src="https://parket.com.br/wp-content/uploads/2025/10/PRO_FO-03.jpg"
        alt="Forro contínuo em freijó"
        caption="Forro contínuo em freijó com iluminação embutida — Casa Boa Vista, Porto Feliz"
      />

      <ArticleH2>Forro Ripado: Ritmo, Luz e Profundidade</ArticleH2>
      <ArticleP>
        O forro ripado introduz ritmo visual através de ripas espaçadas com precisão milimétrica. O espaçamento entre as ripas — que pode variar de 10mm a 40mm — cria jogos de luz e sombra que mudam ao longo do dia, dando ao ambiente uma qualidade dinâmica e expressiva.
      </ArticleP>
      <ArticleP>
        É a escolha para projetos que buscam expressão gráfica, movimento e interação com a luz natural. Funciona particularmente bem em varandas (onde a luz entra lateralmente), áreas gourmet (criando atmosfera de refúgio) e espaços comerciais (restaurantes, hotéis, escritórios) que precisam de identidade visual forte.
      </ArticleP>

      <ArticleHighlight>
        "O forro contínuo é silêncio visual — a madeira como superfície contemplativa. O forro ripado é ritmo — a madeira como composição gráfica. A escolha depende da linguagem que o projeto precisa comunicar."
      </ArticleHighlight>

      <ArticleH2>Comparativo Técnico</ArticleH2>

      <ArticleP>
        <strong>Acústica:</strong> O forro ripado tem desempenho acústico ligeiramente superior em ambientes reverberantes, porque os espaços entre as ripas permitem que o som seja parcialmente absorvido pela câmara de ar posterior. O forro contínuo, por ser uma superfície reflexiva, pode precisar de tratamento acústico adicional em ambientes grandes.
      </ArticleP>
      <ArticleP>
        <strong>Manutenção:</strong> O forro contínuo é mais fácil de limpar — basta um pano úmido. O forro ripado acumula mais poeira entre as ripas e exige limpeza com soprador ou aspirador periódico. Em áreas externas cobertas, o ripado pode acumular insetos e detritos nos vãos.
      </ArticleP>
      <ArticleP>
        <strong>Custo:</strong> O forro ripado tende a ser 10% a 20% mais caro que o contínuo, porque exige mais precisão na instalação (cada ripa precisa de espaçamento uniforme) e mais madeira por m² linear. A estrutura de fixação também é mais complexa.
      </ArticleP>
      <ArticleP>
        <strong>Integração com iluminação:</strong> Ambos integram iluminação, mas de formas diferentes. O contínuo suporta rasgos lineares e spots embutidos com acabamento flush. O ripado permite fitas LED instaladas acima das ripas, criando um efeito de iluminação indireta que "brilha" entre os vãos — efeito impossível no contínuo.
      </ArticleP>

      <ArticleH2>Quando Escolher Cada Um</ArticleH2>
      <ArticleP><strong>Use forro contínuo quando:</strong></ArticleP>
      <ArticleList items={[
        "O projeto pede amplitude visual e superfícies uniformes",
        "O ambiente é uma suíte, living ou spa onde a serenidade é prioridade",
        "A manutenção fácil é critério relevante (cozinhas, áreas de serviço)",
        "O pé-direito é baixo e o objetivo é ampliar a percepção de altura",
      ]} />

      <ArticleP><strong>Use forro ripado quando:</strong></ArticleP>
      <ArticleList items={[
        "O projeto busca ritmo visual, expressão gráfica e movimento",
        "O ambiente é uma varanda, área gourmet ou espaço comercial",
        "A interação com luz natural é desejada (sol lateral, claraboias)",
        "O projeto pede iluminação indireta entre ripas (efeito LED)",
        "O conforto acústico é relevante (restaurantes, escritórios abertos)",
      ]} />

      <ArticleDivider />

      <ArticleFAQ items={[
        { question: "Posso combinar forro ripado e contínuo no mesmo projeto?", answer: "Sim, e é uma solução muito sofisticada. Muitos projetos usam forro contínuo na área social (sala, suíte) e ripado nas varandas e áreas gourmet, criando uma transição interessante entre ambientes." },
        { question: "Qual espécie de madeira é melhor para forro?", answer: "Tauari e Freijó são as mais indicadas para interiores pela leveza e tonalidade. Cumaru e Ipê para áreas externas cobertas. Carvalho Europeu para projetos que buscam padrão internacional. Veja todas as opções no nosso guia completo." },
        { question: "Forro de madeira funciona em banheiro?", answer: "Sim, desde que se use espécies resistentes à umidade (Cumaru, Ipê) com acabamento impermeabilizante adequado e ventilação posterior. Recomendamos sempre o forro ripado em banheiros para permitir ventilação." },
      ]} />
    </BlogArticleLayout>
  );
}
