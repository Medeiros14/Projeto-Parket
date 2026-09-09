import { motion, useScroll, useTransform } from "motion/react";
import { useScrollReveal, useScrollRef } from "../hooks/useParallax";

const projects = [
  {
    id: 1,
    name: "Residência São Paulo",
    architect: "Studio MK27",
    city: "São Paulo, SP",
    products: "Pisos, Painéis",
    image:
      "https://images.unsplash.com/photo-1758957530781-4ff54e09bee2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBwZW50aG91c2UlMjBsaXZpbmclMjByb29tJTIwcGFub3JhbWljJTIwdmlld3xlbnwxfHx8fDE3NzMwNzg5NTB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 2,
    name: "Casa Guarujá",
    architect: "Jacobsen Arquitetura",
    city: "Guarujá, SP",
    products: "Decks, Forros",
    image:
      "https://images.unsplash.com/photo-1760067538022-8ef8739b1b18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjByZXNpZGVudGlhbCUyMGFyY2hpdGVjdHVyZSUyMGV4dGVyaW9yJTIwdHJvcGljYWx8ZW58MXx8fHwxNzczMDc4OTQ4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 3,
    name: "Apartamento Leblon",
    architect: "Bernardes Arquitetura",
    city: "Rio de Janeiro, RJ",
    products: "Pisos, Marcenaria",
    image:
      "https://images.unsplash.com/photo-1758116448135-e989799305da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBob3VzZSUyMGludGVyaW9yJTIwZGVzaWduJTIwbmF0dXJhbCUyMG1hdGVyaWFsc3xlbnwxfHx8fDE3NzMwNzg5NDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 4,
    name: "Casa Fazenda Boa Vista",
    architect: "Isay Weinfeld",
    city: "Porto Feliz, SP",
    products: "Pisos, Escadas, Forros",
    image:
      "https://images.unsplash.com/photo-1765371513276-a74f1ecbcf7d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcmNoaXRlY3QlMjBzdHVkaW8lMjBtb2Rlcm4lMjBtaW5pbWFsaXN0JTIwd29ya3NwYWNlfGVufDF8fHx8MTc3MzA3ODk1MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
];

function ProjectCard({ project, index }: { project: (typeof projects)[number]; index: number }) {
  const ref = useScrollRef<HTMLDivElement>();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.8, delay: index * 0.12 }}
      className="group relative cursor-pointer"
    >
      <div className="aspect-[16/10] overflow-hidden mb-5">
        <motion.div className="w-full h-full will-change-transform" style={{ y: imgY }}>
          <img
            src={project.image}
            alt={project.name}
            className="w-full h-[115%] object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </motion.div>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className="text-[#E8E4DF] text-[20px] tracking-[0.02em] mb-1"
            style={{ fontWeight: 300 }}
          >
            {project.name}
          </h3>
          <p className="text-[#8C8478] text-[14px]" style={{ fontWeight: 400 }}>
            {project.architect}
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-[#8C8478] text-[12px] uppercase tracking-[0.08em]"
            style={{ fontWeight: 500 }}
          >
            {project.city}
          </p>
          <p className="text-[#E8E4DF]/40 text-[12px] mt-1" style={{ fontWeight: 400 }}>
            {project.products}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function Projects() {
  const { ref: titleRef, opacity: titleOp, y: titleY } = useScrollReveal();

  return (
    <section id="projetos" className="bg-[#1A1A1A] py-24 md:py-40">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        <motion.div
          ref={titleRef}
          style={{ opacity: titleOp, y: titleY }}
          className="relative mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8"
        >
          <div>
            <p
              className="text-[#8C8478] text-[12px] uppercase tracking-[0.12em] mb-4"
              style={{ fontWeight: 500 }}
            >
              Projetos
            </p>
            <h2
              className="text-[#E8E4DF] text-[32px] md:text-[40px] lg:text-[56px] leading-[1.1] tracking-[0.02em]"
              style={{ fontWeight: 200 }}
            >
              Resultados que falam
              <br />
              por si mesmos.
            </h2>
          </div>
          <button
            className="border border-[#E8E4DF] text-[#E8E4DF] px-10 py-4 text-[13px] uppercase tracking-[0.08em] hover:bg-[#E8E4DF] hover:text-[#1A1A1A] transition-all duration-500 self-start md:self-auto shrink-0"
            style={{ fontWeight: 500 }}
          >
            Ver Todos os Projetos
          </button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}