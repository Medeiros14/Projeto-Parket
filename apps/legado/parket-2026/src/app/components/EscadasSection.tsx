import { useState, useRef } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useScrollReveal } from "../hooks/useParallax";

const escadas = [
  { name: "Escada Revestida", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-07.jpg", id: "revestidas" },
  { name: "Escada Revestida", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-08.jpg", id: "revestidas" },
  { name: "Escada Estrutural", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-03.jpg", id: "estruturais" },
  { name: "Escada Estrutural", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-09.jpg", id: "estruturais" },
  { name: "Escada Flutuante", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-02.jpg", id: "flutuantes" },
  { name: "Escada Flutuante", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-14.jpg", id: "flutuantes" },
  { name: "Escada Flutuante", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-15.jpg", id: "flutuantes" },
  { name: "Escada Flutuante", image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_ESC-04.jpg", id: "flutuantes" },
];

export function EscadasSection() {
  const navigate = useNavigate();
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

  const handleClick = (item: typeof escadas[0]) => {
    navigate(`/escadas#col-${item.id}`);
  };

  return (
    <section id="escadas-section" className="bg-[#1A1A1A] py-14 md:py-24 overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        <motion.div
          ref={titleRef}
          style={{ opacity: titleOp, y: titleY }}
          className="relative mb-12 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8"
        >
          <div>
            <p
              className="text-[#9C8B6E] text-[14px] uppercase tracking-[0.12em] mb-4"
              style={{ fontWeight: 500 }}
            >
              Escadas
            </p>
            <h2
              className="text-[#E8E4DF] text-[32px] md:text-[40px] lg:text-[56px] leading-[1.1] tracking-[0.02em]"
              style={{ fontWeight: 200 }}
            >
              Degraus que conectam,
              <br />
              arquitetura que eleva.
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
        {escadas.map((escada, idx) => (
          <motion.div
            key={escada.image}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: idx * 0.03 }}
            className="shrink-0 w-[260px] md:w-[300px] group cursor-pointer"
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => handleClick(escada)}
          >
            <div className="aspect-[3/4] overflow-hidden relative">
              <img
                src={escada.image}
                alt={escada.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p
                  className="text-[#E8E4DF]/40 text-[12px] uppercase tracking-[0.12em]"
                  style={{ fontWeight: 500, position: 'absolute', bottom: '88px', left: '20px' }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </p>
                <h3
                  className="text-[#E8E4DF] text-[20px] tracking-[0.02em]"
                  style={{ fontWeight: 300, lineHeight: '24px', position: 'absolute', bottom: '56px', left: '20px', right: '20px' }}
                >
                  {escada.name}
                </h3>
                <div
                  className={`transition-all duration-500 ${
                    hoveredIdx === idx ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
                  style={{ position: 'absolute', bottom: '20px', left: '20px' }}
                >
                  <span
                    className="text-[#E8E4DF]/70 text-[12px] uppercase tracking-[0.08em]"
                    style={{ fontWeight: 500 }}
                  >
                    Ver Detalhes →
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}