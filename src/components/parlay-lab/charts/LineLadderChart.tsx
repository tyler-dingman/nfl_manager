'use client';

import EChart from './EChart';
import { baseChartOption, chartColors } from './parlayLabChartTheme';

type Row = {
  displayThreshold: string;
  last10: { hits: number; games: number; hitRate: number | null };
  last5: { hits: number; games: number; hitRate?: number | null };
  season: { hits: number; games: number; hitRate: number | null };
  last2Years: { hits: number; games: number; hitRate: number | null };
  hitRate: number | null;
  averageMargin: number | null;
  fanduelPrice: number | null;
  draftkingsPrice: number | null;
  isCurrentLine: boolean;
  isAvailable: boolean;
};
const odds = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n}`);
export default function LineLadderChart({
  rows,
  window,
}: {
  rows: Row[];
  window: 'L5' | 'L10' | 'SEASON' | '2 YEARS';
}) {
  if (!rows.length) return <p>Not enough line history.</p>;
  const sample = (row: Row) =>
    window === 'L5'
      ? row.last5
      : window === 'SEASON'
        ? row.season
        : window === '2 YEARS'
          ? row.last2Years
          : row.last10;
  const option = {
    ...baseChartOption,
    grid: { left: 18, right: 24, top: 12, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (raw: unknown) => {
        const p = raw as { dataIndex: number };
        const r = rows[p.dataIndex]!;
        return [
          `<b>${r.displayThreshold}${r.isCurrentLine ? ' · TODAY' : ''}</b>`,
          `Hit: ${sample(r).hits} / ${sample(r).games}`,
          `Hit rate: ${sample(r).hitRate ?? (sample(r).games ? Math.round((sample(r).hits / sample(r).games) * 1000) / 10 : '—')}%`,
          `Average margin: ${r.averageMargin ?? '—'}`,
          `FanDuel: ${odds(r.fanduelPrice)}`,
          `DraftKings: ${odds(r.draftkingsPrice)}`,
          r.isAvailable ? 'Available: Yes' : 'Research only',
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: '{value}%', color: chartColors.secondary },
      splitLine: { lineStyle: { color: chartColors.grid } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((r) =>
        r.isCurrentLine ? `${r.displayThreshold}  TODAY` : r.displayThreshold,
      ),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: chartColors.navy, fontWeight: 700 },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 22,
        data: rows.map((r) => ({
          value:
            sample(r).hitRate ??
            (sample(r).games ? Math.round((sample(r).hits / sample(r).games) * 1000) / 10 : 0),
          itemStyle: {
            color: chartColors.green,
            borderColor: r.isCurrentLine ? chartColors.orange : 'transparent',
            borderWidth: r.isCurrentLine ? 2 : 0,
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true,
          position: 'right',
          formatter: '{c}%',
          color: chartColors.navy,
          fontWeight: 700,
        },
      },
    ],
  };
  return (
    <EChart
      option={option}
      height={Math.max(220, rows.length * 38)}
      ariaLabel="Historical hit rate by prop line"
    />
  );
}
