import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, RefreshCw } from 'lucide-react';
import { FileDropzone, formatBytes, triggerDownload, type ToolComponentProps } from '../types';

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeysDeep(v)]));
  }
  return value;
}

const SAMPLE_JSON = JSON.stringify(
  {
    platform: 'Toolivo',
    tagline: 'Every Tool You Need. One Click Away.',
    currency: 'USD',
    processing: 'browser-first',
    plans: [
      { id: 'free', monthlyUsd: 0 },
      { id: 'plus', monthlyUsd: 2.99 },
      { id: 'pro', monthlyUsd: 5.99 },
      { id: 'business', monthlyUsd: 14.99 },
    ],
  },
  null,
  2
);

export const JsonFormatterTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [input, setInput] = useState(SAMPLE_JSON);
  const [indent, setIndent] = useState<2 | 4 | 0>(2);
  const [sortKeys, setSortKeys] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    if (!input.trim()) return { ok: true as const, output: '', keys: 0 };
    try {
      const obj = JSON.parse(input);
      const prepared = sortKeys ? sortKeysDeep(obj) : obj;
      const output = indent === 0 ? JSON.stringify(prepared) : JSON.stringify(prepared, null, indent);
      const countKeys = (v: unknown): number => {
        if (Array.isArray(v)) return v.reduce((s, x) => s + countKeys(x), 0);
        if (v && typeof v === 'object') {
          return Object.values(v).reduce((s, x) => s + 1 + countKeys(x), 0);
        }
        return 0;
      };
      return { ok: true as const, output, keys: countKeys(obj) };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Invalid JSON syntax.',
      };
    }
  }, [input, indent, sortKeys]);

  const handleCopy = async () => {
    if (!parsed.ok || !parsed.output) return;
    await navigator.clipboard.writeText(parsed.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onComplete?.({
      inputSummary: `${formatBytes(new Blob([input]).size)} JSON`,
      outputSummary: `${indent === 0 ? 'Minified' : `${indent}-space formatted`} (${parsed.keys} keys)`,
      processingMs: 1,
    });
  };

  const handleDownload = () => {
    if (!parsed.ok || !parsed.output) return;
    const blob = new Blob([parsed.output], { type: 'application/json' });
    triggerDownload(blob, 'formatted.json');
    onComplete?.({
      inputSummary: `${formatBytes(new Blob([input]).size)} JSON`,
      outputSummary: `Downloaded formatted.json (${formatBytes(blob.size)})`,
      processingMs: 1,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {([
              { label: '2 Spaces', val: 2 },
              { label: '4 Spaces', val: 4 },
              { label: 'Minify', val: 0 },
            ] as const).map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setIndent(opt.val)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  indent === opt.val
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={sortKeys}
              onChange={(e) => setSortKeys(e.target.checked)}
              className="accent-blue-600"
            />
            Sort keys A–Z
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInput(SAMPLE_JSON)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Load Sample
          </button>
          <button
            type="button"
            disabled={!parsed.ok || !parsed.output}
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            disabled={!parsed.ok || !parsed.output}
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export .json
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Input JSON
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            rows={14}
            className="w-full rounded-xl border border-slate-200 bg-white p-3.5 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400">Validated Output</span>
            {parsed.ok ? (
              <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                Valid JSON · {parsed.keys} keys
              </span>
            ) : (
              <span className="font-medium text-red-600 dark:text-red-400">Syntax Error</span>
            )}
          </div>
          {parsed.ok ? (
            <pre className="h-[312px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
              {parsed.output}
            </pre>
          ) : (
            <div className="h-[312px] rounded-xl border border-red-200 bg-red-50 p-4 font-mono text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {parsed.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Base64CodecTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [urlSafe, setUrlSafe] = useState(false);
  const [input, setInput] = useState('Toolivo — Every Tool You Need. One Click Away.');
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    try {
      if (mode === 'encode') {
        const bytes = new TextEncoder().encode(input);
        let bin = '';
        bytes.forEach((b) => {
          bin += String.fromCharCode(b);
        });
        let b64 = btoa(bin);
        if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return { ok: true as const, value: b64 };
      } else {
        let cleaned = input.trim().replace(/\s+/g, '');
        if (urlSafe) {
          cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
          while (cleaned.length % 4) cleaned += '=';
        }
        const bin = atob(cleaned);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        return { ok: true as const, value: new TextDecoder().decode(bytes) };
      }
    } catch {
      return { ok: false as const, error: 'Input is not valid Base64 data.' };
    }
  }, [input, mode, urlSafe]);

  const handleFileDrop = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMode('encode');
        setInput(reader.result);
      }
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setMode('encode')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              mode === 'encode'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Encode to Base64
          </button>
          <button
            type="button"
            onClick={() => setMode('decode')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              mode === 'decode'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Decode Base64
          </button>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} className="accent-blue-600" />
          URL-safe Base64 (RFC 4648)
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={8}
          placeholder={mode === 'encode' ? 'Enter UTF-8 text...' : 'Paste Base64 string...'}
          className="w-full rounded-xl border border-slate-200 bg-white p-3.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <div className="flex flex-col">
          <textarea
            readOnly
            value={result.ok ? result.value : result.error}
            rows={8}
            className={`w-full rounded-xl border p-3.5 font-mono text-xs focus:outline-none ${
              result.ok
                ? 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
            }`}
          />
          {result.ok && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.value);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                  onComplete?.({
                    inputSummary: `${mode} (${input.length} chars)`,
                    outputSummary: `${result.value.length} chars copied`,
                    processingMs: 1,
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Output'}
              </button>
            </div>
          )}
        </div>
      </div>

      <FileDropzone
        accept="*/*"
        label="Or drop any small file to convert directly to a Base64 Data URI"
        hint="Runs locally via FileReader"
        onFiles={handleFileDrop}
      />
    </div>
  );
};

export const UuidHashGeneratorTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [tab, setTab] = useState<'uuid' | 'hash'>('uuid');
  const [count, setCount] = useState(5);
  const [uuids, setUuids] = useState<string[]>(() => Array.from({ length: 5 }, () => crypto.randomUUID()));
  const [hashInput, setHashInput] = useState('toolivo.com');
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const compute = async () => {
      const data = new TextEncoder().encode(hashInput);
      const algos = ['SHA-256', 'SHA-384', 'SHA-512'] as const;
      const entries: Record<string, string> = {};
      for (const algo of algos) {
        const digest = await crypto.subtle.digest(algo, data);
        entries[algo] = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
      if (active) setHashes(entries);
    };
    void compute();
    return () => {
      active = false;
    };
  }, [hashInput]);

  const regenerateUuids = (n = count) => {
    const safeN = Math.max(1, Math.min(100, n));
    const list = Array.from({ length: safeN }, () => crypto.randomUUID());
    setUuids(list);
    onComplete?.({
      inputSummary: `UUID v4 batch (${safeN})`,
      outputSummary: `Generated ${safeN} CSPRNG UUIDs`,
      processingMs: 1,
    });
  };

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1400);
  };

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setTab('uuid')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${
            tab === 'uuid'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          UUID v4 Batch Generator
        </button>
        <button
          type="button"
          onClick={() => setTab('hash')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${
            tab === 'hash'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          SHA-256 / SHA-512 Hash
        </button>
      </div>

      {tab === 'uuid' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Quantity:</label>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
              className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="button"
              onClick={() => regenerateUuids(count)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Generate
            </button>
            <button
              type="button"
              onClick={() => copyText(uuids.join('\n'), 'all')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copiedKey === 'all' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedKey === 'all' ? 'Copied All' : 'Copy All'}
            </button>
          </div>
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
            {uuids.map((id) => (
              <div key={id} className="flex items-center justify-between py-0.5">
                <span>{id}</span>
                <button
                  type="button"
                  onClick={() => copyText(id, id)}
                  className="text-slate-400 hover:text-blue-600"
                >
                  {copiedKey === id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <textarea
            value={hashInput}
            onChange={(e) => setHashInput(e.target.value)}
            rows={4}
            placeholder="Enter text to hash..."
            className="w-full rounded-xl border border-slate-200 bg-white p-3.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="space-y-3">
            {Object.entries(hashes).map(([algo, digest]) => (
              <div key={algo} className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{algo}</span>
                  <button
                    type="button"
                    onClick={() => copyText(digest, algo)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    {copiedKey === algo ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === algo ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-1.5 break-all font-mono text-xs text-slate-600 dark:text-slate-400">
                  {digest}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const WordCounterTool: React.FC<ToolComponentProps> = () => {
  const [text, setText] = useState(
    'Toolivo provides fast, browser-first online utilities for video, images, PDFs, audio, text, and developer workflows. Every calculation happens directly on your device for instant results and file privacy.'
  );

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const chars = text.length;
    const charsNoSpace = text.replace(/\s/g, '').length;
    const sentences = trimmed ? trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0).length : 0;
    const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length : 0;
    const readMin = Math.max(1, Math.ceil(words.length / 225));
    const speakMin = Math.max(1, Math.ceil(words.length / 135));

    const freq = new Map<string, number>();
    for (const w of words) {
      const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length >= 4) {
        freq.set(clean, (freq.get(clean) || 0) + 1);
      }
    }
    const topKeywords = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return { words: words.length, chars, charsNoSpace, sentences, paragraphs, readMin, speakMin, topKeywords };
  }, [text]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Words', value: stats.words },
          { label: 'Characters', value: stats.chars },
          { label: 'Sentences', value: stats.sentences },
          { label: 'Read time', value: `${stats.readMin} min` },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste or type your text here..."
        className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />

      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-mono tabular-nums">
          No spaces: {stats.charsNoSpace} · Paragraphs: {stats.paragraphs} · Speaking time: ~{stats.speakMin} min
        </span>
        {stats.topKeywords.length > 0 && (
          <span>
            Top terms:{' '}
            {stats.topKeywords.map(([k, v], i) => (
              <span key={k} className="font-mono text-slate-800 dark:text-slate-200">
                {i > 0 ? ', ' : ''}
                {k} ({v})
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
};

export const CaseConverterTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [text, setText] = useState('free online utilities\nimage compressor\nfree online utilities\nmerge pdf online');
  const [copied, setCopied] = useState(false);

  const transform = (fn: (s: string) => string, actionName: string) => {
    const next = fn(text);
    setText(next);
    onComplete?.({
      inputSummary: `${text.length} chars`,
      outputSummary: `${actionName} (${next.length} chars)`,
      processingMs: 1,
    });
  };

  const actions = [
    {
      label: 'Title Case',
      fn: (s: string) => s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
    },
    { label: 'UPPERCASE', fn: (s: string) => s.toUpperCase() },
    { label: 'lowercase', fn: (s: string) => s.toLowerCase() },
    {
      label: 'camelCase',
      fn: (s: string) =>
        s
          .split('\n')
          .map((line) =>
            line
              .toLowerCase()
              .replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
          )
          .join('\n'),
    },
    {
      label: 'snake_case',
      fn: (s: string) =>
        s
          .split('\n')
          .map((line) => line.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
          .join('\n'),
    },
    {
      label: 'kebab-case',
      fn: (s: string) =>
        s
          .split('\n')
          .map((line) => line.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
          .join('\n'),
    },
    {
      label: 'Remove Duplicate Lines',
      fn: (s: string) => Array.from(new Set(s.split('\n'))).join('\n'),
    },
    {
      label: 'Sort Lines A–Z',
      fn: (s: string) => s.split('\n').sort((a, b) => a.localeCompare(b)).join('\n'),
    },
    {
      label: 'Trim Whitespace',
      fn: (s: string) => s.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean).join('\n'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {actions.map((act) => (
          <button
            key={act.label}
            type="button"
            onClick={() => transform(act.fn, act.label)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-blue-600 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
          >
            {act.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={9}
        className="w-full rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy Text'}
        </button>
      </div>
    </div>
  );
};

export const QrCodeGeneratorTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [content, setContent] = useState('https://toolivo.com');
  const [fgColor, setFgColor] = useState('#0F172A');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [size, setSize] = useState(320);
  const [ecLevel, setEcLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [pngUrl, setPngUrl] = useState<string>('');
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const render = async () => {
      if (!content.trim()) {
        setPngUrl('');
        setSvgMarkup('');
        return;
      }
      setError(null);
      try {
        const [dataUrl, svg] = await Promise.all([
          QRCode.toDataURL(content, {
            width: size,
            margin: 2,
            errorCorrectionLevel: ecLevel,
            color: { dark: fgColor, light: bgColor },
          }),
          QRCode.toString(content, {
            type: 'svg',
            width: size,
            margin: 2,
            errorCorrectionLevel: ecLevel,
            color: { dark: fgColor, light: bgColor },
          }),
        ]);
        if (active) {
          setPngUrl(dataUrl);
          setSvgMarkup(svg);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to generate QR code.');
      }
    };
    void render();
    return () => {
      active = false;
    };
  }, [content, fgColor, bgColor, size, ecLevel]);

  const downloadPng = async () => {
    if (!pngUrl) return;
    const res = await fetch(pngUrl);
    const blob = await res.blob();
    triggerDownload(blob, 'toolivo-qr.png');
    onComplete?.({
      inputSummary: `QR payload (${content.length} chars)`,
      outputSummary: `PNG ${size}×${size}px (${ecLevel})`,
      processingMs: 2,
    });
  };

  const downloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    triggerDownload(blob, 'toolivo-qr.svg');
    onComplete?.({
      inputSummary: `QR payload (${content.length} chars)`,
      outputSummary: `Vector SVG (${ecLevel})`,
      processingMs: 2,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div>
          <label htmlFor="qr-content" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            URL, text, or Wi-Fi payload
          </label>
          <textarea
            id="qr-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="https://example.com"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Foreground</label>
            <input
              type="color"
              value={fgColor}
              onChange={(e) => setFgColor(e.target.value)}
              className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-transparent dark:border-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Background</label>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-transparent dark:border-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Size (px)</label>
            <select
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value, 10))}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value={256}>256px</option>
              <option value={320}>320px</option>
              <option value={512}>512px</option>
              <option value={1024}>1024px</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Correction</label>
            <select
              value={ecLevel}
              onChange={(e) => setEcLevel(e.target.value as 'L' | 'M' | 'Q' | 'H')}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="L">L (7%)</option>
              <option value="M">M (15%)</option>
              <option value="Q">Q (25%)</option>
              <option value="H">H (30%)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            disabled={!pngUrl}
            onClick={downloadPng}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Download PNG
          </button>
          <button
            type="button"
            disabled={!svgMarkup}
            onClick={downloadSvg}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            Download Vector SVG
          </button>
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900/60">
        {pngUrl ? (
          <img
            src={pngUrl}
            alt="Generated QR code"
            className="h-52 w-52 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700"
          />
        ) : (
          <p className="text-xs text-slate-500">Enter text to render QR preview</p>
        )}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Static QR code · Never expires
        </p>
      </div>
    </div>
  );
};

export const PasswordGeneratorTool: React.FC<ToolComponentProps> = ({ onComplete }) => {
  const [length, setLength] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [noAmbiguous, setNoAmbiguous] = useState(true);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const charset = useMemo(() => {
    let chars = '';
    if (upper) chars += noAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lower) chars += noAmbiguous ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    if (digits) chars += noAmbiguous ? '23456789' : '0123456789';
    if (symbols) chars += '!@#$%^&*-_=+?';
    return chars || 'abcdefghijkmnopqrstuvwxyz23456789';
  }, [upper, lower, digits, symbols, noAmbiguous]);

  const entropyBits = Math.round(length * Math.log2(charset.length));

  const generate = () => {
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += charset[arr[i] % charset.length];
    }
    setPassword(out);
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, charset]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <code className="break-all font-mono text-base font-semibold text-slate-900 dark:text-white">
          {password}
        </code>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </button>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(password);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
              onComplete?.({
                inputSummary: `Length ${length}`,
                outputSummary: `Generated (~${entropyBits} bits entropy)`,
                processingMs: 1,
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-400">
          Length: <strong className="font-mono tabular-nums text-slate-900 dark:text-white">{length}</strong> characters
        </span>
        <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
          ~{entropyBits} bits entropy ({entropyBits >= 90 ? 'Strong' : entropyBits >= 60 ? 'Good' : 'Moderate'})
        </span>
      </div>
      <input
        type="range"
        min={8}
        max={64}
        value={length}
        onChange={(e) => setLength(parseInt(e.target.value, 10))}
        className="w-full accent-blue-600"
      />

      <div className="flex flex-wrap gap-5 text-xs text-slate-700 dark:text-slate-300">
        {[
          { label: 'Uppercase (A–Z)', val: upper, set: setUpper },
          { label: 'Lowercase (a–z)', val: lower, set: setLower },
          { label: 'Numbers (0–9)', val: digits, set: setDigits },
          { label: 'Symbols (!@#)', val: symbols, set: setSymbols },
          { label: 'Exclude ambiguous (l, 1, O, 0)', val: noAmbiguous, set: setNoAmbiguous },
        ].map((opt) => (
          <label key={opt.label} className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={opt.val}
              onChange={(e) => opt.set(e.target.checked)}
              className="accent-blue-600"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
};
