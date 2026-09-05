export const TRIAL_DURATION_MS = 72 * 60 * 60 * 1000;
export const DAILY_GENERATION_LIMIT = 10;
export const TOTAL_GENERATION_LIMIT = 30;
export const TOTAL_AI_SPEND_LIMIT_USD = 5;
export const EXPIRED_MESSAGE = 'Three-day content automation test has expired';

export type TrialWindow =
  | { active: true; startsAt: Date; expiresAt: Date; overridden: boolean }
  | { active: false; reason: 'missing' | 'invalid' | 'not-started' | 'expired'; message: string };

export function evaluateTrialWindow(input: {
  startsAt?: string;
  expiresAt?: string;
  now?: Date;
  override?: boolean;
}): TrialWindow {
  const now = input.now ?? new Date();
  const startsAt = new Date(input.startsAt ?? '');
  const expiresAt = new Date(input.expiresAt ?? '');
  if (!input.startsAt || !input.expiresAt)
    return { active: false, reason: 'missing', message: EXPIRED_MESSAGE };
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime()))
    return { active: false, reason: 'invalid', message: EXPIRED_MESSAGE };
  if (expiresAt.getTime() - startsAt.getTime() !== TRIAL_DURATION_MS)
    return { active: false, reason: 'invalid', message: EXPIRED_MESSAGE };
  if (input.override) return { active: true, startsAt, expiresAt, overridden: true };
  if (now < startsAt)
    return {
      active: false,
      reason: 'not-started',
      message: 'Three-day content automation test has not started',
    };
  if (now >= expiresAt) return { active: false, reason: 'expired', message: EXPIRED_MESSAGE };
  return { active: true, startsAt, expiresAt, overridden: false };
}

export function generationStopReason(input: {
  generatedToday: number;
  generatedTotal: number;
  aiSpendTotalUsd: number;
}) {
  if (input.generatedToday >= DAILY_GENERATION_LIMIT) return 'Daily generation limit reached (10)';
  if (input.generatedTotal >= TOTAL_GENERATION_LIMIT)
    return 'Three-day generation limit reached (30)';
  if (input.aiSpendTotalUsd >= TOTAL_AI_SPEND_LIMIT_USD)
    return 'Three-day AI expenditure limit reached ($5)';
  return null;
}
