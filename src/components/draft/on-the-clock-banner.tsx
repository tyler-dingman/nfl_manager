'use client';

import Image from 'next/image';
import { Clock3, PhoneCall, ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

type OnTheClockBannerProps = {
  teamName: string;
  teamLogoUrl?: string | null;
  teamAbbr: string;
  round: number;
  overall: number;
  isUserOnClock: boolean;
  secondsRemaining?: number | null;
  progressPct?: number;
  isCritical?: boolean;
  activeTradeOfferCount?: number;
};

const formatClock = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined) return '--:--';
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

export function OnTheClockBanner({
  teamName,
  teamLogoUrl,
  teamAbbr,
  round,
  overall,
  isUserOnClock,
  secondsRemaining = null,
  progressPct = 0,
  isCritical = false,
  activeTradeOfferCount = 0,
}: OnTheClockBannerProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all',
        isCritical && isUserOnClock ? 'ring-2 ring-amber-300 ring-offset-2' : '',
      )}
    >
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              {teamLogoUrl ? (
                <Image
                  src={teamLogoUrl}
                  alt={`${teamName} logo`}
                  width={52}
                  height={52}
                  className="h-12 w-12 object-contain"
                  unoptimized
                />
              ) : (
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white">
                  {teamAbbr}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                {isUserOnClock ? 'You Are On The Clock' : 'Pick In Progress'}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                {isUserOnClock ? 'Make the call.' : `${teamName} are up.`}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Round {round} · Pick {overall} · {teamName}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {activeTradeOfferCount > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                <PhoneCall className="h-3.5 w-3.5" />
                {activeTradeOfferCount === 1
                  ? 'Teams calling...'
                  : `${activeTradeOfferCount} teams calling...`}
              </div>
            ) : null}
            <div
              className={cn(
                'inline-flex min-w-[148px] items-center gap-2 rounded-2xl border px-4 py-3 text-white',
                isCritical && isUserOnClock
                  ? 'border-amber-300 bg-amber-400/10'
                  : 'border-white/15 bg-white/10',
              )}
            >
              {isCritical && isUserOnClock ? (
                <ShieldAlert className="h-4 w-4 text-amber-300" />
              ) : (
                <Clock3 className="h-4 w-4 text-slate-200" />
              )}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Draft Clock
                </p>
                <p
                  className={cn(
                    'mt-1 text-lg font-semibold',
                    isCritical && isUserOnClock ? 'text-amber-300' : 'text-white',
                  )}
                >
                  {formatClock(secondsRemaining)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-1.5 w-full bg-slate-100">
        <div
          className={cn(
            'h-1.5 transition-all duration-300',
            isCritical && isUserOnClock ? 'bg-amber-400' : 'bg-emerald-500',
          )}
          style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
        />
      </div>
    </section>
  );
}
