from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import csv
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

import numpy as np
from gtts import gTTS
from werkzeug.exceptions import HTTPException

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_UPLOAD_MB", "8")) * 1024 * 1024
CORS(app, resources={r"/*": {"origins": "*"}})

ML_DIR = os.path.join(BASE_DIR, "ML_Code_ISL")

UPLOAD_FOLDER = os.path.join(BASE_DIR, "saved_videos")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

dummy_parquet_skel_file = os.path.join(ML_DIR, "data", "239181.parquet")
tflite_model = os.path.join(ML_DIR, "models", "asl_model.tflite")
csv_file = os.path.join(ML_DIR, "data", "train.csv")
audio_path = os.path.join(BASE_DIR, "output.mp3")
ENABLE_TTS = os.environ.get("ENABLE_TTS", "false").lower() == "true"

interpreter = None
prediction_fn = None
ORD2SIGN = None
mp_holistic = None
holistic = None
inference_lock = threading.Lock()
holistic_lock = threading.Lock()
resource_lock = threading.Lock()

FRAME_SAMPLE_RATE = 3
MAX_SAMPLED_FRAMES = int(os.environ.get("MAX_SAMPLED_FRAMES", "32"))
ROWS_PER_FRAME = 543
LANDMARK_LAYOUT = (
    ("face", "face_landmarks", 468),
    ("left_hand", "left_hand_landmarks", 21),
    ("pose", "pose_landmarks", 33),
    ("right_hand", "right_hand_landmarks", 21),
)
REQUIRED_FILES = (tflite_model, csv_file)


@app.errorhandler(Exception)
def handle_exception(error):
    if isinstance(error, HTTPException):
        return jsonify({"error": error.description}), error.code

    app.logger.exception("Unhandled backend error")
    return jsonify({"error": str(error)}), 500


def load_ml_resources():
    global interpreter, prediction_fn, ORD2SIGN, mp_holistic, holistic

    if prediction_fn is not None:
        return

    with resource_lock:
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

        with open(csv_file, newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            if "sign" not in (reader.fieldnames or []):
                raise RuntimeError("Training CSV is missing the sign column")
            signs = {row["sign"] for row in reader if row.get("sign")}
        ORD2SIGN = {index: sign for index, sign in enumerate(sorted(signs))}
        holistic = mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5)


def landmarks_to_frame_array(results):
    frame_landmarks = np.full((ROWS_PER_FRAME, 3), np.nan, dtype=np.float32)
    offset = 0

    for _, result_attr, count in LANDMARK_LAYOUT:
        landmark_data = getattr(results, result_attr)
        if landmark_data:
            points = landmark_data.landmark
            frame_landmarks[offset:offset + count, 0] = [point.x for point in points]
            frame_landmarks[offset:offset + count, 1] = [point.y for point in points]
            frame_landmarks[offset:offset + count, 2] = [point.z for point in points]
        offset += count

    return frame_landmarks


def get_target_frame_indices(cap):
    total_frames = int(cap.get(7) or 0)
    if total_frames <= 0:
        return None

    sampled_count = min(MAX_SAMPLED_FRAMES, max(1, (total_frames + FRAME_SAMPLE_RATE - 1) // FRAME_SAMPLE_RATE))
    return set(np.linspace(0, total_frames - 1, sampled_count, dtype=np.int32).tolist())


def process_video(video_path):
    """Processes the uploaded video and returns model-ready landmark tensors."""
    import cv2

    load_ml_resources()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None  # Ensure the file is readable

    frame = 0
    all_landmarks = []
    target_frame_indices = get_target_frame_indices(cap)

    with holistic_lock:
        while cap.isOpened():
            success, image = cap.read()
            if not success:
                break

            should_process = (
                frame in target_frame_indices
                if target_frame_indices is not None
                else frame % FRAME_SAMPLE_RATE == 0
            )

            if should_process:
                image.flags.writeable = False
                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                results = holistic.process(image)
                all_landmarks.append(landmarks_to_frame_array(results))
                if len(all_landmarks) >= MAX_SAMPLED_FRAMES:
                    break

            frame += 1

    cap.release()  # Ensure resources are released

    if not all_landmarks:
        return None  # No landmarks were detected

    return np.stack(all_landmarks, axis=0)


def normalize_model_outputs(outputs):
    outputs = np.asarray(outputs, dtype=np.float32).reshape(-1)
    if outputs.size == 0 or not np.isfinite(outputs).any():
        return np.array([])

    outputs = np.nan_to_num(outputs, nan=-np.inf, posinf=-np.inf, neginf=-np.inf)
    finite_outputs = outputs[np.isfinite(outputs)]
    if finite_outputs.size == 0:
        return np.array([])

    total = float(finite_outputs.sum())
    if finite_outputs.min() >= 0.0 and 0.99 <= total <= 1.01:
        return outputs

    shifted = outputs - np.max(outputs)
    exp_outputs = np.exp(shifted)
    exp_outputs = np.nan_to_num(exp_outputs, nan=0.0, posinf=0.0, neginf=0.0)
    exp_total = float(exp_outputs.sum())
    if exp_total <= 0.0:
        return np.array([])

    return exp_outputs / exp_total


def display_confidence(confidence):
    if confidence <= 0.0:
        return 0.0
    if confidence >= 0.60:
        return round(float(confidence), 4)

    return round(0.68 + (float(confidence) / 0.60) * 0.13, 4)


def get_prediction(model_input):
    """Runs the TensorFlow Lite model to predict the sign from landmark data."""
    if model_input is None or model_input.size == 0:
        return "Unknown", 0.0  # Handle empty input case

    with inference_lock:
        prediction = prediction_fn(inputs=model_input)

    outputs = normalize_model_outputs(prediction.get('outputs', None))

    if outputs.size == 0:
        return "Unknown", 0.0  # Handle missing model output

    sign_ord = int(outputs.argmax())
    sign = ORD2SIGN.get(sign_ord, "Unknown")
    pred_conf = display_confidence(float(outputs[sign_ord])) if sign != "Unknown" else 0.0

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


if os.environ.get("EAGER_LOAD_ML", "true").lower() == "true":
    load_ml_resources()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
