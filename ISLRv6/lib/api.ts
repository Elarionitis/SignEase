export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:5000";

export interface SignPrediction {
  sign: string;
  confidence: number;
}

export interface PredictionResponse extends SignPrediction {
  predictions?: SignPrediction[];
  frames?: { received: number; with_hands: number };
  timing?: Record<string, number>;
  error?: string;
}

export class PredictionError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PredictionError";
  }
}

export type BackendStatus = "waking" | "ready" | "offline";

let backendStatus: BackendStatus = "waking";
const statusListeners = new Set<(status: BackendStatus) => void>();
let warmupPromise: Promise<void> | null = null;

function setBackendStatus(status: BackendStatus) {
  if (status === backendStatus) return;
  backendStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

export function getBackendStatus() {
  return backendStatus;
}

export function subscribeBackendStatus(listener: (status: BackendStatus) => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Wakes the backend (Render free instances sleep after 15 idle minutes, and
 * waking takes up to a minute) and loads the classifier. Deduplicated while
 * in flight; failures are retried on the next call.
 */
export function warmBackend(timeoutMs = 90_000) {
  if (warmupPromise) return warmupPromise;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  warmupPromise = fetch(`${API_BASE_URL}/warmup`, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Model warmup failed (${response.status})`);
      setBackendStatus("ready");
    })
    .catch((error: unknown) => {
      setBackendStatus("offline");
      console.warn("[SignEase] Backend warmup failed", {
        url: API_BASE_URL,
        error: error instanceof Error ? error.message : error,
      });
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
      warmupPromise = null;
    });

  return warmupPromise;
}

// Busy (503) and rate-limited (429) answers carry Retry-After; a network
// failure is usually a cold start or a dropped connection. All are retried
// a few times with backoff before the user sees an error.
const MAX_PREDICTION_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 8_000;

function retryDelayMs(attempt: number, retryAfter: string | null) {
  const seconds = Number(retryAfter);
  const base = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000 * 2 ** attempt;
  // Jitter spreads retries from many visitors so they don't arrive together.
  return Math.min(MAX_RETRY_DELAY_MS, base) * (0.8 + Math.random() * 0.4);
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function requestPrediction(
  path: "/predict-landmarks" | "/predict",
  body: BodyInit,
  {
    signal,
    headers,
    onRetry,
  }: { signal: AbortSignal; headers?: HeadersInit; onRetry?: (message: string) => void }
): Promise<PredictionResponse> {
  for (let attempt = 0; ; attempt += 1) {
    const lastAttempt = attempt >= MAX_PREDICTION_ATTEMPTS - 1;
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        body,
        signal,
        headers: { Accept: "application/json", ...headers },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      if (!lastAttempt) {
        onRetry?.("Connection hiccup, retrying…");
        await wait(retryDelayMs(attempt, null), signal);
        continue;
      }
      throw new PredictionError(
        "Could not reach the prediction server. Check your connection and try again."
      );
    }

    let data: PredictionResponse | null = null;
    try {
      data = (await response.json()) as PredictionResponse;
    } catch {
      // Handled below: proxies and cold-starting hosts can return HTML errors.
    }

    const retryable = response.status === 429 || response.status === 502 ||
      response.status === 503 || response.status === 504;
    if (retryable && !lastAttempt) {
      onRetry?.(
        response.status === 429
          ? "Lots of signs in a short time, retrying in a moment…"
          : "The server is busy with other visitors, retrying…"
      );
      await wait(retryDelayMs(attempt, response.headers.get("Retry-After")), signal);
      continue;
    }

    if (!response.ok) {
      throw new PredictionError(
        data?.error ||
          (response.status === 413
            ? "The recording is too large. Try a shorter recording."
            : response.status >= 500
              ? "The prediction server is starting up or busy. Please try again in a moment."
              : `Prediction failed (${response.status})`),
        response.status
      );
    }

    // Any answer, even an error, means the server is awake.
    setBackendStatus("ready");

    if (!data || typeof data.sign !== "string") {
      throw new PredictionError("The server returned an invalid response. Please try again.");
    }

    return data;
  }
}
