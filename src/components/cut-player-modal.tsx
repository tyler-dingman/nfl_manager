'use client';

import { lockDocumentScroll } from '@/lib/document-scroll-lock';
import { ArrowRight } from 'lucide-react';
import { PlayerTransactionHero, TransactionMetrics } from './player-transaction-hero';
import styles from './player-transaction.module.css';
import { useSaveStore } from '@/features/save/save-store';
import { getActiveSimulationRoster } from '@/lib/front-office-roster';
import { useEffect, useMemo, useState, useRef, type FormEvent } from 'react';

import TransactionModal from '@/components/transaction-modal';
import type { PlayerRowDTO } from '@/types/player';

type CutPlayerModalProps = {
  player: PlayerRowDTO;
  isOpen: boolean;
  currentCapSpace: number;
  teamAbbr?: string;
  season?: number;
  teamRoster?: PlayerRowDTO[];
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

export default function CutPlayerModal({
  player,
  isOpen,
  currentCapSpace,
  teamAbbr,
  season,
  teamRoster,
  onClose,
  onSubmit,
}: CutPlayerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');

  const playerName = useMemo(
    () => `${player.firstName} ${player.lastName}`,
    [player.firstName, player.lastName],
  );
  const savings = useMemo(() => {
    if (typeof player.releaseSavings === 'number') {
      return player.releaseSavings;
    }
    const capHit = parseCapHitMillions(player.capHit);
    return Math.max(0, capHit - (player.deadCap ?? 0));
  }, [player.capHit, player.deadCap, player.releaseSavings]);
  const futureCapSpace = useMemo(() => currentCapSpace + savings, [currentCapSpace, savings]);
  const savedTeam = useSaveStore((s) => s.teamAbbr);
  const savedYear = useSaveStore((s) => s.franchiseYear);
  const savedRoster = useSaveStore((s) => s.roster);
  const team = teamAbbr ?? savedTeam;
  const year = season ?? savedYear;
  const roster = teamRoster ?? savedRoster;
  const depth = getActiveSimulationRoster(roster, team).filter(
    (p) => p.id !== player.id && p.position === player.position,
  ).length;

  useEffect(() => {
    if (!isOpen) return;

    const releaseScroll = lockDocumentScroll();
    return () => {
      releaseScroll();
    };
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
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
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const capCopy =
    savings >= 0
      ? `create ${formatMoneyMillions(savings)} in cap space`
      : `reduce cap space by ${formatMoneyMillions(-savings)}`;
  return (
    <TransactionModal
      open={isOpen}
      variant="cut"
      title={`Release ${playerName}?`}
      onClose={onClose}
      franchiseTeam={team}
      workspaceHero={
        <PlayerTransactionHero
          key={player.id}
          player={player}
          team={team}
          mode="release"
          description={`Moving on from ${playerName} would ${capCopy}. Review the financial impact and depth chart options before making a decision.`}
        />
      }
    >
      <TransactionMetrics
        items={[
          { label: 'Cap Space Created', value: formatMoneyMillions(savings) },
          {
            label: `Dead Cap (${year})`,
            value: formatMoneyMillions(player.deadCap ?? 0),
            detail: 'Accelerated money',
          },
          { label: `${year} Cap Hit`, value: player.capHit },
          {
            label: 'Position Depth',
            value: `${depth} ${depth === 1 ? 'Player' : 'Players'}`,
            detail: `Remaining at ${player.position} after release.`,
          },
        ]}
      />
      <div className={`${styles.bottom} ${styles.releaseBottom}`}>
        <section className={styles.panel}>
          <h3>ROSTER IMPACT</h3>
          <p>See how this move affects your roster.</p>
          <dl className={styles.impact}>
            <div>
              <dt>Cap Space</dt>
              <dd>
                {savings >= 0 ? '+' : ''}
                {formatMoneyMillions(savings)}
              </dd>
            </div>
            <div>
              <dt>Roster Size</dt>
              <dd>−1 Player</dd>
            </div>
            <div>
              <dt>Position Depth</dt>
              <dd>
                {depth
                  ? `${depth} remaining at ${player.position}`
                  : 'No remaining depth at this position'}
              </dd>
            </div>
            <div>
              <dt>Projected Cap Space</dt>
              <dd>{formatMoneyMillions(futureCapSpace)}</dd>
            </div>
          </dl>
        </section>
        <form className={styles.panel} onSubmit={handleSubmit}>
          <h3>CONFIRM ROSTER MOVE</h3>
          <p>
            Releasing {playerName} is permanent and will {capCopy}. This removes him from the active
            roster and depth chart and adds him to free agency. This action cannot be undone.
          </p>
          <button
            type="submit"
            className={styles.primary}
            disabled={isSubmitting}
            aria-label={`Confirm permanent release of ${playerName}`}
          >
            {isSubmitting ? 'Releasing…' : 'Release Player'}
            <ArrowRight size={22} />
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </form>
      </div>
    </TransactionModal>
  );
}
