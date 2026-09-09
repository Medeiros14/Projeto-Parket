import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Grid3X3, ArrowLeft } from "lucide-react";
import { ImageLightbox } from "./ImageLightbox";

export interface Collection {
  name: string;
  slug: string;
  description: string;
  heroImage: string;
  images: string[];
}

interface CollectionDetailProps {
  collections: Collection[];
  onRequestQuote: () => void;
}

const label = "text-[12px] uppercase tracking-[0.12em]";
const thin = { fontWeight: 200 } as const;
const medium = { fontWeight: 500 } as const;
const regular = { fontWeight: 400 } as const;
const mono = { fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" } as const;

export function CollectionDetail({ collections, onRequestQuote }: CollectionDetailProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const activeCollection = collections.find((c) => c.slug === activeSlug);

  const openLightbox = (images: string[], idx: number) => {
    setLightboxIdx(idx);
    setLightboxOpen(true);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!activeCollection ? (
          /* ─── Grid of Collections ─── */
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5"
          >
            {collections.map((col, idx) => (
              <motion.button
                key={col.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                onClick={() => setActiveSlug(col.slug)}
                className="group text-left cursor-pointer"
              >
                <div className="aspect-[4/3] overflow-hidden mb-3 relative">
                  <img
                    src={col.heroImage}
                    alt={col.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span
                      className="bg-black/60 backdrop-blur-sm text-white/80 px-2.5 py-1 text-[11px] tracking-[0.06em]"
                      style={mono}
                    >
                      {col.images.length} fotos
                    </span>
                  </div>
                </div>
                <h3
                  className="text-[#E8E4DF] text-[16px] md:text-[18px] tracking-[0.02em] mb-1 group-hover:text-white transition-colors duration-300"
                  style={{ fontWeight: 300, fontStyle: "italic" }}
                >
                  {col.name}
                </h3>
                <p
                  className="text-[#E8E4DF]/40 text-[12px] md:text-[13px] leading-[1.5] line-clamp-2"
                  style={regular}
                >
                  {col.description}
                </p>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          /* ─── Collection Detail View ─── */
          <motion.div
            key={activeCollection.slug}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Back + Title Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setActiveSlug(null)}
                  className="w-10 h-10 border border-[#E8E4DF]/20 flex items-center justify-center text-[#E8E4DF]/60 hover:text-[#E8E4DF] hover:border-[#E8E4DF]/40 transition-all duration-300"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <p className={`text-[#9C8B6E] ${label} mb-1`} style={medium}>
                    {activeCollection.images.length} Imagens
                  </p>
                  <h3
                    className="text-[#E8E4DF] text-[24px] md:text-[32px] tracking-[0.02em]"
                    style={thin}
                  >
                    {activeCollection.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={onRequestQuote}
                className="border border-[#E8E4DF]/30 text-[#E8E4DF]/70 px-6 py-3 text-[12px] uppercase tracking-[0.08em] hover:bg-[#E8E4DF] hover:text-[#0D0D0D] transition-all duration-500 self-start md:self-auto"
                style={medium}
              >
                Solicitar Amostras
              </button>
            </div>

            {/* Description */}
            <p
              className="text-[#E8E4DF]/50 text-[15px] leading-[1.7] max-w-[700px] mb-10"
              style={regular}
            >
              {activeCollection.description}
            </p>

            {/* Hero image */}
            <div
              className="aspect-[21/9] overflow-hidden mb-5 cursor-pointer group"
              onClick={() => openLightbox(activeCollection.images, 0)}
            >
              <img
                src={activeCollection.heroImage}
                alt={activeCollection.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            </div>

            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
              {activeCollection.images.map((img, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  onClick={() => openLightbox(activeCollection.images, i)}
                  className="aspect-[4/3] overflow-hidden group relative cursor-pointer"
                >
                  <img
                    src={img}
                    alt={`${activeCollection.name} ${String(i + 1).padStart(2, "0")}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                    <Grid3X3
                      size={20}
                      className="text-white/0 group-hover:text-white/70 transition-all duration-300"
                    />
                  </div>
                  <span
                    className="absolute bottom-2 right-2 text-white/0 group-hover:text-white/50 text-[11px] transition-all duration-300"
                    style={mono}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Back + CTA */}
            <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                onClick={() => setActiveSlug(null)}
                className={`flex items-center gap-2 text-[#E8E4DF]/40 ${label} hover:text-[#E8E4DF]/70 transition-colors duration-300`}
                style={medium}
              >
                <ArrowLeft size={14} /> Ver todas as linhas
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      {activeCollection && (
        <ImageLightbox
          images={activeCollection.images}
          currentIndex={lightboxIdx}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setLightboxIdx}
        />
      )}
    </>
  );
}

/* ─── Simple Full Gallery (for pages without subcollections) ─── */
interface FullGalleryProps {
  images: string[];
  title?: string;
}

export function FullImageGallery({ images, title }: FullGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const openLightbox = (idx: number) => {
    setLightboxIdx(idx);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
        {images.map((img, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
            onClick={() => openLightbox(i)}
            className="aspect-[4/3] overflow-hidden group relative cursor-pointer"
          >
            <img
              src={img}
              alt={`${title || "Galeria"} ${String(i + 1).padStart(2, "0")}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <Grid3X3
                size={20}
                className="text-white/0 group-hover:text-white/70 transition-all duration-300"
              />
            </div>
            <span
              className="absolute bottom-2 right-2 text-white/0 group-hover:text-white/50 text-[11px] transition-all duration-300"
              style={mono}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
          </motion.button>
        ))}
      </div>

      <ImageLightbox
        images={images}
        currentIndex={lightboxIdx}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIdx}
      />
    </>
  );
}
