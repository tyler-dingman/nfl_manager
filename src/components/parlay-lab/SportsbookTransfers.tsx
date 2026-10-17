'use client';
import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { sportsbookBrands } from '../../../packages/parlay/sportsbook-brand';
import {
  sportsbooks,
  sportsbookConfig,
  sportsbookNotice,
} from '../../../packages/parlay/sportsbook-transfer';
import { displayOdds, slipPick } from '../../../packages/parlay/slip';
import type { SportsbookTransferModel } from '../../../packages/parlay/use-sportsbook-transfers';
import styles from './my-parlay-panel.module.css';
export function SportsbookTransfers({
  model: m,
  showDetails = false,
}: {
  model: SportsbookTransferModel;
  showDetails?: boolean;
}) {
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
  const openSportsbook = (url: string) => {
    // No blank tab. A blocked delayed popup falls back to same-tab navigation.
    const tab = window.open(url, '_blank');
    if (tab) {
      tab.opener = null;
      setBlockedUrl(null);
    } else {
      setBlockedUrl(url);
      window.location.assign(url);
    }
  };
  if (!m.loading && !m.error && !m.unavailable && !m.proposals.length) return null;
  return (
    <section
      className={`${styles.fanduel} ${styles.sportsbookTransfers}`}
      aria-label="Sportsbook transfers"
    >
      <strong className={styles.note}>OPEN IN SPORTSBOOK</strong>
      {m.unavailable && (
        <p className={styles.note} role="status">
          {m.unavailableReason}
        </p>
      )}
      {m.loading && (
        <p className={styles.note} role="status">
          Checking stored sportsbook availability...
        </p>
      )}
      {m.error && (
        <p className={styles.note} role="alert">
          {m.error}
        </p>
      )}
      {[...m.proposals]
        .sort((a, b) => sportsbooks.indexOf(a.sportsbook) - sportsbooks.indexOf(b.sportsbook))
        .map((p) => {
          const book = p.sportsbook,
            name = sportsbookConfig[book].name,
            s = m.states[book];
          const brand =
            book === 'fanduel' || book === 'draftkings' ? sportsbookBrands[book] : undefined;
          const brandStyle = brand
            ? ({
                '--book-bg': brand.background,
                '--book-highlight': brand.highlight,
                '--book-ink': brand.ink,
                '--book-accent': brand.accent,
              } as CSSProperties)
            : undefined;
          const mark = brand && (
            <span className={styles.bookIdentity} aria-hidden="true">
              <Image
                unoptimized
                src={
                  book === 'fanduel'
                    ? '/assets/sportsbooks/fanduel_white.svg'
                    : '/assets/sportsbooks/draftkings_logo.png'
                }
                alt=""
                width={book === 'fanduel' ? 110 : 32}
                height={32}
                className={styles.bookLogo}
              />
              {book === 'draftkings' && (
                <span className={styles.bookWordmark}>
                  DraftKings<small>SPORTSBOOK</small>
                </span>
              )}
            </span>
          );
          return (
            <div key={book} className={styles.fanduel}>
              {m.confirmation === book ? (
                <div role="group" aria-label={`${name} Line Adjustment`}>
                  <strong>{name} Line Adjustment</strong>
                  {p.matches
                    .filter((x) => x.adjusted)
                    .map(({ original: o, selection: s }) => (
                      <p key={o.id} className={styles.note}>
                        <strong>{o.playerName}</strong>
                        <br />
                        Original: {slipPick(o)}
                        <br />
                        Proposed: {slipPick(s)} · {displayOdds(s.odds)}
                      </p>
                    ))}
                  <p className={styles.note}>
                    Our stored prices include a nearby line at {name}. We’ll ask the sportsbook to
                    match this alternative. This changes the odds and payout. Your original parlay
                    stays unchanged.
                  </p>
                  <button className={styles.open} onClick={m.confirm} disabled={m.busy}>
                    Continue with Adjustment
                  </button>
                  <button className={styles.transferSecondary} onClick={m.cancelConfirmation}>
                    Cancel
                  </button>
                </div>
              ) : s?.url ? (
                <>
                  <p className={styles.note} role="status">
                    Your {name} Slip Is Ready.
                  </p>
                  {blockedUrl === s.url && (
                    <p className={styles.note} role="status">
                      Your browser blocked the new tab. Continue below to open your ready slip.
                    </p>
                  )}
                  <a
                    className={brand ? styles.brandedBook : styles.open}
                    style={brandStyle}
                    aria-label={
                      book === 'fanduel' && blockedUrl !== s.url
                        ? `Open in ${name} ↗`
                        : `Continue to ${name} ↗`
                    }
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {mark}
                    <span className={styles.bookAction}>
                      {book === 'fanduel' && blockedUrl !== s.url
                        ? `Open in ${name} ↗`
                        : `Continue to ${name} ↗`}
                      {p.estimatedOdds != null && (
                        <small>Est. {displayOdds(p.estimatedOdds)}</small>
                      )}
                    </span>
                  </a>
                </>
              ) : (
                <button
                  className={brand ? styles.brandedBook : styles.sportsbookRow}
                  style={brandStyle}
                  aria-label={
                    s?.busy && (book !== 'fanduel' || m.waitingBook === book)
                      ? `Preparing Your ${name} Slip...`
                      : `Open in ${name} ↗`
                  }
                  disabled={m.busy && !(book === 'fanduel' && s?.busy && m.waitingBook !== book)}
                  aria-busy={s?.busy ?? false}
                  onClick={() => m.choose(book, openSportsbook)}
                >
                  {mark}
                  <span className={styles.bookAction}>
                    {s?.busy && (book !== 'fanduel' || m.waitingBook === book) ? (
                      <>
                        <span className={styles.spinner} aria-hidden="true" />
                        Preparing Your {name} Slip...
                      </>
                    ) : (
                      <>
                        <span>
                          Open in {name} ↗
                          {p.adjustments > 0 && (
                            <small>
                              {p.adjustments} line adjustment{p.adjustments === 1 ? '' : 's'}
                            </small>
                          )}
                        </span>
                        <span
                          aria-label={`${name} · Estimated odds ${p.estimatedOdds == null ? 'Check odds' : displayOdds(p.estimatedOdds)}`}
                        >
                          {p.estimatedOdds == null
                            ? 'Check odds'
                            : `Est. ${displayOdds(p.estimatedOdds)}`}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              )}
              {s?.busy && (book !== 'fanduel' || m.waitingBook === book) && (
                <>
                  <p className={styles.note} role="status">
                    Matching your selections. This usually takes 10–20 seconds.
                  </p>
                  <button className={styles.transferSecondary} onClick={() => m.cancel(book)}>
                    Cancel wait
                  </button>
                </>
              )}
              {s?.error && (
                <p className={styles.note} role="alert">
                  {s.error}
                </p>
              )}
            </div>
          );
        })}

      {showDetails && (
        <>
          <p className={styles.note}>
            Stored prices are estimates. Direction and availability require review at the
            sportsbook.
          </p>
          <p className={styles.note}>{sportsbookNotice}</p>
        </>
      )}
    </section>
  );
}
