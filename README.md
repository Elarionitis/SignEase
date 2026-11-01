# SignEase

SignEase is a sign language recognition project with a Next.js frontend and a Python/Flask ML backend. Users open the detection page, record a sign with their webcam, and get the predicted ASL sign (with the top alternatives and spoken output).

## How prediction works

1. While the user signs, the browser runs **MediaPipe Holistic on every camera frame** (WebAssembly + WebGL, self-hosted from `ISLRv6/public/mediapipe/`). Each frame becomes the 543 face/hand/pose landmarks the model was trained on.
2. The frames and their timestamps are uploaded as a small binary tensor to `POST /predict-landmarks`. The backend resamples them to the 30 fps the model was trained on, finds the part of the recording where the sign happens (leaving out raising, holding and lowering the hands), and runs the TensorFlow Lite classifier.
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
| `INFERENCE_PASSES` | `2` | Model runs averaged for the chosen segment (the model has a random op) |
| `FRAME_SAMPLE_RATE` / `MAX_SAMPLED_FRAMES` | `2` / `48` | Video fallback: frame stride and cap |
| `MAX_UPLOAD_MB` | `8` | Request size limit |

## ML Model Notes

The ML code is based on isolated ASL recognition using the Google ASL Signs dataset and a custom GISLR dataset:

- Google ASL Signs: `https://www.kaggle.com/competitions/asl-signs/data`
- GISLR public dataset: `https://www.kaggle.com/datasets/markwijkhuizen/gislr-dataset-public`

The model recognizes common ASL concepts such as `hello`, `thankyou`, `mom`, `dad`, `water`, `food`, `book`, `yes`, `no`, `please`, and many more from the 250-sign dataset.

## Development Notes

- Keep generated files, virtual environments, caches, and large local artifacts out of commits.
- `Ml/env/`, `.next/`, cache folders, and saved videos are local development artifacts.
- If backend model/data paths move, update the path constants near the top of `Ml/backend.py`.
- Labels come from `Ml/ML_Code_ISL/data/sign_to_prediction_index_map.json`; the dictionary page uses the same map from `ISLRv6/data/`.
- The reported confidence is the model's real softmax probability (averaged over a few runs), not a rescaled value.
