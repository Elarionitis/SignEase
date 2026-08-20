import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
threads = int(os.environ.get("GUNICORN_THREADS", "1"))
worker_class = "sync"
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "240"))
graceful_timeout = 30
keepalive = 5
errorlog = "-"
capture_output = True
loglevel = "info"
# Do not preload ML resources in the Gunicorn master process.  One worker is
# enough for the small Render instance and avoids duplicate high-memory state.
preload_app = False
# Periodically recycle the worker to release native MediaPipe/OpenCV allocations.
max_requests = int(os.environ.get("GUNICORN_MAX_REQUESTS", "30"))
max_requests_jitter = int(os.environ.get("GUNICORN_MAX_REQUESTS_JITTER", "5"))
worker_tmp_dir = "/dev/shm" if os.path.isdir("/dev/shm") else None
