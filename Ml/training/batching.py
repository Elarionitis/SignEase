"""Parallel preprocessing of cached recordings into model batches."""

import os
from multiprocessing import Pool

import numpy as np

from model import preprocess_cached

_state = {}


def _init(cache_path, transform, seed):
    from data import load_cache

    frames, offsets, _ = load_cache(cache_path)
    _state.update(frames=frames, offsets=offsets, transform=transform, seed=seed)


def _work(args):
    index, epoch = args
    sample = np.asarray(_state["frames"][_state["offsets"][index]:_state["offsets"][index + 1]])
    transform = _state["transform"]
    if transform is not None:
        rng = np.random.default_rng((_state["seed"], epoch, index))
        sample = transform(sample, rng)
    return preprocess_cached(sample)


class Preprocessor:
    """Preprocesses recordings (optionally transformed) on all CPU cores."""

    def __init__(self, cache_path, transform=None, seed=0, workers=None):
        self.pool = Pool(workers or max(1, os.cpu_count() - 1), _init, (cache_path, transform, seed))

    def batches(self, indices, batch_size, epoch=0):
        results = self.pool.imap(_work, [(int(i), epoch) for i in indices], chunksize=32)
        data, idxs = [], []
        for d, i in results:
            data.append(d)
            idxs.append(i)
            if len(data) == batch_size:
                yield np.stack(data), np.stack(idxs)
                data, idxs = [], []
        if data:
            yield np.stack(data), np.stack(idxs)

    def close(self):
        self.pool.close()
        self.pool.join()
