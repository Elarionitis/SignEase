"use client";

import React from "react";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
}

export default function GradientText({
  children,
  className = "",
  colors = ["#ffaa40", "#9c40ff", "#ffaa40"],
  animationSpeed = 8,
  showBorder = false,
}: GradientTextProps) {
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
    animationDuration: `${animationSpeed}s`,
  };

  // Simplified structure without additional divs causing layout issues
  return (
    <span
      className={`inline-block animate-gradient ${className}`}
      style={{
        ...gradientStyle,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        backgroundSize: "300% 100%",
        color: "transparent", // This makes the text transparent to show background
        width: "100%",        // Take full width of parent
        display: "block",     // Full block to avoid layout issues
        lineHeight: "inherit", // Inherit line height to maintain spacing
        fontSize: "inherit",   // Inherit font size
      }}
    >
      {children}
    </span>
  );
}
