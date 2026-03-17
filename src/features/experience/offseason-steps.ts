export type OffseasonStepId = 'manage' | 'free-agency' | 'draft';

export const OFFSEASON_STEPS: Array<{
  id: OffseasonStepId;
  label: string;
  route: string;
  substeps?: string[];
}> = [
  {
    id: 'manage',
    label: 'Manage Team',
    route: '/roster',
    substeps: ['Re-sign / Cut Players', 'Trade Hub'],
  },
  {
    id: 'free-agency',
    label: 'Free Agency',
    route: '/free-agents',
  },
  {
    id: 'draft',
    label: 'Draft',
    route: '/draft/room?mode=mock',
  },
];

export const STEP_ROUTE_PREFIXES: Record<OffseasonStepId, string[]> = {
  manage: ['/manage-team', '/roster', '/manage/trades'],
  'free-agency': ['/free-agents'],
  draft: ['/draft'],
};
