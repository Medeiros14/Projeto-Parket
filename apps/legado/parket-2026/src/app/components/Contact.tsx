import { useState } from "react";
import { motion } from "motion/react";
import { MapPin, Phone, Mail } from "lucide-react";
import { useScrollReveal } from "../hooks/useParallax";

const offices = [
  {
    city: "São Paulo",
    address: "Avenida Magalhães de Castro, 4800",
    detail: "Torre 1, Edifício Capital • Cj. 201",
    neighborhood: "Jardim Panorama – São Paulo • SP",
  },
  {
    city: "Brasília",
    address: "SHIS QI 21 BL B, Ed. IAS 06/58",
    detail: "",
    neighborhood: "Lago Sul • Brasília – DF",
  },
];

interface ContactProps {
  onOpenForm: () => void;
}

export function Contact({ onOpenForm }: ContactProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { ref: leftRef, opacity: leftOp, y: leftY } = useScrollReveal();

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail("");
    }
  };

  return (
    <section id="contato" className="bg-[#1A1A1A] py-6 md:py-10">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        {/* Top: CTA headline + Offices */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10 items-start">
          {/* Left 3 cols: headline + buttons */}
          <motion.div
            ref={leftRef}
            style={{ opacity: leftOp, y: leftY, paddingLeft: 0 }}
            className="relative lg:col-span-3"
          >
            <p
              className="text-[#9C8B6E] text-[11px] uppercase tracking-[0.12em] mb-2.5"
              style={{ fontWeight: 500, paddingLeft: 0 }}
            >
              Contato
            </p>
            <h2
              className="text-[#E8E4DF] text-[22px] md:text-[29px] lg:text-[34px] leading-[1.15] tracking-[0.02em] mb-3"
              style={{ fontWeight: 200, paddingLeft: 0 }}
            >
              Vamos conversar
              <br />
              sobre o seu projeto.
            </h2>
            <p className="text-[#8C8478] text-[12px] leading-[1.6] mb-4 max-w-[380px]" style={{ fontWeight: 400, paddingLeft: 0 }}>
              Nossa equipe técnica está pronta para entender as necessidades do seu projeto e
              recomendar as melhores soluções em madeira.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5" style={{ paddingLeft: 0 }}>
              <button
                onClick={onOpenForm}
                className="border border-[#E8E4DF] text-[#E8E4DF] px-6 py-2.5 text-[11px] uppercase tracking-[0.08em] hover:bg-[#E8E4DF] hover:text-[#1A1A1A] transition-all duration-500"
                style={{ fontWeight: 500 }}
              >
                Solicitar Orçamento
              </button>
              <a
                href="https://calendly.com/marina-parket/10min?month=2026-03"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E8E4DF]/80 px-5 py-2.5 text-[11px] uppercase tracking-[0.08em] hover:text-[#E8E4DF] transition-colors duration-300 inline-flex items-center gap-1"
                style={{ fontWeight: 500 }}
              >
                Agendar Visita →
              </a>
            </div>
          </motion.div>

          {/* Right 2 cols: Offices */}
          <motion.div
            className="lg:col-span-2"
            style={{ paddingTop: 0 }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <p
              className="text-[#8C8478] text-[11px] uppercase tracking-[0.12em] mb-4"
              style={{ fontWeight: 500 }}
            >
              Escritórios
            </p>

            <div className="space-y-4">
              {offices.map((office, index) => (
                <div key={index} className="border-t border-[#E8E4DF]/10 pt-3">
                  <h3
                    className="text-[#E8E4DF] text-[16px] tracking-[0.02em] mb-1.5"
                    style={{ fontWeight: 200 }}
                  >
                    {office.city}
                  </h3>
                  <div className="flex items-start gap-2.5">
                    <MapPin size={11} className="text-[#8C8478] mt-1 shrink-0" />
                    <p className="text-[#E8E4DF]/70 text-[11px] leading-[1.5]" style={{ fontWeight: 400 }}>
                      {office.address}
                      {office.detail && (
                        <>
                          <br />
                          {office.detail}
                        </>
                      )}
                      <br />
                      <span className="text-[#8C8478] text-[10px]">{office.neighborhood}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom strip: Newsletter (left) + Contato Geral (right) — asymmetric layout matching top grid */}
        <div className="border-t border-[#E8E4DF]/10 mt-6 pt-5">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10">
            {/* Newsletter — spans 3 cols to match left column above */}
            <div className="lg:col-span-3" style={{ paddingLeft: 0 }}>
              <p
                className="text-[#8C8478] text-[11px] uppercase tracking-[0.12em] mb-1.5"
                style={{ fontWeight: 500, paddingLeft: 0 }}
              >
                Newsletter
              </p>
              <p className="text-[#E8E4DF]/60 text-[10px] mb-2.5" style={{ fontWeight: 400, paddingLeft: 0 }}>
                Receba novidades sobre lançamentos e projetos.
              </p>
              {submitted ? (
                <p className="text-[#9C8B6E] text-[11px]" style={{ fontWeight: 400, paddingLeft: 0 }}>
                  Obrigado! Você receberá nossas novidades em breve.
                </p>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex w-full" style={{ paddingLeft: 0 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="flex-1 bg-transparent border border-[#E8E4DF]/20 text-[#E8E4DF] px-3 py-2 text-[11px] placeholder-[#8C8478]/50 focus:outline-none focus:border-[#9C8B6E] transition-colors duration-300"
                    style={{ fontWeight: 400 }}
                  />
                  <button
                    type="submit"
                    className="bg-[#E8E4DF] text-[#1A1A1A] px-5 py-2 text-[11px] uppercase tracking-[0.08em] hover:bg-[#B5A48A] transition-colors duration-300"
                    style={{ fontWeight: 500 }}
                  >
                    Enviar
                  </button>
                </form>
              )}
            </div>

            {/* Contato Geral — 2 cols, aligns with right column above */}
            <div className="lg:col-span-2">
              <p
                className="text-[#8C8478] text-[11px] uppercase tracking-[0.12em] mb-1.5"
                style={{ fontWeight: 500 }}
              >
                Contato Geral
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Mail size={10} className="text-[#8C8478] shrink-0" />
                  <p className="text-[#E8E4DF]/70 text-[10px]" style={{ fontWeight: 400 }}>
                    contato@parket.com.br
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={10} className="text-[#8C8478] shrink-0" />
                  <p className="text-[#E8E4DF]/70 text-[10px]" style={{ fontWeight: 400 }}>
                    +55 11 99960-0222
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}