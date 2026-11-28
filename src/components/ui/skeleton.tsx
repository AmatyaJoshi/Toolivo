import React from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'toolivo-skeleton rounded-lg bg-slate-200/80 dark:bg-slate-800/75',
        className
      )}
      {...props}
    />
  );
}

export function ToolGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading utilities"
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3.5 dark:border-slate-800/80 dark:bg-[#0D121F]/80"
        >
          <Skeleton className="h-[88px] w-full rounded-lg" />
          <div className="flex items-start gap-2.5 px-0.5">
            <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-11/12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToolWorkbenchSkeleton() {
  return (
    <div aria-busy="true" aria-label="Preparing tool workspace" className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 dark:border-slate-800/80 dark:bg-[#0D121F]/90">
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
