"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FaArrowRight, FaChevronDown, FaChevronUp } from "react-icons/fa"
import { IoExpandOutline, IoContractOutline } from 'react-icons/io5';
import Link from "next/link"
import { cn } from "@/lib/utils"
import { TechCardProps } from "@/types"
import React, { createContext, useContext, ReactNode } from 'react';
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

// Create a context for managing active tech card state
interface TechCardsContextType {
  activeCard: string | null;
  setActiveCard: (id: string | null) => void;
  hoveredCard: string | null;
  setHoveredCard: (id: string | null) => void;
}

const TechCardsContext = createContext<TechCardsContextType>({
  activeCard: null,
  setActiveCard: () => {},
  hoveredCard: null,
  setHoveredCard: () => {},
});

// Create the provider component
export function TechCardsProvider({ children }: { children: ReactNode }) {
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <TechCardsContext.Provider value={{ 
      activeCard, 
      setActiveCard, 
      hoveredCard, 
      setHoveredCard 
    }}>
      {children}
    </TechCardsContext.Provider>
  );
}

// Create a hook to use the context
export const useTechCards = () => useContext(TechCardsContext);

export function TechCard({ 
  id, 
  Icon, 
  name, 
  description, 
  longDescription, 
  videoUrl, 
  demoUrl,
  hideTryButton = false 
}: TechCardProps) {
  const router = useRouter();
  const { activeCard, setActiveCard, hoveredCard, setHoveredCard } = useTechCards();

  const isActive = activeCard === id;
  const isHovered = hoveredCard === id;

  const [isExpanded, setIsExpanded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Set mounted state for client-side rendering of portal
  useEffect(() => {
    setIsMounted(true);
    
    // Add a class to the body when a tech card is expanded
    if (isExpanded) {
      document.body.classList.add('tech-card-expanded');
    } else {
      document.body.classList.remove('tech-card-expanded');
    }
    
    return () => {
      document.body.classList.remove('tech-card-expanded');
    };
  }, [isExpanded]);
  
  // Reset video states when card is collapsed
  useEffect(() => {
    if (!isExpanded) {
      setVideoLoaded(false);
      setVideoError(false);
      setIsVideoExpanded(false);
      setIsVideoPlaying(false);
    }
  }, [isExpanded]);
  
  // Handle toggle of expansion with event propagation control
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  
  // Check if video is playing
  const handleVideoPlayChange = () => {
    if (videoRef.current) {
      setIsVideoPlaying(!videoRef.current.paused);
    }
  };
  
  // Toggle video expanded state with improved handling
  const toggleVideoExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const newExpandedState = !isVideoExpanded;
    setIsVideoExpanded(newExpandedState);
    
    // Lock body scroll when expanding
    if (newExpandedState) {
      document.body.style.overflow = 'hidden';
      
      // Store current playback time
      const currentTime = videoRef.current?.currentTime || 0;
      
      // Play the fullscreen video at the same timestamp after a brief delay
      setTimeout(() => {
        if (fullscreenVideoRef.current) {
          fullscreenVideoRef.current.currentTime = currentTime;
          fullscreenVideoRef.current.play().catch(err => {
            console.log("Fullscreen video play prevented:", err);
          });
        }
      }, 200);
    } else {
      document.body.style.overflow = '';
      
      // Store current fullscreen playback time
      const currentTime = fullscreenVideoRef.current?.currentTime || 0;
      
      // Sync the inline video position when exiting fullscreen
      if (videoRef.current && currentTime > 0) {
        videoRef.current.currentTime = currentTime;
      }
    }
  };
  
  // Handle escape key to exit expanded video mode
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVideoExpanded) {
        setIsVideoExpanded(false);
        document.body.style.overflow = '';
      }
    };
    
    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
      // Ensure body overflow is restored when unmounting
      document.body.style.overflow = '';
    };
  }, [isVideoExpanded]);
  
  // Properly handle video element events with better error handling
  useEffect(() => {
    if (isExpanded && videoRef.current && videoUrl) {
      const videoElement = videoRef.current;
      
      const handleLoaded = () => {
        setVideoLoaded(true);
        setVideoError(false);
      };
      
      const handleError = (e: ErrorEvent) => {
        console.error(`Video loading error for ${id}:`, e);
        setVideoError(true);
        setVideoLoaded(false);
      };
      
      const handlePlay = () => {
        setIsVideoPlaying(true);
      };
      
      const handlePause = () => {
        setIsVideoPlaying(false);
      };
      
      // Add event listeners
      videoElement.addEventListener('loadeddata', handleLoaded);
      videoElement.addEventListener('error', handleError as EventListener);
      videoElement.addEventListener('play', handlePlay);
      videoElement.addEventListener('pause', handlePause);
      
      // Check if video has already been loaded
      if (videoElement.readyState >= 3) {
        setVideoLoaded(true);
      }
      
      // Configure video element for autoplay
      videoElement.muted = true;
      videoElement.preload = "auto";
      videoElement.playsInline = true;
      
      // Autoplay the video when expanded
      videoElement.play().catch(err => {
        console.log("Video autoplay prevented:", err);
      });
      
      return () => {
        // Clean up event listeners
        videoElement.removeEventListener('loadeddata', handleLoaded);
        videoElement.removeEventListener('error', handleError as EventListener);
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('pause', handlePause);
        videoElement.pause();
      };
    }
  }, [isExpanded, videoUrl, id]);

  // Add effect to handle smooth card expansion
  useEffect(() => {
    if (contentRef.current && isExpanded) {
      // Set a small delay to ensure the animation runs smoothly
      const timer = setTimeout(() => {
        if (videoRef.current && videoUrl) {
          // Ensure video is visible in viewport
          videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isExpanded, videoUrl]);

  const getGradientClass = (id: string) => {
    switch(id) {
      case "frame-capture": 
        return "from-indigo-500/10 to-purple-500/10"
      case "mediapipe": 
        return "from-rose-500/10 to-pink-500/10"
      case "ai-model": 
        return "from-blue-500/10 to-teal-500/10"
      default:
        return "from-indigo-500/10 to-purple-500/10"
    }
  }

  const getTextColorClass = (id: string) => {
    switch(id) {
      case "frame-capture": return "text-indigo-300"
      case "mediapipe": return "text-rose-300"
      case "ai-model": return "text-blue-300"
      default: return "text-indigo-300"
    }
  }

  const getAnimationClass = (id: string) => {
    switch(id) {
      case "frame-capture": return "from-indigo-600/10 to-indigo-400/10"
      case "mediapipe": return "from-rose-600/10 to-pink-400/10"
      case "ai-model": return "from-blue-600/10 to-teal-400/10"
      default: return "from-indigo-600/10 to-indigo-400/10"
    }
  }

  const getBgColorClass = (id: string) => {
    switch(id) {
      case "frame-capture": return "bg-indigo-500/10"
      case "mediapipe": return "bg-rose-500/10"
      case "ai-model": return "bg-blue-500/10"
      default: return "bg-indigo-500/10"
    }
  }

  const getBorderGlowColor = (id: string) => {
    switch(id) {
      case "frame-capture": return "rgba(99, 102, 241, 0.4)"
      case "mediapipe": return "rgba(244, 63, 94, 0.4)"
      case "ai-model": return "rgba(59, 130, 246, 0.4)"
      default: return "rgba(99, 102, 241, 0.4)"
    }
  }

  const getAccentColor = (id: string) => {
    switch(id) {
      case "frame-capture": return "rgb(129, 140, 248)" // indigo-400
      case "mediapipe": return "rgb(251, 113, 133)" // rose-400
      case "ai-model": return "rgb(96, 165, 250)" // blue-400
      default: return "rgb(129, 140, 248)" // indigo-400
    }
  }
  
  // Handle video retry with propagation control
  const handleVideoRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoError(false);
    if (videoRef.current && videoUrl) {
      videoRef.current.src = videoUrl;
      videoRef.current.load();
    }
  };
  
  // Click outside handler for fullscreen mode
  useEffect(() => {
    if (!isVideoExpanded) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isVideoExpanded && 
        videoContainerRef.current && 
        !videoContainerRef.current.contains(e.target as Node)
      ) {
        setIsVideoExpanded(false);
        document.body.style.overflow = '';
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVideoExpanded]);

  return (
    <motion.div 
      className={cn(
        "relative overflow-hidden rounded-xl transition-all",
        isExpanded ? "expanded-card" : ""
      )}
      layout={false} // Disable layout animation to prevent glitching
      transition={{ layout: { duration: 0.4, ease: "easeInOut" } }}
      onClick={(e) => {
        // Only set active card if not clicking on controls
        if (
          e.target instanceof Element && 
          !e.target.closest('button') && 
          !e.target.closest('video') &&
          !e.target.closest('a')
        ) {
          setActiveCard(isActive ? null : id);
        }
      }}
      onMouseEnter={() => setHoveredCard(id)}
      onMouseLeave={() => setHoveredCard(null)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Enhanced background styling with animated gradient */}
      <motion.div 
        className={`absolute inset-0 bg-gradient-to-br ${isExpanded ? getGradientClass(id) : 'from-black/30 to-black/20'} rounded-xl transition-all duration-300`}
        animate={isExpanded ? {
          background: [
            `linear-gradient(135deg, ${getBorderGlowColor(id)}, rgba(0,0,0,0.1))`,
            `linear-gradient(225deg, ${getBorderGlowColor(id)}, rgba(0,0,0,0.1))`,
            `linear-gradient(315deg, ${getBorderGlowColor(id)}, rgba(0,0,0,0.1))`,
            `linear-gradient(45deg, ${getBorderGlowColor(id)}, rgba(0,0,0,0.1))`
          ]
        } : {}}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* Blur backdrop - only when expanded */}
      {isExpanded && (
        <div className="absolute inset-0 backdrop-blur-sm bg-black/10"></div>
      )}
      
      <div className="relative border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all">
        {/* Card Header - Always visible */}
        <div className="p-6 flex flex-col">
          {/* Enhanced icon animation */}
          <div className="mb-4 relative">
            <motion.div
              className={`w-14 h-14 rounded-full ${getBgColorClass(id)} flex items-center justify-center relative overflow-hidden`}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r opacity-50"
                style={{ background: `linear-gradient(45deg, ${getAccentColor(id)}22, transparent)` }}
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
              <motion.div 
                className={`absolute inset-0 rounded-full bg-gradient-to-r ${getAnimationClass(id)}`}
                animate={{ 
                  opacity: [0.4, 0.7, 0.4],
                  scale: [1, 1.05, 1]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="relative z-10"
                animate={isExpanded ? { 
                  rotateY: [0, 360],
                  scale: [1, 1.1, 1]
                } : {}}
                transition={{ 
                  rotateY: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                  scale: { duration: 2, repeat: Infinity, repeatType: "reverse" }
                }}
              >
                <Icon className={`text-3xl ${getTextColorClass(id)}`} />
              </motion.div>
            </motion.div>
          </div>
          
          <motion.h4 
            className="text-white text-lg font-medium mb-2"
            animate={isExpanded ? {
              textShadow: [
                "0 0 0px rgba(255,255,255,0)",
                "0 0 2px rgba(255,255,255,0.3)",
                "0 0 0px rgba(255,255,255,0)"
              ]
            } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {name}
          </motion.h4>
          <p className="text-white/60 mb-4">{description}</p>
          
          <div className="flex justify-between items-center">
            <motion.button 
              ref={expandButtonRef}
              onClick={handleToggle}
              className={`flex items-center gap-2 ${getTextColorClass(id)} text-sm font-medium cursor-pointer hover:underline relative`}
              whileHover={{ x: isExpanded ? -5 : 5 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              aria-expanded={isExpanded}
              aria-controls={`content-${id}`}
            >
              {isExpanded ? 'Show less' : 'Learn more'} 
              <motion.span
                animate={isExpanded ? 
                  { y: [0, -2, 0] } : 
                  { y: [0, 2, 0] }
                }
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                {isExpanded ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
              </motion.span>
            </motion.button>
          </div>
        </div>
        
        {/* Expandable content with enhanced animations */}
        <AnimatePresence initial={false} mode="wait">
          {isExpanded && (
            <motion.div
              id={`content-${id}`}
              ref={contentRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="overflow-hidden border-t border-white/5"
            >
              <div className="p-6">
                {/* Video section - Kept decorative elements on container */}
                <div 
                  ref={videoContainerRef}
                  className={cn(
                    "mb-4 relative overflow-hidden rounded-lg bg-black", 
                    "transition-all duration-300 ease-in-out shadow-lg"
                  )}
                  style={{ 
                    aspectRatio: "16/9", 
                    boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 15px ${getBorderGlowColor(id)}`
                  }}
                  onMouseEnter={() => setIsHoveringVideo(true)}
                  onMouseLeave={() => setIsHoveringVideo(false)}
                >
                  {/* Always keep decorative corners - they frame the video nicely */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/20 rounded-tl-lg z-10"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/20 rounded-tr-lg z-10"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/20 rounded-bl-lg z-10"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/20 rounded-br-lg z-10"></div>
                  
                  {/* Always keep animated edge glow effect */}
                  {videoUrl && (
                    <motion.div 
                      className="absolute inset-0 pointer-events-none rounded-lg z-20"
                      animate={{ 
                        boxShadow: [
                          `inset 0 0 0 1px ${getBorderGlowColor(id)}`,
                          `inset 0 0 10px 1px ${getBorderGlowColor(id)}`,
                          `inset 0 0 0 1px ${getBorderGlowColor(id)}`
                        ],
                      }}
                      transition={{ 
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                  
                  {/* Always keep animated corner light trace */}
                  <motion.div 
                    className="absolute w-[45%] h-[2px] bg-gradient-to-r from-transparent via-white/70 to-transparent top-0 left-0 pointer-events-none z-10"
                    animate={{ 
                      left: ["0%", "55%", "55%", "0%", "0%"],
                      top: ["0%", "0%", "100%", "100%", "0%"],
                      rotate: [0, 90, 180, 270, 360],
                    }}
                    transition={{ 
                      duration: 8,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />

                  {videoUrl && (
                    <>
                      <div className="relative w-full h-full rounded-lg overflow-hidden flex items-center justify-center">
                        {/* Video background animation - always keep for consistent styling */}
                        <motion.div
                          className="absolute inset-0 z-0"
                          initial={{ opacity: 0.3 }}
                          animate={{
                            opacity: [0.2, 0.3, 0.2],
                            background: [
                              `radial-gradient(circle at 30% 30%, ${getBorderGlowColor(id)}, transparent 70%)`,
                              `radial-gradient(circle at 70% 70%, ${getBorderGlowColor(id)}, transparent 70%)`,
                              `radial-gradient(circle at 30% 70%, ${getBorderGlowColor(id)}, transparent 70%)`,
                              `radial-gradient(circle at 70% 30%, ${getBorderGlowColor(id)}, transparent 70%)`,
                            ]
                          }}
                          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        />
                        
                        {/* Video wrapper */}
                        <div className="relative w-full h-full flex items-center justify-center bg-black rounded-lg overflow-hidden">
                          {/* Video element - make sure it's clearly visible */}
                          <video 
                            ref={videoRef}
                            className="w-full h-full object-contain bg-black z-10"
                            loop
                            muted
                            playsInline
                            autoPlay
                            preload="auto"
                            controls={videoLoaded}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <source src={videoUrl} type="video/webm" />
                            Your browser does not support the video tag.
                          </video>
                        </div>
                        
                        {/* Fullscreen toggle button */}
                        <motion.button 
                          onClick={toggleVideoExpand} 
                          className={cn(
                            "absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white z-30",
                            "backdrop-blur-sm border border-white/10",
                            "transition-all hover:border-white/30 shadow-lg",
                            (isHoveringVideo || isVideoExpanded) ? "opacity-100" : "opacity-0"
                          )}
                          aria-label={isVideoExpanded ? "Exit full video" : "Expand video"}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                        >
                          <IoExpandOutline className="text-xl" />
                        </motion.button>
                      </div>
                      
                      {/* Loading and error states */}
                      <AnimatePresence>
                        {!videoLoaded && !videoError && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30 rounded-lg"
                          >
                            <div className="text-center">
                              <motion.div
                                className="w-12 h-12 mx-auto relative"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                              >
                                <div className="absolute inset-0 rounded-full border-4 border-white/10"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-400 border-r-indigo-400/50"></div>
                              </motion.div>
                              <p className="text-white/70 text-sm mt-2">Loading video...</p>
                            </div>
                          </motion.div>
                        )}
                      
                        {videoError && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30 rounded-lg"
                          >
                            <div className="text-white/80 text-center p-5 backdrop-blur-sm bg-black/40 rounded-xl border border-white/10 max-w-[80%]">
                              <p className="mb-3">Failed to load video</p>
                              <motion.button 
                                className="px-4 py-2 bg-white/10 rounded-md hover:bg-white/20 text-sm transition-all border border-white/5 hover:border-white/20"
                                onClick={handleVideoRetry}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                Try Again
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                  
                  {!videoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                      <span className="text-white/70 px-4 py-2 bg-black/40 rounded-md border border-white/10">No video available</span>
                    </div>
                  )}
                </div>
                
                {/* Improved description text with animated highlight */}
                <div className="relative">
                  <motion.p 
                    className="text-white/80 text-sm leading-relaxed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    {longDescription}
                  </motion.p>
                  
                  {/* Animated highlight for text */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    animate={{
                      background: [
                        `linear-gradient(90deg, transparent 0%, ${getBorderGlowColor(id)}00 50%, transparent 100%)`,
                        `linear-gradient(90deg, transparent 0%, ${getBorderGlowColor(id)}15 50%, transparent 100%)`,
                        `linear-gradient(90deg, transparent 0%, ${getBorderGlowColor(id)}00 50%, transparent 100%)`
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                
                {!hideTryButton && (
                  <motion.div 
                    className="mt-5"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <Link href={demoUrl}>
                      <motion.div
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 ${getTextColorClass(id)} text-sm transition-all border border-white/5 hover:border-white/20`}
                        whileHover={{ scale: 1.05, x: 5 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span>Try SignEase Detection</span>
                        <motion.div
                          animate={{ x: [0, 5, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <FaArrowRight className="text-xs" />
                        </motion.div>
                      </motion.div>
                    </Link>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Optimized fullscreen video modal using React Portal */}
      {isMounted && isVideoExpanded && videoUrl && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Enhanced backdrop with animated gradient */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/95"
            onClick={toggleVideoExpand}
          />
          
          {/* Video container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-[95vw] h-[90vh] max-w-[2000px] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fancy frame with animated corners */} 
            <div className="absolute -top-2 -left-2 w-10 h-10 border-t-2 border-l-2 border-white/30 rounded-tl-lg"></div>
            <div className="absolute -top-2 -right-2 w-10 h-10 border-t-2 border-r-2 border-white/30 rounded-tr-lg"></div>
            <div className="absolute -bottom-2 -left-2 w-10 h-10 border-b-2 border-l-2 border-white/30 rounded-bl-lg"></div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 border-b-2 border-r-2 border-white/30 rounded-br-lg"></div>
            
            {/* Pulsing border effect */} 
            <motion.div 
              className="absolute inset-[-1px] rounded-xl pointer-events-none"
              animate={{ 
                boxShadow: [
                  `0 0 0 2px ${getBorderGlowColor(id)}`,
                  `0 0 30px 2px ${getBorderGlowColor(id)}`,
                  `0 0 0 2px ${getBorderGlowColor(id)}`
                ],
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            
            {/* Video container */} 
            <div className="w-full h-full rounded-xl overflow-hidden bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl">
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Video element - using separate ref for fullscreen video */} 
                <video
                  ref={fullscreenVideoRef}
                  className="max-w-full max-h-full w-auto h-auto"
                  style={{ objectFit: "contain" }}
                  loop
                  muted={false}
                  controls
                  autoPlay
                  playsInline
                  onClick={(e) => e.stopPropagation()}
                >
                  <source src={videoUrl} type="video/webm" />
                  Your browser does not support the video tag.
                </video>
                
                {/* Close button with enhanced styling */} 
                <motion.button 
                  onClick={toggleVideoExpand}
                  className="absolute top-5 right-5 z-10 p-3 rounded-full bg-black/60 backdrop-blur-sm text-white border border-white/10 hover:border-white/30 transition-all"
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }}
                  whileTap={{ scale: 0.95 }}
                >
                  <IoContractOutline className="text-2xl" />
                </motion.button>
                
                {/* Video info badge */} 
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="absolute bottom-5 left-5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 px-4 py-2 text-white/80"
                >
                  <h4 className="text-sm font-medium">{name}</h4>
                  <p className="text-xs text-white/50">{description}</p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}