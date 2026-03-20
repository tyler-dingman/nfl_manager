'use client';

import Image from 'next/image';
import { Clock3, PhoneCall, ShieldAlert } from 'lucide-react';

import { getReadableTextColor, lightenHexColor } from '@/lib/color-utils';
import { cn } from '@/lib/utils';

type OnTheClockBannerProps = {
  teamName: string;
  teamLogoUrl?: string | null;
  teamAbbr: string;
  teamPrimaryColor?: string | null;
  teamSecondaryColor?: string | null;
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
  teamPrimaryColor,
  teamSecondaryColor,
  round,
  overall,
  isUserOnClock,
  secondsRemaining = null,
  progressPct = 0,
  isCritical = false,
  activeTradeOfferCount = 0,
}: OnTheClockBannerProps) {
  const primaryColor = teamPrimaryColor ?? '#020617';
  const secondaryColor = teamSecondaryColor
    ? lightenHexColor(teamSecondaryColor, 0.08)
    : lightenHexColor(primaryColor, 0.14);
  const onPrimaryColor = getReadableTextColor(primaryColor);
  const mutedOnPrimary =
    onPrimaryColor === '#ffffff' ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)';

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all',
        isCritical && isUserOnClock ? 'ring-2 ring-amber-300 ring-offset-2' : '',
      )}
    >
      <div
        className="px-4 py-4 transition-colors duration-500 ease-in-out sm:px-6"
        style={{
          backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
          color: onPrimaryColor,
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor:
                  onPrimaryColor === '#ffffff' ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)',
              }}
            >
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: mutedOnPrimary }}>
                {isUserOnClock ? 'You Are On The Clock' : 'Pick In Progress'}
              </p>
              <h2 className="mt-1 text-xl font-semibold sm:text-2xl" style={{ color: onPrimaryColor }}>
                {isUserOnClock ? 'Make the call.' : `${teamName} are up.`}
              </h2>
              <p className="mt-1 text-sm" style={{ color: mutedOnPrimary }}>
                Round {round} · Pick {overall} · {teamName}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {activeTradeOfferCount > 0 ? (
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold"
                style={{
                  borderColor:
                    onPrimaryColor === '#ffffff' ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.14)',
                  backgroundColor:
                    onPrimaryColor === '#ffffff' ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)',
                  color: onPrimaryColor,
                }}
              >
                <PhoneCall className="h-3.5 w-3.5" />
                {activeTradeOfferCount === 1
                  ? 'Teams calling...'
                  : `${activeTradeOfferCount} teams calling...`}
              </div>
            ) : null}
            <div
              className={cn(
                'inline-flex min-w-[148px] items-center gap-2 rounded-2xl border px-4 py-3',
              )}
              style={{
                borderColor:
                  isCritical && isUserOnClock
                    ? '#fcd34d'
                    : onPrimaryColor === '#ffffff'
                      ? 'rgba(255,255,255,0.16)'
                      : 'rgba(15,23,42,0.14)',
                backgroundColor:
                  isCritical && isUserOnClock
                    ? 'rgba(251,191,36,0.10)'
                    : onPrimaryColor === '#ffffff'
                      ? 'rgba(255,255,255,0.10)'
                      : 'rgba(15,23,42,0.08)',
                color: onPrimaryColor,
              }}
            >
              {isCritical && isUserOnClock ? (
                <ShieldAlert className="h-4 w-4 text-amber-300" />
              ) : (
                <Clock3 className="h-4 w-4" style={{ color: mutedOnPrimary }} />
              )}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: mutedOnPrimary }}>
                  Draft Clock
                </p>
                <p
                  className={cn(
                    'mt-1 text-lg font-semibold',
                    isCritical && isUserOnClock ? 'text-amber-300' : '',
                  )}
                  style={isCritical && isUserOnClock ? undefined : { color: onPrimaryColor }}
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
            'h-1.5 transition-[width,background-color,opacity] duration-500 ease-in-out',
            isCritical && isUserOnClock ? 'bg-amber-400' : 'bg-emerald-500',
          )}
          style={{
            width: `${Math.max(0, Math.min(100, progressPct))}%`,
            backgroundColor: isCritical && isUserOnClock ? undefined : primaryColor,
            opacity: 0.96,
          }}
        />
      </div>
    </section>
  );
}
