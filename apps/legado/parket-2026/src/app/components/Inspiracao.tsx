import { useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useScrollReveal, useScrollRef } from "../hooks/useParallax";
import { useNavigate } from "react-router";
import { ZoomImage } from "./ZoomImage";

const inspiracoes = [
  { label: "Apartamentos", image: "https://parket.com.br/wp-content/uploads/2025/10/inspiracao-apartamentos.jpg", link: "/projetos/apartamentos" },
  { label: "Casas", image: "https://parket.com.br/wp-content/uploads/2025/10/inspiracao-casas.jpg", link: "/projetos/casas" },
  { label: "Edifícios", image: "https://parket.com.br/wp-content/uploads/2025/10/inspiracao-edificios.jpg", link: "/projetos/edificios" },
  { label: "Hotéis", image: "https://parket.com.br/wp-content/uploads/2025/10/inspiracao-hoteis.jpg", link: "/projetos/hoteis" },
  { label: "Lojas", image: "https://parket.com.br/wp-content/uploads/2025/10/inspiracao-lojas.jpg", link: "/projetos/lojas" },
  { label: "Escritórios", image: "https://parket.com.br/wp-content/uploads/2025/10/inspiracao-escritorio.jpg", link: "/projetos/escritorios" },
  { label: "Restaurantes", image: "https://parket.com.br/wp-content/uploads/2025/10/inspiracao-restaurantes.jpg", link: "/projetos/restaurantes" },
  { label: "Museus", image: "https://parket.com.br/wp-content/uploads/2025/10/inspiracao-museus.jpg", link: "/projetos/museus" },
  { label: "Mostras", image: "https://parket.com.br/wp-content/uploads/2025/10/inspiracao-mostras.jpg", link: "/projetos/mostras" },
];

function InspiracaoCard({
  item,
  idx,
  hoveredIdx,
  onHover,
}: {
  item: (typeof inspiracoes)[number];
  idx: number;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
}) {
  const ref = useScrollRef<HTMLDivElement>();
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  const handleClick = () => {
    if (item.link) {
      navigate(item.link);
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, delay: idx * 0.05 }}
      style={{ position: "relative" }}
      className="group relative overflow-hidden cursor-pointer aspect-[4/3]"
      onMouseEnter={() => onHover(idx)}
      onMouseLeave={() => onHover(null)}
      onClick={handleClick}
    >
      <motion.div className="absolute inset-0 will-change-transform" style={{ y: imgY }}>
        <img
          src={item.image}
          alt={item.label}
          className="w-full h-[120%] object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent z-10" />
      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6 z-20">
        <h3
          className="text-[#E8E4DF] text-[18px] md:text-[22px] tracking-[0.02em]"
          style={{ fontWeight: 200 }}
        >
          {item.label}
        </h3>
        <div
          className={`mt-2 transition-all duration-500 ${
            hoveredIdx === idx ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          <span
            className="text-[#E8E4DF]/70 text-[12px] uppercase tracking-[0.08em]"
            style={{ fontWeight: 500 }}
          >
            Ver Projetos →
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function Inspiracao() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { ref: titleRef, opacity: titleOp, y: titleY } = useScrollReveal();
  const navigate = useNavigate();

  return (
    <section id="inspiracao" className="bg-[#FAF8F5] py-10 md:py-16">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        <motion.div
          ref={titleRef}
          style={{ opacity: titleOp, y: titleY }}
          className="relative mb-10 md:mb-16"
        >
          <p
            className="text-[#8C8478] text-[14px] uppercase tracking-[0.12em] mb-4"
            style={{ fontWeight: 500 }}
          >
            Projetos
          </p>
          <h2
            className="text-[#2A2A2A] text-[32px] md:text-[40px] lg:text-[56px] leading-[1.1] tracking-[0.02em] max-w-[700px]"
            style={{ fontWeight: 200 }}
          >
            Inspire-se em nossos
            <br />
            projetos ao redor do mundo.
          </h2>
        </motion.div>

        {/* Mobile: horizontal scroll */}
        <div 
          className="md:hidden flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {inspiracoes.map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5, delay: idx * 0.04 }}
              className="shrink-0 w-[240px] sm:w-[280px] group relative overflow-hidden cursor-pointer snap-start aspect-[3/4]"
              onClick={() => item.link && navigate(item.link)}
            >
              <img
                src={item.image}
                alt={item.label}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3
                  className="text-[#E8E4DF] text-[18px] tracking-[0.02em]"
                  style={{ fontWeight: 300 }}
                >
                  {item.label}
                </h3>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Desktop: original grid */}
        <div className="hidden md:grid grid-cols-3 gap-4">
          {inspiracoes.map((item, idx) => (
            <InspiracaoCard
              key={item.label}
              item={item}
              idx={idx}
              hoveredIdx={hoveredIdx}
              onHover={setHoveredIdx}
            />
          ))}
        </div>
      </div>
    </section>
  );
}