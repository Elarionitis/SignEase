"use client"

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Inter, Pacifico } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import Webcam from "react-webcam";
import { ThemeProvider } from "next-themes";
import { cn } from "@/lib/utils";
import { useRouter } from 'next/router';
import { 
  FaCamera, FaHandPaper, FaBrain, FaArrowRight, 
  FaFacebook, FaTwitter, FaLinkedin, FaEnvelope 
} from 'react-icons/fa';
import { MdCamera, MdGesture, MdPsychology } from 'react-icons/md';

// Font configurations
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
});

// ElegantShape Component
const ElegantShape: React.FC<{
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}> = ({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
}) => {
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
        duration: 1.8,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 0.8 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{
          y: [0, 25, 0],
          x: [-10, 10, -10],
        }}
        transition={{
          duration: 8,
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
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]",
          )}
        />
      </motion.div>
    </motion.div>
  );
};

// Background Component
const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 w-full h-full z-0">
      {/* Base background */}
      <div className="absolute inset-0 bg-[#030303]" />
      
      {/* Animated gradient overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.05] via-transparent to-rose-500/[0.05] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0)_60%)]" />
      </div>

      {/* Animated shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <ElegantShape
          delay={0.2}
          width={600}
          height={140}
          rotate={15}
          gradient="from-indigo-500/[0.15]"
          className="left-[-15%] md:left-[-10%] top-[15%] md:top-[20%]"
        />
        <ElegantShape
          delay={0.3}
          width={500}
          height={120}
          rotate={-20}
          gradient="from-rose-500/[0.15]"
          className="right-[-10%] md:right-[-5%] top-[65%] md:top-[70%]"
        />
        <ElegantShape
          delay={0.4}
          width={300}
          height={80}
          rotate={-12}
          gradient="from-violet-500/[0.15]"
          className="left-[0%] md:left-[5%] bottom-[0%] md:bottom-[5%]"
        />
        <ElegantShape
          delay={0.2}
          width={200}
          height={60}
          rotate={25}
          gradient="from-amber-500/[0.15]"
          className="right-[10%] md:right-[15%] top-[5%] md:top-[10%]"
        />
        <ElegantShape
          delay={0.3}
          width={150}
          height={40}
          rotate={-30}
          gradient="from-cyan-500/[0.15]"
          className="left-[15%] md:left-[20%] top-[0%] md:top-[5%]"
        />
      </div>
    </div>
  );
};

// Navbar Component
const Navbar: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-30 flex justify-between">
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none" />
      <div className="absolute inset-0 backdrop-blur-[8px] backdrop-saturate-150 bg-black/5 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between w-full px-6 min-h-[80px] py-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4"
        >
          <div className="relative flex items-center h-[48px]">
            <Image 
              src="/assets/SignEaseLogo.png" 
              alt="SignEase Logo" 
              width={40} 
              height={40}
              className="object-contain"
            />
            <span className={cn(
              "text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 ml-3 leading-relaxed tracking-wide overflow-visible py-2",
              pacifico.className // Changed from inter.className to pacifico.className
            )}>
              SignEase.
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center px-4 gap-6"
        >
          <Link 
            href="/" 
            className="text-white/90 hover:text-indigo-400 transition-all hover:scale-105"
          >
            Home
          </Link>
          <Link 
            href="/sign-detection" 
            className="text-white/90 hover:text-indigo-400 transition-all hover:scale-105"
          >
            Try Now
          </Link>
          <a
            className="hover:text-indigo-400 transition-all hover:scale-105"
            href="#about"
          >
            About
          </a>
          <a
            className="hover:text-indigo-400 transition-all hover:scale-105"
            href="#technology"
          >
            Technology
          </a>
          <a
            className="hover:text-indigo-400 transition-all hover:scale-105"
            href="#team"
          >
            Team
          </a>
          <a
            className="hover:text-indigo-400 transition-all hover:scale-105"
            href="#contact"
          >
            Contact
          </a>
        </motion.div>
      </div>
    </nav>
  );
};

// SignDetection Component
const SignDetection = () => {
  // State management
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [prediction, setPrediction] = useState<string>("No sign detected");
  const [confidence, setConfidence] = useState<number>(0);
  const [duration, setDuration] = useState<number>(2);
  const [timer, setTimer] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const startRecording = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!webcamRef.current || capturing) return;

    try {
      const stream = webcamRef.current.video?.srcObject as MediaStream;
      if (!stream) return;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      let chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
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
  }, [capturing, duration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setCapturing(false);
  }, []);

  const sendVideoForProcessing = useCallback(async (videoBlob: Blob) => {
    try {
      setPrediction("Processing video...");
      const formData = new FormData();
      formData.append("video", videoBlob, `sign_${Date.now()}.webm`);

      const response = await fetch("http://localhost:5000/predict", {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      setPrediction(result.sign || "No sign detected");
      setConfidence(result.confidence ? result.confidence * 100 : 0);

      if (result.audio_url) {
        const audio = new Audio(`http://localhost:5000${result.audio_url}?t=${Date.now()}`);
        void audio.play().catch(console.error);
      }

    } catch (error) {
      console.error('Error:', error);
      setPrediction("Error processing video");
      setConfidence(0);
    } finally {
      setTimer(0);
      setIsDetecting(false);
      setCapturing(false);
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#030303]">
      <Background />
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between">
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none" />
          <div className="absolute inset-0 backdrop-blur-[8px] backdrop-saturate-150 bg-black/5 pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-between w-full px-6 min-h-[80px] py-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-4"
            >
              <div className="relative flex items-center h-[48px]">
                <Image 
                  src="/assets/SignEaseLogo.png" 
                  alt="SignEase Logo" 
                  width={40} 
                  height={40}
                  className="object-contain"
                />
                <span className={cn(
                  "text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 ml-3 leading-relaxed tracking-wide overflow-visible py-2",
                  pacifico.className
                )}>
                  SignEase.
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex items-center px-4"
            >
              <Link 
                href="/" 
                className="text-white/90 hover:text-indigo-400 transition-all hover:scale-105"
              >
                Home
              </Link>
            </motion.div>
          </div>
        </nav>

        {/* Main content - Removed SignEase heading */}
        <div className="relative z-10 pt-20 px-4">
          <div className="container mx-auto">
            <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-4xl mx-auto space-y-8"
              >
                <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                  <div className="flex flex-col md:flex-row gap-8">
                    {/* Webcam component */}
                    <div className="flex-1 relative">
                      <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="w-full rounded-lg"
                        style={{ transform: "scaleX(-1)" }}
                      />
                      {capturing && (
                        <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded">
                          {timer}s / {duration}s
                        </div>
                      )}
                    </div>

                    {/* Controls section */}
                    <div className="flex-1 flex flex-col justify-center text-white">
                      <div className="flex items-center gap-4 mb-4">
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value))}
                          disabled={capturing}
                          className="flex-1"
                        />
                        <div className="w-20 text-center">{duration} sec</div>
                      </div>
                      <button
                        onClick={startRecording}
                        disabled={capturing}
                        className="bg-gradient-to-r from-indigo-500 to-rose-500 text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {capturing ? "Recording..." : "Start Recording"}
                      </button>
                      {prediction && (
                        <div className="mt-4 p-4 bg-white/10 rounded-lg">
                          <p className="text-lg font-semibold">Sign: {prediction}</p>
                          <p className="text-sm opacity-80">
                            Confidence: {Number(confidence).toFixed(2)}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// HeroGeometric Component
const HeroGeometric: React.FC = () => {
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

  return (
    <div className="bg-[#030303] min-h-screen">
      <Background />
      <div className={cn("relative z-10 w-full text-white")}>
        <div className="w-full max-w-[1200px] mx-auto px-4 relative">
          <header className="relative w-full min-h-screen flex items-center justify-center">
            <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <motion.div
                custom={0}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8"
              >
                <Image src="/assets/SignEaseLogo.png" alt="SignEase Logo" width={20} height={20} />
                <span className="text-sm text-white/60 tracking-wide">Real-time Sign Language Recognition</span>
              </motion.div>

              <motion.h2
                custom={1}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 tracking-tight"
              >
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                  Breaking the language barrier with
                </span>
                <br />
                <span className={cn(
                  "bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300",
                  pacifico.className,
                )}>
                  SignEase.
                </span>
              </motion.h2>

              <motion.p
                custom={2}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                className="text-base sm:text-lg md:text-xl text-white/40 mb-8 leading-relaxed font-light tracking-wide max-w-xl mx-auto px-4"
              >
                Crafting exceptional digital experiences through innovative design and cutting-edge technology.
              </motion.p>

              <Link href="/sign-detection" passHref>
                <motion.button
                  custom={3}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ scale: 1.05, boxShadow: "0px 8px 15px rgba(0, 0, 0, 0.3)" }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-gradient-to-r from-indigo-500 to-rose-500 px-8 py-4 rounded-full text-lg font-semibold shadow-lg transform transition-all flex items-center gap-2 mx-auto"
                >
                  Try SignEase Now <FaArrowRight />
                </motion.button>
              </Link>
            </div>
          </header>

          {/* Technology Section */}
          <section id="technology" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <motion.h3
              custom={3}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="text-4xl font-bold text-center mb-16 text-white"
            >
              Our Technology Stack
            </motion.h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Frame Capture Card */}
              <motion.div
                custom={4}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl transition-all hover:border-indigo-500/50"
              >
                <MdCamera className="text-5xl mb-4 text-indigo-400" />
                <h4 className="text-xl font-semibold mb-4">Frame Capture</h4>
                <p className="text-white/60">Utilizing OpenCV for precise real-time frame capture and processing</p>
              </motion.div>

              {/* Mediapipe Processing Card */}
              <motion.div
                custom={5}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl transition-all hover:border-rose-500/50"
              >
                <MdGesture className="text-5xl mb-4 text-rose-400" />
                <h4 className="text-xl font-semibold mb-4">Mediapipe Processing</h4>
                <p className="text-white/60">Advanced landmark detection for hands, pose, and facial features</p>
              </motion.div>

              {/* AI Model Card */}
              <motion.div
                custom={6}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl transition-all hover:border-violet-500/50"
              >
                <MdPsychology className="text-5xl mb-4 text-violet-400" />
                <h4 className="text-xl font-semibold mb-4">AI Model</h4>
                <p className="text-white/60">87% accurate Transformer model for real-time sign language interpretation</p>
              </motion.div>
            </div>
          </section>

          {/* FAQ Section */}
          <section id="faq" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <motion.h3
              custom={7}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300"
            >
              Frequently Asked Questions
            </motion.h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* FAQ Items */}
              <motion.div
                custom={8}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl transition-all"
              >
                <h4 className="text-xl font-semibold mb-4 text-indigo-400">
                  How does SignEase work?
                </h4>
                <p className="text-white/60">
                  SignEase uses advanced computer vision and machine learning technologies to detect and interpret sign language in real-time. Our system combines MediaPipe for precise hand tracking with a custom-trained transformer model for accurate sign recognition.
                </p>
              </motion.div>

              <motion.div
                custom={9}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl transition-all"
              >
                <h4 className="text-xl font-semibold mb-4 text-rose-400">
                  What makes SignEase different?
                </h4>
                <p className="text-white/60">
                  Our solution offers real-time translation with 87% accuracy, works across different lighting conditions, and doesn't require any special hardware - just your device's camera. We also focus on user privacy and offline processing capabilities.
                </p>
              </motion.div>

              <motion.div
                custom={10}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl transition-all"
              >
                <h4 className="text-xl font-semibold mb-4 text-violet-400">
                  Is SignEase accessible offline?
                </h4>
                <p className="text-white/60">
                  Yes! Once loaded, SignEase can function without an internet connection. Our model runs locally on your device, ensuring both privacy and reliability regardless of your connection status.
                </p>
              </motion.div>

              <motion.div
                custom={11}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl transition-all"
              >
                <h4 className="text-xl font-semibold mb-4 text-amber-400">
                  What sign languages are supported?
                </h4>
                <p className="text-white/60">
                  Currently, SignEase supports American Sign Language (ASL) with 87% accuracy. We're actively working on expanding our support to include Indian Sign Language (ISL) and other regional sign languages.
                </p>
              </motion.div>
            </div>
          </section>

          {/* Team Section */}
          <section id="team" className="py-20 px-12">
            <motion.h3
              custom={7}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="text-4xl font-bold text-center mb-16 text-white"
            >
              Meet Our Team
            </motion.h3>

            <div className="flex flex-col md:flex-row justify-center gap-12">
              {/* Team Member Cards */}
              <motion.div
                custom={8}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl transition-all"
              >
                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500/20 to-rose-500/20 mb-6 mx-auto overflow-hidden">
                  <Image src="/assets/pavanpfp.jpeg" alt="Pavan Chauhan" width={192} height={192} className="object-cover w-full h-full" />
                </div>
                <h4 className="text-xl font-semibold text-center mb-2">Pavan Chauhan</h4>
                <p className="text-center text-white/40">Final Year Computer Engineering Grad, Machine Learning Enthusiast, Data Handling and Machine Learning Core</p>
                <div className="flex justify-center mt-4">
                  <a href="https://www.linkedin.com/in/pavanchauhan16/" target="_blank" rel="noopener noreferrer">
                    <FaLinkedin className="text-2xl text-white/60 transition-all hover:text-indigo-400 hover:scale-110" />
                  </a>
                </div>
              </motion.div>

              <motion.div
                custom={9}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-xl transition-all"
              >
                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500/20 to-rose-500/20 mb-6 mx-auto overflow-hidden">
                  <Image src="/assets/poojapfp.jpeg" alt="Pooja Ramani" width={192} height={192} className="object-cover w-full h-full" />
                </div>
                <h4 className="text-xl font-semibold text-center mb-2">Pooja Ramani</h4>
                <p className="text-center text-white/40">3rd Year Computer Engineering Grad, Deployment Expert, Software Development Core</p>
                <div className="flex justify-center mt-4">
                  <a href="https://www.linkedin.com/in/poojaramani/" target="_blank" rel="noopener noreferrer">
                    <FaLinkedin className="text-2xl text-white/60 transition-all hover:text-indigo-400 hover:scale-110" />
                  </a>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Footer Section */}
          <footer id="contact" className="w-full py-12 px-4 sm:px-6 lg:px-8 bg-black/30">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Contact Info */}
              <div>
                <motion.h4
                  custom={10}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-xl font-semibold text-white mb-4"
                >
                  Contact Us
                </motion.h4>
                <motion.p
                  custom={11}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  className="mb-2 text-white/60"
                >
                  Email: pavannn16@gmail.com
                </motion.p>
                <motion.p
                  custom={12}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
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
                  animate="visible"
                  className="text-xl font-semibold text-white mb-4"
                >
                  Follow Us
                </motion.h4>
                <motion.div
                  custom={14}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex gap-4"
                >
                  <motion.a
                    href="https://www.facebook.com"
                    whileHover={{ scale: 1.1, color: "#6366F1" }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl text-white/60 transition-all"
                  >
                    <FaFacebook />
                  </motion.a>
                  <motion.a
                    href="https://www.twitter.com"
                    whileHover={{ scale: 1.1, color: "#6366F1" }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl text-white/60 transition-all"
                  >
                    <FaTwitter />
                  </motion.a>
                  <motion.a
                    href="https://www.linkedin.com/in/pavanchauhan16/"
                    whileHover={{ scale: 1.1, color: "#6366F1" }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl text-white/60 transition-all"
                  >
                    <FaLinkedin />
                  </motion.a>
                  <motion.a
                    href="mailto:pavannn16@gmail.com"
                    whileHover={{ scale: 1.1, color: "#6366F1" }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl text-white/60 transition-all"
                  >
                    <FaEnvelope />
                  </motion.a>
                </motion.div>
              </div>

              <div>
                <motion.h4
                  custom={15}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-xl font-semibold text-white mb-4"
                >
                  Location
                </motion.h4>
                <motion.p
                  custom={16}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-white/60"
                >
                  CHARUSAT Campus, 139, Highway, off Nadiad - Petlad Road, Changa, Gujarat 388421
                </motion.p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <div className={`${inter.variable} font-sans bg-[#030303] min-h-screen`}>
        <Background />
        <div className="relative z-10">
          <Navbar />
          {router.pathname === '/' && <HeroGeometric />}
          {router.pathname === '/sign-detection' && <SignDetection />}
        </div>
      </div>
    </ThemeProvider>
  );
};

export default App;
