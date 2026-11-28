import React, { useEffect, useState } from 'react';
import { Download, Lock, RefreshCw, Trash2, Unlock } from 'lucide-react';
import { FileDropzone, formatBytes, triggerDownload, type ToolComponentProps } from '../types';

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to decode "${file.name}" as an image.`));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Browser could not encode the requested image format.'));
        else resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

interface ProcessedImageItem {
  id: string;
  originalName: string;
  originalSize: number;
  outputName: string;
  outputSize: number;
  width: number;
  height: number;
  blob: Blob;
  previewUrl: string;
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const ImageCompressorTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<'image/webp' | 'image/jpeg'>('image/webp');
  const [quality, setQuality] = useState(0.78);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessedImageItem[]>([]);

  useEffect(() => {
    return () => {
      results.forEach((r) => URL.revokeObjectURL(r.previewUrl));
    };
  }, [results]);

  const handleAddFiles = (incoming: File[]) => {
    setError(null);
    const valid = incoming.filter((f) => f.type.startsWith('image/') && f.size <= MAX_IMAGE_BYTES);
    if (valid.length < incoming.length) {
      setError('Some files were skipped (only images up to 25 MB are supported).');
    }
    setFiles((prev) => [...prev, ...valid].slice(0, 15));
  };

  const handleCompress = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    const started = performance.now();

    try {
      results.forEach((r) => URL.revokeObjectURL(r.previewUrl));
      const out: ProcessedImageItem[] = [];
      let totalIn = 0;
      let totalOut = 0;

      for (const file of files) {
        const img = await loadImage(file);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable.');
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const blob = await canvasToBlob(canvas, format, quality);
        const ext = format === 'image/webp' ? 'webp' : 'jpg';
        const baseName = file.name.replace(/\.[^.]+$/, '');
        totalIn += file.size;
        totalOut += blob.size;
        out.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          originalName: file.name,
          originalSize: file.size,
          outputName: `${baseName}-compressed.${ext}`,
          outputSize: blob.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
          blob,
          previewUrl: URL.createObjectURL(blob),
        });
      }

      setResults(out);
      const savedPct = totalIn > 0 ? Math.max(0, Math.round(((totalIn - totalOut) / totalIn) * 100)) : 0;
      onComplete?.({
        inputSummary: `${files.length} image(s) (${formatBytes(totalIn)})`,
        outputSummary: `${formatBytes(totalOut)} (${savedPct}% smaller)`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/jpeg,image/png,image/webp"
        multiple
        label="Drop JPG, PNG, or WebP images here"
        hint="Up to 15 images per batch · 25 MB max per file · Processed locally via Canvas API"
        onFiles={handleAddFiles}
      />

      {files.length > 0 && (
        <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Output format
              </label>
              <div className="mt-2 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setFormat('image/webp')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    format === 'image/webp'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  WebP (Smallest)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('image/jpeg')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    format === 'image/jpeg'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  JPEG (Universal)
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="img-quality" className="font-medium text-slate-600 dark:text-slate-400">
                  Compression quality
                </label>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {Math.round(quality * 100)}%
                </span>
              </div>
              <input
                id="img-quality"
                type="range"
                min={0.2}
                max={0.95}
                step={0.01}
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="mt-3 w-full accent-blue-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {files.length} file{files.length === 1 ? '' : 's'} queued ·{' '}
              <span className="font-mono tabular-nums">
                {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}
              </span>{' '}
              total
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setResults([]);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleCompress}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {processing ? 'Compressing...' : `Compress ${files.length} Image${files.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {results.map((item) => {
            const delta = item.originalSize - item.outputSize;
            const pct = item.originalSize > 0 ? Math.round((delta / item.originalSize) * 100) : 0;
            return (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={item.previewUrl}
                    alt={item.outputName}
                    className="h-12 w-12 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.outputName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono tabular-nums">{item.width}×{item.height}</span> ·{' '}
                      <span className="font-mono tabular-nums">{formatBytes(item.originalSize)}</span> →{' '}
                      <span className="font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatBytes(item.outputSize)}
                      </span>{' '}
                      ({pct >= 0 ? `−${pct}%` : `+${Math.abs(pct)}%`})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload(item.blob, item.outputName)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ImageResizerTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(630);
  const [lockAspect, setLockAspect] = useState(true);
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSelect = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError(null);
    setResultBlob(null);
    try {
      const img = await loadImage(f);
      setFile(f);
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read image.');
    }
  };

  const updateWidth = (nextW: number) => {
    const clamped = Math.max(1, Math.min(8000, nextW || 1));
    setWidth(clamped);
    if (lockAspect && naturalSize) {
      setHeight(Math.max(1, Math.round((clamped / naturalSize.w) * naturalSize.h)));
    }
  };

  const updateHeight = (nextH: number) => {
    const clamped = Math.max(1, Math.min(8000, nextH || 1));
    setHeight(clamped);
    if (lockAspect && naturalSize) {
      setWidth(Math.max(1, Math.round((clamped / naturalSize.h) * naturalSize.w)));
    }
  };

  const applyPreset = (w: number, h: number) => {
    setLockAspect(false);
    setWidth(w);
    setHeight(h);
  };

  const handleResize = async () => {
    if (!file) return;
    setError(null);
    const started = performance.now();
    try {
      const img = await loadImage(file);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, format, 0.9);
      setResultBlob(blob);
      const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';
      const outName = `${file.name.replace(/\.[^.]+$/, '')}-${width}x${height}.${ext}`;
      triggerDownload(blob, outName);
      onComplete?.({
        inputSummary: `${naturalSize?.w}×${naturalSize?.h} (${formatBytes(file.size)})`,
        outputSummary: `${width}×${height} (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resize failed.');
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/jpeg,image/png,image/webp"
        label="Drop an image to resize"
        hint="JPG, PNG, or WebP · Exact pixel dimensions or standard web presets"
        onFiles={handleSelect}
      />

      {file && naturalSize && (
        <div className="grid gap-6 border-t border-slate-200 pt-6 lg:grid-cols-2 dark:border-slate-800">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Original: <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{naturalSize.w}×{naturalSize.h}px</strong></span>
              <button
                type="button"
                onClick={() => setLockAspect((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {lockAspect ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                {lockAspect ? 'Aspect ratio locked' : 'Free dimensions'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Width (px)</label>
                <input
                  type="number"
                  min={1}
                  max={8000}
                  value={width}
                  onChange={(e) => updateWidth(parseInt(e.target.value, 10))}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Height (px)</label>
                <input
                  type="number"
                  min={1}
                  max={8000}
                  value={height}
                  onChange={(e) => updateHeight(parseInt(e.target.value, 10))}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Quick presets</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: 'OG 1200×630', w: 1200, h: 630 },
                  { label: 'HD 1920×1080', w: 1920, h: 1080 },
                  { label: 'Square 1080×1080', w: 1080, h: 1080 },
                  { label: 'Icon 512×512', w: 512, h: 512 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.w, p.h)}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Export format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'image/png' | 'image/jpeg' | 'image/webp')}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="image/png">PNG (Lossless)</option>
                <option value="image/webp">WebP (Optimized)</option>
                <option value="image/jpeg">JPEG (Compact)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleResize}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Resize & Download ({width}×{height})
            </button>

            {resultBlob && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Exported <span className="font-mono tabular-nums">{formatBytes(resultBlob.size)}</span> successfully.
              </p>
            )}
          </div>

          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-72 rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

interface FormatConverterProps extends ToolComponentProps {
  mode: 'jpg-to-png' | 'png-to-jpg' | 'webp';
}

const ImageFormatConverterBase: React.FC<FormatConverterProps> = ({ mode, onComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [targetMime, setTargetMime] = useState<'image/png' | 'image/jpeg' | 'image/webp'>(
    mode === 'jpg-to-png' ? 'image/png' : mode === 'png-to-jpg' ? 'image/jpeg' : 'image/webp'
  );
  const [matteColor, setMatteColor] = useState('#FFFFFF');
  const [quality, setQuality] = useState(0.9);
  const [busy, setBusy] = useState(false);
  const [outputs, setOutputs] = useState<ProcessedImageItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      outputs.forEach((o) => URL.revokeObjectURL(o.previewUrl));
    };
  }, [outputs]);

  const accept =
    mode === 'jpg-to-png'
      ? 'image/jpeg'
      : mode === 'png-to-jpg'
        ? 'image/png'
        : 'image/jpeg,image/png,image/webp';

  const handleConvert = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      outputs.forEach((o) => URL.revokeObjectURL(o.previewUrl));
      const list: ProcessedImageItem[] = [];
      let inBytes = 0;
      let outBytes = 0;

      for (const file of files) {
        const img = await loadImage(file);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable.');
        if (targetMime === 'image/jpeg') {
          ctx.fillStyle = matteColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const blob = await canvasToBlob(canvas, targetMime, targetMime === 'image/png' ? undefined : quality);
        const ext = targetMime === 'image/png' ? 'png' : targetMime === 'image/webp' ? 'webp' : 'jpg';
        const outName = `${file.name.replace(/\.[^.]+$/, '')}.${ext}`;
        inBytes += file.size;
        outBytes += blob.size;
        list.push({
          id: `${file.name}-${Math.random()}`,
          originalName: file.name,
          originalSize: file.size,
          outputName: outName,
          outputSize: blob.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
          blob,
          previewUrl: URL.createObjectURL(blob),
        });
      }

      setOutputs(list);
      onComplete?.({
        inputSummary: `${files.length} file(s) (${formatBytes(inBytes)})`,
        outputSummary: `${list.length} converted (${formatBytes(outBytes)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={accept}
        multiple
        label={
          mode === 'jpg-to-png'
            ? 'Drop JPG/JPEG images to convert to PNG'
            : mode === 'png-to-jpg'
              ? 'Drop PNG images to convert to JPG'
              : 'Drop JPG, PNG, or WebP images to convert'
        }
        hint="Batch conversion · 100% client-side Canvas rendering"
        onFiles={(incoming) => {
          setError(null);
          setFiles((prev) => [...prev, ...incoming].slice(0, 15));
        }}
      />

      {files.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-6">
            {mode === 'webp' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Target format
                </label>
                <select
                  value={targetMime}
                  onChange={(e) => setTargetMime(e.target.value as 'image/png' | 'image/jpeg' | 'image/webp')}
                  className="mt-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="image/webp">WebP</option>
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPEG</option>
                </select>
              </div>
            )}

            {targetMime === 'image/jpeg' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Background matte (for transparency)
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={matteColor}
                    onChange={(e) => setMatteColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700"
                  />
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{matteColor}</span>
                </div>
              </div>
            )}

            {targetMime !== 'image/png' && (
              <div className="min-w-[180px] flex-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-400">Quality</span>
                  <span className="font-mono tabular-nums">{Math.round(quality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.02}
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="mt-2 w-full accent-blue-600"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {files.length} file{files.length === 1 ? '' : 's'} ready
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setOutputs([]);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConvert}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                {busy ? 'Converting...' : 'Convert Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {outputs.length > 0 && (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {outputs.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <img
                  src={item.previewUrl}
                  alt={item.outputName}
                  className="h-11 w-11 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.outputName}</p>
                  <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {formatBytes(item.originalSize)} → {formatBytes(item.outputSize)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => triggerDownload(item.blob, item.outputName)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const JpgToPngTool: React.FC<ToolComponentProps> = (props) => (
  <ImageFormatConverterBase mode="jpg-to-png" {...props} />
);

export const PngToJpgTool: React.FC<ToolComponentProps> = (props) => (
  <ImageFormatConverterBase mode="png-to-jpg" {...props} />
);

export const WebpConverterTool: React.FC<ToolComponentProps> = (props) => (
  <ImageFormatConverterBase mode="webp" {...props} />
);
