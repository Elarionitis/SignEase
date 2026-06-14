"use client"

import React from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { FaArrowRight } from 'react-icons/fa';
import { IoRocketSharp } from 'react-icons/io5';
import { BsTranslate } from 'react-icons/bs';
import { HiLanguage } from 'react-icons/hi2';


interface WhyUsSectionProps {
  contentReady: boolean;
}

const WhyUsSection: React.FC<WhyUsSectionProps> = ({ contentReady }) => {
  // Fix useInView implementation
  const ref = React.useRef(null);
  const inView = useInView(ref, {
    once: true,
    amount: 0.1,
  });

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-transparent">
      {/* Enhanced Why Our Solution Matters section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: contentReady ? 1 : 0 }}
        transition={{ duration: 0.8 }}
        className="space-y-6" // Reduced from space-y-12
      >
        <div className="text-center relative z-10">
          {/* Heading and underline in tighter spacing */}
          <div className="space-y-2">
            <motion.h2
              className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300"
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ paddingBottom: "0.05em", lineHeight: 1.2 }}
            >
              Why Our Solution Matters
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
            className="text-white/60 max-w-2xl mx-auto mt-4" // Added mt-4
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            SignEase addresses critical communication challenges facing millions of people with
            hearing impairments worldwide, providing accessible solutions through technology.
          </motion.p>
        </div>

        {/* Enhanced solution cards section with staggered animations */}
        <div className="mt-6 relative z-0">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "50px" }}
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.1, delayChildren: 0.1 }
              }
            }}
          >
            {/* Card 1 - Communication */}
            <motion.div
              className="relative overflow-hidden rounded-xl"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{
                duration: 0.6,
                ease: "easeOut"
              }}
            >
              {/* Enhanced background with simplified animation */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl"></div>
              <motion.div
                className="absolute inset-0 backdrop-blur-[2px] bg-black/20 rounded-xl"
                animate={{
                  opacity: [0.7, 0.75, 0.7]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />

              {/* Card content with improved animation */}
              <div className="relative p-6 border border-white/10 rounded-xl h-full flex flex-col">
                <div className="mb-4 relative">
                  {/* Simplified icon animation */}
                  <motion.div
                    className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center relative"
                    animate={{
                      boxShadow: [
                        "0 0 0 rgba(105, 93, 235, 0.2)",
                        "0 0 15px rgba(105, 93, 235, 0.4)",
                        "0 0 0 rgba(105, 93, 235, 0.2)"
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="relative z-10">
                      <BsTranslate className="text-3xl text-indigo-300" />
                    </div>
                  </motion.div>
                </div>
                <h4 className="text-white text-xl font-medium mb-3">Bridging Communication Gaps</h4>
                <p className="text-white/70 mb-4 flex-grow leading-relaxed">
                  Our real-time sign language recognition technology creates seamless connections between the
                  deaf community and the hearing world, serving 63M+ people in India alone.
                </p>
                <motion.div
                  className="mt-auto group"
                  whileHover={{ x: 5 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <a
                    href="#technology"
                    className="text-indigo-300 text-sm font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <span>Learn about our technology</span>
                    <motion.div
                      animate={{ x: [0, 3, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    >
                      <FaArrowRight className="text-xs group-hover:text-white transition-colors" />
                    </motion.div>
                  </a>
                </motion.div>
              </div>
            </motion.div>

            {/* Card 2 - Global Accessibility */}
            <motion.div
              className="relative overflow-hidden rounded-xl"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{
                duration: 0.6,
                ease: "easeOut"
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 to-pink-500/20 rounded-xl"></div>
              <motion.div
                className="absolute inset-0 backdrop-blur-[2px] bg-black/20 rounded-xl"
                animate={{
                  opacity: [0.7, 0.75, 0.7]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />

              <div className="relative p-6 border border-white/10 rounded-xl h-full flex flex-col">
                <div className="mb-4 relative">
                  <motion.div
                    className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center relative"
                    animate={{
                      boxShadow: [
                        "0 0 0 rgba(225, 96, 152, 0.2)",
                        "0 0 15px rgba(225, 96, 152, 0.4)",
                        "0 0 0 rgba(225, 96, 152, 0.2)"
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="relative z-10">
                      <HiLanguage className="text-3xl text-rose-300" />
                    </div>
                  </motion.div>
                </div>
                <h4 className="text-white text-xl font-medium mb-3">Global Accessibility</h4>
                <p className="text-white/70 mb-4 flex-grow leading-relaxed">
                  SignEase provides accessible communication tools for the 1.5B+ people worldwide affected by
                  hearing loss, breaking down language barriers across cultures and regions.
                </p>
                <motion.div
                  className="mt-auto group"
                  whileHover={{ x: 5 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <span className="text-rose-300 text-sm font-medium flex items-center gap-2">
                    <span>View our global impact</span>
                    <motion.div
                      animate={{ x: [0, 3, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    >
                      <FaArrowRight className="text-xs group-hover:text-white transition-colors" />
                    </motion.div>
                  </span>
                </motion.div>
              </div>
            </motion.div>

            {/* Card 3 - Future Innovation */}
            <motion.div
              className="relative overflow-hidden rounded-xl"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{
                duration: 0.6,
                ease: "easeOut"
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-teal-500/20 rounded-xl"></div>
              <motion.div
                className="absolute inset-0 backdrop-blur-[2px] bg-black/20 rounded-xl"
                animate={{
                  opacity: [0.7, 0.75, 0.7]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />

              <div className="relative p-6 border border-white/10 rounded-xl h-full flex flex-col">
                <div className="mb-4 relative">
                  <motion.div
                    className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center relative"
                    animate={{
                      boxShadow: [
                        "0 0 0 rgba(79, 171, 211, 0.2)",
                        "0 0 15px rgba(79, 171, 211, 0.4)",
                        "0 0 0 rgba(79, 171, 211, 0.2)"
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="relative z-10">
                      <IoRocketSharp className="text-3xl text-blue-300" />
                    </div>
                  </motion.div>
                </div>
                <h4 className="text-white text-xl font-medium mb-3">Future-Ready Innovation</h4>
                <p className="text-white/70 mb-4 flex-grow leading-relaxed">
                  With 2.5 billion people projected to experience hearing loss by 2050, our technology scales to meet
                  growing needs through continuous AI advancement and inclusive design.
                </p>
                <motion.div
                  className="mt-auto group"
                  whileHover={{ x: 5 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <span className="text-blue-300 text-sm font-medium flex items-center gap-2">
                    <span>Explore our roadmap</span>
                    <motion.div
                      animate={{ x: [0, 3, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    >
                      <FaArrowRight className="text-xs group-hover:text-white transition-colors" />
                    </motion.div>
                  </span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats counter section */}
        <motion.div
          className="bg-white/[0.02] border border-white/10 rounded-xl p-8 mt-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <div className="text-center mb-8">
            <h3 className="text-white/90 text-xl font-medium mb-2">Our Impact in Numbers</h3>
            <div className="w-20 h-1 bg-gradient-to-r from-indigo-400 to-rose-400 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Animated counter 1 */}
            <motion.div className="text-center">
              <motion.div
                className="text-3xl md:text-4xl font-bold text-indigo-300 mb-2"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                63M+
              </motion.div>
              <p className="text-white/60 text-sm">Deaf individuals in India</p>
            </motion.div>

            {/* Animated counter 2 */}
            <motion.div className="text-center">
              <motion.div
                className="text-3xl md:text-4xl font-bold text-rose-300 mb-2"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                87%
              </motion.div>
              <p className="text-white/60 text-sm">Recognition accuracy</p>
            </motion.div>

            {/* Animated counter 3 */}
            <motion.div className="text-center">
              <motion.div
                className="text-3xl md:text-4xl font-bold text-blue-300 mb-2"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                250+
              </motion.div>
              <p className="text-white/60 text-sm">ASL signs recognized</p>
            </motion.div>

            {/* Animated counter 4 */}
            <motion.div className="text-center">
              <motion.div
                className="text-3xl md:text-4xl font-bold text-teal-300 mb-2"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                2.5B
              </motion.div>
              <p className="text-white/60 text-sm">Global affected by 2050</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Enhanced CTA with animation */}
        <motion.div
          className="flex justify-center mt-10"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <Link href="/sign-detection">
            <motion.div
              className="px-8 py-4 bg-gradient-to-r from-indigo-500/30 to-rose-500/30 rounded-full border border-white/10 text-white hover:border-white/20 group relative overflow-hidden"
              whileHover={{
                scale: 1.05,
                boxShadow: "0 0 20px rgba(255, 255, 255, 0.1)"
              }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              {/* Animated background effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-white/5 to-rose-500/0"
                animate={{
                  x: ["-100%", "100%"],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  ease: "easeInOut",
                  repeatDelay: 1
                }}
              />
              <div className="relative flex items-center gap-3">
                <span className="text-lg font-medium">Experience SignEase Now</span>
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <IoRocketSharp className="text-xl text-white" />
                </motion.div>
              </div>
            </motion.div>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default WhyUsSection;