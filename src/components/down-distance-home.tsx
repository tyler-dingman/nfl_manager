'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Clock3,
  Flame,
  Menu,
  MessageCircle,
  Play,
  Radio,
  Search,
  Shield,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';

import { FiveWideLogo } from '@/components/branding/fivewide-logo';
import LoginButton from '@/components/auth/login-button';
import TeamThemeProvider from '@/components/team-theme-provider';
import type { TeamBriefing } from '@/features/content/types';
import { recordBriefingConsumed } from '@/features/content/consumption';
import { readFanTeamPreference, saveFanTeamPreference } from '@/features/team/fan-team-preference';
import { getOffseasonManagerRoute } from '@/features/team/offseason-manager-route';
import { useTeamStore, type Team } from '@/features/team/team-store';
import { useAuthUser } from '@/features/auth/auth-session';
import EditorialVisual from '@/components/editorial/editorial-visual';
import DailyTriviaWidget from '@/components/trivia/daily-trivia-widget';
import CatchUpCallout from '@/components/catch-up/catch-up-callout';
import PlaybookHero from '@/components/home/playbook-hero';
import HuddleStoryCard from '@/components/huddle/huddle-story-card';
import PrimaryNavigation from '@/components/primary-navigation';
import { SiteHeaderLogo, SiteHeaderShell } from '@/components/site-header-shell';

const watchItems = [
  {
    type: 'Press conference',
    title: 'Coach addresses the biggest questions from practice',
    time: '8:42',
  },
  { type: 'Film room', title: 'Why this new wrinkle could unlock the offense', time: '14:18' },
  { type: 'Local podcast', title: 'What reporters are hearing inside the building', time: '32:05' },
];

const fallbackWireItems = [
  { time: '11:42 AM', text: 'Team announces a roster move ahead of today’s practice.' },
  { time: '10:18 AM', text: 'Injury report brings encouraging news at a key position.' },
  { time: '9:05 AM', text: 'New comments clarify the plan for the starting lineup.' },
  { time: 'Yesterday', text: 'League transaction wire confirms a depth signing.' },
];

function TeamGateway({
  teams,
  onSelect,
  onClose,
}: {
  teams: Team[];
  onSelect: (team: Team) => void;
  onClose: () => void;
}) {
  return (
    <TeamThemeProvider>
      <div className="relative min-h-screen bg-[#F4D9B7] px-4 pb-12 pt-8 text-[#00172B] sm:px-6 sm:pt-12">
        <button
          type="button"
          onClick={onClose}
          className="fixed right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#00172B]/15 bg-white/50 text-[#00172B] transition hover:bg-white/80"
          aria-label="Close team selection"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto flex max-w-6xl flex-col items-center">
          <FiveWideLogo
            generic
            size={132}
            containerClassName="h-auto w-full max-w-[300px] overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[360px]"
            priority
          />
          <p className="mt-5 text-sm font-black uppercase tracking-[0.32em] text-[#FF3D38]">
            Keep it high and tight
          </p>
          <h1 className="mt-10 text-center text-4xl font-black tracking-tight sm:text-5xl">
            Pick your team. Enter your football world.
          </h1>
          <p className="mt-4 max-w-2xl text-center text-base leading-7 text-[#00172B]/65">
            Your news, videos, roster moves, fan conversations, and front-office tools begin with
            one choice.
          </p>
          <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {teams.map((team) => (
              <button
                type="button"
                key={team.id}
                onClick={() => onSelect(team)}
                className="group flex min-h-32 flex-col items-center justify-center rounded-2xl border border-[#00172B]/10 bg-white/55 p-3 text-center transition hover:-translate-y-1 hover:border-[#FF3D38]/50 hover:bg-white/85 hover:shadow-md"
              >
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-xl border p-2 shadow-sm transition group-hover:scale-105"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${team.color_primary} 12%, white)`,
                    borderColor: `color-mix(in srgb, ${team.color_secondary} 55%, transparent)`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={team.logo_url} alt="" className="h-full w-full object-contain" />
                </span>
                <span className="mt-3 text-xs font-bold leading-4 text-[#00172B]/75 group-hover:text-[#00172B]">
                  {team.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </TeamThemeProvider>
  );
}

export default function DownDistanceHome() {
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSelectedTeam, setHasSelectedTeam] = useState(false);
  const [briefings, setBriefings] = useState<TeamBriefing[]>([]);
  const [wireEntries, setWireEntries] = useState<
    Array<{ id: string; headline: string; occurredAt: string }>
  >([]);
  const [selectedBriefing, setSelectedBriefing] = useState<TeamBriefing | null>(null);
  const { user } = useAuthUser();
  const [personalization, setPersonalization] = useState<{
    primaryTeam?: { teamId?: string } | null;
    savedContent?: Array<{ id: string }>;
  } | null>(null);

  const openBriefing = useCallback(
    (briefing: TeamBriefing) => {
      setSelectedBriefing(briefing);
      if (user) void recordBriefingConsumed(briefing);
    },
    [user],
  );

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId),
    [selectedTeamId, teams],
  );
  const activeTeam = hasSelectedTeam ? selectedTeam : undefined;
  const teamName = activeTeam?.name ?? 'NFL';
  const teamAbbr = activeTeam?.abbr ?? 'NFL';
  const teamRouteSuffix = activeTeam ? `?team=${activeTeam.abbr}` : '';

  useEffect(() => {
    const savedTeamAbbr = readFanTeamPreference();
    if (!savedTeamAbbr) return;
    const savedTeam = teams.find((team) => team.abbr === savedTeamAbbr);
    if (!savedTeam) return;
    setSelectedTeamId(savedTeam.id);
    setHasSelectedTeam(true);
  }, [setSelectedTeamId, teams]);

  useEffect(() => {
    const controller = new AbortController();
    setBriefings([]);
    setSelectedBriefing(null);
    const loadBriefings = async () => {
      try {
        if (teamAbbr === 'NFL') return;
        const response = await fetch(`/api/content/homepage?team=${encodeURIComponent(teamAbbr)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          huddle?: TeamBriefing[];
          wire?: Array<{ id: string; headline: string; occurredAt: string }>;
        };
        setBriefings(payload.huddle ?? []);
        setWireEntries(payload.wire ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('[huddle] failed to load briefings', error);
        }
      }
    };
    void loadBriefings();
    return () => controller.abort();
  }, [teamAbbr]);

  useEffect(() => {
    if (!user) {
      setPersonalization(null);
      return;
    }
    void fetch('/api/user/home', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { personalization?: typeof personalization } | null) => {
        const nextPersonalization = body?.personalization ?? null;
        setPersonalization(nextPersonalization);
        const primaryTeamId = nextPersonalization?.primaryTeam?.teamId;
        const primaryTeam = teams.find((team) => team.abbr === primaryTeamId);
        if (primaryTeam) {
          setSelectedTeamId(primaryTeam.id);
          setHasSelectedTeam(true);
          void saveFanTeamPreference(primaryTeam.abbr);
        }
      });
  }, [setSelectedTeamId, teams, user]);

  const huddleCards = useMemo(
    () =>
      briefings.map((briefing) => ({
        id: briefing.id,
        label: briefing.category,
        title: briefing.headline,
        summary: briefing.summary,
        briefing,
      })),
    [briefings],
  );
  const displayedWireItems = wireEntries.length
    ? wireEntries.map((entry) => ({
        time: new Date(entry.occurredAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        }),
        text: entry.headline,
      }))
    : fallbackWireItems;
  const searchItems = useMemo(
    () => [
      ...huddleCards.map((item) => ({
        category: 'The Huddle',
        title: item.title,
        description: item.summary,
        href: '#huddle',
      })),
      ...watchItems.map((item) => ({
        category: 'Watch',
        title: item.title,
        description: `${item.type} · ${item.time}`,
        href: '#watch',
      })),
      ...displayedWireItems.map((item) => ({
        category: 'The Wire',
        title: item.text,
        description: item.time,
        href: '#wire',
      })),
      {
        category: 'Fan Discussion',
        title: 'Is the biggest position battle already decided?',
        description: `Trending conversation among ${teamName} fans`,
        href: '#fan-discussion',
      },
      {
        category: 'Front Office',
        title: `${teamName} depth chart, cap outlook, transactions, and draft capital`,
        description: 'Roster and team-building information',
        href: getOffseasonManagerRoute('', activeTeam?.abbr),
      },
    ],
    [activeTeam?.abbr, displayedWireItems, huddleCards, teamName],
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearchQuery
    ? searchItems.filter((item) =>
        `${item.category} ${item.title} ${item.description}`
          .toLowerCase()
          .includes(normalizedSearchQuery),
      )
    : searchItems.slice(0, 6);

  return (
    <TeamThemeProvider team={activeTeam}>
      <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
        {isTeamMenuOpen ? (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <TeamGateway
              teams={teams}
              onClose={() => setIsTeamMenuOpen(false)}
              onSelect={(team) => {
                setSelectedTeamId(team.id);
                saveFanTeamPreference(team.abbr);
                setHasSelectedTeam(true);
                setIsTeamMenuOpen(false);
              }}
            />
          </div>
        ) : null}
        {isSearchOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 px-4 pt-[8vh] backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Search Down & Distance"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setIsSearchOpen(false);
            }}
          >
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-200 px-5">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setIsSearchOpen(false);
                  }}
                  placeholder={`Search ${teamName} stories, videos, roster info...`}
                  className="h-16 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[65vh] overflow-y-auto p-3">
                <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  {normalizedSearchQuery ? `${searchResults.length} results` : 'Suggested'}
                </p>
                {searchResults.length ? (
                  searchResults.map((item) => (
                    <Link
                      key={`${item.category}-${item.title}`}
                      href={item.href}
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="group flex items-start gap-4 rounded-2xl px-3 py-3 transition hover:bg-slate-100"
                    >
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--team-on-primary)]">
                        <Search className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[var(--team-primary-text)]">
                          {item.category}
                        </span>
                        <span className="mt-1 block font-bold leading-5 text-slate-950">
                          {item.title}
                        </span>
                        <span className="mt-1 block truncate text-xs text-slate-500">
                          {item.description}
                        </span>
                      </span>
                      <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-600" />
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-12 text-center">
                    <Search className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 font-bold text-slate-700">No results for “{searchQuery}”</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try a player, topic, video, or feature.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {selectedBriefing ? (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 px-4 py-[6vh] backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={selectedBriefing.headline}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setSelectedBriefing(null);
            }}
          >
            <article className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="relative">
                <EditorialVisual
                  story={{
                    teamId: teamAbbr,
                    category: selectedBriefing.category,
                    headline: selectedBriefing.headline,
                    summary: selectedBriefing.summary,
                  }}
                  variant="hero"
                  decorative
                />
                <button
                  type="button"
                  onClick={() => setSelectedBriefing(null)}
                  className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/30"
                  aria-label="Close briefing"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-8 px-6 py-8 sm:px-10">
                <div>
                  <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                    {selectedBriefing.headline}
                  </h2>
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    {selectedBriefing.sourceCount} sources · Updated{' '}
                    {new Date(selectedBriefing.updatedAt).toLocaleString()}
                  </p>
                </div>
                <section>
                  <h3 className="text-xs font-black uppercase tracking-[0.22em] text-[var(--team-primary-text)]">
                    The short version
                  </h3>
                  <p className="mt-3 text-lg leading-8 text-slate-700">
                    {selectedBriefing.summary}
                  </p>
                </section>
                {selectedBriefing.whyItMatters ? (
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h3 className="font-black text-slate-950">Why it matters</h3>
                    <p className="mt-2 leading-7 text-slate-600">{selectedBriefing.whyItMatters}</p>
                  </section>
                ) : null}
                <section>
                  <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                    Sources
                  </h3>
                  <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
                    {selectedBriefing.sources.map((source) => (
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
        ) : null}
        <SiteHeaderShell>
          <SiteHeaderLogo teamAbbr={activeTeam?.abbr} generic={!activeTeam} />
          <PrimaryNavigation teamAbbr={activeTeam?.abbr} active="huddle" />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20 text-[var(--team-on-dark)] hover:bg-white/10"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-current/20 text-[var(--team-on-dark)] hover:bg-white/10 sm:flex"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTeamMenuOpen((open) => !open)}
                className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 pr-4 text-sm font-bold leading-none transition hover:bg-white/15"
                aria-expanded={isTeamMenuOpen}
              >
                {activeTeam ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeTeam.logo_url} alt="" className="h-6 w-6 object-contain" />
                  </span>
                ) : (
                  <Shield className="h-5 w-5 text-[var(--team-secondary-on-dark)]" />
                )}
                <span className="hidden sm:inline">
                  {activeTeam ? `${activeTeam.abbr} · Team Select` : 'Team Select'}
                </span>
                <Menu className="h-4 w-4" />
              </button>
            </div>
            <LoginButton />
          </div>
        </SiteHeaderShell>

        <PlaybookHero
          team={activeTeam}
          frontOfficeHref={getOffseasonManagerRoute('', activeTeam?.abbr)}
        />

        {user && personalization ? (
          <section className="border-b border-[#00172B]/10 bg-[#00172B] text-white">
            <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#F4D9B7]">
                  Your Down &amp; Distance
                </p>
                <p className="mt-1 text-sm font-bold text-white/75">
                  {personalization.primaryTeam?.teamId ?? teamAbbr} ·{' '}
                  {personalization.savedContent?.length ?? 0} saved
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-black">
                <Link
                  href="/account/content"
                  className="rounded-full bg-white px-4 py-2 text-[#00172B] hover:bg-[#F4D9B7]"
                >
                  Open saved content
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href={`/game-day${teamRouteSuffix}`}
            className="mb-7 grid overflow-hidden rounded-3xl bg-[var(--dark)] text-[var(--team-on-dark)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg md:grid-cols-[1fr_auto]"
          >
            <div className="p-6 sm:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--team-secondary-on-dark)]">
                Your tailgate is open
              </p>
              <h2 className="mt-3 text-3xl font-black">{teamAbbr} Game Day</h2>
              <p className="mt-2 text-sm text-[var(--team-light-on-dark)]">
                Watch on the TV. React, predict, and talk trash here.
              </p>
            </div>
            <span className="flex min-h-20 items-center justify-center bg-[var(--primary)] px-8 font-black text-[var(--team-on-primary)]">
              GET IN HERE <ArrowRight className="ml-3 h-5 w-5" />
            </span>
          </Link>
          <section id="huddle" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              {user && activeTeam ? <CatchUpCallout teamId={activeTeam.abbr} /> : null}
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-[var(--team-primary-text)]">
                    <Sparkles className="h-4 w-4" /> The Huddle
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                    What {teamName} fans need to know
                  </h2>
                </div>
                <Link
                  href={`/huddle${teamRouteSuffix}`}
                  className="hidden text-sm font-bold text-[var(--team-primary-text)] sm:block"
                >
                  See the whole field →
                </Link>
              </div>
              <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                {huddleCards.map((item, index) => (
                  <HuddleStoryCard
                    key={item.id}
                    id={item.id}
                    teamId={teamAbbr}
                    headline={item.title}
                    summary={item.summary}
                    category={item.label}
                    status={item.briefing.status}
                    sourceCount={item.briefing.sourceCount}
                    updatedAt={item.briefing.updatedAt}
                    materialUpdateCount={item.briefing.materialUpdateCount}
                    lead={index === 0}
                    onOpen={() => openBriefing(item.briefing)}
                  />
                ))}
                {!huddleCards.length ? (
                  <div className="rounded-2xl border border-dashed border-[#00172B]/15 bg-white/55 p-8 text-sm font-semibold text-[#40556b] md:col-span-2 xl:col-span-3">
                    No verified Huddle stories are ready for {teamName} yet.
                  </div>
                ) : null}
              </div>
            </div>
            <aside className="space-y-6">
              <Link
                href={`/three-and-out${teamRouteSuffix}`}
                className="block overflow-hidden rounded-2xl bg-[var(--primary)] text-[var(--team-on-primary)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--team-on-primary)]">
                      What matters right now
                    </span>
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">
                      3 stories
                    </span>
                  </div>
                  <h3 className="mt-8 text-3xl font-black leading-none">Three and Out</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--team-on-primary)]">
                    The three biggest {teamAbbr} stories, ranked, sourced, and explained.
                  </p>
                  <span className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--secondary)] font-black text-[var(--team-on-secondary)]">
                    Open Three and Out <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
              <section
                id="wire"
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-black">
                    <Radio className="h-4 w-4 text-red-600" /> The Wire
                  </h3>
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> Live
                  </span>
                </div>
                <div className="mt-4 divide-y divide-slate-100">
                  {displayedWireItems.map((item) => (
                    <div key={`${item.time}-${item.text}`} className="py-4 first:pt-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.time}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-5">{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </section>

          <section className="mt-10">
            <DailyTriviaWidget teamId={teamAbbr} />
          </section>

          <section id="watch" className="mt-10 rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--team-secondary-on-dark)]">
                  Watch
                </p>
                <h2 className="mt-2 text-2xl font-black">Worth your time today</h2>
              </div>
              <Link href={`/watch${teamRouteSuffix}`} className="text-sm font-bold text-white/60">
                Browse all →
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {watchItems.map((item, index) => (
                <article key={item.title} className="group overflow-hidden rounded-2xl bg-white/5">
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--primary)] to-[var(--dark)]">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg transition group-hover:scale-105">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </span>
                    <span className="absolute bottom-3 right-3 rounded bg-black/75 px-2 py-1 text-xs font-bold">
                      {item.time}
                    </span>
                    <span className="absolute left-3 top-3 text-6xl font-black text-white/5">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--team-secondary-on-dark)]">
                      {item.type}
                    </p>
                    <h3 className="mt-2 font-bold leading-6">{item.title}</h3>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <div
              id="fan-discussion"
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                    <Flame className="h-4 w-4" /> Fan discussion
                  </p>
                  <h2 className="mt-2 text-2xl font-black">Fans are talking about...</h2>
                </div>
                <MessageCircle className="h-7 w-7 text-slate-300" />
              </div>
              <div className="mt-7 rounded-2xl bg-slate-50 p-5">
                <h3 className="text-xl font-black">
                  Is the biggest position battle already decided?
                </h3>
                <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> 2,100 comments
                  </span>
                  <span className="flex items-center gap-1 text-orange-600">
                    <Flame className="h-3.5 w-3.5" /> Trending
                  </span>
                </div>
                <p className="mt-5 border-l-4 border-[var(--secondary)] pl-4 text-sm leading-6 text-slate-600">
                  The conversation shifted after three straight positive practice reports. Fans are
                  increasingly convinced the competition has a clear leader.
                </p>
                <button className="mt-5 text-sm font-black text-[var(--team-primary-text)]">
                  Open the original discussion →
                </button>
              </div>
            </div>
            <div
              id="front-office"
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[var(--team-primary-text)]">
                <Shield className="h-4 w-4" /> Front Office
              </p>
              <h2 className="mt-2 text-2xl font-black">Build the complete picture</h2>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {[
                  { icon: Users, label: 'Depth chart', value: '53 players' },
                  { icon: BarChart3, label: 'Cap outlook', value: '$40.8M space' },
                  { icon: Clock3, label: 'Transactions', value: '4 this week' },
                  { icon: Shield, label: 'Draft capital', value: '8 selections' },
                ].map((item) => (
                  <button
                    key={item.label}
                    className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[var(--primary)] hover:bg-slate-50"
                  >
                    <item.icon className="h-5 w-5 text-[var(--team-primary-text)]" />
                    <span className="mt-4 block text-xs font-bold text-slate-500">
                      {item.label}
                    </span>
                    <span className="mt-1 block font-black">{item.value}</span>
                  </button>
                ))}
              </div>
              <Link
                href={getOffseasonManagerRoute('', activeTeam?.abbr)}
                className="mt-5 flex w-full items-center justify-between rounded-2xl bg-[var(--dark)] p-4 font-black text-[var(--team-on-dark)]"
              >
                <span>Take control in Front Office</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </section>
        </main>

        <footer className="mt-12 border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <p className="font-semibold">Down & Distance · Keep it high and tight.</p>
            <div className="flex gap-5 font-semibold">
              <span>About</span>
              <span>Sources</span>
              <span>Privacy</span>
              <span>Terms</span>
            </div>
          </div>
        </footer>
      </div>
    </TeamThemeProvider>
  );
}
