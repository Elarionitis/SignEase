# SignEase

SignEase is a sign language recognition project with a Next.js frontend and a Python/Flask ML backend. Users open the detection page, record a sign with their webcam, and get the predicted ASL sign (with the top alternatives and spoken output).

## How prediction works

1. While the user signs, the browser runs **MediaPipe Holistic on every camera frame** (WebAssembly + WebGL, self-hosted from `ISLRv6/public/mediapipe/`). Each frame becomes the 543 face/hand/pose landmarks the model was trained on.
2. The frames and their timestamps are uploaded as a small binary tensor to `POST /predict-landmarks`. The backend resamples them to the 30 fps the model was trained on, finds the part of the recording where the sign happens (leaving out raising, holding and lowering the hands), and runs the TensorFlow Lite classifier.

Three corrections make webcam recordings match the training data:

- **Frame shape.** The training videos are portrait phone recordings (about 3:4), and MediaPipe coordinates are fractions of the frame's width and height. The browser sends the camera's aspect ratio and the backend re-expresses the landmarks as a 3:4 frame. Without this, a 4:3 webcam squeezes every hand shape to about half its width.
- **Choosing the signing hand.** The model reads only one hand, the one tracked in more frames. In two-handed signs that is often the still "base" hand, so when both hands are tracked the backend also scores each hand on its own and keeps the most confident result. On the 120 dictionary videos this fixed 6 predictions and broke none (two-handed signs 33% → 48% correct, all signs 57% → 62%).
- **Calibrated confidence.** The model was trained with smoothed labels, so its raw scores rarely pass about 75% even when it is right. The backend applies temperature scaling (fitted on the 120 dictionary videos) so the confidence shown matches how often predictions are actually correct.
3. If the device cannot run hand tracking fast enough (no WebGL2, very slow GPU), the page falls back to uploading the recorded clip to `POST /predict`, and the server extracts landmarks itself. This is slower on a shared CPU.

Running MediaPipe on the server was the bottleneck in production: a free/starter Render CPU had to sample only a few frames to avoid timeouts, and the model's confidence dropped sharply with those sparse sequences (for example 74% vs 30% on a Kaggle sample). Tracking in the browser gives the model the full frame rate, as when running locally, at no server cost.

## Project Structure

- `ISLRv6/` - Next.js 14 frontend, landing page, dictionary, sign detection UI, assets, and video demos.
- `ISLRv6/pages/sign-detection.tsx` - webcam recording and prediction experience.
- `ISLRv6/lib/holistic.ts` - in-browser MediaPipe Holistic landmark extraction.
- `ISLRv6/scripts/copy-mediapipe.js` - copies the MediaPipe runtime into `public/` (runs before `dev` and `build`).
- `Ml/backend.py` - Flask prediction API (`/predict-landmarks`, `/predict`, `/warmup`, `/health`).
- `Ml/ML_Code_ISL/` - TensorFlow Lite model, training data samples, and legacy Streamlit/ML scripts.
- `ISLRv6/backend.py` - older frontend-side backend copy kept for reference.

## Features

- Landing page with SignEase sections for impact, technology, FAQ, team, and contact.
- Warmed `/sign-detection` route so the prediction page starts compiling/loading in the background from the home page.
- Webcam-based sign recording with configurable capture duration.
- Live framing guide before recording ("Move back so your chest and stomach are in view"), since many signs are made low and are missed when the camera only sees the face and shoulders.
- Recording stops by itself when the hands are lowered after the sign (the slider sets the maximum).
- Practice challenge: tap the demo to watch it large and in slow motion, then copy it, get instant feedback ("Nailed it", "So close") and build a streak; the best streak is remembered.
- 3-second countdown before recording (with sound cues), Space bar to start/stop, and a session history that can be spoken back as a sentence.
- Flask backend that extracts MediaPipe landmarks, runs a TensorFlow Lite ASL model, returns prediction confidence, and generates audio.
- Dictionary and sign demo assets for learning supported signs.

## Setup

### Frontend

```bash
cd ISLRv6
npm install
npm run dev
```

Open `http://localhost:3000`.

For local development, the frontend defaults to `http://localhost:5000`. In production (Vercel), set `NEXT_PUBLIC_API_BASE_URL` to the backend URL, e.g. `https://your-backend.onrender.com`, and redeploy (the value is baked in at build time).

### Backend

```bash
cd Ml
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python backend.py
```

The frontend expects the backend on `http://localhost:5000`. In production it runs with `gunicorn -c gunicorn.conf.py backend:app` (see `Procfile`).

Optional backend environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins, e.g. `https://your-app.vercel.app` |
| `MAX_LANDMARK_FRAMES` | `600` | Longest landmark sequence accepted |
| `CONFIDENCE_TEMPERATURE` | `0.89` | Confidence calibration (lower = sharper); `1` shows raw model scores |
| `INFERENCE_PASSES` | `1` | Model runs averaged for the chosen segment (only useful for models exported before the fine-tuned one, which dropped frames at random) |
| `FRAME_SAMPLE_RATE` / `MAX_SAMPLED_FRAMES` | `2` / `48` | Video fallback: frame stride and cap |
| `MAX_UPLOAD_MB` | `8` | Request size limit |
| `INFERENCE_WORKERS` | `2` | Model copies that predict in parallel (~45 MB each) |
| `MAX_QUEUED_PREDICTIONS` | `8` | Landmark requests allowed to wait for a free model before the server answers 503 |
| `PREDICTION_QUEUE_TIMEOUT_SECONDS` | `15` | Longest wait for a free model |
| `MAX_QUEUED_VIDEO_PREDICTIONS` | `2` | Video-fallback requests allowed to wait (one runs at a time) |
| `RATE_LIMIT_PER_MINUTE` / `RATE_LIMIT_BURST` | `40` / `10` | Per-visitor prediction limit (`0` disables it) |
| `TRUSTED_PROXY_HOPS` | `1` | Proxies in front of the app (Render's load balancer), used to find the visitor's address |
| `GUNICORN_THREADS` | `8` | Request threads per worker |

## Handling many visitors

The backend is built to stay responsive when many people try the demo at once:

- **Parallel predictions.** `INFERENCE_WORKERS` copies of the model take requests at the same time. With two copies, a load test of 20 concurrent visitors ran at twice the throughput of one copy (33 vs 17 predictions/s on a multi-core machine) with half the latency. On a shared Render CPU the absolute numbers are lower.
- **Small uploads.** The browser uploads only the 94 landmark rows the model reads (`X-Landmark-Layout: compact-v1`), about 6x less data than full frames, with identical predictions. The server still accepts full frames from older clients.
- **Backpressure instead of timeouts.** When every model copy is busy and the queue is full, the server answers `503` with `Retry-After` straight away instead of holding the connection. The video fallback (MediaPipe on the server, seconds per clip) has its own small queue, so it cannot use up the threads the fast landmark path needs.
- **Automatic retries.** The page retries `429`/`502`/`503`/`504` responses and network failures up to 4 times, with jittered backoff and `Retry-After` honoured, and tells the user it is retrying.
- **Per-visitor rate limit.** A token bucket per client address stops one script from starving everyone else.
- **Horizontal scaling.** The API keeps no state between requests, so you can add instances (Render: *Scaling → Instances* on a paid plan) and Render's load balancer will spread traffic across them. `GET /health` reports model status, free capacity and request counters for monitoring, and `render.yaml` sets it as the health check so unhealthy instances are taken out of rotation.

## Keeping the backend awake

Render's free instances sleep after 15 minutes without traffic, and the first prediction after that waits up to a minute. The detection page shows when the server is waking up and pings it while the page is open. To keep it awake all the time, set the repository variable `BACKEND_URL` (Settings → Secrets and variables → Actions → Variables) to the backend URL; the `Keep backend awake` workflow then pings it every 10 minutes.

## ML Model Notes

The ML code is based on isolated ASL recognition using the Google ASL Signs dataset and a custom GISLR dataset:

- Google ASL Signs: `https://www.kaggle.com/competitions/asl-signs/data`
- GISLR public dataset: `https://www.kaggle.com/datasets/markwijkhuizen/gislr-dataset-public`

The model recognizes common ASL concepts such as `hello`, `thankyou`, `mom`, `dad`, `water`, `food`, `book`, `yes`, `no`, `please`, and many more from the 250-sign dataset.

The shipped `asl_model.tflite` is the original Kaggle-notebook transformer, rebuilt from its weights and fine-tuned to be robust to webcam recordings (aspect ratio, framing, raising and lowering the hands). On the 120 dictionary videos, which no model was trained on, it gets 60% top-1 and 68% top-3 through the backend pipeline. See `Ml/training/README.md` for how it was verified, trained, evaluated and calibrated, and how to reproduce it.

## Development Notes

- Keep generated files, virtual environments, caches, and large local artifacts out of commits.
- `Ml/env/`, `.next/`, cache folders, and saved videos are local development artifacts.
- If backend model/data paths move, update the path constants near the top of `Ml/backend.py`.
- Labels come from `Ml/ML_Code_ISL/data/sign_to_prediction_index_map.json`; the dictionary page uses the same map from `ISLRv6/data/`.
- The reported confidence is the model's softmax probability, temperature-scaled to match real accuracy (refit with `Ml/training/calibrate.py` whenever the model changes).
