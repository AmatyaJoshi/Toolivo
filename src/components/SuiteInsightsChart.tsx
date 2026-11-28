import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORIES, TOOLS_CATALOG } from '../data/catalog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const CATEGORY_COLORS: Record<string, string> = {
  pdf: '#E11D48',
  image: '#0284C7',
  video: '#6366F1',
  audio: '#7C5CFF',
  text: '#059669',
  developer: '#4285F4',
  productivity: '#D97706',
};

const LATENCY_BENCHMARK = [
  { stage: 'Upload', localMs: 0, cloudMs: 3200 },
  { stage: 'Queue', localMs: 0, cloudMs: 1400 },
  { stage: 'Process', localMs: 420, cloudMs: 1100 },
  { stage: 'Download', localMs: 40, cloudMs: 2100 },
];

export const SuiteInsightsChart: React.FC<{
  onSelectCategory?: (categoryId: string) => void;
}> = ({ onSelectCategory }) => {
  const [mobileTab, setMobileTab] = useState<'suite' | 'speed'>('suite');

  const categoryData = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      id: cat.id,
      name: cat.shortName,
      tools: TOOLS_CATALOG.filter((t) => t.category === cat.id).length,
      color: CATEGORY_COLORS[cat.id] || '#7C5CFF',
    }));
  }, []);

  const suiteChart = (
    <div className="h-44 w-full sm:h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(124, 92, 255, 0.08)' }}
            contentStyle={{
              backgroundColor: '#0E101C',
              border: '1px solid #262A44',
              borderRadius: '10px',
              fontSize: '12px',
              color: '#F8FAFC',
            }}
            itemStyle={{ color: '#F8FAFC' }}
          />
          <Bar
            dataKey="tools"
            name="Tools"
            radius={[6, 6, 0, 0]}
            onClick={(entry) => {
              if (entry && typeof entry.id === 'string' && onSelectCategory) {
                onSelectCategory(entry.id);
              }
            }}
            className="cursor-pointer"
          >
            {categoryData.map((entry) => (
              <Cell key={entry.id} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const speedChart = (
    <div className="h-44 w-full sm:h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={LATENCY_BENCHMARK} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
          <XAxis
            dataKey="stage"
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
            unit="ms"
          />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
            contentStyle={{
              backgroundColor: '#0E101C',
              border: '1px solid #262A44',
              borderRadius: '10px',
              fontSize: '12px',
              color: '#F8FAFC',
            }}
          />
          <Bar dataKey="localMs" name="Toolivo Local (ms)" fill="#10B981" radius={[6, 6, 0, 0]} />
          <Bar dataKey="cloudMs" name="Typical Cloud Site (ms)" fill="#64748B" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <section aria-label="Toolivo suite overview charts">
      {/* Mobile & Tablet Compact Single Tabbed Card — Eliminates stacked chart scrolling */}
      <Card className="enterprise-card lg:hidden">
        <CardHeader className="space-y-3 p-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm">
                {mobileTab === 'suite'
                  ? `Suite Breakdown (${TOOLS_CATALOG.length} Tools)`
                  : 'Zero-Upload Speed Advantage'}
              </CardTitle>
              <CardDescription className="mt-0.5 text-[11px]">
                {mobileTab === 'suite'
                  ? 'Tap any bar to filter by category.'
                  : 'Typical 10 MB PDF time (ms): Local vs. Cloud.'}
              </CardDescription>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setMobileTab('suite')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  mobileTab === 'suite'
                    ? 'bg-white text-slate-950 shadow-2xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Tools
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('speed')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  mobileTab === 'speed'
                    ? 'bg-white text-slate-950 shadow-2xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Speed
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          {mobileTab === 'suite' ? suiteChart : speedChart}
        </CardContent>
      </Card>

      {/* Desktop Enterprise 2-Column Side-by-Side Analytics */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        <Card className="enterprise-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Suite Breakdown ({TOOLS_CATALOG.length} Tools)</CardTitle>
              <span className="font-mono text-[11px] font-semibold text-violet-700 dark:text-violet-400">
                Click bar to filter
              </span>
            </div>
            <CardDescription>
              Every utility runs directly in local WebAssembly &amp; Canvas memory.
            </CardDescription>
          </CardHeader>
          <CardContent>{suiteChart}</CardContent>
        </Card>

        <Card className="enterprise-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Zero-Upload Speed Advantage</CardTitle>
              <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                0 ms upload wait
              </span>
            </div>
            <CardDescription>
              Typical 10 MB PDF workflow time (ms): Toolivo Local vs. Cloud Upload Sites.
            </CardDescription>
          </CardHeader>
          <CardContent>{speedChart}</CardContent>
        </Card>
      </div>
    </section>
  );
};
