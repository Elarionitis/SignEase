import { useEffect, useState } from "react";
import {
  getBackendStatus,
  subscribeBackendStatus,
  warmBackend,
  type BackendStatus,
} from "@/lib/api";

// Render free instances sleep after 15 minutes without requests. Pinging
// while the page is open and visible keeps the next prediction fast.
const KEEP_AWAKE_INTERVAL_MS = 5 * 60_000;
const RETRY_INTERVAL_MS = 15_000;

export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>(getBackendStatus);

  useEffect(() => subscribeBackendStatus(setStatus), []);

  useEffect(() => {
    if (status !== "ready") void warmBackend();
    const intervalMs = status === "ready" ? KEEP_AWAKE_INTERVAL_MS : RETRY_INTERVAL_MS;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void warmBackend();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void warmBackend();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status]);

  return status;
}
