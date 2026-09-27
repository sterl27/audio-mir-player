# Audio MIR Player

Liquid Noir analysis dashboard. Static HTML. No build.

Sidebar: Home, Explore, Analysis, Library, AI Playground, Settings.

Analysis stage:

- Drop audio
- Essentia.js descriptors: RhythmExtractor2013, KeyExtractor, Danceability, DynamicComplexity, Loudness / ReplayGain, SpectralCentroidTime, Energy, ZeroCrossingRate, OnsetRate, TuningFrequencyExtractor, averaged MFCC0
- Web Audio graph: `<audio>` → MediaElementSource → AnalyserNode → destination
- Spectrum, waveform, peak + RMS
- Live Metrics footer splits BPM from context/FFT
- Explore page lists each algorithm and fills live values after a run

Library is session-only. Playground does not fake an LLM call.

## Local

Open `index.html` or `npx serve .`

## Deploy

Import `sterl27/audio-mir-player` on Vercel. Framework: Other.
