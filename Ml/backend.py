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
import queue
import threading
import time
import warnings
from contextlib import contextmanager
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
from werkzeug.middleware.proxy_fix import ProxyFix


def env_int(name, default, minimum=1):
    try:
        return max(minimum, int(os.environ.get(name, default)))
    except ValueError:
        return default


def env_float(name, default, minimum, maximum):
    try:
        value = float(os.environ.get(name, default))
    except ValueError:
        return default
    return min(maximum, max(minimum, value)) if np.isfinite(value) else default


app = Flask(__name__)
# Render (and most hosts) terminate TLS at a load balancer and pass the
# client address in X-Forwarded-For; trust exactly one proxy hop so the
# per-client rate limit sees real visitors instead of the balancer.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=env_int("TRUSTED_PROXY_HOPS", 1, minimum=0))
app.config["MAX_CONTENT_LENGTH"] = env_int("MAX_UPLOAD_MB", 8) * 1024 * 1024

cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
CORS(
    app,
    resources={r"/*": {"origins": cors_origins or "*"}},
    max_age=86400,
    expose_headers=["Retry-After"],
)

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
LEFT_SHOULDER_ROW = 468 + 21 + 11
RIGHT_SHOULDER_ROW = 468 + 21 + 12

# The classifier only reads 40 lip points, both hands and 5 points of each
# arm (x/y); the segment finder also uses the shoulders. Browsers can upload
# just these rows ("X-Landmark-Layout: compact-v1"), which is about 6x
# smaller than full frames and gives the model exactly what it was trained
# on (training/landmarks.py CACHE_ROWS: every other row was NaN in training).
# Keep this order in sync with COMPACT_ROWS in ISLRv6/lib/holistic.ts.
LIP_ROWS = (
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314, 405, 321, 375,
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
)
COMPACT_ROWS = np.array(
    LIP_ROWS
    + tuple(range(468, 489))
    + tuple(range(522, 543))
    + (LEFT_SHOULDER_ROW, RIGHT_SHOULDER_ROW)
    + tuple(range(502, 512)),
    dtype=np.intp,
)
COMPACT_LAYOUT = "compact-v1"

# The model was trained on ~30 fps clips trimmed to the sign itself. Recordings
# are resampled to this rate by timestamp, and the signing segment is found
# before scoring, because slower tracking and the time spent raising, holding
# and lowering the hands cut the model's confidence by more than half.
MODEL_FPS = 30
# Gaps in hand tracking longer than this are left empty instead of being
# bridged with invented motion.
MAX_INTERPOLATION_GAP_SECONDS = 0.25
MIN_WINDOW_FRAMES = 8

# MediaPipe coordinates are fractions of the frame's width and height, so hand
# shapes depend on the frame's aspect ratio. The training videos are portrait
# phone recordings (about 3:4); a 4:3 webcam squeezes every shape to ~56% of
# its width, which cut the correct sign's probability ~6x in testing.
# Coordinates are re-expressed as if the frame were a centred 3:4 crop.
TRAINING_ASPECT_RATIO = 3 / 4
DEFAULT_CAMERA_ASPECT_RATIO = 4 / 3

# The model is underconfident (it was trained with 0.25 label smoothing), so
# confidence is temperature-scaled to match how often predictions are right
# on real sign videos; it never changes the ranking. Fitted for the current
# model on the 120 dictionary videos (10-fold cross-validated calibration
# error 0.07, bootstrap 90% interval 0.83-0.94). Refit it with
# training/calibrate.py whenever the model changes.
CONFIDENCE_TEMPERATURE = env_float("CONFIDENCE_TEMPERATURE", 0.89, 0.1, 1.0)

# Landmark uploads: ~30 fps for the 10 second maximum recording, with headroom.
MAX_LANDMARK_FRAMES = env_int("MAX_LANDMARK_FRAMES", 600)
MIN_HAND_FRAMES = env_int("MIN_HAND_FRAMES", 4)
TOP_K = 3
# The current model is deterministic. Models exported before it randomly
# dropped 25% of frames on every run; for those, set this to 2+ to average
# several runs of the chosen segment.
INFERENCE_PASSES = env_int("INFERENCE_PASSES", 1)

# Video fallback. Holistic is the expensive step, so cap how many frames it
# runs on; the cap still covers a 3 second clip at 15 fps.
FRAME_SAMPLE_RATE = env_int("FRAME_SAMPLE_RATE", 2)
MAX_SAMPLED_FRAMES = env_int("MAX_SAMPLED_FRAMES", 48)
MAX_VIDEO_FRAME_WIDTH = env_int("MAX_VIDEO_FRAME_WIDTH", 640)

# --- Capacity -------------------------------------------------------------
# A TFLite interpreter is not thread-safe, so each concurrent prediction
# needs its own. Each copy costs ~45 MB; two fit Render's 512 MB instance
# next to the video fallback and let one visitor's prediction run while
# another's is still scoring.
INFERENCE_WORKERS = env_int("INFERENCE_WORKERS", 2)
# Landmark predictions take well under a second, so a short wait for a free
# interpreter is better than an error. Beyond this queue depth, answer 503
# with Retry-After immediately so threads stay free for health checks and the
# browser retries with backoff instead of piling onto a busy server.
MAX_QUEUED_PREDICTIONS = env_int("MAX_QUEUED_PREDICTIONS", 8)
PREDICTION_QUEUE_TIMEOUT_SECONDS = env_float("PREDICTION_QUEUE_TIMEOUT_SECONDS", 15, 1, 120)
# The video fallback runs MediaPipe on the server for seconds per clip. Allow
# one at a time plus a small queue, so a burst of fallback users cannot tie
# up every worker thread and stall the fast landmark path.
MAX_QUEUED_VIDEO_PREDICTIONS = env_int("MAX_QUEUED_VIDEO_PREDICTIONS", 2)
VIDEO_QUEUE_TIMEOUT_SECONDS = env_float("VIDEO_QUEUE_TIMEOUT_SECONDS", 30, 1, 120)
BUSY_RETRY_AFTER_SECONDS = 2
# Per-client limit on prediction requests (token bucket). Generous for a
# person signing, but stops a single script from starving everyone else.
RATE_LIMIT_PER_MINUTE = env_int("RATE_LIMIT_PER_MINUTE", 40, minimum=0)
RATE_LIMIT_BURST = env_int("RATE_LIMIT_BURST", 10)

interpreter_pool = queue.Queue()
prediction_fn = None
ORD2SIGN = None
holistic = None
holistic_lock = threading.Lock()
model_load_lock = threading.Lock()
holistic_load_lock = threading.Lock()


class AdmissionGate:
    """Bounds how many requests may run or wait for a scarce resource."""

    def __init__(self, limit):
        self.limit = limit
        self.active = 0
        self.lock = threading.Lock()

    @contextmanager
    def admit(self):
        """Yields True if the request may proceed, False if it should be
        turned away; the slot is released when the block exits."""
        with self.lock:
            admitted = self.active < self.limit
            if admitted:
                self.active += 1
        try:
            yield admitted
        finally:
            if admitted:
                with self.lock:
                    self.active -= 1


class RateLimiter:
    """In-memory token bucket per client address. Per worker process, which
    is fine for abuse protection; it is not an exact global quota."""

    def __init__(self, per_minute, burst, max_clients=10_000):
        self.rate = per_minute / 60.0
        self.burst = float(burst)
        self.max_clients = max_clients
        self.buckets = {}
        self.lock = threading.Lock()

    def check(self, client):
        """Returns 0 if allowed, else seconds until the next request is."""
        if self.rate <= 0:
            return 0
        now = time.monotonic()
        with self.lock:
            if len(self.buckets) > self.max_clients:
                stale = now - self.burst / self.rate
                self.buckets = {key: value for key, value in self.buckets.items() if value[1] > stale}
            tokens, updated = self.buckets.get(client, (self.burst, now))
            tokens = min(self.burst, tokens + (now - updated) * self.rate)
            if tokens < 1:
                self.buckets[client] = (tokens, now)
                return max(1, int(np.ceil((1 - tokens) / self.rate)))
            self.buckets[client] = (tokens - 1, now)
            return 0


prediction_gate = AdmissionGate(INFERENCE_WORKERS + MAX_QUEUED_PREDICTIONS)
video_gate = AdmissionGate(1 + MAX_QUEUED_VIDEO_PREDICTIONS)
rate_limiter = RateLimiter(RATE_LIMIT_PER_MINUTE, RATE_LIMIT_BURST)
stats = {"predictions": 0, "rejected_busy": 0, "rejected_rate_limit": 0}
stats_lock = threading.Lock()


def count(stat):
    with stats_lock:
        stats[stat] += 1


def busy_response(message):
    count("rejected_busy")
    response = jsonify({"error": message, "retry": True})
    response.status_code = 503
    response.headers["Retry-After"] = str(BUSY_RETRY_AFTER_SECONDS)
    return response


class ServerBusy(Exception):
    """No interpreter became free in time."""


class PredictionInputError(ValueError):
    """Raised when an upload cannot be turned into model input."""


@app.before_request
def limit_prediction_rate():
    if request.method != "POST" or request.endpoint not in {"predict", "predict_landmarks"}:
        return None
    retry_after = rate_limiter.check(request.remote_addr or "unknown")
    if not retry_after:
        return None
    count("rejected_rate_limit")
    response = jsonify({
        "error": "Too many predictions in a short time. Please wait a few seconds and try again.",
        "retry": True,
    })
    response.status_code = 429
    response.headers["Retry-After"] = str(retry_after)
    return response


@app.after_request
def no_store(response):
    # Predictions and status must never be cached by a browser or CDN.
    response.headers.setdefault("Cache-Control", "no-store")
    return response


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
    global prediction_fn, ORD2SIGN

    if prediction_fn is not None:
        return

    with model_load_lock:
        if prediction_fn is not None:
            return

        if not os.path.isfile(TFLITE_MODEL_PATH):
            raise RuntimeError(f"Missing ML model: {TFLITE_MODEL_PATH}")

        Interpreter = import_interpreter()
        labels = load_labels()
        runners = [create_runner(Interpreter) for _ in range(INFERENCE_WORKERS)]
        for runner in runners:
            interpreter_pool.put(runner)

        ORD2SIGN = labels
        # Set last: it marks the model as ready for other threads.
        prediction_fn = runners[0]
        app.logger.info("Loaded the sign model (%s interpreters)", len(runners))


def import_interpreter():
    try:
        from tflite_runtime.interpreter import Interpreter

        return Interpreter
    except ImportError:
        pass
    # tflite-runtime has no wheels for macOS or Python 3.12+; LiteRT (its
    # successor) or full TensorFlow work for local development.
    try:
        from ai_edge_litert.interpreter import Interpreter

        return Interpreter
    except ImportError:
        pass
    try:
        import tensorflow as tf

        return tf.lite.Interpreter
    except ImportError as error:
        raise RuntimeError(
            "tflite-runtime is required for inference; install the pinned "
            "dependency from requirements.txt"
        ) from error


def create_runner(Interpreter):
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

    # The first invocation allocates tensors; do it here instead of inside
    # the user's first prediction.
    warm_input = np.full((1, ROWS_PER_FRAME, COORDINATES), np.nan, dtype=np.float32)
    warm_input[:, RIGHT_HAND_ROWS] = 0.5
    runner(inputs=warm_input)
    # Keep the interpreter alive alongside its runner.
    runner.interpreter = model
    return runner


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


def resample_frames(frames, timestamps_ms, fps=MODEL_FPS):
    """Linearly interpolates frames onto a uniform ``fps`` time grid."""
    times = (np.asarray(timestamps_ms, dtype=np.float64) - timestamps_ms[0]) / 1000.0
    count = int(round(times[-1] * fps)) + 1
    if len(frames) < 2 or count < 2:
        return frames

    grid = np.arange(count) / fps
    before = np.clip(np.searchsorted(times, grid, side="right") - 1, 0, len(times) - 1)
    after = np.minimum(before + 1, len(times) - 1)
    gap = times[after] - times[before]
    weight = np.where(gap > 0, (grid - times[before]) / np.where(gap > 0, gap, 1), 0.0)
    weight = np.clip(weight, 0.0, 1.0)[:, None, None]

    blended = frames[before] * (1 - weight) + frames[after] * weight
    nearest = np.where(weight < 0.5, frames[before], frames[after])
    # Where one side is missing (e.g. a hand appears), use the nearest frame.
    resampled = np.where(np.isfinite(blended), blended, nearest)

    # Don't bridge long tracking gaps with made-up hand motion.
    distance = np.minimum(grid - times[before], times[after] - grid)
    long_gap = (gap > MAX_INTERPOLATION_GAP_SECONDS) & (distance > 1.0 / fps)
    resampled[long_gap, LEFT_HAND_ROWS] = np.nan
    resampled[long_gap, RIGHT_HAND_ROWS] = np.nan
    return resampled.astype(np.float32)


def to_training_aspect(frames, aspect_ratio):
    """Rescales x so landmarks match a 3:4 portrait frame of the same height."""
    if not np.isfinite(aspect_ratio) or abs(aspect_ratio - TRAINING_ASPECT_RATIO) < 1e-3:
        return frames
    converted = frames.copy()
    converted[..., 0] = 0.5 + (converted[..., 0] - 0.5) * (aspect_ratio / TRAINING_ASPECT_RATIO)
    return converted


def calibrate(scores):
    """Temperature-scales softmax probabilities."""
    logits = np.log(np.clip(scores, 1e-12, None)) / CONFIDENCE_TEMPERATURE
    logits -= logits.max()
    calibrated = np.exp(logits)
    return calibrated / calibrated.sum()


def hand_motion(frames):
    """Per-frame hand speed, in shoulder widths per frame, lightly smoothed."""
    hands = np.concatenate([frames[:, LEFT_HAND_ROWS, :2], frames[:, RIGHT_HAND_ROWS, :2]], axis=1)
    shoulders = frames[:, LEFT_SHOULDER_ROW, :2] - frames[:, RIGHT_SHOULDER_ROW, :2]
    # Frames without hands or shoulders are all-NaN slices; that's expected.
    with warnings.catch_warnings(), np.errstate(all="ignore"):
        warnings.simplefilter("ignore", RuntimeWarning)
        scale = np.nanmedian(np.linalg.norm(shoulders, axis=1))
        if not np.isfinite(scale) or scale < 0.02:
            scale = 0.25
        speed = np.nanmean(np.linalg.norm(np.diff(hands, axis=0), axis=2), axis=1) / scale
    speed = np.concatenate([[0.0], np.nan_to_num(speed)])
    return np.convolve(speed, np.ones(5) / 5, mode="same")


def candidate_windows(frames):
    """Frame ranges that may contain the sign: the whole span with hands, the
    span with clear hand motion, and shorter windows inside it (so raising or
    lowering the hands can be left out)."""
    hand_indices = np.flatnonzero(hand_frame_mask(frames))
    start, end = int(hand_indices[0]), int(hand_indices[-1]) + 1
    windows = {(start, end)}

    motion = hand_motion(frames)[start:end]
    if motion.max() > 0:
        active = np.flatnonzero(motion > 0.2 * motion.max()) + start
        active_start, active_end = int(active[0]), int(active[-1]) + 1
        windows.add((max(start, active_start - 3), min(end, active_end + 3)))
        length = active_end - active_start
        for fraction in (0.75, 0.5):
            size = max(12, int(length * fraction))
            if size >= length:
                continue
            for offset in np.linspace(active_start, active_end - size, 3).astype(int):
                windows.add((int(offset), int(offset) + size))

    return sorted(windows)


def hand_frames_in(frames, window):
    selected = frames[window[0]:window[1]]
    return np.ascontiguousarray(selected[hand_frame_mask(selected)], dtype=np.float32)


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

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not np.isfinite(fps) or not 5 <= fps <= 120:
        fps = MODEL_FPS
    frames = []
    timestamps = []
    aspect_ratio = DEFAULT_CAMERA_ASPECT_RATIO
    frame_index = 0
    # Wait a bounded time for MediaPipe (one clip at a time); the route's
    # admission gate keeps this queue short.
    if not holistic_lock.acquire(timeout=VIDEO_QUEUE_TIMEOUT_SECONDS):
        cap.release()
        raise ServerBusy()
    try:
        while len(frames) < MAX_SAMPLED_FRAMES:
            success, image = cap.read()
            if not success:
                break

            if frame_index % FRAME_SAMPLE_RATE == 0:
                height, width = image.shape[:2]
                aspect_ratio = width / height
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
                timestamps.append(frame_index * 1000.0 / fps)

            frame_index += 1
    finally:
        holistic_lock.release()
        cap.release()

    if not frames:
        raise PredictionInputError("The recording did not contain any video frames. Please record again.")

    return np.stack(frames, axis=0), np.asarray(timestamps), aspect_ratio


def parse_landmark_upload(body, frame_count_header, layout_header=None):
    """Parses float32 frames [N, 543, 3] (or [N, len(COMPACT_ROWS), 3] with
    the compact layout), optionally followed by N float32 capture timestamps
    in milliseconds (sent with an X-Frame-Count header)."""
    if not body:
        raise PredictionInputError("No landmark data uploaded")

    layout = (layout_header or "full").strip().lower()
    if layout not in {"full", COMPACT_LAYOUT}:
        raise PredictionInputError(f"Unknown X-Landmark-Layout {layout_header!r}")
    rows = len(COMPACT_ROWS) if layout == COMPACT_LAYOUT else ROWS_PER_FRAME
    frame_values = rows * COORDINATES
    frame_bytes = frame_values * 4

    timestamps = None
    if frame_count_header:
        try:
            frame_count = int(frame_count_header)
        except ValueError:
            raise PredictionInputError("X-Frame-Count must be an integer") from None
        if frame_count < 1 or len(body) != frame_count * (frame_bytes + 4):
            raise PredictionInputError("Landmark payload size does not match X-Frame-Count")
    elif len(body) % frame_bytes == 0:
        frame_count = len(body) // frame_bytes
    else:
        raise PredictionInputError(
            f"Landmark payload must be float32 frames of {rows}x{COORDINATES} values"
        )

    if frame_count > MAX_LANDMARK_FRAMES:
        raise PredictionInputError(
            f"Recording is too long ({frame_count} frames, maximum {MAX_LANDMARK_FRAMES})"
        )

    values = np.frombuffer(body, dtype="<f4")
    uploaded = values[:frame_count * frame_values].reshape(frame_count, rows, COORDINATES)
    # Infinity is never a valid landmark; treat it as "not detected" like NaN.
    uploaded = np.where(np.isfinite(uploaded), uploaded, np.nan).astype(np.float32)
    if layout == COMPACT_LAYOUT:
        frames = np.full((frame_count, ROWS_PER_FRAME, COORDINATES), np.nan, dtype=np.float32)
        frames[:, COMPACT_ROWS] = uploaded
    else:
        frames = uploaded

    if frame_count_header:
        timestamps = values[frame_count * frame_values:].astype(np.float64)
        if not np.all(np.isfinite(timestamps)) or np.any(np.diff(timestamps) <= 0):
            raise PredictionInputError("Frame timestamps must be finite and increasing")
    return frames, timestamps


class pooled_runner:
    """Borrows an interpreter for one prediction (all its windows), waiting
    a bounded time for one to free up."""

    def __enter__(self):
        try:
            self.runner = interpreter_pool.get(timeout=PREDICTION_QUEUE_TIMEOUT_SECONDS)
        except queue.Empty:
            raise ServerBusy() from None
        return self.runner

    def __exit__(self, *exc_info):
        interpreter_pool.put(self.runner)


def run_model(runner, model_input):
    outputs = runner(inputs=model_input)["outputs"]
    return np.asarray(outputs, dtype=np.float64).reshape(-1)


def parse_aspect_ratio(header):
    """Camera frame width / height, sent by the browser as X-Frame-Aspect."""
    if not header:
        return DEFAULT_CAMERA_ASPECT_RATIO
    try:
        aspect_ratio = float(header)
    except ValueError:
        raise PredictionInputError("X-Frame-Aspect must be a number") from None
    if not np.isfinite(aspect_ratio) or not 0.2 <= aspect_ratio <= 5:
        raise PredictionInputError("X-Frame-Aspect must be between 0.2 and 5")
    return aspect_ratio


def prepare_frames(frames, timestamps_ms, aspect_ratio):
    """Converts a recording to what the model was trained on: 3:4 portrait
    coordinates at 30 fps."""
    frames = to_training_aspect(frames, aspect_ratio)
    if timestamps_ms is not None:
        frames = resample_frames(frames, timestamps_ms)
    return frames


def score_recording(frames):
    """Uncalibrated class probabilities for a prepared recording, and the
    number of frames they came from.

    Every candidate window is scored once. The sign is the one with the
    highest average across windows (so a single odd window cannot pick it),
    and the scores come from the window that shows it most clearly.
    """
    windows = [
        model_input
        for model_input in (hand_frames_in(frames, window) for window in candidate_windows(frames))
        if len(model_input) >= MIN_WINDOW_FRAMES
    ] or [hand_frames_in(frames, (0, len(frames)))]

    with pooled_runner() as runner:
        window_scores = [run_model(runner, model_input) for model_input in windows]
        sign_index = int(np.mean(window_scores, axis=0).argmax())
        best = int(np.argmax([scores[sign_index] for scores in window_scores]))
        outputs = [window_scores[best]] + [
            run_model(runner, windows[best]) for _ in range(INFERENCE_PASSES - 1)
        ]
    return np.mean(outputs, axis=0), len(windows[best])


def get_prediction(frames):
    """Top predictions, best first, with calibrated confidence."""
    load_model()
    scores, frames_used = score_recording(frames)
    if scores.size != len(ORD2SIGN) or not np.all(np.isfinite(scores)):
        app.logger.warning("Model returned unusable scores (size=%s)", scores.size)
        return [], frames_used

    scores = calibrate(scores)
    top_indices = np.argsort(scores)[::-1][:TOP_K]
    return [
        {"sign": ORD2SIGN[int(index)], "confidence": round(float(scores[index]), 4)}
        for index in top_indices
    ], frames_used


def prediction_response(frames, timestamps_ms, aspect_ratio, timing, started_at):
    received = len(frames)
    if int(hand_frame_mask(frames).sum()) < MIN_HAND_FRAMES:
        return jsonify({
            "error": "No hands detected in the recording. Keep at least one hand clearly visible and try again."
        }), 422

    inference_started_at = time.perf_counter()
    try:
        predictions, frames_used = get_prediction(prepare_frames(frames, timestamps_ms, aspect_ratio))
    except ServerBusy:
        return busy_response("The prediction server is busy right now. Retrying shortly…")
    finished_at = time.perf_counter()
    if not predictions:
        return jsonify({"error": "The model could not score this recording. Please try again."}), 500

    count("predictions")
    timing["model_prediction_seconds"] = round(finished_at - inference_started_at, 3)
    timing["total_seconds"] = round(finished_at - started_at, 3)
    app.logger.info(
        "Prediction %s (%.3f) from %s of %s frames in %.3fs",
        predictions[0]["sign"],
        predictions[0]["confidence"],
        frames_used,
        received,
        timing["total_seconds"],
    )
    return jsonify({
        "sign": predictions[0]["sign"],
        "confidence": predictions[0]["confidence"],
        "predictions": predictions,
        "frames": {"received": int(received), "used": int(frames_used)},
        "timing": timing,
    })


@app.route("/predict-landmarks", methods=["POST"])
def predict_landmarks():
    """Classifies landmarks extracted in the browser (float32 [frames, 543, 3])."""
    started_at = time.perf_counter()
    with prediction_gate.admit() as admitted:
        if not admitted:
            return busy_response("The prediction server is busy right now. Retrying shortly…")
        try:
            frames, timestamps = parse_landmark_upload(
                request.get_data(cache=False),
                request.headers.get("X-Frame-Count"),
                request.headers.get("X-Landmark-Layout"),
            )
            aspect_ratio = parse_aspect_ratio(request.headers.get("X-Frame-Aspect"))
        except PredictionInputError as error:
            return jsonify({"error": str(error)}), 400

        load_model()
        return prediction_response(
            frames,
            timestamps,
            aspect_ratio,
            {"parse_seconds": round(time.perf_counter() - started_at, 3)},
            started_at,
        )


@app.route("/predict", methods=["POST"])
def predict():
    """Fallback: extracts landmarks from an uploaded clip on the server."""
    started_at = time.perf_counter()
    with video_gate.admit() as admitted:
        if not admitted:
            return busy_response("The prediction server is busy with other recordings. Retrying shortly…")
        return predict_video(started_at)


def predict_video(started_at):
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
        frames, timestamps, aspect_ratio = process_video(video_path)
    except PredictionInputError as error:
        return jsonify({"error": str(error)}), 422
    except ServerBusy:
        return busy_response("The prediction server is busy with other recordings. Retrying shortly…")
    finally:
        try:
            os.remove(video_path)
        except OSError:
            pass

    processed_at = time.perf_counter()
    return prediction_response(
        frames,
        timestamps,
        aspect_ratio,
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
        "capacity": {
            "interpreters": INFERENCE_WORKERS,
            "interpreters_free": interpreter_pool.qsize(),
            "landmark_requests_in_flight": prediction_gate.active,
            "video_requests_in_flight": video_gate.active,
        },
        "stats": dict(stats),
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
