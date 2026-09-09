import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ChevronDown, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { Footer } from "../../components/Footer";
import { SEOHead } from "../../components/SEOHead";
import { ZoomImage } from "../../components/ZoomImage";

const images = [
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-01.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-02.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-03.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-04.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-05.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-06.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-07.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-08.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-09.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-10.jpg",
  "https://parket.com.br/wp-content/uploads/2025/10/INS_AP-11.jpg",
];

/* ─── Lightbox Component ─── */
function GalleryLightbox({ images, currentIndex,
  open,
  onClose,
  onNavigate,
}: { images: string[]; currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (idx: number) => void;
}) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    if (!open) return;
    setIsZoomed(false); // Reset zoom on open
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        setIsZoomed(false);
        onNavigate((currentIndex + 1) % images.length);
      }
      if (e.key === "ArrowLeft") {
        setIsZoomed(false);
        onNavigate((currentIndex - 1 + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, currentIndex, images.length, onClose, onNavigate]);

  if (!open) return null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center overflow-hidden"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors z-[110]"
      >
        <X size={28} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsZoomed(false);
          onNavigate((currentIndex - 1 + images.length) % images.length);
        }}
        className="absolute left-4 md:left-8 text-white/40 hover:text-white transition-colors z-[110]"
      >
        <ChevronLeft size={36} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsZoomed(false);
          onNavigate((currentIndex + 1) % images.length);
        }}
        className="absolute right-4 md:right-8 text-white/40 hover:text-white transition-colors z-[110]"
      >
        <ChevronRight size={36} />
      </button>

      <div 
        className={`relative w-full h-full flex items-center justify-center overflow-hidden ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsZoomed(!isZoomed);
        }}
        onMouseMove={handleMouseMove}
      >
        <img
          src={images[currentIndex]}
          alt=""
          className="max-w-[92vw] max-h-[88vh] md:max-w-[85vw] md:max-h-[85vh] object-contain transition-transform duration-300 ease-out pointer-events-none"
          style={{
            transform: isZoomed ? 'scale(2.5)' : 'scale(1)',
            transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
          }}
        />
      </div>

      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-[13px] tracking-[0.06em] z-[110]"
        style={{ fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {String(currentIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
      </div>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════ */
/*  Page Component                                      */
/* ═════════════════════════════════════════════════════ */
export function Apartamentos() {
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


  const navigate = useNavigate();
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const thin = { fontWeight: 200 } as const;
  const regular = { fontWeight: 400 } as const;
  const medium = { fontWeight: 500 } as const;
  const label = "text-[12px] uppercase tracking-[0.12em]";

  return (
    <div
      className="w-full min-h-screen bg-[#1A1A1A] relative"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <SEOHead
        title="Apartamentos — Projetos Parket"
        description="Inspire-se em projetos residenciais sofisticados com pisos e revestimentos em madeira nobre da Parket."
        keywords="apartamentos, projetos residenciais, pisos de madeira, revestimentos, inspiração"
      />

      {/* ─────────── HEADER ─────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          headerScrolled
            ? "bg-[#1A1A1A]/95 backdrop-blur-sm border-b border-[#E8E4DF]/10"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 flex items-center justify-between h-20">
          <button onClick={() => navigate("/")} className="relative z-10">
            <span
              className="text-[22px] tracking-[0.12em] uppercase text-[#E8E4DF]"
              style={thin}
            >
              PARKET
            </span>
          </button>

          <button
            onClick={() => navigate("/")}
            className={`flex items-center gap-2 ${label} transition-colors duration-300 hover:opacity-70 text-[#E8E4DF]`}
            style={medium}
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>
      </header>

      {/* ─────────── HERO ─────────── */}
      <section className="relative h-[60vh] md:h-[75vh] w-full overflow-hidden">
        <img
          src={images[0]}
          alt="Apartamentos — Parket"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-[#1A1A1A]" />

        <div className="absolute inset-0 z-10 flex flex-col justify-end pb-12 md:pb-20 px-6 md:px-10 lg:px-20 max-w-[1280px] mx-auto left-0 right-0">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p className={`text-[#E8E4DF]/40 ${label} mb-4`} style={medium}>
              Projetos / Apartamentos
            </p>
            <h1
              className="text-[#E8E4DF] text-[36px] md:text-[52px] lg:text-[68px] leading-[1.06] max-w-[800px] tracking-[0.02em]"
              style={thin}
            >
              Apartamentos
            </h1>
            <p
              className="text-[#E8E4DF]/50 text-[16px] md:text-[18px] leading-[1.65] mt-5 max-w-[560px]"
              style={regular}
            >
              Ambientes residenciais que traduzem sofisticação e conforto através da madeira nobre. Cada projeto revela como pisos e revestimentos transformam espaços em experiências sensoriais únicas.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─────────── GALLERY ─────────── */}
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mb-8"
        >
          {/* Collection header with arrows on the right */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div className="max-w-[800px]">
              <h2
                className="text-[#E8E4DF] text-[28px] md:text-[36px] lg:text-[44px] leading-[1.1] tracking-[0.02em] mb-4"
                style={thin}
              >
                Projetos em Apartamentos
              </h2>
              <p
                className="text-[#E8E4DF]/50 text-[15px] md:text-[16px] leading-[1.7]"
                style={regular}
              >
                Uma seleção de projetos residenciais que utilizam madeira como elemento central de design, criando ambientes sofisticados e acolhedores.
              </p>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto pt-2">
              <button
                onClick={() => scroll("left")}
                className="w-7 h-7 flex items-center justify-center text-[#E8E4DF]/40 hover:text-[#E8E4DF] transition-colors"
                aria-label="Anterior"
              >
                <ChevronLeft size={22} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => scroll("right")}
                className="w-7 h-7 flex items-center justify-center text-[#E8E4DF]/40 hover:text-[#E8E4DF] transition-colors"
                aria-label="Próximo"
              >
                <ChevronRight size={22} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Image Carousel */}
          <div className="relative">
            <div
              ref={scrollRef}
              className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide snap-x pb-4"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {images.map((img, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                  onClick={() => setLightboxIdx(i)}
                  className="shrink-0 w-[240px] md:w-[320px] lg:w-[400px] aspect-[4/3] overflow-hidden group snap-start relative cursor-pointer"
                >
                  <img
                    src={img}
                    alt={`Apartamentos ${String(i + 1).padStart(2, "0")}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                </motion.button>
              ))}
            </div>
          </div>

          
        </motion.div>
      </div>

      {/* ─────────── FOOTER ─────────── */}
      <Footer />

      {/* ─── Lightbox ─── */}
      {lightboxIdx !== null && (
        <GalleryLightbox images={images} currentIndex={lightboxIdx}
          open={true}
          onClose={() => setLightboxIdx(null)}
          onNavigate={(idx) => setLightboxIdx(idx)}
        />
      )}
    </div>
  );
}

export default Apartamentos;
