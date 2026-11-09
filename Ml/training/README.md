# Training, evaluation and calibration

The original Keras model and training code were not kept, only
`ML_Code_ISL/models/asl_model.tflite`. These scripts rebuild that model from
its weights, fine-tune it, export a new `.tflite`, and measure it through the
backend's real prediction pipeline.

## What the original model is

The `.tflite` graph is the transformer from the public Kaggle notebook
"GISLR TF Data Processing & Transformer Training" (Mark Wijkhuizen), trained
on the [Google ASL Signs](https://www.kaggle.com/competitions/asl-signs/data)
data (94,477 clips, 21 signers, 250 signs). `model.py` reads every weight out
of the file and reproduces it exactly: `verify.py` checks 300 clips and
matches the original to within 2e-6 in probability (export too, on
TensorFlow 2.14 and 2.16).

Facts established from the model and the data:

- **Preprocessing** (inside the `.tflite`): x/y only; the hand with more
  tracked points over the clip is used, and a right-dominant signer is
  mirrored (x -> 1 - x, except the lips); frames without that hand are
  dropped; clips are padded to 64 frames or averaged down to 64. Coordinates
  are normalised with fixed means/stds over the whole frame, with no centring
  on the signer.
- **Aspect ratio**: the training videos are portrait, about 3:4. Fitting the
  width/height that makes hand bone lengths independent of their direction
  gives a median of 0.74 across the 21 signers (range 0.68-0.87).
- **Label smoothing ~0.25**: the model scores 100% on all 94,477 Kaggle clips,
  yet its top probability has a median of 0.76 and never exceeds 0.90, the
  ceiling smoothing of 0.25 produces (0.751). This is why raw confidence is low.
- **Random frame dropping at inference**: the export kept a training-time
  regulariser (`RANDOM_UNIFORM > 0.25`) that drops a random 25% of frames on
  every call. The new export only does this in training.

Because the original model was trained on every Kaggle clip, Kaggle data
cannot measure its real accuracy. The only unseen data in the repository are
the 120 dictionary videos (`ISLRv6/public/videos/signs/<label>.mp4`).

## Results

All numbers go through the backend pipeline (`prepare_frames` +
`score_recording`: aspect conversion, 30 fps resampling, segment search).

| Test set | Shipped before | Original, deterministic | Fine-tuned (new) |
| --- | --- | --- | --- |
| Dictionary videos (120, unseen), top-1 | 60.8% | 61.7% | 60.0% |
| Dictionary videos, top-3 | 65.8% | 65.8% | **68.3%** |
| Dictionary videos, NLL | 2.62 | 2.61 | **2.40** |
| Held-out signers, webcam simulation, top-1 | 90.3%* | 91.5% | **93.7%** |
| Held-out signers, clean clips, top-1 | 99.5%* | 99.7% | 99.0% |

\* 3,000 clips; the other columns use 1,000 (same seed and transforms).

- On the dictionary videos the fine-tuned model's top-1 is a tie with the
  original (7 videos only the original gets right, 5 only the new one), with
  better top-3 and likelihood. A real-world top-1 gain is not demonstrated.
- It is clearly more robust to webcam-style recordings (43 vs 22 discordant
  clips on the held-out signers).
- About 30% of dictionary signs are not recognised in any segment of the clip
  by either model (often ranked near last), which points to different sign
  variants or signing style; this is the model's cross-signer limit.
- Tried and rejected: normalising the signer's framing to the training median
  (shoulder width/position). It lowered dictionary top-1 to 56.7%.

**Confidence**: refitted for the new model on the dictionary videos,
`CONFIDENCE_TEMPERATURE = 0.89` (bootstrap 90% interval 0.83-0.94, 10-fold
cross-validated ECE 0.07). For the old model the same procedure gives 0.76,
matching the previous value. With 0.89, predictions shown at >= 90% were
right 96% of the time on the dictionary videos.

## Current models: trained on real webcam signers (ASL Citizen)

The shipped models are the blend described below, fine-tuned further on
[ASL Citizen](https://www.microsoft.com/en-us/research/project/asl-citizen/)
(Microsoft Research): 83,399 webcam recordings by 51 Deaf and hard of
hearing signers, split by signer into train, val and test. Its licence is
non-commercial research use only, so SignEase is a free, non-commercial
project. The videos and landmarks are never committed (`asl_citizen/` and
`colab/` are git-ignored).

**Data.** 8,925 ASL Citizen videos cover 235 of SignEase's 250 signs (by
name, or by another name for the same sign, e.g. FATHER for `dad`). 26
glosses are left out because they are a different sign from SignEase's
(`EXCLUDED_GLOSSES` in `asl_citizen.py`, chosen on train and val only). 15
signs have no ASL Citizen videos: feet, goose, jeans, mitten, nap, pajamas,
police, pool, puppy, puzzle, say, shhh, sleepy, snack, wake.

| Split | Clips | Signers | Signs |
| --- | --- | --- | --- |
| train | 3,880 | 35 | 230 |
| val (picks epochs and the temperature) | 1,002 | 5 | 230 |
| test (scored once, at the end) | 3,247 | 11 | 230 |

**Training.** Every clip goes through the backend's own webcam conversion,
is cropped to its signing span, and repeated 5 times next to the Kaggle
cache (17% of the clips; each copy is augmented differently). The three
models of the previous blend continue from their weights, and the
checkpoint is chosen on the val signers (`--monitor-cache`).

**Results**, through the full backend pipeline (segment search and hand
variants included), same three-model blend structure:

| Test set | Previous blend | New blend |
| --- | --- | --- |
| ASL Citizen test signers (3,247 clips, unseen), top-1 | 74.2% | **87.4%** |
| ASL Citizen test signers, top-3 | 86.8% | **95.8%** |
| ASL Citizen val signers (1,002 clips), top-1 / top-3 | 78.1% / 88.7% | **90.0% / 97.0%** |
| Dictionary videos (250), top-1 / top-3 | 60.8% / 73.6% | **64.0%** / 73.6% |
| Kaggle held-out signers, webcam simulation, top-1 | **92.0%** | 91.1% |
| Kaggle held-out signers, clean clips, top-1 | 97.6% | 97.4% |

On the test signers the new blend fixed 454 predictions and broke 24 (sign
test p < 1e-100); `yes` went from 7 to 9 of 10, `can` from 11 to 12 of
12, `dad` from 10 to 12 of 12. Each new model alone also beats the previous
blend (86.3-86.6% top-1). Adding the hand-size models (`--hand-size`) did
not help (85.7%). The small drop on the Kaggle webcam simulation (35 fixed,
60 broken) is on phone recordings with simulated webcam effects, not on
real webcams.

**Confidence**: `CONFIDENCE_TEMPERATURE = 0.69`, fitted on the val signers
(bootstrap 90% interval 0.67-0.71, 10-fold cross-validated ECE 0.03). The
test signers alone pick the same value (ECE 0.027, against 0.077 with the
previous 0.86). Predictions shown at >= 90% were right 96% of the time on
the test signers, and 75% of recordings reach it.

Memory and latency are unchanged (same architecture and file sizes).

```bash
# Landmarks: extract_asl_citizen.py on a zip of the videos writes chunk_*.npz.
# asl_citizen/manifest.csv lists one row per video: video, gloss, participant,
# split, member (path in the zip), signease_sign, priority (0 = extract), order
python extract_asl_citizen.py SignEase_ASL_Citizen_subset.zip asl_citizen ours 400 640
python asl_citizen.py --data asl_citizen --out asl_citizen/cache_train --splits train
python asl_citizen.py --data asl_citizen --out asl_citizen/cache_val --splits val
python asl_citizen.py --merge cache asl_citizen/cache_train --repeat 5 --out asl_citizen/cache_mix

C="--cache asl_citizen/cache_mix --monitor-cache asl_citizen/cache_val --init original.tflite"
python finetune.py $C --two-hand --resume runs/d/epoch8.npz --epochs 5 --learning-rate 5e-5 --seed 4 --out runs/asl_d
python finetune.py $C --two-hand --resume runs/e/epoch10.npz --epochs 5 --learning-rate 5e-5 --seed 5 --out runs/asl_e
python finetune.py $C --epochs 8 --seed 6 --out runs/asl_one
# export each best.npz with TensorFlow 2.14 (see below), then:
python eval_asl_citizen.py --data asl_citizen --splits val test \
    --model d=runs/asl_d/final.tflite e=runs/asl_e/final.tflite one=runs/asl_one/final.tflite --out asl_scores.npz
```

If you use this work, please cite ASL Citizen:

```bibtex
@article{desai2023asl,
  title={ASL Citizen: A Community-Sourced Dataset for Advancing Isolated Sign Language Recognition},
  author={Desai, Aashaka and Berger, Lauren and Minakov, Fyodor O and Milan, Vanessa and Singh, Chinmay and Pumphrey, Kriston and Ladner, Richard E and Daum{\'e} III, Hal and Lu, Alex X and Caselli, Naomi and Bragg, Danielle},
  journal={arXiv preprint arXiv:2304.05934},
  year={2023}
}
```

## Before ASL Citizen: a blend of three trained on Kaggle

The backend averages three models with equal weight (`MODEL_BLEND`): two
two-hand models (`asl_model.tflite`, `asl_model_two_hand_b.tflite`) and the
previous one-hand model (`asl_model_one_hand.tflite`). They make different
mistakes, so the blend beats each of them and keeps most of what the two-hand
models lose on signers like the training set.

Three mismatches between the training clips and webcams were measured:

- 147 of 150 random training clips show essentially one tracked hand, while
  webcams usually also see the resting hand at the signer's side. Counting
  tracked frames then often chooses the still hand.
- The original model discards the second hand entirely.
- It reads absolute frame positions, and dictionary signers sit higher
  (shoulders at 0.51 vs 0.64 of the frame) and appear 20% smaller.

`two_hand.py` adds an embedding of the other hand and arm (starting at zero,
so the untrained model equals the one it starts from), moves and scales every
clip to the training median using the shoulders, chooses the dominant hand by
wrist motion, and adds a synthetic resting hand to 35% of one-handed clips in
training. The second two-hand model also varies hand size and uses another seed.

The dictionary videos were split by label: even labels chose between models
and blends, odd labels were held back. The test videos were scored twice:
once for the first two-hand model, then for the blend, chosen on dev only.

| Test set | Previous model | Blend |
| --- | --- | --- |
| Test videos (125), top-1 | 59.2% | **64.0%** |
| Test videos, top-3 | 68.8% | **76.8%** |
| Test videos with two tracked hands (44), top-1 / top-3 | 52.3% / 59.1% | **54.5% / 65.9%** |
| Test videos with hands below the shoulders (65), top-1 / top-3 | 47.7% / 53.8% | **52.3% / 63.1%** |
| All 250 videos, top-1 | 55.6% | **60.8%** |
| All 250 videos, top-3 | 65.2% | **73.6%** |
| Held-out signers, webcam simulation, top-1 | **93.7%** | 93.2% |
| Held-out signers, clean clips, top-1 | **99.0%** | 98.1% |

On all 250 videos the blend fixed 19 predictions and broke 6 (sign test
p=0.015; the dev half influenced the choice). On the test videos alone it
fixed 8 and broke 2 (p=0.11). The held-out figures are optimistic for every
model (the starting weights were trained on those signers). None of this is
real webcam data, which is still what is needed most.

Confidence: `CONFIDENCE_TEMPERATURE = 0.86` (bootstrap 90% interval
0.82-0.90, 10-fold cross-validated ECE 0.06), fitted on all 250 videos. With
it, predictions shown at >= 90% were right 92% of the time.

Removing a hand at inference still helps the two-hand models: without the
backend's per-hand variants the first scores 49.6% instead of 56.0% on dev.

Memory: the whole backend measured 246 MB with one set of models, and about
560 MB once the video fallback loads MediaPipe, so on a 512 MB instance the
server refuses the fallback (`MEMORY_LIMIT_MB`).

```bash
python finetune.py --two-hand --init original.tflite --cache cache --out runs/b --epochs 6
python finetune.py --two-hand --init original.tflite --resume runs/b/best.npz \
    --cache cache --out runs/c --epochs 6 --learning-rate 8e-5
python finetune.py --two-hand --init original.tflite --resume runs/c/epoch6.npz \
    --cache cache --out runs/d --epochs 8 --learning-rate 6e-5
python finetune.py --two-hand --init original.tflite --cache cache --out runs/e --epochs 10 --seed 1
python export.py --weights runs/d/epoch8.npz --out ../ML_Code_ISL/models/asl_model.tflite
python export.py --weights runs/e/epoch10.npz --out ../ML_Code_ISL/models/asl_model_two_hand_b.tflite
```

Use the last epoch, not `best.npz`: `best.npz` follows the webcam simulation,
which has no resting hand, so it keeps the starting weights when resuming.
These steps approximate the shipped models: stage b ran before the motion
rule and resting hand existed, and stages b-d before hand-size variation.

## Fine-tuning setup

`finetune.py` starts from the exact original weights and trains 6 epochs on
the 18 non-held-out signers (held out: 16069, 37779, 62590) with
`augment.py`: aspect stretch +-15% (the measured spread), framing (scale
+-20%, shift +-0.08, tilt +-8 degrees), hands rising from below the frame and
holding before the sign and holding and lowering after it, speed +-30%, and
dropped hand detections. AdamW, peak learning rate 1e-4 with warmup and cosine
decay, label smoothing 0.25 (as the original). The checkpoint is chosen by
held-out webcam-simulation accuracy, not by the dictionary videos. About 35
minutes on an Apple M5 GPU.

## Reproducing

```bash
cd Ml/training
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt            # + tensorflow-metal==1.1.0 on Apple silicon

# 1. Cache the Kaggle landmarks (reads the zip directly, ~1 minute, 2.7 GB)
python build_cache.py --zip ../ML_Code_ISL/data/train_landmark_files.zip \
    --csv ../ML_Code_ISL/data/train.csv --out cache

# 2. Fine-tune from the original model (from git history once replaced)
git show 45f4636:Ml/ML_Code_ISL/models/asl_model.tflite > original.tflite
python verify.py --tflite original.tflite --cache cache
python finetune.py --init original.tflite --cache cache --out runs/finetune --epochs 6

# 3. Export with TensorFlow 2.14 (the backend's tflite-runtime version)
python export.py --weights runs/finetune/best.npz --out ../ML_Code_ISL/models/asl_model.tflite

# 4. Evaluate through the backend and refit the confidence temperature
python extract_videos.py --videos ../../ISLRv6/public/videos/signs --out dictionary.npz
python evaluate.py --model ../ML_Code_ISL/models/asl_model.tflite \
    --cache cache --dictionary dictionary.npz --kaggle-count 1000 --out scores.npz
python calibrate.py scores.npz --fit dictionary
```

Use `evaluate.py --passes 2` for models exported before this one (they drop
frames at random, and the backend averaged two runs).

The best way to improve on these numbers is more real, labelled webcam
recordings: `extract_videos.py` + `evaluate.py` + `calibrate.py` work on any
folder of `<label index>.mp4` videos.
