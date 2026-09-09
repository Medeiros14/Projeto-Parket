import { motion, useScroll, useTransform } from "motion/react";
import { useScrollRef } from "../hooks/useParallax";

export function Hero() {
  const sectionRef = useScrollRef<HTMLDivElement>();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Parallax: video moves slower than scroll
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  // Text fades and moves as user scrolls past
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 0.5], [0, -50]);

  const youtubeVideoId = "sDAxOwWD64w";
  const posterUrl = `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`;

  return (
    <section ref={sectionRef} id="hero" className="relative w-full overflow-hidden h-screen"
      style={{ backgroundColor: "#1A1A1A" }}
    >
      {/* Poster / fallback background — always behind the video */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${posterUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Parallax video container */}
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={{ y: videoY, scale: videoScale }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1&loop=1&playlist=${youtubeVideoId}&controls=0&showinfo=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1`}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.77vh] min-w-full h-[56.25vw] min-h-[100vh] md:min-h-[120vh]"
            style={{ 
              border: 'none',
              pointerEvents: 'none'
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title="Vídeo institucional Parket"
          />
        </div>
      </motion.div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/55 z-10" />

      {/* Title content — fades on scroll */}
      <motion.div
        className="relative z-20 h-full flex flex-col justify-end pb-24 md:pb-36 px-6 md:px-10 lg:px-20 max-w-[1280px] mx-auto"
        style={{ opacity: textOpacity, y: textY }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h1
            className="text-[#E8E4DF] text-[36px] md:text-[56px] lg:text-[72px] leading-[1.08] max-w-[900px] tracking-[0.02em]"
            style={{ fontWeight: 200 }}
          >
            Madeira Viva!
            <br />
            <span className="text-[#E8E4DF]/70">Autenticidade que o</span>
            <br />
            <span className="text-[#E8E4DF]/70">sintético não tem.</span>
          </h1>
        </motion.div>
      </motion.div>
    </section>
  );
}