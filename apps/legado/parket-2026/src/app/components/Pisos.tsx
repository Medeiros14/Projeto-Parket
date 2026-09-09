import { useState, useRef } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useScrollReveal } from "../hooks/useParallax";
import { ZoomImage } from "./ZoomImage";

const pisos = [
  { 
    name: "Brazil", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-01.jpg",
  },
  { 
    name: "Carvalhos", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-01.jpg",
  },
  { 
    name: "Clássicos", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-01.jpg",
  },
  { 
    name: "Eternos", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-01.jpg",
  },
  { 
    name: "Grandiosos", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-01.jpg",
  },
  { 
    name: "Pinho de Riga", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_PR-01.jpg",
  },
  { 
    name: "Únicos", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_UN-01.jpg",
  },
  { 
    name: "Wood + Mármore", 
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_MA-01.jpg",
  },
];

export function Pisos() {
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

  return (
    <section id="pisos" className="bg-[#1A1A1A] py-10 md:py-16 overflow-hidden">
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
              Pisos
            </p>
            <h2
              className="text-[#E8E4DF] text-[32px] md:text-[40px] lg:text-[56px] leading-[1.1] tracking-[0.02em]"
              style={{ fontWeight: 200 }}
            >
              Carvalhos, clássicos
              <br />
              e madeiras eternas.
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-3 shrink-0">
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

      {/* Mobile: horizontal scroll */}
      <div 
        className="md:hidden flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-6"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {pisos.map((piso, idx) => (
          <motion.div
            key={piso.name}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5, delay: idx * 0.04 }}
            className="shrink-0 w-[240px] sm:w-[280px] group cursor-pointer snap-start"
            onClick={() => navigate('/pisos')}
          >
            <ZoomImage 
              src={piso.image} 
              alt={piso.name} 
              className="aspect-[3/4]"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p
                  className="text-[#E8E4DF]/40 text-[12px] uppercase tracking-[0.12em] mb-1"
                  style={{ fontWeight: 500 }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </p>
                <h3
                  className="text-[#E8E4DF] text-[18px] tracking-[0.02em]"
                  style={{ fontWeight: 300 }}
                >
                  {piso.name}
                </h3>
              </div>
            </ZoomImage>
          </motion.div>
        ))}
      </div>

      {/* Desktop: Horizontal scroll carousel */}
      <div
        ref={scrollRef}
        className="hidden md:flex gap-4 overflow-x-auto scrollbar-hide px-6 md:px-10 lg:px-20"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {pisos.map((piso, idx) => (
          <motion.div
            key={piso.name}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: idx * 0.03 }}
            className="shrink-0 w-[260px] md:w-[300px] group cursor-pointer"
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => navigate('/pisos')}
          >
            <ZoomImage 
              src={piso.image} 
              alt={piso.name} 
              className="aspect-[3/4]"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p
                  className="text-[#E8E4DF]/40 text-[12px] uppercase tracking-[0.12em] mb-1"
                  style={{ fontWeight: 500 }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </p>
                <h3
                  className="text-[#E8E4DF] text-[20px] tracking-[0.02em]"
                  style={{ fontWeight: 300 }}
                >
                  {piso.name}
                </h3>
                <div
                  className={`mt-3 transition-all duration-500 ${
                    hoveredIdx === idx ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
                >
                  <span
                    className="text-[#E8E4DF]/70 text-[12px] uppercase tracking-[0.08em]"
                    style={{ fontWeight: 500 }}
                  >
                    Ver Detalhes →
                  </span>
                </div>
              </div>
            </ZoomImage>
          </motion.div>
        ))}
      </div>
    </section>
  );
}