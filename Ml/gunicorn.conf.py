import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
# One worker keeps a single copy of the model in memory on the small Render
# instance. Threads let /health and /warmup answer while a prediction runs;
# the model and MediaPipe are guarded by locks in backend.py.
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
threads = int(os.environ.get("GUNICORN_THREADS", "4"))
worker_class = "gthread"
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "120"))
graceful_timeout = 30
keepalive = 5
errorlog = "-"
capture_output = True
loglevel = "info"
# Do not preload ML resources in the Gunicorn master process.
preload_app = False
# Periodically recycle the worker to release native MediaPipe/OpenCV
# allocations left behind by the video fallback.
max_requests = int(os.environ.get("GUNICORN_MAX_REQUESTS", "200"))
max_requests_jitter = int(os.environ.get("GUNICORN_MAX_REQUESTS_JITTER", "20"))
worker_tmp_dir = "/dev/shm" if os.path.isdir("/dev/shm") else None
