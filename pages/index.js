import Head from 'next/head';
import { useState, useRef, useEffect, useCallback } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [features, setFeatures] = useState({ tempo: '—', key: '—', beats: '—', duration: '—' });
  const [dragover, setDragover] = useState(false);
  const [essentiaReady, setEssentiaReady] = useState(false);

  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const essentiaRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const animIdRef = useRef(null);

  // Load Essentia.js from CDN on mount
  useEffect(() => {
    let cancelled = false;
    async function loadEssentia() {
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.umd.js');
        if (cancelled) return;
        // UMD build attaches to window
        const Essentia = window.Essentia;
        const EssentiaWASM = window.EssentiaWASM;
        if (Essentia && EssentiaWASM) {
          const wasm = await EssentiaWASM();
          essentiaRef.current = new Essentia(wasm);
          setEssentiaReady(true);
          setStatus('MIR engine ready);
        }
      } catch (err) {
        setStatus('Failed to load MIR engine: ' + err.message);
      }
    }
    loadEssentia();
    return () => { cancelled = true; };
  }, []);

  const drawWaveform = useCallback((data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d);
    const dpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
    const w = canvas.width = canvas.offsetWidth * dpr;
    const h = canvas.height = canvas.offsetHeight * dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#6c5ce7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const step = Math.ceil(data.length / w);
    for (let i = 0; i < w; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const v = data[i * step + j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      ctx.moveTo(i, (1 + min) * h / 2);
      ctx.lineTo(i, (1 + max) * h / 2);
    }
    ctx.stroke();
  }, []);

  const startLiveViz = useCallback(() => {
    if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d);
    function draw() {
      animIdRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = 'rgba(10,10,16,0.25)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a29bfe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const slice = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const y = (dataArray[i] / 128) * h / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += slice;
      }
      ctx.stroke();
    }
    draw();
  }, []);

  const runMIR = useCallback(async (channelData, sr) => {
    const essentia = essentiaRef.current;
    if (!essentia) throw new Error('Essentia not loaded);
    const signal = essentia.arrayToVector(channelData);
    const rhythm = essentia.RhythmExtractor2013(signal, 0, 0, 1024, 2048, 40, 208, 40, 512, true, true, 'multifeature);
    const keyRes = essentia.KeyExtractor(signal, true, 4096, 12, 3500, 60, 25, 0.2, 0.01, 0.2, 1.0, 440, 'bgate', 3500, 25, 0.0001, 440, 0.0, 'cosine', true);
    return {
      tempo: rhythm.bpm,
      key: keyRes.key + ' ' + keyRes.scale,
      beats: rhythm.beats ? rhythm.beats.size() : 0,
    };
  }, []);

  const handleFile = useCallback(async (f) => {
    setFile(f);
    setStatus('Decoding audio...);
    const arrayBuf = await f.arrayBuffer();
    const blobUrl = URL.createObjectURL(new Blob([arrayBuf]));
    if (audioRef.current) audioRef.current.src = blobUrl;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext());
    }
    const decoded = await audioContextRef.current.decodeAudioData(arrayBuf.slice(0));
    const channelData = decoded.getChannelData(0);
    const sr = decoded.sampleRate;

    setFeatures(prev => ({ ...prev, duration: formatTime(decoded.duration) }));
    drawWaveform(channelData);

    setStatus('Analyzing...);
    try {
      const results = await runMIR(channelData, sr);
      setFeatures(prev => ({
        ...prev,
        tempo: results.tempo.toFixed(1) + ' BPM',
        key: results.key,
        beats: results.beats,
      }));
      setStatus('Analysis complete);
    } catch (err) {
      setStatus('Analysis failed: ' + err.message);
    }

    // Live analyser
    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048;
    sourceNodeRef.current.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);
    startLiveViz();
  }, [drawWaveform, runMIR, startLiveViz]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  return (
    <>
      <Head>
        <title>Audio MIR Player</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={styles.main}>
        <h1 style={styles.h1}>Audio MIR Player</h1>
        <p style={styles.sub}>Drop an audio file — tempo, key, and beats detected in your browser</p>

        <div
          style={{ ...styles.dropzone, borderColor: dragover ? '#6c5ce7' : '#2a2a38', background: dragover ? '#1a1a26' : '#14141c' }}
          onClick={() => document.getElementById('fileInput').click()}
          onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={onDrop}
        >
          <div style={styles.icon}🎵</div>
          <p style={styles.dropText}>Drag &amp; drop audio here, or click to browse</p>
          <p style={styles.hint}>WAV, MP3, FLAC, OGG, M4A</p>
          <input type="file" id="fileInput" accept="audio/*" hidden onChange={(e) => e.target.files.length && handleFile(e.target.files[0])} />
        </div>

        {file && (
          <div style={styles.player}>
            <div style={styles.fileName}>{file.name}</div>
            <audio ref={audioRef} controls style={styles.audio} />
            <canvas ref={canvasRef} style={styles.canvas} />
            <div style={styles.features}>
              {Object.entries(features).map(([label, value]) => (
                <div key={label} style={styles.feature}>
                  <div style={styles.featureLabel}>{label}</div>
                  <div style={styles.featureValue}>{value}</div>
                </div>
              ))}
            </div>
            <div style={styles.status}>
              {status.includes('...') && <span style={styles.spinner}></span>}
              {status}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0);
}

const styles = {
  main: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: '#0d0d12',
    color: '#e8e8ed',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
  },
  h1: { fontSize: '1.4rem', fontWeight: 600, marginBottom: 8, letterSpacing: '-0.02em' },
  sub: { color: '#7a7a8c', fontSize: '0.85rem', marginBottom: 32 },
  dropzone: {
    width: '100%', maxWidth: 640,
    border: '2px dashed #2a2a38',
    borderRadius: 16,
    padding: '60px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  icon: { fontSize: '2.5rem', marginBottom: 12 },
  dropText: { color: '#9a9aad', fontSize: '0.95rem' },
  hint: { color: '#5a5a6e', fontSize: '0.75rem', marginTop: 8 },
  player: { width: '100%', maxWidth: 640, marginTop: 24 },
  fileName: { fontSize: '0.9rem', color: '#b8b8c8', marginBottom: 12, wordBreak: 'break-all' },
  audio: { width: '100%', marginBottom: 16 },
  canvas: { width: '100%', height: 120, borderRadius: 8, background: '#0a0a10', display: 'block' },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginTop: 16,
  },
  feature: { background: '#14141c', borderRadius: 10, padding: 14, textAlign: 'center' },
  featureLabel: { fontSize: '0.7rem', color: '#7a7a8c', textTransform: 'uppercase', letterSpacing: '0.08em' },
  featureValue: { fontSize: '1.3rem', fontWeight: 600, marginTop: 4, color: '#6c5ce7' },
  status: { color: '#7a7a8c', fontSize: '0.8rem', marginTop: 12, minHeight: '1.2em' },
  spinner: {
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid #2a2a38', borderTopColor: '#6c5ce7',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    verticalAlign: 'middle', marginRight: 6,
  },
};