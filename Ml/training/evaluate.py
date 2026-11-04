"""Scores a .tflite model through the backend's real prediction pipeline.

Test sets:

* dictionary: the 120 sign videos from the dictionary page (landscape, not
  part of the Kaggle data), extracted with extract_videos.py. This is the
  only data here that no model has been trained on.
* kaggle-webcam: clips of the held-out signers (data.HOLDOUT_PARTICIPANTS)
  made webcam-like with augment.webcam (fixed seed).
* kaggle-clean: the same clips, unchanged.

Note: the original model was trained on all 94k Kaggle clips (it scores
100% on them), so the Kaggle sets measure robustness, not generalisation.

    python evaluate.py --model ../ML_Code_ISL/models/asl_model.tflite --passes 2 \
        --cache cache --dictionary dictionary.npz --out scores_original.npz
"""

import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import backend  # noqa: E402

from augment import webcam  # noqa: E402
from data import HOLDOUT_PARTICIPANTS, load_cache  # noqa: E402
from landmarks import expand_cached  # noqa: E402


def use_model(path, passes):
    # The backend borrows sets of interpreters from a pool; give it exactly
    # one set, holding just this model.
    runner = backend.create_runner(backend.import_interpreter(), path)
    while not backend.interpreter_pool.empty():
        backend.interpreter_pool.get_nowait()
    backend.interpreter_pool.put([(runner, 1.0)])
    backend.prediction_fn = runner
    backend.ORD2SIGN = backend.load_labels()
    backend.INFERENCE_PASSES = passes


def score(frames, timestamps=None, aspect=backend.TRAINING_ASPECT_RATIO):
    """Raw probabilities from the backend pipeline (None if it would reject the clip)."""
    if int(backend.hand_frame_mask(frames).sum()) < backend.MIN_HAND_FRAMES:
        return None
    probabilities, _ = backend.score_recording(backend.prepare_frames(frames, timestamps, aspect))
    return probabilities


def dictionary_set(path):
    data = np.load(path)
    labels = sorted({int(key.split("_")[0]) for key in data.files})
    for label in labels:
        yield label, data[f"{label}_frames"], data[f"{label}_timestamps"], float(data[f"{label}_aspect"])


def kaggle_sets(cache, count, seed=1234):
    frames, offsets, meta = load_cache(cache)
    holdout = meta[meta["participant_id"].isin(HOLDOUT_PARTICIPANTS)]
    picks = np.random.default_rng(seed).choice(holdout.index.to_numpy(), count, replace=False)
    clean, simulated = [], []
    for index in picks:
        sample = np.asarray(frames[offsets[index]:offsets[index + 1]])
        label = int(meta.at[index, "label"])
        clean.append((label, sample))
        simulated.append((label, webcam(sample, np.random.default_rng((seed, int(index))))))
    return clean, simulated


def summarise(name, labels, probabilities):
    labels = np.asarray(labels)
    probabilities = np.asarray(probabilities)
    ranks = (probabilities > probabilities[np.arange(len(labels)), labels][:, None]).sum(axis=1)
    nll = -np.log(np.clip(probabilities[np.arange(len(labels)), labels], 1e-12, None)).mean()
    print(
        f"{name:15s} n={len(labels):5d}  top-1 {np.mean(ranks == 0):6.1%}  top-3 {np.mean(ranks < 3):6.1%}"
        f"  mean top-1 prob {probabilities.max(axis=1).mean():.3f}  NLL {nll:.3f}",
        flush=True,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--passes", type=int, default=1, help="2 reproduces the backend for the original model")
    parser.add_argument("--cache")
    parser.add_argument("--dictionary")
    parser.add_argument("--kaggle-count", type=int, default=3000)
    parser.add_argument("--out", help="save raw probabilities (for calibrate.py)")
    args = parser.parse_args()

    use_model(args.model, args.passes)
    results = {}

    if args.dictionary:
        labels, probabilities = [], []
        for label, frames, timestamps, aspect in dictionary_set(args.dictionary):
            p = score(frames, timestamps, aspect)
            if p is not None:
                labels.append(label)
                probabilities.append(p)
        results["dictionary"] = (labels, probabilities)

    if args.cache:
        clean, simulated = kaggle_sets(args.cache, args.kaggle_count)
        for name, clips in (("kaggle-webcam", simulated), ("kaggle-clean", clean)):
            kept = [(label, score(expand_cached(sample))) for label, sample in clips]
            kept = [(label, p) for label, p in kept if p is not None]
            results[name] = ([label for label, _ in kept], [p for _, p in kept])

    for name, (labels, probabilities) in results.items():
        summarise(name, labels, probabilities)
    if args.out:
        np.savez(args.out, **{
            f"{name}_{kind}": np.asarray(values)
            for name, (labels, probabilities) in results.items()
            for kind, values in (("labels", labels), ("probabilities", probabilities))
        })


if __name__ == "__main__":
    main()
