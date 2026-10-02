import type { HeroFacility } from '../../packages/front-office/hero-assets';
import { ownershipMetrics, reportCard, type OwnershipState } from '@/features/ownership/model';
export function heroOwnershipSnapshot(state: OwnershipState | undefined, year: number) {
  if (!state) return undefined;
  const metrics = ownershipMetrics(state, year);
  const lowest = reportCard(state, year).sort((a, b) => a.score - b.score)[0];
  return {
    facilities: reportCard(state, year).flatMap((f): HeroFacility[] => {
      const visual = (
        {
          'Locker Room': 'locker-room',
          'Training Room': 'training-room',
          'Weight Room': 'weight-room',
          'Food / Dining': 'cafeteria',
        } as const
      )[f.name as 'Locker Room'];
      return visual
        ? [{ ...f, visual, upgradeAvailable: !state.projects.some((p) => p.id === f.projectId) }]
        : [];
    }),
    attendance: metrics.attendance,
    facility: lowest.name,
    grade: lowest.grade,
    sentiment: `Fan sentiment: ${Math.round(metrics.sentiment)}/100. Review where investment could help.`,
  };
}
