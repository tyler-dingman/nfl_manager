'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Bolt,
  Check,
  Copy,
  Gamepad2,
  LogIn,
  Search,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';

import MainSiteHeader from '@/components/main-site-header';
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
type Chains = { currentDriveYards: number; touchdowns: number; lifetimeYards: number };
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
  const [chains, setChains] = useState<Chains | null>(null);
  const [teamRank, setTeamRank] = useState<number | null>(null);
  const [launch, setLaunch] = useState<{ gameId?: string } | null>(
    params?.get('game') ? { gameId: params.get('game') ?? undefined } : null,
  );
  const [panel, setPanel] = useState<Panel>(params?.get('room') ? 'GROUP' : null);
  const launchSharedGame = useCallback((gameId: string) => setLaunch({ gameId }), []);

  useEffect(() => {
    if (!user) return;
    void fetch('/api/trivia/stats')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { stats?: Stats; moveTheChains?: Chains } | null) => {
        setStats(body?.stats ?? null);
        setChains(body?.moveTheChains ?? null);
      });
  }, [user, launch, panel]);

  useEffect(() => {
    if (!user) return;
    void fetch(`/api/trivia/leaderboard?scope=TEAM&period=WEEK&team=${teamId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const row = (body?.rows as Leader[] | undefined)?.find(
          (leader) => leader.userId === user.id,
        );
        setTeamRank(row?.rank ?? null);
      });
  }, [teamId, user]);

  return (
    <TeamThemeProvider team={team}>
      <div className="min-h-screen bg-[#E9EDF0] text-[#00172B]">
        <MainSiteHeader teamAbbr={team?.abbr} active="trivia" />
        <section className="relative overflow-hidden bg-[#071625] text-white">
          <div
            className="absolute inset-y-0 right-0 w-1/2 opacity-15"
            style={{ background: 'linear-gradient(120deg, transparent 5%, var(--primary) 100%)' }}
          />
          <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[.3em] text-[var(--team-secondary-on-dark)]">
                {team?.name ?? 'NFL'} · Live competition
              </p>
              <h1 className="mt-3 text-6xl font-black uppercase tracking-[-.065em] sm:text-8xl">
                Trivia
              </h1>
              <p className="mt-3 max-w-xl text-lg font-semibold text-white/65">
                One question at a time. Fifteen seconds on the clock. Every point counts.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15">
              <HeroStat
                label="Trivia points"
                value={(stats?.lifetimePoints ?? 0).toLocaleString()}
              />
              <HeroStat label="This week" value={(stats?.weeklyPoints ?? 0).toLocaleString()} />
              <HeroStat label="Team rank" value={teamRank ? `#${teamRank}` : '—'} />
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
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
              stats={stats}
              chains={chains}
              onPlay={() => setLaunch({})}
              onPanel={setPanel}
              teamId={teamId}
            />
          )}
        </main>
      </div>
    </TeamThemeProvider>
  );
}

function Lobby({
  user,
  stats,
  chains,
  onPlay,
  onPanel,
  teamId,
}: {
  user: boolean;
  stats: Stats | null;
  chains: Chains | null;
  onPlay: () => void;
  onPanel: (panel: Panel) => void;
  teamId: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
            <p className="text-xs font-black uppercase tracking-[.24em] text-[var(--team-primary-text)]">
              Trivia
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">
              Who are you playing with?
            </h2>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <GameCard
              icon={<Bolt />}
              title="Play with myself"
              detail="10 questions · 20 seconds each"
              onClick={onPlay}
              primary
            />
            {user ? (
              <GameCard
                icon={<UsersRound />}
                title="Play with buddies"
                detail="Host up to four buddies"
                onClick={() => onPanel('GROUP')}
              />
            ) : null}
          </div>
        </section>
        <MoveTheChains chains={chains} />
      </div>
      <aside className="space-y-6">
        <TriviaLeaderboard teamId={teamId} />
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Accuracy" value={`${stats?.accuracy ?? 0}%`} />
          <MiniStat label="Games" value={String(stats?.gamesPlayed ?? 0)} />
          <MiniStat label="Streak" value={String(stats?.currentStreak ?? 0)} />
        </div>
      </aside>
    </div>
  );
}

function MoveTheChains({ chains }: { chains: Chains | null }) {
  const yards = chains?.currentDriveYards ?? 0;
  const ticks = ['OWN', '10', '20', '30', '40', '50', '40', '30', '20', '10', 'END ZONE'];
  return (
    <section className="rounded-[28px] bg-[#071625] p-6 text-white shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-[var(--team-secondary-on-dark)]">
            Move the Chains
          </p>
          <h2 className="mt-2 text-3xl font-black">CURRENT DRIVE</h2>
        </div>
        <p className="text-3xl font-black tabular-nums">
          {yards} <span className="text-base text-white/45">/ 100 YDS</span>
        </p>
      </div>
      <div className="relative mt-8 pb-7 pt-3">
        <div className="h-2 rounded-full bg-white/15">
          <div
            className="h-2 rounded-full bg-[var(--secondary)] transition-[width] duration-700 motion-reduce:transition-none"
            style={{ width: `${yards}%` }}
          />
        </div>
        <div
          className="absolute top-0 h-8 w-1 rounded-full bg-white shadow-[0_0_0_4px_var(--primary)] transition-[left] duration-700 motion-reduce:transition-none"
          style={{ left: `calc(${yards}% - 2px)` }}
          aria-label={`Ball at ${yards} yards`}
        />
        <div className="mt-3 grid grid-cols-11 text-center text-[8px] font-black uppercase tracking-wider text-white/35 sm:text-[10px]">
          {ticks.map((tick, index) => (
            <span key={`${tick}-${index}`}>{tick}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 sm:grid-cols-3">
        <DarkStat label="Current drive" value={`${yards} YDS`} />
        <DarkStat label="Touchdowns" value={String(chains?.touchdowns ?? 0)} />
        <DarkStat
          label="Lifetime yards"
          value={(chains?.lifetimeYards ?? 0).toLocaleString()}
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </section>
  );
}

function TriviaLeaderboard({ teamId }: { teamId: string }) {
  const [scope, setScope] = useState<'TEAM' | 'GLOBAL'>('TEAM');
  const [period, setPeriod] = useState<'WEEK' | 'ALL_TIME'>('WEEK');
  const [leaders, setLeaders] = useState<Leader[]>([]);
  useEffect(() => {
    void fetch(`/api/trivia/leaderboard?scope=${scope}&period=${period}&team=${teamId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setLeaders(body?.rows ?? []));
  }, [period, scope, teamId]);
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[var(--team-primary-text)]">
            Leaderboard
          </p>
          <h2 className="mt-1 text-2xl font-black">This week</h2>
        </div>
        <Trophy className="h-6 w-6 text-[var(--team-primary-text)]" />
      </div>
      <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['TEAM', 'GLOBAL'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setScope(item)}
            className={`flex-1 rounded-md px-2 py-2 text-[10px] font-black ${scope === item ? 'bg-white shadow-sm' : 'text-slate-500'}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-1">
        {leaders.slice(0, 5).map((row) => (
          <div
            key={`${row.rank}-${row.name}`}
            className="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg px-2 py-2.5 first:bg-[#FFF4E6]"
          >
            <span className="font-black">{row.rank}</span>
            <span className="truncate text-sm font-black">{row.name}</span>
            <span className="text-sm font-black tabular-nums">{row.score.toLocaleString()}</span>
          </div>
        ))}
        {!leaders.length ? (
          <p className="py-4 text-center text-sm font-semibold text-slate-500">
            Be the first on the board.
          </p>
        ) : null}
      </div>
      <button
        onClick={() => setPeriod((value) => (value === 'WEEK' ? 'ALL_TIME' : 'WEEK'))}
        className="mt-3 w-full border-t pt-4 text-xs font-black uppercase tracking-wider text-[var(--team-primary-text)]"
      >
        {period === 'WEEK' ? 'View all time' : 'View this week'}
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
          Create Trivia room
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
              Start Trivia
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
function GameCard({
  icon,
  title,
  detail,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group min-h-40 rounded-2xl border-2 p-5 text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[var(--dark)]/20 motion-reduce:transform-none ${primary ? 'border-[var(--dark)] bg-[var(--dark)] text-[var(--team-on-dark)]' : 'border-slate-200 bg-[#F7F8F9] hover:border-[var(--primary)]'}`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${primary ? 'bg-white/15 text-[var(--team-secondary-on-dark)]' : 'bg-white text-[var(--team-primary-text)] shadow-sm'}`}
      >
        {icon}
      </span>
      <span className="mt-5 block text-xl font-black uppercase">{title}</span>
      <span
        className={`mt-1 block text-sm font-semibold ${primary ? 'text-[var(--team-on-dark)]' : 'text-slate-500'}`}
      >
        {detail}
      </span>
      <ArrowRight className="ml-auto mt-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
    </button>
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
function DarkStat({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`bg-white/[.06] p-4 ${className}`}>
      <p className="text-xl font-black">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[.16em] text-white/40">{label}</p>
    </div>
  );
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
      <p className="text-lg font-black">{value}</p>
      <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}
