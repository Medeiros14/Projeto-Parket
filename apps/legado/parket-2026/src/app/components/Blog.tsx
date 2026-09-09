import { motion } from "motion/react";
import { Clock } from "lucide-react";
import { useScrollReveal } from "../hooks/useParallax";
import { useNavigate } from "react-router";
import { useRef, useState, useEffect } from "react";

const blogPosts = [
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
];

const label = "text-[14px] uppercase tracking-[0.12em]";
const thin = { fontWeight: 200 } as const;
const medium = { fontWeight: 500 } as const;
const regular = { fontWeight: 400 } as const;

export function Blog() {
  const { ref, opacity, y } = useScrollReveal();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.firstElementChild
        ? (container.firstElementChild as HTMLElement).offsetWidth + 16
        : 1;
      setActiveIdx(Math.round(scrollLeft / cardWidth));
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section id="blog" className="bg-[#FAF8F5] py-10 md:py-16">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        {/* Section header */}
        <motion.div ref={ref} style={{ opacity, y }} className="relative mb-8 md:mb-16">
          <p className={`text-[#9C8B6E] ${label} mb-4`} style={medium}>
            Blog
          </p>
          <h2
            className="text-[#2A2A2A] text-[28px] md:text-[36px] lg:text-[48px] leading-[1.1] tracking-[0.02em]"
            style={thin}
          >
            Leituras que inspiram
          </h2>
        </motion.div>

        {/* Mobile horizontal carousel */}
        <div className="md:hidden">
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-6 px-6"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {blogPosts.map((post) => (
              <article
                key={post.id}
                className="snap-start shrink-0 w-[280px] cursor-pointer group"
                onClick={() => navigate(post.slug)}
              >
                <div className="aspect-[4/3] overflow-hidden mb-3">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="flex items-center gap-2 mb-2 text-[#8C8478]">
                  <span className="text-[11px] uppercase tracking-[0.08em]" style={medium}>
                    {post.category}
                  </span>
                  <span className="text-[#D9D3CB]">|</span>
                  <span className="flex items-center gap-1 text-[11px]" style={regular}>
                    <Clock size={11} /> {post.readTime}
                  </span>
                </div>
                <h3
                  className="text-[#2A2A2A] text-[15px] leading-[1.35] tracking-[0.01em] mb-2 line-clamp-3 group-hover:text-[#9C8B6E] transition-colors duration-300"
                  style={{ fontWeight: 500 }}
                >
                  {post.title}
                </h3>
                <span className="text-[#8C8478]/60 text-[12px]" style={regular}>
                  {post.date}
                </span>
              </article>
            ))}
          </div>
          {/* Dots indicator */}
          <div className="flex justify-center gap-1.5 mt-4">
            {blogPosts.map((_, idx) => (
              <div
                key={idx}
                className={`h-[3px] transition-all duration-300 ${
                  idx === activeIdx ? "w-5 bg-[#9C8B6E]" : "w-[6px] bg-[#D9D3CB]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Desktop: Featured article */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="hidden md:block group cursor-pointer mb-12"
          onClick={() => navigate(blogPosts[0].slug)}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
            <div className="aspect-[16/10] overflow-hidden">
              <img
                src={blogPosts[0].image}
                alt={blogPosts[0].title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4 text-[#8C8478]">
                <span className="text-[11px] uppercase tracking-[0.08em]" style={medium}>
                  {blogPosts[0].category}
                </span>
                <span className="text-[#D9D3CB]">|</span>
                <span className="flex items-center gap-1 text-[11px]" style={regular}>
                  <Clock size={11} /> {blogPosts[0].readTime}
                </span>
                <span className="text-[#D9D3CB]">|</span>
                <span className="text-[11px]" style={regular}>{blogPosts[0].date}</span>
              </div>
              <h3
                className="text-[#2A2A2A] text-[22px] md:text-[28px] leading-[1.2] tracking-[0.02em] mb-4 group-hover:text-[#9C8B6E] transition-colors duration-300"
                style={{ fontWeight: 300 }}
              >
                {blogPosts[0].title}
              </h3>
              <p className="text-[#8C8478] text-[15px] leading-[1.65] mb-6" style={regular}>
                {blogPosts[0].excerpt}
              </p>
              <span className={`text-[#9C8B6E] ${label} group-hover:text-[#2A2A2A] transition-colors duration-300`} style={medium}>
                Ler artigo completo →
              </span>
            </div>
          </div>
        </motion.article>

        {/* Grid of remaining articles - desktop only */}
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {blogPosts.slice(1).map((post, idx) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="group cursor-pointer"
              onClick={() => navigate(post.slug)}
            >
              {/* Image */}
              <div className="aspect-[4/3] overflow-hidden mb-4">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 mb-3 text-[#8C8478]">
                <span
                  className="text-[11px] uppercase tracking-[0.08em]"
                  style={medium}
                >
                  {post.category}
                </span>
                <span className="text-[#D9D3CB]">|</span>
                <div className="flex items-center gap-1">
                  <Clock size={11} className="text-[#8C8478]" />
                  <span className="text-[11px]" style={regular}>
                    {post.readTime}
                  </span>
                </div>
              </div>

              {/* Title */}
              <h3
                className="text-[#2A2A2A] text-[15px] leading-[1.4] tracking-[0.01em] mb-2 group-hover:text-[#9C8B6E] transition-colors duration-300"
                style={{ fontWeight: 500 }}
              >
                {post.title}
              </h3>

              {/* Excerpt */}
              <p
                className="text-[#8C8478] text-[13px] leading-[1.55] mb-4 line-clamp-2"
                style={regular}
              >
                {post.excerpt}
              </p>

              {/* Date */}
              <span className="text-[#8C8478]/60 text-[12px]" style={regular}>
                {post.date}
              </span>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}