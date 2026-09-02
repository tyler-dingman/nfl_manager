'use client';

import Link from 'next/link';
import { ArrowRight, Check, Clock3, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { CatchUpResponse } from '@/features/catch-up/types';

export default function CatchUpCallout({ teamId }: { teamId: string }) {
  const [data, setData] = useState<CatchUpResponse | null>(null);
  const [demoMode, setDemoMode] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const demo = new URLSearchParams(window.location.search).get('catchUpDemo');
    setDemoMode(demo);
    const query = new URLSearchParams({ team: teamId });
    if (demo) query.set('demo', demo);
    void fetch(`/api/catch-up?${query}`, { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { catchUp?: CatchUpResponse } | null) => setData(body?.catchUp ?? null))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setData(null);
      });
    return () => controller.abort();
  }, [teamId]);

  if (!data?.eligible) return null;
  const href = `/catch-up?team=${teamId}${demoMode ? `&demo=${encodeURIComponent(demoMode)}` : ''}`;

  if (!data.totalMeaningfulChanges) {
    return (
      <section className="mb-6 flex items-center gap-3 rounded-2xl border border-[#00172B]/10 bg-white px-5 py-4 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <Check className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.12em]">You’re caught up</p>
          <p className="mt-0.5 text-sm font-semibold text-[#00172B]/50">
            Nothing important has changed since you were here.
          </p>
        </div>
      </section>
    );
  }

  const one = data.totalMeaningfulChanges === 1;
  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-[#00172B] text-white shadow-sm">
      <div className="grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[var(--team-secondary-on-dark)]">
            <RotateCcw className="h-4 w-4" /> {one ? 'One thing changed' : 'Get caught up'}
          </div>
          <h3 className="mt-3 text-2xl font-black leading-tight">
            {one
              ? data.items[0]?.headline
              : data.mode === 'CURRENT_STATE'
                ? 'Here’s where things stand now.'
                : `${data.totalMeaningfulChanges} things happened while you were away.`}
          </h3>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white/55">
            <Clock3 className="h-4 w-4" /> {data.estimatedReadMinutes} min read · Since{' '}
            {new Date(data.baselineAt).toLocaleString([], {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--secondary)] px-6 text-sm font-black text-[var(--team-on-secondary)] transition hover:-translate-y-0.5"
        >
          {one ? 'See the update' : 'Catch me up'} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
