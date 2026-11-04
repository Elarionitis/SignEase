"""Compares .tflite models on the dictionary videos through the backend pipeline.

The videos are split by label: even labels are the dev set, used to choose
between models and options; odd labels are the test set, only scored with
--final, once the choice is made. Otherwise repeated comparisons would
quietly tune the choice to the test videos.

    python compare.py --dictionary dictionary.npz --model current=a.tflite new=b.tflite
    python compare.py --dictionary dictionary.npz --final --model current=a.tflite new=b.tflite

A model name ending in "+variants" keeps the backend's per-hand variants,
"-variants" scores the recording as is.
"""

import argparse
import math

import numpy as np

from evaluate import backend, dictionary_set, use_model


def groups(frames):
    """Whether a prepared recording has two tracked hands / hands below the shoulders."""
    left = (~np.all(np.isnan(frames[:, backend.LEFT_HAND_ROWS, 0]), axis=1)).sum()
    right = (~np.all(np.isnan(frames[:, backend.RIGHT_HAND_ROWS, 0]), axis=1)).sum()
    two_hands = left >= backend.MIN_HAND_FRAMES and right >= backend.MIN_HAND_FRAMES
    with np.errstate(all="ignore"):
        hands = np.concatenate([frames[:, backend.LEFT_HAND_ROWS, 1], frames[:, backend.RIGHT_HAND_ROWS, 1]], axis=1)
        shoulders = (frames[:, backend.LEFT_SHOULDER_ROW, 1] + frames[:, backend.RIGHT_SHOULDER_ROW, 1]) / 2
        low = np.nanmedian(hands) > np.nanmedian(shoulders)
    return bool(two_hands), bool(low)


def score_all(path, recordings, variants):
    use_model(path, 1)
    original = backend.hand_variants
    if not variants:
        backend.hand_variants = lambda frames: [frames]
    try:
        return np.stack([backend.score_recording(frames)[0] for _, frames in recordings])
    finally:
        backend.hand_variants = original


def accuracy(probabilities, labels, mask):
    p, y = probabilities[mask], labels[mask]
    ranks = (p > p[np.arange(len(y)), y][:, None]).sum(axis=1)
    return f"top-1 {np.mean(ranks == 0):6.1%}  top-3 {np.mean(ranks < 3):6.1%}  (n={len(y)})"


def sign_test(wins, losses):
    n = wins + losses
    return min(1.0, 2 * sum(math.comb(n, i) for i in range(min(wins, losses) + 1)) / 2 ** n) if n else 1.0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dictionary", required=True)
    parser.add_argument("--model", nargs="+", required=True, help="name[+variants|-variants]=path; the first is the baseline")
    parser.add_argument("--final", action="store_true", help="score the held-back test videos")
    args = parser.parse_args()

    recordings = []
    for label, frames, timestamps, aspect in dictionary_set(args.dictionary):
        if label % 2 != int(args.final):
            continue
        prepared = backend.prepare_frames(frames, timestamps, aspect)
        if int(backend.hand_frame_mask(prepared).sum()) >= backend.MIN_HAND_FRAMES:
            recordings.append((label, prepared))
    labels = np.array([label for label, _ in recordings])
    two_hands, low = map(np.array, zip(*(groups(frames) for _, frames in recordings)))
    everything = np.ones(len(labels), bool)

    print("test videos" if args.final else "dev videos")
    baseline = None
    for spec in args.model:
        name, path = spec.split("=", 1)
        probabilities = score_all(path, recordings, not name.endswith("-variants"))
        print(f"{name}\n  all       {accuracy(probabilities, labels, everything)}"
              f"\n  two hands {accuracy(probabilities, labels, two_hands)}"
              f"\n  low       {accuracy(probabilities, labels, low)}")
        correct = probabilities.argmax(axis=1) == labels
        if baseline is None:
            baseline = correct
        else:
            wins, losses = int((correct & ~baseline).sum()), int((baseline & ~correct).sum())
            print(f"  vs baseline: fixed {wins}, broke {losses}, sign test p={sign_test(wins, losses):.3f}")


if __name__ == "__main__":
    main()
