import type { DraftSessionDTO } from '@/types/draft';

export type DraftSimulationTarget = {
  round: number;
} & ({ kind: 'user_pick' | 'end_round' | 'end_draft' } | { kind: 'next_pick'; pickIndex: number });

export function reachedDraftSimulationTarget(
  session: DraftSessionDTO,
  target: DraftSimulationTarget | null,
) {
  if (!target) return false;
  const pick = session.picks[session.currentPickIndex];
  if (session.status === 'completed' || !pick || pick.round > session.maxRounds) return true;
  if (target.kind === 'next_pick') return session.currentPickIndex > target.pickIndex;
  if (target.kind === 'user_pick') return pick.ownerTeamAbbr === session.userTeamAbbr;
  if (target.kind === 'end_round') return pick.round > target.round;
  return false;
}
