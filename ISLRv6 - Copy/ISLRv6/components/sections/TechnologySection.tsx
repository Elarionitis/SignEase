// components/sections/TechnologySection.tsx
"use client"

import React, { useState } from "react";
import { motion, useInView } from "framer-motion";
import { TechCard, TechCardsProvider } from "@/components/ui/tech-card";
import { techStackItems } from "./constants"; // Import techStackItems

interface TechnologySectionProps {
  contentReady: boolean;
  expandedVideo: string | null;
  toggleVideoExpansion: (id: string) => void;
}

const TechnologySection: React.FC<TechnologySectionProps> = ({ contentReady, expandedVideo, toggleVideoExpansion }) => {
  // Fix: Properly use useInView hook with correct options
  const ref = React.useRef(null);
  const inView = useInView(ref, {
    once: true,
    amount: 0.1,
  });

  return (
    <section id="technology" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-transparent">
      {/* Our Technology Stack section */}
      <motion.div
        ref={ref} // Add ref to the motion div
        initial={{ opacity: 0 }}
        animate={{ opacity: contentReady ? 1 : 0 }}
        transition={{ duration: 1 }}
        className="space-y-6" // Reduced from space-y-10 to space-y-6 to tighten overall spacing
      >
        {/* Fixed header section with improved spacing and z-index */}
        <div className="text-center relative z-10">
          {/* Extra tight heading and underline spacing */}
          <motion.h2
            className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 mb-0.5" // Added mb-0.5 for minimal space
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            style={{ paddingBottom: 0, lineHeight: 1.2 }} // Removed bottom padding
          >
            Our Technology Stack
          </motion.h2>
          
          {/* Animated gradient underline directly under heading */}
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: "80px" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="h-1 bg-gradient-to-r from-indigo-500 via-rose-400 to-indigo-500 mx-auto rounded-full"
          />
          
          {/* Paragraph with less space from the underline */}
          <motion.p
            className="text-white/60 max-w-2xl mx-auto mt-3" // Reduced from mt-4 to mt-3
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Explore the innovative technologies that power SignEase. Click "Learn more" to see each technology in action with video demonstrations.
          </motion.p>
        </div>

        {/* Removed the extra spacing div that was here */}

        {/* Tech cards with proper z-index */}
        <div className="relative z-0 mt-6"> {/* Added mt-6 to ensure good spacing from header */}
          <TechCardsProvider>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {techStackItems.map((item) => (
                <TechCard
                  key={item.id}
                  id={item.id}
                  Icon={item.Icon}
                  name={item.name}
                  description={item.description}
                  longDescription={item.longDescription}
                  videoUrl={item.videoUrl}
                  demoUrl={item.demoUrl}
                  hideTryButton={true}
                  expandedVideo={expandedVideo === item.id}
                  onToggleExpand={() => toggleVideoExpansion(item.id)}
                />
              ))}
            </div>
          </TechCardsProvider>
        </div>
      </motion.div>
    </section>
  );
};

export default TechnologySection;