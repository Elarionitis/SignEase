import type {
  Holistic as HolisticSolution,
  NormalizedLandmarkList,
  Options,
  Results,
} from "@mediapipe/holistic";

/**
 * In-browser MediaPipe Holistic, producing the same 543-landmark frames the
 * sign model was trained on (Google ISLR / Kaggle "asl-signs" layout).
 *
 * The runtime is copied into /public by scripts/copy-mediapipe.js and loaded
 * with a <script> tag: the package is a closure-compiled global script that
 * does not survive being bundled by webpack.
 */

const ASSET_BASE = "/mediapipe/holistic";

export const ROWS_PER_FRAME = 543;
export const FRAME_VALUES = ROWS_PER_FRAME * 3;

// Row order of each training frame: face, left hand, pose, right hand.
const LAYOUT: ReadonlyArray<[keyof Results, number]> = [
  ["faceLandmarks", 468],
  ["leftHandLandmarks", 21],
  ["poseLandmarks", 33],
  ["rightHandLandmarks", 21],
];

// Matches the Python `mp.solutions.holistic.Holistic()` defaults used to
// build the training set (and the backend's video fallback).
const HOLISTIC_OPTIONS: Options = {
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  refineFaceLandmarks: false,
  selfieMode: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

declare global {
  interface Window {
    Holistic?: new (config: { locateFile: (file: string) => string }) => HolisticSolution;
  }
}

export interface LandmarkFrame {
  values: Float32Array;
  hasHands: boolean;
  leftHand?: NormalizedLandmarkList;
  rightHand?: NormalizedLandmarkList;
}

export interface HolisticTracker {
  /** Runs Holistic on the current video frame. Calls are serialised. */
  process(video: HTMLVideoElement): Promise<LandmarkFrame | null>;
  /** Clears tracking state so the next recording starts fresh. */
  reset(): void;
}

let scriptPromise: Promise<void> | null = null;
let trackerPromise: Promise<HolisticTracker> | null = null;

function loadScript(src: string) {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.Holistic) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

function supportsWebGL2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

function toFrame(results: Results): LandmarkFrame {
  const values = new Float32Array(FRAME_VALUES).fill(Number.NaN);
  let row = 0;

  for (const [key, count] of LAYOUT) {
    const landmarks = results[key] as NormalizedLandmarkList | undefined;
    if (landmarks && landmarks.length >= count) {
      for (let i = 0; i < count; i += 1) {
        const point = landmarks[i];
        const offset = (row + i) * 3;
        values[offset] = point.x;
        values[offset + 1] = point.y;
        values[offset + 2] = point.z;
      }
    }
    row += count;
  }

  return {
    values,
    hasHands: !!(results.leftHandLandmarks?.length || results.rightHandLandmarks?.length),
    leftHand: results.leftHandLandmarks,
    rightHand: results.rightHandLandmarks,
  };
}

async function createTracker(): Promise<HolisticTracker> {
  if (!supportsWebGL2()) {
    throw new Error("WebGL2 is not available in this browser");
  }

  await loadScript(`${ASSET_BASE}/holistic.js`);
  if (!window.Holistic) {
    throw new Error("MediaPipe Holistic did not register");
  }

  const holistic = new window.Holistic({
    locateFile: (file) => `${ASSET_BASE}/${file}`,
  });
  holistic.setOptions(HOLISTIC_OPTIONS);

  let latest: Results | null = null;
  holistic.onResults((results) => {
    latest = results;
  });
  await holistic.initialize();

  let queue: Promise<unknown> = Promise.resolve();

  return {
    process(video) {
      const run = async () => {
        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
          return null;
        }
        latest = null;
        await holistic.send({ image: video });
        return latest ? toFrame(latest) : null;
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
    reset() {
      holistic.reset();
    },
  };
}

/** Loads (once) and returns the shared tracker. Retries after a failure. */
export function loadHolisticTracker() {
  if (!trackerPromise) {
    trackerPromise = createTracker().catch((error) => {
      trackerPromise = null;
      throw error;
    });
  }
  return trackerPromise;
}

/** Packs frames as little-endian float32 [frames, 543, 3] for /predict-landmarks. */
export function packFrames(frames: Float32Array[]) {
  const packed = new Float32Array(frames.length * FRAME_VALUES);
  frames.forEach((frame, index) => packed.set(frame, index * FRAME_VALUES));
  return packed;
}
