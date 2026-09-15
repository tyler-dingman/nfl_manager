'use client';

import EChart from './EChart';
import { baseChartOption, chartColors } from './parlayLabChartTheme';
import styles from './charts.module.css';
import type { CSSProperties } from 'react';

export type GamePoint = {
  gameId: string;
  season: number;
  week: number;
  opponent: string;
  homeAway: string;
  value: number;
  line: number;
  result: string;
  margin: number;
  targets?: number | null;
  opponentDefenseRank?: number | null;
  defenseLabel?: string | null;
  environment?: {
    gameWindow: string;
    restDays: number | null;
  };
  venue?: { environment: string };
};

export default function GameByGameTrendChart({
  points,
  marketLabel,
  upcomingMatchup,
}: {
  points: GamePoint[];
  marketLabel: string;
  upcomingMatchup?: {
    opponentAbbreviation: string;
    defenseRank: number;
    defenseLabel: string;
    defenseSeason: number;
  } | null;
}) {
  if (!points.length) return <p>Not enough historical games.</p>;
  const line = points[0]!.line;
  const option = {
    ...baseChartOption,
    tooltip: {
      trigger: 'item',
      formatter: (raw: unknown) => {
        const p = raw as { dataIndex: number };
        const game = points[p.dataIndex]!;
        return [
          `<b>Week ${game.week} ${game.homeAway === 'HOME' ? 'vs' : '@'} ${game.opponent}</b>`,
          `${marketLabel}: <b>${game.value}</b>`,
          `Today's line: ${line}`,
          `Result: <b>${game.result}</b>`,
          `Margin: ${game.margin > 0 ? '+' : ''}${game.margin}`,
          ...(game.opponentDefenseRank
            ? [
                `${game.season} ${game.opponent} ${game.defenseLabel ?? 'Defense'}: #${game.opponentDefenseRank}`,
              ]
            : []),
          ...(game.targets != null ? [`Targets: ${game.targets}`] : []),
          ...(game.environment
            ? [
                `Game: ${game.environment.gameWindow
                  .replaceAll('_', ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, (letter) => letter.toUpperCase())}`,
                `Rest: ${game.environment.restDays === null ? 'Season opener' : `${game.environment.restDays} days`}`,
              ]
            : []),
          ...(game.venue
            ? [
                `Venue: ${game.venue.environment.toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}`,
              ]
            : []),
          game.homeAway,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.opponent),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartColors.border } },
      axisLabel: { color: chartColors.secondary },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitLine: { lineStyle: { color: chartColors.grid } },
      axisLabel: { color: chartColors.secondary },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 34,
        data: points.map((p) => ({
          value: p.value,
          itemStyle: {
            color: p.result === 'HIT' ? chartColors.green : chartColors.muted,
            borderRadius: [4, 4, 0, 0],
          },
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          label: { formatter: `Today ${line}`, color: chartColors.orange },
          lineStyle: { color: chartColors.orange, width: 2, type: 'dashed' },
          data: [{ yAxis: line }],
        },
      },
    ],
  };
  const ranked = points.some((point) => point.opponentDefenseRank);
  return (
    <>
      <EChart
        option={option}
        ariaLabel={`${marketLabel} game-by-game results against today's line`}
      />
      {ranked && (
        <>
          <p className={styles.defenseStripLabel}>Opponent defense rank</p>
          <div className={styles.defenseStripRow}>
            <div
              className={styles.defenseStrip}
              style={{ '--point-count': points.length } as CSSProperties}
            >
              {points.map((point) => (
                <span
                  key={point.gameId}
                  style={{ '--rank': point.opponentDefenseRank ?? 32 } as CSSProperties}
                  title={`${point.opponent} finished ${point.season} #${point.opponentDefenseRank ?? '—'} in ${point.defenseLabel ?? 'defense'}`}
                >
                  {point.opponentDefenseRank ? `#${point.opponentDefenseRank}` : '—'}
                </span>
              ))}
            </div>
            {upcomingMatchup && (
              <div
                className={styles.nextDefense}
                title={`${upcomingMatchup.opponentAbbreviation} finished ${upcomingMatchup.defenseSeason} #${upcomingMatchup.defenseRank} in ${upcomingMatchup.defenseLabel}`}
              >
                <small>Next</small>
                <b>{upcomingMatchup.opponentAbbreviation}</b>
                <span>#{upcomingMatchup.defenseRank}</span>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
