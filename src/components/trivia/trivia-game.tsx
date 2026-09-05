'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Share2, Trophy, X } from 'lucide-react';
import {
  buildTriviaRecap,
  canSubmitTriviaAnswer,
  type TriviaExperiencePhase,
} from '@/features/trivia/experience';
import {
  DRILL_PLAY_CLOCK_SECONDS,
  DRILL_YARDS_PER_CORRECT_ANSWER,
  formatDrillClock,
  getDrillGameSeconds,
  rankDrillStandings,
} from '@/features/trivia/four-minute-drill';
import { useTeamStore } from '@/features/team/team-store';

type Choice = 'A' | 'B' | 'C' | 'D';
type Standing = {
  userId: string;
  name: string;
  teamId?: string | null;
  score: number;
  correctAnswers: number;
  wrongAnswers?: number;
  timeouts?: number;
  responseTimeTotalMs?: number;
  bestQuestionScore?: number;
  currentRank?: number | null;
  previousRank?: number | null;
};
type Game = {
  gameId: string;
  currentUserId: string;
  mode: string;
  teamId: string;
  position: number;
  questionCount: number;
  timerSeconds: number;
  score: number;
  correctAnswers: number;
  completed: boolean;
  waitingForPlayers?: boolean;
  question: null | {
    id: string;
    question: string;
    answerA: string;
    answerB: string;
    answerC: string;
    answerD: string;
    category: string;
    presentedAt: string;
  };
  standings: Standing[];
};
type Result = {
  correct: boolean;
  points: number;
  selectedAnswer: Choice | null;
  correctAnswer: Choice;
  explanation: string;
  responseTimeMs?: number;
  timedOut: boolean;
  yardAwarded: number;
  completed: boolean;
};
type Play = { id: string; at: string; name: string; correct: boolean; timedOut: boolean };

export default function TriviaGame({
  teamId,
  teamName,
  initialGameId,
  onClose,
}: {
  teamId: string;
  teamName: string;
  initialGameId?: string;
  onClose: () => void;
}) {
  const teams = useTeamStore((s) => s.teams),
    team = teams.find((t) => t.abbr === teamId);
  const [game, setGame] = useState<Game | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [phase, setPhase] = useState<TriviaExperiencePhase>('QUESTION');
  const [seconds, setSeconds] = useState(DRILL_PLAY_CLOCK_SECONDS),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [selected, setSelected] = useState<Choice | null>(null),
    [kickoff, setKickoff] = useState<number | null>(null),
    [plays, setPlays] = useState<Play[]>([]);
  const timeoutSent = useRef(false),
    started = useRef(false),
    kickoffShown = useRef(false);
  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/trivia/games/${id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load game.');
    const body = (await response.json()) as { game: Game };
    setGame(body.game);
    setResult(null);
    setSelected(null);
    setPhase(body.game.completed ? 'COMPLETE' : 'QUESTION');
    setSeconds(body.game.timerSeconds);
    if (
      body.game.mode === 'GROUP' &&
      body.game.position === 1 &&
      body.game.score === 0 &&
      !kickoffShown.current
    ) {
      kickoffShown.current = true;
      setKickoff(3);
    }
    timeoutSent.current = false;
  }, []);
  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/trivia/games', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      const body = (await response.json()) as { gameId?: string; error?: string };
      if (!response.ok || !body.gameId)
        throw new Error(body.error ?? 'Unable to start game. Sign in and try again.');
      await load(body.gameId);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }, [load, teamId]);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initialGameId) void load(initialGameId);
    else void start();
  }, [initialGameId, load, start]);
  const answer = useCallback(
    async (choice: Choice | null) => {
      if (!game || !canSubmitTriviaAnswer(phase) || busy) return;
      setSelected(choice);
      setPhase('LOCKED');
      setBusy(true);
      try {
        const response = await fetch(`/api/trivia/games/${game.gameId}/answer`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ selectedAnswer: choice }),
        });
        const body = (await response.json()) as { result?: Result; error?: string };
        if (!response.ok || !body.result) throw new Error(body.error ?? 'Unable to submit answer.');
        setResult(body.result);
        const name = game.standings.find((r) => r.userId === game.currentUserId)?.name ?? 'You';
        setPlays((p) =>
          [
            {
              id: `${game.position}-${Date.now()}`,
              at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
              name,
              correct: body.result!.correct,
              timedOut: body.result!.timedOut,
            },
            ...p,
          ].slice(0, 5),
        );
        const delay =
          game.mode === 'GROUP' && game.question
            ? Math.max(
                450,
                new Date(game.question.presentedAt).getTime() +
                  game.timerSeconds * 1000 -
                  Date.now(),
              )
            : 450;
        window.setTimeout(() => setPhase('REVEAL'), delay);
      } catch (cause) {
        setError((cause as Error).message);
        setSelected(null);
        setPhase('QUESTION');
      } finally {
        setBusy(false);
      }
    },
    [busy, game, phase],
  );
  useEffect(() => {
    if (!game?.question || phase !== 'QUESTION' || game.completed || kickoff !== null) return;
    const tick = () => {
      const left = Math.min(
        game.timerSeconds,
        Math.max(
          0,
          game.timerSeconds -
            Math.floor((Date.now() - new Date(game.question!.presentedAt).getTime()) / 1000),
        ),
      );
      setSeconds(left);
      if (left === 0 && !timeoutSent.current) {
        timeoutSent.current = true;
        void answer(null);
      }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [answer, game, kickoff, phase]);
  useEffect(() => {
    if (kickoff === null) return;
    const timer = window.setTimeout(
      () => setKickoff((v) => (v !== null && v > 1 ? v - 1 : null)),
      850,
    );
    return () => window.clearTimeout(timer);
  }, [kickoff]);
  useEffect(() => {
    if (!game?.waitingForPlayers) return;
    const timer = window.setInterval(() => void load(game.gameId), 1000);
    return () => window.clearInterval(timer);
  }, [game, load]);
  const next = useCallback(async () => {
    if (!game) return;
    setBusy(true);
    try {
      await load(game.gameId);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }, [game, load]);
  useEffect(() => {
    if (phase !== 'REVEAL') return;
    const timer = window.setTimeout(() => setPhase('STANDINGS'), 2500);
    return () => window.clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'STANDINGS') return;
    const timer = window.setTimeout(() => void next(), 1600);
    return () => window.clearTimeout(timer);
  }, [next, phase]);
  const answers = useMemo(
    () =>
      game?.question
        ? ([
            ['A', game.question.answerA],
            ['B', game.question.answerB],
            ['C', game.question.answerC],
            ['D', game.question.answerD],
          ] as Array<[Choice, string]>)
        : [],
    [game],
  );
  if (error)
    return (
      <Shell>
        <Centered icon={<X />} title="Couldn't start the drill" detail={error}>
          <button onClick={() => void start()} className="trivia-primary-button">
            Try again
          </button>
          <button onClick={onClose} className="trivia-secondary-button">
            Back to lobby
          </button>
        </Centered>
      </Shell>
    );
  if (!game)
    return (
      <Shell>
        <Centered title="Setting the field" detail="Loading your 4 Minute Drill…" />
      </Shell>
    );
  if (kickoff !== null)
    return (
      <Shell>
        <Centered title={String(kickoff)} detail="The crew is ready. Let's go." />
      </Shell>
    );
  const runItBack = async () => {
    if (game.mode !== 'GROUP') return start();
    const response = await fetch(`/api/trivia/games/${game.gameId}/rematch`, { method: 'POST' });
    const body = (await response.json()) as { joinCode?: string; error?: string };
    if (!response.ok || !body.joinCode) {
      setError(body.error ?? 'Unable to run it back.');
      return;
    }
    window.location.assign(`/trivia?team=${game.teamId}&room=${body.joinCode}`);
  };
  if (phase === 'COMPLETE' || game.completed)
    return <FinalRecap game={game} onPlayAgain={() => void runItBack()} onClose={onClose} />;
  const totalScore = game.score + (result?.points ?? 0),
    totalCorrect = game.correctAnswers + (result?.correct ? 1 : 0),
    playComplete = phase !== 'QUESTION' || Boolean(game.waitingForPlayers);
  const standings = rankDrillStandings(
    (game.standings.length
      ? game.standings
      : [
          {
            userId: game.currentUserId,
            name: 'You',
            score: game.score,
            correctAnswers: game.correctAnswers,
          },
        ]
    ).map((r) =>
      r.userId === game.currentUserId
        ? { ...r, score: totalScore, correctAnswers: totalCorrect }
        : r,
    ),
  );
  return (
    <Shell>
      <DrillHeader
        seconds={getDrillGameSeconds(game.position, seconds, playComplete)}
        fastForward={playComplete}
        position={game.position}
        count={game.questionCount}
      />
      <RaceField rows={standings} currentUserId={game.currentUserId} fallbackTeamId={teamId} />
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(210px,.5fr)_minmax(250px,.7fr)]">
        <QuestionPanel
          game={game}
          answers={answers}
          seconds={seconds}
          phase={phase}
          result={result}
          selected={selected}
          busy={busy}
          onAnswer={answer}
          teamLogo={team?.logo_url}
          teamName={teamName}
        />
        <GameInfo />
        <LiveStandings
          rows={standings}
          currentUserId={game.currentUserId}
          fallbackTeamId={teamId}
        />
        <RecentPlays plays={plays} className="lg:col-span-2" />
        <CurrentDrive position={game.position} score={totalScore} plays={plays} />
      </div>
      {game.waitingForPlayers ? (
        <div className="border-t border-white/15 p-4 text-center font-black uppercase">
          Answer locked · Waiting on the crew
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="four-minute-drill min-h-[calc(100vh-76px)] overflow-hidden bg-[#091418] text-white"
      aria-live="polite"
    >
      {children}
    </section>
  );
}
function Centered({
  icon,
  title,
  detail,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[620px] items-center justify-center px-6 text-center">
      <div>
        {icon ? <div className="mx-auto h-12 w-12 text-[var(--primary)]">{icon}</div> : null}
        <h2 className="text-5xl font-black uppercase">{title}</h2>
        <p className="mt-3 font-semibold text-white/60">{detail}</p>
        {children ? <div className="mt-7 flex justify-center gap-3">{children}</div> : null}
      </div>
    </div>
  );
}
function DrillHeader({
  seconds,
  fastForward,
  position,
  count,
}: {
  seconds: number;
  fastForward: boolean;
  position: number;
  count: number;
}) {
  const [displaySeconds, setDisplaySeconds] = useState(seconds);
  const displaySecondsRef = useRef(seconds);

  useEffect(() => {
    if (!fastForward) {
      displaySecondsRef.current = seconds;
      setDisplaySeconds(seconds);
      return;
    }
    if (seconds >= displaySecondsRef.current) {
      displaySecondsRef.current = seconds;
      setDisplaySeconds(seconds);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displaySecondsRef.current = seconds;
      setDisplaySeconds(seconds);
      return;
    }
    const timer = window.setInterval(() => {
      if (displaySecondsRef.current <= seconds + 1) {
        window.clearInterval(timer);
        displaySecondsRef.current = seconds;
      } else displaySecondsRef.current -= 1;
      setDisplaySeconds(displaySecondsRef.current);
    }, 28);
    return () => window.clearInterval(timer);
  }, [fastForward, seconds]);

  return (
    <header className="drill-texture relative grid items-center gap-4 border-b border-white/30 px-4 py-4 lg:grid-cols-[minmax(360px,1.25fr)_180px_minmax(330px,.8fr)_150px] lg:px-8">
      <div>
        <h1 className="text-5xl font-black uppercase italic leading-none tracking-[-.07em] sm:text-7xl">
          4 Minute Drill
        </h1>
        <p className="mt-1 text-xs font-black uppercase tracking-[.2em] text-white/80">
          NFL Trivia · 10 Questions · 24 Seconds Each
        </p>
      </div>
      <img
        src="/assets/4-minute-drill/svg/phrase-know-football-go-distance.svg"
        alt=""
        aria-hidden
        className="hidden h-20 w-44 opacity-80 lg:block"
      />
      <div className="grid grid-cols-2 divide-x divide-white/25 rounded-lg border border-white/25 bg-black/20 text-center">
        <Metric label="Game clock" value={formatDrillClock(displaySeconds)} />
        <Metric label="Play" value={`${position} of ${count}`} />
      </div>
      <img
        src="/assets/4-minute-drill/svg/phrase-same-game-smarter-fans.svg"
        alt=""
        aria-hidden
        className="hidden h-16 w-36 opacity-75 lg:block"
      />
    </header>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3">
      <span className="block text-xs font-black uppercase tracking-[.14em] text-white/70">
        {label}
      </span>
      <span className="block text-3xl font-black tabular-nums sm:text-5xl">{value}</span>
    </div>
  );
}
function RaceField({
  rows,
  currentUserId,
  fallbackTeamId,
}: {
  rows: Standing[];
  currentUserId: string;
  fallbackTeamId: string;
}) {
  const teams = useTeamStore((state) => state.teams);
  const ticks = ['0', '10', '20', '30', '40', '50', '40', '30', '20', '10'];
  return (
    <section className="drill-field relative m-3 min-h-[260px] overflow-hidden rounded-xl border border-white/60 pr-16 sm:min-h-[300px] sm:pr-20">
      <img
        src="/assets/4-minute-drill/svg/playbook-xo-arrows.svg"
        alt=""
        aria-hidden
        className="absolute bottom-5 right-24 hidden h-32 w-40 opacity-20 md:block"
      />
      <div className="relative flex min-h-[260px] flex-col justify-center px-2 py-5 sm:min-h-[300px] sm:px-7 sm:py-7">
        <YardNumbers ticks={ticks} />
        <div className={rows.length === 1 ? '' : 'space-y-4'}>
          {rows.slice(0, 5).map((r) => {
            const rowTeam = teams.find(
              (candidate) => candidate.abbr === (r.teamId ?? fallbackTeamId),
            );
            const progress = Math.min(100, r.score);
            return (
              <div
                key={r.userId}
                data-current-player={r.userId === currentUserId || undefined}
                className="grid grid-cols-[72px_minmax(0,1fr)_42px] items-center gap-1 sm:grid-cols-[140px_minmax(0,1fr)_82px] sm:gap-3"
                style={
                  {
                    '--lane-color': rowTeam?.color_primary ?? 'var(--primary)',
                  } as React.CSSProperties
                }
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[var(--lane-color)] text-[10px] font-black text-white shadow-lg sm:h-10 sm:w-10 sm:text-xs">
                    {r.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-black uppercase sm:text-sm">
                      {r.name}
                    </span>
                    {rowTeam?.logo_url ? (
                      <img
                        src={rowTeam.logo_url}
                        alt={`${rowTeam.name} logo`}
                        className="mt-1 h-5 w-8 object-contain sm:h-6 sm:w-10"
                      />
                    ) : null}
                  </span>
                </div>
                <div className="relative h-2 bg-white/15 before:absolute before:inset-x-0 before:-inset-y-8 before:border-y before:border-white/10">
                  <div
                    className="h-full bg-[var(--lane-color)] transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                  <span
                    className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[var(--lane-color)] shadow-[0_0_18px_var(--lane-color)]"
                    style={{ left: `${progress}%` }}
                  >
                    {rowTeam?.logo_url ? (
                      <img
                        src={rowTeam.logo_url}
                        alt=""
                        aria-hidden
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </span>
                </div>
                <span className="text-[10px] font-black tabular-nums sm:text-sm">
                  {r.score} YDS
                </span>
              </div>
            );
          })}
        </div>
        <YardNumbers ticks={ticks} position="bottom" />
      </div>
      <div
        data-testid="drill-end-zone"
        className="drill-end-zone absolute bottom-0 right-0 top-0 flex w-16 items-center justify-center border-l border-white/60 text-xs font-black uppercase tracking-[.16em] sm:w-20 sm:text-sm [writing-mode:vertical-rl]"
      >
        <span className="relative z-10">End zone</span>
      </div>
    </section>
  );
}
function YardNumbers({
  ticks,
  position = 'top',
}: {
  ticks: string[];
  position?: 'top' | 'bottom';
}) {
  return (
    <div
      data-yard-numbers={position}
      aria-hidden
      className={`grid grid-cols-[72px_minmax(0,1fr)_42px] items-center gap-1 sm:grid-cols-[140px_minmax(0,1fr)_82px] sm:gap-3 ${position === 'top' ? 'mb-5' : 'mt-5'}`}
    >
      <span />
      <div className="grid grid-cols-10 text-center">
        {ticks.map((tick, index) => (
          <span key={`${position}-${tick}-${index}`} className="drill-yard-number">
            {tick}
          </span>
        ))}
      </div>
      <span />
    </div>
  );
}
function QuestionPanel({
  game,
  answers,
  seconds,
  phase,
  result,
  selected,
  busy,
  onAnswer,
  teamLogo,
  teamName,
}: {
  game: Game;
  answers: Array<[Choice, string]>;
  seconds: number;
  phase: TriviaExperiencePhase;
  result: Result | null;
  selected: Choice | null;
  busy: boolean;
  onAnswer: (c: Choice | null) => void;
  teamLogo?: string;
  teamName: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-[#F8F6F1] text-[#00172B]">
      <div className="drill-category-strip team-primary-filled flex max-w-[76%] items-center gap-3 px-5 py-3 pr-12 text-xs font-black uppercase tracking-[.15em]">
        {teamLogo ? (
          <img src={teamLogo} alt={`${teamName} logo`} className="h-7 w-10 object-contain" />
        ) : null}
        {game.question?.category.replaceAll('_', ' ')}
      </div>
      <div className="relative p-5 pr-24 sm:pr-28">
        <Countdown seconds={seconds} total={game.timerSeconds} />
        <h2 className="text-xl font-black sm:text-2xl">{game.question?.question}</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {answers.map(([choice, text]) => {
            const correct = phase === 'REVEAL' && result?.correctAnswer === choice,
              wrong = phase === 'REVEAL' && selected === choice && !correct;
            return (
              <button
                key={choice}
                disabled={phase !== 'QUESTION' || busy}
                onClick={() => void onAnswer(choice)}
                className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left font-semibold focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/30 ${correct ? 'border-emerald-600 bg-emerald-50' : wrong ? 'border-red-600 bg-red-50' : selected === choice ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-slate-300 bg-white hover:border-[var(--primary)]'}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 font-black">
                  {choice}
                </span>
                {text}
              </button>
            );
          })}
        </div>
        {phase === 'REVEAL' && result ? (
          <p className={`mt-4 font-black ${result.correct ? 'text-emerald-700' : 'text-red-700'}`}>
            {result.correct
              ? `Correct — ${DRILL_YARDS_PER_CORRECT_ANSWER} yards`
              : result.timedOut
                ? 'No gain — Time expired'
                : 'No gain — Incorrect answer'}
          </p>
        ) : null}
      </div>
    </section>
  );
}
function Countdown({ seconds, total }: { seconds: number; total: number }) {
  const progress = Math.max(0, Math.min(100, (seconds / total) * 100));
  return (
    <div
      className="absolute right-4 top-3 flex h-20 w-20 items-center justify-center rounded-full text-white"
      role="timer"
      aria-label={`${seconds} seconds remaining`}
      style={{
        background: `radial-gradient(circle at center,#071625 57%,transparent 59%),conic-gradient(var(--secondary) ${progress}%,var(--primary) ${progress}%)`,
      }}
    >
      <span className="text-2xl font-black tabular-nums">:{String(seconds).padStart(2, '0')}</span>
    </div>
  );
}
function Panel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`drill-panel rounded-xl border border-white/25 p-4 ${className}`}>
      <h3 className="text-sm font-black uppercase tracking-[.08em]">{title}</h3>
      {children}
    </section>
  );
}
function GameInfo() {
  return (
    <Panel title="Game info">
      <ul className="mt-4 space-y-3 text-xs font-bold">
        <li>
          🏈 <b>10 QUESTIONS</b>
          <span className="block pl-6 text-white/55">Reach 100 yards</span>
        </li>
        <li>
          ⏱ <b>24 SECONDS</b>
          <span className="block pl-6 text-white/55">Per question</span>
        </li>
        <li>
          📺 <b>+10 YARDS</b>
          <span className="block pl-6 text-white/55">For a correct answer</span>
        </li>
        <li>
          ✕ <b>NO GAIN</b>
          <span className="block pl-6 text-white/55">For an incorrect answer</span>
        </li>
        <li>
          🏆 <b>HIGHEST YARDAGE WINS</b>
          <span className="block pl-6 text-white/55">Response time breaks ties</span>
        </li>
      </ul>
    </Panel>
  );
}
function LiveStandings({
  rows,
  currentUserId,
  fallbackTeamId,
}: {
  rows: Standing[];
  currentUserId: string;
  fallbackTeamId: string;
}) {
  const teams = useTeamStore((state) => state.teams);
  return (
    <Panel title="Live standings">
      <div className="mt-3 space-y-1">
        {rows.slice(0, 5).map((r, i) => {
          const rowTeam = teams.find(
            (candidate) => candidate.abbr === (r.teamId ?? fallbackTeamId),
          );
          const answered = r.correctAnswers + (r.wrongAnswers ?? 0) + (r.timeouts ?? 0);
          return (
            <div
              key={r.userId}
              className={`grid grid-cols-[20px_minmax(0,1fr)_28px_auto_auto] items-center gap-2 rounded-md px-2 py-2 text-xs font-black ${r.userId === currentUserId ? 'team-primary-filled' : 'bg-white/[.04]'}`}
            >
              <span>{i + 1}</span>
              <span className="truncate uppercase">{r.name}</span>
              {rowTeam?.logo_url ? (
                <img
                  src={rowTeam.logo_url}
                  alt={`${rowTeam.name} logo`}
                  className="h-5 w-7 object-contain"
                />
              ) : (
                <span />
              )}
              <span>{r.score}</span>
              <span className="text-[10px] opacity-70">
                {r.correctAnswers}/{answered || 0} ·{' '}
                {formatResponseTime(r.responseTimeTotalMs ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
function formatResponseTime(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function RecentPlays({ plays, className = '' }: { plays: Play[]; className?: string }) {
  return (
    <Panel title="Recent plays" className={`relative overflow-hidden ${className}`}>
      <img
        src="/assets/4-minute-drill/svg/phrase-next-question-bigger-possibilities.svg"
        alt=""
        aria-hidden
        className="absolute bottom-2 right-3 hidden h-24 w-40 opacity-20 sm:block"
      />
      {plays.length ? (
        <div className="mt-3 space-y-2">
          {plays.map((p) => (
            <div key={p.id} className="grid grid-cols-[64px_20px_1fr] text-xs">
              <span className="text-white/55">{p.at}</span>
              <span className={p.correct ? 'text-emerald-400' : 'text-red-500'}>
                {p.correct ? '✓' : '✕'}
              </span>
              <span className={p.correct ? 'text-emerald-400' : 'text-red-400'}>
                {p.correct
                  ? `Correct — ${p.name} moves 10 yards`
                  : `No gain — ${p.timedOut ? 'Time expired' : 'Incorrect answer'}`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/45">
          Your plays will appear here as the drive unfolds.
        </p>
      )}
    </Panel>
  );
}
function CurrentDrive({
  position,
  score,
  plays,
}: {
  position: number;
  score: number;
  plays: Play[];
}) {
  const outcomes = new Map(
    plays.map((play) => [Number(play.id.split('-')[0]), play.correct ? 'correct' : 'no-gain']),
  );
  return (
    <Panel title="Current drive" className="drill-panel-light">
      <div className="mt-4 flex justify-between gap-1">
        {Array.from({ length: 10 }, (_, i) => {
          const question = i + 1,
            outcome = outcomes.get(question),
            isCurrent = question === position && !outcome;
          return (
            <span
              key={i}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black ${outcome === 'correct' ? 'bg-emerald-600 text-white' : outcome === 'no-gain' ? 'bg-red-600 text-white' : isCurrent ? 'team-primary-filled' : 'bg-slate-300'}`}
            >
              {outcome === 'correct' ? '✓' : outcome === 'no-gain' ? '✕' : question}
            </span>
          );
        })}
      </div>
      <p className="mt-4 text-xs font-black uppercase">
        {Math.max(0, 100 - score)} yards to the end zone
      </p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-300">
        <div className="h-full bg-[var(--primary)]" style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </Panel>
  );
}
function FinalRecap({
  game,
  onPlayAgain,
  onClose,
}: {
  game: Game;
  onPlayAgain: () => void;
  onClose: () => void;
}) {
  const players = game.standings.length
      ? game.standings
      : [
          {
            userId: game.currentUserId,
            name: 'You',
            score: game.score,
            correctAnswers: game.correctAnswers,
          },
        ],
    { ranked, winner } = buildTriviaRecap(players);
  if (!winner) return null;
  const answered = winner.correctAnswers + (winner.wrongAnswers ?? 0) + (winner.timeouts ?? 0),
    responseTime = formatResponseTime(winner.responseTimeTotalMs ?? 0);
  return (
    <Shell>
      <div className="drill-texture min-h-[700px] px-5 py-16 text-center">
        <Trophy className="mx-auto h-14 w-14 text-[var(--secondary)]" />
        <p className="mt-5 text-sm font-black uppercase tracking-[.3em] text-[var(--team-secondary-on-dark)]">
          Final drive · 4 Minute Drill
        </p>
        <h2 className="mt-3 text-5xl font-black uppercase sm:text-7xl">{winner.name} wins</h2>
        <p className="mt-3 text-xl font-black">
          {winner.score} YDS · {winner.correctAnswers}/{answered || game.questionCount} ·{' '}
          {responseTime} response time
        </p>
        <div className="mx-auto mt-8 max-w-2xl overflow-hidden rounded-xl border border-white/20 text-left">
          {rankDrillStandings(ranked).map((p, i) => (
            <div
              key={p.userId}
              className="grid grid-cols-[40px_1fr_auto] border-b border-white/10 bg-white/[.05] p-4 last:border-0"
            >
              <b>{i + 1}</b>
              <b>{p.name}</b>
              <b>{p.score} YDS</b>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-3">
          <button onClick={onPlayAgain} className="trivia-primary-button">
            <RotateCcw className="h-4 w-4" />
            Play again
          </button>
          <button onClick={onClose} className="trivia-secondary-button">
            Back to trivia
          </button>
          <button
            onClick={() =>
              void navigator.clipboard?.writeText(
                `${winner.name} won the Down & Distance 4 Minute Drill with ${winner.score} yards.`,
              )
            }
            className="trivia-secondary-button"
          >
            <Share2 className="h-4 w-4" />
            Share score
          </button>
        </div>
      </div>
    </Shell>
  );
}
