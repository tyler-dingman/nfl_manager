'use client';

import EChart from './EChart';
import { baseChartOption, chartColors } from './parlayLabChartTheme';

type Point = { gameId: string; opponent: string; value: number; result: string; week: number };
export default function OpponentVsPositionChart({
  points,
  line,
  label,
}: {
  points: Point[];
  line: number;
  label: string;
}) {
  if (!points.length) return <p>Limited matchup sample.</p>;
  const option = {
    ...baseChartOption,
    tooltip: {
      ...baseChartOption.tooltip,
      trigger: 'item',
      formatter: (raw: unknown) => {
        const p = raw as { dataIndex: number };
        const x = points[p.dataIndex]!;
        return `<b>Game ${points.length - p.dataIndex}</b><br/>${label}: ${x.value}<br/>Result: <b>${x.result}</b><br/>Line: ${line}`;
      },
    },
    xAxis: {
      type: 'category',
      data: points.map((_, i) => `G${i + 1}`),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartColors.border } },
      axisLabel: { color: chartColors.secondary },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: chartColors.secondary },
      splitLine: { lineStyle: { color: chartColors.grid } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 30,
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
          lineStyle: { color: chartColors.orange, type: 'dashed' },
          label: { formatter: `Today ${line}`, color: chartColors.orange },
          data: [{ yAxis: line }],
        },
      },
    ],
  };
  return (
    <EChart option={option} height={230} ariaLabel={`${label} results against today's line`} />
  );
}
