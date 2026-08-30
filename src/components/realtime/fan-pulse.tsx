'use client';

import { useState } from 'react';
import { BarChart3, ChevronDown, MessageCircle } from 'lucide-react';

import type { FanPulseData } from '@/features/realtime/types';

export default function FanPulse({ pulse }: { pulse: FanPulseData }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--primary)]">
            <MessageCircle className="h-4 w-4" />{' '}
            {pulse.status === 'EARLY_PULSE' ? 'Early Fan Pulse' : 'Fan Pulse'}
          </p>
          <div className="mt-3 flex items-end gap-3">
            <strong className="text-5xl font-black tracking-tight">{pulse.positivePercent}%</strong>
            <span className="pb-1 text-sm font-bold text-emerald-700">positive</span>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black tracking-wider text-slate-500">
          {pulse.confidence} CONFIDENCE
        </span>
      </div>
      <div className="mt-5 flex h-2 overflow-hidden rounded-full">
        <span className="bg-emerald-500" style={{ width: `${pulse.positivePercent}%` }} />
        <span className="bg-amber-400" style={{ width: `${pulse.neutralPercent}%` }} />
        <span className="bg-rose-500" style={{ width: `${pulse.negativePercent}%` }} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {pulse.overallMood} · Based on {pulse.sampleSize.toLocaleString()} analyzed public reactions
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Fans like
          </dt>
          <dd className="mt-1 font-bold text-slate-800">{pulse.topPositiveThemes.join(' and ')}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Biggest concern
          </dt>
          <dd className="mt-1 font-bold text-slate-800">{pulse.topConcerns.join(' and ')}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Biggest debate
          </dt>
          <dd className="mt-1 font-bold text-slate-800">{pulse.biggestDebate}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Trending take
          </dt>
          <dd className="mt-1 font-bold text-slate-800">{pulse.trendingTake}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-6 flex items-center gap-1 text-sm font-black text-[var(--primary)]"
      >
        <BarChart3 className="h-4 w-4" /> Platform breakdown{' '}
        <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {pulse.sourceBreakdown.map((source) => (
            <div key={source.platform} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">{source.platform}</p>
              <p className="mt-1 text-2xl font-black">{source.positivePercent}%</p>
              <p className="text-xs text-slate-400">{source.sampleSize} reactions</p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-5 text-[11px] leading-5 text-slate-400">
        Fan Pulse is based on public fan discussion analyzed across available sources. It is
        directional, not a scientific poll.
      </p>
    </section>
  );
}
