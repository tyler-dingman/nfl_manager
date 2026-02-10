'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import Image from 'next/image';

type DraftGradeModalProps = {
  isOpen: boolean;
  gradeLetter: string | null;
  playerName?: string | null;
  playerMeta?: string | null;
  teamName?: string | null;
  teamLogoUrl?: string | null;
  teamMessage?: string | null;
  onClose: () => void;
};

export function DraftGradeModal({
  isOpen,
  gradeLetter,
  playerName,
  playerMeta,
  teamName,
  teamLogoUrl,
  teamMessage,
  onClose,
}: DraftGradeModalProps) {
  React.useEffect(() => {
    if (!isOpen || !gradeLetter) {
      return;
    }
    const timer = window.setTimeout(() => onClose(), 2000);
    return () => window.clearTimeout(timer);
  }, [gradeLetter, isOpen, onClose]);

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
          <p className="text-4xl font-bold text-foreground">{gradeLetter}</p>
          {playerName ? (
            <p className="mt-2 text-sm font-semibold text-foreground">{playerName}</p>
          ) : null}
          {playerMeta ? <p className="text-xs text-muted-foreground">{playerMeta}</p> : null}
          {teamMessage ? (
            <p className="mt-3 text-sm font-semibold text-foreground">“{teamMessage}”</p>
          ) : null}
        </div>
        <Button type="button" className="mt-4 w-full" onClick={onClose}>
          Continue
        </Button>
      </div>
    </div>
  );
}
