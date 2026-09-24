import type { ReactNode } from 'react';
import type { BeatGraphicData } from './beat-model';
import styles from './beat-card.module.css';

/** Foreground relationships stay in layout flow; the supplied SVGs remain background layers. */
export function beatComposition(
  data: BeatGraphicData,
  logo: (team: string) => ReactNode,
  team: string,
): ReactNode {
  const mark = (team: string) => <div className={styles.compositionLogo}>{logo(team)}</div>;
  switch (data.family) {
    case 'transaction': {
      const players = data.players ?? [
        { name: data.name, position: data.position, jersey: data.jersey },
      ];
      const action =
        data.action === 'PLACED_ON_IR' ? 'PLACED\nON IR' : data.action.replaceAll('_', ' ');
      return (
        <div
          className={styles.transactionComposition}
          data-beat-composition="transaction"
          data-has-contract={!!data.contract}
        >
          <div className={styles.transactionFlow}>
            {mark(data.team)}
            <svg
              viewBox="0 0 48 18"
              className={styles.transactionChevrons}
              data-beat-layer="directional-four-chevrons"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {[0, 12, 24, 36].map((x) => (
                <path key={x} d={`M${x + 2} 3 L${x + 8} 9 L${x + 2} 15`} />
              ))}
            </svg>
            <strong className={styles.transactionAction} data-long={action.length > 8}>
              {action}
            </strong>
          </div>
          <div className={styles.transactionDetails}>
            <div className={styles.transactionPlayers} data-multiple={players.length > 1}>
              {players.map((player, i) => (
                <div key={i} className={styles.transactionPlayer}>
                  {(player.position || player.jersey) && (
                    <span className={styles.transactionPosition}>
                      {[player.position, player.jersey ? '#' + player.jersey : undefined]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                  <strong className={styles.transactionName} data-long={player.name.length > 20}>
                    {player.name}
                  </strong>
                </div>
              ))}
              {(data.destination || data.origin) && (
                <small className={styles.transactionDestination}>
                  {data.destination ?? 'FROM ' + data.origin}
                </small>
              )}
            </div>
            {data.contract && (
              <div className={styles.transactionContract}>
                <small>CONTRACT</small>
                <strong>{data.contract.term}</strong>
                <strong>{data.contract.value}</strong>
              </div>
            )}
          </div>
        </div>
      );
    }
    case 'numbered':
      return (
        <div className={styles.numberComposition} data-beat-composition="numbered">
          <strong className={styles.displayNumber} data-digits={data.count.length}>
            {data.count}
          </strong>
          <strong className={styles.listDescriptor}>{data.descriptor}</strong>
        </div>
      );
    case 'game-matchup':
      return (
        <div className={styles.matchupComposition} data-beat-composition="matchup">
          {mark(data.leftTeam)}
          <div className={styles.matchupCenter}>
            {data.week && <strong>{data.week.replace(/^W(\d)/, 'WEEK $1')}</strong>}
            <strong className={styles.versusText}>VS</strong>
            {data.kickoff && <span className={styles.kickoffText}>{data.kickoff}</span>}
          </div>
          {mark(data.rightTeam)}
        </div>
      );
    case 'game-result':
      return (
        <div className={styles.resultComposition} data-beat-composition="result">
          <div className={styles.scoreRow}>
            {mark(data.leftTeam)}
            <strong className={styles.accentScore}>{data.leftScore}</strong>
            <span className={styles.scoreDivider} aria-hidden="true" />
            <strong>{data.rightScore}</strong>
            {mark(data.rightTeam)}
          </div>
          <strong className={styles.finalText}>{data.final}</strong>
        </div>
      );
    case 'recap':
      return (
        <div className={styles.recapComposition} data-beat-composition="recap">
          {mark(data.teams[0])}
          <strong className={styles.largeTitle}>
            {data.overtime ? 'OVERTIME\nRECAP' : 'GAME\nRECAP'}
          </strong>
        </div>
      );
    case 'injury':
      return (
        <div
          className={styles.injuryComposition}
          data-beat-composition="injury"
          data-has-week={!!data.period}
        >
          {data.period && (
            <>
              <strong className={styles.displayWeek}>{data.period}</strong>
              <span className={styles.injuryDivider} aria-hidden="true" />
            </>
          )}
          <div className={styles.injuryText}>
            {data.rows.length ? (
              data.rows.map((row, i) => (
                <strong key={i}>
                  {row.count} {row.status}
                </strong>
              ))
            ) : (
              <strong>{data.detail ?? 'INJURY\nREPORT'}</strong>
            )}
          </div>
        </div>
      );
    case 'player':
      return (
        <div
          className={styles.playerComposition}
          data-beat-composition="player"
          data-update={!!data.status}
        >
          <div className={styles.playerIdentity}>
            <strong className={styles.playerName}>{data.name}</strong>
            <div className={styles.playerPosition}>
              {data.position && <strong>{data.position}</strong>}
              {data.jersey && <span>#{data.jersey}</span>}
            </div>
          </div>
          <div className={styles.playerStatus}>
            <span className={styles.statusRule} aria-hidden="true" />
            {data.status && <strong>{data.status}</strong>}
            {data.context && <small>{data.context}</small>}
          </div>
        </div>
      );
    case 'stats':
      return (
        <div
          className={styles.statsComposition}
          data-beat-composition="stats"
          data-has-stats={!!data.rows.length}
        >
          <div className={styles.statsHeading}>
            {data.count && <strong className={styles.statCount}>{data.count}</strong>}
            <strong>{data.descriptor}</strong>
          </div>
          {data.rows.length > 0 && (
            <div className={styles.statRows}>
              {data.rows.map((row, i) => (
                <div key={i}>
                  <strong>{row.value}</strong>
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case 'developing':
      return (
        <div className={styles.timelineComposition} data-beat-composition="developing">
          {data.updates.map((update, i) => (
            <div className={styles.timelineItem} key={i}>
              <strong>{update.time}</strong>
              <span>{update.detail}</span>
            </div>
          ))}
        </div>
      );
    case 'depth-chart':
    case 'mailbag':
    case 'practice':
      return (
        <div className={styles.topicComposition} data-beat-composition={data.family}>
          {data.family === 'depth-chart' && (
            <svg
              className={styles.depthGraphic}
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M50 25V48M20 48H80M20 48V70M50 48V70M80 48V70" />
              <rect x="40" y="10" width="20" height="15" rx="2" />
              <rect x="10" y="70" width="20" height="15" rx="2" />
              <rect x="40" y="70" width="20" height="15" rx="2" />
              <rect x="70" y="70" width="20" height="15" rx="2" />
            </svg>
          )}
          {data.family === 'practice' && (
            <span className={styles.topicGhost} aria-hidden="true">
              {team}
            </span>
          )}
          {data.family === 'mailbag' && (
            <span className={styles.topicGhost} aria-hidden="true">
              Q / A
            </span>
          )}
          <strong className={styles.largeTitle}>
            {data.family === 'depth-chart'
              ? 'DEPTH\nCHART'
              : data.family === 'mailbag'
                ? 'MAIL\nBAG'
                : 'PRACTICE'}
          </strong>
        </div>
      );
    default:
      return null;
  }
}
