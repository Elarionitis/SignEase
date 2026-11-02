"""Extracts MediaPipe Holistic landmarks from labelled sign videos.

Uses the same Holistic settings as the browser and the backend, and keeps
every frame with its timestamp and the frame aspect ratio, so recordings can
be scored through the real backend pipeline (see evaluate.py).

Videos are named by label index, e.g. the dictionary's ``0.mp4`` is "TV":

    python extract_videos.py --videos ../../ISLRv6/public/videos/signs --out dictionary.npz
"""

import argparse
import os

import cv2
import mediapipe as mp
import numpy as np

LAYOUT = (("face_landmarks", 468), ("left_hand_landmarks", 21), ("pose_landmarks", 33), ("right_hand_landmarks", 21))


def extract(path, holistic):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames, timestamps, aspect = [], [], None
    while True:
        ok, image = cap.read()
        if not ok:
            break
        height, width = image.shape[:2]
        aspect = width / height
        results = holistic.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        frame = np.full((543, 3), np.nan, np.float32)
        offset = 0
        for attr, count in LAYOUT:
            landmarks = getattr(results, attr)
            if landmarks:
                frame[offset:offset + count] = [(p.x, p.y, p.z) for p in landmarks.landmark]
            offset += count
        frames.append(frame)
        timestamps.append(len(timestamps) * 1000.0 / fps)
    cap.release()
    return np.stack(frames), np.asarray(timestamps), aspect


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--videos", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    names = sorted((f for f in os.listdir(args.videos) if f.endswith(".mp4")), key=lambda f: int(f.split(".")[0]))
    holistic_kwargs = dict(
        static_image_mode=False, model_complexity=1, smooth_landmarks=True,
        refine_face_landmarks=False, min_detection_confidence=0.5, min_tracking_confidence=0.5,
    )
    out = {}
    for name in names:
        # A fresh tracker per video, as each recording starts one in the browser.
        with mp.solutions.holistic.Holistic(**holistic_kwargs) as holistic:
            frames, timestamps, aspect = extract(os.path.join(args.videos, name), holistic)
        label = int(name.split(".")[0])
        out[f"{label}_frames"] = frames
        out[f"{label}_timestamps"] = timestamps
        out[f"{label}_aspect"] = np.float32(aspect)
        print(name, frames.shape[0], "frames", f"aspect {aspect:.3f}", flush=True)
    np.savez_compressed(args.out, **out)


if __name__ == "__main__":
    main()
