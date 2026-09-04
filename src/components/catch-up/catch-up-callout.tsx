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
      <section
        className="border-b border-[#00172B]/10 bg-white/80 text-[#00172B]"
        aria-label="Catch-up status"
      >
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Check className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.12em]">You’re caught up</p>
            <p className="mt-0.5 text-sm font-semibold text-[#00172B]/60">
              Nothing important has changed since you were here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const one = data.totalMeaningfulChanges === 1;
  return (
    <section
      className="border-b border-white/10 bg-[#00172B] text-white"
      aria-label="Catch-up status"
    >
      <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6 lg:px-8">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em]">
            <RotateCcw
              className="h-4 w-4 text-[var(--team-secondary-on-dark)]"
              aria-hidden="true"
            />
            {data.totalMeaningfulChanges} {one ? 'new update' : 'new updates'} since your last visit
          </h2>
          <p className="mt-1 text-sm font-semibold text-white/70">
            Catch up on what changed with {data.teamName}.
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-white/55">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {data.estimatedReadMinutes} min
            read
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--secondary)] px-6 text-sm font-black text-[var(--team-on-secondary)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Catch me up <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
