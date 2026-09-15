'use client';

import EChart from './EChart';
import { baseChartOption, chartColors } from './parlayLabChartTheme';
type Bin = { label: string; games: number; percentage: number };
export default function ResultDistributionChart({ bins, line }: { bins: Bin[]; line: number }) {
  if (!bins.length) return <p>Not enough data to show distribution.</p>;
  const option = {
    ...baseChartOption,
    tooltip: {
      trigger: 'item',
      formatter: (raw: unknown) => {
        const p = raw as { dataIndex: number };
        const b = bins[p.dataIndex]!;
        return `<b>${b.label}</b><br/>${b.games} game${b.games === 1 ? '' : 's'}<br/>${b.percentage}% of sample<br/>Today's line: ${line}`;
      },
    },
    xAxis: {
      type: 'category',
      data: bins.map((b) => b.label),
      axisTick: { show: false },
      axisLabel: { color: chartColors.secondary },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      splitLine: { lineStyle: { color: chartColors.grid } },
      name: 'Games',
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 42,
        data: bins.map((b) => b.games),
        itemStyle: { color: chartColors.navy, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', color: chartColors.navy },
      },
    ],
  };
  return (
    <EChart option={option} height={230} ariaLabel="Distribution of historical player results" />
  );
}
