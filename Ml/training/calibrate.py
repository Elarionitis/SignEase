"""Fits the backend's CONFIDENCE_TEMPERATURE on scored recordings.

Takes the raw probabilities saved by evaluate.py and finds the temperature
T that makes softmax(log(p) / T) match how often predictions are right
(minimum negative log-likelihood). Reports cross-validated NLL/ECE and a
bootstrap interval, so the value isn't overfitted to a small set.

    python calibrate.py scores_new.npz --fit dictionary
"""

import argparse

import numpy as np

GRID = np.round(np.arange(0.30, 2.0001, 0.01), 2)


def scale(probabilities, temperature):
    logits = np.log(np.clip(probabilities, 1e-12, None)) / temperature
    logits -= logits.max(axis=1, keepdims=True)
    scaled = np.exp(logits)
    return scaled / scaled.sum(axis=1, keepdims=True)


def nll(probabilities, labels, temperature=1.0):
    p = scale(probabilities, temperature)[np.arange(len(labels)), labels]
    return float(-np.log(np.clip(p, 1e-12, None)).mean())


def ece(probabilities, labels, bins=10):
    confidence = probabilities.max(axis=1)
    correct = probabilities.argmax(axis=1) == labels
    edges = np.linspace(0, 1, bins + 1)
    total = 0.0
    for low, high in zip(edges[:-1], edges[1:]):
        inside = (confidence > low) & (confidence <= high)
        if inside.any():
            total += inside.mean() * abs(correct[inside].mean() - confidence[inside].mean())
    return float(total)


def fit(probabilities, labels):
    return float(GRID[np.argmin([nll(probabilities, labels, t) for t in GRID])])


def cross_validated(probabilities, labels, folds=10, repeats=20, seed=0):
    """Out-of-fold scaled probabilities, averaged metrics over repeats."""
    rng = np.random.default_rng(seed)
    nlls, eces = [], []
    for _ in range(repeats):
        order = rng.permutation(len(labels))
        scaled = np.empty_like(probabilities)
        for fold in np.array_split(order, folds):
            train = np.setdiff1d(order, fold)
            scaled[fold] = scale(probabilities[fold], fit(probabilities[train], labels[train]))
        nlls.append(nll(scaled, labels))
        eces.append(ece(scaled, labels))
    return float(np.mean(nlls)), float(np.mean(eces))


def report(name, probabilities, labels, temperature):
    scaled = scale(probabilities, temperature)
    confidence = scaled.max(axis=1)
    correct = scaled.argmax(axis=1) == labels
    print(
        f"  {name:14s} T={temperature:.2f}: NLL {nll(probabilities, labels, temperature):.3f}"
        f"  ECE {ece(scaled, labels):.3f}  mean confidence {confidence.mean():.3f}  accuracy {correct.mean():.3f}"
    )
    for threshold in (0.5, 0.7, 0.9):
        kept = confidence >= threshold
        if kept.any():
            print(f"      confidence >= {threshold}: {kept.mean():5.1%} of recordings, {correct[kept].mean():5.1%} correct")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("scores")
    parser.add_argument("--fit", default="dictionary", help="which test set to fit T on")
    parser.add_argument("--current", type=float, default=0.76, help="temperature currently in the backend")
    args = parser.parse_args()

    scores = np.load(args.scores)
    sets = sorted({key.rsplit("_", 1)[0] for key in scores.files})
    probabilities = scores[f"{args.fit}_probabilities"]
    labels = scores[f"{args.fit}_labels"]

    temperature = fit(probabilities, labels)
    rng = np.random.default_rng(0)
    boot = [fit(probabilities[s], labels[s]) for s in (rng.integers(0, len(labels), len(labels)) for _ in range(200))]
    cv_nll, cv_ece = cross_validated(probabilities, labels)
    print(f"Fitted on {args.fit} (n={len(labels)}): T = {temperature:.2f}"
          f" (bootstrap 90% interval {np.quantile(boot, 0.05):.2f}-{np.quantile(boot, 0.95):.2f})")
    print(f"  10-fold cross-validated: NLL {cv_nll:.3f}, ECE {cv_ece:.3f}")

    for name in sets:
        p, y = scores[f"{name}_probabilities"], scores[f"{name}_labels"]
        print(f"{name} (n={len(y)}), best T on this set alone = {fit(p, y):.2f}")
        report("raw", p, y, 1.0)
        report("current", p, y, args.current)
        report("fitted", p, y, temperature)


if __name__ == "__main__":
    main()
