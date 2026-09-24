'use client';

import { apiFetch } from '@/lib/api';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  FileQuestion,
  Info,
  Target,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react';
import styles from './trivia-game.module.css';
import UserAvatar from '@/components/auth/user-avatar';
import Image from 'next/image';
import { canSubmitTriviaAnswer, type TriviaExperiencePhase } from '@/features/trivia/experience';
import {
  DRILL_PLAY_CLOCK_SECONDS,
  DRILL_YARDS_PER_CORRECT_ANSWER,
  formatDrillClock,
} from '@/features/trivia/four-minute-drill';
import { useTeamStore } from '@/features/team/team-store';

type Choice = 'A' | 'B' | 'C' | 'D';
type Standing = {
  avatarUrl?: string | null;
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
type Play = {
  id: string;
  at: string;
  name: string;
  correct: boolean;
  points: number;
  position: number;
};
type Live = { standings: Standing[]; activity: Play[] };

export default function TriviaGame({
  teamId,
  teamName,
  initialGameId,
  onClose,
  onBuddies,
}: {
  teamId: string;
  teamName: string;
  initialGameId?: string;
  onClose: () => void;
  onBuddies: () => void;
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
    [live, setLive] = useState<Live | null>(null),
    [reconnecting, setReconnecting] = useState(false),
    [expanded, setExpanded] = useState(false);
  const teamSelector = useRef<HTMLSelectElement>(null);
  const timeoutSent = useRef(false),
    started = useRef(false),
    kickoffShown = useRef(false);
  const load = useCallback(async (id: string) => {
    const response = await apiFetch(`/api/trivia/games/${id}`, { cache: 'no-store' });
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
    setLive(null);
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch('/api/trivia/games', {
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
    if (initialGameId)
      void load(initialGameId).catch((cause) => setError((cause as Error).message));
    else void start();
  }, [initialGameId, load, start]);
  const answer = useCallback(
    async (choice: Choice | null) => {
      if (!game || !canSubmitTriviaAnswer(phase) || busy) return;
      setSelected(choice);
      setPhase('LOCKED');
      setBusy(true);
      try {
        const response = await apiFetch(`/api/trivia/games/${game.gameId}/answer`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ selectedAnswer: choice }),
        });
        const body = (await response.json()) as { result?: Result; error?: string };
        if (!response.ok || !body.result) throw new Error(body.error ?? 'Unable to submit answer.');
        setResult(body.result);
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
    if (
      !game?.question ||
      (phase !== 'QUESTION' && phase !== 'LOCKED') ||
      game.completed ||
      kickoff !== null
    )
      return;
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
      if (left === 0 && phase === 'QUESTION' && !timeoutSent.current) {
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
    if (!game?.waitingForPlayers || error) return;
    const timer = window.setTimeout(() => {
      void load(game.gameId).catch((cause) => setError((cause as Error).message));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [error, game, load]);
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
  useEffect(() => {
    if (!game?.gameId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await apiFetch(`/api/trivia/games/${game.gameId}?live=1`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Live update unavailable');
        const body = (await response.json()) as { live: Live };
        if (!cancelled) {
          setLive(body.live);
          setReconnecting(false);
        }
      } catch {
        if (!cancelled) setReconnecting(true);
      } finally {
        if (!cancelled) timer = setTimeout(refresh, 1200);
      }
    };
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [game?.gameId, result]);
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
  const rows = live?.standings ?? game?.standings ?? [];
  const me = rows.find((row) => row.userId === game?.currentUserId);
  const rank = rows.findIndex((row) => row.userId === game?.currentUserId) + 1;
  const complete = phase === 'COMPLETE' || game?.completed;
  const revealed = phase === 'REVEAL' || phase === 'STANDINGS';
  const runItBack = async () => {
    if (!game || game.mode !== 'GROUP') {
      await start();
      return;
    }
    try {
      const response = await apiFetch(`/api/trivia/games/${game.gameId}/rematch`, {
        method: 'POST',
      });
      const body = await response.json();
      if (!response.ok || !body.joinCode) throw new Error(body.error ?? 'Unable to start rematch.');
      window.location.assign(`/trivia?team=${game.teamId}&room=${body.joinCode}`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Trivia</p>
          <h1>{teamName.split(' ').at(-1)} Trivia</h1>
          <p className={styles.subtitle}>Test your knowledge. Climb the leaderboard.</p>
        </div>
        <div className={styles.actions}>
          <label className={styles.teamSelect}>
            {team?.logo_url ? (
              <Image src={team.logo_url} alt="" width={48} height={34} unoptimized />
            ) : null}
            <select
              ref={teamSelector}
              aria-label="Select trivia team"
              value={teamId}
              onChange={(event) => window.location.assign(`/trivia?team=${event.target.value}`)}
            >
              {teams.map((option) => (
                <option key={option.abbr} value={option.abbr}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.button} onClick={onBuddies}>
            <UsersRound size={22} />
            Play with Buddies
          </button>
        </div>
      </header>
      {error ? (
        <div className={styles.notice} role="alert">
          {error}{' '}
          <button
            className={styles.button}
            onClick={() => {
              setError(null);
              const id = game?.gameId ?? initialGameId;
              if (id) void load(id).catch((cause) => setError(cause.message));
              else void start();
            }}
          >
            Try again
          </button>
          <button className={styles.button} onClick={onClose}>
            Back to trivia
          </button>
        </div>
      ) : null}
      {reconnecting ? (
        <p className={styles.notice} role="status">
          Reconnecting to live standings… Your last standings are shown.
        </p>
      ) : null}
      {!game ? (
        <div className={styles.loading} role="status">
          Loading your trivia game…
        </div>
      ) : (
        <div className={styles.layout}>
          <section className={`${styles.card} ${styles.questionCard}`}>
            <div className={styles.category}>
              {team?.logo_url ? (
                <Image src={team.logo_url} alt="" width={48} height={34} unoptimized />
              ) : null}
              {complete
                ? 'Game complete'
                : (game.question?.category.replaceAll('_', ' ') ?? 'Waiting for players')}
            </div>
            {complete ? (
              <div className={styles.results}>
                <Trophy size={48} />
                <h2>
                  {game.mode === 'GROUP'
                    ? `${rows[0]?.name ?? 'Your game'}${rows[0] ? ' wins' : ' is complete'}`
                    : 'Trivia complete!'}
                </h2>
                <p className={styles.finalScore}>{me?.score ?? game.score} pts</p>
                <p>
                  {me?.correctAnswers ?? game.correctAnswers} of {game.questionCount} correct · Rank
                  #{rank || '—'} of {rows.length}
                </p>
                <div className={styles.actions}>
                  <button
                    className={`${styles.button} ${styles.primary}`}
                    disabled={busy}
                    onClick={() => void runItBack()}
                  >
                    {game.mode === 'GROUP' ? 'Rematch' : 'Play again'}
                  </button>
                  <button
                    className={styles.button}
                    onClick={() => {
                      teamSelector.current?.focus();
                      try {
                        teamSelector.current?.showPicker?.();
                      } catch {
                        /* Focus remains available on browsers without a picker. */
                      }
                    }}
                  >
                    Change team
                  </button>
                  <button className={styles.button} onClick={onBuddies}>
                    Play with Buddies
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.questionBody}>
                <div className={styles.progressRow}>
                  <strong>
                    Question {game.position} of {game.questionCount}
                  </strong>
                  <div
                    className={styles.progress}
                    aria-label={`Question ${game.position} of ${game.questionCount}`}
                  >
                    {Array.from({ length: game.questionCount }, (_, index) => (
                      <span key={index} data-active={index < game.position} />
                    ))}
                  </div>
                  <span
                    className={styles.timer}
                    role="timer"
                    aria-label={`${seconds} seconds remaining`}
                  >
                    <Clock3 size={20} />
                    {formatDrillClock(seconds)}
                  </span>
                </div>
                {kickoff !== null ? (
                  <div className={styles.loading} role="status">
                    Starting in {kickoff}…
                  </div>
                ) : game.waitingForPlayers ? (
                  <div className={styles.loading} role="status">
                    Answer locked. Waiting for the other players…
                  </div>
                ) : (
                  <>
                    <h2 className={styles.question}>{game.question?.question}</h2>
                    <div className={styles.answers}>
                      {answers.map(([choice, text]) => {
                        const correct = revealed && result?.correctAnswer === choice;
                        const wrong = revealed && selected === choice && !correct;
                        return (
                          <button
                            key={choice}
                            aria-pressed={selected === choice}
                            className={styles.answer}
                            data-state={
                              correct
                                ? 'correct'
                                : wrong
                                  ? 'incorrect'
                                  : selected === choice
                                    ? 'selected'
                                    : undefined
                            }
                            disabled={phase !== 'QUESTION' || busy || Boolean(error)}
                            onClick={() => void answer(choice)}
                          >
                            <span className={styles.letter}>{choice}</span>
                            <span>{text}</span>
                            {correct ? (
                              <Check aria-label="Correct answer" />
                            ) : wrong ? (
                              <X aria-label="Incorrect answer" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className={styles.feedback} role="status">
                      {revealed && result ? (
                        <span data-correct={result.correct}>
                          {result.correct
                            ? `Correct! +${result.points} points`
                            : result.timedOut
                              ? 'Time expired. The correct answer is highlighted.'
                              : 'Incorrect. The correct answer is highlighted.'}
                          {phase === 'STANDINGS' ? ' Next question…' : ''}
                        </span>
                      ) : phase === 'LOCKED' ? (
                        'Answer locked. Waiting for results…'
                      ) : (
                        ''
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
          <div className={styles.stats}>
            <Stat icon={<Trophy />} label="Your Score" value={`${me?.score ?? game.score} pts`} />
            <Stat
              icon={<BarChart3 />}
              label={complete ? 'Final Rank' : 'Current Rank'}
              value={`#${rank || '—'} of ${rows.length}`}
            />
            <Stat
              icon={<Target />}
              label="Questions Left"
              value={String(
                Math.max(
                  0,
                  game.questionCount -
                    (me
                      ? me.correctAnswers + (me.wrongAnswers ?? 0) + (me.timeouts ?? 0)
                      : game.position - 1),
                ),
              )}
            />
          </div>
          <aside className={styles.sidebar}>
            <section className={`${styles.card} ${styles.leaderboard}`}>
              <Heading
                icon={<BarChart3 />}
                title={complete ? 'Final Leaderboard' : 'Live Leaderboard'}
                detail={`${rows.length} ${rows.length === 1 ? 'Player' : 'Players'}`}
              />
              <ol className={styles.standings}>
                {rows.map((row, index) => (
                  <li
                    key={row.userId}
                    data-current={row.userId === game.currentUserId}
                    className={
                      !expanded && index >= 5 && row.userId !== game.currentUserId
                        ? styles.extraPlayer
                        : ''
                    }
                  >
                    <span className={styles.rank} data-rank={index + 1}>
                      {index + 1}
                    </span>
                    <UserAvatar
                      src={row.avatarUrl}
                      name={row.name}
                      fallback="initials"
                      className={styles.avatar}
                    />
                    <span className={styles.playerName}>{row.name}</span>
                    <strong>{row.score}</strong>
                  </li>
                ))}
              </ol>
              <button
                className={`${styles.button} ${styles.fullWidth}`}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show Top Players' : 'View Full Leaderboard'}
                <ChevronRight size={19} />
              </button>
            </section>
            <section className={`${styles.card} ${styles.info}`}>
              <Heading icon={<Info />} title="Game Info" />
              <ul>
                <li>
                  <FileQuestion />
                  {game.questionCount} Questions
                </li>
                <li>
                  <Clock3 />
                  {game.timerSeconds} Seconds Each
                </li>
                <li>
                  <Trophy />
                  {DRILL_YARDS_PER_CORRECT_ANSWER} Points per Correct Answer
                </li>
                <li>
                  <UsersRound />
                  {game.mode === 'GROUP'
                    ? 'Compete in Real Time'
                    : game.mode === 'FRIEND_CHALLENGE'
                      ? 'Buddy Challenge'
                      : 'Solo Game'}
                </li>
              </ul>
            </section>
          </aside>
          <section className={`${styles.card} ${styles.activity}`}>
            <Heading icon={<Activity />} title="Recent Activity" />
            {live?.activity.length ? (
              <ul className={styles.events}>
                {live.activity.map((play) => (
                  <li key={play.id}>
                    <span className={styles.outcome} data-correct={play.correct}>
                      {play.correct ? <Check /> : <X />}
                    </span>
                    <div>
                      <p>
                        <strong>{play.name}</strong>{' '}
                        {play.correct ? `earned ${play.points} points` : 'missed'}
                      </p>
                      <p>
                        Q{play.position} · {relativeTime(play.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>Answers will appear here as players respond.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
function Heading({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <header className={styles.cardHeading}>
      <h2>
        {icon}
        {title}
      </h2>
      {detail ? <span>{detail}</span> : null}
    </header>
  );
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function relativeTime(at: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 1000));
  return seconds < 5
    ? 'just now'
    : seconds < 60
      ? `${seconds} seconds ago`
      : `${Math.floor(seconds / 60)} minutes ago`;
}
