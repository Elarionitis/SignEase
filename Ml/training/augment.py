"""Augmentations that make the Kaggle clips look like webcam recordings.

All transforms work on cache frames [N, 94, 2] (see landmarks.CACHE_ROWS),
in normalised image coordinates of a 3:4 portrait frame, the format the
backend converts every recording to.

* aspect / framing: the classifier normalises absolute frame coordinates,
  so where and how large the signer appears changes its input. The Kaggle
  videos are ~3:4 portrait but per-signer estimates range 0.68-0.87, and a
  webcam (converted to 3:4 by the backend) frames people differently again.
* start / end padding: Kaggle clips are trimmed to the sign. Webcam
  recordings start and end with the hands rising from below the frame,
  holding still, and lowering again; the backend's segment finder removes
  most, but not all, of this.
* speed and tracking dropouts.
"""

import numpy as np

from landmarks import CACHE_ROWS, cache_index

PORTRAIT_ASPECT = 3 / 4  # width / height

LEFT_HAND = cache_index(np.arange(468, 489))
RIGHT_HAND = cache_index(np.arange(522, 543))
# Pose rows that move with each hand (wrist, pinky, index, thumb) and elbows.
LEFT_ARM = cache_index(np.array([504, 506, 508, 510]))
RIGHT_ARM = cache_index(np.array([505, 507, 509, 511]))
LEFT_ELBOW = cache_index(np.array([502]))
RIGHT_ELBOW = cache_index(np.array([503]))
assert len(CACHE_ROWS) == 94


def reframe(frames, scale, x_stretch, shift, angle):
    """Scales/rotates about the frame centre (in pixel space) and shifts."""
    x = (frames[..., 0] - 0.5) * PORTRAIT_ASPECT
    y = frames[..., 1] - 0.5
    cos, sin = np.cos(angle), np.sin(angle)
    x, y = cos * x - sin * y, sin * x + cos * y
    out = np.empty_like(frames)
    out[..., 0] = 0.5 + x * scale * x_stretch / PORTRAIT_ASPECT + shift[0]
    out[..., 1] = 0.5 + y * scale + shift[1]
    return out


def change_speed(frames, factor):
    """Resamples to len / factor frames (linear, nearest where a side is missing)."""
    n = len(frames)
    m = max(2, int(round(n / factor)))
    if n < 2 or m == n:
        return frames
    position = np.linspace(0, n - 1, m)
    before = np.floor(position).astype(int)
    after = np.minimum(before + 1, n - 1)
    weight = (position - before)[:, None, None]
    blended = frames[before] * (1 - weight) + frames[after] * weight
    nearest = np.where(weight < 0.5, frames[before], frames[after])
    return np.where(np.isnan(blended), nearest, blended).astype(np.float32)


def _approach(frame, steps, rng):
    """Frames of the hands moving from below the frame to ``frame`` (in order)."""
    out = np.repeat(frame[None], steps, axis=0)
    for hand, arm, elbow in ((LEFT_HAND, LEFT_ARM, LEFT_ELBOW), (RIGHT_HAND, RIGHT_ARM, RIGHT_ELBOW)):
        if np.isnan(frame[hand, 1]).all():
            continue
        # Wrist ends a little below the bottom edge.
        drop = max(0.0, 1.05 + rng.uniform(0, 0.1) - np.nanmin(frame[hand, 1]))
        for step in range(steps):
            offset = drop * (1 - step / steps)
            out[step, hand, 1] += offset
            out[step, arm, 1] += offset
            out[step, elbow, 1] += offset * 0.5
            if np.nanmin(out[step, hand, 1]) > 1.0:
                out[step, hand] = np.nan  # out of view: Holistic loses it
    return out


def pad_start_end(frames, rng, p=0.5):
    """Adds a raise + hold before the sign and/or a hold + lower after it."""
    parts = []
    if rng.random() < p:
        hold = np.repeat(frames[:1], rng.integers(0, 16), axis=0)
        parts += [_approach(frames[0], int(rng.integers(6, 16)), rng), hold]
    parts.append(frames)
    if rng.random() < p:
        hold = np.repeat(frames[-1:], rng.integers(0, 16), axis=0)
        parts += [hold, _approach(frames[-1], int(rng.integers(6, 16)), rng)[::-1]]
    out = np.concatenate(parts)
    if len(out) != len(frames):
        out = out + rng.normal(0, 0.002, out.shape).astype(np.float32)  # tracking jitter
    return out


def drop_hand_frames(frames, rng, rate):
    """Hand tracking misses a few frames."""
    out = frames.copy()
    for hand in (LEFT_HAND, RIGHT_HAND):
        missing = rng.random(len(out)) < rate
        out[np.ix_(missing, hand)] = np.nan
    return out


def webcam(frames, rng, strength=1.0):
    """The full augmentation (also used, with a fixed seed, as the
    'webcam simulation' test set)."""
    frames = change_speed(frames, np.exp(rng.uniform(-0.3, 0.3) * strength))
    frames = pad_start_end(frames, rng)
    frames = reframe(
        frames,
        scale=np.exp(rng.uniform(-0.2, 0.2) * strength),
        x_stretch=np.exp(rng.uniform(-0.15, 0.15) * strength),
        shift=rng.uniform(-0.08, 0.08, 2) * strength,
        angle=np.deg2rad(rng.uniform(-8, 8) * strength),
    )
    if rng.random() < 0.5:
        frames = drop_hand_frames(frames, rng, rng.uniform(0, 0.1))
    return frames.astype(np.float32)


def train_transform(frames, rng):
    """Training mix: mostly webcam-like, sometimes the clean clip."""
    if rng.random() < 0.2:
        return frames
    return webcam(frames, rng)
