'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import type { PlayerRowDTO } from '@/types/player';

type CutPlayerModalProps = {
  player: PlayerRowDTO;
  isOpen: boolean;
  currentCapSpace: number;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
};

const parseCapHitMillions = (capHit: string) => {
  const parsed = Number.parseFloat(capHit.replace(/[$M,]/gi, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoneyMillions = (value: number) => `$${value.toFixed(1)}M`;

export default function CutPlayerModal({
  player,
  isOpen,
  currentCapSpace,
  onClose,
  onSubmit,
}: CutPlayerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const playerName = useMemo(
    () => `${player.firstName} ${player.lastName}`,
    [player.firstName, player.lastName],
  );
  const savings = useMemo(() => parseCapHitMillions(player.capHit), [player.capHit]);
  const futureCapSpace = useMemo(() => currentCapSpace + savings, [currentCapSpace, savings]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    setIsSubmitting(true);
    try {
      await onSubmit();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to cut player right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Cut Player?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You will save {formatMoneyMillions(savings)} against the cap if you cut {playerName}.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Current Cap Space: {formatMoneyMillions(currentCapSpace)}
            </p>
            <p className="text-sm text-muted-foreground">
              Future Cap Space: {formatMoneyMillions(futureCapSpace)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </Button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Cutting...' : 'Cut Player'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
