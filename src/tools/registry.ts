import React from 'react';
import type { ToolComponentProps } from './types';

function lazyExport<T extends Record<string, React.ComponentType<ToolComponentProps>>>(
  loader: () => Promise<T>,
  exportName: keyof T
): React.LazyExoticComponent<React.ComponentType<ToolComponentProps>> {
  return React.lazy(() =>
    loader().then((mod) => ({ default: mod[exportName] as React.ComponentType<ToolComponentProps> }))
  );
}

const loadImageTools = () => import('./modules/ImageTools');
const loadVideoAudioTools = () => import('./modules/VideoAudioTools');
const loadPdfTools = () => import('./modules/PdfTools');
const loadPdfConvertTools = () => import('./modules/PdfConvertTools');
const loadPdfEditTools = () => import('./modules/PdfEditTools');
const loadExtraMediaTools = () => import('./modules/ExtraMediaTools');
const loadDevTextTools = () => import('./modules/DevTextProductivityTools');

/**
 * Code-Split Lazy Tool Registry — 43 100% browser-functional utilities.
 * Heavy libraries (pdf-lib, pdfjs-dist, xlsx, mammoth, jszip, qrcode) are only downloaded
 * on-demand when a user opens a tool, keeping the homepage bundle ultra-light.
 */
const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<ToolComponentProps>>> = {
  // PDF Suite (19 tools)
  'merge-pdf': lazyExport(loadPdfTools, 'MergePdfTool'),
  'split-pdf': lazyExport(loadPdfTools, 'SplitPdfTool'),
  'rotate-pdf': lazyExport(loadPdfTools, 'RotatePdfTool'),

  'compress-pdf': lazyExport(loadPdfConvertTools, 'CompressPdfTool'),
  'pdf-to-jpg': lazyExport(loadPdfConvertTools, 'PdfToJpgTool'),
  'jpg-to-pdf': lazyExport(loadPdfConvertTools, 'JpgToPdfTool'),
  'pdf-to-word': lazyExport(loadPdfConvertTools, 'PdfToWordTool'),
  'word-to-pdf': lazyExport(loadPdfConvertTools, 'WordToPdfTool'),
  'pdf-to-excel': lazyExport(loadPdfConvertTools, 'PdfToExcelTool'),
  'excel-to-pdf': lazyExport(loadPdfConvertTools, 'ExcelToPdfTool'),
  'pdf-to-ppt': lazyExport(loadPdfConvertTools, 'PdfToPptTool'),
  'html-to-pdf': lazyExport(loadPdfConvertTools, 'HtmlToPdfTool'),

  'organize-pdf': lazyExport(loadPdfEditTools, 'OrganizePdfTool'),
  'watermark-pdf': lazyExport(loadPdfEditTools, 'WatermarkPdfTool'),
  'page-numbers-pdf': lazyExport(loadPdfEditTools, 'PageNumbersPdfTool'),
  'sign-pdf': lazyExport(loadPdfEditTools, 'SignPdfTool'),
  'redact-crop-pdf': lazyExport(loadPdfEditTools, 'RedactCropPdfTool'),
  'pdf-reader-compare': lazyExport(loadPdfEditTools, 'PdfReaderCompareTool'),
  'repair-unlock-pdf': lazyExport(loadPdfEditTools, 'RepairUnlockPdfTool'),

  // Image Suite (8 tools)
  'image-compressor': lazyExport(loadImageTools, 'ImageCompressorTool'),
  'image-resizer': lazyExport(loadImageTools, 'ImageResizerTool'),
  'jpg-to-png': lazyExport(loadImageTools, 'JpgToPngTool'),
  'png-to-jpg': lazyExport(loadImageTools, 'PngToJpgTool'),
  'webp-converter': lazyExport(loadImageTools, 'WebpConverterTool'),
  'background-remover': lazyExport(loadExtraMediaTools, 'BackgroundRemoverTool'),
  'passport-photo-maker': lazyExport(loadExtraMediaTools, 'PassportPhotoMakerTool'),
  'image-crop-rotate': lazyExport(loadExtraMediaTools, 'ImageCropRotateTool'),

  // Video Suite (5 tools)
  'video-compressor': lazyExport(loadVideoAudioTools, 'VideoCompressorTool'),
  'video-to-mp3': lazyExport(loadVideoAudioTools, 'VideoToAudioTool'),
  'video-trimmer': lazyExport(loadExtraMediaTools, 'VideoTrimmerTool'),
  'video-to-gif': lazyExport(loadExtraMediaTools, 'VideoToGifTool'),
  'audio-to-video': lazyExport(loadExtraMediaTools, 'AudioToVideoTool'),

  // Audio Suite (4 tools)
  'audio-trimmer': lazyExport(loadVideoAudioTools, 'AudioTrimmerTool'),
  'audio-volume-booster': lazyExport(loadExtraMediaTools, 'AudioVolumeBoosterTool'),
  'audio-converter': lazyExport(loadExtraMediaTools, 'AudioConverterMergerTool'),
  'text-to-speech': lazyExport(loadExtraMediaTools, 'TextToSpeechTool'),

  // Text, Developer & Productivity (7 tools)
  'word-counter': lazyExport(loadDevTextTools, 'WordCounterTool'),
  'case-converter': lazyExport(loadDevTextTools, 'CaseConverterTool'),
  'json-formatter': lazyExport(loadDevTextTools, 'JsonFormatterTool'),
  'base64-codec': lazyExport(loadDevTextTools, 'Base64CodecTool'),
  'uuid-hash-generator': lazyExport(loadDevTextTools, 'UuidHashGeneratorTool'),
  'qr-code-generator': lazyExport(loadDevTextTools, 'QrCodeGeneratorTool'),
  'password-generator': lazyExport(loadDevTextTools, 'PasswordGeneratorTool'),
};

export function getToolComponent(
  slug: string
): React.LazyExoticComponent<React.ComponentType<ToolComponentProps>> | undefined {
  return TOOL_COMPONENTS[slug];
}
