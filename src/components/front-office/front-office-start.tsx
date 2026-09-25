'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import accents from '../../../public/assets/the-beat-asset-library/config/team-accents.json';
import { getAccessibleTeamPickColor } from '@/lib/team-theme-tokens';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  DraftingCompass,
  FileText,
  Handshake,
  Star,
  TrendingUp,
  Trophy,
  ScanSearch,
} from 'lucide-react';
import { gameDayHeroAsset } from '@/config/game-day-hero';
import { TEAM_LIST } from '@/data/teams';
import type { FrontOfficePath } from '@/types/front-office';
import styles from './front-office-start.module.css';

const lifecycle = [
  { title: 'Season', detail: 'Weeks 1–18', icon: CalendarDays },
  { title: 'Playoffs', detail: 'Win the Super Bowl', icon: Trophy },
  { title: 'Combine', detail: 'Evaluate talent', icon: ScanSearch },
  { title: 'Free Agency', detail: 'Build the roster', icon: FileText },
  { title: 'Draft', detail: 'Add the next generation', icon: DraftingCompass },
  { title: 'Next Season', detail: 'Keep building', icon: TrendingUp },
];

export function FrontOfficeStart({
  teamAbbr,
  season,
  onStart,
  busy,
  error,
}: {
  teamAbbr: string | null;
  season: number;
  onStart: (mode: FrontOfficePath) => void;
  busy: boolean;
  error: string;
}) {
  const team = TEAM_LIST.find((t) => t.abbr === teamAbbr);
  const nickname = team?.name.replace(`${team.city} `, '') ?? 'franchise';
  return (
    <section
      className={styles.start}
      aria-labelledby="franchise-start-title"
      style={
        {
          '--fo-accent':
            accents.teams[teamAbbr as keyof typeof accents.teams]?.accent ??
            'var(--fo-interactive-text)',
          '--start-button': getAccessibleTeamPickColor(teamAbbr || 'MIA'),
          '--start-stadium': `url("${gameDayHeroAsset(teamAbbr ?? '') ?? '/assets/front-office/news-graphics/backgrounds/stadium.svg'}")`,
        } as CSSProperties
      }
    >
      <header className={styles.intro}>
        <span className={styles.ghost} aria-hidden="true">
          {team?.abbr}
        </span>
        <p className={styles.eyebrow}>Front Office · {team?.name ?? 'Your team'}</p>
        <h1 id="franchise-start-title" className="dd-home-hero-display">
          Take control of the {nickname}.
        </h1>
        <p className={styles.description}>
          The decisions are yours. Build the roster, manage the cap,
          <br className={styles.desktopBreak} /> navigate the draft, and shape the future of the
          franchise.
        </p>
      </header>
      <article className={styles.full}>
        <div className={styles.fullCopy}>
          <p className={styles.recommended}>
            <Star aria-hidden="true" /> Recommended
          </p>
          <h2>Full Experience</h2>
          <p className={styles.description}>
            Take control from Week 1 and manage every decision
            <br className={styles.desktopBreak} /> throughout the season.
          </p>
          <ul className={styles.features}>
            {[
              'Weekly decisions',
              'Free Agency',
              'Player Development',
              'Trades',
              'NFL Draft',
              'Ownership',
            ].map((feature) => (
              <li key={feature}>
                <Check aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <button className={styles.primary} disabled={busy} onClick={() => onStart('full')}>
            Start the {season} season <ArrowRight aria-hidden="true" />
          </button>
        </div>
        <div className={styles.identity} aria-hidden="true">
          <div className={styles.playbook} />
          {team && (
            <Image src={team.logoUrl} alt="" width={300} height={260} unoptimized priority />
          )}
          <p>
            Your team.
            <br />
            Your decisions.
          </p>
        </div>
      </article>
      <h2 className={styles.sectionLabel}>Or jump into a specific experience</h2>
      <div className={styles.quickStarts}>
        <article className={styles.quick}>
          <Handshake className={styles.icon} aria-hidden="true" />
          <div>
            <h3>Free Agency</h3>
            <p className={styles.kicker}>Build the roster</p>
            <p>
              Enter the offseason free-agent market
              <br className={styles.desktopBreak} /> with your current roster and cap situation.
            </p>
            <button disabled={busy} onClick={() => onStart('free_agency')}>
              Start Free Agency <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <Handshake className={styles.quickArt} aria-hidden="true" />
        </article>
        <article className={styles.quick}>
          <DraftingCompass className={styles.icon} aria-hidden="true" />
          <div>
            <h3>NFL Draft</h3>
            <p className={styles.kicker}>Build the future</p>
            <p>
              Take control of your draft board,
              <br className={styles.desktopBreak} /> scouting and selections.
            </p>
            <button disabled={busy} onClick={() => onStart('draft')}>
              Start the Draft <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <DraftingCompass className={styles.quickArt} aria-hidden="true" />
        </article>
      </div>
      {busy && (
        <p role="status" className={styles.feedback}>
          Starting your experience…
        </p>
      )}
      {error && (
        <p role="alert" className={styles.feedback}>
          {error}
        </p>
      )}
      <h2 className={styles.sectionLabel}>The franchise lifecycle</h2>
      <ol className={styles.lifecycle}>
        {lifecycle.map(({ title, detail, icon: Icon }, i) => (
          <li key={title}>
            <Icon aria-hidden="true" />
            <div>
              <strong>{title}</strong>
              <small>{detail}</small>
            </div>
            {i < lifecycle.length - 1 && (
              <ChevronRight className={styles.chevron} aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
