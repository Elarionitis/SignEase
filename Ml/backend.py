from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import time
import threading
from pathlib import Path
from uuid import uuid4

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("MPLCONFIGDIR", os.path.join(BASE_DIR, ".cache", "matplotlib"))
os.environ.setdefault("XDG_CACHE_HOME", os.path.join(BASE_DIR, ".cache"))
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

import pandas as pd
import numpy as np
from gtts import gTTS
from werkzeug.exceptions import HTTPException

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

ML_DIR = os.path.join(BASE_DIR, "ML_Code_ISL")

UPLOAD_FOLDER = os.path.join(BASE_DIR, "saved_videos")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

dummy_parquet_skel_file = os.path.join(ML_DIR, "data", "239181.parquet")
tflite_model = os.path.join(ML_DIR, "models", "asl_model.tflite")
csv_file = os.path.join(ML_DIR, "data", "train.csv")
audio_path = os.path.join(BASE_DIR, "output.mp3")
ENABLE_TTS = os.environ.get("ENABLE_TTS", "false").lower() == "true"
PRELOAD_ML = os.environ.get("PRELOAD_ML", "true").lower() == "true"

xyz = None
interpreter = None
prediction_fn = None
ORD2SIGN = None
mp_holistic = None
inference_lock = threading.Lock()

FRAME_SAMPLE_RATE = 3
ROWS_PER_FRAME = 543
REQUIRED_FILES = (dummy_parquet_skel_file, tflite_model, csv_file)


@app.errorhandler(Exception)
def handle_exception(error):
    if isinstance(error, HTTPException):
        return jsonify({"error": error.description}), error.code

    app.logger.exception("Unhandled backend error")
    return jsonify({"error": str(error)}), 500


def load_ml_resources():
    global xyz, interpreter, prediction_fn, ORD2SIGN, mp_holistic

    if prediction_fn is not None:
        return

    missing_files = [path for path in REQUIRED_FILES if not os.path.isfile(path)]
    if missing_files:
        raise RuntimeError(f"Missing ML asset(s): {', '.join(missing_files)}")

    import mediapipe as mp
    try:
        from tflite_runtime.interpreter import Interpreter
    except ImportError:
        from tensorflow.lite import Interpreter

    if not hasattr(mp, "solutions"):
        raise RuntimeError(
            "Installed mediapipe package does not include the legacy solutions "
            "API required by this backend. Use mediapipe==0.10.11."
        )

    mp_holistic = mp.solutions.holistic
    xyz = pd.read_parquet(dummy_parquet_skel_file)

    required_skel_columns = {"type", "landmark_index"}
    if not required_skel_columns.issubset(xyz.columns):
        raise RuntimeError("Skeleton parquet is missing required landmark columns")

    xyz = xyz[["type", "landmark_index"]].drop_duplicates().reset_index(drop=True)
    if len(xyz) != ROWS_PER_FRAME:
        raise RuntimeError(f"Skeleton parquet has {len(xyz)} rows; expected {ROWS_PER_FRAME}")

    interpreter = Interpreter(model_path=tflite_model, num_threads=1)
    signature_list = interpreter.get_signature_list()
    serving_signature = signature_list.get("serving_default")
    if not serving_signature:
        raise RuntimeError("TFLite model is missing the serving_default signature")
    if "inputs" not in serving_signature.get("inputs", []):
        raise RuntimeError("TFLite serving_default signature is missing the inputs tensor")
    if "outputs" not in serving_signature.get("outputs", []):
        raise RuntimeError("TFLite serving_default signature is missing the outputs tensor")
    prediction_fn = interpreter.get_signature_runner("serving_default")

    train = pd.read_csv(csv_file)
    if "sign" not in train.columns:
        raise RuntimeError("Training CSV is missing the sign column")
    train["sign_ord"] = train["sign"].astype("category").cat.codes
    ORD2SIGN = train[["sign_ord", "sign"]].set_index("sign_ord").squeeze().to_dict()


def create_frame_landmark_df(results, frame, xyz):
    """Extracts and formats landmark data for a given frame."""
    data = []

    for landmark_type, landmark_data in zip(
        ['face', 'pose', 'left_hand', 'right_hand'],
        [results.face_landmarks, results.pose_landmarks, results.left_hand_landmarks, results.right_hand_landmarks]
    ):
        if landmark_data:
            for i, point in enumerate(landmark_data.landmark):
                data.append([landmark_type, i, point.x, point.y, point.z])

    df = pd.DataFrame(data, columns=['type', 'landmark_index', 'x', 'y', 'z'])
    return xyz.merge(df, on=['type', 'landmark_index'], how='left').assign(frame=frame)


def process_video(video_path):
    """Processes the uploaded video and returns model-ready landmark tensors."""
    import cv2

    load_ml_resources()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None  # Ensure the file is readable

    frame = 0
    all_landmarks = []

    with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
        while cap.isOpened():
            success, image = cap.read()
            if not success:
                break

            if frame % FRAME_SAMPLE_RATE == 0:
                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                results = holistic.process(image)
                all_landmarks.append(create_frame_landmark_df(results, frame, xyz))

            frame += 1

    cap.release()  # Ensure resources are released

    if not all_landmarks:
        return None  # No landmarks were detected

    df = pd.concat(all_landmarks).reset_index(drop=True)
    return dataframe_to_model_input(df)


def dataframe_to_model_input(dataframe):
    """Loads and reshapes landmark data for model input."""
    data = dataframe[['x', 'y', 'z']]

    if data.empty:
        return np.array([])  # Return an empty array if no data is present

    n_frames = len(data) // ROWS_PER_FRAME
    if n_frames == 0 or len(data) % ROWS_PER_FRAME != 0:
        return np.array([])

    return data.values.reshape(n_frames, ROWS_PER_FRAME, 3).astype(np.float32)


def get_prediction(model_input):
    """Runs the TensorFlow Lite model to predict the sign from landmark data."""
    if model_input is None or model_input.size == 0:
        return "Unknown", 0.0  # Handle empty input case

    with inference_lock:
        prediction = prediction_fn(inputs=model_input)

    outputs = prediction.get('outputs', None)

    if outputs is None or outputs.size == 0:
        return "Unknown", 0.0  # Handle missing model output

    outputs = np.asarray(outputs).reshape(-1)
    if not np.isfinite(outputs).any():
        return "Unknown", 0.0

    safe_outputs = np.nan_to_num(outputs, nan=-np.inf, posinf=-np.inf, neginf=-np.inf)
    sign_ord = int(safe_outputs.argmax())
    sign = ORD2SIGN.get(sign_ord, "Unknown")
    pred_conf = float(safe_outputs[sign_ord])

    return sign, pred_conf


@app.route("/predict", methods=["POST"])
def predict():
    """Handles video upload, processing, prediction, and generates speech output."""
    started_at = time.perf_counter()
    if "video" not in request.files:
        return jsonify({"error": "No video uploaded"}), 400

    load_ml_resources()
    resources_loaded_at = time.perf_counter()

    file = request.files["video"]
    suffix = Path(file.filename or "").suffix or ".webm"
    video_path = os.path.join(UPLOAD_FOLDER, f"{uuid4().hex}{suffix}")
    file.save(video_path)
    saved_at = time.perf_counter()

    try:
        model_input = process_video(video_path)
        processed_at = time.perf_counter()

        detected_sign, confidence = get_prediction(model_input)
        predicted_at = time.perf_counter()
    finally:
        try:
            os.remove(video_path)
        except OSError:
            pass

    response = {
        "sign": detected_sign,
        "confidence": confidence,
        "timing": {
            "resource_load_seconds": round(resources_loaded_at - started_at, 3),
            "upload_save_seconds": round(saved_at - resources_loaded_at, 3),
            "video_processing_seconds": round(processed_at - saved_at, 3),
            "model_prediction_seconds": round(predicted_at - processed_at, 3),
            "total_seconds": round(predicted_at - started_at, 3),
        },
    }

    app.logger.info("Prediction response: %s", response)

    if ENABLE_TTS:
        try:
            tts = gTTS(text=detected_sign, lang='en')
            tts.save(audio_path)
            response["audio_url"] = "/audio"
        except Exception as error:
            app.logger.warning("TTS generation failed: %s", error)

    return jsonify(response)


@app.route("/audio", methods=["GET"])
def get_audio():
    """Serves the generated audio file for sign language translation."""
    return send_file(audio_path, mimetype="audio/mpeg")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if PRELOAD_ML:
    load_ml_resources()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
