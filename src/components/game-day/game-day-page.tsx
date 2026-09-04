'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  CloudSun,
  Flame,
  Gift,
  MapPin,
  Send,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react';
import HuddleStoryCard from '@/components/huddle/huddle-story-card';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { useAuthUser } from '@/features/auth/auth-session';
import type { TeamBriefing } from '@/features/content/types';
import { readCanonicalFanTeamPreference } from '@/features/team/fan-team-preference';
import { useTeamStore } from '@/features/team/team-store';
import { getTeamFlavor } from '@/lib/team-flavor';
import type { GameDayRoom, SimulationAction } from '../../../packages/game-day';

const reactions = ['🔥', '😂', '🤯', '👏', '🏈', '🍻', '❤️', '💩'];
const drives = ['TOUCHDOWN', 'FIELD_GOAL', 'PUNT', 'TURNOVER'];
const simulations: SimulationAction[] = [
  'START_TAILGATE',
  'KICKOFF',
  'START_DRIVE',
  'FIRST_DOWN',
  'BIG_PLAY',
  'TOUCHDOWN_HOME',
  'FIELD_GOAL_HOME',
  'TURNOVER_HOME',
  'TOUCHDOWN_AWAY',
  'INJURY',
  'HALFTIME',
  'START_3Q',
  'FINAL',
];
const timeline = [
  ['8 AM', 10, 4 * 60 * 60 * 1000],
  ['9 AM', 25, 3 * 60 * 60 * 1000],
  ['10 AM', 40, 2 * 60 * 60 * 1000],
  ['11 AM', 90, 60 * 60 * 1000],
  ['11:59 AM', 100, 60 * 1000],
] as const;
const fixtures: Record<string, { opponent: string; venue: string; city: string }> = {
  KC: { opponent: 'LAC', venue: 'GEHA Field at Arrowhead Stadium', city: 'Kansas City, MO' },
  BAL: { opponent: 'PIT', venue: 'M&T Bank Stadium', city: 'Baltimore, MD' },
  CHI: { opponent: 'GB', venue: 'Soldier Field', city: 'Chicago, IL' },
  GB: { opponent: 'CHI', venue: 'Lambeau Field', city: 'Green Bay, WI' },
};
const stadiumHeroAssets: Partial<Record<string, string>> = {
  KC: '/images/gameday/stadium/kc/kc_full.png',
};
const nextSundayNoon = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  d.setHours(12, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
  return d;
};
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    String(Math.floor(s / 3600)).padStart(2, '0'),
    String(Math.floor(s / 60) % 60).padStart(2, '0'),
    String(s % 60).padStart(2, '0'),
  ];
};

function Stadium({ fill, teamId }: { fill: number; teamId: string }) {
  const heroAsset = stadiumHeroAssets[teamId];
  if (heroAsset) {
    return (
      <div className="game-day-stadium game-day-stadium-photo" aria-hidden="true">
        <Image
          src={heroAsset}
          alt=""
          fill
          priority
          sizes="100vw"
          className="game-day-stadium-image object-cover"
        />
        <div className="game-day-stadium-vignette" />
      </div>
    );
  }
  return (
    <div className="game-day-stadium" aria-hidden="true">
      <div className="game-day-lights" />
      <div className="game-day-lot-lines" />
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="game-day-car"
          style={{
            display: i < Math.max(2, Math.round(fill / 9)) ? 'block' : 'none',
            left: `${8 + ((i * 17) % 82)}%`,
            top: `${12 + ((i * 23) % 72)}%`,
            transform: `rotate(${(i % 4) * 18 - 22}deg)`,
          }}
        />
      ))}
      <div className="game-day-stadium-bowl">
        <div className="game-day-field">D&amp;D</div>
      </div>
    </div>
  );
}

export default function GameDayPage() {
  const router = useRouter(),
    params = useSearchParams(),
    { user, hydrated } = useAuthUser(),
    teams = useTeamStore((s) => s.teams);
  const [teamId, setTeamId] = useState('KC'),
    [room, setRoom] = useState<GameDayRoom | null>(null),
    [code, setCode] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [stories, setStories] = useState<TeamBriefing[]>([]),
    [now, setNow] = useState(Date.now()),
    [devFill, setDevFill] = useState<number | null>(null),
    [devKickoffAt, setDevKickoffAt] = useState<number | null>(null);
  useEffect(() => {
    const requested = params?.get('team')?.toUpperCase();
    if (requested && teams.some((t) => t.abbr === requested)) {
      setTeamId(requested);
      return;
    }
    void readCanonicalFanTeamPreference().then((t) => setTeamId(t || 'KC'));
  }, [params, teams]);
  const team = teams.find((t) => t.abbr === teamId),
    fixture = fixtures[teamId] ?? {
      opponent: 'NFL',
      venue: `${team?.name ?? teamId} home stadium`,
      city: 'Stadium location',
    },
    flavor = getTeamFlavor(teamId);
  const load = useCallback(
    async (id?: string) => {
      if (!user) return;
      const r = await fetch(
          id ? `/api/game-day/rooms/${id}` : `/api/game-day/rooms?team=${teamId}`,
        ),
        b = await r.json();
      if (r.ok) setRoom(b.room || null);
    },
    [teamId, user],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    const id = window.setInterval(() => void load(roomId), 4000);
    return () => window.clearInterval(id);
  }, [load, roomId]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/content/homepage?team=${teamId}`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { huddle?: TeamBriefing[] } | null) => setStories(b?.huddle ?? []))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setStories([]);
      });
    return () => c.abort('team changed');
  }, [teamId]);
  const action = async (body: object) => {
    if (!room) return;
    setError('');
    const r = await fetch(`/api/game-day/rooms/${room.id}/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      b = await r.json().catch(() => null);
    if (!r.ok) {
      setError(b?.error || 'That play did not work.');
      return;
    }
    await load(room.id);
  };
  const start = async (kind: 'CREATE' | 'JOIN') => {
    setError('');
    const r = await fetch('/api/game-day/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          kind === 'CREATE' ? { action: 'CREATE', teamId } : { action: 'JOIN', code },
        ),
      }),
      b = await r.json();
    if (!r.ok) {
      setError(b.error);
      return;
    }
    await load(b.id);
  };
  if (!hydrated) return null;
  const game = room?.gameState,
    live = room?.status === 'LIVE' || room?.status === 'HALFTIME',
    final = room?.status === 'POSTGAME',
    kickoff = room ? new Date(room.kickoffAt) : nextSundayNoon(),
    remaining = Math.max(0, (devKickoffAt ?? kickoff.getTime()) - now),
    countdown = clock(remaining),
    fill = devFill ?? Math.max(10, Math.min(100, Math.round(100 - remaining / 144000))),
    opponent = game
      ? game.homeTeamId === teamId
        ? game.awayTeamId
        : game.homeTeamId
      : fixture.opponent;
  return (
    <TeamThemeProvider team={team}>
      <div className="game-day-page min-h-screen bg-[#080d11] text-[#fff8ed]">
        <MainSiteHeader teamAbbr={teamId} />
        <main>
          <section className="game-day-hero relative overflow-hidden border-b border-white/15">
            <Stadium fill={fill} teamId={teamId} />
            <div className="relative z-10 mx-auto min-h-[590px] max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
              <h1 className="mt-8 max-w-[780px] text-[clamp(2.9rem,7vw,6.6rem)] font-black uppercase leading-[0.84] tracking-[-0.055em] text-[#fff8ed] sm:mt-12">
                Sunday<span className="block text-[var(--secondary)]">Funday</span>
              </h1>
              <div className="mx-auto mt-20 max-w-md rounded-3xl border border-white/20 bg-black/80 p-6 text-center shadow-2xl backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[.22em] text-white/70">
                  {final ? 'Final' : live ? 'Game status' : 'Kickoff in'}
                </p>
                {live || final ? (
                  <p className="mt-3 text-4xl font-black">
                    {game?.awayTeamId} {game?.awayScore} · {game?.homeTeamId} {game?.homeScore}
                  </p>
                ) : (
                  <div
                    className="mt-3 grid grid-cols-3 tabular-nums"
                    aria-label={`${countdown[0]} hours ${countdown[1]} minutes ${countdown[2]} seconds until kickoff`}
                  >
                    {countdown.map((v, i) => (
                      <div key={i}>
                        <p className="text-4xl font-black sm:text-5xl">{v}</p>
                        <p className="text-[10px] font-black text-white/60">
                          {['HRS', 'MIN', 'SEC'][i]}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-5 border-t border-white/15 pt-4 text-xs font-bold uppercase text-white/80">
                  {live
                    ? room?.status === 'HALFTIME'
                      ? 'Halftime'
                      : `Q${game?.quarter} · ${game?.clock}`
                    : `${kickoff.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · 12:00 PM CT`}
                </p>
              </div>
              <div className="absolute right-8 top-8 hidden w-64 rounded-3xl border border-white/20 bg-black/80 p-5 lg:block">
                <p className="text-xs font-black uppercase tracking-wider">Parking atmosphere</p>
                <p className="mt-3 text-5xl font-black">{fill}%</p>
                <p className="text-xs text-white/60">Simulated tailgate buildup</p>
                <div className="mt-5 flex justify-between">
                  {timeline.map(([label, value]) => (
                    <span key={label} className="text-center text-[9px] text-white/60">
                      <i
                        className={`mx-auto mb-2 block h-2.5 w-2.5 rounded-full ${fill >= value ? 'bg-[var(--secondary)]' : 'bg-white/30'}`}
                      />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <div className="mx-auto max-w-[1440px] space-y-5 px-4 pb-14 sm:px-6 lg:px-8">
            <section className="-mt-10 grid gap-3 md:grid-cols-[.8fr_1.4fr_1fr]">
              <Info icon={CloudSun} label="Weather · preview">
                <p className="text-4xl font-black">78°</p>
                <p className="font-bold">Partly cloudy</p>
                <small>Fixture until a weather provider is connected</small>
              </Info>
              <Info icon={Sparkles} label="Odds · preview">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat l="Moneyline" v={`${teamId} -230`} />
                  <Stat l="Spread" v={`${teamId} -5.5`} />
                  <Stat l="O/U" v="47.5" />
                </div>
                <small>Fixture data · no sportsbook provider connected</small>
              </Info>
              <Info icon={MapPin} label="Location">
                <p className="text-xl font-black">{fixture.venue}</p>
                <p className="text-sm text-white/60">{fixture.city}</p>
              </Info>
            </section>
            <section className="rounded-3xl border border-white/15 bg-[#101416] p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black uppercase">
                    <Flame className="text-[var(--secondary)]" />
                    Hot Read
                  </h2>
                  <p className="text-sm text-white/55">Game Day stories from The Beat</p>
                </div>
                <Link
                  href={`/the-beat?team=${teamId}`}
                  className="text-sm font-black text-[var(--secondary)]"
                >
                  View all <ChevronRight className="inline h-4 w-4" />
                </Link>
              </div>
              {stories.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {stories.slice(0, 4).map((s) => (
                    <HuddleStoryCard
                      key={s.id}
                      {...s}
                      teamId={s.teamAbbr}
                      onOpen={() => router.push(`/the-beat?team=${teamId}&story=${s.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/20 p-6 text-sm text-white/55">
                  Hot Reads will appear as The Beat publishes updates.
                </p>
              )}
            </section>
            <Community
              {...{
                user,
                room,
                teamId,
                opponent,
                code,
                setCode,
                message,
                setMessage,
                start,
                action,
                error,
                live,
              }}
              name={`${flavor.fanbaseName ?? team?.name ?? teamId} Chat`}
            />
            {process.env.NODE_ENV !== 'production' ? (
              <section className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-4">
                <p className="text-xs font-black uppercase text-white/60">Game Day dev controls</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {timeline.map(([l, v, remainingMs]) => (
                    <button
                      key={l}
                      onClick={() => {
                        setDevFill(v);
                        setDevKickoffAt(Date.now() + remainingMs);
                      }}
                      className="rounded-full bg-white/10 px-3 py-2 text-xs"
                    >
                      Pregame {l}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setDevFill(null);
                      setDevKickoffAt(null);
                    }}
                    className="rounded-full border border-white/20 px-3 py-2 text-xs"
                  >
                    Reset to scheduled time
                  </button>
                  {room
                    ? simulations.map((s) => (
                        <button
                          key={s}
                          onClick={() => action({ action: 'SIMULATE', simulation: s })}
                          className="rounded-full bg-white/10 px-3 py-2 text-xs"
                        >
                          {s.replaceAll('_', ' ')}
                        </button>
                      ))
                    : null}
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </TeamThemeProvider>
  );
}

function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CloudSun;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <article className="relative z-20 rounded-3xl border border-white/20 bg-[#111517]/95 p-5 shadow-2xl">
      <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/70">
        <Icon className="h-4 w-4 text-[var(--secondary)]" />
        {label}
      </p>
      {children}
    </article>
  );
}
function Stat({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-white/50">{l}</p>
      <p className="mt-2 text-lg font-black">{v}</p>
    </div>
  );
}
function Community({
  user,
  room,
  name,
  opponent,
  code,
  setCode,
  message,
  setMessage,
  start,
  action,
  error,
  live,
}: any) {
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim())
      void action({ action: 'MESSAGE', body: message.trim() }).then(() => setMessage(''));
  };
  return (
    <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-3xl border border-white/15 bg-[#101416] p-5">
        <div className="flex justify-between border-b border-white/10 pb-4">
          <h2 className="flex items-center gap-2 text-xl font-black uppercase">
            <Users />
            {name}
          </h2>
          <span className="text-xs text-emerald-400">● {room?.members.length ?? 0} here</span>
        </div>
        {!user ? (
          <div className="py-10 text-center">
            <p>Sign in to join the conversation.</p>
            <Link
              href="/login?next=/game-day"
              className="team-primary-filled mt-5 inline-flex rounded-full px-6 py-3 font-black"
            >
              Sign in
            </Link>
          </div>
        ) : !room ? (
          <div className="grid gap-3 py-6 sm:grid-cols-2">
            <button
              onClick={() => start('CREATE')}
              className="team-primary-filled rounded-2xl p-5 font-black"
            >
              Open a private tailgate
            </button>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 text-white"
              />
              <button
                onClick={() => start('JOIN')}
                className="rounded-2xl bg-white px-4 font-black text-[#00172b]"
              >
                Join
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-[390px] space-y-3 overflow-y-auto py-4">
              {room.activity.map((a: any) => (
                <article key={a.id} className="rounded-2xl bg-white/5 p-4">
                  <p className="text-[10px] font-black uppercase text-[var(--secondary)]">
                    {a.kind === 'MOMENT' ? 'Game moment' : a.displayName || 'D&D'}
                  </p>
                  <p className="mt-1 font-bold">{a.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reactions.map((r) => (
                      <button
                        key={r}
                        aria-label={`React ${r}`}
                        onClick={() =>
                          action({ action: 'REACTION', activityId: a.id, reaction: r })
                        }
                        className="rounded-full bg-white/10 px-2 py-1 text-xs"
                      >
                        {r} {a.reactions[r] || ''}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <form onSubmit={send} className="flex gap-2">
              <label className="sr-only" htmlFor="game-message">
                Type a message
              </label>
              <input
                id="game-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message…"
                className="h-14 min-w-0 flex-1 rounded-full bg-white/10 px-5 text-white"
              />
              <button
                aria-label="Send message"
                className="team-primary-filled h-14 w-14 rounded-full"
              >
                <Send className="mx-auto" />
              </button>
            </form>
          </>
        )}
        {error ? <p className="mt-3 text-red-300">{error}</p> : null}
      </div>
      <div className="space-y-5">
        <div className="rounded-3xl border border-white/15 bg-[#101416] p-5">
          <p className="text-xs font-black uppercase text-[var(--secondary)]">
            Join the conversation
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {reactions.map((r) => (
              <button
                key={r}
                aria-label={`Insert ${r}`}
                onClick={() => setMessage(`${message}${r}`)}
                className="h-12 w-12 rounded-xl bg-white/5 text-xl"
              >
                {r}
              </button>
            ))}
          </div>
          <button
            disabled
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 p-4 text-white/45"
          >
            <Gift />
            GIF search · provider not connected
          </button>
        </div>
        {live && room ? (
          <div className="team-primary-filled rounded-3xl p-5">
            <p className="font-black uppercase">Call the drive</p>
            <p className="text-sm opacity-75">What happens next against {opponent}?</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {drives.map((d) => (
                <button
                  key={d}
                  onClick={() =>
                    action({
                      action: 'PREDICT',
                      kind: 'DRIVE',
                      prompt: 'DRIVE RESULT',
                      selection: d,
                    })
                  }
                  className="min-h-12 rounded-xl bg-white/15 text-xs font-black"
                >
                  {d.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {room ? (
          <button
            onClick={() =>
              action({
                action: 'SHARE',
                body: 'A D&D story was thrown in the cooler.',
                payload: { type: 'STORY', href: '/the-beat' },
              })
            }
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 p-4 text-xs font-black"
          >
            <Share2 />
            Throw The Beat into the cooler
          </button>
        ) : null}
      </div>
    </section>
  );
}
