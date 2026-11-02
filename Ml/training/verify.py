"""Checks that the rebuilt model reproduces the shipped .tflite exactly.

The .tflite randomly drops 25% of frames on every call, so it is first
patched to keep every frame (its drop threshold 0.25 -> -1). With that,
the rebuilt model must give the same probabilities, and the exported
.tflite must match too.

    python verify.py --tflite ../ML_Code_ISL/models/asl_model.tflite --cache cache
"""

import argparse
import os
import tempfile

import numpy as np
import tensorflow as tf

from data import load_cache
from landmarks import expand_cached
from model import SignModel, export_tflite, load_tflite_weights, preprocess_cached, preprocess_tf


def deterministic_copy(path, out_path):
    """Writes a copy of the .tflite with random frame dropping turned off."""
    import flatbuffers
    from tensorflow.lite.python import schema_py_generated as schema

    model = schema.ModelT.InitFromObj(schema.Model.GetRootAsModel(open(path, "rb").read(), 0))
    tensor = next(t for t in model.subgraphs[0].tensors if t.name == b"model/tf.math.greater/Greater/y")
    assert np.frombuffer(bytes(bytearray(model.buffers[tensor.buffer].data)), np.float32)[0] == 0.25
    model.buffers[tensor.buffer].data = np.frombuffer(np.float32(-1.0).tobytes(), np.uint8)
    builder = flatbuffers.Builder(0)
    builder.Finish(model.Pack(builder), file_identifier=b"TFL3")
    with open(out_path, "wb") as file:
        file.write(builder.Output())


def runner(path):
    interpreter = tf.lite.Interpreter(model_path=path)
    return interpreter.get_signature_runner("serving_default")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tflite", required=True)
    parser.add_argument("--cache", required=True)
    parser.add_argument("--samples", type=int, default=300)
    args = parser.parse_args()

    frames, offsets, meta = load_cache(args.cache)
    rng = np.random.default_rng(0)
    lengths = np.diff(offsets)
    # Mix of short (padded) and long (pooled) clips, including > 64*64/... repeats.
    picks = np.concatenate([
        rng.choice(np.flatnonzero(lengths < 64), args.samples // 2, replace=False),
        rng.choice(np.flatnonzero(lengths >= 64), args.samples // 2, replace=False),
    ])

    weights, norm = load_tflite_weights(args.tflite)
    model = SignModel(weights, norm)
    with tempfile.TemporaryDirectory() as tmp:
        fixed_path = os.path.join(tmp, "fixed.tflite")
        export_path = os.path.join(tmp, "export.tflite")
        deterministic_copy(args.tflite, fixed_path)
        export_tflite(model, export_path)
        original = runner(fixed_path)
        exported = runner(export_path)

        worst = {"preprocess": 0.0, "model": 0.0, "export": 0.0}
        agree = 0
        for index in picks:
            sample = frames[offsets[index]:offsets[index + 1]]
            full = expand_cached(sample)
            reference = original(inputs=full)["outputs"]

            data, idxs = preprocess_cached(sample)
            tf_data, tf_idxs = preprocess_tf(tf.constant(full))
            worst["preprocess"] = max(
                worst["preprocess"],
                float(np.abs(data - tf_data.numpy()).max()),
                float(np.abs(idxs - tf_idxs.numpy()).max()),
            )
            ours = tf.nn.softmax(model(data[None], idxs[None]))[0].numpy()
            worst["model"] = max(worst["model"], float(np.abs(ours - reference).max()))
            worst["export"] = max(worst["export"], float(np.abs(exported(inputs=full)["outputs"] - reference).max()))
            agree += int(ours.argmax() == reference.argmax())

    print(f"{len(picks)} recordings: top-1 agreement {agree}/{len(picks)}")
    for key, value in worst.items():
        print(f"max |difference| {key}: {value:.2e}")
    ok = agree == len(picks) and worst["model"] < 1e-4 and worst["export"] < 1e-4 and worst["preprocess"] < 1e-5
    print("PASS" if ok else "FAIL")
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
