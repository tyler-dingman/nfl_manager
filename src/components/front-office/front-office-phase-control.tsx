'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Loader2, X } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSaveStore } from '@/features/save/save-store';
import {
  getFrontOfficePhaseActions,
  phaseDisplayName,
  type FrontOfficePhaseAction,
} from '@/lib/front-office-phase';

export function FrontOfficePhaseControl({
  season,
  phase,
  freeAgencyWave,
}: {
  season: number;
  phase: string;
  freeAgencyWave: number;
}) {
  const setPhase = useSaveStore((state) => state.setPhase);
  const [pending, setPending] = useState<FrontOfficePhaseAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const actions = getFrontOfficePhaseActions(phase);

  useEffect(() => {
    if (!pending) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPending(null);
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pending]);

  const advance = async (action: FrontOfficePhaseAction) => {
    if (action.requiresConfirmation) {
      setPending(action);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setPhase(action.target);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to advance the franchise phase.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="front-office-command-status" aria-label="Franchise phase">
        <div>
          <span>Season</span>
          <strong>{season}</strong>
        </div>
        <div>
          <span>Record</span>
          <strong aria-label="Record unavailable">—</strong>
        </div>
        <div>
          <span>Current phase</span>
          <strong>{phaseDisplayName(phase, freeAgencyWave)}</strong>
        </div>
        <div className="fo-phase-split">
          <button
            type="button"
            className="front-office-advance-button"
            disabled={busy}
            onClick={() => void advance(actions.primary)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {actions.primary.label} <ArrowRight className="h-4 w-4" />
          </button>
          {actions.jumps.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="fo-phase-menu" aria-label="Skip-ahead options">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.jumps.map((action) => (
                  <DropdownMenuItem key={action.label} onClick={() => void advance(action)}>
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="fo-phase-error">
            {error}
          </p>
        ) : null}
      </div>
      {pending ? (
        <div
          className="app-modal-layer fixed inset-0 grid place-items-center bg-black/55 p-4"
          role="presentation"
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fo-skip-title"
            className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
          >
            <button
              ref={cancelRef}
              type="button"
              className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full border border-border"
              onClick={() => setPending(null)}
              aria-label="Close confirmation"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#c80027]">
              Skip ahead
            </p>
            <h2 id="fo-skip-title" className="mt-2 pr-10 text-xl font-black text-[#071329]">
              {pending.label}?
            </h2>
            <p className="mt-3 text-sm text-[#536b88]">{pending.confirmation}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="min-h-11 rounded-md border px-4 font-bold"
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="team-primary-filled min-h-11 rounded-md px-4 font-bold"
                onClick={async () => {
                  const action = pending;
                  setPending(null);
                  await advance({ ...action, requiresConfirmation: false });
                }}
              >
                Confirm and continue
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
