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

let warmupPromise: Promise<void> | null = null;

/**
 * Wakes the backend (Render free instances sleep) and loads the classifier.
 * Deduplicated per page load; failures are retried on the next call.
 */
export function warmBackend(timeoutMs = 60_000) {
  if (warmupPromise) return warmupPromise;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  warmupPromise = fetch(`${API_BASE_URL}/warmup`, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Model warmup failed (${response.status})`);
    })
    .catch((error: unknown) => {
      warmupPromise = null;
      console.warn("[SignEase] Backend warmup failed", {
        url: API_BASE_URL,
        error: error instanceof Error ? error.message : error,
      });
    })
    .finally(() => window.clearTimeout(timeoutId));

  return warmupPromise;
}

export async function requestPrediction(
  path: "/predict-landmarks" | "/predict",
  body: BodyInit,
  { signal, headers }: { signal: AbortSignal; headers?: HeadersInit }
): Promise<PredictionResponse> {
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

  if (!data || typeof data.sign !== "string") {
    throw new PredictionError("The server returned an invalid response. Please try again.");
  }

  return data;
}
