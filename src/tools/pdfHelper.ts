import * as pdfjsLib from 'pdfjs-dist';
import type { PDFFont } from 'pdf-lib';

// Configure PDF.js worker cleanly for Vite dev & production bundles
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export { pdfjsLib };

export async function loadPdfJsDocument(fileOrBytes: File | ArrayBuffer | Uint8Array) {
  let data: Uint8Array;
  if (fileOrBytes instanceof File) {
    data = new Uint8Array(await fileOrBytes.arrayBuffer());
  } else if (fileOrBytes instanceof ArrayBuffer) {
    data = new Uint8Array(fileOrBytes.slice(0));
  } else {
    data = new Uint8Array(fileOrBytes);
  }
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

export async function renderPdfPageToCanvas(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale = 1.5
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return { canvas, width: canvas.width, height: canvas.height };
}

export interface ExtractedPageText {
  pageNumber: number;
  lines: string[];
  rows: string[][];
}

export async function extractStructuredPdfText(
  pdfDoc: pdfjsLib.PDFDocumentProxy
): Promise<ExtractedPageText[]> {
  const pages: ExtractedPageText[] = [];
  for (let p = 1; p <= pdfDoc.numPages; p += 1) {
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    type PositionedItem = { text: string; x: number; y: number };
    const items: PositionedItem[] = [];

    for (const raw of content.items) {
      if ('str' in raw && typeof raw.str === 'string' && raw.str.trim()) {
        const tx = raw.transform || [1, 0, 0, 1, 0, 0];
        items.push({ text: raw.str.trim(), x: tx[4] ?? 0, y: tx[5] ?? 0 });
      }
    }

    // Group items into visual rows by Y coordinate tolerance (~5pt)
    items.sort((a, b) => (Math.abs(b.y - a.y) > 5 ? b.y - a.y : a.x - b.x));
    const grouped: PositionedItem[][] = [];
    for (const item of items) {
      const lastRow = grouped[grouped.length - 1];
      if (!lastRow || Math.abs(lastRow[0].y - item.y) > 5) {
        grouped.push([item]);
      } else {
        lastRow.push(item);
      }
    }

    const rows = grouped.map((row) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((cell) => cell.text)
    );
    const lines = rows.map((cells) => cells.join(' '));
    pages.push({ pageNumber: p, lines, rows });
  }
  return pages;
}

/**
 * Sanitize text for StandardFonts (WinAnsi) inside pdf-lib so Unicode punctuation never throws.
 */
export function sanitizeWinAnsi(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA1-\xFF]/g, ' ');
}

export function wrapTextLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const safe = sanitizeWinAnsi(text);
  const paragraphs = safe.split(/\r?\n/);
  const result: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      result.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        if (current) result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
  }
  return result;
}
