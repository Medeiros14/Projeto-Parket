import { motion, useScroll, useTransform } from "motion/react";
import { useScrollRef } from "../hooks/useParallax";

export function Philosophy() {
  const sectionRef = useScrollRef<HTMLDivElement>();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const contentOpacity = useTransform(scrollYProgress, [0.15, 0.4], [0, 1]);
  const contentY = useTransform(scrollYProgress, [0.15, 0.4], [30, 0]);

  return (
    <section
      ref={sectionRef}
      className="bg-[#0D0D0D] py-16 md:py-24 relative overflow-hidden"
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 relative z-10">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-[180px_1px_1fr] lg:grid-cols-[220px_1px_1fr] gap-8 md:gap-0 items-start"
          style={{ opacity: contentOpacity, y: contentY }}
        >
          {/* Label — left column */}
          <div className="md:pr-10 lg:pr-14 md:pt-2">
            <p
              className="text-[#9C8B6E] text-[14px] uppercase tracking-[0.12em]"
              style={{ fontWeight: 500 }}
            >
              Manifesto
            </p>
          </div>

          {/* Vertical divider — visible only on desktop */}
          <div className="hidden md:block w-[1px] self-stretch bg-gradient-to-b from-[#9C8B6E]/30 via-[#9C8B6E]/10 to-transparent" />

          {/* Text — right column */}
          <div className="md:pl-10 lg:pl-16">
            <p
              className="text-[#E8E4DF] text-[22px] md:text-[28px] lg:text-[34px] leading-[1.5] tracking-[0.01em] max-w-[680px]"
              style={{ fontWeight: 200 }}
            >
              Não vendemos madeira.
              <br className="hidden md:block" />{" "}
              Criamos superfícies que completam a arquitetura.
            </p>

            <p
              className="text-[#E8E4DF]/40 text-[16px] md:text-[18px] leading-[1.7] tracking-[0.02em] mt-6 max-w-[520px]"
              style={{ fontWeight: 300 }}
            >
              Cada peça nasce do encontro entre natureza, técnica e precisão construtiva.
              O que sustenta um grande projeto nunca é apenas o material,
              é o cuidado invisível em cada detalhe.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}