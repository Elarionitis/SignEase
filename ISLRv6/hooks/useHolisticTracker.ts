import { useCallback, useEffect, useRef, useState } from "react";
import { loadHolisticTracker, type HolisticTracker } from "@/lib/holistic";

export type TrackerStatus = "loading" | "calibrating" | "ready" | "unavailable";

// The runtime is ~30 MB on first visit (cached afterwards). If it has not
// loaded by then, record in server mode instead of keeping the user waiting.
const LOAD_TIMEOUT_MS = 45_000;
// Tracking runs on the main thread. Slower than this per frame (under ~6 fps)
// the preview stutters and the landmark sequence gets too sparse, so such
// devices use server processing instead.
export const SLOW_FRAME_MS = 170;
const CALIBRATION_FRAMES = 4;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function useHolisticTracker() {
  const [status, setStatus] = useState<TrackerStatus>("loading");
  const trackerRef = useRef<HolisticTracker | null>(null);
  const calibratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled && !trackerRef.current) setStatus("unavailable");
    }, LOAD_TIMEOUT_MS);

    loadHolisticTracker()
      .then((tracker) => {
        if (cancelled) return;
        trackerRef.current = tracker;
        setStatus("calibrating");
      })
      .catch((error: unknown) => {
        console.warn("[SignEase] On-device hand tracking unavailable, using server mode", error);
        if (!cancelled) setStatus("unavailable");
      })
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  /** Switches to server processing, e.g. when tracking turns out too slow. */
  const disable = useCallback((reason: string) => {
    console.warn(`[SignEase] Using server processing: ${reason}`);
    setStatus("unavailable");
  }, []);

  /**
   * Times a few frames on the live camera once. The first frames also compile
   * the GPU shaders, which would otherwise stall the start of the first
   * recording.
   */
  const calibrate = useCallback(
    async (video: HTMLVideoElement) => {
      const tracker = trackerRef.current;
      if (!tracker || calibratedRef.current) return;
      calibratedRef.current = true;

      try {
        await tracker.process(video);
        const timings: number[] = [];
        for (let i = 0; i < CALIBRATION_FRAMES; i += 1) {
          const startedAt = performance.now();
          await tracker.process(video);
          timings.push(performance.now() - startedAt);
          if (timings.length >= 2 && median(timings) > SLOW_FRAME_MS * 2) break;
        }
        tracker.reset();

        const frameMs = median(timings);
        console.info("[SignEase] On-device hand tracking", { frameMs: Math.round(frameMs) });
        if (frameMs > SLOW_FRAME_MS) {
          disable(`hand tracking is too slow on this device (${Math.round(frameMs)} ms/frame)`);
        } else {
          setStatus("ready");
        }
      } catch (error) {
        disable(`hand tracking failed (${error instanceof Error ? error.message : String(error)})`);
      }
    },
    [disable]
  );

  return { status, trackerRef, calibrate, disable };
}
