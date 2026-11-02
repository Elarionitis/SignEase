"""Exports fine-tuned weights to the backend's .tflite format.

Run this with TensorFlow 2.14 (the version of tflite-runtime the backend
deploys), so every op in the file is one that runtime supports:

    python export.py --weights runs/finetune/best.npz --out ../ML_Code_ISL/models/asl_model.tflite

The output has the same signature as the original model:
``inputs`` [frames, 543, 3] -> ``outputs`` [250] probabilities.
"""

import argparse
import os

import numpy as np

from model import SignModel, export_tflite


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", required=True, help="best.npz from finetune.py")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    arrays = dict(np.load(args.weights))
    norm = {name[len("norm__"):]: value for name, value in arrays.items() if name.startswith("norm__")}
    weights = {name: value for name, value in arrays.items() if not name.startswith("norm__")}
    tmp = args.out + ".tmp"
    export_tflite(SignModel(weights, norm), tmp)
    os.replace(tmp, args.out)
    print(f"wrote {args.out} ({os.path.getsize(args.out) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
