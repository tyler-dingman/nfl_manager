'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import Image from 'next/image';

type DraftGradeModalProps = {
  isOpen: boolean;
  gradeLetter: string | null;
  gradeLabel?: string | null;
  playerName?: string | null;
  playerMeta?: string | null;
  teamName?: string | null;
  teamLogoUrl?: string | null;
  teamMessage?: string | null;
  reasons?: string[];
  onClose: () => void;
};

export function DraftGradeModal({
  isOpen,
  gradeLetter,
  gradeLabel,
  playerName,
  playerMeta,
  teamName,
  teamLogoUrl,
  teamMessage,
  reasons = [],
  onClose,
}: DraftGradeModalProps) {
  if (!isOpen || !gradeLetter) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
              {teamLogoUrl ? (
                <Image
                  src={teamLogoUrl}
                  alt={`${teamName ?? 'Team'} logo`}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">
                  {teamName ?? 'Team'}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Draft Grade</h3>
              {teamName ? <p className="text-xs text-muted-foreground">{teamName}</p> : null}
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-slate-50 p-4 text-center">
          {gradeLabel ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {gradeLabel}
            </p>
          ) : null}
          <p className="text-4xl font-bold text-foreground">{gradeLetter}</p>
          {playerName ? (
            <p className="mt-2 text-sm font-semibold text-foreground">{playerName}</p>
          ) : null}
          {playerMeta ? <p className="text-xs text-muted-foreground">{playerMeta}</p> : null}
          {teamMessage ? (
            <p className="mt-3 text-sm font-semibold text-foreground">“{teamMessage}”</p>
          ) : null}
        </div>
        {reasons.length > 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Why it worked
            </p>
            <ul className="mt-3 space-y-2 text-left text-sm text-foreground">
              {reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Button type="button" className="mt-4 w-full" onClick={onClose}>
          Continue
        </Button>
      </div>
    </div>
  );
}
