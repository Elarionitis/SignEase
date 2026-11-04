import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
# One worker keeps the model in memory once on the small Render instance.
# Inside it, INFERENCE_WORKERS interpreters (backend.py) run predictions in
# parallel and the extra threads keep /health and /warmup answering while
# they run. Requests beyond the backend's queue limits get a fast 503 with
# Retry-After, which the browser retries. To scale out, add instances (the
# API is stateless, so Render's load balancer can spread visitors across
# them) or raise WEB_CONCURRENCY on an instance with more memory.
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
threads = int(os.environ.get("GUNICORN_THREADS", "8"))
worker_class = "gthread"
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "120"))
graceful_timeout = 30
# Slightly above typical load balancer idle timeouts so reused connections
# are not closed under the balancer.
keepalive = int(os.environ.get("GUNICORN_KEEPALIVE", "75"))
errorlog = "-"
capture_output = True
loglevel = "info"
# Do not preload ML resources in the Gunicorn master process.
preload_app = False
# Periodically recycle the worker to release native MediaPipe/OpenCV
# allocations left behind by the video fallback.
max_requests = int(os.environ.get("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.environ.get("GUNICORN_MAX_REQUESTS_JITTER", "20"))
worker_tmp_dir = "/dev/shm" if os.path.isdir("/dev/shm") else None


def post_worker_init(worker):
    """Load the model as soon as a worker starts (after boot, a Render wake-up
    or a recycle), in the background so /health answers immediately."""
    import threading

    from backend import app, load_model

    def load():
        try:
            load_model()
        except Exception:
            app.logger.exception("Background model load failed")

    threading.Thread(target=load, name="model-preload", daemon=True).start()
