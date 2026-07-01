"use client";

import PixelCard from "@/components/PixelCard"; // Import the new PixelCard component
import Background from "@/components/background";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaArrowRight, FaCamera, FaHandPaper, FaStop } from "react-icons/fa";
import { IoRefreshOutline, IoVolumeHigh } from "react-icons/io5";
import Webcam from "react-webcam";

// Fix the Alert components code
const alertVariants = cva("relative rounded-lg border", {
  variants: {
    variant: {
      default: "border-border bg-background",
      warning: "border-amber-500/50 text-amber-600",
      error: "border-red-500/50 text-red-600",
      success: "border-emerald-500/50",
      info: "border-blue-500/50 text-blue-600",
    },
    size: {
      sm: "px-4 py-3",
      lg: "p-4",
    },
    isNotification: {
      true: "z-[100] max-w-[400px] bg-background shadow-lg shadow-black/5",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "sm",
    isNotification: false,
  },
});

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
  action?: React.ReactNode;
  layout?: "row" | "complex";
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant,
      size,
      isNotification,
      icon,
      action,
      layout = "row",
      children,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        alertVariants({ variant, size, isNotification }),
        className
      )}
      {...props}
    >
      {layout === "row" ? (
        // Однострочный вариант
        <div className="flex items-center gap-2">
          <div className="grow flex items-center">
            {icon && <span className="me-3 inline-flex">{icon}</span>}
            {children}
          </div>
          {action && <div className="flex items-center shrink-0">{action}</div>}
        </div>
      ) : (
        // Многострочный вариант
        <div className="flex gap-2">
          {icon && children ? (
            <div className="flex grow gap-3">
              <span className="mt-0.5 shrink-0">{icon}</span>
              <div className="grow">{children}</div>
            </div>
          ) : (
            <div className="grow">
              {icon && <span className="me-3 inline-flex">{icon}</span>}
              {children}
            </div>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
    </div>
  )
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("text-sm font-medium", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

const AlertContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-1", className)} {...props} />
));
AlertContent.displayName = "AlertContent";

export { Alert, AlertContent, AlertDescription, AlertTitle };

const pacifico = { className: "font-serif", variable: "font-serif" };
const inter = { variable: "font-sans" };
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";
const PREDICTION_TIMEOUT_MS = 180000;
const MAX_RECORDING_DURATION = 10;
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640, max: 640 },
  height: { ideal: 480, max: 480 },
  frameRate: { ideal: 15, max: 15 },
  facingMode: "user",
};
const RECORDER_MIME_TYPES = [
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];
const RECORDING_BITS_PER_SECOND = 350_000;

function getSupportedRecordingMimeType() {
  return RECORDER_MIME_TYPES.find((mimeType) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType)
  );
}

// Add elegant shapes for visual consistency with home page
function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate,
      }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{
          y: [0, 15, 0],
        }}
        transition={{
          duration: 12,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        style={{
          width,
          height,
        }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            gradient,
            "backdrop-blur-[2px] border-2 border-white/[0.15]",
            "shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]",
            "after:absolute after:inset-0 after:rounded-full",
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]"
          )}
        />
      </motion.div>
    </motion.div>
  );
}

interface SignDetectionProps {
  // Add any props if needed
}

const SignDetection: React.FC<SignDetectionProps> = React.memo(() => {
  // Add mounted state
  const [mounted, setMounted] = useState(false);

  // State management
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);
  const [duration, setDuration] = useState<number>(2);
  const [prediction, setPrediction] = useState<string>("No sign detected");
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(
    typeof window !== "undefined" && localStorage.getItem("darkMode") === "true"
  );
  // Add state for welcome speech
  const [hasPlayedWelcome, setHasPlayedWelcome] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  // Add state to track voice loading and initial prompt
  const [voicesLoaded, setVoicesLoaded] = useState<boolean>(false);
  const [speechBlocked, setSpeechBlocked] = useState<boolean>(false);
  // Remove the debug message state that was visible to users
  const [debugMessageInternal, setDebugMessageInternal] = useState<string>('');
  
  // Prevent hydration errors
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
    
    // Initialize speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      speechSynthesisRef.current = window.speechSynthesis;
      console.log("Speech synthesis initialized");
    } else {
      console.warn("Speech synthesis not available");
    }
  }, []);

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get voices and check if they're available
  useEffect(() => {
    if (speechSynthesisRef.current) {
      // Get initial voices - might be empty array in some browsers
      const initialVoices = speechSynthesisRef.current.getVoices();
      
      if (initialVoices.length > 0) {
        console.log(`Initial voices available: ${initialVoices.length}`);
        setVoicesLoaded(true);
      }
      
      // Set up voices changed event handler
      const handleVoicesChanged = () => {
        const voices = speechSynthesisRef.current?.getVoices() || [];
        console.log(`Voices loaded: ${voices.length}`);
        setVoicesLoaded(true);
      };
      
      speechSynthesisRef.current.onvoiceschanged = handleVoicesChanged;
    }
  }, []);

  // Welcome speech function with improved debugging and reliability
  const getPreferredVoice = useCallback(() => {
    const voices = speechSynthesisRef.current?.getVoices() || [];
    const englishVoices = voices.filter(
      (voice) => voice.lang.includes("en") || voice.name.includes("English")
    );
    const femaleVoice = englishVoices.find(
      (voice) =>
        voice.name.includes("Female") ||
        voice.name.includes("woman") ||
        voice.name.includes("Girl")
    );

    return femaleVoice || englishVoices[0] || voices[0] || null;
  }, []);

  const speakWelcomeMessage = useCallback(() => {
    // Don't try to speak if we've already done it or if speech synthesis isn't available
    if (hasPlayedWelcome || !speechSynthesisRef.current || !('speechSynthesis' in window)) {
      return;
    }

    try {
      // Check if we already played the welcome message in this session
      const hasPlayed = sessionStorage.getItem('welcomeMessagePlayed');
      if (hasPlayed) {
        setHasPlayedWelcome(true);
        return;
      }

      // Cancel any existing speech
      speechSynthesisRef.current.cancel();
      
      // Create welcome message with instructions
      const welcomeMessage = new SpeechSynthesisUtterance(
        "Welcome to SignEase! To start sign language detection, position yourself clearly in the camera view, adjust the recording duration using the slider if needed, and click the Start Recording button. For best results, ensure good lighting and perform clear, deliberate gestures."
      );
      
      // Configure voice properties
      welcomeMessage.rate = 1.0; // Normal speed
      welcomeMessage.pitch = 1.0; // Normal pitch
      welcomeMessage.volume = 1.0; // Full volume
      
      const preferredVoice = getPreferredVoice();
      if (preferredVoice) {
        welcomeMessage.voice = preferredVoice;
      }
      
      // Event handlers for speech
      welcomeMessage.onstart = () => {
        console.log('Speech started');
        setIsSpeaking(true);
        // Only log internally, don't show to user
        setDebugMessageInternal('Speech in progress...');
      };
      
      welcomeMessage.onend = () => {
        console.log('Speech ended');
        setIsSpeaking(false);
        setHasPlayedWelcome(true);
        // Only log internally, don't show to user
        setDebugMessageInternal('Speech completed');
        // Mark that we've played the welcome message in this session
        sessionStorage.setItem('welcomeMessagePlayed', 'true');
      };
      
      welcomeMessage.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        setHasPlayedWelcome(true);
        setSpeechBlocked(true);
        // Only log internally, don't show user-facing error messages
        setDebugMessageInternal(`Speech error occurred`);
      };
      
      // Speak the message
      setIsSpeaking(true);
      // Only log internally, don't show to user
      setDebugMessageInternal('Attempting to speak...');
      speechSynthesisRef.current.speak(welcomeMessage);
      
      // Set a timeout to check if speech actually started
      setTimeout(() => {
        if (speechSynthesisRef.current && !speechSynthesisRef.current.speaking) {
          console.warn("Speech didn't start - might be blocked");
          setIsSpeaking(false);
          setSpeechBlocked(true);
          // Only log internally, don't show to user
          setDebugMessageInternal('Speech may be blocked by browser');
        }
      }, 1000);
      
    } catch (error) {
      console.error("Error in speech synthesis:", error);
      setIsSpeaking(false);
      setSpeechBlocked(true);
      // Only log internally, don't show to user
      setDebugMessageInternal(`Speech initialization error`);
    }
  }, [getPreferredVoice, hasPlayedWelcome]);

  const speakPrediction = useCallback((sign: string) => {
    if (
      !sign ||
      sign === "Unknown" ||
      sign === "No sign detected" ||
      !speechSynthesisRef.current ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    try {
      speechSynthesisRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(`Predicted sign is ${sign}`);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const preferredVoice = getPreferredVoice();
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      speechSynthesisRef.current.speak(utterance);
    } catch (error) {
      console.error("Prediction speech error:", error);
      setIsSpeaking(false);
    }
  }, [getPreferredVoice]);

  // Try to speak welcome message when voices are loaded and component is mounted
  useEffect(() => {
    if (mounted && isClient && voicesLoaded && !hasPlayedWelcome) {
      // Try to speak automatically
      console.log("Attempting to speak welcome message");
      speakWelcomeMessage();
      
      // Add a fallback for browsers that block auto-speech
      const interactionTimeout = setTimeout(() => {
        if (!isSpeaking && !hasPlayedWelcome) {
          console.log("Speech might be blocked, setting flag");
          setSpeechBlocked(true);
          setDebugMessageInternal('Please click "Play Instructions" to hear guidance');
        }
      }, 2000);
      
      return () => clearTimeout(interactionTimeout);
    }
  }, [mounted, isClient, voicesLoaded, hasPlayedWelcome, isSpeaking, speakWelcomeMessage]);

  // Add a manual interaction handler for browsers that block auto-play audio
  const handleManualSpeech = () => {
    if (speechSynthesisRef.current && !isSpeaking) {
      // Reset speech flags
      setSpeechBlocked(false);
      setHasPlayedWelcome(false);
      sessionStorage.removeItem('welcomeMessagePlayed');
      // Try speaking again
      speakWelcomeMessage();
    }
  };
  
  // Clean up speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  // Dark Mode Toggle Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", darkMode.toString());
  }, [darkMode]);

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isDetecting && timer < duration) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev >= duration) {
            setIsDetecting(false);
            stopRecording();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isDetecting, timer, duration]);

  // Recording functions
  const startRecording = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!webcamRef.current || capturing) return;

      try {
        const videoElement = webcamRef.current.video;
        if (!videoElement?.srcObject) return;

        const mimeType = getSupportedRecordingMimeType();
        const mediaRecorder = new MediaRecorder(videoElement.srcObject as MediaStream, {
          ...(mimeType ? { mimeType } : {}),
          videoBitsPerSecond: RECORDING_BITS_PER_SECOND,
        });


        let chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          setCapturing(false);
          setIsDetecting(false);
          setTimer(0);
          setPrediction("Processing video...");
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "video/webm" });
          void sendVideoForProcessing(blob);
          chunks = [];
        };

        setCapturing(true);
        setIsDetecting(true);
        setPrediction("Recording...");
        setConfidence(0);

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;

        setTimeout(() => {
          if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
          }
        }, duration * 1000);
      } catch (error) {
        console.error("Camera error:", error);
        setPrediction("Error: Could not access camera");
        setCapturing(false);
      }
    },
    [capturing, duration]
  );

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    setCapturing(false);
  };

  const sendVideoForProcessing = React.useCallback(async (videoBlob: Blob) => {
    try {
      setPrediction("Processing video...");
      const formData = new FormData();
      formData.append("video", videoBlob, `sign_${Date.now()}.webm`);

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        PREDICTION_TIMEOUT_MS
      );

      try {
        const response = await fetch(`${API_BASE_URL}/predict`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        const responseText = await response.text();
        const responseData = responseText ? JSON.parse(responseText) : {};

        if (!response.ok) {
          throw new Error(
            responseData.error || `Prediction failed (${response.status})`
          );
        }

        if (responseData.timing) {
          console.info("Prediction timing:", responseData.timing);
        }

        const detectedSign = responseData.sign || "No sign detected";

        // Batch state updates
        React.startTransition(() => {
          setPrediction(detectedSign);
          setConfidence(
            responseData.confidence ? responseData.confidence * 100 : 0
          );
          setTimer(0);
          setIsDetecting(false);
          setCapturing(false);
        });

        speakPrediction(detectedSign);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      console.error("Error:", error);
      setPrediction(
        error instanceof Error && error.name === "AbortError"
          ? "Prediction timed out. Please try again."
          : error instanceof SyntaxError
            ? "Server returned an invalid response. Please try again."
            : error instanceof TypeError
              ? "Could not reach the prediction server. Check if the Render backend is running."
            : error instanceof Error
              ? error.message
              : "Error processing video"
      );
      setConfidence(0);
    } finally {
      setTimer(0);
      setIsDetecting(false);
      setCapturing(false);
    }
  }, [speakPrediction]);

  // Prevent form submission
  const handleStartRecording = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Reset states before starting new recording
      setTimer(0);
      setIsDetecting(false);
      setCapturing(false);
      setPrediction("Recording...");
      setConfidence(0);

      if (!capturing) {
        void startRecording(e);
      }
    },
    [capturing, startRecording]
  );

  // Cleanup function
  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Animation variants consistent with home page
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

  // Added pulse animation for action buttons
  const pulseAnimation = {
    scale: [1, 1.02, 1],
    transition: { 
      duration: 2, 
      repeat: Infinity, 
      ease: "easeInOut" 
    }
  };

  if (!isClient) {
    return null; // Prevent hydration issues
  }

  // Don't render until mounted
  if (!mounted) return null;

  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-[#030303]",
        inter.variable,
        pacifico.variable
      )}
      suppressHydrationWarning
    >
      {/* Background with consistent styling */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-[#030303]" />
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.05] via-transparent to-rose-500/[0.05]"
          animate={{
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <div className="absolute inset-0">
          <motion.div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0)_60%)]" />
          <motion.div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20" />
        </div>
      </div>

      {/* Add geometric shapes for visual consistency */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <ElegantShape
          delay={0.3}
          width={600}
          height={140}
          rotate={12}
          gradient="from-indigo-500/[0.15]"
          className="left-[-5vw] md:left-[5vw] top-[15vh] md:top-[20vh]"
        />

        <ElegantShape
          delay={0.5}
          width={500}
          height={120}
          rotate={-15}
          gradient="from-rose-500/[0.15]"
          className="right-[5vw] md:right-[10vw] top-[70vh] md:top-[75vh]"
        />

        <ElegantShape
          delay={0.4}
          width={300}
          height={80}
          rotate={-8}
          gradient="from-violet-500/[0.15]"
          className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
        />
      </div>

      <Background key="background-component" />

      <div className="relative z-10">
        {/* Navigation with smooth blur gradient - styled like home page */}
        <nav className="fixed top-0 left-0 right-0 z-30 flex justify-between">
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none" />
          <div className="absolute inset-0 backdrop-blur-[8px] backdrop-saturate-150 bg-black/5 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between w-full px-6 min-h-[80px] py-4">
            <motion.div
              custom={0}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-4"
            >
              <Link
                href="/"
                className="relative flex items-center h-[48px] hover:opacity-80 transition-opacity"
              >
                <Image
                  src="/assets/SignEaseLogo.png"
                  alt="SignEase Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
                <span
                  className={cn(
                    "text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 ml-3 leading-relaxed tracking-wide overflow-visible py-2",
                    pacifico.className
                  )}
                >
                  SignEase
                </span>
              </Link>
            </motion.div>

            <motion.div
              custom={1}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex gap-4 text-white/90"
            >
              <motion.div whileHover={{ scale: 1.05, color: "#818cf8" }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                <Link
                  href="/"
                  className="hover:text-indigo-400 transition-all"
                >
                  Home
                </Link>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05, color: "#818cf8" }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                <Link
                  href="/#technology"
                  className="hover:text-indigo-400 transition-all"
                >
                  Technology
                </Link>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05, color: "#818cf8" }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                <Link
                  href="/#team"
                  className="hover:text-indigo-400 transition-all"
                >
                  Team
                </Link>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05, color: "#818cf8" }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                <Link
                  href="/#contact"
                  className="hover:text-indigo-400 transition-all"
                >
                  Contact
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </nav>

        {/* Main content */}
        <main className="relative py-8 px-4">
          <div className="container mx-auto">
            <div className="flex flex-col min-h-screen items-center justify-center pt-16">
              {/* Module introduction */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="text-center mb-8"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm mb-4"
                >
                  <motion.div
                    animate={{
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Image
                      src="/assets/SignEaseLogo.png"
                      alt="SignEase Logo"
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  </motion.div>
                  <span className="text-sm text-white/80 tracking-wide font-medium">
                    Real-time Sign Language Recognition
                  </span>
                </motion.div>

                <motion.h1 
                  className="text-5xl sm:text-6xl md:text-7xl font-bold mb-4"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                    Communicate with
                  </span>
                  <br />
                  <motion.span
                    className={cn(
                      "bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300",
                      pacifico.className
                    )}
                    animate={{
                      textShadow: [
                        "0 0 0px rgba(255,255,255,0)",
                        "0 0 3px rgba(255,255,255,0.3)",
                        "0 0 0px rgba(255,255,255,0)"
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    SignEase
                  </motion.span>
                </motion.h1>

                <motion.p 
                  className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                >
                  Record your sign language gestures, and our AI will interpret
                  them in real-time. Perfect for bridging communication gaps
                  between the hearing and deaf communities.
                </motion.p>
                {/* Show initial prompt for speech if blocked */}
                {speechBlocked && !isSpeaking && !hasPlayedWelcome && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 mb-2"
                  >
                    <button
                      onClick={handleManualSpeech}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 rounded-full border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
                    >
                      <IoVolumeHigh className="text-lg text-indigo-300" />
                      <span className="text-sm text-white/90">Play Instructions</span>
                    </button>
                  </motion.div>
                )}

                {/* Add speaking indicator when welcome message is playing */}
                {isSpeaking && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-500/20 rounded-full border border-indigo-500/30"
                  >
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 bg-indigo-400 rounded-full"
                    />
                    <span className="text-sm text-white/80">Speaking instructions...</span>
                    <button 
                      onClick={() => {
                        if (speechSynthesisRef.current) {
                          speechSynthesisRef.current.cancel();
                          setIsSpeaking(false);
                          setHasPlayedWelcome(true);
                          sessionStorage.setItem('welcomeMessagePlayed', 'true');
                        }
                      }}
                      className="ml-2 text-xs text-white/60 hover:text-white/90"
                    >
                      Skip
                    </button>
                  </motion.div>
                )}
                
                {/* Remove the visible debug message that was showing errors to users */}
              </motion.div>

              {/* Main interaction area */}
                <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="w-full max-w-5xl mx-auto"
              >
                <motion.div 
                  className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl"
                  whileHover={{ boxShadow: "0 0 25px rgba(255,255,255,0.08)" }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex flex-col lg:flex-row gap-8">
                    {/* Webcam section with enhanced styling */}
                    <div className="flex-1 relative">
                      <motion.div 
                        className="rounded-xl overflow-hidden relative aspect-video bg-gradient-to-br from-black/30 to-black/10 border border-white/10"
                        whileHover={{ borderColor: "rgba(255,255,255,0.2)" }}
                        transition={{ duration: 0.3 }}
                      >
                        <Webcam
                          audio={false}
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          videoConstraints={VIDEO_CONSTRAINTS}
                          className="w-full h-full object-cover rounded-lg"
                          style={{ transform: "scaleX(-1)" }}
                        />

                        {/* Enhanced overlay elements */}
                        {capturing && (
                          <motion.div 
                            className="absolute inset-0 flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            <motion.div 
                              className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 flex items-center gap-2"
                              animate={{ backgroundColor: ["rgba(0,0,0,0.6)", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.6)"] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <div className="animate-pulse w-3 h-3 bg-red-500 rounded-full"></div>
                              <span className="font-medium">
                                {timer}s / {duration}s
                              </span>
                            </motion.div>
                            <div className="absolute bottom-4 left-0 right-0 mx-auto w-3/4 h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full"
                                initial={{ width: "0%" }}
                                animate={{
                                  width: `${(timer / duration) * 100}%`,
                                }}
                                transition={{ duration: 0.5, ease: "linear" }}
                              />
                            </div>
                          </motion.div>
                        )}

                        {/* Camera frame decorative elements */}
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/20 rounded-tl-lg z-10"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/20 rounded-tr-lg z-10"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/20 rounded-bl-lg z-10"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/20 rounded-br-lg z-10"></div>
                      </motion.div>

                      <div className="mt-6 flex flex-wrap justify-center gap-4">
                        {!capturing ? (
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            animate={pulseAnimation}
                          >
                            <Button
                              onClick={handleStartRecording}
                              className="bg-gradient-to-r from-indigo-500 to-rose-500 hover:opacity-90 text-white transition-all flex items-center gap-3 px-8 py-6 rounded-full shadow-lg shadow-indigo-500/20"
                            >
                              <motion.div
                                animate={{ 
                                  scale: [1, 1.2, 1],
                                }}
                                transition={{ 
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut" 
                                }}
                              >
                                <FaCamera className="text-lg" />
                              </motion.div>
                              <span className="text-base font-medium">
                                Start Recording
                              </span>
                            </Button>
                          </motion.div>
                        ) : (
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 10
                            }}
                          >
                            <Button
                              onClick={stopRecording}
                              variant="destructive"
                              className="px-8 py-6 rounded-full flex items-center gap-3 shadow-lg shadow-rose-500/20"
                            >
                              <FaStop className="text-lg" />
                              <span className="text-base font-medium">
                                Stop Recording
                              </span>
                            </Button>
                          </motion.div>
                        )}

                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Button
                            onClick={() => {
                              setPrediction("No sign detected");
                              setConfidence(0);
                            }}
                            variant="outline"
                            className="bg-white/5 hover:bg-white/10 border-white/10 text-white px-6 py-6 rounded-full"
                            disabled={capturing}
                          >
                            <IoRefreshOutline className="text-lg mr-2" /> Reset
                          </Button>
                        </motion.div>
                      </div>

                      <div className="mt-8">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-white/70 text-sm font-medium">
                            Recording Duration
                          </label>
                          <motion.span 
                            className="text-white/90 font-medium px-3 py-1 bg-white/5 rounded-full"
                            animate={capturing ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 1, repeat: capturing ? Infinity : 0 }}
                          >
                            {duration} seconds
                          </motion.span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Slider
                              value={[duration]}
                              onValueChange={(value) => setDuration(value[0])}
                              max={MAX_RECORDING_DURATION}
                              min={1}
                              step={1}
                              disabled={capturing}
                              className="relative z-10"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Replace the existing dictionary button with improved PixelCard */}
                      <div className="mt-12 pt-4 border-t border-white/10">
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                          className="flex justify-center"
                        >
                          <Link href="/dictionary">
                            <PixelCard 
                              variant="pink" 
                              className="h-[120px] w-[320px] cursor-pointer hover:scale-[1.02] transition-transform"
                            >
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-1 z-10">
                                  <div className="flex items-center gap-3">
                                    <Image
                                      src="/assets/SignEaseLogo.png"
                                      alt="SignEase Logo"
                                      width={32}
                                      height={32}
                                      className="object-contain"
                                    />
                                    <span className={cn(
                                      "text-2xl font-bold text-white",
                                      pacifico.className
                                    )}>
                                      Learn
                                    </span>
                                  </div>
                                  <span className="text-sm text-white/80 mt-1">
                                    Explore Sign Dictionary
                                  </span>
                                </div>
                              </div>
                            </PixelCard>
                          </Link>
                        </motion.div>
                      </div>
                    </div>

                    {/* Enhanced Result section with better styling and animations */}
                    <div className="flex-1 flex flex-col lg:border-l lg:border-white/10 lg:pl-8">
                      <motion.h3 
                        className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 mb-6"
                        animate={{
                          textShadow: [
                            "0 0 0px rgba(255,255,255,0)",
                            "0 0 2px rgba(255,255,255,0.3)",
                            "0 0 0px rgba(255,255,255,0)"
                          ]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      >
                        Recognition Results
                      </motion.h3>

                      <div className="flex-1 flex flex-col">
                        <motion.div 
                          className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 h-full flex flex-col"
                          whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
                          transition={{ duration: 0.3 }}
                        >
                          {capturing ? (
                            <div className="flex-1 flex items-center justify-center flex-col">
                              <motion.div
                                animate={{ 
                                  rotate: [0, 360],
                                  boxShadow: [
                                    "0 0 0 rgba(129, 140, 248, 0)",
                                    "0 0 15px rgba(129, 140, 248, 0.3)",
                                    "0 0 0 rgba(129, 140, 248, 0)"
                                  ]
                                }}
                                transition={{ 
                                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                                  boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                                }}
                              >
                                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500"></div>
                              </motion.div>
                              <motion.p 
                                className="mt-6 text-white/60"
                                animate={{ opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              >
                                Recording in progress...
                              </motion.p>
                            </div>
                          ) : prediction === "Processing video..." ? (
                            <div className="flex-1 flex items-center justify-center flex-col">
                              <div className="relative w-20 h-20">
                                <motion.div
                                  className="absolute inset-0 rounded-full border-4 border-rose-500/20"
                                  animate={{ 
                                    scale: [1, 1.1, 1],
                                    opacity: [0.5, 0.8, 0.5]
                                  }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                ></motion.div>
                                <motion.div
                                  className="absolute inset-0 rounded-full border-4 border-t-rose-500 border-r-rose-500/50"
                                  animate={{ rotate: [0, 360] }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                ></motion.div>
                              </div>
                              <motion.p 
                                className="mt-6 text-white/60"
                                animate={{ opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              >
                                AI model processing...
                              </motion.p>
                            </div>
                          ) : prediction !== "No sign detected" ? (
                            <motion.div 
                              className="flex-1 flex flex-col items-center justify-center text-center"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5 }}
                            >
                              <motion.div
                                className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-rose-500/20 flex items-center justify-center mb-6"
                                animate={{ 
                                  boxShadow: [
                                    "0 0 0 rgba(255,255,255,0)",
                                    "0 0 25px rgba(129, 140, 248, 0.3)",
                                    "0 0 0 rgba(255,255,255,0)"
                                  ]
                                }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ 
                                    scale: 1,
                                    rotate: [0, 5, -5, 0]
                                  }}
                                  transition={{
                                    scale: { type: "spring", stiffness: 260, damping: 20 },
                                    rotate: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                                  }}
                                >
                                  <IoVolumeHigh className="text-4xl text-white/90" />
                                </motion.div>
                              </motion.div>
                              
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="space-y-6"
                              >
                                <motion.h3
                                  className={cn(
                                    "text-4xl font-bold text-white",
                                    pacifico.className
                                  )}
                                  animate={{
                                    textShadow: [
                                      "0 0 0px rgba(255,255,255,0)",
                                      "0 0 3px rgba(255,255,255,0.3)",
                                      "0 0 0px rgba(255,255,255,0)"
                                    ]
                                  }}
                                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                >
                                  {prediction}
                                </motion.h3>
                                
                                <div className="flex flex-col items-center">
                                  <p className="text-white/60 text-sm mb-2">
                                    Confidence Level
                                  </p>
                                  <div className="w-full h-3 bg-white/10 rounded-full mt-1 mb-2 overflow-hidden">
                                    <motion.div
                                      className="h-full bg-gradient-to-r from-indigo-500 to-rose-500"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${confidence}%` }}
                                      transition={{
                                        duration: 0.8,
                                        ease: "easeOut",
                                      }}
                                    ></motion.div>
                                  </div>
                                  <motion.p 
                                    className="text-white/90 font-medium px-4 py-1 bg-white/5 rounded-full"
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 10 }}
                                  >
                                    {confidence.toFixed(2)}%
                                  </motion.p>
                                </div>
                              </motion.div>
                            </motion.div>
                          ) : (
                            <motion.div 
                              className="flex-1 flex items-center justify-center flex-col text-center"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5 }}
                            >
                              <motion.div
                                className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4"
                                animate={{ 
                                  y: [0, -10, 0],
                                  opacity: [0.7, 1, 0.7]
                                }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <FaHandPaper className="text-3xl text-white/40" />
                              </motion.div>
                              <motion.h4 
                                className="text-xl font-medium text-white/80 mb-3"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                              >
                                No Sign Detected
                              </motion.h4>
                              <motion.p 
                                className="mt-2 text-white/50 max-w-md"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3, duration: 0.5 }}
                              >
                                Make a sign gesture in front of the camera and
                                click "Start Recording" to begin.
                              </motion.p>
                            </motion.div>
                          )}
                        </motion.div>

                        <motion.div 
                          className="mt-6 bg-white/[0.02] border border-white/[0.05] rounded-xl p-5"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                          whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
                        >
                          <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-300"></span>
                            </span>
                            How to use
                          </h4>
                          
                          <ol className="list-decimal list-inside space-y-3 text-sm text-white/60 ml-1">
                            <motion.li
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5, delay: 0.1 }}
                            >
                              Position yourself clearly in the camera view
                            </motion.li>
                            <motion.li
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                            >
                              Use the slider below the camera to adjust
                              recording duration (1-10 seconds)
                            </motion.li>
                            <motion.li
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5, delay: 0.3 }}
                            >
                              Click the "Start Recording" button and perform
                              your sign gesture
                            </motion.li>
                            <motion.li
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5, delay: 0.4 }}
                            >
                              Hold the gesture steadily until recording
                              completes
                            </motion.li>
                            <motion.li
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5, delay: 0.5 }}
                            >
                              Wait for AI analysis and your sign language
                              translation will appear
                            </motion.li>
                          </ol>

                          <div className="mt-3 p-2 bg-indigo-500/10 rounded-lg">
                            <p className="text-xs text-indigo-300/80">
                              <strong>Tip:</strong> For best results, ensure
                              good lighting and perform clear, deliberate
                              gestures
                            </p>
                          </div>
                        </motion.div>
                        {/* Add a button to replay welcome message - improved visibility */}
                        {hasPlayedWelcome && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1, duration: 0.5 }}
                            className="mt-4 text-center"
                          >
                            <button
                              onClick={handleManualSpeech}
                              disabled={isSpeaking}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-indigo-200 transition-colors text-xs"
                            >
                              <IoVolumeHigh className="text-sm" />
                              <span>Replay instructions</span>
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Additional info section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.6 }}
                className="mt-12 w-full max-w-4xl mx-auto text-center"
              >
                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 mb-4">
                  Technology Behind SignEase
                </h3>
                <p className="text-white/60 mb-6">
                  Our AI-powered sign language recognition system uses advanced
                  computer vision and machine learning to provide accurate,
                  real-time translations.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link
                    href="/#technology"
                    className="px-6 py-3 bg-white/[0.03] border border-white/10 rounded-full flex items-center justify-center gap-2 hover:bg-white/[0.05] transition-all text-white/90"
                  >
                    Learn More <FaArrowRight className="text-sm" />
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
});

export default SignDetection;
