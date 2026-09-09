import { motion } from "motion/react";
import { useScrollReveal } from "../hooks/useParallax";

const testimonials = [
  {
    quote:
      "A Parket entende que o piso não é apenas um revestimento. É o plano que conecta todos os ambientes de um projeto. Trabalhar com eles é ter a certeza de que o resultado final vai honrar o desenho.",
    author: "David Bastos",
    role: "DB Arquiteto",
  },
  {
    quote:
      "Em nossos projetos de praia, a madeira precisa resistir ao clima e ao tempo sem perder a elegância. A Parket entrega isso com uma consistência que é rara no mercado.",
    author: "Paulo Jacobsen",
    role: "Jacobsen Arquitetura",
  },
  {
    quote:
      "O nível de detalhe técnico e a capacidade de execução da Parket nos permitem especificar com total confiança. São parceiros que entendem a linguagem da arquitetura.",
    author: "Fernanda Marques",
    role: "Fernanda Marques Arquitetura",
  },
];

export function Testimonial() {
  const { ref: titleRef, opacity: titleOp, y: titleY } = useScrollReveal();

  return (
    <section className="bg-[#F0EBE3] py-10 md:py-16">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        <motion.div
          ref={titleRef}
          style={{ opacity: titleOp, y: titleY }}
          className="relative mb-16"
        >
          <p
            className="text-[#8C8478] text-[14px] uppercase tracking-[0.12em] mb-4"
            style={{ fontWeight: 500 }}
          >
            Depoimentos
          </p>
          <h2
            className="text-[#2A2A2A] text-[32px] md:text-[40px] leading-[1.1] tracking-[0.02em]"
            style={{ fontWeight: 200 }}
          >
            A confiança de quem projeta.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-start">
          {testimonials.map((t, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: index * 0.12 }}
              className="border-t border-[#8C8478]/30 pt-6 flex flex-col h-full"
            >
              <p className="text-[#2A2A2A] text-[15px] leading-[1.65] mb-8 italic flex-1" style={{ fontWeight: 300 }}>
                {t.quote}
              </p>
              <div>
                <p className="text-[#2A2A2A] text-[13px] mb-1" style={{ fontWeight: 400 }}>
                  {t.author}
                </p>
                <p className="text-[#8C8478] text-[12px]" style={{ fontWeight: 300 }}>
                  {t.role}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}