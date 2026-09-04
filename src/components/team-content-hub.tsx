'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Radio, Search, Shield, Sparkles, Users } from 'lucide-react';

import BriefingDetailModal from '@/components/huddle/briefing-detail-modal';
import FilmRoomGrid from '@/components/film-room/film-room-grid';
import FilmRoomPlayDiagram from '@/components/film-room/film-room-play-diagram';
import HuddleStoryCard from '@/components/huddle/huddle-story-card';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import ThreeAndOutExperience from '@/components/three-and-out/three-and-out-experience';
import type { TeamBriefing } from '@/features/content/types';
import { recordBriefingConsumed } from '@/features/content/consumption';
import { readCanonicalFanTeamPreference } from '@/features/team/fan-team-preference';
import { getOffseasonManagerRoute } from '@/features/team/offseason-manager-route';
import { useTeamStore } from '@/features/team/team-store';
import { useAuthUser } from '@/features/auth/auth-session';

type HubKind = 'huddle' | 'three-and-out' | 'watch' | 'wire' | 'front-office';

const hubMeta = {
  huddle: {
    eyebrow: 'The Beat',
    title: 'Everything happening with your team. As it happens.',
    description:
      'One story per development. Updated as trusted reporting comes in, with every source linked back to the people doing the work.',
  },
  'three-and-out': {
    eyebrow: 'Three and Out',
    title: 'The three things you need to know right now.',
    description:
      'The biggest ongoing football stories, ranked by importance, sourced, and updated as they change.',
  },
  watch: {
    eyebrow: 'Film Room',
    title: 'Get into the film room and put on the tape.',
    description:
      'Press conferences, local shows, film study, podcasts, player interviews, and fan creators worth watching.',
  },
  wire: {
    eyebrow: 'The Wire',
    title: 'What changed, as it happens.',
    description:
      'Breaking news, injuries, transactions, roster movement, and verified updates in one fast timeline.',
  },
  'front-office': {
    eyebrow: 'Front Office',
    title: 'Understand how the team is being built.',
    description:
      'Depth chart, contracts, cap space, transactions, and draft capital with the context that makes them useful.',
  },
} satisfies Record<HubKind, { eyebrow: string; title: string; description: string }>;

const wireUpdates = [
  ['11:42 AM', 'Team announces a roster move ahead of today’s practice.', 'Official'],
  ['10:18 AM', 'Injury update brings encouraging news at a key position.', 'Injury'],
  ['9:05 AM', 'New comments clarify the plan for the starting lineup.', 'Report'],
  ['Yesterday', 'League transaction wire confirms a depth signing.', 'Transaction'],
  ['Yesterday', 'Practice participation provides a new signal in a position battle.', 'Practice'],
];

export default function TeamContentHub({ kind }: { kind: HubKind }) {
  const searchParams = useSearchParams();
  const teams = useTeamStore((state) => state.teams);
  const requestedAbbr = searchParams?.get('team')?.toUpperCase();
  const [persistedAbbr, setPersistedAbbr] = useState<string | null>(null);
  const effectiveAbbr = requestedAbbr ?? persistedAbbr;
  const activeTeam = useMemo(
    () => teams.find((team) => team.abbr === effectiveAbbr),
    [effectiveAbbr, teams],
  );
  const teamAbbr = activeTeam?.abbr ?? 'NFL';
  const teamName = activeTeam?.name ?? 'NFL';
  const meta = hubMeta[kind];
  const [briefings, setBriefings] = useState<TeamBriefing[]>([]);

  useEffect(() => {
    void readCanonicalFanTeamPreference().then(setPersistedAbbr);
  }, []);

  useEffect(() => {
    if (kind !== 'huddle') return;
    const controller = new AbortController();
    void fetch(`/api/content/huddle?team=${teamAbbr}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { briefings?: TeamBriefing[] } | null) =>
        setBriefings(payload?.briefings ?? []),
      )
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setBriefings([]);
      });
    return () => controller.abort();
  }, [kind, teamAbbr]);

  return (
    <TeamThemeProvider team={activeTeam}>
      <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
        <MainSiteHeader
          teamAbbr={activeTeam?.abbr}
          active={kind === 'huddle' || kind === 'watch' || kind === 'front-office' ? kind : null}
        />

        <section className="relative overflow-hidden bg-[var(--dark)] text-[var(--team-on-dark)]">
          {kind === 'watch' ? <FilmRoomPlayDiagram /> : null}
          <div className="relative z-[1] mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--team-secondary-on-dark)]">
              {teamName} · {meta.eyebrow}
            </p>
            {kind === 'huddle' ? (
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
                Everything happening with your team.{' '}
                <span className="text-[var(--secondary)] [text-shadow:0_2px_0_rgba(0,0,0,0.2)]">
                  As it happens.
                </span>
              </h1>
            ) : kind === 'watch' ? (
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
                Get into the film room and{' '}
                <span className="text-[var(--secondary)] [text-shadow:0_2px_0_rgba(0,0,0,0.2)]">
                  put on the tape.
                </span>
              </h1>
            ) : (
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
                {meta.title}
              </h1>
            )}
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--team-light-on-dark)]">
              {meta.description}
            </p>
          </div>
        </section>

        <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          {kind === 'huddle' ? (
            <HuddleGrid briefings={briefings} teamAbbr={teamAbbr} teamName={teamName} />
          ) : null}
          {kind === 'three-and-out' ? (
            activeTeam ? (
              <ThreeAndOutExperience teamId={activeTeam.abbr} />
            ) : (
              <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--team-primary-text)]">
                  Team required
                </p>
                <h2 className="mt-3 text-3xl font-black">
                  Choose your team to open Three and Out.
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-slate-500">
                  Use Team Select above to load the three stories that matter most for your team.
                </p>
              </section>
            )
          ) : null}
          {kind === 'watch' ? <FilmRoomGrid teamAbbr={teamAbbr} teamName={teamName} /> : null}
          {kind === 'wire' ? <WireTimeline /> : null}
          {kind === 'front-office' ? <FrontOffice teamName={teamName} teamAbbr={teamAbbr} /> : null}
        </main>
      </div>
    </TeamThemeProvider>
  );
}

type BeatFilter = 'ALL' | 'HOT' | 'ROSTER' | 'INJURIES' | 'DRAFT' | 'GAMES';

const beatFilters: Array<{ id: BeatFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'HOT', label: 'Hot Reads' },
  { id: 'ROSTER', label: 'Roster' },
  { id: 'INJURIES', label: 'Injuries' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'GAMES', label: 'Games' },
];

function matchesBeatFilter(briefing: TeamBriefing, filter: BeatFilter) {
  const category = briefing.category.toUpperCase();
  if (filter === 'ALL') return true;
  if (filter === 'HOT') {
    return Boolean(briefing.hotReadUntil && new Date(briefing.hotReadUntil).getTime() > Date.now());
  }
  if (filter === 'ROSTER')
    return ['ROSTER', 'TRANSACTION', 'TRADE', 'CONTRACT', 'SIGNING'].some((value) =>
      category.includes(value),
    );
  if (filter === 'INJURIES') return category.includes('INJUR');
  if (filter === 'DRAFT') return category.includes('DRAFT');
  return ['GAME', 'PREVIEW', 'RESULT'].some((value) => category.includes(value));
}

function HuddleGrid({
  briefings,
  teamAbbr,
  teamName,
}: {
  briefings: TeamBriefing[];
  teamAbbr: string;
  teamName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, hydrated } = useAuthUser();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BeatFilter>('ALL');
  const [timeRange, setTimeRange] = useState('ALL');
  const [sort, setSort] = useState<'UPDATED' | 'NEWEST'>('UPDATED');
  const selectedBriefing = briefings.find((briefing) => briefing.id === searchParams?.get('story'));

  useEffect(() => {
    if (!hydrated || !user || !briefings.length) return;
    void fetch('/api/user/saved-content')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { items?: Array<{ contentId: string }> } | null) =>
        setSavedIds(new Set((body?.items ?? []).map((item) => item.contentId))),
      );
  }, [briefings, hydrated, user]);

  const toggleSaved = async (briefing: TeamBriefing) => {
    if (!user) {
      window.location.assign(`/login?next=${encodeURIComponent(`/the-beat?team=${teamAbbr}`)}`);
      return;
    }
    const saved = savedIds.has(briefing.id);
    const response = await fetch(
      `/api/user/saved-content?contentType=STORY&contentId=${encodeURIComponent(briefing.id)}`,
      saved
        ? { method: 'DELETE' }
        : {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              contentType: 'STORY',
              contentId: briefing.id,
              title: briefing.headline,
              href: `/the-beat?team=${teamAbbr}`,
              metadata: { teamAbbr, category: briefing.category },
            }),
          },
    );
    if (response.ok) {
      setSavedIds((current) => {
        const next = new Set(current);
        if (saved) next.delete(briefing.id);
        else next.add(briefing.id);
        return next;
      });
    }
  };

  const visibleBriefings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const now = Date.now();
    const rangeMs =
      timeRange === 'TODAY'
        ? 24 * 60 * 60 * 1000
        : timeRange === 'WEEK'
          ? 7 * 24 * 60 * 60 * 1000
          : timeRange === 'MONTH'
            ? 30 * 24 * 60 * 60 * 1000
            : null;
    return briefings
      .filter((briefing) => matchesBeatFilter(briefing, filter))
      .filter((briefing) => !rangeMs || now - new Date(briefing.updatedAt).getTime() <= rangeMs)
      .filter((briefing) => {
        if (!normalizedQuery) return true;
        return [
          briefing.headline,
          briefing.summary,
          briefing.category,
          ...briefing.sources.map((source) => `${source.publisher} ${source.title}`),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        const timestamp = (briefing: TeamBriefing) => {
          if (sort === 'UPDATED' || briefing.sources.length === 0) {
            return new Date(briefing.updatedAt).getTime();
          }
          return Math.min(
            ...briefing.sources.map((source) => new Date(source.publishedAt).getTime()),
          );
        };
        return timestamp(right) - timestamp(left);
      });
  }, [briefings, filter, query, sort, timeRange]);

  const openBriefing = (briefing: TeamBriefing) => {
    if (user) void recordBriefingConsumed(briefing);
    const params = new URLSearchParams(searchParams?.toString());
    params.set('team', teamAbbr);
    params.set('story', briefing.id);
    router.push(`${pathname ?? '/the-beat'}?${params.toString()}`);
  };

  const closeBriefing = () => {
    const params = new URLSearchParams(searchParams?.toString());
    params.delete('story');
    const queryString = params.toString();
    router.push(`${pathname ?? '/the-beat'}${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <section aria-labelledby="beat-stories-heading">
      {selectedBriefing ? (
        <BriefingDetailModal
          briefing={selectedBriefing}
          teamAbbr={teamAbbr}
          onClose={closeBriefing}
        />
      ) : null}
      <div className="rounded-3xl border border-[#00172B]/10 bg-white p-5 shadow-sm sm:p-7">
        <label
          htmlFor="ask-dd"
          className="text-xs font-black uppercase tracking-[0.22em] text-[var(--team-primary-text)]"
        >
          Ask D&amp;D
        </label>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#52677c]"
            aria-hidden="true"
          />
          <input
            id="ask-dd"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Ask anything about the ${teamName}…`}
            className="h-14 w-full rounded-2xl border border-[#00172B]/15 bg-[#f7f4ee] pl-12 pr-4 font-bold text-[#00172B] outline-none transition placeholder:text-[#6d7f91] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
          />
        </div>
        <p className="mt-2 text-xs font-semibold text-[#6d7f91]">
          Searches D&amp;D’s canonical stories and their attributed sources.
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-4 border-b border-[#00172B]/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="beat-stories-heading" className="sr-only">
            The Beat stories
          </h2>
          <div className="flex flex-wrap gap-2" aria-label="Filter Beat stories">
            {beatFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/30 ${
                  filter === item.id
                    ? 'border-[var(--dark)] bg-[var(--dark)] text-[var(--team-on-dark)]'
                    : 'border-[#00172B]/15 bg-white text-[#40556b] hover:border-[var(--primary)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[#52677c]">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as 'UPDATED' | 'NEWEST')}
              className="h-10 rounded-full border border-[#00172B]/15 bg-white px-4 font-bold normal-case tracking-normal text-[#00172B] outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
            >
              <option value="UPDATED">Recently updated</option>
              <option value="NEWEST">Newest</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[#52677c]">
            Time
            <select
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value)}
              className="h-10 rounded-full border border-[#00172B]/15 bg-white px-4 font-bold normal-case tracking-normal text-[#00172B] outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
            >
              <option value="TODAY">Today</option>
              <option value="WEEK">This week</option>
              <option value="MONTH">This month</option>
              <option value="ALL">All time</option>
            </select>
          </label>
        </div>
      </div>

      <p className="mt-5 text-xs font-bold text-[#6d7f91]" role="status" aria-live="polite">
        {visibleBriefings.length} {visibleBriefings.length === 1 ? 'development' : 'developments'}
        {query.trim() ? ` matching “${query.trim()}”` : ''}
      </p>

      <div className="mt-4 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visibleBriefings.length ? (
          visibleBriefings.map((briefing) => (
            <HuddleStoryCard
              key={briefing.id}
              id={briefing.id}
              teamId={briefing.teamAbbr}
              headline={briefing.headline}
              summary={briefing.summary}
              category={briefing.category}
              status={briefing.status}
              sourceCount={briefing.sourceCount}
              updatedAt={briefing.updatedAt}
              materialUpdateCount={briefing.materialUpdateCount}
              hotReadUntil={briefing.hotReadUntil}
              firstReportedBy={briefing.firstReportedBy}
              sources={briefing.sources}
              saved={savedIds.has(briefing.id)}
              onSave={() => void toggleSaved(briefing)}
              onOpen={() => openBriefing(briefing)}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[#00172B]/20 bg-white p-8 text-center text-sm font-semibold text-[#52677c] md:col-span-2 lg:col-span-3">
            {briefings.length
              ? 'No developments match those filters. Try a broader search or time range.'
              : 'Building today’s Beat…'}
          </div>
        )}
      </div>
    </section>
  );
}

function WireTimeline() {
  return (
    <section className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-black">
          <Radio className="text-red-600" /> Live updates
        </h2>
        <span className="text-xs font-black uppercase tracking-wider text-red-600">● Live</span>
      </div>
      <div className="mt-8 divide-y divide-slate-200">
        {wireUpdates.map(([time, text, category]) => (
          <article
            key={`${time}-${text}`}
            className="grid gap-2 py-6 sm:grid-cols-[110px_1fr_auto] sm:items-center"
          >
            <time className="text-xs font-black text-slate-400">{time}</time>
            <p className="font-bold leading-6">{text}</p>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
              {category}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function FrontOffice({ teamName, teamAbbr }: { teamName: string; teamAbbr?: string | null }) {
  const tools = [
    ['Depth chart', 'Current roster and roles', Users],
    ['Cap outlook', 'Contracts and available space', Shield],
    ['Transactions', 'Signings, cuts, and movement', Clock3],
    ['Draft capital', 'Current and future selections', Sparkles],
  ] as const;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {tools.map(([title, description, Icon]) => (
        <article key={title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <Icon className="h-7 w-7 text-[var(--team-primary-text)]" />
          <h2 className="mt-6 text-2xl font-black">{title}</h2>
          <p className="mt-2 text-slate-600">
            {teamName} · {description}
          </p>
          <button className="mt-6 font-black text-[var(--team-primary-text)]">
            Explore {title.toLowerCase()} →
          </button>
        </article>
      ))}
      <Link
        href={getOffseasonManagerRoute('', teamAbbr)}
        className="flex items-center justify-between rounded-3xl bg-[var(--dark)] p-7 text-xl font-black text-[var(--team-on-dark)] md:col-span-2"
      >
        <span>Take control in Front Office</span>
        <ArrowRight />
      </Link>
    </div>
  );
}
