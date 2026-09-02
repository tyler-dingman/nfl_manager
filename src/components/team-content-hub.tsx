'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bookmark, Clock3, Play, Radio, Shield, Sparkles, Users } from 'lucide-react';

import LoginButton from '@/components/auth/login-button';
import EditorialVisual from '@/components/editorial/editorial-visual';
import TeamThemeProvider from '@/components/team-theme-provider';
import PrimaryNavigation from '@/components/primary-navigation';
import { SiteHeaderLogo, SiteHeaderShell } from '@/components/site-header-shell';
import ThreeAndOutExperience from '@/components/three-and-out/three-and-out-experience';
import type { TeamBriefing } from '@/features/content/types';
import { recordBriefingConsumed } from '@/features/content/consumption';
import {
  clearFanTeamPreference,
  readCanonicalFanTeamPreference,
  saveFanTeamPreference,
} from '@/features/team/fan-team-preference';
import { getOffseasonManagerRoute } from '@/features/team/offseason-manager-route';
import { useTeamStore } from '@/features/team/team-store';
import { useAuthUser } from '@/features/auth/auth-session';

type HubKind = 'huddle' | 'three-and-out' | 'watch' | 'wire' | 'front-office';

const hubMeta = {
  huddle: {
    eyebrow: 'The Huddle',
    title: 'The stories that matter, without the article pileup.',
    description:
      'Important topics gathered across sources, condensed, and linked back to the original coverage.',
  },
  'three-and-out': {
    eyebrow: 'Three and Out',
    title: 'The three things you need to know right now.',
    description:
      'The biggest ongoing football stories, ranked by importance, sourced, and updated as they change.',
  },
  watch: {
    eyebrow: 'Watch',
    title: 'Your football video hub.',
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

const videos = [
  ['Press conference', 'Coach addresses the biggest questions from practice', '8:42'],
  ['Film room', 'Why this new wrinkle could unlock the offense', '14:18'],
  ['Local show', 'What reporters are hearing inside the building', '22:06'],
  ['Player interview', 'A veteran explains what has changed this season', '6:55'],
  ['Podcast', 'The roster decisions that could shape opening week', '38:21'],
  ['Fan creator', 'Five plays that explain the latest position battle', '11:47'],
];

const wireUpdates = [
  ['11:42 AM', 'Team announces a roster move ahead of today’s practice.', 'Official'],
  ['10:18 AM', 'Injury update brings encouraging news at a key position.', 'Injury'],
  ['9:05 AM', 'New comments clarify the plan for the starting lineup.', 'Report'],
  ['Yesterday', 'League transaction wire confirms a depth signing.', 'Transaction'],
  ['Yesterday', 'Practice participation provides a new signal in a position battle.', 'Practice'],
];

export default function TeamContentHub({ kind }: { kind: HubKind }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const teams = useTeamStore((state) => state.teams);
  const requestedAbbr = searchParams?.get('team')?.toUpperCase();
  const [persistedAbbr, setPersistedAbbr] = useState<string | null>(null);
  const currentPath = pathname ?? `/${kind}`;
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
        <SiteHeaderShell>
          <SiteHeaderLogo teamAbbr={activeTeam?.abbr} generic={!activeTeam} />
          <PrimaryNavigation teamAbbr={activeTeam?.abbr} active={kind === 'wire' ? null : kind} />
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--team-on-dark)]">
              <span className="hidden sm:inline">Team</span>
              <select
                value={activeTeam?.abbr ?? ''}
                onChange={(event) => {
                  if (event.target.value) {
                    saveFanTeamPreference(event.target.value);
                    setPersistedAbbr(event.target.value);
                  } else {
                    clearFanTeamPreference();
                    setPersistedAbbr(null);
                  }
                  router.push(
                    event.target.value ? `${currentPath}?team=${event.target.value}` : currentPath,
                  );
                }}
                className="h-10 rounded-full border border-current/20 bg-white/10 px-4 text-sm font-bold leading-none normal-case tracking-normal text-[var(--team-on-dark)] outline-none"
              >
                <option value="" className="text-slate-950">
                  NFL
                </option>
                {teams.map((team) => (
                  <option key={team.id} value={team.abbr} className="text-slate-950">
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <LoginButton />
          </div>
        </SiteHeaderShell>

        <section className="bg-[var(--dark)] text-[var(--team-on-dark)]">
          <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--team-secondary-on-dark)]">
              {teamName} · {meta.eyebrow}
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
              {meta.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--team-light-on-dark)]">
              {meta.description}
            </p>
          </div>
        </section>

        <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          {kind === 'huddle' ? <HuddleGrid briefings={briefings} teamAbbr={teamAbbr} /> : null}
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
          {kind === 'watch' ? <WatchGrid /> : null}
          {kind === 'wire' ? <WireTimeline /> : null}
          {kind === 'front-office' ? <FrontOffice teamName={teamName} teamAbbr={teamAbbr} /> : null}
        </main>
      </div>
    </TeamThemeProvider>
  );
}

function HuddleGrid({ briefings, teamAbbr }: { briefings: TeamBriefing[]; teamAbbr: string }) {
  const { user, hydrated } = useAuthUser();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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
      window.location.assign(`/login?next=${encodeURIComponent(`/huddle?team=${teamAbbr}`)}`);
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
              href: `/huddle?team=${teamAbbr}`,
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

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {briefings.length ? (
        briefings.map((briefing) => (
          <article
            key={briefing.id}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <EditorialVisual
              story={{
                teamId: briefing.teamAbbr,
                category: briefing.category,
                headline: briefing.headline,
                summary: briefing.summary,
              }}
              variant="card"
              decorative
            />
            <div className="p-7">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--team-primary-text)]">
                <Sparkles className="h-4 w-4" /> {briefing.category}
              </p>
              <h2 className="mt-4 text-2xl font-black leading-tight">{briefing.headline}</h2>
              <p className="mt-4 leading-7 text-slate-600">{briefing.summary}</p>
              <p className="mt-6 text-xs font-bold text-slate-400">
                {briefing.sourceCount} sources
              </p>
              <button
                type="button"
                onClick={() => void toggleSaved(briefing)}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-[var(--team-primary-text)] hover:bg-slate-50"
              >
                <Bookmark
                  className={`h-4 w-4 ${savedIds.has(briefing.id) ? 'fill-current' : ''}`}
                />
                {savedIds.has(briefing.id) ? 'Saved' : user ? 'Save' : 'Sign in to save'}
              </button>
              <div className="mt-4 border-t border-slate-100 pt-4">
                {briefing.sources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      if (user) void recordBriefingConsumed(briefing);
                    }}
                    className="mb-2 flex items-center justify-between gap-4 text-sm font-bold text-[var(--team-primary-text)] hover:underline"
                  >
                    <span>
                      {source.publisher}: {source.title}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          </article>
        ))
      ) : (
        <p className="text-slate-500">Building today’s briefing…</p>
      )}
    </div>
  );
}

function WatchGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map(([type, title, time], index) => (
        <article
          key={title}
          className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm"
        >
          <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-[var(--primary)] to-[var(--dark)]">
            <Play className="h-12 w-12 rounded-full bg-white p-3 text-slate-950" />
            <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs font-bold">
              {time}
            </span>
            <span className="absolute left-4 top-3 text-5xl font-black text-white/10">
              0{index + 1}
            </span>
          </div>
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--team-secondary-on-dark)]">
              {type}
            </p>
            <h2 className="mt-2 text-lg font-black">{title}</h2>
          </div>
        </article>
      ))}
    </div>
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
