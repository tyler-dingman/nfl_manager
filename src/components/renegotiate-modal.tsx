'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { PlayerRowDTO } from '@/types/player';
import { estimateRenegotiateScore } from '@/lib/renegotiate-scoring';

type RenegotiateModalProps = {
  player: PlayerRowDTO;
  isOpen: boolean;
  saveId?: string;
  teamLogoUrl?: string | null;
  onClose: () => void;
  onSubmit: (offer: { years: number; apy: number; guaranteed: number }) => Promise<void>;
};

const formatMillions = (value: number) => `$${value.toFixed(1)}M`;

const parseCapHitValue = (player: PlayerRowDTO) =>
  player.capHitValue ?? (Number(player.capHit.replace(/[^0-9.]/g, '')) || 0);

export default function RenegotiateModal({
  player,
  isOpen,
  saveId,
  teamLogoUrl,
  onClose,
  onSubmit,
}: RenegotiateModalProps) {
  const [years, setYears] = React.useState(2);
  const [apy, setApy] = React.useState(8);
  const [guaranteed, setGuaranteed] = React.useState(6);

  React.useEffect(() => {
    setYears(2);
    setApy(player.salary ?? parseCapHitValue(player));
    setGuaranteed(player.guaranteed ?? 0);
  }, [player]);

  if (!isOpen) {
    return null;
  }

  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const currentApy = player.contract?.apy ?? player.salary ?? parseCapHitValue(player);
  const currentGuaranteed = player.contract?.guaranteed ?? player.guaranteed ?? 0;
  const yearsRemaining = player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 1;
  const estimate = estimateRenegotiateScore({
    age,
    rating,
    yearsRemaining,
    currentApy,
    currentGuaranteed,
    years,
    apy,
    guaranteed,
    seed: saveId ? `${saveId}-${player.id}-${years}-${apy}-${guaranteed}` : undefined,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Renegotiate Contract</h3>
            <p className="text-xs text-muted-foreground">
              Player already under contract — must be compelling to accept.
            </p>
          </div>
          {teamLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamLogoUrl} alt="Team logo" className="h-8 w-8" />
          ) : null}
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[100px_1fr]">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600">
            {player.headshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.headshotUrl} alt={player.firstName} className="h-full w-full" />
            ) : (
              `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase()
            )}
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Player</p>
            <p className="font-semibold text-foreground">
              {player.firstName} {player.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              {player.position} · Age {age} · Rating {rating}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Current contract
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span>Cap hit</span>
            <span className="font-semibold">{formatMillions(parseCapHitValue(player))}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Years remaining</span>
            <span className="font-semibold">{yearsRemaining} yrs</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Guaranteed</span>
            <span className="font-semibold">{formatMillions(currentGuaranteed)}</span>
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
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {value} years
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Value / yr (M)
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
              step="0.5"
              min="0"
              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={guaranteed}
              onChange={(event) => setGuaranteed(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Acceptance: {estimate.label}</span>
            <span>{estimate.score.toFixed(0)}%</span>
          </div>
          <div className="relative mt-2 h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${estimate.score}%` }}
            />
            <div className="absolute top-0 h-2 w-[2px] bg-slate-700" style={{ left: '90%' }} />
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Renegotiate threshold: 90
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSubmit({ years, apy, guaranteed })}>
            Propose Renegotiation
          </Button>
        </div>
      </div>
    </div>
  );
}
