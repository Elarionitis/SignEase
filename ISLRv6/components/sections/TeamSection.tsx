// components/sections/TeamSection.tsx
"use client"

import React from "react";
import { motion, useInView } from "framer-motion";
import Image from "next/image";
import { FaLinkedin } from 'react-icons/fa';

interface TeamSectionProps {
  contentReady: boolean;
}

const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 1,
      delay: 0.5 + i * 0.2,
      ease: [0.25, 0.4, 0.25, 1],
    },
  }),
};

const TeamSection: React.FC<TeamSectionProps> = ({ contentReady }) => {
  // Fix: Properly use useInView hook with correct options
  const ref = React.useRef(null);
  const inView = useInView(ref, {
    once: true,
    amount: 0.1,
  });

  return (
    <section id="team" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-transparent">
      {/* Team section */}
      <motion.div
        ref={ref}
        initial={{ opacity: 0 }}
        animate={{ opacity: contentReady ? 1 : 0 }}
        transition={{ duration: 1 }}
        className="space-y-6"
      >
        <div className="text-center relative z-10">
          {/* Heading and underline in tighter spacing */}
          <div className="space-y-2">
            <motion.h2
              className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300"
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              style={{ paddingBottom: "0.05em", lineHeight: 1.2 }}
            >
              Meet Our Team
            </motion.h2>
            
            {/* Animated gradient underline with less margin */}
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: "80px" }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="h-1 bg-gradient-to-r from-indigo-500 via-rose-400 to-indigo-500 mx-auto rounded-full"
            />
          </div>
          
          {/* Paragraph with more space from the underline */}
          <motion.p
            className="text-white/60 max-w-2xl mx-auto mt-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            The talented individuals behind SignEase's development and innovation.
          </motion.p>
        </div>

        <div className="flex flex-col md:flex-row justify-center gap-12 mt-6 relative z-0">
          <motion.div
            custom={8}
            variants={fadeUpVariants}
            initial="hidden"
            animate={contentReady ? "visible" : "hidden"}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl  transition-all"
          >
            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500/20 to-rose-500/20 mb-6 mx-auto overflow-hidden">
              <Image src="/assets/suhanpfp.png" alt="Suhan Ramani" width={192} height={192} className="object-cover w-full h-full" />
            </div>
            <h4 className="text-xl font-semibold text-center mb-2">
              Suhan Ramani
            </h4>
            <p className="text-center text-white/40">Third Year CSE Grad, Machine Learning Enthusiast, Software Development Core</p>
            <div className="flex justify-center mt-4">
              <motion.a
                href="https://www.linkedin.com/in/suhan-ramani-b82291323/"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.2, color: "#0077B5" }}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-all"
              >
                <FaLinkedin className="text-xl text-white/80" />
              </motion.a>
            </div>
          </motion.div>
          
        </div>
      </motion.div>
    </section>
  );
};

export default TeamSection;