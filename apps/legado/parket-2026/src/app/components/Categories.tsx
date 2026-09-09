import { useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useNavigate } from "react-router";
import { useScrollReveal, useScrollRef } from "../hooks/useParallax";

import escadasImg from "figma:asset/f817cb3e45335eec0d517720f315dd1465b828ae.jpg";
import portasImg from "figma:asset/750925fdcea613a5e43153793f2165e7752aab82.jpg";
import decksImg from "figma:asset/ccb297217b6eeebb7d8193a068160e14799815e2.jpg";
import forrosImg from "figma:asset/c23d42f9035ab4fed53b7e207e8d6caadcadd57a.jpg";
import paineisImg from "figma:asset/28a705cf3ea7cb71edfe6ed641ae88d4c31cf689.jpg";
import fachadasImg from "figma:asset/e07f6999d4a8dba6d4c50e45cb127d966a5337da.jpg";
import shouSugiBanImg from "figma:asset/756ae0fd9e680d6f53567ceeadee7aa9224a2cbf.jpg";

const categories = [
  {
    id: "pisos",
    label: "Pisos",
    subtitle: "Carvalhos, Clássicos, Eternos e mais",
    scrollTo: "pisos",
    image: "/pisos.jpg",
  },
  {
    id: "decks",
    label: "Decks",
    subtitle: "Cumaru, Ipê e madeiras nobres",
    scrollTo: "decks",
    image: decksImg,
  },
  {
    id: "forros",
    label: "Forros",
    subtitle: "Acabamento superior em madeira",
    scrollTo: "forros",
    image: forrosImg,
  },
  {
    id: "paineis",
    label: "Painéis",
    subtitle: "Paredes e revestimentos verticais",
    scrollTo: "paineis",
    image: paineisImg,
  },
  {
    id: "escadas",
    label: "Escadas",
    subtitle: "Degraus, guarda-corpos e estruturas",
    scrollTo: "escadas",
    image: escadasImg,
  },
  {
    id: "portas",
    label: "Portas",
    subtitle: "Pivotantes, de correr e especiais",
    scrollTo: "portas",
    image: portasImg,
  },
];

const secondaryCategories = [
  {
    id: "fachadas",
    label: "Fachadas",
    subtitle: "Brises, revestimentos externos e Shou Sugi Ban",
    scrollTo: "fachadas",
    image: fachadasImg,
  },
  {
    id: "spa",
    label: "Spa & Saunas",
    subtitle: "Ambientes de bem-estar",
    scrollTo: "spa",
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_SA-01.jpg",
  },
  {
    id: "marcenaria",
    label: "Marcenaria",
    subtitle: "Peças sob medida em madeira",
    scrollTo: "marcenaria",
    image: "https://parket.com.br/wp-content/uploads/2025/10/PRO_MA-01.jpg",
  },
];

function CategoryCard({
  cat,
  index,
  isHovered,
  onHover,
  onClick,
}: {
  cat: (typeof categories)[number];
  index: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
}) {
  const ref = useScrollRef<HTMLDivElement>();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, delay: index * 0.08 }}
      className="group relative aspect-[3/4] overflow-hidden cursor-pointer"
      onMouseEnter={() => onHover(cat.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      <motion.div className="absolute inset-0 will-change-transform" style={{ y: imgY }}>
        <img
          src={cat.image}
          alt={cat.label}
          className="w-full h-[120%] object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent z-10" />
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-20">
        <h3
          className="text-[#E8E4DF] text-[22px] md:text-[28px] tracking-[0.02em]"
          style={{ fontWeight: 200 }}
        >
          {cat.label}
        </h3>
        <div
          className={`mt-2 transition-all duration-500 ${
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          <p className="text-[#E8E4DF]/60 text-[13px] mb-3" style={{ fontWeight: 400 }}>
            {cat.subtitle}
          </p>
          <span
            className="text-[#E8E4DF]/70 text-[12px] uppercase tracking-[0.08em]"
            style={{ fontWeight: 500 }}
          >
            Ver Coleção →
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function Categories() {
  const navigate = useNavigate();
  const { ref: titleRef, opacity: titleOp, y: titleY } = useScrollReveal();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleCategoryClick = (category: typeof categories[number]) => {
    // Navigate to dedicated pages for these categories
    if (["pisos", "decks", "forros", "paineis", "escadas", "portas"].includes(category.id)) {
      navigate(`/${category.scrollTo}`);
    } else {
      // Scroll to section for others
      const element = document.getElementById(category.scrollTo);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const scrollToSection = (sectionId: string) => {
    // Navigate to dedicated page if it's fachadas, spa or marcenaria
    if (sectionId === "fachadas" || sectionId === "spa" || sectionId === "marcenaria") {
      navigate(`/${sectionId}`);
      return;
    }
    // Otherwise scroll to section
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="produtos" className="bg-[#1A1A1A] py-10 md:py-16">
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
            Produtos
          </p>
          <h2
            className="text-[#E8E4DF] text-[32px] md:text-[40px] lg:text-[56px] leading-[1.1] tracking-[0.02em] max-w-[700px]"
            style={{ fontWeight: 200 }}
          >
            Cada superfície conta
            <br />
            uma história.
          </h2>
        </motion.div>

        {/* Main 6 categories */}
        <div 
          className="flex md:grid md:grid-cols-3 gap-4 mb-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {categories.map((cat, idx) => (
            <div key={cat.id} className="shrink-0 w-[260px] md:w-auto snap-start">
              <CategoryCard
                cat={cat}
                index={idx}
                isHovered={hoveredId === cat.id}
                onHover={setHoveredId}
                onClick={() => handleCategoryClick(cat)}
              />
            </div>
          ))}
        </div>

        {/* Secondary 4 categories */}
        <div 
          className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {secondaryCategories.map((cat, idx) => (
            <div key={cat.id} className="shrink-0 w-[260px] md:w-auto snap-start">
              <CategoryCard
                cat={cat}
                index={idx + 6}
                isHovered={hoveredId === cat.id}
                onHover={setHoveredId}
                onClick={() => scrollToSection(cat.scrollTo)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}