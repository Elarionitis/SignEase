"use client"

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const inter = { variable: "font-sans" };

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate,
      }}
      transition={{
        duration: 1.8, // Faster initial animation
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 0.8 }, // Faster fade in
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{
          y: [0, 25, 0], // Increased movement range
          x: [-10, 10, -10], // Added horizontal movement
        }}
        transition={{
          duration: 8, // Faster cycle
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        style={{
          width,
          height,
        }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            gradient,
            "backdrop-blur-[2px] border-2 border-white/[0.15]",
            "shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]",
            "after:absolute after:inset-0 after:rounded-full",
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]",
          )}
        />
      </motion.div>
    </motion.div>
  );
}

const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 w-full h-full z-0">
      {/* Base background */}
      <div className="absolute inset-0 bg-[#030303]" />
      
      {/* Animated gradient overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.05] via-transparent to-rose-500/[0.05] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0)_60%)]" />
      </div>

      {/* Updated shape positions and animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <ElegantShape
          delay={0.2}
          width={600}
          height={140}
          rotate={15}
          gradient="from-indigo-500/[0.15]"
          className="left-[-15%] md:left-[-10%] top-[15%] md:top-[20%]"
        />
        <ElegantShape
          delay={0.3}
          width={500}
          height={120}
          rotate={-20}
          gradient="from-rose-500/[0.15]"
          className="right-[-10%] md:right-[-5%] top-[65%] md:top-[70%]"
        />
        <ElegantShape
          delay={0.4}
          width={300}
          height={80}
          rotate={-12}
          gradient="from-violet-500/[0.15]"
          className="left-[0%] md:left-[5%] bottom-[0%] md:bottom-[5%]"
        />
        <ElegantShape
          delay={0.2}
          width={200}
          height={60}
          rotate={25}
          gradient="from-amber-500/[0.15]"
          className="right-[10%] md:right-[15%] top-[5%] md:top-[10%]"
        />
        <ElegantShape
          delay={0.3}
          width={150}
          height={40}
          rotate={-30}
          gradient="from-cyan-500/[0.15]"
          className="left-[15%] md:left-[20%] top-[0%] md:top-[5%]"
        />
      </div>
    </div>
  );
};

export default Background;
