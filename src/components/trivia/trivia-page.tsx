'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  Copy,
  Crosshair,
  Flame,
  Gamepad2,
  Globe2,
  Lightbulb,
  Search,
  Star,
  Trophy,
  UsersRound,
} from 'lucide-react';

import MainSiteHeader from '@/components/main-site-header';
import FilmRoomPlayDiagram from '@/components/film-room/film-room-play-diagram';
import TriviaGame from '@/components/trivia/trivia-game';
import TeamThemeProvider from '@/components/team-theme-provider';
import { useAuthUser } from '@/features/auth/auth-session';
import { useTeamStore } from '@/features/team/team-store';

type Stats = {
  lifetimePoints: number;
  weeklyPoints: number;
  accuracy: number;
  questionsAnswered: number;
  gamesPlayed: number;
  currentStreak: number;
};
type Leader = { rank: number; userId?: string; name: string; score: number; accuracy?: number };
type UserResult = { id: string; displayName: string; avatarUrl: string | null };
type Panel = null | 'GROUP';

export default function TriviaPage() {
  const params = useSearchParams();
  const teams = useTeamStore((state) => state.teams);
  const teamId = params?.get('team')?.toUpperCase() ?? 'KC';
  const team = teams.find((candidate) => candidate.abbr === teamId);
  const { user } = useAuthUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [teamLeaders, setTeamLeaders] = useState<Leader[] | null>(null);
  const [launch, setLaunch] = useState<{ gameId?: string } | null>(
    params?.get('game') ? { gameId: params.get('game') ?? undefined } : null,
  );
  const [panel, setPanel] = useState<Panel>(params?.get('room') ? 'GROUP' : null);
  const launchSharedGame = useCallback((gameId: string) => setLaunch({ gameId }), []);

  useEffect(() => {
    if (!user) return;
    void fetch('/api/trivia/stats')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { stats?: Stats } | null) => {
        setStats(body?.stats ?? null);
      });
  }, [user, launch, panel]);

  useEffect(() => {
    if (!user) return;
    void fetch(`/api/trivia/leaderboard?scope=TEAM&period=WEEK&team=${teamId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        setTeamLeaders((body?.rows as Leader[] | undefined) ?? []);
      });
  }, [teamId, user]);

  return (
    <TeamThemeProvider team={team}>
      <div className="min-h-screen bg-[#E9EDF0] text-[#00172B]">
        <MainSiteHeader teamAbbr={team?.abbr} active="trivia" />
        {!launch ? (
          <section className="relative overflow-hidden bg-[var(--dark)] text-[var(--team-on-dark)]">
            <FilmRoomPlayDiagram />
            <div className="relative z-[1] mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-12">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--team-secondary-on-dark)]">
                  {team?.name ?? 'NFL'} · Trivia
                </p>
                <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
                  Four Minute{' '}
                  <span className="text-[var(--secondary)] [text-shadow:0_2px_0_rgba(0,0,0,0.2)]">
                    Drill
                  </span>
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--team-light-on-dark)]">
                  Ten questions. Twenty-four seconds each. Go the distance.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15">
                <HeroStat
                  label="Trivia points"
                  value={(stats?.lifetimePoints ?? 0).toLocaleString()}
                />
                <HeroStat label="This week" value={(stats?.weeklyPoints ?? 0).toLocaleString()} />
                <HeroStat
                  label="Team rank"
                  value={
                    teamLeaders?.find((leader) => leader.userId === user?.id)?.rank
                      ? `#${teamLeaders.find((leader) => leader.userId === user?.id)?.rank}`
                      : '—'
                  }
                />
              </div>
            </div>
          </section>
        ) : null}

        <main
          className={launch ? 'w-full' : 'mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10'}
        >
          {launch ? (
            <TriviaGame
              teamId={teamId}
              teamName={team?.name ?? 'NFL'}
              initialGameId={launch.gameId}
              onClose={() => setLaunch(null)}
            />
          ) : panel === 'GROUP' ? (
            <SocialPanel
              title="Play with buddies"
              subtitle="Invite up to four buddies, then take the field together."
              onBack={() => setPanel(null)}
            >
              <GroupPanel
                teamId={teamId}
                initialRoom={params?.get('room')?.toUpperCase() ?? ''}
                onLaunch={launchSharedGame}
              />
            </SocialPanel>
          ) : (
            <Lobby
              user={Boolean(user)}
              userId={user?.id}
              stats={stats}
              onPlay={() => setLaunch({})}
              onPanel={setPanel}
              teamId={teamId}
              teamName={team?.name ?? 'NFL'}
              teamLeaders={teamLeaders}
            />
          )}
        </main>
      </div>
    </TeamThemeProvider>
  );
}

function Lobby({
  user,
  userId,
  stats,
  onPlay,
  onPanel,
  teamId,
  teamName,
  teamLeaders,
}: {
  user: boolean;
  userId?: string;
  stats: Stats | null;
  onPlay: () => void;
  onPanel: (panel: Panel) => void;
  teamId: string;
  teamName: string;
  teamLeaders: Leader[] | null;
}) {
  const [leaderboardScope, setLeaderboardScope] = useState<'TEAM' | 'GLOBAL'>('TEAM');
  const teamNickname = teamName.split(' ').at(-1) ?? teamName;
  const week = getTriviaWeek();
  const openGlobal = () => {
    setLeaderboardScope('GLOBAL');
    window.setTimeout(
      () => document.getElementById('trivia-leaderboard')?.scrollIntoView({ behavior: 'smooth' }),
      0,
    );
  };
  return (
    <div className="trivia-dashboard">
      <section className="trivia-dashboard-card trivia-modes">
        <p className="trivia-card-eyebrow">Get started</p>
        <h2>Choose Your Mode</h2>
        <div className="trivia-mode-list">
          <TriviaModeCard
            icon={<Crosshair />}
            title="Play Solo"
            meta="10 questions · 24 seconds each"
            description="Test your NFL knowledge and climb the leaderboard."
            onClick={onPlay}
            primary
          />
          <TriviaModeCard
            icon={<UsersRound />}
            title="Play With Buddies"
            meta={user ? 'Host up to 4 friends' : 'Sign in to host up to 4 friends'}
            description="Create a private game and compete together."
            onClick={() =>
              user
                ? onPanel('GROUP')
                : window.location.assign(`/login?next=${encodeURIComponent('/trivia')}`)
            }
          />
          <TriviaModeCard
            icon={<Globe2 />}
            title="Global Challenge"
            meta="Play against the world"
            description="See how you stack up against all fans."
            onClick={openGlobal}
          />
        </div>
      </section>

      <div className="trivia-dashboard-center">
        <section className="trivia-dashboard-card trivia-weekly">
          <header>
            <div>
              <CalendarDays />
              <h2>This Week&apos;s Challenge</h2>
            </div>
            <span>
              <strong>Week {week.number}</strong>
              {week.range}
            </span>
          </header>
          <div className="trivia-team-focus">
            <span aria-hidden="true">{teamId}</span>
            <div>
              <h3>{teamName} Focus</h3>
              <p>
                Questions this week feature {teamNickname} history, players, and 2026 storylines.
              </p>
            </div>
          </div>
          <button className="trivia-start-button" onClick={onPlay}>
            Start Playing <ArrowRight />
          </button>
        </section>
        <section className="trivia-dashboard-card trivia-how">
          <header>
            <Lightbulb />
            <h2>How It Works</h2>
          </header>
          <div>
            <HowStep number="1" title="Get 10 questions">
              Covering players, history, stats, and more.
            </HowStep>
            <HowStep number="2" title="You have 24 seconds each">
              Think fast. No second chances.
            </HowStep>
            <HowStep number="3" title="Score points">
              Climb the weekly and all-time leaderboards.
            </HowStep>
          </div>
        </section>
      </div>

      <TriviaLeaderboard
        teamId={teamId}
        teamNickname={teamNickname}
        userId={userId}
        initialTeamLeaders={teamLeaders}
        scope={leaderboardScope}
        onScopeChange={setLeaderboardScope}
      />
      <TriviaStats stats={stats} />
    </div>
  );
}

function TriviaLeaderboard({
  teamId,
  teamNickname,
  userId,
  initialTeamLeaders,
  scope,
  onScopeChange,
}: {
  teamId: string;
  teamNickname: string;
  userId?: string;
  initialTeamLeaders: Leader[] | null;
  scope: 'TEAM' | 'GLOBAL';
  onScopeChange: (scope: 'TEAM' | 'GLOBAL') => void;
}) {
  const [period, setPeriod] = useState<'WEEK' | 'ALL_TIME'>('WEEK');
  const [leaders, setLeaders] = useState<Leader[]>(initialTeamLeaders ?? []);
  const [loading, setLoading] = useState(initialTeamLeaders === null);
  useEffect(() => {
    if (scope === 'TEAM' && period === 'WEEK' && initialTeamLeaders !== null) {
      setLeaders(initialTeamLeaders);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void fetch(`/api/trivia/leaderboard?scope=${scope}&period=${period}&team=${teamId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (active) setLeaders(body?.rows ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialTeamLeaders, period, scope, teamId]);
  return (
    <section id="trivia-leaderboard" className="trivia-dashboard-card trivia-leaderboard">
      <header>
        <div>
          <Trophy />
          <h2>Leaderboard</h2>
        </div>
        <Trophy />
      </header>
      <div className="trivia-leaderboard-tabs">
        {(['TEAM', 'GLOBAL'] as const).map((item) => (
          <button key={item} aria-pressed={scope === item} onClick={() => onScopeChange(item)}>
            {item === 'TEAM' ? `Team (${teamNickname})` : 'Global'}
          </button>
        ))}
      </div>
      <div className="trivia-leaderboard-head">
        <span>#</span>
        <span>Name</span>
        <span>Points</span>
      </div>
      <div className="trivia-leaderboard-rows" aria-busy={loading}>
        {leaders.slice(0, 5).map((row) => (
          <div key={`${row.rank}-${row.name}`} className={row.userId === userId ? 'current' : ''}>
            <span>{row.rank}</span>
            <strong>{row.name}</strong>
            <b>{row.score.toLocaleString()}</b>
          </div>
        ))}
        {!loading && !leaders.length ? (
          <p className="trivia-leaderboard-empty">
            No scores yet this week. Be the first on the board.
          </p>
        ) : null}
        {loading ? <p className="trivia-leaderboard-empty">Loading leaderboard…</p> : null}
      </div>
      <button
        onClick={() => setPeriod((value) => (value === 'WEEK' ? 'ALL_TIME' : 'WEEK'))}
        className="trivia-leaderboard-more"
      >
        {period === 'WEEK' ? 'View Full Leaderboard' : 'View This Week'} <ArrowRight />
      </button>
    </section>
  );
}

function GroupPanel({
  teamId,
  initialRoom,
  onLaunch,
}: {
  teamId: string;
  initialRoom: string;
  onLaunch: (gameId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [code, setCode] = useState(initialRoom);
  const [room, setRoom] = useState(initialRoom);
  const [inviteLink, setInviteLink] = useState('');
  const [message, setMessage] = useState('');
  const [participants, setParticipants] = useState<
    Array<{ id: string; name: string; status: 'INVITED' | 'JOINED' }>
  >([]);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return setUsers([]);
    const timer = window.setTimeout(
      () =>
        void fetch(`/api/trivia/friends?query=${encodeURIComponent(query)}`)
          .then((response) => (response.ok ? response.json() : null))
          .then((body) => setUsers(body?.users ?? [])),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  const create = async () => {
    const response = await fetch('/api/trivia/groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });
    const body = await response.json();
    if (response.ok) {
      setRoom(body.joinCode);
      setCode(body.joinCode);
      setInviteLink(`${window.location.origin}/trivia/join/${body.inviteToken}`);
    } else setMessage(body.error ?? 'Unable to create room.');
  };

  const inviteBuddy = async (userId: string) => {
    if (!room) return;
    const response = await fetch(`/api/trivia/groups/${encodeURIComponent(room)}/invite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const body = await response.json();
    setMessage(response.ok ? 'Buddy added. Share the game link so they can join.' : body.error);
  };

  const share = async () => {
    if (!inviteLink) return;
    if (navigator.share)
      await navigator.share({ title: 'Down & Distance Trivia', url: inviteLink });
    else await navigator.clipboard.writeText(inviteLink);
  };
  useEffect(() => {
    if (!room) return;
    const poll = async () => {
      const response = await fetch(`/api/trivia/groups/${encodeURIComponent(room)}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const body = await response.json();
      setParticipants(body.room.participants ?? []);
      setIsHost(Boolean(body.room.isHost));
      if (body.room.status === 'ACTIVE') onLaunch(body.room.gameId);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => window.clearInterval(timer);
  }, [onLaunch, room]);
  const startRoom = async () => {
    const response = await fetch(`/api/trivia/groups/${encodeURIComponent(room)}/start`, {
      method: 'POST',
    });
    const body = await response.json();
    if (response.ok) onLaunch(body.gameId);
    else setMessage(body.error ?? 'Unable to start room.');
  };
  return (
    <div className="mt-7">
      {!room ? (
        <button onClick={() => void create()} className="trivia-primary-button w-full">
          Create 4 Minute Drill room
        </button>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-white/[.06] p-5">
            <h3 className="text-xl font-black uppercase">Find buddies</h3>
            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Down & Distance"
                className="h-14 w-full rounded-xl border border-white/15 bg-white/10 pl-12 pr-4 font-bold text-white outline-none placeholder:text-white/35 focus:border-[var(--secondary)]"
              />
            </div>
            <div className="mt-2 grid gap-2">
              {users.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => void inviteBuddy(candidate.id)}
                  className="flex justify-between rounded-xl bg-white/[.06] p-3 text-left font-black"
                >
                  {candidate.displayName}
                  <span className="text-xs text-[var(--team-secondary-on-dark)]">ADD TO GAME</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white/[.06] p-5">
            <h3 className="text-xl font-black uppercase">Share game link</h3>
            <p className="mt-2 text-sm font-semibold text-white/55">
              No contact permission required. Send it through any app.
            </p>
            <button onClick={() => void share()} className="trivia-primary-button mt-5 w-full">
              Share game
            </button>
            <button
              onClick={() => void navigator.clipboard.writeText(inviteLink)}
              className="trivia-secondary-button mt-2 w-full"
            >
              <Copy className="h-4 w-4" /> Copy link
            </button>
          </div>
        </div>
      )}
      {room ? (
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/[.04] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--team-secondary-on-dark)]">
                Waiting for the crew
              </p>
              <h3 className="mt-1 text-2xl font-black">ROOM {code}</h3>
            </div>
            <span className="text-sm font-black">
              {participants.filter((player) => player.status === 'JOINED').length}/5 READY
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {participants.map((player) => (
              <div
                key={player.id}
                className="flex justify-between rounded-xl bg-white/[.07] px-4 py-3 font-black"
              >
                <span>{player.name}</span>
                <span className={player.status === 'JOINED' ? 'text-emerald-300' : 'text-white/40'}>
                  {player.status === 'JOINED' ? 'READY' : 'WAITING'}
                </span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 5 - participants.length) }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-dashed border-white/15 px-4 py-3 font-black text-white/30"
              >
                PLAYER {participants.length + index + 1} · OPEN
              </div>
            ))}
          </div>
          {isHost ? (
            <button
              onClick={() => void startRoom()}
              disabled={participants.filter((player) => player.status === 'JOINED').length < 2}
              className="trivia-primary-button mt-5 w-full"
            >
              Start 4 Minute Drill
            </button>
          ) : (
            <p className="mt-5 text-center text-sm font-black text-white/50">
              Waiting for the host to start.
            </p>
          )}
        </div>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-xl bg-white/10 p-4 text-sm font-bold">{message}</p>
      ) : null}
    </div>
  );
}

function SocialPanel({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-3xl rounded-[28px] bg-[#071625] p-6 text-white shadow-2xl sm:p-8">
      <BackButton onClick={onBack} dark />
      <p className="mt-8 text-xs font-black uppercase tracking-[.25em] text-[var(--team-secondary-on-dark)]">
        Live competition
      </p>
      <h1 className="mt-2 text-4xl font-black uppercase sm:text-5xl">{title}</h1>
      <p className="mt-3 font-semibold text-white/60">{subtitle}</p>
      {children}
    </section>
  );
}
function getTriviaWeek(now = new Date()) {
  const start = new Date(now.getFullYear(), 8, 7);
  const number = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 604800000) + 1);
  const rangeStart = new Date(start.getTime() + (number - 1) * 604800000);
  const rangeEnd = new Date(rangeStart.getTime() + 6 * 86400000);
  const format = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { number, range: `${format(rangeStart)} – ${format(rangeEnd)}` };
}

function TriviaModeCard({
  icon,
  title,
  meta,
  description,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button onClick={onClick} className={`trivia-mode ${primary ? 'primary' : ''}`}>
      <span className="trivia-mode-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <b>{meta}</b>
        <small>{description}</small>
      </span>
      <ArrowRight />
    </button>
  );
}

function HowStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </article>
  );
}

function TriviaStats({ stats }: { stats: Stats | null }) {
  const values = [
    {
      icon: <Crosshair />,
      label: 'Total Points',
      value: (stats?.lifetimePoints ?? 0).toLocaleString(),
    },
    {
      icon: <Star />,
      label: 'Accuracy',
      value: stats?.questionsAnswered ? `${stats.accuracy.toFixed(1)}%` : '—',
    },
    { icon: <Gamepad2 />, label: 'Games Played', value: String(stats?.gamesPlayed ?? 0) },
    { icon: <Flame />, label: 'Current Streak', value: String(stats?.currentStreak ?? 0) },
  ];
  return (
    <section className="trivia-dashboard-card trivia-stats">
      <header>
        <h2>Your Stats</h2>
      </header>
      <div>
        {values.map((item) => (
          <article key={item.label}>
            <span>{item.icon}</span>
            <strong>{item.value}</strong>
            <small>{item.label}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
function BackButton({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm font-black ${dark ? 'text-white/60 hover:text-white' : 'mb-4 text-[#00172B]/60 hover:text-[#00172B]'}`}
    >
      ← Trivia lobby
    </button>
  );
}
function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[105px] bg-white/[.07] px-4 py-4 text-center sm:min-w-[135px]">
      <p className="text-xl font-black sm:text-2xl">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[.15em] text-white/45">{label}</p>
    </div>
  );
}
