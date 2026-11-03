"""Packs the Kaggle ASL Signs landmark files into one compact cache.

The competition data is 94k parquet files (~40 GB zipped, 56 GB unzipped).
The classifier only reads 94 of the 543 landmarks, and only x/y, so this
keeps just those, as float32, in a single array (a few GB) that training and
evaluation can load into memory.

    python build_cache.py --zip ../ML_Code_ISL/data/train_landmark_files.zip \
        --csv ../ML_Code_ISL/data/train.csv --out cache

Reads straight from the zip (no need to extract it) using all CPU cores.
"""

import argparse
import io
import os
import time
import zipfile
from multiprocessing import Pool

import numpy as np
import pandas as pd

from landmarks import CACHE_ROWS, ROWS_PER_FRAME, TYPE_OFFSETS

_zip = None


def _open(zip_path):
    global _zip
    _zip = zipfile.ZipFile(zip_path)


def _load(name):
    df = pd.read_parquet(io.BytesIO(_zip.read(name)), columns=["frame", "type", "landmark_index", "x", "y"])
    frames = np.sort(df["frame"].unique())
    frame_pos = np.searchsorted(frames, df["frame"].to_numpy())
    rows = df["type"].map(TYPE_OFFSETS).to_numpy() + df["landmark_index"].to_numpy()
    full = np.full((len(frames), ROWS_PER_FRAME, 2), np.nan, dtype=np.float32)
    full[frame_pos, rows, 0] = df["x"].to_numpy()
    full[frame_pos, rows, 1] = df["y"].to_numpy()
    return full[:, CACHE_ROWS]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--zip", required=True)
    parser.add_argument("--csv", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--workers", type=int, default=os.cpu_count())
    parser.add_argument("--limit", type=int, default=0, help="only the first N recordings (for testing)")
    args = parser.parse_args()

    meta = pd.read_csv(args.csv)
    if args.limit:
        meta = meta.iloc[: args.limit]
    names = [path.removeprefix("train_landmark_files/") for path in meta["path"]]

    started = time.time()
    chunks, lengths = [], []
    with Pool(args.workers, initializer=_open, initargs=(args.zip,)) as pool:
        for index, sample in enumerate(pool.imap(_load, names, chunksize=16)):
            chunks.append(sample)
            lengths.append(len(sample))
            if (index + 1) % 5000 == 0:
                print(f"{index + 1}/{len(names)} in {time.time() - started:.0f}s", flush=True)

    os.makedirs(args.out, exist_ok=True)
    offsets = np.concatenate([[0], np.cumsum(lengths)]).astype(np.int64)
    np.save(os.path.join(args.out, "frames.npy"), np.concatenate(chunks))
    np.save(os.path.join(args.out, "offsets.npy"), offsets)
    meta[["participant_id", "sequence_id", "sign"]].to_csv(os.path.join(args.out, "meta.csv"), index=False)
    print(f"Cached {len(names)} recordings, {offsets[-1]} frames, in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()
