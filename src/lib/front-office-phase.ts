import type { FranchiseSimulationState } from '@/types/front-office';
export type FrontOfficePhase =
  | 'scouting_combine'
  | 'free_agency_open'
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
  href?: string;
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

/** Legacy values are normalized at save boundaries; phase remains the sole persisted clock. */
export function normalizeFrontOfficePhase(phase: string, legacyWave?: number): FrontOfficePhase {
  if (/^week-\d+$/.test(phase)) return `week-${Math.max(1, Math.min(18, Number(phase.slice(5))))}`;
  if (['resign_cut', 'combine', 'offseason'].includes(phase)) return 'scouting_combine';
  if (['trade-deadline', 'trade_deadline'].includes(phase)) return 'week-9';
  if (phase === 'playoffs') return 'wild-card';
  if (['tampering', 'free_agency_phase_1'].includes(phase)) return 'free_agency';
  if (phase === 'nfl_draft') return 'draft';
  if (phase === 'free_agency_phase_2') return 'free_agency_open';
  if (['preseason', 'season', 'post-draft'].includes(phase)) return 'week-1';
  if (phase === 'free_agency' && legacyWave && legacyWave > 1) return 'free_agency_open';
  if (
    [
      'wild-card',
      'divisional',
      'conference',
      'super-bowl',
      'scouting_combine',
      'free_agency',
      'free_agency_open',
      'draft',
    ].includes(phase)
  )
    return phase as FrontOfficePhase;
  return 'week-1';
}

export function frontOfficeLifecycle(phase: string) {
  const normalized = normalizeFrontOfficePhase(phase);
  if (normalized.startsWith('week-'))
    return { mainPhase: 'SEASON' as const, week: Number(normalized.slice(5)) };
  if (['wild-card', 'divisional', 'conference', 'super-bowl'].includes(normalized))
    return { mainPhase: 'PLAYOFFS' as const, playoffStage: normalized };
  return {
    mainPhase: 'OFFSEASON' as const,
    offseasonStage:
      normalized === 'scouting_combine'
        ? ('SCOUTING_COMBINE' as const)
        : normalized === 'draft'
          ? ('NFL_DRAFT' as const)
          : ('FREE_AGENCY' as const),
    freeAgencyPhase:
      normalized === 'free_agency'
        ? ('TAMPERING' as const)
        : normalized === 'free_agency_open'
          ? ('OPEN_FREE_AGENCY' as const)
          : undefined,
  };
}

export function isOffseasonFreeAgency(phase: string) {
  return frontOfficeLifecycle(phase).offseasonStage === 'FREE_AGENCY';
}

export function phaseDisplayName(phase: string, _legacyWave?: number) {
  const normalized = normalizeFrontOfficePhase(phase);
  if (normalized.startsWith('week-')) return `Season · Week ${normalized.slice(5)}`;
  return (
    {
      'wild-card': 'Playoffs · Wild Card',
      divisional: 'Playoffs · Divisional Round',
      conference: 'Playoffs · Conference Championships',
      'super-bowl': 'Playoffs · Super Bowl',
      scouting_combine: 'Offseason · Scouting Combine',
      free_agency: 'Offseason · Free Agency · Phase 1 · Tampering Window',
      free_agency_open: 'Offseason · Free Agency · Phase 2 · Free Agency',
      draft: 'Offseason · NFL Draft',
    } as Record<string, string>
  )[normalized];
}

export function getFrontOfficePhaseActions(
  phase: string,
  context: { draftCompleted?: boolean; playoffEliminated?: boolean } = {},
): {
  primary: FrontOfficePhaseAction;
  jumps: FrontOfficePhaseAction[];
} {
  phase = normalizeFrontOfficePhase(phase);
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
        label: week < 18 ? `Continue to Week ${week + 1}` : 'Complete Regular Season',
        target: next,
        requiresConfirmation: false,
      },
      jumps,
    };
  }

  const progression: Record<string, FrontOfficePhaseAction> = {
    'wild-card': {
      label: 'Continue to Divisional Round',
      target: 'divisional',
      requiresConfirmation: false,
    },
    divisional: {
      label: 'Continue to Conference Championships',
      target: 'conference',
      requiresConfirmation: false,
    },
    conference: {
      label: 'Continue to Super Bowl',
      target: 'super-bowl',
      requiresConfirmation: false,
    },
    'super-bowl': {
      label: 'Continue to Scouting Combine',
      target: 'scouting_combine',
      requiresConfirmation: false,
    },
    scouting_combine: {
      label: 'Continue to Free Agency',
      target: 'free_agency',
      requiresConfirmation: false,
    },
    free_agency: {
      label: 'Continue to Free Agency',
      target: 'free_agency_open',
      requiresConfirmation: false,
    },
    free_agency_open: {
      label: 'Continue to NFL Draft',
      target: 'draft',
      requiresConfirmation: false,
    },
    draft: context.draftCompleted
      ? { label: 'Begin New Season', target: 'week-1', requiresConfirmation: false }
      : {
          label: 'Enter Draft Central',
          target: 'draft',
          href: '/front-office/draft',
          requiresConfirmation: false,
        },
  };
  const primary =
    context.playoffEliminated && frontOfficeLifecycle(phase).mainPhase === 'PLAYOFFS'
      ? {
          label: 'Continue to Offseason',
          target: 'scouting_combine' as const,
          requiresConfirmation: false,
        }
      : progression[phase];
  const jumps: FrontOfficePhaseAction[] = [];
  return { primary, jumps };
}

export function isTeamAliveInPlayoffs(state: FranchiseSimulationState, teamAbbr: string) {
  return Boolean(
    state.playoffs &&
    Object.values(state.playoffs.seeds).flat().includes(teamAbbr) &&
    !state.playoffs.games.some(
      (game) =>
        game.played &&
        [game.homeTeam, game.awayTeam].includes(teamAbbr) &&
        game.winner !== teamAbbr,
    ),
  );
}

/** Both UI navigation and simulation validation use the committed franchise snapshot. */
export function getFranchisePhaseActions(state: FranchiseSimulationState, teamAbbr?: string) {
  return getFrontOfficePhaseActions(state.phase, {
    draftCompleted:
      state.completedDraft?.mode === 'real' &&
      state.completedDraft.status === 'completed' &&
      state.completedDraft.draftYear === state.season + 1,
    playoffEliminated: Boolean(
      teamAbbr && state.playoffs && !isTeamAliveInPlayoffs(state, teamAbbr),
    ),
  });
}

export function getFranchiseNextGame(state: FranchiseSimulationState | null, teamAbbr: string) {
  if (!state) return undefined;
  const phase = frontOfficeLifecycle(state.phase);
  const games =
    phase.mainPhase === 'SEASON'
      ? state.games
      : phase.mainPhase === 'PLAYOFFS'
        ? (state.playoffs?.games ?? [])
        : [];
  return games.find((game) => !game.played && [game.homeTeam, game.awayTeam].includes(teamAbbr));
}
