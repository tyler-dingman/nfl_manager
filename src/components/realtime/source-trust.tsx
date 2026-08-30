'use client';

import { useState } from 'react';
import { ChevronDown, ShieldCheck, X } from 'lucide-react';

import type { StorySource } from '@/features/realtime/types';
import SourceList from './source-list';

export default function SourceTrust({
  sources,
  trustLevel,
  lastCheckedAt,
}: {
  sources: StorySource[];
  trustLevel: string;
  lastCheckedAt: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left"
      >
        <span className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <span>
            <span className="block text-sm font-black text-emerald-950">
              Confirmed by {sources.length} sources
            </span>
            <span className="mt-1 block text-xs text-emerald-800/75">{trustLevel}</span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-emerald-700" />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Story sources"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100"
              aria-label="Close sources"
            >
              <X className="h-4 w-4" />
            </button>
            <SourceList sources={sources} lastCheckedAt={lastCheckedAt} />
          </div>
        </div>
      ) : null}
    </>
  );
}
