'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { PlayerRowDTO } from '@/types/player';
import { estimateResignInterest } from '@/lib/resign-scoring';
import { scoreFreeAgencyOffer } from '@/lib/free-agency-scoring';
import { getAllowedYearOptions } from '@/lib/contracts';
import { cn } from '@/lib/utils';

export type OfferResponseTone = 'negative' | 'neutral' | 'positive';

export type OfferResponse = {
  accepted: boolean;
  tone: OfferResponseTone;
  message: string;
  notice: string;
};

type ContractOfferModalProps = {
  player: PlayerRowDTO;
  isOpen: boolean;
  title: string;
  subtitle?: string;
  expectedApyOverride?: number;
  submitLabel?: string;
  scoreVariant?: 'resign' | 'freeAgency';
  onClose: () => void;
  onSubmit: (offer: {
    years: number;
    apy: number;
    guaranteed: number;
  }) => Promise<OfferResponse | void>;
};

const getInterestLabel = (score: number) => {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
};

const parseNumericInput = (value: string) => {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const allowNumericInput = (value: string) => value === '' || /^\d*\.?\d*$/.test(value);

export default function ContractOfferModal({
  player,
  isOpen,
  title,
  subtitle,
  expectedApyOverride,
  submitLabel = 'Submit Offer',
  scoreVariant = 'resign',
  onClose,
  onSubmit,
}: ContractOfferModalProps) {
  const allowedYears = React.useMemo(() => getAllowedYearOptions(player), [player]);
  const [years, setYears] = React.useState(allowedYears[0] ?? 2);
  const [apyInput, setApyInput] = React.useState('6');
  const [guaranteedInput, setGuaranteedInput] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [response, setResponse] = React.useState<OfferResponse | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setYears(allowedYears[0] ?? 2);
    setApyInput('6');
    setGuaranteedInput('');
    setError('');
    setResponse(null);
  }, [allowedYears, isOpen, player.id]);

  if (!isOpen) {
    return null;
  }

  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const apyValue = clampNumber(parseNumericInput(apyInput), 0, 99);
  const guaranteedValue = clampNumber(parseNumericInput(guaranteedInput), 0, 60);
  const estimate =
    scoreVariant === 'freeAgency'
      ? scoreFreeAgencyOffer({
          player,
          years,
          apy: apyValue,
          guaranteed: guaranteedValue,
        })
      : estimateResignInterest({
          playerId: player.id,
          age,
          rating,
          position: player.position,
          years,
          apy: apyValue,
          guaranteed: guaranteedValue,
          expectedApyOverride,
        });
  const score = estimate.interestScore;
  const interestLabel = getInterestLabel(score);

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const result = await onSubmit({
        years,
        apy: apyValue,
        guaranteed: guaranteedValue,
      });
      if (result) {
        setResponse(result);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to submit offer right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}

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
              onChange={(event) => {
                setYears(Number(event.target.value));
                setResponse(null);
              }}
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
              inputMode="decimal"
              step={0.5}
              min={0}
              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={apyInput}
              onChange={(event) => {
                if (!allowNumericInput(event.target.value)) return;
                setApyInput(event.target.value);
                setResponse(null);
              }}
              onBlur={() => {
                if (apyInput.trim() === '') return;
                const clamped = clampNumber(parseNumericInput(apyInput), 0, 99);
                setApyInput(clamped.toFixed(1));
              }}
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
              value={guaranteedInput}
              onChange={(event) => {
                if (!allowNumericInput(event.target.value)) return;
                setGuaranteedInput(event.target.value);
                setResponse(null);
              }}
              onBlur={() => {
                if (guaranteedInput.trim() === '') return;
                const clamped = clampNumber(parseNumericInput(guaranteedInput), 0, 60);
                setGuaranteedInput(clamped.toFixed(1));
              }}
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

        {response ? (
          <div
            className={cn(
              'mt-4 rounded-lg border px-4 py-3 text-sm',
              response.tone === 'positive' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              response.tone === 'neutral' && 'border-amber-200 bg-amber-50 text-amber-700',
              response.tone === 'negative' && 'border-red-200 bg-red-50 text-red-700',
            )}
          >
            <p className="font-semibold">{response.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{response.notice}</p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? 'Sending...' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
