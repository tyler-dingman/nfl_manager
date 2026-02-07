'use client';

import { cn } from '@/lib/utils';

type NextActionBannerProps = {
  phase: 'resign_cut' | 'free_agency' | 'draft' | 'season';
  capSpaceMillions: number;
  capRankLabel: string;
  teamPrimaryColor: string;
  onAdvance?: () => void;
};

const formatCapMillions = (value: number) => {
  const absValue = Math.abs(value);
  const formatted = `$${absValue.toFixed(1)}M`;
  return value < 0 ? `-${formatted}` : formatted;
};

const getResignSubtext = (capSpace: number) => {
  if (capSpace < 0) {
    return "We're in the red. Trim the cap hit first—clean decisions now give you a chance to breathe later.";
  }
  if (capSpace < 10) {
    return 'Not much room to work with. Keep your core, be selective, and save flexibility for the market.';
  }
  return 'Good. Keep the locker room intact and protect your flexibility before the market opens.';
};

const getFreeAgencySubtext = (capSpace: number) => {
  if (capSpace < 0) {
    return "You're shopping with an empty wallet. Look for value deals—or get back under the cap first.";
  }
  if (capSpace < 10) {
    return 'Target needs, not headlines. One smart signing beats three desperate ones.';
  }
  return "You've got room—use it with discipline. Upgrade starters, then round out depth.";
};

const getPhaseCopy = (phase: NextActionBannerProps['phase'], capSpace: number) => {
  if (phase === 'resign_cut') {
    return {
      headline: 'Re-sign or cut players before Free Agency',
      subtext: getResignSubtext(capSpace),
      cta: 'Advance to Free Agency',
    };
  }
  if (phase === 'free_agency') {
    return {
      headline: 'Fill roster holes by signing free agents',
      subtext: getFreeAgencySubtext(capSpace),
      cta: 'Advance to Draft',
    };
  }
  if (phase === 'draft') {
    return {
      headline: 'Draft the future of your franchise',
      subtext: "Stay calm. Trust the board. When the room gets messy, that's where you find value.",
      cta: 'Advance to Season',
    };
  }
  return {
    headline: 'Season is underway',
    subtext: "You've set the table. Now we see what the team becomes.",
    cta: null,
  };
};

export default function NextActionBanner({
  phase,
  capSpaceMillions,
  capRankLabel,
  teamPrimaryColor,
  onAdvance,
}: NextActionBannerProps) {
  const copy = getPhaseCopy(phase, capSpaceMillions);
  const isCapCrisis = capSpaceMillions < 0;
  const capLabel = `Cap Space: ${formatCapMillions(capSpaceMillions)} / ${capRankLabel}`;
  const capTextClass =
    capSpaceMillions < 0 ? 'text-red-200' : 'text-[color-mix(in_srgb,var(--team-primary-foreground)_80%,transparent)]';

  return (
    <div
      className={cn('mb-6 rounded-2xl border border-transparent p-5 text-[var(--team-primary-foreground)]')}
      style={{ backgroundColor: teamPrimaryColor }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p
            className="text-xs uppercase tracking-[0.2em]"
            style={{
              color: isCapCrisis
                ? 'rgba(255,255,255,0.7)'
                : 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
            }}
          >
            Next Action
          </p>
          <h2 className="mt-1 text-xl font-semibold">{copy.headline}</h2>
          <p
            className="mt-1 text-sm"
            style={{
              color: isCapCrisis
                ? 'rgba(255,255,255,0.8)'
                : 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
            }}
          >
            {copy.subtext}
          </p>
          <div className={cn('mt-3 text-xs font-semibold', capTextClass)}>{capLabel}</div>
        </div>
        {copy.cta ? (
          <button
            type="button"
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-semibold',
              isCapCrisis ? 'border-white/30 text-white' : 'border-white/40',
            )}
            style={{ color: isCapCrisis ? '#fff' : 'var(--team-primary-foreground)' }}
            onClick={onAdvance}
          >
            {copy.cta}
          </button>
        ) : null}
      </div>
    </div>
  );
}
