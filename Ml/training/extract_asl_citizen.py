"""Extracts SignEase landmarks from ASL Citizen videos in a zip.

Uses the same MediaPipe version (0.10.14) and Holistic settings as SignEase.
<dir> must hold manifest.csv (columns video, member, order, priority, plus
signease_sign/gloss/participant/split for asl_citizen.py); chunk_*.npz files
are written there and finished ones are skipped on a rerun:

    python extract_asl_citizen.py <videos.zip> <dir> ours 400 640
"""
import csv, multiprocessing, os, shutil, sys, tempfile, time, zipfile
import numpy as np

ROWS = np.array([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314, 405, 321, 375, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 468, 469, 470, 471, 472, 473, 474, 475, 476, 477, 478, 479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 522, 523, 524, 525, 526, 527, 528, 529, 530, 531, 532, 533, 534, 535, 536, 537, 538, 539, 540, 541, 542, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511])
LAYOUT = (("face_landmarks", 468), ("left_hand_landmarks", 21), ("pose_landmarks", 33), ("right_hand_landmarks", 21))
SETTINGS = dict(static_image_mode=False, model_complexity=1, smooth_landmarks=True,
                refine_face_landmarks=False, min_detection_confidence=0.5, min_tracking_confidence=0.5)
ZIP, MAX_WIDTH = None, 640


def init(zip_path, max_width):
    global ZIP, MAX_WIDTH
    ZIP, MAX_WIDTH = zipfile.ZipFile(zip_path), max_width


def extract(member):
    import cv2
    import mediapipe as mp
    path = os.path.join(tempfile.gettempdir(), "v%d%s" % (os.getpid(), os.path.splitext(member)[1]))
    with open(path, "wb") as f:
        f.write(ZIP.read(member))
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    fps = fps if np.isfinite(fps) and 5 <= fps <= 120 else 30.0
    frames, aspect = [], 0.0
    # A fresh tracker per video, as each recording starts one in the browser.
    with mp.solutions.holistic.Holistic(**SETTINGS) as holistic:
        while True:
            ok, image = cap.read()
            if not ok:
                break
            h, w = image.shape[:2]
            aspect = w / h
            if w > MAX_WIDTH:
                image = cv2.resize(image, (MAX_WIDTH, int(h * MAX_WIDTH / w)), interpolation=cv2.INTER_AREA)
            results = holistic.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
            frame = np.full((543, 2), np.nan, np.float32)
            offset = 0
            for attr, count in LAYOUT:
                lm = getattr(results, attr)
                if lm:
                    frame[offset:offset + count] = [(p.x, p.y) for p in lm.landmark]
                offset += count
            frames.append(frame[ROWS])
    cap.release()
    os.remove(path)
    xy = np.stack(frames).astype(np.float16) if frames else np.zeros((0, len(ROWS), 2), np.float16)
    return member, xy, fps, aspect


def main():
    zip_path, drive_dir, phase = sys.argv[1], sys.argv[2], sys.argv[3]
    chunk_size, max_width = int(sys.argv[4]), int(sys.argv[5])
    work_dir = os.path.dirname(os.path.abspath(zip_path))
    with open(os.path.join(drive_dir, "manifest.csv"), newline="") as f:
        rows = list(csv.DictReader(f))
    ours = [r for r in rows if r["priority"] == "0"]
    rest = [r for r in rows if r["priority"] != "0"]
    split = lambda part: [part[i:i + chunk_size] for i in range(0, len(part), chunk_size)]
    chunks = split(ours) + (split(rest) if phase == "all" else [])
    chunk_file = lambda c: os.path.join(drive_dir, "chunk_%06d.npz" % int(c[0]["order"]))
    left = sum(len(c) for c in chunks if not os.path.exists(chunk_file(c)))
    print("%d videos to do (%d already saved)" % (left, sum(map(len, chunks)) - left), flush=True)
    start, done = time.time(), 0
    pool = multiprocessing.get_context("spawn").Pool(os.cpu_count(), initializer=init, initargs=(zip_path, max_width))
    try:
        for c in chunks:
            out = chunk_file(c)
            if os.path.exists(out):
                continue
            results = list(pool.imap(extract, [r["member"] for r in c], chunksize=2))
            # A different name, so this works when the output folder is work_dir.
            local = os.path.join(work_dir, "writing_" + os.path.basename(out))
            np.savez_compressed(
                local, video=np.array([os.path.basename(r[0]) for r in results]),
                order=np.array([int(r["order"]) for r in c]), lengths=np.array([len(r[1]) for r in results]),
                xy=np.concatenate([r[1] for r in results]), fps=np.array([r[2] for r in results], np.float32),
                aspect=np.array([r[3] for r in results], np.float32), rows=ROWS)
            shutil.copy(local, out + ".tmp")
            os.replace(out + ".tmp", out)
            os.remove(local)
            done += len(c)
            left -= len(c)
            rate = done / (time.time() - start)
            print("saved %s | %.0f videos/hour | %d left, about %.1f h" % (os.path.basename(out), rate * 3600, left, left / rate / 3600), flush=True)
    finally:
        pool.terminate()
    print("Phase", phase, "finished.", flush=True)


if __name__ == "__main__":
    main()
