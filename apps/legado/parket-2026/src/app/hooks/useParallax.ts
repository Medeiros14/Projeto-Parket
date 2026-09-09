import { useRef, useEffect } from "react";
import { useScroll, useTransform, type MotionValue } from "motion/react";

/**
 * Suppress Motion's scroll-position warning globally (once).
 * All scroll-target elements already have `position: relative` via Tailwind,
 * but Motion checks before browser paints the CSS — making this a false positive.
 */
if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;
  const suppressPattern = "non-static position";
  const matches = (args: unknown[]) =>
    args.some((a) => typeof a === "string" && a.includes(suppressPattern));
  console.warn = (...args: unknown[]) => {
    if (matches(args)) return;
    originalWarn.apply(console, args);
  };
  console.error = (...args: unknown[]) => {
    if (matches(args)) return;
    originalError.apply(console, args);
  };
  console.log = (...args: unknown[]) => {
    if (matches(args)) return;
    originalLog.apply(console, args);
  };
}

/**
 * Returns a ref and a parallax-transformed Y value.
 */
export function useParallax(speed = 0.15): {
  ref: React.RefObject<HTMLDivElement | null>;
  y: MotionValue<number>;
} {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * -100, speed * 100]);
  return { ref, y };
}

/**
 * Returns opacity and y values driven by scroll for text reveal.
 */
export function useScrollReveal(): {
  ref: React.RefObject<HTMLDivElement | null>;
  opacity: MotionValue<number>;
  y: MotionValue<number>;
} {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.95", "start 0.55"],
  });
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);
  return { ref, opacity, y };
}

/** Re-export a plain useRef for components using useScroll directly */
export function useScrollRef<T extends HTMLElement>() {
  return useRef<T>(null);
}