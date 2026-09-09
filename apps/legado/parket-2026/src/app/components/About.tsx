import { motion } from "motion/react";
import { useParallax, useScrollReveal } from "../hooks/useParallax";
import familiaImage from "figma:asset/familia-parket-2026.jpg";

const stats = [
  { value: "50+", label: "anos de tradição" },
  { value: "20.000m²", label: "de parque industrial" },
  { value: "6.000+", label: "projetos entregues" },
  { value: "100%", label: "Cadeia produtiva\nprópria com FSC" },
];

export function About() {
  const { ref: imgRef, y: imgY } = useParallax(0.2);
  const { ref: textRef, opacity: textOp, y: textTranslateY } = useScrollReveal();

  return (
    <>
      <section id="sobre" className="bg-[#FAF8F5] py-10 md:py-16">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
          {/* Text — single row, more horizontal */}
          <motion.div
            ref={textRef}
            style={{ opacity: textOp, y: textTranslateY }}
            className="relative"
          >
            <div className="flex flex-col md:flex-row gap-10 lg:gap-24 mb-6">
              <div className="md:w-5/12">
                <p
                  className="text-[#8C8478] text-[14px] uppercase tracking-[0.12em] mb-6"
                  style={{ fontWeight: 500 }}
                >
                  Sobre a Parket
                </p>
                <h2
                  className="text-[#2A2A2A] text-[36px] md:text-[44px] lg:text-[52px] leading-[1.1] tracking-[0.02em]"
                  style={{ fontWeight: 200 }}
                >
                  Meio século transformando madeira em legado.
                </h2>
              </div>
              
              <div className="md:w-7/12 flex flex-col gap-6 md:pt-14 max-w-[640px]">
                <p className="text-[#2A2A2A] text-[20px] md:text-[24px] leading-[1.4] tracking-[-0.01em]" style={{ fontWeight: 300 }}>
                  A Parket nasce da convicção de que a madeira é a linguagem mais autêntica da
                  arquitetura brasileira. Cada projeto que realizamos é uma tradução precisa entre o
                  desejo do arquiteto e a natureza do material.
                </p>
                <p className="text-[#8C8478] text-[16px] md:text-[18px] leading-[1.65]" style={{ fontWeight: 400 }}>
                  Trabalhamos com madeiras de manejo sustentável, processos industriais de altíssima
                  precisão e uma equipe técnica que entende que cada milímetro importa. Nosso
                  compromisso é entregar superfícies que envelhecem com beleza — e que resistem ao
                  tempo com a mesma elegância do primeiro dia.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Photo — full width below text, no cropping */}
          <div ref={imgRef} className="mt-12 md:mt-16">
            <motion.div className="will-change-transform" style={{ y: imgY }}>
              <img
                src={familiaImage}
                alt="Família fundadora da Parket"
                className="w-full h-auto object-contain"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-[#1A1A1A] py-8 md:py-10">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p
                  className="text-[#E8E4DF] text-[28px] md:text-[36px] tracking-[0.02em]"
                  style={{ fontWeight: 200 }}
                >
                  {stat.value}
                </p>
                <p
                  className="text-[#8C8478] text-[11px] md:text-[12px] uppercase tracking-[0.12em] mt-2 whitespace-pre-line"
                  style={{ fontWeight: 500 }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}