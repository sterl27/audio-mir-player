# Audio MIR Player

Drag-and-drop audio player with client-side music information retrieval.

Drop a file. The browser decodes it, draws a waveform, and runs **Essentia.js** for:

- Tempo (BPM)
- Musical key
- Beat count
- Duration

Playback uses a shared `AudioContext`:

`<audio>` → `MediaElementSource` → `AnalyserNode` (fftSize 2048) → destination

Live view: log-mapped spectrum bars, time-domain waveform, peak + RMS meters.

Audio never leaves the device. Analysis resamples to 44.1 kHz (required by `RhythmExtractor2013`) and caps at the first 90 seconds so long tracks do not freeze the tab.

## Local

Open `index.html` in a browser, or:

```bash
npx serve .
```

## Vercel

Static site. No build step.

```bash
vercel
```

Repo: https://github.com/sterl27/audio-mir-player
