import { getTeamHeroCopy } from '@/config/team-hero-copy';
import { getTeamDisplayAccent } from '@/lib/team-theme-tokens';
import styles from './home-team-headline.module.css';

export function HomeTeamHeadline({ teamAbbr }: { teamAbbr?: string | null }) {
  const { line1, line2 } = getTeamHeroCopy(teamAbbr);
  return (
    <h1 className={styles.headline} data-home-team-headline>
      <span className={styles.first}>{line1}</span>{' '}
      <span
        className={styles.second}
        style={{
          color: getTeamDisplayAccent(teamAbbr),
          textTransform: teamAbbr?.toUpperCase() === 'SEA' ? 'none' : undefined,
        }}
      >
        {line2}
      </span>
    </h1>
  );
}
