"""Fine-tunes the shipped classifier to be robust to webcam recordings.

Starts from the exact weights in asl_model.tflite (see model.py / verify.py)
and trains on the Kaggle clips of all but the held-out signers, with the
webcam augmentations in augment.py (aspect ratio / framing, raise-hold-lower
padding at the start and end, speed, tracking dropouts). Label smoothing
stays at 0.25, which the original model was trained with (on clips it fits
perfectly its top probability sits at ~0.76 and never exceeds 0.9);
confidence is calibrated afterwards with calibrate.py.

    python finetune.py --cache cache --out runs/finetune --epochs 8

``--init`` must be a model in the original export format. Once the shipped
file has been replaced, get the original from git history:

    git show 45f4636:Ml/ML_Code_ISL/models/asl_model.tflite > original.tflite
"""

import argparse
import functools
import json
import os
import time

import numpy as np
import tensorflow as tf

from augment import train_transform, webcam
from batching import Preprocessor
from data import HOLDOUT_PARTICIPANTS, load_cache
from model import NUM_CLASSES, SignModel, load_tflite_weights, preprocess_cached
from two_hand import (
    HAND_SIZE_LIMITS,
    N_COLS_TWO_HAND,
    TwoHandModel,
    add_other_hand,
    preprocess_two_hand,
    preprocess_two_hand_train,
    train_transform_hand_size,
)

ORIGINAL_MODEL = os.path.join(os.path.dirname(__file__), "..", "ML_Code_ISL", "models", "asl_model.tflite")


def holdout_batches(frames, offsets, meta, count, seed=99, preprocess=preprocess_cached):
    """Fixed clean and webcam-like holdout sets (model-level, for monitoring)."""
    holdout = meta[meta["participant_id"].isin(HOLDOUT_PARTICIPANTS)]
    picks = np.random.default_rng(seed).choice(holdout.index.to_numpy(), count, replace=False)
    sets = {"clean": [], "webcam": []}
    for index in picks:
        sample = np.asarray(frames[offsets[index]:offsets[index + 1]])
        sets["clean"].append(preprocess(sample))
        sets["webcam"].append(preprocess(webcam(sample, np.random.default_rng((seed, int(index))))))
    labels = meta.loc[picks, "label"].to_numpy()
    out = {}
    for name, items in sets.items():
        data, idxs = np.stack([d for d, _ in items]), np.stack([i for _, i in items])
        valid = (idxs != -1).any(axis=1)
        out[name] = (data[valid], idxs[valid], labels[valid])
    return out


def save_weights(model, path):
    """Weights plus the fixed normalisation constants, so export.py needs nothing else."""
    arrays = {name: variable.numpy() for name, variable in model.w.items()}
    arrays.update({f"norm__{name}": value.numpy() for name, value in model.norm.items()})
    np.savez(path, **arrays)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cache", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--init", default=ORIGINAL_MODEL, help="original-format .tflite to start from")
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--warmup-steps", type=int, default=300)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--dropout", type=float, default=0.1)
    parser.add_argument("--label-smoothing", type=float, default=0.25)
    parser.add_argument("--limit", type=int, default=0, help="train on N clips per epoch (for testing)")
    parser.add_argument("--two-hand", action="store_true", help="also feed the model the other hand and arm")
    parser.add_argument("--resume", help="continue from a two-hand best.npz instead of --init")
    parser.add_argument(
        "--hand-size", type=lambda text: tuple(float(v) for v in text.split(",")), default=None,
        help=f"smallest,largest hand scale (two-hand default {HAND_SIZE_LIMITS}; one-hand default: unchanged)",
    )
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "args.json"), "w") as file:
        json.dump(vars(args), file, indent=2)

    tf.random.set_seed(args.seed)
    frames, offsets, meta = load_cache(args.cache)
    train_index = meta.index[~meta["participant_id"].isin(HOLDOUT_PARTICIPANTS)].to_numpy()
    labels = meta["label"].to_numpy()
    preprocess = preprocess_two_hand if args.two_hand else preprocess_cached
    monitor = holdout_batches(frames, offsets, meta, 3000, preprocess=preprocess)

    weights, norm = load_tflite_weights(args.init)
    if args.two_hand:
        samples = np.random.default_rng(args.seed).choice(train_index, 2000, replace=False)
        clips = [preprocess(np.asarray(frames[offsets[i]:offsets[i + 1]]))[0] for i in samples]
        weights, norm = add_other_hand(weights, norm, np.stack(clips), args.seed)
    if args.resume:
        arrays = dict(np.load(args.resume))
        norm = {name[len("norm__"):]: value for name, value in arrays.items() if name.startswith("norm__")}
        weights = {name: value for name, value in arrays.items() if not name.startswith("norm__")}
    model = (TwoHandModel if args.two_hand else SignModel)(weights, norm)
    variables = list(model.w.values())

    per_epoch = args.limit or len(train_index)
    total_steps = args.epochs * int(np.ceil(per_epoch / args.batch_size))
    schedule = tf.keras.optimizers.schedules.CosineDecay(
        0.0, total_steps - args.warmup_steps, warmup_target=args.learning_rate, warmup_steps=args.warmup_steps
    )
    optimizer = tf.keras.optimizers.AdamW(learning_rate=schedule, weight_decay=args.weight_decay, clipnorm=1.0)
    loss_fn = tf.keras.losses.CategoricalCrossentropy(from_logits=True, label_smoothing=args.label_smoothing)
    n_cols = N_COLS_TWO_HAND if args.two_hand else 66
    spec = [tf.TensorSpec([None, 64, n_cols, 2], tf.float32), tf.TensorSpec([None, 64], tf.float32), tf.TensorSpec([None], tf.int32)]

    @tf.function(input_signature=spec)
    def train_step(data, idxs, y):
        with tf.GradientTape() as tape:
            logits = model(data, idxs, training=True, dropout=args.dropout)
            loss = loss_fn(tf.one_hot(y, NUM_CLASSES), logits)
        gradients = tape.gradient(loss, variables)
        finite = tf.reduce_all([tf.reduce_all(tf.math.is_finite(g)) for g in gradients])
        # Never let one bad batch poison the weights.
        gradients = [tf.where(finite, g, tf.zeros_like(g)) for g in gradients]
        optimizer.apply_gradients(zip(gradients, variables))
        return loss, tf.reduce_mean(tf.cast(tf.equal(tf.argmax(logits, 1, output_type=tf.int32), y), tf.float32))

    @tf.function(input_signature=spec[:2])
    def predict(data, idxs):
        return tf.nn.softmax(model(data, idxs))

    def evaluate():
        scores = {}
        for name, (data, idxs, y) in monitor.items():
            probabilities = np.concatenate([predict(data[i:i + 512], idxs[i:i + 512]).numpy() for i in range(0, len(y), 512)])
            scores[name] = float(np.mean(probabilities.argmax(1) == y))
        return scores

    history = [{"epoch": 0, **evaluate()}]
    print("before fine-tuning:", history[-1], flush=True)
    best = history[-1]["webcam"]
    save_weights(model, os.path.join(args.out, "best.npz"))

    transform, extra = train_transform, {}
    if args.two_hand:
        extra["preprocess"] = functools.partial(preprocess_two_hand_train, hand_size=args.hand_size or HAND_SIZE_LIMITS)
    elif args.hand_size:
        transform = functools.partial(train_transform_hand_size, hand_size=args.hand_size)
    preprocessor = Preprocessor(args.cache, transform=transform, seed=args.seed, **extra)
    rng = np.random.default_rng(args.seed)
    try:
        for epoch in range(1, args.epochs + 1):
            started = time.time()
            order = rng.permutation(train_index)[:per_epoch]
            losses, accuracies = [], []
            for step, (data, idxs) in enumerate(preprocessor.batches(order, args.batch_size, epoch)):
                y = labels[order[step * args.batch_size: step * args.batch_size + len(data)]].astype(np.int32)
                # Augmentation can remove every frame of the dominant hand;
                # the backend rejects such recordings, so skip them here too.
                valid = (idxs != -1).any(axis=1)
                loss, accuracy = train_step(data[valid], idxs[valid], y[valid])
                losses.append(float(loss))
                accuracies.append(float(accuracy))
                if step % 100 == 0:
                    print(f"  epoch {epoch} step {step} loss {np.mean(losses[-100:]):.3f} acc {np.mean(accuracies[-100:]):.3f}", flush=True)
            scores = evaluate()
            history.append({"epoch": epoch, "train_loss": float(np.mean(losses)), "train_acc": float(np.mean(accuracies)), **scores})
            print(f"epoch {epoch}: {history[-1]} ({time.time() - started:.0f}s)", flush=True)
            save_weights(model, os.path.join(args.out, f"epoch{epoch}.npz"))
            if scores["webcam"] > best:
                best = scores["webcam"]
                save_weights(model, os.path.join(args.out, "best.npz"))
            with open(os.path.join(args.out, "history.json"), "w") as file:
                json.dump(history, file, indent=2)
    finally:
        preprocessor.close()

    print(f"best weights: {os.path.join(args.out, 'best.npz')} (export them with export.py)")


if __name__ == "__main__":
    main()
