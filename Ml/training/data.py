"""Loading the landmark cache written by build_cache.py."""

import json
import os

import numpy as np
import pandas as pd

LABEL_MAP = os.path.join(os.path.dirname(__file__), "..", "ML_Code_ISL", "data", "sign_to_prediction_index_map.json")

# Signers held out of fine-tuning, for evaluation and confidence calibration.
# (The original model was trained on all 21 signers, so its scores on any of
# them are optimistic; see README.md.)
HOLDOUT_PARTICIPANTS = (16069, 37779, 62590)


def load_cache(path, mmap=True):
    frames = np.load(os.path.join(path, "frames.npy"), mmap_mode="r" if mmap else None)
    offsets = np.load(os.path.join(path, "offsets.npy"))
    meta = pd.read_csv(os.path.join(path, "meta.csv"))
    with open(LABEL_MAP, encoding="utf-8") as file:
        sign_to_index = json.load(file)
    meta["label"] = meta["sign"].map(sign_to_index).astype(int)
    return frames, offsets, meta
