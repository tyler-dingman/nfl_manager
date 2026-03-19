export type OffseasonProgressStep = 'manage' | 'free-agency' | 'draft';

export type StepProgressRecord = {
  score: number;
  events: string[];
  completed: boolean;
  skipped: boolean;
};

export type OffseasonProgressSnapshot = Record<OffseasonProgressStep, StepProgressRecord>;

export type ProgressEventInput = {
  step: OffseasonProgressStep;
  eventKey: string;
  points?: number;
  complete?: boolean;
  skipped?: boolean;
};

export const OFFSEASON_PROGRESS_MAX = 100;

export const OFFSEASON_PROGRESS_POINTS: Record<
  OffseasonProgressStep,
  Record<string, number>
> = {
  manage: {
    resign: 32,
    cut: 22,
    trade: 36,
    cap_resolved: 30,
    continue: 100,
    skip: 100,
  },
  'free-agency': {
    sign: 48,
    fill_need: 24,
    continue: 100,
    skip: 100,
  },
  draft: {
    pick: 36,
    trade_response: 14,
    finish: 100,
    continue: 100,
    skip: 100,
  },
};

export const createEmptyOffseasonProgressSnapshot = (): OffseasonProgressSnapshot => ({
  manage: { score: 0, events: [], completed: false, skipped: false },
  'free-agency': { score: 0, events: [], completed: false, skipped: false },
  draft: { score: 0, events: [], completed: false, skipped: false },
});

export const getStepProgressPercent = (
  snapshot: OffseasonProgressSnapshot,
  step: OffseasonProgressStep,
) => Math.max(0, Math.min(OFFSEASON_PROGRESS_MAX, Math.round(snapshot[step].score)));

export const getOverallOffseasonProgressPercent = (
  snapshot: OffseasonProgressSnapshot,
) => {
  const total =
    getStepProgressPercent(snapshot, 'manage') +
    getStepProgressPercent(snapshot, 'free-agency') +
    getStepProgressPercent(snapshot, 'draft');

  return Math.round(total / 3);
};

export const getCompletedOffseasonStepCount = (
  snapshot: OffseasonProgressSnapshot,
) =>
  (['manage', 'free-agency', 'draft'] as OffseasonProgressStep[]).filter(
    (step) => getStepProgressPercent(snapshot, step) >= OFFSEASON_PROGRESS_MAX,
  ).length;

export const getHighestUnlockedStepIndexFromProgress = (
  snapshot: OffseasonProgressSnapshot,
) => {
  if (getStepProgressPercent(snapshot, 'draft') >= OFFSEASON_PROGRESS_MAX) return 2;
  if (getStepProgressPercent(snapshot, 'free-agency') >= OFFSEASON_PROGRESS_MAX) return 2;
  if (getStepProgressPercent(snapshot, 'manage') >= OFFSEASON_PROGRESS_MAX) return 1;
  return 0;
};

export const applyProgressEvent = (
  snapshot: OffseasonProgressSnapshot,
  input: ProgressEventInput,
) => {
  const current = snapshot[input.step];
  if (current.events.includes(input.eventKey)) {
    return {
      snapshot,
      changed: false,
      stepJustCompleted: false,
    };
  }

  const nextScore = input.complete
    ? OFFSEASON_PROGRESS_MAX
    : Math.min(
        OFFSEASON_PROGRESS_MAX,
        current.score + Math.max(0, Math.round(input.points ?? 0)),
      );
  const nextCompleted = input.complete || nextScore >= OFFSEASON_PROGRESS_MAX;
  const nextRecord: StepProgressRecord = {
    score: nextScore,
    events: [...current.events, input.eventKey],
    completed: nextCompleted,
    skipped: input.skipped ? true : current.skipped,
  };

  return {
    snapshot: {
      ...snapshot,
      [input.step]: nextRecord,
    },
    changed: true,
    stepJustCompleted: !current.completed && nextCompleted,
  };
};
