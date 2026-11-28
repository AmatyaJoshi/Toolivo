import React, { useEffect, useRef, useState } from 'react';
import { Download, Play, Square } from 'lucide-react';
import {
  encodeAudioBufferToWav,
  FileDropzone,
  formatBytes,
  triggerDownload,
  type ToolComponentProps,
} from '../types';

function drawWaveform(canvas: HTMLCanvasElement, buffer: AudioBuffer, startRatio = 0, endRatio = 1) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.ceil(data.length / width));
  const mid = height / 2;

  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(0, 0, width, height);

  const sx = Math.floor(startRatio * width);
  const ex = Math.floor(endRatio * width);
  ctx.fillStyle = 'rgba(37, 99, 235, 0.14)';
  ctx.fillRect(sx, 0, Math.max(2, ex - sx), height);

  for (let x = 0; x < width; x += 2) {
    let min = 1;
    let max = -1;
    const base = x * step;
    for (let j = 0; j < step && base + j < data.length; j += 1) {
      const v = data[base + j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const inRegion = x >= sx && x <= ex;
    ctx.fillStyle = inRegion ? '#2563EB' : '#94A3B8';
    const top = mid + min * mid * 0.85;
    const barH = Math.max(2, (max - min) * mid * 0.85);
    ctx.fillRect(x, top, 1.5, barH);
  }
}

export const VideoCompressorTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [scale, setScale] = useState(0.75);
  const [bitrateKbps, setBitrateKbps] = useState(1200);
  const [progress, setProgress] = useState(0);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ blob: Blob; filename: string; url: string } | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    return () => {
      if (output?.url) URL.revokeObjectURL(output.url);
    };
  }, [output]);

  const handleCompress = async () => {
    if (!file) return;
    setCompressing(true);
    setProgress(0);
    setError(null);
    cancelRef.current = false;
    const started = performance.now();

    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Could not decode this video format in your browser.'));
      });

      const targetW = Math.max(160, Math.round((video.videoWidth * scale) / 2) * 2);
      const targetH = Math.max(90, Math.round((video.videoHeight * scale) / 2) * 2);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable.');

      const canvasStream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: bitrateKbps * 1000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const donePromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
        recorder.onerror = () => reject(new Error('MediaRecorder encoding failed.'));
      });

      recorder.start(250);
      await video.play();

      const drawLoop = () => {
        if (cancelRef.current) {
          video.pause();
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        if (video.ended || video.paused) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, targetW, targetH);
        if (video.duration > 0) {
          setProgress(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
        }
        requestAnimationFrame(drawLoop);
      };
      requestAnimationFrame(drawLoop);

      video.onended = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };

      const compressedBlob = await donePromise;
      if (cancelRef.current) {
        setProgress(0);
        return;
      }

      setProgress(100);
      if (output?.url) URL.revokeObjectURL(output.url);
      const filename = `${file.name.replace(/\.[^.]+$/, '')}-compressed.webm`;
      setOutput({ blob: compressedBlob, filename, url: URL.createObjectURL(compressedBlob) });

      onComplete?.({
        inputSummary: `${file.name} (${formatBytes(file.size)})`,
        outputSummary: `${targetW}×${targetH} WebM (${formatBytes(compressedBlob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video compression failed.');
    } finally {
      URL.revokeObjectURL(videoUrl);
      setCompressing(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="video/mp4,video/webm,video/quicktime"
        label="Drop an MP4, WebM, or MOV video clip"
        hint="Processed locally via Canvas + MediaRecorder · Keep clips under 100 MB for fast browser encoding"
        onFiles={(files) => {
          setError(null);
          setOutput(null);
          setProgress(0);
          setFile(files[0] ?? null);
        }}
      />

      {file && (
        <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-slate-100">{file.name}</span>
            <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Resolution scale
              </label>
              <select
                disabled={compressing}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={1}>100% (Original resolution)</option>
                <option value={0.75}>75% (Balanced web size)</option>
                <option value={0.5}>50% (Compact shareable clip)</option>
              </select>
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <label className="font-medium text-slate-600 dark:text-slate-400">Target video bitrate</label>
                <span className="font-mono font-semibold tabular-nums">{bitrateKbps} kbps</span>
              </div>
              <input
                type="range"
                disabled={compressing}
                min={400}
                max={4000}
                step={100}
                value={bitrateKbps}
                onChange={(e) => setBitrateKbps(parseInt(e.target.value, 10))}
                className="mt-3 w-full accent-blue-600"
              />
            </div>
          </div>

          {compressing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Encoding frames locally...</span>
                <span className="font-mono font-semibold tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={compressing}
              onClick={handleCompress}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {compressing ? 'Compressing...' : 'Compress Video'}
            </button>
            {compressing && (
              <button
                type="button"
                onClick={() => {
                  cancelRef.current = true;
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {output && file && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{output.filename}</p>
              <p className="mt-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {formatBytes(file.size)} → <strong className="text-emerald-700 dark:text-emerald-400">{formatBytes(output.blob.size)}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerDownload(output.blob, output.filename)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Download className="h-3.5 w-3.5" />
              Download Compressed Video
            </button>
          </div>
          <video src={output.url} controls className="max-h-64 w-full rounded-lg bg-black" />
        </div>
      )}
    </div>
  );
};

export const VideoToAudioTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [mono, setMono] = useState(false);
  const [normalize, setNormalize] = useState(true);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (audioBuffer && canvasRef.current) {
      drawWaveform(canvasRef.current, audioBuffer);
    }
  }, [audioBuffer]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleLoadFile = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setDecoding(true);
    setError(null);
    setAudioBuffer(null);
    setWavBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    try {
      const arrayBuf = await f.arrayBuffer();
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      await ctx.close();
      setAudioBuffer(decoded);
    } catch {
      setError('Could not extract an audio track from this video file. Ensure it contains an audio stream.');
    } finally {
      setDecoding(false);
    }
  };

  const handleExport = () => {
    if (!audioBuffer || !file) return;
    const started = performance.now();
    const blob = encodeAudioBufferToWav(audioBuffer, { mono, normalize });
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(blob);
    setWavBlob(blob);
    setAudioUrl(url);
    const outName = `${file.name.replace(/\.[^.]+$/, '')}-audio.wav`;
    triggerDownload(blob, outName);
    onComplete?.({
      inputSummary: `${file.name} (${audioBuffer.duration.toFixed(1)}s)`,
      outputSummary: `Extracted ${mono ? 'Mono' : 'Stereo'} WAV (${formatBytes(blob.size)})`,
      processingMs: performance.now() - started,
    });
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="video/mp4,video/webm,video/quicktime,audio/*"
        label="Drop a video file to extract its audio track"
        hint="MP4, WebM, or MOV · Decoded locally via Web Audio API with zero server upload"
        onFiles={handleLoadFile}
      />

      {decoding && (
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Decoding embedded audio stream locally...
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {audioBuffer && file && (
        <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-slate-100">{file.name}</span>
            <span className="font-mono tabular-nums">
              {audioBuffer.duration.toFixed(2)}s · {audioBuffer.sampleRate} Hz · {audioBuffer.numberOfChannels} ch
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={720}
            height={110}
            className="h-28 w-full rounded-lg border border-slate-200 dark:border-slate-700"
          />

          <div className="flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={mono} onChange={(e) => setMono(e.target.checked)} className="accent-blue-600" />
              Downmix to Mono (smaller file)
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} className="accent-blue-600" />
              Normalize peak loudness (−1 dBFS)
            </label>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Extract & Download Audio (.wav)
          </button>

          {audioUrl && wavBlob && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                Audio ready ({formatBytes(wavBlob.size)})
              </p>
              <audio src={audioUrl} controls className="w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AudioTrimmerTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [normalize, setNormalize] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playbackRef = useRef<{ ctx: AudioContext; source: AudioBufferSourceNode } | null>(null);

  useEffect(() => {
    if (buffer && canvasRef.current && buffer.duration > 0) {
      drawWaveform(canvasRef.current, buffer, startSec / buffer.duration, endSec / buffer.duration);
    }
  }, [buffer, startSec, endSec]);

  useEffect(() => {
    return () => {
      playbackRef.current?.source.stop();
      void playbackRef.current?.ctx.close();
    };
  }, []);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError(null);
    setFile(f);
    try {
      const ab = await f.arrayBuffer();
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(ab.slice(0));
      await ctx.close();
      setBuffer(decoded);
      setStartSec(0);
      setEndSec(Number(decoded.duration.toFixed(2)));
    } catch {
      setError('Unable to decode this audio file in your browser.');
    }
  };

  const stopPreview = () => {
    if (playbackRef.current) {
      try {
        playbackRef.current.source.stop();
      } catch {
        // already stopped
      }
      void playbackRef.current.ctx.close();
      playbackRef.current = null;
    }
    setPlaying(false);
  };

  const togglePreview = () => {
    if (!buffer) return;
    if (playing) {
      stopPreview();
      return;
    }
    const ctx = new AudioContext();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const dur = Math.max(0.1, endSec - startSec);
    src.onended = () => {
      setPlaying(false);
      void ctx.close();
      playbackRef.current = null;
    };
    src.start(0, startSec, dur);
    playbackRef.current = { ctx, source: src };
    setPlaying(true);
  };

  const handleExportTrimmed = () => {
    if (!buffer || !file) return;
    const started = performance.now();
    const safeStart = Math.max(0, Math.min(startSec, buffer.duration - 0.1));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(endSec, buffer.duration));
    const startSample = Math.floor(safeStart * buffer.sampleRate);
    const endSample = Math.floor(safeEnd * buffer.sampleRate);
    const frameCount = Math.max(1, endSample - startSample);

    const ctx = new OfflineAudioContext(buffer.numberOfChannels, frameCount, buffer.sampleRate);
    const trimmed = ctx.createBuffer(buffer.numberOfChannels, frameCount, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
      trimmed.copyToChannel(buffer.getChannelData(ch).slice(startSample, endSample), ch);
    }
    const wav = encodeAudioBufferToWav(trimmed, { normalize });
    const outName = `${file.name.replace(/\.[^.]+$/, '')}-trimmed.wav`;
    triggerDownload(wav, outName);
    onComplete?.({
      inputSummary: `${file.name} (${buffer.duration.toFixed(1)}s)`,
      outputSummary: `Trimmed ${(safeEnd - safeStart).toFixed(1)}s WAV (${formatBytes(wav.size)})`,
      processingMs: performance.now() - started,
    });
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="audio/*"
        label="Drop an MP3, WAV, OGG, or M4A audio file"
        hint="Inspect waveform, set exact start/end seconds, normalize peaks, and export WAV locally"
        onFiles={handleLoad}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {buffer && file && (
        <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <canvas
            ref={canvasRef}
            width={720}
            height={110}
            className="h-28 w-full rounded-lg border border-slate-200 dark:border-slate-700"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Start time (seconds)
              </label>
              <input
                type="number"
                min={0}
                max={Math.max(0, endSec - 0.1)}
                step={0.1}
                value={startSec}
                onChange={(e) => setStartSec(Math.max(0, parseFloat(e.target.value) || 0))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                End time (seconds · max {buffer.duration.toFixed(2)}s)
              </label>
              <input
                type="number"
                min={startSec + 0.1}
                max={buffer.duration}
                step={0.1}
                value={endSec}
                onChange={(e) => setEndSec(Math.min(buffer.duration, parseFloat(e.target.value) || buffer.duration))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} className="accent-blue-600" />
            Normalize peak volume to −1 dBFS
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={togglePreview}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {playing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? 'Stop Preview' : 'Preview Selection'}
            </button>
            <button
              type="button"
              onClick={handleExportTrimmed}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export Trimmed WAV ({Math.max(0, endSec - startSec).toFixed(1)}s)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
