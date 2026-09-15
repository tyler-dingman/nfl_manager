'use client';

import { BarChart } from 'echarts/charts';
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { useEffect, useRef } from 'react';

echarts.use([BarChart, GridComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);

export default function EChart({
  option,
  height = 260,
  ariaLabel,
}: {
  option: EChartsCoreOption;
  height?: number;
  ariaLabel: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current, undefined, { renderer: 'canvas' });
    chart.setOption(option, { notMerge: true });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, []);
  useEffect(() => {
    const chart = element.current ? echarts.getInstanceByDom(element.current) : undefined;
    chart?.setOption(option, { notMerge: true });
  }, [option]);
  return <div ref={element} role="img" aria-label={ariaLabel} style={{ width: '100%', height }} />;
}
