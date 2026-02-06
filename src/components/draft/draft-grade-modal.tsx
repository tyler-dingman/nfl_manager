'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

type DraftGradeModalProps = {
  isOpen: boolean;
  gradeLetter: string | null;
  reason: string | null;
  reasons?: string[];
  falcoQuote?: string | null;
  onClose: () => void;
};

export function DraftGradeModal({
  isOpen,
  gradeLetter,
  reason,
  reasons,
  falcoQuote,
  onClose,
}: DraftGradeModalProps) {
  if (!isOpen || !gradeLetter) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Draft Grade</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-slate-50 p-4 text-center">
          <p className="text-4xl font-bold text-foreground">{gradeLetter}</p>
          {reason ? <p className="mt-2 text-xs text-muted-foreground">{reason}</p> : null}
          {reasons && reasons.length > 0 ? (
            <ul className="mt-3 space-y-1 text-left text-xs text-muted-foreground">
              {reasons.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          ) : null}
          {falcoQuote ? (
            <p className="mt-3 text-xs font-semibold text-foreground">“{falcoQuote}”</p>
          ) : null}
        </div>
        <Button type="button" className="mt-4 w-full" onClick={onClose}>
          Continue
        </Button>
      </div>
    </div>
  );
}
