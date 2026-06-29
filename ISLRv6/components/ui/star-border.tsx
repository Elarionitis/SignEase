"use client";

import React from "react";
import { motion } from "framer-motion";

interface StarBorderProps {
  as?: React.ElementType;
  className?: string;
  color?: string;
  speed?: string;
  children: React.ReactNode;
  [x: string]: any;
}

const StarBorder = ({
  as: Component = "button",
  className = "",
  color = "white",
  speed = "6s",
  children,
  ...rest
}: StarBorderProps) => {
  return (
    <motion.div
      className={`relative inline-block rounded-[20px] ${className}`}
      whileHover={{ 
        scale: 1.03,
        transition: { type: "spring", stiffness: 400, damping: 10 }
      }}
    >
      <Component className="w-full h-full group" {...rest}>
        {/* Simple animated border that glows on hover */}
        <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-70 group-hover:opacity-100 transition-opacity duration-300 animate-gradient" style={{ backgroundSize: "300% 100%", animationDuration: speed }}></div>
        
        {/* Reduced intensity white glow overlay that appears on hover */}
        <motion.div 
          className="absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            boxShadow: "0 0 10px 1px rgba(255, 255, 255, 0.4), 0 0 20px 3px rgba(255, 255, 255, 0.15)",
          }}
        ></motion.div>
        
        {/* Inner content with slightly smaller dimensions to create border effect - updated background */}
        <div className="absolute inset-[2px] rounded-[18px] bg-gradient-to-b from-gray-900/95 to-[#101118] z-10"></div>
        
        <div className="relative z-20 text-white text-center text-[16px] py-[16px] px-[26px] rounded-[20px]">
          {children}
        </div>
      </Component>
    </motion.div>
  );
};

export { StarBorder };