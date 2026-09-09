import { useState } from "react";
import { motion } from "motion/react";
import { Plus, Minus } from "lucide-react";
import { useScrollReveal } from "../hooks/useParallax";

const specs = [
  {
    id: "madeiras",
    title: "Espécies de Madeira",
    items: [
      { name: "Cumaru", origin: "Amazônia", hardness: "3.540 lbf", color: "Castanho dourado" },
      { name: "Ipê", origin: "Amazônia", hardness: "3.680 lbf", color: "Marrom escuro" },
      { name: "Tauari", origin: "Amazônia", hardness: "1.150 lbf", color: "Bege claro" },
      { name: "Freijó", origin: "Amazônia", hardness: "880 lbf", color: "Castanho médio" },
      { name: "Carvalho Europeu", origin: "Europa", hardness: "1.360 lbf", color: "Mel natural" },
    ],
  },
  {
    id: "acabamentos",
    title: "Acabamentos",
    items: [
      { name: "Natural Acetinado", origin: "—", hardness: "—", color: "Transparente" },
      { name: "Verniz UV", origin: "—", hardness: "Alta resistência", color: "Transparente" },
      { name: "Óleo Natural", origin: "—", hardness: "Média resistência", color: "Realça veios" },
      { name: "Stain Branco", origin: "—", hardness: "—", color: "Branco lavado" },
    ],
  },
  {
    id: "dimensoes",
    title: "Dimensões Padrão",
    items: [
      { name: "Tábua Larga", origin: "190mm × 1900mm", hardness: "20mm", color: "Engenheirada" },
      { name: "Tábua Média", origin: "140mm × 1200mm", hardness: "15mm", color: "Engenheirada" },
      { name: "Régua Estreita", origin: "90mm × 900mm", hardness: "14mm", color: "Maciça" },
      { name: "Deck Modular", origin: "100mm × 2000mm", hardness: "21mm", color: "Maciça" },
    ],
  },
];

const faqs = [
  {
    q: "Qual a diferença entre piso maciço e engenheirado?",
    a: "O piso maciço é feito inteiramente de uma única espécie de madeira. O piso engenheirado possui uma camada nobre de madeira sobre uma base multilaminada, oferecendo maior estabilidade dimensional e resistência a variações de umidade.",
  },
  {
    q: "A Parket trabalha com madeiras de reflorestamento?",
    a: "Sim. Todas as nossas madeiras possuem certificação de origem e rastreabilidade completa. Trabalhamos com fornecedores que praticam manejo florestal sustentável e possuem as devidas autorizações dos órgãos ambientais.",
  },
  {
    q: "Qual o prazo médio de entrega e instalação?",
    a: "O prazo varia conforme a complexidade do projeto. Em média, a produção leva de 30 a 45 dias úteis, e a instalação depende da metragem. Projetos residenciais típicos são concluídos em 5 a 15 dias de instalação.",
  },
  {
    q: "Vocês atendem arquitetos e especificadores?",
    a: "Sim, temos um programa dedicado para profissionais de arquitetura e design de interiores, com assessoria técnica especializada, amostras físicas, condições especiais e suporte completo na especificação.",
  },
];

export function Specs() {
  const [activeTab, setActiveTab] = useState("madeiras");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { ref: titleRef, opacity: titleOp, y: titleY } = useScrollReveal();

  const activeSpec = specs.find((s) => s.id === activeTab);

  return (
    <section id="specs" className="bg-[#FAF8F5] py-24 md:py-40">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        <motion.div
          ref={titleRef}
          style={{ opacity: titleOp, y: titleY }}
          className="relative mb-16"
        >
          <p
            className="text-[#8C8478] text-[12px] uppercase tracking-[0.12em] mb-4"
            style={{ fontWeight: 500 }}
          >
            Especificações Técnicas
          </p>
          <h2
            className="text-[#2A2A2A] text-[32px] md:text-[40px] lg:text-[56px] leading-[1.1] tracking-[0.02em]"
            style={{ fontWeight: 200 }}
          >
            Dados que sustentam
            <br />a decisão.
          </h2>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-8 border-b border-[#D9D3CB] mb-10">
          {specs.map((spec) => (
            <button
              key={spec.id}
              onClick={() => setActiveTab(spec.id)}
              className={`pb-4 text-[13px] uppercase tracking-[0.08em] transition-all duration-300 relative ${
                activeTab === spec.id ? "text-[#2A2A2A]" : "text-[#8C8478] hover:text-[#2A2A2A]"
              }`}
              style={{ fontWeight: 500 }}
            >
              {spec.title}
              {activeTab === spec.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#2A2A2A]" />
              )}
            </button>
          ))}
        </div>

        {/* Spec Table */}
        {activeSpec && (
          <motion.div
            key={activeSpec.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {/* Table header */}
            <div className="hidden md:grid grid-cols-4 gap-4 pb-3 border-b border-[#D9D3CB]">
              <p className="text-[#8C8478] text-[12px] uppercase tracking-[0.12em]" style={{ fontWeight: 500 }}>
                Nome
              </p>
              <p className="text-[#8C8478] text-[12px] uppercase tracking-[0.12em]" style={{ fontWeight: 500 }}>
                {activeTab === "dimensoes" ? "Dimensões" : "Origem"}
              </p>
              <p className="text-[#8C8478] text-[12px] uppercase tracking-[0.12em]" style={{ fontWeight: 500 }}>
                {activeTab === "dimensoes" ? "Espessura" : "Dureza Janka"}
              </p>
              <p className="text-[#8C8478] text-[12px] uppercase tracking-[0.12em]" style={{ fontWeight: 500 }}>
                {activeTab === "dimensoes" ? "Tipo" : "Coloração"}
              </p>
            </div>

            {activeSpec.items.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 py-5 border-b border-[#D9D3CB]/50 hover:bg-[#F0EBE3]/50 transition-colors duration-300 px-2"
              >
                <p className="text-[#2A2A2A] text-[16px]" style={{ fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.name}
                </p>
                <p className="text-[#8C8478] text-[14px]" style={{ fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.origin}
                </p>
                <p className="text-[#8C8478] text-[14px]" style={{ fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.hardness}
                </p>
                <p className="text-[#8C8478] text-[14px]" style={{ fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.color}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        {/* FAQ Section */}
        <div className="mt-24 md:mt-32">
          <p
            className="text-[#8C8478] text-[12px] uppercase tracking-[0.12em] mb-8"
            style={{ fontWeight: 500 }}
          >
            Perguntas Frequentes
          </p>
          <div className="space-y-0">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-[#D9D3CB]">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between py-6 text-left group"
                >
                  <span
                    className="text-[#2A2A2A] text-[18px] pr-8 group-hover:text-[#9C8B6E] transition-colors duration-300"
                    style={{ fontWeight: 400 }}
                  >
                    {faq.q}
                  </span>
                  {openFaq === index ? (
                    <Minus size={18} className="text-[#8C8478] shrink-0" />
                  ) : (
                    <Plus size={18} className="text-[#8C8478] shrink-0" />
                  )}
                </button>
                <div
                  className={`overflow-hidden transition-all duration-500 ${
                    openFaq === index ? "max-h-[500px] pb-6" : "max-h-0"
                  }`}
                >
                  <p className="text-[#8C8478] text-[16px] leading-[1.65] max-w-[800px]" style={{ fontWeight: 400 }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}