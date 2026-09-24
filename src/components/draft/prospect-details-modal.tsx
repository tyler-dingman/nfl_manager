'use client';

import { ProspectProfile } from './prospect-profile';
import { useProspectBoard } from './use-prospect-board';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import styles from './prospect-profile.module.css';
import { buildProspectDetailsModel } from '@/lib/draft-prospect-details';
import type { DraftBoardEntry } from '@/lib/draft-board';
import type { DraftRun } from '@/lib/draft-intelligence';
import type { PlayerRowDTO } from '@/types/player';

type ProspectDetailsModalProps = {
  open: boolean;
  player: PlayerRowDTO | null;
  players?: PlayerRowDTO[];
  boardEntry?: DraftBoardEntry | null;
  teamNeeds: string[];
  activeRuns?: DraftRun[];
  canDraft?: boolean;
  draftBusy?: boolean;
  onResumeDraft?: () => void;
  onDraft?: (player: PlayerRowDTO) => void;
  onSelectPlayer?: (playerId: string) => void;
  onClose: () => void;
  closeLabel?: string;
  teamAbbr?: string;
  year?: number;
  isOnBoard?: boolean;
  onToggleBoard?: (id: string) => void;
};

export function ProspectDetailsModal({
  open,
  player,
  players = [],
  boardEntry,
  teamNeeds,
  activeRuns = [],
  canDraft = false,
  draftBusy = false,
  onDraft,
  onSelectPlayer,
  onClose,
  closeLabel = 'Back to Draft Board',
  teamAbbr,
  year = 2027,
  isOnBoard,
  onToggleBoard,
}: ProspectDetailsModalProps) {
  const personalBoard = useProspectBoard(year);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const selectedIndex = React.useMemo(() => {
    if (!player) return -1;
    return players.findIndex((entry) => entry.id === player.id);
  }, [player, players]);
  const previousPlayer = selectedIndex > 0 ? players[selectedIndex - 1] : null;
  const nextPlayer =
    selectedIndex !== -1 && selectedIndex < players.length - 1 ? players[selectedIndex + 1] : null;

  const handleSelectPrevious = React.useCallback(() => {
    if (previousPlayer && onSelectPlayer) {
      onSelectPlayer(previousPlayer.id);
    }
  }, [onSelectPlayer, previousPlayer]);

  const handleSelectNext = React.useCallback(() => {
    if (nextPlayer && onSelectPlayer) {
      onSelectPlayer(nextPlayer.id);
    }
  }, [nextPlayer, onSelectPlayer]);

  const keyboardActions = React.useRef({ onClose, handleSelectPrevious, handleSelectNext });
  keyboardActions.current = { onClose, handleSelectPrevious, handleSelectNext };

  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') keyboardActions.current.onClose();
      if (event.key === 'Tab') {
        const elements = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
          ) ?? [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      if ((event.target as HTMLElement)?.closest('[role=tablist], input, select, textarea')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        keyboardActions.current.handleSelectPrevious();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        keyboardActions.current.handleSelectNext();
      }
    };

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
      previousFocus?.focus();
    };
  }, [open]);

  React.useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open, player?.id]);

  const model = React.useMemo(() => {
    if (!open || !player) return null;
    return buildProspectDetailsModel({ player, boardEntry, teamNeeds, activeRuns });
  }, [activeRuns, boardEntry, open, player, teamNeeds]);

  if (!open || !player || !model) return null;

  return createPortal(
    <div className={`app-modal-layer front-office-surface ${styles.backdrop}`} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${model.name} — Prospect Details`}
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <ProspectProfile
          key={player.id}
          player={player}
          model={model}
          teamAbbr={teamAbbr}
          teamNeeds={teamNeeds}
          boardEntry={boardEntry}
          year={year}
          isOnBoard={isOnBoard ?? personalBoard.ids.includes(player.id)}
          onToggleBoard={() => (onToggleBoard ?? personalBoard.toggle)(player.id)}
          canDraft={canDraft && !player.isDrafted}
          draftBusy={draftBusy}
          onDraft={onDraft ? () => onDraft(player) : undefined}
          navigation={
            <>
              <button type="button" className={styles.backButton} onClick={onClose}>
                ← {closeLabel}
              </button>
              <button
                type="button"
                aria-label="Previous prospect"
                disabled={!previousPlayer || !onSelectPlayer}
                onClick={handleSelectPrevious}
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                aria-label="Next prospect"
                disabled={!nextPlayer || !onSelectPlayer}
                onClick={handleSelectNext}
              >
                <ChevronRight />
              </button>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close prospect details"
                onClick={onClose}
              >
                <X />
              </button>
            </>
          }
        />
      </div>
    </div>,
    document.body,
  );
}
