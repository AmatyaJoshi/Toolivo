import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { ToolCategoryId } from '../data/catalog';

export interface ToolRunMetrics {
  inputSummary: string;
  outputSummary: string;
  processingMs: number;
}

export interface ToolComponentProps {
  onComplete?: (metrics: ToolRunMetrics) => void;
}

export interface ToolModule {
  slug: string;
  category: ToolCategoryId;
  component: React.FC<ToolComponentProps>;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let val = bytes / 1024;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(val >= 100 ? 0 : 2)} ${units[idx]}`;
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function parsePageRange(input: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const segments = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    if (seg.includes('-')) {
      const [rawStart, rawEnd] = seg.split('-').map((n) => parseInt(n.trim(), 10));
      if (Number.isNaN(rawStart) || Number.isNaN(rawEnd)) {
        throw new Error(`Invalid range "${seg}". Use formats like 1-3, 5.`);
      }
      const start = Math.max(1, Math.min(rawStart, rawEnd));
      const end = Math.min(totalPages, Math.max(rawStart, rawEnd));
      for (let p = start; p <= end; p += 1) {
        pages.add(p - 1);
      }
    } else {
      const num = parseInt(seg, 10);
      if (Number.isNaN(num) || num < 1 || num > totalPages) {
        throw new Error(`Page "${seg}" is out of range (1–${totalPages}).`);
      }
      pages.add(num - 1);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export function encodeAudioBufferToWav(
  audioBuffer: AudioBuffer,
  options?: { mono?: boolean; normalize?: boolean }
): Blob {
  const mono = options?.mono ?? false;
  const normalize = options?.normalize ?? false;
  const numChannels = mono ? 1 : Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const channels: Float32Array[] = [];
  if (mono && audioBuffer.numberOfChannels > 1) {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    const mixed = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      mixed[i] = (ch0[i] + ch1[i]) * 0.5;
    }
    channels.push(mixed);
  } else {
    for (let c = 0; c < numChannels; c += 1) {
      channels.push(new Float32Array(audioBuffer.getChannelData(c)));
    }
  }

  let gain = 1;
  if (normalize) {
    let peak = 0;
    for (const ch of channels) {
      for (let i = 0; i < ch.length; i += 1) {
        const abs = Math.abs(ch[i]);
        if (abs > peak) peak = abs;
      }
    }
    if (peak > 0.0001) {
      gain = 0.89 / peak; // -1 dBFS target
    }
  }

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      const sample = Math.max(-1, Math.min(1, channels[c][i] * gain));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

interface DropzoneProps {
  accept: string;
  multiple?: boolean;
  label: string;
  hint: string;
  onFiles: (files: File[]) => void;
}

export const FileDropzone: React.FC<DropzoneProps> = ({
  accept,
  multiple = false,
  label,
  hint,
  onFiles,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFileList = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFileList(e.dataTransfer.files);
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border border-dashed p-8 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        dragging
          ? 'border-violet-600 bg-violet-50/85 shadow-[0_0_28px_-4px_rgba(124,58,237,0.28),inset_0_0_24px_-6px_rgba(124,58,237,0.14)] dark:border-violet-400 dark:bg-violet-500/15 dark:shadow-[0_0_38px_-4px_rgba(139,92,246,0.45),inset_0_0_30px_-6px_rgba(99,102,241,0.28)]'
          : 'border-slate-300/90 bg-slate-50/75 hover:border-violet-500/80 hover:bg-violet-50/45 hover:shadow-[0_0_24px_-4px_rgba(124,58,237,0.20),inset_0_0_22px_-8px_rgba(124,58,237,0.10)] dark:border-slate-700/80 dark:bg-[#0D1020]/70 dark:hover:border-violet-400/75 dark:hover:bg-[#131730]/85 dark:hover:shadow-[0_0_34px_-4px_rgba(139,92,246,0.38),inset_0_0_28px_-8px_rgba(99,102,241,0.24)]'
      }`}
    >
      {/* Subtle radial hover/drag aura */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_40%,rgba(124,58,237,0.14),transparent_72%)] transition-opacity duration-200 dark:bg-[radial-gradient(ellipse_65%_55%_at_50%_40%,rgba(139,92,246,0.22),transparent_72%)] ${
          dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      />
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFileList(e.target.files)}
      />
      <div className="relative z-10">
        <div
          className={`mx-auto mb-3.5 inline-flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-200 ${
            dragging
              ? 'scale-105 border-violet-500/70 bg-violet-500/15 text-violet-600 shadow-[0_0_20px_-2px_rgba(139,92,246,0.45)] dark:border-violet-400/70 dark:bg-violet-500/20 dark:text-violet-300'
              : 'border-slate-200/90 bg-white/90 text-slate-500 group-hover:scale-105 group-hover:border-violet-400/70 group-hover:bg-violet-500/12 group-hover:text-violet-600 group-hover:shadow-[0_0_18px_-2px_rgba(139,92,246,0.4)] dark:border-slate-700/80 dark:bg-[#14182B] dark:text-slate-400 dark:group-hover:border-violet-400/65 dark:group-hover:bg-violet-500/20 dark:group-hover:text-violet-300'
          }`}
        >
          <Upload className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-violet-950 dark:text-slate-100 dark:group-hover:text-white">
          {label}
        </p>
        <p className="mt-1 text-xs text-slate-500 transition-colors group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">
          {hint}
        </p>
      </div>
    </div>
  );
};
