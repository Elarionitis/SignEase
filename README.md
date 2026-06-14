# Sign Language Detection

This workspace contains a sign language detection project with two main parts:

- `ISLRv6 - Copy` is the frontend. It is the Next.js app that shows the website and sign detection UI.
- `Ml` is the backend. It is the Python and machine learning code that processes video and predicts signs.

## What the project does

The frontend lets a user open the camera, record a sign, and send the video to the backend.
The backend extracts landmarks from the video, runs the ML model, and returns the detected sign.

## Main folders

- `ISLRv6 - Copy/ISLRv6` - frontend app source, components, pages, styles, and public assets.
- `Ml` - Flask API, ML scripts, model files, and Python environment files.

## Notes

- Generated files, virtual environments, cache folders, and office documents should not be committed.
- The root `.gitignore` in this repository excludes the common files that should stay local.