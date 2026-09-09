import { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";

export function Header() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleScroll = useCallback(() => {
    const heroEl = document.getElementById("hero");
    if (!heroEl) {
      setScrollProgress(1);
      return;
    }
    const heroHeight = heroEl.offsetHeight;
    // Start transition at 60% of hero, fully solid at 90%
    const start = heroHeight * 0.6;
    const end = heroHeight * 0.9;
    const progress = Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
    setScrollProgress(progress);
  }, []);

  useEffect(() => {
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrolled = scrollProgress > 0.5;

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks = [
    { label: "Produtos", id: "produtos" },
    { label: "Projetos", id: "inspiracao" },
    { label: "Sobre", id: "sobre" },
    { label: "Contato", id: "contato" },
  ];

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-colors duration-300"
        style={{
          backgroundColor: `rgba(250, 248, 245, ${scrollProgress * 0.95})`,
          backdropFilter: scrollProgress > 0.1 ? `blur(${scrollProgress * 12}px)` : "none",
          borderBottom: `1px solid rgba(217, 211, 203, ${scrollProgress})`,
        }}
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 flex items-center justify-between h-16 md:h-18">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="relative z-10">
            <span
              className={`text-[20px] md:text-[22px] tracking-[0.2em] transition-colors duration-500 ${
                scrolled ? "text-[#2A2A2A]" : "text-[#E8E4DF]"
              }`}
              style={{ fontWeight: 200 }}
            >
              PARKET
            </span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`text-[10px] uppercase tracking-[0.15em] transition-colors duration-500 hover:opacity-70 ${
                  scrolled ? "text-[#2A2A2A]" : "text-[#B5A48A]"
                }`}
                style={{ fontWeight: 400 }}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden relative z-10 transition-colors duration-500 ${
              menuOpen ? "text-[#E8E4DF]" : scrolled ? "text-[#2A2A2A]" : "text-[#E8E4DF]"
            }`}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Fullscreen Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-[#0D0D0D] transition-all duration-500 flex flex-col items-center justify-center gap-8 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {navLinks.map((link) => (
          <button
            key={link.id}
            onClick={() => scrollTo(link.id)}
            className="text-[#E8E4DF] text-[24px] tracking-[0.05em] hover:text-[#B5A48A] transition-colors duration-300"
            style={{ fontWeight: 200 }}
          >
            {link.label}
          </button>
        ))}
      </div>
    </>
  );
}