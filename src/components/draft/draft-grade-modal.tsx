'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

type DraftGradeModalProps = {
  isOpen: boolean;
  gradeLetter: string | null;
  reason: string | null;
  onClose: () => void;
};

export function DraftGradeModal({ isOpen, gradeLetter, reason, onClose }: DraftGradeModalProps) {
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
        </div>
        <Button type="button" className="mt-4 w-full" onClick={onClose}>
          Continue
        </Button>
      </div>
    </div>
  );
}
