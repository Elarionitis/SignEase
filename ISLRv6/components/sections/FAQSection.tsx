"use client"

import React, { useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Accordion, AccordionItem } from "@/components/ui/accordion"
import { faqItems } from "./constants"; // Import faqItems
import { TbWorldQuestion } from "react-icons/tb";
import { BiChevronDown } from "react-icons/bi";

// Extended interface for FAQ items with color properties
interface ExtendedFAQItem {
  id: string;
  question: string;
  answer: string;
  icon: React.ReactNode;
  color: string;
  colorBackground?: string;
  colorShadow?: string;
  colorIcon?: string;
}

interface FAQSectionProps {
  contentReady: boolean;
}

const FAQSection: React.FC<FAQSectionProps> = ({ contentReady }) => {
  const ref = React.useRef(null);
  const inView = useInView(ref, {
    once: true,
    amount: 0.1,
  });
  const [openItem, setOpenItem] = useState<string | null>(null);

  // Handler for toggling accordion items
  const handleToggle = (value: string) => {
    setOpenItem(openItem === value ? null : value);
  };

  // Derive color properties from the base color for each FAQ item
  const extendedFaqItems = faqItems.map(item => {
    // Extract color from the gradient string or use a default color
    const baseColor = item.color.includes('from-') 
      ? item.color.match(/from-([a-zA-Z0-9-]+)/)
      : item.color.match(/bg-([a-zA-Z0-9-]+)/);
      
    const colorName = baseColor ? baseColor[1].split('/')[0] : 'white';
    
    return {
      ...item,
      colorBackground: `rgba(var(--${colorName}), 0.1)`,
      colorShadow: `rgba(var(--${colorName}), 0.2)`,
      colorIcon: `var(--${colorName})`,
    } as ExtendedFAQItem;
  });

  // Function to extract theme color from gradient string
  const getThemeColor = (colorString: string, opacity: number = 0.15) => {
    if (colorString.includes('from-indigo')) return `rgba(99, 102, 241, ${opacity})`;
    if (colorString.includes('from-blue')) return `rgba(59, 130, 246, ${opacity})`;
    if (colorString.includes('from-purple')) return `rgba(139, 92, 246, ${opacity})`;
    if (colorString.includes('from-pink')) return `rgba(236, 72, 153, ${opacity})`;
    if (colorString.includes('from-rose')) return `rgba(244, 63, 94, ${opacity})`;
    if (colorString.includes('from-teal')) return `rgba(45, 212, 191, ${opacity})`;
    if (colorString.includes('from-green')) return `rgba(34, 197, 94, ${opacity})`;
    if (colorString.includes('from-orange')) return `rgba(249, 115, 22, ${opacity})`;
    return `rgba(255, 255, 255, ${opacity})`;
  };

  return (
    <section id="faq" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-transparent">
      {/* FAQ section */}
      <motion.div
        ref={ref}
        initial={{ opacity: 0 }}
        animate={{ opacity: contentReady ? 1 : 0 }}
        transition={{ duration: 1 }}
        className="space-y-6" // Reduced from space-y-10
      >
        {/* Fixed header section with improved spacing and z-index */}
        <div className="text-center relative z-10">
          {/* Badge/label */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm mb-4"
          >
            <TbWorldQuestion className="text-xl text-indigo-300" />
            <span className="text-sm text-white/80 tracking-wide font-medium">Common Questions</span>
          </motion.div>

          {/* Heading and underline in tighter spacing */}
          <div className="space-y-2">
            <motion.h2
              className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300"
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              style={{ paddingBottom: "0.05em", lineHeight: 1.2 }}
            >
              Frequently Asked Questions
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
            Get answers to common questions about SignEase and how it can help bridge communication gaps in real-world scenarios.
          </motion.p>
        </div>

        {/* FAQ items list with spacing from the header */}
        <div className="max-w-4xl mx-auto space-y-6 relative z-0 mt-6">
          {extendedFaqItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative overflow-hidden"
            >
              {/* Enhanced background gradient with pulsing animation */}
              <motion.div 
                className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-xl opacity-0 transition-opacity duration-300`}
                animate={{ 
                  opacity: openItem === item.id ? [0.05, 0.1, 0.05] : 0,
                  scale: openItem === item.id ? [1, 1.02, 1] : 1
                }}
                transition={{
                  opacity: { repeat: Infinity, duration: 3 },
                  scale: { repeat: Infinity, duration: 4 }
                }}
              />
              <div className="absolute inset-0 backdrop-blur-sm bg-black/10 rounded-xl"></div>

              {/* Custom accordion item with dynamic theme styling */}
              <motion.div 
                className={`relative border rounded-xl overflow-hidden transition-all duration-300`}
                style={{ 
                  borderColor: openItem === item.id 
                    ? getThemeColor(item.color, 0.4) 
                    : 'rgba(255, 255, 255, 0.05)',
                  background: openItem === item.id
                    ? `linear-gradient(to bottom right, ${getThemeColor(item.color, 0.15)}, rgba(0, 0, 0, 0.2))`
                    : 'transparent'
                }}
                animate={{ 
                  boxShadow: openItem === item.id 
                    ? [
                        '0 0 0 rgba(0, 0, 0, 0)', 
                        `0 4px 20px ${getThemeColor(item.color, 0.2)}`,
                        '0 0 0 rgba(0, 0, 0, 0)'
                      ] 
                    : '0 0 0 rgba(0, 0, 0, 0)'
                }}
                transition={{ 
                  repeat: openItem === item.id ? Infinity : 0,
                  duration: 3
                }}
              >
                {/* Custom header */}
                <motion.div 
                  className="flex items-center justify-between w-full p-6 text-left cursor-pointer"
                  onClick={() => handleToggle(item.id)}
                  whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-4">
                    {/* Use unique colors for each FAQ item icon */}
                    <motion.div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ 
                        backgroundColor: openItem === item.id 
                          ? getThemeColor(item.color, 0.3)
                          : 'rgba(255, 255, 255, 0.05)'
                      }}
                      animate={{ 
                        boxShadow: openItem === item.id 
                          ? [
                              `0 0 0 ${getThemeColor(item.color, 0)}`, 
                              `0 0 15px ${getThemeColor(item.color, 0.4)}`, 
                              `0 0 0 ${getThemeColor(item.color, 0)}`
                            ] 
                          : '0 0 0 rgba(255, 255, 255, 0)'
                      }}
                      transition={{ repeat: openItem === item.id ? Infinity : 0, duration: 2 }}
                    >
                      {/* Apply unique coloring to the icon */}
                      <div style={{ 
                        color: openItem === item.id 
                          ? 'white'  
                          : getThemeColor(item.color, 1)
                      }}>
                        {item.icon}
                      </div>
                    </motion.div>
                    <h3 
                      className="font-medium text-lg transition-colors duration-300"
                      style={{ 
                        color: openItem === item.id 
                          ? 'white' 
                          : 'rgba(255, 255, 255, 0.9)' 
                      }}
                    >
                      {item.question}
                    </h3>
                  </div>
                  <motion.div
                    animate={{ 
                      rotate: openItem === item.id ? 180 : 0,
                      color: openItem === item.id 
                        ? 'white' 
                        : "rgba(255, 255, 255, 0.5)"
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <BiChevronDown className="text-2xl" />
                  </motion.div>
                </motion.div>
                
                {/* Custom content */}
                <AnimatePresence>
                  {openItem === item.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div 
                        className="p-6 text-white/80 border-t transition-colors duration-300"
                        style={{ 
                          borderColor: getThemeColor(item.color, 0.2),
                          background: `linear-gradient(to bottom, ${getThemeColor(item.color, 0.1)}, rgba(0, 0, 0, 0))` 
                        }}
                      >
                        <motion.p 
                          className="leading-relaxed"
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {item.answer}
                        </motion.p>

                        {item.id === "accuracy" && (
                          <motion.div
                            className="mt-5 bg-gradient-to-r from-indigo-500/10 to-indigo-700/10 backdrop-blur-sm rounded-lg p-4 flex items-center gap-3 border border-indigo-500/20"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            <motion.div 
                              className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center"
                              animate={{ 
                                boxShadow: ["0 0 0 rgba(99, 102, 241, 0.2)", "0 0 12px rgba(99, 102, 241, 0.4)", "0 0 0 rgba(99, 102, 241, 0.2)"]
                              }}
                              transition={{ repeat: Infinity, duration: 3 }}
                            >
                              <div className="w-6 h-6 rounded-full bg-indigo-500/40 flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-indigo-300"></div>
                              </div>
                            </motion.div>
                            <div>
                              <div className="text-sm font-medium text-white/90">Pro Tip</div>
                              <div className="text-xs text-white/70">For best results, use SignEase in well-lit environments with your hands clearly visible to the camera.</div>
                            </div>
                          </motion.div>
                        )}

                        {item.id === "languages" && (
                          <motion.div
                            className="mt-5 flex flex-wrap gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            <motion.span 
                              className="px-3 py-1.5 bg-blue-500/20 rounded-full text-xs text-white/90 border border-blue-500/30 flex items-center gap-1.5"
                              whileHover={{ scale: 1.05, backgroundColor: "rgba(59, 130, 246, 0.3)" }}
                            >
                              <span className="text-base">🇺🇸</span> American Sign Language
                            </motion.span>
                            <motion.span 
                              className="px-3 py-1.5 bg-white/5 rounded-full text-xs text-white/70 border border-white/10 flex items-center gap-1.5"
                              whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                            >
                              <span className="text-base">🇮🇳</span> ISL (Coming Soon)
                            </motion.span>
                            <motion.span 
                              className="px-3 py-1.5 bg-white/5 rounded-full text-xs text-white/70 border border-white/10 flex items-center gap-1.5"
                              whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                            >
                              <span className="text-base">🇬🇧</span> BSL (Planned)
                            </motion.span>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Contact section */}
        <motion.div
          className="flex justify-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="bg-gradient-to-r from-indigo-500/5 to-rose-500/5 border border-white/10 rounded-xl p-7 text-center max-w-2xl">
            <h4 className="text-white text-xl mb-3">Still have questions?</h4>
            <p className="text-white/60 mb-5">Our team is ready to assist you with any questions or concerns you may have about SignEase.</p>
            <motion.a
              href="#contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-indigo-500/30 to-rose-500/30 rounded-full border border-white/10 text-white hover:border-white/20 transition-all"
              whileHover={{ 
                scale: 1.03, 
                boxShadow: "0 0 20px rgba(255, 255, 255, 0.1)",
                borderColor: "rgba(255, 255, 255, 0.3)"
              }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              Contact our support team
            </motion.a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default FAQSection;