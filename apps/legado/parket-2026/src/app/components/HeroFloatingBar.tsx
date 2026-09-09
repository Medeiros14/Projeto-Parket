import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronUp, Phone } from "lucide-react";
import { handleLeadFormClick } from "../lib/leadForm";

interface HeroFloatingBarProps {
  onOpenForm: () => void;
}

const PHONE_NUMBER = "tel:+5511999600222";

export function HeroFloatingBar({ onOpenForm }: HeroFloatingBarProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hideBar, setHideBar] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
      
      // Detectar se chegou na seção de contato (última seção)
      const contactSection = document.getElementById("contato");
      if (contactSection) {
        const contactTop = contactSection.offsetTop;
        const scrollPosition = window.scrollY + window.innerHeight;
        const triggerPoint = contactTop + 100; // Esconde um pouco antes de chegar
        
        setHideBar(scrollPosition >= triggerPoint);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Esconde a barra inteira quando chegar na última seção
  if (hideBar) return null;

  return (
    <motion.div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 antialiased"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      style={{ WebkitFontSmoothing: 'antialiased', backfaceVisibility: 'hidden' }}
    >
      {/* Scroll up indicator */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-10 h-10 border border-[#2A2A2A]/25 bg-[#2A2A2A]/10 backdrop-blur-md flex items-center justify-center hover:bg-[#2A2A2A]/25 transition-colors duration-300 antialiased"
            style={{ borderRadius: "50%", WebkitFontSmoothing: 'antialiased', backfaceVisibility: 'hidden' }}
          >
            <ChevronUp size={18} className="text-[#2A2A2A]/70" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Phone + WhatsApp glassmorphism bar */}
      <div
        className="flex items-center bg-[#2A2A2A]/15 backdrop-blur-2xl border border-[#2A2A2A]/30 overflow-hidden shadow-xl antialiased"
        style={{ 
          borderRadius: "40px",
          WebkitFontSmoothing: 'antialiased',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          willChange: 'transform'
        }}
      >
        {/* Phone button */}
        <a
          href={PHONE_NUMBER}
          className="flex items-center justify-center w-16 h-14 md:w-20 md:h-16 hover:bg-[#2A2A2A]/15 transition-colors duration-300 antialiased"
          aria-label="Ligar"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <Phone size={22} className="text-white md:w-6 md:h-6" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} />
        </a>

        {/* Divider */}
        <div className="w-[1px] h-8 bg-[#2A2A2A]/30" />

        {/* WhatsApp button — direct link */}
        <a
          href="#" onClick={handleLeadFormClick}
          className="flex items-center justify-center w-16 h-14 md:w-20 md:h-16 hover:bg-[#2A2A2A]/15 transition-colors duration-300 antialiased"
          aria-label="WhatsApp"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className="md:w-[32px] md:h-[32px]"
            style={{ 
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))',
              shapeRendering: 'geometricPrecision'
            }}
          >
            <path
              d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
              fill="white"
            />
          </svg>
        </a>
      </div>
    </motion.div>
  );
}