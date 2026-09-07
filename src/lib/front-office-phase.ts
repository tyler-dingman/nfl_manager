export type FrontOfficePhase =
  | 'preseason'
  | `week-${number}`
  | 'wild-card'
  | 'divisional'
  | 'conference'
  | 'super-bowl'
  | 'resign_cut'
  | 'free_agency'
  | 'draft'
  | 'post-draft'
  | 'season';

export type FrontOfficePhaseAction = {
  label: string;
  target: FrontOfficePhase;
  requiresConfirmation: boolean;
  confirmation?: string;
};

export type DemoFranchiseWeek = {
  phase: `week-${number}`;
  record: { wins: number; losses: number; ties: number };
};

export function isDraftWorkflowAvailable(phase: string) {
  return phase === 'draft';
}

export function advanceDemoWeek(
  state: DemoFranchiseWeek,
  result: 'win' | 'loss' | 'tie',
): DemoFranchiseWeek {
  const week = Math.max(1, Math.min(18, Number(state.phase.slice(5)) || 1));
  return {
    phase: `week-${Math.min(18, week + 1)}`,
    record: {
      wins: state.record.wins + (result === 'win' ? 1 : 0),
      losses: state.record.losses + (result === 'loss' ? 1 : 0),
      ties: state.record.ties + (result === 'tie' ? 1 : 0),
    },
  };
}

export function phaseDisplayName(phase: string, freeAgencyWave = 1) {
  if (phase.startsWith('week-')) return `Week ${phase.slice(5)}`;
  return (
    {
      preseason: 'Preseason',
      'wild-card': 'Wild Card',
      divisional: 'Divisional Round',
      conference: 'Conference Championship',
      'super-bowl': 'Super Bowl',
      resign_cut: 'Re-signing period',
      free_agency: `Free agency · Wave ${freeAgencyWave}`,
      draft: 'NFL Draft',
      'post-draft': 'Post-Draft',
      season: 'Preseason',
    }[phase] ?? phase
  );
}

export function getFrontOfficePhaseActions(phase: string): {
  primary: FrontOfficePhaseAction;
  jumps: FrontOfficePhaseAction[];
} {
  if (phase.startsWith('week-')) {
    const week = Math.max(1, Math.min(18, Number(phase.slice(5)) || 1));
    const next = week < 18 ? (`week-${week + 1}` as FrontOfficePhase) : 'wild-card';
    const jumps: FrontOfficePhaseAction[] = [];
    if (week < 9) {
      jumps.push({
        label: 'Continue to Trade Deadline',
        target: 'week-9',
        requiresConfirmation: true,
        confirmation: `Simulate Weeks ${week}–8 and continue to the trade deadline?`,
      });
    }
    jumps.push({
      label: 'Continue to Playoffs',
      target: 'wild-card',
      requiresConfirmation: true,
      confirmation: `Simulate the remainder of the regular season from Week ${week}?`,
    });
    return {
      primary: {
        label: week < 18 ? `Continue to Week ${week + 1}` : 'Continue to Playoffs',
        target: next,
        requiresConfirmation: false,
      },
      jumps,
    };
  }

  const progression: Record<string, FrontOfficePhaseAction> = {
    preseason: { label: 'Continue to Week 1', target: 'week-1', requiresConfirmation: false },
    'wild-card': {
      label: 'Continue to Next Round',
      target: 'divisional',
      requiresConfirmation: false,
    },
    divisional: {
      label: 'Continue to Next Round',
      target: 'conference',
      requiresConfirmation: false,
    },
    conference: {
      label: 'Continue to Super Bowl',
      target: 'super-bowl',
      requiresConfirmation: false,
    },
    'super-bowl': {
      label: 'Continue to Offseason',
      target: 'resign_cut',
      requiresConfirmation: false,
    },
    resign_cut: {
      label: 'Continue to Free Agency',
      target: 'free_agency',
      requiresConfirmation: false,
    },
    free_agency: { label: 'Continue to Draft', target: 'draft', requiresConfirmation: false },
    draft: { label: 'Continue to Post-Draft', target: 'post-draft', requiresConfirmation: false },
    'post-draft': {
      label: 'Continue to Preseason',
      target: 'preseason',
      requiresConfirmation: false,
    },
    season: { label: 'Continue to Week 1', target: 'week-1', requiresConfirmation: false },
  };

  const primary = progression[phase] ?? progression.preseason;
  const jumps: FrontOfficePhaseAction[] = [];
  if (phase === 'resign_cut') {
    jumps.push({
      label: 'Continue to Draft',
      target: 'draft',
      requiresConfirmation: true,
      confirmation: 'Skip re-signing and free agency and continue directly to the Draft?',
    });
  }
  return { primary, jumps };
}
