import Link from 'next/link';
import { ArrowRight, Check, X } from 'lucide-react';
import { LabDataIcon, LabInsightsIcon, LabParlayIcon } from './lab-icons';
import styles from './alt-stack.module.css';
import PlayerAvatar from './PlayerAvatar';

export function AltStackCard({ teamAbbr }: { teamAbbr?: string }) {
  return (
    <section className={styles.card} aria-labelledby="alt-stack-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>PARLAY LAB</p>
        <h2 id="alt-stack-title" className={styles.title}>
          ALT STACK
        </h2>
        <p className={styles.tagline}>HIGH-FREQUENCY ALT LINES. REAL PAYOUT.</p>
        <p className={styles.description}>
          We find player props with strong historical hit rates and smart alternate lines — then
          stack them into one parlay for you.
        </p>
        <ul className={styles.benefits}>
          {[
            { title: 'REAL DATA', text: 'High hit rates, not hype.', Icon: LabDataIcon },
            {
              title: 'SMART ALTS',
              text: 'More cushion below the main line.',
              Icon: LabInsightsIcon,
            },
            { title: 'BIGGER PAYOUTS', text: 'Stack 4, 6, 8 or 10 legs.', Icon: LabParlayIcon },
          ].map(({ title, text, Icon }) => (
            <li key={title}>
              <Icon />
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </li>
          ))}
        </ul>
        <Link
          className={styles.cta}
          href={`/parlay-lab/alt-stack${teamAbbr ? `?team=${encodeURIComponent(teamAbbr)}` : ''}`}
        >
          GENERATE AN ALT STACK <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <aside className={styles.example} aria-label="Illustrative Alt Stack example">
        <p className={styles.eyebrow}>EXAMPLE</p>
        <div className={styles.playerHeader}>
          <PlayerAvatar
            name="Rashee Rice"
            headshotUrl="https://a.espncdn.com/i/headshots/nfl/players/full/4428331.png"
            size={48}
          />
          <div>
            <h3>Rashee Rice</h3>
            <p className={styles.market}>Receiving Yards</p>
          </div>
        </div>
        <div className={styles.lineComparison}>
          <div>
            <strong>67.5</strong>
            <span>MAIN LINE</span>
          </div>
          <ArrowRight size={20} aria-hidden="true" />
          <div className={styles.altLine}>
            <strong>50+</strong>
            <span>ALT LINE</span>
          </div>
        </div>
        <div className={styles.metrics}>
          <p>
            <strong>9/10</strong> HIT RATE
          </p>
          <p>
            <strong>-325</strong> ODDS
          </p>
        </div>
        <p className={styles.lastTen}>LAST 10 GAMES</p>
        <ol className={styles.hits} aria-label="Last 10 games: 9 hits and 1 miss">
          {Array.from({ length: 10 }, (_, i) => (
            <li
              key={i}
              className={i === 6 ? styles.miss : styles.hit}
              aria-label={`Game ${i + 1}: ${i === 6 ? 'miss' : 'hit'}`}
            >
              {i === 6 ? (
                <X size={14} aria-hidden="true" />
              ) : (
                <Check size={14} aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
        <p className={styles.note}>Illustrative example · Not live odds</p>
      </aside>
    </section>
  );
}
