"""SignEase prediction API.

Two prediction paths share one TensorFlow Lite model:

* ``POST /predict-landmarks`` (primary): the browser runs MediaPipe Holistic on
  every camera frame while the user signs and uploads the landmark tensor.
  The server only runs the classifier, so a prediction takes milliseconds
  even on a small Render instance, and the model sees the full frame rate it
  was trained on.
* ``POST /predict`` (fallback): the browser uploads the recorded clip and the
  server extracts landmarks itself. This is only used when the browser cannot
  run MediaPipe, because Holistic on a shared CPU is slow.
"""

import json
import logging
import os
import threading
import time
from pathlib import Path
from uuid import uuid4

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("GLOG_minloglevel", "2")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("MPLCONFIGDIR", os.path.join(BASE_DIR, ".cache", "matplotlib"))
os.environ.setdefault("XDG_CACHE_HOME", os.path.join(BASE_DIR, ".cache"))
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException


def env_int(name, default, minimum=1):
    try:
        return max(minimum, int(os.environ.get(name, default)))
    except ValueError:
        return default


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = env_int("MAX_UPLOAD_MB", 8) * 1024 * 1024

cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
CORS(app, resources={r"/*": {"origins": cors_origins or "*"}}, max_age=86400)

# Flask defaults to warning-level logs under Gunicorn, which hides the request
# timing needed to diagnose production prediction latency.
gunicorn_logger = logging.getLogger("gunicorn.error")
if gunicorn_logger.handlers:
    app.logger.handlers = gunicorn_logger.handlers
app.logger.setLevel(logging.INFO)
app.logger.propagate = False

ML_DIR = os.path.join(BASE_DIR, "ML_Code_ISL")
UPLOAD_FOLDER = os.path.join(BASE_DIR, "saved_videos")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

TFLITE_MODEL_PATH = os.path.join(ML_DIR, "models", "asl_model.tflite")
LABEL_MAP_PATH = os.path.join(ML_DIR, "data", "sign_to_prediction_index_map.json")

ROWS_PER_FRAME = 543
COORDINATES = 3
FRAME_VALUES = ROWS_PER_FRAME * COORDINATES
FRAME_BYTES = FRAME_VALUES * 4
LANDMARK_LAYOUT = (
    ("face", "face_landmarks", 468),
    ("left_hand", "left_hand_landmarks", 21),
    ("pose", "pose_landmarks", 33),
    ("right_hand", "right_hand_landmarks", 21),
)
LEFT_HAND_ROWS = slice(468, 489)
RIGHT_HAND_ROWS = slice(522, 543)

# Landmark uploads: ~30 fps for the 10 second maximum recording, with headroom.
MAX_LANDMARK_FRAMES = env_int("MAX_LANDMARK_FRAMES", 600)
MIN_HAND_FRAMES = env_int("MIN_HAND_FRAMES", 2)
TOP_K = 3
# The model contains a RANDOM_UNIFORM op, so repeated runs differ by a couple
# of percent. Averaging a few ~40 ms passes keeps the reported confidence stable.
INFERENCE_PASSES = env_int("INFERENCE_PASSES", 3)

# Video fallback. Holistic is the expensive step, so cap how many frames it
# runs on; the cap still covers a 3 second clip at 15 fps.
FRAME_SAMPLE_RATE = env_int("FRAME_SAMPLE_RATE", 2)
MAX_SAMPLED_FRAMES = env_int("MAX_SAMPLED_FRAMES", 48)
MAX_VIDEO_FRAME_WIDTH = env_int("MAX_VIDEO_FRAME_WIDTH", 640)

interpreter = None
prediction_fn = None
ORD2SIGN = None
holistic = None
inference_lock = threading.Lock()
holistic_lock = threading.Lock()
model_load_lock = threading.Lock()
holistic_load_lock = threading.Lock()


class PredictionInputError(ValueError):
    """Raised when an upload cannot be turned into model input."""


@app.errorhandler(Exception)
def handle_exception(error):
    if isinstance(error, HTTPException):
        return jsonify({"error": error.description}), error.code

    app.logger.exception("Unhandled backend error")
    return jsonify({"error": "The prediction server hit an unexpected error. Please try again."}), 500


def load_labels():
    with open(LABEL_MAP_PATH, encoding="utf-8") as file:
        sign_to_index = json.load(file)

    labels = {int(index): sign for sign, index in sign_to_index.items()}
    if sorted(labels) != list(range(len(labels))):
        raise RuntimeError("Label map indices must be contiguous and start at 0")
    return labels


def load_model():
    """Loads the classifier. Cheap (~1s), so warmup and /predict-landmarks only need this."""
    global interpreter, prediction_fn, ORD2SIGN

    if prediction_fn is not None:
        return

    with model_load_lock:
        if prediction_fn is not None:
            return

        if not os.path.isfile(TFLITE_MODEL_PATH):
            raise RuntimeError(f"Missing ML model: {TFLITE_MODEL_PATH}")

        try:
            from tflite_runtime.interpreter import Interpreter
        except ImportError as error:
            raise RuntimeError(
                "tflite-runtime is required for inference; install the pinned "
                "dependency from requirements.txt"
            ) from error

        labels = load_labels()
        model = Interpreter(
            model_path=TFLITE_MODEL_PATH,
            num_threads=env_int("TFLITE_NUM_THREADS", 1),
        )
        serving_signature = model.get_signature_list().get("serving_default")
        if not serving_signature:
            raise RuntimeError("TFLite model is missing the serving_default signature")
        if "inputs" not in serving_signature.get("inputs", []):
            raise RuntimeError("TFLite serving_default signature is missing the inputs tensor")
        if "outputs" not in serving_signature.get("outputs", []):
            raise RuntimeError("TFLite serving_default signature is missing the outputs tensor")
        runner = model.get_signature_runner("serving_default")

        # The first invocation allocates tensors; do it here instead of
        # inside the user's first prediction.
        warm_input = np.full((1, ROWS_PER_FRAME, COORDINATES), np.nan, dtype=np.float32)
        warm_input[:, RIGHT_HAND_ROWS] = 0.5
        with inference_lock:
            runner(inputs=warm_input)

        interpreter = model
        ORD2SIGN = labels
        prediction_fn = runner


def load_holistic():
    """Loads MediaPipe Holistic. Only the video fallback needs it."""
    global holistic

    if holistic is not None:
        return

    with holistic_load_lock:
        if holistic is not None:
            return

        import mediapipe as mp

        if not hasattr(mp, "solutions"):
            raise RuntimeError(
                "Installed mediapipe package does not include the legacy solutions "
                "API required by this backend. Use mediapipe==0.10.14."
            )

        # Same settings as the browser extractor and the training data.
        holistic = mp.solutions.holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            refine_face_landmarks=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )


def hand_frame_mask(frames):
    left = ~np.all(np.isnan(frames[:, LEFT_HAND_ROWS, 0]), axis=1)
    right = ~np.all(np.isnan(frames[:, RIGHT_HAND_ROWS, 0]), axis=1)
    return left | right


def select_hand_frames(frames):
    """Keeps only frames with a visible hand; the model scores signs from hand motion."""
    hand_frames = frames[hand_frame_mask(frames)]
    if len(hand_frames) < MIN_HAND_FRAMES:
        return None
    return np.ascontiguousarray(hand_frames, dtype=np.float32)


def landmarks_to_frame_array(results):
    frame_landmarks = np.full((ROWS_PER_FRAME, COORDINATES), np.nan, dtype=np.float32)
    offset = 0

    for _, result_attr, count in LANDMARK_LAYOUT:
        landmark_data = getattr(results, result_attr)
        if landmark_data:
            frame_landmarks[offset:offset + count] = [
                (point.x, point.y, point.z) for point in landmark_data.landmark
            ]
        offset += count

    return frame_landmarks


def process_video(video_path):
    """Extracts landmark frames from a browser-recorded clip.

    Do not seek based on ``CAP_PROP_FRAME_COUNT`` here. WebM files emitted by
    MediaRecorder frequently report incomplete frame metadata, so seeking can
    repeatedly read only an early frame and miss the user's hands entirely.
    """
    import cv2

    load_holistic()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise PredictionInputError("The recording could not be decoded. Please record again.")

    frames = []
    frame_index = 0
    try:
        with holistic_lock:
            while len(frames) < MAX_SAMPLED_FRAMES:
                success, image = cap.read()
                if not success:
                    break

                if frame_index % FRAME_SAMPLE_RATE == 0:
                    height, width = image.shape[:2]
                    if width > MAX_VIDEO_FRAME_WIDTH:
                        scale = MAX_VIDEO_FRAME_WIDTH / width
                        image = cv2.resize(
                            image,
                            (MAX_VIDEO_FRAME_WIDTH, int(height * scale)),
                            interpolation=cv2.INTER_AREA,
                        )
                    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    image.flags.writeable = False
                    frames.append(landmarks_to_frame_array(holistic.process(image)))

                frame_index += 1
    finally:
        cap.release()

    if not frames:
        raise PredictionInputError("The recording did not contain any video frames. Please record again.")

    return np.stack(frames, axis=0)


def parse_landmark_upload(body):
    if not body:
        raise PredictionInputError("No landmark data uploaded")
    if len(body) % FRAME_BYTES != 0:
        raise PredictionInputError(
            f"Landmark payload must be float32 frames of {ROWS_PER_FRAME}x{COORDINATES} values"
        )

    frame_count = len(body) // FRAME_BYTES
    if frame_count > MAX_LANDMARK_FRAMES:
        raise PredictionInputError(
            f"Recording is too long ({frame_count} frames, maximum {MAX_LANDMARK_FRAMES})"
        )

    frames = np.frombuffer(body, dtype="<f4").reshape(frame_count, ROWS_PER_FRAME, COORDINATES)
    # Infinity is never a valid landmark; treat it as "not detected" like NaN.
    return np.where(np.isfinite(frames), frames, np.nan).astype(np.float32)


def get_prediction(model_input):
    """Runs the classifier and returns the top predictions, best first."""
    load_model()
    with inference_lock:
        outputs = [
            np.asarray(prediction_fn(inputs=model_input)["outputs"], dtype=np.float64).reshape(-1)
            for _ in range(INFERENCE_PASSES)
        ]

    scores = np.mean(outputs, axis=0)
    if scores.size != len(ORD2SIGN) or not np.all(np.isfinite(scores)):
        app.logger.warning("Model returned unusable scores (size=%s)", scores.size)
        return []

    # The model ends in a softmax; renormalise only to remove float drift.
    total = scores.sum()
    if total > 0:
        scores = scores / total

    top_indices = np.argsort(scores)[::-1][:TOP_K]
    return [
        {"sign": ORD2SIGN[int(index)], "confidence": round(float(scores[index]), 4)}
        for index in top_indices
    ]


def prediction_response(frames, timing, started_at):
    model_input = select_hand_frames(frames)
    if model_input is None:
        return jsonify({
            "error": "No hands detected in the recording. Keep at least one hand clearly visible and try again."
        }), 422

    inference_started_at = time.perf_counter()
    predictions = get_prediction(model_input)
    finished_at = time.perf_counter()
    if not predictions:
        return jsonify({"error": "The model could not score this recording. Please try again."}), 500

    timing["model_prediction_seconds"] = round(finished_at - inference_started_at, 3)
    timing["total_seconds"] = round(finished_at - started_at, 3)
    app.logger.info(
        "Prediction %s (%.3f) from %s/%s hand frames in %.3fs",
        predictions[0]["sign"],
        predictions[0]["confidence"],
        len(model_input),
        len(frames),
        timing["total_seconds"],
    )
    return jsonify({
        "sign": predictions[0]["sign"],
        "confidence": predictions[0]["confidence"],
        "predictions": predictions,
        "frames": {"received": int(len(frames)), "with_hands": int(len(model_input))},
        "timing": timing,
    })


@app.route("/predict-landmarks", methods=["POST"])
def predict_landmarks():
    """Classifies landmarks extracted in the browser (float32 [frames, 543, 3])."""
    started_at = time.perf_counter()
    try:
        frames = parse_landmark_upload(request.get_data(cache=False))
    except PredictionInputError as error:
        return jsonify({"error": str(error)}), 400

    load_model()
    return prediction_response(
        frames,
        {"parse_seconds": round(time.perf_counter() - started_at, 3)},
        started_at,
    )


@app.route("/predict", methods=["POST"])
def predict():
    """Fallback: extracts landmarks from an uploaded clip on the server."""
    started_at = time.perf_counter()
    file = request.files.get("video")
    if file is None:
        return jsonify({"error": "No video uploaded"}), 400

    load_model()
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".webm", ".mp4", ".mov", ".mkv"}:
        suffix = ".webm"
    video_path = os.path.join(UPLOAD_FOLDER, f"{uuid4().hex}{suffix}")
    file.save(video_path)
    saved_at = time.perf_counter()

    try:
        frames = process_video(video_path)
    except PredictionInputError as error:
        return jsonify({"error": str(error)}), 422
    finally:
        try:
            os.remove(video_path)
        except OSError:
            pass

    processed_at = time.perf_counter()
    return prediction_response(
        frames,
        {
            "upload_save_seconds": round(saved_at - started_at, 3),
            "video_processing_seconds": round(processed_at - saved_at, 3),
        },
        started_at,
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": prediction_fn is not None,
        "video_fallback_loaded": holistic is not None,
    })


@app.route("/warmup", methods=["GET"])
def warmup():
    """Loads the classifier before the user submits a recording."""
    started_at = time.perf_counter()
    load_model()
    elapsed = time.perf_counter() - started_at
    if elapsed > 0.05:
        app.logger.info("Model warmup completed in %.3fs", elapsed)
    return jsonify({"status": "ready", "warmup_seconds": round(elapsed, 3)})


# Keep service boot light so Render can accept /health requests immediately.
# The classifier loads on /warmup (sent when the detection page opens) or on
# the first prediction; MediaPipe loads only if the video fallback is used.


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
