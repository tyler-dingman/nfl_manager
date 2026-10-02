'use client';

import * as React from 'react';

import { PlayerTransactionHero, TransactionMetrics } from './player-transaction-hero';
import styles from './player-transaction.module.css';
import { ArrowRight, ChartNoAxesColumnIncreasing } from 'lucide-react';
import { useSaveStore } from '@/features/save/save-store';
import TransactionModal from '@/components/transaction-modal';
import type { PlayerRowDTO } from '@/types/player';
import { estimateResignInterest } from '@/lib/resign-scoring';
import { scoreFreeAgencyOffer } from '@/lib/free-agency-scoring';
import { formatMoneyMillions, getYearOneCapHit } from '@/server/logic/cap';
import { CURRENT_MODELED_LEAGUE_YEAR } from '@/server/logic/contract-expiration';

export type OfferResponseTone = 'negative' | 'neutral' | 'positive';

export type OfferResponse = {
  accepted: boolean;
  tone: OfferResponseTone;
  message: string;
  notice: string;
};

type ContractOfferModalProps = {
  player: PlayerRowDTO;
  isOpen: boolean;
  title: string;
  subtitle?: string;
  expectedApyOverride?: number;
  teamAbbr?: string;
  teamRoster?: PlayerRowDTO[];
  previousTeamAbbr?: string | null;
  submitLabel?: string;
  scoreVariant?: 'resign' | 'freeAgency';
  onClose: () => void;
  onSubmit: (offer: {
    years: number;
    apy: number;
    guaranteed: number;
  }) => Promise<OfferResponse | void>;
};

const getInterestLabel = (score: number) => {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
};

const parseNumericInput = (value: string) => {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const allowNumericInput = (value: string) => value === '' || /^\d*\.?\d*$/.test(value);

export default function ContractOfferModal({
  player,
  isOpen,
  title,
  subtitle,
  expectedApyOverride,
  teamAbbr,
  teamRoster,
  previousTeamAbbr,
  submitLabel = 'Submit Offer',
  scoreVariant = 'resign',
  onClose,
  onSubmit,
}: ContractOfferModalProps) {
  const savedTeam = useSaveStore((s) => s.teamAbbr);
  const season = useSaveStore((s) => s.franchiseYear);
  const franchiseTeam = teamAbbr || savedTeam;
  const allowedYears = React.useMemo(() => [1, 2, 3, 4, 5, 6], []);
  const [years, setYears] = React.useState(allowedYears[0] ?? 2);
  const [apyInput, setApyInput] = React.useState('6');
  const [guaranteedInput, setGuaranteedInput] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const submitting = React.useRef(false);
  const [error, setError] = React.useState('');
  const [response, setResponse] = React.useState<OfferResponse | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setYears(allowedYears[0] ?? 2);
    setApyInput('6');
    setGuaranteedInput('');
    setError('');
    setResponse(null);
  }, [allowedYears, isOpen, player.id]);

  if (!isOpen) {
    return null;
  }

  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const apyValue = clampNumber(parseNumericInput(apyInput), 0, 99);
  const guaranteedValue = clampNumber(parseNumericInput(guaranteedInput), 0, 60);
  const estimate =
    scoreVariant === 'freeAgency'
      ? scoreFreeAgencyOffer({
          player,
          years,
          apy: apyValue,
          guaranteed: guaranteedValue,
          teamAbbr,
          teamRoster,
          previousTeamAbbr,
        })
      : estimateResignInterest({
          playerId: player.id,
          age,
          rating,
          position: player.position,
          years,
          apy: apyValue,
          guaranteed: guaranteedValue,
          expectedApyOverride,
          teamAbbr,
          teamRoster,
          previousTeamAbbr,
        });
  const score = estimate.interestScore;
  const interestLabel = getInterestLabel(score);
  const currentLeagueYearCapHit = getYearOneCapHit(apyValue, years);

  const handleSubmit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setIsSubmitting(true);

    try {
      const result = await onSubmit({
        years,
        apy: apyValue,
        guaranteed: guaranteedValue,
      });
      if (result) {
        setResponse(result);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to submit offer right now.',
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const name = `${player.firstName} ${player.lastName}`;
  const signing = scoreVariant === 'freeAgency';
  return (
    <TransactionModal
      open={isOpen}
      variant={signing ? 'sign-free-agent' : 're-sign'}
      title={signing ? `Sign ${name}` : `Re-Negotiate With ${name}`}
      onClose={onClose}
      franchiseTeam={franchiseTeam}
      workspaceHero={
        <PlayerTransactionHero
          key={player.id}
          player={player}
          team={franchiseTeam}
          mode={signing ? 'sign' : 'renegotiate'}
          description={
            signing
              ? 'Set contract terms and gauge interest.'
              : 'Set new contract terms and see if you can reach an agreement.'
          }
        />
      }
    >
      <TransactionMetrics
        items={[
          signing
            ? { label: 'Expected APY', value: `$${estimate.expectedApy.toFixed(1)}M` }
            : { label: 'Current Cap Hit', value: player.capHit },
          signing
            ? {
                label: 'Preferred Deal',
                value: `${estimate.expectedYearsRange[0]}–${estimate.expectedYearsRange[1]} Years`,
              }
            : { label: 'Expected APY', value: `$${estimate.expectedApy.toFixed(1)}M` },
          signing
            ? { label: 'Market Status', value: 'Available Free Agent' }
            : { label: 'Years Remaining', value: player.contractYearsRemaining ?? '—' },
          { label: 'Interest', value: `${interestLabel} · ${score.toFixed(0)}%` },
        ]}
      />
      {!response && (
        <div className={styles.interest}>
          <div>
            <span>Interest: {interestLabel}</span>
            <span>{score.toFixed(0)}%</span>
          </div>
          <div
            className={styles.track}
            role="progressbar"
            aria-label="Player interest"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${score}%` }} />
          </div>
        </div>
      )}
      <div className={styles.bottom}>
        <section className={styles.panel}>
          <div className={styles.editorHeader}>
            <div>
              <h3>CONTRACT TERMS</h3>
              <p>
                {signing
                  ? 'Adjust your offer to improve his interest.'
                  : `Adjust your offer to keep ${name} on your team.`}
              </p>
            </div>
            <button
              type="button"
              disabled
              title="Market comparables are not available yet"
              className={styles.comparables}
            >
              <ChartNoAxesColumnIncreasing
                size={16}
                style={{ display: 'inline', marginRight: 8 }}
              />
              View Market Comparables
            </button>
          </div>
          <div className={styles.fields}>
            <div>
              <label htmlFor="transaction-years">Years</label>
              <select
                id="transaction-years"
                className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                value={years}
                onChange={(event) => {
                  setYears(Number(event.target.value));
                  setResponse(null);
                }}
              >
                {allowedYears.map((value) => (
                  <option key={value} value={value}>
                    {value} years
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="transaction-apy">APY (M)</label>
              <input
                id="transaction-apy"
                type="number"
                inputMode="decimal"
                step={0.5}
                min={0}
                className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                value={apyInput}
                onChange={(event) => {
                  if (!allowNumericInput(event.target.value)) return;
                  setApyInput(event.target.value);
                  setResponse(null);
                }}
                onBlur={() => {
                  if (apyInput.trim() === '') return;
                  const clamped = clampNumber(parseNumericInput(apyInput), 0, 99);
                  setApyInput(clamped.toFixed(1));
                }}
              />
            </div>
            <div>
              <label htmlFor="transaction-guaranteed">Guaranteed (M)</label>
              <input
                id="transaction-guaranteed"
                type="number"
                inputMode="decimal"
                step={0.1}
                min={0}
                max={60}
                className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                value={guaranteedInput}
                onChange={(event) => {
                  if (!allowNumericInput(event.target.value)) return;
                  setGuaranteedInput(event.target.value);
                  setResponse(null);
                }}
                onBlur={() => {
                  if (guaranteedInput.trim() === '') return;
                  const clamped = clampNumber(parseNumericInput(guaranteedInput), 0, 60);
                  setGuaranteedInput(clamped.toFixed(1));
                }}
              />
            </div>
          </div>

          <p style={{ marginTop: 16 }}>
            {season || CURRENT_MODELED_LEAGUE_YEAR} Cap Number:{' '}
            {formatMoneyMillions(currentLeagueYearCapHit)}
          </p>
        </section>
        <section className={styles.panel}>
          <span className={styles.valueLabel}>PROJECTED TOTAL VALUE</span>
          <strong className={styles.total}>{formatMoneyMillions(years * apyValue)}</strong>
          <p>
            {years} {years === 1 ? 'year' : 'years'} · {formatMoneyMillions(guaranteedValue)}{' '}
            guaranteed
          </p>
          <button
            type="button"
            className={styles.primary}
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Sending Offer…' : 'Send Offer'}
            <ArrowRight size={22} />
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={isSubmitting}
            onClick={onClose}
          >
            {response ? 'Continue' : signing ? 'Cancel' : 'Walk Away'}
          </button>
        </section>
      </div>
      {response && (
        <div className={styles.response} role="status">
          <p>“{response.message}”</p>
          <small>{response.notice}</small>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </TransactionModal>
  );
}
