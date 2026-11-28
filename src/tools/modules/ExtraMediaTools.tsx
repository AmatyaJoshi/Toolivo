import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  Mic,
  MicOff,
  Play,
  RotateCw,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  encodeAudioBufferToWav,
  FileDropzone,
  formatBytes,
  triggerDownload,
  type ToolComponentProps,
} from '../types';
import { encodeAnimatedGif } from '../gifEncoder';

/* 1. Video Trimmer & Cutter */
export const VideoTrimmerTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(5);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (output?.url) URL.revokeObjectURL(output.url);
    };
  }, [videoUrl, output]);

  const handleFile = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    setOutput(null);
    setError(null);
    setProgress(0);
    setVideoUrl(URL.createObjectURL(f));
  };

  const handleTrim = async () => {
    if (!file || !videoUrl || endSec <= startSec) return;
    setBusy(true);
    setError(null);
    setProgress(2);
    const started = performance.now();

    const vid = document.createElement('video');
    vid.src = videoUrl;
    vid.muted = true;
    vid.playsInline = true;

    try {
      await new Promise<void>((res, rej) => {
        vid.onloadedmetadata = () => res();
        vid.onerror = () => rej(new Error('Browser could not decode this video.'));
      });
      vid.currentTime = startSec;
      await new Promise<void>((res) => {
        vid.onseeked = () => res();
      });

      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 1280;
      canvas.height = vid.videoHeight || 720;
      const ctx = canvas.getContext('2d')!;
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const done = new Promise<Blob>((res) => {
        recorder.onstop = () => res(new Blob(chunks, { type: 'video/webm' }));
      });

      recorder.start(200);
      await vid.play();
      const clipLen = Math.max(0.1, endSec - startSec);

      const pump = () => {
        if (vid.currentTime >= endSec || vid.ended || vid.paused) {
          vid.pause();
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        setProgress(Math.min(99, Math.round(((vid.currentTime - startSec) / clipLen) * 100)));
        requestAnimationFrame(pump);
      };
      requestAnimationFrame(pump);

      const blob = await done;
      setProgress(100);
      const name = `${file.name.replace(/\.[^.]+$/, '')}-trimmed.webm`;
      setOutput({ blob, url: URL.createObjectURL(blob), name });
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `${clipLen.toFixed(1)}s trimmed (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trimming failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="video/mp4,video/webm,video/quicktime"
        label="Drop an MP4, WebM, or MOV video to trim"
        hint="Cut exact start and end timestamps locally · Zero watermarks"
        onFiles={handleFile}
      />

      {file && videoUrl && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <video
            src={videoUrl}
            controls
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration || 0;
              setDuration(dur);
              setStartSec(0);
              setEndSec(Number(dur.toFixed(2)));
            }}
            className="max-h-72 w-full rounded-xl bg-black"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-500">Start (seconds)</label>
              <input
                type="number"
                min={0}
                max={Math.max(0, endSec - 0.1)}
                step={0.1}
                value={startSec}
                onChange={(e) => setStartSec(Math.max(0, parseFloat(e.target.value) || 0))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">End (max {duration.toFixed(2)}s)</label>
              <input
                type="number"
                min={startSec + 0.1}
                max={duration || 600}
                step={0.1}
                value={endSec}
                onChange={(e) => setEndSec(Math.min(duration || 600, parseFloat(e.target.value) || duration))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          {busy && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleTrim}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? `Trimming (${progress}%)...` : `Trim & Export (${Math.max(0, endSec - startSec).toFixed(1)}s)`}
          </button>
        </div>
      )}

      {output && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
            Ready: {output.name} ({formatBytes(output.blob.size)})
          </span>
          <button
            type="button"
            onClick={() => triggerDownload(output.blob, output.name)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Download className="h-3.5 w-3.5" />
            Download Clip
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

/* 2. Video to Animated GIF89a Converter */
export const VideoToGifTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [clipSec, setClipSec] = useState(4);
  const [fps, setFps] = useState(8);
  const [widthPx, setWidthPx] = useState(420);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifOut, setGifOut] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (gifOut?.url) URL.revokeObjectURL(gifOut.url);
    };
  }, [videoUrl, gifOut]);

  const handleFile = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    setGifOut(null);
    setError(null);
    setVideoUrl(URL.createObjectURL(f));
  };

  const handleConvert = async () => {
    if (!file || !videoUrl) return;
    setBusy(true);
    setProgress(2);
    setError(null);
    const started = performance.now();

    const vid = document.createElement('video');
    vid.src = videoUrl;
    vid.muted = true;
    vid.playsInline = true;

    try {
      await new Promise<void>((res, rej) => {
        vid.onloadedmetadata = () => res();
        vid.onerror = () => rej(new Error('Could not decode video.'));
      });

      const safeDur = Math.min(12, Math.max(0.5, Math.min(clipSec, vid.duration - startSec)));
      const totalFrames = Math.max(2, Math.min(96, Math.round(safeDur * fps)));
      const aspect = (vid.videoHeight || 240) / (vid.videoWidth || 420);
      const outW = Math.max(160, Math.min(640, widthPx));
      const outH = Math.max(90, Math.round(outW * aspect));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const frames: Uint8ClampedArray[] = [];

      for (let i = 0; i < totalFrames; i += 1) {
        vid.currentTime = startSec + i / fps;
        await new Promise<void>((res) => {
          vid.onseeked = () => res();
        });
        ctx.drawImage(vid, 0, 0, outW, outH);
        frames.push(ctx.getImageData(0, 0, outW, outH).data);
        setProgress(Math.round(((i + 1) / totalFrames) * 85));
      }

      const blob = encodeAnimatedGif(frames, outW, outH, Math.round(100 / fps));
      setProgress(100);
      const name = `${file.name.replace(/\.[^.]+$/, '')}.gif`;
      setGifOut({ blob, url: URL.createObjectURL(blob), name });
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `${outW}×${outH} GIF (${totalFrames} frames · ${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GIF encoding failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="video/mp4,video/webm,video/quicktime"
        label="Drop an MP4, WebM, or MOV clip to convert to animated GIF"
        hint="Pure browser GIF89a LZW encoder · Crisp looping GIFs with zero watermarks"
        onFiles={handleFile}
      />

      {file && videoUrl && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <video
            src={videoUrl}
            controls
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration || 4;
              setDuration(d);
              setClipSec(Math.min(5, Number(d.toFixed(1))));
            }}
            className="max-h-56 w-full rounded-xl bg-black"
          />

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-slate-500">Start (s)</label>
              <input type="number" min={0} max={Math.max(0, duration - 0.5)} step={0.5} value={startSec} onChange={(e) => setStartSec(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Length (max 12s)</label>
              <input type="number" min={0.5} max={12} step={0.5} value={clipSec} onChange={(e) => setClipSec(Math.min(12, Math.max(0.5, parseFloat(e.target.value) || 2)))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">FPS ({fps})</label>
              <select value={fps} onChange={(e) => setFps(parseInt(e.target.value, 10))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value={6}>6 FPS (Smallest)</option>
                <option value={8}>8 FPS (Balanced)</option>
                <option value={10}>10 FPS (Smooth)</option>
                <option value={12}>12 FPS (Fluid)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Width</label>
              <select value={widthPx} onChange={(e) => setWidthPx(parseInt(e.target.value, 10))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value={320}>320 px</option>
                <option value={420}>420 px</option>
                <option value={540}>540 px</option>
              </select>
            </div>
          </div>

          {busy && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleConvert}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? `Encoding GIF (${progress}%)...` : 'Convert to Animated GIF'}
          </button>
        </div>
      )}

      {gifOut && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
              {gifOut.name} · {formatBytes(gifOut.blob.size)}
            </span>
            <button
              type="button"
              onClick={() => triggerDownload(gifOut.blob, gifOut.name)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-3.5 w-3.5" />
              Download GIF
            </button>
          </div>
          <img src={gifOut.url} alt="Generated animated GIF" className="mx-auto max-h-64 rounded-lg border border-slate-200 dark:border-slate-700" />
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

/* 3. Audio to Animated Waveform Video Maker */
export const AudioToVideoTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverImg, setCoverImg] = useState<HTMLImageElement | null>(null);
  const [title, setTitle] = useState('Audio Clip');
  const [ratio, setRatio] = useState<'16:9' | '9:16'>('16:9');
  const [accent, setAccent] = useState('#3B82F6');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outVideo, setOutVideo] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCover = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setCoverImg(img);
    img.src = url;
  };

  const handleRender = async () => {
    if (!audioFile) return;
    setBusy(true);
    setProgress(2);
    setError(null);
    const started = performance.now();

    try {
      const arrayBuf = await audioFile.arrayBuffer();
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuf.slice(0));
      const dest = ctx.createMediaStreamDestination();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      analyser.connect(dest);

      const canvas = document.createElement('canvas');
      canvas.width = ratio === '16:9' ? 1280 : 720;
      canvas.height = ratio === '16:9' ? 720 : 1280;
      const c2d = canvas.getContext('2d')!;
      const canvasStream = canvas.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const recorder = new MediaRecorder(combined, { mimeType: 'video/webm', videoBitsPerSecond: 2_200_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const finished = new Promise<Blob>((res) => {
        recorder.onstop = () => res(new Blob(chunks, { type: 'video/webm' }));
      });

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const startTime = ctx.currentTime;
      const totalDur = Math.min(buffer.duration, 180);
      recorder.start(200);
      source.start();

      let stopped = false;
      source.onended = () => {
        stopped = true;
        if (recorder.state !== 'inactive') recorder.stop();
      };

      const draw = () => {
        if (stopped) return;
        const elapsed = ctx.currentTime - startTime;
        setProgress(Math.min(99, Math.round((elapsed / Math.max(0.1, totalDur)) * 100)));

        c2d.fillStyle = '#070A12';
        c2d.fillRect(0, 0, canvas.width, canvas.height);

        if (coverImg) {
          const s = Math.max(canvas.width / coverImg.width, canvas.height / coverImg.height);
          c2d.globalAlpha = 0.3;
          c2d.drawImage(coverImg, (canvas.width - coverImg.width * s) / 2, (canvas.height - coverImg.height * s) / 2, coverImg.width * s, coverImg.height * s);
          c2d.globalAlpha = 1;
        }

        // Title
        c2d.fillStyle = '#F8FAFC';
        c2d.font = 'bold 42px sans-serif';
        c2d.textAlign = 'center';
        c2d.fillText(title || audioFile.name, canvas.width / 2, canvas.height * 0.34);

        // Live spectrum bars
        analyser.getByteFrequencyData(freqData);
        const barCount = 44;
        const barAreaW = canvas.width * 0.72;
        const barW = barAreaW / barCount;
        const startX = (canvas.width - barAreaW) / 2;
        const baseY = canvas.height * 0.62;
        c2d.fillStyle = accent;

        for (let i = 0; i < barCount; i += 1) {
          const v = freqData[i] / 255;
          const h = Math.max(8, v * 170);
          c2d.fillRect(startX + i * barW + 3, baseY - h / 2, Math.max(4, barW - 6), h);
        }

        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);

      const blob = await finished;
      await ctx.close();
      setProgress(100);
      const name = `${audioFile.name.replace(/\.[^.]+$/, '')}-waveform.webm`;
      setOutVideo({ blob, url: URL.createObjectURL(blob), name });
      onComplete?.({
        inputSummary: audioFile.name,
        outputSummary: `${ratio} Waveform Video (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video render failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="audio/*"
        label="Drop an MP3, WAV, M4A, or OGG audio file"
        hint="Renders an animated real-time waveform video directly in your browser"
        onFiles={(f) => {
          const item = f[0] ?? null;
          setAudioFile(item);
          if (item) setTitle(item.name.replace(/\.[^.]+$/, ''));
          setOutVideo(null);
        }}
      />

      {audioFile && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-slate-500">Title overlay</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Frame ratio</label>
              <select value={ratio} onChange={(e) => setRatio(e.target.value as '16:9' | '9:16')} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value="16:9">16:9 Widescreen (YouTube)</option>
                <option value="9:16">9:16 Vertical (Shorts / Reels)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Waveform color</label>
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-transparent dark:border-slate-700" />
            </div>
          </div>

          <FileDropzone
            accept="image/*"
            label="Optional: Drop background cover art"
            hint="PNG, JPG, or WebP — rendered behind the live waveform"
            onFiles={handleCover}
          />

          {busy && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleRender}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? `Rendering Video (${progress}%)...` : 'Render Animated Waveform Video'}
          </button>
        </div>
      )}

      {outVideo && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-emerald-500">{outVideo.name} ({formatBytes(outVideo.blob.size)})</span>
            <button type="button" onClick={() => triggerDownload(outVideo.blob, outVideo.name)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white">
              <Download className="h-3.5 w-3.5" /> Download Video
            </button>
          </div>
          <video src={outVideo.url} controls className="max-h-64 w-full rounded-lg bg-black" />
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

/* 4. Audio Volume Booster & Speed Changer */
export const AudioVolumeBoosterTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [gainDb, setGainDb] = useState(6);
  const [speed, setSpeed] = useState(1.0);
  const [limiter, setLimiter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setDoneMsg(null);
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData((await f.arrayBuffer()).slice(0));
    await ctx.close();
    setBuffer(decoded);
  };

  const handleExport = async () => {
    if (!buffer || !file) return;
    setBusy(true);
    const started = performance.now();
    try {
      const targetLen = Math.max(1, Math.ceil(buffer.length / speed));
      const offline = new OfflineAudioContext(buffer.numberOfChannels, targetLen, buffer.sampleRate);
      const src = offline.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = speed;

      const gainNode = offline.createGain();
      gainNode.gain.value = Math.pow(10, gainDb / 20);
      src.connect(gainNode);
      gainNode.connect(offline.destination);
      src.start();

      const rendered = await offline.startRendering();
      if (limiter) {
        for (let ch = 0; ch < rendered.numberOfChannels; ch += 1) {
          const data = rendered.getChannelData(ch);
          for (let i = 0; i < data.length; i += 1) {
            data[i] = Math.tanh(data[i]);
          }
        }
      }

      const wav = encodeAudioBufferToWav(rendered, { normalize: false });
      triggerDownload(wav, `${file.name.replace(/\.[^.]+$/, '')}-boosted.wav`);
      setDoneMsg(`Exported boosted WAV (${gainDb >= 0 ? `+${gainDb}` : gainDb} dB · ${speed}× speed · ${formatBytes(wav.size)}).`);
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `${gainDb}dB / ${speed}x WAV (${formatBytes(wav.size)})`,
        processingMs: performance.now() - started,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="audio/*"
        label="Drop an audio track to boost volume or change speed"
        hint="OfflineAudioContext DSP with tanh soft-clipping limiter · Zero uploads"
        onFiles={handleLoad}
      />

      {file && buffer && (
        <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Volume Gain</span>
                <span className="font-mono font-semibold tabular-nums">{gainDb >= 0 ? `+${gainDb}` : gainDb} dB</span>
              </div>
              <input type="range" min={-12} max={18} step={1} value={gainDb} onChange={(e) => setGainDb(parseInt(e.target.value, 10))} className="mt-2 w-full accent-blue-600" />
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Playback Speed</span>
                <span className="font-mono font-semibold tabular-nums">{speed.toFixed(2)}×</span>
              </div>
              <input type="range" min={0.5} max={2.0} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="mt-2 w-full accent-blue-600" />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={limiter} onChange={(e) => setLimiter(e.target.checked)} className="accent-blue-600" />
            Enable soft-clipping limiter (prevents harsh distortion)
          </label>

          <div>
            <button
              type="button"
              disabled={busy}
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {busy ? 'Processing DSP...' : 'Process & Download WAV'}
            </button>
          </div>
        </div>
      )}

      {doneMsg && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{doneMsg}</p>}
    </div>
  );
};

/* 5. Audio Converter & Multi-Track Merger */
export const AudioConverterMergerTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [tracks, setTracks] = useState<{ id: string; file: File; duration: number }[]>([]);
  const [mono, setMono] = useState(false);
  const [normalize, setNormalize] = useState(true);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const addFiles = async (files: File[]) => {
    const ctx = new AudioContext();
    const added: { id: string; file: File; duration: number }[] = [];
    for (const f of files) {
      try {
        const buf = await ctx.decodeAudioData((await f.arrayBuffer()).slice(0));
        added.push({ id: `${f.name}-${Date.now()}-${Math.random()}`, file: f, duration: buf.duration });
      } catch {
        // skip unsupported
      }
    }
    await ctx.close();
    setTracks((prev) => [...prev, ...added]);
  };

  const move = (idx: number, delta: -1 | 1) => {
    setTracks((prev) => {
      const next = [...prev];
      const t = idx + delta;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  };

  const handleMergeExport = async () => {
    if (tracks.length === 0) return;
    setBusy(true);
    const started = performance.now();
    try {
      const sampleRate = 44100;
      const decodedList: AudioBuffer[] = [];
      let totalFrames = 0;

      for (const t of tracks) {
        const ctx = new AudioContext({ sampleRate });
        const buf = await ctx.decodeAudioData((await t.file.arrayBuffer()).slice(0));
        await ctx.close();
        decodedList.push(buf);
        totalFrames += buf.length;
      }

      const channels = mono ? 1 : 2;
      const offline = new OfflineAudioContext(channels, Math.max(1, totalFrames), sampleRate);
      const merged = offline.createBuffer(channels, Math.max(1, totalFrames), sampleRate);
      let offset = 0;

      for (const buf of decodedList) {
        for (let ch = 0; ch < channels; ch += 1) {
          const srcData = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1));
          merged.getChannelData(ch).set(srcData, offset);
        }
        offset += buf.length;
      }

      const wav = encodeAudioBufferToWav(merged, { mono, normalize });
      triggerDownload(wav, tracks.length > 1 ? `toolivo-merged-audio.wav` : `${tracks[0].file.name.replace(/\.[^.]+$/, '')}.wav`);
      setDoneMsg(`Exported ${tracks.length} track(s) as studio WAV (${formatBytes(wav.size)}).`);
      onComplete?.({
        inputSummary: `${tracks.length} audio file(s)`,
        outputSummary: `WAV (${formatBytes(wav.size)})`,
        processingMs: performance.now() - started,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="audio/*"
        multiple
        label="Drop 1 audio file to convert to WAV, or multiple files to merge"
        hint="Supports MP3, M4A, OGG, WebM, and WAV · Joined cleanly at 44.1 kHz PCM"
        onFiles={addFiles}
      />

      {tracks.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {tracks.map((t, idx) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">{idx + 1}. {t.file.name}</p>
                  <p className="font-mono text-slate-500">{t.duration.toFixed(1)}s · {formatBytes(t.file.size)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={idx === 0} onClick={() => move(idx, -1)} className="rounded p-1 text-slate-500 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={idx === tracks.length - 1} onClick={() => move(idx, 1)} className="rounded p-1 text-slate-500 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setTracks((p) => p.filter((x) => x.id !== t.id))} className="rounded p-1 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mono} onChange={(e) => setMono(e.target.checked)} className="accent-blue-600" /> Mono output</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} className="accent-blue-600" /> Peak normalize</label>
          </div>

          <button type="button" disabled={busy} onClick={handleMergeExport} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Download className="h-4 w-4" />
            {busy ? 'Encoding WAV...' : tracks.length > 1 ? `Merge ${tracks.length} Tracks & Download WAV` : 'Convert & Download WAV'}
          </button>
        </div>
      )}

      {doneMsg && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{doneMsg}</p>}
    </div>
  );
};

/* 6. Text to Speech & Live Voice Dictation */
export const TextToSpeechTool: React.FC<ToolComponentProps> = () => {
  const [tab, setTab] = useState<'tts' | 'stt'>('tts');
  const [text, setText] = useState('Welcome to Toolivo. Every tool you need is one click away, running privately right inside your browser.');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [speaking, setSpeaking] = useState(false);

  // Speech-to-Text dictation state
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sttError, setSttError] = useState<string | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const load = () => {
      const list = window.speechSynthesis?.getVoices?.() || [];
      setVoices(list);
      if (list.length > 0 && !selectedVoice) {
        setSelectedVoice(list[0].name);
      }
    };
    load();
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => {
      window.speechSynthesis?.cancel?.();
      window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
    };
  }, [selectedVoice]);

  const speak = () => {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const v = voices.find((x) => x.name === selectedVoice);
    if (v) utt.voice = v;
    utt.rate = rate;
    utt.pitch = pitch;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  };

  const stopSpeak = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const toggleDictation = () => {
    setSttError(null);
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setSttError('Live voice dictation requires Chrome, Edge, or Safari Web Speech Recognition.');
      return;
    }
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev: any) => {
      let full = '';
      for (let i = 0; i < ev.results.length; i += 1) {
        full += ev.results[i][0].transcript;
      }
      setTranscript(full);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button type="button" onClick={() => setTab('tts')} className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${tab === 'tts' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>Text to Speech</button>
        <button type="button" onClick={() => setTab('stt')} className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${tab === 'stt' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>Voice Dictation (Speech to Text)</button>
      </div>

      {tab === 'tts' ? (
        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste any script or article to listen..."
            className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-950"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-slate-500">Voice ({voices.length} installed)</label>
              <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Speed</span><span className="font-mono">{rate.toFixed(1)}×</span></div>
              <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="mt-3 w-full accent-blue-600" />
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Pitch</span><span className="font-mono">{pitch.toFixed(1)}</span></div>
              <input type="range" min={0.5} max={1.8} step={0.1} value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} className="mt-3 w-full accent-blue-600" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={speak} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700">
              <Volume2 className="h-4 w-4" />
              {speaking ? 'Restart Speech' : 'Speak Aloud'}
            </button>
            {speaking && (
              <button type="button" onClick={stopSpeak} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium dark:border-slate-700">
                <Square className="h-3.5 w-3.5" /> Stop
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleDictation}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white ${listening ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? 'Stop Recording' : 'Start Microphone Dictation'}
            </button>
            {transcript && (
              <button type="button" onClick={() => navigator.clipboard.writeText(transcript)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700">
                <Copy className="h-3.5 w-3.5" /> Copy Transcript
              </button>
            )}
          </div>
          {sttError && <p className="text-xs text-red-500">{sttError}</p>}
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={7}
            placeholder="Spoken words will appear here in real time..."
            className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      )}
    </div>
  );
};

/* 7. Passport Photo Maker (300 DPI + 4x6 Print Sheet) */
const PASSPORT_PRESETS = [
  { id: 'us', label: 'US Passport / Visa (2×2 in)', wPx: 600, hPx: 600 },
  { id: 'eu', label: 'UK / EU / India / Schengen (35×45 mm)', wPx: 413, hPx: 531 },
  { id: 'ca', label: 'Canada Passport (50×70 mm)', wPx: 591, hPx: 827 },
  { id: 'jp', label: 'Japan / China Visa (33×48 mm)', wPx: 390, hPx: 567 },
];

export const PassportPhotoMakerTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [presetId, setPresetId] = useState('us');
  const [zoom, setZoom] = useState(1.15);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [brightness, setBrightness] = useState(104);
  const [bgFill, setBgFill] = useState('#FFFFFF');
  const previewRef = useRef<HTMLCanvasElement>(null);

  const preset = PASSPORT_PRESETS.find((p) => p.id === presetId) || PASSPORT_PRESETS[0];

  const handleLoad = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const renderToCanvas = (canvas: HTMLCanvasElement, drawGuides: boolean) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !imgEl) return;
    canvas.width = preset.wPx;
    canvas.height = preset.hPx;
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const baseScale = Math.max(canvas.width / imgEl.naturalWidth, canvas.height / imgEl.naturalHeight) * zoom;
    const dw = imgEl.naturalWidth * baseScale;
    const dh = imgEl.naturalHeight * baseScale;
    const dx = (canvas.width - dw) / 2 + offsetX * (canvas.width / 100);
    const dy = (canvas.height - dh) / 2 + offsetY * (canvas.height / 100);

    ctx.filter = `brightness(${brightness}%)`;
    ctx.drawImage(imgEl, dx, dy, dw, dh);
    ctx.filter = 'none';

    if (drawGuides) {
      ctx.strokeStyle = 'rgba(37,99,235,0.65)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height * 0.44, canvas.width * 0.25, canvas.height * 0.31, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  useEffect(() => {
    if (previewRef.current && imgEl) {
      renderToCanvas(previewRef.current, true);
    }
  });

  const exportSingle = () => {
    if (!imgEl) return;
    const c = document.createElement('canvas');
    renderToCanvas(c, false);
    c.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(blob, `passport-${preset.id}-300dpi.jpg`);
      onComplete?.({ inputSummary: preset.label, outputSummary: `${preset.wPx}×${preset.hPx}px JPG`, processingMs: 5 });
    }, 'image/jpeg', 0.96);
  };

  const exportPrintSheet = () => {
    if (!imgEl) return;
    const single = document.createElement('canvas');
    renderToCanvas(single, false);
    // 4x6 inch sheet at 300 DPI = 1800 x 1200 px
    const sheet = document.createElement('canvas');
    sheet.width = 1800;
    sheet.height = 1200;
    const ctx = sheet.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheet.width, sheet.height);

    const gap = 24;
    const cols = Math.max(1, Math.floor((sheet.width - gap) / (preset.wPx + gap)));
    const rows = Math.max(1, Math.floor((sheet.height - gap) / (preset.hPx + gap)));
    const startX = (sheet.width - (cols * preset.wPx + (cols - 1) * gap)) / 2;
    const startY = (sheet.height - (rows * preset.hPx + (rows - 1) * gap)) / 2;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = startX + c * (preset.wPx + gap);
        const y = startY + r * (preset.hPx + gap);
        ctx.drawImage(single, x, y);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, preset.wPx, preset.hPx);
      }
    }
    sheet.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(blob, `passport-${preset.id}-4x6-sheet.jpg`);
      onComplete?.({ inputSummary: preset.label, outputSummary: `4×6 Print Sheet (${cols * rows} photos)`, processingMs: 8 });
    }, 'image/jpeg', 0.96);
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/*"
        label="Drop a front-facing portrait photo"
        hint="Outputs true 300 DPI single photos and ready-to-print 4×6 inch sheets locally"
        onFiles={handleLoad}
      />

      {imgEl && (
        <div className="grid gap-6 border-t border-slate-200 pt-5 lg:grid-cols-2 dark:border-slate-800">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Official size preset</label>
              <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                {PASSPORT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Zoom</span><span className="font-mono">{Math.round(zoom * 100)}%</span></div>
              <input type="range" min={0.7} max={2.4} step={0.05} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="mt-1.5 w-full accent-blue-600" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Horizontal ({offsetX}%)</label>
                <input type="range" min={-40} max={40} value={offsetX} onChange={(e) => setOffsetX(parseInt(e.target.value, 10))} className="mt-1 w-full accent-blue-600" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Vertical ({offsetY}%)</label>
                <input type="range" min={-40} max={40} value={offsetY} onChange={(e) => setOffsetY(parseInt(e.target.value, 10))} className="mt-1 w-full accent-blue-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Brightness ({brightness}%)</label>
                <input type="range" min={80} max={135} value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value, 10))} className="mt-1 w-full accent-blue-600" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Backdrop fill</label>
                <input type="color" value={bgFill} onChange={(e) => setBgFill(e.target.value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button type="button" onClick={exportSingle} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700">
                <Download className="h-3.5 w-3.5" /> Download Single Photo
              </button>
              <button type="button" onClick={exportPrintSheet} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold dark:border-slate-700">
                <Download className="h-3.5 w-3.5" /> Download 4×6 Print Sheet
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-900">
            <canvas ref={previewRef} className="max-h-72 rounded-lg border border-slate-300 bg-white shadow-xs" />
            <p className="mt-2 font-mono text-[11px] text-slate-500">
              {preset.wPx}×{preset.hPx} px @ 300 DPI · Align face inside oval
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* 8. Background Remover (Pixel Chroma & Edge Feather Cutout) */
export const BackgroundRemoverTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [keyRgb, setKeyRgb] = useState<[number, number, number]>([255, 255, 255]);
  const [tolerance, setTolerance] = useState(42);
  const [feather, setFeather] = useState(14);
  const [replaceBg, setReplaceBg] = useState<'transparent' | 'color'>('transparent');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleLoad = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      // Auto-sample top-left corner pixel as initial background color
      const tmp = document.createElement('canvas');
      tmp.width = 4;
      tmp.height = 4;
      const tctx = tmp.getContext('2d')!;
      tctx.drawImage(img, 0, 0, 4, 4);
      const px = tctx.getImageData(0, 0, 1, 1).data;
      setKeyRgb([px[0], px[1], px[2]]);
      setImgEl(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  useEffect(() => {
    if (!imgEl || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = imgEl.naturalWidth;
    c.height = imgEl.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(imgEl, 0, 0);
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imageData.data;
    const [kr, kg, kb] = keyRgb;

    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - kr;
      const dg = d[i + 1] - kg;
      const db = d[i + 2] - kb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= tolerance) {
        d[i + 3] = 0;
      } else if (dist < tolerance + feather) {
        const ratio = (dist - tolerance) / Math.max(1, feather);
        d[i + 3] = Math.round(d[i + 3] * ratio);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [imgEl, keyRgb, tolerance, feather]);

  const pickColorAtClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imgEl || !canvasRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * imgEl.naturalWidth);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * imgEl.naturalHeight);
    const tmp = document.createElement('canvas');
    tmp.width = imgEl.naturalWidth;
    tmp.height = imgEl.naturalHeight;
    const tctx = tmp.getContext('2d')!;
    tctx.drawImage(imgEl, 0, 0);
    const px = tctx.getImageData(x, y, 1, 1).data;
    setKeyRgb([px[0], px[1], px[2]]);
  };

  const handleExport = () => {
    if (!canvasRef.current) return;
    const src = canvasRef.current;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d')!;
    if (replaceBg === 'color') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.drawImage(src, 0, 0);
    out.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(blob, 'toolivo-cutout.png');
      onComplete?.({ inputSummary: `${src.width}×${src.height}`, outputSummary: `PNG Cutout (${formatBytes(blob.size)})`, processingMs: 10 });
    }, 'image/png');
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/*"
        label="Drop a logo, product photo, or portrait to remove its background"
        hint="Auto-samples corner backdrop · Click anywhere on the image to pick an exact color to remove"
        onFiles={handleLoad}
      />

      {imgEl && (
        <div className="grid gap-6 border-t border-slate-200 pt-5 lg:grid-cols-2 dark:border-slate-800">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Sampled background color</span>
              <span className="inline-flex items-center gap-2 font-mono">
                <span className="inline-block h-4 w-4 rounded border border-slate-300" style={{ backgroundColor: `rgb(${keyRgb.join(',')})` }} />
                rgb({keyRgb.join(', ')})
              </span>
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Color tolerance</span><span className="font-mono">{tolerance}</span></div>
              <input type="range" min={5} max={150} value={tolerance} onChange={(e) => setTolerance(parseInt(e.target.value, 10))} className="mt-1.5 w-full accent-blue-600" />
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Edge feather smoothness</span><span className="font-mono">{feather}</span></div>
              <input type="range" min={0} max={50} value={feather} onChange={(e) => setFeather(parseInt(e.target.value, 10))} className="mt-1.5 w-full accent-blue-600" />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <select value={replaceBg} onChange={(e) => setReplaceBg(e.target.value as 'transparent' | 'color')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <option value="transparent">Transparent PNG</option>
                <option value="color">Solid Color Backdrop</option>
              </select>
              {replaceBg === 'color' && (
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700" />
              )}
            </div>

            <button type="button" onClick={handleExport} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700">
              <Download className="h-4 w-4" />
              Download Cutout PNG
            </button>
          </div>

          <div
            className="flex flex-col items-center justify-center rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            style={{
              backgroundImage:
                replaceBg === 'transparent'
                  ? 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)'
                  : undefined,
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              backgroundColor: replaceBg === 'color' ? bgColor : '#f1f5f9',
            }}
          >
            <canvas ref={canvasRef} onClick={pickColorAtClick} title="Click to sample background color" className="max-h-72 max-w-full cursor-crosshair rounded object-contain" />
            <p className="mt-2 rounded bg-slate-950/70 px-2 py-0.5 text-[11px] text-white">
              Click any background area to re-sample color
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* 9. Image Crop, Rotate & Filters */
export const ImageCropRotateTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState<'free' | '1:1' | '16:9' | '4:3' | '9:16'>('1:1');
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(false);
  const [format, setFormat] = useState<'image/png' | 'image/webp' | 'image/jpeg'>('image/png');
  const previewRef = useRef<HTMLCanvasElement>(null);

  const handleLoad = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const drawOutput = (canvas: HTMLCanvasElement) => {
    if (!imgEl) return;
    const swapped = rotation % 180 !== 0;
    const srcW = swapped ? imgEl.naturalHeight : imgEl.naturalWidth;
    const srcH = swapped ? imgEl.naturalWidth : imgEl.naturalHeight;

    let outW = srcW;
    let outH = srcH;
    if (ratio !== 'free') {
      const [rw, rh] = ratio.split(':').map(Number);
      const target = rw / rh;
      if (srcW / srcH > target) {
        outW = Math.round(srcH * target);
      } else {
        outH = Math.round(srcW / target);
      }
    }

    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)${grayscale ? ' grayscale(100%)' : ''}`;
    ctx.drawImage(imgEl, -imgEl.naturalWidth / 2, -imgEl.naturalHeight / 2);
    ctx.restore();
  };

  useEffect(() => {
    if (previewRef.current && imgEl) drawOutput(previewRef.current);
  });

  const handleDownload = () => {
    if (!imgEl) return;
    const c = document.createElement('canvas');
    drawOutput(c);
    const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';
    c.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(blob, `toolivo-edited.${ext}`);
      onComplete?.({ inputSummary: `${imgEl.naturalWidth}×${imgEl.naturalHeight}`, outputSummary: `${c.width}×${c.height} ${ext.toUpperCase()}`, processingMs: 5 });
    }, format, 0.92);
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/*"
        label="Drop an image to crop, rotate, flip, or apply filters"
        hint="Supports 1:1, 16:9, 4:3, 9:16 framing · Instant Canvas export"
        onFiles={handleLoad}
      />

      {imgEl && (
        <div className="grid gap-6 border-t border-slate-200 pt-5 lg:grid-cols-2 dark:border-slate-800">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500">Aspect ratio crop</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(['free', '1:1', '16:9', '4:3', '9:16'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${ratio === r ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'}`}
                  >
                    {r === 'free' ? 'Original' : r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-700">
                <RotateCw className="h-3.5 w-3.5" /> Rotate 90°
              </button>
              <button type="button" onClick={() => setFlipH((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-700">
                <FlipHorizontal2 className="h-3.5 w-3.5" /> Flip H
              </button>
              <button type="button" onClick={() => setFlipV((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-700">
                <FlipVertical2 className="h-3.5 w-3.5" /> Flip V
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Brightness ({brightness}%)</span>
                <input type="range" min={50} max={160} value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value, 10))} className="mt-1 w-full accent-blue-600" />
              </div>
              <div>
                <span className="text-slate-500">Contrast ({contrast}%)</span>
                <input type="range" min={50} max={160} value={contrast} onChange={(e) => setContrast(parseInt(e.target.value, 10))} className="mt-1 w-full accent-blue-600" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} className="accent-blue-600" />
                Grayscale
              </label>
              <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP</option>
                <option value="image/jpeg">JPG</option>
              </select>
            </div>

            <button type="button" onClick={handleDownload} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700">
              <Download className="h-4 w-4" />
              Export Edited Image
            </button>
          </div>

          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-900">
            <canvas ref={previewRef} className="max-h-72 max-w-full rounded object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
