'use client';

import Image from 'next/image';
import { Search, Star, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useSaveStore } from '@/features/save/save-store';
import { computeTeamNeeds } from '@/lib/team-overview';
import type { DraftProspectRecord } from '@/server/data/draft-prospects';

const positionGroup = (position: string | null) => position?.toUpperCase() || 'OTHER';

export function ProspectBoard({ prospects }: { prospects: DraftProspectRecord[] }) {
  const roster = useSaveStore((state) => state.roster);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [watched, setWatched] = useState<string[]>([]);
  const [active, setActive] = useState<DraftProspectRecord | null>(null);
  const needs = useMemo(() => computeTeamNeeds(roster), [roster]);
  const positions = useMemo(
    () => [...new Set(prospects.map((prospect) => positionGroup(prospect.position)))].sort(),
    [prospects],
  );

  useEffect(() => {
    try {
      setWatched(JSON.parse(localStorage.getItem('dd-2027-draft-watchlist') || '[]'));
    } catch {
      setWatched([]);
    }
  }, []);

  const toggleWatch = (id: string) => {
    setWatched((current) => {
      const next = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
      localStorage.setItem('dd-2027-draft-watchlist', JSON.stringify(next));
      return next;
    });
  };
  const visible = prospects.filter((prospect) => {
    const haystack = `${prospect.name} ${prospect.school} ${prospect.position}`.toLowerCase();
    return (
      (position === 'ALL' || positionGroup(prospect.position) === position) &&
      (!query.trim() || haystack.includes(query.trim().toLowerCase()))
    );
  });

  return (
    <div className="mx-auto w-full max-w-7xl pb-16">
      <header className="fo-page-header">
        <div className="fo-page-heading">
          <p className="fo-title-eyebrow text-[var(--team-primary-text)]">2027 NFL Draft</p>
          <h1 className="dd-home-hero-display">Draft Board</h1>
          <p className="fo-description">{prospects.length} ranked consensus prospects</p>
        </div>
      </header>
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm md:flex-row">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border px-3">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Search prospects</span>
          <input
            className="w-full bg-transparent outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search player, school, or position"
          />
        </label>
        <select
          className="min-h-11 rounded-xl border bg-white px-3 font-semibold"
          value={position}
          onChange={(event) => setPosition(event.target.value)}
          aria-label="Filter prospects by position"
        >
          <option value="ALL">All positions</option>
          {positions.map((entry) => (
            <option key={entry}>{entry}</option>
          ))}
        </select>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
        {visible.map((prospect) => {
          const isNeed = needs.some((need) => String(need) === positionGroup(prospect.position));
          return (
            <div
              key={prospect.id}
              className="grid grid-cols-[48px_1fr_72px_48px] items-center gap-3 border-b px-4 py-3 last:border-0 md:grid-cols-[60px_1.4fr_.8fr_80px_110px_48px]"
            >
              <strong className="text-xl">{prospect.ranking ?? '—'}</strong>
              <button
                type="button"
                className="flex min-w-0 items-center gap-3 text-left"
                onClick={() => setActive(prospect)}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 font-black text-slate-500">
                  {prospect.headshotUrl ? (
                    <Image
                      src={prospect.headshotUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    prospect.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')
                  )}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate">{prospect.name}</strong>
                  <small className="text-slate-500 md:hidden">{prospect.school}</small>
                </span>
              </button>
              <span className="hidden text-sm text-slate-600 md:block">
                {prospect.school ?? '—'}
              </span>
              <span>
                <strong>{prospect.position ?? '—'}</strong>
                {isNeed ? (
                  <small className="block text-[var(--team-primary-text)]">Need</small>
                ) : null}
              </span>
              <span className="hidden text-sm text-slate-600 md:block">
                {prospect.projectedRange ?? '—'}
              </span>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100 focus-visible:ring-2"
                onClick={() => toggleWatch(prospect.id)}
                aria-label={`${watched.includes(prospect.id) ? 'Remove' : 'Add'} ${prospect.name} ${watched.includes(prospect.id) ? 'from' : 'to'} watchlist`}
              >
                <Star
                  className={`h-5 w-5 ${watched.includes(prospect.id) ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`}
                />
              </button>
            </div>
          );
        })}
      </div>
      {active ? (
        <div
          className="app-modal-layer fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4"
          onMouseDown={(event) => event.target === event.currentTarget && setActive(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="prospect-name"
            className="relative max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full border"
              onClick={() => setActive(null)}
              aria-label="Close prospect profile"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--team-primary-text)]">
              Rank #{active.ranking}
            </p>
            <h2 id="prospect-name" className="mt-2 pr-12 text-3xl font-black">
              {active.name}
            </h2>
            <p className="mt-1 font-semibold text-slate-600">
              {active.position} · {active.school}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <dt className="text-slate-500">Range</dt>
                <dd className="font-bold">{active.projectedRange ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Grade</dt>
                <dd className="font-bold">{active.grade ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Height</dt>
                <dd className="font-bold">{active.height ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Weight</dt>
                <dd className="font-bold">{active.weight ? `${active.weight} lbs` : '—'}</dd>
              </div>
            </dl>
            {active.summary ? (
              <p className="mt-5 leading-7 text-slate-700">{active.summary}</p>
            ) : null}
            <button
              type="button"
              className="team-primary-filled mt-6 min-h-11 w-full rounded-xl px-4 font-black"
              onClick={() => toggleWatch(active.id)}
            >
              {watched.includes(active.id) ? 'Remove from watchlist' : 'Add to watchlist'}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
