import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#818cf8", "#fb7185", "#fbbf24", "#34d399", "#f0abfc", "#ffffff"];

/** A one-shot confetti burst; remount (change `key`) to play it again. */
export function Celebration({ pieces = 28 }: { pieces?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => {
        const angle = (index / pieces) * Math.PI * 2 + Math.random() * 0.4;
        const distance = 90 + Math.random() * 110;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 40,
          rotate: Math.random() * 540 - 270,
          color: COLORS[index % COLORS.length],
          size: 5 + Math.random() * 6,
          round: Math.random() > 0.5,
          delay: Math.random() * 0.1,
        };
      }),
    [pieces]
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible" aria-hidden="true">
      {particles.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute"
          style={{
            width: particle.size,
            height: particle.round ? particle.size : particle.size * 0.45,
            backgroundColor: particle.color,
            borderRadius: particle.round ? "9999px" : "2px",
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{
            x: particle.x,
            y: [0, particle.y, particle.y + 80],
            opacity: [1, 1, 0],
            scale: 1,
            rotate: particle.rotate,
          }}
          transition={{ duration: 1.4, delay: particle.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
