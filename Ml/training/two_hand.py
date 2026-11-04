"""The classifier with a second input for the other hand and arm.

The original model reads one hand (the one tracked in more frames) and drops
the other before anything else happens, so two-handed signs lose half their
information. This adds an embedding of the other hand and arm to the frame
embedding. Its output layer starts at zero, so before training the model
behaves exactly like the one it starts from.

Frames with either hand are kept (the original kept only frames with its
chosen hand), and the other hand is mirrored with the dominant one.

The model reads absolute frame positions, and where a signer sits in the
frame differs a lot: shoulders in the dictionary videos are 20% narrower and
sit 0.14 of a frame higher than in the training clips. So every clip is first
moved and scaled so its shoulders match the training median, in training and
at inference.

The dominant hand is the one that moves more, when both are tracked for most
of the clip. Webcams show the resting hand at the signer's side, which the
close-up training videos rarely do; counting tracked frames then often picks
the still hand. Training adds a resting hand to one-handed clips to match.
"""

import numpy as np
import tensorflow as tf

from landmarks import LEFT_HAND, LEFT_POSE, LIPS, RIGHT_HAND, RIGHT_POSE, cache_index
from model import (
    LEFT_DOMINANT_ROWS,
    N_COLS,
    RIGHT_DOMINANT_ROWS,
    INPUT_SIZE,
    SignModel,
    fit_cached,
    fit_tf,
)

OTHER_COLS = 26
N_COLS_TWO_HAND = N_COLS + OTHER_COLS

LEFT_ROWS = np.concatenate([LEFT_DOMINANT_ROWS, RIGHT_HAND, RIGHT_POSE])
RIGHT_ROWS = np.concatenate([RIGHT_DOMINANT_ROWS, LEFT_HAND, LEFT_POSE])
MIRROR_X = np.r_[np.zeros(len(LIPS)), np.ones(N_COLS_TWO_HAND - len(LIPS))].astype(bool)

_CACHE_LEFT = cache_index(LEFT_ROWS)
_CACHE_RIGHT = cache_index(RIGHT_ROWS)
_CACHE_LEFT_HAND = cache_index(LEFT_HAND)
_CACHE_RIGHT_HAND = cache_index(RIGHT_HAND)
_CACHE_LEFT_POSE_WRIST = cache_index(LEFT_POSE[1:2])[0]
_CACHE_RIGHT_POSE_WRIST = cache_index(RIGHT_POSE[1:2])[0]

# Training: how often a clip with two well-tracked hands treats the other
# hand as dominant (tracking counts say little about which hand signs), and
# how often the other hand is hidden (webcams lose it, and many signs use one).
SWAP_RATE = 0.2
HIDE_OTHER_RATE = 0.15
# Both hands count as tracked if the less-seen one is in half as many frames.
BOTH_TRACKED_RATIO = 0.5
# Training: how often a one-handed clip gets a resting hand, and the hand
# movement ratio below which swapping the dominant hand makes no sense.
RESTING_HAND_RATE = 0.35
RESTING_HAND_MAX_TRACKED = 0.1
SWAP_MIN_MOTION_RATIO = 0.5

# Median shoulder centre and width of the training clips (3:4 frame).
TARGET_CENTER = np.array([0.5, 0.644], np.float32)
TARGET_WIDTH = 0.562
MIN_SCALE, MAX_SCALE = 0.6, 1.7
MIN_SHOULDER_WIDTH = 0.02
LEFT_SHOULDER, RIGHT_SHOULDER = 500, 501
_CACHE_SHOULDERS = cache_index(np.array([LEFT_SHOULDER, RIGHT_SHOULDER]))
# Training: shoulder estimates are noisy, so don't rely on an exact match.
JITTER_SCALE = 0.05
JITTER_SHIFT = 0.03


def hand_counts(frames):
    left = (~np.isnan(frames[:, _CACHE_LEFT_HAND, 0])).sum(axis=1)
    right = (~np.isnan(frames[:, _CACHE_RIGHT_HAND, 0])).sum(axis=1)
    return left, right


def wrist_motion(wrists):
    """Path length of a wrist [N, 2] over consecutive tracked frames."""
    return np.nan_to_num(np.abs(np.diff(wrists, axis=0)), nan=0.0).sum()


def choose_dominant(frames):
    """Returns (left_dominant, motions (left, right), both tracked)."""
    left, right = hand_counts(frames)
    seen_left, seen_right = int((left > 0).sum()), int((right > 0).sum())
    motions = wrist_motion(frames[:, _CACHE_LEFT_HAND[0]]), wrist_motion(frames[:, _CACHE_RIGHT_HAND[0]])
    both = min(seen_left, seen_right) >= BOTH_TRACKED_RATIO * max(seen_left, seen_right) and seen_left + seen_right > 0
    if both:
        return motions[0] >= motions[1], motions, True
    return left.sum() >= right.sum(), motions, False


def add_resting_hand(frames, rng):
    """Adds a still hand at the arm's wrist to a clip with only one hand."""
    left, right = hand_counts(frames)
    seen_left, seen_right = (left > 0).sum(), (right > 0).sum()
    if min(seen_left, seen_right) > RESTING_HAND_MAX_TRACKED * len(frames) or seen_left == seen_right:
        return frames
    hand, other, wrist = (
        (_CACHE_LEFT_HAND, _CACHE_RIGHT_HAND, _CACHE_RIGHT_POSE_WRIST)
        if seen_left > seen_right
        else (_CACHE_RIGHT_HAND, _CACHE_LEFT_HAND, _CACHE_LEFT_POSE_WRIST)
    )
    tracked = np.flatnonzero(np.isfinite(frames[:, hand, 0]).all(axis=1))
    wrists = frames[:, wrist]
    if len(tracked) == 0 or not np.isfinite(wrists).any():
        return frames
    with np.errstate(all="ignore"):
        position = np.nanmedian(wrists, axis=0)
    shape = frames[tracked[len(tracked) // 2], hand] - frames[tracked[len(tracked) // 2], hand[0]]
    shape = shape * np.array([-1.0, 1.0], np.float32)
    out = frames.copy()
    noise = rng.normal(0, 0.003, (len(frames), 1, 2)).astype(np.float32)
    out[:, other] = position + shape + noise
    return out


def canonicalize(frames, rng=None):
    """Moves and scales cache frames so the shoulders match the training median."""
    shoulders = frames[:, _CACHE_SHOULDERS]
    valid = np.isfinite(shoulders).all(axis=(1, 2))
    if not valid.any():
        return frames
    left, right = shoulders[valid].mean(axis=0)
    width = abs(left[0] - right[0])
    if width < MIN_SHOULDER_WIDTH:
        return frames
    scale = np.clip(TARGET_WIDTH / width, MIN_SCALE, MAX_SCALE)
    target = TARGET_CENTER
    if rng is not None:
        scale = scale * np.exp(rng.uniform(-JITTER_SCALE, JITTER_SCALE))
        target = target + rng.uniform(-JITTER_SHIFT, JITTER_SHIFT, 2).astype(np.float32)
    return ((frames - (left + right) / 2) * scale + target).astype(np.float32)


def preprocess_two_hand(frames, swap=False, hide_other=False, rng=None):
    """Cache frames [N, 94, 2] -> (data [64, 92, 2], frame_idxs [64])."""
    frames = canonicalize(frames, rng)
    left, right = hand_counts(frames)
    left_dominant = choose_dominant(frames)[0] != swap
    keep = np.flatnonzero((left if left_dominant else right) > 0) if hide_other else np.flatnonzero((left + right) > 0)
    if len(keep) == 0:
        return np.zeros((INPUT_SIZE, N_COLS_TWO_HAND, 2), np.float32), np.full(INPUT_SIZE, -1, np.float32)

    data = frames[keep][:, _CACHE_LEFT if left_dominant else _CACHE_RIGHT].copy()
    if not left_dominant:
        data[:, MIRROR_X, 0] = 1.0 - data[:, MIRROR_X, 0]
    if hide_other:
        data[:, N_COLS:] = np.nan
    return fit_cached(data, (keep - keep.min()).astype(np.float32), len(frames))


def preprocess_two_hand_train(frames, rng):
    if rng.random() < RESTING_HAND_RATE:
        frames = add_resting_hand(frames, rng)
    _, motions, both = choose_dominant(frames)
    comparable = both and min(motions) >= SWAP_MIN_MOTION_RATIO * max(motions) and max(motions) > 0
    swap = comparable and rng.random() < SWAP_RATE
    return preprocess_two_hand(frames, swap=swap, hide_other=rng.random() < HIDE_OTHER_RATE, rng=rng)


def canonicalize_tf(frames):
    """TF version of canonicalize. frames: [N, 543, 2]."""
    shoulders = tf.gather(frames, [LEFT_SHOULDER, RIGHT_SHOULDER], axis=1)
    valid = tf.reduce_all(tf.math.is_finite(shoulders), axis=[1, 2])
    count = tf.reduce_sum(tf.cast(valid, tf.float32))
    mean = tf.reduce_sum(tf.where(valid[:, None, None], shoulders, 0.0), axis=0) / tf.maximum(count, 1.0)
    width = tf.abs(mean[0, 0] - mean[1, 0])
    scale = tf.clip_by_value(TARGET_WIDTH / tf.maximum(width, 1e-6), MIN_SCALE, MAX_SCALE)
    moved = (frames - (mean[0] + mean[1]) / 2) * scale + TARGET_CENTER
    return tf.where((count > 0) & (width >= MIN_SHOULDER_WIDTH), moved, frames)


def preprocess_two_hand_tf(frames):
    """TF version of preprocess_two_hand, for export. frames: [N, 543, 3]."""
    frames = canonicalize_tf(frames[:, :, :2])
    n_frames0 = tf.shape(frames)[0]

    def present(rows):
        return tf.reduce_sum(tf.cast(~tf.math.is_nan(tf.gather(frames, rows, axis=1)[..., 0]), tf.int32), axis=1)

    def motion(row):
        steps = tf.abs(frames[1:, row] - frames[:-1, row])
        return tf.reduce_sum(tf.where(tf.math.is_nan(steps), 0.0, steps))

    left, right = present(LEFT_HAND), present(RIGHT_HAND)
    seen_left = tf.reduce_sum(tf.cast(left > 0, tf.float32))
    seen_right = tf.reduce_sum(tf.cast(right > 0, tf.float32))
    both = (tf.minimum(seen_left, seen_right) >= BOTH_TRACKED_RATIO * tf.maximum(seen_left, seen_right)) & (
        seen_left + seen_right > 0
    )
    left_dominant = tf.where(
        both, motion(int(LEFT_HAND[0])) >= motion(int(RIGHT_HAND[0])), tf.reduce_sum(left) >= tf.reduce_sum(right)
    )
    keep = tf.reshape(tf.where(left + right > 0), [-1])
    keep = tf.cond(tf.size(keep) > 0, lambda: keep, lambda: tf.zeros([1], tf.int64))

    selected = tf.gather(frames, keep, axis=0)
    right_rows = tf.gather(selected, RIGHT_ROWS, axis=1)
    mirrored = tf.where(
        tf.constant(MIRROR_X)[None, :, None] & tf.constant([True, False])[None, None, :],
        1.0 - right_rows,
        right_rows,
    )
    data = tf.where(left_dominant, tf.gather(selected, LEFT_ROWS, axis=1), mirrored)
    idxs = tf.cast(keep - tf.reduce_min(keep), tf.float32)
    return fit_tf(data, idxs, n_frames0, N_COLS_TWO_HAND)


def add_other_hand(weights, norm, clips, seed=0):
    """Adds the new weights to a one-hand model. clips: [n, 64, 92, 2]."""
    other = clips[:, :, N_COLS:].reshape(-1, OTHER_COLS, 2)
    other = np.where(other == 0.0, np.nan, other)
    mean = np.nan_to_num(np.nanmean(other, axis=0), nan=0.5)
    std = np.nan_to_num(np.nanstd(other, axis=0), nan=1.0)
    units = weights["fc_w1"].shape[0]
    inputs = OTHER_COLS * 2
    rng = np.random.default_rng(seed)
    new_weights = dict(weights)
    new_weights["other_w1"] = (rng.standard_normal((inputs, units)) / np.sqrt(inputs)).astype(np.float32)
    new_weights["other_w2"] = np.zeros((units, units), np.float32)
    new_weights["other_empty"] = np.zeros((units,), np.float32)
    new_norm = dict(norm)
    new_norm["other_mean"] = mean.astype(np.float32)
    new_norm["other_inv_std"] = (1.0 / np.maximum(std, 1e-3)).astype(np.float32)
    return new_weights, new_norm


class TwoHandModel(SignModel):
    preprocess = staticmethod(preprocess_two_hand_tf)

    def _embed(self, data):
        return super()._embed(data) + self._embed_part(data[:, :, N_COLS:], "other")
