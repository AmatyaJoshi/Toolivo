import React from 'react';
import {
  ImageCompressorTool,
  ImageResizerTool,
  JpgToPngTool,
  PngToJpgTool,
  WebpConverterTool,
} from './modules/ImageTools';
import {
  AudioTrimmerTool,
  VideoCompressorTool,
  VideoToAudioTool,
} from './modules/VideoAudioTools';
import { MergePdfTool, RotatePdfTool, SplitPdfTool } from './modules/PdfTools';
import {
  CompressPdfTool,
  ExcelToPdfTool,
  HtmlToPdfTool,
  JpgToPdfTool,
  PdfToExcelTool,
  PdfToJpgTool,
  PdfToPptTool,
  PdfToWordTool,
  WordToPdfTool,
} from './modules/PdfConvertTools';
import {
  OrganizePdfTool,
  PageNumbersPdfTool,
  PdfReaderCompareTool,
  RedactCropPdfTool,
  RepairUnlockPdfTool,
  SignPdfTool,
  WatermarkPdfTool,
} from './modules/PdfEditTools';
import {
  AudioConverterMergerTool,
  AudioToVideoTool,
  AudioVolumeBoosterTool,
  BackgroundRemoverTool,
  ImageCropRotateTool,
  PassportPhotoMakerTool,
  TextToSpeechTool,
  VideoToGifTool,
  VideoTrimmerTool,
} from './modules/ExtraMediaTools';
import {
  Base64CodecTool,
  CaseConverterTool,
  JsonFormatterTool,
  PasswordGeneratorTool,
  QrCodeGeneratorTool,
  UuidHashGeneratorTool,
  WordCounterTool,
} from './modules/DevTextProductivityTools';
import type { ToolComponentProps } from './types';

/**
 * Modular Tool Registry — 38 100% browser-functional utilities
 */
const TOOL_COMPONENTS: Record<string, React.FC<ToolComponentProps>> = {
  // PDF Suite (18 tools — iLovePDF + Smallpdf)
  'merge-pdf': MergePdfTool,
  'split-pdf': SplitPdfTool,
  'compress-pdf': CompressPdfTool,
  'organize-pdf': OrganizePdfTool,
  'pdf-to-jpg': PdfToJpgTool,
  'jpg-to-pdf': JpgToPdfTool,
  'pdf-to-word': PdfToWordTool,
  'word-to-pdf': WordToPdfTool,
  'pdf-to-excel': PdfToExcelTool,
  'excel-to-pdf': ExcelToPdfTool,
  'pdf-to-ppt': PdfToPptTool,
  'html-to-pdf': HtmlToPdfTool,
  'rotate-pdf': RotatePdfTool,
  'watermark-pdf': WatermarkPdfTool,
  'page-numbers-pdf': PageNumbersPdfTool,
  'sign-pdf': SignPdfTool,
  'redact-crop-pdf': RedactCropPdfTool,
  'pdf-reader-compare': PdfReaderCompareTool,
  'repair-unlock-pdf': RepairUnlockPdfTool,

  // Image Suite (8 tools — Clip Utils + iLoveIMG)
  'image-compressor': ImageCompressorTool,
  'image-resizer': ImageResizerTool,
  'background-remover': BackgroundRemoverTool,
  'passport-photo-maker': PassportPhotoMakerTool,
  'image-crop-rotate': ImageCropRotateTool,
  'jpg-to-png': JpgToPngTool,
  'png-to-jpg': PngToJpgTool,
  'webp-converter': WebpConverterTool,

  // Video Suite (5 tools — Clip Utils)
  'video-compressor': VideoCompressorTool,
  'video-trimmer': VideoTrimmerTool,
  'video-to-gif': VideoToGifTool,
  'video-to-mp3': VideoToAudioTool,
  'audio-to-video': AudioToVideoTool,

  // Audio Suite (4 tools — Clip Utils)
  'audio-trimmer': AudioTrimmerTool,
  'audio-volume-booster': AudioVolumeBoosterTool,
  'audio-converter': AudioConverterMergerTool,
  'text-to-speech': TextToSpeechTool,

  // Text, Developer & Productivity (7 tools)
  'word-counter': WordCounterTool,
  'case-converter': CaseConverterTool,
  'json-formatter': JsonFormatterTool,
  'base64-codec': Base64CodecTool,
  'uuid-hash-generator': UuidHashGeneratorTool,
  'qr-code-generator': QrCodeGeneratorTool,
  'password-generator': PasswordGeneratorTool,
};

export function getToolComponent(slug: string): React.FC<ToolComponentProps> | undefined {
  return TOOL_COMPONENTS[slug];
}
