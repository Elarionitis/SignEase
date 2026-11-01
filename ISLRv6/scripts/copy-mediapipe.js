/**
 * Copies the MediaPipe Holistic runtime (JS, WASM and models) into
 * public/mediapipe/holistic so the browser loads it from our own origin.
 * Runs automatically before `next dev` and `next build`.
 */
const fs = require("fs");
const path = require("path");

const source = path.dirname(require.resolve("@mediapipe/holistic/package.json"));
const target = path.join(__dirname, "..", "public", "mediapipe", "holistic");
// modelComplexity is fixed at 1 (pose_landmark_full), so the 27 MB heavy pose
// model is never requested.
const skipped = new Set(["pose_landmark_heavy.tflite", "package.json", "README.md", "index.d.ts"]);

fs.mkdirSync(target, { recursive: true });

let copied = 0;
for (const file of fs.readdirSync(source)) {
  if (skipped.has(file)) continue;

  const from = path.join(source, file);
  const to = path.join(target, file);
  const fromStat = fs.statSync(from);
  if (!fromStat.isFile()) continue;

  const toStat = fs.existsSync(to) ? fs.statSync(to) : null;
  if (toStat && toStat.size === fromStat.size && toStat.mtimeMs >= fromStat.mtimeMs) continue;

  fs.copyFileSync(from, to);
  copied += 1;
}

console.log(`[mediapipe] ${copied ? `copied ${copied} file(s)` : "assets up to date"} -> public/mediapipe/holistic`);
