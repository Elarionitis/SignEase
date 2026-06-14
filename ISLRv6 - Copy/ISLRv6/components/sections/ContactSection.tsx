// components/sections/ContactSection.tsx
"use client"

import React from "react";
import { motion, useInView } from "framer-motion";
import { FaFacebook, FaTwitter, FaLinkedin, FaEnvelope } from 'react-icons/fa';

interface ContactSectionProps {
  contentReady: boolean;
}

const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 1,
      delay: 0.5 + i * 0.1,
      ease: [0.25, 0.4, 0.25, 1],
    },
  }),
};

const ContactSection: React.FC<ContactSectionProps> = ({ contentReady }) => {
  // Fix: Properly use useInView hook with correct options
  const ref = React.useRef(null);
  const inView = useInView(ref, {
    once: true,
    amount: 0.1,
  });

  return (
    <footer id="contact" className="w-full py-12 px-4 sm:px-6 lg:px-8 bg-transparent">
      {/* Footer */}
      <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div>
          <motion.h4
            custom={10}
            variants={fadeUpVariants}
            initial="hidden"
            animate={contentReady ? "visible" : "hidden"}
            className="text-xl font-semibold text-white mb-4"
          >
            Contact Us
          </motion.h4>
          <motion.p
            custom={11}
            variants={fadeUpVariants}
            initial="hidden"
            animate={contentReady ? "visible" : "hidden"}
            className="mb-2 text-white/60"
          >
            Email: pavannn16@gmail.com
          </motion.p>
          <motion.p
            custom={12}
            variants={fadeUpVariants}
            initial="hidden"
            animate={contentReady ? "visible" : "hidden"}
            className="text-white/60"
          >
            Phone: +91 8160684323
          </motion.p>
        </div>
        <div>
          <motion.h4
            custom={13}
            variants={fadeUpVariants}
            initial="hidden"
            animate={contentReady ? "visible" : "hidden"}
            className="text-xl font-semibold text-white mb-4"
          >
            Follow Us
          </motion.h4>
          <motion.div
            custom={14}
            variants={fadeUpVariants}
            initial="hidden"
            animate={contentReady ? "visible" : "hidden"}
            className="flex gap-4"
          >
            <motion.a
              href="https://www.facebook.com"
              whileHover={{ scale: 1.1, backgroundColor: "#1877F2", color: "#fff" }}
              transition={{ duration: 0.2 }}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 transition-all"
            >
              <FaFacebook className="text-lg" />
            </motion.a>

            <motion.a
              href="https://www.twitter.com"
              whileHover={{ scale: 1.1, backgroundColor: "#1DA1F2", color: "#fff" }}
              transition={{ duration: 0.2 }}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 transition-all"
            >
              <FaTwitter className="text-lg" />
            </motion.a>

            <motion.a
              href="https://www.linkedin.com/in/pavanchauhan16/"
              whileHover={{ scale: 1.1, backgroundColor: "#0077B5", color: "#fff" }}
              transition={{ duration: 0.2 }}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 transition-all"
            >
              <FaLinkedin className="text-lg" />
            </motion.a>

            <motion.a
              href="mailto:pavannn16@gmail.com"
              whileHover={{ scale: 1.1, backgroundColor: "#EA4335", color: "#fff" }}
              transition={{ duration: 0.2 }}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 transition-all"
            >
              <FaEnvelope className="text-lg" />
            </motion.a>
          </motion.div>
        </div>
        <div>
          <motion.h4
            custom={15}
            variants={fadeUpVariants}
            initial="hidden"
            animate={contentReady ? "visible" : "hidden"}
            className="text-xl font-semibold text-white mb-4"
          >
            Location
          </motion.h4>
          <motion.p
            custom={16}
            variants={fadeUpVariants}
            initial="hidden"
            animate={contentReady ? "visible" : "hidden"}
            className="text-white/60"
          >
            CHARUSAT Campus, 139, Highway, off Nadiad - Petlad Road, Changa, Gujarat 388421
          </motion.p>
        </div>
      </div>
    </footer>
  );
};

export default ContactSection;