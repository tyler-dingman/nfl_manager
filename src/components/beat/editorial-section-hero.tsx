import type { CSSProperties, ReactNode } from 'react';
import { getTeamDisplayAccent, getEditorialHeroTheme } from '@/lib/team-theme-tokens';
import headlineStyles from '@/components/home/home-team-headline.module.css';
import styles from './beat-hero.module.css';

export function EditorialSectionHero({
  teamAbbr,
  firstWord,
  accentWord,
  tagline,
  taglineLabel,
  variant,
  children,
}: {
  teamAbbr: string;
  firstWord: string;
  accentWord: string;
  tagline: ReactNode;
  taglineLabel: string;
  variant: 'beat' | 'film-room';
  children: ReactNode;
}) {
  const { heroPrimaryAccent, heroBrightAccent } = getEditorialHeroTheme(teamAbbr);
  return (
    <section
      className={styles.hero}
      data-editorial-hero={variant}
      data-beat-hero={variant === 'beat' ? '' : undefined}
      style={
        {
          '--hero-beat-accent': getTeamDisplayAccent(teamAbbr),
          '--hero-primary-accent': heroPrimaryAccent,
          '--hero-beat-detail': heroBrightAccent,
          '--team-secondary-on-dark': 'var(--hero-beat-detail)',
        } as CSSProperties
      }
    >
      <div className={styles.layout}>
        <div className={styles.identity}>
          <div className={styles.identityContent}>
            <h1 className={`${headlineStyles.headline} ${styles.title}`}>
              {firstWord} <span>{accentWord}</span>
            </h1>
            <p className={styles.tagline}>
              <svg
                className={styles.taglineText}
                viewBox="0 0 1000 65"
                role="img"
                aria-label={taglineLabel}
              >
                <text x="0" y="50" textLength="1000" lengthAdjust="spacingAndGlyphs">
                  {tagline}
                </text>
              </svg>
            </p>
          </div>
        </div>
        <div className={styles.briefing}>{children}</div>
      </div>
    </section>
  );
}
