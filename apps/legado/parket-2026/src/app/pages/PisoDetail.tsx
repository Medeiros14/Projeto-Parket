import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, X, ChevronLeft, ChevronRight } from "lucide-react";
import { LeadFormModal } from "../components/LeadFormModal";
import { SEOHead } from "../components/SEOHead";
import { Footer } from "../components/Footer";
import { ZoomImage } from "../components/ZoomImage";
import { handleLeadFormClick } from "../lib/leadForm";

/* ─── Product Database ─── */
const products = {
  "carvalho-europeu-natural": {
    name: "Carvalho Europeu Natural",
    category: "Carvalhos",
    description:
      "O Carvalho Europeu Natural representa a essência da madeira nobre em sua forma mais pura. Importado diretamente da Alemanha, este piso combina durabilidade secular com a elegância atemporal que caracteriza os melhores projetos de arquitetura contemporânea.",
    specs: [
      { label: "Origem", value: "Alemanha" },
      { label: "Espécie", value: "Quercus robur" },
      { label: "Largura", value: "190mm - 240mm" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Natural fosco" },
      { label: "Aplicação", value: "Residencial / Comercial" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-01.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-04.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-07.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-10.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-13.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-16.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-19.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-22.jpg",
    ],
  },
  "carvalho-fumo": {
    name: "Carvalho Fumo",
    category: "Carvalhos",
    description:
      "O tratamento especial a vapor confere ao Carvalho Fumo sua tonalidade única e sofisticada. Este processo tradicional europeu realça a beleza natural da madeira, criando um piso de caráter marcante e elegância contemporânea.",
    specs: [
      { label: "Origem", value: "Alemanha" },
      { label: "Espécie", value: "Quercus robur" },
      { label: "Largura", value: "190mm - 240mm" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Fumê acetinado" },
      { label: "Aplicação", value: "Residencial / Comercial" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-02.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-05.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-08.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-11.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-14.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-17.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-20.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-23.jpg",
    ],
  },
  "carvalho-neve": {
    name: "Carvalho Neve",
    category: "Carvalhos",
    description:
      "Com seu acabamento claro e luminoso, o Carvalho Neve traz amplitude e sofisticação aos ambientes. O processo de escovação e branqueamento ressalta a textura natural da madeira, criando um piso de elegância nórdica.",
    specs: [
      { label: "Origem", value: "Alemanha" },
      { label: "Espécie", value: "Quercus robur" },
      { label: "Largura", value: "190mm - 240mm" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Branco acetinado" },
      { label: "Aplicação", value: "Residencial / Comercial" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-03.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-06.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-09.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-12.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-15.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-18.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-21.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CA-24.jpg",
    ],
  },
  "cumaru-natural": {
    name: "Cumaru Natural",
    category: "Clássicos",
    description:
      "O Cumaru é uma das madeiras brasileiras mais valorizadas internacionalmente. Sua densidade e durabilidade excepcionais, aliadas à beleza de sua tonalidade dourada, fazem dele escolha preferencial para projetos de alto padrão.",
    specs: [
      { label: "Origem", value: "Brasil" },
      { label: "Espécie", value: "Dipteryx odorata" },
      { label: "Largura", value: "100mm - 180mm" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Natural verniz" },
      { label: "Aplicação", value: "Residencial / Comercial / Externa" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-01.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-04.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-07.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-10.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-01.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-03.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-05.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-02.jpg",
    ],
  },
  "ipe-tabaco": {
    name: "Ipê Tabaco",
    category: "Clássicos",
    description:
      "O Ipê é símbolo de resistência e nobreza na madeira brasileira. O acabamento Tabaco confere uma tonalidade rica e profunda, perfeita para ambientes que buscam sofisticação e caráter marcante.",
    specs: [
      { label: "Origem", value: "Brasil" },
      { label: "Espécie", value: "Handroanthus spp" },
      { label: "Largura", value: "100mm - 150mm" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Tabaco verniz" },
      { label: "Aplicação", value: "Residencial / Comercial / Externa" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-02.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-05.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-08.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-03.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-02.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-06.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-03.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-05.jpg",
    ],
  },
  "peroba-rosa": {
    name: "Peroba Rosa",
    category: "Eternos",
    description:
      "Madeira histórica de demolição, cada tábua de Peroba Rosa carrega décadas de memória. Recuperada com técnica e cuidado, oferece autenticidade e alma aos projetos contemporâneos que valorizam sustentabilidade e história.",
    specs: [
      { label: "Origem", value: "Brasil (Demolição)" },
      { label: "Espécie", value: "Aspidosperma polyneuron" },
      { label: "Largura", value: "Variável 120mm - 200mm" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Rústico natural" },
      { label: "Aplicação", value: "Residencial / Comercial" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-03.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-02.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-05.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-08.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-03.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-06.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-09.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-06.jpg",
    ],
  },
  jatoba: {
    name: "Jatobá",
    category: "Eternos",
    description:
      "O Jatobá é reconhecido mundialmente por sua dureza excepcional e tonalidade avermelhada única. Madeira de lei brasileira que amadurece com o tempo, ganhando ainda mais personalidade e profundidade de cor.",
    specs: [
      { label: "Origem", value: "Brasil" },
      { label: "Espécie", value: "Hymenaea courbaril" },
      { label: "Largura", value: "100mm - 160mm" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Natural verniz" },
      { label: "Aplicação", value: "Residencial / Comercial / Alta circulação" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-01.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-04.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-07.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-02.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-04.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-06.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-08.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-11.jpg",
    ],
  },
  tauari: {
    name: "Tauari",
    category: "Brazil",
    description:
      "O Tauari se destaca pela tonalidade clara e uniformidade. Madeira brasileira de densidade média-alta, ideal para ambientes que buscam luminosidade e amplitude visual com a qualidade das espécies nacionais.",
    specs: [
      { label: "Origem", value: "Brasil" },
      { label: "Espécie", value: "Couratari spp" },
      { label: "Largura", value: "100mm - 150mm" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Natural fosco" },
      { label: "Aplicação", value: "Residencial / Comercial" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-02.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-01.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-04.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-06.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-04.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-07.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-04.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-09.jpg",
    ],
  },
  freijo: {
    name: "Freijó",
    category: "Brazil",
    description:
      "O Freijó encanta pela beleza de seus veios marcantes e tonalidade dourada. Madeira brasileira que traz personalidade e calor aos ambientes, sendo escolha frequente em projetos de design de interiores sofisticados.",
    specs: [
      { label: "Origem", value: "Brasil" },
      { label: "Espécie", value: "Cordia goeldiana" },
      { label: "Largura", value: "100mm - 160mm" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Natural acetinado" },
      { label: "Aplicação", value: "Residencial / Comercial" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_ET-03.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-02.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-05.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-09.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_BR-03.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_CL-01.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-07.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-12.jpg",
    ],
  },
  "piso-geometrico": {
    name: "Piso Geométrico",
    category: "Grandiosos",
    description:
      "Designs geométricos exclusivos que transformam o piso em elemento escultural. Combinações precisas de madeiras nobres criando padrões únicos que expressam sofisticação e autoria em cada projeto.",
    specs: [
      { label: "Origem", value: "Brasil / Europa" },
      { label: "Espécie", value: "Mix de madeiras nobres" },
      { label: "Largura", value: "Projeto personalizado" },
      { label: "Espessura", value: "20mm" },
      { label: "Acabamento", value: "Customizado" },
      { label: "Aplicação", value: "Residencial / Comercial premium" },
    ],
    images: [
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-01.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-04.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-07.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-10.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-02.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-05.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-08.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-11.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_GR-13.jpg",
      "https://parket.com.br/wp-content/uploads/2025/10/PRO_PI_MA-01.jpg",
    ],
  },
};

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

/* ─── Lightbox Component ─── */
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
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors z-10"
      >
        <X size={28} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((currentIndex - 1 + images.length) % images.length);
        }}
        className="absolute left-4 md:left-8 text-white/40 hover:text-white transition-colors z-10"
      >
        <ChevronLeft size={36} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((currentIndex + 1) % images.length);
        }}
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

      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-[13px] tracking-[0.06em]"
        style={{ fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {String(currentIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
      </div>
    </motion.div>
  );
}

/* ─── Main Component ─── */
export function PisoDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; idx: number } | null>(null);

  const product = slug ? products[slug as keyof typeof products] : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-[#E8E4DF] text-[32px] mb-4" style={{ fontWeight: 200 }}>
            Produto não encontrado
          </h1>
          <button
            onClick={() => navigate("/")}
            className="text-[#9C8B6E] hover:text-[#B5A48A] transition-colors"
          >
            Voltar para Home
          </button>
        </div>
      </div>
    );
  }

  const handleImageClick = (imageIdx: number) => {
    setLightbox({ images: product.images, idx: imageIdx });
  };

  const thin = { fontWeight: 200 } as const;
  const medium = { fontWeight: 500 } as const;
  const regular = { fontWeight: 400 } as const;
  const label = "text-[12px] uppercase tracking-[0.12em]";

  return (
    <div
      className="w-full min-h-screen bg-[#1A1A1A] relative"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <SEOHead
        title={`${product.name} - Pisos de Madeira | Parket`}
        description={product.description}
        canonical={`https://parket.com.br/pisos/${slug}`}
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
          src={product.images[0]}
          alt={product.name}
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
              {product.category}
            </p>
            <h1
              className="text-[#E8E4DF] text-[36px] md:text-[52px] lg:text-[68px] leading-[1.06] max-w-[800px] tracking-[0.02em]"
              style={thin}
            >
              {product.name}
            </h1>
            <p
              className="text-[#E8E4DF]/50 text-[16px] md:text-[18px] leading-[1.65] mt-5 max-w-[560px]"
              style={regular}
            >
              {product.description}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─────────── CONTENT ─────────── */}
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <p className={`text-[#9C8B6E] ${label} mb-4`} style={medium}>
            Especificações Técnicas
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 border-b border-[#E8E4DF]/10 pb-12">
            <p className="text-[#E8E4DF]/70 text-[16px] leading-[1.75]" style={regular}>
              {product.description}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
              {product.specs.map((spec, i) => (
                <div key={i}>
                  <p className="text-[#E8E4DF]/40 text-[11px] uppercase tracking-[0.08em] mb-1" style={medium}>
                    {spec.label}
                  </p>
                  <p className="text-[#E8E4DF] text-[14px]" style={regular}>
                    {spec.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Gallery Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center justify-between mb-6">
            <p className={`text-[#9C8B6E] ${label}`} style={medium}>
              Galeria de Imagens
            </p>
            <p className="text-[#8C8478] text-[13px] font-mono">
              {product.images.length} fotos
            </p>
          </div>

          {/* Main Image */}
          <ZoomImage
            src={product.images[0]}
            alt={product.name}
            className="aspect-[21/9] mb-4"
            onClick={() => handleImageClick(0)}
          />

          {/* Carousel with Arrows */}
          <div className="flex items-center gap-2 md:gap-4 relative px-0">
            <button
              onClick={() => {
                const el = document.getElementById('piso-carousel');
                if (el) el.scrollBy({ left: -el.clientWidth * 0.6, behavior: 'smooth' });
              }}
              className="w-10 h-10 flex items-center justify-center text-[#E8E4DF]/40 hover:text-[#E8E4DF] transition-colors shrink-0"
              aria-label="Anterior"
            >
              <ChevronLeft size={32} strokeWidth={1.5} />
            </button>
            
            <div className="flex-1 min-w-0">
              <div id="piso-carousel" className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide snap-x pb-4" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {product.images.slice(1).map((img, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                    onClick={() => handleImageClick(i + 1)}
                    className="shrink-0 w-[180px] md:w-[240px] lg:w-[320px] aspect-[4/3] overflow-hidden group snap-start relative cursor-pointer"
                  >
                    <img
                      src={img}
                      alt={`${product.name} ${i + 2}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                  </motion.button>
                ))}
              </div>
            </div>
            
            <button
              onClick={() => {
                const el = document.getElementById('piso-carousel');
                if (el) el.scrollBy({ left: el.clientWidth * 0.6, behavior: 'smooth' });
              }}
              className="w-10 h-10 flex items-center justify-center text-[#E8E4DF]/40 hover:text-[#E8E4DF] transition-colors shrink-0"
              aria-label="Próximo"
            >
              <ChevronRight size={32} strokeWidth={1.5} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* ─────────── CTA FINAL ─────────── */}
      <section className="bg-[#0D0D0D] py-24 md:py-32 border-t border-[#E8E4DF]/5">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className={`text-[#9C8B6E] ${label} mb-6`} style={medium}>
              Pronto para começar?
            </p>
            <h2
              className="text-[#E8E4DF] text-[28px] md:text-[36px] lg:text-[48px] leading-[1.15] tracking-[0.02em] mb-6"
              style={thin}
            >
              Solicite amostras, especificações
              <br className="hidden md:block" />
              técnicas ou um orçamento.
            </h2>
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

      {/* ─────────── FOOTER ─────────── */}
      <Footer />

      {/* ─── Global CTAs ─── */}
      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} />

      {/* ─── Lightbox ─── */}
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

export default PisoDetail;
