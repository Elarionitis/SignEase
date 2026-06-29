// app/page.tsx
"use client"

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import dynamic from 'next/dynamic';
import Background from "@/components/background";
import HeroSection from "@/components/sections/HeroSection";
import ImpactSection from "@/components/sections/ImpactSection";
import WhyUsSection from "@/components/sections/WhyUsSection";
import TechnologySection from "@/components/sections/TechnologySection";
import FAQSection from "@/components/sections/FAQSection";
import TeamSection from "@/components/sections/TeamSection";
import ContactSection from "@/components/sections/ContactSection";
import { TechCardsProvider } from "@/components/ui/tech-card";
import { useWarmSignDetection } from "@/hooks/useWarmSignDetection";

// Fix 3: Fix the WebcamComponent dynamic import
const WebcamComponent = dynamic<any>(() => import('react-webcam').then((mod) => {
  const { default: Webcam } = mod;
  return Webcam;
}), {
  ssr: false,
  loading: () => <div>Loading camera...</div>
});

const pacifico = { className: "font-serif", variable: "font-serif" };
const inter = { variable: "font-sans" };

export default function HeroGeometricPage() {
  // Add loading state to control when content appears
  const [isLoading, setIsLoading] = useState(true);
  const [contentReady, setContentReady] = useState(false);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const warmSignDetection = useWarmSignDetection();

  // Add this function to handle video expansion
  const toggleVideoExpansion = (id: string) => {
    if (expandedVideo === id) {
      setExpandedVideo(null);
    } else {
      setExpandedVideo(id);
    }
  };


  useEffect(() => {
    // Initial loading sequence
    const timer1 = setTimeout(() => {
      setIsLoading(false); // First transition - hide loading screen
    }, 500);

    const timer2 = setTimeout(() => {
      setContentReady(true); // Second transition - show content
    }, 800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);


  useEffect(() => {
    // Scroll to top on page load
    window.scrollTo(0, 0);

    // Add scroll behavior for tech cards
    const handleScroll = () => {
      const expandedCards = document.querySelectorAll('.expanded-card');
      expandedCards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          // @ts-ignore
          card.querySelector('button')?.click();
          // Reset expanded video state when scrolling away
          setExpandedVideo(null);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);

    // Cleanup
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Add reload prevention
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);


  return (
    <div className="bg-[#030303] min-h-screen">
      <Background />

      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Image
                src="/assets/SignEaseLogo.png"
                alt="SignEase Logo"
                width={60}
                height={60}
                className="object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("relative z-10 w-full text-white", !contentReady && "invisible")}>
        {/* Navigation - Consider moving Navigation to a separate component if needed */}
        <motion.nav
          className="fixed top-0 left-0 right-0 z-30 flex justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: contentReady ? 1 : 0, y: contentReady ? 0 : -20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none" />
          <div className="absolute inset-0 backdrop-blur-[8px] backdrop-saturate-150 bg-black/5 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between w-full px-6 min-h-[80px] py-4">
            <motion.div
              className="flex items-center gap-4"
            >
              <Link href="/" className="relative flex items-center h-[48px] hover:opacity-80 transition-opacity">
                <Image
                  src="/assets/SignEaseLogo.png"
                  alt="SignEase Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
                <span className={cn(
                  "text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 ml-3 leading-relaxed tracking-wide overflow-visible py-2",
                  pacifico.className
                )}>
                  SignEase
                </span>
              </Link>
            </motion.div>

            <motion.div
              className="flex gap-4 text-white/90"
            >
              <Link
                href="/"
                className="hover:text-indigo-400 transition-all hover:scale-105"
              >
                About
              </Link>
              <a
                className="hover:text-indigo-400 transition-all hover:scale-105"
                href="#technology"
              >
                Technology
              </a>
              <a
                className="hover:text-indigo-400 transition-all hover:scale-105"
                href="#team"
              >
                Team
              </a>
              <a
                className="hover:text-indigo-400 transition-all hover:scale-105"
                href="#contact"
              >
                Contact
              </a>
            </motion.div>
          </div>
        </motion.nav>

        {/* Hero Section */}
        <HeroSection contentReady={contentReady} isLoading={isLoading} onTrySignEaseIntent={warmSignDetection} />

        {/* Impact Section */}
        <ImpactSection contentReady={contentReady} />

        {/* Why Us Section */}
        <WhyUsSection contentReady={contentReady} />

        {/* Technology Section */}
        <TechnologySection contentReady={contentReady} expandedVideo={expandedVideo} toggleVideoExpansion={toggleVideoExpansion} />

        {/* FAQ Section */}
        <FAQSection contentReady={contentReady} />

        {/* Team Section */}
        <TeamSection contentReady={contentReady} />

        {/* Contact Section (Footer) */}
        <ContactSection contentReady={contentReady} />
      </div>
    </div>
  );
}
