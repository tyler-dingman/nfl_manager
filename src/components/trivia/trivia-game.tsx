'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Clock3, RotateCcw, Share2, Trophy, X } from 'lucide-react';

import {
  buildTriviaRecap,
  canSubmitTriviaAnswer,
  type TriviaExperiencePhase,
} from '@/features/trivia/experience';

type Choice = 'A' | 'B' | 'C' | 'D';
type Standing = {
  userId: string;
  name: string;
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
  timedOut: boolean;
  yardAwarded: number;
  touchdownsEarned?: number;
  unlockedRewards?: Array<{ id: string; title: string }>;
  completed: boolean;
};

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
  const [game, setGame] = useState<Game | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [phase, setPhase] = useState<TriviaExperiencePhase>('QUESTION');
  const [seconds, setSeconds] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [kickoff, setKickoff] = useState<number | null>(null);
  const timeoutSent = useRef(false);
  const started = useRef(false);
  const kickoffShown = useRef(false);

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/trivia/games/${id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load game.');
    const body = (await response.json()) as { game: Game };
    setGame(body.game);
    setResult(null);
    setSelected(null);
    setPhase(body.game.completed ? 'COMPLETE' : 'QUESTION');
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
        const revealDelay =
          game.mode === 'GROUP' && game.question
            ? Math.max(
                450,
                new Date(game.question.presentedAt).getTime() +
                  game.timerSeconds * 1000 -
                  Date.now(),
              )
            : 450;
        window.setTimeout(() => setPhase('REVEAL'), revealDelay);
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
      () => setKickoff((value) => (value !== null && value > 1 ? value - 1 : null)),
      850,
    );
    return () => window.clearTimeout(timer);
  }, [kickoff]);

  useEffect(() => {
    if (phase !== 'REVEAL') return;
    const timer = window.setTimeout(() => setPhase('STANDINGS'), 3000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const next = async () => {
    if (!game) return;
    setBusy(true);
    try {
      await load(game.gameId);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const answers = useMemo(() => {
    if (!game?.question) return [];
    return [
      { choice: 'A' as const, text: game.question.answerA },
      { choice: 'B' as const, text: game.question.answerB },
      { choice: 'C' as const, text: game.question.answerC },
      { choice: 'D' as const, text: game.question.answerD },
    ];
  }, [game]);

  useEffect(() => {
    if (!game?.waitingForPlayers) return;
    const timer = window.setInterval(() => void load(game.gameId), 1000);
    return () => window.clearInterval(timer);
  }, [game, load]);

  if (error)
    return (
      <GameFrame>
        <div className="mx-auto max-w-xl px-6 py-20 text-center">
          <X className="mx-auto h-12 w-12 text-[#FF625D]" />
          <h2 className="mt-5 text-3xl font-black uppercase">Couldn&apos;t start the game</h2>
          <p className="mt-3 font-semibold text-white/65">{error}</p>
          <div className="mt-7 flex justify-center gap-3">
            <button onClick={() => void start()} className="trivia-primary-button">
              Try again
            </button>
            <button onClick={onClose} className="trivia-secondary-button">
              Back to lobby
            </button>
          </div>
        </div>
      </GameFrame>
    );

  if (!game)
    return (
      <GameFrame>
        <div className="flex min-h-[520px] items-center justify-center text-center">
          <div>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-[var(--secondary)] motion-reduce:animate-none" />
            <p className="mt-5 text-sm font-black uppercase tracking-[.24em] text-white/60">
              Setting the board
            </p>
          </div>
        </div>
      </GameFrame>
    );

  const totalScore = game.score + (result?.points ?? 0);
  const totalCorrect = game.correctAnswers + (result?.correct ? 1 : 0);
  const runItBack = async () => {
    if (game.mode !== 'GROUP') return start();
    const response = await fetch(`/api/trivia/games/${game.gameId}/rematch`, { method: 'POST' });
    const body = await response.json();
    if (!response.ok) return setError(body.error ?? 'Unable to run it back.');
    window.location.assign(`/trivia?team=${game.teamId}&room=${body.joinCode}`);
  };

  if (kickoff !== null)
    return (
      <GameFrame>
        <div className="flex min-h-[560px] items-center justify-center text-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.3em] text-[var(--team-secondary-on-dark)]">
              The crew is ready
            </p>
            <p className="mt-4 text-9xl font-black tabular-nums">{kickoff}</p>
            <p className="mt-3 text-2xl font-black uppercase">Let&apos;s go</p>
          </div>
        </div>
      </GameFrame>
    );

  if (game.waitingForPlayers)
    return (
      <GameFrame>
        <GameHeader
          teamName={teamName}
          position={game.position}
          count={game.questionCount}
          score={game.score}
        />
        <CompactStandings rows={game.standings} currentUserId={game.currentUserId} />
        <div className="px-5 py-20 text-center">
          <p className="text-xs font-black uppercase tracking-[.28em] text-[var(--team-secondary-on-dark)]">
            Answer locked
          </p>
          <h2 className="mt-3 text-4xl font-black uppercase">Waiting on the crew</h2>
          <p className="mt-3 font-semibold text-white/55">
            The next question starts when everyone answers or the clock expires.
          </p>
        </div>
      </GameFrame>
    );

  if (phase === 'COMPLETE' || game.completed)
    return <FinalRecap game={game} onPlayAgain={() => void runItBack()} onClose={onClose} />;

  if (phase === 'STANDINGS') {
    const standings = game.standings.length
      ? game.standings.map((row) =>
          row.userId === game.currentUserId
            ? { ...row, score: totalScore, correctAnswers: totalCorrect }
            : row,
        )
      : [{ userId: 'current', name: 'You', score: totalScore, correctAnswers: totalCorrect }];
    return (
      <GameFrame>
        <GameHeader
          teamName={teamName}
          position={game.position}
          count={game.questionCount}
          score={totalScore}
        />
        <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
          <p className="text-center text-xs font-black uppercase tracking-[.3em] text-[var(--team-secondary-on-dark)]">
            Live standings
          </p>
          <h2 className="mt-3 text-center text-4xl font-black uppercase sm:text-5xl">
            After {game.position}
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/15">
            {[...standings]
              .sort((a, b) => b.score - a.score)
              .map((row, index) => (
                <div
                  key={row.userId}
                  className={`grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b border-white/10 px-4 py-4 last:border-0 ${row.userId === game.currentUserId ? 'bg-[var(--primary)] text-[var(--team-on-primary)]' : 'bg-white/[.06]'}`}
                >
                  <span className="text-xl font-black">{index + 1}</span>
                  <span className="truncate font-black">{row.name}</span>
                  <span className="font-black tabular-nums">
                    {row.score.toLocaleString()}{' '}
                    <RankMovement current={row.currentRank} previous={row.previousRank} />
                  </span>
                </div>
              ))}
          </div>
          <button
            onClick={() => void next()}
            disabled={busy}
            className="trivia-primary-button mt-7 w-full"
          >
            {result?.completed ? 'See final' : 'Next question'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </GameFrame>
    );
  }

  const progress = Math.min(100, (game.position / game.questionCount) * 100);
  return (
    <GameFrame>
      <GameHeader
        teamName={teamName}
        position={game.position}
        count={game.questionCount}
        score={totalScore}
      />
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-[var(--secondary)] transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
      {game.mode === 'GROUP' && game.standings.length > 1 ? (
        <CompactStandings rows={game.standings} currentUserId={game.currentUserId} />
      ) : null}
      <div className="mx-auto flex min-h-[600px] max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-black uppercase tracking-[.22em] text-white/50">
            {game.question?.category.replaceAll('_', ' ')} · Max 40 pts
          </p>
          <Countdown seconds={seconds} total={game.timerSeconds} />
        </div>
        <h2 className="mx-auto mt-6 max-w-4xl text-center text-3xl font-black uppercase leading-[1.04] tracking-[-.035em] sm:mt-10 sm:text-5xl lg:text-6xl">
          {game.question?.question}
        </h2>
        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2">
          {answers.map(({ choice, text }) => {
            const correct = phase === 'REVEAL' && result?.correctAnswer === choice;
            const picked = selected === choice;
            const wrong = phase === 'REVEAL' && picked && !correct;
            const style = correct
              ? 'border-emerald-400 bg-emerald-500/20'
              : wrong
                ? 'border-[#FF625D] bg-[#FF625D]/20'
                : picked
                  ? 'border-[var(--secondary)] bg-[var(--secondary)]/15'
                  : 'border-white/15 bg-white/[.07] hover:border-[var(--secondary)] hover:bg-white/[.11]';
            return (
              <button
                type="button"
                disabled={phase !== 'QUESTION' || busy}
                key={choice}
                onClick={() => void answer(choice)}
                className={`min-h-[76px] rounded-xl border-2 px-4 py-4 text-left text-base font-black transition focus:outline-none focus:ring-4 focus:ring-[var(--secondary)]/50 sm:min-h-[94px] sm:px-6 sm:text-xl ${style}`}
              >
                <span className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-[var(--team-secondary-on-dark)]">
                  {choice}
                </span>
                {text}
                {phase === 'LOCKED' && picked ? (
                  <Status>Locked in</Status>
                ) : correct ? (
                  <Status>✓ Correct answer</Status>
                ) : wrong ? (
                  <Status>✕ Your pick</Status>
                ) : null}
              </button>
            );
          })}
        </div>
        {phase === 'LOCKED' ? (
          <p className="mt-7 text-center text-sm font-black uppercase tracking-[.24em] text-[var(--team-secondary-on-dark)]">
            Answer locked in
          </p>
        ) : null}
        {phase === 'REVEAL' && result ? (
          <div className="mt-7 rounded-2xl border border-white/15 bg-white/[.07] p-5 text-center sm:p-6">
            <p className="flex items-center justify-center gap-2 text-3xl font-black uppercase">
              {result.correct ? (
                <Check className="h-8 w-8 text-emerald-400" />
              ) : (
                <X className="h-8 w-8 text-[#FF625D]" />
              )}
              {result.timedOut ? "Time's up" : result.correct ? 'Correct' : 'Incorrect'}
            </p>
            <p className="mt-2 text-2xl font-black text-[var(--team-secondary-on-dark)]">
              +{result.points.toLocaleString()} PTS
            </p>
            {result.yardAwarded ? (
              <p className="mt-2 text-xs font-black uppercase tracking-[.2em] text-emerald-300">
                Move the Chains · +{result.yardAwarded}{' '}
                {result.yardAwarded === 1 ? 'yard' : 'yards'}
              </p>
            ) : null}
            {result.touchdownsEarned ? (
              <p className="mt-2 text-sm font-black uppercase tracking-[.2em] text-[#F4D9B7]">
                Touchdown! Drive reset with the extra yards carried forward.
              </p>
            ) : null}
            {result.unlockedRewards?.map((reward) => (
              <p key={reward.id} className="mt-2 text-sm font-black text-[#F4D9B7]">
                Reward unlocked · {reward.title}
              </p>
            ))}
            {result.explanation ? (
              <p className="mx-auto mt-4 max-w-2xl font-semibold leading-6 text-white/65">
                {result.explanation}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </GameFrame>
  );
}

function CompactStandings({ rows, currentUserId }: { rows: Standing[]; currentUserId: string }) {
  return (
    <div className="border-b border-white/10 bg-white/[.04] px-4 py-3 sm:px-6">
      <p className="mb-2 text-[9px] font-black uppercase tracking-[.2em] text-[var(--team-secondary-on-dark)]">
        Live standings entering this question
      </p>
      <div className="grid gap-1 sm:grid-cols-5">
        {rows.slice(0, 5).map((row, index) => (
          <div
            key={row.userId}
            className={`grid grid-cols-[20px_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-xs font-black ${row.userId === currentUserId ? 'bg-[var(--primary)] text-[var(--team-on-primary)]' : 'bg-white/[.06]'}`}
          >
            <span>{index + 1}</span>
            <span className="truncate">{row.name}</span>
            <span>{row.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankMovement({
  current,
  previous,
}: {
  current?: number | null;
  previous?: number | null;
}) {
  if (!current || !previous || current === previous)
    return <span className="ml-1 text-white/35">—</span>;
  const movement = previous - current;
  return (
    <span className={`ml-1 ${movement > 0 ? 'text-emerald-300' : 'text-[#FF9A96]'}`}>
      {movement > 0 ? '↑' : '↓'}
      {Math.abs(movement)}
    </span>
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
          userId: 'current',
          name: 'You',
          score: game.score,
          correctAnswers: game.correctAnswers,
        },
      ];
  const { ranked, winner, biggestLoser } = buildTriviaRecap(players);
  if (!winner || !biggestLoser) return null;
  return (
    <GameFrame>
      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-10 sm:py-16">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[.32em] text-[var(--team-secondary-on-dark)]">
            Final · Game recap
          </p>
          <Trophy className="mx-auto mt-5 h-12 w-12 text-[var(--team-secondary-on-dark)]" />
          <h2 className="mt-4 text-5xl font-black uppercase tracking-[-.05em] sm:text-7xl">
            {winner.name}
          </h2>
          <p className="mt-2 text-sm font-black uppercase tracking-[.2em] text-white/50">
            Trivia champ · {winner.score} points
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <RecapAward title="Winner" player={winner} detail="Took care of business." />
          <RecapAward
            title="Biggest Loser"
            player={biggestLoser}
            detail="Rough day at the office. Run it back."
          />
        </div>
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/15">
          {ranked.map((player, index) => {
            const answered =
              player.correctAnswers + (player.wrongAnswers ?? 0) + (player.timeouts ?? 0);
            const average = answered
              ? ((player.responseTimeTotalMs ?? 0) / answered / 1000).toFixed(1)
              : '—';
            return (
              <div
                key={player.userId}
                className="grid grid-cols-[36px_1fr_auto] gap-3 border-b border-white/10 bg-white/[.05] p-4 last:border-0 sm:grid-cols-[36px_1fr_repeat(4,auto)] sm:items-center"
              >
                <span className="text-xl font-black">{index + 1}</span>
                <span className="font-black">{player.name}</span>
                <PlayerMetric label="Final" value={String(player.score)} />
                <PlayerMetric label="Correct" value={`${player.correctAnswers}/10`} />
                <PlayerMetric label="Avg time" value={`${average}s`} />
                <PlayerMetric label="Best" value={`+${player.bestQuestionScore ?? 0}`} />
              </div>
            );
          })}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <button onClick={onPlayAgain} className="trivia-primary-button">
            <RotateCcw className="h-4 w-4" /> Run it back
          </button>
          <button onClick={onClose} className="trivia-secondary-button">
            New game
          </button>
          <button
            onClick={() =>
              void navigator.clipboard?.writeText(
                `${winner.name} won Down & Distance Trivia with ${winner.score} points.`,
              )
            }
            className="trivia-secondary-button"
          >
            <Share2 className="h-4 w-4" /> Share results
          </button>
        </div>
      </div>
    </GameFrame>
  );
}

function RecapAward({
  title,
  player,
  detail,
}: {
  title: string;
  player: Standing;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[.07] p-5">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-[var(--team-secondary-on-dark)]">
        {title}
      </p>
      <p className="mt-2 text-2xl font-black uppercase">{player.name}</p>
      <p className="mt-1 text-lg font-black">{player.score} PTS</p>
      <p className="mt-2 text-sm font-semibold text-white/50">{detail}</p>
    </div>
  );
}

function PlayerMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-right">
      <span className="block text-sm font-black">{value}</span>
      <span className="block text-[8px] font-black uppercase tracking-wider text-white/35">
        {label}
      </span>
    </span>
  );
}

function GameFrame({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="overflow-hidden rounded-[28px] border border-white/10 bg-[#071625] text-white shadow-2xl shadow-[#00172B]/25"
      aria-live="polite"
    >
      {children}
    </section>
  );
}
function GameHeader({
  teamName,
  position,
  count,
  score,
}: {
  teamName: string;
  position: number;
  count: number;
  score: number;
}) {
  return (
    <header className="grid grid-cols-[1fr_auto] items-center gap-3 bg-[var(--dark)] px-4 py-3 text-[var(--team-on-dark)] sm:grid-cols-3 sm:px-6">
      <p className="truncate text-xs font-black uppercase tracking-[.15em] sm:text-sm">
        {teamName} Trivia
      </p>
      <p className="hidden text-center text-xs font-black uppercase tracking-[.2em] text-white/60 sm:block">
        Q{position}/{count}
      </p>
      <p className="text-right text-sm font-black tabular-nums sm:text-base">
        {score.toLocaleString()} PTS
      </p>
    </header>
  );
}
function Countdown({ seconds, total }: { seconds: number; total: number }) {
  const progress = Math.max(0, Math.min(100, (seconds / total) * 100));
  return (
    <div
      className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${seconds <= 5 ? 'text-[#FF625D]' : 'text-white'}`}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(currentColor ${progress}%, rgba(255,255,255,.14) ${progress}%)`,
        }}
      />
      <div className="absolute inset-[4px] rounded-full bg-[#071625]" />
      <span className="relative text-xl font-black tabular-nums">{seconds}</span>
      <Clock3 className="sr-only" />
    </div>
  );
}
function Status({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-3 text-xs uppercase tracking-wider text-[var(--team-secondary-on-dark)]">
      {children}
    </span>
  );
}
function FinalStat({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`bg-white/[.06] p-5 ${className}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/45">
        {label}
      </p>
    </div>
  );
}
