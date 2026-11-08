"""Scores ASL Citizen clips through the backend pipeline, one process per model.

Clips go through exactly what a webcam recording goes through (aspect
conversion, 30 fps, segment search, hand variants). Saves raw probabilities
per model, so blends can be compared afterwards without rescoring:

    python eval_asl_citizen.py --data asl_citizen --splits val \
        --model live_d=runs/two_hand_d/final214.tflite --out runs/asl_val.npz
"""

import argparse
import os
from multiprocessing import get_context

import numpy as np


def score_model(args):
    name, path, data_dir, splits = args
    os.environ.setdefault("MPLBACKEND", "Agg")
    import backend
    from asl_citizen import load_clips
    from evaluate import use_model

    use_model(path, 1)
    sign_to_index = {sign: index for index, sign in backend.ORD2SIGN.items()}
    labels, probabilities, videos = [], [], []
    for row, frames in load_clips(data_dir, splits):
        labels.append(sign_to_index[row["signease_sign"]])
        videos.append(row.name)
        if int(backend.hand_frame_mask(frames).sum()) < backend.MIN_HAND_FRAMES:
            probabilities.append(np.full(len(backend.ORD2SIGN), 1.0 / len(backend.ORD2SIGN)))
        else:
            probabilities.append(backend.score_recording(frames)[0])
    print(f"{name}: {len(labels)} clips scored", flush=True)
    return name, np.array(labels), np.array(videos), np.stack(probabilities)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--splits", nargs="+", required=True)
    parser.add_argument("--model", nargs="+", required=True, help="name=path.tflite")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    jobs = [(*spec.split("=", 1), args.data, args.splits) for spec in args.model]
    with get_context("spawn").Pool(len(jobs)) as pool:
        results = pool.map(score_model, jobs)
    out = {"labels": results[0][1], "videos": results[0][2]}
    for name, labels, videos, probabilities in results:
        assert (labels == out["labels"]).all() and (videos == out["videos"]).all()
        out[name] = probabilities
        print(f"{name:12s} top-1 {np.mean(probabilities.argmax(1) == labels):.3f}")
    np.savez(args.out, **out)


if __name__ == "__main__":
    main()
