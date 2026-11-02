"""The SignEase classifier, rebuilt in TensorFlow from the shipped .tflite.

The original Keras model and training code were not kept, only
``asl_model.tflite``. Its graph is the transformer from the public Kaggle
notebook "GISLR TF Data Processing & Transformer Training" (Mark Wijkhuizen):

* preprocessing: pick the hand with more tracked points over the clip
  (mirroring a right-dominant signer with x -> 1 - x, except the lips),
  drop frames without that hand, then pad to 64 frames, or for longer clips
  repeat to >= 64*64 frames, edge-pad and average down to 64;
* x/y only, normalised with fixed per-landmark means/stds over the whole
  frame (no centring on the signer), missing points are 0;
* lips (40), hand (21) and arm (5) embeddings (Dense-GELU-Dense, 384),
  softmax-weighted sum, Dense-GELU-Dense to 512, positional embedding;
* 2 transformer blocks (8 heads x 64, MLP 1024, GELU, no layer norm);
* masked mean pooling and a 250-way softmax.

``load_tflite_weights`` reads every weight out of the .tflite, and this
module reproduces its outputs (see ``verify.py``). One thing is deliberately
different at inference: the exported graph kept a training-time regulariser
that randomly drops 25% of frames from attention and pooling on every call
(the RANDOM_UNIFORM op the backend averaged over). Here that only happens in
training.
"""

import numpy as np
import tensorflow as tf

from landmarks import CACHE_ROWS, LEFT_HAND, LEFT_POSE, LIPS, RIGHT_HAND, RIGHT_POSE, cache_index

INPUT_SIZE = 64
N_COLS = 66
NUM_CLASSES = 250
NUM_BLOCKS = 2
NUM_HEADS = 8
UNITS = 512
FRAME_DROP_RATE = 0.25

# Model landmark order for each dominant side (lips are never mirrored).
LEFT_DOMINANT_ROWS = np.concatenate([LIPS, LEFT_HAND, LEFT_POSE])
RIGHT_DOMINANT_ROWS = np.concatenate([LIPS, RIGHT_HAND, RIGHT_POSE])
MIRROR_X = np.r_[np.zeros(len(LIPS)), np.ones(26)].astype(bool)


# ---------------------------------------------------------------- weights


def read_tflite_constants(path):
    """{tensor name: numpy array} for every constant in the main subgraph."""
    from tensorflow.lite.python import schema_py_generated as schema

    dtypes = {0: np.float32, 2: np.int32, 4: np.int64, 6: np.bool_}
    raw = open(path, "rb").read()
    model = schema.ModelT.InitFromObj(schema.Model.GetRootAsModel(raw, 0))
    constants = {}
    for tensor in model.subgraphs[0].tensors:
        data = model.buffers[tensor.buffer].data
        if data is None or len(data) == 0 or tensor.type not in dtypes:
            continue
        array = np.frombuffer(bytes(bytearray(data)), dtype=dtypes[tensor.type])
        shape = [] if tensor.shape is None else list(tensor.shape)
        constants[tensor.name.decode()] = array.reshape(shape).copy()
    return constants


def load_tflite_weights(path):
    """Maps the .tflite constants onto this module's variable names."""
    c = read_tflite_constants(path)

    def kernel(prefix):
        # TFLite stores FULLY_CONNECTED weights as [out, in].
        matches = [v for k, v in c.items() if k.startswith(prefix + "/") and "MatMul" in k and v.ndim == 2]
        assert len(matches) == 1, (prefix, len(matches))
        return matches[0].T

    def bias(prefix):
        return c[prefix + "/BiasAdd/ReadVariableOp"]

    def dense_kernel(name):
        matches = [v for k, v in c.items() if f"/{name}/Tensordot/MatMul" in k and v.ndim == 2]
        assert len(matches) == 1, (name, len(matches))
        return matches[0].T

    w = {}
    for part, tflite_name in (("lips", "lips"), ("hand", "left_hand"), ("pose", "pose")):
        base = f"model/embedding/{tflite_name}_embedding/{tflite_name}_embedding_dense"
        w[f"{part}_w1"] = kernel(f"{base}/{tflite_name}_embedding_dense_1")
        w[f"{part}_w2"] = kernel(f"{base}/{tflite_name}_embedding_dense_2")
        w[f"{part}_empty"] = c[f"model/embedding/{tflite_name}_embedding/SelectV2/ReadVariableOp"]
    # The exported graph stores softmax(weights); log() gives equivalent logits.
    w["landmark_logits"] = np.log(c["model/embedding/Softmax"])
    w["fc_w1"] = kernel("model/embedding/fc/fully_connected_1")
    w["fc_w2"] = kernel("model/embedding/fc/fully_connected_2")
    w["positional"] = c["model/embedding/embedding/embedding_lookup"]

    for block in range(NUM_BLOCKS):
        mha = "multi_head_attention" + ("" if block == 0 else f"_{block}")
        first = block * 27  # dense layer numbering: 24 per MHA + wo + 2 MLP

        def name(i):
            return "dense" if i == 0 else f"dense_{i}"

        for kind, start in (("q", 0), ("k", 8), ("v", 16)):
            heads = [first + start + h for h in range(NUM_HEADS)]
            w[f"b{block}_w{kind}"] = np.concatenate([dense_kernel(name(i)) for i in heads], axis=1)
            w[f"b{block}_b{kind}"] = np.concatenate(
                [bias(f"model/transformer/{mha}/{name(i)}") for i in heads]
            )
        w[f"b{block}_wo"] = dense_kernel(name(first + 24))
        w[f"b{block}_bo"] = bias(f"model/transformer/{mha}/{name(first + 24)}")
        seq = "sequential" + ("" if block == 0 else f"_{block}")
        w[f"b{block}_mlp_w1"] = dense_kernel(name(first + 25))
        w[f"b{block}_mlp_b1"] = bias(f"model/transformer/{seq}/{name(first + 25)}")
        w[f"b{block}_mlp_w2"] = dense_kernel(name(first + 26))
        w[f"b{block}_mlp_b2"] = bias(f"model/transformer/{seq}/{name(first + 26)}")

    w["out_w"] = c["model/dense/MatMul"].T
    w["out_b"] = c["model/dense/BiasAdd/ReadVariableOp"]

    norm = {}
    for part, (sub, div) in {
        "lips": ("subtract", "truediv"),
        "hand": ("subtract_1", "truediv_1"),
        "pose": ("subtract_2", "truediv_2"),
    }.items():
        norm[f"{part}_mean"] = c[f"model/tf.math.{sub}/Sub/y"]
        # Folded at export: this is 1 / std.
        norm[f"{part}_inv_std"] = next(v for k, v in c.items() if k.startswith(f"model/tf.math.{div}/truediv"))
    return {k: v.astype(np.float32) for k, v in w.items()}, {k: v.astype(np.float32) for k, v in norm.items()}


# ---------------------------------------------------------- preprocessing

_CACHE_LEFT = cache_index(LEFT_DOMINANT_ROWS)
_CACHE_RIGHT = cache_index(RIGHT_DOMINANT_ROWS)
_CACHE_LEFT_HAND = cache_index(LEFT_HAND)
_CACHE_RIGHT_HAND = cache_index(RIGHT_HAND)


def preprocess_cached(frames):
    """Numpy port of the .tflite preprocessing, for cache frames [N, 94, 2].

    Returns (data [64, 66, 2], frame_idxs [64]) exactly as the exported graph
    computes them (including its quirks, e.g. the repeat factor uses the
    frame count before empty frames are dropped).
    """
    n_frames0 = len(frames)
    left = (~np.isnan(frames[:, _CACHE_LEFT_HAND, 0])).sum(axis=1)
    right = (~np.isnan(frames[:, _CACHE_RIGHT_HAND, 0])).sum(axis=1)
    left_dominant = left.sum() >= right.sum()
    keep = np.flatnonzero((left if left_dominant else right) > 0)
    if len(keep) == 0:
        # The graph would fail on an empty clip; the backend never sends one.
        return np.zeros((INPUT_SIZE, N_COLS, 2), np.float32), np.full(INPUT_SIZE, -1, np.float32)

    data = frames[keep][:, _CACHE_LEFT if left_dominant else _CACHE_RIGHT].copy()
    if not left_dominant:
        data[:, MIRROR_X, 0] = 1.0 - data[:, MIRROR_X, 0]
    idxs = (keep - keep.min()).astype(np.float32)
    n = len(data)

    if n < INPUT_SIZE:
        data = np.concatenate([data, np.zeros((INPUT_SIZE - n, N_COLS, 2), np.float32)])
        idxs = np.concatenate([idxs, np.full(INPUT_SIZE - n, -1, np.float32)])
        return np.nan_to_num(data, nan=0.0).astype(np.float32), idxs

    if n < INPUT_SIZE ** 2:
        repeats = INPUT_SIZE * INPUT_SIZE // n_frames0
        data = np.repeat(data, repeats, axis=0)
        idxs = np.repeat(idxs, repeats)
    length = len(data)
    pool = length // INPUT_SIZE + (1 if length % INPUT_SIZE else 0)
    pad = pool * INPUT_SIZE - length if pool == 1 else (pool * INPUT_SIZE) % length
    pad_left = pad // 2 + INPUT_SIZE // 2
    pad_right = pad_left + (1 if pad % 2 else 0)
    data = np.concatenate([np.repeat(data[:1], pad_left, 0), data, np.repeat(data[-1:], pad_right, 0)])
    idxs = np.concatenate([np.repeat(idxs[:1], pad_left), idxs, np.repeat(idxs[-1:], pad_right)])
    data = data.reshape(INPUT_SIZE, -1, N_COLS, 2)
    idxs = idxs.reshape(INPUT_SIZE, -1)
    with np.errstate(invalid="ignore"):
        counts = (~np.isnan(data)).sum(axis=1)
        data = np.where(counts > 0, np.nansum(data, axis=1) / np.maximum(counts, 1), 0.0)
    return data.astype(np.float32), idxs.mean(axis=1).astype(np.float32)


def preprocess_tf(frames):
    """The same preprocessing as TF ops, for export. frames: [N, 543, 3]."""
    frames = frames[:, :, :2]
    n_frames0 = tf.shape(frames)[0]

    def present(rows):
        return tf.reduce_sum(tf.cast(~tf.math.is_nan(tf.gather(frames, rows, axis=1)[..., 0]), tf.int32), axis=1)

    left, right = present(LEFT_HAND), present(RIGHT_HAND)
    left_dominant = tf.reduce_sum(left) >= tf.reduce_sum(right)
    hand = tf.where(left_dominant, left, right)
    keep = tf.reshape(tf.where(hand > 0), [-1])
    keep = tf.cond(tf.size(keep) > 0, lambda: keep, lambda: tf.zeros([1], tf.int64))

    selected = tf.gather(frames, keep, axis=0)
    mirrored = tf.concat([
        tf.gather(selected, LIPS, axis=1),
        tf.stack([1.0 - tf.gather(selected, RIGHT_DOMINANT_ROWS[40:], axis=1)[..., 0],
                  tf.gather(selected, RIGHT_DOMINANT_ROWS[40:], axis=1)[..., 1]], axis=-1),
    ], axis=1)
    data = tf.where(left_dominant, tf.gather(selected, LEFT_DOMINANT_ROWS, axis=1), mirrored)
    idxs = tf.cast(keep - tf.reduce_min(keep), tf.float32)
    n = tf.shape(data)[0]

    def pad_short():
        padded = tf.pad(data, [[0, INPUT_SIZE - n], [0, 0], [0, 0]])
        return (
            tf.where(tf.math.is_nan(padded), 0.0, padded),
            tf.pad(idxs, [[0, INPUT_SIZE - n]], constant_values=-1.0),
        )

    def pool_long():
        repeats = tf.where(n < INPUT_SIZE ** 2, INPUT_SIZE * INPUT_SIZE // n_frames0, 1)
        d = tf.repeat(data, repeats, axis=0)
        i = tf.repeat(idxs, repeats)
        length = tf.shape(d)[0]
        pool = length // INPUT_SIZE + tf.cast(length % INPUT_SIZE > 0, tf.int32)
        pad = tf.where(pool == 1, pool * INPUT_SIZE - length, (pool * INPUT_SIZE) % length)
        pad_left = pad // 2 + INPUT_SIZE // 2
        pad_right = pad_left + pad % 2
        d = tf.concat([tf.repeat(d[:1], pad_left, axis=0), d, tf.repeat(d[-1:], pad_right, axis=0)], axis=0)
        i = tf.concat([tf.repeat(i[:1], pad_left), i, tf.repeat(i[-1:], pad_right)], axis=0)
        d = tf.reshape(d, [INPUT_SIZE, -1, N_COLS, 2])
        i = tf.reshape(i, [INPUT_SIZE, -1])
        valid = ~tf.math.is_nan(d)
        counts = tf.reduce_sum(tf.cast(valid, tf.float32), axis=1)
        sums = tf.reduce_sum(tf.where(valid, d, 0.0), axis=1)
        d = tf.where(counts > 0, sums / tf.maximum(counts, 1.0), 0.0)
        return d, tf.reduce_mean(i, axis=1)

    data, idxs = tf.cond(n < INPUT_SIZE, pad_short, pool_long)
    return tf.reshape(data, [INPUT_SIZE, N_COLS, 2]), tf.reshape(idxs, [INPUT_SIZE])


# ------------------------------------------------------------------ model


class SignModel(tf.Module):
    def __init__(self, weights, norm):
        super().__init__()
        self.w = {k: tf.Variable(v, name=k) for k, v in weights.items()}
        self.norm = {k: tf.constant(v) for k, v in norm.items()}

    def _embed_part(self, x, part):
        missing = tf.equal(x, 0.0)
        x = tf.where(missing, 0.0, (x - self.norm[f"{part}_mean"]) * self.norm[f"{part}_inv_std"])
        x = tf.reshape(x, [tf.shape(x)[0], INPUT_SIZE, -1])
        dense = tf.nn.gelu(x @ self.w[f"{part}_w1"]) @ self.w[f"{part}_w2"]
        empty = tf.equal(tf.reduce_sum(x, axis=2, keepdims=True), 0.0)
        return tf.where(empty, self.w[f"{part}_empty"], dense)

    def __call__(self, data, idxs, training=False, dropout=0.0):
        """data [B, 64, 66, 2], idxs [B, 64] -> logits [B, 250]."""
        parts = tf.stack([
            self._embed_part(data[:, :, 0:40], "lips"),
            self._embed_part(data[:, :, 40:61], "hand"),
            self._embed_part(data[:, :, 61:66], "pose"),
        ], axis=3)
        x = tf.reduce_sum(parts * tf.nn.softmax(self.w["landmark_logits"]), axis=3)
        x = tf.nn.gelu(x @ self.w["fc_w1"]) @ self.w["fc_w2"]

        max_idx = tf.clip_by_value(tf.reduce_max(idxs, axis=1, keepdims=True), 1.0, np.inf)
        positions = tf.where(
            tf.equal(idxs, -1.0), INPUT_SIZE, tf.cast(idxs / max_idx * INPUT_SIZE, tf.int32)
        )
        x = x + tf.gather(self.w["positional"], positions)

        mask0 = tf.cast(tf.not_equal(idxs, -1.0), tf.float32)[:, :, None]
        mask = mask0
        if training:
            keep = tf.cast(tf.random.uniform(tf.shape(mask0)) > FRAME_DROP_RATE, tf.float32) * mask0
            all_dropped = tf.equal(tf.reduce_sum(keep, axis=[1, 2], keepdims=True), 0.0)
            mask = tf.where(all_dropped, mask0, keep)

        # Mask shape [B, 64, 1] masks query rows (as in the original model).
        attention_bias = (1.0 - mask) * -1e9
        for block in range(NUM_BLOCKS):
            x = x + self._attention(x, attention_bias, block)
            hidden = tf.nn.gelu(x @ self.w[f"b{block}_mlp_w1"] + self.w[f"b{block}_mlp_b1"])
            if training and dropout:
                hidden = tf.nn.dropout(hidden, dropout)
            x = x + hidden @ self.w[f"b{block}_mlp_w2"] + self.w[f"b{block}_mlp_b2"]

        pooled = tf.reduce_sum(x * mask, axis=1) / tf.reduce_sum(mask, axis=1)
        if training and dropout:
            pooled = tf.nn.dropout(pooled, dropout)
        return pooled @ self.w["out_w"] + self.w["out_b"]

    def _attention(self, x, attention_bias, block):
        def heads(kind):
            y = x @ self.w[f"b{block}_w{kind}"] + self.w[f"b{block}_b{kind}"]
            return tf.transpose(tf.reshape(y, [-1, INPUT_SIZE, NUM_HEADS, UNITS // NUM_HEADS]), [0, 2, 1, 3])

        q, k, v = heads("q"), heads("k"), heads("v")
        scores = tf.matmul(q, k, transpose_b=True) * 0.125 + attention_bias[:, None]
        z = tf.matmul(tf.nn.softmax(scores, axis=-1), v)
        z = tf.reshape(tf.transpose(z, [0, 2, 1, 3]), [-1, INPUT_SIZE, UNITS])
        return z @ self.w[f"b{block}_wo"] + self.w[f"b{block}_bo"]


def export_tflite(model, path):
    """Exports [N, 543, 3] landmarks -> [250] probabilities, like the original."""

    @tf.function(input_signature=[tf.TensorSpec([None, 543, 3], tf.float32, name="inputs")])
    def serve(inputs):
        data, idxs = preprocess_tf(inputs)
        probabilities = tf.nn.softmax(model(data[None], idxs[None]))
        return {"outputs": tf.reshape(probabilities, [NUM_CLASSES])}

    converter = tf.lite.TFLiteConverter.from_concrete_functions([serve.get_concrete_function()], model)
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
    with open(path, "wb") as file:
        file.write(converter.convert())
