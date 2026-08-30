'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import TeamThemeProvider from '@/components/team-theme-provider';
import type { TeamBriefing } from '@/features/content/types';
import { readFanTeamPreference, saveFanTeamPreference } from '@/features/team/fan-team-preference';
import { useTeamStore, type Team } from '@/features/team/team-store';

const huddleItems = [
  {
    label: 'Top story',
    title: 'The position battle everyone is watching just took another turn',
    summary:
      'A strong practice, a revealing coach quote, and a wave of fan reaction have changed the conversation.',
    meta: '12 sources · Updated 18 min ago',
  },
  {
    label: 'Roster watch',
    title: 'One under-the-radar player is making a serious push for snaps',
    summary:
      'Local reporters agree the depth chart may be less settled than it looked entering the week.',
    meta: '7 sources · Updated 41 min ago',
  },
  {
    label: 'What it means',
    title: 'The latest move creates a real decision for the front office',
    summary:
      'Here is the cap, roster, and scheme context behind today’s most important transaction.',
    meta: 'D&D analysis · 4 min read',
  },
];

const watchItems = [
  {
    type: 'Press conference',
    title: 'Coach addresses the biggest questions from practice',
    time: '8:42',
  },
  { type: 'Film room', title: 'Why this new wrinkle could unlock the offense', time: '14:18' },
  { type: 'Local podcast', title: 'What reporters are hearing inside the building', time: '32:05' },
];

const wireItems = [
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
      <div className="relative min-h-screen bg-[var(--dark)] px-4 pb-12 pt-8 text-[var(--light)] sm:px-6 sm:pt-12">
        <button
          type="button"
          onClick={onClose}
          className="fixed right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
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
          <p className="mt-5 text-sm font-black uppercase tracking-[0.32em] text-[var(--secondary)]">
            Keep it high and tight
          </p>
          <h1 className="mt-10 text-center text-4xl font-black tracking-tight sm:text-5xl">
            Pick your team. Enter your football world.
          </h1>
          <p className="mt-4 max-w-2xl text-center text-base leading-7 text-white/60">
            Your news, videos, roster moves, fan conversations, and front-office tools begin with
            one choice.
          </p>
          <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {teams.map((team) => (
              <button
                type="button"
                key={team.id}
                onClick={() => onSelect(team)}
                className="group flex min-h-32 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center transition hover:-translate-y-1 hover:border-[var(--secondary)] hover:bg-white/10"
              >
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-xl border p-2 shadow-sm transition group-hover:scale-105"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${team.color_primary} 24%, var(--dark))`,
                    borderColor: `color-mix(in srgb, ${team.color_secondary} 55%, transparent)`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={team.logo_url} alt="" className="h-full w-full object-contain" />
                </span>
                <span className="mt-3 text-xs font-bold leading-4 text-white/75 group-hover:text-white">
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
  const [selectedBriefing, setSelectedBriefing] = useState<TeamBriefing | null>(null);

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
        const response = await fetch(`/api/content/huddle?team=${encodeURIComponent(teamAbbr)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { briefings?: TeamBriefing[] };
        setBriefings(payload.briefings ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('[huddle] failed to load briefings', error);
        }
      }
    };
    void loadBriefings();
    return () => controller.abort();
  }, [teamAbbr]);

  const huddleCards = useMemo(
    () =>
      briefings.length
        ? briefings.map((briefing) => ({
            id: briefing.id,
            label: briefing.category,
            title: briefing.headline,
            summary: briefing.summary,
            meta: `${briefing.sourceCount} sources · Updated ${new Date(briefing.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
            briefing,
          }))
        : huddleItems.map((item, index) => ({
            ...item,
            id: `fallback-${index}`,
            briefing: null,
          })),
    [briefings],
  );
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
      ...wireItems.map((item) => ({
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
        href: '#front-office',
      },
      {
        category: 'Be the GM',
        title: 'Offseason Manager',
        description: 'Manage the cap, contracts, trades, free agency, and draft',
        href: '/offseasonmanager',
      },
    ],
    [huddleCards, teamName],
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
      <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
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
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
                        <Search className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[var(--primary)]">
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
              <div className="relative bg-[var(--dark)] px-6 py-8 text-white sm:px-10 sm:py-10">
                <button
                  type="button"
                  onClick={() => setSelectedBriefing(null)}
                  className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
                  aria-label="Close briefing"
                >
                  <X className="h-5 w-5" />
                </button>
                <p className="pr-12 text-xs font-black uppercase tracking-[0.24em] text-[var(--secondary)]">
                  {selectedBriefing.category}
                </p>
                <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  {selectedBriefing.headline}
                </h2>
                <p className="mt-5 text-xs font-semibold text-white/50">
                  {selectedBriefing.sourceCount} sources · Updated{' '}
                  {new Date(selectedBriefing.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="space-y-8 px-6 py-8 sm:px-10">
                <section>
                  <h3 className="text-xs font-black uppercase tracking-[0.22em] text-[var(--primary)]">
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
                          <span className="block text-xs font-black uppercase tracking-[0.16em] text-[var(--primary)]">
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
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--dark)] text-[var(--light)] shadow-sm">
          <div className="mx-auto flex h-24 max-w-[1440px] items-center gap-5 px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="mb-3 mt-4 shrink-0" aria-label="Down & Distance home">
              <FiveWideLogo
                size={62}
                teamAbbr={activeTeam?.abbr}
                generic={!activeTeam}
                containerClassName="h-auto w-32 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 sm:w-40"
                priority
              />
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-semibold lg:flex">
              <Link href={`/huddle${teamRouteSuffix}`} className="text-white">
                The Huddle
              </Link>
              <Link
                href={`/watch${teamRouteSuffix}`}
                className="text-white/65 transition hover:text-white"
              >
                Watch
              </Link>
              <Link
                href={`/wire${teamRouteSuffix}`}
                className="text-white/65 transition hover:text-white"
              >
                The Wire
              </Link>
              <Link
                href={`/front-office${teamRouteSuffix}`}
                className="text-white/65 transition hover:text-white"
              >
                Front Office
              </Link>
              <Link href="/merch" className="text-white/65 transition hover:text-white">
                Merch
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/75 hover:bg-white/10"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/75 hover:bg-white/10 sm:flex"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTeamMenuOpen((open) => !open)}
                  className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 pr-4 text-sm font-bold transition hover:bg-white/15"
                  aria-expanded={isTeamMenuOpen}
                >
                  {activeTeam ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeTeam.logo_url} alt="" className="h-6 w-6 object-contain" />
                    </span>
                  ) : (
                    <Shield className="h-5 w-5 text-[var(--secondary)]" />
                  )}
                  <span>{activeTeam ? `${activeTeam.abbr} · Team Select` : 'Team Select'}</span>
                  <Menu className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="relative overflow-hidden bg-[var(--primary)] text-[var(--light)]">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--secondary)]" />
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[var(--dark)] opacity-25 blur-3xl" />
          <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8 lg:py-14">
            <div className="relative max-w-4xl">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {activeTeam ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeTeam.logo_url} alt="" className="h-10 w-10 object-contain" />
                  ) : (
                    <Shield className="h-7 w-7 text-[var(--primary)]" />
                  )}
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--secondary)]">
                    Keep it high and tight
                  </p>
                  <p className="mt-1 text-sm text-white/55">Saturday, August 29 · Team briefing</p>
                </div>
              </div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Everything {teamName}, all in one place.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                The stories, videos, roster moves, and fan conversations that matter—ranked and
                explained for you.
              </p>
            </div>
            <div className="relative flex items-end">
              <Link
                href="/offseasonmanager"
                className="group flex min-w-64 items-center justify-between gap-6 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--secondary)]">
                    Be the GM
                  </span>
                  <span className="mt-1 block text-lg font-bold">Open Offseason Manager</span>
                </span>
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
          <section id="huddle" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-[var(--primary)]">
                    <Sparkles className="h-4 w-4" /> The Huddle
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                    What {teamName} fans need to know
                  </h2>
                </div>
                <Link
                  href={`/huddle${teamRouteSuffix}`}
                  className="hidden text-sm font-bold text-[var(--primary)] sm:block"
                >
                  View full briefing →
                </Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {huddleCards.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => item.briefing && setSelectedBriefing(item.briefing)}
                    disabled={!item.briefing}
                    className={`group flex flex-col justify-start overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:cursor-default ${index === 0 ? 'lg:col-span-2 lg:row-span-2' : ''}`}
                  >
                    <div
                      className={`relative overflow-hidden bg-[var(--dark)] ${index === 0 ? 'h-44' : 'h-28'}`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/80 via-transparent to-black/70" />
                      <div className="absolute left-5 top-5 rounded-full bg-[var(--secondary)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--dark)]">
                        {item.label}
                      </div>
                      <div className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur">
                        {index === 0 ? <Zap className="h-5 w-5" /> : <Radio className="h-5 w-5" />}
                      </div>
                    </div>
                    <div className={index === 0 ? 'p-6' : 'p-5'}>
                      <h3
                        className={`${index === 0 ? 'text-2xl' : 'text-lg'} font-black leading-tight tracking-tight`}
                      >
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>
                      <p className="mt-4 text-xs font-semibold text-slate-400">{item.meta}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <aside className="space-y-6">
              <section className="overflow-hidden rounded-2xl bg-[var(--primary)] text-white shadow-sm">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/65">
                      D&D Daily
                    </span>
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">
                      2:04
                    </span>
                  </div>
                  <h3 className="mt-8 text-3xl font-black leading-none">Two-Minute Drill</h3>
                  <p className="mt-3 text-sm leading-6 text-white/70">
                    Today’s essential {teamAbbr} update, sourced and summarized.
                  </p>
                  <button className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--secondary)] font-black text-[var(--dark)]">
                    <Play className="h-4 w-4 fill-current" /> Play today’s briefing
                  </button>
                </div>
              </section>
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
                  {wireItems.map((item) => (
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

          <section id="watch" className="mt-10 rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--secondary)]">
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
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--secondary)]">
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
                <button className="mt-5 text-sm font-black text-[var(--primary)]">
                  Open the original discussion →
                </button>
              </div>
            </div>
            <div
              id="front-office"
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[var(--primary)]">
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
                    <item.icon className="h-5 w-5 text-[var(--primary)]" />
                    <span className="mt-4 block text-xs font-bold text-slate-500">
                      {item.label}
                    </span>
                    <span className="mt-1 block font-black">{item.value}</span>
                  </button>
                ))}
              </div>
              <Link
                href="/offseasonmanager"
                className="mt-5 flex w-full items-center justify-between rounded-2xl bg-[var(--dark)] p-4 font-black text-[var(--light)]"
              >
                <span>Take control in Offseason Manager</span>
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
