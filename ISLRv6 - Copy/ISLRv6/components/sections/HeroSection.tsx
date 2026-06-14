// components/sections/HeroSection.tsx
"use client"

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Pacifico } from "next/font/google";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { FaArrowRight } from 'react-icons/fa';
import { StarBorder } from "@/components/ui/star-border";
import { signLanguageWords } from "./constants"; // Import signLanguageWords
import GradientText from "@/components/ui/gradient-text";

// Fix 1: Correct the Pacifico font configuration - remove duplicate subsets
const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
});

interface HeroSectionProps {
  contentReady: boolean;
  isLoading: boolean;
}

const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 1,
      // Add additional delay to ensure proper sequencing
      delay: 0.5 + i * 0.2,
      ease: [0.25, 0.4, 0.25, 1],
    },
  }),
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.2,
      delayChildren: 0.3
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8
    }
  }
};


const HeroSection: React.FC<HeroSectionProps> = ({ contentReady, isLoading }) => {
  const [titleNumber, setTitleNumber] = useState(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTitleNumber((prev) => (prev === signLanguageWords.length - 1 ? 0 : prev + 1));
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber]);


  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 relative">
      <motion.div
        className="flex justify-center mt-[80px] mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: contentReady ? 1 : 0, y: contentReady ? 0 : -10 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <motion.div
          custom={0}
          variants={fadeUpVariants}
          initial="hidden"
          animate={contentReady ? "visible" : "hidden"}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm"
        >
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <motion.div
              animate={{
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image src="/assets/SignEaseLogo.png" alt="SignEase Logo" width={24} height={24} className="object-contain" />
            </motion.div>
            <span className="text-sm text-white/80 tracking-wide font-medium">Real-time Sign Language Recognition</span>
          </Link>
        </motion.div>
      </motion.div>

      <header className="relative w-full min-h-[calc(100vh-240px)] flex items-center justify-center">
        {/* Add subtle floating decorative elements */}
        <motion.div 
          className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full opacity-20 blur-[80px] bg-indigo-500"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 20, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div 
          className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full opacity-10 blur-[100px] bg-rose-500"
          animate={{
            scale: [1, 1.3, 1],
            y: [0, -20, 0],
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.div
          className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
          variants={containerVariants}
          initial="hidden"
          animate={contentReady ? "visible" : "hidden"}
        >
          <motion.h2
            variants={itemVariants}
            className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 tracking-tight"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
              Breaking the language barrier with
            </span>
            <br />
            <motion.div
              className="h-[1.5em] relative overflow-visible"
              initial={{ opacity: 0 }}
              animate={{ opacity: contentReady ? 1 : 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              {signLanguageWords.map((word, index) => (
                <motion.span
                  key={index}
                  className={cn(
                    "absolute left-0 right-0 bg-clip-text text-transparent animate-gradient",
                    "leading-tight py-2",
                    pacifico.className
                  )}
                  style={{
                    transform: 'translateY(-12%)',
                    display: 'block',
                    minHeight: '1.6em',
                    backgroundImage: "linear-gradient(to right, #a5b4fc, #ffffff, #fda4af, #a5b4fc)",
                    backgroundSize: "300% 100%",
                    animationDuration: "5s",
                    filter: "drop-shadow(0 0 8px rgba(232, 121, 249, 0.3))",
                  }}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{
                    opacity: contentReady && titleNumber === index ? 1 : 0,
                    y: contentReady && titleNumber === index ? 0 : -40
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.div>
          </motion.h2>

          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg md:text-xl text-white/50 mb-10 leading-relaxed font-light tracking-wide max-w-xl mx-auto px-4"
          >
            Crafting exceptional digital experiences through innovative design and cutting-edge technology.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex justify-center mt-12"
          >
            <Link href="/sign-detection" passHref legacyBehavior>
              <StarBorder
                as="a"
                className="flex items-center justify-center gap-3 cursor-pointer whitespace-nowrap min-w-[240px] group"
                color="#e879f9"
                speed="5s"
              >
                <span className="flex items-center gap-3 text-xl font-medium group-hover:text-white transition-colors duration-300">
                  Try SignEase Now
                  <motion.div
                    className="text-2xl"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity,
                      ease: "easeInOut" 
                    }}
                  >
                    <FaArrowRight />
                  </motion.div>
                </span>
              </StarBorder>
            </Link>
          </motion.div>
          
          {/* Remove scroll indicator - this entire block is deleted */}
          
        </motion.div>
      </header>
    </div>
  );
};

export default HeroSection;