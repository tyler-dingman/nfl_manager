'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import EditorialVisual from '@/components/editorial/editorial-visual';
import { useAuthUser } from '@/features/auth/auth-session';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Flag,
  History,
  Radio,
  Sparkles,
  X,
} from 'lucide-react';

import type {
  FourthDownQuestion,
  HistoricalThreeAndOut,
  ThreeAndOutPackage,
  ThreeAndOutSource,
  ThreeAndOutStory,
} from '@/features/three-and-out/types';

import ThreeAndOutAudioPlayer from './three-and-out-audio-player';

const DOWN_LABELS = ['1st down', '2nd down', '3rd down'];

function StoryStatus({ story }: { story: ThreeAndOutStory }) {
  const isBreaking = story.status === 'BREAKING';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${isBreaking ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}
    >
      {isBreaking ? <Radio className="h-3 w-3 animate-pulse" /> : null}
      {story.status.replace('_', ' ')}
    </span>
  );
}

function StoryMovement({ story }: { story: ThreeAndOutStory }) {
  if (!story.previousRank || story.previousRank === story.currentRank) return null;
  const movedUp = story.previousRank > story.currentRank;
  const amount = Math.abs(story.previousRank - story.currentRank);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
      {movedUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {movedUp ? 'Moved up' : 'Down'} {amount}
    </span>
  );
}

function StorySources({ sources }: { sources: ThreeAndOutSource[] }) {
  const original = sources.find((source) => source.isOriginalReporter) ?? sources[0];
  return (
    <div className="border-t border-slate-100 pt-5">
      {original ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {original.isOriginalReporter ? 'First reported by' : 'Source'}
          </p>
          <a
            href={original.sourceUrl}
            target={original.sourceUrl.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 font-black text-[var(--team-primary-text)] hover:underline"
          >
            {original.authorName ?? original.sourceName} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : null}
      {sources.length > 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold text-slate-500">
          <span>Additional reporting:</span>
          {sources.slice(1).map((source) => (
            <a
              key={source.id}
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--team-primary-text)] hover:underline"
            >
              {source.authorName ?? source.sourceName}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ThreeAndOutStoryCard({
  story,
  index,
  showUpdate,
  dismissUpdate,
}: {
  story: ThreeAndOutStory;
  index: number;
  showUpdate: boolean;
  dismissUpdate: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-[#00172B]/10 bg-white shadow-sm">
      <div className="grid md:grid-cols-[180px_1fr]">
        <div className="relative min-h-40 md:min-h-full">
          <EditorialVisual
            story={{
              teamId: story.teamId,
              headline: story.shortTitle || story.title,
              summary: story.summary,
              status: story.status,
            }}
            variant="compact"
            decorative
            className="h-full min-h-40 !aspect-auto"
          />
          <p className="absolute left-4 top-12 z-20 text-[10px] font-black uppercase tracking-[0.22em] text-white/80">
            {DOWN_LABELS[index]}
          </p>
          <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2">
            <StoryStatus story={story} />
            <StoryMovement story={story} />
          </div>
        </div>
        <div className="p-5 sm:p-7">
          <h3 className="text-2xl font-black uppercase leading-[1.02] tracking-[-0.035em] text-[#00172B] sm:text-3xl">
            {story.title}
          </h3>
          {showUpdate && story.newSinceLastVisit ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[var(--secondary)]/20 p-4 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--team-primary-text)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--team-primary-text)]">
                  New since your last visit
                </p>
                <p className="mt-1 font-semibold text-[#00172B]">{story.newSinceLastVisit}</p>
              </div>
              <button type="button" onClick={dismissUpdate} aria-label="Dismiss new update">
                <X className="h-4 w-4 text-[#00172B]/40" />
              </button>
            </div>
          ) : null}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {[
              ['What happened', story.summary],
              ['Why it matters', story.whyItMatters],
              ['What’s next', story.whatsNext],
            ].map(([label, text]) => (
              <div key={label}>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--team-primary-text)]">
                  {label}
                </h4>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <StorySources sources={story.sources} />
          </div>
        </div>
      </div>
    </article>
  );
}

function FourthDownPoll({ teamId, initial }: { teamId: string; initial: FourthDownQuestion }) {
  const [question, setQuestion] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const voteKey = `dd-fourth-down-${initial.id}`;
  const { user } = useAuthUser();

  useEffect(() => setSelected(window.localStorage.getItem(voteKey)), [voteKey]);
  const total = question.options.reduce((sum, option) => sum + option.votes, 0);

  const vote = async (optionId: string) => {
    if (selected || submitting) return;
    if (!user) {
      const next = `/three-and-out?team=${encodeURIComponent(teamId)}&vote=${encodeURIComponent(`${question.id}:${optionId}`)}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setSubmitting(true);
    const response = await fetch('/api/three-and-out/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, questionId: question.id, optionId }),
    });
    const payload = (await response.json()) as { question?: FourthDownQuestion; optionId?: string };
    if (payload.question) setQuestion(payload.question);
    const recorded = payload.optionId ?? optionId;
    setSelected(recorded);
    window.localStorage.setItem(voteKey, recorded);
    setSubmitting(false);
  };

  return (
    <section className="rounded-3xl bg-[#FF3D38] p-6 text-white sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-[#F4D9B7]">4th down</p>
      <h3 className="mt-3 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
        {question.question}
      </h3>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {question.options.map((option) => {
          const percent = total ? Math.round((option.votes / total) * 100) : 0;
          return (
            <button
              type="button"
              key={option.id}
              onClick={() => void vote(option.id)}
              disabled={Boolean(selected) || submitting}
              className={`relative min-h-16 overflow-hidden rounded-2xl border px-5 text-left font-black ${selected === option.id ? 'border-[#00172B] bg-[#00172B]' : 'border-white/30 bg-white/10'} disabled:cursor-default`}
              aria-pressed={selected === option.id}
            >
              {selected ? (
                <span
                  className="absolute inset-y-0 left-0 bg-white/10"
                  style={{ width: `${percent}%` }}
                />
              ) : null}
              <span className="relative flex items-center justify-between gap-4 uppercase tracking-wide">
                <span className="flex items-center gap-2">
                  {selected === option.id ? <Check className="h-4 w-4" /> : null} {option.label}
                </span>
                {selected ? <span>{percent}%</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs font-bold text-white/65">
        {selected ? `${total.toLocaleString()} total votes` : 'Choose one · One vote per reader'}
      </p>
    </section>
  );
}

function PreviousThreeAndOut({ snapshots }: { snapshots: HistoricalThreeAndOut[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-3xl border border-[#00172B]/10 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3 font-black uppercase tracking-wide">
          <History className="h-5 w-5 text-[var(--team-primary-text)]" /> Previous Three and Out
        </span>
        <ChevronDown className={`h-5 w-5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 sm:p-6">
          {snapshots.map((snapshot) => (
            <article key={snapshot.id} className="rounded-2xl bg-[#f7f4ee] p-4">
              <p className="text-xs font-black text-[var(--team-primary-text)]">
                {new Date(snapshot.generatedAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              <ol className="mt-3 space-y-2 text-sm font-bold text-[#00172B]">
                {snapshot.storyTitles.map((title, index) => (
                  <li key={title} className="flex gap-2">
                    <span className="text-slate-400">{index + 1}.</span> {title}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function ThreeAndOutExperience({ teamId }: { teamId: string }) {
  const [data, setData] = useState<ThreeAndOutPackage | null>(null);
  const [puntOpen, setPuntOpen] = useState(false);
  const [showUpdates, setShowUpdates] = useState<Record<string, boolean>>({});
  const { user } = useAuthUser();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/three-and-out?team=${encodeURIComponent(teamId)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: ThreeAndOutPackage | null) => {
        if (!payload) return;
        setData(payload);
        if (user) {
          void fetch(`/api/user/team-visit?team=${encodeURIComponent(teamId)}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((visit: { catchMeUp?: { materiallyUpdatedStoryIds?: string[] } } | null) => {
              const ids = visit?.catchMeUp?.materiallyUpdatedStoryIds ?? [];
              setShowUpdates(Object.fromEntries(ids.map((id) => [id, true])));
              void fetch('/api/user/team-visit', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ teamId, snapshotId: payload.current.id }),
              });
            });
        } else {
          const key = `dd-three-and-out-snapshot-${teamId}`;
          const previousId = window.localStorage.getItem(key);
          if (previousId && previousId !== payload.current.id) {
            setShowUpdates(
              Object.fromEntries(
                payload.current.stories
                  .filter((story) => story.newSinceLastVisit)
                  .map((story) => [story.id, true]),
              ),
            );
          }
          window.localStorage.setItem(key, payload.current.id);
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('[3-and-out] failed to load', error);
        }
      });
    return () => controller.abort();
  }, [teamId, user]);

  const updated = useMemo(
    () =>
      data
        ? new Date(data.current.generatedAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })
        : '',
    [data],
  );

  if (!data) {
    return (
      <div className="h-96 animate-pulse rounded-3xl bg-white" aria-label="Loading Three and Out" />
    );
  }

  return (
    <section id="three-and-out" className="space-y-5">
      <header className="flex flex-col gap-5 border-b-4 border-[#00172B] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-5xl font-black leading-none tracking-[-0.06em] text-[#00172B] sm:text-7xl">
            Three <span className="text-[var(--team-primary-text)]">and</span> Out
          </p>
          <p className="mt-2 text-sm font-black uppercase tracking-[0.24em] text-slate-500">
            What matters right now.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          <Clock3 className="h-4 w-4" /> Updated {updated}
        </p>
      </header>

      <ThreeAndOutAudioPlayer snapshot={data.current} />

      <div className="space-y-4">
        {data.current.stories.map((story, index) => (
          <ThreeAndOutStoryCard
            key={story.id}
            story={story}
            index={index}
            showUpdate={Boolean(showUpdates[story.id])}
            dismissUpdate={() => setShowUpdates((current) => ({ ...current, [story.id]: false }))}
          />
        ))}
      </div>

      <FourthDownPoll teamId={teamId} initial={data.current.fourthDown} />

      <section className="overflow-hidden rounded-3xl border border-[#00172B]/10 bg-white">
        <button
          type="button"
          onClick={() => setPuntOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-4 p-6 text-left sm:p-7"
          aria-expanded={puntOpen}
        >
          <span>
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[var(--team-primary-text)]">
              <Flag className="h-4 w-4" /> Punt · Everything else
            </span>
            <span className="mt-2 block text-2xl font-black text-[#00172B]">
              {data.current.puntStories.length} more updates
            </span>
          </span>
          <ArrowRight className={`h-5 w-5 transition ${puntOpen ? 'rotate-90' : ''}`} />
        </button>
        {puntOpen ? (
          <div className="border-t border-slate-100 px-6 pb-6 sm:px-7">
            {data.current.puntStories.map((story) => (
              <article key={story.id} className="border-b border-slate-100 py-5 last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <StoryStatus story={story} />
                    <h3 className="mt-2 text-lg font-black text-[#00172B]">{story.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{story.summary}</p>
                  </div>
                  <span className="shrink-0 text-xs font-black text-slate-300">
                    #{story.currentRank}
                  </span>
                </div>
              </article>
            ))}
            <Link
              href={`/huddle?team=${teamId}`}
              className="mt-2 inline-flex items-center gap-2 font-black text-[var(--team-primary-text)]"
            >
              Open The Drive / full team feed <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </section>

      <PreviousThreeAndOut snapshots={data.previous} />
    </section>
  );
}
