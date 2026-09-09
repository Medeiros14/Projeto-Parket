import { motion } from "motion/react";
import { useScrollReveal } from "../hooks/useParallax";

export function ProductsCTA() {
  const { ref, opacity, y } = useScrollReveal();

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="bg-[#FAF8F5] py-5 md:py-8">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        <motion.div
          ref={ref}
          style={{ opacity, y }}
          className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 md:pb-8"
        >
          <div>
            <p
              className="text-[#9C8B6E] text-[14px] uppercase tracking-[0.12em] mb-2"
              style={{ fontWeight: 500 }}
            >
              Catálogos e Texturas
            </p>
            <p
              className="text-[#2A2A2A] text-[16px] md:text-[18px] leading-[1.5] tracking-[0.01em] max-w-[540px]"
              style={{ fontWeight: 300 }}
            >
              Receba os catálogos Parket e o banco de texturas 3D desenvolvido para elevar o nível de apresentação, especificação e visualização dos seus projetos.
            </p>
          </div>
          <button
            onClick={() => scrollToSection("revestimentos")}
            className="border border-[#2A2A2A] text-[#2A2A2A] px-8 py-3 text-[12px] uppercase tracking-[0.08em] hover:bg-[#2A2A2A] hover:text-[#FAF8F5] transition-all duration-500 shrink-0"
            style={{ fontWeight: 500 }}
          >
            Quero Acessar o Acervo
          </button>
        </motion.div>
      </div>
    </section>
  );
}