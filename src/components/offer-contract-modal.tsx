'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import type { PlayerRowDTO } from '@/types/player';

const YEAR_OPTIONS = [1, 2, 3, 4, 5];

type OfferContractModalProps = {
  player: PlayerRowDTO;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { years: number; apy: number }) => Promise<void> | void;
};

export default function OfferContractModal({
  player,
  isOpen,
  onClose,
  onSubmit,
}: OfferContractModalProps) {
  const [years, setYears] = useState(3);
  const [apy, setApy] = useState(12);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const title = useMemo(
    () => `${player.firstName} ${player.lastName}`,
    [player.firstName, player.lastName],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!apy || apy <= 0) {
      setError('Enter a valid annual value.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ years, apy });
      onClose();
    } catch {
      setError('Unable to submit offer right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Offer Contract
            </p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">Set contract length and annual payout.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            Years
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
            >
              {YEAR_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            APY (in millions)
            <input
              type="number"
              min={0}
              step={0.1}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={apy}
              onChange={(event) => setApy(Number(event.target.value))}
            />
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Submit Offer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
