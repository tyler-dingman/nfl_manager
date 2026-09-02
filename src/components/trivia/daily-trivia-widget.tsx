'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Clock3, X } from 'lucide-react';

import { useAuthUser } from '@/features/auth/auth-session';

type Choice = 'A' | 'B' | 'C' | 'D';
type DailyPayload = {
  dailyQuestion: {
    id: string;
    questionId: string;
    question: string;
    answers: Record<Choice, string>;
    category: string;
    completed: boolean;
    result: {
      selectedAnswer: Choice;
      correct: boolean;
      pointsAwarded: number;
      correctAnswer: Choice;
    } | null;
    explanation?: string;
  };
  moveTheChains: { currentDriveYards: number; touchdowns: number } | null;
};

export default function DailyTriviaWidget({ teamId }: { teamId: string }) {
  const { user } = useAuthUser();
  const [payload, setPayload] = useState<DailyPayload | null>(null);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [result, setResult] = useState<{
    correct: boolean;
    points: number;
    answer: Choice;
    explanation: string;
  } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/trivia/daily?team=${encodeURIComponent(teamId)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((next: DailyPayload | null) => {
        if (!next) return;
        setPayload(next);
        setStartedAt(Date.now());
        if (next.dailyQuestion.result) {
          setSelected(next.dailyQuestion.result.selectedAnswer);
          setResult({
            correct: next.dailyQuestion.result.correct,
            points: next.dailyQuestion.result.pointsAwarded,
            answer: next.dailyQuestion.result.correctAnswer,
            explanation: next.dailyQuestion.explanation ?? '',
          });
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [teamId, user]);

  const answer = async (choice: Choice) => {
    if (!payload || selected) return;
    setSelected(choice);
    const response = await fetch('/api/trivia/daily/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        teamId,
        dailyQuestionId: payload.dailyQuestion.id,
        questionId: payload.dailyQuestion.questionId,
        selectedAnswer: choice,
        responseTimeMs: startedAt ? Date.now() - startedAt : 0,
      }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as {
      result: { correct: boolean; points: number };
      answer: Choice;
      explanation: string;
      moveTheChains?: DailyPayload['moveTheChains'];
    };
    setResult({ ...body.result, answer: body.answer, explanation: body.explanation });
    if (body.moveTheChains)
      setPayload((current) =>
        current
          ? { ...current, moveTheChains: body.moveTheChains ?? current.moveTheChains }
          : current,
      );
  };

  const chainLabel = useMemo(
    () =>
      payload?.moveTheChains
        ? `${payload.moveTheChains.currentDriveYards} / 100 YDS`
        : 'SIGN IN TO TRACK',
    [payload],
  );
  if (!payload) return null;
  const completed = Boolean(selected || payload.dailyQuestion.completed);

  return (
    <section
      className="rounded-3xl bg-[#00172B] p-6 text-white shadow-sm sm:p-8"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#F4D9B7]">Trivia</p>
          <p className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white/55">
            Daily question · {payload.dailyQuestion.category.replaceAll('_', ' ')}
          </p>
        </div>
        <Clock3 className="h-5 w-5 text-[#F4D9B7]" />
      </div>
      {completed && result ? (
        <div className="mt-7">
          <p className="flex items-center gap-2 text-2xl font-black uppercase">
            {result.correct ? (
              <Check className="h-6 w-6 text-emerald-300" />
            ) : (
              <X className="h-6 w-6 text-[#FF8C88]" />
            )}
            {result.correct ? 'Correct' : 'Not this time'}
          </p>
          <p className="mt-3 text-lg font-black">
            {result.correct
              ? `+${result.points.toLocaleString()} Trivia Pts`
              : `Answer: ${payload.dailyQuestion.answers[result.answer]}`}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">{result.explanation}</p>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[#F4D9B7]">
            Move the Chains · {chainLabel}
          </p>
        </div>
      ) : (
        <>
          <h3 className="mt-7 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">
            {payload.dailyQuestion.question}
          </h3>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(Object.entries(payload.dailyQuestion.answers) as [Choice, string][]).map(
              ([choice, text]) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => {
                    setStartedAt((current) => current ?? Date.now());
                    void answer(choice);
                  }}
                  className="min-h-14 rounded-2xl border border-white/20 bg-white/10 px-4 text-left font-black hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-[#F4D9B7]"
                >
                  <span className="mr-3 text-[#F4D9B7]">{choice}</span>
                  {text}
                </button>
              ),
            )}
          </div>
        </>
      )}
      <Link
        href={`/trivia?team=${encodeURIComponent(teamId)}`}
        className="mt-7 inline-flex text-sm font-black uppercase tracking-[0.16em] text-[#F4D9B7] hover:text-white"
      >
        Play more Trivia →
      </Link>
    </section>
  );
}
