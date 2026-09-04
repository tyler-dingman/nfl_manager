'use client';

import { ArrowRight, X } from 'lucide-react';

import EditorialVisual from '@/components/editorial/editorial-visual';
import type { TeamBriefing } from '@/features/content/types';

export default function BriefingDetailModal({
  briefing,
  teamAbbr,
  onClose,
}: {
  briefing: TeamBriefing;
  teamAbbr: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-950/75 px-4 py-[6vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={briefing.headline}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <article className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="relative">
          <EditorialVisual
            story={{
              teamId: teamAbbr,
              category: briefing.category,
              headline: briefing.headline,
              summary: briefing.summary,
            }}
            variant="hero"
            decorative
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/30"
            aria-label="Close story"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-8 px-6 py-8 sm:px-10">
          <div>
            <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              {briefing.headline}
            </h2>
            <p className="mt-3 text-xs font-semibold text-slate-400">
              {briefing.sourceCount} {briefing.sourceCount === 1 ? 'source' : 'sources'} · Updated{' '}
              {new Date(briefing.updatedAt).toLocaleString()}
            </p>
          </div>
          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.22em] text-[var(--team-primary-text)]">
              The short version
            </h3>
            <p className="mt-3 text-lg leading-8 text-slate-700">{briefing.summary}</p>
          </section>
          {briefing.whyItMatters ? (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-black text-slate-950">Why it matters</h3>
              <p className="mt-2 leading-7 text-slate-600">{briefing.whyItMatters}</p>
            </section>
          ) : null}
          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Sources
            </h3>
            <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {briefing.sources.map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-4 py-4"
                >
                  <span>
                    <span className="block text-xs font-black uppercase tracking-[0.16em] text-[var(--team-primary-text)]">
                      {source.publisher} · {source.kind}
                    </span>
                    <span className="mt-1 block font-bold leading-6 text-slate-800 group-hover:underline">
                      {source.title}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1" />
                </a>
              ))}
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
