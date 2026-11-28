import React, { useState } from 'react';
import { PDFDocument, PageSizes, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { ArrowDown, ArrowUp, Check, Copy, Download, Trash2 } from 'lucide-react';
import {
  FileDropzone,
  formatBytes,
  triggerDownload,
  type ToolComponentProps,
} from '../types';
import {
  extractStructuredPdfText,
  loadPdfJsDocument,
  renderPdfPageToCanvas,
  sanitizeWinAnsi,
  wrapTextLines,
} from '../pdfHelper';

/* 1. Compress PDF (Lossless Stream Optimization + Strong DPI Raster Optimization) */
export const CompressPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'lossless' | 'strong'>('strong');
  const [scale, setScale] = useState(1.2);
  const [jpegQuality, setJpegQuality] = useState(0.65);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string; savedPct: number } | null>(null);

  const handleCompress = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(5);
    const started = performance.now();

    try {
      let outBytes: Uint8Array;
      if (mode === 'lossless') {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        setProgress(60);
        outBytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      } else {
        const pdfJsDoc = await loadPdfJsDocument(file);
        const outDoc = await PDFDocument.create();
        for (let p = 1; p <= pdfJsDoc.numPages; p += 1) {
          const { canvas } = await renderPdfPageToCanvas(pdfJsDoc, p, scale);
          const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
          const jpgBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
          const img = await outDoc.embedJpg(jpgBytes);
          const origPage = await pdfJsDoc.getPage(p);
          const origVp = origPage.getViewport({ scale: 1 });
          const page = outDoc.addPage([origVp.width, origVp.height]);
          page.drawImage(img, { x: 0, y: 0, width: origVp.width, height: origVp.height });
          setProgress(Math.round((p / pdfJsDoc.numPages) * 95));
        }
        outBytes = await outDoc.save({ useObjectStreams: true });
      }

      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const savedPct = file.size > 0 ? Math.round(((file.size - blob.size) / file.size) * 100) : 0;
      const filename = `${file.name.replace(/\.pdf$/i, '')}-compressed.pdf`;
      setProgress(100);
      setResult({ blob, filename, savedPct });

      onComplete?.({
        inputSummary: `${file.name} (${formatBytes(file.size)})`,
        outputSummary: `${formatBytes(blob.size)} (${savedPct >= 0 ? `-${savedPct}%` : `+${Math.abs(savedPct)}%`})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF compression failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF file to compress locally"
        hint="Supports Lossless stream compaction or Strong DPI raster compression · Zero uploads"
        onFiles={(files) => {
          setFile(files[0] ?? null);
          setResult(null);
          setError(null);
          setProgress(0);
        }}
      />

      {file && (
        <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-900 dark:text-slate-100">{file.name}</span>
            <span className="font-mono tabular-nums text-slate-500">{formatBytes(file.size)}</span>
          </div>

          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMode('strong')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                mode === 'strong'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Strong Compression (Best Size)
            </button>
            <button
              type="button"
              onClick={() => setMode('lossless')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                mode === 'lossless'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Lossless (Keeps Selectable Text)
            </button>
          </div>

          {mode === 'strong' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Page render sharpness
                </label>
                <select
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value={1.0}>Compact (72 DPI — smallest email size)</option>
                  <option value={1.2}>Balanced (90 DPI — recommended)</option>
                  <option value={1.6}>High Clarity (120 DPI — crisp print)</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-400">JPEG Quality</span>
                  <span className="font-mono tabular-nums">{Math.round(jpegQuality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.35}
                  max={0.9}
                  step={0.05}
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(parseFloat(e.target.value))}
                  className="mt-3 w-full accent-blue-600"
                />
              </div>
            </div>
          )}

          {busy && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Optimizing PDF locally...</span>
                <span className="font-mono tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleCompress}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Compressing PDF...' : 'Compress PDF'}
          </button>
        </div>
      )}

      {result && file && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{result.filename}</p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
              {formatBytes(file.size)} →{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {formatBytes(result.blob.size)}
              </strong>{' '}
              ({result.savedPct >= 0 ? `−${result.savedPct}% smaller` : 'Already tightly compressed'})
            </p>
          </div>
          <button
            type="button"
            onClick={() => triggerDownload(result.blob, result.filename)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Download className="h-3.5 w-3.5" />
            Download Compressed PDF
          </button>
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

/* 2. PDF to JPG / PNG with ZIP bundle */
export const PdfToJpgTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<{ pageNum: number; url: string; blob: Blob; name: string }[]>([]);

  const handleConvert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    setPages([]);
    const started = performance.now();

    try {
      const pdfDoc = await loadPdfJsDocument(file);
      const ext = format === 'image/png' ? 'png' : 'jpg';
      const base = file.name.replace(/\.pdf$/i, '');
      const rendered: { pageNum: number; url: string; blob: Blob; name: string }[] = [];

      for (let i = 1; i <= pdfDoc.numPages; i += 1) {
        const { canvas } = await renderPdfPageToCanvas(pdfDoc, i, scale);
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encode failed'))), format, 0.92);
        });
        rendered.push({
          pageNum: i,
          url: URL.createObjectURL(blob),
          blob,
          name: `${base}-page-${String(i).padStart(2, '0')}.${ext}`,
        });
      }
      setPages(rendered);
      onComplete?.({
        inputSummary: `${file.name} (${pdfDoc.numPages} pages)`,
        outputSummary: `${rendered.length} ${ext.toUpperCase()} images`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF to image conversion failed.');
    } finally {
      setBusy(false);
    }
  };

  const downloadAllZip = async () => {
    if (!file || pages.length === 0) return;
    const zip = new JSZip();
    for (const p of pages) {
      zip.file(p.name, p.blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipBlob, `${file.name.replace(/\.pdf$/i, '')}-images.zip`);
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to convert pages to JPG or PNG"
        hint="High-DPI rendering via Mozilla PDF.js + one-click ZIP download"
        onFiles={(files) => {
          setFile(files[0] ?? null);
          setPages([]);
          setError(null);
        }}
      />

      {file && (
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'image/jpeg' | 'image/png')}
                className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="image/jpeg">JPG (Compact)</option>
                <option value="image/png">PNG (Lossless)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Resolution</label>
              <select
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value={1}>1x Standard</option>
                <option value={2}>2x Retina (Recommended)</option>
                <option value={3}>3x High-DPI Print</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleConvert}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Rendering Pages...' : 'Convert PDF to Images'}
          </button>
        </div>
      )}

      {pages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
              {pages.length} page{pages.length === 1 ? '' : 's'} rendered
            </span>
            <button
              type="button"
              onClick={downloadAllZip}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-3.5 w-3.5" />
              Download All (.zip)
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {pages.map((p) => (
              <div key={p.pageNum} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
                <img src={p.url} alt={p.name} className="aspect-[3/4] w-full rounded-lg bg-white object-contain" />
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="font-mono text-[11px] text-slate-500">Page {p.pageNum}</span>
                  <button
                    type="button"
                    onClick={() => triggerDownload(p.blob, p.name)}
                    className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
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

/* 3. JPG / PNG / WebP to PDF */
export const JpgToPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [images, setImages] = useState<{ id: string; file: File; preview: string }[]>([]);
  const [pageSize, setPageSize] = useState<'fit' | 'a4' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const addImages = (files: File[]) => {
    setError(null);
    const valid = files.filter((f) => f.type.startsWith('image/'));
    setImages((prev) => [
      ...prev,
      ...valid.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  const move = (idx: number, delta: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev];
      const t = idx + delta;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  };

  const toPngOrJpgBytes = async (file: File): Promise<{ bytes: ArrayBuffer; kind: 'jpg' | 'png' }> => {
    if (file.type === 'image/jpeg') return { bytes: await file.arrayBuffer(), kind: 'jpg' };
    if (file.type === 'image/png') return { bytes: await file.arrayBuffer(), kind: 'png' };
    // Convert WebP or other formats to PNG via Canvas
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error(`Unable to decode ${file.name}`));
        el.src = url;
      });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((res, rej) =>
        c.toBlob((b) => (b ? res(b) : rej(new Error('Encode failed'))), 'image/png')
      );
      return { bytes: await blob.arrayBuffer(), kind: 'png' };
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleBuildPdf = async () => {
    if (images.length === 0) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    const started = performance.now();

    try {
      const doc = await PDFDocument.create();
      for (const item of images) {
        const { bytes, kind } = await toPngOrJpgBytes(item.file);
        const embedded = kind === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
        const dims = embedded.scale(1);

        if (pageSize === 'fit') {
          const page = doc.addPage([dims.width + margin * 2, dims.height + margin * 2]);
          page.drawImage(embedded, { x: margin, y: margin, width: dims.width, height: dims.height });
        } else {
          const base = pageSize === 'a4' ? PageSizes.A4 : PageSizes.Letter;
          const [pw, ph] = orientation === 'portrait' ? base : [base[1], base[0]];
          const page = doc.addPage([pw, ph]);
          const availW = Math.max(20, pw - margin * 2);
          const availH = Math.max(20, ph - margin * 2);
          const ratio = Math.min(availW / dims.width, availH / dims.height);
          const drawW = dims.width * ratio;
          const drawH = dims.height * ratio;
          page.drawImage(embedded, {
            x: (pw - drawW) / 2,
            y: (ph - drawH) / 2,
            width: drawW,
            height: drawH,
          });
        }
      }

      const out = await doc.save();
      const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `toolivo-images-${Date.now()}.pdf`);
      setStatus(`Created ${images.length}-page PDF (${formatBytes(blob.size)}).`);
      onComplete?.({
        inputSummary: `${images.length} images`,
        outputSummary: `PDF (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/jpeg,image/png,image/webp"
        multiple
        label="Drop JPG, PNG, or WebP images to convert to PDF"
        hint="Reorder photos, pick A4 / US Letter / Fit Image, and export locally"
        onFiles={addImages}
      />

      {images.length > 0 && (
        <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as 'fit' | 'a4' | 'letter')}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="letter">US Letter (8.5 × 11 in)</option>
                <option value="fit">Auto / Fit to Image</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Orientation</label>
              <select
                disabled={pageSize === 'fit'}
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Margin</label>
              <select
                value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value, 10))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value={0}>No margin (0 pt)</option>
                <option value={24}>Small (24 pt)</option>
                <option value={48}>Standard (48 pt)</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {images.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={item.preview} alt={item.file.name} className="h-10 w-10 rounded object-cover" />
                  <span className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                    {idx + 1}. {item.file.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => move(idx, 1)} disabled={idx === images.length - 1} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setImages((p) => p.filter((x) => x.id !== item.id))} className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleBuildPdf}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {busy ? 'Creating PDF...' : `Create PDF (${images.length} Page${images.length === 1 ? '' : 's'})`}
          </button>
        </div>
      )}

      {status && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{status}</p>}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

/* 4. PDF to Word (.doc) */
export const PdfToWordTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pagesText, setPagesText] = useState<{ pageNumber: number; lines: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const pdf = await loadPdfJsDocument(f);
      const extracted = await extractStructuredPdfText(pdf);
      setPagesText(extracted);
      const totalLines = extracted.reduce((s, p) => s + p.lines.length, 0);
      if (totalLines === 0) {
        setError('No embedded digital text found—this PDF appears to be a scanned image.');
      }
      onComplete?.({
        inputSummary: `${f.name} (${pdf.numPages} pages)`,
        outputSummary: `Extracted ${totalLines} lines`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse PDF text.');
    } finally {
      setBusy(false);
    }
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const downloadWordDoc = () => {
    if (!file || pagesText.length === 0) return;
    const sections = pagesText
      .map(
        (p, idx) =>
          `${idx > 0 ? '<br clear="all" style="page-break-before:always" />' : ''}` +
          p.lines.map((line) => `<p style="margin:0 0 8pt 0;font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.45;">${escapeHtml(line)}</p>`).join('\n')
      )
      .join('\n');

    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(file.name)}</title></head><body>${sections}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    triggerDownload(blob, `${file.name.replace(/\.pdf$/i, '')}.doc`);
  };

  const plainText = pagesText.map((p) => `--- Page ${p.pageNumber} ---\n${p.lines.join('\n')}`).join('\n\n');

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to convert to an editable Word (.doc) document"
        hint="Extracts paragraphs and page breaks locally via PDF.js"
        onFiles={handleLoad}
      />

      {busy && <p className="text-xs text-slate-500">Extracting structured document text locally...</p>}

      {pagesText.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs text-slate-500">
              {pagesText.length} page{pagesText.length === 1 ? '' : 's'} extracted
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(plainText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>
              <button
                type="button"
                onClick={downloadWordDoc}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Download className="h-3.5 w-3.5" />
                Download Word (.doc)
              </button>
            </div>
          </div>

          <textarea
            readOnly
            rows={12}
            value={plainText}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
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

/* 5. Word (.docx) to PDF */
export const WordToPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setDoneMsg(null);
    try {
      const arrayBuffer = await f.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      setRawText(result.value);
    } catch {
      setError('Could not read this .docx file. Make sure it is a standard Microsoft Word .docx document.');
    }
  };

  const handleConvert = async () => {
    if (!file || !rawText.trim()) return;
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const [pw, ph] = pageSize === 'a4' ? PageSizes.A4 : PageSizes.Letter;
      const margin = 52;
      const maxWidth = pw - margin * 2;
      const fontSize = 11;
      const lineHeight = 16;

      let page = doc.addPage([pw, ph]);
      let y = ph - margin;

      const title = sanitizeWinAnsi(file.name.replace(/\.docx$/i, ''));
      page.drawText(title, { x: margin, y, size: 16, font: bold, color: rgb(0.08, 0.1, 0.16) });
      y -= 28;

      const lines = wrapTextLines(rawText, font, fontSize, maxWidth);
      for (const line of lines) {
        if (y < margin + lineHeight) {
          page = doc.addPage([pw, ph]);
          y = ph - margin;
        }
        if (line) {
          page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.15, 0.18, 0.24) });
        }
        y -= lineHeight;
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${file.name.replace(/\.docx$/i, '')}.pdf`);
      setDoneMsg(`Converted to ${doc.getPageCount()}-page PDF (${formatBytes(blob.size)}).`);
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `${doc.getPageCount()} pages (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Word to PDF conversion failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        label="Drop a Microsoft Word (.docx) document"
        hint="Parsed locally via Mammoth and typeset to PDF via pdf-lib"
        onFiles={handleLoad}
      />

      {file && rawText && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as 'a4' | 'letter')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="a4">A4 Page Size</option>
              <option value="letter">US Letter Size</option>
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={handleConvert}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {busy ? 'Generating PDF...' : 'Convert & Download PDF'}
            </button>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-xs leading-relaxed text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      )}

      {doneMsg && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{doneMsg}</p>}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

/* 6. PDF to Excel (.xlsx / .csv) */
export const PdfToExcelTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<{ pageNumber: number; rows: string[][] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const pdf = await loadPdfJsDocument(f);
      const extracted = await extractStructuredPdfText(pdf);
      setPages(extracted);
      onComplete?.({
        inputSummary: `${f.name} (${pdf.numPages} pages)`,
        outputSummary: `${extracted.reduce((s, p) => s + p.rows.length, 0)} rows parsed`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse PDF tables.');
    } finally {
      setBusy(false);
    }
  };

  const exportWorkbook = (format: 'xlsx' | 'csv') => {
    if (!file || pages.length === 0) return;
    const wb = XLSX.utils.book_new();
    if (format === 'csv') {
      const allRows = pages.flatMap((p) => p.rows);
      const ws = XLSX.utils.aoa_to_sheet(allRows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${file.name.replace(/\.pdf$/i, '')}.csv`);
      return;
    }
    pages.forEach((p) => {
      const ws = XLSX.utils.aoa_to_sheet(p.rows.length > 0 ? p.rows : [['(No text detected on page)']]);
      XLSX.utils.book_append_sheet(wb, ws, `Page ${p.pageNumber}`);
    });
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerDownload(
      new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${file.name.replace(/\.pdf$/i, '')}.xlsx`
    );
  };

  const previewRows = pages[0]?.rows.slice(0, 12) ?? [];

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to extract tables to Excel (.xlsx) or CSV"
        hint="Groups rows & columns by X/Y text coordinates via PDF.js + SheetJS"
        onFiles={handleLoad}
      />

      {busy && <p className="text-xs text-slate-500">Analyzing PDF coordinate grid locally...</p>}

      {pages.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {pages.length} page sheet(s) · {pages.reduce((s, p) => s + p.rows.length, 0)} rows
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportWorkbook('csv')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                Export .csv
              </button>
              <button
                type="button"
                onClick={() => exportWorkbook('xlsx')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Download className="h-3.5 w-3.5" />
                Download Excel (.xlsx)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {previewRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.slice(0, 8).map((cell, cIdx) => (
                      <td key={cIdx} className="max-w-[200px] truncate px-3 py-2 text-slate-700 dark:text-slate-300">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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

/* 7. Excel / CSV to PDF */
export const ExcelToPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Record<string, string[][]>>({});
  const [activeSheet, setActiveSheet] = useState('');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const parsed: Record<string, string[][]> = {};
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
        parsed[name] = rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []));
      }
      setSheets(parsed);
      setActiveSheet(wb.SheetNames[0] || '');
    } catch {
      setError('Could not read spreadsheet. Upload a valid .xlsx, .xls, or .csv file.');
    }
  };

  const handleExportPdf = async () => {
    if (!file || !activeSheet) return;
    const rows = sheets[activeSheet] || [];
    if (rows.length === 0) return;
    setBusy(true);
    setError(null);
    const started = performance.now();

    try {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const [pw, ph] = orientation === 'landscape' ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
      const margin = 36;
      const maxCols = Math.min(12, Math.max(1, ...rows.map((r) => r.length)));
      const colW = (pw - margin * 2) / maxCols;
      const rowH = 18;

      let page = doc.addPage([pw, ph]);
      let y = ph - margin;
      page.drawText(sanitizeWinAnsi(`${file.name} — ${activeSheet}`), {
        x: margin,
        y,
        size: 12,
        font: bold,
        color: rgb(0.08, 0.1, 0.16),
      });
      y -= 24;

      for (let rIdx = 0; rIdx < rows.length; rIdx += 1) {
        if (y < margin + rowH) {
          page = doc.addPage([pw, ph]);
          y = ph - margin;
        }
        const row = rows[rIdx];
        if (rIdx === 0) {
          page.drawRectangle({ x: margin, y: y - 4, width: pw - margin * 2, height: rowH, color: rgb(0.92, 0.94, 0.98) });
        } else if (rIdx % 2 === 0) {
          page.drawRectangle({ x: margin, y: y - 4, width: pw - margin * 2, height: rowH, color: rgb(0.97, 0.98, 0.99) });
        }
        for (let cIdx = 0; cIdx < maxCols; cIdx += 1) {
          const val = sanitizeWinAnsi(row[cIdx] ?? '').slice(0, Math.max(8, Math.floor(colW / 5.2)));
          page.drawText(val, {
            x: margin + cIdx * colW + 4,
            y: y + 1,
            size: 8.5,
            font: rIdx === 0 ? bold : font,
            color: rgb(0.14, 0.17, 0.22),
          });
        }
        y -= rowH;
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${file.name.replace(/\.[^.]+$/, '')}-${activeSheet}.pdf`);
      onComplete?.({
        inputSummary: `${file.name} (${rows.length} rows)`,
        outputSummary: `${doc.getPageCount()}-page PDF (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const sheetNames = Object.keys(sheets);
  const currentRows = sheets[activeSheet] || [];

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        label="Drop an Excel (.xlsx, .xls) or CSV file"
        hint="Preview worksheet tables and export clean paginated PDFs locally"
        onFiles={handleLoad}
      />

      {sheetNames.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={activeSheet}
                onChange={(e) => setActiveSheet(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {sheetNames.map((n) => (
                  <option key={n} value={n}>Sheet: {n}</option>
                ))}
              </select>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'landscape' | 'portrait')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="landscape">Landscape (Best for wide tables)</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {busy ? 'Rendering PDF...' : 'Export Table PDF'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {currentRows.slice(0, 10).map((row, r) => (
                  <tr key={r} className={r === 0 ? 'bg-slate-100/70 font-semibold dark:bg-slate-800/60' : ''}>
                    {row.slice(0, 8).map((c, ci) => (
                      <td key={ci} className="max-w-[180px] truncate px-3 py-2">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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

/* 8. PDF to Slides / PowerPoint Pack */
export const PdfToPptTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [slides, setSlides] = useState<{ pageNum: number; dataUrl: string; blob: Blob; notes: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const pdf = await loadPdfJsDocument(f);
      const extracted = await extractStructuredPdfText(pdf);
      const list: { pageNum: number; dataUrl: string; blob: Blob; notes: string }[] = [];
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const { canvas } = await renderPdfPageToCanvas(pdf, i, 1.8);
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await fetch(dataUrl).then((r) => r.blob());
        list.push({
          pageNum: i,
          dataUrl,
          blob,
          notes: extracted[i - 1]?.lines.join(' ') || '',
        });
      }
      setSlides(list);
      onComplete?.({
        inputSummary: `${f.name} (${pdf.numPages} slides)`,
        outputSummary: `${list.length} widescreen slides ready`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate slides.');
    } finally {
      setBusy(false);
    }
  };

  const downloadHtmlDeck = () => {
    if (!file || slides.length === 0) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${file.name} — Slides</title><style>body{margin:0;background:#070a12;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}img{max-width:92vw;max-height:82vh;border-radius:10px;box-shadow:0 20px 50px rgba(0,0,0,.5)}.bar{margin-top:14px;display:flex;gap:12px;align-items:center;font-size:13px}button{background:#2563eb;color:#fff;border:0;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:600}</style></head><body><img id="s"/><div class="bar"><button onclick="go(-1)">Prev</button><span id="c"></span><button onclick="go(1)">Next</button></div><script>const slides=${JSON.stringify(slides.map((s) => s.dataUrl))};let i=0;const render=()=>{document.getElementById('s').src=slides[i];document.getElementById('c').textContent=(i+1)+' / '+slides.length};const go=d=>{i=Math.max(0,Math.min(slides.length-1,i+d));render()};window.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1)});render();</script></body></html>`;
    triggerDownload(new Blob([html], { type: 'text/html' }), `${file.name.replace(/\.pdf$/i, '')}-slides.html`);
  };

  const downloadPngZip = async () => {
    if (!file || slides.length === 0) return;
    const zip = new JSZip();
    slides.forEach((s) => zip.file(`slide-${String(s.pageNum).padStart(2, '0')}.png`, s.blob));
    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(blob, `${file.name.replace(/\.pdf$/i, '')}-slides-pack.zip`);
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to convert into a presentation deck"
        hint="Exports an interactive HTML Slide Deck or high-res PNG Slide Pack (.zip) for PowerPoint & Google Slides"
        onFiles={handleLoad}
      />

      {busy && <p className="text-xs text-slate-500">Rendering slide deck locally...</p>}

      {slides.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs text-slate-500">{slides.length} slides ready</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadHtmlDeck}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                Download HTML Slide Deck
              </button>
              <button
                type="button"
                onClick={downloadPngZip}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Download className="h-3.5 w-3.5" />
                Download PNG Slide Pack (.zip)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {slides.map((s) => (
              <div key={s.pageNum} className="rounded-xl border border-slate-200 p-2 dark:border-slate-800">
                <img src={s.dataUrl} alt={`Slide ${s.pageNum}`} className="aspect-video w-full rounded bg-white object-contain" />
                <p className="mt-1.5 font-mono text-[11px] text-slate-500">Slide {s.pageNum}</p>
              </div>
            ))}
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

/* 9. HTML & Markdown to PDF */
export const HtmlToPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [title, setTitle] = useState('Toolivo Document Export');
  const [source, setSource] = useState(
    '<h1>Quarterly Architecture Brief</h1>\n<p>This document was converted directly inside the browser using Toolivo HTML & Markdown to PDF with zero server uploads.</p>\n<h2>Key Highlights</h2>\n<ul><li>Zero-upload browser-native processing</li><li>Clean A4 and US Letter pagination</li><li>Instant offline PDF export</li></ul>'
  );
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4');
  const [busy, setBusy] = useState(false);

  const handleUploadFile = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setTitle(f.name.replace(/\.[^.]+$/, ''));
    setSource(await f.text());
  };

  const handleExport = async () => {
    if (!source.trim()) return;
    setBusy(true);
    const started = performance.now();
    try {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(source, 'text/html');
      const blocks: { text: string; heading: boolean }[] = [];
      const walk = (el: Element) => {
        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'noscript'].includes(tag)) return;
        if (['h1', 'h2', 'h3', 'h4'].includes(tag)) {
          const t = el.textContent?.trim();
          if (t) blocks.push({ text: t, heading: true });
          return;
        }
        if (['p', 'li', 'blockquote', 'pre'].includes(tag)) {
          const t = el.textContent?.trim();
          if (t) blocks.push({ text: tag === 'li' ? `• ${t}` : t, heading: false });
          return;
        }
        Array.from(el.children).forEach(walk);
      };
      walk(parsed.body);
      if (blocks.length === 0) {
        source.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          if (trimmed.startsWith('#')) {
            blocks.push({ text: trimmed.replace(/^#+\s*/, ''), heading: true });
          } else {
            blocks.push({ text: trimmed, heading: false });
          }
        });
      }

      const doc = await PDFDocument.create();
      const regular = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const [pw, ph] = pageSize === 'a4' ? PageSizes.A4 : PageSizes.Letter;
      const margin = 52;
      const maxW = pw - margin * 2;
      let page = doc.addPage([pw, ph]);
      let y = ph - margin;

      if (title.trim()) {
        page.drawText(sanitizeWinAnsi(title), { x: margin, y, size: 17, font: bold, color: rgb(0.06, 0.09, 0.16) });
        y -= 28;
      }

      for (const block of blocks) {
        const size = block.heading ? 13 : 10.5;
        const font = block.heading ? bold : regular;
        const lineH = block.heading ? 20 : 15;
        if (block.heading) y -= 6;
        const wrapped = wrapTextLines(block.text, font, size, maxW);
        for (const line of wrapped) {
          if (y < margin + lineH) {
            page = doc.addPage([pw, ph]);
            y = ph - margin;
          }
          page.drawText(line, { x: margin, y, size, font, color: rgb(0.14, 0.17, 0.22) });
          y -= lineH;
        }
        y -= 6;
      }

      const out = await doc.save();
      const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${(title || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
      onComplete?.({
        inputSummary: `${source.length} chars`,
        outputSummary: `${doc.getPageCount()}-page PDF (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <FileDropzone
        accept=".html,.htm,.md,.txt,text/html,text/markdown,text/plain"
        label="Optionally drop an .html, .md, or .txt file (or edit below)"
        hint="Safely parsed via DOMParser without executing untrusted scripts"
        onFiles={handleUploadFile}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Document title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Page size</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as 'a4' | 'letter')}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="a4">A4</option>
            <option value="letter">US Letter</option>
          </select>
        </div>
      </div>

      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={10}
        spellCheck={false}
        className="w-full rounded-xl border border-slate-200 bg-white p-3.5 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />

      <button
        type="button"
        disabled={busy || !source.trim()}
        onClick={handleExport}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {busy ? 'Generating PDF...' : 'Convert & Download PDF'}
      </button>
    </div>
  );
};
