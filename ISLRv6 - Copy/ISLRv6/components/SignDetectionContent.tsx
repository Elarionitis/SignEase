"use client";

import * as React from "react";
import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Webcam from "react-webcam";
import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import Background from "@/components/background";
import { IoPlayCircle, IoRefreshOutline, IoVolumeHigh } from "react-icons/io5";
import { FaCamera, FaStop, FaArrowRight, FaHandPaper } from "react-icons/fa";
import { Pacifico, Inter } from "next/font/google";
import { cva, type VariantProps } from "class-variance-authority";
import PixelCard from "@/components/PixelCard";

// Your existing Alert component definition
const alertVariants = cva("relative rounded-lg border", {
  variants: {
    variant: {
      default: "border-border bg-background",
      warning: "border-amber-500/50 text-amber-600",
      error: "border-red-500/50 text-red-600",
      success: "border-emerald-500/50",
      info: "border-blue-500/50 text-blue-600",
    },
    size: {
      sm: "px-4 py-3",
      lg: "p-4",
    },
    isNotification: {
      true: "z-[100] max-w-[400px] bg-background shadow-lg shadow-black/5",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "sm",
    isNotification: false,
  },
});

// Rest of your existing Alert component

// Initialize fonts
const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Your ElegantShape component

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
  // Your existing ElegantShape implementation
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
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{
          y: [0, 15, 0],
        }}
        transition={{
          duration: 12,
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
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]"
          )}
        />
      </motion.div>
    </motion.div>
  );
}

// Your SignDetection component 
const SignDetection = React.memo(() => {
  // All your existing component code
  // ...
  
  // Return your JSX as before
  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-[#030303]",
        inter.variable,
        pacifico.variable
      )}
      suppressHydrationWarning
    >
      {/* All your existing JSX... */}
    </div>
  );
});

export default SignDetection;