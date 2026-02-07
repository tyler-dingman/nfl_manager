'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { PlayerRowDTO } from '@/types/player';
import { estimateResignInterest } from '@/lib/resign-scoring';
import { getAllowedYearOptions } from '@/lib/contracts';

type ResignPlayerModalProps = {
  player: PlayerRowDTO;
  isOpen: boolean;
  expectedApyOverride?: number;
  onClose: () => void;
  onSubmit: (offer: { years: number; apy: number; guaranteed: number }) => Promise<void>;
};

const getInterestLabel = (score: number) => {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
};

export default function ResignPlayerModal({
  player,
  isOpen,
  expectedApyOverride,
  onClose,
  onSubmit,
}: ResignPlayerModalProps) {
  const [years, setYears] = React.useState(2);
  const [apy, setApy] = React.useState(6);
  const [guaranteed, setGuaranteed] = React.useState(0);
  const allowedYears = React.useMemo(() => getAllowedYearOptions(player), [player]);

  React.useEffect(() => {
    if (!isOpen) return;
    setYears(allowedYears[0] ?? 2);
    setApy(6);
    setGuaranteed(0);
  }, [allowedYears, isOpen, player.id]);

  if (!isOpen) {
    return null;
  }

  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const guaranteedValue = Math.max(0, guaranteed);
  const estimate = estimateResignInterest({
    playerId: player.id,
    age,
    rating,
    years,
    apy,
    guaranteed: guaranteedValue,
    expectedApyOverride,
  });
  const score = estimate.interestScore;
  const interestLabel = getInterestLabel(score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Re-sign {player.firstName} {player.lastName}
          </h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[120px_1fr]">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-xl font-semibold text-slate-600">
            {player.headshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.headshotUrl} alt={player.firstName} className="h-full w-full" />
            ) : (
              `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase()
            )}
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Player details
            </p>
            <p className="font-semibold text-foreground">
              {player.position} · {player.college ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              Age {age} · Rating {rating}
            </p>
            <p className="text-xs text-muted-foreground">
              Preferred years {estimate.expectedYearsRange[0]}-{estimate.expectedYearsRange[1]} ·
              Expected APY ${estimate.expectedApy.toFixed(1)}M
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Years
            </label>
            <select
              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
            >
              {allowedYears.map((value) => (
                <option key={value} value={value}>
                  {value} years
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              APY (M)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={apy}
              onChange={(event) => setApy(Number(event.target.value))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Guaranteed (M)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              max={60}
              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={guaranteed}
              onChange={(event) => setGuaranteed(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Interest: {interestLabel}</span>
            <span>{score.toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${score}%` }} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit({ years, apy, guaranteed: guaranteedValue })}
          >
            Submit Offer
          </Button>
        </div>
      </div>
    </div>
  );
}
