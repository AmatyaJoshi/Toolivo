import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import {
  ArrowLeft,
  ArrowRight,
  CopyPlus,
  Download,
  Eraser,
  RotateCw,
  Search,
  Trash2,
} from 'lucide-react';
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
} from '../pdfHelper';

/* 1. Visual Organize & Delete PDF Pages */
interface VisualPageItem {
  id: string;
  origIndex: number; // 0-based
  extraRotate: number;
  thumbUrl: string;
}

export const OrganizePdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<VisualPageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    setError(null);
    setItems([]);
    try {
      const pdf = await loadPdfJsDocument(f);
      const thumbs: VisualPageItem[] = [];
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const { canvas } = await renderPdfPageToCanvas(pdf, i, 0.55);
        thumbs.push({
          id: `p-${i}-${Math.random()}`,
          origIndex: i - 1,
          extraRotate: 0,
          thumbUrl: canvas.toDataURL('image/jpeg', 0.8),
        });
      }
      setItems(thumbs);
    } catch {
      setError('Unable to load PDF pages for visual organization.');
    } finally {
      setLoading(false);
    }
  };

  const move = (idx: number, delta: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const t = idx + delta;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  };

  const rotateItem = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, extraRotate: (it.extraRotate + 90) % 360 } : it))
    );
  };

  const duplicateItem = (idx: number) => {
    setItems((prev) => {
      const copy = { ...prev[idx], id: `dup-${Date.now()}-${Math.random()}` };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const handleExport = async () => {
    if (!file || items.length === 0) return;
    setBusy(true);
    const started = performance.now();
    try {
      const srcBytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const outDoc = await PDFDocument.create();

      for (const item of items) {
        const [copied] = await outDoc.copyPages(srcDoc, [item.origIndex]);
        if (item.extraRotate !== 0) {
          const curr = copied.getRotation().angle;
          copied.setRotation(degrees((curr + item.extraRotate) % 360));
        }
        outDoc.addPage(copied);
      }

      const bytes = await outDoc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${file.name.replace(/\.pdf$/i, '')}-organized.pdf`);
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `${items.length} organized pages (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to visually reorder, rotate, duplicate, or delete pages"
        hint="Live thumbnails rendered locally via PDF.js · Vector pages exported via pdf-lib"
        onFiles={handleLoad}
      />

      {loading && <p className="text-xs text-slate-500">Rendering page thumbnails locally...</p>}

      {items.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs text-slate-500">
              {items.length} page{items.length === 1 ? '' : 's'} remaining
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {busy ? 'Saving PDF...' : 'Export Organized PDF'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-white p-1">
                  <img
                    src={item.thumbUrl}
                    alt={`Page ${idx + 1}`}
                    style={{ transform: `rotate(${item.extraRotate}deg)` }}
                    className="max-h-full max-w-full object-contain transition-transform"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>#{idx + 1}</span>
                  <span>Orig {item.origIndex + 1}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-800">
                  <button type="button" title="Move left" disabled={idx === 0} onClick={() => move(idx, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800">
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Move right" disabled={idx === items.length - 1} onClick={() => move(idx, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Rotate 90°" onClick={() => rotateItem(item.id)} className="rounded p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Duplicate page" onClick={() => duplicateItem(idx)} className="rounded p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
                    <CopyPlus className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Delete page" onClick={() => setItems((p) => p.filter((x) => x.id !== item.id))} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
                    <Trash2 className="h-3.5 w-3.5" />
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

/* 2. Watermark PDF */
export const WatermarkPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(52);
  const [opacity, setOpacity] = useState(0.22);
  const [angle, setAngle] = useState(45);
  const [colorHex, setColorHex] = useState('#DC2626');
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const hexToRgb01 = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return rgb(r || 0, g || 0, b || 0);
  };

  const handleApply = async () => {
    if (!file || !text.trim()) return;
    setBusy(true);
    setDoneMsg(null);
    const started = performance.now();
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const safe = sanitizeWinAnsi(text.trim());
      const textWidth = font.widthOfTextAtSize(safe, fontSize);
      const color = hexToRgb01(colorHex);

      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        const rad = (angle * Math.PI) / 180;
        const x = width / 2 - (textWidth / 2) * Math.cos(rad);
        const y = height / 2 - (textWidth / 2) * Math.sin(rad);
        page.drawText(safe, {
          x,
          y,
          size: fontSize,
          font,
          color,
          opacity,
          rotate: degrees(angle),
        });
      }

      const out = await doc.save();
      const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${file.name.replace(/\.pdf$/i, '')}-watermarked.pdf`);
      setDoneMsg(`Stamped "${safe}" across ${doc.getPageCount()} page(s).`);
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `Watermarked PDF (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to stamp a vector text watermark"
        hint="Customize text, opacity, angle, font size, and color locally"
        onFiles={(files) => {
          setFile(files[0] ?? null);
          setDoneMsg(null);
        }}
      />

      {file && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Watermark text</label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Color</label>
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-transparent dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Angle ({angle}°)</label>
                <input
                  type="number"
                  min={-90}
                  max={90}
                  value={angle}
                  onChange={(e) => setAngle(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Font size</span>
                <span className="font-mono tabular-nums">{fontSize} pt</span>
              </div>
              <input type="range" min={18} max={96} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value, 10))} className="mt-2 w-full accent-blue-600" />
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Opacity</span>
                <span className="font-mono tabular-nums">{Math.round(opacity * 100)}%</span>
              </div>
              <input type="range" min={0.05} max={0.85} step={0.05} value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="mt-2 w-full accent-blue-600" />
            </div>
          </div>

          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={handleApply}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {busy ? 'Stamping...' : 'Apply Watermark & Download'}
          </button>
        </div>
      )}

      {doneMsg && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{doneMsg}</p>}
    </div>
  );
};

/* 3. Add Page Numbers to PDF */
export const PageNumbersPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'>('bottom-center');
  const [template, setTemplate] = useState<'n' | 'page-n-of-t' | 'dash-n'>('page-n-of-t');
  const [startNum, setStartNum] = useState(1);
  const [skipFirst, setSkipFirst] = useState(false);
  const [fontSize, setFontSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    const started = performance.now();
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;

      pages.forEach((page, idx) => {
        if (skipFirst && idx === 0) return;
        const num = startNum + idx;
        const label =
          template === 'n'
            ? `${num}`
            : template === 'dash-n'
              ? `- ${num} -`
              : `Page ${num} of ${startNum + total - 1}`;
        const { width, height } = page.getSize();
        const textW = font.widthOfTextAtSize(label, fontSize);
        const margin = 28;
        const x = position.endsWith('left')
          ? margin
          : position.endsWith('right')
            ? width - margin - textW
            : (width - textW) / 2;
        const y = position.startsWith('top') ? height - margin : margin - 4;
        page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.25, 0.28, 0.34) });
      });

      const out = await doc.save();
      const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${file.name.replace(/\.pdf$/i, '')}-numbered.pdf`);
      setDoneMsg(`Added page numbers to ${total} page(s).`);
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `Numbered PDF (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to add automatic page numbering"
        hint="6 header/footer positions · Custom format · Cover page skip option"
        onFiles={(files) => {
          setFile(files[0] ?? null);
          setDoneMsg(null);
        }}
      />

      {file && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as typeof position)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Format</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as typeof template)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="page-n-of-t">Page 1 of N</option>
                <option value="n">1, 2, 3...</option>
                <option value="dash-n">- 1 -</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Start #</label>
                <input type="number" min={1} value={startNum} onChange={(e) => setStartNum(Math.max(1, parseInt(e.target.value, 10) || 1))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Size (pt)</label>
                <input type="number" min={7} max={24} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 10)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900" />
              </div>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={skipFirst} onChange={(e) => setSkipFirst(e.target.checked)} className="accent-blue-600" />
            Skip page 1 (cover sheet)
          </label>

          <div>
            <button
              type="button"
              disabled={busy}
              onClick={handleApply}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {busy ? 'Numbering...' : 'Add Page Numbers & Download'}
            </button>
          </div>
        </div>
      )}

      {doneMsg && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{doneMsg}</p>}
    </div>
  );
};

/* 4. Sign & Annotate PDF */
export const SignPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pagePreviewUrl, setPagePreviewUrl] = useState('');
  const [sigMode, setSigMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('Alex Mercer');
  const [includeDate, setIncludeDate] = useState(true);
  const [inkColor, setInkColor] = useState('#0F172A');
  const [sigPos, setSigPos] = useState({ xPct: 0.65, yPct: 0.82 }); // percentage of page
  const [sigWidthPct, setSigWidthPct] = useState(0.24);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const padRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const renderPreview = async (f: File, p: number) => {
    const pdf = await loadPdfJsDocument(f);
    setNumPages(pdf.numPages);
    const { canvas } = await renderPdfPageToCanvas(pdf, p, 1.15);
    setPagePreviewUrl(canvas.toDataURL('image/png'));
  };

  useEffect(() => {
    if (file) void renderPreview(file, pageNum);
  }, [file, pageNum]);

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = padRef.current;
    if (!c) return;
    drawingRef.current = true;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(((e.clientX - rect.left) / rect.width) * c.width, ((e.clientY - rect.top) / rect.height) * c.height);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !padRef.current) return;
    const c = padRef.current;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(((e.clientX - rect.left) / rect.width) * c.width, ((e.clientY - rect.top) / rect.height) * c.height);
    ctx.stroke();
  };

  const clearPad = () => {
    const c = padRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  };

  const buildSignaturePng = async (): Promise<ArrayBuffer> => {
    const c = document.createElement('canvas');
    c.width = 520;
    c.height = 180;
    const ctx = c.getContext('2d')!;
    if (sigMode === 'draw' && padRef.current) {
      ctx.drawImage(padRef.current, 0, 0, c.width, c.height);
    } else {
      ctx.fillStyle = inkColor;
      ctx.font = 'italic 600 58px Georgia, "Times New Roman", serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName || 'Signature', 18, 86);
    }
    if (includeDate) {
      ctx.fillStyle = '#475569';
      ctx.font = '500 18px monospace';
      ctx.fillText(new Date().toISOString().split('T')[0], 18, 162);
    }
    const blob = await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error('Signature encode failed'))), 'image/png')
    );
    return blob.arrayBuffer();
  };

  const handleExportSigned = async () => {
    if (!file) return;
    setBusy(true);
    setDoneMsg(null);
    const started = performance.now();
    try {
      const pdfBytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const sigBytes = await buildSignaturePng();
      const png = await doc.embedPng(sigBytes);
      const page = doc.getPages()[pageNum - 1];
      const { width, height } = page.getSize();
      const drawW = width * sigWidthPct;
      const drawH = (drawW / 520) * 180;
      const x = Math.max(8, Math.min(width - drawW - 8, sigPos.xPct * width - drawW / 2));
      const y = Math.max(8, Math.min(height - drawH - 8, (1 - sigPos.yPct) * height - drawH / 2));
      page.drawImage(png, { x, y, width: drawW, height: drawH });

      const out = await doc.save();
      const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${file.name.replace(/\.pdf$/i, '')}-signed.pdf`);
      setDoneMsg(`Signed page ${pageNum} and exported PDF (${formatBytes(blob.size)}).`);
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `Signed PDF (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF contract or form to sign locally"
        hint="Draw or type your signature, click anywhere on the page preview to place, and export"
        onFiles={(files) => {
          setFile(files[0] ?? null);
          setPageNum(1);
          setDoneMsg(null);
        }}
      />

      {file && (
        <div className="grid gap-6 border-t border-slate-200 pt-5 lg:grid-cols-2 dark:border-slate-800">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button type="button" onClick={() => setSigMode('draw')} className={`rounded-md px-3 py-1 text-xs font-medium ${sigMode === 'draw' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>Draw Signature</button>
                <button type="button" onClick={() => setSigMode('type')} className={`rounded-md px-3 py-1 text-xs font-medium ${sigMode === 'type' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>Type Signature</button>
              </div>
              <input type="color" value={inkColor} onChange={(e) => setInkColor(e.target.value)} aria-label="Ink color" className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700" />
            </div>

            {sigMode === 'draw' ? (
              <div>
                <canvas
                  ref={padRef}
                  width={520}
                  height={180}
                  onPointerDown={startDraw}
                  onPointerMove={moveDraw}
                  onPointerUp={() => { drawingRef.current = false; }}
                  onPointerLeave={() => { drawingRef.current = false; }}
                  className="h-36 w-full cursor-crosshair touch-none rounded-xl border border-slate-300 bg-white dark:border-slate-700"
                />
                <button type="button" onClick={clearPad} className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white">
                  <Eraser className="h-3.5 w-3.5" /> Clear pad
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-serif text-2xl italic text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500">Target Page (1–{numPages})</label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, numPages)}
                  value={pageNum}
                  onChange={(e) => setPageNum(Math.max(1, Math.min(numPages, parseInt(e.target.value, 10) || 1)))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Signature width ({Math.round(sigWidthPct * 100)}%)</label>
                <input type="range" min={0.12} max={0.45} step={0.02} value={sigWidthPct} onChange={(e) => setSigWidthPct(parseFloat(e.target.value))} className="mt-3 w-full accent-blue-600" />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={includeDate} onChange={(e) => setIncludeDate(e.target.checked)} className="accent-blue-600" />
              Include today’s ISO date below signature
            </label>

            <button
              type="button"
              disabled={busy}
              onClick={handleExportSigned}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {busy ? 'Embedding Signature...' : 'Sign & Download PDF'}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-500">Click anywhere on Page {pageNum} to place signature:</p>
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setSigPos({
                  xPct: (e.clientX - rect.left) / rect.width,
                  yPct: (e.clientY - rect.top) / rect.height,
                });
              }}
              className="relative cursor-crosshair overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800"
            >
              {pagePreviewUrl && <img src={pagePreviewUrl} alt="PDF Page Preview" className="w-full select-none" />}
              <div
                style={{
                  left: `${sigPos.xPct * 100}%`,
                  top: `${sigPos.yPct * 100}%`,
                  width: `${sigWidthPct * 100}%`,
                }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded border-2 border-dashed border-blue-600 bg-blue-500/15 py-2 text-center font-mono text-[10px] font-semibold text-blue-700"
              >
                Signature Area
              </div>
            </div>
          </div>
        </div>
      )}

      {doneMsg && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{doneMsg}</p>}
    </div>
  );
};

/* 5. Crop & Redact PDF */
interface RedactBox {
  page: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

export const RedactCropPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [previewUrl, setPreviewUrl] = useState('');
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(0);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(0);
  const [boxes, setBoxes] = useState<RedactBox[]>([]);
  const [flattenRedacted, setFlattenRedacted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    void (async () => {
      const pdf = await loadPdfJsDocument(file);
      setNumPages(pdf.numPages);
      const { canvas } = await renderPdfPageToCanvas(pdf, pageNum, 1.15);
      setPreviewUrl(canvas.toDataURL('image/png'));
    })();
  }, [file, pageNum]);

  const addRedactAtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(0.82, (e.clientX - rect.left) / rect.width - 0.09));
    const yPct = Math.max(0, Math.min(0.94, (e.clientY - rect.top) / rect.height - 0.025));
    setBoxes((prev) => [...prev, { page: pageNum, xPct, yPct, wPct: 0.18, hPct: 0.05 }]);
  };

  const handleExport = async () => {
    if (!file) return;
    setBusy(true);
    setDoneMsg(null);
    const started = performance.now();
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPages();

      pages.forEach((p, idx) => {
        const { width, height } = p.getSize();
        // Apply redactions
        const pageBoxes = boxes.filter((b) => b.page === idx + 1);
        for (const b of pageBoxes) {
          const rw = b.wPct * width;
          const rh = b.hPct * height;
          const rx = b.xPct * width;
          const ry = height - (b.yPct + b.hPct) * height;
          p.drawRectangle({ x: rx, y: ry, width: rw, height: rh, color: rgb(0, 0, 0) });
        }
        // Apply margin crop
        if (cropTop || cropBottom || cropLeft || cropRight) {
          const newW = Math.max(40, width - cropLeft - cropRight);
          const newH = Math.max(40, height - cropTop - cropBottom);
          p.setCropBox(cropLeft, cropBottom, newW, newH);
          p.setMediaBox(cropLeft, cropBottom, newW, newH);
        }
      });

      let finalBytes = await doc.save();

      // Permanent rasterization of redacted pages so underlying text cannot be copied
      if (flattenRedacted && boxes.length > 0) {
        const pdfJs = await loadPdfJsDocument(finalBytes);
        const flatDoc = await PDFDocument.create();
        for (let i = 1; i <= pdfJs.numPages; i += 1) {
          const { canvas } = await renderPdfPageToCanvas(pdfJs, i, 1.8);
          const jpgBytes = await fetch(canvas.toDataURL('image/jpeg', 0.92)).then((r) => r.arrayBuffer());
          const img = await flatDoc.embedJpg(jpgBytes);
          const vp = (await pdfJs.getPage(i)).getViewport({ scale: 1 });
          const fp = flatDoc.addPage([vp.width, vp.height]);
          fp.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
        }
        finalBytes = await flatDoc.save();
      }

      const blob = new Blob([finalBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${file.name.replace(/\.pdf$/i, '')}-redacted-cropped.pdf`);
      setDoneMsg(`Exported cropped/redacted PDF (${formatBytes(blob.size)}).`);
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `${boxes.length} redactions applied (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to crop page margins or redact sensitive info"
        hint="Click anywhere on the preview to stamp solid redaction boxes · Optional permanent flatten"
        onFiles={(files) => {
          setFile(files[0] ?? null);
          setBoxes([]);
          setPageNum(1);
          setDoneMsg(null);
        }}
      />

      {file && (
        <div className="grid gap-6 border-t border-slate-200 pt-5 lg:grid-cols-2 dark:border-slate-800">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">Crop Margins (points, applied to all pages)</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Top', val: cropTop, set: setCropTop },
                { label: 'Bottom', val: cropBottom, set: setCropBottom },
                { label: 'Left', val: cropLeft, set: setCropLeft },
                { label: 'Right', val: cropRight, set: setCropRight },
              ].map((c) => (
                <div key={c.label}>
                  <label className="text-slate-500">{c.label} ({c.val} pt)</label>
                  <input type="range" min={0} max={140} value={c.val} onChange={(e) => c.set(parseInt(e.target.value, 10))} className="mt-1 w-full accent-blue-600" />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
              <span>Page (1–{numPages})</span>
              <input type="number" min={1} max={Math.max(1, numPages)} value={pageNum} onChange={(e) => setPageNum(Math.max(1, Math.min(numPages, parseInt(e.target.value, 10) || 1)))} className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-900" />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{boxes.length} redaction box(es) placed</span>
              {boxes.length > 0 && (
                <button type="button" onClick={() => setBoxes([])} className="text-red-500 hover:underline">
                  Clear boxes
                </button>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={flattenRedacted} onChange={(e) => setFlattenRedacted(e.target.checked)} className="accent-blue-600" />
              Flatten redacted pages to image (irreversible removal)
            </label>

            <button
              type="button"
              disabled={busy}
              onClick={handleExport}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {busy ? 'Applying...' : 'Export Cropped / Redacted PDF'}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-500">Click anywhere on Page {pageNum} to place a black redaction bar:</p>
            <div onClick={addRedactAtClick} className="relative cursor-crosshair overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800">
              {previewUrl && <img src={previewUrl} alt="Page preview" className="w-full select-none" />}
              {boxes
                .filter((b) => b.page === pageNum)
                .map((b, i) => (
                  <div
                    key={i}
                    style={{
                      left: `${b.xPct * 100}%`,
                      top: `${b.yPct * 100}%`,
                      width: `${b.wPct * 100}%`,
                      height: `${b.hPct * 100}%`,
                    }}
                    className="pointer-events-none absolute bg-black"
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {doneMsg && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{doneMsg}</p>}
    </div>
  );
};

/* 6. PDF Reader & Side-by-Side Compare */
export const PdfReaderCompareTool: React.FC<ToolComponentProps> = () => {
  const [mode, setMode] = useState<'reader' | 'compare'>('reader');
  // Reader state
  const [fileA, setFileA] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1.3);
  const [pageImg, setPageImg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pageTextMap, setPageTextMap] = useState<string[]>([]);
  // Compare state
  const [fileB, setFileB] = useState<File | null>(null);
  const [diffResult, setDiffResult] = useState<{ type: 'same' | 'add' | 'del'; text: string }[]>([]);

  useEffect(() => {
    if (!fileA || mode !== 'reader') return;
    void (async () => {
      const pdf = await loadPdfJsDocument(fileA);
      setNumPages(pdf.numPages);
      const { canvas } = await renderPdfPageToCanvas(pdf, pageNum, zoom);
      setPageImg(canvas.toDataURL('image/png'));
    })();
  }, [fileA, pageNum, zoom, mode]);

  const handleLoadReader = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFileA(f);
    setPageNum(1);
    const pdf = await loadPdfJsDocument(f);
    const extracted = await extractStructuredPdfText(pdf);
    setPageTextMap(extracted.map((p) => p.lines.join(' ')));
  };

  const runCompare = async (a: File, b: File) => {
    const [pdfA, pdfB] = await Promise.all([loadPdfJsDocument(a), loadPdfJsDocument(b)]);
    const [textA, textB] = await Promise.all([
      extractStructuredPdfText(pdfA),
      extractStructuredPdfText(pdfB),
    ]);
    const linesA = textA.flatMap((p) => p.lines);
    const linesB = textB.flatMap((p) => p.lines);
    const setA = new Set(linesA);
    const setB = new Set(linesB);
    const out: { type: 'same' | 'add' | 'del'; text: string }[] = [];
    for (const l of linesA) {
      out.push({ type: setB.has(l) ? 'same' : 'del', text: l });
    }
    for (const l of linesB) {
      if (!setA.has(l)) out.push({ type: 'add', text: l });
    }
    setDiffResult(out);
  };

  const matchingPages = searchTerm.trim()
    ? pageTextMap
        .map((t, idx) => (t.toLowerCase().includes(searchTerm.toLowerCase()) ? idx + 1 : -1))
        .filter((n) => n > 0)
    : [];

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button type="button" onClick={() => setMode('reader')} className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${mode === 'reader' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
          PDF Reader & Search
        </button>
        <button type="button" onClick={() => setMode('compare')} className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${mode === 'compare' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
          Compare Two PDFs
        </button>
      </div>

      {mode === 'reader' ? (
        <div className="space-y-4">
          <FileDropzone accept="application/pdf" label="Drop a PDF to read and search text locally" hint="Fast zero-upload PDF.js viewer" onFiles={handleLoadReader} />
          {fileA && numPages > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)} className="rounded border border-slate-200 px-2.5 py-1 disabled:opacity-30 dark:border-slate-700">Prev</button>
                  <span className="font-mono tabular-nums">{pageNum} / {numPages}</span>
                  <button type="button" disabled={pageNum >= numPages} onClick={() => setPageNum((p) => p + 1)} className="rounded border border-slate-200 px-2.5 py-1 disabled:opacity-30 dark:border-slate-700">Next</button>
                  <select value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="ml-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">
                    <option value={1}>100%</option>
                    <option value={1.3}>130%</option>
                    <option value={1.8}>180%</option>
                  </select>
                </div>
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search inside PDF..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </div>
              {searchTerm.trim() && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>Matches on pages:</span>
                  {matchingPages.length > 0 ? (
                    matchingPages.map((p) => (
                      <button key={p} type="button" onClick={() => setPageNum(p)} className="rounded bg-blue-600/10 px-2 py-0.5 font-mono text-blue-600 hover:bg-blue-600/20 dark:text-blue-400">
                        p.{p}
                      </button>
                    ))
                  ) : (
                    <span>None</span>
                  )}
                </div>
              )}
              <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4 text-center dark:border-slate-800 dark:bg-slate-950">
                {pageImg && <img src={pageImg} alt={`Page ${pageNum}`} className="mx-auto rounded bg-white shadow-sm" />}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FileDropzone
              accept="application/pdf"
              label={fileA ? `Original: ${fileA.name}` : 'Drop Original PDF (Version A)'}
              hint="Baseline PDF document — stays in browser RAM"
              onFiles={(f) => {
                const next = f[0] ?? null;
                setFileA(next);
                if (next && fileB) void runCompare(next, fileB);
              }}
            />
            <FileDropzone
              accept="application/pdf"
              label={fileB ? `Revised: ${fileB.name}` : 'Drop Revised PDF (Version B)'}
              hint="Updated PDF document to diff line by line"
              onFiles={(f) => {
                const next = f[0] ?? null;
                setFileB(next);
                if (fileA && next) void runCompare(fileA, next);
              }}
            />
          </div>

          {diffResult.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-xl border border-slate-200 p-3 font-mono text-xs leading-6 dark:border-slate-800">
              {diffResult.map((row, idx) => (
                <div
                  key={idx}
                  className={`px-2 py-0.5 ${
                    row.type === 'add'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : row.type === 'del'
                        ? 'bg-red-500/15 text-red-700 line-through dark:text-red-300'
                        : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {row.type === 'add' ? '+ ' : row.type === 'del' ? '− ' : '  '}
                  {row.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* 7. Repair, Unlock & Scrub PDF Metadata */
export const RepairUnlockPdfTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [subject, setSubject] = useState('');
  const [scrubAll, setScrubAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError(null);
    setDoneMsg(null);
    try {
      const bytes = await f.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setFile(f);
      setTitle(doc.getTitle() || '');
      setAuthor(doc.getAuthor() || '');
      setSubject(doc.getSubject() || '');
    } catch {
      setError('This PDF is either severely damaged or protected by a strong open password.');
    }
  };

  const handleRebuild = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const clean = await PDFDocument.create();
      const copied = await clean.copyPages(src, src.getPageIndices());
      copied.forEach((p) => clean.addPage(p));

      if (scrubAll) {
        clean.setTitle('');
        clean.setAuthor('');
        clean.setSubject('');
        clean.setKeywords([]);
        clean.setCreator('');
        clean.setProducer('');
      } else {
        clean.setTitle(title);
        clean.setAuthor(author);
        clean.setSubject(subject);
      }

      const out = await clean.save({ useObjectStreams: true });
      const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerDownload(blob, `${file.name.replace(/\.pdf$/i, '')}-clean.pdf`);
      setDoneMsg(`Rebuilt clean PDF (${clean.getPageCount()} pages · ${formatBytes(blob.size)}).`);
      onComplete?.({
        inputSummary: file.name,
        outputSummary: `Clean rebuilt PDF (${formatBytes(blob.size)})`,
        processingMs: performance.now() - started,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rebuild failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf"
        label="Drop a PDF to repair structure, clear owner restrictions, or scrub metadata"
        hint="Re-serializes pages into a fresh standard-compliant PDF locally"
        onFiles={handleLoad}
      />

      {file && (
        <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
            <input type="checkbox" checked={scrubAll} onChange={(e) => setScrubAll(e.target.checked)} className="accent-blue-600" />
            Scrub all hidden metadata (Title, Author, Creator, Producer)
          </label>

          {!scrubAll && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-slate-500">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Author</label>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              disabled={busy}
              onClick={handleRebuild}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {busy ? 'Rebuilding PDF...' : 'Rebuild & Download Clean PDF'}
            </button>
          </div>
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
