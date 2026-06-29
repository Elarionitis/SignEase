# SignEase

SignEase is a sign language recognition project with a Next.js frontend and a Python/Flask ML backend. Users can open the detection page, record a sign with their webcam, send the clip to the backend, and receive the predicted ASL sign with optional speech output.

## Project Structure

- `ISLRv6/` - Next.js 14 frontend, landing page, dictionary, sign detection UI, assets, and video demos.
- `ISLRv6/pages/sign-detection.tsx` - webcam recording and prediction experience.
- `Ml/backend.py` - Flask prediction API used by the frontend at `http://localhost:5000/predict`.
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

### Backend

```bash
cd Ml
python -m venv .venv
source .venv/bin/activate
pip install flask flask-cors opencv-python mediapipe pandas numpy tensorflow gtts pyarrow
python backend.py
```

The frontend expects the backend on `http://localhost:5000`.

## ML Model Notes

The ML code is based on isolated ASL recognition using the Google ASL Signs dataset and a custom GISLR dataset:

- Google ASL Signs: `https://www.kaggle.com/competitions/asl-signs/data`
- GISLR public dataset: `https://www.kaggle.com/datasets/markwijkhuizen/gislr-dataset-public`

The model recognizes common ASL concepts such as `hello`, `thankyou`, `mom`, `dad`, `water`, `food`, `book`, `yes`, `no`, `please`, and many more from the 250-sign dataset.

## Development Notes

- Keep generated files, virtual environments, caches, and large local artifacts out of commits.
- `Ml/env/`, `.next/`, cache folders, and saved videos are local development artifacts.
- If backend model/data paths move, update the path constants near the top of `Ml/backend.py`.
