import PixelCard from "@/components/PixelCard";
import Background from "@/components/background";
import { Celebration } from "@/components/detection/Celebration";
import {
  PracticeCard,
  type PracticeOutcome,
  type PracticeSign,
} from "@/components/detection/PracticeCard";
import { SessionHistory, type HistoryEntry } from "@/components/detection/SessionHistory";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { SLOW_FRAME_MS, useHolisticTracker, type TrackerStatus } from "@/hooks/useHolisticTracker";
import {
  PredictionError,
  requestPrediction,
  type PredictionResponse,
  type SignPrediction,
} from "@/lib/api";
import { COMPACT_LAYOUT, packFrames, packFullFrames, type LandmarkFrame } from "@/lib/holistic";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { NormalizedLandmarkList } from "@mediapipe/holistic";
import fs from "fs";
import type { GetStaticProps } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaArrowRight,
  FaCamera,
  FaCheckCircle,
  FaExclamationTriangle,
  FaGraduationCap,
  FaHandPaper,
  FaKeyboard,
  FaMagic,
  FaStop,
} from "react-icons/fa";
import { IoRefreshOutline, IoVolumeHigh } from "react-icons/io5";
import Webcam from "react-webcam";
import path from "path";
import signMap from "@/data/sign_to_prediction_index_map.json";

const pacifico = { className: "font-serif", variable: "font-serif" };
const inter = { variable: "font-sans" };

// On-device predictions only upload landmarks and return in well under a
// second; this budget is for a Render cold start or the video fallback.
const PREDICTION_TIMEOUT_MS = 90_000;
// With on-device tracking the recording also stops by itself once the hands
// are lowered, so this is only the maximum.
const DEFAULT_RECORDING_DURATION = 5;
// Auto-stop: hands out of view this long, after at least this many frames
// of signing, ends the recording.
const AUTO_STOP_HANDS_GONE_MS = 700;
const AUTO_STOP_MIN_HAND_FRAMES = 12;
// Live hand preview and framing check between recordings.
const PREVIEW_INTERVAL_MS = 180;
const COUNTDOWN_PREVIEW_INTERVAL_MS = 60;
const MIN_RECORDING_DURATION = 1;
const MAX_RECORDING_DURATION = 10;
// Matches MAX_LANDMARK_FRAMES on the backend (30 fps for 10 seconds, doubled).
const MAX_LANDMARK_FRAMES = 600;
// Fewer hand frames than this is not enough motion for the model.
const MIN_HAND_FRAMES = 4;
// Below this tracking rate (slow GPU / software rendering) the on-device
// sequence is too sparse, so the recorded clip is sent to the server instead.
const MIN_TRACKED_FPS = 6;
// Confidence is calibrated on the server: below this, about half of the
// predictions on real sign videos were wrong.
const LOW_CONFIDENCE = 0.4;
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 30, max: 30 },
  facingMode: "user",
};
const RECORDER_MIME_TYPES = [
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];
// A modest bitrate keeps MediaRecorder from competing with hand tracking and
// the live preview for CPU and encoder resources.
const RECORDING_BITS_PER_SECOND = 600_000;
const WELCOME_SPEECH_SESSION_KEY = "welcomeMessagePlayed";
const COUNTDOWN_SECONDS = 3;
const COUNTDOWN_PREFERENCE_KEY = "signease:countdown";
const BEST_STREAK_KEY = "signease:bestStreak";
const MAX_HISTORY = 12;
// Common, distinctive signs to start the practice challenge with.
const STARTER_SIGNS = ["hello", "thankyou", "yes", "no", "bye", "drink", "happy", "eat", "milk", "mom", "dad", "please"];
const WELCOME_MESSAGE =
  "Welcome to SignEase! To start sign language detection, position yourself clearly in the camera view, adjust the recording duration using the slider if needed, and click the Start Recording button. For best results, ensure good lighting and perform clear, deliberate gestures.";

const HAND_CONNECTIONS: ReadonlyArray<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

type Phase = "idle" | "countdown" | "recording" | "processing" | "result" | "error";
type Mode = "free" | "practice";

interface SignDetectionProps {
  practiceSigns: PracticeSign[];
}

// Practice uses the signs that have a demo clip, known at build time.
export const getStaticProps: GetStaticProps<SignDetectionProps> = async () => {
  const videoDir = path.join(process.cwd(), "public", "videos", "signs");
  const videos = new Set(
    fs.existsSync(videoDir) ? fs.readdirSync(videoDir).filter((file) => file.endsWith(".mp4")) : []
  );
  const withVideo = Object.entries(signMap as Record<string, number>)
    .filter(([, index]) => videos.has(`${index}.mp4`))
    .map(([name, index]) => ({ name, index }));
  const starters = STARTER_SIGNS.flatMap((name) => withVideo.filter((sign) => sign.name === name));
  const rest = withVideo
    .filter((sign) => !STARTER_SIGNS.includes(sign.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { props: { practiceSigns: [...starters, ...rest] } };
};

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the preference just isn't remembered.
  }
}

let audioContext: AudioContext | null = null;

/** A short tone for the countdown. Created on a click, so autoplay allows it. */
function beep(frequency: number, durationMs = 120) {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ??= new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000 + 0.02);
  } catch {
    // Sound is a nicety; ignore browsers that refuse it.
  }
}
type PredictionMode = "on-device" | "server";

interface RecognitionResult {
  sign: string;
  confidence: number;
  alternatives: SignPrediction[];
  mode: PredictionMode;
}

type FramingIssue = "no-person" | "too-close" | "too-low" | "too-far" | "off-center" | null;

const FRAMING_ADVICE: Record<Exclude<FramingIssue, null>, string> = {
  "no-person": "Step into the camera view",
  "too-close": "Move back so your chest and stomach are in view",
  "too-low": "Raise the camera or sit up: your shoulders are low in the frame",
  "too-far": "Move a little closer",
  "off-center": "Move to the center of the frame",
};

// Pose rows in the 543-landmark frame (face 468 + left hand 21, then pose).
const POSE_ROW = 489;

/**
 * Compares the signer's position with the training videos: shoulders about
 * 60% down a portrait frame, ~0.4 frame heights wide, the stomach in view.
 * Many signs are made at the chest or stomach; if that area is outside the
 * frame the hands are not tracked and the model sees a different sign.
 */
function analyzeFraming(values: Float32Array, aspect: number): FramingIssue {
  const point = (index: number) => ({
    x: values[(POSE_ROW + index) * 3],
    y: values[(POSE_ROW + index) * 3 + 1],
  });
  const left = point(11);
  const right = point(12);
  const hips = [point(23), point(24)];
  if (![left.x, left.y, right.x, right.y].every(Number.isFinite)) return "no-person";

  const shoulderY = (left.y + right.y) / 2;
  const centerX = (left.x + right.x) / 2;
  // In frame heights, so landscape and portrait cameras compare equally.
  const shoulderWidth = Math.abs(left.x - right.x) * aspect;
  const hipY = hips.every((hip) => Number.isFinite(hip.y)) ? (hips[0].y + hips[1].y) / 2 : Infinity;

  if (shoulderWidth > 0.6 || hipY > 1.35) return "too-close";
  if (shoulderY > 0.75) return "too-low";
  if (shoulderWidth < 0.16) return "too-far";
  if (Math.abs(centerX - 0.5) > 0.22) return "off-center";
  return null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

interface RecordingSession {
  active: boolean;
  lastHandAt: number;
  autoStopped: boolean;
  startedAt: number;
  handFrames: Float32Array[];
  handFrameTimes: number[];
  frameAspect: number;
  trackedFrames: number;
  trackerFailed: boolean;
  trackerTooSlow: boolean;
  trackingLoop: Promise<void> | null;
  recorder: MediaRecorder | null;
  recorderStopped: Promise<Blob | null> | null;
  stopTimer: number | null;
  abort: AbortController;
}

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return RECORDER_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function getRecordingExtension(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

// Display names for the model's classes (the frontend map can rename a sign,
// e.g. "weus" -> "we/us"); the server answers with its own names and the index.
const INDEX_TO_SIGN = new Map(
  Object.entries(signMap as Record<string, number>).map(([name, index]) => [index, name])
);

function displayPrediction(prediction: SignPrediction): SignPrediction {
  const name = prediction.index !== undefined ? INDEX_TO_SIGN.get(prediction.index) : undefined;
  return name ? { ...prediction, sign: name } : prediction;
}

function formatSign(sign: string) {
  return sign.replace(/_/g, " ");
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.getAttribute("role") === "slider" ||
    target.getAttribute("role") === "switch"
  );
}

/**
 * Resolves on the next decoded camera frame (or animation frame as a
 * fallback). The timeout keeps the loop alive if the camera stalls.
 */
function nextVideoFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(resolve, 250);
    const done = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback(done);
    } else {
      window.requestAnimationFrame(done);
    }
  });
}

function withTimeout<T>(promise: Promise<T> | null, ms: number, fallback: T) {
  if (!promise) return Promise.resolve(fallback);
  return Promise.race([
    promise,
    new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms)),
  ]);
}

function startRecorder(stream: MediaStream) {
  if (typeof MediaRecorder === "undefined") {
    return { recorder: null, stopped: null };
  }

  try {
    const mimeType = getSupportedRecordingMimeType();
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: RECORDING_BITS_PER_SECOND,
    });
    const chunks: Blob[] = [];
    const stopped = new Promise<Blob | null>((resolve) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || "video/webm" }) : null);
      };
      recorder.onerror = () => resolve(null);
    });
    recorder.start();
    return { recorder, stopped };
  } catch (error) {
    console.warn("[SignEase] MediaRecorder unavailable", error);
    return { recorder: null, stopped: null };
  }
}

function drawHands(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  hands: Array<NormalizedLandmarkList | undefined>
) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);

  const scale = Math.max(2, canvas.width / 320);
  for (const hand of hands) {
    if (!hand?.length) continue;

    context.strokeStyle = "rgba(165, 180, 252, 0.9)";
    context.lineWidth = scale;
    context.beginPath();
    for (const [from, to] of HAND_CONNECTIONS) {
      context.moveTo(hand[from].x * canvas.width, hand[from].y * canvas.height);
      context.lineTo(hand[to].x * canvas.width, hand[to].y * canvas.height);
    }
    context.stroke();

    context.fillStyle = "rgba(251, 113, 133, 0.95)";
    for (const point of hand) {
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height, scale * 1.5, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function clearCanvas(canvas: HTMLCanvasElement | null) {
  canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

function trackerLabel(status: TrackerStatus) {
  switch (status) {
    case "loading":
      return "Loading on-device hand tracking…";
    case "calibrating":
      return "Checking device performance…";
    case "ready":
      return "On-device hand tracking ready";
    default:
      return "Server processing mode";
  }
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

const SignDetection: React.FC<SignDetectionProps> = ({ practiceSigns }) => {
  const webcamRef = useRef<Webcam>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  const mountedRef = useRef(true);
  const { status: trackerStatus, trackerRef, calibrate, disable: disableTracker } = useHolisticTracker();

  const [duration, setDuration] = useState<number>(DEFAULT_RECORDING_DURATION);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState<number>(0);
  const [handsVisible, setHandsVisible] = useState<boolean>(false);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>("");
  const [cameraKey, setCameraKey] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [useCountdown, setUseCountdown] = useState<boolean>(true);
  const [retryNotice, setRetryNotice] = useState<string>("");
  const [framing, setFraming] = useState<FramingIssue | "unknown">("unknown");
  const [signingStarted, setSigningStarted] = useState<boolean>(false);
  const previewLoopRef = useRef<Promise<void> | null>(null);
  const finishRecordingRef = useRef<() => Promise<void>>(async () => undefined);
  const countdownTimerRef = useRef<number | null>(null);

  // Practice challenge and session history
  const [mode, setMode] = useState<Mode>("free");
  const [practiceQueue, setPracticeQueue] = useState<PracticeSign[]>(practiceSigns);
  const [practiceIndex, setPracticeIndex] = useState<number>(0);
  const [practiceOutcome, setPracticeOutcome] = useState<PracticeOutcome>(null);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [practiceMatched, setPracticeMatched] = useState<number>(0);
  const [practiceAttempts, setPracticeAttempts] = useState<number>(0);
  const [celebrationKey, setCelebrationKey] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const historyIdRef = useRef(0);
  const practiceTarget = mode === "practice" ? practiceQueue[practiceIndex % Math.max(1, practiceQueue.length)] : undefined;
  const practiceTargetRef = useRef<PracticeSign | undefined>(undefined);
  practiceTargetRef.current = practiceTarget;

  // Speech state
  const [hasPlayedWelcome, setHasPlayedWelcome] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [voicesLoaded, setVoicesLoaded] = useState<boolean>(false);
  const [speechBlocked, setSpeechBlocked] = useState<boolean>(false);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const welcomeSpeechAttemptedRef = useRef(false);

  const isRecording = phase === "recording";
  // Matches Tailwind's lg breakpoint, where the results move beside the camera.
  const [isNarrow, setIsNarrow] = useState<boolean>(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsNarrow(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  const isCountingDown = phase === "countdown";
  const isBusy = phase === "countdown" || phase === "recording" || phase === "processing";

  // Restore preferences, and keep the starter signs first but vary the rest.
  useEffect(() => {
    if (readStorage(COUNTDOWN_PREFERENCE_KEY) === "off") setUseCountdown(false);
    const best = Number(readStorage(BEST_STREAK_KEY));
    if (Number.isFinite(best) && best > 0) setBestStreak(best);
    const starterCount = practiceSigns.filter((sign) => STARTER_SIGNS.includes(sign.name)).length;
    setPracticeQueue([
      ...shuffled(practiceSigns.slice(0, starterCount)),
      ...shuffled(practiceSigns.slice(starterCount)),
    ]);
  }, [practiceSigns]);

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      speechSynthesisRef.current = window.speechSynthesis;
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Wakes the backend while the user is setting up and keeps it awake, so
  // the first prediction does not wait for a cold Render start.
  const backendStatus = useBackendStatus();

  // Get voices and check if they're available
  useEffect(() => {
    const synth = speechSynthesisRef.current;
    if (!synth) return;

    if (synth.getVoices().length > 0) {
      setVoicesLoaded(true);
    }

    const handleVoicesChanged = () => setVoicesLoaded(true);
    synth.addEventListener?.("voiceschanged", handleVoicesChanged);
    // Some browsers never fire voiceschanged; try anyway after a short wait.
    const fallbackId = window.setTimeout(() => setVoicesLoaded(true), 1500);

    return () => {
      synth.removeEventListener?.("voiceschanged", handleVoicesChanged);
      window.clearTimeout(fallbackId);
    };
  }, []);

  const getPreferredVoice = useCallback(() => {
    const voices = speechSynthesisRef.current?.getVoices() || [];
    const englishVoices = voices.filter(
      (voice) => voice.lang.toLowerCase().startsWith("en") || voice.name.includes("English")
    );
    const femaleVoice = englishVoices.find(
      (voice) =>
        voice.name.includes("Female") ||
        voice.name.includes("woman") ||
        voice.name.includes("Girl")
    );

    return femaleVoice || englishVoices[0] || voices[0] || null;
  }, []);

  const speak = useCallback(
    (text: string, { onStart, onEnd }: { onStart?: () => void; onEnd?: (ok: boolean) => void } = {}) => {
      const synth = speechSynthesisRef.current;
      if (!synth) return false;

      try {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        const preferredVoice = getPreferredVoice();
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onstart = () => {
          setIsSpeaking(true);
          onStart?.();
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          onEnd?.(true);
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          onEnd?.(false);
        };
        synth.speak(utterance);
        return true;
      } catch (error) {
        console.error("Speech error:", error);
        setIsSpeaking(false);
        return false;
      }
    },
    [getPreferredVoice]
  );

  const speakWelcomeMessage = useCallback(
    (force = false) => {
      const synth = speechSynthesisRef.current;
      if (!synth || (!force && (hasPlayedWelcome || welcomeSpeechAttemptedRef.current))) {
        return;
      }

      try {
        // Keep automatic instructions to one attempt per browser tab. Mark
        // this before speaking because route changes and browser
        // interruptions can cancel an utterance before `onend` fires.
        if (!force) {
          welcomeSpeechAttemptedRef.current = true;
          if (sessionStorage.getItem(WELCOME_SPEECH_SESSION_KEY)) {
            setHasPlayedWelcome(true);
            return;
          }
          sessionStorage.setItem(WELCOME_SPEECH_SESSION_KEY, "true");
        }
      } catch {
        // sessionStorage can throw in private mode; speaking still works.
      }

      setHasPlayedWelcome(true);
      setSpeechBlocked(false);
      const started = speak(WELCOME_MESSAGE, {
        onEnd: (ok) => {
          if (!ok) setSpeechBlocked(true);
        },
      });
      if (!started) {
        setSpeechBlocked(true);
        return;
      }

      // Autoplay policies drop speech silently; offer a manual button then.
      window.setTimeout(() => {
        if (mountedRef.current && !synth.speaking && !synth.pending) {
          setIsSpeaking(false);
          setSpeechBlocked(true);
        }
      }, 1000);
    },
    [hasPlayedWelcome, speak]
  );

  // Try the intro speech automatically, then fall back to the manual button if blocked.
  useEffect(() => {
    if (voicesLoaded && !hasPlayedWelcome) {
      speakWelcomeMessage();
    }
  }, [voicesLoaded, hasPlayedWelcome, speakWelcomeMessage]);

  const handleManualSpeech = () => {
    if (speechSynthesisRef.current && !isSpeaking) {
      speakWelcomeMessage(true);
    }
  };

  const skipSpeech = () => {
    speechSynthesisRef.current?.cancel();
    setIsSpeaking(false);
    setHasPlayedWelcome(true);
  };

  // Stop speech, recording and in-flight requests when leaving the page.
  useEffect(() => {
    return () => {
      speechSynthesisRef.current?.cancel();
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      const session = sessionRef.current;
      if (session) {
        session.active = false;
        session.abort.abort();
        if (session.stopTimer) window.clearTimeout(session.stopTimer);
        if (session.recorder?.state === "recording") session.recorder.stop();
      }
    };
  }, []);

  // Recording timer, driven from the start timestamp so it cannot drift.
  useEffect(() => {
    if (!isRecording) return;
    const intervalId = window.setInterval(() => {
      const session = sessionRef.current;
      if (session) setElapsed((performance.now() - session.startedAt) / 1000);
    }, 100);
    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  // Once both the tracker and camera are up, check this device can track in
  // real time (and compile the GPU shaders before the first recording).
  useEffect(() => {
    const video = webcamRef.current?.video;
    if (trackerStatus !== "calibrating" || !cameraReady || !video) return;

    const run = () => void calibrate(video);
    if (video.readyState >= 2) {
      run();
      return;
    }
    video.addEventListener("loadeddata", run, { once: true });
    return () => video.removeEventListener("loadeddata", run);
  }, [calibrate, cameraReady, trackerStatus]);

  const showError = useCallback((message: string) => {
    if (!mountedRef.current) return;
    setResult(null);
    setErrorMessage(message);
    setPhase("error");
  }, []);

  const runTrackingLoop = useCallback(
    async (session: RecordingSession, video: HTMLVideoElement) => {
      const tracker = trackerRef.current;
      if (!tracker) return;

      // Let the between-recordings preview finish its last frame first.
      await previewLoopRef.current;
      tracker.reset();
      let slowFrames = 0;
      while (session.active) {
        await nextVideoFrame(video);
        if (!session.active) break;

        let frame: LandmarkFrame | null;
        const startedAt = performance.now();
        try {
          frame = await tracker.process(video);
        } catch (error) {
          console.warn("[SignEase] Hand tracking failed during recording", error);
          session.trackerFailed = true;
          disableTracker("hand tracking failed during recording");
          break;
        }

        // Stop tracking if the device cannot keep up (e.g. thermal
        // throttling), so the preview and the recorder stay smooth.
        slowFrames = performance.now() - startedAt > SLOW_FRAME_MS * 2 ? slowFrames + 1 : 0;
        if (slowFrames >= 3) {
          session.trackerTooSlow = true;
          disableTracker("hand tracking slowed down during recording");
          break;
        }
        if (!frame || !session.active) continue;

        session.trackedFrames += 1;
        if (frame.hasHands) {
          if (session.handFrames.length === 0 && mountedRef.current) setSigningStarted(true);
          session.lastHandAt = startedAt;
        } else if (
          session.handFrames.length >= AUTO_STOP_MIN_HAND_FRAMES &&
          startedAt - session.lastHandAt > AUTO_STOP_HANDS_GONE_MS
        ) {
          // The hands were lowered after signing: stop instead of making
          // the user wait for the timer (the idle tail only adds noise).
          session.autoStopped = true;
          void finishRecordingRef.current();
          break;
        }
        // Timestamps must strictly increase for the server's resampling.
        const lastTime = session.handFrameTimes[session.handFrameTimes.length - 1] ?? -Infinity;
        if (
          frame.hasHands &&
          session.handFrames.length < MAX_LANDMARK_FRAMES &&
          startedAt > lastTime
        ) {
          session.handFrames.push(frame.values);
          session.handFrameTimes.push(startedAt);
        }
        if (mountedRef.current) {
          setHandsVisible(frame.hasHands);
          drawHands(overlayRef.current, video, [frame.leftHand, frame.rightHand]);
        }
      }
    },
    [disableTracker, trackerRef]
  );

  const finishRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || !session.active) return;

    session.active = false;
    if (session.stopTimer) window.clearTimeout(session.stopTimer);
    if (session.recorder?.state === "recording") session.recorder.stop();

    const recordedSeconds = Math.max(0.5, (performance.now() - session.startedAt) / 1000);
    setPhase("processing");
    setElapsed(0);
    setHandsVisible(false);
    clearCanvas(overlayRef.current);

    // A frame already being tracked finishes in well under a second.
    await withTimeout(session.trackingLoop, 3000, undefined);
    const videoBlob = await withTimeout(session.recorderStopped, 3000, null);
    if (session.abort.signal.aborted || !mountedRef.current) return;

    const trackedFps = session.trackedFrames / recordedSeconds;
    console.info("[SignEase] Recording captured", {
      seconds: Math.round(recordedSeconds * 10) / 10,
      trackedFrames: session.trackedFrames,
      handFrames: session.handFrames.length,
      trackedFps: Math.round(trackedFps * 10) / 10,
      videoBytes: videoBlob?.size ?? 0,
    });
    const trackingUsable =
      !!session.trackingLoop &&
      !session.trackerFailed &&
      !session.trackerTooSlow &&
      trackedFps >= MIN_TRACKED_FPS;
    const timeoutId = window.setTimeout(() => session.abort.abort(), PREDICTION_TIMEOUT_MS);

    try {
      let response: PredictionResponse;
      let mode: PredictionMode;

      const enoughHandFrames = session.handFrames.length >= MIN_HAND_FRAMES;

      if (trackingUsable && !enoughHandFrames) {
        // Tracking ran at a good rate and barely saw a hand; uploading the
        // clip would only produce the same answer, slower.
        showError("No hands detected. Keep at least one hand clearly visible in the frame and try again.");
        return;
      } else if (enoughHandFrames && (trackingUsable || !videoBlob)) {
        mode = "on-device";
        const landmarkHeaders = {
          "Content-Type": "application/octet-stream",
          "X-Frame-Count": String(session.handFrames.length),
          // Landmarks are fractions of the frame size, so the server
          // needs the frame shape to undo the stretching.
          "X-Frame-Aspect": session.frameAspect.toFixed(4),
        };
        try {
          response = await requestPrediction(
            "/predict-landmarks",
            packFrames(session.handFrames, session.handFrameTimes),
            {
              signal: session.abort.signal,
              headers: { ...landmarkHeaders, "X-Landmark-Layout": COMPACT_LAYOUT },
              onRetry: setRetryNotice,
            }
          );
        } catch (error) {
          // A server deployed before the compact layout rejects it as a
          // malformed upload; send full frames instead.
          if (!(error instanceof PredictionError) || error.status !== 400) throw error;
          response = await requestPrediction(
            "/predict-landmarks",
            packFullFrames(session.handFrames, session.handFrameTimes),
            { signal: session.abort.signal, headers: landmarkHeaders, onRetry: setRetryNotice }
          );
        }
      } else if (videoBlob) {
        // Hand tracking was unavailable or too slow on this device.
        mode = "server";
        const formData = new FormData();
        formData.append("video", videoBlob, `sign_${Date.now()}.${getRecordingExtension(videoBlob.type)}`);
        response = await requestPrediction("/predict", formData, {
          signal: session.abort.signal,
          onRetry: setRetryNotice,
        });
      } else {
        showError(
          session.trackingLoop
            ? "Not enough of the sign was captured. Keep your hands in the frame and try a slightly longer recording."
            : "This browser could not record the camera. Please try a recent version of Chrome, Edge, Firefox or Safari."
        );
        return;
      }

      if (response.timing) {
        console.info("[SignEase] Prediction timing", mode, response.timing);
      }
      if (!mountedRef.current) return;

      const ranked = (response.predictions || []).map(displayPrediction);
      if (ranked[0]) response = { ...response, sign: ranked[0].sign };
      const alternatives = ranked.filter((prediction) => prediction.sign !== response.sign);
      setResult({ sign: response.sign, confidence: response.confidence, alternatives, mode });
      setErrorMessage("");
      setPhase("result");

      const target = practiceTargetRef.current;
      const matched = !!target && response.sign === target.name;
      historyIdRef.current += 1;
      const entry: HistoryEntry = {
        id: historyIdRef.current,
        sign: response.sign,
        confidence: response.confidence,
        matched,
      };
      setHistory((entries) => [...entries, entry].slice(-MAX_HISTORY));

      if (target) {
        const close = !matched && alternatives.some((alternative) => alternative.sign === target.name);
        setPracticeOutcome(matched ? "match" : close ? "close" : "miss");
        setPracticeAttempts((value) => value + 1);
        if (matched) {
          setPracticeMatched((value) => value + 1);
          setCelebrationKey((value) => value + 1);
          setStreak((value) => {
            const next = value + 1;
            setBestStreak((best) => {
              if (next <= best) return best;
              writeStorage(BEST_STREAK_KEY, String(next));
              return next;
            });
            return next;
          });
          speak(`Great job! That was ${formatSign(target.name)}`);
        } else {
          setStreak(0);
          speak(
            close
              ? `So close! I saw ${formatSign(response.sign)}. Try ${formatSign(target.name)} again`
              : `I saw ${formatSign(response.sign)}. Watch the demo and try again`
          );
        }
      } else {
        if (response.confidence >= 0.8) setCelebrationKey((value) => value + 1);
        speak(
          response.confidence >= LOW_CONFIDENCE
            ? `Predicted sign is ${formatSign(response.sign)}`
            : `Possibly ${formatSign(response.sign)}`
        );
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (mountedRef.current) showError("Prediction timed out. Please try again.");
        return;
      }
      console.error("[SignEase] Prediction failed", error);
      showError(
        error instanceof PredictionError
          ? error.message
          : "Something went wrong while processing the recording. Please try again."
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (mountedRef.current) setRetryNotice("");
      if (sessionRef.current === session) sessionRef.current = null;
    }
  }, [showError, speak]);

  const beginRecording = useCallback(
    () => {
      if (trackerStatus === "loading" || trackerStatus === "calibrating") {
        setPhase("idle");
        return;
      }

      const video = webcamRef.current?.video;
      const stream = video?.srcObject;
      if (!video || !(stream instanceof MediaStream) || video.readyState < 2) {
        showError("The camera is not ready yet. Allow camera access and try again.");
        return;
      }

      speechSynthesisRef.current?.cancel();
      setIsSpeaking(false);

      const { recorder, stopped } = startRecorder(stream);
      setSigningStarted(false);
      const session: RecordingSession = {
        active: true,
        lastHandAt: 0,
        autoStopped: false,
        startedAt: performance.now(),
        handFrames: [],
        handFrameTimes: [],
        frameAspect: video.videoWidth / video.videoHeight,
        trackedFrames: 0,
        trackerFailed: false,
        trackerTooSlow: false,
        trackingLoop: null,
        recorder,
        recorderStopped: stopped,
        stopTimer: null,
        abort: new AbortController(),
      };
      sessionRef.current = session;

      if (trackerStatus === "ready" && trackerRef.current) {
        session.trackingLoop = runTrackingLoop(session, video);
      } else if (!recorder) {
        sessionRef.current = null;
        showError("This browser cannot record video. Please try a recent version of Chrome, Edge, Firefox or Safari.");
        return;
      }

      session.stopTimer = window.setTimeout(() => void finishRecording(), duration * 1000);
      setResult(null);
      setErrorMessage("");
      setElapsed(0);
      setPracticeOutcome(null);
      setPhase("recording");
    },
    [duration, finishRecording, runTrackingLoop, showError, trackerRef, trackerStatus]
  );
  finishRecordingRef.current = finishRecording;
  const beginRecordingRef = useRef(beginRecording);
  beginRecordingRef.current = beginRecording;

  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
    setCountdown(null);
    setPhase((current) => (current === "countdown" ? "idle" : current));
  }, []);

  const startRecording = useCallback(() => {
    if (isBusy || trackerStatus === "loading" || trackerStatus === "calibrating" || !cameraReady) return;

    speechSynthesisRef.current?.cancel();
    setIsSpeaking(false);
    if (!useCountdown) {
      beep(880, 160);
      beginRecordingRef.current();
      return;
    }

    // A short countdown gives time to get the hands into position, so the
    // recording starts on the sign instead of on raising the hands.
    let remaining = COUNTDOWN_SECONDS;
    setResult(null);
    setErrorMessage("");
    setPracticeOutcome(null);
    setCountdown(remaining);
    setPhase("countdown");
    beep(587);
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        beep(587);
        return;
      }
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(null);
      beep(880, 200);
      beginRecordingRef.current();
    }, 1000);
  }, [cameraReady, isBusy, trackerStatus, useCountdown]);

  const toggleCountdown = () => {
    setUseCountdown((value) => {
      writeStorage(COUNTDOWN_PREFERENCE_KEY, value ? "off" : "on");
      return !value;
    });
  };

  const nextPracticeSign = useCallback(() => {
    setPracticeIndex((index) => index + 1);
    setPracticeOutcome(null);
    setResult(null);
    setErrorMessage("");
    setPhase((current) => (current === "result" || current === "error" ? "idle" : current));
  }, []);

  const switchMode = (next: Mode) => {
    if (isBusy || next === mode) return;
    setMode(next);
    setPracticeOutcome(null);
    setResult(null);
    setErrorMessage("");
    setPhase("idle");
  };

  const speakHistory = () => {
    if (history.length) speak(history.map((entry) => formatSign(entry.sign)).join(" "));
  };

  // Between recordings, track at a low rate to show the hands live and check
  // the framing; faster during the countdown, when the user is getting ready.
  useEffect(() => {
    if (trackerStatus !== "ready" || !cameraReady) return;
    if (phase === "recording" || phase === "processing") return;
    const video = webcamRef.current?.video;
    const tracker = trackerRef.current;
    if (!video || !tracker) return;

    let stopped = false;
    const intervalMs = phase === "countdown" ? COUNTDOWN_PREVIEW_INTERVAL_MS : PREVIEW_INTERVAL_MS;
    const loop = async () => {
      while (!stopped) {
        if (document.visibilityState === "visible" && video.readyState >= 2 && video.videoHeight) {
          let frame: LandmarkFrame | null = null;
          try {
            frame = await tracker.process(video);
          } catch {
            return;
          }
          if (stopped) return;
          if (frame) {
            setFraming(analyzeFraming(frame.values, video.videoWidth / video.videoHeight));
            setHandsVisible(frame.hasHands);
            drawHands(overlayRef.current, video, [frame.leftHand, frame.rightHand]);
          }
        }
        await sleep(intervalMs);
      }
    };
    previewLoopRef.current = loop();

    return () => {
      stopped = true;
    };
  }, [cameraReady, phase, trackerRef, trackerStatus]);

  // Space starts a recording (or stops / cancels one) from anywhere on the
  // page, including while a button has focus after being clicked.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      if (event.repeat) return;
      if (phase === "countdown") cancelCountdown();
      else if (phase === "recording") void finishRecording();
      else startRecording();
    };
    // A focused button "clicks" on Space keyup; cancel that so the key does
    // not also press whatever button was clicked last.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTypingTarget(event.target) && !document.querySelector('[role="dialog"]')) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [cancelCountdown, finishRecording, phase, startRecording]);

  const resetResult = () => {
    setResult(null);
    setErrorMessage("");
    setPracticeOutcome(null);
    setPhase("idle");
  };

  const handleCameraError = useCallback((error: string | DOMException) => {
    const name = typeof error === "string" ? error : error.name;
    setCameraReady(false);
    setCameraError(
      name === "NotAllowedError" || name === "SecurityError"
        ? "Camera access was blocked. Allow camera access in your browser's site settings, then retry."
        : name === "NotFoundError" || name === "OverconstrainedError"
          ? "No camera was found. Connect a camera and retry."
          : name === "NotReadableError"
            ? "The camera is in use by another application. Close it and retry."
            : "The camera could not be started. Please retry."
    );
  }, []);

  const retryCamera = () => {
    setCameraError("");
    setCameraKey((key) => key + 1);
  };

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

  const practiceCard = practiceTarget ? (
    <PracticeCard
      target={practiceTarget}
      outcome={practiceOutcome}
      streak={streak}
      bestStreak={bestStreak}
      matched={practiceMatched}
      attempts={practiceAttempts}
      disabled={isBusy}
      onNext={nextPracticeSign}
    />
  ) : null;

  const shownSeconds = Math.min(duration, Math.floor(elapsed));
  const confidencePercent = result ? Math.round(result.confidence * 1000) / 10 : 0;
  const trackerPreparing = trackerStatus === "loading" || trackerStatus === "calibrating";
  const startDisabled = isBusy || trackerPreparing || !cameraReady;

  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-[#030303]",
        inter.variable,
        pacifico.variable
      )}
    >
      <Head>
        <title>Sign Detection | SignEase</title>
        <meta
          name="description"
          content="Record a sign with your webcam and get an instant AI prediction."
        />
      </Head>

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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0)_60%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20" />
        </div>
      </div>

      {/* Add geometric shapes for visual consistency */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
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

          <div className="relative z-10 flex items-center justify-between w-full px-4 sm:px-6 min-h-[72px] sm:min-h-[80px] py-3 sm:py-4 gap-4">
            <motion.div
              custom={0}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-4 shrink-0"
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
                    "text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 ml-3 leading-relaxed tracking-wide overflow-visible py-2",
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
              className="flex gap-3 sm:gap-4 text-sm sm:text-base text-white/90"
            >
              {[
                { href: "/", label: "Home", mobile: true },
                { href: "/dictionary", label: "Dictionary", mobile: true },
                { href: "/#technology", label: "Technology", mobile: false },
                { href: "/#team", label: "Team", mobile: false },
                { href: "/#contact", label: "Contact", mobile: false },
              ].map((link) => (
                <motion.div
                  key={link.href}
                  whileHover={{ scale: 1.05, color: "#818cf8" }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  className={link.mobile ? undefined : "hidden md:block"}
                >
                  <Link href={link.href} className="hover:text-indigo-400 transition-all">
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </nav>

        {/* Main content */}
        <main className="relative py-8 px-4">
          <div className="container mx-auto px-0 sm:px-4">
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
                  className="text-4xl sm:text-6xl md:text-7xl font-bold mb-4"
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
                {speechBlocked && !isSpeaking && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 mb-2"
                  >
                    <button
                      type="button"
                      onClick={handleManualSpeech}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 rounded-full border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
                    >
                      <IoVolumeHigh className="text-lg text-indigo-300" />
                      <span className="text-sm text-white/90">Play Instructions</span>
                    </button>
                  </motion.div>
                )}

                {/* Speaking indicator while speech is playing */}
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
                    <span className="text-sm text-white/80">Speaking…</span>
                    <button
                      type="button"
                      onClick={skipSpeech}
                      className="ml-2 text-xs text-white/60 hover:text-white/90"
                    >
                      Skip
                    </button>
                  </motion.div>
                )}
              </motion.div>

              {/* Main interaction area */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="w-full max-w-5xl mx-auto"
              >
                <motion.div
                  className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl"
                  whileHover={{ boxShadow: "0 0 25px rgba(255,255,255,0.08)" }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                    <div
                      role="tablist"
                      aria-label="Detection mode"
                      className="relative grid grid-cols-2 rounded-full border border-white/10 bg-black/30 p-1"
                    >
                      {([
                        { value: "free", label: "Free signing", icon: <FaMagic /> },
                        { value: "practice", label: "Practice challenge", icon: <FaGraduationCap /> },
                      ] as const).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="tab"
                          aria-selected={mode === option.value}
                          disabled={isBusy || (option.value === "practice" && practiceSigns.length === 0)}
                          onClick={() => switchMode(option.value)}
                          className={cn(
                            "relative z-10 flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                            mode === option.value ? "text-white" : "text-white/60 hover:text-white/90"
                          )}
                        >
                          {mode === option.value && (
                            <motion.span
                              layoutId="mode-pill"
                              className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500/80 to-rose-500/80"
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                          )}
                          {option.icon}
                          <span className="whitespace-nowrap">{option.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="hidden items-center gap-2 text-xs text-white/40 sm:flex">
                      <FaKeyboard /> Press
                      <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 font-sans text-[11px] text-white/70">
                        Space
                      </kbd>
                      to start or stop
                    </p>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-8">
                    {/* Webcam section with enhanced styling */}
                    <div className="flex-1 min-w-0 relative">
                      {/* On phones the challenge sits above the camera so it stays in view. */}
                      {practiceTarget && isNarrow && practiceCard}
                      <motion.div
                        className="rounded-xl overflow-hidden relative aspect-video bg-gradient-to-br from-black/30 to-black/10 border border-white/10"
                        whileHover={{ borderColor: "rgba(255,255,255,0.2)" }}
                        transition={{ duration: 0.3 }}
                      >
                        <Webcam
                          key={cameraKey}
                          audio={false}
                          ref={webcamRef}
                          videoConstraints={VIDEO_CONSTRAINTS}
                          onUserMedia={() => {
                            setCameraError("");
                            setCameraReady(true);
                          }}
                          onUserMediaError={handleCameraError}
                          playsInline
                          muted
                          className="w-full h-full object-cover rounded-lg"
                          style={{ transform: "scaleX(-1)" }}
                        />
                        {/* Live hand landmarks, mirrored like the preview */}
                        <canvas
                          ref={overlayRef}
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity",
                            trackerStatus === "ready" && phase !== "processing" ? "opacity-100" : "opacity-0"
                          )}
                          style={{ transform: "scaleX(-1)" }}
                        />

                        {!cameraReady && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-black/60">
                            {cameraError ? (
                              <>
                                <FaExclamationTriangle className="text-3xl text-amber-400" />
                                <p className="text-sm text-white/80 max-w-sm">{cameraError}</p>
                                <Button
                                  type="button"
                                  onClick={retryCamera}
                                  variant="outline"
                                  className="bg-white/5 hover:bg-white/10 border-white/10 text-white rounded-full"
                                >
                                  <IoRefreshOutline className="mr-2" /> Retry camera
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="w-10 h-10 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                                <p className="text-sm text-white/70">Waiting for camera access…</p>
                              </>
                            )}
                          </div>
                        )}

                        {isCountingDown && countdown !== null && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                            <motion.span
                              key={countdown}
                              initial={{ scale: 1.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 260, damping: 18 }}
                              className="text-8xl font-bold text-white drop-shadow-[0_0_30px_rgba(129,140,248,0.6)] tabular-nums"
                            >
                              {countdown}
                            </motion.span>
                            <p className="mt-3 text-sm text-white/80">
                              {practiceTarget
                                ? `Get ready to sign “${formatSign(practiceTarget.name)}”`
                                : "Get your hands ready"}
                            </p>
                            {framing !== "unknown" && framing !== null && (
                              <p className="mt-2 rounded-full bg-amber-500/25 px-3 py-1 text-xs text-amber-100">
                                {FRAMING_ADVICE[framing]}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Framing guide between recordings */}
                        {cameraReady && trackerStatus === "ready" && !isRecording && !isCountingDown &&
                          phase !== "processing" && framing !== "unknown" && (
                          <div
                            className={cn(
                              "absolute bottom-3 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md",
                              framing === null
                                ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-100"
                                : "border-amber-400/30 bg-amber-500/25 text-amber-100"
                            )}
                          >
                            {framing === null ? (
                              <>
                                <FaCheckCircle className="shrink-0" /> Good framing
                                {handsVisible ? ", hands tracked" : ""}
                              </>
                            ) : (
                              <>
                                <FaExclamationTriangle className="shrink-0" /> {FRAMING_ADVICE[framing]}
                              </>
                            )}
                          </div>
                        )}

                        {/* Enhanced overlay elements */}
                        {isRecording && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
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
                              <span className="font-medium tabular-nums">
                                {shownSeconds}s / {duration}s
                              </span>
                            </motion.div>
                            {trackerStatus === "ready" && (
                              <div
                                className={cn(
                                  "absolute top-4 left-4 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-medium flex items-center gap-2",
                                  handsVisible
                                    ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-200"
                                    : "bg-amber-500/20 border-amber-400/30 text-amber-200"
                                )}
                              >
                                <FaHandPaper />
                                {handsVisible ? "Hands tracked" : "Show your hands"}
                              </div>
                            )}
                            <div className="absolute bottom-9 left-0 right-0 mx-auto flex justify-center px-4">
                              <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md">
                                {trackerStatus !== "ready"
                                  ? "Sign now"
                                  : !signingStarted
                                    ? "Sign now ✋"
                                    : "Lower your hands when you're done"}
                              </span>
                            </div>
                            <div className="absolute bottom-4 left-0 right-0 mx-auto w-3/4 h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full transition-[width] duration-100 ease-linear"
                                style={{ width: `${Math.min(100, (elapsed / duration) * 100)}%` }}
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

                      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-white/50" aria-live="polite">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            trackerStatus === "ready"
                              ? "bg-emerald-400"
                              : trackerPreparing
                                ? "bg-amber-400 animate-pulse"
                                : "bg-sky-400"
                          )}
                        />
                        {trackerLabel(trackerStatus)}
                        <span className="text-white/20">•</span>
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            backendStatus === "ready"
                              ? "bg-emerald-400"
                              : backendStatus === "waking"
                                ? "bg-amber-400 animate-pulse"
                                : "bg-rose-400"
                          )}
                        />
                        {backendStatus === "ready"
                          ? "Server ready"
                          : backendStatus === "waking"
                            ? "Waking up server…"
                            : "Server unreachable, retrying…"}
                      </div>

                      <div className="mt-5 flex flex-wrap justify-center gap-4">
                        {isCountingDown ? (
                          <Button
                            type="button"
                            onClick={cancelCountdown}
                            variant="outline"
                            className="bg-white/5 hover:bg-white/10 border-white/20 text-white px-8 py-6 rounded-full"
                          >
                            Cancel countdown
                          </Button>
                        ) : !isRecording ? (
                          <motion.div
                            whileHover={startDisabled ? undefined : { scale: 1.05 }}
                            whileTap={startDisabled ? undefined : { scale: 0.95 }}
                            animate={startDisabled ? undefined : pulseAnimation}
                          >
                            <Button
                              type="button"
                              onClick={startRecording}
                              disabled={startDisabled}
                              className="bg-gradient-to-r from-indigo-500 to-rose-500 hover:opacity-90 text-white transition-all flex items-center gap-3 px-8 py-6 rounded-full shadow-lg shadow-indigo-500/20"
                            >
                              <FaCamera className="text-lg" />
                              <span className="text-base font-medium capitalize">
                                {phase === "processing"
                                  ? "Analyzing…"
                                  : trackerPreparing && cameraReady
                                    ? "Preparing…"
                                    : practiceTarget
                                      ? `Sign “${formatSign(practiceTarget.name)}”`
                                      : "Start Recording"}
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
                              type="button"
                              onClick={() => void finishRecording()}
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
                            type="button"
                            onClick={resetResult}
                            variant="outline"
                            className="bg-white/5 hover:bg-white/10 border-white/10 text-white px-6 py-6 rounded-full"
                            disabled={isBusy}
                          >
                            <IoRefreshOutline className="text-lg mr-2" /> Reset
                          </Button>
                        </motion.div>
                      </div>

                      <div className="mt-8">
                        <div className="flex items-center justify-between mb-3">
                          <label id="recording-duration-label" className="text-white/70 text-sm font-medium">
                            {trackerStatus === "ready" ? "Maximum recording time" : "Recording Duration"}
                          </label>
                          <span className="text-white/90 font-medium px-3 py-1 bg-white/5 rounded-full tabular-nums">
                            {duration} {duration === 1 ? "second" : "seconds"}
                          </span>
                        </div>
                        <Slider
                          value={[duration]}
                          onValueChange={(value) => setDuration(value[0] ?? DEFAULT_RECORDING_DURATION)}
                          max={MAX_RECORDING_DURATION}
                          min={MIN_RECORDING_DURATION}
                          step={1}
                          disabled={isBusy}
                          aria-labelledby="recording-duration-label"
                          className="relative z-10"
                        />
                        {trackerStatus === "ready" && (
                          <p className="mt-2 text-xs text-white/40">
                            Recording stops by itself when you lower your hands after the sign.
                          </p>
                        )}
                        <label className="mt-5 flex cursor-pointer items-center justify-between gap-3 text-sm text-white/70">
                          <span>
                            {COUNTDOWN_SECONDS}-second countdown before recording
                            <span className="block text-xs text-white/40">
                              Time to get your hands into position
                            </span>
                          </span>
                          <Switch
                            checked={useCountdown}
                            onCheckedChange={toggleCountdown}
                            disabled={isBusy}
                            className="data-[state=checked]:bg-indigo-500 data-[state=unchecked]:bg-white/15"
                          />
                        </label>
                      </div>

                      <div className="mt-12 pt-4 border-t border-white/10">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                          className="flex justify-center"
                        >
                          <Link href="/dictionary" className="max-w-full">
                            <PixelCard
                              variant="pink"
                              className="h-[120px] w-[320px] max-w-full cursor-pointer hover:scale-[1.02] transition-transform"
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

                    {/* Result section */}
                    <div className="flex-1 min-w-0 flex flex-col lg:border-l lg:border-white/10 lg:pl-8">
                      {practiceTarget && !isNarrow && practiceCard}
                      <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 mb-6">
                        Recognition Results
                      </h3>

                      <div className="flex-1 flex flex-col">
                        <div
                          className="relative bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 h-full min-h-[280px] flex flex-col"
                          aria-live="polite"
                        >
                          {phase === "result" && celebrationKey > 0 && (
                            <Celebration key={celebrationKey} />
                          )}
                          {phase === "countdown" ? (
                            <div className="flex-1 flex items-center justify-center flex-col text-center">
                              <FaHandPaper className="text-4xl text-indigo-300/80 animate-bounce" />
                              <p className="mt-5 text-white/70">Recording starts in {countdown}…</p>
                              <p className="mt-2 text-xs text-white/40">Start signing when the timer turns red</p>
                            </div>
                          ) : phase === "recording" ? (
                            <div className="flex-1 flex items-center justify-center flex-col">
                              <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                              <motion.p
                                className="mt-6 text-white/60"
                                animate={{ opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              >
                                Recording in progress…
                              </motion.p>
                            </div>
                          ) : phase === "processing" ? (
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
                                  className="absolute inset-0 rounded-full border-4 border-transparent border-t-rose-500 border-r-rose-500/50"
                                  animate={{ rotate: [0, 360] }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                ></motion.div>
                              </div>
                              <motion.p
                                className="mt-6 text-white/60"
                                animate={{ opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              >
                                AI model processing…
                              </motion.p>
                              {retryNotice && (
                                <p className="mt-3 max-w-xs text-center text-xs text-sky-200/80">{retryNotice}</p>
                              )}
                              {backendStatus !== "ready" && !retryNotice && (
                                <p className="mt-3 max-w-xs text-center text-xs text-amber-200/80">
                                  The prediction server is waking up after being idle. This first
                                  result can take up to a minute; the next ones are instant.
                                </p>
                              )}
                            </div>
                          ) : phase === "error" ? (
                            <motion.div
                              className="flex-1 flex flex-col items-center justify-center text-center"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.4 }}
                            >
                              <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                                <FaExclamationTriangle className="text-3xl text-amber-400" />
                              </div>
                              <h4 className="text-xl font-medium text-white/90 mb-2">
                                Couldn&apos;t recognize the sign
                              </h4>
                              <p className="text-white/60 max-w-md text-sm">{errorMessage}</p>
                            </motion.div>
                          ) : phase === "result" && result ? (
                            <motion.div
                              className="flex-1 flex flex-col items-center justify-center text-center"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5 }}
                            >
                              {practiceOutcome && practiceTarget && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  className={cn(
                                    "mb-5 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                                    practiceOutcome === "match"
                                      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                                      : practiceOutcome === "close"
                                        ? "border-sky-400/30 bg-sky-500/10 text-sky-100"
                                        : "border-amber-400/30 bg-amber-500/10 text-amber-100"
                                  )}
                                >
                                  {practiceOutcome === "match" ? (
                                    <>
                                      <FaCheckCircle /> Nailed it! +1 streak
                                    </>
                                  ) : practiceOutcome === "close" ? (
                                    <>So close: “{formatSign(practiceTarget.name)}” was a runner-up</>
                                  ) : (
                                    <>Not quite: watch the demo and try again</>
                                  )}
                                </motion.div>
                              )}
                              <motion.button
                                type="button"
                                onClick={() => speak(`Predicted sign is ${formatSign(result.sign)}`)}
                                aria-label={`Speak ${formatSign(result.sign)}`}
                                className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-rose-500/20 flex items-center justify-center mb-6 hover:from-indigo-500/30 hover:to-rose-500/30 transition-colors"
                                animate={{
                                  boxShadow: [
                                    "0 0 0 rgba(255,255,255,0)",
                                    "0 0 25px rgba(129, 140, 248, 0.3)",
                                    "0 0 0 rgba(255,255,255,0)"
                                  ]
                                }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <IoVolumeHigh className="text-4xl text-white/90" />
                              </motion.button>

                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="space-y-6 w-full"
                              >
                                <h3
                                  className={cn(
                                    "text-4xl font-bold text-white capitalize break-words",
                                    pacifico.className
                                  )}
                                >
                                  {formatSign(result.sign)}
                                </h3>

                                <div className="flex flex-col items-center">
                                  <p className="text-white/60 text-sm mb-2">
                                    Confidence Level
                                  </p>
                                  <div className="w-full h-3 bg-white/10 rounded-full mt-1 mb-2 overflow-hidden">
                                    <motion.div
                                      className="h-full bg-gradient-to-r from-indigo-500 to-rose-500"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${confidencePercent}%` }}
                                      transition={{
                                        duration: 0.8,
                                        ease: "easeOut",
                                      }}
                                    ></motion.div>
                                  </div>
                                  <p className="text-white/90 font-medium px-4 py-1 bg-white/5 rounded-full tabular-nums">
                                    {confidencePercent.toFixed(1)}%
                                  </p>
                                  {result.confidence < LOW_CONFIDENCE && (
                                    <p className="mt-3 text-xs text-amber-300/90 max-w-xs">
                                      Low confidence. Try again with your hands fully in frame and the sign performed clearly.
                                    </p>
                                  )}
                                </div>

                                {result.alternatives.length > 0 && (
                                  <div className="text-sm">
                                    <p className="text-white/50 mb-2">Other possibilities</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                      {result.alternatives.map((alternative) => (
                                        <span
                                          key={alternative.sign}
                                          className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 capitalize"
                                        >
                                          {formatSign(alternative.sign)}{" "}
                                          <span className="text-white/40 tabular-nums">
                                            {(alternative.confidence * 100).toFixed(1)}%
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center justify-center gap-4">
                                  {practiceOutcome === "match" && (
                                    <Button
                                      type="button"
                                      onClick={nextPracticeSign}
                                      className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-white hover:opacity-90"
                                    >
                                      Next challenge <FaArrowRight className="ml-2 text-xs" />
                                    </Button>
                                  )}
                                  <Link
                                    href={`/dictionary?query=${encodeURIComponent(result.sign)}`}
                                    className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200"
                                  >
                                    See how to sign it <FaArrowRight className="text-xs" />
                                  </Link>
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
                              <h4 className="text-xl font-medium text-white/80 mb-3">
                                {practiceTarget ? "Ready when you are" : "No Sign Detected"}
                              </h4>
                              <p className="mt-2 text-white/50 max-w-md">
                                {practiceTarget
                                  ? `Watch the demo above, then press the button and sign “${formatSign(practiceTarget.name)}”.`
                                  : "Make a sign gesture in front of the camera and click \"Start Recording\" to begin."}
                              </p>
                              {!practiceTarget && practiceSigns.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => switchMode("practice")}
                                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-100 transition-colors hover:bg-indigo-500/20"
                                >
                                  <FaGraduationCap /> Not sure what to sign? Try a challenge
                                </button>
                              )}
                            </motion.div>
                          )}
                        </div>

                        <SessionHistory
                          entries={history}
                          onSpeakAll={speakHistory}
                          onClear={() => setHistory([])}
                          lowConfidence={LOW_CONFIDENCE}
                        />

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
                            {[
                              "Sit back so your head, chest and stomach are in view: many signs are made low, and the green \"Good framing\" badge tells you when you're set",
                              `Use the slider to adjust the recording duration (${MIN_RECORDING_DURATION}-${MAX_RECORDING_DURATION} seconds)`,
                              'Click "Start Recording" (or press Space); a short countdown gives you time to get ready',
                              "Do the sign, then lower your hands: the recording stops by itself",
                              "Your sign language translation appears right after recording",
                              'Not sure what to sign? Switch to "Practice challenge", copy the demo and build a streak',
                            ].map((step, index) => (
                              <motion.li
                                key={step}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
                              >
                                {step}
                              </motion.li>
                            ))}
                          </ol>

                          <div className="mt-3 p-2 bg-indigo-500/10 rounded-lg">
                            <p className="text-xs text-indigo-300/80">
                              <strong>Tip:</strong> For best results, ensure
                              good lighting and perform clear, deliberate
                              gestures
                            </p>
                          </div>
                        </motion.div>
                        {hasPlayedWelcome && !speechBlocked && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1, duration: 0.5 }}
                            className="mt-4 text-center"
                          >
                            <button
                              type="button"
                              onClick={handleManualSpeech}
                              disabled={isSpeaking}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-indigo-200 transition-colors text-xs disabled:opacity-50"
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
                  Hand, face and pose landmarks are tracked on your device with
                  MediaPipe, and a neural network trained on 250 ASL signs
                  turns the motion into a prediction.
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
};

export default SignDetection;
