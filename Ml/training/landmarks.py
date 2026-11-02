"""Landmark layout shared by the cache, the model and evaluation.

MediaPipe Holistic frames are 543 rows: face (468), left hand (21),
pose (33), right hand (21). The classifier uses 40 lip points, the dominant
hand and 5 points of the dominant arm, x/y only.
"""

import numpy as np

ROWS_PER_FRAME = 543
TYPE_OFFSETS = {"face": 0, "left_hand": 468, "pose": 489, "right_hand": 522}

LIPS = np.array([
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314, 405, 321, 375,
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
])
LEFT_HAND = np.arange(468, 489)
RIGHT_HAND = np.arange(522, 543)
LEFT_POSE = np.array([502, 504, 506, 508, 510])
RIGHT_POSE = np.array([503, 505, 507, 509, 511])
SHOULDERS = np.array([500, 501])

# Rows kept in the training cache (the backend's segment finder also needs
# the shoulders), in this order.
CACHE_ROWS = np.concatenate([LIPS, LEFT_HAND, RIGHT_HAND, SHOULDERS, np.arange(502, 512)])


def cache_index(rows):
    position = {row: index for index, row in enumerate(CACHE_ROWS)}
    return np.array([position[row] for row in rows])


def expand_cached(frames):
    """[N, len(CACHE_ROWS), 2] cache frames -> [N, 543, 3] Holistic frames (z = 0)."""
    full = np.full((len(frames), ROWS_PER_FRAME, 3), np.nan, dtype=np.float32)
    full[:, CACHE_ROWS, :2] = frames
    full[:, CACHE_ROWS, 2] = np.where(np.isnan(frames[..., 0]), np.nan, 0.0)
    return full
