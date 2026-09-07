'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';

import {
  EMPTY_FAN_PULSE_COUNTS,
  FAN_PULSE_REACTIONS,
  dominantFanPulse,
  fanPulsePercentages,
  fanPulseSummary,
  type FanPulseCounts,
  type FanPulseReaction,
} from '@/features/fan-pulse/model';

const REACTIONS: Array<{ type: FanPulseReaction; emoji: string; label: string }> = [
  { type: 'FIRED_UP', emoji: '🔥', label: 'Fired Up' },
  { type: 'LIKE_IT', emoji: '👍', label: 'Like It' },
  { type: 'NOT_SURE', emoji: '🤔', label: 'Not Sure' },
  { type: 'DONT_LOVE_IT', emoji: '😬', label: 'Don’t Love It' },
  { type: 'NO_WAY', emoji: '😲', label: 'No Way' },
];
const SEGMENT_CLASSES: Record<FanPulseReaction, string> = {
  FIRED_UP: 'bg-[var(--primary)] text-[var(--team-primary-foreground)]',
  LIKE_IT: 'bg-blue-500 text-white',
  NOT_SURE: 'bg-amber-300 text-slate-900',
  DONT_LOVE_IT: 'bg-slate-400 text-slate-950',
  NO_WAY: 'bg-slate-700 text-white',
};

type PulseResponse = {
  total: number;
  counts: FanPulseCounts;
  percentages: FanPulseCounts;
  selected: FanPulseReaction | null;
};

const temporaryKey = (contentId: string) => `dnd:fan-pulse:${contentId}`;

export function FanPulse({
  contentId,
  teamId,
  teamName,
}: {
  contentId: string;
  teamId: string;
  teamName: string;
}) {
  const [pulse, setPulse] = useState<PulseResponse>({
    total: 0,
    counts: { ...EMPTY_FAN_PULSE_COUNTS },
    percentages: { ...EMPTY_FAN_PULSE_COUNTS },
    selected: null,
  });
  const [status, setStatus] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/fan-pulse?contentId=${encodeURIComponent(contentId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load Fan Pulse.');
        return response.json() as Promise<{ pulse: PulseResponse }>;
      })
      .then(({ pulse: next }) => {
        if (cancelled) return;
        const temporary = window.localStorage.getItem(temporaryKey(contentId)) as FanPulseReaction;
        setPulse({
          ...next,
          selected: next.selected ?? (FAN_PULSE_REACTIONS.includes(temporary) ? temporary : null),
        });
      })
      .catch(() => {
        if (!cancelled) setStatus('Fan Pulse is temporarily unavailable.');
      });
    window.dispatchEvent(
      new CustomEvent('down-distance:analytics', {
        detail: { event: 'fan_pulse_viewed', contentId, teamId },
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [contentId, teamId]);

  const summary = useMemo(() => fanPulseSummary(teamName, pulse.counts), [pulse.counts, teamName]);

  const react = async (reaction: FanPulseReaction) => {
    if (busy || pulse.selected === reaction) return;
    const previous = pulse;
    const counts = { ...pulse.counts };
    if (pulse.selected) counts[pulse.selected] = Math.max(0, counts[pulse.selected] - 1);
    counts[reaction] += 1;
    const optimistic = {
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      counts,
      percentages: fanPulsePercentages(counts),
      selected: reaction,
    };
    setPulse(optimistic);
    setStatus("You're in the Pulse.");
    setBusy(true);
    const event = previous.selected ? 'fan_pulse_reaction_changed' : 'fan_pulse_reacted';
    window.dispatchEvent(
      new CustomEvent('down-distance:analytics', {
        detail: { event, contentId, teamId, reaction },
      }),
    );
    try {
      const response = await fetch('/api/fan-pulse', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, teamId, reaction }),
      });
      if (response.status === 401) {
        window.localStorage.setItem(temporaryKey(contentId), reaction);
        setSignedOut(true);
        setStatus('Reaction saved on this device. Sign in to save it to your account.');
        return;
      }
      if (!response.ok) throw new Error('Unable to save reaction.');
      const data = (await response.json()) as { pulse: PulseResponse };
      window.localStorage.removeItem(temporaryKey(contentId));
      setPulse(data.pulse);
    } catch {
      setPulse(previous);
      setStatus('We could not save that reaction. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
      aria-labelledby="fan-pulse-title"
    >
      <div className="grid gap-5 md:grid-cols-[1.15fr_1px_1fr] md:items-stretch">
        <div>
          <h2
            id="fan-pulse-title"
            className="text-sm font-black uppercase tracking-tight text-[#0b1f3a]"
          >
            Add to the Pulse
          </h2>
          <div
            className="mt-3 grid grid-cols-5 gap-2"
            role="group"
            aria-label="Choose a fan reaction"
          >
            {REACTIONS.map(({ type, emoji, label }) => (
              <button
                key={type}
                type="button"
                aria-label={label}
                aria-pressed={pulse.selected === type}
                disabled={busy}
                onClick={() => void react(type)}
                className="min-w-0 rounded-lg border bg-white px-1 py-2 text-center transition hover:-translate-y-0.5 hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-70"
                style={
                  pulse.selected === type
                    ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 2px var(--primary)' }
                    : undefined
                }
              >
                <span className="block text-2xl sm:text-3xl" aria-hidden="true">
                  {emoji}
                </span>
                <span className="mt-1 block text-[10px] font-bold leading-tight text-slate-800 sm:text-xs">
                  {label}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {pulse.selected
              ? "You're in the Pulse."
              : `Join the conversation. Tap a reaction to see how ${teamName} fans feel.`}
          </p>
        </div>
        <div className="hidden bg-slate-200 md:block" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-black uppercase text-[#0b1f3a]">{teamName} Fan Pulse</h2>
          <p className="mt-1 text-xs text-slate-500">{pulse.total.toLocaleString()} fans reacted</p>
          <div
            className="mt-4 flex h-9 overflow-hidden rounded-md bg-slate-200"
            role="img"
            aria-label={REACTIONS.map(
              ({ type, label }) => `${label}: ${pulse.percentages[type]}%`,
            ).join(', ')}
          >
            {REACTIONS.map(({ type }) =>
              pulse.percentages[type] > 0 ? (
                <span
                  key={type}
                  className={`grid h-full place-items-center text-xs font-black ${SEGMENT_CLASSES[type]}`}
                  style={{ width: `${pulse.percentages[type]}%` }}
                >
                  {pulse.percentages[type] >= 8 ? `${pulse.percentages[type]}%` : null}
                </span>
              ) : null,
            )}
          </div>
          <div className="mt-3 flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <strong>{summary}</strong>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-600" aria-live="polite">
        {status}
      </p>
      {signedOut ? (
        <Link
          href={`/login?next=/content/${encodeURIComponent(contentId)}`}
          className="text-xs font-bold text-[var(--team-primary-text)] underline"
        >
          Sign in to keep your reaction
        </Link>
      ) : null}
    </section>
  );
}

export function FanPulseIndicator({ counts }: { counts: FanPulseCounts }) {
  const dominant = dominantFanPulse(counts);
  if (!dominant) return null;
  const meta = REACTIONS.find((item) => item.type === dominant)!;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return (
    <span
      aria-label={`${fanPulsePercentages(counts)[dominant]} percent ${meta.label}; ${total} reactions`}
    >
      {meta.emoji} {fanPulsePercentages(counts)[dominant]}% ·{' '}
      {Intl.NumberFormat('en', { notation: 'compact' }).format(total)} reactions
    </span>
  );
}
