import React, { useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import { ArrowDown, ArrowUp, Download, RotateCw, Trash2 } from 'lucide-react';
import {
  FileDropzone,
  formatBytes,
  parsePageRange,
  triggerDownload,
  type ToolComponentProps,
} from '../types';

interface QueuedPdf {
  id: string;
  file: File;
  pageCount: number;
}

export const MergePdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [pdfs, setPdfs] = useState<QueuedPdf[]>([]);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleAdd = async (files: File[]) => {
    setError(null);
    setStatusMsg(null);
    const added: QueuedPdf[] = [];
    for (const file of files) {
      try {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        added.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          pageCount: doc.getPageCount(),
        });
      } catch {
        setError(`Could not read "${file.name}". Ensure it is a valid, uncorrupted PDF.`);
      }
    }
    setPdfs((prev) => [...prev, ...added]);
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    setPdfs((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleMerge = async () => {
    if (pdfs.length < 2) {
      setError('Add at least 2 PDF documents to merge.');
      return;
    }
    setMerging(true);
    setError(null);
    const started = performance.now();

    try {
      const merged = await PDFDocument.create();
      let totalPages = 0;

      for (const item of pdfs) {
        const bytes = await item.file.arrayBuffer();
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((p) => merged.addPage(p));
        totalPages += copied.length;
      }

      const outBytes = await merged.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `toolivo-merged-${Date.now()}.pdf`);
      setStatusMsg(`Merged ${pdfs.length} PDFs (${totalPages} pages · ${formatBytes(blob.size)})`);

      onComplete?.({
        inputSummary: `${pdfs.length} PDF files (${totalPages} pages)`,
        outputSummary: `Merged PDF (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF merge failed.');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        multiple
        label="Drop 2 or more PDF files to combine"
        hint="Powered by pdf-lib · Documents stay strictly inside browser memory"
        onFiles={handleAdd}
      />

      {pdfs.length > 0 && (
        <div className="space-y-4">
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {pdfs.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {idx + 1}. {item.file.name}
                  </p>
                  <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {item.pageCount} page{item.pageCount === 1 ? '' : 's'} · {formatBytes(item.file.size)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, -1)}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={idx === pdfs.length - 1}
                    onClick={() => moveItem(idx, 1)}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={() => setPdfs((prev) => prev.filter((p) => p.id !== item.id))}
                    className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
              Total: {pdfs.reduce((sum, p) => sum + p.pageCount, 0)} pages across {pdfs.length} files
            </span>
            <button
              type="button"
              disabled={merging || pdfs.length < 2}
              onClick={handleMerge}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {merging ? 'Merging PDFs...' : 'Merge & Download PDF'}
            </button>
          </div>
        </div>
      )}

      {statusMsg && (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{statusMsg}</p>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

export const SplitPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [splitMode, setSplitMode] = useState<'range' | 'burst-zip'>('range');
  const [rangeText, setRangeText] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError(null);
    setSuccess(null);
    try {
      const bytes = await f.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const count = doc.getPageCount();
      setFile(f);
      setTotalPages(count);
      setRangeText(count > 1 ? `1-${Math.min(2, count)}` : '1');
    } catch {
      setError('Could not open this PDF file.');
    }
  };

  const handleSplit = async () => {
    if (!file || totalPages === 0) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const started = performance.now();

    try {
      const srcBytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const baseName = file.name.replace(/\.pdf$/i, '');

      if (splitMode === 'burst-zip') {
        const zip = new JSZip();
        for (let i = 0; i < totalPages; i += 1) {
          const single = await PDFDocument.create();
          const [page] = await single.copyPages(srcDoc, [i]);
          single.addPage(page);
          const bytes = await single.save();
          zip.file(`${baseName}-page-${String(i + 1).padStart(3, '0')}.pdf`, bytes);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerDownload(zipBlob, `${baseName}-all-pages.zip`);
        setSuccess(`Split all ${totalPages} pages into individual PDFs (${formatBytes(zipBlob.size)} ZIP).`);
        onComplete?.({
          inputSummary: `${file.name} (${totalPages} pages)`,
          outputSummary: `${totalPages} PDFs in ZIP (${formatBytes(zipBlob.size)})`,
          processingMs: performance.now() - started,
        });
      } else {
        const indices = parsePageRange(rangeText, totalPages);
        if (indices.length === 0) throw new Error('Enter at least one valid page number.');
        const outDoc = await PDFDocument.create();
        const pages = await outDoc.copyPages(srcDoc, indices);
        pages.forEach((p) => outDoc.addPage(p));
        const outBytes = await outDoc.save();
        const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        triggerDownload(blob, `${baseName}-pages.pdf`);
        setSuccess(`Extracted ${indices.length} page${indices.length === 1 ? '' : 's'} (${formatBytes(blob.size)}).`);
        onComplete?.({
          inputSummary: `${file.name} (${totalPages} pages)`,
          outputSummary: `Extracted ${indices.length} page(s) (${formatBytes(blob.size)})`,
          processingMs: performance.now() - started,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF split failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF file to split or extract pages"
        hint="Extract custom ranges (e.g. 1-3, 5) or burst every page into a ZIP archive locally"
        onFiles={handleLoad}
      />

      {file && totalPages > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-slate-100">{file.name}</span>
            <span className="font-mono tabular-nums">
              {totalPages} pages · {formatBytes(file.size)}
            </span>
          </div>

          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setSplitMode('range')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                splitMode === 'range'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Extract Page Range
            </button>
            <button
              type="button"
              onClick={() => setSplitMode('burst-zip')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                splitMode === 'burst-zip'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Split All Pages to ZIP
            </button>
          </div>

          {splitMode === 'range' ? (
            <div>
              <label htmlFor="pdf-range" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Pages to extract (1–{totalPages})
              </label>
              <input
                id="pdf-range"
                type="text"
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder="e.g. 1-3, 5, 7-9"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Creates {totalPages} individual 1-page PDF files packaged inside a single downloadable ZIP archive.
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleSplit}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {busy
              ? 'Processing...'
              : splitMode === 'burst-zip'
                ? `Split ${totalPages} Pages & Download ZIP`
                : 'Extract & Download PDF'}
          </button>
        </div>
      )}

      {success && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{success}</p>}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

export const RotatePdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<{
    pages: number;
    title: string;
    author: string;
    creator: string;
    producer: string;
  } | null>(null);
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [range, setRange] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError(null);
    setDoneMsg(null);
    try {
      const bytes = await f.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setFile(f);
      setMeta({
        pages: doc.getPageCount(),
        title: doc.getTitle() || '—',
        author: doc.getAuthor() || '—',
        creator: doc.getCreator() || '—',
        producer: doc.getProducer() || '—',
      });
      setRange(`1-${doc.getPageCount()}`);
    } catch {
      setError('Could not inspect this PDF file.');
    }
  };

  const handleRotate = async () => {
    if (!file || !meta) return;
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const indices = parsePageRange(range || `1-${meta.pages}`, meta.pages);
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPages();
      for (const idx of indices) {
        const page = pages[idx];
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + angle) % 360));
      }
      const out = await doc.save();
      const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${file.name.replace(/\.pdf$/i, '')}-rotated.pdf`);
      setDoneMsg(`Rotated ${indices.length} page(s) by ${angle}° clockwise.`);
      onComplete?.({
        inputSummary: `${file.name} (${meta.pages} pages)`,
        outputSummary: `Rotated ${indices.length} page(s) by ${angle}°`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to rotate pages and inspect metadata"
        hint="Lossless page rotation matrix update via pdf-lib"
        onFiles={handleLoad}
      />

      {file && meta && (
        <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="grid gap-3 rounded-xl border border-slate-200 p-4 text-xs sm:grid-cols-2 dark:border-slate-800">
            <div><span className="text-slate-500">Pages:</span> <strong className="font-mono tabular-nums">{meta.pages}</strong></div>
            <div><span className="text-slate-500">Size:</span> <strong className="font-mono tabular-nums">{formatBytes(file.size)}</strong></div>
            <div className="truncate"><span className="text-slate-500">Title:</span> <strong>{meta.title}</strong></div>
            <div className="truncate"><span className="text-slate-500">Author:</span> <strong>{meta.author}</strong></div>
            <div className="truncate"><span className="text-slate-500">Creator:</span> <strong>{meta.creator}</strong></div>
            <div className="truncate"><span className="text-slate-500">Producer:</span> <strong>{meta.producer}</strong></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Rotation angle</label>
              <div className="mt-1.5 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {([90, 180, 270] as const).map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setAngle(deg)}
                    className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium ${
                      angle === deg
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Page range</label>
              <input
                type="text"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleRotate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RotateCw className="h-4 w-4" />
            {busy ? 'Applying Rotation...' : `Rotate & Download (${angle}°)`}
          </button>
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
