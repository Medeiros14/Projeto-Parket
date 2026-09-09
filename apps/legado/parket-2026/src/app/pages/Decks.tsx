import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ChevronDown, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { LeadFormModal } from "../components/LeadFormModal";
import { Footer } from "../components/Footer";
import { SEOHead } from "../components/SEOHead";
import { ZoomImage } from "../components/ZoomImage";
import { handleLeadFormClick } from "../lib/leadForm";

/* ─── Collections Data ─── */
const collections = [
  {
    id: "brazil",
    name: "Brazil",
    description:
      "Decks em madeiras tropicais brasileiras de alta densidade: Cumaru, Ipê, Garapa, Itaúba e Tatajuba. Resistência excepcional às intempéries com a beleza natural das melhores madeiras do mundo.",
    images: Array.from(
      { length: 11 },
      (_, i) =>
        `https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_BR-${String(i + 1).padStart(2, "0")}.jpg`
    ),
  },
  {
    id: "eurodeck",
    name: "Eurodeck",
    description:
      "Deck em Carvalho Europeu com tratamento autoclave de última geração. A elegância atemporal do carvalho adaptada para uso externo em áreas cobertas e varandas protegidas.",
    images: Array.from(
      { length: 3 },
      (_, i) =>
        `https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_EU-${String(i + 1).padStart(2, "0")}.jpg`
    ),
  },
  {
    id: "kebony",
    name: "Kebony",
    description:
      "Tecnologia norueguesa de modificação molecular que transforma madeiras sustentáveis em produtos de alta performance. Resistência de madeira tropical com sustentabilidade de reflorestamento certificado.",
    images: Array.from(
      { length: 10 },
      (_, i) =>
        `https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_KE-${String(i + 1).padStart(2, "0")}.jpg`
    ),
  },
  {
    id: "unicos",
    name: "Únicos",
    description:
      "Projetos exclusivos e customizados que desafiam os padrões convencionais. Decks sob medida para arquiteturas singulares que pedem soluções fora do comum.",
    images: Array.from(
      { length: 6 },
      (_, i) =>
        `https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_UN-${String(i + 1).padStart(2, "0")}.jpg`
    ),
  },
];

/* ─── WhatsApp SVG ─── */
function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ─── Lightbox ─── */
function GalleryLightbox({
  images,
  currentIndex,
  open,
  onClose,
  onNavigate,
}: {
  images: string[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (idx: number) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((currentIndex + 1) % images.length);
      if (e.key === "ArrowLeft") onNavigate((currentIndex - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, currentIndex, images.length, onClose, onNavigate]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors z-10">
        <X size={28} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onNavigate((currentIndex - 1 + images.length) % images.length); }}
        className="absolute left-4 md:left-8 text-white/40 hover:text-white transition-colors z-10"
      >
        <ChevronLeft size={36} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onNavigate((currentIndex + 1) % images.length); }}
        className="absolute right-4 md:right-8 text-white/40 hover:text-white transition-colors z-10"
      >
        <ChevronRight size={36} />
      </button>
      <img
        src={images[currentIndex]}
        alt=""
        className="max-w-[92vw] max-h-[88vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {/* Counter removed */}
    </motion.div>
  );
}

/* ─── Collection Section ─── */
function CollectionSection({
  collection,
  index,
  onImageClick,
}: {
  collection: (typeof collections)[number];
  index: number;
  onImageClick: (collectionId: string, imageIdx: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };
  useEffect(() => {
    const interval = setInterval(() => {
      if (!scrollRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      if (scrollLeft + clientWidth >= scrollWidth - 10) {
        scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scroll("right");
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);


  const thin = { fontWeight: 200 } as const;
  const regular = { fontWeight: 400 } as const;
  const medium = { fontWeight: 500 } as const;

  return (
    <section id={`col-${collection.id}`} className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="mb-8"
      >
        {/* Header with arrows on the right */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
          <div className="max-w-[800px]">
            {/* Collection index removed */}
            <h2
              className="text-[#E8E4DF] text-[28px] md:text-[36px] lg:text-[44px] leading-[1.1] tracking-[0.02em] mb-4"
              style={thin}
            >
              {collection.name}
            </h2>
            <p className="text-[#E8E4DF]/50 text-[15px] md:text-[16px] leading-[1.7]" style={regular}>
              {collection.description}
            </p>
          </div>
          
          <div className="flex items-center gap-4 self-end md:self-auto pt-2">
            <button
              onClick={() => scroll("left")}
              className="w-10 h-10 flex items-center justify-center text-[#E8E4DF]/40 hover:text-[#E8E4DF] transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft size={32} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-10 h-10 flex items-center justify-center text-[#E8E4DF]/40 hover:text-[#E8E4DF] transition-colors"
              aria-label="Próximo"
            >
              <ChevronRight size={32} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Image Carousel (no hero image) */}
        <div className="relative">
          <div 
            ref={scrollRef} 
            className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide snap-x pb-4" 
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {collection.images.map((img, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => onImageClick(collection.id, i)}
                className="shrink-0 w-[240px] md:w-[320px] lg:w-[400px] aspect-[4/3] overflow-hidden group snap-start relative cursor-pointer"
              >
                <img
                  src={img}
                  alt={`${collection.name} ${String(i + 1).padStart(2, "0")}`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              </motion.button>
            ))}
          </div>
        </div>

      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════ */
export function Decks() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState(collections[0].id);
  const [lightbox, setLightbox] = useState<{ images: string[]; idx: number } | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("col-", "");
            setActiveNav(id);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    collections.forEach((col) => {
      const el = document.getElementById(`col-${col.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToCollection = (id: string) => {
    const el = document.getElementById(`col-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleImageClick = (collectionId: string, imageIdx: number) => {
    const col = collections.find((c) => c.id === collectionId);
    if (col) setLightbox({ images: col.images, idx: imageIdx });
  };

  const thin = { fontWeight: 200 } as const;
  const medium = { fontWeight: 500 } as const;
  const regular = { fontWeight: 400 } as const;
  const label = "text-[12px] uppercase tracking-[0.12em]";

  return (
    <div className="w-full min-h-screen bg-[#1A1A1A] relative" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEOHead
        title="Decks de Madeira — Pisos Externos para Piscinas, Jardins e Terraços"
        description="Decks em cumaru, ipê, garapa, Kebony e carvalho europeu. 4 coleções, mais de 30 imagens de projetos reais. Solicite orçamento."
        url="https://parket.com.br/decks"
        image="https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_BR-01.jpg"
      />

      {/* HEADER */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${headerScrolled ? "bg-[#1A1A1A]/95 backdrop-blur-sm border-b border-[#E8E4DF]/10" : "bg-transparent"}`}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 flex items-center justify-between h-20">
          <button onClick={() => navigate("/")} className="relative z-10">
            <span className="text-[22px] tracking-[0.12em] uppercase text-[#E8E4DF]" style={thin}>PARKET</span>
          </button>
          <button onClick={() => navigate("/")} className={`flex items-center gap-2 ${label} transition-colors duration-300 hover:opacity-70 text-[#E8E4DF]`} style={medium}>
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="relative h-[60vh] md:h-[75vh] w-full overflow-hidden">
        <img
          src="https://parket.com.br/wp-content/uploads/2025/10/PRO_DE_BR-01.jpg"
          alt="Decks de madeira Parket"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-[#1A1A1A]" />
        <div className="absolute inset-0 z-10 flex flex-col justify-end pb-12 md:pb-20 px-6 md:px-10 lg:px-20 max-w-[1280px] mx-auto left-0 right-0">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}>
            <p className={`text-[#E8E4DF]/40 ${label} mb-4`} style={medium}>Produtos / Decks</p>
            <h1 className="text-[#E8E4DF] text-[36px] md:text-[52px] lg:text-[68px] leading-[1.06] max-w-[800px] tracking-[0.02em]" style={thin}>
              Decks de Madeira
            </h1>
            <p className="text-[#E8E4DF]/50 text-[16px] md:text-[18px] leading-[1.65] mt-5 max-w-[560px]" style={regular}>
              Decks em madeiras tropicais de altíssima resistência para piscinas, jardins, terraços e áreas externas. {collections.length} coleções, mais de 30 imagens de projetos reais.
            </p>
          </motion.div>
        </div>
      </section>

      {/* COLLECTION NAV (sticky) */}
      <div ref={navRef} className="sticky top-20 z-40 bg-[#1A1A1A]/95 backdrop-blur-sm border-b border-[#E8E4DF]/8">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
          <div className="flex items-center gap-1 overflow-x-auto py-4 scrollbar-hide">
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => scrollToCollection(col.id)}
                className={`shrink-0 px-4 py-2 text-[12px] uppercase tracking-[0.08em] transition-all duration-300 ${
                  activeNav === col.id
                    ? "text-[#E8E4DF] bg-[#E8E4DF]/8"
                    : "text-[#8C8478] hover:text-[#E8E4DF]"
                }`}
                style={medium}
              >
                {col.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* COLLECTIONS */}
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 py-16 md:py-24 space-y-20 md:space-y-32">
        {collections.map((col, idx) => (
          <CollectionSection
            key={col.id}
            collection={col}
            index={idx}
            onImageClick={handleImageClick}
          />
        ))}
      </div>

      {/* CTA FINAL */}
      <section className="bg-[#0D0D0D] py-24 md:py-32 border-t border-[#E8E4DF]/5">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <p className={`text-[#9C8B6E] ${label} mb-6`} style={medium}>Pronto para começar?</p>
            <h2 className="text-[#E8E4DF] text-[28px] md:text-[36px] lg:text-[48px] leading-[1.15] tracking-[0.02em] mb-6" style={thin}>
              Solicite amostras, especificações
              <br className="hidden md:block" />
              técnicas ou um orçamento.
            </h2>
            <p className="text-[#8C8478] text-[16px] leading-[1.7] max-w-[500px] mx-auto mb-10" style={regular}>
              Nossa equipe técnica está pronta para ajudar na especificação do seu projeto. Fale diretamente com um especialista em decks.
            </p>
            <a
              href="#" onClick={handleLeadFormClick}
              className="border border-[#E8E4DF] text-[#E8E4DF] px-12 py-4 text-[13px] uppercase tracking-[0.08em] hover:bg-[#E8E4DF] hover:text-[#0D0D0D] transition-all duration-500 inline-flex items-center gap-3"
              style={medium}
            >
              <WhatsAppIcon size={18} />
              Falar com Especialista
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} />

      {lightbox && (
        <GalleryLightbox
          images={lightbox.images}
          currentIndex={lightbox.idx}
          open={true}
          onClose={() => setLightbox(null)}
          onNavigate={(idx) => setLightbox({ ...lightbox, idx })}
        />
      )}
    </div>
  );
}

export default Decks;