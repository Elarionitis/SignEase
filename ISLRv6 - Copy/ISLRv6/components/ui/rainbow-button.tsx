import React from "react";
import { cn } from "@/lib/utils";

interface RainbowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function RainbowButton({
  children,
  className,
  ...props
}: RainbowButtonProps) {
  return (
    <button
      className={cn(
        // Base styles
        "group relative inline-flex h-12 items-center justify-center rounded-xl px-8 py-2",
        // Background and text
        "bg-black/20 backdrop-blur-sm text-white/90",
        // Border gradient
        "border-2 border-transparent",
        "before:absolute before:inset-0 before:rounded-xl before:-z-10 before:p-[2px]",
        "before:bg-[linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-5)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-2)))]",
        "before:animate-rainbow before:bg-[length:200%]",
        // Hover effects
        "hover:scale-105 transition-all duration-300",
        "after:absolute after:inset-0 after:rounded-xl after:p-[2px]",
        "after:bg-[linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-5)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-2)))]",
        "after:animate-rainbow after:bg-[length:200%] after:opacity-0 after:transition-opacity",
        "hover:after:opacity-30",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}