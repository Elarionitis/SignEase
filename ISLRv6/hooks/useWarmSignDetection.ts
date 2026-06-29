"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const SIGN_DETECTION_ROUTE = "/sign-detection";

export function useWarmSignDetection() {
  const router = useRouter();
  const didWarm = useRef(false);

  const warmSignDetection = useCallback(() => {
    if (didWarm.current) return;
    didWarm.current = true;

    router.prefetch(SIGN_DETECTION_ROUTE);

    fetch(SIGN_DETECTION_ROUTE, {
      method: "GET",
      credentials: "same-origin",
      cache: "force-cache",
    }).catch(() => {
      didWarm.current = false;
    });
  }, [router]);

  useEffect(() => {
    warmSignDetection();

    const warmAgain = () => warmSignDetection();
    const timeoutId = window.setTimeout(warmAgain, 1000);

    if (window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(warmAgain);
      return () => {
        window.clearTimeout(timeoutId);
        window.cancelIdleCallback?.(idleId);
      };
    }

    return () => window.clearTimeout(timeoutId);
  }, [warmSignDetection]);

  return warmSignDetection;
}
