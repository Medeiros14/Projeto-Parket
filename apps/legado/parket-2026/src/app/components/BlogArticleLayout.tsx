import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Clock, Calendar, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router";
import { Footer } from "./Footer";
import { LeadFormModal } from "./LeadFormModal";
import { handleLeadFormClick } from "../lib/leadForm";

interface BlogArticleLayoutProps {
  title: string;
  subtitle: string;
  heroImage: string;
  category: string;
  readTime: string;
  publishDate: string;
  children: ReactNode;
  relatedArticles?: { title: string; slug: string; image: string; category: string }[];
}

const label = "text-[12px] uppercase tracking-[0.12em]";
const thin = { fontWeight: 200 } as const;
const medium = { fontWeight: 500 } as const;
const regular = { fontWeight: 400 } as const;

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor" />
    </svg>
  );
}

export function BlogArticleLayout({
  title,
  subtitle,
  heroImage,
  category,
  readTime,
  publishDate,
  children,
  relatedArticles = [],
}: BlogArticleLayoutProps) {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const onScroll = () => {
      setHeaderScrolled(window.scrollY > 60);
      setShowBackToTop(window.scrollY > 800);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#FAF8F5] relative" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${headerScrolled ? "bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-[#2A2A2A]/10" : "bg-transparent"}`}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 flex items-center justify-between h-20">
          <button onClick={() => navigate("/")} className="relative z-10">
            <span className={`text-[22px] tracking-[0.12em] uppercase ${headerScrolled ? "text-[#2A2A2A]" : "text-[#E8E4DF]"} transition-colors duration-500`} style={thin}>PARKET</span>
          </button>
          <button onClick={() => navigate("/")} className={`flex items-center gap-2 ${label} transition-colors duration-300 hover:opacity-70 ${headerScrolled ? "text-[#2A2A2A]" : "text-[#E8E4DF]"}`} style={medium}>
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Voltar ao Início</span>
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative h-[60vh] md:h-[75vh] w-full overflow-hidden">
        <img src={heroImage} alt={title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/70" />
        <div className="absolute inset-0 z-10 flex flex-col justify-end pb-12 md:pb-20 px-6 md:px-10 lg:px-20 max-w-[1280px] mx-auto left-0 right-0">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}>
            <div className="flex items-center gap-4 mb-5">
              <span className={`text-[#9C8B6E] ${label}`} style={medium}>{category}</span>
              <span className="text-[#E8E4DF]/30">|</span>
              <span className="flex items-center gap-1.5 text-[#E8E4DF]/50 text-[12px]" style={regular}>
                <Clock size={12} /> {readTime}
              </span>
              <span className="text-[#E8E4DF]/30">|</span>
              <span className="flex items-center gap-1.5 text-[#E8E4DF]/50 text-[12px]" style={regular}>
                <Calendar size={12} /> {publishDate}
              </span>
            </div>
            <h1 className="text-[#E8E4DF] text-[28px] md:text-[42px] lg:text-[56px] leading-[1.1] max-w-[900px] tracking-[0.02em]" style={thin}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-[#E8E4DF]/60 text-[16px] md:text-[18px] leading-[1.6] mt-5 max-w-[640px]" style={regular}>
                {subtitle}
              </p>
            )}
          </motion.div>
        </div>
      </section>

      {/* Article body */}
      <article className="bg-[#FAF8F5] py-16 md:py-24">
        <div className="max-w-[780px] mx-auto px-6 md:px-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="article-content">
            {children}
          </motion.div>
        </div>
      </article>

      {/* CTA band */}
      <section className="bg-[#1A1A1A] py-20 md:py-28">
        <div className="max-w-[780px] mx-auto px-6 md:px-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <p className={`text-[#9C8B6E] ${label} mb-5`} style={medium}>Fale com um especialista</p>
            <h2 className="text-[#E8E4DF] text-[24px] md:text-[32px] lg:text-[40px] leading-[1.15] tracking-[0.02em] mb-5" style={thin}>
              Precisa de orientação técnica<br className="hidden md:block" />para o seu projeto?
            </h2>
            <p className="text-[#8C8478] text-[15px] leading-[1.7] max-w-[480px] mx-auto mb-8" style={regular}>
              A equipe Parket está pronta para ajudar na especificação, orçamento e execução do seu projeto em madeira.
            </p>
            <a
              href="#" onClick={handleLeadFormClick}
              className="border border-[#E8E4DF] text-[#E8E4DF] px-10 py-4 text-[13px] uppercase tracking-[0.08em] hover:bg-[#E8E4DF] hover:text-[#0D0D0D] transition-all duration-500 inline-flex items-center gap-3"
              style={medium}
            >
              <WhatsAppIcon size={18} /> Falar com Especialista
            </a>
          </motion.div>
        </div>
      </section>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <section className="bg-[#FAF8F5] py-16 md:py-24 border-t border-[#2A2A2A]/5">
          <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
            <p className={`text-[#9C8B6E] ${label} mb-4`} style={medium}>Continue lendo</p>
            <h3 className="text-[#2A2A2A] text-[24px] md:text-[32px] leading-[1.15] tracking-[0.02em] mb-10" style={thin}>Artigos relacionados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedArticles.map((art) => (
                <button key={art.slug} onClick={() => navigate(`/blog/${art.slug}`)} className="group text-left">
                  <div className="aspect-[16/10] overflow-hidden mb-4">
                    <img src={art.image} alt={art.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  </div>
                  <span className={`text-[#9C8B6E] text-[11px] uppercase tracking-[0.08em]`} style={medium}>{art.category}</span>
                  <h4 className="text-[#2A2A2A] text-[16px] leading-[1.35] mt-2 group-hover:text-[#9C8B6E] transition-colors duration-300" style={{ fontWeight: 500 }}>{art.title}</h4>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back to top */}
      {showBackToTop && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-6 z-40 w-11 h-11 bg-[#2A2A2A] text-[#E8E4DF] flex items-center justify-center hover:bg-[#9C8B6E] transition-colors duration-300"
        >
          <ChevronUp size={18} />
        </motion.button>
      )}

      <Footer />
      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

/* ─── Reusable article typography helpers ─── */
export function ArticleH2({ children }: { children: ReactNode }) {
  return <h2 className="text-[#2A2A2A] text-[24px] md:text-[30px] leading-[1.2] tracking-[0.02em] mt-14 mb-6" style={{ fontWeight: 200 }}>{children}</h2>;
}
export function ArticleH3({ children }: { children: ReactNode }) {
  return <h3 className="text-[#2A2A2A] text-[20px] md:text-[22px] leading-[1.25] tracking-[0.02em] mt-10 mb-4" style={{ fontWeight: 300 }}>{children}</h3>;
}
export function ArticleP({ children }: { children: ReactNode }) {
  return <p className="text-[#4A4A4A] text-[16px] md:text-[17px] leading-[1.75] mb-5" style={{ fontWeight: 400 }}>{children}</p>;
}
export function ArticleList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 mb-6 ml-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="w-1.5 h-1.5 bg-[#9C8B6E] mt-2 shrink-0" />
          <span className="text-[#4A4A4A] text-[16px] leading-[1.65]" style={{ fontWeight: 400 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}
export function ArticleImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-10 -mx-4 md:mx-0">
      <img src={src} alt={alt} className="w-full aspect-[16/9] object-cover" />
      {caption && <figcaption className="text-[#8C8478] text-[13px] mt-3 px-4 md:px-0" style={{ fontWeight: 400 }}>{caption}</figcaption>}
    </figure>
  );
}
export function ArticleHighlight({ children }: { children: ReactNode }) {
  return (
    <blockquote className="border-l-2 border-[#9C8B6E] pl-6 my-8 py-2">
      <p className="text-[#2A2A2A] text-[18px] md:text-[20px] leading-[1.55] italic" style={{ fontWeight: 300 }}>{children}</p>
    </blockquote>
  );
}
export function ArticleDivider() {
  return <hr className="border-t border-[#2A2A2A]/10 my-10" />;
}

/* ─── FAQ Section (SEO structured data for Google & AI) ─── */
export function ArticleFAQ({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <section className="mt-14 mb-8">
      <h2 className="text-[#2A2A2A] text-[24px] md:text-[30px] leading-[1.2] tracking-[0.02em] mb-8" style={{ fontWeight: 200 }}>
        Perguntas frequentes
      </h2>
      <div className="space-y-6">
        {items.map((item, i) => (
          <details key={i} className="group border-b border-[#2A2A2A]/8 pb-5">
            <summary className="cursor-pointer list-none flex items-start justify-between gap-4 text-[#2A2A2A] text-[17px] md:text-[18px] leading-[1.45]" style={{ fontWeight: 500 }}>
              <span>{item.question}</span>
              <span className="text-[#9C8B6E] text-[20px] shrink-0 transition-transform duration-300 group-open:rotate-45 mt-0.5">+</span>
            </summary>
            <p className="text-[#4A4A4A] text-[15px] md:text-[16px] leading-[1.7] mt-4 pr-8" style={{ fontWeight: 400 }}>
              {item.answer}
            </p>
          </details>
        ))}
      </div>
      {/* JSON-LD FAQ Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          }),
        }}
      />
    </section>
  );
}

/* ─── Summary/Key Takeaway Box (SEO featured snippet bait) ─── */
export function ArticleSummary({ title, items }: { title?: string; items: string[] }) {
  return (
    <div className="bg-[#F3F0EB] border border-[#2A2A2A]/8 p-6 md:p-8 my-10">
      <p className="text-[#9C8B6E] text-[12px] uppercase tracking-[0.12em] mb-4" style={{ fontWeight: 500 }}>
        {title || "Resumo do artigo"}
      </p>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="text-[#9C8B6E] text-[16px] shrink-0 mt-0.5" style={{ fontWeight: 500 }}>✓</span>
            <span className="text-[#2A2A2A] text-[15px] leading-[1.55]" style={{ fontWeight: 400 }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}