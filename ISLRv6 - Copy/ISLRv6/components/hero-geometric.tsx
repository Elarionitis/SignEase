"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import SignEaseLogo from "@/public/SignEaseLogo.png";
// Fix the casing in the import path to match the actual file name
import { Navbar as NavBar } from "./Navbar";

export function Hero() {
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // Simulate loading time and sequence the animations
    const timer1 = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    
    const timer2 = setTimeout(() => {
      setShowContent(true);
    }, 2300);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Preloader animation variants
  const preloaderVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: 0.5 } }
  };

  const progressVariants = {
    initial: { width: "0%" },
    animate: { 
      width: "100%", 
      transition: { duration: 1.8, ease: "easeInOut" } 
    }
  };

  // Content animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      }
    }
  };

  const fadeUpVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="preloader"
            className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50"
            variants={preloaderVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <motion.div 
              className="flex flex-col items-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Image 
                src={SignEaseLogo} 
                alt="SignEase Logo" 
                width={120} 
                height={120}
                className="animate-pulse"
              />
              <h2 className="text-white text-2xl font-bold">SignEase</h2>
              <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-500"
                  variants={progressVariants}
                  initial="initial"
                  animate="animate"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showContent && (
        <motion.section
          ref={ref}
          className="w-full py-12 md:py-24 lg:py-32 xl:py-40 bg-slate-950"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeUpVariants}>
            <NavBar />
          </motion.div>

          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <motion.div 
                className="space-y-2"
                variants={fadeUpVariants}
              >
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white">
                  Bridging Communication Between People Who Sign and People Who Don&apos;t
                </h1>
                <p className="mx-auto max-w-[700px] text-slate-400 md:text-xl">
                  SignEase uses advanced technology to break down communication barriers for the
                  signing community, making everyday interactions seamless and accessible.
                </p>
              </motion.div>

              <motion.div
                className="w-full max-w-sm space-x-2 mx-auto"
                variants={fadeUpVariants}
              >
                <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center">
                  <a
                    className="inline-flex h-10 items-center justify-center rounded-md bg-indigo-500 px-8 text-sm font-medium text-white shadow transition-colors hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50"
                    href="#signup"
                  >
                    Join the Beta
                  </a>
                  <a
                    className="inline-flex h-10 items-center justify-center rounded-md border border-slate-700 bg-transparent px-8 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50"
                    href="#learn-more"
                  >
                    Learn More
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>
      )}
    </>
  );
}
