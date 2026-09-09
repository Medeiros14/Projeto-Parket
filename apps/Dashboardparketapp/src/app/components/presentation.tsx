import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  X,
  Maximize2,
  Minimize2,
  Home,
} from "lucide-react";
import { slides as defaultSlides, type SlideData } from "./slides-data";
import { parketLogo } from "./slides-data";
import {
  CoverSlide,
  SectionSlide,
  SplitSlide,
  ContentSlide,
  GridSlide,
  ProcessSlide,
  FunnelSlide,
  TwoColumnSlide,
  StatementSlide,
  MetricsSlide,
  RoleSlide,
  ClosingSlide,
  ScriptSlide,
  PaletteSlide,
  DosDontsSlide,
  BrandAxisSlide,
  PersonaSlide,
  VisualSlide,
} from "./slide-components";

function renderSlide(slide: SlideData) {
  switch (slide.type) {
    case "cover":
      return <CoverSlide {...(slide.props as any)} />;
    case "section":
      return <SectionSlide {...(slide.props as any)} />;
    case "split":
      return <SplitSlide {...(slide.props as any)} />;
    case "content":
      return <ContentSlide {...(slide.props as any)} />;
    case "grid":
      return <GridSlide {...(slide.props as any)} />;
    case "process":
      return <ProcessSlide {...(slide.props as any)} />;
    case "funnel":
      return <FunnelSlide {...(slide.props as any)} />;
    case "twocolumn":
      return <TwoColumnSlide {...(slide.props as any)} />;
    case "statement":
      return <StatementSlide {...(slide.props as any)} />;
    case "metrics":
      return <MetricsSlide {...(slide.props as any)} />;
    case "role":
      return <RoleSlide {...(slide.props as any)} />;
    case "closing":
      return <ClosingSlide {...(slide.props as any)} />;
    case "script":
      return <ScriptSlide {...(slide.props as any)} />;
    case "palette":
      return <PaletteSlide {...(slide.props as any)} />;
    case "dosdonts":
      return <DosDontsSlide {...(slide.props as any)} />;
    case "brandaxis":
      return <BrandAxisSlide {...(slide.props as any)} />;
    case "persona":
      return <PersonaSlide {...(slide.props as any)} />;
    case "visual":
      return <VisualSlide {...(slide.props as any)} />;
    default:
      return null;
  }
}

function getSlideTitle(slide: SlideData): string {
  const p = slide.props;
  if (p.title) return p.title.replace(/\n/g, " ");
  if (p.statement) return p.statement.substring(0, 40) + "…";
  return "Slide";
}

/* ─── Slide Overview Grid ─── */
function SlideOverview({
  slides,
  onSelect,
  currentIndex,
  onClose,
}: {
  slides: SlideData[];
  onSelect: (i: number) => void;
  currentIndex: number;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A0A0A] overflow-auto"
      style={{ animation: "fadeIn 0.3s ease both" }}
    >
      <div className="sticky top-0 z-10 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/[0.04] px-5 py-3 flex items-center justify-between">
        <div>
          <span
            className="tracking-[0.3em] uppercase"
            style={{ fontSize: "0.55rem", color: "#B8AA9A" }}
          >
            Visão Geral
          </span>
          <h2
            className="text-white"
            style={{ fontSize: "0.85rem", fontWeight: 500 }}
          >
            {slides.length} Slides
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white transition-colors p-2"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 p-4">
        {slides.map((slide, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`relative bg-[#111] rounded-lg overflow-hidden border transition-all duration-200 hover:border-[#B8AA9A]/40 text-left group ${
              i === currentIndex
                ? "border-[#B8AA9A] ring-1 ring-[#B8AA9A]/20"
                : "border-white/[0.04]"
            }`}
            style={{ aspectRatio: "9/16" }}
          >
            <div className="absolute inset-0 scale-[0.2] origin-top-left pointer-events-none" style={{ width: "500%", height: "500%" }}>
              {renderSlide(slide)}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <span
                className="text-white/40 block"
                style={{ fontSize: "0.5rem" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className="text-white block truncate"
                style={{ fontSize: "0.55rem", fontWeight: 500 }}
              >
                {getSlideTitle(slide)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Presentation ─── */
export function Presentation({ slides: slidesFromProps, backLink }: { slides?: SlideData[]; backLink?: { label: string; href: string } }) {
  const slides = slidesFromProps || defaultSlides;
  const [current, setCurrent] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [displaySlide, setDisplaySlide] = useState(0);
  const slideRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < slides.length && !transitioning) {
        const dir = index > current ? 1 : -1;
        setTransitioning(true);
        if (slideRef.current) {
          slideRef.current.style.opacity = "0";
          slideRef.current.style.transform = `translateY(${dir * 20}px)`;
        }
        setTimeout(() => {
          setCurrent(index);
          setDisplaySlide(index);
          if (slideRef.current) {
            slideRef.current.style.transform = `translateY(${-dir * 20}px)`;
            slideRef.current.offsetHeight;
            slideRef.current.style.opacity = "1";
            slideRef.current.style.transform = "translateY(0)";
          }
          setTimeout(() => setTransitioning(false), 350);
        }, 200);
      }
    },
    [current, transitioning]
  );

  const next = useCallback(() => {
    if (current < slides.length - 1) goTo(current + 1);
  }, [current, goTo]);

  const prev = useCallback(() => {
    if (current > 0) goTo(current - 1);
  }, [current, goTo]);

  const toggleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      } else {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showOverview) {
        if (e.key === "Escape") setShowOverview(false);
        return;
      }
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          prev();
          break;
        case "Escape":
          setShowOverview(true);
          break;
        case "f":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, showOverview, toggleFullscreen]);

  // Touch/swipe support for mobile
  const touchStartY = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
  }, [next, prev]);

  const progress = ((current + 1) / slides.length) * 100;

  return (
    <div
      className="relative w-full h-full bg-[#0A0A0A] flex items-center justify-center overflow-hidden select-none"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Vertical slide container */}
      <div
        className="relative bg-[#0A0A0A] overflow-hidden shadow-2xl"
        style={{
          width: "min(100vw, calc(100vh * 9 / 16))",
          height: "min(100vh, calc(100vw * 16 / 9))",
          maxWidth: "100vw",
          maxHeight: "100vh",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Progress bar (left side, vertical) */}
        <div className="absolute top-0 left-0 bottom-0 z-30 w-[2px] bg-white/[0.04]">
          <div
            className="w-full transition-all duration-400 ease-out"
            style={{ background: "#B8AA9A", height: `${progress}%` }}
          />
        </div>

        {/* Logo watermark */}
        <div className="absolute top-3 right-4 z-30 pointer-events-none">
          <img
            src={parketLogo}
            alt="Parket"
            className="h-3.5 w-auto object-contain opacity-20"
          />
        </div>

        {/* Home link */}
        <a
          href="/"
          className="absolute top-3 left-4 z-30 text-white/15 hover:text-white/40 transition-colors p-1"
          title="Voltar ao início"
        >
          <Home size={12} />
        </a>

        {/* Slide content */}
        <div
          ref={slideRef}
          className="absolute inset-0"
          style={{ transition: "opacity 0.3s ease, transform 0.3s ease" }}
        >
          {renderSlide(slides[displaySlide])}
        </div>

        {/* Bottom nav */}
        <div className="absolute bottom-0 left-0 right-0 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOverview(true)}
                className="text-white/20 hover:text-white/50 transition-colors p-1"
                title="Visão geral"
              >
                <Grid3X3 size={12} />
              </button>
              <span className="text-white/20" style={{ fontSize: "0.6rem", letterSpacing: "0.05em" }}>
                <span className="text-white/40">
                  {String(current + 1).padStart(2, "0")}
                </span>
                {" / "}
                {String(slides.length).padStart(2, "0")}
              </span>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={prev}
                disabled={current === 0}
                className="text-white/20 hover:text-white/50 disabled:text-white/[0.06] transition-colors p-1.5"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={next}
                disabled={current === slides.length - 1}
                className="text-white/20 hover:text-white/50 disabled:text-white/[0.06] transition-colors p-1.5"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <button
              onClick={toggleFullscreen}
              className="text-white/20 hover:text-white/50 transition-colors p-1"
              title="Tela cheia"
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </div>

        {/* Click zones (top/bottom for vertical) */}
        <div
          className="absolute left-0 right-0 top-0 z-20 cursor-pointer"
          style={{ height: "25%" }}
          onClick={prev}
        />
        <div
          className="absolute left-0 right-0 bottom-12 z-20 cursor-pointer"
          style={{ height: "25%" }}
          onClick={next}
        />
      </div>

      {/* Overview */}
      {showOverview && (
        <SlideOverview
          slides={slides}
          currentIndex={current}
          onSelect={(i) => {
            setDisplaySlide(i);
            setCurrent(i);
            setShowOverview(false);
          }}
          onClose={() => setShowOverview(false)}
        />
      )}
    </div>
  );
}