import { useState, useRef } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useScrollReveal } from "../hooks/useParallax";
import { ZoomImage } from "./ZoomImage";

const revestimentos = [
  { 
    name: "Ipê Tabaco", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-ipe-tabaco.jpg",
    description: "Elegante e marcante, possui tom escuro e uniforme, sendo um dos preferidos para ambientes sofisticados e robustos."
  },
  { 
    name: "Peroba do Campo", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-peroba-do-campo.jpg",
    description: "Tradicional e charmosa, sua coloração variada entre o rosado e o dourado confere autenticidade e beleza natural."
  },
  { 
    name: "Cumaru", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-cumaru.jpg",
    description: "Madeira extremamente resistente, de cor castanho-avermelhada, indicada para projetos que exigem durabilidade e imponência."
  },
  { 
    name: "Freijó", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-freijo.jpg",
    description: "Leve e versátil, o freijó apresenta tonalidade amarelada e veios discretos, trazendo leveza e naturalidade aos espaços."
  },
  { 
    name: "Nogueira", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-nogueira.jpg",
    description: "De tom escuro e elegante, a nogueira transmite calor e requinte, ideal para composições modernas e acolhedoras."
  },
  { 
    name: "Pinho de Riga", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-pinho-de-riga.jpg",
    description: "Madeira histórica e rara, de cor dourada e textura suave, valorizada pelo charme clássico e pela durabilidade."
  },
  { 
    name: "Carvalho Europeu", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-carvalho-europeu.jpg",
    description: "Madeira nobre e versátil, com veios marcantes e tonalidade clara, perfeita para ambientes sofisticados e atemporais."
  },
  { 
    name: "Itaúba", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-itauba.jpg",
    description: "Resistente e de tonalidade castanho-esverdeada, oferece equilíbrio entre rusticidade e sofisticação."
  },
  { 
    name: "Pau Ferro", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-pau-ferro.jpg",
    description: "Resistente e de tonalidade castanho-esverdeada, oferece equilíbrio entre rusticidade e sofisticação."
  },
  { 
    name: "Cabreúva Branca", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-cabreuva-branca.jpg",
    description: "Resistente e de tonalidade castanho-esverdeada, oferece equilíbrio entre rusticidade e sofisticação."
  },
  { 
    name: "Cabreúva Dourada", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-cabreuva-dourada.jpg",
    description: "Apresenta brilho natural e cor dourada, com veios elegantes que proporcionam luxo e vitalidade."
  },
  { 
    name: "Teca", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-teca.jpg",
    description: "Resistente à umidade, com tom dourado-amarronzado e veios sutis, traz sofisticação e longa durabilidade."
  },
  { 
    name: "Tauari", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-tauari.jpg",
    description: "Clara e homogênea, o tauari ilumina os ambientes, oferecendo um visual moderno e minimalista."
  },
  { 
    name: "Catuaba", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/revestimento-catuaba.jpg",
    description: "Madeira de cor intensa e veios bem definidos, ideal para quem busca personalidade e impacto estético."
  },
];

export function Revestimentos() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { ref: titleRef, opacity: titleOp, y: titleY } = useScrollReveal();

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section id="revestimentos" className="bg-[#1A1A1A] py-10 md:py-16 overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        <motion.div
          ref={titleRef}
          style={{ opacity: titleOp, y: titleY }}
          className="relative mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8"
        >
          <div>
            <p
              className="text-[#9C8B6E] text-[14px] uppercase tracking-[0.12em] mb-4"
              style={{ fontWeight: 500 }}
            >
              Revestimentos
            </p>
            <h2
              className="text-[#E8E4DF] text-[32px] md:text-[40px] lg:text-[56px] leading-[1.1] tracking-[0.02em]"
              style={{ fontWeight: 200 }}
            >
              Madeiras nobres,
              <br />
              origens certificadas.
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => scroll("left")}
              className="w-11 h-11 border border-[#E8E4DF]/20 flex items-center justify-center hover:bg-[#E8E4DF] hover:text-[#1A1A1A] hover:border-[#E8E4DF] transition-all duration-300 text-[#E8E4DF]"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-11 h-11 border border-[#E8E4DF]/20 flex items-center justify-center hover:bg-[#E8E4DF] hover:text-[#1A1A1A] hover:border-[#E8E4DF] transition-all duration-300 text-[#E8E4DF]"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Horizontal scroll carousel */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-6 md:px-10 lg:px-20"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {revestimentos.map((rev, idx) => (
          <motion.div
            key={rev.name}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: idx * 0.03 }}
            className="shrink-0 w-[260px] md:w-[300px] group cursor-pointer"
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div className="relative h-[346px] md:h-[400px] overflow-hidden">
              <img
                src={rev.image}
                alt={rev.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
              {/* Number - fixed absolute position */}
              <p
                className="absolute text-[#E8E4DF]/40 text-[12px] uppercase tracking-[0.12em]"
                style={{ 
                  fontWeight: 500,
                  left: '20px',
                  bottom: '115px'
                }}
              >
                {String(idx + 1).padStart(2, "0")}
              </p>
              
              {/* Name - fixed absolute position */}
              <h3
                className="absolute text-[#E8E4DF] text-[20px] tracking-[0.02em]"
                style={{ 
                  fontWeight: 300,
                  left: '20px',
                  bottom: '88px'
                }}
              >
                {rev.name}
              </h3>
              
              {/* Description - hover only */}
              <div
                className={`absolute transition-all duration-500 ${
                  hoveredIdx === idx ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                }`}
                style={{
                  left: '20px',
                  right: '20px',
                  bottom: '8px'
                }}
              >
                <p
                  className="text-[#E8E4DF]/80 text-[13px] leading-[1.5]"
                  style={{ fontWeight: 400 }}
                >
                  {rev.description}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}