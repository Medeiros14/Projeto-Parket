import { motion } from "motion/react";
import { useScrollReveal } from "../hooks/useParallax";

const marcas = [
  { name: "Parket", logo: "https://parket.com.br/wp-content/uploads/2025/10/01-PARKET.png" },
  { name: "Listone", logo: "https://parket.com.br/wp-content/uploads/2025/10/02-LISTONE.png" },
  { name: "Kebony", logo: "https://parket.com.br/wp-content/uploads/2025/10/04-KEBONY.png" },
  { name: "Hammer", logo: "https://parket.com.br/wp-content/uploads/2025/10/06-HAMMER.png" },
  { name: "Arbórea", logo: "https://parket.com.br/wp-content/uploads/2025/10/07-ARBOREA.png" },
  { name: "Natur", logo: "https://parket.com.br/wp-content/uploads/2025/10/08-NATUR.png" },
  { name: "Mundial", logo: "https://parket.com.br/wp-content/uploads/2025/10/09-MUNDIAL.png" },
];

export function Marcas() {
  const { ref: titleRef, opacity: titleOp, y: titleY } = useScrollReveal();

  return (
    <section id="marcas" className="bg-[#F0EBE3] py-20 md:py-28 overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 mb-12">
        <motion.div
          ref={titleRef}
          style={{ opacity: titleOp, y: titleY }}
          className="relative"
        >
          <p
            className="text-[#8C8478] text-[12px] uppercase tracking-[0.12em] mb-4"
            style={{ fontWeight: 500 }}
          >
            Marcas
          </p>
          <h2
            className="text-[#2A2A2A] text-[28px] md:text-[36px] lg:text-[48px] leading-[1.1] tracking-[0.02em]"
            style={{ fontWeight: 200 }}
          >
            As melhores marcas do segmento.
          </h2>
        </motion.div>
      </div>

      {/* Infinite scroll marquee */}
      <div className="relative">
        <div className="flex animate-marquee gap-16 md:gap-24 items-center">
          {[...marcas, ...marcas, ...marcas].map((marca, idx) => (
            <div
              key={`${marca.name}-${idx}`}
              className="shrink-0 flex items-center justify-center h-16 md:h-20 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
            >
              <img
                src={marca.logo}
                alt={marca.name}
                className="h-full w-auto object-contain max-w-[140px] md:max-w-[180px]"
              />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 3)); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}