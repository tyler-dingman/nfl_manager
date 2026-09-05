'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { useTeamStore } from '@/features/team/team-store';

export type TransactionVariant =
  | 're-sign'
  | 'sign-free-agent'
  | 'trade-outgoing'
  | 'trade-received'
  | 'counteroffer'
  | 'cut'
  | 'waiver-claim'
  | 'depth-replacement';

export const TRANSACTION_ASSETS: Record<
  TransactionVariant,
  { icon: string; phrase: string; phraseText: string }
> = {
  're-sign': {
    icon: 'contract-512.png',
    phrase: 'run-it-back-1400x300.png',
    phraseText: 'Run it back',
  },
  'sign-free-agent': {
    icon: 'handshake-512.png',
    phrase: 'bring-him-in-1400x300.png',
    phraseText: 'Bring him in',
  },
  'trade-outgoing': {
    icon: 'trade-arrows-512.png',
    phrase: 'make-the-call-1400x300.png',
    phraseText: 'Make the call',
  },
  'trade-received': {
    icon: 'trade-arrows-512.png',
    phrase: 'theyre-calling-1400x300.png',
    phraseText: "They're calling",
  },
  counteroffer: {
    icon: 'contract-512.png',
    phrase: 'back-to-the-table-1400x300.png',
    phraseText: 'Back to the table',
  },
  cut: { icon: 'cut-x-512.png', phrase: 'tough-call-1400x300.png', phraseText: 'Tough call' },
  'waiver-claim': {
    icon: 'target-512.png',
    phrase: 'put-in-the-claim-1400x300.png',
    phraseText: 'Put in the claim',
  },
  'depth-replacement': {
    icon: 'helmet-silhouette-512.png',
    phrase: 'next-man-up-1400x300.png',
    phraseText: 'Next man up',
  },
};

type Props = {
  open: boolean;
  variant: TransactionVariant;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function TransactionModal({
  open,
  variant,
  title,
  description,
  onClose,
  children,
  footer,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const team = teams.find((item) => item.id === selectedTeamId) ?? teams[0];
  const assets = TRANSACTION_ASSETS[variant];

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() =>
      dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus(),
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;
  const style = {
    '--txn-icon': `url('/assets/transaction-modal/icons/${assets.icon}')`,
    '--txn-phrase': `url('/assets/transaction-modal/phrases/${assets.phrase}')`,
  } as CSSProperties;

  return (
    <div
      className="txn-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`txn-modal txn-modal--${variant}`}
        style={style}
      >
        <i className="txn-layer txn-layer--field" aria-hidden="true" />
        <i className="txn-layer txn-layer--playbook" aria-hidden="true" />
        <i className="txn-layer txn-layer--grain" aria-hidden="true" />
        <i className="txn-layer txn-layer--stroke" aria-hidden="true" />
        <header className="txn-hero">
          {team?.logo_url ? (
            <Image
              src={team.logo_url}
              width={56}
              height={56}
              alt={`${team.name} logo`}
              className="txn-team-logo"
            />
          ) : null}
          <div className="txn-icon" aria-hidden="true" />
          <div className="txn-phrase" aria-hidden="true" />
          <span className="sr-only">{assets.phraseText}</span>
          <button
            type="button"
            className="txn-close"
            onClick={onClose}
            aria-label="Close transaction dialog"
          >
            <X />
          </button>
        </header>
        <div className="txn-content">
          <h2 id={titleId}>{title}</h2>
          {description ? (
            <p id={descriptionId} className="txn-description">
              {description}
            </p>
          ) : null}
          {children}
        </div>
        {footer ? <footer className="txn-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
