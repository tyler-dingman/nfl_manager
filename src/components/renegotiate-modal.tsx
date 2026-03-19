'use client';

import * as React from 'react';

import PlayerTypeIcon from '@/components/player-type-icon';
import { Button } from '@/components/ui/button';
import type { PlayerRowDTO } from '@/types/player';
import { estimateRenegotiateScore } from '@/lib/renegotiate-scoring';
import { formatMoneyMillions, getYearOneCapHit } from '@/server/logic/cap';
import { CURRENT_MODELED_LEAGUE_YEAR } from '@/server/logic/contract-expiration';

type RenegotiateModalProps = {
  player: PlayerRowDTO;
  isOpen: boolean;
  saveId?: string;
  teamLogoUrl?: string | null;
  onClose: () => void;
  onSubmit: (offer: { years: number; apy: number; guaranteed: number }) => Promise<void>;
};

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
    position: player.position,
    seed: saveId ? `${saveId}-${player.id}-${years}-${apy}-${guaranteed}` : undefined,
  });
  const currentLeagueYearCapHit = getYearOneCapHit(apy, years);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">Renegotiate Contract</h3>
            <p className="text-sm text-muted-foreground">
              Player already under contract — must be compelling to accept.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {teamLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teamLogoUrl} alt="Team logo" className="h-8 w-8 object-contain" />
            ) : null}
            <Button type="button" variant="ghost" size="icon" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-[88px_1fr] sm:items-center">
            <div className="w-fit">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600 sm:h-24 sm:w-24">
                {player.headshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.headshotUrl}
                    alt={player.firstName}
                    className="h-full w-full object-cover object-center"
                  />
                ) : (
                  `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase()
                )}
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Player</p>
              <p className="font-semibold text-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span>
                    {player.firstName} {player.lastName}
                  </span>
                  <PlayerTypeIcon player={player} />
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {player.position} · Age {age}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Current Contract
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-white/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Cap hit
                </p>
                <p className="mt-1 font-semibold">{formatMoneyMillions(parseCapHitValue(player))}</p>
              </div>
              <div className="rounded-lg bg-white/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Years left
                </p>
                <p className="mt-1 font-semibold">{yearsRemaining} yrs</p>
              </div>
              <div className="rounded-lg bg-white/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Guaranteed
                </p>
                <p className="mt-1 font-semibold">{formatMoneyMillions(currentGuaranteed)}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Years
            </label>
            <select
              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((value) => (
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

          <p className="mt-5 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{CURRENT_MODELED_LEAGUE_YEAR} Cap Number:</span>{' '}
            {formatMoneyMillions(currentLeagueYearCapHit)}
          </p>

          <div className="mt-5 rounded-xl border border-border bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Acceptance: {estimate.label}</span>
              <span>{estimate.score.toFixed(0)}%</span>
            </div>
            <div className="relative mt-2 h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${estimate.score}%` }}
              />
              <div className="absolute top-0 h-2 w-[2px] bg-slate-700" style={{ left: '70%' }} />
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4 py-4 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-10" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10"
              onClick={() => onSubmit({ years, apy, guaranteed })}
            >
              Propose Renegotiation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
