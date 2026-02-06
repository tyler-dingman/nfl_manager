'use client';

import * as React from 'react';

import type { ResignResultDTO } from '@/types/resign';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ResignOfferResultModalProps = {
  result: ResignResultDTO | null;
  isOpen: boolean;
  onClose: () => void;
};

const formatApy = (apy: number) => `$${apy.toFixed(1)}M`;

export default function ResignOfferResultModal({
  result,
  isOpen,
  onClose,
}: ResignOfferResultModalProps) {
  if (!isOpen || !result) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            {result.accepted ? 'Offer Accepted' : 'Offer Declined'}
          </h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {result.accepted
            ? `${result.teamAbbr} re-signing confirmed.`
            : 'The player decided to test the market.'}
        </p>
        <div className="mt-4 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm text-foreground">
          “{result.quote}”
        </div>
        <div className="mt-4 grid gap-3 text-sm text-foreground">
          <div className="flex items-center justify-between">
            <span>Offer</span>
            <span className="font-semibold">
              {result.years} yrs · {formatApy(result.apy)}/yr
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Expected APY</span>
            <span className="font-semibold">{formatApy(result.expectedApy)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Preferred Years</span>
            <span className="font-semibold">
              {result.expectedYearsRange[0]}-{result.expectedYearsRange[1]} yrs
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Interest</span>
            <span className="font-semibold">{result.interestScore}%</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {result.reasoningTags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
