import React from 'react';
import type { ToolCategoryId } from '../data/catalog';

interface ToolVisualProps {
  slug: string;
  category: ToolCategoryId;
  variant?: 'card' | 'banner';
}

const ACCENT_SURFACE: Record<
  ToolCategoryId,
  {
    bg: string;
    highlight: string;
    stroke: string;
  }
> = {
  pdf: {
    bg: 'bg-rose-50/70 dark:bg-rose-950/20',
    highlight: 'group-hover:bg-rose-50 dark:group-hover:bg-rose-950/35',
    stroke: 'text-rose-600 dark:text-rose-400',
  },
  image: {
    bg: 'bg-sky-50/70 dark:bg-sky-950/20',
    highlight: 'group-hover:bg-sky-50 dark:group-hover:bg-sky-950/35',
    stroke: 'text-sky-600 dark:text-sky-400',
  },
  video: {
    bg: 'bg-indigo-50/70 dark:bg-indigo-950/20',
    highlight: 'group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/35',
    stroke: 'text-indigo-600 dark:text-indigo-400',
  },
  audio: {
    bg: 'bg-emerald-50/70 dark:bg-emerald-950/20',
    highlight: 'group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/35',
    stroke: 'text-emerald-600 dark:text-emerald-400',
  },
  text: {
    bg: 'bg-amber-50/70 dark:bg-amber-950/20',
    highlight: 'group-hover:bg-amber-50 dark:group-hover:bg-amber-950/35',
    stroke: 'text-amber-600 dark:text-amber-400',
  },
  developer: {
    bg: 'bg-violet-50/70 dark:bg-violet-950/20',
    highlight: 'group-hover:bg-violet-50 dark:group-hover:bg-violet-950/35',
    stroke: 'text-violet-600 dark:text-violet-400',
  },
  productivity: {
    bg: 'bg-blue-50/70 dark:bg-blue-950/20',
    highlight: 'group-hover:bg-blue-50 dark:group-hover:bg-blue-950/35',
    stroke: 'text-blue-600 dark:text-blue-400',
  },
};

export const TOOL_FLOW_LABEL: Record<string, string> = {
  'merge-pdf': 'PDF + PDF → 1 PDF',
  'split-pdf': '1 PDF → Separate Pages',
  'compress-pdf': '8.4 MB → 1.1 MB PDF',
  'organize-pdf': 'Drag · Rotate · Delete',
  'pdf-to-jpg': 'PDF → High-DPI JPG/PNG',
  'jpg-to-pdf': 'Photos → Multi-Page PDF',
  'pdf-to-word': 'PDF → Editable .DOC',
  'word-to-pdf': '.DOCX → Print-Ready PDF',
  'pdf-to-excel': 'PDF Table → .XLSX / CSV',
  'excel-to-pdf': '.XLSX Sheet → PDF',
  'pdf-to-ppt': 'PDF → 16:9 Slide Deck',
  'html-to-pdf': 'HTML / MD → Styled PDF',
  'rotate-pdf': 'Portrait ↔ 90° / 180°',
  'watermark-pdf': 'PDF + Diagonal Stamp',
  'page-numbers-pdf': 'Auto-Stamp 01, 02, 03',
  'sign-pdf': 'Draw / Type Signature',
  'redact-crop-pdf': 'Blackout + Margin Crop',
  'pdf-reader-compare': 'Read + Side-by-Side Diff',
  'repair-unlock-pdf': 'Rebuild · Scrub Metadata',
  'image-compressor': '4.2 MB → 640 KB Image',
  'image-resizer': '1920px → Exact W×H',
  'background-remover': 'Photo → Transparent PNG',
  'passport-photo-maker': 'Headshot → 2×2 & 4×6 Sheet',
  'image-crop-rotate': 'Crop · Flip · Tune',
  'jpg-to-png': 'JPG → Lossless PNG',
  'png-to-jpg': 'PNG → Lightweight JPG',
  'webp-converter': 'JPG/PNG ↔ WebP',
  'video-compressor': '48 MB → Compact WebM',
  'video-trimmer': 'Mark In / Out → Clip',
  'video-to-gif': 'MP4 → Looping GIF89a',
  'video-to-mp3': 'Video → Clean WAV Audio',
  'audio-to-video': 'Audio + Cover → Waveform Video',
  'audio-trimmer': 'Waveform Slice → WAV',
  'audio-volume-booster': 'Gain +18 dB · Speed 2×',
  'audio-converter': 'Track A + B → Merged WAV',
  'text-to-speech': 'Text ⇄ Spoken Voice',
  'word-counter': 'Words · Chars · Read Time',
  'case-converter': 'camel · snake · Title',
  'json-formatter': 'Raw → Validated JSON',
  'base64-codec': 'Text / File ⇄ Base64',
  'uuid-hash-generator': 'UUID v4 · SHA-256',
  'qr-code-generator': 'URL / Text → PNG / SVG QR',
  'password-generator': 'CSPRNG High-Entropy Key',
};

/* Shared crisp SVG primitives (theme-aware via Tailwind classes) */
const sheetCls = 'fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-700';
const mutedLineCls = 'fill-slate-200 dark:fill-slate-700/80';
const arrowCls = 'stroke-slate-400 dark:stroke-slate-500';

function Arrow({ x = 104, y = 50, len = 26 }: { x?: number; y?: number; len?: number }) {
  const end = x + len;
  return (
    <g className={arrowCls} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1={x} y1={y} x2={end} y2={y} />
      <polyline points={`${end - 6},${y - 5} ${end},${y} ${end - 6},${y + 5}`} />
    </g>
  );
}

function MiniDoc({
  x,
  y,
  w = 40,
  h = 52,
  label,
  badgeClass = 'fill-rose-500',
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  badgeClass?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="5" className={sheetCls} strokeWidth="1.5" />
      <rect x={x + 5} y={y + 6} width={w - 10} height="11" rx="2.5" className={badgeClass} />
      <text
        x={x + w / 2}
        y={y + 14}
        textAnchor="middle"
        className="fill-white font-mono text-[7px] font-bold"
      >
        {label}
      </text>
      <rect x={x + 6} y={y + 23} width={w - 12} height="3" rx="1.5" className={mutedLineCls} />
      <rect x={x + 6} y={y + 30} width={w - 16} height="3" rx="1.5" className={mutedLineCls} />
      <rect x={x + 6} y={y + 37} width={w - 12} height="3" rx="1.5" className={mutedLineCls} />
    </g>
  );
}

function renderToolSchematic(slug: string): React.ReactNode {
  switch (slug) {
    /* ==================== PDF SUITE (19) ==================== */
    case 'merge-pdf':
      return (
        <>
          <MiniDoc x={22} y={24} w={36} h={48} label="PDF 1" />
          <text x={66} y={53} textAnchor="middle" className="fill-rose-500 font-display text-base font-bold">+</text>
          <MiniDoc x={74} y={28} w={36} h={48} label="PDF 2" />
          <Arrow x={118} y={50} len={22} />
          <rect x={156} y={18} width={44} height={58} rx="5" className="fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-700" strokeWidth="1.5" />
          <MiniDoc x={150} y={23} w={44} h={58} label="MERGED" badgeClass="fill-rose-600" />
        </>
      );

    case 'split-pdf':
      return (
        <>
          <rect x={28} y={20} width={42} height={54} rx="5" className="fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-700" strokeWidth="1.5" />
          <MiniDoc x={22} y={25} w={42} h={54} label="PDF" />
          <line x1={82} y1={18} x2={82} y2={82} className="stroke-rose-500" strokeWidth="1.75" strokeDasharray="4 3" />
          <Arrow x={90} y={50} len={18} />
          <MiniDoc x={116} y={26} w={30} h={42} label="P.1" />
          <MiniDoc x={151} y={26} w={30} h={42} label="P.2" />
          <MiniDoc x={186} y={26} w={30} h={42} label="P.3" />
        </>
      );

    case 'compress-pdf':
      return (
        <>
          <MiniDoc x={26} y={18} w={48} h={62} label="8.4 MB" />
          <g className="stroke-rose-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <line x1={86} y1={50} x2={106} y2={50} />
            <polyline points="100,45 106,50 100,55" />
            <line x1={144} y1={50} x2={124} y2={50} />
            <polyline points="130,45 124,50 130,55" />
          </g>
          <MiniDoc x={154} y={27} w={38} h={46} label="1.1 MB" badgeClass="fill-emerald-600" />
          <text x={173} y={88} textAnchor="middle" className="fill-emerald-600 font-mono text-[9px] font-bold dark:fill-emerald-400">
            -86%
          </text>
        </>
      );

    case 'organize-pdf':
      return (
        <>
          <rect x={30} y={18} width={34} height={44} rx="4" className={sheetCls} strokeWidth="1.5" />
          <text x={47} y={44} textAnchor="middle" className="fill-slate-400 font-mono text-xs font-bold">1</text>
          <rect x={76} y={14} width={36} height={46} rx="4" className="fill-white stroke-rose-500 dark:fill-slate-900" strokeWidth="2" />
          <text x={94} y={41} textAnchor="middle" className="fill-rose-600 font-mono text-xs font-bold dark:fill-rose-400">2</text>
          <path d="M94 64 C94 82, 47 82, 47 68" fill="none" className="stroke-blue-500" strokeWidth="1.8" strokeLinecap="round" />
          <polyline points="43,72 47,67 51,72" fill="none" className="stroke-blue-500" strokeWidth="1.8" strokeLinecap="round" />
          <rect x={124} y={18} width={34} height={44} rx="4" className={sheetCls} strokeWidth="1.5" />
          <text x={141} y={44} textAnchor="middle" className="fill-slate-400 font-mono text-xs font-bold">3</text>
          <rect x={170} y={18} width={34} height={44} rx="4" className="fill-rose-50/70 stroke-rose-300 dark:fill-rose-950/40 dark:stroke-rose-800" strokeWidth="1.5" strokeDasharray="3 2" />
          <path d="M182 35 L192 45 M192 35 L182 45" className="stroke-rose-500" strokeWidth="2" strokeLinecap="round" />
        </>
      );

    case 'pdf-to-jpg':
      return (
        <>
          <MiniDoc x={32} y={24} w={42} h={52} label="PDF" />
          <Arrow x={86} y={50} len={26} />
          <g>
            <rect x={126} y={24} width={48} height={38} rx="5" className={sheetCls} strokeWidth="1.5" />
            <circle cx={140} cy={36} r="4" className="fill-amber-400" />
            <path d="M130 58 L143 44 L154 53 L161 47 L170 58 Z" className="fill-sky-500/80" />
            <rect x={152} y={40} width={52} height={40} rx="5" className={sheetCls} strokeWidth="1.5" />
            <circle cx={166} cy={52} r="4" className="fill-amber-400" />
            <path d="M156 76 L170 60 L182 70 L189 63 L200 76 Z" className="fill-sky-500" />
            <text x={178} y={34} textAnchor="middle" className="fill-sky-600 font-mono text-[8px] font-bold dark:fill-sky-400">JPG / PNG</text>
          </g>
        </>
      );

    case 'jpg-to-pdf':
      return (
        <>
          <rect x={28} y={22} width={48} height={38} rx="5" className={sheetCls} strokeWidth="1.5" />
          <circle cx={42} cy={34} r="3.5" className="fill-amber-400" />
          <path d="M32 56 L46 42 L56 50 L62 45 L72 56 Z" className="fill-sky-500/75" />
          <rect x={44} y={38} width={48} height={38} rx="5" className={sheetCls} strokeWidth="1.5" />
          <circle cx={58} cy={50} r="3.5" className="fill-amber-400" />
          <path d="M48 72 L62 58 L72 66 L78 61 L88 72 Z" className="fill-sky-500" />
          <Arrow x={104} y={50} len={26} />
          <MiniDoc x={144} y={20} w={46} h={60} label="PDF" badgeClass="fill-rose-600" />
        </>
      );

    case 'pdf-to-word':
      return (
        <>
          <MiniDoc x={38} y={22} w={46} h={56} label="PDF" badgeClass="fill-rose-600" />
          <Arrow x={98} y={50} len={30} />
          <MiniDoc x={142} y={22} w={48} h={56} label="DOC" badgeClass="fill-blue-600" />
          <line x1={174} y1={58} x2={174} y2={67} className="stroke-blue-500" strokeWidth="1.8" />
        </>
      );

    case 'word-to-pdf':
      return (
        <>
          <MiniDoc x={38} y={22} w={48} h={56} label="DOCX" badgeClass="fill-blue-600" />
          <Arrow x={100} y={50} len={28} />
          <MiniDoc x={142} y={22} w={46} h={56} label="PDF" badgeClass="fill-rose-600" />
        </>
      );

    case 'pdf-to-excel':
      return (
        <>
          <MiniDoc x={34} y={22} w={44} h={56} label="PDF" badgeClass="fill-rose-600" />
          <Arrow x={90} y={50} len={26} />
          <g>
            <rect x={128} y={22} width={76} height={56} rx="5" className={sheetCls} strokeWidth="1.5" />
            <rect x={128} y={22} width={76} height="14" rx="5" className="fill-emerald-600" />
            <text x={166} y={32} textAnchor="middle" className="fill-white font-mono text-[8px] font-bold">XLSX TABLE</text>
            <line x1={128} y1={48} x2={204} y2={48} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
            <line x1={128} y1={62} x2={204} y2={62} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
            <line x1={154} y1={36} x2={154} y2={78} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
            <line x1={180} y1={36} x2={180} y2={78} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
          </g>
        </>
      );

    case 'excel-to-pdf':
      return (
        <>
          <g>
            <rect x={28} y={22} width={70} height={56} rx="5" className={sheetCls} strokeWidth="1.5" />
            <rect x={28} y={22} width={70} height="14" rx="5" className="fill-emerald-600" />
            <text x={63} y={32} textAnchor="middle" className="fill-white font-mono text-[8px] font-bold">XLSX / CSV</text>
            <line x1={28} y1={49} x2={98} y2={49} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
            <line x1={28} y1={63} x2={98} y2={63} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
            <line x1={52} y1={36} x2={52} y2={78} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
            <line x1={76} y1={36} x2={76} y2={78} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
          </g>
          <Arrow x={108} y={50} len={24} />
          <MiniDoc x={144} y={22} w={46} h={56} label="PDF" badgeClass="fill-rose-600" />
        </>
      );

    case 'pdf-to-ppt':
      return (
        <>
          <MiniDoc x={32} y={22} w={42} h={56} label="PDF" badgeClass="fill-rose-600" />
          <Arrow x={86} y={50} len={24} />
          <rect x={122} y={24} width={86} height={52} rx="5" className={sheetCls} strokeWidth="1.5" />
          <rect x={122} y={24} width={86} height="13" rx="5" className="fill-orange-500" />
          <text x={165} y={33} textAnchor="middle" className="fill-white font-mono text-[7.5px] font-bold">16:9 SLIDES</text>
          <rect x={132} y={56} width="10" height="12" rx="1.5" className="fill-orange-400" />
          <rect x={146} y={48} width="10" height="20" rx="1.5" className="fill-orange-500" />
          <rect x={160} y={44} width="10" height="24" rx="1.5" className="fill-rose-500" />
          <rect x={176} y={46} width="24" height="3" rx="1.5" className={mutedLineCls} />
          <rect x={176} y={53} width="20" height="3" rx="1.5" className={mutedLineCls} />
          <rect x={176} y={60} width="22" height="3" rx="1.5" className={mutedLineCls} />
        </>
      );

    case 'html-to-pdf':
      return (
        <>
          <rect x={28} y={22} width={72} height={56} rx="5" className="fill-slate-900 stroke-slate-700" strokeWidth="1.5" />
          <text x={64} y={44} textAnchor="middle" className="fill-sky-400 font-mono text-[11px] font-bold">&lt;html/&gt;</text>
          <rect x={40} y={54} width="32" height="3" rx="1.5" className="fill-emerald-400/70" />
          <rect x={40} y={62} width="44" height="3" rx="1.5" className="fill-slate-600" />
          <Arrow x={110} y={50} len={24} />
          <MiniDoc x={146} y={22} w={46} h={56} label="PDF" badgeClass="fill-rose-600" />
        </>
      );

    case 'rotate-pdf':
      return (
        <>
          <MiniDoc x={38} y={20} w={40} h={58} label="0°" />
          <g fill="none" className="stroke-rose-500" strokeWidth="2" strokeLinecap="round">
            <path d="M96 42 A 16 16 0 0 1 124 44" />
            <polyline points="120,37 125,45 117,46" />
          </g>
          <text x={110} y={64} textAnchor="middle" className="fill-rose-600 font-mono text-[9px] font-bold dark:fill-rose-400">90°</text>
          <rect x={138} y={31} width={60} height={40} rx="5" className={sheetCls} strokeWidth="1.5" />
          <rect x={143} y={36} width="12" height="30" rx="2.5" className="fill-rose-500" />
          <rect x={160} y={38} width="30" height="3.5" rx="1.5" className={mutedLineCls} />
          <rect x={160} y={47} width="24" height="3.5" rx="1.5" className={mutedLineCls} />
          <rect x={160} y={56} width="28" height="3.5" rx="1.5" className={mutedLineCls} />
        </>
      );

    case 'watermark-pdf':
      return (
        <>
          <rect x={76} y={12} width={88} height={76} rx="6" className={sheetCls} strokeWidth="1.5" />
          <rect x={88} y={24} width="64" height="4" rx="2" className={mutedLineCls} />
          <rect x={88} y={34} width="52" height="4" rx="2" className={mutedLineCls} />
          <rect x={88} y={62} width="60" height="4" rx="2" className={mutedLineCls} />
          <rect x={88} y={72} width="44" height="4" rx="2" className={mutedLineCls} />
          <g transform="rotate(-22 120 50)">
            <rect x={78} y={40} width={84} height={20} rx="3" className="fill-rose-500/15 stroke-rose-500/70" strokeWidth="1.2" />
            <text x={120} y={53} textAnchor="middle" className="fill-rose-600 font-mono text-[8.5px] font-bold tracking-wider dark:fill-rose-400">
              CONFIDENTIAL
            </text>
          </g>
        </>
      );

    case 'page-numbers-pdf':
      return (
        <>
          <rect x={44} y={18} width={62} height={66} rx="5" className={sheetCls} strokeWidth="1.5" />
          <rect x={54} y={28} width="42" height="3.5" rx="1.5" className={mutedLineCls} />
          <rect x={54} y={37} width="36" height="3.5" rx="1.5" className={mutedLineCls} />
          <rect x={54} y={46} width="40" height="3.5" rx="1.5" className={mutedLineCls} />
          <rect x={84} y={67} width="16" height="12" rx="3" className="fill-rose-600" />
          <text x={92} y={76} textAnchor="middle" className="fill-white font-mono text-[8px] font-bold">01</text>

          <rect x={126} y={18} width={62} height={66} rx="5" className={sheetCls} strokeWidth="1.5" />
          <rect x={136} y={28} width="42" height="3.5" rx="1.5" className={mutedLineCls} />
          <rect x={136} y={37} width="36" height="3.5" rx="1.5" className={mutedLineCls} />
          <rect x={136} y={46} width="40" height="3.5" rx="1.5" className={mutedLineCls} />
          <rect x={166} y={67} width="16" height="12" rx="3" className="fill-rose-600" />
          <text x={174} y={76} textAnchor="middle" className="fill-white font-mono text-[8px] font-bold">02</text>
        </>
      );

    case 'sign-pdf':
      return (
        <>
          <rect x={58} y={12} width={124} height={76} rx="6" className={sheetCls} strokeWidth="1.5" />
          <rect x={72} y={24} width="76" height="3.5" rx="1.5" className={mutedLineCls} />
          <rect x={72} y={33} width="94" height="3.5" rx="1.5" className={mutedLineCls} />
          <line x1={72} y1={72} x2={166} y2={72} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.2" />
          <path
            d="M78 66 C86 44, 96 74, 108 56 C116 44, 122 68, 134 58 C142 52, 148 64, 158 55"
            fill="none"
            className="stroke-blue-600 dark:stroke-blue-400"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx={162} cy={51} r="3" className="fill-rose-500" />
        </>
      );

    case 'redact-crop-pdf':
      return (
        <>
          <rect x={68} y={14} width={104} height={72} rx="5" className={sheetCls} strokeWidth="1.5" />
          {/* Crop corner guides */}
          <path d="M62 24 V10 H76 M164 10 H178 V24 M178 76 V90 H164 M76 90 H62 V76" fill="none" className="stroke-rose-500" strokeWidth="2" strokeLinecap="round" />
          <rect x={80} y={26} width="78" height="4" rx="1.5" className={mutedLineCls} />
          <rect x={80} y={37} width="54" height="8" rx="1.5" className="fill-slate-950 dark:fill-slate-100" />
          <rect x={80} y={51} width="72" height="4" rx="1.5" className={mutedLineCls} />
          <rect x={80} y={61} width="64" height="8" rx="1.5" className="fill-slate-950 dark:fill-slate-100" />
        </>
      );

    case 'pdf-reader-compare':
      return (
        <>
          <rect x={34} y={16} width={68} height={68} rx="5" className={sheetCls} strokeWidth="1.5" />
          <text x={44} y={29} className="fill-slate-400 font-mono text-[8px] font-bold">VER A</text>
          <rect x={44} y={37} width="46" height="4" rx="1.5" className={mutedLineCls} />
          <rect x={44} y={47} width="48" height="6" rx="1.5" className="fill-rose-500/30 stroke-rose-500/70" strokeWidth="1" />
          <rect x={44} y={59} width="40" height="4" rx="1.5" className={mutedLineCls} />

          <rect x={138} y={16} width={68} height={68} rx="5" className={sheetCls} strokeWidth="1.5" />
          <text x={148} y={29} className="fill-slate-400 font-mono text-[8px] font-bold">VER B</text>
          <rect x={148} y={37} width="46" height="4" rx="1.5" className={mutedLineCls} />
          <rect x={148} y={47} width="48" height="6" rx="1.5" className="fill-emerald-500/30 stroke-emerald-500/80" strokeWidth="1" />
          <rect x={148} y={59} width="40" height="4" rx="1.5" className={mutedLineCls} />

          <text x={120} y={54} textAnchor="middle" className="fill-blue-500 font-mono text-xs font-bold">⇄</text>
        </>
      );

    case 'repair-unlock-pdf':
      return (
        <>
          <MiniDoc x={38} y={22} w={44} h={56} label="LOCKED" badgeClass="fill-amber-600" />
          <Arrow x={94} y={50} len={30} />
          <MiniDoc x={138} y={22} w={48} h={56} label="CLEAN" badgeClass="fill-emerald-600" />
          <circle cx={186} cy={72} r="10" className="fill-emerald-600" />
          <polyline points="181,72 184.5,75.5 191,69" fill="none" className="stroke-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    /* ==================== IMAGE SUITE (8) ==================== */
    case 'image-compressor':
      return (
        <>
          <rect x={24} y={18} width={62} height={60} rx="6" className={sheetCls} strokeWidth="1.5" />
          <circle cx={42} cy={35} r="5" className="fill-amber-400" />
          <path d="M30 66 L48 46 L62 58 L70 50 L80 66 Z" className="fill-sky-500/80" />
          <text x={55} y={90} textAnchor="middle" className="fill-slate-500 font-mono text-[8.5px]">4.2 MB</text>
          <Arrow x={98} y={48} len={28} />
          <rect x={140} y={26} width={50} height={46} rx="6" className={sheetCls} strokeWidth="1.5" />
          <circle cx={154} cy={39} r="4" className="fill-amber-400" />
          <path d="M145 64 L158 50 L169 59 L176 53 L185 64 Z" className="fill-sky-500" />
          <text x={165} y={88} textAnchor="middle" className="fill-emerald-600 font-mono text-[8.5px] font-bold dark:fill-emerald-400">640 KB</text>
        </>
      );

    case 'image-resizer':
      return (
        <>
          <rect x={44} y={14} width={152} height={72} rx="6" className="fill-none stroke-slate-300 dark:stroke-slate-700" strokeWidth="1.5" strokeDasharray="5 4" />
          <rect x={54} y={24} width={96} height={52} rx="5" className={sheetCls} strokeWidth="2" />
          <circle cx={74} cy={40} r="5" className="fill-amber-400" />
          <path d="M60 70 L82 48 L100 62 L114 50 L144 70 Z" className="fill-sky-500" />
          {/* Resize handles */}
          <rect x={146} y={72} width="8" height="8" rx="1.5" className="fill-sky-500" />
          <text x={172} y={45} textAnchor="middle" className="fill-slate-400 font-mono text-[8px]">W × H</text>
          <text x={172} y={58} textAnchor="middle" className="fill-sky-600 font-mono text-[8px] font-bold dark:fill-sky-400">800×450</text>
        </>
      );

    case 'background-remover':
      return (
        <>
          {/* Left half: solid busy backdrop */}
          <rect x={52} y={14} width={68} height={72} rx="6" className="fill-slate-800 dark:fill-slate-700" />
          {/* Right half: checkerboard transparency */}
          <rect x={120} y={14} width={68} height={72} rx="6" className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-700" strokeWidth="1" />
          {[0, 1, 2, 3, 4].map((r) =>
            [0, 1, 2, 3, 4].map((c) =>
              (r + c) % 2 === 0 ? (
                <rect
                  key={`${r}-${c}`}
                  x={122 + c * 13}
                  y={16 + r * 13.5}
                  width="12"
                  height="12.5"
                  className="fill-slate-200 dark:fill-slate-800"
                />
              ) : null
            )
          )}
          {/* Foreground portrait silhouette crossing split */}
          <circle cx={120} cy={39} r="13" className="fill-sky-500" />
          <path d="M96 82 C96 62, 144 62, 144 82 Z" className="fill-sky-600" />
          {/* Split divider */}
          <line x1={120} y1={10} x2={120} y2={90} className="stroke-white dark:stroke-sky-400" strokeWidth="2" />
        </>
      );

    case 'passport-photo-maker':
      return (
        <>
          {/* Biometric frame */}
          <rect x={30} y={16} width={58} height={68} rx="5" className={sheetCls} strokeWidth="1.5" />
          <ellipse cx={59} cy={43} rx="14" ry="18" className="fill-none stroke-sky-500" strokeWidth="1.4" strokeDasharray="3 2" />
          <circle cx={59} cy={41} r="8" className="fill-slate-700 dark:fill-slate-300" />
          <path d="M43 76 C43 61, 75 61, 75 76 Z" className="fill-slate-700 dark:fill-slate-300" />
          <Arrow x={98} y={50} len={22} />
          {/* 4x6 tiled print sheet */}
          <rect x={130} y={18} width={82} height={64} rx="5" className={sheetCls} strokeWidth="1.5" />
          {[0, 1].map((row) =>
            [0, 1].map((col) => (
              <g key={`${row}-${col}`} transform={`translate(${138 + col * 36}, ${24 + row * 28})`}>
                <rect width="30" height="23" rx="2.5" className="fill-sky-50 stroke-sky-300 dark:fill-sky-950/60 dark:stroke-sky-700" strokeWidth="1" />
                <circle cx="15" cy="9" r="3.5" className="fill-sky-600 dark:fill-sky-400" />
                <path d="M8 21 C8 15, 22 15, 22 21 Z" className="fill-sky-600 dark:fill-sky-400" />
              </g>
            ))
          )}
        </>
      );

    case 'image-crop-rotate':
      return (
        <>
          <rect x={68} y={18} width={104} height={64} rx="5" className={sheetCls} strokeWidth="1.5" />
          <path d="M78 72 L102 46 L124 62 L138 50 L162 72 Z" className="fill-sky-500/75" />
          <rect x={86} y={26} width={68} height={46} className="fill-none stroke-sky-500" strokeWidth="1.8" strokeDasharray="4 3" />
          <path d="M82 34 V22 H94 M146 22 H158 V34 M158 64 V76 H146 M94 76 H82 V64" fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth="2.2" />
        </>
      );

    case 'jpg-to-png':
      return (
        <>
          <MiniDoc x={36} y={22} w={48} h={56} label="JPG" badgeClass="fill-amber-500" />
          <Arrow x={96} y={50} len={28} />
          <MiniDoc x={138} y={22} w={50} h={56} label="PNG" badgeClass="fill-sky-600" />
        </>
      );

    case 'png-to-jpg':
      return (
        <>
          <MiniDoc x={36} y={22} w={48} h={56} label="PNG" badgeClass="fill-sky-600" />
          <Arrow x={96} y={50} len={28} />
          <MiniDoc x={138} y={22} w={50} h={56} label="JPG" badgeClass="fill-amber-500" />
        </>
      );

    case 'webp-converter':
      return (
        <>
          <MiniDoc x={34} y={22} w={48} h={56} label="PNG/JPG" badgeClass="fill-slate-600" />
          <Arrow x={94} y={50} len={28} />
          <MiniDoc x={136} y={22} w={54} h={56} label="WEBP" badgeClass="fill-sky-600" />
        </>
      );

    /* ==================== VIDEO SUITE (5) ==================== */
    case 'video-compressor':
      return (
        <>
          <rect x={24} y={20} width={68} height={54} rx="6" className={sheetCls} strokeWidth="1.5" />
          <polygon points="52,37 52,57 68,47" className="fill-indigo-500" />
          <text x={58} y={88} textAnchor="middle" className="fill-slate-500 font-mono text-[8.5px]">48 MB</text>
          <Arrow x={102} y={48} len={26} />
          <rect x={140} y={28} width={54} height={40} rx="6" className={sheetCls} strokeWidth="1.5" />
          <polygon points="162,41 162,55 174,48" className="fill-emerald-500" />
          <text x={167} y={88} textAnchor="middle" className="fill-emerald-600 font-mono text-[8.5px] font-bold dark:fill-emerald-400">9 MB</text>
        </>
      );

    case 'video-trimmer':
      return (
        <>
          {/* Full filmstrip track */}
          <rect x={24} y={32} width={192} height={36} rx="6" className="fill-slate-200 dark:fill-slate-800" />
          {/* Active kept clip */}
          <rect x={68} y={30} width={104} height={40} rx="5" className="fill-indigo-500/20 stroke-indigo-500" strokeWidth="2.2" />
          <rect x={64} y={28} width="8" height="44" rx="3" className="fill-indigo-600" />
          <rect x={168} y={28} width="8" height="44" rx="3" className="fill-indigo-600" />
          <text x={68} y={84} textAnchor="middle" className="fill-indigo-600 font-mono text-[8.5px] font-bold dark:fill-indigo-400">0:04</text>
          <text x={172} y={84} textAnchor="middle" className="fill-indigo-600 font-mono text-[8.5px] font-bold dark:fill-indigo-400">0:18</text>
        </>
      );

    case 'video-to-gif':
      return (
        <>
          <rect x={24} y={24} width={60} height={48} rx="6" className={sheetCls} strokeWidth="1.5" />
          <polygon points="48,39 48,57 63,48" className="fill-indigo-500" />
          <text x={54} y={86} textAnchor="middle" className="fill-slate-500 font-mono text-[8px] font-bold">MP4</text>
          <Arrow x={94} y={48} len={22} />
          <rect x={126} y={22} width={34} height={32} rx="4" className={sheetCls} strokeWidth="1.5" />
          <rect x={148} y={32} width={34} height={32} rx="4" className={sheetCls} strokeWidth="1.5" />
          <rect x={170} y={42} width={38} height={34} rx="4" className="fill-indigo-600" />
          <text x={189} y={63} textAnchor="middle" className="fill-white font-mono text-[10px] font-bold">GIF</text>
        </>
      );

    case 'video-to-mp3':
      return (
        <>
          <rect x={26} y={24} width={60} height={48} rx="6" className={sheetCls} strokeWidth="1.5" />
          <polygon points="50,39 50,57 65,48" className="fill-indigo-500" />
          <Arrow x={96} y={48} len={22} />
          {/* Audio waveform bars */}
          <g className="fill-emerald-500">
            {[16, 30, 44, 24, 50, 36, 20, 40, 26, 14].map((h, i) => (
              <rect key={i} x={130 + i * 8} y={50 - h / 2} width="4.5" height={h} rx="2" />
            ))}
          </g>
        </>
      );

    case 'audio-to-video':
      return (
        <>
          <g className="fill-emerald-500">
            {[14, 28, 40, 22, 34, 18].map((h, i) => (
              <rect key={i} x={28 + i * 8} y={50 - h / 2} width="4.5" height={h} rx="2" />
            ))}
          </g>
          <Arrow x={86} y={50} len={22} />
          <rect x={120} y={20} width={92} height={60} rx="6" className="fill-slate-900 stroke-indigo-500/70" strokeWidth="1.5" />
          <g className="fill-indigo-400">
            {[10, 22, 34, 26, 40, 30, 18, 28, 16].map((h, i) => (
              <rect key={i} x={132 + i * 8} y={50 - h / 2} width="4" height={h} rx="2" />
            ))}
          </g>
          <text x={166} y={74} textAnchor="middle" className="fill-slate-400 font-mono text-[7px]">16:9 WEBM</text>
        </>
      );

    /* ==================== AUDIO SUITE (4) ==================== */
    case 'audio-trimmer':
      return (
        <>
          {[14, 24, 18, 34, 46, 28, 52, 42, 30, 44, 22, 36, 18, 26, 12].map((h, i) => {
            const active = i >= 4 && i <= 10;
            return (
              <rect
                key={i}
                x={32 + i * 12}
                y={50 - h / 2}
                width="6"
                height={h}
                rx="3"
                className={active ? 'fill-emerald-500' : 'fill-slate-300 dark:fill-slate-700'}
              />
            );
          })}
          <line x1={76} y1={16} x2={76} y2={84} className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth="2" />
          <line x1={162} y1={16} x2={162} y2={84} className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth="2" />
        </>
      );

    case 'audio-volume-booster':
      return (
        <>
          {[8, 12, 10, 14, 10].map((h, i) => (
            <rect key={i} x={28 + i * 9} y={50 - h / 2} width="5" height={h} rx="2.5" className="fill-slate-400" />
          ))}
          <text x={108} y={40} textAnchor="middle" className="fill-emerald-600 font-mono text-[10px] font-bold dark:fill-emerald-400">
            +18 dB
          </text>
          <Arrow x={88} y={54} len={36} />
          {[22, 42, 34, 58, 46, 30, 52].map((h, i) => (
            <rect key={i} x={138 + i * 10} y={50 - h / 2} width="6" height={h} rx="3" className="fill-emerald-500" />
          ))}
        </>
      );

    case 'audio-converter':
      return (
        <>
          <rect x={24} y={24} width={54} height={22} rx="4" className={sheetCls} strokeWidth="1.5" />
          <text x={51} y={38} textAnchor="middle" className="fill-emerald-600 font-mono text-[8px] font-bold dark:fill-emerald-400">TRACK A</text>
          <rect x={24} y={54} width={54} height={22} rx="4" className={sheetCls} strokeWidth="1.5" />
          <text x={51} y={68} textAnchor="middle" className="fill-blue-600 font-mono text-[8px] font-bold dark:fill-blue-400">TRACK B</text>
          <Arrow x={88} y={50} len={26} />
          <rect x={126} y={34} width={88} height={32} rx="5" className="fill-emerald-600" />
          <text x={170} y={53} textAnchor="middle" className="fill-white font-mono text-[9px] font-bold">MERGED WAV</text>
        </>
      );

    case 'text-to-speech':
      return (
        <>
          <rect x={28} y={24} width={72} height={52} rx="6" className={sheetCls} strokeWidth="1.5" />
          <text x={64} y={46} textAnchor="middle" className="fill-slate-700 font-display text-xs font-bold dark:fill-slate-200">&ldquo;Hello&rdquo;</text>
          <rect x={40} y={56} width="48" height="3.5" rx="1.5" className={mutedLineCls} />
          <Arrow x={108} y={50} len={22} />
          <g fill="none" className="stroke-emerald-500" strokeWidth="2.4" strokeLinecap="round">
            <circle cx={154} cy={50} r="8" className="fill-emerald-500 stroke-none" />
            <path d="M168 38 A 18 18 0 0 1 168 62" />
            <path d="M179 30 A 30 30 0 0 1 179 70" />
            <path d="M190 23 A 40 40 0 0 1 190 77" opacity="0.55" />
          </g>
        </>
      );

    /* ==================== TEXT, DEV & PRODUCTIVITY (7) ==================== */
    case 'word-counter':
      return (
        <>
          <rect x={26} y={20} width={86} height={60} rx="5" className={sheetCls} strokeWidth="1.5" />
          <rect x={36} y={32} width="64" height="4" rx="2" className={mutedLineCls} />
          <rect x={36} y={44} width="54" height="4" rx="2" className={mutedLineCls} />
          <rect x={36} y={56} width="60" height="4" rx="2" className={mutedLineCls} />
          <rect x={126} y={20} width={88} height={26} rx="5" className="fill-amber-500/15 stroke-amber-500/60" strokeWidth="1.2" />
          <text x={170} y={37} textAnchor="middle" className="fill-amber-700 font-mono text-[10px] font-bold dark:fill-amber-400">248 WORDS</text>
          <rect x={126} y={54} width={88} height={26} rx="5" className={sheetCls} strokeWidth="1.5" />
          <text x={170} y={71} textAnchor="middle" className="fill-slate-600 font-mono text-[9.5px] font-semibold dark:fill-slate-300">1,420 CHARS</text>
        </>
      );

    case 'case-converter':
      return (
        <>
          <rect x={24} y={34} width={76} height={32} rx="5" className={sheetCls} strokeWidth="1.5" />
          <text x={62} y={54} textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">hello world</text>
          <Arrow x={108} y={50} len={20} />
          <rect x={136} y={18} width={80} height={20} rx="4" className="fill-amber-500/15 stroke-amber-500/60" strokeWidth="1.2" />
          <text x={176} y={31} textAnchor="middle" className="fill-amber-700 font-mono text-[9px] font-bold dark:fill-amber-400">camelCase</text>
          <rect x={136} y={42} width={80} height={20} rx="4" className={sheetCls} strokeWidth="1.2" />
          <text x={176} y={55} textAnchor="middle" className="fill-slate-700 font-mono text-[9px] font-semibold dark:fill-slate-200">SNAKE_CASE</text>
          <rect x={136} y={66} width={80} height={20} rx="4" className={sheetCls} strokeWidth="1.2" />
          <text x={176} y={79} textAnchor="middle" className="fill-slate-700 font-mono text-[9px] font-semibold dark:fill-slate-200">Title Case</text>
        </>
      );

    case 'json-formatter':
      return (
        <>
          <rect x={24} y={24} width={74} height={52} rx="5" className="fill-slate-900 stroke-slate-700" strokeWidth="1.5" />
          <text x={61} y={53} textAnchor="middle" className="fill-slate-400 font-mono text-[9px]">{'{"a":1,"b":2}'}</text>
          <Arrow x={106} y={50} len={20} />
          <rect x={134} y={16} width={82} height={68} rx="5" className="fill-slate-900 stroke-violet-500/70" strokeWidth="1.5" />
          <text x={144} y={33} className="fill-slate-400 font-mono text-[8.5px]">{'{'}</text>
          <text x={152} y={46} className="fill-violet-400 font-mono text-[8.5px]">&quot;a&quot;: <tspan className="fill-emerald-400">1</tspan>,</text>
          <text x={152} y={59} className="fill-violet-400 font-mono text-[8.5px]">&quot;b&quot;: <tspan className="fill-emerald-400">2</tspan></text>
          <text x={144} y={72} className="fill-slate-400 font-mono text-[8.5px]">{'}'}</text>
        </>
      );

    case 'base64-codec':
      return (
        <>
          <rect x={26} y={28} width={68} height={44} rx="5" className={sheetCls} strokeWidth="1.5" />
          <text x={60} y={54} textAnchor="middle" className="fill-slate-800 font-mono text-xs font-bold dark:fill-white">ABC</text>
          <text x={118} y={55} textAnchor="middle" className="fill-violet-500 font-mono text-base font-bold">⇄</text>
          <rect x={142} y={28} width={74} height={44} rx="5" className="fill-slate-900 stroke-violet-500/70" strokeWidth="1.5" />
          <text x={179} y={54} textAnchor="middle" className="fill-violet-400 font-mono text-xs font-bold">QUJD</text>
        </>
      );

    case 'uuid-hash-generator':
      return (
        <>
          <rect x={28} y={20} width={184} height={26} rx="5" className="fill-slate-900 stroke-violet-500/60" strokeWidth="1.3" />
          <text x={120} y={37} textAnchor="middle" className="fill-violet-400 font-mono text-[9px] font-semibold">
            550e8400-e29b-41d4-a716
          </text>
          <rect x={28} y={54} width={184} height={26} rx="5" className={sheetCls} strokeWidth="1.5" />
          <text x={120} y={71} textAnchor="middle" className="fill-emerald-600 font-mono text-[8.5px] font-bold dark:fill-emerald-400">
            SHA-256 · 9f86d081884c7d65
          </text>
        </>
      );

    case 'qr-code-generator':
      return (
        <>
          <rect x={24} y={34} width={76} height={32} rx="5" className={sheetCls} strokeWidth="1.5" />
          <text x={62} y={54} textAnchor="middle" className="fill-blue-600 font-mono text-[9px] font-semibold dark:fill-blue-400">https://...</text>
          <Arrow x={108} y={50} len={22} />
          <rect x={142} y={18} width={64} height={64} rx="6" className="fill-white stroke-slate-300 dark:stroke-slate-700" strokeWidth="1.5" />
          {/* Crisp QR finder patterns */}
          <rect x={150} y={26} width="14" height="14" rx="2" className="fill-none stroke-slate-950" strokeWidth="3" />
          <rect x={155} y={31} width="4" height="4" className="fill-slate-950" />
          <rect x={184} y={26} width="14" height="14" rx="2" className="fill-none stroke-slate-950" strokeWidth="3" />
          <rect x={189} y={31} width="4" height="4" className="fill-slate-950" />
          <rect x={150} y={60} width="14" height="14" rx="2" className="fill-none stroke-slate-950" strokeWidth="3" />
          <rect x={155} y={65} width="4" height="4" className="fill-slate-950" />
          <rect x={170} y={46} width="6" height="6" className="fill-blue-600" />
          <rect x={180} y={52} width="6" height="6" className="fill-slate-950" />
          <rect x={190} y={62} width="8" height="8" className="fill-slate-950" />
          <rect x={172} y={64} width="6" height="8" className="fill-slate-950" />
        </>
      );

    case 'password-generator':
    default:
      return (
        <>
          <rect x={32} y={22} width={176} height={36} rx="6" className="fill-slate-900 stroke-blue-500/70" strokeWidth="1.5" />
          <text x={120} y={45} textAnchor="middle" className="fill-white font-mono text-sm font-bold tracking-widest">
            K9#m!2xQ@7
          </text>
          <rect x={32} y={68} width={176} height={8} rx="4" className="fill-slate-200 dark:fill-slate-800" />
          <rect x={32} y={68} width={160} height={8} rx="4" className="fill-emerald-500" />
        </>
      );
  }
}

export const ToolVisual: React.FC<ToolVisualProps> = ({ slug, category, variant = 'card' }) => {
  const accent = ACCENT_SURFACE[category];
  const flowLabel = TOOL_FLOW_LABEL[slug];

  if (variant === 'banner') {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-slate-200/90 px-3 py-2 dark:border-slate-800 ${accent.bg}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 240 100"
          className="h-20 w-48 sm:h-24 sm:w-56"
          role="img"
          aria-label={flowLabel || slug}
        >
          {renderToolSchematic(slug)}
        </svg>
        {flowLabel && (
          <p className={`mt-0.5 text-center font-mono text-[10px] font-semibold ${accent.stroke}`}>
            {flowLabel}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-slate-200/80 transition-colors duration-150 dark:border-slate-800/80 ${accent.bg} ${accent.highlight}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 240 100"
        className="mx-auto h-16 w-full max-w-[240px] transition-transform duration-200 ease-out group-hover:scale-[1.03] sm:h-20 lg:h-24"
      >
        {renderToolSchematic(slug)}
      </svg>
      {flowLabel && (
        <div className="truncate border-t border-slate-200/75 bg-white/85 px-2 py-0.5 text-center font-mono text-[9.5px] font-medium text-slate-600 sm:px-2.5 sm:py-1 sm:text-[10px] dark:border-slate-800/70 dark:bg-slate-950/55 dark:text-slate-400">
          {flowLabel}
        </div>
      )}
    </div>
  );
};
