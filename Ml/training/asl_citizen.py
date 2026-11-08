"""ASL Citizen landmarks (from extract_asl_citizen.py) for training and testing.

ASL Citizen (Microsoft Research) has webcam recordings of 51 Deaf and hard of
hearing signers, split by signer into train/val/test. Its licence allows
non-commercial research use only: never commit or publish the videos or the
landmarks (asl_citizen/ is git-ignored).

Each clip goes through the backend's own conversion (3:4 aspect, 30 fps),
exactly like a live webcam recording, so training and testing see what the
app sees.

    python asl_citizen.py --data asl_citizen --out asl_citizen/cache_train --splits train
    python asl_citizen.py --data asl_citizen --out asl_citizen/cache_val --splits val
    python asl_citizen.py --merge cache asl_citizen/cache_train --repeat 5 --out asl_citizen/cache_mix
"""

import argparse
import glob
import os

import numpy as np
import pandas as pd

import backend
from landmarks import CACHE_ROWS

# Participant ids in the training cache start here, clear of Kaggle's.
PARTICIPANT_OFFSET = 1_000_000

# ASL Citizen glosses that are a different sign from SignEase's sign of the
# same name (another meaning, or another word matched by meaning). Chosen on
# the train and val signers only: the shipped models recognise them as the
# SignEase sign in under 25% of clips, while a sibling variant (e.g. CAN1 for
# CAN2) is recognised in 60% or more.
EXCLUDED_GLOSSES = {
    "CAN2", "CARROT2", "CLOSET2", "CRY2", "CRY3", "CRY4", "DOG3", "DUCK1", "EMPTY2", "FALL1", "FIREMAN2",
    "GLASS2", "HAIR2", "HAT2", "NUT2", "PIZZA1", "SHOP2", "TALK2", "TOY2", "TOY3", "UNDERWEAR1",
    # Matched by meaning, but signed differently (recognised in 0-26% of clips).
    "TRASH", "IN", "EACH", "NEXTTO", "TEETH",
}


def load_clips(data_dir, splits=None):
    """Yields (manifest row, prepared [T, 543, 3] frames) in manifest order."""
    manifest = pd.read_csv(os.path.join(data_dir, "manifest.csv"))
    manifest = manifest[~manifest["gloss"].isin(EXCLUDED_GLOSSES)]
    if splits:
        manifest = manifest[manifest["split"].isin(splits)]
    wanted = set(manifest["video"])
    rows = manifest.set_index("video")
    for path in sorted(glob.glob(os.path.join(data_dir, "chunk_*.npz"))):
        chunk = np.load(path)
        starts = np.concatenate([[0], np.cumsum(chunk["lengths"])])
        for i, video in enumerate(chunk["video"]):
            if video not in wanted or chunk["lengths"][i] < 2:
                continue
            xy = chunk["xy"][starts[i]:starts[i + 1]].astype(np.float32)
            full = np.full((len(xy), backend.ROWS_PER_FRAME, 3), np.nan, np.float32)
            full[:, chunk["rows"], :2] = xy
            full[:, chunk["rows"], 2] = np.where(np.isnan(xy[..., 0]), np.nan, 0.0)
            timestamps = np.arange(len(xy)) * 1000.0 / float(chunk["fps"][i])
            yield rows.loc[video], backend.prepare_frames(full, timestamps, float(chunk["aspect"][i]))


def signing_span(frames):
    """The span with clear hand motion (as the backend's segment search finds
    it), so resting hands before and after the sign are left out."""
    hands = np.flatnonzero(backend.hand_frame_mask(frames))
    if len(hands) == 0:
        return None
    start, end = int(hands[0]), int(hands[-1]) + 1
    motion = backend.hand_motion(frames)[start:end]
    if motion.max() > 0:
        active = np.flatnonzero(motion > 0.2 * motion.max()) + start
        start, end = max(start, int(active[0]) - 3), min(end, int(active[-1]) + 4)
    return start, end


def build_cache(data_dir, out, splits):
    os.makedirs(out, exist_ok=True)
    participants = {}
    clips, meta = [], []
    for row, frames in load_clips(data_dir, splits):
        span = signing_span(frames)
        if span is None or span[1] - span[0] < backend.MIN_WINDOW_FRAMES:
            continue
        clips.append(frames[span[0]:span[1], CACHE_ROWS, :2])
        participant = participants.setdefault(row["participant"], PARTICIPANT_OFFSET + len(participants))
        meta.append({"participant_id": participant, "sequence_id": len(meta), "sign": row["signease_sign"],
                     "source": "asl_citizen", "split": row["split"]})
    offsets = np.concatenate([[0], np.cumsum([len(c) for c in clips])]).astype(np.int64)
    np.save(os.path.join(out, "frames.npy"), np.concatenate(clips).astype(np.float32))
    np.save(os.path.join(out, "offsets.npy"), offsets)
    pd.DataFrame(meta).to_csv(os.path.join(out, "meta.csv"), index=False)
    print(f"{out}: {len(clips)} clips, {offsets[-1]} frames, {len(participants)} signers, "
          f"{pd.DataFrame(meta)['sign'].nunique()} signs")


def merge_caches(base, extra, repeat, out):
    """One training cache: every clip of ``base`` plus ``repeat`` copies of
    every clip of ``extra`` (each copy is augmented differently in training)."""
    from data import load_cache

    os.makedirs(out, exist_ok=True)
    parts = [(load_cache(base), 1), (load_cache(extra), repeat)]
    total = sum(len(frames) * times for (frames, _, _), times in parts)
    shape = (total,) + parts[0][0][0].shape[1:]
    merged = np.lib.format.open_memmap(os.path.join(out, "frames.npy"), mode="w+", dtype=np.float32, shape=shape)
    offsets, metas, position = [0], [], 0
    for (frames, clip_offsets, meta), times in parts:
        for _ in range(times):
            for start in range(0, len(frames), 1_000_000):
                block = np.asarray(frames[start:start + 1_000_000])
                merged[position + start:position + start + len(block)] = block
            offsets.extend((clip_offsets[1:] + position).tolist())
            metas.append(meta.drop(columns=["label"]))
            position += len(frames)
    merged.flush()
    np.save(os.path.join(out, "offsets.npy"), np.asarray(offsets, np.int64))
    pd.concat(metas, ignore_index=True).to_csv(os.path.join(out, "meta.csv"), index=False)
    print(f"{out}: {len(offsets) - 1} clips, {position} frames")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", help="folder with manifest.csv and chunk_*.npz")
    parser.add_argument("--out", required=True)
    parser.add_argument("--splits", nargs="+", default=["train"])
    parser.add_argument("--merge", nargs=2, metavar=("BASE", "EXTRA"), help="merge two caches instead")
    parser.add_argument("--repeat", type=int, default=1, help="copies of EXTRA in the merged cache")
    args = parser.parse_args()
    if args.merge:
        merge_caches(*args.merge, args.repeat, args.out)
        return
    backend.load_labels()
    build_cache(args.data, args.out, args.splits)


if __name__ == "__main__":
    main()
