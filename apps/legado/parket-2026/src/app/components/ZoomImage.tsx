import { useState, type ReactNode } from "react";
import { motion } from "motion/react";

interface ZoomImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
  aspectRatio?: string;
  children?: ReactNode;
}

export function ZoomImage({ src, alt, className = "", onClick, aspectRatio, children }: ZoomImageProps) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setMousePos({ x, y });
  };

  return (
    <div
      className={`relative overflow-hidden cursor-pointer group ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
      onClick={onClick}
    >
      <motion.img
        src={src}
        alt={alt || ""}
        className="w-full h-full object-cover transition-transform duration-700 ease-out"
        animate={{
          scale: isHovering ? 1.08 : 1,
          transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {/* Overlay renders children if any (e.g. gradients, text) */}
      {children}
      
      {/* Subtle overlay on hover if no children are provided or just as a default */}
      {!children && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />}
    </div>
  );
}
