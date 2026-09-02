'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Send, Share2, Users, Zap } from 'lucide-react';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { useAuthUser } from '@/features/auth/auth-session';
import { readCanonicalFanTeamPreference } from '@/features/team/fan-team-preference';
import { useTeamStore } from '@/features/team/team-store';
import type { GameDayRoom, SimulationAction } from '../../../packages/game-day';
const reactions = ['🔥', '😂', '😤', '🤦', '🍺', '👀'];
const drives = ['TOUCHDOWN', 'FIELD GOAL', 'PUNT', 'TURNOVER'];
const sims: SimulationAction[] = [
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
export default function GameDayPage() {
  const { user, hydrated } = useAuthUser(),
    teams = useTeamStore((s) => s.teams);
  const [teamId, setTeamId] = useState('KC'),
    [room, setRoom] = useState<GameDayRoom | null>(null),
    [code, setCode] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    void readCanonicalFanTeamPreference().then((team) => setTeamId(team || 'KC'));
  }, []);
  const team = teams.find((t) => t.abbr === teamId);
  const load = useCallback(
    async (id?: string) => {
      if (!user) return;
      const r = await fetch(
        id ? `/api/game-day/rooms/${id}` : `/api/game-day/rooms?team=${teamId}`,
      );
      const b = await r.json();
      if (r.ok) setRoom(b.room || null);
    },
    [teamId, user],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!room) return;
    const id = setInterval(() => void load(room.id), 2000);
    return () => clearInterval(id);
  }, [load, room?.id]);
  const action = async (body: object) => {
    setError('');
    const r = await fetch(`/api/game-day/rooms/${room?.id}/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const b = await r.json().catch(() => null);
    if (!r.ok) {
      setError(b?.error || 'That play did not work.');
      return;
    }
    await load(room?.id);
  };
  const start = async (actionName: 'CREATE' | 'JOIN') => {
    const r = await fetch('/api/game-day/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        actionName === 'CREATE' ? { action: 'CREATE', teamId } : { action: 'JOIN', code },
      ),
    });
    const b = await r.json();
    if (!r.ok) {
      setError(b.error);
      return;
    }
    await load(b.id);
  };
  if (!hydrated) return null;
  return (
    <TeamThemeProvider team={team}>
      <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
        <MainSiteHeader teamAbbr={teamId} />
        {!user ? (
          <main className="mx-auto max-w-2xl px-5 py-20 text-center">
            <h1 className="text-5xl font-black">Game Day is better with your people.</h1>
            <p className="mt-4 text-slate-600">
              Sign in to create or join a private digital tailgate.
            </p>
            <Link
              href="/login?next=/game-day"
              className="mt-8 inline-flex rounded-full bg-[var(--primary)] px-7 py-4 font-black text-[var(--team-on-primary)]"
            >
              Sign in
            </Link>
          </main>
        ) : !room ? (
          <Lobby
            teamId={teamId}
            setTeamId={setTeamId}
            teams={teams}
            code={code}
            setCode={setCode}
            start={start}
            error={error}
          />
        ) : (
          <Room
            room={room}
            message={message}
            setMessage={setMessage}
            action={action}
            error={error}
          />
        )}
      </div>
    </TeamThemeProvider>
  );
}
function Lobby({ teamId, setTeamId, teams, code, setCode, start, error }: any) {
  return (
    <main className="mx-auto max-w-5xl px-5 py-14">
      <p className="text-xs font-black uppercase tracking-[.24em] text-[var(--team-primary-text)]">
        Game Day
      </p>
      <h1 className="mt-3 text-5xl font-black">Your digital tailgate.</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Watch on the TV. React, predict, and talk trash here.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <section className="rounded-3xl bg-[var(--dark)] p-8 text-[var(--team-on-dark)]">
          <h2 className="text-2xl font-black">Create a tailgate</h2>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="mt-6 h-12 w-full rounded-xl bg-white px-4 font-bold text-[#00172B]"
          >
            {teams.map((t: any) => (
              <option key={t.abbr} value={t.abbr}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => start('CREATE')}
            className="mt-4 h-14 w-full rounded-xl bg-[var(--secondary)] font-black text-[var(--team-on-secondary)]"
          >
            CREATE PRIVATE ROOM
          </button>
        </section>
        <section className="rounded-3xl border bg-white p-8">
          <h2 className="text-2xl font-black">Join your friends</h2>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            className="mt-6 h-12 w-full rounded-xl border px-4 font-black tracking-[.2em]"
          />
          <button
            onClick={() => start('JOIN')}
            className="mt-4 h-14 w-full rounded-xl bg-[var(--primary)] font-black text-[var(--team-on-primary)]"
          >
            JOIN THE TAILGATE
          </button>
        </section>
      </div>
      {error ? <p className="mt-5 font-bold text-red-600">{error}</p> : null}
    </main>
  );
}
function Room({
  room,
  message,
  setMessage,
  action,
  error,
}: {
  room: GameDayRoom;
  message: string;
  setMessage: (v: string) => void;
  action: (b: object) => Promise<void>;
  error: string;
}) {
  const g = room.gameState,
    live = room.status === 'LIVE',
    post = room.status === 'POSTGAME',
    countdown = useMemo(
      () => Math.max(0, new Date(room.kickoffAt).getTime() - Date.now()),
      [room.kickoffAt, room.updatedAt],
    );
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim())
      void action({ action: 'MESSAGE', body: message.trim() }).then(() => setMessage(''));
  };
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <section className="overflow-hidden rounded-3xl bg-[var(--dark)] text-[var(--team-on-dark)]">
        <div className="grid gap-5 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--team-secondary-on-dark)]">
              {post
                ? 'Postgame Garage'
                : room.status === 'HALFTIME'
                  ? 'Halftime'
                  : live
                    ? 'Watch Party'
                    : 'Tailgate Open'}
            </p>
            <h1 className="mt-3 text-4xl font-black">
              {g.awayTeamId}{' '}
              <span className="text-[var(--team-secondary-on-dark)]">{g.awayScore}</span> ·{' '}
              {g.homeTeamId}{' '}
              <span className="text-[var(--team-secondary-on-dark)]">{g.homeScore}</span>
            </h1>
            <p className="mt-2 text-[var(--team-on-dark)] opacity-70">
              {live
                ? `Q${g.quarter} · ${g.clock}`
                : post
                  ? 'Final'
                  : `Kickoff in ${Math.floor(countdown / 3600000)}:${String(Math.floor(countdown / 60000) % 60).padStart(2, '0')}`}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--team-on-dark)] opacity-70">
              Room code
            </p>
            <p className="mt-1 text-xl font-black tracking-[.2em]">{room.joinCode}</p>
          </div>
        </div>
        {live ? (
          <div className="grid grid-cols-3 border-t border-white/10 px-6 py-4 text-center text-sm font-black">
            <span>{g.possessionTeamId || '—'} BALL</span>
            <span>
              {g.down
                ? `${g.down}${g.down === 1 ? 'ST' : g.down === 2 ? 'ND' : g.down === 3 ? 'RD' : 'TH'} & ${g.distance}`
                : '—'}
            </span>
            <span>{g.yardLine || '—'}</span>
          </div>
        ) : null}
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black">
              <Users className="h-5 w-5" /> Who&apos;s here
            </h2>
            <div className="mt-4 space-y-3">
              {room.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--secondary)] font-black text-[var(--team-on-secondary)]">
                    {m.displayName[0]}
                  </span>
                  <div>
                    <p className="font-black">{m.displayName}</p>
                    <p className="text-[10px] font-bold text-emerald-600">HERE</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-3xl bg-[var(--primary)] p-5 text-[var(--team-on-primary)]">
            <h2 className="font-black">{live ? 'Call the drive' : 'Pregame picks'}</h2>
            <p className="mt-1 text-sm text-[var(--team-on-primary)] opacity-75">
              {live ? 'What happens this drive?' : 'Who wins?'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(live ? drives : [g.awayTeamId, g.homeTeamId]).map((x) => (
                <button
                  key={x}
                  onClick={() =>
                    action({
                      action: 'PREDICT',
                      kind: live ? 'DRIVE' : 'PREGAME',
                      prompt: live ? 'DRIVE RESULT' : 'WHO WINS?',
                      selection: x.replace(' ', '_'),
                    })
                  }
                  className="min-h-12 rounded-xl bg-white/15 px-2 text-xs font-black hover:bg-white/25"
                >
                  {x}
                </button>
              ))}
            </div>
          </section>
          {process.env.NODE_ENV !== 'production' ? (
            <section className="rounded-3xl border border-dashed border-slate-400 bg-white p-4">
              <p className="text-xs font-black uppercase">Dev simulator</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sims.map((s) => (
                  <button
                    key={s}
                    onClick={() => action({ action: 'SIMULATE', simulation: s })}
                    className="rounded-lg bg-slate-100 px-2 py-2 text-[10px] font-black"
                  >
                    {s.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
        <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black">Room activity</h2>
            <button
              onClick={() =>
                action({
                  action: 'SHARE',
                  body: 'A D&D story was thrown in the cooler.',
                  payload: { type: 'STORY', href: '/huddle' },
                })
              }
              className="flex items-center gap-2 text-xs font-black text-[var(--team-primary-text)]"
            >
              <Share2 className="h-4 w-4" /> THE COOLER
            </button>
          </div>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto">
            {room.activity.map((a) => (
              <article
                key={a.id}
                className={
                  a.kind === 'MOMENT'
                    ? 'rounded-2xl bg-[var(--dark)] p-5 text-[var(--team-on-dark)]'
                    : 'rounded-2xl bg-[#f7f4ee] p-4'
                }
              >
                <p className="text-[10px] font-black uppercase tracking-wider opacity-60">
                  {a.kind === 'MOMENT' ? 'GAME MOMENT' : a.displayName || 'D&D'}
                </p>
                <p className="mt-1 font-bold">{a.body}</p>
                {a.payload.detail ? (
                  <p className="mt-1 text-sm opacity-70">{String(a.payload.detail)}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {reactions.map((r) => (
                    <button
                      key={r}
                      onClick={() => action({ action: 'REACTION', activityId: a.id, reaction: r })}
                      className="rounded-full bg-white/10 px-2 py-1 text-xs"
                    >
                      {r} {a.reactions[r] || ''}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <form onSubmit={send} className="mt-5 flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Talk trash…"
              className="h-14 min-w-0 flex-1 rounded-full border px-5"
            />
            <button className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--team-on-primary)]">
              <Send />
            </button>
          </form>
          {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
