import Image from 'next/image';
import { CalendarDays, Shield, Sun, ChevronRight } from 'lucide-react';
import { TEAM_LIST } from '@/data/teams';
import { overviewContext } from '../../../packages/parlay/projection-details';
import type { HomeMarket, ResearchDetail } from '../../../packages/parlay/research';
import styles from './overview-dashboard.module.css';
export function OverviewRail({
  data,
  market,
  onTab,
}: {
  data: ResearchDetail;
  market: HomeMarket;
  onTab: (tab: 'Matchup' | 'Splits') => void;
}) {
  const c = overviewContext(data, market),
    opponent = TEAM_LIST.find((t) => t.abbr === c.opponent);
  const date =
    data.event?.kickoffAt && Number.isFinite(Date.parse(data.event.kickoffAt))
      ? new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        }).format(new Date(data.event.kickoffAt))
      : 'Kickoff unavailable';
  return (
    <aside className={styles.rail} aria-label="Upcoming game context" data-overview-order="rail">
      <section>
        <button onClick={() => onTab('Matchup')}>
          <CalendarDays />
          <h3>Next Game</h3>
          <ChevronRight />
        </button>
        <div className={styles.game}>
          {opponent && (
            <Image unoptimized src={opponent.logoUrl} alt={opponent.name} width={64} height={52} />
          )}
          <div>
            <strong>
              {data.event?.homeTeamId === (market.teamId ?? data.player?.teamId) ? 'vs' : '@'}{' '}
              {c.opponent ?? '—'}
            </strong>
            <p>{opponent?.name ?? 'Opponent unavailable'}</p>
          </div>
          <div>
            <p>{date}</p>
            {data.venue?.current?.stadium && <p>{data.venue.current.stadium}</p>}
          </div>
        </div>
      </section>
      <section>
        <button onClick={() => onTab('Matchup')}>
          <Shield />
          <h3>Matchup Snapshot</h3>
          <ChevronRight />
        </button>
        {c.matchup.length ? (
          <dl>
            {c.matchup.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Matchup information is unavailable.</p>
        )}
      </section>
      <section>
        <button onClick={() => onTab('Splits')}>
          <Sun />
          <h3>Game Environment</h3>
          <ChevronRight />
        </button>
        {c.environment.length ? (
          <dl>
            {c.environment.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Game environment information is unavailable.</p>
        )}
      </section>
    </aside>
  );
}
