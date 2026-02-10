'use client';

import Image from 'next/image';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { createRng } from '@/lib/deterministic-rng';
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

const formatMoneyMillions = (value: number) => {
  const absolute = Math.abs(value);
  const formatted = `$${absolute.toFixed(1)}M`;
  return value < 0 ? `-${formatted}` : formatted;
};

const BIG_SAVINGS_QUOTES = [
  'Tough call, but cap space is oxygen. This helps the whole room.',
  'Sometimes you move on so the team can breathe. This is one of those.',
  'Not personal. Just business. That space opens real options.',
  'Hard decision-right one. Flexibility wins in February.',
];

const SMALL_SAVINGS_QUOTES = [
  'It helps... a little. Do not stop here.',
  "Small win. You'll need a few more moves like this.",
  "It's something. Just do not expect it to fix the cap by itself.",
  'Cleaner sheet, slightly. Keep working.',
];

const BAD_MOVE_QUOTES = [
  'Ouch. That makes the cap worse. You sure about this?',
  'This one hurts the books. Only do it if you are done with the player.',
  "Cap-wise, that's a step back. Better have a reason.",
  "That's pain now for maybe relief later. Think twice.",
];

const pickQuote = (pool: string[], seed: string) => {
  const rng = createRng(seed);
  const index = Math.floor(rng() * pool.length);
  return pool[index] ?? pool[0] ?? '';
};

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
  const delta = futureCapSpace - currentCapSpace;
  const isImproved = delta > 0;
  const isWorsened = delta < 0;
  const isBigSavings = savings >= 10;
  const isSmallSavings = savings > 0 && savings < 10;
  const quoteSeed = `${player.id}:${savings}:${currentCapSpace}`;
  const falcoQuote = useMemo(() => {
    if (isWorsened) {
      return pickQuote(BAD_MOVE_QUOTES, `bad:${quoteSeed}`);
    }
    if (isBigSavings) {
      return pickQuote(BIG_SAVINGS_QUOTES, `big:${quoteSeed}`);
    }
    if (isSmallSavings) {
      return pickQuote(SMALL_SAVINGS_QUOTES, `small:${quoteSeed}`);
    }
    return pickQuote(SMALL_SAVINGS_QUOTES, `neutral:${quoteSeed}`);
  }, [isBigSavings, isSmallSavings, isWorsened, quoteSeed]);

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
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-lg sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Cut Player?</h3>
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

        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-slate-100 p-2">
              <Image src="/images/falco_icon.png" alt="Falco" width={28} height={28} />
            </div>
            <p className="text-sm italic text-slate-600">&ldquo;{falcoQuote}&rdquo;</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Cap Savings
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  savings > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {formatMoneyMillions(savings)}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Current Cap Space</span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatMoneyMillions(currentCapSpace)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Future Cap Space</span>
                <span
                  className={`flex items-center gap-1 text-lg font-semibold ${
                    isImproved ? 'text-emerald-600' : isWorsened ? 'text-red-600' : 'text-slate-600'
                  }`}
                >
                  {isImproved ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : isWorsened ? (
                    <ArrowDownRight className="h-4 w-4" />
                  ) : null}
                  {formatMoneyMillions(futureCapSpace)}
                  <span className="sr-only">
                    {isImproved
                      ? 'Improves cap space'
                      : isWorsened
                        ? 'Worsens cap space'
                        : 'No change'}
                  </span>
                </span>
              </div>
            </div>
          </div>
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
