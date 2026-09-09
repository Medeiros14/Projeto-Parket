import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight,  ArrowLeft, Clock  } from "lucide-react";
import { useNavigate } from "react-router";
import { Footer } from "../components/Footer";
import { LeadFormModal } from "../components/LeadFormModal";
import { SEOHead } from "../components/SEOHead";
import { ZoomImage } from "../components/ZoomImage";

const allArticles = [
  {
    id: 1,
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-01.jpg",
    category: "Pisos",
    readTime: "18 min",
    title: "Piso de Madeira: Guia Completo — Tipos, Preços, Espécies e Como Escolher [2026]",
    excerpt:
      "Maciço vs. engenheirado, preço por m², as 7 melhores espécies, sistemas de instalação e comparativo com porcelanato e vinílico.",
    slug: "/blog/piso-de-madeira-guia",
    date: "10 fev. 2026",
  },
  {
    id: 2,
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_FO-01.jpg",
    category: "Forros",
    readTime: "16 min",
    title: "Forro de Madeira: Tipos, Preços, Espécies e Como Especificar [Guia 2026]",
    excerpt:
      "Forro ripado, contínuo e técnico — espécies recomendadas, preço por m², integração com iluminação e comparativo com gesso e PVC.",
    slug: "/blog/forro-de-madeira",
    date: "17 fev. 2026",
  },
  {
    id: 3,
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_BR-01.jpg",
    category: "Decks",
    readTime: "15 min",
    title: "Deck de Madeira: Qual a Melhor Madeira, Quanto Custa e Como Instalar [2026]",
    excerpt:
      "Cumaru, ipê, garapa e Kebony — estrutura técnica, fixação oculta, drenagem, manutenção e comparativo com madeira plástica (WPC).",
    slug: "/blog/deck-de-madeira",
    date: "24 fev. 2026",
  },
  {
    id: 4,
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-01.jpg",
    category: "Escadas",
    readTime: "14 min",
    title: "Escada de Madeira: Tipos, Espécies, Preços e Como Especificar [Guia 2026]",
    excerpt:
      "Revestida, estrutural e flutuante — espécies ideais, preço por degrau, comparativo com porcelanato e mármore e o processo completo.",
    slug: "/blog/escadas-de-madeira",
    date: "3 mar. 2026",
  },
  {
    id: 5,
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_MA-01.jpg",
    category: "Marcenaria",
    readTime: "15 min",
    title: "Marcenaria Arquitetônica: O Que É, Quanto Custa e Como Especificar [Guia 2026]",
    excerpt:
      "Painéis, portas ocultas, cozinhas e bibliotecas — o que diferencia de marcenaria planejada, preços e o processo completo.",
    slug: "/blog/marcenaria-arquitetonica",
    date: "10 mar. 2026",
  },
  {
    id: 6,
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-05.jpg",
    category: "Guia",
    readTime: "13 min",
    title: "Como Escolher uma Empresa de Pisos de Madeira e Marcenaria de Alto Padrão [2026]",
    excerpt:
      "Os 7 critérios técnicos e operacionais para avaliar empresas — checklist com 10 perguntas que você deve fazer antes de fechar.",
    slug: "/blog/como-escolher-empresa-pisos-madeira",
    date: "10 mar. 2026",
  },
  {
    id: 7,
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-01.jpg",
    category: "Pisos",
    readTime: "10 min",
    title: "Cumaru vs Ipê: Qual a Melhor Madeira para Piso e Deck? [Comparativo 2026]",
    excerpt:
      "Densidade, durabilidade, preço por m², estabilidade dimensional e estética — comparativo técnico completo entre as duas madeiras brasileiras mais nobres.",
    slug: "/blog/cumaru-vs-ipe",
    date: "12 mar. 2026",
  },
  {
    id: 8,
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_FO-02.jpg",
    category: "Forros",
    readTime: "8 min",
    title: "Forro Ripado ou Contínuo? Como Decidir para o Seu Projeto [2026]",
    excerpt:
      "Estética, acústica, custo e aplicação — quando usar forro ripado e quando optar pelo contínuo. Guia prático com exemplos de projetos reais.",
    slug: "/blog/forro-ripado-vs-continuo",
    date: "14 mar. 2026",
  },
];

const categories = ["Todos", ...Array.from(new Set(allArticles.map((a) => a.category)))];

const label = "text-[12px] uppercase tracking-[0.12em]";
const thin = { fontWeight: 200 } as const;
const medium = { fontWeight: 500 } as const;
const regular = { fontWeight: 400 } as const;

export function BlogIndex() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todos");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered =
    activeCategory === "Todos"
      ? allArticles
      : allArticles.filter((a) => a.category === activeCategory);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div
      className="w-full min-h-screen bg-[#FAF8F5] relative"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <SEOHead
        title="Blog — Guias Técnicos sobre Madeira, Arquitetura e Design"
        description="Artigos completos sobre pisos de madeira, decks, forros, escadas e marcenaria arquitetônica. Guias técnicos para arquitetos e designers."
        url="https://parket.com.br/blog"
      />

      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          headerScrolled
            ? "bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-[#2A2A2A]/10"
            : "bg-[#FAF8F5]"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 flex items-center justify-between h-20">
          <button onClick={() => navigate("/")} className="relative z-10">
            <span
              className="text-[22px] tracking-[0.12em] uppercase text-[#2A2A2A]"
              style={thin}
            >
              PARKET
            </span>
          </button>
          <button
            onClick={() => navigate("/")}
            className={`flex items-center gap-2 ${label} transition-colors duration-300 hover:opacity-70 text-[#2A2A2A]`}
            style={medium}
          >
            <ArrowLeft size={16} />{" "}
            <span className="hidden sm:inline">Voltar ao Início</span>
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 md:pt-40 pb-10 md:pb-14">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className={`text-[#9C8B6E] ${label} mb-4`} style={medium}>
              Blog
            </p>
            <h1
              className="text-[#2A2A2A] text-[36px] md:text-[48px] lg:text-[64px] leading-[1.08] tracking-[0.02em] max-w-[800px]"
              style={thin}
            >
              Artigos sobre madeira,
              <br />
              arquitetura e design.
            </h1>
            <p
              className="text-[#8C8478] text-[16px] md:text-[18px] leading-[1.65] mt-6 max-w-[560px]"
              style={regular}
            >
              Guias técnicos, inspirações e conhecimento especializado para
              arquitetos, designers e amantes da madeira.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="pb-10 md:pb-14">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-4 py-2 text-[12px] uppercase tracking-[0.08em] transition-all duration-300 ${
                  activeCategory === cat
                    ? "text-[#2A2A2A] bg-[#2A2A2A]/8"
                    : "text-[#8C8478] hover:text-[#2A2A2A]"
                }`}
                style={medium}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured article */}
      {featured && (
        <section className="pb-16 md:pb-20">
          <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
            <motion.article
              key={featured.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="group cursor-pointer"
              onClick={() => navigate(featured.slug)}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={featured.image}
                    alt={featured.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4 text-[#8C8478]">
                    <span
                      className="text-[11px] uppercase tracking-[0.08em]"
                      style={medium}
                    >
                      {featured.category}
                    </span>
                    <span className="text-[#D9D3CB]">|</span>
                    <span
                      className="flex items-center gap-1 text-[11px]"
                      style={regular}
                    >
                      <Clock size={11} /> {featured.readTime}
                    </span>
                    <span className="text-[#D9D3CB]">|</span>
                    <span className="text-[11px]" style={regular}>
                      {featured.date}
                    </span>
                  </div>
                  <h2
                    className="text-[#2A2A2A] text-[24px] md:text-[32px] leading-[1.2] tracking-[0.02em] mb-4 group-hover:text-[#9C8B6E] transition-colors duration-300"
                    style={{ fontWeight: 300 }}
                  >
                    {featured.title}
                  </h2>
                  <p
                    className="text-[#8C8478] text-[15px] leading-[1.65] mb-6"
                    style={regular}
                  >
                    {featured.excerpt}
                  </p>
                  <span
                    className={`text-[#9C8B6E] ${label} group-hover:text-[#2A2A2A] transition-colors duration-300`}
                    style={medium}
                  >
                    Ler artigo completo →
                  </span>
                </div>
              </div>
            </motion.article>
          </div>
        </section>
      )}

      {/* Divider */}
      {rest.length > 0 && (
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
          <hr className="border-t border-[#2A2A2A]/10" />
        </div>
      )}

      {/* Article grid */}
      {rest.length > 0 && (
        <section className="py-16 md:py-20">
          <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
              {rest.map((post, idx) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="group cursor-pointer"
                  onClick={() => navigate(post.slug)}
                >
                  <div className="aspect-[16/10] overflow-hidden mb-5">
                    <img
                      src={post.image}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex items-center gap-3 mb-3 text-[#8C8478]">
                    <span
                      className="text-[11px] uppercase tracking-[0.08em]"
                      style={medium}
                    >
                      {post.category}
                    </span>
                    <span className="text-[#D9D3CB]">|</span>
                    <span
                      className="flex items-center gap-1 text-[11px]"
                      style={regular}
                    >
                      <Clock size={11} /> {post.readTime}
                    </span>
                  </div>
                  <h3
                    className="text-[#2A2A2A] text-[18px] leading-[1.35] tracking-[0.01em] mb-3 group-hover:text-[#9C8B6E] transition-colors duration-300"
                    style={{ fontWeight: 500 }}
                  >
                    {post.title}
                  </h3>
                  <p
                    className="text-[#8C8478] text-[14px] leading-[1.6] line-clamp-3"
                    style={regular}
                  >
                    {post.excerpt}
                  </p>
                  <p
                    className="text-[#8C8478]/50 text-[12px] mt-4"
                    style={regular}
                  >
                    {post.date}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <section className="py-20">
          <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 text-center">
            <p className="text-[#8C8478] text-[16px]" style={regular}>
              Nenhum artigo encontrado nesta categoria.
            </p>
          </div>
        </section>
      )}

      <Footer />
      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}